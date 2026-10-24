// Iconos de línea propios (trazo recto, mismo grosor en todos) en lugar de emojis.
// Se pintan con `currentColor`, así heredan el color del texto y del tema.

const PATHS = {
  back: '<path d="M15 5 8 12l7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="m5 13 5 5 9-11"/>',
  undo: '<path d="M9 8 4 13l5 5"/><path d="M4 13h9a6 6 0 0 1 6 6"/>',
  redo: '<path d="m15 8 5 5-5 5"/><path d="M20 13h-9a6 6 0 0 0-6 6"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5M5 20h14"/>',
  share: '<path d="M12 15V3M8 7l4-4 4 4M6 11v9h12v-9"/>',
  trash: '<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
  pin: '<path d="M12 21S5 14.5 5 9a7 7 0 0 1 14 0c0 5.500-7 12-7 12Z"/><circle cx="12" cy="9" r="2.500"/>',
  title: '<path d="M5 6h14M12 6v13"/>',
  text: '<path d="M5 7h14M5 12h14M5 17h9"/>',
  compose: '<rect x="4" y="4" width="16" height="16"/><path d="m4 16 5-5 4 4 2-2 5 5"/><circle cx="15.500" cy="8.500" r="1.500"/>',
  story: '<rect x="7" y="3" width="10" height="18"/><path d="M10 8h4M10 12h4"/>',
  storyShared: '<rect x="7" y="3" width="10" height="18"/><rect x="9.500" y="6" width="5" height="5"/><path d="M10 15h4"/>',
  article: '<path d="M5 4h14v16H5z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  photo: '<rect x="4" y="5" width="16" height="14"/><path d="m4 16 5-5 4 4 2-2 5 5"/>',
  logo: '<path d="M3 19 11 4l5 15Z"/><path d="M18 9h3v10h-3z"/>',
  star: '<path d="m12 3 2.500 6 6.500.500-5 4.500 1.500 6.500L12 17l-5.500 3.500L8 14 3 9.500 9.500 9Z"/>',
  flag: '<path d="M5 21V4M5 5h13l-3 4 3 4H5"/>',
  layers: '<path d="m12 4 9 5-9 5-9-5Z"/><path d="m3 14 9 5 9-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><path d="m4 4 16 16"/>',
  soundOn: '<path d="M4 10v4h4l5 4V6L8 10Z"/><path d="M16 9a4 4 0 0 1 0 6"/>',
  soundOff: '<path d="M4 10v4h4l5 4V6L8 10Z"/><path d="m16 9 5 6M21 9l-5 6"/>',
};

export function icon(name, size = 22) {
  const p = PATHS[name];
  if (!p) return '';
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.750" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">${p}</svg>`;
}

// Rellena los elementos con data-icon="nombre" (botones fijos del index.html)
export function paintIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 22);
  });
}
