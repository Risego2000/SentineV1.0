import React from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { createPortal } from 'react-dom';

export const HelpCapsule = () => {
  const { helpMsg } = useSentinel();

  if (!helpMsg || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[9999] flex justify-center pointer-events-none px-2 max-w-[96vw]">
      <div className="bg-blue-500/22 backdrop-blur-md border border-blue-300/45 px-4 sm:px-6 py-3 rounded-[9px] shadow-[0_0_40px_rgba(59,130,246,0.35)] flex items-center gap-3 transition-all duration-300 scale-100 opacity-100 max-w-[min(96vw,1200px)]">
        <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_white] shrink-0" />
        <span className="text-[11px] sm:text-[12px] font-black text-white uppercase tracking-[0.12em] leading-5 drop-shadow-lg break-words whitespace-normal text-center">
          {helpMsg}
        </span>
      </div>
    </div>,
    document.body
  );
};
