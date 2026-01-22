import React from 'react';
import { Activity } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const NeuralStatusHUD = () => {
    const { source, systemStatus, statusMsg, fps, latency, stats } = useSentinel();
    const modelLoaded = systemStatus.neural === 'ready';

    return (
        <div className="absolute top-6 left-6 right-6 z-40 flex items-center justify-between pointer-events-none">
            {/* IZQUIERDA: ESTADO DEL SISTEMA */}
            <div className="h-14 px-6 bg-black/90 backdrop-blur border border-white/20 text-cyan-400 rounded-2xl flex items-center gap-4 shadow-2xl">
                <Activity
                    size={20}
                    className={modelLoaded ? 'text-green-500 animate-pulse' : 'text-amber-500'}
                />
                <div className="flex flex-col justify-center">
                    <span className="text-[10px] font-black uppercase tracking-wider leading-none mb-1 text-slate-300">
                        {source === 'none' ? 'SISTEMA: EN ESPERA' : `SISTEMA: ACTIVO [${modelLoaded ? 'RED:OK' : '...'}]`}
                    </span>
                    <div className="flex gap-4 text-[9px] font-bold font-mono text-slate-500">
                        <span className="text-cyan-500">{fps} FPS</span>
                        <span className="text-purple-400">LAT: {latency.toFixed(1)}ms</span>
                        {statusMsg && <span className="text-red-500 animate-pulse ml-2">{statusMsg}</span>}
                    </div>
                </div>
            </div>

            {/* CENTRO/DERECHA: MÉTRICAS TÁCTICAS (REDISEÑO PREMIUM) */}
            <div className="flex gap-4">
                {/* Módulo Detecciones */}
                <div className="group relative overflow-hidden bg-[#0a0f1e]/90 backdrop-blur-xl border border-cyan-500/20 rounded-xl px-5 py-2 flex flex-col justify-center items-end min-w-[120px] shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all hover:border-cyan-500/50">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-400 transition-colors" />
                    <span className="text-[9px] font-bold text-cyan-400/60 uppercase tracking-widest mb-0.5">Total Detecciones</span>
                    <span className="text-3xl font-black text-white font-mono leading-none tracking-tighter drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">
                        {stats.det.toString().padStart(3, '0')}
                    </span>
                    {/* Scanline decoration */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 animate-scanline pointer-events-none" />
                </div>

                {/* Módulo Sanciones */}
                <div className="group relative overflow-hidden bg-[#0f0505]/90 backdrop-blur-xl border border-red-500/20 rounded-xl px-5 py-2 flex flex-col justify-center items-end min-w-[120px] shadow-[0_0_15px_rgba(239,68,68,0.1)] transition-all hover:border-red-500/50">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-600/50 group-hover:bg-red-500 transition-colors" />
                    <span className="text-[9px] font-bold text-red-400/60 uppercase tracking-widest mb-0.5">Total Sanciones</span>
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
