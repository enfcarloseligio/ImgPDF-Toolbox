// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/rotate.js
// Descripción: Módulo «Rotar»: gira imágenes y PDFs en lote (todas las páginas, pares o
//              impares).
// ═════════════════════════════════════════════════════════════════════════════

async function renderRotate(ctx = {}) {
  // La categoría desde la que se abre decide el tipo de archivo: PDF o imagen
  const kind = ctx.context === 'image' ? 'image' : 'pdf';

  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('rotate', { angle: 90, target: 'all' });
  let files = [], angle = cfg.angle, target = cfg.target;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('rotate',22)} Rotación masiva</div>
    <p class="module-desc">${kind === 'image' ? 'Gira imágenes (PNG/JPG) en lote.' : 'Gira documentos PDF en lote. Puedes rotar todas las páginas o solo pares/impares.'}</p>
    <div class="option-group">
      <label>Ángulo de rotación</label>
      <div class="option-row" id="angle-row"></div>
    </div>
    <div class="option-group" id="target-group">
      <label>Páginas a rotar</label>
      <div class="option-row" id="target-row"></div>
    </div>
    ${fileZoneHtml({ zone: 'zone-rotate', pick: 'pick-rotate', clear: 'clear-rotate', badge: 'rotate-badge', list: 'rotate-list', kind: kind, multiple: true })}
    ${outputDirRow('rotate')}
    <div class="btn-row">
      <button class="btn-primary" id="run-rotate" disabled style="width:auto">Rotar archivos</button>
      <button class="btn-danger"  id="cancel-rotate" style="display:none;width:auto">Cancelar</button>
    </div>
    <div class="progress-panel" id="rotate-progress"></div>
    <div id="rotate-result"></div>
  </div>`;
  organizeModule(ws);

  // ── Opciones de configuración ────────────────────────────────────────────────
  optButtons(document.getElementById('angle-row'), [
    { label: '↻ 90°  (derecha)',   value: 90  },
    { label: '↻ 180° (invertir)',  value: 180 },
    { label: '↺ 270° (izquierda)', value: 270 },
  ], angle, val => { angle = val; },
  val => saveModuleConfig('rotate', { angle: val }));

  optButtons(document.getElementById('target-row'), [
    { label: 'Todas las páginas', value: 'all'  },
    { label: 'Solo pares',        value: 'even' },
    { label: 'Solo impares',      value: 'odd'  },
  ], target, val => { target = val; },
  val => saveModuleConfig('rotate', { target: val }));

  // ── Lista de archivos ────────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('rotate-list', files, onRemove);
    updateTargetVisibility();
    updateRun();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'rotate-path');
    const dups = picked.filter(f => files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderFileList('rotate-list', files, onRemove);
    updateTargetVisibility();
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  function updateTargetVisibility() {
    const hasPdf = files.some(f => f.toLowerCase().endsWith('.pdf'));
    const grp = document.getElementById('target-group');
    grp.style.opacity      = hasPdf ? '1' : '0.4';
    grp.style.pointerEvents = hasPdf ? '' : 'none';
  }

  // ── Selección de archivos y carpeta de salida ────────────────────────────────
  document.getElementById('pick-rotate').addEventListener('click', async () => {
    const picked = await pickFiles(kind);
    addFiles(picked);
  });

  document.getElementById('clear-rotate').addEventListener('click', () => {
    files = [];
    renderFileList('rotate-list', files, onRemove);
    document.getElementById('rotate-result').innerHTML = '';
    updateTargetVisibility();
    updateRun();
  });

  document.getElementById('rotate-pick').addEventListener('click', () => pickOutputDir('rotate-path').then(updateRun));
  bindDragDrop('zone-rotate', FILE_KINDS[kind].extensions, addFiles);

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    document.getElementById('run-rotate').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-rotate').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('rotate-badge').textContent   = fileCountText(files.length, kind);
  }

  // ── Cancelación y ejecución ──────────────────────────────────────────────────
  document.getElementById('cancel-rotate').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando rotación...');
  });

  document.getElementById('run-rotate').addEventListener('click', async () => {
    setProcessing(true);
    const btn = document.getElementById('run-rotate'), cancel = document.getElementById('cancel-rotate');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('rotate-result').innerHTML = '';

    const res = await runWithProgress('rotate', 'rotate-progress', () => window.api.rotateFiles({ files, angle, target, outputDir: state.outputDir }));
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('rotate-result').innerHTML =
      (ok.length  ? resultBox('success', `${ok.length} archivo(s) rotado(s)`, ok.map(r => `${icon('file',14)} ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${ok.length} archivo(s) rotado(s) correctamente.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Rotar archivos';
    cancel.style.display = 'none';
    updateRun();
  });
}
