import React from 'react';
import { Cpu, Zap } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

const getStatusColor = (status: string | boolean): string => {
  if (status === 'ready' || status === true) return 'bg-blue-500';
  if (status === 'error') return 'bg-red-500';
  if (status === 'loading') return 'bg-amber-500';
  return 'bg-slate-600';
};

const getBorderColor = (status: string | boolean): string => {
  if (status === 'ready' || status === true)
    return 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]';
  if (status === 'error') return 'bg-red-500/10 border-red-500/50 text-red-400';
  if (status === 'loading') return 'bg-amber-500/10 border-amber-500/50 text-amber-400';
  return 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300';
};

const SystemCard = ({ title, status, code, detail, helpProps }: any) => {
  const borderColor = getBorderColor(status);
  const statusColor = getStatusColor(status);

  return (
    <div
      className={`p-4 rounded-[20px] border transition-all duration-300 relative overflow-hidden group ${borderColor}`}
      {...helpProps}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex-1 leading-tight">
          {title}
        </span>
        <div
          className={`w-2 h-2 rounded-full transition-all ${statusColor} ${status === 'loading' ? 'animate-pulse' : ''}`}
          title={status === 'ready' || status === true ? 'Carga correcta' : 'Estado del módulo'}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-[9px] font-mono font-bold text-slate-200 block">{code}</span>
        <span className="text-[8px] font-semibold text-slate-500 block uppercase tracking-tight">
          {detail}
        </span>
      </div>
    </div>
  );
};

export const SystemStatus = () => {
  const { systemStatus } = useSentinel();
  const { helpProps: withHelp } = useHelp();

  return (
    <div className="space-y-4" id="section-status">
      <h3
        className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2"
        {...withHelp('Monitoriza el estado de salud de todos los subsistemas de Sentinel.')}
      >
        <Zap size={14} className="text-blue-500" /> Estado de Subsistemas
      </h3>
      <div className="horizon-card rounded-[20px] p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SystemCard
            title="Visión Artificial"
            status={systemStatus.neural}
            code="COCO-SSD"
            detail="TensorFlow + WebGL"
            helpProps={withHelp(
              'Detección de objetos en tiempo real con COCO-SSD sobre TensorFlow acelerado por WebGL.'
            )}
          />
          <SystemCard
            title="Forense"
            status={systemStatus.forensic}
            code="GEMINI 2.5 FLASH"
            detail="PERITAJE Y RESPALDO OCR"
            helpProps={withHelp(
              'Motor de análisis forense para preinforme y revisión IA del expediente.'
            )}
          />
          <SystemCard
            title="OCR Matrícula"
            status={systemStatus.neural}
            code="PLATE RECOGNIZER + PADDLE + GEMINI"
            detail="PRINCIPAL + RESPALDO + CONFIRMACIÓN"
            helpProps={withHelp(
              'OCR jerárquico: Plate Recognizer principal, PaddleOCR de respaldo y Gemini como confirmación/fallback final.'
            )}
          />
          <SystemCard
            title="Biónica"
            status={systemStatus.bionics}
            code="POSE LANDMARKER"
            detail="MediaPipe Tasks"
            helpProps={withHelp('Análisis cinemático mediante Pose Landmarker de MediaPipe Tasks.')}
          />
          <SystemCard
            title="Tracking"
            status={systemStatus.vector}
            code="BYTE TRACKER"
            detail="Multi-Objeto"
            helpProps={withHelp(
              'Seguimiento persistente de múltiples vehículos para mantener IDs estables por track.'
            )}
          />
          <SystemCard
            title="MediaPipe"
            status={systemStatus.mediapipeReady}
            code="WASM TASKS"
            detail="Tiempo Real"
            helpProps={withHelp(
              'Runtime WebAssembly de MediaPipe Tasks para ejecución local en tiempo real.'
            )}
          />
        </div>
      </div>
    </div>
  );
};
