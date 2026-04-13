import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { useFocusedViewerStore } from '../../stores/focusedViewerStore';
import { useLayoutStore } from '../../stores/layoutStore';

const SharedVideoTimeline = () => {
  const { videoRef, logs, isPlaying } = useFocusedViewerStore();
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    const v = videoRef?.current;
    if (!v) { setProgress(0); setDuration(0); return; }
    const tick = () => {
      if (!isNaN(v.duration)) {
        setDuration(v.duration);
        setProgress(v.duration > 0 ? (v.currentTime / v.duration) * 100 : 0);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(rafRef.current);
  }, [videoRef, isPlaying]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef?.current;
    if (!timelineRef.current || !v) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * v.duration;
    v.currentTime = t;
    setProgress((t / v.duration) * 100);
  };

  const handleKey = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const v = videoRef?.current;
    if (!v) return;
    const s = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - s); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); v.currentTime = Math.min(v.duration || 0, v.currentTime + s); }
    else if (e.key === 'Home') { e.preventDefault(); v.currentTime = 0; }
    else if (e.key === 'End') { e.preventDefault(); v.currentTime = v.duration || 0; }
  }, [videoRef]);

  const incidents = logs.filter((l) => l.infraction === true);

  const fmt = (s: number) => {
    if (isNaN(s) || s === 0) return '00:00.00';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60), f = Math.floor((s % 1) * 100);
    return (h > 0 ? String(h).padStart(2, '0') + ':' : '') +
      String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0') + '.' + String(f).padStart(2, '0');
  };

  const cur = (progress * duration) / 100;

  return (
    <div className="px-8 pt-4 pb-2">
      <div className="flex justify-between items-end mb-3">
        <div className="flex flex-col">
          <span className="text-xs font-black text-cyan-500/40 uppercase tracking-[0.3em]">Live Vector Tracking</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-black text-white font-mono tracking-tighter drop-shadow-lg">{fmt(cur)}</span>
            <span className="text-xs font-bold text-slate-500 font-mono opacity-50">/ {fmt(duration)}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-black text-red-500/40 uppercase tracking-[0.3em]">Incidents Detected</span>
          <div className="text-xl font-black text-red-500 font-mono tracking-widest drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" aria-live="polite">
            {String(incidents.length).padStart(2, '00')}
          </div>
        </div>
      </div>
      <div className="relative group">
        <div
          ref={timelineRef} role="slider" aria-label="Control de tiempo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}
          tabIndex={0} onClick={handleClick} onKeyDown={handleKey}
          className="h-1.5 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/5 cursor-pointer overflow-hidden relative transition-all duration-300 group-hover:h-3 group-hover:border-cyan-500/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black"
        >
          <div className="h-full bg-gradient-to-r from-cyan-600/80 to-cyan-400 relative transition-all ease-linear" style={{ width: progress + '%' }}>
            <div className="absolute right-0 top-0 bottom-0 w-px bg-white shadow-[0_0_10px_rgba(255,255,255,1)]" />
          </div>
        </div>
        {incidents.map((log, i) => {
          if (log.playbackTime === undefined || duration === 0) return null;
          const pos = (log.playbackTime / duration) * 100;
          return (
            <div key={log.id || i} role="button" tabIndex={0}
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rotate-45 border-2 border-black shadow-[0_0_10px_rgba(239,68,68,0.8)] cursor-pointer group/marker hover:scale-125 z-20 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-400"
              style={{ left: 'calc(' + pos + '% - 8px)' }}
              onClick={(e) => { e.stopPropagation(); const v = videoRef?.current; if (v && log.playbackTime !== undefined) v.currentTime = log.playbackTime; }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const v = videoRef?.current; if (v && log.playbackTime !== undefined) v.currentTime = log.playbackTime; } }}
            >
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-black/90 border border-red-500/50 px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none">
                <span className="text-xs font-black text-white uppercase block">{log.ruleCategory}</span>
                <span className="text-[10px] text-red-400 font-mono">{log.plate} - {fmt(log.playbackTime)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SharedControlBar = () => {
  const { isPlaying, setIsPlayingFn } = useFocusedViewerStore();
  const { focusedViewerId, gridSize } = useLayoutStore();
  const toggle = () => setIsPlayingFn?.(!isPlaying);
  const viewerNum = focusedViewerId.replace('visor_', '');
  return (
    <div className="h-20 bg-[#020617] border-t border-white/5 flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center gap-8">
        <button onClick={toggle} aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
          className={'w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-90 ' + (isPlaying ? 'bg-red-800 text-white' : 'bg-cyan-500 text-black')}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
        </button>
        <div className="flex flex-col leading-none">
          <span className="text-xl font-black italic text-white uppercase tracking-tighter">
            {gridSize > 1 ? 'UNIDAD_0' + viewerNum : 'UNIDAD_PREDICTIVA_01'}
          </span>
          <div className="flex items-center gap-2 mt-1.5">
            <div className={'w-2 h-2 rounded-full ' + (isPlaying ? 'bg-green-500 animate-pulse' : 'bg-slate-700')} />
            <span className="text-[8px] font-black text-cyan-500/60 tracking-[0.4em] uppercase">
              {isPlaying ? 'ANALIZANDO_VECTORES' : 'EN_ESPERA'}
            </span>
          </div>
        </div>
      </div>
      <div className="hidden md:block text-[10px] font-mono text-white/15 uppercase tracking-[0.3em]">PROTOCOLO_SEGURO_IA_SENTINEL</div>
    </div>
  );
};

export const SharedBottomBar = () => (
  <div className="shrink-0 bg-[#020617] z-50">
    <SharedVideoTimeline />
    <SharedControlBar />
  </div>
);
