# Stories RRSS

Generador interno de stories y stickers de Instagram con la identidad de marca de CJS (plantillas de repost, artículo, stickers de título/cuerpo/ubicación y foto con ubicación). Funciona en el navegador, también en el móvil, y se puede instalar como app ("Añadir a pantalla de inicio").

## Probar en local

```bash
python devserver.py
```

Muestra la dirección para el ordenador y la del móvil (misma wifi).

## Publicación (GitHub Pages)

La app es estática: GitHub Pages la sirve tal cual desde la rama `main`, carpeta raíz (`Settings → Pages → Branch: main / (root)`).

Para actualizar la versión publicada basta con subir los cambios:

```bash
git push
```

En 1–2 minutos la web publicada se actualiza. El service worker pide siempre primero la versión nueva, así que en el móvil basta con recargar.

## Tipografías (CJS / OES / AJT)

Desde el menú ☰ → **Tipografía** se elige el juego de letra; las plantillas no cambian, solo la tipografía:

- **CJS**: Acumin Variable (ancho × peso × cursiva).
- **OES**: Made Outer Sans Regular y Bold, Mozilla Text (cuerpo) y títulos destacados con la primera letra en Clandy Italic (opción «Inicial Clandy»), con cursiva.
- **AJT**: Helvetica Neue Roman (texto) y Bold (negrita del cuerpo, también el `**así**`), Thunder Extra Bold (títulos), Black Condensed (rótulo alternativo) y PP Playground Medium (títulos caligráficos; respeta las minúsculas), con cursiva.

La elección se guarda en el navegador. Las fuentes están en `assets/fonts/{acumin,oes,ajt}` y se declaran en `src/fonts.css`; los juegos se definen en `src/engine/fontSets.js`. Las cursivas de Made Outer Sans, Mozilla Text y PP Playground son oblicuas de 12° generadas a partir del corte recto (esas fuentes no traen cursiva); las de Helvetica Neue, Thunder y Clandy son reales. Ojo con las licencias: Made Outer Sans es "personal use"; Helvetica Neue, Thunder, PP Playground y Clandy son comerciales o de licencia propia: revisa que puedas publicarlas.

## Colores de marca

Cada juego de tipografía trae su paleta, y los botones de color (ubicación, textos, fondos y pastillas) muestran la de la marca activa:

- **CJS**: blanco `#ffffff`, rojo `#f54949`, negro `#282929`.
- **OES**: blanco `#ffffff`, rojo `#ff4331`, negro `#000000`, turquesa `#1adcc8`.
- **AJT**: blanco `#ffffff`, rojo `#f42a39`, negro `#000000`, crema `#f3f3e9`.

Al cambiar de marca, el diseño en curso traduce sus colores (rojo → rojo de la marca, blanco, negro); los colores sin pareja se quedan como están. Las paletas están en `src/engine/fontSets.js`.

## Stickers Huelga General 11N

Sección propia del menú ☰ con tres stickers de un solo color y el **fondo vertical 9:16** (`assets/stickers/huelga11n/`). Los stickers se pueden ver y descargar en el color original o en cualquiera de los colores de la marca activa (el PNG se recolorea a tamaño completo conservando la transparencia); el fondo se descarga tal cual. También hay descarga de todos en ZIP. Para añadir más: dejar el PNG en esa carpeta y añadir su línea en `src/templates/gallery.js` (`recolor: true` si es de un solo color).
