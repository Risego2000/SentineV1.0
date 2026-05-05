/**
 * Frame-to-Frame Continuity Validator
 * Ensures vehicles are never "lost" between frames
 * Detects and reports anomalies in tracking continuity
 */

import { Track } from '../types';
import { logger } from './logger';

export interface ContinuityReport {
  frame: number;
  totalTracks: number;
  integrityScore: number; // 0-100%, % of unbroken lineage
  detectedAnomalies: string[];
  missingTracks: number; // Tracks that disappeared without expected reason
  ghostTracks: number; // Tracks that persisted after vehicle exited
}

export class FrameContinuityValidator {
  private previousTracks: Map<string, Track> = new Map();
  private continuityHistory: ContinuityReport[] = [];
  private historyIndex: number = 0;
  private readonly MAX_HISTORY: number = 300; // ~10 seconds at 30fps
  private frameCount: number = 0;
  private unbrokenLineageCount: number = 0;

  /**
   * Validate frame transition and detect anomalies
   */
  validateFrameTransition(currentTracks: Track[]): ContinuityReport {
    this.frameCount++;
    const anomalies: string[] = [];
    let unbrokenCount = 0;

    // Check for ID mutations (same vehicle getting reassigned)
    for (const currentTrack of currentTracks) {
      const globalId = currentTrack.globalId;
      if (!globalId) continue;

      const prevTrack = this.previousTracks.get(globalId);

      if (prevTrack) {
        // Track exists in previous frame
        const idMutation = this.detectIdMutation(currentTrack, prevTrack);
        if (!idMutation.isValid) {
          anomalies.push(`ID mutation: ${globalId} - ${idMutation.reason}`);
        } else {
          unbrokenCount++;
        }
      }
    }

    // Detect unexplained disappearances
    for (const [prevGlobalId, prevTrack] of this.previousTracks.entries()) {
      const currentTrack = currentTracks.find((t) => t.globalId === prevGlobalId);

      if (!currentTrack && prevTrack.missedFrames === 0) {
        // Track was visible last frame but missing now without missed-frame counter
        anomalies.push(`Unexplained disappearance: ${prevGlobalId} (${prevTrack.label})`);
      }
    }

    // Calculate integrity score
    const integrityScore =
      currentTracks.length > 0 ? (unbrokenCount / currentTracks.length) * 100 : 100;

    this.unbrokenLineageCount = Math.max(this.unbrokenLineageCount, unbrokenCount);

    const report: ContinuityReport = {
      frame: this.frameCount,
      totalTracks: currentTracks.length,
      integrityScore,
      detectedAnomalies: anomalies,
      missingTracks: Math.max(0, this.previousTracks.size - currentTracks.length),
      ghostTracks: 0, // Computed elsewhere
    };

    // Log anomalies
    if (anomalies.length > 0) {
      logger.warn(
        'FRAME_CONTINUITY',
        `Frame ${this.frameCount}: ${anomalies.length} anomalies detected`,
        anomalies
      );
    }

    // Log summary every 30 frames
    if (this.frameCount % 30 === 0) {
      logger.ai(
        'FRAME_CONTINUITY',
        `Continuity Stats (frames 1-${this.frameCount}): Avg integrity ${integrityScore.toFixed(1)}%, Unbroken lineage: ${unbrokenCount}/${currentTracks.length}`
      );
    }

    // Update previous tracks for next frame
    this.previousTracks.clear();
    for (const track of currentTracks) {
      if (track.globalId) {
        this.previousTracks.set(track.globalId, track);
      }
    }

    // Store in circular buffer (bounded memory)
    if (this.continuityHistory.length < this.MAX_HISTORY) {
      this.continuityHistory.push(report);
    } else {
      this.continuityHistory[this.historyIndex] = report;
      this.historyIndex = (this.historyIndex + 1) % this.MAX_HISTORY;
    }

    return report;
  }

  /**
   * Detect ID mutation (same vehicle getting reassigned)
   */
  private detectIdMutation(
    currentTrack: Track,
    prevTrack: Track
  ): { isValid: boolean; reason?: string } {
    // Check if vehicle moved too far
    const currentCenter = {
      x: currentTrack.bbox.x + currentTrack.bbox.w / 2,
      y: currentTrack.bbox.y + currentTrack.bbox.h / 2,
    };

    const prevCenter = {
      x: prevTrack.bbox.x + prevTrack.bbox.w / 2,
      y: prevTrack.bbox.y + prevTrack.bbox.h / 2,
    };

    const distance = Math.hypot(currentCenter.x - prevCenter.x, currentCenter.y - prevCenter.y);

    // Reasonable movement is < 0.15 normalized units per frame
    if (distance > 0.3) {
      return {
        isValid: false,
        reason: `Moved too far: ${distance.toFixed(3)} units (expected <0.3)`,
      };
    }

    // Check if class changed drastically
    if (currentTrack.label !== prevTrack.label && distance > 0.05) {
      return {
        isValid: false,
        reason: `Class changed (${prevTrack.label} → ${currentTrack.label}) with large movement`,
      };
    }

    return { isValid: true };
  }

  /**
   * Get frame integrity percentage (0-100)
   */
  getFrameIntegrity(): number {
    if (this.continuityHistory.length === 0) return 100;

    const avgIntegrity =
      this.continuityHistory.reduce((sum, r) => sum + r.integrityScore, 0) /
      this.continuityHistory.length;

    return avgIntegrity;
  }

  /**
   * Get continuity statistics
   */
  getStats() {
    return {
      frameCount: this.frameCount,
      totalReports: this.continuityHistory.length,
      avgIntegrity: this.getFrameIntegrity(),
      totalAnomalies: this.continuityHistory.reduce((sum, r) => sum + r.detectedAnomalies.length, 0),
      unbrokenLineageTracksMax: this.unbrokenLineageCount,
    };
  }

  /**
   * Reset validator
   */
  reset(): void {
    this.previousTracks.clear();
    this.continuityHistory = [];
    this.historyIndex = 0;
    this.frameCount = 0;
    this.unbrokenLineageCount = 0;
  }
}

// Singleton instance
let validatorInstance: FrameContinuityValidator | null = null;

export const getFrameContinuityValidator = (): FrameContinuityValidator => {
  if (!validatorInstance) {
    validatorInstance = new FrameContinuityValidator();
  }
  return validatorInstance;
};
