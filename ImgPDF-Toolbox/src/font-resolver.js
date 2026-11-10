// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/font-resolver.js
// Descripción: Resolución de variantes de una fuente. ImageMagick estampa el texto con un
//              archivo de fuente concreto, que es un único peso y estilo: las opciones
//              -weight y -style no tienen efecto sobre él. Este módulo lee de cada fuente
//              instalada (o descargada) su familia, peso y cursiva, y dado un archivo
//              elegido devuelve el de su misma familia que mejor corresponde al peso y la
//              cursiva pedidos (p. ej. arial.ttf + negrita → arialbd.ttf).
// ═════════════════════════════════════════════════════════════════════════════

const { app } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ── Constantes ───────────────────────────────────────────────────────────────

const FONT_EXTENSIONS = new Set(['.ttf', '.otf']);
const MAX_NAME_TABLE  = 512 * 1024;

// Fuente que ImageMagick usa cuando no se indica ninguna
const DEFAULT_FONT = path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', 'arial.ttf');

// Carpetas donde se buscan variantes: sistema, usuario y fuentes descargadas de Google Fonts
const fontDirs = () => [
  path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
  path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts'),
  path.join(app.getPath('userData'), 'fonts'),
];

// ── Lectura de los metadatos de una fuente ───────────────────────────────────

// Texto de un registro de la tabla «name»: UTF-16 (plataformas Windows y Unicode) o Latin-1 (Mac)
function decodeName(buf, platform) {
  if (platform === 3 || platform === 0) {
    const swapped = Buffer.from(buf);
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  return buf.toString('latin1');
}

// Familia, nombre completo, peso (100–900), ancho (1–9; 5 = normal) y cursiva de un archivo TTF/OTF;
// null si no se puede leer.
function readFontInfo(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const read = (length, position) => {
      const buf = Buffer.alloc(length);
      const n = fs.readSync(fd, buf, 0, length, position);
      return n === length ? buf : buf.subarray(0, n);
    };

    let base = 0;
    let header = read(12, 0);
    if (header.toString('latin1', 0, 4) === 'ttcf') {      // Colección: se usa la primera fuente
      base = read(4, 12).readUInt32BE(0);
      header = read(12, base);
    }
    const numTables = header.readUInt16BE(4);
    const directory = read(numTables * 16, base + 12);

    const tables = {};
    for (let i = 0; i < numTables; i++) {
      const rec = directory.subarray(i * 16, i * 16 + 16);
      tables[rec.toString('latin1', 0, 4)] = { offset: rec.readUInt32BE(8), length: rec.readUInt32BE(12) };
    }

    // Peso y cursiva: tabla OS/2 (usWeightClass, fsSelection) y, si falta, head (macStyle)
    let weight = 400, width = 5, italic = false;
    if (tables['OS/2'] && tables['OS/2'].length >= 64) {
      const os2 = read(64, tables['OS/2'].offset);
      weight = os2.readUInt16BE(4) || 400;
      width = os2.readUInt16BE(6) || 5;
      italic = !!(os2.readUInt16BE(62) & 1);
    } else if (tables.head) {
      italic = !!(read(46, tables.head.offset).readUInt16BE(44) & 2);
    }

    // Nombres: familia tipográfica (16) o familia (1); nombre completo (4)
    const names = {};
    if (tables.name && tables.name.length <= MAX_NAME_TABLE) {
      const table = read(tables.name.length, tables.name.offset);
      const count = table.readUInt16BE(2), stringOffset = table.readUInt16BE(4);
      for (let i = 0; i < count; i++) {
        const r = table.subarray(6 + i * 12, 18 + i * 12);
        const platform = r.readUInt16BE(0), id = r.readUInt16BE(6);
        if ((id !== 1 && id !== 4 && id !== 16) || (names[id] && platform !== 3)) continue;
        const text = decodeName(table.subarray(stringOffset + r.readUInt16BE(10), stringOffset + r.readUInt16BE(10) + r.readUInt16BE(8)), platform).trim();
        if (text) names[id] = text;
      }
    }

    const family = names[16] || names[1];
    if (!family) return null;
    return { family, name: names[4] || family, weight, width, italic };
  } catch (_) {
    return null;
  } finally {
    if (fd !== undefined) { try { fs.closeSync(fd); } catch (_) {} }
  }
}

