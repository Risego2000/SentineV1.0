import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { uploadEvidenceFile, compressImage } from '../../services/evidenceStorageService';
import { detectVideoCodec } from '../../services/videoCodecDetector';

interface EvidenceUploadDialogProps {
  infractionId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EvidenceUploadDialog: React.FC<EvidenceUploadDialogProps> = ({
  infractionId,
  onClose,
  onSuccess,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showH265Warning, setShowH265Warning] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setError(null);
      setSuccess(false);
      setUploadProgress(0);

      const fileType = file.type.startsWith('video') ? 'video' : 'photo';

      // Check for H.265 codec in video files
      if (fileType === 'video') {
        const codec = await detectVideoCodec(file);
        if (codec === 'hevc') {
          setPendingFile(file);
          setShowH265Warning(true);
          return;
        }
      }

      setIsUploading(true);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 95));
      }, 500);

      const result = await uploadEvidenceFile(infractionId, file, fileType, file.name, true);

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleUploadAsIs = async () => {
    setShowH265Warning(false);
    if (!pendingFile) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileType = 'video';
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + Math.random() * 30, 95));
      }, 500);

      const result = await uploadEvidenceFile(
        infractionId,
        pendingFile,
        fileType,
        pendingFile.name,
        true
      );
      clearInterval(progressInterval);
      setUploadProgress(100);

      if (result) {
        setSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
      setPendingFile(null);
    }
  };

  // H.265 warning dialog
  if (showH265Warning && pendingFile) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#0d0d0f] border border-white/10 rounded-xl w-full max-w-md mx-4 p-6">
          <div className="flex items-start gap-4 mb-6">
            <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-1" size={24} />
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-2">Vídeo H.265 Detectado</h2>
              <p className="text-slate-400 text-sm">
                Este vídeo usa codec H.265 (HEVC). Sentinel intentará reproducirlo directamente sin
                pérdida de calidad. Si tu entorno no soporta HEVC, se usará fallback automático.
              </p>
              <p className="text-slate-500 text-xs mt-4 space-y-2">
                <div>
                  <strong>📤 Opción 1: Subir ahora</strong> (mantener flujo original)
                </div>
                <div className="ml-4 text-slate-600">
                  Se prioriza reproducción directa HEVC y puente WASM local
                </div>
                <div className="ml-4 text-slate-600">
                  Solo si falla, se activa transcodificación de respaldo
                </div>

                <div className="mt-2">
                  <strong>❌ Opción 2: Cancelar</strong> (convertir localmente)
                </div>
                <div className="ml-4 text-slate-600">
                  Si tienes una herramienta de conversión disponible, puede ser más rápido
                </div>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowH265Warning(false);
                setPendingFile(null);
              }}
              className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={handleUploadAsIs}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
            >
              Subir Archivo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0d0d0f] border border-white/10 rounded-xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Subir Evidencia</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Upload Area */}
        {!isUploading && !success ? (
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-white/20 hover:border-white/40 bg-white/5'
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mx-auto mb-3 text-slate-400" size={32} />
            <p className="text-white font-semibold mb-1">Arrastra archivos aquí</p>
            <p className="text-slate-500 text-sm">o haz clic para seleccionar</p>
            <p className="text-slate-600 text-xs mt-2">Fotos (máx 20MB) • Videos (máx 100MB)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileInputChange}
              className="hidden"
              disabled={isUploading}
            />
          </div>
        ) : null}

        {/* Uploading State */}
        {isUploading && !success ? (
          <div className="space-y-4">
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-slate-400 text-sm text-center">{Math.round(uploadProgress)}%</p>
          </div>
        ) : null}

        {/* Error State */}
        {error && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-red-500 font-semibold text-sm">Error</p>
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-green-500 font-semibold text-sm">¡Éxito!</p>
              <p className="text-green-400 text-xs">Archivo subido correctamente</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
