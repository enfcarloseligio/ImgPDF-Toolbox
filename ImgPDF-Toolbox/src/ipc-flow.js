// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-flow.js
// Descripción: Handler IPC de «Flujo de firma»: convierte un PDF (por ejemplo, con la firma
//              ya incrustada) en imágenes con el formato y la resolución elegidos y vuelve a
//              armar PDFs con ellas, todo en un solo paso. La salida puede ser un único PDF,
//              un PDF por página o un PDF por cada N páginas, nombrados con el número de la
//              primera página que contienen. Reutiliza el rasterizado de PDF → Imágenes y
//              el ensamblado de Imágenes → PDF.
// ═════════════════════════════════════════════════════════════════════════════

const { ipcMain, app } = require('electron');
const path = require('path');
const fs   = require('fs');
const {
  run,
  resetCancelled,
  getIsCancelled,
  findGhostscript,
  getUniqueFilePath,
} = require('./process-runner');
const { countPdfPages, createProgress } = require('./progress');
const { chunk, mergePdfParts, renderPageImage } = require('./ipc-conversions');

// Guardia contra ejecuciones simultáneas (doble clic)
let flowBusy = false;

const pad = (n, len = 3) => String(n).padStart(len, '0');

// ── Imagen de una página → PDF de una página ─────────────────────────────────

// Convierte la imagen rasterizada en un PDF de una página con el tamaño físico original (la
// resolución de trabajo se fija como densidad). PNG se incrusta sin pérdida; JPG con la
// calidad elegida.
async function imageToPagePdf(image, out, { format, density, jpgQuality }) {
  const encode = format === 'jpg'
    ? `-background white -alpha remove -alpha off -compress JPEG -quality ${jpgQuality}`
    : '-compress Zip';
  await run(`magick "${image}" -units PixelsPerInch -density ${density} ${encode} "${out}"`);
}

// ── Flujo de firma ───────────────────────────────────────────────────────────
// mode: 'all' (un solo PDF), 'each' (un PDF por página) o 'range' (un PDF cada rangeSize páginas).

ipcMain.handle('sign-flow', async (event, {
  files, density = 300, format = 'png', background = '#FFFFFF', jpgQuality = 95,
  mode = 'all', rangeSize = 2, outputDir,
}) => {
  if (flowBusy) return [{ file: '*', ok: false, error: 'Ya hay una conversión en curso.' }];
  flowBusy = true;
  resetCancelled();

  const results = [];
  const gsRaw   = findGhostscript();
  const gs      = gsRaw.replace(/^"|"$/g, '');
  const size    = mode === 'each' ? 1 : mode === 'range' ? Math.max(1, Math.round(Number(rangeSize)) || 1) : 0;
  const ext     = format === 'jpg' ? 'jpg' : 'png';
  const opts    = { density, format: ext, background, jpgQuality };

  try {
    // 1. Contar las páginas para que el progreso sea real
    const counts = [];
    let totalPages = 0;
    for (const file of files) {
      try {
        const pages = await countPdfPages(gsRaw, file);
        counts.push({ file, pages });
        totalPages += pages;
      } catch (e) {
        counts.push({ file, pages: 0, error: String(e.message || e) });
      }
    }

    const progress = createProgress(event, 'sign-flow', { totalFiles: files.length, totalPages });
    progress.start();

    // 2. Cada PDF se procesa por separado: páginas → imágenes → PDFs parciales → PDFs finales
    for (let fi = 0; fi < counts.length; fi++) {
      const { file, pages, error } = counts[fi];
      if (error || !pages) { results.push({ file, ok: false, error: error || 'No se pudieron leer las páginas' }); continue; }
      if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

      const name    = path.basename(file, path.extname(file));
      const tempDir = path.join(app.getPath('temp'), `imgpdf_flow_${Date.now()}_${fi}`);
      const created = [];
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const parts = [];
        for (let p = 1; p <= pages; p++) {
          if (getIsCancelled()) throw new Error('Cancelado');
          const image = path.join(tempDir, `${name}-pp-${pad(p)}.${ext}`);
          const part  = path.join(tempDir, `part-${pad(p, 4)}.pdf`);
          await renderPageImage(gs, file, p, opts, image);
          await imageToPagePdf(image, part, opts);
          try { fs.unlinkSync(image); } catch (_) { /* la imagen temporal ya no hace falta */ }
          parts.push(part);
          progress.tick({ currentFile: fi + 1, currentFileName: path.basename(file), currentPage: p, currentFilePages: pages });
        }

        // 3. Reparto de las páginas en PDFs, en el orden original
        const groups = size > 0 ? chunk(parts, size) : [parts];
        for (let gi = 0; gi < groups.length; gi++) {
          if (getIsCancelled()) throw new Error('Cancelado');
          const group = groups[gi];
          const base  = size > 0 ? `${name}-pp-${pad(gi * size + 1)}` : `${name}-firmado`;
          const out   = getUniqueFilePath(path.join(outputDir, `${base}.pdf`));
          progress.stage(groups.length > 1 ? `Ensamblando PDF ${gi + 1} de ${groups.length}...` : 'Ensamblando el PDF final...',
            { currentFile: fi + 1, currentFileName: path.basename(file), currentOut: path.basename(out) });
          if (group.length === 1) fs.copyFileSync(group[0], out);
          else await mergePdfParts(group, out, ext === 'png' ? 100 : 90);
          created.push(out);
        }

        results.push({ file, ok: true, pages, outputs: created });
      } catch (e) {
        // Una ejecución interrumpida no deja PDFs a medias en la carpeta de salida
        created.forEach(f => { try { fs.unlinkSync(f); } catch (_) {} });
        const cancelled = getIsCancelled();
        results.push({ file, ok: false, error: cancelled ? 'Cancelado' : String(e.message || e) });
        if (cancelled) break;
      } finally {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
      }
    }

    progress.done();
    return results;
  } finally {
    flowBusy = false;
  }
});
