import { getState, loadDocument, addLayer, undo, redo, updateLayer, serializeDocument, setCanvasSize, subscribe } from './engine/state.js';
import { computeTextTitleGeometry, computeLocationGeometry, computePhotoBadgeGeometry, pinAssetForColor, defaultBodyStickerBox } from './templates/locationGenerator.js';
import { StageRenderer, exportPNG, exportLayersSeparately } from './engine/stageRenderer.js';
import { makeTextLayer, makeImageLayer, makeLogoLayer, makePinLayer, makeFrameLayer, makeBackgroundLayer } from './engine/layerFactory.js';
import { listTemplates, loadTemplateDoc, saveAsNewTemplate, deleteTemplate } from './templates/store.js';
import { renderLayerList } from './ui/layerList.js';
import { renderProps, renderQuickPanel } from './ui/propsPanel.js';
import { dataURLToBlob, dataURLToUint8Array, downloadBlob } from './lib/download.js';
import { createZip } from './lib/zip.js';
import { COLORS } from './engine/constants.js';

const BRAND_COLORS = [COLORS.white, COLORS.red, COLORS.black].map((c) => c.toLowerCase());

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

async function waitFonts() {
  try {
    // cargamos TODAS las @font-face declaradas (normal + itálica de cada
    // ancho: Variable/Condensed/Semicondensed/Wide), en vez de intentar
    // enumerar a mano cada combinación de peso/estilo que se vaya a usar —
    // eso se quedaba desactualizado cada vez que añadíamos un estilo nuevo
    // y provocaba que el navegador usara una tipografía de reserva (p.ej.
    // Times New Roman) mientras la real cargaba en segundo plano sin que
    // el lienzo se volviera a dibujar.
    const loads = [];
    document.fonts.forEach((fontFace) => loads.push(fontFace.load().catch(() => {})));
    await Promise.all(loads);
    await document.fonts.ready;
  } catch { /* fuentes ya listas o navegador sin soporte de la API */ }
}

// Generadores rápidos (sticker de texto, de ubicación, foto con ubicación):
// tras cualquier cambio de contenido/estilo se recalcula la geometría entera
// (tamaño de lienzo incluido) para que el resultado sea siempre una vista
// previa fiel de lo que se va a exportar, sin que el usuario mueva nada a mano.
function regenerateQuick() {
  const state = getState();
  const mode = state.quickGenerator;
  if (!mode) return;

  if (mode === 'title') {
    const text = state.layers.find((l) => l.type === 'text');
    if (!text) return;
    // modo título: siempre bloqueado y ajustado al contenido (lienzo incluido),
    // recalculado con el ancho/peso/cursiva que tenga la capa en ese momento
    const g = computeTextTitleGeometry(text.text, {
      widthVariant: text.widthVariant || 'extracondensed',
      weight: text.weight || 800,
      italic: text.italic !== false,
    });
    setCanvasSize(g.canvasW, g.canvasH);
    updateLayer(text.id, {
      text: g.text, x: g.textX, y: g.textY, width: g.textW, height: g.textH,
      fontSize: g.fontSize, letterSpacing: g.letterSpacing, locked: true, autoFit: false,
    }, { history: false });
  } else if (mode === 'body') {
    const text = state.layers.find((l) => l.type === 'text');
    if (!text) return;
    if (text.locked) {
      // se acaba de pasar de título a cuerpo: se desbloquea y se da una caja
      // de trabajo amplia, libre, con ajuste de línea normal
      const box = defaultBodyStickerBox();
      setCanvasSize(box.canvasW, box.canvasH);
      updateLayer(text.id, {
        x: box.x, y: box.y, width: box.width, height: box.height,
        locked: false, autoFit: true, letterSpacing: 0,
      }, { history: false });
    }
    // ya desbloqueado no se recalcula nada más: el usuario maneja su propia
    // caja (posición/tamaño) como en el editor normal
  } else if (mode === 'location' || mode === 'photoLocation') {
    // la ubicación solo admite colores corporativos: cualquier otro (p. ej.
    // de un espacio de trabajo guardado antes) vuelve a blanco
    const text = state.layers.find((l) => l.type === 'text');
    if (text && !BRAND_COLORS.includes((text.color || '').toLowerCase())) {
      updateLayer(text.id, { color: COLORS.white }, { history: false });
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
  const isSticker = state.quickGenerator === 'location' || state.quickGenerator === 'title' || state.quickGenerator === 'body';
  const isBlack = !!text && (text.color || '').toLowerCase() === COLORS.black.toLowerCase();
  document.getElementById('canvasArea').classList.toggle('light-preview', isSticker && isBlack);
}

// Se llama en cada tecla / paso de slider: varias llamadas dentro del mismo
// fotograma se agrupan en un único recálculo + redibujado.
let refreshCanvasFrame = null;
function refreshCanvas() {
  if (refreshCanvasFrame !== null) return;
  refreshCanvasFrame = requestAnimationFrame(async () => {
    refreshCanvasFrame = null;
    regenerateQuick();
    updatePreviewBackground();
    await renderer.render();
    if (getState().quickGenerator) fitStage();
  });
}

function refreshProps() {
  const state = getState();
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
  regenerateQuick();
  updatePreviewBackground();
  await renderer.render();
  refreshLayers();
  refreshProps();
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
function openDrawer() { templatesDrawer.classList.remove('hidden'); populateTemplateList(); }
function closeDrawer() { templatesDrawer.classList.add('hidden'); }

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
  workspaces.set(currentTemplateId, serializeDocument());
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
  if (!doc) return;
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
  await refreshAll();
  fitStage(); // cada plantilla puede tener un tamaño de lienzo distinto
  if (doc.quickGenerator) { openSheet(); switchTab('props'); }
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
      img.onerror = () => resolve(original);
      img.onload = () => {
        const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
        if (scale >= 1) { resolve(original); return; }
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        // PNG conserva transparencias (logos, recortes); el resto, JPEG
        resolve(file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92));
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

async function init() {
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
      const dataURL = await exportPNG(renderer);
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
    addLayer(makeBackgroundLayer({ name: 'Fondo' }), { atBottom: true });
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
    readImageScaled(file).then(async (src) => {
      updateLayer(layerId, { src });
      await refreshAll();
    }).catch((err) => {
      console.error('Error cargando imagen', err);
      alert('No se ha podido cargar la imagen.');
    });
  });
}

init();
