import React, { memo } from 'react';
import { Terminal } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const SystemTerminal = memo(() => {
    const { systemLogs } = useSentinel();
    const { helpProps } = useHelp();

    return (
        <>
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/40 border-t border-white/10 shrink-0"
                {...helpProps("TERMINAL TÁCTICA: Monitoriza el flujo de datos del núcleo AI y eventos de sistema.")}
            >
                <div className="flex items-center gap-2">
                    <Terminal className="text-cyan-500 animate-pulse" size={14} />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                        Command_Center.v16
                    </span>
                </div>
                <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-cyan-500 animate-ping" />
                    <div className="w-1 h-1 rounded-full bg-cyan-500/30" />
                </div>
            </div>

            <div className="flex-1 bg-[#01030d] p-4 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-2 min-h-0">
                {systemLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2">
                        <Terminal size={32} />
                        <span className="uppercase font-bold tracking-widest text-[9px]">Sincronizando_Terminal...</span>
                    </div>
                ) : (
                    systemLogs.map((log) => (
                        <div
                            key={log.id}
                            className="group flex flex-col gap-1 border-l-2 border-white/5 pl-3 py-1 hover:border-cyan-500/50 transition-colors animate-in fade-in slide-in-from-left-2 duration-300"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-slate-600 text-[9px] shrink-0 font-bold">[{log.timestamp}]</span>
                                <span
                                    className={`px-1.5 py-0.5 rounded-[4px] font-black text-[8px] uppercase tracking-tighter ${log.type === 'ERROR'
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        : log.type === 'WARN'
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                            : log.type === 'AI'
                                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                                : log.type === 'CORE'
                                                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        }`}
                                >
                                    {log.type}
                                </span>
                            </div>
                            <span className="text-slate-400 break-words font-medium uppercase leading-tight group-hover:text-slate-200 transition-colors">
                                {log.content}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </>
    );
});

SystemTerminal.displayName = 'SystemTerminal';
