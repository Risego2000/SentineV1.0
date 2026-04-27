/**
 * Sistema de Clasificación de Infracciones - TIER 1 COMPLETO
 * Estructura profesional para denuncias de tráfico (Art. RGC / TRLTSV)
 *
 * Organizadas por:
 * - Categoría operativa (Intersecciones, Maniobras, etc.)
 * - Prioridad de detección
 * - Base legal (Art. RGC / TRLTSV)
 * - Parámetros IA
 * - Evidencia requerida
 */

import { EntityType, SeverityType } from '../types';

export type RuleType =
  | 'line_crossing'              // Cruce de línea simple
  | 'stop_violation'             // STOP - No detención
  | 'yield_violation'            // CEDA - No cede paso
  | 'pedestrian_priority'        // Prioridad peatonal
  | 'red_light_violation'        // Semáforo en rojo
  | 'forbidden_direction'        // Sentido contrario
  | 'forbidden_turn'             // Giro prohibido
  | 'mandatory_direction'        // Dirección obligatoria incumplida
  | 'zone_dwell'                 // Estacionamiento/obstrucción
  | 'roi_entry';                 // Entrada a zona de análisis

export type OperativeCategory =
  | 'INTERSECTIONS'              // 🔴 Intersecciones y Seguridad Vial
  | 'MANEUVERS'                  // 🔁 Maniobras
  | 'DANGEROUS_DRIVING'          // 🚫 Circulación Peligrosa
  | 'PARKING_OBSTRUCTION'        // 🚗 Parada y Obstrucción
  | 'LANE_USAGE';                // 🛣️ Uso de Carriles

export interface AIRuleTrigger {
  trigger: string;               // Condición de activación
  [key: string]: any;            // Parámetros específicos de la regla
}

export interface InfractionSanctions {
  fine_eur: number;              // Multa en euros
  points: number;                // Puntos de carné (negativo = pérdida)
  risk_score: number;            // 1-5 (riesgo)
  priority: 'BAJA' | 'MEDIA' | 'MEDIA-ALTA' | 'ALTA' | 'CRÍTICA';
}

export interface RequiredEvidence {
  before_frame: boolean;         // Fotograma previo
  line_crossing: boolean;        // Cruce de línea
  trajectory: boolean;           // Trayectoria
  timestamp: boolean;            // Marca de tiempo
  location: boolean;             // Ubicación
  pedestrian?: boolean;          // Peatón (si aplica)
  vehicle_state?: string;        // Estado vehículo (speed, stopped, etc.)
}

export interface ROISequence {
  id: string;
  roiIds: string[];
  roiLabels: string[];
  name: string;
}

/**
 * Regla Forense Mejorada con campos operativos completos
 */
export interface ForensicRule {
  // Identificación
  readonly id: string;                      // STOP_NO_DETENCION
  readonly name: string;                    // "STOP — NO DETENCIÓN"
  readonly operativeCode: string;           // ID operativo único

  // Clasificación
  readonly type: RuleType;
  readonly category: OperativeCategory;
  readonly severity: SeverityType;

  // Base legal
  readonly legalBase: string[];             // ["Art. 151 RGC", "Art. 76.j TRLTSV"]
  readonly conduct: string;                 // Descripción de la conducta
  readonly citation: string;                // Texto automático de denuncia

  // Sanciones
  readonly sanctions: InfractionSanctions;

  // Detección IA
  readonly aiRule: AIRuleTrigger;
  readonly requiredEvidence: RequiredEvidence;
  readonly geometryIds: string[];

  // Parámetros técnicos
  readonly sequence?: ROISequence;
  readonly minDwellTime?: number;
  readonly analysisPrompt: string;
  readonly enabled: boolean;
  readonly priority: number;

  // Reglas de exclusión (si esta infracción se detecta, ignorar otras)
  readonly exclusionList?: string[];        // IDs de reglas a ignorar
}

/**
 * 🔴 INTERSECCIONES Y SEGURIDAD VIAL
 */
