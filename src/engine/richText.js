// Texto enriquecido muy ligero para el cuerpo: solo soporta negrita parcial
// marcando fragmentos con **así** (estilo Markdown), para poder resaltar
// palabras sueltas sin tener que crear una capa de texto nueva.
//
// Konva.Text no soporta estilos mixtos dentro de un mismo nodo, así que
// troceamos el texto en "runs" (segmentos con el mismo estilo) y calculamos
// nosotros el ajuste de línea palabra a palabra con canvas measureText,
// para luego pintar cada run como su propio Konva.Text posicionado a mano.

let measureCanvas = null;
function getCtx() {
  if (!measureCanvas) measureCanvas = document.createElement('canvas');
  return measureCanvas.getContext('2d');
}

// "hola **mundo** bonito" -> [{text:'hola ',bold:false}, {text:'mundo',bold:true}, {text:' bonito',bold:false}]
export function parseBoldSegments(text) {
  const segments = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), bold: false });
    segments.push({ text: m[1], bold: true });
    last = re.lastIndex;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });
  return segments;
}

export function hasBoldMarkers(text) {
  return /\*\*(.+?)\*\*/.test(text || '');
}

// Trocea los segmentos en "palabras" (con el espacio final incluido) preservando el flag bold.
function segmentsToWords(segments) {
  const words = [];
  for (const seg of segments) {
    const parts = seg.text.split(/(\s+)/).filter((p) => p.length);
    for (const part of parts) words.push({ text: part, bold: seg.bold });
  }
  return words;
}

function fontString(weight, size, family, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${size}px "${family}"`;
}

/**
 * Calcula las líneas (wrap) para un fontSize dado. Devuelve también el alto total usado.
 */
export function layoutRichText({
  text, box, fontFamily, fontFamilyItalic, italic, normalWeight = 400, boldWeight = 700,
  fontSize, lineHeight = 1.08, align = 'left',
}) {
  const ctx = getCtx();
  const family = italic ? fontFamilyItalic : fontFamily;
  const words = segmentsToWords(parseBoldSegments(text));
  const spaceWidth = (bold) => {
    ctx.font = fontString(bold ? boldWeight : normalWeight, fontSize, family, italic);
    return ctx.measureText(' ').width;
  };

  const lines = [];
  let current = [];
  let currentWidth = 0;

  const pushLine = () => {
    lines.push({ words: current, width: currentWidth });
    current = [];
    currentWidth = 0;
  };

  for (const word of words) {
    const isSpace = /^\s+$/.test(word.text);
    ctx.font = fontString(word.bold ? boldWeight : normalWeight, fontSize, family, italic);
    const w = ctx.measureText(word.text).width;
    if (isSpace) {
      // no arrancamos línea con un espacio, y no medimos el espacio final de línea
      if (current.length === 0) continue;
      current.push({ ...word, width: w });
      currentWidth += w;
      continue;
    }
    if (currentWidth + w > box.width && current.length > 0) {
      // quitamos espacios sobrantes al final de la línea
      while (current.length && /^\s+$/.test(current[current.length - 1].text)) current.pop();
      pushLine();
    }
    current.push({ ...word, width: w });
    currentWidth += w;
  }
  if (current.length) {
    while (current.length && /^\s+$/.test(current[current.length - 1].text)) current.pop();
    if (current.length) pushLine();
  }

  // posiciones x por alineación
  let y = 0;
  const positioned = [];
  for (const line of lines) {
    let x = 0;
    if (align === 'center') x = (box.width - line.width) / 2;
    else if (align === 'right') x = box.width - line.width;
    for (const w of line.words) {
      positioned.push({ ...w, x, y, family });
      x += w.width;
    }
    y += fontSize * lineHeight;
  }

  return { runs: positioned, usedHeight: lines.length ? y : 0, lineCount: lines.length };
}

/**
 * Igual que fitTextToBox pero para texto con negrita parcial: prueba tamaños
 * de mayor a menor hasta que el layout completo quepa en box.height.
 */
export function fitRichText({
  text, box, fontFamily, fontFamilyItalic, italic, normalWeight = 400, boldWeight = 700,
  minSize = 10, maxSize = 90, lineHeight = 1.08, align = 'left',
}) {
  let best = null;
  for (let size = maxSize; size >= minSize; size -= 1) {
    const layout = layoutRichText({
      text, box, fontFamily, fontFamilyItalic, italic, normalWeight, boldWeight, fontSize: size, lineHeight, align,
    });
    if (layout.usedHeight <= box.height) { best = { ...layout, fontSize: size }; break; }
  }
  if (!best) {
    best = { ...layoutRichText({ text, box, fontFamily, fontFamilyItalic, italic, normalWeight, boldWeight, fontSize: minSize, lineHeight, align }), fontSize: minSize };
  }
  return best;
}
