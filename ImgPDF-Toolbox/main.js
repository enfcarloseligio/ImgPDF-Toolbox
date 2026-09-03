const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// ── Utilidades ────────────────────────────────────────────────────────────────

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) reject(stderr || error.message);
      else resolve(stdout);
    });
  });
}

function findGhostscript() {
  const candidates = [
    'gswin64c', 'gswin32c',
  ];
  // Buscar en Program Files con versiones comunes
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
  return 'gswin64c'; // fallback PATH
}

// ── Ventana principal ─────────────────────────────────────────────────────────

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 700,
    minWidth: 820,
    minHeight: 620,
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

// ── IPC: Selección de archivos ────────────────────────────────────────────────

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

// ── IPC: Instalar herramientas ────────────────────────────────────────────────

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
  try {
    const im = await run('winget upgrade --id ImageMagick.ImageMagick');
    results.imagemagick = im.includes('successfully') || im.includes('No applicable') ? 'ok' : 'check';
  } catch (e) { results.imagemagick = 'error'; }
  try {
    const gs = await run('winget upgrade --id ArtifexSoftware.GhostScript');
    results.ghostscript = gs.includes('successfully') || gs.includes('No applicable') ? 'ok' : 'check';
  } catch (e) { results.ghostscript = 'error'; }
  return results;
});

// ── IPC: Conversiones ─────────────────────────────────────────────────────────

ipcMain.handle('convert-img-to-pdf', async (event, { files, quality, outputDir }) => {
  const results = [];
  for (const file of files) {
    const name = path.basename(file, path.extname(file));
    const out = path.join(outputDir, `${name}.pdf`);
    try {
      await run(`magick "${file}" -quality ${quality} "${out}"`);
      results.push({ file, out, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: e });
    }
  }
  return results;
});

ipcMain.handle('convert-pdf-to-img', async (event, { files, density, format, background, outputDir }) => {
  const results = [];
  for (const file of files) {
    const name = path.basename(file, '.pdf');
    const outPattern = path.join(outputDir, `${name}-%03d.${format}`);
    let bgFlags = '';
    if (background !== 'original') {
      bgFlags = `-background "${background}" -alpha remove -alpha off`;
    }
    try {
      await run(`magick -density ${density} "${file}" ${bgFlags} -scene 1 "${outPattern}"`);
      results.push({ file, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: e });
    }
  }
  return results;
});

ipcMain.handle('merge-pdfs', async (event, { files, outputDir }) => {
  const gs = findGhostscript();
  const outName = path.basename(files[0], '.pdf') + '-combinado.pdf';
  const out = path.join(outputDir, outName);
  const inputs = files.map(f => `"${f}"`).join(' ');
  try {
    await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dAutoRotatePages=/None -sOutputFile="${out}" ${inputs}`);
    return { ok: true, out };
  } catch (e) {
    return { ok: false, error: e };
  }
});

ipcMain.handle('split-pdf', async (event, { file, mode, blockSize, rangeStart, rangeEnd, outputDir }) => {
  const gs = findGhostscript();
  const name = path.basename(file, '.pdf');
  let totalPages = 0;
  try {
    const identify = await run(`magick identify "${file}"`);
    totalPages = identify.trim().split('\n').length;
  } catch (_) {
    return { ok: false, error: 'No se pudo leer el PDF. Verifica que ImageMagick y Ghostscript estén instalados.' };
  }

  const results = [];

  if (mode === 'individual') {
    for (let i = 1; i <= totalPages; i++) {
      const out = path.join(outputDir, `${name}-pag${String(i).padStart(3, '0')}.pdf`);
      try {
        await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${i} -dLastPage=${i} -sOutputFile="${out}" "${file}"`);
        results.push({ page: i, out, ok: true });
      } catch (e) {
        results.push({ page: i, ok: false, error: e });
      }
    }
  } else if (mode === 'block') {
    let block = 1;
    for (let i = 1; i <= totalPages; i += blockSize) {
      const end = Math.min(i + blockSize - 1, totalPages);
      const out = path.join(outputDir, `${name}-bloque${String(block).padStart(2, '0')}.pdf`);
      try {
        await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${i} -dLastPage=${end} -sOutputFile="${out}" "${file}"`);
        results.push({ block, pages: `${i}-${end}`, out, ok: true });
        block++;
      } catch (e) {
        results.push({ block, ok: false, error: e });
        block++;
      }
    }
  } else if (mode === 'range') {
    const out = path.join(outputDir, `${name}-pag${rangeStart}-${rangeEnd}.pdf`);
    try {
      await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${rangeStart} -dLastPage=${rangeEnd} -sOutputFile="${out}" "${file}"`);
      results.push({ out, ok: true });
    } catch (e) {
      results.push({ ok: false, error: e });
    }
  }

  return { ok: true, totalPages, results };
});