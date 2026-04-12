import React, { memo } from 'react';
import { Waves } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { EmptyState } from './EmptyState';
import { NeuralStatusHUD } from './NeuralStatusHUD';
import { ControlBar } from './ControlBar';
import { HeaderActions } from './HeaderActions';
import { ForensicAnalysisOverlay } from './ForensicAnalysisOverlay';
import { GeometryEditor } from './GeometryEditor';
import { VideoTimeline } from './VideoTimeline';
import { HelpCapsule } from './HelpCapsule';

interface MainViewerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onScreenShare: () => void;
  onIpCamera: () => void;
  onUpload: () => void;
}

/**
 * MainViewer modularizado.
 * Estructura optimizada para renderizado fluido.
 */
export const MainViewer = memo(({ videoRef, canvasRef, onScreenShare, onIpCamera, onUpload }: MainViewerProps) => {
  const { source, isAnalyzing } = useSentinel();
  const [aspectRatio, setAspectRatio] = React.useState<number>(16 / 9);

  // Sincronizar relación de aspecto para alineación biónica
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const updateRatio = () => {
      if (v.videoWidth && v.videoHeight) {
        setAspectRatio(v.videoWidth / v.videoHeight);
      }
    };
    v.addEventListener('loadedmetadata', updateRatio);
    updateRatio();
    return () => v.removeEventListener('loadedmetadata', updateRatio);
  }, [videoRef]);

  return (
    <main className="flex-1 relative flex flex-col bg-black overflow-hidden h-screen">
      {/* Elementos ocultos pero necesarios */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ opacity: 0 }}
      />

      {/* Capa de Información (HUD) y Acciones */}
      <NeuralStatusHUD />
      <HeaderActions
        onScreenShare={onScreenShare}
        onIpCamera={onIpCamera}
        onUpload={onUpload}
        activeMode={source === 'upload' ? 'video' : source}
      />

      {/* Overlay de Análisis Forense */}
      <ForensicAnalysisOverlay isAnalyzing={isAnalyzing} />

      {/* Área Central de Visualización (Núcleo de Alineación) */}
      <div className="flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-4 lg:p-10">
        {/* Background HUD Effects */}
        <div className="absolute inset-0 hud-grid opacity-30 pointer-events-none" />
        <div className="scanline" />

        <div
          className="relative z-20 flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 glass-card overflow-hidden group"
          style={{
            aspectRatio: `${aspectRatio}`,
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
          }}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain pointer-events-none transition-transform duration-700 group-hover:scale-[1.01]"
          />
          <GeometryEditor canvasRef={canvasRef} />

          {/* Corner Brackets */}
          <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
          <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
        </div>

        {/* Estados Condicionales */}
        {source === 'none' && <EmptyState />}

        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center z-[60] bg-[#020617]/60 backdrop-blur-md transition-all duration-500">
            <div className="relative group">
              <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
              <div className="relative bg-black/80 border border-cyan-500/40 px-12 py-6 rounded-2xl flex flex-col items-center gap-4 shadow-2xl overflow-hidden glass-card">
                <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 animate-pulse" />
                <Waves className="text-cyan-400 w-10 h-10 animate-bounce" />
                <div className="flex flex-col items-center">
                  <span className="text-sm font-black text-white uppercase tracking-[0.3em] italic text-glow-cyan">
                    Analizando Vector
                  </span>
                  <span className="text-[10px] font-mono text-cyan-500/60 mt-1">
                    PROCESANDO_CAPAS_NEURALES...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Control Inferior */}
      <div className="relative z-50">
        <HelpCapsule />
        <VideoTimeline videoRef={videoRef} />
        <ControlBar />
      </div>
    </main>
  );
});

MainViewer.displayName = 'MainViewer';
