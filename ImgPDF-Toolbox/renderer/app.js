// ── Estado global ─────────────────────────────────────────────────────────────
const state = {
  activeModule: null,
  outputDir: null,
  tools: { imageMagick: false, ghostscript: false, imVersion: '', gsVersion: '' }
};

// ── SPLASH: Secuencia de bienvenida ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  bindExternalLinks();
  await runSplash();
});

async function runSplash() {
  const loaderFill = document.getElementById('loader-fill');
  const loaderMsg  = document.getElementById('loader-msg');

  const msgs = [
    [10,  'Iniciando entorno...'],
    [30,  'Buscando ImageMagick...'],
    [55,  'Buscando Ghostscript...'],
    [80,  'Verificando versiones...'],
    [95,  'Casi listo...'],
  ];

  for (const [pct, msg] of msgs) {
    loaderFill.style.width = pct + '%';
    loaderMsg.textContent = msg;
    await delay(380);
  }

  const tools = await window.api.checkTools();
  state.tools = tools;

  loaderFill.style.width = '100%';
  loaderMsg.textContent = 'Escaneo completado.';
  await delay(300);

  document.getElementById('splash-loader').style.display = 'none';
  updateScanStep('scan-im', tools.imageMagick, tools.imVersion);
  updateScanStep('scan-gs', tools.ghostscript, tools.gsVersion);
  await delay(200);

  const resultPanel = document.getElementById('splash-result');
  resultPanel.style.display = 'flex';
  resultPanel.style.flexDirection = 'column';
  resultPanel.style.gap = '1rem';

  const allOk = tools.imageMagick && tools.ghostscript;

  if (!allOk) {
    buildInstallPanel(tools);
  }

  document.getElementById('btn-enter').addEventListener('click', enterApp);

  if (!allOk) {
    const skipBtn = document.getElementById('btn-skip');
    skipBtn.style.display = 'block';
    skipBtn.addEventListener('click', enterApp);
  }
}

function updateScanStep(id, ok, version) {
  const el = document.getElementById(id);
  el.classList.add(ok ? 'ok' : 'warn');
  el.querySelector('.scan-icon').textContent = ok ? '✅' : '⚠️';
  el.querySelector('.scan-icon').classList.remove('spinning');
  el.querySelector('.scan-status').textContent = ok
    ? `v${version} — Detectado`
    : 'No encontrado';
}

function buildInstallPanel(tools) {
  const panel   = document.getElementById('install-panel');
  const actions = document.getElementById('install-actions');
  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.gap = '0.75rem';

  if (!tools.imageMagick) {
    const row = document.createElement('div');
    row.className = 'install-row';
    row.innerHTML = `
      <div>
        <div class="install-tool-name">ImageMagick</div>
        <div class="install-tool-note">Se instalará vía winget</div>
      </div>
      <button class="btn-accent btn-sm" id="install-im">Instalar</button>`;
    actions.appendChild(row);
    row.querySelector('#install-im').addEventListener('click', () => installTool('imagemagick', 'install-im', 'scan-im'));
  }

  if (!tools.ghostscript) {
    const row = document.createElement('div');
    row.className = 'install-row';
    row.innerHTML = `
      <div>
        <div class="install-tool-name">Ghostscript</div>
        <div class="install-tool-note">Puede requerir instalación manual</div>
      </div>
      <button class="btn-accent btn-sm" id="install-gs">Instalar</button>`;
    actions.appendChild(row);

    row.querySelector('#install-gs').addEventListener('click', async () => {
      const btn = row.querySelector('#install-gs');
      btn.textContent = 'Instalando...';
      btn.disabled = true;
      const res = await window.api.installTool('ghostscript');
      if (res.ok) {
        updateScanStep('scan-gs', true, 'instalado');
        btn.textContent = '✓ Instalado';
      } else {
        btn.textContent = 'Error';
        document.getElementById('install-manual').style.display = 'flex';
        document.getElementById('install-manual').style.flexDirection = 'column';
        document.getElementById('install-manual').style.gap = '0.5rem';
      }
    });

    document.getElementById('btn-gs-manual').addEventListener('click', () => {
      window.api.openUrl('https://www.ghostscript.com/releases/gsdnld.html');
    });
  }
}

