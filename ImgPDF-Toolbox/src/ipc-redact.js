// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-redact.js
// Descripción: Handlers IPC de la herramienta «Testar»: abre un PDF o una imagen como
//              sesión de trabajo (páginas rasterizadas en userData), guarda el avance de
//              los cuadros negros de forma atómica para poder retomarlo tras un cierre
//              inesperado y exporta el resultado como imágenes o como PDF de imágenes.
//              Los cuadros se funden con los píxeles de cada página, por lo que el texto
//              original no puede recuperarse del archivo exportado.
// ═════════════════════════════════════════════════════════════════════════════

const { ipcMain, app } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const {
  runSpawn,
  magickBin,
  resetCancelled,
  getIsCancelled,
  findGhostscript,
  getUniqueFilePath,
} = require('./process-runner');
const { countPdfPages, createProgress, runGsWithProgress } = require('./progress');

// ── Constantes ───────────────────────────────────────────────────────────────

const SESSION_VERSION = 1;
const DEFAULT_DPI     = 150;
const MODULE_ID       = 'redact';

// Guardia contra operaciones simultáneas (abrir o exportar)
let redactBusy = false;

// ── Sesiones en disco ────────────────────────────────────────────────────────
// Cada archivo de origen tiene una sesión en userData/redact-sessions/<id>/ con su
// session.json y las páginas rasterizadas en pages/.

const sessionsRoot = () => path.join(app.getPath('userData'), 'redact-sessions');
const sessionDir   = id => path.join(sessionsRoot(), id);
const validId      = id => /^[a-f0-9]{16}$/.test(String(id));

// Identificador estable por ruta de origen: reabrir el mismo archivo encuentra su avance.
function sessionIdFor(file) {
  return crypto.createHash('sha1').update(path.resolve(file).toLowerCase()).digest('hex').slice(0, 16);
}

function readSession(id) {
  if (!validId(id)) return null;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(sessionDir(id), 'session.json'), 'utf8'));
    return s && s.version === SESSION_VERSION && Array.isArray(s.pages) ? s : null;
  } catch (_) { return null; }
}

// Escritura atómica: se escribe en un temporal y se renombra, de modo que un corte de luz
// a mitad de escritura nunca deja un session.json corrupto.
function writeSession(session) {
  const dir  = sessionDir(session.id);
  const file = path.join(dir, 'session.json');
  const tmp  = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(session), 'utf8');
  fs.renameSync(tmp, file);
}

function removeSession(id) {
  if (!validId(id)) return;
  try { fs.rmSync(sessionDir(id), { recursive: true, force: true }); } catch (_) {}
}

const pageFile = (id, page) => path.join(sessionDir(id), 'pages', page.file);

// Una sesión solo es utilizable si conserva todas sus páginas rasterizadas.
const hasAllPages = s => s.pages.every(p => fs.existsSync(pageFile(s.id, p)));

// Sesión con rutas absolutas de página, lista para el renderer.
function describe(s) {
  return {
    id: s.id, source: s.source, kind: s.kind, dpi: s.dpi,
    currentPage: s.currentPage || 0, updatedAt: s.updatedAt,
    boxes: s.boxes || {},
    pages: s.pages.map(p => ({ width: p.width, height: p.height, path: pageFile(s.id, p) })),
  };
}

// Resumen para listados: sin rutas de página ni cuadros.
function summarize(s) {
  return {
    id: s.id, source: s.source, kind: s.kind, updatedAt: s.updatedAt,
    pages: s.pages.length,
    boxCount: Object.values(s.boxes || {}).reduce((n, list) => n + list.length, 0),
    sourceExists: fs.existsSync(s.source),
  };
}

// ── Validación de cuadros ────────────────────────────────────────────────────
// Los cuadros se guardan como fracciones (0–1) de la página, independientes de la
// resolución con la que se muestre o se exporte.

const MIN_BOX = 0.001;
const clamp01 = v => Math.min(Math.max(Number(v) || 0, 0), 1);

function sanitizeBoxes(boxes, pageCount) {
  const clean = {};
  for (const [key, list] of Object.entries(boxes || {})) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0 || index >= pageCount || !Array.isArray(list)) continue;
    const valid = [];
    for (const b of list) {
      const x = clamp01(b.x), y = clamp01(b.y);
      const w = Math.min(clamp01(b.w), 1 - x), h = Math.min(clamp01(b.h), 1 - y);
      if (w >= MIN_BOX && h >= MIN_BOX) valid.push({ x, y, w, h });
    }
    if (valid.length) clean[index] = valid;
  }
  return clean;
}

