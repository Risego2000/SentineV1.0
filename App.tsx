import React, { useRef, useEffect, useCallback } from 'react';

// Components & Modules
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { MainViewer } from './components/MainViewer/MainViewer';
import { InfractionModal } from './components/InfractionModal';
import { IpCameraModal } from './components/IpCameraModal';
import { useSentinel } from './hooks/useSentinel';
import { useFrameProcessor } from './hooks/useFrameProcessor';
import { renderScene } from './components/renderSystem';
import './index.css';

/**
 * Sentinel AI Supreme Command Unit (Main Application).
 * Orchestrates global visuals, tactical feedback loop, and system synchronization.
 */
export const App = () => {
  const {
    source,
    isPlaying,
    setIsPlaying,
    geometry,
    selectedLog,
    setSelectedLog,
    isMeshRenderEnabled,
    addLog,
    videoRef,
    onFilesChange: contextOnFilesChange,
    isBatchMode,
    loadNextInQueue,
    finalizeVideoReport,
    startLiveFeed: contextStartLiveFeed,
    clearLogs,
  } = useSentinel();

  const { processFrame, trackerRef, resetTracker } = useFrameProcessor();

  // UI States
  const [showIpModal, setShowIpModal] = React.useState(false);

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- SYSTEM INITIALIZATION ---
  useEffect(() => {
    addLog('CORE', 'Sincronizando Motor Vectorial Sentinel AI... Unidad de Comando Activa.');
  }, [addLog]);

  /**
   * Tactical Render Loop.
   * Synchronizes video processing and forensic visualization.
   */
  const loop = useCallback(async () => {
    const v = videoRef.current;
    const canvas = canvasRef.current;
    if (!v || !canvas || source === 'none') return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx || v.readyState < 2) return;

    // Execute frame processing ONLY if playing
    if (isPlaying) {
      await processFrame(v, canvas);
    }

    // Always render the scene (includes tracked entities history/predictions)
    renderScene(ctx, v, trackerRef.current.tracks, geometry, isMeshRenderEnabled);
  }, [isPlaying, source, geometry, processFrame, isMeshRenderEnabled, videoRef, trackerRef]);

  useEffect(() => {
    let anim: number;
    const frameLoop = async () => {
      await loop();
      anim = requestAnimationFrame(frameLoop);
    };
    anim = requestAnimationFrame(frameLoop);
    return () => cancelAnimationFrame(anim);
  }, [loop]);

  // --- TACTICAL HANDLERS ---

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      resetTracker(); // Tactical Reset
      clearLogs(); // Reset UI
      contextOnFilesChange(files, videoRef);
    }
    e.target.value = '';
  };

  // Video State Management
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (isPlaying) {
      v.play().catch((error) => {
        console.error('Transmission Error:', error);
      });
    } else {
      v.pause();
    }

    const handleEnded = async () => {
      if (isBatchMode) {
        addLog('INFO', 'Video finalizado. Transicionando al siguiente en la cola...');
        await loadNextInQueue();
      } else {
        setIsPlaying(false);
        addLog('INFO', 'Análisis finalizado: Fin de la transmisión de datos.');
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
    addLog,
    setIsPlaying,
    videoRef,
    source,
    finalizeVideoReport,
  ]);

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-100 flex flex-col lg:flex-row overflow-hidden font-sans select-none">
      <Sidebar />

      <MainViewer
        videoRef={videoRef}
        canvasRef={canvasRef}
        onLive={() => {
          clearLogs();
          contextStartLiveFeed(videoRef);
        }}
        onUpload={handleFileSelect}
      />

      <RightSidebar />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="video/*"
        multiple
        onChange={onFileChange}
      />

      {selectedLog && <InfractionModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
      {showIpModal && <IpCameraModal onClose={() => setShowIpModal(false)} />}
    </div>
  );
};
