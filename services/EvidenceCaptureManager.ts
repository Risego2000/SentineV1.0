/**
 * Evidence Capture System - Two-phase ROI forbidden-turn support.
 * Phase 1 (ROI A): start 30s circular buffer + capture ROI_A photos.
 * Phase 2 (ROI B): capture ROI_B photos + mid-path photos, then finalize.
 * If ROI B never comes: discard (buffer is overwritten by next activation).
 */

import { evidenceDB } from '../services/EvidenceDB';
import { VideoBufferService } from '../services/videoRecorder';
import { forensicQueue } from '../services/ForensicQueue';
import { OCRSynchronizer } from '../services/OCRSynchronizer';
import { getOCRService } from '../services/OCRService';
import { Track, GeometryLine } from '../types';
import { ForensicRule } from '../types/forensicRules';
import { custodyLog, CustodyLogService } from './CustodyLogService';
import { calculateSHA256 } from './ChainOfCustodyService';
import { getApiUrl } from './apiConfig';
import { capturePerfMonitor } from './capturePerfMonitor';
import { SnapshotCaptureWorkerClient } from './snapshotCaptureWorkerClient';

export interface EvidenceCaptureTarget {
  trackId: number;
  geometryId: string;
  ruleId?: string;
  startedAt: number;
  frameCount: number;
  recordingActivated: boolean;
  infractionConfirmed?: boolean;
}

export interface CapturePolicy {
  maxSimultaneous: number;
  priorityMode: 'first' | 'highest_velocity' | 'closest_to_exit';
  autoAbortOnExit: boolean;
}

const DEFAULT_POLICY: CapturePolicy = {
  maxSimultaneous: 3,
  priorityMode: 'first',
  autoAbortOnExit: true,
};

/** Semantic snapshot labels for the forbidden-turn evidence package */
type SnapshotLabel = 'entry' | 'mid' | 'exit' | 'roi_a' | 'roi_b';

interface SnapshotEntry {
  label: SnapshotLabel;
  kind: 'general' | 'detail';
  data: string; // base64 JPEG
}

export class EvidenceCaptureManager {
  // ROI flow controls (kept enabled by requirement).
  private readonly enableLiveRoiClip = true;
  private readonly enableMidSnapshots = true;
  private readonly targetGeneralSnapshots = 3;
  private readonly targetDetailSnapshots = 6;
  private readonly maxSnapshotsPerTrack = 36;
  private readonly droppedTrackGraceMs = 20000;
  private readonly midCaptureIntervalMs = 3200;
  private readonly finalizeMidEnsureTimeoutMs = 2800;
  private targets: Map<string, EvidenceCaptureTarget> = new Map();
  private recorders: Map<string, VideoBufferService> = new Map();
  private snapshotStorage: Map<string, SnapshotEntry[]> = new Map();
  private pendingSnapshotLabels: Map<string, Set<SnapshotLabel>> = new Map();
  private lastMidCaptureAt: Map<string, number> = new Map();
  private midCaptureInFlightKeys: Set<string> = new Set();
  private snapshotWorker: SnapshotCaptureWorkerClient | null = null;
  private orphanedSince: Map<string, number> = new Map();
  private snapshotCanvas: HTMLCanvasElement | null = null;
  private readonly snapshotWarnThresholdMs = 35;
  private policy: CapturePolicy;
  private onBufferUpdate?: (targetId: string, seconds: number) => void;
  private onProgressUpdate?: (
    targetId: string,
    progress: { capturedPhotos: number; plateCandidate?: string }
  ) => void;

  private pickSpreadFrames<T>(items: T[], limit: number): T[] {
    if (items.length <= limit) return [...items];
    const out: T[] = [];
    for (let i = 0; i < limit; i++) {
      const idx = Math.round((i * (items.length - 1)) / Math.max(1, limit - 1));
      out.push(items[idx]);
    }
    return out;
  }

  constructor(policy: Partial<CapturePolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
    try {
      this.snapshotWorker = new SnapshotCaptureWorkerClient();
    } catch {
      this.snapshotWorker = null;
    }
  }

  setPolicy(policy: Partial<CapturePolicy>) {
    this.policy = { ...this.policy, ...policy };
  }

