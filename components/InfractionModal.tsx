import { X, Scale, FileDown, CheckCircle, Ban } from 'lucide-react';
import { InfractionLog } from '../types';
import { ReportService } from '../services/ReportService';
import { useSentinel } from '../hooks/useSentinel';
import { useHelp } from '../hooks/useHelp';

interface InfractionModalProps {
  log: InfractionLog;
  onClose: () => void;
}

export const InfractionModal = ({ log, onClose }: InfractionModalProps) => {
  const { validateInfraction } = useSentinel();
  const { helpProps } = useHelp();

  const generatePDF = async () => {
    await ReportService.downloadInfractionPdf(
      log,
      `ACTA_PERICIAL_${log.plate || 'SENT'}_${log.id.toString().slice(0, 8)}.pdf`
    );
  };

  const handleValidate = () => {
    validateInfraction(log.id, 'validated');
    onClose();
  };

  const handleReject = () => {
    validateInfraction(log.id, 'rejected');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121216] w-full max-w-5xl h-[90vh] rounded-lg border border-white/10 overflow-hidden flex flex-col shadow-2xl">
        {/* Header - Formal look */}
        <div className="px-8 py-6 border-b border-white/5 bg-white/[0.01] flex justify-between items-center">
          <div className="flex flex-col">
            <h2 className="text-xl font-bold text-white tracking-tight uppercase">
              Acta de Peritaje Judicial IA
            </h2>
            <p className="text-[10px] text-slate-500 font-medium tracking-[0.2em] uppercase mt-1">
              Sentinel Horizon Protocol • Forensic Unit
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-slate-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Column - Evidence Viewer */}
          <div className="flex-1 bg-black/40 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Evidencia Fotográfica Certificada
              </h3>
              {log.extraSnapshots && log.extraSnapshots.length >= 3 ? (
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { img: log.extraSnapshots[0], label: 'FOTOGRAMA 01 - ENTRADA EN ROI' },
                    { img: log.extraSnapshots[1], label: 'FOTOGRAMA 02 - POSICIÓN CRÍTICA' },
                    { img: log.extraSnapshots[2], label: 'FOTOGRAMA 03 - SALIDA / CONFIRMACIÓN' },
                  ].map((frame, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-video rounded-md overflow-hidden border border-white/5 bg-slate-900/40"
                    >
                      <img
                        src={`data:image/jpeg;base64,${frame.img}`}
                        className="w-full h-full object-contain"
                        alt={frame.label}
                      />
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2 py-1 border border-white/10 rounded">
                        <span className="text-[8px] font-bold text-white uppercase tracking-wider">
                          {frame.label}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="relative aspect-video rounded-md overflow-hidden border border-white/5 bg-black">
                  {log.videoClip ? (
                    <video
                      src={log.videoClip}
                      controls
                      autoPlay
                      loop
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img src={log.image} className="w-full h-full object-contain" />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Data & Actions */}
          <div className="w-[380px] border-l border-white/5 flex flex-col bg-[#0d0d0f]">
            <div className="p-8 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              {/* Status Section */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Estado
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${log.severity === 'CRITICAL' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}
                  >
                    {log.severity}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-white tracking-tight leading-snug uppercase">
                  {log.ruleCategory}
                </h4>
              </div>

              {/* Data Table */}
              <div className="space-y-4 border-t border-b border-white/5 py-6">
                <div className="grid grid-cols-2 gap-y-4 text-[11px]">
                  <span className="text-slate-500 font-medium">Placa / ID</span>
                  <span className="text-blue-500 font-bold text-right font-mono">
                    {log.plate || 'DESCONOCIDO'}
                  </span>

                  <span className="text-slate-500 font-medium">Marca/Modelo</span>
                  <span className="text-slate-300 font-bold text-right uppercase">
                    {log.makeModel || 'N/A'}
                  </span>

                  <span className="text-slate-500 font-medium">Timestamp Video</span>
                  <span className="text-slate-300 font-bold text-right font-mono">
                    {log.videoTimeCode || log.time}
                  </span>

                  <span className="text-slate-500 font-medium">Timestamp Local</span>
                  <span className="text-slate-300 font-bold text-right font-mono">
                    {log.localTime || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Legal Base */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Scale size={14} className="text-blue-500" /> Dictamen Forense
                </h5>
                <p className="text-xs text-slate-300 leading-relaxed italic bg-white/[0.02] p-4 rounded border border-white/5">
                  "{log.description}"
                </p>
                <div className="space-y-2 pt-2">
                  {log.reasoning?.map((r, i) => (
                    <div key={i} className="flex gap-3 text-[10px] text-slate-400">
                      <span className="text-blue-500 font-bold shrink-0">{i + 1}.</span>
                      <span className="leading-tight uppercase tracking-tight">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-8 border-t border-white/5 bg-white/[0.01] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleReject}
                  className="py-3 px-4 border border-white/10 rounded hover:bg-white/5 text-slate-400 text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                  {...helpProps('Rechazar esta infracción y eliminar del registro.')}
                >
                  <Ban size={14} /> Descartar
                </button>
                <button
                  onClick={handleValidate}
                  className="py-3 px-4 bg-blue-600 rounded hover:bg-blue-500 text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
                  {...helpProps('Validar infracción para procesamiento legal.')}
                >
                  <CheckCircle size={14} /> Validar
                </button>
              </div>
              <button
                onClick={generatePDF}
                className="w-full py-3 text-slate-500 hover:text-slate-300 text-[9px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all"
                {...helpProps('Descargar informe PDF certificado con evidencia fotográfica.')}
              >
                <FileDown size={14} /> Generar Expediente PDF Certificado
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
