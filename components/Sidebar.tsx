import React, { memo } from 'react';
import logo from '../LOGO.png';
import { SystemStatus } from './Sidebar/SystemStatus';
import { EngineSettings } from './Sidebar/EngineSettings';
import { SecurityProtocol } from './Sidebar/SecurityProtocol';
import { ProtocolSelector } from './Sidebar/ProtocolSelector';
import { PredictiveAnalytics } from './Sidebar/PredictiveAnalytics';
import { LayoutControls } from './Sidebar/LayoutControls';
import { SidebarSourceActions } from './Sidebar/SidebarSourceActions';

export const Sidebar = memo(() => {
  return (
    <aside className="w-80 border-r border-white/10 flex flex-col bg-[#020617]/95 z-50 shrink-0 h-screen overflow-hidden">
      <div className="p-6 border-b border-white/10 flex items-center gap-4 bg-cyan-950/10 shrink-0">
        <div
          className="w-10 h-10 shrink-0 bg-cyan-500"
          style={{
            WebkitMaskImage: `url(${logo})`,
            maskImage: `url(${logo})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        />
        <div className="flex flex-col">
          <span className="text-xl font-black italic text-white uppercase leading-none">
            SENTINEL
          </span>
          <span className="text-xs font-black tracking-[0.4em] text-cyan-500/60 uppercase">
            Trajectory_Audit_V15
          </span>
        </div>
      </div>

      <div className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar">
        <LayoutControls />
        <SidebarSourceActions />
        <SystemStatus />
        <EngineSettings />
        <SecurityProtocol />
        <ProtocolSelector />
        <PredictiveAnalytics />
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';
