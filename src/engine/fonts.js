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
function faceFor(spec) {
  const m = /^(italic )?(\d+) \d+px "(.+)"$/.exec(spec);
  if (!m) return null;
  const style = m[1] ? 'italic' : 'normal';
  const weight = m[2];
  const family = m[3];
  let found = null;
  document.fonts.forEach((f) => {
    if (found) return;
    if (f.family.replace(/["']/g, '') === family && f.style === style && String(f.weight) === weight) found = f;
  });
  return found;
}

// Descarga (y espera) las fuentes indicadas que aún no estén cargadas.
// Devuelve true si ha tenido que cargar alguna.
export async function ensureFonts(specs) {
  if (!document.fonts) return false;
  const pending = [];
  for (const spec of specs) {
    const face = faceFor(spec);
    if (face) {
      if (face.status !== 'loaded') pending.push(face.load().catch(() => {}));
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
