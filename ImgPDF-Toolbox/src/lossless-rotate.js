// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     src/lossless-rotate.js
// Descripción: Giro sin pérdida de JPG. En lugar de decodificar y volver a comprimir la imagen
//              (lo que degradaría la calidad), se cambia solo la etiqueta de orientación EXIF:
//              los datos de la imagen quedan byte por byte como estaban y los visores la
//              muestran girada. No depende de Electron, por lo que puede probarse aislada.
// ═════════════════════════════════════════════════════════════════════════════

// ── Orientación EXIF ─────────────────────────────────────────────────────────

const TAG_ORIENTATION = 0x0112;

// Orientación resultante tras girar 90° a la derecha (valores EXIF 1–8, incluidos los espejados).
const AFTER_CW90 = { 1: 6, 2: 7, 3: 8, 4: 5, 5: 2, 6: 3, 7: 4, 8: 1 };

// Orientación tras girar angle grados (90, 180 o 270) a la derecha desde la orientación actual.
function rotatedOrientation(current, angle) {
  let o = AFTER_CW90[current] ? current : 1;
  for (let i = 0; i < Math.round(angle / 90) % 4; i++) o = AFTER_CW90[o];
  return o;
}

// ── Lectura de segmentos JPEG ────────────────────────────────────────────────

// Segmentos de metadatos al inicio del archivo: { marker, start, end } hasta el inicio de la imagen.
function readSegments(buf) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) throw new Error('El archivo no es un JPG válido.');
  const segments = [];
  let pos = 2;
  while (pos + 4 <= buf.length && buf[pos] === 0xFF) {
    const marker = buf[pos + 1];
    if (marker === 0xDA || marker === 0xD9) break;           // Inicio de la imagen o fin del archivo
    const length = buf.readUInt16BE(pos + 2);
    segments.push({ marker, start: pos, end: pos + 2 + length });
    pos += 2 + length;
  }
  return segments;
}

// Segmento APP1 con datos EXIF, si existe.
const findExif = (buf, segments) =>
  segments.find(s => s.marker === 0xE1 && buf.toString('latin1', s.start + 4, s.start + 10) === 'Exif\0\0');

// Posición del valor de la etiqueta de orientación dentro de un segmento EXIF, o null si no la tiene.
function findOrientationField(buf, seg) {
  const tiff = seg.start + 10;
  const bom  = buf.toString('latin1', tiff, tiff + 2);
  if (bom !== 'II' && bom !== 'MM') return null;
  const little = bom === 'II';
  const u16 = p => (little ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
  const u32 = p => (little ? buf.readUInt32LE(p) : buf.readUInt32BE(p));

  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > seg.end) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > seg.end) return null;
    if (u16(entry) === TAG_ORIENTATION) return { pos: entry + 8, little, value: u16(entry + 8) };
  }
  return null;
}

// APP1 mínimo con solo la orientación (para JPG sin EXIF).
function minimalExif(orientation) {
  const b = Buffer.alloc(36);
  b.writeUInt16BE(0xFFE1, 0);
  b.writeUInt16BE(34, 2);                    // Longitud del segmento, sin contar el marcador
  b.write('Exif\0\0', 4, 'latin1');
  b.write('MM', 10, 'latin1');               // Big endian
  b.writeUInt16BE(0x002A, 12);
  b.writeUInt32BE(8, 14);                    // Primer IFD justo tras la cabecera
  b.writeUInt16BE(1, 18);                    // Una entrada
  b.writeUInt16BE(TAG_ORIENTATION, 20);
  b.writeUInt16BE(3, 22);                    // Tipo SHORT
  b.writeUInt32BE(1, 24);
  b.writeUInt16BE(orientation, 28);
  b.writeUInt32BE(0, 32);                    // Sin más IFD
  return b;
}

// ── Giro ─────────────────────────────────────────────────────────────────────

// Devuelve el JPG girado angle grados a la derecha (90, 180 o 270) sin tocar los datos de la
// imagen: solo cambia (o añade) la orientación EXIF.
function rotateJpegBuffer(buf, angle) {
  const segments = readSegments(buf);
  const exif = findExif(buf, segments);
  const field = exif ? findOrientationField(buf, exif) : null;

  // Caso habitual: el JPG ya trae la etiqueta y se reescribe en su sitio (mismo tamaño)
  if (field) {
    const out = Buffer.from(buf);
    const next = rotatedOrientation(field.value, angle);
    if (field.little) out.writeUInt16LE(next, field.pos); else out.writeUInt16BE(next, field.pos);
    return out;
  }

  // Sin etiqueta: se inserta un APP1 mínimo (sustituyendo el EXIF si no tenía orientación)
  const orientation = rotatedOrientation(1, angle);
  const app1 = minimalExif(orientation);
  if (exif) return Buffer.concat([buf.subarray(0, exif.start), app1, buf.subarray(exif.end)]);

  const app0 = segments.find(s => s.marker === 0xE0);
  const at = app0 ? app0.end : 2;
  return Buffer.concat([buf.subarray(0, at), app1, buf.subarray(at)]);
}

module.exports = { rotateJpegBuffer, rotatedOrientation };
