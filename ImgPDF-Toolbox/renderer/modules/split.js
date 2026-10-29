// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/split.js
// Descripción: Módulo «Separar PDF»: extrae páginas individuales, bloques de páginas o
//              rangos personalizados de un documento.
// ═════════════════════════════════════════════════════════════════════════════

function renderSplit() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  let file = null, totalPages = 0;
  let mode = 'individual', blockSize = 5, customRanges = '';

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('scissors',22)} Separar PDF</div>

    ${fileZoneHtml({ zone: 'zone-spl', pick: 'pick-split', clear: 'clear-split', list: 'split-file', kind: 'pdf', multiple: false })}

    <!-- Configuración, salida y acciones: visibles desde el inicio, como en el resto de herramientas -->
    <div class="option-group wide">
      <label>Modo de separación</label>
      <div class="option-row" id="mode-row"></div>
    </div>
    <div id="mode-opts"></div>
    <div class="summary-box" id="split-summary"></div>
    ${outputDirRow('spl')}
    <div class="btn-row">
      <button class="btn-primary" id="run-split"    disabled style="width:auto">Ejecutar separación</button>
      <button class="btn-danger"  id="cancel-split" style="display:none;width:auto">Cancelar</button>
    </div>
    <div class="progress-panel" id="split-progress"></div>
    <div id="split-result"></div>
  </div>`;
  organizeModule(ws);

  // ── Selección de la carpeta de salida ────────────────────────────────────────
  document.getElementById('spl-pick').addEventListener('click', () =>
    pickOutputDir('spl-path').then(updateSummary)
  );

  // ── Modo de separación ───────────────────────────────────────────────────────
  optButtons(document.getElementById('mode-row'), [
    { label: 'Página por página', value: 'individual' },
    { label: 'Bloques fijos',     value: 'block'      },
    { label: 'Rangos múltiples',  value: 'custom'     },
  ], mode, v => { mode = v; renderOpts(); updateSummary(); });

  renderOpts();
  updateSummary();

  // ── Reset completo ──────────────────────────────────────────────────────────
  function reset() {
    file = null; totalPages = 0;
    document.getElementById('split-file').innerHTML    = fileEmptyHtml('pdf');
    document.getElementById('clear-split').style.display  = 'none';
    document.getElementById('split-result').innerHTML      = '';
    updateSummary();
  }

  // ── Cargar y analizar PDF ───────────────────────────────────────────────────
  async function loadFile(path) {
    file = path;
    await checkDefaultOutputDir(file, 'spl-path');
    document.getElementById('clear-split').style.display = 'inline-block';

    document.getElementById('split-file').innerHTML = `
      <div class="file-item">
        <span class="file-name">${icon('file',14)} ${basename(file)}</span>
        <span style="font-size:0.75rem;color:var(--warning)" id="calc-pages">${iconLabel('loader', 'Analizando páginas...', 14)}</span>
        <button class="file-remove" id="rm-split">${icon('close',14)}</button>
      </div>`;
    document.getElementById('rm-split').addEventListener('click', reset);

    const info    = await window.api.getPdfInfo(file);
    const countEl = document.getElementById('calc-pages');

    if (!info.ok || info.pages === 0) {
      countEl.textContent = '✗ Error al leer PDF';
      countEl.style.color = 'var(--error)';
      notify.error('No se pudo leer la información del PDF. Verifica que no esté protegido.');
      return;
    }

    totalPages   = info.pages;
    customRanges = `1-${totalPages}`;
    countEl.textContent = `✓ ${totalPages} páginas detectadas`;
    countEl.style.color = 'var(--success)';
    notify.info(`PDF cargado: ${totalPages} páginas detectadas.`);

    renderOpts();
    updateSummary();
  }

  // ── Opciones según modo ─────────────────────────────────────────────────────
  function renderOpts() {
    const el = document.getElementById('mode-opts');
    if (mode === 'individual') {
      el.innerHTML = `<p style="font-size:0.78rem;color:var(--text-muted)">Cada página del PDF se guardará como un archivo independiente.</p>`;
    } else if (mode === 'block') {
      el.innerHTML = `<div class="range-row">
        <span>Dividir en bloques de</span>
        <input type="number" class="num-input" id="bsize" value="${blockSize}" min="1">
        <span>páginas por bloque.</span>
      </div>`;
      document.getElementById('bsize').addEventListener('input', e => {
        blockSize = parseInt(e.target.value, 10) || 1;
        updateSummary();
      });
    } else {
      el.innerHTML = `<div class="range-row" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <span style="font-size:0.8rem;color:var(--text-muted)">Separa rangos con comas. Ej: 1-15, 16-30, 31</span>
        <input type="text" class="num-input" style="width:100%;text-align:left" id="cranges"
          value="${customRanges}" placeholder="Ej: 1-15, 16-30, 31">
      </div>`;
      document.getElementById('cranges').addEventListener('input', e => {
        customRanges = e.target.value;
        updateSummary();
      });
    }
  }

  // ── Resumen y validación visual ─────────────────────────────────────────────
  function updateSummary() {
    const el = document.getElementById('split-summary');
    if (!el) return;
    let html  = `<strong>Resumen de la operación:</strong><br>`;
    let valid = true;

    if (!file) {
      html += `↳ Selecciona un PDF para calcular el resultado.`;
    } else if (mode === 'individual') {
      html += `↳ Se generarán <strong>${totalPages} documentos nuevos</strong> (1 página cada uno).`;
    } else if (mode === 'block') {
      const n = Math.ceil(totalPages / (blockSize || 1));
      html += `↳ Se generarán <strong>${n} documentos</strong> (máximo ${blockSize} páginas cada uno).`;
    } else {
      const parts = customRanges.split(',').map(s => s.trim()).filter(s => s);
      if (!parts.length) {
        html += `<span style="color:var(--error)">⚠ Ingresa al menos un rango válido.</span>`;
        valid = false;
      } else {
        // Valida el formato de los rangos antes de ejecutar
        const bad = parts.filter(p => !/^\d+(-\d+)?$/.test(p));
        if (bad.length) {
          html += `<span style="color:var(--error)">⚠ Formato inválido: ${bad.join(', ')}. Usa números como 5 o rangos como 1-10.</span>`;
          valid = false;
        } else {
          html += `↳ Se extraerán <strong>${parts.length} documentos</strong> según los rangos definidos.`;
        }
      }
    }

    el.innerHTML = html;
    const runBtn = document.getElementById('run-split');
    if (runBtn) runBtn.disabled = !(file && state.outputDir && valid && !state.isProcessing);
  }

  // ── Eventos de selección y drag-drop ───────────────────────────────────────
  document.getElementById('pick-split').addEventListener('click', async () => {
    const picked = await pickFiles('pdf');
    if (picked.length) loadFile(picked[0]);
  });

  document.getElementById('clear-split').addEventListener('click', reset);

  bindDragDrop('zone-spl', FILE_KINDS.pdf.extensions, dropped => { if (dropped.length) loadFile(dropped[0]); });

  // ── Cancelar y ejecutar ─────────────────────────────────────────────────────
  document.getElementById('cancel-split').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando división...');
  });

  document.getElementById('run-split').addEventListener('click', async () => {
    setProcessing(true);
    const btn    = document.getElementById('run-split');
    const cancel = document.getElementById('cancel-split');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('split-result').innerHTML = '';

    const res = await runWithProgress('split', 'split-progress', () => window.api.splitPdf({
      file, mode, blockSize, customRanges,
      outputDir: state.outputDir, totalPages
    }));
    window.api.playBeep();

    if (!res.ok) {
      document.getElementById('split-result').innerHTML = resultBox('error', 'Error de validación', [res.error]);
      notify.error(res.error);
    } else {
      const ok  = res.results.filter(r => r.ok);
      const err = res.results.filter(r => !r.ok);
      document.getElementById('split-result').innerHTML =
        (ok.length  ? resultBox('success',
          `${ok.length} archivo(s) generado(s)${res.wasCancelled ? ' — operación cancelada antes de terminar' : ''}`,
          ok.map(r => `${icon('file',14)} ${basename(r.out)}`), true) : '') +
        (err.length ? resultBox('error', `${err.length} error(es)`, err.map(r => String(r.error))) : '');

      if (ok.length)  notify.success(`${ok.length} partes extraídas correctamente.`);
      if (err.length) notify.error(`${err.length} partes fallaron.`);
    }

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Ejecutar separación';
    cancel.style.display = 'none';
    updateSummary();
  });
}