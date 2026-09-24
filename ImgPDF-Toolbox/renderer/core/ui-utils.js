// ── core/ui-utils.js ──────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function basename(filePath) {
  return (filePath || '').replace(/\\/g, '/').split('/').pop();
}

function dirname(filePath) {
  const norm = (filePath || '').replace(/\\/g, '/');
  return norm.substring(0, norm.lastIndexOf('/'));
}

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
    return { ...defaults, ...stored };
  } catch (_) {
    return { ...defaults };
  }
}

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
  return `<div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
}

function outputDirRow(id) {
  const saved = state.outputDir || 'No seleccionada';
  return `<div class="output-row">
    <button class="btn-secondary btn-sm" id="${id}-pick">📁 Carpeta de salida</button>
    <span class="output-path" id="${id}-path">${saved}</span>
  </div>`;
}

// ── Lista simple (sin orden, sin drag) ──────────────────────────────────────
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
      <button class="file-remove" data-idx="${i}" title="Quitar">${icon('close', 14)}</button>
    </div>`).join('');
  list.querySelectorAll('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onRemove) onRemove(files[parseInt(btn.dataset.idx)]);
    });
  });
}

// ── renderOrderedFileList ────────────────────────────────────────────────────
// Lista con flechas ↑↓, drag-handle y botón eliminar.
// Soporta archivos duplicados (mismo path en varias posiciones).
//
// options:
//   showDrag   → muestra el drag-handle (default: true)
//   showArrows → muestra flechas ↑↓ (default: true)
function renderOrderedFileList(containerId, files, onChange, options = {}) {
  const { showDrag = true, showArrows = true } = options;
  const list = document.getElementById(containerId);
  if (!list) return;

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

    const dragHtml = showDrag
      ? `<span class="file-drag-handle" draggable="true" title="Arrastrar para reordenar">${icon('drag-handle', 14)}</span>`
      : '';

    const arrowsHtml = showArrows
      ? `<button class="btn-order btn-order-up"  title="Subir"  ${i === 0 ? 'disabled' : ''}>${icon('arrow-up', 14)}</button>
         <button class="btn-order btn-order-down" title="Bajar"  ${i === files.length - 1 ? 'disabled' : ''}>${icon('arrow-down', 14)}</button>`
      : '';

    item.innerHTML = `
      <div style="display:flex;align-items:center;overflow:hidden;flex:1;gap:0.35rem">
        ${dragHtml}
        <span class="file-order" style="font-weight:600;font-size:0.8rem;color:var(--primary);min-width:1.2rem">${i + 1}.</span>
        <span class="file-name" title="${f}">📄 ${basename(f)}</span>
      </div>
      <div class="file-actions" style="display:flex;align-items:center;gap:0.35rem;margin-left:0.5rem">
        ${arrowsHtml}
        <button class="file-remove" title="Quitar">${icon('close', 14)}</button>
      </div>`;

    const handle  = item.querySelector('.file-drag-handle');
    const btnUp   = item.querySelector('.btn-order-up');
    const btnDown = item.querySelector('.btn-order-down');
    const btnRm   = item.querySelector('.file-remove');

    if (btnUp) {
      btnUp.addEventListener('click', e => {
        e.stopPropagation();
        [files[i - 1], files[i]] = [files[i], files[i - 1]];
        onChange(files);
      });
    }
    if (btnDown) {
      btnDown.addEventListener('click', e => {
        e.stopPropagation();
        [files[i], files[i + 1]] = [files[i + 1], files[i]];
        onChange(files);
      });
    }

    btnRm.addEventListener('click', e => {
      e.stopPropagation();
      // Elimina por índice posicional (soporta duplicados)
      files.splice(i, 1);
      onChange(files);
    });

    if (handle) {
      handle.addEventListener('dragstart', e => {
        e.stopPropagation();
        item.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
        // Índice posicional (soporta duplicados)
        e.dataTransfer.setData('text/plain', String(i));
      });

      handle.addEventListener('dragend', e => {
        e.stopPropagation();
        item.style.opacity = '1';
        list.querySelectorAll('.file-item').forEach(el => { el.style.borderTop = ''; });
        if (parentZone) parentZone.classList.remove('drag-active');
      });
    }

    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      item.style.borderTop = '2px solid var(--primary)';
    });

    item.addEventListener('dragleave', e => {
      if (item.contains(e.relatedTarget)) return;
      e.stopPropagation();
      item.style.borderTop = '';
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      e.stopPropagation();
      item.style.borderTop = '';
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex   = i;
      if (!isNaN(fromIndex) && fromIndex !== toIndex) {
        const [moved] = files.splice(fromIndex, 1);
        files.splice(toIndex, 0, moved);
        onChange(files);
      }
    });

    list.appendChild(item);
  });
}

