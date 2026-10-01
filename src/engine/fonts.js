import { FONT_WIDTH_VARIANTS } from './constants.js';

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
    const weight = d.weight || (isTitle ? 800 : (d.bold ? 700 : 400));
    specs.add(`${style}${weight} 100px "${family}"`);
    if (!isTitle) specs.add(`${style}700 100px "${family}"`); // negrita parcial (**así**)
  }
  return [...specs];
}

export async function ensureFonts(specs) {
  if (!document.fonts || !document.fonts.load) return false;
  const missing = specs.filter((s) => { try { return !document.fonts.check(s); } catch { return false; } });
  if (!missing.length) return false;
  await Promise.all(missing.map((s) => document.fonts.load(s).catch(() => {})));
  return true;
}