async function installTool(tool, btnId, scanId) {
  const btn = document.getElementById(btnId);
  btn.textContent = 'Instalando...';
  btn.disabled = true;
  const res = await window.api.installTool(tool);
  if (res.ok) {
    updateScanStep(scanId, true, 'instalado');
    btn.textContent = '✓ Listo';
  } else {
    btn.textContent = 'Falló';
    btn.disabled = false;
  }
}

async function enterApp() {
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');

  splash.classList.add('fade-out');
  await delay(450);
  splash.style.display = 'none';

  app.style.display = 'flex';
  await delay(20);
  app.style.opacity = '1';

  initApp();
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────

function initApp() {
  updateStatusBadge();
  bindMenu();
  bindFooterLinks();
}

function updateStatusBadge() {
  const t = state.tools;
  const dot   = document.querySelector('#tools-status .status-dot');
  const label = document.querySelector('#tools-status .status-label');

  if (t.imageMagick && t.ghostscript) {
    dot.className   = 'status-dot ok';
    label.textContent = `IM ${t.imVersion} · GS ${t.gsVersion}`;
  } else if (t.imageMagick || t.ghostscript) {
    dot.className   = 'status-dot warn';
    label.textContent = 'Herramienta faltante';
  } else {
    dot.className   = 'status-dot error';
    label.textContent = 'Sin herramientas';
  }

  document.getElementById('tools-status').title = [
    `ImageMagick: ${t.imageMagick ? '✓ ' + t.imVersion : '✗ No detectado'}`,
    `Ghostscript:  ${t.ghostscript ? '✓ ' + t.gsVersion : '✗ No detectado'}`
  ].join('\n');
}

function bindMenu() {
  document.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.card-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeModule = btn.dataset.module;
      loadModule(btn.dataset.module);
    });
  });
}

function loadModule(mod) {
  const workspace = document.getElementById('workspace');
  workspace.classList.add('active');
  const map = {
    'img-to-pdf': renderImgToPdf,
    'pdf-to-img': renderPdfToImg,
    'merge':      renderMerge,
    'split':      renderSplit,
    'update':     renderUpdate,
  };
  if (map[mod]) map[mod]();
}

function bindFooterLinks() {
  document.getElementById('footer-author').addEventListener('click', e => { e.preventDefault(); window.api.openUrl('https://enfcarloseligio.com/'); });
  document.getElementById('footer-site').addEventListener('click',   e => { e.preventDefault(); window.api.openUrl('https://enfcarloseligio.com/'); });
  document.getElementById('footer-im').addEventListener('click',     e => { e.preventDefault(); window.api.openUrl('https://imagemagick.org'); });
  document.getElementById('footer-gs').addEventListener('click',     e => { e.preventDefault(); window.api.openUrl('https://www.ghostscript.com'); });
}

function bindExternalLinks() {
  document.getElementById('splash-author-link').addEventListener('click', e => { e.preventDefault(); window.api.openUrl('https://enfcarloseligio.com/'); });
  document.getElementById('splash-site-link').addEventListener('click',   () => window.api.openUrl('https://enfcarloseligio.com/'));
}

// ── Utilidades UI ─────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function basename(filePath) { return filePath.replace(/\\/g, '/').split('/').pop(); }

function optButtons(container, options, defaultVal, cb) {
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'opt-btn' + (opt.value === defaultVal ? ' active' : '');
    btn.textContent = opt.label;
    btn.dataset.value = opt.value;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cb(opt.value);
    });
    container.appendChild(btn);
  });
}

function resultBox(type, title, items = []) {
  return `<div class="result-box ${type}">
    <div class="result-title">${title}</div>
    ${items.map(i => `<div class="result-item">${i}</div>`).join('')}
  </div>`;
}

