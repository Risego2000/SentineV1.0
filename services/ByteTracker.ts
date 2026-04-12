import { Track, IKalman, TrackBBox, StandardDetection } from '../types';

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
 */
export class ByteTracker {
  /** Active tracks managed by the engine */
  tracks: Track[] = [];
  /** Global track ID counter */
  private trackIdCount = 0;

  /**
   * Resets the tracker state.
   */
  reset(): void {
    this.tracks = [];
    this.trackIdCount = 0;
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

      // Append predicted centroid to tail for fluid visuals
      t.tail.push({ x: t.kf.x, y: t.kf.y });
      if (t.tail.length > 100) t.tail.shift();
    });
    return this.tracks;
  }

  /**
   * Updates tracks with new detections using IoU matching and kinetic refinement.
   */
  update(
    detections: StandardDetection[],
    persistence: number = 30,
    minScore: number = 0.25
  ): Track[] {
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

      if (bestIoU > 0.15) {
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

        // Residence Time (Dwell Time)
        // More forgiving threshold (0.01 instead of 0.002) to account for slight motion/noise
        if (newVelocity < 0.01) {
          t.dwellTime += 33; // ~33ms per frame
        } else {
          t.dwellTime = 0;
        }

        t.acceleration = deltaV;
        t.velocity = newVelocity;
        t.heading = newHeading;

        // --- ANOMALY DETECTION ---
        const isPanicBrake = deltaV < -0.05;
        const isSuddenAccel = deltaV > 0.05;
        const isErraticSteer = Math.abs(newHeading - t.heading) > 1.0;

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

        // Update tail
        t.tail.push({ x: cx, y: cy });
        if (t.tail.length > 50) t.tail.shift();
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
        this.trackIdCount++;
        const cx = d.box.x + d.box.w / 2;
        const cy = d.box.y + d.box.h / 2;

        const kfInstance = new AdvancedKalman(cx, cy);

        this.tracks.push({
          id: this.trackIdCount,
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
        });
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

      // Exit conditions
      const isOutOfView = t.bbox.x < -0.2 || t.bbox.x > 1.2 || t.bbox.y < -0.2 || t.bbox.y > 1.2;
      return t.missedFrames < persistence && !isOutOfView;
    });

    return this.tracks;
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
