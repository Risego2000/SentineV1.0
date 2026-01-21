import React, { useRef, useEffect } from 'react';
import { useSentinel } from '../hooks/useSentinel';
import { useFrameProcessor } from '../hooks/useFrameProcessor';
import { usePerformanceProfiler } from '../hooks/usePerformanceProfiler';
import { renderScence } from './renderSystem';

interface TacticalOverlayProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/**
 * TacticalOverlay modularizado.
 * Maneja el loop de procesamiento visual y la actualización de métricas de rendimiento.
 */
export const TacticalOverlay = ({ videoRef, canvasRef }: TacticalOverlayProps) => {
    const { geometry, isPlaying, setPerformanceMetrics } = useSentinel();
    const { fps, latency, recordFrame } = usePerformanceProfiler();
    const { processFrame, trackerRef } = useFrameProcessor(); // Necesitamos trackerRef para dibujar
    const requestRef = useRef<number>(0);
    const isProcessingFrame = useRef(false); // Flag local para no bloquear el loop

    useEffect(() => {
        const loop = () => {
            if (!videoRef.current || !canvasRef.current || videoRef.current.paused || videoRef.current.ended) {
                requestRef.current = requestAnimationFrame(loop);
                return;
            }

            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // 1. RENDERIZADO (Siempre, máxima fluidez)
            if (ctx) {
                renderScence(ctx, video, trackerRef.current.tracks, geometry);
            }

            // 2. PROCESAMIENTO IA (On demand, sin bloquear render)
            if (!isProcessingFrame.current) {
                isProcessingFrame.current = true;
                const startTime = performance.now();

                // Ejecutar detección
                processFrame(video, canvas).then(() => {
                    recordFrame(startTime);
                    isProcessingFrame.current = false;
                }).catch(() => {
                    isProcessingFrame.current = false;
                });
            }

            requestRef.current = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(requestRef.current);
    }, [geometry, isPlaying, processFrame, videoRef, canvasRef, recordFrame, trackerRef]);

    // Sincronizar métricas locales con el estado global de Sentinel
    useEffect(() => {
        setPerformanceMetrics(fps, latency);
    }, [fps, latency, setPerformanceMetrics]);

    return null;
};
