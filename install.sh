#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura — One-line install (Zed-style)
#   curl -fsSL https://lectura.app/install.sh | sh
# ═══════════════════════════════════════════════════════════════════════════════
set -e

APP_NAME="Lectura"
APP_VERSION="2.0.0"

# ── Utils ────────────────────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { printf "${CYAN}  \342\227\206${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}  \342\234\223${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}  \342\232\240${NC} %s\n" "$1"; }
err()   { printf "${RED}  \342\234\227${NC} %s\n" "$1"; exit 1; }

detect_platform() {
  case "$(uname -s)" in
    Linux*)  PLATFORM="linux"   ;;
    Darwin*) PLATFORM="macos"   ;;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="windows" ;;
    *)       PLATFORM="unknown" ;;
  esac
}

detect_init() {
  if [ -f "${HOME}/.zshrc" ]; then INIT_FILE="${HOME}/.zshrc"
  elif [ -f "${HOME}/.bashrc" ]; then INIT_FILE="${HOME}/.bashrc"
  elif [ -f "${HOME}/.bash_profile" ]; then INIT_FILE="${HOME}/.bash_profile"
  elif [ -f "${HOME}/.profile" ]; then INIT_FILE="${HOME}/.profile"
  else INIT_FILE="${HOME}/.profile"
  fi
}

# ── Banner ───────────────────────────────────────────────────────────────────
banner() {
  printf "\n"
  printf "  \342\225\255──────────────────────────────────────────────────────\342\225\256\n"
  printf "  \342\225\221                                                      \342\225\221\n"
  printf "  \342\225\221   _            _                                     \342\225\221\n"
  printf "  \342\225\221  | | ___ __ _| |_ _ __ __ _ _ __                    \342\225\221\n"
  printf "  \342\225\221  | |/ / '__/ _\` | __| '__/ _\` | '__|               \342\225\221\n"
  printf "  \342\225\221  |   <| | | (_| | |_| | | (_| | |                  \342\225\221\n"
  printf "  \342\225\221  |_|\_\_|  \__,_|\__|_|  \__,_|_|                   \342\225\221\n"
  printf "  \342\225\221                                                      \342\225\221\n"
  printf "  \342\225\221         Markdown Note-Taking                         \342\225\221\n"
  printf "  \342\225\221                                                      \342\225\221\n"
  printf "  \342\225\251──────────────────────────────────────────────────────\342\225\271\n"
  printf "\n"
  printf "${BOLD}  Lectura v%s \342\200\224 Unified Installer${NC}\n\n" "$APP_VERSION"
}

# ── OS-level dependency install ──────────────────────────────────────────────
install_system_deps() {
  if [ "$PLATFORM" = "macos" ]; then
    if ! command -v brew >/dev/null 2>&1; then
      info "Installing Homebrew..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" 2>/dev/null || true
    fi
    return
  fi

  if [ "$PLATFORM" != "linux" ]; then return; fi

  set -- "" "" "" "" ""
  if ! command -v python3 >/dev/null 2>&1; then set -- "$@" "python3"; fi
  if ! command -v node >/dev/null 2>&1; then set -- "$@" "nodejs"; fi
  if ! command -v npm >/dev/null 2>&1; then set -- "$@" "npm"; fi
  if command -v python3 >/dev/null 2>&1 && ! python3 -m venv --help >/dev/null 2>&1; then
    set -- "$@" "python3-venv"
  fi

  if [ $# -le 5 ]; then return; fi

  shift 5
  info "Installing system dependencies..."

  if command -v apt >/dev/null 2>&1; then
    sudo apt update -qq && sudo apt install -y -qq "$@"
  elif command -v pacman >/dev/null 2>&1; then
    sudo pacman -S --needed --noconfirm "$@"
  elif command -v dnf >/dev/null 2>&1; then
    sudo dnf install -y "$@"
  elif command -v apk >/dev/null 2>&1; then
    sudo apk add --no-cache "$@"
  else
    warn "Could not auto-install: $*. Please install manually."
  fi
}

# ── Paths ────────────────────────────────────────────────────────────────────
set_paths() {
  case "$PLATFORM" in
    linux)
      INSTALL_DIR="${HOME}/.local/share/lectura"
      BIN_DIR="${HOME}/.local/bin"
      DATA_DIR="${HOME}/.local/share/lectura"
      CONFIG_DIR="${HOME}/.config/lectura"
      ;;
    macos)
      INSTALL_DIR="${HOME}/Library/Application Support/Lectura"
      BIN_DIR="/usr/local/bin"
      DATA_DIR="${HOME}/Library/Application Support/Lectura"
      CONFIG_DIR="${HOME}/Library/Preferences/Lectura"
      ;;
    windows)
      INSTALL_DIR="${LOCALAPPDATA}/Lectura"
      BIN_DIR="${LOCALAPPDATA}/Lectura/bin"
      DATA_DIR="${LOCALAPPDATA}/Lectura"
      CONFIG_DIR="${APPDATA}/Lectura"
      ;;
  esac
}

