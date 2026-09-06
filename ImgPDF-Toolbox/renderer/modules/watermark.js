// ── modules/watermark.js ──────────────────────────────────────────────────────
function renderWatermark() {
  let files       = [];
  let text        = 'CONFIDENCIAL';
  let fontPath    = null;
  let fontSize    = 72;
  let fontWeight  = 400;
  let opacity     = 50;
  let angle       = 45;
  let position    = 'center';
  let color       = '#FF0000';
  let fontSource  = 'system';
  let systemFonts = [];
  let gfCatalog   = [];

  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">💧 Marca de agua</div>
    <p class="module-desc">Estampa texto diagonal o posicionado sobre imágenes y PDFs.</p>

    <!-- Texto y atajos -->
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

    <!-- Tamaño, Peso, Opacidad, Ángulo -->
    <div style="display:grid;grid-template-columns:1fr 1.3fr 1fr 1fr;gap:1rem">
      <div class="option-group">
        <label>Tamaño (px)</label>
        <input type="number" class="num-input" id="wm-size"
          value="${fontSize}" min="10" max="300" style="width:100%">
      </div>

      <div class="option-group">
        <label>Peso / Grosor</label>
        <select id="wm-weight" class="num-input" style="width:100%;text-align:left;padding:0.35rem 0.5rem">
          <option value="100">100 (Fina)</option>
          <option value="200">200 (Extra ligera)</option>
          <option value="300">300 (Ligera)</option>
          <option value="400" selected>400 (Normal)</option>
          <option value="500">500 (Mediana)</option>
          <option value="600">600 (Semi negrita)</option>
          <option value="700">700 (Negrita)</option>
          <option value="800">800 (Extra negrita)</option>
          <option value="900">900 (Negra)</option>
        </select>
      </div>

      <div class="option-group">
        <label>Opacidad (%)</label>
        <input type="number" class="num-input" id="wm-opacity"
          value="${opacity}" min="5" max="100" style="width:100%">
      </div>

      <div class="option-group">
        <label>Ángulo (°)</label>
        <input type="number" class="num-input" id="wm-angle"
          value="${angle}" min="-180" max="180" style="width:100%">
      </div>
    </div>

    <!-- Color -->
    <div class="option-group">
      <label>Color</label>
      <div class="option-row" id="color-row"></div>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.4rem">
        <input type="color" id="wm-color" value="${color}"
          style="width:36px;height:36px;border:1px solid var(--border);
                 border-radius:6px;cursor:pointer;padding:2px">
        <span style="font-size:0.78rem;color:var(--muted)">O elige un color personalizado</span>
      </div>
    </div>

    <!-- Posición -->
    <div class="option-group">
      <label>Posición</label>
      <div class="option-row" id="position-row"></div>
    </div>

    <!-- Vista previa interactiva -->
    <div class="wm-preview-container">
      <label style="font-size:0.75rem;font-weight:600;color:var(--deep);text-transform:uppercase;">Vista previa en vivo</label>
      <div class="wm-preview-box" id="wm-preview-box">
        <span class="wm-preview-label" id="wm-preview-text">CONFIDENCIAL</span>
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

  // ── Actualizador de Vista Previa ──────────────────────────────────────────
  async function updatePreview() {
    const preview = document.getElementById('wm-preview-text');
    const box = document.getElementById('wm-preview-box');
    if (!preview || !box) return;

    preview.textContent = text || 'VISTA PREVIA';
    preview.style.color = color;
    preview.style.opacity = opacity / 100;
    preview.style.fontWeight = fontWeight;

    const previewSize = Math.max(14, Math.round(fontSize * 0.38));
    preview.style.fontSize = `${previewSize}px`;

    if (fontPath) {
      const fontName = `CustomWMFont_${fontWeight}`;
      try {
        const fontFace = new FontFace(fontName, `url("file://${fontPath.replace(/\\/g, '/')}")`, {
          weight: String(fontWeight)
        });
        await fontFace.load();
        document.fonts.add(fontFace);
        preview.style.fontFamily = fontName;
      } catch (_) {
        preview.style.fontFamily = 'sans-serif';
      }
    } else {
      preview.style.fontFamily = 'sans-serif';
    }

    const posStyles = {
      center:       { top: '50%', left: '50%', transform: `translate(-50%, -50%) rotate(${angle}deg)` },
      top_left:     { top: '15%', left: '15%', transform: `translate(0, 0) rotate(${angle}deg)` },
      top_right:    { top: '15%', right: '15%', left: 'auto', transform: `translate(0, 0) rotate(${angle}deg)` },
      bottom_left:  { bottom: '15%', top: 'auto', left: '15%', transform: `translate(0, 0) rotate(${angle}deg)` },
      bottom_right: { bottom: '15%', top: 'auto', right: '15%', left: 'auto', transform: `translate(0, 0) rotate(${angle}deg)` },
    };

    const cur = posStyles[position] || posStyles.center;
    preview.style.top = cur.top || 'auto';
    preview.style.bottom = cur.bottom || 'auto';
    preview.style.left = cur.left || 'auto';
    preview.style.right = cur.right || 'auto';
    preview.style.transform = cur.transform;
  }

  // ── Atajos de texto ─────────────────────────────────────────────────────────
  ['CONFIDENCIAL', 'COPIA', 'BORRADOR', 'RECIBIDO', 'PRELIMINAR'].forEach(s => {
    const btn = document.createElement('button');
    btn.className   = 'opt-btn';
    btn.textContent = s;
    btn.addEventListener('click', () => {
      text = s;
      document.getElementById('wm-text').value = s;
      updatePreview();
    });
    document.getElementById('shortcut-row').appendChild(btn);
  });

  document.getElementById('wm-text').addEventListener('input', e => {
    text = e.target.value;
    updatePreview();
  });

  // ── Selector de Peso ────────────────────────────────────────────────────────
  document.getElementById('wm-weight').addEventListener('change', async e => {
    fontWeight = parseInt(e.target.value, 10);
    const familyInput = document.getElementById('gf-family');
    
    if (fontSource === 'google' && familyInput && familyInput.value.trim()) {
      await loadGoogleFont(familyInput.value.trim());
    } else {
      updatePreview();
    }
  });

  // ── Fuente: sistema vs Google Fonts ────────────────────────────────────────
  optButtons(document.getElementById('font-source-row'), [
    { label: '🖥 Fuentes del sistema', value: 'system' },
    { label: '🌐 Google Fonts',        value: 'google' },
  ], 'system', val => {
    fontSource = val;
    renderFontPicker();
  });

  async function loadGoogleFont(family) {
    const statusEl = document.getElementById('gf-status');
    if (!family) { notify.warning('Escribe el nombre de una familia de Google Fonts.'); return; }

    statusEl.textContent = `⏳ Descargando (${fontWeight})...`;
    statusEl.style.color = 'var(--warning)';

    const dl = await window.api.downloadGoogleFont({ family, weight: fontWeight });

    if (dl.ok) {
      fontPath = dl.path;
      statusEl.textContent = `✓ ${family} (${fontWeight}) lista`;
      statusEl.style.color = 'var(--success)';
      notify.success(`Fuente "${family}" cargada.`);
      const suggestionsEl = document.getElementById('gf-suggestions');
      if (suggestionsEl) suggestionsEl.style.display = 'none';
      updatePreview();
    } else {
      statusEl.textContent = '✗ Error al cargar';
      statusEl.style.color = 'var(--error)';
      notify.error(dl.error);
    }
  }

  async function renderFontPicker() {
    const picker = document.getElementById('font-picker');

    if (fontSource === 'system') {
      picker.innerHTML = `<p style="font-size:0.78rem;color:var(--muted)">⏳ Cargando fuentes del sistema...</p>`;
      if (!systemFonts.length) {
        systemFonts = await window.api.getSystemFonts();
      }
      if (!systemFonts.length) {
        picker.innerHTML = `<p style="font-size:0.78rem;color:var(--muted)">No se encontraron fuentes instaladas.</p>`;
        return;
      }

      picker.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input type="text" id="font-search" class="num-input"
            style="width:220px;text-align:left" placeholder="Buscar fuente...">
          <span style="font-size:0.78rem;color:var(--muted)">${systemFonts.length} fuentes detectadas</span>
        </div>
        <select id="font-select" size="5"
          style="width:100%;margin-top:0.4rem;border:1px solid var(--border);
                 border-radius:6px;padding:0.3rem;font-size:0.82rem;
                 background:var(--bg);color:var(--deep)">
          ${systemFonts.map(f => `<option value="${f.path}">${f.name}</option>`).join('')}
        </select>`;

      fontPath = systemFonts[0]?.path || null;
      updatePreview();

      document.getElementById('font-search').addEventListener('input', e => {
        const q        = e.target.value.toLowerCase();
        const filtered = systemFonts.filter(f => f.name.toLowerCase().includes(q));
        const sel      = document.getElementById('font-select');
        sel.innerHTML  = filtered.map(f => `<option value="${f.path}">${f.name}</option>`).join('');
        fontPath       = filtered[0]?.path || null;
        updatePreview();
      });

      document.getElementById('font-select').addEventListener('change', e => {
        fontPath = e.target.value;
        updatePreview();
      });

    } else {
      picker.innerHTML = `
        <div class="result-box info" style="margin-bottom:0.5rem">
          <div class="result-title">ℹ️ Google Fonts requiere conexión a Internet</div>
          <div class="result-item">Escribe la familia y selecciona su peso. Se descargará el archivo exacto.</div>
        </div>
        <div style="position:relative;display:inline-block;width:100%">
          <div style="display:flex;gap:0.5rem;align-items:center">
            <div style="position:relative;flex:1;max-width:280px">
              <input type="text" id="gf-family" class="num-input"
                style="width:100%;text-align:left" placeholder="Ej: Roboto, Open Sans, Lato..."
                autocomplete="off">
              <div id="gf-suggestions" style="
                display:none;position:absolute;top:100%;left:0;right:0;z-index:100;
                background:var(--surface);border:1px solid var(--border);
                border-radius:6px;box-shadow:var(--shadow-md);max-height:180px;
                overflow-y:auto;margin-top:2px"></div>
            </div>
            <button class="btn-secondary btn-sm" id="gf-load">Cargar fuente</button>
            <span id="gf-status" style="font-size:0.76rem;color:var(--muted)"></span>
          </div>
        </div>`;

      if (!gfCatalog.length) {
        try {
          const res  = await fetch('https://fonts.google.com/metadata/fonts');
          const json = await res.json();
          gfCatalog = (json.familyMetadataList || []).map(f => f.family);
        } catch (_) {
          gfCatalog = [];
        }
      }

      const familyInput   = document.getElementById('gf-family');
      const suggestionsEl = document.getElementById('gf-suggestions');

      familyInput.addEventListener('input', () => {
        const q = familyInput.value.toLowerCase().trim();
        if (!q || gfCatalog.length === 0) {
          suggestionsEl.style.display = 'none';
          return;
        }
        const matches = gfCatalog.filter(f => f.toLowerCase().includes(q)).slice(0, 8);
        if (!matches.length) {
          suggestionsEl.style.display = 'none';
          return;
        }
        suggestionsEl.innerHTML = matches.map(f =>
          `<div class="gf-suggestion-item" data-family="${f}">${f}</div>`
        ).join('');
        suggestionsEl.style.display = 'block';

        suggestionsEl.querySelectorAll('.gf-suggestion-item').forEach(item => {
          item.addEventListener('mousedown', e => {
            e.preventDefault();
            familyInput.value = item.dataset.family;
            suggestionsEl.style.display = 'none';
          });
        });
      });

      familyInput.addEventListener('blur', () => {
        setTimeout(() => { suggestionsEl.style.display = 'none'; }, 150);
      });

      document.getElementById('gf-load').addEventListener('click', () => {
        loadGoogleFont(familyInput.value.trim());
      });
    }
  }
  renderFontPicker();

  // ── Tamaño, opacidad, ángulo ────────────────────────────────────────────────
  document.getElementById('wm-size').addEventListener('input', e => {
    fontSize = parseInt(e.target.value, 10) || 72;
    updatePreview();
  });
  document.getElementById('wm-opacity').addEventListener('input', e => {
    opacity  = parseInt(e.target.value, 10) || 50;
    updatePreview();
  });
  document.getElementById('wm-angle').addEventListener('input', e => {
    angle    = parseInt(e.target.value, 10) || 45;
    updatePreview();
  });

  // ── Color ───────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('color-row'), [
    { label: '🔴 Rojo',  value: '#FF0000' },
    { label: '🔵 Azul',  value: '#0A66C2' },
    { label: '⚫ Negro', value: '#000000' },
    { label: '🩶 Gris',  value: '#475569' },
  ], '#FF0000', val => {
    color = val;
    document.getElementById('wm-color').value = val;
    updatePreview();
  });

  document.getElementById('wm-color').addEventListener('input', e => {
    color = e.target.value;
    updatePreview();
  });

  // ── Posición ────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('position-row'), [
    { label: '↖ Sup. Izq.',  value: 'top_left'     },
    { label: '↗ Sup. Der.',  value: 'top_right'    },
    { label: '✛ Centro',     value: 'center'       },
    { label: '↙ Inf. Izq.',  value: 'bottom_left'  },
    { label: '↘ Inf. Der.',  value: 'bottom_right' },
  ], 'center', val => {
    position = val;
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
    const news = picked.filter(f => !files.includes(f));
    const dups = picked.filter(f =>  files.includes(f));
    files = [...files, ...news];
    renderFileList('wm-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-wm').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{
      name: 'Imágenes y PDFs', extensions: ['pdf', 'png', 'jpg', 'jpeg']
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

  bindDragDrop('zone-wm', ['pdf', 'png', 'jpg', 'jpeg'], addFiles);

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
    const btn    = document.getElementById('run-wm');
    const cancel = document.getElementById('cancel-wm');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('wm-result').innerHTML = progressBar(40);

    const res = await window.api.watermarkText({
      files, text, fontPath, fontSize, opacity, angle, position, color,
      outputDir: state.outputDir
    });
    window.api.playBeep();

    const ok  = res.filter(r => r.ok);
    const err = res.filter(r => !r.ok);
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

  updatePreview();
}