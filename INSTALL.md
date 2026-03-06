# Installation Guide

This guide covers installation of Lectura on Windows, Linux, and macOS systems.

## 📋 System Requirements

- **Python 3.8+** (required for all installations)
- **Node.js 16+** (required for Electron desktop app only)
- **Modern web browser** (Chrome, Firefox, Safari, Edge)
- **Internet connection** (for cloud sync features)

---

## 🪟 Windows Installation

Lectura offers two installation options for Windows:

### Option 1: Standalone (Recommended)
Browser-based installation - lightweight and simple.

#### Quick Install
1. **Download** the latest release from [GitHub Releases](https://github.com/omondistep/lectura/releases)
2. **Extract** the ZIP file to a folder
3. **Right-click** `install-standalone-windows.bat` → **Run as Administrator**
4. **Launch** from Desktop shortcut or Start Menu

#### Manual Steps
```batch
# 1. Download and extract Lectura
# 2. Open Command Prompt as Administrator
# 3. Navigate to Lectura folder
cd C:\path\to\lectura

# 4. Run installer
install-standalone-windows.bat
```

**What it does:**
- Installs Python dependencies in isolated environment
- Creates Desktop and Start Menu shortcuts
- Sets up auto-launch in browser
- No console windows (runs silently)

### Option 2: Desktop App (Electron)
Native desktop application with system integration.

#### Requirements
- Node.js 16+ ([Download here](https://nodejs.org/))
- Python 3.8+ ([Download here](https://python.org/downloads/))

#### Installation
```batch
# 1. Install Node.js and Python (check "Add to PATH")
# 2. Download and extract Lectura
# 3. Run installer
install-electron-windows.bat
```

**Features:**
- Native desktop window
- System tray integration
- Offline-first design
- No browser dependency

---

## 🍎 macOS Installation

### Option 1: Standalone (Recommended)
Browser-based installation using Homebrew or system Python.

#### Requirements
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python 3
brew install python
```

#### Installation
```bash
# 1. Download and extract Lectura
curl -L https://github.com/omondistep/lectura/archive/main.zip -o lectura.zip
unzip lectura.zip
cd lectura-main

# 2. Run installer
chmod +x install-standalone-macos.sh
./install-standalone-macos.sh
```

**Features:**
- Creates native macOS app bundle in Applications
- Command line launcher: `lectura`
- Auto-opens in default browser
- Integrates with macOS Spotlight search

### Option 2: Desktop App (Electron)
Native desktop application with full macOS integration.

#### Requirements
```bash
# Install Node.js and Python
brew install node python
```

#### Installation
```bash
# Download and install
curl -L https://github.com/omondistep/lectura/archive/main.zip -o lectura.zip
unzip lectura.zip
cd lectura-main

# Run installer
chmod +x install-electron-macos.sh
./install-electron-macos.sh
```

**Features:**
- Native macOS window with system integration
- Dock integration
- Native notifications
- Offline-first design

---

## 🐧 Linux Installation

### Option 1: Standalone (Recommended)
Browser-based installation - works on all distributions.

#### Ubuntu/Debian
```bash
# 1. Install dependencies
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 2. Download and install Lectura
wget https://github.com/omondistep/lectura/archive/main.zip
unzip main.zip
cd lectura-main

# 3. Run installer
chmod +x install-standalone-linux.sh
./install-standalone-linux.sh
```

#### Fedora/RHEL
```bash
# 1. Install dependencies
sudo dnf install python3 python3-pip

# 2. Download and install Lectura
wget https://github.com/omondistep/lectura/archive/main.zip
unzip main.zip
cd lectura-main

# 3. Run installer
chmod +x install-standalone-linux.sh
./install-standalone-linux.sh
```

#### Arch Linux
```bash
# 1. Install dependencies
sudo pacman -S python python-pip

# 2. Download and install Lectura
wget https://github.com/omondistep/lectura/archive/main.zip
unzip main.zip
cd lectura-main

# 3. Run installer
chmod +x install-standalone-linux.sh
./install-standalone-linux.sh
```

### Option 2: Desktop App (Electron)
Native desktop application.

#### Requirements
```bash
# Ubuntu/Debian
sudo apt install nodejs npm python3 python3-pip python3-venv

# Fedora
sudo dnf install nodejs npm python3 python3-pip

# Arch
sudo pacman -S nodejs npm python python-pip
```

#### Installation
```bash
# Download and install
wget https://github.com/omondistep/lectura/archive/main.zip
unzip main.zip
cd lectura-main

# Run installer (auto-detects your distribution)
chmod +x install-electron-linux.sh
./install-electron-linux.sh
```

---

## 🚀 Post-Installation

### First Launch
1. **Launch Lectura** from Desktop shortcut or command line
2. **Create your first note** - Click the + button
3. **Explore features** - Try different themes, Vim mode, etc.
4. **Set up cloud sync** (optional) - File → Preferences → Cloud

### Command Line Usage
```bash
# Launch Lectura (after installation)
lectura

# Or visit directly in browser
http://127.0.0.1:8000
```

### Configuration
- **Preferences**: File → Preferences or `Ctrl+,`
- **Themes**: Themes menu or `:theme <name>` in Vim mode
- **Cloud Setup**: See [OAUTH_SETUP.md](OAUTH_SETUP.md)

---

## 🗑️ Uninstallation

### Windows

#### Standalone Version
```batch
# 1. Delete installation directory
rmdir /s "%LOCALAPPDATA%\Lectura"

# 2. Delete shortcuts
del "%USERPROFILE%\Desktop\Lectura.lnk"
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Lectura.lnk"
```

#### Electron Version
```batch
# Same as standalone, plus:
# 3. Remove from Programs list (if installed via installer)
# Control Panel → Programs → Uninstall Lectura
```

### Linux

#### Both Versions
```bash
# 1. Delete installation directory
rm -rf ~/.local/share/lectura

# 2. Delete launcher
rm -f ~/.local/bin/lectura

# 3. Delete desktop entry
rm -f ~/.local/share/applications/lectura.desktop

# 4. Update desktop database
update-desktop-database ~/.local/share/applications/
```

---

## 🔧 Troubleshooting

### Common Issues

#### Windows: "Python not found"
```batch
# Install Python from python.org
# IMPORTANT: Check "Add Python to PATH" during installation
# Restart Command Prompt and try again
```

#### Linux: "Permission denied"
```bash
# Make installer executable
chmod +x install-*.sh

# Or run with bash
bash install-standalone-linux.sh
```

#### Port 8000 already in use
```bash
# Find process using port 8000
netstat -tulpn | grep :8000

# Kill the process (replace PID)
kill <PID>

# Or use different port
python main.py --port 8001
```

#### Browser doesn't open automatically
- **Manual**: Open browser and go to `http://127.0.0.1:8000`
- **Firewall**: Allow Python through firewall
- **Antivirus**: Add Lectura folder to exclusions

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/omondistep/lectura/issues)
- **Discussions**: [GitHub Discussions](https://github.com/omondistep/lectura/discussions)
- **Documentation**: Check README.md and other .md files

---

## 📦 Development Installation

For developers who want to contribute:

```bash
# Clone repository
git clone https://github.com/omondistep/lectura.git
cd lectura

# Install Python dependencies
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate     # Windows

pip install -r requirements.txt

# Install Node.js dependencies (for Electron)
npm install

# Run development server
python main.py

# Or run Electron app
npm start
```

---

*For more detailed information, see the main [README.md](README.md) file.*
