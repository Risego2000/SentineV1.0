import { GeometryLine } from '../types';
import { VEHICLE_COLORS, LABEL_MAP } from '../constants';

export const renderScene = (
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    tracks: any[],
    geometry: GeometryLine[]
) => {
    if (!ctx || !video) return;

    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    // 1. Draw Video Frame
    // Asegurar que el canvas coincide con el video
    if (width !== video.videoWidth || height !== video.videoHeight) {
        ctx.canvas.width = video.videoWidth;
        ctx.canvas.height = video.videoHeight;
        // Necesitamos salir y esperar al siguiente frame para que el contexto se ajuste si hubo resize
        // o simplemente continuar con las nuevas dimensiones
    }

    // Dibujar imagen del video
    ctx.drawImage(video, 0, 0, width, height);

    // 2. Draw Geometry
    // 2. Draw Geometry (ENHANCED VISUALIZATION)
    geometry.forEach((line) => {
        const x1 = line.x1 * width;
        const y1 = line.y1 * height;
        const x2 = line.x2 * width;
        const y2 = line.y2 * height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);

        // Estilos diferenciados por tipo de línea
        ctx.setLineDash([]); // Reset

        if (line.type === 'forbidden') {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)'; // RED
            ctx.lineWidth = 3;
        } else if (line.type === 'stop_line') {
            ctx.strokeStyle = 'rgba(245, 158, 11, 1)'; // ORANGE/AMBER (Highvis)
            ctx.lineWidth = 4;
        } else if (line.type === 'lane_divider') {
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)'; // CYAN
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]); // Punteado
        } else {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; // Fallback
            ctx.lineWidth = 1;
        }

        ctx.stroke();
        ctx.setLineDash([]); // Cleanup

        // Endpoints (Anchors) para ver claramente inicio/fin
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill();

        // Line Label
        ctx.font = 'bold 11px monospace';
        ctx.fillText(line.label || line.type?.toUpperCase() || 'ZONE', (x1 + x2) / 2, (y1 + y2) / 2 - 5);
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

        // Label Simple (Sin fondo transparente costoso)
        ctx.fillStyle = color;
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText(`${label} #${track.id}`, x, y - 5);

        // 3.4 Forensic Audit Indicator
        // Asumimos que podemos marcar tracks bajo análisis
        if (track.crossedLine) { // Usamos crossedLine como proxy de "bajo análisis" o podemos añadir flag isAuditing
            ctx.save();
            ctx.strokeStyle = '#ef4444'; // Red for Alert
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);

            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('AUDITORÍA FORENSE EN CURSO...', x, y + h + 15);
            ctx.restore();
        }
    });
};
