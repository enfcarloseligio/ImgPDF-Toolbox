// ── modules/watermark-image.js ────────────────────────────────────────────────
async function renderWatermarkImage() {
  const cfg = await loadModuleConfig('watermark-image', {
    sizePercent:  25,
    opacity:      70,
    position:     'bottom_right',
    angle:        0,
    repeatMode:   'single',
    repeatGapH:   300,
    repeatGapV:   200,
    marginX:      40,
    marginY:      30,
  });

  let files       = [];
  let markFile    = null;
  let sizePercent = cfg.sizePercent;
  let opacity     = cfg.opacity;
  let position    = cfg.position;
  let angle       = cfg.angle;
  let repeatMode  = cfg.repeatMode;
  let repeatGapH  = cfg.repeatGapH;
  let repeatGapV  = cfg.repeatGapV;
  let marginX     = cfg.marginX;
  let marginY     = cfg.marginY;

  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">🖼️ Marca de agua — Imagen</div>
    <p class="module-desc">Superpone una imagen (PNG con transparencia recomendado) sobre PDFs e imágenes.</p>

    <!-- Imagen de marca -->
    <div class="option-group">
      <label>Imagen de marca de agua</label>
      <div class="file-zone" id="zone-mark" style="flex-direction:row;align-items:center;gap:1rem;min-height:auto;padding:0.85rem">
        <button class="btn-secondary" id="pick-mark">🖼️ Seleccionar imagen</button>
        <span id="mark-name" style="font-size:0.82rem;color:var(--muted)">PNG con transparencia recomendado</span>
        <div id="mark-preview-thumb" style="display:none;width:60px;height:60px;border:1px solid var(--border);
          border-radius:6px;overflow:hidden;flex-shrink:0;background:
          repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%) 0 0 / 10px 10px">
          <img id="mark-thumb-img" style="width:100%;height:100%;object-fit:contain">
        </div>
      </div>
    </div>

    <!-- Tamaño relativo -->
    <div class="option-group">
      <label>Tamaño relativo al documento</label>
      <div class="option-row" id="size-row"></div>
      <p style="font-size:0.76rem;color:var(--muted);margin-top:0.25rem">
        Porcentaje del ancho del documento. La imagen se escala proporcionalmente.
      </p>
    </div>

    <!-- Opacidad -->
    <div class="option-group">
      <label>Opacidad (%)</label>
      <div style="display:flex;align-items:center;gap:0.75rem">
        <input type="range" id="wmi-opacity-range" min="5" max="100" value="${opacity}"
          style="flex:1;accent-color:var(--primary)">
        <input type="number" class="num-input" id="wmi-opacity" value="${opacity}" min="5" max="100" style="width:70px">
        <span style="font-size:0.82rem;color:var(--muted)">%</span>
      </div>
    </div>

    <!-- Orientación / ángulo -->
    <div class="option-group">
      <label>Orientación</label>
      <div class="option-row" id="angle-row"></div>
    </div>

    <!-- Modo de repetición -->
    <div class="option-group">
      <label>Distribución</label>
      <div class="option-row" id="repeat-row"></div>
      <div id="repeat-gap-section" style="display:none;margin-top:0.5rem">
        <div class="range-row">
          <span>Separación horizontal:</span>
          <input type="number" class="num-input" id="wmi-gap-h" value="${repeatGapH}" min="50" max="800">
          <span>px</span>
          <span style="margin-left:1rem">Vertical:</span>
          <input type="number" class="num-input" id="wmi-gap-v" value="${repeatGapV}" min="30" max="600">
          <span>px</span>
        </div>
      </div>
    </div>

    <!-- Posición y margen (solo modo único) -->
    <div id="position-section">
      <div class="option-group">
        <label>Posición</label>
        <div class="option-row" id="position-row"></div>
        <div class="range-row" style="margin-top:0.5rem">
          <span>Margen X:</span>
          <input type="number" class="num-input" id="wmi-margin-x" value="${marginX}" min="0" max="400">
          <span>px</span>
          <span style="margin-left:1rem">Margen Y:</span>
          <input type="number" class="num-input" id="wmi-margin-y" value="${marginY}" min="0" max="400">
          <span>px</span>
        </div>
      </div>
    </div>

    <!-- Vista previa -->
    <div class="option-group">
      <label>Vista previa aproximada</label>
      <div class="wm-preview-container">
        <div class="wm-preview-box" id="wmi-preview-box"></div>
        <p style="font-size:0.72rem;color:var(--muted);text-align:center">
          Vista aproximada — el resultado final depende del tamaño real del documento
        </p>
      </div>
    </div>

    <!-- Archivos destino -->
    <div class="file-zone" id="zone-wmi">
      <div class="file-zone-header">
        <span class="file-count-badge" id="wmi-badge">0 archivos cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-wmi">📂 Seleccionar archivos</button>
        <button class="btn-secondary" id="clear-wmi" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="wmi-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>

    ${outputDirRow('wmi')}

    <div class="btn-row">
      <button class="btn-primary" id="run-wmi" disabled style="width:auto">Aplicar marca de imagen</button>
      <button class="btn-danger"  id="cancel-wmi" style="display:none;width:auto">Cancelar</button>
    </div>
    <div id="wmi-result"></div>
  </div>`;

  // ── Seleccionar imagen de marca ─────────────────────────────────────────────
  document.getElementById('pick-mark').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{
      name: 'Imágenes', extensions: ['png','jpg','jpeg','svg','webp']
    }]);
    if (!picked.length) return;
    markFile = picked[0];
    document.getElementById('mark-name').textContent = basename(markFile);
    document.getElementById('mark-name').style.color = 'var(--deep)';

    // Mostrar miniatura
    const thumb = document.getElementById('mark-preview-thumb');
    const img   = document.getElementById('mark-thumb-img');
    thumb.style.display = 'block';
    // Electron puede cargar archivos locales con file://
    img.src = `file:///${markFile.replace(/\\/g, '/')}`;

    updatePreview();
    updateRun();
  });

  // ── Tamaño relativo ─────────────────────────────────────────────────────────
  optButtons(document.getElementById('size-row'), [
    { label: '10% — Pequeño',  value: 10 },
    { label: '20% — Mediano',  value: 20 },
    { label: '30% — Grande',   value: 30 },
    { label: '50% — Muy grande',value: 50 },
    { label: '75% — Portada',  value: 75 },
  ], sizePercent, val => {
    sizePercent = val;
    saveModuleConfig('watermark-image', { sizePercent: val });
    updatePreview();
  });

  // ── Opacidad ────────────────────────────────────────────────────────────────
  const opacityRange = document.getElementById('wmi-opacity-range');
  const opacityNum   = document.getElementById('wmi-opacity');
  opacityRange.addEventListener('input', e => {
    opacity = parseInt(e.target.value);
    opacityNum.value = opacity;
    saveModuleConfig('watermark-image', { opacity });
    updatePreview();
  });
  opacityNum.addEventListener('input', e => {
    opacity = parseInt(e.target.value) || 70;
    opacityRange.value = opacity;
    saveModuleConfig('watermark-image', { opacity });
    updatePreview();
  });

  // ── Orientación ─────────────────────────────────────────────────────────────
  optButtons(document.getElementById('angle-row'), [
    { label: '↑ Normal (0°)',    value: 0   },
    { label: '↻ 45° diagonal',   value: 45  },
    { label: '↻ 90° derecha',    value: 90  },
    { label: '↺ -45° diagonal',  value: -45 },
    { label: '↺ -90° izquierda', value: -90 },
    { label: '↕ 180° invertido', value: 180 },
  ], angle, val => {
    angle = val;
    saveModuleConfig('watermark-image', { angle: val });
    updatePreview();
  });

  // ── Distribución ─────────────────────────────────────────────────────────────
  optButtons(document.getElementById('repeat-row'), [
    { label: '⊙ Imagen única',    value: 'single' },
    { label: '⊞ Mosaico repetido', value: 'tile'   },
  ], repeatMode, val => {
    repeatMode = val;
    saveModuleConfig('watermark-image', { repeatMode: val });
    document.getElementById('repeat-gap-section').style.display = val === 'tile' ? 'block' : 'none';
    document.getElementById('position-section').style.display   = val === 'tile' ? 'none'  : 'block';
    updatePreview();
  });

  document.getElementById('repeat-gap-section').style.display = repeatMode === 'tile' ? 'block' : 'none';
  document.getElementById('position-section').style.display   = repeatMode === 'tile' ? 'none'  : 'block';

  document.getElementById('wmi-gap-h').addEventListener('input', e => {
    repeatGapH = parseInt(e.target.value)||300;
    saveModuleConfig('watermark-image',{repeatGapH}); updatePreview();
  });
  document.getElementById('wmi-gap-v').addEventListener('input', e => {
    repeatGapV = parseInt(e.target.value)||200;
    saveModuleConfig('watermark-image',{repeatGapV}); updatePreview();
  });

  // ── Posición ─────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('position-row'), [
    { label: '↖ Sup. Izq.',  value: 'top_left'     },
    { label: '↗ Sup. Der.',  value: 'top_right'    },
    { label: '✛ Centro',     value: 'center'       },
    { label: '↙ Inf. Izq.',  value: 'bottom_left'  },
    { label: '↘ Inf. Der.',  value: 'bottom_right' },
  ], position, val => {
    position = val;
    saveModuleConfig('watermark-image',{position}); updatePreview();
  });

  document.getElementById('wmi-margin-x').addEventListener('input', e => {
    marginX = parseInt(e.target.value)||40;
    saveModuleConfig('watermark-image',{marginX}); updatePreview();
  });
  document.getElementById('wmi-margin-y').addEventListener('input', e => {
    marginY = parseInt(e.target.value)||30;
    saveModuleConfig('watermark-image',{marginY}); updatePreview();
  });

  // ── Vista previa ─────────────────────────────────────────────────────────────
  function updatePreview() {
    const box = document.getElementById('wmi-preview-box');
    if (!box) return;
    box.querySelectorAll('.wmi-preview-mark').forEach(el => el.remove());

    const boxW = box.clientWidth  || 400;
    const boxH = box.clientHeight || 180;
    const markW = Math.round((sizePercent / 100) * boxW);
    const alphaVal = (opacity / 100).toFixed(2);

    const gravityMap = {
      top_left:     { left: '2%',  top: '5%'  },
      top_right:    { right:'2%',  top: '5%'  },
      center:       { left: '50%', top: '50%', transform:'translate(-50%,-50%)' },
      bottom_left:  { left: '2%',  bottom:'5%'},
      bottom_right: { right:'2%',  bottom:'5%'},
    };

    if (repeatMode === 'single') {
      const g = gravityMap[position] || gravityMap.bottom_right;
      const el = document.createElement('div');
      el.className = 'wmi-preview-mark';
      el.style.cssText = `position:absolute;width:${markW}px;opacity:${alphaVal};
        transform:rotate(${angle}deg)${g.transform||''};pointer-events:none;
        ${g.left   ? `left:${g.left};`   : ''}
        ${g.right  ? `right:${g.right};` : ''}
        ${g.top    ? `top:${g.top};`     : ''}
        ${g.bottom ? `bottom:${g.bottom};`:''}`;

      if (markFile) {
        const img = document.createElement('img');
        img.src = `file:///${markFile.replace(/\\/g, '/')}`;
        img.style.cssText = 'width:100%;height:auto;display:block';
        el.appendChild(img);
      } else {
        el.style.background = 'rgba(10,102,194,0.25)';
        el.style.height = `${Math.round(markW * 0.6)}px`;
        el.style.border = '2px dashed var(--primary)';
        el.style.borderRadius = '4px';
        el.innerHTML = `<span style="font-size:0.68rem;color:var(--primary);padding:0.25rem;display:block;text-align:center">Imagen</span>`;
      }
      box.appendChild(el);

    } else {
      const scaleH = repeatGapH * (boxW / 800);
      const scaleV = repeatGapV * (boxH / 600);
      const cols = Math.ceil(boxW / scaleH) + 1;
      const rows = Math.ceil(boxH / scaleV) + 1;
      const mW   = Math.round((sizePercent / 100) * scaleH * 0.8);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const el = document.createElement('div');
          el.className = 'wmi-preview-mark';
          el.style.cssText = `position:absolute;width:${mW}px;opacity:${alphaVal};
            left:${c * scaleH}px;top:${r * scaleV}px;
            transform:rotate(${angle}deg);pointer-events:none;`;

          if (markFile) {
            const img = document.createElement('img');
            img.src = `file:///${markFile.replace(/\\/g, '/')}`;
            img.style.cssText = 'width:100%;height:auto;display:block';
            el.appendChild(img);
          } else {
            el.style.background = 'rgba(10,102,194,0.2)';
            el.style.height = `${Math.round(mW * 0.6)}px`;
            el.style.border = '1px dashed var(--primary)';
            el.style.borderRadius = '3px';
          }
          box.appendChild(el);
        }
      }
    }
  }
  requestAnimationFrame(updatePreview);

  // ── Archivos destino ──────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('wmi-list', files, onRemove);
    updateRun();
  };

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'wmi-path');
    const dups = picked.filter(f => files.includes(f));
    files = [...files, ...picked.filter(f => !files.includes(f))];
    renderFileList('wmi-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-wmi').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{
      name: 'Imágenes y PDFs', extensions: ['pdf','png','jpg','jpeg']
    }]);
    addFiles(picked);
  });

  document.getElementById('clear-wmi').addEventListener('click', () => {
    files = [];
    renderFileList('wmi-list', files, onRemove);
    document.getElementById('wmi-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('wmi-pick').addEventListener('click', () =>
    pickOutputDir('wmi-path').then(updateRun));
  bindDragDrop('zone-wmi', ['pdf','png','jpg','jpeg'], addFiles);

  function updateRun() {
    document.getElementById('run-wmi').disabled = !(files.length && markFile && state.outputDir && !state.isProcessing);
    document.getElementById('clear-wmi').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('wmi-badge').textContent   = `${files.length} archivo(s) seleccionado(s)`;
  }

  document.getElementById('cancel-wmi').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando marca de imagen...');
  });

  document.getElementById('run-wmi').addEventListener('click', async () => {
    if (!markFile) { notify.warning('Selecciona una imagen de marca de agua.'); return; }
    setProcessing(true);
    const btn = document.getElementById('run-wmi'), cancel = document.getElementById('cancel-wmi');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('wmi-result').innerHTML = progressBar(40);

    const res = await window.api.watermarkImage({
      files, markFile, sizePercent, opacity, position,
      angle, repeatMode, repeatGapH, repeatGapV, marginX, marginY,
      outputDir: state.outputDir
    });
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('wmi-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} archivo(s) procesado(s)`, ok.map(r => `📄 ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`Marca de imagen aplicada en ${ok.length} archivo(s).`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Aplicar marca de imagen';
    cancel.style.display = 'none';
    updateRun();
  });
}
