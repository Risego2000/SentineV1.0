import React, { useState } from 'react';
import { PenTool, Box, Divide, Scale, Save, RefreshCw } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

const PRESETS = [
    { id: 'highway', label: 'Autovía Estándar', icon: Divide },
    { id: 'urban_cross', label: 'Cruce Urbano', icon: Box },
    { id: 'roundabout', label: 'Rotonda', icon: RefreshCw },
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
        generateGeometry("DETECTA Y TRAZA TODOS LOS CARRILES Y LÍNEAS DE CARRETERA VISIBLES PARA EL SISTEMA DE NAVEGACIÓN VECTORIAL. IGNORA OBJETOS, SOLO LÍNEAS.");
    };

    const loadPreset = (id: string) => {
        // En una implementación real, estos serían JSONs complejos precargados
        // Por ahora simulamos la acción de carga
        if (id === 'highway') {
            generateGeometry("CONFIGURACIÓN AUTOVÍA: 3 Carriles rectos, líneas discontinuas, arcén prohibido.");
        } else if (id === 'urban_cross') {
            generateGeometry("CONFIGURACIÓN CRUCE: 2 Pasos de cebra, 1 Stop, Líneas de carril urbano.");
        } else {
            generateGeometry("CONFIGURACIÓN ROTONDA: Círculo central prohibido, carriles de entrada y salida.");
        }
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