// ── Utilidades de imagen ─────────────────────────────────────────────────────

const pad = (n, len = 4) => String(n).padStart(len, '0');

// Tamaño de un PNG leyendo solo su cabecera IHDR (evita lanzar un proceso por página).
function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(24);
    fs.readSync(fd, head, 0, 24, 0);
    return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

async function magick(args) {
  const { stdout } = await runSpawn(magickBin(), args, { maxStdout: 1024 * 1024 });
  return stdout;
}

// Resolución con la que se maquetará el PDF de una imagen: la propia del archivo si es
// razonable; si no (p. ej. 72 ppp de una captura), 150 ppp.
async function imageDpi(file) {
  try {
    const out = await magick([`${file}[0]`, '-units', 'PixelsPerInch', '-format', '%x', 'info:']);
    const dpi = Math.round(parseFloat(out));
    return dpi >= 100 && dpi <= 1200 ? dpi : DEFAULT_DPI;
  } catch (_) { return DEFAULT_DPI; }
}

const fail = e => ({ ok: false, error: String(e && e.message ? e.message : e) });

// ── Consulta de sesiones ─────────────────────────────────────────────────────

// Sesiones guardadas, de la más reciente a la más antigua.
ipcMain.handle('redact-list-sessions', () => {
  try {
    const root = sessionsRoot();
    if (!fs.existsSync(root)) return { ok: true, sessions: [] };
    const sessions = fs.readdirSync(root)
      .map(readSession)
      .filter(s => s && hasAllPages(s))
      .map(summarize)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { ok: true, sessions };
  } catch (e) { return fail(e); }
});

// Avance guardado de un archivo concreto. Si el archivo cambió desde entonces (tamaño o
// fecha), el avance ya no corresponde a su contenido y se ignora.
ipcMain.handle('redact-find-session', (_, { file }) => {
  try {
    const s = readSession(sessionIdFor(file));
    if (!s || !hasAllPages(s) || !fs.existsSync(file)) return { ok: true, session: null };
    const stat = fs.statSync(file);
    const same = stat.size === s.sourceSize && Math.floor(stat.mtimeMs / 1000) === s.sourceMtime;
    return { ok: true, session: same ? summarize(s) : null };
  } catch (e) { return fail(e); }
});

ipcMain.handle('redact-load-session', (_, { id }) => {
  const s = readSession(id);
  if (!s || !hasAllPages(s)) return { ok: false, error: 'El avance guardado ya no está disponible.' };
  return { ok: true, session: describe(s) };
});

ipcMain.handle('redact-discard', (_, { id }) => {
  removeSession(id);
  return { ok: true };
});

// ── Apertura: rasterizado de las páginas ─────────────────────────────────────

