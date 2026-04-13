/**
 * Evidence Capture System - Two-phase ROI forbidden-turn support.
 * Phase 1 (ROI A): start 20s circular buffer + capture ROI_A photos.
 * Phase 2 (ROI B): capture ROI_B photos + mid-path photos, then finalize.
 * If ROI B never comes: discard (buffer is overwritten by next activation).
 */

import { evidenceDB } from '../services/EvidenceDB';
import { VideoBufferService } from '../services/videoRecorder';
import { forensicQueue } from '../services/ForensicQueue';
import { OCRSynchronizer } from '../services/OCRSynchronizer';
import { Track, GeometryLine } from '../types';
import { ForensicRule } from '../types/forensicRules';

export interface EvidenceCaptureTarget {
  trackId: number;
  geometryId: string;
  ruleId?: string;
  startedAt: number;
  frameCount: number;
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
type SnapshotLabel = 'roi_a' | 'mid' | 'roi_b';

interface SnapshotEntry {
  label: SnapshotLabel;
  kind: 'general' | 'detail';
  data: string; // base64 JPEG
}

export class EvidenceCaptureManager {
  private targets: Map<string, EvidenceCaptureTarget> = new Map();
  private recorders: Map<string, VideoBufferService> = new Map();
  private snapshotStorage: Map<string, SnapshotEntry[]> = new Map();
  private snapshotCanvas: HTMLCanvasElement | null = null;
  private policy: CapturePolicy;
  private onBufferUpdate?: (targetId: string, seconds: number) => void;

