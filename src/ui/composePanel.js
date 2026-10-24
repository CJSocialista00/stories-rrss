import { getState, updateLayer, removeLayer, selectLayer } from '../engine/state.js';
import { getFontSetKey } from '../engine/fontSets.js';
import { swatches } from './swatches.js';
import { GALLERIES } from '../templates/gallery.js';
import { AJT_LOGO_VARIANTS, AJT_LOGO_LAYOUTS } from '../templates/ajtLogo.js';
import {
  isComposeBase, addTitleSticker, addBodySticker, addLocationSticker, addImageSticker, addAjtLogoSticker,
  editTitle, editBody, editLocation, editAjtLogo, scaleLayer, placeLayer, ANCHORS,
} from '../templates/compose.js';

// Panel de «Imagen + stickers». Tres vistas:
//  · principal: subir imagen + añadir elementos
//  · elemento seleccionado: editar, colocar (9 posiciones), tamaño, quitar
//  · selector de logos / stickers temáticos
// Todo con botones grandes y un solo nivel de profundidad.

const KIND_LABEL = { title: 'Título', body: 'Texto', location: 'Ubicación', image: 'Sticker', ajtLogo: 'Logo AJT' };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function button(label, cls, onClick, aria) {
  const b = el('button', cls, label);
  b.type = 'button';
  if (aria) b.setAttribute('aria-label', aria);
  b.addEventListener('click', onClick);
  return b;
}
function section(title) {
  const s = el('section', 'cp-section');
  if (title) s.appendChild(el('h4', 'cp-title', title));
  return s;
}
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function sizeControl(layer, onChange) {
  const wrap = el('div', 'cp-size');
  const step = (ratio) => { scaleLayer(getState().layers.find((l) => l.id === layer.id), ratio); onChange(); };
  wrap.appendChild(el('span', 'cp-size-hint', 'Tamaño'));
  const btns = el('div', 'cp-size-btns');
  btns.appendChild(button('−', 'cp-round', () => step(1 / 1.12), 'Más pequeño'));
  btns.appendChild(button('+', 'cp-round', () => step(1.12), 'Más grande'));
  wrap.appendChild(btns);
  return wrap;
}

// Sombra: interruptor + difuminado, distancia y opacidad (en %). Los cambios se aplican en vivo.
function shadowControls(layer, onChange, rerender) {
  const sec = section('Sombra');
  const cur = () => getState().layers.find((l) => l.id === layer.id) || layer;
  const top = el('div', 'cp-shadow-head');
  const sw = el('button', 'cp-switch' + (layer.shadowOn ? ' on' : ''));
  sw.type = 'button';
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', String(!!layer.shadowOn));
  sw.setAttribute('aria-label', 'Sombra');
  sw.appendChild(el('i'));
  sw.addEventListener('click', () => { updateLayer(layer.id, { shadowOn: !cur().shadowOn }); onChange(); rerender(); });
  top.appendChild(el('span', 'cp-shadow-label', layer.shadowOn ? 'Activada' : 'Desactivada'));
  top.appendChild(sw);
  sec.appendChild(top);
  if (layer.shadowOn) {
    const slider = (label, key, fallback, max) => {
      const row = el('label', 'cp-slider');
      const value = Math.round((layer[key] ?? fallback) * (key === 'shadowOpacity' ? 100 : 1));
      const text = el('span', 'cp-slider-text', `${label} `);
      const out = el('b', '', `${value}%`);
      text.appendChild(out);
      const input = el('input');
      Object.assign(input, { type: 'range', min: 0, max, step: 1, value });
      input.addEventListener('input', () => {
        out.textContent = `${input.value}%`;
        updateLayer(layer.id, { [key]: key === 'shadowOpacity' ? Number(input.value) / 100 : Number(input.value) });
        onChange();
      });
      row.appendChild(text);
      row.appendChild(input);
      return row;
    };
    sec.appendChild(slider('Opacidad', 'shadowOpacity', 0.7, 100));
    sec.appendChild(slider('Difuminado', 'shadowBlurPct', 35, 100));
    sec.appendChild(slider('Distancia', 'shadowDistPct', 20, 100));
  }
  return sec;
}

