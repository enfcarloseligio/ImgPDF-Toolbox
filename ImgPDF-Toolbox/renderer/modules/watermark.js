// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/watermark.js
// Descripción: Módulo «Marca de agua — Texto»: estampa texto personalizado, orientado y
//              posicionado sobre imágenes y PDFs, con selector de tipografía y vista previa.
// ═════════════════════════════════════════════════════════════════════════════

async function renderWatermark(ctx = {}) {
  // La categoría desde la que se abre decide el tipo de archivo: PDF o imagen
  const kind = ctx.context === 'image' ? 'image' : 'pdf';

  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('watermark', {
    text: 'CONFIDENCIAL', fontSize: 72, fontWeight: 400,
    opacity: 50, orientation: 'diagonal_asc', angle: -45, position: 'center',
    color: '#FF0000', repeatMode: 'single',
    repeatGapH: 200, repeatGapV: 150,
    fontSource: 'system'
  });

  let files       = [];
  let text        = cfg.text;
  let fontPath    = null;
  let fontSize    = cfg.fontSize;
  let fontWeight  = cfg.fontWeight;
  let opacity     = cfg.opacity;
  let orientation = cfg.orientation || 'diagonal_asc';
  let angle       = cfg.angle ?? -45;
  let position    = cfg.position;
  let color       = cfg.color;
  let repeatMode  = cfg.repeatMode;
  let repeatGapH  = cfg.repeatGapH;
  let repeatGapV  = cfg.repeatGapV;
  let fontSource  = cfg.fontSource;
  const systemFonts = [];
  const gfCatalog   = [];

  const orientationAngles = {
    diagonal_asc:  -45,
    diagonal_desc:  45,
    horizontal:      0,
    vertical:      -90
  };

  angle = orientationAngles[orientation] ?? angle;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  let preview = null;   // Vista previa real (se crea al construir la interfaz)
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module module-apv">
    <div class="module-title">${icon('droplet',22)} Marca de agua</div>
    <p class="module-desc">Estampa texto personalizado, orientado y posicionado sobre ${kind === 'image' ? 'imágenes' : 'PDFs'}.</p>

    <!-- Texto -->
    <div class="option-group">
      <label>Texto de la marca</label>
      <input type="text" id="wm-text" class="num-input"
        style="width:100%;text-align:left;font-size:0.9rem"
        value="${text}" placeholder="Escribe el texto de la marca...">
      <div class="option-row" id="shortcut-row" style="margin-top:0.5rem"></div>
    </div>

    <!-- Fuente -->
    <div class="option-group">
      <label>Fuente</label>
      <div class="option-row" id="font-source-row"></div>
      <div id="font-picker" style="margin-top:0.5rem"></div>
    </div>

    <!-- Tamaño, peso y opacidad -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
      <div class="option-group">
        <label>Tamaño (px)</label>
        <input type="number" class="num-input" id="wm-size" value="${fontSize}" min="10" max="300" style="width:100%">
      </div>
      <div class="option-group">
        <label>Peso</label>
        <select id="wm-weight" style="width:100%;border:1px solid var(--border);border-radius:6px;
          padding:0.38rem 0.6rem;font-size:0.83rem;background:var(--bg);color:var(--deep)">
          <option value="100" ${fontWeight==100?'selected':''}>Thin (100)</option>
          <option value="200" ${fontWeight==200?'selected':''}>ExtraLight (200)</option>
          <option value="300" ${fontWeight==300?'selected':''}>Light (300)</option>
          <option value="400" ${fontWeight==400?'selected':''}>Regular (400)</option>
          <option value="500" ${fontWeight==500?'selected':''}>Medium (500)</option>
          <option value="600" ${fontWeight==600?'selected':''}>SemiBold (600)</option>
          <option value="700" ${fontWeight==700?'selected':''}>Bold (700)</option>
          <option value="800" ${fontWeight==800?'selected':''}>ExtraBold (800)</option>
          <option value="900" ${fontWeight==900?'selected':''}>Black (900)</option>
        </select>
      </div>
      <div class="option-group">
        <label>Opacidad (%)</label>
        <input type="number" class="num-input" id="wm-opacity" value="${opacity}" min="5" max="100" style="width:100%">
      </div>
    </div>

    <!-- Orientación (Ángulo) -->
    <div class="option-group">
      <label>Orientación del texto</label>
      <div class="option-row" id="orientation-row"></div>
    </div>

    <!-- Color -->
    <div class="option-group">
      <label>Color</label>
      <div class="option-row" id="color-row"></div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem">
        <input type="color" id="wm-color" value="${color}"
          style="width:36px;height:36px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px">
        <span style="font-size:0.78rem;color:var(--text-muted)">O elige un color personalizado</span>
      </div>
    </div>

    <!-- Modo de repetición -->
    <div class="option-group">
      <label>Distribución</label>
      <div class="option-row" id="repeat-row"></div>
      <div id="repeat-gap-row" style="display:none;margin-top:0.5rem">
        <div class="range-row">
          <span>Separación horizontal:</span>
          <input type="number" class="num-input" id="wm-gap-h" value="${repeatGapH}" min="50" max="800">
          <span>px</span>
          <span style="margin-left:1rem">Vertical:</span>
          <input type="number" class="num-input" id="wm-gap-v" value="${repeatGapV}" min="30" max="600">
          <span>px</span>
        </div>
      </div>
    </div>

    <!-- Posición (solo visible en Palabra única) -->
    <div class="option-group" id="position-group">
      <label>Posición en el documento</label>
      <div class="option-row" id="position-row"></div>
    </div>

    <!-- Vista previa real -->
    <div class="option-group" data-step="preview">
      <label>Vista previa</label>
      <div id="wm-preview"></div>
    </div>

    <!-- Archivos -->
    ${fileZoneHtml({ zone: 'zone-wm', pick: 'pick-wm', clear: 'clear-wm', badge: 'wm-badge', list: 'wm-list', kind: kind, multiple: true })}

    ${outputDirRow('wm')}

    <div class="btn-row">
      <button class="btn-primary" id="run-wm" disabled style="width:auto">Aplicar marca de agua</button>
      <button class="btn-danger"  id="cancel-wm" style="display:none;width:auto">Cancelar</button>
      ${counterpartButtonHtml('wm', kind, 'Marca texto')}
    </div>
    <div class="progress-panel" id="wm-progress"></div>
    <div id="wm-result"></div>
  </div>`;
  organizeModule(ws);
  bindCounterpart('wm', kind, 'watermark');

  // ── Vista previa real ───────────────────────────────────────────────────────
  // Se genera con el mismo proceso que el archivo final, sobre la primera página del primer archivo
  function updatePreview() { preview?.refresh(); }
  preview = createAnnotationPreview(document.getElementById('wm-preview'), {
    tool: 'watermark',
    getFile: () => files[0],
    getParams: () => text.trim()
      ? { text, fontPath, fontWeight, fontSize, opacity, angle, position, color, repeatMode, repeatGapH, repeatGapV }
      : { error: 'Escribe el texto de la marca de agua para ver la vista previa.' },
  });

  // ── Atajos de texto ─────────────────────────────────────────────────────────
  ['CONFIDENCIAL','COPIA','BORRADOR','RECIBIDO','PRELIMINAR'].forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn';
    btn.textContent = s;
    btn.addEventListener('click', () => {
      text = s;
      document.getElementById('wm-text').value = s;
      saveModuleConfig('watermark', { text: s });
      updatePreview();
    });
    document.getElementById('shortcut-row').appendChild(btn);
  });

  document.getElementById('wm-text').addEventListener('input', e => {
    text = e.target.value;
    saveModuleConfig('watermark', { text });
    updatePreview();
  });

  // ── Orientación (Ángulo) ────────────────────────────────────────────────────
  optButtons(document.getElementById('orientation-row'), [
    { label: '↗ Diagonal Ascendente (-45°)',  value: 'diagonal_asc'  },
    { label: '↘ Diagonal Descendente (45°)',  value: 'diagonal_desc' },
    { icon: 'arrow-right', label: 'Horizontal (0°)',             value: 'horizontal'    },
    { icon: 'arrow-up', label: 'Vertical (90°)',              value: 'vertical'      },
  ], orientation, val => {
    orientation = val;
    angle = orientationAngles[val] ?? 0;
    saveModuleConfig('watermark', { orientation: val, angle });
    updatePreview();
  });

  // ── Fuente ──────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('font-source-row'), [
    { icon: 'monitor', label: 'Fuentes del sistema', value: 'system' },
    { icon: 'globe', label: 'Google Fonts',        value: 'google' },
  ], fontSource, val => {
    fontSource = val;
    saveModuleConfig('watermark', { fontSource: val });
    renderFontPicker();
  });

  // Al elegir una fuente de la lista (p. ej. «Arial Bold») el peso se ajusta al de esa fuente; el
  // selector de peso decide después qué variante de la familia se usa
  async function syncWeightFromFont(file) {
    const info = file ? await window.api.getFontInfo(file) : null;
    if (!info?.ok) return;
    fontWeight = info.weight;
    const select = document.getElementById('wm-weight');
    if (select) select.value = String(Math.round(info.weight / 100) * 100);
    saveModuleConfig('watermark', { fontWeight });
    updatePreview();
  }

  function renderFontPicker() {
    buildFontPicker({
      pickerId: 'font-picker', fontSource, getFontWeight: () => fontWeight,
      systemFonts, gfCatalog,
      onFontPath: p => { fontPath = p; },
      onFontChosen: syncWeightFromFont,
      onFontsLoaded: f => { systemFonts.length = 0; systemFonts.push(...f); },
      onPreview: updatePreview,
    });
  }
  renderFontPicker();

  // ── Controles numéricos y sincronización ────────────────────────────────────
  const bindNum = (id, setter, key) => {
    document.getElementById(id)?.addEventListener('input', e => {
      const v = parseInt(e.target.value) || 0;
      setter(v);
      saveModuleConfig('watermark', { [key]: v });
      updatePreview();
    });
  };

  bindNum('wm-size',    v => { fontSize   = v; }, 'fontSize');
  bindNum('wm-opacity', v => { opacity    = v; }, 'opacity');
  bindNum('wm-gap-h',   v => { repeatGapH = v; }, 'repeatGapH');
  bindNum('wm-gap-v',   v => { repeatGapV = v; }, 'repeatGapV');

  document.getElementById('wm-weight').addEventListener('change', async e => {
    fontWeight = parseInt(e.target.value);
    saveModuleConfig('watermark', { fontWeight });
    const familyInput = document.getElementById('font-picker-gf-family');
    if (fontSource === 'google' && familyInput && familyInput.value.trim()) {
      document.getElementById('font-picker-gf-load').click();
    } else {
      updatePreview();
    }
  });

  // ── Color ───────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('color-row'), [
    { swatch: true, label: 'Rojo',  value: '#FF0000' },
    { swatch: true, label: 'Azul',  value: '#0A66C2' },
    { swatch: true, label: 'Negro', value: '#000000' },
    { swatch: true, label: 'Gris',  value: '#475569' },
  ], color, val => {
    color = val;
    document.getElementById('wm-color').value = val;
    saveModuleConfig('watermark', { color: val });
    updatePreview();
  });

  document.getElementById('wm-color').addEventListener('input', e => {
    color = e.target.value;
    saveModuleConfig('watermark', { color });
    updatePreview();
  });

  // ── Modo de repetición (Mosaico vs Palabra Única) ───────────────────────────
  optButtons(document.getElementById('repeat-row'), [
    { label: '⊙ Palabra única',   value: 'single' },
    { label: '⊞ Mosaico repetido', value: 'tile'   },
  ], repeatMode, val => {
    repeatMode = val;
    saveModuleConfig('watermark', { repeatMode: val });
    document.getElementById('repeat-gap-row').style.display = val === 'tile' ? 'block' : 'none';
    document.getElementById('position-group').style.display = val === 'tile' ? 'none'  : '';
    updatePreview();
  });

  document.getElementById('repeat-gap-row').style.display = repeatMode === 'tile' ? 'block' : 'none';
  document.getElementById('position-group').style.display = repeatMode === 'tile' ? 'none'  : '';

  // ── Posición (Solo para palabra única) ───────────────────────────────────────
  optButtons(document.getElementById('position-row'), [
    { label: '↖ Sup. Izq.',  value: 'top_left'     },
    { label: '↗ Sup. Der.',  value: 'top_right'    },
    { icon: 'crosshair', label: 'Centro',     value: 'center'       },
    { label: '↙ Inf. Izq.',  value: 'bottom_left'  },
    { label: '↘ Inf. Der.',  value: 'bottom_right' },
  ], position, val => {
    position = val;
    saveModuleConfig('watermark', { position: val });
    updatePreview();
  });

  // ── Archivos ────────────────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('wm-list', files, onRemove);
    updateRun();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'wm-path');
    const dups = picked.filter(f => files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderFileList('wm-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  // ── Selección de archivos y carpeta de salida ────────────────────────────────
  document.getElementById('pick-wm').addEventListener('click', async () => {
    const picked = await pickFiles(kind);
    addFiles(picked);
  });

  document.getElementById('clear-wm').addEventListener('click', () => {
    files = [];
    renderFileList('wm-list', files, onRemove);
    document.getElementById('wm-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('wm-pick').addEventListener('click', () =>
    pickOutputDir('wm-path').then(updateRun));
  bindDragDrop('zone-wm', FILE_KINDS[kind].extensions, addFiles);

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    updatePreview();   // Cambia el primer archivo de la lista: cambia la vista previa
    document.getElementById('run-wm').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-wm').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('wm-badge').textContent   = fileCountText(files.length, kind);
  }

  // ── Cancelación y ejecución ──────────────────────────────────────────────────
  document.getElementById('cancel-wm').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando marca de agua...');
  });

  document.getElementById('run-wm').addEventListener('click', async () => {
    if (!text.trim()) { notify.warning('Escribe el texto de la marca de agua.'); return; }
    setProcessing(true);
    const btn = document.getElementById('run-wm'), cancel = document.getElementById('cancel-wm');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('wm-result').innerHTML = '';

    const res = await runWithProgress('watermark', 'wm-progress', () => window.api.watermarkText({
      files, text, fontPath, fontSize, fontWeight, opacity, angle,
      position, color, repeatMode, repeatGapH, repeatGapV,
      outputDir: state.outputDir
    }));
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('wm-result').innerHTML =
      (ok.length  ? resultBox('success', `${ok.length} archivo(s) procesado(s)`, ok.map(r => `${icon('file',14)} ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`Marca de agua aplicada en ${ok.length} archivo(s).`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Aplicar marca de agua';
    cancel.style.display = 'none';
    updateRun();
  });

  requestAnimationFrame(updatePreview);
}