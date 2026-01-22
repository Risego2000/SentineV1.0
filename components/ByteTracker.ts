// Advanced Motion Model for Tactical Tracking
class AdvancedKalman {
    // State: [x, y, vx, vy]
    x: number; y: number;
    vx: number = 0; vy: number = 0;

    // Smoothness factors - Prioritizing stability for the arrow
    alpha = 0.85; // Aumentado para mayor reactividad (evita lag)
    beta = 0.15;  // Aumentado para que el vector de velocidad se adapte más rápido

    constructor(x: number, y: number) {
        this.x = x; this.y = y;
    }

    update(mx: number, my: number, dt: number = 1) {
        // Predict position
        const px = this.x + this.vx * dt;
        const py = this.y + this.vy * dt;

        // Residue (innovation)
        const rx = mx - px;
        const ry = my - py;

        // Correct Position
        this.x = px + this.alpha * rx;
        this.y = py + this.alpha * ry;

        // Update Velocity with extreme inertia to stabilize the arrow
        const instantVx = rx / dt;
        const instantVy = ry / dt;

        // Exponential moving average for velocity (The Arrow)
        this.vx = this.vx * (1 - this.beta) + instantVx * this.beta;
        this.vy = this.vy * (1 - this.beta) + instantVy * this.beta;
    }

    step(dt: number = 1) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        // Natural damping
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    getVelocity() {
        return Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    }

    getHeading() {
        // Higher deadzone to prevent arrow flickering when stopped
        if (this.getVelocity() < 0.008) return 0;
        return Math.atan2(this.vy, this.vx);
    }
}

export class ByteTracker {
    tracks: any[] = [];
    trackIdCount = 0;

    reset() {
        this.tracks = [];
        this.trackIdCount = 0;
    }

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

