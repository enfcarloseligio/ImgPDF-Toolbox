const { app, BrowserWindow } = require('electron');
const { createWindow } = require('./src/window');

// Registrar todos los handlers IPC antes de crear la ventana
require('./src/store');
require('./src/ipc-system');
require('./src/ipc-conversions');
require('./src/ipc-pdf-ops');
require('./src/ipc-annotations');

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});