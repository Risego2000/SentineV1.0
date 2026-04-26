/**
 * Expedient Workflow UI - TIER 1
 * React component for reviewing and managing expedients
 */

import React, { useState } from 'react';
import { Expedient } from '../domain/Expedient';
import { ExpedientStateMachine } from '../domain/ExpedientStateMachine';
import { SignatureService } from '../services/SignatureService';
import { getExpedientService } from '../services/ExpedientService';

interface ExpedientWorkflowProps {
  expedient: Expedient;
  onStateChange: (expedient: Expedient) => void;
  currentUser: { name: string; role: 'OPERATOR' | 'SUPERVISOR' | 'ADMIN' };
}

/**
 * Expedient Workflow Component
 */
export const ExpedientWorkflow: React.FC<ExpedientWorkflowProps> = ({
  expedient,
  onStateChange,
  currentUser,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleStartReview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = ExpedientStateMachine.transitionToUnderReview(expedient, currentUser.name);

      if (result.success) {
        // Guardar en Supabase
        const service = getExpedientService();
        await service.updateExpedient(expedient);
        setSuccess('Revisión iniciada');
        onStateChange(expedient);
      } else {
        setError(result.error || 'Error al iniciar revisión');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }

    setIsLoading(false);
  };

  const handleValidate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = ExpedientStateMachine.transitionToValidated(expedient, currentUser.name, {
        isValid: true,
        evidenceVerified: true,
        plateVerified: true,
        speedVerified: expedient.violationType === 'SPEED_VIOLATION',
      });

      if (result.success) {
        // Guardar en Supabase
        const service = getExpedientService();
        await service.updateExpedient(expedient);
        setSuccess('Expediente validado');
        onStateChange(expedient);
      } else {
        setError(result.error || 'Error al validar');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }

    setIsLoading(false);
  };

  const handleReject = async () => {
    if (!rejectionReason || rejectionReason.length < 10) {
      setError('Motivo de rechazo debe tener al menos 10 caracteres');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = ExpedientStateMachine.transitionToRejected(
        expedient,
        currentUser.name,
        rejectionReason
      );

      if (result.success) {
        // Guardar en Supabase
        const service = getExpedientService();
        await service.updateExpedient(expedient);
        setSuccess('Expediente rechazado');
        setShowRejectModal(false);
        setRejectionReason('');
        onStateChange(expedient);
      } else {
        setError(result.error || 'Error al rechazar');
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }

    setIsLoading(false);
  };

  const handleSign = async () => {
    if (currentUser.role !== 'SUPERVISOR') {
      setError('Solo supervisores pueden firmar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const signatureHash = await SignatureService.signExpedient(
        expedient,
        currentUser.name,
        { method: 'digital' }
      );

      const result = ExpedientStateMachine.transitionToSigned(
        expedient,
        currentUser.name,
        signatureHash
      );

      if (result.success) {
        // Guardar en Supabase
        const service = getExpedientService();
        await service.updateExpedient(expedient);
        setSuccess('Expediente firmado digitalmente');
        onStateChange(expedient);
      } else {
        setError(result.error || 'Error al firmar');
      }
    } catch (err) {
      setError(`Error de firma: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    setIsLoading(false);
  };

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = ExpedientStateMachine.transitionToExported(expedient, currentUser.name);

      if (result.success) {
        // Guardar en Supabase
        const service = getExpedientService();
        await service.updateExpedient(expedient);
        setSuccess('Reporte exportado');
        onStateChange(expedient);
        // Trigger PDF download
        // await generateAndDownloadPDF(expedient);
      } else {
        setError(result.error || 'Error al exportar');
      }
    } catch (err) {
      setError(`Error de exportación: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    setIsLoading(false);
  };

  const getStateLabel = () => {
    const labels: Record<string, string> = {
      DETECTED: 'Detectada',
      UNDER_REVIEW: 'Bajo revisión',
      VALIDATED: 'Validada',
      REJECTED: 'Rechazada',
      SIGNED: 'Firmada',
      EXPORTED: 'Exportada',
      ARCHIVED: 'Archivada',
    };
    return labels[expedient.state] || expedient.state;
  };

  const isModifiable = ExpedientStateMachine.isModifiable(expedient);

  return (
    <div className="expedient-workflow">
      {/* Header */}
      <div className="workflow-header">
        <h2>Expediente {expedient.id}</h2>
        <div className="state-badge" style={{ backgroundColor: getStateColor(expedient.state) }}>
          {getStateLabel()}
        </div>
      </div>

      {/* Información */}
      <div className="workflow-info">
        <div className="info-row">
          <span className="label">Placa:</span>
          <span className="value">{expedient.licensePlate}</span>
        </div>
        <div className="info-row">
          <span className="label">Tipo:</span>
          <span className="value">{expedient.violationType}</span>
        </div>
        <div className="info-row">
          <span className="label">Ubicación:</span>
          <span className="value">{expedient.location}</span>
        </div>
        <div className="info-row">
          <span className="label">Fotos:</span>
          <span className="value">{expedient.photosCount} capturadas</span>
        </div>
        <div className="info-row">
          <span className="label">Operador:</span>
          <span className="value">{expedient.operator || '—'}</span>
        </div>
      </div>

      {/* Multimedia Gallery - Imágenes y Vídeo */}
      {(expedient.photosCount > 0 || expedient.videoClipHash) && (
        <div className="workflow-media">
          <h3>📸 Evidencia Multimedia</h3>

          {/* Vídeo */}
          {expedient.videoClipHash && (
            <div className="media-item video-section">
              <h4>🎬 Vídeo de la Infracción</h4>
              <div className="video-placeholder">
                <p>Vídeo de {expedient.photosCount} fotogramas</p>
                <p className="hash-label">Hash SHA-256:</p>
                <code className="hash-value">{expedient.videoClipHash.substring(0, 32)}...</code>
                <p className="note">Almacenado en cadena de custodia</p>
              </div>
            </div>
          )}

          {/* Fotos */}
          {expedient.photosCount > 0 && (
            <div className="media-item photos-section">
              <h4>📷 Imágenes de la Infracción</h4>
              <div className="photos-grid">
                <div className="photo-placeholder">
                  <p>🖼️ Foto General 1</p>
                  <p className="caption">Evidencia ID: {expedient.evidenceId}</p>
                </div>
                {expedient.photosCount > 1 && (
                  <div className="photo-placeholder">
                    <p>🔍 Foto Detalle 1</p>
                    <p className="caption">Matrícula: {expedient.licensePlate}</p>
                  </div>
                )}
                {expedient.photosCount > 2 && (
                  <div className="photo-placeholder">
                    <p>📍 Foto Ubicación</p>
                    <p className="caption">Ubicación: {expedient.location}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alertas */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Botones de Acción */}
      <div className="workflow-actions">
        {expedient.state === 'DETECTED' && (
          <button
            onClick={handleStartReview}
            disabled={isLoading}
            className="btn btn-primary"
          >
            Iniciar Revisión
          </button>
        )}

        {expedient.state === 'UNDER_REVIEW' && isModifiable && (
          <>
            <button onClick={handleValidate} disabled={isLoading} className="btn btn-success">
              Validar
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isLoading}
              className="btn btn-danger"
            >
              Rechazar
            </button>
          </>
        )}

        {expedient.state === 'VALIDATED' && currentUser.role === 'SUPERVISOR' && (
          <button onClick={handleSign} disabled={isLoading} className="btn btn-primary">
            Firmar Digitalmente
          </button>
        )}

        {expedient.state === 'SIGNED' && (
          <button onClick={handleExport} disabled={isLoading} className="btn btn-primary">
            Exportar Reporte Oficial
          </button>
        )}
      </div>

      {/* Modal de Rechazo */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Rechazar Expediente</h3>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Motivo del rechazo (mínimo 10 caracteres)"
              rows={5}
              className="modal-textarea"
            />
            <div className="modal-actions">
              <button onClick={handleReject} disabled={isLoading} className="btn btn-danger">
                Confirmar Rechazo
              </button>
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isLoading}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      <div className="workflow-history">
        <h3>Historial de Transiciones</h3>
        <div className="history-list">
          {expedient.stateHistory.map((transition, idx) => (
            <div key={idx} className="history-item">
              <span className="timestamp">
                {new Date(transition.timestamp).toLocaleString()}
              </span>
              <span className="transition">
                {transition.from} → {transition.to}
              </span>
              <span className="actor">{transition.actor}</span>
              {transition.reason && <span className="reason">({transition.reason})</span>}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .expedient-workflow {
          padding: 20px;
          background: #f5f5f5;
          border-radius: 8px;
        }

        .workflow-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #ddd;
          padding-bottom: 10px;
        }

        .state-badge {
          color: white;
          padding: 5px 15px;
          border-radius: 20px;
          font-weight: bold;
        }

        .workflow-info {
          background: white;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }

        .info-row .label {
          font-weight: bold;
          color: #666;
        }

        .info-row .value {
          color: #333;
        }

        .alert {
          padding: 12px 15px;
          border-radius: 6px;
          margin-bottom: 15px;
          font-weight: 500;
        }

        .alert-error {
          background: #fee;
          color: #c00;
          border: 1px solid #fcc;
        }

        .alert-success {
          background: #efe;
          color: #0c0;
          border: 1px solid #cfc;
        }

        .workflow-actions {
          display: flex;
          gap: 10px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-success {
          background: #28a745;
          color: white;
        }

        .btn-success:hover:not(:disabled) {
          background: #218838;
        }

        .btn-danger {
          background: #dc3545;
          color: white;
        }

        .btn-danger:hover:not(:disabled) {
          background: #c82333;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 8px;
          max-width: 500px;
          width: 90%;
        }

        .modal-textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-family: Arial, sans-serif;
          resize: vertical;
          margin-bottom: 15px;
        }

        .modal-actions {
          display: flex;
          gap: 10px;
        }

        .workflow-history {
          background: white;
          padding: 15px;
          border-radius: 8px;
        }

        .history-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .history-item {
          padding: 10px;
          border-bottom: 1px solid #eee;
          font-size: 14px;
        }

        .history-item .timestamp {
          color: #999;
          margin-right: 10px;
        }

        .history-item .transition {
          font-weight: bold;
          color: #333;
          margin-right: 10px;
        }

        .history-item .actor {
          color: #666;
          margin-right: 10px;
        }

        .history-item .reason {
          color: #999;
          font-style: italic;
        }

        /* Multimedia Gallery Styles */
        .workflow-media {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 20px;
          border-left: 4px solid #17a2b8;
        }

        .workflow-media h3 {
          margin: 0 0 15px 0;
          font-size: 16px;
          color: #333;
        }

        .media-item {
          margin-bottom: 15px;
        }

        .media-item h4 {
          margin: 0 0 10px 0;
          font-size: 14px;
          color: #555;
        }

        .video-placeholder {
          background: #2c3e50;
          color: #ecf0f1;
          padding: 20px;
          border-radius: 6px;
          text-align: center;
          border: 2px dashed #34495e;
        }

        .video-placeholder p {
          margin: 8px 0;
          font-size: 14px;
        }

        .hash-label {
          font-weight: bold;
          margin-top: 12px;
          font-size: 12px;
        }

        .hash-value {
          display: block;
          background: #1a252f;
          padding: 8px;
          border-radius: 4px;
          margin: 8px 0;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          overflow-x: auto;
          word-break: break-all;
        }

        .note {
          font-size: 12px;
          color: #7f8c8d;
          margin-top: 10px;
        }

        .photos-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }

        .photo-placeholder {
          background: white;
          padding: 15px;
          border-radius: 6px;
          border: 2px solid #ddd;
          text-align: center;
          transition: all 0.2s;
        }

        .photo-placeholder:hover {
          border-color: #17a2b8;
          box-shadow: 0 2px 8px rgba(23, 162, 184, 0.1);
        }

        .photo-placeholder p {
          margin: 5px 0;
          font-size: 13px;
          font-weight: 500;
          color: #333;
        }

        .photo-placeholder .caption {
          font-size: 11px;
          color: #999;
          font-weight: normal;
          margin-top: 8px;
        }
      `}</style>
    </div>
  );
};

function getStateColor(state: string): string {
  const colors: Record<string, string> = {
    DETECTED: '#ffc107',
    UNDER_REVIEW: '#17a2b8',
    VALIDATED: '#28a745',
    REJECTED: '#dc3545',
    SIGNED: '#6610f2',
    EXPORTED: '#20c997',
    ARCHIVED: '#6c757d',
  };
  return colors[state] || '#6c757d';
}
