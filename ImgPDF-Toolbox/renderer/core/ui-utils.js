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

// Lista interactiva con ordenamiento por arrastre (☰) y aislamiento de zona
function renderOrderedFileList(containerId, files, onChange) {
  const list = document.getElementById(containerId);
  if (!list) return;

  // Limpiar cualquier estado activo residual en la zona exterior
  const parentZone = list.closest('.file-zone');
  if (parentZone) parentZone.classList.remove('drag-active');

  if (!files.length) {
    list.innerHTML = '<span class="file-empty">Ningún archivo seleccionado</span>';
    return;
  }

  list.innerHTML = '';

  files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.dataset.index = i;

    item.innerHTML = `
      <div style="display:flex;align-items:center;overflow:hidden;flex:1;gap:0.35rem">
        <span class="file-drag-handle" draggable="true" style="cursor:grab;color:var(--muted);user-select:none;padding:0 0.3rem;font-size:1rem" title="Arrastrar para reordenar">☰</span>
        <span class="file-order" style="font-weight:600;font-size:0.8rem;color:var(--primary);min-width:1.2rem">${i + 1}.</span>
        <span class="file-name" title="${f}">📄 ${basename(f)}</span>
      </div>
      <div class="file-actions" style="display:flex;align-items:center;gap:0.35rem;margin-left:0.5rem">
        <button class="btn-order btn-order-up" style="
          display:inline-flex;align-items:center;justify-content:center;
          width:24px;height:24px;padding:0;border:1px solid var(--border);border-radius:4px;
          background:#ffffff;color:var(--primary);font-size:0.75rem;font-weight:bold;cursor:pointer"
          title="Subir" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="btn-order btn-order-down" style="
          display:inline-flex;align-items:center;justify-content:center;
          width:24px;height:24px;padding:0;border:1px solid var(--border);border-radius:4px;
          background:#ffffff;color:var(--primary);font-size:0.75rem;font-weight:bold;cursor:pointer"
          title="Bajar" ${i === files.length - 1 ? 'disabled' : ''}>▼</button>
        <button class="file-remove" style="cursor:pointer" title="Quitar">✕</button>
      </div>`;

    const handle  = item.querySelector('.file-drag-handle');
    const btnUp   = item.querySelector('.btn-order-up');
    const btnDown = item.querySelector('.btn-order-down');
    const btnRm   = item.querySelector('.file-remove');

    // Botones de flechas
    if (i === 0) {
      btnUp.style.opacity = '0.35';
      btnUp.style.cursor = 'not-allowed';
      btnUp.style.color = 'var(--muted)';
    } else {
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        [files[i - 1], files[i]] = [files[i], files[i - 1]];
        onChange(files);
      });
    }

    if (i === files.length - 1) {
      btnDown.style.opacity = '0.35';
      btnDown.style.cursor = 'not-allowed';
      btnDown.style.color = 'var(--muted)';
    } else {
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        [files[i], files[i + 1]] = [files[i + 1], files[i]];
        onChange(files);
      });
    }

    btnRm.addEventListener('click', (e) => {
      e.stopPropagation();
      files.splice(i, 1);
      onChange(files);
    });

    // Eventos Drag & Drop aislados desde el icono ☰
    handle.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      item.style.opacity = '0.4';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', i);
    });

    handle.addEventListener('dragend', (e) => {
      e.stopPropagation();
      item.style.opacity = '1';
      list.querySelectorAll('.file-item').forEach(el => {
        el.style.borderTop = '';
      });
      if (parentZone) parentZone.classList.remove('drag-active');
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      item.style.borderTop = '2px solid var(--primary)';
    });

    item.addEventListener('dragleave', (e) => {
      e.stopPropagation();
      item.style.borderTop = '';
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.style.borderTop = '';

      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = i;

      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        const [movedItem] = files.splice(fromIndex, 1);
        files.splice(toIndex, 0, movedItem);
        onChange(files);
      }
    });

    list.appendChild(item);
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