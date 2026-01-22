import React from 'react';
import { Zap } from 'lucide-react';
import { DETECTION_PRESETS, PresetType, AUDIT_PRESETS, AuditPresetType, KINEMATIC_PRESETS } from '../../constants';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const EngineSettings = () => {
    const {
        currentPreset, setPreset,
        isPoseEnabled, setIsPoseEnabled,
        isAuditEnabled, setIsAuditEnabled,
        currentAuditPreset, setAuditPreset,
        currentKinematicPreset, setKinematicPreset
    } = useSentinel();
    const { helpProps } = useHelp();

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
                {...helpProps("Configura los 3 núcleos principales de Sentinel AI para optimizar la detección y el peritaje.")}
            >
                <Zap size={14} className="text-amber-500" /> Configuración del Motor
            </h3>
            <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-4">
                <div className="space-y-2" {...helpProps("MOTOR BIÓNICO: Controla el rendimiento y la sensibilidad del detector MediaPipe.")}>
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                        Sistema Biónico (MediaPipe)
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                        {(Object.entries(DETECTION_PRESETS) as [PresetType, any][]).map(([key, data]) => (
                            <button
                                key={key}
                                onClick={() => setPreset(key)}
                                className={`p-2 rounded-xl border transition-all text-left flex flex-col gap-1 ${currentPreset === key
                                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-500'
                                    : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'
                                    }`}
                                {...helpProps(`Activa preset ${data.label}: ${data.description}`)}
                            >
                                <span className="text-[8px] font-black uppercase text-center w-full">{data.label}</span>
                                <span className="text-[6.5px] leading-tight opacity-60 font-medium uppercase text-center w-full">
                                    {data.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5" {...helpProps("UNIDAD FORENSE: Activa la auditoría de Gemini IA para generar expedientes legales.")}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                            Unidad Forense (Gemini IA)
                        </span>
                        <button
                            onClick={() => setIsAuditEnabled(!isAuditEnabled)}
                            className={`w-8 h-4 rounded-full relative transition-colors ${isAuditEnabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                            {...helpProps(isAuditEnabled ? "Desactiva el peritaje IA para ahorrar recursos API." : "Activa la auditoría neural de Gemini.")}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isAuditEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className={`grid grid-cols-3 gap-2 transition-opacity ${isAuditEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        {(Object.entries(AUDIT_PRESETS) as [AuditPresetType, any][]).map(([key, data]) => (
                            <button
                                key={key}
                                onClick={() => setAuditPreset(key)}
                                className={`p-2 rounded-xl border transition-all text-left flex flex-col gap-1 ${currentAuditPreset === key
                                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                                    : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'
                                    }`}
                                {...helpProps(`Auditoría nivel ${data.label}: ${data.description}`)}
                            >
                                <span className="text-[8px] font-black uppercase text-center w-full">{data.label}</span>
                                <span className="text-[6.5px] leading-tight opacity-60 font-medium uppercase text-center w-full">
                                    {data.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5" {...helpProps("MOTOR CINEMÁTICO: Analiza la estructura y conducta mediante Pose Landmarker.")}>
                    <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                            Motor Cinemático (Pose)
                        </span>
                        <button
                            onClick={() => setIsPoseEnabled(!isPoseEnabled)}
                            className={`w-8 h-4 rounded-full relative transition-colors ${isPoseEnabled ? 'bg-indigo-500' : 'bg-slate-700'}`}
                            {...helpProps(isPoseEnabled ? "Desactiva análisis de pose (CPU/GPU ahorro)." : "Activa el reconocimiento estructural de pose.")}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isPoseEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className={`grid grid-cols-3 gap-2 transition-opacity ${isPoseEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                        {(Object.entries(KINEMATIC_PRESETS) as [KinematicPresetType, any][]).map(([key, data]) => (
                            <button
                                key={key}
                                onClick={() => setKinematicPreset(key)}
                                className={`p-2 rounded-xl border transition-all text-left flex flex-col gap-1 ${currentKinematicPreset === key
                                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-500'
                                    : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'
                                    }`}
                                {...helpProps(`Modo cinemático ${data.label}: ${data.description}`)}
                            >
                                <span className="text-[8px] font-black uppercase text-center w-full">{data.label}</span>
                                <span className="text-[6.5px] leading-tight opacity-60 font-medium uppercase text-center w-full">
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
