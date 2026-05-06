/**
 * Electron Detection Utility
 * Detects if the app is running in Electron context
 */

declare global {
  interface Window {
    electron?: {
      ipc: {
        on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void;
        invoke: (channel: string, payload?: any) => Promise<any>;
      };
      app: {
        getAppPath: (pathName: string) => Promise<string>;
        getVersion: () => Promise<string>;
        openDevTools: () => Promise<void>;
        checkUpdates: () => Promise<any>;
        downloadUpdate: () => Promise<any>;
        installUpdate: () => Promise<any>;
      };
      window: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<void>;
        close: () => Promise<void>;
      };
      file: {
        read: (filePath: string) => Promise<string>;
        write: (filePath: string, content: string) => Promise<boolean>;
        select: (options?: any) => Promise<string[]>;
        download: (url: string, filename: string) => Promise<string>;
      };
      api: {
        getServerPort: () => Promise<number>;
        health: () => Promise<boolean>;
        ready: () => Promise<{
          status: string;
          timestamp: string;
          services: {
            ffmpeg: boolean;
            python: boolean;
            paddleOcr: boolean;
          };
          port?: number;
          mode?: string;
          error?: string;
        }>;
      };
    };
  }
}

/**
 * Check if running in Electron
 */
export const isElectron = (): boolean => {
  return typeof window !== 'undefined' && window.electron !== undefined;
};

/**
 * Get Electron API
 */
export const getElectronAPI = () => {
  if (isElectron()) {
    return window.electron;
  }
  throw new Error('Not running in Electron context');
};

/**
 * Get server port from Electron IPC with retry logic
 */
export const getServerPortFromElectron = (): Promise<number> => {
  return new Promise((resolve) => {
    if (isElectron()) {
      const api = getElectronAPI();
      let resolved = false;

      // Listen immediately for async server-port event from main process.
      const unsubscribe = api.ipc.on('server-port', (_event, port) => {
        if (resolved) return;
        if (Number.isFinite(port)) {
          resolved = true;
          sessionStorage.setItem('sentinel_api_port', String(port));
          console.log(`[Electron] ✓ Server port received via event: ${port}`);
          unsubscribe();
          resolve(port);
        }
      });

      api.api
        .getServerPort()
        .then((port) => {
          if (resolved) return;
          if (Number.isFinite(port)) {
            resolved = true;
            sessionStorage.setItem('sentinel_api_port', String(port));
            console.log(`[Electron] ✓ Server port received via IPC: ${port}`);
            unsubscribe();
            resolve(port);
            return;
          }
          throw new Error(`Invalid server port: ${port}`);
        })
        .catch((error) => {
          if (resolved) return;
          console.warn('[Electron] Direct server port request failed, waiting for event:', error);
          waitForServerPortEvent((port) => {
            if (resolved) return;
            resolved = true;
            sessionStorage.setItem('sentinel_api_port', String(port));
            unsubscribe();
            resolve(port);
          });
        });
    } else {
      // Default to 3002 if not in Electron
      console.log('[Electron] Not running in Electron, using default port 3002');
      resolve(3002);
    }
  });
};

const waitForServerPortEvent = (resolve: (port: number) => void): void => {
  let attempts = 0;
  const maxAttempts = 3;
  let unsubscribe: (() => void) | null = null;

  const attemptConnection = () => {
    attempts++;
    console.log(`[Electron] Attempt ${attempts} to get server port...`);

    // Set timeout for this attempt
    const timeout = setTimeout(() => {
      if (unsubscribe) unsubscribe();

      if (attempts < maxAttempts) {
        console.warn(`[Electron] Attempt ${attempts} timeout, retrying...`);
        attemptConnection();
      } else {
        console.warn('[Electron] Max attempts reached, using default port 3002');
        resolve(3002);
      }
    }, 3000);

    // Listen for server-port event
    try {
      const api = getElectronAPI();
      unsubscribe = api.ipc.on('server-port', (event, port) => {
        clearTimeout(timeout);
        if (unsubscribe) unsubscribe();
        console.log(`[Electron] ✓ Server port received: ${port} (attempt ${attempts})`);
        resolve(port);
      });
    } catch (error) {
      clearTimeout(timeout);
      console.error('[Electron] Error setting up listener:', error);
      resolve(3002);
    }
  };

  attemptConnection();
};
