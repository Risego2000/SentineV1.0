import React from 'react';
import { Activity } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const NeuralStatusHUD = () => {
  const { source, systemStatus, statusMsg, fps, bufferStatus } = useSentinel();
  const modelLoaded = systemStatus.neural === 'ready';

  const getBufferLabel = () => {
    if (source === 'none') return 'BUFFER VIDEO: STANDBY';
    const state = bufferStatus.state.toUpperCase();
    return `BUFFER VIDEO: ${state} [${bufferStatus.seconds}s / 20s]`;
  };

  return (
    <div className="neural-status-hud absolute top-3 md:top-6 left-3 md:left-6 right-3 md:right-6 z-40 flex items-center justify-between pointer-events-none">
      {/* IZQUIERDA: ESTADO DEL SISTEMA */}
      <div className="h-12 md:h-14 px-4 md:px-6 bg-black/90 backdrop-blur border border-white/20 text-cyan-400 rounded-2xl flex items-center gap-3 md:gap-4 shadow-2xl">
        <Activity
          size={20}
          className={
            bufferStatus.state === 'recording'
              ? 'text-red-500 animate-[pulse_0.5s_infinite]'
              : modelLoaded
                ? 'text-green-500 animate-pulse'
                : 'text-amber-500'
          }
        />
        <div className="flex flex-col justify-center">
          <span
            className={`text-[10px] md:text-xs font-black uppercase tracking-wider leading-none mb-1 ${
              bufferStatus.state !== 'idle' ? 'text-cyan-400' : 'text-slate-300'
            }`}
          >
            {getBufferLabel()}
          </span>
          <div className="flex gap-3 md:gap-4 text-[9px] md:text-[10px] font-bold font-mono text-slate-500">
            <span
              className={bufferStatus.activeTracks > 0 ? 'text-yellow-500' : 'text-cyan-500/40'}
            >
              OBJETIVOS ACTIVOS: {bufferStatus.activeTracks}
            </span>
            <span className="text-purple-400">FPS: {fps}</span>
            {statusMsg && <span className="text-red-500 animate-pulse ml-2">{statusMsg}</span>}
          </div>
        </div>
      </div>

      {/* CENTRO/DERECHA: MÉTRICAS MOVIDAS AL SIDEBAR */}
    </div>
  );
};
