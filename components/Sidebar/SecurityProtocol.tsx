import React, { useMemo } from 'react';
import { Target, Mic, AlertOctagon, AlertTriangle, Info, Terminal } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

type RuleType = 'CRITICAL' | 'WARNING' | 'INFO';

interface ParsedRule {
    id: number;
    type: RuleType;
    content: string;
}

export const SecurityProtocol = () => {
    const { directives, setDirectives, isListening, setIsListening, generateGeometry } = useSentinel();

    // Parseo inteligente de directivas para visualización
    const parsedRules: ParsedRule[] = useMemo(() => {
        if (!directives) return [];
        return directives.split('\n')
            .filter(line => line.trim().length > 3)
            .map((line, index) => {
                const upper = line.toUpperCase();
                let type: RuleType = 'INFO';
                if (upper.includes('PROHIBIDO') || upper.includes('CRÍTICO') || upper.includes('STOP') || upper.includes('INFRACCIÓN')) type = 'CRITICAL';
                else if (upper.includes('ADVERTENCIA') || upper.includes('PRECAUCIÓN') || upper.includes('CEDA') || upper.includes('LÍMITE')) type = 'WARNING';

                return { id: index, type, content: line.replace(/^-\s*/, '').trim() };
            });
    }, [directives]);

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

                {/* Editor Táctico */}
                <div className="relative group">
                    <div className="absolute top-2 right-3 text-[10px] text-slate-600 font-mono pointer-events-none flex items-center gap-1">
                        <Terminal size={10} /> EDIT_MODE
                    </div>
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
                        className="w-full h-24 bg-black/60 border border-white/10 rounded-xl p-3 text-[11px] font-mono text-slate-300 outline-none resize-none shadow-inner focus:border-cyan-500/50 transition-all uppercase custom-scrollbar placeholder:text-slate-700 leading-tight"
                        placeholder="> CLASIFICANDO DIRECTIVAS..."
                    />
                </div>

                {/* Visualizador de Reglas (Cards) */}
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {parsedRules.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-white/5 rounded-xl bg-black/20">
                            <span className="text-[9px] text-slate-600 uppercase font-black tracking-widest animate-pulse">
                                [ SISTEMA MONITORIZANDO SIN RESTRICCIONES ]
                            </span>
                        </div>
                    ) : (
                        parsedRules.map(rule => (
                            <div
                                key={rule.id}
                                className={`p-4 rounded-xl border-2 flex items-start gap-4 transition-all hover:scale-[1.02] duration-300 ${rule.type === 'CRITICAL'
                                        ? 'bg-[#0f0505]/95 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                                        : rule.type === 'WARNING'
                                            ? 'bg-[#0f0a05]/95 border-amber-500/40'
                                            : 'bg-[#050a0f]/95 border-cyan-500/30'
                                    }`}
                            >
                                <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 ${rule.type === 'CRITICAL' ? 'text-red-500 border-red-500/40 bg-red-500/5' :
                                        rule.type === 'WARNING' ? 'text-amber-500 border-amber-500/40 bg-amber-500/5' :
                                            'text-cyan-500 border-cyan-500/40 bg-cyan-500/5'
                                    }`}>
                                    {rule.type === 'CRITICAL' ? <AlertOctagon size={18} strokeWidth={2.5} /> :
                                        rule.type === 'WARNING' ? <AlertTriangle size={18} strokeWidth={2.5} /> :
                                            <Info size={18} strokeWidth={2.5} />}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${rule.type === 'CRITICAL' ? 'text-red-500/90' :
                                            rule.type === 'WARNING' ? 'text-amber-500/90' :
                                                'text-cyan-500/90'
                                        }`}>
                                        {rule.type === 'CRITICAL' ? 'PROHIBICIÓN ESTRICTA' :
                                            rule.type === 'WARNING' ? 'PRECAUCIÓN OPERATIVA' :
                                                'DIRECTIVA DE SISTEMA'}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-200 uppercase leading-[1.4] tracking-tight">
                                        {rule.content}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

            </div>
        </div>
    );
};
