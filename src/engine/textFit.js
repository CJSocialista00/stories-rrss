// Calcula el tamaño de fuente óptimo para que un texto quepa dentro de un
// ancho/alto dados, probando tamaños de mayor a menor (usado por las capas
// de texto autoajustable, p.ej. la plantilla de artículo).

let measureCanvas = null;
function getCtx() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

function wrapLines(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? current + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Devuelve { fontSize, lines } que hace que el texto quepa en box.width x box.height.
 * fontFamily debe incluir variation settings ya resueltas (usamos font-weight/stretch en el string).
 */
export function fitTextToBox({
  text,
  box,
  fontFamily,
  fontWeight = 400,
  italic = false,
  minSize = 10,
  maxSize = 200,
  lineHeight = 1.08,
}) {
  const ctx = getCtx();
  let best = { fontSize: minSize, lines: [text] };
  for (let size = maxSize; size >= minSize; size -= 1) {
    const font = `${italic ? 'italic ' : ''}${fontWeight} ${size}px "${fontFamily}"`;
    const lines = wrapLines(ctx, text, box.width, font);
    const totalHeight = lines.length * size * lineHeight;
    if (totalHeight <= box.height) {
      best = { fontSize: size, lines };
      break;
    }
  }
  return best;
}
