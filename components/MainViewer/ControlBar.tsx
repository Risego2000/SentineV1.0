import React from 'react';
import { Play, Pause } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import { useLayoutStore } from '../../stores/layoutStore';

export const ControlBar = () => {
  const { isPlaying, setIsPlaying } = useSentinel();
  const { helpProps } = useHelp();
  const { gridSize } = useLayoutStore();
  const compact = gridSize >= 2;
  const mini = gridSize >= 3;
  const togglePlayback = () => setIsPlaying(!isPlaying);

  const dot = (
    <div
      className={`rounded-full flex-shrink-0 ${isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-700'} ${mini ? 'w-1 h-1' : compact ? 'w-1.5 h-1.5' : 'w-2 h-2'}`}
    />
  );

  if (mini)
    return (
      <div className="h-12 bg-[#020617] border-t border-white/5 flex items-center px-3 gap-2 z-50 shrink-0">
        <button
          onClick={togglePlayback}
          className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0 ${isPlaying ? 'bg-red-800 text-white' : 'bg-cyan-500 text-black'}`}
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
        </button>
        {dot}
        <span className="text-[7px] font-black text-cyan-500/60 tracking-[0.3em] uppercase truncate">
          {isPlaying ? 'ANALIZANDO' : 'EN_ESPERA'}
        </span>
      </div>
    );

  if (compact)
    return (
      <div className="h-[72px] bg-[#020617] border-t border-white/5 flex items-center justify-between px-5 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlayback}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 ${isPlaying ? 'bg-red-800 text-white' : 'bg-cyan-500 text-black'}`}
          >
            {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
          </button>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-black italic text-white uppercase tracking-tight">
              UNIDAD_01
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {dot}
              <span className="text-[7px] font-black text-cyan-500/60 tracking-[0.3em] uppercase">
                {isPlaying ? 'ANALIZANDO' : 'EN_ESPERA'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );

  return (
    <div className="h-28 bg-[#020617] border-t border-white/5 flex items-center justify-between px-10 z-50 shrink-0">
      <div className="flex items-center gap-10">
        <button
          onClick={togglePlayback}
          {...helpProps(
            isPlaying ? 'Pausa la transmision bionica.' : 'Inicia el analisis de vectores.'
          )}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 ${isPlaying ? 'bg-red-800 text-white' : 'bg-cyan-500 text-black'}`}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
        </button>
        <div className="flex flex-col">
          <span className="text-2xl font-black italic text-white uppercase leading-none tracking-tighter">
            UNIDAD_PREDICTIVA_01
          </span>
          <div className="flex items-center gap-3 mt-2">
            {dot}
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
