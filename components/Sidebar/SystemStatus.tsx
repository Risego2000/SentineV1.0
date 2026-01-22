import React from 'react';
import { Cpu } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const SystemStatus = () => {
    const { systemStatus } = useSentinel();
    const { helpProps } = useHelp();

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
                {...helpProps("Monitoriza el estado de salud de todos los subsistemas de Sentinel.")}
            >
                <Cpu size={14} className="text-cyan-500" /> Núcleo Operativo
            </h3>
            <div className="bg-[#02040a] border border-white/10 rounded-[20px] p-4 shadow-xl">
                <div className="grid grid-cols-2 gap-3">
                    {/* NÚCLEO NEURONAL (VERDE) */}
                    <div className="col-span-2 p-3 bg-[#0a0f18] rounded-xl border border-white/5 space-y-2 relative overflow-hidden group"
                        {...helpProps("Motor de detección MediaPipe. Indica si la visión artificial está procesando frames.")}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-green-500/50 group-hover:bg-green-500 transition-colors" />
                        <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                Núcleo Detección
                            </span>
                            <div className={`w-1.5 h-1.5 rounded-full ${systemStatus.neural === 'ready' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-amber-500'}`} />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-cyan-400 font-bold italic tracking-tight">
                                NEURAL_SENTINEL_V11
                            </span>
                        </div>
                    </div>

                    {/* IA FORENSE (MORADO) */}
                    <div className="p-3 bg-[#0a0f18] rounded-xl border border-white/5 space-y-1 relative overflow-hidden group"
                        {...helpProps("Conexión con Gemini AI. Verifica si el peritaje forense está disponible.")}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/50 group-hover:bg-purple-500 transition-colors" />
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                Auditoría IA
                            </span>
                            <div className={`w-1.5 h-1.5 rounded-full ${systemStatus.forensic === 'ready' ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'bg-slate-700'}`} />
                        </div>
                        <span className="text-[9px] font-mono text-white italic block truncate font-bold text-amber-500/90">
                            GEMINI PRO
                        </span>
                    </div>

                    {/* SUBSISTEMAS (AZUL) */}
                    <div className="p-3 bg-[#0a0f18] rounded-xl border border-white/5 space-y-1 relative overflow-hidden group"
                        {...helpProps("Estado del motor vectorial y la malla de geometría activa.")}
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 group-hover:bg-cyan-500 transition-colors" />
                        <div className="flex items-center justify-between">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                                subsistemas
                            </span>
                            <div className="flex gap-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${systemStatus.vector === 'ready' ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-slate-700'}`} />
                                <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                            </div>
                        </div>
                        <span className="text-[9px] font-mono text-white italic block truncate font-bold">
                            VECTOR: {systemStatus.vector === 'ready' ? 'ON' : 'PEND'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
