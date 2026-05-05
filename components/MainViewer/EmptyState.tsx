import React from 'react';
import { useLayoutStore } from '../../stores/layoutStore';

const escudo = '/ESCUDO.png?v=11';

const ProfilingScan = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
    <div className="absolute inset-0 bg-gradient-conic from-transparent via-cyan-500/10 to-transparent animate-holo-spin" />
    <div className="scan-bar" />
    <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-cyan-400/80 via-cyan-400/30 to-transparent animate-scan-line opacity-80" />
    <div className="edge-glow" />
  </div>
);

const ShieldParticles = () => {
  const particles = React.useMemo(
    () =>
      [...Array(16)].map((_, i) => ({
        duration: 1.2 + ((i * 37) % 15) / 10,
        delay: i * 0.12,
        left: 10 + ((i * 53) % 80),
        top: 10 + ((i * 29) % 80),
      })),
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-0.5 bg-cyan-400 rounded-full opacity-0"
          style={{
            animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
            left: `${p.left}%`,
            top: `${p.top}%`,
          }}
        />
      ))}
    </div>
  );
};

const HolographicOverlay = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
    <div className="absolute inset-0 bg-gradient-conic from-transparent via-cyan-500/8 to-transparent animate-holo-spin" />
    <div className="absolute top-0 left-1/2 w-[1px] h-full bg-gradient-to-b from-cyan-400/60 via-cyan-400/20 to-transparent animate-scan-line" />
  </div>
);

const GlitchLayer = () => (
  <div className="absolute inset-0 pointer-events-none animate-glitch">
    <div className="absolute inset-0 bg-blue-500/10 mix-blend-screen" />
  </div>
);

const ProfileRings = () => (
  <div className="absolute inset-0 pointer-events-none">
    <div className="absolute inset-0 border border-cyan-500/20 rounded-full animate-profile-ring-1" />
    <div className="absolute inset-0 border border-blue-500/15 rounded-full animate-profile-ring-2" />
    <div className="absolute inset-0 border border-cyan-500/10 rounded-full animate-profile-ring-3" />
  </div>
);

const EscudoMask = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <div
    className={'absolute flex items-center justify-center perspective-1000 ' + (className ?? '')}
    style={style}
  >
    <ProfileRings />
    <HolographicOverlay />
    <GlitchLayer />
    <div className="relative w-full h-full">
      <div className="absolute inset-0 animate-dynamic-shield z-10">
        <img src={escudo} alt="Sentinel Logo" className="w-full h-full object-contain" />
      </div>
    </div>
    <ShieldParticles />
    <ProfilingScan />
  </div>
);

export const EmptyState = () => {
  const { gridSize } = useLayoutStore();
  const mini = gridSize >= 3;
  const compact = gridSize >= 2;

  if (mini)
    return (
      <div className="absolute inset-0 flex items-center justify-center z-30 bg-[#020617]">
        <div className="relative flex items-center justify-center w-[50%] aspect-square max-w-[200px]">
          <div className="absolute inset-0 border border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 border border-cyan-500/10 border-b-cyan-500/30 rounded-full animate-reverse-spin scale-90" />
          <EscudoMask className="w-[60%] h-[60%]" />
        </div>
      </div>
    );

  if (compact)
    return (
      <div className="absolute inset-0 flex items-center justify-center z-30 bg-[#020617] p-6">
        <div className="relative flex items-center justify-center w-[50%] aspect-square max-w-[300px]">
          <div className="absolute inset-0 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <div className="absolute inset-0 border border-cyan-500/20 border-b-cyan-500 rounded-full animate-pulse-ring scale-95 opacity-50" />
          <div className="absolute inset-0 border border-blue-500/10 border-l-blue-500/30 rounded-full animate-reverse-spin scale-80" />
          <EscudoMask className="w-[60%] h-[60%]" />
        </div>
      </div>
    );

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-[#020617] p-8">
      <div className="relative flex items-center justify-center w-[50%] aspect-square max-w-[500px]">
        <div className="absolute inset-0 border-2 border-blue-500/10 rounded-full animate-spin-slow scale-110" />
        <div className="absolute inset-0 border-2 border-cyan-500/5 rounded-full animate-pulse-ring scale-125" />
        <div className="absolute inset-0 border border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
        <div className="absolute inset-0 border border-cyan-500/10 border-l-cyan-500/20 rounded-full animate-reverse-spin scale-95" />
        <EscudoMask className="w-[60%] h-[60%]" />
      </div>
    </div>
  );
};
