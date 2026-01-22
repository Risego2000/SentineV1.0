import React, { useRef, useCallback } from 'react';
import { useSentinel } from './useSentinel';
import { ByteTracker } from '../components/ByteTracker';
import { lineIntersect } from '../utils';

export const useFrameProcessor = () => {
    const {
        geometry,
        engineConfig,
        setStats,
        runAudit,
        isPoseEnabled,
        detect,
        detectPose,
        setTracks
    } = useSentinel();

    const trackerRef = useRef<ByteTracker>(new ByteTracker());
    const seenTrackIds = useRef(new Set<number>());
    const frameCountRef = useRef(0);
    const isProcessingRef = useRef(false);
    const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const processTrackResults = useCallback((activeTracks: any[], v: HTMLVideoElement, canvas: HTMLCanvasElement) => {
        if (!v || !canvas || v.videoWidth === 0) return;

        const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
        const dW = v.videoWidth * scale;
        const dH = v.videoHeight * scale;
        const oX = (canvas.width - dW) / 2;
        const oY = (canvas.height - dH) / 2;

        activeTracks.forEach((t: any) => {
            // Stats counting (Moved from old location)
            const minHits = t.label === 'person' ? 5 : 3;
            if (t.hits >= minHits && !seenTrackIds.current.has(t.id)) {
                seenTrackIds.current.add(t.id);
                setStats(prev => ({ ...prev, det: prev.det + 1 }));
            }

            // Usar la BASE del vehículo (Punto de contacto con el suelo) para mayor precisión en perspectiva
            const cx = t.bbox.x * dW + t.bbox.w * dW / 2 + oX;
            const cy = (t.bbox.y + t.bbox.h) * dH + oY; // Fondo del BBox (ruedas)

            if (!t.processedLines) t.processedLines = [];

            // SINGLE DETECTION RULE: Si ya fue auditado, ignorar.
            if (t.audited) return;

            geometry.forEach(line => {
                if (!t.processedLines.includes(line.id)) {
                    if (t.tail && t.tail.length >= 2) {
                        const p1 = t.tail[t.tail.length - 2];
                        const p1x = p1.x * dW + oX;
                        const p1y = p1.y * dH + oY;
                        const lx1 = line.x1 * dW + oX; const ly1 = line.y1 * dH + oY;
                        const lx2 = line.x2 * dW + oX; const ly2 = line.y2 * dH + oY;

                        if (lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {

                            let isInfraction = true;
                            let infractionLabel = line.label || 'INFRACCIÓN';

                            // --- TRUE STOP LOGIC ---
                            // Check velocity history for stop lines
                            if (line.type === 'stop_line') {
                                // Calculate average displacement per frame over last 20 frames (~0.5s at 30fps)
                                // Only works if we have enough tail history
                                if (t.tail.length >= 10) {
                                    const history = t.tail.slice(-20);
                                    let totalDist = 0;
                                    for (let i = 1; i < history.length; i++) {
                                        const dx = history[i].x - history[i - 1].x;
                                        const dy = history[i].y - history[i - 1].y;
                                        totalDist += Math.sqrt(dx * dx + dy * dy);
                                    }
                                    const avgSpeed = totalDist / (history.length - 1);

                                    // Threshold: 0.005 normalized units per frame typically means very slow/stopped
                                    // Adjust based on typical scene depth
                                    if (avgSpeed < 0.005) {
                                        isInfraction = false; // He stopped!
                                        // Optional: Log "Good Driver" event or simply ignore
                                        console.log(`Vehicle ${t.id} performed a valid STOP.`);
                                    } else {
                                        infractionLabel = 'STOP VIOLATION';
                                    }
                                }
                            }

                            if (isInfraction) {
                                t.processedLines.push(line.id);
                                t.crossedLine = true;
                                t.audited = true; // Mark as audited

                                // Override label for the audit if modified
                                const auditLine = { ...line, label: infractionLabel };

                                if (!snapshotCanvasRef.current) {
                                    snapshotCanvasRef.current = document.createElement('canvas');
                                    snapshotCanvasRef.current.width = 1280;
                                    snapshotCanvasRef.current.height = 720;
                                }
                                const sC = snapshotCanvasRef.current;
                                const ctxS = sC.getContext('2d');
                                if (ctxS) {
                                    ctxS.drawImage(v, 0, 0, 1280, 720);
                                    if (!t.snapshots) t.snapshots = [];
                                    const data = sC.toDataURL('image/jpeg', 0.5);
                                    t.snapshots.push(data.split(',')[1]);

                                    // Send to Neural Core
                                    runAudit(t, auditLine);
                                }
                            } else {
                                // If valid stop, we still mark line as processed so we don't check it again
                                t.processedLines.push(line.id);
                            }
                        }
                    }
                }
            });
        });
    }, [geometry, runAudit, setStats]);

    const processFrame = useCallback(async (v: HTMLVideoElement, canvas: HTMLCanvasElement) => {
        if (!v || v.paused || v.ended || isProcessingRef.current) return;

        isProcessingRef.current = true;
        try {
            frameCountRef.current++;
            trackerRef.current.step();

            if (frameCountRef.current % engineConfig.detectionSkip === 0) {
                const detections = await detect(v);
                const activeTracks = trackerRef.current.update(
                    detections.map(d => ({
                        x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h,
                        score: d.score, label: d.label
                    })),
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

            // Sync with context (THROTTLED para evitar React Render Loop Crash)
            // Solo actualizamos la UI cada 5 frames (aprox 12fps), suficiente para visualización humana
            if (frameCountRef.current % 5 === 0) {
                setTracks([...trackerRef.current.tracks]);
            }
        } catch (e) {
            console.error("ProcessFrame Error:", e);
        } finally {
            isProcessingRef.current = false;
        }
    }, [detect, detectPose, engineConfig, isPoseEnabled, processTrackResults]);

    return { processFrame, trackerRef, seenTrackIds };
};
