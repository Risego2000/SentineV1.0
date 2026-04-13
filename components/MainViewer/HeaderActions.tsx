import React from 'react';
import { Monitor, Globe, Upload } from 'lucide-react';
import { useHelp } from '../../hooks/useHelp';
import { useLayoutStore } from '../../stores/layoutStore';

interface HeaderActionsProps {
  onScreenShare: () => void;
  onIpCamera: () => void;
  onUpload: () => void;
  activeMode: 'video' | 'live' | 'ip' | 'none';
}

export const HeaderActions = ({
  onScreenShare,
  onIpCamera,
  onUpload,
  activeMode,
}: HeaderActionsProps) => {
  const { helpProps } = useHelp();
  const { gridSize } = useLayoutStore();
  const compact = gridSize >= 2;
  const mini = gridSize >= 3;
  const isActive = (m: HeaderActionsProps['activeMode']) => activeMode === m;

  if (mini)
    return (
      <div className="absolute top-1.5 right-1.5 z-40 flex flex-row gap-1 pointer-events-auto">
        {(
          [
            {
              icon: <Monitor size={11} className={isActive('live') ? 'animate-pulse' : ''} />,
              fn: onScreenShare,
              mode: 'live' as const,
              lbl: 'Compartir',
            },
            {
              icon: <Globe size={11} className={isActive('ip') ? 'animate-pulse' : ''} />,
              fn: onIpCamera,
              mode: 'ip' as const,
              lbl: 'Camara IP',
            },
            { icon: <Upload size={11} />, fn: onUpload, mode: 'video' as const, lbl: 'Video' },
          ] as const
        ).map(({ icon, fn, mode, lbl }) => (
          <button
            key={mode}
            onClick={fn}
            title={lbl}
            aria-label={lbl}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isActive(mode) ? 'bg-cyan-500 text-black' : 'bg-black/60 border border-white/10 text-slate-400 hover:bg-cyan-950/60 hover:text-cyan-300'}`}
          >
            {icon}
          </button>
        ))}
      </div>
    );

  if (compact)
    return (
      <div className="absolute top-3 right-3 z-40 flex flex-row gap-2 pointer-events-auto items-center">
        <button
          onClick={onScreenShare}
          aria-label="Compartir ventana"
          className={`h-9 px-3 rounded-full font-black text-[9px] uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-black focus:ring-offset-2 ${isActive('live') ? 'bg-cyan-500 text-black' : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/30'}`}
          {...helpProps('Compartir ventana')}
        >
          <Monitor size={12} className={isActive('live') ? 'animate-pulse' : ''} />
          <span className="hidden sm:inline">Ventana</span>
        </button>
        <button
          onClick={onIpCamera}
          aria-label="Camara IP"
          className={`h-9 px-3 rounded-full font-black text-[9px] uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-black focus:ring-offset-2 ${isActive('ip') ? 'bg-cyan-500 text-black' : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/30'}`}
          {...helpProps('Camara IP')}
        >
          <Globe size={12} className={isActive('ip') ? 'animate-pulse' : ''} />
          <span className="hidden sm:inline">IP</span>
        </button>
        <button
          onClick={onUpload}
          aria-label="Subir video"
          className={`h-9 px-3 rounded-full font-black text-[9px] uppercase tracking-wider transition-all shadow-lg flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-black focus:ring-offset-2 ${isActive('video') ? 'bg-cyan-500 text-black' : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-slate-900/60 hover:text-slate-300 hover:border-white/20'}`}
          {...helpProps('Subir video')}
        >
          <Upload size={12} />
          <span className="hidden sm:inline">Video</span>
        </button>
      </div>
    );

  return (
    <div
      className="absolute top-6 right-6 z-40 flex flex-row gap-3 pointer-events-auto items-center"
      role="toolbar"
      aria-label="Seleccionar fuente"
    >
      <button
        onClick={onScreenShare}
        aria-pressed={isActive('live')}
        aria-label="Compartir ventana"
        className={`h-12 px-5 rounded-full font-black text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black ${isActive('live') ? 'bg-cyan-500 text-black shadow-cyan-500/30' : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/30'}`}
        {...helpProps('Comparte una ventana para analisis en tiempo real.')}
      >
        <Monitor size={14} className={isActive('live') ? 'animate-pulse' : ''} />
        Compartir Ventana
      </button>
      <button
        onClick={onIpCamera}
        aria-pressed={isActive('ip')}
        aria-label="Conectar camara IP"
        className={`h-12 px-5 rounded-full font-black text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black ${isActive('ip') ? 'bg-cyan-500 text-black shadow-cyan-500/30' : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/30'}`}
        {...helpProps('Conecta camara IP via HTTP/HTTPS.')}
      >
        <Globe size={14} className={isActive('ip') ? 'animate-pulse' : ''} />
        Camara IP
      </button>
      <button
        onClick={onUpload}
        aria-pressed={isActive('video')}
        aria-label="Subir video"
        className={`h-12 px-5 rounded-full font-black text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black ${isActive('video') ? 'bg-cyan-500 text-black shadow-cyan-500/30' : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-slate-900/60 hover:text-slate-300 hover:border-white/20'}`}
        {...helpProps('Carga archivo de video para analisis forense.')}
      >
        <Upload size={14} />
        Subir Video
      </button>
    </div>
  );
};
