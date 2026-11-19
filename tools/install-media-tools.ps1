# Installs the open-source media tools the DRM packager needs, on Windows:
#   - Shaka Packager (CENC/cbcs encryption, DASH + HLS) -> tools\bin\packager.exe
#   - ffmpeg + ffprobe (transcode to H.264/AAC)           -> tools\bin\ffmpeg.exe, ffprobe.exe
# The API looks in tools\bin first, so no PATH or .env change is needed.
# Usage (from the repo root):  powershell -ExecutionPolicy Bypass -File tools\install-media-tools.ps1
$ErrorActionPreference = 'Stop'
$Version = if ($env:SHAKA_PACKAGER_VERSION) { $env:SHAKA_PACKAGER_VERSION } else { 'v3.9.3' }
$Bin = Join-Path $PSScriptRoot 'bin'
New-Item -ItemType Directory -Force -Path $Bin | Out-Null

# --- Shaka Packager -----------------------------------------------------------
$Packager = Join-Path $Bin 'packager.exe'
if (-not (Test-Path $Packager)) {
  $Url = "https://github.com/shaka-project/shaka-packager/releases/download/$Version/packager-win-x64.exe"
  Write-Host "Downloading Shaka Packager $Version ..."
  Invoke-WebRequest -Uri $Url -OutFile $Packager -UseBasicParsing
}
& $Packager --version

# --- ffmpeg / ffprobe ---------------------------------------------------------
function Find-Ffmpeg {
  $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($cmd) { return Split-Path $cmd.Source }
  # winget installs Gyan.FFmpeg here without always updating PATH for running shells.
  $winget = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path $winget) {
    $exe = Get-ChildItem -Path $winget -Filter ffmpeg.exe -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($exe) { return $exe.DirectoryName }
  }
  return $null
}

if (-not (Test-Path (Join-Path $Bin 'ffmpeg.exe'))) {
  $dir = Find-Ffmpeg
  if (-not $dir) {
    Write-Host 'ffmpeg not found; installing with winget (Gyan.FFmpeg) ...'
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    $dir = Find-Ffmpeg
  }
  if (-not $dir) { throw 'ffmpeg is still missing. Install it from https://www.gyan.dev/ffmpeg/builds/ and re-run this script.' }
  Copy-Item (Join-Path $dir 'ffmpeg.exe') $Bin -Force
  Copy-Item (Join-Path $dir 'ffprobe.exe') $Bin -Force
}
& (Join-Path $Bin 'ffmpeg.exe') -hide_banner -version | Select-Object -First 1
Write-Host "Media tools ready in $Bin. Restart the API so it picks them up."
