import { getState, loadDocument, addLayer, undo, redo, updateLayer, serializeDocument, setCanvasSize, subscribe } from './engine/state.js';
import { computeTextTitleGeometry, computeLocationGeometry, computePhotoBadgeGeometry, pinAssetForColor } from './templates/locationGenerator.js';
import { StageRenderer, exportPNG, exportLayersSeparately } from './engine/stageRenderer.js';
import { makeTextLayer, makeImageLayer, makeLogoLayer, makePinLayer, makeFrameLayer, makeBackgroundLayer } from './engine/layerFactory.js';
import { listTemplates, loadTemplateDoc, saveAsNewTemplate, deleteTemplate } from './templates/store.js';
import { renderLayerList } from './ui/layerList.js';
import { renderProps, renderQuickPanel, renderGalleryPanel, renderAjtLogoPanel } from './ui/propsPanel.js';
import { initHome } from './ui/home.js';
import { renderComposePanel } from './ui/composePanel.js';
import { drawAjtLogo, ensureAjtLogoAssets, ajtVariant, ajtColor } from './templates/ajtLogo.js';
import { GALLERIES, galleryItem, galleryFileName, galleryColorFileName } from './templates/gallery.js';
import { recolorBlob } from './lib/recolor.js';
import { dataURLToBlob, dataURLToUint8Array, downloadBlob } from './lib/download.js';
import { createZip } from './lib/zip.js';
import { layoutRichText, bodyWeights } from './engine/richText.js';
import { ensureFonts, ensureFontsFor } from './engine/fonts.js';
import { FONT_SETS, getFontSetKey, setFontSetKey, getWidthVariant, titleFamily, snapWeight, brandColor, brandHexes, recolorPatch } from './engine/fontSets.js';

const stageContainer = document.getElementById('stageContainer');
const layerListEl = document.getElementById('layerList');
const propsContentEl = document.getElementById('propsContent');
const templateNameLabel = document.getElementById('templateNameLabel');
const templateListItems = document.getElementById('templateListItems');
const templatesDrawer = document.getElementById('templatesDrawer');
const fileInputImage = document.getElementById('fileInputImage');
const bottomSheet = document.getElementById('bottomSheet');

let pendingImageLayerId = null;
let renderer;
let currentTemplateId = null;
let home;

async function waitFonts() {
  // solo el rótulo del juego de tipografía activo (en CJS, ExtraCondensed
  // Black Itálica); el resto se carga bajo demanda con ensureFonts()
  const family = titleFamily();
  await ensureFonts([`italic ${snapWeight(family, 800)} 100px "${family}"`]);
}

