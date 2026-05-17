#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura — Unified Installer
# Works on Linux, macOS, and Windows (via Git Bash / WSL)
# Inspired by Zed's cross-platform installation experience.
# ═══════════════════════════════════════════════════════════════════════════════
set -e

APP_NAME="Lectura"
APP_VERSION="2.0.0"

# ── Platform detection ──────────────────────────────────────────────────────
detect_platform() {
  case "$(uname -s)" in
    Linux*)  PLATFORM="linux" ;;
    Darwin*) PLATFORM="macos" ;;
    CYGWIN*|MINGW*|MSYS*|Windows*) PLATFORM="windows" ;;
    *)       PLATFORM="unknown" ;;
  esac
  echo "  Detected platform: ${PLATFORM}"
}

# ── Colors (ANSI, works on all platforms) ──────────────────────────────────
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
  echo ""
  echo "${CYAN}${BOLD}================================================${NC}"
  echo "${CYAN}${BOLD}   Lectura v${APP_VERSION} — Unified Installer${NC}"
  echo "${CYAN}${BOLD}================================================${NC}"
  echo ""
}

print_step()  { echo "${CYAN}  ◆${NC} $1"; }
print_ok()    { echo "${GREEN}  ✓${NC} $1"; }
print_warn()  { echo "${YELLOW}  ⚠${NC} $1"; }
print_err()   { echo "${RED}  ✗${NC} $1"; }

# ── Dependency check ────────────────────────────────────────────────────────
check_deps() {
  print_step "Checking system dependencies..."

  PYTHON=""
  for cmd in python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
      PYTHON="$cmd"
      break
    fi
  done

  if [ -z "$PYTHON" ]; then
    print_err "Python 3 is required."
    case "$PLATFORM" in
      linux)  echo "    Install: apt install python3 (Debian) / pacman -S python (Arch)" ;;
      macos)  echo "    Install: brew install python" ;;
      windows) echo "    Download: https://python.org/downloads/" ;;
    esac
    exit 1
  fi

  python_ver=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
  print_ok "Python ${python_ver} found"

  if ! command -v node >/dev/null 2>&1; then
    print_err "Node.js is required."
    case "$PLATFORM" in
      linux)  echo "    Install: apt install nodejs npm (Debian) / pacman -S nodejs npm (Arch)" ;;
      macos)  echo "    Install: brew install node" ;;
      windows) echo "    Download: https://nodejs.org/" ;;
    esac
    exit 1
  fi
  print_ok "Node.js $(node -v) found"

  if ! command -v npm >/dev/null 2>&1; then
    print_err "npm is required (should come with Node.js)."
    exit 1
  fi
  print_ok "npm found"
}

# ── Determine install paths ─────────────────────────────────────────────────
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

  mkdir -p "${INSTALL_DIR}" "${DATA_DIR}" "${CONFIG_DIR}"

  if [ "$PLATFORM" = "linux" ]; then
    mkdir -p "${BIN_DIR}" "${HOME}/.local/share/applications"
  fi
}

# ── Install application files ───────────────────────────────────────────────
install_files() {
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

  print_step "Copying files to ${INSTALL_DIR}..."

  # Core app files
  for f in main.py electron-main.js preload.js package.json requirements.txt; do
    cp "${SCRIPT_DIR}/${f}" "${INSTALL_DIR}/"
  done

  # Static assets and build assets
  cp -r "${SCRIPT_DIR}/static" "${INSTALL_DIR}/"
  if [ -d "${SCRIPT_DIR}/build" ]; then
    cp -r "${SCRIPT_DIR}/build" "${INSTALL_DIR}/"
  fi

  # Config files (if present)
  for f in config.json github_secrets.json gdrive_secrets.json .env; do
    if [ -f "${SCRIPT_DIR}/${f}" ]; then
      cp "${SCRIPT_DIR}/${f}" "${INSTALL_DIR}/" 2>/dev/null || true
    fi
  done

  # Create notes directory
  mkdir -p "${INSTALL_DIR}/notes"

  print_ok "Files copied"
}

