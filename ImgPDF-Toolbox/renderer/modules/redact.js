// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/redact.js
// Descripción: Módulo «Testar»: oculta datos de un PDF o de una imagen dibujando cuadros
//              negros sobre un visor. El avance se guarda solo en disco para retomarlo tras
//              un cierre accidental o un corte de luz. Al exportar, cada página se convierte
//              en imagen (PNG o JPG), suelta o dentro de un PDF, de modo que el contenido
//              bajo los cuadros se elimina de verdad y no puede recuperarse.
// ═════════════════════════════════════════════════════════════════════════════

// ── Guardado al cerrar la ventana ────────────────────────────────────────────
// El módulo activo registra aquí su función de guardado; se invoca si la ventana se oculta o
// se cierra con cambios pendientes, y al abrir de nuevo el módulo.

let redactActive = null;
window.addEventListener('beforeunload', () => redactActive?.flush());
document.addEventListener('visibilitychange', () => { if (document.hidden) redactActive?.flush(); });

// ── Utilidades ───────────────────────────────────────────────────────────────

const redactEscape = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const redactDate   = ts => new Date(ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
const redactTime   = ts => new Date(ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ── Módulo ───────────────────────────────────────────────────────────────────

async function renderRedact(ctx = {}) {
  redactActive?.flush();

  // La categoría desde la que se abre decide el tipo de archivo: PDF o imagen
  const kind  = ctx.context === 'image' ? 'imageAny' : 'pdf';
  const isPdf = kind === 'pdf';

  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('redact', { dpi: 150, mode: 'pdf', imageFormat: 'png', quality: 90, discard: true });
  let { dpi, mode, imageFormat, quality, discard } = cfg;

  let session = null;       // Sesión abierta: { id, source, pages, boxes, ... }
  let currentPage = 0;
  let savedAt = null;       // Hora del último guardado del avance
  let saveTimer = null;
  let resolvePrompt = null; // Respuesta pendiente de «continuar o empezar de nuevo»
  let lastOutputs = [];     // Archivos generados en la última exportación (para continuar en el otro Testar)

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module module-redact">
    <div class="module-title">${icon('redact', 22)} Testar</div>
    <p class="module-desc">Oculta datos sensibles dibujando cuadros negros sobre ${isPdf ? 'las páginas del PDF' : 'la imagen'}. Tu avance se guarda solo: si se cierra la aplicación o se va la luz, puedes retomarlo.</p>

    <div data-step="notice">
      <div id="redact-prompt"></div>
      <div id="redact-pending"></div>
    </div>

    ${fileZoneHtml({ zone: 'zone-redact', pick: 'pick-redact', clear: 'clear-redact', badge: 'redact-badge', list: 'redact-list', kind, multiple: false })}
    ${outputDirRow('redact')}

    ${isPdf ? `<div class="option-group">
      <label>Resolución de trabajo</label>
      <div class="option-row" id="redact-dpi"></div>
      <p class="option-hint">Se aplica al abrir el archivo. Más resolución da más nitidez y más peso.</p>
    </div>` : ''}
    <div class="option-group">
      <label>Guardar como</label>
      <div class="option-row" id="redact-mode"></div>
      <p class="option-hint" id="redact-mode-hint"></p>
    </div>
    <div class="option-group">
      <label>Formato de la imagen</label>
      <div class="option-row" id="redact-format"></div>
    </div>
    <div class="option-group" id="redact-quality-group">
      <label>Calidad del JPG</label>
      <div class="option-row" id="redact-quality"></div>
    </div>
    <div class="option-group">
      <label>Avance guardado</label>
      <label class="check-row"><input type="checkbox" id="redact-discard"> Eliminar el avance guardado después de exportar</label>
    </div>

    <div class="option-group wide" data-step="preview" data-step-title="Testado">
      <label>Testado</label>
      <div class="redact-toolbar">
        <div class="redact-tools">
          <button class="btn-toggle" id="rd-prev" type="button" title="Página anterior">${icon('back', 16)}</button>
          <input type="number" class="num-input" id="rd-page" min="1" value="1" title="Ir a la página">
          <span class="redact-pages" id="rd-pages">/ 1</span>
          <button class="btn-toggle" id="rd-next" type="button" title="Página siguiente">${icon('arrow-right', 16)}</button>
        </div>
        <div class="redact-tools">
          <button class="btn-toggle" id="rd-undo" type="button" title="Deshacer (Ctrl+Z)">Deshacer</button>
          <button class="btn-toggle" id="rd-redo" type="button" title="Rehacer (Ctrl+Y)">Rehacer</button>
          <button class="btn-toggle" id="rd-del" type="button" title="Quitar el cuadro seleccionado (Supr)">${iconLabel('trash', 'Quitar cuadro', 14)}</button>
          ${isPdf ? `<button class="btn-toggle" id="rd-all" type="button" title="Repite el cuadro seleccionado en todas las páginas (encabezados, pies, sellos)">En todas las páginas</button>` : ''}
          <button class="btn-toggle" id="rd-clearpage" type="button" title="Quita todos los cuadros de esta página">Limpiar página</button>
        </div>
        <div class="redact-tools">
          <button class="btn-toggle" id="rd-zout" type="button" title="Alejar">−</button>
          <span class="redact-zoom" id="rd-zoom">100%</span>
          <button class="btn-toggle" id="rd-zin" type="button" title="Acercar">+</button>
          <button class="btn-toggle" id="rd-zfit" type="button" title="Ajustar al ancho">Ajustar</button>
        </div>
      </div>
      <div class="redact-stage" id="redact-stage"></div>
      <p class="option-hint" id="redact-info">Abre un archivo y arrastra sobre la página para dibujar un cuadro.</p>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="run-redact" disabled style="width:auto">Exportar testado</button>
      <button class="btn-danger"  id="cancel-redact" style="display:none;width:auto">Cancelar</button>
      <button class="btn-secondary" id="goto-redact" style="width:auto">${iconLabel('arrow-right', isPdf ? 'Ir a Testar imagen' : 'Ir a Testar PDF')}</button>
    </div>
    <div class="progress-panel" id="redact-progress"></div>
    <div id="redact-result"></div>
  </div>`;
  organizeModule(ws);

  const $ = id => document.getElementById(id);
  const save = patch => saveModuleConfig('redact', patch);

  // ── Editor ───────────────────────────────────────────────────────────────────
  const editor = createRedactEditor($('redact-stage'), {
    onChange: () => scheduleSave(),
    onState:  () => syncUi(),
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

    $('clear-redact').style.display = session ? 'inline-block' : 'none';
    $('redact-badge').textContent   = fileCountText(session ? 1 : 0, kind);
    $('run-redact').disabled = !(session && editor.countAll() > 0 && state.outputDir && !busy);

    $('redact-info').textContent = open
      ? `${total > 1 ? `Página ${currentPage + 1} de ${total} · ` : ''}${editor.countPage()} cuadro(s) en esta página · ${editor.countAll()} en total` +
        (savedAt ? ` · Avance guardado a las ${redactTime(savedAt)}` : '')
      : 'Abre un archivo y arrastra sobre la página para dibujar un cuadro.';
  }

  // ── Autoguardado del avance ──────────────────────────────────────────────────
  async function flushSave() {
    clearTimeout(saveTimer);
    saveTimer = null;
    if (!session) return;
    const res = await window.api.redactSave({ id: session.id, boxes: editor.getAll(), currentPage });
    if (res.ok) { savedAt = res.updatedAt; if ($('redact-info')) syncUi(); }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave, 500);
  }

  redactActive = { flush: () => { if (saveTimer) flushSave(); } };

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
    if (n) notify.success(`Cuadro copiado a ${n} página(s) más.`);
  });
  $('rd-zin').addEventListener('click',  () => editor.zoomBy(1));
  $('rd-zout').addEventListener('click', () => editor.zoomBy(-1));
  $('rd-zfit').addEventListener('click', () => editor.zoomBy(0));

  // ── Opciones de salida ───────────────────────────────────────────────────────
  const updateOptions = () => {
    $('redact-quality-group').style.display = imageFormat === 'jpg' ? '' : 'none';
    $('redact-mode-hint').textContent = mode === 'pdf'
      ? 'Cada página se guarda como imagen dentro de un PDF: bajo los cuadros no queda texto ni imagen que recuperar.'
      : 'Cada página se guarda como una imagen independiente.';
  };

  if (isPdf) {
    optButtons($('redact-dpi'), [100, 150, 200, 300].map(v => ({ label: `${v} DPI`, value: v })),
      dpi, v => { dpi = v; }, v => save({ dpi: v }));
  }

  optButtons($('redact-mode'), [
    { label: 'PDF',              value: 'pdf'    },
    { label: 'Imágenes sueltas', value: 'images' },
  ], mode, v => { mode = v; updateOptions(); }, v => save({ mode: v }));

  optButtons($('redact-format'), [
    { label: 'PNG (sin pérdida)',  value: 'png' },
    { label: 'JPG (más ligero)',   value: 'jpg' },
  ], imageFormat, v => { imageFormat = v; updateOptions(); }, v => save({ imageFormat: v }));

  optButtons($('redact-quality'), [
    { label: 'Alta',        value: 95 },
    { label: 'Equilibrada', value: 85 },
    { label: 'Reducida',    value: 70 },
  ], quality, v => { quality = v; }, v => save({ quality: v }));

  $('redact-discard').checked = discard;
  $('redact-discard').addEventListener('change', e => { discard = e.target.checked; save({ discard }); });
  updateOptions();

  // ── Trabajo sin terminar ─────────────────────────────────────────────────────
  // Lista las sesiones guardadas del mismo tipo que no están abiertas, para retomarlas aunque
  // no se recuerde qué archivo era.
  async function refreshPending() {
    const box = $('redact-pending');
    if (!box) return;
    const res = await window.api.redactListSessions();
    const mine = (res.sessions || []).filter(s => (s.kind === 'pdf') === isPdf && s.id !== session?.id);

    box.innerHTML = mine.length ? `<div class="result-box info">
      <div class="result-title">${icon('info', 16)} Trabajo sin terminar</div>
      ${mine.map(s => `<div class="result-item redact-pending-item">
        <span title="${redactEscape(s.source)}">${icon('file', 14)} ${redactEscape(basename(s.source))} — ${s.pages} pág., ${s.boxCount} cuadro(s), ${redactDate(s.updatedAt)}</span>
        <span class="redact-pending-actions">
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
      window.api.redactDiscard({ id: btn.dataset.discard }).then(refreshPending);
      return;
    }
    btn.dataset.armed = '1';
    btn.textContent = '¿Seguro? Confirmar';
    setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Descartar'; } }, 4000);
  }

  async function resume(id) {
    if (state.isProcessing) return;
    const res = await window.api.redactLoadSession({ id });
    if (!res.ok) { notify.error(res.error); refreshPending(); return; }
    await checkDefaultOutputDir(res.session.source, 'redact-path');
    attach(res.session);
    notify.info('Avance recuperado.');
  }

  // Pregunta qué hacer cuando el archivo elegido ya tiene avance guardado
  function askResume(found) {
    return new Promise(resolve => {
      resolvePrompt = resolve;
      $('redact-prompt').innerHTML = `<div class="result-box warning">
        <div class="result-title">${icon('alert', 16)} Este archivo ya tiene avance guardado</div>
        <div class="result-item">${found.boxCount} cuadro(s) en ${found.pages} página(s) · ${redactDate(found.updatedAt)}</div>
        <div class="btn-row">
          <button class="btn-primary" id="rd-resume" style="width:auto">Continuar donde lo dejé</button>
          <button class="btn-secondary" id="rd-fresh">Empezar de nuevo</button>
        </div>
      </div>`;
      const answer = v => { $('redact-prompt').innerHTML = ''; resolvePrompt = null; resolve(v); };
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
    $('redact-list').innerHTML = `<div class="file-item">
      <span class="file-name" title="${redactEscape(s.source)}">${icon('file', 14)} ${redactEscape(basename(s.source))}</span>
      <button class="file-remove" id="rm-redact" title="Cerrar (el avance queda guardado)">${icon('close', 14)}</button></div>`;
    $('rm-redact').addEventListener('click', () => reset());
    $('redact-result').innerHTML = '';
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
    $('redact-list').innerHTML = fileEmptyHtml(kind);
    $('redact-result').innerHTML = '';
    syncUi();
    refreshPending();
  }

  async function openFile(path) {
    if (state.isProcessing) return;
    resolvePrompt?.('cancel');
    if (session) await flushSave();

    let choice = 'fresh';
    const found = await window.api.redactFindSession({ file: path });
    if (found.ok && found.session) {
      choice = await askResume(found.session);
      if (choice === 'cancel') return;
      if (choice === 'resume') {
        const res = await window.api.redactLoadSession({ id: found.session.id });
        if (res.ok) { await checkDefaultOutputDir(path, 'redact-path'); attach(res.session); return; }
        notify.warning('No se pudo recuperar el avance; se abrirá el archivo desde cero.');
      }
    }

    await checkDefaultOutputDir(path, 'redact-path');
    const btn = $('run-redact'), cancel = $('cancel-redact');
    setProcessing(true);
    btn.disabled = true;
    cancel.style.display = 'inline-block';
    $('redact-result').innerHTML = '';

    const res = await runWithProgress('redact', 'redact-progress', () => window.api.redactOpen({ file: path, kind: isPdf ? 'pdf' : 'image', dpi }));

    setProcessing(false);
    cancel.style.display = 'none';

    if (!res.ok) {
      if (res.error === 'Cancelado') notify.warning('Apertura cancelada.');
      else {
        $('redact-result').innerHTML = resultBox('error', 'No se pudo abrir el archivo', [
          redactEscape(res.error), ...(isPdf ? ['Si el PDF tiene contraseña, desbloquéalo antes con la herramienta Desbloquear.'] : []),
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
  $('pick-redact').addEventListener('click', pickFile);
  $('clear-redact').addEventListener('click', () => reset());
  $('redact-pick').addEventListener('click', () => pickOutputDir('redact-path').then(syncUi));

  const onDropFiles = paths => {
    if (paths.length > 1) notify.info('Se testa un archivo a la vez: se abrió el primero.');
    openFile(paths[0]);
  };
  bindDragDrop('zone-redact', FILE_KINDS[kind].extensions, onDropFiles);
  bindDragDrop('redact-stage', FILE_KINDS[kind].extensions, onDropFiles);

  // ── Cancelación y exportación ────────────────────────────────────────────────
  $('cancel-redact').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  $('run-redact').addEventListener('click', async () => {
    const btn = $('run-redact'), cancel = $('cancel-redact');
    await flushSave();
    setProcessing(true);
    btn.disabled = true; btn.textContent = 'Exportando...';
    cancel.style.display = 'inline-block';
    $('redact-result').innerHTML = '';

    const res = await runWithProgress('redact', 'redact-progress', () => window.api.redactExport({
      id: session.id, boxes: editor.getAll(), mode, imageFormat, quality, discard, outputDir: state.outputDir,
    }));
    window.api.playBeep();

    setProcessing(false);
    btn.textContent = 'Exportar testado';
    cancel.style.display = 'none';

    if (res.ok) {
      lastOutputs = res.outputs;
      $('redact-result').innerHTML = resultBox('success', 'Archivo testado', [
        ...res.outputs.map(f => `${icon('file', 14)} ${redactEscape(basename(f))}`),
        `${res.pages} página(s) · ${formatBytes(res.bytes)} · guardado como imagen`,
        ...(res.discarded ? ['El avance guardado se eliminó.'] : []),
      ], true);
      notify.success('Archivo testado correctamente.');
      if (res.discarded) {
        const html = $('redact-result').innerHTML;
        session = null;
        await reset({ keepSaved: false });
        $('redact-result').innerHTML = html;
        return;
      }
    } else if (res.error === 'Cancelado') {
      notify.warning('Exportación cancelada.');
    } else {
      $('redact-result').innerHTML = resultBox('error', 'No se pudo exportar', [redactEscape(res.error)]);
      notify.error('No se pudo exportar el archivo.');
    }
    syncUi();
  });

  // ── Atajo al Testar del otro tipo de archivo ─────────────────────────────────
  // Lleva el archivo recién exportado si es del tipo que abre el destino (p. ej. el PDF
  // testado, para revisarlo o testarlo más); si no, abre el módulo vacío.
  $('goto-redact').addEventListener('click', () => {
    const target = isPdf ? 'imageAny' : 'pdf';
    const files = lastOutputs.filter(f => FILE_KINDS[target].extensions.includes(f.split('.').pop().toLowerCase()));
    goToModule(isPdf ? 'image-tools' : 'pdf-tools', 'redact', { files });
  });

  // ── Estado inicial ───────────────────────────────────────────────────────────
  $('redact-list').innerHTML = fileEmptyHtml(kind);
  syncUi();
  refreshPending();
  if (ctx.files?.length) onDropFiles(ctx.files);
}
