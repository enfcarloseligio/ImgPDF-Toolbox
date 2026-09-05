// ── modules/update.js ─────────────────────────────────────────────────────────
function renderUpdate() {
  const t  = state.tools;
  const ws = document.getElementById('workspace');

  ws.innerHTML = `<div class="module">
    <div class="module-title">🔄 Actualizar dependencias</div>
    <p class="module-desc">Verifica e instala actualizaciones disponibles para ImageMagick y Ghostscript.</p>

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

    ${!t.winget ? `<div class="result-box warning">
      <div class="result-title">⚠ winget no disponible</div>
      <div class="result-item">Las actualizaciones automáticas requieren winget (Windows Package Manager).
        Descarga las herramientas manualmente desde los botones de abajo.</div>
    </div>` : ''}

    <div class="btn-row">
      <button class="btn-primary" id="run-update" style="width:auto" ${!t.winget ? 'disabled title="winget no disponible"' : ''}>
        ${t.winget ? 'Buscar y aplicar actualizaciones' : 'winget no disponible'}
      </button>
      <button class="btn-accent" id="open-im-site">↗ ImageMagick</button>
      <button class="btn-accent" id="open-gs-site">↗ Ghostscript</button>
    </div>
    <div id="update-result"></div>
  </div>`;

  document.getElementById('open-im-site').addEventListener('click', () =>
    window.api.openUrl('https://imagemagick.org/script/download.php'));
  document.getElementById('open-gs-site').addEventListener('click', () =>
    window.api.openUrl('https://www.ghostscript.com/releases/gsdnld.html'));

  const runBtn = document.getElementById('run-update');
  if (!runBtn || runBtn.disabled) return;

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true; runBtn.textContent = 'Actualizando...';
    document.getElementById('update-result').innerHTML = progressBar(40);
    notify.info('Buscando actualizaciones...');

    const res = await window.api.updateTools();
    window.api.playBeep();

    if (!res.wingetAvailable) {
      document.getElementById('update-result').innerHTML = resultBox('warning',
        '⚠ winget no disponible',
        ['No se pudieron verificar actualizaciones automáticamente.',
         'Usa los botones de descarga para instalar manualmente.']);
      notify.warning('winget no disponible en este sistema.');
    } else {
      const imOk = res.imagemagick === 'ok';
      const gsOk = res.ghostscript  === 'ok';
      document.getElementById('update-result').innerHTML = resultBox('info',
        '🔄 Proceso de actualización completado', [
          `ImageMagick: ${imOk ? '✓ Actualizado o al día' : '⚠ Revisar manualmente'}`,
          `Ghostscript: ${gsOk ? '✓ Actualizado o al día' : '⚠ Revisar manualmente'}`,
          'Si se instaló alguna actualización, reinicia la aplicación para detectar la nueva versión.',
        ]);
      imOk && gsOk
        ? notify.success('Ambas herramientas están al día.')
        : notify.warning('Alguna herramienta puede requerir revisión manual.');
    }

    runBtn.disabled = false; runBtn.textContent = 'Buscar y aplicar actualizaciones';
  });
}