# ── Setup Python virtual environment ────────────────────────────────────────
setup_python() {
  if [ -f "${INSTALL_DIR}/venv/bin/activate" ] || [ -f "${INSTALL_DIR}/venv/Scripts/activate" ]; then
    print_ok "Python venv already exists, skipping"
    return
  fi

  print_step "Setting up Python virtual environment..."

  # Handle Windows differently for venv paths
  if [ "$PLATFORM" = "windows" ]; then
    "${PYTHON}" -m venv "${INSTALL_DIR}/venv"
    # shellcheck disable=SC1091
    . "${INSTALL_DIR}/venv/Scripts/activate"
    pip install -q --upgrade pip
    pip install -q -r "${INSTALL_DIR}/requirements.txt"
    deactivate 2>/dev/null || true
  else
    "${PYTHON}" -m venv "${INSTALL_DIR}/venv"
    # shellcheck disable=SC1091
    . "${INSTALL_DIR}/venv/bin/activate"
    pip install -q --upgrade pip
    pip install -q -r "${INSTALL_DIR}/requirements.txt"
    deactivate
  fi

  print_ok "Python dependencies installed"
}

# ── Setup Node dependencies ─────────────────────────────────────────────────
setup_node() {
  if [ -d "${INSTALL_DIR}/node_modules" ] && [ -f "${INSTALL_DIR}/package-lock.json" ]; then
    print_ok "Node modules already installed, skipping"
    return
  fi

  print_step "Installing Electron dependencies..."
  (cd "${INSTALL_DIR}" && npm install --no-audit --no-fund --loglevel=error)
  print_ok "Electron installed"
}

# ── Create launchers ────────────────────────────────────────────────────────
create_launchers() {
  print_step "Creating launchers..."

  case "$PLATFORM" in
    linux)
      cat > "${BIN_DIR}/lectura" << 'LAUNCHER'
#!/bin/sh
cd "$HOME/.local/share/lectura"
export PATH="$HOME/.local/share/lectura/venv/bin:$PATH"
exec npm start "$@"
LAUNCHER
      chmod +x "${BIN_DIR}/lectura"
      print_ok "Launcher: ${BIN_DIR}/lectura"

      # Desktop entry
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
DESKTOP
      chmod +x "${HOME}/.local/share/applications/lectura.desktop"
      update-desktop-database "${HOME}/.local/share/applications" 2>/dev/null || true
      print_ok "Desktop entry created"
      ;;

    macos)
      # Create .app bundle
      mkdir -p "${INSTALL_DIR}/Lectura.app/Contents/MacOS"
      mkdir -p "${INSTALL_DIR}/Lectura.app/Contents/Resources"

      cat > "${INSTALL_DIR}/Lectura.app/Contents/MacOS/Lectura" << 'LAUNCHER'
#!/bin/bash
DIR="$HOME/Library/Application Support/Lectura"
cd "$DIR"
export PATH="$DIR/venv/bin:$PATH"
exec npm start "$@"
LAUNCHER
      chmod +x "${INSTALL_DIR}/Lectura.app/Contents/MacOS/Lectura"

      cat > "${INSTALL_DIR}/Lectura.app/Contents/Info.plist" << PLIST
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

      # Copy icon
      if [ -f "${INSTALL_DIR}/build/icon.png" ]; then
        cp "${INSTALL_DIR}/build/icon.png" "${INSTALL_DIR}/Lectura.app/Contents/Resources/"
      fi

      # Symlink into /Applications
      if [ -d "/Applications" ]; then
        ln -sf "${INSTALL_DIR}/Lectura.app" "/Applications/Lectura.app" 2>/dev/null || \
        sudo ln -sf "${INSTALL_DIR}/Lectura.app" "/Applications/Lectura.app" 2>/dev/null || true
      fi

      # Also create command-line launcher
      if [ -w "${BIN_DIR}" ]; then
        ln -sf "${INSTALL_DIR}/Lectura.app/Contents/MacOS/Lectura" "${BIN_DIR}/lectura"
      else
        sudo ln -sf "${INSTALL_DIR}/Lectura.app/Contents/MacOS/Lectura" "${BIN_DIR}/lectura" 2>/dev/null || true
      fi
      print_ok "App bundle created at ~/Library/Application Support/Lectura/Lectura.app"
      print_ok "Symlinked to /Applications/Lectura.app"
      print_ok "Launcher: ${BIN_DIR}/lectura"
      ;;

    windows)
      # Batch launcher
      cat > "${INSTALL_DIR}/Lectura.bat" << BATCH
