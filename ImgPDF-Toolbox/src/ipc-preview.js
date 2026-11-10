// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-preview.js
// Descripción: Vista previa real de las anotaciones (marca de texto, foliado, marca de
//              imagen) y de la rotación: aplica la anotación sobre la página elegida del archivo con las
//              mismas funciones que el procesamiento final (src/ipc-annotations.js) y
//              devuelve una imagen reducida para mostrarla. Sin archivo usa una hoja A4 en
//              blanco. Los comandos de la vista previa no se registran como proceso actual,
//              de modo que nunca interfieren con la cancelación de una operación en curso.
// ═════════════════════════════════════════════════════════════════════════════

const { ipcMain, app } = require('electron');
const { exec } = require('child_process');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { findGhostscript } = require('./process-runner');
const { countPdfPages } = require('./progress');
const { buildFolioText, applyTextWatermark, annotateFolioImage, applyImageMark } = require('./ipc-annotations');

// ── Constantes ───────────────────────────────────────────────────────────────

const PDF_DENSITY  = 200;                   // La misma resolución con la que se procesan los PDFs
const BLANK_SIZE   = { width: 1654, height: 2339 };   // A4 a 200 ppp
const VIEW_MAX     = 1100;                  // Lado mayor de la imagen que se muestra, en píxeles
const MAX_BASES    = 4;                     // Páginas base que se conservan en caché

const previewDir = () => path.join(app.getPath('temp'), 'imgpdf_preview_annot');

// ── Ejecución de ImageMagick ─────────────────────────────────────────────────

// Mismo contrato que el ejecutor del procesamiento real, pero sin tocar el proceso actual
const previewExec = cmd => new Promise((resolve, reject) => {
  exec(cmd, { maxBuffer: 50 * 1024 * 1024, windowsHide: true, encoding: 'utf8' }, (err, stdout, stderr) => {
    if (err) reject(new Error((stderr || err.message || 'Error de ImageMagick').trim()));
    else resolve(stdout.trim());
  });
});

// Las vistas previas se ejecutan de una en una: comparten archivos temporales
let chain = Promise.resolve();
const serialize = work => {
  const result = chain.then(work);
  chain = result.catch(() => {});
  return result;
};

// ── Página base ──────────────────────────────────────────────────────────────
// La página sin anotar se rasteriza una vez y se reutiliza mientras se ajustan las opciones.

const bases = new Map();   // clave → { path, width, height, pages, page }

async function imageSize(file) {
  const out = await previewExec(`magick identify -format "%wx%h" "${file}[0]"`);
  const m = out.match(/(\d+)x(\d+)/);
  if (!m) throw new Error('No se pudo leer el tamaño de la página.');
  return { width: parseInt(m[1], 10), height: parseInt(m[2], 10) };
}

async function pageBase(file, requestedPage) {
  fs.mkdirSync(previewDir(), { recursive: true });

  let key, build;
  if (!file) {
    key = 'blank';
    build = async out => {
      await previewExec(`magick -size ${BLANK_SIZE.width}x${BLANK_SIZE.height} xc:white "${out}"`);
      return { pages: 1, page: 1 };
    };
  } else if (path.extname(file).toLowerCase() === '.pdf') {
    const pages = await countPdfPages(findGhostscript(), file);
    const page  = Math.min(Math.max(Math.round(Number(requestedPage)) || 1, 1), pages);
    key = `${file}|${fs.statSync(file).mtimeMs}|${page}`;
    build = async out => {
      await previewExec(`magick -density ${PDF_DENSITY} "${file}[${page - 1}]" "${out}"`);
      return { pages, page };
    };
  } else {
    // Se trabaja sobre una copia para que los temporales de la marca no queden junto al original
    key = `${file}|${fs.statSync(file).mtimeMs}`;
    build = async out => { fs.copyFileSync(file, out); return { pages: 1, page: 1 }; };
  }

  const cached = bases.get(key);
  if (cached && fs.existsSync(cached.path)) return cached;

  const ext = file && path.extname(file).toLowerCase() !== '.pdf' ? path.extname(file) : '.png';
  const out = path.join(previewDir(), `base_${crypto.createHash('sha1').update(key).digest('hex').slice(0, 12)}${ext}`);
  const meta = await build(out);
  const base = { path: out, ...(await imageSize(out)), ...meta };

  bases.set(key, base);
  while (bases.size > MAX_BASES) {
    const [oldKey, old] = bases.entries().next().value;
    bases.delete(oldKey);
    try { fs.unlinkSync(old.path); } catch (_) {}
  }
  return base;
}

// ── Vista previa ─────────────────────────────────────────────────────────────

let lastView = null;
let counter = 0;

// tool: 'watermark' | 'folio' | 'watermark-image' | 'rotate'. params son los mismos que recibe el
// procesamiento final de cada herramienta (sin la lista de archivos ni la carpeta de salida).
ipcMain.handle('preview-annotation', (_, { tool, file = null, page = 1, params = {} }) => serialize(async () => {
  try {
    const dir  = previewDir();
    const base = await pageBase(file, page);
    const id   = `${Date.now()}_${counter++}`;
    const full = path.join(dir, `full_${id}.png`);
    let font = null;   // Fuente con la que se estampó el texto

    if (tool === 'watermark') {
      font = await applyTextWatermark(previewExec, dir, base.path, full, base.width, base.height, params);
    } else if (tool === 'folio') {
      const textFile = path.join(dir, `folio_${id}.txt`);
      fs.writeFileSync(textFile, buildFolioText({ ...params, pageNum: base.page, totalPages: base.pages }), 'utf8');
      try { font = await annotateFolioImage(previewExec, base.path, full, textFile, params); }
      finally { try { fs.unlinkSync(textFile); } catch (_) {} }
    } else if (tool === 'watermark-image') {
      if (!params.markFile) return { ok: false, needsMark: true, error: 'Selecciona la imagen de la marca para ver cómo queda.' };
      await applyImageMark(previewExec, base.path, full, base.width, base.height, params);
    } else if (tool === 'rotate') {
      // Misma regla que la rotación real: en PDF puede limitarse a páginas pares o impares
      const angle = [90, 180, 270].includes(Number(params.angle)) ? Number(params.angle) : 90;
      const isPdf = !!file && path.extname(file).toLowerCase() === '.pdf';
      const applies = !isPdf || params.target === 'all' || !params.target
        || (params.target === 'even' && base.page % 2 === 0) || (params.target === 'odd' && base.page % 2 !== 0);
      // En imágenes se respeta la orientación EXIF, porque el giro real solo la modifica
      await previewExec(`magick "${base.path}" ${isPdf ? '' : '-auto-orient'} ${applies ? `-rotate ${angle}` : ''} "${full}"`);
    } else {
      throw new Error('Herramienta de vista previa desconocida.');
    }

    // Se muestra una versión reducida: la anotación ya se aplicó al tamaño real del documento
    const view = path.join(dir, `view_${id}.png`);
    try { await previewExec(`magick "${full}" -resize "${VIEW_MAX}x${VIEW_MAX}>" "${view}"`); }
    finally { try { fs.unlinkSync(full); } catch (_) {} }

    if (lastView) { try { fs.unlinkSync(lastView); } catch (_) {} }
    lastView = view;

    return { ok: true, path: view, ...(await imageSize(view)), pages: base.pages, page: base.page, source: file ? path.basename(file) : null, font: font?.name || null };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}));
