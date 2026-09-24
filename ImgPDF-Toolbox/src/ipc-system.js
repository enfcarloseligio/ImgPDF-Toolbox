const { app, ipcMain, dialog, shell } = require('electron');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const https  = require('https');
const {
  run,
  cancelCurrentOperation,
  findGhostscript,
  wingetAvailable,
} = require('./process-runner');

// ── Diálogos y shell ─────────────────────────────────────────────────────────

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

ipcMain.handle('open-url',  async (_, url) => shell.openExternal(url));
ipcMain.handle('play-beep', () => shell.beep());

ipcMain.handle('open-folder', async (_, dirPath) => {
  if (dirPath && fs.existsSync(dirPath)) {
    await shell.openPath(dirPath);
    return true;
  }
  return false;
});

ipcMain.handle('cancel-operation', () => {
  cancelCurrentOperation();
  return true;
});

// ── Verificar herramientas ───────────────────────────────────────────────────

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

// ── Instalar herramientas ────────────────────────────────────────────────────

ipcMain.handle('install-tool', async (_, tool) => {
  const baseDir = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(__dirname, '..', 'extraResources');

  const localInstallers = {
    imagemagick: { file: 'ImageMagick-7.1.2-30-Q16-HDRI-x64-dll.exe', flags: '/VERYSILENT /NORESTART /TASKS="setpath"' },
    ghostscript: { file: 'gs10071w64.exe', flags: '/S' }
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
    ghostscript: 'winget install --id ArtifexSoftware.GhostScript -e --accept-source-agreements --accept-package-agreements',
  };

  try {
    await run(wingetCmds[tool]);
    return { ok: true, source: 'winget' };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
});

// ── Actualizar herramientas ──────────────────────────────────────────────────

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

// ── Fuentes del sistema ──────────────────────────────────────────────────────

ipcMain.handle('get-system-fonts', async () => {
  const fontDirs = [
    'C:\\Windows\\Fonts',
    path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts'),
  ];
  const validExts = ['.ttf', '.otf', '.TTF', '.OTF'];
  const fonts = [];

  for (const dir of fontDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const ext = path.extname(file);
        if (!validExts.includes(ext)) continue;
        const fullPath = path.join(dir, file);
        const name = path.basename(file, ext)
          .replace(/[-_]/g, ' ')
          .replace(/([a-z])([A-Z])/g, '$1 $2');
        fonts.push({ name, path: fullPath, file });
      }
    } catch (_) {}
  }

  return fonts.sort((a, b) => a.name.localeCompare(b.name));
});

// ── Catálogo de Google Fonts ─────────────────────────────────────────────────

ipcMain.handle('get-google-fonts-catalog', async () => {
  const cachePath = path.join(app.getPath('userData'), 'gf-catalog-cache.json');

  if (fs.existsSync(cachePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      if (Array.isArray(data) && data.length > 500) return { ok: true, families: data };
    } catch (_) {}
  }

  const fetchJson = (url) => new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });

  try {
    const fonts = await fetchJson('https://api.fontsource.org/v1/fonts');
    const families = fonts.map(f => f.family).sort((a, b) => a.localeCompare(b));
    fs.writeFileSync(cachePath, JSON.stringify(families), 'utf8');
    return { ok: true, families };
  } catch (_) {
    return { ok: false, families: [] };
  }
});

// ── Descargar fuente de Google Fonts ─────────────────────────────────────────

ipcMain.handle('download-google-font', async (_, { family, weight = 400 }) => {
  const fontsDir = path.join(app.getPath('userData'), 'fonts');
  if (!fs.existsSync(fontsDir)) fs.mkdirSync(fontsDir, { recursive: true });

  const cleanFamily = family.trim();
  const safeName    = `${cleanFamily.replace(/\s+/g, '_')}_${weight}`;
  const fontPath    = path.join(fontsDir, `${safeName}.ttf`);

  if (fs.existsSync(fontPath)) return { ok: true, path: fontPath };

  const getRequest = (targetUrl, headers = {}) => new Promise((resolve, reject) => {
    https.get(targetUrl, { headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(getRequest(res.headers.location, headers));
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      resolve(res);
    }).on('error', reject);
  });

  const weightNames = {
    100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
    500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black'
  };
  const wName = weightNames[weight] || 'Regular';

  const slug   = cleanFamily.toLowerCase().replace(/[\s\-]/g, '');
  const pascal = cleanFamily.replace(/\s+/g, '');
  const kebab  = cleanFamily.replace(/\s+/g, '-');

  const candidateUrls = [
    { type: 'css', url: `https://fonts.googleapis.com/css?family=${encodeURIComponent(cleanFamily)}:${weight}`, headers: { 'User-Agent': 'Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)' } },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/${pascal}-${wName}.ttf` },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/apache/${slug}/${pascal}-${wName}.ttf` },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/ufl/${slug}/${pascal}-${wName}.ttf` },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/${pascal}[wght].ttf` },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/${pascal}%5Bwght%5D.ttf` },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/apache/${slug}/${pascal}%5Bwght%5D.ttf` },
    { type: 'css', url: `https://fonts.bunny.net/css?family=${kebab.toLowerCase()}:${weight}`, headers: { 'User-Agent': 'Mozilla/4.0' } },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/${pascal}-Regular.ttf` },
    { type: 'ttf', url: `https://raw.githubusercontent.com/google/fonts/main/apache/${slug}/${pascal}-Regular.ttf` },
  ];

  let fontStream = null;

  for (const candidate of candidateUrls) {
    try {
      if (candidate.type === 'css') {
        const cssRes = await getRequest(candidate.url, candidate.headers || {});
        let css = '';
        await new Promise((res, rej) => {
          cssRes.setEncoding('utf8');
          cssRes.on('data', chunk => { css += chunk; });
          cssRes.on('end', res);
          cssRes.on('error', rej);
        });
        const match = css.match(/url\((https?:\/\/[^)]+\.(?:ttf|woff))(?:\?[^)]*)?\)/i);
        if (match) {
          fontStream = await getRequest(match[1]);
          break;
        }
      } else {
        fontStream = await getRequest(candidate.url, candidate.headers || {});
        break;
      }
    } catch (_) {}
  }

  if (!fontStream) {
    return {
      ok: false,
      error: `No se encontró la variante ${weight} (${wName}) para "${cleanFamily}". Verifica el nombre exacto de la familia.`
    };
  }

  try {
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(fontPath);
      fontStream.pipe(fileStream);
      fileStream.on('finish', () => { fileStream.close(); resolve(); });
      fileStream.on('error', err => { fs.unlink(fontPath, () => {}); reject(err); });
    });

    if (!fs.existsSync(fontPath) || fs.statSync(fontPath).size < 1024) {
      try { fs.unlinkSync(fontPath); } catch (_) {}
      return { ok: false, error: `El archivo descargado no es una fuente válida para "${cleanFamily}".` };
    }

    return { ok: true, path: fontPath };
  } catch (e) {
    try { fs.unlinkSync(fontPath); } catch (_) {}
    return { ok: false, error: e.message || e.toString() };
  }
});