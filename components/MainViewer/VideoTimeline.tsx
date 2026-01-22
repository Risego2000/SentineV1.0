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

    // Filtrar logs
    const incidentLogs = logs.filter(l => l.type === 'infraction');

    return (
        <div className="absolute bottom-[90px] left-6 right-80 z-40 px-4">
            {/* Contenedor Táctico */}
            <div className="relative group">

                {/* Fondo y Borde Táctico */}
                <div
                    ref={timelineRef}
                    onClick={handleTimelineClick}
                    className="h-2 bg-[#0a0f1e]/80 backdrop-blur-md rounded-full border border-white/10 cursor-pointer overflow-hidden relative transition-all duration-300 group-hover:h-4 group-hover:border-cyan-500/30 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                >
                    {/* Barra de Progreso */}
                    <div
                        className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 relative transition-all ease-linear shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
                    </div>

                    {/* Scanline Effect on Hover */}
                    <div className="absolute inset-0 bg-repeat-x opacity-0 group-hover:opacity-10 pointer-events-none"
                        style={{ backgroundImage: 'linear-gradient(90deg, transparent 50%, rgba(6,182,212,0.1) 50%)', backgroundSize: '4px 100%' }}
                    />
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
                                {/* Triángulo conector */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-LR border-transparent border-t-red-500/50 border-4 border-b-0" />
                            </div>

                            {/* Línea conectora visual a la barra */}
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-red-500 to-transparent pointer-events-none opacity-50" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

