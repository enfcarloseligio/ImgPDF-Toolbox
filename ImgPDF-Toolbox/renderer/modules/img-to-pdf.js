// ── modules/img-to-pdf.js ─────────────────────────────────────────────────────
function renderImgToPdf() {
  let files = [], quality = 100;
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">🖼️ Imágenes → PDF</div>
    <div class="option-group">
      <label>Calidad</label>
      <div class="option-row" id="q-row"></div>
    </div>
    <div class="file-zone" id="zone-i2p">
      <div class="file-zone-header">
        <span class="file-count-badge" id="i2p-badge">0 imágenes cargadas</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-imgs">📂 Seleccionar imágenes</button>
        <button class="btn-secondary" id="clear-i2p" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
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
    <div id="i2p-result"></div>
  </div>`;

  optButtons(document.getElementById('q-row'), [
    { label: '100% — Máxima', value: 100 },
    { label: '75% — Alta',    value: 75  },
    { label: '50% — Media',   value: 50  },
    { label: '25% — Baja',    value: 25  },
  ], 100, v => { quality = v; });

  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('img-list', files, onRemove);
    updateRun();
  };

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'i2p-path');
    const news = picked.filter(f => !files.includes(f));
    const dups = picked.filter(f =>  files.includes(f));
    files = [...files, ...news];
    renderFileList('img-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-imgs').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg'] }]);
    addFiles(picked);
  });

  document.getElementById('clear-i2p').addEventListener('click', () => {
    files = [];
    renderFileList('img-list', files, onRemove);
    document.getElementById('i2p-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('i2p-pick').addEventListener('click', () => pickOutputDir('i2p-path').then(updateRun));

  bindDragDrop('zone-i2p', ['png', 'jpg', 'jpeg'], addFiles);

  function updateRun() {
    document.getElementById('run-i2p').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-i2p').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('i2p-badge').textContent   = `${files.length} imagen(es) seleccionada(s)`;
  }

  document.getElementById('cancel-i2p').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  document.getElementById('run-i2p').addEventListener('click', async () => {
    setProcessing(true);
    const btn    = document.getElementById('run-i2p');
    const cancel = document.getElementById('cancel-i2p');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('i2p-result').innerHTML = progressBar(40);

    const res = await window.api.convertImgToPdf({ files, quality, outputDir: state.outputDir });
    window.api.playBeep();

    const ok  = res.filter(r => r.ok);
    const err = res.filter(r => !r.ok);
    document.getElementById('i2p-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} archivo(s) convertido(s)`, ok.map(r => `📄 ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es) o cancelados`,  err.map(r => basename(r.file))) : '');

    if (ok.length)  notify.success(`${ok.length} imagen(es) convertida(s) a PDF.`);
    if (err.length) notify.error(`${err.length} archivo(s) no pudieron convertirse.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Convertir a PDF';
    cancel.style.display = 'none';
    updateRun();
  });
}
