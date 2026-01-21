import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';

export const TacticalMetrics = () => {
    const { stats } = useSentinel();

    return (
        <div className="p-4 bg-slate-900/60 border-b border-white/10 space-y-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 p-3 rounded-xl border border-white/10">
                    <span className="text-[9px] text-slate-500 block uppercase mb-1 font-black">
                        Total Detecciones
                    </span>
                    <span className="text-2xl font-black text-white leading-none font-mono">
                        {stats.det.toString().padStart(3, '0')}
                    </span>
                </div>
                <div className="bg-black/30 p-3 rounded-xl border border-white/10">
                    <span className="text-[9px] text-slate-500 block uppercase mb-1 font-black">
                        Total Sanciones
                    </span>
                    <span className="text-2xl font-black text-red-500 leading-none font-mono">
                        {stats.inf.toString().padStart(3, '0')}
                    </span>
                </div>
            </div>
        </div>
    );
};
