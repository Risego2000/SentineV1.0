import React, { useState } from 'react';
import { Globe, User, Lock, X, Activity, Monitor } from 'lucide-react';
import { useSentinel } from '../hooks/useSentinel';

interface IpCameraModalProps {
  onClose: () => void;
}

export const IpCameraModal = ({ onClose }: IpCameraModalProps) => {
  const { startIpFeed, startScreenShare, videoRef } = useSentinel();
  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startIpFeed({ url, username, password }, videoRef);
    onClose();
  };

  const handleScreenShare = async () => {
    try {
      await startScreenShare(videoRef);
      onClose();
    } catch (error) {
      console.error('Screen share failed', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#020617] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-cyan-950/20">
          <div className="flex items-center gap-3">
            <Globe className="text-cyan-500 w-6 h-6" />
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-widest">
                Enlace Cámara IP
              </h2>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-tight">
                Protocolo de recepción de señal remota
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 bg-slate-900/30 border-b border-white/5">
          <button
            onClick={handleScreenShare}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-3 border border-cyan-500/20 shadow-lg"
          >
            <Monitor size={18} /> Compartir Ventana / App
          </button>
          <div className="relative mt-6 flex items-center">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-[9px] font-black text-slate-600 uppercase">
              Ó Ingresar URL Directa
            </span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 pt-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                Dirección Stream (URL/IP)
              </label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/40 w-4 h-4" />
                <input
                  type="text"
                  required
                  placeholder="rtsp://192.168.1.100:554/stream"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-[11px] text-cyan-100 outline-none focus:border-cyan-500/30 transition-all font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                  Usuario
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/40 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-[11px] text-cyan-100 outline-none focus:border-cyan-500/30 transition-all font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/40 w-4 h-4" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-[11px] text-cyan-100 outline-none focus:border-cyan-500/30 transition-all font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(8,145,178,0.2)]"
          >
            <Activity size={16} /> Sincronizar Cámara
          </button>
        </form>
      </div>
    </div>
  );
};
