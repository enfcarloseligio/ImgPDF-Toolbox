// ── modules/merge.js ──────────────────────────────────────────────────────────
function renderMerge() {
  let files = [];
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">📑 Unir PDFs</div>
    <p class="module-desc">Selecciona los archivos en el orden en que quieres unirlos. Usa ↑↓ para reordenar.</p>
    <div class="file-zone" id="zone-mrg">
      <div class="file-zone-header">
        <span class="file-count-badge" id="mrg-badge">0 PDFs en lista</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-merge">📂 Agregar PDFs</button>
        <button class="btn-secondary" id="clear-merge" style="display:none">🗑️ Limpiar lista</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="merge-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>
    ${outputDirRow('mrg')}
    <div class="btn-row">
      <button class="btn-primary" id="run-merge" disabled style="width:auto">Unir PDFs</button>
    </div>
    <div id="merge-result"></div>
  </div>`;

  function refresh() {
    document.getElementById('mrg-badge').textContent = `${files.length} documento(s) para unir`;
    renderOrderedFileList('merge-list', files, updated => {
      files = [...updated];
      refresh();
      updateRun();
    });
    updateRun();
  }

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'mrg-path');
    const dups = picked.filter(f =>  files.includes(f));
    const news = picked.filter(f => !files.includes(f));
    files = [...files, ...news];
    refresh();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista y no se agregaron.`);
  };

  document.getElementById('pick-merge').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'PDF', extensions: ['pdf'] }]);
    addFiles(picked);
  });

  document.getElementById('clear-merge').addEventListener('click', () => {
    files = [];
    refresh();
    document.getElementById('merge-result').innerHTML = '';
  });

  document.getElementById('mrg-pick').addEventListener('click', () => pickOutputDir('mrg-path').then(updateRun));

  bindDragDrop('zone-mrg', ['pdf'], addFiles);

  function updateRun() {
    document.getElementById('run-merge').disabled  = !(files.length >= 2 && state.outputDir && !state.isProcessing);
    document.getElementById('clear-merge').style.display = files.length ? 'inline-block' : 'none';
  }

  document.getElementById('run-merge').addEventListener('click', async () => {
    setProcessing(true);
    const btn = document.getElementById('run-merge');
    btn.disabled = true; btn.textContent = 'Uniendo...';
    document.getElementById('merge-result').innerHTML = progressBar(50);

    const res = await window.api.mergePdfs({ files, outputDir: state.outputDir });
    window.api.playBeep();

    document.getElementById('merge-result').innerHTML = res.ok
      ? resultBox('success', '✓ PDFs unidos correctamente', [`📄 ${basename(res.out)}`], true)
      : resultBox('error',   '✗ Error al unir',             [String(res.error)]);

    res.ok ? notify.success('PDFs unidos correctamente.') : notify.error('Error al unir los PDFs.');

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Unir PDFs';
    updateRun();
  });
}
