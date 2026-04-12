import React, { memo } from 'react';
import { Terminal } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const SystemTerminal = memo(() => {
  const { systemLogs } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <>
      <div
        className="p-3 border-b border-white/10 flex items-center justify-between bg-black/40 border-t border-white/10 shrink-0"
        {...helpProps(
          'TERMINAL TÁCTICA: Monitoriza el flujo de datos del núcleo AI y eventos de sistema.'
        )}
      >
        <div className="flex items-center gap-2">
          <Terminal className="text-cyan-500 animate-pulse" size={14} />
          <span className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">
            Command_Center.v16
          </span>
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-cyan-500 animate-ping" />
          <div className="w-1 h-1 rounded-full bg-cyan-500/30" />
        </div>
      </div>

      <div className="flex-1 bg-[#01040a] p-5 overflow-y-auto custom-scrollbar font-mono text-[10px] space-y-3 min-h-0 relative">
        {/* Background Grid */}
        <div className="absolute inset-0 hud-grid opacity-10 pointer-events-none" />

        {systemLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-3">
            <Terminal size={40} className="text-cyan-500 animate-pulse" />
            <span className="uppercase font-black tracking-[0.4em] text-[10px] italic animate-pulse">
              Iniciando_Kernel...
            </span>
          </div>
        ) : (
          systemLogs.map((log) => (
            <div
              key={log.id}
              className="group flex flex-col gap-1.5 border-l border-white/5 pl-4 py-0.5 hover:border-cyan-500/50 transition-all animate-in fade-in slide-in-from-left-4 duration-500 relative"
            >
              <div className="flex items-center gap-3">
                <span className="text-slate-600 font-black tracking-widest">[{log.timestamp}]</span>
                <span
                  className={`px-2 py-0.5 rounded-sm font-black text-[9px] uppercase tracking-[0.1em] shadow-sm ${
                    log.type === 'ERROR'
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-red-500/5'
                      : log.type === 'WARN'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-amber-500/5'
                        : log.type === 'AI'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-cyan-500/5'
                          : log.type === 'CORE'
                            ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-indigo-500/5'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-emerald-500/5'
                  }`}
                >
                  {log.type}
                </span>
              </div>
              <span className="text-slate-400 break-words font-semibold uppercase leading-[1.4] group-hover:text-cyan-100 transition-colors tracking-tight">
                <span className="text-cyan-500/50 group-hover:text-cyan-500 mr-1.5">❯</span>
                {log.content}
              </span>

              {/* Hover Highlight */}
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/[0.02] pointer-events-none transition-colors rounded-r-md" />
            </div>
          ))
        )}
      </div>
    </>
  );
});

SystemTerminal.displayName = 'SystemTerminal';
