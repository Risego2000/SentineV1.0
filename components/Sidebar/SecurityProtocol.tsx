import React from 'react';
import { Target, Mic, Sparkles } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

interface SecurityProtocolProps {
    toggleListening: () => void;
}

export const SecurityProtocol = ({ toggleListening }: SecurityProtocolProps) => {
    const { directives, setDirectives, isListening, generateGeometry } = useSentinel();

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <Target size={14} className="text-cyan-500" /> Protocolo de Seguridad
                </h3>
                <button
                    onClick={toggleListening}
                    className={`p-2 rounded-xl transition-all ${isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-slate-800 text-cyan-500 hover:bg-slate-700'
                        }`}
                >
                    <Mic size={14} />
                </button>
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4 space-y-4">
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
                        className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-cyan-300 outline-none resize-none shadow-inner focus:border-cyan-500/50 transition-all"
                        placeholder="Ingrese directivas del sistema..."
                    />
                    <div className="absolute bottom-3 right-3 opacity-20 pointer-events-none font-mono text-[8px] text-cyan-500">
                        UTF-8_DIRECTIVE_STREAM
                    </div>
                </div>

                <button
                    onClick={() =>
                        generateGeometry(
                            'ANÁLISIS EXHAUSTIVO: Detecta TODAS las marcas viales y señalización. IMPORTANTE: Genera directivas de seguridad en ESPAÑOL.'
                        )
                    }
                    className="w-full py-4 bg-cyan-500/5 border border-cyan-500/20 text-cyan-400 rounded-2xl font-black text-[11px] uppercase hover:bg-cyan-500/15 hover:border-cyan-500/40 transition-all flex items-center justify-center gap-3 group shadow-[0_0_20px_rgba(34,211,238,0.05)]"
                >
                    <Sparkles
                        size={16}
                        className="group-hover:rotate-12 transition-transform text-cyan-500"
                    />
                    <span className="tracking-[0.15em]">Detección de Vía</span>
                </button>
            </div>
        </div>
    );
};
