# SentinelV16 - Electron Development Guide

## Running in Electron (Development Mode)

### Prerequisites
- Node.js 18+ installed
- All npm dependencies installed (`npm install`)

### Start Electron Development Environment

```bash
# One-time setup: Compile Electron files
npm run build:electron

# Start Electron + Vite dev server in parallel
npm run electron
```

This will:
1. Start Vite dev server on `http://localhost:5173` (hot reload)
2. Start Electron main process, which initializes Express backend on a free port
3. Pass backend port to renderer via IPC

### Or Run Separately (for debugging)

**Terminal 1: Start Vite frontend**
```bash
npm run dev
```

**Terminal 2: Start Electron**
```bash
npm run dev:electron
```

**Terminal 3: (Optional) Start Express backend separately**
```bash
npm run dev:api
```

## Building for Distribution

```bash
# Build Vite + Electron + Package
npm run build

# Output: build/SentinelV16-Setup.exe (Windows)
```

## Architecture

### Electron Main Process
- File: `electron/main.ts` → compiled to `dist/electron/main.js`
- Responsibilities:
  - Create application window
  - Initialize Express backend
  - Handle IPC requests from renderer
  - Forward API calls to localhost Express server

### Electron Renderer (React)
- File: `App.tsx` and React components
- Capabilities:
  - Regular DOM manipulation via React
  - IPC calls via `window.electron.ipc.invoke()`
  - Cannot access Node.js directly (sandboxed)

### IPC Communication
- **Preload**: `electron/preload.ts` (secure bridge)
- **Exposed methods**:
  - `window.electron.ipc.invoke(channel, data)` - Call main process
  - `window.electron.app.getAppPath(pathName)` - Get app paths
  - `window.electron.window.*` - Window controls

### Services with IPC Support
- **OCRSynchronizer**: Detects Electron, uses IPC for `/api/ocr/*` endpoints
- **AIService**: Detects Electron, uses IPC for `/api/ai/*` endpoints
- Fallback to HTTP when not in Electron (web mode)

## Environment Variables

None required for basic development. In production:
- `GEMINI_API_KEY` - For Gemini AI analysis
- `SUPABASE_URL` - For Supabase auth
- `SUPABASE_ANON_KEY` - For Supabase client

## Troubleshooting

### "Cannot find module 'express'"
Run `npm install` to install dependencies.

### Preload permission denied
Ensure `electron/preload.ts` is correctly compiled to `dist/electron/preload.js`.

### IPC handler not found
Check that:
1. Handler is registered in `electron/main.ts` via `ipcMain.handle()`
2. Service calls `window.electron.ipc.invoke()` with correct channel name
3. Main process was recompiled (run `npm run build:electron`)

### Port conflicts
Electron assigns a free port automatically. If you need a specific port, modify `electron/main.ts`.

## Next Steps

1. **FASE 5**: Bundle FFmpeg and Python with Electron
2. **FASE 6**: Comprehensive testing (all features work in Electron)
3. **Distribution**: Build installers for Windows/macOS/Linux

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│        Electron Main Process                    │
│  ┌──────────────────────────────────────────┐  │
│  │ electron/main.ts                         │  │
│  ├──────────────────────────────────────────┤  │
│  │ - Window Management                      │  │
│  │ - Express Server (localhost:3002+)       │  │
│  │ - IPC Handler Registry                   │  │
│  └──────────────────────────────────────────┘  │
│           ↕ IPC Bridge (preload.ts)            │
└──────────────┬────────────────────────────────┘
               │
       ┌───────▼────────┐
       │ Renderer       │
       │ (React App)    │
       │ - App.tsx      │
       │ - Services     │
       │  (IPC aware)   │
       └────────────────┘
```

## References
- [Electron Docs](https://www.electronjs.org/docs)
- [IPC Communication](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Context Isolation & Preload](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