export const STOP_NO_DETENCION: ForensicRule = {
  id: 'rule_stop_no_detencion',
  operativeCode: 'STOP_NO_DETENCION',
  name: 'STOP — NO DETENCIÓN',
  type: 'stop_violation',
  category: 'INTERSECTIONS',
  severity: 'HIGH',
  legalBase: ['Art. 151 RGC', 'Art. 76.j TRLTSV'],
  conduct: 'No realizar detención completa ante señal STOP.',
  citation: 'No detenerse ante la señal de STOP, rebasando la línea de detención sin efectuar parada total.',
  sanctions: {
    fine_eur: 200,
    points: -4,
    risk_score: 5,
    priority: 'ALTA',
  },
  aiRule: {
    trigger: 'vehicle_crosses_stop_line_without_full_stop',
    min_stop_time_ms: 900,
    max_speed_kmh: 2,
  },
  requiredEvidence: {
    before_frame: true,
    line_crossing: true,
    trajectory: true,
    timestamp: true,
    location: true,
    vehicle_state: 'moving_or_insufficient_stop',
  },
  geometryIds: ['stop_line'],
  analysisPrompt: 'Detectar si el vehículo cruza la línea de STOP sin detención completa (v > 2 km/h o tiempo < 900ms).',
  enabled: true,
  priority: 20,
};

export const CEDA_NO_RESPETADO: ForensicRule = {
  id: 'rule_ceda_no_respetado',
  operativeCode: 'CEDA_NO_RESPETADO',
  name: '⚠️ CEDA EL PASO',
  type: 'yield_violation',
  category: 'INTERSECTIONS',
  severity: 'HIGH',
  legalBase: ['Art. 57 RGC', 'Art. 76 TRLTSV'],
  conduct: 'No ceder prioridad a vehículo o peatón.',
  citation: 'No ceder el paso ante vehículo o peatón en señal de ceda, entrando en zona de conflicto sin respetar prioridad.',
  sanctions: {
    fine_eur: 200,
    points: -4,
    risk_score: 5,
    priority: 'ALTA',
  },
  aiRule: {
    trigger: 'vehicle_enters_conflict_zone_without_yield',
    time_to_collision_s: 3,
  },
  requiredEvidence: {
    before_frame: true,
    line_crossing: true,
    trajectory: true,
    timestamp: true,
    location: true,
  },
  geometryIds: ['yield_1'],
  analysisPrompt: 'Analizar si el vehículo entra en zona de conflicto sin ceder paso (TTC < 3s).',
  enabled: true,
  priority: 19,
};

export const PRIORIDAD_PEATONAL: ForensicRule = {
  id: 'rule_prioridad_peatonal',
  operativeCode: 'PRIORIDAD_PEATONAL',
  name: '🚶 PRIORIDAD PEATONAL',
  type: 'pedestrian_priority',
  category: 'INTERSECTIONS',
  severity: 'HIGH',
  legalBase: ['Art. 146 RGC', 'Art. 24 TRLTSV'],
  conduct: 'No respetar paso de peatones.',
  citation: 'No respetar el paso de peatones, circulando sobre paso de cebra sin ceder preferencia.',
  sanctions: {
    fine_eur: 200,
    points: -6,
    risk_score: 5,
    priority: 'CRÍTICA',
  },
  aiRule: {
    trigger: 'vehicle_fails_to_yield_pedestrian',
    pedestrian_required: true,
    min_distance_m: 3,
  },
  requiredEvidence: {
    before_frame: true,
    line_crossing: true,
    trajectory: true,
    timestamp: true,
    location: true,
    pedestrian: true,
  },
  geometryIds: ['pedestrian'],
  analysisPrompt: 'Detectar fallo en ceder paso a peatones en paso de cebra (requiere peatón presente).',
  enabled: true,
  priority: 22,
};

