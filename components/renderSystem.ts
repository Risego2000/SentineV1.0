import { GeometryLine } from '../types';
import { VEHICLE_COLORS, LABEL_MAP } from '../constants';

export const renderScene = (
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    tracks: any[],
    geometry: GeometryLine[]
) => {
    if (!ctx || !video) return;

    // 1. Draw Video Frame (Sync dimensions)
    // Asegurar que el canvas coincide con el video
    if (ctx.canvas.width !== video.videoWidth || ctx.canvas.height !== video.videoHeight) {
        ctx.canvas.width = video.videoWidth;
        ctx.canvas.height = video.videoHeight;
    }

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // Dibujar imagen del video
    ctx.drawImage(video, 0, 0, width, height);

    // 2. Draw Geometry
    // 2. Draw Geometry (ENHANCED VISUALIZATION)
    geometry.forEach((line) => {
        const x1 = line.x1 * width;
        const y1 = line.y1 * height;
        const x2 = line.x2 * width;
        const y2 = line.y2 * height;

        // --- DIBUJO DE POLÍGONOS (Box Junction / Áreas) ---
        if (line.type === 'box_junction' && line.points && line.points.length > 2) {
            ctx.beginPath();
            ctx.moveTo(line.points[0].x * width, line.points[0].y * height);
            for (let i = 1; i < line.points.length; i++) {
                ctx.lineTo(line.points[i].x * width, line.points[i].y * height);
            }
            ctx.closePath();

            ctx.fillStyle = 'rgba(245, 158, 11, 0.15)'; // Amber Fill
            ctx.fill();
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Label del área
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 10px monospace';
            ctx.fillText(line.label, line.points[0].x * width + 5, line.points[0].y * height + 15);
            return;
        }

        // --- DIBUJO DE LÍNEAS VECTORIALES ---
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        // Estilos diferenciados por tipo de línea
        ctx.setLineDash([]); // Reset
        let strokeColor = 'rgba(255, 255, 255, 0.5)';
        let lineWidth = 2;

        if (line.type === 'forbidden') {
            strokeColor = '#ef4444'; // RED
            lineWidth = 4;
            ctx.shadowColor = '#ef4444';
        } else if (line.type === 'stop_line') {
            strokeColor = '#f59e0b'; // AMBER
            lineWidth = 5;
            ctx.shadowColor = '#f59e0b';
        } else if (line.type === 'lane_divider') {
            strokeColor = '#06b6d4'; // CYAN
            lineWidth = 2;
            ctx.setLineDash([15, 10]);
            ctx.shadowColor = '#06b6d4';
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';

        // Glow Effect
        ctx.shadowBlur = 15;
        ctx.stroke();

        // Reset Shadow for high performance
        ctx.shadowBlur = 0;

        // Endpoints (Anchors) para ver claramente inicio/fin
        ctx.fillStyle = strokeColor;
        ctx.beginPath(); ctx.arc(x1, y1, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x2, y2, 5, 0, Math.PI * 2); ctx.fill();

        // Line Label
        ctx.fillStyle = '#fff';
        ctx.font = 'black 12px monospace';
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#000';
        ctx.fillText(line.label || line.type?.toUpperCase() || 'ZONE', (x1 + x2) / 2, (y1 + y2) / 2 - 10);
        ctx.shadowBlur = 0;
    });

    // 3. Draw Tracks
    tracks.forEach((track) => {
        // Escalar coordenadas normalizadas o absolutas?
        // ByteTracker devuelve cajas en formato (x, y, w, h). 
        // Asumiremos que están normalizadas si vienen del hook, o absolutas si ya fueron procesadas.
        // Revisando useFrameProcessor: "x: d.box.x, y: d.box.y..." donde d.box está normalizado.
        // PERO ByteTracker trabaja internamente. 
        // Depende de cómo las devolvamos. En useFrameProcessor las normalizamos al meterlas al tracker?
        // "activeTracks = trackerRef.current.update(...)". El tracker devuelve lo que le metes + ID.
        // Si le metimos normalizadas, devuelve normalizadas.

        const color = track.color || VEHICLE_COLORS[track.label] || '#ffffff';
        const label = LABEL_MAP[track.label] || track.label.toUpperCase();

        // Coordenadas normalizadas a píxeles
        const x = track.bbox.x * width;
        const y = track.bbox.y * height;
        const w = track.bbox.w * width;
        const h = track.bbox.h * height;

        // 3.1 Draw Trajectory (Tail - History)
        if (track.tail && track.tail.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const points = track.tail.map((p: any) => ({ x: p.x * width, y: p.y * height }));

            ctx.moveTo(points[0].x, points[0].y);
            if (points.length < 3) {
                // Simple line for few points
                points.forEach((p) => ctx.lineTo(p.x, p.y));
            } else {
                // Bezier curves for smooth path
                for (let i = 1; i < points.length - 1; i++) {
                    const xc = (points[i].x + points[i + 1].x) / 2;
                    const yc = (points[i].y + points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
            }
            // 3.1 Draw Historical Trajectory (Ghost Trail)
            ctx.setLineDash([2, 4]); // Punteado para el pasado
            ctx.globalAlpha = 0.4;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;

            // 3.2 ADVANCED PREDICTIVE VECTOR (Arrow System)
            const last = points[points.length - 1]; // Origen: Última posición conocida
            if (track.kf) {
                // Factor de proyección: Aumentar predicción para visibilidad
                const predictionFactor = 25;
                const vx = track.kf.vx * width;
                const vy = track.kf.vy * height;

                // Calcular destino
                const futureX = last.x + (vx * predictionFactor);
                const futureY = last.y + (vy * predictionFactor);

                // Ángulo del vector (para rotar la flecha)
                const angle = Math.atan2(futureY - last.y, futureX - last.x);
                const arrowLength = Math.hypot(futureX - last.x, futureY - last.y);

                // Dibujar solo si hay movimiento significativo (> 5px)
                if (arrowLength > 5) {
                    ctx.save();
                    ctx.translate(last.x, last.y);
                    ctx.rotate(angle);

                    // --- CUERPO DE LA FLECHA (Gradient) ---
                    const grad = ctx.createLinearGradient(0, 0, arrowLength, 0);
                    grad.addColorStop(0, color); // Color del vehículo
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0)'); // Desvanecer al final

                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(arrowLength - 5, 0); // Dejar espacio para la punta
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 3;
                    ctx.stroke();

                    // --- PUNTA DE FLECHA (Tactical Triangle) ---
                    ctx.translate(arrowLength, 0); // Mover al final
                    ctx.beginPath();
                    ctx.moveTo(0, 0); // Punta
                    ctx.lineTo(-8, -4); // Base izquierda
                    ctx.lineTo(-6, 0);  // Centro hundido (estilo flecha rápida)
                    ctx.lineTo(-8, 4);  // Base derecha
                    ctx.closePath();

                    ctx.fillStyle = color;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = 10; // Glow effect
                    ctx.fill();

                    // Restaurar contexto
                    ctx.restore();
                }
            }
        }

        // 3.3 Draw Bounding Box (PERFORMANCE MODE)
        // Usamos solo esquinas ("Brackets") para reducir el área de dibujado y oclusión
        const lineLen = Math.min(w, h) * 0.2;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        // Top-Left
        ctx.moveTo(x, y + lineLen); ctx.lineTo(x, y); ctx.lineTo(x + lineLen, y);
        // Top-Right
        ctx.moveTo(x + w - lineLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + lineLen);
        // Bottom-Right
        ctx.moveTo(x + w, y + h - lineLen); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - lineLen, y + h);
        // Bottom-Left
        ctx.moveTo(x + lineLen, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - lineLen);

        ctx.stroke();

        // Label Dinámico con Telemetría
        ctx.fillStyle = color;
        ctx.font = 'bold 10px sans-serif';
        const speedText = track.avgVelocity ? ` | ${(track.avgVelocity * 100).toFixed(1)} km/h` : ''; // Estimación visual
        ctx.fillText(`${label} #${track.id}${speedText}`, x, y - 5);

        // --- VISUALIZACIÓN DE EVENTOS TÁCTICOS ---

        // 1. Alertas de Comportamiento Anómalo
        if (track.isAnomalous && track.anomalyLabel) {
            ctx.fillStyle = '#facc15'; // Yellow
            ctx.font = 'black 9px monospace';
            ctx.fillText(`⚠ ${track.anomalyLabel.toUpperCase()}`, x, y - 18);

            // Halo de advertencia
            ctx.strokeStyle = '#facc15';
            ctx.setLineDash([2, 2]);
            ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
            ctx.setLineDash([]);
        }

        // 2. Alerta de Colisión Inminente
        if (track.potentialCollision) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(x + w / 2, y + h / 2, Math.max(w, h) * 0.8, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#ef4444';
            ctx.font = 'black 10px monospace';
            ctx.fillText('☢ RIESGO COLISIÓN', x, y + h + 12);
        }

        // 3. Indicador de Auditoría Forense Activa
        if (track.audited) {
            ctx.save();
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);

            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 9px monospace';
            ctx.fillText('EV_CONFIRMADO: REPORTE IA GENERADO', x, y + h + 25);
            ctx.restore();
        }
    });
};
