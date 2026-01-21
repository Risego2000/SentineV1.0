import React, { memo } from 'react';
import { Waves } from 'lucide-react';
import { useSentinel } from '../hooks/useSentinel';
import { EmptyState } from './MainViewer/EmptyState';
import { NeuralStatusHUD } from './MainViewer/NeuralStatusHUD';
import { ControlBar } from './MainViewer/ControlBar';

interface MainViewerProps {
    videoRef: React.RefObject<HTMLVideoElement | null>;
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

/**
 * MainViewer modularizado.
 * Estructura optimizada para renderizado fluido.
 */
export const MainViewer = memo(({ videoRef, canvasRef }: MainViewerProps) => {
    const { source, isAnalyzing } = useSentinel();

    return (
        <main className="flex-1 relative flex flex-col bg-black overflow-hidden h-screen">
            {/* Elementos ocultos pero necesarios */}
            {/* Video visible para debug y visualización directa */}
            <video
                ref={videoRef}
                playsInline
                muted
                loop
                className="absolute inset-0 w-full h-full object-contain"
                style={{ opacity: 0 }} // Mantener oculto pero renderizado para que MediaPipe pueda leerlo
            />

            {/* Capa de Información (HUD) */}
            <NeuralStatusHUD />

            {/* Área Central de Visualización */}
            <div className="flex-1 relative flex items-center justify-center bg-[#01030d] overflow-hidden w-full h-full">
                <canvas ref={canvasRef} className="max-w-full max-h-full object-contain relative z-20 pointer-events-none" />

                {/* Estados Condicionales */}
                {source === 'none' && <EmptyState />}

                {isAnalyzing && (
                    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/40 backdrop-blur-sm transition-all duration-500">
                        <div className="bg-black/90 border border-cyan-500/30 px-10 py-5 rounded-full flex items-center gap-6 animate-pulse shadow-2xl">
                            <Waves className="text-cyan-400 w-6 h-6 animate-spin-slow" />
                            <span className="text-sm font-black text-white uppercase tracking-widest italic">
                                Analizando Vector...
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Barra de Control Inferior */}
            <ControlBar />
        </main>
    );
});

MainViewer.displayName = 'MainViewer';
