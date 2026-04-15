/**
 * Sistema Formal de Reglas Forenses
 * Las reglas son configuraciones explícitas y declarativas - no heurísticas basadas en etiquetas.
 */

import { EntityType, SeverityType } from './index';

export type RuleType =
  | 'line_crossing' // Intersección simple de línea
  | 'stop_violation' // Cruce de línea sin parada adecuada
  | 'forbidden_direction' // Sentido prohibido / marcha atrás
  | 'forbidden_turn' // Secuencia ROI A -> B
  | 'zone_dwell' // Vehículo en zona > umbral
  | 'roi_entry'; // Cualquier vehículo entrando a ROI (auditoría general)

export interface ROISequence {
  /** ID único de la secuencia */
  id: string;
  /** Lista ordenada de IDs de ROI que deben ser visitados */
  roiIds: string[];
  /** Etiquetas legibles para mostrar */
  roiLabels: string[];
  /** Nombre legible de esta secuencia de giro */
  name: string;
}

export interface ForensicRule {
  /** Identificador único global de la regla */
  readonly id: string;
  /** Nombre legible */
  readonly name: string;
  /** Clasificación de la regla */
  readonly type: RuleType;
  /** Severidad si se confirma la infracción */
  readonly severity: SeverityType;
  /** Referencia legal / artículo */
  readonly legalBase?: string;
  /** Líneas de geometría que esta regla monitorea */
  readonly geometryIds: string[];
  /** Para reglas secuenciales: secuencia ordenada de ROI */
  readonly sequence?: ROISequence;
  /** Tiempo mínimo de permanencia para reglas de zona (ms) */
  readonly minDwellTime?: number;
  /** Descripción del contexto pasada al auditor de IA */
  readonly analysisPrompt: string;
  /** Regla activa */
  readonly enabled: boolean;
  /** Prioridad (mayor = procesada primero) */
  readonly priority: number;
}

/**
 * Presets de reglas del sistema para infracciones comunes de tráfico.
 */
export const FORENSIC_RULES: ForensicRule[] = [
  // REGLAS DE CRUCE DE LÍNEA
  {
    id: 'rule_stop_line',
    name: 'Infracción de Línea de Parada',
    type: 'stop_violation',
    severity: 'MEDIUM',
    legalBase: 'Art. 151 RGC',
    geometryIds: ['stop_line'],
    analysisPrompt: 'Analizar si el vehículo no realizó la parada completa en la línea de stop.',
    enabled: true,
    priority: 10,
  },
  {
    id: 'rule_pedestrian_crossing',
    name: 'Infracción de Prioridad Peatonal',
    type: 'line_crossing',
    severity: 'HIGH',
    legalBase: 'Art. 146 RGC - Prioridad Peatonal',
    geometryIds: ['pedestrian'],
    analysisPrompt: 'Analizar si el vehículo no cedió el paso a peatones en el cruce.',
    enabled: true,
    priority: 15,
  },
  {
    id: 'rule_forbidden_lane',
    name: 'Invasión de Carril Prohibido',
    type: 'forbidden_direction',
    severity: 'HIGH',
    legalBase: 'Art. 144 RGC',
    geometryIds: ['forbidden'],
    analysisPrompt:
      'Analizar si el vehículo circuló en sentido prohibido o invadió carril restringido.',
    enabled: true,
    priority: 12,
  },
  {
    id: 'rule_solid_line',
    name: 'Infracción de Línea Continua',
    type: 'line_crossing',
    severity: 'MEDIUM',
    legalBase: 'Art. 143 RGC - Línea Continua',
    geometryIds: ['lane_divider'],
    analysisPrompt: 'Analizar si el vehículo cruzó una línea continua de forma indebida.',
    enabled: true,
    priority: 8,
  },
  {
    id: 'rule_bus_lane',
    name: 'Infracción de Carril Bus',
    type: 'forbidden_direction',
    severity: 'LOW',
    legalBase: 'Ordenanza Municipal',
    geometryIds: ['bus_lane'],
    analysisPrompt: 'Analizar si un vehículo no autorizado utilizó el carril bus.',
    enabled: true,
    priority: 5,
  },

  // REGLAS BASADAS EN ZONAS
  {
    id: 'rule_box_junction',
    name: 'Bloqueo de Intersección',
    type: 'zone_dwell',
    severity: 'MEDIUM',
    legalBase: 'Art. 142 RGC - Bloqueo de Intersección',
    geometryIds: ['box_junction'],
    minDwellTime: 5000,
    analysisPrompt: 'Analizar si el vehículo bloqueó la intersección por más del tiempo permitido.',
    enabled: true,
    priority: 14,
  },
  {
    id: 'rule_double_parking',
    name: 'Estacionamiento Doble',
    type: 'zone_dwell',
    severity: 'LOW',
    legalBase: 'Art. 107 OVM',
    geometryIds: ['double_row'],
    minDwellTime: 30000,
    analysisPrompt:
      'Analizar si el vehículo estaba estacionado en doble fila, obstaculizando el tráfico.',
    enabled: true,
    priority: 3,
  },
  {
    id: 'rule_parking_prohibited',
    name: 'Estacionamiento Prohibido',
    type: 'zone_dwell',
    severity: 'LOW',
    legalBase: 'Art. 108 OVM',
    geometryIds: ['prohibited_parking'],
    minDwellTime: 30000,
    analysisPrompt: 'Analizar si el vehículo se estacionó en una zona prohibida.',
    enabled: true,
    priority: 2,
  },

  // REGLAS BASADAS EN ROI
  {
    id: 'rule_roi_general',
    name: 'Auditoría General de ROI',
    type: 'roi_entry',
    severity: 'MEDIUM',
    geometryIds: ['roi_general'],
    analysisPrompt: 'Realizar auditoría forense general del vehículo en la zona de análisis.',
    enabled: true,
    priority: 1,
  },
];

