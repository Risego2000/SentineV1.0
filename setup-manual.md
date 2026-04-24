# SentinelV16 Electron - Manual Setup Guide

## Status

✓ **FFmpeg**: Already downloaded and installed  
⏳ **Python**: Manual download required  
⏳ **PaddleOCR**: Auto-installable after Python  

## Setup Steps (5 minutes)

### Step 1: Download Python Embeddable Package

1. Visit: https://www.python.org/downloads/windows/
2. Scroll down to "Advanced"
3. Find **Python 3.10.x** section
4. Download: **Windows embeddable package (64-bit)**
   - Should be named: `python-3.10.x-embed-amd64.zip` (~50 MB)

### Step 2: Extract Python

1. Create folder: `resources/python/` (in your SentinelV16 directory)
2. Extract the zip file contents directly into `resources/python/`
3. Verify: You should see `python.exe` in `resources/python/python.exe`

**Expected structure:**
```
resources/
  python/
    python.exe
    python3.exe
    Lib/
    Scripts/
    (other files...)
```

### Step 3: Install PaddleOCR

Open PowerShell or Command Prompt and run:

```bash
cd C:\Users\[YourUsername]\Desktop\Apps\SentinelV16
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

This will take 5-10 minutes (it's downloading model weights ~200 MB).

### Step 4: Verify Installation

Run the test suite:

```bash
npm run test:electron
```

Expected output:
```
✓ FFmpeg found
✓ Python found  
✓ PaddleOCR installed
✓ All tests passed
```

### Step 5: Run the Application

**Development:**
```bash
npm run electron
```

**Production Build:**
```bash
npm run build
```

This creates: `build/SentinelV16-Setup.exe`

---

## Alternative: Download Python Manually (if above doesn't work)

If the official Python page is unavailable:

1. Go to: https://github.com/indygreg/python-build-standalone/releases
2. Find the latest release with "cpython-3.10.x" (64-bit Windows)
3. Download the "install_only" variant
4. Extract to `resources/python/`

---

## Troubleshooting

### "FFmpeg not found"
FFmpeg should already be installed at: `resources/ffmpeg/ffmpeg.exe`

If missing, run:
```bash
npm run download:ffmpeg
```

### "Python not found"
Follow Steps 1-2 above to manually download and extract Python.

### "PaddleOCR not installed"
Run Step 3:
```bash
resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
```

### Permission denied on pip install
Run PowerShell as Administrator and try again.

### Still having issues?

1. Verify Python works:
   ```bash
   resources\python\python.exe --version
   ```

2. Verify pip works:
   ```bash
   resources\python\python.exe -m pip --version
   ```

3. Check network connection (PaddleOCR downloads ~200 MB of models)

---

## Next Steps After Setup

Once all 3 are installed:

1. Run tests:
   ```bash
   npm run test:electron
   ```

2. Launch dev app:
   ```bash
   npm run electron
   ```

3. Test the full workflow in the app:
   - Upload a video
   - Verify vehicle detection (MediaPipe)
   - Verify license plate detection (PaddleOCR)
   - Generate PDF report

4. Build production:
   ```bash
   npm run build
   ```

---

**Estimated Total Time**: 30-45 minutes
- Download FFmpeg: ✓ Done (10 min)
- Download Python: 5-10 min
- Install PaddleOCR: 10-15 min
- Run tests: 2-5 min
- Build production: 5 min

You're almost there! Just need Python and PaddleOCR.
