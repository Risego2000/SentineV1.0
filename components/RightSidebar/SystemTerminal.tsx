import React, { memo } from 'react';
import { Terminal } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const SystemTerminal = memo(() => {
    const { systemLogs } = useSentinel();

    return (
        <>
            <div className="p-3 border-b border-white/10 flex items-center gap-2 bg-black/40 border-t border-white/10 shrink-0">
                <Terminal className="text-slate-400" size={16} />
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Log de Aplicación Monitorizado
                </span>
            </div>

            <div className="flex-1 bg-black p-4 overflow-y-auto custom-scrollbar font-mono text-[11px] space-y-2 min-h-0 shadow-inner">
                {systemLogs.map((log) => (
                    <div
                        key={log.id}
                        className="flex gap-3 leading-relaxed border-b border-white/10 pb-1 last:border-0 border-dashed border-white/10"
                    >
                        <span className="text-slate-600 shrink-0 select-none">[{log.timestamp}]</span>
                        <div className="flex flex-col">
                            <span
                                className={`font-bold text-[10px] uppercase tracking-wide mb-0.5 ${log.type === 'ERROR'
                                    ? 'text-red-400'
                                    : log.type === 'WARN'
                                        ? 'text-amber-400'
                                        : log.type === 'AI'
                                            ? 'text-cyan-400'
                                            : log.type === 'CORE'
                                                ? 'text-purple-400'
                                                : 'text-emerald-400'
                                    }`}
                            >
                                {log.type}
                            </span>
                            <span className="text-slate-200 break-words font-medium uppercase">{log.content}</span>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
});

SystemTerminal.displayName = 'SystemTerminal';
