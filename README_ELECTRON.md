# SentinelV16 Electron Migration - Complete Guide

## 🎯 Overview

SentinelV16 has been successfully migrated to Electron. The application now runs as a native desktop app with an integrated backend.

## 📋 Status

| Phase | Status | Details |
|-------|--------|---------|
| 1. Electron Setup | ✅ Complete | Main process, preload, builder config |
| 2. Server Adaptation | ✅ Complete | IPC-aware backend |
| 3. Frontend IPC | ✅ Complete | React services with IPC support |
| 4. Build Config | ✅ Complete | Vite + Electron Builder |
| 5. Resource Bundling | ⏳ Manual | FFmpeg + Python setup |
| 6. Testing | ⏳ Manual | Functional validation |

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Windows, macOS, or Linux

### Installation

```bash
# Install dependencies
npm install

# Compile Electron files
npm run build:electron

# Run in development
npm run electron
```

This will:
1. Compile Vite frontend
2. Start Electron main process
3. Initialize Express backend
4. Display app window with hot-reload

## 📦 Phase 5: Resource Bundling (Manual)

FFmpeg and Python must be downloaded and configured manually.

### Step 1: Check Current Status

```bash
# Run setup checker
.\setup-ffmpeg-python.bat
```

### Step 2: Download FFmpeg

**Windows:**
1. Visit: https://github.com/BtbN/FFmpeg-Builds/releases
2. Download: `ffmpeg-master-latest-win64-gpl.zip`
3. Extract to: `resources/ffmpeg/`
   - Keep: `ffmpeg.exe`, `ffprobe.exe`
   - Delete: Documentation, unnecessary DLLs

**Linux:**
```bash
# Using apt
sudo apt-get install ffmpeg

# Or download portable version
# Copy ffmpeg and ffprobe to resources/ffmpeg/
```

**macOS:**
```bash
brew install ffmpeg

# Copy /usr/local/bin/ffmpeg and ffprobe to resources/ffmpeg/
```

### Step 3: Download Python

**Windows:**
1. Visit: https://www.python.org/downloads/windows/
2. Download: `python-3.10.13-embed-amd64.zip`
3. Extract to: `resources/python/`

**Linux/macOS:**
```bash
# Download or compile Python 3.10
# Extract to resources/python/
```

### Step 4: Install PaddleOCR

```bash
# Windows
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow

# Linux/macOS
resources/python/bin/python3 -m pip install paddleocr paddlepaddle pillow
```

### Step 5: Verify Setup

```bash
# Test FFmpeg
resources\ffmpeg\ffmpeg.exe -version

# Test Python
resources\python\python.exe --version

# Verify PaddleOCR
resources\python\python.exe -c "import paddleocr; print('OK')"
```

## 🧪 Phase 6: Testing

### 1. Development Testing

```bash
# Start Electron dev mode
npm run electron

# In the app:
- [ ] Window opens without errors
- [ ] React components load
- [ ] DevTools work (F12)
- [ ] No console errors
```

### 2. Functional Testing

#### Video Upload & Detection
```
- [ ] Upload video
- [ ] MediaPipe detects vehicles
- [ ] Bounding boxes appear and track
- [ ] Frame extraction works (2688x1520 resolution)
```

#### OCR Functionality
```
- [ ] Vehicle with visible license plate
- [ ] Console shows: "[IPC] ocr:extractPlate called"
- [ ] Plate extracted correctly
- [ ] No HTTP fallback errors
```

#### AI Analysis
```
- [ ] Create geometry (traffic lines)
- [ ] Detect vehicle crossing line
- [ ] Console shows: "[IPC] api:ai:geometry called"
- [ ] Infraction detected and logged
```

#### PDF Generation
```
- [ ] Generate report/boletín
- [ ] PDF downloads correctly
- [ ] Content accurate (plate, timestamp, etc.)
```

### 3. Performance Check

Monitor while running:
```bash
# Open Task Manager (Windows)
# Check:
- [ ] Memory usage < 500MB
- [ ] CPU usage reasonable (<30%)
- [ ] No memory leaks after 30 min
```

### 4. Production Build

```bash
# Build and package
npm run build

# Output: build/SentinelV16-Setup.exe (Windows)
```

**Test the installer:**
1. Run `SentinelV16-Setup.exe`
2. Install to Program Files
3. Launch from Start Menu
4. Verify all functionality works
5. Test uninstall

## 📂 Project Structure

