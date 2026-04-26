/**
 * Servicio de Exclusiones de Infracciones
 * Gestiona las reglas de exclusión mutua entre infracciones
 *
 * LÓGICA CRÍTICA:
 * Si SENTIDO_CONTRARIO se detecta → ignorar:
 *   - giro_prohibido
 *   - direccion_obligatoria
 *   - linea_continua
 *
 * El sentido contrario es una infracción ESTRUCTURAL que invalida
 * la interpretación de maniobras menores.
 */

import {
  FORENSIC_RULES,
  EXCLUSION_RULES,
  DETECTION_PRIORITY_ORDER,
  applyExclusionRules,
} from '../types/forensicRules';

export interface DetectedInfraction {
  ruleId: string;
  ruleName: string;
  operativeCode: string;
  severity: string;
  confidence: number;
  timestamp: number;
}

export interface FilteredInfractionResult {
  original: DetectedInfraction[];
  filtered: DetectedInfraction[];
  excluded: { ruleId: string; reason: string }[];
}

/**
 * Servicio de gestión de exclusiones de infracciones
 */
export class InfractionExclusionService {
  /**
   * Aplica reglas de exclusión a un conjunto de infracciones detectadas
   * @param detections Array de infracciones detectadas
   * @returns Infracciones filtradas sin conflictos
   */
  static applyExclusions(detections: DetectedInfraction[]): FilteredInfractionResult {
    const ruleIds = detections.map((d) => d.ruleId);
    const filtered = applyExclusionRules(ruleIds);

    const excluded = ruleIds
      .filter((id) => !filtered.includes(id))
      .map((ruleId) => ({
        ruleId,
        reason: this.getExclusionReason(ruleId, filtered),
      }));

    const filteredDetections = detections.filter((d) => filtered.includes(d.ruleId));

    return {
      original: detections,
      filtered: filteredDetections,
      excluded,
    };
  }

  /**
   * Obtiene el motivo por el que una infracción fue excluida
   */
  private static getExclusionReason(excludedRuleId: string, filteredRules: string[]): string {
    // Buscar qué regla causó la exclusión
    for (const ruleId of filteredRules) {
      const exclusionList = EXCLUSION_RULES[ruleId];
      if (exclusionList && exclusionList.includes(excludedRuleId)) {
        const rule = FORENSIC_RULES.find((r) => r.id === ruleId);
        const excludedRule = FORENSIC_RULES.find((r) => r.id === excludedRuleId);

        if (ruleId === 'rule_sentido_contrario') {
          return `Excluida por infracción estructural: SENTIDO_CONTRARIO (500€/-6pts) invalida ${excludedRule?.name}`;
        }

        return `Excluida por: ${rule?.name}`;
      }
    }

    return 'Motivo de exclusión desconocido';
  }

  /**
   * Ordena infracciones por prioridad de detección
   */
  static sortByPriority(detections: DetectedInfraction[]): DetectedInfraction[] {
    return detections.sort((a, b) => {
      const aPriority = DETECTION_PRIORITY_ORDER.indexOf(a.ruleId);
      const bPriority = DETECTION_PRIORITY_ORDER.indexOf(b.ruleId);

      // Si está en la lista de prioridad, usar ese índice; si no, al final
      const aIndex = aPriority === -1 ? 999 : aPriority;
      const bIndex = bPriority === -1 ? 999 : bPriority;

      return aIndex - bIndex;
    });
  }

  /**
   * Obtiene el nivel de criticidad de una infracción
   */
  static getCriticalityLevel(ruleId: string): 'CRÍTICA' | 'ALTA' | 'MEDIA-ALTA' | 'MEDIA' | 'BAJA' {
    const rule = FORENSIC_RULES.find((r) => r.id === ruleId);
    return rule?.sanctions.priority || 'MEDIA';
  }

  /**
   * Filtra infracciones por nivel de criticidad
   */
  static filterByCriticalityLevel(
    detections: DetectedInfraction[],
    minLevel: 'CRÍTICA' | 'ALTA' | 'MEDIA-ALTA' | 'MEDIA' | 'BAJA'
  ): DetectedInfraction[] {
    const levels = ['CRÍTICA', 'ALTA', 'MEDIA-ALTA', 'MEDIA', 'BAJA'];
    const minIndex = levels.indexOf(minLevel);

    return detections.filter((d) => {
      const level = this.getCriticalityLevel(d.ruleId);
      const currentIndex = levels.indexOf(level);
      return currentIndex <= minIndex;
    });
  }

  /**
   * Genera reporte de exclusiones
   */
  static generateExclusionReport(result: FilteredInfractionResult): string {
    const lines: string[] = [
      '═══════════════════════════════════════════════════',
      '📋 REPORTE DE EXCLUSIONES DE INFRACCIONES',
      '═══════════════════════════════════════════════════',
      '',
      `✅ DETECTADAS ORIGINALES: ${result.original.length}`,
      `✅ DESPUÉS DE FILTRADO: ${result.filtered.length}`,
      `❌ EXCLUIDAS POR CONFLICTO: ${result.excluded.length}`,
      '',
    ];

    if (result.filtered.length > 0) {
      lines.push('INFRACCIONES VÁLIDAS (RESULTADO FINAL):');
      lines.push('───────────────────────────────────────');
      result.filtered.forEach((infraction, idx) => {
        const rule = FORENSIC_RULES.find((r) => r.id === infraction.ruleId);
        lines.push(
          `${idx + 1}. ${rule?.name} | ${infraction.operativeCode} | ${infraction.severity} | ${(infraction.confidence * 100).toFixed(1)}%`
        );
      });
      lines.push('');
    }

    if (result.excluded.length > 0) {
      lines.push('INFRACCIONES EXCLUIDAS (NO PROCESADAS):');
      lines.push('───────────────────────────────────────');
      result.excluded.forEach((exclusion, idx) => {
        lines.push(`${idx + 1}. ${exclusion.ruleId}`);
        lines.push(`   └─ ${exclusion.reason}`);
      });
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════');

    return lines.join('\n');
  }

  /**
   * Valida integridad de reglas de exclusión
   */
  static validateExclusionRules(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Verificar que SENTIDO_CONTRARIO es la prioridad máxima
    const sentidoRule = FORENSIC_RULES.find((r) => r.id === 'rule_sentido_contrario');
    const maxPriority = Math.max(...FORENSIC_RULES.map((r) => r.priority));

    if (sentidoRule && sentidoRule.priority !== maxPriority) {
      issues.push(
        `⚠️ SENTIDO_CONTRARIO debe tener prioridad máxima (${maxPriority}), pero tiene ${sentidoRule.priority}`
      );
    }

    // Verificar bidireccionalidad de exclusiones
    for (const [ruleId, exclusions] of Object.entries(EXCLUSION_RULES)) {
      for (const excluded of exclusions) {
        const reverseExclusions = EXCLUSION_RULES[excluded];
        if (reverseExclusions && !reverseExclusions.includes(ruleId)) {
          issues.push(
            `⚠️ Exclusión no bidireccional: ${ruleId} → ${excluded}, pero no ${excluded} → ${ruleId}`
          );
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
