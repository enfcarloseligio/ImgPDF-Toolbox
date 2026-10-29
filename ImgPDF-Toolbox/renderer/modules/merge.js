// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/merge.js
// Descripción: Módulo «Unir PDFs»: fusiona varios documentos en uno solo respetando el
//              orden definido por el usuario en la lista.
// ═════════════════════════════════════════════════════════════════════════════

function renderMerge() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  let files = [];

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('merge',22)} Unir PDFs</div>
    <p class="module-desc">Selecciona los archivos en el orden en que quieres unirlos. Usa ↑↓ para reordenar.</p>
    ${fileZoneHtml({ zone: 'zone-mrg', pick: 'pick-merge', clear: 'clear-merge', badge: 'mrg-badge', list: 'merge-list', kind: 'pdf', multiple: true })}
    ${outputDirRow('mrg')}
    <div class="btn-row">
      <button class="btn-primary" id="run-merge" disabled style="width:auto">Unir PDFs</button>
    </div>
    <div class="progress-panel" id="merge-progress"></div>
    <div id="merge-result"></div>
  </div>`;
  organizeModule(ws);

  // ── Lista de archivos ────────────────────────────────────────────────────────
  function refresh() {
    document.getElementById('mrg-badge').textContent = fileCountText(files.length, 'pdf');
    renderOrderedFileList('merge-list', files, updated => {
      files = [...updated];
      refresh();
      updateRun();
    });
    updateRun();
  }

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'mrg-path');
    const dups = picked.filter(f =>  files.includes(f));
    const news = picked.filter(f => !files.includes(f));
    files = insertAt(files, news, index);
    refresh();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista y no se agregaron.`);
  };

  // ── Selección de archivos y carpeta de salida ────────────────────────────────
  document.getElementById('pick-merge').addEventListener('click', async () => {
    const picked = await pickFiles('pdf');
    addFiles(picked);
  });

  document.getElementById('clear-merge').addEventListener('click', () => {
    files = [];
    refresh();
    document.getElementById('merge-result').innerHTML = '';
  });

  document.getElementById('mrg-pick').addEventListener('click', () => pickOutputDir('mrg-path').then(updateRun));

  bindDragDrop('zone-mrg', FILE_KINDS['pdf'].extensions, addFiles);

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    document.getElementById('run-merge').disabled  = !(files.length >= 2 && state.outputDir && !state.isProcessing);
    document.getElementById('clear-merge').style.display = files.length ? 'inline-block' : 'none';
  }

  // ── Ejecución ────────────────────────────────────────────────────────────────
  document.getElementById('run-merge').addEventListener('click', async () => {
    setProcessing(true);
    const btn = document.getElementById('run-merge');
    btn.disabled = true; btn.textContent = 'Uniendo...';
    document.getElementById('merge-result').innerHTML = '';

    const res = await runWithProgress('merge', 'merge-progress', () => window.api.mergePdfs({ files, outputDir: state.outputDir }));
    window.api.playBeep();

    document.getElementById('merge-result').innerHTML = res.ok
      ? resultBox('success', 'PDFs unidos correctamente', [`${icon('file',14)} ${basename(res.out)}`], true)
      : resultBox('error',   'Error al unir',             [String(res.error)]);

    res.ok ? notify.success('PDFs unidos correctamente.') : notify.error('Error al unir los PDFs.');

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Unir PDFs';
    updateRun();
  });
}
