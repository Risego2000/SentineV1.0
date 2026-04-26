/**
 * Expedient List Page - TIER 1
 * Displays pending expedients and allows review workflow
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Expedient } from '../domain/Expedient';
import { ExpedientWorkflow } from '../components/ExpedientWorkflow';
import { PDFExportService } from '../services/PDFExportService';
import { ExcelExportService } from '../services/ExcelExportService';
import { getExpedientService } from '../services/ExpedientService';

interface PageState {
  expedients: Expedient[];
  selectedExpedientId: string | null;
  loading: boolean;
  error: string | null;
  success?: string | null;
  currentUser: {
    name: string;
    role: 'OPERATOR' | 'SUPERVISOR' | 'ADMIN';
  };
}

const isUserRole = (role: string | null): role is PageState['currentUser']['role'] =>
  role === 'OPERATOR' || role === 'SUPERVISOR' || role === 'ADMIN';

export const ExpedientListPage: React.FC = () => {
  const [state, setState] = useState<PageState>({
    expedients: [],
    selectedExpedientId: null,
    loading: true,
    error: null,
    currentUser: {
      name: sessionStorage.getItem('currentUserName') || 'Operador',
      role: isUserRole(sessionStorage.getItem('currentUserRole'))
        ? sessionStorage.getItem('currentUserRole')
        : 'OPERATOR',
    },
  });

  const expedientService = getExpedientService();
  const selectedExpedient = state.expedients.find((e) => e.id === state.selectedExpedientId);
  const detectedCount = state.expedients.filter((e) => e.state === 'DETECTED').length;
  const reviewCount = state.expedients.filter((e) => e.state === 'UNDER_REVIEW').length;
  const validatedCount = state.expedients.filter((e) => e.state === 'VALIDATED').length;

  const loadPendingExpedients = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Load all active expedients (except ARCHIVED)
      const states = ['DETECTED', 'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'SIGNED', 'EXPORTED'];
      const allExpedients: Expedient[] = [];

      for (const state of states) {
        const expedients = await expedientService.getExpedientsByState(state);
        allExpedients.push(...expedients);
      }

      const all = allExpedients.sort((a, b) => b.createdAt - a.createdAt);

      setState((prev) => ({
        ...prev,
        expedients: all,
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: `Error loading expedients: ${error instanceof Error ? error.message : String(error)}`,
        loading: false,
      }));
    }
  }, [expedientService]);

  // Load pending expedients on mount
  useEffect(() => {
    loadPendingExpedients();
  }, [loadPendingExpedients]);

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

  return (
    <div className="expedient-list-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <h1>Expedientes de Infracción</h1>
          <p className="header-subtitle">Unidad Forense | Cadena de Custodia Digital</p>
        </div>
        <div className="header-right">
          <div className="hud-kpis">
            <div className="hud-kpi">
              <span className="kpi-label">Detectadas</span>
              <span className="kpi-value">{detectedCount}</span>
            </div>
            <div className="hud-kpi">
              <span className="kpi-label">Revisión</span>
              <span className="kpi-value">{reviewCount}</span>
            </div>
            <div className="hud-kpi">
              <span className="kpi-label">Validadas</span>
              <span className="kpi-value">{validatedCount}</span>
            </div>
          </div>
          <div className="user-info">
            <span>{state.currentUser.name}</span>
            <span className="role-badge">{state.currentUser.role}</span>
          </div>
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
              Pendientes
              {!state.loading && <span className="count">{state.expedients.length}</span>}
            </h2>
            <button
              onClick={loadPendingExpedients}
              disabled={state.loading}
              className="btn-refresh"
            >
              {state.loading ? '⟳ Cargando...' : '⟳ Actualizar'}
            </button>
          </div>

          <div className="expedient-list">
            {state.loading ? (
              <div className="loading-state">
                <p>Cargando expedientes...</p>
              </div>
            ) : state.expedients.length === 0 ? (
              <div className="empty-state">
                <p>No hay expedientes pendientes</p>
              </div>
            ) : (
              state.expedients.map((expedient) => (
                <div
                  key={expedient.id}
                  className={`expedient-item ${
                    state.selectedExpedientId === expedient.id ? 'selected' : ''
                  }`}
                  onClick={() =>
                    setState((prev) => ({ ...prev, selectedExpedientId: expedient.id }))
                  }
                >
                  <div className="expedient-header">
                    <span className="plate">{expedient.licensePlate}</span>
                    <span
                      className={`expedient-state-badge state-${expedient.state.toLowerCase()}`}
                    >
                      {getStateLabel(expedient.state)}
                    </span>
                  </div>
                  <div className="expedient-details">
                    <p className="violation">{expedient.violationType}</p>
                    <p className="location">{expedient.location}</p>
                    <p className="time">{new Date(expedient.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Workflow Details */}
        <div className="right-panel">
          {selectedExpedient ? (
            <>
              <ExpedientWorkflow
                expedient={selectedExpedient}
                onStateChange={handleStateChange}
                currentUser={state.currentUser}
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
                  Descargar Preinforme (PDF)
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
                  Descargar Reporte Oficial (PDF)
                </button>

                {/* EXCEL: All data with embedded images */}
                <button
                  onClick={handleExportExcel}
                  disabled={state.loading}
                  className="btn-export btn-excel"
                  title="Descargar todos los datos en Excel con imágenes incrustadas"
                >
                  Descargar Excel (Datos + Imágenes)
                </button>

                {!canExportOfficialPDF && (
                  <p className="export-help">
                    Reporte oficial disponible solo después de:
                    <strong> Validación → Firma Digital</strong>
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="empty-selection">
              <p>Selecciona un expediente para revisar</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* DARK THEME - Consistent with SENTINEL.AI Detection Screen */
        .expedient-list-page {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background:
            radial-gradient(circle at 50% 46%, rgba(14, 165, 233, 0.12), transparent 28%),
            linear-gradient(180deg, #01030d 0%, #050811 100%);
          border: 1px solid rgba(59, 130, 246, 0.42);
          border-radius: 8px;
          overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
          color: #cbd5e1;
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.015),
            0 0 34px rgba(59, 130, 246, 0.08);
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          min-height: 66px;
          padding: 12px 18px;
          background: rgba(2, 6, 23, 0.78);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .page-header h1 {
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          color: #e2e8f0;
          text-transform: uppercase;
          letter-spacing: 0.16em;
        }

        .header-left {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .header-subtitle {
          margin: 0;
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.18em;
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 10px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .hud-kpis {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .hud-kpi {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 66px;
          padding: 7px 9px;
          border-radius: 6px;
          border: 1px solid rgba(59, 130, 246, 0.28);
          background: rgba(15, 23, 42, 0.48);
        }

        .kpi-label {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.09em;
        }

        .kpi-value {
          font-size: 14px;
          font-weight: 900;
          color: #3b82f6;
          line-height: 1;
        }

        .role-badge {
          background: rgba(59, 130, 246, 0.18);
          color: #93c5fd;
          border: 1px solid rgba(59, 130, 246, 0.45);
          padding: 5px 10px;
          border-radius: 6px;
          font-weight: 900;
          font-size: 10px;
          text-transform: uppercase;
          box-shadow: 0 0 14px rgba(59, 130, 246, 0.18);
        }


        .alert {
          padding: 10px 12px;
          border-radius: 8px;
          margin: 8px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border: 1px solid;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
        }

        .alert-error {
          background: rgba(239, 68, 68, 0.12);
          color: #fb7185;
          border-color: rgba(239, 68, 68, 0.35);
        }

        .alert-success {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.35);
        }

        .alert button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 18px;
          transition: opacity 0.2s;
        }

        .alert button:hover {
          opacity: 0.7;
        }

        .page-content {
          display: flex;
          flex: 1;
          overflow: hidden;
          gap: 8px;
          padding: 8px;
        }

        .left-panel {
          flex: 0 0 300px;
          display: flex;
          flex-direction: column;
          background: #0d0d0f;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
        }

        .panel-header h2 {
          margin: 0;
          font-size: 11px;
          color: #e2e8f0;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
        }

        .count {
          background: #3b82f6;
          color: #020617;
          padding: 3px 9px;
          border-radius: 12px;
          font-size: 9px;
          font-weight: 900;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
        }

        .btn-refresh {
          padding: 8px 11px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.45);
          border-radius: 7px;
          cursor: pointer;
          font-size: 10px;
          color: #3b82f6;
          transition: all 0.3s;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .btn-refresh:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.18);
          color: #60a5fa;
          box-shadow: 0 0 16px rgba(59, 130, 246, 0.22);
        }

        .btn-refresh:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .expedient-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          scrollbar-color: rgba(148, 163, 184, 0.25) transparent;
          scrollbar-width: thin;
        }

        .expedient-list::-webkit-scrollbar {
          width: 4px;
        }

        .expedient-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .expedient-list::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.2);
          border-radius: 10px;
        }

        .expedient-list::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.4);
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
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .expedient-item {
          padding: 12px;
          margin-bottom: 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .expedient-item:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(59, 130, 246, 0.35);
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.12);
        }

        .expedient-item.selected {
          background: rgba(59, 130, 246, 0.1);
          border-color: #3b82f6;
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.22);
        }

        .expedient-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .plate {
          font-weight: 900;
          font-family: 'Share Tech Mono', 'Courier New', monospace;
          font-size: 13px;
          color: #3b82f6;
          letter-spacing: 0.08em;
        }

        .expedient-state-badge {
          font-size: 9px;
          padding: 4px 9px;
          border-radius: 4px;
          font-weight: 900;
          border: 1px solid rgba(255, 255, 255, 0.08);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .state-detected { color: #f59e0b; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.35); }
        .state-under_review { color: #38bdf8; background: rgba(59, 130, 246, 0.12); border-color: rgba(59, 130, 246, 0.38); }
        .state-validated { color: #34d399; background: rgba(16, 185, 129, 0.12); border-color: rgba(16, 185, 129, 0.35); }
        .state-signed { color: #c4b5fd; background: rgba(139, 92, 246, 0.12); border-color: rgba(139, 92, 246, 0.35); }
        .state-exported { color: #2dd4bf; background: rgba(20, 184, 166, 0.12); border-color: rgba(20, 184, 166, 0.35); }
        .state-rejected { color: #fb7185; background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.35); }

        .expedient-details {
          font-size: 9px;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .violation {
          margin: 3px 0;
          font-weight: 800;
          color: #e2e8f0;
        }

        .location {
          margin: 3px 0;
          color: #64748b;
          font-size: 9px;
        }

        .time {
          margin: 5px 0 0 0;
          color: #475569;
          font-size: 9px;
        }

        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #0d0d0f;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .empty-selection {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #64748b;
          font-size: 11px;
          font-family: 'Share Tech Mono', 'Courier New', monospace;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          background:
            radial-gradient(circle at 50% 42%, rgba(59, 130, 246, 0.1), transparent 24%),
            #01030d;
        }

        .expedient-workflow {
          flex: 1;
          overflow-y: auto;
          scrollbar-color: rgba(148, 163, 184, 0.25) transparent;
          scrollbar-width: thin;
        }

        .expedient-workflow::-webkit-scrollbar {
          width: 4px;
        }

        .expedient-workflow::-webkit-scrollbar-track {
          background: transparent;
        }

        .expedient-workflow::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.2);
          border-radius: 10px;
        }

        .expedient-workflow::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.4);
        }

        .export-section {
          padding: 12px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .btn-export {
          width: 100%;
          padding: 11px 12px;
          background: rgba(255, 255, 255, 0.02);
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 900;
          font-size: 10px;
          transition: all 0.25s;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .btn-export:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.5);
          color: #60a5fa;
          box-shadow: 0 0 16px rgba(59, 130, 246, 0.2);
        }

        .btn-export:disabled {
          background: rgba(71, 85, 105, 0.22);
          border-color: rgba(148, 163, 184, 0.12);
          color: #64748b;
          cursor: not-allowed;
          opacity: 0.68;
        }

        .btn-preinforme {
          background: rgba(14, 165, 233, 0.1);
          border-color: rgba(14, 165, 233, 0.42);
          color: #38bdf8;
        }

        .btn-preinforme:hover:not(:disabled) {
          background: rgba(14, 165, 233, 0.18);
          border-color: rgba(14, 165, 233, 0.65);
          box-shadow: 0 0 16px rgba(14, 165, 233, 0.2);
        }

        .btn-excel {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.45);
          color: #93c5fd;
        }

        .btn-excel:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.28);
          border-color: rgba(59, 130, 246, 0.75);
          box-shadow: 0 0 14px rgba(59, 130, 246, 0.28);
        }

        .export-help {
          margin: 2px 0 0;
          padding: 9px 10px;
          background: rgba(15, 23, 42, 0.5);
          color: #64748b;
          font-size: 9px;
          border-radius: 7px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .export-help strong {
          font-weight: bold;
          color: #93c5fd;
        }

        @media (max-width: 1024px) {
          .page-content {
            flex-direction: column;
          }

          .left-panel {
            flex: 0 0 auto;
            max-height: 300px;
          }

          .right-panel {
            flex: 1;
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