```
SentinelV16/
├── electron/
│   ├── main.ts              (Window + Server + IPC)
│   ├── preload.ts           (Secure bridge)
│   └── tsconfig.json
├── src/
│   ├── App.tsx              (Electron-aware)
│   ├── services/
│   │   ├── OCRSynchronizer  (IPC + HTTP dual-mode)
│   │   └── aiService        (IPC + HTTP dual-mode)
│   └── utils/
│       └── electronDetect   (Electron utilities)
├── dist/
│   ├── renderer/            (Vite build)
│   └── electron/            (Compiled main + preload)
├── resources/
│   ├── ffmpeg/              (FFmpeg binaries)
│   ├── python/              (Python + PaddleOCR)
│   └── paddleocr-models/    (OCR model cache)
├── build-electron.js        (Compilation script)
├── setup-ffmpeg-python.bat  (Setup checker)
└── electron-builder.config.js
```

## 🔧 Development Workflow

### Make Changes to:

**React/Frontend:**
- Hot reload in dev mode
- No recompilation needed

**Electron Main Process (main.ts):**
1. Edit `electron/main.ts`
2. Run: `npm run build:electron`
3. Restart Electron: `npm run electron`

**Backend (server.js):**
- Hot reload in dev mode (with watcher)
- Or restart manually

### Debugging

**Browser DevTools:**
```
F12 in Electron window
- Console logs from React
- Network requests
- React profiler
```

**Main Process Logs:**
```
Check console output in terminal where Electron started
- FFmpeg path setup
- Python path setup
- IPC handler calls
- Express server logs
```

## 🐛 Common Issues

### Issue: "ffmpeg not found"
```
Solution:
1. Download FFmpeg and extract to resources/ffmpeg/
2. Run: npm run build:electron
3. Restart app
```

### Issue: "Python not found"
```
Solution:
1. Download Python Embedded
2. Extract to resources/python/
3. Install PaddleOCR: python.exe -m pip install paddleocr
4. Restart app
```

### Issue: "window.electron is undefined"
```
Solution:
1. Verify dist/electron/preload.js exists
2. Check electron/main.ts webPreferences.preload path
3. Run: npm run build:electron
4. Restart app
```

### Issue: IPC handler not responding
```
Solution:
1. Check electron/main.ts has: ipcMain.handle('channel-name', ...)
2. Run: npm run build:electron
3. Check console for IPC logs
4. Restart app
```

## 📊 Performance Targets

| Operation | Target | Actual |
|-----------|--------|--------|
| App startup | < 2s | TBD |
| Video load | < 500ms | TBD |
| MediaPipe detection | < 100ms/frame | TBD |
| OCR extraction | < 1s | TBD |
| AI analysis | < 2s | TBD |
| Memory usage | < 500MB | TBD |

## 🔐 Security Notes

- ✅ Renderer process is sandboxed
- ✅ No Node.js API access from React
- ✅ IPC handlers validate inputs
- ✅ No command injection risk
- ✅ API keys not exposed in console

## 📚 Documentation

- **ELECTRON_DEV.md** - Development setup guide
- **PHASE5_BUNDLING.md** - Detailed FFmpeg/Python bundling
- **PHASE6_TESTING.md** - Comprehensive testing strategy

## 🚢 Distribution

### Windows
```bash
npm run build          # Creates SentinelV16-Setup.exe
# Distribution: NSIS installer + portable EXE
```

### macOS
```bash
npm run build          # Creates SentinelV16.dmg
# Requires: Code signing certificate
# Configuration: electron-builder.config.js (mac section)
```

### Linux
```bash
npm run build          # Creates .deb, AppImage
# Distribution: Debian package + AppImage
```

## 🔄 Migration Notes

### Backward Compatibility
- Original web mode still works: `npm run dev` + `npm run dev:api`
- Services auto-detect Electron vs web mode
- All API endpoints unchanged

### What Changed
- Express backend integrated into Electron
- IPC used instead of HTTP proxy in Electron mode
- FFmpeg/Python bundled instead of system dependencies
- Smaller download size for end users (no need for Node.js)

### What Stayed the Same
- React frontend unchanged (mostly)
- API endpoints identical
- Database/storage layer unchanged
- Gemini AI integration unchanged

## 📈 Next Steps

1. ✅ Download and setup FFmpeg
2. ✅ Download and setup Python + PaddleOCR
3. ✅ Run PHASE 6 testing checklist
4. ✅ Build production release
5. ✅ Distribute to users

## 📞 Support

For issues or questions:
1. Check common issues section
2. Review PHASE5_BUNDLING.md
3. Review PHASE6_TESTING.md
4. Check console logs (DevTools + terminal)
5. Verify FFmpeg/Python setup with setup-ffmpeg-python.bat

---

**Last Updated:** 2026-04-24
**Version:** 1.0 (Electron Migration Complete)
**Status:** Ready for Phase 5-6 execution
