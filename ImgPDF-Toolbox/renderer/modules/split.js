// ── modules/split.js ──────────────────────────────────────────────────────────
function renderSplit() {
  let file = null, totalPages = 0;
  let mode = 'individual', blockSize = 5, customRanges = '';
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">✂️ Separar PDF</div>

    <div class="file-zone" id="zone-spl">
      <div class="btn-row">
        <button class="btn-secondary" id="pick-split">📂 Seleccionar PDF</button>
        <button class="btn-secondary" id="clear-split" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="split-file">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>

    <!-- Wizard: aparece solo después de cargar un archivo válido -->
    <div id="split-wizard" style="display:none;flex-direction:column;gap:1.25rem">
      <div class="option-group">
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
      <div id="split-result"></div>
    </div>
  </div>`;

  // ── Reset completo ──────────────────────────────────────────────────────────
  function reset() {
    file = null; totalPages = 0;
    document.getElementById('split-file').innerHTML    = '<span class="file-empty">Ningún archivo seleccionado</span>';
    document.getElementById('split-wizard').style.display = 'none';
    document.getElementById('clear-split').style.display  = 'none';
    document.getElementById('split-result').innerHTML      = '';
    document.getElementById('split-summary').innerHTML     = '';
  }

  // ── Cargar y analizar PDF ───────────────────────────────────────────────────
  async function loadFile(path) {
    file = path;
    await checkDefaultOutputDir(file, 'spl-path');
    document.getElementById('clear-split').style.display = 'inline-block';

    document.getElementById('split-file').innerHTML = `
      <div class="file-item">
        <span class="file-name">📄 ${basename(file)}</span>
        <span style="font-size:0.75rem;color:var(--warning)" id="calc-pages">⏳ Analizando páginas...</span>
        <button class="file-remove" id="rm-split">✕</button>
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

    // Mostrar wizard y bindear modo-row ahora que el DOM existe
    const wizard = document.getElementById('split-wizard');
    wizard.style.cssText = 'display:flex; flex-direction:column; gap:1.25rem';

    optButtons(document.getElementById('mode-row'), [
      { label: 'Página por página', value: 'individual' },
      { label: 'Bloques fijos',     value: 'block'      },
      { label: 'Rangos múltiples',  value: 'custom'     },
    ], mode, v => { mode = v; renderOpts(); updateSummary(); });

    // Bindear carpeta de salida dentro del wizard
    document.getElementById('spl-pick').addEventListener('click', () =>
      pickOutputDir('spl-path').then(updateSummary)
    );

    renderOpts();
    updateSummary();
  }

  // ── Opciones según modo ─────────────────────────────────────────────────────
  function renderOpts() {
    const el = document.getElementById('mode-opts');
    if (mode === 'individual') {
      el.innerHTML = `<p style="font-size:0.78rem;color:var(--muted)">Cada página del PDF se guardará como un archivo independiente.</p>`;
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
        <span style="font-size:0.8rem;color:var(--muted)">Separa rangos con comas. Ej: 1-15, 16-30, 31</span>
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

    if (mode === 'individual') {
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
        // Validación de formato antes de ejecutar — nuestra corrección
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
    const picked = await window.api.selectFiles([{ name: 'PDF', extensions: ['pdf'] }]);
    if (picked.length) loadFile(picked[0]);
  });

  document.getElementById('clear-split').addEventListener('click', reset);

  bindDragDrop('zone-spl', ['pdf'], dropped => { if (dropped.length) loadFile(dropped[0]); });

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
    document.getElementById('split-result').innerHTML = progressBar(30);

    const res = await window.api.splitPdf({
      file, mode, blockSize, customRanges,
      outputDir: state.outputDir, totalPages
    });
    window.api.playBeep();

    if (!res.ok) {
      document.getElementById('split-result').innerHTML = resultBox('error', '✗ Error de validación', [res.error]);
      notify.error(res.error);
    } else {
      const ok  = res.results.filter(r => r.ok);
      const err = res.results.filter(r => !r.ok);
      document.getElementById('split-result').innerHTML =
        (ok.length  ? resultBox('success',
          `✓ ${ok.length} archivo(s) generado(s)${res.wasCancelled ? ' — operación cancelada antes de terminar' : ''}`,
          ok.map(r => `📄 ${basename(r.out)}`), true) : '') +
        (err.length ? resultBox('error', `✗ ${err.length} error(es)`, err.map(r => String(r.error))) : '');

      if (ok.length)  notify.success(`${ok.length} partes extraídas correctamente.`);
      if (err.length) notify.error(`${err.length} partes fallaron.`);
    }

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Ejecutar separación';
    cancel.style.display = 'none';
    updateSummary();
  });
}