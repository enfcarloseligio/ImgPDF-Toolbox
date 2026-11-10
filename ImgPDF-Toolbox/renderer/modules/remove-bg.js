// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/remove-bg.js
// Descripción: Módulo «Quitar fondo»: vuelve transparente el fondo de color uniforme de una
//              imagen, rellenando desde los bordes o eliminando los colores en toda la
//              imagen. Admite varios colores de fondo (con gotero o selector HEX/RGB/HSL),
//              tolerancia ajustable, vista previa en vivo con zoom y un pincel para
//              restaurar o borrar a mano lo que el color no resolvió. Guarda un PNG.
// ═════════════════════════════════════════════════════════════════════════════

async function renderRemoveBg() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('remove-bg', { method: 'edges', fuzz: 12, feather: true, brush: 10 });
  let { method, fuzz, feather, brush } = cfg;
  let colors = [];            // Colores de fondo elegidos (#rrggbb); vacío = esquina superior izquierda
  let autoColors = [];        // Colores que usó la última vista previa cuando no hay ninguno elegido
  let strokes = [];           // Retoque: [{ mode: 'restore' | 'erase', size, points }] en fracciones (0–1)
  let overlayFrom = 0;        // Trazos ya incluidos en la vista previa mostrada
  let tool = 'eyedrop';       // Herramienta sobre la vista previa: 'eyedrop' | 'restore' | 'erase'
  let info = null;            // Tamaño de la primera imagen (para convertir el clic en píxel)
  let firstFile = null;       // Primera imagen de la lista (la que se previsualiza y retoca)

  const MAX_COLORS = 12;
  const MAX_STROKE_POINTS = 1700;

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
    <div class="option-group wide">
      <label>Colores de fondo</label>
      <div class="rbg-chips" id="rbg-chips"></div>
      <p class="option-hint" id="rbg-color-hint"></p>
      <div class="rbg-add">
        <div id="rbg-cf"></div>
        <button class="btn-secondary btn-sm" id="rbg-add-color" type="button">${iconLabel('check', 'Agregar este color', 14)}</button>
      </div>
      <p class="option-hint">Elige el color con el selector o escríbelo (HEX, RGB o HSL), o usa el gotero sobre la vista previa. Con dos tonos de fondo, agrega ambos en lugar de subir la tolerancia.</p>
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

    <div class="option-group wide" data-step="preview" data-step-title="Vista previa del resultado">
      <label>Vista previa</label>
      <div class="option-row" id="rbg-tool"></div>
      <div class="rbg-brushbar" id="rbg-brushbar" hidden>
        <label class="rbg-brushsize">Tamaño del pincel
          <input type="range" id="rbg-brush" min="1" max="40" step="1">
        </label>
        <button class="btn-toggle" id="rbg-undo" type="button" title="Deshace el último trazo">Deshacer trazo</button>
        <button class="btn-toggle" id="rbg-clear" type="button" title="Quita todo el retoque a mano">Limpiar retoque</button>
      </div>
      <div class="rbg-stage" id="rbg-stage">
        <span class="rbg-empty" id="rbg-empty">Selecciona una imagen para ver el resultado</span>
        <div class="rbg-canvas" id="rbg-canvas" hidden>
          <img id="rbg-img" alt="">
          <canvas id="rbg-overlay"></canvas>
        </div>
      </div>
      <p class="option-hint" id="rbg-preview-hint"></p>
    </div>

    ${batchActionsHtml('rbg', 'Quitar fondo')}
  </div>`;
  organizeModule(ws);

  const $ = id => document.getElementById(id);
  const save = patch => saveModuleConfig('remove-bg', patch);
  attachImageZoom($('rbg-stage'), $('rbg-img'));
  const colorField = createColorField($('rbg-cf'), { value: '#2563eb' });

  // ── Vista previa en vivo ─────────────────────────────────────────────────────
  let previewSeq = 0;
  let timer = null;

  async function refreshPreview() {
    const img = $('rbg-img'), empty = $('rbg-empty'), canvas = $('rbg-canvas');
    if (!firstFile) { canvas.hidden = true; empty.hidden = false; return; }

    const seq = ++previewSeq;
    const snapshot = strokes.length;
    $('rbg-stage').classList.add('is-loading');
    const res = await window.api.removeBackgroundPreview({ file: firstFile, colors, fuzz, method, feather, strokes });
    if (seq !== previewSeq) return;       // llegó una petición más reciente
    $('rbg-stage').classList.remove('is-loading');

    if (!res.ok) { notify.error(res.error || 'No se pudo generar la vista previa.'); return; }
    autoColors = colors.length ? [] : res.colors;
    updateColorHint();
    img.src = toFileUrl(res.path);
    canvas.hidden = false; empty.hidden = true;
    overlayFrom = snapshot;      // El retoque ya forma parte de la imagen mostrada
    drawOverlay();
  }

  // Los cambios de configuración repintan la vista previa tras una breve pausa
  const schedulePreview = (delayMs = 300) => { clearTimeout(timer); timer = setTimeout(refreshPreview, delayMs); };

  // ── Colores de fondo ─────────────────────────────────────────────────────────
  function renderChips() {
    $('rbg-chips').innerHTML = colors.map((c, i) => `<span class="rbg-chip">
      <button class="rbg-chip-main" type="button" data-edit="${i}" title="Cargar en el selector">
        <span class="rbg-swatch" style="background:${c}"></span><code>${c.toUpperCase()}</code></button>
      <button class="rbg-chip-x" type="button" data-remove="${i}" title="Quitar este color">${icon('close', 12)}</button>
    </span>`).join('');
    $('rbg-chips').querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => {
      colors.splice(Number(b.dataset.remove), 1);
      renderChips(); updateColorHint(); schedulePreview(100);
    }));
    $('rbg-chips').querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => colorField.setValue(colors[Number(b.dataset.edit)])));
  }

  function updateColorHint() {
    const auto = autoColors.map(c => `<span class="rbg-swatch" style="background:${c}"></span><code>${c.toUpperCase()}</code>`).join(' ');
    $('rbg-color-hint').innerHTML = colors.length
      ? `Se quitan ${colors.length === 1 ? 'el color indicado' : `los ${colors.length} colores indicados`}, cada uno con la tolerancia de abajo.`
      : `Sin colores elegidos: se usa el de la esquina superior izquierda ${auto}`;
  }

  function addColor(hex) {
    hex = hex.toLowerCase();
    if (colors.includes(hex)) { notify.info('Ese color ya está en la lista.'); return; }
    if (colors.length >= MAX_COLORS) { notify.warning(`Máximo ${MAX_COLORS} colores.`); return; }
    colors.push(hex);
    renderChips(); updateColorHint(); schedulePreview(100);
  }

  $('rbg-add-color').addEventListener('click', () => addColor(colorField.getValue()));

  // ── Gotero: toma el color de ese punto de la imagen original ─────────────────
  $('rbg-img').addEventListener('click', async e => {
    if (tool !== 'eyedrop' || !info?.ok || !firstFile) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * info.width;
    const y = (e.clientY - r.top)  / r.height * info.height;
    const res = await window.api.getImagePixel({ file: firstFile, x, y });
    if (res.ok) { colorField.setValue(res.color); addColor(res.color); }
  });

  // ── Pincel de retoque (restaurar o borrar a mano) ────────────────────────────
  const overlay = $('rbg-overlay');
  const BRUSH_COLORS = { restore: 'rgba(22, 163, 74, 0.55)', erase: 'rgba(220, 38, 38, 0.55)' };
  const brushFraction = () => brush / 400;      // Diámetro del pincel como fracción del ancho
  let current = null;                           // Trazo en curso
  let hover = null;                             // Posición del puntero (fracciones) para el aro del pincel

  function drawOverlay() {
    const w = overlay.clientWidth, h = overlay.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    overlay.width = Math.round(w * dpr); overlay.height = Math.round(h * dpr);
    const g = overlay.getContext('2d');
    g.scale(dpr, dpr);
    g.lineCap = g.lineJoin = 'round';

    const paint = s => {
      g.strokeStyle = BRUSH_COLORS[s.mode];
      g.lineWidth = Math.max(1, s.size * w);
      g.beginPath();
      s.points.forEach(([x, y], i) => (i ? g.lineTo(x * w, y * h) : g.moveTo(x * w, y * h)));
      if (s.points.length === 1) g.lineTo(s.points[0][0] * w + 0.01, s.points[0][1] * h);
      g.stroke();
    };
    strokes.slice(overlayFrom).forEach(paint);
    if (current) paint(current);

    // Aro con el tamaño real del pincel
    if (hover && tool !== 'eyedrop' && !current) {
      g.strokeStyle = '#ffffff'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(hover[0] * w, hover[1] * h, brushFraction() * w / 2, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#0f172a'; g.lineWidth = 0.75; g.stroke();
    }
  }
  new ResizeObserver(drawOverlay).observe($('rbg-img'));

  const pointOf = e => {
    const r = overlay.getBoundingClientRect();
    return [Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1)];
  };
  const totalPoints = () => strokes.reduce((n, s) => n + s.points.length, 0);

  overlay.addEventListener('pointerdown', e => {
    if (tool === 'eyedrop' || e.button !== 0 || !firstFile) return;
    if (totalPoints() >= MAX_STROKE_POINTS) { notify.warning('Hay demasiado retoque acumulado. Deshaz trazos o limpia el retoque.'); return; }
    e.preventDefault();
    overlay.setPointerCapture(e.pointerId);
    current = { mode: tool, size: brushFraction(), points: [pointOf(e)] };
    drawOverlay();
  });

  overlay.addEventListener('pointermove', e => {
    hover = pointOf(e);
    if (current) {
      const p = pointOf(e), last = current.points[current.points.length - 1];
      // Se descartan los puntos casi iguales para mantener los trazos ligeros
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) >= 0.003 && totalPoints() + current.points.length < MAX_STROKE_POINTS) current.points.push(p);
    }
    drawOverlay();
  });

  const endStroke = () => {
    if (!current) return;
    strokes.push(current);
    current = null;
    syncBrushBar();
    schedulePreview(60);
  };
  overlay.addEventListener('pointerup', endStroke);
  overlay.addEventListener('pointercancel', endStroke);
  overlay.addEventListener('pointerleave', () => { hover = null; if (!current) drawOverlay(); });

  function syncBrushBar() {
    $('rbg-undo').disabled = $('rbg-clear').disabled = strokes.length === 0;
  }
  $('rbg-undo').addEventListener('click', () => { strokes.pop(); syncBrushBar(); schedulePreview(60); });
  $('rbg-clear').addEventListener('click', () => { strokes = []; overlayFrom = 0; syncBrushBar(); schedulePreview(60); });

  const brushRange = $('rbg-brush');
  brushRange.value = brush;
  brushRange.addEventListener('input', e => { brush = parseInt(e.target.value, 10) || 10; save({ brush }); drawOverlay(); });

  // ── Herramienta sobre la vista previa ────────────────────────────────────────
  const TOOL_HINTS = {
    eyedrop: 'Gotero: haz clic en la vista previa sobre un color de fondo para agregarlo a la lista.',
    restore: 'Pincel verde: pinta sobre lo que se borró de más para recuperarlo de la imagen original.',
    erase:   'Pincel rojo: pinta sobre lo que quedó de fondo para borrarlo.',
  };
  const applyTool = v => {
    tool = v;
    $('rbg-brushbar').hidden = v === 'eyedrop';
    overlay.style.pointerEvents = v === 'eyedrop' ? 'none' : 'auto';
    $('rbg-img').style.cursor = v === 'eyedrop' ? 'crosshair' : 'default';
    overlay.style.cursor = 'none';
    $('rbg-preview-hint').textContent = `${TOOL_HINTS[v]} El retoque a mano se aplica solo a la primera imagen de la lista.`;
    drawOverlay();
  };
  optButtons($('rbg-tool'), [
    { label: 'Gotero',            value: 'eyedrop' },
    { label: 'Pincel: restaurar', value: 'restore' },
    { label: 'Pincel: borrar',    value: 'erase'   },
  ], tool, applyTool);
  applyTool(tool);
  syncBrushBar();

  // ── Opciones de configuración ────────────────────────────────────────────────
  const METHOD_HINTS = {
    edges:  'Quita solo el fondo conectado con los bordes: respeta zonas del mismo color dentro del objeto.',
    global: 'Quita esos colores en toda la imagen, también dentro del objeto (útil para huecos y detalles).',
  };

  optButtons($('rbg-method'), [
    { label: 'Desde los bordes', value: 'edges'  },
    { label: 'Todo el color',    value: 'global' },
  ], method, v => { method = v; $('rbg-method-hint').textContent = METHOD_HINTS[v]; schedulePreview(); }, v => save({ method: v }));
  $('rbg-method-hint').textContent = METHOD_HINTS[method];

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

  renderChips();
  updateColorHint();

  // ── Lista de archivos, ejecución y resultados ────────────────────────────────
  const batch = setupBatchTool('rbg', {
    moduleId: 'remove-background',
    runLabel: 'Quitar fondo',
    busyLabel: 'Procesando...',
    doneVerb: 'procesada(s)',
    // Al cambiar la primera imagen se reinician los colores y el retoque; si solo se agregan
    // o quitan otras, se conserva el trabajo en curso
    onChange: async files => {
      const first = files[0] || null;
      if (first !== firstFile) {
        firstFile = first;
        info = first ? await window.api.getImageInfo(first) : null;
        colors = []; autoColors = []; strokes = []; overlayFrom = 0;
        renderChips(); updateColorHint(); syncBrushBar();
        refreshPreview();
      }
    },
    run: (files, outputDir) => window.api.removeBackground({ files, colors, fuzz, method, feather, strokes, outputDir }),
  });
}
