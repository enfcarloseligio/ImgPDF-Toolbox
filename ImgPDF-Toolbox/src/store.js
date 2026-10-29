// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/store.js
// Descripción: Persistencia de preferencias del usuario en un JSON dentro de userData
//              (settings.json) y handlers IPC store-get / store-set.
// ═════════════════════════════════════════════════════════════════════════════

const { app, ipcMain } = require('electron');
const fs   = require('fs');
const path = require('path');

// ── Lectura y escritura del archivo de preferencias ────────────────────────────

function getStorePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(getStorePath(), 'utf8'));
  } catch (_) { return {}; }
}

function writeStore(data) {
  try {
    fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

// ── Handlers IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('store-get', (event, key) => readStore()[key] ?? null);

ipcMain.handle('store-set', (event, key, value) => {
  const store = readStore();
  store[key] = value;
  writeStore(store);
  return true;
});

// ── Exportaciones ──────────────────────────────────────────────────────────────

module.exports = { readStore, writeStore };