import React, { memo, useState } from 'react';
import {
  ShieldAlert,
  Activity,
  Terminal as TerminalIcon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Database,
} from 'lucide-react';
import { InfractionFeed } from './RightSidebar/InfractionFeed';
import { SystemTerminal } from './RightSidebar/SystemTerminal';
import { PredictiveAnalytics } from './Sidebar/PredictiveAnalytics';
import { useLayoutStore } from '../stores/layoutStore';
import { useHelp } from '../hooks/useHelp';
import { useAuth } from '../hooks/useAuth';

export const RightSidebar = memo(() => {
  const { setView } = useLayoutStore();
  const [activeTab, setActiveTab] = useState<'infractions' | 'analytics' | 'terminal' | 'database'>(
    'infractions'
  );
  const { isRightSidebarCollapsed, toggleRightSidebar } = useLayoutStore();
  const { helpProps } = useHelp();
  const { user, logout, isLoading: isLoggingOut } = useAuth();

  return (
    <aside
      className={`transition-all duration-300 ease-in-out border-l border-white/5 flex flex-col bg-[#0d0d0f] z-50 h-screen shrink-0 overflow-hidden ${
        isRightSidebarCollapsed ? 'w-16' : 'w-80'
      }`}
    >
      <div
        className={`border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0 ${isRightSidebarCollapsed ? 'px-3 py-5' : 'p-5'}`}
      >
        {!isRightSidebarCollapsed && (
          <button
            onClick={toggleRightSidebar}
            className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all shrink-0"
            {...helpProps('Contraer panel derecho')}
          >
            <ChevronRight size={18} />
          </button>
        )}
        {!isRightSidebarCollapsed && (
          <div className="flex items-center flex-1 gap-3">
            <img src="/LOGO.png" alt="Logo" className="w-12 h-12 object-contain" />
            <div className="flex flex-col items-center flex-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <span className="text-[28px] font-black text-slate-200 uppercase italic leading-none tracking-tighter">
                    FORENSE
                  </span>
                  <span className="text-[28px] font-black text-red-600 uppercase italic leading-none tracking-tighter ml-1">
                    AI
                  </span>
                </div>
                <span className="text-[9px] font-bold text-red-400/60 uppercase mt-1">V.1.0</span>
              </div>

              <div className="flex items-center w-full gap-2 mt-1">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-red-500/40" />
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-[0.15em] whitespace-nowrap">
                  UNIDAD AUDITORA
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-red-500/40" />
              </div>
            </div>
          </div>
        )}
        {isRightSidebarCollapsed && (
          <button
            onClick={toggleRightSidebar}
            className="w-10 h-10 rounded-xl overflow-hidden hover:scale-110 transition-transform duration-300"
            {...helpProps('Expandir panel derecho')}
          >
            <img src="/LOGO.png" alt="Logo Forense" className="w-full h-full object-contain" />
          </button>
        )}
      </div>

      {!isRightSidebarCollapsed && (
        <div className="flex border-b border-white/5 bg-black/20">
          <button
            onClick={() => setActiveTab('infractions')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === 'infractions'
                ? 'text-red-500 bg-red-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            {...helpProps('Ver listado de infracciones detectadas y peritajes.')}
          >
            Sanciones
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === 'analytics'
                ? 'text-red-500 bg-red-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            {...helpProps('Ver métricas tácticas y análisis predictivo del tráfico.')}
          >
            Métricas
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === 'terminal'
                ? 'text-red-500 bg-red-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            {...helpProps('Monitorizar registros internos del sistema y eventos AI.')}
          >
            Terminal
          </button>
          <button
            onClick={() => {
              setActiveTab('database');
              setView('database');
            }}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === 'database'
                ? 'text-red-500 bg-red-500/5'
                : 'text-slate-500 hover:text-slate-300'
            }`}
            {...helpProps('Acceder a la base de datos de evidencias (Pantalla Completa).')}
          >
            DB
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {isRightSidebarCollapsed ? (
          <div className="flex-1 flex flex-col items-center gap-6 pt-6 pb-6 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => {
                toggleRightSidebar();
                setActiveTab('infractions');
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                activeTab === 'infractions'
                  ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'bg-white/[0.03] border-white/5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
              }`}
              {...helpProps('Ver Sanciones')}
            >
              <ShieldAlert size={18} />
            </button>
            <button
              onClick={() => {
                toggleRightSidebar();
                setActiveTab('analytics');
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                activeTab === 'analytics'
                  ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'bg-white/[0.03] border-white/5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
              }`}
              {...helpProps('Ver Métricas')}
            >
              <Activity size={18} />
            </button>
            <button
              onClick={() => {
                toggleRightSidebar();
                setActiveTab('terminal');
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                activeTab === 'terminal'
                  ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'bg-white/[0.03] border-white/5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
              }`}
              {...helpProps('Ver Terminal')}
            >
              <TerminalIcon size={18} />
            </button>
            <div className="w-8 h-[1px] bg-white/5" />
            <button
              onClick={() => {
                // Para DB solemos ir a vista completa, pero si el usuario quiere abrir la barra:
                toggleRightSidebar();
                setActiveTab('database');
                setView('database');
              }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                activeTab === 'database'
                  ? 'bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                  : 'bg-white/[0.03] border-white/5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'
              }`}
              {...helpProps('Acceder a Base de Datos')}
            >
              <Database size={18} />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {activeTab === 'infractions' && <InfractionFeed />}
            {activeTab === 'analytics' && (
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-6 overflow-y-auto custom-scrollbar">
                <PredictiveAnalytics />
              </div>
            )}
            {activeTab === 'terminal' && <SystemTerminal />}
          </div>
        )}

        <div
          className={`shrink-0 border-t border-white/5 bg-white/[0.02] h-14 flex items-center ${isRightSidebarCollapsed ? 'justify-center' : 'px-4'}`}
        >
          <div
            className={`flex items-center ${isRightSidebarCollapsed ? 'justify-center' : 'gap-3 w-full'}`}
          >
            {!isRightSidebarCollapsed && (
              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              </div>
            )}
            {!isRightSidebarCollapsed && (
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-black text-white uppercase tracking-tight leading-none truncate">
                  {user?.name || user?.email?.split('@')[0] || 'Operador'}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">
                  {user?.email?.split('@')[0] || 'operador'}
                </span>
              </div>
            )}
            <button
              onClick={() => logout()}
              disabled={isLoggingOut}
              aria-label="Cerrar sesión"
              className="w-9 h-9 rounded-xl bg-slate-950 border border-red-500/30 flex items-center justify-center hover:bg-red-500/5 transition-all active:scale-95 disabled:opacity-50 shrink-0 shadow-inner group"
              {...helpProps('Cerrar sesión')}
            >
              <LogOut className="w-4 h-4 text-red-500/80 group-hover:text-red-500 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
});

RightSidebar.displayName = 'RightSidebar';
