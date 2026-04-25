/**
 * Formal Forensic Rule System
 * Rules are explicit, declarative configurations - not heuristics based on labels.
 */

import { EntityType, SeverityType } from '../types';

export type RuleType =
  | 'line_crossing' // Simple line intersection
  | 'stop_violation' // Line crossing without proper stop
  | 'forbidden_direction' // Wrong way / reverse
  | 'forbidden_turn' // Sequential ROI A -> B
  | 'zone_dwell' // Vehicle in zone > threshold
  | 'roi_entry'; // Any vehicle entering ROI (general audit)

export interface ROISequence {
  /** Unique sequence ID */
  id: string;
  /** Ordered list of ROI IDs that must be visited */
  roiIds: string[];
  /** Human-readable labels for display */
  roiLabels: string[];
  /** Human-readable name of this turn sequence */
  name: string;
}

export interface ForensicRule {
  /** Globally unique rule identifier */
  readonly id: string;
  /** Human-readable name */
  readonly name: string;
  /** Rule classification */
  readonly type: RuleType;
  /** Severity if infraction confirmed */
  readonly severity: SeverityType;
  /** Legal reference / article */
  readonly legalBase?: string;
  /** Which geometry lines this rule monitors */
  readonly geometryIds: string[];
  /** For sequential rules: ordered ROI sequence */
  readonly sequence?: ROISequence;
  /** Minimum dwell time for dwell-based rules (ms) */
  readonly minDwellTime?: number;
  /** Context description passed to AI auditor */
  readonly analysisPrompt: string;
  /** Rule is active */
  readonly enabled: boolean;
  /** Priority (higher = processed first) */
  readonly priority: number;
}

/**
 * System rule presets for common traffic violations.
 */
export const FORENSIC_RULES: ForensicRule[] = [
  // LINE CROSSING RULES
  {
    id: 'rule_stop_line',
    name: 'Stop Line Violation',
    type: 'stop_violation',
    severity: 'MEDIUM',
    legalBase: 'Art. 151 RGC',
    geometryIds: ['stop_line'],
    analysisPrompt: 'Analyze if the vehicle failed to come to a complete stop at the stop line.',
    enabled: true,
    priority: 10,
  },
  {
    id: 'rule_pedestrian_crossing',
    name: 'Pedestrian Priority Violation',
    type: 'line_crossing',
    severity: 'HIGH',
    legalBase: 'Art. 146 RGC - Prioridad Peatonal',
    geometryIds: ['pedestrian'],
    analysisPrompt: 'Analyze if the vehicle failed to yield to pedestrians at the crossing.',
    enabled: true,
    priority: 15,
  },
  {
    id: 'rule_forbidden_lane',
    name: 'Forbidden Lane Invasion',
    type: 'forbidden_direction',
    severity: 'HIGH',
    legalBase: 'Art. 144 RGC',
    geometryIds: ['forbidden'],
    analysisPrompt:
      'Analyze if the vehicle traveled in a forbidden direction or invaded restricted lane.',
    enabled: true,
    priority: 12,
  },
  {
    id: 'rule_solid_line',
    name: 'Solid Line Violation',
    type: 'line_crossing',
    severity: 'MEDIUM',
    legalBase: 'Art. 143 RGC - Línea Continua',
    geometryIds: ['lane_divider'],
    analysisPrompt: 'Analyze if the vehicle crossed a solid line improperly.',
    enabled: true,
    priority: 8,
  },
  {
    id: 'rule_bus_lane',
    name: 'Bus Lane Violation',
    type: 'forbidden_direction',
    severity: 'LOW',
    legalBase: 'Ordenanza Municipal',
    geometryIds: ['bus_lane'],
    analysisPrompt: 'Analyze if an unauthorized vehicle used the bus lane.',
    enabled: true,
    priority: 5,
  },

  // ZONE-BASED RULES
  {
    id: 'rule_box_junction',
    name: 'Box Junction Blocking',
    type: 'zone_dwell',
    severity: 'MEDIUM',
    legalBase: 'Art. 142 RGC - Bloqueo de Intersección',
    geometryIds: ['box_junction'],
    minDwellTime: 5000,
    analysisPrompt:
      'Analyze if the vehicle blocked the box junction for more than the allowed time.',
    enabled: true,
    priority: 14,
  },
  {
    id: 'rule_double_parking',
    name: 'Double Parking Violation',
    type: 'zone_dwell',
    severity: 'LOW',
    legalBase: 'Art. 107 OVM',
    geometryIds: ['double_row'],
    minDwellTime: 30000,
    analysisPrompt: 'Analyze if the vehicle was double-parked, obstructing traffic flow.',
    enabled: true,
    priority: 3,
  },
  {
    id: 'rule_parking_prohibited',
    name: 'Prohibited Parking',
    type: 'zone_dwell',
    severity: 'LOW',
    legalBase: 'Art. 108 OVM',
    geometryIds: ['prohibited_parking'],
    minDwellTime: 30000,
    analysisPrompt: 'Analyze if the vehicle parked in a prohibited zone.',
    enabled: true,
    priority: 2,
  },

  // ROI-BASED RULES
  {
    id: 'rule_roi_general',
    name: 'General ROI Audit',
    type: 'roi_entry',
    severity: 'MEDIUM',
    geometryIds: ['roi_general'],
    analysisPrompt: 'Perform general forensic audit of vehicle in analysis zone.',
    enabled: true,
    priority: 1,
  },
];

/**
 * Finds a rule by ID.
 */
export function getRuleById(id: string): ForensicRule | undefined {
  return FORENSIC_RULES.find((r) => r.id === id);
}

/**
 * Finds rules that monitor a specific geometry ID.
 */
export function getRulesForGeometry(geometryId: string): ForensicRule[] {
  return FORENSIC_RULES.filter((r) => r.enabled && r.geometryIds.includes(geometryId));
}

/**
 * Finds a forbidden turn rule matching a given sequence.
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
 * Checks if a track's ROI history matches an expected sequence.
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
 * Creates a new forbidden turn rule dynamically.
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
    analysisPrompt: `Analyze if the vehicle followed the forbidden turn sequence: ${sequence.roiLabels.join(' -> ')}.`,
    enabled: true,
    priority: 13,
  };
}

/**
 * Builds a deterministic forbidden-turn audit response.
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
