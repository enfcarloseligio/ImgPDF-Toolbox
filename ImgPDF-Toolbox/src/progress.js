// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/progress.js
// Descripción: Progreso real de las operaciones: conteo de páginas con Ghostscript,
//              seguimiento global (archivos y páginas procesadas) y emisión de eventos
//              'progress' al renderer. Lo comparten todas las herramientas.
// ═════════════════════════════════════════════════════════════════════════════

const path = require('path');
const { spawn } = require('child_process');
const {
  run,
  runSpawn,
  registerProcess,
  clearProcess,
  getIsCancelled,
} = require('./process-runner');

// ── Conteo de páginas ────────────────────────────────────────────────────────

// Cuenta las páginas de un PDF con Ghostscript. Acepta contraseña para PDFs cifrados.
function countPdfPages(gsPath, pdfPath, password = '') {
  return new Promise((resolve, reject) => {
    const cleanGs  = gsPath.replace(/^"|"$/g, '');
    const safePath = pdfPath.replace(/\\/g, '/');
    const args = [
      '-q', '-dNODISPLAY', '-dNOSAFER',
      ...(password ? [`-sPDFPassword=${password}`] : []),
      '-c', `(${safePath}) (r) file runpdfbegin pdfpagecount = quit`
    ];
    const proc = spawn(cleanGs, args, { windowsHide: true });

    // Se registra como proceso actual para que la cancelación pueda terminarlo
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

// Devuelve [{ file, pages, error? }]: los PDF cuentan sus páginas; cualquier otro
// archivo (imagen) cuenta como una unidad. Si un PDF no se puede leer, pages = 0.
async function countUnits(gsPath, files, { password = '' } = {}) {
  const units = [];
  for (const file of files) {
    if (getIsCancelled()) break;
    if (path.extname(file).toLowerCase() !== '.pdf') {
      units.push({ file, pages: 1 });
      continue;
    }
    try {
      units.push({ file, pages: await countPdfPages(gsPath, file, password) });
    } catch (e) {
      units.push({ file, pages: 0, error: String(e.message || e) });
    }
  }
  return units;
}

// ── Seguimiento y emisión de progreso ────────────────────────────────────────

// Crea el seguimiento global de una operación. Cada evento enviado al renderer tiene
// la forma { module, unit, phase, totalFiles, totalPages, globalPage, ... } donde
// phase es 'start' | 'processing' | 'done'.
function createProgress(event, moduleId, { totalFiles, totalPages, unit = 'páginas' }) {
  let globalPage = 0;

  const send = payload => {
    try {
      event.sender.send('progress', { module: moduleId, unit, totalFiles, totalPages, ...payload });
    } catch (_) { /* la ventana pudo cerrarse durante la operación */ }
  };

  return {
    start() {
      send({ phase: 'start', currentFile: 0, currentPage: 0, globalPage: 0 });
    },
    // Registra una unidad completada. info: { currentFile, currentFileName, currentPage,
    // currentFilePages, currentOut }
    tick(info = {}) {
      globalPage++;
      send({ phase: 'processing', globalPage, ...info });
    },
    // Informa de una etapa sin avanzar el contador (p. ej. ensamblado final del PDF)
    stage(label, info = {}) {
      send({ phase: 'processing', globalPage, stage: label, ...info });
    },
    done() {
      send({ phase: 'done', globalPage });
    },
  };
}

// ── Ghostscript con avance por página ────────────────────────────────────────

// Ejecuta Ghostscript y llama a onPage(página, índiceDeArchivo) por cada línea
// "Page N" de su salida. El índice (base 1) avanza con cada "Processing pages…",
// lo que permite seguir varios documentos de entrada en una sola llamada.
// Si falla, el error incluye las últimas líneas de salida para poder diagnosticarlo.
async function runGsWithProgress(gsPath, args, { onPage } = {}) {
  let fileIndex = 0;
  const lastLines = [];

  try {
    await runSpawn(gsPath, args, {
      maxStdout: 0,
      onStdout: line => {
        if (/^Processing pages/.test(line)) { fileIndex++; return; }
        const m = line.match(/^Page (\d+)$/);
        if (m) { if (onPage) onPage(Number(m[1]), Math.max(fileIndex, 1)); return; }
        lastLines.push(line);
        if (lastLines.length > 8) lastLines.shift();
      },
    });
  } catch (e) {
    throw new Error([String(e.message || e), ...lastLines].join('\n'));
  }
}

module.exports = {
  run,
  countPdfPages,
  countUnits,
  createProgress,
  runGsWithProgress,
};
