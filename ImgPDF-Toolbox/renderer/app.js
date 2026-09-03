// ── Estado global ─────────────────────────────────────────────────────────────
const state = {
  activeModule: null,
  outputDir: null,
  tools: { imageMagick: false, ghostscript: false }
};

// ── Referencias DOM ───────────────────────────────────────────────────────────
const workspace   = document.getElementById('workspace');
const toolsStatus = document.getElementById('tools-status');

// ── Inicialización ────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await checkTools();
  bindMenu();
});

// ── Verificar herramientas ────────────────────────────────────────────────────
async function checkTools() {
  const tools = await window.api.checkTools();
  state.tools = tools;

  const dot   = toolsStatus.querySelector('.status-dot');
  const label = toolsStatus.querySelector('.status-label');

  if (tools.imageMagick && tools.ghostscript) {
    dot.className   = 'status-dot ok';
    label.textContent = `IM ${tools.imVersion} · GS ${tools.gsVersion}`;
  } else if (tools.imageMagick || tools.ghostscript) {
    dot.className   = 'status-dot warn';
    label.textContent = 'Herramienta faltante';
  } else {
    dot.className   = 'status-dot error';
    label.textContent = 'Sin herramientas detectadas';
  }

  toolsStatus.title = [
    `ImageMagick: ${tools.imageMagick ? '✓ ' + tools.imVersion : '✗ No detectado'}`,
    `Ghostscript:  ${tools.ghostscript ? '✓ ' + tools.gsVersion : '✗ No detectado'}`
  ].join('\n');
}

// ── Menú principal ────────────────────────────────────────────────────────────
function bindMenu() {
  document.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.card-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mod = btn.dataset.module;
      state.activeModule = mod;
      loadModule(mod);
    });
  });
}

function loadModule(mod) {
  workspace.classList.add('active');
  const map = {
    'img-to-pdf': renderImgToPdf,
    'pdf-to-img': renderPdfToImg,
    'merge':      renderMerge,
    'split':      renderSplit,
  };
  if (map[mod]) map[mod]();
}

// ── Utilidades UI ─────────────────────────────────────────────────────────────

function basename(filePath) {
  return filePath.replace(/\\/g, '/').split('/').pop();
}

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
  return `
    <div class="result-box ${type}">
      <div class="result-title">${title}</div>
      ${items.map(i => `<div class="result-item">${i}</div>`).join('')}
    </div>`;
}

function progressBar(pct) {
  return `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
}

async function pickOutputDir() {
  const dir = await window.api.selectFolder();
  if (dir) state.outputDir = dir;
  return dir;
}

function outputDirRow(labelId) {
  return `
    <div class="output-row">
      <button class="btn-secondary btn-sm" id="${labelId}-pick">📁 Carpeta de salida</button>
      <span class="output-path" id="${labelId}-path">${state.outputDir || 'No seleccionada'}</span>
    </div>`;
}

// ── Módulo 1: IMG → PDF ───────────────────────────────────────────────────────
function renderImgToPdf() {
  let files = [];
  let quality = 100;

  workspace.innerHTML = `
    <div class="module">
      <div class="module-title">🖼️ Imágenes → PDF</div>

      <div class="option-group">
        <label>Formato de entrada</label>
        <div class="option-row" id="fmt-row"></div>
      </div>

      <div class="option-group">
        <label>Calidad</label>
        <div class="option-row" id="quality-row"></div>
      </div>

      <div class="file-zone">
        <div class="btn-row">
          <button class="btn-secondary" id="pick-imgs">📂 Seleccionar imágenes</button>
        </div>
        <div class="file-list" id="img-list"><span style="font-size:0.8rem;color:var(--color-muted)">Ningún archivo seleccionado</span></div>
      </div>

      ${outputDirRow('img2pdf')}

      <div class="btn-row">
        <button class="btn-primary" id="run-img2pdf" disabled>Convertir a PDF</button>
      </div>
      <div id="img2pdf-result"></div>
    </div>`;

  // Formatos
  let extensions = ['png', 'jpg'];
  optButtons(document.getElementById('fmt-row'), [
    { label: 'PNG', value: ['png'] },
    { label: 'JPG / JPEG', value: ['jpg', 'jpeg'] },
    { label: 'PNG + JPG', value: ['png', 'jpg', 'jpeg'] },
  ], ['png'], val => { extensions = val; });

  // Calidad
  optButtons(document.getElementById('quality-row'), [
    { label: '100% — Máxima', value: 100 },
    { label: '75% — Alta',    value: 75 },
    { label: '50% — Media',   value: 50 },
    { label: '25% — Baja',    value: 25 },
  ], 100, val => { quality = val; });

  // Seleccionar imágenes
  document.getElementById('pick-imgs').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg'] }
    ]);
    if (picked.length) {
      files = [...files, ...picked.filter(f => !files.includes(f))];
      renderFileList('img-list', files, f => { files = files.filter(x => x !== f); renderFileList('img-list', files); updateRun(); });
      updateRun();
    }
  });

  // Carpeta de salida
  document.getElementById('img2pdf-pick').addEventListener('click', async () => {
    const dir = await pickOutputDir();
    if (dir) document.getElementById('img2pdf-path').textContent = dir;
    updateRun();
  });

  function updateRun() {
    document.getElementById('run-img2pdf').disabled = !(files.length > 0 && state.outputDir);
  }

  // Ejecutar conversión
  document.getElementById('run-img2pdf').addEventListener('click', async () => {
    const btn = document.getElementById('run-img2pdf');
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    document.getElementById('img2pdf-result').innerHTML = progressBar(30);

    const res = await window.api.convertImgToPdf({ files, quality, outputDir: state.outputDir });

    const ok  = res.filter(r => r.ok);
    const err = res.filter(r => !r.ok);

    let html = '';
    if (ok.length)  html += resultBox('success', `✓ ${ok.length} archivo(s) convertido(s)`,  ok.map(r => `📄 ${basename(r.out)}`));
    if (err.length) html += resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`));

    document.getElementById('img2pdf-result').innerHTML = html;
    btn.disabled = false;
    btn.textContent = 'Convertir a PDF';
  });
}

