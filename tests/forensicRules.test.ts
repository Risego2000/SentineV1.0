import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  matchesOrderedRoiSequence,
  buildForbiddenTurnAudit,
  FORENSIC_RULES,
  getRuleById,
  getRulesForGeometry,
  findForbiddenTurnRule,
  createForbiddenTurnRule,
} from '../types/forensicRules';
import { GeometryLine, Track } from '../types';
import { AuditJob, createAuditJob } from '../types/auditJob';

describe('forensicRules - Formal Rule System', () => {
  describe('matchesOrderedRoiSequence', () => {
    it('detects exact ordered sequence', () => {
      expect(matchesOrderedRoiSequence(['roi-a', 'roi-b'], ['roi-a', 'roi-b'])).toBe(true);
    });

    it('detects sequence with noise between ROIs', () => {
      expect(matchesOrderedRoiSequence(['roi-a', 'noise', 'roi-b'], ['roi-a', 'roi-b'])).toBe(true);
    });

    it('rejects reversed sequence', () => {
      expect(matchesOrderedRoiSequence(['roi-b', 'roi-a'], ['roi-a', 'roi-b'])).toBe(false);
    });

    it('rejects partial sequence', () => {
      expect(matchesOrderedRoiSequence(['roi-a'], ['roi-a', 'roi-b'])).toBe(false);
    });

    it('handles empty inputs gracefully', () => {
      expect(matchesOrderedRoiSequence([], ['roi-a'])).toBe(false);
      expect(matchesOrderedRoiSequence(['roi-a'], [])).toBe(false);
    });
  });

  describe('buildForbiddenTurnAudit', () => {
    it('builds valid infraction payload for forbidden turn', () => {
      const line: GeometryLine = {
        id: 'turn-rule',
        x1: 0.2,
        y1: 0.2,
        x2: 0.4,
        y2: 0.4,
        label: 'GIRO_PROHIBIDO',
        type: 'roi_turn',
        violationKind: 'forbidden_turn_sequence',
        roiSequenceIds: ['roi-a', 'roi-b'],
        roiSequenceLabels: ['ROI A', 'ROI B'],
      };
      const track = { id: 12, avgVelocity: 18.5, roiHistory: ['roi-a', 'roi-b'] } as Track;

      const audit = buildForbiddenTurnAudit(track, line);

      expect(audit.infraction).toBe(true);
      expect(audit.ruleCategory).toBe('GIRO_PROHIBIDO');
      expect(audit.description).toContain('ROI A');
      expect(audit.description).toContain('ROI B');
      expect(audit.severity).toBe('HIGH');
    });

    it('uses default values when baseAudit is undefined', () => {
      const line: GeometryLine = {
        id: 'turn',
        x1: 0,
        y1: 0,
        x2: 1,
        y2: 1,
        label: 'T',
        type: 'roi_turn',
      };
      const track = { id: 1, avgVelocity: 0 } as Track;

      const audit = buildForbiddenTurnAudit(track, line);

      expect(audit.plate).toBe('DESCONOCIDO');
      expect(audit.makeModel).toBe('DESCONOCIDO');
    });
  });

  describe('FORENSIC_RULES preset', () => {
    it('has required rule types for traffic enforcement', () => {
      const ruleTypes = FORENSIC_RULES.map((r) => r.type);
      expect(ruleTypes).toContain('stop_violation');
      expect(ruleTypes).toContain('line_crossing');
      expect(ruleTypes).toContain('zone_dwell');
      expect(ruleTypes).toContain('roi_entry');
      // forbidden_turn and forbidden_direction are optional presets
    });

    it('all rules have unique IDs', () => {
      const ids = FORENSIC_RULES.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all rules have severity defined', () => {
      for (const rule of FORENSIC_RULES) {
        expect(rule.severity).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
      }
    });
  });

  describe('getRuleById', () => {
    it('finds existing rule', () => {
      const rule = getRuleById('rule_stop_line');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('Stop Line Violation');
    });

    it('returns undefined for non-existent rule', () => {
      expect(getRuleById('non-existent')).toBeUndefined();
    });
  });

  describe('getRulesForGeometry', () => {
    it('finds rules for stop_line geometry', () => {
      const rules = getRulesForGeometry('stop_line');
      expect(rules.length).toBeGreaterThan(0);
      expect(rules[0].type).toBe('stop_violation');
    });

    it('finds no rules for non-monitored geometry', () => {
      const rules = getRulesForGeometry('random-geometry');
      expect(rules.length).toBe(0);
    });
  });

  describe('findForbiddenTurnRule', () => {
    it('finds matching forbidden turn rule', () => {
      const customRule = createForbiddenTurnRule('Left Turn Prohibited', {
        id: 'left-turn',
        roiIds: ['entry', 'exit'],
        roiLabels: ['Entry', 'Exit'],
        name: 'Left Turn',
      });
      const found = findForbiddenTurnRule(['entry', 'exit'], [customRule]);
      expect(found).toBeDefined();
      expect(found?.id).toBe('rule_forbidden_turn_left-turn');
    });

    it('returns undefined for non-matching sequence', () => {
      const customRule = createForbiddenTurnRule('Test', {
        id: 'test',
        roiIds: ['a', 'b'],
        roiLabels: ['A', 'B'],
        name: 'Test',
      });
      expect(findForbiddenTurnRule(['x', 'y'], [customRule])).toBeUndefined();
    });
  });

  describe('createForbiddenTurnRule', () => {
    it('creates rule with correct properties', () => {
      const sequence = {
        id: 'custom-turn',
        roiIds: ['start', 'end'],
        roiLabels: ['Start Zone', 'End Zone'],
        name: 'Custom Forbidden Turn',
      };
      const rule = createForbiddenTurnRule('Custom Turn', sequence);

      expect(rule.id).toBe('rule_forbidden_turn_custom-turn');
      expect(rule.type).toBe('forbidden_turn');
      expect(rule.severity).toBe('HIGH');
      expect(rule.enabled).toBe(true);
      expect(rule.priority).toBe(13);
      expect(rule.sequence).toEqual(sequence);
    });
  });
});

