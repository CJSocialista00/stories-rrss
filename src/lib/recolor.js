// Recoloreado de stickers de un solo color: se pinta el color elegido sobre
// todos los píxeles visibles y se conserva la transparencia, así que el borde
// suavizado queda igual que en el original.

const imgCache = new Map();
export function loadImg(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    img.src = src;
  });
  imgCache.set(src, p);
  return p;
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// duotone: para stickers de dos colores (p. ej. "únete!") donde las zonas
// claras (el texto dentro del recuadro) se quedan en blanco fijo, para que
// siga contrastando con cualquier color de marca, y el resto pasa al color
// elegido. Las de un solo color (duotone=false) se pintan enteras del color.
export function tintCanvas(img, hex, scale = 1, duotone = false) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  if (duotone) {
    const [r, g, b] = hexToRgb(hex);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum > 190) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
      else { px[i] = r; px[i + 1] = g; px[i + 2] = b; }
    }
    ctx.putImageData(data, 0, 0);
  } else {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

// PNG a tamaño completo del sticker en el color pedido (para descargar)
export async function recolorBlob(src, hex, duotone = false) {
  const img = await loadImg(src);
  const canvas = tintCanvas(img, hex, 1, duotone);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))), 'image/png'));
}

// Miniatura recoloreada (data URL pequeña, cacheada)
const thumbCache = new Map();
export async function recolorThumb(src, hex, maxSide = 300, duotone = false) {
  const key = `${src}|${hex}|${maxSide}|${duotone}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const img = await loadImg(src);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const url = tintCanvas(img, hex, scale, duotone).toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}
