import React, { useRef, useEffect } from 'react';
import { Activity, BrainCircuit, Cpu, Video, Layers, Waves, Play, Pause } from 'lucide-react';

interface SystemStatus {
    neural: string;
    forensic: string;
    bionics: string;
}

interface MainViewerProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    source: 'none' | 'live' | 'upload';
    isDetecting: boolean;
    statusMsg: string | null;
    systemStatus: SystemStatus;
    statusLabel: string;
    isPlaying: boolean;
    setIsPlaying: (s: boolean) => void;
    isAnalyzing: boolean;
    modelLoaded: boolean;
    startLiveFeed: () => void;
    onUploadClick: () => void;
    generateGeometry: () => void;
}

export const MainViewer = ({
    videoRef, canvasRef, source, isDetecting, statusMsg, systemStatus, statusLabel,
    isPlaying, setIsPlaying, isAnalyzing, modelLoaded,
    startLiveFeed, onUploadClick, generateGeometry
}: MainViewerProps) => {

    return (
        <main className="flex-1 relative flex flex-col bg-black overflow-hidden">
            <video ref={videoRef} playsInline muted loop className="hidden" />
            <div className="absolute top-6 left-6 z-40 flex items-start gap-4">
                <div className="px-5 py-3 bg-black/80 border border-white/10 text-cyan-400 text-[10px] font-black rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                        <Activity size={14} className={modelLoaded ? "text-green-500 animate-pulse" : "text-amber-500"} />
                        <span>RADAR: {source === 'none' ? 'EN ESPERA' : `EJECUTANDO [${modelLoaded ? 'RED:OK' : 'RED:CARGANDO'}]`}</span>
                    </div>
                    {statusMsg && <div className="text-[8px] text-cyan-500/60 border-t border-white/5 pt-1 mt-1 font-mono uppercase">{statusMsg}</div>}
                    {isDetecting && <div className="text-[8px] text-purple-400 animate-pulse absolute top-2 right-2 font-mono">RED_OCUPADA</div>}
                </div>
            </div>

            <div className="flex-1 relative flex items-center justify-center bg-[#01030d]">
                <canvas ref={canvasRef} className="w-full h-full object-contain relative z-20" />
                {source === 'none' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 z-30 bg-[#020617] p-20">
                        <div className="relative flex items-center justify-center">
                            <div className="w-64 h-64 border-2 border-cyan-500/10 rounded-full animate-spin-slow" />
                            <div className="w-56 h-56 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin absolute" />
                            <BrainCircuit className="w-20 h-20 text-cyan-500 animate-pulse absolute" />
                        </div>

                        <div className="grid grid-cols-2 gap-4 w-full max-w-2xl">
                            <button
                                onClick={() => !modelLoaded && generateGeometry()}
                                className={`p-6 bg-slate-900/60 border ${systemStatus.neural === 'ready' ? 'border-green-500/30' : (systemStatus.neural === 'error' ? 'border-red-500/30' : 'border-white/10')} rounded-3xl flex items-center gap-4 transition-all shadow-lg hover:bg-slate-800/80 group text-left`}
                            >
                                <Cpu size={24} className={systemStatus.neural === 'ready' ? "text-green-500" : (systemStatus.neural === 'error' ? "text-red-500" : "text-cyan-500 animate-pulse")} />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Núcleo Neuronal</span>
                                    <span className="text-sm font-mono text-white italic">{statusLabel}</span>
                                </div>
                            </button>

                            <div className={`p-6 bg-slate-900/60 border ${systemStatus.forensic === 'ready' ? 'border-green-500/30' : (systemStatus.forensic === 'error' ? 'border-red-500/30' : 'border-white/10')} rounded-3xl flex items-center gap-4 transition-all shadow-lg`}>
                                <BrainCircuit size={24} className={systemStatus.forensic === 'ready' ? "text-green-500" : (systemStatus.forensic === 'error' ? "text-red-500" : "text-cyan-500 animate-pulse")} />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">IA Forense</span>
                                    <span className="text-sm font-mono text-white italic">{systemStatus.forensic === 'ready' ? 'GEMINI_CONECTADO' : (systemStatus.forensic === 'error' ? 'DESCONECTADO' : 'ESTABLECIENDO...')}</span>
                                </div>
                            </div>

                            <button
                                onClick={startLiveFeed}
                                className={`p-6 bg-slate-900/60 border ${systemStatus.bionics === 'ready' ? 'border-green-500/30' : (systemStatus.bionics === 'error' ? 'border-red-500/30' : 'border-white/10')} rounded-3xl flex items-center gap-4 transition-all shadow-lg hover:bg-slate-800/80 group text-left`}
                            >
                                <Video size={24} className={systemStatus.bionics === 'ready' ? "text-green-500" : (systemStatus.bionics === 'error' ? "text-red-500" : "text-cyan-500 animate-pulse")} />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Entrada Biónica</span>
                                    <span className="text-sm font-mono text-white italic">{systemStatus.bionics === 'ready' ? 'ÓPTICA_ESTABLE' : (systemStatus.bionics === 'error' ? 'DENEGADO' : 'ESPERANDO_DISPOSITIVO')}</span>
                                </div>
                            </button>

                            <button
                                onClick={generateGeometry}
                                className="p-6 bg-slate-900/60 border border-green-500/30 rounded-3xl flex items-center gap-4 transition-all shadow-lg hover:bg-slate-800/80 group text-left"
                            >
                                <Layers size={24} className="text-green-500" />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Motor Vectorial</span>
                                    <span className="text-sm font-mono text-white italic">GEOMETRÍA_LISTA</span>
                                </div>
                            </button>
                        </div>

                        <div className="flex flex-col items-center gap-2">
                            <span className="text-cyan-500/30 font-mono text-[9px] tracking-[0.5em] uppercase">Protocolo de Seguridad: SENTINEL.V16_ALFA</span>
                            <div className="flex gap-1">
                                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                                <div className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                            </div>
                        </div>
                    </div>
                )}

                {isAnalyzing && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm">
                        <div className="bg-black/90 border border-cyan-500/30 px-10 py-5 rounded-full flex items-center gap-6 animate-pulse shadow-2xl">
                            <Waves className="text-cyan-400 w-6 h-6 animate-spin-slow" />
                            <span className="text-sm font-black text-white uppercase tracking-widest italic">Analizando Vector...</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="h-28 bg-[#020617] border-t border-white/5 flex items-center justify-between px-10 z-50">
                <div className="flex items-center gap-10">
                    <button onClick={() => setIsPlaying(!isPlaying)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 ${isPlaying ? 'bg-red-800 text-white' : 'bg-cyan-500 text-black'}`}>
                        {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                    </button>
                    <div className="flex flex-col">
                        <span className="text-2xl font-black italic text-white uppercase leading-none tracking-tighter">UNIDAD_PREDICTIVA_01</span>
                        <div className="flex items-center gap-3 mt-2"><div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} /><span className="text-[8px] font-black text-cyan-500/60 tracking-[0.4em] uppercase">Bloqueo_Trayectoria_Listo</span></div>
                    </div>
                </div>
                <div className="text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">PROTOCOLO_SEGURO_IA_SENTINEL</div>
            </div>
        </main>
    );
};