// Generadores rápidos (sticker de texto, de ubicación, foto con ubicación):
// tras cualquier cambio de contenido/estilo se recalcula la geometría entera
// (tamaño de lienzo incluido) para que el resultado sea siempre una vista
// previa fiel de lo que se va a exportar, sin que el usuario mueva nada a mano.
function regenerateQuick() {
  const state = getState();
  const mode = state.quickGenerator;
  if (!mode) return;

  if (mode === 'gallery') {
    const img = state.layers.find((l) => l.type === 'image');
    const item = img && galleryItem(img.galleryKey, img.itemKey);
    if (!item) return;
    setCanvasSize(item.width, item.height);
    updateLayer(img.id, { src: item.src, x: 0, y: 0, width: item.width, height: item.height, fit: 'contain', locked: true, tint: item.recolor ? img.galleryColor || null : null }, { history: false });
    return;
  }
  if (mode === 'logoAjt') {
    const img = state.layers.find((l) => l.type === 'image');
    if (!img) return;
    const logo = drawAjtLogo(img);
    setCanvasSize(logo.width, logo.height);
    updateLayer(img.id, { src: logo.canvas.toDataURL('image/png'), x: 0, y: 0, width: logo.width, height: logo.height, fit: 'contain', locked: true }, { history: false });
    return;
  }
  if (mode === 'title') {
    const text = state.layers.find((l) => l.type === 'text');
    if (!text) return;
    // modo título: siempre bloqueado y ajustado al contenido (lienzo incluido),
    // recalculado con el ancho/peso/cursiva que tenga la capa en ese momento
    const g = computeTextTitleGeometry(text.text, {
      widthVariant: text.widthVariant || 'extracondensed',
      weight: text.weight || 800,
      italic: text.italic !== false,
      initialFont: text.initialFont || null,
    });
    setCanvasSize(g.canvasW, g.canvasH);
    updateLayer(text.id, {
      text: g.text, x: g.textX, y: g.textY, width: g.textW, height: g.textH,
      fontSize: g.fontSize, letterSpacing: g.letterSpacing, locked: true, autoFit: false,
    }, { history: false });
  } else if (mode === 'body') {
    const text = state.layers.find((l) => l.type === 'text');
    if (!text) return;
    // El lienzo se ajusta SIEMPRE al texto: tamaño de letra y ancho de línea
    // los elige el usuario; el texto salta de línea solo (las palabras
    // demasiado largas se parten) y el sticker crece en alto/ancho según lo
    // escrito. Antes la caja era fija y el texto se salía por la derecha.
    const pill = state.layers.find((l) => l.type === 'pill' && l.targetId === text.id);
    const fontSize = text.fontSize || 64;
    const lineWidth = text.lineWidth || 1000;
    const align = text.align || 'left';
    const variant = getWidthVariant(text.widthVariant || 'normal');
    const { normal, bold } = bodyWeights(text);
    const layout = layoutRichText({
      text: text.text || '', box: { width: lineWidth, height: Infinity },
      fontFamily: variant.family, fontFamilyItalic: variant.familyItalic, italic: !!text.italic,
      normalWeight: normal, boldWeight: bold, fontSize, align,
    });
    const contentW = Math.ceil(align === 'justify' && layout.lineCount > 1 ? lineWidth : layout.maxLineWidth) + 1;
    const contentH = Math.ceil(Math.max(layout.usedHeight, fontSize * 1.08));
    // margen: cursivas/acentos que sobresalen + el relleno de la pastila
    const margin = Math.round(fontSize * 0.5 + 20 + (pill ? pill.padding || 0 : 0));
    setCanvasSize(contentW + margin * 2, contentH + margin * 2);
    updateLayer(text.id, {
      x: margin, y: margin, width: contentW, height: contentH, rotation: 0,
      fontSize, lineWidth, align, autoFit: false, locked: true,
    }, { history: false });
  } else if (mode === 'location' || mode === 'photoLocation') {
    // la ubicación solo admite colores corporativos: cualquier otro (p. ej.
    // de un espacio de trabajo guardado antes) vuelve a blanco
    const text = state.layers.find((l) => l.type === 'text');
    if (text && !brandHexes().includes((text.color || '').toLowerCase())) {
      updateLayer(text.id, { color: brandColor('white') }, { history: false });
    }
  }
  if (mode === 'location') {
    const pin = state.layers.find((l) => l.type === 'pin');
    const text = state.layers.find((l) => l.type === 'text');
    if (!pin || !text) return;
    const g = computeLocationGeometry(text.text);
    setCanvasSize(g.canvasW, g.canvasH);
    updateLayer(pin.id, { asset: pinAssetForColor(text.color), tint: text.color || '#ffffff', x: g.pinX, y: g.pinY, width: g.pinW, height: g.pinH }, { history: false });
    updateLayer(text.id, { text: g.cityName, x: g.textX, y: g.textY, width: g.textW, height: g.textH, fontSize: g.fontSize, letterSpacing: g.letterSpacing }, { history: false });
  } else if (mode === 'photoLocation') {
    const pin = state.layers.find((l) => l.type === 'pin');
    const text = state.layers.find((l) => l.type === 'text');
    if (!pin || !text) return;
    const corner = pin.corner || 'bottom-left';
    const scale = pin.scale || 1;
    const g = computePhotoBadgeGeometry(text.text, { corner, canvasW: state.canvas.width, canvasH: state.canvas.height, scale });
    updateLayer(pin.id, { asset: pinAssetForColor(text.color), tint: text.color || '#ffffff', corner, scale, x: g.pinX, y: g.pinY, width: g.pinW, height: g.pinH }, { history: false });
    updateLayer(text.id, { text: g.cityName, x: g.textX, y: g.textY, width: g.textW, height: g.textH, fontSize: g.fontSize, letterSpacing: g.letterSpacing }, { history: false });
  }
}

