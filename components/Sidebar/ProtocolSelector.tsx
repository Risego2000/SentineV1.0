import React, { useState } from 'react';
import {
  Octagon,
  Accessibility,
  MinusCircle,
  RotateCcw,
  Car,
  Square,
  Box,
  Bus,
  TriangleAlert,
  Minus,
  Link,
  ArrowLeftRight,
  Waves,
  RotateCw,
  ArrowUpRight,
  Signpost,
  Truck,
  IterationCcw,
  Type,
  Plus,
  Zap,
  Code2,
  Target,
  LucideProps,
  LucideIcon,
} from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import { ROAD_MENU_GROUPS, ROAD_PRESETS } from '../../constants';
import { GeometryLine } from '../../types';

function Signal(props: LucideProps) {
  return <Zap {...props} />;
}

const ICON_MAP: Record<string, LucideIcon | React.ComponentType<LucideProps>> = {
  'seguridad-stop-falso': Octagon,
  'seguridad-paso-peatones': Accessibility,
  'seguridad-sentido-contrario': MinusCircle,
  'seguridad-giro-u': RotateCcw,
  'infraccion-doble-fila': Car,
  'infraccion-bloqueo-cruce': Square,
  'zona-carga-descarga': Box,
  'infraccion-carril-bus': Bus,
  'arcen-emergencia': TriangleAlert,
  'daganzo-m100-autovia': Minus,
  'daganzo-a2': Link,
  'daganzo-m100-convencional': Square,
  'daganzo-m113-paracuellos': ArrowLeftRight,
  'daganzo-m113-curvas': Waves,
  'daganzo-m103-cobena': RotateCw,
  'daganzo-m106-algete': ArrowUpRight,
  'daganzo-r2': Signpost,
  'daganzo-pesados': Truck,
  'int-semaforo': Signal,
  'int-rotonda': RotateCw,
  'int-t': Type,
  'int-cruce': Plus,
  'int-inc-izq': IterationCcw,
  'int-inc-der': IterationCcw,
  'loc-plaza': Plus,
  'loc-constitucion': Waves,
  'loc-base': Square,
  'loc-poligono': Square,
};

export const ProtocolSelector = () => {
  const {
    generateGeometry,
    setDirectives,
    setGeometry,
    addLog,
    videoRef,
    isMeshRenderEnabled,
    setIsMeshRenderEnabled,
  } = useSentinel();
  const { helpProps } = useHelp();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAutoSynthesis = async () => {
    setIsGenerating(true);
    addLog('CORE', 'Iniciando ajuste de perspectiva vía Gemini...');
    await generateGeometry(
      'Ajusta las líneas existentes a la perspectiva real del video.',
      videoRef.current
    );
    setIsGenerating(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const isSelected = prev.includes(id);
      return isSelected ? prev.filter((x) => x !== id) : [...prev, id];
    });
  };

  React.useEffect(() => {
    const combinedLines: GeometryLine[] = [];
    const combinedDirectivesList: string[] = [];

    selectedIds.forEach((id) => {
      const preset = ROAD_PRESETS[id];
      if (preset) {
        combinedLines.push(...preset.lines);
        combinedDirectivesList.push(preset.directivesTemplate);
      }
    });

    if (combinedDirectivesList.length > 0) {
      setDirectives(`[PROTOCOLOS_ACTIVOS]:\n${combinedDirectivesList.join('\n\n')}`);
      setGeometry((prev) => {
        const customLines = prev.filter((l) => l.id.startsWith('geo_'));
        return [...combinedLines, ...customLines];
      });
      addLog('AI', `Protocolos sincronizados: ${selectedIds.length} activos.`);
    } else {
      setDirectives('Monitorización estándar...');
      setGeometry((prev) => prev.filter((l) => l.id.startsWith('geo_')));
    }
  }, [selectedIds, setDirectives, setGeometry, addLog]);

  return (
    <div className="space-y-[10px]">
      <div
        className="flex items-center justify-between"
        {...helpProps('Selector maestro de protocolos territoriales y de seguridad vial.')}
      >
        <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
          <Target size={14} className="text-cyan-500" /> Protocol Selection
        </h3>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-5">
        {ROAD_MENU_GROUPS.map((group) => (
          <div key={group.label} className="space-y-3">
            <span className="text-[9px] font-black text-slate-600 uppercase block tracking-[0.15em] px-1 border-l-2 border-cyan-500/30 pl-2">
              {group.label}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {group.items.map((item) => {
                const isActive = selectedIds.includes(item.id);
                const Icon = ICON_MAP[item.id] || Square;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    className={`p-2 rounded-[12px] border flex flex-col items-center justify-center gap-1.5 transition-all duration-300 min-h-[50px] ${
                      isActive
                        ? 'bg-cyan-500/10 border-cyan-500/30 text-white shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                        : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10 hover:bg-black/40'
                    }`}
                    {...helpProps(item.desc)}
                  >
                    <Icon
                      size={isActive ? 14 : 12}
                      className={isActive ? 'text-cyan-400' : 'text-slate-600'}
                    />
                    <span
                      className={`text-[7px] font-black uppercase tracking-tight text-center leading-[1.1] ${
                        isActive ? 'text-white' : 'text-slate-500'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* TACTICAL TOOLS */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Modo Calibración
            </span>
            <div className="flex items-center gap-3">
              <span
                className={`text-[8px] font-bold ${!isMeshRenderEnabled ? 'text-cyan-500' : 'text-slate-600'}`}
              >
                DETECCIÓN
              </span>
              <button
                onClick={() => setIsMeshRenderEnabled(!isMeshRenderEnabled)}
                className={`w-8 h-4 rounded-full relative transition-colors ${isMeshRenderEnabled ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${isMeshRenderEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </button>
              <span
                className={`text-[8px] font-bold ${isMeshRenderEnabled ? 'text-cyan-500' : 'text-slate-600'}`}
              >
                EDICIÓN
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setSelectedIds([]);
                setGeometry([]);
                addLog('CORE', 'Malla táctica purgada.');
              }}
              className="py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2 group"
            >
              <Target size={12} className="text-red-400 group-hover:scale-110" />
              <span className="text-[8px] font-black text-red-400 uppercase tracking-wider">
                Limpiar Malla
              </span>
            </button>

            <button
              onClick={handleAutoSynthesis}
              disabled={isGenerating}
              className="py-2.5 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              <Code2
                size={12}
                className={`text-cyan-400 ${isGenerating ? 'animate-spin' : 'group-hover:scale-110'}`}
              />
              <span className="text-[8px] font-black text-cyan-400 uppercase tracking-wider">
                {isGenerating ? 'Ajustando...' : 'Auto-Ajuste IA'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
