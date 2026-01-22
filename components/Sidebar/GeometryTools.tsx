import React, { useState } from 'react';
import { PenTool, Box, Divide, Scale, Save, RefreshCw, ShieldAlert } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import { GEOMETRY_PRESETS } from '../../constants';

const PRESETS = [
    { id: 'm113_highway', label: 'Carretera M-113', icon: Divide, help: "Aplica geometría para autovías y carreteras con divisorias." },
    { id: 'calle_real_cross', label: 'Cruce Calle Real', icon: Box, help: "Configura intersecciones urbanas con pasos de cebra y stops." },
    { id: 'daganzo_roundabout', label: 'Glorieta Acceso', icon: RefreshCw, help: "Traza el anillo de la rotonda y flujos de entrada/salida." },
    { id: 'urban_bus', label: 'Carril Bus Urbano', icon: Divide, help: "Prioriza la detección de infracciones en carriles restringidos." },
    { id: 'residential_zone', label: 'Zona Residencial (S-28)', icon: ShieldAlert, help: "Define áreas de prioridad peatonal y estacionamiento." },
    { id: 'commercial_loading', label: 'Carga/Descarga Daganzo', icon: Box, help: "Establece zonas de servicio comercial y logística." },
];

export const GeometryTools = () => {
    const {
        isMeshRenderEnabled,
        setIsMeshRenderEnabled,
        parseMeshDirectives,
        generateGeometry,
        geometry,
        setGeometry,
        directives,
        setDirectives,
        calibration,
        setCalibration,
        videoRef,
        addLog
    } = useSentinel();
    const { helpProps } = useHelp();

    const handleAutoDetect = () => {
        parseMeshDirectives();
    };

    const loadPreset = (id: string) => {
        addLog('CORE', `Cargando preset geográfico: ${id.toUpperCase()}`);

        // 1. CARGA INSTANTÁNEA (Líneas predefinidas)
        if (GEOMETRY_PRESETS[id]) {
            setGeometry(GEOMETRY_PRESETS[id]);
            addLog('CORE', `Geometría táctica de '${id}' aplicada.`);
        }

        // 2. REFINAMIENTO IA (Prompt contextual)
        const prompts: Record<string, string> = {
            m113_highway: "ESCENA CARRETERA M-113: Traza carriles principales, línea de arcén prohibido y divisorias de velocidad.",
            calle_real_cross: "CRUCE URBANO CALLE REAL: Configura pasos de cebra, líneas de stop y zonas de giro prohibido.",
            daganzo_roundabout: "GLORIETA ACCESO: Traza el anillo central como zona prohibida y carriles de entrada/salida.",
            urban_bus: "CARRIL BUS URBANO: Define el carril derecho como zona restringida. Solo buses autorizados.",
            residential_zone: "ZONA RESIDENCIAL S-28: Traza la zona como prioridad peatonal y áreas de estacionamiento controlado.",
            commercial_loading: "ZONA CARGA/DESCARGA COMERCIAL: Define el área de servicio junto al bordillo."
        };
        generateGeometry(prompts[id] || prompts.m113_highway, videoRef.current);
    };

    const removeLine = (id: string) => {
        const line = geometry.find(l => l.id === id);
        if (line) {
            // Eliminar de la geometría
            setGeometry(geometry.filter(l => l.id !== id));

            // Intentar eliminar del texto de directivas (Reverse Sync)
            const label = line.label.toLowerCase();
            let newDirectives = directives;

            // Caso 1: Palabras clave
            const keywords = ['continua', 'stop', 'peatones', 'bus', 'detención', 'cebra'];
            keywords.forEach(kw => {
                if (label.includes(kw) || kw.includes(label)) {
                    const regex = new RegExp(`\\b${kw}\\b`, 'gi');
                    newDirectives = newDirectives.replace(regex, '');
                }
            });

            // Caso 2: Sintaxis manual [LINE: ...]
            const lineRegex = new RegExp(`\\[LINE:\\s*Y=\\d+,\\s*TYPE=\\w+,\\s*LABEL=${line.label}[^\\]]*\\]`, 'gi');
            newDirectives = newDirectives.replace(lineRegex, '');

            if (newDirectives !== directives) {
                setDirectives(newDirectives.replace(/\s+/g, ' ').trim());
            }
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between"
                {...helpProps("Herramientas para definir y calibrar las zonas de detección en el espacio visual.")}
            >
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <PenTool size={14} className="text-cyan-500" /> Geometría & Anotación
                </h3>
            </div>

            <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-4">

                {/* Mesh Toggle */}
                <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/10"
                    {...helpProps("Activa la visibilidad de la malla geométrica y las zonas de infracción en pantalla.")}
                >
                    <span className="text-[9px] font-black text-slate-500 uppercase flex items-center gap-2">
                        MESH_RENDER
                    </span>
                    <button
                        onClick={() => setIsMeshRenderEnabled(!isMeshRenderEnabled)}
                        className={`w-8 h-4 rounded-full relative transition-colors ${isMeshRenderEnabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
                    >
                        <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isMeshRenderEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                </div>

                {/* Auto Detection / MESH SYNTHESIS */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={handleAutoDetect}
                        className="p-2 bg-black/20 hover:bg-cyan-500/10 border border-white/5 hover:border-cyan-500/30 rounded-lg flex flex-col items-center gap-1 transition-colors group"
                        {...helpProps("SÍNTESIS AUTOMÁTICA: Gemini analiza el entorno y traza los vectores de la vía automáticamente.")}
                    >
                        <RefreshCw size={14} className="text-slate-500 group-hover:text-cyan-400" />
                        <span className="text-[8px] font-bold text-slate-500 group-hover:text-cyan-400 uppercase text-center leading-none">
                            AUTOMATIC MESH SYNTHESIS
                        </span>
                    </button>
                    <button
                        className="p-2 bg-black/20 hover:bg-emerald-500/10 border border-white/5 hover:border-emerald-500/30 rounded-lg flex flex-col items-center gap-1 transition-colors group"
                        {...helpProps("Guarda la calibración métrica y la configuración de malla actual en la base de datos.")}
                    >
                        <Save size={14} className="text-slate-500 group-hover:text-emerald-400" />
                        <span className="text-[8px] font-bold text-slate-500 group-hover:text-emerald-400 uppercase text-center leading-none">
                            Guardar Calibración
                        </span>
                    </button>
                </div>

                {/* Active Line Tags */}
                {geometry.length > 0 && (
                    <div className="space-y-2">
                        <span className="text-[9px] font-bold text-slate-600 uppercase block pl-1">Sensores Activos</span>
                        <div className="flex flex-wrap gap-1">
                            {geometry.map(line => (
                                <div key={line.id} className="flex items-center gap-1 px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full"
                                    {...helpProps(`Sensor de tipo ${line.type}: ${line.label}. Vigila cruces de línea o presencia.`)}
                                >
                                    <span className="text-[8px] font-bold text-cyan-400 uppercase">{line.label}</span>
                                    <button onClick={() => removeLine(line.id)} className="text-cyan-500/50 hover:text-cyan-400">
                                        <ShieldAlert size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Presets */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                    <span className="text-[9px] font-bold text-slate-600 uppercase block pl-1">Protocolos de Vía</span>
                    <div className="grid grid-cols-3 gap-1">
                        {PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => loadPreset(preset.id)}
                                className="p-2 bg-slate-800/50 hover:bg-white/5 border border-white/5 rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all text-center"
                                {...helpProps(preset.help || "")}
                            >
                                <preset.icon size={12} className="text-slate-400" />
                                <span className="text-[7px] font-black text-slate-500 uppercase tracking-tight">
                                    {preset.label.split(' ').slice(1).join(' ') || preset.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Calibration */}
                <div className="bg-black/20 p-2 rounded-lg flex items-center justify-between border border-white/5"
                    {...helpProps("Establece la relación de metros por píxel para cálculos de velocidad y distancia.")}
                >
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
