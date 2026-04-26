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
      {/* Animated Background */}
      <div className="absolute inset-0 hud-grid opacity-20 pointer-events-none" />
      <div className="scanline" />
      <div className="shield-glow-bg" />

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
              <div style={{ position: 'absolute', width: 280, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid rgba(59, 130, 246, 0.2)', animation: 'spin 3s linear infinite' }} />
                <img src="/ESCUDO.png?v=11" alt="Sentinel Logo" style={{ width: '65%', height: '65%', objectFit: 'contain', filter: 'drop-shadow(0 0 25px rgba(59, 130, 246, 0.8)) drop-shadow(0 0 50px rgba(34, 211, 238, 0.6))', animation: 'pulse-glow 4s ease-in-out infinite', zIndex: 5 }} />
              </div>
              <p className="empty-text">Selecciona un expediente para revisar</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* DARK THEME - Unified with SENTINEL.AI Detection Screen Design */
        .expedient-list-page {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #01030d;
          font-family: 'Share Tech Mono', 'Courier New', monospace;
          color: #ecf0f1;
          overflow: hidden;
        }

        .page-header {
          position: relative;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .page-header h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 900;
          color: #00d9ff;
          text-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 11px;
          color: #94a3b8;
          font-family: monospace;
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
          flex: 0 0 320px;
          display: flex;
          flex-direction: column;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
        }

        .left-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%);
          pointer-events: none;
          border-radius: 6px;
        }

        .panel-header {
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(59, 130, 246, 0.05);
        }

        .panel-header h2 {
          margin: 0;
          font-size: 12px;
          font-weight: 900;
          color: #3b82f6;
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .count {
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #3b82f6;
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 700;
          box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);
        }

        .btn-refresh {
          padding: 6px 10px;
          background: rgba(59, 130, 246, 0.1);
          border: 1px solid rgba(59, 130, 246, 0.3);
          border-radius: 3px;
          cursor: pointer;
          font-size: 10px;
          color: #3b82f6;
          transition: all 0.2s;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn-refresh:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.2);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
          border-color: rgba(59, 130, 246, 0.5);
        }

        .btn-refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .expedient-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          scrollbar-color: rgba(59, 130, 246, 0.3) transparent;
          scrollbar-width: thin;
        }

        .expedient-list::-webkit-scrollbar {
          width: 6px;
        }

        .expedient-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .expedient-list::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.2);
          border-radius: 3px;
        }

        .expedient-list::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.4);
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
          padding: 10px;
          margin-bottom: 6px;
          background: rgba(59, 130, 246, 0.05);
          border: 1px solid rgba(59, 130, 246, 0.15);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.25s ease-out;
          position: relative;
          overflow: hidden;
        }

        .expedient-item::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.25s;
        }

        .expedient-item:hover {
          background: rgba(59, 130, 246, 0.1);
          border-color: rgba(59, 130, 246, 0.3);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.15);
        }

        .expedient-item:hover::before {
          opacity: 1;
        }

        .expedient-item.selected {
          background: rgba(59, 130, 246, 0.15);
          border-color: rgba(59, 130, 246, 0.5);
          box-shadow: 0 0 16px rgba(59, 130, 246, 0.3);
        }

        .expedient-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          position: relative;
          z-index: 1;
        }

        .plate {
          font-weight: 900;
          font-family: 'OCR A', monospace;
          font-size: 12px;
          color: #3b82f6;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .state-badge {
          font-size: 9px;
          padding: 3px 7px;
          border-radius: 2px;
          color: white;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
        }

        .state-detected { background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); }
        .state-under_review { background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%); }
        .state-validated { background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%); }
        .state-signed { background: linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%); }
        .state-exported { background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%); }

        .expedient-details {
          font-size: 10px;
          color: #94a3b8;
          position: relative;
          z-index: 1;
        }

        .violation {
          margin: 2px 0;
          font-weight: 600;
          color: #e2e8f0;
        }

        .location {
          margin: 2px 0;
          color: #64748b;
          font-size: 9px;
        }

        .time {
          margin: 4px 0 0 0;
          color: #475569;
          font-size: 9px;
        }

        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          backdrop-filter: blur(10px);
        }

        .right-panel::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%);
          pointer-events: none;
          border-radius: 6px;
        }

        .empty-selection {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #64748b;
          font-size: 12px;
          letter-spacing: 0.05em;
          position: relative;
          gap: 32px;
        }

        .empty-selection::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 240px;
          height: 240px;
          background: url('/ESCUDO.png?v=11') center/contain no-repeat;
          filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.6)) drop-shadow(0 0 30px rgba(34, 211, 238, 0.4));
          animation: escudo-glow-pulse 4s ease-in-out infinite;
          z-index: 5;
        }

        .empty-selection::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          height: 300px;
          border: 2px solid rgba(59, 130, 246, 0.2);
          border-radius: 50%;
          animation: escudo-ring-outer 3s linear infinite;
          z-index: 2;
          pointer-events: none;
        }

        .empty-selection .empty-text {
          position: relative;
          z-index: 10;
          margin: 0;
          text-align: center;
        }

        @keyframes escudo-ring-outer {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes escudo-glow-pulse {
          0%, 100% {
            opacity: 0.9;
            filter: drop-shadow(0 0 15px rgba(59, 130, 246, 0.6)) drop-shadow(0 0 30px rgba(34, 211, 238, 0.4));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 25px rgba(59, 130, 246, 0.9)) drop-shadow(0 0 50px rgba(34, 211, 238, 0.6));
          }
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
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          background: rgba(59, 130, 246, 0.05);
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0;
        }

        .btn-export {
          width: 100%;
          padding: 10px;
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.4);
          color: #86efac;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 700;
          font-size: 11px;
          transition: all 0.2s;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .btn-export:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.3);
          border-color: rgba(34, 197, 94, 0.6);
          box-shadow: 0 0 12px rgba(34, 197, 94, 0.2);
        }

        .btn-export:disabled {
          background: rgba(100, 116, 139, 0.1);
          border-color: rgba(100, 116, 139, 0.2);
          color: #94a3b8;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .btn-preinforme {
          background: rgba(34, 211, 238, 0.2);
          border-color: rgba(34, 211, 238, 0.4);
          color: #a5f3fc;
        }

        .btn-preinforme:hover:not(:disabled) {
          background: rgba(34, 211, 238, 0.3);
          border-color: rgba(34, 211, 238, 0.6);
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.2);
        }

        .btn-excel {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
          color: #93c5fd;
        }

        .btn-excel:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.3);
          border-color: rgba(59, 130, 246, 0.6);
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.2);
        }

        .export-help {
          margin-top: 8px;
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

        @media (max-width: 1024px) {
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
