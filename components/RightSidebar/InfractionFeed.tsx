import React from 'react';
import { FileText } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

import { TacticalMetrics } from './TacticalMetrics';

export const InfractionFeed = () => {
    const { logs, setSelectedLog } = useSentinel();
    const { helpProps } = useHelp();

    return (
        <>
            <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-red-950/20 shrink-0"
                {...helpProps("Flujo de infracciones confirmadas por la Unidad Forense Gemini IA.")}
            >
                <FileText className="text-red-400" size={18} />
                <span className="text-sm font-bold text-red-100 uppercase tracking-wider">
                    Infracciones Detectadas
                </span>
            </div>

            <TacticalMetrics />

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 border-b border-white/10 min-h-0">
                {logs.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-white/10 rounded-xl">
                        <span className="text-xs text-slate-500 italic block uppercase">Sin infracciones registradas</span>
                        <span className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">
                            Sistema Monitorizando
                        </span>
                    </div>
                ) : (
                    logs.map((log) => (
                        <div
                            key={log.id}
                            onClick={() => setSelectedLog(log)}
                            className="group cursor-pointer bg-slate-900/50 hover:bg-slate-800 border border-white/5 hover:border-red-500/30 rounded-xl overflow-hidden transition-all shadow-lg hover:shadow-red-900/10"
                            {...helpProps(`Vehículo ${log.plate || 'desconocido'}. Pulsa para abrir peritaje completo.`)}
                        >
                            <div className="relative h-32 w-full">
                                <img
                                    src={log.image}
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                />
                                <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase rounded-md shadow-sm">
                                    {log.severity}
                                </div>
                            </div>
                            <div className="p-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-bold text-white font-mono tracking-tight">
                                        {log.plate || 'NO_PLATE'}
                                    </span>
                                    <span className="text-[10px] text-slate-400">{log.time}</span>
                                </div>
                                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed uppercase">
                                    {log.description}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </>
    );
};
