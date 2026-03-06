# Lectura

A modern, self-hosted Markdown note-taking application featuring real-time preview, cloud sync, and comprehensive Vim support.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows-lightgrey.svg)

## ✨ Features

### 📝 **Editor & Preview**
- **Split-pane interface** - Editor on left, live preview on right
- **Synchronized scrolling** - Editor and preview move together
- **Resizable panes** - Adjust editor/preview ratio to your preference
- **Focus modes** - Editor-only, preview-only, or split view
- **Clean, distraction-free interface** - Minimalist design for focused writing

### ⌨️ **Vim Integration**
- **Full Vim support** - Complete Normal, Insert, Visual, and Command modes
- **Custom Ex commands** - `:w`, `:e`, `:new`, `:theme`, `:preview`, and more
- **File navigation** - `:bn`, `:bp` to switch between files
- **Mode indicator** - Visual feedback for current Vim mode

### 🎨 **Themes & Typography**
- **15+ themes** - Dark, light, and specialty themes
- **Font variations** - Each theme has distinct typography (serif, sans-serif)
- **Live theme switching** - Change themes instantly without restart
- **Custom CSS support** - Extend with your own themes

### 📁 **File Management**
- **Sidebar file browser** - Tree and list views
- **Folder organization** - Nested folder support
- **Pin/unpin folders** - Quick access to frequently used folders
- **File search** - Find files quickly across your workspace
- **Recent locations** - Easy access to recently opened folders

### ☁️ **Cloud Sync**
- **GitHub integration** - Sync notes to GitHub repositories
- **Google Drive support** - Backup to Google Drive
- **OAuth authentication** - Secure cloud connections
- **Selective sync** - Choose what to sync

### 🔧 **Advanced Features**
- **Mermaid diagrams** - Create flowcharts, sequence diagrams, and more
- **Math support** - LaTeX math rendering with KaTeX
- **Image handling** - Drag and drop image uploads
- **Export options** - HTML, PDF, and Markdown export
- **Flashcards** - Built-in spaced repetition system
- **Custom graph canvas** - Draw economic graphs and charts

## 🚀 Quick Start

### Option 1: Standalone (Recommended)
Lightweight, browser-based installation.

#### Linux
```bash
chmod +x install-standalone-linux.sh
./install-standalone-linux.sh
lectura
```

#### Windows
1. Download and extract the Lectura folder
2. Right-click `install-standalone-windows.bat` → Run as Administrator
3. Double-click the Lectura icon on your Desktop

### Option 2: Desktop App (Electron)
Native desktop application with system integration.

**Requirements:** Node.js 16+ and Python 3.8+

#### Linux
```bash
chmod +x install-electron-linux.sh
./install-electron-linux.sh
lectura-app
```

#### Windows
```bash
install-electron-windows.bat
```

### Manual Installation
```bash
git clone https://github.com/omondistep/lectura.git
cd lectura
pip install -r requirements.txt
python main.py
```

Open http://localhost:8000 in your browser.

## 📖 Usage

### Getting Started
1. **Launch Lectura** - Opens at http://localhost:8000
2. **Create your first note** - Click the + button or press `Ctrl+N`
3. **Start writing** - Use the editor on the left, see preview on the right
4. **Organize with folders** - Create folders to organize your notes

### Keyboard Shortcuts
| Action | Shortcut |
|--------|----------|
| New file | `Ctrl+N` |
| Save file | `Ctrl+S` |
| Open file | `Ctrl+O` |
| Toggle sidebar | `Ctrl+Shift+L` |
| Toggle preview | `F7` |
| Focus mode | `F8` |
| Bold text | `Ctrl+B` |
| Italic text | `Ctrl+I` |
| Insert link | `Ctrl+K` |

### Vim Commands
| Command | Action |
|---------|--------|
| `:w` | Save current file |
| `:e filename` | Open file |
| `:new` | Create new file |
| `:bn` / `:bp` | Next/previous file |
| `:theme name` | Switch theme |
| `:preview` | Toggle preview pane |
| `:help` | Open help panel |

## 🎨 Themes

Lectura includes 15+ carefully crafted themes:

**Built-in Themes:**
- **Light/Dark** - Classic clean themes
- **Cobalt** - Blue-accented dark theme
- **Nord** - Arctic-inspired color palette
- **Drake** - Elegant dark theme with serif fonts
- **Vue** - Green-accented modern theme
- **GitHub** - Familiar GitHub styling
- **And many more...**

Each theme features unique typography choices - some use serif fonts for a book-like reading experience, others use modern sans-serif fonts.

## ☁️ Cloud Setup

Connect your favorite cloud services for automatic backup and sync:

1. **GitHub** - Sync notes to repositories
2. **Google Drive** - Backup to your Drive
3. **Dropbox** - Cross-device synchronization

See [OAUTH_SETUP.md](OAUTH_SETUP.md) for detailed setup instructions.

## 🛠️ Configuration

### Preferences
Access via `File → Preferences` or `Ctrl+,`:

- **Editor settings** - Font size, indentation, line endings
- **Theme selection** - Choose from available themes
- **Vim mode** - Enable/disable Vim keybindings
- **Export options** - Configure export formats and locations
- **Cloud sync** - Manage connected services

### Custom Themes
Create custom themes by adding CSS files to the `static/themes/` directory. Themes can override:
- Color schemes
- Typography (fonts, sizes, spacing)
- Layout adjustments
- Custom styling

## 🔧 Development

### Requirements
- Python 3.8+
- Modern web browser
- Internet connection (for cloud features)

### Project Structure
```
lectura/
├── static/           # Frontend assets
│   ├── editor.js    # Main editor logic
│   ├── style.css    # Core styles
│   └── themes/      # Theme files
├── templates/       # HTML templates
├── main.py         # Backend server
└── requirements.txt # Python dependencies
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [CodeMirror 6](https://codemirror.net/) - Powerful code editor
- Vim support via [@replit/codemirror-vim](https://github.com/replit/codemirror-vim)
- Markdown rendering by [markdown-it](https://github.com/markdown-it/markdown-it)

## 👨‍💻 Author

**Made by a Kenyan**
- Twitter: [@Stephenondiek](https://twitter.com/Stephenondiek)
- GitHub: [@omondistep](https://github.com/omondistep)

---

*Lectura - Where words become wisdom* ✨
