import { GeometryLine, Track } from '../types';
import { VEHICLE_COLORS, LABEL_MAP } from '../constants';

export const renderScene = (
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  tracks: Track[],
  geometry: GeometryLine[],
  isMeshRenderEnabled: boolean = false
) => {
  if (!ctx || !video) return;

  // 1. Draw Video Frame (Sync dimensions)
  if (ctx.canvas.width !== video.videoWidth || ctx.canvas.height !== video.videoHeight) {
    ctx.canvas.width = video.videoWidth;
    ctx.canvas.height = video.videoHeight;
  }

  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  ctx.save();
  try {
    // Dibujar imagen del video
    ctx.drawImage(video, 0, 0, width, height);

    // 2. Draw Geometry
    geometry.forEach((line) => {
      ctx.save();
      const opacity = isMeshRenderEnabled ? 0.3 : 1.0;
      ctx.globalAlpha = opacity;

      // Renderizado unificado de Geometría (Líneas y Polígonos)
      const polyPoints =
        line.points && line.points.length > 1
          ? line.points
          : [
              { x: line.x1, y: line.y1 },
              { x: line.x2, y: line.y2 },
            ];

      ctx.beginPath();
      ctx.moveTo(polyPoints[0].x * width, polyPoints[0].y * height);
      for (let i = 1; i < polyPoints.length; i++) {
        ctx.lineTo(polyPoints[i].x * width, polyPoints[i].y * height);
      }

      const isClosed = line.type === 'box_junction';
      if (isClosed) ctx.closePath();

      // Estilos tácticos
      ctx.setLineDash([]);
      let strokeColor = 'rgba(255, 255, 255, 0.5)';
      let lineWidth = 2;

      if (line.type === 'forbidden') {
        strokeColor = '#ef4444';
        lineWidth = 4;
        ctx.shadowColor = '#ef4444';
      } else if (line.type === 'stop_line') {
        strokeColor = '#f59e0b';
        lineWidth = 5;
        ctx.shadowColor = '#f59e0b';
      } else if (line.type === 'lane_divider') {
        strokeColor = '#06b6d4';
        lineWidth = 2;
        ctx.setLineDash([15, 10]);
        ctx.shadowColor = '#06b6d4';
      } else if (line.type === 'pedestrian' || line.type === 'bus_lane') {
        strokeColor = line.type === 'bus_lane' ? '#f97316' : '#06b6d4';
        lineWidth = 3;
        ctx.shadowColor = strokeColor;
      }

      if (isClosed) {
        ctx.fillStyle = `${strokeColor}26`; // 15% opacity fill
        ctx.fill();
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // Endpoints (Nodos de control)
      if (isMeshRenderEnabled) {
        ctx.fillStyle = strokeColor;
        polyPoints.forEach((p) => {
          ctx.beginPath();
          ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      // Label descriptivo
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#000';
      const midPoint = polyPoints[Math.floor(polyPoints.length / 2)];
      ctx.fillText(
        line.label || line.type?.toUpperCase(),
        midPoint.x * width + 5,
        midPoint.y * height - 5
      );
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.restore();
    });

    // 3. Draw Tracks
    tracks.forEach((track) => {
      ctx.save();
      const color = track.color || VEHICLE_COLORS[track.label] || '#ffffff';
      const label = LABEL_MAP[track.label] || track.label.toUpperCase();

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

        const points = track.tail.map((p: { x: number; y: number }) => ({
          x: p.x * width,
          y: p.y * height,
        }));

        ctx.moveTo(points[0].x, points[0].y);
        if (points.length < 3) {
          points.forEach((p) => ctx.lineTo(p.x, p.y));
        } else {
          for (let i = 1; i < points.length - 1; i++) {
            const xc = (points[i].x + points[i + 1].x) / 2;
            const yc = (points[i].y + points[i + 1].y) / 2;
            ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
          }
          ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
        }
        ctx.setLineDash([2, 4]);
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        // 3.2 ADVANCED PREDICTIVE VECTOR
        const last = points[points.length - 1];
        if (track.kf) {
          const predictionFactor = 25;
          const vx = track.kf.vx * width;
          const vy = track.kf.vy * height;

          const futureX = last.x + vx * predictionFactor;
          const futureY = last.y + vy * predictionFactor;

          const angle = Math.atan2(futureY - last.y, futureX - last.x);
          const arrowLength = Math.hypot(futureX - last.x, futureY - last.y);

          if (arrowLength > 5) {
            ctx.save();
            ctx.translate(last.x, last.y);
            ctx.rotate(angle);

            const grad = ctx.createLinearGradient(0, 0, arrowLength, 0);
            grad.addColorStop(0, color);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(arrowLength - 5, 0);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.translate(arrowLength, 0);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-8, -4);
            ctx.lineTo(-6, 0);
            ctx.lineTo(-8, 4);
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.restore();
          }
        }
      }

      // 3.3 Draw Bounding Box
      const lineLen = Math.min(w, h) * 0.2;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y + lineLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + lineLen, y);
      ctx.moveTo(x + w - lineLen, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + lineLen);
      ctx.moveTo(x + w, y + h - lineLen);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w - lineLen, y + h);
      ctx.moveTo(x + lineLen, y + h);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x, y + h - lineLen);
      ctx.stroke();

      // 3.4 TELEMETRY DATA PANEL
      const speedKmh = track.avgVelocity.toFixed(1);
      const dwellSeconds = (track.dwellTime / 1000).toFixed(1);
      const telemetryString = `${label} #${track.id} | ${speedKmh} km/h | ${dwellSeconds}s`;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      const labelWidth = ctx.measureText(telemetryString).width;
      ctx.fillRect(x, y - 18, labelWidth + 10, 14);

      ctx.fillStyle = color;
      ctx.font = 'bold 9px monospace';
      ctx.fillText(telemetryString, x + 5, y - 8);

      // 3.5 ANOMALY ALERTS
      if (track.isAnomalous && track.anomalyLabel) {
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`⚠ ${track.anomalyLabel.toUpperCase()}`, x, y - 28);
        ctx.strokeStyle = '#facc15';
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
        ctx.setLineDash([]);
      }

      // 3.6 COLLISION WARNING
      if (track.potentialCollision) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, Math.max(w, h) * 0.7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px monospace';
        ctx.fillText('☢ PELIGRO DE COLISIÓN', x, y + h + 15);
      }

      // 3.7 AUDIT STATUS (Criminal Record Found)
      if (track.audited) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 2]);
        ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('EVIDENCIA_CERTIFICADA (GEMINI AI)', x, y + h + 28);
        ctx.restore();
      }
      ctx.restore();
    });
  } finally {
    ctx.restore();
  }
};
