import React from 'react';
import { BrainCircuit } from 'lucide-react';

interface ForensicAnalysisOverlayProps {
    isAnalyzing: boolean;
}

export const ForensicAnalysisOverlay = ({ isAnalyzing }: ForensicAnalysisOverlayProps) => {
    if (!isAnalyzing) return null;

    return (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-300">
            <div className="flex flex-col items-center gap-6">
                <div className="relative w-32 h-32 flex items-center justify-center">
                    {/* Outer Ring - Spinning Slow */}
                    <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
                    <div className="absolute inset-0 border-4 border-transparent border-t-cyan-500 rounded-full animate-spin duration-[3000ms]" />

                    {/* Inner Ring - Spinning Fast Reverse */}
                    <div className="absolute inset-4 border-2 border-cyan-400/20 rounded-full" />
                    <div className="absolute inset-4 border-2 border-transparent border-b-cyan-400 rounded-full animate-spin-reverse" />

                    {/* Central Icon */}
                    <div className="relative z-10 p-4 bg-black/50 rounded-full border border-cyan-500/30 backdrop-blur-md shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                        <BrainCircuit size={40} className="text-cyan-400 animate-pulse" />
                    </div>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <span className="text-cyan-400 font-black tracking-[0.3em] text-sm uppercase animate-pulse">
                        Auditoría Forense
                    </span>
                    <span className="text-[10px] text-cyan-500/60 font-mono tracking-widest">
                        PROCESANDO CONDUCTA VIAL
                    </span>
                </div>
            </div>
        </div>
    );
};
