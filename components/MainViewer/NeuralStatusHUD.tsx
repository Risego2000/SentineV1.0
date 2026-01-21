import React from 'react';
import { Activity } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const NeuralStatusHUD = () => {
    const { source, systemStatus, statusMsg, isDetecting, fps, latency } = useSentinel();
    const modelLoaded = systemStatus.neural === 'ready';

    return (
        <div className="absolute top-6 left-6 z-40 flex items-start gap-4 pointer-events-none">
            <div className="px-5 py-3 bg-black/90 border border-white/10 text-cyan-400 text-[10px] font-black rounded-2xl flex flex-col gap-1 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <Activity
                        size={14}
                        className={modelLoaded ? 'text-green-500 animate-pulse' : 'text-amber-500'}
                    />
                    <div className="flex flex-col">
                        <span>
                            RADAR: {source === 'none' ? 'EN ESPERA' : `EJECUTANDO [${modelLoaded ? 'RED:OK' : 'RED:CARGANDO'}]`}
                        </span>
                        <div className="flex gap-3 text-[7px] font-mono text-cyan-500/80">
                            <span>{fps} FPS</span>
                            <span>DELAY: {latency.toFixed(1)}ms</span>
                        </div>
                    </div>
                </div>
                {statusMsg && (
                    <div className="text-[8px] text-cyan-500/60 border-t border-white/5 pt-1 mt-1 font-mono uppercase">
                        {statusMsg}
                    </div>
                )}
                {isDetecting && (
                    <div className="text-[8px] text-purple-400 animate-pulse absolute top-2 right-2 font-mono">
                        RED_OCUPADA
                    </div>
                )}
            </div>
        </div>
    );
};
