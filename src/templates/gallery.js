import { makeImageLayer } from '../engine/layerFactory.js';

// Galerías de stickers ya hechos (no editables): la app solo los muestra y
// permite descargar el archivo ORIGINAL. Para añadir uno nuevo basta con
// dejar el PNG en assets/stickers/<galería>/ y añadir aquí una línea con su
// tamaño real en píxeles.
export const GALLERIES = {
  militar: {
    title: '¿Quieres militar?',
    zipName: 'stickers_quieres_militar.zip',
    items: [
      { key: 'corto', label: 'Versión corta', src: './assets/stickers/militar/quieres-militar-corto.png', width: 589, height: 937 },
      { key: 'largo', label: 'Versión larga', src: './assets/stickers/militar/quieres-militar-largo.png', width: 589, height: 1229 },
    ],
  },
  logosCjs: {
    title: 'Logotipo CJS',
    zipName: 'logotipo_cjs.zip',
    items: [
      { key: 'icono-blanco', label: 'Icono · blanco', src: './assets/logos/cjs/cjs-icono-blanco.png', width: 392, height: 391 },
      { key: 'icono-negro', label: 'Icono · negro claro', src: './assets/logos/cjs/cjs-icono-negro.png', width: 392, height: 391, lightPreview: true },
      { key: 'icono-rojo', label: 'Icono · rojo', src: './assets/logos/cjs/cjs-icono-rojo.png', width: 392, height: 391 },
      { key: 'icono-blanco-triangulo-rojo', label: 'Icono · blanco, triángulo rojo', src: './assets/logos/cjs/cjs-icono-blanco-triangulo-rojo.png', width: 392, height: 391 },
      { key: 'icono-negro-triangulo-rojo', label: 'Icono · negro claro, triángulo rojo', src: './assets/logos/cjs/cjs-icono-negro-triangulo-rojo.png', width: 392, height: 391, lightPreview: true },
      { key: 'blanco', label: 'Todo blanco', src: './assets/logos/cjs/cjs-blanco.png', width: 1380, height: 392 },
      { key: 'negro', label: 'Negro claro', src: './assets/logos/cjs/cjs-negro.png', width: 1380, height: 392, lightPreview: true },
      { key: 'rojo', label: 'Todo rojo', src: './assets/logos/cjs/cjs-rojo.png', width: 1380, height: 392 },
      { key: 'blanco-triangulo-rojo', label: 'Blanco · triángulo rojo', src: './assets/logos/cjs/cjs-blanco-triangulo-rojo.png', width: 1380, height: 392 },
      { key: 'negro-triangulo-rojo', label: 'Negro claro · triángulo rojo', src: './assets/logos/cjs/cjs-negro-triangulo-rojo.png', width: 1380, height: 392, lightPreview: true },
    ],
  },
  logosOes: {
    title: 'Logotipo OES',
    zipName: 'logotipo_oes.zip',
    items: [
      { key: 'rojo', label: 'Rojo', src: './assets/logos/oes/oes-rojo.png', width: 1996, height: 880 },
      { key: 'blanco', label: 'Blanco', src: './assets/logos/oes/oes-blanco.png', width: 1996, height: 880 },
      { key: 'negro', label: 'Negro', src: './assets/logos/oes/oes-negro.png', width: 1996, height: 880, lightPreview: true },
    ],
  },
  // recolor: true = sticker de un solo color que se puede descargar en los
  // colores de cada marca (ver lib/recolor.js)
  huelga11n: {
    title: 'Stickers Huelga General 11N',
    zipName: 'stickers_huelga_general_11n.zip',
    items: [
      { key: 'huelga-general', label: 'Huelga General!', src: './assets/stickers/huelga11n/huelga-general.png', width: 792, height: 788, recolor: true },
      { key: '11n-rentismo', label: '11N · Contra el rentismo', src: './assets/stickers/huelga11n/11n-contra-el-rentismo.png', width: 5610, height: 1019, recolor: true },
      { key: 'contra-rentismo', label: 'Contra el rentismo, gobierno y capital', src: './assets/stickers/huelga11n/contra-el-rentismo-gobierno-capital.png', width: 2452, height: 1574, recolor: true },
      { key: 'fondo-vertical', label: 'FONDO VERTICAL 9:16', src: './assets/stickers/huelga11n/fondo-vertical.png', width: 1080, height: 1980, recolor: false },
    ],
  },
};

export function galleryItem(galleryKey, itemKey) {
  const g = GALLERIES[galleryKey];
  if (!g) return null;
  return g.items.find((i) => i.key === itemKey) || g.items[0];
}

export function buildGalleryDoc(galleryKey, itemKey) {
  const g = GALLERIES[galleryKey];
  const item = g.items.find((i) => i.key === itemKey) || g.items[0];
  return {
    canvas: { width: item.width, height: item.height },
    templateName: g.items.length > 1 && itemKey ? `${g.title} · ${item.label}` : `Sticker · ${g.title}`,
    quickGenerator: 'gallery',
    gallery: galleryKey,
    layers: [
      {
        ...makeImageLayer({
          name: 'Sticker', src: item.src, fit: 'contain', locked: true, cornerRadius: 0,
          x: 0, y: 0, width: item.width, height: item.height,
        }),
        galleryKey,
        itemKey: item.key,
        galleryColor: null, // null = color original; si no, hex de la marca
      },
    ],
  };
}

// nombre de archivo de descarga a partir de la ruta original
export function galleryFileName(item) {
  return item.src.split('/').pop();
}

// nombre de archivo al descargar en un color de marca: huelga-general-ff4331.png
export function galleryColorFileName(item, hex) {
  const base = galleryFileName(item);
  return hex ? base.replace(/\.png$/i, `-${hex.replace('#', '')}.png`) : base;
}
