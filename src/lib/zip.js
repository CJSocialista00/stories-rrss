// Generador de ZIP mínimo (solo "store", sin compresión) sin dependencias,
// para poder descargar varios PNG como un único archivo desde el navegador.

function crc32(bytes) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const time = ((date.getHours() & 0x1F) << 11) | ((date.getMinutes() & 0x3F) << 5) | ((date.getSeconds() / 2) & 0x1F);
  const day = (((date.getFullYear() - 1980) & 0x7F) << 9) | (((date.getMonth() + 1) & 0xF) << 5) | (date.getDate() & 0x1F);
  return { time, day };
}

function writeUint32LE(arr, offset, value) {
  arr[offset] = value & 0xFF;
  arr[offset + 1] = (value >>> 8) & 0xFF;
  arr[offset + 2] = (value >>> 16) & 0xFF;
  arr[offset + 3] = (value >>> 24) & 0xFF;
}
function writeUint16LE(arr, offset, value) {
  arr[offset] = value & 0xFF;
  arr[offset + 1] = (value >>> 8) & 0xFF;
}

/**
 * files: [{ name: string, data: Uint8Array }]
 * devuelve un Blob con el .zip resultante.
 */
export function createZip(files) {
  const { time, day } = dosDateTime();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = new TextEncoder().encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    writeUint32LE(localHeader, 0, 0x04034b50);
    writeUint16LE(localHeader, 4, 20); // versión necesaria
    writeUint16LE(localHeader, 6, 0); // flags
    writeUint16LE(localHeader, 8, 0); // sin compresión (store)
    writeUint16LE(localHeader, 10, time);
    writeUint16LE(localHeader, 12, day);
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(localHeader, 18, data.length);
    writeUint32LE(localHeader, 22, data.length);
    writeUint16LE(localHeader, 26, nameBytes.length);
    writeUint16LE(localHeader, 28, 0); // sin campo extra
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    writeUint32LE(centralHeader, 0, 0x02014b50);
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 8, 0);
    writeUint16LE(centralHeader, 10, 0);
    writeUint16LE(centralHeader, 12, time);
    writeUint16LE(centralHeader, 14, day);
    writeUint32LE(centralHeader, 16, crc);
    writeUint32LE(centralHeader, 20, data.length);
    writeUint32LE(centralHeader, 24, data.length);
    writeUint16LE(centralHeader, 28, nameBytes.length);
    writeUint16LE(centralHeader, 30, 0);
    writeUint16LE(centralHeader, 32, 0);
    writeUint16LE(centralHeader, 34, 0);
    writeUint16LE(centralHeader, 36, 0);
    writeUint32LE(centralHeader, 38, 0);
    writeUint32LE(centralHeader, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;

  const end = new Uint8Array(22);
  writeUint32LE(end, 0, 0x06054b50);
  writeUint16LE(end, 4, 0);
  writeUint16LE(end, 6, 0);
  writeUint16LE(end, 8, files.length);
  writeUint16LE(end, 10, files.length);
  writeUint32LE(end, 12, centralSize);
  writeUint32LE(end, 16, centralOffset);
  writeUint16LE(end, 20, 0);

  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
}
