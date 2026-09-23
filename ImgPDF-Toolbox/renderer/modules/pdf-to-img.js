// ── modules/pdf-to-img.js — versión con progreso real ────────────────────────
async function renderPdfToImg() {
  const cfg = await loadModuleConfig('pdf-to-img', { density: 300, format: 'png', background: 'original' });
  let files = [], density = cfg.density, format = cfg.format, background = cfg.background;
  let unsubProgress = null;

  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">📄 PDF → Imágenes</div>
    <div class="option-group"><label>Formato de salida</label><div class="option-row" id="fmt-row"></div></div>
    <div class="option-group"><label>Calidad (DPI)</label><div class="option-row" id="dpi-row"></div></div>
    <div class="option-group"><label>Fondo</label><div class="option-row" id="bg-row"></div></div>
    <div class="file-zone" id="zone-p2i">
      <div class="file-zone-header">
        <span class="file-count-badge" id="p2i-badge">0 PDFs cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-pdfs2">📂 Seleccionar PDFs</button>
        <button class="btn-secondary" id="clear-p2i" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="pdf2-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>
    ${outputDirRow('p2i')}
    <div class="btn-row">
      <button class="btn-primary" id="run-p2i" disabled style="width:auto">Extraer imágenes</button>
      <button class="btn-danger"  id="cancel-p2i" style="display:none;width:auto">Cancelar</button>
    </div>
    <div id="p2i-progress" style="display:none;flex-direction:column;gap:0.4rem"></div>
    <div id="p2i-result"></div>
  </div>`;

  optButtons(document.getElementById('fmt-row'), [
    { label: 'PNG', value: 'png' },
    { label: 'JPG', value: 'jpg' },
  ], format, v => { format = v; updateBg(); },
  v => saveModuleConfig('pdf-to-img', { format: v }));

  optButtons(document.getElementById('dpi-row'), [
    { label: '300 DPI — Máxima', value: 300 },
    { label: '200 DPI — Alta',   value: 200 },
    { label: '150 DPI — Media',  value: 150 },
    { label: '72 DPI — Baja',    value: 72  },
  ], density, v => { density = v; },
  v => saveModuleConfig('pdf-to-img', { density: v }));

  function updateBg() {
    const opts = format === 'png'
      ? [
          { label: 'Original (transparente)', value: 'original' },
          { label: 'Blanco #FFFFFF',          value: '#FFFFFF'  },
          { label: 'Oscuro #202020',          value: '#202020'  },
        ]
      : [
          { label: 'Blanco #FFFFFF', value: '#FFFFFF' },
          { label: 'Oscuro #202020', value: '#202020' },
        ];
    const validBg = opts.find(o => o.value === background) ? background : opts[0].value;
    background = validBg;
    optButtons(document.getElementById('bg-row'), opts, validBg, v => { background = v; },
      v => saveModuleConfig('pdf-to-img', { background: v }));
  }
  updateBg();

  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('pdf2-list', files, onRemove);
    updateRun();
  };

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'p2i-path');
    const dups = picked.filter(f => files.includes(f));
    files = [...files, ...picked.filter(f => !files.includes(f))];
    renderFileList('pdf2-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-pdfs2').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'PDF', extensions: ['pdf'] }]);
    addFiles(picked);
  });

  document.getElementById('clear-p2i').addEventListener('click', () => {
    files = [];
    renderFileList('pdf2-list', files, onRemove);
    document.getElementById('p2i-result').innerHTML = '';
    document.getElementById('p2i-progress').style.display = 'none';
    updateRun();
  });

  document.getElementById('p2i-pick').addEventListener('click', () => pickOutputDir('p2i-path').then(updateRun));
  bindDragDrop('zone-p2i', ['pdf'], addFiles);

  function updateRun() {
    document.getElementById('run-p2i').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-p2i').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('p2i-badge').textContent   = `${files.length} documento(s) seleccionado(s)`;
  }

  // ── UI de progreso ────────────────────────────────────────────────────────
  function showProgress(data) {
    const el = document.getElementById('p2i-progress');
    if (!el) return;
    el.style.display = 'flex';

    if (data.phase === 'start') {
      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text)">
          <span id="p2i-progress-label">Preparando…</span>
          <span id="p2i-progress-count">0 / ${data.totalPages} páginas</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" id="p2i-progress-fill" style="width:0%"></div></div>
        <div style="font-size:0.72rem;color:var(--muted)" id="p2i-progress-detail"></div>`;
      return;
    }

    if (data.phase === 'processing') {
      const pct = data.totalPages > 0
        ? Math.round((data.globalPage / data.totalPages) * 100)
        : 0;

      const label  = document.getElementById('p2i-progress-label');
      const count  = document.getElementById('p2i-progress-count');
      const fill   = document.getElementById('p2i-progress-fill');
      const detail = document.getElementById('p2i-progress-detail');

      if (label) label.textContent = `Procesando ${data.currentFileName} (${data.currentFile}/${data.totalFiles})`;
      if (count) count.textContent = `${data.globalPage} / ${data.totalPages} páginas`;
      if (fill)  fill.style.width  = `${pct}%`;
      if (detail) detail.textContent = `→ ${data.currentOut}  ·  página ${data.currentPage} de ${data.currentFilePages}`;
      return;
    }

    if (data.phase === 'done') {
      const fill  = document.getElementById('p2i-progress-fill');
      const label = document.getElementById('p2i-progress-label');
      const count = document.getElementById('p2i-progress-count');
      if (fill)  fill.style.width = '100%';
      if (label) label.textContent = 'Completado';
      if (count) count.textContent = `${data.globalPage} / ${data.totalPages} páginas`;
      setTimeout(() => {
        const el = document.getElementById('p2i-progress');
        if (el) el.style.display = 'none';
      }, 2000);
    }
  }

  document.getElementById('cancel-p2i').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  document.getElementById('run-p2i').addEventListener('click', async () => {
    setProcessing(true);
    const btn = document.getElementById('run-p2i'), cancel = document.getElementById('cancel-p2i');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('p2i-result').innerHTML = '';

    // Suscribirse a eventos de progreso
    unsubProgress = window.api.onProgress(data => {
      if (data.module === 'pdf-to-img') showProgress(data);
    });

    const res = await window.api.convertPdfToImg({ files, density, format, background, outputDir: state.outputDir });
    window.api.playBeep();

    // Desuscribirse
    if (unsubProgress) { unsubProgress(); unsubProgress = null; }

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('p2i-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} PDF(s) procesado(s)`, ok.map(r => `📄 ${basename(r.file)} — ${r.pages} páginas`), true) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${ok.length} PDF(s) extraído(s) correctamente.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Extraer imágenes';
    cancel.style.display = 'none';
    updateRun();
  });
}