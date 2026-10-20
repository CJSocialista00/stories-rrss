import { FONT_WIDTH_VARIANTS } from './constants.js';

// Juegos de tipografía por organización. Las plantillas no cambian: cada capa
// sigue diciendo "título" o "cuerpo" (y ancho/peso/cursiva si hace falta) y es
// el juego activo el que decide qué familia real se dibuja.
//  - CJS: Acumin Variable (ancho × peso × cursiva, ver src/fonts.css).
//  - OES: Made Outer Sans Regular (texto) y Bold (destacados), Mozilla Text
//    (cuerpo) y títulos destacados con la inicial en Clandy Italic.
//  - AJT: Helvetica Neue Roman (texto) y Bold (negrita del cuerpo, también el
//    **así**), Thunder Extra Bold (títulos) y Helvetica Neue Black Condensed
//    (rótulo alternativo) y PP Playground Medium (títulos). Cursivas reales,
//    salvo PP Playground y las de OES, que son oblicuas de 12° generadas.
// OES y AJT tienen pocos cortes, así que "ancho" y "peso" se resuelven por
// la propia regla de CSS (peso más cercano disponible de la familia).

const STORAGE_KEY = 'rrss_fontset_v1';

const isNormalWidth = (widthKey) => widthKey === 'normal' || widthKey === 'wide';

// Paleta de cada marca. "key" enlaza el mismo papel entre marcas (rojo de
// acento, blanco, negro) para poder traducir los colores de un diseño al
// cambiar de marca; los colores sin pareja (turquesa de OES, crema de AJT)
// se quedan tal cual.
const palette = (...entries) => entries.map(([key, label, hex]) => ({ key, label, hex }));

const condensedWide = (condensed, normal) => ({
  extracondensed: condensed, condensed, semicondensed: condensed, normal, wide: normal,
});

export const FONT_SETS = {
  cjs: {
    key: 'cjs',
    label: 'CJS',
    detail: 'Acumin',
    titleTracking: -0.028,
    colors: palette(['white', 'Blanco', '#ffffff'], ['accent', 'Rojo', '#f54949'], ['dark', 'Negro', '#282929']),
  },
  oes: {
    key: 'oes',
    label: 'OES',
    detail: 'Made Outer Sans',
    titleTracking: 0,
    colors: palette(['white', 'Blanco', '#ffffff'], ['accent', 'Rojo', '#ff4331'], ['dark', 'Negro', '#000000'], ['teal', 'Turquesa', '#1adcc8']),
    families: { ...condensedWide('OES Made Outer Sans', 'OES Made Outer Sans'), mozilla: 'OES Mozilla Text' },
    // primera letra de los títulos destacados en otra fuente: se dibuja más
    // grande (scale), con el pie algo más bajo (drop, en veces el cuerpo del
    // título) y pegada a la letra siguiente; medido sobre el ejemplo de OES.
    initialFonts: {
      clandy: { family: 'OES Clandy', weight: 400, style: 'italic', scale: 1.5, drop: 0.11, gap: -0.04 },
    },
    // cortes que se ofrecen en el panel de texto (en vez de ancho + peso)
    styles: [
      { key: 'regular', label: 'Regular', patch: { widthVariant: 'normal', weight: 400, bold: false, initialFont: null }, isActive: (d, w, widthKey) => widthKey !== 'mozilla' && !d.initialFont && w < 600 },
      { key: 'bold', label: 'Bold', patch: { widthVariant: 'normal', weight: 700, bold: true, initialFont: null }, isActive: (d, w, widthKey) => widthKey !== 'mozilla' && !d.initialFont && w >= 600 },
      { key: 'clandy', label: 'Inicial Clandy', titleOnly: true, patch: { widthVariant: 'normal', weight: 700, bold: true, initialFont: 'clandy' }, isActive: (d) => !!d.initialFont },
      { key: 'mozilla', label: 'Mozilla Text', patch: { widthVariant: 'mozilla', weight: 400, bold: false, initialFont: null }, isActive: (d, w, widthKey) => widthKey === 'mozilla' },
    ],
  },
  ajt: {
    key: 'ajt',
    label: 'AJT',
    detail: 'Helvetica Neue · Thunder',
    titleTracking: -0.01,
    colors: palette(['white', 'Blanco', '#ffffff'], ['accent', 'Rojo', '#f42a39'], ['dark', 'Negro', '#000000'], ['cream', 'Crema', '#f3f3e9']),
    // la caligráfica no se lee en mayúsculas: el sticker de título respeta lo escrito
    keepCaseWidths: ['playground'],
    // el ancho elige la familia: extracondensed (título por defecto) = Thunder
    families: {
      extracondensed: 'AJT Thunder',
      condensed: 'AJT Helvetica Neue Condensed',
      semicondensed: 'AJT Helvetica Neue Condensed',
      normal: 'AJT Helvetica Neue',
      wide: 'AJT Helvetica Neue',
      playground: 'AJT PP Playground',
    },
    styles: [
      { key: 'roman', label: 'Roman', patch: { widthVariant: 'normal', weight: 400, bold: false }, isActive: (d, w, widthKey) => isNormalWidth(widthKey) && w < 600 },
      { key: 'bold', label: 'Bold', patch: { widthVariant: 'normal', weight: 700, bold: true }, isActive: (d, w, widthKey) => isNormalWidth(widthKey) && w >= 600 },
      { key: 'thunder', label: 'Thunder', patch: { widthVariant: 'extracondensed', weight: 800, bold: true }, isActive: (d, w, widthKey) => widthKey === 'extracondensed' },
      { key: 'blackcn', label: 'Black Cond.', patch: { widthVariant: 'condensed', weight: 800, bold: true }, isActive: (d, w, widthKey) => widthKey === 'condensed' || widthKey === 'semicondensed' },
      { key: 'playground', label: 'PP Playground', patch: { widthVariant: 'playground', weight: 500, bold: false }, isActive: (d, w, widthKey) => widthKey === 'playground' },
    ],
  },
};

