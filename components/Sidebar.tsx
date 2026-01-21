import { ShieldCheck, Target, Mic, Sparkles, Upload, Signal } from 'lucide-react';
import { SystemLog, InfractionLog } from '../types';

interface SidebarProps {
    stats: { det: number; inf: number };
    selectedModel: 'yolo' | 'mediapipe' | null;
    setSelectedModel: (m: 'yolo' | 'mediapipe' | null) => void;
    directives: string;
    setDirectives: (d: string) => void;
    toggleListening: () => void;
    isListening: boolean;
    generateGeometry: () => void;
    startLiveFeed: () => void;
    onUploadClick: () => void;
}

export const Sidebar = ({
    stats,
    selectedModel, setSelectedModel, directives, setDirectives,
    toggleListening, isListening, generateGeometry,
    startLiveFeed, onUploadClick
}: SidebarProps) => {
    return (
        <aside className="w-80 border-r border-white/5 flex flex-col bg-[#020617]/95 z-50">
            <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-cyan-950/10">
                <ShieldCheck className="text-cyan-500 w-10 h-10" />
                <div className="flex flex-col">
                    <span className="text-xl font-black italic text-white uppercase leading-none">SENTINEL</span>
                    <span className="text-[7px] font-black tracking-[0.4em] text-cyan-500/60 uppercase">Trajectory_Audit_V15</span>
                </div>
            </div>

            <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                            <Target size={14} className="text-cyan-500" /> Instrucción AI
                        </h3>
                        <button onClick={toggleListening} className={`p-2 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-cyan-500 hover:bg-slate-700'}`}>
                            <Mic size={16} />
                        </button>
                    </div>

                    <div className="flex gap-2 p-1 bg-slate-900/60 rounded-xl border border-white/10">
                        <button onClick={() => setSelectedModel(selectedModel === 'yolo' ? null : 'yolo')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${selectedModel === 'yolo' ? 'bg-cyan-600 text-black' : 'text-slate-500 hover:text-white'}`}>
                            Sentinel Core (YOLO)
                        </button>
                        <button onClick={() => setSelectedModel(selectedModel === 'mediapipe' ? null : 'mediapipe')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${selectedModel === 'mediapipe' ? 'bg-green-600 text-black' : 'text-slate-500 hover:text-white'}`}>
                            Google Core (MediaPipe)
                        </button>
                    </div>

                    <textarea value={directives} onChange={e => setDirectives(e.target.value)} className="w-full h-32 bg-slate-900/60 border border-white/10 rounded-2xl p-4 text-[11px] font-mono text-cyan-300 outline-none resize-none shadow-inner" />
                    <button onClick={generateGeometry} className="w-full py-3 bg-cyan-600/20 border border-cyan-500/30 text-cyan-400 rounded-xl font-black text-[10px] uppercase hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-2">
                        <Sparkles size={14} /> Redefinir Geometría
                    </button>
                    <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 space-y-4">
                        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Radar Status</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[8px] text-slate-500 block uppercase mb-1">Detecciones</span>
                                <span className="text-xl font-black text-white">{stats.det}</span>
                            </div>
                            <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                <span className="text-[8px] text-slate-500 block uppercase mb-1">Sanciones</span>
                                <span className="text-xl font-black text-red-500">{stats.inf}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-6 border-t border-white/5 space-y-2 bg-[#020617]">
                <button onClick={startLiveFeed} className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2">
                    <Signal size={14} /> Live Feed
                </button>
                <button onClick={onUploadClick} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2">
                    <Upload size={14} /> Cargar Video
                </button>
            </div>
        </aside>
    );
};
