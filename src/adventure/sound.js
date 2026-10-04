// Tüm sesler WebAudio ile anlık üretiliyor, ses dosyası yok.
// Zincir: her ses → (sağ/sol) → ana kazanç → yumuşak sıkıştırıcı → sınırlayıcı → hoparlör
//                         ↘ yankı payı → alçak geçiren → yankı (oda) → ana kazanç
let enabled = true;
try { enabled = localStorage.getItem('sound') !== 'off'; } catch { /* yok say */ }

const MASTER = 1.6;
let ctx = null;
let master = null;
let reverbIn = null;
let noiseBuf = null;
let resumedAt = -Infinity;
let idleTimer = 0;
const pulseCache = new Map();

const midi = (n) => 440 * 2 ** ((n - 69) / 12);
// C majör pentatonik: kartuş sırası ve harf tıkları için
const PENTA = [0, 2, 4, 7, 9];
const penta = (root, i) => root + 12 * Math.floor(i / 5) + PENTA[i % 5];

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    } catch {
      ctx = null;
      return null;
    }
    build();
  }
  if (ctx.state !== 'running') {
    resumedAt = performance.now();
    ctx.resume().catch(() => {});
  }
  // 2 sn hiç ses çalmazsa ses motoru uykuya geçer (pil dostu)
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => ctx?.state === 'running' && ctx.suspend().catch(() => {}), 2000);
  return ctx;
}

function build() {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 10;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.15;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -3;
  limit.knee.value = 0;
  limit.ratio.value = 20;
  limit.attack.value = 0.001;
  limit.release.value = 0.05;
  comp.connect(limit).connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = enabled ? MASTER : 0;
  master.connect(comp);

  // oda yankısı: 0.8 sn'lik sönen gürültüden üretilen dürtü yanıtı
  const conv = ctx.createConvolver();
  const len = Math.round(ctx.sampleRate * 0.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  }
  conv.buffer = ir;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3200;
  reverbIn = ctx.createGain();
  reverbIn.connect(lp).connect(conv).connect(master);

  // 1 sn'lik döngüsel beyaz gürültü (hava, tıslama, tık sesleri buradan süzülür)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
}

// Çalınabilir mi: ses açık ve motor uyanık (ya da az önce uyandırıldı)
function ready() {
  return enabled && ctx && (ctx.state === 'running' || performance.now() - resumedAt < 300);
}
// ziyaretçi sayfaya hiç dokunmadıysa tarayıcı sese izin vermez; boşuna motor kurma
const allowed = () => navigator.userActivation?.hasBeenActive !== false;
const play = (fn) => (...a) => {
  if (!enabled || !allowed()) return;
  ac();
  if (ready()) fn(...a);
};

// 8-bit "pulse" dalgası: verilen doluluk oranında (0.125 / 0.25 / 0.5) Fourier serisiyle
function pulse(duty) {
  if (!pulseCache.has(duty)) {
    const re = new Float32Array(48);
    const im = new Float32Array(48);
    for (let k = 1; k < 48; k++) {
      re[k] = Math.sin(2 * Math.PI * k * duty) / (Math.PI * k);
      im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (Math.PI * k);
    }
    pulseCache.set(duty, ctx.createPeriodicWave(re, im));
  }
  return pulseCache.get(duty);
}

// param'ı t anından itibaren [oran, değer] noktalarından geçirir (oran: sürenin kesri)
function ramp(param, t, dur, start, points, exp) {
  param.setValueAtTime(start, t);
  for (const [k, v] of points) {
    if (exp) param.exponentialRampToValueAtTime(v, t + k * dur);
    else param.linearRampToValueAtTime(v, t + k * dur);
  }
}

