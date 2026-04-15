import React, { useState, useEffect } from 'react';
import { Target, Mic, Terminal, MapPin, Plus, Trash2, Pencil } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import {
  LugarInfraccion,
  getLugaresFromSupabase,
  saveLugarToSupabase,
  deleteLugarFromSupabase,
  updateLugarToSupabase,
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
  const [newLugar, setNewLugar] = useState('');
  const [newLugarDireccion, setNewLugarDireccion] = useState('');
  const [showLugarInput, setShowLugarInput] = useState(false);
  const [loadingLugares, setLoadingLugares] = useState(true);
  const [editingLugar, setEditingLugar] = useState<LugarInfraccion | null>(null);
  const [editFormData, setEditFormData] = useState({ nombre: '', direccion: '', municipio: '' });

  useEffect(() => {
    loadLugares();
  }, []);

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

  const handleAddLugar = async () => {
    if (newLugar.trim()) {
      const lugar: LugarInfraccion = {
        id: crypto.randomUUID(),
        nombre: newLugar.trim(),
        direccion: newLugarDireccion.trim(),
        municipio: 'Daganzo de Arriba',
      };
      const success = await saveLugarToSupabase(lugar);
      if (success) {
        setLugaresPresets((prev) => [...prev, lugar]);
        addLog('INFO', `Lugar de infracción añadido: ${lugar.nombre}`);
      } else {
        addLog('ERROR', 'Error al guardar lugar en base de datos');
      }
      setNewLugar('');
      setNewLugarDireccion('');
      setShowLugarInput(false);
    }
  };

  const handleDeleteLugar = async (id: string) => {
    const success = await deleteLugarFromSupabase(id);
    if (success) {
      setLugaresPresets((prev) => prev.filter((l) => l.id !== id));
      addLog('INFO', 'Lugar de infracción eliminado');
    } else {
      addLog('ERROR', 'Error al eliminar lugar de base de datos');
    }
  };

  const handleEditLugar = (lugar: LugarInfraccion) => {
    setEditingLugar(lugar);
    setEditFormData({
      nombre: lugar.nombre || '',
      direccion: lugar.direccion || '',
      municipio: lugar.municipio || 'Daganzo de Arriba',
    });
  };

  const handleSaveEdit = async () => {
    if (editingLugar && editFormData.nombre.trim()) {
      const updatedLugar: LugarInfraccion = {
        ...editingLugar,
        nombre: editFormData.nombre.trim(),
        direccion: editFormData.direccion.trim(),
        municipio: editFormData.municipio.trim() || 'Daganzo de Arriba',
      };
      const success = await updateLugarToSupabase(updatedLugar);
      if (success) {
        setLugaresPresets((prev) => prev.map((l) => (l.id === updatedLugar.id ? updatedLugar : l)));
        addLog('SUCCESS', `Lugar actualizado: ${updatedLugar.nombre}`);
      } else {
        addLog('ERROR', 'Error al actualizar lugar en base de datos');
      }
      setEditingLugar(null);
      setEditFormData({ nombre: '', direccion: '', municipio: '' });
    }
  };

  const handleCancelEdit = () => {
    setEditingLugar(null);
    setEditFormData({ nombre: '', direccion: '', municipio: '' });
  };

  const handleSelectLugar = (lugar: LugarInfraccion) => {
    const locationText = lugar.direccion
      ? `${lugar.nombre} - ${lugar.direccion}, ${lugar.municipio}`
      : `${lugar.nombre}, ${lugar.municipio}`;
    setInfractionLocation(locationText);
    addLog('INFO', `Lugar seleccionado: ${lugar.nombre}`);
  };

  const isSelected = (lugar: LugarInfraccion) => {
    if (!infractionLocation) return false;
    return infractionLocation.startsWith(lugar.nombre);
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
          {...helpProps('Selecciona el lugar de la infracción para el expediente.')}
        >
          <MapPin size={11} className="text-blue-500" /> Lugar de Infracción
        </h3>
        <div className="bg-slate-900/40 border border-white/10 rounded-[16px] p-3 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 hud-grid opacity-5 pointer-events-none" />

          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-end">
              <button
                onClick={() => {
                  setShowLugarInput(!showLugarInput);
                  setEditingLugar(null);
                }}
                className="p-1 rounded bg-slate-800 border border-white/10 hover:border-blue-500/50 transition-all"
                {...helpProps('Añadir nuevo lugar de infracción')}
              >
                <Plus size={8} className="text-blue-500" />
              </button>
            </div>

            {showLugarInput && (
              <div className="space-y-2 p-2 bg-slate-800/30 rounded-[10px] border border-white/5">
                <input
                  type="text"
                  value={newLugar}
                  onChange={(e) => setNewLugar(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddLugar();
                  }}
                  placeholder="> NOMBRE DEL LUGAR..."
                  className="w-full bg-[#020617]/40 border border-white/5 rounded-[8px] px-3 py-2 text-[9px] font-mono text-blue-200/80 outline-none focus:border-blue-500/30 uppercase"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLugarDireccion}
                    onChange={(e) => setNewLugarDireccion(e.target.value)}
                    placeholder="> DIRECCIÓN (opcional)..."
                    className="flex-1 bg-[#020617]/40 border border-white/5 rounded-[8px] px-3 py-1.5 text-[8px] font-mono text-blue-200/80 outline-none focus:border-blue-500/30 uppercase"
                  />
                  <button
                    onClick={handleAddLugar}
                    className="px-3 py-1.5 rounded-[8px] bg-blue-500/20 border border-blue-500/30 text-blue-500 text-[8px] font-black uppercase hover:bg-blue-500/30 transition-all"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            )}

            {editingLugar && (
              <div className="space-y-2 p-2 bg-slate-800/50 rounded-[10px] border border-blue-500/30">
                <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest block mb-1">
                  Editando: {editingLugar.nombre}
                </span>
                <input
                  type="text"
                  value={editFormData.nombre}
                  onChange={(e) => setEditFormData({ ...editFormData, nombre: e.target.value })}
                  placeholder="> NOMBRE..."
                  className="w-full bg-[#020617]/40 border border-white/5 rounded-[8px] px-3 py-2 text-[9px] font-mono text-blue-200/80 outline-none focus:border-blue-500/30 uppercase"
                />
                <input
                  type="text"
                  value={editFormData.direccion}
                  onChange={(e) => setEditFormData({ ...editFormData, direccion: e.target.value })}
                  placeholder="> DIRECCIÓN..."
                  className="w-full bg-[#020617]/40 border border-white/5 rounded-[8px] px-3 py-1.5 text-[8px] font-mono text-blue-200/80 outline-none focus:border-blue-500/30 uppercase"
                />
                <input
                  type="text"
                  value={editFormData.municipio}
                  onChange={(e) => setEditFormData({ ...editFormData, municipio: e.target.value })}
                  placeholder="> MUNICIPIO..."
                  className="w-full bg-[#020617]/40 border border-white/5 rounded-[8px] px-3 py-1.5 text-[8px] font-mono text-blue-200/80 outline-none focus:border-blue-500/30 uppercase"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-3 py-1.5 rounded-[8px] bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase hover:bg-emerald-500/30 transition-all"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex-1 px-3 py-1.5 rounded-[8px] bg-slate-800 border border-white/10 text-slate-400 text-[8px] font-black uppercase hover:text-slate-300 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

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

            <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
              {lugaresPresets.map((lugar) => (
                <div
                  key={lugar.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-[8px] text-[9px] transition-all cursor-pointer ${
                    isSelected(lugar)
                      ? 'bg-blue-500/10 border border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                      : 'bg-slate-800/30 border border-white/5 hover:border-blue-500/30'
                  }`}
                  onClick={() => handleSelectLugar(lugar)}
                >
                  <span className="text-slate-400 truncate uppercase">{lugar.nombre}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditLugar(lugar);
                        setShowLugarInput(false);
                      }}
                      className="p-0.5 text-slate-600 hover:text-blue-400 transition-all"
                    >
                      <Pencil size={8} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLugar(lugar.id);
                      }}
                      className="p-0.5 text-slate-600 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={8} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {lugaresPresets.length === 0 && (
              <div className="text-[9px] text-slate-700 text-center py-2 italic">
                Sin lugares configurados. Añade uno nuevo.
              </div>
            )}
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
