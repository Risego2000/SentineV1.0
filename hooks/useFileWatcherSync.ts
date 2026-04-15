import { useState, useEffect, useCallback, useRef } from 'react';

interface FileWatcherStatus {
  active: boolean;
  watchedFolders: string[];
  pendingFiles: number;
  lastSync: Record<string, number>;
}

interface SyncResult {
  synced: number;
  failed: number;
  success?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

export function useFileWatcherSync(pollIntervalMs = 30000) {
  const [status, setStatus] = useState<FileWatcherStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/file-watcher/status`);
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setIsConnected(true);
        setError(null);
      } else {
        setIsConnected(false);
      }
    } catch {
      setIsConnected(false);
    }
  }, []);

  const triggerSync = useCallback(async (): Promise<SyncResult | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/file-watcher/sync`, {
        method: 'POST',
      });
      if (response.ok) {
        const result = await response.json();
        setLastSyncResult(result);
        await fetchStatus();
        return result;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed');
      return null;
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
    intervalRef.current = window.setInterval(fetchStatus, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchStatus, pollIntervalMs]);

  return {
    status,
    isConnected,
    lastSyncResult,
    error,
    triggerSync,
    refreshStatus: fetchStatus,
  };
}

export async function syncAllFilesToSupabase(): Promise<SyncResult> {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  try {
    const response = await fetch(`${API_BASE}/api/file-watcher/sync`, {
      method: 'POST',
    });
    if (response.ok) {
      return await response.json();
    }
    return { synced: 0, failed: 0, success: false };
  } catch {
    return { synced: 0, failed: 0, success: false };
  }
}

export async function getFileWatcherStatus(): Promise<FileWatcherStatus | null> {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3002';

  try {
    const response = await fetch(`${API_BASE}/api/file-watcher/status`);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}
