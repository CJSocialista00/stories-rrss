import { brandColors } from '../engine/fontSets.js';

// Muestras redondas con los colores de la marca activa (nada de selector libre:
// el equipo solo usa colores corporativos). Reacciona en pointerdown: en el
// móvil, con el teclado abierto, el primer toque lo cierra y el «click» se
// perdía fuera del botón.
export function swatches(current, { original = false, onPick }) {
  const row = document.createElement('div');
  row.className = 'cp-swatches';
  row.setAttribute('role', 'group');
  row.setAttribute('aria-label', 'Color');
  const options = [...(original ? [{ label: 'Original', hex: null }] : []), ...brandColors()];
  const cur = current ? current.toLowerCase() : null;
  options.forEach((c) => {
    const active = cur === (c.hex ? c.hex.toLowerCase() : null);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cp-swatch' + (active ? ' active' : '') + (c.hex ? '' : ' original');
    b.setAttribute('aria-label', c.label);
    b.setAttribute('aria-pressed', String(active));
    b.title = c.label;
    if (c.hex) b.style.background = c.hex; else b.textContent = 'A';
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      onPick(c.hex);
    });
    row.appendChild(b);
  });
  return row;
}
