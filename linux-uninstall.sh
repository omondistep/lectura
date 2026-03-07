#!/bin/bash
echo "Uninstalling Lectura..."

# Remove installation directory
if [ -d "$HOME/.local/share/lectura" ]; then
  rm -rf "$HOME/.local/share/lectura"
  echo "[+] Installation files removed"
fi

# Remove launcher
if [ -f "$HOME/.local/bin/lectura" ]; then
  rm -f "$HOME/.local/bin/lectura"
  echo "[+] Launcher removed"
fi

# Remove desktop entry
if [ -f "$HOME/.local/share/applications/lectura.desktop" ]; then
  rm -f "$HOME/.local/share/applications/lectura.desktop"
  echo "[+] Desktop entry removed"
fi

# Update desktop database
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database "$HOME/.local/share/applications/" 2>/dev/null
  echo "[+] Desktop database updated"
fi

echo ""
echo "Lectura has been completely uninstalled."
