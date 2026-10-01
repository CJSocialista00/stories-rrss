import { getLayer, updateLayer, removeLayer, getState } from '../engine/state.js';
import { ARTICLE_SUBTITLE_GAP } from '../templates/builtins.js';
import { COLORS, ASPECT_PRESETS, CANVAS_W, CANVAS_H, FONT_WIDTH_VARIANTS, FONT_WEIGHT_VARIANTS } from '../engine/constants.js';
import { LOGO_KINDS, logoKindOf, PIN_VARIANTS } from '../engine/stageRenderer.js';

function row(labelText, inputEl) {
  const r = document.createElement('div');
  r.className = 'prop-row';
  const label = document.createElement('label');
  label.textContent = labelText;
  r.appendChild(label);
  r.appendChild(inputEl);
  return r;
}

function rangeWithNumber(min, max, step, value, onChange) {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flex = '1';
  wrap.style.gap = '6px';
  const range = document.createElement('input');
  Object.assign(range, { type: 'range', min, max, step, value });
  const num = document.createElement('input');
  Object.assign(num, { type: 'number', min, max, step, value });
  range.addEventListener('input', () => { num.value = range.value; onChange(Number(range.value)); });
  num.addEventListener('input', () => { range.value = num.value; onChange(Number(num.value)); });
  wrap.appendChild(range);
  wrap.appendChild(num);
  return wrap;
}

// Panel único para los generadores rápidos (ubicación / foto+ubicación):
// pin+texto (y foto) se tratan como un solo elemento, no como capas sueltas
// que haya que ir seleccionando una a una.
export function renderQuickPanel(container, { onChange } = {}) {
  container.innerHTML = '';
  const state = getState();
  const mode = state.quickGenerator;
  const pin = state.layers.find((l) => l.type === 'pin');
  const text = state.layers.find((l) => l.type === 'text');
  const image = state.layers.find((l) => l.type === 'image');
  if (!text) return;

  const patchText = (p) => { updateLayer(text.id, p); onChange && onChange(); };

  const g = document.createElement('div');
  g.className = 'prop-group';

  if (mode === 'photoLocation' && image) {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.style.width = '100%';
    btn.style.marginBottom = '12px';
    btn.textContent = image.src ? 'Cambiar foto…' : '+ Añadir foto';
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('request-image-upload', { detail: { layerId: image.id } }));
    });
    g.appendChild(btn);
  }

  const textarea = document.createElement('textarea');
  textarea.value = text.text;
  textarea.placeholder = 'Nombre de la ciudad / lugar';
  textarea.addEventListener('input', () => patchText({ text: textarea.value }));
  g.appendChild(row('Ubicación', textarea));

  // Solo colores corporativos (sin selector libre). Se reacciona en
  // pointerdown: en el móvil, si el teclado está abierto, el primer toque lo
  // cierra, el panel se recoloca y el "click" acababa fuera del botón.
  const quickColors = document.createElement('div');
  quickColors.className = 'toggle-row';
  const currentColor = (text.color || COLORS.white).toLowerCase();
  [['Blanco', COLORS.white], ['Rojo', COLORS.red], ['Negro', COLORS.black]].forEach(([label, hex]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (currentColor === hex.toLowerCase()) b.classList.add('active');
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); // que no robe el foco ni dispare el cierre del teclado antes de aplicar
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      patchText({ color: hex });
      renderQuickPanel(container, { onChange });
    });
    quickColors.appendChild(b);
  });
  g.appendChild(row('Color', quickColors));

  if (mode === 'photoLocation' && pin) {
    const cornerGrid = document.createElement('div');
    cornerGrid.className = 'corner-grid';
    const currentCorner = pin.corner || 'bottom-left';
    [
      ['⌜ Arriba izq.', 'top-left'],
      ['⌝ Arriba der.', 'top-right'],
      ['⌞ Abajo izq.', 'bottom-left'],
      ['⌟ Abajo der.', 'bottom-right'],
    ].forEach(([label, key]) => {
      const b = document.createElement('button');
      b.textContent = label;
      if (currentCorner === key) b.style.borderColor = COLORS.red;
      b.addEventListener('click', () => {
        updateLayer(pin.id, { corner: key });
        onChange && onChange();
        renderQuickPanel(container, { onChange });
      });
      cornerGrid.appendChild(b);
    });
    g.appendChild(row('Esquina', cornerGrid));

    g.appendChild(row('Tamaño', rangeWithNumber(0.4, 2.2, 0.05, pin.scale || 1, (v) => { updateLayer(pin.id, { scale: v }); onChange && onChange(); })));
  }

  container.appendChild(g);
}

