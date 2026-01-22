import React, { useState, useEffect } from 'react';
import { GeometryLine, EntityType } from '../../types';
import { X, Trash2, Ban, ShieldAlert, GitCommitVertical, Box } from 'lucide-react';
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

    const getNormalizedPoint = (e: React.MouseEvent): Point => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();

        // Anti-NaN protection: ensure rect dimensions are valid
        if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        return {
            x: Math.max(0, Math.min(1, isNaN(x) ? 0 : x)),
            y: Math.max(0, Math.min(1, isNaN(y) ? 0 : y))
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!isEditingGeometry) return;
        if (showMenu) return;
        if (!canvasRef.current) return;

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
        if (!isEditingGeometry) return;
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
        setStartPoint(null);
        setCurrentPoint(null);
        setShowMenu(false);
    };

    const removeLastLine = () => {
        if (geometry.length > 0) {
            setGeometry(geometry.slice(0, -1));
        }
    };

    return (
        <div
            className={`absolute inset-0 z-40 ${isEditingGeometry ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
        >
            {/* UI DE EDICIÓN (SOLO VISIBLE SI EDITAMOS) */}
            {isEditingGeometry && (
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
            )}

            {/* SVG Layer for Drawing */}
            <svg className="w-full h-full pointer-events-none">
                {geometry
                    .filter(line => !isNaN(line.x1) && !isNaN(line.x2))
                    .map(line => (
                        <line
                            key={line.id}
                            x1={`${line.x1 * 100}%`} y1={`${line.y1 * 100}%`}
                            x2={`${line.x2 * 100}%`} y2={`${line.y2 * 100}%`}
                            stroke={line.type === 'forbidden' ? '#ef4444' : line.type === 'stop_line' ? '#f59e0b' : '#06b6d4'}
                            strokeWidth={line.type === 'lane_divider' ? "2" : "4"}
                            strokeDasharray={line.type === 'lane_divider' ? "10, 5" : "0"}
                            opacity={isEditingGeometry ? "0.6" : "0.9"}
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
                    <button onClick={() => confirmLine('forbidden', 'PROHIBIDO')} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group">
                        <div className="p-1.5 rounded bg-red-500/20 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
                            <Ban size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-red-400 uppercase">Zona Prohibida</span>
                        </div>
                    </button>
                    <button onClick={() => confirmLine('stop_line', 'STOP')} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group">
                        <div className="p-1.5 rounded bg-amber-500/20 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                            <ShieldAlert size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-amber-400 uppercase">Línea de Stop</span>
                        </div>
                    </button>
                    <button onClick={() => confirmLine('lane_divider', 'CARRIL')} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group">
                        <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
                            <GitCommitVertical size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-cyan-400 uppercase">División Carril</span>
                        </div>
                    </button>
                    <button onClick={() => {
                        if (!startPoint || !currentPoint) return;
                        // Crear un RECTÁNGULO (Box Junction) a partir de los dos puntos
                        const newLine: GeometryLine = {
                            id: `geo_${Date.now()}`,
                            x1: startPoint.x, y1: startPoint.y,
                            x2: currentPoint.x, y2: currentPoint.y,
                            type: 'box_junction',
                            label: 'CRUCE_PROTEGIDO',
                            points: [
                                { x: startPoint.x, y: startPoint.y },
                                { x: currentPoint.x, y: startPoint.y },
                                { x: currentPoint.x, y: currentPoint.y },
                                { x: startPoint.x, y: currentPoint.y }
                            ]
                        };
                        setGeometry([...geometry, newLine]);
                        setStartPoint(null); setCurrentPoint(null); setShowMenu(false);
                    }} className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group">
                        <div className="p-1.5 rounded bg-orange-500/20 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                            <Box size={14} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-orange-400 uppercase">Box Junction</span>
                            <span className="text-[7px] text-slate-500">Detección por bloqueo</span>
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};
