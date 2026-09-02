const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFiles: (filters) => ipcRenderer.invoke('select-files', filters)
});