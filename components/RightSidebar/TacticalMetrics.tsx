import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';

export const TacticalMetrics = () => {
    const { stats } = useSentinel();

    return (
        <div className="p-4 bg-slate-900/60 border-b border-white/10 space-y-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-white/10 shadow-lg">
                    <span className="text-[10px] text-slate-400 block uppercase mb-1 font-black tracking-wider">
                        Total Detecciones
                    </span>
                    <span className="text-3xl font-black text-cyan-400 leading-none font-mono tracking-tighter">
                        {stats.det.toString().padStart(3, '0')}
                    </span>
                </div>
                <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-white/10 shadow-lg">
                    <span className="text-[10px] text-slate-400 block uppercase mb-1 font-black tracking-wider">
                        Total Sanciones
                    </span>
                    <span className="text-3xl font-black text-red-500 leading-none font-mono tracking-tighter">
                        {stats.inf.toString().padStart(3, '0')}
                    </span>
                </div>
            </div>
        </div>
    );
};
