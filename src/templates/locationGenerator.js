import { COLORS, FONT_WIDTH_VARIANTS } from '../engine/constants.js';
import { makeTextLayer, makePinLayer, makeImageLayer, makePillLayer } from '../engine/layerFactory.js';
import { FONT_FAMILY_TITLE_ITALIC } from '../engine/constants.js';

// Proporciones medidas directamente sobre tus stickers reales
// (D:\ICONOS DE UBICACIÓN\MURCIA.png, lienzo 4538x1813, contenido 969px de
// alto), expresadas como fracción del alto del pin/texto.
const RATIO = {
  leftMargin: 0.2786,
  rightMargin: 0.2786,
  gap: 0.3302,
  topMargin: 0.4829,
  bottomMargin: 0.3849,
  pinWidth: 0.6667, // relativo al alto H
};

// Interletrado (tracking) de la Acumin ExtraCondensed Black Itálica que usan
// tus stickers reales: las letras van casi pegadas. Negativo = más juntas.
const TITLE_LETTER_SPACING_RATIO = -0.028;

let measureCtx = null;
function getMeasureCtx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

// El hueco real entre la "y" de un Konva.Text (verticalAlign:'top') y el
// borde superior de la tinta NO coincide con lo que predicen las métricas de
// Canvas 2D (fontBoundingBoxAscent/actualBoundingBoxAscent): Konva calcula el
// alto de línea a su manera internamente, así que calibrar con esas métricas
// dejaba el texto desplazado varias decenas de píxeles respecto al pin. En
// vez de adivinar, renderizamos el mismo Konva.Text que usará el lienzo final
// (mismo fontStyle/align/verticalAlign/lineHeight) en un lienzo oculto y
// medimos directamente, píxel a píxel, dónde cae de verdad la tinta.
//
// Rendimiento: esto se llama en cada tecla, así que (1) se mide UNA sola vez
// por texto/fuente a un tamaño de referencia fijo y se escala linealmente
// (la tinta de un texto escala exactamente con fontSize y el interletrado es
// proporcional al tamaño), (2) se cachea el resultado y (3) se reutiliza un
// único Stage oculto con pixelRatio 1 (antes se creaba y destruía uno por
// medición, hasta 5 veces por tecla, y en móvil a 3x de resolución).
const REF_FONT_SIZE = 320;
const inkCache = new Map();
let measureStage = null;
let measureLayer = null;
let measureNode = null;

if (document.fonts && document.fonts.addEventListener) {
  // si una fuente termina de cargar después de medir, lo cacheado no vale
  document.fonts.addEventListener('loadingdone', () => inkCache.clear());
}

function getMeasureStage() {
  if (measureStage) return measureStage;
  const Konva = window.Konva;
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = 'position:fixed;left:-99999px;top:0;pointer-events:none;';
  document.body.appendChild(container);
  measureStage = new Konva.Stage({ container, width: 10, height: 10, listening: false });
  measureLayer = new Konva.Layer({ listening: false });
  measureStage.add(measureLayer);
  measureLayer.getCanvas().setPixelRatio(1);
  measureNode = new Konva.Text({ fill: '#fff', align: 'left', verticalAlign: 'top', lineHeight: 1.08, wrap: 'none' });
  measureLayer.add(measureNode);
  return measureStage;
}

