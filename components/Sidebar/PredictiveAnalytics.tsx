import React, { useState, useEffect } from 'react';
import { Activity, Zap, TrendingUp, AlertOctagon } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';

export const PredictiveAnalytics = () => {
    const { stats, tracks } = useSentinel();
    const [congestionLevel, setCongestionLevel] = useState(0);
    const [prediction, setPrediction] = useState('ESTABLE');
    const [anomalies, setAnomalies] = useState<string[]>([]);

    useEffect(() => {
        // Cálculo real de congestión basado en tracks activos
        const activeTracks = tracks.filter(t => !t.isCoasting).length;
        const density = Math.min(activeTracks * 10, 100);
        setCongestionLevel(density);

        if (density > 80) {
            setPrediction('SATURACIÓN INMINENTE');
        } else if (density > 50) {
            setPrediction('TRÁFICO DENSO CITI');
        } else {
            setPrediction('FLUJO ESTABLE');
        }

        // Capturar anomalías reales del tracker
        const currentAnomalies = tracks
            .filter(t => t.isAnomalous && t.anomalyLabel)
            .map(t => `${t.anomalyLabel} [KINETIC_${t.id}]`);

        if (currentAnomalies.length > 0) {
            setAnomalies(prev => {
                const combined = [...currentAnomalies, ...prev];
                const unique = Array.from(new Set(combined));
                return unique.slice(0, 3);
            });
        }

    }, [tracks]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} className="text-cyan-500" /> Analítica Predictiva
                </h3>
                <span className="text-[9px] font-mono text-cyan-600/60 uppercase animate-pulse">LIVE_INFERENCE</span>
            </div>

            <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 space-y-4">

                {/* Congestion Meter */}
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase font-bold text-slate-400">
                        <span>Nivel de Congestión</span>
                        <span className={congestionLevel > 70 ? 'text-red-500' : 'text-cyan-500'}>{congestionLevel}%</span>
                    </div>
                    <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/5">
                        <div
                            className={`h-full transition-all duration-1000 ${congestionLevel > 70 ? 'bg-gradient-to-r from-orange-500 to-red-500' : 'bg-cyan-500'
                                }`}
                            style={{ width: `${congestionLevel}%` }}
                        />
                    </div>
                    <div className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5">
                        <span className="text-[9px] text-slate-500 uppercase">Predicción (t+5m)</span>
                        <span className={`text-[9px] font-black uppercase ${prediction.includes('SATURACIÓN') ? 'text-red-500 animate-pulse' : 'text-emerald-400'
                            }`}>
                            {prediction}
                        </span>
                    </div>
                </div>

                {/* Anomalies List */}
                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-2">
                        <AlertOctagon size={12} className="text-amber-500" /> Alertas de Comportamiento
                    </h4>
                    <div className="space-y-1">
                        {anomalies.length === 0 ? (
                            <div className="p-2 text-[9px] text-slate-600 italic text-center border border-dashed border-white/5 rounded-lg">
                                Sin anomalías detectadas
                            </div>
                        ) : (
                            anomalies.map((anom, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg text-[10px] text-amber-200">
                                    <Zap size={10} className="text-amber-500 shrink-0" />
                                    {anom}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Early Warning Stats */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-black/20 border border-white/5 p-2 rounded-lg text-center">
                        <span className="block text-[8px] text-slate-500 uppercase mb-1">Risk Score</span>
                        <span className="text-lg font-black text-cyan-400">0.04</span>
                    </div>
                    <div className="bg-black/20 border border-white/5 p-2 rounded-lg text-center">
                        <span className="block text-[8px] text-slate-500 uppercase mb-1">Time-To-Col</span>
                        <span className="text-lg font-black text-emerald-400">∞</span>
                    </div>
                </div>

            </div>
        </div>
    );
};
