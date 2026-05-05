import React from 'react';
import { AlertTriangle, CheckCircle, Ban, Clock, AlertCircle, Shield, Zap } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const InfractionFeed = () => {
  const { logs, setSelectedLog, hasApiKey, isBatchMode, videoQueue, currentQueueIndex } =
    useSentinel();
  const { helpProps } = useHelp();

  const handleLogKeyDown = (log: any) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedLog(log);
    }
  };

  /**
   * Get priority badge styles and icon type
   */
  const getPriorityBadgeStyle = (priority?: string) => {
    switch (priority) {
      case 'CRÍTICA':
        return {
          bgColor: 'bg-red-600/15',
          borderColor: 'border-red-500/40',
          textColor: 'text-red-400',
          iconType: 'critical',
          label: 'CRÍTICA',
        };
      case 'ALTA':
        return {
          bgColor: 'bg-orange-600/15',
          borderColor: 'border-orange-500/40',
          textColor: 'text-orange-400',
          iconType: 'alert',
          label: 'ALTA',
        };
      case 'MEDIA-ALTA':
        return {
          bgColor: 'bg-yellow-600/15',
          borderColor: 'border-yellow-500/40',
          textColor: 'text-yellow-400',
          iconType: 'shield',
          label: 'MEDIA-ALTA',
        };
      case 'MEDIA':
        return {
          bgColor: 'bg-blue-600/15',
          borderColor: 'border-blue-500/40',
          textColor: 'text-blue-400',
          iconType: 'clock',
          label: 'MEDIA',
        };
      case 'BAJA':
        return {
          bgColor: 'bg-cyan-600/15',
          borderColor: 'border-cyan-500/40',
          textColor: 'text-cyan-400',
          iconType: 'zap',
          label: 'BAJA',
        };
      default:
        return {
          bgColor: 'bg-slate-600/15',
          borderColor: 'border-slate-500/40',
          textColor: 'text-slate-400',
          iconType: 'clock',
          label: 'DESCONOCIDA',
        };
    }
  };

  return (
    <>
      {!hasApiKey && (
        <div
          className="m-4 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-amber-200/80 flex gap-3 items-start"
          role="alert"
        >
          <AlertTriangle className="text-amber-500 shrink-0" size={16} />
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest">
              IA Forense Desactivada
            </p>
            <p className="text-[9px] leading-snug">
              Falta VITE_GOOGLE_GENAI_KEY. El peritaje automático está en modo lectura.
            </p>
          </div>
        </div>
      )}

      {isBatchMode && videoQueue.length > 0 && (
        <div className="mx-4 mb-3 px-4 py-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">
              Análisis en cola
            </span>
            <span className="text-[9px] text-blue-300/60 font-mono mt-0.5 uppercase flex flex-col gap-0.5">
              <span>
                Procesando video {currentQueueIndex + 1} de {videoQueue.length}
              </span>
              <span className="text-blue-400/80 truncate max-w-[180px]">
                {videoQueue[currentQueueIndex]?.name}
              </span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {videoQueue.length <= 10 ? (
              videoQueue.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                    idx === currentQueueIndex
                      ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] scale-125'
                      : idx < currentQueueIndex
                        ? 'bg-blue-900'
                        : 'bg-slate-800'
                  }`}
                />
              ))
            ) : (
              <span className="text-[10px] font-mono text-blue-500 font-bold">
                {Math.round(((currentQueueIndex + 1) / videoQueue.length) * 100)}%
              </span>
            )}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4" role="list">
        {logs.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl bg-[#020617]/40">
            <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest block">
              Scanner en Espera
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
              className="group cursor-pointer horizon-card hover:border-red-500/35 rounded-2xl overflow-hidden transition-all shadow-lg active:scale-[0.98] focus:outline-none"
              {...helpProps(
                `Vehículo ${log.plate || 'desconocido'}. Pulsa para abrir peritaje completo.`
              )}
            >
              <div className="relative h-32 w-full overflow-hidden bg-black/40">
                <img
                  src={
                    log.extraSnapshots && log.extraSnapshots[1]
                      ? `data:image/jpeg;base64,${log.extraSnapshots[1]}`
                      : log.image
                  }
                  alt={`Evidencia`}
                  className="w-full h-full object-contain opacity-70 group-hover:opacity-100 transition-all duration-500"
                  loading="lazy"
                />

                <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
                  {(() => {
                    const priorityStyle = getPriorityBadgeStyle(log.priority);
                    const renderPriorityIcon = () => {
                      switch (priorityStyle.iconType) {
                        case 'critical':
                          return <AlertCircle size={10} />;
                        case 'alert':
                          return <AlertTriangle size={10} />;
                        case 'shield':
                          return <Shield size={10} />;
                        case 'zap':
                          return <Zap size={10} />;
                        case 'clock':
                        default:
                          return <Clock size={10} />;
                      }
                    };
                    return (
                      <div
                        className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border flex items-center gap-1 ${priorityStyle.bgColor} ${priorityStyle.borderColor} ${priorityStyle.textColor}`}
                      >
                        {renderPriorityIcon()}
                        {priorityStyle.label}
                      </div>
                    );
                  })()}
                  <div
                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest border ${log.severity === 'CRITICAL' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}
                  >
                    {log.severity}
                  </div>
                  {log.validationStatus === 'validated' && (
                    <div className="px-1.5 py-0.5 bg-emerald-500 text-white text-[7px] font-bold uppercase tracking-widest rounded flex items-center gap-1">
                      <CheckCircle size={8} /> Validado
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-sm font-bold text-white font-mono tracking-tight uppercase">
                    {log.plate || 'SENT_IA'}
                  </span>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">
                    {log.videoTimeCode || log.time}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1 leading-relaxed uppercase font-medium">
                  {log.operativeCode || log.ruleCategory}
                </p>
                {log.fineAmount && (
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-cyan-400/70">Multa:</span>
                    <span className="font-mono font-bold text-cyan-300">{log.fineAmount}€</span>
                  </div>
                )}
                {log.pointsDeducted && (
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="text-orange-400/70">Puntos:</span>
                    <span className="font-mono font-bold text-orange-300">
                      -{Math.abs(log.pointsDeducted)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};
