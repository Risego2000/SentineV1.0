/**
 * Sentinel AI Frame Processor Hook v2.
 * Uses EvidenceCaptureManager for multi-track support and ForensicQueueV3 for immutable jobs.
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSentinel } from './useSentinel';
import { ByteTracker } from '../services/ByteTracker';
import { lineIntersect, isPointInPoly } from '../utils';
import { Track, GeometryLine, StandardDetection } from '../types';
import { forensicQueue } from '../services/ForensicQueue';
import { EvidenceCaptureManager } from '../services/EvidenceCaptureManager';
import { ForensicRule, getRulesForGeometry, findForbiddenTurnRule } from '../types/forensicRules';

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
  const evidenceManagerRef = useRef<EvidenceCaptureManager | null>(null);
  const lastProcessTimeRef = useRef<number>(0);

  // Initialize EvidenceCaptureManager
  useEffect(() => {
    evidenceManagerRef.current = new EvidenceCaptureManager({
      maxSimultaneous: 3,
      priorityMode: 'first',
      autoAbortOnExit: true,
    });

    evidenceManagerRef.current.setBufferCallback((targetId, seconds) => {
      updateBufferStatus({ seconds });
    });

    return () => {
      evidenceManagerRef.current?.abortAll('Component unmount');
    };
  }, [updateBufferStatus]);

  /**
   * Finds matching forensic rules for a geometry.
   */
  const findRulesForGeometry = useCallback((geom: GeometryLine): ForensicRule | undefined => {
    const rules = getRulesForGeometry(geom.id);
    if (rules.length > 0) {
      return rules.sort((a, b) => b.priority - a.priority)[0];
    }
    // Fallback to type-based rule
    return getRulesForGeometry(geom.type)[0];
  }, []);

  /**
   * Checks if a track should trigger evidence capture.
   */
  const shouldTriggerCapture = useCallback(
    (track: Track, line: GeometryLine): boolean => {
      if (!isAuditEnabled) return false;
      if (track.audited) return false;
      if (!evidenceManagerRef.current?.shouldCapture(track.id, line.id)) return false;

      // Check for forbidden turn sequence
      if (line.type === 'roi_turn') {
        const turnRule = findForbiddenTurnRule(track.roiHistory);
        if (turnRule) {
          // Check if we have enough ROIs to trigger
          const uniqueRois = [...new Set(track.roiHistory)];
          return uniqueRois.length >= 2;
        }
      }

      return true;
    },
    [isAuditEnabled, findRulesForGeometry]
  );

  /**
   * Triggers evidence capture for a track/geometry combination.
   */
  const triggerCapture = useCallback(
    (video: HTMLVideoElement, canvas: HTMLCanvasElement, track: Track, line: GeometryLine) => {
      const manager = evidenceManagerRef.current;
      if (!manager) return;

      const rule = findRulesForGeometry(line);
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
      }
    },
    [findRulesForGeometry, updateBufferStatus]
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
      line: GeometryLine
    ) => {
      const manager = evidenceManagerRef.current;
      if (!manager || !manager.isCapturing(track.id)) return;

      await manager.finalizeCapture(track, line, video, frameCountRef.current);
      track.auditStatus = 'pending';
      updateBufferStatus({
        state: 'idle',
        activeTracks: Math.max(0, manager.getActiveCount() - 1),
      });
    },
    [updateBufferStatus]
  );

  /**
   * Aborts capture for a track.
   */
  const abortCapture = useCallback(
    (trackId: number, reason: string) => {
      const manager = evidenceManagerRef.current;
      if (manager) {
        manager.abortCapture(trackId, reason);
        updateBufferStatus({
          state: 'idle',
          activeTracks: Math.max(0, manager.getActiveCount() - 1),
        });
      }
    },
    [updateBufferStatus]
  );

  /**
   * Process track results and check for zone interactions.
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
        // Stats counting
        const minHits = t.label === 'person' ? 4 : 2;
        if (t.hits >= minHits && !seenTrackIds.current.has(t.id)) {
          seenTrackIds.current.add(t.id);
          setStats((prev) => ({ ...prev, det: prev.det + 1 }));
        }

        // Calculate centroid
        const cx = t.bbox.x * dW + (t.bbox.w * dW) / 2 + oX;
        const cy = t.bbox.y * dH + (t.bbox.h * dH) / 2 + oY;

        // Update tail
        const normX = (cx - oX) / dW;
        const normY = (cy - oY) / dH;
        const lastT = t.tail[t.tail.length - 1];
        if (!lastT || Math.hypot(lastT.x - normX, lastT.y - normY) > 0.001) {
          t.tail.push({ x: normX, y: normY });
          if (t.tail.length > 50) t.tail.shift();
        }

        // Check mid-capture for active suspects
        checkMidCapture(v, t);

        if (t.audited) return;

        // Process geometry interactions
        geometry.forEach((line: GeometryLine) => {
          if (t.processedLines.includes(line.id)) return;
          if (t.tail.length < 2) return;

          const p1 = t.tail[t.tail.length - 2];
          const p1x = p1.x * dW + oX;
          const p1y = p1.y * dH + oY;
          const lx1 = line.x1 * dW + oX;
          const ly1 = line.y1 * dH + oY;
          const lx2 = line.x2 * dW + oX;
          const ly2 = line.y2 * dH + oY;

          // LINE INTERSECTION LOGIC
          if (lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {
            let isInfraction = true;
            let infractionLabel = line.label;

            // STOP LINE: requires dwellTime > 3000ms
            if (line.type === 'stop_line' && t.dwellTime > 3000) {
              isInfraction = false;
            }

            if (isInfraction && shouldTriggerCapture(t, line)) {
              triggerCapture(v, canvas, t, { ...line, label: infractionLabel });
              t.processedLines.push(line.id);
              t.crossedLine = true;

              // Schedule finalization
              setTimeout(() => {
                finalizeCapture(v, canvas, t, line);
              }, 2000);
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

                setTimeout(() => {
                  finalizeCapture(v, canvas, t, { ...line, label: 'BLOQUEO_INTERSECCIÓN' });
                }, 2000);
              }
            } else if (!inZone && t.lastZoneId === line.id) {
              t.lastZoneId = undefined;
            }
          }

          // ROI LOGIC
          if ((line.type === 'roi_general' || line.type === 'roi_turn') && line.points) {
            const inROI = isPointInPoly({ x: normX, y: normY }, line.points);

            if (inROI && !t.processedLines.includes(line.id)) {
              t.processedLines.push(line.id);
              t.roiHistory.push(line.id);

              // General ROI: immediate audit
              if (line.type === 'roi_general' && isAuditEnabled) {
                triggerCapture(v, canvas, t, { ...line, label: `ZONA_ANÁLISIS_${line.label}` });

                setTimeout(() => {
                  finalizeCapture(v, canvas, t, { ...line, label: `ZONA_ANÁLISIS_${line.label}` });
                }, 2000);
              }

              // Forbidden turn: check sequence
              if (line.type === 'roi_turn' && isAuditEnabled) {
                const uniqueRois = [...new Set(t.roiHistory)];
                if (uniqueRois.length >= 2) {
                  const turnRule = findForbiddenTurnRule(uniqueRois);
                  const turnLabels = uniqueRois.map(
                    (id) => geometry.find((g) => g.id === id)?.label || id
                  );

                  triggerCapture(v, canvas, t, {
                    ...line,
                    label: `GIRO_PROHIBIDO_${turnLabels.join('_A_')}`,
                    violationKind: 'forbidden_turn_sequence',
                    roiSequenceIds: uniqueRois,
                    roiSequenceLabels: turnLabels,
                  });

                  setTimeout(() => {
                    finalizeCapture(v, canvas, t, {
                      ...line,
                      label: `GIRO_PROHIBIDO_${turnLabels.join('_A_')}`,
                      violationKind: 'forbidden_turn_sequence',
                      roiSequenceIds: uniqueRois,
                      roiSequenceLabels: turnLabels,
                    });
                  }, 2000);
                }
              }
            }
          }
        });
      });
    },
    [
      geometry,
      setStats,
      isAuditEnabled,
      shouldTriggerCapture,
      triggerCapture,
      checkMidCapture,
      finalizeCapture,
    ]
  );

  /**
   * Primary frame processing entry point.
   */
  const processFrame = useCallback(
    async (v: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<void> => {
      if (!v || v.paused || v.ended || isProcessingRef.current) return;

      // Throttle to ~30fps max
      const now = Date.now();
      if (now - lastProcessTimeRef.current < 33) return;
      lastProcessTimeRef.current = now;

      isProcessingRef.current = true;
      try {
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
    [detect, detectPose, engineConfig, isPoseEnabled, processTrackResults, setTracks]
  );

  /**
   * Resets the entire tracking system.
   */
  const resetTracker = useCallback((): void => {
    trackerRef.current.reset();
    seenTrackIds.current.clear();
    evidenceManagerRef.current?.abortAll('Tracker reset');
    setTracks([]);
    frameCountRef.current = 0;
    updateBufferStatus({ state: 'idle', activeTracks: 0, seconds: 0 });
  }, [setTracks, updateBufferStatus]);

  return { processFrame, trackerRef, seenTrackIds, resetTracker };
};
