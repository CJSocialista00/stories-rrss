import { FONT_WIDTH_VARIANTS } from './constants.js';
import { bodyWeights } from './richText.js';

// Las 90 fuentes estáticas de Acumin no se descargan todas al abrir la app:
// solo las que usa el documento actual, justo antes de medir/dibujar. Así el
// arranque en el móvil es ligero y cambiar de peso/ancho/cursiva carga solo
// esa variante.

function familyFor(widthKey) {
  const v = FONT_WIDTH_VARIANTS.find((x) => x.key === widthKey) || FONT_WIDTH_VARIANTS[3];
  return v.family;
}

// mismas reglas por defecto que StageRenderer.computeFont
export function fontSpecsForState(state) {
  const specs = new Set();
  for (const d of state.layers) {
    if (d.type !== 'text') continue;
    const isTitle = d.role === 'title';
    const family = familyFor(d.widthVariant || (isTitle ? 'extracondensed' : 'normal'));
    const style = d.italic ? 'italic ' : '';
    if (isTitle) {
      specs.add(`${style}${d.weight || 800} 100px "${family}"`);
    } else {
      const { normal, bold } = bodyWeights(d); // base + negrita parcial (**así**)
      specs.add(`${style}${normal} 100px "${family}"`);
      specs.add(`${style}${bold} 100px "${family}"`);
    }
  }
  return [...specs];
}

// Busca el FontFace exacto (familia + peso + estilo) declarado en fonts.css.
// No usamos document.fonts.check(): en Safari (iPhone) devuelve "cargada"
// para fuentes que no lo están, así que nunca se descargaban y el lienzo se
// quedaba dibujando en Times New Roman para siempre.
function parseSpec(spec) {
  const m = /^(italic )?(\d+) \d+px "(.+)"$/.exec(spec);
  return m ? { style: m[1] ? 'italic' : 'normal', weight: m[2], family: m[3] } : null;
}

// Si hay varias (p. ej. una que falló y su reintento), la mejor: cargada >
// cargando > sin cargar > con error.
const STATUS_RANK = { loaded: 0, loading: 1, unloaded: 2, error: 3 };
function faceFor(spec) {
  const p = parseSpec(spec);
  if (!p) return null;
  let best = null;
  document.fonts.forEach((f) => {
    if (f.family.replace(/["']/g, '') !== p.family || f.style !== p.style || String(f.weight) !== p.weight) return;
    if (!best || STATUS_RANK[f.status] < STATUS_RANK[best.status]) best = f;
  });
  return best;
}

// Ruta del archivo de cada fuente (mismo esquema que src/fonts.css).
const FAMILY_FILE_KEY = {
  'CJS Acumin ExtraCondensed': 'extracondensed',
  'CJS Acumin Condensed': 'condensed',
  'CJS Acumin SemiCondensed': 'semicondensed',
  'CJS Acumin': 'normal',
  'CJS Acumin Wide': 'wide',
};

// Una descarga fallida (corte de red en el móvil) deja el FontFace en estado
// "error" para siempre: el texto se quedaba en Times hasta recargar la
// página. Se crea un FontFace nuevo con el mismo archivo y se reintenta.
async function loadWithRetry(spec, face, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      if (face.status !== 'error') { await face.load(); if (face.status === 'loaded') return; }
    } catch { /* se reintenta abajo */ }
    if (i === attempts - 1) return; // sin más intentos: se queda la de reserva
    const p = parseSpec(spec);
    const key = p && FAMILY_FILE_KEY[p.family];
    if (!key || typeof FontFace === 'undefined') return;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    const url = new URL(`assets/fonts/acumin/acumin-${key}-${p.weight}-${p.style}.woff`, document.baseURI).href;
    face = new FontFace(p.family, `url("${url}") format("woff")`, { weight: p.weight, style: p.style, display: 'block' });
    document.fonts.add(face);
  }
}

const inFlight = new Map();

// Descarga (y espera) las fuentes indicadas que aún no estén cargadas.
// Devuelve true si ha tenido que cargar alguna.
export async function ensureFonts(specs) {
  if (!document.fonts) return false;
  const pending = [];
  for (const spec of specs) {
    const face = faceFor(spec);
    if (face) {
      if (face.status !== 'loaded') {
        // una sola descarga (con sus reintentos) por fuente aunque la pidan
        // varios redibujados a la vez
        if (!inFlight.has(spec)) {
          inFlight.set(spec, loadWithRetry(spec, face).finally(() => inFlight.delete(spec)));
        }
        pending.push(inFlight.get(spec));
      }
    } else if (document.fonts.load) {
      pending.push(document.fonts.load(spec).catch(() => {}));
    }
  }
  if (!pending.length) return false;
  await Promise.all(pending);
  return true;
}

// Como ensureFonts, pero repite hasta que las fuentes del estado ACTUAL estén
// listas: si mientras se descargaba una fuente el usuario pulsó otro botón de
// tipografía, también hay que esperar a esa antes de dibujar.
export async function ensureFontsFor(getState) {
  let loadedAny = false;
  for (let i = 0; i < 6; i++) {
    const specs = fontSpecsForState(getState());
    const loaded = await ensureFonts(specs);
    loadedAny = loadedAny || loaded;
    if (!loaded) break;
    const now = fontSpecsForState(getState());
    if (now.length === specs.length && now.every((s, k) => s === specs[k])) break;
  }
  return loadedAny;
}
