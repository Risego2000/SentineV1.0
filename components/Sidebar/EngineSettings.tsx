import React from 'react';
import { Zap, Cpu, Activity, ShieldCheck } from 'lucide-react';
import { DETECTION_PRESETS, AUDIT_PRESETS, KINEMATIC_PRESETS } from '../../constants';
import {
  PresetType,
  AuditPresetType,
  KinematicPresetType,
  DetectionPresetData,
  AuditPresetData,
  KinematicPresetData,
} from '../../types';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

/**
 * Engine Settings Component.
 * UI interface for switching between different neural, forensic, and kinematic presets.
 */
export const EngineSettings = () => {
  const {
    currentPreset,
    setPreset,
    isPoseEnabled,
    setIsPoseEnabled,
    isAuditEnabled,
    setIsAuditEnabled,
    currentAuditPreset,
    setAuditPreset,
    currentKinematicPreset,
    setKinematicPreset,
  } = useSentinel();
  const { helpProps } = useHelp();

  return (
    <div className="space-y-[10px]">
      <h3
        className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
        {...helpProps(
          'Configura los 3 núcleos principales de Sentinel AI para optimizar la detección y el peritaje.'
        )}
      >
        <Zap size={14} className="text-amber-500" /> Configuración del Motor
      </h3>

      <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-6">
        {/* 1. SISTEMA BIÓNICO (DETECTION) */}
        <div
          className="space-y-3"
          {...helpProps(
            'MOTOR BIÓNICO: Controla el rendimiento y la sensibilidad del detector MediaPipe.'
          )}
        >
          <div className="flex items-center gap-2 px-1 border-l-2 border-cyan-500/30 pl-2">
            <Cpu size={12} className="text-cyan-500/60" />
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">
              Sistema Biónico (MediaPipe)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(DETECTION_PRESETS) as [PresetType, DetectionPresetData][]).map(
              ([key, data]) => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className={`p-2 rounded-[12px] border transition-all text-left flex flex-col items-center justify-center gap-1 min-h-[50px] ${
                    currentPreset === key
                      ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.1)]'
                      : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10 hover:bg-black/40'
                  }`}
                  {...helpProps(`Activa preset ${data.label}: ${data.description}`)}
                >
                  <span className="text-[10px] font-black uppercase text-center w-full leading-tight">
                    {data.label}
                  </span>
                  <span className="text-[9px] leading-tight opacity-40 font-bold uppercase text-center w-full tracking-tighter">
                    {data.description}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 2. UNIDAD FORENSE (GEMINI) */}
        <div
          className="space-y-3 pt-1"
          {...helpProps(
            'UNIDAD FORENSE: Activa la auditoría de Gemini IA para generar expedientes legales.'
          )}
        >
          <div className="flex items-center justify-between px-1 border-l-2 border-amber-500/30 pl-2">
            <div className="flex items-center gap-2">
              <ShieldCheck size={12} className="text-amber-500/60" />
              <span className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">
                Unidad Forense (Gemini IA)
              </span>
            </div>
            <button
              onClick={() => setIsAuditEnabled(!isAuditEnabled)}
              className={`w-9 h-[18px] rounded-full relative transition-all duration-500 ${isAuditEnabled ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-slate-800 border border-white/10'}`}
              {...helpProps(
                isAuditEnabled
                  ? 'Desactiva el peritaje IA para ahorrar recursos API.'
                  : 'Activa la auditoría neural de Gemini.'
              )}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-[14px] h-[14px] bg-white rounded-full transition-transform duration-300 shadow-md ${isAuditEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div
            className={`grid grid-cols-2 sm:grid-cols-3 gap-1.5 transition-all duration-500 ${isAuditEnabled ? 'opacity-100 scale-100' : 'opacity-20 grayscale pointer-events-none scale-[0.98]'}`}
          >
            {(Object.entries(AUDIT_PRESETS) as [AuditPresetType, AuditPresetData][]).map(
              ([key, data]) => (
                <button
                  key={key}
                  onClick={() => setAuditPreset(key)}
                  className={`p-2 rounded-[12px] border transition-all text-left flex flex-col items-center justify-center gap-1 min-h-[50px] ${
                    currentAuditPreset === key
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
                      : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10 hover:bg-black/40'
                  }`}
                  {...helpProps(`Auditoría nivel ${data.label}: ${data.description}`)}
                >
                  <span className="text-[10px] font-black uppercase text-center w-full leading-tight">
                    {data.label}
                  </span>
                  <span className="text-[8px] leading-tight opacity-40 font-bold uppercase text-center w-full tracking-tighter">
                    {data.description}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 3. MOTOR CINEMÁTICO (POSE) */}
        <div
          className="space-y-3 pt-1"
          {...helpProps(
            'MOTOR CINEMÁTICO: Analiza la estructura y conducta mediante Pose Landmarker.'
          )}
        >
          <div className="flex items-center justify-between px-1 border-l-2 border-indigo-500/30 pl-2">
            <div className="flex items-center gap-2">
              <Activity size={12} className="text-indigo-500/60" />
              <span className="text-xs font-black text-slate-500 uppercase tracking-[0.15em]">
                Motor Cinemático (Pose)
              </span>
            </div>
            <button
              onClick={() => setIsPoseEnabled(!isPoseEnabled)}
              className={`w-9 h-[18px] rounded-full relative transition-all duration-500 ${isPoseEnabled ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]' : 'bg-slate-800 border border-white/10'}`}
              {...helpProps(
                isPoseEnabled
                  ? 'Desactiva análisis de pose (CPU/GPU ahorro).'
                  : 'Activa el reconocimiento estructural de pose.'
              )}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-[14px] h-[14px] bg-white rounded-full transition-transform duration-300 shadow-md ${isPoseEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div
            className={`grid grid-cols-3 gap-1.5 transition-all duration-500 ${isPoseEnabled ? 'opacity-100 scale-100' : 'opacity-20 grayscale pointer-events-none scale-[0.98]'}`}
          >
            {(
              Object.entries(KINEMATIC_PRESETS) as [KinematicPresetType, KinematicPresetData][]
            ).map(([key, data]) => (
              <button
                key={key}
                onClick={() => setKinematicPreset(key)}
                className={`p-2 rounded-[12px] border transition-all text-left flex flex-col items-center justify-center gap-1 min-h-[50px] ${
                  currentKinematicPreset === key
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                    : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10 hover:bg-black/40'
                }`}
                {...helpProps(`Modo cinemático ${data.label}: ${data.description}`)}
              >
                <span className="text-[10px] font-black uppercase text-center w-full leading-tight">
                  {data.label}
                </span>
                <span className="text-[8px] leading-tight opacity-40 font-bold uppercase text-center w-full tracking-tighter">
                  {data.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
