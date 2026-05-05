import React, { useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MultiViewerGrid } from './components/MainViewer/MultiViewerGrid';
import { SharedBottomBar } from './components/SharedBar/SharedBottomBar';
import { ExpedientListPage } from './pages/ExpedientListPage';
import { isElectron, getServerPortFromElectron } from './utils/electronDetect';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { onViewChange } from './utils/eventBus';
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
    const commonPorts = [3002];
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    const portChecks = commonPorts.map((port) =>
      (async () => {
        try {
          const url = `${protocol}//${hostname}:${port}/api/health`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 800);

          const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            return { port, ok: true };
          }
          return { port, ok: false };
        } catch (e) {
          return { port, ok: false };
        }
      })()
    );

    const results = await Promise.all(portChecks);
    const found = results.find((r) => r.ok);

    if (found) {
      console.log(`[API_DISCOVERY] Backend found on port ${found.port}`);
      sessionStorage.setItem('sentinel_api_port', String(found.port));
      return found.port;
    }

    console.log('[API_DISCOVERY] Using default API configuration');
  } catch (error) {
    // Suppress error logging during discovery
  }
};

export const App = () => {
  const [realtimeReady, setRealtimeReady] = useState(false);
  useRealtimeSync(realtimeReady);

  const [viewMode, setViewMode] = useState<'detection' | 'expedients'>(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('view') as 'detection' | 'expedients') || 'detection';
  });

  useEffect(() => {
    // Discover backend port on app startup
    discoverBackendPort()
      .catch(() => null)
      .finally(() => setRealtimeReady(true));
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

  useEffect(() => {
    return onViewChange(setViewMode);
  }, []);

  return (
    <div className="h-screen w-screen bg-[#0a0a0c] text-slate-100 flex overflow-hidden font-sans select-none relative">
      <div
        id="sidebar-root"
        className={`h-full z-40 shrink-0 ${viewMode === 'detection' ? '' : 'hidden'}`}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#0a0a0c]">
        {viewMode === 'detection' ? (
          <div
            style={{
              display: 'flex',
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
        ) : (
          <div
            style={{
              display: 'flex',
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
        )}
      </div>

      <div
        id="right-sidebar-root"
        className={`h-full z-40 shrink-0 ${viewMode === 'detection' ? '' : 'hidden'}`}
      />

      <div id="modal-root" />
    </div>
  );
};
