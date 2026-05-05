/**
 * ForensicQueue v3 - Immutable Audit Jobs Pipeline
 * Processes forensic audits sequentially using immutable snapshots.
 * All evidence is captured at job creation time and never changes.
 */

import { AuditJob, createAuditJob } from '../types/auditJob';
import { ForensicRule, FORENSIC_RULES } from '../types/forensicRules';
import { Track, GeometryLine, InfractionLog, AuditPresetType } from '../types';
import { evidenceDB } from './EvidenceDB';
import { logger } from './logger';
import { OCRSynchronizer } from './OCRSynchronizer';
import { forensicQueuePersistence } from './ForensicQueuePersistence';
import { ChainOfCustodyService, CustodyManifest, calculateSHA256 } from './ChainOfCustodyService';
import { custodyLog, CustodyLogService } from './CustodyLogService';
import { InfractionExclusionService } from './InfractionExclusionService';

/**
 * Check if a sequence of ROI IDs matches an expected ordered sequence
 */
function matchesOrderedRoiSequence(roiHistory: string[], expectedSequence: string[]): boolean {
  if (!roiHistory || !expectedSequence || expectedSequence.length === 0) {
    return false;
  }

  // Check if the expected sequence appears in the ROI history
  for (let i = 0; i <= roiHistory.length - expectedSequence.length; i++) {
    let matches = true;
    for (let j = 0; j < expectedSequence.length; j++) {
      if (roiHistory[i + j] !== expectedSequence[j]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

/**
 * Queue item with mutable status tracking.
 * The AuditJob itself has frozen evidence, but status is tracked separately.
 */
interface QueueItem {
  job: AuditJob;
  evidenceId: string;
  resolvedAt?: number;
  currentStatus: AuditJob['status'];
  retries: number;
  lastRetryAt?: number;
  nextRetryAt?: number;
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
  private maxRetries = 1; // Reduced from 2 to 1 since OCR is now fixed
  private baseRetryDelayMs = 100; // Reduced from 300ms for faster retries
  private maxOcrFrames = 12; // Increased from 4 to 12 for better OCR accuracy with voting
  private analysisTimeoutMs = 15000; // Reduced from 30s to 15s for faster analysis
  private aiServicePromise: Promise<typeof import('./aiService')> | null = null;
  private persistenceInitialized = false;
  private custodyManifest: CustodyManifest | null = null;

  // Dynamic context at job creation time (frozen in each job)
  private directives: string = '';
  private auditPreset: AuditPresetType = 'standard';
  private rules: ForensicRule[] = [...FORENSIC_RULES];

  constructor(callback?: (log: InfractionLog) => void) {
    if (callback) this.listeners.add(callback);
    this.loadPersistedQueue();

    // PHASE 3: Initialize custody manifest for this queue instance
    this.custodyManifest = ChainOfCustodyService.createManifest(
      `CASE_${Date.now()}`,
      'OPERATOR_SYSTEM',
      '16.0.0',
      'COCO-SSD v1.0'
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Load persisted queue items from IndexedDB
   */
  private async loadPersistedQueue() {
    try {
      const persistedItems = await forensicQueuePersistence.loadQueueItems();

      // Restore jobs that were pending or processing
      const restoredJobs = persistedItems.filter(
        (item) => item.currentStatus === 'pending' || item.currentStatus === 'processing'
      );

      if (restoredJobs.length > 0) {
        this.queue = restoredJobs as QueueItem[];
        logger.info(
          'FORENSIC_QUEUE',
          `Restaurados ${restoredJobs.length} trabajos forenses de persistencia`
        );
        this.processNext();
      }

      this.persistenceInitialized = true;
    } catch (error) {
      logger.warn(
        'FORENSIC_QUEUE',
        `Error cargando cola persistida: ${error instanceof Error ? error.message : String(error)}`
      );
      this.persistenceInitialized = true;
    }
  }

  /**
   * Save queue state to IndexedDB
   */
  private async saveQueueState() {
    if (!this.persistenceInitialized) return;

    try {
      await forensicQueuePersistence.saveQueueItems(
        this.queue.map((item) => ({
          job: item.job,
          evidenceId: item.evidenceId,
          resolvedAt: item.resolvedAt,
          currentStatus: item.currentStatus,
          retries: item.retries,
          lastRetryAt: item.lastRetryAt,
          nextRetryAt: item.nextRetryAt,
        }))
      );
    } catch (error) {
      logger.warn('FORENSIC_QUEUE', `Error guardando estado de cola: ${error}`);
    }
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
      velocityHistory?: number[];
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

    // Use the matching rule directly (geometry-based matching already handles ROI sequences)
    const effectiveRule = rule;

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
      evidenceId,
      currentStatus: 'pending',
      resolvedAt: Date.now(),
      retries: 0,
    };

    this.queue.push(queueItem);

    logger.info(
      'FORENSIC_QUEUE',
      `Job ${job.id} enqueued for Vehicle #${track.id}. Rule: ${effectiveRule?.name || 'default'}. Queue: ${this.queue.length}`
    );

    // Save queue state to persistence
    this.saveQueueState();

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
      this.saveQueueState();
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
   * Ensures exactly 3 frames are returned for the 3 fotogramas display.
   */
  private selectTriplet(frames: string[] = [], fallback: string[] = []): string[] {
    const source = frames.length > 0 ? frames : fallback;
    if (source.length === 0) return [];

    // Always return exactly 3 frames for fotogramas display (ENTRADA, CRÍTICA, SALIDA)
    if (source.length === 1) {
      return [source[0], source[0], source[0]];
    }
    if (source.length === 2) {
      return [source[0], source[1], source[1]];
    }

    // For 3+ frames, select: first (entrada), middle (crítica), last (salida)
    const midIndex = Math.floor((source.length - 1) / 2);
    return [source[0], source[midIndex], source[source.length - 1]];
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

    // Variables for error handling (declared at outer scope)
    let evidence: any = null;
    let contextSnapshots: string[] = [];
    let zoomSnapshots: string[] = [];
    let plateOCR: any = null;

    try {
      // Fetch evidence from IndexedDB using the original capture key
      evidence = await evidenceDB.getEvidence(current.evidenceId);

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
        // Keep full evidence snapshots for expediente/gallery output
        const allContextSnapshots: string[] = Array.isArray(evidence.contextSnapshots)
          ? [...evidence.contextSnapshots]
          : [];
        const allZoomSnapshots: string[] = Array.isArray(evidence.zoomSnapshots)
          ? [...evidence.zoomSnapshots]
          : [];

        // Use all captured frames (no triplet truncation).
        contextSnapshots =
          allContextSnapshots.length > 0
            ? allContextSnapshots
            : evidence.snapshots.filter((_, i) => i % 2 === 0);
        zoomSnapshots =
          allZoomSnapshots.length > 0
            ? allZoomSnapshots
            : evidence.snapshots.filter((_, i) => i % 2 === 1);

        logger.info(
          'FORENSIC_QUEUE',
          `Evidence loaded for ${current.job.id}: ${evidence.snapshots?.length || 0} total snapshots, ${contextSnapshots.length} context frames, ${zoomSnapshots.length} zoom frames`
        );

        logger.info(
          'FORENSIC_QUEUE',
          `Processing job ${current.job.id} [Preset: ${current.job.auditPreset}]...`
        );

        // Call AI Service with immutable job data
        const { AIService } = await this.getAIService();

        // Create compatible track object for the service
        const compatibleTrack = {
          // Use string ID for validator compliance
          id: String(current.job.trackState.id),
          label: current.job.trackState.label,
          // Use 'box' array format [x, y, w, h] as expected by validator
          box: [
            current.job.trackState.bboxX,
            current.job.trackState.bboxY,
            current.job.trackState.bboxW,
            current.job.trackState.bboxH,
          ],
          // Keep bbox for compatibility with Track type
          bbox: {
            x: current.job.trackState.bboxX,
            y: current.job.trackState.bboxY,
            w: current.job.trackState.bboxW,
            h: current.job.trackState.bboxH,
          },
          avgVelocity: current.job.trackState.avgVelocity,
          velocityHistory: [...(current.job.trackState.velocityHistory || [])],
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

        // Run OCR and AI analysis in parallel for faster processing
        const rawOcrFrames = allZoomSnapshots.length ? allZoomSnapshots : zoomSnapshots;
        const ocrFrames =
          rawOcrFrames.length > this.maxOcrFrames
            ? rawOcrFrames.slice(-this.maxOcrFrames)
            : rawOcrFrames;
        const [ocrResult, auditResult] = await this.withTimeout(
          Promise.all([
            OCRSynchronizer.extractLicensePlate(ocrFrames),
            AIService.analyzeTrajectory(
              compatibleTrack,
              compatibleGeometry,
              current.job.directives,
              current.job.auditPreset
            ),
          ]),
          this.analysisTimeoutMs,
          'forensic_analysis'
        );

        plateOCR = ocrResult;

        // IMMEDIATE INFRACTION DETERMINATION: Geometric analysis (no AI needed)
        const geometricAnalysis = this.determineInfractionGeometric(
          current.job.trackState,
          current.job.geometryState,
          [...current.job.trackState.roiHistory] // Convert readonly to mutable array
        );

        // Use geometric analysis if confidence is high, otherwise fallback to AI
        let finalAuditResult = auditResult;
        if (geometricAnalysis.confidence > 0.95 && geometricAnalysis.infraction) {
          logger.info(
            'FORENSIC_QUEUE',
            `[INSTANT] Infracción determinada por geometría con confianza ${geometricAnalysis.confidence}: ${geometricAnalysis.ruleCategory}`
          );
          finalAuditResult = {
            ...auditResult,
            infraction: true,
            ruleCategory: geometricAnalysis.ruleCategory || auditResult.ruleCategory,
            severity: geometricAnalysis.severity || auditResult.severity,
            description: geometricAnalysis.description || auditResult.description,
          };
        } else if (geometricAnalysis.confidence > 0.8 && geometricAnalysis.infraction) {
          // Medium confidence: supplement AI result with geometric analysis
          logger.info(
            'FORENSIC_QUEUE',
            `[GEOMETRIC] Confirmando con geometría (conf ${geometricAnalysis.confidence}): ${geometricAnalysis.ruleCategory}`
          );
          if (!auditResult.infraction) {
            finalAuditResult = {
              ...auditResult,
              infraction: true,
              ruleCategory: geometricAnalysis.ruleCategory,
              severity: geometricAnalysis.severity,
            };
          }
        }

        // Legacy validation check para backward compatibility
        const isForbiddenTurnSequence =
          current.job.geometryState.violationKind === 'forbidden_turn_sequence' &&
          current.job.geometryState.roiSequenceIds &&
          matchesOrderedRoiSequence(
            [...current.job.trackState.roiHistory],
            [...current.job.geometryState.roiSequenceIds]
          );

        logger.info(
          'FORENSIC_QUEUE',
          `Validation check para job ${current.job.id}: violationKind=${current.job.geometryState.violationKind}, isForbiddenTurnSequence=${isForbiddenTurnSequence}`
        );

        // Apply forbidden turn override if needed (legacy, now covered by geometric analysis)
        if (isForbiddenTurnSequence && !finalAuditResult.ruleCategory?.includes('GIRO')) {
          logger.info(
            'FORENSIC_QUEUE',
            `Aplicando override de giro prohibido estricto para job ${current.job.id}`
          );
          const sequenceLabels = current.job.geometryState.roiSequenceLabels || ['ROI A', 'ROI B'];
          finalAuditResult.infraction = true;
          finalAuditResult.ruleCategory = 'GIRO_PROHIBIDO';
          finalAuditResult.description = `Giro prohibido confirmado por secuencia ordenada de zonas ${sequenceLabels.join(' -> ')}.`;
          finalAuditResult.reasoning = [
            `Secuencia ROI validada: ${sequenceLabels.join(' -> ')}.`,
            `Track #${current.job.trackState.id} mantuvo identidad persistente durante la maniobra.`,
            'La regla configurada establece que esta secuencia equivale a giro prohibido.',
          ];
          if (!finalAuditResult.severity || finalAuditResult.severity === 'LOW') {
            finalAuditResult.severity = 'HIGH';
          }
        }

        // Consistency guard: if geometry confirms forbidden turn, never keep contradictory AI narrative.
        if (
          isForbiddenTurnSequence ||
          (geometricAnalysis.infraction && geometricAnalysis.ruleCategory === 'GIRO_PROHIBIDO')
        ) {
          const sequenceLabels = current.job.geometryState.roiSequenceLabels || ['ROI A', 'ROI B'];
          finalAuditResult.infraction = true;
          finalAuditResult.ruleCategory = 'GIRO_PROHIBIDO';
          finalAuditResult.severity =
            geometricAnalysis.severity || finalAuditResult.severity || 'HIGH';
          finalAuditResult.description =
            geometricAnalysis.description ||
            `Giro prohibido confirmado por secuencia ROI ${sequenceLabels.join(' → ')}.`;
          finalAuditResult.reasoning = [
            `Secuencia ROI confirmada: ${sequenceLabels.join(' → ')}.`,
            `Track #${current.job.trackState.id} detectado en orden válido de zonas.`,
            'La validación geométrica prevalece sobre narrativa IA contradictoria.',
          ];
        }

        if (finalAuditResult.infraction) {
          current.currentStatus = 'completed';

          logger.success(
            'FORENSIC_QUEUE',
            `INFRACCIÓN CONFIRMADA - Job ${current.job.id} (${finalAuditResult.plate})`
          );

          // Get rule information to extract priority and sanctions
          const matchedRule = FORENSIC_RULES.find(
            (r) =>
              r.name === finalAuditResult.ruleCategory ||
              r.operativeCode === finalAuditResult.ruleCategory
          );
          const priority = matchedRule
            ? InfractionExclusionService.getCriticalityLevel(matchedRule.id)
            : 'MEDIA';
          const priorityLevel = matchedRule?.priority || 15;
          const operativeCode = matchedRule?.operativeCode || 'UNKNOWN';
          const fineAmount = matchedRule?.sanctions.fine_eur || 0;
          const pointsDeducted = matchedRule?.sanctions.points || 0;

          const infractionLog: InfractionLog = {
            ...finalAuditResult,
            id: Date.now(),
            plate:
              finalAuditResult.plate && finalAuditResult.plate !== 'DESCONOCIDO'
                ? finalAuditResult.plate
                : plateOCR.plate || 'DESCONOCIDO',
            image:
              allZoomSnapshots[allZoomSnapshots.length - 1] ||
              zoomSnapshots[zoomSnapshots.length - 1] ||
              evidence.snapshots[0],
            extraSnapshots: allContextSnapshots.length ? allContextSnapshots : contextSnapshots,
            zoomSnapshots: allZoomSnapshots.length ? allZoomSnapshots : zoomSnapshots,
            ocrResults: evidence.ocrResults,
            plateOcr: plateOCR.plate,
            plateOcrCandidates: plateOCR.candidates,
            videoClip: evidence.clip,
            time: new Date().toLocaleTimeString(),
            localTime: current.job.snapshot.localTime,
            videoTimeCode:
              finalAuditResult.videoTimeCode && !finalAuditResult.videoTimeCode.includes('??')
                ? finalAuditResult.videoTimeCode
                : current.job.snapshot.videoTimeCode,
            playbackTime: current.job.snapshot.playbackTime,
            viewerId: current.job.viewerId,
            // Priority and classification fields
            ruleId: matchedRule?.id,
            operativeCode,
            priority,
            priorityLevel,
            fineAmount,
            pointsDeducted,
          };

          // PHASE 3: Log evidence creation in custody log
          const evidenceHash = await calculateSHA256(new Blob([JSON.stringify(evidence)]));

          custodyLog.addEntry(
            CustodyLogService.logEvidenceAction(
              'EVIDENCE_CREATED',
              'OPERATOR_SYSTEM',
              current.job.id,
              new Blob([JSON.stringify(evidence)]).size,
              evidenceHash
            )
          );

          // PHASE 3: Log report generation
          custodyLog.addEntry(
            CustodyLogService.logReportAction(
              'REPORT_GENERATED',
              'OPERATOR_SYSTEM',
              String(infractionLog.id),
              {
                ruleCategory: finalAuditResult.ruleCategory,
                severity: finalAuditResult.severity,
                resultStatus: 'SUCCESS',
              }
            )
          );

          if (this.listeners.size > 0) {
            logger.info('FORENSIC_QUEUE', `✓ Emitting validated infraction for Job ${current.job.id}: ${infractionLog.plate}`);
            this.listeners.forEach((listener) => listener(infractionLog));
          }
        } else {
          current.currentStatus = 'cleared';

          logger.info('FORENSIC_QUEUE', `Job ${current.job.id}: NO INFRACTOR. Queue cleared.`);

          // PHASE 3: Log that no infraction was found
          custodyLog.addEntry(
            CustodyLogService.logReportAction(
              'REPORT_GENERATED',
              'OPERATOR_SYSTEM',
              current.job.id,
              { infraction: false, resultStatus: 'NO_VIOLATION' }
            )
          );
        }

        // Cleanup evidence
        await evidenceDB.deleteEvidence(current.job.id);

        // PHASE 3: Log evidence deletion
        custodyLog.addEntry(
          CustodyLogService.logEvidenceAction('EVIDENCE_DELETED', 'OPERATOR_SYSTEM', current.job.id)
        );

        // Save final state
        await this.saveQueueState();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isRecoverableAIError =
        errorMessage.includes('503') ||
        errorMessage.includes('high demand') ||
        errorMessage.includes('UNAVAILABLE') ||
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('timeout');

      if (isRecoverableAIError) {
        const requeued = this.requeueWithRetry(
          current,
          `Error temporal de IA (Sobrecarga) para ${current.job.id}. Reintentando (${current.retries + 1}/${this.maxRetries})... Detalle: ${errorMessage}`
        );

        if (!requeued) {
          current.currentStatus = 'failed';
          this.onEvent?.({
            type: 'job_failed',
            message: `Fallo definitivo en auditoría forense para ${current.job.id} tras máximos reintentos por sobrecarga de IA.`,
            jobId: current.job.id,
          });

          logger.error(
            'FORENSIC_QUEUE',
            `Job ${current.job.id} failed definitively after max retries: ${errorMessage}`,
            error
          );

          // Create fallback audit log for manual review
          await this.createAndEmitFallbackAuditLog(
            current,
            evidence,
            plateOCR,
            contextSnapshots,
            zoomSnapshots,
            `Fallo después de ${this.maxRetries} reintentos: ${errorMessage}`
          );
        }
      } else {
        current.currentStatus = 'failed';
        this.onEvent?.({
          type: 'job_failed',
          message: `Fallo en auditoría forense para ${current.job.id}: ${errorMessage}`,
          jobId: current.job.id,
        });

        logger.error('FORENSIC_QUEUE', `Job ${current.job.id} failed: ${errorMessage}`, error);

        // Create fallback audit log for manual review (non-recoverable error)
        await this.createAndEmitFallbackAuditLog(
          current,
          evidence,
          plateOCR,
          contextSnapshots,
          zoomSnapshots,
          `Error no recuperable: ${errorMessage}`
        );
      }
    }

    this.isProcessing = false;
    this.resolveIdleIfNeeded();

    // Calculate appropriate delay based on whether this is a retry
    let nextDelay = 0;
    if (current.currentStatus === 'pending' && current.nextRetryAt) {
      // For retries, respect the exponential backoff delay
      const now = Date.now();
      nextDelay = Math.max(0, current.nextRetryAt - now);
    } else if (current.currentStatus === 'pending') {
      // For regular pending (non-retry), small cooldown
      nextDelay = 100;
    }

    if (nextDelay > 0) {
      setTimeout(() => this.processNext(), nextDelay);
    } else {
      // No delay needed, process immediately
      this.processNext();
    }
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

  /**
   * Creates a fallback audit log entry when AI analysis fails permanently.
   * This allows manual review of the evidence without automatic determination.
   */
  private async createAndEmitFallbackAuditLog(
    current: QueueItem,
    evidence: any,
    plateOCR: any,
    contextSnapshots: string[],
    zoomSnapshots: string[],
    failureReason: string
  ): Promise<void> {
    try {
      // IMPORTANT: Do NOT emit fallback as infraction log
      // Only emit when analysis is successful (line 637)
      // This prevents creation of duplicate expedients

      // Log the failure for audit purposes only
      logger.auditLog('FORENSIC_FAILURE', `/forensic/job/${current.job.id}/analysis-failed`, 400, {
        reason: failureReason.substring(0, 200),
        retries: current.retries,
        maxRetries: this.maxRetries,
        plate: plateOCR?.plate || 'UNKNOWN',
      });

      logger.warn(
        'FORENSIC_QUEUE',
        `Job ${current.job.id} analysis failed after ${current.retries} retries: ${failureReason.substring(0, 100)}`
      );

      // Cleanup evidence after creating fallback log
      await evidenceDB.deleteEvidence(current.job.id);
      await this.saveQueueState();
    } catch (fallbackError) {
      logger.error(
        'FORENSIC_QUEUE',
        `Error creando registro de revisión manual para ${current.job.id}: ${fallbackError}`,
        fallbackError
      );
    }
  }

  /**
   * Calculate exponential backoff delay: baseDelay * (2 ^ retryCount)
   * Max delay capped at 30 seconds
   */
  private calculateBackoffDelay(retries: number): number {
    const exponentialDelay = this.baseRetryDelayMs * Math.pow(2, retries);
    const maxDelay = 30000; // 30 seconds
    return Math.min(exponentialDelay, maxDelay);
  }

  private requeueWithRetry(item: QueueItem, message: string): boolean {
    if (item.retries >= this.maxRetries) {
      return false;
    }

    item.retries += 1;
    item.lastRetryAt = Date.now();

    // Calculate exponential backoff delay
    const backoffDelay = this.calculateBackoffDelay(item.retries - 1);
    item.nextRetryAt = Date.now() + backoffDelay;
    item.currentStatus = 'pending';

    // Log detailed retry information
    const logMessage = `${message} [Backoff: ${backoffDelay}ms, Attempt: ${item.retries}/${this.maxRetries}]`;
    logger.warn('FORENSIC_QUEUE', logMessage);

    // Audit logging for retry attempt
    logger.auditLog('RETRY', `/forensic/job/${item.job.id}`, 202, {
      retryCount: item.retries,
      maxRetries: this.maxRetries,
      backoffDelayMs: backoffDelay,
      nextRetryAt: new Date(item.nextRetryAt).toISOString(),
      reason: message.substring(0, 100), // Truncate for audit log
    });

    this.queue.push(item);
    this.saveQueueState();

    this.onEvent?.({
      type: 'retry',
      message: logMessage,
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
    this.saveQueueState();
  }

  /**
   * Cleanup expired/old jobs from persistence (called periodically)
   */
  async cleanupExpiredJobs(): Promise<number> {
    try {
      const deletedCount = await forensicQueuePersistence.cleanupExpiredJobs();
      if (deletedCount > 0) {
        logger.info(
          'FORENSIC_QUEUE',
          `Limpiados ${deletedCount} trabajos expirados de persistencia`
        );
      }
      return deletedCount;
    } catch (error) {
      logger.warn(
        'FORENSIC_QUEUE',
        `Error limpiando trabajos expirados: ${error instanceof Error ? error.message : String(error)}`
      );
      return 0;
    }
  }

  /**
   * Get queue statistics for monitoring and diagnostics
   */
  getQueueStats() {
    const pendingJobs = this.queue.filter((item) => item.currentStatus === 'pending').length;
    const processingJobs = this.queue.filter((item) => item.currentStatus === 'processing').length;
    const totalRetries = this.queue.reduce((sum, item) => sum + item.retries, 0);
    const avgRetries =
      this.queue.length > 0 ? Math.round((totalRetries / this.queue.length) * 10) / 10 : 0;

    return {
      totalJobs: this.queue.length,
      pendingJobs,
      processingJobs,
      maxQueueSize: this.maxQueueSize,
      queueUtilization: Math.round((this.queue.length / this.maxQueueSize) * 100),
      totalRetries,
      avgRetries,
      listeners: this.listeners.size,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Determine infraction type and severity based on GEOMETRY ONLY (no AI needed).
   * Returns immediately (<50ms) with high confidence for geometric violations.
   * This enables immediate infraction determination without waiting for Gemini AI.
   */
  private determineInfractionGeometric(
    trackState: any,
    geometryState: any,
    roiHistory: any[]
  ): {
    infraction: boolean;
    ruleCategory?: string;
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    confidence: number;
    description?: string;
  } {
    // Check for forbidden turn sequence (highest confidence)
    if (
      geometryState.violationKind === 'forbidden_turn_sequence' &&
      geometryState.roiSequenceIds &&
      matchesOrderedRoiSequence([...roiHistory], [...geometryState.roiSequenceIds])
    ) {
      // PHASE 5: Enhanced forbidden turn detection with multiple criteria
      const turnCriteria = {
        followsSequence: matchesOrderedRoiSequence(
          [...roiHistory],
          [...geometryState.roiSequenceIds]
        ),
        // Check: spent significant time in middle zone (not just skipped it)
        durationConsistent: true, // TODO: compare timeInROI['mid'] > 200ms
        // Check: significant direction change (heading delta > 45°)
        angleChange:
          Math.abs((trackState.heading || 0) - (trackState.heading || 0)) > Math.PI * 0.25,
        // Check: not stationary (speed > 2 Km/h during turn)
        notStationary: (trackState.velocity || 0) > 2 || (trackState.avgVelocity || 0) > 2,
      };

      const isValidTurn =
        turnCriteria.followsSequence &&
        turnCriteria.durationConsistent &&
        turnCriteria.notStationary;

      if (isValidTurn) {
        return {
          infraction: true,
          ruleCategory: 'GIRO_PROHIBIDO',
          severity: 'HIGH',
          confidence: 0.95, // Slightly reduced for robustness
          description: `Giro prohibido confirmado: secuencia ${geometryState.roiSequenceLabels?.join(' → ') || 'ROI A → ROI B'}, velocidad ${(trackState.avgVelocity || 0).toFixed(1)} Km/h, ángulo ${((Math.abs(trackState.heading || 0) * 180) / Math.PI).toFixed(0)}°.`,
        };
      }

      return {
        infraction: false,
        confidence: 0.0,
      };
    }

    // Check for line crossing
    if (geometryState.violationKind === 'line_crossing') {
      return {
        infraction: true,
        ruleCategory: 'CAMBIO_DE_CARRIL',
        severity: 'MEDIUM',
        confidence: 0.9,
        description: 'Cambio de carril detectado por cruce de línea geométrica.',
      };
    }

    // Check for stop violation (vehicle stopped in restricted zone)
    if (geometryState.violationKind === 'stop_violation') {
      // PHASE 5: Improved STOP detection with multiple criteria
      const stopCriteria = {
        crossedStopLine: trackState.roiHistory?.some((r) => r.includes('stop')),
        failedToStop: (trackState.dwellTime || 0) < 500, // Didn't pause >= 500ms before crossing
        speedAtCrossing: (trackState.velocity || 0) > 2.0, // > 2.0 units/frame at crossing
        notARoll: (trackState.dwellTime || 0) === 0 && (trackState.velocity || 0) > 1.5,
      };

      const isViolation =
        stopCriteria.crossedStopLine && stopCriteria.failedToStop && stopCriteria.speedAtCrossing;

      if (isViolation) {
        return {
          infraction: true,
          ruleCategory: 'INCUMPLIMIENTO_PARADA',
          severity: 'MEDIUM',
          confidence: 0.9, // Higher confidence with multiple criteria
          description: `Incumplimiento de parada: velocidad ${(trackState.velocity * 23 * 3.6).toFixed(1)} Km/h, parada ${trackState.dwellTime || 0}ms.`,
        };
      }

      // PHASE 5: If any criteria failed, it might be a valid stop
      return {
        infraction: false,
        confidence: 0.0,
      };
    }

    // Check for zone dwell (extended time in restricted zone)
    if (geometryState.violationKind === 'zone_dwell' && trackState.dwellTime > 30000) {
      // 30+ seconds in zone
      return {
        infraction: true,
        ruleCategory: 'ESTACIONAMIENTO_PROHIBIDO',
        severity: 'MEDIUM',
        confidence: 0.8,
        description: `Vehículo detenido en zona prohibida durante ${Math.round(trackState.dwellTime / 1000)}s.`,
      };
    }

    // No geometric infraction detected
    return {
      infraction: false,
      confidence: 0.0,
    };
  }
}

export const forensicQueueV3 = new ForensicQueueV3();

/**
 * Periodic maintenance task: cleanup expired jobs every 5 minutes
 * This prevents the queue from growing indefinitely
 */
if (typeof window !== 'undefined') {
  setInterval(
    async () => {
      try {
        await forensicQueueV3.cleanupExpiredJobs();
      } catch (error) {
        console.warn(
          '[FORENSIC_QUEUE] Error during cleanup:',
          error instanceof Error ? error.message : String(error)
        );
      }
    },
    5 * 60 * 1000
  ); // 5 minutes
}
