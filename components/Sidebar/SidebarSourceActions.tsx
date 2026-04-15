import React from 'react';
import { Monitor, Globe, Upload, Video, Wifi } from 'lucide-react';
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
    <div className="space-y-4 mb-4">
      <div className="flex items-center justify-between px-1">
        <h3
          className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] flex items-center gap-2"
          {...helpProps('Selecciona la fuente de video para el visor activo.')}
        >
          <Video size={11} className="text-blue-500" /> Fuente de Entrada
        </h3>
        {gridSize > 1 && (
          <span className="text-[8px] font-black text-slate-600 tracking-tighter uppercase">
            Visor_{viewerNum}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* NETWORK & IP SECTION */}
        <div className="horizon-card rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 px-1 mb-2">
            <Wifi size={10} className="text-blue-500" />
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
              Red / Directo
            </span>
          </div>

          <button
            onClick={() => onIpCameraFn?.()}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border ${
              activeMode === 'ip'
                ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            }`}
            {...helpProps('Conectar a una cámara IP de red para vigilancia en vivo.')}
          >
            <Globe size={13} />
            <span className="text-[9px] font-black uppercase tracking-wider flex-1">Cámara IP</span>
            {activeMode === 'ip' && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => onScreenShareFn?.()}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border ${
              activeMode === 'live'
                ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
            }`}
            {...helpProps('Compartir pantalla o ventana de aplicación como fuente de video.')}
          >
            <Monitor size={13} />
            <span className="text-[9px] font-black uppercase tracking-wider flex-1">
              Compartir Ventana
            </span>
            {activeMode === 'live' && (
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* LOCAL UPLOAD SECTION */}
        <button
          onClick={() => onUploadFn?.()}
          className={`w-full horizon-card rounded-xl p-4 flex items-center gap-4 transition-all text-left border group ${
            activeMode === 'video'
              ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
              : 'bg-white/[0.01] border-white/5 text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'
          }`}
          {...helpProps('Cargar archivo de video local (MP4, MKV) para análisis forense.')}
        >
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center border transition-colors ${
              activeMode === 'video'
                ? 'bg-blue-500/20 border-blue-500'
                : 'bg-slate-900/50 border-white/5 group-hover:border-white/10'
            }`}
          >
            <Upload size={14} />
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase tracking-widest">Subir Archivo</span>
            <span className="text-[9px] font-medium text-slate-600 uppercase tracking-tighter mt-0.5">
              MP4 / MKV Local
            </span>
          </div>
          {activeMode === 'video' && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </button>
      </div>
    </div>
  );
};
