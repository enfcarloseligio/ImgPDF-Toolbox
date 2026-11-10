// ═════════════════════════════════════════════════════════════════════════════
// Archivo:     renderer/core/color-picker.js
// Descripción: Selector de color reutilizable. Combina el selector visual del sistema con
//              campos para escribir el color en hexadecimal, RGB (sRGB, 0–255) o HSL, de
//              modo que se puede elegir al ojo o indicar un tono exacto. Los tres formatos
//              se mantienen sincronizados. Los colores se manejan como «#rrggbb».
// ═════════════════════════════════════════════════════════════════════════════

// ── Conversiones de color ────────────────────────────────────────────────────

const colorClamp = (v, min, max) => Math.min(Math.max(Math.round(Number(v)) || 0, min), max);

// Normaliza «#abc», «abc» o «aabbcc» a «#aabbcc». Devuelve null si no es un hexadecimal válido.
function normalizeHex(text) {
  let h = String(text || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map(c => c + c).join('');
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toLowerCase()}` : null;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => colorClamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}

function rgbToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (d) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === R)      h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else                h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb({ h, s, l }) {
  const S = s / 100, L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
                  : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

// ── Componente ───────────────────────────────────────────────────────────────

// Crea el selector dentro de container. onChange(hex) se llama con cada cambio válido.
// Devuelve { getValue(), setValue(hex) }.
function createColorField(container, { value = '#000000', onChange = () => {} } = {}) {
  const num = (name, max, label) =>
    `<label class="cf-num">${label}<input type="number" class="num-input" data-cf="${name}" min="0" max="${max}"></label>`;

  container.classList.add('color-field');
  container.innerHTML = `
    <input type="color" class="cf-native" data-cf="native" title="Selector visual de color">
    <label class="cf-num cf-hexbox">HEX<input type="text" class="num-input cf-hex" data-cf="hex" maxlength="7" spellcheck="false" title="Hexadecimal: #rrggbb"></label>
    <span class="cf-group" title="RGB (sRGB, 0–255)">${num('r', 255, 'R')}${num('g', 255, 'G')}${num('b', 255, 'B')}</span>
    <span class="cf-group" title="HSL: tono (0–360°), saturación y luminosidad (%)">${num('h', 360, 'H')}${num('s', 100, 'S')}${num('l', 100, 'L')}</span>`;

  const part = name => container.querySelector(`[data-cf="${name}"]`);
  let current = normalizeHex(value) || '#000000';

  // Pinta todos los campos con el color actual, salvo el que el usuario está escribiendo
  function paint() {
    const rgb = hexToRgb(current), hsl = rgbToHsl(rgb);
    const values = { native: current, hex: current, ...rgb, ...hsl };
    for (const [name, v] of Object.entries(values)) {
      const el = part(name);
      if (el !== document.activeElement) el.value = v;
    }
  }

  function set(hex, notify) {
    current = hex;
    paint();
    if (notify) onChange(current);
  }

  part('native').addEventListener('input', e => set(e.target.value.toLowerCase(), true));
  part('hex').addEventListener('input', e => { const h = normalizeHex(e.target.value); if (h) set(h, true); });
  part('hex').addEventListener('blur', paint);

  ['r', 'g', 'b'].forEach(name => part(name).addEventListener('input', () =>
    set(rgbToHex({ r: part('r').value, g: part('g').value, b: part('b').value }), true)));
  ['h', 's', 'l'].forEach(name => part(name).addEventListener('input', () =>
    set(rgbToHex(hslToRgb({ h: colorClamp(part('h').value, 0, 360), s: colorClamp(part('s').value, 0, 100), l: colorClamp(part('l').value, 0, 100) })), true)));
  container.querySelectorAll('input[type="number"]').forEach(el => el.addEventListener('blur', paint));

  paint();
  return { getValue: () => current, setValue: hex => { const h = normalizeHex(hex); if (h) set(h, false); } };
}
