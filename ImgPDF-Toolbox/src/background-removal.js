// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/background-removal.js
// Descripción: Construye los argumentos de ImageMagick de «Quitar fondo». Admite varios
//              colores de fondo (cada uno con la tolerancia indicada), el borrado desde los
//              bordes o en toda la imagen, el suavizado del borde y un retoque con pincel
//              que restaura píxeles de la imagen original o los borra. No depende de Electron,
//              por lo que puede probarse de forma aislada.
//
//              La lista de imágenes de ImageMagick se mantiene como [original, resultado]:
//              cada color se evalúa siempre sobre el original y el resultado conserva solo lo
//              que ningún color eliminó.
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const MAX_COLORS  = 12;      // Colores de fondo simultáneos
const MAX_STROKES = 400;     // Trazos de retoque
const MAX_POINTS  = 1800;    // Puntos entre todos los trazos (acota la longitud de la orden)

// ── Validación ───────────────────────────────────────────────────────────────

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const clamp  = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);

// Colores válidos (#RRGGBB) sin repetidos y en orden.
function cleanColors(colors) {
  const seen = new Set();
  for (const c of Array.isArray(colors) ? colors : []) {
    if (typeof c === 'string' && HEX_RE.test(c)) seen.add(c.toLowerCase());
    if (seen.size >= MAX_COLORS) break;
  }
  return [...seen];
}

// Trazos de retoque: { mode: 'restore' | 'erase', size, points: [[x, y], …] } con x, y y size
// como fracciones (0–1) del ancho y alto de la imagen, para no depender de la resolución.
function cleanStrokes(strokes) {
  const clean = [];
  let points = 0;
  for (const s of Array.isArray(strokes) ? strokes : []) {
    if (!s || (s.mode !== 'restore' && s.mode !== 'erase') || !Array.isArray(s.points)) continue;
    const pts = s.points
      .filter(p => Array.isArray(p) && p.length >= 2)
      .map(p => [clamp(p[0], 0, 1), clamp(p[1], 0, 1)]);
    if (!pts.length || points + pts.length > MAX_POINTS) continue;
    points += pts.length;
    clean.push({ mode: s.mode, size: clamp(s.size, 0.002, 0.5), points: pts });
    if (clean.length >= MAX_STROKES) break;
  }
  return clean;
}

// ── Construcción de argumentos ───────────────────────────────────────────────

// Etapa de un color: devuelve una copia del original (índice 0) con ese fondo transparente.
// «edges» rellena desde el borde (solo el fondo conectado); «global» lo elimina en todo.
function colorStage(color, fuzzPct, method) {
  const core = method === 'global'
    ? ['-fuzz', fuzzPct, '-transparent', color]
    : ['-bordercolor', color, '-border', '1x1', '-fuzz', fuzzPct, '-fill', 'none', '-draw', 'color 0,0 floodfill', '-shave', '1x1'];
  return ['(', '-clone', '0', ...core, ')'];
}

// Trazo en coordenadas de píxel.
function polyline(stroke, width, height) {
  const pts = stroke.points.map(([x, y]) => [x * (width - 1), y * (height - 1)]);
  // Un solo punto se dibuja como un punto redondo (segmento casi nulo)
  if (pts.length === 1) pts.push([pts[0][0] + 0.01, pts[0][1]]);
  return `stroke-linecap round stroke-linejoin round polyline ${pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')}`;
}

// Pasos de retoque, en el orden en que se hicieron los trazos. Los consecutivos del mismo modo
// comparten una sola máscara.
function retouchStages(strokes, width, height) {
  const groups = [];
  for (const s of strokes) {
    const last = groups[groups.length - 1];
    if (last && last.mode === s.mode) last.items.push(s); else groups.push({ mode: s.mode, items: [s] });
  }

  // La lista siempre es [original, resultado]; cada paso añade una capa, la combina con el
  // resultado dentro de paréntesis (los ajustes de -compose no se filtran fuera) y la retira
  const stages = [];
  const size = `${width}x${height}`;
  for (const g of groups) {
    const draws = g.items.flatMap(s => ['-strokewidth', String(Math.max(1, s.size * width).toFixed(2)), '-draw', polyline(s, width, height)]);
    // Capa transparente con los trazos opacos (el color no importa: solo cuenta su opacidad)
    stages.push('(', '-size', size, 'xc:none', '-fill', 'none', '-stroke', 'black', ...draws, ')');
    if (g.mode === 'restore') {
      // El original recortado a los trazos se coloca sobre el resultado
      stages.push('(', '-clone', '0,2', '-compose', 'DstIn', '-composite', ')',
        '(', '-clone', '1,3', '-compose', 'Over', '-composite', ')', '-delete', '1-3');
    } else {
      // La opacidad de los trazos se resta de la del resultado
      stages.push('(', '-clone', '1,2', '-compose', 'DstOut', '-composite', ')', '-delete', '1,2');
    }
  }
  return stages;
}

// Argumentos completos desde la imagen de entrada hasta el archivo de salida.
//   inputArgs     argumentos que leen y orientan la imagen (p. ej. ['foto.jpg[0]', '-auto-orient'])
//   width,height  tamaño de la imagen tras inputArgs (para el retoque)
//   colors        colores de fondo (#RRGGBB)
//   strokes       trazos de retoque ya validados con cleanStrokes
//   outArgs       argumentos de salida (compresión) y ruta del archivo
function buildRemoveBackgroundArgs({ inputArgs, width, height, colors, fuzz, method, feather, strokes = [], outArgs }) {
  const list = cleanColors(colors);
  if (!list.length) throw new Error('Elige al menos un color de fondo.');
  const fuzzPct = `${clamp(fuzz, 0, 100)}%`;

  // Lista de imágenes: [original, color 1, color 2, …]
  const args = [...inputArgs, '-alpha', 'set'];
  // Cada color se evalúa sobre el original y se funde con el acumulado: queda transparente
  // lo que cualquiera de ellos quitó
  list.forEach((c, i) => {
    args.push(...colorStage(c, fuzzPct, method));
    if (i > 0) args.push('(', '-clone', '1,2', '-compose', 'DstIn', '-composite', ')', '-delete', '1,2');
  });

  // Suavizado leve del borde de la transparencia para evitar contornos duros
  if (feather) args.push('(', '-clone', '1', '-channel', 'A', '-blur', '0x0.8', '-level', '45%,100%', '+channel', ')', '-delete', '1');

  args.push(...retouchStages(strokes, width, height));

  // Solo el resultado va al archivo; el original (índice 0) era la referencia
  args.push('-delete', '0', ...outArgs);
  return args;
}

module.exports = { cleanColors, cleanStrokes, buildRemoveBackgroundArgs, MAX_COLORS };
