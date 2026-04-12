import { useRef, useCallback } from 'react';
import { useSentinel } from './useSentinel';
import { ByteTracker } from '../services/ByteTracker';
import { lineIntersect, isPointInPoly } from '../utils';
import { VideoBufferService } from '../services/videoRecorder';
import { Track, GeometryLine, StandardDetection } from '../types';
import { evidenceDB } from '../services/EvidenceDB';
import { forensicQueue } from '../services/ForensicQueue';
import { OCRSynchronizer } from '../services/OCRSynchronizer';

/**
 * Sentinel AI Frame Processor Hook.
 * Orchestrates detection, tracking, zone analysis, and forensic audit triggering.
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
  } = useSentinel();

  const trackerRef = useRef<ByteTracker>(new ByteTracker());
  const seenTrackIds = useRef<Set<number>>(new Set<number>());
  const frameCountRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<VideoBufferService | null>(null);
  const suspectRef = useRef<{ trackId: number; lineId: string; startedAt: number } | null>(null);

  /**
   * Captures a tactical snapshot (context + zoom) for forensic analysis.
   */
  const captureSnapshot = useCallback(
    (
      video: HTMLVideoElement,
      track: Track,
      type: 'initial' | 'mid' | 'final' = 'final'
    ): boolean => {
      if (!video || video.readyState < 2) {
        console.warn('Video no está listo para captura');
        return false;
      }

      if (!snapshotCanvasRef.current) {
        snapshotCanvasRef.current = document.createElement('canvas');
      }
      const sC = snapshotCanvasRef.current;
      const ctxS = sC.getContext('2d');
      if (!ctxS) return false;

      try {
        console.log(`[FORENSIC] Capturando snapshot ${type.toUpperCase()} para ID:${track.id}`);

        // 1. CAPTURE FULL SCENE (Context)
        sC.width = 1280;
        sC.height = 720;
        ctxS.drawImage(video, 0, 0, 1280, 720);
        const contextFrame = sC.toDataURL('image/jpeg', 0.6).split(',')[1];
        track.snapshots.push(contextFrame);
        track.contextSnapshots = [...(track.contextSnapshots || []), contextFrame].slice(-3);

        // 2. CAPTURE TACTICAL ZOOM (Vehicle/License Plate Detail)
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
      } catch (error) {
        console.error(`Error capturando snapshot ${type}:`, error);
        return false;
      }
    },
    []
  );

  const clearTrackEvidence = useCallback((track: Track) => {
    track.snapshots = [];
    track.contextSnapshots = [];
    track.zoomSnapshots = [];
    track.hasInitialFrame = false;
    track.hasMidFrame = false;
  }, []);

  const activateSuspect = useCallback(
    (video: HTMLVideoElement, track: Track, line: GeometryLine) => {
      if (
        suspectRef.current &&
        suspectRef.current.trackId === track.id &&
        suspectRef.current.lineId === line.id
      ) {
        return;
      }

      // Record frame count for mid-point calculation
      track.firstHitFrame = frameCountRef.current;
      track.roiAId = line.id;

      const previousTrack = trackerRef.current.tracks.find(
        (candidate) => candidate.id === suspectRef.current?.trackId
      );
      if (previousTrack && !previousTrack.audited) {
        clearTrackEvidence(previousTrack);
      }

      clearTrackEvidence(track);
      suspectRef.current = {
        trackId: track.id,
        lineId: line.id,
        startedAt: Date.now(),
      };
      updateBufferStatus({ state: 'recording', activeTracks: 1 });
      captureSnapshot(video, track, 'initial');
    },
    [captureSnapshot, clearTrackEvidence, updateBufferStatus]
  );

  const captureMidIfNeeded = useCallback(
    (video: HTMLVideoElement, track: Track) => {
      if (!track.hasInitialFrame || track.hasMidFrame) return;

      // DELAYED / MID-POINT LOGIC
      // If we hit ROI A, we wait for either a distance midpoint or a time fallback
      const elapsedFrames = frameCountRef.current - (track.firstHitFrame || 0);

      // If turn logic: try to find the likely destination ROI B
      const turnLines = geometry.filter((g) => g.type === 'roi_turn');
      const otherROI = turnLines.find((l) => l.id !== track.roiAId);

      let isMidpoint = false;
      if (otherROI && track.tail.length > 0) {
        // Spatial midpoint heuristic between ROI A and ROI B
        const roiALine = geometry.find((g) => g.id === track.roiAId);
        if (roiALine) {
          const midX = (roiALine.x1 + otherROI.x1) / 2;
          const midY = (roiALine.y1 + otherROI.y1) / 2;
          const currentPos = track.tail[track.tail.length - 1];
          const distToMid = Math.hypot(currentPos.x - midX, currentPos.y - midY);
          if (distToMid < 0.1) isMidpoint = true;
        }
      }

      // Fallback: capture after ~1 second (30 frames) if no midpoint detected spatially
      if (isMidpoint || elapsedFrames > 30) {
        captureSnapshot(video, track, 'mid');
      }
    },
    [captureSnapshot, geometry]
  );

  const finalizeTrackEvidence = useCallback(
    async (video: HTMLVideoElement, track: Track, line: GeometryLine, evidenceId: string) => {
      captureMidIfNeeded(video, track);
      updateBufferStatus({ state: 'capturing' });
      const finalCaptured = captureSnapshot(video, track, 'final');
      if (!finalCaptured) return;

      const snapshots = [...track.snapshots];
      const contextSnapshots = [...(track.contextSnapshots || [])];
      const zoomSnapshots = [...(track.zoomSnapshots || [])];
      const clip = recorderRef.current ? await recorderRef.current.getClip() : undefined;
      const localTime = new Date().toLocaleString();
      const videoTimeCode = await OCRSynchronizer.extractTimecode(video);

      // INDIVIDUAL OCR PROCESSING FOR EACH STAGE
      const ocrResults = [];
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

      updateBufferStatus({ state: 'idle', activeTracks: 0 });
      clearTrackEvidence(track);
      suspectRef.current = null;

      forensicQueue.enqueue(track, line, evidenceId, localTime, videoTimeCode, video.currentTime);
    },
    [captureMidIfNeeded, captureSnapshot, clearTrackEvidence, updateBufferStatus]
  );

  /**
   * Orchestrates zone-based logic and infraction detection for active tracks.
   */
  const processTrackResults = useCallback(
    (activeTracks: Track[], v: HTMLVideoElement, canvas: HTMLCanvasElement): void => {
      if (!v || !canvas || v.videoWidth === 0) return;

      const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
      const dW = v.videoWidth * scale;
      const dH = v.videoHeight * scale;
      const oX = (canvas.width - dW) / 2;
      const oY = (canvas.height - dH) / 2;

      activeTracks.forEach((t: Track) => {
        // Stats counting (Detections)
        // Reduced minHits to 2 for faster confirmation
        const minHits = t.label === 'person' ? 4 : 2;
        if (t.hits >= minHits && !seenTrackIds.current.has(t.id)) {
          seenTrackIds.current.add(t.id);
          setStats((prev) => ({ ...prev, det: prev.det + 1 }));
        }

        // Using Vehicle Centroid for consistent zone interaction
        const cx = t.bbox.x * dW + (t.bbox.w * dW) / 2 + oX;
        const cy = t.bbox.y * dH + (t.bbox.h * dH) / 2 + oY;

        // Tail Enrichment for rendering synchronization
        const normX = (cx - oX) / dW;
        const normY = (cy - oY) / dH;

        const lastT = t.tail[t.tail.length - 1];
        if (!lastT || Math.hypot(lastT.x - normX, lastT.y - normY) > 0.001) {
          t.tail.push({ x: normX, y: normY });
          if (t.tail.length > 50) t.tail.shift();
        }

        if (t.audited) return;

        geometry.forEach((line: GeometryLine) => {
          if (!t.processedLines.includes(line.id)) {
            if (t.tail && t.tail.length >= 2) {
              const p1 = t.tail[t.tail.length - 2];
              const p1x = p1.x * dW + oX;
              const p1y = p1.y * dH + oY;
              const lx1 = line.x1 * dW + oX;
              const ly1 = line.y1 * dH + oY;
              const lx2 = line.x2 * dW + oX;
              const ly2 = line.y2 * dH + oY;

              // 1. VECTORIAL LINE LOGIC (STOP, FORBIDDEN, LANE)
              if (lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {
                console.log(`[FORENSIC] ID:${t.id} (${t.label}) - Interacción en ${line.label}`);

                let isInfraction = true;
                let infractionLabel = line.label || 'INFRACCIÓN';

                // STOP HEURISTIC (Requires dwellTime > 3000ms)
                if (line.type === 'stop_line') {
                  if (t.dwellTime > 3000) {
                    isInfraction = false;
                    console.log(`[AUDIT] ID:${t.id} - Stop Validado (${t.dwellTime}ms)`);
                  } else {
                    infractionLabel = 'VIOLACIÓN_STOP';
                    console.log(`[AUDIT] ID:${t.id} - Violación STOP.`);
                  }
                }

                if (isInfraction) {
                  if (isAuditEnabled) {
                    activateSuspect(v, t, line);
                    console.log(
                      `[FORENSIC] ID:${t.id} - Infracción detectada en ${infractionLabel}. Iniciando captura...`
                    );
                    t.processedLines.push(line.id);
                    t.crossedLine = true;
                    t.audited = true;
                    t.auditStatus = 'processing';

                    const evidenceId = `ev_${t.id}_${Date.now()}`;

                    if (!t.hasMidFrame) {
                      captureMidIfNeeded(v, t);
                    }

                    (async () => {
                      await finalizeTrackEvidence(
                        v,
                        t,
                        { ...line, label: infractionLabel },
                        evidenceId
                      );
                    })();
                  } else {
                    t.processedLines.push(line.id);
                  }
                } else {
                  t.processedLines.push(line.id);
                }
              }

              if (
                suspectRef.current?.trackId === t.id &&
                suspectRef.current.lineId === line.id &&
                !t.audited
              ) {
                captureMidIfNeeded(v, t);
              }

              // 2. AREA LOGIC (BOX JUNCTION / POLYGONS)
              if (line.type === 'box_junction' && line.points) {
                const inZone = isPointInPoly({ x: normX, y: normY }, line.points);
                if (inZone) {
                  if (!t.processedLines.includes(`${line.id}_candidate`)) {
                    activateSuspect(v, t, line);
                    t.processedLines.push(`${line.id}_candidate`);
                  }

                  t.lastZoneId = line.id;
                  captureMidIfNeeded(v, t);

                  // Intersection Block Heuristic (Dwell > 5s)
                  if (
                    t.dwellTime > 5000 &&
                    !t.processedLines.includes(line.id + '_box') &&
                    isAuditEnabled
                  ) {
                    console.log(`[FORENSIC] ID:${t.id} - BLOQUEO DETECTADO.`);
                    t.processedLines.push(line.id + '_box');
                    t.audited = true;
                    t.auditStatus = 'processing';

                    const evidenceId = `ev_${t.id}_box_${Date.now()}`;
                    (async () => {
                      await finalizeTrackEvidence(
                        v,
                        t,
                        { ...line, label: 'BLOQUEO_INTERSECCIÓN' },
                        evidenceId
                      );
                    })();
                  }
                } else if (t.lastZoneId === line.id) {
                  t.lastZoneId = undefined;
                }
              }

              // 3. ROI LOGIC (AUTO-AUDIT & SEQUENTIAL TURNS)
              if ((line.type === 'roi_general' || line.type === 'roi_turn') && line.points) {
                const inROI = isPointInPoly({ x: normX, y: normY }, line.points);

                // Initialize history if missing
                if (!t.roiHistory) t.roiHistory = [];

                if (inROI && !t.processedLines.includes(line.id)) {
                  t.processedLines.push(line.id);
                  t.roiHistory.push(line.id);
                  activateSuspect(v, t, line);
                  captureMidIfNeeded(v, t);

                  // Case A: General ROI - Immediate Audit
                  if (line.type === 'roi_general' && isAuditEnabled) {
                    console.log(
                      `[FORENSIC] ID:${t.id} - VEHÍCULO EN ROI GENERAL (${line.label}). Iniciando auditoría...`
                    );
                    t.audited = true;
                    t.auditStatus = 'processing';
                    const evidenceId = `ev_${t.id}_roi_${Date.now()}`;
                    (async () => {
                      await finalizeTrackEvidence(
                        v,
                        t,
                        { ...line, label: `ZONA_ANÁLISIS_${line.label}` },
                        evidenceId
                      );
                    })();
                  }

                  // Case B: Forbidden Turn ROI - Sequential Logic
                  if (line.type === 'roi_turn' && isAuditEnabled) {
                    const turnROIs = t.roiHistory.filter((id) => {
                      const l = geometry.find((gl) => gl.id === id);
                      return l?.type === 'roi_turn';
                    });

                    if (turnROIs.length >= 2) {
                      console.log(
                        `[FORENSIC] ID:${t.id} - GIRO PROHIBIDO DETECTADO (${turnROIs.length} zonas). Iniciando auditoría...`
                      );
                      t.audited = true;
                      t.auditStatus = 'processing';
                      const evidenceId = `ev_${t.id}_turn_${Date.now()}`;
                      (async () => {
                        await finalizeTrackEvidence(
                          v,
                          t,
                          { ...line, label: 'GIRO_PROHIBIDO_MULTI_ZONA' },
                          evidenceId
                        );
                      })();
                    } else {
                      console.log(
                        `[FORENSIC] ID:${t.id} - Entrada en Zona de Giro ${line.label}. Esperando secuencia...`
                      );
                    }
                  }
                }
              } else if (
                suspectRef.current?.trackId === t.id &&
                suspectRef.current.lineId === line.id &&
                !t.audited
              ) {
                captureMidIfNeeded(v, t);
              }
            }
          }
        });
      });
    },
    [geometry, setStats, activateSuspect, captureMidIfNeeded, finalizeTrackEvidence, isAuditEnabled]
  );

  /**
   * Primary frame processing entry point.
   */
  const processFrame = useCallback(
    async (v: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> => {
      if (!v || v.paused || v.ended || isProcessingRef.current) return;

      isProcessingRef.current = true;
      try {
        // Auto-initialize recorder
        if (!recorderRef.current && canvas) {
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

        if (isPoseEnabled) {
          await detectPose(v);
        }

        // Sync with Global Context (Throttled update)
        if (frameCountRef.current % 5 === 0) {
          setTracks([...trackerRef.current.tracks]);
          if (recorderRef.current) {
            updateBufferStatus({ seconds: recorderRef.current.getBufferSeconds() });
          }
        }
      } catch (e) {
        console.error('ProcessFrame Error:', e);
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

  /**
   * Resets the entire tracking system.
   */
  const resetTracker = useCallback((): void => {
    trackerRef.current.reset();
    seenTrackIds.current.clear();
    suspectRef.current = null;
    setTracks([]);
    frameCountRef.current = 0;
    updateBufferStatus({ state: 'idle', activeTracks: 0, seconds: 0 });
  }, [setTracks, updateBufferStatus]);

  return { processFrame, trackerRef, seenTrackIds, resetTracker };
};
