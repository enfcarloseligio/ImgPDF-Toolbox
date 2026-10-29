// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-images.js
// Descripción: Handlers IPC de las herramientas de imagen: información y vista previa,
//              conversión entre formatos, redimensionado, compresión, recorte y borrado
//              de fondo. Usan ImageMagick con argumentos en lista (sin pasar por el shell)
//              e informan del avance real por archivo mediante src/progress.js.
// ═════════════════════════════════════════════════════════════════════════════

const { ipcMain, app } = require('electron');
const path = require('path');
const fs   = require('fs');
const {
  runSpawn,
  magickBin,
  resetCancelled,
  getIsCancelled,
  getUniqueFilePath,
} = require('./process-runner');
const { createProgress } = require('./progress');

// ── Utilidades compartidas ───────────────────────────────────────────────────

// Formatos que conservan canal alfa (transparencia). El resto necesita un fondo sólido.
const ALPHA_FORMATS = new Set(['png', 'webp', 'avif', 'gif', 'tiff', 'ico', 'jxl']);

// Formatos que Chromium muestra sin conversión previa (vista previa del recorte).
const BROWSER_FORMATS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif', 'svg']);

// Normaliza la extensión de un formato de salida: «jpeg» → «jpg», «tif» → «tiff».
function normalizeFormat(format) {
  const f = String(format || '').toLowerCase().replace(/^\./, '');
  if (f === 'jpeg') return 'jpg';
  if (f === 'tif') return 'tiff';
  return f;
}

const extOf = file => normalizeFormat(path.extname(file));

// Ejecuta ImageMagick con una lista de argumentos y devuelve su salida estándar.
async function magick(args) {
  const { stdout } = await runSpawn(magickBin(), args, { maxStdout: 1024 * 1024 });
  return stdout;
}

// Argumentos de entrada: primer fotograma, salvo GIF animado hacia un formato animado.
// Los SVG se rasterizan con densidad alta y fondo transparente.
function inputArgs(file, outFormat) {
  const ext = extOf(file);
  if (ext === 'svg') return ['-background', 'none', '-density', '300', file];
  if (ext === 'gif' && (outFormat === 'gif' || outFormat === 'webp')) return [file, '-coalesce'];
  return [`${file}[0]`];
}

// Fondo sólido para formatos sin transparencia (JPG, BMP).
function flattenArgs(outFormat, background) {
  return ALPHA_FORMATS.has(outFormat) ? [] : ['-background', background || '#FFFFFF', '-alpha', 'remove', '-alpha', 'off'];
}

// Argumentos de calidad/compresión de cada formato. lossless conserva los píxeles exactos
// cuando el formato lo permite (PNG, TIFF y WebP/JXL en modo sin pérdida).
function qualityArgs(outFormat, { quality = 100, lossless = false } = {}) {
  switch (outFormat) {
    case 'jpg':
      return ['-quality', String(quality), '-sampling-factor', quality >= 90 ? '4:4:4' : '4:2:0', '-interlace', 'Plane'];
    case 'png':
      return ['-define', 'png:compression-level=9'];
    case 'webp':
      return lossless
        ? ['-define', 'webp:lossless=true', '-quality', '100']
        : ['-quality', String(quality), '-define', 'webp:method=6'];
    case 'avif':
    case 'jxl':
      return ['-quality', String(lossless ? 100 : quality)];
    case 'tiff':
      return ['-compress', 'Zip'];
    default:
      return [];
  }
}

// Niveles de compresión con pérdida compartidos por Comprimir y Recortar.
const COMPRESS_LEVELS = {
  high:     { quality: 85, colors: 0   },
  balanced: { quality: 75, colors: 256 },
  max:      { quality: 60, colors: 128 },
};

// Argumentos adicionales cuando el formato es PNG: sin pérdida o reduciendo colores.
function pngColorArgs(outFormat, levelKey) {
  const colors = COMPRESS_LEVELS[levelKey]?.colors || 0;
  return outFormat === 'png' && colors ? ['-colors', String(colors)] : [];
}

