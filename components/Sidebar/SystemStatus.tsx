import React from 'react';
import { Cpu } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

const getStatusColor = (status: string | boolean): string => {
  if (status === 'ready' || status === true) return 'bg-emerald-500'; // Verde
  if (status === 'error') return 'bg-red-500'; // Rojo
  if (status === 'loading') return 'bg-amber-500'; // Amarillo
  return 'bg-slate-600'; // Gris (pending/false/idle)
};

const getStatusLabel = (status: string): string => {
  if (status === 'ready') return '✓ LISTO';
  if (status === 'loading') return '⟳ CARGANDO';
  if (status === 'error') return '✗ ERROR';
  return '— PENDIENTE';
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
        <Cpu size={14} className="text-blue-500" /> Estado de Subsistemas
      </h3>
      <div className="horizon-card rounded-xl p-5 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {/* VISIÓN ARTIFICIAL - COCO-SSD */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps(
              'Motor de detección TensorFlow COCO-SSD (41% mAP COCO, 90 clases). Visión artificial acelerada por GPU con WebGL. Tiempo real en navegador.'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                Visión Artificial (COCO-SSD)
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[7px] font-bold uppercase tracking-tight ${
                  systemStatus.neural === 'ready' ? 'text-emerald-500' :
                  systemStatus.neural === 'error' ? 'text-red-500' :
                  'text-amber-500'
                }`}>
                  {getStatusLabel(systemStatus.neural)}
                </span>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${getStatusColor(systemStatus.neural)} ${
                    systemStatus.neural === 'loading' ? 'animate-pulse' : ''
                  }`}
                />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 block truncate font-mono uppercase tracking-tighter">
              NEURAL_SENTINEL_COCO
            </span>
            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight">
              TensorFlow+GPU
            </span>
          </div>

          {/* FORENSE */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps(
              'Conexión con Gemini AI. Verifica si el peritaje forense está disponible.'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                Forense
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[7px] font-bold uppercase tracking-tight ${
                  systemStatus.forensic === 'ready' ? 'text-emerald-500' : 'text-red-500'
                }`}>
                  {getStatusLabel(systemStatus.forensic)}
                </span>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${getStatusColor(systemStatus.forensic)}`}
                />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 block truncate font-mono uppercase tracking-tighter">
              GEMINI_1.4
            </span>
          </div>

          {/* OCR MATRÍCULA */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps('OCR PaddleOCR con crop automático de matrícula. Mejora +15-25% en precisión de reconocimiento de placas.')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                OCR Matrícula
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[7px] font-bold uppercase tracking-tight ${
                  systemStatus.neural === 'ready' ? 'text-emerald-500' :
                  systemStatus.neural === 'error' ? 'text-red-500' :
                  'text-slate-500'
                }`}>
                  {getStatusLabel(systemStatus.neural)}
                </span>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${getStatusColor(systemStatus.neural)}`}
                />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 block truncate font-mono uppercase tracking-tighter">
              PADDLE-CROP
            </span>
          </div>

          {/* BIÓNICA */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps('Estado del sistema de detección biomecánica y análisis de movimiento.')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                Biónica
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[7px] font-bold uppercase tracking-tight ${
                  systemStatus.bionics === 'ready' ? 'text-emerald-500' : 'text-slate-500'
                }`}>
                  {getStatusLabel(systemStatus.bionics)}
                </span>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${getStatusColor(systemStatus.bionics)}`}
                />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 block truncate font-mono uppercase tracking-tighter">
              POSE_DETECTION
            </span>
          </div>

          {/* VECTORES */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps('Estado del motor vectorial y la malla de geometría activa.')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                Vectores
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[7px] font-bold uppercase tracking-tight ${
                  systemStatus.vector === 'ready' ? 'text-emerald-500' : 'text-slate-500'
                }`}>
                  {getStatusLabel(systemStatus.vector)}
                </span>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${getStatusColor(systemStatus.vector)}`}
                />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 block truncate font-mono uppercase tracking-tighter">
              {systemStatus.vector === 'ready' ? 'ACTIVE' : 'IDLE'}
            </span>
          </div>

          {/* MEDIAPIPE */}
          <div
            className="p-3 bg-white/[0.02] rounded-lg border border-white/5 space-y-2 relative overflow-hidden group transition-all hover:bg-white/[0.04]"
            {...helpProps('Estado de MediaPipe, framework de visión artificial en tiempo real.')}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 leading-none">
                MediaPipe
              </span>
              <div className="flex items-center gap-2">
                <span className={`text-[7px] font-bold uppercase tracking-tight ${
                  systemStatus.mediapipeReady ? 'text-emerald-500' : 'text-slate-500'
                }`}>
                  {systemStatus.mediapipeReady ? '✓ LISTO' : '— PENDIENTE'}
                </span>
                <div
                  className={`w-2 h-2 rounded-full transition-all ${getStatusColor(systemStatus.mediapipeReady)}`}
                />
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-300 block truncate font-mono uppercase tracking-tighter">
              WASM_TASKS
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
