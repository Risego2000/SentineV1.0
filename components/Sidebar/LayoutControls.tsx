import React from 'react';
import { LayoutGrid, Square, Grid2X2 } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useHelp } from '../../hooks/useHelp';

export const LayoutControls = () => {
  const { gridSize, setGridSize } = useLayoutStore();
  const { helpProps } = useHelp();

  return (
    <div className="space-y-3">
      <h3
        className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
        {...helpProps('Controla la disposición y el número de visores simultáneos.')}
      >
        <LayoutGrid size={14} className="text-cyan-500" /> Disposición Visual
      </h3>
      <div className="glass-card rounded-[20px] p-1.5 flex items-center gap-1 shadow-2xl relative overflow-hidden bg-slate-950/60 border border-white/5">
        <div className="absolute inset-0 hud-grid opacity-10 pointer-events-none" />

        <button
          onClick={() => setGridSize(1)}
          className={`relative z-10 flex-1 flex items-center justify-center py-3 rounded-2xl transition-all duration-300 ${
            gridSize === 1
              ? 'bg-cyan-950/80 shadow-[0_0_15px_rgba(6,182,212,0.2)] border border-cyan-500/30'
              : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-900/50 border border-transparent'
          }`}
          title="1x1 (Single Viewer)"
        >
          <Square className={`w-6 h-6 ${gridSize === 1 ? 'text-cyan-400' : ''}`} />
        </button>

        <button
          onClick={() => setGridSize(2)}
          className={`relative z-10 flex-1 flex items-center justify-center py-3 rounded-2xl transition-all duration-300 ${
            gridSize === 2
              ? 'bg-cyan-950/80 shadow-[0_0_15px_rgba(6,182,212,0.2)] border border-cyan-500/30'
              : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-900/50 border border-transparent'
          }`}
          title="2x1 (Dual Viewer)"
        >
          <LayoutGrid className={`w-6 h-6 rotate-90 ${gridSize === 2 ? 'text-cyan-400' : ''}`} />
        </button>

        <button
          onClick={() => setGridSize(4)}
          className={`relative z-10 flex-1 flex items-center justify-center py-3 rounded-2xl transition-all duration-300 ${
            gridSize === 4
              ? 'bg-cyan-950/80 shadow-[0_0_15px_rgba(6,182,212,0.2)] border border-cyan-500/30'
              : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-900/50 border border-transparent'
          }`}
          title="2x2 (Quad Viewer)"
        >
          <Grid2X2 className={`w-6 h-6 ${gridSize === 4 ? 'text-cyan-400' : ''}`} />
        </button>
      </div>
    </div>
  );
};
