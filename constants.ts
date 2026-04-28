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
  'seguridad-ceda-paso': {
    lines: [
      {
        id: 'yield_1',
        x1: 0.3,
        y1: 0.75,
        x2: 0.7,
        y2: 0.75,
        label: 'CEDA EL PASO',
        type: 'stop_line',
      },
    ],
    directivesTemplate: `PROTOCOL_YIELD_VIOLATION:\n- Detectar falta de ceda el paso en señal triangular.\n- Art. 152 RGC - Falta grave.`,
  },
  'seguridad-semaforo-rojo': {
    lines: [
      {
        id: 'traffic_red_1',
        x1: 0.4,
        y1: 0.8,
        x2: 0.6,
        y2: 0.8,
        label: 'SEMÁFORO ROJO',
        type: 'stop_line',
      },
    ],
    directivesTemplate: `PROTOCOL_RED_LIGHT:\n- Detectar cruce en fase roja del semáforo.\n- Art. 150 RGC - Falta muy grave.`,
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

  // NUEVAS INFRACCIONES - SISTEMA COMPLETO
  'seguridad-giro-prohibido': {
    lines: [
      {
        id: 'giro_prohibido',
        x1: 0.3,
        y1: 0.5,
        x2: 0.7,
        y2: 0.6,
        label: 'GIRO PROHIBIDO',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_FORBIDDEN_TURN:\n- Detectar maniobras de giro prohibido por geometría o ROI.\n- Art. 36.2 RGC - Sanción 200€ / -3 pts.`,
  },
  'seguridad-direccion-obligatoria': {
    lines: [
      {
        id: 'direccion_obligatoria',
        x1: 0.45,
        y1: 0.3,
        x2: 0.55,
        y2: 0.7,
        label: 'DIRECCIÓN OBLIGATORIA',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_MANDATORY_DIRECTION:\n- Control de trayectoria vs dirección obligatoria.\n- Señales R-400 a R-406 RGC.`,
  },
  'infraccion-doble-fila-geo': {
    lines: [
      {
        id: 'doble_fila',
        x1: 0.75,
        y1: 0.3,
        x2: 0.85,
        y2: 0.8,
        label: 'ZONA DE DOBLE FILA',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_DOUBLE_PARKING:\n- Vehículo en segunda fila obstaculizando carril activo.\n- Art. 87.1 RGC - 200€.`,
  },
  'infraccion-bloqueo-cruce-geo': {
    lines: [
      {
        id: 'bloqueo_cruce',
        x1: 0.3,
        y1: 0.4,
        x2: 0.7,
        y2: 0.7,
        label: 'ZONA DE CRUCE (Yellow Box)',
        type: 'box_junction',
        points: [
          { x: 0.3, y: 0.4 },
          { x: 0.7, y: 0.4 },
          { x: 0.8, y: 0.7 },
          { x: 0.2, y: 0.7 },
        ],
      },
    ],
    directivesTemplate: `PROTOCOL_JUNCTION_BLOCKING:\n- Prohibido detenerse dentro del cruce.\n- Art. 142 RGC.`,
  },
  'carril-bus-geo': {
    lines: [
      {
        id: 'carril_bus',
        x1: 0.8,
        y1: 0.2,
        x2: 0.9,
        y2: 0.9,
        label: 'CARRIL BUS/TAXI EXCLUSIVO',
        type: 'bus_lane',
      },
    ],
    directivesTemplate: `PROTOCOL_BUS_LANE_RESTRICTION:\n- Acceso restringido a transporte público y vehículos autorizados.\n- Art. 48 RGC.`,
  },
  'invasion-arcen-geo': {
    lines: [
      {
        id: 'invasion_arcen',
        x1: 0.9,
        y1: 0.2,
        x2: 0.98,
        y2: 0.9,
        label: 'ARCÉN DE SEGURIDAD',
        type: 'forbidden',
      },
    ],
    directivesTemplate: `PROTOCOL_SHOULDER_INVASION:\n- Circulación indebida por arcén sin causa.\n- Art. 49 RGC.`,
  },
  'linea-continua-geo': {
    lines: [
      {
        id: 'linea_continua_nueva',
        x1: 0.45,
        y1: 0.2,
        x2: 0.55,
        y2: 0.8,
        label: 'LÍNEA CONTINUA - ADELANTAMIENTO PROHIBIDO',
        type: 'lane_divider',
      },
    ],
    directivesTemplate: `PROTOCOL_SOLID_LINE_CROSSING:\n- Control de rebasamiento y adelantamientos en línea continua.\n- Art. 43 RGC - Sanción 200€ / -4 pts.`,
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
    label: 'INTERSECCIONES Y SEGURIDAD VIAL',
    icon: '🚨',
    items: [
      {
        id: 'seguridad-stop-falso',
        label: 'STOP — NO DETENCIÓN',
        icon: '🛑',
        desc: 'Art. 151 RGC | 200€ | -4 pts | Detecta falta de detención completa ante STOP.',
      },
      {
        id: 'seguridad-ceda-paso',
        label: 'CEDA EL PASO',
        icon: '⚪',
        desc: 'Art. 57 RGC | 200€ | -4 pts | No cede prioridad a vehículo o peatón.',
      },
      {
        id: 'seguridad-paso-peatones',
        label: 'PRIORIDAD PEATONAL',
        icon: '🚶',
        desc: 'Art. 146 RGC | 200€ | -6 pts | No respeta paso de peatones.',
      },
      {
        id: 'seguridad-semaforo-rojo',
        label: 'SEMÁFORO EN ROJO',
        icon: '🚦',
        desc: 'Art. 150 RGC | 200€ | -4 pts | Rebasar línea en luz roja.',
      },
    ],
  },
  {
    label: 'MANIOBRAS',
    icon: '🔄',
    items: [
      {
        id: 'seguridad-giro-prohibido',
        label: 'GIRO PROHIBIDO',
        icon: '↩️',
        desc: 'Art. 36.2 RGC | 200€ | -3 pts | Realizar giro no permitido.',
      },
      {
        id: 'seguridad-direccion-obligatoria',
        label: 'DIRECCIÓN OBLIGATORIA',
        icon: '➡️',
        desc: 'Art. 36.1 RGC | 200€ | 0 pts | No seguir dirección obligatoria.',
      },
    ],
  },
  {
    label: 'CIRCULACIÓN PELIGROSA',
    icon: '⛔',
    items: [
      {
        id: 'seguridad-sentido-contrario',
        label: 'SENTIDO CONTRARIO',
        icon: '⛔',
        desc: 'Art. 31 RGC | 500€ | -6 pts | CRÍTICA | Circular en dirección opuesta.',
      },
    ],
  },
  {
    label: 'PARADA Y OBSTRUCCIÓN',
    icon: '🚧',
    items: [
      {
        id: 'infraccion-doble-fila',
        label: 'DOBLE FILA',
        icon: '🚗',
        desc: 'Art. 87.1 RGC | 200€ | 0 pts | Estacionar obstaculizando circulación.',
      },
      {
        id: 'infraccion-bloqueo-cruce',
        label: 'BLOQUEO DE INTERSECCIÓN',
        icon: '🔲',
        desc: 'Art. 142 RGC | 200€ | 0 pts | Quedar detenido en cruce sin poder salir.',
      },
    ],
  },
  {
    label: 'USO DE CARRILES',
    icon: '🛣️',
    items: [
      {
        id: 'infraccion-carril-bus',
        label: 'CARRIL BUS / TAXI',
        icon: '🚌',
        desc: 'Art. 48 RGC | 200€ | 0 pts | Circular por carril reservado.',
      },
      {
        id: 'arcen-emergencia',
        label: 'INVASIÓN DE ARCÉN',
        icon: '⚠️',
        desc: 'Art. 49 RGC | 200€ | 0 pts | Circular por arcén sin causa.',
      },
      {
        id: 'daganzo-m100-autovia',
        label: 'LÍNEA CONTINUA',
        icon: '➖',
        desc: 'Art. 43 RGC | 200€ | -4 pts | Rebasar línea continua.',
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
    description: 'COCO-SSD: Máxima velocidad (100ms), todos los fotogramas, latencia ultra-baja.',
    config: {
      confidenceThreshold: 0.25,
      nmsThreshold: 0.3,
      detectionSkip: 0,
      persistence: 30,
      predictionLookahead: 5,
    },
  },
  sentinel: {
    label: 'Sentinel',
    description: 'COCO-SSD: Equilibrio óptimo (120ms), 90 clases COCO, tracking persistente.',
    config: {
      confidenceThreshold: 0.28,
      nmsThreshold: 0.35,
      detectionSkip: 0,
      persistence: 50,
      predictionLookahead: 10,
    },
  },
  warden: {
    label: 'Warden',
    description: 'COCO-SSD: Máxima precisión (140ms), confianza 32%, tráfico denso.',
    config: {
      confidenceThreshold: 0.32,
      nmsThreshold: 0.4,
      detectionSkip: 0,
      persistence: 80,
      predictionLookahead: 15,
    },
  },
  shadow: {
    label: 'Shadow',
    description: 'COCO-SSD: Baja visibilidad (150ms), confianza 20%, análisis nocturno.',
    config: {
      confidenceThreshold: 0.2,
      nmsThreshold: 0.25,
      detectionSkip: 0,
      persistence: 120,
      predictionLookahead: 20,
    },
  },
};

export const AUDIT_PRESETS: Record<AuditPresetType, AuditPresetData> = {
  standard: {
    label: 'Estándar',
    description: 'OCR mejorado (+15-25%), auditoría equilibrada.',
    instructions: 'Analyze common traffic violations with standard rigor using enhanced OCR with automatic plate cropping.',
  },
  flash: {
    label: 'Flash 2.0',
    description: 'OCR ultrarrápido con crop automático de matrícula.',
    instructions: 'High-speed plate detection with automatic cropping region for rapid identification.',
  },
  tactical: {
    label: 'Táctico Pro',
    description: 'Análisis cinemático + OCR mejorado para maniobras.',
    instructions: 'Detailed behavioral and kinetic analysis with enhanced OCR precision on license plates.',
  },
  full: {
    label: 'Jurídico Premium',
    description: 'Expediente RGC completo con OCR 20% más preciso.',
    instructions: 'Full legal audit according to RGC standards with AI-enhanced plate recognition and detailed article citations.',
  },
  neural: {
    label: 'Motor Neural',
    description: 'Patrones profundos + OCR adaptativo por contexto.',
    instructions:
      'Deep neural analysis with context-aware OCR tuning for maximum plate recognition accuracy.',
  },
  senior: {
    label: 'Ingeniero Senior',
    description: 'Peritaje EvidenceDB + OCR crop inteligente.',
    instructions:
      'Supreme architectural audit leveraging intelligent plate cropping and asynchronous ForensicQueue for maximum reliability.',
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
