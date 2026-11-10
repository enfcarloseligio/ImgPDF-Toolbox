// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/page-editor.js
// Descripción: Visor y editor de elementos sobre páginas para «Testar» y «Firmar». Muestra
//              una página (imagen) con zoom y permite colocar, mover, redimensionar, borrar,
//              copiar a todas las páginas y deshacer/rehacer. Admite dos modos: «box»
//              (cuadros negros que se dibujan arrastrando, de forma libre) y «stamp» (firmas
//              que se colocan con un clic y conservan su proporción). Guarda los elementos
//              como fracciones (0–1) de la página, de modo que no dependen del zoom ni de la
//              resolución de exportación.
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const PAGE_MIN_SIZE    = 0.004;   // Tamaño mínimo de un elemento, como fracción de la página
const PAGE_MIN_DRAW    = 4;       // Arrastre mínimo, en píxeles de pantalla, para crear un cuadro
const PAGE_STAMP_WIDTH = 0.28;    // Ancho inicial de una firma, como fracción del ancho de página
const PAGE_HISTORY     = 200;     // Pasos máximos de deshacer
const PAGE_ZOOMS       = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const PAGE_HANDLES     = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const PAGE_CORNERS     = ['nw', 'ne', 'se', 'sw'];   // Las firmas solo se redimensionan por las esquinas

// ── Editor ───────────────────────────────────────────────────────────────────

