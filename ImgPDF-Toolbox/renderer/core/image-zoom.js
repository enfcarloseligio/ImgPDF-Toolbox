// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/image-zoom.js
// Descripción: Zoom para las vistas previas de una sola imagen (marca de texto, foliado,
//              marca de imagen, quitar fondo y recorte). Añade sobre el visor los botones
//              − / + y «Restablecer», y al ampliar convierte el visor en un área
//              desplazable. El zoom es un múltiplo del tamaño ajustado al visor, por lo que
//              «Restablecer» devuelve la imagen a su tamaño original de vista previa.
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const IMAGE_ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];   // Niveles de zoom disponibles

// ── Componente ───────────────────────────────────────────────────────────────

// Añade los controles de zoom justo antes de stage y aplica el zoom sobre img.
// Devuelve { reset(), apply() }: reset() vuelve al ajuste; apply() recalcula el tamaño
// (se llama sola al cargar una imagen nueva o cambiar el tamaño de la ventana).
function attachImageZoom(stage, img) {
  const bar = document.createElement('div');
  bar.className = 'zoom-bar';
  bar.innerHTML = `
    <button class="btn-toggle" type="button" data-zoom="out" title="Alejar">−</button>
    <span class="ptool-zoom" data-zoom="label">100%</span>
    <button class="btn-toggle" type="button" data-zoom="in" title="Acercar">+</button>
    <button class="btn-toggle" type="button" data-zoom="reset" title="Restablecer zoom">Restablecer</button>`;
  stage.before(bar);

  const part = name => bar.querySelector(`[data-zoom="${name}"]`);
  let zoom = 1;

  // Tamaño ajustado: se mide con los estilos propios quitados, para respetar los límites del CSS
  function apply() {
    img.style.width = img.style.maxWidth = img.style.maxHeight = '';
    stage.classList.toggle('is-zoomed', zoom !== 1);
    part('label').textContent = `${Math.round(zoom * 100)}%`;
    part('out').disabled = zoom <= IMAGE_ZOOMS[0];
    part('in').disabled  = zoom >= IMAGE_ZOOMS[IMAGE_ZOOMS.length - 1];
    part('reset').disabled = zoom === 1;
    if (zoom === 1 || img.hidden || !img.clientWidth) return;
    const fit = img.getBoundingClientRect().width;
    img.style.maxWidth = img.style.maxHeight = 'none';
    img.style.width = `${Math.round(fit * zoom)}px`;
  }

  // Recorre los niveles: step = +1 acerca, -1 aleja, 0 restablece
  function zoomBy(step) {
    if (step === 0) zoom = 1;
    else {
      const i = IMAGE_ZOOMS.findIndex(z => z >= zoom - 1e-6);
      const next = (i < 0 ? IMAGE_ZOOMS.length - 1 : i) + step;
      zoom = IMAGE_ZOOMS[Math.min(Math.max(next, 0), IMAGE_ZOOMS.length - 1)];
    }
    apply();
  }

  part('out').addEventListener('click', () => zoomBy(-1));
  part('in').addEventListener('click', () => zoomBy(1));
  part('reset').addEventListener('click', () => zoomBy(0));
  img.addEventListener('load', apply);
  window.addEventListener('resize', () => { if (bar.isConnected) apply(); });
  apply();

  return { reset: () => zoomBy(0), apply };
}
