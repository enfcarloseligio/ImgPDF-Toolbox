// ── modules/compress.js ───────────────────────────────────────────────────────
async function renderCompress() {
  const cfg = await loadModuleConfig('compress', { profile: 'ebook' });
  let files = [], profile = cfg.profile;

  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">🗜️ Comprimir PDFs</div>
    <p class="module-desc">Reduce el peso de tus PDFs usando perfiles de Ghostscript. El archivo original no se modifica.</p>
    <div class="option-group">
      <label>Perfil de compresión</label>
      <div class="option-row" id="profile-row"></div>
      <div class="profile-hint" id="profile-hint"></div>
    </div>
    <div class="file-zone" id="zone-compress">
      <div class="file-zone-header">
        <span class="file-count-badge" id="compress-badge">0 PDFs cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-compress">📂 Seleccionar PDFs</button>
        <button class="btn-secondary" id="clear-compress" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="compress-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>
    ${outputDirRow('compress')}
    <div class="btn-row">
      <button class="btn-primary" id="run-compress" disabled style="width:auto">Comprimir PDFs</button>
      <button class="btn-danger"  id="cancel-compress" style="display:none;width:auto">Cancelar</button>
    </div>
    <div id="compress-result"></div>
  </div>`;

  const profiles = [
    { label: '🖥 Pantalla',        value: 'screen',   hint: '72 DPI — Mínimo peso. Ideal para envío por correo o mensajería.' },
    { label: '📖 Digital',         value: 'ebook',    hint: '150 DPI — Balance óptimo entre peso y calidad. Recomendado.' },
    { label: '🖨 Impresión',       value: 'printer',  hint: '300 DPI — Alta calidad. Para documentos que se imprimirán.' },
    { label: '🏆 Alta definición', value: 'prepress', hint: '300+ DPI — Máxima fidelidad. Para archivos institucionales.' },
  ];

  const hintEl = document.getElementById('profile-hint');
  function updateHint(val) {
    const p = profiles.find(x => x.value === val);
    if (p) hintEl.textContent = p.hint;
  }

  optButtons(document.getElementById('profile-row'), profiles, profile, val => {
    profile = val; updateHint(val);
  }, val => saveModuleConfig('compress', { profile: val }));
  updateHint(profile);

  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('compress-list', files, onRemove);
    updateRun();
  };

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'compress-path');
    const dups = picked.filter(f => files.includes(f));
    files = [...files, ...picked.filter(f => !files.includes(f))];
    renderFileList('compress-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-compress').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'PDF', extensions: ['pdf'] }]);
    addFiles(picked);
  });

  document.getElementById('clear-compress').addEventListener('click', () => {
    files = [];
    renderFileList('compress-list', files, onRemove);
    document.getElementById('compress-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('compress-pick').addEventListener('click', () => pickOutputDir('compress-path').then(updateRun));
  bindDragDrop('zone-compress', ['pdf'], addFiles);

  function updateRun() {
    document.getElementById('run-compress').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-compress').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('compress-badge').textContent   = `${files.length} documento(s) seleccionado(s)`;
  }

  document.getElementById('cancel-compress').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando compresión...');
  });

  document.getElementById('run-compress').addEventListener('click', async () => {
    setProcessing(true);
    const btn = document.getElementById('run-compress'), cancel = document.getElementById('cancel-compress');
    btn.disabled = true; btn.textContent = 'Comprimiendo...';
    cancel.style.display = 'inline-block';
    document.getElementById('compress-result').innerHTML = progressBar(40);

    const res = await window.api.compressPdf({ files, profile, outputDir: state.outputDir });
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    const okItems = ok.map(r => {
      const before = formatBytes(r.sizeBefore), after = formatBytes(r.sizeAfter);
      const savings = r.sizeBefore > 0 ? Math.round((1 - r.sizeAfter / r.sizeBefore) * 100) : 0;
      return `📄 ${basename(r.out)} (${before} → ${after}${savings > 0 ? ` — reducido ${savings}%` : ''})`;
    });

    document.getElementById('compress-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} PDF(s) comprimido(s)`, okItems, true) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${ok.length} PDF(s) comprimido(s) correctamente.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Comprimir PDFs';
    cancel.style.display = 'none';
    updateRun();
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
