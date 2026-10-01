import { nextId } from './state.js';
import { CANVAS_W, CANVAS_H, COLORS } from './constants.js';

export function makeTextLayer({
  name = 'Texto',
  role = 'body', // 'title' | 'body'
  text = 'Texto',
  x = 80,
  y = 80,
  width = CANVAS_W - 160,
  height = 200,
  color = COLORS.white,
  bold = false,
  italic = false,
  align = 'left',
  autoFit = true,
  fontSize = 64,
  exportable = true,
  locked = false,
  letterSpacing = 0,
  widthVariant = null, // null = usar el valor por defecto según el rol (ver computeFont); si no, ver FONT_WIDTH_VARIANTS
  weight = null, // null = usar el peso por defecto según el rol/negrita
  slot = null, // papel fijo dentro de una plantilla (p.ej. 'mainTitle' / 'subtitle' del artículo)
} = {}) {
  return {
    id: nextId('text'),
    type: 'text',
    name,
    visible: true,
    x, y, width, height,
    rotation: 0,
    role,
    text,
    color,
    bold,
    italic,
    align,
    autoFit,
    fontSize,
    exportable,
    locked,
    letterSpacing,
    widthVariant,
    weight,
    slot,
  };
}

export function makeImageLayer({
  name = 'Imagen',
  x = 0,
  y = 0,
  width = CANVAS_W,
  height = 900,
  src = null,
  cornerRadius = 0,
  fit = 'cover',
  exportable = true,
  locked = false,
} = {}) {
  return {
    id: nextId('image'),
    type: 'image',
    name,
    visible: true,
    x, y, width, height,
    rotation: 0,
    src,
    cornerRadius,
    fit,
    exportable,
    locked,
  };
}

export function makeLogoLayer({
  name = 'Logo',
  asset = 'full', // 'full' | 'triangle'
  x = CANVAS_W - 200,
  y = CANVAS_H - 200,
  width = 140,
  height = 140,
  exportable = true,
} = {}) {
  return {
    id: nextId('logo'),
    type: 'logo',
    name,
    visible: true,
    x, y, width, height,
    rotation: 0,
    asset,
    exportable,
  };
}

export function makePinLayer({
  name = 'Icono de ubicación',
  asset = 'pin-on-white',
  x = 0,
  y = 0,
  width = 140,
  height = 140,
  exportable = true,
  locked = false,
} = {}) {
  return {
    id: nextId('pin'),
    type: 'pin',
    name,
    visible: true,
    x, y, width, height,
    rotation: 0,
    asset,
    exportable,
    locked,
  };
}

export function makeFrameLayer({
  name = 'Marco compartido',
  x = 80,
  y = 700,
  width = CANVAS_W - 160,
  height = ((CANVAS_W - 160) * 5) / 4,
  ratioKey = '4:5',
  cornerRadius = 24,
} = {}) {
  return {
    id: nextId('frame'),
    type: 'frame',
    name,
    visible: true,
    x, y, width, height,
    rotation: 0,
    ratioKey,
    cornerRadius,
    guide: true,
    exportable: false, // guía visual: no se incluye en la exportación por defecto
  };
}

export function makeBackgroundLayer({
  name = 'Fondo',
  x = 0,
  y = 0,
  width = CANVAS_W,
  height = CANVAS_H,
  color = COLORS.white,
  exportable = true,
} = {}) {
  return {
    id: nextId('background'),
    type: 'background',
    name,
    visible: true,
    x, y, width, height,
    rotation: 0,
    color,
    exportable,
  };
}

export function makeGradientLayer({
  name = 'Degradado',
  x = 0,
  y = CANVAS_H - 700,
  width = CANVAS_W,
  height = 700,
  color = COLORS.black,
  exportable = true,
} = {}) {
  return {
    id: nextId('gradient'),
    type: 'gradient',
    name,
    visible: true,
    x, y, width, height,
    rotation: 0,
    color,
    exportable,
  };
}