ipcMain.handle('redact-open', async (event, { file, kind, dpi = DEFAULT_DPI }) => {
  if (redactBusy) return { ok: false, error: 'Ya hay una operación en curso.' };
  redactBusy = true;
  resetCancelled();

  const id = sessionIdFor(file);
  const pagesDir = path.join(sessionDir(id), 'pages');

  try {
    removeSession(id);
    fs.mkdirSync(pagesDir, { recursive: true });

    const isPdf = kind === 'pdf';
    const workDpi = isPdf ? Math.min(Math.max(Math.round(Number(dpi)) || DEFAULT_DPI, 72), 600) : await imageDpi(file);
    const pages = [];

    if (isPdf) {
      const gsRaw = findGhostscript();
      const gs = gsRaw.replace(/^"|"$/g, '');
      const total = await countPdfPages(gsRaw, file);
      const progress = createProgress(event, MODULE_ID, { totalFiles: 1, totalPages: total, unit: 'páginas' });
      progress.start();

      for (let p = 1; p <= total; p++) {
        if (getIsCancelled()) throw new Error('Cancelado');
        const name = `page-${pad(p)}.png`;
        const out = path.join(pagesDir, name);
        await runSpawn(gs, [
          '-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER',
          '-sDEVICE=png16m', `-r${workDpi}`,
          '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4', '-dInterpolateControl=-1',
          `-dFirstPage=${p}`, `-dLastPage=${p}`,
          `-sOutputFile=${out}`, file,
        ], { maxStdout: 0 });
        pages.push({ file: name, ...pngSize(out) });
        progress.tick({ currentFile: 1, currentFileName: path.basename(file), currentPage: p, currentFilePages: total, currentOut: name });
      }
      progress.done();
    } else {
      const progress = createProgress(event, MODULE_ID, { totalFiles: 1, totalPages: 1, unit: 'imágenes' });
      progress.start();
      const name = `page-${pad(1)}.png`;
      const out = path.join(pagesDir, name);
      const isSvg = path.extname(file).toLowerCase() === '.svg';
      // Se descartan los metadatos (EXIF, GPS): la imagen testada no debe conservarlos
      await magick([
        ...(isSvg ? ['-background', 'none', '-density', '300', file] : [`${file}[0]`]),
        '-auto-orient', '-strip', out,
      ]);
      pages.push({ file: name, ...pngSize(out) });
      progress.tick({ currentFile: 1, currentFileName: path.basename(file), currentPage: 1, currentFilePages: 1, currentOut: name });
      progress.done();
    }

    const stat = fs.statSync(file);
    const session = {
      version: SESSION_VERSION, id, source: file, kind, dpi: workDpi,
      sourceSize: stat.size, sourceMtime: Math.floor(stat.mtimeMs / 1000),
      createdAt: Date.now(), updatedAt: Date.now(),
      currentPage: 0, pages, boxes: {},
    };
    writeSession(session);
    return { ok: true, session: describe(session) };
  } catch (e) {
    removeSession(id);
    return fail(getIsCancelled() ? 'Cancelado' : e);
  } finally {
    redactBusy = false;
  }
});

// ── Guardado del avance ──────────────────────────────────────────────────────

ipcMain.handle('redact-save', (_, { id, boxes, currentPage }) => {
  try {
    const s = readSession(id);
    if (!s) return { ok: false, error: 'La sesión ya no existe.' };
    s.boxes = sanitizeBoxes(boxes, s.pages.length);
    s.currentPage = Math.min(Math.max(Math.round(Number(currentPage)) || 0, 0), s.pages.length - 1);
    s.updatedAt = Date.now();
    writeSession(s);
    return { ok: true, updatedAt: s.updatedAt };
  } catch (e) { return fail(e); }
});

// ── Exportación ──────────────────────────────────────────────────────────────

// Argumentos de ImageMagick que pintan los cuadros de una página en píxeles. Los bordes se
// redondean hacia afuera para que no quede ninguna franja de texto sin cubrir.
function drawArgs(list, width, height) {
  const args = [];
  for (const b of list) {
    const x0 = Math.max(0, Math.floor(b.x * width));
    const y0 = Math.max(0, Math.floor(b.y * height));
    const x1 = Math.min(width,  Math.ceil((b.x + b.w) * width))  - 1;
    const y1 = Math.min(height, Math.ceil((b.y + b.h) * height)) - 1;
    if (x1 >= x0 && y1 >= y0) args.push('-draw', `rectangle ${x0},${y0} ${x1},${y1}`);
  }
  return args.length ? ['-fill', 'black', '-stroke', 'none', ...args] : [];
}

// Argumentos de codificación de la salida de una página.
function encodeArgs({ mode, imageFormat, quality, dpi }) {
  const jpg = imageFormat === 'jpg';
  // JPG y PDF no admiten transparencia: se aplana sobre blanco
  const flatten = jpg || mode === 'pdf' ? ['-background', 'white', '-alpha', 'remove', '-alpha', 'off'] : [];

  if (mode === 'pdf') {
    return [...flatten, '-units', 'PixelsPerInch', '-density', String(dpi),
      ...(jpg ? ['-compress', 'JPEG', '-quality', String(quality)] : ['-compress', 'Zip'])];
  }
  return jpg
    ? [...flatten, '-quality', String(quality), '-sampling-factor', quality >= 90 ? '4:4:4' : '4:2:0']
    : ['-define', 'png:compression-level=9'];
}