// Devuelve { inkOffsetY, capHeight } como fracción de fontSize.
function measureInkRatios({ text, family, weight, italic, letterSpacingRatio }) {
  const key = `${family}|${weight}|${italic ? 1 : 0}|${letterSpacingRatio}|${text}`;
  const cached = inkCache.get(key);
  if (cached) return cached;

  const fontSize = REF_FONT_SIZE;
  const fontStyle = `${italic ? 'italic ' : ''}${weight}`;
  const ctx = getMeasureCtx();
  ctx.font = `${fontStyle} ${fontSize}px "${family}"`;
  const pad = Math.ceil(fontSize * 0.5);
  const width = Math.ceil(ctx.measureText(text).width + Math.abs(letterSpacingRatio * fontSize) * text.length) + pad * 2;
  const height = Math.ceil(fontSize * 1.6) + pad * 2;

  getMeasureStage();
  measureStage.size({ width, height });
  measureLayer.getCanvas().setPixelRatio(1);
  measureNode.setAttrs({
    x: pad, y: pad, width: width - pad * 2, height: height - pad,
    text, fontSize, fontFamily: family, fontStyle,
    letterSpacing: fontSize * letterSpacingRatio,
  });
  measureLayer.draw();

  const canvas = measureLayer.getCanvas();
  const ratio = canvas.getPixelRatio ? canvas.getPixelRatio() : 1;
  const raw = canvas._canvas;
  const W = raw.width, H = raw.height;
  const data = raw.getContext('2d').getImageData(0, 0, W, H).data;
  const rowHasInk = (y) => {
    for (let i = y * W * 4 + 3, end = i + W * 4; i < end; i += 4) if (data[i] > 10) return true;
    return false;
  };
  let inkTop = null;
  for (let y = 0; y < H; y++) if (rowHasInk(y)) { inkTop = y; break; }
  let result;
  if (inkTop === null) {
    result = { inkOffsetY: 0.1, capHeight: 0.72 };
  } else {
    let inkBottom = inkTop;
    for (let y = H - 1; y > inkTop; y--) if (rowHasInk(y)) { inkBottom = y; break; }
    result = {
      inkOffsetY: (inkTop / ratio - pad) / fontSize,
      capHeight: ((inkBottom - inkTop + 1) / ratio) / fontSize,
    };
  }
  if (inkCache.size > 300) inkCache.clear();
  inkCache.set(key, result);
  return result;
}