// Activa/desactiva el subtítulo del artículo. Desactivado: no se ve ni se
// exporta, y el título principal ocupa también su hueco (sin espacio vacío).
function setArticleSubtitle(enabled) {
  const state = getState();
  const mainTitle = state.layers.find((l) => l.slot === 'mainTitle');
  const subtitle = state.layers.find((l) => l.slot === 'subtitle');
  if (!mainTitle || !subtitle) return;
  updateLayer(subtitle.id, { visible: enabled }); // una capa oculta tampoco sale en el PNG
  const height = enabled
    ? subtitle.y - ARTICLE_SUBTITLE_GAP - mainTitle.y
    : subtitle.y + subtitle.height - mainTitle.y;
  updateLayer(mainTitle.id, { height: Math.max(40, height) }, { history: false });
}

export function renderProps(container, layerId, { onChange, onRemove } = {}) {
  container.innerHTML = '';
  if (!layerId) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Selecciona una capa para editarla.';
    container.appendChild(p);
    return;
  }
  const layer = getLayer(layerId);
  if (!layer) return;
  const topQuickMode = getState().quickGenerator;

  // tamaño del lienzo del documento actual (varía por apartado: story,
  // sticker, foto con cualquier proporción...), no el de la story por defecto
  const docCanvas = getState().canvas || { width: CANVAS_W, height: CANVAS_H };
  const CANVAS_W_ = docCanvas.width;
  const CANVAS_H_ = docCanvas.height;

  const isFrame = layer.type === 'frame';
  // onChange: solo redibuja el lienzo (barato, se llama en cada tecla/slider).
  // No reconstruye este panel para no perder el foco del campo que se está editando.
  const patch = (p) => { updateLayer(layerId, p); onChange && onChange(); };
  // el marco de "compartido" siempre queda centrado en X: cualquier cambio de ancho recalcula x
  const patchFrame = (p) => {
    if (p.width !== undefined) p.x = (CANVAS_W_ - p.width) / 2;
    updateLayer(layerId, p);
    onChange && onChange();
  };

  const isLogo = layer.type === 'logo' || layer.type === 'pin';
  // logos e imágenes se escalan siempre de forma uniforme (un solo slider)
  const isUniform = isLogo || layer.type === 'image';
  const isBackground = layer.type === 'background';
  const isFixedBlock = isFrame || isBackground || layer.locked === true; // sin arrastre/asas: solo controles del panel

  // Construidos aquí (usan `patch`/`layer` por clausura) pero se añaden al
  // final del panel: primero van los aspectos de contenido/gráficos, y estos
  // controles de posición/escala quedan más abajo por prioridad.
  function buildTransformGroup() {
    const gTransform = document.createElement('div');
    gTransform.className = 'prop-group';
    gTransform.innerHTML = '<strong>Posición y escala</strong>';
    if (isFrame) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = 'Fijo: solo se mueve con el slider Y de aquí abajo o los botones de proporción.';
      gTransform.appendChild(note);
    } else if (isBackground) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = 'Fondo sólido fijo: cubre todo el lienzo y no se arrastra.';
      gTransform.appendChild(note);
    } else if (layer.locked) {
      const note = document.createElement('p');
      note.className = 'hint';
      note.textContent = 'Se genera automáticamente a partir del contenido: sin controles de posición ni tamaño.';
      gTransform.appendChild(note);
    } else {
      gTransform.appendChild(row('X', rangeWithNumber(-200, CANVAS_W_ + 200, 1, layer.x, (v) => patch({ x: v }))));
    }
    if (!isBackground && !layer.locked) {
      gTransform.appendChild(row('Y', rangeWithNumber(-200, 2200, 1, layer.y, (v) => patch({ y: v }))));
    }

    if (isUniform && !isFixedBlock) {
      // un único slider de tamaño: escala ancho y alto a la vez para no deformar
      const aspect = layer.height / layer.width;
      const maxW = isLogo ? 600 : Math.max(1400, Math.round(CANVAS_W_ * 1.5));
      gTransform.appendChild(row('Tamaño', rangeWithNumber(20, maxW, 1, Math.round(layer.width), (v) => patch({ width: v, height: v * aspect }))));
    } else if (!isFixedBlock && !isLogo) {
      gTransform.appendChild(row('Ancho', rangeWithNumber(10, 1400, 1, layer.width, (v) => patch({ width: v }))));
      gTransform.appendChild(row('Alto', rangeWithNumber(10, 2200, 1, layer.height, (v) => patch({ height: v }))));
    }
    if (!isFixedBlock) {
      gTransform.appendChild(row('Rotación', rangeWithNumber(-180, 180, 1, layer.rotation || 0, (v) => patch({ rotation: v }))));
    }

    if (!isFixedBlock) {
      const centerRow = document.createElement('div');
      centerRow.className = 'toggle-row';
      const centerX = document.createElement('button');
      centerX.textContent = '⇔ Centrar X';
      centerX.addEventListener('click', () => {
        patch({ x: (CANVAS_W_ - layer.width) / 2 });
        renderProps(container, layerId, { onChange, onRemove });
      });
      centerRow.appendChild(centerX);
      const centerY = document.createElement('button');
      centerY.textContent = '⇕ Centrar Y';
      centerY.addEventListener('click', () => {
        patch({ y: (CANVAS_H_ - layer.height) / 2 });
        renderProps(container, layerId, { onChange, onRemove });
      });
      centerRow.appendChild(centerY);
      gTransform.appendChild(centerRow);

      const margin = 40;
      const cornerRow = document.createElement('div');
      cornerRow.className = 'corner-grid';
      const corners = [
        ['⌜ Arriba izq.', () => ({ x: margin, y: margin })],
        ['⌝ Arriba der.', () => ({ x: CANVAS_W_ - layer.width - margin, y: margin })],
        ['⌞ Abajo izq.', () => ({ x: margin, y: CANVAS_H_ - layer.height - margin })],
        ['⌟ Abajo der.', () => ({ x: CANVAS_W_ - layer.width - margin, y: CANVAS_H_ - layer.height - margin })],
      ];
      corners.forEach(([label, getPos]) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.addEventListener('click', () => {
          patch(getPos());
          renderProps(container, layerId, { onChange, onRemove });
        });
        cornerRow.appendChild(b);
      });
      gTransform.appendChild(cornerRow);
    }
    return gTransform;
  }

  function buildExportGroup() {
    const gExport = document.createElement('div');
    gExport.className = 'prop-group';
    const exportToggleRow = document.createElement('div');
    exportToggleRow.className = 'toggle-row';
    const exportBtn = document.createElement('button');
    const isExportable = layer.exportable !== false;
    exportBtn.textContent = isExportable ? '✓ Incluida en el PNG' : 'Oculta en el PNG';
    if (isExportable) exportBtn.classList.add('active');
    exportBtn.addEventListener('click', () => {
      patch({ exportable: !isExportable });
      renderProps(container, layerId, { onChange, onRemove });
    });
    exportToggleRow.appendChild(exportBtn);
    gExport.appendChild(exportToggleRow);
    const exportHint = document.createElement('p');
    exportHint.className = 'hint';
    exportHint.textContent = 'Si la desactivas, esta capa se sigue viendo aquí en el editor pero no saldrá en el PNG exportado (útil para fondos de referencia, guías, etc.).';
    gExport.appendChild(exportHint);
    return gExport;
  }

  if (layer.type === 'text') {
    const quickMode = getState().quickGenerator; // 'title' | 'body' | 'location' | 'photoLocation' | undefined
    const isTitleSticker = quickMode === 'title';
    const isBodySticker = quickMode === 'body';
    const isLocation = quickMode === 'location' || quickMode === 'photoLocation';
    const isGeneralEditor = !quickMode;

    const g = document.createElement('div');
    g.className = 'prop-group';
    g.innerHTML = '<strong>Texto</strong>';
    const textarea = document.createElement('textarea');
    textarea.value = layer.text;
    // el cuerpo admite varios párrafos: campo más alto para verlos
    if (layer.role !== 'title') textarea.rows = 6;
    textarea.addEventListener('input', () => patch({ text: textarea.value }));
    g.appendChild(row('Contenido', textarea));

    // Artículo: interruptor del subtítulo, visible tanto desde el título
    // principal como desde el propio subtítulo
    if (layer.slot === 'mainTitle' || layer.slot === 'subtitle') {
      const state = getState();
      const mainTitle = state.layers.find((l) => l.slot === 'mainTitle');
      const subtitle = state.layers.find((l) => l.slot === 'subtitle');
      if (mainTitle && subtitle) {
        const enabled = subtitle.visible !== false;
        const subRow = document.createElement('div');
        subRow.className = 'toggle-row';
        const subBtn = document.createElement('button');
        subBtn.textContent = enabled ? 'Subtítulo ✓' : 'Subtítulo desactivado';
        if (enabled) subBtn.classList.add('active');
        subBtn.addEventListener('click', () => {
          setArticleSubtitle(!enabled);
          onChange && onChange();
          renderProps(container, layerId, { onChange, onRemove });
        });
        subRow.appendChild(subBtn);
        g.appendChild(subRow);
      }
    }

    if (isBodySticker || (isGeneralEditor && layer.role === 'body')) {
      const boldHint = document.createElement('p');
      boldHint.className = 'hint';
      boldHint.textContent = 'Truco: selecciona una parte del texto de arriba y pulsa "Negrita (selección)" para resaltar solo esas palabras.';
      g.appendChild(boldHint);
      const selBoldRow = document.createElement('div');
      selBoldRow.className = 'toggle-row';
      const selBoldBtn = document.createElement('button');
      selBoldBtn.textContent = 'Negrita (selección)';
      selBoldBtn.addEventListener('click', () => {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) return; // nada seleccionado
        const value = textarea.value;
        const before = value.slice(0, start);
        const selected = value.slice(start, end);
        const after = value.slice(end);
        // si ya está envuelto en ** **, lo quitamos (toggle); si no, lo añadimos
        const alreadyWrapped = before.endsWith('**') && after.startsWith('**');
        const newValue = alreadyWrapped
          ? before.slice(0, -2) + selected + after.slice(2)
          : `${before}**${selected}**${after}`;
        textarea.value = newValue;
        patch({ text: newValue });
        textarea.focus();
      });
      selBoldRow.appendChild(selBoldBtn);
      g.appendChild(selBoldRow);
    }

    // el editor general (stories, artículo...) sigue teniendo el selector de
    // rol Título/Cuerpo; los generadores rápidos ya son plantillas separadas
    // (Sticker de título / Sticker de cuerpo), así que no lo necesitan.
    if (isGeneralEditor) {
      const roleToggle = document.createElement('div');
      roleToggle.className = 'toggle-row';
      ['title', 'body'].forEach((r) => {
        const b = document.createElement('button');
        b.textContent = r === 'title' ? 'Título' : 'Cuerpo';
        if (layer.role === r) b.classList.add('active');
        b.addEventListener('click', () => { patch({ role: r }); renderProps(container, layerId, { onChange, onRemove }); });
        roleToggle.appendChild(b);
      });
      g.appendChild(roleToggle);
    }

    // Libertad de estilo (ancho + peso + cursiva) de Acumin Variable: en el
    // sticker de título y en el de cuerpo, igual que en el editor general
    // cuando el rol es cuerpo. El de ubicación mantiene siempre la
    // tipografía de marca (ExtraCondensed Black Itálica) a propósito.
    if (isTitleSticker || isBodySticker || (isGeneralEditor && layer.role === 'body')) {
      const styleToggle = document.createElement('div');
      styleToggle.className = 'toggle-row';
      const italicBtn = document.createElement('button');
      italicBtn.textContent = layer.italic ? 'Cursiva ✓' : 'Cursiva';
      if (layer.italic) italicBtn.classList.add('active');
      italicBtn.addEventListener('click', () => { patch({ italic: !layer.italic }); renderProps(container, layerId, { onChange, onRemove }); });
      styleToggle.appendChild(italicBtn);
      g.appendChild(styleToggle);

      const widthLabel = document.createElement('p');
      widthLabel.className = 'hint';
      widthLabel.textContent = 'Ancho de letra:';
      g.appendChild(widthLabel);
      const widthRow = document.createElement('div');
      widthRow.className = 'toggle-row wrap';
      FONT_WIDTH_VARIANTS.forEach((variant) => {
        const b2 = document.createElement('button');
        b2.textContent = variant.label;
        if ((layer.widthVariant || (isTitleSticker ? 'extracondensed' : 'normal')) === variant.key) b2.classList.add('active');
        b2.addEventListener('click', () => { patch({ widthVariant: variant.key }); renderProps(container, layerId, { onChange, onRemove }); });
        widthRow.appendChild(b2);
      });
      g.appendChild(widthRow);

      const weightLabel = document.createElement('p');
      weightLabel.className = 'hint';
      weightLabel.textContent = 'Peso de letra:';
      g.appendChild(weightLabel);
      const weightRow = document.createElement('div');
      weightRow.className = 'toggle-row wrap';
      const currentWeight = layer.weight || (isTitleSticker ? 800 : (layer.bold ? 700 : 400));
      FONT_WEIGHT_VARIANTS.forEach((variant) => {
        const b3 = document.createElement('button');
        b3.textContent = variant.label;
        if (currentWeight === variant.weight) b3.classList.add('active');
        b3.addEventListener('click', () => {
          // guardamos el peso explícito y, para compatibilidad con el resto
          // del motor (que usa "bold" para cuerpo normal), sincronizamos bold
          patch({ weight: variant.weight, bold: variant.weight >= 700 });
          renderProps(container, layerId, { onChange, onRemove });
        });
        weightRow.appendChild(b3);
      });
      g.appendChild(weightRow);
    } else if (isGeneralEditor) {
      const styleToggle = document.createElement('div');
      styleToggle.className = 'toggle-row';
      const italicBtn = document.createElement('button');
      italicBtn.textContent = layer.italic ? 'Cursiva ✓' : 'Cursiva';
      if (layer.italic) italicBtn.classList.add('active');
      italicBtn.addEventListener('click', () => { patch({ italic: !layer.italic }); renderProps(container, layerId, { onChange, onRemove }); });
      styleToggle.appendChild(italicBtn);
      g.appendChild(styleToggle);
    }

    // alineación del párrafo (cuerpo del sticker y del editor general)
    if (isBodySticker || isGeneralEditor) {
      const alignRow = document.createElement('div');
      alignRow.className = 'toggle-row';
      const currentAlign = layer.align || 'left';
      [['Izquierda', 'left'], ['Centro', 'center'], ['Derecha', 'right'], ['Justificar', 'justify']].forEach(([label, key]) => {
        const b = document.createElement('button');
        b.textContent = label;
        if (currentAlign === key) b.classList.add('active');
        b.addEventListener('click', () => { patch({ align: key }); renderProps(container, layerId, { onChange, onRemove }); });
        alignRow.appendChild(b);
      });
      g.appendChild(row('Párrafo', alignRow));
    }

    // sticker de cuerpo: el lienzo se ajusta solo al texto; se controla con
    // el tamaño de letra y el ancho máximo de cada línea
    if (isBodySticker) {
      g.appendChild(row('Tamaño letra', rangeWithNumber(20, 200, 1, layer.fontSize || 64, (v) => patch({ fontSize: v }))));
      g.appendChild(row('Ancho línea', rangeWithNumber(300, 2400, 10, layer.lineWidth || 1000, (v) => patch({ lineWidth: v }))));
    }

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = layer.color || '#ffffff';
    colorInput.addEventListener('input', () => patch({ color: colorInput.value }));
    g.appendChild(row('Color', colorInput));

    const quickColors = document.createElement('div');
    quickColors.className = 'toggle-row';
    [['Blanco', '#ffffff'], ['Rojo', COLORS.red], ['Negro', COLORS.black]].forEach(([label, hex]) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => { colorInput.value = hex; patch({ color: hex }); });
      quickColors.appendChild(b);
    });
    g.appendChild(quickColors);

    // Alinear y Autoajuste no aportan nada en los stickers (una sola línea,
    // o una caja que siempre se autoajusta): solo se muestran en el editor
    // general (stories, artículo...).
    if (isGeneralEditor) {
      const autoFitToggle = document.createElement('div');
      autoFitToggle.className = 'toggle-row';
      const afBtn = document.createElement('button');
      afBtn.textContent = layer.autoFit ? 'Autoajuste ✓' : 'Autoajuste';
      if (layer.autoFit) afBtn.classList.add('active');
      afBtn.addEventListener('click', () => { patch({ autoFit: !layer.autoFit }); renderProps(container, layerId, { onChange, onRemove }); });
      autoFitToggle.appendChild(afBtn);
      g.appendChild(autoFitToggle);

      if (!layer.autoFit) {
        g.appendChild(row('Tamaño', rangeWithNumber(8, 200, 1, layer.fontSize || 48, (v) => patch({ fontSize: v }))));
      }
    }

    container.appendChild(g);

    // pastila de fondo asociada a este texto (sticker de cuerpo con fondo)
    const pill = getState().layers.find((l) => l.type === 'pill' && l.targetId === layer.id);
    if (pill) {
      const gp = document.createElement('div');
      gp.className = 'prop-group';
      gp.innerHTML = '<strong>Fondo (pastilla)</strong>';
      const patchPill = (p) => { updateLayer(pill.id, p); onChange && onChange(); };
      const pillColors = document.createElement('div');
      pillColors.className = 'toggle-row';
      const currentPill = (pill.color || '').toLowerCase();
      [['Rojo', COLORS.red], ['Negro', COLORS.black], ['Blanco', COLORS.white]].forEach(([label, hex]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        if (currentPill === hex.toLowerCase()) b.classList.add('active');
        // pointerdown: que funcione al primer toque aunque el teclado esté abierto
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
          patchPill({ color: hex });
          renderProps(container, layerId, { onChange, onRemove });
        });
        pillColors.appendChild(b);
      });
      gp.appendChild(row('Color', pillColors));
      gp.appendChild(row('Esquinas', rangeWithNumber(0, 200, 1, pill.cornerRadius || 0, (v) => patchPill({ cornerRadius: v }))));
      gp.appendChild(row('Margen', rangeWithNumber(0, 120, 1, pill.padding || 0, (v) => patchPill({ padding: v }))));
      const pillHint = document.createElement('p');
      pillHint.className = 'hint';
      pillHint.textContent = 'La pastila se ajusta sola al texto. Esquinas al máximo = extremos totalmente redondos.';
      gp.appendChild(pillHint);
      container.appendChild(gp);
    }
  }

  if (layer.type === 'image') {
    const g = document.createElement('div');
    g.className = 'prop-group';
    g.innerHTML = '<strong>Imagen</strong>';
    const btn = document.createElement('button');
    btn.className = 'btn small';
    btn.textContent = 'Cambiar imagen…';
    btn.addEventListener('click', () => {
      const evt = new CustomEvent('request-image-upload', { detail: { layerId } });
      window.dispatchEvent(evt);
    });
    g.appendChild(btn);
    if (!layer.locked) {
      g.appendChild(row('Radio esquina', rangeWithNumber(0, 200, 1, layer.cornerRadius || 0, (v) => patch({ cornerRadius: v }))));
    }
    container.appendChild(g);
  }

  if (layer.type === 'logo') {
    const g = document.createElement('div');
    g.className = 'prop-group';
    g.innerHTML = '<strong>Logo</strong>';

    const currentKindKey = logoKindOf(layer.asset);

    const kindRow = document.createElement('div');
    kindRow.className = 'toggle-row';
    LOGO_KINDS.forEach((kind) => {
      const b = document.createElement('button');
      b.textContent = kind.label;
      if (currentKindKey === kind.key) b.classList.add('active');
      b.addEventListener('click', () => {
        if (kind.key === currentKindKey) return;
        // al cambiar de icono a logotipo (o viceversa) recalculamos el alto
        // según la proporción real de la nueva variante, para que no se deforme
        const newAsset = kind.variants[0].key;
        const newHeight = layer.width * kind.aspect;
        patch({ asset: newAsset, height: newHeight });
        renderProps(container, layerId, { onChange, onRemove });
      });
      kindRow.appendChild(b);
    });
    g.appendChild(kindRow);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Elige la variante de color según el fondo sobre el que va el logo.';
    g.appendChild(hint);

    const grid = document.createElement('div');
    grid.className = 'logo-variant-grid';
    const currentAsset = layer.asset === 'full' ? 'icon-on-black' : layer.asset; // 'full' = alias antiguo
    const activeKind = LOGO_KINDS.find((k) => k.key === currentKindKey);
    activeKind.variants.forEach((variant) => {
      const b = document.createElement('button');
      b.className = 'logo-variant-btn';
      if (currentAsset === variant.key) b.classList.add('active');
      const swatch = document.createElement('span');
      swatch.className = `logo-variant-swatch bg-${variant.key.replace('icon-', '').replace('wordmark-', '')}`;
      const img = document.createElement('img');
      img.src = variant.src;
      img.alt = variant.label;
      swatch.appendChild(img);
      const label = document.createElement('span');
      label.className = 'logo-variant-label';
      label.textContent = variant.label;
      b.appendChild(swatch);
      b.appendChild(label);
      b.addEventListener('click', () => { patch({ asset: variant.key }); renderProps(container, layerId, { onChange, onRemove }); });
      grid.appendChild(b);
    });
    g.appendChild(grid);
    container.appendChild(g);
  }

  if (layer.type === 'pin') {
    const quickMode = getState().quickGenerator;
    const g = document.createElement('div');
    g.className = 'prop-group';
    g.innerHTML = '<strong>Pin de ubicación</strong>';

    if (quickMode) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'El color del pin sigue automáticamente al color que elijas en el texto de arriba.';
      g.appendChild(hint);
    } else {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'Elige la variante de color según el fondo sobre el que va el pin.';
      g.appendChild(hint);

      const grid = document.createElement('div');
      grid.className = 'logo-variant-grid';
      const currentAsset = layer.asset === 'full' ? 'pin-on-black' : layer.asset;
      PIN_VARIANTS.forEach((variant) => {
        const b = document.createElement('button');
        b.className = 'logo-variant-btn';
        if (currentAsset === variant.key) b.classList.add('active');
        const swatch = document.createElement('span');
        swatch.className = `logo-variant-swatch bg-${variant.key.replace('pin-', '')}`;
        const img = document.createElement('img');
        img.src = variant.src;
        img.alt = variant.label;
        swatch.appendChild(img);
        const label = document.createElement('span');
        label.className = 'logo-variant-label';
        label.textContent = variant.label;
        b.appendChild(swatch);
        b.appendChild(label);
        b.addEventListener('click', () => { patch({ asset: variant.key }); renderProps(container, layerId, { onChange, onRemove }); });
        grid.appendChild(b);
      });
      g.appendChild(grid);
    }

    if (quickMode === 'photoLocation') {
      const cornerHint = document.createElement('p');
      cornerHint.className = 'hint';
      cornerHint.textContent = 'Esquina donde colocar el sticker de ubicación.';
      g.appendChild(cornerHint);
      const cornerGrid = document.createElement('div');
      cornerGrid.className = 'corner-grid';
      const currentCorner = layer.corner || 'bottom-left';
      [
        ['⌜ Arriba izq.', 'top-left'],
        ['⌝ Arriba der.', 'top-right'],
        ['⌞ Abajo izq.', 'bottom-left'],
        ['⌟ Abajo der.', 'bottom-right'],
      ].forEach(([label, key]) => {
        const b = document.createElement('button');
        b.textContent = label;
        if (currentCorner === key) b.style.borderColor = COLORS.red;
        b.addEventListener('click', () => {
          patch({ corner: key });
          renderProps(container, layerId, { onChange, onRemove });
        });
        cornerGrid.appendChild(b);
      });
      g.appendChild(cornerGrid);

      g.appendChild(row('Tamaño', rangeWithNumber(0.4, 2.2, 0.05, layer.scale || 1, (v) => patch({ scale: v }))));
    }

    container.appendChild(g);
  }

  if (layer.type === 'gradient' || layer.type === 'background') {
    const g = document.createElement('div');
    g.className = 'prop-group';
    g.innerHTML = layer.type === 'background' ? '<strong>Fondo</strong>' : '<strong>Degradado</strong>';
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = layer.color || COLORS.black;
    colorInput.addEventListener('input', () => patch({ color: colorInput.value }));

    const quickColors = document.createElement('div');
    quickColors.className = 'toggle-row';
    [['Rojo', COLORS.red], ['Negro', COLORS.black], ['Blanco', '#ffffff']].forEach(([label, hex]) => {
      const b = document.createElement('button');
      b.textContent = label;
      if ((layer.color || '').toLowerCase() === hex.toLowerCase()) b.classList.add('active');
      b.addEventListener('click', () => {
        colorInput.value = hex;
        patch({ color: hex });
        renderProps(container, layerId, { onChange, onRemove });
      });
      quickColors.appendChild(b);
    });
    g.appendChild(quickColors);
    g.appendChild(row('Color', colorInput));
    container.appendChild(g);
  }

  if (layer.type === 'frame') {
    const g = document.createElement('div');
    g.className = 'prop-group';
    g.innerHTML = '<strong>Marco de publicación compartida</strong>';
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Guía visual: nunca se incluye en el PNG exportado. Sirve para diseñar respetando el hueco donde Instagram colocará la publicación compartida.';
    g.appendChild(p);

    const grid = document.createElement('div');
    grid.className = 'ratio-grid';
    ASPECT_PRESETS.forEach((preset) => {
      const b = document.createElement('button');
      b.className = 'ratio-btn';
      b.textContent = preset.label;
      if (layer.ratioKey === preset.key) b.classList.add('active');
      b.addEventListener('click', () => {
        const newHeight = (layer.width * preset.h) / preset.w;
        patch({ ratioKey: preset.key, height: newHeight });
        renderProps(container, layerId, { onChange, onRemove });
      });
      grid.appendChild(b);
    });
    const customBtn = document.createElement('button');
    customBtn.className = 'ratio-btn';
    customBtn.textContent = 'Personalizado';
    if (layer.ratioKey === 'custom') customBtn.classList.add('active');
    grid.appendChild(customBtn);
    g.appendChild(grid);

    if (layer.ratioKey === 'custom' || true) {
      const pxRow = document.createElement('div');
      pxRow.className = 'prop-row';
      pxRow.innerHTML = '<label>Píxeles</label>';
      const wInput = document.createElement('input');
      wInput.type = 'number'; wInput.placeholder = 'ancho px'; wInput.style.width = '70px';
      const hInput = document.createElement('input');
      hInput.type = 'number'; hInput.placeholder = 'alto px'; hInput.style.width = '70px';
      const applyBtn = document.createElement('button');
      applyBtn.className = 'btn small'; applyBtn.textContent = 'Aplicar';
      applyBtn.addEventListener('click', () => {
        const w = Number(wInput.value), h = Number(hInput.value);
        if (w > 0 && h > 0) {
          const gcd = (a, b) => (b ? gcd(b, a % b) : a);
          const d = gcd(w, h);
          const newHeight = (layer.width * h) / w;
          patch({ ratioKey: `custom ${w / d}:${h / d}`, height: newHeight });
          renderProps(container, layerId, { onChange, onRemove });
        }
      });
      pxRow.appendChild(wInput);
      pxRow.appendChild(hInput);
      pxRow.appendChild(applyBtn);
      g.appendChild(pxRow);
    }

    g.appendChild(row('Radio esquina', rangeWithNumber(0, 200, 1, layer.cornerRadius || 0, (v) => patch({ cornerRadius: v }))));

    container.appendChild(g);
  }

  // posición/escala y exportación van al final: son ajustes finos, no lo
  // primero que se quiere tocar al diseñar. En el sticker de título no
  // aplican (lienzo fijo al contenido, una sola capa): se omiten del todo.
  // título y cuerpo de sticker: lienzo ajustado al contenido, sin posición
  if (topQuickMode !== 'title' && topQuickMode !== 'body') {
    container.appendChild(buildTransformGroup());
  }
  if (!topQuickMode && !isFrame) { // el marco nunca se exporta: sin opción
    container.appendChild(buildExportGroup());
  }

  // ---- borrar capa (no aplica a los generadores rápidos: es la única capa) ----
  if (!topQuickMode) {
    const del = document.createElement('button');
    del.className = 'btn small';
    del.style.width = '100%';
    del.style.marginTop = '8px';
    del.style.borderColor = COLORS.red;
    del.style.color = COLORS.red;
    del.textContent = 'Eliminar capa';
    del.addEventListener('click', () => {
      removeLayer(layerId);
      (onRemove || onChange) && (onRemove || onChange)();
    });
    container.appendChild(del);
  }
}
