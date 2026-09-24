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

// ── Merge PDFs ───────────────────────────────────────────────────────────────

ipcMain.handle('merge-pdfs', async (_, { files, outputDir }) => {
  resetCancelled();
  const gs  = findGhostscript();
  const out = getUniqueFilePath(path.join(outputDir, path.basename(files[0], '.pdf') + '-combinado.pdf'));
  try {
    await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dAutoRotatePages=/None -sOutputFile="${out}" ${files.map(f => `"${f}"`).join(' ')}`);
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

ipcMain.handle('split-pdf', async (_, { file, mode, blockSize, customRanges, outputDir, totalPages }) => {
  resetCancelled();
  const gs   = findGhostscript();
  const name = path.basename(file, '.pdf');
  const results = [];

  if (mode === 'custom') {
    const parts = customRanges.split(',').map(s => s.trim()).filter(s => s);
    for (const part of parts) {
      if (!/^\d+(-\d+)?$/.test(part)) {
        return { ok: false, error: `Rango inválido: "${part}". Usa el formato 1-5 o un número como 7.` };
      }
      const [first, last] = part.includes('-') ? part.split('-').map(Number) : [Number(part), Number(part)];
      if (first < 1 || last > totalPages || first > last) {
        return { ok: false, error: `Rango "${part}" fuera de límites. El PDF tiene ${totalPages} páginas.` };
      }
    }
  }

  const gsRun = async (first, last, targetPath) => {
    const out = getUniqueFilePath(targetPath);
    await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${first} -dLastPage=${last} -sOutputFile="${out}" "${file}"`);
    return out;
  };

  if (mode === 'individual') {
    for (let i = 1; i <= totalPages; i++) {
      if (getIsCancelled()) break;
      try {
        const out = await gsRun(i, i, path.join(outputDir, `${name}-pag${String(i).padStart(3,'0')}.pdf`));
        results.push({ page: i, out, ok: true });
      } catch (e) { results.push({ page: i, ok: false, error: String(e) }); }
    }
  } else if (mode === 'block') {
    let block = 1;
    for (let i = 1; i <= totalPages; i += blockSize) {
      if (getIsCancelled()) break;
      const end = Math.min(i + blockSize - 1, totalPages);
      try {
        const out = await gsRun(i, end, path.join(outputDir, `${name}-bloque${String(block).padStart(2,'0')}.pdf`));
        results.push({ block, pages: `${i}-${end}`, out, ok: true });
      } catch (e) { results.push({ block, ok: false, error: String(e) }); }
      block++;
    }
  } else if (mode === 'custom') {
    const parts = customRanges.split(',').map(s => s.trim()).filter(s => s);
    let partNum = 1;
    for (const part of parts) {
      if (getIsCancelled()) break;
      const [first, last] = part.includes('-') ? part.split('-').map(s => s.trim()) : [part, part];
      try {
        const out = await gsRun(first, last, path.join(outputDir, `${name}-parte${String(partNum).padStart(2,'0')}.pdf`));
        results.push({ out, ok: true });
      } catch (e) { results.push({ ok: false, error: String(e) }); }
      partNum++;
    }
  }

  return { ok: true, totalPages, results, wasCancelled: getIsCancelled() };
});

// ── Compresión ───────────────────────────────────────────────────────────────

