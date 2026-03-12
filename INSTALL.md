# Installation Guide

This guide covers installation of Lectura Electron desktop app on Windows, Linux, and macOS systems.

## 📋 System Requirements

- **Python 3.8+**
- **Node.js 16+**
- **Internet connection** (for cloud sync features)

---

## 🪟 Windows Installation

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

---

## 🍎 macOS Installation

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

---

## 🐧 Linux Installation

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
1. **Launch Lectura** from Desktop shortcut or command line (`lectura-app`)
2. **Create your first note** - Click the + button
3. **Explore features** - Try different themes, Vim mode, etc.
4. **Set up cloud sync** (optional) - File → Preferences → Cloud

### Configuration
- **Preferences**: File → Preferences or `Ctrl+,`
- **Themes**: Themes menu or `:theme <name>` in Vim mode
- **Cloud Setup**: See [OAUTH_SETUP.md](OAUTH_SETUP.md)

---

## 🗑️ Uninstallation

### Windows
```batch
# Run uninstaller
uninstall-electron-windows.bat
```

### Linux
```bash
# Run uninstaller
./uninstall-electron-linux.sh
```

### macOS
```bash
# Run uninstaller
./uninstall-electron-macos.sh
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

#### Windows: "Node.js not found"
```batch
# Install Node.js from nodejs.org
# Check "Add to PATH" during installation
# Restart Command Prompt and try again
```

#### Linux: "Permission denied"
```bash
# Make installer executable
chmod +x install-electron-linux.sh
```

#### Port 8000 already in use
```bash
# Find process using port 8000
netstat -tulpn | grep :8000

# Kill the process (replace PID)
kill <PID>
```

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
