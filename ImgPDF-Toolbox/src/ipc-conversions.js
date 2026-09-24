const { ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');
const { spawn } = require('child_process');
const {
  run,
  runSpawn,
  registerProcess,
  clearProcess,
  resetCancelled,
  getIsCancelled,
  findGhostscript,
  getUniqueFilePath,
} = require('./process-runner');

// ── Guard anti re-entrada (evita doble clic / doble invocación) ──────────────
let imgToPdfBusy = false;
let pdfToImgBusy = false;

// ── Imagen → PDF ─────────────────────────────────────────────────────────────

ipcMain.handle('convert-img-to-pdf', async (_, { files, quality, outputDir }) => {
  if (imgToPdfBusy) {
    return [{ file: '*', ok: false, error: 'Ya hay una conversión en curso.' }];
  }
  imgToPdfBusy = true;
  resetCancelled();

  try {
    const results = [];
    for (const file of files) {
      if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }
      const out = getUniqueFilePath(path.join(outputDir, path.basename(file, path.extname(file)) + '.pdf'));
      try {
        await run(`magick "${file}" -quality ${quality} "${out}"`);
        results.push({ file, out, ok: true });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
        if (getIsCancelled()) break;
      }
    }
    return results;
  } finally {
    imgToPdfBusy = false;
  }
});

// ── Contador de páginas con Ghostscript ──────────────────────────────────────

function countPdfPages(gsPath, pdfPath) {
  return new Promise((resolve, reject) => {
    const cleanGs  = gsPath.replace(/^"|"$/g, '');
    const safePath = pdfPath.replace(/\\/g, '/');
    const args = [
      '-q', '-dNODISPLAY', '-dNOSAFER',
      '-c', `(${safePath}) (r) file runpdfbegin pdfpagecount = quit`
    ];
    const proc = spawn(cleanGs, args, { windowsHide: true });

    // Registrar como proceso actual para que killCurrentProcess lo alcance
    registerProcess(proc);

    let out = '';
    proc.stdout.on('data', c => out += c.toString());
    proc.stderr.on('data', () => {});
    proc.on('close', code => {
      clearProcess(proc);
      if (getIsCancelled()) return reject(new Error('Cancelado'));
      const n = parseInt(out.trim(), 10);
      if (!isNaN(n) && n > 0) resolve(n);
      else reject(new Error(`No se pudo contar páginas (code ${code})`));
    });
    proc.on('error', err => {
      clearProcess(proc);
      reject(err);
    });
  });
}

// ── PDF → Imágenes con progreso real ─────────────────────────────────────────

ipcMain.handle('convert-pdf-to-img', async (event, { files, density, format, background, outputDir }) => {
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

    event.sender.send('progress', {
      module: 'pdf-to-img',
      phase: 'start',
      totalFiles: files.length,
      totalPages: totalPagesAllFiles,
      currentFile: 0,
      currentPage: 0,
    });

    // 2. Estrategia por formato/fondo
    const isWhite = (background || '').toUpperCase() === '#FFFFFF';
    const needsPngIntermediate = (format === 'jpg' && !isWhite);
    const device = (format === 'png' || needsPngIntermediate) ? 'pngalpha' : 'jpeg';

    // 3. Procesar archivo por archivo, página por página
    let globalPageCounter = 0;

    for (let fi = 0; fi < filePageCounts.length; fi++) {
      const { file, pages, error } = filePageCounts[fi];

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
              await run(`magick "${tmpPngProcessed}" -quality 95 "${outFile}"`);

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

          globalPageCounter++;

          event.sender.send('progress', {
            module: 'pdf-to-img',
            phase: 'processing',
            totalFiles: files.length,
            totalPages: totalPagesAllFiles,
            currentFile: fi + 1,
            currentFileName: path.basename(file),
            currentPage: p,
            currentFilePages: pages,
            globalPage: globalPageCounter,
            currentOut: path.basename(outFile),
          });
        }

        if (getIsCancelled()) {
          results.push({ file, ok: false, error: 'Cancelado' });
          break;
        }

        results.push({ file, ok: true, pages });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
        if (getIsCancelled()) break;
      }
    }

    event.sender.send('progress', {
      module: 'pdf-to-img',
      phase: 'done',
      totalPages: totalPagesAllFiles,
      globalPage: globalPageCounter,
    });

    return results;
  } finally {
    pdfToImgBusy = false;
  }
});