function anchorGrid(renderer, layer, onChange) {
  const grid = el('div', 'cp-anchors');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', 'Posición');
  ANCHORS.forEach(([key, label]) => {
    const b = el('button', 'cp-anchor');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.appendChild(el('i', `dot ${key}`));
    b.addEventListener('click', () => { placeLayer(getState().layers.find((l) => l.id === layer.id), key); onChange(); });
    grid.appendChild(b);
  });
  return grid;
}

export function renderComposePanel(container, { renderer, onChange, onRefresh, requestUpload }) {
  const state = getState();
  const base = state.layers.find(isComposeBase);
  const selected = state.layers.find((l) => l.id === state.selectedId && l.cmpKind);
  container.innerHTML = '';
  const root = el('div', 'cp');
  container.appendChild(root);
  const view = container.dataset.cpView || 'main';
  const setView = (v) => { container.dataset.cpView = v; renderComposePanel(container, { renderer, onChange, onRefresh, requestUpload }); };
  const afterAdd = async (promiseOrLayer) => { await promiseOrLayer; container.dataset.cpView = 'main'; await onRefresh(); };

  // ---------- elemento seleccionado ----------
  if (selected) {
    const head = el('div', 'cp-head');
    head.appendChild(el('h3', 'cp-name', KIND_LABEL[selected.cmpKind] || 'Elemento'));
    const actions = el('div', 'cp-actions');
    actions.appendChild(button('🗑', 'cp-icon-danger', () => { removeLayer(selected.id); onRefresh(); }, 'Quitar este elemento'));
    actions.appendChild(button('Listo', 'cp-done', () => { selectLayer(null); onRefresh(); }));
    head.appendChild(actions);
    root.appendChild(head);

    const edit = section();
    const k = selected.cmpKind;
    if (k === 'title' || k === 'body' || k === 'location') {
      const input = el(k === 'body' ? 'textarea' : 'input', 'cp-input');
      if (k !== 'body') input.type = 'text';
      if (k === 'body') input.rows = 3;
      input.value = k === 'location' ? selected.cmpText : selected.text;
      input.placeholder = k === 'location' ? 'Nombre del lugar' : k === 'title' ? 'Título' : 'Escribe tu texto…';
      input.maxLength = k === 'body' ? 400 : 60;
      input.setAttribute('aria-label', input.placeholder);
      const apply = debounce(async (v) => {
        const cur = getState().layers.find((l) => l.id === selected.id);
        if (!cur) return;
        if (k === 'title') await editTitle(cur, { text: v });
        else if (k === 'body') editBody(cur, { text: v });
        else await editLocation(cur, { text: v || 'MADRID' });
        onChange();
      }, k === 'location' ? 300 : 80);
      input.addEventListener('input', () => apply(input.value));
      edit.appendChild(input);
      const colorNow = k === 'location' ? selected.cmpColor : selected.color;
      edit.appendChild(swatches(colorNow, {
        onPick: async (hex) => {
          const cur = getState().layers.find((l) => l.id === selected.id);
          if (k === 'location') await editLocation(cur, { color: hex });
          else updateLayer(cur.id, { color: hex });
          onChange(); setView('main');
        },
      }));
    } else if (k === 'image' && selected.cmpRecolor) {
      edit.appendChild(swatches(selected.tint, { original: true, onPick: (hex) => { updateLayer(selected.id, { tint: hex }); onChange(); setView('main'); } }));
    } else if (k === 'ajtLogo') {
      const input = el('input', 'cp-input');
      input.type = 'text'; input.value = selected.ajtText || ''; input.placeholder = 'Nombre de la ubicación'; input.maxLength = 40;
      input.setAttribute('aria-label', 'Nombre de la ubicación');
      const apply = debounce(async (v) => { await editAjtLogo(getState().layers.find((l) => l.id === selected.id), { ajtText: v }); onChange(); }, 200);
      input.addEventListener('input', () => apply(input.value));
      edit.appendChild(input);
      const seg = (list, key, current) => {
        const r = el('div', 'cp-seg');
        list.forEach((o) => {
          const b = el('button', current === o.key ? 'active' : '', o.label);
          b.type = 'button';
          b.addEventListener('pointerdown', async (e) => { e.preventDefault(); await editAjtLogo(getState().layers.find((l) => l.id === selected.id), { [key]: o.key }); onChange(); setView('main'); });
          r.appendChild(b);
        });
        return r;
      };
      edit.appendChild(seg(AJT_LOGO_LAYOUTS, 'ajtLayout', selected.ajtLayout));
      edit.appendChild(seg(AJT_LOGO_VARIANTS, 'ajtVariant', selected.ajtVariant));
    }
    if (edit.childNodes.length) root.appendChild(edit);

    const pos = section('Posición y tamaño');
    const row = el('div', 'cp-posrow');
    row.appendChild(anchorGrid(renderer, selected, onChange));
    row.appendChild(sizeControl(selected, onChange));
    pos.appendChild(row);
    pos.appendChild(el('p', 'cp-hint', 'También puedes arrastrarlo con el dedo, y girarlo o cambiar el tamaño desde las esquinas.'));
    root.appendChild(pos);
    root.appendChild(shadowControls(selected, onChange, () => setView(container.dataset.cpView || 'main')));
    return;
  }

  // ---------- selector de logos / temáticos ----------
  if (view === 'logos' || view === 'tematicos') {
    const brand = getFontSetKey();
    const head = el('div', 'cp-head');
    head.appendChild(button('‹ Volver', 'cp-back', () => setView('main')));
    head.appendChild(el('h3', 'cp-name', view === 'logos' ? 'Logo' : 'Temáticos'));
    root.appendChild(head);
    const grid = el('div', 'cp-picker');
    const addItem = (item, label, ratio) => {
      const b = el('button', 'cp-pick');
      b.type = 'button';
      const img = el('img'); img.src = item.src; img.alt = '';
      b.appendChild(img); b.appendChild(el('span', '', label));
      b.addEventListener('click', () => afterAdd(addImageSticker(item, { name: label, widthRatio: ratio })));
      grid.appendChild(b);
    };
    if (view === 'logos') {
      if (brand === 'ajt') {
        const b = el('button', 'cp-pick text'); b.type = 'button';
        b.appendChild(el('strong', '', 'Logo con ubicación')); b.appendChild(el('span', '', 'Editable'));
        b.addEventListener('click', () => afterAdd(addAjtLogoSticker()));
        grid.appendChild(b);
      } else {
        GALLERIES[brand === 'oes' ? 'logosOes' : 'logosCjs'].items.forEach((it) => addItem(it, it.label, 0.6));
      }
    } else {
      GALLERIES.huelga11n.items.filter((i) => i.recolor).forEach((it) => addItem(it, it.label, 0.6));
      if (brand === 'cjs') GALLERIES.militar.items.forEach((it) => addItem(it, `¿Quieres militar? · ${it.label}`, 0.4));
    }
    root.appendChild(grid);
    return;
  }

  // ---------- principal ----------
  const photo = section('Imagen');
  photo.appendChild(button(base && base.src ? '📷  Cambiar imagen' : '📷  Subir imagen', base && base.src ? 'cp-secondary' : 'cp-primary', () => requestUpload(base.id)));
  if (!(base && base.src)) photo.appendChild(el('p', 'cp-hint', 'La imagen será tu marco. Después añade stickers y textos encima.'));
  root.appendChild(photo);

  const add = section('Añadir');
  const grid = el('div', 'cp-add');
  [
    ['📍', 'Ubicación', () => afterAdd(addLocationSticker())],
    ['T', 'Título', () => afterAdd(addTitleSticker())],
    ['¶', 'Texto', () => afterAdd(addBodySticker())],
    ['◭', 'Logo', () => setView('logos')],
    ['★', 'Temáticos', () => setView('tematicos')],
  ].forEach(([icon, label, fn]) => {
    const b = el('button', 'cp-add-btn');
    b.type = 'button';
    b.appendChild(el('span', 'ic', icon));
    b.appendChild(el('span', '', label));
    b.addEventListener('click', fn);
    grid.appendChild(b);
  });
  add.appendChild(grid);
  root.appendChild(add);
  const count = state.layers.filter((l) => l.cmpKind).length;
  if (count) root.appendChild(el('p', 'cp-hint', 'Toca un elemento sobre la imagen para editarlo o colocarlo.'));
}
