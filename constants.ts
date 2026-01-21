export const TRACK_SMOOTHING = 0.4;

export const VEHICLE_COLORS: Record<string, string> = {
    car: '#06b6d4', truck: '#f59e0b', motorcycle: '#8b5cf6', bus: '#10b981', person: '#f43f5e'
};

export const RELEVANT_CLASSES = ['car', 'truck', 'motorcycle', 'bus', 'person'];

// MediaPipe Assets
export const MEDIAPIPE_MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";
export const MEDIAPIPE_WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";
export const MEDIAPIPE_POSE_PATH = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export const DETECTION_PRESETS = {
    standard: {
        label: 'ESTÁNDAR',
        description: 'Equilibrio óptimo para flujo vehicular constante.',
        config: {
            confidenceThreshold: 0.35,
            nmsThreshold: 0.45,
            detectionSkip: 2,
            persistence: 30,
            predictionLookahead: 15
        }
    },
    precision: {
        label: 'ALTA PRECISIÓN',
        description: 'Análisis exhaustivo, ideal para auditoría forense.',
        config: {
            confidenceThreshold: 0.25,
            nmsThreshold: 0.40,
            detectionSkip: 1,
            persistence: 50,
            predictionLookahead: 25
        }
    },
    performance: {
        label: 'RENDIMIENTO',
        description: 'Máxima fluidez, optimizado para live feeds y móviles.',
        config: {
            confidenceThreshold: 0.45,
            nmsThreshold: 0.50,
            detectionSkip: 4,
            persistence: 15,
            predictionLookahead: 10
        }
    },
    urban: {
        label: 'TRÁFICO URBANO',
        description: 'Especializado en peatones y tráfico denso lento.',
        config: {
            confidenceThreshold: 0.30,
            nmsThreshold: 0.45,
            detectionSkip: 2,
            persistence: 40,
            predictionLookahead: 20
        }
    }
};

export type PresetType = keyof typeof DETECTION_PRESETS;
