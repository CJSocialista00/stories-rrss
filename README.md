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
