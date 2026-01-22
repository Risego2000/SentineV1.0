import React, { useState } from 'react';
import { PenTool, Box, Divide, Scale, Save, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

const PRESETS = [
    { id: 'm113_highway', label: 'Carretera M-113', icon: Divide },
    { id: 'calle_real_cross', label: 'Cruce Calle Real', icon: Box },
    { id: 'daganzo_roundabout', label: 'Glorieta Acceso', icon: RefreshCw },
    { id: 'urban_bus', label: 'Carril Bus Urbano', icon: Divide },
    { id: 'residential_zone', label: 'Zona Residencial (S-28)', icon: ShieldAlert },
    { id: 'commercial_loading', label: 'Carga/Descarga Daganzo', icon: Box },
];

export const GeometryTools = () => {
    const {
        setIsEditingGeometry,
        isEditingGeometry,
        generateGeometry,
        setGeometry,
        calibration,
        setCalibration
    } = useSentinel();

    const handleAutoDetect = () => {
        generateGeometry("ANALIZA EL ENTORNO VIAL: Detecta carriles, líneas divisorias, zonas prohibidas y puntos de parada. Traza la geometría vectorial completa para monitorización de tráfico.");
    };

    const loadPreset = (id: string) => {
        const prompts: Record<string, string> = {
            highway: "ESCENA AUTOVÍA: Traza carriles principales, línea de arcén prohibido y divisorias de velocidad.",
            urban_cross: "CRUCE URBANO: Configura pasos de cebra, líneas de stop y zonas de giro prohibido.",
            roundabout: "ROTONDA: Traza el anillo central como zona prohibida y carriles de entrada/salida.",
            bus_lane: "CARRIL BUS: Define el carril derecho como zona restringida. Solo buses autorizados.",
            pedestrian: "ZONA PEATONAL: Traza pasos de cebra y aceras como zonas de máxima alerta para peatones.",
            loading_zone: "ZONA CARGA/DESCARGA: Define áreas de servicio. Monitoriza tiempo de permanencia."
        };
        generateGeometry(prompts[id] || prompts.highway);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <PenTool size={14} className="text-cyan-500" /> Geometría & Anotación
                </h3>
            </div>

            <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-4">

                {/* Editor Toggle */}
                <button
                    onClick={() => setIsEditingGeometry(!isEditingGeometry)}
                    className={`w-full py-2 rounded-lg border flex items-center justify-center gap-2 transition-all ${isEditingGeometry
                        ? 'bg-cyan-500 text-black border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                        : 'bg-black/30 text-slate-400 border-white/5 hover:border-white/20'
                        }`}
                >
                    <PenTool size={12} />
                    <span className="text-[10px] font-black uppercase">
                        {isEditingGeometry ? 'Editor Visual Activo' : 'Activar Editor Visual'}
                    </span>
                </button>

                {/* Auto Detection */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleAutoDetect}
                        className="p-2 bg-black/20 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 rounded-lg flex flex-col items-center gap-1 transition-colors group"
                    >
                        <Divide size={14} className="text-slate-500 group-hover:text-cyan-400" />
                        <span className="text-[8px] font-bold text-slate-500 group-hover:text-cyan-400 uppercase text-center leading-none">
                            Detección Auto Vía
                        </span>
                    </button>
                    <button
                        className="p-2 bg-black/20 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-lg flex flex-col items-center gap-1 transition-colors group"
                    >
                        <Save size={14} className="text-slate-500 group-hover:text-emerald-400" />
                        <span className="text-[8px] font-bold text-slate-500 group-hover:text-emerald-400 uppercase text-center leading-none">
                            Guardar Calibración
                        </span>
                    </button>
                </div>

                {/* Presets */}
                <div className="space-y-2">
                    <span className="text-[9px] font-bold text-slate-600 uppercase block pl-1">Plantillas Rápidas</span>
                    <div className="grid grid-cols-3 gap-1">
                        {PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => loadPreset(preset.id)}
                                className="p-2 bg-slate-800/50 hover:bg-white/5 border border-white/5 rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all"
                                title={preset.label}
                            >
                                <preset.icon size={12} className="text-slate-400" />
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-wide">
                                    {preset.label.split(' ')[0]}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Calibration */}
                <div className="bg-black/20 p-2 rounded-lg flex items-center justify-between border border-white/5">
                    <div className="flex items-center gap-2">
                        <Scale size={12} className="text-slate-500" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase">Calibración (m/px)</span>
                    </div>
                    <input
                        type="number"
                        value={calibration}
                        onChange={(e) => setCalibration(parseFloat(e.target.value))}
                        step="0.01"
                        className="w-12 bg-transparent text-right text-[10px] font-mono text-cyan-500 outline-none border-b border-white/10 focus:border-cyan-500"
                    />
                </div>

            </div>
        </div>
    );
};
