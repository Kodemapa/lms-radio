#!/usr/bin/env bash
# Installs the open-source media tools the DRM packager needs:
#   - Shaka Packager (CENC/cbcs encryption, DASH + HLS) into tools/bin
#   - ffmpeg (transcode to H.264/AAC) via Homebrew or your package manager
set -euo pipefail
VERSION="${SHAKA_PACKAGER_VERSION:-v3.9.3}"
DIR="$(cd "$(dirname "$0")" && pwd)/bin"
mkdir -p "$DIR"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) ASSET=packager-osx-arm64 ;;
  Darwin-x86_64) ASSET=packager-osx-x64 ;;
  Linux-x86_64) ASSET=packager-linux-x64 ;;
  Linux-aarch64) ASSET=packager-linux-arm64 ;;
  MINGW*-x86_64|MSYS*-x86_64|CYGWIN*-x86_64)
    # Windows (Git Bash): prefer tools/install-media-tools.ps1, which also sets up ffmpeg.
    ASSET=packager-win-x64.exe ;;
  *) echo "Unsupported platform; download Shaka Packager manually" >&2; exit 1 ;;
esac
OUT="$DIR/packager"
case "$ASSET" in *.exe) OUT="$DIR/packager.exe" ;; esac
curl -fsSL -o "$OUT" "https://github.com/shaka-project/shaka-packager/releases/download/$VERSION/$ASSET"
chmod +x "$OUT"
xattr -d com.apple.quarantine "$OUT" 2>/dev/null || true
"$OUT" --version
command -v ffmpeg >/dev/null || [ -x "$DIR/ffmpeg.exe" ] || echo "ffmpeg missing: brew install ffmpeg (macOS), apt-get install ffmpeg (Linux), or run tools/install-media-tools.ps1 (Windows)"
