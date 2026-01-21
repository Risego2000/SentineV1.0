import React from 'react';
import { Activity } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const NeuralStatusHUD = () => {
    const { source, systemStatus, statusMsg, isDetecting, fps, latency } = useSentinel();
    const modelLoaded = systemStatus.neural === 'ready';

    return (

        <div className="absolute top-6 left-6 z-40 flex items-start gap-4 pointer-events-none">
            <div className="h-14 px-8 bg-black border border-white/20 text-cyan-400 rounded-full flex items-center gap-4 shadow-2xl min-w-[280px]">
                <Activity
                    size={20}
                    className={modelLoaded ? 'text-green-500 animate-pulse' : 'text-amber-500'}
                />
                <div className="flex flex-col justify-center">
                    <span className="text-[11px] font-black uppercase tracking-wider leading-none mb-1">
                        {source === 'none' ? 'RADAR: EN ESPERA' : `RADAR: EJECUTANDO [${modelLoaded ? 'RED:OK' : 'CARGANDO'}]`}
                    </span>
                    <div className="flex gap-3 text-[9px] font-bold font-mono text-slate-400">
                        <span className="text-cyan-600">{fps} FPS</span>
                        <span className="text-white">DELAY: {latency.toFixed(1)}ms</span>
                    </div>
                </div>

                {statusMsg && (
                    <div className="ml-auto text-[9px] text-red-500 font-bold animate-pulse uppercase">
                        {statusMsg}
                    </div>
                )}
            </div>
        </div>
    );

};
