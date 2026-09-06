// ── app.js ────────────────────────────────────────────────────────────────────
// Orquestador principal. Solo responsable de:
//   - Arrancar el splash y la verificación de herramientas
//   - Inicializar la app principal
//   - Enrutar módulos
//   - Bindear links externos

window.addEventListener('DOMContentLoaded', async () => {
  bindExternalLinks();
  await runSplash();
});

// ── SPLASH ────────────────────────────────────────────────────────────────────

async function runSplash() {
  const loaderFill = document.getElementById('loader-fill');
  const loaderMsg  = document.getElementById('loader-msg');

  const steps = [
    [15, 'Iniciando entorno...'],
    [40, 'Buscando ImageMagick...'],
    [65, 'Buscando Ghostscript...'],
    [90, 'Comprobando librerías...'],
  ];

  for (const [pct, msg] of steps) {
    loaderFill.style.width = pct + '%';
    loaderMsg.textContent  = msg;
    await delay(300);
  }

  const tools = await window.api.checkTools();
  setTools(tools);

  loaderFill.style.width = '100%';
  loaderMsg.textContent  = 'Verificación lista.';
  await delay(200);

  document.getElementById('splash-loader').style.display = 'none';
  updateScanStep('scan-im', tools.imageMagick, tools.imVersion);
  updateScanStep('scan-gs', tools.ghostscript, tools.gsVersion);
  await delay(150);

  const resultPanel = document.getElementById('splash-result');
  resultPanel.style.cssText = 'display:flex; flex-direction:column; gap:1rem';

  const allOk = tools.imageMagick && tools.ghostscript;
  if (!allOk) buildInstallPanel(tools);

  document.getElementById('btn-enter').addEventListener('click', enterApp);

  if (!allOk) {
    const skipBtn = document.getElementById('btn-skip');
    skipBtn.style.display = 'block';
    skipBtn.addEventListener('click', enterApp);
  }
}

function updateScanStep(id, ok, version) {
  const el   = document.getElementById(id);
  if (!el) return;
  const icon = el.querySelector('.scan-icon');
  const stat = el.querySelector('.scan-status');
  el.classList.add(ok ? 'ok' : 'warn');
  icon.textContent = ok ? '✅' : '⚠️';
  icon.classList.remove('spinning');
  stat.textContent = ok ? `v${version} — Listo` : 'No encontrado';
}

function buildInstallPanel(tools) {
  const panel   = document.getElementById('install-panel');
  const actions = document.getElementById('install-actions');
  panel.style.cssText = 'display:flex; flex-direction:column; gap:0.75rem';
  actions.innerHTML   = '';

  const addRow = (tool, label, note, btnId, scanId) => {
    const row = document.createElement('div');
    row.className = 'install-row';
    row.innerHTML = `
      <div>
        <div class="install-tool-name">${label}</div>
        <div class="install-tool-note">${note}</div>
      </div>
      <button class="btn-accent btn-sm" id="${btnId}">Instalar</button>`;
    actions.appendChild(row);
    row.querySelector(`#${btnId}`).addEventListener('click', () =>
      installToolAction(tool, btnId, scanId)
    );
  };

  if (!tools.imageMagick) {
    addRow('imagemagick', 'ImageMagick', 'Instalador silencioso integrado', 'install-im', 'scan-im');
  }

  if (!tools.ghostscript) {
    addRow('ghostscript', 'Ghostscript', 'Puede requerir instalación manual', 'install-gs', 'scan-gs');
    document.getElementById('btn-gs-manual').addEventListener('click', () => {
      window.api.openUrl('https://www.ghostscript.com/releases/gsdnld.html');
    });
  }
}

