import React from 'react';
import { Signal, Upload, PencilRuler } from 'lucide-react';

interface HeaderActionsProps {
    onLive: () => void;
    onUpload: () => void;
    activeMode: 'video' | 'live' | 'none';
    isEditing: boolean;
    onEdit: () => void;
}

export const HeaderActions = ({ onLive, onUpload, activeMode, isEditing, onEdit }: HeaderActionsProps) => {
    return (
        <div className="absolute top-6 right-6 z-40 flex flex-row gap-4 pointer-events-auto items-center">
            {/* Modo Edición */}
            <button
                onClick={onEdit}
                className={`h-14 w-14 rounded-full flex items-center justify-center transition-all shadow-lg border ${isEditing
                    ? 'bg-cyan-500 border-cyan-400 text-black shadow-cyan-500/30'
                    : 'bg-black/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'
                    }`}
                title="Editar Geometría"
            >
                <PencilRuler size={20} className={isEditing ? 'animate-pulse' : ''} />
            </button>

            <div className="h-8 w-px bg-white/10 mx-2" />

            <button
                onClick={onLive}
                className={`h-14 px-8 rounded-full font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 min-w-[180px] group ${activeMode === 'live'
                    ? 'bg-cyan-500 text-black shadow-cyan-500/20'
                    : 'bg-black/40 border border-white/5 text-slate-600 hover:bg-cyan-950/30 hover:text-cyan-700 hover:border-cyan-900/30'
                    }`}
            >
                <Signal size={16} className={activeMode === 'live' ? 'animate-pulse' : ''} />
                CÁMARA IP
            </button>

            <button
                onClick={onUpload}
                className={`h-14 px-8 rounded-full font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 min-w-[180px] ${activeMode === 'video'
                    ? 'bg-cyan-500 text-black shadow-cyan-500/20'
                    : 'bg-black/40 border border-white/5 text-slate-600 hover:bg-slate-900/60 hover:text-slate-400'
                    }`}
            >
                <Upload size={16} />
                Cargar Video
            </button>
        </div>
    );
};
