import React, { useRef, useCallback } from 'react';
import { useSentinel } from './useSentinel';
import { ByteTracker } from '../components/ByteTracker';
import { lineIntersect, isPointInPoly } from '../utils';
import { VideoBufferService } from '../services/videoRecorder';

export const useFrameProcessor = () => {
    const {
        geometry,
        engineConfig,
        setStats,
        runAudit,
        isPoseEnabled,
        detect,
        detectPose,
        setTracks,
        isAuditEnabled
    } = useSentinel();

    const trackerRef = useRef<ByteTracker>(new ByteTracker());
    const seenTrackIds = useRef(new Set<number>());
    const frameCountRef = useRef(0);
    const isProcessingRef = useRef(false);
    const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const recorderRef = useRef<any>(null);

    const captureSnapshot = useCallback((video: HTMLVideoElement, track: any) => {
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
            if (!track.snapshots) track.snapshots = [];

            // 1. CAPTURA ESCENA COMPLETA (Contexto)
            sC.width = 1280; sC.height = 720;
            ctxS.drawImage(video, 0, 0, 1280, 720);
            track.snapshots.push(sC.toDataURL('image/jpeg', 0.6).split(',')[1]);

            // 2. CAPTURA ZOOM TÁCTICO (Detalle Matrícula/Vehículo)
            const zoomPad = 0.5;
            const videoW = video.videoWidth;
            const videoH = video.videoHeight;
            const zX = Math.max(0, track.bbox.x - track.bbox.w * zoomPad / 2) * videoW;
            const zY = Math.max(0, track.bbox.y - track.bbox.h * zoomPad / 2) * videoH;
            const zW = Math.min(1, track.bbox.w * (1 + zoomPad)) * videoW;
            const zH = Math.min(1, track.bbox.h * (1 + zoomPad)) * videoH;

            ctxS.clearRect(0, 0, 1280, 720);
            ctxS.drawImage(video, zX, zY, zW, zH, 0, 0, 1280, 720);
            track.snapshots.push(sC.toDataURL('image/jpeg', 0.7).split(',')[1]);

            return true;
        } catch (error) {
            console.error('Error capturando snapshot:', error);
            return false;
        }
    }, []);

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

                        // 1. LÓGICA DE LÍNEAS VECTORIALES (STOP, PROHIBIDO, CARRIL)
                        if (lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {
                            console.log(`[FORENSIC] ID:${t.id} (${t.label}) - Interacción Detectada en ${line.label}`);

                            let isInfraction = true;
                            let infractionLabel = line.label || 'INFRACCIÓN';

                            // --- HEURÍSTICA DE STOP (Requiere detención > 3000ms) ---
                            if (line.type === 'stop_line') {
                                // Si cruza la línea y su 'dwellTime' es menor a 3 segundos -> Infracción
                                if (t.dwellTime > 3000) {
                                    isInfraction = false;
                                    console.log(`[AUDIT] ID:${t.id} - Stop Validado (${t.dwellTime}ms)`);
                                } else {
                                    infractionLabel = 'VIOLACIÓN_STOP';
                                    console.log(`[AUDIT] ID:${t.id} - Violación STOP: Detención insuficiente.`);
                                }
                            }

                            if (isInfraction) {
                                if (isAuditEnabled) {
                                    const snapshotCaptured = captureSnapshot(v, t);
                                    if (snapshotCaptured) {
                                        t.processedLines.push(line.id);
                                        t.crossedLine = true;
                                        t.audited = true;
                                        t.auditStatus = 'pending';

                                        // Capturar Clip de Video (Asíncrono para no bloquear)
                                        if (recorderRef.current) {
                                            recorderRef.current.getClip().then((clip: string) => {
                                                t.videoClip = clip;
                                                const auditLine = { ...line, label: infractionLabel };
                                                runAudit(t, auditLine);
                                            });
                                        } else {
                                            const auditLine = { ...line, label: infractionLabel };
                                            runAudit(t, auditLine);
                                        }
                                    }
                                } else {
                                    // Si la auditoría está desactivada, simplemente marcamos como procesado
                                    t.processedLines.push(line.id);
                                }
                            } else {
                                t.processedLines.push(line.id);
                            }
                        }

                        // 2. LÓGICA DE ÁREAS (BOX JUNCTION / POLÍGONOS)
                        if (line.type === 'box_junction' && line.points) {
                            const inZone = isPointInPoly({ x: normX, y: normY }, line.points);
                            if (inZone) {
                                t.lastZoneId = line.id;
                                // Si el vehículo se queda atrapado en el cruce (velocidad ~0 y dwellTime > 5s)
                                if (t.dwellTime > 5000 && !t.processedLines.includes(line.id + '_box') && isAuditEnabled) {
                                    console.log(`[FORENSIC] ID:${t.id} - BLOQUEO DE INTERSECCIÓN DETECTADO.`);
                                    const snap = captureSnapshot(v, t);
                                    if (snap) {
                                        t.processedLines.push(line.id + '_box');
                                        t.audited = true;

                                        if (recorderRef.current) {
                                            recorderRef.current.getClip().then((clip: string) => {
                                                t.videoClip = clip;
                                                runAudit(t, { ...line, label: 'BLOQUEO_INTERSECCIÓN' });
                                            });
                                        } else {
                                            runAudit(t, { ...line, label: 'BLOQUEO_INTERSECCIÓN' });
                                        }
                                    }
                                }
                            } else if (t.lastZoneId === line.id) {
                                t.lastZoneId = undefined;
                            }
                        }
                    }
                }
            });
        });
    }, [geometry, runAudit, setStats, captureSnapshot]);

    const processFrame = useCallback(async (v: HTMLVideoElement, canvas: HTMLCanvasElement) => {
        if (!v || v.paused || v.ended || isProcessingRef.current) return;

        isProcessingRef.current = true;
        try {
            // Inicializar grabador si no existe
            if (!recorderRef.current && canvas) {
                recorderRef.current = new VideoBufferService(canvas);
                recorderRef.current.start();
            }

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
