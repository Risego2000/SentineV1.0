import { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM_PATH, MEDIAPIPE_POSE_PATH, RELEVANT_CLASSES } from '../constants';
import { logger } from '../services/logger';
import { StandardDetection, PoseResult, LogType } from '../types';
import { TensorFlowDetector } from '../services/TensorFlowDetector';

/**
 * Hook properties for Neural Core initialization.
 */
interface UseNeuralCoreProps {
  onLog: (type: LogType, content: string) => void;
  confidenceThreshold: number;
  isPoseEnabled: boolean;
}

/**
 * Neural Core Hook.
 * Manages MediaPipe lifecycle for object detection and pose estimation.
 */
export const useNeuralCore = ({
  onLog,
  confidenceThreshold,
  isPoseEnabled,
}: UseNeuralCoreProps) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [statusLabel, setStatusLabel] = useState('INICIANDO_NÚCLEO...');

  // Engine Instances
  const tensorFlowRef = useRef<TensorFlowDetector | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const visionRef = useRef<Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null>(null);

  // Concurrency Guards
  const isInitializingRef = useRef<boolean>(false);
  const isPoseInitializingRef = useRef<boolean>(false);

  // Timestamp Synchronization (Pose only, TensorFlow doesn't need it)
  const poseTimestampRef = useRef<number>(0);

  const releasePose = useCallback(() => {
    if (!poseLandmarkerRef.current) return;
    logger.core('NEURAL_CORE', 'Hibernando módulo de Pose...');
    poseLandmarkerRef.current.close();
    poseLandmarkerRef.current = null;
    poseTimestampRef.current = 0;
  }, []);

  /**
   * Initializes the base Object Detection engine (TensorFlow COCO-SSD).
   */
  const initCore = useCallback(async (): Promise<void> => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    try {
      setStatus('loading');
      setStatusLabel('CARGANDO_TENSORFLOW...');

      // Initialize TensorFlow COCO-SSD detector
      if (!tensorFlowRef.current) {
        setStatusLabel('VINCULANDO_DETECTOR...');
        logger.core(
          'NEURAL_CORE',
          'Inicializando TensorFlow COCO-SSD (90 clases, aceleración GPU)...'
        );
        tensorFlowRef.current = new TensorFlowDetector({
          confidenceThreshold: 0.25,
        });
        await tensorFlowRef.current.init();
        logger.ai(
          'NEURAL_CORE',
          'COCO-SSD Detector Calibrado y Activo (Detección en Tiempo Real, GPU).'
        );
      }

      setStatusLabel('NEURAL_SENTINEL_COCO');
      setStatus('ready');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('NEURAL_CORE', 'Fallo de Inicialización TensorFlow', err);
      setStatus('error');
      setStatusLabel('FALLO_NUCLEO');
      onLog('ERROR', `Error en Motor Neural: ${err.message}`);
    } finally {
      isInitializingRef.current = false;
    }
  }, [onLog]);

  /**
   * Initializes Pose Landmarker (Kinematic Analysis).
   */
  const initPose = async (): Promise<void> => {
    if (!visionRef.current || poseLandmarkerRef.current || isPoseInitializingRef.current) return;
    isPoseInitializingRef.current = true;

    try {
      logger.core('NEURAL_CORE', 'Activando Módulo de Análisis Cinemático (Pose)...');
      poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(visionRef.current, {
        baseOptions: {
          modelAssetPath: MEDIAPIPE_POSE_PATH,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      logger.ai('NEURAL_CORE', 'Unidad Cinemática: Pose Landmarker Calibrado.');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('NEURAL_CORE', `Error al cargar Módulo de Pose`, err);
    } finally {
      isPoseInitializingRef.current = false;
    }
  };

  // Lifecycle: Base Initialization
  useEffect(() => {
    initCore();

    return () => {
      if (tensorFlowRef.current) {
        logger.core('NEURAL_CORE', 'Liberando recursos TensorFlow...');
        tensorFlowRef.current.dispose();
        tensorFlowRef.current = null;
      }
    };
  }, [initCore]);

  // Lifecycle: Pose Initialization/Cleanup
  useEffect(() => {
    if (isPoseEnabled && status === 'ready') {
      initPose();
    } else if (!isPoseEnabled) {
      releasePose();
    }

    return () => {
      releasePose();
    };
  }, [isPoseEnabled, status, releasePose]);

  /**
   * Primary Object Detection Logic (TensorFlow COCO-SSD).
   */
  const detect = useCallback(
    async (source: HTMLVideoElement | HTMLCanvasElement): Promise<StandardDetection[]> => {
      if (status !== 'ready' || !tensorFlowRef.current) return [];

      const width = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
      const height = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
      const readyState = source instanceof HTMLVideoElement ? source.readyState : 2;
      if (width === 0 || height === 0 || readyState < 2) return [];

      try {
        // TensorFlow COCO-SSD detection (returns StandardDetection[] directly)
        const detections = await tensorFlowRef.current.detect(source);

        // Apply dynamic threshold for vulnerable road users
        return detections
          .map((d) => {
            const isVulnerable = ['person', 'bicycle', 'motorcycle'].includes(
              d.label.toLowerCase()
            );
            const dynamicThreshold = isVulnerable
              ? Math.min(0.45, confidenceThreshold)
              : confidenceThreshold;

            if (d.score < dynamicThreshold) return null;

            return d as StandardDetection;
          })
          .filter((d): d is StandardDetection => d !== null);
      } catch (error) {
        logger.error('NEURAL_CORE', 'TensorFlow Detection Error', error);
        return [];
      }
    },
    [status, confidenceThreshold]
  );

  /**
   * Kinematic Analysis (Pose Detection).
   */
  const detectPose = useCallback(async (source: HTMLVideoElement): Promise<PoseResult[]> => {
    if (!poseLandmarkerRef.current) return [];

    let ts = performance.now();
    if (ts <= poseTimestampRef.current) ts = poseTimestampRef.current + 0.001;
    poseTimestampRef.current = ts;

    if (source.videoWidth === 0 || source.videoHeight === 0 || source.readyState < 2) return [];

    try {
      const result = poseLandmarkerRef.current.detectForVideo(source, ts);
      if (!result.landmarks) return [];

      return result.landmarks.map((l, i) => ({
        landmarks: l,
        worldLandmarks: result.worldLandmarks[i],
      }));
    } catch (error) {
      logger.error('NEURAL_CORE', 'Pose Detection Error', error);
      return [];
    }
  }, []);

  return { status, statusLabel, detect, detectPose, mediapipeReady: !!tensorFlowRef.current };
};
