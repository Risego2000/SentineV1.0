// Simple Constant Velocity Kalman Filter
class KalmanFilter {
    // State: [x, y, vx, vy]
    x: number; y: number;
    vx: number = 0; vy: number = 0;

    constructor(x: number, y: number) {
        this.x = x; this.y = y;
    }

    // Simple Alpha-Beta Filter (Zero-Dependency High Performance)
    // Good enough for visual trajectory prediction
    update(mx: number, my: number, dt: number = 1) {
        const alpha = 0.85;
        const beta = 0.05;

        // Prediction
        const px = this.x + this.vx * dt;
        const py = this.y + this.vy * dt;

        // Residual
        const rx = mx - px;
        const ry = my - py;

        // Correction
        this.x = px + alpha * rx;
        this.y = py + alpha * ry;
        this.vx = this.vx + (beta / dt) * rx;
        this.vy = this.vy + (beta / dt) * ry;
    }

    predict(steps: number) {
        return {
            x: this.x + this.vx * steps,
            y: this.y + this.vy * steps
        };
    }
}

export class ByteTracker {
    tracks: any[] = [];
    trackIdCount = 0;

    update(detections: { x: number, y: number, w: number, h: number, score: number, label: string }[]) {
        // Cost Matrix (IoU)
        const iouMatrix = this.tracks.map(t =>
            detections.map(d => this.iou(t.bbox, d))
        );

        const usedDets = new Set<number>();
        const usedTracks = new Set<number>();
        const matches: any[] = [];

        // Association
        for (let i = 0; i < this.tracks.length; i++) {
            let bestIoU = 0; let bestDet = -1;
            for (let j = 0; j < detections.length; j++) {
                if (usedDets.has(j)) continue;
                if (iouMatrix[i][j] > bestIoU) {
                    bestIoU = iouMatrix[i][j];
                    bestDet = j;
                }
            }

            if (bestIoU > 0.3) {
                matches.push({ trackIdx: i, detIdx: bestDet });
                usedDets.add(bestDet);
                usedTracks.add(i);

                const t = this.tracks[i];
                const d = detections[bestDet];

                // KF Update
                const cx = d.x + d.w / 2;
                const cy = d.y + d.h / 2;
                t.kf.update(cx, cy);

                t.bbox = d;
                t.missedFrames = 0;
                t.history.push(t.bbox);
            }
        }

        // New Tracks
        detections.forEach((d, i) => {
            if (!usedDets.has(i)) {
                this.trackIdCount++;
                const cx = d.x + d.w / 2;
                const cy = d.y + d.h / 2;

                // Color mapping: Car (cyan), Truck (orange), Bus (green), Bike (purple)
                const colors: Record<string, string> = {
                    car: '#22d3ee',
                    truck: '#fb923c',
                    bus: '#4ade80',
                    motorcycle: '#a78bfa',
                    person: '#f472b6'
                };

                this.tracks.push({
                    id: this.trackIdCount,
                    bbox: d,
                    label: d.label,
                    missedFrames: 0,
                    history: [d],
                    color: colors[d.label.toLowerCase()] || '#00ff99',
                    kf: new KalmanFilter(cx, cy), // Initialize Filter
                    processedLines: []
                });
            }
        });

        // Lost Tracks Management
        this.tracks = this.tracks.filter(t => {
            if (usedTracks.has(this.tracks.indexOf(t))) return true;
            t.missedFrames++;

            // Predict position (Coast)
            const p = t.kf.predict(1);
            t.kf.x = p.x; t.kf.y = p.y;

            // Move bbox
            t.bbox.x = p.x - t.bbox.w / 2;
            t.bbox.y = p.y - t.bbox.h / 2;

            return t.missedFrames < 30;
        });

        return this.tracks;
    }

    iou(box1: { x: number, y: number, w: number, h: number }, box2: { x: number, y: number, w: number, h: number }) {
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
