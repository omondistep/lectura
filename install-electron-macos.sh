#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura Electron Installer for macOS
# Installs as a native desktop app with Electron
# ═══════════════════════════════════════════════════════════════════════════════
set -e

INSTALL_DIR="$HOME/Library/Application Support/Lectura"
BIN_DIR="/usr/local/bin"
APP_DIR="/Applications"
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
    echo -e "${CYAN}${BOLD}   Lectura Electron Installer for macOS v${APP_VERSION}${NC}"
    echo -e "${CYAN}${BOLD}================================================${NC}"
    echo ""
}

print_step() { echo -e "${CYAN}[*]${NC} $1"; }
print_ok()   { echo -e "${GREEN}[+]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
print_err()  { echo -e "${RED}[-]${NC} $1"; }

# ── Check dependencies ───────────────────────────────────────────────────────
check_dependencies() {
    print_step "Checking system dependencies..."

    # Check Python 3
    if ! command -v python3 &>/dev/null; then
        print_err "Python 3 is required but not found."
        print_err "Install with Homebrew: brew install python"
        exit 1
    fi

    # Check Node.js
    if ! command -v node &>/dev/null; then
        print_err "Node.js is required but not found."
        print_err "Install with Homebrew: brew install node"
        print_err "Or download from: https://nodejs.org/"
        exit 1
    fi

    # Check npm
    if ! command -v npm &>/dev/null; then
        print_err "npm is required but not found."
        print_err "It should come with Node.js installation."
        exit 1
    fi

    local python_ver node_ver
    python_ver=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    node_ver=$(node -v)
    print_ok "Python $python_ver found"
    print_ok "Node.js $node_ver found"
}

# ── Install files ────────────────────────────────────────────────────────────
install_files() {
    print_step "Installing to: $INSTALL_DIR"

    if [ -d "$INSTALL_DIR" ]; then
        print_warn "Existing installation found, updating..."
        rm -rf "$INSTALL_DIR"
    fi

    mkdir -p "$INSTALL_DIR"

    SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

    print_step "Copying files..."

    # Core app files
    cp "$SOURCE_DIR/main.py" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/electron-main.js" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/preload.js" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/package.json" "$INSTALL_DIR/"
    cp "$SOURCE_DIR/requirements.txt" "$INSTALL_DIR/"

    # Static assets
    cp -r "$SOURCE_DIR/static" "$INSTALL_DIR/"
    cp -r "$SOURCE_DIR/build" "$INSTALL_DIR/"

    # Config and secrets (if they exist)
    cp "$SOURCE_DIR/config.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/github_secrets.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/gdrive_secrets.json" "$INSTALL_DIR/" 2>/dev/null || true

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

# ── Install Electron dependencies ────────────────────────────────────────────
setup_electron() {
    print_step "Installing Electron dependencies (this may take 2-5 minutes)..."
    cd "$INSTALL_DIR"
    npm install --progress=true
    print_ok "Electron installed"
}

# ── Create launcher ──────────────────────────────────────────────────────────
create_launcher() {
    print_step "Creating launcher..."

    # Create launcher script
    cat > "$INSTALL_DIR/lectura-app.sh" << 'LAUNCHER'
#!/bin/bash
cd "$HOME/Library/Application Support/Lectura"
source venv/bin/activate
npm start
LAUNCHER

    chmod +x "$INSTALL_DIR/lectura-app.sh"

    # Install to /usr/local/bin (may need sudo)
    if [ -w "$BIN_DIR" ]; then
        ln -sf "$INSTALL_DIR/lectura-app.sh" "$BIN_DIR/lectura-app"
        print_ok "Launcher installed to $BIN_DIR/lectura-app"
    else
        print_step "Installing launcher (requires sudo)..."
        sudo ln -sf "$INSTALL_DIR/lectura-app.sh" "$BIN_DIR/lectura-app"
        print_ok "Launcher installed to $BIN_DIR/lectura-app"
    fi
}

# ── Build macOS app ──────────────────────────────────────────────────────────
build_app() {
    echo ""
    read -p "Build native macOS app now? [y/N]: " build_choice
    if [[ "$build_choice" =~ ^[Yy]$ ]]; then
        print_step "Building macOS app..."
        cd "$INSTALL_DIR"
        
        # Update package.json for macOS build
        npm run build 2>/dev/null || {
            print_warn "Build script not found, installing electron-builder..."
            npm install --save-dev electron-builder
            npx electron-builder --mac
        }
        
        if [ -d "dist/mac/Lectura.app" ]; then
            cp -r "dist/mac/Lectura.app" "$APP_DIR/"
            print_ok "Native app installed to Applications folder"
        fi
    fi
}

# ── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo -e "${GREEN}${BOLD}         Installation complete!${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Launch:${NC}    lectura-app"
    echo -e "  ${BOLD}Or:${NC}        Open Lectura from Applications (if built)"
    echo ""
    echo -e "  ${BOLD}Uninstall:${NC}"
    echo "    rm -rf '$INSTALL_DIR'"
    echo "    sudo rm -f '$BIN_DIR/lectura-app'"
    echo "    rm -rf '$APP_DIR/Lectura.app'"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
print_banner
check_dependencies
install_files
setup_python
setup_electron
create_launcher
build_app
print_summary
