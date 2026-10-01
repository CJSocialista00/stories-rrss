import { BUILTIN_TEMPLATES } from './builtins.js';
import { STICKER_TEMPLATES, PHOTO_TEMPLATES } from './stickers.js';

const ALL_BUILTINS = [
  ...BUILTIN_TEMPLATES.map((t) => ({ ...t, category: 'Stories' })),
  ...STICKER_TEMPLATES,
  ...PHOTO_TEMPLATES,
];

const KEY = 'rrss_stories_templates_v1';

function readCustom() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCustom(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function listTemplates() {
  const custom = readCustom();
  return [
    ...ALL_BUILTINS.map((t) => ({ id: t.id, name: t.name, builtin: true, category: t.category })),
    ...custom.map((t) => ({ id: t.id, name: t.name, builtin: false, category: 'Tus plantillas' })),
  ];
}

export function loadTemplateDoc(id) {
  const builtin = ALL_BUILTINS.find((t) => t.id === id);
  if (builtin) return builtin.doc();
  const custom = readCustom().find((t) => t.id === id);
  return custom ? custom.doc : null;
}

export function saveAsNewTemplate(name, doc) {
  const custom = readCustom();
  const id = `tpl_${Date.now().toString(36)}`;
  custom.push({ id, name, doc });
  writeCustom(custom);
  return id;
}

export function deleteTemplate(id) {
  const custom = readCustom().filter((t) => t.id !== id);
  writeCustom(custom);
}

export function exportTemplateFile(name, doc) {
  const blob = new Blob([JSON.stringify({ name, doc }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-z0-9]+/gi, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importTemplateFile(fileText) {
  const parsed = JSON.parse(fileText);
  return saveAsNewTemplate(parsed.name || 'Plantilla importada', parsed.doc);
}
