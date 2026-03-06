# Uninstallation Guide

This guide covers complete removal of Lectura from Windows and Linux systems.

---

## 🪟 Windows Uninstallation

### Standalone Version

#### Automatic Uninstall Script
Create a file called `uninstall-lectura.bat` and run as Administrator:

```batch
@echo off
echo Uninstalling Lectura...

:: Remove installation directory
if exist "%LOCALAPPDATA%\Lectura" (
    echo Removing installation files...
    rmdir /s /q "%LOCALAPPDATA%\Lectura"
    echo [+] Installation files removed
)

:: Remove Desktop shortcut
if exist "%USERPROFILE%\Desktop\Lectura.lnk" (
    del "%USERPROFILE%\Desktop\Lectura.lnk"
    echo [+] Desktop shortcut removed
)

:: Remove Start Menu shortcut
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Lectura.lnk" (
    del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Lectura.lnk"
    echo [+] Start Menu shortcut removed
)

echo.
echo Lectura has been completely uninstalled.
pause
```

#### Manual Steps
```batch
# 1. Delete installation directory
rmdir /s "%LOCALAPPDATA%\Lectura"

# 2. Delete Desktop shortcut
del "%USERPROFILE%\Desktop\Lectura.lnk"

# 3. Delete Start Menu shortcut
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Lectura.lnk"

# 4. Clean registry (optional)
# No registry entries are created by Lectura
```

### Electron Desktop Version

#### If installed via installer package
1. **Control Panel** → **Programs and Features**
2. **Find "Lectura"** in the list
3. **Click "Uninstall"** and follow prompts

#### If installed via batch script
Follow the same steps as Standalone Version above.

### Clean User Data (Optional)

```batch
# Remove user notes and settings (if you want to start fresh)
rmdir /s "%USERPROFILE%\Documents\Lectura"
rmdir /s "%APPDATA%\Lectura"
```

---

## 🐧 Linux Uninstallation

### Both Standalone and Electron Versions

#### Automatic Uninstall Script
Create and run this script:

```bash
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
```

#### Manual Steps
```bash
# 1. Remove installation directory
rm -rf ~/.local/share/lectura

# 2. Remove launcher
rm -f ~/.local/bin/lectura

# 3. Remove desktop entry
rm -f ~/.local/share/applications/lectura.desktop

# 4. Update desktop database
update-desktop-database ~/.local/share/applications/
```

### Clean User Data (Optional)

```bash
# Remove user notes and settings (if you want to start fresh)
rm -rf ~/Documents/Lectura
rm -rf ~/.config/lectura
```

### Remove System Dependencies (Optional)

Only do this if you don't need these packages for other applications:

#### Ubuntu/Debian
```bash
sudo apt remove python3-pip nodejs npm
sudo apt autoremove
```

#### Fedora
```bash
sudo dnf remove python3-pip nodejs npm
```

#### Arch Linux
```bash
sudo pacman -R python-pip nodejs npm
```

---

## 🧹 Complete System Cleanup

### Verify Removal

#### Windows
```batch
# Check if any Lectura processes are running
tasklist | findstr lectura
tasklist | findstr python

# Check for remaining files
dir "%LOCALAPPDATA%" | findstr Lectura
dir "%APPDATA%" | findstr Lectura
```

#### Linux
```bash
# Check if any Lectura processes are running
ps aux | grep lectura
ps aux | grep python

# Check for remaining files
find ~ -name "*lectura*" -type f 2>/dev/null
find ~ -name "*lectura*" -type d 2>/dev/null
```

### Remove Python Virtual Environment Cache (Optional)

#### Windows
```batch
# Clear pip cache
pip cache purge

# Remove Python cache files
for /d /r . %d in (__pycache__) do @if exist "%d" rd /s /q "%d"
```

#### Linux
```bash
# Clear pip cache
pip cache purge

# Remove Python cache files
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -name "*.pyc" -delete
```

---

## 🔄 Reinstallation

After uninstallation, you can reinstall Lectura by:

1. **Download** the latest version from [GitHub](https://github.com/omondistep/lectura)
2. **Follow** the installation guide in [INSTALL.md](INSTALL.md)
3. **Your notes** will be preserved if you didn't delete user data

---

## ❓ Troubleshooting Uninstallation

### "Access Denied" Errors (Windows)
```batch
# Run Command Prompt as Administrator
# Or use PowerShell as Administrator:
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Lectura"
```

### "Permission Denied" Errors (Linux)
```bash
# Check file ownership
ls -la ~/.local/share/lectura

# Fix permissions if needed
sudo chown -R $USER:$USER ~/.local/share/lectura
rm -rf ~/.local/share/lectura
```

### Lectura Still Running
```bash
# Windows: Kill all Python processes
taskkill /f /im python.exe

# Linux: Kill Lectura processes
pkill -f lectura
pkill -f "python.*main.py"
```

### Files Won't Delete
- **Close all browsers** that might have Lectura open
- **Restart your computer** and try again
- **Use safe mode** (Windows) if files are locked

---

## 📞 Need Help?

If you encounter issues during uninstallation:

- **Check our [Issues](https://github.com/omondistep/lectura/issues)** page
- **Create a new issue** with details about your problem
- **Include your OS version** and error messages

---

*For installation instructions, see [INSTALL.md](INSTALL.md)*
