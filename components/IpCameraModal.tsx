import React, { useState, useEffect, useRef } from 'react';
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
  const modalRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    // Focus first input when modal opens
    firstInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ip-modal-title"
      aria-describedby="ip-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        className="w-full max-w-md bg-[#020617] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-cyan-950/20">
          <div className="flex items-center gap-3">
            <Globe className="text-cyan-500 w-6 h-6" aria-hidden="true" />
            <div>
              <h2
                id="ip-modal-title"
                className="text-base font-black text-white uppercase tracking-widest"
              >
                Enlace Cámara IP
              </h2>
              <p
                id="ip-modal-description"
                className="text-xs text-slate-500 font-bold uppercase tracking-tight"
              >
                Protocolo de recepción de señal remota
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
            aria-label="Cerrar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 bg-slate-900/30 border-b border-white/5">
          <button
            onClick={handleScreenShare}
            className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-2xl font-black text-xs uppercase tracking-[0.15em] transition-all flex items-center justify-center gap-3 border border-cyan-500/20 shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Compartir ventana o aplicación en pantalla para análisis en tiempo real"
          >
            <Monitor size={18} aria-hidden="true" /> Compartir Ventana / App
          </button>
          <div className="relative mt-6 flex items-center" role="separator" aria-label="Opciones de conexión">
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
              <label
                htmlFor="camera-url"
                className="text-xs font-black text-slate-500 uppercase tracking-widest px-1 block"
              >
                Dirección Stream (URL/IP)
              </label>
              <div className="relative">
                <Globe
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/40 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="camera-url"
                  ref={firstInputRef}
                  type="text"
                  required
                  placeholder="rtsp://192.168.1.100:554/stream"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-[11px] text-cyan-100 outline-none focus:border-cyan-500/30 transition-all font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  aria-required="true"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="camera-username"
                  className="text-xs font-black text-slate-500 uppercase tracking-widest px-1 block"
                >
                  Usuario
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/40 w-4 h-4"
                    aria-hidden="true"
                  />
                  <input
                    id="camera-username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-[11px] text-cyan-100 outline-none focus:border-cyan-500/30 transition-all font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="camera-password"
                  className="text-xs font-black text-slate-500 uppercase tracking-widest px-1 block"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/40 w-4 h-4"
                    aria-hidden="true"
                  />
                  <input
                    id="camera-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3.5 pl-11 pr-4 text-[11px] text-cyan-100 outline-none focus:border-cyan-500/30 transition-all font-mono focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(8,145,178,0.2)] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-slate-900"
            aria-label="Sincronizar cámara IP con el sistema"
          >
            <Activity size={16} aria-hidden="true" /> Sincronizar Cámara
          </button>
        </form>
      </div>
    </div>
  );
};
