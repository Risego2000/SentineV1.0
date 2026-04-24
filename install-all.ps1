# Master installation script for SentinelV16 Electron
# Downloads FFmpeg, Python, and installs PaddleOCR

param(
    [switch]$SkipFFmpeg = $false,
    [switch]$SkipPython = $false,
    [switch]$SkipPaddleOCR = $false,
    [switch]$Force = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "  SentinelV16 Electron - Complete Installation" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will:"
Write-Host "  1. Download FFmpeg (if not present)" -ForegroundColor Gray
Write-Host "  2. Download Python Embedded (if not present)" -ForegroundColor Gray
Write-Host "  3. Install PaddleOCR (if not present)" -ForegroundColor Gray
Write-Host ""

# Step 1: FFmpeg
if (-not $SkipFFmpeg) {
    Write-Host "STEP 1: FFmpeg" -ForegroundColor Cyan
    Write-Host "-" * 50

    $downloadScript = Join-Path $ScriptDir "download-ffmpeg.ps1"
    if (Test-Path $downloadScript) {
        if ($Force) {
            & $downloadScript -Force
        } else {
            & $downloadScript
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ FFmpeg ready" -ForegroundColor Green
        } else {
            Write-Host "✗ FFmpeg failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "download-ffmpeg.ps1 not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "STEP 1: FFmpeg (skipped)" -ForegroundColor Gray
}

Write-Host ""

# Step 2: Python
if (-not $SkipPython) {
    Write-Host "STEP 2: Python Embedded" -ForegroundColor Cyan
    Write-Host "-" * 50

    $downloadScript = Join-Path $ScriptDir "download-python.ps1"
    if (Test-Path $downloadScript) {
        if ($Force) {
            & $downloadScript -Force
        } else {
            & $downloadScript
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Python ready" -ForegroundColor Green
        } else {
            Write-Host "✗ Python failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "download-python.ps1 not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "STEP 2: Python (skipped)" -ForegroundColor Gray
}

Write-Host ""

# Step 3: PaddleOCR
if (-not $SkipPaddleOCR) {
    Write-Host "STEP 3: PaddleOCR" -ForegroundColor Cyan
    Write-Host "-" * 50

    $PythonDir = Join-Path $ScriptDir "resources\python"
    $PythonExe = Join-Path $PythonDir "python.exe"

    if (Test-Path $PythonExe) {
        $paddleDir = Join-Path $PythonDir "Lib\site-packages\paddleocr"
        if ((Test-Path $paddleDir) -and -not $Force) {
            Write-Host "✓ PaddleOCR already installed" -ForegroundColor Green
        } else {
            Write-Host "Installing PaddleOCR (this may take 5-10 minutes)..." -ForegroundColor Cyan
            & $PythonExe -m pip install --upgrade pip
            & $PythonExe -m pip install paddleocr paddlepaddle pillow

            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ PaddleOCR installed" -ForegroundColor Green
            } else {
                Write-Host "✗ PaddleOCR installation failed" -ForegroundColor Red
                Write-Host "Try manually: $PythonExe -m pip install paddleocr" -ForegroundColor Yellow
                exit 1
            }
        }
    } else {
        Write-Host "Python not found, cannot install PaddleOCR" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "STEP 3: PaddleOCR (skipped)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=====================================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. npm run electron         # Test in development" -ForegroundColor Gray
Write-Host "  2. npm run build             # Build production .exe" -ForegroundColor Gray
Write-Host ""
Write-Host "For more information, see README_ELECTRON.md" -ForegroundColor Gray
Write-Host ""
