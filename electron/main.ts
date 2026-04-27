/**
 * Electron Main Process
 * Manages application window, backend server lifecycle, and IPC communication
 */

import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

// Note: __dirname is automatically available in CommonJS (when compiled to .cjs)
// In Electron context, it will point to the app's directory

let mainWindow: BrowserWindow | null = null;
let expressServer: any = null;

/**
 * Create the main application window
 */
function createWindow(serverPort?: number) {
  // Get app path for reliable path resolution in Electron
  const appPath = app.getAppPath();

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(appPath, 'dist/electron/preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(appPath, 'assets/icon.png'),
  });

  // Load renderer
  // Assume development unless explicitly in production mode
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // In development, load from Vite dev server
    console.log('[Electron] Loading from Vite dev server on http://127.0.0.1:5173');
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from bundled files
    console.log('[Electron] Loading from bundled files');
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));
  }

  // Send port after renderer is ready (not after loadURL)
  mainWindow.webContents.on('did-finish-load', () => {
    if (serverPort) {
      mainWindow!.webContents.send('server-port', serverPort);
      console.log(`[Electron] Sent server-port ${serverPort} to renderer`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Configure paths for bundled resources (FFmpeg, Python)
 */
function configureResourcePaths() {
  const appPath = app.getAppPath();
  const resourcesPath = path.join(appPath, 'resources');

  // Configure FFmpeg path
  const ffmpegPath = path.join(
    resourcesPath,
    'ffmpeg',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  );
  if (fs.existsSync(ffmpegPath)) {
    process.env.FFMPEG_PATH = ffmpegPath;
    console.log(`[Electron] ✓ FFmpeg found: ${ffmpegPath}`);
  } else {
    console.warn(`[Electron] ✗ FFmpeg not found at: ${ffmpegPath}`);
  }

  // Configure Python path
  const pythonPath = path.join(
    resourcesPath,
    'python',
    process.platform === 'win32' ? 'python.exe' : path.join('bin', 'python')
  );
  if (fs.existsSync(pythonPath)) {
    process.env.PYTHON_PATH = pythonPath;
    console.log(`[Electron] ✓ Python found: ${pythonPath}`);
  } else {
    console.warn(`[Electron] ✗ Python not found at: ${pythonPath}`);
  }

  // Configure PaddleOCR models path (inside Python site-packages)
  const paddleOcrPath = path.join(
    resourcesPath,
    'python',
    process.platform === 'win32' ? 'Lib\\site-packages' : 'lib/python3.11/site-packages'
  );

  // PaddleOCR will create .paddleocr directory in HOME, but we can guide it
  const userDataPath = app.getPath('userData');
  const paddleOcrHome = path.join(userDataPath, '.paddleocr');

  process.env.PADDLEOCR_HOME = paddleOcrHome;
  console.log(`[Electron] PaddleOCR models will be cached at: ${paddleOcrHome}`);

  // Verify Python site-packages exists
  if (fs.existsSync(paddleOcrPath)) {
    console.log(`[Electron] ✓ Python site-packages found: ${paddleOcrPath}`);
  } else {
    console.warn(`[Electron] ✗ Python site-packages not found at: ${paddleOcrPath}`);
  }
}

/**
 * Initialize Express server
 */
async function initializeServer() {
  try {
    // Configure resource paths before starting server
    configureResourcePaths();

    // PHASE 4: Pass environment variables to backend
    const appPath = app.getAppPath();
    const isDev = !app.isPackaged; // Use Electron's isPackaged for dev/prod distinction
    const resourcesPath = path.join(appPath, 'resources');

    // Set environment variables for backend server
    process.env.IS_ELECTRON = 'true';
    process.env.NODE_ENV = isDev ? 'development' : 'production';
    process.env.RESOURCES_PATH = resourcesPath;
    process.env.PORT = process.env.PORT || '3002';

    console.log(`[Electron] Environment: ${process.env.NODE_ENV}`);
    console.log(`[Electron] isPackaged: ${app.isPackaged}`);
    console.log(`[Electron] Resources path: ${resourcesPath}`);

    // Load server module using require (CommonJS)
    const serverPath = path.join(appPath, 'dist/server.cjs');
    const { initializeExpressServer } = require(serverPath);

    const config = {
      port: 0, // Let OS assign a free port
      appPath: app.getAppPath(),
      isDev: isDev,
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
    console.log(`[Electron] Server initialized on port ${serverPort}`);

    // Then create window with server port
    createWindow(serverPort);
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
 * Helper: Get actual server port
 */
function getServerPort(): number {
  const port = parseInt(process.env.SENTINEL_SERVER_PORT || '3002');
  return isNaN(port) ? 3002 : port;
}

/**
 * Helper: Fetch with timeout
 * Timeouts are configured based on operation type:
 * - Transcode: 10 minutes (long operations)
 * - OCR: 30 seconds (moderately fast)
 * - AI: 20 seconds (complex but faster)
 * - Health: 5 seconds (simple check)
 */
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * IPC: Extract license plate via OCR
 */
ipcMain.handle('ocr:extractPlate', async (event, { images }) => {
  try {
    const serverPort = getServerPort();
    const url = `http://127.0.0.1:${serverPort}/api/ocr/plate`;

    console.log(`[IPC] ocr:extractPlate → ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images }),
      timeout: 30000, // OCR can be slow
    });

    if (!response.ok) {
      const error = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`API error: ${error}`);
    }

    const result = await response.json();
    console.log(`[IPC] ocr:extractPlate ✓`);
    return result;
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
    const serverPort = getServerPort();
    const url = `http://127.0.0.1:${serverPort}/api/ocr/timestamp`;

    console.log(`[IPC] ocr:extractTimestamp → ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
      timeout: 15000,
    });

    if (!response.ok) {
      const error = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`API error: ${error}`);
    }

    const result = await response.json();
    console.log(`[IPC] ocr:extractTimestamp ✓`);
    return result;
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
    const serverPort = getServerPort();
    const url = `http://127.0.0.1:${serverPort}/api/ai/geometry`;

    console.log(`[IPC] api:ai:geometry → ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 20000, // AI can take time
    });

    if (!response.ok) {
      const error = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`API error: ${error}`);
    }

    const result = await response.json();
    console.log(`[IPC] api:ai:geometry ✓`);
    return result;
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
    const serverPort = getServerPort();
    const url = `http://127.0.0.1:${serverPort}/api/ai/audit`;

    console.log(`[IPC] api:ai:audit → ${url}`);

    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 20000, // AI can take time
    });

    if (!response.ok) {
      const error = await response.text().catch(() => `HTTP ${response.status}`);
      throw new Error(`API error: ${error}`);
    }

    const result = await response.json();
    console.log(`[IPC] api:ai:audit ✓`);
    return result;
  } catch (error) {
    console.error('[IPC] Error in api:ai:audit:', error);
    throw error;
  }
});

/**
 * IPC: Health check
 */
ipcMain.handle('api:health', async () => {
  try {
    const serverPort = getServerPort();
    const url = `http://127.0.0.1:${serverPort}/api/health`;

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      timeout: 5000,
    });

    const isHealthy = response.ok;
    console.log(`[IPC] api:health: ${isHealthy ? '✓' : '✗'}`);
    return isHealthy;
  } catch (error) {
    console.error('[IPC] Health check failed:', error);
    return false;
  }
});

/**
 * IPC: Ready check (includes service status)
 */
ipcMain.handle('api:ready', async () => {
  try {
    const serverPort = getServerPort();
    const url = `http://127.0.0.1:${serverPort}/api/ready`;

    const response = await fetchWithTimeout(url, {
      method: 'GET',
      timeout: 5000,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[IPC] api:ready: ${result.status}`);
    return result;
  } catch (error) {
    console.error('[IPC] Ready check failed:', error);
    return {
      status: 'not_ready',
      error: error instanceof Error ? error.message : 'Unknown error',
      services: {
        ffmpeg: false,
        python: false,
        paddleOcr: false,
      },
    };
  }
});

/**
 * IPC: Read file
 */
ipcMain.handle('file:read', async (event, filePath) => {
  try {
    // Security: only allow reading files within app directory
    const appPath = app.getAppPath();
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(appPath)) {
      throw new Error('Access denied: file is outside app directory');
    }

    return fs.readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    console.error('[IPC] Error reading file:', error);
    throw error;
  }
});

/**
 * IPC: Write file
 */
ipcMain.handle('file:write', async (event, filePath, content) => {
  try {
    // Security: only allow writing to userData directory
    const userDataPath = app.getPath('userData');
    const resolvedPath = path.resolve(filePath);

    if (!resolvedPath.startsWith(userDataPath)) {
      throw new Error('Access denied: can only write to userData directory');
    }

    // Create directory if it doesn't exist
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('[IPC] Error writing file:', error);
    throw error;
  }
});

/**
 * IPC: Select file dialog
 */
ipcMain.handle('file:select', async (event, options = {}) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      throw new Error('Main window not available');
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      ...options,
    });

    return result.filePaths;
  } catch (error) {
    console.error('[IPC] Error selecting file:', error);
    throw error;
  }
});

/**
 * IPC: Download file
 */
ipcMain.handle('file:download', async (event, url, filename) => {
  try {
    const downloadsPath = app.getPath('downloads');
    const filePath = path.join(downloadsPath, filename);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    console.log(`[IPC] File downloaded: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('[IPC] Error downloading file:', error);
    throw error;
  }
});

console.log('[Electron] Main process initialized');
