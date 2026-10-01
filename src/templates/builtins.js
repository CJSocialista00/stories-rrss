import { CANVAS_W, CANVAS_H, COLORS } from '../engine/constants.js';
import { makeTextLayer, makeImageLayer, makeLogoLayer, makeFrameLayer, makeGradientLayer, makeBackgroundLayer } from '../engine/layerFactory.js';

const MARGIN = 80;

// 1) Repost simple: hueco de publicación compartida arriba, logo tipo sticker,
//    título en rojo y cuerpo debajo, fondo negro sólido. (como el ejemplo "Libertad Fergie Chambers")
function repostSimple() {
  const imgH = 980;
  return {
    canvas: { width: CANVAS_W, height: CANVAS_H },
    templateName: 'Repost · Título y cuerpo debajo',
    templateVersion: 2,
    layers: [
      makeFrameLayer({
        name: 'Marco compartido (guía)',
        x: MARGIN, y: 140, width: CANVAS_W - MARGIN * 2, height: imgH,
        ratioKey: 'libre', cornerRadius: 28,
      }),
      makeLogoLayer({
        name: 'Logo (sticker)',
        asset: 'icon-on-red',
        x: CANVAS_W - MARGIN - 190, y: 140 + imgH - 150,
        width: 150, height: 150,
      }),
      makeTextLayer({
        name: 'Título', role: 'title',
        text: 'Título de la publicación',
        x: MARGIN, y: 140 + imgH + 60, width: CANVAS_W - MARGIN * 2, height: 180,
        color: COLORS.red, autoFit: false, fontSize: 84,
      }),
      makeTextLayer({
        name: 'Cuerpo', role: 'body',
        text: 'Texto de cuerpo explicando la publicación compartida y **el contexto de la story** (lo que va entre dobles asteriscos sale en negrita).',
        x: MARGIN, y: 140 + imgH + 250, width: CANVAS_W - MARGIN * 2, height: 420,
        color: COLORS.white, autoFit: false, fontSize: 44,
      }),
    ],
  };
}

// 2) Repost con publicación compartida: Título / marco de "compartido" (Instagram) / cuerpo
function repostShared() {
  const frameW = CANVAS_W - MARGIN * 2;
  const frameH = (frameW * 5) / 4; // 4:5 por defecto
  const frameY = 420;
  return {
    canvas: { width: CANVAS_W, height: CANVAS_H },
    templateName: 'Repost · Título + publicación + cuerpo',
    templateVersion: 2,
    layers: [
      makeTextLayer({
        name: 'Título', role: 'title',
        text: 'Título de la publicación',
        x: MARGIN, y: 120, width: CANVAS_W - MARGIN * 2, height: 220,
        color: COLORS.red, autoFit: false, fontSize: 88,
      }),
      makeFrameLayer({
        name: 'Marco compartido (guía)',
        x: MARGIN, y: frameY, width: frameW, height: frameH,
        ratioKey: '4:5', cornerRadius: 28,
      }),
      makeTextLayer({
        name: 'Cuerpo', role: 'body',
        text: 'Texto de cuerpo con el contexto y **la reflexión** sobre la publicación compartida.',
        x: MARGIN, y: frameY + frameH + 50, width: CANVAS_W - MARGIN * 2, height: 400,
        color: COLORS.white, autoFit: false, fontSize: 44,
      }),
      makeLogoLayer({
        name: 'Logo (sticker)',
        asset: 'full',
        x: CANVAS_W - MARGIN - 150, y: CANVAS_H - 220,
        width: 130, height: 130,
      }),
    ],
  };
}

// 3) Artículo (plantilla fija): título principal + subtítulo (desactivable) +
//    portada + cuerpo autoajustable + hueco enlace + logos
// arranca por debajo de la zona que tapa la barra superior de Instagram
// (barras de progreso + avatar/nombre, ~200px de 1920)
export const ARTICLE_TITLE_Y = 230;
export const ARTICLE_SUBTITLE_GAP = 12;
function articleFixed() {
  const titleH = 160;
  const subtitleY = ARTICLE_TITLE_Y + titleH + ARTICLE_SUBTITLE_GAP;
  const subtitleH = 100;
  const coverY = subtitleY + subtitleH + 28;
  const coverH = 640;
  return {
    canvas: { width: CANVAS_W, height: CANVAS_H },
    templateName: 'Artículo (fija)',
    // al cambiar la estructura de esta plantilla se sube la versión para que
    // los espacios de trabajo guardados con la estructura vieja se descarten
    templateVersion: 3,
    layers: [
      makeBackgroundLayer({
        name: 'Fondo', x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, color: '#ffffff',
        exportable: true,
      }),
      makeTextLayer({
        name: 'Título principal', role: 'title', slot: 'mainTitle',
        text: 'Titular del artículo',
        x: MARGIN, y: ARTICLE_TITLE_Y, width: CANVAS_W - MARGIN * 2, height: titleH,
        color: COLORS.black, autoFit: true,
      }),
      makeTextLayer({
        name: 'Subtítulo', role: 'body', slot: 'subtitle',
        text: 'Subtítulo que amplía o matiza el titular',
        x: MARGIN, y: subtitleY, width: CANVAS_W - MARGIN * 2, height: subtitleH,
        color: COLORS.black, autoFit: true, bold: true,
      }),
      makeImageLayer({
        name: 'Portada', x: MARGIN, y: coverY, width: CANVAS_W - MARGIN * 2, height: coverH,
        cornerRadius: 20,
      }),
      makeTextLayer({
        name: 'Cuerpo', role: 'body',
        text: 'Resumen o entradilla del artículo con **una idea clave en negrita**, que se autoajusta para que la foto de portada nunca pierda espacio.',
        x: MARGIN, y: coverY + coverH + 36, width: CANVAS_W - MARGIN * 2, height: 260,
        color: COLORS.black, autoFit: true,
      }),
      makeTextLayer({
        name: 'Espacio enlace (Instagram)', role: 'body',
        text: '↗ Espacio para el sticker de enlace de Instagram',
        x: MARGIN, y: CANVAS_H - 330, width: CANVAS_W - MARGIN * 2, height: 90,
        color: '#888888', autoFit: false, fontSize: 28, align: 'center',
      }),
      makeImageLayer({
        name: 'Logo del medio (izquierda)', src: null, fit: 'contain',
        x: MARGIN, y: CANVAS_H - 190, width: 110, height: 110,
      }),
      makeLogoLayer({
        name: 'Logo corporativo (abajo)', asset: 'icon-on-white',
        x: CANVAS_W - MARGIN - 110, y: CANVAS_H - 190, width: 110, height: 110,
      }),
    ],
  };
}

export const BUILTIN_TEMPLATES = [
  { id: 'builtin_repost_simple', name: 'Repost · Título y cuerpo debajo', builtin: true, doc: repostSimple },
  { id: 'builtin_repost_shared', name: 'Repost · Título + publicación + cuerpo', builtin: true, doc: repostShared },
  { id: 'builtin_article', name: 'Artículo (fija)', builtin: true, doc: articleFixed },
];
