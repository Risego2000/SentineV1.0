import React from 'react';
import { Cpu, Zap } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

const getStatusColor = (status: string | boolean): string => {
  if (status === 'ready' || status === true) return 'bg-emerald-500';
  if (status === 'error') return 'bg-red-500';
  if (status === 'loading') return 'bg-amber-500';
  return 'bg-slate-600';
};

const getBorderColor = (status: string | boolean): string => {
  if (status === 'ready' || status === true) return 'border-emerald-500/30 hover:border-emerald-500/50';
  if (status === 'error') return 'border-red-500/30 hover:border-red-500/50';
  if (status === 'loading') return 'border-amber-500/30 hover:border-amber-500/50';
  return 'border-slate-600/30 hover:border-slate-600/50';
};


const SystemCard = ({ title, status, code, detail, helpText }: any) => {
  const borderColor = getBorderColor(status);
  const statusColor = getStatusColor(status);

  return (
    <div
      className={`p-4 rounded-lg border transition-all duration-300 relative overflow-hidden group hover:bg-white/[0.05] ${borderColor} bg-gradient-to-br from-white/[0.03] to-white/[0.01]`}
    >
      <div className={`absolute top-0 left-0 w-full h-0.5 ${statusColor}`} />
      <div className={`absolute top-0 left-0 w-1 h-full ${statusColor} opacity-50`} />

      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 flex-1 leading-tight">
          {title}
        </span>
        <div className={`w-2 h-2 rounded-full transition-all ${statusColor} ${status === 'loading' ? 'animate-pulse' : ''}`} />
      </div>

      <div className="space-y-1.5">
        <span className="text-[9px] font-mono font-bold text-slate-200 block">
          {code}
        </span>
        <span className="text-[8px] font-semibold text-slate-500 block uppercase tracking-tight">
          {detail}
        </span>
      </div>
    </div>
  );
};

export const SystemStatus = () => {
  const { systemStatus } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <div className="space-y-4" id="section-status">
      <h3
        className="text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2"
        {...helpProps('Monitoriza el estado de salud de todos los subsistemas de Sentinel.')}
      >
        <Zap size={14} className="text-blue-500" /> Estado de Subsistemas
      </h3>
      <div className="horizon-card rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <SystemCard
            title="Visión Artificial"
            status={systemStatus.neural}
            code="NEURAL_SENTINEL_COCO"
            detail="TensorFlow+GPU"
          />
          <SystemCard
            title="Forense"
            status={systemStatus.forensic}
            code="GEMINI_1.4"
            detail="IA Peritaje"
          />
          <SystemCard
            title="OCR Matrícula"
            status={systemStatus.neural}
            code="PADDLE-CROP"
            detail="Reconocimiento"
          />
          <SystemCard
            title="Biónica"
            status={systemStatus.bionics}
            code="POSE_DETECTION"
            detail="Biomecánica"
          />
          <SystemCard
            title="Vectores"
            status={systemStatus.vector}
            code={systemStatus.vector === 'ready' ? 'ACTIVE' : 'IDLE'}
            detail="Malla Activa"
          />
          <SystemCard
            title="MediaPipe"
            status={systemStatus.mediapipeReady}
            code="WASM_TASKS"
            detail="Tiempo Real"
          />
        </div>
      </div>
    </div>
  );
};
