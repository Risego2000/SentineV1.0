import React from 'react';
import { Cpu } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const SystemStatus = () => {
    const { systemStatus, statusLabel } = useSentinel();

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <Cpu size={14} className="text-cyan-500" /> Núcleo Operativo
            </h3>
            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4">
                <div className="grid grid-cols-2 gap-3">
                    {/* NÚCLEO NEURONAL GOOGLE */}
                    <div className="col-span-2 p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Núcleo Neuronal Google
                            </span>
                            <div
                                className={`w-1.5 h-1.5 rounded-full ${systemStatus.neural === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-bounce'
                                    }`}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-cyan-400 font-bold italic">
                                MEDIAPIPE_X86_64
                            </span>
                            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 tracking-tighter">
                                {statusLabel}
                            </span>
                        </div>
                    </div>

                    {/* IA FORENSE (AUDITORÍA) */}
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                IA Forense
                            </span>
                            <div
                                className={`w-1.5 h-1.5 rounded-full ${systemStatus.forensic === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'
                                    }`}
                            />
                        </div>
                        <span className="text-[9px] font-mono text-white italic block truncate">
                            {systemStatus.forensic === 'ready' ? 'FLASH_ACTIVO' : 'DESCONECTADO'}
                        </span>
                    </div>

                    {/* MOTOR VECTORIAL (ESPACIAL) */}
                    <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                Motor Vect
                            </span>
                            <div
                                className={`w-1.5 h-1.5 rounded-full ${systemStatus.vector === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'
                                    }`}
                            />
                        </div>
                        <span className="text-[9px] font-mono text-white italic block truncate">
                            {systemStatus.vector === 'ready' ? 'VECT_ACTIVO' : 'ESPERANDO'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
