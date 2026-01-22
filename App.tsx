import React, { useState, useRef, useEffect, useCallback } from 'react';
// Components & Modules
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import { MainViewer } from './components/MainViewer';
import { InfractionModal } from './components/InfractionModal';
import { useNeuralCore } from './components/useNeuralCore';
import { useSentinelSystem } from './components/useSentinelSystem';
import { ByteTracker } from './components/ByteTracker'; // Importar Tracker
import { EngineConfig, GeometryLine, InfractionLog, Track } from './types';
import { TRACK_SMOOTHING, DETECTION_PRESETS, PresetType } from './constants';
import { lineIntersect } from './utils';
import './index.css';

import { useSentinel } from './hooks/useSentinel';
import { useFrameProcessor } from './hooks/useFrameProcessor';
import { renderScene } from './components/renderSystem';
import './index.css';

export const App = () => {
    const {
        source, setSource,
        isPlaying, setIsPlaying,
        directives, setDirectives,
        geometry, setGeometry,
        selectedLog, setSelectedLog,
        isListening, setIsListening,
        isPoseEnabled, setIsPoseEnabled,
        currentPreset, setPreset,
        stats, setStats,
        statusMsg, setStatusMsg,
        isAnalyzing,
        systemStatus,
        statusLabel,
        addLog,
        generateGeometry,
        startLiveFeed: contextStartLiveFeed,
        onFileChange: contextOnFileChange,
        mediapipeReady
    } = useSentinel();

    const { processFrame, trackerRef } = useFrameProcessor();

    // refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const manualRender = useState(0)[0]; // Dummy for backward compatibility if needed, but we'll use actual loop

    // --- SYSTEM INIT ---
    useEffect(() => {
        addLog('CORE', 'Sincronizando Motor Vectorial Sentinel AI...');
    }, []);

    const processTrackResults = (activeTracks: any[]) => {
        // This is now mostly handled by useFrameProcessor, 
        // but we might want to trigger manual render or side effects here.
    };

    // --- PROCESS FRAME ---
    const loop = useCallback(async () => {
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || source === 'none') return;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx || v.readyState < 2) return;

        // Sync processing
        if (isPlaying) {
            await processFrame(v, canvas);
        }

        // Render
        renderScene(ctx, v, trackerRef.current.tracks, geometry);

        // Feedback loop
    }, [isPlaying, source, geometry, processFrame]);

    useEffect(() => {
        let anim: number;
        const frameLoop = async () => {
            await loop();
            anim = requestAnimationFrame(frameLoop);
        };
        frameLoop();
        return () => cancelAnimationFrame(anim);
    }, [loop]);

    // --- HANDLERS ---

    const handleFileSelect = () => {
        document.getElementById('file-up')?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) contextOnFileChange(file, videoRef);
        e.target.value = '';
    };

    // Sync Video Control & Events
    useEffect(() => {
        const v = videoRef.current;
        if (v) {
            if (isPlaying) v.play().catch(e => console.error("Play error:", e));
            else v.pause();

            const handleEnded = () => {
                setIsPlaying(false);
                addLog('INFO', 'Análisis finalizado: Fin de la transmisión.');
            };

            v.addEventListener('ended', handleEnded);
            return () => v.removeEventListener('ended', handleEnded);
        }
    }, [isPlaying, addLog, setIsPlaying]);

    return (
        <div className="h-screen w-screen bg-[#020617] text-slate-100 flex flex-col lg:flex-row overflow-hidden font-sans select-none">
            <Sidebar
                toggleListening={() => setIsListening(!isListening)}
            />

            <MainViewer
                videoRef={videoRef} canvasRef={canvasRef}
                onLive={contextStartLiveFeed} onUpload={handleFileSelect}
            />

            <RightSidebar />
            <input id="file-up" type="file" className="hidden" accept="video/*" onChange={onFileChange} />
            {selectedLog && <InfractionModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};