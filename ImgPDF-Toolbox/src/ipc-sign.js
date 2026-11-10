// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-sign.js
// Descripción: Herramienta «Firmar»: coloca firmas sobre las páginas de un PDF. Expone la
//              bóveda de firmas protegida con contraseña (src/signature-vault.js): crear y
//              desbloquear, guardar firmas dibujadas, importar PNG con transparencia,
//              listarlas por nombre y eliminarlas. También define cómo se validan las firmas
//              colocadas y cómo se componen sobre cada página; el resto (sesiones con avance
//              guardado, rasterizado y exportación) lo aporta src/page-tool.js.
// ═════════════════════════════════════════════════════════════════════════════

const { ipcMain, app } = require('electron');
const path  = require('path');
const fs    = require('fs');
const vault = require('./signature-vault');
const { registerPageTool, sanitizePages, cleanRect, pngSize, magick } = require('./page-tool');

// ── Utilidades ───────────────────────────────────────────────────────────────

const validSig = id => /^[a-f0-9]{12}$/.test(String(id));

// Envuelve un handler: los errores salen como { ok: false, error } y, si la bóveda está
// bloqueada, con locked = true para que la interfaz pida la contraseña.
const guarded = fn => async (_, args = {}) => {
  try { return { ok: true, ...(await fn(args)) }; }
  catch (e) { return { ok: false, error: String(e.message || e), locked: !!e.locked }; }
};

// ── Bóveda: estado y contraseña ──────────────────────────────────────────────

ipcMain.handle('signer-vault-status', guarded(() => ({ status: vault.status() })));

ipcMain.handle('signer-vault-create', guarded(({ password }) => {
  vault.create(password);
  return { status: vault.status() };
}));

// Devuelve ok: false con el aviso de intentos restantes (o wiped: true si se eliminaron las firmas)
ipcMain.handle('signer-vault-unlock', async (_, { password } = {}) => {
  try {
    const res = vault.unlock(password);
    return { ...res, status: vault.status() };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});

ipcMain.handle('signer-vault-lock', guarded(() => { vault.lock(); return { status: vault.status() }; }));

// «Olvidé mi contraseña»: sin ella las firmas no pueden recuperarse, así que se eliminan para
// poder empezar de nuevo con otra
ipcMain.handle('signer-vault-reset', guarded(() => { vault.wipe(); return { status: vault.status() }; }));

// ── Bóveda: firmas ───────────────────────────────────────────────────────────

ipcMain.handle('signer-signatures-list', guarded(() => ({ signatures: vault.list() })));

// Imágenes de todas las firmas (data URL), para mostrarlas solo cuando se colocan en un
// documento. Solo se entregan con la bóveda desbloqueada.
ipcMain.handle('signer-signatures-images', guarded(() => {
  const images = {};
  for (const s of vault.list()) images[s.id] = `data:image/png;base64,${vault.getPng(s.id).toString('base64')}`;
  return { images };
}));

// Guarda una firma dibujada, recibida como PNG en data URL (ya recortada y con fondo transparente)
ipcMain.handle('signer-signatures-save', guarded(({ dataUrl, name }) => {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('La firma no es una imagen PNG válida.');
  return { signature: vault.add(name, Buffer.from(match[1], 'base64')) };
}));

// Límite de tamaño de un PNG que se importa (antes de normalizarlo)
const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

// Prepara un PNG importado: exige transparencia (si no, la firma saldría con un recuadro
// blanco), recorta los bordes vacíos y limita su tamaño.
async function normalizeImportedPng(file) {
  if (path.extname(file).toLowerCase() !== '.png') throw new Error('Solo se admiten archivos PNG.');
  if (!fs.existsSync(file) || fs.statSync(file).size > MAX_IMPORT_BYTES) throw new Error('No se pudo leer el PNG o es demasiado grande.');

  const alpha = (await magick([`${file}[0]`, '-format', '%A', 'info:'])).trim();
  if (alpha !== 'True' && alpha !== 'Blend') throw new Error('El PNG no tiene transparencia: la firma saldría con un recuadro blanco alrededor.');

  const tmp = path.join(app.getPath('temp'), `imgpdf_sig_${Date.now()}.png`);
  try {
    await magick([`${file}[0]`, '-trim', '+repage', '-resize', '1800x600>', '-strip', tmp]);
    const { width, height } = pngSize(tmp);
    if (width * height < 16) throw new Error('El PNG no contiene ninguna firma visible.');
    return fs.readFileSync(tmp);
  } finally {
    try { fs.unlinkSync(tmp); } catch (_) {}
  }
}

ipcMain.handle('signer-signatures-import', guarded(async ({ file, name }) => {
  vault.requireKey();
  return { signature: vault.add(name, await normalizeImportedPng(file)) };
}));

ipcMain.handle('signer-signatures-delete', guarded(({ id }) => { vault.remove(id); return {}; }));

// ── Firmas colocadas ─────────────────────────────────────────────────────────
// Cada una es una fracción de la página (x, y, w, h) más el id de la firma de la bóveda.

const cleanStamp = s => {
  const rect = cleanRect(s);
  return rect && validSig(s.sig) ? { ...rect, sig: s.sig } : null;
};

const sanitizeStamps = (stamps, pageCount) => sanitizePages(stamps, pageCount, cleanStamp);

// Antes de exportar se descifran las firmas usadas a archivos temporales (solo con la bóveda
// desbloqueada) y se comprueba que todas siguen existiendo.
function prepareStamps(clean) {
  vault.requireKey();
  const dir = path.join(app.getPath('temp'), `imgpdf_sigs_${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  try {
    for (const list of Object.values(clean)) {
      for (const s of list) {
        if (files[s.sig]) continue;
        let png;
        try { png = vault.getPng(s.sig); } catch (e) {
          if (e.locked) throw e;
          throw new Error('Algunas firmas colocadas ya no están guardadas. Quítalas del documento o vuelve a guardarlas.');
        }
        files[s.sig] = path.join(dir, `${s.sig}.png`);
        fs.writeFileSync(files[s.sig], png);
      }
    }
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw e;
  }
  return { dir, files };
}

// Los archivos descifrados no deben quedar en disco tras exportar
const releaseStamps = ctx => { if (ctx) fs.rmSync(ctx.dir, { recursive: true, force: true }); };

// Argumentos de ImageMagick que componen las firmas sobre la página, escaladas a su tamaño en
// píxeles.
function composeStamps(list, { width, height }, ctx) {
  const args = [];
  for (const s of list) {
    const file = ctx.files[s.sig];
    const w = Math.max(1, Math.round(s.w * width)),  h = Math.max(1, Math.round(s.h * height));
    const x = Math.round(s.x * width),               y = Math.round(s.y * height);
    args.push('(', file, '-resize', `${w}x${h}!`, ')', '-geometry', `+${x}+${y}`, '-composite');
  }
  return args;
}

// ── Registro ─────────────────────────────────────────────────────────────────

registerPageTool({
  channel:       'signer',
  moduleId:      'signer',
  dirName:       'signer-sessions',
  suffix:        '-firmado',
  emptyMessage:  'Coloca al menos una firma antes de exportar.',
  sanitizeItems: sanitizeStamps,
  composeArgs:   composeStamps,
  beforeExport:  prepareStamps,
  afterExport:   releaseStamps,
});
