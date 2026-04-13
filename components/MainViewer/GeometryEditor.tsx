import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { GeometryLine, EntityType, Point } from '../../types';
import { Ban, ShieldAlert, GitCommitVertical, Box, Scale } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const GeometryEditor: React.FC<{ canvasRef: React.RefObject<HTMLCanvasElement | null> }> = ({
  canvasRef,
}) => {
  const { geometry, setGeometry, isMeshRenderEnabled, setIsMeshRenderEnabled, setCalibration } =
    useSentinel();

  const [points, setPoints] = useState<Point[]>([]);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ sx: number; sy: number }>({ sx: 0, sy: 0 });

  const finishDrawing = useCallback((sx: number, sy: number) => {
    setMenuPos({ sx, sy });
    setShowMenu(true);
  }, []);

  // Handles line completion logic via keyboard and mouse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isMeshRenderEnabled) return;

      if (e.key === 'Escape') {
        if (showMenu) {
          setShowMenu(false);
        } else if (points.length > 0) {
          setPoints([]);
          setCurrentPoint(null);
        } else {
          setIsMeshRenderEnabled(false);
        }
      }

      if (e.key === 'Enter' && points.length > 1) {
        // Compute screen position from last normalized point
        if (canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect();
          const last = points[points.length - 1];
          finishDrawing(rect.left + last.x * rect.width, rect.top + last.y * rect.height);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finishDrawing, points, isMeshRenderEnabled, setIsMeshRenderEnabled, showMenu]);

  const getNormalizedPoint = (e: React.MouseEvent | MouseEvent): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    return {
      x: Math.max(0, Math.min(1, isNaN(x) ? 0 : x)),
      y: Math.max(0, Math.min(1, isNaN(y) ? 0 : y)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMeshRenderEnabled) return;

    // If menu is open, a click outside should close it
    if (showMenu) {
      setShowMenu(false);
      return;
    }

    // Only allow left click (0) for Adding points
    if (e.button !== 0) return;

    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    // Check if click is within canvas bounds
    if (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    ) {
      return;
    }

    const p = getNormalizedPoint(e);
    setPoints((prev) => [...prev, p]);
    setCurrentPoint(p);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!isMeshRenderEnabled) return;
    e.preventDefault();

    if (showMenu) {
      setShowMenu(false);
      return;
    }

    if (points.length === 1) {
      setPoints([]);
      setCurrentPoint(null);
    } else if (points.length > 1) {
      finishDrawing(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMeshRenderEnabled) return;
    if (points.length > 0 && !showMenu) {
      setCurrentPoint(getNormalizedPoint(e));
    }
  };

  const confirmLine = (type: EntityType, label: string) => {
    if (points.length < 2) return;

    const newLine: GeometryLine = {
      id: `geo_${Date.now()}`,
      x1: points[0].x,
      y1: points[0].y,
      x2: points[points.length - 1].x,
      y2: points[points.length - 1].y,
      points: [...points],
      type,
      label,
    };

    setGeometry([...geometry, newLine]);
    setPoints([]);
    setCurrentPoint(null);
    setShowMenu(false);
  };

  return (
    <div
      className={`absolute inset-0 z-40 ${isMeshRenderEnabled ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onContextMenu={handleContextMenu}
    >
      {/* SVG Layer for Drawing - Using viewBox for standard coordinate system */}
      <svg
        className="w-full h-full pointer-events-none"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
      >
        {geometry
          .filter(
            (line) =>
              (line.points && line.points.length > 1) || (!isNaN(line.x1) && !isNaN(line.x2))
          )
          .map((line) => {
            let strokeColor = '#06b6d4';
            if (line.type === 'forbidden') strokeColor = '#ef4444';
            if (line.type === 'stop_line') strokeColor = '#f59e0b';
            if (line.type === 'pedestrian') strokeColor = '#06b6d4';
            if (line.type === 'bus_lane') strokeColor = '#f97316';
            if (line.type === 'box_junction') strokeColor = '#fbbf24';
            if (line.type === 'roi_general') strokeColor = '#10b981'; // Green
            if (line.type === 'roi_turn') strokeColor = '#a855f7'; // Purple

            const polyPoints = line.points
              ? line.points
              : [
                  { x: line.x1, y: line.y1 },
                  { x: line.x2, y: line.y2 },
                ];
            const pathData = polyPoints
              .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 1000} ${p.y * 1000}`)
              .join(' ');
            const isClosed =
              line.type === 'box_junction' ||
              line.type === 'roi_general' ||
              line.type === 'roi_turn';

            return (
              <React.Fragment key={line.id}>
                <path
                  d={pathData + (isClosed ? ' Z' : '')}
                  stroke={strokeColor}
                  strokeWidth={line.type === 'lane_divider' ? '2' : '5'}
                  strokeDasharray={line.type === 'lane_divider' ? '10, 5' : '0'}
                  fill={isClosed ? `${strokeColor}26` : 'none'}
                  opacity={isMeshRenderEnabled ? '0.9' : '0.5'} // Allow seeing them even when not editing but dimmer
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {isMeshRenderEnabled &&
                  polyPoints.map((p, idx) => (
                    <circle
                      key={`${line.id}_p${idx}`}
                      cx={p.x * 1000}
                      cy={p.y * 1000}
                      r="4"
                      fill={strokeColor}
                    />
                  ))}
              </React.Fragment>
            );
          })}

        {/* Línea actual siendo dibujada (Multipunto) */}
        {points.length > 0 && currentPoint && (
          <>
            <path
              d={
                points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * 1000} ${p.y * 1000}`)
                  .join(' ') + ` L ${currentPoint.x * 1000} ${currentPoint.y * 1000}`
              }
              stroke="#fff"
              strokeWidth="3"
              strokeDasharray="8, 4"
              fill="none"
            />
            {points.map((p, i) => (
              <circle key={`active_${i}`} cx={p.x * 1000} cy={p.y * 1000} r="5" fill="#fff" />
            ))}
          </>
        )}
      </svg>

      {showMenu && ReactDOM.createPortal(
        <div
          className="fixed bg-slate-900/95 backdrop-blur-xl border border-white/20 p-2 rounded-xl shadow-2xl flex flex-col gap-1 w-56 z-[9999] max-h-[80vh] overflow-y-auto custom-scrollbar"
          style={{
            top: menuPos.sy > window.innerHeight * 0.6 ? 'auto' : `${menuPos.sy + 10}px`,
            bottom:
              menuPos.sy > window.innerHeight * 0.6
                ? `${window.innerHeight - menuPos.sy}px`
                : 'auto',
            left:
              menuPos.sx > window.innerWidth * 0.7
                ? `${menuPos.sx - 224 - 10}px`
                : `${menuPos.sx + 10}px`,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-[10px] text-slate-500 font-bold uppercase px-2 py-1 flex justify-between items-center border-b border-white/5 mb-1 pb-2">
            <span>Configurar Elemento</span>
          </div>

          <button
            onClick={() => confirmLine('forbidden', 'PROHIBIDO')}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
          >
            <div className="p-1.5 rounded bg-red-500/20 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors">
              <Ban size={14} />
            </div>
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
              Línea Continua / Prohibido
            </span>
          </button>

          <button
            onClick={() => confirmLine('stop_line', 'STOP')}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
          >
            <div className="p-1.5 rounded bg-amber-500/20 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <ShieldAlert size={14} />
            </div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
              Línea de STOP
            </span>
          </button>

          <button
            onClick={() => confirmLine('lane_divider', 'CARRIL')}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
          >
            <div className="p-1.5 rounded bg-cyan-500/20 text-cyan-500 group-hover:bg-cyan-500 group-hover:text-white transition-colors">
              <GitCommitVertical size={14} />
            </div>
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
              División de Carril
            </span>
          </button>

          <button
            onClick={() => confirmLine('pedestrian', 'PEATONES')}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
          >
            <div className="p-1.5 rounded bg-blue-500/20 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <ShieldAlert size={14} />
            </div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
              Paso de Peatones
            </span>
          </button>

          <button
            onClick={() => confirmLine('bus_lane', 'CARRIL BUS')}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
          >
            <div className="p-1.5 rounded bg-orange-500/20 text-orange-500 group-hover:bg-orange-500 group-hover:text-white transition-colors">
              <Box size={14} />
            </div>
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider">
              Carril BUS / TAXI
            </span>
          </button>

          <button
            onClick={() => {
              const roiCount = geometry.filter((l) => l.type.startsWith('roi_')).length;
              const label = `ROI ${String.fromCharCode(65 + (roiCount % 26))}`;
              confirmLine('roi_general', label);
            }}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
          >
            <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Box size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                ROI: ANÁLISIS GENERAL
              </span>
            </div>
          </button>

          <button
            onClick={() => {
              const roiCount = geometry.filter((l) => l.type.startsWith('roi_')).length;
              const label = `ROI ${String.fromCharCode(65 + (roiCount % 26))}`;
              confirmLine('roi_turn', label);
            }}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group"
          >
            <div className="p-1.5 rounded bg-purple-500/20 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
              <Box size={14} />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                ROI: GIRO PROHIBIDO
              </span>
            </div>
          </button>

          <button
            onClick={() => {
              if (points.length < 2 || !canvasRef.current) return;
              const distMeters = prompt('Distancia REAL en METROS entre el PRIMER y ÚLTIMO punto:');
              if (distMeters && !isNaN(parseFloat(distMeters))) {
                const rect = canvasRef.current.getBoundingClientRect();
                const p1 = points[0];
                const p2 = points[points.length - 1];
                const dx = (p2.x - p1.x) * rect.width;
                const dy = (p2.y - p1.y) * rect.height;
                const pixelDist = Math.sqrt(dx * dx + dy * dy);
                if (pixelDist > 0) {
                  const newCalib = parseFloat(distMeters) / pixelDist;
                  setCalibration(newCalib);
                  alert(`Calibración establecida: ${newCalib.toFixed(6)} m/px`);
                }
              }
              setPoints([]);
              setCurrentPoint(null);
              setShowMenu(false);
            }}
            className="flex items-center gap-3 p-2 hover:bg-white/10 rounded-lg text-left group border-t border-white/10 mt-1 pt-2"
          >
            <div className="p-1.5 rounded bg-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Scale size={14} />
            </div>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Calibrar Distancia
            </span>
          </button>

          <button
            onClick={() => {
              setPoints([]);
              setCurrentPoint(null);
              setShowMenu(false);
            }}
            className="p-1 text-[9px] text-slate-600 hover:text-white uppercase font-black transition-colors"
          >
            Cancelar
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};
