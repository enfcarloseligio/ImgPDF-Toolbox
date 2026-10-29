// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     main.js
// Descripción: Punto de entrada del proceso principal de Electron. Registra los handlers IPC
//              de src/ y crea la ventana principal al estar la aplicación lista.
// ═════════════════════════════════════════════════════════════════════════════

const { app, BrowserWindow } = require('electron');
const { createWindow } = require('./src/window');

// ── Registro de handlers IPC ───────────────────────────────────────────────────
// Deben registrarse antes de crear la ventana para que el renderer los encuentre.
require('./src/store');
require('./src/ipc-system');
require('./src/ipc-conversions');
require('./src/ipc-pdf-ops');
require('./src/ipc-annotations');
require('./src/ipc-images');

// ── Ciclo de vida de la aplicación ─────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});