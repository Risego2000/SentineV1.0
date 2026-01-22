import React, { memo } from 'react';
import { ShieldCheck } from 'lucide-react';
import { SystemStatus } from './Sidebar/SystemStatus';
import { EngineSettings } from './Sidebar/EngineSettings';
import { SecurityProtocol } from './Sidebar/SecurityProtocol';
import { ProtocolSelector } from './Sidebar/ProtocolSelector';
import { GeometryTools } from './Sidebar/GeometryTools';
import { PredictiveAnalytics } from './Sidebar/PredictiveAnalytics';


interface SidebarProps {
    toggleListening: () => void;
}

/**
 * Componente Sidebar modularizado.
 * Utiliza memoización para evitar re-renders innecesarios.
 */
export const Sidebar = memo(({ toggleListening }: SidebarProps) => {
    return (
        <aside className="w-80 border-r border-white/10 flex flex-col bg-[#020617]/95 z-50 shrink-0 h-screen overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center gap-4 bg-cyan-950/10 shrink-0">
                <ShieldCheck className="text-cyan-500 w-10 h-10" />
                <div className="flex flex-col">
                    <span className="text-xl font-black italic text-white uppercase leading-none">SENTINEL</span>
                    <span className="text-[9px] font-black tracking-[0.4em] text-cyan-500/60 uppercase">
                        Trajectory_Audit_V15
                    </span>
                </div>
            </div>

            <div className="flex-1 p-5 space-y-6 overflow-y-auto custom-scrollbar">
                <SystemStatus />
                <EngineSettings />
                <GeometryTools />
                <ProtocolSelector />
                <SecurityProtocol toggleListening={toggleListening} />
                <PredictiveAnalytics />
            </div>


        </aside>
    );
});

Sidebar.displayName = 'Sidebar';
