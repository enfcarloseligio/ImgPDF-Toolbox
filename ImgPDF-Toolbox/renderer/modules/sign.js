// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/sign.js
// Descripción: Módulo «Firmar»: dibuja una firma a mano, guárdala en tu biblioteca y colócala
//              con un clic sobre las páginas de un PDF, ajustando su posición y tamaño en un
//              visor. El avance se guarda solo para retomarlo tras un cierre accidental. Al
//              exportar, la firma queda incrustada en la página (PDF o imágenes). La
//              mecánica del visor, el autoguardado y la exportación viven en
//              core/page-tool.js; el panel de dibujo en core/signature-pad.js.
// ═════════════════════════════════════════════════════════════════════════════

// ── Panel de firma ───────────────────────────────────────────────────────────

const SIGN_PEN_COLORS = [
  { label: 'Negro',      value: '#111827', swatch: true },
  { label: 'Azul tinta', value: '#1D3FA6', swatch: true },
  { label: 'Azul marino', value: '#0B1F5C', swatch: true },
];
const SIGN_PEN_WIDTHS = [
  { label: 'Fino',   value: 2 },
  { label: 'Medio',  value: 3.5 },
  { label: 'Grueso', value: 5.5 },
];

const SIGN_PANEL_HTML = `<div class="sig-panel">
  <div class="sig-draw">
    <div class="sigpad" id="sg-pad"></div>
    <div class="sig-controls">
      <div class="option-row" id="sg-color"></div>
      <div class="option-row" id="sg-width"></div>
      <div class="option-row">
        <button class="btn-toggle" id="sg-undo" type="button" disabled>Deshacer trazo</button>
        <button class="btn-toggle" id="sg-clear" type="button" disabled>Borrar</button>
        <button class="btn-secondary btn-sm" id="sg-save" type="button" disabled>Guardar y usar</button>
      </div>
    </div>
  </div>
  <div class="sig-library">
    <span class="sig-library-title">Mis firmas</span>
    <div class="sig-lib" id="sg-lib"></div>
    <p class="option-hint" id="sg-hint"></p>
  </div>
</div>`;

// Construye el panel de dibujo y la biblioteca de firmas. Devuelve las opciones del editor que
// le permiten saber qué firma colocar y qué imagen mostrar.
function setupSignPanel(ctrl) {
  const $ = ctrl.$;
  let penColor = SIGN_PEN_COLORS[1].value, penWidth = SIGN_PEN_WIDTHS[1].value;
  let library = [];     // [{ id, path, width, height }]
  let active = null;    // Id de la firma que se coloca con cada clic

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  const pad = createSignaturePad($('sg-pad'), { color: penColor, width: penWidth, onChange: syncPad });

  function syncPad() {
    const empty = pad.isEmpty();
    $('sg-undo').disabled = $('sg-clear').disabled = $('sg-save').disabled = empty;
  }

  optButtons($('sg-color'), SIGN_PEN_COLORS, penColor, v => { penColor = v; pad.setColor(v); });
  optButtons($('sg-width'), SIGN_PEN_WIDTHS, penWidth, v => { penWidth = v; pad.setWidth(v); });
  $('sg-undo').addEventListener('click', () => pad.undo());
  $('sg-clear').addEventListener('click', () => pad.clear());

  $('sg-save').addEventListener('click', async () => {
    const png = pad.toPng();
    if (!png) return;
    const res = await window.api.signerSignaturesSave({ dataUrl: png.dataUrl });
    if (!res.ok) { notify.error(res.error); return; }
    library.unshift(res.signature);
    active = res.signature.id;
    pad.clear();
    renderLibrary();
    notify.success('Firma guardada. Haz clic sobre la página para colocarla.');
  });

  // ── Biblioteca ─────────────────────────────────────────────────────────────
  function renderLibrary() {
    $('sg-lib').innerHTML = library.length
      ? library.map(s => `<div class="sig-thumb${s.id === active ? ' is-active' : ''}">
          <button class="sig-pick" type="button" data-sig="${s.id}" title="Usar esta firma"><img src="${toFileUrl(s.path)}" alt="Firma"></button>
          <button class="sig-del" type="button" data-del="${s.id}" title="Eliminar firma">${icon('close', 12)}</button>
        </div>`).join('')
      : '<span class="file-empty">Aún no tienes firmas guardadas</span>';

    $('sg-hint').textContent = library.length
      ? (active ? 'Haz clic sobre la página para colocar la firma seleccionada; arrástrala para moverla y usa las esquinas para cambiar su tamaño.' : 'Elige una firma para empezar a colocarla.')
      : 'Dibuja tu firma arriba y pulsa «Guardar y usar».';

    $('sg-lib').querySelectorAll('[data-sig]').forEach(btn => btn.addEventListener('click', () => { active = btn.dataset.sig; renderLibrary(); }));
    $('sg-lib').querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => removeSignature(btn.dataset.del)));
  }

  // Eliminar una firma de la biblioteca también la retira de las páginas donde ya se colocó
  async function removeSignature(id) {
    await window.api.signerSignaturesDelete({ id });
    library = library.filter(s => s.id !== id);
    if (active === id) active = null;
    ctrl.editor?.removeSignature(id);
    renderLibrary();
  }

  window.api.signerSignaturesList().then(res => {
    library = res.signatures || [];
    renderLibrary();
    ctrl.editor?.refresh();   // Las firmas de una sesión recuperada necesitan la biblioteca para mostrarse
  });
  renderLibrary();

  // ── Opciones del editor ────────────────────────────────────────────────────
  return {
    getStamp: () => {
      const s = library.find(x => x.id === active);
      return s ? { sig: s.id, aspect: s.width / s.height } : null;
    },
    resolveSrc: sig => {
      const s = library.find(x => x.id === sig);
      return s ? toFileUrl(s.path) : '';
    },
    onNeedStamp: () => notify.info(library.length ? 'Elige una de tus firmas para colocarla.' : 'Dibuja tu firma y pulsa «Guardar y usar».'),
  };
}

// ── Módulo ───────────────────────────────────────────────────────────────────

async function renderSign(ctx = {}) {
  return renderPageTool(ctx, {
    // ── Identidad ──────────────────────────────────────────────────────────────
    id: 'sign', api: 'signer', progress: 'signer', pdfOnly: true,
    title: 'Firmar', titleIcon: 'sign', previewTitle: 'Firma',

    // ── Textos ─────────────────────────────────────────────────────────────────
    description: () => 'Dibuja tu firma, guárdala y colócala con un clic sobre las páginas del PDF. Tu avance se guarda solo: si se cierra la aplicación o se va la luz, puedes retomarlo.',
    itemNoun: 'firma(s)',
    runLabel: 'Exportar firmado', doneTitle: 'Archivo firmado',
    pdfHint: 'Cada página se guarda como imagen dentro de un PDF, con la firma incrustada en la página.',
    infoIdle: 'Abre un PDF, elige una firma y haz clic sobre la página para colocarla.',
    removeLabel: 'Quitar firma', removeTitle: 'Quita la firma seleccionada',

    // ── Editor: firmas que se colocan con un clic y conservan su proporción ────
    editorMode: 'stamp', editorEmptyText: 'Selecciona un PDF para empezar a firmar',
    previewTopHtml: SIGN_PANEL_HTML,
    setup: setupSignPanel,
  });
}