ipcMain.handle('compress-pdf', async (_, { files, profile, outputDir }) => {
  resetCancelled();
  const gs = findGhostscript();
  const results = [];

  const profileMap = { screen: '/screen', ebook: '/ebook', printer: '/printer', prepress: '/prepress' };
  const gsProfile  = profileMap[profile] || '/ebook';

  for (const file of files) {
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const name       = path.basename(file, '.pdf');
    const out        = getUniqueFilePath(path.join(outputDir, `${name}-comprimido.pdf`));
    const sizeBefore = fs.existsSync(file) ? fs.statSync(file).size : 0;

    try {
      await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dCompatibilityLevel=1.4 -dPDFSETTINGS=${gsProfile} -sOutputFile="${out}" "${file}"`);
      const sizeAfter = fs.existsSync(out) ? fs.statSync(out).size : 0;
      results.push({ file, out, ok: true, sizeBefore, sizeAfter });
    } catch (e) {
      results.push({ file, ok: false, error: String(e) });
      if (getIsCancelled()) break;
    }
  }
  return results;
});

// ── Rotación ─────────────────────────────────────────────────────────────────

ipcMain.handle('rotate-files', async (_, { files, angle, target, outputDir }) => {
  resetCancelled();
  const gs = findGhostscript();
  const results = [];

  for (const file of files) {
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const ext   = path.extname(file).toLowerCase();
    const name  = path.basename(file, ext);
    const isPdf = ext === '.pdf';

    if (!isPdf) {
      const out = getUniqueFilePath(path.join(outputDir, `${name}-rot${angle}${ext}`));
      try {
        await run(`magick "${file}" -rotate ${angle} "${out}"`);
        results.push({ file, out, ok: true });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
      }
    } else {
      try {
        const countStr   = await run(`magick identify -ping -format "%n " "${file}"`);
        const totalPages = parseInt(countStr.trim().split(/\s+/)[0], 10) || 0;
        const tempDir    = path.join(app.getPath('temp'), `imgpdf_rot_${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        const pageParts = [];

        for (let i = 1; i <= totalPages; i++) {
          if (getIsCancelled()) break;
          const shouldRotate =
            target === 'all' ||
            (target === 'even' && i % 2 === 0) ||
            (target === 'odd'  && i % 2 !== 0);

          const tempOut = path.join(tempDir, `pag${String(i).padStart(3,'0')}.pdf`);

          if (shouldRotate) {
            const tempImg = path.join(tempDir, `pag${String(i).padStart(3,'0')}.png`);
            await run(`magick -density 200 "${file}[${i-1}]" "${tempImg}"`);
            await run(`magick "${tempImg}" -rotate ${angle} "${tempOut}"`);
          } else {
            await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -dFirstPage=${i} -dLastPage=${i} -sOutputFile="${tempOut}" "${file}"`);
          }
          pageParts.push(tempOut);
        }

        if (!getIsCancelled() && pageParts.length > 0) {
          const out    = getUniqueFilePath(path.join(outputDir, `${name}-rot${angle}.pdf`));
          const inputs = pageParts.map(p => `"${p}"`).join(' ');
          await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -sOutputFile="${out}" ${inputs}`);
          results.push({ file, out, ok: true });
        }

        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
        if (getIsCancelled()) break;
      }
    }
  }
  return results;
});

// ── Desbloqueo ───────────────────────────────────────────────────────────────

ipcMain.handle('unlock-pdf', async (_, { files, password, outputDir }) => {
  resetCancelled();
  const gs = findGhostscript();
  const results = [];

  for (const file of files) {
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const name   = path.basename(file, '.pdf');
    const out    = getUniqueFilePath(path.join(outputDir, `${name}-desbloqueado.pdf`));
    const pwFlag = password ? `-sPDFPassword="${password}"` : '';

    try {
      await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER ${pwFlag} -sOutputFile="${out}" "${file}"`);
      results.push({ file, out, ok: true });
    } catch (e) {
      const errMsg  = String(e);
      const wrongPw = errMsg.toLowerCase().includes('password') || errMsg.includes('encrypted');
      results.push({ file, ok: false, error: wrongPw ? 'Contraseña incorrecta o PDF no desbloqueado' : errMsg });
      if (getIsCancelled()) break;
    }
  }
  return results;
});

// ── Estándares PDF ───────────────────────────────────────────────────────────

ipcMain.handle('convert-pdf-standard', async (_, { files, standard, outputDir }) => {
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

  for (const file of files) {
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const name = path.basename(file, '.pdf');
    const out  = getUniqueFilePath(path.join(outputDir, `${name}-${suffix}.pdf`));

    try {
      await run(
        `${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER ` +
        `${flags} ` +
        `-dCompatibilityLevel=1.4 ` +
        `-sOutputFile="${out}" "${file}"`
      );
      results.push({ file, out, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: String(e) });
      if (getIsCancelled()) break;
    }
  }
  return results;
});