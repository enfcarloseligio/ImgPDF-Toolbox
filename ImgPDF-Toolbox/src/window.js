// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/window.js
// Descripción: Creación y configuración de la ventana principal (BrowserWindow) con
//              aislamiento de contexto y sin integración de Node en el renderer.
// ═════════════════════════════════════════════════════════════════════════════

const { BrowserWindow } = require('electron');
const path = require('path');
const fs   = require('fs');

// ── Ventana principal ──────────────────────────────────────────────────────────
// Crea el BrowserWindow, aplica el icono si existe y carga renderer/index.html.

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'renderer', 'assets', 'icon.ico');

  const win = new BrowserWindow({
    width: 980, height: 700, minWidth: 820, minHeight: 620,
    autoHideMenuBar: true,
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  return win;
}

// ── Exportaciones ──────────────────────────────────────────────────────────────

module.exports = { createWindow };