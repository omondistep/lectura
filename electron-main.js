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
  const pythonCmd = isWin 
    ? path.join(__dirname, 'venv', 'Scripts', 'python.exe')
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
    title: 'Lectura',
    show: false,
    backgroundColor: '#0d1117',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: false  // Disable developer tools
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

  // Poll for Python server readiness instead of fixed 3s delay
  waitForServer('http://127.0.0.1:8000', 50).then(() => {
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
          // Give up and try loading anyway
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
  // Native OS folder picker — user can right-click > "New Folder" inside the dialog
  // then select it, just like Typora's "Open Folder"
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
