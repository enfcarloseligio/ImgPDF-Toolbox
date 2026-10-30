// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/views.js
// Descripción: Vistas principales de la aplicación (inicio, categorías y actualización) y su
//              enrutador showView(). Cada vista reemplaza el contenido de #view-container.
// ═════════════════════════════════════════════════════════════════════════════

// ── Catálogo de módulos por categoría ───────────────────────────────────────

const CATEGORIES = {
  'pdf-tools': {
    title: 'Herramientas PDF',
    desc:  'Operaciones sobre documentos PDF: unir, separar, comprimir y más',
    icon:  'pdf-tools',
    modules: [
      { id: 'pdf-to-img',       label: 'PDF → IMG',    desc: 'Extrae páginas como imagen',      icon: 'pdf-file' },
      { id: 'merge',            label: 'Unir PDFs',    desc: 'Fusiona en orden',                icon: 'merge' },
      { id: 'split',            label: 'Separar PDF',  desc: 'Páginas, bloques o rangos',       icon: 'scissors' },
      { id: 'compress',         label: 'Comprimir',    desc: 'Reduce el peso del PDF',          icon: 'compress' },
      { id: 'folio',            label: 'Foliar',       desc: 'Numeración y sellos',             icon: 'hash' },
      { id: 'watermark',        label: 'Marca texto',  desc: 'Texto diagonal o posicionado',    icon: 'droplet' },
      { id: 'watermark-image',  label: 'Marca imagen', desc: 'Logo o firma sobre documentos',   icon: 'tag' },
      { id: 'rotate',           label: 'Rotar',        desc: 'Gira páginas de PDF',             icon: 'rotate' },
      { id: 'unlock',           label: 'Desbloquear',  desc: 'Elimina restricciones PDF',       icon: 'unlock' },
      { id: 'pdf-standards',    label: 'Estándares',   desc: 'PDF/A, PDF/X, PDF/UA',            icon: 'clipboard-check' },
    ],
  },
  'image-tools': {
    title: 'Herramientas Imágenes',
    desc:  'Procesa, ajusta y convierte tus imágenes',
    icon:  'image-tools',
    modules: [
      { id: 'img-to-pdf',       label: 'IMG → PDF',    desc: 'Convierte imágenes a PDF',        icon: 'image-file' },
      { id: 'convert-images',   label: 'Convertir',    desc: 'PNG, JPG, WebP, AVIF y más',      icon: 'convert' },
      { id: 'crop-image',       label: 'Recortar',     desc: 'Libre o con proporciones',        icon: 'crop' },
      { id: 'resize-images',    label: 'Redimensionar', desc: 'Por píxeles o porcentaje',       icon: 'resize' },
      { id: 'compress-images',  label: 'Comprimir',    desc: 'Reduce el peso de las imágenes',  icon: 'compress' },
      { id: 'remove-bg',        label: 'Quitar fondo', desc: 'Por color, con vista previa',     icon: 'wand' },
      { id: 'rotate',           label: 'Rotar',        desc: 'Gira imágenes',                   icon: 'rotate' },
      { id: 'watermark',        label: 'Marca texto',  desc: 'Texto diagonal o posicionado',    icon: 'droplet' },
      { id: 'watermark-image',  label: 'Marca imagen', desc: 'Logo o firma sobre imágenes',     icon: 'tag' },
    ],
  },
};

// ── Home ─────────────────────────────────────────────────────────────────────

function renderHome() {
  const container = document.getElementById('view-container');

  const cards = [
    {
      category: 'pdf-tools',
      title:    'Herramientas PDF',
      desc:     'Operaciones sobre documentos PDF: unir, separar, comprimir y más',
      icon:     'pdf-tools',
      count:    CATEGORIES['pdf-tools'].modules.length,
    },
    {
      category: 'image-tools',
      title:    'Herramientas Imágenes',
      desc:     'Procesa, ajusta y convierte tus imágenes',
      icon:     'image-tools',
      count:    CATEGORIES['image-tools'].modules.length,
    },
    {
      category: 'update',
      title:    'Actualizar',
      desc:     'Mantén las dependencias al día',
      icon:     'update',
      count:    2,
    },
  ];

  container.innerHTML = `
    <div class="home-view">
      <div class="home-grid">
        ${cards.map(c => `
          <button class="home-card" data-category="${c.category}">
            <div class="home-card-icon">${icon(c.icon, 48)}</div>
            <div class="home-card-title">${c.title}</div>
            <div class="home-card-desc">${c.desc}</div>
            <div class="home-card-count">${c.count} herramienta${c.count !== 1 ? 's' : ''}</div>
          </button>
        `).join('')}
      </div>
    </div>`;

  container.querySelectorAll('.home-card').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.isProcessing) {
        notify.warning('Hay una operación en curso. Espera o cancélala antes de cambiar de vista.');
        return;
      }
      showView(btn.dataset.category);
    });
  });
}