  constructor(policy: Partial<CapturePolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  setPolicy(policy: Partial<CapturePolicy>) {
    this.policy = { ...this.policy, ...policy };
  }

  setBufferCallback(callback: (targetId: string, seconds: number) => void) {
    this.onBufferUpdate = callback;
  }

  /**
   * Check if a track should be captured based on policy.
   */
  shouldCapture(trackId: number, geometryId: string): boolean {
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
   * Starts the 20s circular buffer and captures FOTO_GENERAL_ROI_A + FOTO_DETALLE_ROI_A.
   * Does NOT set track.audited so ROI B can still be detected.
   */
  startTurnCapture(
    track: Track,
    roiALine: GeometryLine,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    frameCount: number
  ): string | null {
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
    };
    this.targets.set(key, target);

    // Start 20s circular buffer
    const recorder = new VideoBufferService(canvas);
    recorder.setBufferCallback((seconds) => this.onBufferUpdate?.(key, seconds));
    recorder.start();
    this.recorders.set(key, recorder);

    // Capture ROI A photos (general scene + vehicle detail)
    this.captureNamedSnapshot(video, track, 'roi_a', key);

    return key;
  }

  /**
   * Mid-path capture — between ROI A and ROI B.
   * Captures FOTO_GENERAL_DESARROLLO + FOTO_DETALLE_DESARROLLO.
   */
  captureMidTurn(track: Track, video: HTMLVideoElement): void {
    const target = this.findTarget(track.id);
    if (!target) return;
    if (this.hasMidCapture(target.key)) return;
    this.captureNamedSnapshot(video, track, 'mid', target.key);
  }

  /**
   * PHASE 2 — ROI B entry (infraction confirmed).
   * Captures FOTO_GENERAL_ROI_B + FOTO_DETALLE_ROI_B.
   */
  captureRoiB(track: Track, roiBLine: GeometryLine, video: HTMLVideoElement): void {
    const target = this.findTarget(track.id);
    if (!target) return;
    this.captureNamedSnapshot(video, track, 'roi_b', target.key);
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
      // Ensure we have a mid capture (fallback if mid was never triggered)
      if (!this.hasMidCapture(key)) {
        this.captureNamedSnapshot(video, track, 'mid', key);
      }

      const recorder = this.recorders.get(key);
      const clip = recorder ? await recorder.getClip() : undefined;

      const snapshots = this.snapshotStorage.get(key) || [];

      // Run OCR on all detail frames to get plate candidates
      const detailFrames = snapshots
        .filter((s) => s.kind === 'detail')
        .map((s) => s.data)
        .slice(0, 3);
      let ocrResults: string[] = [];
      if (detailFrames.length > 0) {
        try {
          const plate = await OCRSynchronizer.extractLicensePlateFromBase64(detailFrames);
          if (plate) ocrResults = [plate];
        } catch {
          // OCR is best-effort
        }
      }

      const localTime = new Date().toLocaleString();
      const videoTimeCode = await OCRSynchronizer.extractTimecode(video);

      // Persist to EvidenceDB with semantic structure
      const evidenceId = key;
      await evidenceDB.saveEvidence(evidenceId, {
        snapshots: snapshots.map((s) => s.data),
        contextSnapshots: snapshots.filter((s) => s.kind === 'general').map((s) => s.data),
        zoomSnapshots: snapshots.filter((s) => s.kind === 'detail').map((s) => s.data),
        ocrResults,
        clip,
      });

      forensicQueue.enqueueJob(
        track,
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
    };
    this.targets.set(key, target);

    const recorder = new VideoBufferService(canvas);
    recorder.setBufferCallback((seconds) => this.onBufferUpdate?.(key, seconds));
    recorder.start();
    this.recorders.set(key, recorder);

    this.captureNamedSnapshot(video, track, 'roi_a', key);
    return key;
  }

  captureMidIfNeeded(
    track: Track,
    video: HTMLVideoElement,
    _midPointFrame: number,
    frameCount: number
  ): void {
    const target = this.findTarget(track.id);
    if (!target) return;
    const elapsed = frameCount - target.frameCount;
    if (elapsed >= 30 && !this.hasMidCapture(target.key)) {
      this.captureNamedSnapshot(video, track, 'mid', target.key);
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
  private captureNamedSnapshot(
    video: HTMLVideoElement,
    track: Track,
    label: SnapshotLabel,
    targetKey: string
  ): void {
    if (!video || video.readyState < 2) return;

    if (!this.snapshotCanvas) {
      this.snapshotCanvas = document.createElement('canvas');
    }
    const canvas = this.snapshotCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const W = 1920;
      const H = 1080;

      // General frame — full scene
      canvas.width = W;
      canvas.height = H;
      ctx.drawImage(video, 0, 0, W, H);
      const generalData = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

      // Detail frame — vehicle crop with padding
      const pad = 0.5;
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const zX = Math.max(0, (track.bbox.x - (track.bbox.w * pad) / 2)) * vW;
      const zY = Math.max(0, (track.bbox.y - (track.bbox.h * pad) / 2)) * vH;
      const zW = Math.min(1, track.bbox.w * (1 + pad)) * vW;
      const zH = Math.min(1, track.bbox.h * (1 + pad)) * vH;

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(video, zX, zY, zW, zH, 0, 0, W, H);
      const detailData = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];

      const storage = this.snapshotStorage.get(targetKey) || [];
      storage.push(
        { label, kind: 'general', data: generalData },
        { label, kind: 'detail', data: detailData }
      );
      this.snapshotStorage.set(targetKey, storage);
    } catch (err) {
      console.error(`[CAPTURE] Snapshot error (${label}):`, err);
    }
  }

  private hasMidCapture(key: string): boolean {
    return (this.snapshotStorage.get(key) || []).some((s) => s.label === 'mid');
  }

  private cleanup(key: string): void {
    this.recorders.get(key)?.stop();
    this.recorders.delete(key);
    this.targets.delete(key);
    this.snapshotStorage.delete(key);
  }

  private clear(): void {
    for (const recorder of this.recorders.values()) recorder.stop();
    this.recorders.clear();
    this.targets.clear();
    this.snapshotStorage.clear();
  }
}
