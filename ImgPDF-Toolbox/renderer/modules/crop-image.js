// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/crop-image.js
// Descripción: Módulo «Recortar imagen»: recorte libre con un recuadro que se mueve y
//              redimensiona, o con proporciones estándar (1:1, 5:4, 4:3, 3:2, 16:9 y sus
//              versiones verticales), valores numéricos exactos y salida con la calidad
//              original o comprimida.
// ═════════════════════════════════════════════════════════════════════════════

async function renderCropImage() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('crop-image', { quality: 'original', level: 'balanced', format: 'same', strip: false });
  let { quality, level, format, strip } = cfg;

  let file = null;          // Imagen cargada
  let portrait = false;     // Orientación de las proporciones: horizontal por defecto
  let presetKey = 'free';   // free | original | 1:1 | 5:4 | 4:3 | 3:2 | 16:9 | custom

  // Proporciones estándar: [ancho, alto] en horizontal; en vertical se invierten (4:5, 3:4, 2:3, 9:16)
  const PRESETS = [[1, 1], [5, 4], [4, 3], [3, 2], [16, 9]];

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module module-crop">
    <div class="module-title">${icon('crop',22)} Recortar imagen</div>
    <p class="module-desc">Arrastra el recuadro o sus asas para elegir la zona, o escribe los valores exactos. Elige una proporción para mantenerla al redimensionar.</p>
    ${fileZoneHtml({ zone: 'zone-crop', pick: 'pick-crop', clear: 'clear-crop', badge: 'crop-badge', list: 'crop-list', kind: 'imageAny', multiple: false })}
    ${outputDirRow('crop')}

    <div class="option-group wide">
      <label>Proporción</label>
      <div class="option-row" id="crop-ratio"></div>
      <div class="field-row crop-custom" id="crop-custom" style="display:none">
        <span class="field">Personalizada <input type="number" class="num-input" id="crop-rw" min="1" value="3"> :
          <input type="number" class="num-input" id="crop-rh" min="1" value="2"></span>
      </div>
      <button class="btn-toggle" id="crop-orient" type="button" title="Alterna proporciones horizontales y verticales" style="align-self:flex-start">${iconLabel('rotate-box', 'Girar orientación', 16)}</button>
    </div>

    <div class="option-group wide">
      <label>Posición y tamaño (px)</label>
      <div class="field-row">
        <span class="field">X <input type="number" class="num-input" id="crop-x" min="0"></span>
        <span class="field">Y <input type="number" class="num-input" id="crop-y" min="0"></span>
        <span class="field">Ancho <input type="number" class="num-input" id="crop-w" min="1"></span>
        <span class="field">Alto <input type="number" class="num-input" id="crop-h" min="1"></span>
      </div>
      <div class="option-row">
        <button class="btn-toggle" id="crop-center" type="button">Centrar</button>
        <button class="btn-toggle" id="crop-max" type="button">Máximo</button>
      </div>
    </div>

    <div class="option-group">
      <label>Calidad de salida</label>
      <div class="option-row" id="crop-quality"></div>
      <p class="option-hint" id="crop-q-hint"></p>
    </div>
    <div class="option-group" id="crop-level-group">
      <label>Nivel de compresión</label>
      <div class="option-row" id="crop-level"></div>
    </div>
    <div class="option-group">
      <label>Formato de salida</label>
      <div class="option-row" id="crop-format"></div>
    </div>
    <div class="option-group">
      <label>Metadatos</label>
      <label class="check-row"><input type="checkbox" id="crop-strip"> Quitar metadatos (EXIF, ubicación GPS)</label>
    </div>

    <div class="option-group" data-step="preview" data-step-title="Recorte">
      <label>Recorte</label>
      <div class="crop-stage" id="crop-stage"></div>
      <p class="option-hint" id="crop-info">Arrastra sobre la imagen para dibujar un recuadro nuevo.</p>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="run-crop" disabled style="width:auto">Recortar imagen</button>
    </div>
    <div class="progress-panel" id="crop-progress"></div>
    <div id="crop-result"></div>
  </div>`;
  organizeModule(ws);

  const $ = id => document.getElementById(id);
  const save = patch => saveModuleConfig('crop-image', patch);

  // ── Editor y sincronización con los campos ───────────────────────────────────
  const editor = createCropEditor($('crop-stage'), (r, ratio) => {
    // No se reescribe el campo que el usuario está editando para no mover el cursor
    const fields = { 'crop-x': r.x, 'crop-y': r.y, 'crop-w': r.w, 'crop-h': r.h };
    Object.entries(fields).forEach(([id, v]) => { if (document.activeElement !== $(id)) $(id).value = v; });

    const size = editor.getSize();
    $('crop-info').textContent = size.width
      ? `Imagen: ${size.width} × ${size.height} px · Recorte: ${r.w} × ${r.h} px${ratio ? ` · proporción ${ratioLabel(ratio)}` : ''}`
      : 'Arrastra sobre la imagen para dibujar un recuadro nuevo.';
  });

  // Texto de una proporción: «16:9» si coincide con una estándar, o decimal en caso contrario
  function ratioLabel(r) {
    for (const [a, b] of PRESETS) {
      if (Math.abs(r - a / b) < 0.002) return `${a}:${b}`;
      if (Math.abs(r - b / a) < 0.002) return `${b}:${a}`;
    }
    return r.toFixed(2);
  }

  // ── Proporciones y orientación ───────────────────────────────────────────────
  // Valor numérico (ancho/alto) del preajuste actual, según la orientación elegida
  function presetRatio(key) {
    if (key === 'free') return null;
    if (key === 'original') return editor.hasImage() ? editor.getSize().width / editor.getSize().height : null;
    if (key === 'custom') {
      const w = parseFloat($('crop-rw').value), h = parseFloat($('crop-rh').value);
      return w > 0 && h > 0 ? w / h : null;
    }
    const [a, b] = key.split(':').map(Number);
    return portrait ? b / a : a / b;
  }

  function renderRatioButtons() {
    const items = [
      { label: 'Libre', value: 'free' },
      { label: 'Original', value: 'original' },
      ...PRESETS.map(([a, b]) => ({ label: portrait && a !== b ? `${b}:${a}` : `${a}:${b}`, value: `${a}:${b}` })),
      { label: 'Personalizada', value: 'custom' },
    ];
    optButtons($('crop-ratio'), items, presetKey, v => {
      presetKey = v;
      $('crop-custom').style.display = v === 'custom' ? '' : 'none';
      editor.setRatio(presetRatio(v));
    });
  }

  // Al girar la orientación el editor invierte la proporción vigente y se rehacen las etiquetas
  $('crop-orient').addEventListener('click', () => {
    portrait = !portrait;
    $('crop-orient').classList.toggle('active', portrait);
    editor.swapOrientation();
    renderRatioButtons();
  });

  ['crop-rw', 'crop-rh'].forEach(id => $(id).addEventListener('input', () => {
    if (presetKey === 'custom') editor.setRatio(presetRatio('custom'));
  }));

  renderRatioButtons();

  // ── Campos numéricos y atajos del recuadro ───────────────────────────────────
  [['crop-x', 'x'], ['crop-y', 'y'], ['crop-w', 'w'], ['crop-h', 'h']].forEach(([id, key]) => {
    $(id).addEventListener('input', e => {
      const v = parseInt(e.target.value, 10);
      if (!isNaN(v)) editor.setRect({ [key]: v });
    });
  });
  $('crop-center').addEventListener('click', () => editor.center());
  $('crop-max').addEventListener('click', () => editor.maximize());

  // ── Opciones de salida ───────────────────────────────────────────────────────
  const updateQuality = () => {
    $('crop-level-group').style.display = quality === 'compress' ? '' : 'none';
    $('crop-q-hint').textContent = quality === 'original'
      ? 'Conserva la calidad original: PNG y TIFF sin pérdida; JPG y WebP con calidad máxima.'
      : 'Reduce el peso con pérdida de calidad según el nivel elegido.';
  };

  optButtons($('crop-quality'), [
    { label: 'Original (sin pérdida)', value: 'original' },
    { label: 'Comprimir',              value: 'compress' },
  ], quality, v => { quality = v; updateQuality(); }, v => save({ quality: v }));

  optButtons($('crop-level'), [
    { label: 'Alta calidad',      value: 'high'     },
    { label: 'Equilibrada',       value: 'balanced' },
    { label: 'Máxima compresión', value: 'max'      },
  ], level, v => { level = v; }, v => save({ level: v }));

  optButtons($('crop-format'), [
    { label: 'Igual que el original', value: 'same' },
    { label: 'PNG',  value: 'png'  },
    { label: 'JPG',  value: 'jpg'  },
    { label: 'WebP', value: 'webp' },
  ], format, v => { format = v; }, v => save({ format: v }));

  $('crop-strip').checked = strip;
  $('crop-strip').addEventListener('change', e => { strip = e.target.checked; save({ strip }); });
  updateQuality();

  // ── Carga de la imagen ───────────────────────────────────────────────────────
  function updateRun() {
    $('run-crop').disabled = !(file && editor.hasImage() && state.outputDir && !state.isProcessing);
    $('clear-crop').style.display = file ? 'inline-block' : 'none';
    $('crop-badge').textContent   = fileCountText(file ? 1 : 0, 'imageAny');
  }

  async function loadImage(path) {
    const preview = await window.api.getImagePreview(path);
    if (!preview.ok) { notify.error('No se pudo abrir la imagen. Comprueba que el formato sea compatible.'); return; }

    file = path;
    await checkDefaultOutputDir(path, 'crop-path');
    $('crop-list').innerHTML = `<div class="file-item">
      <span class="file-name" title="${path}">${icon('file', 14)} ${basename(path)}</span>
      <button class="file-remove" id="rm-crop" title="Quitar">${icon('close', 14)}</button></div>`;
    $('rm-crop').addEventListener('click', reset);
    $('crop-result').innerHTML = '';

    editor.load(toFileUrl(preview.path), preview.width, preview.height);
    // La proporción «Original» depende de la imagen cargada
    if (presetKey === 'original') editor.setRatio(presetRatio('original'));
    updateRun();
  }

  function reset() {
    file = null;
    editor.clear();
    $('crop-list').innerHTML = fileEmptyHtml('imageAny');
    $('crop-result').innerHTML = '';
    ['crop-x', 'crop-y', 'crop-w', 'crop-h'].forEach(id => { $(id).value = ''; });
    $('crop-info').textContent = 'Arrastra sobre la imagen para dibujar un recuadro nuevo.';
    updateRun();
  }

  // ── Selección de archivo, arrastre y carpeta de salida ───────────────────────
  const pickImage = async () => { const p = await pickFiles('imageAny'); if (p.length) loadImage(p[0]); };
  $('pick-crop').addEventListener('click', pickImage);
  $('clear-crop').addEventListener('click', reset);
  $('crop-pick').addEventListener('click', () => pickOutputDir('crop-path').then(updateRun));

  const onDropFiles = paths => {
    if (paths.length > 1) notify.info('Se recorta una imagen a la vez: se abrió la primera.');
    loadImage(paths[0]);
  };
  bindDragDrop('zone-crop', FILE_KINDS.imageAny.extensions, onDropFiles);
  bindDragDrop('crop-stage', FILE_KINDS.imageAny.extensions, onDropFiles);

  // ── Ejecución ────────────────────────────────────────────────────────────────
  $('run-crop').addEventListener('click', async () => {
    const btn = $('run-crop'), r = editor.getRect();
    setProcessing(true);
    btn.disabled = true; btn.textContent = 'Recortando...';
    $('crop-result').innerHTML = '';

    const res = await runWithProgress('crop-image', 'crop-progress', () => window.api.cropImage({
      file, x: r.x, y: r.y, width: r.w, height: r.h, format, quality, level, strip, outputDir: state.outputDir,
    }));
    window.api.playBeep();

    if (res.ok) {
      $('crop-result').innerHTML = resultBox('success', 'Imagen recortada', [batchResultLine(res)], true);
      notify.success('Imagen recortada correctamente.');
    } else {
      $('crop-result').innerHTML = resultBox('error', 'No se pudo recortar', [String(res.error)]);
      notify.error('No se pudo recortar la imagen.');
    }

    setProcessing(false);
    btn.textContent = 'Recortar imagen';
    updateRun();
  });
}
