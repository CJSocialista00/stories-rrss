// Título con la primera letra en otra fuente (OES: inicial en Clandy Italic,
// más grande y rozando la letra siguiente). Konva.Text no mezcla fuentes en un
// mismo nodo, así que se compone aquí: se mide con canvas, se parte en líneas y
// se dibuja con una línea base exacta (textBaseline "alphabetic").

let measureCtx = null;
function getCtx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

const mainFontString = (main, size) => `${main.italic ? 'italic ' : ''}${main.weight} ${size}px "${main.family}"`;
const initFontString = (ini, size) => `${ini.style === 'italic' ? 'italic ' : ''}${ini.weight} ${size}px "${ini.family}"`;

// Konva dibuja con textBaseline "middle": la línea base de la 1.ª línea cae en
// la mitad de la caja de línea más la mitad de (ascenso − descenso) de la fuente.
function firstBaseline(main, size, lineHeightPx) {
  const ctx = getCtx();
  ctx.font = mainFontString(main, size);
  const m = ctx.measureText('H');
  const fa = m.fontBoundingBoxAscent || size * 0.9;
  const fd = m.fontBoundingBoxDescent || size * 0.2;
  return lineHeightPx / 2 + (fa - fd) / 2;
}

function widthOf(str, font, ls) {
  const ctx = getCtx();
  ctx.font = font;
  if (!ls) return ctx.measureText(str).width;
  let w = 0;
  for (const ch of str) w += ctx.measureText(ch).width + ls;
  return w;
}

// Separación horizontal entre el origen de la inicial y el de la letra siguiente
function restOffset(ini, iniSize, ch, restCh, main, size) {
  const ctx = getCtx();
  ctx.font = initFontString(ini, iniSize);
  const mi = ctx.measureText(ch);
  const reach = Math.max(mi.width, mi.actualBoundingBoxRight);
  ctx.font = mainFontString(main, size);
  const restLeft = restCh ? -ctx.measureText(restCh).actualBoundingBoxLeft : 0;
  return reach - restLeft + (ini.gap || 0) * size;
}

/**
 * Parte el texto en líneas y coloca cada tramo. Devuelve
 * { lines:[{segs:[{text,font,x,dy,ls}], width}], baseline, lineHeightPx, usedHeight, maxLineWidth }
 * (dy = desplazamiento vertical respecto a la línea base del texto principal).
 */
export function layoutMixedTitle({ text, main, initial, fontSize, letterSpacing = 0, boxWidth = Infinity, align = 'left', lineHeight = 1.08 }) {
  const lh = fontSize * lineHeight;
  const mainFont = mainFontString(main, fontSize);
  const iniSize = fontSize * initial.scale;
  const iniFont = initFontString(initial, iniSize);
  const spaceW = widthOf(' ', mainFont, letterSpacing);
  const paragraphs = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const lines = [];
  let initialPending = true;

  for (const para of paragraphs) {
    const words = para.split(' ').filter((w) => w.length);
    if (!words.length) { lines.push({ segs: [], width: 0 }); continue; }
    let cur = { segs: [], width: 0 };
    for (const word of words) {
      const chars = [...word];
      const useInitial = initialPending && !/\s/.test(chars[0]);
      initialPending = false;
      let pieces; // [{text, font, dy, ls, w}] con su desplazamiento relativo
      let wordW;
      if (useInitial) {
        const ch = chars[0];
        const rest = chars.slice(1).join('');
        const off = restOffset(initial, iniSize, ch, chars[1], main, fontSize);
        pieces = [{ text: ch, font: iniFont, dy: initial.drop * fontSize, ls: letterSpacing, x: 0 }];
        wordW = widthOf(ch, iniFont, letterSpacing);
        if (rest) {
          pieces.push({ text: rest, font: mainFont, dy: 0, ls: letterSpacing, x: off });
          wordW = off + widthOf(rest, mainFont, letterSpacing);
        }
      } else {
        pieces = [{ text: word, font: mainFont, dy: 0, ls: letterSpacing, x: 0 }];
        wordW = widthOf(word, mainFont, letterSpacing);
      }
      const gap = cur.segs.length ? spaceW : 0;
      if (cur.segs.length && cur.width + gap + wordW > boxWidth) {
        lines.push(cur);
        cur = { segs: [], width: 0 };
      }
      const startX = cur.segs.length ? cur.width + spaceW : 0;
      pieces.forEach((p) => cur.segs.push({ text: p.text, font: p.font, dy: p.dy, ls: p.ls, x: startX + p.x }));
      cur.width = startX + wordW;
    }
    lines.push(cur);
  }

  const maxLineWidth = lines.reduce((m, l) => Math.max(m, l.width), 0);
  if (Number.isFinite(boxWidth) && align !== 'left') {
    lines.forEach((l) => {
      const shift = align === 'center' ? (boxWidth - l.width) / 2 : boxWidth - l.width;
      l.segs.forEach((sg) => { sg.x += shift; });
    });
  }
  // cuánto sobresale la tinta por encima / por debajo de la línea base (la
  // inicial es más grande y baja): el sticker necesita margen para no recortarla
  const ctx = getCtx();
  let inkAbove = 0;
  let inkBelow = 0;
  lines.forEach((l) => l.segs.forEach((sg) => {
    ctx.font = sg.font;
    const m = ctx.measureText(sg.text);
    inkAbove = Math.max(inkAbove, m.actualBoundingBoxAscent - sg.dy);
    inkBelow = Math.max(inkBelow, m.actualBoundingBoxDescent + sg.dy);
  }));
  return { lines, baseline: firstBaseline(main, fontSize, lh), lineHeightPx: lh, usedHeight: lines.length * lh, maxLineWidth, inkAbove, inkBelow };
}

// Mayor tamaño (hasta maxSize) con el que el título cabe en la caja
export function fitMixedTitle({ text, main, initial, boxWidth, boxHeight, maxSize, minSize = 12, maxLines = Infinity, letterSpacing = 0, align = 'left' }) {
  for (let size = maxSize; size >= minSize; size -= 1) {
    const layout = layoutMixedTitle({ text, main, initial, fontSize: size, letterSpacing, boxWidth, align });
    if (layout.lines.length <= maxLines && layout.usedHeight <= boxHeight) return size;
  }
  return minSize;
}

// Relación altura de mayúscula / cuerpo de la fuente principal (para el sticker)
export function capRatio(main) {
  const ctx = getCtx();
  ctx.font = mainFontString(main, 200);
  const m = ctx.measureText('H');
  return (m.actualBoundingBoxAscent || 200 * 0.72) / 200;
}

export function drawMixedTitle(c, layout, color) {
  c.save();
  c.fillStyle = color || '#fff';
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  layout.lines.forEach((line, i) => {
    const y = layout.baseline + i * layout.lineHeightPx;
    line.segs.forEach((sg) => {
      c.font = sg.font;
      if (!sg.ls) { c.fillText(sg.text, sg.x, y + sg.dy); return; }
      let x = sg.x;
      for (const ch of sg.text) { c.fillText(ch, x, y + sg.dy); x += c.measureText(ch).width + sg.ls; }
    });
  });
  c.restore();
}