// Stickers (sin fondo) en negro corporativo: el damero oscuro del lienzo los
// hacía casi invisibles y parecía que el color no cambiaba. Se aclara el
// fondo de la vista previa (no afecta al PNG exportado, que es transparente).
function updatePreviewBackground() {
  const state = getState();
  const text = state.layers.find((l) => l.type === 'text');
  // con pastila de fondo, lo que se ve sobre el damero es la pastila
  const pill = state.layers.find((l) => l.type === 'pill' && l.visible !== false);
  const image = state.layers.find((l) => l.type === 'image');
  const gallerySticker = state.quickGenerator === 'gallery' && image && (galleryItem(image.galleryKey, image.itemKey) || {}).recolor;
  const isSticker = gallerySticker || state.quickGenerator === 'location' || state.quickGenerator === 'title' || state.quickGenerator === 'body';
  const visibleColor = gallerySticker ? image.galleryColor : pill ? pill.color : text && text.color;
  const isBlack = (visibleColor || '').toLowerCase() === brandColor('dark');
  const galleryData = state.quickGenerator === 'gallery' && image ? galleryItem(image.galleryKey, image.itemKey) : null;
  const area = document.getElementById('canvasArea');
  area.classList.toggle('light-preview', (isSticker && isBlack) || !!(galleryData && galleryData.lightPreview));
  // el logo de AJT se ve sobre el fondo de la combinación elegida (manual de marca)
  area.style.background = state.quickGenerator === 'logoAjt' && image ? ajtColor(ajtVariant(image.ajtVariant).bg) : '';
}

// Se llama en cada tecla / paso de slider: varias llamadas dentro del mismo
// fotograma se agrupan en un único recálculo + redibujado.
let refreshCanvasFrame = null;
function refreshCanvas() {
  if (refreshCanvasFrame !== null) return;
  refreshCanvasFrame = requestAnimationFrame(async () => {
    refreshCanvasFrame = null;
    await ensureFontsFor(getState);
    if (getState().quickGenerator === 'logoAjt') await ensureAjtLogoAssets();
    regenerateQuick();
    updatePreviewBackground();
    await renderer.render();
    if (getState().quickGenerator) fitStage();
  });
}

function getLayerItemKey() {
  const img = getState().layers.find((l) => l.type === 'image');
  return img && img.itemKey;
}

// Archivo del sticker: el original, o recoloreado a tamaño completo si es de
// un solo color y se ha elegido un color de marca
async function galleryFileData(item, hex) {
  if (item.recolor && hex) return { name: galleryColorFileName(item, hex), blob: await recolorBlob(item.src, hex) };
  const res = await fetch(item.src);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { name: galleryFileName(item), blob: await res.blob() };
}

async function downloadGalleryItem(item, hex) {
  try {
    const f = await galleryFileData(item, hex);
    downloadBlob(f.blob, f.name);
  } catch (err) {
    console.error('Error descargando sticker', err);
    alert('No se ha podido descargar el sticker. Vuelve a intentarlo.');
  }
}

async function downloadGalleryAll(gallery, hex) {
  try {
    const files = [];
    for (const item of gallery.items) {
      const f = await galleryFileData(item, hex);
      files.push({ name: f.name, data: new Uint8Array(await f.blob.arrayBuffer()) });
    }
    downloadBlob(createZip(files), gallery.zipName || 'stickers.zip');
  } catch (err) {
    console.error('Error descargando stickers', err);
    alert('No se han podido descargar los stickers. Vuelve a intentarlo.');
  }
}

// Descarga del logo de AJT: ajustado al logo, o centrado en un lienzo cuadrado
// transparente (como el resto de stickers, para Instagram)
async function downloadAjtLogo(square) {
  try {
    const img = getState().layers.find((l) => l.type === 'image');
    await ensureAjtLogoAssets();
    const { canvas } = drawAjtLogo(img);
    let url = canvas.toDataURL('image/png');
    if (square) url = await padStickerToSquare(url);
    const name = (img.ajtText || 'logo').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'logo';
    downloadBlob(dataURLToBlob(url), `ajt-${name}-${img.ajtLayout}-${img.ajtVariant}${square ? '-cuadrado' : ''}.png`);
  } catch (err) {
    console.error('Error descargando el logo', err);
    alert('No se ha podido descargar el logo. Vuelve a intentarlo.');
  }
}

