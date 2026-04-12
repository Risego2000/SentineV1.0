import { Track, GeometryLine, InfractionLog, AuditPresetType } from '../types';
import { evidenceDB } from './EvidenceDB';
import { logger } from './logger';
import { OCRSynchronizer } from './OCRSynchronizer';
import { buildForbiddenTurnAudit, matchesOrderedRoiSequence } from './forensicRules';

/**
 * ForensicQueue - Strategic Processing Pipeline
 * Ensures audits are processed sequentially, protecting Gemini API and system memory.
 * Version 2.1 - Context-aware (Directives & Presets)
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
  }

  /**
   * Updates the tactical context for future audits in the queue.
   */
  updateContext(directives: string, preset: AuditPresetType) {
    this.directives = directives;
    this.auditPreset = preset;
  }

  /**
   * Enqueues a new audit request.
   */
  async enqueue(
    track: Track,
    line: GeometryLine,
    evidenceId: string,
    localTime: string,
    videoTimeCode: string,
    playbackTime: number
  ) {
    this.queue.push({ track, line, evidenceId, localTime, videoTimeCode, playbackTime });
    logger.info(
      'FORENSIC_QUEUE',
      `Nueva auditoría encolada para Vehículo #${track.id} (${track.label}). Cola: ${this.queue.length}`
    );
    this.processNext();
  }

  getPendingCount(): number {
    return this.queue.length + (this.isProcessing ? 1 : 0);
  }

  waitForIdle(): Promise<void> {
    if (this.getPendingCount() === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private resolveIdleIfNeeded() {
    if (this.getPendingCount() === 0 && this.idleResolvers.length > 0) {
      const resolvers = [...this.idleResolvers];
      this.idleResolvers = [];
      resolvers.forEach((resolve) => resolve());
    }
  }

  private selectTriplet(frames: string[] = [], fallback: string[] = []): string[] {
    const source = frames.length > 0 ? frames : fallback;
    if (source.length === 0) return [];
    if (source.length === 1) return [source[0], source[0], source[0]];
    if (source.length === 2) return [source[0], source[1], source[1]];

    return [source[0], source[Math.floor(source.length / 2)], source[source.length - 1]];
  }

  /**
   * Processes the next item in the queue.
   */
  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const current = this.queue.shift();

    if (current) {
      try {
        const { track, line, evidenceId, localTime, videoTimeCode, playbackTime } = current;

        // Fetch high-fidelity evidence from IndexedDB
        const evidence = await evidenceDB.getEvidence(evidenceId);

        if (evidence) {
          const contextSnapshots = this.selectTriplet(
            evidence.contextSnapshots,
            evidence.snapshots.filter((_, index) => index % 2 === 0)
          );
          const zoomSnapshots = this.selectTriplet(
            evidence.zoomSnapshots,
            evidence.snapshots.filter((_, index) => index % 2 === 1)
          );
          const plateOCR = await OCRSynchronizer.extractLicensePlate(zoomSnapshots);

          // Enrich track with evidence just for the AI call (isolated)
          const enrichedTrack = {
            ...track,
            snapshots: evidence.snapshots,
            contextSnapshots,
            zoomSnapshots,
            videoClip: evidence.clip,
          };

          logger.info(
            'FORENSIC_QUEUE',
            `Iniciando análisis de trayectoria para Vehículo #${track.id} [Preset: ${this.auditPreset}]...`
          );

          // Call AI Service with full context
          const { AIService } = await import('./aiService');
          const auditResult = await AIService.analyzeTrajectory(
            enrichedTrack,
            line,
            this.directives,
            this.auditPreset
          );
          const isForbiddenTurnSequence =
            line.violationKind === 'forbidden_turn_sequence' &&
            matchesOrderedRoiSequence(track.roiHistory, line.roiSequenceIds);
          const finalAuditResult = isForbiddenTurnSequence
            ? buildForbiddenTurnAudit(track, line, auditResult)
            : auditResult;

          if (finalAuditResult.infraction) {
            logger.success(
              'FORENSIC_QUEUE',
              `INFRACCIÓN CONFIRMADA para Vehículo #${track.id} (${finalAuditResult.plate})`
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
              localTime: localTime,
              videoTimeCode: videoTimeCode,
              playbackTime: playbackTime,
            };

            if (this.onInfractionDetected) {
              this.onInfractionDetected(infractionLog);
            }
          } else {
            logger.info(
              'FORENSIC_QUEUE',
              `Auditoría finalizada para Vehículo #${track.id}: NO INFRACTOR.`
            );
          }
        }

        // Cleanup evidence to keep storage clean
        await evidenceDB.deleteEvidence(evidenceId);
      } catch (error) {
        logger.error('FORENSIC_QUEUE', `Error procesando auditoría #${current.track.id}`, error);
      }
    }

    this.isProcessing = false;
    this.resolveIdleIfNeeded();
    // Small cooldown between AI calls
    setTimeout(() => this.processNext(), 1000);
  }

  /**
   * Updates the infraction callback (useful for React context binding).
   */
  setCallback(callback: (log: InfractionLog) => void) {
    this.onInfractionDetected = callback;
  }
}

export const forensicQueue = new ForensicQueue();
