import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const TacticalMetrics = () => {
  const { stats } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <div className="p-4 bg-white/[0.01] border-b border-white/5 shrink-0">
      <div className="grid grid-cols-2 gap-3">
        {/* Módulo Detecciones */}
        <div
          className="group relative overflow-hidden horizon-card rounded-lg p-4 flex flex-col justify-center items-end transition-all hover:bg-white/[0.03] cursor-default"
          {...helpProps('Contador de vehículos y objetos detectados en la escena actual.')}
        >
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 w-full text-right">
            Detecciones
          </span>
          <span className="text-3xl font-bold text-blue-500 font-mono leading-none tracking-tighter">
            {stats.det.toString().padStart(3, '0')}
          </span>
        </div>

        {/* Módulo Sanciones */}
        <div
          className="group relative overflow-hidden horizon-card rounded-lg p-4 flex flex-col justify-center items-end transition-all hover:bg-white/[0.03] cursor-default"
          {...helpProps('Contador de infracciones confirmadas y expedientes forenses generados.')}
        >
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 w-full text-right">
            Sanciones
          </span>
          <span className="text-3xl font-bold text-red-500 font-mono leading-none tracking-tighter">
            {stats.inf.toString().padStart(3, '0')}
          </span>
        </div>
      </div>
    </div>
  );
};