function refreshProps() {
  const state = getState();
  if (state.quickGenerator === 'gallery') {
    const img = state.layers.find((l) => l.type === 'image');
    const gallery = img && GALLERIES[img.galleryKey];
    if (!gallery) return;
    renderGalleryPanel(propsContentEl, {
      gallery,
      currentKey: img.itemKey,
      color: img.galleryColor || null,
      onSelect: (key) => { updateLayer(img.id, { itemKey: key }); refreshAll(); },
      onColor: (hex) => { updateLayer(img.id, { galleryColor: hex }); refreshAll(); },
      onDownload: () => downloadGalleryItem(galleryItem(img.galleryKey, getLayerItemKey()), img.galleryColor || null),
      onDownloadAll: () => downloadGalleryAll(gallery, img.galleryColor || null),
    });
    return;
  }
  if (state.quickGenerator === 'compose') {
    renderComposePanel(propsContentEl, { renderer, onChange: refreshCanvas, onRefresh: refreshAll, requestUpload: (layerId) => window.dispatchEvent(new CustomEvent('request-image-upload', { detail: { layerId } })) });
    return;
  }
  if (state.quickGenerator === 'logoAjt') {
    const img = state.layers.find((l) => l.type === 'image');
    if (!img) return;
    renderAjtLogoPanel(propsContentEl, {
      logo: img,
      onChange: (patch) => { updateLayer(img.id, patch); refreshCanvas(); },
      onDownload: () => downloadAjtLogo(false),
      onDownloadSquare: () => downloadAjtLogo(true),
    });
    return;
  }
  if (state.quickGenerator === 'location' || state.quickGenerator === 'photoLocation') {
    renderQuickPanel(propsContentEl, { onChange: refreshCanvas });
    return;
  }
  // en "título"/"cuerpo" solo hay una capa de texto: la seleccionamos sola,
  // sin que el usuario tenga que ir a tocarla a la lista de capas
  let selectedId = state.selectedId;
  if ((state.quickGenerator === 'title' || state.quickGenerator === 'body') && !selectedId) {
    const text = state.layers.find((l) => l.type === 'text');
    if (text) selectedId = text.id;
  }
  renderProps(propsContentEl, selectedId, { onChange: refreshCanvas, onRemove: refreshAll });
}

function refreshLayers() {
  renderLayerList(layerListEl, {
    onSelect: async () => {
      await renderer.render();
      refreshProps();
      openSheet();
      switchTab('props');
    },
  });
}

async function refreshAll() {
  // El panel y la lista de capas se pintan YA con el estado nuevo; antes se
  // esperaba a descargar las fuentes y, mientras tanto (1-2 s en el móvil),
  // seguían en pantalla los botones de la plantilla anterior, desconectados:
  // las pulsaciones se perdían y había que pulsar varias veces o recargar.
  refreshLayers();
  refreshProps();
  await ensureFontsFor(getState);
  if (getState().quickGenerator === 'logoAjt') await ensureAjtLogoAssets();
  regenerateQuick();
  updatePreviewBackground();
  await renderer.render();
  if (getState().quickGenerator) fitStage();
}

