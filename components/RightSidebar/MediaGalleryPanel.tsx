import React, { useEffect, useState } from 'react';
import { ChevronDown, Trash2, Download, Play, AlertCircle, Loader } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { getPublicUrl, deleteEvidenceFile } from '../../services/evidenceStorageService';
import type { EvidenceFile } from '../../services/evidenceStorageService';

interface InfractionWithFiles {
  id: string;
  plate: string;
  description: string;
  severity: string;
  files: EvidenceFile[];
}

export const MediaGalleryPanel: React.FC = () => {
  const [infractions, setInfractions] = useState<InfractionWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadGalleryData();
  }, []);

  const loadGalleryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch infractions
      const { data: infractionData, error: infractionError } = await supabase
        .from('infractions')
        .select('id, plate, description, severity')
        .order('created_at', { ascending: false });

      if (infractionError) throw infractionError;

      // Fetch evidence files for each infraction
      const { data: filesData, error: filesError } = await supabase
        .from('evidence_files')
        .select('*')
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      // Group files by infraction
      const infractionMap = new Map<string, InfractionWithFiles>();

      infractionData?.forEach((inf) => {
        infractionMap.set(inf.id, {
          id: inf.id,
          plate: inf.plate || 'Desconocido',
          description: inf.description || '',
          severity: inf.severity || 'MEDIO',
          files: [],
        });
      });

      filesData?.forEach((file) => {
        const inf = infractionMap.get(file.infraction_id);
        if (inf) {
          inf.files.push(file);
        }
      });

      // Filter only infractions with files
      const infsWithFiles = Array.from(infractionMap.values()).filter((i) => i.files.length > 0);
      setInfractions(infsWithFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando galería');
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
        await loadGalleryData();
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
      <div className="flex-1 flex items-center justify-center">
        <Loader className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 space-y-2 overflow-y-auto custom-scrollbar">
      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {infractions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <AlertCircle size={32} className="mb-2 opacity-50" />
          <p className="text-sm">Sin archivos de evidencia</p>
        </div>
      ) : null}

      {/* Infractions Accordion */}
      {infractions.map((infraction) => (
        <div key={infraction.id} className="border border-white/10 rounded-lg overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setExpandedId(expandedId === infraction.id ? null : infraction.id)}
            className="w-full px-4 py-3 bg-slate-900/50 hover:bg-slate-900 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <ChevronDown
                size={18}
                className={`flex-shrink-0 transition-transform ${
                  expandedId === infraction.id ? 'rotate-180' : ''
                }`}
              />
              <div className="text-left min-w-0 flex-1">
                <p className="text-xs font-bold text-white truncate">{infraction.plate}</p>
                <p className="text-[10px] text-slate-400 truncate">{infraction.description}</p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 flex-shrink-0 bg-slate-800 px-2 py-1 rounded">
                {infraction.files.length}
              </span>
            </div>
          </button>

          {/* Content */}
          {expandedId === infraction.id && (
            <div className="p-4 bg-black/40 space-y-3 border-t border-white/5">
              {/* Photos Section */}
              {infraction.files.filter((f) => f.file_type === 'photo').length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Fotos</p>
                  <div className="grid grid-cols-3 gap-2">
                    {infraction.files
                      .filter((f) => f.file_type === 'photo')
                      .map((file) => (
                        <div
                          key={file.id}
                          className="group relative aspect-square bg-slate-900 rounded overflow-hidden border border-white/10 hover:border-white/20"
                        >
                          <img
                            src={getPublicUrl(file.file_path)}
                            alt={file.file_name}
                            className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform"
                            onClick={() => setSelectedImage(getPublicUrl(file.file_path))}
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleDownload(file.file_path, file.file_name)}
                              className="p-1.5 bg-white/20 hover:bg-white/30 rounded text-white"
                            >
                              <Download size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(file.id)}
                              disabled={deletingId === file.id}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Videos Section */}
              {infraction.files.filter((f) => f.file_type === 'video').length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Videos</p>
                  <div className="space-y-2">
                    {infraction.files
                      .filter((f) => f.file_type === 'video')
                      .map((file) => (
                        <div
                          key={file.id}
                          className="group flex items-center gap-2 p-2 bg-slate-900/50 rounded border border-white/10 hover:border-white/20"
                        >
                          <div className="relative w-10 h-10 bg-slate-800 rounded flex-shrink-0 flex items-center justify-center">
                            <Play size={16} className="text-slate-500" fill="currentColor" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-semibold text-white truncate">
                              {file.file_name}
                            </p>
                            <p className="text-[9px] text-slate-500">
                              {(file.file_size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleDownload(file.file_path, file.file_name)}
                              className="p-1.5 bg-white/20 hover:bg-white/30 rounded text-white"
                            >
                              <Download size={12} />
                            </button>
                            <button
                              onClick={() => handleDelete(file.id)}
                              disabled={deletingId === file.id}
                              className="p-1.5 bg-red-500/20 hover:bg-red-500/30 rounded text-red-400 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

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
    </div>
  );
};
