import React from 'react';
import { BrainCircuit } from 'lucide-react';

export const EmptyState = () => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 z-30 bg-[#020617] p-20">
        <div className="relative flex items-center justify-center">
            <div className="w-64 h-64 border-2 border-cyan-500/10 rounded-full animate-spin-slow" />
            <div className="w-56 h-56 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin absolute" />
            <BrainCircuit className="w-20 h-20 text-cyan-500 animate-pulse absolute" />
        </div>

        <div className="flex flex-col items-center gap-2">
            <span className="text-cyan-500/30 font-mono text-[9px] tracking-[0.5em] uppercase">
                Protocolo de Seguridad: SENTINEL.V16_ALFA
            </span>
            <div className="flex gap-1">
                <div
                    className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0s' }}
                />
                <div
                    className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                />
                <div
                    className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.4s' }}
                />
            </div>
        </div>
    </div>
);
