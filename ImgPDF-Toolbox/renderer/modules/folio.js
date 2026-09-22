// ── modules/folio.js ──────────────────────────────────────────────────────────
async function renderFolio() {
  const cfg = await loadModuleConfig('folio', {
    mode:        'pagina-total',
    prefix:      '',
    suffix:      '',
    separator:   '-',
    digits:      5,
    startNum:    1,
    italic:      false,
    dateFormat:  'DD/MM/AAAA',
    customDate:  '',
    useToday:    true,
    fontSize:    36,
    fontWeight:  700,
    color:       '#000000',
    position:    'bottom_right',
    angle:       0,
    fontSource:  'system',
    marginX:     40,
    marginY:     30,
  });

  let files      = [];
  let fontPath   = null;
  let systemFonts = [];
  let gfCatalog   = [];

  let mode       = cfg.mode;
  let prefix     = cfg.prefix;
  let suffix     = cfg.suffix;
  let separator  = cfg.separator;
  let digits     = cfg.digits;
  let startNum   = cfg.startNum;
  let italic     = cfg.italic;
  let dateFormat = cfg.dateFormat;
  let customDate = cfg.customDate;
  let useToday   = cfg.useToday;
  let fontSize   = cfg.fontSize;
  let fontWeight = cfg.fontWeight;
  let color      = cfg.color;
  let position   = cfg.position;
  let angle      = cfg.angle;
  let fontSource = cfg.fontSource;
  let marginX    = cfg.marginX;
  let marginY    = cfg.marginY;

  const ws = document.getElementById('workspace');
  ws.innerHTML = `<div class="module">
    <div class="module-title">🔢 Foliado y Numeración</div>
    <p class="module-desc">Estampa números de página, folios consecutivos o sellos de recibido sobre PDFs.</p>

    <!-- Modo de folio -->
    <div class="option-group">
      <label>Tipo de folio</label>
      <div class="option-row" id="folio-mode-row"></div>
    </div>

    <!-- Configuración dinámica según modo -->
    <div id="folio-config"></div>

    <!-- Fuente -->
    <div class="option-group">
      <label>Fuente</label>
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem">
        <div class="option-row" id="folio-font-source-row"></div>
        <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.82rem;
          font-weight:400;text-transform:none;letter-spacing:0;color:var(--text);cursor:pointer">
          <input type="checkbox" id="folio-italic" ${italic ? 'checked' : ''}
            style="accent-color:var(--primary)"> Cursiva
        </label>
      </div>
      <div id="folio-font-picker"></div>
    </div>

    <!-- Tamaño, peso, color -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
      <div class="option-group">
        <label>Tamaño (px)</label>
        <input type="number" class="num-input" id="folio-size"
          value="${fontSize}" min="8" max="200" style="width:100%">
      </div>
      <div class="option-group">
        <label>Peso</label>
        <select id="folio-weight" style="width:100%;border:1px solid var(--border);border-radius:6px;
          padding:0.38rem 0.5rem;font-size:0.83rem;background:var(--bg);color:var(--deep)">
          <option value="300" ${fontWeight==300?'selected':''}>Light (300)</option>
          <option value="400" ${fontWeight==400?'selected':''}>Regular (400)</option>
          <option value="500" ${fontWeight==500?'selected':''}>Medium (500)</option>
          <option value="600" ${fontWeight==600?'selected':''}>SemiBold (600)</option>
          <option value="700" ${fontWeight==700?'selected':''}>Bold (700)</option>
          <option value="800" ${fontWeight==800?'selected':''}>ExtraBold (800)</option>
          <option value="900" ${fontWeight==900?'selected':''}>Black (900)</option>
        </select>
      </div>
      <div class="option-group">
        <label>Color</label>
        <input type="color" id="folio-color" value="${color}"
          style="width:100%;height:36px;border:1px solid var(--border);
                 border-radius:6px;cursor:pointer;padding:2px">
      </div>
    </div>

    <!-- Posición y margen -->
    <div class="option-group">
      <label>Posición</label>
      <div class="option-row" id="folio-position-row"></div>
      <div class="range-row" style="margin-top:0.5rem">
        <span>Margen X:</span>
        <input type="number" class="num-input" id="folio-margin-x" value="${marginX}" min="0" max="300">
        <span>px</span>
        <span style="margin-left:1rem">Margen Y:</span>
        <input type="number" class="num-input" id="folio-margin-y" value="${marginY}" min="0" max="300">
        <span>px</span>
      </div>
    </div>

    <!-- Vista previa -->
    <div class="option-group">
      <label>Vista previa del folio</label>
      <div class="folio-preview-box" id="folio-preview-box">
        <div class="folio-preview-doc">
          <span class="folio-preview-text" id="folio-preview-text"></span>
        </div>
      </div>
    </div>

    <!-- Archivos -->
    <div class="file-zone" id="zone-folio">
      <div class="file-zone-header">
        <span class="file-count-badge" id="folio-badge">0 PDFs cargados</span>
      </div>
      <div class="btn-row">
        <button class="btn-secondary" id="pick-folio">📂 Seleccionar PDFs</button>
        <button class="btn-secondary" id="clear-folio" style="display:none">🗑️ Limpiar</button>
        <span style="font-size:0.75rem;color:var(--muted);align-self:center">O arrastra y suelta aquí</span>
      </div>
      <div class="file-list" id="folio-list">
        <span class="file-empty">Ningún archivo seleccionado</span>
      </div>
    </div>

    ${outputDirRow('folio')}

    <div class="btn-row">
      <button class="btn-primary" id="run-folio" disabled style="width:auto">Aplicar foliado</button>
      <button class="btn-danger"  id="cancel-folio" style="display:none;width:auto">Cancelar</button>
    </div>
    <div id="folio-result"></div>
  </div>`;

  // ── Modos de folio ──────────────────────────────────────────────────────────
  const modes = [
    { label: 'Página X',         value: 'pagina'        },
    { label: 'Página X de Y',    value: 'pagina-total'  },
    { label: 'Folio consecutivo',value: 'folio'         },
    { label: 'Folio con prefijo',value: 'folio-prefijo' },
    { label: 'Folio abierto',    value: 'folio-abierto' },
    { label: 'Recibido + fecha', value: 'recibido'      },
  ];

  optButtons(document.getElementById('folio-mode-row'), modes, mode, val => {
    mode = val;
    saveModuleConfig('folio', { mode: val });
    renderFolioConfig();
    updatePreview();
  });

  // ── Config dinámica por modo ────────────────────────────────────────────────
  function renderFolioConfig() {
    const el = document.getElementById('folio-config');

    if (mode === 'pagina') {
      el.innerHTML = `
        <div class="summary-box">
          Estampará <strong>Página 1</strong>, <strong>Página 2</strong>… en cada hoja del PDF.
          El texto de "Página" puede personalizarse.
          <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem">
            <label style="font-size:0.82rem;color:var(--text)">Etiqueta:</label>
            <input type="text" id="folio-label" class="num-input"
              style="width:140px;text-align:left" value="${prefix || 'Página'}"
              placeholder="Página">
          </div>
        </div>`;
      document.getElementById('folio-label').addEventListener('input', e => {
        prefix = e.target.value;
        saveModuleConfig('folio', { prefix });
        updatePreview();
      });

    } else if (mode === 'pagina-total') {
      el.innerHTML = `
        <div class="summary-box">
          Estampará <strong>Página 1 de 24</strong>, <strong>Página 2 de 24</strong>…
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <label style="font-size:0.82rem">Etiqueta:</label>
            <input type="text" id="folio-label" class="num-input"
              style="width:120px;text-align:left" value="${prefix || 'Página'}" placeholder="Página">
            <label style="font-size:0.82rem">Separador:</label>
            <input type="text" id="folio-sep" class="num-input"
              style="width:60px;text-align:left" value="${suffix || 'de'}" placeholder="de">
          </div>
        </div>`;
      document.getElementById('folio-label').addEventListener('input', e => {
        prefix = e.target.value; saveModuleConfig('folio', { prefix }); updatePreview();
      });
      document.getElementById('folio-sep').addEventListener('input', e => {
        suffix = e.target.value; saveModuleConfig('folio', { suffix }); updatePreview();
      });

    } else if (mode === 'folio') {
      el.innerHTML = `
        <div class="summary-box">
          Folio consecutivo con ceros a la izquierda. Ej: <strong>FOLIO: 00001</strong>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <label style="font-size:0.82rem">Etiqueta:</label>
            <input type="text" id="folio-label" class="num-input"
              style="width:120px;text-align:left" value="${prefix || 'FOLIO:'}" placeholder="FOLIO:">
            <label style="font-size:0.82rem">Inicio:</label>
            <input type="number" id="folio-start" class="num-input"
              style="width:80px" value="${startNum}" min="0">
            <label style="font-size:0.82rem">Dígitos:</label>
            <input type="number" id="folio-digits" class="num-input"
              style="width:70px" value="${digits}" min="1" max="10">
          </div>
        </div>`;
      document.getElementById('folio-label').addEventListener('input', e => {
        prefix = e.target.value; saveModuleConfig('folio', { prefix }); updatePreview();
      });
      document.getElementById('folio-start').addEventListener('input', e => {
        startNum = parseInt(e.target.value) || 1; saveModuleConfig('folio', { startNum }); updatePreview();
      });
      document.getElementById('folio-digits').addEventListener('input', e => {
        digits = parseInt(e.target.value) || 5; saveModuleConfig('folio', { digits }); updatePreview();
      });

    } else if (mode === 'folio-prefijo') {
      el.innerHTML = `
        <div class="summary-box">
          Folio con prefijo y sufijo fijos. Ej: <strong>DGCES-DEF-001-2026</strong>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <label style="font-size:0.82rem">Prefijo:</label>
            <input type="text" id="folio-prefix" class="num-input"
              style="width:160px;text-align:left" value="${prefix || 'DGCES-DEF-'}" placeholder="DGCES-DEF-">
            <label style="font-size:0.82rem">Sep.:</label>
            <input type="text" id="folio-sep-char" class="num-input"
              style="width:50px;text-align:left" value="${separator || '-'}">
            <label style="font-size:0.82rem">Sufijo:</label>
            <input type="text" id="folio-suffix" class="num-input"
              style="width:100px;text-align:left" value="${suffix || '-2026'}" placeholder="-2026">
            <label style="font-size:0.82rem">Inicio:</label>
            <input type="number" id="folio-start" class="num-input"
              style="width:75px" value="${startNum}" min="1">
            <label style="font-size:0.82rem">Dígitos:</label>
            <input type="number" id="folio-digits" class="num-input"
              style="width:70px" value="${digits}" min="1" max="10">
          </div>
        </div>`;
      document.getElementById('folio-prefix').addEventListener('input',   e => { prefix = e.target.value;    saveModuleConfig('folio',{prefix});    updatePreview(); });
      document.getElementById('folio-sep-char').addEventListener('input', e => { separator = e.target.value; saveModuleConfig('folio',{separator}); updatePreview(); });
      document.getElementById('folio-suffix').addEventListener('input',   e => { suffix = e.target.value;    saveModuleConfig('folio',{suffix});    updatePreview(); });
      document.getElementById('folio-start').addEventListener('input',    e => { startNum = parseInt(e.target.value)||1; saveModuleConfig('folio',{startNum}); updatePreview(); });
      document.getElementById('folio-digits').addEventListener('input',   e => { digits = parseInt(e.target.value)||5;   saveModuleConfig('folio',{digits});   updatePreview(); });

    } else if (mode === 'folio-abierto') {
      el.innerHTML = `
        <div class="summary-box">
          Texto libre con <code style="background:var(--border);padding:0.1rem 0.3rem;border-radius:3px">{n}</code>
          como marcador del número consecutivo. Ej: <strong>EXP-{n}-CDMX</strong>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <label style="font-size:0.82rem">Plantilla:</label>
            <input type="text" id="folio-template" class="num-input"
              style="width:220px;text-align:left"
              value="${prefix || 'EXP-{n}-2026'}" placeholder="EXP-{n}-2026">
            <label style="font-size:0.82rem">Inicio:</label>
            <input type="number" id="folio-start" class="num-input"
              style="width:75px" value="${startNum}" min="1">
            <label style="font-size:0.82rem">Dígitos:</label>
            <input type="number" id="folio-digits" class="num-input"
              style="width:70px" value="${digits}" min="1" max="10">
          </div>
        </div>`;
      document.getElementById('folio-template').addEventListener('input', e => {
        prefix = e.target.value; saveModuleConfig('folio',{prefix}); updatePreview();
      });
      document.getElementById('folio-start').addEventListener('input', e => {
        startNum = parseInt(e.target.value)||1; saveModuleConfig('folio',{startNum}); updatePreview();
      });
      document.getElementById('folio-digits').addEventListener('input', e => {
        digits = parseInt(e.target.value)||5; saveModuleConfig('folio',{digits}); updatePreview();
      });

    } else if (mode === 'recibido') {
      const today = new Date();
      const todayStr = `${String(today.getDate()).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
      el.innerHTML = `
        <div class="summary-box">
          Sello de recibido con fecha. Ej: <strong>RECIBIDO: 01/01/2026</strong>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <label style="font-size:0.82rem">Etiqueta:</label>
            <input type="text" id="folio-label" class="num-input"
              style="width:130px;text-align:left" value="${prefix || 'RECIBIDO:'}" placeholder="RECIBIDO:">
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <label style="font-size:0.82rem">Formato de fecha:</label>
            <select id="folio-date-format"
              style="border:1px solid var(--border);border-radius:6px;padding:0.35rem 0.5rem;
                     font-size:0.82rem;background:var(--bg);color:var(--deep)">
              <option value="DD/MM/AAAA"   ${dateFormat==='DD/MM/AAAA'  ?'selected':''}>01/01/2026</option>
              <option value="AAAA-MM-DD"   ${dateFormat==='AAAA-MM-DD'  ?'selected':''}>2026-01-01</option>
              <option value="D de Mes AAAA"${dateFormat==='D de Mes AAAA'?'selected':''}>1 de enero de 2026</option>
              <option value="Mes D AAAA"   ${dateFormat==='Mes D AAAA'  ?'selected':''}>enero 1, 2026</option>
              <option value="DD-MMM-AAAA"  ${dateFormat==='DD-MMM-AAAA' ?'selected':''}>01-ene-2026</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-top:0.5rem">
            <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.82rem;cursor:pointer">
              <input type="checkbox" id="folio-use-today" ${useToday?'checked':''}
                style="accent-color:var(--primary)"> Usar fecha de hoy
            </label>
            <input type="date" id="folio-custom-date"
              value="${customDate || today.toISOString().slice(0,10)}"
              style="border:1px solid var(--border);border-radius:6px;padding:0.35rem 0.5rem;
                     font-size:0.82rem;background:var(--bg);color:var(--deep);
                     display:${useToday?'none':'block'}">
          </div>
        </div>`;

      document.getElementById('folio-label').addEventListener('input', e => {
        prefix = e.target.value; saveModuleConfig('folio',{prefix}); updatePreview();
      });
      document.getElementById('folio-date-format').addEventListener('change', e => {
        dateFormat = e.target.value; saveModuleConfig('folio',{dateFormat}); updatePreview();
      });
      document.getElementById('folio-use-today').addEventListener('change', e => {
        useToday = e.target.checked;
        document.getElementById('folio-custom-date').style.display = useToday ? 'none' : 'block';
        saveModuleConfig('folio',{useToday}); updatePreview();
      });
      document.getElementById('folio-custom-date').addEventListener('input', e => {
        customDate = e.target.value; saveModuleConfig('folio',{customDate}); updatePreview();
      });
    }
  }
  renderFolioConfig();

  // ── Fuente ──────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('folio-font-source-row'), [
    { label: '🖥 Sistema', value: 'system' },
    { label: '🌐 Google Fonts', value: 'google' },
  ], fontSource, val => {
    fontSource = val;
    saveModuleConfig('folio', { fontSource: val });
    buildFontPicker({
      pickerId: 'folio-font-picker', fontSource, fontWeight,
      systemFonts, gfCatalog,
      onFontPath: p => { fontPath = p; updatePreview(); },
      onFontsLoaded: f => { systemFonts.length = 0; systemFonts.push(...f); },
      onPreview: updatePreview,
    });
  });

  buildFontPicker({
    pickerId: 'folio-font-picker', fontSource, fontWeight,
    systemFonts, gfCatalog,
    onFontPath: p => { fontPath = p; updatePreview(); },
    onFontsLoaded: f => { systemFonts.length = 0; systemFonts.push(...f); },
    onPreview: updatePreview,
  });

  document.getElementById('folio-italic').addEventListener('change', e => {
    italic = e.target.checked; saveModuleConfig('folio',{italic}); updatePreview();
  });

  document.getElementById('folio-size').addEventListener('input', e => {
    fontSize = parseInt(e.target.value)||36; saveModuleConfig('folio',{fontSize}); updatePreview();
  });
  document.getElementById('folio-weight').addEventListener('change', e => {
    fontWeight = parseInt(e.target.value); saveModuleConfig('folio',{fontWeight}); updatePreview();
  });
  document.getElementById('folio-color').addEventListener('input', e => {
    color = e.target.value; saveModuleConfig('folio',{color}); updatePreview();
  });
  document.getElementById('folio-margin-x').addEventListener('input', e => {
    marginX = parseInt(e.target.value)||40; saveModuleConfig('folio',{marginX}); updatePreview();
  });
  document.getElementById('folio-margin-y').addEventListener('input', e => {
    marginY = parseInt(e.target.value)||30; saveModuleConfig('folio',{marginY}); updatePreview();
  });

  // ── Posición ────────────────────────────────────────────────────────────────
  optButtons(document.getElementById('folio-position-row'), [
    { label: '↖ Sup. Izq.',  value: 'top_left'     },
    { label: '↑ Sup. Centro',value: 'top_center'   },
    { label: '↗ Sup. Der.',  value: 'top_right'    },
    { label: '← Izq. Centro',value: 'mid_left'     },
    { label: '✛ Centro',     value: 'center'       },
    { label: '→ Der. Centro', value: 'mid_right'   },
    { label: '↙ Inf. Izq.',  value: 'bottom_left'  },
    { label: '↓ Inf. Centro',value: 'bottom_center'},
    { label: '↘ Inf. Der.',  value: 'bottom_right' },
  ], position, val => {
    position = val; saveModuleConfig('folio',{position}); updatePreview();
  });

  // ── Vista previa ────────────────────────────────────────────────────────────
  function buildFolioText(pageNum, totalPages) {
    const pad = n => String(n).padStart(digits, '0');
    const dateStr = formatFolioDate();

    switch (mode) {
      case 'pagina':        return `${prefix || 'Página'} ${pageNum}`;
      case 'pagina-total':  return `${prefix || 'Página'} ${pageNum} ${suffix || 'de'} ${totalPages}`;
      case 'folio':         return `${prefix || 'FOLIO:'} ${pad(startNum + pageNum - 1)}`;
      case 'folio-prefijo': return `${prefix}${separator}${pad(startNum + pageNum - 1)}${suffix}`;
      case 'folio-abierto': return (prefix || 'EXP-{n}-2026').replace('{n}', pad(startNum + pageNum - 1));
      case 'recibido':      return `${prefix || 'RECIBIDO:'} ${dateStr}`;
      default:              return `${pageNum}`;
    }
  }

  function formatFolioDate() {
    const d = useToday ? new Date() : (customDate ? new Date(customDate + 'T12:00:00') : new Date());
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const mesesCorto = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const dd  = String(d.getDate()).padStart(2,'0');
    const mm  = String(d.getMonth()+1).padStart(2,'0');
    const yy  = d.getFullYear();
    const mes = meses[d.getMonth()];
    const mc  = mesesCorto[d.getMonth()];
    switch (dateFormat) {
      case 'DD/MM/AAAA':    return `${dd}/${mm}/${yy}`;
      case 'AAAA-MM-DD':    return `${yy}-${mm}-${dd}`;
      case 'D de Mes AAAA': return `${d.getDate()} de ${mes} de ${yy}`;
      case 'Mes D AAAA':    return `${mes} ${d.getDate()}, ${yy}`;
      case 'DD-MMM-AAAA':   return `${dd}-${mc}-${yy}`;
      default:              return `${dd}/${mm}/${yy}`;
    }
  }

  function updatePreview() {
    const el = document.getElementById('folio-preview-text');
    if (!el) return;
    const previewText = buildFolioText(1, 24);
    const previewSize = Math.max(10, Math.min(fontSize * 0.6, 28));
    el.textContent     = previewText;
    el.style.fontSize  = `${previewSize}px`;
    el.style.fontWeight = fontWeight;
    el.style.fontStyle  = italic ? 'italic' : 'normal';
    el.style.color      = color;

    const posMap = {
      top_left:      { top:'8%',  left:'5%',  transform:'none' },
      top_center:    { top:'8%',  left:'50%', transform:'translateX(-50%)' },
      top_right:     { top:'8%',  right:'5%', left:'auto', transform:'none' },
      mid_left:      { top:'50%', left:'5%',  transform:'translateY(-50%)' },
      center:        { top:'50%', left:'50%', transform:'translate(-50%,-50%)' },
      mid_right:     { top:'50%', right:'5%', left:'auto', transform:'translateY(-50%)' },
      bottom_left:   { bottom:'8%', top:'auto', left:'5%',  transform:'none' },
      bottom_center: { bottom:'8%', top:'auto', left:'50%', transform:'translateX(-50%)' },
      bottom_right:  { bottom:'8%', top:'auto', right:'5%', left:'auto', transform:'none' },
    };
    const pos = posMap[position] || posMap.bottom_right;
    Object.assign(el.style, { position:'absolute', top:'', bottom:'', left:'', right:'', transform:'', ...pos });
  }

  requestAnimationFrame(updatePreview);

  // ── Archivos ────────────────────────────────────────────────────────────────
  const onRemove = f => {
    files = files.filter(x => x !== f);
    renderFileList('folio-list', files, onRemove);
    updateRun();
  };

  const addFiles = async picked => {
    if (!picked.length) return;
    await checkDefaultOutputDir(picked[0], 'folio-path');
    const dups = picked.filter(f =>  files.includes(f));
    files = [...files, ...picked.filter(f => !files.includes(f))];
    renderFileList('folio-list', files, onRemove);
    updateRun();
    if (dups.length) notify.warning(`${dups.length} archivo(s) ya estaban en la lista.`);
  };

  document.getElementById('pick-folio').addEventListener('click', async () => {
    const picked = await window.api.selectFiles([{ name:'PDF', extensions:['pdf'] }]);
    addFiles(picked);
  });
  document.getElementById('clear-folio').addEventListener('click', () => {
    files = [];
    renderFileList('folio-list', files, onRemove);
    document.getElementById('folio-result').innerHTML = '';
    updateRun();
  });
  document.getElementById('folio-pick').addEventListener('click', () =>
    pickOutputDir('folio-path').then(updateRun));
  bindDragDrop('zone-folio', ['pdf'], addFiles);

  function updateRun() {
    document.getElementById('run-folio').disabled = !(files.length && state.outputDir && !state.isProcessing);
    document.getElementById('clear-folio').style.display = files.length ? 'inline-block' : 'none';
    document.getElementById('folio-badge').textContent   = `${files.length} documento(s) seleccionado(s)`;
  }

  document.getElementById('cancel-folio').addEventListener('click', async () => {
    await window.api.cancelOperation();
    notify.warning('Cancelando foliado...');
  });

  document.getElementById('run-folio').addEventListener('click', async () => {
    setProcessing(true);
    const btn = document.getElementById('run-folio'), cancel = document.getElementById('cancel-folio');
    btn.disabled = true; btn.textContent = 'Procesando...';
    cancel.style.display = 'inline-block';
    document.getElementById('folio-result').innerHTML = progressBar(40);

    const res = await window.api.applyFolio({
      files, mode, prefix, suffix, separator, digits, startNum,
      italic, dateFormat, customDate, useToday,
      fontSize, fontWeight, color, position, angle,
      marginX, marginY, fontPath,
      outputDir: state.outputDir
    });
    window.api.playBeep();

    const ok = res.filter(r => r.ok), err = res.filter(r => !r.ok);
    document.getElementById('folio-result').innerHTML =
      (ok.length  ? resultBox('success', `✓ ${ok.length} PDF(s) foliado(s)`, ok.map(r => `📄 ${basename(r.out)}`), true) : '') +
      (err.length ? resultBox('error',   `✗ ${err.length} error(es)`, err.map(r => `${basename(r.file)}: ${r.error}`)) : '');

    if (ok.length)  notify.success(`${ok.length} PDF(s) foliados correctamente.`);
    if (err.length) notify.error(`${err.length} archivo(s) fallaron.`);

    setProcessing(false);
    btn.disabled = false; btn.textContent = 'Aplicar foliado';
    cancel.style.display = 'none';
    updateRun();
  });
}
