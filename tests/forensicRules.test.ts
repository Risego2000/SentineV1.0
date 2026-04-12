import { describe, expect, it } from 'vitest';
import { buildForbiddenTurnAudit, matchesOrderedRoiSequence } from '../services/forensicRules';
import { GeometryLine, Track } from '../types';

describe('forensicRules', () => {
  it('detects an ordered ROI sequence for forbidden turns', () => {
    expect(matchesOrderedRoiSequence(['roi-a', 'noise', 'roi-b'], ['roi-a', 'roi-b'])).toBe(true);
    expect(matchesOrderedRoiSequence(['roi-b', 'roi-a'], ['roi-a', 'roi-b'])).toBe(false);
  });

  it('builds a deterministic forbidden-turn audit payload', () => {
    const line: GeometryLine = {
      id: 'roi-b',
      x1: 0.2,
      y1: 0.2,
      x2: 0.4,
      y2: 0.4,
      label: 'GIRO_PROHIBIDO_ROI_A_A_ROI_B',
      type: 'roi_turn',
      violationKind: 'forbidden_turn_sequence',
      roiSequenceIds: ['roi-a', 'roi-b'],
      roiSequenceLabels: ['ROI A', 'ROI B'],
    };
    const track = {
      id: 12,
      avgVelocity: 18.5,
      roiHistory: ['roi-a', 'roi-b'],
    } as Track;

    const audit = buildForbiddenTurnAudit(track, line);

    expect(audit.infraction).toBe(true);
    expect(audit.ruleCategory).toBe('GIRO_PROHIBIDO');
    expect(audit.description).toContain('ROI A -> ROI B');
  });
});