function progressBar(pct) {
  return `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
}

async function pickOutputDir(pathLabelId) {
  const dir = await window.api.selectFolder();
  if (dir) {
    state.outputDir = dir;
    document.getElementById(pathLabelId).textContent = dir;
  }
  return dir;
}

function outputDirRow(id) {
  return `<div class="output-row">
    <button class="btn-secondary btn-sm" id="${id}-pick">📁 Carpeta de salida</button>
    <span class="output-path" id="${id}-path">${state.outputDir || 'No seleccionada'}</span>
  </div>`;
}

function renderFileList(containerId, files, onRemove) {
  const list = document.getElementById(containerId);
  if (!files.length) {
    list.innerHTML = '<span style="font-size:0.78rem;color:var(--muted)">Ningún archivo seleccionado</span>';
    return;
  }
  list.innerHTML = files.map((f, i) => `
    <div class="file-item">
      <span class="file-name">📄 ${basename(f)}</span>
      <button class="file-remove" data-idx="${i}">✕</button>
    </div>`).join('');
  list.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => { if (onRemove) onRemove(files[parseInt(btn.dataset.idx)]); });
  });
}

// ── Drag & Drop Global ────────────────────────────────────────────────────────
function bindDragDrop(zoneId, extensions, onDrop) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-active'); });
  zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('drag-active'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-active');
    
    // Aquí usamos la nueva API para saltar la seguridad de Electron y obtener la ruta real
    const paths = Array.from(e.dataTransfer.files).map(f => window.api.getFilePath(f)).filter(Boolean);
    const valid = paths.filter(p => extensions.includes(p.split('.').pop().toLowerCase()));
    
    if (valid.length) onDrop(valid);
  });
}

// ── Módulo 1: IMG → PDF ───────────────────────────────────────────────────────
function renderImgToPdf() {
  let files = [], quality = 100;
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">🖼️ Imágenes → PDF</div>
    <div class="option-group">
      <label>Calidad</label>
      <div class="option-row" id="q-row"></div>
    </div>
    <div class="file-zone" id="zone-i2p">
      <div class="btn-row">
        <button class="btn-secondary" id="pick-imgs">📂 Seleccionar imágenes (PNG / JPG)</button>
        <span style="font-size:0.75rem; color:var(--muted); margin-left:10px; align-self:center;">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="img-list"><span style="font-size:0.78rem;color:var(--muted)">Ningún archivo seleccionado</span></div>
    </div>
    ${outputDirRow('i2p')}
    <div class="btn-row">
      <button class="btn-primary" id="run-i2p" disabled style="width:auto">Convertir a PDF</button>
    </div>
    <div id="i2p-result"></div>
  </div>`;

  optButtons(document.getElementById('q-row'), [
    { label:'100% — Máxima', value:100 },
    { label:'75% — Alta',    value:75  },
    { label:'50% — Media',   value:50  },
    { label:'25% — Baja',    value:25  },
  ], 100, v => { quality = v; });

  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('img-list', files, onRemove);
    updateRun();
  };

  document.getElementById('pick-imgs').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name:'Imágenes', extensions:['png','jpg','jpeg'] }]);
    if (picked.length) {
      files = [...files, ...picked.filter(f => !files.includes(f))];
      renderFileList('img-list', files, onRemove);
      updateRun();
    }
  });

  bindDragDrop('zone-i2p', ['png','jpg','jpeg'], dropped => {
    files = [...files, ...dropped.filter(f => !files.includes(f))];
    renderFileList('img-list', files, onRemove);
    updateRun();
  });

  document.getElementById('i2p-pick').addEventListener('click', () => pickOutputDir('i2p-path').then(updateRun));

  function updateRun() { document.getElementById('run-i2p').disabled = !(files.length && state.outputDir); }

  document.getElementById('run-i2p').addEventListener('click', async () => {
    const btn = document.getElementById('run-i2p');
    btn.disabled = true; btn.textContent = 'Procesando...';
    document.getElementById('i2p-result').innerHTML = progressBar(40);
    const res = await window.api.convertImgToPdf({ files, quality, outputDir: state.outputDir });
    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('i2p-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} archivo(s) convertido(s)`, ok.map(r => `📄 ${basename(r.out)}`)) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => basename(r.file))) : '');
    btn.disabled = false; btn.textContent = 'Convertir a PDF';
  });
}

