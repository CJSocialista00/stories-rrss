import { brandColor } from '../engine/fontSets.js';
import { ensureFonts } from '../engine/fonts.js';
import { makeImageLayer } from '../engine/layerFactory.js';

// Logotipo de las AJT con el nombre de la ubicación editable. Se dibuja en un
// canvas con las medidas de la plantilla PSD original (logos_editable.psd,
// píxeles de las exportaciones de 6455×579 y 3827×951): Open Sauce Sans Bold
// para la ubicación y Medium para «Asamblea de la juventud trabajadora»; los
// dos triángulos son las formas originales, que se tiñen del color elegido.
// Colores: manual de uso de la línea gráfica (rojo, crema, negro).

const FAMILY = 'AJT Open Sauce Sans';
const SUBTITLE = ['Asamblea de la', 'juventud trabajadora'];

const ICON_SRC = {
  big: './assets/logos/ajt/triangulo-grande.png',
  small: './assets/logos/ajt/triangulo-pequeno.png',
};
const ICON_W = 1010;
const ICON_H = 689;

// Medidas de cada composición (px de la plantilla)
const LAYOUTS = {
  // ubicación · icono · texto, en una línea
  h: {
    label: 'Horizontal',
    locSize: 378.2, subSize: 270.2, subLeading: 315.2, subWeight: 400, // en el PSD, Regular
    iconScale: 578 / ICON_W, iconY: 109,
    gapLocIcon: 433, gapIconText: 435,
    locBaseline: 411, subBaseline: 210, height: 579,
  },
  // icono a la izquierda; texto y ubicación apilados a la derecha
  v: {
    label: 'Apilado',
    locSize: 315.5, subSize: 244.7, subLeading: 282.5, subWeight: 500, // Medium
    iconScale: 1, iconY: 117,
    textX: 1390, locX: 1387,
    locBaseline: 951, subBaseline: 190, height: 951,
  },
};

// Combinaciones permitidas según el color del fondo (manual, p. 13)
export const AJT_LOGO_VARIANTS = [
  { key: 'crema', label: 'Fondo crema', text: 'dark', big: 'accent', small: 'dark', bg: 'cream' },
  { key: 'negro', label: 'Fondo negro', text: 'cream', big: 'accent', small: 'cream', bg: 'dark' },
  { key: 'rojo-crema', label: 'Fondo rojo · crema', text: 'cream', big: 'cream', small: 'cream', bg: 'accent' },
  { key: 'rojo-negro', label: 'Fondo rojo · negro', text: 'dark', big: 'dark', small: 'dark', bg: 'accent' },
];
export const AJT_LOGO_LAYOUTS = Object.entries(LAYOUTS).map(([key, l]) => ({ key, label: l.label }));
export const AJT_LOGO_DEFAULTS = { ajtText: 'Carabanchel', ajtLayout: 'h', ajtVariant: 'crema' };

export function ajtVariant(key) {
  return AJT_LOGO_VARIANTS.find((v) => v.key === key) || AJT_LOGO_VARIANTS[0];
}
// colores siempre los de AJT, aunque la marca activa sea otra
export const ajtColor = (role) => brandColor(role, 'ajt');

const masks = {};
function loadMask(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Fuentes y triángulos deben estar listos antes de dibujar (el dibujo es síncrono)
export async function ensureAjtLogoAssets() {
  await ensureFonts([`400 100px "${FAMILY}"`, `500 100px "${FAMILY}"`, `700 100px "${FAMILY}"`]);
  await Promise.all(Object.entries(ICON_SRC).map(async ([k, src]) => {
    if (!masks[k]) masks[k] = await loadMask(src);
  }));
}

function tinted(mask, color, w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(mask, 0, 0, c.width, c.height);
  return c;
}

/**
 * Dibuja el logotipo. Devuelve { canvas, width, height }.
 * `ensureAjtLogoAssets()` debe haberse esperado antes.
 */
export function drawAjtLogo({ ajtText, ajtLayout, ajtVariant: variantKey } = {}) {
  const L = LAYOUTS[ajtLayout] || LAYOUTS.h;
  const v = ajtVariant(variantKey);
  const loc = (ajtText || '').trim() || 'Ubicación';
  const measure = document.createElement('canvas').getContext('2d');
  const setFont = (ctx, weight, size) => {
    ctx.font = `${weight} ${size}px "${FAMILY}"`;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  };

  setFont(measure, 700, L.locSize);
  const lm = measure.measureText(loc);
  const locLeft = lm.actualBoundingBoxLeft; // tinta a la izquierda del origen
  const locInkW = lm.actualBoundingBoxRight + lm.actualBoundingBoxLeft;
  setFont(measure, L.subWeight, L.subSize);
  const subW = Math.max(...SUBTITLE.map((t) => measure.measureText(t).actualBoundingBoxRight));

  const iconW = ICON_W * L.iconScale;
  const iconH = ICON_H * L.iconScale;
  let locX; let iconX; let subX; let width;
  if (ajtLayout === 'v') {
    iconX = 0; subX = L.textX; locX = L.locX + locLeft;
    width = Math.max(subX + subW, L.locX + locInkW);
  } else {
    locX = locLeft; iconX = locInkW + L.gapLocIcon; subX = iconX + iconW + L.gapIconText;
    width = subX + subW;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = L.height;
  const ctx = canvas.getContext('2d');
  ctx.textRendering = 'geometricPrecision';

  ctx.drawImage(tinted(masks.big, ajtColor(v.big), iconW, iconH), iconX, L.iconY);
  ctx.drawImage(tinted(masks.small, ajtColor(v.small), iconW, iconH), iconX, L.iconY);

  ctx.fillStyle = ajtColor(v.text);
  setFont(ctx, 700, L.locSize);
  ctx.fillText(loc, locX, L.locBaseline);
  setFont(ctx, L.subWeight, L.subSize);
  SUBTITLE.forEach((t, i) => ctx.fillText(t, subX, L.subBaseline + i * L.subLeading));
  return { canvas, width: canvas.width, height: canvas.height };
}

export function buildAjtLogoDoc() {
  return {
    canvas: { width: 6455, height: 579 },
    templateName: 'Logo AJT · editable',
    quickGenerator: 'logoAjt',
    layers: [
      {
        ...makeImageLayer({ name: 'Logo AJT', src: null, fit: 'contain', locked: true, x: 0, y: 0, width: 6455, height: 579 }),
        ...AJT_LOGO_DEFAULTS,
      },
    ],
  };
}
