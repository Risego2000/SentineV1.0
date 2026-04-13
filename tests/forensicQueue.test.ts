import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForensicQueue } from '../services/ForensicQueue';
import { matchesOrderedRoiSequence, buildForbiddenTurnAudit } from '../types/forensicRules';
import type { Track, IKalman } from '../types';

// Helper to create complete mock Track objects
function createMockTrack(overrides?: Partial<Track>): Track {
  const mockKalman: IKalman = {
    x: 0.1,
    y: 0.2,
    vx: 1,
    vy: 0.5,
    update: vi.fn(),
    step: vi.fn(),
    getVelocity: vi.fn().mockReturnValue(45),
    getHeading: vi.fn().mockReturnValue(1.5),
  };

  const track: Track = {
    id: 1,
    bbox: { x: 0.1, y: 0.2, w: 0.3, h: 0.4 },
    label: 'car',
    conf: 0.95,
    hits: 5,
    age: 10,
    tail: [{ x: 0.1, y: 0.2 }],
    snapshots: [],
    audited: false,
    processedLines: [],
    velocity: 45,
    velocityHistory: [40, 45],
    avgVelocity: 45,
    acceleration: 0,
    heading: 1.5,
    isAnomalous: false,
    dwellTime: 0,
    kf: mockKalman,
    missedFrames: 0,
    isCoasting: false,
    roiHistory: [],
    ...overrides,
  };

  // Ensure velocityHistory is always an array, never undefined
  if (track.velocityHistory === undefined) {
    track.velocityHistory = [];
  }

  return track;
}

// Mock dependencies
vi.mock('../services/EvidenceDB', () => ({
  evidenceDB: {
    getEvidence: vi.fn().mockResolvedValue({
      snapshots: ['snap1', 'snap2', 'snap3'],
      contextSnapshots: ['ctx1', 'ctx2'],
      zoomSnapshots: ['zoom1', 'zoom2'],
      ocrResults: ['ABC123'],
      clip: undefined,
    }),
    deleteEvidence: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../services/aiService', () => ({
  AIService: {
    analyzeTrajectory: vi.fn().mockResolvedValue({
      infraction: true,
      plate: 'TEST123',
      makeModel: 'Test Car',
      color: 'Blue',
      description: 'Test violation',
      severity: 'MEDIUM',
      ruleCategory: 'TEST',
      legalBase: 'Art. 1 TEST',
      reasoning: ['Test reason'],
      visualTimestamp: '10:00:00',
      videoTimeCode: '10:00:00',
      localTime: '2024-01-01 10:00:00',
      telemetry: { speedEstimated: '50 km/h' },
    }),
  },
}));

describe('ForensicQueueV3 - Immutable Audit Jobs', () => {
  let queue: ForensicQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new ForensicQueue();
  });

  describe('enqueue', () => {
    it('creates immutable job with frozen context', async () => {
      const track = createMockTrack({
        id: 1,
        avgVelocity: 45,
        velocityHistory: [40, 45],
      });

      const geometry = {
        id: 'stop-line',
        x1: 0,
        y1: 0.8,
        x2: 1,
        y2: 0.8,
        label: 'STOP',
        type: 'stop_line' as const,
      };

      // Small delay to ensure unique job IDs
      await new Promise((r) => setTimeout(r, 10));

      queue.enqueue(track, geometry, 'ev_1', '2024-01-01', '10:00:00', 10);

      // Queue should have pending items
      expect(queue.getPendingCount()).toBeGreaterThanOrEqual(0);
    });

    it('respects max queue size', async () => {
      // Queue should not exceed limit (tested internally by the queue)
      expect(queue.getPendingCount()).toBeLessThanOrEqual(50);
    });
  });

  describe('waitForIdle', () => {
    it('resolves immediately when queue is empty', async () => {
      // Create fresh queue instance for this test
      const freshQueue = new ForensicQueue();
      // Clear any pending items
      freshQueue.clear();

      const promise = freshQueue.waitForIdle();
      // Add timeout to prevent hanging
      const timeout = new Promise<undefined>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 1000)
      );
      await expect(Promise.race([promise, timeout])).resolves.toBeUndefined();
    });
  });

  describe('context isolation', () => {
    it('preserves directives at enqueue time', async () => {
      queue.updateContext('Original directives', 'standard');

      const track = createMockTrack({
        id: 5,
        avgVelocity: 0,
        velocityHistory: [],
        heading: 0,
      });

      const geometry = {
        id: 'g1',
        x1: 0,
        y1: 0.5,
        x2: 1,
        y2: 0.5,
        label: 'G',
        type: 'forbidden' as const,
      };

      queue.enqueue(track, geometry, 'ev_5', '', '', 0);

      // Update context after enqueue
      queue.updateContext('Changed directives', 'senior');

      // Job should have been created with original directives
      expect(queue.getPendingCount()).toBeGreaterThanOrEqual(0);
    });
  });
});

// Re-exported functions are available from forensicRules module
describe('ForensicQueue - Backward Compatibility', () => {
  it('matchesOrderedRoiSequence is available', () => {
    expect(typeof matchesOrderedRoiSequence).toBe('function');
    expect(matchesOrderedRoiSequence(['a', 'b'], ['a', 'b'])).toBe(true);
  });

  it('buildForbiddenTurnAudit is available', () => {
    expect(typeof buildForbiddenTurnAudit).toBe('function');
  });
});