const sizeOf = file => (fs.existsSync(file) ? fs.statSync(file).size : 0);

// Ruta de salida única en outputDir con el nombre base y la extensión indicados.
function outPath(outputDir, file, suffix, outFormat) {
  const name = path.basename(file, path.extname(file));
  return getUniqueFilePath(path.join(outputDir, `${name}${suffix}.${outFormat}`));
}

// Tamaño de la imagen ya orientada según EXIF: { width, height }.
async function imageSize(file) {
  const out = await magick([`${file}[0]`, '-auto-orient', '-format', '%w %h', 'info:']);
  const [width, height] = out.trim().split(/\s+/).map(Number);
  return { width, height };
}

// Itera los archivos con progreso real y cancelación. worker(file) devuelve el resultado
// de cada archivo; los errores se registran sin detener el lote.
async function processFiles(event, moduleId, files, worker) {
  resetCancelled();
  const results  = [];
  const progress = createProgress(event, moduleId, { totalFiles: files.length, totalPages: files.length, unit: 'imágenes' });
  progress.start();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }
    try {
      const result = await worker(file);
      results.push({ file, ok: true, ...result });
      progress.tick({ currentFile: i + 1, currentFileName: path.basename(file), currentPage: 1, currentFilePages: 1, currentOut: result.out ? path.basename(result.out) : '' });
    } catch (e) {
      results.push({ file, ok: false, error: String(e.message || e) });
      if (getIsCancelled()) break;
    }
  }

  progress.done();
  return results;
}

// ── Información, vista previa y formatos ─────────────────────────────────────

