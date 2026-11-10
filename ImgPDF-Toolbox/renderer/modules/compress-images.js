// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/compress-images.js
// Descripción: Módulo «Comprimir imágenes»: reduce el peso de las imágenes con tres niveles
//              de compresión, conversión opcional a WebP o JPG, límite de tamaño y limpieza
//              de metadatos. Omite las imágenes que no se pueden reducir más.
// ═════════════════════════════════════════════════════════════════════════════

async function renderCompressImages() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('compress-images', { level: 'balanced', format: 'same', maxSide: 0, strip: true });
  let { level, format, maxSide, strip } = cfg;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('compress',22)} Comprimir imágenes</div>
    <p class="module-desc">Reduce el peso de tus imágenes sin tocar los originales. Si una imagen ya está optimizada, se omite.</p>
    ${batchFilesHtml('cmi')}

    <div class="option-group wide">
      <label>Nivel de compresión</label>
      <div class="option-row" id="cmi-level"></div>
    </div>
    <div class="option-group">
      <label>Formato de salida</label>
      <div class="option-row" id="cmi-format"></div>
      <p class="option-hint">WebP suele pesar mucho menos que JPG y PNG con la misma calidad visual.</p>
    </div>
    <div class="option-group">
      <label>Limitar lado mayor</label>
      <div class="option-row" id="cmi-max"></div>
      <p class="option-hint">Reduce las imágenes más grandes que el límite; nunca las amplía.</p>
    </div>
    <div class="option-group">
      <label>Metadatos</label>
      <label class="check-row"><input type="checkbox" id="cmi-strip"> Quitar metadatos (EXIF, ubicación GPS, perfil de cámara)</label>
    </div>

    <div class="option-group" data-step="preview">
      <label>Vista previa del resultado</label>
      <div id="cmi-preview"></div>
    </div>

    ${batchActionsHtml('cmi', 'Comprimir imágenes', counterpartButtonHtml('cmi', 'image', 'Comprimir'))}
  </div>`;
  organizeModule(ws);
  bindCounterpart('cmi', 'image', 'compress');

  // ── Opciones de configuración ────────────────────────────────────────────────
  const save = patch => saveModuleConfig('compress-images', patch);
  profilePicker(document.getElementById('cmi-level'), IMAGE_LEVELS, level, v => { level = v; }, v => save({ level: v }));

  optButtons(document.getElementById('cmi-format'), [
    { label: 'Mismo formato', value: 'same' },
    { label: 'WebP',          value: 'webp' },
    { label: 'JPG',           value: 'jpg'  },
  ], format, v => { format = v; }, v => save({ format: v }));

  optButtons(document.getElementById('cmi-max'), [
    { label: 'Sin límite', value: 0    },
    { label: '4096 px',    value: 4096 },
    { label: '2560 px',    value: 2560 },
    { label: '1920 px',    value: 1920 },
    { label: '1280 px',    value: 1280 },
  ], maxSide, v => { maxSide = v; }, v => save({ maxSide: v }));

  const stripBox = document.getElementById('cmi-strip');
  stripBox.checked = strip;
  stripBox.addEventListener('change', e => { strip = e.target.checked; save({ strip }); });

  // ── Lista de archivos, ejecución y resultados ────────────────────────────────
  const batch = setupBatchTool('cmi', {
    onChange: () => preview.refresh(),
    moduleId: 'compress-images',
    runLabel: 'Comprimir imágenes',
    busyLabel: 'Comprimiendo...',
    doneVerb: 'comprimida(s)',
    run: (files, outputDir) => window.api.compressImages({ files, level, format, maxSide, strip, outputDir }),
  });

  // ── Vista previa del resultado ───────────────────────────────────────────────
  const preview = createOutputPreview(document.getElementById('cmi-preview'), {
    tool: 'compress',
    getFile: () => batch.getFiles()[0],
    getParams: () => ({ level, format, maxSide, strip }),
  });
  refreshOnChange(ws, preview);
}
