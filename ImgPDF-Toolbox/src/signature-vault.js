// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/signature-vault.js
// Descripción: Bóveda de firmas protegida con contraseña. Cada firma (nombre e imagen PNG con
//              transparencia) se guarda cifrada con AES-256-GCM en la carpeta de datos de la
//              aplicación; la clave se deriva de la contraseña con scrypt y solo vive en
//              memoria mientras la bóveda está desbloqueada. Si se falla la contraseña
//              demasiadas veces en poco tiempo, se eliminan todas las firmas guardadas. La
//              bóveda se bloquea sola por inactividad.
// ═════════════════════════════════════════════════════════════════════════════

const { app } = require('electron');
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// ── Política de seguridad ────────────────────────────────────────────────────

const VAULT_VERSION   = 1;
const MAX_FAILURES    = 5;                 // Contraseñas erróneas que provocan el borrado de las firmas…
const FAILURE_WINDOW  = 10 * 60 * 1000;    // …si ocurren dentro de esta ventana de tiempo (ms)
const IDLE_LOCK       = 10 * 60 * 1000;    // Inactividad tras la que la bóveda se bloquea sola (ms)
const MIN_PASSWORD    = 8;
const MAX_NAME        = 40;
const MAX_PNG_BYTES   = 5 * 1024 * 1024;

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
const VERIFIER_TEXT = 'imgpdf-toolbox-vault';

// ── Rutas ────────────────────────────────────────────────────────────────────

const vaultDir  = () => path.join(app.getPath('userData'), 'signature-vault');
const metaFile  = () => path.join(vaultDir(), 'vault.json');
const sigFile   = id => path.join(vaultDir(), `${id}.sig`);
// Carpeta donde la versión 1.7.0 guardaba las firmas sin cifrar (se migran al crear la bóveda)
const legacyDir = () => path.join(app.getPath('userData'), 'signatures');

const validId = id => /^[a-f0-9]{12}$/.test(String(id));

// ── Estado en memoria ────────────────────────────────────────────────────────

let key = null;          // Clave de cifrado: solo existe con la bóveda desbloqueada
let idleTimer = null;

// Cada operación reinicia el temporizador de inactividad
function touch() {
  clearTimeout(idleTimer);
  if (key) idleTimer = setTimeout(lock, IDLE_LOCK);
}

function lock() {
  key = null;
  clearTimeout(idleTimer);
}

// ── Cifrado ──────────────────────────────────────────────────────────────────

// Formato: iv (12 bytes) | etiqueta de autenticación (16 bytes) | texto cifrado
function encrypt(plain, k) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

// Lanza un error si la clave no es la correcta o el archivo fue alterado
function decrypt(blob, k) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, blob.subarray(0, 12));
  decipher.setAuthTag(blob.subarray(12, 28));
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]);
}

const deriveKey = (password, salt) => crypto.scryptSync(String(password), salt, 32, SCRYPT);

// ── Metadatos de la bóveda ───────────────────────────────────────────────────

function readMeta() {
  try {
    const meta = JSON.parse(fs.readFileSync(metaFile(), 'utf8'));
    return meta && meta.version === VAULT_VERSION ? meta : null;
  } catch (_) { return null; }
}

// Escritura atómica: un corte de luz nunca deja el archivo a medias
function writeMeta(meta) {
  const tmp = metaFile() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(meta), 'utf8');
  fs.renameSync(tmp, metaFile());
}

const recentFailures = meta => (meta.failures || []).filter(t => Date.now() - t < FAILURE_WINDOW);

// ── Estado y ciclo de vida ───────────────────────────────────────────────────

function status() {
  const meta = readMeta();
  return {
    exists: !!meta,
    unlocked: !!key,
    attemptsLeft: meta ? Math.max(0, MAX_FAILURES - recentFailures(meta).length) : MAX_FAILURES,
    maxFailures: MAX_FAILURES,
    windowMinutes: FAILURE_WINDOW / 60000,
    idleMinutes: IDLE_LOCK / 60000,
    minPassword: MIN_PASSWORD,
  };
}

// Elimina todas las firmas guardadas y la propia bóveda (y las copias sin cifrar heredadas)
function wipe() {
  lock();
  try { fs.rmSync(vaultDir(), { recursive: true, force: true }); } catch (_) {}
  try { fs.rmSync(legacyDir(), { recursive: true, force: true }); } catch (_) {}
}

// Crea la bóveda con una contraseña y la deja desbloqueada. Las firmas sin cifrar de la
// versión anterior se incorporan con su mismo id, de modo que las ya colocadas en documentos
// en curso siguen siendo válidas, y sus archivos originales se eliminan.
function create(password) {
  if (readMeta()) throw new Error('Ya existe una contraseña para tus firmas.');
  if (String(password || '').length < MIN_PASSWORD) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);

  fs.mkdirSync(vaultDir(), { recursive: true });
  const salt = crypto.randomBytes(16);
  key = deriveKey(password, salt);
  writeMeta({
    version: VAULT_VERSION, salt: salt.toString('base64'), failures: [],
    verifier: encrypt(Buffer.from(VERIFIER_TEXT), key).toString('base64'),
  });
  touch();
  migrateLegacy();
}

