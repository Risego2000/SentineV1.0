import React, { memo } from 'react';
import { Radar } from 'lucide-react';
import { SystemStatus } from './Sidebar/SystemStatus';
import { EngineSettings } from './Sidebar/EngineSettings';
import { SecurityProtocol } from './Sidebar/SecurityProtocol';
import { ProtocolSelector } from './Sidebar/ProtocolSelector';
import { PredictiveAnalytics } from './Sidebar/PredictiveAnalytics';
import { LayoutControls } from './Sidebar/LayoutControls';
export const Sidebar = memo(() => {
  return (
    <aside className="w-[280px] sm:w-80 border-r border-white/10 flex flex-col bg-[#020617]/95 z-50 shrink-0 h-screen overflow-hidden">
      <div className="p-6 border-b border-white/10 flex items-center gap-4 bg-cyan-950/10 shrink-0">
        <Radar className="text-cyan-200 w-12 h-12" strokeWidth={1.8} />
        <div className="flex flex-col">
          <span className="text-xl font-black italic text-white uppercase leading-none">
            SENTINEL
          </span>
          <span className="text-xs font-black tracking-[0.4em] text-cyan-300 uppercase">
            Trajectory_Audit_V15
          </span>
        </div>
      </div>

      <div className="flex-1 p-5 space-y-8 overflow-y-auto custom-scrollbar">
        <SystemStatus />
        <LayoutControls />
        <EngineSettings />
        <SecurityProtocol />
        <ProtocolSelector />
        <PredictiveAnalytics />
      </div>
    </aside>
  );
});

Sidebar.displayName = 'Sidebar';
