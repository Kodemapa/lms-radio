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
  *) echo "Unsupported platform; download Shaka Packager manually" >&2; exit 1 ;;
esac
curl -fsSL -o "$DIR/packager" "https://github.com/shaka-project/shaka-packager/releases/download/$VERSION/$ASSET"
chmod +x "$DIR/packager"
xattr -d com.apple.quarantine "$DIR/packager" 2>/dev/null || true
"$DIR/packager" --version
command -v ffmpeg >/dev/null || echo "ffmpeg missing: brew install ffmpeg (macOS) or apt-get install ffmpeg (Linux)"
