// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-conversions.js
// Descripción: Handlers IPC de conversión: imagen → PDF y PDF → imagen (con conteo de
//              páginas y progreso real hacia el renderer).
// ═════════════════════════════════════════════════════════════════════════════

const { ipcMain, app } = require('electron');
const path = require('path');
const fs   = require('fs');
const {
  run,
  runSpawn,
  resetCancelled,
  getIsCancelled,
  findGhostscript,
  getUniqueFilePath,
} = require('./process-runner');
const { countPdfPages, createProgress, runGsWithProgress } = require('./progress');

// ── Guard anti re-entrada (evita doble clic / doble invocación) ──────────────
let imgToPdfBusy = false;
let pdfToImgBusy = false;

// ── Imagen → PDF ─────────────────────────────────────────────────────────────

// Argumentos de ImageMagick según la calidad elegida. 100 conserva los píxeles exactos
// (compresión Zip, sin pérdida; el PDF puede pesar más que el original). Por debajo se
// recomprime como JPEG con esa calidad, aplanando la transparencia sobre fondo blanco.
function pdfQualityArgs(quality) {
  const q = Number(quality) || 100;
  return q >= 100
    ? '-compress Zip'
    : `-background white -alpha remove -alpha off -compress JPEG -quality ${q}`;
}

// Agrupa una lista en bloques consecutivos de `size` elementos (el último puede ser menor).
function chunk(list, size) {
  const groups = [];
  for (let i = 0; i < list.length; i += size) groups.push(list.slice(i, i + size));
  return groups;
}

// Ensambla PDFs parciales en uno solo con Ghostscript, en el orden dado. Con calidad 100 las
// imágenes se conservan sin pérdida (Flate); con menos, el JPEG ya comprimido pasa tal cual.
function mergePdfParts(parts, out, quality = 100) {
  const lossless = (Number(quality) || 100) >= 100;
  return runGsWithProgress(findGhostscript(), [
    '-dBATCH', '-dNOPAUSE', '-dSAFER', '-sDEVICE=pdfwrite', '-dAutoRotatePages=/None',
    '-dDownsampleColorImages=false', '-dDownsampleGrayImages=false', '-dDownsampleMonoImages=false',
    ...(lossless
      ? ['-dAutoFilterColorImages=false', '-dColorImageFilter=/FlateEncode', '-dAutoFilterGrayImages=false', '-dGrayImageFilter=/FlateEncode']
      : ['-dPassThroughJPEGImages=true']),
    `-sOutputFile=${out}`, ...parts,
  ]);
}

