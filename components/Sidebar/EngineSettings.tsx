import React from 'react';
import { Zap } from 'lucide-react';
import { DETECTION_PRESETS, PresetType } from '../../constants';
import { useSentinel } from '../../hooks/useSentinel';

export const EngineSettings = () => {
    const { currentPreset, setPreset, isPoseEnabled, setIsPoseEnabled } = useSentinel();

    return (
        <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                <Zap size={14} className="text-amber-500" /> Configuración del Motor
            </h3>
            <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-4">
                <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                        Presets de Análisis
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                        {(Object.entries(DETECTION_PRESETS) as [PresetType, any][]).map(([key, data]) => (
                            <button
                                key={key}
                                onClick={() => setPreset(key)}
                                className={`p-2 rounded-xl border transition-all text-left flex flex-col gap-0.5 ${currentPreset === key
                                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-500' // Changed to Cyan
                                    : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'
                                    }`}
                            >
                                <span className="text-[9px] font-black uppercase">{data.label}</span>
                                <span className="text-[7.5px] leading-tight opacity-60 font-medium uppercase">
                                    {data.description}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/10">
                    <span className="text-[9px] font-black text-slate-500 uppercase">
                        Análisis Cinemático (Pose)
                    </span>
                    <button
                        onClick={() => setIsPoseEnabled(!isPoseEnabled)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${isPoseEnabled ? 'bg-cyan-500' : 'bg-slate-700'
                            }`}
                    >
                        <div
                            className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isPoseEnabled ? 'translate-x-4' : 'translate-x-0'
                                }`}
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};
