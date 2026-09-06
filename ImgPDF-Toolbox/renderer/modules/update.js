// ── modules/update.js ─────────────────────────────────────────────────────────
function renderUpdate() {
  const t = state.tools;
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">🔄 Actualizar dependencias</div>
    <p class="module-desc">Verifica e instala actualizaciones disponibles para ImageMagick y Ghostscript vía winget.</p>

    <div class="update-card">
      <div>
        <div class="update-tool-name">ImageMagick</div>
        <div class="update-tool-ver">${t.imageMagick ? 'v' + t.imVersion : 'No instalado'}</div>
      </div>
      <span class="update-badge ${t.imageMagick ? 'ok' : 'miss'}">${t.imageMagick ? '✓ Instalado' : '✗ Faltante'}</span>
    </div>

    <div class="update-card">
      <div>
        <div class="update-tool-name">Ghostscript</div>
        <div class="update-tool-ver">${t.ghostscript ? 'v' + t.gsVersion : 'No instalado'}</div>
      </div>
      <span class="update-badge ${t.ghostscript ? 'ok' : 'miss'}">${t.ghostscript ? '✓ Instalado' : '✗ Faltante'}</span>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="run-update" style="width:auto">Buscar actualizaciones</button>
      <button class="btn-accent"  id="open-im-site">Descargar ImageMagick web</button>
      <button class="btn-accent"  id="open-gs-site">Descargar Ghostscript web</button>
    </div>
    <div id="update-result"></div>
  </div>`;

  document.getElementById('open-im-site').addEventListener('click', () => {
    window.api.openUrl('https://imagemagick.org/script/download.php');
  });

  document.getElementById('open-gs-site').addEventListener('click', () => {
    window.api.openUrl('https://www.ghostscript.com/releases/gsdnld.html');
  });

  document.getElementById('run-update').addEventListener('click', async () => {
    const btn = document.getElementById('run-update');
    btn.disabled = true; btn.textContent = 'Verificando...';
    document.getElementById('update-result').innerHTML = progressBar(40);

    const res = await window.api.updateTools();
    window.api.playBeep();

    if (!res.wingetAvailable) {
      document.getElementById('update-result').innerHTML = resultBox('warning', '⚠ winget no está disponible en este equipo', [
        'Utiliza los botones de descarga manual para obtener las versiones más recientes.'
      ]);
      notify.warning('winget no disponible.');
    } else {
      document.getElementById('update-result').innerHTML = resultBox('info', '🔄 Estado de actualizaciones', [
        `ImageMagick: ${res.imagemagick === 'ok' ? '✓ Al día' : '⚠ Revisar actualización manual'}`,
        `Ghostscript:  ${res.ghostscript  === 'ok' ? '✓ Al día' : '⚠ Revisar actualización manual'}`,
        'Si se aplicó alguna actualización, reinicia la app para detectarla.'
      ]);
      notify.info('Comprobación finalizada.');
    }

    btn.disabled = false; btn.textContent = 'Buscar actualizaciones';
  });
}