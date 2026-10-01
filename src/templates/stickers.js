import { buildTextTitleDoc, buildTextBodyDoc, buildTextBodyPillDoc, buildLocationStickerDoc, buildPhotoLocationDoc } from './locationGenerator.js';

// Plantillas de arranque para los generadores rápidos. El contenido real se
// recalcula en vivo (main.js) según lo que el usuario escribe/sube; estas
// funciones solo dan el estado inicial al entrar en cada apartado.

export const STICKER_TEMPLATES = [
  { id: 'sticker_title', name: 'Sticker · Título', builtin: true, category: 'Stickers', doc: () => buildTextTitleDoc('QUE VIVA LA LUCHA') },
  { id: 'sticker_body', name: 'Sticker · Cuerpo', builtin: true, category: 'Stickers', doc: () => buildTextBodyDoc() },
  { id: 'sticker_body_pill', name: 'Sticker · Cuerpo con fondo', builtin: true, category: 'Stickers', doc: () => buildTextBodyPillDoc() },
  { id: 'sticker_location', name: 'Sticker · Ubicación', builtin: true, category: 'Stickers', doc: () => buildLocationStickerDoc('MADRID') },
];

export const PHOTO_TEMPLATES = [
  { id: 'photo_location', name: 'Foto con ubicación', builtin: true, category: 'Fotos', doc: () => buildPhotoLocationDoc('MADRID') },
];
