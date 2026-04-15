import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Table2,
  RefreshCw,
  Save,
  X,
  Edit2,
  Trash2,
  Plus,
  Search,
  ChevronLeft,
  FileText,
  AlertTriangle,
  MapPin,
  Scale,
  Settings,
  FileBarChart,
  ScrollText,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../services/supabase';
import { useLayoutStore } from '../../stores/layoutStore';

type TableName =
  | 'evidence'
  | 'infractions'
  | 'geometry_lines'
  | 'forensic_rules'
  | 'audit_jobs'
  | 'reports'
  | 'system_logs';

interface TableConfig {
  name: TableName;
  label: string;
  icon: string;
}

const TABLES: TableConfig[] = [
  { name: 'evidence', label: 'Evidencias', icon: 'evidence' },
  { name: 'infractions', label: 'Infracciones', icon: 'infractions' },
  { name: 'geometry_lines', label: 'Geometrías', icon: 'geometry' },
  { name: 'forensic_rules', label: 'Reglas Forenses', icon: 'forensic' },
  { name: 'audit_jobs', label: 'Jobs Audit', icon: 'audit' },
  { name: 'reports', label: 'Reportes', icon: 'reports' },
  { name: 'system_logs', label: 'Logs', icon: 'logs' },
];

const TABLE_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  evidence: FileText,
  infractions: AlertTriangle,
  geometry: MapPin,
  forensic: Scale,
  audit: Settings,
  reports: FileBarChart,
  logs: ScrollText,
};

const TABLE_SCHEMAS: Record<TableName, string[]> = {
  evidence: [
    'plate',
    'makeModel',
    'color',
    'description',
    'severity',
    'ruleCategory',
    'legalBase',
    'image',
  ],
  infractions: [
    'plate',
    'makeModel',
    'color',
    'description',
    'severity',
    'ruleCategory',
    'legalBase',
    'image',
  ],
  geometry_lines: ['label', 'type', 'x1', 'y1', 'x2', 'y2', 'violationKind'],
  forensic_rules: [
    'name',
    'type',
    'severity',
    'legalBase',
    'analysisPrompt',
    'enabled',
    'priority',
  ],
  audit_jobs: ['status', 'auditPreset', 'ruleId', 'viewerId'],
  reports: ['filename', 'totalVideos', 'totalInfractions', 'startTime', 'endTime'],
  system_logs: ['type', 'content'],
};