// ── Módulo 2: PDF → IMG ───────────────────────────────────────────────────────
function renderPdfToImg() {
  let files = [], density = 300, format = 'png', background = 'original';
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">📄 PDF → Imágenes</div>
    <div class="option-group"><label>Formato de salida</label><div class="option-row" id="fmt-row"></div></div>
    <div class="option-group"><label>Calidad (DPI)</label><div class="option-row" id="dpi-row"></div></div>
    <div class="option-group"><label>Fondo</label><div class="option-row" id="bg-row"></div></div>
    <div class="file-zone" id="zone-p2i">
      <div class="btn-row">
        <button class="btn-secondary" id="pick-pdfs2">📂 Seleccionar PDFs</button>
        <span style="font-size:0.75rem; color:var(--muted); margin-left:10px; align-self:center;">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="pdf2-list"><span style="font-size:0.78rem;color:var(--muted)">Ningún archivo seleccionado</span></div>
    </div>
    ${outputDirRow('p2i')}
    <div class="btn-row"><button class="btn-primary" id="run-p2i" disabled style="width:auto">Extraer imágenes</button></div>
    <div id="p2i-result"></div>
  </div>`;

  optButtons(document.getElementById('fmt-row'), [
    { label:'PNG', value:'png' },
    { label:'JPG', value:'jpg' },
  ], 'png', v => { format = v; updateBg(); });

  optButtons(document.getElementById('dpi-row'), [
    { label:'300 DPI — Máxima', value:300 },
    { label:'200 DPI — Alta',   value:200 },
    { label:'150 DPI — Media',  value:150 },
    { label:'72 DPI — Baja',    value:72  },
  ], 300, v => { density = v; });

  function updateBg() {
    const opts = format === 'png'
      ? [{ label:'Original (transparente)', value:'original' }, { label:'Blanco #FFFFFF', value:'#FFFFFF' }, { label:'Oscuro #202020', value:'#202020' }]
      : [{ label:'Blanco #FFFFFF', value:'#FFFFFF' }, { label:'Oscuro #202020', value:'#202020' }];
    background = opts[0].value;
    optButtons(document.getElementById('bg-row'), opts, opts[0].value, v => { background = v; });
  }
  updateBg();

  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('pdf2-list', files, onRemove);
    updateRun();
  };

  document.getElementById('pick-pdfs2').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name:'PDF', extensions:['pdf'] }]);
    if (picked.length) {
      files = [...files, ...picked.filter(f => !files.includes(f))];
      renderFileList('pdf2-list', files, onRemove);
      updateRun();
    }
  });

  bindDragDrop('zone-p2i', ['pdf'], dropped => {
    files = [...files, ...dropped.filter(f => !files.includes(f))];
    renderFileList('pdf2-list', files, onRemove);
    updateRun();
  });

  document.getElementById('p2i-pick').addEventListener('click', () => pickOutputDir('p2i-path').then(updateRun));

  function updateRun() { document.getElementById('run-p2i').disabled = !(files.length && state.outputDir); }

  document.getElementById('run-p2i').addEventListener('click', async () => {
    const btn = document.getElementById('run-p2i');
    btn.disabled = true; btn.textContent = 'Procesando...';
    document.getElementById('p2i-result').innerHTML = progressBar(40);
    const res = await window.api.convertPdfToImg({ files, density, format, background, outputDir: state.outputDir });
    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('p2i-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} PDF(s) extraído(s)`, ok.map(r => `📄 ${basename(r.file)}`)) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => basename(r.file))) : '');
    btn.disabled = false; btn.textContent = 'Extraer imágenes';
  });
}

