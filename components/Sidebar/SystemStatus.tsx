import React from 'react';
import { Cpu } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const SystemStatus = () => {
  const { systemStatus } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <div className="space-y-3">
      <h3
        className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
        {...helpProps('Monitoriza el estado de salud de todos los subsistemas de Sentinel.')}
      >
        <Cpu size={14} className="text-cyan-500" /> Núcleo Operativo
      </h3>
      <div className="glass-card rounded-[24px] p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 hud-grid opacity-10 pointer-events-none" />

        <div className="grid grid-cols-2 gap-4 relative z-10">
          {/* NÚCLEO NEURONAL (VERDE) */}
          <div
            className="col-span-2 p-4 bg-slate-950/40 rounded-2xl border border-white/5 space-y-3 relative overflow-hidden group transition-all hover:bg-slate-900/60"
            {...helpProps(
              'Motor de detección MediaPipe. Indica si la visión artificial está procesando frames.'
            )}
          >
            <div className="absolute top-0 left-0 w-1.5 h-full bg-green-500/20 group-hover:bg-green-500 transition-all duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Núcleo Detección
              </span>
              <div className="relative">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${systemStatus.neural === 'ready' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.8)]' : 'bg-amber-500 animate-pulse'}`}
                />
                {systemStatus.neural === 'ready' && (
                  <div className="absolute -inset-1 border border-green-500/50 rounded-full animate-ping opacity-20" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-green-500/10 flex items-center justify-center border border-green-500/20">
                <span className="text-[10px] font-black text-green-500 animate-pulse">AI</span>
              </div>
              <span className="text-sm font-mono text-cyan-400 font-black italic tracking-wider text-glow-cyan">
                NEURAL_CORE_V1.1
              </span>
            </div>
          </div>

          {/* IA FORENSE (MORADO) */}
          <div
            className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-slate-900/60"
            {...helpProps(
              'Conexión con Gemini AI. Verifica si el peritaje forense está disponible.'
            )}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/20 group-hover:bg-purple-500 transition-all duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 leading-none">
                Peritaje
              </span>
              <div
                className={`w-2 h-2 rounded-full ${systemStatus.forensic === 'ready' ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]' : 'bg-slate-800'}`}
              />
            </div>
            <span className="text-xs font-black text-purple-400 italic block truncate font-mono uppercase tracking-tighter">
              GEMINI_FLASH
            </span>
          </div>

          {/* SUBSISTEMAS (AZUL) */}
          <div
            className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-slate-900/60"
            {...helpProps('Estado del motor vectorial y la malla de geometría activa.')}
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/20 group-hover:bg-cyan-500 transition-all duration-500" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 leading-none">
                Vectores
              </span>
              <div className="flex gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${systemStatus.vector === 'ready' ? 'bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.8)]' : 'bg-slate-800'}`}
                />
                <div className="w-2 h-2 rounded-full bg-slate-900/50 border border-white/5" />
              </div>
            </div>
            <span className="text-xs font-black text-cyan-400 italic block truncate font-mono uppercase tracking-tighter">
              MESH: {systemStatus.vector === 'ready' ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
