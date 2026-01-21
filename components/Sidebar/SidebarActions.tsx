import React from 'react';
import { Signal, Upload } from 'lucide-react';

interface SidebarActionsProps {
    startLiveFeed: () => void;
    onUploadClick: () => void;
}

export const SidebarActions = ({ startLiveFeed, onUploadClick }: SidebarActionsProps) => {
    return (
        <div className="p-6 border-t border-white/5 space-y-2 bg-[#020617]">
            <button
                onClick={startLiveFeed}
                className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2"
            >
                <Signal size={14} /> Señal en Vivo
            </button>
            <button
                onClick={onUploadClick}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2"
            >
                <Upload size={14} /> Cargar Video
            </button>
        </div>
    );
};
