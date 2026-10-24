// Sonidos de interfaz sintetizados con Web Audio (sin archivos): breves, suaves y
// a poco volumen para confirmar lo que haces sin molestar. Se pueden silenciar
// (se recuerda la elección).

const KEY = 'rrss_sound_v1';
let ctx = null;
let master = null;
let muted = false;
try { muted = localStorage.getItem(KEY) === 'off'; } catch { /* sin almacenamiento */ }

const MASTER_VOLUME = 0.5; // techo general: suave, pero audible

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
    const lowpass = ctx.createBiquadFilter(); // quita el brillo agudo: suena más redondo
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2600;
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(lowpass);
    lowpass.connect(ctx.destination);
  }
  return ctx;
}

// iOS/Safari solo permite sonar tras un gesto del usuario: se desbloquea en el primero.
// resume() es asíncrono: devuelve una promesa que se cumple cuando ya suena.
export function unlockAudio() {
  const c = audio();
  if (!c) return Promise.resolve(false);
  if (c.state === 'running') return Promise.resolve(true);
  return Promise.resolve(c.resume()).then(() => {
    // un instante de silencio: en iOS termina de abrir la salida de audio
    try { const src = c.createBufferSource(); src.buffer = c.createBuffer(1, 1, 22050); src.connect(c.destination); src.start(0); } catch { /* ignorar */ }
    return c.state === 'running';
  }).catch(() => false);
}

function tone(freq, { at = 0, dur = 0.09, type = 'sine', vol = 0.3, to = null } = {}) {
  const c = audio();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  tap: () => tone(640, { dur: 0.05, vol: 0.23 }),
  select: () => tone(520, { dur: 0.07, vol: 0.26 }),
  open: () => { tone(392, { dur: 0.08, vol: 0.26 }); tone(523, { at: 0.06, dur: 0.1, vol: 0.26 }); },
  back: () => tone(420, { dur: 0.09, vol: 0.23, to: 330 }),
  add: () => { tone(440, { dur: 0.09, vol: 0.29 }); tone(660, { at: 0.07, dur: 0.12, vol: 0.29 }); },
  remove: () => tone(380, { dur: 0.13, vol: 0.26, to: 220 }),
  on: () => tone(600, { dur: 0.08, vol: 0.26, to: 760 }),
  off: () => tone(520, { dur: 0.08, vol: 0.23, to: 400 }),
  snap: () => tone(760, { dur: 0.04, vol: 0.20, type: 'triangle' }),
  done: () => { [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.075, dur: 0.2, vol: 0.29 })); },
};

export function play(name) {
  if (muted) return;
  const fn = SOUNDS[name];
  if (fn) fn();
}

export function isMuted() { return muted; }
export function setMuted(value) {
  muted = !!value;
  try { localStorage.setItem(KEY, muted ? 'off' : 'on'); } catch { /* ignorar */ }
  if (!muted) unlockAudio().then(() => play('on'));
}

// Sonido automático según el botón pulsado (una sola vez para toda la app).
// Se evalúa en fase de captura, antes de que el botón cambie de estado.
function soundFor(el) {
  if (el.closest('#btnExport')) return null; // «done» suena cuando el archivo está listo
  if (el.closest('.home-back, #btnHome, .cp-back, .save-close')) return 'back';
  if (el.closest('.cp-icon-danger')) return 'remove';
  if (el.closest('.cp-switch')) return el.closest('.cp-switch').classList.contains('on') ? 'off' : 'on';
  if (el.closest('.cp-anchor')) return 'snap';
  if (el.closest('.cp-add-btn, .cp-pick, .menu-row.leaf')) return 'add';
  if (el.closest('.menu-row')) return 'open';
  if (el.closest('.cp-done')) return 'select';
  return 'tap';
}

export function initUiSounds() {
  const target = (e) => (e.target.closest ? e.target.closest('button, [role="switch"]') : null);
  const state = () => (ctx ? ctx.state : 'none');
  let played = false;
  // Con el audio ya abierto suena al pulsar (sin esperar al «click»). Si aún
  // está bloqueado (primer toque, sobre todo en iPhone), se abre y suena después.
  document.addEventListener('pointerdown', (e) => {
    played = false;
    const b = target(e);
    if (!b || b.disabled) return;
    if (state() === 'running') { play(soundFor(b)); played = true; }
  }, true);
  document.addEventListener('click', (e) => {
    const b = target(e);
    const already = played;
    played = false;
    if (state() === 'running') { if (!already && b && !b.disabled) play(soundFor(b)); return; }
    const name = b && !b.disabled ? soundFor(b) : null;
    unlockAudio().then(() => { if (name) play(name); });
  }, true);
  // teclado y otros gestos que no pasan por el ratón
  ['touchend', 'keydown'].forEach((t) => document.addEventListener(t, () => { if (state() !== 'running') unlockAudio(); }, { capture: true, passive: true }));
}
