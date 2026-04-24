# SentinelV16 Electron - Deployment Checklist

## Pre-Deployment (FASE 6)

### 1. Environment Validation
- [ ] Run: `npm run test:electron`
- [ ] All tests should pass except FFmpeg/Python (if not installed)
- [ ] No critical errors in logs

### 2. Resource Validation
```bash
# Check if resources are present
if exist resources\ffmpeg\ffmpeg.exe echo "FFmpeg OK" else echo "FFmpeg MISSING"
if exist resources\python\python.exe echo "Python OK" else echo "Python MISSING"
```

- [ ] FFmpeg exists at: `resources/ffmpeg/ffmpeg.exe`
- [ ] Python exists at: `resources/python/python.exe`
- [ ] PaddleOCR installed: `resources/python/Lib/site-packages/paddleocr/`

### 3. Compilation Check
```bash
npm run build:electron
```

- [ ] No TypeScript errors
- [ ] `dist/electron/main.js` exists and is valid
- [ ] `dist/electron/preload.js` exists and is valid

### 4. Development Test
```bash
npm run electron
```

**In the running app:**
- [ ] Window opens without freeze
- [ ] React components load visibly
- [ ] Console (F12) has no red errors
- [ ] Can interact with UI (buttons, inputs)
- [ ] Window controls work (minimize, maximize, close)

### 5. Functional Testing

#### 5.1 Video Upload & Detection
```
Expected: App handles video upload, displays in viewer
- [ ] Click upload button or drag-drop video
- [ ] Video appears in preview
- [ ] MediaPipe runs (may take 5-10 sec on first run)
- [ ] Green bounding boxes appear around vehicles
- [ ] Boxes track vehicles as video plays
```

#### 5.2 Frame Extraction
```
Expected: Frames extracted in 2688x1520 resolution
- [ ] Video processed frame-by-frame
- [ ] No console errors about extraction
- [ ] Performance acceptable (<100ms per frame)
```

#### 5.3 OCR Functionality
```
Expected: License plate extraction works via IPC
- [ ] Vehicle with visible plate in frame
- [ ] Console shows: "[IPC] ocr:extractPlate called"
- [ ] Plate extracted correctly (Spanish format: 1234ABC)
- [ ] No HTTP 404 errors in console
- [ ] Takes <1000ms to complete
```

#### 5.4 AI Analysis
```
Expected: Geometry and audit analysis works
- [ ] Create traffic line (geometry creation)
- [ ] Vehicle crosses line detected
- [ ] Console shows: "[IPC] api:ai:geometry called"
- [ ] Console shows: "[IPC] api:ai:audit called"
- [ ] Infraction type detected (GIRO_PROHIBIDO, etc.)
- [ ] Result saved to database
```

#### 5.5 PDF Generation
```
Expected: Boletín de denuncia generates and downloads
- [ ] Click "Generate Report" or equivalent
- [ ] PDF downloads (check Downloads folder)
- [ ] PDF opens correctly in reader
- [ ] Contains: Plate, timestamp, violation type, location
- [ ] Spanish text renders correctly
```

#### 5.6 Session Management
```
Expected: Multiple sessions work without conflict
- [ ] Upload video A, analyze
- [ ] Upload video B without closing A
- [ ] Both sessions independent
- [ ] Switch between sessions
- [ ] No memory leak (Task Manager: <500MB)
```

### 6. Performance Benchmarks

Run while app is active:

```
Metric              | Target    | Actual | Pass
--------------------|-----------|--------|------
Memory after 5 min  | <300 MB   | _____  | [ ]
Memory after 30 min | <500 MB   | _____  | [ ]
CPU average         | <20%      | _____  | [ ]
Frame rate (video)  | 30 FPS    | _____  | [ ]
OCR per image       | <1000ms   | _____  | [ ]
AI analysis         | <2000ms   | _____  | [ ]
Crash count         | 0         | _____  | [ ]
```

### 7. Production Build

```bash
npm run build
```

- [ ] Build completes without errors
- [ ] `build/SentinelV16-Setup.exe` created
- [ ] File size reasonable (~400-500 MB)
- [ ] No warnings about missing resources

### 8. Installer Testing (Final)

**On a clean Windows VM or separate computer:**

1. **Installation**
   ```
   [ ] Double-click SentinelV16-Setup.exe
   [ ] Installer starts
   [ ] License screen appears (if configured)
   [ ] Installation path dialog shows
   [ ] Installation completes without errors
   [ ] Desktop shortcut created
   [ ] Start Menu shortcut created
   ```

2. **Launch**
   ```
   [ ] Click desktop shortcut
   [ ] App launches within 3 seconds
   [ ] Window appears fully rendered
   [ ] No splash screen hang
   [ ] React app loads visibly
   ```

3. **Full Workflow**
   ```
   [ ] All functional tests pass (5.1-5.6)
   [ ] No dependency errors
   [ ] No "missing DLL" errors
   [ ] Performance acceptable
   ```

4. **Uninstallation**
   ```
   [ ] Control Panel → Programs → Uninstall
   [ ] SentinelV16 appears in list
   [ ] Uninstall completes cleanly
   [ ] Shortcuts removed
   [ ] No leftover files in Program Files
   ```

### 9. Regression Testing

Verify no regressions from web version:

- [ ] Video processing identical to web version
- [ ] OCR accuracy same or better
- [ ] Infraction detection matches web version
- [ ] PDF output identical
- [ ] Database storage works
- [ ] Supabase auth works (if configured)

### 10. Documentation Check

- [ ] README_ELECTRON.md is accurate
- [ ] QUICK_START.md reflects actual steps
- [ ] Troubleshooting section covers found issues
- [ ] System requirements documented
- [ ] Known limitations documented

## Sign-Off

**Deployment Ready:** [ ] YES / [ ] NO

**Blockers Found:**
```
1. ____________________
2. ____________________
3. ____________________
```

**Notes:**
```
____________________
____________________
____________________
```

**Tested By:** _______________
**Date:** _______________
**Build Version:** _______________

## Post-Deployment

### Monitoring
- [ ] Monitor user feedback
- [ ] Check crash reports (if telemetry enabled)
- [ ] Monitor performance metrics
- [ ] Log errors from users

### Hotfix Protocol
If issues found:
1. Identify root cause
2. Fix in source code
3. Run: `npm run build`
4. Release new version
5. Notify users

### Analytics
- [ ] Track feature usage
- [ ] Monitor performance metrics
- [ ] Collect user feedback
- [ ] Plan next release

---

**Version:** 1.0
**Last Updated:** 2026-04-24
**Status:** Ready for deployment