// ---- bottom sheet ----
function openSheet() { bottomSheet.classList.remove('collapsed'); }
function toggleSheet() { bottomSheet.classList.toggle('collapsed'); }
function switchTab(tab) {
  document.querySelectorAll('.sheet-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
  document.getElementById(`tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`).classList.add('active');
}

// ---- drawer de plantillas ----
function openDrawer() { templatesDrawer.classList.remove('hidden'); populateFontSetPicker(); populateTemplateList(); }
function closeDrawer() { templatesDrawer.classList.add('hidden'); }

// Juego de tipografía (CJS / OES / AJT): cambia solo la letra de todas las
// plantillas; textos, colores y composición se quedan como están.
// el color de acento de la interfaz es el rojo de la marca activa
function applyAccent() {
  document.documentElement.style.setProperty('--accent', brandColor('accent'));
}

async function changeBrand(key) {
  if (key === getFontSetKey()) return;
  const previous = getFontSetKey();
  setFontSetKey(key);
  applyAccent();
  // el diseño en curso pasa a los colores de la nueva marca (rojo → rojo
  // de la marca, blanco, negro); el resto de plantillas lo hace al abrirse
  getState().layers.slice().forEach((l) => {
    const patch = recolorPatch(l, previous, key);
    if (patch) updateLayer(l.id, patch, { history: false });
  });
  saveCurrentWorkspace();
  persistWorkspaces();
  populateFontSetPicker();
  await refreshAll();
}

function populateFontSetPicker() {
  const picker = document.getElementById('fontSetPicker');
  picker.innerHTML = '';
  Object.values(FONT_SETS).forEach((set) => {
    const btn = document.createElement('button');
    btn.className = 'fontset-btn' + (set.key === getFontSetKey() ? ' active' : '');
    btn.innerHTML = `<strong>${set.label}</strong><span>${set.detail}</span>`;
    btn.addEventListener('click', () => changeBrand(set.key));
    picker.appendChild(btn);
  });
}

function populateTemplateList() {
  templateListItems.innerHTML = '';
  const groups = new Map();
  listTemplates().forEach((t) => {
    const cat = t.category || 'Plantillas';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(t);
  });
  groups.forEach((items, cat) => {
    const heading = document.createElement('div');
    heading.className = 'template-group-heading';
    heading.textContent = cat;
    templateListItems.appendChild(heading);
    items.forEach((t) => {
      const item = document.createElement('div');
      item.className = 'template-item' + (t.id === currentTemplateId ? ' active' : '');
      const name = document.createElement('span');
      name.className = 'tpl-name';
      name.textContent = t.name + (t.builtin ? '' : ' (propia)');
      item.appendChild(name);
      if (workspaces.has(t.id)) {
        // la plantilla tiene cambios guardados: opción de volver a empezarla
        const reset = document.createElement('button');
        reset.className = 'tpl-del';
        reset.title = 'Empezar de cero esta plantilla';
        reset.textContent = '↺';
        reset.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`¿Descartar los cambios de "${t.name}" y empezarla de cero?`)) {
            if (t.id === currentTemplateId) { applyTemplate(t.id, { fresh: true }); closeDrawer(); } else { resetWorkspace(t.id); populateTemplateList(); }
          }
        });
        item.appendChild(reset);
      }
      if (!t.builtin) {
        const del = document.createElement('button');
        del.className = 'tpl-del';
        del.textContent = '🗑';
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`¿Eliminar la plantilla "${t.name}"?`)) {
            deleteTemplate(t.id);
            resetWorkspace(t.id);
            populateTemplateList();
          }
        });
        item.appendChild(del);
      }
      item.addEventListener('click', () => { applyTemplate(t.id); closeDrawer(); });
      templateListItems.appendChild(item);
    });
  });
}

// ---- espacios de trabajo independientes por plantilla ----
// Cada plantilla guarda su propio diseño en curso: al saltar a otra y volver,
// recuperas lo que tenías ahí (textos, colores, fotos...) en vez de que una
// plantilla pise a otra o se pierda el trabajo. Se guarda también en el
// navegador para que sobreviva a recargar la página.
const WORKSPACES_KEY = 'rrss_workspaces_v1';
const LAST_TEMPLATE_KEY = 'rrss_last_template_v1';
const workspaces = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(WORKSPACES_KEY) || '{}');
  Object.entries(saved).forEach(([id, doc]) => workspaces.set(id, doc));
} catch { /* almacenamiento no disponible o corrupto: empezamos de cero */ }

let switchingTemplate = false;
let persistTimer = null;
function saveCurrentWorkspace() {
  if (!currentTemplateId || switchingTemplate) return;
  // las galerías de stickers no guardan nada (son visores): se abren siempre limpias
  if (getState().quickGenerator === 'gallery') return;
  // se anota la marca para traducir los colores si se abre con otra distinta
  const doc = serializeDocument();
  // el logo de AJT se redibuja desde sus ajustes: no se guarda el PNG (pesa)
  if (doc.quickGenerator === 'logoAjt') doc.layers = doc.layers.map((l) => (l.type === 'image' ? { ...l, src: null } : l));
  workspaces.set(currentTemplateId, { ...doc, brand: getFontSetKey() });
}

// Colores del documento traducidos de la marca en que se guardó a la activa
function adoptBrand(doc, fromKey) {
  const to = getFontSetKey();
  if (!doc || fromKey === to) return doc;
  const copy = JSON.parse(JSON.stringify(doc));
  copy.layers.forEach((l) => {
    const patch = recolorPatch(l, fromKey, to);
    if (patch) Object.assign(l, patch);
  });
  return copy;
}
function persistWorkspaces() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(WORKSPACES_KEY, JSON.stringify(Object.fromEntries(workspaces)));
    } catch {
      // sin espacio (fotos grandes): se mantiene en memoria mientras la
      // pestaña siga abierta, pero no se rompe nada
    }
  }, 600);
}
subscribe(() => {
  if (switchingTemplate) return;
  saveCurrentWorkspace();
  persistWorkspaces();
});
window.addEventListener('pagehide', () => { saveCurrentWorkspace(); clearTimeout(persistTimer); try { localStorage.setItem(WORKSPACES_KEY, JSON.stringify(Object.fromEntries(workspaces))); } catch { /* sin espacio */ } });