export const SEMAFORO_ROJO: ForensicRule = {
  id: 'rule_semaforo_rojo',
  operativeCode: 'SEMAFORO_ROJO',
  name: '🚥 SEMÁFORO EN ROJO',
  type: 'red_light_violation',
  category: 'INTERSECTIONS',
  severity: 'HIGH',
  legalBase: ['Art. 150 RGC', 'Art. 76.c TRLTSV'],
  conduct: 'Rebasar semáforo en rojo.',
  citation: 'Rebasar la línea de detención cuando la señal luminosa roja se encontraba activa.',
  sanctions: {
    fine_eur: 200,
    points: -4,
    risk_score: 5,
    priority: 'CRÍTICA',
  },
  aiRule: {
    trigger: 'vehicle_crosses_line_on_red',
    light_state: 'RED',
  },
  requiredEvidence: {
    before_frame: true,
    line_crossing: true,
    trajectory: true,
    timestamp: true,
    location: true,
  },
  geometryIds: ['traffic_red_1'],
  analysisPrompt: 'Detectar cruce de línea en fase roja (luz roja activa).',
  enabled: true,
  priority: 23,
};

/**
 * 🔁 MANIOBRAS
 */
export const GIRO_PROHIBIDO: ForensicRule = {
  id: 'rule_giro_prohibido',
  operativeCode: 'GIRO_PROHIBIDO',
  name: '🔄 GIRO PROHIBIDO',
  type: 'forbidden_turn',
  category: 'MANEUVERS',
  severity: 'HIGH',
  legalBase: ['Art. 36.2 RGC', 'Art. 76.e TRLTSV'],
  conduct: 'Realizar giro no permitido.',
  citation: 'Efectuar giro no autorizado en vía con sentido obligatorio o zona prohibida de giro.',
  sanctions: {
    fine_eur: 200,
    points: -3,
    risk_score: 4,
    priority: 'ALTA',
  },
  aiRule: {
    trigger: 'forbidden_turn_detected',
    roi_required: ['A', 'B'],
  },
  requiredEvidence: {
    before_frame: true,
    trajectory: true,
    timestamp: true,
    location: true,
    line_crossing: false,
  },
  geometryIds: ['giro_prohibido'],
  analysisPrompt: 'Detectar secuencia de ROIs que indica giro prohibido (entrada A → salida B).',
  enabled: true,
  priority: 18,
  exclusionList: ['rule_sentido_contrario'],
};

export const DIRECCION_OBLIGATORIA_INCUMPLIDA: ForensicRule = {
  id: 'rule_direccion_obligatoria',
  operativeCode: 'DIRECCION_OBLIGATORIA_INCUMPLIDA',
  name: '➡️ DIRECCIÓN OBLIGATORIA INCUMPLIDA',
  type: 'mandatory_direction',
  category: 'MANEUVERS',
  severity: 'MEDIUM',
  legalBase: ['Art. 36.1 RGC', 'Señales R-400 a R-406'],
  conduct: 'No seguir dirección obligatoria.',
  citation: 'No respetar la dirección obligatoria señalizada en la vía.',
  sanctions: {
    fine_eur: 200,
    points: 0,
    risk_score: 3,
    priority: 'MEDIA-ALTA',
  },
  aiRule: {
    trigger: 'trajectory_not_matching_allowed_direction',
    allowed: ['RIGHT', 'LEFT', 'STRAIGHT'],
  },
  requiredEvidence: {
    trajectory: true,
    timestamp: true,
    location: true,
    before_frame: false,
    line_crossing: false,
  },
  geometryIds: ['direccion_obligatoria'],
  analysisPrompt: 'Detectar si trayectoria no coincide con dirección obligatoria permitida.',
  enabled: true,
  priority: 15,
  exclusionList: ['rule_sentido_contrario'],
};

/**
 * 🚫 CIRCULACIÓN PELIGROSA
 */
