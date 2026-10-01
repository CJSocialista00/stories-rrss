// Lienzo de trabajo: story de Instagram estándar
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

export const COLORS = {
  black: '#282929',
  red: '#f54949',
  white: '#ffffff',
};

// Tipografía: instancias estáticas reales de Acumin Variable (src/fonts.css).
// Cada ancho es una familia con sus 9 pesos en normal y en cursiva REAL; la
// cursiva se pide con "italic" en el string de fuente y el navegador usa esa
// variante (no inclina artificialmente).
export const FONT_FAMILY = 'CJS Acumin';
export const FONT_FAMILY_ITALIC = 'CJS Acumin';
export const FONT_FAMILY_TITLE = 'CJS Acumin ExtraCondensed';
export const FONT_FAMILY_TITLE_ITALIC = 'CJS Acumin ExtraCondensed';

export const FONT_WIDTH_VARIANTS = [
  { key: 'extracondensed', label: 'Extra condensada', family: 'CJS Acumin ExtraCondensed', familyItalic: 'CJS Acumin ExtraCondensed' },
  { key: 'condensed', label: 'Condensada', family: 'CJS Acumin Condensed', familyItalic: 'CJS Acumin Condensed' },
  { key: 'semicondensed', label: 'Semicondensada', family: 'CJS Acumin SemiCondensed', familyItalic: 'CJS Acumin SemiCondensed' },
  { key: 'normal', label: 'Normal', family: 'CJS Acumin', familyItalic: 'CJS Acumin' },
  { key: 'wide', label: 'Ancha', family: 'CJS Acumin Wide', familyItalic: 'CJS Acumin Wide' },
];

export const FONT_WEIGHT_VARIANTS = [
  { key: 'thin', label: 'Thin', weight: 100 },
  { key: 'extralight', label: 'ExtraLight', weight: 200 },
  { key: 'light', label: 'Light', weight: 300 },
  { key: 'regular', label: 'Regular', weight: 400 },
  { key: 'medium', label: 'Medium', weight: 500 },
  { key: 'semibold', label: 'Semibold', weight: 600 },
  { key: 'bold', label: 'Bold', weight: 700 },
  { key: 'black', label: 'Black', weight: 800 },
  { key: 'ultrablack', label: 'UltraBlack', weight: 900 },
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
