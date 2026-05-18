#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura — Build macOS .dmg and .zip
# Usage: ./build-mac.sh
# Output: dist/Lectura-*-mac-*.dmg  and  dist/Lectura-*-mac-*.zip
# ═══════════════════════════════════════════════════════════════════════════════
set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "${CYAN}  ◆${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
err()  { echo -e "${RED}  ✗${NC} $1"; exit 1; }

BUNDLED_VENV="bundled-venv"

command -v python3 &>/dev/null || err "python3 not found"
command -v npm    &>/dev/null || err "npm not found"

# ── Build icon ────────────────────────────────────────────────────────────────
step "Preparing icons..."
mkdir -p build
if [ ! -f build/icon.png ] && [ -f static/icons/icon-512.png ]; then
  cp static/icons/icon-512.png build/icon.png
fi
if [ ! -f build/icon.icns ] && [ -f static/icons/icon-512.png ]; then
  # Simple .icns placeholder (png inside .icns works on modern macOS)
  mkdir -p build/icon.iconset
  cp static/icons/icon-512.png build/icon.iconset/icon_512x512.png
  iconutil -c icns build/icon.iconset -o build/icon.icns 2>/dev/null || \
    cp static/icons/icon-512.png build/icon.icns
  rm -rf build/icon.iconset
fi

# ── Bundle venv ────────────────────────────────────────────────────────────────
step "Bundling Python venv..."
if [ ! -d venv ]; then
  python3 -m venv venv
  venv/bin/pip install --quiet -r requirements.txt
fi
rm -rf "$BUNDLED_VENV"
cp -a venv "$BUNDLED_VENV"
ok "Python venv bundled"

# ── npm install ────────────────────────────────────────────────────────────────
step "Installing dependencies..."
npm install --no-audit --no-fund --loglevel=error

# ── Build ──────────────────────────────────────────────────────────────────────
step "Building for macOS (x64)..."
npm run build-mac

step "Building for macOS (arm64)..."
npm run build-mac-arm 2>/dev/null || warn "arm64 build skipped (requires Apple Silicon)"

ok "Build complete. Artifacts in dist/:"
ls -lh dist/Lectura-*.dmg dist/Lectura-*.zip 2>/dev/null || true
