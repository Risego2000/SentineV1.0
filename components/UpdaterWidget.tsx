import React, { useEffect, useState } from 'react';
import { isElectron, getElectronAPI } from '../utils/electronDetect';

type UpdaterState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export const UpdaterWidget = () => {
  const [status, setStatus] = useState<UpdaterState>('idle');
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('Sin comprobar');
  const [systemsLabel, setSystemsLabel] = useState('Sistemas pendientes');

  const runSystemsHealthCheck = async () => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    try {
      const ready = await api.api.ready();
      const services = ready?.services || { ffmpeg: false, python: false, paddleOcr: false };
      const allOk = Boolean(services.ffmpeg && services.python && services.paddleOcr);
      setSystemsLabel(
        allOk
          ? 'Sistemas OK (API/FFmpeg/Python/OCR)'
          : `Sistemas con incidencias (${services.ffmpeg ? 'FFmpeg OK' : 'FFmpeg FAIL'} · ${
              services.python ? 'Python OK' : 'Python FAIL'
            } · ${services.paddleOcr ? 'OCR OK' : 'OCR FAIL'})`
      );
    } catch (error) {
      setSystemsLabel('Sistemas con incidencias (sin conexión con backend)');
    }
  };

  const runFullCheck = async () => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    setLabel('Comprobando actualizaciones...');
    setSystemsLabel('Comprobando sistemas...');
    await Promise.allSettled([api.app.checkUpdates(), runSystemsHealthCheck()]);
  };

  useEffect(() => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    const off = api.ipc.on('updater:status', (_event, payload) => {
      const next = String(payload?.status || 'idle') as UpdaterState;
      setStatus(next);
      if (next === 'checking') setLabel('Comprobando...');
      if (next === 'available') setLabel(`Nueva versión ${payload?.version || ''}`.trim());
      if (next === 'not-available') setLabel('Sin actualizaciones');
      if (next === 'downloading') {
        const pct = Number(payload?.percent || 0);
        setProgress(Math.max(0, Math.min(100, pct)));
        setLabel(`Descargando ${pct.toFixed(0)}%`);
      }
      if (next === 'downloaded') setLabel('Lista para instalar');
      if (next === 'error') setLabel(`Error: ${payload?.message || 'desconocido'}`);
    });
    runFullCheck().catch(() => null);
    return () => off?.();
  }, []);

  if (!isElectron()) return null;

  const api = getElectronAPI();

  return (
    <div className="flex items-center gap-2 ml-3">
      <span className="text-[10px] font-mono font-black text-slate-500 uppercase tracking-[0.12em]">
        {label}
      </span>
      <span className="text-[10px] font-mono font-black text-slate-600 uppercase tracking-[0.08em]">
        {systemsLabel}
      </span>
      {status === 'downloading' && (
        <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden border border-white/5">
          <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>
      )}
      {(status === 'idle' || status === 'not-available' || status === 'error') && (
        <button
          onClick={() => runFullCheck()}
          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-500/40 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors leading-none"
        >
          Revisar sistemas
        </button>
      )}
      {status === 'available' && (
        <button
          onClick={() => api.app.downloadUpdate()}
          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-blue-500/40 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 transition-colors leading-none"
        >
          Descargar
        </button>
      )}
      {status === 'downloaded' && (
        <button
          onClick={() => api.app.installUpdate()}
          className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors leading-none"
        >
          Instalar
        </button>
      )}
    </div>
  );
};
