// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/img-to-pdf.js
// Descripción: Módulo «Imágenes → PDF»: convierte imágenes PNG/JPG en documentos PDF con
//              calidad configurable.
// ═════════════════════════════════════════════════════════════════════════════

async function renderImgToPdf(ctx = {}) {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('img-to-pdf', { quality: 100, single: false });
  let files = [], quality = cfg.quality, single = cfg.single;
  let lastOutputs = [];   // PDFs generados en la última ejecución (para continuar en PDF → IMG)

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('image-file',22)} Imágenes → PDF</div>
    <div class="option-group">
      <label>Calidad</label>
      <div class="option-row" id="q-row"></div>
      <p class="option-hint">Original conserva los píxeles exactos de la imagen sin recomprimir (el PDF puede pesar más). Las demás aplican compresión JPEG proporcional.</p>
    </div>
    <div class="option-group">
      <label>Resultado</label>
      <div class="option-row" id="mode-row"></div>
      <p class="option-hint" id="mode-hint"></p>
    </div>
    ${fileZoneHtml({ zone: 'zone-i2p', pick: 'pick-imgs', clear: 'clear-i2p', badge: 'i2p-badge', list: 'img-list', kind: 'image', multiple: true })}
    ${outputDirRow('i2p')}
    <div class="btn-row">
      <button class="btn-primary" id="run-i2p" disabled style="width:auto">Convertir a PDF</button>
      <button class="btn-danger"  id="cancel-i2p" style="display:none;width:auto">Cancelar</button>
      <button class="btn-secondary" id="goto-p2i" style="width:auto">${iconLabel('arrow-right', 'Ir a PDF → Imágenes')}</button>
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

  // Un PDF por imagen o todas unidas en un solo PDF (en el orden de la lista)
  const modeHint = () => {
    document.getElementById('mode-hint').textContent = single
      ? 'Todas las imágenes se unen en un único PDF, una por página y en el orden de la lista. Puedes reordenarlas arrastrándolas.'
      : 'Cada imagen genera su propio PDF.';
  };
  optButtons(document.getElementById('mode-row'), [
    { label: 'Un PDF por imagen',     value: false },
    { label: 'Unir en un solo PDF',   value: true  },
  ], single, v => { single = v; modeHint(); renderList(); },
  v => saveModuleConfig('img-to-pdf', { single: v }));
  modeHint();

  // ── Lista de archivos ────────────────────────────────────────────────────────
  const onReorder = newFiles => { files = newFiles; renderList(); updateRun(); };
  const renderList = () => {
    if (single) renderOrderedFileList('img-list', files, onReorder, { showDrag: true, showArrows: true });
    else renderFileList('img-list', files, onRemove);
  };
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderList();
    updateRun();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'i2p-path');
    const dups = picked.filter(f =>  files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderList();
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  // ── Selección de archivos y carpeta de salida ────────────────────────────────
  document.getElementById('pick-imgs').addEventListener('click', async () => {
    const picked = await pickFiles('image');
    addFiles(picked);
  });

  document.getElementById('clear-i2p').addEventListener('click', () => {
    files = [];
    renderList();
    document.getElementById('i2p-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('i2p-pick').addEventListener('click', () => pickOutputDir('i2p-path').then(updateRun));
  bindDragDrop('zone-i2p', FILE_KINDS['image'].extensions, addFiles);

  // ── Atajo a PDF → Imágenes: lleva los PDFs recién generados, si los hay ──────
  document.getElementById('goto-p2i').addEventListener('click', () => {
    goToModule('pdf-tools', 'pdf-to-img', { files: lastOutputs });
  });

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    document.getElementById('run-i2p').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-i2p').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('i2p-badge').textContent   = fileCountText(files.length, 'image');
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

    const res = await runWithProgress('img-to-pdf', 'i2p-progress', () => window.api.convertImgToPdf({ files, quality, single, outputDir: state.outputDir }));
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    lastOutputs = ok.map(r => r.out);
    document.getElementById('i2p-result').innerHTML =
      (ok.length  ? resultBox('success',
          single ? `${ok[0].merged} imagen(es) unidas en un PDF` : `${ok.length} archivo(s) convertido(s)`,
          ok.map(r => `${icon('file',14)} ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `${err.length} error(es)`, err.map(r => basename(r.file))) : '');

    if (ok.length)  notify.success(single ? `${ok[0].merged} imagen(es) unidas en un PDF.` : `${ok.length} imagen(es) convertida(s) a PDF.`);
    if (err.length) notify.error(`${err.length} archivo(s) no pudieron convertirse.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Convertir a PDF';
    cancel.style.display = 'none';
    updateRun();
  });

  if (ctx.files?.length) addFiles(ctx.files);
}
