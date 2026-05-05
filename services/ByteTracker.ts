import { Track, IKalman, TrackBBox, StandardDetection } from '../types';
import { GlobalTrackRegistry, getGlobalTrackRegistry } from './GlobalTrackRegistry';
import { logger } from './logger';

/**
 * Advanced Motion Model for Tactical Tracking.
 * Implements a simplified 2D Kalman Filter with exponential moving averages for velocity stabilization.
 * This engine is tuned for the 'Arrow' visualization and predictable occlusion handling.
 */
class AdvancedKalman implements IKalman {
  /** Current X coordinate (normalized 0-1) */
  x: number;
  /** Current Y coordinate (normalized 0-1) */
  y: number;
  /** Velocity in X axis (units/frame) */
  vx: number = 0;
  /** Velocity in Y axis (units/frame) */
  vy: number = 0;

  /** Position smoothing factor (reactivity) */
  private readonly alpha = 0.85;
  /** Velocity smoothing factor (stability) */
  private readonly beta = 0.15;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Updates the state based on a new observation.
   * @param mx Measured X
   * @param my Measured Y
   * @param dt Delta time (defaults to 1 frame)
   */
  update(mx: number, my: number, dt: number = 1): void {
    // Predict position based on current velocity
    const px = this.x + this.vx * dt;
    const py = this.y + this.vy * dt;

    // Residue (innovation)
    const rx = mx - px;
    const ry = my - py;

    // Correct Position using alpha gain
    this.x = px + this.alpha * rx;
    this.y = py + this.alpha * ry;

    // Update Velocity with exponential moving average to stabilize the "Tactical Arrow"
    const instantVx = rx / dt;
    const instantVy = ry / dt;

    this.vx = this.vx * (1 - this.beta) + instantVx * this.beta;
    this.vy = this.vy * (1 - this.beta) + instantVy * this.beta;
  }

  /**
   * Predicts the next state without a measurement (coasting mode).
   * @param dt Delta time
   */
  step(dt: number = 1): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Natural damping to simulate friction/stalling
    this.vx *= 0.98;
    this.vy *= 0.98;
  }

  /**
   * Returns the scalar magnitude of the velocity vector.
   */
  getVelocity(): number {
    return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
  }

  /**
   * Returns the heading angle in radians.
   * Includes a deadzone to prevent flickering when stationary.
   */
  getHeading(): number {
    if (this.getVelocity() < 0.008) return 0;
    return Math.atan2(this.vy, this.vx);
  }
}

/**
 * ByteTracker Implementation.
 * A high-performance tracking algorithm that combines IoU-based matching with
 * a Kalman-driven motion model for persistent object identification.
 *
 * Now integrated with GlobalTrackRegistry for globally unique, collision-proof IDs.
 */
export class ByteTracker {
  /** Active tracks managed by the engine */
  tracks: Track[] = [];
  /** Global track ID counter (local counter for backward compatibility) */
  private trackIdCount = 0;
  private readonly maxReidCenterDistance = 0.18;
  private readonly minPersistenceFrames = 60; // Increased from 45 for better persistence
  private readonly outOfViewMargin = 0.2;
  private readonly maxOutOfViewFrames = 15; // Increased from 10 for better handling of partially off-screen vehicles
  private outOfViewFramesByTrackId = new Map<number, number>();

  // Global registry for unique track IDs
  private viewerId: string;
  private source: 'live' | 'upload' | 'ip-camera';
  private globalRegistry: GlobalTrackRegistry;

  /**
   * Initialize tracker with viewer and source information
   */
  initialize(viewerId: string, source: 'live' | 'upload' | 'ip-camera'): void {
    this.viewerId = viewerId;
    this.source = source;
    this.globalRegistry = getGlobalTrackRegistry();
    logger.debug('BYTETRACKER', `Initialized for ${source} (viewerId: ${viewerId})`);
  }

  /**
   * Resets the tracker state.
   */
  reset(): void {
    this.tracks = [];
    this.trackIdCount = 0;
    this.outOfViewFramesByTrackId.clear();
  }

  /**
   * Append point to tail using circular buffer (O(1) instead of O(n) slice)
   */
  private appendToTail(track: Track, point: { x: number; y: number }): void {
    const MAX_TAIL = 50;
    if (!track._tailIndex) {
      track._tailIndex = 0;
    }

    if (track.tail.length < MAX_TAIL) {
      track.tail.push(point);
    } else {
      track.tail[track._tailIndex] = point;
      track._tailIndex = (track._tailIndex + 1) % MAX_TAIL;
    }
  }

