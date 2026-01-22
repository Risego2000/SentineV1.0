import React, { useEffect, useState, useRef } from 'react';
import { useSentinel } from '../../hooks/useSentinel';

interface VideoTimelineProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
}

export const VideoTimeline: React.FC<VideoTimelineProps> = ({ videoRef }) => {
    const { logs, isPlaying } = useSentinel();
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const timelineRef = useRef<HTMLDivElement>(null);

    // Sincronización con el video
    useEffect(() => {
        let animationFrame: number;
        const updateProgress = () => {
            if (videoRef.current) {
                const v = videoRef.current;
                if (!isNaN(v.duration)) {
                    setDuration(v.duration);
                    setProgress((v.currentTime / v.duration) * 100);
                }
            }
            if (isPlaying) {
                animationFrame = requestAnimationFrame(updateProgress);
            }
        };

        if (isPlaying || (videoRef.current && !videoRef.current.paused)) {
            updateProgress();
        } else {
            updateProgress();
        }

        return () => cancelAnimationFrame(animationFrame);
    }, [isPlaying, videoRef]);

    const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current || !videoRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        const newTime = (x / width) * videoRef.current.duration;
        videoRef.current.currentTime = newTime;
        setProgress((newTime / videoRef.current.duration) * 100);
    };

    // Filter only actual infractions for timeline markers
    const incidentLogs = logs.filter(l => l.infraction === true);

    // Formateador de tiempo táctico
    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return "00:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const f = Math.floor((seconds % 1) * 100); // centésimas para el toque pro

        let res = "";
        if (h > 0) res += `${h.toString().padStart(2, '0')}:`;
        res += `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${res}.${f.toString().padStart(2, '0')}`;
    };

    return (
        <div className="absolute bottom-[112px] left-10 right-10 z-40 bg-gradient-to-t from-black/20 to-transparent pt-4 pb-2">
            {/* Header del Timeline: Código de Tiempo */}
            <div className="flex justify-between items-end mb-3">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-cyan-500/40 uppercase tracking-[0.3em]">Live Vector Tracking</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black text-white font-mono tracking-tighter shadow-cyan-500/20 drop-shadow-lg">
                            {formatTime(progress * duration / 100)}
                        </span>
                        <span className="text-xs font-bold text-slate-500 font-mono opacity-50">
                            / {formatTime(duration)}
                        </span>
                    </div>
                </div>

                <div className="text-right">
                    <span className="text-[10px] font-black text-red-500/40 uppercase tracking-[0.3em]">Incidents Detected</span>
                    <div className="text-xl font-black text-red-500 font-mono tracking-widest drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]">
                        {incidentLogs.length.toString().padStart(2, '0')}
                    </div>
                </div>
            </div>

            {/* Contenedor Táctico de la Barra */}
            <div className="relative group">
                {/* Fondo y Borde Táctico (La barra ahora es más delgada y elegante) */}
                <div
                    ref={timelineRef}
                    onClick={handleTimelineClick}
                    className="h-1.5 bg-slate-900/60 backdrop-blur-md rounded-full border border-white/5 cursor-pointer overflow-hidden relative transition-all duration-300 group-hover:h-3 group-hover:border-cyan-500/20"
                >
                    {/* Barra de Progreso */}
                    <div
                        className="h-full bg-gradient-to-r from-cyan-600/80 to-cyan-400 relative transition-all ease-linear"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute right-0 top-0 bottom-0 w-px bg-white shadow-[0_0_10px_rgba(255,255,255,1)]" />
                    </div>
                </div>

                {/* Marcadores de Incidentes (Flotando ENCIMA de la barra) */}
                {incidentLogs.map((log, i) => {
                    // Fallback visual position
                    const simulatedPos = ((i + 1) / (incidentLogs.length + 1)) * 100;

                    return (
                        <div
                            key={i}
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rotate-45 border-2 border-black shadow-[0_0_10px_rgba(239,68,68,0.8)] cursor-pointer group/marker transition-transform hover:scale-125 z-20 flex items-center justify-center"
                            style={{ left: `calc(${simulatedPos}% - 8px)` }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (videoRef.current) {
                                    videoRef.current.currentTime = videoRef.current.duration * (simulatedPos / 100);
                                }
                            }}
                        >
                            <div className="w-1 h-1 bg-white rounded-full" />

                            {/* Tooltip Táctico */}
                            <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 opacity-0 group-hover/marker:opacity-100 transition-opacity bg-black/90 border border-red-500/50 px-3 py-1.5 rounded-lg whitespace-nowrap pointer-events-none">
                                <span className="text-[10px] font-black text-white uppercase block">{log.ruleCategory}</span>
                                <span className="text-[9px] text-red-400 font-mono tracking-wider">{log.plate}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

