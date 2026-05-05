/**
 * Sentinel AI Frame Processor Hook v2.
 * Uses EvidenceCaptureManager for multi-track support and ForensicQueueV3 for immutable jobs.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSentinel } from './useSentinel';
import { ByteTracker } from '../services/ByteTracker';
import { FrameContinuityValidator, getFrameContinuityValidator } from '../services/FrameContinuityValidator';
import { getGlobalTrackRegistry } from '../services/GlobalTrackRegistry';
import { lineIntersect, isPointInPoly } from '../utils';
import { Track, GeometryLine } from '../types';
import { EvidenceCaptureManager } from '../services/EvidenceCaptureManager';
import { ForensicRule, FORENSIC_RULES } from '../types/forensicRules';
import { publishRealtimeEvent } from '../services/realtimeEvents';
import { logger } from '../services/logger';

const MAX_TAIL_POINTS = 50;
const MIN_FINALIZE_DELAY_MS = 8000;
const MAX_FINALIZE_DELAY_MS = 12000;

const getFinalizeDelayMs = (track: Track) => {
  const speed = Number(track?.avgVelocity || 0);
  if (!Number.isFinite(speed) || speed <= 0.0001) return MAX_FINALIZE_DELAY_MS;
  // Higher speed -> earlier finalization window.
  const normalized = Math.max(0, Math.min(1, speed / 0.03));
  return Math.round(
    MAX_FINALIZE_DELAY_MS - normalized * (MAX_FINALIZE_DELAY_MS - MIN_FINALIZE_DELAY_MS)
  );
};

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
    viewerId,
    addLog,
    addInfraction,
  } = useSentinel();

  const trackerRef = useRef<ByteTracker>(new ByteTracker());
  const continuityValidatorRef = useRef<FrameContinuityValidator>(getFrameContinuityValidator());
  const seenTrackIds = useRef<Set<number>>(new Set<number>());
  const frameCountRef = useRef<number>(0);
  const isProcessingRef = useRef<boolean>(false);
  const evidenceManagerRef = useRef<EvidenceCaptureManager | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const tileCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const finalizeTimersRef = useRef<Map<number, number>>(new Map());

  // Initialize ByteTracker with global registry and continuity validator
  useEffect(() => {
    if (!viewerId) return;

    const tracker = trackerRef.current;
    const globalRegistry = getGlobalTrackRegistry();

    // Initialize tracker with viewer context (source: live, upload, or ip-camera)
    // Infer source from context - default to 'upload' (file-based)
    const source: 'live' | 'upload' | 'ip-camera' = 'upload'; // Can be parameterized if needed
    tracker.initialize(viewerId, source);

    logger.debug(
      'FRAME_PROCESSOR',
      `ByteTracker initialized (viewerId: ${viewerId}, source: ${source})`
    );
    logger.debug('FRAME_PROCESSOR', `GlobalRegistry sessionId: ${globalRegistry.getSessionId()}`);
  }, [viewerId]);

  // Initialize EvidenceCaptureManager
  useEffect(() => {
    const timers = finalizeTimersRef.current;
    const canvases = tileCanvasesRef.current;
    evidenceManagerRef.current = new EvidenceCaptureManager({
      maxSimultaneous: 2,
      priorityMode: 'first',
      autoAbortOnExit: true,
    });

    evidenceManagerRef.current.setBufferCallback((targetId, seconds) => {
      updateBufferStatus({ seconds });
    });
    evidenceManagerRef.current.setProgressCallback((targetId, progress) => {
      updateBufferStatus({
        capturedPhotos: progress.capturedPhotos,
        plateCandidate: progress.plateCandidate,
      });
    });

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
      canvases.clear();
      evidenceManagerRef.current?.abortAll('Component unmount');
    };
  }, [updateBufferStatus]);

  /**
   * Finds matching forensic rules for a geometry.
   */
  const findRulesForGeometry = useCallback((geom: GeometryLine): ForensicRule | undefined => {
    // Find rules that match this geometry ID
    const rules = FORENSIC_RULES.filter(
      (r) => r.enabled && r.geometryIds && r.geometryIds.includes(geom.id)
    );
    if (rules.length > 0) {
      return rules.sort((a, b) => b.priority - a.priority)[0];
    }
    // Fallback: no matching rule found
    return undefined;
  }, []);

  /**
   * Checks if a track should trigger evidence capture.
   */
  const shouldTriggerCapture = useCallback(
    (track: Track, line: GeometryLine): boolean => {
      if (!isAuditEnabled) return false;
      if (track.audited) return false;
      if (!evidenceManagerRef.current?.shouldCapture(track.id, line.id)) return false;

      // ROI and polygon types are detected via polygon containment, never via line intersection
      if (line.type === 'roi_turn' || line.type === 'roi_general' || line.type === 'box_junction') {
        return false;
      }

      return true;
    },
    [isAuditEnabled]
  );

  /**
   * Triggers evidence capture for a track/geometry combination.
   */
  const triggerCapture = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement, track: Track, line: GeometryLine) => {
      const manager = evidenceManagerRef.current;
      if (!manager) return;

      const rule = findRulesForGeometry(line);

      // ============================================================================
      // ALWAYS create and add infraction to module, regardless of capture capacity
      // ============================================================================
      const infractionId = Date.now();
      const timeCode = new Date().toLocaleTimeString();
      const now = new Date();
      const localTimeStr = now.toLocaleString('es-ES');

      // Capture first frame as evidence
      const canvas2d = document.createElement('canvas');
      canvas2d.width = video.videoWidth;
      canvas2d.height = video.videoHeight;
      const ctx = canvas2d.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
      }
      const snapshotImage = canvas2d.toDataURL('image/jpeg');

      const initialInfraction = {
        // AuditResponse fields (required)
        infraction: true,
        plate: track.plate || 'UNKNOWN',
        makeModel: 'Detectado',
        color: 'Detectado',
        description: `${line.label || 'VIOLACIÓN'} detectada para vehículo ${track.plate || 'desconocido'}`,
        severity: 'ALTA' as any,
        ruleCategory: line.label || 'VIOLACIÓN',
        legalBase: 'Código de Tráfico',
        reasoning: [`Detección de ${line.label || 'violación'} en zona vigilada`],
        visualTimestamp: timeCode,
        videoTimeCode: timeCode,
        localTime: localTimeStr,
        telemetry: {
          speedEstimated: 'N/A',
        },
        // InfractionLog-specific fields
        id: infractionId,
        image: snapshotImage,
        time: timeCode,
        validationStatus: 'pending' as const,
        priority: (rule?.priority || 'ALTA') as any,
        fineAmount: rule?.fineAmount || 300,
        pointsDeducted: rule?.pointsDeducted || 3,
      };

      // NOTE: Infraction is NOT created here (ROI A detection)
      // It will be created and analyzed only AFTER ROI B validation by ForensicQueue
      // (See ForensicQueueV3.ts line 637: listeners.forEach(listener => listener(infractionLog)))
      console.log('[TRIGGER_CAPTURE] Buffer activated, waiting for ROI B validation:', {
        id: initialInfraction.id,
        plate: initialInfraction.plate,
        label: line.label,
        timestamp: timeCode,
      });

      addLog(
        'AI',
        `🚨 INFRACCIÓN DETECTADA: ${line.label || 'VIOLACIÓN'} - Vehículo ID: ${track.id} (${track.plate || 'SIN_PLACA'})`
      );

      // ============================================================================
      // TRY to capture evidence if manager has capacity
      // ============================================================================
      const captureKey = manager.startCapture(
        track,
        line,
        rule,
        video,
        canvas,
        frameCountRef.current
      );

      if (captureKey) {
        track.audited = true;
        track.auditStatus = 'processing';
        updateBufferStatus({ state: 'recording', activeTracks: manager.getActiveCount() });

        console.log('[TRIGGER_CAPTURE] Capture started with key:', captureKey);
      } else {
        console.warn('[TRIGGER_CAPTURE] Capture manager at capacity or unavailable for', {
          plate: track.plate,
          label: line.label,
        });
      }
    },
    [findRulesForGeometry, updateBufferStatus, addLog, addInfraction]
  );

  /**
   * Checks and captures mid-point evidence if needed.
   */
  const checkMidCapture = useCallback((video: HTMLVideoElement, track: Track) => {
    const manager = evidenceManagerRef.current;
    if (!manager || !manager.isCapturing(track.id)) return;

    // Check if we're at the midpoint of the trajectory
    const midpoint = Math.floor(track.tail.length / 2);
    if (midpoint > 0 && track.tail.length >= 30) {
      manager.captureMidIfNeeded(track, video, midpoint, frameCountRef.current);
    }
  }, []);

  /**
   * Finalizes evidence capture and enqueues for audit.
   */
  const finalizeCapture = useCallback(
    async (
      video: HTMLVideoElement,
      canvas: HTMLCanvasElement,
      track: Track,
      line: GeometryLine,
      viewerId?: string
    ): Promise<boolean> => {
      const manager = evidenceManagerRef.current;
      if (!manager || !manager.isCapturing(track.id)) return false;

      try {
        // Fire finalize in background (non-blocking) - don't await
        // This allows OCR/analysis to start while capture completes
        manager.finalizeCapture(track, line, video, viewerId).catch((err) => {
          logger.error('FRAME_PROCESSOR', 'Capture finalization failed', err);
          track.audited = false;
          track.auditStatus = 'failed';
        });

        // Immediately update UI (non-blocking)
        track.auditStatus = 'pending';
        updateBufferStatus({
          state: 'idle',
          phase: 'standby',
          seconds: 0,
          activeTracks: Math.max(0, manager.getActiveCount() - 1),
          capturedPhotos: 0,
          roiALabel: undefined,
          roiBLabel: undefined,
          plateCandidate: undefined,
        });
        return true;
      } catch (error) {
        logger.error('FRAME_PROCESSOR', 'Error in finalize setup', error);
        return false;
      }
    },
    [updateBufferStatus]
  );

  const scheduleFinalizeCapture = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement, track: Track, line: GeometryLine) => {
      const existing = finalizeTimersRef.current.get(track.id);
      if (existing) {
        window.clearTimeout(existing);
      }
      const delay = getFinalizeDelayMs(track);
      const timerId = window.setTimeout(async () => {
        finalizeTimersRef.current.delete(track.id);
        await finalizeCapture(video, canvas, track, line, viewerId);
      }, delay);
      finalizeTimersRef.current.set(track.id, timerId);
    },
    [finalizeCapture, viewerId]
  );

  /**
   * Process track results and check for zone interactions.
   */
  const processTrackResults = useCallback(
    (activeTracks: Track[], v: HTMLVideoElement, canvas: HTMLCanvasElement): void => {
      if (!v || !canvas || v.videoWidth === 0 || v.videoHeight === 0 || v.readyState < 2) return;

      const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
      const dW = v.videoWidth * scale;
      const dH = v.videoHeight * scale;
      const oX = (canvas.width - dW) / 2;
      const oY = (canvas.height - dH) / 2;
      let newDetections = 0;

      activeTracks.forEach((t: Track) => {
        // Stats counting
        const minHits = t.label === 'person' ? 4 : 2;
        if (t.hits >= minHits && !seenTrackIds.current.has(t.id)) {
          seenTrackIds.current.add(t.id);
          newDetections += 1;
        }

        // Calculate centroid
        const cx = t.bbox.x * dW + (t.bbox.w * dW) / 2 + oX;
        const cy = t.bbox.y * dH + (t.bbox.h * dH) / 2 + oY;

        // Update tail
        const normX = (cx - oX) / dW;
        const normY = (cy - oY) / dH;
        const lastT = t.tail[t.tail.length - 1];
        if (!lastT || Math.hypot(lastT.x - normX, lastT.y - normY) > 0.001) {
          t.tail = [...t.tail, { x: normX, y: normY }].slice(-MAX_TAIL_POINTS);
        }

        // Only process evidence/geometry interactions for established tracks
        if (t.hits < minHits) return;
        if ((evidenceManagerRef.current?.getActiveCount() || 0) >= 2 && !t.roiATurnCaptureKey)
          return;

        // Mid-path turn capture — repeated while traveling ROI A -> ROI B.
        if (t.roiATurnCaptureKey) {
          const framesSinceA = frameCountRef.current - (t.firstHitFrame || 0);
          if (framesSinceA >= 24) {
            evidenceManagerRef.current?.captureMidTurn(t, v);
            updateBufferStatus({
              capturedPhotos: evidenceManagerRef.current?.getSnapshotCount(t.id) ?? 0,
            });
          }
        }
        // Check generic mid-capture only for non-turn flows.
        // Turn ROI tracks already use the dedicated `captureMidTurn` path above.
        if (!t.roiATurnCaptureKey) {
          checkMidCapture(v, t);
        }

        if (t.audited) return;

        // Process geometry interactions
        geometry.forEach((line: GeometryLine) => {
          if (t.processedLines.includes(line.id)) return;
          if (t.audited) return; // stop once Phase 2 or triggerCapture marks this track
          if (t.tail.length < 2) return;

          const p1 = t.tail[t.tail.length - 2];
          const p1x = p1.x * dW + oX;
          const p1y = p1.y * dH + oY;
          const lx1 = line.x1 * dW + oX;
          const ly1 = line.y1 * dH + oY;
          const lx2 = line.x2 * dW + oX;
          const ly2 = line.y2 * dH + oY;

          // LINE INTERSECTION LOGIC â skip ROI and polygon-detected types
          const isLineGeometry = !['roi_general', 'roi_turn', 'box_junction'].includes(line.type);
          if (isLineGeometry && lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {
            let isInfraction = true;
            const infractionLabel = line.label;

            // STOP LINE: requires dwellTime > 3000ms
            if (line.type === 'stop_line' && t.dwellTime > 3000) {
              isInfraction = false;
            }

            if (isInfraction && shouldTriggerCapture(t, line)) {
              triggerCapture(v, canvas, t, { ...line, label: infractionLabel });
              t.processedLines.push(line.id);
              t.crossedLine = true;

              // Schedule finalization
              scheduleFinalizeCapture(v, canvas, t, line);
            } else {
              t.processedLines.push(line.id);
            }
          }

          // BOX JUNCTION / POLYGON LOGIC
          if (line.type === 'box_junction' && line.points) {
            const inZone = isPointInPoly({ x: normX, y: normY }, line.points);

            if (inZone && !t.lastZoneId) {
              t.lastZoneId = line.id;
              t.processedLines.push(`${line.id}_candidate`);
            }

            // Block detection: dwell > 5s
            if (inZone && t.dwellTime > 5000 && isAuditEnabled) {
              if (!t.processedLines.includes(line.id + '_box')) {
                t.processedLines.push(line.id + '_box');
                triggerCapture(v, canvas, t, { ...line, label: 'BLOQUEO_INTERSECCIÓN' });
                scheduleFinalizeCapture(v, canvas, t, {
                  ...line,
                  label: 'BLOQUEO_INTERSECCIÓN',
                });
              }
            } else if (!inZone && t.lastZoneId === line.id) {
              t.lastZoneId = undefined;
            }
          }

          // ROI LOGIC — two-phase forbidden-turn flow
          if ((line.type === 'roi_general' || line.type === 'roi_turn') && line.points) {
            const inROI = isPointInPoly({ x: normX, y: normY }, line.points);

            if (inROI && !t.processedLines.includes(line.id)) {
              t.processedLines.push(line.id);
              t.roiHistory.push(line.id);

              // GENERAL ROI: immediate audit (unchanged)
              if (line.type === 'roi_general' && isAuditEnabled) {
                triggerCapture(v, canvas, t, { ...line, label: `ZONA_ANÁLISIS_${line.label}` });
                scheduleFinalizeCapture(v, canvas, t, {
                  ...line,
                  label: `ZONA_ANÁLISIS_${line.label}`,
                });
              }

              // FORBIDDEN TURN — two-phase
              if (line.type === 'roi_turn' && isAuditEnabled) {
                const uniqueTurnRois = [...new Set(t.roiHistory)].filter(
                  (id) => geometry.find((g) => g.id === id)?.type === 'roi_turn'
                );
                // Canonical ROI A = first roi_turn in the geometry list, or specifically labeled 'ROI A'
                const canonicalRoiA =
                  geometry.find(
                    (g) => g.type === 'roi_turn' && g.label.toUpperCase().includes('ROI A')
                  ) || geometry.find((g) => g.type === 'roi_turn');

                // DEBUG: ROI A Detection
                console.log('=== ROI A PHASE 1 DEBUG ===', {
                  vehicleId: t.id,
                  vehicleHits: t.hits,
                  minHitsRequired: minHits,
                  uniqueTurnRoisCount: uniqueTurnRois.length,
                  canonicalRoiAFound: !!canonicalRoiA,
                  canonicalRoiALabel: canonicalRoiA?.label,
                  alreadyCapturing: !!t.roiATurnCaptureKey,
                  currentLineId: line.id,
                  canonicalRoiAId: canonicalRoiA?.id,
                  lineIdMatchesRoiA: line.id === canonicalRoiA?.id,
                  allConditionsMet: uniqueTurnRois.length === 1 && !t.roiATurnCaptureKey && line.id === canonicalRoiA?.id && t.hits >= minHits
                });

                // PHASE 1: ROI A — start 20s buffer only when entering the designated ROI A
                if (
                  uniqueTurnRois.length === 1 &&
                  !t.roiATurnCaptureKey &&
                  line.id === canonicalRoiA?.id &&
                  t.hits >= minHits
                ) {
                  const manager = evidenceManagerRef.current;
                  const key = manager?.startTurnCapture(t, line, v, canvas, frameCountRef.current);
                  if (key) {
                    t.roiAId = line.id;
                    t.roiATurnCaptureKey = key;
                    t.firstHitFrame = frameCountRef.current;

                    // CRITICAL: Trigger capture to create infraction in module
                    // Without this, infractions don't appear in the UI
                    triggerCapture(v, canvas, t, { ...line, label: 'FORBIDDEN_TURN_PHASE1' });

                    updateBufferStatus({
                      state: 'recording',
                      phase: 'roi_a',
                      roiALabel: line.label,
                      capturedPhotos: manager?.getSnapshotCount(t.id) ?? 0,
                      activeTracks: manager?.getActiveCount() ?? 0,
                    });
                  }
                }

                // PHASE 2: ROI B — confirm infraction, finalize evidence
                // ONLY trigger if Phase 1 (ROI A) was previously captured for this track
                if (
                  uniqueTurnRois.length >= 2 &&
                  t.roiATurnCaptureKey &&
                  !t.forbiddenTurnCaptured
                ) {
                  t.forbiddenTurnCaptured = true;
                  t.audited = true;
                  t.auditStatus = 'processing';
                  const manager = evidenceManagerRef.current;
                  manager?.captureRoiB(t, line, v);
                  const turnLabels = uniqueTurnRois.map(
                    (id) => geometry.find((g) => g.id === id)?.label || id
                  );
                  const confirmedLine: GeometryLine = {
                    ...line,
                    label: `GIRO_PROHIBIDO_${turnLabels.join('_A_')}`,
                    violationKind: 'forbidden_turn_sequence',
                    roiSequenceIds: uniqueTurnRois,
                    roiSequenceLabels: turnLabels,
                  };
                  updateBufferStatus({
                    phase: 'confirmed',
                    roiBLabel: line.label,
                    capturedPhotos: manager?.getSnapshotCount(t.id) ?? 0,
                    activeTracks: manager?.getActiveCount() ?? 0,
                  });
                  scheduleFinalizeCapture(v, canvas, t, confirmedLine);
                }
              }
            }
          }
        });
      });

      if (newDetections > 0) {
        setStats((prev) => ({ ...prev, det: prev.det + newDetections }));
        void publishRealtimeEvent(
          'detection',
          { count: newDetections, ts: Date.now() },
          { viewerId: viewerId || undefined }
        );
      }
    },
    [
      geometry,
      setStats,
      isAuditEnabled,
      shouldTriggerCapture,
      triggerCapture,
      checkMidCapture,
      scheduleFinalizeCapture,
      updateBufferStatus,
    ]
  );

  /**
   * Primary frame processing entry point.
   */
  const processFrame = useCallback(
    async (v: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> => {
      if (!v || v.paused || v.ended || isProcessingRef.current) return;

      // Process detection on every frame to capture all infractions
      // Render loop is now synchronous (non-blocking), so we can process frequently
      const now = Date.now();
      if (now - lastProcessTimeRef.current < 0) return;
      lastProcessTimeRef.current = now;

      isProcessingRef.current = true;
      try {
        frameCountRef.current++;
        trackerRef.current.step();

        const rawResults = await detect(v);
        const results = Array.isArray(rawResults) ? rawResults : [];

        const activeTracks = trackerRef.current.update(
          results,
          engineConfig.persistence,
          engineConfig.confidenceThreshold
        );

        // Validate frame-to-frame continuity
        const continuityReport = continuityValidatorRef.current.validateFrameTransition(activeTracks);
        if (continuityReport.integrityScore < 95 && continuityReport.detectedAnomalies.length > 0) {
          logger.warn(
            'FRAME_PROCESSOR',
            `Continuity warning: integrity ${continuityReport.integrityScore.toFixed(1)}% (frame ${continuityReport.frame})`
          );
        }

        processTrackResults(activeTracks, v, canvas);

        // Pose detection disabled for traffic enforcement (not needed)
        // if (isPoseEnabled) {
        //   await detectPose(v);
        // }

        // Update stats with global registry info
        const globalRegistry = getGlobalTrackRegistry();
        const registryStats = globalRegistry.getSessionStats();
        if (setStats) {
          setStats((prev) => ({
            ...prev,
            globalIdCount: registryStats.totalAllocated,
          }));
        }

        // Cleanup any captures for tracks that have been dropped
        const activeTrackIds = new Set(trackerRef.current.tracks.map((t) => t.id));
        const manager = evidenceManagerRef.current;
        if (manager) {
          const oldCount = manager.getActiveCount();
          manager.syncActiveTracks(activeTrackIds);
          // Cancel pending finalize timers for tracks that are no longer being captured.
          for (const [trackId, timerId] of finalizeTimersRef.current.entries()) {
            if (!manager.isCapturing(trackId)) {
              window.clearTimeout(timerId);
              finalizeTimersRef.current.delete(trackId);
            }
          }
          if (manager.getActiveCount() < oldCount && manager.getActiveCount() === 0) {
            updateBufferStatus({ state: 'idle', activeTracks: 0 });
          } else if (manager.getActiveCount() < oldCount) {
            updateBufferStatus({ activeTracks: manager.getActiveCount() });
          }
        }

        // Sync with Global Context (throttled)
        if (frameCountRef.current % 5 === 0) {
          setTracks([...trackerRef.current.tracks]);
        }
      } catch (e) {
        console.error('ProcessFrame Error:', e);
      } finally {
        isProcessingRef.current = false;
      }
    },
    [detectPose, engineConfig, isPoseEnabled, processTrackResults, detect, setTracks]
  );

  /**
   * Resets the entire tracking system.
   */
  const resetTracker = useCallback((): void => {
    trackerRef.current.reset();
    seenTrackIds.current.clear();
    finalizeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    finalizeTimersRef.current.clear();
    tileCanvasesRef.current.clear();
    evidenceManagerRef.current?.abortAll('Tracker reset');
    setTracks([]);
    frameCountRef.current = 0;
    updateBufferStatus({ state: 'idle', activeTracks: 0, seconds: 0 });
  }, [setTracks, updateBufferStatus]);

  return { processFrame, trackerRef, seenTrackIds, resetTracker };
};