// Une las imágenes en PDFs de varias páginas respetando el orden de la lista. groupSize = 0
// las junta todas en un solo PDF (nombre «…-combinado»); con groupSize = N crea un PDF por
// cada N imágenes consecutivas y lo nombra como su primera imagen, de modo que un número de
// hoja inesperado delata una imagen fuera de lugar. Cada imagen se convierte a un PDF
// temporal (avance por imagen) y después Ghostscript ensambla cada grupo.
async function convertImagesToGroupedPdfs(event, { files, quality, outputDir, groupSize = 0 }) {
  const results  = [];   // Errores
  const created  = [];   // PDFs generados, en el orden de la lista
  const groups   = groupSize > 0 ? chunk(files, groupSize) : [files];
  const progress = createProgress(event, 'img-to-pdf', { totalFiles: files.length, totalPages: files.length, unit: 'imágenes' });
  const tempDir  = path.join(app.getPath('temp'), `imgpdf_i2p_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  progress.start();

  try {
    let done = 0;
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const parts = [];

      for (const file of group) {
        if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); return [...created, ...results]; }
        const part = path.join(tempDir, `${String(++done).padStart(4, '0')}.pdf`);
        try {
          await run(`magick "${file}" ${pdfQualityArgs(quality)} "${part}"`);
          parts.push(part);
          progress.tick({ currentFile: done, currentFileName: path.basename(file), currentPage: 1, currentFilePages: 1, stage: `Añadiendo ${path.basename(file)} (${done}/${files.length})` });
        } catch (e) {
          results.push({ file, ok: false, error: String(e) });
          if (getIsCancelled()) return [...created, ...results];
        }
      }
      if (!parts.length) continue;

      const first = group[0];
      const base  = path.basename(first, path.extname(first));
      const out   = getUniqueFilePath(path.join(outputDir, groupSize > 0 ? `${base}.pdf` : `${base}-combinado.pdf`));
      progress.stage(groups.length > 1 ? `Ensamblando PDF ${gi + 1} de ${groups.length}...` : 'Ensamblando el PDF final...',
        { currentFile: done, currentFileName: path.basename(out), currentOut: path.basename(out) });
      await mergePdfParts(parts, out, quality);
      created.push({ file: first, out, ok: true, merged: parts.length });
    }
    return [...created, ...results];
  } catch (e) {
    return [{ file: files[0], ok: false, error: getIsCancelled() ? 'Cancelado' : String(e) }];
  } finally {
    progress.done();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

// mode: 'each' (un PDF por imagen), 'all' (todas en uno) o 'range' (un PDF cada rangeSize imágenes).
// single se conserva por compatibilidad: equivale a mode = 'all'.
ipcMain.handle('convert-img-to-pdf', async (event, { files, quality, outputDir, single = false, mode, rangeSize = 2 }) => {
  if (imgToPdfBusy) {
    return [{ file: '*', ok: false, error: 'Ya hay una conversión en curso.' }];
  }
  imgToPdfBusy = true;
  resetCancelled();

  try {
    const kind = mode || (single ? 'all' : 'each');
    if (kind !== 'each') {
      const groupSize = kind === 'range' ? Math.max(1, Math.round(Number(rangeSize)) || 1) : 0;
      return await convertImagesToGroupedPdfs(event, { files, quality, outputDir, groupSize });
    }

    const results  = [];
    const progress = createProgress(event, 'img-to-pdf', { totalFiles: files.length, totalPages: files.length, unit: 'archivos' });
    progress.start();

    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }
      const out = getUniqueFilePath(path.join(outputDir, path.basename(file, path.extname(file)) + '.pdf'));
      try {
        await run(`magick "${file}" ${pdfQualityArgs(quality)} "${out}"`);
        progress.tick({ currentFile: fi + 1, currentFileName: path.basename(file), currentPage: 1, currentFilePages: 1, currentOut: path.basename(out) });
        results.push({ file, out, ok: true });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
        if (getIsCancelled()) break;
      }
    }

    progress.done();
    return results;
  } finally {
    imgToPdfBusy = false;
  }
});

// ── Rasterizado de una página de PDF ─────────────────────────────────────────

// Renderiza la página `page` (base 1) de un PDF como imagen PNG o JPG en outFile. Ghostscript
// genera la imagen; si el fondo pedido difiere del que produce el dispositivo, ImageMagick lo
// aplana después. Lo comparten «PDF → Imágenes» y «Flujo de firma».
async function renderPageImage(gs, file, page, { density, format, background, jpgQuality = 100 }, outFile) {
  // Estrategia por formato/fondo
  const isWhite = (background || '').toUpperCase() === '#FFFFFF';
  const needsPngIntermediate = (format === 'jpg' && !isWhite);
  const device = (format === 'png' || needsPngIntermediate) ? 'pngalpha' : 'jpeg';
  const gsArgs = [
    '-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER',
    `-sDEVICE=${device}`,
    `-r${density}`,
    '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
    // Suaviza las imágenes incrustadas (logos, firmas) en lugar de mostrar sus píxeles
    '-dInterpolateControl=-1',
    ...(device === 'jpeg' ? [`-dJPEGQ=${jpgQuality}`] : []),
    `-dFirstPage=${page}`,
    `-dLastPage=${page}`,
    `-sOutputFile=${outFile}`,
    file
  ];

  await runSpawn(gs, gsArgs, { maxStdout: 0 });

  // Post-proceso por caso
  if (needsPngIntermediate) {
    // JPG + fondo distinto de blanco
    const tmpPngRaw       = outFile + '.raw.png';
    const tmpPngProcessed = outFile + '.proc.png';

    try {
      fs.renameSync(outFile, tmpPngRaw);
      await run(`magick "${tmpPngRaw}" -background "${background}" -alpha remove -alpha off "${tmpPngProcessed}"`);
      await run(`magick "${tmpPngProcessed}" -quality ${jpgQuality} "${outFile}"`);

      if (fs.existsSync(tmpPngRaw))       fs.unlinkSync(tmpPngRaw);
      if (fs.existsSync(tmpPngProcessed)) fs.unlinkSync(tmpPngProcessed);
    } catch (err) {
      try {
        if (fs.existsSync(tmpPngProcessed)) fs.unlinkSync(tmpPngProcessed);
        if (fs.existsSync(outFile))         fs.unlinkSync(outFile);
        if (fs.existsSync(tmpPngRaw))       fs.renameSync(tmpPngRaw, outFile);
      } catch (_) {}
    }
  } else if (format === 'png' && background !== 'original') {
    // PNG + fondo distinto de original
    const tempPng = outFile + '.tmp.png';
    try {
      fs.renameSync(outFile, tempPng);
      await run(`magick "${tempPng}" -background "${background}" -alpha remove -alpha off "${outFile}"`);
      fs.unlinkSync(tempPng);
    } catch (err) {
      try {
        if (fs.existsSync(tempPng)) {
          if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
          fs.renameSync(tempPng, outFile);
        }
      } catch (_) {}
    }
  }
  // JPG+blanco y PNG+original → nada
}

// ── PDF → Imágenes con progreso real ─────────────────────────────────────────

ipcMain.handle('convert-pdf-to-img', async (event, { files, density, format, background, jpgQuality = 100, outputDir }) => {
  if (pdfToImgBusy) {
    return [{ file: '*', ok: false, error: 'Ya hay una conversión en curso.' }];
  }
  pdfToImgBusy = true;
  resetCancelled();

  try {
    const results = [];
    const gsRaw   = findGhostscript();
    const gs      = gsRaw.replace(/^"|"$/g, '');

    // 1. Contar páginas para progreso global
    const filePageCounts = [];
    let totalPagesAllFiles = 0;

    for (const file of files) {
      if (getIsCancelled()) break;
      try {
        const pageCount = await countPdfPages(gsRaw, file);
        filePageCounts.push({ file, pages: pageCount });
        totalPagesAllFiles += pageCount;
      } catch (e) {
        filePageCounts.push({ file, pages: 0, error: String(e) });
      }
    }

    const progress = createProgress(event, 'pdf-to-img', { totalFiles: files.length, totalPages: totalPagesAllFiles });
    progress.start();

    // 2. Procesar archivo por archivo, página por página
    for (let fi = 0; fi < filePageCounts.length; fi++) {
      const { file, pages, error } = filePageCounts[fi];
      const outputs = [];

      if (error || pages === 0) {
        results.push({ file, ok: false, error: error || 'No se pudieron leer las páginas' });
        continue;
      }

      if (getIsCancelled()) {
        results.push({ file, ok: false, error: 'Cancelado' });
        break;
      }

      const name = path.basename(file, '.pdf');

      // Detección de exportaciones previas → sufijo (1), (2)...
      let baseName = name;
      let counter  = 1;
      while (fs.existsSync(path.join(outputDir, `${baseName}-pp-001.${format}`))) {
        baseName = `${name} (${counter})`;
        counter++;
      }

      try {
        for (let p = 1; p <= pages; p++) {
          if (getIsCancelled()) break;

          const outFile = path.join(outputDir, `${baseName}-pp-${String(p).padStart(3, '0')}.${format}`);

          await renderPageImage(gs, file, p, { density, format, background, jpgQuality }, outFile);

          outputs.push(outFile);
          progress.tick({
            currentFile: fi + 1,
            currentFileName: path.basename(file),
            currentPage: p,
            currentFilePages: pages,
            currentOut: path.basename(outFile),
          });
        }

        if (getIsCancelled()) {
          results.push({ file, ok: false, error: 'Cancelado' });
          break;
        }

        results.push({ file, ok: true, pages, outputs });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
        if (getIsCancelled()) break;
      }
    }

    progress.done();

    return results;
  } finally {
    pdfToImgBusy = false;
  }
});

// ── Exportaciones ────────────────────────────────────────────────────────────
// Las comparte la herramienta «Flujo de firma» (src/ipc-flow.js).

module.exports = { chunk, mergePdfParts, pdfQualityArgs, renderPageImage };
