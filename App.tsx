import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { SharedBottomBar } from './components/SharedBar/SharedBottomBar';
import { ExpedientListPage } from './pages/ExpedientListPage';
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

type ViewMode = 'detection' | 'expedients';

export const App = () => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // Check URL params or session storage for view preference
    const params = new URLSearchParams(window.location.search);
    return (params.get('view') as ViewMode) || 'detection';
  });

  useEffect(() => {
    // Discover backend port on app startup
    discoverBackendPort();
  }, []);

  // Handle view switching via keyboard shortcut (Ctrl+E for Expedients)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        setViewMode((prev) => (prev === 'detection' ? 'expedients' : 'detection'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-screen w-screen bg-[#0a0a0c] text-slate-100 flex overflow-hidden font-sans select-none relative">
      <div id="sidebar-root" className="h-full z-40 shrink-0" />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#0a0a0c]">
        {/* View Mode Toggle */}
        <div className="view-mode-toggle" style={{
          display: 'flex',
          gap: '5px',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}>
          <button
            onClick={() => setViewMode('detection')}
            style={{
              padding: '6px 12px',
              background: viewMode === 'detection' ? '#007bff' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: viewMode === 'detection' ? 'bold' : 'normal',
            }}
          >
            🎥 Detección
          </button>
          <button
            onClick={() => setViewMode('expedients')}
            style={{
              padding: '6px 12px',
              background: viewMode === 'expedients' ? '#007bff' : 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: viewMode === 'expedients' ? 'bold' : 'normal',
            }}
          >
            📋 Expedientes
          </button>
          <span style={{
            marginLeft: 'auto',
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.6)',
            padding: '6px 0',
          }}>
            Ctrl+E para cambiar vista
          </span>
        </div>

        {/* View Content - Detection Mode */}
        <div
          style={{
            display: viewMode === 'detection' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            position: 'relative',
            zIndex: 10,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div className="flex-1 relative z-10 min-h-0 overflow-hidden p-2">
            <ErrorBoundary onError={(err) => console.error('UI crash: ' + err.message)}>
              <MultiViewerGrid />
            </ErrorBoundary>
          </div>
          <SharedBottomBar />
        </div>

        {/* View Content - Expedients Mode */}
        <div
          style={{
            display: viewMode === 'expedients' ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1,
            position: 'relative',
            zIndex: 10,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <ErrorBoundary onError={(err) => console.error('UI crash: ' + err.message)}>
            <ExpedientListPage />
          </ErrorBoundary>
        </div>
      </div>

      <div id="right-sidebar-root" className="h-full z-40 shrink-0" />

      <div id="modal-root" />
    </div>
  );
};
