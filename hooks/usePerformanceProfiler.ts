import { useState, useCallback, useRef } from 'react';

/**
 * Hook de rendimiento para Sentinel AI.
 * Calcula FPS y Latencia de procesamiento neural en tiempo real.
 */
export const usePerformanceProfiler = () => {
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const framesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef<number | null>(null);

  const recordFrame = useCallback((startTime: number) => {
    const now = performance.now();
    const currentLatency = now - startTime;
    setLatency(Math.round(currentLatency));

    if (lastUpdateRef.current === null) {
      lastUpdateRef.current = now;
    }

    framesRef.current.push(now);

    // Calcular FPS cada segundo
    if (lastUpdateRef.current !== null && now - lastUpdateRef.current > 1000) {
      setFps(framesRef.current.length);
      framesRef.current = [];
      lastUpdateRef.current = now;
    }
  }, []);

  return { fps, latency, recordFrame };
};