// ── Vista de categoría (PDF o Imágenes) ──────────────────────────────────────

function renderCategoryView(categoryKey) {
  const container = document.getElementById('view-container');
  const cat = CATEGORIES[categoryKey];
  if (!cat) {
    container.innerHTML = `<p class="workspace-placeholder">Categoría "${categoryKey}" no encontrada.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="category-view">
      <div class="category-header">
        <button class="btn-back" id="btn-back" title="Volver al inicio">
          ${icon('back', 18)}
          <span>Volver</span>
        </button>
        <div class="category-title-block">
          <div class="category-title-icon">${icon(cat.icon, 32)}</div>
          <div>
            <h2 class="category-title">${cat.title}</h2>
            <p class="category-desc">${cat.desc}</p>
          </div>
        </div>
      </div>

      <nav class="menu-grid">
        ${cat.modules.map(m => `
          <button class="card-btn" data-module="${m.id}">
            <span class="card-icon">${icon(m.icon, 28)}</span>
            <span class="card-title">${m.label}</span>
            <span class="card-desc">${m.desc}</span>
          </button>
        `).join('')}
      </nav>

      <section class="workspace" id="workspace">
        <p class="workspace-placeholder">Selecciona una opción para comenzar</p>
      </section>
    </div>`;

  // Botón volver
  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.isProcessing) {
      notify.warning('Hay una operación en curso. Espera o cancélala antes de cambiar de vista.');
      return;
    }
    showView('home');
  });

  // Botones de módulos
  container.querySelectorAll('.card-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.isProcessing) {
        notify.warning('Hay una operación en curso. Espera o cancélala antes de cambiar de módulo.');
        return;
      }
      openModule(categoryKey, btn.dataset.module);
    });
  });
}

// Activa un módulo dentro de la vista de categoría ya renderizada. `ctx` permite pasar
// datos al módulo (p. ej. `files` para precargar su lista de archivos).
function openModule(categoryKey, modId, ctx = {}) {
  const container = document.getElementById('view-container');
  container.querySelectorAll('.card-btn').forEach(b => b.classList.toggle('active', b.dataset.module === modId));
  container.querySelector('.category-view').classList.add('module-active');
  setActiveModule(modId);
  loadModule(modId, { context: categoryKey === 'image-tools' ? 'image' : 'pdf', ...ctx });
}

// Salta a un módulo de otra categoría (p. ej. de PDF → IMG a IMG → PDF) conservando el flujo de trabajo.
function goToModule(categoryKey, modId, ctx = {}) {
  if (state.isProcessing) {
    notify.warning('Hay una operación en curso. Espera o cancélala antes de cambiar de módulo.');
    return;
  }
  if (state.currentView !== categoryKey) showView(categoryKey);
  openModule(categoryKey, modId, ctx);
}

// ── Vista Update ─────────────────────────────────────────────────────────────

function renderUpdateView() {
  const container = document.getElementById('view-container');

  container.innerHTML = `
    <div class="category-view">
      <div class="category-header">
        <button class="btn-back" id="btn-back" title="Volver al inicio">
          ${icon('back', 18)}
          <span>Volver</span>
        </button>
        <div class="category-title-block">
          <div class="category-title-icon">${icon('update', 32)}</div>
          <div>
            <h2 class="category-title">Actualizar</h2>
            <p class="category-desc">Verifica e instala actualizaciones de las dependencias</p>
          </div>
        </div>
      </div>

      <section class="workspace active" id="workspace"></section>
    </div>`;

  document.getElementById('btn-back').addEventListener('click', () => {
    if (state.isProcessing) {
      notify.warning('Hay una operación en curso. Espera o cancélala antes de cambiar de vista.');
      return;
    }
    showView('home');
  });

  // Cargar el módulo de update dentro del workspace
  if (typeof renderUpdate === 'function') {
    renderUpdate();
  } else {
    document.getElementById('workspace').innerHTML =
      `<p class="workspace-placeholder">Módulo de actualización no disponible.</p>`;
  }
}

// ── Router ───────────────────────────────────────────────────────────────────

function showView(viewName) {
  state.currentView = viewName;

  if (viewName === 'home') {
    renderHome();
  } else if (viewName === 'pdf-tools' || viewName === 'image-tools') {
    renderCategoryView(viewName);
  } else if (viewName === 'update') {
    renderUpdateView();
  } else {
    renderHome();
  }
}