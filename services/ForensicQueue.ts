import { AuditJob, InfractionLog, AuditPresetType } from '../types';
import { evidenceDB } from './EvidenceDB';
import { logger } from './logger';
import { OCRSynchronizer } from './OCRSynchronizer';
import { buildForbiddenTurnAudit, matchesOrderedRoiSequence } from './forensicRules';

/**
 * ForensicQueue — Strategic Processing Pipeline
 * Consumes immutable AuditJob snapshots so that live-track mutations cannot
 * corrupt in-flight audits.  Ensures sequential Gemini calls to protect API
 * quota and system memory.
 * Version 3.0 — AuditJob-based, deterministic
 */
export class ForensicQueue {
  private queue: AuditJob[] = [];
  private isProcessing = false;
  private onInfractionDetected?: (log: InfractionLog) => void;
  private idleResolvers: Array<() => void> = [];

  constructor(callback?: (log: InfractionLog) => void) {
    this.onInfractionDetected = callback;
  }

  /**
   * Enqueues an immutable AuditJob.
   * Context (directives, preset) is already embedded in the job snapshot.
   */
  enqueue(job: AuditJob): void {
    this.queue.push(job);
    logger.info(
      'FORENSIC_QUEUE',
      `Nueva auditoría encolada para Vehículo #${job.trackId} (${job.trackLabel}). Cola: ${this.queue.length}`
    );
    this.processNext();
  }

  getPendingCount(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  waitForIdle(): Promise<void> {
    if (this.getPendingCount() === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private resolveIdleIfNeeded() {
    if (this.getPendingCount() === 0 && this.idleResolvers.length > 0) {
      const resolvers = [...this.idleResolvers];
      this.idleResolvers = [];
      resolvers.forEach((r) => r());
    }
  }

  private selectTriplet(frames: string[] = [], fallback: string[] = []): string[] {
    const source = frames.length > 0 ? frames : fallback;
    if (source.length === 0) return [];
    if (source.length === 1) return [source[0], source[0], source[0]];
    if (source.length === 2) return [source[0], source[1], source[1]];
    return [source[0], source[Math.floor(source.length / 2)], source[source.length - 1]];
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const job = this.queue.shift()!;

    try {
      const evidence = await evidenceDB.getEvidence(job.evidenceId);

      if (evidence) {
        const contextSnapshots = this.selectTriplet(
          evidence.contextSnapshots,
          evidence.snapshots.filter((_, i) => i % 2 === 0)
        );
        const zoomSnapshots = this.selectTriplet(
          evidence.zoomSnapshots,
          evidence.snapshots.filter((_, i) => i % 2 === 1)
        );
        const plateOCR = await OCRSynchronizer.extractLicensePlate(zoomSnapshots);

        // Build a minimal track-shaped object from the immutable snapshot + evidence
        const trackForAI = {
          id: job.trackId,
          label: job.trackLabel,
          tail: job.tail,
          bbox: job.bbox,
          roiHistory: job.roiHistory,
          velocity: job.velocity,
          avgVelocity: job.avgVelocity,
          heading: job.heading,
          snapshots: evidence.snapshots,
          contextSnapshots,
          zoomSnapshots,
          videoClip: evidence.clip,
          // Required by Track interface — safe defaults for fields not in AuditJob
          conf: 0,
          hits: 0,
          age: 0,
          audited: true,
          processedLines: [],
          acceleration: 0,
          dwellTime: 0,
          missedFrames: 0,
          isCoasting: false,
          kf: { x: 0, y: 0, vx: 0, vy: 0, update() {}, step() {}, getVelocity: () => 0, getHeading: () => 0 },
        };

        logger.info(
          'FORENSIC_QUEUE',
          `Iniciando análisis para Vehículo #${job.trackId} [Preset: ${job.auditPreset}]...`
        );

        const { AIService } = await import('./aiService');
        const auditResult = await AIService.analyzeTrajectory(
          trackForAI as never,
          job.line,
          job.directives,
          job.auditPreset
        );

        const isForbiddenTurnSequence =
          job.line.violationKind === 'forbidden_turn_sequence' &&
          matchesOrderedRoiSequence(job.roiHistory, job.line.roiSequenceIds);

        const finalAuditResult = isForbiddenTurnSequence
          ? buildForbiddenTurnAudit(trackForAI as never, job.line, auditResult)
          : auditResult;

        if (finalAuditResult.infraction) {
          logger.success(
            'FORENSIC_QUEUE',
            `INFRACCIÓN CONFIRMADA para Vehículo #${job.trackId} (${finalAuditResult.plate})`
          );

          const infractionLog: InfractionLog = {
            ...finalAuditResult,
            id: Date.now(),
            plate:
              finalAuditResult.plate && finalAuditResult.plate !== 'DESCONOCIDO'
                ? finalAuditResult.plate
                : plateOCR.plate || 'DESCONOCIDO',
            image: zoomSnapshots[zoomSnapshots.length - 1] || evidence.snapshots[0],
            extraSnapshots: contextSnapshots,
            zoomSnapshots,
            ocrResults: evidence.ocrResults,
            plateOcr: plateOCR.plate,
            plateOcrCandidates: plateOCR.candidates,
            videoClip: evidence.clip,
            time: new Date().toLocaleTimeString(),
            localTime: job.localTime,
            videoTimeCode: job.videoTimeCode,
            playbackTime: job.playbackTime,
          };

          this.onInfractionDetected?.(infractionLog);
        } else {
          logger.info(
            'FORENSIC_QUEUE',
            `Auditoría finalizada para Vehículo #${job.trackId}: NO INFRACTOR.`
          );
        }
      }

      // Cleanup evidence after audit
      await evidenceDB.deleteEvidence(job.evidenceId);
    } catch (error) {
      logger.error('FORENSIC_QUEUE', `Error procesando auditoría #${job.trackId}`, error);
      // Lifecycle always reaches a terminal state — never silently stuck
    } finally {
      this.isProcessing = false;
      this.resolveIdleIfNeeded();
      // Small cooldown between AI calls
      setTimeout(() => this.processNext(), 1000);
    }
  }

  setCallback(callback: (log: InfractionLog) => void) {
    this.onInfractionDetected = callback;
  }

  /** @deprecated Use enqueue(AuditJob) directly */
  updateContext(_directives: string, _preset: AuditPresetType) {
    // Context is now embedded in each AuditJob — this method is a no-op kept
    // for backward compatibility during migration.
  }
}

export const forensicQueue = new ForensicQueue();
