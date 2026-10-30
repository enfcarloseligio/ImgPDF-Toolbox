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

// Une todas las imágenes en un único PDF: cada una se convierte a un PDF temporal (avance por
// imagen) y después Ghostscript los ensambla en el orden de la lista.
async function convertImagesToSinglePdf(event, { files, quality, outputDir }) {
  const results  = [];
  const progress = createProgress(event, 'img-to-pdf', { totalFiles: files.length, totalPages: files.length, unit: 'imágenes' });
  const tempDir  = path.join(app.getPath('temp'), `imgpdf_i2p_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  progress.start();

  try {
    const parts = [];
    for (let fi = 0; fi < files.length; fi++) {
      const file = files[fi];
      if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); return results; }
      const part = path.join(tempDir, `${String(fi + 1).padStart(4, '0')}.pdf`);
      try {
        await run(`magick "${file}" ${pdfQualityArgs(quality)} "${part}"`);
        parts.push(part);
        progress.tick({ currentFile: fi + 1, currentFileName: path.basename(file), currentPage: 1, currentFilePages: 1, stage: `Añadiendo ${path.basename(file)} (${fi + 1}/${files.length})` });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
        if (getIsCancelled()) return results;
      }
    }
    if (!parts.length) return results;

    const out = getUniqueFilePath(path.join(outputDir, path.basename(files[0], path.extname(files[0])) + '-combinado.pdf'));
    progress.stage('Ensamblando el PDF final...', { currentFile: files.length, currentFileName: path.basename(out), currentOut: path.basename(out) });
    await runGsWithProgress(findGhostscript(), [
      '-dBATCH', '-dNOPAUSE', '-dSAFER', '-sDEVICE=pdfwrite', '-dAutoRotatePages=/None', `-sOutputFile=${out}`, ...parts,
    ]);
    results.unshift({ file: files[0], out, ok: true, merged: parts.length });
    return results;
  } catch (e) {
    return [{ file: files[0], ok: false, error: getIsCancelled() ? 'Cancelado' : String(e) }];
  } finally {
    progress.done();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

ipcMain.handle('convert-img-to-pdf', async (event, { files, quality, outputDir, single = false }) => {
  if (imgToPdfBusy) {
    return [{ file: '*', ok: false, error: 'Ya hay una conversión en curso.' }];
  }
  imgToPdfBusy = true;
  resetCancelled();

  try {
    if (single) return await convertImagesToSinglePdf(event, { files, quality, outputDir });

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

    // 2. Estrategia por formato/fondo
    const isWhite = (background || '').toUpperCase() === '#FFFFFF';
    const needsPngIntermediate = (format === 'jpg' && !isWhite);
    const device = (format === 'png' || needsPngIntermediate) ? 'pngalpha' : 'jpeg';

    // 3. Procesar archivo por archivo, página por página
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

          const gsArgs = [
            '-dNOPAUSE', '-dBATCH', '-dQUIET', '-dSAFER',
            `-sDEVICE=${device}`,
            `-r${density}`,
            '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4',
            // Suaviza las imágenes incrustadas (logos, firmas) en lugar de mostrar sus píxeles
            '-dInterpolateControl=-1',
            ...(device === 'jpeg' ? [`-dJPEGQ=${jpgQuality}`] : []),
            `-dFirstPage=${p}`,
            `-dLastPage=${p}`,
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