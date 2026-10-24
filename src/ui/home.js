import { FONT_SETS } from '../engine/fontSets.js';

// Pantalla de inicio: entrar directo a lo que quieres hacer (un toque), sin
// recorrer el menú de plantillas. Arriba, la marca; después, lo último que
// usaste; después, los accesos grandes por tarea; abajo, «todo lo demás».

const LOGO_BY_BRAND = { cjs: 'logo_cjs', oes: 'logo_oes', ajt: 'logo_ajt' };

const MAIN_TILES = [
  { id: 'sticker_location', title: 'Ubicación', hint: 'Sticker con pin y ciudad', icon: '📍' },
  { id: 'sticker_title', title: 'Título', hint: 'Sticker de rótulo grande', icon: 'T' },
  { id: 'sticker_body', title: 'Texto', hint: 'Sticker de cuerpo, con o sin fondo', icon: '¶' },
  { id: 'photo_location', title: 'Foto + ubicación', hint: 'Tu foto con la ubicación', icon: '🖼' },
  { id: 'builtin_repost_simple', title: 'Story con texto', hint: 'Título y cuerpo debajo', icon: '▤' },
  { id: '@logo', title: 'Logo', hint: 'Logotipo de la marca', icon: '◭' },
];

const MORE_LINKS = [
  { id: 'sticker_body_pill', label: 'Texto con fondo' },
  { id: 'builtin_repost_shared', label: 'Story con publicación' },
  { id: 'builtin_article', label: 'Artículo' },
  { id: 'sticker_militar', label: '¿Quieres militar?' },
  { id: 'sticker_huelga_huelga-general', label: 'Huelga General 11N' },
];

export function initHome({ root, getBrand, onBrand, onOpen, onOpenAll, getLast }) {
  function tile({ title, hint, icon, id }) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'home-tile';
    b.innerHTML = '<span class="home-tile-icon" aria-hidden="true"></span><strong></strong><span class="home-tile-hint"></span>';
    b.querySelector('.home-tile-icon').textContent = icon;
    b.querySelector('strong').textContent = title;
    b.querySelector('.home-tile-hint').textContent = hint;
    b.addEventListener('click', () => onOpen(id));
    return b;
  }

  function render() {
    const brand = getBrand();
    root.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'home-inner';

    const h = document.createElement('h1');
    h.textContent = '¿Qué quieres hacer?';
    inner.appendChild(h);

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

    const last = getLast();
    if (last) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'home-continue';
      c.innerHTML = '<span>Seguir con lo último</span><strong></strong>';
      c.querySelector('strong').textContent = last.name;
      c.addEventListener('click', () => onOpen(last.id));
      inner.appendChild(c);
    }

    const grid = document.createElement('div');
    grid.className = 'home-grid';
    MAIN_TILES.forEach((t) => grid.appendChild(tile(t.id === '@logo' ? { ...t, id: LOGO_BY_BRAND[brand], hint: `Logotipo de ${FONT_SETS[brand].label}` } : t)));
    inner.appendChild(grid);

    const more = document.createElement('div');
    more.className = 'home-more';
    MORE_LINKS.forEach((m) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = m.label;
      b.addEventListener('click', () => onOpen(m.id));
      more.appendChild(b);
    });
    const all = document.createElement('button');
    all.type = 'button';
    all.textContent = 'Ver todas…';
    all.addEventListener('click', onOpenAll);
    more.appendChild(all);
    inner.appendChild(more);

    root.appendChild(inner);
  }

  return {
    show() { render(); root.classList.remove('hidden'); const f = root.querySelector('.home-tile'); if (f) f.focus({ preventScroll: true }); },
    hide() { root.classList.add('hidden'); },
    isOpen() { return !root.classList.contains('hidden'); },
  };
}
