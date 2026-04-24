# SentinelV16 Electron - Quick Start Guide

## ✅ Status
- Electron setup: COMPLETE
- Build system: COMPLETE  
- React integration: COMPLETE
- Backend integration: COMPLETE
- Testing suite: COMPLETE

## ⏳ What's Missing
- FFmpeg binary (~150 MB) - **Manual download required**
- Python runtime (~100 MB) - **Manual download required**
- PaddleOCR package - **Auto-installable once Python is ready**

## 🚀 Start Here (5 minutes)

### Option A: Automatic Installation (Recommended)
```bash
# This will guide you through downloads
npm run install:all
```

### Option B: Manual Installation

**Step 1: Download FFmpeg (5 min)**
```
1. https://github.com/BtbN/FFmpeg-Builds/releases
2. Download: ffmpeg-master-latest-win64-gpl.zip
3. Extract to: resources/ffmpeg/
4. Keep: ffmpeg.exe, ffprobe.exe
5. Delete: Everything else
```

**Step 2: Download Python (5 min)**
```
1. https://www.python.org/downloads/windows/
2. Find Python 3.10.13
3. Download: Windows embeddable package (64-bit)
4. Extract to: resources/python/
```

**Step 3: Install PaddleOCR (10 min)**
```bash
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

## ✔️ Verify Installation
```bash
npm run test:electron
```

Expected output:
```
✓ FFmpeg found
✓ Python found
✓ PaddleOCR installed
```

## 🎮 Run Application

**Development:**
```bash
npm run electron
```

**Production Build:**
```bash
npm run build
# Output: build/SentinelV16-Setup.exe
```

## 📋 Testing Checklist

Once running, verify:
- [ ] Window opens without errors
- [ ] React app loads (no red console errors)
- [ ] DevTools works (F12)
- [ ] Can upload video
- [ ] MediaPipe detects vehicles
- [ ] OCR extracts license plates correctly
- [ ] AI analysis generates infractions
- [ ] PDF reports generate

## 🐛 Troubleshooting

### "FFmpeg not found"
```bash
npm run download:ffmpeg
# OR manually place ffmpeg.exe, ffprobe.exe in resources/ffmpeg/
```

### "Python not found"
```bash
npm run download:python
# OR manually extract Python to resources/python/
```

### "PaddleOCR not installed"
```bash
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

### "window.electron is undefined"
```bash
npm run build:electron
npm run electron
```

## 📚 More Documentation

- `README_ELECTRON.md` - Complete guide
- `NEXT_STEPS.md` - Detailed walkthrough
- `PHASE6_TESTING.md` - Testing strategy

## ⏱️ Estimated Time

| Task | Time |
|------|------|
| Download FFmpeg | 5-10 min |
| Download Python | 5-10 min |
| Install PaddleOCR | 10-15 min |
| Test app | 5 min |
| Build production | 5 min |
| **Total** | **30-50 min** |

---

**You're ~95% done. Just download the files and install PaddleOCR!**
