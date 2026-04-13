import React from 'react';
import {
  ShieldCheck,
  Camera,
  Disc,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Save,
} from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useLayoutStore } from '../../stores/layoutStore';

const PHASE_CONFIG = {
  standby: {
    color: 'text-cyan-400',
    border: 'border-l-cyan-500',
    dot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]',
    segActive: 'bg-cyan-500/60',
    label: 'BUFFER_EN_ESPERA',
    icon: (sz: number) => <Disc size={sz} />,
    pulse: false,
  },
  roi_a: {
    color: 'text-amber-400',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500 animate-pulse',
    segActive: 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)] animate-pulse',
    label: 'ROI_A → GRABANDO',
    icon: (sz: number) => <RotateCcw size={sz} className="animate-spin-slow" />,
    pulse: true,
  },
  confirmed: {
    color: 'text-red-400',
    border: 'border-l-red-500',
    dot: 'bg-red-500 animate-pulse',
    segActive: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]',
    label: 'INFRACCION_CONFIRMADA',
    icon: (sz: number) => <AlertTriangle size={sz} className="animate-bounce" />,
    pulse: true,
  },
  discarded: {
    color: 'text-slate-500',
    border: 'border-l-slate-600',
    dot: 'bg-slate-600',
    segActive: 'bg-slate-600',
    label: 'BUFFER_DESCARTADO',
    icon: (sz: number) => <Disc size={sz} />,
    pulse: false,
  },
  saving: {
    color: 'text-blue-400',
    border: 'border-l-blue-500',
    dot: 'bg-blue-400 animate-pulse',
    segActive: 'bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,0.6)]',
    label: 'GUARDANDO_EVIDENCIA',
    icon: (sz: number) => <Save size={sz} />,
    pulse: false,
  },
};

