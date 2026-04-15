import React, { memo } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const SystemTerminal = memo(() => {
  const { systemLogs } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0d0d0f]">
      <div
        className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0"
        {...helpProps(
          'TERMINAL TÁCTICA: Monitoriza el flujo de datos del núcleo AI y eventos de sistema.'
        )}
      >
        <div className="flex items-center gap-2">
          <TerminalIcon className="text-blue-500" size={14} />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Log_de_Sistema.v16
          </span>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-4 min-h-0 bg-black/20">
        {systemLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3">
            <TerminalIcon size={32} className="text-slate-500" />
            <span className="uppercase font-bold tracking-widest text-[9px]">Kernel_Standby</span>
          </div>
        ) : (
          systemLogs.map((log) => (
            <div
              key={log.id}
              className="group flex flex-col gap-1.5 border-l border-white/10 pl-4 py-1 hover:border-blue-500/50 transition-all animate-in fade-in slide-in-from-left-2"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-600 font-bold tracking-tight">[{log.timestamp}]</span>
                <span
                  className={`px-1.5 py-0.5 rounded-sm font-bold text-[8px] uppercase tracking-widest border ${
                    log.type === 'ERROR'
                      ? 'bg-red-500/10 text-red-500 border-red-500/20'
                      : log.type === 'WARN'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : log.type === 'AI'
                          ? 'bg-blue-500/10 text-blue-500 border-blue-500'
                          : log.type === 'CORE'
                            ? 'bg-slate-800 text-slate-400 border-white/5'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {log.type}
                </span>
              </div>
              <span className="text-slate-400 break-words font-medium uppercase leading-relaxed tracking-tight">
                {log.content}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

SystemTerminal.displayName = 'SystemTerminal';
