// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/image-gallery.js
// Descripción: Lista de imágenes en miniaturas. Cada tarjeta muestra la miniatura, el nombre,
//              el tamaño en píxeles y el peso; si la herramienta lo define, también el tamaño
//              al que quedará la imagen (p. ej. 1920 × 1180 → 960 × 590). Cuando la lista mezcla
//              horizontales y verticales, las de la orientación minoritaria se resaltan para
//              detectar a simple vista una imagen colada. Con onChange permite reordenar con
//              flechas o arrastrando. renderFileList y renderOrderedFileList la usan solas
//              para las zonas de imágenes (core/ui-utils.js).
// ═════════════════════════════════════════════════════════════════════════════

// ── Estado compartido ────────────────────────────────────────────────────────

const IMAGE_INFO_CACHE   = new Map();   // ruta → { ok, path (miniatura), width, height, bytes }
const IMAGE_INFO_PENDING = new Map();   // ruta → promesa en curso (evita pedir dos veces)
const IMAGE_GALLERY_TARGETS = new Map();// id de la lista → (info) => { width, height } | null
let galleryDrag = null;                 // Tarjeta que se está arrastrando: { list, from }

// ── Información de cada imagen ───────────────────────────────────────────────

// Pide la miniatura y el tamaño de una imagen (una sola vez por archivo).
function loadImageInfo(file) {
  if (IMAGE_INFO_CACHE.has(file)) return Promise.resolve(IMAGE_INFO_CACHE.get(file));
  if (!IMAGE_INFO_PENDING.has(file)) {
    IMAGE_INFO_PENDING.set(file, window.api.imageThumbnail(file).then(info => {
      IMAGE_INFO_PENDING.delete(file);
      if (info.ok) IMAGE_INFO_CACHE.set(file, info);
      return info;
    }));
  }
  return IMAGE_INFO_PENDING.get(file);
}

// ── API pública ──────────────────────────────────────────────────────────────

// Define cómo calcular el tamaño final de cada imagen de la lista (o null para no mostrarlo).
function setImageGalleryTarget(listId, getTarget) {
  if (getTarget) IMAGE_GALLERY_TARGETS.set(listId, getTarget); else IMAGE_GALLERY_TARGETS.delete(listId);
}

// Vuelve a calcular los tamaños finales (al cambiar las opciones de la herramienta).
function refreshImageGallery(listId) {
  const list = document.getElementById(listId);
  if (!list) return;
  list.querySelectorAll('.igal-card').forEach(card => paintTarget(card, IMAGE_INFO_CACHE.get(card.dataset.path)));
}

