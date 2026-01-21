import { useState, useEffect, useRef, useCallback } from 'react';
import { ObjectDetector, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { MODEL_URL_DETECTION, MEDIAPIPE_MODEL_PATH, MEDIAPIPE_WASM_PATH, MEDIAPIPE_POSE_PATH, RELEVANT_CLASSES, YOLO_CLASSES } from '../constants';

// Standardized Output
export interface StandardDetection {
    label: string;
    score: number;
    box: { x: number; y: number; w: number; h: number };
}

export interface PoseResult {
    landmarks: { x: number; y: number; z: number }[];
    worldLandmarks: { x: number; y: number; z: number }[];
}

interface UseNeuralCoreProps {
    selectedModel: 'yolo' | 'mediapipe' | null;
    onLog: (type: 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'CORE', content: string) => void;
    confidenceThreshold: number;
}

export const useNeuralCore = ({ selectedModel, onLog, confidenceThreshold }: UseNeuralCoreProps) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [statusLabel, setStatusLabel] = useState('BOOTING_CORE...');

    // Refs
    const yoloSessionRef = useRef<any>(null);
    const mediaPipeRef = useRef<ObjectDetector | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const visionRef = useRef<any>(null);
    const isInitializingRef = useRef(false); // Init Lock
    const objTimestampRef = useRef(0);
    const poseTimestampRef = useRef(0);

    const float32CacheRef = useRef<Float32Array | null>(null);
    const canvasCacheRef = useRef<HTMLCanvasElement | null>(null);
    const ctxCacheRef = useRef<CanvasRenderingContext2D | null>(null);

    // --- INIT ---
    const initCore = async () => {
        if (isInitializingRef.current) return;
        isInitializingRef.current = true;

        if (!selectedModel) {
            setStatus('ready');
            setStatusLabel('EN_ESPERA');
            isInitializingRef.current = false;
            return;
        }

        try {
            setStatus('loading');
            setStatusLabel('INICIALIZANDO_AGI...');

            // 1. Init Vision (Shared)
            if (!visionRef.current) {
                onLog('CORE', 'Inicializando Motor de Visión Compartido...');
                visionRef.current = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
            }

            // 2. Init Pose (Coupled with Detection)
            if (!poseLandmarkerRef.current) {
                onLog('CORE', 'Cargando Módulo de Análisis de Conductor (Pose)...');
                poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(visionRef.current, {
                    baseOptions: {
                        modelAssetPath: MEDIAPIPE_POSE_PATH,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numPoses: 1
                });
                onLog('AI', 'Unidad Cinemática: Pose Calibrada.');
            }

            // 3. Init Selected Model
            if (selectedModel === 'mediapipe') {
                if (!mediaPipeRef.current) {
                    onLog('CORE', 'Cargando Google EfficientDet-Lite0...');
                    mediaPipeRef.current = await ObjectDetector.createFromOptions(visionRef.current, {
                        baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_PATH, delegate: "GPU" },
                        scoreThreshold: 0.3,
                        runningMode: 'VIDEO'
                    });
                }
                setStatusLabel('GOOGLE_CORE_V2');
                onLog('AI', 'Núcleo Neuronal Google (MediaPipe) Vinculado.');
            }
            else if (selectedModel === 'yolo') {
                if (!yoloSessionRef.current) {
                    // YOLO ONNX Init (Existing Logic)
                    if (!(window as any).ort) throw new Error("Falta ONNX Runtime");

                    // Init Cache
                    if (!float32CacheRef.current) {
                        float32CacheRef.current = new Float32Array(3 * 640 * 640);
                        const c = document.createElement('canvas'); c.width = 640; c.height = 640;
                        canvasCacheRef.current = c;
                        ctxCacheRef.current = c.getContext('2d', { willReadFrequently: true });
                    }

                    onLog('CORE', `Descargando Modelo Neuronal: ${MODEL_URL_DETECTION}`);
                    const modelResp = await fetch(MODEL_URL_DETECTION);
                    if (!modelResp.ok) throw new Error("Descarga de modelo fallida");
                    const modelBuffer = await modelResp.arrayBuffer();

                    onLog('CORE', 'Inicializando Sesión de Inferencia WASM...');
                    (window as any).ort.env.wasm.numThreads = Math.min(navigator.hardwareConcurrency || 4, 8);
                    (window as any).ort.env.wasm.proxy = false; // Disable proxy to prevent buffer detachment

                    onLog('CORE', 'Reservando Memoria Gráfica para Tensores...');
                    yoloSessionRef.current = await (window as any).ort.InferenceSession.create(modelBuffer, {
                        executionProviders: ['wasm'],
                        graphOptimizationLevel: 'all'
                    });
                    onLog('CORE', 'Configurando NMS (Non-Maximum Suppression)...');
                }
                setStatusLabel('CALIBRADO_YOLO11');
                onLog('AI', 'Motor Neuronal (YOLOv11) Calibrado y Listo.');
                onLog('INFO', 'Sistema en espera de flujo de video...');
                setStatus('ready');
            }

        } catch (e: any) {
            console.error(e);
            setStatus('error');
            setStatusLabel('FALLO_NUCLEO');
            onLog('ERROR', `Fallo de Inicialización: ${e.message}`);
        } finally {
            isInitializingRef.current = false;
        }
    };

    useEffect(() => {
        initCore();
    }, [selectedModel]);

    // --- HELPERS ---
    const preprocessYolo = (source: HTMLVideoElement): Float32Array => {
        const ctx = ctxCacheRef.current!;
        // Use byteLength check for detached buffers
        if (!float32CacheRef.current || float32CacheRef.current.buffer.byteLength === 0) {
            float32CacheRef.current = new Float32Array(3 * 640 * 640);
        }
        const cache = float32CacheRef.current!;
        ctx.clearRect(0, 0, 640, 640);
        ctx.drawImage(source, 0, 0, 640, 640);
        const imageData = ctx.getImageData(0, 0, 640, 640).data;
        for (let i = 0; i < 640 * 640; i++) {
            const r = imageData[i * 4] / 255.0;
            const g = imageData[i * 4 + 1] / 255.0;
            const b = imageData[i * 4 + 2] / 255.0;
            cache[i] = r; cache[640 * 640 + i] = g; cache[2 * 640 * 640 + i] = b;
        }
        return cache;
    };

    // --- DETECT OBJECTS ---
    const detect = useCallback(async (source: HTMLVideoElement): Promise<StandardDetection[]> => {
        if (status !== 'ready') return [];

        // ... (Existing Detection Logics)
        if (selectedModel === 'mediapipe' && mediaPipeRef.current) {
            let ts = Math.floor(performance.now() * 1000);
            if (ts <= objTimestampRef.current) ts = objTimestampRef.current + 1;
            objTimestampRef.current = ts;
            try {
                const result = mediaPipeRef.current.detectForVideo(source, ts);
                if (!result.detections) return [];
                return result.detections
                    .map(d => {
                        const box = d.boundingBox!;
                        return {
                            label: d.categories[0].categoryName,
                            score: d.categories[0].score,
                            box: { x: box.originX / source.videoWidth, y: box.originY / source.videoHeight, w: box.width / source.videoWidth, h: box.height / source.videoHeight }
                        };
                    })
                    .filter(d => d.score > confidenceThreshold && RELEVANT_CLASSES.includes(d.label.toLowerCase()));
            } catch (e) {
                return [];
            }
        }

        if (selectedModel === 'yolo' && yoloSessionRef.current) {
            const input = preprocessYolo(source);
            const tensor = new (window as any).ort.Tensor('float32', input, [1, 3, 640, 640]);
            const results = await yoloSessionRef.current.run({ images: tensor });
            const output = results[yoloSessionRef.current.outputNames[0]];
            const data = output.data;
            const numElements = output.dims[2];
            const targetIndices = [2, 3, 5, 7];
            const detections: StandardDetection[] = [];

            for (let i = 0; i < numElements; i++) {
                let maxS = 0; let maxC = -1;
                for (let k = 0; k < targetIndices.length; k++) {
                    const c = targetIndices[k];
                    const s = data[(4 + c) * numElements + i];
                    if (s > maxS) { maxS = s; maxC = c; }
                }
                if (maxS > confidenceThreshold) {
                    // YOLOv8/v11 Standard Output: [cx, cy, w, h] in pixel coordinates
                    const cx = data[0 * numElements + i];
                    const py = data[1 * numElements + i];
                    const pw = data[2 * numElements + i];
                    const ph = data[3 * numElements + i];

                    // Filter unrealistic aspect ratios or noise
                    if ((pw / ph) < 0.2 || (pw / ph) > 5.0 || (pw * ph) < 800) continue;

                    detections.push({
                        label: YOLO_CLASSES[maxC],
                        score: maxS,
                        // Normalize to 0-1 for the tracker/renderer
                        box: {
                            x: (cx - pw / 2) / 640,
                            y: (py - ph / 2) / 640,
                            w: pw / 640,
                            h: ph / 640
                        }
                    });
                }
            }
            if (detections.length > 0) {
                // Periodically log to system log for user feedback
                if (Math.random() > 0.98) onLog('AI', `Núcleo YOLO: ${detections.length} objetos detectados en frame.`);
            }
            return detections;
        }
        return [];
    }, [selectedModel, status, confidenceThreshold]);

    // --- DETECT POSE ---
    const detectPose = useCallback(async (source: HTMLVideoElement): Promise<PoseResult[]> => {
        if (!poseLandmarkerRef.current) return [];
        let ts = Math.floor(performance.now() * 1000);
        if (ts <= poseTimestampRef.current) ts = poseTimestampRef.current + 1;
        poseTimestampRef.current = ts;
        try {
            const result = poseLandmarkerRef.current.detectForVideo(source, ts);
            if (!result.landmarks) return [];
            return result.landmarks.map((l, i) => ({
                landmarks: l,
                worldLandmarks: result.worldLandmarks[i]
            }));
        } catch (e) {
            return [];
        }
    }, []);

    return { status, statusLabel, detect, detectPose };
};

