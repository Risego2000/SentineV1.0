/**
 * Electron Preload Script
 * Safely exposes IPC API to renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

const EVENT_CHANNEL_ALLOWLIST = new Set(['server-port', 'updater:status']);

/**
 * Expose safe API to renderer
 */
contextBridge.exposeInMainWorld('electron', {
  // IPC events (strict allowlist)
  ipc: {
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
      if (!EVENT_CHANNEL_ALLOWLIST.has(channel)) {
        throw new Error(`IPC channel not allowed: ${channel}`);
      }
      ipcRenderer.on(channel, callback);
      return () => ipcRenderer.off(channel, callback);
    },
  },

  // App APIs
  app: {
    getAppPath: (pathName: string) => ipcRenderer.invoke('app:getPath', pathName),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
    checkUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
    downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
    installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  },

  // Window control APIs
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // File APIs
  file: {
    read: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    write: (filePath: string, content: string) =>
      ipcRenderer.invoke('file:write', filePath, content),
    select: (options?: any) => ipcRenderer.invoke('file:select', options),
    download: (url: string, filename: string) => ipcRenderer.invoke('file:download', url, filename),
  },

  // API health and ready checks
  api: {
    getServerPort: () => ipcRenderer.invoke('server:getPort'),
    health: () => ipcRenderer.invoke('api:health'),
    ready: () => ipcRenderer.invoke('api:ready'),
  },
});

console.log('[Preload] Electron API exposed to renderer');