// ── Drag & drop externo (desde el SO hacia la zona) ─────────────────────────
function bindDragDrop(zoneId, extensions, onDrop) {
  const zone = document.getElementById(zoneId);
  if (!zone) return;

  // Contador para evitar parpadeo de drag-active cuando se pasa por hijos
  let dragDepth = 0;

  zone.addEventListener('dragenter', e => {
    e.preventDefault();
    dragDepth++;
    zone.classList.add('drag-active');
  });

  zone.addEventListener('dragover', e => {
    e.preventDefault();
    e.stopPropagation();
    // Forzar que SIEMPRE se pueda soltar (incluso si el archivo ya fue soltado antes)
    e.dataTransfer.dropEffect = 'copy';
    zone.classList.add('drag-active');
  });

  zone.addEventListener('dragleave', e => {
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) zone.classList.remove('drag-active');
  });

  zone.addEventListener('drop', e => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth = 0;
    zone.classList.remove('drag-active');

    // Leer SIEMPRE de dataTransfer.files (funciona incluso con duplicados)
    const list = e.dataTransfer.files;
    if (!list || !list.length) return;

    const paths = Array.from(list)
      .map(f => window.api.getFilePath(f))
      .filter(p => p && extensions.includes(p.split('.').pop().toLowerCase()));

    if (paths.length) onDrop(paths);
    else notify.warning(`Solo se aceptan: ${extensions.join(', ').toUpperCase()}`);
  });
}

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

