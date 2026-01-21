import React, { useRef, useEffect } from 'react';
import { useSentinel } from '../hooks/useSentinel';
import { useFrameProcessor } from '../hooks/useFrameProcessor';
import { usePerformanceProfiler } from '../hooks/usePerformanceProfiler';

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
    const { processFrame } = useFrameProcessor(videoRef, canvasRef);
    const requestRef = useRef<number>(0);

    useEffect(() => {
        const loop = async () => {
            if (!videoRef.current || !canvasRef.current || videoRef.current.paused) {
                requestRef.current = requestAnimationFrame(loop);
                return;
            }

            const startTime = performance.now();
            await processFrame();
            recordFrame(startTime);

            requestRef.current = requestAnimationFrame(loop);
        };

        loop();
        return () => cancelAnimationFrame(requestRef.current);
    }, [geometry, isPlaying, processFrame, videoRef, canvasRef, recordFrame]);

    // Sincronizar métricas locales con el estado global de Sentinel
    useEffect(() => {
        setPerformanceMetrics(fps, latency);
    }, [fps, latency, setPerformanceMetrics]);

    return null;
};
