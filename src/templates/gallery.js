import { makeImageLayer } from '../engine/layerFactory.js';

// Galerías de stickers ya hechos (no editables): la app solo los muestra y
// permite descargar el archivo ORIGINAL. Para añadir uno nuevo basta con
// dejar el PNG en assets/stickers/<galería>/ y añadir aquí una línea con su
// tamaño real en píxeles.
export const GALLERIES = {
  militar: {
    title: '¿Quieres militar?',
    items: [
      { key: 'corto', label: 'Versión corta', src: './assets/stickers/militar/quieres-militar-corto.png', width: 589, height: 937 },
      { key: 'largo', label: 'Versión larga', src: './assets/stickers/militar/quieres-militar-largo.png', width: 589, height: 1229 },
    ],
  },
};

export function galleryItem(galleryKey, itemKey) {
  const g = GALLERIES[galleryKey];
  if (!g) return null;
  return g.items.find((i) => i.key === itemKey) || g.items[0];
}

export function buildGalleryDoc(galleryKey) {
  const g = GALLERIES[galleryKey];
  const item = g.items[0];
  return {
    canvas: { width: item.width, height: item.height },
    templateName: `Sticker · ${g.title}`,
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
      },
    ],
  };
}

// nombre de archivo de descarga a partir de la ruta original
export function galleryFileName(item) {
  return item.src.split('/').pop();
}
