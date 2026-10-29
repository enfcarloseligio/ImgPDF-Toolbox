// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/img-to-pdf.js
// Descripción: Módulo «Imágenes → PDF»: convierte imágenes PNG/JPG en documentos PDF con
//              calidad configurable.
// ═════════════════════════════════════════════════════════════════════════════

async function renderImgToPdf() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('img-to-pdf', { quality: 100 });
  let files = [], quality = cfg.quality;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('image-file',22)} Imágenes → PDF</div>
    <div class="option-group">
      <label>Calidad</label>
      <div class="option-row" id="q-row"></div>
      <p class="option-hint">Original conserva los píxeles exactos de la imagen sin recomprimir (el PDF puede pesar más). Las demás aplican compresión JPEG proporcional.</p>
    </div>
    <div class="file-zone" id="zone-i2p">
      <div class="file-zone-header">
        <span class="file-count-badge" id="i2p-badge">0 imágenes cargadas</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-imgs">${icon('folder-open',16)} Seleccionar imágenes</button>
        <button class="btn-secondary" id="clear-i2p" style="display:none">${icon('trash',16)} Limpiar</button>
        <span style="font-size:0.75rem;color:var(--text-muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="img-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>
    ${outputDirRow('i2p')}
    <div class="btn-row">
      <button class="btn-primary" id="run-i2p" disabled style="width:auto">Convertir a PDF</button>
      <button class="btn-danger"  id="cancel-i2p" style="display:none;width:auto">Cancelar</button>
    </div>
    <div class="progress-panel" id="i2p-progress"></div>
    <div id="i2p-result"></div>
  </div>`;
  organizeModule(ws);

  // ── Opciones de configuración ────────────────────────────────────────────────
  optButtons(document.getElementById('q-row'), [
    { label: '100% — Original (sin pérdida)', value: 100 },
    { label: '75% — Alta',    value: 75  },
    { label: '50% — Media',   value: 50  },
    { label: '25% — Baja',    value: 25  },
  ], quality, v => { quality = v; },
  v => saveModuleConfig('img-to-pdf', { quality: v }));

  // ── Lista de archivos ────────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('img-list', files, onRemove);
    updateRun();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'i2p-path');
    const dups = picked.filter(f =>  files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderFileList('img-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  // ── Selección de archivos y carpeta de salida ────────────────────────────────
  document.getElementById('pick-imgs').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'Imágenes', extensions: ['png','jpg','jpeg'] }]);
    addFiles(picked);
  });

  document.getElementById('clear-i2p').addEventListener('click', () => {
    files = [];
    renderFileList('img-list', files, onRemove);
    document.getElementById('i2p-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('i2p-pick').addEventListener('click', () => pickOutputDir('i2p-path').then(updateRun));
  bindDragDrop('zone-i2p', ['png','jpg','jpeg'], addFiles);

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    document.getElementById('run-i2p').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-i2p').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('i2p-badge').textContent   = `${files.length} imagen(es) seleccionada(s)`;
  }

  // ── Cancelación y ejecución ──────────────────────────────────────────────────
  document.getElementById('cancel-i2p').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  document.getElementById('run-i2p').addEventListener('click', async () => {
    setProcessing(true);
    const btn = document.getElementById('run-i2p'), cancel = document.getElementById('cancel-i2p');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('i2p-result').innerHTML = '';

    const res = await runWithProgress('img-to-pdf', 'i2p-progress', () => window.api.convertImgToPdf({ files, quality, outputDir: state.outputDir }));
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('i2p-result').innerHTML =
      (ok.length  ? resultBox('success', `${ok.length} archivo(s) convertido(s)`, ok.map(r => `${icon('file',14)} ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `${err.length} error(es)`, err.map(r => basename(r.file))) : '');

    if (ok.length)  notify.success(`${ok.length} imagen(es) convertida(s) a PDF.`);
    if (err.length) notify.error(`${err.length} archivo(s) no pudieron convertirse.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Convertir a PDF';
    cancel.style.display = 'none';
    updateRun();
  });
}