async function installToolAction(tool, btnId, scanId) {
  const btn = document.getElementById(btnId);
  btn.textContent = 'Instalando...';
  btn.disabled    = true;

  const res = await window.api.installTool(tool);
  if (res.ok) {
    updateScanStep(scanId, true, 'instalado');
    btn.textContent = '✓ Listo';
    notify.success(`${tool} instalado correctamente.`);
  } else {
    btn.textContent = 'Error';
    btn.disabled    = false;
    notify.error(`Fallo al instalar ${tool}.`);
    if (tool === 'ghostscript') {
      const manual = document.getElementById('install-manual');
      manual.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem';
    }
  }
}

async function enterApp() {
  const splash = document.getElementById('splash');
  const appEl  = document.getElementById('app');
  splash.classList.add('fade-out');
  await delay(450);
  splash.style.display = 'none';
  appEl.style.display  = 'flex';
  await delay(20);
  appEl.style.opacity  = '1';
  initApp();
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────

function initApp() {
  updateStatusBadge();
  bindMenu();
  bindFooterLinks();
  // Cargar módulo por defecto al entrar (mejora de Gemini — mejor UX)
  loadModule('img-to-pdf');
  document.querySelector('.card-btn[data-module="img-to-pdf"]')?.classList.add('active');
}

function updateStatusBadge() {
  const t     = state.tools;
  const dot   = document.querySelector('#tools-status .status-dot');
  const label = document.querySelector('#tools-status .status-label');

  if (t.imageMagick && t.ghostscript) {
    dot.className     = 'status-dot ok';
    label.textContent = `IM ${t.imVersion} · GS ${t.gsVersion}`;
  } else if (t.imageMagick || t.ghostscript) {
    dot.className     = 'status-dot warn';
    label.textContent = 'Herramienta faltante';
  } else {
    dot.className     = 'status-dot error';
    label.textContent = 'Sin herramientas';
  }

  document.getElementById('tools-status').title = [
    `ImageMagick: ${t.imageMagick ? '✓ ' + t.imVersion : '✗ No detectado'}`,
    `Ghostscript:  ${t.ghostscript ? '✓ ' + t.gsVersion : '✗ No detectado'}`,
    `winget:       ${t.winget      ? '✓ Disponible'     : '✗ No disponible'}`,
  ].join('\n');
}

// ── Enrutador de módulos ──────────────────────────────────────────────────────

const moduleMap = {
  'img-to-pdf': renderImgToPdf,
  'pdf-to-img': renderPdfToImg,
  'merge':      renderMerge,
  'split':      renderSplit,
  'update':     renderUpdate,
  // Agregar nuevos módulos aquí sin tocar nada más
};

function bindMenu() {
  document.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.isProcessing) {
        notify.warning('Hay una operación en curso. Espera o cancélala antes de cambiar de módulo.');
        return;
      }
      document.querySelectorAll('.card-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setActiveModule(btn.dataset.module);
      loadModule(btn.dataset.module);
    });
  });
}

function loadModule(mod) {
  const ws = document.getElementById('workspace');
  ws.classList.add('active');
  if (moduleMap[mod]) {
    moduleMap[mod]();
  } else {
    ws.innerHTML = `<p class="workspace-placeholder">Módulo "${mod}" no encontrado.</p>`;
  }
}

// ── Links externos ────────────────────────────────────────────────────────────

function bindFooterLinks() {
  const links = {
    'footer-author': 'https://enfcarloseligio.com/',
    'footer-site':   'https://enfcarloseligio.com/',
    'footer-im':     'https://imagemagick.org',
    'footer-gs':     'https://www.ghostscript.com',
  };
  for (const [id, url] of Object.entries(links)) {
    document.getElementById(id)?.addEventListener('click', e => {
      e.preventDefault();
      window.api.openUrl(url);
    });
  }
}

function bindExternalLinks() {
  document.getElementById('splash-author-link')?.addEventListener('click', e => {
    e.preventDefault();
    window.api.openUrl('https://enfcarloseligio.com/');
  });
  document.getElementById('splash-site-link')?.addEventListener('click', () => {
    window.api.openUrl('https://enfcarloseligio.com/');
  });
}