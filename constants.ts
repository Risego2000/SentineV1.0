import {
  GeometryLine,
  PresetType,
  DetectionPresetData,
  AuditPresetType,
  AuditPresetData,
  KinematicPresetType,
  KinematicPresetData,
} from './types';

export const MEDIAPIPE_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm';
export const MEDIAPIPE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
export const MEDIAPIPE_POSE_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';
export const RELEVANT_CLASSES = ['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'person'];

export const VEHICLE_COLORS: Record<string, string> = {
  car: '#38bdf8', // Blue-400
  truck: '#818cf8', // Indigo-400
  bus: '#fbbf24', // Amber-400
  motorcycle: '#f472b6', // Pink-400
  bicycle: '#4ade80', // Green-400
  person: '#fb7185', // Rose-400
};

export const LABEL_MAP: Record<string, string> = {
  car: 'TURISMO',
  truck: 'CAMIÓN',
  bus: 'AUTOBÚS',
  motorcycle: 'MOTOCICLETA',
  bicycle: 'BICICLETA',
  person: 'PEATÓN',
};

export interface RoadPreset {
  lines: GeometryLine[];
  directivesTemplate: string;
}

// Rediseño de presets con perspectiva diagonal (Típica de cámaras de tráfico)
export const ROAD_PRESETS: Record<string, RoadPreset> = {
  // PROTOCOLO DE SEGURIDAD IA SENTINEL (NUEVO)
  'seguridad-protocolo-full': {
    lines: [
      {
        id: 'safety_stop',
        x1: 0.2,
        y1: 0.8,
        x2: 0.8,
        y2: 0.8,
        label: 'LÍNEA DE STOP CRÍTICA',
        type: 'stop_line',
      },
      {
        id: 'safety_ped',
        x1: 0.1,
        y1: 0.9,
        x2: 0.9,
        y2: 0.9,
        label: 'PASO CEBRA VIGILADO',
        type: 'pedestrian',
      },
      {
        id: 'safety_way',
        x1: 0.5,
        y1: 0.2,
        x2: 0.5,
        y2: 0.8,
        label: 'SENTIDO FLUJO',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `[SENTINEL_ELITE_PROTOCOL]:\n- Auditoría total de STOP y Pasos Peatonales.\n- Detección de sentidos contrarios y giros prohibidos.`,
  },
  'seguridad-stop-falso': {
    lines: [
      {
        id: 'stop_1',
        x1: 0.25,
        y1: 0.75,
        x2: 0.75,
        y2: 0.75,
        label: 'ALTO STOP',
        type: 'stop_line',
      },
    ],
    directivesTemplate: `PROTOCOL_STOP_VIOLATION:\n- Detectar falta de detención total (v > 0 km/h) en línea de detención.\n- Art. 151 RGC.`,
  },
  'seguridad-paso-peatones': {
    lines: [
      {
        id: 'ped_1',
        x1: 0.2,
        y1: 0.85,
        x2: 0.8,
        y2: 0.85,
        label: 'PRIORIDAD PEATONAL',
        type: 'pedestrian',
      },
    ],
    directivesTemplate: `PROTOCOL_PEDESTRIAN_PRIORITY:\n- Vigilar preferencia de peatones en calzada.\n- Sanción: 200€ / 4 puntos.`,
  },
  'seguridad-sentido-contrario': {
    lines: [
      {
        id: 'way_1',
        x1: 0.48,
        y1: 0.3,
        x2: 0.52,
        y2: 0.7,
        label: 'SENTIDO CONTRARIO',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_WRONG_WAY:\n- Identificar vectores de movimiento opuestos al flujo legal.\n- Muy Grave: 500€ / 6 puntos.`,
  },
  'seguridad-giro-u': {
    lines: [
      {
        id: 'uturn_1',
        x1: 0.3,
        y1: 0.5,
        x2: 0.7,
        y2: 0.6,
        label: 'GIRO U PROHIBIDO',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_ILLEGAL_UTURN:\n- Detectar maniobras de inversión de giro en línea continua.`,
  },

  // OBSTRUCCIÓN Y APARCAMIENTO
  'infraccion-doble-fila': {
    lines: [
      {
        id: 'double_1',
        x1: 0.75,
        y1: 0.3,
        x2: 0.85,
        y2: 0.8,
        label: 'DOBLE FILA',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_DOUBLE_PARKING:\n- Vehículo estacionado obstaculizando carril activo.\n- v = 0 km/h persistente.`,
  },
  'infraccion-bloqueo-cruce': {
    lines: [
      {
        id: 'box_1',
        x1: 0.3,
        y1: 0.4,
        x2: 0.7,
        y2: 0.7,
        label: 'BLOQUEO INTERSECCIÓN',
        type: 'box_junction',
        points: [
          { x: 0.3, y: 0.4 },
          { x: 0.7, y: 0.4 },
          { x: 0.8, y: 0.7 },
          { x: 0.2, y: 0.7 },
        ],
      },
    ],
    directivesTemplate: `PROTOCOL_GRIDLOCK:\n- Prohibido detenerse dentro de la cuadrícula amarilla.`,
  },

  // USO DE CARRILES
  'infraccion-carril-bus': {
    lines: [
      {
        id: 'bus_1',
        x1: 0.8,
        y1: 0.2,
        x2: 0.9,
        y2: 0.9,
        label: 'CARRIL BUS/TAXI',
        type: 'bus_lane',
      },
    ],
    directivesTemplate: `PROTOCOL_BUS_LANE:\n- Acceso restringido a transporte público y autorizados.`,
  },
  'arcen-emergencia': {
    lines: [
      {
        id: 'arc_1',
        x1: 0.9,
        y1: 0.2,
        x2: 0.98,
        y2: 0.9,
        label: 'INVASIÓN ARCÉN',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_SHOULDER_USE:\n- Circulación indebida por arcén de seguridad.`,
  },
  'daganzo-m100-autovia': {
    lines: [
      {
        id: 'm100_1',
        x1: 0.45,
        y1: 0.3,
        x2: 0.55,
        y2: 0.8,
        label: 'LÍNEA CONTINUA',
        type: 'lane_divider',
      },
    ],
    directivesTemplate: `PROTOCOL_M100_SOLID_LINE:\n- Control de rebasamiento de línea continua central.`,
  },

  // INTERSECCIONES
  'int-rotonda': {
    lines: [
      {
        id: 'rot_1',
        x1: 0.3,
        y1: 0.8,
        x2: 0.7,
        y2: 0.8,
        label: 'ENTRADA ROTONDA',
        type: 'stop_line',
      },
    ],
    directivesTemplate: `PROTOCOL_ROUNDABOUT:\n- Preferencia de circulación interior. Ceda el paso entrada.`,
  },
  'int-t': {
    lines: [
      {
        id: 'tint_1',
        x1: 0.1,
        y1: 0.75,
        x2: 0.4,
        y2: 0.75,
        label: 'INTERSECCIÓN T',
        type: 'stop_line',
      },
    ],
    directivesTemplate: `PROTOCOL_T_JUNCTION:\n- Control de incorporación desde vía secundaria.`,
  },
};

export const ROAD_MENU_GROUPS = [
  {
    label: 'PROTOCOLO SEGURIDAD IA SENTINEL',
    icon: '🛡️',
    items: [
      {
        id: 'seguridad-protocolo-full',
        label: 'SENTINEL FULL PRO',
        icon: '⚡',
        desc: 'Protocolo de seguridad vial de élite (STOP + Peatonal + Flujo).',
      },
    ],
  },
  {
    label: 'INFRACCIONES DE SEGURIDAD',
    icon: '🚨',
    items: [
      {
        id: 'seguridad-stop-falso',
        label: 'SALTARSE STOP',
        icon: '🛑',
        desc: 'Detecta falta de detención completa.',
      },
      {
        id: 'seguridad-paso-peatones',
        label: 'PRIORIDAD PEATONAL',
        icon: '🚶',
        desc: 'Control de pasos de cebra.',
      },
      {
        id: 'seguridad-sentido-contrario',
        label: 'SENTIDO CONTRARIO',
        icon: '⛔',
        desc: 'Circular contra el flujo legal.',
      },
      {
        id: 'seguridad-giro-u',
        label: 'GIRO EN U PROHIBIDO',
        icon: '↩️',
        desc: 'Inversión de giro ilegal.',
      },
    ],
  },
  {
    label: 'OBSTRUCCIÓN Y APARCAMIENTO',
    icon: '🚧',
    items: [
      {
        id: 'infraccion-doble-fila',
        label: 'DOBLE FILA',
        icon: '🚗',
        desc: 'Parada en carril activo.',
      },
      {
        id: 'infraccion-bloqueo-cruce',
        label: 'BLOQUEO INTERSECCIÓN',
        icon: '🔲',
        desc: 'Quedarse dentro del cruce.',
      },
      {
        id: 'zona-carga-descarga',
        label: 'CARGA/DESCARGA',
        icon: '📦',
        desc: 'Uso indebido zona logística.',
      },
    ],
  },
  {
    label: 'USO DE CARRILES',
    icon: '🛣️',
    items: [
      {
        id: 'infraccion-carril-bus',
        label: 'CARRIL BUS/TAXI',
        icon: '🚌',
        desc: 'Uso indebido carril bus.',
      },
      {
        id: 'arcen-emergencia',
        label: 'INVASIÓN DE ARCÉN',
        icon: '⚠️',
        desc: 'Circular por el arcén.',
      },
      {
        id: 'daganzo-m100-autovia',
        label: 'LÍNEA CONTINUA',
        icon: '➖',
        desc: 'Rebasar línea continua M-100.',
      },
    ],
  },
  {
    label: 'ZONAS DE ANÁLISIS ROI',
    icon: '🛡️',
    items: [
      {
        id: 'roi-general-demo',
        label: 'ROI GENERAL (A)',
        icon: '🟢',
        desc: 'Análisis automático al entrar en la zona.',
      },
      {
        id: 'roi-turn-demo',
        label: 'GIRO PROHIBIDO (A+B)',
        icon: '🟣',
        desc: 'Detección secuencial de giros no permitidos.',
      },
    ],
  },
];

export const DETECTION_PRESETS: Record<PresetType, DetectionPresetData> = {
  scout: {
    label: 'Scout',
    description: 'Alta velocidad (60fps), baja latencia.',
    config: {
      confidenceThreshold: 0.3,
      nmsThreshold: 0.3,
      detectionSkip: 2,
      persistence: 33,
      predictionLookahead: 10,
    },
  },
  sentinel: {
    label: 'Sentinel',
    description: 'Balance ideal: seguimiento estándar.',
    config: {
      confidenceThreshold: 0.35,
      nmsThreshold: 0.4,
      detectionSkip: 4,
      persistence: 67,
      predictionLookahead: 20,
    },
  },
  warden: {
    label: 'Warden',
    description: 'Máxima precisión para tráfico denso.',
    config: {
      confidenceThreshold: 0.45,
      nmsThreshold: 0.5,
      detectionSkip: 6,
      persistence: 100,
      predictionLookahead: 30,
    },
  },
  shadow: {
    label: 'Shadow',
    description: 'Filtro para baja visibilidad/nocturno.',
    config: {
      confidenceThreshold: 0.25,
      nmsThreshold: 0.3,
      detectionSkip: 8,
      persistence: 167,
      predictionLookahead: 40,
    },
  },
};

export const AUDIT_PRESETS: Record<AuditPresetType, AuditPresetData> = {
  standard: {
    label: 'Estándar',
    description: 'Auditoría equilibrada.',
    instructions: 'Analyze common traffic violations with standard rigor.',
  },
  flash: {
    label: 'Flash 2.0',
    description: 'OCR y placa ultrarrápido.',
    instructions: 'Detect and identify license plates rapidly with high-speed neural processing.',
  },
  tactical: {
    label: 'Táctico Pro',
    description: 'Análisis de maniobra dinámica.',
    instructions: 'Detailed behavioral and kinetic analysis of the vehicle maneuvers.',
  },
  full: {
    label: 'Jurídico Premium',
    description: 'Expediente RGC completo.',
    instructions: 'Full legal audit according to RGC standards with detailed article citations.',
  },
  neural: {
    label: 'Motor Neural',
    description: 'Patrones de riesgo profundo.',
    instructions:
      'Deep neural analysis focusing on high-risk traffic patterns and cognitive anomalies.',
  },
  senior: {
    label: 'Ingeniero Senior',
    description: 'Peritaje biónico EvidenceDB.',
    instructions:
      'Supreme architectural audit leveraging asynchronous EvidenceDB and ForensicQueue for maximum reliability.',
  },
};

export const KINEMATIC_PRESETS: Record<KinematicPresetType, KinematicPresetData> = {
  lite: {
    label: 'Modelo Lite',
    description: 'Análisis de flujo rápido.',
    model: 'lite',
    pose: false,
  },
  full: {
    label: 'Modelo Full',
    description: 'Detección estándar biónica.',
    model: 'full',
    pose: true,
  },
  heavy: {
    label: 'Modelo Heavy',
    description: 'Peritaje estructural profundo.',
    model: 'heavy',
    pose: true,
  },
};

export const GEOMETRY_PRESETS: Record<string, GeometryLine[]> = {
  m113_highway: [
    {
      id: 'm113_1',
      x1: 0.1,
      y1: 0.4,
      x2: 0.9,
      y2: 0.4,
      label: 'Arcén M-113',
      type: 'lane_divider',
    },
    {
      id: 'm113_2',
      x1: 0.1,
      y1: 0.6,
      x2: 0.9,
      y2: 0.6,
      label: 'Línea Continua',
      type: 'lane_divider',
    },
  ],
};