// Crea el editor dentro de stage. Opciones:
//   mode          'box' (por defecto) o 'stamp'
//   onChange(all) se llama cuando cambian los elementos (para guardar el avance)
//   onState()     se llama cuando cambia la selección, el historial, el zoom o la página
//   getStamp()    (modo stamp) firma activa { sig, aspect } o null; aspect = ancho/alto en píxeles
//   resolveSrc(sig)  (modo stamp) URL de la imagen de una firma
//   onNeedStamp() (modo stamp) se llama al hacer clic sin firma activa
function createPageEditor(stage, {
  mode = 'box', onChange = () => {}, onState = () => {},
  getStamp = () => null, resolveSrc = () => '', onNeedStamp = () => {},
  emptyText = 'Selecciona un archivo para empezar',
} = {}) {
  const stamps = mode === 'stamp';

  stage.innerHTML = `
    <div class="ptool-empty">${emptyText}</div>
    <div class="ptool-scroll" tabindex="0" hidden>
      <div class="ptool-page">
        <img class="ptool-img" alt="" draggable="false">
        <div class="ptool-items"></div>
      </div>
    </div>`;

  const empty   = stage.querySelector('.ptool-empty');
  const scroll  = stage.querySelector('.ptool-scroll');
  const pageEl  = stage.querySelector('.ptool-page');
  const img     = stage.querySelector('.ptool-img');
  const layer   = stage.querySelector('.ptool-items');

  let all = {};            // índice de página → [{ id, x, y, w, h, sig?, ar? }]
  let page = -1;           // Página mostrada
  let sel = null;          // Id del elemento seleccionado
  let zoom = 1;            // 1 = ajustado al ancho del visor
  let nextId = 1;
  let undoStack = [];
  let redoStack = [];
  let drag = null;         // Gesto en curso

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
  const list  = () => (all[page] = all[page] || []);
  const find  = id => list().find(b => b.id === id);

  // ── Historial ──────────────────────────────────────────────────────────────
  const snapshot = () => JSON.stringify(all);

  function pushHistory(before) {
    undoStack.push(before);
    if (undoStack.length > PAGE_HISTORY) undoStack.shift();
    redoStack = [];
  }

  function restore(json) {
    all = JSON.parse(json);
    if (sel && !find(sel)) sel = null;
    render();
    onChange(getAll());
    onState();
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  // Ajusta el ancho de la página al zoom actual. Con zoom 1 cabe justo en el visor.
  function applySize() {
    const available = Math.max(scroll.clientWidth - 24, 120);
    pageEl.style.width = `${Math.round(available * zoom)}px`;
  }

  function render() {
    if (page < 0) { layer.innerHTML = ''; return; }
    const handles = stamps ? PAGE_CORNERS : PAGE_HANDLES;
    layer.innerHTML = list().map(b => {
      const selected = b.id === sel;
      return `<div class="ptool-item${stamps ? ' is-stamp' : ''}${selected ? ' is-selected' : ''}" data-id="${b.id}"
        style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%">
        ${stamps ? `<img src="${resolveSrc(b.sig)}" alt="" draggable="false">` : ''}
        ${selected ? handles.map(h => `<span class="ptool-handle ptool-h-${h}" data-handle="${h}"></span>`).join('') : ''}
      </div>`;
    }).join('');
  }

  // Posición del puntero como fracción de la página
  function pointInPage(e) {
    const r = img.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1) };
  }

  // ── Gestos ─────────────────────────────────────────────────────────────────

  // Redimensiona una firma desde una esquina manteniendo su proporción (b.ar = ancho / alto en
  // fracciones de página). La esquina opuesta permanece fija.
  function resizeStamp(b, s, handle, p) {
    const west = handle.includes('w'), north = handle.includes('n');
    const ax = west ? s.x + s.w : s.x, ay = north ? s.y + s.h : s.y;
    const maxW = west ? ax : 1 - ax, maxH = north ? ay : 1 - ay;
    const w = clamp(Math.abs(p.x - ax), PAGE_MIN_SIZE, Math.min(maxW, maxH * b.ar));
    const h = w / b.ar;
    b.x = west ? ax - w : ax; b.y = north ? ay - h : ay; b.w = w; b.h = h;
  }

  function applyDrag(e) {
    const p = pointInPage(e);
    const b = find(drag.id);
    if (!b) return;
    const s = drag.start;

    if (drag.mode === 'draw') {
      b.x = Math.min(drag.ax, p.x); b.y = Math.min(drag.ay, p.y);
      b.w = Math.abs(p.x - drag.ax); b.h = Math.abs(p.y - drag.ay);
    } else if (drag.mode === 'move') {
      b.x = clamp(s.x + (p.x - drag.ax), 0, 1 - s.w);
      b.y = clamp(s.y + (p.y - drag.ay), 0, 1 - s.h);
    } else if (stamps) {
      resizeStamp(b, s, drag.mode, p);
    } else {
      // Redimensionado libre: cada borde sigue al puntero sin cruzar el borde opuesto
      let l = s.x, r = s.x + s.w, t = s.y, bt = s.y + s.h;
      if (drag.mode.includes('w')) l  = clamp(p.x, 0, r - PAGE_MIN_SIZE);
      if (drag.mode.includes('e')) r  = clamp(p.x, l + PAGE_MIN_SIZE, 1);
      if (drag.mode.includes('n')) t  = clamp(p.y, 0, bt - PAGE_MIN_SIZE);
      if (drag.mode.includes('s')) bt = clamp(p.y, t + PAGE_MIN_SIZE, 1);
      b.x = l; b.y = t; b.w = r - l; b.h = bt - t;
    }
    // Se actualiza solo el elemento en curso para que el gesto sea fluido
    const el = layer.querySelector(`[data-id="${b.id}"]`);
    if (el) Object.assign(el.style, { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
  }

  function startDrag(e, gesture, id) {
    e.preventDefault();
    scroll.focus({ preventScroll: true });
    try { pageEl.setPointerCapture(e.pointerId); } catch (_) { /* puntero no capturable: el gesto continúa sin captura */ }
    const p = pointInPage(e);
    drag = { mode: gesture, id, before: snapshot(), ax: p.x, ay: p.y, start: id ? { ...find(id) } : null };
  }

  // Coloca una firma centrada en el punto del clic y empieza a arrastrarla para ajustarla
  function placeStamp(e, stamp) {
    startDrag(e, 'move', null);                        // La instantánea del historial se toma antes de añadirla
    const pageAspect = img.naturalWidth / img.naturalHeight || 1;
    let w = PAGE_STAMP_WIDTH, h = w * pageAspect / stamp.aspect;
    if (h > 0.5) { h = 0.5; w = h * stamp.aspect / pageAspect; }
    const b = {
      id: nextId++, sig: stamp.sig, w, h, ar: w / h,
      x: clamp(drag.ax - w / 2, 0, 1 - w), y: clamp(drag.ay - h / 2, 0, 1 - h),
    };
    list().push(b);
    sel = b.id;
    drag.id = b.id;
    drag.start = { ...b };
    render();
  }

  pageEl.addEventListener('pointerdown', e => {
    if (page < 0 || e.button !== 0) return;
    const handle = e.target.closest('.ptool-handle')?.dataset.handle;
    const itemEl = e.target.closest('.ptool-item');

    if (handle && itemEl) {
      startDrag(e, handle, Number(itemEl.dataset.id));
    } else if (itemEl) {
      sel = Number(itemEl.dataset.id);
      render();
      onState();
      startDrag(e, 'move', sel);
    } else if (stamps) {
      const stamp = getStamp();
      if (stamp) placeStamp(e, stamp);
      else onNeedStamp();
    } else {
      // Arrastre sobre una zona libre: se dibuja un cuadro nuevo
      startDrag(e, 'draw', null);                      // La instantánea del historial se toma antes de añadirlo
      const b = { id: nextId++, x: drag.ax, y: drag.ay, w: 0, h: 0 };
      list().push(b);
      sel = b.id;
      drag.id = b.id;
      render();
    }
  });

  pageEl.addEventListener('pointermove', e => { if (drag) applyDrag(e); });

  function endDrag(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    try { pageEl.releasePointerCapture(e.pointerId); } catch (_) { /* ya liberado */ }

    // Un clic sin arrastre no deja un cuadro vacío
    if (d.mode === 'draw') {
      const b = find(d.id);
      const rect = img.getBoundingClientRect();
      const tooSmall = !b || b.w * rect.width < PAGE_MIN_DRAW || b.h * rect.height < PAGE_MIN_DRAW;
      if (tooSmall) {
        all[page] = list().filter(x => x.id !== d.id);
        sel = null;
      }
    }
    render();
    if (snapshot() !== d.before) {
      pushHistory(d.before);
      onChange(getAll());
    }
    onState();
  }
  pageEl.addEventListener('pointerup', endDrag);
  pageEl.addEventListener('pointercancel', endDrag);

  // ── Teclado ────────────────────────────────────────────────────────────────
  scroll.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? api.redo() : api.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); api.redo(); return; }
    if (key === 'escape') { sel = null; render(); onState(); return; }
    if (sel === null) return;

    if (key === 'delete' || key === 'backspace') { e.preventDefault(); api.removeSelected(); return; }

    const step = e.shiftKey ? 0.01 : 0.002;
    const move = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[key];
    const b = move && find(sel);
    if (!b) return;
    e.preventDefault();
    pushHistory(snapshot());
    b.x = clamp(b.x + move[0], 0, 1 - b.w);
    b.y = clamp(b.y + move[1], 0, 1 - b.h);
    render();
    onChange(getAll());
    onState();
  });

  new ResizeObserver(applySize).observe(scroll);

  // ── Exportación de los elementos ───────────────────────────────────────────
  // Objeto { índice: [{ x, y, w, h, sig? }] } sin ids internos ni páginas vacías
  function getAll() {
    const out = {};
    for (const [i, items] of Object.entries(all)) {
      if (items.length) out[i] = items.map(({ x, y, w, h, sig }) => (sig ? { x, y, w, h, sig } : { x, y, w, h }));
    }
    return out;
  }

  // ── API pública ────────────────────────────────────────────────────────────
  const api = {
    // Inicia una sesión con los elementos guardados (o vacía) y reinicia el historial
    open(items = {}) {
      all = {};
      for (const [i, boxes] of Object.entries(items)) all[i] = boxes.map(b => ({ id: nextId++, ...b, ar: b.w / b.h }));
      sel = null; undoStack = []; redoStack = []; page = -1;
    },

    // Muestra una página; url es la imagen rasterizada
    showPage(index, url) {
      page = index;
      sel = null;
      empty.hidden = true;
      scroll.hidden = false;
      img.src = url;
      applySize();
      scroll.scrollTo(0, 0);
      render();
      onState();
    },

    // Vuelve a dibujar la página actual (p. ej. al cambiar la biblioteca de firmas)
    refresh() { render(); },

    clear() {
      page = -1; all = {}; sel = null; undoStack = []; redoStack = [];
      scroll.hidden = true;
      empty.hidden = false;
      img.removeAttribute('src');
      layer.innerHTML = '';
      onState();
    },

    hasPage: () => page >= 0,
    getAll,
    countPage: () => (page >= 0 ? list().length : 0),
    countAll:  () => Object.values(getAll()).reduce((n, l) => n + l.length, 0),
    hasSelection: () => sel !== null,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,

    undo() {
      if (!undoStack.length) return;
      redoStack.push(snapshot());
      restore(undoStack.pop());
    },

    redo() {
      if (!redoStack.length) return;
      undoStack.push(snapshot());
      restore(redoStack.pop());
    },

    removeSelected() {
      if (sel === null) return;
      pushHistory(snapshot());
      all[page] = list().filter(b => b.id !== sel);
      sel = null;
      render();
      onChange(getAll());
      onState();
    },

    // Quita todos los elementos de la página actual
    clearPage() {
      if (page < 0 || !list().length) return;
      pushHistory(snapshot());
      all[page] = [];
      sel = null;
      render();
      onChange(getAll());
      onState();
    },

    // Quita de todas las páginas las firmas de una firma de la biblioteca que se eliminó
    removeSignature(sig) {
      let changed = false;
      for (const i of Object.keys(all)) {
        const kept = all[i].filter(b => b.sig !== sig);
        if (kept.length !== all[i].length) { all[i] = kept; changed = true; }
      }
      if (!changed) return;
      if (sel && !find(sel)) sel = null;
      render();
      onChange(getAll());
      onState();
    },

    // Copia el elemento seleccionado a la misma posición en el resto de páginas (encabezados,
    // pies de página, sellos y firmas que se repiten)
    copySelectedToAll(pageCount) {
      const b = sel !== null && find(sel);
      if (!b) return 0;
      pushHistory(snapshot());
      let copied = 0;
      for (let i = 0; i < pageCount; i++) {
        if (i === page) continue;
        (all[i] = all[i] || []).push({ ...b, id: nextId++ });
        copied++;
      }
      onChange(getAll());
      onState();
      return copied;
    },

    // Zoom como múltiplo del ajuste al ancho. step = +1 / -1 recorre los niveles; 0 ajusta.
    zoomBy(step) {
      if (step === 0) zoom = 1;
      else {
        const i = PAGE_ZOOMS.findIndex(z => z >= zoom - 1e-6);
        zoom = PAGE_ZOOMS[clamp((i < 0 ? PAGE_ZOOMS.length - 1 : i) + step, 0, PAGE_ZOOMS.length - 1)];
      }
      applySize();
      onState();
    },
    getZoom: () => zoom,
  };

  return api;
}
