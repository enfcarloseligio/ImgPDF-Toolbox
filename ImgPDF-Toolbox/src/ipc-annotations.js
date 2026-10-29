// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-annotations.js
// Descripción: Handlers IPC de anotaciones sobre documentos: marca de agua de texto,
//              foliado/numeración y marca de agua de imagen.
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
const { countUnits, createProgress } = require('./progress');

// ── Helpers compartidos ──────────────────────────────────────────────────────

function positionToGravity(position) {
  const map = {
    top_left:      'NorthWest',
    top_center:    'North',
    top_right:     'NorthEast',
    mid_left:      'West',
    center:        'Center',
    mid_right:     'East',
    bottom_left:   'SouthWest',
    bottom_center: 'South',
    bottom_right:  'SouthEast',
  };
  return map[position] || 'SouthEast';
}

function buildFolioText({ mode, prefix, suffix, separator, digits, startNum,
  pageNum, totalPages, dateFormat, customDate, useToday }) {

  const pad = n => String(n).padStart(digits, '0');

  const getDate = () => {
    if (useToday) return new Date();
    if (customDate) return new Date(customDate + 'T12:00:00');
    return new Date();
  };

  const formatDate = (d) => {
    const meses = ['enero','febrero','marzo','abril','mayo','junio',
                   'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const mc    = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const dd    = String(d.getDate()).padStart(2,'0');
    const mm    = String(d.getMonth()+1).padStart(2,'0');
    const yy    = d.getFullYear();
    switch (dateFormat) {
      case 'DD/MM/AAAA':    return `${dd}/${mm}/${yy}`;
      case 'AAAA-MM-DD':    return `${yy}-${mm}-${dd}`;
      case 'D de Mes AAAA': return `${d.getDate()} de ${meses[d.getMonth()]} de ${yy}`;
      case 'Mes D AAAA':    return `${meses[d.getMonth()]} ${d.getDate()}, ${yy}`;
      case 'DD-MMM-AAAA':   return `${dd}-${mc[d.getMonth()]}-${yy}`;
      default:              return `${dd}/${mm}/${yy}`;
    }
  };

  const n = startNum + pageNum - 1;
  switch (mode) {
    case 'pagina':        return `${prefix || 'Página'} ${pageNum}`;
    case 'pagina-total':  return `${prefix || 'Página'} ${pageNum} ${suffix || 'de'} ${totalPages}`;
    case 'folio':         return `${prefix || 'FOLIO:'} ${pad(n)}`;
    case 'folio-prefijo': return `${prefix}${separator}${pad(n)}${suffix}`;
    case 'folio-abierto': return (prefix || 'EXP-{n}-2026').replace('{n}', pad(n));
    case 'recibido':      return `${prefix || 'RECIBIDO:'} ${formatDate(getDate())}`;
    default:              return `${pageNum}`;
  }
}

// Totales de progreso a partir de los archivos y sus unidades (páginas de PDF; 1 por imagen).
function progressTotals(files, units) {
  const isPdf = f => path.extname(f).toLowerCase() === '.pdf';
  return {
    totalFiles: files.length,
    totalPages: units.reduce((n, u) => n + u.pages, 0),
    unit: files.every(isPdf) ? 'páginas' : files.some(isPdf) ? 'elementos' : 'archivos',
  };
}

// ── Marca de agua de texto ───────────────────────────────────────────────────

ipcMain.handle('watermark-text', async (event, {
  files, text, fontPath, fontSize, fontWeight = 400,
  opacity, angle, position, color,
  repeatMode = 'single', repeatGapH = 200, repeatGapV = 150,
  outputDir
}) => {
  resetCancelled();
  const results = [];

  const gravityMap = {
    center:       'Center',
    top_left:     'NorthWest',
    top_right:    'NorthEast',
    bottom_left:  'SouthWest',
    bottom_right: 'SouthEast',
  };
  const gravity   = gravityMap[position] || 'Center';
  const alphaVal  = Math.round((opacity / 100) * 255);
  const hexAlpha  = alphaVal.toString(16).padStart(2, '0');
  const fillColor = `${color}${hexAlpha}`;
  const safeText  = text.replace(/"/g, '\\"');

  const tempDir = path.join(app.getPath('temp'), `imgpdf_wm_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const units    = await countUnits(findGhostscript(), files);
  const progress = createProgress(event, 'watermark', progressTotals(files, units));
  progress.start();

  async function applyWatermark(inputImg, outputTarget, width, height) {
    const scriptFile = path.join(tempDir, `script_${Math.random().toString(36).slice(2)}.mgk`);
    const lines = [];

    lines.push(`-read`);
    lines.push(`"${inputImg.replace(/\\/g, '/')}"`);

    if (fontPath) {
      lines.push(`-font`);
      lines.push(`"${fontPath.replace(/\\/g, '/').replace(/"/g, '\\"')}"`);
    }
    lines.push(`-pointsize`);
    lines.push(`${fontSize}`);
    lines.push(`-fill`);
    lines.push(`"${fillColor}"`);

    if (repeatMode === 'single') {
      lines.push(`-gravity`);
      lines.push(`${gravity}`);
      lines.push(`-annotate`);
      lines.push(`${angle}x${angle}+0+0`);
      lines.push(`"${safeText}"`);
    } else {
      lines.push(`-gravity`);
      lines.push(`NorthWest`);
      const gapH = Math.max(80, parseInt(repeatGapH) || 200);
      const gapV = Math.max(50, parseInt(repeatGapV) || 150);
      const cols = Math.ceil(width / gapH) + 2;
      const rows = Math.ceil(height / gapV) + 2;

      for (let r = -2; r < rows; r++) {
        for (let c = -2; c < cols; c++) {
          const x = Math.round(c * gapH);
          const y = Math.round(r * gapV);
          const signX = x >= 0 ? `+${x}` : `${x}`;
          const signY = y >= 0 ? `+${y}` : `${y}`;
          lines.push(`-annotate`);
          lines.push(`${angle}x${angle}${signX}${signY}`);
          lines.push(`"${safeText}"`);
        }
      }
    }

    lines.push(`-write`);
    lines.push(`"${outputTarget.replace(/\\/g, '/')}"`);

    fs.writeFileSync(scriptFile, lines.join('\n'), 'utf8');
    await run(`magick -script "${scriptFile.replace(/\\/g, '/')}"`);
    try { fs.unlinkSync(scriptFile); } catch (_) {}
  }

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const ext   = path.extname(file).toLowerCase();
    const name  = path.basename(file, ext);
    const isPdf = ext === '.pdf';
    const info  = { currentFile: fi + 1, currentFileName: path.basename(file) };

    if (!isPdf) {
      let width = 1200, height = 800;
      try {
        const info = await run(`magick identify -format "%wx%h" "${file}"`);
        const m = info.match(/(\d+)x(\d+)/);
        if (m) { width = parseInt(m[1], 10); height = parseInt(m[2], 10); }
      } catch (_) {}

      const out = getUniqueFilePath(path.join(outputDir, `${name}-wm${ext}`));
      try {
        await applyWatermark(file, out, width, height);
        progress.tick({ ...info, currentPage: 1, currentFilePages: 1, currentOut: path.basename(out) });
        results.push({ file, out, ok: true });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
      }
    } else {
      try {
        const totalPages = units[fi]?.pages || 0;
        const pageParts  = [];

        for (let i = 1; i <= totalPages; i++) {
          if (getIsCancelled()) break;
          const tempImg = path.join(tempDir, `pag${String(i).padStart(3, '0')}.png`);
          const tempPdf = path.join(tempDir, `pag${String(i).padStart(3, '0')}.pdf`);

          await run(`magick -density 200 "${file}[${i - 1}]" "${tempImg}"`);

          let width = 1654, height = 2339;
          try {
            const info = await run(`magick identify -format "%wx%h" "${tempImg}"`);
            const m = info.match(/(\d+)x(\d+)/);
            if (m) { width = parseInt(m[1], 10); height = parseInt(m[2], 10); }
          } catch (_) {}

          await applyWatermark(tempImg, tempPdf, width, height);
          pageParts.push(tempPdf);
          progress.tick({ ...info, currentPage: i, currentFilePages: totalPages, currentOut: path.basename(tempPdf) });
        }

        if (!getIsCancelled() && pageParts.length > 0) {
          progress.stage('Ensamblando el PDF final…', info);
          const gs     = findGhostscript();
          const out    = getUniqueFilePath(path.join(outputDir, `${name}-wm.pdf`));
          const inputs = pageParts.map(p => `"${p}"`).join(' ');
          await run(`${gs} -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -dSAFER -sOutputFile="${out}" ${inputs}`);
          results.push({ file, out, ok: true });
        }
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
        if (getIsCancelled()) break;
      }
    }
  }

  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}

  progress.done();
  return results;
});