function resetWorkspace(id) {
  workspaces.delete(id);
  persistWorkspaces();
}

async function applyTemplate(id, { fresh = false } = {}) {
  if (fresh) resetWorkspace(id);
  const freshDoc = loadTemplateDoc(id);
  let doc = workspaces.get(id) || freshDoc;
  // espacio guardado con una estructura antigua de la plantilla: se empieza de nuevo
  if (doc !== freshDoc && freshDoc && (doc.templateVersion || 1) !== (freshDoc.templateVersion || 1)) doc = freshDoc;
  if (freshDoc && freshDoc.quickGenerator === 'gallery') doc = freshDoc;
  if (!doc) return;
  // los diseños nuevos vienen en los colores de CJS; los guardados, en los de su marca
  doc = adoptBrand(doc, doc === freshDoc ? 'cjs' : doc.brand || 'cjs');
  saveCurrentWorkspace(); // lo que había en la plantilla anterior se queda en su espacio
  switchingTemplate = true;
  currentTemplateId = id;
  try { localStorage.setItem(LAST_TEMPLATE_KEY, id); } catch { /* ignorar */ }
  templateNameLabel.textContent = doc.templateName || 'Plantilla';
  loadDocument(doc);
  switchingTemplate = false;
  // en los generadores rápidos no hay capas que navegar: directo al panel
  // único, sin pestañas de Capas/Añadir de por medio
  bottomSheet.classList.toggle('quick-mode', !!doc.quickGenerator);
  updateExportButton();
  await refreshAll();
  fitStage(); // cada plantilla puede tener un tamaño de lienzo distinto
  if (doc.quickGenerator) { openSheet(); switchTab('props'); }
}

// En los generadores rápidos (stickers, logos) el botón principal descarga
// directamente: un toque, sin menú. En las stories mantiene el menú Exportar.
function updateExportButton() {
  const btn = document.getElementById('btnExport');
  const quick = !!getState().quickGenerator;
  btn.textContent = quick ? '⬇ Descargar' : 'Exportar ▾';
  btn.setAttribute('aria-label', quick ? 'Descargar PNG' : 'Exportar');
}

const canvasAreaEl = document.getElementById('canvasArea');
const zoomLabel = document.getElementById('btnZoomFit');
const ZOOM_MIN = 0.15;
const ZOOM_MAX = 4;

function fitStage() {
  renderer.fitToContainer(canvasAreaEl);
  updateZoomLabel();
}

function updateZoomLabel() {
  zoomLabel.textContent = `${Math.round((renderer.currentScale / renderer.fitScale) * 100)}%`;
}

function setZoom(scale) {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale));
  renderer.setScale(clamped);
  updateZoomLabel();
}

function zoomBy(factor) {
  setZoom(renderer.currentScale * factor);
}

// Las fotos del móvil (12+ MP) en base64 dentro del estado hacían que cada
// paso de historial, redibujado y exportación fuera lentísimo y podían tumbar
// la pestaña por memoria. Se reducen a un lado máximo de sobra para stories.
const MAX_IMAGE_SIDE = 2400;
function readImageScaled(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const original = reader.result;
      const img = new Image();
      img.onerror = () => resolve({ src: original, width: null, height: null });
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
        if (scale >= 1) { resolve({ src: original, width: img.width, height: img.height }); return; }
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        // PNG conserva transparencias (logos, recortes); el resto, JPEG
        const src = file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
        resolve({ src, width: c.width, height: c.height });
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

// Instagram muestra como un recuadro BLANCO la transparencia de los PNG de
// sticker muy alargados y ajustados al texto (pasaba igual desde Photoshop).
// Con una caja transparente más grande alrededor sí la respeta, así que los
// stickers se exportan centrados en un lienzo cuadrado transparente.
const STICKER_MODES = ['title', 'body', 'location', 'logoAjt'];
function padStickerToSquare(dataURL) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const side = Math.max(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = side;
      c.height = side;
      c.getContext('2d').drawImage(img, Math.round((side - img.width) / 2), Math.round((side - img.height) / 2));
      resolve(c.toDataURL('image/png'));
    };
    img.src = dataURL;
  });
}
async function finalizeExport(dataURL) {
  return STICKER_MODES.includes(getState().quickGenerator) ? padStickerToSquare(dataURL) : dataURL;
}

