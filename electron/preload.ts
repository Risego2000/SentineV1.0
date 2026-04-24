/**
 * Electron Preload Script
 * Safely exposes IPC API to renderer process via contextBridge
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Expose safe API to renderer
 */
contextBridge.exposeInMainWorld('electron', {
  // IPC invoke (main → renderer with reply)
  ipc: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, callback: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, callback);
      return () => ipcRenderer.off(channel, callback);
    },
    once: (channel: string, callback: (event: any, ...args: any[]) => void) => {
      ipcRenderer.once(channel, callback);
    },
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
  },

  // App APIs
  app: {
    getAppPath: (pathName: string) =>
      ipcRenderer.invoke('app:getPath', pathName),
    getVersion: () =>
      ipcRenderer.invoke('app:getVersion'),
    openDevTools: () =>
      ipcRenderer.invoke('app:openDevTools'),
  },

  // Window control APIs
  window: {
    minimize: () =>
      ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () =>
      ipcRenderer.invoke('window:toggleMaximize'),
    close: () =>
      ipcRenderer.invoke('window:close'),
  },
});

console.log('[Preload] Electron API exposed to renderer');
