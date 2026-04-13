import React from 'react';
import { BrainCircuit } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';

export const EmptyState = () => {
  const { gridSize } = useLayoutStore();
  const mini = gridSize >= 3;
  const compact = gridSize >= 2;

  if (mini)
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-30 bg-[#020617]">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 border border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <BrainCircuit className="w-6 h-6 text-cyan-500 animate-pulse absolute" />
        </div>
        <span className="text-cyan-500/30 font-mono text-[7px] tracking-widest uppercase text-center px-2">
          SENTINEL.V16
        </span>
      </div>
    );

  if (compact)
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-30 bg-[#020617] p-6">
        <div className="relative flex items-center justify-center">
          <div className="w-28 h-28 border border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <BrainCircuit className="w-11 h-11 text-cyan-500 animate-pulse absolute" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-cyan-500/30 font-mono text-[8px] tracking-[0.4em] uppercase text-center">
            SENTINEL.V16_ALFA
          </span>
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((d, i) => (
              <div
                key={i}
                className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 z-30 bg-[#020617] p-8 md:p-20">
      <div className="relative flex items-center justify-center">
        <div className="w-40 h-40 md:w-64 md:h-64 border-2 border-cyan-500/10 rounded-full animate-spin-slow" />
        <div className="w-36 h-36 md:w-56 md:h-56 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin absolute" />
        <BrainCircuit className="w-14 h-14 md:w-20 md:h-20 text-cyan-500 animate-pulse absolute" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-cyan-500/30 font-mono text-[9px] tracking-[0.5em] uppercase text-center">
          Protocolo de Seguridad: SENTINEL.V16_ALFA
        </span>
        <div className="flex gap-1">
          <div
            className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
            style={{ animationDelay: '0.2s' }}
          />
          <div
            className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
            style={{ animationDelay: '0.4s' }}
          />
        </div>
      </div>
    </div>
  );
};
