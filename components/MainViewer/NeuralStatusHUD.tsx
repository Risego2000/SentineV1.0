import React from 'react';
import { ShieldCheck, Camera, Disc, AlertTriangle, CheckCircle2, RotateCcw, Save } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

/** Icon + color palette per phase */
const PHASE_CONFIG = {
  standby: {
    color: 'text-cyan-400',
    border: 'border-l-cyan-500',
    dot: 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)]',
    segActive: 'bg-cyan-500/60',
    label: 'BUFFER_EN_ESPERA',
    icon: <Disc size={13} />,
    pulse: false,
  },
  roi_a: {
    color: 'text-amber-400',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500 animate-pulse',
    segActive: 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)] animate-pulse',
    label: 'ROI_A \u2192 GRABANDO',
    icon: <RotateCcw size={13} className="animate-spin-slow" />,
    pulse: true,
  },
  confirmed: {
    color: 'text-red-400',
    border: 'border-l-red-500',
    dot: 'bg-red-500 animate-pulse',
    segActive: 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]',
    label: 'INFRACCION_CONFIRMADA',
    icon: <AlertTriangle size={13} className="animate-bounce" />,
    pulse: true,
  },
  discarded: {
    color: 'text-slate-500',
    border: 'border-l-slate-600',
    dot: 'bg-slate-600',
    segActive: 'bg-slate-600',
    label: 'BUFFER_DESCARTADO',
    icon: <Disc size={13} />,
    pulse: false,
  },
  saving: {
    color: 'text-blue-400',
    border: 'border-l-blue-500',
    dot: 'bg-blue-400 animate-pulse',
    segActive: 'bg-blue-400 shadow-[0_0_4px_rgba(96,165,250,0.6)]',
    label: 'GUARDANDO_EVIDENCIA',
    icon: <Save size={13} />,
    pulse: false,
  },
};

