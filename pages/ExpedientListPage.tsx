/**
 * Expedient List Page - TIER 1
 * Displays pending expedients and allows review workflow
 */

import React, { useEffect, useState } from 'react';
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

export const ExpedientListPage: React.FC = () => {
  const [state, setState] = useState<PageState>({
    expedients: [],
    selectedExpedientId: null,
    loading: true,
    error: null,
    currentUser: {
      name: sessionStorage.getItem('currentUserName') || 'Operador',
      role: (sessionStorage.getItem('currentUserRole') as any) || 'OPERATOR',
    },
  });

  const expedientService = getExpedientService();
  const selectedExpedient = state.expedients.find((e) => e.id === state.selectedExpedientId);

  // Load pending expedients on mount
  useEffect(() => {
    loadPendingExpedients();
  }, []);

  const loadPendingExpedients = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // Load all active expedients (except ARCHIVED)
      const states = ['DETECTED', 'UNDER_REVIEW', 'VALIDATED', 'REJECTED', 'SIGNED', 'EXPORTED'];
      const allExpedients: Expedient[] = [];

      for (const state of states) {
        const expedients = await expedientService.getExpedientsByState(state);
        allExpedients.push(...expedients);
      }

      const all = allExpedients.sort(
        (a, b) => b.createdAt - a.createdAt
      );

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
        error: 'Solo se pueden exportar reportes OFICIALES después de la firma digital. Genera un PREINFORME para previsualizaciones.',
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
  const canExportOfficialPDF = selectedExpedient &&
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
      if (selectedExpedient && 'extraSnapshots' in selectedExpedient && selectedExpedient.extraSnapshots) {
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
      if (selectedExpedient && 'zoomSnapshots' in selectedExpedient && selectedExpedient.zoomSnapshots) {
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
        <h1>Expedientes de Infracción</h1>
        <div className="user-info">
          <span>{state.currentUser.name}</span>
          <span className="role-badge">{state.currentUser.role}</span>
        </div>
      </div>

      {/* Alert Messages */}
      {state.error && (
        <div className="alert alert-error">
          <p>{state.error}</p>
          <button onClick={() => setState((prev) => ({ ...prev, error: null }))}>
            ✕
          </button>
        </div>
      )}
      {state.success && (
        <div className="alert alert-success">
          <p>✓ {state.success}</p>
          <button onClick={() => setState((prev) => ({ ...prev, success: null }))}>
            ✕
          </button>
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
            <button onClick={loadPendingExpedients} disabled={state.loading} className="btn-refresh">
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
                  onClick={() => setState((prev) => ({ ...prev, selectedExpedientId: expedient.id }))}
                >
                  <div className="expedient-header">
                    <span className="plate">{expedient.licensePlate}</span>
                    <span className={`state-badge state-${expedient.state.toLowerCase()}`}>
                      {getStateLabel(expedient.state)}
                    </span>
                  </div>
                  <div className="expedient-details">
                    <p className="violation">{expedient.violationType}</p>
                    <p className="location">{expedient.location}</p>
                    <p className="time">
                      {new Date(expedient.timestamp).toLocaleString()}
                    </p>
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
                  📄 Descargar Preinforme (PDF)
                </button>

                {/* OFICIAL: Only available after signature */}
                <button
                  onClick={handleExportPDF}
                  disabled={!canExportOfficialPDF || state.loading}
                  className="btn-export"
                  title={!canExportOfficialPDF ? 'Reporte oficial disponible solo después de firma digital' : 'Descargar reporte OFICIAL'}
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

                {!canExportOfficialPDF && (
                  <p className="export-help">
                    ⓘ Reporte oficial disponible solo después de:
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
          background: #0f1419;
          font-family: 'Share Tech Mono', 'Courier New', monospace;
          color: #ecf0f1;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 30px;
          background: linear-gradient(135deg, #1a2332 0%, #0f1419 100%);
          border-bottom: 2px solid #00d9ff;
          box-shadow: 0 4px 20px rgba(0, 217, 255, 0.15);
        }

        .page-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: bold;
          color: #00d9ff;
          text-shadow: 0 0 10px rgba(0, 217, 255, 0.5);
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 15px;
          font-size: 13px;
          color: #b0bec5;
        }

        .role-badge {
          background: linear-gradient(135deg, #00d9ff, #0099cc);
          color: #0f1419;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 11px;
          text-transform: uppercase;
          box-shadow: 0 0 15px rgba(0, 217, 255, 0.4);
        }

        .alert {
          padding: 14px 18px;
          border-radius: 6px;
          margin: 12px 15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-left: 4px solid;
        }

        .alert-error {
          background: rgba(220, 53, 69, 0.15);
          color: #ff6b6b;
          border-left-color: #ff6b6b;
        }

        .alert-success {
          background: rgba(40, 167, 69, 0.15);
          color: #51cf66;
          border-left-color: #51cf66;
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
          gap: 15px;
          padding: 15px;
        }

        .left-panel {
          flex: 0 0 350px;
          display: flex;
          flex-direction: column;
          background: rgba(26, 35, 50, 0.8);
          border: 1px solid rgba(0, 217, 255, 0.2);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 217, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid rgba(0, 217, 255, 0.2);
          background: rgba(0, 217, 255, 0.05);
        }

        .panel-header h2 {
          margin: 0;
          font-size: 16px;
          color: #00d9ff;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .count {
          background: linear-gradient(135deg, #00d9ff, #0099cc);
          color: #0f1419;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: bold;
          box-shadow: 0 0 10px rgba(0, 217, 255, 0.5);
        }

        .btn-refresh {
          padding: 8px 12px;
          background: rgba(0, 217, 255, 0.1);
          border: 1px solid #00d9ff;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          color: #00d9ff;
          transition: all 0.3s;
          font-weight: bold;
        }

        .btn-refresh:hover:not(:disabled) {
          background: rgba(0, 217, 255, 0.2);
          box-shadow: 0 0 15px rgba(0, 217, 255, 0.5);
        }

        .btn-refresh:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .expedient-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          scrollbar-color: rgba(0, 217, 255, 0.3) transparent;
          scrollbar-width: thin;
        }

        .expedient-list::-webkit-scrollbar {
          width: 8px;
        }

        .expedient-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .expedient-list::-webkit-scrollbar-thumb {
          background: rgba(0, 217, 255, 0.3);
          border-radius: 4px;
        }

        .expedient-list::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 217, 255, 0.6);
        }

        .loading-state,
        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #7a8fa6;
          text-align: center;
          font-size: 13px;
        }

        .expedient-item {
          padding: 12px;
          margin-bottom: 8px;
          background: rgba(0, 217, 255, 0.05);
          border: 2px solid rgba(0, 217, 255, 0.15);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .expedient-item:hover {
          background: rgba(0, 217, 255, 0.1);
          border-color: rgba(0, 217, 255, 0.4);
          box-shadow: 0 0 15px rgba(0, 217, 255, 0.2);
        }

        .expedient-item.selected {
          background: rgba(0, 217, 255, 0.15);
          border-color: #00d9ff;
          box-shadow: 0 0 20px rgba(0, 217, 255, 0.4);
        }

        .expedient-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .plate {
          font-weight: bold;
          font-family: 'OCR A', monospace;
          font-size: 14px;
          color: #00d9ff;
          letter-spacing: 1px;
        }

        .state-badge {
          font-size: 10px;
          padding: 4px 9px;
          border-radius: 3px;
          color: #0f1419;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .state-detected { background: #ffc107; box-shadow: 0 0 8px rgba(255, 193, 7, 0.5); }
        .state-under_review { background: #17a2b8; box-shadow: 0 0 8px rgba(23, 162, 184, 0.5); }
        .state-validated { background: #28a745; box-shadow: 0 0 8px rgba(40, 167, 69, 0.5); }
        .state-signed { background: #6610f2; box-shadow: 0 0 8px rgba(102, 16, 242, 0.5); }
        .state-exported { background: #20c997; box-shadow: 0 0 8px rgba(32, 201, 151, 0.5); }

        .expedient-details {
          font-size: 11px;
          color: #b0bec5;
        }

        .violation {
          margin: 3px 0;
          font-weight: 500;
          color: #ecf0f1;
        }

        .location {
          margin: 3px 0;
          color: #7a8fa6;
          font-size: 10px;
        }

        .time {
          margin: 5px 0 0 0;
          color: #546e7a;
          font-size: 10px;
        }

        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(26, 35, 50, 0.8);
          border: 1px solid rgba(0, 217, 255, 0.2);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 217, 255, 0.1);
          backdrop-filter: blur(10px);
        }

        .empty-selection {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #546e7a;
          font-size: 14px;
        }

        .expedient-workflow {
          flex: 1;
          overflow-y: auto;
          scrollbar-color: rgba(0, 217, 255, 0.3) transparent;
          scrollbar-width: thin;
        }

        .expedient-workflow::-webkit-scrollbar {
          width: 8px;
        }

        .expedient-workflow::-webkit-scrollbar-track {
          background: transparent;
        }

        .expedient-workflow::-webkit-scrollbar-thumb {
          background: rgba(0, 217, 255, 0.3);
          border-radius: 4px;
        }

        .expedient-workflow::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 217, 255, 0.6);
        }

        .export-section {
          padding: 16px;
          border-top: 1px solid rgba(0, 217, 255, 0.2);
          background: rgba(0, 217, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .btn-export {
          width: 100%;
          padding: 12px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-export:hover:not(:disabled) {
          background: #218838;
        }

        .btn-export:disabled {
          background: #ccc;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-preinforme {
          background: #17a2b8;
          font-size: 13px;
        }

        .btn-preinforme:hover:not(:disabled) {
          background: #138496;
        }

        .btn-excel {
          background: #27ae60;
          font-size: 13px;
        }

        .btn-excel:hover:not(:disabled) {
          background: #229954;
        }

        .export-help {
          margin-top: 5px;
          padding: 10px;
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          color: #1565c0;
          font-size: 12px;
          border-radius: 4px;
        }

        .export-help strong {
          font-weight: bold;
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
