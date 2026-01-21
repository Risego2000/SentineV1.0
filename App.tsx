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
import { TRACK_SMOOTHING } from './constants';
import { lineIntersect } from './utils';
import './index.css';

export const App = () => {
    // --- STATE ---
    const [source, setSource] = useState<'none' | 'live' | 'upload'>('none');
    const [isPlaying, setIsPlaying] = useState(false);
    const [selectedModel, setSelectedModel] = useState<'yolo' | 'mediapipe' | null>(null);
    const [directives, setDirectives] = useState(`- Sancionar invasión de carril bus.\n- Prohibido giros oblicuos peligrosos.`);
    const [geometry, setGeometry] = useState<GeometryLine[]>([]);
    const [selectedLog, setSelectedLog] = useState<InfractionLog | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [manualRender, setManualRender] = useState(0);

    // Custom Hooks
    const hasApiKey = !!((process.env.GEMINI_API_KEY) || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY);
    const { logs, systemLogs, stats, addLog, generateGeometry, runAudit, isAnalyzing, statusMsg, setStatusMsg, setStats } = useSentinelSystem(hasApiKey);
    const { status: neuralStatus, statusLabel, detect, detectPose } = useNeuralCore({
        selectedModel,
        onLog: addLog,
        confidenceThreshold: 0.55
    });

    const [engineConfig] = useState<EngineConfig>({
        confidenceThreshold: 0.55,
        nmsThreshold: 0.4,
        detectionSkip: 3,
        persistence: 20,
        predictionLookahead: 20
    });

    // refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const tracksRef = useRef<Track[]>([]);
    const frameCountRef = useRef(0);
    const isDetectingRef = useRef(false);

    // --- WORKER SETUP ---
    useEffect(() => {
        workerRef.current = new Worker(new URL('./components/tracking.worker.ts', import.meta.url), { type: 'module' });

        workerRef.current.onmessage = (e) => {
            const { type, tracks } = e.data;
            if (type === 'UPDATE_COMPLETE') {
                // Sync tracks from worker to main thread for rendering
                // Note: We need to handle the state/history. 
                // The worker sends the *current* state of all tracks.
                // We just swap the ref.
                // However, we need to check audits *here* or inside worker?
                // If we check here, we iterate the new tracks.

                // Let's do the Geometry Check here for now to keep Worker simple, 
                // or move it later. The prompt asked for optimization.
                // Tracker is the heavy algorithmic part (O(n^2) or matching).

                processTrackResults(tracks);
            }
        };

        workerRef.current.postMessage({ type: 'INIT' });

        return () => workerRef.current?.terminate();
    }, []);

    const processTrackResults = (activeTracks: any[]) => {
        tracksRef.current = activeTracks; // Update for renderer
        setStats(prev => ({ ...prev, det: activeTracks.length }));

        // Geometry Logic (Main Thread for now to access Canvas/Video refs easily for Snapshots)
        // Ideally snapshots should be taken only when needed.
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas) return;

        // We reuse the drawing dimensions from the REF or calculate them?
        // We need dW, dH, oX, oY.
        // We can recalculate them easily.
        const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
        const dW = v.videoWidth * scale; const dH = v.videoHeight * scale;
        const oX = (canvas.width - dW) / 2; const oY = (canvas.height - dH) / 2;

        activeTracks.forEach((t: any) => {
            const cx = t.bbox.x * dW + t.bbox.w * dW / 2 + oX;
            const cy = t.bbox.y * dH + t.bbox.h * dH / 2 + oY;

            if (!t.processedLines) t.processedLines = [];

            geometry.forEach(line => {
                if (!t.processedLines.includes(line.id)) {
                    if (t.history.length >= 2) {
                        const p1 = t.history[t.history.length - 2];
                        // ... (rest of logic)
                        const p1x = p1.x * dW + p1.w * dW / 2 + oX;
                        const p1y = p1.y * dH + p1.h * dH / 2 + oY;

                        const lx1 = line.x1 * dW + oX; const ly1 = line.y1 * dH + oY;
                        const lx2 = line.x2 * dW + oX; const ly2 = line.y2 * dH + oY;

                        if (lineIntersect(p1x, p1y, cx, cy, lx1, ly1, lx2, ly2)) {
                            t.processedLines.push(line.id);
                            t.crossedLine = true;

                            const sC = document.createElement('canvas'); sC.width = 1280; sC.height = 720;
                            sC.getContext('2d')?.drawImage(v, 0, 0, 1280, 720);
                            if (!t.snapshots) t.snapshots = [];
                            t.snapshots.push(sC.toDataURL('image/jpeg', 0.8).split(',')[1]);

                            runAudit({ ...t } as any, line, directives);
                        }
                    }
                }
            });
        });
    };

    // --- PROCESS FRAME ---

    const processFrame = useCallback(async () => {
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas) return; // Basic checks

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx || v.readyState < 2) return;

        // Resize
        if (canvas.width !== canvas.parentElement?.clientWidth) {
            canvas.width = canvas.parentElement?.clientWidth || 0;
            canvas.height = canvas.parentElement?.clientHeight || 0;
        }

        // Draw Video
        const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
        const dW = v.videoWidth * scale; const dH = v.videoHeight * scale;
        const oX = (canvas.width - dW) / 2; const oY = (canvas.height - dH) / 2;

        ctx.fillStyle = '#01030d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(v, oX, oY, dW, dH);

        // Draw Geometry
        geometry.forEach(line => {
            const lx1 = line.x1 * dW + oX; const ly1 = line.y1 * dH + oY;
            const lx2 = line.x2 * dW + oX; const ly2 = line.y2 * dH + oY;
            ctx.strokeStyle = line.type === 'forbidden' ? '#ef4444' : '#22d3ee';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();
            ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 10px Share Tech Mono';
            ctx.fillText(line.label.toUpperCase(), lx1, ly1 - 8);
        });

        // --- DETECT ---
        // Only run detection if playing and ready
        if (isPlaying && neuralStatus === 'ready') {
            frameCountRef.current++;

            if (selectedModel && !isDetectingRef.current && frameCountRef.current % engineConfig.detectionSkip === 0) {
                isDetectingRef.current = true;
                // ... logic
                Promise.all([
                    detect(v),
                    detectPose(v)
                ]).then(([detections, poses]) => {
                    if (workerRef.current) {
                        workerRef.current.postMessage({ type: 'UPDATE', data: { detections } });
                    }
                    if (statusMsg !== "GENERANDO VECTORES...") {
                        poses.forEach(p => {
                            p.landmarks.forEach(l => {
                                ctx.beginPath();
                                ctx.arc(l.x * dW + oX, l.y * dH + oY, 3, 0, 2 * Math.PI);
                                ctx.fillStyle = '#f472b6';
                                ctx.fill();
                            });
                        });
                    }
                }).finally(() => { isDetectingRef.current = false; });
            }
        }

        // --- RENDER VISUALS (from Synced State) ---
        tracksRef.current.forEach((t: any) => {
            const x = t.bbox.x * dW + oX;
            const y = t.bbox.y * dH + oY;
            const w = t.bbox.w * dW;
            const h = t.bbox.h * dH;

            let vx = 0, vy = 0;
            if (t.kf) { vx = t.kf.vx || 0; vy = t.kf.vy || 0; }
            else if (t.history.length > 5) {
                const p1 = t.history[t.history.length - 5];
                const p2 = t.history[t.history.length - 1];
                vx = (p2.x - p1.x) / 5; vy = (p2.y - p1.y) / 5;
            }

            ctx.strokeStyle = t.color || '#00ff99';
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);
            ctx.fillStyle = t.color || '#00ff99';
            ctx.fillRect(x, y - 15, 60, 15);
            ctx.fillStyle = 'black';
            ctx.fillText(`${t.id} ${t.label}`, x + 2, y - 4);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x + w / 2, y + h / 2);
            ctx.lineTo(x + w / 2 + vx * dW * 20, y + h / 2 + vy * dH * 20);
            ctx.stroke();
            ctx.setLineDash([]);
        });

    }, [isPlaying, neuralStatus, geometry, directives, detect, detectPose, selectedModel]);

    useEffect(() => {
        processFrame();
    }, [manualRender]);

    // --- HANDLERS ---
    const handleModelChange = (model: 'yolo' | 'mediapipe' | null) => {
        if (model) {
            addLog('CORE', `Cambiando Motor Neuronal de Detección a: ${model.toUpperCase()}`);
        } else {
            addLog('CORE', 'Motores Neuronales: EN ESPERA (Desactivado)');
        }
        setSelectedModel(model);
    };



    const toggleListening = () => {
        if (isListening) {
            setIsListening(false);
            addLog('INFO', 'Módulo de Voz: Desactivado');
            return;
        }
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            addLog('ERROR', 'Módulo de Voz: API de reconocimiento no soportada');
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.onstart = () => {
            setIsListening(true);
            addLog('INFO', 'Módulo de Voz: Escuchando comandos...');
        };
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            addLog('AI', `Comando de Voz Recibido: "${transcript}"`);
            setDirectives(prev => prev + `\n- ${transcript}`);
            handleGenerateGeometry(transcript);
        };
        recognition.onerror = (event: any) => {
            setIsListening(false);
            addLog('ERROR', `Error Módulo de Voz: ${event.error}`);
        };
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };

    const handleGenerateGeometry = async (instruction?: string) => {
        addLog('AI', 'Motor Vectorial: Analizando escena para definición de geometría...');
        const lines = await generateGeometry(directives, instruction);
        if (lines.length) {
            setGeometry(lines);
            addLog('AI', `Motor Vectorial: ${lines.length} zonas definidas exitosamente.`);
        } else {
            addLog('WARN', 'Motor Vectorial: No se generó geometría válida.');
        }
    };

    const startLiveFeed = async () => {
        addLog('CORE', 'Solicitando acceso a Entrada Biónica (Cámara)...');
        setStatusMsg("ACCEDIENDO CÁMARA...");
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play().then(() => {
                    setIsPlaying(true);
                    setSource('live');
                    setStatusMsg("LIVE FEED ACTIVO");
                    addLog('CORE', 'Entrada Biónica: Sensor óptico vinculado exitosamente.');
                    setTimeout(() => setStatusMsg(null), 2000);
                });
            }
        } catch (e: any) {
            addLog('ERROR', `Acceso Biónico denegado: ${e.message}`);
            setStatusMsg("CÁMARA DENEGADA");
        }
    };

    const handleFileSelect = () => {
        document.getElementById('file-up')?.click();
    };

    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && videoRef.current) {
            addLog('INFO', `Sistema de Archivos: Cargando video "${file.name}"...`);
            const url = URL.createObjectURL(file);
            videoRef.current.src = url;
            videoRef.current.currentTime = 0;
            setIsPlaying(false);
            setSource('upload');
            setStatusMsg("VIDEO CARGADO (PAUSA)");
            addLog('CORE', 'Procesador de Video: Transmisión cargada. Esperando comando de reproducción.');
            setTimeout(() => setStatusMsg(null), 2000);
        }
        e.target.value = '';
    };



    // Sync Video Control
    useEffect(() => {
        if (videoRef.current) {
            if (isPlaying) videoRef.current.play().catch(e => console.error("Play error:", e));
            else videoRef.current.pause();
        }
    }, [isPlaying]);

    // Loop
    useEffect(() => {
        let anim: number;
        const loop = async () => { await processFrame(); anim = requestAnimationFrame(loop); };
        if (isPlaying) loop();
        return () => cancelAnimationFrame(anim);
    }, [isPlaying, processFrame]);

    return (
        <div className="h-screen w-screen bg-[#020617] text-slate-100 flex flex-col lg:flex-row overflow-hidden font-sans select-none">
            <Sidebar
                stats={stats}
                selectedModel={selectedModel} setSelectedModel={handleModelChange} directives={directives} setDirectives={setDirectives}
                toggleListening={toggleListening} isListening={isListening} generateGeometry={() => handleGenerateGeometry()}
                startLiveFeed={startLiveFeed} onUploadClick={handleFileSelect}
            />

            <MainViewer
                videoRef={videoRef} canvasRef={canvasRef} source={source}
                isDetecting={isDetectingRef.current} statusMsg={statusMsg}
                systemStatus={{ neural: neuralStatus, forensic: hasApiKey ? 'ready' : 'error', bionics: source !== 'none' ? 'ready' : 'pending' }}
                statusLabel={statusLabel} isPlaying={isPlaying} setIsPlaying={setIsPlaying} isAnalyzing={isAnalyzing} modelLoaded={neuralStatus === 'ready'}
            />

            <RightSidebar logs={logs} systemLogs={systemLogs} setSelectedLog={setSelectedLog} />

            <input id="file-up" type="file" className="hidden" accept="video/*" onChange={onFileChange} />
            {selectedLog && <InfractionModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};