// ses zarfı: hızlı giriş, isteğe bağlı bekleme, üstel sönüş; ya da elle verilen şekil
function envelope(t, dur, { vol, attack = 0.004, hold = 0, shape }) {
  const g = ctx.createGain();
  if (shape) {
    ramp(g.gain, t, dur, 0, shape.map(([k, v]) => [k, vol * v]), false);
    return g;
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  if (hold) g.gain.setValueAtTime(vol, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  return g;
}

// çıkış: sağ/sol konum (sabit ya da [baş, son]) + yankı payı
function output(t, dur, pan = 0, wet = 0.15) {
  const p = ctx.createStereoPanner();
  if (Array.isArray(pan)) ramp(p.pan, t, dur, pan[0], [[1, pan[1]]], false);
  else p.pan.value = pan;
  p.connect(master);
  if (wet) {
    const w = ctx.createGain();
    w.gain.value = wet;
    p.connect(w).connect(reverbIn);
  }
  return p;
}

// ton: wave sayıysa pulse doluluğu, değilse 'sine' / 'triangle' / ...
function tone({ at = 0, wave = 0.5, freq, sweep, dur, vibrato = 0, lowpass, pan, wet, ...env }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  if (typeof wave === 'number') o.setPeriodicWave(pulse(wave));
  else o.type = wave;
  if (sweep) ramp(o.frequency, t, dur, freq, sweep, true);
  else o.frequency.value = freq;
  if (vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6;
    const depth = ctx.createGain();
    ramp(depth.gain, t, dur, 0, [[0.6, vibrato]], false);
    lfo.connect(depth).connect(o.detune);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  const g = envelope(t, dur, env);
  let src = o;
  if (lowpass) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    o.connect(f);
    src = f;
  }
  src.connect(g).connect(output(t, dur, pan, wet));
  o.start(t);
  o.stop(t + dur + 0.05);
  o.onended = () => g.disconnect();
}

// süzülmüş gürültü: tık, tıslama, hava
function noise({ at = 0, type = 'bandpass', freq, sweep, q = 1, dur, pan, wet, ...env }) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  s.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  if (sweep) ramp(f.frequency, t, dur, freq, sweep, true);
  else f.frequency.value = freq;
  const g = envelope(t, dur, env);
  s.connect(f).connect(g).connect(output(t, dur, pan, wet));
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.05);
  s.onended = () => g.disconnect();
}

// zoom süpürmeleri için yumuşak (kübik) geçişli ara noktalar
const smooth = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const glide = (a, b) => [0.2, 0.4, 0.6, 0.8, 1].map((k) => [k, a * (b / a) ** smooth(k)]);

// BMO'nun tuşları: her biri farklı perdede tok vuruş (thunk) + tık (click)
const KEYS = {
  a: { thunk: 150, click: 1700, vol: 1 },
  b: { thunk: 220, click: 2300, vol: 0.85 },
  triangle: { thunk: 250, click: 2800, vol: 0.8 },
  dpad: { thunk: 300, click: 3600, vol: 0.75 },
  blue: { thunk: 380, click: 4400, vol: 0.55 },
  pill: { thunk: 190, click: 1200, vol: 0.6 },
};

