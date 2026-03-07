#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura Standalone Installer for macOS
# Installs as a browser-based app with Python backend
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
    echo -e "${CYAN}${BOLD}   Lectura Standalone Installer for macOS v${APP_VERSION}${NC}"
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
        print_err "Or download from: https://python.org/downloads/"
        exit 1
    fi

    # Check pip
    if ! command -v pip3 &>/dev/null; then
        print_err "pip3 is required but not found."
        print_err "Install with: python3 -m ensurepip --upgrade"
        exit 1
    fi

    local python_ver
    python_ver=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    print_ok "Python $python_ver found"

    # Check if we need sudo for /usr/local/bin
    if [ ! -w "$BIN_DIR" ]; then
        print_warn "Will need sudo access to install launcher to $BIN_DIR"
    fi
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
    cp "$SOURCE_DIR/requirements.txt" "$INSTALL_DIR/"

    # Static assets
    cp -r "$SOURCE_DIR/static" "$INSTALL_DIR/"

    # Config and secrets (if they exist)
    cp "$SOURCE_DIR/config.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/github_secrets.json" "$INSTALL_DIR/" 2>/dev/null || true
    cp "$SOURCE_DIR/gdrive_secrets.json" "$INSTALL_DIR/" 2>/dev/null || true

    # Copy icon if available
    if [ -f "$SOURCE_DIR/build/icon.icns" ]; then
        mkdir -p "$INSTALL_DIR/build"
        cp "$SOURCE_DIR/build/icon.icns" "$INSTALL_DIR/build/"
    elif [ -f "$SOURCE_DIR/build/icon.png" ]; then
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
    print_step "Creating launcher..."

    # Create launcher script
    cat > "$INSTALL_DIR/lectura.sh" << 'LAUNCHER'
#!/bin/bash
cd "$HOME/Library/Application Support/Lectura"
source venv/bin/activate

echo "Starting Lectura..."
echo "Open your browser to: http://127.0.0.1:8000"

# Open browser
open "http://127.0.0.1:8000"

python main.py
LAUNCHER

    chmod +x "$INSTALL_DIR/lectura.sh"

    # Install to /usr/local/bin (may need sudo)
    if [ -w "$BIN_DIR" ]; then
        ln -sf "$INSTALL_DIR/lectura.sh" "$BIN_DIR/lectura"
        print_ok "Launcher installed to $BIN_DIR/lectura"
    else
        print_step "Installing launcher (requires sudo)..."
        sudo ln -sf "$INSTALL_DIR/lectura.sh" "$BIN_DIR/lectura"
        print_ok "Launcher installed to $BIN_DIR/lectura"
    fi
}

# ── Create macOS app bundle ──────────────────────────────────────────────────
create_app_bundle() {
    print_step "Creating macOS app bundle..."

    local app_path="$APP_DIR/Lectura.app"
    
    # Remove existing app
    if [ -d "$app_path" ]; then
        rm -rf "$app_path"
    fi

    # Create app bundle structure
    mkdir -p "$app_path/Contents/MacOS"
    mkdir -p "$app_path/Contents/Resources"

    # Create Info.plist
    cat > "$app_path/Contents/Info.plist" << PLIST
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
    <string>$APP_VERSION</string>
    <key>CFBundleShortVersionString</key>
    <string>$APP_VERSION</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>LECT</string>
    <key>LSMinimumSystemVersion</key>
    <string>10.14</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST

    # Create executable
    cat > "$app_path/Contents/MacOS/Lectura" << 'EXECUTABLE'
#!/bin/bash
cd "$HOME/Library/Application Support/Lectura"
source venv/bin/activate
open "http://127.0.0.1:8000"
python main.py &
EXECUTABLE

    chmod +x "$app_path/Contents/MacOS/Lectura"

    # Copy icon if available
    if [ -f "$INSTALL_DIR/build/icon.icns" ]; then
        cp "$INSTALL_DIR/build/icon.icns" "$app_path/Contents/Resources/"
    fi

    print_ok "macOS app created: $app_path"
}

# ── Summary ──────────────────────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo -e "${GREEN}${BOLD}         Installation complete!${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Launch:${NC}    lectura"
    echo -e "  ${BOLD}Or:${NC}        Open Lectura.app from Applications"
    echo -e "  ${BOLD}URL:${NC}       http://127.0.0.1:8000"
    echo ""
    echo -e "  ${BOLD}Uninstall:${NC}"
    echo "    rm -rf '$INSTALL_DIR'"
    echo "    sudo rm -f '$BIN_DIR/lectura'"
    echo "    rm -rf '$APP_DIR/Lectura.app'"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
print_banner
check_dependencies
install_files
setup_python
create_launcher
create_app_bundle
print_summary
