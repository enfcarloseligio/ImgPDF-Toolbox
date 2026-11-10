// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-pdf-ops.js
// Descripción: Handlers IPC de operaciones sobre PDF: unir, consultar información, separar,
//              comprimir, rotar, desbloquear y convertir a estándares (PDF/A, PDF/X, PDF/UA).
//              Todas informan del avance real por página mediante src/progress.js.
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
const { countUnits, createProgress, runGsWithProgress } = require('./progress');
const { PDFDocument, degrees } = require('pdf-lib');
const { rotateJpegBuffer } = require('./lossless-rotate');

// ── Utilidades compartidas ───────────────────────────────────────────────────

// Total de páginas (o unidades) contadas en una lista de { file, pages }.
const sumPages = units => units.reduce((n, u) => n + u.pages, 0);

// Argumentos base de Ghostscript para escribir un PDF sin interacción.
const GS_PDFWRITE = ['-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', '-dSAFER'];

// ── Merge PDFs ───────────────────────────────────────────────────────────────

ipcMain.handle('merge-pdfs', async (event, { files, outputDir }) => {
  resetCancelled();
  const gs  = findGhostscript();
  const out = getUniqueFilePath(path.join(outputDir, path.basename(files[0], '.pdf') + '-combinado.pdf'));

  try {
    const units    = await countUnits(gs, files);
    const progress = createProgress(event, 'merge', { totalFiles: files.length, totalPages: sumPages(units) });
    progress.start();

    // Una sola llamada con todos los documentos: el índice de archivo lo da Ghostscript
    await runGsWithProgress(gs, [
      ...GS_PDFWRITE, '-dAutoRotatePages=/None', `-sOutputFile=${out}`, ...files,
    ], {
      onPage: (page, fi) => progress.tick({
        currentFile: fi, currentFileName: path.basename(files[fi - 1] || ''),
        currentPage: page, currentFilePages: units[fi - 1]?.pages, currentOut: path.basename(out),
      }),
    });

    progress.done();
    return { ok: true, out };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

// ── Info de PDF ──────────────────────────────────────────────────────────────

ipcMain.handle('get-pdf-info', async (_, file) => {
  try {
    const out = await run(`magick identify -ping -format "%n " "${file}"`);
    const pages = parseInt(out.trim().split(/\s+/)[0], 10) || 0;
    return { ok: true, pages };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
});

// ── Split PDF ────────────────────────────────────────────────────────────────

ipcMain.handle('split-pdf', async (event, { file, mode, blockSize, customRanges, outputDir, totalPages }) => {
  resetCancelled();
  const gs   = findGhostscript();
  const name = path.basename(file, '.pdf');
  const pad  = (n, len) => String(n).padStart(len, '0');
  const parts = mode === 'custom' ? customRanges.split(',').map(s => s.trim()).filter(s => s) : [];

  // Validación de rangos personalizados antes de procesar
  for (const part of parts) {
    if (!/^\d+(-\d+)?$/.test(part)) {
      return { ok: false, error: `Rango inválido: "${part}". Usa el formato 1-5 o un número como 7.` };
    }
    const [first, last] = part.includes('-') ? part.split('-').map(Number) : [Number(part), Number(part)];
    if (first < 1 || last > totalPages || first > last) {
      return { ok: false, error: `Rango "${part}" fuera de límites. El PDF tiene ${totalPages} páginas.` };
    }
  }

  // Plan de salida: cada segmento es un documento nuevo con su rango de páginas
  const segments = [];
  if (mode === 'individual') {
    for (let i = 1; i <= totalPages; i++) {
      segments.push({ first: i, last: i, target: path.join(outputDir, `${name}-pag${pad(i, 3)}.pdf`), meta: { page: i } });
    }
  } else if (mode === 'block') {
    let block = 1;
    for (let i = 1; i <= totalPages; i += blockSize) {
      const end = Math.min(i + blockSize - 1, totalPages);
      segments.push({ first: i, last: end, target: path.join(outputDir, `${name}-bloque${pad(block, 2)}.pdf`), meta: { block, pages: `${i}-${end}` } });
      block++;
    }
  } else if (mode === 'custom') {
    parts.forEach((part, idx) => {
      const [first, last] = part.includes('-') ? part.split('-').map(Number) : [Number(part), Number(part)];
      segments.push({ first, last, target: path.join(outputDir, `${name}-parte${pad(idx + 1, 2)}.pdf`), meta: {} });
    });
  }

  const progress = createProgress(event, 'split', {
    totalFiles: segments.length,
    totalPages: segments.reduce((n, s) => n + (s.last - s.first + 1), 0),
  });
  progress.start();

  const results = [];
  for (let si = 0; si < segments.length; si++) {
    if (getIsCancelled()) break;
    const seg = segments[si];
    const out = getUniqueFilePath(seg.target);

    try {
      await runGsWithProgress(gs, [
        ...GS_PDFWRITE, `-dFirstPage=${seg.first}`, `-dLastPage=${seg.last}`, `-sOutputFile=${out}`, file,
      ], {
        onPage: page => progress.tick({
          currentFile: si + 1, currentFileName: path.basename(out),
          currentPage: page - seg.first + 1, currentFilePages: seg.last - seg.first + 1,
          currentOut: path.basename(out),
        }),
      });
      results.push({ ...seg.meta, out, ok: true });
    } catch (e) {
      results.push({ ...seg.meta, ok: false, error: String(e) });
    }
  }

  progress.done();
  return { ok: true, totalPages, results, wasCancelled: getIsCancelled() };
});

// ── Compresión ───────────────────────────────────────────────────────────────

ipcMain.handle('compress-pdf', async (event, { files, profile, outputDir }) => {
  resetCancelled();
  const gs = findGhostscript();
  const results = [];

  // Cada perfil parte de un preajuste de Ghostscript; los de 200, 400 y 600 DPI fijan además la
  // resolución de las imágenes (Ghostscript solo las reduce, nunca las amplía)
  const profileMap = {
    screen:   { settings: '/screen' },
    ebook:    { settings: '/ebook' },
    standard: { settings: '/ebook',    dpi: 200 },
    printer:  { settings: '/printer' },
    prepress: { settings: '/prepress', dpi: 400 },
    archive:  { settings: '/prepress', dpi: 600 },
  };
  const selected   = profileMap[profile] || profileMap.printer;
  const gsProfile  = selected.settings;
  const dpiArgs    = selected.dpi ? ['Color', 'Gray', 'Mono'].flatMap(t => [
    `-dDownsample${t}Images=true`, `-d${t}ImageResolution=${t === 'Mono' ? selected.dpi * 2 : selected.dpi}`, `-d${t}ImageDownsampleThreshold=1.0`,
  ]) : [];

  const units    = await countUnits(gs, files);
  const progress = createProgress(event, 'compress', { totalFiles: files.length, totalPages: sumPages(units) });
  progress.start();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const name       = path.basename(file, '.pdf');
    const out        = getUniqueFilePath(path.join(outputDir, `${name}-comprimido.pdf`));
    const sizeBefore = fs.existsSync(file) ? fs.statSync(file).size : 0;

    try {
      await runGsWithProgress(gs, [
        ...GS_PDFWRITE, '-dCompatibilityLevel=1.4', `-dPDFSETTINGS=${gsProfile}`, ...dpiArgs, `-sOutputFile=${out}`, file,
      ], {
        onPage: page => progress.tick({
          currentFile: fi + 1, currentFileName: path.basename(file),
          currentPage: page, currentFilePages: units[fi]?.pages, currentOut: path.basename(out),
        }),
      });
      const sizeAfter = fs.existsSync(out) ? fs.statSync(out).size : 0;
      results.push({ file, out, ok: true, sizeBefore, sizeAfter });
    } catch (e) {
      results.push({ file, ok: false, error: String(e) });
      if (getIsCancelled()) break;
    }
  }

  progress.done();
  return results;
});

// ── Rotación ─────────────────────────────────────────────────────────────────

ipcMain.handle('rotate-files', async (event, { files, angle, target, outputDir }) => {
  resetCancelled();
  const gs = findGhostscript();
  const results = [];

  const units  = await countUnits(gs, files);
  const allPdf = files.every(f => path.extname(f).toLowerCase() === '.pdf');
  const noPdf  = files.every(f => path.extname(f).toLowerCase() !== '.pdf');
  const progress = createProgress(event, 'rotate', {
    totalFiles: files.length,
    totalPages: sumPages(units),
    unit: allPdf ? 'páginas' : noPdf ? 'archivos' : 'elementos',
  });
  progress.start();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const ext   = path.extname(file).toLowerCase();
    const name  = path.basename(file, ext);
    const isPdf = ext === '.pdf';
    const info  = { currentFile: fi + 1, currentFileName: path.basename(file) };

    if (!isPdf) {
      // Imágenes: el giro nunca recomprime. PNG se gira en píxeles (sin pérdida) y JPG solo
      // cambia su etiqueta de orientación, de modo que los datos de la imagen no se tocan
      const out = getUniqueFilePath(path.join(outputDir, `${name}-rot${angle}${ext}`));
      try {
        if (ext === '.jpg' || ext === '.jpeg') fs.writeFileSync(out, rotateJpegBuffer(fs.readFileSync(file), angle));
        else await run(`magick "${file}" -rotate ${angle} "${out}"`);
        progress.tick({ ...info, currentPage: 1, currentFilePages: 1, currentOut: path.basename(out) });
        results.push({ file, out, ok: true });
      } catch (e) {
        results.push({ file, ok: false, error: String(e.message || e) });
      }
    } else {
      // PDF: solo se ajusta el giro de cada página (/Rotate); el contenido, las fuentes y las
      // imágenes no se vuelven a procesar, así que no se pierde calidad ni texto seleccionable
      try {
        const doc = await PDFDocument.load(fs.readFileSync(file), { updateMetadata: false });
        const pages = doc.getPages();

        pages.forEach((page, i) => {
          const n = i + 1;
          const shouldRotate =
            target === 'all' ||
            (target === 'even' && n % 2 === 0) ||
            (target === 'odd'  && n % 2 !== 0);
          if (shouldRotate) page.setRotation(degrees((page.getRotation().angle + Number(angle)) % 360));
          progress.tick({ ...info, currentPage: n, currentFilePages: pages.length, currentOut: `${name}-rot${angle}.pdf` });
        });

        const out = getUniqueFilePath(path.join(outputDir, `${name}-rot${angle}.pdf`));
        progress.stage('Guardando el PDF…', info);
        fs.writeFileSync(out, await doc.save());
        results.push({ file, out, ok: true });
      } catch (e) {
        const encrypted = /encrypt/i.test(String(e && e.message));
        results.push({ file, ok: false, error: encrypted ? 'El PDF está protegido: usa Desbloquear antes de girarlo.' : String(e.message || e) });
      }
    }
  }

  progress.done();
  return results;
});

// ── Desbloqueo ───────────────────────────────────────────────────────────────

ipcMain.handle('unlock-pdf', async (event, { files, password, outputDir }) => {
  resetCancelled();
  const gs = findGhostscript();
  const results = [];

  const units    = await countUnits(gs, files, { password });
  const progress = createProgress(event, 'unlock', { totalFiles: files.length, totalPages: sumPages(units) });
  progress.start();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const name = path.basename(file, '.pdf');
    const out  = getUniqueFilePath(path.join(outputDir, `${name}-desbloqueado.pdf`));

    try {
      await runGsWithProgress(gs, [
        ...GS_PDFWRITE, ...(password ? [`-sPDFPassword=${password}`] : []), `-sOutputFile=${out}`, file,
      ], {
        onPage: page => progress.tick({
          currentFile: fi + 1, currentFileName: path.basename(file),
          currentPage: page, currentFilePages: units[fi]?.pages, currentOut: path.basename(out),
        }),
      });
      results.push({ file, out, ok: true });
    } catch (e) {
      const errMsg  = String(e);
      const wrongPw = errMsg.toLowerCase().includes('password') || errMsg.includes('encrypted');
      results.push({ file, ok: false, error: wrongPw ? 'Contraseña incorrecta o PDF no desbloqueado' : errMsg });
      if (getIsCancelled()) break;
    }
  }

  progress.done();
  return results;
});

// ── Estándares PDF ───────────────────────────────────────────────────────────

ipcMain.handle('convert-pdf-standard', async (event, { files, standard, outputDir }) => {
  resetCancelled();
  const gs      = findGhostscript();
  const results = [];

  const standardFlags = {
    'PDFA-1b':  `-dPDFA=1 -dPDFACompatibilityPolicy=1 -sColorConversionStrategy=UseDeviceIndependentColor`,
    'PDFA-2b':  `-dPDFA=2 -dPDFACompatibilityPolicy=1 -sColorConversionStrategy=UseDeviceIndependentColor`,
    'PDFA-3b':  `-dPDFA=3 -dPDFACompatibilityPolicy=1 -sColorConversionStrategy=UseDeviceIndependentColor`,
    'PDFA-4':   `-dPDFA=2 -dPDFACompatibilityPolicy=2 -sColorConversionStrategy=UseDeviceIndependentColor`,
    'PDFX-1a':  `-dPDFX -dPDFXVersion=/PDF\\/X-1a:2001`,
    'PDFX-3':   `-dPDFX -dPDFXVersion=/PDF\\/X-3:2002`,
    'PDFUA-1':  `-dPDFA=1 -dPDFACompatibilityPolicy=1 -dTagged=true`,
    'PDFE-1':   `-dPDFA=1 -dPDFACompatibilityPolicy=1`,
  };

  const suffixMap = {
    'PDFA-1b': 'pdfa1b', 'PDFA-2b': 'pdfa2b', 'PDFA-3b': 'pdfa3b', 'PDFA-4': 'pdfa4',
    'PDFX-1a': 'pdfx1a', 'PDFX-3':  'pdfx3',  'PDFUA-1': 'pdfua1', 'PDFE-1': 'pdfe1',
  };

  const flags  = standardFlags[standard] || standardFlags['PDFA-2b'];
  const suffix = suffixMap[standard]     || 'std';

  const units    = await countUnits(gs, files);
  const progress = createProgress(event, 'pdf-standards', { totalFiles: files.length, totalPages: sumPages(units) });
  progress.start();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const name = path.basename(file, '.pdf');
    const out  = getUniqueFilePath(path.join(outputDir, `${name}-${suffix}.pdf`));

    try {
      await runGsWithProgress(gs, [
        ...GS_PDFWRITE, ...flags.split(/\s+/), '-dCompatibilityLevel=1.4', `-sOutputFile=${out}`, file,
      ], {
        onPage: page => progress.tick({
          currentFile: fi + 1, currentFileName: path.basename(file),
          currentPage: page, currentFilePages: units[fi]?.pages, currentOut: path.basename(out),
        }),
      });
      results.push({ file, out, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: String(e) });
      if (getIsCancelled()) break;
    }
  }

  progress.done();
  return results;
});
