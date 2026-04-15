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
    <div className="space-y-4 mb-4" id="section-engine">
      <h3
        className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
        {...helpProps(
          'Configura los 3 núcleos principales de Sentinel AI para optimizar la detección y el peritaje.'
        )}
      >
        <Zap size={10} className="text-blue-500" /> Configuración del Motor
      </h3>

      <div className="bg-slate-900/40 border border-white/10 rounded-[16px] p-3 space-y-6">
        {/* 1. SISTEMA BIÓNICO (DETECTION) */}
        <div
          className="space-y-3"
          {...helpProps(
            'MOTOR BIÓNICO: Controla el rendimiento y la sensibilidad del detector MediaPipe.'
          )}
        >
          <div className="flex items-center gap-2 px-1">
            <Cpu size={8} className="text-blue-500" />
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Sistema Biónico
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.entries(DETECTION_PRESETS) as [PresetType, DetectionPresetData][]).map(
              ([key, data]) => (
                <button
                  key={key}
                  onClick={() => setPreset(key)}
                  className={`p-1.5 rounded-[10px] border transition-all text-center flex flex-col items-center justify-center gap-1 min-h-[36px] ${
                    currentPreset === key
                      ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                      : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                  }`}
                  {...helpProps(`Activa preset ${data.label}: ${data.description}`)}
                >
                  <span className="text-[8px] font-black uppercase tracking-tight">
                    {data.label}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 2. UNIDAD FORENSE (GEMINI) */}
        <div
          className="space-y-3 pt-4 border-t border-white/5"
          {...helpProps(
            'UNIDAD FORENSE: Activa la auditoría de Gemini IA para generar expedientes legales.'
          )}
        >
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={8} className="text-blue-500" aria-hidden="true" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Unidad Forense
              </span>
            </div>
            <button
              onClick={() => setIsAuditEnabled(!isAuditEnabled)}
              className={`w-6 h-3 rounded-full relative transition-all duration-300 ${isAuditEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
              {...helpProps(
                isAuditEnabled
                  ? 'Desactivar unidad forense de Gemini'
                  : 'Activar unidad forense de Gemini'
              )}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform duration-300 ${isAuditEnabled ? 'translate-x-3' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div
            className={`grid grid-cols-2 gap-1.5 transition-all duration-300 ${isAuditEnabled ? 'opacity-100' : 'opacity-20 grayscale pointer-events-none'}`}
          >
            {(Object.entries(AUDIT_PRESETS) as [AuditPresetType, AuditPresetData][]).map(
              ([key, data]) => (
                <button
                  key={key}
                  onClick={() => setAuditPreset(key)}
                  disabled={!isAuditEnabled}
                  className={`p-1.5 rounded-[10px] border transition-all text-center flex flex-col items-center justify-center gap-1 min-h-[36px] ${
                    currentAuditPreset === key
                      ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                      : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04]'
                  }`}
                  {...helpProps(`Activa auditoría ${data.label}: ${data.description}`)}
                >
                  <span className="text-[8px] font-black uppercase tracking-tight">
                    {data.label}
                  </span>
                </button>
              )
            )}
          </div>
        </div>

        {/* 3. MOTOR CINEMÁTICO (POSE) */}
        <div
          className="space-y-3 pt-4 border-t border-white/5"
          {...helpProps(
            'MOTOR CINEMÁTICO: Analiza la estructura y conducta mediante Pose Landmarker.'
          )}
        >
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Activity size={8} className="text-blue-500" aria-hidden="true" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                Motor Cinemático
              </span>
            </div>
            <button
              onClick={() => setIsPoseEnabled(!isPoseEnabled)}
              className={`w-6 h-3 rounded-full relative transition-all duration-300 ${isPoseEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
              {...helpProps(
                isPoseEnabled
                  ? 'Desactivar motor cinemático de Pose'
                  : 'Activar motor cinemático de Pose'
              )}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform duration-300 ${isPoseEnabled ? 'translate-x-3' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div
            className={`grid grid-cols-2 gap-1.5 transition-all duration-300 ${isPoseEnabled ? 'opacity-100' : 'opacity-20 grayscale pointer-events-none'}`}
          >
            {(
              Object.entries(KINEMATIC_PRESETS) as [KinematicPresetType, KinematicPresetData][]
            ).map(([key, data]) => (
              <button
                key={key}
                onClick={() => setKinematicPreset(key)}
                disabled={!isPoseEnabled}
                className={`p-1.5 rounded-[10px] border transition-all text-center flex flex-col items-center justify-center gap-1 min-h-[36px] ${
                  currentKinematicPreset === key
                    ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                    : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04]'
                }`}
                {...helpProps(`Activa motor cinemático ${data.label}: ${data.description}`)}
              >
                <span className="text-[8px] font-black uppercase tracking-tight">{data.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
