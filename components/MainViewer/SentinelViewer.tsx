import React, { memo, useRef, useEffect, useCallback } from 'react';
import { useSentinel } from '../../hooks/useSentinel';
import { useFrameProcessor } from '../../hooks/useFrameProcessor';
import { renderScene } from '../renderSystem';
import { EmptyState } from './EmptyState';
import { NeuralStatusHUD } from './NeuralStatusHUD';
import { ForensicAnalysisOverlay } from './ForensicAnalysisOverlay';
import { GeometryEditor } from './GeometryEditor';
import { SystemAlertHUD } from './SystemAlertHUD';
import { IpCameraModal } from '../IpCameraModal';
import { useLayoutStore } from '../../stores/layoutStore';
import { useFocusedViewerStore } from '../../stores/focusedViewerStore';

const escudo = '/ESCUDO.png?v=11';

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
    logs,
  } = useSentinel();

  const { processFrame, trackerRef, resetTracker } = useFrameProcessor();
  const { gridSize, focusedViewerId, showDetections, showROIs } = useLayoutStore();
  const { update: updateFocusedViewer } = useFocusedViewerStore();
  const compact = gridSize >= 2;
  const mini = gridSize >= 3;
  const isFocused = viewerId === focusedViewerId;

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
    if (!ctx) return;
    // Allow rendering if video has at least metadata (readyState >= 1) and is playing
    if (v.readyState < 1 || v.paused) return;

    try {
      if (isPlaying) {
        await processFrame(v, canvas);
      }
      renderScene(
        ctx,
        v,
        trackerRef.current.tracks,
        geometry,
        isMeshRenderEnabled,
        showDetections,
        showROIs
      );
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
    showDetections,
    showROIs,
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
  const handleFileSelect = React.useCallback(() => fileInputRef.current?.click(), []);

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

  // Sync this viewer state to the shared bar whenever it is the focused viewer
  useEffect(() => {
    if (!isFocused) return;
    updateFocusedViewer({
      viewerId,
      isPlaying,
      source,
      videoRef,
      logs,
      setIsPlayingFn: setIsPlaying,
      onScreenShareFn: () => {
        clearLogs();
        contextStartScreenShare(videoRef);
      },
      onIpCameraFn: () => setShowIpModal(true),
      onUploadFn: handleFileSelect,
    });
  }, [
    isFocused,
    isPlaying,
    source,
    logs,
    viewerId,
    updateFocusedViewer,
    setIsPlaying,
    clearLogs,
    contextStartScreenShare,
    videoRef,
    handleFileSelect,
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
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        style={{ opacity: 0 }}
      />

      <NeuralStatusHUD />

      <ForensicAnalysisOverlay isAnalyzing={isAnalyzing} />

      <SystemAlertHUD />

      <div
        className={
          mini
            ? 'flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-0'
            : compact
              ? 'flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-2'
              : 'flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full p-4 lg:p-8'
        }
      >
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

          <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-blue-500/50" />
          <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-blue-500/50" />
          <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-blue-500/50" />
          <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-blue-500/50" />
        </div>

        {source === 'none' && <EmptyState />}

        {isAnalyzing && (
          <div className="absolute inset-0 flex items-center justify-center z-[60] bg-[#020617]/60 backdrop-blur-md transition-all duration-500">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
              <div className="relative bg-black/80 border border-blue-500/40 px-12 py-6 rounded-2xl flex flex-col items-center gap-4 shadow-2xl overflow-hidden glass-card">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-pulse" />
                <img
                  src={escudo}
                  alt="Sentinel Logo"
                  className="w-12 h-12 object-contain animate-bounce"
                />
                <div className="flex flex-col items-center">
                  <span className="text-sm font-black text-white uppercase tracking-[0.3em] italic text-glow-blue">
                    Analizando Vector
                  </span>
                  <span className="text-[10px] font-mono text-blue-500/60 mt-1">
                    PROCESANDO_CAPAS_NEURALES...
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
});

SentinelViewer.displayName = 'SentinelViewer';
