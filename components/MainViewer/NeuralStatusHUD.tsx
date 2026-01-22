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

            {/* CENTRO/DERECHA: MÉTRICAS MOVIDAS AL SIDEBAR */}
        </div>
    );
};