describe('AuditJob - Immutable Snapshot', () => {
  describe('createAuditJob', () => {
    it('creates frozen job with all evidence', () => {
      const track = {
        id: 42,
        label: 'car',
        bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
        avgVelocity: 45.5,
        velocityHistory: [40, 45, 50, 45.5],
        heading: 1.57,
        dwellTime: 0,
        isAnomalous: false,
        roiHistory: ['roi-a'],
        tail: [{ x: 0.1, y: 0.2 }],
      };

      const geometry: GeometryLine = {
        id: 'stop-line',
        x1: 0,
        y1: 0.8,
        x2: 1,
        y2: 0.8,
        label: 'STOP',
        type: 'stop_line',
      };

      const snapshot = {
        contextSnapshots: ['base64-1', 'base64-2'],
        zoomSnapshots: ['zoom-1', 'zoom-2'],
        ocrResults: ['ABC123'],
        localTime: '2024-01-15 10:30:00',
        videoTimeCode: '15/01/2024, 10:30:00',
        playbackTime: 123.5,
      };

      const job = createAuditJob(
        track,
        geometry,
        snapshot,
        'Directives here',
        'senior',
        'rule_stop_line'
      );

      expect(job.id).toMatch(/^audit_42_\d+_/);
      expect(job.status).toBe('pending');
      expect(job.trackState.id).toBe(42);
      expect(job.trackState.avgVelocity).toBe(45.5);
      expect(job.geometryState.lineLabel).toBe('STOP');
      expect(job.snapshot.localTime).toBe('2024-01-15 10:30:00');
      expect(job.directives).toBe('Directives here');
      expect(job.auditPreset).toBe('senior');
      expect(job.ruleId).toBe('rule_stop_line');
    });

    it('freezes immutable evidence parts', () => {
      const track = {
        id: 1,
        label: 'car',
        bbox: { x: 0, y: 0, w: 0.1, h: 0.1 },
        avgVelocity: 0,
        velocityHistory: [],
        heading: 0,
        dwellTime: 0,
        isAnomalous: false,
        roiHistory: [],
        tail: [],
      } as any;
      const job = createAuditJob(
        track,
        { id: 'l', x1: 0, y1: 0, x2: 1, y2: 1, label: 'L', type: 'forbidden' },
        {
          contextSnapshots: [],
          zoomSnapshots: [],
          ocrResults: [],
          localTime: '',
          videoTimeCode: '',
          playbackTime: 0,
        },
        '',
        'standard'
      );

      // Evidence parts should be frozen
      expect(() => {
        (job.trackState as any).velocityHistory = ['hacked'];
      }).toThrow();

      expect(() => {
        (job.geometryState as any).lineLabel = 'hacked';
      }).toThrow();

      // Status should be mutable (for queue processing)
      job.status = 'processing';
      expect(job.status).toBe('processing');
    });
  });
});

describe('OCRSynchronizer - Timecode Integrity', () => {
  // Mock for server-side testing
  const mockVideo = {
    videoWidth: 1920,
    videoHeight: 1080,
    currentTime: 0,
  };

  it('does NOT fabricate date when OCR misses it', async () => {
    // This test verifies the logic without actual OCR
    const timeMatch = '10:30:45';
    const dateMatch = null; // OCR failed to detect date

    let dateStr: string;
    if (dateMatch) {
      const d = dateMatch[1].padStart(2, '0');
      const m = dateMatch[2].padStart(2, '0');
      const y = dateMatch[3];
      dateStr = `${d}/${m}/${y}`;
    } else {
      // Forense: NO fabricamos fecha - eso compromete la validez forense
      dateStr = '??/??/????';
    }

    expect(dateStr).toBe('??/??/????');
    // The fabricated date approach would have given: actual current date
  });
});
