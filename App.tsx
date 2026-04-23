import React, { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { SharedBottomBar } from './components/SharedBar/SharedBottomBar';
import './index.css';

// Auto-discover backend API port on startup
const discoverBackendPort = async () => {
  try {
    // Try to fetch from /api/health on different ports
    // Check recently used ports first (from preview auto-assignment)
    const commonPorts = [54603, 51355, 51470, 49182, 55606, 56162, 59601, 3002, 5173, 3001, 3003];
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    for (const port of commonPorts) {
      try {
        const url = `${protocol}//${hostname}:${port}/api/health`;
        const response = await Promise.race([
          fetch(url, { method: 'GET' }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), 1000)
          )
        ]);

        if (response.ok) {
          console.log(`[API_DISCOVERY] Backend found on port ${port}`);
          sessionStorage.setItem('sentinel_api_port', String(port));
          return port;
        }
      } catch (e) {
        // Port not responding, try next one
      }
    }
  } catch (error) {
    console.warn('[API_DISCOVERY] Could not auto-discover backend port:', error);
  }
};

export const App = () => {
  useEffect(() => {
    // Discover backend port on app startup
    discoverBackendPort();
  }, []);

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