// Dibuja la lista. handlers.onRemove(file) quita una imagen; handlers.onChange(files) se llama
// tras reordenar o quitar cuando la lista es ordenable (entonces files se modifica en su sitio).
function renderImageGallery(list, files, { onRemove, onChange } = {}) {
  const sortable = !!onChange;
  list.classList.add('igal');
  list.classList.toggle('is-sortable', sortable);

  list.innerHTML = files.map((f, i) => `
    <div class="igal-card${sortable ? ' is-draggable' : ''}" data-index="${i}" data-path="${escapeAttr(f)}" ${sortable ? 'draggable="true"' : ''}>
      <div class="igal-thumb is-loading">
        <img alt="" draggable="false" hidden>
        <span class="igal-order">${i + 1}</span>
        <button class="igal-remove" type="button" title="Quitar">${icon('close', 14)}</button>
        ${sortable ? `<div class="igal-move">
          <button class="igal-prev" type="button" title="Mover antes" ${i === 0 ? 'disabled' : ''}>${icon('back', 14)}</button>
          <button class="igal-next" type="button" title="Mover después" ${i === files.length - 1 ? 'disabled' : ''}>${icon('arrow-right', 14)}</button>
        </div>` : ''}
        <span class="igal-flag" hidden></span>
      </div>
      <div class="igal-name" title="${escapeAttr(f)}">${basename(f)}</div>
      <div class="igal-meta"><span class="igal-dim">…</span><span class="igal-arrow" hidden>→</span><span class="igal-target" hidden></span></div>
      <div class="igal-bytes"></div>
    </div>`).join('');

  const cards = [...list.querySelectorAll('.igal-card')];

  // ── Quitar y reordenar ─────────────────────────────────────────────────────
  cards.forEach((card, i) => {
    card.querySelector('.igal-remove').addEventListener('click', e => {
      e.stopPropagation();
      if (sortable) { files.splice(i, 1); onChange(files); }
      else if (onRemove) onRemove(files[i]);
    });
    if (!sortable) return;

    const move = (from, to) => {
      if (to < 0 || to >= files.length || from === to) return;
      const [item] = files.splice(from, 1);
      files.splice(to, 0, item);
      onChange(files);
    };
    card.querySelector('.igal-prev').addEventListener('click', e => { e.stopPropagation(); move(i, i - 1); });
    card.querySelector('.igal-next').addEventListener('click', e => { e.stopPropagation(); move(i, i + 1); });

    // Arrastre interno: se suelta antes o después de la tarjeta según la mitad sobre la que caiga.
    // No se detiene la propagación de dragenter/dragover para no romper la zona de soltar archivos.
    card.addEventListener('dragstart', e => {
      galleryDrag = { list, from: i };
      card.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(i));
    });
    card.addEventListener('dragend', () => {
      galleryDrag = null;
      card.classList.remove('is-dragging');
      cards.forEach(c => c.classList.remove('drop-before', 'drop-after'));
    });
    card.addEventListener('dragover', e => {
      if (!galleryDrag || galleryDrag.list !== list) return;
      e.preventDefault();
      const r = card.getBoundingClientRect();
      const before = e.clientX < r.left + r.width / 2;
      cards.forEach(c => c.classList.remove('drop-before', 'drop-after'));
      card.classList.add(before ? 'drop-before' : 'drop-after');
    });
    card.addEventListener('drop', e => {
      if (!galleryDrag || galleryDrag.list !== list) return;
      e.preventDefault();
      const r = card.getBoundingClientRect();
      const before = e.clientX < r.left + r.width / 2;
      const from = galleryDrag.from;
      let to = before ? i : i + 1;
      if (from < to) to -= 1;
      galleryDrag = null;
      move(from, to);
    });
  });

  // ── Miniaturas y datos (en segundo plano, de una en una) ───────────────────
  const token = (list._igalToken = (list._igalToken || 0) + 1);
  (async () => {
    for (const card of cards) {
      if (list._igalToken !== token) return;       // La lista se volvió a dibujar
      const info = await loadImageInfo(card.dataset.path);
      if (list._igalToken !== token || !card.isConnected) return;
      paintCard(card, info);
      markOddOrientation(list);
    }
  })();

  // Lo ya conocido se pinta al instante
  cards.forEach(card => { const info = IMAGE_INFO_CACHE.get(card.dataset.path); if (info) paintCard(card, info); });
  markOddOrientation(list);
}

// ── Pintado de una tarjeta ───────────────────────────────────────────────────

function paintCard(card, info) {
  const thumb = card.querySelector('.igal-thumb');
  thumb.classList.remove('is-loading');
  if (!info?.ok) {
    thumb.classList.add('is-error');
    card.querySelector('.igal-dim').textContent = 'No se pudo leer';
    return;
  }
  const img = thumb.querySelector('img');
  img.src = toFileUrl(info.path);
  img.hidden = false;
  card.dataset.orientation = info.width === info.height ? 'square' : info.width > info.height ? 'landscape' : 'portrait';
  card.querySelector('.igal-dim').textContent = `${info.width} × ${info.height}`;
  card.querySelector('.igal-bytes').textContent = formatBytes(info.bytes);
  paintTarget(card, info);
}

// Tamaño al que quedará la imagen, si la herramienta lo calcula.
function paintTarget(card, info) {
  const getTarget = IMAGE_GALLERY_TARGETS.get(card.closest('.igal')?.id);
  const arrow = card.querySelector('.igal-arrow'), target = card.querySelector('.igal-target');
  const t = info?.ok && getTarget ? getTarget(info) : null;
  arrow.hidden = target.hidden = !t;
  if (!t) return;
  target.textContent = `${t.width} × ${t.height}`;
  target.classList.toggle('is-same', t.width === info.width && t.height === info.height);
}

// Resalta las imágenes de la orientación minoritaria (p. ej. una vertical entre diez horizontales).
function markOddOrientation(list) {
  const cards = [...list.querySelectorAll('.igal-card[data-orientation]')];
  const count = { landscape: 0, portrait: 0 };
  cards.forEach(c => { if (c.dataset.orientation in count) count[c.dataset.orientation]++; });
  const mixed = count.landscape > 0 && count.portrait > 0 && count.landscape !== count.portrait;
  const minority = count.landscape < count.portrait ? 'landscape' : 'portrait';

  cards.forEach(c => {
    const odd = mixed && c.dataset.orientation === minority;
    c.classList.toggle('is-odd', odd);
    const flag = c.querySelector('.igal-flag');
    flag.hidden = !odd;
    flag.textContent = minority === 'portrait' ? 'Vertical' : 'Horizontal';
  });
}

// Escapa un texto para usarlo dentro de un atributo HTML.
function escapeAttr(text) {
  return String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
