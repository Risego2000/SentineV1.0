/**
 * Electron Main Process
 * Manages application window, backend server lifecycle, and IPC communication
 */

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeExpressServer } from '../server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let expressServer: any = null;

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
  });

  // Load renderer
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from bundled files
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Initialize Express server
 */
async function initializeServer() {
  try {
    const config = {
      port: 0, // Let OS assign a free port
      appPath: app.getAppPath(),
      isDev: process.env.NODE_ENV === 'development',
    };

    expressServer = await initializeExpressServer(config);

    // Get the actual port the server is listening on
    const serverAddress = expressServer.address();
    const serverPort = typeof serverAddress === 'string'
      ? 3002
      : (serverAddress?.port || 3002);

    console.log(`[Electron] Express server started on port ${serverPort}`);

    // Send port to renderer via IPC after it's ready
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-port', serverPort);
    }

    return serverPort;
  } catch (error) {
    console.error('[Electron] Failed to initialize Express server:', error);
    throw error;
  }
}

/**
 * App ready - create window and initialize server
 */
app.on('ready', async () => {
  try {
    // Initialize server first
    const serverPort = await initializeServer();

    // Then create window
    createWindow();

    // Send port to renderer once window is ready
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server-port', serverPort);
    }
  } catch (error) {
    console.error('[Electron] Fatal error during app startup:', error);
    app.quit();
  }
});

/**
 * Quit when all windows are closed (except on macOS)
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Shutdown Express server before quitting
    if (expressServer) {
      expressServer.close(() => {
        console.log('[Electron] Express server closed');
      });
    }
    app.quit();
  }
});

/**
 * Re-create window when app is activated (macOS)
 */
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

/**
 * Graceful shutdown on app quit
 */
app.on('before-quit', (event) => {
  if (expressServer) {
    event.preventDefault();
    expressServer.close(() => {
      console.log('[Electron] Express server closed, quitting app');
      app.quit();
    });
  }
});

// ============= IPC HANDLERS =============

/**
 * IPC: Get app path (for resources)
 */
ipcMain.handle('app:getPath', (event, pathName) => {
  const validPaths = ['home', 'appData', 'userData', 'temp', 'exe', 'module', 'desktop', 'documents', 'downloads', 'music', 'pictures', 'videos', 'recent', 'logs'];
  if (validPaths.includes(pathName)) {
    return app.getPath(pathName as any);
  }
  throw new Error(`Invalid path: ${pathName}`);
});

/**
 * IPC: Get app version
 */
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

/**
 * IPC: Open DevTools (debug)
 */
ipcMain.handle('app:openDevTools', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.openDevTools();
  }
});

/**
 * IPC: Minimize window
 */
ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

/**
 * IPC: Maximize/restore window
 */
ipcMain.handle('window:toggleMaximize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  }
});

/**
 * IPC: Close window
 */
ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.close();
  }
});

// ============= API HANDLERS (Forward to Express Backend) =============

/**
 * IPC: Extract license plate via OCR
 */
ipcMain.handle('ocr:extractPlate', async (event, { images }) => {
  try {
    const serverAddress = expressServer.address();
    const serverPort = typeof serverAddress === 'string'
      ? 3002
      : (serverAddress?.port || 3002);

    const response = await fetch(`http://localhost:${serverPort}/api/ocr/plate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[IPC] Error in ocr:extractPlate:', error);
    throw error;
  }
});

/**
 * IPC: Extract timestamp from OSD
 */
ipcMain.handle('ocr:extractTimestamp', async (event, { image }) => {
  try {
    const serverAddress = expressServer.address();
    const serverPort = typeof serverAddress === 'string'
      ? 3002
      : (serverAddress?.port || 3002);

    const response = await fetch(`http://localhost:${serverPort}/api/ocr/timestamp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[IPC] Error in ocr:extractTimestamp:', error);
    throw error;
  }
});

/**
 * IPC: Generate geometry (AI service)
 */
ipcMain.handle('api:ai:geometry', async (event, payload) => {
  try {
    const serverAddress = expressServer.address();
    const serverPort = typeof serverAddress === 'string'
      ? 3002
      : (serverAddress?.port || 3002);

    const response = await fetch(`http://localhost:${serverPort}/api/ai/geometry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[IPC] Error in api:ai:geometry:', error);
    throw error;
  }
});

/**
 * IPC: Analyze trajectory (AI service)
 */
ipcMain.handle('api:ai:audit', async (event, payload) => {
  try {
    const serverAddress = expressServer.address();
    const serverPort = typeof serverAddress === 'string'
      ? 3002
      : (serverAddress?.port || 3002);

    const response = await fetch(`http://localhost:${serverPort}/api/ai/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[IPC] Error in api:ai:audit:', error);
    throw error;
  }
});

console.log('[Electron] Main process initialized');
