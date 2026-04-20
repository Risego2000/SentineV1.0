import React, { useState, useEffect } from 'react';
import { Target, Mic, Terminal, MapPin } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import {
  LugarInfraccion,
  getLugaresFromSupabase,
  saveLugarToSupabase,
} from '../../services/EvidenceDB';

export const SecurityProtocol = () => {
  const {
    directives,
    setDirectives,
    isListening,
    setIsListening,
    generateGeometry,
    addLog,
    infractionLocation,
    setInfractionLocation,
  } = useSentinel();
  const { helpProps } = useHelp();
  const [lugaresPresets, setLugaresPresets] = useState<LugarInfraccion[]>([]);
  const [locationDraft, setLocationDraft] = useState('');
  const [loadingLugares, setLoadingLugares] = useState(true);

  useEffect(() => {
    loadLugares();
  }, []);

  useEffect(() => {
    setLocationDraft(infractionLocation || '');
  }, [infractionLocation]);

  const loadLugares = async () => {
    setLoadingLugares(true);
    try {
      const lugares = await getLugaresFromSupabase();
      if (lugares.length > 0) {
        setLugaresPresets(lugares);
      } else {
        const defaultLugares: LugarInfraccion[] = [
          {
            id: '1',
            nombre: 'Centro Urbano',
            direccion: 'Calle Principal',
            municipio: 'Daganzo de Arriba',
          },
          {
            id: '2',
            nombre: 'Plaza Mayor',
            direccion: 'Plaza Mayor',
            municipio: 'Daganzo de Arriba',
          },
          {
            id: '3',
            nombre: 'Calle Real',
            direccion: 'Calle Real',
            municipio: 'Daganzo de Arriba',
          },
          {
            id: '4',
            nombre: 'Avenida Constitución',
            direccion: 'Avenida de la Constitución',
            municipio: 'Daganzo de Arriba',
          },
          {
            id: '5',
            nombre: 'Carretera M-100',
            direccion: 'Carretera M-100 km 25',
            municipio: 'Daganzo de Arriba',
          },
          {
            id: '6',
            nombre: 'Cruce del Pueblo',
            direccion: 'Cruce Calle Real con Plaza Mayor',
            municipio: 'Daganzo de Arriba',
          },
        ];
        setLugaresPresets(defaultLugares);
        localStorage.setItem('sentinel_lugares_infraccion', JSON.stringify(defaultLugares));
      }
    } catch (err) {
      console.error('[SecurityProtocol] Error loading lugares:', err);
      const saved = localStorage.getItem('sentinel_lugares_infraccion');
      if (saved) setLugaresPresets(JSON.parse(saved));
    } finally {
      setLoadingLugares(false);
    }
  };

  const handleConfirmLugar = async () => {
    const normalized = locationDraft.trim();
    if (!normalized) {
      addLog('WARN', 'Introduce un lugar de infracción válido.');
      return;
    }

    setInfractionLocation(normalized);

    const exists = lugaresPresets.some(
      (lugar) =>
        lugar.nombre?.trim().toLowerCase() === normalized.toLowerCase() ||
        lugar.direccion?.trim().toLowerCase() === normalized.toLowerCase()
    );

    if (!exists) {
      const lugar: LugarInfraccion = {
        id: crypto.randomUUID(),
        nombre: normalized,
        direccion: normalized,
        municipio: 'Daganzo de Arriba',
      };
      const success = await saveLugarToSupabase(lugar);
      if (success) {
        setLugaresPresets((prev) => [...prev, lugar]);
      } else {
        addLog('ERROR', 'No se pudo actualizar el lugar en la base de datos.');
        return;
      }
    }

    addLog('SUCCESS', `Lugar de infracción validado: ${normalized}`);
  };

  const handleMicToggle = () => {
    const newState = !isListening;
    setIsListening(newState);
    addLog(
      'AI',
      newState
        ? 'Micrófono activado: Iniciando escucha de directivas biónicas.'
        : 'Micrófono desactivado.'
    );
  };

  return (
    <div className="space-y-4 mb-4">
      {/* Lugar de la Infracción */}
      <div className="space-y-2">
        <h3
          className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2"
          {...helpProps('Introduce el lugar de la infracción y confírmalo para guardarlo en la base de datos.')}
        >
          <MapPin size={11} className="text-blue-500" /> Lugar de Infracción
        </h3>
        <div className="bg-slate-900/40 border border-white/10 rounded-[16px] p-3 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 hud-grid opacity-5 pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                Actual:
              </span>
              <span
                className={`text-[9px] font-mono ${infractionLocation ? 'text-blue-400' : 'text-slate-500'}`}
              >
                {infractionLocation || 'No seleccionado'}
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmLugar();
                  }
                }}
                placeholder="> INTRODUCE EL LUGAR DE INFRACCIÓN..."
                className="flex-1 bg-[#020617]/40 border border-white/5 rounded-[10px] px-3 py-2 text-[9px] font-mono text-blue-200/80 outline-none focus:border-blue-500/30 uppercase"
              />
              <button
                onClick={handleConfirmLugar}
                className="px-4 py-2 rounded-[10px] bg-blue-500/20 border border-blue-500/30 text-blue-500 text-[8px] font-black uppercase hover:bg-blue-500/30 transition-all"
              >
                Aceptar
              </button>
            </div>

            <div className="text-[8px] text-slate-600 uppercase tracking-widest">
              {loadingLugares
                ? 'Cargando lugares guardados...'
                : `${lugaresPresets.length} lugares registrados en base de datos`}
            </div>
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between"
        {...helpProps(
          'Panel de protocolos de seguridad biónicos. Define aquí las reglas de tráfico y lógica legal.'
        )}
      >
        <div className="flex items-center gap-2">
          <Target size={10} className="text-blue-500" />
          <h3 className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
            Protocolo_Seguridad
          </h3>
        </div>
        <button
          onClick={handleMicToggle}
          className={`relative group p-1.5 rounded-[10px] transition-all duration-500 ${
            isListening
              ? 'bg-red-500/90 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
              : 'bg-slate-900 border border-white/5 text-slate-500 hover:border-blue-500/50 hover:bg-slate-800'
          }`}
          {...helpProps(
            isListening
              ? 'Detener escucha activa.'
              : 'Activar escucha por voz para dictar protocolos.'
          )}
        >
          <Mic size={10} className={isListening ? 'animate-pulse' : ''} />
          {isListening && (
            <div className="absolute -inset-1 border border-red-500/50 rounded-[12px] animate-ping opacity-20" />
          )}
        </button>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-[16px] p-3 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 hud-grid opacity-5 pointer-events-none" />

        {/* Editor Táctico */}
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Terminal size={10} className="text-blue-500/40" />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.15em]">
                Directivas_IA
              </span>
            </div>
            <div className="text-[8px] text-slate-700 font-black flex items-center gap-2 tracking-widest uppercase">
              Live_Stream
            </div>
          </div>

          <textarea
            value={directives}
            onChange={(e) => setDirectives(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                generateGeometry(
                  'ANÁLISIS DE REVISIÓN: Actualiza la geometría basada en las nuevas directivas del protocolo de seguridad.'
                );
              }
            }}
            className="w-full h-32 bg-[#020617]/40 border border-white/5 rounded-[12px] p-3 text-[8px] font-mono text-blue-200/80 outline-none resize-none shadow-inner focus:border-blue-500/30 focus:bg-[#020617]/60 transition-all uppercase custom-scrollbar placeholder:text-slate-800 leading-relaxed tracking-wider"
            placeholder="> DEFINA_PROTOCOLOS_IA..."
            {...helpProps(
              'Editor táctico de directivas. Escribe las reglas de tráfico y presiona ENTER para sincronizar con la IA.'
            )}
          />

          <div className="flex items-center justify-between px-1">
            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic">
              [ SHIFT + ENTER ] PARA SALTO DE LÍNEA
            </span>
            <span className="text-[8px] font-black text-slate-700 uppercase tracking-widest italic">
              [ ENTER ] PARA SINCRONIZAR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
