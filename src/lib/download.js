// Utilidades de descarga robustas: usamos Blob + URL de objeto en vez de
// `data:` URIs directamente en el atributo href, que es mucho menos fiable
// en navegadores móviles (sobre todo iOS Safari) y con archivos grandes.

import { play } from './sound.js';

export function dataURLToUint8Array(dataURL) {
  const base64 = dataURL.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function dataURLToBlob(dataURL, mimeType = 'image/png') {
  return new Blob([dataURLToUint8Array(dataURL)], { type: mimeType });
}

// iPhone/iPad: el navegador no deja escribir directamente en Fotos desde una web,
// y «Descargar» manda el archivo a la app Archivos. Lo más corto que permite iOS
// es esto: se muestra la imagen y, con pulsación larga → «Añadir a Fotos» (o
// con Compartir → «Guardar imagen» si esa versión de iOS lo ofrece).
function isIOS() {
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function showSaveSheet(blob, filename) {
  const old = document.getElementById('saveSheet');
  if (old) old.remove();
  const url = URL.createObjectURL(blob);
  const file = typeof File !== 'undefined' ? new File([blob], filename, { type: blob.type }) : null;
  const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));

  const sheet = document.createElement('div');
  sheet.id = 'saveSheet';
  sheet.className = 'save-sheet';
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Guardar imagen');
  sheet.innerHTML = `
    <div class="save-card">
      <div class="save-preview"><img alt="Imagen lista para guardar"></div>
      <p class="save-help"><strong>Mantén pulsada la imagen</strong> y elige <strong>«Añadir a Fotos»</strong>.</p>
      <div class="save-actions"></div>
    </div>`;
  sheet.querySelector('img').src = url;
  const actions = sheet.querySelector('.save-actions');
  const close = () => { sheet.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const add = (label, cls, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    b.addEventListener('click', fn);
    actions.appendChild(b);
  };
  if (canShare) add('Compartir…', 'save-main', () => navigator.share({ files: [file] }).catch(() => {}));
  add('Guardar en Archivos', 'save-alt', () => saveFile(blob, filename));
  add('Cerrar', 'save-close', close);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) close(); });
  document.body.appendChild(sheet);
}

export function downloadBlob(blob, filename) {
  play('done');
  if (blob.type && blob.type.startsWith('image/') && isIOS()) {
    showSaveSheet(blob, filename);
    return;
  }
  saveFile(blob, filename);
}
