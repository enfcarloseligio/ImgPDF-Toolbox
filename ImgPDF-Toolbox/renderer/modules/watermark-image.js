// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/watermark-image.js
// Descripción: Módulo «Marca de agua — Imagen»: estampa un logo o firma sobre imágenes y
//              PDFs con tamaño, opacidad, posición, ángulo y repetición configurables.
// ═════════════════════════════════════════════════════════════════════════════

async function renderWatermarkImage(ctx = {}) {
  // La categoría desde la que se abre decide el tipo de archivo: PDF o imagen
  const kind = ctx.context === 'image' ? 'image' : 'pdf';

  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('watermark-image', {
    sizePercent:  25,
    opacity:      70,
    position:     'bottom_right',
    angle:        0,
    repeatMode:   'single',
    repeatGapH:   300,
    repeatGapV:   200,
    marginX:      40,
    marginY:      30,
  });

  let files       = [];
  let markFile    = null;

  let sizePercent = snapTo(cfg.sizePercent, [10, 25, 50, 75], 25);   // Los tamaños guardados de versiones anteriores (20, 30) se ajustan al más cercano
  let opacity     = cfg.opacity;
  let position    = cfg.position;
  let angle       = cfg.angle;
  let repeatMode  = cfg.repeatMode;
  let repeatGapH  = cfg.repeatGapH;
  let repeatGapV  = cfg.repeatGapV;
  let marginX     = cfg.marginX;
  let marginY     = cfg.marginY;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  let preview = null;   // Vista previa real (se crea al construir la interfaz)
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module module-apv">
    <div class="module-title">${icon('tag',22)} Marca de agua — Imagen</div>
    <p class="module-desc">Superpone una imagen (PNG con transparencia recomendado) sobre ${kind === 'image' ? 'imágenes' : 'PDFs'}.</p>

    <!-- Imagen de marca: mismas zonas y estructura que los archivos destino -->
    <div class="option-group">
      <label>Imagen de marca de agua</label>
      ${fileZoneHtml({ zone: 'zone-mark', pick: 'pick-mark', clear: 'clear-mark', badge: 'mark-badge', list: 'mark-list', kind: 'image', multiple: false })}
    </div>

    <!-- Tamaño relativo -->
    <div class="option-group">
      <label>Tamaño relativo al documento</label>
      <div class="option-row" id="size-row"></div>
      <p style="font-size:0.76rem;color:var(--text-muted);margin-top:0.25rem">
        Porcentaje del ancho del documento. La imagen se escala proporcionalmente.
      </p>
    </div>

    <!-- Opacidad -->
    <div class="option-group">
      <label>Opacidad (%)</label>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <input type="range" id="wmi-opacity-range" min="5" max="100" value="${opacity}"
          style="flex:1;accent-color:var(--primary)">
        <input type="number" class="num-input" id="wmi-opacity" value="${opacity}" min="5" max="100" style="width:70px">
        <span style="font-size:0.82rem;color:var(--text-muted)">%</span>
      </div>
    </div>

    <!-- Orientación / ángulo -->
    <div class="option-group">
      <label>Orientación</label>
      <div class="option-row" id="angle-row"></div>
    </div>

    <!-- Modo de repetición -->
    <div class="option-group">
      <label>Distribución</label>
      <div class="option-row" id="repeat-row"></div>
      <div id="repeat-gap-section" style="display:none;margin-top:0.5rem">
        <div class="range-row">
          <span>Separación horizontal:</span>
          <input type="number" class="num-input" id="wmi-gap-h" value="${repeatGapH}" min="50" max="800">
          <span>px</span>
          <span style="margin-left:1rem">Vertical:</span>
          <input type="number" class="num-input" id="wmi-gap-v" value="${repeatGapV}" min="30" max="600">
          <span>px</span>
        </div>
      </div>
    </div>

    <!-- Posición y margen (solo modo único) -->
    <div id="position-section">
      <div class="option-group">
        <label>Posición</label>
        <div class="option-row" id="position-row"></div>
        <div class="range-row" style="margin-top:0.5rem">
          <span>Margen X:</span>
          <input type="number" class="num-input" id="wmi-margin-x" value="${marginX}" min="0" max="400">
          <span>px</span>
          <span style="margin-left:1rem">Margen Y:</span>
          <input type="number" class="num-input" id="wmi-margin-y" value="${marginY}" min="0" max="400">
          <span>px</span>
        </div>
      </div>
    </div>

    <!-- Vista previa real -->
    <div class="option-group" data-step="preview">
      <label>Vista previa</label>
      <div id="wmi-preview"></div>
    </div>

    <!-- Archivos destino -->
    <div class="option-group">
      <label>Archivos a procesar</label>
      ${fileZoneHtml({ zone: 'zone-wmi', pick: 'pick-wmi', clear: 'clear-wmi', badge: 'wmi-badge', list: 'wmi-list', kind: kind, multiple: true })}
    </div>

    ${outputDirRow('wmi')}

    <div class="btn-row">
      <button class="btn-primary" id="run-wmi" disabled style="width:auto">Aplicar marca de imagen</button>
      <button class="btn-danger"  id="cancel-wmi" style="display:none;width:auto">Cancelar</button>
      ${counterpartButtonHtml('wmi', kind, 'Marca imagen')}
    </div>
    <div class="progress-panel" id="wmi-progress"></div>
    <div id="wmi-result"></div>
  </div>`;
  organizeModule(ws);
  bindCounterpart('wmi', kind, 'watermark-image');

  // ── Imagen de marca: selección, arrastre y limpieza ─────────────────────────
  const MARK_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg', 'webp'];

  // Aplica (o quita, con null) la imagen de marca y sincroniza la lista, el contador y la vista previa.
  function setMark(filePath) {
    markFile = filePath;
    const list = document.getElementById('mark-list');

    if (filePath) {
      list.innerHTML = `
        <div class="file-item">
          <img class="mark-thumb-sm" id="mark-thumb-img" src="${toFileUrl(filePath)}" alt="">
          <span class="file-name" title="${filePath}">${basename(filePath)}</span>
          <button class="file-remove" id="rm-mark" title="Quitar">${icon('close', 14)}</button>
        </div>`;
      document.getElementById('rm-mark').addEventListener('click', () => setMark(null));
    } else {
      list.innerHTML = fileEmptyHtml('image');
    }

    document.getElementById('mark-badge').textContent = fileCountText(filePath ? 1 : 0, 'image');
    document.getElementById('clear-mark').style.display = filePath ? 'inline-block' : 'none';

    updatePreview();
    updateRun();
  }

  document.getElementById('pick-mark').addEventListener('click', async () => {
    const picked = await pickFiles('image', MARK_EXTENSIONS);
    if (picked.length) setMark(picked[0]);
  });
  document.getElementById('clear-mark').addEventListener('click', () => setMark(null));

  bindDragDrop('zone-mark', MARK_EXTENSIONS, paths => setMark(paths[0]));

  // ── Tamaño relativo ─────────────────────────────────────────────────────────
  optButtons(document.getElementById('size-row'), [
    { label: '10% — Pequeño',  value: 10 },
    { label: '25% — Mediano',  value: 25 },
    { label: '50% — Grande',   value: 50 },
    { label: '75% — Portada',  value: 75 },
  ], sizePercent, val => {
    sizePercent = val;
    saveModuleConfig('watermark-image', { sizePercent: val });
    updatePreview();
  });

  // ── Opacidad ────────────────────────────────────────────────────────────────
  const opacityRange = document.getElementById('wmi-opacity-range');
  const opacityNum   = document.getElementById('wmi-opacity');
  opacityRange.addEventListener('input', e => {
    opacity = parseInt(e.target.value);
    opacityNum.value = opacity;
    saveModuleConfig('watermark-image', { opacity });
    updatePreview();
  });
  opacityNum.addEventListener('input', e => {
    opacity = parseInt(e.target.value) || 70;
    opacityRange.value = opacity;
    saveModuleConfig('watermark-image', { opacity });
    updatePreview();
  });

  // ── Orientación ─────────────────────────────────────────────────────────────
  optButtons(document.getElementById('angle-row'), [
    { label: '↑ Normal (0°)',    value: 0   },
    { label: '↻ 45° diagonal',   value: 45  },
    { label: '↻ 90° derecha',    value: 90  },
    { label: '↺ -45° diagonal',  value: -45 },
    { label: '↺ -90° izquierda', value: -90 },
    { label: '↕ 180° invertido', value: 180 },
  ], angle, val => {
    angle = val;
    saveModuleConfig('watermark-image', { angle: val });
    updatePreview();
  });

  // ── Distribución ─────────────────────────────────────────────────────────────
  optButtons(document.getElementById('repeat-row'), [
    { label: '⊙ Imagen única',    value: 'single' },
    { label: '⊞ Mosaico repetido', value: 'tile'   },
  ], repeatMode, val => {
    repeatMode = val;
    saveModuleConfig('watermark-image', { repeatMode: val });
    document.getElementById('repeat-gap-section').style.display = val === 'tile' ? 'block' : 'none';
    document.getElementById('position-section').style.display   = val === 'tile' ? 'none'  : 'block';
    updatePreview();
  });

  document.getElementById('repeat-gap-section').style.display = repeatMode === 'tile' ? 'block' : 'none';
  document.getElementById('position-section').style.display   = repeatMode === 'tile' ? 'none'  : 'block';

  document.getElementById('wmi-gap-h').addEventListener('input', e => {
    repeatGapH = parseInt(e.target.value)||300;
    saveModuleConfig('watermark-image',{repeatGapH}); updatePreview();
  });
  document.getElementById('wmi-gap-v').addEventListener('input', e => {
    repeatGapV = parseInt(e.target.value)||200;
    saveModuleConfig('watermark-image',{repeatGapV}); updatePreview();
  });

  // ── Posición ─────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('position-row'), [
    { label: '↖ Sup. Izq.',  value: 'top_left'     },
    { label: '↗ Sup. Der.',  value: 'top_right'    },
    { icon: 'crosshair', label: 'Centro',     value: 'center'       },
    { label: '↙ Inf. Izq.',  value: 'bottom_left'  },
    { label: '↘ Inf. Der.',  value: 'bottom_right' },
  ], position, val => {
    position = val;
    saveModuleConfig('watermark-image',{position}); updatePreview();
  });

  document.getElementById('wmi-margin-x').addEventListener('input', e => {
    marginX = parseInt(e.target.value)||40;
    saveModuleConfig('watermark-image',{marginX}); updatePreview();
  });
  document.getElementById('wmi-margin-y').addEventListener('input', e => {
    marginY = parseInt(e.target.value)||30;
    saveModuleConfig('watermark-image',{marginY}); updatePreview();
  });

  // ── Vista previa real ───────────────────────────────────────────────────────
  // Se genera con el mismo proceso que el archivo final, sobre la primera página del primer archivo
  function updatePreview() { preview?.refresh(); }
  preview = createAnnotationPreview(document.getElementById('wmi-preview'), {
    tool: 'watermark-image',
    getFile: () => files[0],
    getParams: () => ({ markFile, sizePercent, opacity, position, angle, repeatMode, repeatGapH, repeatGapV, marginX, marginY }),
  });

  requestAnimationFrame(updatePreview);

  // ── Lista de archivos destino ──────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('wmi-list', files, onRemove);
    updateRun();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'wmi-path');
    const dups = picked.filter(f => files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderFileList('wmi-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-wmi').addEventListener('click', async () => {
    const picked = await pickFiles(kind);
    addFiles(picked);
  });

  document.getElementById('clear-wmi').addEventListener('click', () => {
    files = [];
    renderFileList('wmi-list', files, onRemove);
    document.getElementById('wmi-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('wmi-pick').addEventListener('click', () =>
    pickOutputDir('wmi-path').then(updateRun));
  bindDragDrop('zone-wmi', FILE_KINDS[kind].extensions, addFiles);

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    updatePreview();   // Cambia el primer archivo de la lista: cambia la vista previa
    document.getElementById('run-wmi').disabled = !(files.length && markFile && state.outputDir && !state.isProcessing);
    document.getElementById('clear-wmi').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('wmi-badge').textContent   = fileCountText(files.length, kind);
  }

  // ── Cancelación y ejecución ──────────────────────────────────────────────────
  document.getElementById('cancel-wmi').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando marca de imagen...');
  });

  document.getElementById('run-wmi').addEventListener('click', async () => {
    if (!markFile) { notify.warning('Selecciona una imagen de marca de agua.'); return; }
    setProcessing(true);
    const btn = document.getElementById('run-wmi'), cancel = document.getElementById('cancel-wmi');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('wmi-result').innerHTML = '';

    const res = await runWithProgress('watermark-image', 'wmi-progress', () => window.api.watermarkImage({
      files, markFile, sizePercent, opacity, position,
      angle, repeatMode, repeatGapH, repeatGapV, marginX, marginY,
      outputDir: state.outputDir
    }));
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('wmi-result').innerHTML =
      (ok.length  ? resultBox('success', `${ok.length} archivo(s) procesado(s)`, ok.map(r => `${icon('file',14)} ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`Marca de imagen aplicada en ${ok.length} archivo(s).`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Aplicar marca de imagen';
    cancel.style.display = 'none';
    updateRun();
  });
}
