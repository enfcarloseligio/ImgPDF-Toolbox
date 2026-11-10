// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/ipc-sign.js
// Descripción: Herramienta «Firmar»: coloca firmas dibujadas sobre las páginas de un PDF.
//              Gestiona la biblioteca de firmas (PNG con fondo transparente en userData,
//              reutilizables entre documentos) y define cómo se validan las firmas colocadas
//              y cómo se componen sobre cada página; el resto (sesiones con avance guardado,
//              rasterizado y exportación) lo aporta src/page-tool.js.
// ═════════════════════════════════════════════════════════════════════════════

const { ipcMain, app } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');
const { registerPageTool, sanitizePages, cleanRect, pngSize } = require('./page-tool');

// ── Biblioteca de firmas ─────────────────────────────────────────────────────

const MAX_SIGNATURE_BYTES = 5 * 1024 * 1024;
const validSig = id => /^[a-f0-9]{12}$/.test(String(id));

const signaturesDir = () => path.join(app.getPath('userData'), 'signatures');
const signatureFile = id => path.join(signaturesDir(), `${id}.png`);

const describeSignature = id => {
  const file = signatureFile(id);
  return { id, path: file, ...pngSize(file), createdAt: fs.statSync(file).mtimeMs };
};

// Firmas guardadas, de la más reciente a la más antigua.
ipcMain.handle('signer-signatures-list', () => {
  try {
    if (!fs.existsSync(signaturesDir())) return { ok: true, signatures: [] };
    const signatures = fs.readdirSync(signaturesDir())
      .map(name => name.replace(/\.png$/, ''))
      .filter(validSig)
      .map(describeSignature)
      .sort((a, b) => b.createdAt - a.createdAt);
    return { ok: true, signatures };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});

// Guarda una firma recibida como PNG en data URL (el renderer la recorta y la dibuja con
// fondo transparente).
ipcMain.handle('signer-signatures-save', (_, { dataUrl }) => {
  try {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!match) throw new Error('La firma no es una imagen PNG válida.');
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length > MAX_SIGNATURE_BYTES) throw new Error('La firma es demasiado grande.');

    fs.mkdirSync(signaturesDir(), { recursive: true });
    const id = crypto.randomBytes(6).toString('hex');
    fs.writeFileSync(signatureFile(id), bytes);
    return { ok: true, signature: describeSignature(id) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
});

ipcMain.handle('signer-signatures-delete', (_, { id }) => {
  if (validSig(id)) { try { fs.unlinkSync(signatureFile(id)); } catch (_) {} }
  return { ok: true };
});

// ── Firmas colocadas ─────────────────────────────────────────────────────────
// Cada una es una fracción de la página (x, y, w, h) más el id de la firma de la biblioteca.

const cleanStamp = s => {
  const rect = cleanRect(s);
  return rect && validSig(s.sig) ? { ...rect, sig: s.sig } : null;
};

const sanitizeStamps = (stamps, pageCount) => sanitizePages(stamps, pageCount, cleanStamp);

// Argumentos de ImageMagick que componen las firmas sobre la página, escaladas a su tamaño en
// píxeles. Las firmas cuyo archivo ya no existe se omiten.
function composeStamps(list, { width, height }) {
  const args = [];
  for (const s of list) {
    const file = signatureFile(s.sig);
    if (!fs.existsSync(file)) continue;
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
});
