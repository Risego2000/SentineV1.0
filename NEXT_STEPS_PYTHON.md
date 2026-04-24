# ✓ FFmpeg Installed - Next Steps for Python

## Current Status

```
✓ FASE 1-4: Electron implementation - COMPLETE
✓ FASE 5a: FFmpeg download - COMPLETE (150 MB installed)
⏳ FASE 5b: Python download - MANUAL STEP REQUIRED
⏳ FASE 5c: PaddleOCR setup - AUTO (after Python)
⏳ FASE 6: Testing & validation - READY
```

---

## Quick Start (Choose One Option)

### Option 1: Auto Download + Install (Recommended)

```bash
# Only works if python.org is accessible from your network
npm run download:python
npm run install:paddleocr
npm run test:electron
npm run electron
```

**Status**: ⚠️ python.org may be blocked or URLs may have changed
**If this fails**, proceed to Option 2

---

### Option 2: Manual Download (Most Reliable)

1. **Download Python**
   - Visit: https://www.python.org/downloads/windows/
   - Find "Python 3.10.x" section
   - Download: `Windows embeddable package (64-bit)` 
   - Should be ~50-60 MB

2. **Extract Python**
   ```bash
   # Create folder
   mkdir resources\python
   
   # Extract downloaded zip into resources\python\
   # You should see python.exe in: resources\python\python.exe
   ```

3. **Install PaddleOCR**
   ```bash
   resources\python\python.exe -m pip install paddleocr paddlepaddle pillow
   ```
   
   ⏱️ This takes 10-15 minutes (downloads ~200 MB of model files)

4. **Verify Everything**
   ```bash
   npm run test:electron
   ```

5. **Run the App**
   ```bash
   npm run electron
   ```

---

### Option 3: Alternative Python Source

If python.org is unreachable:

1. Go to: https://github.com/indygreg/python-build-standalone/releases
2. Find "cpython-3.10.x" (64-bit Windows) latest release
3. Download the "_install_only" variant
4. Extract to `resources\python\`

---

## Detailed Step-by-Step

See: **setup-manual.md** for detailed instructions with screenshots

---

## What Each Step Does

| Step | Action | Time | Output |
|------|--------|------|--------|
| 1 | Download Python 3.10 | 5 min | `python.exe` in `resources/python/` |
| 2 | Extract to folder | 1 min | Folder with Python files |
| 3 | Install PaddleOCR | 10-15 min | PaddleOCR + models installed |
| 4 | Test everything | 2 min | 19/19 tests passing |
| 5 | Run application | - | Electron app opens |
| 6 | Build installer | 5 min | `build/SentinelV16-Setup.exe` |

**Total Time**: ~30-45 minutes

---

## Verification at Each Step

### After Python Download
```bash
resources\python\python.exe --version
# Expected: Python 3.10.x
```

### After PaddleOCR Install
```bash
resources\python\python.exe -c "import paddleocr; print('PaddleOCR installed')"
# Expected: PaddleOCR installed
```

### After Everything
```bash
npm run test:electron
# Expected: ✓ All 19 tests passing
```

---

## Troubleshooting

### "Cannot download Python" (Option 1 failed)
→ Use Option 2 (Manual) or Option 3 (Alternative source)

### "Python not found" after extraction
→ Verify: `resources\python\python.exe` exists
→ If missing, extract Python zip again more carefully

### "PaddleOCR install fails"
→ Make sure Python is in `resources\python\`
→ Check network connection (downloads ~200 MB)
→ If pip times out, try: 
```bash
resources\python\python.exe -m pip install --index-url https://pypi.org/simple/ paddleocr
```

### "test:electron still shows Python missing"
→ Run: `npm run test:electron` again
→ If still fails, verify `resources\python\python.exe` exists

---

## Once Everything is Ready

```bash
# Test the app works
npm run test:electron

# Run in development mode
npm run electron

# Build production installer
npm run build

# Output: build/SentinelV16-Setup.exe (ready to distribute!)
```

---

## Summary

You're 95% done! ✓

**Just need to:**
1. ⏳ Download Python (5-10 min)
2. ⏳ Install PaddleOCR (10-15 min)
3. ✓ Everything else is ready!

Then you can test the full app and build the installer for distribution.

---

**Follow**: setup-manual.md for detailed step-by-step guide
