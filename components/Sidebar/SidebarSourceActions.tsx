import React from 'react';
import { Monitor, Globe, Upload, Video } from 'lucide-react';
import { useFocusedViewerStore } from '../../stores/focusedViewerStore';
import { useLayoutStore } from '../../stores/layoutStore';
import { useHelp } from '../../hooks/useHelp';

export const SidebarSourceActions = () => {
  const { source, onScreenShareFn, onIpCameraFn, onUploadFn, viewerId } = useFocusedViewerStore();
  const { gridSize } = useLayoutStore();
  const { helpProps } = useHelp();
  const activeMode = source === 'upload' ? 'video' : source;
  const viewerNum = viewerId.replace('visor_', '');

  return (
    <div className="space-y-3">
      <h3
        className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
        {...helpProps('Selecciona la fuente de video para el visor activo.')}
      >
        <Video size={14} className="text-cyan-500" />
        Fuente de Video
        {gridSize > 1 && (
          <span className="ml-auto text-[9px] font-black text-cyan-500/50 tracking-[0.3em]">
            VISOR_{viewerNum}
          </span>
        )}
      </h3>

      <div className="glass-card rounded-[20px] p-2 space-y-1.5 bg-slate-950/60 border border-white/5">
        <button
          onClick={() => onScreenShareFn?.()}
          aria-label="Compartir ventana"
          className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ' + (activeMode === 'live' ? 'bg-cyan-950/80 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]' : 'border border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-cyan-300 hover:border-cyan-500/20')}
        >
          <Monitor size={14} className={activeMode === 'live' ? 'text-cyan-400 animate-pulse' : 'text-slate-500'} />
          <span className="text-[10px] font-black uppercase tracking-wider">
            {activeMode === 'live' ? 'EN DIRECTO' : 'Compartir Ventana'}
          </span>
          {activeMode === 'live' && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => onIpCameraFn?.()}
          aria-label="Camara IP"
          className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ' + (activeMode === 'ip' ? 'bg-cyan-950/80 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]' : 'border border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-cyan-300 hover:border-cyan-500/20')}
        >
          <Globe size={14} className={activeMode === 'ip' ? 'text-cyan-400 animate-pulse' : 'text-slate-500'} />
          <span className="text-[10px] font-black uppercase tracking-wider">
            {activeMode === 'ip' ? 'CAMARA CONECTADA' : 'Camara IP'}
          </span>
          {activeMode === 'ip' && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => onUploadFn?.()}
          aria-label="Subir video"
          className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all text-left ' + (activeMode === 'video' ? 'bg-cyan-950/80 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]' : 'border border-transparent text-slate-400 hover:bg-slate-900/50 hover:text-slate-300 hover:border-white/10')}
        >
          <Upload size={14} className={activeMode === 'video' ? 'text-cyan-400' : 'text-slate-500'} />
          <span className="text-[10px] font-black uppercase tracking-wider">
            {activeMode === 'video' ? 'VIDEO CARGADO' : 'Subir Video'}
          </span>
          {activeMode === 'video' && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400" />
          )}
        </button>
      </div>
    </div>
  );
};
