import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { SharedBottomBar } from './components/SharedBar/SharedBottomBar';
import './index.css';

export const App = () => (
  <div className="h-screen w-screen bg-[#020617] text-slate-100 flex flex-col overflow-hidden font-sans select-none">
    <div className="flex-1 flex overflow-hidden min-h-0">
      <div id="sidebar-root" className="h-full z-40 shrink-0" />
      <div className="flex-1 relative z-10 min-w-0">
        <ErrorBoundary onError={(err) => console.error('UI crash: ' + err.message)}>
          <MultiViewerGrid />
        </ErrorBoundary>
      </div>
      <div id="right-sidebar-root" className="h-full z-40 shrink-0" />
    </div>
    <SharedBottomBar />
  </div>
);
