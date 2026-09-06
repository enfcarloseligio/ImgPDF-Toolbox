// ── core/ui-utils.js ──────────────────────────────────────────────────────────
// Helpers de UI compartidos por todos los módulos.
// No contienen lógica de negocio ni referencias a módulos específicos.

// ── Tiempo y paths ────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function basename(filePath) {
  return (filePath || '').replace(/\\/g, '/').split('/').pop();
}

function dirname(filePath) {
  const norm = (filePath || '').replace(/\\/g, '/');
  return norm.substring(0, norm.lastIndexOf('/'));
}

// ── Persistencia de configuración por módulo ──────────────────────────────────
// Guarda y carga preferencias en settings.json vía main.js
// Uso: await saveModuleConfig('img-to-pdf', { quality: 75 })
//      const cfg = await loadModuleConfig('img-to-pdf', { quality: 100 })

async function saveModuleConfig(moduleId, config) {
  try {
    const key      = `moduleConfig_${moduleId}`;
    const existing = await window.api.storeGet(key) || {};
    await window.api.storeSet(key, { ...existing, ...config });
  } catch (_) {}
}

async function loadModuleConfig(moduleId, defaults = {}) {
  try {
    const key    = `moduleConfig_${moduleId}`;
    const stored = await window.api.storeGet(key);
    if (!stored) return { ...defaults };
    // Fusionar: valores guardados tienen prioridad sobre defaults
    return { ...defaults, ...stored };
  } catch (_) {
    return { ...defaults };
  }
}

// ── Componentes de UI ─────────────────────────────────────────────────────────

// optButtons: crea botones de opción y marca el activo
// Ahora acepta un callback opcional onSave para persistir al cambiar
function optButtons(container, options, defaultVal, cb, onSave) {
  if (!container) return;
  container.innerHTML = '';
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className   = 'opt-btn' + (opt.value === defaultVal ? ' active' : '');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      container.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cb(opt.value);
      if (onSave) onSave(opt.value);
    });
    container.appendChild(btn);
  });
}

// resultBox: usa addEventListener en lugar de onclick inline para evitar
// problemas con rutas que contengan comillas o caracteres especiales
function resultBox(type, title, items = [], canOpenFolder = false) {
  const id  = canOpenFolder && state.outputDir ? `open-dir-${Date.now()}` : null;
  const btn = id ? `<button class="btn-open-dir" id="${id}">📁 Abrir carpeta de salida</button>` : '';

  const html = `<div class="result-box ${type}">
    <div class="result-title">${title}</div>
    ${items.map(i => `<div class="result-item">${i}</div>`).join('')}
    ${btn}
  </div>`;

  if (id) {
    requestAnimationFrame(() => {
      document.getElementById(id)?.addEventListener('click', () => {
        window.api.openFolder(state.outputDir);
      });
    });
  }
  return html;
}

function progressBar(pct = 40) {
  return `<div class="progress-bar">
    <div class="progress-fill" style="width:${pct}%"></div>
  </div>`;
}

function outputDirRow(id) {
  const saved = state.outputDir || 'No seleccionada';
  return `<div class="output-row">
    <button class="btn-secondary btn-sm" id="${id}-pick">📁 Carpeta de salida</button>
    <span class="output-path" id="${id}-path">${saved}</span>
  </div>`;
}

// ── Listas de archivos ────────────────────────────────────────────────────────

function renderFileList(containerId, files, onRemove) {
  const list = document.getElementById(containerId);
  if (!list) return;

  if (!files.length) {
    list.innerHTML = '<span class="file-empty">Ningún archivo seleccionado</span>';
    return;
  }

  list.innerHTML = files.map((f, i) => `
    <div class="file-item">
      <span class="file-name">📄 ${basename(f)}</span>
      <button class="file-remove" data-idx="${i}" title="Quitar">✕</button>
    </div>`).join('');

  list.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onRemove) onRemove(files[parseInt(btn.dataset.idx)]);
    });
  });
}

// Lista con controles de orden ↑↓ para el módulo Merge
function renderOrderedFileList(containerId, files, onChange) {
  const list = document.getElementById(containerId);
  if (!list) return;

  if (!files.length) {
    list.innerHTML = '<span class="file-empty">Ningún archivo seleccionado</span>';
    return;
  }

  list.innerHTML = files.map((f, i) => `
    <div class="file-item">
      <span class="file-order">${i + 1}.</span>
      <span class="file-name">📄 ${basename(f)}</span>
      <div class="file-actions">
        ${i > 0               ? `<button class="file-remove" data-act="up"   data-i="${i}" title="Subir">↑</button>`  : ''}
        ${i < files.length-1  ? `<button class="file-remove" data-act="down" data-i="${i}" title="Bajar">↓</button>` : ''}
        <button class="file-remove" data-act="rm" data-i="${i}" title="Quitar">✕</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.i), act = btn.dataset.act;
      if      (act === 'rm')   files.splice(idx, 1);
      else if (act === 'up')   [files[idx-1], files[idx]]   = [files[idx], files[idx-1]];
      else if (act === 'down') [files[idx],   files[idx+1]] = [files[idx+1], files[idx]];
      onChange(files);
    });
  });
}

// ── Drag & Drop ───────────────────────────────────────────────────────────────

function bindDragDrop(zoneId, extensions, onDrop) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-active'); });
  zone.addEventListener('dragleave', e => { e.preventDefault(); zone.classList.remove('drag-active'); });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-active');
    const paths = Array.from(e.dataTransfer.files)
      .map(f => window.api.getFilePath(f))
      .filter(p => p && extensions.includes(p.split('.').pop().toLowerCase()));
    if (paths.length) onDrop(paths);
    else showNotification('warning', `Solo se aceptan archivos: ${extensions.join(', ').toUpperCase()}`);
  });
}

// ── Carpeta de salida ─────────────────────────────────────────────────────────

async function pickOutputDir(pathLabelId) {
  const dir = await window.api.selectFolder();
  if (dir) {
    setOutputDir(dir);
    const el = document.getElementById(pathLabelId);
    if (el) el.textContent = dir;
  }
  return dir || null;
}

async function checkDefaultOutputDir(filePath, labelId) {
  if (!state.outputDir && filePath) {
    const dir = dirname(filePath);
    setOutputDir(dir);
    const el = document.getElementById(labelId);
    if (el) el.textContent = dir;
  }
}