export const SENTIDO_CONTRARIO: ForensicRule = {
  id: 'rule_sentido_contrario',
  operativeCode: 'SENTIDO_CONTRARIO',
  name: '⛔ SENTIDO CONTRARIO',
  type: 'forbidden_direction',
  category: 'DANGEROUS_DRIVING',
  severity: 'CRITICAL',
  legalBase: ['Art. 31 RGC', 'Art. 76.d TRLTSV', 'Art. 380 CP (posible)'],
  conduct: 'Circular en dirección opuesta al sentido de la vía.',
  citation: 'Circular en sentido contrario a la dirección legal de la vía, suponiendo grave riesgo para la seguridad vial.',
  sanctions: {
    fine_eur: 500,
    points: -6,
    risk_score: 5,
    priority: 'CRÍTICA',
  },
  aiRule: {
    trigger: 'vehicle_direction_opposed_to_lane',
    min_distance_m: 8,
    min_frames: 12,
  },
  requiredEvidence: {
    trajectory: true,
    timestamp: true,
    location: true,
    before_frame: true,
    line_crossing: true,
  },
  geometryIds: ['sentido_contrario'],
  analysisPrompt: 'Detectar dirección opuesta a carril (trayectoria > 8m en sentido contrario por > 12 fotogramas).',
  enabled: true,
  priority: 25, // MÁXIMA PRIORIDAD
  exclusionList: ['rule_giro_prohibido', 'rule_direccion_obligatoria', 'rule_linea_continua'],
};

/**
 * 🚗 PARADA Y OBSTRUCCIÓN
 */
export const DOBLE_FILA: ForensicRule = {
  id: 'rule_doble_fila',
  operativeCode: 'DOBLE_FILA',
  name: '🚧 DOBLE FILA',
  type: 'zone_dwell',
  category: 'PARKING_OBSTRUCTION',
  severity: 'MEDIUM',
  legalBase: ['Art. 87.1 RGC', 'Ordenanza Municipal'],
  conduct: 'Estacionar obstaculizando circulación.',
  citation: 'Aparcar en segunda fila, obstaculizando el tráfico en carril activo.',
  sanctions: {
    fine_eur: 200,
    points: 0,
    risk_score: 3,
    priority: 'MEDIA-ALTA',
  },
  aiRule: {
    trigger: 'vehicle_stationary_blocking_lane',
    min_time_s: 45,
  },
  requiredEvidence: {
    location: true,
    timestamp: true,
    vehicle_state: 'stopped',
  },
  geometryIds: ['doble_fila'],
  minDwellTime: 45000,
  analysisPrompt: 'Detectar vehículo detenido en carril activo > 45 segundos.',
  enabled: true,
  priority: 12,
};

export const BLOQUEO_INTERSECCION: ForensicRule = {
  id: 'rule_bloqueo_interseccion',
  operativeCode: 'BLOQUEO_INTERSECCION',
  name: '🚫 BLOQUEO DE INTERSECCIÓN',
  type: 'zone_dwell',
  category: 'PARKING_OBSTRUCTION',
  severity: 'MEDIUM',
  legalBase: ['Art. 142 RGC'],
  conduct: 'Quedar detenido en cruce sin poder salir.',
  citation: 'Permanecer detenido dentro de la intersección, impidiendo el paso de otros vehículos.',
  sanctions: {
    fine_eur: 200,
    points: 0,
    risk_score: 3,
    priority: 'MEDIA',
  },
  aiRule: {
    trigger: 'vehicle_stopped_inside_intersection',
    blocking: true,
  },
  requiredEvidence: {
    location: true,
    timestamp: true,
    vehicle_state: 'stopped',
  },
  geometryIds: ['box_junction'],
  minDwellTime: 5000,
  analysisPrompt: 'Detectar vehículo detenido dentro de intersección.',
  enabled: true,
  priority: 13,
};

/**
 * 🛣️ USO DE CARRILES
 */
export const CARRIL_BUS: ForensicRule = {
  id: 'rule_carril_bus',
  operativeCode: 'CARRIL_BUS',
  name: '🚌 CARRIL BUS / TAXI',
  type: 'zone_dwell',
  category: 'LANE_USAGE',
  severity: 'MEDIUM',
  legalBase: ['Art. 48 RGC', 'Ordenanza Municipal'],
  conduct: 'Circular por carril reservado.',
  citation: 'Circulación por carril reservado a transporte público sin autorización.',
  sanctions: {
    fine_eur: 200,
    points: 0,
    risk_score: 2,
    priority: 'MEDIA',
  },
  aiRule: {
    trigger: 'vehicle_in_bus_lane',
    duration_s: 30,
  },
  requiredEvidence: {
    trajectory: true,
    timestamp: true,
    location: true,
  },
  geometryIds: ['bus_lane'],
  analysisPrompt: 'Detectar vehículo en carril BUS/TAXI durante > 30 segundos.',
  enabled: true,
  priority: 10,
};

