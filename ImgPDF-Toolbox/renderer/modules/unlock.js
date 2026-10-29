// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/modules/unlock.js
// Descripción: Módulo «Desbloquear PDF»: elimina restricciones de propietario o abre
//              documentos con una contraseña conocida.
// ═════════════════════════════════════════════════════════════════════════════

async function renderUnlock() {
  // ── Estado y configuración del módulo ────────────────────────────────────────
  const cfg = await loadModuleConfig('unlock', { mode: 'owner' });
  let files = [], password = '', mode = cfg.mode;

  // ── Plantilla de la interfaz ─────────────────────────────────────────────────
  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">${icon('unlock',22)} Desbloquear PDF</div>
    <p class="module-desc">Elimina restricciones de propietario o desbloquea PDFs con contraseña conocida.</p>

    <div class="result-box warning">
      <div class="result-title">${iconLabel('alert','Uso responsable')}</div>
      <div class="result-item">Utiliza esta función únicamente en documentos de tu propiedad o con autorización expresa.</div>
    </div>

    <div class="option-group">
      <label>Tipo de desbloqueo</label>
      <div class="option-row" id="unlock-mode-row"></div>
      <div class="summary-box" id="unlock-hint" style="margin-top:0.5rem"></div>
    </div>

    <div id="password-section" style="display:none">
      <div class="option-group">
        <label>Contraseña del documento</label>
        <div style="display:flex;gap:0.5rem;align-items:center">
          <input type="password" id="unlock-password" class="num-input"
            style="width:260px;text-align:left" placeholder="Ingresa la contraseña...">
          <button class="btn-secondary btn-sm" id="toggle-pw">${iconLabel('eye','Mostrar')}</button>
        </div>
      </div>
    </div>

    <div class="file-zone" id="zone-unlock">
      <div class="file-zone-header">
        <span class="file-count-badge" id="unlock-badge">0 PDFs cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-unlock">${icon('folder-open',16)} Seleccionar PDFs</button>
        <button class="btn-secondary" id="clear-unlock" style="display:none">${icon('trash',16)} Limpiar</button>
        <span style="font-size:0.75rem;color:var(--text-muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="unlock-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>

    ${outputDirRow('unlock')}

    <div class="btn-row">
      <button class="btn-primary" id="run-unlock" disabled style="width:auto">Desbloquear PDFs</button>
      <button class="btn-danger"  id="cancel-unlock" style="display:none;width:auto">Cancelar</button>
    </div>
    <div class="progress-panel" id="unlock-progress"></div>
    <div id="unlock-result"></div>
  </div>`;
  organizeModule(ws);

  // ── Opciones de configuración ────────────────────────────────────────────────
  const hints = {
    owner:    'Elimina restricciones de impresión, copia y edición en PDFs que abren sin contraseña pero están bloqueados.',
    password: 'Desbloquea un PDF protegido con contraseña conocida y guarda una copia limpia sin ninguna restricción.',
  };

  function updateHint() {
    document.getElementById('unlock-hint').textContent = hints[mode];
    document.getElementById('password-section').style.display = mode === 'password' ? 'block' : 'none';
    updateRun();
  }

  optButtons(document.getElementById('unlock-mode-row'), [
    { icon: 'lock', label: 'Restricciones de propietario', value: 'owner'    },
    { icon: 'key', label: 'Con contraseña conocida',       value: 'password' },
  ], mode, val => {
    mode = val;
    saveModuleConfig('unlock', { mode: val });
    updateHint();
  });
  updateHint();

  // ── Campo de contraseña ──────────────────────────────────────────────────────
  document.getElementById('toggle-pw').addEventListener('click', () => {
    const input = document.getElementById('unlock-password');
    const btn   = document.getElementById('toggle-pw');
    input.type      = input.type === 'password' ? 'text' : 'password';
    btn.innerHTML = input.type === 'password' ? iconLabel('eye', 'Mostrar') : iconLabel('eye-off', 'Ocultar');
  });

  document.getElementById('unlock-password').addEventListener('input', e => {
    password = e.target.value;
    updateRun();
  });

  // ── Lista de archivos ────────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('unlock-list', files, onRemove);
    updateRun();
  };

  const addFiles = async (picked, index) => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'unlock-path');
    const dups = picked.filter(f => files.includes(f));
    files = insertAt(files, picked.filter(f => !files.includes(f)), index);
    renderFileList('unlock-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  // ── Selección de archivos y carpeta de salida ────────────────────────────────
  document.getElementById('pick-unlock').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name: 'PDF', extensions: ['pdf'] }]);
    addFiles(picked);
  });

  document.getElementById('clear-unlock').addEventListener('click', () => {
    files = [];
    renderFileList('unlock-list', files, onRemove);
    document.getElementById('unlock-result').innerHTML = '';
    updateRun();
  });

  document.getElementById('unlock-pick').addEventListener('click', () =>
    pickOutputDir('unlock-path').then(updateRun));
  bindDragDrop('zone-unlock', ['pdf'], addFiles);

  // ── Estado del botón de ejecución ────────────────────────────────────────────
  function updateRun() {
    const passwordOk = mode === 'owner' || (mode === 'password' && password.trim().length > 0);
    document.getElementById('run-unlock').disabled  = !(files.length && state.outputDir && passwordOk && !state.isProcessing);
    document.getElementById('clear-unlock').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('unlock-badge').textContent   = `${files.length} documento(s) seleccionado(s)`;
  }

  // ── Cancelación y ejecución ──────────────────────────────────────────────────
  document.getElementById('cancel-unlock').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando desbloqueo...');
  });

  document.getElementById('run-unlock').addEventListener('click', async () => {
    if (mode === 'password' && !password.trim()) {
      notify.warning('Ingresa la contraseña del documento.');
      return;
    }
    setProcessing(true);
    const btn = document.getElementById('run-unlock'), cancel = document.getElementById('cancel-unlock');
    btn.disabled = true; btn.textContent = 'Desbloqueando...';
    cancel.style.display = 'inline-block';
    document.getElementById('unlock-result').innerHTML = '';

    const res = await runWithProgress('unlock', 'unlock-progress', () => window.api.unlockPdf({
      files,
      password: mode === 'password' ? password : '',
      outputDir: state.outputDir
    }));
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('unlock-result').innerHTML =
      (ok.length  ? resultBox('success', `${ok.length} PDF(s) desbloqueado(s)`, ok.map(r => `${icon('file',14)} ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${ok.length} PDF(s) desbloqueado(s) correctamente.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron. Verifica la contraseña.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Desbloquear PDFs';
    cancel.style.display = 'none';
    updateRun();
  });
}