async function init() {
  applyAccent();
  await waitFonts();

  renderer = new StageRenderer(stageContainer, {
    onSelect: async () => { await renderer.render(); refreshLayers(); refreshProps(); openSheet(); switchTab('props'); },
  });

  let startId = 'builtin_repost_simple';
  try {
    const last = localStorage.getItem(LAST_TEMPLATE_KEY);
    if (last && listTemplates().some((t) => t.id === last)) startId = last;
  } catch { /* ignorar */ }
  await applyTemplate(startId);
  fitStage();

  window.addEventListener('resize', fitStage);

  // red de seguridad: si una fuente termina de llegar por cualquier vía, se
  // vuelve a medir y dibujar (nunca se queda pegado en la fuente de reserva)
  if (document.fonts && document.fonts.addEventListener) {
    document.fonts.addEventListener('loadingdone', () => {
      renderer.remeasureText();
      refreshCanvas();
    });
  }

  // ---- zoom ----
  document.getElementById('btnZoomIn').addEventListener('click', () => zoomBy(1.25));
  document.getElementById('btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.25));
  document.getElementById('btnZoomFit').addEventListener('click', fitStage);

  canvasAreaEl.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return; // solo zoom con pellizco de trackpad / ctrl+rueda
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
  }, { passive: false });

  // pellizco táctil (pinch) en móvil
  let pinchStartDist = null;
  let pinchStartScale = 1;
  canvasAreaEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchStartScale = renderer.currentScale;
    }
  }, { passive: true });
  canvasAreaEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchStartDist) {
      e.preventDefault();
      const [a, b] = e.touches;
      const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      setZoom(pinchStartScale * (dist / pinchStartDist));
    }
  }, { passive: false });
  canvasAreaEl.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) pinchStartDist = null;
  });

  // topbar
  home = initHome({
    root: document.getElementById('homeScreen'),
    getBrand: getFontSetKey,
    onBrand: changeBrand,
    onOpen: async (id) => { home.hide(); await applyTemplate(id); },
    onOpenAll: () => { home.hide(); openDrawer(); },
    getLast: () => {
      try {
        const id = localStorage.getItem(LAST_TEMPLATE_KEY);
        const t = id && listTemplates().find((x) => x.id === id);
        return t ? { id: t.id, name: t.name } : null;
      } catch { return null; }
    },
  });
  document.getElementById('btnHome').addEventListener('click', () => home.show());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (home.isOpen()) home.hide();
    else if (!templatesDrawer.classList.contains('hidden')) closeDrawer();
  });
  document.getElementById('btnTemplatesMenu').addEventListener('click', openDrawer);
  document.getElementById('btnCloseTemplates').addEventListener('click', closeDrawer);
  templatesDrawer.addEventListener('click', (e) => { if (e.target === templatesDrawer) closeDrawer(); });

  document.getElementById('btnUndo').addEventListener('click', async () => { undo(); await refreshAll(); });
  document.getElementById('btnRedo').addEventListener('click', async () => { redo(); await refreshAll(); });

  const exportMenu = document.getElementById('exportMenu');
  const btnExportEl = document.getElementById('btnExport');
  function slugify(name) {
    return (name || 'capa').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'capa';
  }

  function positionExportMenu() {
    const rect = btnExportEl.getBoundingClientRect();
    // anclado por la derecha del botón, desplegándose hacia la izquierda y
    // hacia abajo, para que nunca se salga de la pantalla en móvil.
    exportMenu.style.top = `${Math.round(rect.bottom + 6)}px`;
    exportMenu.style.right = `${Math.round(window.innerWidth - rect.right)}px`;
    exportMenu.style.left = 'auto';
  }

  btnExportEl.addEventListener('click', () => {
    const st = getState();
    if (st.quickGenerator === 'gallery') {
      const g = st.layers.find((l) => l.type === 'image');
      downloadGalleryItem(galleryItem(g.galleryKey, g.itemKey), g.galleryColor || null);
      return;
    }
    if (st.quickGenerator) { document.getElementById('btnExportSingle').click(); return; }
    const willOpen = exportMenu.classList.contains('hidden');
    if (willOpen) positionExportMenu();
    exportMenu.classList.toggle('hidden');
  });
  window.addEventListener('resize', () => { if (!exportMenu.classList.contains('hidden')) positionExportMenu(); });
  document.addEventListener('click', (e) => {
    if (!exportMenu.contains(e.target) && e.target.id !== 'btnExport') exportMenu.classList.add('hidden');
  });

  document.getElementById('btnExportSingle').addEventListener('click', async () => {
    exportMenu.classList.add('hidden');
    try {
      const dataURL = await finalizeExport(await exportPNG(renderer));
      downloadBlob(dataURLToBlob(dataURL), `story_${Date.now()}.png`);
    } catch (err) {
      console.error('Error exportando PNG', err);
      alert('No se ha podido generar el PNG. Vuelve a intentarlo.');
    }
  });

  document.getElementById('btnExportSeparate').addEventListener('click', async () => {
    exportMenu.classList.add('hidden');
    try {
      const layers = await exportLayersSeparately(renderer);
      for (const l of layers) l.dataURL = await finalizeExport(l.dataURL);
      const stamp = Date.now();
      const files = layers.map((l, i) => ({
        name: `${String(i + 1).padStart(2, '0')}_${slugify(l.name)}.png`,
        data: dataURLToUint8Array(l.dataURL),
      }));
      const zipBlob = createZip(files);
      downloadBlob(zipBlob, `story_${stamp}_capas.zip`);
    } catch (err) {
      console.error('Error exportando capas por separado', err);
      alert('No se han podido generar los PNG por separado. Vuelve a intentarlo.');
    }
  });

  // bottom sheet
  document.getElementById('sheetHandle').addEventListener('click', toggleSheet);
  document.querySelectorAll('.sheet-tab').forEach((btn) => {
    btn.addEventListener('click', () => { openSheet(); switchTab(btn.dataset.tab); });
  });

  // añadir capas
  document.getElementById('btnAddText').addEventListener('click', async () => {
    addLayer(makeTextLayer({ name: 'Texto nuevo', text: 'Nuevo texto' }));
    await refreshAll(); switchTab('props');
  });
  document.getElementById('btnAddImage').addEventListener('click', async () => {
    addLayer(makeImageLayer({ name: 'Imagen nueva' }));
    await refreshAll(); switchTab('props');
  });
  document.getElementById('btnAddLogo').addEventListener('click', async () => {
    addLayer(makeLogoLayer({ name: 'Logo nuevo' }));
    await refreshAll(); switchTab('props');
  });
  document.getElementById('btnAddPin').addEventListener('click', async () => {
    addLayer(makePinLayer({ name: 'Pin nuevo' }));
    await refreshAll(); switchTab('props');
  });
  document.getElementById('btnAddFrame').addEventListener('click', async () => {
    addLayer(makeFrameLayer({ name: 'Marco compartido' }));
    await refreshAll(); switchTab('props');
  });
  document.getElementById('btnAddBackground').addEventListener('click', async () => {
    addLayer(makeBackgroundLayer({ name: 'Fondo', color: brandColor('dark') }), { atBottom: true });
    await refreshAll(); switchTab('props');
  });

  document.getElementById('btnSaveTemplate').addEventListener('click', () => {
    const name = prompt('Nombre de la plantilla:');
    if (!name) return;
    const doc = serializeDocument();
    doc.templateName = name;
    saveAsNewTemplate(name, doc);
    templateNameLabel.textContent = name;
    populateTemplateList();
  });

  window.addEventListener('request-image-upload', (e) => {
    pendingImageLayerId = e.detail.layerId;
    fileInputImage.click();
  });

  fileInputImage.addEventListener('change', () => {
    const file = fileInputImage.files[0];
    if (!file || !pendingImageLayerId) return;
    const layerId = pendingImageLayerId;
    pendingImageLayerId = null;
    fileInputImage.value = '';
    readImageScaled(file).then(async ({ src, width, height }) => {
      if ((getState().quickGenerator === 'photoLocation' || getState().quickGenerator === 'compose') && width && height) {
        // Foto con ubicación: el lienzo toma el tamaño y la proporción REALES
        // de la foto (antes se recortaba a un 4:5 fijo); la ubicación se
        // recoloca después sobre ese tamaño en regenerateQuick().
        setCanvasSize(width, height);
        updateLayer(layerId, { src, x: 0, y: 0, width, height, fit: 'cover' });
      } else {
        updateLayer(layerId, { src });
      }
      await refreshAll();
    }).catch((err) => {
      console.error('Error cargando imagen', err);
      alert('No se ha podido cargar la imagen.');
    });
  });
  home.show(); // al abrir la app: elegir qué hacer (la plantilla anterior queda detrás)
}

init();
