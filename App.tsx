import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { SharedBottomBar } from './components/SharedBar/SharedBottomBar';
import { ExpedientListPage } from './pages/ExpedientListPage';
import { SentinelProvider } from './context/SentinelProvider';
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
    <SentinelProvider viewerId="global">
      <div className="h-screen w-screen bg-[#0a0a0c] text-slate-100 flex overflow-hidden font-sans select-none relative">
        <div id="sidebar-root" className="h-full z-40 shrink-0" />

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#0a0a0c]">
          {/* View Mode Toggle - Traffic Sign Icons */}
          <div className="view-mode-toggle" style={{
            display: 'flex',
            gap: '5px',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            alignItems: 'center',
          }}>
            {/* Detection Button */}
            <button
              onClick={() => setViewMode('detection')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'detection' ? '#007bff' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: viewMode === 'detection' ? 'bold' : 'normal',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Traffic Camera / Detection Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
                <circle cx="12" cy="12" r="5"/>
              </svg>
              <span>Detección</span>
            </button>

            {/* Expedients Button */}
            <button
              onClick={() => setViewMode('expedients')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'expedients' ? '#007bff' : 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: viewMode === 'expedients' ? 'bold' : 'normal',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Document / Records Icon */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="11" x2="12" y2="17"/>
                <line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
              <span>Expedientes</span>
            </button>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Keyboard Shortcut Hint */}
            <span style={{
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.6)',
              padding: '6px 0',
              whiteSpace: 'nowrap',
            }}>
              Ctrl+E para cambiar
            </span>
          </div>

          {/* View Content - Detection Mode */}
          {viewMode === 'detection' && (
            <>
              <div className="flex-1 relative z-10 min-h-0 overflow-hidden p-2">
                <ErrorBoundary onError={(err) => console.error('UI crash: ' + err.message)}>
                  <MultiViewerGrid />
                </ErrorBoundary>
              </div>
              <SharedBottomBar />
            </>
          )}

          {/* View Content - Expedients Mode */}
          {viewMode === 'expedients' && (
            <div className="flex-1 relative z-10 min-h-0 overflow-hidden">
              <ErrorBoundary onError={(err) => console.error('UI crash: ' + err.message)}>
                <ExpedientListPage />
              </ErrorBoundary>
            </div>
          )}
        </div>

        <div id="right-sidebar-root" className="h-full z-40 shrink-0" />

        <div id="modal-root" />
      </div>
    </SentinelProvider>
  );
};