// ── Índice de familias ───────────────────────────────────────────────────────

let families = null;   // familia (minúsculas) → [{ path, name, weight, italic }]
let infoByPath = null; // ruta → información de la fuente

// Recorre las carpetas de fuentes una sola vez; la información de cada archivo se guarda en
// disco (con su fecha y tamaño) para que las siguientes ejecuciones no relean todas las fuentes.
function buildIndex() {
  if (families) return;

  const cacheFile = path.join(app.getPath('userData'), 'font-index.json');
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (_) {}

  const fresh = {};
  let changed = false;
  families = new Map();
  infoByPath = new Map();

  for (const dir of fontDirs()) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch (_) { continue; }
    for (const file of entries) {
      if (!FONT_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      const full = path.join(dir, file);
      let stat;
      try { stat = fs.statSync(full); } catch (_) { continue; }

      const cached = cache[full];
      let info;
      // Las entradas guardadas por versiones anteriores sin «width» se vuelven a leer
      if (cached && cached.mtime === stat.mtimeMs && cached.size === stat.size && (!cached.info || cached.info.width !== undefined)) info = cached.info;
      else { info = readFontInfo(full); changed = true; }

      fresh[full] = { mtime: stat.mtimeMs, size: stat.size, info };
      if (!info) continue;
      infoByPath.set(full.toLowerCase(), info);
      const key = info.family.toLowerCase();
      if (!families.has(key)) families.set(key, []);
      families.get(key).push({ path: full, name: info.name, weight: info.weight, width: info.width, italic: info.italic });
    }
  }

  if (changed || Object.keys(cache).length !== Object.keys(fresh).length) {
    try { fs.writeFileSync(cacheFile, JSON.stringify(fresh), 'utf8'); } catch (_) {}
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

// Información de una fuente: { family, name, weight, italic } o null
function fontInfo(file) {
  buildIndex();
  return infoByPath.get(String(file).toLowerCase()) || readFontInfo(file);
}

// Devuelve { path, name, weight, italic } de la variante de la familia de fontPath más cercana al
// peso y la cursiva pedidos, conservando su ancho (una fuente condensada sigue siendo condensada). Sin fontPath parte de la fuente predeterminada (Arial). Si no
// puede resolver nada devuelve la ruta tal cual (o null si no había ninguna).
function resolveFont({ fontPath, weight = 400, italic = false } = {}) {
  buildIndex();
  const base = fontPath || (fs.existsSync(DEFAULT_FONT) ? DEFAULT_FONT : null);
  if (!base) return { path: null, name: null };

  const info = infoByPath.get(base.toLowerCase()) || readFontInfo(base);
  const members = info && families.get(info.family.toLowerCase());
  if (!members || !members.length) return { path: base, name: info ? info.name : null, weight: info?.weight, italic: info?.italic };

  const wanted = Math.min(Math.max(Number(weight) || 400, 100), 900);
  const sameWidth = members.filter(m => m.width === info.width);
  const widthPool = sameWidth.length ? sameWidth : members;
  const sameStyle = widthPool.filter(m => m.italic === !!italic);
  const pool = sameStyle.length ? sameStyle : widthPool;

  // El peso más cercano; con la misma distancia, el más pesado
  const best = pool.reduce((a, b) => {
    const da = Math.abs(a.weight - wanted), db = Math.abs(b.weight - wanted);
    return db < da || (db === da && b.weight > a.weight) ? b : a;
  });
  return best;
}

module.exports = { fontInfo, resolveFont };
