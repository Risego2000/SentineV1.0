# Setup Script for FFmpeg and Python in SentinelV16
# Usage: .\setup-ffmpeg-python.ps1

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResourcesDir = Join-Path $ScriptDir "resources"
$FFmpegDir = Join-Path $ResourcesDir "ffmpeg"
$PythonDir = Join-Path $ResourcesDir "python"

Write-Host "SentinelV16 - FFmpeg and Python Setup Script" -ForegroundColor Cyan
Write-Host "============================================================"

# Check FFmpeg
Write-Host ""
Write-Host "Checking FFmpeg..." -ForegroundColor Cyan
if (Test-Path (Join-Path $FFmpegDir "ffmpeg.exe")) {
    Write-Host "✓ ffmpeg.exe found" -ForegroundColor Green
} else {
    Write-Host "✗ FFmpeg not found in: $FFmpegDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Download FFmpeg from:"
    Write-Host "  - https://github.com/BtbN/FFmpeg-Builds/releases"
    Write-Host "  - Download: ffmpeg-master-latest-win64-gpl.zip"
    Write-Host "  - Extract to: $FFmpegDir"
    Write-Host ""
}

# Check Python
Write-Host ""
Write-Host "Checking Python..." -ForegroundColor Cyan
if (Test-Path (Join-Path $PythonDir "python.exe")) {
    Write-Host "✓ python.exe found" -ForegroundColor Green

    # Check PaddleOCR
    $paddleDir = Join-Path $PythonDir "Lib\site-packages\paddleocr"
    if (Test-Path $paddleDir) {
        Write-Host "✓ PaddleOCR installed" -ForegroundColor Green
    } else {
        Write-Host "✗ PaddleOCR not installed" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Install with:"
        Write-Host "  $PythonDir\python.exe -m pip install paddleocr paddlepaddle pillow"
        Write-Host ""
    }
} else {
    Write-Host "✗ Python not found in: $PythonDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Download Python Embedded from:"
    Write-Host "  - https://www.python.org/downloads/windows/"
    Write-Host "  - Download: python-3.10.13-embed-amd64.zip"
    Write-Host "  - Extract to: $PythonDir"
    Write-Host ""
    Write-Host "Then install PaddleOCR:"
    Write-Host "  $PythonDir\python.exe -m pip install paddleocr paddlepaddle pillow"
    Write-Host ""
}

# Summary
Write-Host ""
Write-Host "============================================================"
Write-Host "Environment paths:"
Write-Host "  FFMPEG_PATH = $FFmpegDir" -ForegroundColor Gray
Write-Host "  PYTHON_PATH = $PythonDir" -ForegroundColor Gray
Write-Host ""
Write-Host "Next: npm run electron"
Write-Host "============================================================"
