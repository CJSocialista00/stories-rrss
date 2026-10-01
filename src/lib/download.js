// Utilidades de descarga robustas: usamos Blob + URL de objeto en vez de
// `data:` URIs directamente en el atributo href, que es mucho menos fiable
// en navegadores móviles (sobre todo iOS Safari) y con archivos grandes.

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

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
