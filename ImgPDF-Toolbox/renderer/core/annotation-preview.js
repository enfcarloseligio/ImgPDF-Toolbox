// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/annotation-preview.js
// Descripción: Vista previa real de las anotaciones (marca de texto, foliado y marca de
//              imagen). Pide al proceso principal que aplique la anotación sobre la página
//              del primer archivo con el mismo código que el procesamiento final, de modo que
//              se ve exactamente cómo quedará. Sin archivo usa una hoja A4 de muestra. Se
//              actualiza sola al cambiar las opciones (con espera para no saturar), de una
//              petición a la vez, y permite recorrer las páginas de un PDF.
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const ANNOTATION_PREVIEW_DELAY = 400;   // Espera tras el último cambio antes de generar (ms)

// ── Componente ───────────────────────────────────────────────────────────────

// Crea la vista previa dentro de container. Opciones:
//   tool       'watermark' | 'folio' | 'watermark-image' (herramienta que se previsualiza)
//   getParams  () → parámetros de la anotación (los mismos que recibe el procesamiento final) o
//              { error } con un aviso si todavía no se puede generar
//   getFile    () → ruta del primer archivo, o null para usar la hoja de muestra
// Devuelve { refresh() }: pide una actualización (con espera).
function createAnnotationPreview(container, { tool, getParams, getFile }) {
  container.innerHTML = `<div class="apv">
    <div class="apv-nav" hidden>
      <button class="btn-toggle" type="button" data-apv="prev" title="Página anterior">${icon('back', 16)}</button>
      <input type="number" class="num-input" data-apv="page" min="1" value="1" title="Página de la vista previa">
      <span class="apv-pages" data-apv="pages">/ 1</span>
      <button class="btn-toggle" type="button" data-apv="next" title="Página siguiente">${icon('arrow-right', 16)}</button>
    </div>
    <div class="apv-stage is-loading" data-apv="stage">
      <img class="apv-img" data-apv="img" alt="Vista previa" hidden>
      <div class="apv-status" data-apv="status">Generando vista previa…</div>
    </div>
    <p class="option-hint" data-apv="caption"></p>
  </div>`;

  const part = name => container.querySelector(`[data-apv="${name}"]`);
  const nav = container.querySelector('.apv-nav');

  let page = 1, pages = 1;
  let lastFile = null;
  let timer = null;
  let inFlight = false;
  let dirty = false;

  // ── Estado visible ─────────────────────────────────────────────────────────
  const setStatus = (text, { loading = false, hideImage = false } = {}) => {
    part('status').textContent = text;
    part('status').hidden = !text;
    part('stage').classList.toggle('is-loading', loading);
    if (hideImage) part('img').hidden = true;
  };

  // ── Generación ─────────────────────────────────────────────────────────────
  // Una sola petición a la vez: si cambian las opciones mientras se genera, al terminar se
  // vuelve a generar con las últimas
  async function run() {
    if (!container.isConnected) return;
    if (inFlight) { dirty = true; return; }

    const params = getParams();
    if (params?.error) {
      setStatus(params.error, { hideImage: true });
      part('caption').textContent = '';
      return;
    }

    const file = getFile() || null;
    if (file !== lastFile) { page = 1; lastFile = file; }

    inFlight = true;
    setStatus('Actualizando vista previa…', { loading: true });
    const res = await window.api.previewAnnotation({ tool, file, page, params });
    inFlight = false;

    if (!container.isConnected) return;

    if (res.ok) {
      pages = res.pages; page = res.page;
      part('img').src = toFileUrl(res.path);
      part('img').hidden = false;
      setStatus('');
      nav.hidden = pages < 2;
      part('page').value = page;
      part('page').max = pages;
      part('pages').textContent = `/ ${pages}`;
      part('prev').disabled = page <= 1;
      part('next').disabled = page >= pages;
      part('caption').textContent = file
        ? `Vista previa real de «${res.source}»${pages > 1 ? `, página ${page} de ${pages}` : ''}: se genera con el mismo proceso que el archivo final.`
        : 'Vista previa real sobre una hoja A4 de muestra. Agrega un archivo para verla sobre tu documento.';
      // Fuente con la que se estampó el texto (la variante que corresponde al peso y la cursiva elegidos)
      if (res.font) part('caption').textContent += ` Fuente usada: ${res.font}.`;
    } else {
      setStatus(res.error, { hideImage: true });
      part('caption').textContent = '';
    }

    if (dirty) { dirty = false; run(); }
  }

  // ── Navegación entre páginas ───────────────────────────────────────────────
  const go = n => { page = Math.min(Math.max(n, 1), pages); run(); };
  part('prev').addEventListener('click', () => go(page - 1));
  part('next').addEventListener('click', () => go(page + 1));
  part('page').addEventListener('change', e => { const n = parseInt(e.target.value, 10); if (!isNaN(n)) go(n); });

  // ── API pública ────────────────────────────────────────────────────────────
  return {
    refresh() {
      clearTimeout(timer);
      timer = setTimeout(run, ANNOTATION_PREVIEW_DELAY);
    },
  };
}
