import React from 'react';

// Components & Modules
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import './index.css';

/**
 * Sentinel AI Supreme Command Unit (Main Application).
 * Orchestrates global visuals, tactical feedback loop, and system synchronization.
 */
export const App = () => {
  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-100 flex overflow-hidden font-sans select-none">
      {/* Left Sidebar Portal Target */}
      <div id="sidebar-root" className="h-full z-40 shrink-0" />

      {/* Central Grid Area */}
      <div className="flex-1 relative z-10">
        <ErrorBoundary onError={(err) => console.error(`UI crash: ${err.message}`)}>
          <MultiViewerGrid />
        </ErrorBoundary>
      </div>

      {/* Right Sidebar Portal Target */}
      <div id="right-sidebar-root" className="h-full z-40 shrink-0" />
    </div>
  );
};
