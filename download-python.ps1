# Download Python Embedded Edition
# This script downloads and sets up Python for SentinelV16

param(
    [string]$Version = "3.10.13",
    [switch]$Force = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonDir = Join-Path $ScriptDir "resources\python"

Write-Host "Downloading Python $Version Embedded Edition..." -ForegroundColor Cyan

# Check if Python already exists
if ((Test-Path (Join-Path $PythonDir "python.exe")) -and -not $Force) {
    Write-Host "Python already exists in $PythonDir" -ForegroundColor Green
    Write-Host "Use -Force to re-download" -ForegroundColor Gray
    exit 0
}

# Create directory
if (-not (Test-Path $PythonDir)) {
    New-Item -ItemType Directory -Force -Path $PythonDir | Out-Null
    Write-Host "Created directory: $PythonDir" -ForegroundColor Green
}

# Python download URL for embedded version
$majorMinor = $Version -replace "\..*", "" + ($Version -replace "^\d+\.", "").substring(0, 2)
$downloadUrl = "https://www.python.org/ftp/python/$Version/python-$Version-embed-amd64.zip"

Write-Host "Downloading from: $downloadUrl" -ForegroundColor Gray
Write-Host "(Python ~100 MB, this may take a minute)..." -ForegroundColor Cyan

try {
    $tempZip = Join-Path $env:TEMP "python-embedded.zip"

    # Download
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip -UseBasicParsing
    Write-Host "Downloaded successfully" -ForegroundColor Green

    # Extract
    Write-Host "Extracting..." -ForegroundColor Cyan
    Expand-Archive -Path $tempZip -DestinationPath $PythonDir -Force

    # Verify
    $pythonExe = Join-Path $PythonDir "python.exe"
    if (Test-Path $pythonExe) {
        Write-Host "✓ Python extraction complete!" -ForegroundColor Green
        Write-Host "Location: $PythonDir" -ForegroundColor Gray

        # Test
        $pythonVersion = & $pythonExe --version 2>&1
        Write-Host "Version: $pythonVersion" -ForegroundColor Gray

        # Create pth file for site-packages (needed for pip)
        $pthFile = Join-Path $PythonDir "python310._pth"
        if (-not (Test-Path $pthFile)) {
            $pthContent = @"
python310.zip
.
import site
"@
            Set-Content -Path $pthFile -Value $pthContent
            Write-Host "Created python310._pth for pip support" -ForegroundColor Green
        }

        # Cleanup
        Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue

        Write-Host ""
        Write-Host "Next step: Install PaddleOCR" -ForegroundColor Cyan
        Write-Host "$pythonExe -m pip install paddleocr paddlepaddle pillow" -ForegroundColor Gray

    } else {
        Write-Host "Python extraction may have failed" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Manual download: https://www.python.org/downloads/windows/" -ForegroundColor Yellow
    Write-Host "Download: python-$Version-embed-amd64.zip" -ForegroundColor Yellow
    exit 1
}
