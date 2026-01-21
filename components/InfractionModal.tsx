import { useRef } from 'react';
import { X, Scale } from 'lucide-react';
import { InfractionLog } from '../types';

interface InfractionModalProps {
    log: InfractionLog;
    onClose: () => void;
}

export const InfractionModal = ({ log, onClose }: InfractionModalProps) => {
    return (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-6 backdrop-blur-2xl animate-in fade-in duration-300">
            <div className="bg-[#050914] w-full max-w-5xl h-[85vh] rounded-[40px] border border-white/10 overflow-hidden flex flex-col shadow-2xl">
                <div className="flex-1 flex flex-col lg:flex-row">
                    <div className="flex-1 relative bg-black flex items-center justify-center"><img src={log.image} className="w-full h-full object-cover" /></div>
                    <div className="w-full lg:w-[450px] p-10 flex flex-col bg-slate-950/50 border-l border-white/5 overflow-y-auto">
                        <button onClick={onClose} className="self-end p-2 text-slate-500 hover:text-white mb-4"><X size={24} /></button>
                        <div className="space-y-8">
                            <div><span className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-2 block">Captura Forense</span><h2 className="text-4xl font-black text-white italic tracking-tighter">{log.ruleCategory}</h2></div>
                            <div className="bg-black/60 p-6 rounded-3xl border border-white/5 space-y-4">
                                <div className="flex justify-between items-center pb-4 border-b border-white/5"><span className="text-[10px] font-black text-slate-500 uppercase">Vehículo</span><span className="text-2xl font-mono font-black text-cyan-400">{log.plate || 'SENT-IA'}</span></div>
                                <div className="flex justify-between items-center pb-4 border-b border-white/5"><span className="text-[10px] font-black text-slate-500 uppercase">Velocidad</span><span className="text-xl font-mono font-black text-emerald-400">{log.telemetry?.speedEstimated || 'CALCULANDO...'}</span></div>
                                <div className="flex justify-between"><span className="text-[10px] font-black text-slate-500 uppercase">Gravedad</span><span className="text-xl font-black text-red-600 uppercase italic">{log.severity}</span></div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Scale size={16} className="text-cyan-500" /> Fundamento Legal</h3>
                                <p className="text-sm text-slate-300 leading-relaxed italic">"{log.description}"</p>
                                <div className="p-4 bg-cyan-900/10 border border-cyan-500/20 rounded-2xl space-y-3">
                                    {log.reasoning?.map((r, i) => (<div key={i} className="flex gap-3 text-[11px] font-mono text-cyan-200"><div className="w-4 h-4 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">{i + 1}</div><span>{r}</span></div>))}
                                </div>
                            </div>
                            <button onClick={onClose} className="w-full py-5 bg-red-600 text-white rounded-[25px] font-black uppercase tracking-widest shadow-2xl hover:bg-red-500 active:scale-95">Confirmar Sanción</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
