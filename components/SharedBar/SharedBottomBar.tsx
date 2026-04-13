import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { useFocusedViewerStore } from '../../stores/focusedViewerStore';

const fmt = (s: number) => {
  if (isNaN(s) || s <= 0) return '00:00.00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const f = Math.floor((s % 1) * 100);
  return (h > 0 ? String(h).padStart(2, '0') + ':' : '')
    + String(m).padStart(2, '0') + ':'
    + String(sec).padStart(2, '0') + '.'
    + String(f).padStart(2, '0');
};

export const SharedBottomBar = () => {
  const { videoRef, logs, isPlaying, setIsPlayingFn } = useFocusedViewerStore();
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
  const cur = (progress * duration) / 100;

  return (
    <div className="shrink-0 bg-[#020617] border-t border-white/5 z-50 flex items-center gap-3 px-4 h-12">
      <button
        onClick={() => setIsPlayingFn?.(!isPlaying)}
        aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
        className={'w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 ' + (isPlaying ? 'bg-red-800 text-white' : 'bg-cyan-500 text-black')}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <span className="text-[10px] font-mono font-black text-slate-300 tracking-wider shrink-0 w-[72px] text-right tabular-nums">
        {fmt(cur)}
      </span>

      <div className="relative flex-1 group py-3">
        <div
          ref={timelineRef}
          role="slider"
          aria-label="Control de tiempo"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={handleKey}
          className="h-1.5 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/5 cursor-pointer overflow-hidden relative transition-all duration-200 group-hover:h-2.5 group-hover:border-cyan-500/20 focus:outline-none focus:ring-1 focus:ring-cyan-400"
        >
          <div
            className="h-full bg-gradient-to-r from-cyan-600/80 to-cyan-400 relative transition-all ease-linear"
            style={{ width: progress + '%' }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-px bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
          </div>
        </div>
        {incidents.map((log, i) => {
          if (log.playbackTime === undefined || duration === 0) return null;
          const pos = (log.playbackTime / duration) * 100;
          return (
            <div
              key={log.id || i}
              role="button"
              tabIndex={0}
              aria-label={'Incidente: ' + log.ruleCategory}
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rotate-45 border border-black shadow-[0_0_8px_rgba(239,68,68,0.8)] cursor-pointer group/marker hover:scale-125 z-20 flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-red-400"
              style={{ left: 'calc(' + pos + '% - 6px)' }}
              onClick={(e) => { e.stopPropagation(); const v = videoRef?.current; if (v && log.playbackTime !== undefined) v.currentTime = log.playbackTime; }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const v = videoRef?.current; if (v && log.playbackTime !== undefined) v.currentTime = log.playbackTime; } }}
            >
              <div className="w-0.5 h-0.5 bg-white rounded-full" />
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-black/90 border border-red-500/50 px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none">
                <span className="text-[10px] font-black text-white uppercase block">{log.ruleCategory}</span>
                <span className="text-[9px] text-red-400 font-mono">{log.plate} - {fmt(log.playbackTime)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <span className="text-[10px] font-mono font-black text-slate-600 tracking-wider shrink-0 w-[72px] tabular-nums">
        {fmt(duration)}
      </span>

      {incidents.length > 0 && (
        <div className="shrink-0 flex items-center gap-1.5 bg-red-950/40 border border-red-500/20 rounded-lg px-2.5 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-black font-mono text-red-400 tracking-wider tabular-nums">
            {String(incidents.length).padStart(2, '0')}
          </span>
        </div>
      )}
    </div>
  );
};
