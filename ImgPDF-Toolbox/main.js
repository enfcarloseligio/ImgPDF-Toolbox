const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// ─── Utilidades ────────────────────────────────────────────────────────────────

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) reject(stderr || error.message);
      else resolve(stdout);
    });
  });
}

// Busca gswin64c o gswin32c en rutas comunes
function findGhostscript() {
  const candidates = [
    'gswin64c', 'gswin32c',
    'C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs10.03.1\\bin\\gswin64c.exe',
    'C:\\Program Files\\gs\\gs10.02.1\\bin\\gswin64c.exe',
    'C:\\Program Files (x86)\\gs\\gs10.04.0\\bin\\gswin32c.exe',
  ];
  for (const c of candidates) {
    try {
      // Si la ruta existe como archivo o está en PATH, la usamos
      if (c.includes('\\')) {
        if (fs.existsSync(c)) return `"${c}"`;
      } else {
        return c; // comandos en PATH se intentan directamente
      }
    } catch (_) {}
  }
  return 'gswin64c'; // fallback, mostrará error descriptivo si no existe
}

// ─── Ventana principal ─────────────────────────────────────────────────────────

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

// ─── IPC: Selección de archivos ────────────────────────────────────────────────

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

// ─── IPC: Verificar herramientas instaladas ────────────────────────────────────

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

// ─── IPC: Conversiones de imagen ───────────────────────────────────────────────

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
  const gs = findGhostscript();

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

// ─── IPC: Unir PDFs ────────────────────────────────────────────────────────────

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

// ─── IPC: Separar PDF ──────────────────────────────────────────────────────────

ipcMain.handle('split-pdf', async (event, { file, mode, blockSize, rangeStart, rangeEnd, outputDir }) => {
  const gs = findGhostscript();
  const name = path.basename(file, '.pdf');

  // Obtener número de páginas
  let totalPages = 0;
  try {
    const info = await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=nullpage "${file}"`);
    // Alternativa: usar magick para obtener páginas
    const identify = await run(`magick identify "${file}"`);
    totalPages = identify.trim().split('\n').length;
  } catch (_) {
    return { ok: false, error: 'No se pudo leer el PDF. Verifica que Ghostscript esté instalado.' };
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