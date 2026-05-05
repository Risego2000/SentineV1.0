import React, { useEffect, useState } from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import { useRealtimeStore } from '../../stores/realtimeStore';
import { capturePerfMonitor, type CapturePerfSnapshot } from '../../services/capturePerfMonitor';
import { Radio } from 'lucide-react';

export const TacticalMetrics = () => {
  const { stats } = useSentinel();
  const { helpProps } = useHelp();
  const realtimeStats = useRealtimeStore((s) => s.stats);
  const connected = useRealtimeStore((s) => s.connected);
  const lastEventType = useRealtimeStore((s) => s.lastEventType);
  const history = useRealtimeStore((s) => s.history);
  const [perf, setPerf] = useState<CapturePerfSnapshot>(capturePerfMonitor.getSnapshot());

  const detCount = connected && realtimeStats.detections > 0 ? realtimeStats.detections : stats.det;
  const infCount =
    connected && realtimeStats.infractions > 0 ? realtimeStats.infractions : stats.inf;
  const updatedAt = realtimeStats.updatedAt
    ? new Date(realtimeStats.updatedAt).toLocaleTimeString()
    : '--:--:--';

  useEffect(() => {
    const id = window.setInterval(() => {
      setPerf(capturePerfMonitor.getSnapshot());
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="space-y-4 shrink-0">
      <div
        className="flex items-center justify-between px-1"
        {...helpProps('Estado de conectividad del canal WebSocket en tiempo real para este visor.')}
      >
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2 text-slate-500">
          <Radio size={14} className={connected ? 'text-red-500' : 'text-slate-600'} />
          {connected ? 'Realtime WS ON' : 'Realtime WS OFF'}
        </h3>
        <div className="flex items-center gap-1.5 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/60">
          <span
            className="text-[8px] font-black text-red-500 uppercase tracking-widest font-mono"
            {...helpProps('Hora de última actualización recibida desde el backend en tiempo real.')}
          >
            {updatedAt}
          </span>
        </div>
      </div>

      <div className="p-4 bg-white/[0.01] border border-white/5 rounded-[20px]">
      <div className="grid grid-cols-2 gap-3">
        {/* Módulo Detecciones */}
        <div
          className="group relative overflow-hidden horizon-card rounded-[20px] p-4 flex flex-col justify-center items-end transition-all hover:bg-white/[0.03] cursor-default"
          {...helpProps('Contador de vehículos y objetos detectados en la escena actual.')}
        >
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 w-full text-right">
            Detecciones
          </span>
          <span className="text-3xl font-bold text-blue-500 font-mono leading-none tracking-tighter">
            {detCount.toString().padStart(3, '0')}
          </span>
        </div>

        {/* Módulo Sanciones */}
        <div
          className="group relative overflow-hidden horizon-card rounded-[20px] p-4 flex flex-col justify-center items-end transition-all hover:bg-white/[0.03] cursor-default"
          {...helpProps('Contador de infracciones confirmadas y expedientes forenses generados.')}
        >
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 w-full text-right">
            Sanciones
          </span>
          <span className="text-3xl font-bold text-red-500 font-mono leading-none tracking-tighter">
            {infCount.toString().padStart(3, '0')}
          </span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div
          className="group relative overflow-hidden horizon-card rounded-[20px] p-3 flex flex-col justify-center items-end transition-all hover:bg-white/[0.03] cursor-default"
          {...helpProps('Último tipo de evento recibido y número de cámaras activas reportadas.')}
        >
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 w-full text-right">
            Evento / Cámaras
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase leading-none">
            {lastEventType || 'NONE'}
          </span>
          <span className="mt-1 text-[10px] font-mono font-bold text-blue-400 leading-none">
            CAM {realtimeStats.activeCameras || 0}
          </span>
        </div>

        <div
          className="group relative overflow-hidden horizon-card rounded-[20px] p-3 flex flex-col justify-center items-end transition-all hover:bg-white/[0.03] cursor-default"
          {...helpProps('Resumen histórico reciente de detecciones e infracciones del stream activo.')}
        >
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1 w-full text-right">
            Histórico
          </span>
          <span className="text-[10px] font-mono font-bold text-slate-300 uppercase leading-none">
            {history.length
              ? `${history[Math.max(0, history.length - 1)].detections} DET`
              : 'NO DATA'}
          </span>
          <span className="mt-1 text-[10px] font-mono font-bold text-red-400 leading-none">
            {history.length
              ? `${history[Math.max(0, history.length - 1)].infractions} INF`
              : '-- INF'}
          </span>
        </div>
      </div>

      {perf.enabled && (
        <div className="mt-3 border-t border-white/5 pt-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-blue-500 mb-2">
            Capture Perf Debug
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5"
              {...helpProps('Latencia total del último ciclo de captura de evidencia.')}
            >
              <div className="text-[8px] uppercase tracking-wider text-slate-500">Last</div>
              <div className="text-[11px] font-mono font-bold text-white">
                {perf.last ? `${perf.last.totalMs.toFixed(1)}ms` : '--'}
              </div>
            </div>
            <div
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5"
              {...helpProps('Promedio de latencia de captura de evidencia desde el inicio de sesión.')}
            >
              <div className="text-[8px] uppercase tracking-wider text-slate-500">Avg</div>
              <div className="text-[11px] font-mono font-bold text-blue-400">
                {perf.count ? `${perf.avgTotalMs.toFixed(1)}ms` : '--'}
              </div>
            </div>
            <div
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5"
              {...helpProps('Peor latencia registrada en captura de evidencia.')}
            >
              <div className="text-[8px] uppercase tracking-wider text-slate-500">Peak</div>
              <div className="text-[11px] font-mono font-bold text-amber-400">
                {perf.count ? `${perf.maxTotalMs.toFixed(1)}ms` : '--'}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[8px] font-mono uppercase tracking-wider text-slate-600">
            Samples: {perf.count} · Label: {perf.last?.label || 'N/A'} · Track:{' '}
            {perf.last?.trackId ?? '-'}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