// ── Foliado y numeración ─────────────────────────────────────────────────────

ipcMain.handle('apply-folio', async (event, {
  files, mode, prefix, suffix, separator, digits, startNum,
  italic, dateFormat, customDate, useToday,
  fontSize, fontWeight, color, position, angle,
  marginX, marginY, fontPath, outputDir
}) => {
  resetCancelled();
  const results = [];
  const gravity = positionToGravity(position);

  const fillColor  = color;
  const fontFlag   = fontPath ? `-font "${fontPath}"` : '';
  const italicFlag = italic ? '-style Italic' : '';

  let globalPageOffset = 0;

  const units    = await countUnits(findGhostscript(), files);
  const progress = createProgress(event, 'folio', progressTotals(files, units));
  progress.start();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const info = { currentFile: fi + 1, currentFileName: path.basename(file) };
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    try {
      const totalPages = units[fi]?.pages || 0;
      const tempDir    = path.join(app.getPath('temp'), `imgpdf_folio_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });
      const pageParts  = [];

      const textDir = path.join(tempDir, 'texts');
      fs.mkdirSync(textDir, { recursive: true });

      for (let i = 1; i <= totalPages; i++) {
        if (getIsCancelled()) break;

        const folioText = buildFolioText({
          mode, prefix, suffix, separator, digits,
          startNum: startNum + globalPageOffset,
          pageNum: i, totalPages,
          dateFormat, customDate, useToday
        });

        const textFile = path.join(textDir, `p${i}.txt`);
        fs.writeFileSync(textFile, folioText, 'utf8');

        const tempImg = path.join(tempDir, `pag${String(i).padStart(3,'0')}.png`);
        const tempPdf = path.join(tempDir, `pag${String(i).padStart(3,'0')}.pdf`);

        await run(`magick -density 200 "${file}[${i-1}]" "${tempImg}"`);
        await run(
          `magick "${tempImg}" ` +
          `${fontFlag} ${italicFlag} ` +
          `-pointsize ${fontSize} -fill "${fillColor}" ` +
          `-gravity ${gravity} ` +
          `-annotate ${angle}x${angle}+${marginX}+${marginY} "@${textFile}" ` +
          `"${tempPdf}"`
        );
        pageParts.push(tempPdf);
        progress.tick({ ...info, currentPage: i, currentFilePages: totalPages, currentOut: path.basename(tempPdf) });
      }

      globalPageOffset += totalPages;

      if (!getIsCancelled() && pageParts.length > 0) {
        progress.stage('Ensamblando el PDF final…', info);
        const gs     = findGhostscript();
        const name   = path.basename(file, '.pdf');
        const out    = getUniqueFilePath(path.join(outputDir, `${name}-foliado.pdf`));
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
  progress.done();
  return results;
});

// ── Marca de agua de imagen ──────────────────────────────────────────────────

ipcMain.handle('watermark-image', async (event, {
  files, markFile, sizePercent, opacity, position,
  angle, repeatMode, repeatGapH, repeatGapV, marginX, marginY,
  outputDir
}) => {
  resetCancelled();
  const results = [];
  const gravity = positionToGravity(position);

  async function getImageSize(imgPath) {
    try {
      const out = await run(`magick identify -format "%wx%h" "${imgPath}"`);
      const m   = out.match(/(\d+)x(\d+)/);
      if (m) return { w: parseInt(m[1]), h: parseInt(m[2]) };
    } catch (_) {}
    return { w: 1654, h: 2339 };
  }

  async function applyMark(inputPath, outputPath, docW, docH) {
    const markW = Math.round((sizePercent / 100) * docW);

    const tempMark = inputPath + '_mark_resized.png';
    await run(`magick "${markFile}" -resize ${markW}x -alpha set -channel Alpha -evaluate multiply ${(opacity/100).toFixed(2)} "${tempMark}"`);

    if (repeatMode === 'single') {
      await run(
        `magick "${inputPath}" "${tempMark}" ` +
        `-gravity ${gravity} -geometry +${marginX}+${marginY} ` +
        `${angle !== 0 ? `-rotate ${angle}` : ''} ` +
        `-composite "${outputPath}"`
      );
    } else {
      const tilePath    = inputPath + '_tile.png';
      const patternPath = inputPath + '_pattern.png';

      await run(`magick -size ${repeatGapH}x${repeatGapV} xc:none "${tempMark}" -gravity Center -composite "${tilePath}"`);

      await run(`magick -size ${docW}x${docH} "tile:${tilePath}" "${patternPath}"`);

      if (angle !== 0) {
        const rotPath = inputPath + '_pattern_rot.png';
        await run(`magick "${patternPath}" -background none -rotate ${angle} -gravity center -extent ${docW}x${docH} "${rotPath}"`);
        await run(`magick "${inputPath}" "${rotPath}" -composite "${outputPath}"`);
        try { fs.unlinkSync(rotPath); } catch (_) {}
      } else {
        await run(`magick "${inputPath}" "${patternPath}" -composite "${outputPath}"`);
      }

      try { fs.unlinkSync(tilePath); } catch (_) {}
      try { fs.unlinkSync(patternPath); } catch (_) {}
    }

    try { fs.unlinkSync(tempMark); } catch (_) {}
  }

  const units    = await countUnits(findGhostscript(), files);
  const progress = createProgress(event, 'watermark-image', progressTotals(files, units));
  progress.start();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    if (getIsCancelled()) { results.push({ file, ok: false, error: 'Cancelado' }); break; }

    const ext   = path.extname(file).toLowerCase();
    const name  = path.basename(file, ext);
    const isPdf = ext === '.pdf';
    const info  = { currentFile: fi + 1, currentFileName: path.basename(file) };

    if (!isPdf) {
      const out  = getUniqueFilePath(path.join(outputDir, `${name}-wmi${ext}`));
      const dims = await getImageSize(file);
      try {
        await applyMark(file, out, dims.w, dims.h);
        progress.tick({ ...info, currentPage: 1, currentFilePages: 1, currentOut: path.basename(out) });
        results.push({ file, out, ok: true });
      } catch (e) {
        results.push({ file, ok: false, error: String(e) });
      }
    } else {
      try {
        const totalPages = units[fi]?.pages || 0;
        const tempDir    = path.join(app.getPath('temp'), `imgpdf_wmi_${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        const pageParts  = [];

        for (let i = 1; i <= totalPages; i++) {
          if (getIsCancelled()) break;
          const tempImg  = path.join(tempDir, `pag${String(i).padStart(3,'0')}.png`);
          const tempWm   = path.join(tempDir, `pag${String(i).padStart(3,'0')}_wm.png`);
          const tempPdf  = path.join(tempDir, `pag${String(i).padStart(3,'0')}.pdf`);

          await run(`magick -density 200 "${file}[${i-1}]" "${tempImg}"`);
          const dims = await getImageSize(tempImg);
          await applyMark(tempImg, tempWm, dims.w, dims.h);
          await run(`magick "${tempWm}" "${tempPdf}"`);
          pageParts.push(tempPdf);
          progress.tick({ ...info, currentPage: i, currentFilePages: totalPages, currentOut: path.basename(tempPdf) });
        }

        if (!getIsCancelled() && pageParts.length > 0) {
          progress.stage('Ensamblando el PDF final…', info);
          const gs     = findGhostscript();
          const out    = getUniqueFilePath(path.join(outputDir, `${name}-wmi.pdf`));
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
  progress.done();
  return results;
});
