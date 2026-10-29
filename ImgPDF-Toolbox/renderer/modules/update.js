// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/update.js
// Descripción: Módulo «Actualizar dependencias»: compara las versiones instaladas de
//              ImageMagick y Ghostscript con las últimas releases oficiales y permite
//              actualizarlas.
// ═════════════════════════════════════════════════════════════════════════════

function renderUpdate() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const t = state.tools;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('rotate',22)} Actualizar dependencias</div>
    <p class="module-desc">Compara las versiones instaladas de ImageMagick y Ghostscript con las últimas publicadas oficialmente.</p>

    <div class="update-card">
      <div>
        <div class="update-tool-name">ImageMagick</div>
        <div class="update-tool-ver">${t.imageMagick ? 'v' + t.imVersion : 'No instalado'}</div>
      </div>
      <span class="update-badge ${t.imageMagick ? 'ok' : 'miss'}">${t.imageMagick ? iconLabel('check', 'Instalado', 14) : iconLabel('x-circle', 'Faltante', 14)}</span>
    </div>

    <div class="update-card">
      <div>
        <div class="update-tool-name">Ghostscript</div>
        <div class="update-tool-ver">${t.ghostscript ? 'v' + t.gsVersion : 'No instalado'}</div>
      </div>
      <span class="update-badge ${t.ghostscript ? 'ok' : 'miss'}">${t.ghostscript ? iconLabel('check', 'Instalado', 14) : iconLabel('x-circle', 'Faltante', 14)}</span>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="run-update" style="width:auto">Buscar actualizaciones</button>
      <button class="btn-accent"  id="open-im-site">Descargar ImageMagick web</button>
      <button class="btn-accent"  id="open-gs-site">Descargar Ghostscript web</button>
    </div>
    <div id="update-result"></div>
  </div>`;

  // ── Enlaces a los sitios oficiales ───────────────────────────────────────────
  document.getElementById('open-im-site').addEventListener('click', () => {
    window.api.openUrl('https://imagemagick.org/script/download.php');
  });

  document.getElementById('open-gs-site').addEventListener('click', () => {
    window.api.openUrl('https://www.ghostscript.com/releases/gsdnld.html');
  });

  // ── Comprobación de versiones ────────────────────────────────────────────────
  const TOOL_LABELS = { imagemagick: 'ImageMagick', ghostscript: 'Ghostscript' };

  // Texto de estado de una herramienta según el resultado de check-updates.
  function statusLine(info) {
    switch (info.status) {
      case 'up-to-date':    return iconLabel('check', `Al día (v${info.installed})`, 14);
      case 'available':     return iconLabel('alert', `Nueva versión disponible: ${info.latest} (instalada: v${info.installed})`, 14);
      case 'not-installed': return iconLabel('x-circle', 'No instalado', 14);
      default:              return iconLabel('info', 'No se pudo comprobar (¿sin conexión?). Revisa el sitio oficial.', 14);
    }
  }

  document.getElementById('run-update').addEventListener('click', async () => {
    const btn = document.getElementById('run-update');
    const out = document.getElementById('update-result');
    btn.disabled = true; btn.textContent = 'Verificando...';
    out.innerHTML = progressBar(40);

    const res = await window.api.checkUpdates();
    window.api.playBeep();

    const keys = Object.keys(TOOL_LABELS);
    const pending = keys.filter(k => res[k].status === 'available');
    const unknown = keys.some(k => res[k].status === 'unknown');
    const type = pending.length ? 'warning' : unknown ? 'info' : 'success';
    const title = pending.length ? 'Hay actualizaciones disponibles' : unknown ? 'Comprobación incompleta' : 'Todo está al día';

    out.innerHTML = resultBox(type, title, keys.map(k => `${TOOL_LABELS[k]}: ${statusLine(res[k])}`)) +
      (pending.length
        ? `<div class="btn-row">${pending.map(k =>
            `<button class="btn-accent" data-upgrade="${k}">Actualizar ${TOOL_LABELS[k]}</button>`).join('')}</div>`
        : '');

    out.querySelectorAll('[data-upgrade]').forEach(b => b.addEventListener('click', () => upgrade(b, res)));
    notify.info('Comprobación finalizada.');
    btn.disabled = false; btn.textContent = 'Buscar actualizaciones';
  });

  // ── Aplicación de la actualización ───────────────────────────────────────────
  // ImageMagick se actualiza con winget; Ghostscript abre la página oficial de descargas.
  async function upgrade(button, res) {
    const tool = button.dataset.upgrade;
    button.disabled = true; button.textContent = 'Actualizando...';

    const result = await window.api.upgradeTool(tool);
    if (result.ok) {
      setTools(await window.api.checkTools());
      updateStatusBadge();
      notify.success(`${TOOL_LABELS[tool]} actualizado correctamente.`);
      document.getElementById('run-update').click();
    } else {
      window.api.openUrl(result.url || res[tool].page);
      notify.warning(`Descarga ${TOOL_LABELS[tool]} desde el sitio oficial para actualizarlo.`);
      button.disabled = false; button.textContent = `Actualizar ${TOOL_LABELS[tool]}`;
    }
  }
}
