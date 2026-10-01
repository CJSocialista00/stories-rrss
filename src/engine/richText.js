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

// Peso base del cuerpo (el que se elige con los botones de peso) y peso de
// la negrita parcial (**así**), siempre visiblemente más grueso que la base.
export function bodyWeights(d) {
  const normal = d.weight || (d.bold ? 700 : 400);
  const bold = Math.min(900, Math.max(700, normal + 300));
  return { normal, bold };
}

export function hasBoldMarkers(text) {
  return /\*\*(.+?)\*\*/.test(text || '');
}

// Trocea los segmentos en "palabras", espacios y saltos de línea ("\n" va
// como token propio para respetar los puntos y aparte y las líneas vacías),
// preservando el flag bold.
function segmentsToWords(segments) {
  const words = [];
  for (const seg of segments) {
    const parts = seg.text.replace(/\r\n?/g, '\n').split(/(\n|[^\S\n]+)/).filter((p) => p.length);
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

  const lines = [];
  let current = [];

  const isSpaceText = (t) => /^\s+$/.test(t);
  const lineWidth = (words) => words.reduce((acc, w) => acc + w.width, 0);
  // endsParagraph: la línea termina en un Enter o es la última (no se justifica)
  const pushLine = (endsParagraph) => {
    while (current.length && isSpaceText(current[current.length - 1].text)) current.pop();
    lines.push({ words: current, width: lineWidth(current), endsParagraph });
    current = [];
  };
  const measure = (text, bold) => {
    ctx.font = fontString(bold ? boldWeight : normalWeight, fontSize, family, italic);
    return ctx.measureText(text).width;
  };

  // Una palabra más ancha que la caja (p.ej. escribir sin espacios) se parte
  // por letras; antes se salía por la derecha del lienzo.
  const splitLongWord = (word) => {
    const pieces = [];
    let piece = '';
    for (const ch of word.text) {
      if (piece && measure(piece + ch, word.bold) > box.width) {
        pieces.push(piece);
        piece = ch;
      } else {
        piece += ch;
      }
    }
    if (piece) pieces.push(piece);
    return pieces.map((t) => ({ text: t, bold: word.bold, width: measure(t, word.bold) }));
  };

  for (const word of words) {
    if (word.text === '\n') {
      // salto de línea forzado: cierra la línea actual aunque esté vacía, así
      // un Enter doble deja una línea en blanco entre párrafos
      pushLine(true);
      continue;
    }
    const w = measure(word.text, word.bold);
    if (isSpaceText(word.text)) {
      // no arrancamos línea con un espacio
      if (current.length === 0) continue;
      current.push({ ...word, width: w });
      continue;
    }
    const pieces = w > box.width ? splitLongWord(word) : [{ ...word, width: w }];
    for (const piece of pieces) {
      const used = lineWidth(current);
      if (used + piece.width > box.width && current.some((x) => !isSpaceText(x.text))) pushLine(false);
      current.push(piece);
    }
  }
  if (current.length) pushLine(true);
  if (lines.length) lines[lines.length - 1].endsParagraph = true;

  // posiciones x por alineación (justificado: el hueco sobrante se reparte
  // entre los espacios, salvo en la última línea de cada párrafo)
  let y = 0;
  const positioned = [];
  for (const line of lines) {
    let x = 0;
    let extraPerSpace = 0;
    if (align === 'center') x = (box.width - line.width) / 2;
    else if (align === 'right') x = box.width - line.width;
    else if (align === 'justify' && !line.endsParagraph) {
      const spaces = line.words.filter((w) => isSpaceText(w.text)).length;
      if (spaces) extraPerSpace = (box.width - line.width) / spaces;
    }
    for (const w of line.words) {
      positioned.push({ ...w, x, y, family });
      x += w.width + (isSpaceText(w.text) ? extraPerSpace : 0);
    }
    y += fontSize * lineHeight;
  }

  const maxLineWidth = lines.reduce((m, l) => Math.max(m, l.width), 0);
  return { runs: positioned, usedHeight: lines.length ? y : 0, lineCount: lines.length, maxLineWidth };
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
