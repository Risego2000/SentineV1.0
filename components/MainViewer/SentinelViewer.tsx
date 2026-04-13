import React, { memo, useRef, useEffect, useCallback } from 'react';
import { Waves } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useFrameProcessor } from '../../hooks/useFrameProcessor';
import { renderScene } from '../renderSystem';
import { EmptyState } from './EmptyState';
import { NeuralStatusHUD } from './NeuralStatusHUD';
import { ControlBar } from './ControlBar';
import { HeaderActions } from './HeaderActions';
import { ForensicAnalysisOverlay } from './ForensicAnalysisOverlay';
import { GeometryEditor } from './GeometryEditor';
import { VideoTimeline } from './VideoTimeline';
import { HelpCapsule } from './HelpCapsule';
import { IpCameraModal } from '../IpCameraModal';
import { useLayoutStore } from '../../stores/layoutStore';

export const SentinelViewer = memo(({ viewerId }: { viewerId: string }) => {
  const {
    source,
    isAnalyzing,
    isPlaying,
    geometry,
    isMeshRenderEnabled,
    videoRef,
    addLog,
    onFilesChange: contextOnFilesChange,
    startScreenShare: contextStartScreenShare,
    clearLogs,
    setIsPlaying,
    isBatchMode,
    loadNextInQueue,
    finalizeVideoReport,
  } = useSentinel();

  const { processFrame, trackerRef, resetTracker } = useFrameProcessor();
  const { gridSize } = useLayoutStore();
  const compact = gridSize >= 2;
  const mini = gridSize >= 3;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showIpModal, setShowIpModal] = React.useState(false);
  const [aspectRatio, setAspectRatio] = React.useState<number>(16 / 9);

  // --- RENDERING LOOP ---
  const loop = useCallback(async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || source === 'none') return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx || v.readyState < 2) return;

    try {
      if (isPlaying) {
        await processFrame(v, canvas);
      }
      renderScene(ctx, v, trackerRef.current.tracks, geometry, isMeshRenderEnabled);
    } catch (err) {
      addLog(
        'ERROR',
        `Error en frame loop [${viewerId}]: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [
    isPlaying,
    source,
    geometry,
    processFrame,
    isMeshRenderEnabled,
    videoRef,
    trackerRef,
    addLog,
    viewerId,
  ]);

  useEffect(() => {
    let anim: number;
    const frameLoop = async () => {
      await loop();
      anim = requestAnimationFrame(frameLoop);
    };
    anim = requestAnimationFrame(frameLoop);
    return () => cancelAnimationFrame(anim);
  }, [loop]);

  // --- EVENT HANDLERS ---
  const handleFileSelect = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      resetTracker();
      clearLogs();
      contextOnFilesChange(files, videoRef);
    }
    e.target.value = '';
  };

  useEffect(() => {
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

  // Video State Management
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isPlaying) {
      v.play().catch(console.error);
    } else {
      v.pause();
    }

    const handleEnded = async () => {
      if (isBatchMode) {
        await loadNextInQueue();
      } else {
        setIsPlaying(false);
        if (source === 'upload') {
          await finalizeVideoReport();
        }
      }
    };

    v.addEventListener('ended', handleEnded);
    return () => v.removeEventListener('ended', handleEnded);
  }, [
    isPlaying,
    isBatchMode,
    loadNextInQueue,
    setIsPlaying,
    videoRef,
    source,
    finalizeVideoReport,
  ]);

  return (
    <main className="relative flex flex-col bg-black overflow-hidden h-full w-full">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="video/*"
        multiple
        onChange={onFileChange}
      />

      {showIpModal && <IpCameraModal onClose={() => setShowIpModal(false)} />}

      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ opacity: 0 }}
      />

      <NeuralStatusHUD />
      <HeaderActions
        onScreenShare={() => {
          clearLogs();
          contextStartScreenShare(videoRef);
        }}
        onIpCamera={() => setShowIpModal(true)}
        onUpload={handleFileSelect}
        activeMode={source === 'upload' ? 'video' : source}
      />

      <ForensicAnalysisOverlay isAnalyzing={isAnalyzing} />

      <div className={mini ? "flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-0" : compact ? "flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-2" : "flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-4 lg:p-8"}>
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
          {/* VideoTimeline: z-30 keeps it below GeometryEditor (z-40) so edit mode always gets events */}
          <VideoTimeline videoRef={videoRef} />
          <GeometryEditor canvasRef={canvasRef} />

          <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-cyan-500/50" />
          <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-cyan-500/50" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-cyan-500/50" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-cyan-500/50" />
        </div>

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

      <div className="relative z-50 shrink-0">
        <HelpCapsule />
        <ControlBar />
      </div>
    </main>
  );
});

SentinelViewer.displayName = 'SentinelViewer';
