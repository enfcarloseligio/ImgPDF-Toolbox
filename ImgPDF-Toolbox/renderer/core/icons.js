// ── core/icons.js ─────────────────────────────────────────────────────────────
// Carga y cachea los iconos SVG para que se vean idénticos en cualquier equipo.
// Los iconos se cargan una sola vez al arrancar la app.

const ICON_CACHE = {};

const ICON_LIST = [
  'pdf-tools',
  'image-tools',
  'update',
  'back',
  'arrow-up',
  'arrow-down',
  'drag-handle',
  'close',
];

async function preloadIcons() {
  await Promise.all(ICON_LIST.map(async (name) => {
    try {
      const res = await fetch(`assets/svg/${name}.svg`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ICON_CACHE[name] = await res.text();
    } catch (e) {
      console.warn(`No se pudo cargar el icono "${name}":`, e);
      ICON_CACHE[name] = '';
    }
  }));
}

/**
 * Devuelve el SVG inline del icono solicitado.
 * @param {string} name  Nombre del icono (sin extensión)
 * @param {number} size  Tamaño en píxeles (ancho y alto)
 * @returns {string}     SVG listo para insertar en HTML
 */
function icon(name, size = 24) {
  const svg = ICON_CACHE[name];
  if (!svg) return '';
  // Inyecta width/height sin duplicar atributos
  return svg.replace(
    /<svg\b([^>]*)>/,
    (match, attrs) => {
      const cleaned = attrs
        .replace(/\s*width="[^"]*"/g, '')
        .replace(/\s*height="[^"]*"/g, '');
      return `<svg width="${size}" height="${size}"${cleaned}>`;
    }
  );
}

// Preload al cargar el script (no bloquea)
preloadIcons();