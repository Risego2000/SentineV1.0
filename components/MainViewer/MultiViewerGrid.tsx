import React, { useState, useEffect } from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { SentinelProvider } from '../../context/SentinelProvider';
import { SentinelViewer } from './SentinelViewer';
import { createPortal } from 'react-dom';
import { Sidebar } from '../Sidebar';
import { RightSidebar } from '../RightSidebar';

export const MultiViewerGrid = () => {
  const { gridSize, activeViewers, focusedViewerId, setFocusedViewer } = useLayoutStore();

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
    <div className={`w-full h-full grid gap-1 p-1 bg-black/50 ${getGridClass()}`}>
      {activeViewers.map((viewerId) => (
        <SentinelProvider key={viewerId} viewerId={viewerId}>
          <div
            className={`relative flex-1 overflow-hidden rounded-xl border-2 transition-colors ${
              focusedViewerId === viewerId
                ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'border-white/5 opacity-80 hover:opacity-100'
            }`}
            onClick={() => setFocusedViewer(viewerId)}
          >
            <SentinelViewer viewerId={viewerId} />
          </div>

          {focusedViewerId === viewerId && (
            <Portal targetId="sidebar-root">
              <Sidebar />
            </Portal>
          )}
          {focusedViewerId === viewerId && (
            <Portal targetId="right-sidebar-root">
              <RightSidebar />
            </Portal>
          )}
        </SentinelProvider>
      ))}
    </div>
  );
};

const Portal = ({ children, targetId }: { children: React.ReactNode; targetId: string }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById(targetId));
  }, [targetId]);
  if (!target) return null;
  return createPortal(children, target);
};