// Ajusta el tamaño de fuente para que la altura real de la tinta sea targetH.
// Una sola medición (cacheada) en vez de 5 renders por llamada.
function fitFontSizeToCapHeight(text, targetH, family, weight, letterSpacingRatio = 0, italic = false) {
  const ink = measureInkRatios({ text, family, weight, italic, letterSpacingRatio });
  const fontSize = ink.capHeight > 0 ? targetH / ink.capHeight : targetH;
  const letterSpacing = fontSize * letterSpacingRatio;
  const ctx = getMeasureCtx();
  // Chrome necesita la palabra "italic" explícita en el string para aplicar
  // la inclinación del @font-face (el descriptor font-style:oblique del
  // @font-face no basta por sí solo) — igual que en el motor de render.
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${fontSize}px "${family}"`;
  const width = ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing;
  return { fontSize, width, capHeight: targetH, letterSpacing, inkOffsetY: ink.inkOffsetY * fontSize };
}

function widthVariantFamily(widthKey, italic) {
  const variant = FONT_WIDTH_VARIANTS.find((v) => v.key === widthKey) || FONT_WIDTH_VARIANTS[0];
  return italic ? variant.familyItalic : variant.family;
}

/**
 * Sticker de título: una sola línea, lienzo ajustado al contenido, sin caja
 * ni controles de posición — pero con libertad de estilo (ancho/peso/cursiva
 * de Acumin Variable), a diferencia del sticker de ubicación que sí usa
 * siempre la misma tipografía de marca.
 */
export function computeTextTitleGeometry(textRaw, { H = 500, widthVariant = 'extracondensed', weight = 800, italic = true } = {}) {
  const text = (textRaw || 'TEXTO').toUpperCase().trim() || 'TEXTO';
  const pad = H * 0.35;
  const family = widthVariantFamily(widthVariant, italic);
  const lsRatio = widthVariant === 'extracondensed' ? TITLE_LETTER_SPACING_RATIO : 0;
  const { fontSize, width: textWidth, letterSpacing, inkOffsetY } = fitFontSizeToCapHeight(text, H, family, weight, lsRatio, italic);
  return {
    text,
    canvasW: Math.round(textWidth + pad * 2),
    canvasH: Math.round(H + pad * 2),
    textX: pad, textY: pad - inkOffsetY, textW: textWidth + fontSize * 0.15, textH: H * 1.3, fontSize, letterSpacing,
  };
}

export function buildTextTitleDoc(textRaw, { H = 500, color = COLORS.red, widthVariant = 'extracondensed', weight = 800, italic = true } = {}) {
  const g = computeTextTitleGeometry(textRaw, { H, widthVariant, weight, italic });
  return {
    canvas: { width: g.canvasW, height: g.canvasH },
    templateName: `Sticker de título · ${g.text}`,
    quickGenerator: 'title',
    layers: [
      makeTextLayer({
        name: 'Texto', role: 'title', italic, locked: true,
        text: g.text, widthVariant, weight,
        x: g.textX, y: g.textY, width: g.textW, height: g.textH,
        color, align: 'left', autoFit: false, fontSize: g.fontSize, letterSpacing: g.letterSpacing,
      }),
    ],
  };
}

// Caja por defecto del sticker de cuerpo (libre, con ajuste de línea, varios
// estilos de Acumin Variable y control de posición).
export function defaultBodyStickerBox() {
  return { canvasW: 1200, canvasH: 500, x: 60, y: 60, width: 1080, height: 380 };
}

export function buildTextBodyDoc(textRaw = 'Escribe aquí tu texto largo. Puedes usar varias líneas y **negrita parcial**.', { color = COLORS.white } = {}) {
  const box = defaultBodyStickerBox();
  return {
    canvas: { width: box.canvasW, height: box.canvasH },
    templateName: 'Sticker de cuerpo',
    quickGenerator: 'body',
    layers: [
      makeTextLayer({
        name: 'Texto', role: 'body', locked: false, autoFit: true,
        text: textRaw,
        x: box.x, y: box.y, width: box.width, height: box.height,
        color, align: 'left', widthVariant: 'normal',
      }),
    ],
  };
}

// Igual que el sticker de cuerpo, pero con una pastila de color corporativo
// detrás del texto. Lienzo con más margen para que quepa el relleno de la
// pastila (hasta 120px) alrededor de la caja de texto.
export function buildTextBodyPillDoc(textRaw = 'Texto sobre una **pastila de color**.\n\nPuedes separar párrafos con una línea vacía.', { color = COLORS.white, pillColor = COLORS.red } = {}) {
  const box = { canvasW: 1300, canvasH: 640, x: 130, y: 130, width: 1040, height: 380 };
  const text = makeTextLayer({
    name: 'Texto', role: 'body', locked: false, autoFit: true,
    text: textRaw,
    x: box.x, y: box.y, width: box.width, height: box.height,
    color, align: 'left', widthVariant: 'normal',
  });
  return {
    canvas: { width: box.canvasW, height: box.canvasH },
    templateName: 'Sticker de cuerpo con fondo',
    quickGenerator: 'body',
    layers: [
      makePillLayer({ targetId: text.id, color: pillColor }),
      text,
    ],
  };
}

/**
 * Sticker de ubicación: pin + nombre de ciudad, con el lienzo ajustado
 * automáticamente a la longitud del texto y las mismas proporciones/tipo de
 * letra que tus stickers de referencia. Sin controles manuales.
 */
export function computeLocationGeometry(cityNameRaw, { H = 600 } = {}) {
  const cityName = (cityNameRaw || 'CIUDAD').toUpperCase().trim() || 'CIUDAD';
  const { fontSize, width: textWidth, letterSpacing, inkOffsetY } = fitFontSizeToCapHeight(cityName, H, FONT_FAMILY_TITLE_ITALIC, 800, TITLE_LETTER_SPACING_RATIO, true);
  const leftMargin = RATIO.leftMargin * H;
  const rightMargin = RATIO.rightMargin * H;
  const gap = RATIO.gap * H;
  const topMargin = RATIO.topMargin * H;
  const bottomMargin = RATIO.bottomMargin * H;
  const pinWidth = RATIO.pinWidth * H;
  return {
    cityName,
    canvasW: Math.round(leftMargin + pinWidth + gap + textWidth + rightMargin),
    canvasH: Math.round(topMargin + H + bottomMargin),
    pinX: leftMargin, pinY: topMargin, pinW: pinWidth, pinH: H,
    textX: leftMargin + pinWidth + gap, textY: topMargin - inkOffsetY, textW: textWidth + fontSize * 0.15, textH: H * 1.3, fontSize, letterSpacing,
  };
}

export function pinAssetForColor(color) {
  if (color === COLORS.white || color === '#ffffff') return 'pin-on-black'; // asset blanco
  if (color === COLORS.black || color === '#282929') return 'pin-on-white'; // asset negro
  return 'pin-red'; // rojo corporativo
}

export function buildLocationStickerDoc(cityNameRaw, { H = 600, color = COLORS.white } = {}) {
  const g = computeLocationGeometry(cityNameRaw, { H });
  return {
    canvas: { width: g.canvasW, height: g.canvasH },
    templateName: `Sticker de ubicación · ${g.cityName}`,
    quickGenerator: 'location',
    layers: [
      makePinLayer({
        name: 'Pin', asset: pinAssetForColor(color), locked: true,
        x: g.pinX, y: g.pinY, width: g.pinW, height: g.pinH,
      }),
      makeTextLayer({
        name: 'Ciudad', role: 'title', italic: true, locked: true,
        text: g.cityName,
        x: g.textX, y: g.textY, width: g.textW, height: g.textH,
        color, align: 'left', autoFit: false, fontSize: g.fontSize, letterSpacing: g.letterSpacing,
      }),
    ],
  };
}

/**
 * Foto con ubicación: una foto (se sube aparte) + el mismo sticker de
 * ubicación anclado a una de las 4 esquinas, con tamaño ajustable.
 */
export function computePhotoBadgeGeometry(cityNameRaw, { corner = 'bottom-left', canvasW = 1080, canvasH = 1350, scale = 1 } = {}) {
  const cityName = (cityNameRaw || 'CIUDAD').toUpperCase().trim() || 'CIUDAD';
  const H = canvasW * 0.07 * scale;
  const { fontSize, width: textWidth, letterSpacing, inkOffsetY } = fitFontSizeToCapHeight(cityName, H, FONT_FAMILY_TITLE_ITALIC, 800, TITLE_LETTER_SPACING_RATIO, true);
  const gap = RATIO.gap * H;
  const pinWidth = RATIO.pinWidth * H;
  const margin = canvasW * 0.05;
  const badgeW = pinWidth + gap + textWidth;
  const isRight = corner.endsWith('right');
  const isBottom = corner.startsWith('bottom');
  const badgeX = isRight ? canvasW - margin - badgeW : margin;
  const badgeY = isBottom ? canvasH - margin - H : margin;
  return {
    cityName, pinX: badgeX, pinY: badgeY, pinW: pinWidth, pinH: H,
    textX: badgeX + pinWidth + gap, textY: badgeY - inkOffsetY, textW: textWidth + fontSize * 0.15, textH: H * 1.3, fontSize, letterSpacing,
  };
}

export function buildPhotoLocationDoc(cityNameRaw, {
  corner = 'bottom-left', photoSrc = null, color = COLORS.white,
  canvasW = 1080, canvasH = 1350, scale = 1,
} = {}) {
  const g = computePhotoBadgeGeometry(cityNameRaw, { corner, canvasW, canvasH, scale });
  return {
    canvas: { width: canvasW, height: canvasH },
    templateName: `Foto con ubicación · ${g.cityName}`,
    quickGenerator: 'photoLocation',
    layers: [
      makeImageLayer({
        name: 'Foto', src: photoSrc, fit: 'cover', locked: true, cornerRadius: 0,
        x: 0, y: 0, width: canvasW, height: canvasH,
      }),
      makePinLayer({
        name: 'Pin', asset: pinAssetForColor(color), locked: true,
        x: g.pinX, y: g.pinY, width: g.pinW, height: g.pinH,
      }),
      makeTextLayer({
        name: 'Ciudad', role: 'title', italic: true, locked: true,
        text: g.cityName,
        x: g.textX, y: g.textY, width: g.textW, height: g.textH,
        color, align: 'left', autoFit: false, fontSize: g.fontSize, letterSpacing: g.letterSpacing,
      }),
    ],
  };
}
