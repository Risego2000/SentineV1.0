import React from 'react';
import { Menu, LayoutGrid, Radar, X } from 'lucide-react';
import { useLayoutStore } from './stores/layoutStore';

// Components & Modules
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { Sidebar } from './components/Sidebar';
import { RightSidebar } from './components/RightSidebar';
import './index.css';

/**
 * Sentinel AI Supreme Command Unit (Main Application).
 * Orchestrates global visuals, tactical feedback loop, and system synchronization.
 */
export const App = () => {
  const { isSidebarOpen, isRightSidebarOpen, toggleSidebar, toggleRightSidebar } = useLayoutStore();

  return (
    <div className="h-screen w-screen bg-[#020617] text-slate-100 flex overflow-hidden font-sans select-none relative">
      {/* Mobile Backdrop Overlay */}
      {(isSidebarOpen || isRightSidebarOpen) && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[45] lg:hidden animate-in fade-in duration-300"
          onClick={() => {
            if (isSidebarOpen) toggleSidebar();
            if (isRightSidebarOpen) toggleRightSidebar();
          }}
        />
      )}

      {/* Left Sidebar (Responsive Overlay) */}
      <div
        className={`fixed lg:relative z-50 transform transition-transform duration-300 h-screen shadow-2xl lg:shadow-none ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar />
        {/* Close button for mobile sidebar */}
        <button
          onClick={toggleSidebar}
          className="lg:hidden absolute top-4 -right-12 p-2 bg-cyan-500 text-black rounded-r-xl"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 relative z-10 flex flex-col min-w-0 h-full">
        {/* Mobile Header (Hidden on Desktop) */}
        <header className="lg:hidden h-16 border-b border-white/10 bg-[#020617]/90 backdrop-blur-xl flex items-center justify-between px-5 shrink-0">
          <button
            onClick={toggleSidebar}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-cyan-400 transition-colors"
          >
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-3">
            <Radar size={24} className="text-cyan-400 animate-pulse" />
            <div className="flex flex-col">
              <span className="font-black italic text-xs tracking-tighter leading-none">SENTINEL</span>
              <span className="text-[8px] font-bold text-cyan-500 tracking-widest uppercase opacity-80">BIO_AI_CORE</span>
            </div>
          </div>
          <button
            onClick={toggleRightSidebar}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-cyan-400 transition-colors"
          >
            <LayoutGrid size={22} />
          </button>
        </header>

        <main className="flex-1 min-h-0 relative">
          <ErrorBoundary onError={(err) => console.error(`UI crash: ${err.message}`)}>
            <MultiViewerGrid />
          </ErrorBoundary>
        </main>
      </div>

      {/* Right Sidebar (Responsive Overlay) */}
      <div
        className={`fixed lg:relative z-50 right-0 transform transition-transform duration-300 h-screen shadow-2xl lg:shadow-none ${
          isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Close button for mobile right sidebar */}
        <button
          onClick={toggleRightSidebar}
          className="lg:hidden absolute top-4 -left-12 p-2 bg-cyan-500 text-black rounded-l-xl"
        >
          <X size={20} />
        </button>
        <RightSidebar />
      </div>
    </div>
  );
};
