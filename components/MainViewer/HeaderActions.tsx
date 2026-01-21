import React from 'react';
import { Signal, Upload } from 'lucide-react';

interface HeaderActionsProps {
    onLive: () => void;
    onUpload: () => void;
    activeMode: 'video' | 'live' | 'none';
}

export const HeaderActions = ({ onLive, onUpload, activeMode }: HeaderActionsProps) => {
    return (
        <div className="absolute top-6 right-6 z-40 flex flex-row gap-4 pointer-events-auto items-center">
            <button
                onClick={onLive}
                className={`h-14 px-8 rounded-full font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 min-w-[180px] group ${activeMode === 'live'
                        ? 'bg-cyan-500 text-black shadow-cyan-500/20'
                        : 'bg-black/40 border border-white/5 text-slate-600 hover:bg-cyan-950/30 hover:text-cyan-700 hover:border-cyan-900/30'
                    }`}
            >
                <Signal size={16} className={activeMode === 'live' ? 'animate-pulse' : ''} />
                Señal en Vivo
            </button>

            <button
                onClick={onUpload}
                className={`h-14 px-8 rounded-full font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 min-w-[180px] ${activeMode === 'video'
                        ? 'bg-[#1e293b] border border-white/20 text-white shadow-white/5'
                        : 'bg-black/40 border border-white/5 text-slate-600 hover:bg-slate-900/60 hover:text-slate-400'
                    }`}
            >
                <Upload size={16} />
                Cargar Video
            </button>
        </div>
    );
};
