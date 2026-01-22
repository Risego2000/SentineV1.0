import { useRef } from 'react';
import { X, Scale, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { InfractionLog } from '../types';

interface InfractionModalProps {
    log: InfractionLog;
    onClose: () => void;
}

export const InfractionModal = ({ log, onClose }: InfractionModalProps) => {
    const generatePDF = () => {
        const doc = new jsPDF();

        // Header Táctico
        doc.setFillColor(10, 10, 10);
        doc.rect(0, 0, 210, 300, 'F'); // Fondo Oscuro (simulado, pero mejor blanco para imprimir)
        // Reset a blanco para impresión real
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 210, 300, 'F');

        // Encabezado
        doc.setFontSize(18);
        doc.setTextColor(0, 0, 0);
        doc.text("SENTINEL AI - INFORME FORENSE", 20, 20);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`ID EXPEDIENTE: ${log.id}`, 20, 30);
        doc.text(`FECHA: ${new Date().toLocaleString()}`, 20, 35);

        // Imagen Evidencia
        try {
            if (log.image) {
                // Asumiendo base64 jpeg
                const imgProps = doc.getImageProperties(`data:image/jpeg;base64,${log.image}`);
                const ratio = imgProps.width / imgProps.height;
                const width = 170;
                const height = width / ratio;
                doc.addImage(`data:image/jpeg;base64,${log.image}`, 'JPEG', 20, 45, width, height);

                // Detalles debajo de imagen
                let y = 45 + height + 10;

                doc.setDrawColor(200, 0, 0);
                doc.setLineWidth(1);
                doc.line(20, y, 190, y);
                y += 10;

                doc.setFontSize(14);
                doc.setTextColor(200, 0, 0);
                doc.text(`INFRACCIÓN: ${log.ruleCategory}`, 20, y);
                y += 10;

                doc.setFontSize(12);
                doc.setTextColor(0, 0, 0);
                doc.text(`VEHÍCULO: ${log.plate || 'DESCONOCIDO'}`, 20, y);
                doc.text(`SEVERIDAD: ${log.severity}`, 100, y);
                y += 15;

                doc.setFontSize(10);
                doc.setTextColor(50, 50, 50);
                doc.text("ANÁLISIS TÁCTICO DE LA IA:", 20, y);
                y += 7;

                const splitDesc = doc.splitTextToSize(log.description, 170);
                doc.text(splitDesc, 20, y);
                y += (splitDesc.length * 5) + 5;

                if (log.reasoning) {
                    doc.text("EVIDENCIA TÉCNICA:", 20, y);
                    y += 7;
                    log.reasoning.forEach(r => {
                        const splitR = doc.splitTextToSize(`- ${r}`, 160);
                        doc.text(splitR, 25, y);
                        y += (splitR.length * 5);
                    });
                }

                doc.save(`expediente_sentinel_${log.id}.pdf`);
            }
        } catch (e) {
            console.error("Error al generar PDF", e);
            alert("Error generando el documento PDF. Verifica el formato de imagen.");
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-[#050914] w-full max-w-5xl h-[85vh] rounded-[40px] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
                <div className="flex-1 flex flex-col lg:flex-row">
                    <div className="flex-1 relative bg-black flex items-center justify-center">
                        {log.videoClip ? (
                            <video
                                src={log.videoClip}
                                controls
                                autoPlay
                                loop
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <img src={log.image} className="w-full h-full object-cover" />
                        )}
                    </div>
                    <div className="w-full lg:w-[450px] p-10 flex flex-col bg-slate-950/50 border-l border-white/5 overflow-y-auto">
                        <button onClick={onClose} className="self-end p-2 text-slate-500 hover:text-white mb-4"><X size={24} /></button>
                        <div className="space-y-8">
                            <div><span className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2 block">Captura Forense</span><h2 className="text-4xl font-black text-white italic tracking-tighter">{log.ruleCategory}</h2></div>
                            <div className="bg-black/60 p-6 rounded-3xl border border-white/5 space-y-4">
                                <div className="flex justify-between items-center pb-4 border-b border-white/5"><span className="text-[10px] font-black text-slate-500 uppercase">Vehículo</span><span className="text-2xl font-mono font-black text-cyan-400">{log.plate || 'SENT-IA'}</span></div>
                                <div className="flex justify-between items-center pb-4 border-b border-white/5"><span className="text-[10px] font-black text-slate-500 uppercase">Cronomarca Video</span><span className="text-xl font-mono font-bold text-amber-500">{log.visualTimestamp || '--:--:--'}</span></div>
                                <div className="flex justify-between"><span className="text-[10px] font-black text-slate-500 uppercase">Gravedad</span><span className="text-xl font-black text-red-600 uppercase italic">{log.severity}</span></div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Scale size={16} className="text-cyan-500" /> Fundamento Legal</h3>
                                <p className="text-sm text-slate-300 leading-relaxed italic uppercase">"{log.description}"</p>
                                <div className="p-4 bg-cyan-900/10 border border-cyan-500/20 rounded-2xl space-y-3">
                                    {log.reasoning?.map((r, i) => (<div key={i} className="flex gap-3 text-[11px] font-mono text-cyan-200 uppercase"><div className="w-4 h-4 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">{i + 1}</div><span>{r}</span></div>))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={generatePDF}
                                    className="w-full py-5 bg-slate-800 text-white rounded-[25px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-700 active:scale-95 text-[10px] flex items-center justify-center gap-2"
                                >
                                    <FileDown size={16} /> Expt. Digital
                                </button>
                                <button onClick={onClose} className="w-full py-5 bg-red-600 text-white rounded-[25px] font-black uppercase tracking-widest shadow-2xl hover:bg-red-500 active:scale-95 text-[10px]">
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
