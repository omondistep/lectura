const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  openFolderDialog: (defaultPath) => ipcRenderer.invoke('open-folder-dialog', defaultPath),
  createNewFileDialog: (defaultPath) => ipcRenderer.invoke('create-new-file-dialog', defaultPath),
  createNewFolderDialog: (defaultPath) => ipcRenderer.invoke('create-new-folder-dialog', defaultPath),
  openInNewWindow: (filePath) => ipcRenderer.invoke('open-in-new-window', filePath),
  setWindowOpacity: (opacity) => ipcRenderer.invoke('set-window-opacity', opacity),
  getWindowOpacity: () => ipcRenderer.invoke('get-window-opacity')
});
