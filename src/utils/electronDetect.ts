/**
 * Electron Detection Utility
 * Detects if the app is running in Electron context
 */

declare global {
  interface Window {
    electron?: {
      ipc: {
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void;
        once: (channel: string, callback: (event: any, ...args: any[]) => void) => void;
        send: (channel: string, ...args: any[]) => void;
        removeAllListeners: (channel: string) => void;
      };
      app: {
        getAppPath: (pathName: string) => Promise<string>;
        getVersion: () => Promise<string>;
        openDevTools: () => Promise<void>;
      };
      window: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<void>;
        close: () => Promise<void>;
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
 * Get server port from Electron IPC
 */
export const getServerPortFromElectron = (): Promise<number> => {
  return new Promise((resolve) => {
    if (isElectron()) {
      // Listen for server-port event
      const unsubscribe = getElectronAPI().ipc.on('server-port', (event, port) => {
        unsubscribe();
        resolve(port);
      });
    } else {
      // Default to 3002 if not in Electron
      resolve(3002);
    }
  });
};
