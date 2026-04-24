@echo off
REM Setup Script for FFmpeg and Python in SentinelV16
REM Usage: setup-ffmpeg-python.bat

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "RESOURCES_DIR=%SCRIPT_DIR%resources"
set "FFMPEG_DIR=%RESOURCES_DIR%\ffmpeg"
set "PYTHON_DIR=%RESOURCES_DIR%\python"

echo.
echo SentinelV16 - FFmpeg and Python Setup Script
echo ============================================================
echo.

REM Check FFmpeg
echo Checking FFmpeg...
if exist "%FFMPEG_DIR%\ffmpeg.exe" (
    echo [OK] ffmpeg.exe found
) else (
    echo [!] FFmpeg not found in: %FFMPEG_DIR%
    echo.
    echo Download FFmpeg from:
    echo   - https://github.com/BtbN/FFmpeg-Builds/releases
    echo   - Download: ffmpeg-master-latest-win64-gpl.zip
    echo   - Extract to: %FFMPEG_DIR%
    echo.
)

REM Check Python
echo.
echo Checking Python...
if exist "%PYTHON_DIR%\python.exe" (
    echo [OK] python.exe found

    if exist "%PYTHON_DIR%\Lib\site-packages\paddleocr" (
        echo [OK] PaddleOCR installed
    ) else (
        echo [!] PaddleOCR not installed
        echo.
        echo Install with:
        echo   %PYTHON_DIR%\python.exe -m pip install paddleocr paddlepaddle pillow
        echo.
    )
) else (
    echo [!] Python not found in: %PYTHON_DIR%
    echo.
    echo Download Python Embedded from:
    echo   - https://www.python.org/downloads/windows/
    echo   - Download: python-3.10.13-embed-amd64.zip
    echo   - Extract to: %PYTHON_DIR%
    echo.
    echo Then install PaddleOCR:
    echo   %PYTHON_DIR%\python.exe -m pip install paddleocr paddlepaddle pillow
    echo.
)

REM Summary
echo.
echo ============================================================
echo Environment paths:
echo   FFMPEG_PATH = %FFMPEG_DIR%
echo   PYTHON_PATH = %PYTHON_DIR%
echo.
echo Next: npm run electron
echo ============================================================
echo.

pause
