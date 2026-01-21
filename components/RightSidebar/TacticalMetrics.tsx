import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';

export const TacticalMetrics = () => {
    const { stats } = useSentinel();

    return (
        <div className="p-4 bg-slate-900/60 border-b border-white/10 space-y-3 shrink-0">
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 p-4 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-cyan-500/20 transition-all">
                    <span className="text-[9px] text-slate-500 block uppercase mb-2 font-black tracking-wider">
                        Total Detecciones
                    </span>
                    <span className="text-3xl font-black text-cyan-400 leading-none font-mono tracking-tighter">
                        {stats.det.toString().padStart(3, '0')}
                    </span>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                </div>
                <div className="bg-black/40 p-4 rounded-xl border border-white/10 shadow-lg relative overflow-hidden group hover:border-red-500/20 transition-all">
                    <span className="text-[9px] text-slate-500 block uppercase mb-2 font-black tracking-wider">
                        Total Sanciones
                    </span>
                    <span className="text-3xl font-black text-red-500 leading-none font-mono tracking-tighter">
                        {stats.inf.toString().padStart(3, '0')}
                    </span>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                </div>
            </div>
        </div>
    );
};