// ── Módulo 2: PDF → IMG ───────────────────────────────────────────────────────
function renderPdfToImg() {
  let files   = [];
  let density = 300;
  let format  = 'png';
  let background = 'original';

  workspace.innerHTML = `
    <div class="module">
      <div class="module-title">📄 PDF → Imágenes</div>

      <div class="option-group">
        <label>Formato de salida</label>
        <div class="option-row" id="out-fmt-row"></div>
      </div>

      <div class="option-group">
        <label>Calidad (DPI)</label>
        <div class="option-row" id="dpi-row"></div>
      </div>

      <div class="option-group" id="bg-group">
        <label>Fondo</label>
        <div class="option-row" id="bg-row"></div>
      </div>

      <div class="file-zone">
        <div class="btn-row">
          <button class="btn-secondary" id="pick-pdfs-img">📂 Seleccionar PDFs</button>
        </div>
        <div class="file-list" id="pdf-img-list"><span style="font-size:0.8rem;color:var(--color-muted)">Ningún archivo seleccionado</span></div>
      </div>

      ${outputDirRow('pdf2img')}

      <div class="btn-row">
        <button class="btn-primary" id="run-pdf2img" disabled>Extraer imágenes</button>
      </div>
      <div id="pdf2img-result"></div>
    </div>`;

  // Formato salida
  optButtons(document.getElementById('out-fmt-row'), [
    { label: 'PNG', value: 'png' },
    { label: 'JPG', value: 'jpg' },
  ], 'png', val => {
    format = val;
    updateBgOptions();
  });

  // DPI
  optButtons(document.getElementById('dpi-row'), [
    { label: '300 DPI — Máxima', value: 300 },
    { label: '200 DPI — Alta',   value: 200 },
    { label: '150 DPI — Media',  value: 150 },
    { label: '72 DPI — Baja',    value: 72 },
  ], 300, val => { density = val; });

  // Fondo (dinámico según formato)
  function updateBgOptions() {
    const opts = format === 'png'
      ? [
          { label: 'Original (transparente)', value: 'original' },
          { label: 'Blanco #FFFFFF',          value: '#FFFFFF' },
          { label: 'Oscuro #202020',          value: '#202020' },
        ]
      : [
          { label: 'Blanco #FFFFFF', value: '#FFFFFF' },
          { label: 'Oscuro #202020', value: '#202020' },
        ];
    background = opts[0].value;
    optButtons(document.getElementById('bg-row'), opts, opts[0].value, val => { background = val; });
  }
  updateBgOptions();

  // Seleccionar PDFs
  document.getElementById('pick-pdfs-img').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'Documentos PDF', extensions: ['pdf'] }]);
    if (picked.length) {
      files = [...files, ...picked.filter(f => !files.includes(f))];
      renderFileList('pdf-img-list', files, f => { files = files.filter(x => x !== f); renderFileList('pdf-img-list', files); updateRun(); });
      updateRun();
    }
  });

  document.getElementById('pdf2img-pick').addEventListener('click', async () => {
    const dir = await pickOutputDir();
    if (dir) document.getElementById('pdf2img-path').textContent = dir;
    updateRun();
  });

  function updateRun() {
    document.getElementById('run-pdf2img').disabled = !(files.length > 0 && state.outputDir);
  }

  document.getElementById('run-pdf2img').addEventListener('click', async () => {
    const btn = document.getElementById('run-pdf2img');
    btn.disabled = true; btn.textContent = 'Procesando...';
    document.getElementById('pdf2img-result').innerHTML = progressBar(30);

    const res = await window.api.convertPdfToImg({ files, density, format, background, outputDir: state.outputDir });

    const ok  = res.filter(r => r.ok);
    const err = res.filter(r => !r.ok);
    let html = '';
    if (ok.length)  html += resultBox('success', `✓ ${ok.length} PDF(s) extraído(s)`, ok.map(r => `📄 ${basename(r.file)}`));
    if (err.length) html += resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`));

    document.getElementById('pdf2img-result').innerHTML = html;
    btn.disabled = false; btn.textContent = 'Extraer imágenes';
  });
}

// ── Módulo 3: Unir PDFs ───────────────────────────────────────────────────────
function renderMerge() {
  let files = [];

  workspace.innerHTML = `
    <div class="module">
      <div class="module-title">📑 Unir PDFs</div>
      <p style="font-size:0.83rem;color:var(--color-muted)">Selecciona los archivos en el orden en que quieres unirlos. Puedes reordenarlos arrastrando.</p>

      <div class="file-zone">
        <div class="btn-row">
          <button class="btn-secondary" id="pick-pdfs-merge">📂 Agregar PDFs</button>
        </div>
        <div class="file-list" id="merge-list"><span style="font-size:0.8rem;color:var(--color-muted)">Ningún archivo seleccionado</span></div>
      </div>

      ${outputDirRow('merge')}

      <div class="btn-row">
        <button class="btn-primary" id="run-merge" disabled>Unir PDFs</button>
        <button class="btn-secondary" id="clear-merge">Limpiar lista</button>
      </div>
      <div id="merge-result"></div>
    </div>`;

  document.getElementById('pick-pdfs-merge').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'Documentos PDF', extensions: ['pdf'] }]);
    if (!picked.length) return;

    // Detectar duplicados
    const dups = picked.filter(f => files.includes(f));
    const news = picked.filter(f => !files.includes(f));

    files = [...files, ...news];
    renderMergeList();
    updateRun();

    if (dups.length) {
      document.getElementById('merge-result').innerHTML = resultBox('info',
        `⚠ ${dups.length} archivo(s) ya estaban en la lista y no se agregaron de nuevo.`,
        dups.map(basename)
      );
    }
  });

  function renderMergeList() {
    const list = document.getElementById('merge-list');
    if (!files.length) {
      list.innerHTML = '<span style="font-size:0.8rem;color:var(--color-muted)">Ningún archivo seleccionado</span>';
      return;
    }
    list.innerHTML = files.map((f, i) => `
      <div class="file-item" data-index="${i}">
        <span style="color:var(--color-muted);font-size:0.75rem;width:20px;flex-shrink:0">${i + 1}.</span>
        <span class="file-name">📄 ${basename(f)}</span>
        <div style="display:flex;gap:0.25rem">
          ${i > 0 ? `<button class="file-remove" data-action="up" data-idx="${i}" title="Subir">↑</button>` : ''}
          ${i < files.length - 1 ? `<button class="file-remove" data-action="down" data-idx="${i}" title="Bajar">↓</button>` : ''}
          <button class="file-remove" data-action="remove" data-idx="${i}" title="Quitar">✕</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('.file-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const action = btn.dataset.action;
        if (action === 'remove') {
          files.splice(idx, 1);
        } else if (action === 'up') {
          [files[idx - 1], files[idx]] = [files[idx], files[idx - 1]];
        } else if (action === 'down') {
          [files[idx], files[idx + 1]] = [files[idx + 1], files[idx]];
        }
        renderMergeList();
        updateRun();
      });
    });
  }

  document.getElementById('clear-merge').addEventListener('click', () => {
    files = [];
    renderMergeList();
    updateRun();
    document.getElementById('merge-result').innerHTML = '';
  });

  document.getElementById('merge-pick').addEventListener('click', async () => {
    const dir = await pickOutputDir();
    if (dir) document.getElementById('merge-path').textContent = dir;
    updateRun();
  });

  function updateRun() {
    document.getElementById('run-merge').disabled = !(files.length >= 2 && state.outputDir);
  }

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

