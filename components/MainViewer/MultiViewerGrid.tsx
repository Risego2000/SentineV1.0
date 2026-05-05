import React from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { SentinelProvider } from '../../context/SentinelProvider';
import { SentinelViewer } from './SentinelViewer';
import { createPortal } from 'react-dom';
import { Sidebar } from '../Sidebar';
import { RightSidebar } from '../RightSidebar';
import { HelpCapsule } from './HelpCapsule';
import { useSentinel } from '../../hooks/useSentinel';
import { InfractionModal } from '../InfractionModal';

export const MultiViewerGrid = () => {
  const { gridSize, activeViewers, focusedViewerId, setFocusedViewer } = useLayoutStore();
  const sidebarViewerId = activeViewers.includes(focusedViewerId)
    ? focusedViewerId
    : activeViewers[0];

  const getGridClass = () => {
    switch (gridSize) {
      case 1:
        return 'grid-cols-1 grid-rows-1';
      case 2:
        return 'grid-cols-2 grid-rows-1';
      case 3:
      case 4:
        return 'grid-cols-2 grid-rows-2';
      default:
        return 'grid-cols-1 grid-rows-1';
    }
  };

  return (
    <div className={`w-full h-full grid gap-2 ${getGridClass()}`}>
      {activeViewers.map((viewerId) => (
        <SentinelProvider key={viewerId} viewerId={viewerId}>
          <div
            className={`relative flex-1 overflow-hidden rounded-lg border transition-all duration-300 ${
              focusedViewerId === viewerId
                ? 'border-blue-500/50 bg-[#121216]'
                : 'border-white/5 bg-[#0d0d0f] opacity-60 hover:opacity-100'
            }`}
            onClick={() => setFocusedViewer(viewerId)}
          >
            <SentinelViewer viewerId={viewerId} />
          </div>

          {sidebarViewerId === viewerId && (
            <Portal targetId="sidebar-root">
              <Sidebar />
            </Portal>
          )}
          {sidebarViewerId === viewerId && (
            <Portal targetId="right-sidebar-root">
              <RightSidebar />
            </Portal>
          )}
          {sidebarViewerId === viewerId && <HelpCapsule />}
          <SentinelModalPortal />
        </SentinelProvider>
      ))}
    </div>
  );
};

const SentinelModalPortal = () => {
  const { selectedLog, setSelectedLog } = useSentinel();
  if (!selectedLog) return null;
  return (
    <Portal targetId="modal-root">
      <InfractionModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </Portal>
  );
};

const Portal = ({ children, targetId }: { children: React.ReactNode; targetId: string }) => {
  const target = typeof document !== 'undefined' ? document.getElementById(targetId) : null;
  if (!target) return null;
  return createPortal(children, target);
};
