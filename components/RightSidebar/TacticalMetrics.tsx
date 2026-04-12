import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const TacticalMetrics = () => {
  const { stats } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <div className="p-4 bg-transparent border-b border-white/5 shrink-0">
      <div className="grid grid-cols-2 gap-3">
        {/* Módulo Detecciones */}
        <div
          className="group relative overflow-hidden glass-card rounded-2xl p-4 flex flex-col justify-center items-end shadow-neon transition-all hover:scale-[1.02] active:scale-95 cursor-default"
          {...helpProps('Contador de vehículos y objetos detectados en la escena actual.')}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/30 group-hover:bg-cyan-500 transition-colors" />
          <span className="text-xs font-black text-cyan-400/60 uppercase tracking-[0.2em] mb-1 w-full text-right italic">
            Detecciones
          </span>
          <span className="text-4xl font-black text-white font-mono leading-none tracking-tighter text-glow-cyan">
            {stats.det.toString().padStart(3, '0')}
          </span>
          <div className="scanline opacity-20" />
        </div>

        {/* Módulo Sanciones */}
        <div
          className="group relative overflow-hidden glass-card border-red-500/20 rounded-2xl p-4 flex flex-col justify-center items-end transition-all hover:scale-[1.02] active:scale-95 cursor-default"
          {...helpProps('Contador de infracciones confirmadas y expedientes forenses generados.')}
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-red-600/30 group-hover:bg-red-500 transition-colors" />
          <span className="text-xs font-black text-red-400/60 uppercase tracking-[0.2em] mb-1 w-full text-right italic">
            Sanciones
          </span>
          <span className="text-4xl font-black text-red-500 font-mono leading-none tracking-tighter drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]">
            {stats.inf.toString().padStart(3, '0')}
          </span>
          {/* Alerta pulse */}
          {stats.inf > 0 && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping" />
          )}
        </div>
      </div>
    </div>
  );
};
