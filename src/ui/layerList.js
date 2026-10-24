import { getState, updateLayer, selectLayer } from '../engine/state.js';

import { icon } from './icons.js';

const TYPE_ICON = { text: 'title', image: 'photo', logo: 'logo', pin: 'pin', frame: 'compose', pill: 'text', gradient: 'layers', background: 'layers' };

export function renderLayerList(container, { onSelect } = {}) {
  container.innerHTML = '';
  const state = getState();
  // mostrar en orden inverso (arriba = capa superior)
  [...state.layers].reverse().forEach((layer) => {
    const item = document.createElement('div');
    item.className = 'layer-item' + (state.selectedId === layer.id ? ' selected' : '');
    item.addEventListener('click', () => { selectLayer(layer.id); onSelect && onSelect(layer.id); });

    const typeIcon = document.createElement('span');
    typeIcon.innerHTML = icon(TYPE_ICON[layer.type] || 'layers', 18);

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.name || layer.type;

    const vis = document.createElement('button');
    vis.className = 'layer-vis';
    vis.innerHTML = icon(layer.visible === false ? 'eyeOff' : 'eye', 18);
    vis.setAttribute('aria-label', layer.visible === false ? 'Mostrar capa' : 'Ocultar capa');
    vis.addEventListener('click', (e) => {
      e.stopPropagation();
      updateLayer(layer.id, { visible: layer.visible === false });
      renderLayerList(container, { onSelect });
    });

    item.appendChild(typeIcon);
    item.appendChild(name);
    item.appendChild(vis);
    container.appendChild(item);
  });
}
