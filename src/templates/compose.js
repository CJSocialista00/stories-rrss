import { getState, addLayer, updateLayer } from '../engine/state.js';
import { makeTextLayer, makeImageLayer } from '../engine/layerFactory.js';
import { brandColor, getWidthVariant, titleFamily } from '../engine/fontSets.js';
import { computeTextTitleGeometry, computeLocationGeometry } from './locationGenerator.js';
import { layoutRichText, bodyWeights } from '../engine/richText.js';
import { ensureFonts, fontSpecsForState } from '../engine/fonts.js';
import { PIN_VARIANTS } from '../engine/stageRenderer.js';
import { drawAjtLogo, ensureAjtLogoAssets, AJT_LOGO_DEFAULTS } from './ajtLogo.js';

// «Imagen + stickers»: una foto como marco y, encima, stickers y textos que se
// mueven con el dedo y se colocan con botones (esquinas, centro…). Cada
// sticker es una capa normal del documento con unos campos `cmp*` que dicen
// qué es y permiten editarlo después (texto, color, tamaño).

export const COMPOSE_DEFAULT_SIZE = { width: 1080, height: 1350 };

export function buildComposeDoc() {
  const { width, height } = COMPOSE_DEFAULT_SIZE;
  return {
    canvas: { width, height },
    templateName: 'Imagen + stickers',
    quickGenerator: 'compose',
    layers: [
      { ...makeImageLayer({ name: 'Foto', src: null, fit: 'cover', locked: true, x: 0, y: 0, width, height }), composeBase: true },
    ],
  };
}

export const isComposeBase = (l) => !!(l && l.composeBase);
const canvas = () => getState().canvas;
const baseUnit = () => Math.min(canvas().width, canvas().height);

// centro del lienzo menos la mitad de la caja, con un desfase por sticker para
// que varios añadidos seguidos no queden exactamente apilados
function centered(w, h) {
  const n = getState().layers.length;
  const off = ((n - 1) % 5) * baseUnit() * 0.03;
  return { x: (canvas().width - w) / 2 + off, y: (canvas().height - h) / 2 + off };
}

// ---- título ----
export async function addTitleSticker(text = 'TÍTULO') {
  const capH = baseUnit() * 0.07;
  const layer = await titleLayer(text, capH, brandColor('white'));
  addLayer(layer);
  return layer;
}
async function titleLayer(text, capH, color) {
  await ensureFonts(fontSpecsForState({ layers: [{ type: 'text', role: 'title', italic: true }] }));
  const g = computeTextTitleGeometry(text, { H: capH });
  const pos = centered(g.textW, g.textH);
  return {
    ...makeTextLayer({
      name: 'Título', role: 'title', italic: true, locked: false, autoFit: false, text: g.text, color, align: 'left',
      x: pos.x, y: pos.y, width: g.textW, height: g.textH, fontSize: g.fontSize, letterSpacing: g.letterSpacing,
    }),
    fixedSize: true, cmpKind: 'title', cmpCapH: capH,
  };
}
export async function editTitle(layer, patch) {
  const text = patch.text !== undefined ? patch.text : layer.text;
  const g = computeTextTitleGeometry(text || 'TÍTULO', { H: layer.cmpCapH });
  updateLayer(layer.id, { ...(patch.color ? { color: patch.color } : {}), text: g.text, width: g.textW, height: g.textH, fontSize: g.fontSize, letterSpacing: g.letterSpacing });
}

