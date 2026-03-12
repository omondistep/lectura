#!/bin/bash
# Lectura Electron Uninstaller for Linux

INSTALL_DIR="$HOME/.local/share/lectura"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$HOME/.local/share/applications"
CACHE_DIRS=(
    "$HOME/.config/lectura"
    "$HOME/.config/Lectura"
    "$HOME/.cache/lectura"
    "$HOME/.cache/Lectura"
)

echo "Uninstalling Lectura Electron..."

# Stop running instances
pkill -f "lectura" 2>/dev/null || true

# Remove installation
[ -d "$INSTALL_DIR" ] && rm -rf "$INSTALL_DIR" && echo "✓ Removed $INSTALL_DIR"

# Remove launcher
[ -f "$BIN_DIR/lectura" ] && rm -f "$BIN_DIR/lectura" && echo "✓ Removed launcher"

# Remove desktop entry
[ -f "$DESKTOP_DIR/lectura.desktop" ] && rm -f "$DESKTOP_DIR/lectura.desktop" && echo "✓ Removed desktop entry"

# Clear caches
for cache_dir in "${CACHE_DIRS[@]}"; do
    [ -d "$cache_dir" ] && rm -rf "$cache_dir" && echo "✓ Cleared cache: $cache_dir"
done

# Update desktop database
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

echo ""
echo "Lectura has been completely uninstalled."
