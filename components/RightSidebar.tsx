import React, { memo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { InfractionFeed } from './RightSidebar/InfractionFeed';
import { SystemTerminal } from './RightSidebar/SystemTerminal';

export const RightSidebar = memo(() => {
  return (
    <aside className="w-80 border-l border-white/10 flex flex-col bg-[#020617]/95 z-50 h-screen shrink-0 overflow-hidden">
      {/* Header — mirrors left sidebar style */}
      <div className="p-6 border-b border-white/10 flex items-center gap-4 bg-red-950/10 shrink-0">
        <ShieldAlert className="text-red-400 w-10 h-10 shrink-0" />
        <div className="flex flex-col">
          <span className="text-xl font-black italic text-white uppercase leading-none">
            Forense
          </span>
          <span className="text-xs font-black tracking-[0.4em] text-red-400/60 uppercase">
            Unidad_Auditora_IA
          </span>
        </div>
      </div>

      <InfractionFeed />
      <SystemTerminal />
    </aside>
  );
});

RightSidebar.displayName = 'RightSidebar';
