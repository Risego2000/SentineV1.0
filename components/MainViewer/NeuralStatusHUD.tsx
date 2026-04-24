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
    color: 'text-blue-400',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    segActive: 'bg-blue-500/60',
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
  const mini = gridSize >= 4;
  const compact = gridSize >= 2 && gridSize < 4;

  const phase = bufferStatus.phase ?? 'standby';
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.standby;

  const totalSeg = 40;
  const activeSeg = Math.min(totalSeg, Math.floor(bufferStatus.seconds));
  const pct = Math.round((bufferStatus.seconds / 40) * 100);

  const roiA = bufferStatus.roiALabel ?? 'ROI A';
  const roiB = bufferStatus.roiBLabel ?? 'ROI B';
  const photos = bufferStatus.capturedPhotos ?? 0;
  const plate = bufferStatus.plateCandidate;

  const roiAActive = phase === 'roi_a' || phase === 'confirmed' || phase === 'saving';
  const roiBActive = phase === 'confirmed' || phase === 'saving';

  const iconSz = mini ? 10 : compact ? 12 : 14;
  const shieldSz = mini ? 8 : compact ? 10 : 12;
  const camSz = mini ? 8 : compact ? 10 : 12;
  const pad = mini ? 'px-2 py-1' : compact ? 'px-3 py-1.5' : 'px-4 py-2';
  const gap = mini ? 'gap-2' : compact ? 'gap-3' : 'gap-4';
  const txtTitle = mini ? 'text-[8px]' : compact ? 'text-[10px]' : 'text-[12px]';
  const txtLabel = mini ? 'text-[7px]' : compact ? 'text-[9px]' : 'text-[10px]';
  const txtPct = mini ? 'text-[9px]' : compact ? 'text-[11px]' : 'text-sm';
  const txtRoi = mini ? 'text-[6px]' : compact ? 'text-[7px]' : 'text-[8px]';
  const txtMeta = mini ? 'text-[5px]' : compact ? 'text-[6px]' : 'text-[7px]';
  const txtVal = mini ? 'text-[8px]' : compact ? 'text-[10px]' : 'text-xs';
  const segH = mini ? 'h-1' : compact ? 'h-1.5' : 'h-2';
  const segW = mini ? 'w-24' : compact ? 'w-32' : 'w-48';
  const rounded = mini ? 'rounded-md' : compact ? 'rounded-lg' : 'rounded-xl';
  const pos = mini
    ? 'top-1.5 left-1.5 right-1.5'
    : compact
      ? 'top-2 left-2 right-2'
      : 'top-4 left-4 right-4';

  return (
    <div
      className={
        'neural-status-hud absolute z-40 pointer-events-none select-none flex flex-col gap-2 ' + pos
      }
    >
      <div
        className={
          'bg-[#020617]/90 backdrop-blur-md border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] flex flex-row items-stretch border-l-4 transition-all duration-500 w-full max-w-5xl mx-auto ' +
          rounded +
          ' ' +
          cfg.border
        }
      >
        {/* SECTION 1: HEADER & STATUS */}
        <div className={'flex flex-col justify-center border-r border-white/5 ' + pad}>
          <div className="flex items-center gap-2 mb-1">
            <div className={'p-0.5 rounded bg-black/40 ' + cfg.color}>{cfg.icon(iconSz)}</div>
            <span
              className={
                'font-black uppercase tracking-widest text-white/90 whitespace-nowrap ' + txtTitle
              }
            >
              Buffer Forense
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={'w-1.5 h-1.5 rounded-full flex-shrink-0 ' + cfg.dot} />
            <span
              className={
                'font-black tracking-tight whitespace-nowrap ' + txtLabel + ' ' + cfg.color
              }
            >
              {cfg.label}
            </span>
          </div>
        </div>

        {/* SECTION 2: BUFFER PROGRESS */}
        <div className={'flex flex-col justify-center flex-1 border-r border-white/5 ' + pad}>
          <div className="flex items-center justify-between mb-1">
            <span className={'font-mono font-bold text-slate-500 ' + txtLabel}>
              {bufferStatus.seconds.toFixed(1)}s / 40.0s
            </span>
            <span className={'font-black text-white font-mono leading-none ' + txtPct}>
              {pct}
              <span className="text-slate-500 ml-0.5">%</span>
            </span>
          </div>
          <div className={'flex gap-px w-full ' + segH}>
            {Array.from({ length: totalSeg }).map((_, i) => (
              <div
                key={i}
                className={
                  'flex-1 rounded-sm transition-all duration-300 ' +
                  (i < activeSeg ? cfg.segActive : 'bg-white/5')
                }
              />
            ))}
          </div>
        </div>

        {/* SECTION 3: ROI FLOW */}
        <div
          className={'flex items-center justify-center border-r border-white/5 ' + pad + ' ' + gap}
        >
          <div
            className={
              'px-2 py-0.5 rounded font-black uppercase tracking-wide whitespace-nowrap ' +
              txtRoi +
              ' ' +
              (roiAActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'bg-white/5 text-slate-600 border border-white/5')
            }
          >
            {roiA}
          </div>
          <div
            className={
              'transition-colors duration-500 ' +
              (roiBActive ? 'text-red-400' : roiAActive ? 'text-amber-400/60' : 'text-white/20')
            }
          >
            ▶
          </div>
          <div
            className={
              'px-2 py-0.5 rounded font-black uppercase tracking-wide whitespace-nowrap ' +
              txtRoi +
              ' ' +
              (roiBActive
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-white/5 text-slate-600 border border-white/5')
            }
          >
            {roiB}
          </div>
        </div>

        {/* SECTION 4: METRICS */}
        <div className={'flex items-center ' + pad + ' gap-4'}>
          <div className="flex flex-col">
            <span className={'font-black text-slate-600 uppercase tracking-widest ' + txtMeta}>
              Fotos
            </span>
            <div className="flex items-center gap-1">
              <Camera size={camSz} className="text-blue-400" />
              <span className={'font-black text-white font-mono ' + txtVal}>{photos}</span>
            </div>
          </div>
          <div className="flex flex-col">
            <span className={'font-black text-slate-600 uppercase tracking-widest ' + txtMeta}>
              Matrícula
            </span>
            <span
              className={
                'font-black font-mono truncate max-w-[80px] ' +
                txtVal +
                ' ' +
                (plate ? 'text-amber-400' : 'text-slate-700')
              }
            >
              {plate ?? '---'}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={'font-black text-slate-600 uppercase tracking-widest ' + txtMeta}>
              FPS
            </span>
            <div className="flex items-center gap-1">
              <span className={'font-black text-purple-400 font-mono ' + txtVal}>{fps}</span>
              {statusMsg && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />}
            </div>
          </div>
        </div>
      </div>

      {/* Infraction Banner (if confirmed) */}
      {phase === 'confirmed' && (
        <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-1.5 self-center animate-in fade-in duration-300 backdrop-blur-md">
          <CheckCircle2 size={mini ? 10 : 12} className="text-red-400" />
          <span className={'font-black text-red-400 uppercase tracking-wider ' + txtLabel}>
            {roiA} → {roiB} · INFRACCIÓN CONFIRMADA
          </span>
        </div>
      )}

      {/* Alert banner */}
      {statusMsg && (
        <div
          className={
            'bg-red-500/10 border border-red-500/30 px-3 py-1.5 backdrop-blur-md flex items-center gap-2 self-center animate-in fade-in ' +
            rounded
          }
        >
          <AlertTriangle size={mini ? 10 : 12} className="text-red-500 animate-bounce" />
          <span className={'font-black text-red-500 uppercase tracking-widest ' + txtLabel}>
            {statusMsg}
          </span>
        </div>
      )}
    </div>
  );
};
