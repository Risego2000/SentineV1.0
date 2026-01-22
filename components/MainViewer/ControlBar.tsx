import React from 'react';
import { Play, Pause } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const ControlBar = () => {
    const { isPlaying, setIsPlaying } = useSentinel();
    const { helpProps } = useHelp();

    const togglePlayback = () => {
        setIsPlaying(!isPlaying);
    };

    return (
        <div className="h-28 bg-[#020617] border-t border-white/5 flex items-center justify-between px-10 z-50 shrink-0">
            <div className="flex items-center gap-10">
                <button
                    onClick={togglePlayback}
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 ${isPlaying ? 'bg-red-800 text-white' : 'bg-cyan-500 text-black'
                        }`}
                    {...helpProps(isPlaying ? "Pausa la transmisión biónica." : "Inicia el análisis de vectores en tiempo real.")}
                >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                </button>
                <div className="flex flex-col">
                    <span className="text-2xl font-black italic text-white uppercase leading-none tracking-tighter">
                        UNIDAD_PREDICTIVA_01
                    </span>
                    <div className="flex items-center gap-3 mt-2">
                        <div
                            className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`}
                        />
                        <span className="text-[8px] font-black text-cyan-500/60 tracking-[0.4em] uppercase">
                            Bloqueo_Trayectoria_Listo
                        </span>
                    </div>
                </div>
            </div>
            <div className="hidden md:block text-[10px] font-mono text-white/20 uppercase tracking-[0.3em]">
                PROTOCOLO_SEGURO_IA_SENTINEL
            </div>
        </div>
    );
};