// ---- cuerpo de texto ----
function bodyMetrics(text, fontSize, lineWidth) {
  const variant = getWidthVariant('normal');
  const { normal, bold } = bodyWeights({});
  const layout = layoutRichText({
    text, box: { width: lineWidth, height: Infinity }, fontFamily: variant.family, fontFamilyItalic: variant.familyItalic,
    italic: false, normalWeight: normal, boldWeight: bold, fontSize, align: 'left',
  });
  return { width: Math.ceil(layout.maxLineWidth) + 1, height: Math.ceil(Math.max(layout.usedHeight, fontSize * 1.08)) };
}
export async function addBodySticker(text = 'Escribe aquí tu texto. Usa **negrita** si quieres.') {
  await ensureFonts(fontSpecsForState({ layers: [{ type: 'text', role: 'body' }] }));
  const fontSize = baseUnit() * 0.045;
  const lineWidth = canvas().width * 0.72;
  const m = bodyMetrics(text, fontSize, lineWidth);
  const pos = centered(m.width, m.height);
  const layer = {
    ...makeTextLayer({
      name: 'Texto', role: 'body', locked: false, autoFit: false, text, color: brandColor('white'), align: 'left', widthVariant: 'normal',
      x: pos.x, y: pos.y, width: m.width, height: m.height, fontSize,
    }),
    fixedSize: true, cmpKind: 'body', lineWidth,
  };
  addLayer(layer);
  return layer;
}
export function editBody(layer, patch) {
  const text = patch.text !== undefined ? patch.text : layer.text;
  const m = bodyMetrics(text, layer.fontSize, layer.lineWidth);
  updateLayer(layer.id, { ...(patch.color ? { color: patch.color } : {}), text, width: m.width, height: m.height });
}

// ---- ubicación (se dibuja a un PNG; mismo pin y tipografía que el sticker de ubicación) ----
export async function renderLocationPNG(city, color) {
  const Konva = window.Konva;
  const family = titleFamily();
  await ensureFonts([`italic 800 100px "${family}"`]);
  const g = computeLocationGeometry(city);
  const pinSrc = PIN_VARIANTS.find((p) => p.key === 'pin-on-black').src;
  const pin = await new Promise((resolve) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = pinSrc; });
  const tint = document.createElement('canvas');
  if (pin) {
    tint.width = pin.naturalWidth; tint.height = pin.naturalHeight;
    const tc = tint.getContext('2d');
    tc.drawImage(pin, 0, 0); tc.globalCompositeOperation = 'source-in'; tc.fillStyle = color; tc.fillRect(0, 0, tint.width, tint.height);
  }
  const stage = new Konva.Stage({ container: document.createElement('div'), width: g.canvasW, height: g.canvasH, listening: false });
  const layer = new Konva.Layer({ listening: false });
  stage.add(layer);
  if (pin) layer.add(new Konva.Image({ image: tint, x: g.pinX, y: g.pinY, width: g.pinW, height: g.pinH }));
  layer.add(new Konva.Text({
    x: g.textX, y: g.textY, width: g.textW, height: g.textH, text: g.cityName, fontSize: g.fontSize, fontFamily: family,
    fontStyle: 'italic 800', fill: color, align: 'left', verticalAlign: 'top', lineHeight: 1.08, letterSpacing: g.letterSpacing, wrap: 'word',
  }));
  layer.draw();
  const url = stage.toDataURL({ pixelRatio: 1, mimeType: 'image/png' });
  stage.destroy();
  return { src: url, width: g.canvasW, height: g.canvasH, city: g.cityName };
}
export async function addLocationSticker(city = 'MADRID') {
  const color = brandColor('white');
  const r = await renderLocationPNG(city, color);
  const w = canvas().width * 0.46;
  const h = w * r.height / r.width;
  const pos = centered(w, h);
  const layer = {
    ...makeImageLayer({ name: 'Ubicación', src: r.src, fit: 'contain', locked: false, x: pos.x, y: pos.y, width: w, height: h }),
    cmpKind: 'location', cmpText: r.city, cmpColor: color,
  };
  addLayer(layer);
  return layer;
}
export async function editLocation(layer, patch) {
  const city = patch.text !== undefined ? patch.text : layer.cmpText;
  const color = patch.color || layer.cmpColor;
  const r = await renderLocationPNG(city, color);
  updateLayer(layer.id, { src: r.src, height: layer.width * r.height / r.width, cmpText: r.city, cmpColor: color });
}

