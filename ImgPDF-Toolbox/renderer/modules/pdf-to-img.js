// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/pdf-to-img.js
// Descripción: Módulo «PDF → Imágenes»: exporta las páginas de uno o varios PDFs como
//              PNG/JPG con densidad y color de fondo configurables, lista ordenable y
//              barra de progreso real.
// ═════════════════════════════════════════════════════════════════════════════

async function renderPdfToImg() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('pdf-to-img', { density: 300, format: 'png', background: '#FFFFFF' });
  let files = [], density = cfg.density, format = cfg.format, background = cfg.background;
  let currentRunId = 0;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('pdf-file',22)} PDF → Imágenes</div>
    <div class="option-group"><label>Formato de salida</label><div class="option-row" id="fmt-row"></div></div>
    <div class="option-group"><label>Calidad (DPI)</label><div class="option-row" id="dpi-row"></div></div>
    <div class="option-group"><label>Fondo</label><div class="option-row" id="bg-row"></div></div>
    <div class="file-zone" id="zone-p2i">
      <div class="file-zone-header">
        <span class="file-count-badge" id="p2i-badge">0 PDFs cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-pdfs2">${icon('folder-open',16)} Seleccionar PDFs</button>
        <button class="btn-secondary" id="clear-p2i" style="display:none">${icon('trash',16)} Limpiar</button>
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
    <div class="progress-panel" id="p2i-progress"></div>
    <div id="p2i-result"></div>
  </div>`;

  // ── Opciones de configuración ────────────────────────────────────────────────
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
          { label: 'Blanco (#FFFFFF)',          value: '#FFFFFF'  },
          { label: 'Original (transparente)', value: 'original' },
          { label: 'Oscuro (#202020)',          value: '#202020'  },
        ]
      : [
          { label: 'Blanco (#FFFFFF)', value: '#FFFFFF' },
          { label: 'Oscuro (#202020)', value: '#202020' },
        ];
    const validBg = opts.find(o => o.value === background) ? background : opts[0].value;
    background = validBg;
    optButtons(document.getElementById('bg-row'), opts, validBg, v => { background = v; },
      v => saveModuleConfig('pdf-to-img', { background: v }));
  }
  updateBg();

  // ── Lista ordenada ────────────────────────────────────────────────────────
  const renderList = () => {
    renderOrderedFileList('pdf2-list', files, onChange, { showDrag: true, showArrows: true });
  };

  const onChange = newFiles => {
    files = newFiles;
    renderList();
    updateRun();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'p2i-path');
    files = insertAt(files, picked, index);
    renderList();
    updateRun();
  };

  // ── Selección de archivos y carpeta de salida ────────────────────────────────
  document.getElementById('pick-pdfs2').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'PDF', extensions: ['pdf'] }]);
    addFiles(picked);
  });

  // ── Limpiar: borra archivos, progreso y resultado ─────────────────────────
  document.getElementById('clear-p2i').addEventListener('click', () => {
    files = [];
    renderList();
    document.getElementById('p2i-result').innerHTML = '';

    createProgressPanel('p2i-progress').hide();
    updateRun();
  });

  document.getElementById('p2i-pick').addEventListener('click', () => pickOutputDir('p2i-path').then(updateRun));
  bindDragDrop('zone-p2i', ['pdf'], addFiles);

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    document.getElementById('run-p2i').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-p2i').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('p2i-badge').textContent   = `${files.length} documento(s) seleccionado(s)`;
  }

  // ── Cancelar (con guard para evitar doble clic) ───────────────────────────
  document.getElementById('cancel-p2i').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Cancelando...';
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  // ── Ejecutar ──────────────────────────────────────────────────────────────
  document.getElementById('run-p2i').addEventListener('click', async () => {
    const runId = ++currentRunId;

    setProcessing(true);
    const btn = document.getElementById('run-p2i');
    const cancel = document.getElementById('cancel-p2i');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    cancel.disabled = false;
    cancel.textContent = 'Cancelar';
    document.getElementById('p2i-result').innerHTML = '';

    let res = [];
    try {
      res = await runWithProgress('pdf-to-img', 'p2i-progress',
        () => window.api.convertPdfToImg({ files, density, format, background, outputDir: state.outputDir }));
    } catch (e) {
      res = [{ file: '*', ok: false, error: String(e) }];
    }
    window.api.playBeep();

    if (runId !== currentRunId) return;

    const ok  = res.filter(r => r.ok);
    const err = res.filter(r => !r.ok);
    document.getElementById('p2i-result').innerHTML =
      (ok.length  ? resultBox('success', `${ok.length} PDF(s) procesado(s)`, ok.map(r => `${icon('file',14)} ${basename(r.file)} — ${r.pages} páginas`), true) : '') +
      (err.length ? resultBox('error',   `${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${ok.length} PDF(s) extraído(s) correctamente.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Extraer imágenes';
    cancel.style.display = 'none';
    cancel.disabled = false;
    cancel.textContent = 'Cancelar';
    updateRun();
  });

  // ── Limpieza al salir del módulo ─────────────────
  const observer = new MutationObserver(() => {
    if (!document.getElementById('zone-p2i')) {
      currentRunId++;
      observer.disconnect();
    }
  });
  observer.observe(ws, { childList: true });
}