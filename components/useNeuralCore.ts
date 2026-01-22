import { useState, useEffect, useRef, useCallback } from 'react';
import { ObjectDetector, FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { MEDIAPIPE_MODEL_PATH, MEDIAPIPE_WASM_PATH, MEDIAPIPE_POSE_PATH, RELEVANT_CLASSES } from '../constants';
import { logger } from '../services/logger';

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
    onLog: (type: 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'CORE', content: string) => void;
    confidenceThreshold: number;
    isPoseEnabled: boolean;
}

export const useNeuralCore = ({ onLog, confidenceThreshold, isPoseEnabled }: UseNeuralCoreProps) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [statusLabel, setStatusLabel] = useState('INICIANDO_NÚCLEO...');

    // Refs
    const mediaPipeRef = useRef<ObjectDetector | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const visionRef = useRef<any>(null);
    const isInitializingRef = useRef(false);
    const isPoseInitializingRef = useRef(false);
    const objTimestampRef = useRef(0);
    const poseTimestampRef = useRef(0);

    // --- INIT BASE ---
    const initCore = async () => {
        if (isInitializingRef.current) return;
        isInitializingRef.current = true;

        try {
            setStatus('loading');
            setStatusLabel('CARGANDO_IA...');

            // 1. Init Vision (Shared)
            if (!visionRef.current) {
                logger.core('NEURAL_CORE', 'Sincronizando Motor de Visión Artificial...');
                visionRef.current = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
            }

            // 2. Init Google Core (MediaPipe Object Detector)
            if (!mediaPipeRef.current) {
                setStatusLabel('VINCULANDO_DETECTOR...');
                logger.core('NEURAL_CORE', 'Iniciando carga de Detector de Objetos (EfficientDet)...');
                mediaPipeRef.current = await ObjectDetector.createFromOptions(visionRef.current, {
                    baseOptions: { modelAssetPath: MEDIAPIPE_MODEL_PATH, delegate: "GPU" },
                    scoreThreshold: 0.1,
                    runningMode: 'VIDEO'
                });
                logger.ai('NEURAL_CORE', 'Unidad de Detección Visual Calibrada y Activa.');
            }

            setStatusLabel('NEURAL_SENTINEL_V11');
            setStatus('ready');

        } catch (e: any) {
            console.error(e);
            setStatus('error');
            setStatusLabel('FALLO_NUCLEO');
            onLog('ERROR', `Fallo de Inicialización Base: ${e.message}`);
        } finally {
            isInitializingRef.current = false;
        }
    };

    // --- INIT POSE (ON DEMAND) ---
    const initPose = async () => {
        if (!visionRef.current || poseLandmarkerRef.current || isPoseInitializingRef.current) return;
        isPoseInitializingRef.current = true;

        try {
            logger.core('NEURAL_CORE', 'Activando Módulo de Análisis Cinemático (Pose)...');
            poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(visionRef.current, {
                baseOptions: {
                    modelAssetPath: MEDIAPIPE_POSE_PATH,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 1
            });
            logger.ai('NEURAL_CORE', 'Unidad Cinemática: Pose Landmarker Calibrado y Listo.');
        } catch (e: any) {
            logger.error('NEURAL_CORE', `Error al cargar Módulo de Pose: ${e.message}`);
        } finally {
            isPoseInitializingRef.current = false;
        }
    };

    useEffect(() => {
        initCore();

        return () => {
            if (mediaPipeRef.current) {
                logger.core('NEURAL_CORE', 'Liberando recursos de Detector de Objetos...');
                mediaPipeRef.current.close();
                mediaPipeRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (isPoseEnabled && status === 'ready') {
            initPose();
        }

        return () => {
            if (!isPoseEnabled && poseLandmarkerRef.current) {
                logger.core('NEURAL_CORE', 'Desactivando módulo de Pose (Ahorro de recursos)...');
                poseLandmarkerRef.current.close();
                poseLandmarkerRef.current = null;
            }
        };
    }, [isPoseEnabled, status]);

    // --- DETECT OBJECTS ---
    const detect = useCallback(async (source: HTMLVideoElement, timestamp?: number): Promise<StandardDetection[]> => {
        if (status !== 'ready' || !mediaPipeRef.current) return [];

        const results: StandardDetection[] = [];
        const ts = timestamp ?? performance.now();

        let mpts = ts;
        if (mpts <= objTimestampRef.current) mpts = objTimestampRef.current + 0.001;
        objTimestampRef.current = mpts;

        if (source.videoWidth === 0 || source.videoHeight === 0 || source.readyState < 2) return [];

        try {
            const mpResult = mediaPipeRef.current.detectForVideo(source, mpts);
            if (mpResult.detections) {
                mpResult.detections.forEach(d => {
                    if (!d.categories[0]) return;

                    const label = d.categories[0].categoryName.toLowerCase();
                    // Umbral táctico ajustado para PEATONES, CICLISTAS y MOTOS (Más sensible)
                    const sensitiveClasses = ['person', 'bicycle', 'motorcycle'];
                    const minConf = sensitiveClasses.includes(label) ? 0.45 : confidenceThreshold;

                    if (d.categories[0].score < minConf) return;
                    if (!RELEVANT_CLASSES.includes(label)) return;

                    const b = d.boundingBox!;
                    results.push({
                        label,
                        score: d.categories[0].score,
                        box: {
                            x: b.originX / source.videoWidth,
                            y: b.originY / source.videoHeight,
                            w: b.width / source.videoWidth,
                            h: b.height / source.videoHeight
                        }
                    });
                });
            }
        } catch (e) {
            console.error("MediaPipe Error:", e);
        }

        return results;
    }, [status, confidenceThreshold]);

    // --- DETECT POSE ---
    const detectPose = useCallback(async (source: HTMLVideoElement, timestamp?: number): Promise<PoseResult[]> => {
        if (!poseLandmarkerRef.current) return [];
        let ts = timestamp ?? performance.now();
        if (ts <= poseTimestampRef.current) ts = poseTimestampRef.current + 0.001;
        poseTimestampRef.current = ts;
        if (source.videoWidth === 0 || source.videoHeight === 0 || source.readyState < 2) return [];
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

    return { status, statusLabel, detect, detectPose, mediapipeReady: !!mediaPipeRef.current };
};
