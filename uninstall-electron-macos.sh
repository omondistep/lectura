#!/bin/bash
# Lectura Electron Uninstaller for macOS

INSTALL_DIR="$HOME/Library/Application Support/lectura"
BIN_DIR="$HOME/.local/bin"
APP_DIR="/Applications/Lectura.app"
CACHE_DIRS=(
    "$HOME/Library/Caches/lectura"
    "$HOME/Library/Caches/Lectura"
    "$HOME/Library/Preferences/com.lectura.app.plist"
)

echo "Uninstalling Lectura Electron..."

# Stop running instances
pkill -f "lectura" 2>/dev/null || true

# Remove app bundle
[ -d "$APP_DIR" ] && rm -rf "$APP_DIR" && echo "✓ Removed $APP_DIR"

# Remove installation
[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR" && echo "✓ Removed $INSTALL_DIR"

# Remove launcher
[ -f "$BIN_DIR/lectura" ] && rm -f "$BIN_DIR/lectura" && echo "✓ Removed launcher"

# Clear caches
for cache_dir in "${CACHE_DIRS[@]}"; do
    [ -e "$cache_dir" ] && rm -rf "$cache_dir" && echo "✓ Cleared cache: $cache_dir"
done

echo ""
echo "Lectura has been completely uninstalled."