  /**
   * Performs a prediction step for all active tracks.
   * Useful for visual synchronization between detection frames.
   */
  step(): Track[] {
    this.tracks.forEach((t) => {
      t.kf.step();
      t.bbox.x = t.kf.x - t.bbox.w / 2;
      t.bbox.y = t.kf.y - t.bbox.h / 2;
      t.isCoasting = true;

      // Append predicted centroid to tail for fluid visuals (circular buffer O(1))
      this.appendToTail(t, { x: t.kf.x, y: t.kf.y });
    });
    return this.tracks;
  }

  /**
   * Updates tracks with new detections using IoU matching and kinetic refinement.
   */
  update(
    detections: StandardDetection[],
    persistence: number = 5,
    minScore: number = 0.25
  ): Track[] {
    // Never allow aggressive cleanup: enforce a robust minimum persistence window.
    const effectivePersistence = Math.max(persistence, this.minPersistenceFrames);
    const iouMatrix = this.tracks.map((t) => detections.map((d) => this.iou(t.bbox, d.box)));

    const usedDets = new Set<number>();
    const usedTracks = new Set<number>();

    // 1. Kinetic Re-identification (Primary Matching)
    for (let i = 0; i < this.tracks.length; i++) {
      let bestIoU = 0;
      let bestDet = -1;
      for (let j = 0; j < detections.length; j++) {
        if (usedDets.has(j)) continue;
        if (iouMatrix[i][j] > bestIoU) {
          bestIoU = iouMatrix[i][j];
          bestDet = j;
        }
      }

      // PHASE 5: Two-phase matching for occlusion recovery
      // Primary: strict matching (IoU > 0.15)
      // Secondary: occlusion recovery (IoU > 0.05 if track is recent and coasting)
      const candidate = bestDet >= 0 ? detections[bestDet] : null;
      const trackCenterX = this.tracks[i].bbox.x + this.tracks[i].bbox.w / 2;
      const trackCenterY = this.tracks[i].bbox.y + this.tracks[i].bbox.h / 2;
      const detCenterX = candidate ? candidate.box.x + candidate.box.w / 2 : 0;
      const detCenterY = candidate ? candidate.box.y + candidate.box.h / 2 : 0;
      const centerDistance = candidate
        ? Math.hypot(trackCenterX - detCenterX, trackCenterY - detCenterY)
        : Number.POSITIVE_INFINITY;

      const isOcclusionRecovery =
        bestIoU > 0.02 &&
        bestIoU <= 0.15 &&
        this.tracks[i].isCoasting &&
        candidate !== null &&
        (this.tracks[i].label === candidate.label || bestIoU > 0.08) &&
        centerDistance <= this.maxReidCenterDistance;

      if (bestIoU > 0.15 || isOcclusionRecovery) {
        usedDets.add(bestDet);
        usedTracks.add(i);

        const t = this.tracks[i];
        const d = detections[bestDet];
        const cx = d.box.x + d.box.w / 2;
        const cy = d.box.y + d.box.h / 2;

        t.kf.update(cx, cy);
        t.hits++;

        // Temporal Label Smoothing (Majority Vote)
        if (!t.labelHistory) t.labelHistory = [];
        t.labelHistory.push(d.label);
        if (t.labelHistory.length > 30) t.labelHistory.shift();

        const counts: Record<string, number> = {};
        t.labelHistory.forEach((lbl: string) => (counts[lbl] = (counts[lbl] || 0) + 1));
        const modeLabel = Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b));

        // Aspect Ratio Heuristics (Sanity Check)
        const aspectRatio = d.box.w / d.box.h;
        if (modeLabel === 'truck' && aspectRatio > 1.2 && d.box.h < 0.25) {
          t.label = 'car';
        } else {
          t.label = modeLabel;
        }

        // --- ADVANCED TELEMETRY ---
        const newVelocity = t.kf.getVelocity();
        const newHeading = t.kf.getHeading();
        const deltaV = newVelocity - t.velocity;

        if (!t.velocityHistory) t.velocityHistory = [];
        t.velocityHistory.push(newVelocity);
        if (t.velocityHistory.length > 15) t.velocityHistory.shift();

        const avgNormVel = t.velocityHistory.reduce((a, b) => a + b, 0) / t.velocityHistory.length;

        // Dynamic Calibration (Km/h Approximation)
        // Assuming standard lane width occupies ~15% of screen width = 3.5m
        const METERS_PER_UNIT = 23;
        const FPS = 30;
        t.avgVelocity = avgNormVel * METERS_PER_UNIT * FPS * 3.6;

        // PHASE 5: Store visual metrics (will be used until forensic calibration available)
        if (!t.visual) {
          t.visual = { velocity: newVelocity, avgVelocity: t.avgVelocity };
        } else {
          t.visual.velocity = newVelocity;
          t.visual.avgVelocity = t.avgVelocity;
        }

        // Residence Time (Dwell Time)
        // More forgiving threshold (0.01 instead of 0.002) to account for slight motion/noise
        if (newVelocity < 0.01) {
          t.dwellTime += 33; // ~33ms per frame
        } else {
          t.dwellTime = 0;
        }

        // Save previous heading BEFORE overwriting t.heading for correct delta
        const prevHeading = t.heading;

        t.acceleration = deltaV;
        t.velocity = newVelocity;
        t.heading = newHeading;

        // --- ANOMALY DETECTION ---
        const isPanicBrake = deltaV < -0.05;
        const isSuddenAccel = deltaV > 0.05;
        // Wrap-around-safe heading delta (handles ±π boundary)
        let headingDelta = Math.abs(newHeading - prevHeading);
        if (headingDelta > Math.PI) headingDelta = 2 * Math.PI - headingDelta;
        const isErraticSteer = headingDelta > 1.0;

        t.isAnomalous = t.hits > 10 && (isPanicBrake || isSuddenAccel || isErraticSteer);

        if (t.isAnomalous) {
          if (isPanicBrake) t.anomalyLabel = 'Frenado de Emergencia';
          else if (isSuddenAccel) t.anomalyLabel = 'Aceleración Brusca';
          else if (isErraticSteer) t.anomalyLabel = 'Maniobra Errática';
        } else {
          t.anomalyLabel = undefined;
        }

        // --- COLLISION PREDICTION (20-frame lookahead) ---
        t.potentialCollision = false;
        const lookahead = 20;
        t.futurePos = {
          x: t.kf.x + t.kf.vx * lookahead,
          y: t.kf.y + t.kf.vy * lookahead,
        };

        t.bbox.w = d.box.w;
        t.bbox.h = d.box.h;
        t.bbox.x = t.kf.x - d.box.w / 2;
        t.bbox.y = t.kf.y - d.box.h / 2;

        t.conf = d.score;
        t.missedFrames = 0;
        t.isCoasting = false;
        this.outOfViewFramesByTrackId.set(t.id, 0);

        // Update tail using circular buffer (O(1))
        this.appendToTail(t, { x: cx, y: cy });
      }
    }

    // --- CROSS-TRACK COLLISION ENGINE ---
    for (let i = 0; i < this.tracks.length; i++) {
      for (let j = i + 1; j < this.tracks.length; j++) {
        const t1 = this.tracks[i];
        const t2 = this.tracks[j];
        if (!t1.futurePos || !t2.futurePos) continue;

        const dist = Math.hypot(t1.futurePos.x - t2.futurePos.x, t1.futurePos.y - t2.futurePos.y);
        if (dist < 0.05 && t1.velocity > 0.01 && t2.velocity > 0.01) {
          t1.potentialCollision = true;
          t2.potentialCollision = true;
          t1.collisionTargetId = t2.id;
          t2.collisionTargetId = t1.id;
        }
      }
    }

    // 2. Genesis (New Tracks)
    detections.forEach((d, i) => {
      if (!usedDets.has(i) && d.score > minScore) {
        const cx = d.box.x + d.box.w / 2;
        const cy = d.box.y + d.box.h / 2;

        // Avoid duplicate IDs: if a nearby track of same class is still alive, don't spawn a new one.
        const hasNearbyTrack = this.tracks.some((t) => {
          const tx = t.bbox.x + t.bbox.w / 2;
          const ty = t.bbox.y + t.bbox.h / 2;
          const dist = Math.hypot(tx - cx, ty - cy);
          return dist <= this.maxReidCenterDistance;
        });
        if (hasNearbyTrack) return;

        this.trackIdCount++;

        // Allocate globally unique ID
        const globalId = this.globalRegistry.allocateId(this.source, this.viewerId, d.label);

        const kfInstance = new AdvancedKalman(cx, cy);

        this.tracks.push({
          id: this.trackIdCount,
          globalId, // NEW: Store global ID
          bbox: { ...d.box },
          label: d.label,
          conf: d.score,
          age: 1,
          hits: 1,
          tail: [{ x: cx, y: cy }],
          snapshots: [],
          contextSnapshots: [],
          zoomSnapshots: [],
          audited: false,
          processedLines: [],
          velocity: 0,
          velocityHistory: [],
          avgVelocity: 0,
          acceleration: 0,
          heading: 0,
          dwellTime: 0,
          kf: kfInstance,
          missedFrames: 0,
          isCoasting: false,
          labelHistory: [d.label],
          roiHistory: [],
        });

        logger.debug('BYTETRACKER', `Track ${globalId} allocated (${d.label})`);
      }
    });

    // 3. Occlusion/Exit Logic (Cleanup)
    this.tracks = this.tracks.filter((t, index) => {
      if (usedTracks.has(index)) return true;

      t.missedFrames++;
      t.isCoasting = true;

      // Prediction during coasting
      t.kf.step();
      t.bbox.x = t.kf.x - t.bbox.w / 2;
      t.bbox.y = t.kf.y - t.bbox.h / 2;

      // Exit conditions - desaparecer INMEDIATAMENTE cuando sale del viewport
      const isOutOfView =
        t.bbox.x < -this.outOfViewMargin ||
        t.bbox.x > 1 + this.outOfViewMargin ||
        t.bbox.y < -this.outOfViewMargin ||
        t.bbox.y > 1 + this.outOfViewMargin;

      const outCount = (this.outOfViewFramesByTrackId.get(t.id) || 0) + (isOutOfView ? 1 : -1);
      this.outOfViewFramesByTrackId.set(t.id, Math.max(0, outCount));

      if (t.missedFrames >= effectivePersistence) {
        this.outOfViewFramesByTrackId.delete(t.id);

        // Archive track before removal
        if (t.globalId) {
          const finalBBox = t.bbox;
          const totalDistance = Math.hypot(
            (t.tail[t.tail.length - 1]?.x || 0) - (t.tail[0]?.x || 0),
            (t.tail[t.tail.length - 1]?.y || 0) - (t.tail[0]?.y || 0)
          );
          this.globalRegistry.archiveTrack(t.globalId, finalBBox, totalDistance);
        }

        return false;
      }

      if (
        (this.outOfViewFramesByTrackId.get(t.id) || 0) > this.maxOutOfViewFrames &&
        t.missedFrames > 12
      ) {
        this.outOfViewFramesByTrackId.delete(t.id);

        // Archive track before removal
        if (t.globalId) {
          const finalBBox = t.bbox;
          const totalDistance = Math.hypot(
            (t.tail[t.tail.length - 1]?.x || 0) - (t.tail[0]?.x || 0),
            (t.tail[t.tail.length - 1]?.y || 0) - (t.tail[0]?.y || 0)
          );
          this.globalRegistry.archiveTrack(t.globalId, finalBBox, totalDistance);
        }

        return false;
      }

      return true;
    });

    return this.tracks;
  }

  /**
   * Get mapping of global IDs to current track state
   */
  getGlobalTrackMap(): Map<string, Track> {
    const map = new Map<string, Track>();
    this.tracks.forEach((t) => {
      if (t.globalId) {
        map.set(t.globalId, t);
      }
    });
    return map;
  }

  /**
   * Get global track registry instance
   */
  getGlobalRegistry(): GlobalTrackRegistry {
    return this.globalRegistry;
  }

  /**
   * Calculates Intersection over Union between two boxes.
   */
  private iou(box1: TrackBBox, box2: TrackBBox): number {
    if (!box1.w || !box2.w) return 0;
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.w, box2.x + box2.w);
    const y2 = Math.min(box1.y + box1.h, box2.y + box2.h);
    const w = Math.max(0, x2 - x1);
    const h = Math.max(0, y2 - y1);
    const inter = w * h;
    const area1 = box1.w * box1.h;
    const area2 = box2.w * box2.h;
    return inter / (area1 + area2 - inter);
  }
}
