import React from 'react';
import { Signal, Upload } from 'lucide-react';
import { useHelp } from '../../hooks/useHelp';

interface HeaderActionsProps {
    onLive: () => void;
    onUpload: () => void;
    activeMode: 'video' | 'live' | 'none';
}

export const HeaderActions = ({ onLive, onUpload, activeMode }: HeaderActionsProps) => {
    const { helpProps } = useHelp();

    return (
        <div className="absolute top-6 right-6 z-40 flex flex-row gap-4 pointer-events-auto items-center">
            <button
                onClick={onLive}
                className={`h-14 px-8 rounded-full font-black text-[11px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-3 min-w-[180px] group ${activeMode === 'live'
                    ? 'bg-cyan-500 text-black shadow-cyan-500/20'
                    : 'bg-black/40 border border-white/5 text-slate-600 hover:bg-cyan-950/30 hover:text-cyan-700 hover:border-cyan-900/30'
                    }`}
                {...helpProps("Conecta con flujos de video en tiempo real mediante protocolos RTSP o WebRTC.")}
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
                {...helpProps("Carga un archivo de video local para realizar un análisis forense diferido.")}
            >
                <Upload size={16} />
                Cargar Video
            </button>
        </div>
    );
};