// ── Helper compartido: selector de fuente (sistema + Google Fonts) ─────────
// Usado por watermark, foliado y watermark-image
function buildFontPicker(opts) {
  const picker = document.getElementById(opts.pickerId);
  if (!picker) return;

  const baseCatalog = [
    'Roboto','Roboto Condensed','Roboto Mono','Roboto Slab',
    'Open Sans','Open Sans Condensed','Lato','Montserrat','Poppins',
    'Oswald','Inter','Raleway','Nunito','Ubuntu','Rubik',
    'Playfair Display','Lora','Noto Sans','Noto Serif','PT Sans',
    'Merriweather','Bebas Neue','Cabin','Fira Sans','Barlow',
    'Quicksand','Work Sans','Titillium Web','DM Sans','Source Sans Pro',
    'Cinzel','Caveat','Comfortaa','Pacifico','Lobster','Dancing Script'
  ];

  if (!opts.gfCatalog.length) {
    opts.gfCatalog.push(...baseCatalog);
    // Enriquecer en background
    (async () => {
      try {
        if (window.api?.getGoogleFontsCatalog) {
          const res = await window.api.getGoogleFontsCatalog();
          if (res?.ok && res.families?.length) {
            opts.gfCatalog.length = 0;
            opts.gfCatalog.push(...Array.from(new Set([...baseCatalog, ...res.families])).sort((a,b) => a.localeCompare(b)));
          }
        }
      } catch (_) {}
    })();
  }

  if (opts.fontSource === 'system') {
    picker.innerHTML = `<p style="font-size:0.78rem;color:var(--muted)">⏳ Cargando fuentes del sistema...</p>`;

    window.api.getSystemFonts().then(fonts => {
      if (opts.onFontsLoaded) opts.onFontsLoaded(fonts);
      if (!fonts.length) {
        picker.innerHTML = `<p style="font-size:0.78rem;color:var(--muted)">No se encontraron fuentes instaladas.</p>`;
        return;
      }
      picker.innerHTML = `
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input type="text" id="${opts.pickerId}-search" class="num-input"
            style="width:240px;text-align:left" placeholder="Buscar fuente...">
          <span style="font-size:0.78rem;color:var(--muted)">${fonts.length} fuentes detectadas</span>
        </div>
        <select id="${opts.pickerId}-select" size="5"
          style="width:100%;margin-top:0.4rem;border:1px solid var(--border);
                 border-radius:6px;padding:0.35rem 0.5rem;font-size:0.83rem;
                 background:var(--bg);color:var(--deep)">
          ${fonts.map(f => `<option value="${f.path}">${f.name}</option>`).join('')}
        </select>`;

      opts.onFontPath(fonts[0]?.path || null);
      if (opts.onPreview) opts.onPreview();

      document.getElementById(`${opts.pickerId}-search`).addEventListener('input', e => {
        const q        = e.target.value.toLowerCase();
        const filtered = fonts.filter(f => f.name.toLowerCase().includes(q));
        document.getElementById(`${opts.pickerId}-select`).innerHTML =
          filtered.map(f => `<option value="${f.path}">${f.name}</option>`).join('');
        opts.onFontPath(filtered[0]?.path || null);
        if (opts.onPreview) opts.onPreview();
      });

      document.getElementById(`${opts.pickerId}-select`).addEventListener('change', e => {
        opts.onFontPath(e.target.value);
        if (opts.onPreview) opts.onPreview();
      });
    });

  } else {
    picker.innerHTML = `
      <div class="result-box info" style="margin-bottom:0.6rem">
        <div class="result-title">ℹ️ Catálogo de Google Fonts</div>
        <div class="result-item">Escribe la familia deseada y selecciónala de la lista.</div>
      </div>
      <div style="display:flex;gap:0.5rem;align-items:center;position:relative">
        <div style="position:relative;width:320px">
          <input type="text" id="${opts.pickerId}-gf-family" class="num-input"
            style="width:100%;text-align:left;height:36px;padding:0.38rem 0.75rem;font-size:0.84rem"
            placeholder="Buscar familia tipográfica..." autocomplete="off">
          <div id="${opts.pickerId}-gf-suggestions" style="
            display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:99999;
            background:#fff;border:1px solid var(--border);border-radius:6px;
            box-shadow:0 8px 20px rgba(0,0,0,0.1);max-height:220px;overflow-y:auto"></div>
        </div>
        <button class="btn-secondary btn-sm" id="${opts.pickerId}-gf-load"
          style="height:36px;padding:0 0.9rem">Cargar fuente</button>
        <span id="${opts.pickerId}-gf-status" style="font-size:0.76rem;color:var(--muted)"></span>
      </div>`;

    const familyInput   = document.getElementById(`${opts.pickerId}-gf-family`);
    const suggestionsEl = document.getElementById(`${opts.pickerId}-gf-suggestions`);
    const statusEl      = document.getElementById(`${opts.pickerId}-gf-status`);

    async function triggerDownload(familyName) {
      const family = (familyName || familyInput.value).trim();
      if (!family) { notify.warning('Escribe o selecciona una familia.'); return; }
      statusEl.textContent = '⏳ Descargando...';
      statusEl.style.color = 'var(--warning)';
      const dl = await window.api.downloadGoogleFont({ family, weight: opts.fontWeight });
      if (dl.ok) {
        opts.onFontPath(dl.path);
        statusEl.textContent = `✓ ${family} lista`;
        statusEl.style.color = 'var(--success)';
        notify.success(`Fuente "${family}" cargada.`);
        if (opts.onPreview) opts.onPreview();
      } else {
        statusEl.textContent = '✗ Error';
        statusEl.style.color = 'var(--error)';
        notify.error(dl.error || `No se pudo cargar "${family}".`);
      }
    }

    function showSuggestions() {
      const q = familyInput.value.toLowerCase().trim();
      if (!q) { suggestionsEl.style.display = 'none'; return; }
      const matches = opts.gfCatalog.filter(f => f.toLowerCase().includes(q)).slice(0, 15);
      if (!matches.length) { suggestionsEl.style.display = 'none'; return; }
      suggestionsEl.innerHTML = matches.map(f =>
        `<div class="gf-item-row" data-family="${f}"
          style="padding:0.45rem 0.85rem;font-size:0.83rem;color:var(--deep);cursor:pointer;
                 border-bottom:1px solid rgba(0,0,0,0.05)">${f}</div>`
      ).join('');
      suggestionsEl.style.display = 'block';
      suggestionsEl.querySelectorAll('.gf-item-row').forEach(item => {
        item.addEventListener('mouseenter', () => { item.style.background = 'var(--primary-soft)'; item.style.color = 'var(--primary)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; item.style.color = 'var(--deep)'; });
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
    familyInput.addEventListener('blur', () => { setTimeout(() => { suggestionsEl.style.display = 'none'; }, 200); });
    document.getElementById(`${opts.pickerId}-gf-load`).addEventListener('click', () => triggerDownload());
  }
}