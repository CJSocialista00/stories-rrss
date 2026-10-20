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

function tintCanvas(img, hex, scale = 1) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * scale));
  c.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// PNG a tamaño completo del sticker en el color pedido (para descargar)
export async function recolorBlob(src, hex) {
  const img = await loadImg(src);
  const canvas = tintCanvas(img, hex, 1);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar el PNG'))), 'image/png'));
}

// Miniatura recoloreada (data URL pequeña, cacheada)
const thumbCache = new Map();
export async function recolorThumb(src, hex, maxSide = 300) {
  const key = `${src}|${hex}|${maxSide}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const img = await loadImg(src);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const url = tintCanvas(img, hex, scale).toDataURL('image/png');
  thumbCache.set(key, url);
  return url;
}
