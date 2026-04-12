/**
 * ForensicQueue - Strategic Processing Pipeline
 *
 * DEPRECATED: Use ForensicQueueV3 for immutable AuditJob support.
 * This file is kept for backward compatibility during migration.
 *
 * ForensicQueueV3 provides:
 * - Immutable AuditJob snapshots (all evidence frozen at capture time)
 * - Formal ForensicRule system (no heuristics based on labels)
 * - Explicit lifecycle: pending → processing → completed/cleared/failed/aborted
 * - Abort capability by job ID
 * - Queue introspection and monitoring
 */

import { Track, GeometryLine, InfractionLog, AuditPresetType } from '../types';
import { evidenceDB } from './EvidenceDB';
import { logger } from './logger';
import { OCRSynchronizer } from './OCRSynchronizer';
import {
  matchesOrderedRoiSequence,
  matchesOrderedRoiSequence as legacyMatchesSequence,
} from '../types/forensicRules';
import {
  buildForbiddenTurnAudit,
  buildForbiddenTurnAudit as legacyBuildForbiddenTurn,
} from '../types/forensicRules';

// Re-export for backward compatibility
export { matchesOrderedRoiSequence } from '../types/forensicRules';
export { buildForbiddenTurnAudit } from '../types/forensicRules';

import { ForensicQueueV3, forensicQueueV3 } from './ForensicQueueV3';

/**
 * @deprecated Use ForensicQueueV3 instead
 */
export class ForensicQueue {
  private queue: {
    track: Track;
    line: GeometryLine;
    evidenceId: string;
    localTime: string;
    videoTimeCode: string;
    playbackTime: number;
  }[] = [];
  private isProcessing = false;
  private onInfractionDetected?: (log: InfractionLog) => void;
  private idleResolvers: Array<() => void> = [];

  // Dynamic context synced from React
  private directives: string = '';
  private auditPreset: AuditPresetType = 'senior';

  constructor(callback?: (log: InfractionLog) => void) {
    this.onInfractionDetected = callback;
    // Sync with V3 instance
    forensicQueueV3.setCallback(callback || (() => {}));
  }

  updateContext(directives: string, preset: AuditPresetType) {
    this.directives = directives;
    this.auditPreset = preset;
    forensicQueueV3.updateContext(directives, preset);
  }

  /**
   * @deprecated Use enqueueJob() instead for immutable audit jobs
   */
  async enqueue(
    track: Track,
    line: GeometryLine,
    evidenceId: string,
    localTime: string,
    videoTimeCode: string,
    playbackTime: number
  ) {
    // Route to V3 for immutable job handling
    forensicQueueV3.enqueue(
      {
        id: track.id,
        label: track.label,
        bbox: { ...track.bbox },
        avgVelocity: track.avgVelocity,
        velocityHistory: [...(track.velocityHistory || [])],
        heading: track.heading,
        dwellTime: track.dwellTime,
        isAnomalous: track.isAnomalous || false,
        anomalyLabel: track.anomalyLabel,
        roiHistory: [...track.roiHistory],
        tail: [...track.tail],
      },
      line,
      evidenceId,
      localTime,
      videoTimeCode,
      playbackTime
    );
  }

  /**
   * Enqueue using immutable AuditJob (V3).
   */
  enqueueJob(
    track: {
      id: number;
      label: string;
      bbox: { x: number; y: number; w: number; h: number };
      avgVelocity: number;
      velocityHistory: number[];
      heading: number;
      dwellTime: number;
      isAnomalous: boolean;
      anomalyLabel?: string;
      roiHistory: string[];
      tail: { x: number; y: number }[];
    },
    geometry: GeometryLine,
    evidenceId: string,
    localTime: string,
    videoTimeCode: string,
    playbackTime: number
  ) {
    return forensicQueueV3.enqueue(
      track,
      geometry,
      evidenceId,
      localTime,
      videoTimeCode,
      playbackTime
    );
  }

  getPendingCount(): number {
    return forensicQueueV3.getPendingCount();
  }

  getQueue() {
    return forensicQueueV3.getQueue();
  }

  waitForIdle(): Promise<void> {
    return forensicQueueV3.waitForIdle();
  }

  /**
   * Abort a pending job by ID.
   */
  abort(jobId: string): boolean {
    return forensicQueueV3.abort(jobId);
  }

  setCallback(callback: (log: InfractionLog) => void) {
    this.onInfractionDetected = callback;
    forensicQueueV3.setCallback(callback);
  }

  /**
   * Clear the queue and reset state.
   */
  clear() {
    forensicQueueV3.clear();
  }
}

export const forensicQueue = new ForensicQueue();

// Legacy re-exports for backward compatibility
export { forensicQueueV3 };
