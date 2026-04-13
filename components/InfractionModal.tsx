import { X, Scale, FileDown } from 'lucide-react';
import { InfractionLog } from '../types';
import { ReportService } from '../services/ReportService';

interface InfractionModalProps {
  log: InfractionLog;
  onClose: () => void;
}

export const InfractionModal = ({ log, onClose }: InfractionModalProps) => {
  const generatePDF = async () => {
    await ReportService.downloadInfractionPdf(
      log,
      `Expediente_Digital_${log.plate || 'SENT'}_${log.id.toString().slice(0, 8)}.pdf`
    );
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="bg-[#050914] w-full max-w-6xl h-[90vh] rounded-[40px] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          <div className="flex-[1.8] bg-[#02040a] flex flex-col p-4 gap-4 overflow-hidden min-h-0">
            {log.extraSnapshots && log.extraSnapshots.length >= 3 ? (
              <div className="flex flex-col h-full gap-4 justify-center">
                {[
                  { img: log.extraSnapshots[0], label: '01 FOTOGRAMA INICIAL (ROI A)' },
                  { img: log.extraSnapshots[1], label: '02 FOTOGRAMA INTERMEDIO' },
                  { img: log.extraSnapshots[2], label: '03 FOTOGRAMA FINAL (ROI B)' },
                ].map((frame, idx) => (
                  <div
                    key={idx}
                    className="flex-1 relative group rounded-2xl overflow-hidden border border-white/10 shadow-inner bg-slate-900/40 min-h-0"
                  >
                    <img
                      src={`data:image/jpeg;base64,${frame.img}`}
                      className="w-full h-full object-contain brightness-[0.95] group-hover:brightness-110 transition-all duration-700"
                      alt={frame.label}
                    />
                    <div className="absolute top-4 left-4">
                      <span className="text-[10px] font-black text-white px-3 py-1.5 rounded-lg bg-red-600/90 backdrop-blur-md uppercase tracking-widest shadow-lg border border-white/20">
                        {frame.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                {log.videoClip ? (
                  <video
                    src={log.videoClip}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img src={log.image} className="w-full h-full object-contain bg-black/40" />
                )}
              </div>
            )}
          </div>
          <div className="w-full lg:w-[420px] p-6 flex flex-col bg-slate-950/20 border-l border-white/5 overflow-y-auto custom-scrollbar">
            <button onClick={onClose} className="self-end p-2 text-slate-500 hover:text-white mb-2">
              <X size={20} />
            </button>
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1 block">
                  Captura Forense
                </span>
                <h2 className="text-3xl font-black text-white italic tracking-tighter truncate">
                  {log.ruleCategory}
                </h2>
              </div>
              <div className="bg-black/40 p-5 rounded-3xl border border-white/5 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Vehículo</span>
                  <span className="text-xl font-mono font-black text-cyan-400">
                    {log.plate || 'SENT-IA'}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-[10px] font-black text-slate-500 uppercase">
                    Tiempo Video (OSD)
                  </span>
                  <span className="text-base font-mono font-bold text-amber-500">
                    {log.videoTimeCode || log.time}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-[10px] font-black text-slate-500 uppercase">
                    Tiempo Local
                  </span>
                  <span className="text-base font-mono font-bold text-slate-300">
                    {log.localTime || new Date().toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Gravedad</span>
                  <span className="text-lg font-black text-red-600 uppercase italic">
                    {log.severity}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Scale size={14} className="text-cyan-500" /> Fundamento Legal
                </h3>
                <p className="text-[12px] text-slate-300 leading-relaxed italic uppercase border-l-2 border-cyan-500/30 pl-3 py-1">
                  "{log.description}"
                </p>
                <div className="p-3 bg-cyan-900/5 border border-cyan-500/10 rounded-2xl space-y-2">
                  {log.reasoning?.map((r, i) => (
                    <div
                      key={i}
                      className="flex gap-3 text-[10px] font-mono text-cyan-200 uppercase"
                    >
                      <div className="w-3.5 h-3.5 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <span className="leading-tight">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={generatePDF}
                  className="w-full py-5 bg-slate-800 text-white rounded-[25px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-700 active:scale-95 text-xs flex items-center justify-center gap-2"
                >
                  <FileDown size={16} /> Expt. Digital
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-5 bg-red-600 text-white rounded-[25px] font-black uppercase tracking-widest shadow-2xl hover:bg-red-500 active:scale-95 text-xs"
                >
                  Confirmar Sanción
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
