import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { useLayoutStore } from '../../stores/layoutStore';

interface VideoTimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const VideoTimeline: React.FC<VideoTimelineProps> = ({ videoRef }) => {
  const { logs, isPlaying } = useSentinel();
  const { gridSize } = useLayoutStore();
  const compact = gridSize >= 2;
  const mini = gridSize >= 3;
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let af: number;
    const tick = () => {
      const v = videoRef.current;
      if (v && !isNaN(v.duration)) {
        setDuration(v.duration);
        setProgress((v.currentTime / v.duration) * 100);
      }
      if (isPlaying) af = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(af);
  }, [isPlaying, videoRef]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * videoRef.current.duration;
    videoRef.current.currentTime = t;
    setProgress((t / videoRef.current.duration) * 100);
  };

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!videoRef.current) return;
      const v = videoRef.current;
      const s = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        v.currentTime = Math.max(0, v.currentTime - s);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        v.currentTime = Math.min(v.duration || 0, v.currentTime + s);
      } else if (e.key === 'Home') {
        e.preventDefault();
        v.currentTime = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        v.currentTime = v.duration || 0;
      }
    },
    [videoRef]
  );

  const incidents = logs.filter((l) => l.infraction === true);

  const fmt = (s: number) => {
    if (isNaN(s)) return '00:00';
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = Math.floor(s % 60),
      f = Math.floor((s % 1) * 100);
    return (
      (h > 0 ? `${String(h).padStart(2, '0')}:` : '') +
      `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(f).padStart(2, '0')}`
    );
  };

  const outer = mini
    ? 'absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-2 pb-1 pt-3 bg-gradient-to-t from-black/70 to-transparent'
    : compact
      ? 'absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-4 pb-2 pt-4 bg-gradient-to-t from-black/60 to-transparent'
      : 'absolute bottom-0 left-0 right-0 z-30 pointer-events-none px-8 pb-3 pt-6 bg-gradient-to-t from-black/40 to-transparent';

  const cur = (progress * duration) / 100;

  return (
    <div className={outer}>
      {!mini && (
        <div className={`flex justify-between items-end ${compact ? 'mb-1.5' : 'mb-3'}`}>
          <div className="flex flex-col">
            {!compact && (
              <span className="text-xs font-black text-cyan-500/40 uppercase tracking-[0.3em]">
                Live Vector Tracking
              </span>
            )}
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-black text-white font-mono tracking-tighter drop-shadow-lg ${compact ? 'text-base' : 'text-xl'}`}
              >
                {fmt(cur)}
              </span>
              <span className="text-xs font-bold text-slate-500 font-mono opacity-50">
                / {fmt(duration)}
              </span>
            </div>
          </div>
          <div className="text-right">
            {!compact && (
              <span className="text-xs font-black text-red-500/40 uppercase tracking-[0.3em]">
                Incidents
              </span>
            )}
            <div
              className={`font-black text-red-500 font-mono tracking-widest ${compact ? 'text-base' : 'text-xl'}`}
              aria-live="polite"
            >
              {String(incidents.length).padStart(2, '0')}
            </div>
          </div>
        </div>
      )}
      <div className="relative group pointer-events-auto">
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
          className={`bg-slate-900/60 backdrop-blur-md rounded-full border border-white/5 cursor-pointer overflow-hidden relative transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-black ${mini ? 'h-1 group-hover:h-2' : 'h-1.5 group-hover:h-3 group-hover:border-cyan-500/20'}`}
        >
          <div
            className="h-full bg-gradient-to-r from-cyan-600/80 to-cyan-400 relative transition-all ease-linear"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-0 bottom-0 w-px bg-white shadow-[0_0_10px_rgba(255,255,255,1)]" />
          </div>
        </div>
        {incidents.map((log, i) => {
          if (log.playbackTime === undefined || duration === 0) return null;
          const pos = (log.playbackTime / duration) * 100;
          const off = mini ? 5 : 8;
          return (
            <div
              key={log.id || i}
              role="button"
              tabIndex={0}
              className={`absolute top-1/2 -translate-y-1/2 bg-red-600 rotate-45 border-2 border-black shadow-[0_0_10px_rgba(239,68,68,0.8)] cursor-pointer group/marker hover:scale-125 z-20 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-red-400 ${mini ? 'w-2.5 h-2.5' : 'w-4 h-4'}`}
              style={{ left: `calc(${pos}% - ${off}px)` }}
              onClick={(e) => {
                e.stopPropagation();
                if (videoRef.current) videoRef.current.currentTime = log.playbackTime!;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (videoRef.current) videoRef.current.currentTime = log.playbackTime!;
                }
              }}
            >
              <div className="w-1 h-1 bg-white rounded-full" />
              {!mini && (
                <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-black/90 border border-red-500/50 px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none">
                  <span className="text-xs font-black text-white uppercase block">
                    {log.ruleCategory}
                  </span>
                  <span className="text-[10px] text-red-400 font-mono">
                    {log.plate} • {fmt(log.playbackTime)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {mini && (
        <div className="flex justify-between mt-0.5">
          <span className="text-[7px] font-mono text-cyan-400/60">{fmt(cur)}</span>
          {incidents.length > 0 && (
            <span className="text-[7px] font-mono text-red-500/60">{incidents.length}x</span>
          )}
        </div>
      )}
    </div>
  );
};
