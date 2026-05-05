/**
 * Infractions Data Table - Displays all detected infractions with comprehensive data
 * Includes: Chain of Custody, Audit Trail, Security, Validation, State History
 */

import React, { useEffect, useState, useCallback } from 'react';
import { supabase, SUPABASE_TABLES } from '../services/supabase';
import { InfractionLog } from '../types';
import { RefreshCw, ChevronDown, AlertTriangle, Lock, Clock, User, CheckCircle } from 'lucide-react';

interface InfractionTableRow {
  id: string;
  plate: string;
  make_model: string;
  color: string;
  description: string;
  severity: string;
  rule_category: string;
  legal_base: string;
  status: string;
  time: string;
  local_time: string;
  video_time_code: string;
  fine_amount?: number;
  points_deducted?: number;
  validation_status: string;
  created_at: string;
  // Cadena de Custodia
  custody_last_checked_at?: string;
  custody_last_status?: string;
  custody_last_summary?: string;
  custody_verification_rows?: any;
  // Auditoría
  audit_log?: any;
  state_history?: any;
  // Validación
  validation?: any;
  // Metadatos de seguridad
  operator?: string;
  supervisor?: string;
  signature_is_signed?: boolean;
  signature_signed_by?: string;
  signature_hash?: string;
  dpia_certified?: boolean;
}