export const sfx = {
  get enabled() { return enabled; },
  set enabled(v) {
    enabled = v;
    try { localStorage.setItem('sound', v ? 'on' : 'off'); } catch { /* yok say */ }
    // kapanırken "kapandı" sesi bitsin diye kısa bir gecikmeyle sus
    if (master) master.gain.setTargetAtTime(v ? MASTER : 0, ctx.currentTime + (v ? 0 : 0.35), 0.02);
    if (v) ac();
  },
  unlock() { if (enabled && allowed()) ac(); },

  // kartuşun üstüne gelince: sırasına göre pentatonik nota (soldan sağa do re mi sol la...)
  hover: play((i, pan) => {
    const n = penta(84, i);
    tone({ wave: 0.25, freq: midi(n), dur: 0.07, vol: 0.063, pan, wet: 0.2 });
    tone({ wave: 'triangle', freq: midi(n + 12), dur: 0.12, vol: 0.063, pan, wet: 0.3 });
  }),

  // kartuşun uçuşu: kavisli hava "vuuş"u, ses kartuşla birlikte sağa/sola kayar
  fly: play((ms, fromPan, toPan) => {
    noise({ freq: 450, sweep: [[0.5, 1700], [1, 700]], q: 1.1, dur: ms / 1000, vol: 0.21, shape: [[0.15, 0.2], [0.5, 1], [1, 0]], pan: [fromPan, toPan], wet: 0.25 });
  }),

  // yuvaya kayış: yükselen tıslama, sonunda tık + tok "güm" + küçük tık
  slideIn: play((ms, pan) => {
    const d = ms / 1000;
    if (d) noise({ freq: 2600, sweep: [[1, 3600]], q: 2.5, dur: d, vol: 0.06, shape: [[0.2, 0.6], [0.92, 1], [1, 0]], pan, wet: 0.05 });
    noise({ at: d, freq: 2300, q: 1.4, dur: 0.04, vol: 0.27, attack: 0.001, pan });
    tone({ at: d, wave: 'sine', freq: 160, sweep: [[1, 55]], dur: 0.14, vol: 0.26, attack: 0.002, pan, wet: 0.1 });
    noise({ at: d + 0.05, freq: 4800, q: 2, dur: 0.025, vol: 0.18, attack: 0.001, pan, wet: 0.1 });
  }),

  // yuvadan fırlayış: tık + yaylı "boing" + kısa tıslama
  pop: play((pan) => {
    noise({ freq: 3000, q: 1.5, dur: 0.03, vol: 0.3, attack: 0.001, pan });
    tone({ wave: 'sine', freq: 180, sweep: [[0.4, 480], [1, 380]], dur: 0.16, vol: 0.16, pan });
    noise({ at: 0.02, freq: 3200, sweep: [[1, 2400]], q: 2.5, dur: 0.26, vol: 0.07, shape: [[0.1, 1], [1, 0]], pan, wet: 0.05 });
  }),

  // ekran açılırken: hızla yükselen 8-bit süpürme + pes "dum" + tiz tıslama
  boot: play(() => {
    tone({ wave: 0.25, freq: 320, sweep: [[0.75, 2600]], dur: 0.09, vol: 0.05 });
    tone({ wave: 'sine', freq: 90, sweep: [[1, 50]], dur: 0.3, vol: 0.15, attack: 0.01 });
    noise({ type: 'highpass', freq: 5000, dur: 0.14, vol: 0.05, attack: 0.001, wet: 0.1 });
  }),

  // diyalog yazılırken: çok kısık, yumuşak (sinüs + alçak geçiren) "pıt"; dikkat dağıtmasın diye
  // sadece birkaç harfte bir çalar, perdesi dar bir aralıkta hafifçe değişir
  talk: play((i) => {
    tone({ wave: 'sine', freq: midi(penta(74, i % 3)), dur: 0.035, attack: 0.003, vol: 0.022, lowpass: 1800, wet: 0.05 });
  }),

  // isim harf harf yazılırken her harfte kısa 8-bit tık
  type: play((i) => {
    tone({ wave: 0.125, freq: midi(penta(81, i % 5)), dur: 0.05, vol: 0.16 });
  }),

  // açılış bitince: Si5 → Mi6, ikincisi titreşimli
  ready: play(() => {
    tone({ wave: 0.125, freq: midi(83), dur: 0.08, hold: 0.04, vol: 0.06 });
    tone({ at: 0.08, wave: 0.125, freq: midi(88), dur: 0.6, hold: 0.08, vol: 0.06, vibrato: 18, wet: 0.3 });
    tone({ at: 0.08, wave: 'triangle', freq: midi(76), dur: 0.5, vol: 0.09, wet: 0.3 });
  }),

  // ekranın içine girip detay sayfası belirince: eski açılış müziği (Do5 Mi5 Sol5 Do6), 8-bit tınıyla
  jingle: play(() => {
    [72, 76, 79, 84].forEach((n, k) => tone({ at: k * 0.085, wave: 0.25, freq: midi(n), dur: k === 3 ? 0.5 : 0.13, hold: 0.04, vol: 0.067, vibrato: k === 3 ? 15 : 0, lowpass: 5000, wet: 0.25 }));
  }),

  // kamera ekrana dalarken: filtresi açılan hava + yükselen ton
  zoomIn: play((ms) => {
    const d = ms / 1000;
    noise({ freq: 260, sweep: glide(260, 3800), q: 0.9, dur: d, vol: 0.115, shape: [[0.3, 0.3], [0.8, 1], [1, 0]], wet: 0.3 });
    tone({ wave: 'triangle', freq: 220, sweep: glide(220, 880), dur: d, vol: 0.029, shape: [[0.4, 0.6], [0.85, 1], [1, 0]], wet: 0.4 });
  }),

  // geri çekilirken: tersi
  zoomOut: play((ms) => {
    const d = ms / 1000;
    noise({ freq: 3800, sweep: glide(3800, 260), q: 0.9, dur: d, vol: 0.115, shape: [[0.2, 1], [0.7, 0.3], [1, 0]], wet: 0.3 });
    tone({ wave: 'triangle', freq: 880, sweep: glide(880, 220), dur: d, vol: 0.029, shape: [[0.15, 1], [0.6, 0.6], [1, 0]], wet: 0.4 });
  }),

  // yüz ifadesi: mutlu → üç notalı arpej, şaşkın → kayan tek nota
  mood: play((kind, pan) => {
    const j = (Math.random() - 0.5) * 1.5;
    if (kind === 'surprised') {
      tone({ at: 0.03, wave: 0.25, freq: midi(76 + j), sweep: [[0.4, midi(90 + j)], [1, midi(87 + j)]], dur: 0.24, hold: 0.08, vol: 0.055, lowpass: 4000, pan, wet: 0.2 });
      return;
    }
    [84, 88, 91].forEach((n, k) => tone({ at: 0.03 + k * 0.075, wave: 0.25, freq: midi(n + j), sweep: [[1, midi(n + j - 3)]], dur: 0.065, vol: 0.13, lowpass: 4500, pan, wet: 0.2 }));
  }),

  // tuşa basma: tık + aşağı kayan tok vuruş
  press: play((name, pan) => {
    const k = KEYS[name];
    if (!k) return;
    noise({ freq: k.click, q: 1.6, dur: 0.025, vol: 0.25 * k.vol, attack: 0.001, pan, wet: 0.08 });
    tone({ wave: 'sine', freq: k.thunk, sweep: [[1, k.thunk / 2]], dur: 0.07, vol: 0.3 * k.vol, attack: 0.001, pan, wet: 0.05 });
  }),
  // tuşu bırakma: daha ince, kısa tık
  release: play((name, pan) => {
    const k = KEYS[name];
    if (k) noise({ freq: k.click * 1.3, q: 2, dur: 0.015, vol: 0.15 * k.vol, attack: 0.001, pan, wet: 0.05 });
  }),

  // ses açıldı / kapandı
  on: play(() => {
    tone({ wave: 0.5, freq: midi(86), dur: 0.06, hold: 0.03, vol: 0.048, lowpass: 5000 });
    tone({ at: 0.06, wave: 0.5, freq: midi(93), dur: 0.25, hold: 0.06, vol: 0.048, lowpass: 5000, wet: 0.2 });
  }),
  off: play(() => {
    tone({ wave: 0.25, freq: midi(93), dur: 0.06, hold: 0.03, vol: 0.067, lowpass: 5000 });
    tone({ at: 0.06, wave: 0.25, freq: midi(86), dur: 0.2, hold: 0.04, vol: 0.067, lowpass: 5000, wet: 0.2 });
  }),

  // ---- açılış: pil değiştirme ----
  // pil yerde yuvarlanıyor: alçak, titreşen tıngırtı
  roll: play((ms, pan) => {
    const d = ms / 1000;
    noise({ type: 'lowpass', freq: 700, q: 3, dur: d, vol: 0.12, shape: [[0.15, 1], [0.8, 0.8], [1, 0]], pan, wet: 0.1 });
    for (let k = 0; k < d / 0.09; k++) noise({ at: k * 0.09, freq: 2000 + Math.random() * 900, q: 4, dur: 0.02, vol: 0.05, attack: 0.001, pan });
  }),
  // BMO arkaya yatarken / doğrulurken: kısa gıcırtı + hava
  tilt: play((up, pan) => {
    tone({ wave: 0.125, freq: up ? 330 : 520, sweep: [[1, up ? 520 : 300]], dur: 0.32, vol: 0.03, lowpass: 2500, pan, wet: 0.15 });
    noise({ freq: 700, sweep: [[1, up ? 1400 : 500]], q: 1, dur: 0.35, vol: 0.06, shape: [[0.3, 1], [1, 0]], pan, wet: 0.2 });
  }),
  // pil kapağı açılıyor: mandal tıkı + yaylı "tıng"
  hatch: play((pan) => {
    noise({ freq: 2600, q: 1.8, dur: 0.03, vol: 0.28, attack: 0.001, pan });
    tone({ at: 0.02, wave: 'triangle', freq: 640, sweep: [[1, 380]], dur: 0.18, vol: 0.1, pan, wet: 0.2 });
  }),
  // metal pil yere çarpıyor: tiz, metalik "tın"
  clink: play((pan, v = 1) => {
    const f = 2300 + Math.random() * 700;
    tone({ wave: 'triangle', freq: f, dur: 0.16, vol: 0.06 * v, pan, wet: 0.3 });
    tone({ wave: 'sine', freq: f * 1.51, dur: 0.1, vol: 0.04 * v, pan, wet: 0.3 });
    noise({ freq: 5200, q: 2, dur: 0.02, vol: 0.12 * v, attack: 0.001, pan });
  }),
  // yeni pil yuvaya oturuyor: tok "çıt"
  snap: play((pan) => {
    noise({ freq: 3400, q: 2, dur: 0.025, vol: 0.3, attack: 0.001, pan });
    tone({ wave: 'sine', freq: 210, sweep: [[1, 90]], dur: 0.1, vol: 0.28, attack: 0.001, pan, wet: 0.08 });
  }),
  // BMO yere oturuyor: pes "güm"
  thud: play((pan) => {
    tone({ wave: 'sine', freq: 120, sweep: [[1, 45]], dur: 0.22, vol: 0.32, attack: 0.002, pan, wet: 0.1 });
    noise({ type: 'lowpass', freq: 500, dur: 0.12, vol: 0.2, attack: 0.001, pan });
  }),
  // pil dolarken her dilimde yükselen 8-bit nota
  charge: play((i) => {
    tone({ wave: 0.25, freq: midi(penta(67, i * 2)), dur: 0.09, hold: 0.03, vol: 0.06, lowpass: 5000, wet: 0.2 });
  }),

  // link yokken A'ya basılırsa: düşen "olmaz" sesi
  deny: play(() => {
    tone({ wave: 0.5, freq: 900, sweep: [[1, 70]], dur: 0.32, hold: 0.05, vol: 0.06, lowpass: 2500 });
    noise({ type: 'highpass', freq: 4000, dur: 0.05, vol: 0.1, attack: 0.001 });
  }),
};