// ---- imágenes ya hechas (logos CJS/OES, stickers temáticos) ----
export function addImageSticker(item, { name, widthRatio = 0.5 } = {}) {
  const w = canvas().width * widthRatio;
  const h = w * item.height / item.width;
  const pos = centered(w, h);
  const layer = {
    ...makeImageLayer({ name: name || item.label, src: item.src, fit: 'contain', locked: false, x: pos.x, y: pos.y, width: w, height: h }),
    cmpKind: 'image', cmpRecolor: !!item.recolor, tint: null,
  };
  addLayer(layer);
  return layer;
}

// ---- logo editable de AJT ----
export async function addAjtLogoSticker() {
  await ensureAjtLogoAssets();
  const params = { ...AJT_LOGO_DEFAULTS, ajtVariant: 'negro' };
  const logo = drawAjtLogo(params);
  const w = canvas().width * 0.7;
  const h = w * logo.height / logo.width;
  const pos = centered(w, h);
  const layer = {
    ...makeImageLayer({ name: 'Logo AJT', src: logo.canvas.toDataURL('image/png'), fit: 'contain', locked: false, x: pos.x, y: pos.y, width: w, height: h }),
    cmpKind: 'ajtLogo', ...params,
  };
  addLayer(layer);
  return layer;
}
export async function editAjtLogo(layer, patch) {
  await ensureAjtLogoAssets();
  const params = { ajtText: layer.ajtText, ajtLayout: layer.ajtLayout, ajtVariant: layer.ajtVariant, ...patch };
  const logo = drawAjtLogo(params);
  updateLayer(layer.id, { ...params, src: logo.canvas.toDataURL('image/png'), height: layer.width * logo.height / logo.width });
}

// ---- tamaño y posición ----
// Escala la capa (proporcional) manteniendo su centro.
export function scaleLayer(layer, ratio) {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const w = layer.width * ratio;
  const h = layer.height * ratio;
  const patch = { width: w, height: h, x: cx - w / 2, y: cy - h / 2 };
  if (layer.cmpKind === 'title') { patch.fontSize = layer.fontSize * ratio; patch.letterSpacing = (layer.letterSpacing || 0) * ratio; patch.cmpCapH = layer.cmpCapH * ratio; }
  if (layer.cmpKind === 'body') { patch.fontSize = layer.fontSize * ratio; patch.lineWidth = layer.lineWidth * ratio; }
  updateLayer(layer.id, patch);
}

export const ANCHORS = [
  ['tl', 'Arriba izquierda'], ['tc', 'Arriba centro'], ['tr', 'Arriba derecha'],
  ['ml', 'Centro izquierda'], ['mc', 'Centro'], ['mr', 'Centro derecha'],
  ['bl', 'Abajo izquierda'], ['bc', 'Abajo centro'], ['br', 'Abajo derecha'],
];

// Caja que ocupa la capa en el lienzo (con su giro, que Konva aplica desde la esquina superior izquierda)
function layerBounds(l) {
  const t = ((l.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(t); const sin = Math.sin(t);
  const pts = [[0, 0], [l.width, 0], [l.width, l.height], [0, l.height]].map(([px, py]) => [l.x + px * cos - py * sin, l.y + px * sin + py * cos]);
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

// Coloca la capa en una de las 9 posiciones clásicas, con margen del 5 % del lado corto.
export function placeLayer(layer, anchor) {
  const rect = layerBounds(layer);
  const { width: cw, height: ch } = canvas();
  const m = baseUnit() * 0.05;
  const col = anchor[1]; const row = anchor[0];
  const tx = col === 'l' ? m : col === 'r' ? cw - m - rect.width : (cw - rect.width) / 2;
  const ty = row === 't' ? m : row === 'b' ? ch - m - rect.height : (ch - rect.height) / 2;
  updateLayer(layer.id, { x: layer.x + (tx - rect.x), y: layer.y + (ty - rect.y) });
}
