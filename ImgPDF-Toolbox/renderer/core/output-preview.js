// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/output-preview.js
// Descripción: Vista previa del resultado de las herramientas de imagen que cambian el archivo
//              (Convertir, Redimensionar y Comprimir). Aplica a la primera imagen el mismo
//              proceso que el lote, así que se ve la compresión real, y muestra el formato, el
//              tamaño en píxeles y el peso antes y después. Se actualiza sola al cambiar las
//              opciones (con espera), de una petición a la vez, y tiene zoom. Usa el mismo
//              aspecto que la vista previa de marcas (.apv).
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const OUTPUT_PREVIEW_DELAY = 450;   // Espera tras el último cambio antes de generar (ms)

// ── Componente ───────────────────────────────────────────────────────────────

// Crea la vista previa dentro de container. Opciones:
//   tool       'convert' | 'resize' | 'compress'
//   getFile    () → ruta de la primera imagen, o null si no hay
//   getParams  () → parámetros del proceso (los mismos que recibe el lote) o { error } con un aviso
// Devuelve { refresh() }: pide una actualización (con espera).
function createOutputPreview(container, { tool, getFile, getParams }) {
  container.innerHTML = `<div class="apv">
    <div class="apv-stage is-loading" data-opv="stage">
      <img class="apv-img" data-opv="img" alt="Vista previa del resultado" hidden>
      <div class="apv-status" data-opv="status">Selecciona una imagen para ver el resultado.</div>
    </div>
    <p class="option-hint" data-opv="caption"></p>
  </div>`;

  const part = name => container.querySelector(`[data-opv="${name}"]`);
  attachImageZoom(part('stage'), part('img'));

  let timer = null;
  let inFlight = false;
  let dirty = false;

  const setStatus = (text, { loading = false, hideImage = false } = {}) => {
    part('status').textContent = text;
    part('status').hidden = !text;
    part('stage').classList.toggle('is-loading', loading);
    if (hideImage) part('img').hidden = true;
  };

  // Una sola petición a la vez: si cambian las opciones mientras se genera, al terminar se
  // vuelve a generar con las últimas
  async function run() {
    if (!container.isConnected) return;
    if (inFlight) { dirty = true; return; }

    const file = getFile();
    if (!file) {
      setStatus('Selecciona una imagen para ver el resultado.', { hideImage: true });
      part('caption').textContent = '';
      return;
    }
    const params = getParams();
    if (params?.error) {
      setStatus(params.error, { hideImage: true });
      part('caption').textContent = '';
      return;
    }

    inFlight = true;
    setStatus('Actualizando vista previa…', { loading: true });
    const res = await window.api.imageOutputPreview({ tool, file, params });
    inFlight = false;
    if (!container.isConnected) return;

    if (res.ok) {
      part('img').src = `${toFileUrl(res.path)}?v=${Date.now()}`;
      part('img').hidden = false;
      setStatus('');
      const delta = res.sizeBefore ? Math.round((1 - res.bytes / res.sizeBefore) * 100) : 0;
      part('caption').textContent =
        `Resultado de «${basename(file)}»: ${res.format.toUpperCase()} · ${res.width} × ${res.height} px · ${formatBytes(res.bytes)}` +
        (res.sizeBefore ? ` (antes ${formatBytes(res.sizeBefore)}, ${delta >= 0 ? `−${delta}` : `+${-delta}`} %)` : '') +
        '. Se genera con el mismo proceso que el lote.';
    } else {
      setStatus(res.error || 'No se pudo generar la vista previa.', { hideImage: true });
      part('caption').textContent = '';
    }

    if (dirty) { dirty = false; run(); }
  }

  return {
    refresh() {
      clearTimeout(timer);
      timer = setTimeout(run, OUTPUT_PREVIEW_DELAY);
    },
  };
}

// Actualiza la vista previa con cualquier cambio de opciones dentro de root (clics en botones,
// campos, deslizadores y casillas), sin tener que enlazar cada control por separado.
function refreshOnChange(root, preview) {
  ['click', 'input', 'change'].forEach(type => root.addEventListener(type, e => {
    if (e.target.closest('.file-zone, .output-row, .action-bar, .zoom-bar, .apv-nav, .igal')) return;   // Archivos y salida no cambian el resultado
    preview.refresh();
  }));
}