export const NeuralStatusHUD = () => {
  const { statusMsg, fps, bufferStatus } = useSentinel();
  const { gridSize } = useLayoutStore();

  // mini = 4 viewers, compact = 2 viewers, normal = 1 viewer
  const mini    = gridSize >= 4;
  const compact = gridSize >= 2 && gridSize < 4;

  const phase = bufferStatus.phase ?? 'standby';
  const cfg   = PHASE_CONFIG[phase] ?? PHASE_CONFIG.standby;

  const totalSeg  = 20;
  const activeSeg = Math.min(totalSeg, Math.floor(bufferStatus.seconds));
  const pct       = Math.round((bufferStatus.seconds / 20) * 100);

  const roiA   = bufferStatus.roiALabel ?? 'ROI A';
  const roiB   = bufferStatus.roiBLabel ?? 'ROI B';
  const photos = bufferStatus.capturedPhotos ?? 0;
  const plate  = bufferStatus.plateCandidate;

  const roiAActive = phase === 'roi_a' || phase === 'confirmed' || phase === 'saving';
  const roiBActive = phase === 'confirmed' || phase === 'saving';

  // Scaled tokens
  const iconSz    = mini ? 9  : compact ? 11  : 13;
  const shieldSz  = mini ? 7  : compact ? 9   : 10;
  const camSz     = mini ? 6  : compact ? 7   : 8;
  const topPad    = mini ? 'px-1.5 py-0.5' : compact ? 'px-2 py-1' : 'px-3 py-1.5';
  const bodyPad   = mini ? 'p-1.5'         : compact ? 'p-2'       : 'p-3';
  const gap       = mini ? 'gap-1'         : compact ? 'gap-2'     : 'gap-3';
  const txtTitle  = mini ? 'text-[7px]'    : compact ? 'text-[9px]': 'text-[10px]';
  const txtSub    = mini ? 'text-[5px]'    : compact ? 'text-[6px]': 'text-[7px]';
  const txtLabel  = mini ? 'text-[7px]'    : compact ? 'text-[9px]': 'text-[10px]';
  const txtPct    = mini ? 'text-[10px]'   : compact ? 'text-sm'   : 'text-base';
  const txtSec    = mini ? 'text-[6px]'    : compact ? 'text-[7px]': 'text-[8px]';
  const txtRoi    = mini ? 'text-[6px]'    : compact ? 'text-[7px]': 'text-[8px]';
  const txtMeta   = mini ? 'text-[5px]'    : compact ? 'text-[5px]': 'text-[6px]';
  const txtVal    = mini ? 'text-[7px]'    : compact ? 'text-[9px]': 'text-[10px]';
  const segH      = mini ? 'h-1'           : compact ? 'h-1.5'     : 'h-2';
  const minW      = mini ? 'min-w-[150px]' : compact ? 'min-w-[210px]' : 'min-w-[270px]';
  const rounded   = mini ? 'rounded-lg'    : compact ? 'rounded-xl': 'rounded-2xl';
  const pos       = mini ? 'top-1.5 left-1.5' : compact ? 'top-2 left-2' : 'top-6 left-6';

  return (
    <div className={'neural-status-hud absolute z-40 flex flex-col gap-1 pointer-events-none select-none ' + pos}>
      <div className={'bg-[#020617]/95 backdrop-blur-2xl border border-white/10 overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)] flex flex-col w-full border-l-4 transition-colors duration-500 ' + rounded + ' ' + minW + ' ' + cfg.border}>

        {/* TOP BAR */}
        <div className={'bg-white/5 border-b border-white/5 flex items-center justify-between gap-2 ' + topPad}>
          <div className="flex items-center gap-1.5">
            <div className={'p-0.5 rounded-lg bg-black/40 ' + cfg.color + ' transition-colors duration-500'}>
              {cfg.icon(iconSz)}
            </div>
            <div className="flex flex-col leading-none">
              <span className={'font-black uppercase tracking-[0.15em] text-white/90 ' + txtTitle}>
                Buffer Forense
              </span>
              {!mini && (
                <span className={'font-bold text-white/30 uppercase tracking-widest mt-0.5 ' + txtSub}>
                  20s · CIRCULAR
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-40">
            <ShieldCheck size={shieldSz} className="text-cyan-400" />
            {!mini && (
              <span className={'font-mono font-bold text-white ' + txtSub}>SEC_BOOT</span>
            )}
          </div>
        </div>

        {/* MAIN BODY */}
        <div className={'flex flex-col ' + bodyPad + ' ' + gap}>
          {/* Status label + percentage */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-500 ' + cfg.dot} />
              <span className={'font-black tracking-tight transition-colors duration-500 ' + txtLabel + ' ' + cfg.color}>
                {cfg.label}
              </span>
            </div>
            <span className={'font-black text-white font-mono leading-none ' + txtPct}>
              {pct}<span className={'text-slate-500 ml-0.5 ' + txtSub}>%</span>
            </span>
          </div>

          {/* 20-segment bar */}
          <div className={'flex gap-px ' + segH}>
            {Array.from({ length: totalSeg }).map((_, i) => (
              <div
                key={i}
                className={'flex-1 rounded-sm transition-all duration-300 ' + (i < activeSeg ? cfg.segActive : 'bg-white/5')}
              />
            ))}
          </div>

          {/* Seconds */}
          <span className={'font-mono font-bold text-slate-500 -mt-1 ' + txtSec}>
            {bufferStatus.seconds.toFixed(1)}s / 20.0s
          </span>

          {/* ROI FLOW */}
          <div className="flex items-center gap-1 mt-0.5">
            <div className={'flex-shrink-0 px-1.5 py-0.5 rounded font-black uppercase tracking-wide transition-all duration-500 ' + txtRoi + ' ' + (roiAActive ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-white/5 text-slate-600 border border-white/5')}>
              {roiA}
            </div>
            <div className="flex items-center gap-px flex-1 min-w-0">
              {Array.from({ length: mini ? 3 : 5 }).map((_, i) => (
                <div key={i} className={'flex-1 h-px transition-all duration-500 ' + (roiAActive && !roiBActive ? (i < (mini ? 2 : 3) ? 'bg-amber-500/60' : 'bg-white/10') : roiBActive ? 'bg-red-500/70' : 'bg-white/10')} />
              ))}
              <div className={'transition-colors duration-500 text-[8px] ' + (roiBActive ? 'text-red-400' : roiAActive ? 'text-amber-400/60' : 'text-white/20')}>▶</div>
            </div>
            <div className={'flex-shrink-0 px-1.5 py-0.5 rounded font-black uppercase tracking-wide transition-all duration-500 ' + txtRoi + ' ' + (roiBActive ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-white/5 text-slate-600 border border-white/5')}>
              {roiB}
            </div>
          </div>

          {/* FOOTER METRICS */}
          <div className={'grid grid-cols-3 pt-1.5 border-t border-white/5 mt-0.5 ' + (mini ? 'gap-1' : 'gap-2')}>
            <div className="flex flex-col gap-0.5">
              <span className={'font-black text-slate-600 uppercase tracking-widest ' + txtMeta}>Fotos</span>
              <div className="flex items-center gap-1">
                <Camera size={camSz} className="text-cyan-400 flex-shrink-0" />
                <span className={'font-black text-white font-mono ' + txtVal}>{photos}</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={'font-black text-slate-600 uppercase tracking-widest ' + txtMeta}>Matrícula</span>
              <span className={'font-black font-mono truncate ' + txtVal + ' ' + (plate ? 'text-amber-400' : 'text-slate-700')}>
                {plate ?? '---'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 items-end border-l border-white/5 pl-1">
              <span className={'font-black text-slate-600 uppercase tracking-widest ' + txtMeta}>FPS</span>
              <div className="flex items-center gap-1">
                <span className={'font-black text-purple-400 font-mono ' + txtVal}>{fps}</span>
                {statusMsg && <div className="w-1 h-1 rounded-full bg-red-500 animate-ping flex-shrink-0" />}
              </div>
            </div>
          </div>

          {/* Infraction banner */}
          {phase === 'confirmed' && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 animate-in fade-in duration-300">
              <CheckCircle2 size={mini ? 7 : 9} className="text-red-400 flex-shrink-0" />
              <span className={'font-black text-red-400 uppercase tracking-wider truncate ' + (mini ? 'text-[6px]' : 'text-[8px]')}>
                {roiA} → {roiB} · GIRO PROHIBIDO
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {statusMsg && (
        <div className={'bg-red-500/10 border border-red-500/30 px-2 py-1 backdrop-blur-md flex items-center gap-1.5 self-start animate-in slide-in-from-left-2 ' + rounded}>
          <AlertTriangle size={mini ? 8 : 10} className="text-red-500 animate-bounce" />
          <span className={'font-black text-red-500 uppercase tracking-widest truncate ' + (mini ? 'text-[6px] max-w-[60px]' : 'text-[9px] max-w-none')}>
            {statusMsg}
          </span>
        </div>
      )}
    </div>
  );
};
