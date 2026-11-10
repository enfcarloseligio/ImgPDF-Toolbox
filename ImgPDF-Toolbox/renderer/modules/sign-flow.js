// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/sign-flow.js
// Descripción: Módulo «Flujo de firma»: toma un PDF (por ejemplo, con la firma ya incrustada
//              desde Word), lo convierte en imágenes con el formato y la resolución elegidos y
//              lo vuelve a armar en PDF, todo en un solo paso. La salida puede ser un único
//              PDF, un PDF por página o un PDF por cada N páginas, nombrados con el número de
//              su primera página para detectar de un vistazo hojas fuera de orden.
// ═════════════════════════════════════════════════════════════════════════════

async function renderSignFlow(ctx = {}) {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('sign-flow', { density: 300, format: 'png', background: '#FFFFFF', jpgQuality: 95, mode: 'all', rangeSize: 2 });
  let files = [];
  let { density, format, background, jpgQuality, mode, rangeSize } = cfg;   // mode: all | each | range

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('convert', 22)} Flujo de firma</div>
    <p class="module-desc">Convierte el PDF a imágenes y lo vuelve a armar en PDF en un solo paso: ideal para dejar firmas y sellos incrustados como parte de la página. Elige si el resultado sale junto, por página o por rangos.</p>

    <div class="option-group"><label>Formato de las imágenes</label><div class="option-row" id="sf-fmt"></div></div>
    <div class="option-group" id="sf-jpgq-group">
      <label>Calidad JPG</label>
      <div class="option-row" id="sf-jpgq"></div>
    </div>
    <div class="option-group">
      <label>Resolución (DPI)</label>
      <div class="option-row" id="sf-dpi"></div>
      <p class="option-hint">Más DPI da más nitidez y un PDF más pesado. PNG se incrusta sin pérdida.</p>
    </div>
    <div class="option-group"><label>Fondo</label><div class="option-row" id="sf-bg"></div></div>
    <div class="option-group">
      <label>Resultado</label>
      <div class="option-row" id="sf-mode"></div>
      <p class="option-hint" id="sf-mode-hint"></p>
    </div>
    <div class="option-group" id="sf-range-group">
      <label>Páginas por PDF</label>
      <div class="field-row"><span class="field"><input type="number" class="num-input" id="sf-range-size" min="1" step="1"> páginas</span></div>
      <p class="option-hint" id="sf-range-hint"></p>
    </div>

    ${fileZoneHtml({ zone: 'zone-sflow', pick: 'pick-sflow', clear: 'clear-sflow', badge: 'sflow-badge', list: 'sflow-list', kind: 'pdf', multiple: true })}
    ${outputDirRow('sflow')}
    <div class="btn-row">
      <button class="btn-primary" id="run-sflow" disabled style="width:auto">Procesar</button>
      <button class="btn-danger"  id="cancel-sflow" style="display:none;width:auto">Cancelar</button>
    </div>
    <div class="progress-panel" id="sflow-progress"></div>
    <div id="sflow-result"></div>
  </div>`;
  organizeModule(ws);

  const $ = id => document.getElementById(id);
  const save = patch => saveModuleConfig('sign-flow', patch);
  const size = () => Math.max(1, parseInt(rangeSize, 10) || 1);

  // ── Opciones de configuración ────────────────────────────────────────────────
  optButtons($('sf-fmt'), [{ label: 'PNG', value: 'png' }, { label: 'JPG', value: 'jpg' }],
    format, v => { format = v; updateBg(); updateJpgQuality(); }, v => save({ format: v }));

  optButtons($('sf-jpgq'), [
    { label: '100 — Máxima',  value: 100 },
    { label: '95 — Alta',     value: 95  },
    { label: '85 — Estándar', value: 85  },
  ], jpgQuality, v => { jpgQuality = v; }, v => save({ jpgQuality: v }));

  const updateJpgQuality = () => { $('sf-jpgq-group').style.display = format === 'jpg' ? '' : 'none'; };
  updateJpgQuality();

  optButtons($('sf-dpi'), [
    { label: '300 DPI — Máxima', value: 300 },
    { label: '200 DPI — Alta',   value: 200 },
    { label: '150 DPI — Media',  value: 150 },
    { label: '72 DPI — Baja',    value: 72  },
  ], density, v => { density = v; }, v => save({ density: v }));

  // JPG no admite transparencia, por lo que solo ofrece fondos sólidos
  function updateBg() {
    const opts = format === 'png'
      ? [
          { label: 'Blanco (#FFFFFF)',        value: '#FFFFFF'  },
          { label: 'Original (transparente)', value: 'original' },
          { label: 'Oscuro (#202020)',        value: '#202020'  },
        ]
      : [
          { label: 'Blanco (#FFFFFF)', value: '#FFFFFF' },
          { label: 'Oscuro (#202020)', value: '#202020' },
        ];
    background = opts.find(o => o.value === background) ? background : opts[0].value;
    optButtons($('sf-bg'), opts, background, v => { background = v; }, v => save({ background: v }));
  }
  updateBg();

  // ── Resultado: junto, por página o por rangos ────────────────────────────────
  const modeHint = () => {
    $('sf-mode-hint').textContent = {
      all:   'Un único PDF con todas las páginas, en su orden original.',
      each:  'Un PDF por página; cada uno lleva el número de su página (pp-001, pp-002…).',
      range: 'Un PDF por cada grupo de páginas consecutivas; cada uno lleva el número de su primera página.',
    }[mode];
    $('sf-range-group').style.display = mode === 'range' ? '' : 'none';
  };
  // Los rangos se explican con el número de páginas por PDF: el total solo se conoce al procesar
  const rangeHint = () => {
    const k = size();
    $('sf-range-hint').textContent = `Con ${k}: ${Array.from({ length: 3 }, (_, i) => `pp-${String(i * k + 1).padStart(3, '0')}`).join(', ')}… Si algún PDF sale con un número inesperado, hay hojas fuera de orden.`;
  };

  optButtons($('sf-mode'), [
    { label: 'Un solo PDF',        value: 'all'   },
    { label: 'Un PDF por página',  value: 'each'  },
    { label: 'Por rangos',         value: 'range' },
  ], mode, v => { mode = v; modeHint(); }, v => save({ mode: v }));

  $('sf-range-size').value = size();
  $('sf-range-size').addEventListener('input', e => {
    rangeSize = e.target.value;
    rangeHint();
    if (parseInt(rangeSize, 10) > 0) save({ rangeSize: size() });
  });
  modeHint();
  rangeHint();

  // ── Lista de archivos ────────────────────────────────────────────────────────
  const onRemove = f => { files = files.filter(x => x !== f); renderFileList('sflow-list', files, onRemove); updateRun(); };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'sflow-path');
    const dups = picked.filter(f => files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderFileList('sflow-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  function updateRun() {
    $('run-sflow').disabled = !(files.length && state.outputDir && !state.isProcessing);
    $('clear-sflow').style.display = files.length ? 'inline-block' : 'none';
    $('sflow-badge').textContent   = fileCountText(files.length, 'pdf');
  }

  // ── Selección de archivos, arrastre y carpeta de salida ──────────────────────
  $('pick-sflow').addEventListener('click', async () => addFiles(await pickFiles('pdf')));
  $('clear-sflow').addEventListener('click', () => {
    files = [];
    renderFileList('sflow-list', files, onRemove);
    $('sflow-result').innerHTML = '';
    updateRun();
  });
  $('sflow-pick').addEventListener('click', () => pickOutputDir('sflow-path').then(updateRun));
  bindDragDrop('zone-sflow', FILE_KINDS.pdf.extensions, addFiles);

  // ── Cancelación y ejecución ──────────────────────────────────────────────────
  $('cancel-sflow').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  $('run-sflow').addEventListener('click', async () => {
    const btn = $('run-sflow'), cancel = $('cancel-sflow');
    setProcessing(true);
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    $('sflow-result').innerHTML = '';

    const res = await runWithProgress('sign-flow', 'sflow-progress', () => window.api.signFlow({
      files, density, format, background, jpgQuality, mode, rangeSize: size(), outputDir: state.outputDir,
    }));
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    const outputs = ok.flatMap(r => r.outputs);
    $('sflow-result').innerHTML =
      (ok.length  ? resultBox('success', `${ok.length} PDF(s) procesado(s) → ${outputs.length} archivo(s)`,
          ok.flatMap(r => r.outputs.map(o => `${icon('file', 14)} ${basename(o)}`)), true) : '') +
      (err.length ? resultBox('error', `${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${outputs.length} PDF(s) generado(s).`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.textContent = 'Procesar';
    cancel.style.display = 'none';
    updateRun();
  });

  if (ctx.files?.length) addFiles(ctx.files);
}