export const INVASION_ARCEN: ForensicRule = {
  id: 'rule_invasion_arcen',
  operativeCode: 'INVASION_ARCEN',
  name: '🪵 INVASIÓN DE ARCÉN',
  type: 'zone_dwell',
  category: 'LANE_USAGE',
  severity: 'MEDIUM',
  legalBase: ['Art. 49 RGC'],
  conduct: 'Circular por arcén sin causa.',
  citation: 'Circulación por arcén sin justificación (no emergencia, avería, etc.).',
  sanctions: {
    fine_eur: 200,
    points: 0,
    risk_score: 2,
    priority: 'MEDIA',
  },
  aiRule: {
    trigger: 'vehicle_on_shoulder',
    distance_m: 1.5,
  },
  requiredEvidence: {
    trajectory: true,
    timestamp: true,
    location: true,
  },
  geometryIds: ['shoulder'],
  analysisPrompt: 'Detectar vehículo circulando fuera de carril normal (arcén).',
  enabled: true,
  priority: 9,
};

export const LINEA_CONTINUA: ForensicRule = {
  id: 'rule_linea_continua',
  operativeCode: 'LINEA_CONTINUA',
  name: '➖ LÍNEA CONTINUA',
  type: 'line_crossing',
  category: 'LANE_USAGE',
  severity: 'MEDIUM',
  legalBase: ['Art. 43 RGC', 'Art. 76.h TRLTSV'],
  conduct: 'Rebasar línea continua.',
  citation: 'Cruzar línea continua sin causa justificada (adelantamiento prohibido).',
  sanctions: {
    fine_eur: 200,
    points: -4,
    risk_score: 3,
    priority: 'MEDIA-ALTA',
  },
  aiRule: {
    trigger: 'vehicle_crosses_solid_line',
    line_type: 'CONTINUOUS',
  },
  requiredEvidence: {
    trajectory: true,
    timestamp: true,
    location: true,
    line_crossing: true,
  },
  geometryIds: ['lane_divider'],
  analysisPrompt: 'Detectar cruce de línea continua.',
  enabled: true,
  priority: 11,
  exclusionList: ['rule_sentido_contrario'],
};

/**
 * Array maestro de todas las reglas
 */
export const FORENSIC_RULES: ForensicRule[] = [
  // INTERSECCIONES (prioridad alta)
  STOP_NO_DETENCION,
  CEDA_NO_RESPETADO,
  PRIORIDAD_PEATONAL,
  SEMAFORO_ROJO,

  // MANIOBRAS
  GIRO_PROHIBIDO,
  DIRECCION_OBLIGATORIA_INCUMPLIDA,

  // CIRCULACIÓN PELIGROSA (MÁXIMA PRIORIDAD)
  SENTIDO_CONTRARIO,

  // PARADA Y OBSTRUCCIÓN
  DOBLE_FILA,
  BLOQUEO_INTERSECCION,

  // USO DE CARRILES
  CARRIL_BUS,
  INVASION_ARCEN,
  LINEA_CONTINUA,
];

/**
 * Funciones utilitarias
 */
export function getRuleById(id: string): ForensicRule | undefined {
  return FORENSIC_RULES.find((r) => r.id === id);
}

export function getRulesByCategory(category: OperativeCategory): ForensicRule[] {
  return FORENSIC_RULES.filter((r) => r.category === category && r.enabled);
}

export function getRulesByPriority(priority: ForensicRule['sanctions']['priority']): ForensicRule[] {
  return FORENSIC_RULES.filter((r) => r.sanctions.priority === priority && r.enabled);
}

/**
 * Orden de prioridad de detección (CRITICAL FIRST)
 */
