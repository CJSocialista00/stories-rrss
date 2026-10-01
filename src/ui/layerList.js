import { getState, updateLayer, selectLayer } from '../engine/state.js';

const TYPE_ICON = { text: '𝐓', image: '🖼', logo: '◭', pin: '📍', frame: '▢', gradient: '▨', background: '■' };

export function renderLayerList(container, { onSelect } = {}) {
  container.innerHTML = '';
  const state = getState();
  // mostrar en orden inverso (arriba = capa superior)
  [...state.layers].reverse().forEach((layer) => {
    const item = document.createElement('div');
    item.className = 'layer-item' + (state.selectedId === layer.id ? ' selected' : '');
    item.addEventListener('click', () => { selectLayer(layer.id); onSelect && onSelect(layer.id); });

    const icon = document.createElement('span');
    icon.textContent = TYPE_ICON[layer.type] || '•';

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.name || layer.type;

    const vis = document.createElement('button');
    vis.className = 'layer-vis';
    vis.textContent = layer.visible === false ? '🚫' : '👁';
    vis.addEventListener('click', (e) => {
      e.stopPropagation();
      updateLayer(layer.id, { visible: layer.visible === false });
      renderLayerList(container, { onSelect });
    });

    item.appendChild(icon);
    item.appendChild(name);
    item.appendChild(vis);
    container.appendChild(item);
  });
}
