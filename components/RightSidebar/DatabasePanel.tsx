import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ChevronDown,
  AlertTriangle,
  Loader,
  Image,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { MediaGalleryPanel } from './MediaGalleryPanel';

type TableName = 'evidence' | 'infractions' | 'geometry_lines' | 'forensic_rules' | 'audit_jobs' | 'reports' | 'system_logs';

const TABLES: Array<{ name: TableName; label: string }> = [
  { name: 'evidence', label: 'Evidencias' },
  { name: 'infractions', label: 'Infracciones' },
  { name: 'geometry_lines', label: 'Geometrías' },
  { name: 'forensic_rules', label: 'Reglas' },
  { name: 'audit_jobs', label: 'Jobs' },
  { name: 'reports', label: 'Reportes' },
  { name: 'system_logs', label: 'Logs' },
];

export const DatabasePanel: React.FC = () => {
  const [activePanel, setActivePanel] = useState<'tables' | 'gallery'>('tables');
  const [selectedTable, setSelectedTable] = useState<TableName>('evidence');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchData = useCallback(async (table: TableName) => {
    if (!isSupabaseConfigured) {
      setError('Supabase no configurado');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      setData(result || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(selectedTable);
  }, [selectedTable, fetchData]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Status Bar */}
      <div className="p-3 border-b border-white/5 bg-black/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {activePanel === 'tables' && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-slate-400 hover:text-white text-[9px] font-bold uppercase tracking-wider transition-colors"
              >
                <span>Tablas</span>
                <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
            <button
              onClick={() => setActivePanel(activePanel === 'gallery' ? 'tables' : 'gallery')}
              className={`flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider transition-colors px-2 py-1 rounded ${
                activePanel === 'gallery'
                  ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Image size={12} />
              <span>Galería</span>
            </button>
          </div>
          {activePanel === 'tables' && (
            <button
              onClick={() => fetchData(selectedTable)}
              disabled={loading}
              className="p-1 rounded hover:bg-white/5 text-slate-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </div>

        {expanded && (
          <div className="space-y-1 pt-2">
            {TABLES.map((table) => (
              <button
                key={table.name}
                onClick={() => {
                  setSelectedTable(table.name);
                  setExpanded(false);
                }}
                className={`w-full text-left px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all ${
                  selectedTable === table.name
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {table.label}
              </button>
            ))}
          </div>
        )}

        {activePanel === 'tables' && (
          <div className="text-[8px] text-slate-600 font-mono">
            {TABLES.find((t) => t.name === selectedTable)?.label} • {data.length} registros
          </div>
        )}
      </div>

      {/* Content Area */}
      {activePanel === 'tables' ? (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
        {!isSupabaseConfigured ? (
          <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[8px] text-red-400">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>Supabase no configurado</span>
          </div>
        ) : loading && data.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-4 text-slate-500">
            <Loader size={12} className="animate-spin" />
            <span className="text-[8px]">Cargando...</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-[8px] text-red-400">
            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-4 text-slate-600 text-[8px]">Sin datos</div>
        ) : (
          data.slice(0, 10).map((row, idx) => (
            <div key={idx} className="p-2 bg-white/[0.02] border border-white/5 rounded text-[8px] space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-slate-500 font-bold uppercase tracking-wider">
                  {row.id ? `#${row.id}` : `Item ${idx + 1}`}
                </span>
              </div>
              <div className="space-y-0.5 text-slate-600">
                {Object.entries(row)
                  .slice(0, 3)
                  .map(([key, val]) => (
                    <div key={key} className="truncate">
                      <span className="text-slate-500">{key}:</span> <span className="text-slate-400">{String(val).slice(0, 30)}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))
        )}
        </div>
      ) : (
        <MediaGalleryPanel />
      )}
    </div>
  );
};
