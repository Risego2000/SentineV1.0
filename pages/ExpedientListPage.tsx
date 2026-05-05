/**
 * Expedient List Page - TIER 1
 * Displays pending expedients and allows review workflow
 */

import React, { useEffect, useRef, useState } from 'react';
import { Expedient } from '../domain/Expedient';
import { ExpedientWorkflow } from '../components/ExpedientWorkflow';
import { InfractionModal } from '../components/InfractionModal';
import { PDFExportService } from '../services/PDFExportService';
import { ExcelExportService } from '../services/ExcelExportService';
import { getExpedientService } from '../services/ExpedientService';
import { getApiUrl } from '../services/apiConfig';
import { supabase, SUPABASE_TABLES } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { InfractionLog } from '../types';

interface InfractionSchemaRow {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  status: string | null;
  evidence_id: string | null;
  plate: string | null;
  make_model: string | null;
  color: string | null;
  description: string | null;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  rule_category: string | null;
  legal_base: string | null;
  audit_result: any;
  image_url: string | null;
  extra_snapshots: string[] | null;
  zoom_snapshots: string[] | null;
  video_clip_url: string | null;
  time: string | null;
  playback_time: number | null;
  local_time: string | null;
  video_time_code: string | null;
  visual_timestamp: string | null;
  telemetry: any;
  report_path: string | null;
  report_generated_at: string | null;
  validation_status: 'pending' | 'validated' | 'rejected' | null;
  validated_at: string | null;
  operator_id: string | null;
  extra_data: any;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value: string): boolean => UUID_RE.test(value);

const mapIncidentToInfractionRow = (row: any): InfractionSchemaRow => ({
  id: String(row.id),
  created_at: row.created_at || null,
  updated_at: row.updated_at || null,
  status: row.status || null,
  evidence_id: row.evidence_id || null,
  plate: row.plate || null,
  make_model: row.make_model || null,
  color: row.color || null,
  description: row.description || null,
  severity: row.severity || null,
  rule_category: row.rule_category || null,
  legal_base: row.legal_base || null,
  audit_result: row.audit_result || null,
  image_url: row.image_url || row.image || null,
  extra_snapshots: row.extra_snapshots || null,
  zoom_snapshots: row.zoom_snapshots || null,
  video_clip_url: row.video_clip_url || row.video_clip || null,
  time: row.time || null,
  playback_time: row.playback_time || null,
  local_time: row.local_time || null,
  video_time_code: row.video_time_code || null,
  visual_timestamp: row.visual_timestamp || null,
  telemetry: row.telemetry || null,
  report_path: row.report_path || null,
  report_generated_at: row.report_generated_at || null,
  validation_status: row.validation_status || null,
  validated_at: row.validated_at || null,
  operator_id: row.operator_id || null,
  extra_data: row.extra_data || null,
});

interface PageState {
  expedients: Expedient[];
  infractions: InfractionLog[];
  selectedExpedientId: string | null;
  selectedInfractionId: number | null;
  selectedType: 'expedient' | 'infraction' | null;
  loading: boolean;
  refreshing: boolean;
  manualRefreshing: boolean;
  error: string | null;
  success?: string | null;
  infractionRowsByExpedientId: Record<string, InfractionSchemaRow | null>;
  expedientImagesByExpedientId: Record<string, string[]>;
  infractionsTableUnavailable: boolean;
  currentUser: {
    name: string;
    role: 'OPERATOR' | 'SUPERVISOR' | 'ADMIN';
  };
}

