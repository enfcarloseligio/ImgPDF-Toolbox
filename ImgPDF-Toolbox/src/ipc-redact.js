// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-redact.js
// Descripción: Herramienta «Testar»: oculta datos con cuadros negros. Define cómo se validan
//              los cuadros y cómo se pintan sobre cada página; el resto (sesiones con avance
//              guardado, rasterizado y exportación) lo aporta src/page-tool.js. Los cuadros
//              se funden con los píxeles de la página, por lo que el contenido tapado no
//              puede recuperarse del archivo exportado.
// ═════════════════════════════════════════════════════════════════════════════

const { registerPageTool, sanitizePages, cleanRect } = require('./page-tool');

// ── Cuadros ──────────────────────────────────────────────────────────────────
// Se guardan como fracciones (0–1) de la página, independientes de la resolución con la que
// se muestre o se exporte.

const sanitizeBoxes = (boxes, pageCount) => sanitizePages(boxes, pageCount, cleanRect);

// Argumentos de ImageMagick que pintan los cuadros en píxeles. Los bordes se redondean hacia
// afuera para que no quede ninguna franja de texto sin cubrir.
function drawBoxes(list, { width, height }, _context, { color = '#000000' } = {}) {
  const args = [];
  for (const b of list) {
    const x0 = Math.max(0, Math.floor(b.x * width));
    const y0 = Math.max(0, Math.floor(b.y * height));
    const x1 = Math.min(width,  Math.ceil((b.x + b.w) * width))  - 1;
    const y1 = Math.min(height, Math.ceil((b.y + b.h) * height)) - 1;
    if (x1 >= x0 && y1 >= y0) args.push('-draw', `rectangle ${x0},${y0} ${x1},${y1}`);
  }
  return args.length ? ['-fill', color, '-stroke', 'none', ...args] : [];
}

// ── Registro ─────────────────────────────────────────────────────────────────

registerPageTool({
  channel:       'redact',
  moduleId:      'redact',
  dirName:       'redact-sessions',
  suffix:        '-testado',
  emptyMessage:  'Dibuja al menos un cuadro antes de exportar.',
  sanitizeItems: sanitizeBoxes,
  composeArgs:   drawBoxes,
});