export const NeuralStatusHUD = () => {
  const { source, systemStatus, statusMsg, fps, bufferStatus } = useSentinel();
  const modelLoaded = systemStatus.neural === 'ready';

  const phase = bufferStatus.phase ?? 'standby';
  const cfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.standby;

  const totalSeg = 20;
  const activeSeg = Math.min(totalSeg, Math.floor(bufferStatus.seconds));
  const pct = Math.round((bufferStatus.seconds / 20) * 100);

  const roiA = bufferStatus.roiALabel ?? 'ROI A';
  const roiB = bufferStatus.roiBLabel ?? 'ROI B';
  const photos = bufferStatus.capturedPhotos ?? 0;
  const plate = bufferStatus.plateCandidate;

  const roiAActive = phase === 'roi_a' || phase === 'confirmed' || phase === 'saving';
  const roiBActive = phase === 'confirmed' || phase === 'saving';

  return (
    <div className="neural-status-hud absolute top-2 md:top-6 left-2 md:left-6 z-40 flex flex-col gap-1 md:gap-2 pointer-events-none max-w-[90%] sm:max-w-none select-none">
      <div
        className={`bg-[#020617]/95 backdrop-blur-2xl border border-white/10 rounded-xl md:rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.7)] flex flex-col w-full min-w-[170px] md:min-w-[270px] border-l-4 ${cfg.border} transition-colors duration-500`}
      >
        {/* ── TOP BAR ─────────────────────────────────────── */}
        <div className="bg-white/5 px-2 py-1 md:px-3 md:py-1.5 border-b border-white/5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 md:gap-2">
            <div className={`p-1 rounded-lg bg-black/40 ${cfg.color} transition-colors duration-500`}>
              {cfg.icon}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.15em] text-white/90">
                Buffer Forense
              </span>
              <span className="text-[6px] md:text-[7px] font-bold text-white/30 uppercase tracking-widest mt-0.5 hidden xs:block">
                20s · CIRCULAR
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-40">
            <ShieldCheck size={10} className="text-cyan-400" />
            <span className="text-[7px] font-mono font-bold text-white hidden sm:inline">SEC_BOOT</span>
          </div>
        </div>

        {/* ── MAIN BODY ────────────────────────────────────── */}
        <div className="p-2 md:p-3 flex flex-col gap-2 md:gap-3">

          {/* Status label + percentage */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot} transition-all duration-500`} />
              <span className={`text-[8px] md:text-[10px] font-black tracking-tight ${cfg.color} transition-colors duration-500`}>
                {cfg.label}
              </span>
            </div>
            <span className="text-[11px] md:text-base font-black text-white font-mono leading-none">
              {pct}<span className="text-[7px] text-slate-500 ml-0.5">%</span>
            </span>
          </div>

          {/* 20-segment bar */}
          <div className="flex gap-px h-1.5 md:h-2">
            {Array.from({ length: totalSeg }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-all duration-300 ${
                  i < activeSeg ? cfg.segActive : 'bg-white/5'
                }`}
              />
            ))}
          </div>

          {/* Seconds */}
          <span className="text-[7px] md:text-[8px] font-mono font-bold text-slate-500 -mt-1">
            {bufferStatus.seconds.toFixed(1)}s / 20.0s
          </span>

          {/* ── ROI FLOW INDICATOR ─────────────────────────── */}
          <div className="flex items-center gap-1 md:gap-1.5 mt-0.5">
            {/* ROI A bubble */}
            <div
              className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wide transition-all duration-500 ${
                roiAActive
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'bg-white/5 text-slate-600 border border-white/5'
              }`}
            >
              {roiA}
            </div>

            {/* Arrow connector with dots */}
            <div className="flex items-center gap-px flex-1 min-w-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-px transition-all duration-500 ${
                    roiAActive && !roiBActive
                      ? i < 3 ? 'bg-amber-500/60' : 'bg-white/10'
                      : roiBActive
                      ? 'bg-red-500/70'
                      : 'bg-white/10'
                  }`}
                />
              ))}
              <div className={`text-[8px] transition-colors duration-500 ${roiBActive ? 'text-red-400' : roiAActive ? 'text-amber-400/60' : 'text-white/20'}`}>▶</div>
            </div>

            {/* ROI B bubble */}
            <div
              className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-wide transition-all duration-500 ${
                roiBActive
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'bg-white/5 text-slate-600 border border-white/5'
              }`}
            >
              {roiB}
            </div>
          </div>

          {/* ── FOOTER METRICS ──────────────────────────────── */}
          <div className="grid grid-cols-3 gap-1 md:gap-2 pt-2 border-t border-white/5 mt-0.5">
            {/* Captured photos */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[5px] md:text-[6px] font-black text-slate-600 uppercase tracking-widest">Fotos</span>
              <div className="flex items-center gap-1">
                <Camera size={8} className="text-cyan-400 flex-shrink-0" />
                <span className="text-[8px] md:text-[10px] font-black text-white font-mono">{photos}</span>
              </div>
            </div>

            {/* Plate OCR */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[5px] md:text-[6px] font-black text-slate-600 uppercase tracking-widest">Matrícula</span>
              <span className={`text-[7px] md:text-[9px] font-black font-mono truncate ${plate ? 'text-amber-400' : 'text-slate-700'}`}>
                {plate ?? '---'}
              </span>
            </div>

            {/* FPS */}
            <div className="flex flex-col gap-0.5 items-end border-l border-white/5 pl-1">
              <span className="text-[5px] md:text-[6px] font-black text-slate-600 uppercase tracking-widest">FPS</span>
              <div className="flex items-center gap-1">
                <span className="text-[8px] md:text-[10px] font-black text-purple-400 font-mono">{fps}</span>
                {statusMsg && <div className="w-1 h-1 rounded-full bg-red-500 animate-ping flex-shrink-0" />}
              </div>
            </div>
          </div>

          {/* Confirmed infraction banner */}
          {phase === 'confirmed' && (
            <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2 py-1 animate-in fade-in duration-300">
              <CheckCircle2 size={9} className="text-red-400 flex-shrink-0" />
              <span className="text-[7px] md:text-[8px] font-black text-red-400 uppercase tracking-wider truncate">
                {roiA} → {roiB} · GIRO PROHIBIDO
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Secondary alert */}
      {statusMsg && (
        <div className="bg-red-500/10 border border-red-500/30 px-2 py-1 md:px-3 md:py-1.5 rounded-lg md:rounded-xl backdrop-blur-md flex items-center gap-1.5 self-start animate-in slide-in-from-left-2">
          <AlertTriangle size={10} className="text-red-500 animate-bounce" />
          <span className="text-[7px] md:text-[9px] font-black text-red-500 uppercase tracking-widest truncate max-w-[80px] md:max-w-none">{statusMsg}</span>
        </div>
      )}
    </div>
  );
};
