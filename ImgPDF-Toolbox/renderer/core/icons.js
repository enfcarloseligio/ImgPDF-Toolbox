// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/icons.js
// Descripción: Carga y cachea los iconos SVG (assets/svg/*.svg). Todos usan currentColor,
//              por lo que heredan el color del texto.
//
//              Uso:
//                icon('trash', 16)                  → SVG inline para plantillas
//                iconLabel('folder-open', 'Abrir')  → icono + texto
//                <span data-icon="alert" data-size="18"></span> → HTML estático (se hidrata solo)
// ═════════════════════════════════════════════════════════════════════════════

const ICON_CACHE = {};

const ICON_LIST = [
  // Navegación / categorías
  'pdf-tools', 'image-tools', 'update', 'back',
  'arrow-up', 'arrow-down', 'arrow-right', 'drag-handle', 'close',
  // Archivos y carpetas
  'folder', 'folder-open', 'trash', 'file', 'pdf-file', 'image-file', 'download',
  // Herramientas
  'merge', 'scissors', 'compress', 'hash', 'droplet', 'tag', 'rotate',
  'unlock', 'lock', 'key', 'clipboard-check',
  // Estado y avisos
  'check', 'check-circle', 'x-circle', 'alert', 'info', 'lightbulb', 'loader',
  // Opciones
  'eye', 'eye-off', 'monitor', 'globe', 'book', 'printer', 'award', 'crosshair',
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
  hydrateIcons();
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
  // Inyecta width/height y la clase .ic sin duplicar atributos
  return svg.replace(
    /<svg\b([^>]*)>/,
    (match, attrs) => {
      const cleaned = attrs
        .replace(/\s*width="[^"]*"/g, '')
        .replace(/\s*height="[^"]*"/g, '');
      return `<svg class="ic" width="${size}" height="${size}"${cleaned}>`;
    }
  );
}

/** Icono seguido de texto (botones, títulos, items de resultado). */
function iconLabel(name, text, size = 16) {
  return `${icon(name, size)} ${text}`;
}

/** Rellena los <span data-icon="..."> del HTML estático (splash, header). */
function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(el => {
    el.innerHTML = icon(el.dataset.icon, parseInt(el.dataset.size, 10) || 16);
  });
}

// Preload al cargar el script (no bloquea)
preloadIcons();
