// Lienzo de trabajo: story de Instagram estándar
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

export const COLORS = {
  black: '#282929',
  red: '#f54949',
  white: '#ffffff',
};

// Cuerpo: familia de ancho normal (wdth=100, valor por defecto del archivo).
export const FONT_FAMILY = 'Acumin Variable';
export const FONT_FAMILY_ITALIC = 'Acumin Variable Italic';
// Título: familia con el ancho fijado a ExtraCondensed (wdth=50) vía @font-face.
export const FONT_FAMILY_TITLE = 'Acumin Condensed';
export const FONT_FAMILY_TITLE_ITALIC = 'Acumin Condensed Italic';

// Variantes de ancho adicionales para el sticker de texto en modo "Cuerpo"
// (libertad de estilo dentro de Acumin Variable).
export const FONT_WIDTH_VARIANTS = [
  { key: 'extracondensed', label: 'Extra condensada', family: 'Acumin Condensed', familyItalic: 'Acumin Condensed Italic' },
  { key: 'condensed', label: 'Condensada', family: 'Acumin Semicondensed', familyItalic: 'Acumin Semicondensed Italic' },
  { key: 'normal', label: 'Normal', family: 'Acumin Variable', familyItalic: 'Acumin Variable Italic' },
  { key: 'wide', label: 'Ancha', family: 'Acumin Wide', familyItalic: 'Acumin Wide Italic' },
];

export const FONT_WEIGHT_VARIANTS = [
  { key: 'regular', label: 'Regular', weight: 400 },
  { key: 'bold', label: 'Negrita', weight: 700 },
  { key: 'black', label: 'Black', weight: 800 },
];

// Proporciones estándar de publicaciones de Instagram para el marco de "compartido"
export const ASPECT_PRESETS = [
  { key: '4:5', w: 4, h: 5, label: '4:5' },
  { key: '5:4', w: 5, h: 4, label: '5:4' },
  { key: '1:1', w: 1, h: 1, label: '1:1' },
  { key: '3:2', w: 3, h: 2, label: '3:2' },
  { key: '2:3', w: 2, h: 3, label: '2:3' },
  { key: '16:9', w: 16, h: 9, label: '16:9' },
];
