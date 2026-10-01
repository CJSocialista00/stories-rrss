// Store simple con pub/sub + historial (undo/redo) para el documento actual.
import { CANVAS_W, CANVAS_H } from './constants.js';

let idCounter = 1;
export function nextId(prefix = 'layer') {
  return `${prefix}_${Date.now().toString(36)}_${(idCounter++).toString(36)}`;
}

const listeners = new Set();
let state = {
  canvas: { width: CANVAS_W, height: CANVAS_H },
  layers: [], // orden = orden de dibujo (primero = fondo)
  selectedId: null,
  templateName: null,
};

const undoStack = [];
const redoStack = [];
let suppressHistory = false;
// Agrupa en un solo paso de deshacer las ediciones seguidas del mismo campo
// (cada tecla del texto, cada paso de un slider): antes cada una clonaba el
// documento entero — foto en base64 incluida — y bloqueaba el móvil.
const COALESCE_MS = 800;
let lastHistoryKey = null;
let lastHistoryTime = 0;

function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

export function getState() {
  return state;
}

export function getLayer(id) {
  return state.layers.find((l) => l.id === id);
}

export function getSelected() {
  return state.selectedId ? getLayer(state.selectedId) : null;
}

function notify() {
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function pushHistory(coalesceKey = null) {
  if (suppressHistory) return;
  const now = Date.now();
  if (coalesceKey && coalesceKey === lastHistoryKey && now - lastHistoryTime < COALESCE_MS) {
    lastHistoryTime = now;
    return;
  }
  lastHistoryKey = coalesceKey;
  lastHistoryTime = now;
  undoStack.push(cloneState(state));
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(cloneState(state));
  lastHistoryKey = null;
  const prev = undoStack.pop();
  suppressHistory = true;
  state = prev;
  suppressHistory = false;
  notify();
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(cloneState(state));
  lastHistoryKey = null;
  const next = redoStack.pop();
  suppressHistory = true;
  state = next;
  suppressHistory = false;
  notify();
}

export function setState(mutator, { history = true, coalesceKey = null } = {}) {
  if (history) pushHistory(coalesceKey);
  mutator(state);
  notify();
}

export function loadDocument(doc) {
  lastHistoryKey = null;
  undoStack.length = 0;
  redoStack.length = 0;
  state = cloneState({
    canvas: doc.canvas || { width: CANVAS_W, height: CANVAS_H },
    layers: doc.layers || [],
    selectedId: null,
    templateName: doc.templateName || null,
    quickGenerator: doc.quickGenerator || null,
  });
  notify();
}

export function serializeDocument() {
  return cloneState({
    canvas: state.canvas,
    layers: state.layers,
    templateName: state.templateName,
    quickGenerator: state.quickGenerator || null,
  });
}

export function setCanvasSize(width, height) {
  setState((s) => { s.canvas = { width, height }; }, { history: false });
}

export function addLayer(layer, { select = true, atBottom = false } = {}) {
  setState((s) => {
    if (atBottom) s.layers.unshift(layer); else s.layers.push(layer);
    if (select) s.selectedId = layer.id;
  });
}

export function removeLayer(id) {
  setState((s) => {
    s.layers = s.layers.filter((l) => l.id !== id);
    if (s.selectedId === id) s.selectedId = null;
  });
}

export function updateLayer(id, patch, { history = true } = {}) {
  setState((s) => {
    const layer = s.layers.find((l) => l.id === id);
    if (layer) Object.assign(layer, patch);
  }, { history, coalesceKey: `${id}:${Object.keys(patch).sort().join(',')}` });
}

export function selectLayer(id) {
  setState((s) => { s.selectedId = id; }, { history: false });
}

export function reorderLayer(id, direction) {
  setState((s) => {
    const idx = s.layers.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const newIdx = direction === 'up' ? idx + 1 : idx - 1;
    if (newIdx < 0 || newIdx >= s.layers.length) return;
    const [item] = s.layers.splice(idx, 1);
    s.layers.splice(newIdx, 0, item);
  });
}
