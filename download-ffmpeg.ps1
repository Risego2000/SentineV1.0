# Download FFmpeg from GitHub BtbN Builds
# This script downloads and extracts FFmpeg for SentinelV16

param(
    [switch]$Force = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FFmpegDir = Join-Path $ScriptDir "resources\ffmpeg"

Write-Host "Downloading FFmpeg for SentinelV16..." -ForegroundColor Cyan

# Check if FFmpeg already exists
if ((Test-Path (Join-Path $FFmpegDir "ffmpeg.exe")) -and -not $Force) {
    Write-Host "FFmpeg already exists in $FFmpegDir" -ForegroundColor Green
    Write-Host "Use -Force to re-download" -ForegroundColor Gray
    exit 0
}

# Create directory
if (-not (Test-Path $FFmpegDir)) {
    New-Item -ItemType Directory -Force -Path $FFmpegDir | Out-Null
    Write-Host "Created directory: $FFmpegDir" -ForegroundColor Green
}

# GitHub API to get latest release
Write-Host "Finding latest FFmpeg build..." -ForegroundColor Cyan
try {
    $apiUrl = "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/latest"
    $headers = @{
        "Accept" = "application/vnd.github.v3+json"
    }

    $response = Invoke-WebRequest -Uri $apiUrl -Headers $headers -UseBasicParsing
    $releases = $response.Content | ConvertFrom-Json

    # Find Windows x64 release
    $downloadUrl = $null
    $fileName = $null

    foreach ($asset in $releases.assets) {
        if ($asset.name -match "win64-gpl" -and $asset.name -match "zip") {
            $downloadUrl = $asset.browser_download_url
            $fileName = $asset.name
            break
        }
    }

    if (-not $downloadUrl) {
        Write-Host "Could not find FFmpeg Windows build in latest release" -ForegroundColor Red
        exit 1
    }

    Write-Host "Found: $fileName" -ForegroundColor Green
    Write-Host "URL: $downloadUrl" -ForegroundColor Gray

    # Download
    $tempZip = Join-Path $env:TEMP "ffmpeg-latest.zip"
    Write-Host "Downloading (~150 MB, this may take a minute)..." -ForegroundColor Cyan

    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip -UseBasicParsing
    Write-Host "Downloaded successfully" -ForegroundColor Green

    # Extract
    Write-Host "Extracting..." -ForegroundColor Cyan
    $tempExtract = Join-Path $env:TEMP "ffmpeg-extract"
    if (Test-Path $tempExtract) {
        Remove-Item -Path $tempExtract -Recurse -Force
    }
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

    # Find ffmpeg.exe and ffprobe.exe
    $ffmpegExe = Get-ChildItem -Path $tempExtract -Filter "ffmpeg.exe" -Recurse | Select-Object -First 1
    $ffprobeExe = Get-ChildItem -Path $tempExtract -Filter "ffprobe.exe" -Recurse | Select-Object -First 1

    if ($ffmpegExe -and $ffprobeExe) {
        Copy-Item -Path $ffmpegExe.FullName -Destination (Join-Path $FFmpegDir "ffmpeg.exe") -Force
        Copy-Item -Path $ffprobeExe.FullName -Destination (Join-Path $FFmpegDir "ffprobe.exe") -Force
        Write-Host "Extracted ffmpeg.exe and ffprobe.exe" -ForegroundColor Green
    } else {
        Write-Host "Could not find ffmpeg.exe and ffprobe.exe in archive" -ForegroundColor Red
        exit 1
    }

    # Cleanup
    Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue

    # Verify
    if ((Test-Path (Join-Path $FFmpegDir "ffmpeg.exe")) -and (Test-Path (Join-Path $FFmpegDir "ffprobe.exe"))) {
        Write-Host ""
        Write-Host "✓ FFmpeg installation complete!" -ForegroundColor Green
        Write-Host "Location: $FFmpegDir" -ForegroundColor Gray

        # Test
        $ffmpegVersion = & (Join-Path $FFmpegDir "ffmpeg.exe") -version 2>&1 | Select-Object -First 1
        Write-Host "Version: $ffmpegVersion" -ForegroundColor Gray
    } else {
        Write-Host "Installation may have failed" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Manual download: https://github.com/BtbN/FFmpeg-Builds/releases" -ForegroundColor Yellow
    exit 1
}
