import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, X, Check } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';
import {
  LugarInfraccion,
  getLugaresFromSupabase,
  saveLugarToSupabase,
  deleteLugarFromSupabase,
} from '../../services/EvidenceDB';

export const LugaresManager = () => {
  const { addLog, infractionLocation, setInfractionLocation } = useSentinel();
  const { helpProps } = useHelp();
  const [lugares, setLugares] = useState<LugarInfraccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [newNombre, setNewNombre] = useState('');
  const [newDireccion, setNewDireccion] = useState('');
  const [newMunicipio, setNewMunicipio] = useState('Daganzo de Arriba');

  useEffect(() => {
    loadLugares();
  }, []);

  const loadLugares = async () => {
    setLoading(true);
    try {
      const data = await getLugaresFromSupabase();
      setLugares(data.length > 0 ? data : []);
    } catch (err) {
      console.error('[LugaresManager] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newNombre.trim()) return;

    const lugar: LugarInfraccion = {
      nombre: newNombre.trim(),
      direccion: newDireccion.trim(),
      municipio: newMunicipio,
    };

    const success = await saveLugarToSupabase(lugar);
    if (success) {
      addLog('INFO', `Lugar "${lugar.nombre}" creado`);
      await loadLugares();
      setNewNombre('');
      setNewDireccion('');
      setNewMunicipio('Daganzo de Arriba');
      setShowAddForm(false);
    } else {
      addLog('ERROR', 'Error al crear lugar');
    }
  };

  const handleDelete = async (lugar: LugarInfraccion) => {
    if (!lugar.id) return;

    const success = await deleteLugarFromSupabase(lugar.id);
    if (success) {
      addLog('INFO', `Lugar "${lugar.nombre}" eliminado`);
      await loadLugares();
    } else {
      addLog('ERROR', 'Error al eliminar lugar');
    }
  };

  const handleSelect = (lugar: LugarInfraccion) => {
    const locationText = lugar.direccion
      ? `${lugar.nombre} - ${lugar.direccion}, ${lugar.municipio}`
      : `${lugar.nombre}, ${lugar.municipio}`;
    setInfractionLocation(locationText);
    addLog('INFO', `Lugar seleccionado: ${lugar.nombre}`);
  };

  if (loading) {
    return (
      <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4">
        <div className="text-[10px] text-slate-500">Cargando lugares...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-amber-500" />
          <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
            Lugares_Infraccion
          </h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
          {...helpProps('Añadir nuevo lugar')}
        >
          <Plus size={12} className="text-amber-500" />
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-[15px] p-3 space-y-2">
          <input
            type="text"
            value={newNombre}
            onChange={(e) => setNewNombre(e.target.value)}
            placeholder="Nombre del lugar *"
            className="w-full bg-[#020617]/60 border border-white/10 rounded-[10px] px-3 py-2 text-[10px] text-slate-300 outline-none focus:border-amber-500/50 placeholder:text-slate-700"
          />
          <input
            type="text"
            value={newDireccion}
            onChange={(e) => setNewDireccion(e.target.value)}
            placeholder="Dirección"
            className="w-full bg-[#020617]/60 border border-white/10 rounded-[10px] px-3 py-2 text-[10px] text-slate-300 outline-none focus:border-amber-500/50 placeholder:text-slate-700"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="flex-1 py-2 rounded-[10px] bg-amber-500/30 border border-amber-500/50 text-amber-400 text-[9px] font-bold uppercase hover:bg-amber-500/50 transition-all flex items-center justify-center gap-1"
            >
              <Check size={10} />
              Crear
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 rounded-[10px] bg-slate-800 border border-white/10 text-slate-500 text-[9px] font-bold uppercase hover:text-slate-300 transition-all"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
        {lugares.map((lugar) => (
          <div
            key={lugar.id}
            className={`flex items-center justify-between px-3 py-2.5 rounded-[12px] text-[10px] transition-all ${
              infractionLocation?.includes(lugar.nombre)
                ? 'bg-amber-500/20 border border-amber-500/50'
                : 'bg-slate-900/30 border border-white/5 hover:border-amber-500/30'
            }`}
          >
            <div className="flex-1 cursor-pointer" onClick={() => handleSelect(lugar)}>
              <div className="text-slate-300 font-medium">{lugar.nombre}</div>
              {lugar.direccion && (
                <div className="text-[8px] text-slate-600">{lugar.direccion}</div>
              )}
            </div>
            <button
              onClick={() => handleDelete(lugar)}
              className="p-1.5 rounded-lg text-slate-600 hover:text-red-500 hover:bg-red-500/10 transition-all"
              {...helpProps('Eliminar lugar')}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {lugares.length === 0 && (
          <div className="text-[9px] text-slate-600 text-center py-4 italic">
            No hay lugares configurados
          </div>
        )}
      </div>

      {infractionLocation && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[10px] px-3 py-2">
          <div className="text-[8px] text-amber-600 uppercase tracking-wider">Seleccionado:</div>
          <div className="text-[9px] text-amber-400 truncate">{infractionLocation}</div>
        </div>
      )}
    </div>
  );
};