// Archivos de las familias que no son de Acumin (mismo esquema que fonts.css)
export const FONT_FILES = {
  'OES Made Outer Sans': { dir: 'oes', base: 'made-outer-sans', weights: [400, 700] },
  'AJT Helvetica Neue': { dir: 'ajt', base: 'helvetica-neue', weights: [400, 700] },
  'AJT Helvetica Neue Condensed': { dir: 'ajt', base: 'helvetica-neue-condensed', weights: [900] },
  'AJT Thunder': { dir: 'ajt', base: 'thunder-extrabold', weights: [800] },
  'AJT PP Playground': { dir: 'ajt', base: 'pp-playground', weights: [500] },
  'OES Mozilla Text': { dir: 'oes', base: 'mozilla-text', weights: [400, 700] },
  'OES Clandy': { dir: 'oes', base: 'clandy', weights: [400] },
};

let currentKey = 'cjs';
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && FONT_SETS[saved]) currentKey = saved;
} catch { /* almacenamiento no disponible */ }

export function getFontSetKey() { return currentKey; }
export function currentFontSet() { return FONT_SETS[currentKey]; }

export function setFontSetKey(key) {
  if (!FONT_SETS[key]) return;
  currentKey = key;
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* ignorar */ }
}

// { key, label, family, familyItalic } del ancho pedido en el juego activo
export function getWidthVariant(widthKey) {
  const set = currentFontSet();
  if (set.families) {
    const family = set.families[widthKey] || set.families.normal;
    return { key: widthKey, label: widthKey, family, familyItalic: family };
  }
  return FONT_WIDTH_VARIANTS.find((v) => v.key === widthKey) || FONT_WIDTH_VARIANTS[3];
}

// ---- colores de marca ----
export function brandColors(setKey = currentKey) { return FONT_SETS[setKey].colors; }
export function brandColor(colorKey, setKey = currentKey) {
  const c = brandColors(setKey).find((x) => x.key === colorKey);
  return c ? c.hex : undefined;
}
export function brandHexes(setKey = currentKey) { return brandColors(setKey).map((c) => c.hex); }

// El mismo papel (acento, blanco, negro) en otra marca; si no hay pareja o no
// es un color de marca, se devuelve igual.
export function mapBrandColor(hex, fromKey, toKey) {
  if (typeof hex !== 'string' || fromKey === toKey || !FONT_SETS[fromKey] || !FONT_SETS[toKey]) return hex;
  const from = brandColors(fromKey).find((c) => c.hex === hex.toLowerCase());
  const to = from && brandColors(toKey).find((c) => c.key === from.key);
  return to ? to.hex : hex;
}

// Cambios de color que necesita una capa al pasar de una marca a otra, o null
export function recolorPatch(layer, fromKey, toKey) {
  const patch = {};
  ['color', 'tint', 'galleryColor'].forEach((f) => {
    const mapped = mapBrandColor(layer[f], fromKey, toKey);
    if (mapped !== layer[f]) patch[f] = mapped;
  });
  return Object.keys(patch).length ? patch : null;
}

// ¿El sticker de título pasa el texto a mayúsculas con esta letra?
export function titleUppercase(widthKey) {
  const set = currentFontSet();
  return !(set.keepCaseWidths && set.keepCaseWidths.includes(widthKey));
}

// Fuente de la inicial de un título destacado (solo existe en OES) o null
export function getInitialFont(d) {
  const set = currentFontSet();
  return (d && d.initialFont && set.initialFonts && set.initialFonts[d.initialFont]) || null;
}

// Familia del rótulo grande (la que usan ubicación y sticker de título)
export function titleFamily() {
  return getWidthVariant('extracondensed').family;
}

// Peso realmente declarado en la familia que mejor casa con el pedido, con la
// misma regla de CSS que aplica el navegador; así la carga bajo demanda pide
// exactamente el archivo que luego se dibujará.
export function snapWeight(family, wanted) {
  const info = FONT_FILES[family];
  if (!info) return wanted;
  const avail = info.weights;
  if (avail.includes(wanted)) return wanted;
  const below = avail.filter((w) => w < wanted).sort((a, b) => b - a);
  const above = avail.filter((w) => w > wanted).sort((a, b) => a - b);
  if (wanted < 400) return below[0] ?? above[0];
  if (wanted > 500) return above[0] ?? below[0];
  const upTo500 = above.filter((w) => w <= 500);
  return upTo500[0] ?? below[0] ?? above[0];
}
