import React, { useEffect, useState } from 'react';
import { Trash2, Download, Play, AlertCircle, Upload } from 'lucide-react';
import {
  getEvidenceFiles,
  deleteEvidenceFile,
  getPublicUrl,
} from '../../services/evidenceStorageService';
import type { EvidenceFile } from '../../services/evidenceStorageService';
import { EvidenceUploadDialog } from './EvidenceUploadDialog';

interface EvidenceGalleryProps {
  infractionId: string;
}

export const EvidenceGallery: React.FC<EvidenceGalleryProps> = ({ infractionId }) => {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    loadEvidenceFiles();
  }, [infractionId]);

  const loadEvidenceFiles = async () => {
    try {
      setLoading(true);
      setError(null);
      const evidenceFiles = await getEvidenceFiles(infractionId);
      setFiles(evidenceFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading files');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('¿Eliminar este archivo?')) return;

    try {
      setDeletingId(fileId);
      const success = await deleteEvidenceFile(fileId);
      if (success) {
        setFiles(files.filter((f) => f.id !== fileId));
      } else {
        setError('Error al eliminar el archivo');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (filePath: string, fileName: string) => {
    const url = getPublicUrl(filePath);
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Cargando archivos...</div>
      </div>
    );
  }

  const photos = files.filter((f) => f.file_type === 'photo');
  const videos = files.filter((f) => f.file_type === 'video');

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4 overflow-y-auto custom-scrollbar">
        {/* Upload Button */}
        <button
          onClick={() => setShowUploadDialog(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Upload size={16} />
          <span className="text-sm font-semibold">Subir Archivos</span>
        </button>

        {/* Error Message */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500">
            <AlertCircle size={32} className="mb-2 opacity-50" />
            <p className="text-sm">Sin archivos de evidencia</p>
          </div>
        ) : null}

        {/* Photos Section */}
        {photos.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Fotos ({photos.length})</h3>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-white/10 hover:border-white/20 transition-all"
                >
                  <img
                    src={getPublicUrl(photo.file_path)}
                    alt={photo.file_name}
                    className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => setSelectedImage(getPublicUrl(photo.file_path))}
                  />
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleDownload(photo.file_path, photo.file_name)}
                      className="p-1.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors"
                      title="Descargar"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(photo.id)}
                      disabled={deletingId === photo.id}
                      className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Videos Section */}
        {videos.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase">Videos ({videos.length})</h3>
            <div className="space-y-2">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="group flex items-center gap-2 p-2 bg-slate-900 rounded-lg border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="relative w-12 h-12 bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                    <Play size={20} className="text-slate-500" fill="currentColor" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{video.file_name}</p>
                    <p className="text-xs text-slate-500">
                      {(video.file_size / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(video.file_path, video.file_name)}
                      className="p-1.5 bg-white/20 hover:bg-white/30 rounded text-white transition-colors"
                      title="Descargar"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(video.id)}
                      disabled={deletingId === video.id}
                      className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 transition-colors disabled:opacity-50"
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded text-white"
          >
            ✕
          </button>
          <img
            src={selectedImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain"
          />
        </div>
      )}

      {/* Upload Dialog */}
      {showUploadDialog && (
        <EvidenceUploadDialog
          infractionId={infractionId}
          onClose={() => setShowUploadDialog(false)}
          onSuccess={loadEvidenceFiles}
        />
      )}
    </>
  );
};
