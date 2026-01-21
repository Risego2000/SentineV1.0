import { ShieldCheck, Target, Mic, Sparkles, Upload, Signal, Zap, Cpu } from 'lucide-react';
import { SystemLog, InfractionLog, SystemStatus } from '../types';
import { DETECTION_PRESETS, PresetType } from '../constants';

interface SidebarProps {
    stats: { det: number; inf: number };
    currentPreset: PresetType;
    setPreset: (p: PresetType) => void;
    directives: string;
    setDirectives: (d: string) => void;
    toggleListening: () => void;
    isListening: boolean;
    generateGeometry: (instruction?: string) => void;
    startLiveFeed: () => void;
    onUploadClick: () => void;
    isPoseEnabled: boolean;
    togglePose: () => void;
    systemStatus: SystemStatus;
    statusLabel: string;
}

export const Sidebar = ({
    stats,
    currentPreset, setPreset,
    directives, setDirectives,
    toggleListening, isListening, generateGeometry,
    startLiveFeed, onUploadClick,
    isPoseEnabled, togglePose,
    systemStatus, statusLabel
}: SidebarProps) => {
    return (
        <aside className="w-80 border-r border-white/10 flex flex-col bg-[#020617]/95 z-50 shrink-0">
            <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-cyan-950/10">
                <ShieldCheck className="text-cyan-500 w-10 h-10" />
                <div className="flex flex-col">
                    <span className="text-xl font-black italic text-white uppercase leading-none">SENTINEL</span>
                    <span className="text-[9px] font-black tracking-[0.4em] text-cyan-500/60 uppercase">Trajectory_Audit_V15</span>
                </div>
            </div>

            <div className="flex-1 p-5 space-y-6 overflow-y-auto custom-scrollbar">

                {/* 1. NÚCLEO OPERATIVO (ESTADOS) */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                        <Cpu size={14} className="text-cyan-500" /> Núcleo Operativo
                    </h3>
                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4">
                        <div className="grid grid-cols-2 gap-3">
                            {/* NÚCLEO NEURONAL GOOGLE */}
                            <div className="col-span-2 p-3 bg-black/40 rounded-xl border border-white/5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Núcleo Neuronal Google</span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${systemStatus.neural === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-amber-500 animate-bounce'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-cyan-400 font-bold italic">MEDIAPIPE_X86_64</span>
                                    <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 tracking-tighter">
                                        {statusLabel}
                                    </span>
                                </div>
                            </div>

                            {/* IA FORENSE (AUDITORÍA) */}
                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">IA Forense</span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${systemStatus.forensic === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                                </div>
                                <span className="text-[9px] font-mono text-white italic block truncate">
                                    {systemStatus.forensic === 'ready' ? 'FLASH_ACTIVO' : 'DESCONECTADO'}
                                </span>
                            </div>

                            {/* MOTOR VECTORIAL (ESPACIAL) */}
                            <div className="p-3 bg-black/40 rounded-xl border border-white/5 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Motor Vect</span>
                                    <div className={`w-1.5 h-1.5 rounded-full ${systemStatus.vector === 'ready' ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                                </div>
                                <span className="text-[9px] font-mono text-white italic block truncate">
                                    {systemStatus.vector === 'ready' ? 'VECT_ACTIVO' : 'ESPERANDO'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. CONFIGURACIÓN DEL MOTOR (PRESETS & POSE) */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                        <Zap size={14} className="text-amber-500" /> Configuración del Motor
                    </h3>
                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
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
                                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                                            : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10'
                                            }`}
                                    >
                                        <span className="text-[9px] font-black uppercase">{data.label}</span>
                                        <span className="text-[7.5px] leading-tight opacity-60 font-medium">{data.description}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                            <span className="text-[9px] font-black text-slate-500 uppercase">Análisis Cinemático (Pose)</span>
                            <button
                                onClick={togglePose}
                                className={`w-8 h-4 rounded-full relative transition-colors ${isPoseEnabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
                            >
                                <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isPoseEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. PROTOCOLO DE SEGURIDAD (DIRECTIVAS & VÍA) */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Target size={14} className="text-cyan-500" /> Protocolo de Seguridad
                        </h3>
                        <button onClick={toggleListening} className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-cyan-500 hover:bg-slate-700'}`}>
                            <Mic size={14} />
                        </button>
                    </div>

                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
                        <div className="relative group">
                            <textarea
                                value={directives}
                                onChange={e => setDirectives(e.target.value)}
                                className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-cyan-300 outline-none resize-none shadow-inner focus:border-cyan-500/50 transition-all"
                                placeholder="Ingrese directivas del sistema..."
                            />
                            <div className="absolute bottom-3 right-3 opacity-20 pointer-events-none font-mono text-[8px] text-cyan-500">
                                UTF-8_DIRECTIVE_STREAM
                            </div>
                        </div>

                        <button
                            onClick={() => generateGeometry('ANÁLISIS EXHAUSTIVO: Detecta TODAS las marcas viales (carriles, líneas de parada, pasos peatonales) Y señalización vertical (STOP, Ceda el paso, Semáforos). Genera vectores precisos.')}
                            className="w-full py-4 bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 rounded-2xl font-black text-[11px] uppercase hover:bg-cyan-500/15 hover:border-cyan-500/40 transition-all flex items-center justify-center gap-3 group shadow-[0_0_20px_rgba(34,211,238,0.05)]"
                        >
                            <Sparkles size={16} className="group-hover:rotate-12 transition-transform text-cyan-500" />
                            <span className="tracking-[0.15em]">Detección de Vía</span>
                        </button>
                    </div>
                </div>

            </div>
            <div className="p-6 border-t border-white/5 space-y-2 bg-[#020617]">
                <button onClick={startLiveFeed} className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2">
                    <Signal size={14} /> Señal en Vivo
                </button>
                <button onClick={onUploadClick} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2">
                    <Upload size={14} /> Cargar Video
                </button>
            </div>
        </aside>
    );
};
