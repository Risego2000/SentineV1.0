import React from 'react';
import { Terminal, AlertTriangle, CheckCircle, Info, Cpu, FileText } from 'lucide-react';
import { SystemLog, InfractionLog } from '../types';

interface RightSidebarProps {
    logs: InfractionLog[];
    systemLogs: SystemLog[];
    setSelectedLog: (log: InfractionLog | null) => void;
}

export const RightSidebar = ({ logs, systemLogs, setSelectedLog }: RightSidebarProps) => {
    return (
        <aside className="w-80 border-l border-white/10 flex flex-col bg-[#020617]/95 z-50 h-full shrink-0">

            {/* Header Logs Sanciones */}
            <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-red-950/20 shrink-0">
                <FileText className="text-red-400" size={18} />
                <span className="text-sm font-bold text-red-100 uppercase tracking-wider">Infracciones Detectadas (Resultados)</span>
            </div>

            {/* Lista Infracciones */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 border-b border-white/10 min-h-0">
                {logs.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-white/10 rounded-xl">
                        <span className="text-xs text-slate-500 italic block">Sin infracciones registradas</span>
                        <span className="text-[10px] text-slate-600 uppercase tracking-widest mt-1">Sistema Monitorizando</span>
                    </div>
                ) : (
                    logs.map(log => (
                        <div key={log.id} onClick={() => setSelectedLog(log)} className="group cursor-pointer bg-slate-900/50 hover:bg-slate-800 border border-white/5 hover:border-red-500/30 rounded-xl overflow-hidden transition-all shadow-lg hover:shadow-red-900/10">
                            <div className="relative h-32 w-full">
                                <img src={log.image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase rounded-md shadow-sm">
                                    {log.severity}
                                </div>
                            </div>
                            <div className="p-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-sm font-bold text-white font-mono tracking-tight">{log.plate || 'NO_PLATE'}</span>
                                    <span className="text-[10px] text-slate-400">{log.time}</span>
                                </div>
                                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{log.description}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Header System Logs */}
            <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-black/40 border-t border-white/10 shrink-0">
                <Terminal className="text-slate-400" size={16} />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Log de Aplicación Monitorizado</span>
            </div>

            {/* System Terminal */}
            <div className="flex-1 bg-[#050b14] p-4 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-2 min-h-0 shadow-inner">
                {systemLogs.map((log) => (
                    <div key={log.id} className="flex gap-3 leading-relaxed border-b border-white/10 pb-1 last:border-0 border-dashed border-white/10">
                        <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                        <div className="flex flex-col">
                            <span className={`font-bold text-[10px] uppercase tracking-wide mb-0.5 ${log.type === 'ERROR' ? 'text-red-400' :
                                log.type === 'WARN' ? 'text-amber-400' :
                                    log.type === 'AI' ? 'text-cyan-400' :
                                        log.type === 'CORE' ? 'text-purple-400' : 'text-emerald-400'
                                }`}>
                                {log.type}
                            </span>
                            <span className="text-slate-300/90 break-words">{log.content}</span>
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
};
