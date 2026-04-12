import { useRef, useCallback } from 'react';
import { useSentinel } from './useSentinel';
import { ByteTracker } from '../services/ByteTracker';
import { lineIntersect, isPointInPoly } from '../utils';
import { VideoBufferService } from '../services/videoRecorder';
import { Track, GeometryLine, StandardDetection, AuditJob } from '../types';
import { evidenceDB } from '../services/EvidenceDB';
import { forensicQueue } from '../services/ForensicQueue';
import { OCRSynchronizer } from '../services/OCRSynchronizer';
import { resetTrackAuditState } from '../services/trackAuditState';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getOrderedTurnSequence = (track: Track, geometry: GeometryLine[]) => {
  const turnIds = track.roiHistory.filter((id, index, history) => {
    if (history.indexOf(id) !== index) return false;
    const roi = geometry.find((c) => c.id === id);
    return roi?.type === 'roi_turn';
  });

  const turnLabels = turnIds.map(
    (id) => geometry.find((c) => c.id === id)?.label || id
  );

  return { turnIds, turnLabels };
};

// ─── Per-track evidence session ───────────────────────────────────────────────

interface EvidenceSession {
  lineId: string;
  startedAt: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Sentinel AI Frame Processor Hook.
 * Orchestrates detection, tracking, zone analysis, and forensic audit triggering.
 *
 * Key design decisions:
 *  - Per-track evidence sessions (Map) prevent concurrent infractions from
 *    overwriting each other's captured frames.
 *  - AuditJob snapshots are immutable: later track mutations cannot corrupt
 *    an in-flight Gemini audit.
 *  - setStats is batched per frame to avoid unnecessary React commits.
 *  - Recorder lifecycle is tied to active session count; try/finally in every
 *    evidence path guarantees cleanup even on error.
 */
export const useFrameProcessor = () => {
  const {
    geometry,
    engineConfig,
    setStats,
    isPoseEnabled,
    detect,
    detectPose,
    setTracks,
    isAuditEnabled,
    updateBufferStatus,
    currentAuditPreset,
    directives,
  } = useSentinel();

  const trackerRef = useRef<ByteTracker>(new ByteTracker());
  const seenTrackIds = useRef<Set<number>>(new Set<number>());
  const frameCountRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Per-track evidence sessions — replaces the old global suspectRef
  const evidenceSessionsRef = useRef<Map<number, EvidenceSession>>(new Map());
  // Single shared canvas recorder — starts when any session is active
  const recorderRef = useRef<VideoBufferService | null>(null);

  // ─── Snapshot capture ───────────────────────────────────────────────────────

  const captureSnapshot = useCallback(
    (
      video: HTMLVideoElement,
      track: Track,
      type: 'initial' | 'mid' | 'final' = 'final'
    ): boolean => {
      if (!video || video.readyState < 2) return false;

      if (!snapshotCanvasRef.current) {
        snapshotCanvasRef.current = document.createElement('canvas');
      }
      const sC = snapshotCanvasRef.current;
      const ctxS = sC.getContext('2d');
      if (!ctxS) return false;

      try {
        sC.width = 1280;
        sC.height = 720;
        ctxS.drawImage(video, 0, 0, 1280, 720);
        const contextFrame = sC.toDataURL('image/jpeg', 0.6).split(',')[1];
        track.snapshots.push(contextFrame);
        track.contextSnapshots = [...(track.contextSnapshots || []), contextFrame].slice(-3);

        // Tactical zoom
        const zoomPad = 0.5;
        const videoW = video.videoWidth;
        const videoH = video.videoHeight;
        const zX = Math.max(0, track.bbox.x - (track.bbox.w * zoomPad) / 2) * videoW;
        const zY = Math.max(0, track.bbox.y - (track.bbox.h * zoomPad) / 2) * videoH;
        const zW = Math.min(1, track.bbox.w * (1 + zoomPad)) * videoW;
        const zH = Math.min(1, track.bbox.h * (1 + zoomPad)) * videoH;

        ctxS.clearRect(0, 0, 1280, 720);
        ctxS.drawImage(video, zX, zY, zW, zH, 0, 0, 1280, 720);
        const zoomFrame = sC.toDataURL('image/jpeg', 0.7).split(',')[1];
        track.snapshots.push(zoomFrame);
        track.zoomSnapshots = [...(track.zoomSnapshots || []), zoomFrame].slice(-3);

        if (type === 'initial') track.hasInitialFrame = true;
        if (type === 'mid') track.hasMidFrame = true;

        return true;
      } catch {
        return false;
      }
    },
    []
  );

  // ─── Session lifecycle helpers ──────────────────────────────────────────────

  const clearTrackEvidence = useCallback((track: Track) => {
    track.snapshots = [];
    track.contextSnapshots = [];
    track.zoomSnapshots = [];
    track.hasInitialFrame = false;
    track.hasMidFrame = false;
  }, []);

  const stopRecorderIfIdle = useCallback(() => {
    if (evidenceSessionsRef.current.size === 0 && recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
      updateBufferStatus({ state: 'idle', activeTracks: 0 });
    }
  }, [updateBufferStatus]);

  const abortTrackEvidence = useCallback(
    (track: Track, line: GeometryLine, reason: string) => {
      clearTrackEvidence(track);
      resetTrackAuditState(track, line);
      evidenceSessionsRef.current.delete(track.id);
      updateBufferStatus({ activeTracks: evidenceSessionsRef.current.size });
      stopRecorderIfIdle();
    },
    [clearTrackEvidence, stopRecorderIfIdle, updateBufferStatus]
  );

  const activateSuspect = useCallback(
    (video: HTMLVideoElement, track: Track, line: GeometryLine) => {
      // Skip if this track+line combo is already being monitored
      const existing = evidenceSessionsRef.current.get(track.id);
      if (existing && existing.lineId === line.id) return;

      const isStartROI =
        line.label.toUpperCase().includes('A') ||
        line.label.toUpperCase().includes('DETEC') ||
        line.label.toUpperCase().includes('START') ||
        line.label.toUpperCase().includes('INICIO');

      if (!isStartROI) return;

      track.firstHitFrame = frameCountRef.current;
      track.roiAId = line.id;

      clearTrackEvidence(track);
      evidenceSessionsRef.current.set(track.id, {
        lineId: line.id,
        startedAt: Date.now(),
      });

      updateBufferStatus({ state: 'recording', activeTracks: evidenceSessionsRef.current.size });
      captureSnapshot(video, track, 'initial');
    },
    [captureSnapshot, clearTrackEvidence, updateBufferStatus]
  );

  const captureMidIfNeeded = useCallback(
    (video: HTMLVideoElement, track: Track) => {
      if (!track.hasInitialFrame || track.hasMidFrame) return;

      const elapsedFrames = frameCountRef.current - (track.firstHitFrame || 0);
      const turnLines = geometry.filter((g) => g.type === 'roi_turn');
      const otherROI = turnLines.find((l) => l.id !== track.roiAId);

      let isMidpoint = false;
      if (otherROI && track.tail.length > 0) {
        const roiALine = geometry.find((g) => g.id === track.roiAId);
        if (roiALine) {
          const midX = (roiALine.x1 + otherROI.x1) / 2;
          const midY = (roiALine.y1 + otherROI.y1) / 2;
          const currentPos = track.tail[track.tail.length - 1];
          if (Math.hypot(currentPos.x - midX, currentPos.y - midY) < 0.1) isMidpoint = true;
        }
      }

      if (isMidpoint || elapsedFrames > 30) {
        captureSnapshot(video, track, 'mid');
      }
    },
    [captureSnapshot, geometry]
  );

  // ─── Evidence finalisation ──────────────────────────────────────────────────

  const finalizeTrackEvidence = useCallback(
    async (video: HTMLVideoElement, track: Track, line: GeometryLine, evidenceId: string) => {
      try {
        captureMidIfNeeded(video, track);
        updateBufferStatus({ state: 'capturing' });

        const finalCaptured = captureSnapshot(video, track, 'final');
        if (!finalCaptured) {
          abortTrackEvidence(track, line, 'No se pudo capturar el frame final.');
          return;
        }

        // Take immutable copies before async gaps
        const snapshots = [...track.snapshots];
        const contextSnapshots = [...(track.contextSnapshots || [])];
        const zoomSnapshots = [...(track.zoomSnapshots || [])];
        const tailSnapshot = track.tail.map((p) => ({ ...p }));
        const bboxSnapshot = { ...track.bbox };
        const roiHistorySnapshot = [...track.roiHistory];

        let clip: string | undefined;
        try {
          clip = recorderRef.current ? await recorderRef.current.getClip() : undefined;
        } catch {
          clip = undefined;
        }

        const localTime = new Date().toLocaleString();
        const videoTimeCode = await OCRSynchronizer.extractTimecode(video);

        // OCR per zoom stage
        const ocrResults: string[] = [];
        for (const zoom of zoomSnapshots) {
          const res = await OCRSynchronizer.extractLicensePlate([zoom]);
          ocrResults.push(res.plate || 'NO_OCR');
        }

        await evidenceDB.saveEvidence(evidenceId, {
          snapshots,
          contextSnapshots,
          zoomSnapshots,
          ocrResults,
          clip,
        });

        // Build immutable AuditJob — ForensicQueue processes only this snapshot
        const job: AuditJob = {
          trackId: track.id,
          trackLabel: track.label,
          tail: tailSnapshot,
          bbox: bboxSnapshot,
          roiHistory: roiHistorySnapshot,
          velocity: track.velocity,
          avgVelocity: track.avgVelocity,
          heading: track.heading,
          line,
          evidenceId,
          localTime,
          videoTimeCode,
          playbackTime: video.currentTime,
          capturedAt: Date.now(),
          auditPreset: currentAuditPreset,
          directives,
        };

        forensicQueue.enqueue(job);
      } catch (error) {
        abortTrackEvidence(
          track,
          line,
          error instanceof Error ? error.message : 'Error desconocido guardando evidencia.'
        );
        return;
      } finally {
        // Always clean up this track's session and shared resources
        clearTrackEvidence(track);
        evidenceSessionsRef.current.delete(track.id);
        updateBufferStatus({ activeTracks: evidenceSessionsRef.current.size });
        stopRecorderIfIdle();
      }
    },
    [
      abortTrackEvidence,
      captureMidIfNeeded,
      captureSnapshot,
      clearTrackEvidence,
      currentAuditPreset,
      directives,
      stopRecorderIfIdle,
      updateBufferStatus,
    ]
  );

  // ─── Zone / infraction logic ───────────────────────────────────────────────

  const processTrackResults = useCallback(
    (activeTracks: Track[], v: HTMLVideoElement, canvas: HTMLCanvasElement): void => {
      if (!v || !canvas || v.videoWidth === 0) return;

      const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
      const dW = v.videoWidth * scale;
      const dH = v.videoHeight * scale;
      const oX = (canvas.width - dW) / 2;
      const oY = (canvas.height - dH) / 2;

      // Accumulate stat deltas for a single React commit at the end of the frame
      let newDetections = 0;

      activeTracks.forEach((t: Track) => {
        const minHits = t.label === 'person' ? 4 : 2;
        if (t.hits >= minHits && !seenTrackIds.current.has(t.id)) {
          seenTrackIds.current.add(t.id);
          newDetections++;
        }

        const cx = t.bbox.x * dW + (t.bbox.w * dW) / 2 + oX;
        const cy = t.bbox.y * dH + (t.bbox.h * dH) / 2 + oY;
        const normX = (cx - oX) / dW;
        const normY = (cy - oY) / dH;

        // Tail update — bounded array, avoid O(n) shift
        const lastT = t.tail[t.tail.length - 1];
        if (!lastT || Math.hypot(lastT.x - normX, lastT.y - normY) > 0.001) {
          t.tail.push({ x: normX, y: normY });
          if (t.tail.length > 50) t.tail = t.tail.slice(-50);
        }

        if (t.audited) return;

        geometry.forEach((line: GeometryLine) => {
          if (t.processedLines.includes(line.id)) return;
          if (!t.tail || t.tail.length < 2) return;

          const p1 = t.tail[t.tail.length - 2];
          const p1x = p1.x * dW + oX;
          const p1y = p1.y * dH + oY;
          const lx1 = line.x1 * dW + oX;
          const ly1 = line.y1 * dH + oY;
          const lx2 = line.x2 * dW + oX;
          const ly2 = line.y2 * dH + oY;

          // 1. Vectorial line (stop, forbidden, lane divider)
          if (lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {
            let isInfraction = true;
            let infractionLabel = line.label || 'INFRACCIÓN';

            if (line.type === 'stop_line') {
              if (t.dwellTime > 3000) {
                isInfraction = false;
              } else {
                infractionLabel = 'VIOLACIÓN_STOP';
              }
            }

            if (isInfraction && isAuditEnabled) {
              activateSuspect(v, t, line);
              t.processedLines.push(line.id);
              t.crossedLine = true;
              t.audited = true;
              t.auditStatus = 'processing';
              const evidenceId = `ev_${t.id}_${Date.now()}`;
              captureMidIfNeeded(v, t);

              (async () => {
                await finalizeTrackEvidence(v, t, { ...line, label: infractionLabel }, evidenceId);
              })();
            } else {
              t.processedLines.push(line.id);
            }
          }

          // Mid capture for active sessions
          const session = evidenceSessionsRef.current.get(t.id);
          if (session && session.lineId === line.id && !t.audited) {
            captureMidIfNeeded(v, t);
          }

          // 2. Area logic (box junction / polygons)
          if (line.type === 'box_junction' && line.points) {
            const inZone = isPointInPoly({ x: normX, y: normY }, line.points);
            if (inZone) {
              if (!t.processedLines.includes(`${line.id}_candidate`)) {
                activateSuspect(v, t, line);
                t.processedLines.push(`${line.id}_candidate`);
              }
              t.lastZoneId = line.id;
              captureMidIfNeeded(v, t);

              if (t.dwellTime > 5000 && !t.processedLines.includes(`${line.id}_box`) && isAuditEnabled) {
                t.processedLines.push(`${line.id}_box`);
                t.audited = true;
                t.auditStatus = 'processing';
                const evidenceId = `ev_${t.id}_box_${Date.now()}`;
                (async () => {
                  await finalizeTrackEvidence(v, t, { ...line, label: 'BLOQUEO_INTERSECCIÓN' }, evidenceId);
                })();
              }
            } else if (t.lastZoneId === line.id) {
              t.lastZoneId = undefined;
            }
          }

          // 3. ROI logic (auto-audit & sequential turns)
          if ((line.type === 'roi_general' || line.type === 'roi_turn') && line.points) {
            const inROI = isPointInPoly({ x: normX, y: normY }, line.points);
            if (!t.roiHistory) t.roiHistory = [];

            if (inROI && !t.processedLines.includes(line.id)) {
              t.processedLines.push(line.id);
              t.roiHistory.push(line.id);
              activateSuspect(v, t, line);
              captureMidIfNeeded(v, t);

              if (line.type === 'roi_general' && isAuditEnabled) {
                t.audited = true;
                t.auditStatus = 'processing';
                const evidenceId = `ev_${t.id}_roi_${Date.now()}`;
                (async () => {
                  await finalizeTrackEvidence(v, t, { ...line, label: `ZONA_ANÁLISIS_${line.label}` }, evidenceId);
                })();
              }

              if (line.type === 'roi_turn' && isAuditEnabled) {
                const { turnIds, turnLabels } = getOrderedTurnSequence(t, geometry);
                if (turnIds.length >= 2) {
                  t.audited = true;
                  t.auditStatus = 'processing';
                  const evidenceId = `ev_${t.id}_turn_${Date.now()}`;
                  (async () => {
                    await finalizeTrackEvidence(
                      v,
                      t,
                      {
                        ...line,
                        label: `GIRO_PROHIBIDO_${turnLabels.join('_A_')}`,
                        violationKind: 'forbidden_turn_sequence',
                        roiSequenceIds: turnIds,
                        roiSequenceLabels: turnLabels,
                        analysisContext: `Secuencia prohibida: ${turnLabels.join(' -> ')}.`,
                      },
                      evidenceId
                    );
                  })();
                }
              }
            } else if (evidenceSessionsRef.current.has(t.id) && !t.audited) {
              captureMidIfNeeded(v, t);
            }
          }
        });
      });

      // Single batched stat update for this entire frame
      if (newDetections > 0) {
        setStats((prev) => ({ ...prev, det: prev.det + newDetections }));
      }
    },
    [
      geometry,
      setStats,
      activateSuspect,
      captureMidIfNeeded,
      finalizeTrackEvidence,
      isAuditEnabled,
    ]
  );

  // ─── Primary frame entry point ─────────────────────────────────────────────

  const processFrame = useCallback(
    async (v: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> => {
      if (!v || v.paused || v.ended || isProcessingRef.current) return;

      isProcessingRef.current = true;
      try {
        // Auto-start shared recorder when any session is active
        if (!recorderRef.current && canvas && evidenceSessionsRef.current.size > 0) {
          recorderRef.current = new VideoBufferService(canvas);
          recorderRef.current.start();
        }

        frameCountRef.current++;
        trackerRef.current.step();

        if (frameCountRef.current % (engineConfig.detectionSkip || 1) === 0) {
          const results: StandardDetection[] = await detect(v);
          const activeTracks = trackerRef.current.update(
            results,
            engineConfig.persistence,
            engineConfig.confidenceThreshold
          );
          processTrackResults(activeTracks, v, canvas);
        } else {
          processTrackResults(trackerRef.current.tracks, v, canvas);
        }

        if (isPoseEnabled) await detectPose(v);

        // Throttled global state sync (every 5 frames)
        if (frameCountRef.current % 5 === 0) {
          setTracks([...trackerRef.current.tracks]);
          if (recorderRef.current) {
            updateBufferStatus({ seconds: recorderRef.current.getBufferSeconds() });
          }
        }
      } finally {
        isProcessingRef.current = false;
      }
    },
    [
      detect,
      detectPose,
      engineConfig,
      isPoseEnabled,
      processTrackResults,
      setTracks,
      updateBufferStatus,
    ]
  );

  // ─── Reset ──────────────────────────────────────────────────────────────────

  const resetTracker = useCallback((): void => {
    trackerRef.current.reset();
    seenTrackIds.current.clear();
    evidenceSessionsRef.current.clear();
    setTracks([]);
    frameCountRef.current = 0;
    updateBufferStatus({ state: 'idle', activeTracks: 0, seconds: 0 });
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
  }, [setTracks, updateBufferStatus]);

  return { processFrame, trackerRef, seenTrackIds, resetTracker };
};
