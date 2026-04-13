import React from 'react';
import { Monitor, Globe, Upload } from 'lucide-react';
import { useFocusedViewerStore } from '../../stores/focusedViewerStore';
import { useLayoutStore } from '../../stores/layoutStore';

export const SharedHeaderActions = () => {
  const { viewerId, source, onScreenShareFn, onIpCameraFn, onUploadFn } =
    useFocusedViewerStore();
  const { gridSize } = useLayoutStore();

  const activeMode = source === 'upload' ? 'video' : source;
  const isActive = (mode: string) => activeMode === mode;
  const viewerNum = viewerId.replace('visor_', '');

  const btnBase =
    'h-10 px-4 rounded-full font-black text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black';
  const btnActive = 'bg-cyan-500 text-black shadow-cyan-500/30';
  const btnIdle =
    'bg-black/50 border border-white/10 text-slate-400 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/30';

  return (
    <div className="shrink-0 h-14 bg-[#020617]/98 border-b border-white/5 flex items-center px-6 gap-3 z-50">
      {/* Active viewer badge — only visible in multi-viewer mode */}
      {gridSize > 1 && (
        <div className="flex items-center gap-2 pr-4 border-r border-white/10 mr-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="text-[9px] font-black text-cyan-500/70 uppercase tracking-[0.4em]">
            VISOR_{viewerNum}
          </span>
        </div>
      )}

      <button
        onClick={() => onScreenShareFn?.()}
        aria-label="Compartir ventana"
        className={`${btnBase} min-w-[150px] ${isActive('live') ? btnActive : btnIdle}`}
      >
        <Monitor size={14} className={isActive('live') ? 'animate-pulse' : ''} />
        Compartir Ventana
      </button>

      <button
        onClick={() => onIpCameraFn?.()}
        aria-label="Camara IP"
        className={`${btnBase} min-w-[120px] ${isActive('ip') ? btnActive : btnIdle}`}
      >
        <Globe size={14} className={isActive('ip') ? 'animate-pulse' : ''} />
        Camara IP
      </button>

      <button
        onClick={() => onUploadFn?.()}
        aria-label="Subir video"
        className={`${btnBase} min-w-[120px] ${
          isActive('video')
            ? btnActive
            : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-slate-900/60 hover:text-slate-300 hover:border-white/20'
        }`}
      >
        <Upload size={14} />
        Subir Video
      </button>

      {/* Right side: app label */}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[9px] font-mono text-white/10 uppercase tracking-[0.4em] hidden md:block">
          SENTINEL_AI_SUPREME_V16
        </span>
      </div>
    </div>
  );
};
