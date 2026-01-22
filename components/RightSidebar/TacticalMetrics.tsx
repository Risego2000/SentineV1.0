import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';

export const TacticalMetrics = () => {
    const { stats } = useSentinel();

    return (
        <div className="p-4 bg-[#020617]/50 border-b border-white/5 shrink-0">
            <div className="grid grid-cols-2 gap-3">
                {/* Módulo Detecciones */}
                <div className="group relative overflow-hidden bg-[#0a0f1e]/80 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-center items-end shadow-[0_0_15px_rgba(6,182,212,0.05)] transition-all hover:border-cyan-500/50 hover:bg-[#0a0f1e]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-colors" />
                    <span className="text-[8px] font-bold text-cyan-400/60 uppercase tracking-widest mb-1 w-full text-right">Detecciones</span>
                    <span className="text-3xl font-black text-white font-mono leading-none tracking-tighter drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                        {stats.det.toString().padStart(3, '0')}
                    </span>
                    {/* Scanline decoration */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 animate-scanline pointer-events-none" />
                </div>

                {/* Módulo Sanciones */}
                <div className="group relative overflow-hidden bg-[#0f0505]/80 border border-red-500/20 rounded-xl p-3 flex flex-col justify-center items-end shadow-[0_0_15px_rgba(239,68,68,0.05)] transition-all hover:border-red-500/50 hover:bg-[#0f0505]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50 group-hover:bg-red-500 transition-colors" />
                    <span className="text-[8px] font-bold text-red-400/60 uppercase tracking-widest mb-1 w-full text-right">Sanciones</span>
                    <span className="text-3xl font-black text-red-500 font-mono leading-none tracking-tighter drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                        {stats.inf.toString().padStart(3, '0')}
                    </span>
                    {/* Alerta pulse */}
                    {stats.inf > 0 && (
                        <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                    )}
                </div>
            </div>
        </div>
    );
};
