import { getState, updateLayer, selectLayer, pushHistory } from './state.js';
import { CANVAS_W, CANVAS_H, FONT_FAMILY, FONT_FAMILY_ITALIC, FONT_FAMILY_TITLE, FONT_FAMILY_TITLE_ITALIC, FONT_WIDTH_VARIANTS } from './constants.js';
import { fitTextToBox } from './textFit.js';
import { layoutRichText, fitRichText } from './richText.js';

const imageCache = new Map();
function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise((resolve) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

const LOGO_ASSETS = {
  // 'full' se mantiene como alias de 'icon-on-black' por compatibilidad con
  // plantillas/documentos guardados antes de tener variantes por fondo.
  full: './assets/logo/logo-full.png',
  'icon-on-white': './assets/logo/logo-on-white.png',
  'icon-on-black': './assets/logo/logo-on-black.png',
  'icon-on-red': './assets/logo/logo-on-red.png',
  'wordmark-on-white': './assets/logo/wordmark-on-white.png',
  'wordmark-on-black': './assets/logo/wordmark-on-black.png',
  'wordmark-on-red': './assets/logo/wordmark-on-red.png',
};

// Dos "kinds" de logo (solo icono / icono + nombre), cada uno con sus 3
// variantes de color según el fondo sobre el que se coloque.
export const LOGO_KINDS = [
  {
    key: 'icon',
    label: 'Solo icono',
    aspect: 1, // logo-full.png es ~468x467
    variants: [
      { key: 'icon-on-white', label: 'Sobre blanco', src: LOGO_ASSETS['icon-on-white'] },
      { key: 'icon-on-black', label: 'Sobre negro', src: LOGO_ASSETS['icon-on-black'] },
      { key: 'icon-on-red', label: 'Sobre rojo', src: LOGO_ASSETS['icon-on-red'] },
    ],
  },
  {
    key: 'wordmark',
    label: 'Con texto',
    aspect: 508 / 1696, // alto/ancho del PNG real exportado desde Photoshop
    variants: [
      { key: 'wordmark-on-white', label: 'Sobre blanco', src: LOGO_ASSETS['wordmark-on-white'] },
      { key: 'wordmark-on-black', label: 'Sobre negro', src: LOGO_ASSETS['wordmark-on-black'] },
      { key: 'wordmark-on-red', label: 'Sobre rojo', src: LOGO_ASSETS['wordmark-on-red'] },
    ],
  },
];

export function logoKindOf(assetKey) {
  const normalized = assetKey === 'full' ? 'icon-on-black' : assetKey;
  return normalized.startsWith('wordmark') ? 'wordmark' : 'icon';
}

// Pin de ubicación (recortado de los stickers reales en D:\ICONOS DE UBICACIÓN),
// con las mismas 3 variantes de color que el logo.
const PIN_ASSETS = {
  full: './assets/icons/location-pin-on-black.png',
  'pin-on-white': './assets/icons/location-pin-on-white.png', // pin negro, para fondos claros
  'pin-on-black': './assets/icons/location-pin-on-black.png', // pin blanco, para fondos oscuros
  'pin-on-red': './assets/icons/location-pin-on-red.png', // pin blanco, para fondos rojos
  'pin-red': './assets/icons/location-pin-red.png', // pin en rojo corporativo, para que haga juego con texto rojo
};

export const PIN_VARIANTS = [
  { key: 'pin-on-white', label: 'Sobre blanco', src: PIN_ASSETS['pin-on-white'] },
  { key: 'pin-on-black', label: 'Sobre negro', src: PIN_ASSETS['pin-on-black'] },
  { key: 'pin-on-red', label: 'Sobre rojo', src: PIN_ASSETS['pin-on-red'] },
];

export class StageRenderer {
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.onSelect = onSelect || (() => {});
    const { width, height } = this.canvasSize();
    this.stage = new window.Konva.Stage({
      container,
      width,
      height,
    });
    this.layer = new window.Konva.Layer();
    this.stage.add(this.layer);
    this.transformer = new window.Konva.Transformer({
      rotateAnchorOffset: 24,
      borderStroke: '#f54949',
      anchorStroke: '#f54949',
      anchorFill: '#ffffff',
      anchorSize: 10,
      ignoreStroke: true,
    });
    this.layer.add(this.transformer);
    this.nodes = new Map();

    this.stage.on('click tap', (e) => {
      if (e.target === this.stage) {
        selectLayer(null);
        this.onSelect(null);
      }
    });
  }

  // tamaño del lienzo del documento actual (cada plantilla/apartado puede
  // usar una proporción y resolución distinta: story 1080x1920, sticker
  // apaisado, foto en cualquier proporción, etc.)
  canvasSize() {
    const c = getState().canvas;
    return { width: (c && c.width) || CANVAS_W, height: (c && c.height) || CANVAS_H };
  }

  computeFitScale(wrapEl) {
    const padding = 32;
    const { width, height } = this.canvasSize();
    const availW = wrapEl.clientWidth - padding;
    const availH = wrapEl.clientHeight - padding;
    return Math.max(0.05, Math.min(availW / width, availH / height));
  }

  setScale(scale) {
    this.currentScale = scale;
    const { width, height } = this.canvasSize();
    this.stage.width(width * scale);
    this.stage.height(height * scale);
    this.stage.scale({ x: scale, y: scale });
    this.stage.draw();
  }

  // al cambiar de documento (plantilla con otro tamaño de lienzo) hay que
  // redimensionar el propio Stage de Konva, no solo su escala de zoom
  syncCanvasSize() {
    const { width, height } = this.canvasSize();
    this.stage.width(width * (this.currentScale || 1));
    this.stage.height(height * (this.currentScale || 1));
  }

  fitToContainer(wrapEl) {
    this.fitScale = this.computeFitScale(wrapEl);
    this.setScale(this.fitScale);
  }

  // render() es asíncrono (carga imágenes) y se llama desde muchos sitios a
  // la vez; si dos pasadas se solapaban, ambas veían "no hay nodo" y creaban
  // nodos duplicados. Ahora solo corre una pasada; las llamadas que llegan
  // mientras tanto se agrupan en UNA pasada extra con el estado más reciente.
  render() {
    if (this._renderPromise) {
      this._renderAgain = true;
      return this._renderPromise;
    }
    this._renderPromise = (async () => {
      try {
        do {
          this._renderAgain = false;
          await this.renderOnce();
        } while (this._renderAgain);
      } finally {
        this._renderPromise = null;
      }
    })();
    return this._renderPromise;
  }

  async renderOnce() {
    const state = getState();
    const seen = new Set();

    for (const layerData of state.layers) {
      seen.add(layerData.id);
      let node = this.nodes.get(layerData.id);
      // una capa de texto cambia de forma de nodo Konva según el rol
      // (título = Text simple, cuerpo = Group de "runs" por la negrita
      // parcial); si el rol cambió desde la última vez, hay que reconstruir
      // el nodo en vez de actualizar uno del tipo equivocado.
      const expectedKind = layerData.type === 'text' ? `text-${layerData.role}` : layerData.type;
      if (node && node.getAttr('_kind') !== expectedKind) {
        node.destroy();
        this.nodes.delete(layerData.id);
        node = null;
      }
      if (!node) {
        node = await this.createNode(layerData);
        node.setAttr('_kind', expectedKind);
        this.nodes.set(layerData.id, node);
        this.layer.add(node);
        this.bindEvents(node, layerData.id, layerData);
      } else {
        await this.updateNode(node, layerData);
      }
      node.visible(layerData.visible !== false);
    }

    // eliminar nodos huérfanos
    for (const [id, node] of this.nodes.entries()) {
      if (!seen.has(id)) {
        node.destroy();
        this.nodes.delete(id);
      }
    }

    // reordenar según el array de capas (orden de dibujo)
    state.layers.forEach((l) => {
      const node = this.nodes.get(l.id);
      if (node) node.moveToTop();
    });
    this.transformer.moveToTop();

    // selección
    if (state.selectedId && this.nodes.has(state.selectedId)) {
      const node = this.nodes.get(state.selectedId);
      const selectedData = state.layers.find((l) => l.id === state.selectedId);
      if (selectedData && (selectedData.type === 'background' || selectedData.type === 'frame' || selectedData.locked === true)) {
        // fondo y marco de "compartido": fijos, sin arrastre ni asas de
        // redimensión — solo se editan desde los controles del panel
        this.transformer.nodes([]);
        this.layer.draw();
        return;
      } else if (selectedData && (selectedData.type === 'logo' || selectedData.type === 'pin')) {
        // el logo solo se redimensiona por las esquinas y siempre proporcional (no se deforma)
        this.transformer.enabledAnchors(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
        this.transformer.rotateEnabled(true);
        this.transformer.keepRatio(true);
      } else {
        this.transformer.enabledAnchors([
          'top-left', 'top-center', 'top-right',
          'middle-left', 'middle-right',
          'bottom-left', 'bottom-center', 'bottom-right',
        ]);
        this.transformer.rotateEnabled(true);
        this.transformer.keepRatio(false);
      }
      this.transformer.nodes([node]);
    } else {
      this.transformer.nodes([]);
    }

    this.layer.draw();
  }

  bindEvents(node, id, layerData) {
    const isFixed = layerData.type === 'background' || layerData.type === 'frame' || layerData.locked === true;
    node.draggable(!isFixed);
    if (isFixed) {
      // fondo sólido y marco de "compartido": completamente fijos, no se
      // arrastran ni se transforman con asas — solo se seleccionan (para
      // editar color/proporción desde el panel) o se desactivan.
      node.on('click tap', (e) => {
        e.cancelBubble = true;
        selectLayer(id);
        this.onSelect(id);
      });
      return;
    }
    // red de seguridad: ninguna capa puede acabar tan lejos del lienzo que
    // se vuelva irrecuperable (p. ej. por un conflicto táctil de arrastre).
    // Se permite salir hasta un lienzo de margen en cada dirección.
    const { width: cw, height: ch } = this.canvasSize();
    const clampX = (v) => Math.min(cw + cw, Math.max(-cw, v));
    const clampY = (v) => Math.min(ch + ch, Math.max(-ch, v));

    node.dragBoundFunc((pos) => ({ x: clampX(pos.x), y: clampY(pos.y) }));
    node.on('dragstart', () => { pushHistory(); });
    node.on('dragend', () => {
      updateLayer(id, { x: clampX(node.x()), y: clampY(node.y()) }, { history: false });
    });
    node.on('transformstart', () => { pushHistory(); });
    node.on('transformend', () => {
      const patch = {
        y: clampY(node.y()),
        rotation: node.rotation(),
      };
      const minSize = layerData.type === 'text' ? 20 : 4;
      patch.width = Math.max(minSize, node.width() * node.scaleX());
      patch.height = Math.max(minSize, node.height() * node.scaleY());
      patch.x = clampX(node.x());
      // al resetear la escala a 1 hay que fijar también el ancho/alto reales
      // del nodo al nuevo tamaño calculado; si no, el nodo "salta" de vuelta
      // a su tamaño original en cuanto sueltas (la escala vuelve a 1 pero el
      // width/height del nodo seguía siendo el de antes del arrastre).
      node.scaleX(1);
      node.scaleY(1);
      node.size({ width: patch.width, height: patch.height });
      node.position({ x: patch.x, y: patch.y });
      this.layer.batchDraw();
      updateLayer(id, patch, { history: false });
      // recalcula todo desde el estado (p. ej. el reajuste del texto si el
      // cuerpo tiene negrita parcial) sin esperar a la próxima acción de UI
      this.render();
    });
    node.on('click tap', (e) => {
      e.cancelBubble = true;
      selectLayer(id);
      this.onSelect(id);
    });
  }

  async createNode(layerData) {
    switch (layerData.type) {
      case 'image': return this.createImageNode(layerData);
      case 'logo': return this.createLogoNode(layerData);
      case 'pin': return this.createLogoNode(layerData);
      case 'text': return this.createTextNode(layerData);
      case 'frame': return this.createFrameNode(layerData);
      case 'gradient': return this.createGradientNode(layerData);
      case 'background': return this.createBackgroundNode(layerData);
      default: return new window.Konva.Group();
    }
  }

  async updateNode(node, layerData) {
    switch (layerData.type) {
      case 'image': return this.updateImageNode(node, layerData);
      case 'logo': return this.updateLogoNode(node, layerData);
      case 'pin': return this.updateLogoNode(node, layerData);
      case 'text': return this.updateTextNode(node, layerData);
      case 'frame': return this.updateFrameNode(node, layerData);
      case 'gradient': return this.updateGradientNode(node, layerData);
      case 'background': return this.updateBackgroundNode(node, layerData);
      default: return null;
    }
  }

  // ---- IMAGE ----
  async createImageNode(d) {
    const img = await loadImage(d.src);
    const group = new window.Konva.Group({
      x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation || 0,
    });
    const placeholder = new window.Konva.Rect({
      width: d.width, height: d.height,
      cornerRadius: d.cornerRadius || 0,
      fill: 'rgba(255,255,255,0.06)',
      stroke: '#666', strokeWidth: 2, dash: [8, 8],
      name: 'placeholder',
      visible: !img,
    });
    const label = new window.Konva.Text({
      text: '+ imagen', fontSize: 24, fill: '#888',
      width: d.width, height: d.height, align: 'center', verticalAlign: 'middle',
      name: 'placeholderLabel', visible: !img,
    });
    const image = new window.Konva.Image({
      image: img || undefined,
      width: d.width, height: d.height,
      cornerRadius: d.cornerRadius || 0,
      name: 'img', visible: !!img,
    });
    group.add(placeholder, label, image);
    group.setAttr('_src', d.src);
    if (img) this.applyCover(image, img, d);
    return group;
  }
  async updateImageNode(group, d) {
    group.position({ x: d.x, y: d.y });
    group.size({ width: d.width, height: d.height });
    group.rotation(d.rotation || 0);
    const placeholder = group.findOne('.placeholder');
    const label = group.findOne('.placeholderLabel');
    const image = group.findOne('.img');
    placeholder.size({ width: d.width, height: d.height });
    placeholder.cornerRadius(d.cornerRadius || 0);
    label.size({ width: d.width, height: d.height });
    image.size({ width: d.width, height: d.height });
    image.cornerRadius(d.cornerRadius || 0);

    if (group.getAttr('_src') !== d.src) {
      const img = await loadImage(d.src);
      group.setAttr('_src', d.src);
      image.image(img || undefined);
      const has = !!img;
      placeholder.visible(!has);
      label.visible(!has);
      image.visible(has);
      if (img) this.applyCover(image, img, d);
    } else if (image.image()) {
      this.applyCover(image, image.image(), d);
    }
  }
  applyCover(node, img, d) {
    if (!img) return;
    node.setAttr('_src', d.src);
    if (d.fit === 'cover') {
      const scale = Math.max(d.width / img.width, d.height / img.height);
      const cw = d.width / scale;
      const ch = d.height / scale;
      node.crop({
        x: (img.width - cw) / 2,
        y: (img.height - ch) / 2,
        width: cw,
        height: ch,
      });
    } else {
      node.crop(null);
    }
  }

  // ---- LOGO / PIN (icono con variantes de color intercambiables) ----
  assetMapFor(d) {
    return d.type === 'pin' ? PIN_ASSETS : LOGO_ASSETS;
  }
  async createLogoNode(d) {
    const assets = this.assetMapFor(d);
    const img = await loadImage(assets[d.asset] || assets.full);
    const node = new window.Konva.Image({
      image: img || undefined,
      x: d.x, y: d.y, width: d.width, height: d.height,
      rotation: d.rotation || 0,
    });
    node.setAttr('_asset', d.asset);
    return node;
  }
  async updateLogoNode(node, d) {
    const assets = this.assetMapFor(d);
    if (node.getAttr('_asset') !== d.asset) {
      const img = await loadImage(assets[d.asset] || assets.full);
      node.image(img || undefined);
      node.setAttr('_asset', d.asset);
    }
    node.position({ x: d.x, y: d.y });
    node.size({ width: d.width, height: d.height });
    node.rotation(d.rotation || 0);
  }

  // ---- TEXT ----
  computeFont(d) {
    const isTitle = d.role === 'title';
    // peso: explícito (d.weight) > negrita simple > por defecto según rol
    const weight = d.weight || (isTitle ? 800 : (d.bold ? 700 : 400));
    // ancho: explícito (d.widthVariant) > por defecto según rol
    const widthKey = d.widthVariant || (isTitle ? 'extracondensed' : 'normal');
    const variant = FONT_WIDTH_VARIANTS.find((v) => v.key === widthKey) || FONT_WIDTH_VARIANTS[2];
    const family = d.italic ? variant.familyItalic : variant.family;
    return { weight, family };
  }
  resolveFontSize(d) {
    if (!d.autoFit) return d.fontSize || 48;
    const { weight, family } = this.computeFont(d);
    if (d.role !== 'title') {
      const variant = FONT_WIDTH_VARIANTS.find((v) => v.key === d.widthVariant) || FONT_WIDTH_VARIANTS[2];
      return fitRichText({
        text: d.text || '',
        box: { width: d.width, height: d.height },
        fontFamily: variant.family,
        fontFamilyItalic: variant.familyItalic,
        italic: !!d.italic,
        normalWeight: d.bold ? 700 : 400,
        boldWeight: 700,
        align: d.align || 'left',
        minSize: 12,
        maxSize: 90,
      }).fontSize;
    }
    const fit = fitTextToBox({
      text: d.text || '',
      box: { width: d.width, height: d.height },
      fontFamily: family,
      fontWeight: weight,
      italic: !!d.italic,
      minSize: 12,
      maxSize: 160,
    });
    return fit.fontSize;
  }

  // el título es un único Konva.Text (nunca lleva negrita parcial)
  createTitleTextNode(d) {
    const { weight, family } = this.computeFont(d);
    const fontSize = this.resolveFontSize(d);
    return new window.Konva.Text({
      x: d.x, y: d.y, width: d.width, height: d.height,
      text: d.text || '',
      fontSize,
      fontFamily: family,
      // el canvas 2D de Chrome necesita la palabra "italic" explícita en el
      // string de fuente para aplicar la inclinación del @font-face; solo
      // con el descriptor font-style:oblique en el @font-face no basta.
      fontStyle: `${d.italic ? 'italic ' : ''}${weight}`,
      fill: d.color || '#ffffff',
      align: d.align || 'left',
      verticalAlign: 'top',
      lineHeight: 1.08,
      letterSpacing: d.letterSpacing || 0,
      wrap: 'word',
      rotation: d.rotation || 0,
    });
  }
  updateTitleTextNode(node, d) {
    const { weight, family } = this.computeFont(d);
    const fontSize = this.resolveFontSize(d);
    node.setAttrs({
      x: d.x, y: d.y, width: d.width, height: d.height,
      text: d.text || '',
      fontSize,
      fontFamily: family,
      fontStyle: `${d.italic ? 'italic ' : ''}${weight}`,
      fill: d.color || '#ffffff',
      align: d.align || 'left',
      letterSpacing: d.letterSpacing || 0,
      rotation: d.rotation || 0,
    });
  }

  // el cuerpo se renderiza siempre como un grupo de "runs" (permite negrita parcial con **así**)
  buildBodyRuns(group, d) {
    const fontSize = this.resolveFontSize(d);
    const boldWeight = 700;
    const normalWeight = d.bold ? 700 : 400; // "Negrita" global sigue funcionando como peso base
    const variant = FONT_WIDTH_VARIANTS.find((v) => v.key === d.widthVariant) || FONT_WIDTH_VARIANTS[2];
    const layout = layoutRichText({
      text: d.text || '',
      box: { width: d.width, height: d.height },
      fontFamily: variant.family,
      fontFamilyItalic: variant.familyItalic,
      italic: !!d.italic,
      normalWeight,
      boldWeight,
      fontSize,
      align: d.align || 'left',
    });
    group.destroyChildren();
    layout.runs.forEach((run) => {
      if (!run.text.trim() && !/\s/.test(run.text)) return;
      group.add(new window.Konva.Text({
        x: run.x, y: run.y,
        text: run.text,
        fontSize,
        fontFamily: run.family,
        fontStyle: `${d.italic ? 'italic ' : ''}${run.bold ? boldWeight : normalWeight}`,
        fill: d.color || '#ffffff',
      }));
    });
  }
  createBodyTextNode(d) {
    const group = new window.Konva.Group({
      x: d.x, y: d.y, width: d.width, height: d.height, rotation: d.rotation || 0,
    });
    this.buildBodyRuns(group, d);
    return group;
  }
  updateBodyTextNode(group, d) {
    group.position({ x: d.x, y: d.y });
    group.size({ width: d.width, height: d.height });
    group.rotation(d.rotation || 0);
    this.buildBodyRuns(group, d);
  }

  createTextNode(d) {
    return d.role === 'title' ? this.createTitleTextNode(d) : this.createBodyTextNode(d);
  }
  updateTextNode(node, d) {
    if (d.role === 'title') this.updateTitleTextNode(node, d);
    else this.updateBodyTextNode(node, d);
  }

  // ---- FRAME (marco guía de "compartido") ----
  createFrameNode(d) {
    const group = new window.Konva.Group({
      x: d.x, y: d.y, rotation: d.rotation || 0,
    });
    const rect = new window.Konva.Rect({
      width: d.width, height: d.height,
      cornerRadius: d.cornerRadius || 0,
      fill: '#f54949',
      name: 'rect',
    });
    const labelBg = new window.Konva.Rect({
      x: 10, y: 10, width: 170, height: 34,
      fill: 'rgba(20,20,20,0.75)', cornerRadius: 6,
      name: 'labelBg',
    });
    const label = new window.Konva.Text({
      text: `compartido ${d.ratioKey}`,
      fontSize: 20,
      fontFamily: FONT_FAMILY,
      fill: '#ffffff',
      x: 18, y: 17,
      name: 'label',
    });
    group.add(rect);
    group.add(labelBg);
    group.add(label);
    group.width(d.width);
    group.height(d.height);
    return group;
  }
  updateFrameNode(node, d) {
    node.position({ x: d.x, y: d.y });
    node.rotation(d.rotation || 0);
    node.width(d.width);
    node.height(d.height);
    const rect = node.findOne('.rect');
    rect.size({ width: d.width, height: d.height });
    rect.cornerRadius(d.cornerRadius || 0);
    const label = node.findOne('.label');
    label.text(`compartido ${d.ratioKey}`);
    const labelBg = node.findOne('.labelBg');
    labelBg.width(Math.max(120, label.width() + 16));
  }

  // ---- BACKGROUND (color sólido) ----
  createBackgroundNode(d) {
    return new window.Konva.Rect({
      x: d.x, y: d.y, width: d.width, height: d.height,
      rotation: d.rotation || 0,
      fill: d.color || '#ffffff',
    });
  }
  updateBackgroundNode(node, d) {
    node.position({ x: d.x, y: d.y });
    node.size({ width: d.width, height: d.height });
    node.rotation(d.rotation || 0);
    node.fill(d.color || '#ffffff');
  }

  // ---- GRADIENT ----
  createGradientNode(d) {
    const node = new window.Konva.Rect({
      x: d.x, y: d.y, width: d.width, height: d.height,
      rotation: d.rotation || 0,
    });
    this.applyGradientFill(node, d);
    return node;
  }
  updateGradientNode(node, d) {
    node.position({ x: d.x, y: d.y });
    node.size({ width: d.width, height: d.height });
    node.rotation(d.rotation || 0);
    this.applyGradientFill(node, d);
  }
  applyGradientFill(node, d) {
    const c = d.color || '#282929';
    node.fillLinearGradientStartPoint({ x: 0, y: 0 });
    node.fillLinearGradientEndPoint({ x: 0, y: d.height });
    node.fillLinearGradientColorStops([0, hexToRgba(c, 0), 1, hexToRgba(c, 0.92)]);
  }
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Capas cuyo layer.exportable === false se ocultan durante la captura
// (fondos de referencia, guías como el marco de "compartido", etc.)
function hideNonExportable(stageRenderer, state) {
  const hiddenNodes = [];
  for (const l of state.layers) {
    if (l.exportable === false) {
      const node = stageRenderer.nodes.get(l.id);
      if (node && node.visible()) { hiddenNodes.push(node); node.visible(false); }
    }
  }
  return hiddenNodes;
}

// Los avisos "+ imagen" de las capas de imagen sin foto son solo una ayuda
// visual del editor: nunca deben aparecer en el PNG exportado.
function hidePlaceholders(stageRenderer) {
  const shapes = stageRenderer.layer.find('.placeholder, .placeholderLabel');
  const hidden = [];
  shapes.forEach((s) => { if (s.visible()) { hidden.push(s); s.visible(false); } });
  return hidden;
}

function captureStage(stageRenderer) {
  const hiddenPlaceholders = hidePlaceholders(stageRenderer);
  stageRenderer.layer.draw();
  const dataURL = stageRenderer.stage.toDataURL({
    pixelRatio: 1 / stageRenderer.stage.scaleX(),
    mimeType: 'image/png',
  });
  hiddenPlaceholders.forEach((s) => s.visible(true));
  return dataURL;
}

// Modo A: todos los elementos exportables fusionados en un único PNG.
export async function exportPNG(stageRenderer) {
  const state = getState();
  const hidden = hideNonExportable(stageRenderer, state);
  stageRenderer.transformer.nodes([]);
  stageRenderer.layer.draw();

  const dataURL = captureStage(stageRenderer);

  hidden.forEach((n) => n.visible(true));
  stageRenderer.layer.draw();
  return dataURL;
}

// Modo B: un PNG independiente por cada capa exportable, todos del mismo
// tamaño de lienzo (1080x1920) y con el resto transparente, para que
// conserven su posición relativa si luego se recomponen.
export async function exportLayersSeparately(stageRenderer) {
  const state = getState();
  const exportableLayers = state.layers.filter((l) => l.exportable !== false && l.visible !== false);
  const originalVisibility = new Map();
  state.layers.forEach((l) => {
    const node = stageRenderer.nodes.get(l.id);
    if (node) originalVisibility.set(l.id, node.visible());
  });

  stageRenderer.transformer.nodes([]);
  const results = [];
  for (const l of exportableLayers) {
    state.layers.forEach((other) => {
      const node = stageRenderer.nodes.get(other.id);
      if (node) node.visible(other.id === l.id);
    });
    stageRenderer.layer.draw();
    results.push({ id: l.id, name: l.name, dataURL: captureStage(stageRenderer) });
  }

  // restaurar visibilidad original
  state.layers.forEach((l) => {
    const node = stageRenderer.nodes.get(l.id);
    if (node) node.visible(originalVisibility.get(l.id) !== false);
  });
  stageRenderer.layer.draw();

  return results;
}
