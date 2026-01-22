export const TRACK_SMOOTHING = 0.4;

export const VEHICLE_COLORS: Record<string, string> = {
    car: '#06b6d4', truck: '#f59e0b', motorcycle: '#8b5cf6', bus: '#10b981', person: '#f43f5e', bicycle: '#22d3ee'
};

export const RELEVANT_CLASSES = ['car', 'truck', 'motorcycle', 'bus', 'person', 'bicycle'];

export const LABEL_MAP: Record<string, string> = {
    car: 'VEHÍCULO',
    truck: 'CAMIÓN',
    motorcycle: 'MOTO',
    bus: 'BUS',
    person: 'PEATÓN',
    bicycle: 'CICLISTA'
};

// MediaPipe Assets - Upgraded to Lite2 for better accuracy (Fastest + Most Accurate balance)
export const MEDIAPIPE_MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite";
export const MEDIAPIPE_WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";
export const MEDIAPIPE_POSE_PATH = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export const DETECTION_PRESETS = {
    performance: {
        label: 'RENDIMIENTO LIVE',
        description: 'Optimizado para fluidez máxima y menor consumo.',
        config: {
            confidenceThreshold: 0.45,
            nmsThreshold: 0.50,
            detectionSkip: 4,
            persistence: 15,
            predictionLookahead: 10
        }
    },
    standard: {
        label: 'MODO PATRULLA',
        description: 'Equilibrio ideal para vigilancia urbana continua.',
        config: {
            confidenceThreshold: 0.35,
            nmsThreshold: 0.45,
            detectionSkip: 2,
            persistence: 30,
            predictionLookahead: 15
        }
    },
    precision: {
        label: 'ALTA DEFINICIÓN',
        description: 'Mayor rango de detección en escenas complejas.',
        config: {
            confidenceThreshold: 0.28,
            nmsThreshold: 0.40,
            detectionSkip: 1,
            persistence: 45,
            predictionLookahead: 25
        }
    },
    audit: {
        label: 'AUDITORÍA FORENSE',
        description: 'Análisis quirúrgico frame a frame para expedientes.',
        config: {
            confidenceThreshold: 0.18,
            nmsThreshold: 0.35,
            detectionSkip: 1,
            persistence: 60,
            predictionLookahead: 35
        }
    }
};

export type PresetType = keyof typeof DETECTION_PRESETS;