/**
 * Busca una regla por ID.
 */
export function getRuleById(id: string): ForensicRule | undefined {
  return FORENSIC_RULES.find((r) => r.id === id);
}

/**
 * Busca reglas que monitorean un ID de geometría específico.
 */
export function getRulesForGeometry(geometryId: string): ForensicRule[] {
  return FORENSIC_RULES.filter((r) => r.enabled && r.geometryIds.includes(geometryId));
}

/**
 * Busca una regla de giro prohibido que coincida con una secuencia dada.
 */
export function findForbiddenTurnRule(
  roiSequence: string[],
  allRules: ForensicRule[] = FORENSIC_RULES
): ForensicRule | undefined {
  return allRules.find((r) => {
    if (r.type !== 'forbidden_turn' || !r.sequence) return false;
    if (r.sequence.roiIds.length !== roiSequence.length) return false;
    return r.sequence.roiIds.every((id, i) => id === roiSequence[i]);
  });
}

/**
 * Verifica si el historial de ROI de un track coincide con una secuencia esperada.
 */
export function matchesOrderedRoiSequence(history: string[], expectedSequence: string[]): boolean {
  if (expectedSequence.length < 2 || history.length < expectedSequence.length) {
    return false;
  }

  let expectedIndex = 0;
  for (const roiId of history) {
    if (roiId === expectedSequence[expectedIndex]) {
      expectedIndex++;
      if (expectedIndex === expectedSequence.length) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Crea una nueva regla de giro prohibido dinámicamente.
 */
export function createForbiddenTurnRule(
  name: string,
  sequence: ROISequence,
  legalBase?: string
): ForensicRule {
  return {
    id: `rule_forbidden_turn_${sequence.id}`,
    name,
    type: 'forbidden_turn',
    severity: 'HIGH',
    legalBase: legalBase || `Giro prohibido: ${sequence.name}`,
    geometryIds: sequence.roiIds,
    sequence,
    analysisPrompt: `Analizar si el vehículo siguió la secuencia de giro prohibido: ${sequence.roiLabels.join(' -> ')}.`,
    enabled: true,
    priority: 13,
  };
}

/**
 * Construye una respuesta de auditoría determinista para giro prohibido.
 */
export function buildForbiddenTurnAudit(
  track: { id: number; avgVelocity: number; roiHistory: string[] },
  line: { roiSequenceLabels?: string[]; roiSequenceIds?: string[] },
  baseAudit?: Partial<{
    infraction: boolean;
    plate: string;
    makeModel: string;
    color: string;
    description: string;
    severity: string;
    legalBase: string;
    reasoning: string[];
    visualTimestamp: string;
    videoTimeCode: string;
    localTime: string;
    telemetry: { speedEstimated: string; behaviorAnomalies?: string };
  }>
): {
  infraction: boolean;
  plate: string;
  makeModel: string;
  color: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  ruleCategory: string;
  legalBase: string;
  reasoning: string[];
  visualTimestamp: string;
  videoTimeCode: string;
  localTime: string;
  telemetry: { speedEstimated: string; behaviorAnomalies?: string };
} {
  const sequenceLabels =
    line.roiSequenceLabels && line.roiSequenceLabels.length >= 2
      ? line.roiSequenceLabels
      : ['ROI A', 'ROI B'];
  const sequenceText = sequenceLabels.join(' -> ');

  return {
    infraction: true,
    plate: baseAudit?.plate || 'DESCONOCIDO',
    makeModel: baseAudit?.makeModel || 'DESCONOCIDO',
    color: baseAudit?.color || 'DESCONOCIDO',
    description:
      baseAudit?.description ||
      `Giro prohibido confirmado por secuencia ordenada de zonas ${sequenceText}.`,
    severity: (baseAudit?.severity === 'HIGH' || baseAudit?.severity === 'CRITICAL'
      ? baseAudit?.severity
      : 'HIGH') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    ruleCategory: 'GIRO_PROHIBIDO',
    legalBase: baseAudit?.legalBase || 'Giro prohibido detectado por secuencia ROI.',
    reasoning:
      baseAudit?.reasoning && baseAudit.reasoning.length > 0
        ? baseAudit.reasoning
        : [
            `Secuencia ROI validada: ${sequenceText}.`,
            `Track #${track.id} mantuvo identidad persistente durante la maniobra.`,
            'La regla configurada establece que esta secuencia equivale a giro prohibido.',
          ],
    visualTimestamp: baseAudit?.visualTimestamp || new Date().toLocaleTimeString(),
    videoTimeCode: baseAudit?.videoTimeCode || '',
    localTime: baseAudit?.localTime || '',
    telemetry: {
      speedEstimated:
        baseAudit?.telemetry?.speedEstimated || `${track.avgVelocity.toFixed(1)} km/h`,
      behaviorAnomalies:
        baseAudit?.telemetry?.behaviorAnomalies || `Secuencia ROI: ${sequenceText}`,
    },
  };
}
