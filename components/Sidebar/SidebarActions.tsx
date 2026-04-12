import React from 'react';
import { Signal, Upload, Monitor } from 'lucide-react';
import { useHelp } from '../../hooks/useHelp';

interface SidebarActionsProps {
  startLiveFeed: () => void;
  onIpCamera: () => void;
  onUploadClick: () => void;
}

export const SidebarActions = ({
  startLiveFeed,
  onIpCamera,
  onUploadClick,
}: SidebarActionsProps) => {
  const { helpProps } = useHelp();

  return (
    <div className="p-6 border-t border-white/5 space-y-2 bg-[#020617]">
      <button
        onClick={startLiveFeed}
        className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2"
        {...helpProps(
          'Comparte una ventana o aplicación de tu sistema (Cámara de Tráfico en vivo) para análisis biónico.'
        )}
      >
        <Monitor size={14} /> Señal en Vivo
      </button>
      <button
        onClick={onIpCamera}
        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2"
        {...helpProps('Conecta con cámaras IP y flujos RTSP/HTTP remotos para vigilancia activa.')}
      >
        <Signal size={14} /> Cámara IP
      </button>
      <button
        onClick={onUploadClick}
        className="w-full py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-2"
        {...helpProps('Procesa archivos de video locales para análisis pericial.')}
      >
        <Upload size={14} /> Cargar Video
      </button>
    </div>
  );
};