@echo off
cd /d "${INSTALL_DIR}"
call venv\Scripts\activate.bat
start "" npx electron .
BATCH

      # PowerShell shortcut creation
      powershell -NoProfile -ExecutionPolicy Bypass -Command "
        \$ws = New-Object -ComObject WScript.Shell;
        \$s = \$ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\\Lectura.lnk');
        \$s.TargetPath = 'cmd.exe';
        \$s.Arguments = '/c \"${INSTALL_DIR}\\Lectura.bat\"';
        \$s.WorkingDirectory = '${INSTALL_DIR}';
        \$s.IconLocation = '${INSTALL_DIR}\\build\\icon.ico';
        \$s.WindowStyle = 7;
        \$s.Description = 'Lectura - Markdown Note-Taking App';
        \$s.Save()
      " 2>&1 || print_warn "Could not create desktop shortcut (run as normal user)"
      print_ok "Shortcuts created on Desktop and Start Menu"
      ;;
  esac
}

# ── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo "${GREEN}${BOLD}================================================${NC}"
  echo "${GREEN}${BOLD}    ✓ Installation Complete!${NC}"
  echo "${GREEN}${BOLD}================================================${NC}"
  echo ""

  case "$PLATFORM" in
    linux)
      echo "  Launch:  ${BOLD}lectura${NC}"
      echo "  Or:      Search 'Lectura' in applications menu"
      echo ""
      echo "  PATH:    ${BIN_DIR}"
      if echo ":$PATH:" | grep -qv ":${BIN_DIR}:"; then
        print_warn "Add ${BIN_DIR} to your PATH:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
      fi
      ;;
    macos)
      echo "  Launch:  ${BOLD}lectura${NC} (terminal)"
      echo "  Or:      Open 'Lectura' from Applications"
      ;;
    windows)
      echo "  Launch:  Double-click 'Lectura' on Desktop"
      echo "  Or:      Find 'Lectura' in Start Menu"
      echo "  Or:      Run: ${INSTALL_DIR}\\Lectura.bat"
      ;;
  esac

  echo ""
  echo "  Uninstall:"
  case "$PLATFORM" in
    linux)
      echo "    rm -rf ${INSTALL_DIR}"
      echo "    rm -f ${BIN_DIR}/lectura"
      echo "    rm -f ${HOME}/.local/share/applications/lectura.desktop"
      ;;
    macos)
      echo "    rm -rf '${INSTALL_DIR}'"
      echo "    rm -f '${BIN_DIR}/lectura'"
      echo "    rm -rf '/Applications/Lectura.app'"
      ;;
    windows)
      echo "    rmdir /s /q '${INSTALL_DIR}'"
      echo "    Delete Desktop and Start Menu shortcuts"
      ;;
  esac
  echo ""
  echo "${BOLD}Happy writing!${NC}"
  echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════
print_banner
detect_platform

if [ "$PLATFORM" = "unknown" ]; then
  print_err "Unsupported platform. Please install manually."
  echo "  See: https://github.com/ondiekOS/lectura#installation"
  exit 1
fi

check_deps
set_paths
install_files
setup_python
setup_node
create_launchers
print_summary
