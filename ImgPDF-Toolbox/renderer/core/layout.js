// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/layout.js
// Descripción: Estructura estándar de los módulos de herramienta. Reordena el contenido de
//              cada módulo en pasos numerados con el mismo orden en toda la aplicación:
//              1 Archivos → 2 Carpeta de salida → 3 Configuración → 4 Vista previa, seguido
//              del resultado y de una barra de acciones fija con el progreso.
// ═════════════════════════════════════════════════════════════════════════════

// ── Pasos y reglas de clasificación ──────────────────────────────────────────

// Orden de aparición de los pasos y su título. 'card' agrupa bloques que ya son una
// tarjeta (.step) por sí mismos, como el asistente de Separar PDF.
const LAYOUT_STEPS = [
  { key: 'files',   title: 'Archivos' },
  { key: 'card' },
  { key: 'output',  title: 'Carpeta de salida' },
  { key: 'config',  title: 'Configuración' },
  { key: 'preview', title: 'Vista previa' },
];

// Determina a qué paso pertenece un bloque de la plantilla. Un atributo data-step explícito
// tiene prioridad (se usa para marcar las vistas previas); el resto se deduce del contenido.
function classifyBlock(el) {
  if (el.dataset.step)                                  return el.dataset.step;
  if (el.matches('.module-title, .module-desc'))        return 'head';
  if (el.matches('.step'))                              return 'card';
  if (el.matches('.progress-panel'))                    return 'actions';
  if (el.matches('[id$="-result"]'))                    return 'result';
  if (el.matches('.btn-row') && el.querySelector('.btn-primary')) return 'actions';
  if (el.matches('.output-row'))                        return 'output';
  if (el.matches('.file-zone') || el.querySelector(':scope > .file-zone')) return 'files';
  if (el.matches('.result-box'))                        return 'notice';
  return 'config';
}

// ── Construcción de la estructura ────────────────────────────────────────────

function buildStep(number, key, title, items) {
  const step = document.createElement('section');
  step.className = `step step-${key}`;
  step.innerHTML = `
    <header class="step-head">
      <span class="step-num">${number}</span>
      <h4 class="step-title">${title}</h4>
    </header>`;

  const body = document.createElement('div');
  body.className = `step-body step-body-${key}${key === 'files' && items.length > 1 ? ' upload-grid' : ''}`;
  items.forEach(item => body.appendChild(item));
  step.appendChild(body);
  return step;
}

// Reorganiza el .module recién renderizado dentro de ws. Debe llamarse justo después de
// asignar ws.innerHTML y antes de enlazar eventos (los nodos se mueven, no se recrean).
function organizeModule(ws) {
  const module = ws.querySelector('.module');
  if (!module) return;

  const groups = { head: [], notice: [], files: [], card: [], config: [], preview: [], output: [], actions: [], result: [] };
  Array.from(module.children).forEach(el => (groups[classifyBlock(el)] || groups.config).push(el));

  const parts = [];

  if (groups.head.length) {
    const head = document.createElement('header');
    head.className = 'module-head';
    groups.head.forEach(el => head.appendChild(el));
    parts.push(head);
  }

  parts.push(...groups.notice);

  // Configuración y vista previa se agrupan en un contenedor: en pantallas anchas la
  // vista previa queda fija a un lado mientras se ajustan las opciones; en estrechas
  // se apilan en el orden de los pasos.
  let number = 0;
  let split = null;
  LAYOUT_STEPS.forEach(({ key, title }) => {
    const items = groups[key];
    if (!items.length) return;
    if (key === 'card') { parts.push(...items); return; }

    const step = buildStep(++number, key, title, items);
    if ((key === 'config' || key === 'preview') && groups.config.length && groups.preview.length) {
      if (!split) {
        split = document.createElement('div');
        split.className = 'step-split';
        const wrap = document.createElement('div');
        wrap.className = 'step-split-wrap';
        wrap.appendChild(split);
        parts.push(wrap);
      }
      split.appendChild(step);
    } else {
      parts.push(step);
    }
  });

  parts.push(...groups.result);

  if (groups.actions.length) {
    const bar = document.createElement('div');
    bar.className = 'action-bar';
    // El panel de progreso va encima de los botones
    const isProgress = el => el.matches('.progress-panel');
    [...groups.actions.filter(isProgress), ...groups.actions.filter(el => !isProgress(el))]
      .forEach(el => bar.appendChild(el));
    parts.push(bar);
  }

  module.replaceChildren(...parts);
}
