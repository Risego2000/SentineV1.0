import { AuditResponse, GeometryLine, Track } from '../types';

export const matchesOrderedRoiSequence = (
  history: string[] = [],
  expectedSequence: string[] = []
): boolean => {
  if (expectedSequence.length < 2 || history.length < expectedSequence.length) {
    return false;
  }

  let expectedIndex = 0;

  for (const roiId of history) {
    if (roiId === expectedSequence[expectedIndex]) {
      expectedIndex += 1;
      if (expectedIndex === expectedSequence.length) {
        return true;
      }
    }
  }

  return false;
};

export const buildForbiddenTurnAudit = (
  track: Track,
  line: GeometryLine,
  baseAudit?: Partial<AuditResponse>
): AuditResponse => {
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
      `Giro prohibido confirmado por secuencia ordenada de zonas ${sequenceText}. El mismo vehículo accedió primero a ${sequenceLabels[0]} y después a ${sequenceLabels[sequenceLabels.length - 1]}.`,
    severity: baseAudit?.severity || 'HIGH',
    ruleCategory: 'GIRO_PROHIBIDO',
    legalBase: baseAudit?.legalBase || 'Giro prohibido detectado por secuencia ROI configurada.',
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
};
