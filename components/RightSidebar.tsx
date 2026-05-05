import React, { memo, useState } from 'react';
import { ChevronLeft, ChevronRight, LogOut, Shield } from 'lucide-react';
import { InfractionFeed } from './RightSidebar/InfractionFeed';
import { SystemTerminal } from './RightSidebar/SystemTerminal';
import { PredictiveAnalytics } from './Sidebar/PredictiveAnalytics';
import { TacticalMetrics } from './RightSidebar/TacticalMetrics';
import { useLayoutStore } from '../stores/layoutStore';
import { useHelp } from '../hooks/useHelp';
import { useAuth } from '../hooks/useAuth';

export const RightSidebar = memo(() => {
  const [activeTab, setActiveTab] = useState<'infractions' | 'analytics' | 'terminal'>(
    'infractions'
  );
  const { isRightSidebarCollapsed, toggleRightSidebar } = useLayoutStore();
  const { helpProps } = useHelp();
  const { user, logout, isLoading: isLoggingOut } = useAuth();

  return (
    <aside
      className={`sidebar-unified transition-all duration-300 ease-in-out border-l border-white/5 flex flex-col bg-[#0d0d0f] z-50 h-screen shrink-0 overflow-hidden ${
        isRightSidebarCollapsed ? 'w-16' : 'w-80'
      }`}
    >
      <div
        className={`p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0 ${isRightSidebarCollapsed ? 'px-3' : ''}`}
      >
        <button
          onClick={toggleRightSidebar}
          className="p-1.5 hover:bg-white/5 rounded-md text-slate-400 transition-colors shrink-0"
          {...helpProps(
            isRightSidebarCollapsed ? 'Expandir panel derecho' : 'Colapsar panel derecho'
          )}
        >
          {isRightSidebarCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
        {!isRightSidebarCollapsed && (
          <div className="flex items-center flex-1 ml-4 gap-3">
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
            Infracciones
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
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        {isRightSidebarCollapsed ? (
          <div className="flex flex-col items-center gap-6 pt-4">
            <button
              onClick={toggleRightSidebar}
              className="w-10 h-10 hover:scale-110 transition-transform duration-300 flex items-center justify-center"
              {...helpProps('Expandir panel derecho')}
            >
              <div
                className="w-8 h-8 shrink-0 bg-red-600"
                style={{
                  maskImage: 'url(/LOGO.png)',
                  WebkitMaskImage: 'url(/LOGO.png)',
                  maskSize: 'contain',
                  WebkitMaskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  WebkitMaskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  WebkitMaskPosition: 'center',
                }}
              />
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'infractions' && (
              <div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
                <button
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent('sentinel:set-view', { detail: 'expedients' })
                    )
                  }
                  className="w-full mb-3 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors border border-red-500/30 bg-red-500/8 text-red-500/85"
                  {...helpProps('Abrir el módulo de infracciones y expedientes.')}
                >
                  MODULO DE INFRACCIONES
                </button>
                <div className="horizon-card rounded-[20px] border border-white/5 bg-[#020617]/35 overflow-hidden">
                  <InfractionFeed />
                </div>
              </div>
            )}
            {activeTab === 'analytics' && (
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-6 overflow-y-auto custom-scrollbar">
                <TacticalMetrics />
                <PredictiveAnalytics />
              </div>
            )}
            {activeTab === 'terminal' && (
              <div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
                <div className="horizon-card rounded-[20px] border border-white/5 bg-[#020617]/35 overflow-hidden min-h-full">
                  <SystemTerminal />
                </div>
              </div>
            )}
          </>
        )}

        {!isRightSidebarCollapsed && (
          <div className="shrink-0 px-4 border-t border-white/5 bg-white/[0.02] h-14 flex items-center">
            <div className="flex items-center gap-3 w-full">
              <div className="w-9 h-9 rounded-xl bg-slate-950 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
                <Shield className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-black text-white uppercase tracking-tight leading-none truncate">
                  {user?.name || user?.email?.split('@')[0] || 'Operador'}
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest truncate">
                  {user?.email?.split('@')[0] || 'operador'}
                </span>
              </div>
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
        )}
      </div>
    </aside>
  );
});

RightSidebar.displayName = 'RightSidebar';
