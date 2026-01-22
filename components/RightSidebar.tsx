import React, { memo } from 'react';
import { InfractionFeed } from './RightSidebar/InfractionFeed';
import { SystemTerminal } from './RightSidebar/SystemTerminal';

/**
 * RightSidebar modularizado y optimizado.
 * Separa lógica de feed, métricas y terminal.
 */
export const RightSidebar = memo(() => {
    return (
        <aside className="w-80 border-l border-white/10 flex flex-col bg-[#020617]/95 z-50 h-screen shrink-0 overflow-hidden">
            <InfractionFeed />
            <SystemTerminal />
        </aside>
    );
});

RightSidebar.displayName = 'RightSidebar';