function migrateLegacy() {
  try {
    const dir = legacyDir();
    if (!fs.existsSync(dir)) return;
    let n = 0;
    for (const file of fs.readdirSync(dir)) {
      const id = file.replace(/\.png$/, '');
      if (!validId(id) || !file.endsWith('.png')) continue;
      const png = fs.readFileSync(path.join(dir, file));
      store(id, `Firma ${++n}`, png);
    }
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (_) { /* una firma heredada ilegible no impide crear la bóveda */ }
}

// Intenta desbloquear. Cada contraseña errónea se anota; al alcanzar el máximo dentro de la
// ventana de tiempo se eliminan todas las firmas.
function unlock(password) {
  const meta = readMeta();
  if (!meta) throw new Error('Aún no hay firmas protegidas.');
  if (key) { touch(); return { ok: true }; }

  const failures = recentFailures(meta);
  try {
    const candidate = deriveKey(password, Buffer.from(meta.salt, 'base64'));
    const check = decrypt(Buffer.from(meta.verifier, 'base64'), candidate);
    if (check.toString() !== VERIFIER_TEXT) throw new Error('verificador');
    key = candidate;
    writeMeta({ ...meta, failures: [] });
    touch();
    return { ok: true };
  } catch (_) {
    failures.push(Date.now());
    if (failures.length >= MAX_FAILURES) {
      wipe();
      return { ok: false, wiped: true, error: 'Demasiados intentos fallidos: se eliminaron todas las firmas guardadas.' };
    }
    writeMeta({ ...meta, failures });
    const attemptsLeft = MAX_FAILURES - failures.length;
    return { ok: false, attemptsLeft, error: `Contraseña incorrecta. Te quedan ${attemptsLeft} intento(s) antes de que se eliminen las firmas.` };
  }
}

function requireKey() {
  if (!key) { const e = new Error('Tus firmas están bloqueadas. Desbloquéalas con tu contraseña.'); e.locked = true; throw e; }
  touch();
}

// ── Firmas ───────────────────────────────────────────────────────────────────

// Tamaño de un PNG leyendo su cabecera IHDR
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504E47) throw new Error('El archivo no es una imagen PNG válida.');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

// Guarda una firma cifrada. Cada registro lleva su nombre, de modo que sin la contraseña no
// se puede saber ni cuántas ni cómo se llaman.
function store(id, name, png) {
  const { width, height } = pngSize(png);
  const record = { name, width, height, png: png.toString('base64') };
  fs.writeFileSync(sigFile(id), encrypt(Buffer.from(JSON.stringify(record)), key));
  return { id, name, width, height };
}

function readRecord(id) {
  if (!validId(id)) throw new Error('Firma no válida.');
  return JSON.parse(decrypt(fs.readFileSync(sigFile(id)), key).toString('utf8'));
}

// Valida y normaliza el nombre; no puede repetirse (sin distinguir mayúsculas)
function cleanName(name, ignoreId) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  if (!clean) throw new Error('Escribe un nombre para la firma.');
  if (clean.length > MAX_NAME) throw new Error(`El nombre no puede pasar de ${MAX_NAME} caracteres.`);
  if (list().some(s => s.id !== ignoreId && s.name.toLowerCase() === clean.toLowerCase())) throw new Error('Ya tienes una firma con ese nombre.');
  return clean;
}

function add(name, png) {
  requireKey();
  if (png.length > MAX_PNG_BYTES) throw new Error('La firma es demasiado grande.');
  pngSize(png);
  const clean = cleanName(name);
  return store(crypto.randomBytes(6).toString('hex'), clean, png);
}

// Firmas guardadas, ordenadas por nombre: solo datos, sin la imagen
function list() {
  requireKey();
  if (!fs.existsSync(vaultDir())) return [];
  return fs.readdirSync(vaultDir())
    .filter(f => f.endsWith('.sig') && validId(f.slice(0, -4)))
    .map(f => {
      const id = f.slice(0, -4);
      try { const { name, width, height } = readRecord(id); return { id, name, width, height }; } catch (_) { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// Imagen PNG de una firma
function getPng(id) {
  requireKey();
  return Buffer.from(readRecord(id).png, 'base64');
}

function remove(id) {
  requireKey();
  if (validId(id)) { try { fs.unlinkSync(sigFile(id)); } catch (_) {} }
}

module.exports = { status, create, unlock, lock, wipe, add, list, getPng, remove, requireKey };
