import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { Info } from 'lucide-react';

export const HelpCapsule = () => {
    const { helpMsg } = useSentinel();

    if (!helpMsg) return null;

    return (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[140px] z-[60] flex items-center justify-center w-full px-10 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md border border-cyan-500/20 px-6 py-2 rounded-full shadow-[0_0_30px_rgba(6,182,212,0.1)] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Info size={14} className="text-cyan-400 shrink-0" />
                <span className="text-[10px] font-medium text-cyan-50/80 uppercase tracking-wide leading-none py-0.5">
                    {helpMsg}
                </span>
            </div>
        </div>
    );
};
