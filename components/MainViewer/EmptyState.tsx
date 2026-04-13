import React from 'react';
import logo from '../../LOGO.png';
import { useLayoutStore } from '../../stores/layoutStore';

// Renders the logo as a cyan mask (exact colour match to text-cyan-500)
const LogoMask = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div
    className={'bg-cyan-500 animate-pulse ' + (className ?? '')}
    style={{
      WebkitMaskImage: `url(${logo})`,
      maskImage: `url(${logo})`,
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
      ...style,
    }}
  />
);

export const EmptyState = () => {
  const { gridSize } = useLayoutStore();
  const mini    = gridSize >= 3;
  const compact = gridSize >= 2;

  // ── MINI (4 viewers) ───────────────────────────────────────────────
  if (mini)
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-30 bg-[#020617]">
        <div className="relative flex items-center justify-center">
          <div className="w-14 h-14 border border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <LogoMask className="absolute" style={{ width: 24, height: 24 }} />
        </div>
        <span className="text-cyan-500/30 font-mono text-[7px] tracking-widest uppercase text-center px-2">
          SENTINEL.V16
        </span>
      </div>
    );

  // ── COMPACT (2 viewers) ────────────────────────────────────────────
  if (compact)
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-30 bg-[#020617] p-6">
        <div className="relative flex items-center justify-center">
          <div className="w-28 h-28 border border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
          <LogoMask className="absolute" style={{ width: 44, height: 44 }} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-cyan-500/30 font-mono text-[8px] tracking-[0.4em] uppercase text-center">
            SENTINEL.V16_ALFA
          </span>
          <div className="flex gap-1">
            {[0, 0.2, 0.4].map((d, i) => (
              <div
                key={i}
                className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
                style={{ animationDelay: `${d}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );

  // ── NORMAL (1 viewer) ──────────────────────────────────────────────
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-12 z-30 bg-[#020617] p-8">
      <div className="relative flex items-center justify-center">
        <div className="w-48 h-48 border-2 border-cyan-500/10 rounded-full animate-spin-slow" />
        <div className="w-40 h-40 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin absolute" />
        <LogoMask className="absolute" style={{ width: 80, height: 80 }} />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-cyan-500/30 font-mono text-[9px] tracking-[0.5em] uppercase text-center">
          Protocolo de Seguridad: SENTINEL.V16_ALFA
        </span>
        <div className="flex gap-1">
          {[0, 0.2, 0.4].map((d, i) => (
            <div
              key={i}
              className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
