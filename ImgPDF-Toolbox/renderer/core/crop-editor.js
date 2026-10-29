// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/crop-editor.js
// Descripción: Editor visual de recorte: muestra una imagen con un recuadro que se puede
//              mover, redimensionar con 8 asas o redibujar arrastrando. Admite proporciones
//              bloqueadas, cambio de orientación y edición numérica. Trabaja siempre en
//              píxeles de la imagen original, no de la pantalla.
// ═════════════════════════════════════════════════════════════════════════════

// ── Utilidades geométricas ───────────────────────────────────────────────────

const CROP_MIN = 8;   // Tamaño mínimo del recuadro, en píxeles de la imagen

const clampNum = (v, min, max) => Math.min(Math.max(v, min), max);

// ── Editor ───────────────────────────────────────────────────────────────────

// Crea el editor dentro de stage. onChange({ x, y, w, h }, ratio) se llama con cada cambio.
function createCropEditor(stage, onChange = () => {}) {
  stage.innerHTML = `
    <div class="crop-empty">Selecciona una imagen para empezar a recortar</div>
    <div class="crop-canvas" hidden>
      <img class="crop-img" alt="" draggable="false">
      <div class="crop-box" tabindex="0" title="Arrastra para mover · usa las asas para cambiar el tamaño">
        <span class="crop-grid"></span>
        ${['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(h => `<span class="crop-handle crop-h-${h}" data-handle="${h}"></span>`).join('')}
        <span class="crop-size"></span>
      </div>
    </div>`;

  const empty   = stage.querySelector('.crop-empty');
  const canvas  = stage.querySelector('.crop-canvas');
  const img     = stage.querySelector('.crop-img');
  const box     = stage.querySelector('.crop-box');
  const sizeTag = stage.querySelector('.crop-size');

  let W = 0, H = 0;          // Tamaño de la imagen original
  let ratio = null;          // Proporción ancho/alto bloqueada (null = libre)
  let rect = { x: 0, y: 0, w: 0, h: 0 };
  let scale = 1;             // Píxeles de pantalla por píxel de imagen
  let drag = null;           // Gesto en curso

  // ── Dibujo y notificación ──────────────────────────────────────────────────
  function render() {
    scale = W ? img.clientWidth / W : 1;
    box.style.left   = `${rect.x * scale}px`;
    box.style.top    = `${rect.y * scale}px`;
    box.style.width  = `${rect.w * scale}px`;
    box.style.height = `${rect.h * scale}px`;
    sizeTag.textContent = `${rect.w} × ${rect.h}`;
  }

  // Redondea y mantiene el recuadro dentro de la imagen
  function commit(r) {
    const w = clampNum(Math.round(r.w), 1, W);
    const h = clampNum(Math.round(r.h), 1, H);
    rect = { x: clampNum(Math.round(r.x), 0, W - w), y: clampNum(Math.round(r.y), 0, H - h), w, h };
    render();
    onChange({ ...rect }, ratio);
  }

  // ── Geometría con proporción ───────────────────────────────────────────────

  // Recuadro entre un punto ancla y el puntero. Si hay proporción, la respeta y se limita a la
  // imagen; si el puntero cruza el ancla, el recuadro se voltea de forma natural.
  function rectFromAnchor(ax, ay, px, py) {
    const sx = px >= ax ? 1 : -1, sy = py >= ay ? 1 : -1;
    let w = Math.abs(px - ax), h = Math.abs(py - ay);
    const maxW = sx > 0 ? W - ax : ax, maxH = sy > 0 ? H - ay : ay;

    if (ratio) {
      w = Math.min(Math.max(w, h * ratio), maxW, maxH * ratio);
      h = w / ratio;
    } else {
      w = Math.min(w, maxW);
      h = Math.min(h, maxH);
    }
    return { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
  }

  // Recuadro de área similar con la proporción dada, centrado donde estaba y dentro de la imagen
  function refit(newRatio) {
    const area = Math.max(rect.w * rect.h, CROP_MIN * CROP_MIN);
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
    let h = Math.sqrt(area / newRatio), w = h * newRatio;
    const k = Math.min(1, W / w, H / h);
    w *= k; h *= k;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  // ── Gestos ─────────────────────────────────────────────────────────────────
  function applyDrag(e) {
    const dx = (e.clientX - drag.px) / scale, dy = (e.clientY - drag.py) / scale;
    const s = drag.start, hd = drag.handle;

    if (hd === 'move') {
      commit({ ...s, x: clampNum(s.x + dx, 0, W - s.w), y: clampNum(s.y + dy, 0, H - s.h) });
      return;
    }

    if (hd === 'draw') {
      const p = pointInImage(e);
      commit(rectFromAnchor(drag.ax, drag.ay, p.x, p.y));
      return;
    }

    const west = hd.includes('w'), east = hd.includes('e'), north = hd.includes('n'), south = hd.includes('s');
    const corner = (west || east) && (north || south);

    if (corner) {
      // El ancla es la esquina opuesta; el puntero arrastra la esquina elegida
      const ax = west ? s.x + s.w : s.x, ay = north ? s.y + s.h : s.y;
      const px = (west ? s.x : s.x + s.w) + dx, py = (north ? s.y : s.y + s.h) + dy;
      commit(rectFromAnchor(ax, ay, clampNum(px, 0, W), clampNum(py, 0, H)));
      return;
    }

    // Asas laterales
    let { x, y, w, h } = s;
    if (west || east) {
      w = clampNum(east ? s.w + dx : s.w - dx, CROP_MIN, west ? s.x + s.w : W - s.x);
      x = west ? s.x + s.w - w : s.x;
      if (ratio) {
        h = w / ratio;
        if (h > H) { h = H; w = h * ratio; x = west ? s.x + s.w - w : s.x; }
        y = clampNum(s.y + s.h / 2 - h / 2, 0, H - h);
      }
    } else {
      h = clampNum(south ? s.h + dy : s.h - dy, CROP_MIN, north ? s.y + s.h : H - s.y);
      y = north ? s.y + s.h - h : s.y;
      if (ratio) {
        w = h * ratio;
        if (w > W) { w = W; h = w / ratio; y = north ? s.y + s.h - h : s.y; }
        x = clampNum(s.x + s.w / 2 - w / 2, 0, W - w);
      }
    }
    commit({ x, y, w, h });
  }

  // Posición del puntero en píxeles de la imagen
  function pointInImage(e) {
    const r = img.getBoundingClientRect();
    return { x: clampNum((e.clientX - r.left) / scale, 0, W), y: clampNum((e.clientY - r.top) / scale, 0, H) };
  }

  function startDrag(e, handle) {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* puntero no capturable: el gesto continúa sin captura */ }
    drag = { handle, px: e.clientX, py: e.clientY, start: { ...rect } };
    if (handle === 'draw') {
      const p = pointInImage(e);
      drag.ax = p.x; drag.ay = p.y;
    }
    canvas.classList.add('is-dragging');
  }

  canvas.addEventListener('pointerdown', e => {
    if (!W || e.button !== 0) return;
    const handle = e.target.closest('.crop-handle')?.dataset.handle;
    if (handle)                          startDrag(e, handle);
    else if (box.contains(e.target))     { box.focus({ preventScroll: true }); startDrag(e, 'move'); }
    else                                 startDrag(e, 'draw');
  });

  canvas.addEventListener('pointermove', e => { if (drag) applyDrag(e); });

  const endDrag = e => {
    if (!drag) return;
    drag = null;
    canvas.classList.remove('is-dragging');
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* ya liberado */ }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  // Teclado: flechas mueven 1 px (10 con Mayús)
  box.addEventListener('keydown', e => {
    const step = e.shiftKey ? 10 : 1;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!move) return;
    e.preventDefault();
    commit({ ...rect, x: rect.x + move[0], y: rect.y + move[1] });
  });

  new ResizeObserver(render).observe(img);

  // ── API pública ────────────────────────────────────────────────────────────
  return {
    // Carga la imagen; w y h son su tamaño real (ya orientado)
    load(url, w, h) {
      W = w; H = h;
      empty.hidden = true;
      canvas.hidden = false;
      img.onload = () => {
        const f = 0.9;   // El recuadro inicial cubre el 90 % centrado
        rect = { x: 0, y: 0, w: W, h: H };
        commit(ratio ? refit(ratio) : { x: W * (1 - f) / 2, y: H * (1 - f) / 2, w: W * f, h: H * f });
      };
      img.src = url;
    },

    clear() {
      W = H = 0;
      canvas.hidden = true;
      empty.hidden = false;
      img.removeAttribute('src');
    },

    hasImage: () => W > 0,
    getRect:  () => ({ ...rect }),
    getRatio: () => ratio,
    getSize:  () => ({ width: W, height: H }),

    // Bloquea una proporción (número ancho/alto) o la libera (null)
    setRatio(r) {
      ratio = r || null;
      if (W && ratio) commit(refit(ratio));
      else onChange({ ...rect }, ratio);
    },

    // Intercambia horizontal ↔ vertical manteniendo el centro y el área
    swapOrientation() {
      if (!W) return;
      if (ratio) { ratio = 1 / ratio; commit(refit(ratio)); return; }
      const k = Math.min(1, W / rect.h, H / rect.w);
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      const w = rect.h * k, h = rect.w * k;
      commit({ x: cx - w / 2, y: cy - h / 2, w, h });
    },

    // Edición numérica: patch puede traer x, y, w o h; con proporción bloqueada el otro lado se ajusta
    setRect(patch) {
      if (!W) return;
      let r = { ...rect, ...patch };
      if (ratio) {
        if ('w' in patch)      r.h = r.w / ratio;
        else if ('h' in patch) r.w = r.h * ratio;
        if (r.w > W) { r.w = W; r.h = r.w / ratio; }
        if (r.h > H) { r.h = H; r.w = r.h * ratio; }
      }
      commit({ ...r, w: Math.max(r.w, 1), h: Math.max(r.h, 1) });
    },

    center()   { if (W) commit({ ...rect, x: (W - rect.w) / 2, y: (H - rect.h) / 2 }); },
    maximize() {
      if (!W) return;
      if (!ratio) { commit({ x: 0, y: 0, w: W, h: H }); return; }
      const w = Math.min(W, H * ratio);
      commit({ x: (W - w) / 2, y: (H - w / ratio) / 2, w, h: w / ratio });
    },
  };
}