export const InfractionsTable: React.FC<{ onSelectInfraction?: (id: string) => void }> = ({
  onSelectInfraction,
}) => {
  const [infractions, setInfractions] = useState<InfractionTableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof InfractionTableRow>('created_at');
  const [sortDesc, setSortDesc] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchInfractions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Primero: Obtener infracciones
      const { data: infractionData, error: infractionError } = await supabase
        .from(SUPABASE_TABLES.INFRACTIONS)
        .select(
          'id, plate, make_model, color, description, severity, rule_category, legal_base, status, time, local_time, video_time_code, fine_amount, points_deducted, validation_status, created_at'
        )
        .order('created_at', { ascending: false })
        .limit(200);

      let infractionRows = infractionData || [];

      if (infractionError) {
        // Fallback a incidents table
        const fallbackResult = await supabase
          .from('incidents')
          .select(
            'id, plate, make_model, color, description, severity, rule_category, legal_base, status, time, local_time, video_time_code, fine_amount, points_deducted, validation_status, created_at'
          )
          .order('created_at', { ascending: false })
          .limit(200);

        if (fallbackResult.error) {
          setError('No se pueden cargar las infracciones. Verifica los permisos en Supabase.');
          setInfractions([]);
          return;
        }
        infractionRows = fallbackResult.data || [];
      }

      // Segundo: Obtener datos de custodia y auditoría desde expedients
      const { data: expedientData } = await supabase
        .from('expedients')
        .select(
          'infraction_id, custody_last_checked_at, custody_last_status, custody_last_summary, custody_verification_rows, audit_log, state_history, validation, operator, supervisor, signature_is_signed, signature_signed_by, signature_hash, dpia_certified'
        )
        .limit(200);

      // Tercero: Hacer join manual de datos
      const expedientMap = new Map(
        (expedientData || []).map((e: any) => [
          e.infraction_id,
          {
            custody_last_checked_at: e.custody_last_checked_at,
            custody_last_status: e.custody_last_status,
            custody_last_summary: e.custody_last_summary,
            custody_verification_rows: e.custody_verification_rows,
            audit_log: e.audit_log,
            state_history: e.state_history,
            validation: e.validation,
            operator: e.operator,
            supervisor: e.supervisor,
            signature_is_signed: e.signature_is_signed,
            signature_signed_by: e.signature_signed_by,
            signature_hash: e.signature_hash,
            dpia_certified: e.dpia_certified,
          },
        ])
      );

      // Cuarto: Enriquecer infracciones con datos de custodia
      const enrichedInfractions = infractionRows.map((infraction: any) => {
        const custodyData = expedientMap.get(infraction.id) || {};
        return {
          ...infraction,
          ...custodyData,
        };
      });

      setInfractions(enrichedInfractions);
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInfractions();
  }, [fetchInfractions]);

  const toggleRowExpanded = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const getSortedData = () => {
    const sorted = [...infractions].sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      const comparison = String(aVal).localeCompare(String(bVal));
      return sortDesc ? -comparison : comparison;
    });
    return sorted;
  };

  const handleSort = (column: keyof InfractionTableRow) => {
    if (sortBy === column) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(column);
      setSortDesc(true);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (String(severity).toUpperCase()) {
      case 'CRITICAL':
      case 'CRÍTICA':
        return 'text-red-400 bg-red-500/10';
      case 'HIGH':
      case 'ALTA':
        return 'text-orange-400 bg-orange-500/10';
      case 'MEDIUM':
      case 'MEDIA':
        return 'text-yellow-400 bg-yellow-500/10';
      case 'LOW':
      case 'BAJA':
        return 'text-blue-400 bg-blue-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
    }
  };

  const getStatusColor = (status: string) => {
    switch (String(status).toUpperCase()) {
      case 'SIGNED':
      case 'FIRMADA':
        return 'text-emerald-400 bg-emerald-500/10';
      case 'VALIDATED':
      case 'VALIDADA':
        return 'text-blue-400 bg-blue-500/10';
      case 'REJECTED':
      case 'RECHAZADA':
        return 'text-red-400 bg-red-500/10';
      case 'DETECTED':
      case 'DETECTADA':
        return 'text-amber-400 bg-amber-500/10';
      default:
        return 'text-slate-400 bg-slate-500/10';
    }
  };

  const sortedData = getSortedData();

  return (
    <div className="flex flex-col h-full bg-[#0d0d0f] rounded-lg border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-black/40 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">
            Infracciones Detectadas
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-mono">
            {infractions.length} registros • Última actualización: {new Date().toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => fetchInfractions()}
          disabled={loading}
          className="p-2 hover:bg-white/5 rounded text-slate-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="m-3 p-3 rounded bg-red-500/10 border border-red-500/20 flex gap-3">
          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        {infractions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 text-xs">
            {loading ? 'Cargando infracciones...' : 'No hay infracciones detectadas'}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-black/60 border-b border-white/5">
              <tr>
                {[
                  { key: 'plate' as const, label: 'Placa' },
                  { key: 'make_model' as const, label: 'Vehículo' },
                  { key: 'rule_category' as const, label: 'Infracción' },
                  { key: 'severity' as const, label: 'Gravedad' },
                  { key: 'time' as const, label: 'Hora' },
                  { key: 'validation_status' as const, label: 'Validación' },
                  { key: 'fine_amount' as const, label: 'Multa (€)' },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-4 py-3 text-left font-bold text-slate-400 uppercase cursor-pointer hover:text-slate-300 transition-colors whitespace-nowrap"
                  >
                    <div className="flex items-center gap-2">
                      {col.label}
                      {sortBy === col.key && (
                        <span className={`text-xs ${sortDesc ? '▼' : '▲'}`}>
                          {sortDesc ? '↓' : '↑'}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center w-10">
                  <span className="text-slate-500">⋯</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((infraction) => (
                <React.Fragment key={infraction.id}>
                  <tr
                    className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => onSelectInfraction?.(infraction.id)}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-blue-300">
                      {infraction.plate || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {infraction.make_model || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-xs truncate">
                      {infraction.rule_category || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${getSeverityColor(infraction.severity)}`}>
                        {infraction.severity?.toUpperCase() || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400">
                      {infraction.time || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${getStatusColor(infraction.validation_status)}`}>
                        {infraction.validation_status?.toUpperCase() || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-300">
                      {infraction.fine_amount ? `${infraction.fine_amount}€` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowExpanded(infraction.id);
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${expandedRows.has(infraction.id) ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Details Row - Comprehensive Data */}
                  {expandedRows.has(infraction.id) && (
                    <tr className="border-b border-white/5 bg-black/40">
                      <td colSpan={8} className="p-4">
                        {/* Datos Generales */}
                        <div className="mb-4">
                          <h4 className="text-slate-400 font-bold uppercase text-[10px] mb-2 flex items-center gap-2">
                            📋 Datos Generales
                          </h4>
                          <div className="grid grid-cols-3 gap-3 text-[10px]">
                            <div>
                              <span className="text-slate-500 font-bold">Descripción:</span>
                              <p className="text-slate-300">{infraction.description || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Hora Local:</span>
                              <p className="text-slate-300 font-mono">{infraction.local_time || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Código Video:</span>
                              <p className="text-slate-300 font-mono">{infraction.video_time_code || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Base Legal:</span>
                              <p className="text-slate-300">{infraction.legal_base || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Color Vehículo:</span>
                              <p className="text-slate-300">{infraction.color || '—'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 font-bold">Puntos Deducidos:</span>
                              <p className="text-slate-300 font-mono">
                                {infraction.points_deducted ? `-${infraction.points_deducted}` : '—'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Validación y Seguridad */}
                        {(infraction.validation || infraction.operator || infraction.signature_is_signed) && (
                          <div className="mb-4 pb-4 border-b border-white/10">
                            <h4 className="text-slate-400 font-bold uppercase text-[10px] mb-2 flex items-center gap-2">
                              <CheckCircle size={12} /> Validación & Seguridad
                            </h4>
                            <div className="grid grid-cols-3 gap-3 text-[10px]">
                              {infraction.operator && (
                                <div>
                                  <span className="text-slate-500 font-bold flex items-center gap-1">
                                    <User size={10} /> Operador
                                  </span>
                                  <p className="text-slate-300">{infraction.operator}</p>
                                </div>
                              )}
                              {infraction.supervisor && (
                                <div>
                                  <span className="text-slate-500 font-bold">Supervisor:</span>
                                  <p className="text-slate-300">{infraction.supervisor}</p>
                                </div>
                              )}
                              {infraction.signature_is_signed && (
                                <div>
                                  <span className="text-slate-500 font-bold flex items-center gap-1">
                                    <Lock size={10} /> Firmado por
                                  </span>
                                  <p className="text-emerald-300">{infraction.signature_signed_by || 'Digital'}</p>
                                </div>
                              )}
                              {infraction.dpia_certified !== undefined && (
                                <div>
                                  <span className="text-slate-500 font-bold">DPIA Certificado:</span>
                                  <p className={infraction.dpia_certified ? 'text-emerald-300' : 'text-slate-400'}>
                                    {infraction.dpia_certified ? '✓ Sí' : '✗ No'}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Cadena de Custodia */}
                        {infraction.custody_last_checked_at && (
                          <div className="mb-4 pb-4 border-b border-white/10">
                            <h4 className="text-slate-400 font-bold uppercase text-[10px] mb-2 flex items-center gap-2">
                              🔐 Cadena de Custodia
                            </h4>
                            <div className="grid grid-cols-3 gap-3 text-[10px]">
                              <div>
                                <span className="text-slate-500 font-bold flex items-center gap-1">
                                  <Clock size={10} /> Verificada
                                </span>
                                <p className="text-slate-300 font-mono">
                                  {new Date(infraction.custody_last_checked_at).toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <span className="text-slate-500 font-bold">Estado:</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                    infraction.custody_last_status === 'SUCCESS'
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : infraction.custody_last_status === 'FAILURE'
                                        ? 'bg-red-500/20 text-red-300'
                                        : 'bg-yellow-500/20 text-yellow-300'
                                  }`}
                                >
                                  {infraction.custody_last_status}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500 font-bold">Resumen:</span>
                                <p className="text-slate-300 text-[9px]">{infraction.custody_last_summary || '—'}</p>
                              </div>
                            </div>
                            {infraction.custody_verification_rows && (
                              <div className="mt-2 text-[9px]">
                                <span className="text-slate-500 font-bold block mb-1">Archivos verificados:</span>
                                {Array.isArray(infraction.custody_verification_rows) ? (
                                  <div className="space-y-1 text-slate-400">
                                    {infraction.custody_verification_rows.map((row: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-2 font-mono">
                                        <span
                                          className={row.isValid ? 'text-emerald-400' : 'text-red-400'}
                                        >
                                          {row.isValid ? '✓' : '✗'}
                                        </span>
                                        <span className="flex-1">{row.fileName}</span>
                                        <span className="text-slate-500">[{row.kind}]</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-slate-400">—</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Historial de Estado */}
                        {infraction.state_history && Array.isArray(infraction.state_history) && infraction.state_history.length > 0 && (
                          <div className="mb-4 pb-4 border-b border-white/10">
                            <h4 className="text-slate-400 font-bold uppercase text-[10px] mb-2">📝 Historial de Estado</h4>
                            <div className="space-y-1 text-[9px]">
                              {infraction.state_history.map((transition: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-slate-400">
                                  <span className="font-mono">{transition.from} → {transition.to}</span>
                                  <span className="text-slate-600">|</span>
                                  <span>{transition.actor}</span>
                                  <span className="text-slate-600">|</span>
                                  <span className="font-mono text-slate-500">
                                    {new Date(transition.timestamp).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Log de Auditoría */}
                        {infraction.audit_log && Array.isArray(infraction.audit_log) && infraction.audit_log.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-slate-400 font-bold uppercase text-[10px] mb-2 flex items-center gap-2">
                              📊 Log de Auditoría ({infraction.audit_log.length})
                            </h4>
                            <div className="space-y-1 text-[8px] max-h-24 overflow-y-auto">
                              {infraction.audit_log.slice(0, 5).map((entry: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-slate-500 font-mono">
                                  <span className="text-slate-600">[{entry.action}]</span>
                                  <span>{entry.actor}</span>
                                  <span className="text-slate-600 text-[7px]">
                                    {new Date(entry.timestamp).toLocaleTimeString()}
                                  </span>
                                </div>
                              ))}
                              {infraction.audit_log.length > 5 && (
                                <p className="text-slate-600 text-[8px]">... y {infraction.audit_log.length - 5} más</p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* ID e Información Técnica */}
                        <div className="pt-3 border-t border-white/10 text-[10px]">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-slate-500 font-bold">ID Infracción:</span>
                              <p className="text-slate-400 font-mono text-[9px]">{infraction.id}</p>
                            </div>
                            {infraction.signature_hash && (
                              <div>
                                <span className="text-slate-500 font-bold">Hash Firma:</span>
                                <p className="text-slate-400 font-mono text-[8px] truncate">{infraction.signature_hash}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
