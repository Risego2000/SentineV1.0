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
            // Stats counting
            const minHits = t.label === 'person' ? 5 : 3;
            if (t.hits >= minHits && !seenTrackIds.current.has(t.id)) {
                seenTrackIds.current.add(t.id);
                setStats(prev => ({ ...prev, det: prev.det + 1 }));
            }

            // Usar el CENTRO del vehículo para ser consistente con el tail y el motor de colisiones
            const cx = t.bbox.x * dW + t.bbox.w * dW / 2 + oX;
            const cy = t.bbox.y * dH + t.bbox.h * dH / 2 + oY;

            // Enriquecer el tail para el renderizado (Sincronización con el tracker)
            if (!t.tail) t.tail = [];
            const normX = (cx - oX) / dW;
            const normY = (cy - oY) / dH;

            // Solo añadir si es un punto significativamente nuevo (evitar duplicados por predicción/detección)
            const lastT = t.tail[t.tail.length - 1];
            if (!lastT || Math.hypot(lastT.x - normX, lastT.y - normY) > 0.001) {
                t.tail.push({ x: normX, y: normY });
                if (t.tail.length > 50) t.tail.shift();
            }

            if (!t.processedLines) t.processedLines = [];
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
                            console.log(`[FORENSIC] ID:${t.id} (${t.label}) - Cruce Detectado en ${line.label}`);

                            let isInfraction = true;
                            let infractionLabel = line.label || 'INFRACCIÓN';

                            // --- VALIDACIÓN DE STOP (Usando telemetría del tracker) ---
                            if (line.type === 'stop_line') {
                                // Usar la velocidad promediada (avgVelocity) calculada en ByteTracker
                                if (t.avgVelocity && t.avgVelocity < 0.005) {
                                    isInfraction = false;
                                    console.log(`[AUDIT] ID:${t.id} - Parada Validada.`);
                                } else {
                                    infractionLabel = 'VIOLACIÓN_STOP';
                                }
                            }

                            if (isInfraction) {
                                t.processedLines.push(line.id);
                                t.crossedLine = true;
                                t.audited = true;

                                const auditLine = { ...line, label: infractionLabel };

                                if (!snapshotCanvasRef.current) {
                                    snapshotCanvasRef.current = document.createElement('canvas');
                                    snapshotCanvasRef.current.width = 1280;
                                    snapshotCanvasRef.current.height = 720;
                                }
                                const sC = snapshotCanvasRef.current;
                                const ctxS = sC.getContext('2d');
                                if (ctxS) {
                                    if (!t.snapshots) t.snapshots = [];

                                    // 1. CAPTURA ESCENA COMPLETA (Contexto)
                                    ctxS.drawImage(v, 0, 0, 1280, 720);
                                    t.snapshots.push(sC.toDataURL('image/jpeg', 0.6).split(',')[1]);

                                    // 2. CAPTURA ZOOM TÁCTICO (Detalle Matrícula/Vehículo)
                                    // Recortar un área un 50% mayor que el BBox para dar contexto al vehículo
                                    const zoomPad = 0.5;
                                    const zX = Math.max(0, t.bbox.x - t.bbox.w * zoomPad / 2) * v.videoWidth;
                                    const zY = Math.max(0, t.bbox.y - t.bbox.h * zoomPad / 2) * v.videoHeight;
                                    const zW = Math.min(1, t.bbox.w * (1 + zoomPad)) * v.videoWidth;
                                    const zH = Math.min(1, t.bbox.h * (1 + zoomPad)) * v.videoHeight;

                                    ctxS.clearRect(0, 0, 1280, 720);
                                    ctxS.drawImage(v, zX, zY, zW, zH, 0, 0, 1280, 720);
                                    t.snapshots.push(sC.toDataURL('image/jpeg', 0.7).split(',')[1]);

                                    console.log(`[FORENSIC] Ráfaga de evidencia capturada para ID:${t.id}. Iniciando peritaje IA...`);
                                    runAudit(t, auditLine);
                                }
                            } else {
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

    const resetTracker = useCallback(() => {
        trackerRef.current.reset();
        seenTrackIds.current.clear();
        setTracks([]);
    }, [setTracks]);

    return { processFrame, trackerRef, seenTrackIds, resetTracker };
};