  setBufferCallback(callback: (targetId: string, seconds: number) => void) {
    this.onBufferUpdate = callback;
  }

  setProgressCallback(
    callback: (targetId: string, progress: { capturedPhotos: number; plateCandidate?: string }) => void
  ) {
    this.onProgressUpdate = callback;
  }

  private scheduleSnapshot(task: () => void): void {
    // requestIdleCallback may defer too much or run heavy work in long idle slices.
    // We prefer a short async hop to keep ROI crossing responsive.
    window.setTimeout(task, 32);
  }

  private canvasToBase64Jpeg(
    canvas: HTMLCanvasElement,
    quality: number,
    maxBytes = 350_000
  ): Promise<string> {
    return new Promise((resolve) => {
      const finalize = (data: string) => resolve(data.split(',')[1] || '');
      const fallback = () => finalize(canvas.toDataURL('image/jpeg', quality));

      try {
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              fallback();
              return;
            }

            try {
              if (blob.size <= maxBytes) {
                const reader = new FileReader();
                reader.onloadend = () => finalize(String(reader.result || ''));
                reader.readAsDataURL(blob);
                return;
              }

              // Oversized image: reduce quality one step to keep per-frame payload bounded.
              canvas.toBlob(
                (smallerBlob) => {
                  if (!smallerBlob) {
                    fallback();
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => finalize(String(reader.result || ''));
                  reader.readAsDataURL(smallerBlob);
                },
                'image/jpeg',
                Math.max(0.68, quality - 0.12)
              );
            } catch {
              fallback();
            }
          },
          'image/jpeg',
          quality
        );
      } catch {
        fallback();
      }
    });
  }

  /**
   * Check if a track should be captured based on policy.
   */
  shouldCapture(trackId: number, geometryId: string): boolean {
    // Never open parallel capture sessions for the same track.
    if (this.findTarget(trackId)) return false;
    const key = this.getTargetKey(trackId, geometryId);
    if (this.targets.has(key)) return false;
    if (this.targets.size >= this.policy.maxSimultaneous) return false;
    return true;
  }

  // ─────────────────────────────────────────────────────────────────
  // TWO-PHASE TURN CAPTURE
  // ─────────────────────────────────────────────────────────────────

  /**
   * PHASE 1 — ROI A entry.
   * Starts the 30s circular buffer and captures FOTO_GENERAL_ROI_A + FOTO_DETALLE_ROI_A.
   * Does NOT set track.audited so ROI B can still be detected.
   */
  startTurnCapture(
    track: Track,
    roiALine: GeometryLine,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    frameCount: number
  ): string | null {
    if (this.findTarget(track.id)) return null;
    const key = this.getTargetKey(track.id, roiALine.id);

    // If already capturing for this track+geometry, skip
    if (this.targets.has(key)) return null;

    // Evict oldest pending (discard) if at max — the buffer overwrites
    if (this.targets.size >= this.policy.maxSimultaneous) {
      const oldestKey = [...this.targets.keys()][0];
      this.cleanup(oldestKey);
    }

    const target: EvidenceCaptureTarget = {
      trackId: track.id,
      geometryId: roiALine.id,
      startedAt: Date.now(),
      frameCount,
      recordingActivated: true,
      infractionConfirmed: false,
    };
    this.targets.set(key, target);

    // Iniciar buffer basado en ROI: inicia en ROI A
    const recorder = new VideoBufferService(canvas, 'roi_based');
    recorder.setBufferCallback((seconds) => this.onBufferUpdate?.(key, seconds));
    recorder.start();
    this.recorders.set(key, recorder);

    // Do not capture at ROI A. Entry capture is taken later in the path (post-ROI A).

    return key;
  }

  /**
   * Mid-path capture — between ROI A and ROI B.
   * Captures FOTO_GENERAL_DESARROLLO + FOTO_DETALLE_DESARROLLO.
   */
  captureMidTurn(track: Track, video: HTMLVideoElement): void {
    if (!this.enableMidSnapshots) return;
    const target = this.findTarget(track.id);
    if (!target) return;
    if (this.midCaptureInFlightKeys.has(target.key)) return;
    const storage = this.snapshotStorage.get(target.key) || [];
    if (storage.length >= this.maxSnapshotsPerTrack) return;
    const midGeneralCount = storage.filter((s) => s.label === 'mid' && s.kind === 'general').length;
    const midDetailCount = storage.filter((s) => s.label === 'mid' && s.kind === 'detail').length;
    if (this.isSnapshotPending(target.key, 'mid')) return;
    const now = Date.now();
    const lastAt = this.lastMidCaptureAt.get(target.key) || 0;
    if (now - lastAt < this.midCaptureIntervalMs) return;
    this.lastMidCaptureAt.set(target.key, now);
    this.scheduleSnapshot(() => this.captureNamedSnapshot(video, track, 'mid', target.key));
  }

  /**
   * PHASE 2 — ROI B entry (infraction confirmed).
   * Captures FOTO_GENERAL_ROI_B + FOTO_DETALLE_ROI_B.
   */
  captureRoiB(track: Track, roiBLine: GeometryLine, video: HTMLVideoElement): void {
    const target = this.findTarget(track.id);
    if (!target) return;
    this.targets.set(target.key, { ...target, infractionConfirmed: true });

    // Exit moment (at ROI B crossing).
    if (!this.isSnapshotPending(target.key, 'exit') && !this.hasLabelCapture(target.key, 'exit')) {
      this.scheduleSnapshot(() => this.captureNamedSnapshot(video, track, 'exit', target.key));
    }

    // Seguimos grabando/capturando hasta finalización o salida de escena.
  }

  /**
   * Discard a pending turn capture (ROI A only, no ROI B).
   * The buffer is overwritten by the next activation.
   */
  discardTurnCapture(trackId: number, reason: string): void {
    const target = this.findTarget(trackId);
    if (!target) return;
    this.cleanup(target.key);
  }

  /**
   * Finalize a confirmed forbidden-turn infraction and enqueue for audit.
   */
  async finalizeTurnCapture(
    track: Track,
    geometry: GeometryLine,
    video: HTMLVideoElement,
    viewerId?: string
  ): Promise<void> {
    const target = this.findTarget(track.id);
    if (!target) return;

    const key = target.key;

    try {
      // Apply ALPR/OCR/audit only to tracks that activated recording via ROI A.
      if (!target.recordingActivated) {
        this.cleanup(key);
        return;
      }

      // Ensure the three required moments exist: entry, mid, exit.
      if (this.enableMidSnapshots) {
        await this.ensureMidMoments(video, track, key);
      }

      const recorder = this.recorders.get(key);
      if (recorder) {
        recorder.stopWithMinDuration(30);
      }
      if (recorder) {
        await recorder.waitUntilStopped(35_000);
      }
      const clip =
        this.enableLiveRoiClip && recorder
          ? await recorder.getClip()
          : undefined;

      const snapshots = this.snapshotStorage.get(key) || [];

      // PHASE 6: Run robust OCR with adaptive high-resolution frame collection.
      const detailFrames = snapshots.filter((s) => s.kind === 'detail').map((s) => s.data);
      const generalFrames = snapshots.filter((s) => s.kind === 'general').map((s) => s.data);

      // Feed OCR with all captured frames (detail + context).
      const sampledDetail = this.pickSpreadFrames(detailFrames, 10);
      const sampledGeneral = this.pickSpreadFrames(generalFrames, 3);
      const ocrInputFrames = [...sampledDetail, ...sampledGeneral];

      let ocrResults: string[] = [];
      let ocrCandidates: any[] = [];
      let ocrValidationReport = '';

      if (ocrInputFrames.length > 0) {
        try {
          // Use OCRService with validation and multi-frame support
          const ocrService = getOCRService();
          const ocrResult =
            await ocrService.extractFromMultipleFramesWithPlateCrops(ocrInputFrames);

          if (ocrResult.plate) {
            ocrResults = [ocrResult.plate];
            this.onProgressUpdate?.(key, {
              capturedPhotos: snapshots.length,
              plateCandidate: ocrResult.plate,
            });
          } else {
            const deep = await ocrService.extractPlateDeepFallback(ocrInputFrames);
            if (deep.plate) {
              ocrResults = [deep.plate];
              this.onProgressUpdate?.(key, {
                capturedPhotos: snapshots.length,
                plateCandidate: deep.plate,
              });
              ocrValidationReport =
                (ocrValidationReport ? `${ocrValidationReport}\n` : '') +
                `[DEEP_FALLBACK] Plate recovered: ${deep.plate} (${(deep.confidence * 100).toFixed(1)}%) via ${deep.method}.`;
            }
          }

          // PHASE 6: Store all candidates + validation results for forensic review
          ocrCandidates = ocrResult.candidates.map((c) => ({
            text: c.text,
            confidence: c.confidence,
            frame: c.frame,
            isValid: c.validation.isValid,
            format: c.validation.format,
            validationReasons: c.validation.reasons,
            selected: c.selected,
            reason: c.reason,
          }));

          ocrValidationReport = ocrResult.validationReport;

          console.log(
            `[PHASE 6 OCR] Plate: ${ocrResult.plate || 'NOT_FOUND'} | Candidates: ${ocrResult.candidates.length} | Confidence: ${(ocrResult.confidence * 100).toFixed(1)}% | Processing: ${ocrResult.processingTimeMs.toFixed(0)}ms`
          );
        } catch (err) {
          console.warn('[PHASE 6 OCR] License plate extraction failed:', err);
          ocrValidationReport = `Extraction error: ${err instanceof Error ? err.message : 'Unknown error'}`;
        }
      }

      let videoTimeCode = null;
      // Try server-side timestamp extraction first
      // Use GENERAL frame (1920x1080) instead of detail frame for better OSD visibility
      if (generalFrames.length > 0) {
        try {
          const response = await fetch(getApiUrl('/api/ocr/timestamp'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: generalFrames[0] }),
          });
          const result = await response.json();
          // Use timestamp field (Gemini returns this), fallback to osdText
          if (result && (result.timestamp || result.osdText)) {
            videoTimeCode = result.timestamp || result.osdText;
          }
        } catch (err) {
          console.warn('[Timestamp] Server-side extraction failed:', err);
        }
      }

      // Fallback to local extraction if server failed
      if (!videoTimeCode) {
        videoTimeCode = await OCRSynchronizer.extractTimecode(video);
      }

      const localTime = new Date().toLocaleString();

      // Refresh snapshots in case adaptive capture added more frames.
      const persisted = this.snapshotStorage.get(key) || snapshots;
      const finalSnapshots = persisted.slice(0, this.maxSnapshotsPerTrack);

      // OPTIMIZACIÓN: Iniciar OCR/análisis EN PARALELO sin bloquear captura
      // Esto reduce cuello de botella entre detección y análisis
      this.initiateParallelAnalysis(key, video, finalSnapshots).catch((err) => {
        console.warn('[PARALLEL_ANALYSIS] Background analysis failed:', err);
      });

      // PHASE 6: Persist evidence with hashing + OCR candidates
      const evidenceId = key;
      const contextSnapshots = finalSnapshots
        .filter((s) => s.kind === 'general')
        .map((s) => s.data);
      const zoomSnapshots = finalSnapshots.filter((s) => s.kind === 'detail').map((s) => s.data);

      // Calculate SHA-256 hashes for forensic preservation
      const contextBlob = new Blob([JSON.stringify(contextSnapshots)]);
      const zoomBlob = new Blob([JSON.stringify(zoomSnapshots)]);
      const contextHash = await calculateSHA256(contextBlob);
      const zoomHash = await calculateSHA256(zoomBlob);

      const evidenceData = {
        snapshots: finalSnapshots.map((s) => s.data),
        contextSnapshots,
        contextHash,
        zoomSnapshots,
        zoomHash,
        ocrResults,
        ocrCandidates, // PHASE 6: All OCR candidates + validation
        ocrValidationReport, // PHASE 6: Full validation report
        clip,
      };

      console.log(
        `[PHASE 6 CAPTURE] Finalized for Track #${track.id}: ${finalSnapshots.length} snapshots (${contextSnapshots.length} context, ${zoomSnapshots.length} detail) | OCR: ${ocrResults.length} plate(s) | Hash: ${zoomHash.substring(0, 8)}...`
      );

      await evidenceDB.saveEvidence(evidenceId, evidenceData);

      // PHASE 3/6: Log evidence access with SHA-256 hashes
      const evidenceBlob = new Blob([JSON.stringify(evidenceData)]);
      const evidenceHash = await calculateSHA256(evidenceBlob);
      custodyLog.addEntry(
        CustodyLogService.logEvidenceAction(
          'EVIDENCE_ACCESSED',
          'OPERATOR_SYSTEM',
          evidenceId,
          evidenceBlob.size,
          evidenceHash
        )
      );

      // Log additional evidence metrics to console for audit trail
      console.log(
        `[EVIDENCE AUDIT] Track #${evidenceId}: contextHash=${contextHash.substring(0, 8)}..., zoomHash=${zoomHash.substring(0, 8)}..., plate=${ocrResults[0] || 'NOT_EXTRACTED'}, candidates=${ocrCandidates.length}`
      );

      forensicQueue.enqueueJob(
        { ...track, isAnomalous: !!track.isAnomalous } as any,
        geometry,
        evidenceId,
        localTime,
        videoTimeCode,
        video.currentTime,
        viewerId
      );
    } finally {
      this.cleanup(key);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // LEGACY SINGLE-PHASE CAPTURE (for roi_general and line crossings)
  // ─────────────────────────────────────────────────────────────────

  startCapture(
    track: Track,
    geometry: GeometryLine,
    rule: ForensicRule | undefined,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    frameCount: number
  ): string | null {
    const key = this.getTargetKey(track.id, geometry.id);
    if (!this.shouldCapture(track.id, geometry.id)) return null;

    const target: EvidenceCaptureTarget = {
      trackId: track.id,
      geometryId: geometry.id,
      ruleId: rule?.id,
      startedAt: Date.now(),
      frameCount,
      recordingActivated: false,
    };
    this.targets.set(key, target);

    const recorder = new VideoBufferService(canvas);
    recorder.setBufferCallback((seconds) => this.onBufferUpdate?.(key, seconds));
    recorder.start();
    this.recorders.set(key, recorder);

    this.scheduleSnapshot(() => this.captureNamedSnapshot(video, track, 'roi_a', key));
    return key;
  }

  captureMidIfNeeded(
    track: Track,
    video: HTMLVideoElement,
    _midPointFrame: number,
    frameCount: number
  ): void {
    if (!this.enableMidSnapshots) return;
    const target = this.findTarget(track.id);
    if (!target) return;
    if (this.midCaptureInFlightKeys.has(target.key)) return;
    const elapsed = frameCount - target.frameCount;
    const storage = this.snapshotStorage.get(target.key) || [];
    const midGeneralCount = storage.filter((s) => s.label === 'mid' && s.kind === 'general').length;
    const midDetailCount = storage.filter((s) => s.label === 'mid' && s.kind === 'detail').length;
    if (
      elapsed >= 30 &&
      (midGeneralCount < this.targetGeneralSnapshots - 1 || midDetailCount < this.targetDetailSnapshots - 2)
    ) {
      if (this.isSnapshotPending(target.key, 'mid')) return;
      const now = Date.now();
      const lastAt = this.lastMidCaptureAt.get(target.key) || 0;
      if (now - lastAt < this.midCaptureIntervalMs) return;
      this.lastMidCaptureAt.set(target.key, now);
      this.scheduleSnapshot(() => this.captureNamedSnapshot(video, track, 'mid', target.key));
    }
  }

  async finalizeCapture(
    track: Track,
    geometry: GeometryLine,
    video: HTMLVideoElement,
    viewerId?: string
  ): Promise<void> {
    return this.finalizeTurnCapture(track, geometry, video, viewerId);
  }

  abortCapture(trackId: number, reason: string): void {
    this.discardTurnCapture(trackId, reason);
  }

  abortAll(reason: string): void {
    for (const target of this.targets.values()) {
      console.warn(`[CAPTURE] Aborted Track #${target.trackId}: ${reason}`);
    }
    this.clear();
  }

  /**
   * Cleans up targets for tracks that have been dropped by the tracker.
   */
  syncActiveTracks(activeTrackIds: Set<number>): void {
    const now = Date.now();
    for (const [key, target] of this.targets.entries()) {
      if (activeTrackIds.has(target.trackId)) {
        this.orphanedSince.delete(key);
        continue;
      }

      const orphanedAt = this.orphanedSince.get(key) ?? now;
      this.orphanedSince.set(key, orphanedAt);

      const targetRecorder = this.recorders.get(key);
      const hasActiveRecorder = !!targetRecorder;
      const graceMs = hasActiveRecorder ? Math.max(this.droppedTrackGraceMs, 30000) : this.droppedTrackGraceMs;
      if (now - orphanedAt >= graceMs) {
        if (target.infractionConfirmed && now - orphanedAt < 60_000) {
          continue;
        }
        console.warn(`[CAPTURE] Aborted dropped Track #${target.trackId} after grace period`);
        this.cleanup(key);
      }
    }
  }

  getActiveCount(): number {
    return this.targets.size;
  }

  isCapturing(trackId: number): boolean {
    return this.findTarget(trackId) !== null;
  }

  getBufferSeconds(targetId: string): number {
    return this.recorders.get(targetId)?.getBufferSeconds() || 0;
  }

  getSnapshotCount(trackId: number): number {
    const target = this.findTarget(trackId);
    if (!target) return 0;
    return this.snapshotStorage.get(target.key)?.length || 0;
  }

  /**
   * OPTIMIZACIÓN: Inicia OCR + análisis Gemini EN PARALELO sin bloquear captura
   * Reduce cuello de botella entre detección y análisis
   * Fire-and-forget: no espera completar
   */
  async initiateParallelAnalysis(
    key: string,
    video: HTMLVideoElement,
    snapshots: SnapshotRecord[]
  ): Promise<void> {
    try {
      const generalFrames = snapshots.filter((s) => s.kind === 'general').map((s) => s.data);
      if (generalFrames.length === 0) return;

      // Paralelizar: OCR + Timestamp en paralelo
      const [ocrResult, timecode] = await Promise.all([
        (async () => {
          try {
            return await OCRSynchronizer.extractLicensePlate([generalFrames[0]]);
          } catch (err) {
            console.warn('[PARALLEL_OCR] Failed:', err);
            return null;
          }
        })(),
        (async () => {
          try {
            const response = await fetch(getApiUrl('/api/ocr/timestamp'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: generalFrames[0] }),
            });
            const result = await response.json();
            return result?.timestamp || result?.osdText || null;
          } catch (err) {
            console.warn('[PARALLEL_TIMECODE] Failed:', err);
            return null;
          }
        })(),
      ]);

      if (ocrResult?.plate) {
        console.log(`[PARALLEL_ANALYSIS] OCR completed: ${ocrResult.plate} (${(ocrResult.confidence * 100).toFixed(1)}%)`);
      }
      if (timecode) {
        console.log(`[PARALLEL_ANALYSIS] Timecode extracted: ${timecode}`);
      }
    } catch (error) {
      console.warn('[PARALLEL_ANALYSIS] Unexpected error:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // PRIVATE
  // ─────────────────────────────────────────────────────────────────

  private getTargetKey(trackId: number, geometryId: string): string {
    return `${trackId}_${geometryId}`;
  }

  private findTarget(trackId: number): (EvidenceCaptureTarget & { key: string }) | null {
    for (const [key, target] of this.targets) {
      if (target.trackId === trackId) return { ...target, key };
    }
    return null;
  }

  /**
   * Capture a named snapshot pair: general (full scene) + detail (vehicle crop).
   * Both are 1920×1080 high-quality JPEG.
   */
  private async captureNamedSnapshot(
    video: HTMLVideoElement,
    track: Track,
    label: SnapshotLabel,
    targetKey: string
  ): Promise<void> {
    if (!video || video.readyState < 2) return;
    if (label !== 'mid' && label !== 'exit' && this.hasLabelCapture(targetKey, label)) return;
    if (label === 'mid' && this.midCaptureInFlightKeys.has(targetKey)) return;
    if (label === 'mid') this.midCaptureInFlightKeys.add(targetKey);
    this.markSnapshotPending(targetKey, label, true);

    if (!this.snapshotCanvas) {
      this.snapshotCanvas = document.createElement('canvas');
    }
    const canvas = this.snapshotCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const startedAt = performance.now();
      const isMid = label === 'mid';
      const storage = this.snapshotStorage.get(targetKey) || [];
      const midGeneralCount = storage.filter((s) => s.label === 'mid' && s.kind === 'general').length;
      const midDetailCount = storage.filter((s) => s.label === 'mid' && s.kind === 'detail').length;
      const exitDetailCount = storage.filter((s) => s.label === 'exit' && s.kind === 'detail').length;
      const remainingBudget = Math.max(0, this.maxSnapshotsPerTrack - storage.length);
      const shouldCaptureGeneral = isMid
        ? remainingBudget > 0 && midGeneralCount < this.targetGeneralSnapshots
        : !this.hasLabelCapture(targetKey, label);
      const shouldCaptureDetail = isMid
        ? remainingBudget > 0 && midDetailCount < this.targetDetailSnapshots
        : label === 'exit'
          ? exitDetailCount < 2
          : !this.hasLabelCapture(targetKey, label);
      if (!shouldCaptureGeneral && !shouldCaptureDetail) return;

      let generalMs = 0;
      const highQualityMid = isMid && midDetailCount < 1;

      // General frame (for MID only first 3 captures, as requested).
      if (shouldCaptureGeneral) {
        const gW = 960;
        const gH = 540;
        canvas.width = gW;
        canvas.height = gH;
        const generalStart = performance.now();
        ctx.drawImage(video, 0, 0, gW, gH);
        const generalData = await this.canvasToBase64Jpeg(canvas, 0.86, 220_000);
        generalMs = performance.now() - generalStart;
        storage.push({ label, kind: 'general', data: generalData });
      }

      // Detail frame — vehicle crop focused on the entire vehicle
      const padX = 0.1;
      const padY = 0.1;
      const vW = video.videoWidth;
      const vH = video.videoHeight;

      const zX = Math.max(0, track.bbox.x - (track.bbox.w * padX) / 2) * vW;
      const zY = Math.max(0, track.bbox.y - (track.bbox.h * padY) / 2) * vH;
      let zW = Math.min(1, track.bbox.w * (1 + padX)) * vW;
      let zH = Math.min(1, track.bbox.h * (1 + padY)) * vH;

      // Ensure we don't go out of bounds
      if (zX + zW > vW) zW = vW - zX;
      if (zY + zH > vH) zH = vH - zY;

      // Maintain aspect ratio but clamp output size to avoid oversized canvases.
      let detailMs = 0;
      if (shouldCaptureDetail) {
        const targetW = isMid ? (highQualityMid ? 800 : 720) : 900;
        const rawTargetH = Math.max(1, Math.floor(targetW * (zH / Math.max(1, zW))));
        const targetH = Math.max(
          isMid ? (highQualityMid ? 460 : 420) : 500,
          Math.min(isMid ? (highQualityMid ? 960 : 820) : 1080, rawTargetH)
        );
        canvas.width = targetW;
        canvas.height = targetH;
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(video, zX, zY, zW, zH, 0, 0, targetW, targetH);
        const detailStart = performance.now();
        let detailData = '';
        const detailQuality = isMid ? (highQualityMid ? 0.84 : 0.78) : 0.84;
        try {
          if (this.snapshotWorker) {
            detailData = await this.snapshotWorker.captureDetail({
              video,
              crop: { x: zX, y: zY, w: zW, h: zH },
              out: { w: targetW, h: targetH },
              quality: detailQuality,
            });
          } else {
            detailData = await this.canvasToBase64Jpeg(
              canvas,
              detailQuality,
              isMid ? (highQualityMid ? 220_000 : 150_000) : 280_000
            );
          }
        } catch {
          // Fallback path: local canvas encode if worker pipeline fails at runtime.
          detailData = await this.canvasToBase64Jpeg(
            canvas,
            detailQuality,
            isMid ? (highQualityMid ? 220_000 : 150_000) : 280_000
          );
        }
        detailMs = performance.now() - detailStart;
        storage.push({ label, kind: 'detail', data: detailData });
      }
      this.snapshotStorage.set(targetKey, storage);
      this.onProgressUpdate?.(targetKey, { capturedPhotos: storage.length });

      const totalMs = performance.now() - startedAt;
      if (
        totalMs > this.snapshotWarnThresholdMs ||
        generalMs > this.snapshotWarnThresholdMs ||
        detailMs > this.snapshotWarnThresholdMs
      ) {
        console.warn(
          `[CAPTURE_PERF] ${label} track=${track.id} total=${totalMs.toFixed(1)}ms general=${generalMs.toFixed(1)}ms detail=${detailMs.toFixed(1)}ms`
        );
      }
      capturePerfMonitor.report({
        ts: Date.now(),
        label,
        trackId: track.id,
        totalMs,
        generalMs,
        detailMs,
      });
    } catch (err) {
      console.error(`[CAPTURE] Snapshot error (${label}):`, err);
    } finally {
      if (label === 'mid') this.midCaptureInFlightKeys.delete(targetKey);
      this.markSnapshotPending(targetKey, label, false);
    }
  }

  private hasMidCapture(key: string): boolean {
    return (this.snapshotStorage.get(key) || []).some((s) => s.label === 'mid');
  }

  private getMidCounts(key: string): { general: number; detail: number } {
    const storage = this.snapshotStorage.get(key) || [];
    return {
      general: storage.filter((s) => s.label === 'mid' && s.kind === 'general').length,
      detail: storage.filter((s) => s.label === 'mid' && s.kind === 'detail').length,
    };
  }

  private async ensureMidMoments(
    video: HTMLVideoElement,
    track: Track,
    key: string
  ): Promise<void> {
    const startedAt = Date.now();
    let counts = this.getMidCounts(key);
    const hasExit = this.hasLabelCapture(key, 'exit');
    if (hasExit && counts.general >= 2 && counts.detail >= 2) return;

    while (
      (!this.hasLabelCapture(key, 'exit') ||
        counts.general < this.targetGeneralSnapshots - 1 ||
        counts.detail < this.targetDetailSnapshots) &&
      Date.now() - startedAt < this.finalizeMidEnsureTimeoutMs
    ) {
      if (!this.isSnapshotPending(key, 'mid') && !this.midCaptureInFlightKeys.has(key)) {
        await this.captureNamedSnapshot(video, track, 'mid', key);
      }
      const exitDetailCount = (this.snapshotStorage.get(key) || []).filter(
        (s) => s.label === 'exit' && s.kind === 'detail'
      ).length;
      if ((!this.hasLabelCapture(key, 'exit') || exitDetailCount < 2) && !this.isSnapshotPending(key, 'exit')) {
        await this.captureNamedSnapshot(video, track, 'exit', key);
      }
      await new Promise((resolve) => window.setTimeout(resolve, this.midCaptureIntervalMs));
      counts = this.getMidCounts(key);
    }
  }

  private hasLabelCapture(key: string, label: SnapshotLabel): boolean {
    return (this.snapshotStorage.get(key) || []).some((s) => s.label === label);
  }

  private cleanup(key: string): void {
    this.recorders.get(key)?.stop();
    this.recorders.delete(key);
    this.targets.delete(key);
    this.snapshotStorage.delete(key);
    this.pendingSnapshotLabels.delete(key);
    this.lastMidCaptureAt.delete(key);
    this.orphanedSince.delete(key);
    this.midCaptureInFlightKeys.delete(key);
  }

  private isSnapshotPending(key: string, label: SnapshotLabel): boolean {
    return this.pendingSnapshotLabels.get(key)?.has(label) || false;
  }

  private markSnapshotPending(key: string, label: SnapshotLabel, pending: boolean): void {
    const labels = this.pendingSnapshotLabels.get(key) || new Set<SnapshotLabel>();
    if (pending) {
      labels.add(label);
      this.pendingSnapshotLabels.set(key, labels);
      return;
    }
    labels.delete(label);
    if (labels.size === 0) {
      this.pendingSnapshotLabels.delete(key);
    } else {
      this.pendingSnapshotLabels.set(key, labels);
    }
  }

  private clear(): void {
    for (const recorder of this.recorders.values()) recorder.stop();
    this.recorders.clear();
    this.targets.clear();
    this.snapshotStorage.clear();
    this.orphanedSince.clear();
    this.snapshotWorker?.dispose();
    this.snapshotWorker = null;
  }
}
