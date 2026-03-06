#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura Standalone Installer for Linux
# Installs as a browser-based app with Python backend
# ═══════════════════════════════════════════════════════════════════════════════
set -e

INSTALL_DIR="$HOME/.local/share/lectura"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
APP_VERSION="1.0.0"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}================================================${NC}"
    echo -e "${CYAN}${BOLD}   Lectura Standalone Installer for Linux v${APP_VERSION}${NC}"
    echo -e "${CYAN}${BOLD}================================================${NC}"
    echo ""
}

print_step() { echo -e "${CYAN}[*]${NC} $1"; }
print_ok()   { echo -e "${GREEN}[+]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
print_err()  { echo -e "${RED}[-]${NC} $1"; }

# ── Install system dependencies ──────────────────────────────────────────────
install_dependencies() {
    print_step "Checking system dependencies..."

    if ! command -v python3 &>/dev/null; then
        print_err "Python 3 is required but not found."
        print_err "Install with your package manager:"
        print_err "  Ubuntu/Debian: sudo apt install python3 python3-pip python3-venv"
        print_err "  Fedora:        sudo dnf install python3 python3-pip"
        print_err "  Arch:          sudo pacman -S python python-pip"
        exit 1
    fi

    # Check python venv module
    if ! python3 -m venv --help &>/dev/null 2>&1; then
        print_err "Python venv module is required but not found."
        print_err "Install with: sudo apt install python3-venv (Ubuntu/Debian)"
        exit 1
    fi

    local python_ver
    python_ver=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    print_ok "Python $python_ver found"
}

# ── Copy project files ───────────────────────────────────────────────────────
install_files() {
    print_step "Installing to: $INSTALL_DIR"

    if [ -d "$INSTALL_DIR" ]; then
        print_warn "Existing installation found, updating..."
        rm -rf "$INSTALL_DIR"
    fi

    mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$DESKTOP_DIR"

    SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

    print_step "Copying files..."

    # Core app files
    cp "$SOURCE_DIR/main.py" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/requirements.txt" "$INSTALL_DIR/"

    # Static assets
    cp -r "$SOURCE_DIR/static" "$INSTALL_DIR/"

    # Config and secrets (if they exist)
    cp "$SOURCE_DIR/config.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/github_secrets.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/dropbox_secrets.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/gdrive_secrets.json" "$INSTALL_DIR/" 2>/dev/null || true

    # Copy icon if available
    if [ -f "$SOURCE_DIR/build/icon.png" ]; then
        mkdir -p "$INSTALL_DIR/build"
        cp "$SOURCE_DIR/build/icon.png" "$INSTALL_DIR/build/"
    fi

    # Create notes directory
    mkdir -p "$INSTALL_DIR/notes"

    print_ok "Files copied"
}

# ── Setup Python venv ────────────────────────────────────────────────────────
setup_python() {
    print_step "Setting up Python virtual environment..."
    cd "$INSTALL_DIR"
    python3 -m venv venv
    source venv/bin/activate
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    deactivate
    print_ok "Python dependencies installed"
}

# ── Create launcher ──────────────────────────────────────────────────────────
create_launcher() {
    cat > "$BIN_DIR/lectura" << 'LAUNCHER'
#!/bin/bash
cd "$HOME/.local/share/lectura"
source venv/bin/activate

echo "Starting Lectura..."
echo "Open your browser to: http://127.0.0.1:8000"

# Open browser if available
if command -v xdg-open &>/dev/null; then
    xdg-open "http://127.0.0.1:8000" &>/dev/null &
elif command -v firefox &>/dev/null; then
    firefox "http://127.0.0.1:8000" &>/dev/null &
elif command -v chromium &>/dev/null; then
    chromium "http://127.0.0.1:8000" &>/dev/null &
elif command -v google-chrome &>/dev/null; then
    google-chrome "http://127.0.0.1:8000" &>/dev/null &
fi

python main.py
LAUNCHER

    chmod +x "$BIN_DIR/lectura"
    print_ok "Launcher created: $BIN_DIR/lectura"
}

# ── Create desktop entry ────────────────────────────────────────────────────
create_desktop_entry() {
    local icon_path="$INSTALL_DIR/build/icon.png"
    if [ ! -f "$icon_path" ]; then
        icon_path="text-editor"  # fallback to system icon
    fi

    cat > "$DESKTOP_DIR/lectura.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Lectura
Comment=Markdown Note-Taking App
Exec=$BIN_DIR/lectura
Icon=$icon_path
Terminal=false
Categories=Office;TextEditor;Utility;
StartupNotify=true
Keywords=markdown;notes;editor;writing;
DESKTOP

    chmod +x "$DESKTOP_DIR/lectura.desktop"

    # Update desktop database
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

    print_ok "Desktop entry created"
}

# ── PATH check ───────────────────────────────────────────────────────────────
check_path() {
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        echo ""
        print_warn "Add this to your ~/.bashrc or ~/.zshrc:"
        echo -e "    ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
        echo ""
        print_warn "Or reload your shell: source ~/.bashrc"
    fi
}

# ── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo -e "${GREEN}${BOLD}         Installation complete!${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Launch:${NC}    lectura"
    echo -e "  ${BOLD}Or:${NC}        Search 'Lectura' in your applications"
    echo -e "  ${BOLD}URL:${NC}       http://127.0.0.1:8000"
    echo ""
    echo -e "  ${BOLD}Uninstall:${NC}"
    echo "    rm -rf $INSTALL_DIR"
    echo "    rm -f $BIN_DIR/lectura"
    echo "    rm -f $DESKTOP_DIR/lectura.desktop"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
print_banner
install_dependencies
install_files
setup_python
create_launcher
create_desktop_entry
check_path
print_summary