// ── Módulo 4: Separar PDF ─────────────────────────────────────────────────────
function renderSplit() {
  let file = null;
  let mode = 'individual';
  let blockSize = 5;
  let rangeStart = 1;
  let rangeEnd = 5;

  workspace.innerHTML = `
    <div class="module">
      <div class="module-title">✂️ Separar PDF</div>

      <div class="file-zone">
        <div class="btn-row">
          <button class="btn-secondary" id="pick-pdf-split">📂 Seleccionar PDF</button>
        </div>
        <div class="file-list" id="split-file"><span style="font-size:0.8rem;color:var(--color-muted)">Ningún archivo seleccionado</span></div>
      </div>

      <div class="option-group">
        <label>Modo de separación</label>
        <div class="option-row" id="mode-row"></div>
      </div>

      <div id="mode-options"></div>

      ${outputDirRow('split')}

      <div class="btn-row">
        <button class="btn-primary" id="run-split" disabled>Separar PDF</button>
      </div>
      <div id="split-result"></div>
    </div>`;

  // Seleccionar archivo
  document.getElementById('pick-pdf-split').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'Documentos PDF', extensions: ['pdf'] }]);
    if (picked.length) {
      file = picked[0];
      document.getElementById('split-file').innerHTML = `
        <div class="file-item">
          <span class="file-name">📄 ${basename(file)}</span>
          <button class="file-remove" id="remove-split-file">✕</button>
        </div>`;
      document.getElementById('remove-split-file').addEventListener('click', () => {
        file = null;
        document.getElementById('split-file').innerHTML = '<span style="font-size:0.8rem;color:var(--color-muted)">Ningún archivo seleccionado</span>';
        updateRun();
      });
      updateRun();
    }
  });

  // Modos
  optButtons(document.getElementById('mode-row'), [
    { label: 'Hojas individuales', value: 'individual' },
    { label: 'Por bloques',        value: 'block' },
    { label: 'Rango específico',   value: 'range' },
  ], 'individual', val => {
    mode = val;
    renderModeOptions();
  });

  function renderModeOptions() {
    const el = document.getElementById('mode-options');
    if (mode === 'individual') {
      el.innerHTML = `<p style="font-size:0.8rem;color:var(--color-muted)">Cada página del PDF se guardará como un archivo independiente.</p>`;
    } else if (mode === 'block') {
      el.innerHTML = `
        <div class="range-row">
          <span>Páginas por bloque:</span>
          <input type="number" class="num-input" id="block-size" value="${blockSize}" min="1" max="999">
        </div>`;
      document.getElementById('block-size').addEventListener('input', e => { blockSize = parseInt(e.target.value) || 5; });
    } else {
      el.innerHTML = `
        <div class="range-row">
          <span>De página</span>
          <input type="number" class="num-input" id="range-start" value="${rangeStart}" min="1">
          <span>a página</span>
          <input type="number" class="num-input" id="range-end" value="${rangeEnd}" min="1">
        </div>`;
      document.getElementById('range-start').addEventListener('input', e => { rangeStart = parseInt(e.target.value) || 1; });
      document.getElementById('range-end').addEventListener('input',   e => { rangeEnd   = parseInt(e.target.value) || 1; });
    }
  }
  renderModeOptions();

  document.getElementById('split-pick').addEventListener('click', async () => {
    const dir = await pickOutputDir();
    if (dir) document.getElementById('split-path').textContent = dir;
    updateRun();
  });

  function updateRun() {
    document.getElementById('run-split').disabled = !(file && state.outputDir);
  }

  document.getElementById('run-split').addEventListener('click', async () => {
    const btn = document.getElementById('run-split');
    btn.disabled = true; btn.textContent = 'Procesando...';
    document.getElementById('split-result').innerHTML = progressBar(30);

    const res = await window.api.splitPdf({
      file, mode, blockSize, rangeStart, rangeEnd, outputDir: state.outputDir
    });

    if (!res.ok) {
      document.getElementById('split-result').innerHTML = resultBox('error', '✗ Error', [res.error]);
    } else {
      const ok  = res.results.filter(r => r.ok);
      const err = res.results.filter(r => !r.ok);
      let html = resultBox('info', `📄 Total páginas detectadas: ${res.totalPages}`);
      if (ok.length)  html += resultBox('success', `✓ ${ok.length} archivo(s) generado(s)`, ok.map(r => `📄 ${basename(r.out)}`));
      if (err.length) html += resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => r.error));
      document.getElementById('split-result').innerHTML = html;
    }

    btn.disabled = false; btn.textContent = 'Separar PDF';
  });
}

// ── Helper: renderizar lista de archivos genérica ─────────────────────────────
function renderFileList(containerId, files, onRemove) {
  const list = document.getElementById(containerId);
  if (!files.length) {
    list.innerHTML = '<span style="font-size:0.8rem;color:var(--color-muted)">Ningún archivo seleccionado</span>';
    return;
  }
  list.innerHTML = files.map((f, i) => `
    <div class="file-item">
      <span class="file-name">📄 ${basename(f)}</span>
      <button class="file-remove" data-idx="${i}">✕</button>
    </div>`).join('');

  list.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onRemove) onRemove(files[parseInt(btn.dataset.idx)]);
    });
  });
}