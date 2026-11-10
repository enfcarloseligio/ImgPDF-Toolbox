// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/sign.js
// Descripción: Módulo «Firmar»: dibuja una firma a mano o carga un PNG con transparencia,
//              guárdala con un nombre en una bóveda protegida con contraseña y colócala con
//              un clic sobre las páginas de un PDF, ajustando su posición y tamaño en un
//              visor. Las firmas no se muestran en miniatura: se elige por nombre y solo se
//              ven al colocarlas en el documento. El avance se guarda solo para retomarlo tras
//              un cierre accidental. La mecánica del visor, el autoguardado y la exportación
//              viven en core/page-tool.js; el panel de dibujo en core/signature-pad.js; el
//              cifrado en src/signature-vault.js.
// ═════════════════════════════════════════════════════════════════════════════

// ── Constantes ───────────────────────────────────────────────────────────────

const SIGN_PEN_COLORS = [
  { label: 'Negro',       value: '#111827', swatch: true },
  { label: 'Azul tinta',  value: '#1D3FA6', swatch: true },
  { label: 'Azul marino', value: '#0B1F5C', swatch: true },
];
const SIGN_PEN_WIDTHS = [
  { label: 'Fino',   value: 2 },
  { label: 'Medio',  value: 3.5 },
  { label: 'Grueso', value: 5.5 },
];
const SIGN_STATUS_POLL = 15000;   // Cada cuánto se comprueba si la bóveda se bloqueó por inactividad (ms)

// ── Panel de firma ───────────────────────────────────────────────────────────

const SIGN_PANEL_HTML = `<div class="sig-panel">
  <div class="sig-draw">
    <div class="sigpad" id="sg-pad"></div>
    <div class="sig-controls">
      <div class="option-row" id="sg-color"></div>
      <div class="option-row" id="sg-width"></div>
      <div class="option-row">
        <button class="btn-toggle" id="sg-undo" type="button" disabled>Deshacer trazo</button>
        <button class="btn-toggle" id="sg-clear" type="button" disabled>Borrar</button>
      </div>
      <div class="sig-save">
        <input type="text" class="num-input sig-name" id="sg-name" placeholder="Nombre de la firma" maxlength="40" autocomplete="off">
        <button class="btn-secondary btn-sm" id="sg-save" type="button" disabled>Guardar y usar</button>
        <button class="btn-secondary btn-sm" id="sg-import" type="button" title="Carga un PNG con fondo transparente">${iconLabel('folder-open', 'Cargar PNG', 14)}</button>
      </div>
    </div>
  </div>
  <div class="sig-library">
    <span class="sig-library-title">Mis firmas</span>
    <div id="sg-vault"></div>
  </div>
</div>`;