// ── Módulo 3: Unir PDFs ───────────────────────────────────────────────────────
function renderMerge() {
  let files = [];
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">📑 Unir PDFs</div>
    <p style="font-size:0.8rem;color:var(--muted)">Selecciona los archivos en el orden en que quieres unirlos. Usa ↑↓ para reordenar.</p>
    <div class="file-zone" id="zone-mrg">
      <div class="btn-row">
        <button class="btn-secondary" id="pick-merge">📂 Agregar PDFs</button>
        <span style="font-size:0.75rem; color:var(--muted); margin-left:10px; align-self:center;">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="merge-list"><span style="font-size:0.78rem;color:var(--muted)">Ningún archivo seleccionado</span></div>
    </div>
    ${outputDirRow('mrg')}
    <div class="btn-row">
      <button class="btn-primary" id="run-merge" disabled style="width:auto">Unir PDFs</button>
      <button class="btn-secondary" id="clear-merge">Limpiar lista</button>
    </div>
    <div id="merge-result"></div>
  </div>`;

  function renderList() {
    const list = document.getElementById('merge-list');
    if (!files.length) { list.innerHTML = '<span style="font-size:0.78rem;color:var(--muted)">Ningún archivo seleccionado</span>'; return; }
    list.innerHTML = files.map((f, i) => `
      <div class="file-item">
        <span style="color:var(--muted);font-size:0.72rem;width:18px;flex-shrink:0">${i+1}.</span>
        <span class="file-name">📄 ${basename(f)}</span>
        <div style="display:flex;gap:0.2rem">
          ${i > 0 ? `<button class="file-remove" data-a="up" data-i="${i}">↑</button>` : ''}
          ${i < files.length-1 ? `<button class="file-remove" data-a="down" data-i="${i}">↓</button>` : ''}
          <button class="file-remove" data-a="rm" data-i="${i}">✕</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.i), a = btn.dataset.a;
        if (a === 'rm') files.splice(i, 1);
        else if (a === 'up') [files[i-1], files[i]] = [files[i], files[i-1]];
        else if (a === 'down') [files[i], files[i+1]] = [files[i+1], files[i]];
        renderList(); updateRun();
      });
    });
  }

  document.getElementById('pick-merge').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name:'PDF', extensions:['pdf'] }]);
    if (!picked.length) return;
    const dups = picked.filter(f => files.includes(f));
    files = [...files, ...picked.filter(f => !files.includes(f))];
    renderList(); updateRun();
    if (dups.length) document.getElementById('merge-result').innerHTML = resultBox('warning', `⚠ ${dups.length} archivo(s) ya estaban en la lista`, dups.map(basename));
  });

  bindDragDrop('zone-mrg', ['pdf'], dropped => {
    const dups = dropped.filter(f => files.includes(f));
    files = [...files, ...dropped.filter(f => !files.includes(f))];
    renderList(); updateRun();
    if (dups.length) document.getElementById('merge-result').innerHTML = resultBox('warning', `⚠ ${dups.length} archivo(s) ya estaban en la lista`, dups.map(basename));
  });

  document.getElementById('clear-merge').addEventListener('click', () => { files = []; renderList(); updateRun(); document.getElementById('merge-result').innerHTML = ''; });
  document.getElementById('mrg-pick').addEventListener('click', () => pickOutputDir('mrg-path').then(updateRun));

  function updateRun() { document.getElementById('run-merge').disabled = !(files.length >= 2 && state.outputDir); }

  document.getElementById('run-merge').addEventListener('click', async () => {
    const btn = document.getElementById('run-merge');
    btn.disabled = true; btn.textContent = 'Uniendo...';
    document.getElementById('merge-result').innerHTML = progressBar(50);
    const res = await window.api.mergePdfs({ files, outputDir: state.outputDir });
    document.getElementById('merge-result').innerHTML = res.ok
      ? resultBox('success', '✓ PDFs unidos correctamente', [`📄 ${basename(res.out)}`])
      : resultBox('error', '✗ Error al unir', [res.error]);
    btn.disabled = false; btn.textContent = 'Unir PDFs';
  });
}

