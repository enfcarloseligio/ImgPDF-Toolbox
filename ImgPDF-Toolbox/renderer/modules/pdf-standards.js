// ── modules/pdf-standards.js ──────────────────────────────────────────────────
async function renderPdfStandards() {
  const cfg = await loadModuleConfig('pdf-standards', { standard: 'PDFA-2b' });
  let files = [], standard = cfg.standard;

  // Catálogo completo de estándares con descripción, soporte GS y sugerencia de uso
  const STANDARDS = [
    {
      id:      'PDFA-2b',
      label:   'PDF/A-2b',
      badge:   '✅ Recomendado',
      badgeClass: 'badge-ok',
      norm:    'ISO 19005-2 (2011)',
      gs:      '✅ Soporte completo',
      desc:    'La evolución del PDF/A-1b. Añade soporte para capas, fuentes OpenType, transparencias y archivos adjuntos. Compatible con la mayoría de sistemas de gestión documental modernos.',
      uso:     'Expedientes digitales, documentos institucionales, archivos de largo plazo. Primera opción para cualquier organización que requiera conformidad con normas de archivo.',
      gsFlag:  'PDFA2',
      level:   'b',
    },
    {
      id:      'PDFA-1b',
      label:   'PDF/A-1b',
      badge:   '✅ Alta compatibilidad',
      badgeClass: 'badge-ok',
      norm:    'ISO 19005-1 (2005)',
      gs:      '✅ Soporte completo',
      desc:    'El estándar original de archivo PDF. Garantiza que el documento se verá igual en cualquier sistema dentro de 100 años. Sin cifrado, sin JavaScript, sin dependencias externas.',
      uso:     'Archivos históricos, documentos legales, expedientes que deben conservarse sin modificación. Ideal cuando la compatibilidad máxima es prioritaria.',
      gsFlag:  'PDFA',
      level:   'b',
    },
    {
      id:      'PDFA-3b',
      label:   'PDF/A-3b',
      badge:   '✅ Con adjuntos',
      badgeClass: 'badge-ok',
      norm:    'ISO 19005-3 (2012)',
      gs:      '✅ Soporte completo',
      desc:    'Igual que PDF/A-2b pero permite incrustar archivos adjuntos de cualquier formato dentro del PDF. Útil para incluir el XML de origen junto con la representación visual.',
      uso:     'Factura electrónica (ZUGFeRD, Factur-X), documentos que deben llevar su dato estructurado adjunto. Requiere validación posterior.',
      gsFlag:  'PDFA3',
      level:   'b',
    },
    {
      id:      'PDFA-4',
      label:   'PDF/A-4',
      badge:   '⚠️ Soporte parcial',
      badgeClass: 'badge-warn',
      norm:    'ISO 19005-4 (2020)',
      gs:      '⚠️ Soporte experimental',
      desc:    'La versión más reciente del estándar. Elimina la distinción entre niveles (a/b/u) y agrega soporte mejorado para firmas digitales y metadatos XMP extendidos.',
      uso:     'Proyectos que requieren el estándar más moderno. Validar el resultado con VeraPDF u otra herramienta externa antes de uso oficial.',
      gsFlag:  'PDFA',
      level:   'b',
      warn:    'Ghostscript tiene soporte experimental para PDF/A-4. Se recomienda validar el resultado con VeraPDF.',
    },
    {
      id:      'PDFX-1a',
      label:   'PDF/X-1a',
      badge:   '✅ Impresión',
      badgeClass: 'badge-info',
      norm:    'ISO 15930-1 (2001)',
      gs:      '✅ Soporte completo',
      desc:    'Estándar para intercambio de archivos en la industria gráfica. Garantiza que todos los elementos (fuentes, imágenes, colores) están incrustados y son reproducibles en imprenta.',
      uso:     'Envío a imprenta comercial, artes finales, diseño editorial. Requiere que el documento tenga espacio de color CMYK o Gris.',
      gsFlag:  'PDFX',
      pdfxVersion: 'PDF/X-1a:2001',
    },
    {
      id:      'PDFX-3',
      label:   'PDF/X-3',
      badge:   '✅ Impresión color',
      badgeClass: 'badge-info',
      norm:    'ISO 15930-3 (2002)',
      gs:      '✅ Soporte completo',
      desc:    'Versión de PDF/X que permite gestión de color ICC. Soporta espacios RGB además de CMYK, con perfiles de color incrustados para reproducción fiel.',
      uso:     'Impresión con gestión de color avanzada, flujos de trabajo con perfiles ICC, agencias de publicidad con entornos calibrados.',
      gsFlag:  'PDFX',
      pdfxVersion: 'PDF/X-3:2002',
    },
    {
      id:      'PDFUA-1',
      label:   'PDF/UA-1',
      badge:   '⚠️ Accesibilidad',
      badgeClass: 'badge-warn',
      norm:    'ISO 14289-1 (2014)',
      gs:      '⚠️ Conversión básica',
      desc:    'Estándar de accesibilidad universal. Requiere que el PDF tenga estructura de etiquetas (tags) correcta para que lectores de pantalla y tecnologías asistivas puedan interpretarlo.',
      uso:     'Documentos para personas con discapacidad visual, sitios de gobierno con obligación de accesibilidad, formularios interactivos accesibles.',
      warn:    'Ghostscript genera la estructura base pero NO valida que las etiquetas sean semánticamente correctas. Para conformidad real se requiere herramienta especializada (Adobe Acrobat Pro, Axes4).',
      gsFlag:  'PDFUA',
    },
    {
      id:      'PDFE-1',
      label:   'PDF/E-1',
      badge:   '⚠️ Ingeniería',
      badgeClass: 'badge-warn',
      norm:    'ISO 24517-1 (2008)',
      gs:      '⚠️ Soporte básico',
      desc:    'Estándar para documentos de ingeniería y planos técnicos. Soporta contenido 3D (U3D, PRC), medidas, anotaciones de ingeniería y metadatos específicos del sector.',
      uso:     'Planos CAD, manuales técnicos, documentación de ingeniería que debe intercambiarse entre organizaciones sin pérdida de información técnica.',
      warn:    'Ghostscript no soporta contenido 3D nativo. La conversión genera un PDF/E básico sin elementos 3D interactivos.',
      gsFlag:  'PDFA',
      level:   'b',
    },
  ];

  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">📋 Estándares PDF</div>
    <p class="module-desc">Convierte PDFs a formatos normalizados según estándares ISO. Cada estándar garantiza conformidad para un uso específico.</p>

    <!-- Selector de estándar -->
    <div class="option-group">
      <label>Selecciona el estándar de destino</label>
      <div id="standards-grid" style="display:flex;flex-direction:column;gap:0.6rem"></div>
    </div>

    <!-- Panel de información del estándar seleccionado -->
    <div id="standard-info-panel"></div>

    <!-- Archivos -->
    <div class="file-zone" id="zone-pdfstd">
      <div class="file-zone-header">
        <span class="file-count-badge" id="pdfstd-badge">0 PDFs cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-pdfstd">📂 Seleccionar PDFs</button>
        <button class="btn-secondary" id="clear-pdfstd" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="pdfstd-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>

    ${outputDirRow('pdfstd')}

    <div class="btn-row">
      <button class="btn-primary" id="run-pdfstd" disabled style="width:auto">Convertir al estándar</button>
      <button class="btn-danger"  id="cancel-pdfstd" style="display:none;width:auto">Cancelar</button>
    </div>
    <div id="pdfstd-result"></div>
  </div>`;

  // ── Renderizar grid de estándares ───────────────────────────────────────────
  function renderStandardsGrid() {
    const grid = document.getElementById('standards-grid');
    grid.innerHTML = '';

    STANDARDS.forEach(s => {
      const row = document.createElement('div');
      row.className = `standard-row ${standard === s.id ? 'active' : ''}`;
      row.innerHTML = `
        <div class="standard-row-left">
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span class="standard-label">${s.label}</span>
            <span class="standard-badge ${s.badgeClass}">${s.badge}</span>
          </div>
          <div class="standard-norm">${s.norm}</div>
        </div>
        <div class="standard-gs">${s.gs}</div>`;

      row.addEventListener('click', () => {
        standard = s.id;
        saveModuleConfig('pdf-standards', { standard });
        renderStandardsGrid();
        renderInfoPanel();
      });
      grid.appendChild(row);
    });
  }

  // ── Panel de información del estándar seleccionado ──────────────────────────
  function renderInfoPanel() {
    const s   = STANDARDS.find(x => x.id === standard);
    const el  = document.getElementById('standard-info-panel');
    if (!s) { el.innerHTML = ''; return; }

    el.innerHTML = `
      <div class="standard-info-card">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem">
          <span style="font-family:'Plus Jakarta Sans',sans-serif;font-size:1.1rem;font-weight:700;color:var(--deep)">${s.label}</span>
          <span class="standard-badge ${s.badgeClass}" style="font-size:0.78rem">${s.badge}</span>
          <span style="font-size:0.76rem;color:var(--muted)">${s.norm}</span>
        </div>
        <p style="font-size:0.84rem;color:var(--text);line-height:1.6;margin-bottom:0.6rem">${s.desc}</p>
        <div style="background:var(--primary-soft);border-radius:6px;padding:0.6rem 0.85rem;margin-bottom:${s.warn?'0.6rem':'0'}">
          <span style="font-size:0.76rem;font-weight:600;color:var(--primary)">💡 Sugerencia de uso: </span>
          <span style="font-size:0.76rem;color:var(--primary-dark)">${s.uso}</span>
        </div>
        ${s.warn ? `<div class="result-box warning" style="margin:0">
          <div class="result-title">⚠️ Limitación importante</div>
          <div class="result-item">${s.warn}</div>
        </div>` : ''}
        <div style="margin-top:0.5rem;font-size:0.75rem;color:var(--muted)">
          Soporte Ghostscript: ${s.gs}
        </div>
      </div>`;
  }

  renderStandardsGrid();
  renderInfoPanel();

  // ── Archivos ────────────────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('pdfstd-list', files, onRemove);
    updateRun();
  };

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'pdfstd-path');
    const dups = picked.filter(f =>  files.includes(f));
    files = [...files, ...picked.filter(f => !files.includes(f))];
    renderFileList('pdfstd-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-pdfstd').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name:'PDF', extensions:['pdf'] }]);
    addFiles(picked);
  });
  document.getElementById('clear-pdfstd').addEventListener('click', () => {
    files = [];
    renderFileList('pdfstd-list', files, onRemove);
    document.getElementById('pdfstd-result').innerHTML = '';
    updateRun();
  });
  document.getElementById('pdfstd-pick').addEventListener('click', () =>
    pickOutputDir('pdfstd-path').then(updateRun));
  bindDragDrop('zone-pdfstd', ['pdf'], addFiles);

  function updateRun() {
    document.getElementById('run-pdfstd').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-pdfstd').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('pdfstd-badge').textContent   = `${files.length} documento(s) seleccionado(s)`;
  }

  document.getElementById('cancel-pdfstd').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando conversión...');
  });

  document.getElementById('run-pdfstd').addEventListener('click', async () => {
    const s = STANDARDS.find(x => x.id === standard);
    if (!s) { notify.warning('Selecciona un estándar.'); return; }
    setProcessing(true);
    const btn = document.getElementById('run-pdfstd'), cancel = document.getElementById('cancel-pdfstd');
    btn.disabled = true; btn.textContent = 'Convirtiendo...';
    cancel.style.display = 'inline-block';
    document.getElementById('pdfstd-result').innerHTML = progressBar(40);

    const res = await window.api.convertPdfStandard({
      files, standard, outputDir: state.outputDir
    });
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    let html = ok.length  ? resultBox('success', `✓ ${ok.length} PDF(s) convertido(s) a ${s.label}`, ok.map(r => `📄 ${basename(r.out)}`), true) : '';
    if (err.length) html += resultBox('error', `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`));
    if (s.warn && ok.length) html += resultBox('warning', '⚠️ Recuerda validar el resultado', [
      'Esta conversión puede no ser 100% conforme al estándar sin validación externa.',
      'Herramientas de validación: VeraPDF (gratuita) · Adobe Acrobat Pro · PDF Tools AG'
    ]);
    document.getElementById('pdfstd-result').innerHTML = html;

    if (ok.length)  notify.success(`${ok.length} PDF(s) convertido(s) a ${s.label}.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Convertir al estándar';
    cancel.style.display = 'none';
    updateRun();
  });
}
