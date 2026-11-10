// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/page-tool.js
// Descripción: Controlador común de las herramientas que editan sobre un visor de páginas
//              («Testar» y «Firmar»): selección del PDF o la imagen, apertura como sesión,
//              visor con edición, autoguardado del avance (recuperable tras un cierre
//              accidental o un corte de luz), lista de trabajo pendiente y exportación como
//              imagen suelta o dentro de un PDF. Cada herramienta aporta su definición:
//              textos, modo del editor y, si lo necesita, un panel adicional.
// ═════════════════════════════════════════════════════════════════════════════

// ── Guardado al cerrar la ventana ────────────────────────────────────────────
// El módulo activo registra aquí su función de guardado; se invoca si la ventana se oculta o
// se cierra con cambios pendientes, y al abrir de nuevo una herramienta.

let pageToolActive = null;
window.addEventListener('beforeunload', () => pageToolActive?.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) pageToolActive?.flush(); });

// ── Utilidades ───────────────────────────────────────────────────────────────

const pageToolEscape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pageToolDate   = ts => new Date(ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
const pageToolTime   = ts => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ── Controlador ──────────────────────────────────────────────────────────────

// ctx es el contexto con el que se abrió el módulo; def describe la herramienta:
//   id, api, progress     id del módulo (configuración e ids), prefijo de window.api y id de progreso
//   title, titleIcon      encabezado
//   description(isPdf)    texto bajo el título
//   pdfOnly               solo admite PDF (si no, la categoría decide PDF o imagen)
//   itemNoun              «cuadro(s)», «firma(s)»…
//   runLabel, doneTitle   texto del botón de exportar y título del resultado
//   pdfHint               explicación del modo «PDF»
//   editorMode, editorEmptyText, infoIdle
//   removeLabel, removeTitle
//   previewTopHtml        HTML que va sobre la barra de herramientas del visor
//   shortcut(isPdf)       { label, go(outputs) } del botón de atajo, o null
//   setup(ctrl)           se ejecuta tras construir la interfaz y devuelve las opciones
//                         adicionales del editor ({ getStamp, resolveSrc, onNeedStamp })
async function renderPageTool(ctx, def) {
  pageToolActive?.flush();

  const P     = def.id;
  const kind  = def.pdfOnly || ctx.context !== 'image' ? 'pdf' : 'imageAny';
  const isPdf = kind === 'pdf';
  const api   = name => window.api[def.api + name];

  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig(P, { dpi: 300, mode: 'pdf', imageFormat: 'png', quality: 100, discard: true, fillColor: '#000000' });
  let { mode, imageFormat, discard, fillColor } = cfg;
  let dpi = snapDpi(cfg.dpi), quality = snapQuality(cfg.quality);

  let session = null;       // Sesión abierta: { id, source, pages, boxes, ... }
  let currentPage = 0;
  let savedAt = null;       // Hora del último guardado del avance
  let saveTimer = null;
  let resolvePrompt = null; // Respuesta pendiente de «continuar o empezar de nuevo»
  let lastOutputs = [];     // Archivos generados en la última exportación (para el atajo)

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const shortcut = def.shortcut?.(isPdf);
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module module-ptool module-${P}">
    <div class="module-title">${icon(def.titleIcon, 22)} ${def.title}</div>
    <p class="module-desc">${def.description(isPdf)}</p>

    <div data-step="notice">
      <div id="${P}-prompt"></div>
      <div id="${P}-pending"></div>
    </div>

    ${fileZoneHtml({ zone: `zone-${P}`, pick: `pick-${P}`, clear: `clear-${P}`, badge: `${P}-badge`, list: `${P}-list`, kind, multiple: false })}
    ${outputDirRow(P)}

    ${def.fillColor ? `<div class="option-group wide">
      <label>Color de los cuadros</label>
      <div class="ptool-fill-row">
        <div id="${P}-fill"></div>
        <button class="btn-secondary btn-sm" id="${P}-fill-reset" type="button" title="Vuelve al negro puro (#000000)">Negro (predeterminado)</button>
      </div>
      <p class="option-hint">Por defecto los cuadros son negro puro (#000000). Cambia el tono si lo necesitas; se aplica al visor y al archivo exportado.</p>
    </div>` : ''}
    ${isPdf ? `<div class="option-group">
      <label>Resolución de trabajo</label>
      <div class="option-row" id="${P}-dpi"></div>
      <p class="option-hint">Se aplica al abrir el archivo. Es la nitidez con la que se rasteriza cada página: más resolución conserva más detalle y pesa más. Con PNG no hay pérdida adicional; 300 DPI o más equivale a calidad de impresión.</p>
    </div>` : ''}
    <div class="option-group">
      <label>Guardar como</label>
      <div class="option-row" id="${P}-mode"></div>
      <p class="option-hint" id="${P}-mode-hint"></p>
    </div>
    <div class="option-group">
      <label>Formato de la imagen</label>
      <div class="option-row" id="${P}-format"></div>
    </div>
    <div class="option-group" id="${P}-quality-group">
      <label>Calidad del JPG</label>
      <div class="option-row" id="${P}-quality"></div>
    </div>
    <div class="option-group">
      <label>Avance guardado</label>
      <label class="check-row"><input type="checkbox" id="${P}-discard"> Eliminar el avance guardado después de exportar</label>
    </div>

    <div class="option-group wide" data-step="preview" data-step-title="${def.previewTitle}">
      <label>${def.previewTitle}</label>
      ${def.previewTopHtml || ''}
      <div class="ptool-toolbar">
        <div class="ptool-tools">
          <button class="btn-toggle" id="rd-prev" type="button" title="Página anterior">${icon('back', 16)}</button>
          <input type="number" class="num-input" id="rd-page" min="1" value="1" title="Ir a la página">
          <span class="ptool-pages" id="rd-pages">/ 1</span>
          <button class="btn-toggle" id="rd-next" type="button" title="Página siguiente">${icon('arrow-right', 16)}</button>
        </div>
        <div class="ptool-tools">
          <button class="btn-toggle" id="rd-undo" type="button" title="Deshacer (Ctrl+Z)">Deshacer</button>
          <button class="btn-toggle" id="rd-redo" type="button" title="Rehacer (Ctrl+Y)">Rehacer</button>
          <button class="btn-toggle" id="rd-del" type="button" title="${def.removeTitle} (Supr)">${iconLabel('trash', def.removeLabel, 14)}</button>
          ${isPdf ? `<button class="btn-toggle" id="rd-all" type="button" title="Repite el elemento seleccionado en todas las páginas">En todas las páginas</button>` : ''}
          <button class="btn-toggle" id="rd-clearpage" type="button" title="Quita todo de esta página">Limpiar página</button>
        </div>
        <div class="ptool-tools">
          <button class="btn-toggle" id="rd-zout" type="button" title="Alejar">−</button>
          <span class="ptool-zoom" id="rd-zoom">100%</span>
          <button class="btn-toggle" id="rd-zin" type="button" title="Acercar">+</button>
          <button class="btn-toggle" id="rd-zfit" type="button" title="Restablecer zoom (ajustar al ancho)">Restablecer</button>
        </div>
      </div>
      <div class="ptool-stage" id="${P}-stage"></div>
      <p class="option-hint" id="${P}-info">${def.infoIdle}</p>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="run-${P}" disabled style="width:auto">${def.runLabel}</button>
      <button class="btn-danger"  id="cancel-${P}" style="display:none;width:auto">Cancelar</button>
      ${shortcut ? `<button class="btn-secondary" id="goto-${P}" style="width:auto">${iconLabel('arrow-right', shortcut.label)}</button>` : ''}
    </div>
    <div class="progress-panel" id="${P}-progress"></div>
    <div id="${P}-result"></div>
  </div>`;
  organizeModule(ws);

  const $ = id => document.getElementById(id);
  const save = patch => saveModuleConfig(P, patch);

  // ── Editor ───────────────────────────────────────────────────────────────────
  const ctrl = { $, syncUi: () => syncUi(), editor: null };
  const extra = def.setup?.(ctrl) || {};
  const editor = ctrl.editor = createPageEditor($(`${P}-stage`), {
    mode: def.editorMode, emptyText: def.editorEmptyText,
    onChange: () => scheduleSave(),
    onState:  () => syncUi(),
    ...extra,
  });

  // ── Estado de los controles ──────────────────────────────────────────────────
  function syncUi() {
    const total = session ? session.pages.length : 0;
    const open  = !!session && editor.hasPage();
    const busy  = state.isProcessing;

    $('rd-prev').disabled      = !open || currentPage <= 0;
    $('rd-next').disabled      = !open || currentPage >= total - 1;
    $('rd-page').disabled      = !open || total < 2;
    $('rd-page').max           = total || 1;
    if (document.activeElement !== $('rd-page')) $('rd-page').value = currentPage + 1;
    $('rd-pages').textContent  = `/ ${total || 1}`;

    $('rd-undo').disabled      = !open || !editor.canUndo();
    $('rd-redo').disabled      = !open || !editor.canRedo();
    $('rd-del').disabled       = !open || !editor.hasSelection();
    if ($('rd-all')) $('rd-all').disabled = !open || !editor.hasSelection() || total < 2;
    $('rd-clearpage').disabled = !open || editor.countPage() === 0;
    $('rd-zoom').textContent   = `${Math.round(editor.getZoom() * 100)}%`;

    $(`clear-${P}`).style.display = session ? 'inline-block' : 'none';
    $(`${P}-badge`).textContent   = fileCountText(session ? 1 : 0, kind);
    $(`run-${P}`).disabled = !(session && editor.countAll() > 0 && state.outputDir && !busy);

    $(`${P}-info`).textContent = open
      ? `${total > 1 ? `Página ${currentPage + 1} de ${total} · ` : ''}${editor.countPage()} ${def.itemNoun} en esta página · ${editor.countAll()} en total` +
        (savedAt ? ` · Avance guardado a las ${pageToolTime(savedAt)}` : '')
      : def.infoIdle;
  }

  // ── Autoguardado del avance ──────────────────────────────────────────────────
  async function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!session) return;
    const res = await api('Save')({ id: session.id, boxes: editor.getAll(), currentPage });
    if (res.ok) { savedAt = res.updatedAt; if ($(`${P}-info`)) syncUi(); }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 500);
  }

  pageToolActive = { flush: () => { if (saveTimer) flushSave(); } };

  // ── Páginas ──────────────────────────────────────────────────────────────────
  function goToPage(index) {
    if (!session) return;
    currentPage = Math.min(Math.max(index, 0), session.pages.length - 1);
    editor.showPage(currentPage, toFileUrl(session.pages[currentPage].path));
    scheduleSave();
  }

  $('rd-prev').addEventListener('click', () => goToPage(currentPage - 1));
  $('rd-next').addEventListener('click', () => goToPage(currentPage + 1));
  $('rd-page').addEventListener('change', e => {
    const n = parseInt(e.target.value, 10);
    if (!isNaN(n)) goToPage(n - 1);
    syncUi();
  });

  // ── Herramientas de edición y zoom ───────────────────────────────────────────
  $('rd-undo').addEventListener('click', () => editor.undo());
  $('rd-redo').addEventListener('click', () => editor.redo());
  $('rd-del').addEventListener('click', () => editor.removeSelected());
  $('rd-clearpage').addEventListener('click', () => editor.clearPage());
  $('rd-all')?.addEventListener('click', () => {
    const n = editor.copySelectedToAll(session.pages.length);
    if (n) notify.success(`Copiado a ${n} página(s) más.`);
  });
  $('rd-zin').addEventListener('click',  () => editor.zoomBy(1));
  $('rd-zout').addEventListener('click', () => editor.zoomBy(-1));
  $('rd-zfit').addEventListener('click', () => editor.zoomBy(0));

  // ── Opciones de salida ───────────────────────────────────────────────────────
  const updateOptions = () => {
    $(`${P}-quality-group`).style.display = imageFormat === 'jpg' ? '' : 'none';
    $(`${P}-mode-hint`).textContent = mode === 'pdf' ? def.pdfHint : 'Cada página se guarda como una imagen independiente.';
  };

  if (isPdf) {
    profilePicker($(`${P}-dpi`), dpiOptions(),
      dpi, v => { dpi = v; }, v => save({ dpi: v }));
  }

  optButtons($(`${P}-mode`), [
    { label: 'PDF',              value: 'pdf'    },
    { label: 'Imágenes sueltas', value: 'images' },
  ], mode, v => { mode = v; updateOptions(); }, v => save({ mode: v }));

  optButtons($(`${P}-format`), [
    { label: 'PNG (sin pérdida)',  value: 'png' },
    { label: 'JPG (más ligero)',   value: 'jpg' },
  ], imageFormat, v => { imageFormat = v; updateOptions(); }, v => save({ imageFormat: v }));

  profilePicker($(`${P}-quality`), qualityOptions(), quality, v => { quality = v; }, v => save({ quality: v }));

  // ── Color de los cuadros ─────────────────────────────────────────────────────
  if (def.fillColor) {
    const applyFill = () => $(`${P}-stage`).style.setProperty('--ptool-fill', fillColor);
    const fillField = createColorField($(`${P}-fill`), {
      value: fillColor,
      onChange: v => { fillColor = v; save({ fillColor }); applyFill(); },
    });
    $(`${P}-fill-reset`).addEventListener('click', () => {
      fillColor = '#000000';
      fillField.setValue(fillColor);
      save({ fillColor });
      applyFill();
    });
    applyFill();
  }

  $(`${P}-discard`).checked = discard;
  $(`${P}-discard`).addEventListener('change', e => { discard = e.target.checked; save({ discard }); });
  updateOptions();

  // ── Trabajo sin terminar ─────────────────────────────────────────────────────
  // Lista las sesiones guardadas del mismo tipo que no están abiertas, para retomarlas aunque
  // no se recuerde qué archivo era.
  async function refreshPending() {
    const box = $(`${P}-pending`);
    if (!box) return;
    const res = await api('ListSessions')();
    const mine = (res.sessions || []).filter(s => (s.kind === 'pdf') === isPdf && s.id !== session?.id);

    box.innerHTML = mine.length ? `<div class="result-box info">
      <div class="result-title">${icon('info', 16)} Trabajo sin terminar</div>
      ${mine.map(s => `<div class="result-item ptool-pending-item">
        <span title="${pageToolEscape(s.source)}">${icon('file', 14)} ${pageToolEscape(basename(s.source))} — ${s.pages} pág., ${s.boxCount} ${def.itemNoun}, ${pageToolDate(s.updatedAt)}</span>
        <span class="ptool-pending-actions">
          <button class="btn-secondary btn-sm" data-resume="${s.id}">Continuar</button>
          <button class="btn-secondary btn-sm" data-discard="${s.id}">Descartar</button>
        </span>
      </div>`).join('')}
    </div>` : '';

    box.querySelectorAll('[data-resume]').forEach(btn => btn.addEventListener('click', () => resume(btn.dataset.resume)));
    box.querySelectorAll('[data-discard]').forEach(btn => btn.addEventListener('click', () => confirmDiscard(btn)));
  }

  // Descartar es irreversible: el primer clic pide confirmación y el segundo la ejecuta
  function confirmDiscard(btn) {
    if (btn.dataset.armed) {
      api('Discard')({ id: btn.dataset.discard }).then(refreshPending);
      return;
    }
    btn.dataset.armed = '1';
    btn.textContent = '¿Seguro? Confirmar';
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Descartar'; } }, 4000);
  }

  async function resume(id) {
    if (state.isProcessing) return;
    const res = await api('LoadSession')({ id });
    if (!res.ok) { notify.error(res.error); refreshPending(); return; }
    await checkDefaultOutputDir(res.session.source, `${P}-path`);
    attach(res.session);
    notify.info('Avance recuperado.');
  }

  // Pregunta qué hacer cuando el archivo elegido ya tiene avance guardado
  function askResume(found) {
    return new Promise(resolve => {
      resolvePrompt = resolve;
      $(`${P}-prompt`).innerHTML = `<div class="result-box warning">
        <div class="result-title">${icon('alert', 16)} Este archivo ya tiene avance guardado</div>
        <div class="result-item">${found.boxCount} ${def.itemNoun} en ${found.pages} página(s) · ${pageToolDate(found.updatedAt)}</div>
        <div class="btn-row">
          <button class="btn-primary" id="rd-resume" style="width:auto">Continuar donde lo dejé</button>
          <button class="btn-secondary" id="rd-fresh">Empezar de nuevo</button>
        </div>
      </div>`;
      const answer = v => { $(`${P}-prompt`).innerHTML = ''; resolvePrompt = null; resolve(v); };
      $('rd-resume').addEventListener('click', () => answer('resume'));
      $('rd-fresh').addEventListener('click', () => answer('fresh'));
    });
  }

  // ── Apertura de archivos ─────────────────────────────────────────────────────
  function attach(s) {
    session = s;
    currentPage = Math.min(s.currentPage || 0, s.pages.length - 1);
    savedAt = null;
    editor.open(s.boxes);
    $(`${P}-list`).innerHTML = `<div class="file-item">
      <span class="file-name" title="${pageToolEscape(s.source)}">${icon('file', 14)} ${pageToolEscape(basename(s.source))}</span>
      <button class="file-remove" id="rm-${P}" title="Cerrar (el avance queda guardado)">${icon('close', 14)}</button></div>`;
    $(`rm-${P}`).addEventListener('click', () => reset());
    $(`${P}-result`).innerHTML = '';
    goToPage(currentPage);
    refreshPending();
  }

  // Cierra el archivo. Salvo que se indique lo contrario, el avance queda guardado.
  async function reset({ keepSaved = true } = {}) {
    if (session && keepSaved) await flushSave();
    clearTimeout(saveTimer);
    saveTimer = null;
    session = null;
    editor.clear();
    $(`${P}-list`).innerHTML = fileEmptyHtml(kind);
    $(`${P}-result`).innerHTML = '';
    syncUi();
    refreshPending();
  }

  async function openFile(path) {
    if (state.isProcessing) return;
    resolvePrompt?.('cancel');
    if (session) await flushSave();

    const found = await api('FindSession')({ file: path });
    if (found.ok && found.session) {
      const choice = await askResume(found.session);
      if (choice === 'cancel') return;
      if (choice === 'resume') {
        const res = await api('LoadSession')({ id: found.session.id });
        if (res.ok) { await checkDefaultOutputDir(path, `${P}-path`); attach(res.session); return; }
        notify.warning('No se pudo recuperar el avance; se abrirá el archivo desde cero.');
      }
    }

    await checkDefaultOutputDir(path, `${P}-path`);
    const btn = $(`run-${P}`), cancel = $(`cancel-${P}`);
    setProcessing(true);
    btn.disabled = true;
    cancel.style.display = 'inline-block';
    $(`${P}-result`).innerHTML = '';

    const res = await runWithProgress(def.progress, `${P}-progress`, () => api('Open')({ file: path, kind: isPdf ? 'pdf' : 'image', dpi }));

    setProcessing(false);
    cancel.style.display = 'none';

    if (!res.ok) {
      if (res.error === 'Cancelado') notify.warning('Apertura cancelada.');
      else {
        $(`${P}-result`).innerHTML = resultBox('error', 'No se pudo abrir el archivo', [
          pageToolEscape(res.error), ...(isPdf ? ['Si el PDF tiene contraseña, desbloquéalo antes con la herramienta Desbloquear.'] : []),
        ]);
        notify.error('No se pudo abrir el archivo.');
      }
      syncUi();
      return;
    }
    attach(res.session);
  }

  // ── Selección de archivo, arrastre y carpeta de salida ───────────────────────
  const pickFile = async () => { const p = await pickFiles(kind); if (p.length) openFile(p[0]); };
  $(`pick-${P}`).addEventListener('click', pickFile);
  $(`clear-${P}`).addEventListener('click', () => reset());
  $(`${P}-pick`).addEventListener('click', () => pickOutputDir(`${P}-path`).then(syncUi));

  const onDropFiles = paths => {
    if (paths.length > 1) notify.info('Se trabaja con un archivo a la vez: se abrió el primero.');
    openFile(paths[0]);
  };
  bindDragDrop(`zone-${P}`, FILE_KINDS[kind].extensions, onDropFiles);
  bindDragDrop(`${P}-stage`, FILE_KINDS[kind].extensions, onDropFiles);

  // ── Cancelación y exportación ────────────────────────────────────────────────
  $(`cancel-${P}`).addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  $(`run-${P}`).addEventListener('click', async () => {
    const btn = $(`run-${P}`), cancel = $(`cancel-${P}`);
    await flushSave();
    setProcessing(true);
    btn.disabled = true; btn.textContent = 'Exportando...';
    cancel.style.display = 'inline-block';
    $(`${P}-result`).innerHTML = '';

    const res = await runWithProgress(def.progress, `${P}-progress`, () => api('Export')({
      id: session.id, boxes: editor.getAll(), mode, imageFormat, quality, discard, outputDir: state.outputDir,
      ...(def.fillColor ? { color: fillColor } : {}),
    }));
    window.api.playBeep();

    setProcessing(false);
    btn.textContent = def.runLabel;
    cancel.style.display = 'none';

    if (res.ok) {
      lastOutputs = res.outputs;
      const html = resultBox('success', def.doneTitle, [
        ...res.outputs.map(f => `${icon('file', 14)} ${pageToolEscape(basename(f))}`),
        `${res.pages} página(s) · ${formatBytes(res.bytes)} · guardado como imagen`,
        ...(res.discarded ? ['El avance guardado se eliminó.'] : []),
      ], true);
      $(`${P}-result`).innerHTML = html;
      notify.success(`${def.doneTitle} correctamente.`);
      if (res.discarded) {
        session = null;
        await reset({ keepSaved: false });
        $(`${P}-result`).innerHTML = html;
        return;
      }
    } else if (res.error === 'Cancelado') {
      notify.warning('Exportación cancelada.');
    } else {
      $(`${P}-result`).innerHTML = resultBox('error', 'No se pudo exportar', [pageToolEscape(res.error)]);
      notify.error('No se pudo exportar el archivo.');
    }
    syncUi();
  });

  // ── Atajo a la herramienta hermana ───────────────────────────────────────────
  // Lleva el archivo recién exportado si es del tipo que abre el destino; si no, abre el
  // módulo vacío.
  $(`goto-${P}`)?.addEventListener('click', () => shortcut.go(lastOutputs));

  // ── Estado inicial ───────────────────────────────────────────────────────────
  $(`${P}-list`).innerHTML = fileEmptyHtml(kind);
  syncUi();
  refreshPending();
  if (ctx.files?.length) onDropFiles(ctx.files);
}
