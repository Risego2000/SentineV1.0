import React, { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useLayoutStore } from '../../stores/layoutStore';

export const SystemAlertHUD = () => {
  const { tracks } = useSentinel();
  const { gridSize } = useLayoutStore();
  const [visibleAnomalies, setVisibleAnomalies] = useState<
    { id: string; text: string; timestamp: number }[]
  >([]);
  const seenAnomalies = useRef<Set<string>>(new Set());

  const mini = gridSize >= 4;
  const compact = gridSize >= 2 && gridSize < 4;

  useEffect(() => {
    const currentAnomalies = tracks
      .filter((t) => t.isAnomalous && t.anomalyLabel)
      .map((t) => ({
        id: `KINETIC_${t.id}`,
        text: `${t.anomalyLabel} [${(t.label || 'VEHÍCULO').toUpperCase()}_${t.id}]`,
      }));

    currentAnomalies.forEach((anom) => {
      if (!seenAnomalies.current.has(anom.id)) {
        seenAnomalies.current.add(anom.id);

        const newAnom = { ...anom, timestamp: Date.now() };

        setVisibleAnomalies((prev) => {
          if (prev.some((a) => a.id === newAnom.id)) return prev;
          return [newAnom, ...prev].slice(0, 3);
        });

        setTimeout(() => {
          setVisibleAnomalies((prev) => prev.filter((a) => a.id !== newAnom.id));
        }, 5000);
      }
    });

    const currentTrackIds = new Set(tracks.map((t) => `KINETIC_${t.id}`));
    for (const id of seenAnomalies.current) {
      if (!currentTrackIds.has(id)) {
        seenAnomalies.current.delete(id);
      }
    }
  }, [tracks]);

  if (visibleAnomalies.length === 0) return null;

  return (
    <div className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-2 pointer-events-none select-none">
      <div className="w-64 max-w-[calc(100vw-3rem)]">
        <div className="space-y-2">
          {visibleAnomalies.map((anom) => (
            <div
              key={`${anom.id}-${anom.timestamp}`}
              className={`
                flex items-center gap-3 backdrop-blur-md bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[9.5px] text-amber-200/90 font-bold uppercase tracking-tight shadow-2xl
                animate-in slide-in-from-right-4 fade-in duration-300
                ${mini ? 'p-2' : compact ? 'p-2.5' : 'p-3'}
              `}
            >
              <div className="w-5 h-5 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/20 flex-shrink-0">
                <Zap size={10} className="text-amber-500" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black uppercase tracking-widest leading-none text-[8px] text-amber-500 mb-0.5">
                  ALERTA_SISTEMA
                </span>
                <span className="flex-1 text-glow-blue truncate">{anom.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
