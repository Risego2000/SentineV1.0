/**
 * Evidence Capture System - Multi-track support
 * Supports simultaneous evidence capture for multiple vehicles.
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
  /** Maximum simultaneous captures */
  maxSimultaneous: number;
  /** Priority mode: 'first' | 'highest_velocity' | 'closest_to_exit' */
  priorityMode: 'first' | 'highest_velocity' | 'closest_to_exit';
  /** Auto-abort if track exits view */
  autoAbortOnExit: boolean;
}

const DEFAULT_POLICY: CapturePolicy = {
  maxSimultaneous: 3,
  priorityMode: 'first',
  autoAbortOnExit: true,
};
const MAX_SNAPSHOTS_PER_TARGET = 6;

/**
 * Evidence Capture Manager
 * Manages simultaneous evidence capture for multiple tracks.
 */
export class EvidenceCaptureManager {
  private targets: Map<string, EvidenceCaptureTarget> = new Map();
  private recorders: Map<string, VideoBufferService> = new Map();
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
    if (this.targets.has(key)) return false; // Already capturing
    if (this.targets.size >= this.policy.maxSimultaneous) return false; // Max reached
    return true;
  }

  /**
   * Start capturing evidence for a track.
   */
  startCapture(
    track: Track,
    geometry: GeometryLine,
    rule: ForensicRule | undefined,
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    frameCount: number
  ): string | null {
    const key = this.getTargetKey(track.id, geometry.id);

    if (!this.shouldCapture(track.id, geometry.id)) {
      return null;
    }

    // Create target
    const target: EvidenceCaptureTarget = {
      trackId: track.id,
      geometryId: geometry.id,
      ruleId: rule?.id,
      startedAt: Date.now(),
      frameCount,
    };
    this.targets.set(key, target);

    // Initialize recorder
    const recorder = new VideoBufferService(canvas);
    recorder.start();
    this.recorders.set(key, recorder);

    // Capture initial snapshot
    this.captureSnapshot(video, track, 'initial', key);

    console.log(`[CAPTURE] Started for Track #${track.id}, Geometry ${geometry.label}`);
    return key;
  }

  /**
   * Capture mid-point evidence if needed.
   */
  captureMidIfNeeded(
    track: Track,
    video: HTMLVideoElement,
    midPointFrame: number,
    frameCount: number
  ): void {
    const target = this.findTarget(track.id);
    if (!target) return;

    const elapsed = frameCount - target.frameCount;
    if (elapsed >= 30 && !this.hasMidCapture(target.key)) {
      this.captureSnapshot(video, track, 'mid', target.key);
    }
  }

  /**
   * Finalize and enqueue evidence for audit.
   */
  async finalizeCapture(
    track: Track,
    geometry: GeometryLine,
    video: HTMLVideoElement,
    viewerId?: string
  ): Promise<void> {
    const target = this.findTarget(track.id);
    if (!target) return;

    const key = target.key;

    try {
      // Capture final snapshot
      this.captureSnapshot(video, track, 'final', key);

      // Get all captured evidence
      const recorder = this.recorders.get(key);
      const clip = recorder ? await recorder.getClip() : undefined;

      const snapshots = this.getSnapshots(key);
      const contextSnapshots = snapshots.filter((_, i) => i % 2 === 0);
      const zoomSnapshots = snapshots.filter((_, i) => i % 2 === 1);

      // Get timecode
      const localTime = new Date().toLocaleString();
      const videoTimeCode = await this.extractTimecode(video);

      // Save to EvidenceDB
      const evidenceId = key;
      await evidenceDB.saveEvidence(evidenceId, {
        snapshots: [...snapshots],
        contextSnapshots,
        zoomSnapshots,
        ocrResults: [],
        clip,
      });

      // Enqueue for audit
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
      // Always release recorder + snapshots even if persistence/audit fails.
      this.cleanup(key);
    }
  }

  /**
   * Abort capture for a track.
   */
  abortCapture(trackId: number, reason: string): void {
    const target = this.findTarget(trackId);
    if (!target) return;

    console.warn(`[CAPTURE] Aborted for Track #${trackId}: ${reason}`);
    this.cleanup(target.key);
  }

  /**
   * Abort all active captures.
   */
  abortAll(reason: string): void {
    for (const target of this.targets.values()) {
      console.warn(`[CAPTURE] Aborted for Track #${target.trackId}: ${reason}`);
    }
    this.clear();
  }

  /**
   * Get active capture count.
   */
  getActiveCount(): number {
    return this.targets.size;
  }

  /**
   * Check if a track is being captured.
   */
  isCapturing(trackId: number): boolean {
    return this.findTarget(trackId) !== null;
  }

  /**
   * Get buffer status for a capture.
   */
  getBufferSeconds(targetId: string): number {
    const recorder = this.recorders.get(targetId);
    return recorder?.getBufferSeconds() || 0;
  }

  private getTargetKey(trackId: number, geometryId: string): string {
    return `${trackId}_${geometryId}`;
  }

  private findTarget(trackId: number): (EvidenceCaptureTarget & { key: string }) | null {
    for (const [key, target] of this.targets) {
      if (target.trackId === trackId) {
        return { ...target, key };
      }
    }
    return null;
  }

  private snapshotStorage: Map<string, { type: string; data: string }[]> = new Map();

  private captureSnapshot(
    video: HTMLVideoElement,
    track: Track,
    type: 'initial' | 'mid' | 'final',
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
      // 1. FULL SCENE (Context)
      canvas.width = 1280;
      canvas.height = 720;
      ctx.drawImage(video, 0, 0, 1280, 720);
      const contextFrame = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];

      // 2. ZOOM (Vehicle detail)
      const zoomPad = 0.5;
      const vW = video.videoWidth;
      const vH = video.videoHeight;
      const zX = Math.max(0, track.bbox.x - (track.bbox.w * zoomPad) / 2) * vW;
      const zY = Math.max(0, track.bbox.y - (track.bbox.h * zoomPad) / 2) * vH;
      const zW = Math.min(1, track.bbox.w * (1 + zoomPad)) * vW;
      const zH = Math.min(1, track.bbox.h * (1 + zoomPad)) * vH;

      ctx.clearRect(0, 0, 1280, 720);
      ctx.drawImage(video, zX, zY, zW, zH, 0, 0, 1280, 720);
      const zoomFrame = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];

      // Store snapshots
      const storage = this.snapshotStorage.get(targetKey) || [];
      storage.push({ type, data: contextFrame }, { type, data: zoomFrame });
      if (storage.length > MAX_SNAPSHOTS_PER_TARGET) {
        storage.splice(0, storage.length - MAX_SNAPSHOTS_PER_TARGET);
      }
      this.snapshotStorage.set(targetKey, storage);
    } catch (error) {
      console.error(`[CAPTURE] Snapshot error for ${type}:`, error);
    }
  }

  private hasMidCapture(key: string): boolean {
    const storage = this.snapshotStorage.get(key) || [];
    return storage.some((s) => s.type === 'mid');
  }

  private getSnapshots(key: string): string[] {
    return (this.snapshotStorage.get(key) || []).map((s) => s.data);
  }

  private async extractTimecode(video: HTMLVideoElement): Promise<string> {
    return OCRSynchronizer.extractTimecode(video);
  }

  private cleanup(key: string): void {
    const recorder = this.recorders.get(key);
    recorder?.stop();
    this.recorders.delete(key);
    this.targets.delete(key);
    this.snapshotStorage.delete(key);
  }

  private clear(): void {
    for (const recorder of this.recorders.values()) {
      recorder.stop();
    }
    this.recorders.clear();
    this.targets.clear();
    this.snapshotStorage.clear();
  }
}
