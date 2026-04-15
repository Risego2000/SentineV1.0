import React from 'react';
import { Target, Mic, Terminal } from 'lucide-react';
import { useSentinel } from '../../hooks/useSentinel';
import { useHelp } from '../../hooks/useHelp';

export const SecurityProtocol = () => {
  const { directives, setDirectives, isListening, setIsListening, generateGeometry, addLog } =
    useSentinel();
  const { helpProps } = useHelp();

  const handleMicToggle = () => {
    const newState = !isListening;
    setIsListening(newState);
    addLog(
      'AI',
      newState
        ? 'Micrófono activado: Iniciando escucha de directivas biónicas.'
        : 'Micrófono desactivado.'
    );
  };

  return (
    <div className="space-y-[10px]">
      <div
        className="flex items-center justify-between"
        {...helpProps(
          'Panel de protocolos de seguridad biónicos. Define aquí las reglas de tráfico y lógica legal.'
        )}
      >
        <div className="flex items-center gap-2">
          <Target size={14} className="text-blue-500" />
          <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
            Protocolo_Seguridad
          </h3>
        </div>
        <button
          onClick={handleMicToggle}
          className={`relative group p-2 rounded-[12px] transition-all duration-500 ${
            isListening
              ? 'bg-red-500/90 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
              : 'bg-slate-900 border border-white/5 text-slate-500 hover:border-blue-500/50 hover:bg-slate-800'
          }`}
          {...helpProps(
            isListening
              ? 'Detener escucha activa.'
              : 'Activar escucha por voz para dictar protocolos.'
          )}
        >
          <Mic size={14} className={isListening ? 'animate-pulse' : ''} />
          {isListening && (
            <div className="absolute -inset-1 border border-red-500/50 rounded-[12px] animate-ping opacity-20" />
          )}
        </button>
      </div>

      <div className="bg-slate-900/40 border border-white/10 rounded-[20px] p-4 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 hud-grid opacity-5 pointer-events-none" />

        {/* Editor Táctico */}
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Terminal size={12} className="text-blue-500/40" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">
                Directivas_IA
              </span>
            </div>
            <div className="text-[8px] text-slate-700 font-black flex items-center gap-2 tracking-widest uppercase">
              <div className="w-1 h-1 bg-blue-500/40 rounded-full animate-pulse" />
              Live_Stream
            </div>
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
            className="w-full h-40 bg-[#020617]/40 border border-white/5 rounded-[15px] p-4 text-[10px] font-mono text-blue-200/80 outline-none resize-none shadow-inner focus:border-blue-500/30 focus:bg-[#020617]/60 transition-all uppercase custom-scrollbar placeholder:text-slate-800 leading-relaxed tracking-wider"
            placeholder="> DEFINA_PROTOCOLOS_IA..."
            {...helpProps(
              'Editor táctico de directivas. Escribe las reglas de tráfico y presiona ENTER para sincronizar con la IA.'
            )}
          />

          <div className="flex items-center justify-between px-1">
            <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest italic">
              [ SHIFT + ENTER ] PARA SALTO DE LÍNEA
            </span>
            <span className="text-[7px] font-black text-slate-700 uppercase tracking-widest italic">
              [ ENTER ] PARA SINCRONIZAR
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
