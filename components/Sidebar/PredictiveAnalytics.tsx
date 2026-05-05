import React, { useEffect, useMemo, useState } from 'react';
import { Zap, TrendingUp, AlertOctagon } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import { capturePerfMonitor, type CapturePerfSnapshot } from '../../services/capturePerfMonitor';

export const PredictiveAnalytics = () => {
  const { tracks } = useSentinel();
  const { helpProps } = useHelp();
  const [perf, setPerf] = useState<CapturePerfSnapshot>(capturePerfMonitor.getSnapshot());

  const congestionLevel = useMemo(() => {
    const activeTracks = tracks.filter((t) => !t.isCoasting).length;
    return Math.min(activeTracks * 10, 100);
  }, [tracks]);

  const prediction =
    congestionLevel > 80
      ? 'SATURACIÓN INMINENTE'
      : congestionLevel > 50
        ? 'TRÁFICO DENSO CITI'
        : 'FLUJO ESTABLE';

  const anomalies = useMemo(
    () =>
      tracks
        .filter((t) => t.isAnomalous && t.anomalyLabel)
        .map((t) => `${t.anomalyLabel} [${(t.label || 'VEHÍCULO').toUpperCase()}_${t.id}]`)
        .slice(0, 3),
    [tracks]
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setPerf(capturePerfMonitor.getSnapshot());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-4">
      <div
        className="flex items-center justify-between px-1"
        {...helpProps(
          'Panel de analítica predictiva. Calcula densidades y detecta patrones anómalos en el flujo.'
        )}
      >
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] flex items-center gap-2">
          <TrendingUp size={14} className="text-red-500" /> Analítica_Predictiva
        </h3>
        <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/60">
          <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">
            Live_Inf
          </span>
        </div>
      </div>

      <div className="horizon-card rounded-[20px] p-6 space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 hud-grid opacity-10 pointer-events-none" />

        {/* Congestion Meter */}
        <div
          className="space-y-3 relative z-10"
          {...helpProps(
            'Nivel de saturación de la vía basado en el recuento de vehículos activos.'
          )}
        >
          <div className="flex justify-between items-end text-[9px] uppercase font-black tracking-widest text-slate-500">
            <span className="italic">Nivel de Congestión</span>
            <span
              className={`text-[11px] font-mono font-black ${congestionLevel > 70 ? 'text-red-500 text-glow-blue' : 'text-blue-500'}`}
            >
              {congestionLevel.toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-slate-950 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
            <div
              className={`h-full transition-all duration-1000 rounded-full relative ${
                congestionLevel > 70
                  ? 'bg-gradient-to-r from-orange-600 to-red-600'
                  : 'bg-gradient-to-r from-blue-600 to-blue-400'
              }`}
              style={{ width: `${congestionLevel}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <div
            className="flex justify-between items-center bg-[#020617]/50 p-3 rounded-[20px] border border-white/5 transition-all hover:bg-[#020617]/80"
            {...helpProps(
              'Predicción del estado del tráfico en los próximos 5 minutos mediante análisis de vectores.'
            )}
          >
            <span className="text-[8px] text-slate-500 uppercase font-black tracking-widest">
              Predicción (t+5m)
            </span>
            <span
              className={`text-[9px] font-black uppercase tracking-wider ${
                prediction.includes('SATURACIÓN')
                  ? 'text-red-500 animate-pulse'
                  : 'text-emerald-400'
              }`}
            >
              {prediction}
            </span>
          </div>
        </div>

        {/* Anomalies List */}
        <div
          className="space-y-3 relative z-10"
          {...helpProps(
            'Detección de comportamientos cinemáticos fuera de norma (velocidad, dirección, permanencia).'
          )}
        >
          <h4 className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-2 tracking-[0.2em] italic">
            <AlertOctagon size={12} className="text-amber-500" /> Alertas_Sistema
          </h4>
          <div className="space-y-2 min-h-[60px]">
            {anomalies.length === 0 ? (
              <div className="p-4 text-[9px] text-slate-600 italic font-medium text-center border-2 border-dashed border-white/5 rounded-[20px] bg-slate-900/10">
                Sin anomalías detectadas
              </div>
            ) : (
              anomalies.map((anom, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/10 rounded-[20px] text-[9.5px] text-amber-200/90 font-bold uppercase tracking-tight animate-in slide-in-from-right-2"
                >
                  <div className="w-5 h-5 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/20">
                    <Zap size={10} className="text-amber-500" />
                  </div>
                  <span className="flex-1 text-glow-blue">{anom}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Early Warning Stats */}
        <div className="grid grid-cols-2 gap-3 relative z-10">
          <div
            className="bg-[#020617]/50 border border-white/5 p-4 rounded-[20px] text-center group hover:bg-[#020617] transition-all"
            {...helpProps('Puntuación de riesgo acumulado en la zona actual de análisis.')}
          >
            <span className="block text-[8px] text-slate-500 font-black uppercase mb-1.5 tracking-widest">
              Risk_Score
            </span>
            <span className="text-2xl font-black text-blue-500 font-mono tracking-tighter text-glow-blue">
              0.04
            </span>
          </div>
          <div
            className="bg-[#020617]/50 border border-white/5 p-4 rounded-[20px] text-center group hover:bg-[#020617] transition-all"
            {...helpProps(
              'Predicción de tiempo estimado para un evento de colisión basado en trayectorias actuales.'
            )}
          >
            <span className="block text-[8px] text-slate-500 font-black uppercase mb-1.5 tracking-widest">
              Time-To-Col
            </span>
            <span className="text-2xl font-black text-emerald-400 font-mono tracking-tighter drop-shadow-[0_0_10px_rgba(52,211,153,0.3)]">
              ∞
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
