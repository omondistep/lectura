const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Only disable GPU if needed (env var override)
if (process.env.LECTURA_DISABLE_GPU) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

// Zed-like snappiness: enable GPU compositing & reduce latency
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,VaapiVideoEncoder');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '512');

let mainWindow;
let pythonProcess;

// Load saved opacity from a simple JSON file in data dir
function getSavedOpacity() {
  try {
    const configPath = path.join(getDataDir(), 'window-config.json');
    if (fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return data.opacity ?? 1.0;
    }
  } catch {}
  return 1.0;
}

function saveWindowConfig(config) {
  const configPath = path.join(getDataDir(), 'window-config.json');
  fs.mkdirSync(getDataDir(), { recursive: true });
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
  fs.writeFileSync(configPath, JSON.stringify({ ...existing, ...config }));
}

// When running as AppImage, __dirname is read-only (squashfs).
// We extract the bundled venv to a writable data dir on first run.
function getDataDir() {
  return path.join(os.homedir(), '.local', 'share', 'lectura');
}

function ensureVenv() {
  const dataDir = getDataDir();
  const venvDest = path.join(dataDir, 'venv');
  const bundledVenv = path.join(__dirname, 'bundled-venv');

  // If a bundled venv exists (AppImage build) and destination doesn't, copy it
  if (fs.existsSync(bundledVenv) && !fs.existsSync(venvDest)) {
    fs.mkdirSync(dataDir, { recursive: true });
    execFileSync('cp', ['-a', bundledVenv, venvDest]);
    // Fix shebangs so venv works from new location
    execFileSync('python3', ['-m', 'venv', '--upgrade', venvDest]);
  }

  return venvDest;
}

function startPython() {
  const isWin = os.platform() === 'win32';
  const venvDir = ensureVenv();
  const pythonCmd = isWin
    ? path.join(venvDir, 'Scripts', 'pythonw.exe')
    : path.join(venvDir, 'bin', 'python3');

  // main.py lives in __dirname (inside AppImage squashfs, read-only is fine for source)
  pythonProcess = spawn(pythonCmd, [path.join(__dirname, 'main.py')], {
    cwd: getDataDir(),
    stdio: 'pipe'
  });
  
  pythonProcess.stdout.on('data', (data) => console.log(`[Python] ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`[Python] ${data}`));
}

function createWindow() {
  console.log('[Electron] Creating window...');
  const savedOpacity = getSavedOpacity();
  const isTransparent = savedOpacity < 1.0;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 600,
    minHeight: 400,
    title: 'Lectura',
    icon: path.join(__dirname, 'static', 'icons', 'icon-256.png'),
    show: false,
    backgroundColor: isTransparent ? undefined : '#0d1117',
    transparent: isTransparent,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false,
      cache: true,
      backgroundThrottling: false,  // Keep responsive when backgrounded
      enableBlinkFeatures: 'CSSContainmentBlockSize',
      v8CacheOptions: 'code',  // Cache compiled JS for faster startup
    }
  });

  // Apply saved opacity
  if (savedOpacity < 1.0) {
    mainWindow.setOpacity(savedOpacity);
  }
  console.log('[Electron] Window created');

  // Hide native menu bar
  Menu.setApplicationMenu(null);

  // Show window once content is painted (no white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Show minimal splash screen while Python starts up
  mainWindow.loadFile(path.join(__dirname, 'static', 'splash.html'));

  // Once server is ready, reload from the live server
  waitForServer('http://127.0.0.1:8000', 10).then(() => {
    console.log('[Electron] Server ready, loading URL...');
    mainWindow.loadURL('http://127.0.0.1:8000');
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function waitForServer(url, intervalMs, maxAttempts = 100) {
  const http = require('http');
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, intervalMs);
        } else {
          console.error('[Electron] Server failed to start after max attempts');
          dialog.showErrorBox('Lectura', 'Could not connect to the Python server. Please check that Python and dependencies are installed correctly.');
          resolve();
        }
      });
      req.setTimeout(200, () => {
        req.destroy();
        if (attempts < maxAttempts) {
          setTimeout(check, intervalMs);
        } else {
          resolve();
        }
      });
    };
    check();
  });
}

ipcMain.handle('set-window-opacity', async (event, opacity) => {
  const value = Math.max(0.3, Math.min(1.0, parseFloat(opacity) || 1.0));
  if (mainWindow) {
    mainWindow.setOpacity(value);
  }
  saveWindowConfig({ opacity: value });
  return value;
});

ipcMain.handle('get-window-opacity', async () => {
  return getSavedOpacity();
});

ipcMain.handle('open-folder-dialog', async (event, defaultPath) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath || os.homedir(),
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0].replace(/\\/g, '/');
  }
  return null;
});

ipcMain.handle('create-new-file-dialog', async (event, defaultPath) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Create New File',
    defaultPath: defaultPath || 'untitled.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Plain Text', extensions: ['txt'] },
      { name: 'Text Bundle', extensions: ['textbundle'] }
    ],
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });
  if (!result.canceled && result.filePath) {
    return result.filePath.replace(/\\/g, '/');
  }
  return null;
});

ipcMain.handle('create-new-folder-dialog', async (event, defaultPath) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select or Create Folder',
    defaultPath: defaultPath || '',
    buttonLabel: 'Select',
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0].replace(/\\/g, '/');
  }
  return null;
});

ipcMain.handle('open-in-new-window', async (event, filePath) => {
  const newWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Lectura',
    icon: path.join(__dirname, 'static', 'icons', 'icon-256.png'),
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false
    }
  });
  Menu.setApplicationMenu(null);
  const encodedPath = encodeURIComponent(filePath);
  newWindow.loadURL(`http://127.0.0.1:8000?open=${encodedPath}`);
});

app.on('ready', () => {
  startPython();
  createWindow();
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
