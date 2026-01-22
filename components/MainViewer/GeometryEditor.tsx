import React, { useState, useEffect } from 'react';
import { GeometryLine, EntityType } from '../../types';
import { X, Trash2, Ban, ShieldAlert, GitCommitVertical } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

interface Point {
    x: number;
    y: number;
}

export const GeometryEditor: React.FC<{ canvasRef: React.RefObject<HTMLCanvasElement | null> }> = ({ canvasRef }) => {
    const {
        geometry,
        setGeometry,
        isEditingGeometry,
        setIsEditingGeometry
    } = useSentinel();

    const [startPoint, setStartPoint] = useState<Point | null>(null);
    const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPos, setMenuPos] = useState<Point>({ x: 0, y: 0 });

    // Mover useEffect de ESC dentro

    // Cancelar edición con ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (startPoint) {
                    setStartPoint(null);
                    setCurrentPoint(null);
                    setShowMenu(false);
                } else {
                    setIsEditingGeometry(false);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [startPoint, setIsEditingGeometry]);

    if (!isEditingGeometry) return null;

    const getNormalizedPoint = (e: React.MouseEvent): Point => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();

        // Coordenadas relativas al canvas (video)
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        // Clampear entre 0 y 1 para evitar dibujar fuera
        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y))
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (showMenu) return;
        if (!canvasRef.current) return;

        // Solo permitir dibujar si clickeamos DENTRO del canvas visible
        const rect = canvasRef.current.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            return;
        }

        const p = getNormalizedPoint(e);

        if (!startPoint) {
            setStartPoint(p);
            setCurrentPoint(p);
        } else {
            setMenuPos({ x: e.clientX, y: e.clientY });
            setShowMenu(true);
        }
    };


    const handleMouseMove = (e: React.MouseEvent) => {
        if (startPoint && !showMenu) {
            setCurrentPoint(getNormalizedPoint(e));
        }
    };

    const confirmLine = (type: EntityType, label: string) => {
        if (!startPoint || !currentPoint) return;

        const newLine: GeometryLine = {
            id: `geo_${Date.now()}`,
            x1: startPoint.x,
            y1: startPoint.y,
            x2: currentPoint.x,
            y2: currentPoint.y,
            type,
            label
        };

        setGeometry([...geometry, newLine]);

        // Reset
        setStartPoint(null);
        setCurrentPoint(null);
        setShowMenu(false);
    };

    const removeLastLine = () => {
        if (geometry.length > 0) {
            setGeometry(geometry.slice(0, -1));
        }
    };

    const clearAll = () => {
        if (window.confirm('¿Borrar TODAS las líneas?')) {
            setGeometry([]);
        }
    };

    return (
        <div
            className="absolute inset-0 z-50 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
        >
            {/* Overlay Info */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 border border-cyan-500/50 text-cyan-400 px-4 py-2 rounded-full text-xs font-mono flex items-center gap-4 pointer-events-auto">
                <span className="uppercase font-bold animate-pulse">MODO EDICIÓN ACTIVO</span>
                <div className="h-4 w-px bg-white/20" />
                <span className="text-slate-400">Click: Inicio/Fin</span>
                <span className="text-slate-400">ESC: Cancelar</span>
                <button onClick={removeLastLine} className="hover:text-white" title="Deshacer última">
                    <Trash2 size={14} />
                </button>
                <div className="h-4 w-px bg-white/20" />
                <button onClick={() => setIsEditingGeometry(false)} className="hover:text-white">
                    <X size={14} />
                </button>
            </div>

            {/* SVG Layer for Drawing */}
            <svg className="w-full h-full pointer-events-none">
                {/* Líneas existentes (Visualización fantasma para referencia) */}
                {geometry.map(line => (
                    <line
                        key={line.id}
                        x1={`${line.x1 * 100}%`} y1={`${line.y1 * 100}%`}
                        x2={`${line.x2 * 100}%`} y2={`${line.y2 * 100}%`}
                        stroke={line.type === 'forbidden' ? '#ef4444' : '#06b6d4'}
                        strokeWidth="2"
                        strokeDasharray="4"
                        opacity="0.5"
                    />
                ))}

                {/* Línea actual siendo dibujada */}
                {startPoint && currentPoint && (
                    <line
                        x1={`${startPoint.x * 100}%`} y1={`${startPoint.y * 100}%`}
                        x2={`${currentPoint.x * 100}%`} y2={`${currentPoint.y * 100}%`}
                        stroke="#fff"
                        strokeWidth="2"
                        strokeDasharray="5, 5"
                    />
                )}
            </svg>

            {/* Context Menu for Line Type Selection */}
            {showMenu && (
                <div
                    className="fixed bg-slate-900 border border-white/20 p-2 rounded-xl shadow-2xl flex flex-col gap-1 w-48 z-[60]"
                    style={{ top: menuPos.y + 10, left: menuPos.x + 10 }}
                >
                    <div className="text-[10px] text-slate-500 font-bold uppercase px-2 py-1">Seleccionar Tipo</div>

                    <button
                        onClick={() => confirmLine('forbidden', 'PROHIBIDO')}
                        className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
                    >
                        <div className="p-1.5 rounded bg-red-500/20 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <Ban size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-red-400 uppercase">Zona Prohibida</span>
                            <span className="text-[8px] text-slate-500">Infracción inmediata</span>
                        </div>
                    </button>

                    <button
                        onClick={() => confirmLine('stop_line', 'STOP')}
                        className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
                    >
                        <div className="p-1.5 rounded bg-amber-500/20 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                            <ShieldAlert size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-amber-400 uppercase">Línea de Stop</span>
                            <span className="text-[8px] text-slate-500">Requiere detención total</span>
                        </div>
                    </button>

                    <button
                        onClick={() => confirmLine('lane_divider', 'CARRIL')}
                        className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
                    >
                        <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                            <GitCommitVertical size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-cyan-400 uppercase">División Carril</span>
                            <span className="text-[8px] text-slate-500">Solo monitorización</span>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};
