# Uninstallation Guide

This guide covers complete removal of Lectura Electron app from Windows, Linux, and macOS systems.

---

## 🪟 Windows Uninstallation

### Using Uninstaller Script
```batch
# Run the uninstaller
uninstall-windows.bat
```

### Manual Uninstallation
```batch
# 1. Delete installation directory
rmdir /s "%LOCALAPPDATA%\Lectura"

# 2. Delete Desktop shortcut
del "%USERPROFILE%\Desktop\Lectura.lnk"

# 3. Delete Start Menu shortcut
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Lectura.lnk"
```

### Clean User Data (Optional)
```batch
# Remove user notes and settings
rmdir /s "%USERPROFILE%\Documents\Lectura"
rmdir /s "%APPDATA%\Lectura"
```

---

## 🍎 macOS Uninstallation

### Using Uninstaller Script
```bash
chmod +x uninstall-macos.sh
./uninstall-macos.sh
```

### Manual Uninstallation
```bash
# 1. Remove installation directory
rm -rf "$HOME/Library/Application Support/Lectura"

# 2. Remove command line launcher
sudo rm -f /usr/local/bin/lectura-app

# 3. Remove macOS app bundle
rm -rf /Applications/Lectura.app
```

### Clean User Data (Optional)
```bash
# Remove user notes and settings
rm -rf ~/Documents/Lectura
rm -rf ~/Library/Preferences/com.lectura.app.plist
```

---

## 🐧 Linux Uninstallation

### Using Uninstaller Script
```bash
chmod +x uninstall-linux.sh
./uninstall-linux.sh
```

### Manual Uninstallation
```bash
# 1. Remove installation directory
rm -rf ~/.local/share/lectura

# 2. Remove launcher
rm -f ~/.local/bin/lectura-app

# 3. Remove desktop entry
rm -f ~/.local/share/applications/lectura.desktop

# 4. Update desktop database
update-desktop-database ~/.local/share/applications/
```

### Clean User Data (Optional)
```bash
# Remove user notes and settings
rm -rf ~/Documents/Lectura
rm -rf ~/.config/lectura
```

---

## 🔧 Troubleshooting

### "Access Denied" Errors (Windows)
```batch
# Run Command Prompt as Administrator
# Or use PowerShell as Administrator:
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Lectura"
```

### "Permission Denied" Errors (Linux/macOS)
```bash
# Check file ownership
ls -la ~/.local/share/lectura  # Linux
ls -la "$HOME/Library/Application Support/Lectura"  # macOS

# Fix permissions if needed
sudo chown -R $USER:$USER ~/.local/share/lectura  # Linux
```

### Lectura Still Running
```bash
# Windows: Kill all Lectura processes
taskkill /f /im lectura.exe

# Linux/macOS: Kill Lectura processes
pkill -f lectura
```

---

## 🔄 Reinstallation

After uninstallation, reinstall by following the [INSTALL.md](INSTALL.md) guide.

---

*For installation instructions, see [INSTALL.md](INSTALL.md)*