# ── Install app files ────────────────────────────────────────────────────────
install_files() {
  SCRIPT_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"

  if [ -f "$SCRIPT_DIR/main.py" ]; then
    SOURCE="$SCRIPT_DIR"
  else
    info "Downloading Lectura ${APP_VERSION}..."
    tmpd=$(mktemp -d)
    url="https://github.com/omondistep/lectura/releases/download/v${APP_VERSION}/lectura-${APP_VERSION}-${PLATFORM}-x64.tar.gz"
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "$url" -o "$tmpd/lectura.tar.gz" 2>/dev/null || true
    elif command -v wget >/dev/null 2>&1; then
      wget -q "$url" -O "$tmpd/lectura.tar.gz" 2>/dev/null || true
    fi
    if [ -f "$tmpd/lectura.tar.gz" ] && [ -s "$tmpd/lectura.tar.gz" ]; then
      tar xzf "$tmpd/lectura.tar.gz" -C "$tmpd" 2>/dev/null
      SOURCE="$tmpd/lectura-${APP_VERSION}"
    else
      warn "Could not download release."
      err "Clone the repo: git clone https://github.com/omondistep/lectura.git && cd lectura && ./install.sh"
    fi
  fi

  mkdir -p "${INSTALL_DIR}" "${DATA_DIR}" "${CONFIG_DIR}" "${BIN_DIR}"

  info "Copying files..."
  for f in main.py electron-main.js preload.js package.json requirements.txt; do
    cp "${SOURCE}/${f}" "${INSTALL_DIR}/" 2>/dev/null || true
  done
  cp -r "${SOURCE}/static" "${INSTALL_DIR}/" 2>/dev/null || true
  if [ -d "${SOURCE}/build" ]; then
    cp -r "${SOURCE}/build" "${INSTALL_DIR}/" 2>/dev/null || true
  fi
  mkdir -p "${INSTALL_DIR}/notes"
  ok "Files copied"
}

# ── Python venv ──────────────────────────────────────────────────────────────
setup_python() {
  if [ -f "${INSTALL_DIR}/venv/bin/python3" ] && "${INSTALL_DIR}/venv/bin/python3" -c "import fastapi" 2>/dev/null; then
    ok "Python venv ready"
    return
  fi
  info "Setting up Python virtual environment..."
  python3 -m venv "${INSTALL_DIR}/venv"
  # shellcheck disable=SC1091
  . "${INSTALL_DIR}/venv/bin/activate"
  pip install --no-cache-dir --upgrade pip -q
  pip install --no-cache-dir -r "${INSTALL_DIR}/requirements.txt" -q
  deactivate
  ok "Python dependencies installed"
}

# ── Node / Electron ──────────────────────────────────────────────────────────
setup_node() {
  if [ -f "${INSTALL_DIR}/node_modules/electron/dist/electron" ]; then
    ok "Electron ready"
    return
  fi
  info "Installing Electron..."
  cd "${INSTALL_DIR}"
  # If electron package dir exists but binary missing, remove it to force reinstall
  if [ -d "${INSTALL_DIR}/node_modules/electron" ] && [ ! -f "${INSTALL_DIR}/node_modules/electron/dist/electron" ]; then
    rm -rf "${INSTALL_DIR}/node_modules/electron"
  fi
  ELECTRON_SKIP_BINARY_DOWNLOAD=0 npm install --no-audit --no-fund --loglevel=error
  # Verify binary landed; if not, try extracting from cache
  if [ ! -f "${INSTALL_DIR}/node_modules/electron/dist/electron" ]; then
    cache_zip=$(find "${HOME}/.cache/electron" -name "electron-v*-linux-x64.zip" 2>/dev/null | head -1)
    if [ -n "$cache_zip" ]; then
      python3 -c "
import zipfile, os
dist = '${INSTALL_DIR}/node_modules/electron/dist'
os.makedirs(dist, exist_ok=True)
with zipfile.ZipFile('$cache_zip') as z:
    z.extractall(dist)
with open('${INSTALL_DIR}/node_modules/electron/path.txt', 'w') as f:
    f.write('electron')
" 2>/dev/null
    fi
  fi
  # Ensure binary is executable
  if [ -f "${INSTALL_DIR}/node_modules/electron/dist/electron" ]; then
    chmod +x "${INSTALL_DIR}/node_modules/electron/dist/electron"
  fi
  ok "Electron ready"
}

# ── Launcher / desktop integration ───────────────────────────────────────────
create_launcher() {
  info "Creating launchers..."

  case "$PLATFORM" in
    linux)
      cat > "${BIN_DIR}/lectura" << 'LAUNCHER'
