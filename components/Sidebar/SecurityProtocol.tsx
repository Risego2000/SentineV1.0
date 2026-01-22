import React from 'react';
import { Target, Mic, Sparkles } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const SecurityProtocol = () => {
    const { directives, setDirectives, isListening, setIsListening, generateGeometry } = useSentinel();

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <Target size={14} className="text-cyan-500" /> Protocolo de Seguridad
                </h3>
                <button
                    onClick={() => setIsListening(!isListening)}
                    className={`p-2 rounded-xl transition-all ${isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-slate-800 text-cyan-500 hover:bg-slate-700'
                        }`}
                >
                    <Mic size={14} />
                </button>
            </div>

            <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-4">
                <div className="relative group">
                    <textarea
                        value={directives}
                        onChange={(e) => setDirectives(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                generateGeometry(
                                    'ANÁLISIS DE REVISIÓN: Actualiza la geometría basada en las nuevas directivas del protocolo de seguridad.'
                                );
                            }
                        }}
                        className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-[11px] font-mono text-cyan-300 outline-none resize-none shadow-inner focus:border-cyan-500/50 transition-all uppercase"
                        placeholder="Ingrese directivas del sistema..."
                    />
                    <div className="absolute bottom-3 right-3 opacity-20 pointer-events-none font-mono text-[8px] text-cyan-500">
                        UTF-8_DIRECTIVE_STREAM
                    </div>
                </div>


            </div>
        </div>
    );
};
