import React, { useRef, useEffect } from 'react';
import { useSentinel } from '../context/SentinelContext';
import { useFrameProcessor } from '../hooks/useFrameProcessor';
import { LABEL_MAP } from '../constants';

interface TacticalOverlayProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

export const TacticalOverlay = ({ videoRef, canvasRef }: TacticalOverlayProps) => {
    const {
        geometry,
        isPlaying,
        isDetecting,
        systemStatus
    } = useSentinel();

    const { processFrame, trackerRef } = useFrameProcessor(videoRef, canvasRef);

    // Main render loop
    useEffect(() => {
        let anim: number;
        const loop = () => {
            const v = videoRef.current;
            const canvas = canvasRef.current;
            if (v && canvas) {
                const ctx = canvas.getContext('2d', { alpha: false });
                if (ctx) {
                    // Update canvas dimensions to parent (ignoring object-contain issues)
                    const p = canvas.parentElement;
                    if (p && (canvas.width !== p.clientWidth || canvas.height !== p.clientHeight)) {
                        canvas.width = p.clientWidth;
                        canvas.height = p.clientHeight;
                    }

                    // Clear and draw video if ready
                    ctx.fillStyle = '#01030d';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    if (v.readyState >= 2 && v.videoWidth > 0) {
                        const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
                        const dW = v.videoWidth * scale;
                        const dH = v.videoHeight * scale;
                        const oX = (canvas.width - dW) / 2;
                        const oY = (canvas.height - dH) / 2;

                        ctx.drawImage(v, oX, oY, dW, dH);

                        // 1. Draw Geometry Lines (The Paths)
                        geometry.forEach(line => {
                            const lx1 = line.x1 * dW + oX; const ly1 = line.y1 * dH + oY;
                            const lx2 = line.x2 * dW + oX; const ly2 = line.y2 * dH + oY;
                            ctx.strokeStyle = line.type === 'forbidden' ? '#ef4444' : '#22d3ee';
                            ctx.lineWidth = 3;
                            ctx.lineDashOffset = 0;
                            ctx.setLineDash([]);
                            ctx.beginPath(); ctx.moveTo(lx1, ly1); ctx.lineTo(lx2, ly2); ctx.stroke();

                            ctx.fillStyle = ctx.strokeStyle;
                            ctx.font = 'bold 10px "Share Tech Mono", monospace';
                            const lineLabel = (line.label || 'ZONA').toUpperCase();
                            ctx.fillText(lineLabel, lx1, ly1 - 8);
                        });

                        // 2. Draw Active Tracks
                        const tracks = trackerRef.current.tracks;
                        ctx.font = 'bold 10px "Share Tech Mono", monospace';

                        tracks.forEach((t) => {
                            const x = t.bbox.x * dW + oX;
                            const y = t.bbox.y * dH + oY;
                            const w = t.bbox.w * dW;
                            const h = t.bbox.h * dH;
                            const cx = x + w / 2;
                            const cy = y + h / 2;
                            const color = t.color || '#22d3ee';

                            // Trail
                            if (t.tail && t.tail.length > 2) {
                                ctx.beginPath();
                                ctx.strokeStyle = color;
                                ctx.lineWidth = 1;
                                ctx.globalAlpha = 0.4;
                                ctx.setLineDash([2, 4]);
                                for (let i = 0; i < t.tail.length; i++) {
                                    const tx = t.tail[i].x * dW + oX;
                                    const ty = t.tail[i].y * dH + oY;
                                    if (i === 0) ctx.moveTo(tx, ty);
                                    else ctx.lineTo(tx, ty);
                                }
                                ctx.stroke();
                                ctx.setLineDash([]);
                                ctx.globalAlpha = 1.0;
                            }

                            // Box
                            ctx.strokeStyle = color;
                            ctx.lineWidth = t.isCoasting ? 0.8 : 1.8;
                            if (t.isCoasting) ctx.setLineDash([5, 5]);
                            ctx.strokeRect(x, y, w, h);
                            ctx.setLineDash([]);
                            ctx.fillStyle = `${color}10`;
                            ctx.fillRect(x, y, w, h);

                            // Label
                            const spanishLabel = (LABEL_MAP[t.label.toLowerCase()] || t.label).toUpperCase();
                            const labelStr = `[CINÉTICO_${t.id}] ${spanishLabel}${t.isCoasting ? '_INERCIA' : ''}`;
                            const labelW = (labelStr.length * 6) + 12;
                            ctx.fillStyle = color;
                            ctx.fillRect(x, y - 16, labelW, 16);
                            ctx.fillStyle = 'black';
                            ctx.fillText(labelStr, x + 6, y - 4);

                            // Kinetic Vector
                            if (t.kf && (Math.abs(t.kf.vx) > 0.001 || Math.abs(t.kf.vy) > 0.001)) {
                                ctx.strokeStyle = color;
                                ctx.lineWidth = 2;
                                ctx.beginPath();
                                ctx.moveTo(cx, cy);
                                ctx.lineTo(cx + t.kf.vx * dW * 20, cy + t.kf.vy * dH * 20);
                                ctx.stroke();
                                const headlen = 6;
                                const angle = Math.atan2(t.kf.vy, t.kf.vx);
                                ctx.beginPath();
                                ctx.moveTo(cx + t.kf.vx * dW * 20, cy + t.kf.vy * dH * 20);
                                ctx.lineTo(cx + t.kf.vx * dW * 20 - headlen * Math.cos(angle - Math.PI / 6), cy + t.kf.vy * dH * 20 - headlen * Math.sin(angle - Math.PI / 6));
                                ctx.moveTo(cx + t.kf.vx * dW * 20, cy + t.kf.vy * dH * 20);
                                ctx.lineTo(cx + t.kf.vx * dW * 20 - headlen * Math.cos(angle + Math.PI / 6), cy + t.kf.vy * dH * 20 - headlen * Math.sin(angle + Math.PI / 6));
                                ctx.stroke();
                            }
                        });
                    } else if (geometry.length > 0) {
                        // Draw geometry even if video is not ready or paused without dimensions
                        // This part requires coordinates but without dW/dH it's hard.
                        // Usually we wait for the first frame.
                    }
                }
            }
            if (isPlaying) {
                processFrame();
            }
            anim = requestAnimationFrame(loop);
        };
        loop();
        return () => cancelAnimationFrame(anim);
    }, [geometry, isPlaying, processFrame, videoRef, canvasRef]);

    return null;
};
