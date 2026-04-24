@echo off
REM Master installation script for SentinelV16 Electron
REM Downloads and installs FFmpeg, Python, and PaddleOCR

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "FFMPEG_DIR=%SCRIPT_DIR%resources\ffmpeg"
set "PYTHON_DIR=%SCRIPT_DIR%resources\python"

echo.
echo =====================================================
echo  SentinelV16 Electron - Installation Guide
echo =====================================================
echo.

echo IMPORTANT: Manual Installation Required
echo.
echo Due to file size limits, these components must be
echo downloaded manually from official sources:
echo.

echo STEP 1: Download FFmpeg
echo -----------------------------------------------
echo 1. Visit: https://github.com/BtbN/FFmpeg-Builds/releases
echo 2. Download: ffmpeg-master-latest-win64-gpl.zip (approx 150 MB)
echo 3. Extract to: %FFMPEG_DIR%
echo 4. Keep: ffmpeg.exe, ffprobe.exe
echo 5. Delete: Documentation and other files
echo.

echo STEP 2: Download Python Embedded Edition
echo -----------------------------------------------
echo 1. Visit: https://www.python.org/downloads/windows/
echo 2. Find: Python 3.10.13
echo 3. Download: Windows embeddable package (64-bit) (approx 100 MB)
echo 4. Extract to: %PYTHON_DIR%
echo.

echo STEP 3: Install PaddleOCR
echo -----------------------------------------------
echo Once Python is extracted, run:
echo   %PYTHON_DIR%\python.exe -m pip install paddleocr paddlepaddle pillow
echo.
echo This may take 5-10 minutes and requires internet.
echo.

echo =====================================================
echo  Verification
echo =====================================================
echo.

if exist "%FFMPEG_DIR%\ffmpeg.exe" (
    echo [OK] FFmpeg is installed
) else (
    echo [!] FFmpeg not found
    echo    Expected path: %FFMPEG_DIR%\ffmpeg.exe
)

if exist "%PYTHON_DIR%\python.exe" (
    echo [OK] Python is installed

    if exist "%PYTHON_DIR%\Lib\site-packages\paddleocr" (
        echo [OK] PaddleOCR is installed
    ) else (
        echo [!] PaddleOCR not installed
        echo    Run: %PYTHON_DIR%\python.exe -m pip install paddleocr
    )
) else (
    echo [!] Python not found
    echo    Expected path: %PYTHON_DIR%\python.exe
)

echo.
echo =====================================================
echo  Next Steps
echo =====================================================
echo.
echo Once FFmpeg, Python, and PaddleOCR are installed:
echo.
echo 1. Test in development:
echo    npm run electron
echo.
echo 2. Build production:
echo    npm run build
echo.
echo For detailed instructions, see: README_ELECTRON.md
echo.

pause