// Construye el panel de dibujo y la bóveda de firmas. Devuelve las opciones del editor que le
// permiten saber qué firma colocar y qué imagen mostrar.
function setupSignPanel(ctrl) {
  const $ = ctrl.$;
  let penColor = SIGN_PEN_COLORS[1].value, penWidth = SIGN_PEN_WIDTHS[1].value;

  // ── Estado de la bóveda ────────────────────────────────────────────────────
  let vault = { exists: false, unlocked: false, attemptsLeft: 5, maxFailures: 5, windowMinutes: 10, idleMinutes: 10, minPassword: 8 };
  let library = [];     // [{ id, name, width, height }]: solo con la bóveda desbloqueada
  let images = {};      // id → data URL; solo en memoria y solo mientras esté desbloqueada
  let active = null;    // Id de la firma que se coloca con cada clic
  let creating = false; // Se está mostrando el formulario para crear la contraseña
  let pending = null;   // Acción que continúa cuando la bóveda queda desbloqueada

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

  // ── Sincronización con el proceso principal ────────────────────────────────
  async function refreshStatus() {
    const res = await window.api.signerVaultStatus();
    if (res.ok) vault = res.status;
  }

  // Trae la lista de firmas y sus imágenes (en memoria) tras desbloquear
  async function loadLibrary() {
    const list = await window.api.signerSignaturesList();
    if (!list.ok) { clearLibrary(); return; }
    library = list.signatures;
    const imgs = await window.api.signerSignaturesImages();
    images = imgs.ok ? imgs.images : {};
    if (active && !library.some(s => s.id === active)) active = null;
  }

  function clearLibrary() {
    library = []; images = {}; active = null;
  }

  // Tras bloquear (a mano, por inactividad o por borrado), se olvidan las imágenes y las
  // firmas ya colocadas pasan a mostrarse como bloqueadas
  function applyLocked() {
    clearLibrary();
    renderVault();
    ctrl.editor?.refresh();
  }

  // Ejecuta action cuando la bóveda esté desbloqueada; si no, pide la contraseña (o la crea)
  async function whenUnlocked(action) {
    await refreshStatus();
    if (vault.unlocked) { action(); return; }
    pending = action;
    creating = !vault.exists;
    renderVault();
    $(creating ? 'sg-pw1' : 'sg-pw')?.focus();
    notify.info(creating ? 'Crea una contraseña para proteger tus firmas.' : 'Desbloquea tus firmas con tu contraseña.');
  }

  // Resultado de una operación de la bóveda: muestra el error y, si se bloqueó, lo refleja
  async function check(res) {
    if (res.ok) return true;
    if (res.locked) { await refreshStatus(); applyLocked(); }
    notify.error(res.error);
    return false;
  }

  async function afterUnlock() {
    creating = false;
    await refreshStatus();
    await loadLibrary();
    renderVault();
    ctrl.editor?.refresh();
    const next = pending; pending = null;
    if (next) next();
  }

  // ── Guardar y cargar firmas ────────────────────────────────────────────────
  const currentName = () => $('sg-name').value.trim();

  function nameOrWarn() {
    const name = currentName();
    if (!name) { notify.warning('Escribe un nombre para la firma.'); $('sg-name').focus(); return null; }
    return name;
  }

  // Una firma recién guardada queda seleccionada para colocarla
  async function onSaved(res) {
    if (!(await check(res))) return;
    await loadLibrary();
    active = res.signature.id;
    $('sg-name').value = '';
    renderVault();
    ctrl.editor?.refresh();
    notify.success(`Firma «${res.signature.name}» guardada. Haz clic sobre la página para colocarla.`);
  }

  $('sg-save').addEventListener('click', () => {
    const name = nameOrWarn();
    if (!name) return;
    whenUnlocked(async () => {
      const png = pad.toPng();
      if (!png) return;
      const res = await window.api.signerSignaturesSave({ dataUrl: png.dataUrl, name });
      if (res.ok) pad.clear();
      onSaved(res);
    });
  });

  $('sg-import').addEventListener('click', async () => {
    const name = nameOrWarn();
    if (!name) return;
    const picked = await pickFiles('image', ['png']);
    if (!picked.length) return;
    whenUnlocked(async () => onSaved(await window.api.signerSignaturesImport({ file: picked[0], name })));
  });

  // ── Bóveda en pantalla ─────────────────────────────────────────────────────
  // Se muestra solo lo que corresponde al estado: crear contraseña, desbloquear o la lista de
  // nombres. Las firmas nunca aparecen en miniatura.
  function renderVault() {
    const box = $('sg-vault');
    if (!box) return;

    if (creating) {
      box.innerHTML = `<div class="sig-vault-form">
        <p class="sig-vault-text"><strong>Protege tus firmas con una contraseña.</strong> Se guardan cifradas y no se muestran: solo verás su nombre. Si fallas la contraseña ${vault.maxFailures} veces en ${vault.windowMinutes} minutos, se eliminan todas las firmas guardadas.</p>
        <input type="password" class="num-input" id="sg-pw1" placeholder="Contraseña (mínimo ${vault.minPassword} caracteres)" autocomplete="new-password">
        <input type="password" class="num-input" id="sg-pw2" placeholder="Repite la contraseña" autocomplete="new-password">
        <div class="option-row">
          <button class="btn-primary btn-sm" id="sg-create" type="button">Crear y guardar</button>
          <button class="btn-secondary btn-sm" id="sg-create-cancel" type="button">Cancelar</button>
        </div>
        <p class="option-hint">La contraseña no se puede recuperar: si la olvidas, tendrás que eliminar tus firmas y cargarlas de nuevo.</p>
      </div>`;
      $('sg-create').addEventListener('click', onCreate);
      $('sg-pw2').addEventListener('keydown', e => { if (e.key === 'Enter') onCreate(); });
      $('sg-create-cancel').addEventListener('click', () => { creating = false; pending = null; renderVault(); });
      return;
    }

    if (!vault.exists) {
      box.innerHTML = '<p class="option-hint">Aún no tienes firmas guardadas. Al guardar la primera se te pedirá una contraseña para protegerlas.</p>';
      return;
    }

    if (!vault.unlocked) {
      box.innerHTML = `<div class="sig-vault-form">
        <p class="sig-vault-text">Tus firmas están protegidas. Escribe tu contraseña para usarlas.</p>
        <div class="sig-save">
          <input type="password" class="num-input" id="sg-pw" placeholder="Contraseña" autocomplete="current-password">
          <button class="btn-primary btn-sm" id="sg-unlock" type="button">Desbloquear</button>
        </div>
        <p class="option-hint" id="sg-attempts">Quedan ${vault.attemptsLeft} intento(s): al agotarlos se eliminan todas las firmas guardadas.</p>
        <button class="btn-link" id="sg-forgot" type="button">Olvidé mi contraseña</button>
      </div>`;
      $('sg-unlock').addEventListener('click', onUnlock);
      $('sg-pw').addEventListener('keydown', e => { if (e.key === 'Enter') onUnlock(); });
      $('sg-forgot').addEventListener('click', onForgot);
      return;
    }

    box.innerHTML = `${library.length
      ? `<div class="sig-names">${library.map(s => `<div class="sig-row${s.id === active ? ' is-active' : ''}">
          <button class="sig-use" type="button" data-sig="${s.id}" title="Usar esta firma">${icon('sign', 14)} <span>${pageToolEscape(s.name)}</span></button>
          <button class="sig-del" type="button" data-del="${s.id}" title="Eliminar firma">${icon('close', 12)}</button>
        </div>`).join('')}</div>`
      : '<span class="file-empty">No hay firmas guardadas</span>'}
      <div class="option-row"><button class="btn-toggle" id="sg-lock" type="button">${iconLabel('lock', 'Bloquear', 14)}</button></div>
      <p class="option-hint">${library.length
        ? (active ? 'Haz clic sobre la página para colocar la firma elegida; arrástrala para moverla y usa las esquinas para cambiar su tamaño.' : 'Elige una firma por su nombre para colocarla. No se muestra hasta que la coloques en el documento.')
        : 'Dibuja una firma o carga un PNG y ponle un nombre.'}
        Se bloquea sola tras ${vault.idleMinutes} min sin usarla.</p>`;

    box.querySelectorAll('[data-sig]').forEach(btn => btn.addEventListener('click', () => { active = btn.dataset.sig; renderVault(); }));
    box.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => onDelete(btn)));
    $('sg-lock').addEventListener('click', onLock);
  }

  // ── Acciones de la bóveda ──────────────────────────────────────────────────
  async function onCreate() {
    const pw = $('sg-pw1').value;
    if (pw.length < vault.minPassword) { notify.warning(`La contraseña debe tener al menos ${vault.minPassword} caracteres.`); return; }
    if (pw !== $('sg-pw2').value)      { notify.warning('Las contraseñas no coinciden.'); return; }
    const res = await window.api.signerVaultCreate({ password: pw });
    if (!(await check(res))) return;
    afterUnlock();
  }

  async function onUnlock() {
    const res = await window.api.signerVaultUnlock({ password: $('sg-pw').value });
    if (res.status) vault = res.status;
    if (res.ok) { afterUnlock(); return; }
    if (res.wiped) { pending = null; clearLibrary(); notify.error(res.error); renderVault(); ctrl.editor?.refresh(); return; }
    notify.error(res.error);
    renderVault();
    $('sg-pw')?.focus();
  }

  async function onLock() {
    await window.api.signerVaultLock();
    await refreshStatus();
    applyLocked();
  }

  // Sin contraseña las firmas no se pueden recuperar: se eliminan para empezar de nuevo
  // (el primer clic pide confirmación y el segundo la ejecuta)
  async function onForgot() {
    const btn = $('sg-forgot');
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = 'Se eliminarán todas tus firmas. Pulsa de nuevo para confirmar';
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = 'Olvidé mi contraseña'; } }, 5000);
      return;
    }
    await window.api.signerVaultReset();
    await refreshStatus();
    pending = null;
    applyLocked();
    notify.info('Se eliminaron las firmas guardadas. Puedes guardar una nueva con otra contraseña.');
  }

  // Eliminar también retira la firma de las páginas donde ya se colocó (primer clic confirma)
  async function onDelete(btn) {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.classList.add('is-armed');
      btn.title = 'Pulsa de nuevo para eliminar';
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.classList.remove('is-armed'); btn.title = 'Eliminar firma'; } }, 4000);
      return;
    }
    const id = btn.dataset.del;
    const res = await window.api.signerSignaturesDelete({ id });
    if (!(await check(res))) return;
    ctrl.editor?.removeSignature(id);
    await loadLibrary();
    renderVault();
  }

  // ── Bloqueo por inactividad ────────────────────────────────────────────────
  // La bóveda se bloquea en el proceso principal; aquí se detecta para reflejarlo en pantalla
  const poll = setInterval(async () => {
    if (!$('sg-vault')) { clearInterval(poll); return; }
    const was = vault.unlocked;
    await refreshStatus();
    if (was && !vault.unlocked) { applyLocked(); notify.info('Tus firmas se bloquearon por inactividad.'); }
  }, SIGN_STATUS_POLL);

  // Al abrir la herramienta la bóveda siempre empieza bloqueada
  window.api.signerVaultLock().then(refreshStatus).then(renderVault);
  renderVault();

  // ── Opciones del editor ────────────────────────────────────────────────────
  return {
    getStamp: () => {
      const s = library.find(x => x.id === active);
      return s && images[s.id] ? { sig: s.id, aspect: s.width / s.height } : null;
    },
    resolveSrc: sig => images[sig] || '',
    onNeedStamp: () => notify.info(vault.unlocked ? 'Elige una de tus firmas por su nombre para colocarla.' : 'Desbloquea tus firmas para colocar una.'),
  };
}

// ── Módulo ───────────────────────────────────────────────────────────────────

async function renderSign(ctx = {}) {
  return renderPageTool(ctx, {
    // ── Identidad ──────────────────────────────────────────────────────────────
    id: 'sign', api: 'signer', progress: 'signer', pdfOnly: true,
    title: 'Firmar', titleIcon: 'sign', previewTitle: 'Área de trabajo',

    // ── Textos ─────────────────────────────────────────────────────────────────
    description: () => 'Dibuja tu firma o carga un PNG con transparencia, guárdala con un nombre y colócala con un clic sobre las páginas del PDF. Tus firmas se guardan cifradas y protegidas con contraseña: solo ves su nombre hasta que las colocas en el documento.',
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
