import React from 'react';
import { useLayoutStore } from '../../stores/layoutStore';
import { SentinelProvider } from '../../context/SentinelProvider';
import { SentinelViewer } from './SentinelViewer';

export const MultiViewerGrid = () => {
  const { gridSize, activeViewers, focusedViewerId, setFocusedViewer } = useLayoutStore();

  const getGridClass = () => {
    switch (gridSize) {
      case 1:
        return 'grid-cols-1 grid-rows-1';
      case 2:
        return 'grid-cols-1 lg:grid-cols-2';
      case 3:
      case 4:
        return 'grid-cols-1 lg:grid-cols-2 lg:grid-rows-2';
      default:
        return 'grid-cols-1 grid-rows-1';
    }
  };

  return (
    <div
      className={`w-full h-full grid gap-1 p-1 bg-black/50 overflow-y-auto lg:overflow-hidden custom-scrollbar ${getGridClass()}`}
    >
      {activeViewers.map((viewerId) => (
        <SentinelProvider key={viewerId} viewerId={viewerId}>
          <div
            className={`relative overflow-hidden rounded-xl border-2 transition-colors ${
              gridSize === 1 ? 'h-full' : 'h-[350px] lg:h-full'
            } ${
              focusedViewerId === viewerId
                ? 'border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'border-white/5 opacity-80 hover:opacity-100'
            }`}
            onClick={() => setFocusedViewer(viewerId)}
          >
            <SentinelViewer viewerId={viewerId} />
          </div>
        </SentinelProvider>
      ))}
    </div>
  );
};