// ── Módulo 4: Separar PDF (Con Múltiples Rangos Personalizados) ───────────────
function renderSplit() {
  let file = null, totalPages = 0;
  let mode = 'individual', blockSize = 5, customRanges = '1-5, 6-10';
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">✂️ Separar PDF</div>
    
    <!-- PASO 1: Archivo -->
    <div class="file-zone" id="zone-spl">
      <div class="btn-row">
        <button class="btn-secondary" id="pick-split">📂 Seleccionar PDF</button>
        <span style="font-size:0.75rem; color:var(--muted); margin-left:10px; align-self:center;">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="split-file"><span style="font-size:0.78rem;color:var(--muted)">Ningún archivo seleccionado</span></div>
    </div>

    <!-- PASO 2: Opciones (Se muestran tras cargar el PDF) -->
    <div id="split-wizard" style="display:none; flex-direction:column; gap:1.25rem;">
      <div class="option-group"><label>Modo de separación</label><div class="option-row" id="mode-row"></div></div>
      <div id="mode-opts"></div>
      
      <!-- RESUMEN -->
      <div class="summary-box" id="split-summary"></div>

      ${outputDirRow('spl')}
      <div class="btn-row"><button class="btn-primary" id="run-split" disabled style="width:auto">Ejecutar separación</button></div>
      <div id="split-result"></div>
    </div>
  </div>`;

  // Bind Select & Drop
  document.getElementById('pick-split').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name:'PDF', extensions:['pdf'] }]);
    if (picked.length) processFile(picked[0]);
  });
  
  bindDragDrop('zone-spl', ['pdf'], dropped => {
    if(dropped.length) processFile(dropped[0]); 
  });

  // Procesar archivo y contar páginas
  async function processFile(selectedPath) {
    file = selectedPath;
    document.getElementById('split-file').innerHTML = `
      <div class="file-item">
        <span class="file-name">📄 ${basename(file)}</span>
        <span style="font-size:0.75rem;color:var(--warning);" id="calc-pages">⏳ Calculando páginas...</span>
        <button class="file-remove" id="rm-split">✕</button>
      </div>`;
    
    document.getElementById('rm-split').addEventListener('click', () => {
      file = null; totalPages = 0;
      document.getElementById('split-file').innerHTML = '<span style="font-size:0.78rem;color:var(--muted)">Ningún archivo seleccionado</span>';
      document.getElementById('split-wizard').style.display = 'none';
      document.getElementById('run-split').disabled = true;
    });

    // Llamada rápida a Magick para no saturar memoria
    const info = await window.api.getPdfInfo(file);
    if (!info.ok || info.pages === 0) {
      document.getElementById('calc-pages').textContent = '✗ Error al leer PDF';
      document.getElementById('calc-pages').style.color = 'var(--error)';
      return;
    }

    totalPages = info.pages;
    customRanges = `1-${totalPages}`; // Resetear rango al total del archivo
    document.getElementById('calc-pages').textContent = `✓ ${totalPages} páginas`;
    document.getElementById('calc-pages').style.color = 'var(--success)';
    
    // Mostrar Wizard
    document.getElementById('split-wizard').style.display = 'flex';
    renderModeOpts();
    updateSummary();
  }

  // Modos
  optButtons(document.getElementById('mode-row'), [
    { label:'Página por página',  value:'individual' },
    { label:'Bloques fijos',      value:'block'      },
    { label:'Rangos múltiples',   value:'custom'     },
  ], 'individual', v => { mode = v; renderModeOpts(); updateSummary(); });

  function renderModeOpts() {
    const el = document.getElementById('mode-opts');
    if (mode === 'individual') {
      el.innerHTML = '';
    } else if (mode === 'block') {
      el.innerHTML = `<div class="range-row"><span>Dividir en bloques de:</span><input type="number" class="num-input" id="bsize" value="${blockSize}" min="1"> <span>páginas.</span></div>`;
      document.getElementById('bsize').addEventListener('input', e => { blockSize = parseInt(e.target.value) || 1; updateSummary(); });
    } else {
      el.innerHTML = `<div class="range-row" style="flex-direction:column; align-items:flex-start;">
        <span style="font-size:0.8rem; color:var(--muted)">Puedes extraer capítulos enteros. Escribe los rangos separados por comas:</span>
        <input type="text" class="num-input" style="width:100%; text-align:left;" id="cranges" value="${customRanges}" placeholder="Ejemplo: 1-15, 16-30, 31-40">
      </div>`;
      document.getElementById('cranges').addEventListener('input', e => { customRanges = e.target.value; updateSummary(); });
    }
  }

  // Resumen Dinámico
  function updateSummary() {
    const el = document.getElementById('split-summary');
    let text = `<strong>Resumen de la operación:</strong><br>`;

    let isValid = true;
    if (mode === 'individual') {
      text += `↳ Se generarán <strong>${totalPages} documentos nuevos</strong> (1 página cada uno).`;
    } else if (mode === 'block') {
      const parts = Math.ceil(totalPages / blockSize);
      text += `↳ Se generarán <strong>${parts} documentos nuevos</strong> (de máximo ${blockSize} páginas cada uno).`;
    } else {
      const parts = customRanges.split(',').map(s => s.trim()).filter(s => s);
      if (!parts.length) { 
        text += `<span style="color:var(--error)">⚠ Ingresa al menos un rango válido (Ej: 1-12, 13-20).</span>`; 
        isValid = false; 
      } else { 
        text += `↳ Se extraerán <strong>${parts.length} capítulos/documentos independientes</strong>.`; 
      }
    }
    
    el.innerHTML = text;
    document.getElementById('run-split').disabled = !(file && state.outputDir && isValid);
  }

  // Ejecución
  document.getElementById('spl-pick').addEventListener('click', () => pickOutputDir('spl-path').then(updateSummary));

  document.getElementById('run-split').addEventListener('click', async () => {
    const btn = document.getElementById('run-split');
    btn.disabled = true; btn.textContent = 'Procesando...';
    document.getElementById('split-result').innerHTML = progressBar(30);
    
    const res = await window.api.splitPdf({ file, mode, blockSize, customRanges, outputDir: state.outputDir, totalPages });
    
    if (!res.ok) {
      document.getElementById('split-result').innerHTML = resultBox('error', '✗ Error', [res.error]);
    } else {
      const ok = res.results.filter(r => r.ok), err = res.results.filter(r => !r.ok);
      document.getElementById('split-result').innerHTML =
        (ok.length  ? resultBox('success', `✓ ${ok.length} archivo(s) generado(s)`, ok.map(r => `📄 ${basename(r.out)}`)) : '') +
        (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => r.error)) : '');
    }
    btn.disabled = false; btn.textContent = 'Ejecutar separación';
  });
}

// ── Módulo 5: Actualizar ──────────────────────────────────────────────────────
function renderUpdate() {
  const t = state.tools;
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">🔄 Actualizar dependencias</div>
    <p style="font-size:0.8rem;color:var(--muted)">Verifica e instala actualizaciones disponibles para ImageMagick y Ghostscript vía winget.</p>

    <div class="update-card">
      <div>
        <div class="update-tool-name">ImageMagick</div>
        <div class="update-tool-ver">${t.imageMagick ? 'v' + t.imVersion : 'No instalado'}</div>
      </div>
      <span class="update-badge ${t.imageMagick ? 'ok' : 'miss'}">${t.imageMagick ? '✓ Instalado' : '✗ Faltante'}</span>
    </div>

    <div class="update-card">
      <div>
        <div class="update-tool-name">Ghostscript</div>
        <div class="update-tool-ver">${t.ghostscript ? 'v' + t.gsVersion : 'No instalado'}</div>
      </div>
      <span class="update-badge ${t.ghostscript ? 'ok' : 'miss'}">${t.ghostscript ? '✓ Instalado' : '✗ Faltante'}</span>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="run-update" style="width:auto">Buscar y aplicar actualizaciones</button>
      <button class="btn-accent" id="open-gs-site">Descargar Ghostscript manualmente</button>
    </div>
    <div id="update-result"></div>
  </div>`;

  document.getElementById('open-gs-site').addEventListener('click', () => {
    window.api.openUrl('https://www.ghostscript.com/releases/gsdnld.html');
  });

  document.getElementById('run-update').addEventListener('click', async () => {
    const btn = document.getElementById('run-update');
    btn.disabled = true; btn.textContent = 'Actualizando...';
    document.getElementById('update-result').innerHTML = progressBar(40);
    const res = await window.api.updateTools();
    document.getElementById('update-result').innerHTML =
      resultBox('info', '🔄 Proceso de actualización completado', [
        `ImageMagick: ${res.imagemagick === 'ok' ? '✓ Sin novedades o actualizado' : '⚠ Revisar manualmente'}`,
        `Ghostscript: ${res.ghostscript  === 'ok' ? '✓ Sin novedades o actualizado' : '⚠ Revisar manualmente'}`,
        'Si se instaló alguna actualización, reinicia la aplicación para detectar la nueva versión.'
      ]);
    btn.disabled = false; btn.textContent = 'Buscar y aplicar actualizaciones';
  });
}