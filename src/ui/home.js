import { FONT_SETS, titleFamily } from '../engine/fontSets.js';
import { logoSrcFor } from '../engine/stageRenderer.js';
import { ensureFonts } from '../engine/fonts.js';
import { isMuted, setMuted } from '../lib/sound.js';
import { icon } from './icons.js';

// Menú de inicio, de arriba abajo:
//   1. Marca (CJS · OES · AJT)
//   2. Plantillas · Textos · Stickers
//   3. Stickers → Recursos de marca · Temáticos
//   4. Recursos de marca → logo y stickers de la marca; Temáticos → Huelga, etc.
// Cada nivel es una lista con «‹ Volver»; la última fila abre la plantilla.

const LOGO_BY_BRAND = { cjs: 'logo_cjs', oes: 'logo_oes', ajt: 'logo_ajt' };

// Cada nodo: { title, hint, icon, id } abre una plantilla; { title, hint, icon, children } abre otro nivel.
// children puede ser una función de la marca activa.
const MENU = [
  {
    title: 'Plantillas', hint: 'Stories y fotos ya montadas', icon: 'story',
    children: [
      { title: 'Story con texto', hint: 'Título y cuerpo debajo', icon: 'story', id: 'builtin_repost_simple' },
      { title: 'Story con publicación', hint: 'Título, publicación y cuerpo', icon: 'storyShared', id: 'builtin_repost_shared' },
      { title: 'Artículo', hint: 'Plantilla fija de artículo', icon: 'article', id: 'builtin_article' },
      { title: 'Imagen + stickers', hint: 'Tu imagen con stickers y textos que mueves a mano', icon: 'compose', id: 'compose_photo' },
      { title: 'Foto con ubicación', hint: 'Tu foto con la ubicación', icon: 'photo', id: 'photo_location' },
    ],
  },
  {
    title: 'Textos', hint: 'Rótulos y cuerpos para stories', icon: 'title',
    children: [
      { title: 'Título', hint: 'Rótulo grande', icon: 'title', id: 'sticker_title' },
      { title: 'Texto', hint: 'Cuerpo de texto', icon: 'text', id: 'sticker_body' },
      { title: 'Texto con fondo', hint: 'Cuerpo sobre fondo de color', icon: 'text', id: 'sticker_body_pill' },
    ],
  },
  {
    title: 'Stickers', hint: 'PNG listos para descargar', icon: 'star',
    children: [
      { title: 'Ubicación', hint: 'Pin con el nombre del lugar', icon: 'pin', id: 'sticker_location' },
      {
        title: 'Recursos de marca', hint: 'Logos y stickers de la marca', icon: 'layers',
        children: (brand) => [
          { title: `Logo ${FONT_SETS[brand].label}`, hint: brand === 'ajt' ? 'Editable: pones la ubicación' : 'Todas las versiones de color', icon: 'logo', id: LOGO_BY_BRAND[brand] },
          ...(brand === 'cjs' ? [{ title: '¿Quieres militar?', hint: 'Sticker de captación', icon: 'flag', id: 'sticker_militar' }] : []),
        ],
      },
      {
        title: 'Temáticos', hint: 'Campañas y movilizaciones', icon: 'flag',
        children: [
          { title: 'Huelga General 11N', hint: '4 stickers y fondo vertical', icon: 'flag', id: 'sticker_huelga_huelga-general' },
        ],
      },
    ],
  },
];

export function initHome({ root, getBrand, onBrand, onOpen }) {
  let path = []; // índices elegidos en cada nivel
  let openedFrom = []; // nivel del menú desde el que se abrió la plantilla en curso

  const resolve = (node, brand) => (typeof node.children === 'function' ? node.children(brand) : node.children);

  function currentLevel(brand) {
    let items = MENU;
    const crumbs = [];
    for (const i of path) {
      const node = items[i];
      if (!node || !node.children) break;
      crumbs.push(node);
      items = resolve(node, brand);
    }
    return { items, crumbs };
  }

  function row(node, index) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-row' + (node.children ? '' : ' leaf');
    b.innerHTML = `<span class="menu-ic">${icon(node.icon, 26)}</span><span class="menu-text"><strong></strong><small></small></span><span class="menu-go">${icon(node.children ? 'chevron' : 'plus', 20)}</span>`;
    b.querySelector('strong').textContent = node.title;
    b.querySelector('small').textContent = node.hint;
    b.addEventListener('click', () => {
      if (node.children) { path.push(index); render(); } else { openedFrom = path.slice(); onOpen(node.id); }
    });
    return b;
  }

  function render() {
    const brand = getBrand();
    root.innerHTML = '';
    root.style.setProperty('--display', `"${titleFamily()}", "Acumin Variable", sans-serif`);
    const inner = document.createElement('div');
    inner.className = 'home-inner';

    // cabecera: logo de la marca activa + sonido
    const top = document.createElement('div');
    top.className = 'home-top';
    const logo = document.createElement('img');
    logo.className = 'home-logo';
    logo.src = logoSrcFor('icon-on-black');
    logo.alt = FONT_SETS[brand].label;
    top.appendChild(logo);
    const sound = document.createElement('button');
    sound.type = 'button';
    sound.className = 'home-sound';
    const paintSound = () => {
      sound.innerHTML = icon(isMuted() ? 'soundOff' : 'soundOn', 22);
      sound.setAttribute('aria-pressed', String(!isMuted()));
      sound.setAttribute('aria-label', isMuted() ? 'Activar sonidos' : 'Silenciar sonidos');
      sound.title = sound.getAttribute('aria-label');
    };
    paintSound();
    sound.addEventListener('click', () => { setMuted(!isMuted()); paintSound(); });
    top.appendChild(sound);
    inner.appendChild(top);

    // marca
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
    const head = document.createElement('div');
    head.className = 'home-head';
    if (crumbs.length) {
      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'home-back';
      back.innerHTML = `${icon('back', 20)}<span></span>`;
      back.querySelector('span').textContent = crumbs.length > 1 ? crumbs[crumbs.length - 2].title : 'Inicio';
      back.addEventListener('click', () => { path.pop(); render(); });
      head.appendChild(back);
    }
    const h = document.createElement('h2');
    h.textContent = crumbs.length ? crumbs[crumbs.length - 1].title : 'Crear';
    head.appendChild(h);
    inner.appendChild(head);

    const list = document.createElement('div');
    list.className = 'menu-list';
    items.forEach((node, i) => list.appendChild(row(node, i)));
    inner.appendChild(list);

    root.appendChild(inner);
  }

  // El rótulo grande usa la tipografía de la marca: se carga antes de pintar
  async function paint(newPath) {
    path = newPath;
    try { await ensureFonts([`800 40px "${titleFamily()}"`]); } catch { /* se pinta con la de reserva */ }
    render();
    root.classList.remove('hidden');
  }

  return {
    show() { return paint([]); },
    // vuelve al menú justo en el nivel desde el que se abrió lo que estás editando
    showPrevious() { return paint(openedFrom.slice()); },
    hide() { root.classList.add('hidden'); },
    isOpen() { return !root.classList.contains('hidden'); },
  };
}
