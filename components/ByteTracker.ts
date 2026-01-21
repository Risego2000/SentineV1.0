// Advanced Motion Model for Tactical Tracking
class AdvancedKalman {
    // State: [x, y, vx, vy, ax, ay]
    x: number; y: number;
    vx: number = 0; vy: number = 0;
    ax: number = 0; ay: number = 0;

    // Smoothness factors - Refined for jitter reduction
    // Increasing alpha/beta slightly for responsiveness while keeping gravity on acceleration
    alpha = 0.65; // Position filter (lower = smoother, less jumpy)
    beta = 0.15;  // Velocity filter (lower = smoother velocity transition)
    gamma = 0.02; // Acceleration filter (very low to avoid erratic jumps)

    constructor(x: number, y: number) {
        this.x = x; this.y = y;
    }

    update(mx: number, my: number, dt: number = 1) {
        // Predict position based on current velocity and acc
        const px = this.x + this.vx * dt + 0.5 * this.ax * dt * dt;
        const py = this.y + this.vy * dt + 0.5 * this.ay * dt * dt;

        // Residue (innovation)
        const rx = mx - px;
        const ry = my - py;

        // Correct State softly to avoid "jumps"
        this.x = px + this.alpha * rx;
        this.y = py + this.alpha * ry;

        // Velocity update with damping
        const targetVx = (this.beta / dt) * rx;
        const targetVy = (this.beta / dt) * ry;
        this.vx += targetVx;
        this.vy += targetVy;

        // Acceleration update (minimal influence)
        this.ax += (this.gamma / (dt * dt)) * rx;
        this.ay += (this.gamma / (dt * dt)) * ry;
    }

    step(dt: number = 1) {
        // Constant velocity motion model for coasting
        this.x += this.vx * dt + 0.5 * this.ax * dt * dt;
        this.y += this.vy * dt + 0.5 * this.ay * dt * dt;

        // Apply friction/damping during coasting to avoid drifting indefinitely
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    getVelocity() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    getHeading() {
        // Only update heading if there's significant movement to avoid flickering
        if (this.getVelocity() < 0.001) return 0;
        return Math.atan2(this.vy, this.vx);
    }
}

export class ByteTracker {
    tracks: any[] = [];
    trackIdCount = 0;

    // Advanced Trajectory Step (Motion Prediction)
    step() {
        this.tracks.forEach(t => {
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

    update(detections: { x: number, y: number, w: number, h: number, score: number, label: string }[], persistence: number = 30) {
        const iouMatrix = this.tracks.map(t =>
            detections.map(d => this.iou(t.bbox, d))
        );

        const usedDets = new Set<number>();
        const usedTracks = new Set<number>();

        // 1. Kinetic Re-identification (Match existing tracks)
        for (let i = 0; i < this.tracks.length; i++) {
            let bestIoU = 0; let bestDet = -1;
            for (let j = 0; j < detections.length; j++) {
                if (usedDets.has(j)) continue;
                if (iouMatrix[i][j] > bestIoU) {
                    bestIoU = iouMatrix[i][j];
                    bestDet = j;
                }
            }

            if (bestIoU > 0.25) { // Increased threshold to avoid Jumps between close objects
                usedDets.add(bestDet);
                usedTracks.add(i);

                const t = this.tracks[i];
                const d = detections[bestDet];
                const cx = d.x + d.w / 2;
                const cy = d.h ? d.y + d.h / 2 : d.y; // Handle points if w/h missing

                t.kf.update(cx, cy);
                t.hits++; // Real detection match

                // Box Interpolation for smoother visuals
                t.bbox.w = t.bbox.w * 0.8 + d.w * 0.2;
                t.bbox.h = t.bbox.h * 0.8 + d.h * 0.2;
                t.bbox.x = t.kf.x - t.bbox.w / 2;
                t.bbox.y = t.kf.y - t.bbox.h / 2;

                t.score = d.score;
                t.missedFrames = 0;
                t.isCoasting = false;

                // Track Telemetry
                t.velocity = t.kf.getVelocity();
                t.heading = t.kf.getHeading();
                t.tail.push({ x: cx, y: cy });
                if (t.tail.length > 100) t.tail.shift();
            }
        }

        // 2. Genesis (New Track Initialization)
        detections.forEach((d, i) => {
            if (!usedDets.has(i) && d.score > 0.45) {
                this.trackIdCount++;
                const cx = d.x + d.w / 2;
                const cy = d.y + d.h / 2;

                const colors: Record<string, string> = {
                    car: '#22d3ee', truck: '#fb923c', bus: '#4ade80', motorcycle: '#a78bfa', person: '#f472b6'
                };

                this.tracks.push({
                    id: this.trackIdCount,
                    bbox: { ...d },
                    label: d.label,
                    score: d.score,
                    missedFrames: 0,
                    isCoasting: false,
                    hits: 1, // First detection
                    tail: [{ x: cx, y: cy }],
                    color: colors[d.label.toLowerCase()] || '#00ff99',
                    kf: new AdvancedKalman(cx, cy),
                    velocity: 0,
                    heading: 0,
                    processedLines: []
                });
            }
        });

        // 3. Occlusion/Exit Logic (Cleanup)
        this.tracks = this.tracks.filter(t => {
            if (usedTracks.has(this.tracks.indexOf(t))) return true;
            t.missedFrames++;
            t.isCoasting = true;

            // Prediction during coasting
            t.kf.step();
            t.bbox.x = t.kf.x - t.bbox.w / 2;
            t.bbox.y = t.kf.y - t.bbox.h / 2;

            // Exit conditions (out of bounds or too many missed)
            const isOutOfView = t.bbox.x < -0.2 || t.bbox.x > 1.2 || t.bbox.y < -0.2 || t.bbox.y > 1.2;
            return t.missedFrames < persistence && !isOutOfView;
        });

        return this.tracks;
    }

    iou(box1: { x: number, y: number, w: number, h: number }, box2: { x: number, y: number, w: number, h: number }) {
        if (!box1.w || !box2.w) return 0; // Guard for zero-size
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
