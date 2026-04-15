import React from 'react';
import { LayoutGrid, Square, Grid2X2, Eye, EyeOff, ScanLine, Map } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useHelp } from '../../hooks/useHelp';

const TwoColumns = ({ className }: { className?: string }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="18" rx="1.5" />
    <rect x="14" y="3" width="7" height="18" rx="1.5" />
  </svg>
);

export const LayoutControls = () => {
  const { gridSize, setGridSize, showDetections, toggleDetections, showROIs, toggleROIs } =
    useLayoutStore();
  const { helpProps } = useHelp();

  return (
    <div className="space-y-[10px]">
      <h3
        className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
        {...helpProps('Controla la disposición y el número de visores simultáneos.')}
      >
        <LayoutGrid size={14} className="text-blue-500" /> VISUALIZACIÓN
      </h3>

      <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-4">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setGridSize(1)}
            className={`flex-1 flex items-center justify-center py-3 rounded-[12px] border transition-all duration-300 ${
              gridSize === 1
                ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            }`}
            {...helpProps('Vista de visor único 1x1')}
          >
            <Square className="w-5 h-5" />
          </button>

          <button
            onClick={() => setGridSize(2)}
            className={`flex-1 flex items-center justify-center py-3 rounded-[12px] border transition-all duration-300 ${
              gridSize === 2
                ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            }`}
            {...helpProps('Vista de doble visor 2x1')}
          >
            <TwoColumns className="w-5 h-5" />
          </button>

          <button
            onClick={() => setGridSize(4)}
            className={`flex-1 flex items-center justify-center py-3 rounded-[12px] border transition-all duration-300 ${
              gridSize === 4
                ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            }`}
            {...helpProps('Vista cuádruple de visores 2x2')}
          >
            <Grid2X2 className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleDetections}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-[12px] border transition-all duration-300 ${
              showDetections
                ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            }`}
            {...helpProps('Muestra u oculta los cuadros de detección de vehículos y telemetría.')}
          >
            {showDetections ? <ScanLine size={14} /> : <EyeOff size={14} />}
            <span className="text-[9px] font-bold uppercase tracking-wider">
              {showDetections ? 'Detecciones ON' : 'Detecciones OFF'}
            </span>
          </button>

          <button
            onClick={toggleROIs}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-[12px] border transition-all duration-300 ${
              showROIs
                ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                : 'bg-black/20 border-white/5 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
            }`}
            {...helpProps('Muestra u oculta las zonas de análisis ROI y líneas configuradas.')}
          >
            {showROIs ? <Map size={14} /> : <EyeOff size={14} />}
            <span className="text-[9px] font-bold uppercase tracking-wider">
              {showROIs ? 'Zonas ROI ON' : 'Zonas ROI OFF'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
