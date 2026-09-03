const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// ── Control de procesos y cancelación ─────────────────────────────────────────

let currentProcess = null;
let isCancelled = false;

function run(cmd) {
  return new Promise((resolve, reject) => {
    currentProcess = exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      currentProcess = null;
      if (error) {
        if (isCancelled) {
          reject('Operación cancelada por el usuario.');
        } else {
          reject(stderr || error.message);
        }
      } else {
        resolve(stdout);
      }
    });
  });
}

function findGhostscript() {
  const pfDirs = [
    'C:\\Program Files\\gs',
    'C:\\Program Files (x86)\\gs',
  ];
  for (const base of pfDirs) {
    if (fs.existsSync(base)) {
      const subs = fs.readdirSync(base);
      for (const sub of subs) {
        const p64 = path.join(base, sub, 'bin', 'gswin64c.exe');
        const p32 = path.join(base, sub, 'bin', 'gswin32c.exe');
        if (fs.existsSync(p64)) return `"${p64}"`;
        if (fs.existsSync(p32)) return `"${p32}"`;
      }
    }
  }
  return 'gswin64c';
}

// Genera un nombre de archivo único con sufijo incremental para no sobreescribir
function getUniqueFilePath(targetPath) {
  if (!fs.existsSync(targetPath)) return targetPath;

  const dir = path.dirname(targetPath);
  const ext = path.extname(targetPath);
  const base = path.basename(targetPath, ext);

  let counter = 1;
  let candidate = path.join(dir, `${base} (${counter})${ext}`);

  while (fs.existsSync(candidate)) {
    counter++;
    candidate = path.join(dir, `${base} (${counter})${ext}`);
  }

  return candidate;
}

// ── Ventana principal ─────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 820,
    minHeight: 620,
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.ico'),
    autoHideMenuBar: true,
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
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Utilidades del sistema ───────────────────────────────────────────────

