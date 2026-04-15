import React from 'react';
import { Cpu } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const SystemStatus = () => {
  const { systemStatus } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <div className="space-y-4 mb-4" id="section-status">
      <h3
        className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2"
        {...helpProps('Monitoriza el estado de salud de todos los subsistemas de Sentinel.')}
      >
        <Cpu size={11} className="text-blue-500" /> Estado de Subsistemas
      </h3>
      <div className="horizon-card rounded-xl p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2 relative z-10">
          {/* NÚCLEO NEURONAL */}
          <div
            className="col-span-2 p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps(
              'Motor de detección MediaPipe. Indica si la visión artificial está procesando frames.'
            )}
          >
            <div
              className={`absolute top-0 left-0 w-1 h-full transition-all duration-500 ${systemStatus.neural === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'}`}
            />
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                Visión Artificial
              </span>
              <div className="relative">
                <div
                  className={`w-2 h-2 rounded-full ${systemStatus.neural === 'ready' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[8px] font-mono text-blue-500 font-bold uppercase tracking-tight">
                NEURAL_CORE_V1.1
              </span>
            </div>
          </div>

          {/* IA FORENSE */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps(
              'Conexión con Gemini AI. Verifica si el peritaje forense está disponible.'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 leading-none">
                Forense
              </span>
              <div
                className={`w-1.5 h-1.5 rounded-full ${systemStatus.forensic === 'ready' ? 'bg-blue-500' : 'bg-slate-700'}`}
              />
            </div>
            <span className="text-[8px] font-black text-slate-300 block truncate font-mono uppercase tracking-tighter">
              GEMINI_L4
            </span>
          </div>

          {/* SUBSISTEMAS */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps('Estado del motor vectorial y la malla de geometría activa.')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 leading-none">
                Vectores
              </span>
              <div
                className={`w-1.5 h-1.5 rounded-full ${systemStatus.vector === 'ready' ? 'bg-blue-500' : 'bg-slate-700'}`}
              />
            </div>
            <span className="text-[8px] font-black text-slate-300 block truncate font-mono uppercase tracking-tighter">
              {systemStatus.vector === 'ready' ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
