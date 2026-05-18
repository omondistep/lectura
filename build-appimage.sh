#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura — Build AppImage (Linux)
# Usage: ./build-appimage.sh
# Output: dist/Lectura-*.AppImage
# ═══════════════════════════════════════════════════════════════════════════════
set -e

CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "${CYAN}  ◆${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
err()  { echo -e "${RED}  ✗${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }

# ── Checks ────────────────────────────────────────────────────────────────────
command -v python3 &>/dev/null || err "python3 not found"
command -v npm    &>/dev/null || err "npm not found"

BUNDLED_VENV="bundled-venv"

# ── 1. Build icon ──────────────────────────────────────────────────────────────
step "Preparing build icon..."
mkdir -p build
if [ ! -f build/icon.png ]; then
  if [ -f static/icons/icon-512.png ]; then
    cp static/icons/icon-512.png build/icon.png
    ok "Icon copied from static/icons/icon-512.png"
  else
    warn "No icon found — electron-builder will use default"
  fi
fi

# ── 2. Bundle Python venv ──────────────────────────────────────────────────────
step "Bundling Python venv..."
if [ ! -d venv ]; then
  python3 -m venv venv
  venv/bin/pip install --quiet -r requirements.txt
  ok "Python venv created"
fi

rm -rf "$BUNDLED_VENV"
cp -a venv "$BUNDLED_VENV"
ok "Python venv bundled ($(du -sh "$BUNDLED_VENV" | cut -f1))"

# ── 3. Install npm deps ────────────────────────────────────────────────────────
step "Installing npm dependencies..."
if [ -d node_modules/electron/dist/electron ] || [ -f node_modules/electron/dist/electron ]; then
  ok "Electron already installed"
else
  npm ci --prefer-offline 2>/dev/null || npm install --no-audit --no-fund
  ok "Electron dependencies ready"
fi

# ── 4. Verify electron binary ──────────────────────────────────────────────────
if [ ! -f node_modules/electron/dist/electron ]; then
  warn "Electron binary missing — running install script..."
  node node_modules/electron/install.js 2>/dev/null || true
fi
if [ ! -f node_modules/electron/path.txt ]; then
  echo "electron" > node_modules/electron/path.txt
fi
if [ ! -f node_modules/electron/dist/electron ]; then
  warn "Still missing — extracting from cache..."
  CACHE_DIR="${HOME}/.cache/electron"
  ZIP=$(find "$CACHE_DIR" -name "electron-v*-linux-x64.zip" 2>/dev/null | head -1)
  if [ -n "$ZIP" ]; then
    python3 -c "
import zipfile, os
dist = 'node_modules/electron/dist'
os.makedirs(dist, exist_ok=True)
with zipfile.ZipFile('$ZIP') as z:
    z.extractall(dist)
with open('node_modules/electron/path.txt', 'w') as f:
    f.write('electron')
print('Extracted from cache: $ZIP')
"
  fi
fi

# ── 5. Build AppImage ──────────────────────────────────────────────────────────
step "Building AppImage..."
npm run build-linux

# ── 6. Done ────────────────────────────────────────────────────────────────────
APPIMAGE=$(ls dist/Lectura-*.AppImage 2>/dev/null | head -1)
if [ -n "$APPIMAGE" ]; then
  ok "AppImage built: $(ls -lh "$APPIMAGE" | awk '{print $5}') $APPIMAGE"
  echo ""
  echo "  Run:  chmod +x '$APPIMAGE' && '$APPIMAGE'"
else
  err "Build failed — no AppImage found in dist/"
fi
