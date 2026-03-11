const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Only disable GPU if needed (env var override)
if (process.env.LECTURA_DISABLE_GPU) {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

let mainWindow;
let pythonProcess;

function startPython() {
  const isWin = os.platform() === 'win32';
  // Use pythonw on Windows to avoid spawning a console window
  const pythonCmd = isWin
    ? path.join(__dirname, 'venv', 'Scripts', 'pythonw.exe')
    : path.join(__dirname, 'venv', 'bin', 'python3');
  
  pythonProcess = spawn(pythonCmd, ['main.py'], {
    cwd: __dirname,
    stdio: 'pipe'
  });
  
  pythonProcess.stdout.on('data', (data) => console.log(`[Python] ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`[Python] ${data}`));
}

function createWindow() {
  console.log('[Electron] Creating window...');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 600,
    minHeight: 400,
    title: 'Lectura',
    icon: path.join(__dirname, 'static', 'icons', 'icon-256.png'),
    show: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false,  // Disable developer tools
      cache: true  // Enable cache for faster startup
    }
  });
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
  waitForServer('http://127.0.0.1:8000', 20).then(() => {
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
