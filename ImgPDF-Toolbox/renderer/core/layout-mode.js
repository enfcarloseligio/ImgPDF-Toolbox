// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/layout-mode.js
// Descripción: Selector del ancho del área de trabajo, en la cabecera. «Contenedor» limita el
//              contenido a un ancho cómodo de lectura; «Canvas» lo extiende a todo el ancho de
//              la ventana dejando solo un pequeño margen lateral, útil para ver mejor los
//              visores. La elección se recuerda entre sesiones.
// ═════════════════════════════════════════════════════════════════════════════

const LAYOUT_MODES = ['container', 'canvas'];

// Aplica el modo al contenedor de la aplicación y marca el botón activo.
function applyLayoutMode(mode) {
  const app = document.getElementById('app');
  app?.classList.toggle('is-canvas', mode === 'canvas');
  document.querySelectorAll('[data-layout-mode]').forEach(btn => {
    const active = btn.dataset.layoutMode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

// Lee la preferencia guardada, la aplica y enlaza los botones.
async function initLayoutMode() {
  let mode = 'container';
  try { const saved = await window.api.storeGet('layoutMode'); if (LAYOUT_MODES.includes(saved)) mode = saved; } catch (_) {}
  applyLayoutMode(mode);

  document.querySelectorAll('[data-layout-mode]').forEach(btn => btn.addEventListener('click', () => {
    applyLayoutMode(btn.dataset.layoutMode);
    window.api.storeSet('layoutMode', btn.dataset.layoutMode).catch(() => {});
  }));
}
