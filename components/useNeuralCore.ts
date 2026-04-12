import { useState, useEffect, useRef, useCallback } from 'react';
import { ObjectDetector, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import {
  MEDIAPIPE_MODEL_PATH,
  MEDIAPIPE_WASM_PATH,
  MEDIAPIPE_POSE_PATH,
  RELEVANT_CLASSES,
} from '../constants';
import { logger } from '../services/logger';
import { StandardDetection, PoseResult, LogType } from '../types';

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
  const mediaPipeRef = useRef<ObjectDetector | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const visionRef = useRef<Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>> | null>(null);

  // Concurrency Guards
  const isInitializingRef = useRef<boolean>(false);
  const isPoseInitializingRef = useRef<boolean>(false);

  // Timestamp Synchronization (MediaPipe requirement)
  const objTimestampRef = useRef<number>(0);
  const poseTimestampRef = useRef<number>(0);

  const releasePose = useCallback(() => {
    if (!poseLandmarkerRef.current) return;
    logger.core('NEURAL_CORE', 'Hibernando módulo de Pose...');
    poseLandmarkerRef.current.close();
    poseLandmarkerRef.current = null;
    poseTimestampRef.current = 0;
  }, []);

  /**
   * Initializes the base Object Detection engine.
   */
  const initCore = useCallback(async (): Promise<void> => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    try {
      setStatus('loading');
      setStatusLabel('CARGANDO_IA...');

      // 1. Init Vision Library (Shared WASM)
      if (!visionRef.current) {
        logger.core('NEURAL_CORE', 'Sincronizando Motor de Visión Artificial...');
        visionRef.current = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);
      }

      // 2. Create Object Detector
      if (!mediaPipeRef.current) {
        setStatusLabel('VINCULANDO_DETECTOR...');
        logger.core('NEURAL_CORE', 'Iniciando carga de Detector de Objetos (EfficientDet)...');
        mediaPipeRef.current = await ObjectDetector.createFromOptions(visionRef.current, {
          baseOptions: {
            modelAssetPath: MEDIAPIPE_MODEL_PATH,
            delegate: 'GPU',
          },
          scoreThreshold: 0.1, // Low internal threshold; filtered later by confidenceThreshold
          runningMode: 'VIDEO',
        });
        logger.ai('NEURAL_CORE', 'Unidad de Detección Visual Calibrada y Activa.');
      }

      setStatusLabel('NEURAL_SENTINEL_V1.1');
      setStatus('ready');
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('NEURAL_CORE', 'Fallo de Inicialización Base', err);
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
      if (mediaPipeRef.current) {
        logger.core('NEURAL_CORE', 'Liberando recursos de Visión...');
        mediaPipeRef.current.close();
        mediaPipeRef.current = null;
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
   * Primary Object Detection Logic.
   */
  const detect = useCallback(
    async (source: HTMLVideoElement): Promise<StandardDetection[]> => {
      if (status !== 'ready' || !mediaPipeRef.current) return [];

      const ts = performance.now();
      let mpts = ts;

      // Strict timestamp increment for MediaPipe
      if (mpts <= objTimestampRef.current) mpts = objTimestampRef.current + 0.001;
      objTimestampRef.current = mpts;

      if (source.videoWidth === 0 || source.videoHeight === 0 || source.readyState < 2) return [];

      try {
        const mpResult = mediaPipeRef.current.detectForVideo(source, mpts);
        if (!mpResult.detections) return [];

        return mpResult.detections
          .filter(
            (d) =>
              d.categories[0] &&
              RELEVANT_CLASSES.includes(d.categories[0].categoryName.toLowerCase())
          )
          .map((d) => {
            const category = d.categories[0];
            const label = category.categoryName.toLowerCase();
            const b = d.boundingBox!;

            // Sensitivity heuristic for vulnerable road users
            const isVulnerable = ['person', 'bicycle', 'motorcycle'].includes(label);
            const dynamicThreshold = isVulnerable
              ? Math.min(0.45, confidenceThreshold)
              : confidenceThreshold;

            if (category.score < dynamicThreshold) return null;

            return {
              label,
              score: category.score,
              box: {
                x: b.originX / source.videoWidth,
                y: b.originY / source.videoHeight,
                w: b.width / source.videoWidth,
                h: b.height / source.videoHeight,
              },
            } as StandardDetection;
          })
          .filter((d): d is StandardDetection => d !== null);
      } catch (error) {
        logger.error('NEURAL_CORE', 'Detection Error', error);
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

  return { status, statusLabel, detect, detectPose, mediapipeReady: !!mediaPipeRef.current };
};