export const DatabaseManager: React.FC = () => {
  const { setView } = useLayoutStore();
  const [selectedTable, setSelectedTable] = useState<TableName>('evidence');
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingRow, setEditingRow] = useState<Record<string, unknown> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newRow, setNewRow] = useState<Record<string, unknown>>({});

  const fetchData = useCallback(async (table: TableName) => {
    if (!isSupabaseConfigured) {
      setError('Supabase no está configurado');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

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

  const handleSave = async () => {
    if (!editingRow || !editingRow.id) return;

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from(selectedTable)
        .update(editingRow)
        .eq('id', editingRow.id);

      if (updateError) throw updateError;
      setEditingRow(null);
      fetchData(selectedTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { error: insertError } = await supabase.from(selectedTable).insert(newRow);

      if (insertError) throw insertError;
      setIsCreating(false);
      setNewRow({});
      fetchData(selectedTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('¿Estás seguro de eliminar este registro?')) return;

    setLoading(true);
    try {
      const { error: deleteError } = await supabase.from(selectedTable).delete().eq('id', id);

      if (deleteError) throw deleteError;
      fetchData(selectedTable);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  const getColumns = () => {
    if (data.length > 0) {
      // Prioritize actual data columns if available
      const columns = Object.keys(data[0]);
      // Ensure we don't return an empty array if somehow data[0] is empty
      if (columns.length > 0) return columns;
    }
    // Fallback to schema definition
    return TABLE_SCHEMAS[selectedTable] || [];
  };

  const filteredData = searchTerm
    ? data.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : data;

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0c] text-slate-200 animate-in fade-in duration-500 overflow-hidden">
      {/* Top Header - RightSidebar Style */}
      <header className="border-b border-white/5 flex items-center justify-between bg-white/[0.02] p-5 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView('analysis')}
            className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <img src="/LOGO.png" alt="Logo" className="w-12 h-12 object-contain" />
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <span className="text-[28px] font-black text-slate-200 uppercase italic leading-none tracking-tighter">
                  FORENSE
                </span>
                <span className="text-[28px] font-black text-red-600 uppercase italic leading-none tracking-tighter ml-1">
                  AI
                </span>
              </div>
              <span className="text-[9px] font-bold text-red-400/60 uppercase mt-1">V.1.0</span>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-red-500/40" />
              <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.15em] whitespace-nowrap">
                UNIDAD AUDITORA
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-black/40 border border-white/5 rounded-[12px] px-3 py-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}
            />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              {isSupabaseConfigured ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Table Navigation */}
        <aside className="w-64 border-r border-white/5 bg-[#0d0d0f]/50 p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar shrink-0">
          <div className="flex items-center gap-2 px-1">
            <Database size={12} className="text-blue-500" />
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
              Tablas del Sistema
            </span>
          </div>
          {TABLES.map((table) => {
            const Icon = TABLE_ICONS[table.icon];
            return (
              <button
                key={table.name}
                onClick={() => {
                  setSelectedTable(table.name);
                  setIsCreating(false);
                  setEditingRow(null);
                  setNewRow({});
                  setError(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border ${
                  selectedTable === table.name
                    ? 'bg-blue-500/10 border-blue-500 text-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                    : 'bg-white/[0.02] border-white/5 text-slate-400 hover:bg-white/[0.05] hover:text-slate-200'
                }`}
              >
                {Icon && (
                  <Icon
                    size={14}
                    className={selectedTable === table.name ? 'text-blue-500' : 'text-slate-500'}
                  />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider flex-1">
                  {table.label}
                </span>
                {selectedTable === table.name && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Center: Data Table */}
        <main className="flex-1 flex flex-col overflow-hidden bg-black/20">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <div className="relative w-full max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder={`Buscar en ${selectedTable}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-[12px] text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchData(selectedTable)}
                className="p-2.5 bg-black/20 hover:bg-white/[0.04] rounded-[12px] text-slate-500 hover:text-blue-400 transition-all border border-white/5"
                title="Sincronizar Datos"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-[12px] text-[10px] font-bold uppercase tracking-wider transition-all border border-blue-500/30 active:scale-95"
              >
                <Plus size={16} />
                Nuevo Registro
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-auto custom-scrollbar relative">
            {loading && data.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0c]/50 backdrop-blur-sm z-10">
                <div className="w-10 h-10 border-3 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
                <span className="text-[9px] font-bold text-blue-500 uppercase tracking-[0.3em]">
                  Accediendo...
                </span>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 opacity-50">
                <Table2 size={48} className="text-slate-800" />
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Sin datos
                  </p>
                  <p className="text-[9px] mt-1 text-slate-600">La tabla está vacía</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-[#0d0d0f]">
                    {getColumns().map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 text-right w-28 sticky right-0 bg-[#0d0d0f]">
                      Ops
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredData.map((row, idx) => (
                    <tr key={idx} className="group hover:bg-white/[0.02] transition-colors">
                      {getColumns().map((col) => (
                        <td
                          key={col}
                          className="px-4 py-3 text-[10px] text-slate-400 max-w-[250px] truncate"
                        >
                          {editingRow && editingRow.id === row.id ? (
                            <input
                              type="text"
                              value={
                                typeof editingRow[col] === 'object'
                                  ? JSON.stringify(editingRow[col])
                                  : String(editingRow[col] ?? '')
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                let finalValue: any = val;
                                if (
                                  (val.startsWith('[') && val.endsWith(']')) ||
                                  (val.startsWith('{') && val.endsWith('}'))
                                ) {
                                  try {
                                    finalValue = JSON.parse(val);
                                  } catch (e) {}
                                } else if (val.toLowerCase() === 'true') finalValue = true;
                                else if (val.toLowerCase() === 'false') finalValue = false;
                                else if (
                                  val !== '' &&
                                  !isNaN(Number(val)) &&
                                  ['x1', 'y1', 'x2', 'y2', 'priority', 'minDwellTime'].includes(col)
                                ) {
                                  finalValue = Number(val);
                                }
                                setEditingRow({ ...editingRow, [col]: finalValue });
                              }}
                              className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded-[8px] text-[10px] text-slate-300 focus:outline-none focus:border-blue-500"
                            />
                          ) : (
                            <span>
                              {row[col] !== null && row[col] !== undefined ? (
                                typeof row[col] === 'object' ? (
                                  <code className="text-[10px] text-blue-400 bg-blue-500/5 px-1.5 py-0.5 rounded italic">
                                    {JSON.stringify(row[col])}
                                  </code>
                                ) : (
                                  String(row[col])
                                )
                              ) : (
                                <span className="text-slate-600 italic">null</span>
                              )}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right sticky right-0 bg-[#0a0a0c]/80 backdrop-blur-md border-b border-white/5">
                        <div className="flex items-center justify-end gap-1.5">
                          {editingRow && editingRow.id === row.id ? (
                            <>
                              <button
                                onClick={handleSave}
                                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-[12px] transition-all text-blue-500 border border-blue-500/30"
                                title="Confirmar Cambios"
                              >
                                <Save size={14} />
                              </button>
                              <button
                                onClick={() => setEditingRow(null)}
                                className="p-2 bg-black/20 hover:bg-white/[0.04] rounded-[12px] transition-all text-slate-500 border border-white/5"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingRow({ ...row })}
                                className="p-2 bg-black/20 hover:bg-blue-500/10 rounded-[12px] transition-all text-slate-500 hover:text-blue-500 border border-white/5 hover:border-blue-500/30"
                                title="Modificar Registro"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(row.id as any)}
                                className="p-2 bg-black/20 hover:bg-red-500/10 rounded-[12px] transition-all text-slate-500 hover:text-red-500 border border-white/5 hover:border-red-500/30"
                                title="Eliminar Registro Permanente"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Stats */}
          <footer className="h-10 border-t border-white/5 bg-[#0d0d0f] flex items-center justify-between px-4 shrink-0">
            <button
              onClick={() => setView('analysis')}
              className="flex items-center gap-2 px-3 py-1.5 bg-black/20 border border-white/5 rounded-[12px] text-slate-500 hover:text-white hover:bg-white/[0.04] transition-all group"
            >
              <ChevronLeft
                size={18}
                className="group-hover:-translate-x-0.5 transition-transform"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider">Volver</span>
            </button>
            <div className="flex items-center gap-3">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                <span className="text-blue-500">{filteredData.length}</span> /{' '}
                <span className="text-slate-400">{data.length}</span> regs
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                Online
              </span>
            </div>
          </footer>
        </main>
      </div>

      {/* Create Overlay Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-in zoom-in duration-300">
          <div className="bg-[#0a0a0c] border border-white/10 rounded-[20px] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-[12px] border border-blue-500/30">
                  <Plus size={20} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-tighter leading-none text-slate-200">
                    Nuevo Registro Táctico
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Insertar en {selectedTable}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreating(false)}
                className="p-2 hover:bg-white/[0.04] rounded-[12px] transition-all"
              >
                <X size={20} className="text-slate-500 hover:text-white" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 grid grid-cols-2 gap-3 bg-black/20">
              {getColumns()
                .filter((col) => col !== 'id' && col !== 'created_at' && col !== 'updated_at')
                .map((col) => (
                  <div key={col} className="space-y-1">
                    <label className="block text-[9px] text-slate-500 uppercase font-bold tracking-widest ml-1">
                      {col}
                    </label>
                    <input
                      type="text"
                      placeholder={`${col}...`}
                      value={
                        typeof newRow[col] === 'object'
                          ? JSON.stringify(newRow[col])
                          : String(newRow[col] ?? '')
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        let finalValue: any = val;

                        if (
                          (val.startsWith('[') && val.endsWith(']')) ||
                          (val.startsWith('{') && val.endsWith('}'))
                        ) {
                          try {
                            finalValue = JSON.parse(val);
                          } catch (e) {
                            /* keep as string */
                          }
                        } else if (val.toLowerCase() === 'true') {
                          finalValue = true;
                        } else if (val.toLowerCase() === 'false') {
                          finalValue = false;
                        } else if (
                          val !== '' &&
                          !isNaN(Number(val)) &&
                          [
                            'x1',
                            'y1',
                            'x2',
                            'y2',
                            'priority',
                            'minDwellTime',
                            'totalVideos',
                            'totalInfractions',
                          ].includes(col)
                        ) {
                          finalValue = Number(val);
                        }

                        setNewRow({ ...newRow, [col]: finalValue });
                      }}
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-[12px] text-[10px] text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder:text-slate-700"
                    />
                  </div>
                ))}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-white/10 bg-[#0d0d0f]">
              <button
                onClick={() => setIsCreating(false)}
                className="px-5 py-2 bg-black/20 hover:bg-white/[0.04] rounded-[12px] text-slate-500 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all border border-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="px-6 py-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-[12px] text-blue-500 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50 transition-all border border-blue-500/30 active:scale-95"
              >
                {loading ? 'Sincronizando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
