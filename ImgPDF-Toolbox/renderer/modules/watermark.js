// ── modules/watermark.js ──────────────────────────────────────────────────────
async function renderWatermark() {
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
  let systemFonts = [];
  let gfCatalog   = [];

  const orientationAngles = {
    diagonal_asc:  -45,
    diagonal_desc:  45,
    horizontal:      0,
    vertical:      -90
  };

  angle = orientationAngles[orientation] ?? angle;

  // Catálogo base con todas las variantes populares
  const baseCatalog = [
    'Roboto', 'Roboto Condensed', 'Roboto Mono', 'Roboto Serif', 'Roboto Slab', 'Roboto Flex',
    'Open Sans', 'Open Sans Condensed',
    'Lato', 'Montserrat', 'Montserrat Alternates',
    'Poppins', 'Oswald', 'Inter', 'Inter Tight',
    'Raleway', 'Nunito', 'Nunito Sans', 'Ubuntu', 'Ubuntu Condensed', 'Ubuntu Mono',
    'Rubik', 'Rubik Mono One', 'Playfair Display', 'Lora',
    'Noto Sans', 'Noto Serif', 'PT Sans', 'PT Serif',
    'Kanit', 'Merriweather', 'Merriweather Sans', 'Bebas Neue',
    'Cabin', 'Fira Sans', 'Fira Code', 'Fira Mono',
    'Barlow', 'Barlow Condensed', 'Quicksand', 'Work Sans',
    'Inconsolata', 'Titillium Web', 'Mukta', 'Heebo', 'DM Sans', 'DM Serif Display',
    'Source Sans Pro', 'Source Code Pro', 'Source Serif Pro',
    'Cinzel', 'Caveat', 'Comfortaa', 'Pacifico', 'Lobster', 'Dancing Script'
  ];

  gfCatalog = [...baseCatalog];

  (async () => {
    try {
      if (window.api?.getGoogleFontsCatalog) {
        const res = await window.api.getGoogleFontsCatalog();
        if (res?.ok && Array.isArray(res.families) && res.families.length > 0) {
          gfCatalog = Array.from(new Set([...baseCatalog, ...res.families])).sort((a, b) => a.localeCompare(b));
        }
      }
    } catch (_) {}
  })();

  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">💧 Marca de agua</div>
    <p class="module-desc">Estampa texto personalizado, orientado y posicionado sobre imágenes y PDFs.</p>

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
        <span style="font-size:0.78rem;color:var(--muted)">O elige un color personalizado</span>
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

    <!-- Vista previa interactiva -->
    <div class="option-group">
      <label>Vista previa</label>
      <div class="wm-preview-container">
        <div class="wm-preview-box" id="wm-preview-box"></div>
        <p style="font-size:0.72rem;color:var(--muted);text-align:center">
          Vista aproximada — el resultado final dependerá del tamaño real del documento
        </p>
      </div>
    </div>

    <!-- Archivos -->
    <div class="file-zone" id="zone-wm">
      <div class="file-zone-header">
        <span class="file-count-badge" id="wm-badge">0 archivos cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-wm">📂 Seleccionar archivos</button>
        <button class="btn-secondary" id="clear-wm" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="wm-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>

    ${outputDirRow('wm')}

    <div class="btn-row">
      <button class="btn-primary" id="run-wm" disabled style="width:auto">Aplicar marca de agua</button>
      <button class="btn-danger"  id="cancel-wm" style="display:none;width:auto">Cancelar</button>
    </div>
    <div id="wm-result"></div>
  </div>`;

  // ── Vista previa interactiva ────────────────────────────────────────────────
  async function updatePreview() {
    const box = document.getElementById('wm-preview-box');
    if (!box) return;

    box.innerHTML = '';

    const boxW = box.clientWidth  || 450;
    const boxH = box.clientHeight || 180;
    const previewSize = Math.max(10, Math.min(fontSize * 0.35, 36));
    const alphaHex = Math.round((opacity / 100) * 255).toString(16).padStart(2, '0');
    const fillColor = `${color}${alphaHex}`;

    let activeFontFamily = 'sans-serif';
    if (fontPath) {
      const faceName = `WM_Font_${Date.now()}`;
      try {
        const fontFace = new FontFace(faceName, `url("file://${fontPath.replace(/\\/g, '/')}")`);
        await fontFace.load();
        document.fonts.add(fontFace);
        activeFontFamily = `"${faceName}", sans-serif`;
      } catch (_) {}
    }

    const gravityMap = {
      center:       { x: '50%', y: '50%', tx: '-50%', ty: '-50%' },
      top_left:     { x: '10%', y: '15%', tx: '0',    ty: '0'    },
      top_right:    { x: '90%', y: '15%', tx: '-100%', ty: '0'   },
      bottom_left:  { x: '10%', y: '85%', tx: '0',    ty: '-100%'},
      bottom_right: { x: '90%', y: '85%', tx: '-100%', ty: '-100%'},
    };

    if (repeatMode === 'single') {
      const g = gravityMap[position] || gravityMap.center;
      const el = document.createElement('span');
      el.className = 'wm-preview-label';
      el.textContent = text || 'MARCA';
      el.style.cssText = `
        left: ${g.x}; top: ${g.y};
        transform: translate(${g.tx}, ${g.ty}) rotate(${angle}deg);
        font-size: ${previewSize}px;
        font-weight: ${fontWeight};
        font-family: ${activeFontFamily};
        color: ${fillColor};
        white-space: nowrap;
      `;
      box.appendChild(el);
    } else {
      const scaleH = Math.max(60, repeatGapH * 0.35);
      const scaleV = Math.max(40, repeatGapV * 0.35);
      const cols = Math.ceil(boxW / scaleH) + 2;
      const rows = Math.ceil(boxH / scaleV) + 2;

      for (let r = -1; r < rows; r++) {
        for (let c = -1; c < cols; c++) {
          const el = document.createElement('span');
          el.className = 'wm-preview-label';
          el.textContent = text || 'MARCA';
          el.style.cssText = `
            left: ${c * scaleH}px; top: ${r * scaleV}px;
            transform: rotate(${angle}deg);
            font-size: ${previewSize}px;
            font-weight: ${fontWeight};
            font-family: ${activeFontFamily};
            color: ${fillColor};
            white-space: nowrap;
          `;
          box.appendChild(el);
        }
      }
    }
  }

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
    { label: '➔ Horizontal (0°)',             value: 'horizontal'    },
    { label: '⬆ Vertical (90°)',              value: 'vertical'      },
  ], orientation, val => {
    orientation = val;
    angle = orientationAngles[val] ?? 0;
    saveModuleConfig('watermark', { orientation: val, angle });
    updatePreview();
  });

  // ── Fuente ──────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('font-source-row'), [
    { label: '🖥 Fuentes del sistema', value: 'system' },
    { label: '🌐 Google Fonts',        value: 'google' },
  ], fontSource, val => {
    fontSource = val;
    saveModuleConfig('watermark', { fontSource: val });
    renderFontPicker();
  });

  async function renderFontPicker() {
    const picker = document.getElementById('font-picker');

    if (fontSource === 'system') {
      picker.innerHTML = `<p style="font-size:0.78rem;color:var(--muted)">⏳ Cargando fuentes del sistema...</p>`;
      if (!systemFonts.length) systemFonts = await window.api.getSystemFonts();
      if (!systemFonts.length) {
        picker.innerHTML = `<p style="font-size:0.78rem;color:var(--muted)">No se encontraron fuentes instaladas.</p>`;
        return;
      }
      picker.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input type="text" id="font-search" class="num-input"
            style="width:240px;text-align:left" placeholder="Buscar fuente...">
          <span style="font-size:0.78rem;color:var(--muted)">${systemFonts.length} fuentes detectadas</span>
        </div>
        <select id="font-select" size="5"
          style="width:100%;margin-top:0.4rem;border:1px solid var(--border);
                 border-radius:6px;padding:0.35rem 0.5rem;font-size:0.83rem;
                 background:var(--bg);color:var(--deep)">
          ${systemFonts.map(f => `<option value="${f.path}">${f.name}</option>`).join('')}
        </select>`;

      fontPath = systemFonts[0]?.path || null;
      updatePreview();

      document.getElementById('font-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = systemFonts.filter(f => f.name.toLowerCase().includes(q));
        const sel = document.getElementById('font-select');
        sel.innerHTML = filtered.map(f => `<option value="${f.path}">${f.name}</option>`).join('');
        fontPath = filtered[0]?.path || null;
        updatePreview();
      });

      document.getElementById('font-select').addEventListener('change', e => {
        fontPath = e.target.value;
        updatePreview();
      });

    } else {
      // Formato con la caja estilizada oficial y el menú flotante en blanco
      picker.innerHTML = `
        <div class="result-box info" style="margin-bottom:0.6rem">
          <div class="result-title">ℹ️ Catálogo de Google Fonts</div>
          <div class="result-item">Escribe la familia deseada (ej: Roboto, Montserrat, Open Sans) y selecciónala de la lista.</div>
        </div>
        <div style="display:flex;gap:0.5rem;align-items:center;position:relative">
          <div style="position:relative;width:320px">
            <input type="text" id="gf-family" class="num-input"
              style="width:100%;text-align:left;height:36px;padding:0.38rem 0.75rem;font-size:0.84rem;box-sizing:border-box"
              placeholder="Buscar familia tipográfica..." autocomplete="off">
            <div id="gf-suggestions" style="
              display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:99999;
              background:#ffffff;border:1px solid var(--border);border-radius:6px;
              box-shadow:0 8px 20px rgba(0,0,0,0.1);max-height:220px;overflow-y:auto;box-sizing:border-box">
            </div>
          </div>
          <button class="btn-secondary btn-sm" id="gf-load" style="height:36px;padding:0 0.9rem">Cargar fuente</button>
          <span id="gf-status" style="font-size:0.76rem;color:var(--muted)"></span>
        </div>`;

      const familyInput   = document.getElementById('gf-family');
      const suggestionsEl = document.getElementById('gf-suggestions');
      const statusEl      = document.getElementById('gf-status');

      async function triggerDownload(familyName) {
        const family = (familyName || familyInput.value).trim();
        if (!family) { notify.warning('Escribe o selecciona una familia de Google Fonts.'); return; }

        statusEl.textContent = '⏳ Descargando...';
        statusEl.style.color = 'var(--warning)';

        const dl = await window.api.downloadGoogleFont({ family, weight: fontWeight });
        if (dl.ok) {
          fontPath = dl.path;
          statusEl.textContent = `✓ ${family} lista`;
          statusEl.style.color = 'var(--success)';
          notify.success(`Fuente "${family}" cargada.`);
          updatePreview();
        } else {
          statusEl.textContent = '✗ Error';
          statusEl.style.color = 'var(--error)';
          notify.error(dl.error || `No se pudo cargar "${family}".`);
        }
      }

      function showSuggestions() {
        const q = familyInput.value.toLowerCase().trim();
        if (!q) {
          suggestionsEl.style.display = 'none';
          return;
        }

        const matches = gfCatalog.filter(f => f.toLowerCase().includes(q)).slice(0, 15);
        if (!matches.length) {
          suggestionsEl.style.display = 'none';
          return;
        }

        suggestionsEl.innerHTML = matches.map(f => `
          <div class="gf-item-row" data-family="${f}" style="
            padding:0.45rem 0.85rem;font-size:0.83rem;color:var(--deep);cursor:pointer;
            background:#ffffff;border-bottom:1px solid rgba(0,0,0,0.05);transition:background 0.15s, color 0.15s">
            ${f}
          </div>
        `).join('');
        suggestionsEl.style.display = 'block';

        suggestionsEl.querySelectorAll('.gf-item-row').forEach(item => {
          item.addEventListener('mouseenter', () => {
            item.style.background = 'var(--primary-soft)';
            item.style.color = 'var(--primary)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = '#ffffff';
            item.style.color = 'var(--deep)';
          });
          item.addEventListener('mousedown', e => {
            e.preventDefault();
            familyInput.value = item.dataset.family;
            suggestionsEl.style.display = 'none';
            triggerDownload(item.dataset.family);
          });
        });
      }

      familyInput.addEventListener('input', showSuggestions);
      familyInput.addEventListener('focus', showSuggestions);
      familyInput.addEventListener('blur', () => {
        setTimeout(() => { suggestionsEl.style.display = 'none'; }, 200);
      });

      document.getElementById('gf-load').addEventListener('click', () => triggerDownload());
    }
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
    const familyInput = document.getElementById('gf-family');
    if (fontSource === 'google' && familyInput && familyInput.value.trim()) {
      document.getElementById('gf-load').click();
    } else {
      updatePreview();
    }
  });

  // ── Color ───────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('color-row'), [
    { label: '🔴 Rojo',  value: '#FF0000' },
    { label: '🔵 Azul',  value: '#0A66C2' },
    { label: '⚫ Negro', value: '#000000' },
    { label: '🩶 Gris',  value: '#475569' },
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
    { label: '✛ Centro',     value: 'center'       },
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

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'wm-path');
    const dups = picked.filter(f => files.includes(f));
    files = [...files, ...picked.filter(f => !files.includes(f))];
    renderFileList('wm-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-wm').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{
      name: 'Imágenes y PDFs', extensions: ['pdf','png','jpg','jpeg']
    }]);
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
  bindDragDrop('zone-wm', ['pdf','png','jpg','jpeg'], addFiles);

  function updateRun() {
    document.getElementById('run-wm').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-wm').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('wm-badge').textContent   = `${files.length} archivo(s) seleccionado(s)`;
  }

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
    document.getElementById('wm-result').innerHTML = progressBar(40);

    const res = await window.api.watermarkText({
      files, text, fontPath, fontSize, fontWeight, opacity, angle,
      position, color, repeatMode, repeatGapH, repeatGapV,
      outputDir: state.outputDir
    });
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('wm-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} archivo(s) procesado(s)`, ok.map(r => `📄 ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`Marca de agua aplicada en ${ok.length} archivo(s).`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Aplicar marca de agua';
    cancel.style.display = 'none';
    updateRun();
  });

  requestAnimationFrame(updatePreview);
}