    update(detections: { x: number, y: number, w: number, h: number, score: number, label: string }[], persistence: number = 30, minScore: number = 0.25) {
        const iouMatrix = this.tracks.map(t =>
            detections.map(d => this.iou(t.bbox, d))
        );

        const usedDets = new Set<number>();
        const usedTracks = new Set<number>();

        // 1. Kinetic Re-identification
        for (let i = 0; i < this.tracks.length; i++) {
            let bestIoU = 0; let bestDet = -1;
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
                const cx = d.x + d.w / 2;
                const cy = d.y + d.h / 2;

                t.kf.update(cx, cy);
                t.hits++;

                // ACTUALIZACIÓN DE ETIQUETA POR VOTACIÓN (Temporal Smoothing)
                if (!t.labelHistory) t.labelHistory = [];
                t.labelHistory.push(d.label);
                if (t.labelHistory.length > 30) t.labelHistory.shift();

                // Calcular la moda del historial para estabilizar la clasificación
                const counts: Record<string, number> = {};
                t.labelHistory.forEach((lbl: string) => counts[lbl] = (counts[lbl] || 0) + 1);
                const modeLabel = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);

                // Refinamiento por Aspect Ratio (Sanity Check)
                const aspectRatio = d.w / d.h;
                if (modeLabel === 'truck' && aspectRatio > 1.2 && d.h < 0.25) {
                    t.label = 'car';
                } else {
                    t.label = modeLabel;
                }

                // --- TELEMETRÍA AVANZADA (Heuristic Engine) ---
                const newVelocity = t.kf.getVelocity();
                const newHeading = t.kf.getHeading();
                const deltaV = newVelocity - t.velocity;

                // Suavizado de velocidad 
                if (!t.velocityHistory) t.velocityHistory = [];
                t.velocityHistory.push(newVelocity);
                if (t.velocityHistory.length > 15) t.velocityHistory.shift();

                const avgNormVel = t.velocityHistory.reduce((a: number, b: number) => a + b, 0) / t.velocityHistory.length;

                // CALIBRACIÓN DINÁMICA (3 metros por carril)
                // Asumimos que el ancho promedio de un carril en perspectiva (0.15 norm) = 3 metros
                // 1 unit = 20 meters (aprox en base a carril de 3m ocupando el 15% de pantalla)
                const METERS_PER_UNIT = 20;
                const FPS = 30;
                t.avgVelocity = avgNormVel * METERS_PER_UNIT * FPS * 3.6; // km/h

                // Lógica de Permanencia (Dwell Time)
                if (newVelocity < 0.002) {
                    t.dwellTime += 33;
                } else {
                    t.dwellTime = 0;
                }

                t.acceleration = deltaV;
                t.velocity = newVelocity;
                t.heading = newHeading;

                // --- DETECCIÓN DE COMPORTAMIENTO ANÓMALO (Heurística de Tráfico) ---
                const isPanicBrake = deltaV < -0.05;
                const isSuddenAccel = deltaV > 0.05;
                const isErraticSteer = Math.abs(newHeading - t.heading) > 1.0;

                // Sentido Contrario (Necesita referencia, por ahora heurística de ángulo constante opuesto)
                // ... (Implementar con referencia de carril en el futuro)

                t.isAnomalous = isPanicBrake || isSuddenAccel || isErraticSteer;

                if (t.isAnomalous) {
                    if (isPanicBrake) t.anomalyLabel = 'Frenado de Emergencia';
                    else if (isSuddenAccel) t.anomalyLabel = 'Aceleración Brusca';
                    else if (isErraticSteer) t.anomalyLabel = 'Maniobra Errática';
                } else {
                    t.anomalyLabel = undefined;
                }

                // --- PREDICCIÓN DE COLISIÓN (Proyectar trayectoria a 20 frames) ---
                t.potentialCollision = false;
                const lookahead = 20;
                t.futurePos = {
                    x: t.kf.x + t.kf.vx * lookahead,
                    y: t.kf.y + t.kf.vy * lookahead
                };

                t.bbox.w = d.w;
                t.bbox.h = d.h;
                t.bbox.x = t.kf.x - d.w / 2;
                t.bbox.y = t.kf.y - d.h / 2;

                t.score = d.score;
                t.missedFrames = 0;
                t.isCoasting = false;

                // Actualizar tail
                t.tail.push({ x: cx, y: cy });
                if (t.tail.length > 50) t.tail.shift();
            }
        }

        // --- MOTOR DE COLISIONES CROSS-TRACK ---
        for (let i = 0; i < this.tracks.length; i++) {
            for (let j = i + 1; j < this.tracks.length; j++) {
                const t1 = this.tracks[i];
                const t2 = this.tracks[j];
                if (!t1.futurePos || !t2.futurePos) continue;

                // Si las posiciones futuras proyectadas están muy cerca (< 5% del ancho total)
                const dist = Math.hypot(t1.futurePos.x - t2.futurePos.x, t1.futurePos.y - t2.futurePos.y);
                if (dist < 0.05 && t1.velocity > 0.01 && t2.velocity > 0.01) {
                    t1.potentialCollision = true;
                    t2.potentialCollision = true;
                    t1.collisionTargetId = t2.id;
                    t2.collisionTargetId = t1.id;
                }
            }
        }

        // 2. Genesis
        detections.forEach((d, i) => {
            if (!usedDets.has(i) && d.score > minScore) {
                this.trackIdCount++;
                const cx = d.x + d.w / 2;
                const cy = d.y + d.h / 2;

                const colors: Record<string, string> = {
                    car: '#22d3ee', truck: '#fb923c', bus: '#4ade80', motorcycle: '#a78bfa',
                    person: '#f472b6', bicycle: '#06b6d4', van: '#f59e0b', moped: '#8b5cf6'
                };

                const kfInstance = new AdvancedKalman(cx, cy);

                this.tracks.push({
                    id: this.trackIdCount,
                    bbox: { ...d },
                    label: d.label,
                    labelHistory: [d.label], // Inicializar historial
                    velocityHistory: [],     // Inicializar telemetría
                    avgVelocity: 0,
                    score: d.score,
                    missedFrames: 0,
                    isCoasting: false,
                    hits: 1,
                    tail: [{ x: cx, y: cy }],
                    color: colors[d.label.toLowerCase()] || '#00ff99',
                    kf: kfInstance,
                    velocity: 0,
                    heading: 0,
                    acceleration: 0,
                    headingChange: 0,
                    dwellTime: 0, // Iniciar temporizador de permanencia
                    isAnomalous: false,
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
