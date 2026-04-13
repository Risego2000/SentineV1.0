import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

import { TacticalMetrics } from './TacticalMetrics';

export const InfractionFeed = () => {
  const { logs, setSelectedLog, hasApiKey } = useSentinel();
  const { helpProps } = useHelp();

  const handleLogKeyDown = (log: any) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedLog(log);
    }
  };

  return (
    <>
      {!hasApiKey && (
        <div
          className="p-4 border-b border-amber-500/30 bg-amber-950/40 text-amber-100 flex gap-3 items-start"
          role="alert"
          aria-live="assertive"
        >
          <AlertTriangle className="text-amber-300 shrink-0" size={18} aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-black uppercase tracking-wider">Gemini API Key requerida</p>
            <p className="text-[11px] text-amber-200/80 leading-snug">
              Configura{' '}
              <code className="bg-amber-900/50 px-1 py-0.5 rounded">VITE_GOOGLE_GENAI_KEY</code> en{' '}
              <code className="bg-amber-900/50 px-1 py-0.5 rounded">.env.local</code> y reinicia la
              app para habilitar auditoría forense.
            </p>
          </div>
        </div>
      )}

      <TacticalMetrics />

      <div
        className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 border-b border-white/10 min-h-0"
        role="list"
        aria-label="Lista de infracciones detectadas"
      >
        {logs.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-white/5 rounded-[32px] bg-slate-900/20">
            <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center mx-auto mb-4 bg-slate-950 shadow-inner">
              <div className="w-2 h-2 bg-cyan-500 rounded-full animate-ping" aria-hidden="true" />
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
              role="listitem"
              tabIndex={0}
              onClick={() => setSelectedLog(log)}
              onKeyDown={handleLogKeyDown(log)}
              className="group cursor-pointer glass-card hover:bg-slate-800/80 border-white/5 hover:border-red-500/40 rounded-[24px] overflow-hidden transition-all shadow-xl hover:-translate-y-1 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              {...helpProps(
                `Vehículo ${log.plate || 'desconocido'}. Pulsa para abrir peritaje completo.`
              )}
              aria-label={`Infracción: ${log.plate || 'Sin placa'}, ${log.description}`}
            >
              <div className="relative h-36 w-full overflow-hidden">
                <img
                  src={
                    log.extraSnapshots && log.extraSnapshots[1]
                      ? `data:image/jpeg;base64,${log.extraSnapshots[1]}`
                      : log.image
                  }
                  alt={`Evidencia vehículo ${log.plate || 'desconocido'}`}
                  className="w-full h-full object-contain opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700 bg-black/40"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-60"
                  aria-hidden="true"
                />
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
