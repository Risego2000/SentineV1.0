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

// MediaPipe Assets
export const MEDIAPIPE_MODEL_PATH = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite";
export const MEDIAPIPE_WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm";
export const MEDIAPIPE_POSE_PATH = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/**
 * SISTEMA 1: MOTOR BIÓNICO (MediaPipe)
 * Controla el rendimiento de la detección en tiempo real.
 */
export const DETECTION_PRESETS = {
    standard: {
        label: 'EQUILIBRADO',
        description: 'Balance ideal para seguimiento y cinemática.',
        config: {
            confidenceThreshold: 0.35,
            nmsThreshold: 0.50,
            detectionSkip: 3,
            persistence: 25,
            predictionLookahead: 15
        }
    },
    precision: {
        label: 'ALTA PRECISIÓN',
        description: 'Especializado en tráfico denso y solapamiento.',
        config: {
            confidenceThreshold: 0.50,
            nmsThreshold: 0.30,
            detectionSkip: 1,
            persistence: 50,
            predictionLookahead: 10
        }
    },
    fast: {
        label: 'MÁXIMA VELOCIDAD',
        description: 'Optimizado para alta velocidad y bajo consumo.',
        config: {
            confidenceThreshold: 0.25,
            nmsThreshold: 0.60,
            detectionSkip: 5,
            persistence: 15,
            predictionLookahead: 30
        }
    }
};

export type PresetType = keyof typeof DETECTION_PRESETS;

/**
 * SISTEMA 2: UNIDAD FORENSE (Gemini AI)
 * Controla la profundidad del análisis legal y descriptivo.
 */
export const AUDIT_PRESETS = {
    lite: {
        label: 'MODO FLASH',
        description: 'Validación instantánea y matrícula.',
        instructions: 'Análisis ultrarrápido: Confirma infracción y extrae matrícula.'
    },
    standard: {
        label: 'PERITAJE TÁCTICO',
        description: 'Análisis técnico y descripción de maniobra.',
        instructions: 'Identifica vehículo completo y describe la cinemática de la infracción.'
    },
    deep: {
        label: 'EXPEDIENTE RGC',
        description: 'Análisis profundo con base legal completa.',
        instructions: 'Análisis forense exhaustivo con citación de artículos del Reglamento de Circulación.'
    }
};

export type AuditPresetType = keyof typeof AUDIT_PRESETS;

/**
 * SISTEMA 3: MOTOR CINEMÁTICO (Pose & Kalman)
 * Controla la profundidad del análisis estructural y trayectorias.
 */
export const KINEMATIC_PRESETS = {
    lite: {
        label: 'MODELO LITE',
        description: 'Procesado ultrarrápido para análisis de flujo.',
        model: 'lite',
        pose: true
    },
    full: {
        label: 'MODELO FULL',
        description: 'Balance ideal: Detección estándar biónica.',
        model: 'full',
        pose: true
    },
    heavy: {
        label: 'MODELO HEAVY',
        description: 'Máxima precisión: Peritaje estructural profundo.',
        model: 'heavy',
        pose: true
    }
};

export type KinematicPresetType = keyof typeof KINEMATIC_PRESETS;