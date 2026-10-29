// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/convert-images.js
// Descripción: Módulo «Convertir imágenes»: cambia el formato de una o varias imágenes entre
//              PNG, JPG, WebP, AVIF, JPEG XL, TIFF, BMP, GIF e ICO, con control de calidad,
//              fondo para la transparencia, tamaños de icono y limpieza de metadatos.
// ═════════════════════════════════════════════════════════════════════════════

async function renderConvertImages() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('convert-images', {
    format: 'webp', quality: 90, lossless: false, background: '#FFFFFF', strip: false, ico: '256,128,64,48,32,16',
  });

  // Catálogo de formatos de salida. alpha: admite transparencia; quality: calidad con pérdida;
  // lossless: modo sin pérdida opcional. Solo se ofrecen los que esta instalación puede escribir.
  const CATALOG = [
    { value: 'png',  label: 'PNG',     alpha: true,  quality: false, hint: 'Sin pérdida y con transparencia. Ideal para capturas, logos y gráficos.' },
    { value: 'jpg',  label: 'JPG',     alpha: false, quality: true,  hint: 'El más compatible para fotografías. No admite transparencia.' },
    { value: 'webp', label: 'WebP',    alpha: true,  quality: true,  lossless: true, hint: 'Ligero y moderno, con transparencia y modo sin pérdida. Muy bueno para web.' },
    { value: 'avif', label: 'AVIF',    alpha: true,  quality: true,  hint: 'Máxima compresión con gran calidad. Menos compatible con programas antiguos.' },
    { value: 'jxl',  label: 'JPEG XL', alpha: true,  quality: true,  lossless: true, hint: 'Calidad excelente y modo sin pérdida. Aún con poca compatibilidad.' },
    { value: 'tiff', label: 'TIFF',    alpha: true,  quality: false, hint: 'Sin pérdida, para impresión y archivo. Pesa bastante.' },
    { value: 'bmp',  label: 'BMP',     alpha: false, quality: false, hint: 'Sin compresión; archivos muy pesados. No admite transparencia.' },
    { value: 'gif',  label: 'GIF',     alpha: true,  quality: false, hint: 'Hasta 256 colores; conserva animaciones.' },
    { value: 'ico',  label: 'ICO',     alpha: true,  quality: false, hint: 'Iconos de Windows y favicons, con varios tamaños en un solo archivo.' },
  ];
  const writable = new Set((await window.api.listImageFormats()).write);
  const FORMATS  = CATALOG.filter(f => !writable.size || writable.has(f.value));

  let { format, quality, lossless, background, strip, ico } = cfg;
  if (!FORMATS.some(f => f.value === format)) format = FORMATS[0].value;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('convert',22)} Convertir imágenes</div>
    <p class="module-desc">Cambia el formato de tus imágenes: PNG, JPG, WebP, AVIF y más. Las originales no se modifican.</p>
    ${batchFilesHtml('cvt')}

    <div class="option-group wide">
      <label>Formato de salida</label>
      <div class="option-row" id="cvt-fmt"></div>
      <p class="option-hint" id="cvt-hint"></p>
    </div>
    <div class="option-group" id="cvt-q-group">
      <label>Calidad</label>
      <div class="option-row" id="cvt-q"></div>
    </div>
    <div class="option-group" id="cvt-lossless-group">
      <label>Modo</label>
      <label class="check-row"><input type="checkbox" id="cvt-lossless"> Sin pérdida (conserva los píxeles exactos)</label>
    </div>
    <div class="option-group" id="cvt-bg-group">
      <label>Fondo (reemplaza la transparencia)</label>
      <div class="option-row" id="cvt-bg"></div>
    </div>
    <div class="option-group" id="cvt-ico-group">
      <label>Tamaños del icono</label>
      <div class="option-row" id="cvt-ico"></div>
    </div>
    <div class="option-group">
      <label>Metadatos</label>
      <label class="check-row"><input type="checkbox" id="cvt-strip"> Quitar metadatos (EXIF, ubicación GPS, perfil de cámara)</label>
    </div>

    ${batchActionsHtml('cvt', 'Convertir imágenes')}
  </div>`;
  organizeModule(ws);

  // ── Opciones de configuración ────────────────────────────────────────────────
  const save = patch => saveModuleConfig('convert-images', patch);
  const show = (id, visible) => { document.getElementById(id).style.display = visible ? '' : 'none'; };

  // Muestra solo los controles que aplican al formato elegido
  function updateVisibility() {
    const f = FORMATS.find(x => x.value === format);
    document.getElementById('cvt-hint').textContent = f.hint;
    show('cvt-lossless-group', !!f.lossless);
    show('cvt-q-group', f.quality && !(f.lossless && lossless));
    show('cvt-bg-group', !f.alpha);
    show('cvt-ico-group', f.value === 'ico');
  }

  optButtons(document.getElementById('cvt-fmt'), FORMATS.map(f => ({ label: f.label, value: f.value })),
    format, v => { format = v; updateVisibility(); }, v => save({ format: v }));

  optButtons(document.getElementById('cvt-q'), [
    { label: '100 — Máxima',  value: 100 },
    { label: '95 — Alta',     value: 95  },
    { label: '85 — Estándar', value: 85  },
    { label: '70 — Baja',     value: 70  },
  ], quality, v => { quality = v; }, v => save({ quality: v }));

  optButtons(document.getElementById('cvt-bg'), [
    { label: 'Blanco (#FFFFFF)', value: '#FFFFFF' },
    { label: 'Oscuro (#202020)', value: '#202020' },
    { label: 'Gris (#E2E8F0)',   value: '#E2E8F0' },
  ], background, v => { background = v; }, v => save({ background: v }));

  optButtons(document.getElementById('cvt-ico'), [
    { label: 'Completo (256 – 16 px)',  value: '256,128,64,48,32,16' },
    { label: 'Favicon (48, 32, 16 px)', value: '48,32,16'           },
    { label: 'Solo 256 px',             value: '256'                },
  ], ico, v => { ico = v; }, v => save({ ico: v }));

  const losslessBox = document.getElementById('cvt-lossless');
  const stripBox    = document.getElementById('cvt-strip');
  losslessBox.checked = lossless;
  stripBox.checked    = strip;
  losslessBox.addEventListener('change', e => { lossless = e.target.checked; save({ lossless }); updateVisibility(); });
  stripBox.addEventListener('change',    e => { strip    = e.target.checked; save({ strip }); });
  updateVisibility();

  // ── Lista de archivos, ejecución y resultados ────────────────────────────────
  setupBatchTool('cvt', {
    moduleId: 'convert-images',
    runLabel: 'Convertir imágenes',
    busyLabel: 'Convirtiendo...',
    doneVerb: 'convertida(s)',
    run: (files, outputDir) => window.api.convertImages({ files, format, quality, lossless, background, strip, icoSizes: ico, outputDir }),
  });
}
