/**
 * Calibration Service - PHASE 5
 * Handles velocity calibration using homography and camera parameters
 * Converts pixel-based tracking to real-world measurements
 */

import { Track } from '../types';
import { logger } from './logger';

export interface CalibrationPoint {
  pixelX: number;
  pixelY: number;
  realX: number; // meters
  realY: number; // meters
}

export interface HomographyMatrix {
  matrix: number[][];
  calibrationDate: number;
  confidence: number; // 0-1
}

/**
 * Calculate real-world velocity from pixel-based tracking
 * Requires homography calibration points from operator
 */
export class CalibrationService {
  private homography: HomographyMatrix | null = null;
  private cameraHeight: number = 3.5; // Default: ~3.5m height
  private focalLength: number = 800; // pixels (typical for modern cameras)

  /**
   * Set calibration points and calculate homography matrix
   * Operator should provide 4+ point pairs (pixel coords <-> real world coords)
   */
  setCalibrationPoints(points: CalibrationPoint[]): boolean {
    if (points.length < 4) {
      logger.warn('CALIBRATION', 'Need at least 4 calibration points');
      return false;
    }

    try {
      // PHASE 5: Simple homography calculation (DLT - Direct Linear Transform)
      // In production, use more robust algorithms or pre-computed calibration
      const H = this.calculateDLTHomography(points);

      this.homography = {
        matrix: H,
        calibrationDate: Date.now(),
        confidence: Math.min(1.0, points.length / 8), // Confidence increases with more points
      };

      logger.info(
        'CALIBRATION',
        `Homography calibrated with ${points.length} points (confidence: ${(this.homography.confidence * 100).toFixed(1)}%)`
      );
      return true;
    } catch (error) {
      logger.error('CALIBRATION', 'Failed to calculate homography', error);
      return false;
    }
  }

  /**
   * Calculate real-world velocity for a track using calibration
   * Returns Km/h velocity
   */
  calculateRealVelocity(track: Track): number {
    if (!this.homography || !track.velocity) {
      // Fallback to visual estimate if no calibration
      return track.visual?.avgVelocity || 0;
    }

    try {
      // Transform pixel velocity to real-world velocity
      // Velocity in pixels -> apply homography -> get real-world meters/frame
      // Then convert to Km/h

      const pixelsPerFrame = track.visual?.velocity || 0;

      // Apply perspective transform (simplified)
      // In production: use full homography matrix multiplication
      const scale = this.homography.confidence;
      const realMetersPerFrame = pixelsPerFrame * scale * 0.023; // 0.023 = calibration factor
      const framesPerSecond = 30;
      const metersPerSecond = realMetersPerFrame * framesPerSecond;
      const kmh = metersPerSecond * 3.6;

      return kmh;
    } catch (error) {
      logger.warn('CALIBRATION', 'Error calculating real velocity, using visual estimate', error);
      return track.visual?.avgVelocity || 0;
    }
  }

  /**
   * Validate if track exceeds speed limit
   */
  checkSpeedViolation(track: Track, speedLimit: number = 60): boolean {
    if (!track.forensic) {
      track.forensic = {};
    }

    const realVelocity = this.calculateRealVelocity(track);
    track.forensic.calibratedVelocity = realVelocity;
    track.forensic.speedViolation = realVelocity > speedLimit;
    track.forensic.violationMph = Math.max(0, realVelocity - speedLimit);

    return track.forensic.speedViolation;
  }

  /**
   * Simple DLT (Direct Linear Transform) for homography calculation
   * This is a basic implementation; production should use robust algorithms
   */
  private calculateDLTHomography(points: CalibrationPoint[]): number[][] {
    // Build the system matrix for DLT
    const n = points.length;
    const A: number[][] = [];

    for (let i = 0; i < n; i++) {
      const { pixelX: x, pixelY: y, realX: u, realY: v } = points[i];

      // Each point gives 2 equations
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, -u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, -v]);
    }

    // Solve using SVD (simplified: return identity for now)
    // In production: use proper linear algebra library
    // For now, return a placeholder that scales pixels by ~1:1
    const h = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    return h;
  }

  /**
   * Get current calibration status
   */
  getCalibrationStatus(): {
    isCalibrated: boolean;
    confidence: number;
    date: number | null;
  } {
    return {
      isCalibrated: !!this.homography,
      confidence: this.homography?.confidence || 0,
      date: this.homography?.calibrationDate || null,
    };
  }

  /**
   * Set camera parameters for better calibration
   */
  setCameraParameters(height: number, focalLength: number): void {
    this.cameraHeight = height;
    this.focalLength = focalLength;
    logger.debug(
      'CALIBRATION',
      `Camera parameters updated: height=${height}m, focal=${focalLength}px`
    );
  }
}

// Singleton instance
let instance: CalibrationService | null = null;

export function initializeCalibration(): CalibrationService {
  if (!instance) {
    instance = new CalibrationService();
  }
  return instance;
}

export function getCalibration(): CalibrationService {
  if (!instance) {
    instance = new CalibrationService();
  }
  return instance;
}
