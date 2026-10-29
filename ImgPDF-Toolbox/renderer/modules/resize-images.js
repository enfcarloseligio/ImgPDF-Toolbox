// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/resize-images.js
// Descripción: Módulo «Redimensionar imágenes»: cambia el tamaño por píxeles exactos, por
//              porcentaje o limitando el lado mayor, manteniendo la proporción o libremente
//              (puede deformar). Muestra el resultado previsto para la primera imagen.
// ═════════════════════════════════════════════════════════════════════════════

async function renderResizeImages() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('resize-images', {
    mode: 'pixels', width: '', height: '', percent: 50, maxSide: 1920, keepRatio: true, noEnlarge: false, quality: 95,
  });
  let { mode, width, height, percent, maxSide, keepRatio, noEnlarge, quality } = cfg;
  let info = null;   // Información de la primera imagen (para el resumen)

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('resize',22)} Redimensionar imágenes</div>
    <p class="module-desc">Cambia el tamaño de tus imágenes por píxeles exactos, por porcentaje o limitando su lado mayor.</p>
    ${batchFilesHtml('rsz')}

    <div class="option-group wide">
      <label>Modo</label>
      <div class="option-row" id="rsz-mode"></div>
    </div>

    <div class="option-group wide" id="rsz-px-panel">
      <label>Tamaño en píxeles</label>
      <div class="field-row">
        <span class="field">Ancho <input type="number" class="num-input" id="rsz-w" min="1" max="30000" placeholder="auto"> px</span>
        <button class="btn-toggle" id="rsz-lock" type="button"></button>
        <span class="field">Alto <input type="number" class="num-input" id="rsz-h" min="1" max="30000" placeholder="auto"> px</span>
      </div>
      <label class="check-row"><input type="checkbox" id="rsz-noenlarge"> No ampliar (solo reducir imágenes más grandes)</label>
      <p class="option-hint" id="rsz-px-hint"></p>
    </div>

    <div class="option-group wide" id="rsz-pct-panel">
      <label>Porcentaje del tamaño original</label>
      <div class="field-row">
        <span class="field"><input type="number" class="num-input" id="rsz-pct" min="1" max="1000"> %</span>
        <div class="option-row" id="rsz-pct-quick"></div>
      </div>
    </div>

    <div class="option-group wide" id="rsz-max-panel">
      <label>Lado mayor máximo</label>
      <div class="field-row">
        <span class="field"><input type="number" class="num-input" id="rsz-max" min="1" max="30000"> px</span>
        <div class="option-row" id="rsz-max-quick"></div>
      </div>
      <p class="option-hint">Reduce las imágenes cuyo ancho o alto supere el límite, sin deformarlas. Las más pequeñas no se tocan.</p>
    </div>

    <div class="option-group">
      <label>Calidad de salida</label>
      <div class="option-row" id="rsz-q"></div>
      <p class="option-hint">Solo aplica a JPG, WebP y AVIF. PNG, TIFF y BMP no pierden calidad.</p>
    </div>

    <div class="summary-box" id="rsz-summary"></div>

    ${batchActionsHtml('rsz', 'Redimensionar imágenes')}
  </div>`;
  organizeModule(ws);

  // ── Utilidades ───────────────────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const save = patch => saveModuleConfig('resize-images', patch);
  const num = v => Math.max(0, parseInt(v, 10) || 0);

  // Tamaño resultante para una imagen (replica la lógica del proceso principal)
  function predictSize(iw, ih) {
    if (mode === 'percent') return { w: Math.round(iw * percent / 100), h: Math.round(ih * percent / 100) };
    if (mode === 'max') {
      const s = Math.min(1, maxSide / Math.max(iw, ih));
      return { w: Math.round(iw * s), h: Math.round(ih * s) };
    }
    const w = num(width), h = num(height);
    if (!keepRatio) {
      if (noEnlarge && iw <= w && ih <= h) return { w: iw, h: ih };
      return { w, h };
    }
    let s = w && h ? Math.min(w / iw, h / ih) : w ? w / iw : h ? h / ih : 1;
    if (noEnlarge) s = Math.min(s, 1);
    return { w: Math.round(iw * s), h: Math.round(ih * s) };
  }

  // ── Resumen y validación ─────────────────────────────────────────────────────
  function updateSummary() {
    const box = $('rsz-summary');
    if (!info || !info.ok) {
      box.innerHTML = '<strong>Resultado previsto:</strong><br>↳ Selecciona una imagen para calcular el tamaño final.';
      return;
    }
    const { w, h } = predictSize(info.width, info.height);
    box.innerHTML = `<strong>Resultado previsto (primera imagen):</strong><br>
      ↳ ${info.width} × ${info.height} px → <strong>${w || '?'} × ${h || '?'} px</strong>`;

    // En modo proporcional se sugiere el valor del campo vacío como marcador
    if (mode === 'pixels' && keepRatio) {
      $('rsz-w').placeholder = num(width)  ? 'auto' : (num(height) ? String(w) : 'auto');
      $('rsz-h').placeholder = num(height) ? 'auto' : (num(width)  ? String(h) : 'auto');
    }
  }

  const isValid = () => {
    if (mode === 'percent') return percent > 0 && percent <= 1000;
    if (mode === 'max')     return maxSide > 0;
    return keepRatio ? (num(width) > 0 || num(height) > 0) : (num(width) > 0 && num(height) > 0);
  };

  // ── Visibilidad según el modo y estado del candado ───────────────────────────
  function updateMode() {
    $('rsz-px-panel').style.display  = mode === 'pixels'  ? '' : 'none';
    $('rsz-pct-panel').style.display = mode === 'percent' ? '' : 'none';
    $('rsz-max-panel').style.display = mode === 'max'     ? '' : 'none';
    updateSummary();
    batch.sync();
  }

  function updateLock() {
    const lock = $('rsz-lock');
    lock.classList.toggle('active', keepRatio);
    lock.innerHTML = keepRatio ? iconLabel('link', 'Mantener proporción', 16) : iconLabel('unlink', 'Proporción libre', 16);
    lock.title = keepRatio ? 'La proporción se mantiene' : 'Puede deformar la imagen';
    $('rsz-px-hint').textContent = keepRatio
      ? 'Escribe solo el ancho o solo el alto para escalar proporcionalmente. Si escribes ambos, cada imagen se ajusta dentro de esa caja.'
      : 'Tamaño exacto: ancho y alto son obligatorios y la imagen puede deformarse.';
    updateSummary();
    batch.sync();
  }

  // ── Opciones de configuración ────────────────────────────────────────────────
  optButtons($('rsz-mode'), [
    { label: 'Por píxeles',     value: 'pixels'  },
    { label: 'Por porcentaje',  value: 'percent' },
    { label: 'Lado mayor',      value: 'max'     },
  ], mode, v => { mode = v; updateMode(); }, v => save({ mode: v }));

  $('rsz-w').value   = width;
  $('rsz-h').value   = height;
  $('rsz-pct').value = percent;
  $('rsz-max').value = maxSide;
  $('rsz-noenlarge').checked = noEnlarge;

  $('rsz-w').addEventListener('input', e => { width = e.target.value; save({ width }); updateSummary(); batch.sync(); });
  $('rsz-h').addEventListener('input', e => { height = e.target.value; save({ height }); updateSummary(); batch.sync(); });
  $('rsz-lock').addEventListener('click', () => { keepRatio = !keepRatio; save({ keepRatio }); updateLock(); });
  $('rsz-noenlarge').addEventListener('change', e => { noEnlarge = e.target.checked; save({ noEnlarge }); updateSummary(); });

  // Entradas con valores rápidos (porcentaje y lado mayor)
  function quickValues(rowId, inputId, values, suffix, onSet) {
    optButtons($(rowId), values.map(v => ({ label: `${v}${suffix}`, value: v })), null, v => {
      $(inputId).value = v;
      onSet(v);
    });
  }
  quickValues('rsz-pct-quick', 'rsz-pct', [25, 50, 75, 150, 200], ' %', v => { percent = v; save({ percent }); updateSummary(); batch.sync(); });
  quickValues('rsz-max-quick', 'rsz-max', [1080, 1280, 1920, 2560, 4096], ' px', v => { maxSide = v; save({ maxSide }); updateSummary(); batch.sync(); });
  $('rsz-pct').addEventListener('input', e => { percent = num(e.target.value); save({ percent }); updateSummary(); batch.sync(); });
  $('rsz-max').addEventListener('input', e => { maxSide = num(e.target.value); save({ maxSide }); updateSummary(); batch.sync(); });

  optButtons($('rsz-q'), [
    { label: '100 — Máxima',  value: 100 },
    { label: '95 — Alta',     value: 95  },
    { label: '85 — Estándar', value: 85  },
  ], quality, v => { quality = v; }, v => save({ quality: v }));

  // ── Lista de archivos, ejecución y resultados ────────────────────────────────
  const batch = setupBatchTool('rsz', {
    moduleId: 'resize-images',
    runLabel: 'Redimensionar imágenes',
    busyLabel: 'Redimensionando...',
    doneVerb: 'redimensionada(s)',
    canRun: isValid,
    // Al cambiar la lista se consulta el tamaño de la primera imagen para el resumen
    onChange: async files => {
      info = files.length ? await window.api.getImageInfo(files[0]) : null;
      updateSummary();
    },
    run: (files, outputDir) => window.api.resizeImages({
      files, mode, width: num(width), height: num(height), percent, keepRatio, noEnlarge, maxSide, quality, outputDir,
    }),
  });

  updateLock();
  updateMode();
}
