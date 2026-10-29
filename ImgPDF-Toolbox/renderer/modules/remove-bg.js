// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/remove-bg.js
// Descripción: Módulo «Quitar fondo»: vuelve transparente el fondo de color uniforme de una
//              imagen, rellenando desde los bordes o eliminando el color en toda la imagen,
//              con tolerancia ajustable, gotero y vista previa en vivo. Guarda un PNG.
// ═════════════════════════════════════════════════════════════════════════════

async function renderRemoveBg() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('remove-bg', { method: 'edges', colorMode: 'auto', fuzz: 12, feather: true });
  let { method, colorMode, fuzz, feather } = cfg;
  let pickedColor = null;     // Color elegido con el gotero (cadena de ImageMagick)
  let info = null;            // Tamaño de la primera imagen (para convertir el clic en píxel)

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('wand',22)} Quitar fondo</div>
    <p class="module-desc">Vuelve transparente el fondo de color uniforme. Funciona muy bien con fondos lisos (blanco, estudio, pantalla verde); no recorta siluetas sobre fondos complejos.</p>
    ${batchFilesHtml('rbg')}

    <div class="option-group wide">
      <label>Método</label>
      <div class="option-row" id="rbg-method"></div>
      <p class="option-hint" id="rbg-method-hint"></p>
    </div>
    <div class="option-group">
      <label>Color de fondo</label>
      <div class="option-row" id="rbg-color"></div>
      <p class="option-hint" id="rbg-color-hint"></p>
    </div>
    <div class="option-group">
      <label>Tolerancia</label>
      <div class="field-row">
        <input type="range" id="rbg-fuzz" min="0" max="60" step="1">
        <span class="field"><input type="number" class="num-input" id="rbg-fuzz-num" min="0" max="60"> %</span>
      </div>
      <p class="option-hint">Cuanto mayor, más tonos parecidos al fondo se eliminan.</p>
    </div>
    <div class="option-group">
      <label>Bordes</label>
      <label class="check-row"><input type="checkbox" id="rbg-feather"> Suavizar el borde de la transparencia</label>
    </div>

    <div class="option-group" data-step="preview" data-step-title="Vista previa del resultado">
      <label>Vista previa</label>
      <div class="rbg-stage" id="rbg-stage">
        <span class="rbg-empty" id="rbg-empty">Selecciona una imagen para ver el resultado</span>
        <img id="rbg-img" alt="" hidden>
      </div>
      <p class="option-hint" id="rbg-preview-hint">Se muestra la primera imagen de la lista.</p>
    </div>

    ${batchActionsHtml('rbg', 'Quitar fondo')}
  </div>`;
  organizeModule(ws);

  const $ = id => document.getElementById(id);
  const save = patch => saveModuleConfig('remove-bg', patch);

  // ── Vista previa en vivo ─────────────────────────────────────────────────────
  let previewSeq = 0;
  let timer = null;

  async function refreshPreview() {
    const first = batch.getFiles()[0];
    const img = $('rbg-img'), empty = $('rbg-empty');
    if (!first) { img.hidden = true; empty.hidden = false; return; }

    const seq = ++previewSeq;
    $('rbg-stage').classList.add('is-loading');
    const res = await window.api.removeBackgroundPreview({
      file: first, color: colorMode === 'pick' && pickedColor ? pickedColor : 'auto', fuzz, method, feather,
    });
    if (seq !== previewSeq) return;       // llegó una petición más reciente
    $('rbg-stage').classList.remove('is-loading');

    if (!res.ok) { notify.error('No se pudo generar la vista previa.'); return; }
    img.src = toFileUrl(res.path);
    img.hidden = false; empty.hidden = true;
  }

  // Los cambios de configuración repintan la vista previa tras una breve pausa
  const schedulePreview = () => { clearTimeout(timer); timer = setTimeout(refreshPreview, 300); };

  // Gotero: el clic sobre la vista previa toma el color de ese punto en la imagen original
  $('rbg-img').addEventListener('click', async e => {
    if (colorMode !== 'pick' || !info?.ok) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * info.width;
    const y = (e.clientY - r.top)  / r.height * info.height;
    const res = await window.api.getImagePixel({ file: batch.getFiles()[0], x, y });
    if (res.ok) {
      pickedColor = res.color;
      updateColorHint();
      schedulePreview();
    }
  });

  // ── Opciones de configuración ────────────────────────────────────────────────
  const METHOD_HINTS = {
    edges:  'Quita solo el fondo conectado con los bordes: respeta zonas del mismo color dentro del objeto.',
    global: 'Quita ese color en toda la imagen, también dentro del objeto (útil para huecos y detalles).',
  };

  function updateColorHint() {
    $('rbg-color-hint').textContent = colorMode === 'auto'
      ? 'Se toma el color de la esquina superior izquierda.'
      : pickedColor ? `Color elegido: ${pickedColor}. Haz clic en otro punto de la vista previa para cambiarlo.`
                    : 'Haz clic en la vista previa sobre el color que quieres quitar.';
    $('rbg-img').style.cursor = colorMode === 'pick' ? 'crosshair' : 'default';
  }

  optButtons($('rbg-method'), [
    { label: 'Desde los bordes', value: 'edges'  },
    { label: 'Todo el color',    value: 'global' },
  ], method, v => { method = v; $('rbg-method-hint').textContent = METHOD_HINTS[v]; schedulePreview(); }, v => save({ method: v }));
  $('rbg-method-hint').textContent = METHOD_HINTS[method];

  optButtons($('rbg-color'), [
    { label: 'Automático (esquina)', value: 'auto' },
    { label: 'Elegir con el gotero', value: 'pick' },
  ], colorMode, v => { colorMode = v; updateColorHint(); schedulePreview(); }, v => save({ colorMode: v }));
  updateColorHint();

  const range = $('rbg-fuzz'), number = $('rbg-fuzz-num');
  range.value = number.value = fuzz;
  const setFuzz = v => {
    fuzz = Math.max(0, Math.min(60, parseInt(v, 10) || 0));
    range.value = number.value = fuzz;
    save({ fuzz });
    schedulePreview();
  };
  range.addEventListener('input',  e => setFuzz(e.target.value));
  number.addEventListener('input', e => setFuzz(e.target.value));

  $('rbg-feather').checked = feather;
  $('rbg-feather').addEventListener('change', e => { feather = e.target.checked; save({ feather }); schedulePreview(); });

  // ── Lista de archivos, ejecución y resultados ────────────────────────────────
  const batch = setupBatchTool('rbg', {
    moduleId: 'remove-background',
    runLabel: 'Quitar fondo',
    busyLabel: 'Procesando...',
    doneVerb: 'procesada(s)',
    // Al cambiar la lista se actualiza la información de la primera imagen y la vista previa
    onChange: async files => {
      info = files.length ? await window.api.getImageInfo(files[0]) : null;
      pickedColor = null;
      updateColorHint();
      refreshPreview();
    },
    run: (files, outputDir) => window.api.removeBackground({
      files, color: colorMode === 'pick' && pickedColor ? pickedColor : 'auto', fuzz, method, feather, outputDir,
    }),
  });
}
