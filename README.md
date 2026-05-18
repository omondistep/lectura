# Lectura

A modern, self-hosted Markdown note-taking application with real-time preview, cloud sync, and comprehensive Vim support.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.8+-blue.svg)
![Platform](https://img.shields.io/badge/platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey.svg)

## One-Line Install

**Linux / macOS:**
```sh
curl -fsSL https://lectura.app/install.sh | sh
```

**Windows (Git Bash / WSL):**
```sh
curl -fsSL https://lectura.app/install.sh | sh
```

Or clone and run manually:
```sh
git clone https://github.com/omondistep/lectura.git
cd lectura
chmod +x install.sh
./install.sh
```

## Features

- **Split-pane interface** — Editor on left, live preview on right
- **Synchronized scrolling** — Editor and preview move together
- **Full Vim support** — Normal, Insert, Visual, and Command modes
- **15+ themes** — Dark, light, and specialty themes with unique typography
- **GitHub sync** — Publish and sync notes to GitHub repositories
- **Google Drive backup** — Automatic backup to Google Drive
- **AI Assistant** — Local AI (Ollama) or OpenAI integration
- **Integrated terminal** — Built-in terminal panel (Zed-style)
- **Mermaid diagrams** — Create flowcharts, sequence diagrams, and more
- **Math support** — LaTeX math rendering with KaTeX
- **Export** — HTML, PDF, and Markdown export
- **Auto-update** — Automatic updates on all platforms

## Platform Builds

| Platform | Format | Command |
|----------|--------|---------|
| Linux | AppImage, .deb, .rpm, pacman, snap | `npm run build-linux` |
| macOS | .dmg, .zip (x64 + arm64) | `npm run build-mac` |
| Windows | .exe (NSIS), .msi, portable | `npm run build-win` |

Build scripts for each platform:
```sh
./build-appimage.sh   # Linux AppImage
./build-mac.sh        # macOS .dmg
build-win.bat         # Windows installer
```

## Quick Start

1. **Launch Lectura** — Run `lectura` (or search in applications menu)
2. **Create your first note** — Click `+` or press `Ctrl+N`
3. **Start writing** — Editor on the left, preview on the right
4. **Organize with folders** — Create folders to organize your notes

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| New file | `Ctrl+N` |
| Save file | `Ctrl+S` |
| Open file | `Ctrl+O` |
| Toggle sidebar | `Ctrl+Shift+L` |
| Toggle preview | `F7` |
| Focus mode | `F8` |
| Command palette | `Ctrl+Shift+P` |
| AI Assistant | `Ctrl+Shift+A` |
| Terminal | `Ctrl+`` |

## Configuration

Set environment variables in a `.env` file or export them:

```env
# AI Provider (Ollama is default)
AI_PROVIDER=ollama
AI_MODEL=llama3.2

# Or use OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sk-...
```

## Uninstall

```sh
curl -fsSL https://lectura.app/uninstall.sh | sh
```

Or run the included script:
```sh
chmod +x uninstall.sh
./uninstall.sh
```

## License

MIT License — See [LICENSE](LICENSE) for details.
