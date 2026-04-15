import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { SharedBottomBar } from './components/SharedBar/SharedBottomBar';
import './index.css';

export const App = () => {
  return (
    <div className="h-screen w-screen bg-[#0a0a0c] text-slate-100 flex overflow-hidden font-sans select-none relative">
      <div id="sidebar-root" className="h-full z-40 shrink-0" />

      {/* Centre column: viewer grid + bottom bar — same width, aligned */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#0a0a0c]">
        <div className="flex-1 relative z-10 min-h-0 overflow-hidden p-2">
          <ErrorBoundary onError={(err) => console.error('UI crash: ' + err.message)}>
            <MultiViewerGrid />
          </ErrorBoundary>
        </div>
        <SharedBottomBar />
      </div>

      <div id="right-sidebar-root" className="h-full z-40 shrink-0" />

      <div id="modal-root" />
    </div>
  );
};