ipcMain.handle('get-image-info', async (_, file) => {
  try {
    const { width, height } = await imageSize(file);
    return { ok: true, width, height, format: extOf(file), bytes: sizeOf(file) };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

// Devuelve una ruta que el navegador pueda mostrar: el propio archivo o un PNG temporal.
ipcMain.handle('get-image-preview', async (_, file) => {
  try {
    const { width, height } = await imageSize(file);
    if (BROWSER_FORMATS.has(extOf(file))) return { ok: true, path: file, width, height };

    const dir = path.join(app.getPath('temp'), 'imgpdf_preview');
    fs.mkdirSync(dir, { recursive: true });
    const preview = path.join(dir, `prev_${Date.now()}.png`);
    await magick([...inputArgs(file, 'png'), '-auto-orient', preview]);
    return { ok: true, path: preview, width, height };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

// Formatos que esta instalación de ImageMagick puede leer y escribir.
let formatsCache = null;
ipcMain.handle('list-image-formats', async () => {
  if (formatsCache) return formatsCache;
  try {
    const out = await magick(['-list', 'format']);
    const read = [], write = [];
    for (const line of out.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9]+)\*?\s+\S+\s+([r-])([w-])[+-]/);
      if (!m) continue;
      const name = normalizeFormat(m[1]);
      if (m[2] === 'r') read.push(name);
      if (m[3] === 'w') write.push(name);
    }
    formatsCache = { ok: true, read, write };
  } catch (e) {
    formatsCache = { ok: false, error: String(e.message || e), read: [], write: [] };
  }
  return formatsCache;
});

// ── Convertir formato ────────────────────────────────────────────────────────

ipcMain.handle('convert-images', async (event, { files, format, quality = 100, lossless = false, background = '#FFFFFF', strip = false, icoSizes = '256,128,64,48,32,16', outputDir }) => {
  const outFormat = normalizeFormat(format);

  return processFiles(event, 'convert-images', files, async file => {
    const out = outPath(outputDir, file, '', outFormat);
    const sizeBefore = sizeOf(file);
    await magick([
      ...inputArgs(file, outFormat), '-auto-orient',
      ...flattenArgs(outFormat, background),
      ...(strip ? ['-strip'] : []),
      ...qualityArgs(outFormat, { quality, lossless }),
      ...(outFormat === 'ico' ? ['-define', `icon:auto-resize=${icoSizes}`] : []),
      out,
    ]);
    return { out, sizeBefore, sizeAfter: sizeOf(out) };
  });
});

// ── Redimensionar ────────────────────────────────────────────────────────────

// Geometría de ImageMagick según el modo. En píxeles con proporción se ajusta dentro de la
// caja indicada (admite solo ancho o solo alto); libre fuerza el tamaño exacto (!).
function resizeGeometry({ mode, width, height, percent, keepRatio, noEnlarge, maxSide }) {
  const w = Math.round(Number(width))  || 0;
  const h = Math.round(Number(height)) || 0;

  if (mode === 'percent') return `${Number(percent) || 100}%`;
  if (mode === 'max')     return `${Math.round(Number(maxSide)) || 1920}x${Math.round(Number(maxSide)) || 1920}>`;

  if (keepRatio) return `${w || ''}x${h || ''}${noEnlarge ? '>' : ''}`;
  return `${w}x${h}!${noEnlarge ? '>' : ''}`;
}

ipcMain.handle('resize-images', async (event, { files, mode, width, height, percent, keepRatio = true, noEnlarge = false, maxSide, quality = 100, outputDir }) => {
  const geometry = resizeGeometry({ mode, width, height, percent, keepRatio, noEnlarge, maxSide });

  return processFiles(event, 'resize-images', files, async file => {
    const outFormat = extOf(file) === 'svg' ? 'png' : extOf(file);
    const out = outPath(outputDir, file, '-redim', outFormat);
    await magick([
      ...inputArgs(file, outFormat), '-auto-orient',
      '-filter', 'Lanczos', '-resize', geometry,
      ...flattenArgs(outFormat),
      ...qualityArgs(outFormat, { quality, lossless: quality >= 100 }),
      out,
    ]);
    const { width: w, height: h } = await imageSize(out);
    return { out, width: w, height: h, sizeBefore: sizeOf(file), sizeAfter: sizeOf(out) };
  });
});

// ── Comprimir imágenes ───────────────────────────────────────────────────────

ipcMain.handle('compress-images', async (event, { files, level = 'balanced', format = 'same', maxSide = 0, strip = true, outputDir }) => {
  const lvl = COMPRESS_LEVELS[level] || COMPRESS_LEVELS.balanced;

  return processFiles(event, 'compress-images', files, async file => {
    const sourceFormat = extOf(file) === 'svg' ? 'png' : extOf(file);
    const outFormat    = format === 'same' ? sourceFormat : normalizeFormat(format);
    const sizeBefore   = sizeOf(file);
    const out          = outPath(outputDir, file, '-comprimido', outFormat);

    await magick([
      ...inputArgs(file, outFormat), '-auto-orient',
      ...(maxSide ? ['-resize', `${maxSide}x${maxSide}>`] : []),
      ...flattenArgs(outFormat),
      ...(strip ? ['-strip'] : []),
      ...pngColorArgs(outFormat, level),
      ...qualityArgs(outFormat, { quality: lvl.quality }),
      out,
    ]);

    const sizeAfter = sizeOf(out);
    // Si no hay ganancia y no cambió el formato ni el tamaño, se descarta el resultado
    if (sizeAfter >= sizeBefore && outFormat === sourceFormat && !maxSide) {
      try { fs.unlinkSync(out); } catch (_) {}
      return { skipped: true, sizeBefore, sizeAfter: sizeBefore };
    }
    return { out, sizeBefore, sizeAfter };
  });
});

// ── Recortar ─────────────────────────────────────────────────────────────────

ipcMain.handle('crop-image', async (event, { file, x, y, width, height, format = 'same', quality = 'original', level = 'balanced', maxSide = 0, strip = false, outputDir }) => {
  const sourceFormat = extOf(file) === 'svg' ? 'png' : extOf(file);
  const outFormat    = format === 'same' ? sourceFormat : normalizeFormat(format);
  const original     = quality === 'original';
  const lvl          = COMPRESS_LEVELS[level] || COMPRESS_LEVELS.balanced;

  const results = await processFiles(event, 'crop-image', [file], async () => {
    // El recorte se valida contra el tamaño real (ya orientado) para no salirse de la imagen
    const size = await imageSize(file);
    const cx = Math.max(0, Math.min(Math.round(x), size.width  - 1));
    const cy = Math.max(0, Math.min(Math.round(y), size.height - 1));
    const cw = Math.max(1, Math.min(Math.round(width),  size.width  - cx));
    const ch = Math.max(1, Math.min(Math.round(height), size.height - cy));

    const out = outPath(outputDir, file, '-recorte', outFormat);
    await magick([
      ...inputArgs(file, outFormat), '-auto-orient',
      '-crop', `${cw}x${ch}+${cx}+${cy}`, '+repage',
      ...(maxSide ? ['-resize', `${maxSide}x${maxSide}>`] : []),
      ...flattenArgs(outFormat),
      ...(strip ? ['-strip'] : []),
      ...(original ? [] : pngColorArgs(outFormat, level)),
      ...qualityArgs(outFormat, original ? { quality: 100, lossless: true } : { quality: lvl.quality }),
      out,
    ]);
    return { out, width: cw, height: ch, sizeAfter: sizeOf(out) };
  });
  return results[0];
});

// ── Quitar fondo (por color) ─────────────────────────────────────────────────

// Color de un píxel de la imagen (esquina superior izquierda por defecto).
async function cornerColor(file) {
  const out = await magick([`${file}[0]`, '-auto-orient', '-format', '%[pixel:p{0,0}]', 'info:']);
  return out.trim();
}

// Argumentos que vuelven transparente el fondo: «edges» rellena desde el borde (solo el
// fondo conectado) y «global» elimina ese color en toda la imagen.
function removeBackgroundArgs({ color, fuzz, method, feather }) {
  const fz = `${Math.max(0, Math.min(Number(fuzz) || 0, 100))}%`;
  const core = method === 'global'
    ? ['-alpha', 'set', '-fuzz', fz, '-transparent', color]
    : ['-alpha', 'set', '-bordercolor', color, '-border', '1x1', '-fuzz', fz, '-fill', 'none', '-draw', 'color 0,0 floodfill', '-shave', '1x1'];
  // Suavizado leve del borde de la transparencia para evitar contornos duros
  const smooth = feather ? ['-channel', 'A', '-blur', '0x0.8', '-level', '45%,100%', '+channel'] : [];
  return [...core, ...smooth];
}

ipcMain.handle('remove-background', async (event, { files, color = 'auto', fuzz = 12, method = 'edges', feather = true, outputDir }) => {
  return processFiles(event, 'remove-background', files, async file => {
    const bg  = color === 'auto' ? await cornerColor(file) : color;
    const out = outPath(outputDir, file, '-sinfondo', 'png');
    await magick([...inputArgs(file, 'png'), '-auto-orient', ...removeBackgroundArgs({ color: bg, fuzz, method, feather }), '-define', 'png:compression-level=9', out]);
    return { out, sizeBefore: sizeOf(file), sizeAfter: sizeOf(out) };
  });
});

// Vista previa reducida del resultado (PNG temporal) para ajustar la tolerancia en vivo.
ipcMain.handle('remove-background-preview', async (_, { file, color = 'auto', fuzz = 12, method = 'edges', feather = true }) => {
  try {
    const dir = path.join(app.getPath('temp'), 'imgpdf_preview');
    fs.mkdirSync(dir, { recursive: true });
    const bg  = color === 'auto' ? await cornerColor(file) : color;
    const out = path.join(dir, `bg_${Date.now()}.png`);
    await magick([...inputArgs(file, 'png'), '-auto-orient', '-resize', '900x900>', ...removeBackgroundArgs({ color: bg, fuzz, method, feather }), out]);
    return { ok: true, path: out, color: bg };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});

// Color de un píxel concreto (selector de gotero), en coordenadas de la imagen orientada.
ipcMain.handle('get-image-pixel', async (_, { file, x, y }) => {
  try {
    const out = await magick([`${file}[0]`, '-auto-orient', '-format', `%[pixel:p{${Math.round(x)},${Math.round(y)}}]`, 'info:']);
    return { ok: true, color: out.trim() };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
});
