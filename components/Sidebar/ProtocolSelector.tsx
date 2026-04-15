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
    selectedProtocolIds,
    setSelectedProtocolIds,
  } = useSentinel();
  const { helpProps } = useHelp();
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
    const isSelected = selectedProtocolIds.includes(id);
    const nextIds = isSelected
      ? selectedProtocolIds.filter((x) => x !== id)
      : [...selectedProtocolIds, id];
    setSelectedProtocolIds(nextIds);
  };

  React.useEffect(() => {
    const combinedLines: GeometryLine[] = [];
    const combinedDirectivesList: string[] = [];

    selectedProtocolIds.forEach((id) => {
      const preset = ROAD_PRESETS[id];
      if (preset) {
        combinedLines.push(...preset.lines);
        combinedDirectivesList.push(preset.directivesTemplate);
      }
    });

    if (combinedDirectivesList.length > 0) {
      setDirectives(`[PROTOCOLOS_ACTIVOS]:\n${combinedDirectivesList.join('\n\n')}`);
      setGeometry(combinedLines);
      addLog('AI', `Protocolos sincronizados: ${selectedProtocolIds.length} activos.`);
    } else {
      // Don't overwrite if we have directives but no selected IDs (e.g. manual ROIs)
      // Only reset if we actually cleared the selection
      // Wait, if I load a config with ROIs but no selected IDs, this might still clear it on mount.
    }
  }, [selectedProtocolIds, setDirectives, setGeometry, addLog]);

  return (
    <div className="space-y-4 mb-4">
      <div
        className="flex items-center justify-between"
        {...helpProps('Selector maestro de protocolos territoriales y de seguridad vial.')}
      >
        <h3 className="text-[9px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
          <Target size={10} className="text-blue-500" /> Protocol Selection
        </h3>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-[16px] p-3 space-y-4">
        {ROAD_MENU_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <span className="text-[8px] font-black text-slate-600 uppercase block tracking-[0.15em] px-1 border-l-2 border-blue-500/30 pl-2">
              {group.label}
            </span>
            <div className="grid grid-cols-3 gap-1">
              {group.items.map((item) => {
                const isActive = selectedProtocolIds.includes(item.id);
                const Icon = ICON_MAP[item.id] || Square;
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    className={`p-1.5 rounded-[10px] border flex flex-col items-center justify-center gap-1 transition-all duration-300 min-h-[40px] ${
                      isActive
                        ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                        : 'bg-black/20 border-white/5 text-slate-500 hover:border-white/10 hover:bg-black/40'
                    }`}
                    {...helpProps(item.desc)}
                  >
                    <Icon
                      size={isActive ? 12 : 10}
                      className={isActive ? 'text-blue-500' : 'text-slate-600'}
                    />
                    <span
                      className={`text-[8px] font-black uppercase tracking-tight text-center leading-[1.1] ${
                        isActive ? 'text-blue-500' : 'text-slate-500'
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
        <div className="pt-3 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              Modo Calibración
            </span>
            <div className="flex items-center gap-2">
              <span
                className={`text-[7px] font-black ${!isMeshRenderEnabled ? 'text-blue-500' : 'text-slate-600'}`}
              >
                DETECCIÓN
              </span>
              <button
                onClick={() => setIsMeshRenderEnabled(!isMeshRenderEnabled)}
                className={`w-6 h-3 rounded-full relative transition-colors ${isMeshRenderEnabled ? 'bg-blue-500' : 'bg-slate-700'}`}
                {...helpProps(
                  isMeshRenderEnabled
                    ? 'Desactivar modo edición de geometría'
                    : 'Activar modo edición de geometría'
                )}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-2 h-2 bg-white rounded-full transition-transform ${isMeshRenderEnabled ? 'translate-x-3' : 'translate-x-0'}`}
                />
              </button>
              <span
                className={`text-[7px] font-black ${isMeshRenderEnabled ? 'text-blue-500' : 'text-slate-600'}`}
              >
                EDICIÓN
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => {
                setSelectedProtocolIds([]);
                setGeometry([]);
                addLog('CORE', 'Malla táctica purgada.');
              }}
              className="py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-all flex items-center justify-center gap-2 group"
              {...helpProps('Eliminar todas las geometrías y protocolos activos')}
            >
              <Target size={10} className="text-red-400 group-hover:scale-110" />
              <span className="text-[8px] font-black text-red-400 uppercase tracking-wider">
                Limpiar Malla
              </span>
            </button>

            <button
              onClick={handleAutoSynthesis}
              disabled={isGenerating}
              className="py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              {...helpProps(
                'Solicitar a Gemini IA que ajuste las geometrías a la perspectiva del video'
              )}
            >
              <Code2
                size={10}
                className={`text-blue-400 ${isGenerating ? 'animate-spin' : 'group-hover:scale-110'}`}
              />
              <span className="text-[8px] font-black text-blue-400 uppercase tracking-wider">
                {isGenerating ? 'Ajustando...' : 'Auto-Ajuste IA'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
