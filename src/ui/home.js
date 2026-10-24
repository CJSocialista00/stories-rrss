import { FONT_SETS } from '../engine/fontSets.js';

// Menú de inicio, de arriba abajo:
//   1. Marca (CJS · AJT · OES)
//   2. Plantillas · Textos · Stickers
//   3. Stickers → Recursos de marca · Temáticos
//   4. Recursos de marca → logo y stickers de la marca; Temáticos → Huelga, etc.
// Cada nivel es una pantalla con «‹ Volver»; el último toque abre la plantilla.

const LOGO_BY_BRAND = { cjs: 'logo_cjs', oes: 'logo_oes', ajt: 'logo_ajt' };

// Cada nodo: { title, hint, icon, id } abre una plantilla; { title, hint, icon, children } abre otro nivel.
// children puede ser una función de la marca activa.
const MENU = [
  {
    title: 'Plantillas', hint: 'Stories y fotos ya montadas', icon: '▤',
    children: [
      { title: 'Story con texto', hint: 'Título y cuerpo debajo', icon: '▤', id: 'builtin_repost_simple' },
      { title: 'Story con publicación', hint: 'Título, publicación y cuerpo', icon: '▣', id: 'builtin_repost_shared' },
      { title: 'Artículo', hint: 'Plantilla fija de artículo', icon: '☰', id: 'builtin_article' },
      { title: 'Imagen + stickers', hint: 'Tu imagen con stickers y textos que mueves a mano', icon: '✚', id: 'compose_photo' },
      { title: 'Foto con ubicación', hint: 'Tu foto con la ubicación', icon: '🖼', id: 'photo_location' },
    ],
  },
  {
    title: 'Textos', hint: 'Rótulos y cuerpos para stories', icon: 'T',
    children: [
      { title: 'Título', hint: 'Rótulo grande', icon: 'T', id: 'sticker_title' },
      { title: 'Texto', hint: 'Cuerpo de texto', icon: '¶', id: 'sticker_body' },
      { title: 'Texto con fondo', hint: 'Cuerpo sobre pastilla de color', icon: '▭', id: 'sticker_body_pill' },
    ],
  },
  {
    title: 'Stickers', hint: 'PNG listos para descargar', icon: '✦',
    children: [
      { title: 'Ubicación', hint: 'Pin con el nombre del lugar', icon: '📍', id: 'sticker_location' },
      {
        title: 'Recursos de marca', hint: 'Logos y stickers de la marca', icon: '◭',
        children: (brand) => [
          { title: `Logo ${FONT_SETS[brand].label}`, hint: brand === 'ajt' ? 'Editable: pones la ubicación' : 'Todas las versiones de color', icon: '◭', id: LOGO_BY_BRAND[brand] },
          ...(brand === 'cjs' ? [{ title: '¿Quieres militar?', hint: 'Sticker de captación', icon: '✊', id: 'sticker_militar' }] : []),
        ],
      },
      {
        title: 'Temáticos', hint: 'Campañas y movilizaciones', icon: '★',
        children: [
          { title: 'Huelga General 11N', hint: '4 stickers y fondo vertical', icon: '★', id: 'sticker_huelga_huelga-general' },
        ],
      },
    ],
  },
];

export function initHome({ root, getBrand, onBrand, onOpen, onOpenAll }) {
  let path = []; // índices elegidos en cada nivel
  let openedFrom = []; // nivel del menú desde el que se abrió la plantilla en curso

  const resolve = (node, brand) => (typeof node.children === 'function' ? node.children(brand) : node.children);

  function currentLevel(brand) {
    let items = MENU;
    const crumbs = [];
    for (const i of path) {
      const node = items[i];
      if (!node || !node.children) break;
      crumbs.push(node.title);
      items = resolve(node, brand);
    }
    return { items, crumbs };
  }

  function tile(node, index, brand) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'home-tile';
    b.innerHTML = '<span class="home-tile-icon" aria-hidden="true"></span><strong></strong><span class="home-tile-hint"></span>';
    b.querySelector('.home-tile-icon').textContent = node.icon;
    b.querySelector('strong').textContent = node.title;
    b.querySelector('.home-tile-hint').textContent = node.hint;
    b.addEventListener('click', () => {
      if (node.children) { path.push(index); render(); } else { openedFrom = path.slice(); onOpen(node.id); }
    });
    return b;
  }

  function render() {
    const brand = getBrand();
    root.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'home-inner';

    const brands = document.createElement('div');
    brands.className = 'home-brands';
    brands.setAttribute('role', 'group');
    brands.setAttribute('aria-label', 'Marca');
    Object.values(FONT_SETS).forEach((set) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'home-brand' + (set.key === brand ? ' active' : '');
      b.setAttribute('aria-pressed', String(set.key === brand));
      b.textContent = set.label;
      b.addEventListener('click', async () => { await onBrand(set.key); render(); });
      brands.appendChild(b);
    });
    inner.appendChild(brands);

    const { items, crumbs } = currentLevel(brand);
    if (crumbs.length) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'home-back';
      back.textContent = `‹ ${crumbs.length > 1 ? crumbs[crumbs.length - 2] : 'Inicio'}`;
      back.addEventListener('click', () => { path.pop(); render(); });
      inner.appendChild(back);
      const h = document.createElement('h2');
      h.textContent = crumbs.join(' › ');
      inner.appendChild(h);
    }

    const grid = document.createElement('div');
    grid.className = 'home-grid';
    items.forEach((node, i) => grid.appendChild(tile(node, i, brand)));
    inner.appendChild(grid);

    // (lista completa de plantillas oculta por ahora: todo el menú es este)

    root.appendChild(inner);
  }

  return {
    show() { path = []; render(); root.classList.remove('hidden'); },
    // vuelve al menú justo en el nivel desde el que se abrió lo que estás editando
    showPrevious() { path = openedFrom.slice(); render(); root.classList.remove('hidden'); },
    hide() { root.classList.add('hidden'); },
    isOpen() { return !root.classList.contains('hidden'); },
  };
}
