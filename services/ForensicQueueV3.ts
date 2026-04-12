/**
 * ForensicQueue v3 - Immutable Audit Jobs Pipeline
 * Processes forensic audits sequentially using immutable snapshots.
 * All evidence is captured at job creation time and never changes.
 */

import { AuditJob, createAuditJob } from '../types/auditJob';
import {
  ForensicRule,
  matchesOrderedRoiSequence,
  findForbiddenTurnRule,
  FORENSIC_RULES,
} from '../types/forensicRules';
import { Track, GeometryLine, InfractionLog, AuditPresetType } from '../types';
import { evidenceDB } from './EvidenceDB';
import { logger } from './logger';
import { OCRSynchronizer } from './OCRSynchronizer';

/**
 * Queue item with mutable status tracking.
 * The AuditJob itself has frozen evidence, but status is tracked separately.
 */
interface QueueItem {
  job: AuditJob;
  resolvedAt?: number;
  currentStatus: AuditJob['status'];
  retries: number;
}

export interface ForensicQueueEvent {
  type: 'queue_overflow' | 'retry' | 'job_failed';
  message: string;
  jobId?: string;
}

export class ForensicQueueV3 {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private listeners: Set<(log: InfractionLog) => void> = new Set();
  private onEvent?: (event: ForensicQueueEvent) => void;
  private idleResolvers: Array<() => void> = [];
  private maxQueueSize = 50;
  private maxRetries = 3;
  private retryDelayMs = 1250;
  private aiServicePromise: Promise<typeof import('./aiService')> | null = null;

  // Dynamic context at job creation time (frozen in each job)
  private directives: string = '';
  private auditPreset: AuditPresetType = 'senior';
  private rules: ForensicRule[] = [...FORENSIC_RULES];

  constructor(callback?: (log: InfractionLog) => void) {
    if (callback) this.listeners.add(callback);
  }

  /**
   * Updates default context for new jobs (existing jobs keep their frozen context).
   */
  updateContext(directives: string, preset: AuditPresetType, rules?: ForensicRule[]) {
    this.directives = directives;
    this.auditPreset = preset;
    if (rules) this.rules = rules;
  }

  setEventCallback(callback?: (event: ForensicQueueEvent) => void) {
    this.onEvent = callback;
  }

