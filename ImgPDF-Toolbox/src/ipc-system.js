// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-system.js
// Descripción: Handlers IPC de sistema: diálogos de archivos, verificación, instalación y
//              actualización de ImageMagick y Ghostscript, y gestión de fuentes (del sistema
//              y catálogo de Google Fonts).
// ═════════════════════════════════════════════════════════════════════════════

const { app, ipcMain, dialog, shell } = require('electron');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');
const https  = require('https');
const {
  run,
  cancelCurrentOperation,
  findGhostscript,
  findImageMagickDir,
  ensureImageMagickInPath,
  wingetAvailable,
} = require('./process-runner');

// ── Entorno de herramientas ──────────────────────────────────────────────────
// Expone ImageMagick en el PATH del proceso desde el arranque, aunque se haya
// instalado después de abrir la terminal o el editor que lanzó la aplicación.
ensureImageMagickInPath();

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

async function detectTools() {
  const result = { imageMagick: false, ghostscript: false, imVersion: '', gsVersion: '', winget: false };

  ensureImageMagickInPath();

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
}

ipcMain.handle('check-tools', () => detectTools());

// ── Instalar herramientas ────────────────────────────────────────────────────

// Comprueba si la herramienta quedó instalada buscando su carpeta en Program Files
// (el PATH del proceso actual no se refresca tras instalar).
function isToolInstalled(tool) {
  if (tool === 'imagemagick') return !!findImageMagickDir();
  return ['C:\Program Files', 'C:\Program Files (x86)'].some(root => {
    try {
      const gs = path.join(root, 'gs');
      return fs.existsSync(gs) && fs.readdirSync(gs).length > 0;
    } catch (_) { return false; }
  });
}

ipcMain.handle('install-tool', async (_, tool) => {
  const baseDir = app.isPackaged
    ? path.join(process.resourcesPath, 'bin')
    : path.join(__dirname, '..', 'extraResources');

  // Instaladores locales (carpeta extraResources/). Se abren en modo normal (con
  // asistente y UAC): la instalación silenciosa suele fallar por políticas de seguridad.
  const localInstallers = {
    imagemagick: { file: 'ImageMagick-7.1.2-34-Q16-HDRI-x64-dll.exe' },
    ghostscript: { file: 'gs10080w64.exe' },
  };

  const selected = localInstallers[tool];
  if (!selected) return { ok: false, error: 'Herramienta desconocida' };

  const installerPath = path.join(baseDir, selected.file);

  if (fs.existsSync(installerPath)) {
    try {
      // Start-Process -Verb RunAs: pide permisos de administrador y espera a que el asistente termine
      const psPath = installerPath.replace(/'/g, "''");
      await run(`powershell -NoProfile -Command "Start-Process -FilePath '${psPath}' -Verb RunAs -Wait"`);
    } catch (e) {
      return { ok: false, error: `No se pudo abrir el instalador (¿se canceló el permiso de administrador?): ${e.toString()}` };
    }
    // El asistente puede cerrarse sin instalar: comprobar que realmente quedó instalado
    if (!isToolInstalled(tool)) return { ok: false, cancelled: true, error: 'La instalación no se completó.' };
    // Disponible de inmediato, sin reiniciar la aplicación
    ensureImageMagickInPath();
    return { ok: true, source: 'local' };
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
// La comprobación compara la versión instalada con la última release oficial
// publicada en GitHub. No depende de winget: Ghostscript no está en su repositorio
// y winget puede fallar por certificados de la fuente msstore.

const RELEASE_SOURCES = {
  imagemagick: {
    api:  'https://api.github.com/repos/ImageMagick/ImageMagick/releases/latest',
    page: 'https://imagemagick.org/script/download.php',
    // Etiqueta "7.1.2-34" → [7, 1, 2, 34]
    parseTag: tag => (tag.match(/\d+/g) || []).map(Number),
  },
  ghostscript: {
    api:  'https://api.github.com/repos/ArtifexSoftware/ghostpdl-downloads/releases/latest',
    page: 'https://www.ghostscript.com/releases/gsdnld.html',
    // Etiqueta "gs10080" → [10, 8, 0]
    parseTag: tag => {
      const m = tag.match(/gs(\d+?)(\d{2})(\d)$/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [];
    },
  },
};

// Consulta una URL de la API de GitHub y devuelve el JSON (rechaza por error HTTP o timeout).
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'ImgPDF-Toolbox', Accept: 'application/vnd.github+json' } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Tiempo de espera agotado')));
    req.on('error', reject);
  });
}

// Compara dos listas numéricas de versión: devuelve >0 si a es mayor que b.
function compareVersions(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Estado de una herramienta: not-installed | up-to-date | available | unknown
async function checkToolUpdate(key, installedVersion) {
  const source = RELEASE_SOURCES[key];
  if (!installedVersion) return { status: 'not-installed', page: source.page };
  try {
    const release = await fetchJson(source.api);
    const latest  = source.parseTag(release.tag_name || '');
    const current = (installedVersion.match(/\d+/g) || []).map(Number);
    if (!latest.length) throw new Error('Etiqueta de versión no reconocida');
    return {
      status:    compareVersions(latest, current) > 0 ? 'available' : 'up-to-date',
      installed: installedVersion,
      latest:    release.name || release.tag_name,
      latestTag: release.tag_name,
      page:      source.page,
    };
  } catch (e) {
    return { status: 'unknown', installed: installedVersion, page: source.page, error: e.message };
  }
}

ipcMain.handle('check-updates', async () => {
  const tools = await detectTools();
  const [imagemagick, ghostscript] = await Promise.all([
    checkToolUpdate('imagemagick', tools.imageMagick ? tools.imVersion : ''),
    checkToolUpdate('ghostscript', tools.ghostscript ? tools.gsVersion : ''),
  ]);
  return { imagemagick, ghostscript };
});

// Aplica la actualización: ImageMagick vía winget (fuente propia, sin msstore);
// Ghostscript no está en winget, por lo que se remite a su página oficial.
ipcMain.handle('upgrade-tool', async (_, tool) => {
  const source = RELEASE_SOURCES[tool];
  if (!source) return { ok: false, error: 'Herramienta desconocida' };
  if (tool !== 'imagemagick' || !(await wingetAvailable())) return { ok: false, manual: true, url: source.page };

  try {
    await run('winget upgrade --id ImageMagick.ImageMagick -e --source winget --accept-package-agreements --accept-source-agreements');
    ensureImageMagickInPath();
    return { ok: true };
  } catch (e) {
    return { ok: false, manual: true, url: source.page, error: e.toString() };
  }
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