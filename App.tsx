import React, { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { SharedBottomBar } from './components/SharedBar/SharedBottomBar';
import { isElectron, getServerPortFromElectron } from './utils/electronDetect';
import './index.css';

// Auto-discover backend API port on startup
const discoverBackendPort = async () => {
  // If running in Electron, use IPC to get the port
  if (isElectron()) {
    try {
      const port = await getServerPortFromElectron();
      console.log(`[API_DISCOVERY] Backend port from Electron: ${port}`);
      sessionStorage.setItem('sentinel_api_port', String(port));
      return port;
    } catch (error) {
      console.error('[API_DISCOVERY] Failed to get port from Electron:', error);
    }
  }
  try {
    // Try to fetch from /api/health on different ports
    // Start with the standard Sentinel port, then try common dev ports
    const commonPorts = [3002, 3001];
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    for (const port of commonPorts) {
      try {
        const url = `${protocol}//${hostname}:${port}/api/health`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 800);

        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log(`[API_DISCOVERY] Backend found on port ${port}`);
          sessionStorage.setItem('sentinel_api_port', String(port));
          return port;
        }
      } catch (e) {
        // Port not responding or timeout, try next one
        // Silently continue to next port
      }
    }
    console.log('[API_DISCOVERY] Using default API configuration');
  } catch (error) {
    // Suppress error logging during discovery
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
