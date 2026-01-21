import React, { useRef, useCallback } from 'react';
import { useSentinel } from '../context/SentinelContext';
import { ByteTracker } from '../components/ByteTracker';
import { lineIntersect } from '../utils';

export const useFrameProcessor = (
    videoRef: React.RefObject<HTMLVideoElement | null>,
    canvasRef: React.RefObject<HTMLCanvasElement | null>
) => {
    const {
        geometry,
        engineConfig,
        setStats,
        runAudit,
        isPoseEnabled,
        detect,
        detectPose
    } = useSentinel();

    const trackerRef = useRef<ByteTracker>(new ByteTracker());
    const seenTrackIds = useRef(new Set<number>());
    const frameCountRef = useRef(0);
    const isProcessingRef = useRef(false);
    const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const processTrackResults = useCallback((activeTracks: any[]) => {
        activeTracks.forEach(t => {
            const minHits = t.label === 'person' ? 5 : 3;
            if (t.hits >= minHits && !seenTrackIds.current.has(t.id)) {
                seenTrackIds.current.add(t.id);
                setStats(prev => ({ ...prev, det: prev.det + 1 }));
            }
        });

        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.videoWidth === 0) return;

        const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
        const dW = v.videoWidth * scale;
        const dH = v.videoHeight * scale;
        const oX = (canvas.width - dW) / 2;
        const oY = (canvas.height - dH) / 2;

        activeTracks.forEach((t: any) => {
            const cx = t.bbox.x * dW + t.bbox.w * dW / 2 + oX;
            const cy = t.bbox.y * dH + t.bbox.h * dH / 2 + oY;

            if (!t.processedLines) t.processedLines = [];

            geometry.forEach(line => {
                if (!t.processedLines.includes(line.id)) {
                    if (t.tail && t.tail.length >= 2) {
                        const p1 = t.tail[t.tail.length - 2];
                        const p1x = p1.x * dW + oX;
                        const p1y = p1.y * dH + oY;
                        const lx1 = line.x1 * dW + oX; const ly1 = line.y1 * dH + oY;
                        const lx2 = line.x2 * dW + oX; const ly2 = line.y2 * dH + oY;

                        if (lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {
                            t.processedLines.push(line.id);
                            t.crossedLine = true;
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
                                runAudit(t, line);
                            }
                        }
                    }
                }
            });
        });
    }, [geometry, runAudit, setStats, videoRef, canvasRef]);

    const processFrame = useCallback(async () => {
        const v = videoRef.current;
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
                processTrackResults(activeTracks);
            } else {
                processTrackResults(trackerRef.current.tracks);
            }

            if (isPoseEnabled) {
                await detectPose(v);
            }
        } catch (e) {
            console.error("ProcessFrame Error:", e);
        } finally {
            isProcessingRef.current = false;
        }
    }, [detect, detectPose, engineConfig, isPoseEnabled, processTrackResults, videoRef]);

    return { processFrame, trackerRef, seenTrackIds };
};