  /**
   * Finds the forensic rule that matches this geometry.
   */
  private findMatchingRule(geometry: GeometryLine): ForensicRule | undefined {
    // Find rules that monitor this geometry
    const matchingRules = this.rules.filter(
      (r) => r.enabled && r.geometryIds.includes(geometry.id)
    );

    if (matchingRules.length === 0) {
      // Fallback: use rule based on geometry type
      return this.rules.find((r) => r.geometryIds.includes(geometry.type));
    }

    // Return highest priority matching rule
    return matchingRules.sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Enqueues a new audit job with frozen snapshot.
   */
  enqueue(
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
    playbackTime: number,
    viewerId?: string
  ): AuditJob {
    // Check queue size
    if (this.queue.length >= this.maxQueueSize) {
      const dropped = this.queue.shift();
      const message = `Cola forense llena (${this.maxQueueSize}). Se descartó un trabajo pendiente para mantener estabilidad.`;
      logger.warn('FORENSIC_QUEUE', message);
      this.onEvent?.({
        type: 'queue_overflow',
        message,
        jobId: dropped?.job.id,
      });
    }

    // Find matching rule
    const rule = this.findMatchingRule(geometry);

    // Find forbidden turn rule if applicable
    let forbiddenTurnRule: ForensicRule | undefined;
    if (geometry.type === 'roi_turn' && track.roiHistory.length >= 2) {
      forbiddenTurnRule = findForbiddenTurnRule(track.roiHistory, this.rules);
    }

    // Use the more specific rule if found
    const effectiveRule = forbiddenTurnRule || rule;

    // Create job with current context snapshot
    const job = createAuditJob(
      track,
      geometry,
      {
        contextSnapshots: [],
        zoomSnapshots: [],
        ocrResults: [],
        localTime,
        videoTimeCode,
        playbackTime,
      },
      this.directives,
      this.auditPreset,
      effectiveRule?.id,
      viewerId
    );

    const queueItem: QueueItem = {
      job,
      currentStatus: 'pending',
      resolvedAt: Date.now(),
      retries: 0,
    };

    this.queue.push(queueItem);

    logger.info(
      'FORENSIC_QUEUE',
      `Job ${job.id} enqueued for Vehicle #${track.id}. Rule: ${effectiveRule?.name || 'default'}. Queue: ${this.queue.length}`
    );

    this.processNext();
    return job;
  }

  getPendingCount(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  getQueue(): ReadonlyArray<{ id: string; status: string; createdAt: number }> {
    return this.queue.map((item) => ({
      id: item.job.id,
      status: item.currentStatus,
      createdAt: item.job.createdAt,
    }));
  }

  waitForIdle(): Promise<void> {
    if (this.getPendingCount() === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  /**
   * Abort a pending job by ID.
   */
  abort(jobId: string): boolean {
    const index = this.queue.findIndex((item) => item.job.id === jobId);
    if (index >= 0) {
      const item = this.queue[index];
      item.currentStatus = 'aborted';
      this.queue.splice(index, 1);
      logger.info('FORENSIC_QUEUE', `Job ${jobId} aborted.`);
      return true;
    }
    return false;
  }

  private resolveIdleIfNeeded() {
    if (this.getPendingCount() === 0 && this.idleResolvers.length > 0) {
      const resolvers = [...this.idleResolvers];
      this.idleResolvers = [];
      resolvers.forEach((resolve) => resolve());
    }
  }

  /**
   * Selects frames for AI analysis (initial, mid, final).
   */
  private selectTriplet(frames: string[] = [], fallback: string[] = []): string[] {
    const source = frames.length > 0 ? frames : fallback;
    if (source.length === 0) return [];
    if (source.length === 1) return [source[0], source[0], source[0]];
    if (source.length === 2) return [source[0], source[1], source[1]];
    return [source[0], source[Math.floor(source.length / 2)], source[source.length - 1]];
  }

  /**
   * Processes the next job in queue.
   */
  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const current = this.queue.shift();

    if (!current) {
      this.isProcessing = false;
      return;
    }

    // Update status (mutable, not frozen)
    current.currentStatus = 'processing';

    try {
      // Fetch evidence from IndexedDB
      const evidence = await evidenceDB.getEvidence(current.job.id);

      if (!evidence) {
        const didRequeue = this.requeueWithRetry(
          current,
          `Evidencia no disponible para ${current.job.id}. Reintento ${current.retries + 1}/${this.maxRetries}.`
        );
        if (didRequeue) {
          current.currentStatus = 'pending';
        } else {
          throw new Error(`Evidence not found for job ${current.job.id}`);
        }
      } else {
        // Select frames for analysis
        const contextSnapshots = this.selectTriplet(
          evidence.contextSnapshots,
          evidence.snapshots.filter((_, i) => i % 2 === 0)
        );
        const zoomSnapshots = this.selectTriplet(
          evidence.zoomSnapshots,
          evidence.snapshots.filter((_, i) => i % 2 === 1)
        );

        // OCR processing
        const plateOCR = await OCRSynchronizer.extractLicensePlate(zoomSnapshots);

        logger.info(
          'FORENSIC_QUEUE',
          `Processing job ${current.job.id} [Preset: ${current.job.auditPreset}]...`
        );

        // Call AI Service with immutable job data
        const { AIService } = await this.getAIService();

        // Create compatible track object for the service
        const compatibleTrack = {
          id: current.job.trackState.id,
          label: current.job.trackState.label,
          bbox: {
            x: current.job.trackState.bboxX,
            y: current.job.trackState.bboxY,
            w: current.job.trackState.bboxW,
            h: current.job.trackState.bboxH,
          },
          avgVelocity: current.job.trackState.avgVelocity,
          velocityHistory: [...current.job.trackState.velocityHistory],
          heading: current.job.trackState.heading,
          dwellTime: current.job.trackState.dwellTime,
          isAnomalous: current.job.trackState.isAnomalous,
          anomalyLabel: current.job.trackState.anomalyLabel,
          roiHistory: [...current.job.trackState.roiHistory],
          tail: [...current.job.trackState.tailPositions],
          snapshots: evidence.snapshots,
          contextSnapshots,
          zoomSnapshots,
          videoClip: evidence.clip,
        } as unknown as Track;

        // Create compatible geometry object
        const compatibleGeometry: GeometryLine = {
          id: current.job.geometryState.lineId,
          label: current.job.geometryState.lineLabel,
          type: current.job.geometryState.lineType as any,
          x1: current.job.geometryState.x1,
          y1: current.job.geometryState.y1,
          x2: current.job.geometryState.x2,
          y2: current.job.geometryState.y2,
          points: current.job.geometryState.points
            ? [...current.job.geometryState.points]
            : undefined,
          violationKind: current.job.geometryState.violationKind as any,
          roiSequenceIds: current.job.geometryState.roiSequenceIds
            ? [...current.job.geometryState.roiSequenceIds]
            : undefined,
          roiSequenceLabels: current.job.geometryState.roiSequenceLabels
            ? [...current.job.geometryState.roiSequenceLabels]
            : undefined,
          analysisContext: current.job.geometryState.analysisContext,
        };

        const auditResult = await AIService.analyzeTrajectory(
          compatibleTrack,
          compatibleGeometry,
          current.job.directives,
          current.job.auditPreset
        );

        // Check for forbidden turn sequence validation
        const isForbiddenTurnSequence =
          current.job.geometryState.violationKind === 'forbidden_turn_sequence' &&
          current.job.geometryState.roiSequenceIds &&
          matchesOrderedRoiSequence(
            [...current.job.trackState.roiHistory],
            [...current.job.geometryState.roiSequenceIds]
          );

        // Apply forbidden turn override if needed
        if (isForbiddenTurnSequence) {
          const sequenceLabels = current.job.geometryState.roiSequenceLabels || ['ROI A', 'ROI B'];
          auditResult.infraction = true;
          auditResult.ruleCategory = 'GIRO_PROHIBIDO';
          auditResult.description = `Giro prohibido confirmado por secuencia ordenada de zonas ${sequenceLabels.join(' -> ')}.`;
          auditResult.reasoning = [
            `Secuencia ROI validada: ${sequenceLabels.join(' -> ')}.`,
            `Track #${current.job.trackState.id} mantuvo identidad persistente durante la maniobra.`,
            'La regla configurada establece que esta secuencia equivale a giro prohibido.',
          ];
          if (!auditResult.severity || auditResult.severity === 'LOW') {
            auditResult.severity = 'HIGH';
          }
        }

        if (auditResult.infraction) {
          current.currentStatus = 'completed';

          logger.success(
            'FORENSIC_QUEUE',
            `INFRACCIÓN CONFIRMADA - Job ${current.job.id} (${auditResult.plate})`
          );

          const infractionLog: InfractionLog = {
            ...auditResult,
            id: Date.now(),
            plate:
              auditResult.plate && auditResult.plate !== 'DESCONOCIDO'
                ? auditResult.plate
                : plateOCR.plate || 'DESCONOCIDO',
            image: zoomSnapshots[zoomSnapshots.length - 1] || evidence.snapshots[0],
            extraSnapshots: contextSnapshots,
            zoomSnapshots,
            ocrResults: evidence.ocrResults,
            plateOcr: plateOCR.plate,
            plateOcrCandidates: plateOCR.candidates,
            videoClip: evidence.clip,
            time: new Date().toLocaleTimeString(),
            localTime: current.job.snapshot.localTime,
            videoTimeCode: current.job.snapshot.videoTimeCode,
            playbackTime: current.job.snapshot.playbackTime,
          };

          if (this.listeners.size > 0) {
            this.listeners.forEach((listener) => listener(infractionLog));
          }
        } else {
          current.currentStatus = 'cleared';

          logger.info('FORENSIC_QUEUE', `Job ${current.job.id}: NO INFRACTOR. Queue cleared.`);
        }

        // Cleanup evidence
        await evidenceDB.deleteEvidence(current.job.id);
      }
    } catch (error) {
      current.currentStatus = 'failed';
      this.onEvent?.({
        type: 'job_failed',
        message: `Fallo en auditoría forense para ${current.job.id}: ${error instanceof Error ? error.message : String(error)}`,
        jobId: current.job.id,
      });

      logger.error(
        'FORENSIC_QUEUE',
        `Job ${current.job.id} failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }

    this.isProcessing = false;
    this.resolveIdleIfNeeded();

    // Small cooldown between AI calls and retry reschedules
    const nextDelay = current.currentStatus === 'pending' ? this.retryDelayMs : 1000;
    setTimeout(() => this.processNext(), nextDelay);
  }

  /**
   * Updates the infraction callback.
   * @deprecated Use addListener instead for multi-viewer support.
   */
  setCallback(callback: (log: InfractionLog) => void) {
    this.listeners.clear();
    this.listeners.add(callback);
  }

  addListener(callback: (log: InfractionLog) => void) {
    this.listeners.add(callback);
  }

  removeListener(callback: (log: InfractionLog) => void) {
    this.listeners.delete(callback);
  }

  private async getAIService() {
    if (!this.aiServicePromise) {
      this.aiServicePromise = import('./aiService');
    }
    return this.aiServicePromise;
  }

  private requeueWithRetry(item: QueueItem, message: string): boolean {
    if (item.retries >= this.maxRetries) {
      return false;
    }
    item.retries += 1;
    item.currentStatus = 'pending';
    this.queue.push(item);
    logger.warn('FORENSIC_QUEUE', message);
    this.onEvent?.({
      type: 'retry',
      message,
      jobId: item.job.id,
    });
    return true;
  }

  /**
   * Clear the queue and reset state.
   */
  clear() {
    this.queue = [];
    this.isProcessing = false;
    this.idleResolvers = [];
  }
}

export const forensicQueueV3 = new ForensicQueueV3();