// Ensambla los PDF de cada página conservando la codificación elegida: sin pérdida (Flate)
// para PNG y sin recomprimir (paso directo) para JPG.
async function mergePdfs(parts, out, imageFormat) {
  const lossless = imageFormat !== 'jpg';
  await runGsWithProgress(findGhostscript(), [
    '-dBATCH', '-dNOPAUSE', '-dSAFER', '-sDEVICE=pdfwrite', '-dAutoRotatePages=/None',
    '-dDownsampleColorImages=false', '-dDownsampleGrayImages=false', '-dDownsampleMonoImages=false',
    ...(lossless
      ? ['-dAutoFilterColorImages=false', '-dColorImageFilter=/FlateEncode', '-dAutoFilterGrayImages=false', '-dGrayImageFilter=/FlateEncode']
      : ['-dPassThroughJPEGImages=true']),
    `-sOutputFile=${out}`, ...parts,
  ]);
}

ipcMain.handle('redact-export', async (event, { id, boxes, mode = 'pdf', imageFormat = 'png', quality = 90, outputDir, discard = false }) => {
  if (redactBusy) return { ok: false, error: 'Ya hay una operación en curso.' };
  redactBusy = true;
  resetCancelled();

  const created = [];
  const tempDir = path.join(app.getPath('temp'), `imgpdf_redact_${Date.now()}`);

  try {
    const s = readSession(id);
    if (!s || !hasAllPages(s)) throw new Error('El avance guardado ya no está disponible.');
    if (!outputDir) throw new Error('Selecciona una carpeta de salida.');

    const clean = sanitizeBoxes(boxes, s.pages.length);
    if (!Object.keys(clean).length) throw new Error('Dibuja al menos un cuadro antes de exportar.');

    const q = Math.min(Math.max(Math.round(Number(quality)) || 90, 1), 100);
    const fmt = imageFormat === 'jpg' ? 'jpg' : 'png';
    const enc = encodeArgs({ mode, imageFormat: fmt, quality: q, dpi: s.dpi });
    const total = s.pages.length;
    const base = path.basename(s.source, path.extname(s.source)) + '-testado';

    fs.mkdirSync(tempDir, { recursive: true });
    const progress = createProgress(event, MODULE_ID, { totalFiles: 1, totalPages: total, unit: 'páginas' });
    progress.start();

    // Nombres de salida: un PDF, una imagen o una serie numerada sin pisar exportaciones previas
    let imageBase = base;
    if (mode !== 'pdf' && total > 1) {
      for (let n = 1; fs.existsSync(path.join(outputDir, `${imageBase}-pp-001.${fmt}`)); n++) imageBase = `${base} (${n})`;
    }

    const parts = [];
    for (let i = 0; i < total; i++) {
      if (getIsCancelled()) throw new Error('Cancelado');
      const page = s.pages[i];
      let out;
      if (mode === 'pdf') {
        out = path.join(tempDir, `p-${pad(i + 1)}.pdf`);
        parts.push(out);
      } else {
        const name = total > 1 ? `${imageBase}-pp-${pad(i + 1, 3)}.${fmt}` : `${base}.${fmt}`;
        out = getUniqueFilePath(path.join(outputDir, name));
        created.push(out);
      }
      await magick([pageFile(id, page), ...drawArgs(clean[i] || [], page.width, page.height), ...enc, out]);
      progress.tick({ currentFile: 1, currentFileName: path.basename(s.source), currentPage: i + 1, currentFilePages: total, currentOut: path.basename(out) });
    }

    let outputs = created;
    if (mode === 'pdf') {
      const finalPdf = getUniqueFilePath(path.join(outputDir, `${base}.pdf`));
      progress.stage('Ensamblando el PDF final...', { currentOut: path.basename(finalPdf) });
      if (parts.length === 1) fs.copyFileSync(parts[0], finalPdf);
      else await mergePdfs(parts, finalPdf, fmt);
      created.push(finalPdf);
      outputs = [finalPdf];
    }
    progress.done();

    if (discard) removeSession(id);
    return {
      ok: true, outputs, pages: total, discarded: !!discard,
      bytes: outputs.reduce((n, f) => n + (fs.existsSync(f) ? fs.statSync(f).size : 0), 0),
    };
  } catch (e) {
    // Una exportación interrumpida no deja archivos a medias en la carpeta de salida
    created.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
    return fail(getIsCancelled() ? 'Cancelado' : e);
  } finally {
    redactBusy = false;
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
});
