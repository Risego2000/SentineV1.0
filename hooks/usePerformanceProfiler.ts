import { useState, useRef, useEffect } from 'react';

/**
 * Hook para monitorear el rendimiento del procesamiento de frames.
 * Mide FPS y latencia de inferencia.
 */
export const usePerformanceProfiler = () => {
    const [fps, setFps] = useState(0);
    const [latency, setLatency] = useState(0);
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());
    const processingTimes = useRef<number[]>([]);

    const recordFrame = (startTime: number) => {
        const now = performance.now();
        processingTimes.current.push(now - startTime);
        if (processingTimes.current.length > 30) processingTimes.current.shift();

        frameCount.current++;
        if (now - lastTime.current >= 1000) {
            setFps(frameCount.current);
            setLatency(
                processingTimes.current.reduce((a, b) => a + b, 0) / processingTimes.current.length
            );
            frameCount.current = 0;
            lastTime.current = now;
        }
    };

    return { fps, latency, recordFrame };
};
