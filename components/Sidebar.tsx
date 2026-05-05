import React, { memo } from 'react';
import { ChevronLeft, ChevronRight, ShieldAlert } from 'lucide-react';
import { useLayoutStore } from '../stores/layoutStore';

const logo = '/LOGO.png';
import { useHelp } from '../hooks/useHelp';
import { SidebarSourceActions } from './Sidebar/SidebarSourceActions';
import { SystemStatus } from './Sidebar/SystemStatus';
import { ConfigManager } from './Sidebar/ConfigManager';
import { LayoutControls } from './Sidebar/LayoutControls';
import { EngineSettings } from './Sidebar/EngineSettings';
import { SecurityProtocol } from './Sidebar/SecurityProtocol';
import { ProtocolSelector } from './Sidebar/ProtocolSelector';

const logoUrl =
  'https://cdn.discordapp.com/attachments/1110595393043808337/1110595431669145712/logo_sentinel.png';

export const Sidebar = memo(() => {
  const { isSidebarCollapsed, toggleSidebar } = useLayoutStore();
  const { helpProps } = useHelp();

  const handleExpandAndScroll = (id: string) => {
    toggleSidebar();
    // Esperamos un momento a que el DOM se renderice tras expandir
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 350);
  };

  return (
    <aside
      className={`sidebar-unified transition-all duration-300 ease-in-out border-r border-white/5 flex flex-col bg-[#0d0d0f] z-50 shrink-0 h-screen overflow-hidden ${
        isSidebarCollapsed ? 'w-16' : 'w-80'
      }`}
    >
      <div
        className={`p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0 ${isSidebarCollapsed ? 'px-3' : ''}`}
      >
        {!isSidebarCollapsed && (
          <div className="flex items-center flex-1 mr-4 gap-3">
            <img src="/ESCUDO.png" alt="Escudo" className="w-12 h-12 object-contain" />
            <div className="flex flex-col items-center flex-1">
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  <span className="text-[28px] font-black text-slate-200 uppercase italic leading-none tracking-tighter">
                    SENTINEL
                  </span>
                  <span className="text-[28px] font-black text-blue-500 uppercase italic leading-none tracking-tighter ml-1">
                    AI
                  </span>
                </div>
                <span className="text-[9px] font-bold text-blue-400/60 uppercase mt-1">V.1.0</span>
              </div>

              <div className="flex items-center w-full gap-2 mt-1">
                <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-blue-500/40" />
                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-[0.15em] whitespace-nowrap">
                  POLICÍA DE DAGANZO
                </span>
                <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-blue-500/40" />
              </div>
            </div>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-white/5 rounded-md text-slate-400 transition-colors"
          {...helpProps(isSidebarCollapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral')}
        >
          {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div
        className={`flex-1 overflow-y-auto custom-scrollbar ${isSidebarCollapsed ? 'p-2' : 'p-4 space-y-6'}`}
      >
        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center gap-6 pt-4">
            <button
              onClick={toggleSidebar}
              className="w-10 h-10 rounded-xl overflow-hidden hover:scale-110 transition-transform duration-300"
              {...helpProps('Expandir sistema')}
            >
              <img src="/ESCUDO.png" alt="Logo Sentinel" className="w-full h-full object-contain" />
            </button>
          </div>
        ) : (
          <>
            <SidebarSourceActions />
            <SystemStatus />
            <ConfigManager />
            <LayoutControls />
            <EngineSettings />
            <SecurityProtocol />
            <ProtocolSelector />
          </>
        )}
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';
