import React, { memo, useState } from 'react';
import {
  ShieldAlert,
  Activity,
  Terminal as TerminalIcon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Database,
  Shield,
} from 'lucide-react';
import { InfractionFeed } from './RightSidebar/InfractionFeed';
import { SystemTerminal } from './RightSidebar/SystemTerminal';
import { DatabasePanel } from './RightSidebar/DatabasePanel';
import { PredictiveAnalytics } from './Sidebar/PredictiveAnalytics';
import { useLayoutStore } from '../stores/layoutStore';
import { useHelp } from '../hooks/useHelp';
import { useAuth } from '../hooks/useAuth';

export const RightSidebar = memo(() => {
  const [activeTab, setActiveTab] = useState<'infractions' | 'analytics' | 'terminal' | 'database'>(
    'infractions'
  );
  const { isRightSidebarCollapsed, toggleRightSidebar, setView } = useLayoutStore();
  const { helpProps } = useHelp();
  const { user, logout, isLoading: isLoggingOut } = useAuth();

  return (
    <aside
      className={`transition-all duration-300 ease-in-out border-l border-white/5 flex flex-col bg-[#0d0d0f] z-50 h-screen shrink-0 overflow-hidden ${
        isRightSidebarCollapsed ? 'w-16' : 'w-80'
      }`}
    >
      <div
        className={`p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0 ${isRightSidebarCollapsed ? 'px-3' : ''}`}
      >
        {!isRightSidebarCollapsed && (
          <div className="flex items-center flex-1 mr-4 gap-3">
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
        <button
          onClick={toggleRightSidebar}
          className="p-1.5 hover:bg-white/5 rounded-md text-slate-400 transition-colors"
          {...helpProps(
            isRightSidebarCollapsed ? 'Expandir panel derecho' : 'Colapsar panel derecho'
          )}
        >
          {isRightSidebarCollapsed ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {!isRightSidebarCollapsed && (
        <div className="flex border-b border-white/5 bg-black/20">
          <button
            onClick={() => setActiveTab('infractions')}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === 'infractions'
                ? 'text-blue-500 bg-blue-500/5'
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
                ? 'text-blue-500 bg-blue-500/5'
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
                ? 'text-blue-500 bg-blue-500/5'
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
                ? 'text-blue-500 bg-blue-500/5'
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
            <button
              onClick={() => {
                toggleRightSidebar();
                setActiveTab('infractions');
              }}
              className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500 border border-blue-500/20"
              {...helpProps('Abrir panel de Sanciones')}
            >
              <ShieldAlert size={16} />
            </button>
            <button
              onClick={() => {
                toggleRightSidebar();
                setActiveTab('analytics');
              }}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 border border-white/5"
              {...helpProps('Abrir panel de Métricas')}
            >
              <Activity size={16} />
            </button>
            <button
              onClick={() => {
                toggleRightSidebar();
                setActiveTab('terminal');
              }}
              className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 border border-white/5"
              {...helpProps('Abrir Terminal de Sistema')}
            >
              <TerminalIcon size={16} />
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'infractions' && <InfractionFeed />}
            {activeTab === 'analytics' && (
              <div className="flex-1 flex flex-col min-h-0 p-4 space-y-6 overflow-y-auto custom-scrollbar">
                <PredictiveAnalytics />
              </div>
            )}
            {activeTab === 'terminal' && <SystemTerminal />}
            {activeTab === 'database' && <DatabasePanel />}
          </>
        )}

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
      </div>
    </aside>
  );
});

RightSidebar.displayName = 'RightSidebar';
