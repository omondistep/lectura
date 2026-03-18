#!/bin/bash
# Build Lectura as an AppImage
# Usage: ./build-appimage.sh
# Output: dist/Lectura-*.AppImage
set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "${CYAN}[*]${NC} $1"; }
ok()   { echo -e "${GREEN}[+]${NC} $1"; }
err()  { echo -e "${RED}[-]${NC} $1"; exit 1; }

# ── 1. Checks ─────────────────────────────────────────────────────────────────
command -v python3 &>/dev/null || err "python3 not found"
command -v npm    &>/dev/null || err "npm not found"

# ── 2. Build icon ─────────────────────────────────────────────────────────────
step "Preparing build icon..."
mkdir -p build
if [ ! -f build/icon.png ]; then
  cp static/icons/icon-512.png build/icon.png
  ok "Icon copied"
fi

# ── 3. Bundle Python venv ─────────────────────────────────────────────────────
step "Bundling Python venv..."
if [ ! -d venv ]; then
  python3 -m venv venv
  venv/bin/pip install --quiet -r requirements.txt
fi

# Copy venv as bundled-venv (electron-builder will include it)
rm -rf bundled-venv
cp -a venv bundled-venv
ok "Python venv bundled ($(du -sh bundled-venv | cut -f1))"

# ── 4. Install npm deps ───────────────────────────────────────────────────────
step "Installing npm dependencies..."
npm ci --prefer-offline 2>/dev/null || npm install
ok "npm dependencies ready"

# ── 5. Build AppImage ─────────────────────────────────────────────────────────
step "Building AppImage (this takes ~1 minute)..."
npm run build-linux

# ── 6. Done ───────────────────────────────────────────────────────────────────
APPIMAGE=$(ls dist/Lectura-*.AppImage 2>/dev/null | head -1)
if [ -n "$APPIMAGE" ]; then
  ok "AppImage built: $APPIMAGE"
  echo ""
  echo "  Run it with:  chmod +x '$APPIMAGE' && '$APPIMAGE'"
  echo "  Or share the single file — no installation needed."
else
  err "Build failed — no AppImage found in dist/"
fi
