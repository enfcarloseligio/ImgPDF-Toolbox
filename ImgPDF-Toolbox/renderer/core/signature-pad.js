// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/signature-pad.js
// Descripción: Panel para dibujar una firma a mano con ratón, lápiz o pantalla táctil. Los
//              trazos se suavizan, se pueden deshacer uno a uno y, al guardar, la firma se
//              recorta a su contorno y se exporta como PNG con fondo transparente, lista
//              para colocarse sobre un documento.
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const SIGPAD_WIDTH   = 600;   // Lienzo lógico (los trazos se guardan en estas unidades)
const SIGPAD_HEIGHT  = 200;
const SIGPAD_EXPORT  = 3;     // Factor de ampliación al exportar, para que la firma conserve nitidez
const SIGPAD_MARGIN  = 6;     // Margen transparente alrededor de la firma exportada, en unidades lógicas

// ── Panel ────────────────────────────────────────────────────────────────────

// Crea el panel dentro de container. onChange() se llama al añadir, deshacer o borrar trazos.
function createSignaturePad(container, { color = '#111827', width = 3, onChange = () => {} } = {}) {
  container.innerHTML = '<canvas class="sigpad-canvas"></canvas><span class="sigpad-hint">Firma aquí</span>';
  const canvas = container.querySelector('.sigpad-canvas');
  const hint   = container.querySelector('.sigpad-hint');
  const ctx    = canvas.getContext('2d');

  // La resolución interna es doble para que el trazo se vea nítido en pantallas de alta densidad
  const SCALE = 2;
  canvas.width  = SIGPAD_WIDTH * SCALE;
  canvas.height = SIGPAD_HEIGHT * SCALE;

  let strokes = [];       // [{ color, width, points: [{ x, y }] }]
  let current = null;     // Trazo en curso
  let pen = { color, width };

  // ── Dibujo ─────────────────────────────────────────────────────────────────

  // Dibuja un trazo con curvas cuadráticas entre los puntos medios: suaviza el temblor del ratón
  function drawStroke(c, stroke, k) {
    const pts = stroke.points;
    c.strokeStyle = stroke.color;
    c.fillStyle   = stroke.color;
    c.lineWidth   = stroke.width * k;
    c.lineCap = c.lineJoin = 'round';

    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0].x * k, pts[0].y * k, stroke.width * k / 2, 0, Math.PI * 2);
      c.fill();
      return;
    }
    c.beginPath();
    c.moveTo(pts[0].x * k, pts[0].y * k);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      c.quadraticCurveTo(pts[i].x * k, pts[i].y * k, mx * k, my * k);
    }
    const last = pts[pts.length - 1];
    c.lineTo(last.x * k, last.y * k);
    c.stroke();
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(s => drawStroke(ctx, s, SCALE));
    hint.hidden = strokes.length > 0;
  }

  // ── Gestos ─────────────────────────────────────────────────────────────────
  const pointOf = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * SIGPAD_WIDTH / r.width, y: (e.clientY - r.top) * SIGPAD_HEIGHT / r.height };
  };

  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* puntero no capturable: el trazo continúa sin captura */ }
    current = { color: pen.color, width: pen.width, points: [pointOf(e)] };
    strokes.push(current);
    redraw();
  });

  canvas.addEventListener('pointermove', e => {
    if (!current) return;
    current.points.push(pointOf(e));
    redraw();
  });

  const end = () => {
    if (!current) return;
    current = null;
    onChange();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  redraw();

  // ── API pública ────────────────────────────────────────────────────────────
  return {
    setColor(c) { pen.color = c; },
    setWidth(w) { pen.width = w; },
    isEmpty: () => strokes.length === 0,

    undo() { strokes.pop(); redraw(); onChange(); },
    clear() { strokes = []; redraw(); onChange(); },

    // Firma recortada a su contorno, como { dataUrl, width, height } en píxeles (PNG transparente)
    toPng() {
      if (!strokes.length) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const s of strokes) {
        for (const p of s.points) {
          x0 = Math.min(x0, p.x - s.width); y0 = Math.min(y0, p.y - s.width);
          x1 = Math.max(x1, p.x + s.width); y1 = Math.max(y1, p.y + s.width);
        }
      }
      x0 = Math.max(0, x0 - SIGPAD_MARGIN); y0 = Math.max(0, y0 - SIGPAD_MARGIN);
      x1 = Math.min(SIGPAD_WIDTH, x1 + SIGPAD_MARGIN); y1 = Math.min(SIGPAD_HEIGHT, y1 + SIGPAD_MARGIN);

      const out = document.createElement('canvas');
      out.width  = Math.max(1, Math.round((x1 - x0) * SIGPAD_EXPORT));
      out.height = Math.max(1, Math.round((y1 - y0) * SIGPAD_EXPORT));
      const c = out.getContext('2d');
      c.translate(-x0 * SIGPAD_EXPORT, -y0 * SIGPAD_EXPORT);
      strokes.forEach(s => drawStroke(c, s, SIGPAD_EXPORT));
      return { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height };
    },
  };
}