export const DETECTION_PRIORITY_ORDER: string[] = [
  'rule_sentido_contrario',           // MÁXIMA: 25
  'rule_prioridad_peatonal',          // 22
  'rule_semaforo_rojo',               // 23
  'rule_stop_no_detencion',           // 20
  'rule_ceda_no_respetado',           // 19
  'rule_giro_prohibido',              // 18
  'rule_direccion_obligatoria',       // 15
  'rule_bloqueo_interseccion',        // 13
  'rule_doble_fila',                  // 12
  'rule_linea_continua',              // 11
  'rule_carril_bus',                  // 10
  'rule_invasion_arcen',              // 9
];

/**
 * Reglas de exclusión mutua
 * Si se detecta X, ignorar Y
 */
export const EXCLUSION_RULES: Record<string, string[]> = {
  'rule_sentido_contrario': [
    'rule_direccion_obligatoria',
    'rule_giro_prohibido',
    'rule_linea_continua',
  ],
  'rule_giro_prohibido': [
    'rule_sentido_contrario',
  ],
  'rule_direccion_obligatoria': [
    'rule_sentido_contrario',
  ],
};

/**
 * Aplicar reglas de exclusión a un conjunto de infracciones detectadas
 */
export function applyExclusionRules(detectedRuleIds: string[]): string[] {
  const filtered = new Set(detectedRuleIds);

  for (const ruleId of detectedRuleIds) {
    const exclusions = EXCLUSION_RULES[ruleId];
    if (exclusions) {
      exclusions.forEach((excluded) => filtered.delete(excluded));
    }
  }

  return Array.from(filtered);
}

export function buildForbiddenTurnAudit(
  track: any,
  line: any
): {
  infraction: boolean;
  ruleCategory: string;
  description: string;
  severity: string;
  plate: string;
} {
  const roiLabels = line.roiSequenceLabels || [];
  const description = `Giro prohibido en secuencia: ${roiLabels.join(' → ') || 'desconocida'}`;

  return {
    infraction: true,
    ruleCategory: line.label || 'GIRO_PROHIBIDO',
    description,
    severity: 'HIGH',
    plate: 'DESCONOCIDO',
  };
}

export function matchesOrderedRoiSequence(actual: string[], expected: string[]): boolean {
  if (expected.length === 0) return false;
  if (actual.length === 0) return false;

  let expectedIdx = 0;
  for (const item of actual) {
    if (item === expected[expectedIdx]) {
      expectedIdx++;
      if (expectedIdx === expected.length) return true;
    }
  }
  return false;
}

export function getRulesForGeometry(geometryId: string): ForensicRule[] {
  return FORENSIC_RULES.filter((rule) => rule.geometryIds.includes(geometryId));
}

export function findForbiddenTurnRule(sequence: ROISequence): ForensicRule | undefined {
  return FORENSIC_RULES.find(
    (rule) =>
      rule.type === 'forbidden_turn' &&
      rule.sequence &&
      JSON.stringify(rule.sequence) === JSON.stringify(sequence)
  );
}

export function createForbiddenTurnRule(name: string, sequence: ROISequence): ForensicRule {
  const id = `rule_forbidden_turn_${name.toLowerCase().replace(/\s+/g, '-')}`;
  return {
    id,
    operativeCode: 'FORBIDDEN_TURN',
    name: `🔴 GIRO PROHIBIDO - ${name.toUpperCase()}`,
    type: 'forbidden_turn',
    category: 'TRAFFIC_VIOLATION',
    severity: 'HIGH',
    legalBase: ['Art. 61 RGC'],
    conduct: 'Realizar giro prohibido',
    citation: `Giro prohibido en ${name}`,
    sanctions: {
      priority: 13,
      points: 3,
      baseAmount: 100,
      maxAmount: 500,
      increments: 50,
    },
    aiRule: {
      type: 'sequence_match',
      confidence: 0.85,
      roiSequence: sequence,
    },
    requiredEvidence: {
      videoFrames: 3,
      minDuration: 500,
    },
    geometryIds: [],
    sequence,
    analysisPrompt: `Detectar si el vehículo realizó un giro prohibido siguiendo la secuencia de ROIs: ${JSON.stringify(sequence)}`,
    enabled: true,
    priority: 13,
  };
}
