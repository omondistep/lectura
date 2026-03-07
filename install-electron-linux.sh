#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Lectura Electron Installer for Linux
# Installs as a desktop Electron app with isolated Python venv
# Works on Ubuntu, Debian, Fedora, Arch, and other distributions
# ═══════════════════════════════════════════════════════════════════════════════
set -e

INSTALL_DIR="$HOME/.local/share/lectura"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
APP_VERSION="2.0.0"

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
    echo -e "${CYAN}${BOLD}   Lectura Electron Installer for Linux v${APP_VERSION}${NC}"
    echo -e "${CYAN}${BOLD}================================================${NC}"
    echo ""
}

print_step() { echo -e "${CYAN}[*]${NC} $1"; }
print_ok()   { echo -e "${GREEN}[+]${NC} $1"; }
print_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
print_err()  { echo -e "${RED}[-]${NC} $1"; }

# ── Check system and install dependencies ────────────────────────────────────
check_system() {
    print_step "Detecting Linux distribution..."
    
    if command -v pacman &>/dev/null; then
        DISTRO="arch"
        print_ok "Arch Linux detected"
    elif command -v apt &>/dev/null; then
        DISTRO="debian"
        print_ok "Debian/Ubuntu detected"
    elif command -v dnf &>/dev/null; then
        DISTRO="fedora"
        print_ok "Fedora detected"
    elif command -v yum &>/dev/null; then
        DISTRO="rhel"
        print_ok "RHEL/CentOS detected"
    else
        DISTRO="unknown"
        print_warn "Unknown distribution, will try generic installation"
    fi
}

# ── Install system dependencies ──────────────────────────────────────────────
install_dependencies() {
    print_step "Checking system dependencies..."

    local missing=()
    command -v python3 &>/dev/null || missing+=(python3)
    command -v pip &>/dev/null || missing+=(pip)
    command -v node &>/dev/null || missing+=(nodejs)
    command -v npm &>/dev/null || missing+=(npm)

    # Check python venv module
    if command -v python3 &>/dev/null; then
        python3 -m venv --help &>/dev/null 2>&1 || missing+=(python3-venv)
    fi

    if [ ${#missing[@]} -gt 0 ]; then
        print_step "Installing missing packages: ${missing[*]}"
        
        case "$DISTRO" in
            arch)
                # Map package names for Arch
                local arch_packages=()
                for pkg in "${missing[@]}"; do
                    case "$pkg" in
                        python3) arch_packages+=(python) ;;
                        pip) arch_packages+=(python-pip) ;;
                        nodejs) arch_packages+=(nodejs) ;;
                        npm) arch_packages+=(npm) ;;
                        python3-venv) arch_packages+=(python) ;;
                        *) arch_packages+=("$pkg") ;;
                    esac
                done
                sudo pacman -S --needed --noconfirm "${arch_packages[@]}"
                ;;
            debian)
                sudo apt update
                sudo apt install -y "${missing[@]}"
                ;;
            fedora)
                # Map package names for Fedora
                local fedora_packages=()
                for pkg in "${missing[@]}"; do
                    case "$pkg" in
                        nodejs) fedora_packages+=(nodejs npm) ;;
                        python3-venv) fedora_packages+=(python3) ;;
                        *) fedora_packages+=("$pkg") ;;
                    esac
                done
                sudo dnf install -y "${fedora_packages[@]}"
                ;;
            rhel)
                sudo yum install -y "${missing[@]}"
                ;;
            *)
                print_err "Please install these packages manually: ${missing[*]}"
                print_err "Then run this installer again."
                exit 1
                ;;
        esac
        print_ok "System packages installed"
    else
        print_ok "All system dependencies already installed"
    fi

    # Verify installations
    local python_ver
    python_ver=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    print_ok "Python $python_ver found"

    local node_ver
    node_ver=$(node -v)
    print_ok "Node.js $node_ver found"
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
    cat > "$BIN_DIR/lectura" << 'LAUNCHER'
#!/bin/bash
cd "$HOME/.local/share/lectura"
export PATH="$HOME/.local/share/lectura/venv/bin:$PATH"
npm start 2>/dev/null
LAUNCHER

    chmod +x "$BIN_DIR/lectura"
    print_ok "Launcher created: $BIN_DIR/lectura"
}

# ── Create desktop entry ────────────────────────────────────────────────────
create_desktop_entry() {
    cat > "$DESKTOP_DIR/lectura.desktop" << DESKTOP
[Desktop Entry]
Version=1.0
Type=Application
Name=Lectura
Comment=Markdown Note-Taking App
Exec=$BIN_DIR/lectura
Icon=$INSTALL_DIR/build/icon.png
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

# ── Build distributable package (optional) ───────────────────────────────────
offer_build() {
    echo ""
    read -p "Build distributable pacman package now? [y/N]: " build_choice
    if [[ "$build_choice" =~ ^[Yy]$ ]]; then
        print_step "Building Arch Linux package..."
        cd "$INSTALL_DIR"
        npm run build-linux
        print_ok "Package built in: $INSTALL_DIR/dist/"
    fi
}

# ── PATH check ───────────────────────────────────────────────────────────────
check_path() {
    if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
        echo ""
        print_warn "Add this to your ~/.bashrc or ~/.zshrc:"
        echo -e "    ${BOLD}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
    fi
}

# ── Uninstall instructions ───────────────────────────────────────────────────
print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo -e "${GREEN}${BOLD}         Installation complete!${NC}"
    echo -e "${GREEN}${BOLD}================================================${NC}"
    echo ""
    echo -e "  ${BOLD}Launch:${NC}    lectura"
    echo -e "  ${BOLD}Or:${NC}        Search 'Lectura' in your applications"
    echo ""
    echo -e "  ${BOLD}Uninstall:${NC}"
    echo "    rm -rf $INSTALL_DIR"
    echo "    rm -f $BIN_DIR/lectura"
    echo "    rm -f $DESKTOP_DIR/lectura.desktop"
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
print_banner
check_system
install_dependencies
install_files
setup_python
setup_electron
create_launcher
create_desktop_entry
offer_build
check_path
print_summary
