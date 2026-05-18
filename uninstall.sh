#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura — Unified Uninstaller
#   curl -fsSL https://raw.githubusercontent.com/omondistep/lectura/main/uninstall.sh | sh
# ═══════════════════════════════════════════════════════════════════════════════
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { printf "${CYAN}  ◆${NC} %s\n" "$1"; }
ok()    { printf "${GREEN}  ✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}  ⚠${NC} %s\n" "$1"; }
err()   { printf "${RED}  ✗${NC} %s\n" "$1"; }

detect_platform() {
  case "$(uname -s)" in
    Linux*)  PLATFORM="linux"   ;;
    Darwin*) PLATFORM="macos"   ;;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="windows" ;;
    *)       PLATFORM="unknown" ;;
  esac
}

detect_platform

cat <<'EOF'

  ╭──────────────────────────────────────╮
  │                                      │
  │   _            _                     │
  │  | | ___ __ _| |_ _ __ __ _ _ __    │
  │  | |/ / '__/ _` | __| '__/ _` | '__| │
  │  |   <| | | (_| | |_| | | (_| | |   │
  │  |_|\_\_|  \__,_|\__|_|  \__,_|_|   │
  │                                      │
  │          Uninstaller                 │
  │                                      │
  ╰──────────────────────────────────────╯

EOF

# Confirm
printf "  ${YELLOW}This will remove Lectura and all its files.${NC}\n"
printf "  ${YELLOW}Your notes in ~/Documents/lectura-notes will be preserved.${NC}\n"
printf "\n  Continue? [y/N] "
read -r confirm
case "$confirm" in
  [yY]|[yY][eE][sS]) ;;
  *) printf "\n  Aborted.\n"; exit 0 ;;
esac
echo ""

case "$PLATFORM" in
  linux)
    info "Stopping Lectura..."
    pkill -f "lectura" 2>/dev/null || true
    pkill -f "main.py" 2>/dev/null || true

    info "Removing installed files..."
    rm -rf "${HOME}/.local/share/lectura" 2>/dev/null && ok "Removed ~/.local/share/lectura"
    rm -f "${HOME}/.local/bin/lectura" 2>/dev/null && ok "Removed ~/.local/bin/lectura"
    rm -f "${HOME}/.local/share/applications/lectura.desktop" 2>/dev/null && ok "Removed desktop entry"

    info "Cleaning up caches..."
    rm -rf "${HOME}/.config/lectura" "${HOME}/.cache/lectura" 2>/dev/null || true
    ;;

  macos)
    info "Stopping Lectura..."
    pkill -f "lectura" 2>/dev/null || true
    pkill -f "main.py" 2>/dev/null || true

    info "Removing installed files..."
    rm -rf "${HOME}/Library/Application Support/Lectura" 2>/dev/null && ok "Removed app data"
    rm -f "/Applications/Lectura.app" 2>/dev/null || sudo rm -rf "/Applications/Lectura.app" 2>/dev/null && ok "Removed /Applications/Lectura.app"
    rm -f "/usr/local/bin/lectura" 2>/dev/null || sudo rm -f "/usr/local/bin/lectura" 2>/dev/null && ok "Removed /usr/local/bin/lectura"

    info "Cleaning up caches..."
    rm -rf "${HOME}/Library/Caches/lectura" "${HOME}/Library/Caches/Lectura" 2>/dev/null || true
    rm -f "${HOME}/Library/Preferences/com.lectura.app.plist" 2>/dev/null || true
    ;;

  windows)
    info "Stopping Lectura..."
    taskkill /F /IM electron.exe /FI "WINDOWTITLE eq Lectura*" >nul 2>&1 || true

    info "Removing installed files..."
    rmdir /s /q "%LOCALAPPDATA%\Lectura" 2>nul && ok "Removed %LOCALAPPDATA%\\Lectura"

    info "Removing shortcuts..."
    del /q "%USERPROFILE%\Desktop\Lectura.lnk" 2>nul && ok "Removed Desktop shortcut"
    del /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Lectura.lnk" 2>nul && ok "Removed Start Menu shortcut"

    info "Cleaning up caches..."
    rmdir /s /q "%LOCALAPPDATA%\lectura" 2>nul || true
    rmdir /s /q "%APPDATA%\lectura" 2>nul || true
    ;;

  *)
    err "Unsupported platform"
    ;;
esac

ok "Lectura has been completely uninstalled."
echo ""
