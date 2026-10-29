// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/batch.js
// Descripción: Base común de las herramientas de imagen por lotes (Convertir, Redimensionar,
//              Comprimir, Quitar fondo): bloques HTML estándar y enlace de eventos para la
//              lista de archivos, selección, arrastre, carpeta de salida, ejecución con
//              progreso real, cancelación y resultados con pesos antes/después.
// ═════════════════════════════════════════════════════════════════════════════

// ── Bloques HTML estándar ────────────────────────────────────────────────────
// Convención de ids para un prefijo p: zone-p, pick-p, clear-p, p-badge, p-list (archivos);
// p-pick y p-path (carpeta de salida); run-p, cancel-p, p-progress y p-result (acciones).

function batchFilesHtml(p, kind = 'imageAny') {
  return fileZoneHtml({ zone: `zone-${p}`, pick: `pick-${p}`, clear: `clear-${p}`, badge: `${p}-badge`, list: `${p}-list`, kind, multiple: true });
}

function batchActionsHtml(p, runLabel) {
  return `${outputDirRow(p)}
    <div class="btn-row">
      <button class="btn-primary" id="run-${p}" disabled style="width:auto">${runLabel}</button>
      <button class="btn-danger"  id="cancel-${p}" style="display:none;width:auto">Cancelar</button>
    </div>
    <div class="progress-panel" id="${p}-progress"></div>
    <div id="${p}-result"></div>`;
}

// ── Resultados ───────────────────────────────────────────────────────────────

// Línea de un resultado correcto: nombre, dimensiones (si se conocen) y peso antes → después.
function batchResultLine(r) {
  const dims  = r.width && r.height ? ` · ${r.width}×${r.height} px` : '';
  const delta = r.sizeBefore > 0 ? Math.round((1 - r.sizeAfter / r.sizeBefore) * 100) : 0;
  const change = r.sizeBefore
    ? ` (${formatBytes(r.sizeBefore)} → ${formatBytes(r.sizeAfter)}${delta > 0 ? ` — reducido ${delta}%` : delta < 0 ? ` — aumenta ${-delta}%` : ''})`
    : ` (${formatBytes(r.sizeAfter)})`;
  return `${icon('file', 14)} ${basename(r.out)}${dims}${change}`;
}

// HTML de los resultados de un lote: correctos, omitidos (ya optimizados) y errores.
function batchResultsHtml(results, doneVerb) {
  const done    = results.filter(r => r.ok && !r.skipped);
  const skipped = results.filter(r => r.ok && r.skipped);
  const errors  = results.filter(r => !r.ok);
  return (done.length    ? resultBox('success', `${done.length} imagen(es) ${doneVerb}`, done.map(batchResultLine), true) : '') +
         (skipped.length ? resultBox('info', `${skipped.length} imagen(es) sin cambios`,
                             skipped.map(r => `${icon('check', 14)} ${basename(r.file)} — ya estaba optimizada, no se generó archivo`)) : '') +
         (errors.length  ? resultBox('error', `${errors.length} error(es)`, errors.map(r => `${basename(r.file)}: ${r.error}`)) : '');
}

// ── Enlace de eventos ────────────────────────────────────────────────────────

// Enlaza una herramienta por lotes con prefijo p. Opciones:
//   moduleId   id del módulo en los eventos de progreso
//   kind       tipo de archivo de entrada (clave de FILE_KINDS)
//   runLabel   texto del botón de ejecución
//   busyLabel  texto del botón mientras se procesa
//   doneVerb   participio para el resultado («convertidas», «redimensionadas»…)
//   run        (files, outputDir) → Promise<resultados> con la llamada a window.api
//   canRun     () → bool, validación adicional de la configuración
//   onChange   (files) → void, se llama al cambiar la lista (p. ej. para información)
// Devuelve { getFiles, sync }: sync() reevalúa el estado del botón tras cambiar la configuración.
function setupBatchTool(p, { moduleId, kind = 'imageAny', runLabel, busyLabel = 'Procesando...', doneVerb, run, canRun = () => true, onChange = () => {} }) {
  const $ = id => document.getElementById(id);
  const listId = `${p}-list`;
  let files = [];

  // ── Estado de los controles ────────────────────────────────────────────────
  function sync() {
    $(`run-${p}`).disabled     = !(files.length && state.outputDir && canRun() && !state.isProcessing);
    $(`clear-${p}`).style.display = files.length ? 'inline-block' : 'none';
    $(`${p}-badge`).textContent   = fileCountText(files.length, kind);
  }

  // ── Lista de archivos ──────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList(listId, files, onRemove);
    onChange(files);
    sync();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], `${p}-path`);
    const dups = picked.filter(f => files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderFileList(listId, files, onRemove);
    onChange(files);
    sync();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  // ── Selección de archivos, arrastre y carpeta de salida ────────────────────
  $(`pick-${p}`).addEventListener('click', async () => addFiles(await pickFiles(kind)));

  $(`clear-${p}`).addEventListener('click', () => {
    files = [];
    renderFileList(listId, files, onRemove);
    $(`${p}-result`).innerHTML = '';
    onChange(files);
    sync();
  });

  $(`${p}-pick`).addEventListener('click', () => pickOutputDir(`${p}-path`).then(sync));
  bindDragDrop(`zone-${p}`, FILE_KINDS[kind].extensions, addFiles);

  // ── Cancelación y ejecución ────────────────────────────────────────────────
  $(`cancel-${p}`).addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando operación...');
  });

  $(`run-${p}`).addEventListener('click', async () => {
    const btn = $(`run-${p}`), cancel = $(`cancel-${p}`);
    setProcessing(true);
    btn.disabled = true; btn.textContent = busyLabel;
    cancel.style.display = 'inline-block';
    $(`${p}-result`).innerHTML = '';

    const res = await runWithProgress(moduleId, `${p}-progress`, () => run(files, state.outputDir));
    window.api.playBeep();

    $(`${p}-result`).innerHTML = batchResultsHtml(res, doneVerb);
    const ok = res.filter(r => r.ok && !r.skipped).length, err = res.filter(r => !r.ok).length;
    if (ok)  notify.success(`${ok} imagen(es) ${doneVerb}.`);
    if (err) notify.error(`${err} archivo(s) fallaron.`);

    setProcessing(false);
    btn.textContent = runLabel;
    cancel.style.display = 'none';
    sync();
  });

  return { getFiles: () => files, sync };
}