ipcMain.handle('select-files', async (event, filters) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: filters || [{ name: 'Todos los archivos', extensions: ['*'] }]
  });
  return canceled ? [] : filePaths;
});

ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('open-url', async (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('open-folder', async (event, dirPath) => {
  if (dirPath && fs.existsSync(dirPath)) {
    await shell.openPath(dirPath);
    return true;
  }
  return false;
});

ipcMain.handle('play-beep', () => {
  shell.beep();
});

ipcMain.handle('cancel-operation', () => {
  isCancelled = true;
  if (currentProcess) {
    try {
      currentProcess.kill();
    } catch (_) {}
  }
  return true;
});

// ── IPC: Verificar herramientas ───────────────────────────────────────────────

ipcMain.handle('check-tools', async () => {
  const result = { imageMagick: false, ghostscript: false, imVersion: '', gsVersion: '' };

  try {
    const imOut = await run('magick -version');
    const match = imOut.match(/ImageMagick\s+([\d.\-]+)/);
    result.imageMagick = true;
    result.imVersion = match ? match[1] : 'Detectado';
  } catch (_) {}

  const gs = findGhostscript();
  try {
    const gsOut = await run(`${gs} --version`);
    result.ghostscript = true;
    result.gsVersion = gsOut.trim();
  } catch (_) {}

  return result;
});

// ── IPC: Instalar y actualizar herramientas ───────────────────────────────────

ipcMain.handle('install-tool', async (event, tool) => {
  const cmds = {
    imagemagick: 'winget install --id ImageMagick.ImageMagick -e --accept-source-agreements --accept-package-agreements',
    ghostscript:  'winget install --id ArtifexSoftware.GhostScript -e --accept-source-agreements --accept-package-agreements',
  };
  const cmd = cmds[tool];
  if (!cmd) return { ok: false, error: 'Herramienta desconocida' };
  try {
    await run(cmd);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
});

ipcMain.handle('update-tools', async () => {
  const results = {};

  const isUpToDate = (output) => {
    const text = (output || '').toLowerCase();
    return (
      text.includes('successfully') ||
      text.includes('correctamente') ||
      text.includes('no applicable') ||
      text.includes('no se ha encontrado ninguna actualizaci') ||
      text.includes('no hay versiones más recientes') ||
      text.includes('no hay versiones mas recientes') ||
      text.includes('no se encontró ningún paquete') ||
      text.includes('no se encontro ningun paquete')
    );
  };

  try {
    const im = await run('winget upgrade --id ImageMagick.ImageMagick');
    results.imagemagick = isUpToDate(im) ? 'ok' : 'check';
  } catch (e) {
    results.imagemagick = isUpToDate(e) ? 'ok' : 'error';
  }

  try {
    const gs = await run('winget upgrade --id ArtifexSoftware.GhostScript');
    results.ghostscript = isUpToDate(gs) ? 'ok' : 'check';
  } catch (e) {
    results.ghostscript = isUpToDate(e) ? 'ok' : 'error';
  }

  return results;
});

// ── IPC: Conversiones ─────────────────────────────────────────────────────────

ipcMain.handle('convert-img-to-pdf', async (event, { files, quality, outputDir }) => {
  isCancelled = false;
  const results = [];
  for (const file of files) {
    if (isCancelled) {
      results.push({ file, ok: false, error: 'Cancelado' });
      break;
    }
    const name = path.basename(file, path.extname(file));
    const targetOut = path.join(outputDir, `${name}.pdf`);
    const out = getUniqueFilePath(targetOut);

    try {
      await run(`magick "${file}" -quality ${quality} "${out}"`);
      results.push({ file, out, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: e });
      if (isCancelled) break;
    }
  }
  return results;
});

ipcMain.handle('convert-pdf-to-img', async (event, { files, density, format, background, outputDir }) => {
  isCancelled = false;
  const results = [];
  for (const file of files) {
    if (isCancelled) {
      results.push({ file, ok: false, error: 'Cancelado' });
      break;
    }
    const name = path.basename(file, '.pdf');
    
    // Si ya existe la primera página esperada, incrementamos el prefijo base
    let basePatternName = name;
    let counter = 1;
    while (fs.existsSync(path.join(outputDir, `${basePatternName}-001.${format}`))) {
      basePatternName = `${name} (${counter})`;
      counter++;
    }

    const outPattern = path.join(outputDir, `${basePatternName}-%03d.${format}`);
    let bgFlags = '';
    if (background !== 'original') {
      bgFlags = `-background "${background}" -alpha remove -alpha off`;
    }
    try {
      await run(`magick -density ${density} "${file}" ${bgFlags} -scene 1 "${outPattern}"`);
      results.push({ file, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: e });
      if (isCancelled) break;
    }
  }
  return results;
});

ipcMain.handle('merge-pdfs', async (event, { files, outputDir }) => {
  isCancelled = false;
  const gs = findGhostscript();
  const baseOutName = path.basename(files[0], '.pdf') + '-combinado.pdf';
  const out = getUniqueFilePath(path.join(outputDir, baseOutName));
  const inputs = files.map(f => `"${f}"`).join(' ');

  try {
    await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dAutoRotatePages=/None -sOutputFile="${out}" ${inputs}`);
    return { ok: true, out };
  } catch (e) {
    return { ok: false, error: e };
  }
});

// ── IPC: Separar PDF (Con Detección Previa y Rangos Múltiples) ────────────────

ipcMain.handle('get-pdf-info', async (event, file) => {
  try {
    const countStr = await run(`magick identify -ping -format "%n " "${file}"`);
    const pages = parseInt(countStr.trim().split(/\s+/)[0], 10) || 0;
    return { ok: true, pages };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
});

ipcMain.handle('split-pdf', async (event, { file, mode, blockSize, customRanges, outputDir, totalPages }) => {
  isCancelled = false;
  const gs = findGhostscript();
  const name = path.basename(file, '.pdf');
  const results = [];

  if (mode === 'individual') {
    for (let i = 1; i <= totalPages; i++) {
      if (isCancelled) break;
      const targetOut = path.join(outputDir, `${name}-pag${String(i).padStart(3, '0')}.pdf`);
      const out = getUniqueFilePath(targetOut);
      try {
        await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${i} -dLastPage=${i} -sOutputFile="${out}" "${file}"`);
        results.push({ page: i, out, ok: true });
      } catch (e) {
        results.push({ page: i, ok: false, error: e });
        if (isCancelled) break;
      }
    }
  } else if (mode === 'block') {
    let block = 1;
    for (let i = 1; i <= totalPages; i += blockSize) {
      if (isCancelled) break;
      const end = Math.min(i + blockSize - 1, totalPages);
      const targetOut = path.join(outputDir, `${name}-bloque${String(block).padStart(2, '0')}.pdf`);
      const out = getUniqueFilePath(targetOut);
      try {
        await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${i} -dLastPage=${end} -sOutputFile="${out}" "${file}"`);
        results.push({ block, out, ok: true });
        block++;
      } catch (e) {
        results.push({ block, ok: false, error: e });
        block++;
        if (isCancelled) break;
      }
    }
  } else if (mode === 'custom') {
    const parts = customRanges.split(',').map(s => s.trim()).filter(s => s);
    let partNum = 1;
    for (const part of parts) {
      if (isCancelled) break;
      const targetOut = path.join(outputDir, `${name}-parte${String(partNum).padStart(2, '0')}.pdf`);
      const out = getUniqueFilePath(targetOut);
      let first = part, last = part;
      if (part.includes('-')) {
        [first, last] = part.split('-').map(s => s.trim());
      }
      try {
        await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${first} -dLastPage=${last} -sOutputFile="${out}" "${file}"`);
        results.push({ out, ok: true });
        partNum++;
      } catch (e) {
        results.push({ ok: false, error: e });
        partNum++;
        if (isCancelled) break;
      }
    }
  }

  return { ok: true, totalPages, results, wasCancelled: isCancelled };
});