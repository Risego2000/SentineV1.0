import { GeometryLine } from '../types';
import { VEHICLE_COLORS, LABEL_MAP } from '../constants';

export const renderScence = (
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
    geometry.forEach((line) => {
        const x1 = line.x1 * width;
        const y1 = line.y1 * height;
        const x2 = line.x2 * width;
        const y2 = line.y2 * height;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = line.type === 'forbidden' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(6, 182, 212, 0.8)';
        ctx.stroke();

        // Line Label
        ctx.fillStyle = line.type === 'forbidden' ? '#ef4444' : '#06b6d4';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(line.label || 'ZONA', x1 + 5, y1 - 5);
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

            // 3.2 Draw Predictive Vector (SOLID FUTURE)
            const last = points[points.length - 1];
            if (track.kf) {
                // Proyección visual amplificada
                const futurePoints = 5;
                const stepX = track.kf.vx * width * 5; // Paso de 5 frames aprox
                const stepY = track.kf.vy * height * 5;

                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 3; // Más grueso
                ctx.shadowColor = color;
                ctx.shadowBlur = 10; // Glow effect

                ctx.moveTo(last.x, last.y);

                let currX = last.x;
                let currY = last.y;

                // Dibujar curva predictiva suavizada (no recta simple)
                // Asumimos inercia lineal por ahora, pero podríamos añadir curvatura si tenemos velocidad angular
                const futureX = last.x + (track.kf.vx * width * 25);
                const futureY = last.y + (track.kf.vy * height * 25);

                ctx.lineTo(futureX, futureY);
                ctx.stroke();

                ctx.shadowBlur = 0; // Reset glow

                // Marcadores de tiempo futuro (Dots cada X distancia)
                for (let i = 1; i <= 3; i++) {
                    ctx.beginPath();
                    ctx.fillStyle = '#ffffff';
                    ctx.arc(last.x + (stepX * i), last.y + (stepY * i), 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Punta de flecha táctica
                ctx.beginPath();
                ctx.fillStyle = color;
                const headSize = 6;
                const angle = Math.atan2(futureY - last.y, futureX - last.x);
                ctx.translate(futureX, futureY);
                ctx.rotate(angle);
                ctx.moveTo(0, 0);
                ctx.lineTo(-headSize, -headSize / 2);
                ctx.lineTo(-headSize, headSize / 2);
                ctx.fill();
                ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            }
        }

        // 3.3 Draw Bounding Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // Label Background
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, y - 20, ctx.measureText(`${label} #${track.id}`).width + 10, 20);
        ctx.globalAlpha = 1.0;

        // Label Text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(`${label.toUpperCase()} #${track.id}`, x + 5, y - 6);

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
