import React from 'react';
import { Monitor, Globe, Upload } from 'lucide-react';
import { useHelp } from '../../hooks/useHelp';

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

  const isActive = (mode: HeaderActionsProps['activeMode']) => activeMode === mode;

  return (
    <div
      className="header-actions absolute top-3 right-3 md:top-6 md:right-6 z-40 flex flex-row gap-2 md:gap-3 pointer-events-auto items-center"
      role="toolbar"
      aria-label="Seleccionar fuente de video"
    >
      <button
        onClick={onScreenShare}
        role="button"
        aria-pressed={isActive('live')}
        aria-label="Compartir ventana o aplicación en pantalla"
        className={`h-10 md:h-12 px-4 md:px-5 rounded-full font-black text-[9px] md:text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 md:gap-2 min-w-[10rem] md:min-w-[160px] group focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black ${
          isActive('live')
            ? 'bg-cyan-500 text-black shadow-cyan-500/30'
            : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/30'
        }`}
        {...helpProps(
          'Comparte una ventana de navegador, aplicación o toda la pantalla para análisis en tiempo real.'
        )}
      >
        <Monitor size={14} className={isActive('live') ? 'animate-pulse' : ''} />
        Compartir Ventana
      </button>

      <button
        onClick={onIpCamera}
        role="button"
        aria-pressed={isActive('ip')}
        aria-label="Conectar cámara IP remota"
        className={`h-10 md:h-12 px-4 md:px-5 rounded-full font-black text-[9px] md:text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 md:gap-2 min-w-[9rem] md:min-w-[140px] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black ${
          isActive('ip')
            ? 'bg-cyan-500 text-black shadow-cyan-500/30'
            : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/30'
        }`}
        {...helpProps(
          'Conecta una cámara IP remota vía HTTP/HTTPS usando URL directa o stream remoto.'
        )}
      >
        <Globe size={14} className={isActive('ip') ? 'animate-pulse' : ''} />
        Cámara IP
      </button>

      <button
        onClick={onUpload}
        role="button"
        aria-pressed={isActive('video')}
        aria-label="Subir archivo de video local"
        className={`h-10 md:h-12 px-4 md:px-5 rounded-full font-black text-[9px] md:text-[10px] uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-1.5 md:gap-2 min-w-[9rem] md:min-w-[140px] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black ${
          isActive('video')
            ? 'bg-cyan-500 text-black shadow-cyan-500/30'
            : 'bg-black/50 border border-white/10 text-slate-400 hover:bg-slate-900/60 hover:text-slate-300 hover:border-white/20'
        }`}
        {...helpProps(
          'Carga un archivo de video local para realizar un análisis forense diferido.'
        )}
      >
        <Upload size={14} />
        Subir Video
      </button>
    </div>
  );
};
