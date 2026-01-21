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

export const App = () => {
    // --- STATE ---
    const [source, setSource] = useState<'none' | 'live' | 'upload'>('none');
    const [isPlaying, setIsPlaying] = useState(false);
    const [directives, setDirectives] = useState(`- Sancionar invasión de carril bus.\n- Prohibido giros oblicuos peligrosos.`);
    const [geometry, setGeometry] = useState<GeometryLine[]>([]);
    const [selectedLog, setSelectedLog] = useState<InfractionLog | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [manualRender, setManualRender] = useState(0);
    const [isPoseEnabled, setIsPoseEnabled] = useState(false); // Manual Toggle State

    const [currentPreset, setCurrentPreset] = useState<PresetType>('standard');
    const [engineConfig, setEngineConfig] = useState<EngineConfig>(DETECTION_PRESETS.standard.config);

    // Custom Hooks
    const hasApiKey = !!((process.env.GEMINI_API_KEY) || (import.meta as any).env.VITE_GOOGLE_GENAI_KEY);
    const { logs, systemLogs, stats, addLog, generateGeometry, runAudit, isAnalyzing, statusMsg, setStatusMsg, setStats } = useSentinelSystem(hasApiKey);
    const { status: neuralStatus, statusLabel, detect, detectPose, mediapipeReady } = useNeuralCore({
        onLog: addLog,
        confidenceThreshold: engineConfig.confidenceThreshold,
        isPoseEnabled // Pass manual toggle state
    });

    // Update engine config when preset changes
    const handlePresetChange = (preset: PresetType) => {
        setCurrentPreset(preset);
        setEngineConfig(DETECTION_PRESETS[preset].config);
        addLog('CORE', `Modo de operación cambiado a: ${DETECTION_PRESETS[preset].label}`);
    };

    // refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const trackerRef = useRef<ByteTracker>(new ByteTracker());
    const tracksRef = useRef<Track[]>([]);
    const frameCountRef = useRef(0);
    const isDetectingRef = useRef(false);
    const snapshotCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const seenTrackIds = useRef(new Set<number>());

    // --- SYSTEM INIT ---
    useEffect(() => {
        addLog('CORE', 'Sincronizando Motor Vectorial en hilo principal...');
    }, []);

    const processTrackResults = (activeTracks: any[]) => {
        tracksRef.current = activeTracks;

        // UNIQUE DETECTION COUNTER
        activeTracks.forEach(t => {
            if (!seenTrackIds.current.has(t.id)) {
                seenTrackIds.current.add(t.id);
                setStats(prev => ({ ...prev, det: prev.det + 1 }));
            }
        });

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

                            // Optimized Snapshot: Use persistent canvas
                            if (!snapshotCanvasRef.current) {
                                snapshotCanvasRef.current = document.createElement('canvas');
                                snapshotCanvasRef.current.width = 1280;
                                snapshotCanvasRef.current.height = 720;
                            }
                            const sC = snapshotCanvasRef.current;
                            const ctxS = sC.getContext('2d');
                            if (ctxS) {
                                ctxS.drawImage(v, 0, 0, 1280, 720);
                                if (!t.snapshots) t.snapshots = [];

                                // Offload heavy toDataURL and audit to not block current detection result processing
                                setTimeout(() => {
                                    const data = sC.toDataURL('image/jpeg', 0.5); // Lower quality for speed
                                    t.snapshots.push(data.split(',')[1]);
                                    runAudit({ ...t } as any, line, directives);
                                }, 0);
                            }
                        }
                    }
                }
            });
        });
    };

    // --- PROCESS FRAME ---

    const processFrame = useCallback(() => {
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
        if (isPlaying && neuralStatus === 'ready') {
            frameCountRef.current++;

            // ALWAYS STEP TRACKER (Continuous Fluid Motion)
            // Even if we don't detect, we predict positions
            const currentTracks = trackerRef.current.step();
            processTrackResults([...currentTracks]);

            if (!isDetectingRef.current && frameCountRef.current % engineConfig.detectionSkip === 0) {
                isDetectingRef.current = true;
                const ts = performance.now();

                Promise.all([
                    detect(v, ts),
                    isPoseEnabled ? detectPose(v, ts) : Promise.resolve(null)
                ]).then(([detections, poses]) => {
                    if (detections) {
                        const flattened = detections.map(d => ({ x: d.box.x, y: d.box.y, w: d.box.w, h: d.box.h, score: d.score, label: d.label }));
                        const tracks = trackerRef.current.update(flattened, engineConfig.persistence);
                        processTrackResults(tracks);
                    }
                    if (statusMsg !== "GENERANDO VECTORES..." && poses) {
                        poses.forEach(p => {
                            p.landmarks.forEach(l => {
                                ctx.beginPath();
                                ctx.arc(l.x * dW + oX, l.y * dH + oY, 3, 0, 2 * Math.PI);
                                ctx.fillStyle = '#f472b6';
                                ctx.fill();
                            });
                        });
                    }
                }).catch(err => {
                    console.error("Inference Error:", err);
                }).finally(() => { isDetectingRef.current = false; });
            }
        }

        // --- RENDER VISUALS (from Synced State) ---
        ctx.font = 'bold 10px "Share Tech Mono"';
        tracksRef.current.forEach((t: any) => {
            const x = t.bbox.x * dW + oX;
            const y = t.bbox.y * dH + oY;
            const w = t.bbox.w * dW;
            const h = t.bbox.h * dH;
            const cx = x + w / 2;
            const cy = y + h / 2;

            const color = t.color || '#22d3ee';

            // 1. TACTICAL TRAJECTORY TRAIL (The "Tail")
            if (t.tail && t.tail.length > 2) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.4;
                ctx.setLineDash([2, 4]);

                for (let i = 0; i < t.tail.length; i++) {
                    const tx = t.tail[i].x * dW + oX;
                    const ty = t.tail[i].y * dH + oY;
                    if (i === 0) ctx.moveTo(tx, ty);
                    else ctx.lineTo(tx, ty);
                }
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.globalAlpha = 1.0;
            }

            // 2. PRIMARY TRACKER BOX
            ctx.strokeStyle = color;
            ctx.lineWidth = t.isCoasting ? 0.8 : 1.8;
            if (t.isCoasting) ctx.setLineDash([5, 5]);
            ctx.strokeRect(x, y, w, h);
            ctx.setLineDash([]);

            ctx.fillStyle = `${color}10`;
            ctx.fillRect(x, y, w, h);

            // 3. LABEL HUD & TELEMETRY
            const labelStr = `[KINETIC_${t.id}] ${t.label.toUpperCase()}${t.isCoasting ? '_COASTING' : ''}`;
            const labelW = (labelStr.length * 6) + 12;

            ctx.fillStyle = color;
            ctx.fillRect(x, y - 16, labelW, 16);
            ctx.fillStyle = 'black';
            ctx.fillText(labelStr, x + 6, y - 4);

            // 4. KINETIC VECTOR (VELOCITY)
            if (t.kf && (Math.abs(t.kf.vx) > 0.001 || Math.abs(t.kf.vy) > 0.001)) {
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + t.kf.vx * dW * 20, cy + t.kf.vy * dH * 20);
                ctx.stroke();

                // Vector Arrow Tip
                const headlen = 6;
                const angle = Math.atan2(t.kf.vy, t.kf.vx);
                ctx.beginPath();
                ctx.moveTo(cx + t.kf.vx * dW * 20, cy + t.kf.vy * dH * 20);
                ctx.lineTo(cx + t.kf.vx * dW * 20 - headlen * Math.cos(angle - Math.PI / 6), cy + t.kf.vy * dH * 20 - headlen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(cx + t.kf.vx * dW * 20, cy + t.kf.vy * dH * 20);
                ctx.lineTo(cx + t.kf.vx * dW * 20 - headlen * Math.cos(angle + Math.PI / 6), cy + t.kf.vy * dH * 20 - headlen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
        });

    }, [isPlaying, neuralStatus, geometry, directives, detect, detectPose, statusMsg, mediapipeReady, engineConfig]);

    useEffect(() => {
        processFrame();
    }, [manualRender]);

    // --- HANDLERS ---



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
            // PROTOCOLO DE REINICIO DE SISTEMA
            seenTrackIds.current.clear();
            trackerRef.current = new ByteTracker();
            tracksRef.current = [];
            setStats({ det: 0, inf: 0 });

            addLog('INFO', `Sistema de Archivos: Cargando video "${file.name}"...`);
            const url = URL.createObjectURL(file);
            videoRef.current.src = url;
            videoRef.current.currentTime = 0;

            // Video Loading Protocol - Manual Trigger Required for Analysis
            videoRef.current.onloadeddata = () => {
                addLog('INFO', `Procesador Cápsula: Video "${file.name}" sincronizado.`);
                setStatusMsg("SISTEMA_LISTO");
            };
            setIsPlaying(false);
            setSource('upload');
            setStatusMsg("VIDEO CARGADO");
            addLog('CORE', 'Subsector de Datos: Transmisión cargada. Esperando comando táctico.');
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
        const loop = () => {
            processFrame();
            anim = requestAnimationFrame(loop);
        };
        if (source !== 'none') loop();
        return () => cancelAnimationFrame(anim);
    }, [source, processFrame]);

    const systemStatus = {
        neural: neuralStatus,
        forensic: hasApiKey ? 'ready' : 'error',
        bionics: source !== 'none' ? 'ready' : 'pending',
        vector: geometry.length > 0 ? 'ready' : 'pending',
        mediapipeReady
    };

    return (
        <div className="h-screen w-screen bg-[#020617] text-slate-100 flex flex-col lg:flex-row overflow-hidden font-sans select-none">
            <Sidebar
                stats={stats}
                currentPreset={currentPreset} setPreset={handlePresetChange}
                directives={directives} setDirectives={setDirectives}
                toggleListening={toggleListening} isListening={isListening} generateGeometry={() => handleGenerateGeometry()}
                startLiveFeed={startLiveFeed} onUploadClick={handleFileSelect}
                isPoseEnabled={isPoseEnabled} togglePose={() => setIsPoseEnabled(!isPoseEnabled)}
                systemStatus={systemStatus}
                statusLabel={statusLabel}
            />

            <MainViewer
                videoRef={videoRef} canvasRef={canvasRef} source={source}
                isDetecting={isDetectingRef.current} statusMsg={statusMsg}
                systemStatus={systemStatus}
                statusLabel={statusLabel} isPlaying={isPlaying} setIsPlaying={setIsPlaying} isAnalyzing={isAnalyzing} modelLoaded={neuralStatus === 'ready'}
                startLiveFeed={startLiveFeed} onUploadClick={handleFileSelect} generateGeometry={() => handleGenerateGeometry()}
            />

            <RightSidebar
                logs={logs}
                systemLogs={systemLogs}
                setSelectedLog={setSelectedLog}
                stats={stats}
            />
            <input id="file-up" type="file" className="hidden" accept="video/*" onChange={onFileChange} />
            {selectedLog && <InfractionModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};
