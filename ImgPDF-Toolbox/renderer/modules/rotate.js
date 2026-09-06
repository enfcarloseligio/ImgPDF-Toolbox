// ── modules/rotate.js ─────────────────────────────────────────────────────────
function renderRotate() {
  let files = [], angle = 90, target = 'all';
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">🔄 Rotación masiva</div>
    <p class="module-desc">Gira imágenes (PNG/JPG) o documentos PDF en lote. Para PDFs puedes rotar todas las páginas o solo pares/impares.</p>

    <div class="option-group">
      <label>Ángulo de rotación</label>
      <div class="option-row" id="angle-row"></div>
    </div>

    <div class="option-group" id="target-group">
      <label>Páginas a rotar (solo PDFs)</label>
      <div class="option-row" id="target-row"></div>
    </div>

    <div class="file-zone" id="zone-rotate">
      <div class="file-zone-header">
        <span class="file-count-badge" id="rotate-badge">0 archivos cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-rotate">📂 Seleccionar archivos</button>
        <button class="btn-secondary" id="clear-rotate" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="rotate-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>

    ${outputDirRow('rotate')}

    <div class="btn-row">
      <button class="btn-primary" id="run-rotate" disabled style="width:auto">Rotar archivos</button>
      <button class="btn-danger"  id="cancel-rotate" style="display:none;width:auto">Cancelar</button>
    </div>
    <div id="rotate-result"></div>
  </div>`;

  optButtons(document.getElementById('angle-row'), [
    { label: '↻ 90°  (derecha)',   value: 90  },
    { label: '↻ 180° (invertir)',  value: 180 },
    { label: '↺ 270° (izquierda)', value: 270 },
  ], 90, val => { angle = val; });

  optButtons(document.getElementById('target-row'), [
    { label: 'Todas las páginas', value: 'all'  },
    { label: 'Solo pares',        value: 'even' },
    { label: 'Solo impares',      value: 'odd'  },
  ], 'all', val => { target = val; });

  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('rotate-list', files, onRemove);
    updateRun();
  };

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'rotate-path');
    const news = picked.filter(f => !files.includes(f));
    const dups = picked.filter(f =>  files.includes(f));
    files = [...files, ...news];
    renderFileList('rotate-list', files, onRemove);
    updateTargetVisibility();
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  function updateTargetVisibility() {
    // Mostrar opciones pares/impares solo si hay PDFs
    const hasPdf = files.some(f => f.toLowerCase().endsWith('.pdf'));
    document.getElementById('target-group').style.opacity      = hasPdf ? '1' : '0.4';
    document.getElementById('target-group').style.pointerEvents = hasPdf ? '' : 'none';
  }

  document.getElementById('pick-rotate').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{
      name: 'Imágenes y PDFs',
      extensions: ['pdf', 'png', 'jpg', 'jpeg']
    }]);
    addFiles(picked);
  });

  document.getElementById('clear-rotate').addEventListener('click', () => {
    files = [];
    renderFileList('rotate-list', files, onRemove);
    document.getElementById('rotate-result').innerHTML = '';
    updateTargetVisibility();
    updateRun();
  });

  document.getElementById('rotate-pick').addEventListener('click', () =>
    pickOutputDir('rotate-path').then(updateRun));

  bindDragDrop('zone-rotate', ['pdf', 'png', 'jpg', 'jpeg'], addFiles);

  function updateRun() {
    document.getElementById('run-rotate').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-rotate').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('rotate-badge').textContent   = `${files.length} archivo(s) seleccionado(s)`;
  }

  document.getElementById('cancel-rotate').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando rotación...');
  });

  document.getElementById('run-rotate').addEventListener('click', async () => {
    setProcessing(true);
    const btn    = document.getElementById('run-rotate');
    const cancel = document.getElementById('cancel-rotate');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('rotate-result').innerHTML = progressBar(40);

    const res = await window.api.rotateFiles({ files, angle, target, outputDir: state.outputDir });
    window.api.playBeep();

    const ok  = res.filter(r => r.ok);
    const err = res.filter(r => !r.ok);

    document.getElementById('rotate-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} archivo(s) rotado(s)`, ok.map(r => `📄 ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${ok.length} archivo(s) rotado(s) correctamente.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Rotar archivos';
    cancel.style.display = 'none';
    updateRun();
  });
}
