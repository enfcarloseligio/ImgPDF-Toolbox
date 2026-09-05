const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// ── Persistencia con archivo JSON en userData ─────────────────────────────────
// Reemplaza localStorage — más robusto y correcto para Electron en producción

function getStorePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readStore() {
  try {
    return JSON.parse(fs.readFileSync(getStorePath(), 'utf8'));
  } catch (_) { return {}; }
}

function writeStore(data) {
  try { fs.writeFileSync(getStorePath(), JSON.stringify(data, null, 2), 'utf8'); }
  catch (_) {}
}

ipcMain.handle('store-get', (event, key) => readStore()[key] ?? null);

ipcMain.handle('store-set', (event, key, value) => {
  const store = readStore();
  store[key] = value;
  writeStore(store);
  return true;
});

// ── Control de procesos y cancelación ────────────────────────────────────────

let currentProcess = null;
let isCancelled = false;

function run(cmd) {
  return new Promise((resolve, reject) => {
    currentProcess = exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      currentProcess = null;
      if (error) {
        reject(isCancelled ? 'Operación cancelada por el usuario.' : (stderr || error.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

function findGhostscript() {
  const pfDirs = ['C:\\Program Files\\gs', 'C:\\Program Files (x86)\\gs'];
  for (const base of pfDirs) {
    if (!fs.existsSync(base)) continue;
    for (const sub of fs.readdirSync(base)) {
      const p64 = path.join(base, sub, 'bin', 'gswin64c.exe');
      const p32 = path.join(base, sub, 'bin', 'gswin32c.exe');
      if (fs.existsSync(p64)) return `"${p64}"`;
      if (fs.existsSync(p32)) return `"${p32}"`;
    }
  }
  return 'gswin64c';
}

function getUniqueFilePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;
  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);
  let counter = 1, candidate;
  do { candidate = path.join(dir, `${base} (${counter++})${ext}`); }
  while (fs.existsSync(candidate));
  return candidate;
}

async function wingetAvailable() {
  try { await run('winget --version'); return true; }
  catch (_) { return false; }
}

// ── Ventana principal ─────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = path.join(__dirname, 'renderer', 'assets', 'icon.ico');
  const win = new BrowserWindow({
    width: 980, height: 700, minWidth: 820, minHeight: 620,
    autoHideMenuBar: true,
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── IPC: Sistema ─────────────────────────────────────────────────────────────

ipcMain.handle('select-files', async (event, filters) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'Todos los archivos', extensions: ['*'] }]
  });
  return canceled ? [] : filePaths;
});

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('open-url',    async (_, url)     => shell.openExternal(url));
ipcMain.handle('play-beep',   ()                 => shell.beep());

ipcMain.handle('open-folder', async (_, dirPath) => {
  if (dirPath && fs.existsSync(dirPath)) { await shell.openPath(dirPath); return true; }
  return false;
});

ipcMain.handle('cancel-operation', () => {
  isCancelled = true;
  if (currentProcess) { try { currentProcess.kill(); } catch (_) {} }
  return true;
});

// ── IPC: Verificar herramientas ───────────────────────────────────────────────

ipcMain.handle('check-tools', async () => {
  const result = { imageMagick: false, ghostscript: false, imVersion: '', gsVersion: '', winget: false };

  try {
    const imOut = await run('magick -version');
    const match = imOut.match(/ImageMagick\s+([\d.\-]+)/);
    result.imageMagick = true;
    result.imVersion = match ? match[1] : 'Detectado';
  } catch (_) {}

  try {
    const gsOut = await run(`${findGhostscript()} --version`);
    result.ghostscript = true;
    result.gsVersion = gsOut.trim();
  } catch (_) {}

  result.winget = await wingetAvailable();
  return result;
});

// ── IPC: Instalar herramientas ────────────────────────────────────────────────

ipcMain.handle('install-tool', async (_, tool) => {
  const baseDir = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(__dirname, 'extraResources');

  const localInstallers = {
    imagemagick: { file: 'ImageMagick-7.1.2-30-Q16-HDRI-x64-dll.exe', flags: '/VERYSILENT /NORESTART /TASKS="setpath"' },
    ghostscript:  { file: 'gs10071w64.exe', flags: '/S' }
  };

  const selected = localInstallers[tool];
  if (!selected) return { ok: false, error: 'Herramienta desconocida' };

  const installerPath = path.join(baseDir, selected.file);

  if (fs.existsSync(installerPath)) {
    try {
      await run(`"${installerPath}" ${selected.flags}`);
      return { ok: true, source: 'local' };
    } catch (e) {
      return { ok: false, error: `Error en instalador local: ${e.toString()}` };
    }
  }

  const hasWinget = await wingetAvailable();
  if (!hasWinget) return { ok: false, noWinget: true, error: 'winget no disponible en este sistema.' };

  const wingetCmds = {
    imagemagick: 'winget install --id ImageMagick.ImageMagick -e --accept-source-agreements --accept-package-agreements',
    ghostscript:  'winget install --id ArtifexSoftware.GhostScript -e --accept-source-agreements --accept-package-agreements',
  };

  try {
    await run(wingetCmds[tool]);
    return { ok: true, source: 'winget' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
});

// ── IPC: Actualizar herramientas ──────────────────────────────────────────────

ipcMain.handle('update-tools', async () => {
  const results = { imagemagick: 'error', ghostscript: 'error', wingetAvailable: false };
  const hasWinget = await wingetAvailable();
  results.wingetAvailable = hasWinget;
  if (!hasWinget) return results;

  const isUpToDate = (out) => {
    const t = (out || '').toLowerCase();
    return t.includes('successfully') || t.includes('correctamente') ||
           t.includes('no applicable') || t.includes('no se ha encontrado') ||
           t.includes('no hay versiones') || t.includes('no se encontr');
  };

  for (const [key, id] of [['imagemagick', 'ImageMagick.ImageMagick'], ['ghostscript', 'ArtifexSoftware.GhostScript']]) {
    try {
      const out = await run(`winget upgrade --id ${id}`);
      results[key] = isUpToDate(out) ? 'ok' : 'check';
    } catch (e) {
      results[key] = isUpToDate(e.toString()) ? 'ok' : 'error';
    }
  }

  return results;
});

// ── IPC: Conversiones ─────────────────────────────────────────────────────────

ipcMain.handle('convert-img-to-pdf', async (_, { files, quality, outputDir }) => {
  isCancelled = false;
  const results = [];
  for (const file of files) {
    if (isCancelled) { results.push({ file, ok: false, error: 'Cancelado' }); break; }
    const out = getUniqueFilePath(path.join(outputDir, path.basename(file, path.extname(file)) + '.pdf'));
    try {
      await run(`magick "${file}" -quality ${quality} "${out}"`);
      results.push({ file, out, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: String(e) });
      if (isCancelled) break;
    }
  }
  return results;
});

ipcMain.handle('convert-pdf-to-img', async (_, { files, density, format, background, outputDir }) => {
  isCancelled = false;
  const results = [];
  for (const file of files) {
    if (isCancelled) { results.push({ file, ok: false, error: 'Cancelado' }); break; }
    const name = path.basename(file, '.pdf');
    let baseName = name, counter = 1;
    while (fs.existsSync(path.join(outputDir, `${baseName}-001.${format}`))) {
      baseName = `${name} (${counter++})`;
    }
    const bgFlags = background !== 'original' ? `-background "${background}" -alpha remove -alpha off` : '';
    try {
      await run(`magick -density ${density} "${file}" ${bgFlags} -scene 1 "${path.join(outputDir, `${baseName}-%03d.${format}`)}"`);
      results.push({ file, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: String(e) });
      if (isCancelled) break;
    }
  }
  return results;
});

ipcMain.handle('merge-pdfs', async (_, { files, outputDir }) => {
  isCancelled = false;
  const gs  = findGhostscript();
  const out = getUniqueFilePath(path.join(outputDir, path.basename(files[0], '.pdf') + '-combinado.pdf'));
  try {
    await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dAutoRotatePages=/None -sOutputFile="${out}" ${files.map(f => `"${f}"`).join(' ')}`);
    return { ok: true, out };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle('get-pdf-info', async (_, file) => {
  try {
    const out = await run(`magick identify -ping -format "%n " "${file}"`);
    const pages = parseInt(out.trim().split(/\s+/)[0], 10) || 0;
    return { ok: true, pages };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
});

ipcMain.handle('split-pdf', async (_, { file, mode, blockSize, customRanges, outputDir, totalPages }) => {
  isCancelled = false;
  const gs   = findGhostscript();
  const name = path.basename(file, '.pdf');
  const results = [];

  // Validar rangos antes de ejecutar
  if (mode === 'custom') {
    const parts = customRanges.split(',').map(s => s.trim()).filter(s => s);
    for (const part of parts) {
      if (!/^\d+(-\d+)?$/.test(part)) {
        return { ok: false, error: `Rango inválido: "${part}". Usa el formato 1-5 o un número como 7.` };
      }
      const [first, last] = part.includes('-') ? part.split('-').map(Number) : [Number(part), Number(part)];
      if (first < 1 || last > totalPages || first > last) {
        return { ok: false, error: `Rango "${part}" fuera de límites. El PDF tiene ${totalPages} páginas.` };
      }
    }
  }

  const gsRun = async (first, last, targetPath) => {
    const out = getUniqueFilePath(targetPath);
    await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${first} -dLastPage=${last} -sOutputFile="${out}" "${file}"`);
    return out;
  };

  if (mode === 'individual') {
    for (let i = 1; i <= totalPages; i++) {
      if (isCancelled) break;
      try {
        const out = await gsRun(i, i, path.join(outputDir, `${name}-pag${String(i).padStart(3,'0')}.pdf`));
        results.push({ page: i, out, ok: true });
      } catch (e) { results.push({ page: i, ok: false, error: String(e) }); }
    }
  } else if (mode === 'block') {
    let block = 1;
    for (let i = 1; i <= totalPages; i += blockSize) {
      if (isCancelled) break;
      const end = Math.min(i + blockSize - 1, totalPages);
      try {
        const out = await gsRun(i, end, path.join(outputDir, `${name}-bloque${String(block).padStart(2,'0')}.pdf`));
        results.push({ block, pages: `${i}-${end}`, out, ok: true });
      } catch (e) { results.push({ block, ok: false, error: String(e) }); }
      block++;
    }
  } else if (mode === 'custom') {
    const parts = customRanges.split(',').map(s => s.trim()).filter(s => s);
    let partNum = 1;
    for (const part of parts) {
      if (isCancelled) break;
      const [first, last] = part.includes('-') ? part.split('-').map(s => s.trim()) : [part, part];
      try {
        const out = await gsRun(first, last, path.join(outputDir, `${name}-parte${String(partNum).padStart(2,'0')}.pdf`));
        results.push({ out, ok: true });
      } catch (e) { results.push({ ok: false, error: String(e) }); }
      partNum++;
    }
  }

  return { ok: true, totalPages, results, wasCancelled: isCancelled };
});
