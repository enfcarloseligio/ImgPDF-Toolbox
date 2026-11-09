// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/redact-editor.js
// Descripción: Visor y editor de cuadros negros para la herramienta «Testar». Muestra una
//              página (imagen) con zoom y permite dibujar cuadros arrastrando, moverlos,
//              redimensionarlos con 8 asas, borrarlos, copiarlos a todas las páginas y
//              deshacer/rehacer. Guarda los cuadros como fracciones (0–1) de la página, de
//              modo que no dependen del zoom ni de la resolución de exportación.
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const REDACT_MIN_BOX   = 0.004;   // Tamaño mínimo de un cuadro, como fracción de la página
const REDACT_MIN_DRAW  = 4;       // Arrastre mínimo, en píxeles de pantalla, para crear un cuadro
const REDACT_HISTORY   = 200;     // Pasos máximos de deshacer
const REDACT_ZOOMS     = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const REDACT_HANDLES   = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// ── Editor ───────────────────────────────────────────────────────────────────

// Crea el editor dentro de stage.
//   onChange(all)  se llama cuando cambian los cuadros (para guardar el avance)
//   onState()      se llama cuando cambia la selección, el historial, el zoom o la página
function createRedactEditor(stage, { onChange = () => {}, onState = () => {} } = {}) {
  stage.innerHTML = `
    <div class="redact-empty">Selecciona un archivo para empezar a testar</div>
    <div class="redact-scroll" tabindex="0" hidden>
      <div class="redact-page">
        <img class="redact-img" alt="" draggable="false">
        <div class="redact-boxes"></div>
      </div>
    </div>`;

  const empty   = stage.querySelector('.redact-empty');
  const scroll  = stage.querySelector('.redact-scroll');
  const pageEl  = stage.querySelector('.redact-page');
  const img     = stage.querySelector('.redact-img');
  const layer   = stage.querySelector('.redact-boxes');

  let all = {};            // índice de página → [{ id, x, y, w, h }]
  let page = -1;           // Página mostrada
  let sel = null;          // Id del cuadro seleccionado
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
    if (undoStack.length > REDACT_HISTORY) undoStack.shift();
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
    layer.innerHTML = list().map(b => {
      const selected = b.id === sel;
      return `<div class="redact-box${selected ? ' is-selected' : ''}" data-id="${b.id}"
        style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%">
        ${selected ? REDACT_HANDLES.map(h => `<span class="redact-handle redact-h-${h}" data-handle="${h}"></span>`).join('') : ''}
      </div>`;
    }).join('');
  }

  // Posición del puntero como fracción de la página
  function pointInPage(e) {
    const r = img.getBoundingClientRect();
    return { x: clamp((e.clientX - r.left) / r.width, 0, 1), y: clamp((e.clientY - r.top) / r.height, 0, 1), w: r.width, h: r.height };
  }

  // ── Gestos ─────────────────────────────────────────────────────────────────

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
    } else {
      // Redimensionado: cada borde sigue al puntero sin cruzar el borde opuesto
      let l = s.x, r = s.x + s.w, t = s.y, bt = s.y + s.h;
      if (drag.mode.includes('w')) l  = clamp(p.x, 0, r - REDACT_MIN_BOX);
      if (drag.mode.includes('e')) r  = clamp(p.x, l + REDACT_MIN_BOX, 1);
      if (drag.mode.includes('n')) t  = clamp(p.y, 0, bt - REDACT_MIN_BOX);
      if (drag.mode.includes('s')) bt = clamp(p.y, t + REDACT_MIN_BOX, 1);
      b.x = l; b.y = t; b.w = r - l; b.h = bt - t;
    }
    // Se actualiza solo el cuadro en curso para que el gesto sea fluido
    const el = layer.querySelector(`[data-id="${b.id}"]`);
    if (el) Object.assign(el.style, { left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
  }

  function startDrag(e, mode, id) {
    e.preventDefault();
    scroll.focus({ preventScroll: true });
    try { pageEl.setPointerCapture(e.pointerId); } catch (_) { /* puntero no capturable: el gesto continúa sin captura */ }
    const p = pointInPage(e);
    drag = { mode, id, before: snapshot(), ax: p.x, ay: p.y, px: e.clientX, py: e.clientY, start: id ? { ...find(id) } : null };
  }

  pageEl.addEventListener('pointerdown', e => {
    if (page < 0 || e.button !== 0) return;
    const handle = e.target.closest('.redact-handle')?.dataset.handle;
    const boxEl  = e.target.closest('.redact-box');

    if (handle && boxEl) {
      startDrag(e, handle, Number(boxEl.dataset.id));
    } else if (boxEl) {
      sel = Number(boxEl.dataset.id);
      render();
      onState();
      startDrag(e, 'move', sel);
    } else {
      // Arrastre sobre una zona libre: se dibuja un cuadro nuevo
      // (la instantánea del historial se toma antes de añadirlo)
      startDrag(e, 'draw', null);
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
      const tooSmall = !b || b.w * rect.width < REDACT_MIN_DRAW || b.h * rect.height < REDACT_MIN_DRAW;
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

  // ── Exportación de los cuadros ─────────────────────────────────────────────
  // Objeto { índice: [{ x, y, w, h }] } sin ids ni páginas vacías
  function getAll() {
    const out = {};
    for (const [i, boxes] of Object.entries(all)) {
      if (boxes.length) out[i] = boxes.map(({ x, y, w, h }) => ({ x, y, w, h }));
    }
    return out;
  }

  // ── API pública ────────────────────────────────────────────────────────────
  const api = {
    // Inicia una sesión con los cuadros guardados (o vacía) y reinicia el historial
    open(boxes = {}) {
      all = {};
      for (const [i, list] of Object.entries(boxes)) all[i] = list.map(b => ({ id: nextId++, ...b }));
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

    // Quita todos los cuadros de la página actual
    clearPage() {
      if (page < 0 || !list().length) return;
      pushHistory(snapshot());
      all[page] = [];
      sel = null;
      render();
      onChange(getAll());
      onState();
    },

    // Copia el cuadro seleccionado a la misma posición en el resto de páginas (encabezados,
    // pies de página, sellos que se repiten)
    copySelectedToAll(pageCount) {
      const b = sel !== null && find(sel);
      if (!b) return 0;
      pushHistory(snapshot());
      let copied = 0;
      for (let i = 0; i < pageCount; i++) {
        if (i === page) continue;
        (all[i] = all[i] || []).push({ id: nextId++, x: b.x, y: b.y, w: b.w, h: b.h });
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
        const i = REDACT_ZOOMS.findIndex(z => z >= zoom - 1e-6);
        zoom = REDACT_ZOOMS[clamp((i < 0 ? REDACT_ZOOMS.length - 1 : i) + step, 0, REDACT_ZOOMS.length - 1)];
      }
      applySize();
      onState();
    },
    getZoom: () => zoom,
  };

  return api;
}