#!/bin/sh
export PATH="$HOME/.local/share/lectura/venv/bin:$PATH"
exec npm start --prefix "$HOME/.local/share/lectura" "$@"
LAUNCHER
      chmod +x "${BIN_DIR}/lectura"
      ok "Command: ${BIN_DIR}/lectura"

      cat > "${HOME}/.local/share/applications/lectura.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Lectura
Comment=Markdown Note-Taking App
Exec=${BIN_DIR}/lectura
Icon=${INSTALL_DIR}/build/icon.png
Terminal=false
Categories=Office;TextEditor;Utility;
StartupNotify=true
Keywords=markdown;notes;editor;writing;
MimeType=text/markdown;
DESKTOP
      chmod +x "${HOME}/.local/share/applications/lectura.desktop"
      update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
      ;;

    macos)
      cat > "${BIN_DIR}/lectura" << 'LAUNCHER'
#!/bin/bash
DIR="$HOME/Library/Application Support/Lectura"
export PATH="$DIR/venv/bin:$PATH"
exec npm start --prefix "$DIR" "$@"
LAUNCHER
      if [ -w "${BIN_DIR}" ]; then
        chmod +x "${BIN_DIR}/lectura"
      else
        sudo chmod +x "${BIN_DIR}/lectura" 2>/dev/null || true
      fi

      APP_BUNDLE="${INSTALL_DIR}/Lectura.app"
      mkdir -p "${APP_BUNDLE}/Contents/MacOS" "${APP_BUNDLE}/Contents/Resources"
      cat > "${APP_BUNDLE}/Contents/MacOS/Lectura" <<'MACLAUNCHER'
#!/bin/bash
DIR="$HOME/Library/Application Support/Lectura"
export PATH="$DIR/venv/bin:$PATH"
exec npm start --prefix "$DIR" "$@"
MACLAUNCHER
      chmod +x "${APP_BUNDLE}/Contents/MacOS/Lectura"
      cat > "${APP_BUNDLE}/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>Lectura</string>
  <key>CFBundleIdentifier</key>
  <string>com.lectura.app</string>
  <key>CFBundleName</key>
  <string>Lectura</string>
  <key>CFBundleVersion</key>
  <string>${APP_VERSION}</string>
  <key>CFBundleShortVersionString</key>
  <string>${APP_VERSION}</string>
  <key>CFBundleIconFile</key>
  <string>icon</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST
      if [ -f "${INSTALL_DIR}/build/icon.png" ]; then
        cp "${INSTALL_DIR}/build/icon.png" "${APP_BUNDLE}/Contents/Resources/"
      fi
      if [ -d "/Applications" ]; then
        ln -sf "${APP_BUNDLE}" "/Applications/Lectura.app" 2>/dev/null || \
        sudo ln -sf "${APP_BUNDLE}" "/Applications/Lectura.app" 2>/dev/null || true
        ok "App bundle: /Applications/Lectura.app"
      fi
      ;;

    windows)
      cat > "${INSTALL_DIR}/Lectura.bat" << BATCH
@echo off
cd /d "${INSTALL_DIR}"
call venv\Scripts\activate.bat
start "" npx electron .
BATCH
      ;;
  esac
}

# ── PATH setup ───────────────────────────────────────────────────────────────
setup_path() {
  case "$PLATFORM" in
    linux)
      if ! echo ":$PATH:" | grep -q ":${BIN_DIR}:"; then
        if ! grep -q "\.local/bin" "$INIT_FILE" 2>/dev/null; then
          printf '\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$INIT_FILE"
        fi
      fi
      ;;
    macos)
      if ! echo ":$PATH:" | grep -q ":${BIN_DIR}:"; then
        if ! grep -q "/usr/local/bin" "$INIT_FILE" 2>/dev/null; then
          printf '\nexport PATH="/usr/local/bin:$PATH"\n' >> "$INIT_FILE"
        fi
      fi
      ;;
  esac
}

# ── Summary ──────────────────────────────────────────────────────────────────
summary() {
  printf "\n${GREEN}${BOLD}\342\234\223  Installation Complete${NC}\n\n"
  printf "${BOLD}Launch:${NC}\n"
  case "$PLATFORM" in
    linux)   printf "    lectura\n" ;;
    macos)   printf "    lectura\n    Or open Lectura from Applications\n" ;;
    windows) printf "    Double-click Lectura on Desktop\n" ;;
  esac
  printf "\n${BOLD}Uninstall:${NC}\n"
  printf "    curl -fsSL https://raw.githubusercontent.com/omondistep/lectura/main/uninstall.sh | sh\n"
  printf "\n${BOLD}Support:${NC} https://github.com/omondistep/lectura/issues\n"
  printf "\n"
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
detect_platform
detect_init
banner

info "Detected: ${PLATFORM} ($(uname -m))"

install_system_deps
set_paths
install_files
setup_python
setup_node
create_launcher
setup_path
summary
