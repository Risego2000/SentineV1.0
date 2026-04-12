import React from 'react';
import { AlertTriangle, FileText } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

import { TacticalMetrics } from './TacticalMetrics';

export const InfractionFeed = () => {
  const { logs, setSelectedLog, hasApiKey } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <>
      {!hasApiKey && (
        <div className="p-4 border-b border-amber-500/30 bg-amber-950/40 text-amber-100 flex gap-3 items-start">
          <AlertTriangle className="text-amber-300" size={18} />
          <div className="space-y-1">
            <p className="text-sm font-black uppercase tracking-wider">Gemini API Key requerida</p>
            <p className="text-[11px] text-amber-200/80 leading-snug">
              Configura <code>VITE_GOOGLE_GENAI_KEY</code> en <code>.env.local</code> y reinicia la
              app para habilitar auditoría forense.
            </p>
          </div>
        </div>
      )}

      <div
        className="p-4 border-b border-white/10 flex items-center gap-2 bg-red-950/20 shrink-0"
        {...helpProps('Flujo de infracciones confirmadas por la Unidad Forense Gemini IA.')}
      >
        <FileText className="text-red-400" size={18} />
        <span className="text-sm font-bold text-red-100 uppercase tracking-wider">
          Infracciones Detectadas
        </span>
      </div>

      <TacticalMetrics />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 border-b border-white/10 min-h-0">
        {logs.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-[32px] bg-slate-900/20">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-4 bg-slate-950 shadow-inner">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping" />
            </div>
            <span className="text-xs text-slate-500 font-black uppercase tracking-[0.3em] block">
              Scanner_Activo
            </span>
            <span className="text-[10px] text-slate-600 uppercase tracking-widest mt-1 block italic">
              A la espera de objetivos
            </span>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="group cursor-pointer glass-card hover:bg-slate-800/80 border-white/5 hover:border-red-500/40 rounded-[24px] overflow-hidden transition-all shadow-xl hover:-translate-y-1 active:scale-95"
              {...helpProps(
                `Vehículo ${log.plate || 'desconocido'}. Pulsa para abrir peritaje completo.`
              )}
            >
              <div className="relative h-36 w-full overflow-hidden">
                <img
                  src={
                    log.extraSnapshots && log.extraSnapshots[1]
                      ? `data:image/jpeg;base64,${log.extraSnapshots[1]}`
                      : log.image
                  }
                  className="w-full h-full object-contain opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 bg-black/40"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60" />
                <div className="absolute top-3 right-3 px-3 py-1 bg-red-600/90 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg border border-white/20 backdrop-blur-sm">
                  {log.severity}
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest drop-shadow-md">
                    EVENTO_FORENSE
                  </span>
                </div>
              </div>
              <div className="p-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-lg font-black text-white font-mono tracking-tighter text-glow-cyan">
                    {log.plate || 'SENT_IA'}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md uppercase tracking-tighter">
                      V: {log.videoTimeCode || log.time}
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">
                      L: {log.localTime?.split(' ')[1] || log.time}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed uppercase italic font-medium">
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
