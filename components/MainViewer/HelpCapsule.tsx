import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { Info } from 'lucide-react';

export const HelpCapsule = () => {
  const { helpMsg } = useSentinel();

  if (!helpMsg) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex justify-center pointer-events-none min-w-[300px]">
      <div className="bg-blue-600 border-2 border-white/20 px-8 py-3 rounded-2xl shadow-[0_0_50px_rgba(59,130,246,0.5)] flex items-center gap-4 transition-all duration-300 scale-100 opacity-100 whitespace-nowrap">
        <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_white]" />
        <span className="text-[12px] font-black text-white uppercase tracking-[0.15em] leading-none drop-shadow-lg">
          {helpMsg}
        </span>
      </div>
    </div>
  );
};