export const ExpedientListPage: React.FC = () => {
  const { user } = useAuth();
  const infractionsTableUnavailableRef = useRef(false);
  const supabaseReadUnavailableRef = useRef(false);
  const infractionLoadInFlightRef = useRef(false);
  const expedientsLoadInFlightRef = useRef(false);
  const [state, setState] = useState<PageState>({
    expedients: [],
    infractions: [],
    selectedExpedientId: null,
    selectedInfractionId: null,
    selectedType: null,
    loading: true,
    refreshing: false,
    manualRefreshing: false,
    error: null,
    infractionRowsByExpedientId: {},
    expedientImagesByExpedientId: {},
    infractionsTableUnavailable: false,
    currentUser: {
      name: sessionStorage.getItem('currentUserName') || 'Operador',
      role: (sessionStorage.getItem('currentUserRole') as any) || 'OPERATOR',
    },
  });

  const expedientService = getExpedientService();
  const wsRef = useRef<WebSocket | null>(null);
  const selectedExpedient = state.expedients.find((e) => e.id === state.selectedExpedientId);
  const selectedInfraction = state.infractions.find((i) => i.id === state.selectedInfractionId);
  const selectedInfractionRow = selectedExpedient
    ? state.infractionRowsByExpedientId[selectedExpedient.id] || null
    : null;
  const detectedCount = state.expedients.filter((e) => e.state === 'DETECTED').length;
  const reviewCount = state.expedients.filter((e) => e.state === 'UNDER_REVIEW').length;
  const signedCount = state.expedients.filter((e) => e.state === 'SIGNED').length;

  // Load pending expedients on mount
  useEffect(() => {
    loadPendingExpedients({ silent: false });
  }, []);

  // Connect to WebSocket for real-time infraction updates
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/realtime`;
        const ws = new WebSocket(wsUrl);

        ws.addEventListener('open', () => {
          console.log('[ExpedientList] WebSocket connected to realtime updates');
        });

        ws.addEventListener('message', async (event) => {
          try {
            const { type, payload } = JSON.parse(event.data);

            // When a new infraction is synced, refresh the infraction list immediately
            if (type === 'infraction:synced') {
              console.log('[ExpedientList] Received infraction:synced notification:', payload);

              // Fetch infractions from the API
              const response = await fetch(getApiUrl('/api/infractions'), {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                const result = await response.json();
                const infractions = (result.infractions || []).map((row: any) => ({
                  id: row.id,
                  plate: row.plate || row.license_plate,
                  makeModel: row.make_model || row.makeModel,
                  color: row.color,
                  description: row.description,
                  severity: row.severity,
                  ruleCategory: row.rule_category || row.ruleCategory,
                  legalBase: row.legal_base || row.legalBase,
                  image: row.image_url || row.image,
                  extraSnapshots: row.extra_snapshots || row.extraSnapshots || [],
                  zoomSnapshots: row.zoom_snapshots || row.zoomSnapshots || [],
                  videoClip: row.video_clip_url || row.videoClip,
                  time: row.time,
                  playbackTime: row.playback_time || row.playbackTime,
                  validationStatus: row.validation_status || row.validationStatus,
                  validatedAt: row.validated_at ? new Date(row.validated_at).getTime() : undefined,
                  operatorId: row.operator_id || row.operatorId,
                  fineAmount: row.fine_amount || row.fineAmount,
                  pointsDeducted: row.points_deducted || row.pointsDeducted,
                  localTime: row.local_time || row.localTime,
                  videoTimeCode: row.video_time_code || row.videoTimeCode,
                }));

                setState((prev) => ({
                  ...prev,
                  infractions: infractions,
                }));
              }
            }
          } catch (err) {
            console.warn('[ExpedientList] Error processing WebSocket message:', err);
          }
        });

        ws.addEventListener('error', (error) => {
          console.warn('[ExpedientList] WebSocket error:', error);
        });

        ws.addEventListener('close', () => {
          console.log('[ExpedientList] WebSocket disconnected, reconnecting in 5s');
          // Auto-reconnect after 5 seconds
          setTimeout(() => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) {
              connectWebSocket();
            }
          }, 5000);
        });

        wsRef.current = ws;
      } catch (error) {
        console.error('[ExpedientList] Failed to connect to WebSocket:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Auto-refresh expedients to keep dossier data updated in real time.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (expedientsLoadInFlightRef.current) return;
      if (!infractionsTableUnavailableRef.current) {
        loadPendingExpedients({ silent: true });
      }
    }, 7000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Keep operator identity aligned with active authenticated session.
  useEffect(() => {
    if (!user) return;
    const normalizedRole =
      user.role === 'admin' ? 'ADMIN' : user.role === 'viewer' ? 'OPERATOR' : 'OPERATOR';
    const sessionName = user.name || user.email?.split('@')[0] || 'Operador';
    setState((prev) => ({
      ...prev,
      currentUser: {
        name: sessionName,
        role: normalizedRole,
      },
    }));
    sessionStorage.setItem('currentUserName', sessionName);
    sessionStorage.setItem('currentUserRole', normalizedRole);
  }, [user]);

  const loadPendingExpedients = async (
    { silent = false, manual = false }: { silent?: boolean; manual?: boolean } = {}
  ) => {
    if (expedientsLoadInFlightRef.current) return;
    expedientsLoadInFlightRef.current = true;
    setState((prev) => ({
      ...prev,
      loading: silent ? prev.loading : true,
      refreshing: silent,
      manualRefreshing: manual,
      error: null,
    }));
    try {
      // Load all active expedients from backend API (bypasses RLS restrictions)
      // The backend uses service role key to query Supabase directly
      const response = await fetch(getApiUrl('/api/expedients'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(
          `Failed to fetch expedients: ${response.status} - ${errorData?.error || errorData?.message || 'Unknown error'}`
        );
      }

      const result = await response.json();
      const allExpedients: Expedient[] = (result.expedients || []).map((exp: any) => ({
        ...exp,
        // Handle both Supabase format (snake_case) and cache format
        id: exp.id || exp.expedient_id,
        createdAt: exp.createdAt || (exp.created_at ? new Date(exp.created_at).getTime() : Date.now()),
        updatedAt: exp.updatedAt || (exp.updated_at ? new Date(exp.updated_at).getTime() : Date.now()),
        state: exp.state || 'DETECTED',
        licensePlate: exp.licensePlate || exp.license_plate || 'UNKNOWN',
        violationType: exp.violationType || exp.violation_type || 'UNKNOWN',
      }));

      const all = allExpedients.sort((a, b) => b.createdAt - a.createdAt);

      // Also load infractions
      const infractions = await loadInfractionLogs();

      setState((prev) => ({
        ...prev,
        expedients: all,
        infractions: infractions,
        loading: false,
        refreshing: false,
        manualRefreshing: false,
      }));

      if (!infractionsTableUnavailableRef.current && !supabaseReadUnavailableRef.current) {
        await loadInfractionRowsForExpedients(all);
      }
      if (!supabaseReadUnavailableRef.current) {
        await loadExpedientImages(all);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Error loading expedients: ${error instanceof Error ? error.message : String(error)}`,
        loading: false,
        refreshing: false,
        manualRefreshing: false,
      }));
    } finally {
      expedientsLoadInFlightRef.current = false;
    }
  };

  const loadInfractionLogs = async (): Promise<InfractionLog[]> => {
    try {
      // Load from backend API (cache) instead of Supabase to bypass RLS restrictions
      const response = await fetch(getApiUrl('/api/infractions'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Error loading infractions from backend:', response.status);
        return [];
      }

      const result = await response.json();
      const infractions = result.infractions || [];

      // Map cache rows to InfractionLog type
      return infractions.map((row: any) => ({
        id: row.id,
        plate: row.plate || row.license_plate,
        makeModel: row.make_model || row.makeModel,
        color: row.color,
        description: row.description,
        severity: row.severity,
        ruleCategory: row.rule_category || row.ruleCategory,
        legalBase: row.legal_base || row.legalBase,
        image: row.image_url || row.image,
        extraSnapshots: row.extra_snapshots || row.extraSnapshots || [],
        zoomSnapshots: row.zoom_snapshots || row.zoomSnapshots || [],
        videoClip: row.video_clip_url || row.videoClip,
        time: row.time,
        playbackTime: row.playback_time || row.playbackTime,
        validationStatus: row.validation_status || row.validationStatus,
        validatedAt: row.validated_at ? new Date(row.validated_at).getTime() : undefined,
        operatorId: row.operator_id || row.operatorId,
        fineAmount: row.fine_amount || row.fineAmount,
        pointsDeducted: row.points_deducted || row.pointsDeducted,
        localTime: row.local_time || row.localTime,
        videoTimeCode: row.video_time_code || row.videoTimeCode,
      }));
    } catch (error) {
      console.error('Error loading infraction logs:', error);
      return [];
    }
  };

  const handleStateChange = async (updatedExpedient: Expedient) => {
    // Recargar inmediatamente desde Supabase
    try {
      const refreshedExpedient = await expedientService.getExpedient(updatedExpedient.id);
      if (refreshedExpedient) {
        setState((prev) => ({
          ...prev,
          expedients: prev.expedients.map((e) =>
            e.id === refreshedExpedient.id ? refreshedExpedient : e
          ),
          selectedExpedientId: refreshedExpedient.id, // Mantener seleccionado
        }));
      }
    } catch (error) {
      console.error('Error reloading expedient:', error);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedExpedient) return;

    // PHASE 1b: Enforce validation before generating OFICIAL reports
    if (selectedExpedient.state !== 'SIGNED' && selectedExpedient.state !== 'EXPORTED') {
      setState((prev) => ({
        ...prev,
        error:
          'Solo se pueden exportar reportes OFICIALES después de la firma digital. Genera un PREINFORME para previsualizaciones.',
      }));
      return;
    }

    try {
      const buffer = await PDFExportService.generatePDF(selectedExpedient, {
        includeAuditTrail: true,
        includePhotos: false,
        // PHASE 1b: Enforce OFICIAL only after signature
        watermark: selectedExpedient.signature.isSigned ? 'OFICIAL' : 'PREINFORME',
      });

      if (buffer) {
        await PDFExportService.downloadPDF(buffer, selectedExpedient.id);
      } else {
        setState((prev) => ({
          ...prev,
          error: 'No se pudo generar PDF - verifica la firma digital',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Error al exportar PDF: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  };

  // Helper to check if export button should be enabled
  const canExportOfficialPDF =
    selectedExpedient &&
    selectedExpedient.state === 'SIGNED' &&
    selectedExpedient.signature.isSigned;

  // Export to Excel with embedded data and photos
  const handleExportExcel = async () => {
    if (!selectedExpedient) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Collect all photos from the expedition for embedding
      const photos: { name: string; base64: string }[] = [];

      // Add general context photos (if available)
      if (
        selectedExpedient &&
        'extraSnapshots' in selectedExpedient &&
        selectedExpedient.extraSnapshots
      ) {
        const extraSnapshots = selectedExpedient.extraSnapshots as string[];
        extraSnapshots.forEach((snapshot, idx) => {
          if (snapshot) {
            photos.push({
              name: `Foto General ${idx + 1}`,
              base64: snapshot,
            });
          }
        });
      }

      // Add detail/zoom photos (if available)
      if (
        selectedExpedient &&
        'zoomSnapshots' in selectedExpedient &&
        selectedExpedient.zoomSnapshots
      ) {
        const zoomSnapshots = selectedExpedient.zoomSnapshots as string[];
        zoomSnapshots.forEach((snapshot, idx) => {
          if (snapshot) {
            photos.push({
              name: `Foto Detalle ${idx + 1}`,
              base64: snapshot,
            });
          }
        });
      }

      // Add main image (if available)
      if (selectedExpedient && 'image' in selectedExpedient && selectedExpedient.image) {
        photos.push({
          name: 'Foto Principal',
          base64: selectedExpedient.image as string,
        });
      }

      const buffer = await ExcelExportService.generateExcel(selectedExpedient, photos);

      if (buffer) {
        ExcelExportService.downloadExcel(buffer, selectedExpedient.id);
        setState((prev) => ({
          ...prev,
          success: 'Excel exportado correctamente',
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          error: 'No se pudo generar Excel',
          loading: false,
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Error al exportar Excel: ${error instanceof Error ? error.message : String(error)}`,
        loading: false,
      }));
    }
  };

  // PHASE 1b: Allow preview of PREINFORME anytime
  const handleExportPreinforme = async () => {
    if (!selectedExpedient) return;

    try {
      const buffer = await PDFExportService.generatePDF(selectedExpedient, {
        includeAuditTrail: false,
        includePhotos: false,
        watermark: 'PREINFORME',
      });

      if (buffer) {
        await PDFExportService.downloadPDF(buffer, selectedExpedient.id);
      } else {
        setState((prev) => ({
          ...prev,
          error: 'No se pudo generar PREINFORME',
        }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Error al generar PREINFORME: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  };

  const loadExpedientImages = async (expedients: Expedient[]) => {
    if (supabaseReadUnavailableRef.current) return;
    try {
      const expedientIds = [
        ...new Set(
          expedients
            .map((e) => String(e.id || '').trim())
            .filter((id) => id.length > 0 && isUuid(id))
        ),
      ];
      if (!expedientIds.length) return;

      const { data, error } = await supabase
        .from('expedient_images')
        .select('expedient_id, image_url')
        .in('expedient_id', expedientIds);

      if (error) {
        const status = Number((error as any)?.status || 0);
        const code = String((error as any)?.code || '');
        const message = String((error as any)?.message || '').toLowerCase();
        const forbidden =
          status === 403 ||
          code === '42501' ||
          message.includes('permission denied') ||
          message.includes('forbidden');
        if (forbidden) {
          supabaseReadUnavailableRef.current = true;
          return;
        }
        console.warn('[EXPEDIENT_PAGE] Failed to load expedient_images:', error.message);
        return;
      }

      const byExpedient: Record<string, string[]> = {};
      for (const row of data || []) {
        const expId = String((row as any).expedient_id || '').trim();
        const url = String((row as any).image_url || '').trim();
        if (!expId || !url) continue;
        if (!byExpedient[expId]) byExpedient[expId] = [];
        byExpedient[expId].push(url);
      }

      setState((prev) => ({
        ...prev,
        expedientImagesByExpedientId: byExpedient,
      }));
    } catch (err) {
      console.warn('[EXPEDIENT_PAGE] Unexpected expedient_images load failure:', err);
    }
  };

  const handleDeleteExpedient = async () => {
    if (!selectedExpedient) return;
    const confirmed = window.confirm(
      `¿Eliminar expediente ${selectedExpedient.id}? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;

    setState((prev) => ({ ...prev, loading: true, error: null, success: null }));
    try {
      const ok = await expedientService.deleteExpedient(selectedExpedient.id);
      if (!ok) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'No se pudo eliminar el expediente.',
        }));
        return;
      }

      setState((prev) => {
        const updated = prev.expedients.filter((e) => e.id !== selectedExpedient.id);
        return {
          ...prev,
          expedients: updated,
          selectedExpedientId: updated[0]?.id || null,
          loading: false,
          success: `Expediente ${selectedExpedient.id} eliminado.`,
        };
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: `Error al eliminar expediente: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  };

  const loadInfractionRowsForExpedients = async (expedients: Expedient[]) => {
    if (infractionsTableUnavailableRef.current) return;
    if (infractionLoadInFlightRef.current) return;
    infractionLoadInFlightRef.current = true;
    try {
      const infractionIds = [
        ...new Set(
          expedients
            .map((e) => e.infractionId)
            .filter(Boolean)
            .map(String)
        ),
      ];
      const evidenceIds = [
        ...new Set(
          expedients
            .map((e) => e.evidenceId)
            .filter(Boolean)
            .map(String)
        ),
      ];
      const plates = [
        ...new Set(
          expedients
            .map((e) => e.licensePlate)
            .filter(Boolean)
            .map((x) => String(x).toUpperCase())
        ),
      ];

      let { data, error } = await supabase
        .from(SUPABASE_TABLES.INFRACTIONS)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(400);

      if (error) {
        const errorMessage = String(error.message || '');
        const errorCode = String((error as any)?.code || '');
        const errorStatus = Number((error as any)?.status || 0);
        const missingInfractions = errorMessage.includes(
          "Could not find the table 'public.infractions'"
        );
        const forbiddenInfractions =
          errorStatus === 403 ||
          errorCode === '42501' ||
          errorMessage.toLowerCase().includes('forbidden') ||
          errorMessage.toLowerCase().includes('permission denied');

        if (missingInfractions || forbiddenInfractions) {
          // Stop concurrent/repeated polling immediately while we test fallback table
          infractionsTableUnavailableRef.current = true;

          const incidentResult = await supabase
            .from('incidents')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(400);
          if (incidentResult.error) {
            const incidentStatus = Number((incidentResult.error as any)?.status || 0);
            const incidentCode = String((incidentResult.error as any)?.code || '');
            const incidentMessage = String((incidentResult.error as any)?.message || '').toLowerCase();
            const forbiddenIncidents =
              incidentStatus === 403 ||
              incidentCode === '42501' ||
              incidentMessage.includes('permission denied') ||
              incidentMessage.includes('forbidden');
            const missingIncidents = incidentMessage.includes("could not find the table 'public.incidents'");

            console.warn('[EXPEDIENT_PAGE] Failed to load incidents fallback rows:', incidentResult.error.message);

            if (forbiddenIncidents || missingIncidents) {
              supabaseReadUnavailableRef.current = true;
            }

            setState((prev) => ({
              ...prev,
              infractionsTableUnavailable: true,
              error: prev.error,
            }));
            return;
          }

          // Fallback available: re-enable infraction row loading
          infractionsTableUnavailableRef.current = false;
          data = (incidentResult.data || []).map(mapIncidentToInfractionRow);
          error = null as any;
        } else {
          console.warn('[EXPEDIENT_PAGE] Failed to load infractions schema rows:', error.message);
          return;
        }
      }

      const rowsByInfractionId = new Map<string, InfractionSchemaRow>(
        (data || []).map((row) => [
          String((row as InfractionSchemaRow).id),
          row as InfractionSchemaRow,
        ])
      );
      const rows = (data || []) as InfractionSchemaRow[];

      const byExpedientId: Record<string, InfractionSchemaRow | null> = {};
      for (const exp of expedients) {
        const expInfractionId = exp.infractionId ? String(exp.infractionId) : '';
        const expEvidenceId = exp.evidenceId ? String(exp.evidenceId) : '';
        const expPlate = String(exp.licensePlate || '').toUpperCase();
        const expTs = Number(exp.timestamp || 0);

        // 1) Direct match by infraction ID
        let match: InfractionSchemaRow | null =
          expInfractionId && rowsByInfractionId.has(expInfractionId)
            ? rowsByInfractionId.get(expInfractionId) || null
            : null;

        // 2) Match by evidence_id
        if (!match && expEvidenceId) {
          match = rows.find((r) => String(r.evidence_id || '') === expEvidenceId) || null;
        }

        // 3) Match by plate + closest timestamp (fallback)
        if (!match && expPlate) {
          const plateRows = rows.filter((r) => String(r.plate || '').toUpperCase() === expPlate);
          if (plateRows.length) {
            match =
              plateRows
                .map((r) => {
                  const rowTs = r.created_at ? new Date(r.created_at).getTime() : 0;
                  return { row: r, delta: Math.abs(rowTs - expTs) };
                })
                .sort((a, b) => a.delta - b.delta)[0]?.row || null;
          }
        }

        // 4) Final fallback: evidence_id/plate pools from current batch
        if (!match) {
          match =
            rows.find(
              (r) =>
                (infractionIds.length ? infractionIds.includes(String(r.id)) : false) ||
                (evidenceIds.length ? evidenceIds.includes(String(r.evidence_id || '')) : false) ||
                (plates.length ? plates.includes(String(r.plate || '').toUpperCase()) : false)
            ) || null;
        }

        byExpedientId[exp.id] = match;
      }

      setState((prev) => ({
        ...prev,
        infractionRowsByExpedientId: byExpedientId,
      }));
    } catch (err) {
      console.warn('[EXPEDIENT_PAGE] Unexpected infraction row load failure:', err);
    } finally {
      infractionLoadInFlightRef.current = false;
    }
  };

  return (
    <div className="expedient-list-page">
      {/* Animated Background */}
      <div className="absolute inset-0 hud-grid opacity-20 pointer-events-none" />
      <div className="scanline" />

      {/* Header */}
      <div className="page-header">
        <div className="page-title-wrap">
          <div className="forense-brand">
            <img src="/LOGO.png" alt="Escudo del Ayuntamiento" className="brand-crest" />
            <div className="brand-copy">
              <div className="brand-line-main">
                <h1>
                  <span className="brand-fore">FORENSE</span>
                  <span className="brand-ai">AI</span>
                </h1>
                <span className="brand-version">v1.0</span>
              </div>
              <p className="page-subtitle">UNIDAD AUDITORA</p>
            </div>
          </div>
        </div>
        <div className="header-metrics">
          <div className="metric-pill">
            <span className="metric-label">Detectados</span>
            <strong>{detectedCount}</strong>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Revisión</span>
            <strong>{reviewCount}</strong>
          </div>
          <div className="metric-pill">
            <span className="metric-label">Firmados</span>
            <strong>{signedCount}</strong>
          </div>
        </div>
        <div className="user-info">
          <span className="operator-name">{state.currentUser.name}</span>
          <span className="role-badge">{state.currentUser.role}</span>
        </div>
      </div>

      {/* Alert Messages */}
      {state.error && (
        <div className="alert alert-error">
          <p>{state.error}</p>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))}>✕</button>
        </div>
      )}
      {state.success && (
        <div className="alert alert-success">
          <p>✓ {state.success}</p>
          <button onClick={() => setState((prev) => ({ ...prev, success: null }))}>✕</button>
        </div>
      )}

      {/* Main Content */}
      <div className="page-content">
        {/* Left Panel: Expedient List */}
        <div className="left-panel">
          <div className="panel-header">
            <h2>
              Cola de Expedientes
              {!state.loading && <span className="count">{state.expedients.length}</span>}
            </h2>
            <button
              onClick={() => loadPendingExpedients({ silent: false, manual: true })}
              disabled={state.loading}
              className="btn-refresh"
            >
              {state.loading
                ? 'Cargando...'
                : state.manualRefreshing
                  ? 'Actualizando...'
                  : 'Actualizar'}
            </button>
          </div>

          <div className="expedient-list">
            {state.loading ? (
              <div className="loading-state">
                <p>Cargando expedientes e infracciones...</p>
              </div>
            ) : state.expedients.length === 0 && state.infractions.length === 0 ? (
              <div className="empty-state" />
            ) : (
              <>
                {/* Expedientes */}
                {state.expedients.map((expedient) => (
                  <div
                    key={`exp-${expedient.id}`}
                    className={`expedient-item ${
                      state.selectedType === 'expedient' && state.selectedExpedientId === expedient.id ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        selectedExpedientId: expedient.id,
                        selectedInfractionId: null,
                        selectedType: 'expedient',
                      }))
                    }
                  >
                    <div className="expedient-header">
                      <span className="plate">{expedient.licensePlate}</span>
                      <span className={`state-badge state-${expedient.state.toLowerCase()}`}>
                        {getStateLabel(expedient.state)}
                      </span>
                    </div>
                    <div className="expedient-details">
                      <p className="violation">{traducirTipoInfraccion(expedient.violationType)}</p>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Ubicación:</span>
                          <span className="detail-value">{expedient.location}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Vehículo:</span>
                          <span className="detail-value">
                            {expedient.marca || expedient.makeModel || '—'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Fecha/Hora:</span>
                          <span className="detail-value">
                            {new Date(expedient.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {expedient.gravedad && (
                          <div className="detail-item">
                            <span className="detail-label">Gravedad:</span>
                            <span
                              className={`detail-value severity-${expedient.gravedad.toLowerCase().replace(' ', '-')}`}
                            >
                              {expedient.gravedad}
                            </span>
                          </div>
                        )}
                      </div>
                      {expedient.normaSancionadoraNombre && (
                        <div className="legal-summary">
                          <div className="legal-item">
                            <span className="legal-label">Norma:</span>
                            <span className="legal-value">{expedient.normaSancionadoraNombre}</span>
                          </div>
                          {expedient.articuloSancionador && (
                            <div className="legal-item">
                              <span className="legal-label">Art.</span>
                              <span className="legal-value">{expedient.articuloSancionador}</span>
                            </div>
                          )}
                          {expedient.codigoSenal && (
                            <div className="legal-item">
                              <span className="legal-label">Signal:</span>
                              <span className="legal-value">{expedient.codigoSenal}</span>
                            </div>
                          )}
                          {expedient.fineAmount && (
                            <div className="legal-item fine">
                              <span className="legal-label">Sanción:</span>
                              <span className="legal-value">{expedient.fineAmount}€</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Infracciones sin expediente */}
                {state.infractions.map((infraction) => (
                  <div
                    key={`inf-${infraction.id}`}
                    className={`expedient-item ${
                      state.selectedType === 'infraction' && state.selectedInfractionId === infraction.id ? 'selected' : ''
                    }`}
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        selectedExpedientId: null,
                        selectedInfractionId: infraction.id,
                        selectedType: 'infraction',
                      }))
                    }
                  >
                    <div className="expedient-header">
                      <span className="plate">{infraction.plate || 'SENT_IA'}</span>
                      <span className={`state-badge state-detected`}>
                        DETECTADA
                      </span>
                    </div>
                    <div className="expedient-details">
                      <p className="violation">{infraction.ruleCategory || 'Infracción IA'}</p>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Vehículo:</span>
                          <span className="detail-value">
                            {infraction.makeModel || '—'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Color:</span>
                          <span className="detail-value">{infraction.color || '—'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Hora:</span>
                          <span className="detail-value">{infraction.time || '—'}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Gravedad:</span>
                          <span className="detail-value">{infraction.severity || '—'}</span>
                        </div>
                      </div>
                      {infraction.description && (
                        <div className="legal-summary">
                          <div className="legal-item">
                            <span className="legal-label">Descripción:</span>
                            <span className="legal-value">{infraction.description}</span>
                          </div>
                          {infraction.fineAmount && (
                            <div className="legal-item fine">
                              <span className="legal-label">Multa:</span>
                              <span className="legal-value">{infraction.fineAmount}€</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="mt-3 p-3 pt-0">
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent('sentinel:set-view', { detail: 'detection' }))
              }
              className="w-full py-3 text-[10px] font-bold uppercase tracking-widest transition-colors border border-blue-500/60 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
            >
              MODULO DE DETECCION
            </button>
          </div>
        </div>

        {/* Right Panel: Workflow Details, Infraction Modal, or Infractions Table */}
        <div className="right-panel">
          {state.selectedType === 'expedient' && selectedExpedient ? (
            <>
              <ExpedientWorkflow
                expedient={selectedExpedient}
                onStateChange={handleStateChange}
                currentUser={state.currentUser}
                infractionRow={selectedInfractionRow}
                expedientImages={state.expedientImagesByExpedientId[selectedExpedient.id] || []}
              />

              {/* Export Buttons - PHASE 1b: Enforce validation */}
              <div className="export-section">
                {/* PREINFORME: Available anytime for preview */}
                <button
                  onClick={handleExportPreinforme}
                  disabled={state.loading}
                  className="btn-export btn-preinforme"
                  title="Descargar preinforme para revisión"
                >
                  📄 Descargar Preinforme (PDF)
                </button>

                {/* OFICIAL: Only available after signature */}
                <button
                  onClick={handleExportPDF}
                  disabled={!canExportOfficialPDF || state.loading}
                  className="btn-export"
                  title={
                    !canExportOfficialPDF
                      ? 'Reporte oficial disponible solo después de firma digital'
                      : 'Descargar reporte OFICIAL'
                  }
                >
                  📥 Descargar Reporte Oficial (PDF)
                </button>

                {/* EXCEL: All data with embedded images */}
                <button
                  onClick={handleExportExcel}
                  disabled={state.loading}
                  className="btn-export btn-excel"
                  title="Descargar todos los datos en Excel con imágenes incrustadas"
                >
                  📊 Descargar Excel (Datos + Imágenes)
                </button>

                <button
                  onClick={handleDeleteExpedient}
                  disabled={state.loading}
                  className="btn-export btn-delete"
                  title="Eliminar expediente permanentemente"
                >
                  🗑 Eliminar Expediente
                </button>

                {!canExportOfficialPDF && (
                  <p className="export-help">
                    ⓘ Reporte oficial disponible solo después de:
                    <strong> Validación → Firma Digital</strong>
                  </p>
                )}
              </div>
            </>
          ) : state.selectedType === 'infraction' && selectedInfraction ? (
            <InfractionModal
              log={selectedInfraction}
              onClose={() =>
                setState((prev) => ({
                  ...prev,
                  selectedInfractionId: null,
                  selectedType: null,
                }))
              }
            />
          ) : (
            <div className="empty-selection p-8 flex flex-col items-center justify-center gap-4">
              <div className="text-slate-400 text-center">
                <p className="text-sm uppercase tracking-widest font-bold">Sin selección</p>
                <p className="text-xs text-slate-500 mt-2">Selecciona una infracción o expediente de la lista izquierda para ver los detalles</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        :root {
          --exp-bg: #0d0d0f;
          --exp-panel: #0f1115;
          --exp-card: #0f1115;
          --exp-card-hover: #121723;
          --exp-border-soft: rgba(255, 255, 255, 0.06);
          --exp-border-mid: rgba(255, 255, 255, 0.08);
          --exp-border-blue: rgba(255, 255, 255, 0.18);
          --exp-text-dim: #7f8ea8;
          --exp-text-mid: #93a2bc;
        }

        /* Expedients Theme - Dark slate/blue panels */
        .expedient-list-page {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #06080d;
          font-family: 'Rajdhani', 'Inter', sans-serif;
          color: #edf2ff;
          overflow: hidden;
        }

        .page-header {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 16px 22px;
          background: linear-gradient(90deg, rgba(13, 21, 42, 0.94), rgba(10, 18, 35, 0.9));
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(245, 158, 11, 0.35);
        }

        .page-title-wrap {
          min-width: 220px;
        }

        .forense-brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .brand-crest {
          width: 48px;
          height: 48px;
          object-fit: contain;
          filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.28));
        }

        .brand-copy {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .brand-line-main {
          display: flex;
          align-items: flex-end;
          gap: 7px;
        }

        .page-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 900;
          font-style: italic;
          color: #f8fafc;
          letter-spacing: -0.02em;
          text-transform: uppercase;
          line-height: 1;
          display: flex;
          align-items: baseline;
          gap: 6px;
          font-family: 'Inter', 'Segoe UI', sans-serif;
        }

        .brand-fore {
          color: #f8fafc;
        }

        .brand-ai {
          color: #ef4444;
        }

        .brand-version {
          color: #ef4444;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          line-height: 1;
          margin-bottom: 1px;
          opacity: 0.65;
        }

        .page-subtitle {
          margin: 0;
          font-size: 10px;
          color: #ef4444;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-weight: 700;
          line-height: 1;
          display: inline-flex;
          align-items: center;
          gap: 9px;
        }

        .page-subtitle::before,
        .page-subtitle::after {
          content: '';
          width: 34px;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(239, 68, 68, 0.8) 100%);
        }

        .page-subtitle::after {
          background: linear-gradient(90deg, rgba(239, 68, 68, 0.8) 0%, transparent 100%);
        }

        .header-metrics {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .metric-pill {
          display: flex;
          align-items: baseline;
          gap: 8px;
          background: rgba(10, 17, 33, 0.92);
          border: 1px solid rgba(59, 130, 246, 0.22);
          border-radius: 12px;
          padding: 8px 12px;
          min-width: 106px;
        }

        .metric-label {
          font-size: 10px;
          color: #94a3b8;
          text-transform: uppercase;
        }

        .metric-pill strong {
          font-size: 14px;
          color: #fde68a;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;
          color: #94a3b8;
          font-family: 'Share Tech Mono', monospace;
        }

        .operator-name {
          max-width: 180px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .role-badge {
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #3b82f6;
          padding: 4px 12px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.2);
        }

        .alert {
          position: relative;
          z-index: 15;
          padding: 12px 16px;
          border-radius: 4px;
          margin: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-left: 3px solid;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 12px;
        }

        .alert-error {
          border-left-color: #ef4444;
          color: #fca5a5;
        }

        .alert-success {
          border-left-color: #10b981;
          color: #86efac;
        }

        .alert button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 16px;
          transition: opacity 0.2s;
        }

        .alert button:hover {
          opacity: 0.7;
        }

        .page-content {
          position: relative;
          z-index: 10;
          display: flex;
          flex: 1;
          overflow: hidden;
          gap: 12px;
          padding: 12px;
        }

        .left-panel {
          flex: 0 0 360px;
          display: flex;
          flex-direction: column;
          background: #06080d;
          border: 1px solid var(--exp-border-soft);
          border-radius: 12px;
          overflow: hidden;
          backdrop-filter: blur(10px);
          box-shadow: none;
        }

        .left-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: transparent;
          pointer-events: none;
          border-radius: 6px;
        }

        .panel-header {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          border-bottom: 1px solid var(--exp-border-soft);
          background: #12141b;
        }

        .panel-header h2 {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          color: #a6b2c4;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        .count {
          background: #151a26;
          border: 1px solid rgba(255, 255, 255, 0.16);
          color: #a9b5c8;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 10px;
          font-weight: 700;
        }

        .btn-refresh {
          padding: 8px 14px;
          background: #151a26;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          cursor: pointer;
          font-size: 11px;
          color: var(--exp-text-mid);
          transition: all 0.2s;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn-refresh:hover:not(:disabled) {
          background: #1a2030;
          border-color: rgba(255, 255, 255, 0.24);
          color: #b7c6de;
        }

        .btn-refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .expedient-list {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background: #0d0d0f;
          scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
          scrollbar-width: thin;
        }

        .expedient-list::-webkit-scrollbar {
          width: 6px;
        }

        .expedient-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .expedient-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.14);
          border-radius: 3px;
        }

        .expedient-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .loading-state,
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #64748b;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.05em;
        }

        .expedient-item {
          padding: 12px 12px;
          margin-bottom: 10px;
          background: #151821;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.25s ease-out;
          position: relative;
          overflow: hidden;
        }

        .expedient-item::before {
          content: '';
          position: absolute;
          inset: 0;
          background: transparent;
          opacity: 0;
          transition: opacity 0.25s;
        }

        .expedient-item:hover {
          background: #1a1f2d;
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
        }

        .expedient-item:hover::before {
          opacity: 1;
        }

        .expedient-item.selected {
          background: #1a2230;
          border-color: #2f7fff;
          border-radius: 16px;
          box-shadow: inset 0 0 0 1px rgba(47, 127, 255, 0.38);
        }

        .expedient-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          position: relative;
          z-index: 1;
        }

        .plate {
          font-weight: 800;
          font-family: 'OCR A', monospace;
          font-size: 14px;
          color: #e7edf8;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .state-badge {
          font-size: 10px;
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
        }

        .state-detected { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
        .state-under_review { background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%); }
        .state-validated { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); }
        .state-signed { background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%); }
        .state-exported { background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%); }

        .expedient-details {
          font-size: 10px;
          color: var(--exp-text-dim);
          position: relative;
          z-index: 1;
        }

        .violation {
          margin: 3px 0;
          font-weight: 800;
          color: #dce7f8;
          font-size: 13px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          line-height: 1.05;
          font-family: 'Rajdhani', 'Share Tech Mono', monospace;
        }

        .detail-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          line-height: 1.32;
        }

        .detail-label {
          color: #6f7f98;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .detail-value {
          color: var(--exp-text-mid);
          text-align: right;
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .detail-value.severity-leve { color: #22c55e; }
        .detail-value.severity-grave { color: #f59e0b; }
        .detail-value.severity-muy-grave { color: #ef4444; }

        .legal-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .legal-item {
          display: flex;
          align-items: center;
          gap: 3px;
          padding: 3px 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          font-size: 8px;
        }

        .legal-item.fine {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .legal-label {
          color: #7c8da8;
          text-transform: uppercase;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .legal-value {
          color: var(--exp-text-mid);
          font-weight: 500;
        }

        .legal-item.fine .legal-value {
          color: #34d399;
        }

        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #06080d;
          border: 1px solid var(--exp-border-soft);
          border-radius: 12px;
          overflow: hidden;
          backdrop-filter: blur(10px);
          min-height: 0;
          box-shadow: none;
        }

        .right-panel > div:first-child {
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }

        .right-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: transparent;
          pointer-events: none;
          border-radius: 6px;
        }


        .empty-selection {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: transparent;
          min-height: 0;
          overflow: hidden;
        }

        .expedient-workflow {
          flex: 1;
          overflow-y: auto;
          scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
          scrollbar-width: thin;
          padding: 12px;
        }

        .expedient-workflow::-webkit-scrollbar {
          width: 6px;
        }

        .expedient-workflow::-webkit-scrollbar-track {
          background: transparent;
        }

        .expedient-workflow::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.2);
          border-radius: 3px;
        }

        .expedient-workflow::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.4);
        }

        .export-section {
          padding: 12px;
          border-top: 1px solid var(--exp-border-soft);
          background: #12151d;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          align-items: stretch;
          gap: 8px;
          margin: 0;
          overflow: hidden;
        }

        .btn-export {
          width: 100%;
          min-width: 0;
          padding: 10px 12px;
          background: #161b27;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #8ea0bf;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 800;
          font-size: 11px;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          white-space: normal;
          line-height: 1.25;
          text-align: center;
          font-family: 'Share Tech Mono', 'Courier New', monospace;
        }

        .btn-export:hover:not(:disabled) {
          background: #1b2232;
          border-color: var(--exp-border-blue);
          color: #b8c8e2;
        }

        .btn-export:disabled {
          background: rgba(100, 116, 139, 0.1);
          border-color: rgba(100, 116, 139, 0.2);
          color: #94a3b8;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-preinforme {
          background: rgba(8, 47, 73, 0.68);
          border-color: rgba(34, 211, 238, 0.45);
          color: #a5f3fc;
        }

        .btn-preinforme:hover:not(:disabled) {
          background: rgba(8, 78, 104, 0.6);
          border-color: rgba(34, 211, 238, 0.7);
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.2);
        }

        .btn-excel {
          background: rgba(30, 64, 175, 0.35);
          border-color: rgba(59, 130, 246, 0.55);
          color: #93c5fd;
        }

        .btn-excel:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.3);
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
        }

        .btn-delete {
          background: rgba(127, 29, 29, 0.42);
          border-color: rgba(239, 68, 68, 0.45);
          color: #fca5a5;
        }

        .btn-delete:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.28);
          border-color: rgba(239, 68, 68, 0.7);
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.25);
        }

        .export-help {
          grid-column: 1 / -1;
          margin-top: 2px;
          padding: 10px;
          background: rgba(59, 130, 246, 0.1);
          border-left: 3px solid rgba(59, 130, 246, 0.4);
          color: #93c5fd;
          font-size: 10px;
          border-radius: 3px;
          letter-spacing: 0.3px;
        }

        .export-help strong {
          font-weight: 700;
          color: #bfdbfe;
        }

        @media (max-width: 1440px) {
          .export-section {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1024px) {
          .page-header h1 {
            font-size: 22px;
          }

          .brand-version {
            font-size: 8px;
            margin-bottom: 2px;
          }

          .page-subtitle {
            font-size: 9px;
          }

          .page-subtitle::before,
          .page-subtitle::after {
            width: 24px;
          }

          .brand-crest {
            width: 36px;
            height: 36px;
          }

          .page-content {
            flex-direction: column;
          }

          .left-panel {
            flex: 0 0 auto;
            max-height: 280px;
          }

          .right-panel {
            flex: 1;
            min-height: 0;
          }

          .export-section {
            grid-template-columns: 1fr;
          }
        }

        @keyframes glow-pulse {
          0%, 100% {
            box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
          }
          50% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
          }
        }

        .expedient-item.selected {
          animation: glow-pulse 2s ease-in-out infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes pulse-glow {
          0%, 100% {
            filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.6)) drop-shadow(0 0 30px rgba(34, 211, 238, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 25px rgba(59, 130, 246, 0.9)) drop-shadow(0 0 50px rgba(34, 211, 238, 0.6));
          }
        }

      `}</style>
    </div>
  );
};

function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    DETECTED: 'Detectada',
    UNDER_REVIEW: 'Bajo revisión',
    VALIDATED: 'Validada',
    REJECTED: 'Rechazada',
    SIGNED: 'Firmada',
    EXPORTED: 'Exportada',
    ARCHIVED: 'Archivada',
  };
  return labels[state] || state;
}

function traducirTipoInfraccion(tipo?: string): string {
  const map: Record<string, string> = {
    STOP_NO_DETENCION: 'STOP - NO DETENCIÓN',
    CEDA_NO_RESPETADO: 'CEDA EL PASO NO RESPETADO',
    PRIORIDAD_PEATONAL: 'PRIORIDAD PEATONAL',
    SEMAFORO_ROJO: 'SEMÁFORO EN ROJO',
    GIRO_PROHIBIDO: 'GIRO PROHIBIDO',
    DIRECCION_OBLIGATORIA_INCUMPLIDA: 'DIRECCIÓN OBLIGATORIA INCUMPLIDA',
    SENTIDO_CONTRARIO: 'SENTIDO CONTRARIO',
    DOBLE_FILA: 'DOBLE FILA',
    BLOQUEO_INTERSECCION: 'BLOQUEO DE INTERSECCIÓN',
    CARRIL_BUS: 'CARRIL BUS / TAXI',
    INVASION_ARCEN: 'INVASIÓN DE ARCÉN',
    LINEA_CONTINUA: 'LÍNEA CONTINUA',
    FORBIDDEN_TURN: 'GIRO PROHIBIDO',
    STOP: 'STOP - NO DETENCIÓN',
    SPEED_VIOLATION: 'EXCESO DE VELOCIDAD',
    OTHER: 'OTRA INFRACCIÓN',
  };
  return map[String(tipo || '').toUpperCase()] || String(tipo || 'OTRA INFRACCIÓN');
}
