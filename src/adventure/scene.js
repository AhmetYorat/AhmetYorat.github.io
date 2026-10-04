import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { profile, projects, about, adventure } from '../data.js';
import { sfx } from './sound.js';

const PIXEL = '"Pixelify Sans", monospace';
const DISPLAY = '"Unbounded", sans-serif';

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = {
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  in: (k) => k * k,
  out: (k) => 1 - (1 - k) * (1 - k),
  // sinüs: başı ve sonu çok yumuşak
  soft: (k) => 0.5 - Math.cos(Math.PI * k) / 2,
  // kübik yavaşlayan: hızlı başlar, süzülerek durur
  settle: (k) => 1 - Math.pow(1 - k, 3),
  outBack: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const POKES = [
  'Hihi! Gıdıklanıyorum!',
  'Ben bir oyun konsoluyum, ama aynı zamanda bir arkadaşım.',
  'Ahmet bugün kaç satır kod yazdı biliyor musun? Ben de bilmiyorum.',
  'Pil seviyesi: harika. Moral seviyesi: daha da harika!',
  'Bana bir kartuş tak, birlikte oynayalım!',
  'Bip bop. Bu benim gizli dilimde merhaba demek.',
];

// TV ekranında görsel yoksa projenin renginde kapak
const cover = (p, big = false) =>
  p.image
    ? `<img src="${esc(p.image)}" alt="" draggable="false">`
    : `<span class="cover" style="--c:${p.color};--s:${p.surface}"><b>${esc(p.short)}</b>${big ? `<i>${esc(p.name)}</i>` : ''}</span>`;

// Kartuşların ekrandaki yerleri (0-1 arası, genişlik/yükseklik oranı olarak).
// Orijinal sahnedeki gibi BMO'nun çevresine dağınık.
const WIDE_SPOTS = [
  [0.39, 0.37], [0.645, 0.43], [0.31, 0.54], [0.675, 0.63], [0.395, 0.69], [0.72, 0.3],
];

// projeler + en sonda altın "Hakkımda" kartuşu
const items = [...projects, about];
const isAbout = (p) => p.kind === 'about';

export async function mountAdventure(root, { onSwitch } = {}) {
  await Promise.all([
    document.fonts.load(`400 40px ${PIXEL}`),
    document.fonts.load(`700 40px ${PIXEL}`),
    document.fonts.load(`800 40px ${DISPLAY}`),
    document.fonts.load('20px VT323'),
  ]).catch(() => {});

  // Proje görselleri ve logoları (varsa) kartuş etiketine çizilecek
  const loadImg = (src) =>
    new Promise((res) => {
      if (!src) return res(null);
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  const [images, logos] = await Promise.all([
    Promise.all(items.map((p) => loadImg(p.image))),
    Promise.all(items.map((p) => loadImg(p.logo))),
  ]);

  root.innerHTML = `
  <div class="adv" data-tv="false">
    ${adventure.background ? `<img class="adv-bg" src="${esc(adventure.background)}" alt="">` : ''}
    <canvas class="adv-canvas" aria-hidden="true"></canvas>
    <button type="button" class="adv-start" hidden>
      <span class="adv-start-tag"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 1h2v6h1V5h2v2h1V6h2v6l-2 3H6L3 10V8h2V1z" fill="currentColor"/></svg><span class="adv-start-text"></span></span>
    </button>
    <div class="adv-vignette" aria-hidden="true"></div>
    <div class="sr-only" role="group" aria-label="Kartuşlar">
      ${items.map((p, i) => `<button type="button" class="cart-a11y" data-i="${i}">${esc(p.name)} kartuşunu BMO'ya tak</button>`).join('')}
    </div>
    <div class="adv-dialog">
      <span class="adv-name">BMO</span>
      <p class="adv-text" aria-hidden="true"></p>
      <p class="adv-hint"></p>
    </div>
    <section class="adv-tv" aria-label="Proje" hidden>
      <div class="tv-inner">
        <figure class="tv-shot"></figure>
        <h2 class="tv-title"></h2>
        <p class="tv-desc"></p>
        <div class="tv-chips"></div>
        <div class="tv-links"></div>
        <div class="tv-actions">
          <a class="tv-btn tv-a" target="_blank" rel="noopener"><span class="tv-key">A</span><span class="tv-a-label"></span></a>
          <button type="button" class="tv-btn tv-b"><span class="tv-key">B</span>Çıkar</button>
        </div>
      </div>
    </section>
    <div class="adv-corner">
      <button type="button" class="adv-btn adv-skip" hidden>Geç</button>
      ${onSwitch ? '<button type="button" class="adv-btn adv-mode">Normal mod</button>' : ''}
      <button type="button" class="adv-btn adv-sound" aria-label="Ses"></button>
    </div>
    <p class="sr-only" role="status" aria-live="polite"></p>
  </div>`;

  const el = {
    wrap: root.querySelector('.adv'),
    canvas: root.querySelector('.adv-canvas'),
    sound: root.querySelector('.adv-sound'),
    skip: root.querySelector('.adv-skip'),
    start: root.querySelector('.adv-start'),
    dialog: root.querySelector('.adv-dialog'),
    text: root.querySelector('.adv-text'),
    hint: root.querySelector('.adv-hint'),
    live: root.querySelector('[role=status]'),
    tv: root.querySelector('.adv-tv'),
  };

  // ---------- Renderer / sahne ----------
  const renderer = new THREE.WebGLRenderer({ canvas: el.canvas, antialias: true, alpha: !!adventure.background });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#24160d');
  scene.fog = new THREE.Fog('#24160d', 18, 34);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 80);
  const camTarget = new THREE.Vector3(0, 1.3, 0);
  // hafif soldan ve alçaktan bakış (orijinaldeki gibi BMO'nun yan yüzü görünür)
  const YAW = THREE.MathUtils.degToRad(8);
  const ELEV = THREE.MathUtils.degToRad(2);
  const camDir = new THREE.Vector3(-Math.sin(YAW) * Math.cos(ELEV), Math.sin(ELEV), Math.cos(YAW) * Math.cos(ELEV));
  let camDist = 12;
  let zoom = 0;
  const lookAt = new THREE.Vector3();

  // Çizgi film görünümü: yumuşak 3 kademe + kalın kontur
  const grad = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 205, 205, 205, 255, 255, 255, 255, 255]), 3, 1);
  grad.minFilter = grad.magFilter = THREE.NearestFilter;
  grad.needsUpdate = true;
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: grad, ...extra });

  const outlineMats = new Map();
  function outline(mesh, t = 0.022) {
    if (!outlineMats.has(t)) {
      outlineMats.set(
        t,
        new THREE.ShaderMaterial({
          side: THREE.BackSide,
          uniforms: { t: { value: t } },
          vertexShader: 'uniform float t; void main(){ vec3 p = position + normal * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
          fragmentShader: 'void main(){ gl_FragColor = vec4(0.08, 0.08, 0.08, 1.0); }',
        })
      );
    }
    const o = new THREE.Mesh(mesh.geometry, outlineMats.get(t));
    o.raycast = () => {};
    mesh.add(o);
    return mesh;
  }

  function canvasTex(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { c, ctx, tex, w, h };
  }

  // Köşeleri yuvarlatılmış düz plaka (UV 0-1)
  function roundRectGeo(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    const g = new THREE.ShapeGeometry(s, 8);
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
    return g;
  }

  // ---------- Işıklar ----------
  scene.add(new THREE.HemisphereLight('#fff0dc', '#4a3020', 1.5));
  const sun = new THREE.DirectionalLight('#ffe2b8', 1.6);
  sun.position.set(-4, 9, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 5;
  scene.add(sun);
  const lampLight = new THREE.PointLight('#ffb15a', 14, 12, 1.6);
  scene.add(lampLight);

  // ---------- Ağaç ev ----------
  function woodTex(palette, vertical, w = 512, h = 512, plank = 64) {
    const t = canvasTex(w, h);
    const { ctx } = t;
    const len = vertical ? w : h;
    for (let i = 0; i * plank < len; i++) {
      const base = palette[(i * 7 + 3) % palette.length];
      ctx.fillStyle = base;
      if (vertical) ctx.fillRect(i * plank, 0, plank, h);
      else ctx.fillRect(0, i * plank, w, plank);
      ctx.strokeStyle = 'rgba(40,20,8,0.22)';
      ctx.lineWidth = 1.5;
      for (let g = 0; g < 5; g++) {
        const off = 8 + Math.random() * (plank - 16);
        ctx.beginPath();
        for (let s = 0; s <= 16; s++) {
          const along = (s / 16) * (vertical ? h : w);
          const wob = Math.sin(s * 0.9 + g * 3 + i) * 2.5;
          const x = vertical ? i * plank + off + wob : along;
          const y = vertical ? along : i * plank + off + wob;
          s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(25,12,4,0.65)';
      if (vertical) ctx.fillRect(i * plank, 0, 3, h);
      else ctx.fillRect(0, i * plank, w, 3);
      // çiviler
      ctx.fillStyle = 'rgba(30,18,10,0.7)';
      for (const k of [0.08, 0.92]) {
        const a = vertical ? i * plank + plank / 2 : k * w;
        const b = vertical ? k * h : i * plank + plank / 2;
        ctx.beginPath();
        ctx.arc(a - 8, b, 2.5, 0, Math.PI * 2);
        ctx.arc(a + 8, b, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    t.tex.wrapS = t.tex.wrapT = THREE.RepeatWrapping;
    t.tex.needsUpdate = true;
    return t.tex;
  }

  const room = new THREE.Group();
  scene.add(room);

  const floorTex = woodTex(['#7a4a2a', '#83512e', '#6f4225', '#8a5632', '#764729'], false);
  floorTex.repeat.set(6, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), toon('#ffffff', { map: floorTex }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  const wallTex = (rx = 3) => {
    const t = woodTex(['#9a6337', '#a36b3c', '#8f5a31', '#a8703f', '#94603a'], true);
    t.repeat.set(rx, 2);
    return t;
  };
  const DARK = '#4e301a';
  const WOOD = '#6b4226';
  const add = (m, x, y, z, parent = room) => {
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, c, t = 0.014) => outline(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toon(c)), t);
  const cyl = (rt, rb, h, c, seg = 20, t = 0.016) => outline(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toon(c)), t);

  // Altıgen oda: arka duvar + iki eğik yan duvar
  const BACK_Z = -4.6;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 11), toon('#ffffff', { map: wallTex(3.4) }));
  back.position.set(0, 5.5, BACK_Z);
  back.receiveShadow = true;
  room.add(back);
  const walls = {};
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(9.4, 11), toon('#e2c9b2', { map: wallTex(3.2) }));
    side.position.set(s * 6.55, 5.5, -0.8);
    side.rotation.y = -s * 1.117;
    side.receiveShadow = true;
    room.add(side);
    // yan duvara iliştirilen eşyalar için yerel koordinat (x: duvar boyunca, z: odaya doğru)
    const g = new THREE.Group();
    g.position.copy(side.position).setY(0);
    g.rotation.y = side.rotation.y;
    room.add(g);
    walls[s] = g;
    // köşelerde kalın, hafif eğri ağaç gövdeleri
    const trunk = cyl(0.32, 0.45, 11, '#5a371e', 12, 0.025);
    trunk.rotation.z = s * 0.04;
    add(trunk, s * 4.75, 5.5, BACK_Z + 0.1);
    const root1 = cyl(0.05, 0.35, 0.9, '#5a371e', 10);
    root1.rotation.z = s * 0.9;
    add(root1, s * 4.4, 0.2, BACK_Z + 0.4);
  }
  // tavana doğru kiriş
  const beam = box(9.6, 0.35, 0.35, '#5a371e', 0.02);
  add(beam, 0, 6.6, BACK_Z + 0.25);

  // Yuvarlak pencere: akşam gökyüzü
  {
    const sky = canvasTex(256, 256);
    const g = sky.ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#2c2a68');
    g.addColorStop(0.55, '#8a4f8f');
    g.addColorStop(1, '#f39a6b');
    sky.ctx.fillStyle = g;
    sky.ctx.fillRect(0, 0, 256, 256);
    sky.ctx.fillStyle = '#fff6d8';
    for (let i = 0; i < 40; i++) sky.ctx.fillRect(Math.random() * 256, Math.random() * 140, 2, 2);
    sky.ctx.beginPath();
    sky.ctx.arc(170, 70, 22, 0, Math.PI * 2);
    sky.ctx.fill();
    sky.ctx.fillStyle = '#2c2a68';
    sky.ctx.beginPath();
    sky.ctx.arc(180, 63, 20, 0, Math.PI * 2);
    sky.ctx.fill();
    sky.ctx.fillStyle = '#3d2a52';
    sky.ctx.beginPath();
    sky.ctx.moveTo(0, 256);
    for (let x = 0; x <= 256; x += 16) sky.ctx.lineTo(x, 200 + Math.sin(x * 0.03) * 18);
    sky.ctx.lineTo(256, 256);
    sky.ctx.fill();
    sky.tex.needsUpdate = true;

    const win = new THREE.Group();
    win.position.set(0.3, 4.9, BACK_Z + 0.03);
    win.add(new THREE.Mesh(new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({ map: sky.tex, fog: false })));
    win.add(outline(new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.11, 12, 48), toon(DARK)), 0.015));
    for (const r of [0, Math.PI / 2]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.05), toon(DARK));
      bar.rotation.z = r;
      bar.position.z = 0.02;
      win.add(bar);
    }
    room.add(win);
  }

  // Raf yardımcıları: kitap, kafatası, kavanoz
  const bookColors = ['#c0473b', '#3f6fb0', '#e0b23f', '#4f9a63', '#8a4fa3', '#d9733a', '#2e8a8a', '#c9c2a8', '#7a3b2e'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  function skull(parent, x, y, z, s = 1, rotY = 0) {
    const g = new THREE.Group();
    const head = outline(new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), toon('#eee3c8')), 0.012);
    head.scale.set(1, 0.92, 1.05);
    const jaw = outline(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.16), toon('#e3d6b8')), 0.01);
    jaw.position.set(0, -0.16, 0.06);
    g.add(head, jaw);
    for (const ex of [-0.075, 0.075]) {
      const eye = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), new THREE.MeshBasicMaterial({ color: '#2a1a12' }));
      eye.position.set(ex, 0.0, 0.205);
      g.add(eye);
    }
    g.scale.setScalar(s);
    g.rotation.y = rotY;
    g.position.set(x, y + 0.2 * s, z);
    g.traverse((o) => (o.castShadow = true));
    parent.add(g);
  }
  function shelf(parent, x0, x1, y, z, items) {
    const board = box(x1 - x0 + 0.2, 0.09, 0.5, WOOD, 0.012);
    add(board, (x0 + x1) / 2, y, z, parent);
    for (const bx of [x0, x1]) add(box(0.06, 0.25, 0.4, DARK, 0.01), bx, y - 0.16, z - 0.02, parent);
    let x = x0;
    for (const it of items) {
      if (x > x1 - 0.1) break;
      if (it === 'skull') {
        skull(parent, x + 0.2, y + 0.045, z + 0.02, 0.95, (rnd() - 0.5) * 0.6);
        x += 0.45;
      } else if (it === 'jar') {
        const jar = cyl(0.11, 0.11, 0.28, ['#7fb8a8', '#c98c5a', '#9a7fc4'][Math.floor(rnd() * 3)], 14, 0.01);
        add(jar, x + 0.12, y + 0.185, z, parent);
        x += 0.3;
      } else if (it === 'gap') {
        x += 0.25;
      } else {
        for (let b = 0; b < it; b++) {
          const w = 0.09 + rnd() * 0.07;
          const h = 0.32 + rnd() * 0.24;
          const book = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.34), toon(bookColors[Math.floor(rnd() * bookColors.length)]));
          add(book, x + w / 2, y + 0.045 + h / 2, z + 0.02, parent);
          if (rnd() < 0.12) {
            book.rotation.z = 0.28;
            book.position.x += 0.06;
          }
          x += w + 0.012;
        }
      }
    }
  }
  // arka duvar: sol ve sağ raflar
  shelf(room, -3.9, -1.4, 2.0, BACK_Z + 0.3, ['skull', 'gap', 6, 'jar', 3]);
  shelf(room, -3.9, -1.4, 3.15, BACK_Z + 0.3, [9, 'gap', 'jar', 'skull']);
  shelf(room, -3.6, -1.6, 4.3, BACK_Z + 0.3, [4, 'jar', 6]);
  shelf(room, 1.6, 4.0, 3.3, BACK_Z + 0.3, [7, 'skull', 5]);
  shelf(room, 1.9, 4.0, 4.4, BACK_Z + 0.3, ['jar', 8, 'gap', 3]);
  // yan duvarlar
  shelf(walls[-1], -2.6, 0.2, 2.4, 0.3, ['skull', 'skull', 'gap', 'jar', 4]);
  shelf(walls[-1], -2.4, 0.2, 3.5, 0.3, [6, 'skull', 'jar']);
  shelf(walls[1], -0.4, 2.4, 2.6, 0.3, [10, 'jar', 'gap', 4]);
  shelf(walls[1], -0.2, 2.2, 3.7, 0.3, ['jar', 'jar', 7]);

  // duvara asılı kılıç
  {
    const sword = new THREE.Group();
    const blade = outline(new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.2, 0.02), toon('#dfe6ea')), 0.01);
    blade.position.y = 0.7;
    const guard = outline(new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.06), toon('#d4a73a')), 0.01);
    guard.position.y = 0.08;
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24), toon('#5b3420'));
    sword.add(blade, guard, hilt);
    sword.position.set(-0.9, 2.7, BACK_Z + 0.08);
    sword.rotation.z = -0.5;
    room.add(sword);
  }

  // BMO'nun arkasında yuvarlak koltuk + yastıklar
  {
    const sofa = new THREE.Group();
    add(cyl(1.45, 1.5, 0.55, '#a7a13e', 36, 0.022), 0, 0.28, 0, sofa);
    add(cyl(1.38, 1.38, 0.12, '#cfc85c', 36, 0.015), 0, 0.6, 0, sofa);
    const rim = outline(new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.22, 12, 36, Math.PI * 1.1), toon('#bdb64e')), 0.018);
    rim.rotation.set(-Math.PI / 2, 0, Math.PI * -0.05);
    add(rim, 0, 0.78, 0, sofa);
    for (const [x, r] of [[-0.75, 0.15], [0.55, -0.12]]) {
      const pillow = outline(new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.7, 6, 14), toon('#93c495')), 0.015);
      pillow.rotation.set(0, r, Math.PI / 2);
      add(pillow, x, 1.0, -0.95, sofa);
    }
    const book = box(0.4, 0.06, 0.3, '#3f6fb0', 0.01);
    book.rotation.y = 0.4;
    add(book, -0.3, 0.7, 0.3, sofa);
    sofa.position.set(1.9, 0, -2.6);
    room.add(sofa);
  }

  // sağ önde kütük masa
  {
    const stump = new THREE.Group();
    add(cyl(0.6, 0.72, 0.95, '#6b4528', 18, 0.02), 0, 0.47, 0, stump);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.6, 24), toon('#d9b07a'));
    top.rotation.x = -Math.PI / 2;
    add(top, 0, 0.951, 0, stump);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.33, 24), toon('#b38455'));
    ring.rotation.x = -Math.PI / 2;
    add(ring, 0, 0.953, 0, stump);
    add(box(0.5, 0.08, 0.36, '#c0473b', 0.01), 0.05, 1.0, 0.05, stump);
    add(box(0.44, 0.07, 0.32, '#e0b23f', 0.01), 0.02, 1.075, 0.02, stump).rotation.y = 0.3;
    skull(stump, -0.05, 1.11, 0.0, 0.8, -0.5);
    stump.position.set(3.6, 0, 0.2);
    room.add(stump);
  }

  // solda fıçı ve sandık
  {
    const barrel = new THREE.Group();
    const body = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 20), toon('#8a5632')), 0.02);
    add(body, 0, 0.6, 0, barrel);
    for (const y of [0.22, 0.98]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.035, 8, 24), toon('#3b3b3b'));
      hoop.rotation.x = Math.PI / 2;
      add(hoop, 0, y, 0, barrel);
    }
    barrel.position.set(-3.7, 0, -2.4);
    room.add(barrel);

    const chest = new THREE.Group();
    add(box(1.1, 0.6, 0.7, '#7a4a2a', 0.02), 0, 0.3, 0, chest);
    const lid = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.1, 16, 1, false, 0, Math.PI), toon('#8a5632')), 0.02);
    lid.rotation.z = Math.PI / 2;
    add(lid, 0, 0.6, 0, chest);
    for (const x of [-0.35, 0.35]) add(box(0.08, 0.62, 0.72, '#d4a73a', 0.008), x, 0.31, 0, chest);
    add(box(0.14, 0.16, 0.05, '#d4a73a', 0.008), 0, 0.5, 0.36, chest);
    chest.position.set(-3.4, 0, 0.6);
    chest.rotation.y = 0.5;
    room.add(chest);
  }

  // Halı
  {
    const rugOuter = new THREE.Mesh(new THREE.CircleGeometry(2.2, 48), toon('#3d6f50'));
    const rugInner = new THREE.Mesh(new THREE.CircleGeometry(1.9, 48), toon('#5f9f74'));
    const rugRing = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.45, 48), toon('#e7c56a'));
    [rugOuter, rugInner, rugRing].forEach((m, i) => {
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0.01 + i * 0.004, 0.3);
      m.receiveShadow = true;
      room.add(m);
    });
  }

  // Saksı bitkisi (sağ arka köşe)
  {
    const plant = new THREE.Group();
    const pot = outline(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.27, 0.55, 16), toon('#c8643b')), 0.015);
    pot.position.y = 0.28;
    pot.castShadow = true;
    plant.add(pot);
    for (let i = 0; i < 8; i++) {
      const leaf = outline(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), toon(i % 2 ? '#4f9a54' : '#62b25f')), 0.012);
      const a = (i / 8) * Math.PI * 2;
      leaf.scale.set(0.6, 1.6, 0.6);
      leaf.position.set(Math.cos(a) * 0.2, 0.85 + (i % 3) * 0.1, Math.sin(a) * 0.2);
      leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      leaf.castShadow = true;
      plant.add(leaf);
    }
    plant.position.set(-0.2, 0, -3.9);
    room.add(plant);
  }

  // Asılı lamba
  const lamp = new THREE.Group();
  {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 3, 6), toon('#222'));
    cord.position.y = 1.5;
    const shade = outline(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.32, 24, 1, true), toon('#e0a43b', { side: THREE.DoubleSide })), 0.012);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1c4' }));
    bulb.position.y = -0.12;
    lamp.add(cord, shade, bulb);
    lamp.position.set(-1.4, 5.2, -1.6);
    scene.add(lamp);
  }

  // Işıkta süzülen toz
  const dust = (() => {
    const n = 140;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = 0.3 + Math.random() * 3.8;
      pos[i * 3 + 2] = -2.5 + Math.random() * 4.5;
      seed[i] = Math.random() * 10;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: '#ffe2a8', size: 0.035, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scene.add(pts);
    return { pts, pos, seed, n };
  })();


  // ---------- BMO ----------
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  // react: fareye tepki (pet: BMO'nun üstünde, curious: kartuşun üstünde, whoa: hızlı hareket, sleepy: uzun süre hareketsiz)
  const faceState = { mood: 'idle', moodUntil: 0, blinkAt: 2, talking: false, screen: 'face', bootP: null, react: 'none' };

  const scr = canvasTex(512, 385);
  // oranı yan yüzle aynı: (H - 2R) / (D - 2R)
  const side = canvasTex(256, 711);

  const bmo = new THREE.Group();
  // bmoTurn: açılışta BMO'nun yerinde dönmesi için (sırtını gösterir)
  const bmoTurn = new THREE.Group();
  bmo.add(bmoTurn);
  const bmoBody = new THREE.Group();
  bmoTurn.add(bmoBody);
  scene.add(bmo);

  // Renkler ve oranlar referans BMO'dan ölçüldü
  const BODY_TOP = '#89bca9';
  const BODY = '#7ead9c';
  const BODY_SIDE = '#6a9485';
  const LIMB = '#6a98ab';
  // Işığın sıcak tonundan az etkilensin, düz çizgi film rengi gibi dursun
  const flatToon = (c, e = 0.3) => new THREE.MeshToonMaterial({ color: c, gradientMap: grad, emissive: new THREE.Color(c).multiplyScalar(e) });
  // Gövde ışıktan bağımsız 3 düz tonla boyanır: üst açık, ön orta, yanlar koyu
  const bodyMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  function shadeBody(geo) {
    const n = geo.attributes.normal;
    const cols = new Float32Array(n.count * 3);
    const tones = [new THREE.Color(BODY_TOP), new THREE.Color(BODY), new THREE.Color(BODY_SIDE)];
    for (let i = 0; i < n.count; i++) {
      const nx = n.getX(i);
      const ny = n.getY(i);
      const tone = ny > 0.45 ? 0 : Math.abs(nx) > 0.55 || ny < -0.45 ? 2 : 1;
      tones[tone].toArray(cols, i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return geo;
  }
  const W = 1.14;
  // ön yüz yerleşimi W = 1.32 için ölçüldü; genişlik değişince yatayda bununla ölçeklenir
  const K = W / 1.32;
  const H = 1.7;
  const D = 0.74;
  // BMO çapraz oturuyor: önü sağ-öne dönük, sol yan yüzü görünür
  const BASE_YAW = 0.48;
  bmo.rotation.y = BASE_YAW;
  const BOTTOM = 0.12;
  // köşeler yumuşak yuvarlatılmış, siyah kontur
  const BODY_R = 0.1;
  const body = outline(new THREE.Mesh(shadeBody(new RoundedBoxGeometry(W, H, D, 6, BODY_R)), bodyMat), 0.024);
  body.position.y = BOTTOM + H / 2;
  body.castShadow = true;
  bmoBody.add(body);

  // ön yüz: ekran ve tuşlar (yerel 0,0 = gövde merkezi, z = ön yüz)
  const front = new THREE.Group();
  front.position.set(0, BOTTOM + H / 2, D / 2 + 0.002);
  bmoBody.add(front);

  const SCREEN_W = W * 0.747;
  const SCREEN_H = 0.64;
  const SCREEN_Y = 0.385;
  const bezel = new THREE.Mesh(roundRectGeo(SCREEN_W + 0.04, SCREEN_H + 0.04, 0.05), new THREE.MeshBasicMaterial({ color: '#16201c' }));
  bezel.position.set(0, SCREEN_Y, 0.001);
  front.add(bezel);
  const screen = new THREE.Mesh(roundRectGeo(SCREEN_W, SCREEN_H, 0.03), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
  screen.position.set(0, SCREEN_Y, 0.004);
  screen.userData.kind = 'screen';
  front.add(screen);

  // basılabilen tuşlar: aynı adı taşıyan parçalar (D-pad'in iki kolu gibi) birlikte gömülür
  const buttons = {};
  function flat(geo, color, x, y, t = 0.01, rot = 0, name = null) {
    const m = outline(new THREE.Mesh(geo, flatToon(color, 0.3)), t);
    m.position.set(x * K, y, 0.018);
    m.scale.setScalar(K);
    m.rotation.z = rot;
    front.add(m);
    if (name) {
      m.userData.button = name;
      (buttons[name] ||= []).push(m);
    }
    return m;
  }
  const disc = (r) => new THREE.CylinderGeometry(r, r, 0.035, 32).rotateX(Math.PI / 2);
  // kartuş yuvası: ekranın hemen altında, sola yaslı ince uzun koyu yarık
  const SLOT_X = -0.15 * K;
  const SLOT_Y = -0.04;
  const SLOT_W = 0.62 * K;
  const slot = new THREE.Mesh(new RoundedBoxGeometry(SLOT_W, 0.04, 0.012, 2, 0.006), new THREE.MeshBasicMaterial({ color: '#262928' }));
  slot.position.set(SLOT_X, SLOT_Y, 0.004);
  front.add(slot);
  // takılı kartuşun yuvadan görünen ucu: projenin renginde ince şerit
  const slotFill = new THREE.Mesh(new THREE.BoxGeometry(SLOT_W - 0.08, 0.02, 0.004), new THREE.MeshBasicMaterial({ color: '#888' }));
  slotFill.position.set(SLOT_X, SLOT_Y, 0.009);
  slotFill.visible = false;
  front.add(slotFill);
  const NAVY = '#120c8f';
  flat(disc(0.028), NAVY, 0.45, -0.04, 0.007, 0, 'blue');
  // D-pad
  flat(new RoundedBoxGeometry(0.28, 0.095, 0.04, 2, 0.012), '#f1db6a', -0.28, -0.4, 0.01, 0, 'dpad');
  flat(new RoundedBoxGeometry(0.095, 0.28, 0.04, 2, 0.012), '#f1db6a', -0.28, -0.4, 0.01, 0, 'dpad');
  // üçgen, yeşil, kırmızı
  flat(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 3).rotateX(Math.PI / 2), '#83cfe7', 0.15, -0.34, 0.009, Math.PI, 'triangle');
  flat(disc(0.074), '#94f16c', 0.44, -0.37, 0.01, 0, 'b');
  flat(disc(0.125), '#d4445a', 0.18, -0.55, 0.01, 0, 'a');
  // iki koyu lacivert hap
  flat(new RoundedBoxGeometry(0.18, 0.05, 0.025, 2, 0.022), NAVY, -0.395, -0.65, 0.009, 0, 'pill');
  flat(new RoundedBoxGeometry(0.18, 0.05, 0.025, 2, 0.022), NAVY, -0.185, -0.65, 0.009, 0, 'pill');

  // yan yüz: 2-3-2 petek hoparlör + kalın dikey "BMO"
  // Kanvas oranı yüzeyle aynı (daireler basık çıkmasın); 1 birim = SIDE_PX piksel
  const SIDE_PW = D - 2 * BODY_R;
  const SIDE_PH = H - 2 * BODY_R;
  const SIDE_PX = side.w / SIDE_PW;
  let armOY = BOTTOM + H * 0.3;
  {
    const { ctx, w, h } = side;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0d161d';
    const sy = h * 0.18;
    const dots = [[-0.5, -1], [0.5, -1], [-1, 0], [0, 0], [1, 0], [-0.5, 1], [0.5, 1]];
    for (const [c, r] of dots) {
      ctx.beginPath();
      ctx.arc(w / 2 + c * w * 0.3, sy + r * h * 0.055, w * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    // yazı yukarıdan aşağı okunur; boyu yüzün ~%47'si, harf yüksekliği genişliğin ~%48'i
    const cy = h * 0.575;
    const len = h * 0.47;
    const capH = w * 0.48;
    ctx.save();
    ctx.translate(w / 2, cy);
    ctx.rotate(Math.PI / 2);
    ctx.transform(1, 0, -0.12, 1, 0, 0);
    const fs = capH / 0.72;
    ctx.font = `800 ${fs}px ${DISPLAY}`;
    const full = ctx.measureText('BMO').width;
    const sx = len / full;
    ctx.scale(sx, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#10181d';
    ctx.fillText('BMO', 0, 0);
    ctx.restore();
    // "O" harfinin merkezi: sol kol buradan çıkar
    const oCenter = cy + len / 2 - (ctx.measureText('O').width * sx) / 2;
    armOY = BOTTOM + H - BODY_R - oCenter / SIDE_PX;
    side.tex.needsUpdate = true;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(SIDE_PW, SIDE_PH), new THREE.MeshBasicMaterial({ map: side.tex, transparent: true }));
    plane.position.set(-W / 2 - 0.003, BOTTOM + H / 2, 0);
    plane.rotation.y = -Math.PI / 2;
    bmoBody.add(plane);
  }

  // kollar ve bacaklar: ince çelik mavisi tüpler, uçları basık top
  const limbMat = flatToon(LIMB, 0.35);
  function limb(points, r = 0.03) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    const m = outline(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, r, 10), limbMat), 0.011);
    m.castShadow = true;
    const end = outline(new THREE.Mesh(new THREE.SphereGeometry(r * 2, 16, 12), limbMat), 0.011);
    end.scale.set(1, 0.75, 1.15);
    end.position.copy(curve.getPoint(1));
    end.castShadow = true;
    m.add(end);
    return { m, end };
  }
  // sol kol "O" harfinin içinden çıkıp yana kıvrılarak yere iner; sağ kol yere dayanır
  const ARM_PATHS = {
    [-1]: { at: [-W / 2 + 0.01, armOY, 0.02], pts: [[0, 0, 0], [-0.09, -0.06, 0.02], [-0.12, -0.3, 0.08], [-0.07, -(armOY - 0.07), 0.17]] },
    [1]: { at: [W / 2 - 0.01, BOTTOM + 0.32, 0.06], pts: [[0, 0, 0], [0.1, -0.06, 0.04], [0.15, -0.2, 0.12], [0.14, -0.25, 0.22]] },
  };
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(...ARM_PATHS[s].at);
    pivot.add(limb(ARM_PATHS[s].pts).m);
    bmoBody.add(pivot);
    return { pivot, s, wave: 0 };
  });
  // bacaklar: ikisi de öne uzanıyor, sağdaki biraz dışa açık
  bmoBody.add(limb([[-0.23, BOTTOM + 0.02, 0.18], [-0.24, 0.07, 0.45], [-0.2, 0.06, 0.72], [-0.17, 0.06, 0.88]]).m);
  bmoBody.add(limb([[0.23, BOTTOM + 0.02, 0.18], [0.29, 0.07, 0.42], [0.39, 0.06, 0.66], [0.47, 0.06, 0.8]]).m);

  // sırt: üstte havalandırma yarıkları, altta menteşeli pil kapağı (dizideki gibi)
  const HATCH_W = 0.46;
  const HATCH_H = 0.44;
  const HATCH_Y = BOTTOM + 0.36;
  {
    const ventMat = new THREE.MeshBasicMaterial({ color: '#3d5a50' });
    for (let k = 0; k < 6; k++) {
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.006), ventMat);
      v.position.set((k - 2.5) * 0.09, BOTTOM + H * 0.72, -D / 2 - 0.002);
      bmoBody.add(v);
    }
  }
  const hatch = new THREE.Group();
  {
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(HATCH_W, HATCH_H).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: '#16201c' }));
    hole.position.set(0, HATCH_Y, -D / 2 - 0.003);
    hatch.add(hole);
    // kapak alt kenarından menteşeli: açılınca dışarı ve aşağı sarkar
    const door = new THREE.Group();
    door.position.set(0, HATCH_Y - HATCH_H / 2, -D / 2 - 0.01);
    const plate = outline(new THREE.Mesh(new THREE.BoxGeometry(HATCH_W + 0.02, HATCH_H + 0.02, 0.014), new THREE.MeshBasicMaterial({ color: BODY_SIDE })), 0.008);
    plate.position.y = HATCH_H / 2;
    // tırnak çizgisi
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.004), new THREE.MeshBasicMaterial({ color: '#2b3d36' }));
    notch.position.set(0, HATCH_H / 2 - 0.04, -0.008);
    plate.add(notch);
    door.add(plate);
    hatch.add(door);
    hatch.userData.door = door;
    bmoBody.add(hatch);
  }
  // piller: koyu gövde, bakır renkli üst, küçük artı ucu (yatık, ekseni z)
  const BAT_R = 0.075;
  const BAT_L = 0.42;
  function battery(fresh) {
    const g = new THREE.Group();
    const mk = (r, l, c, z) => {
      const m = outline(new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 20).rotateX(Math.PI / 2), flatToon(c, 0.25)), 0.008);
      m.position.z = z;
      m.castShadow = true;
      g.add(m);
    };
    mk(BAT_R, BAT_L * 0.62, fresh ? '#25282c' : '#6b6f70', -BAT_L * 0.19);
    mk(BAT_R, BAT_L * 0.38, fresh ? '#e2a441' : '#a88760', BAT_L * 0.31);
    mk(BAT_R * 0.35, 0.03, fresh ? '#d9dde0' : '#8b8d8a', BAT_L / 2 + 0.015);
    g.visible = false;
    return g;
  }
  // eskiler kapağın arkasında dik duruyor, yeniler yerde
  const oldBats = [-0.09, 0.09].map((x) => {
    const b = battery(false);
    b.position.set(x, HATCH_Y, -D / 2 + 0.1);
    b.rotation.x = Math.PI / 2;
    bmoBody.add(b);
    return b;
  });
  const newBats = [0, 1].map(() => {
    const b = battery(true);
    bmo.add(b);
    return b;
  });

  // ---------- Ekran çizimleri ----------
  // Göz boyutu ifadeler arasında yumuşakça geçsin diye kare kare yaklaşır
  const eyeAnim = { s: 1 };
  function drawFace(ctx, W, H, t) {
    // referanstan ölçüldü: ortası parlak açık nane, kenarlara doğru hafif koyulaşır
    const g = ctx.createRadialGradient(W / 2, H * 0.42, 10, W / 2, H * 0.45, W * 0.62);
    g.addColorStop(0, '#e0fde3');
    g.addColorStop(1, '#cdeed2');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const INKC = '#1e3a31';
    ctx.fillStyle = ctx.strokeStyle = INKC;
    ctx.lineCap = 'round';
    ctx.lineWidth = 10;
    const lx = look.x * 16;
    const ly = look.y * 9;
    const ey = H * 0.31 + ly;
    // olay ifadesi (kartuş takma vb.) fareye tepkiden önce gelir
    const m = faceState.mood !== 'idle' ? faceState.mood : faceState.react;
    const closedHappy = m === 'happy' || m === 'pet';
    const blinking = !closedHappy && m !== 'sleepy' && t > faceState.blinkAt && t < faceState.blinkAt + 0.13;
    const wantS = m === 'whoa' ? 1.25 : m === 'curious' ? 1.15 : 1;
    eyeAnim.s += (wantS - eyeAnim.s) * 0.2;
    const eyes = [W * 0.29 + lx, W * 0.71 + lx];
    for (const ex of eyes) {
      ctx.beginPath();
      if (closedHappy) {
        ctx.arc(ex, ey + 10, 18, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else if (blinking || m === 'squint') {
        ctx.moveTo(ex - 15, ey);
        ctx.lineTo(ex + 15, ey);
        ctx.stroke();
      } else if (m === 'sleepy') {
        // yarı kapalı göz: alt yarım oval + düz göz kapağı
        ctx.ellipse(ex, ey + 4, 14, 17, 0, 0, Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.lineWidth = 7;
        ctx.moveTo(ex - 17, ey + 4);
        ctx.lineTo(ex + 17, ey + 4);
        ctx.stroke();
        ctx.lineWidth = 10;
      } else {
        // dik oval göz
        const s = eyeAnim.s;
        ctx.ellipse(ex, ey, 14 * s, 21 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        if (m === 'curious' || m === 'whoa') {
          // parıltı
          ctx.fillStyle = '#e8fdea';
          ctx.beginPath();
          ctx.arc(ex + 4 * s, ey - 8 * s, 4.5 * s, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = INKC;
        }
      }
    }
    if (m === 'pet') {
      // pembe yanaklar
      ctx.fillStyle = 'rgba(255, 120, 150, 0.35)';
      for (const ex of eyes) {
        ctx.beginPath();
        ctx.ellipse(ex + (ex < W / 2 ? -10 : 10), ey + 42, 24, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = INKC;
    }
    const mx = W / 2 + lx * 0.6;
    const my = H * 0.5 + ly * 0.6;
    ctx.beginPath();
    if (m === 'o' || m === 'whoa') {
      ctx.lineWidth = 7;
      ctx.ellipse(mx, my - 4, 12, 16, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (closedHappy) {
      ctx.arc(mx, my - 26, 48, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.closePath();
      ctx.fill();
    } else if (faceState.talking && Math.floor(t * 11) % 2 === 0) {
      ctx.ellipse(mx, my - 6, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (m === 'curious') {
      // küçük açık gülümseme
      ctx.arc(mx, my - 14, 24, 0, Math.PI);
      ctx.closePath();
      ctx.fill();
    } else if (m === 'sleepy') {
      ctx.lineWidth = 8;
      ctx.arc(mx, my - 40, 30, Math.PI / 2 - 0.6, Math.PI / 2 + 0.6);
      ctx.stroke();
      // süzülen "z"ler
      ctx.font = `700 34px ${PIXEL}`;
      ctx.textAlign = 'center';
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.35 + i / 3) % 1;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
        ctx.fillText('z', W * 0.82 + k * 40, H * 0.3 - k * 90, 40);
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    } else {
      // gülümseme: ekranın ~%27'si genişliğinde, gözlerin hemen altında derin bir "U"
      const r = W * 0.156;
      ctx.arc(mx, H * 0.43 - r * Math.cos(1.08) + ly * 0.6, r, Math.PI / 2 - 1.08, Math.PI / 2 + 1.08);
      ctx.stroke();
    }
  }

  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 128;
  noiseCanvas.height = 94;
  const nctx = noiseCanvas.getContext('2d');
  function drawStatic(ctx, W, H) {
    const img = nctx.createImageData(128, 94);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v * 0.8;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 0.9;
      img.data[i + 3] = 255;
    }
    nctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(noiseCanvas, 0, 0, W, H);
  }


  // Açılış ekranı: pixel'li ikon + isim (kamera ekrana dalarken)
  const pix = document.createElement('canvas');
  pix.width = 32;
  pix.height = 32;
  const pctx = pix.getContext('2d');
  function drawBoot(ctx, W, H, t) {
    const p = faceState.bootP;
    ctx.fillStyle = '#cfeedd';
    ctx.fillRect(0, 0, W, H);
    if (!p) return;
    // açılış ikonu: logo varsa logo, yoksa etiket görselinin pikselleştirilmiş hali
    const src = logos[p.i] || carts[p.i].userData.artCanvas;
    pctx.imageSmoothingEnabled = true;
    pctx.clearRect(0, 0, 32, 32);
    pctx.drawImage(src, 0, 0, 32, 32);
    ctx.imageSmoothingEnabled = false;
    // ikon küçükten büyüyerek ve belirerek çıkar
    const pop = faceState.bootPop ?? 1;
    const s = 150 * (0.9 + 0.1 * pop);
    const iy = 120 - s / 2;
    ctx.globalAlpha = pop;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(W / 2 - s / 2, iy, s, s, 26);
    ctx.clip();
    ctx.drawImage(pix, W / 2 - s / 2, iy, s, s);
    ctx.restore();
    ctx.globalAlpha = 1;
    // isim harf harf yazılır
    const name = p.name.toLocaleUpperCase('tr');
    ctx.fillStyle = '#173327';
    // uzun adlar ekrana sığsın diye yazı küçülür
    let fs = 46;
    ctx.font = `700 ${fs}px ${PIXEL}`;
    while (ctx.measureText(name).width > W - 40 && fs > 22) ctx.font = `700 ${(fs -= 2)}px ${PIXEL}`;
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, faceState.bootChars ?? name.length), W / 2, 268);
    ctx.textAlign = 'left';
    // takıldığı an beyaz parlama
    if (faceState.bootFlash > 0) {
      ctx.fillStyle = `rgba(240, 255, 249, ${faceState.bootFlash})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // pil ekranı: açılışta boş pil yanıp söner, sonra dilim dilim dolar
  function drawBattery(ctx, W, H, t) {
    ctx.fillStyle = '#18221d';
    ctx.fillRect(0, 0, W, H);
    const bw = 200;
    const bh = 104;
    const x = W / 2 - bw / 2 - 8;
    const y = H / 2 - bh / 2;
    const charge = faceState.charge ?? 0;
    const col = charge > 0 ? '#8df0a0' : '#5d7a6c';
    ctx.strokeStyle = ctx.fillStyle = col;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 14);
    ctx.stroke();
    ctx.fillRect(x + bw + 6, y + bh * 0.3, 14, bh * 0.4);
    const seg = 4;
    const sw = (bw - 30 - (seg - 1) * 8) / seg;
    const filled = Math.round(charge * seg);
    for (let i = 0; i < filled; i++) ctx.fillRect(x + 15 + i * (sw + 8), y + 15, sw, bh - 30);
    if (charge === 0 && Math.floor(t * 2.2) % 2 === 0) {
      // bitik pil: kırmızı ince dilim yanıp söner
      ctx.fillStyle = '#ff5b6b';
      ctx.fillRect(x + 15, y + 15, sw * 0.4, bh - 30);
    }
  }

  function renderScreen(t) {
    const { ctx, w: W, h: H } = scr;
    if (faceState.screen === 'battery') drawBattery(ctx, W, H, t);
    else if (faceState.screen === 'off') {
      ctx.fillStyle = '#18221d';
      ctx.fillRect(0, 0, W, H);
    } else if (faceState.screen === 'static') drawStatic(ctx, W, H);
    else if (faceState.screen === 'boot') drawBoot(ctx, W, H, t);
    else drawFace(ctx, W, H, t);
    // ekran dokusu: referanstaki gibi çok hafif çapraz çizgiler
    ctx.save();
    ctx.strokeStyle = 'rgba(0,40,10,0.03)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    for (let x = -H; x < W + H; x += 20) {
      ctx.moveTo(x, H);
      ctx.lineTo(x + H, 0);
    }
    ctx.stroke();
    ctx.restore();
    scr.tex.needsUpdate = true;
  }

  // Kendi arka plan resmi verildiyse 3D odayı gizle, sadece gölgeler kalsın
  if (adventure.background) {
    room.visible = false;
    lamp.visible = false;
    dust.pts.visible = false;
    scene.background = null;
    scene.fog = null;
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.3 }));
    catcher.rotation.x = -Math.PI / 2;
    catcher.receiveShadow = true;
    scene.add(catcher);
  }

  // ---------- Kartuşlar (3D) ----------
  const CW = 0.8;
  const CH = 1.04;
  const CT = 0.09;
  function drawLabel(ctx, Wc, Hc, p, img, logo) {
    // dış çerçeve: proje rengi
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(0, 0, Wc, Hc, 14);
    ctx.fill();
    // görsel alanı
    const ax = 18;
    const ay = 18;
    const aw = Wc - 36;
    const ah = Hc * 0.66;
    const art = document.createElement('canvas');
    art.width = aw;
    art.height = ah;
    const a = art.getContext('2d');
    if (img) {
      const r = Math.max(aw / img.width, ah / img.height);
      a.drawImage(img, (aw - img.width * r) / 2, (ah - img.height * r) / 2, img.width * r, img.height * r);
    } else {
      a.fillStyle = p.surface;
      a.fillRect(0, 0, aw, ah);
      a.save();
      a.globalAlpha = 0.18;
      a.strokeStyle = p.color;
      a.lineWidth = 12;
      for (let i = -ah; i < aw; i += 34) {
        a.beginPath();
        a.moveTo(i, 0);
        a.lineTo(i + ah, ah);
        a.stroke();
      }
      a.restore();
      a.fillStyle = p.color;
      a.textAlign = 'center';
      a.textBaseline = 'middle';
      let size = 120;
      a.font = `800 ${size}px ${DISPLAY}`;
      while (a.measureText(p.short).width > aw - 50) a.font = `800 ${(size -= 6)}px ${DISPLAY}`;
      a.fillText(p.short, aw / 2, ah / 2 + 4);
    }
    ctx.drawImage(art, ax, ay);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.strokeRect(ax, ay, aw, ah);
    // alt şerit: ikon + isim
    const sy = ay + ah + 16;
    const is = Hc - sy - 16;
    if (logo) {
      // logo varsa ikon kutusunda logo
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(ax, sy, is, is, 12);
      ctx.clip();
      ctx.drawImage(logo, ax, sy, is, is);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(ax, sy, is, is, 12);
      ctx.fill();
      ctx.fillStyle = p.color === '#ffffff' ? '#000' : p.surface;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let s2 = 40;
      ctx.font = `800 ${s2}px ${DISPLAY}`;
      while (ctx.measureText(p.short).width > is - 12) ctx.font = `800 ${(s2 -= 3)}px ${DISPLAY}`;
      ctx.fillText(p.short, ax + is / 2, sy + is / 2 + 2);
    }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.ink;
    ctx.textAlign = 'left';
    let s3 = 34;
    ctx.font = `700 ${s3}px ${PIXEL}`;
    const name = p.name.toLocaleUpperCase('tr');
    while (ctx.measureText(name).width > Wc - ax - is - 34 && s3 > 14) ctx.font = `700 ${(s3 -= 2)}px ${PIXEL}`;
    ctx.fillText(name, ax + is + 14, sy + is / 2 + 2);
    return art;
  }

  const shellGeo = new RoundedBoxGeometry(CW, CH, CT, 3, 0.035);
  const labelGeo = roundRectGeo(CW * 0.86, CH * 0.7, 0.03);
  // Hakkımda kartuşunun etrafında dönen parıltılar için dört köşeli yıldız
  const starTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,240,1)');
    gr.addColorStop(0.45, 'rgba(255,214,90,1)');
    gr.addColorStop(1, 'rgba(255,190,40,0.6)');
    x.fillStyle = gr;
    x.beginPath();
    x.moveTo(32, 0); x.lineTo(38, 26); x.lineTo(64, 32); x.lineTo(38, 38);
    x.lineTo(32, 64); x.lineTo(26, 38); x.lineTo(0, 32); x.lineTo(26, 26);
    x.closePath();
    x.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const SPARKS = 6;

  const carts = items.map((p, i) => {
    const g = new THREE.Group();
    const gold = isAbout(p);
    // Hakkımda: altın gövde (diğerleri koyu gri)
    const mat = toon(gold ? '#e0aa3e' : '#33363b');
    const shell = outline(new THREE.Mesh(shellGeo, mat), 0.02);
    shell.castShadow = true;
    g.add(shell);
    const lab = canvasTex(340, 380);
    const artCanvas = drawLabel(lab.ctx, 340, 380, p, images[i], logos[i]);
    lab.tex.needsUpdate = true;
    const label = new THREE.Mesh(labelGeo, new THREE.MeshBasicMaterial({ map: lab.tex }));
    label.position.set(0, CH * 0.11, CT / 2 + 0.002);
    g.add(label);
    // alt kenar (yuvaya giren uç) projenin renginde: havadayken de yuvadaki şeritle aynı renk
    const cap = new THREE.Mesh(new THREE.BoxGeometry(CW - 0.05, 0.016, CT - 0.012), new THREE.MeshBasicMaterial({ color: p.color }));
    cap.position.y = -CH / 2 + 0.006;
    g.add(cap);
    for (let k = 0; k < 4; k++) {
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(CW * 0.78, 0.014, 0.01), new THREE.MeshBasicMaterial({ color: gold ? '#8a5d10' : '#1d1f22' }));
      ridge.position.set(0, -CH * 0.33 - k * 0.04, CT / 2 + 0.002);
      g.add(ridge);
    }
    let sparks = null;
    if (gold) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
      sparks = new THREE.Points(geo, new THREE.PointsMaterial({ map: starTex, size: 0.34, transparent: true, depthWrite: false }));
      sparks.raycast = () => {};
      g.add(sparks);
    }
    g.traverse((o) => (o.userData.cartIndex = i));
    g.userData = { p: { ...p, i }, i, mat, artCanvas, sparks, home: new THREE.Vector3(), homeQ: new THREE.Quaternion(), state: 'home', hover: 0 };
    scene.add(g);
    return g;
  });

  // ---------- Yerleşim ----------
  const N = items.length;
  // Hakkımda kartuşu biraz daha büyük durur
  const homeS = (u) => HOME_S * (isAbout(u.p) ? 1.12 : 1);
  // Sahnedeki kartuş boyutu; karakterin boyuna göre layout'ta hesaplanır
  let HOME_S = 0.72;
  // Kartuşların karakterin merkezine göre yerleri, karakterin ekrandaki boyu cinsinden
  // (x sağa, y aşağı). Sıra: sol üst, sağ üst, sol alt, sağ alt, sol orta, sağ en üst
  // Hakkımda kartuşu: tam BMO'nun ortasının üstünde, başının biraz yukarısında
  const ABOUT_AT = [0, -0.92];
  // dar ekran ızgarası (ekran oranı cinsinden): 3 sütun, satır aralığı, kartuş boyu
  const GRID_X = [0.2, 0.5, 0.8];
  const GRID_Y0 = 0.17;
  const GRID_DY = 0.195;
  const GRID_H = 0.165;
  // Hakkımda (son öğe) üst ortada; projeler kalan hücrelere soldan sağa, yukarıdan aşağı
  function gridCell(i) {
    const aboutI = items.length - 1;
    if (i === aboutI) return [1, 0];
    const cells = [];
    for (let k = 0; cells.length < items.length - 1; k++) if (k !== 1) cells.push(k);
    const c = cells[i];
    return [c % 3, Math.floor(c / 3)];
  }
  const AROUND = [
    [-0.74, -0.48],
    [0.96, -0.28],
    [-0.74, 0.52],
    [1.14, 0.38],
    [-1.27, 0.07],
    [1.35, -0.75],
  ];
  let portrait = false;
  const ray = new THREE.Raycaster();
  const tmpV = new THREE.Vector3();
  const plane = new THREE.Plane();
  function spotToWorld(nx, ny, z, out) {
    ray.setFromCamera(new THREE.Vector2(nx * 2 - 1, -(ny * 2 - 1)), camera);
    plane.set(new THREE.Vector3(0, 0, 1), -z);
    return ray.ray.intersectPlane(plane, out) || out.set(0, 1, z);
  }
  // Arka plan resmi varken karakteri resimdeki zemine oturt (data.js > adventure.characterSpot).
  // Nokta resmin kendi oranlarıyla verilir; object-fit: cover kırpması hesaba katılır.
  const bgImg = el.wrap.querySelector('.adv-bg');
  const CHAR_TOP = BOTTOM + H;
  const ndcA = new THREE.Vector3();
  const ndcB = new THREE.Vector3();
  function placeOnBackground(w, h) {
    const spot = adventure.characterSpot;
    if (!spot || !bgImg?.naturalWidth) return;
    const iw = bgImg.naturalWidth;
    const ih = bgImg.naturalHeight;
    const k = Math.max(w / iw, h / ih);
    const sx = (spot.x * iw * k + (w - iw * k) / 2) / w;
    const sy = (spot.y * ih * k + (h - ih * k) / 2) / h;
    ray.setFromCamera(new THREE.Vector2(sx * 2 - 1, -(sy * 2 - 1)), camera);
    plane.set(new THREE.Vector3(0, 1, 0), 0);
    if (!ray.ray.intersectPlane(plane, tmpV)) return;
    bmo.position.set(tmpV.x, 0, tmpV.z);
    // ekrandaki yüksekliği resimdeki kutuya eşitle
    ndcA.copy(tmpV).project(camera);
    ndcB.copy(tmpV).setY(CHAR_TOP).project(camera);
    const now = (ndcB.y - ndcA.y) / 2;
    const want = (spot.h * ih * k) / h;
    if (now > 0) bmo.scale.setScalar(want / now);
  }
  bgImg?.addEventListener('load', () => layout());

  function layout() {
    const w = el.wrap.clientWidth;
    const h = el.wrap.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    portrait = aspect < 1.2;
    camera.aspect = aspect;
    camera.fov = portrait ? 40 : 30;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Geniş ekran: BMO yüksekliğin ~%30'u. Dar ekran: BMO + kartuş yayı sığsın.
    camDist = portrait ? Math.max(11, 2.9 / (tanH * aspect)) : 13.6;
    camTarget.set(0, portrait ? 1.95 : 1.3, 0);
    camera.updateProjectionMatrix();
    // kartuş yerlerini hesaplamak için kamerayı temel pozisyona koy
    camera.position.copy(camDir).multiplyScalar(camDist).add(camTarget);
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
    placeOnBackground(w, h);
    // karakterin ekrandaki merkezi ve boyu: kartuşlar bunun etrafına dizilir
    if (portrait) {
      // kartuş boyu ekran yüksekliğinin GRID_H'i kadar olsun
      const top = spotToWorld(0.5, 0.2, 0.5, new THREE.Vector3());
      const bot = spotToWorld(0.5, 0.2 + GRID_H, 0.5, new THREE.Vector3());
      HOME_S = Math.abs(top.y - bot.y) / CH / 1.12;
    }
    let ring = null;
    if (!portrait) {
      const bs = bmo.scale.x;
      ndcA.copy(bmo.position).project(camera);
      ndcB.copy(bmo.position).setY(CHAR_TOP * bs).project(camera);
      const hs = (ndcB.y - ndcA.y) / 2; // ekran yüksekliğine oranla boy
      const cy = 0.5 - (ndcA.y + ndcB.y) / 4;
      const cx = (ndcA.x + 1) / 2;
      // en alttaki kartuş diyalog kutusuna girecekse bütün grubu birlikte yukarı kaydır
      const used = [...AROUND.slice(0, Math.min(projects.length, AROUND.length)), ABOUT_AT];
      const maxOy = Math.max(...used.map(([, oy]) => oy));
      const minOy = Math.min(...used.map(([, oy]) => oy));
      const lift = Math.max(0, cy + maxOy * hs - 0.68);
      const gy = Math.max(cy - lift, 0.12 - minOy * hs);
      ring = { cx, cy: gy, hs, z: bmo.position.z + 0.2 };
      // kartuşun boyu karakterin boyunun ~%55'i
      HOME_S = (0.55 * CHAR_TOP * bs) / CH;
    }
    carts.forEach((c, i) => {
      const u = c.userData;
      if (portrait) {
        // dar ekran: 3 sütunlu ızgara, okunur boyutta; Hakkımda üst sıranın ortasında
        const [col, row] = gridCell(i);
        spotToWorld(GRID_X[col], GRID_Y0 + row * GRID_DY, 0.5, u.home);
      } else if (ring) {
        // karakterin etrafında, üst tarafta yay şeklinde (alttaki diyalog kutusuna girmesin)
        const [ox, oy] = isAbout(u.p) ? ABOUT_AT : AROUND[i % AROUND.length];
        const nx = clamp(ring.cx + (ox * ring.hs * h) / w, 0.06, 0.94);
        const ny = clamp(ring.cy + oy * ring.hs, 0.1, 0.7);
        spotToWorld(nx, ny, ring.z, u.home);
      } else {
        const [nx, ny] = WIDE_SPOTS[i % WIDE_SPOTS.length];
        spotToWorld(nx, ny, ny > 0.5 ? 0.9 : 0.3, u.home);
      }
      // kameraya dönük, hafif eğik
      const m = new THREE.Matrix4().lookAt(camera.position, u.home, new THREE.Vector3(0, 1, 0));
      u.homeQ.setFromRotationMatrix(m);
      u.homeQ.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (u.home.x > 0 ? -1 : 1) * 0.12, (u.home.x > 0 ? 1 : -1) * 0.03)));
      if (u.state === 'home') {
        c.position.copy(u.home);
        c.quaternion.copy(u.homeQ);
      }
    });
  }
  const ro = new ResizeObserver(layout);
  ro.observe(el.wrap);
  layout();

  // ---------- Tween ----------
  const tweens = [];
  const tween = (dur, fn, e = ease.inOut) => new Promise((res) => tweens.push({ t: 0, dur, fn, e, res }));
  const wait = (s) => tween(s, () => {});

  // ---------- Diyalog ----------
  const touch = matchMedia('(hover: none)').matches;
  let typing = 0;
  let fullText = '';
  function say(text) {
    clearInterval(typing);
    fullText = text;
    el.live.textContent = text;
    el.text.textContent = '';
    faceState.talking = true;
    let i = 0;
    let blip = 0;
    typing = setInterval(() => {
      i++;
      el.text.textContent = text.slice(0, i);
      // yazı sesi: her 3 harfte bir, boşluk ve noktalamada susar
      if (/[\p{L}\p{N}]/u.test(text[i - 1]) && i % 3 === 0) sfx.talk(blip++);
      if (i >= text.length) {
        clearInterval(typing);
        faceState.talking = false;
      }
    }, 28);
  }
  el.dialog.addEventListener('click', () => {
    if (intro) playIntro();
    clearInterval(typing);
    el.text.textContent = fullText;
    faceState.talking = false;
  });
  el.hint.innerHTML = touch
    ? 'Bir kartuşa dokun.'
    : '<kbd>←</kbd> <kbd>→</kbd> seç, <kbd>Enter</kbd> tak, <kbd>B</kbd> çıkar';

  // ---------- Etkileşim ----------
  let selected = 0;
  let hovered = -1;
  let inserted = null;
  let busy = false;
  let tvOpen = false;
  let lookOverrideUntil = 0;

  const setMood = (m, sec) => {
    faceState.mood = m;
    faceState.moodUntil = sec ? clock.elapsedTime + sec : Infinity;
  };

  async function hop(h = 0.25) {
    await tween(0.36, (k) => {
      bmoBody.position.y = Math.sin(k * Math.PI) * h;
      bmoBody.scale.set(1 + Math.sin(k * Math.PI * 2) * 0.03, 1 - Math.sin(k * Math.PI * 2) * 0.04, 1);
    }, (k) => k);
    bmoBody.position.y = 0;
    bmoBody.scale.set(1, 1, 1);
  }

  // örnek değerler (data.js'te doldurulmamışsa) sitede gösterilmez
  const realEmail = profile.email && !/ornek|example/.test(profile.email);
  const realLinkedin = profile.linkedin && !/linkedin\.com\/?$/.test(profile.linkedin);
  // yetenekler: RPG envanteri. Her teknoloji bir eşya yuvası; seviyeye göre nadirlik çerçevesi,
  // üstüne gelince alttaki satır o eşyanın bilgisini (seviye, nadirlik, grup, XP) gösterir
  const TECH = {
    Flutter: ['Fl', '#54C5F8', '#0b3b5c'], Firebase: ['Fb', '#FFCA28', '#5a3a00'],
    React: ['Re', '#61DAFB', '#0b2f3d'], 'Next.js': ['Nx', '#f4f4f4', '#111'], 'Three.js': ['3D', '#e9e9e9', '#1b1b1b'],
    Python: ['Py', '#3776AB', '#ffd43b'], FastAPI: ['Fa', '#05998B', '#e8fffb'], 'Node.js': ['No', '#5FA04E', '#0f2a0a'], PostgreSQL: ['Pg', '#336791', '#e8f1fb'],
  };
  const rarity = (lv) => (lv >= 8 ? ['legend', 'Efsanevi'] : lv >= 7 ? ['epic', 'Destansı'] : lv >= 6 ? ['rare', 'Nadir'] : ['common', 'Sıradan']);
  const skillList = () => profile.skills.flatMap(([group, list]) =>
    list.split('·').map((t) => t.trim()).map((tech) => ({ tech, group, lv: profile.levels?.[tech] ?? 5 })));
  function skillBars() {
    // her eşya kartı her şeyi gösterir: rozet, ad, nadirlik, seviye, XP; üstüne gelmek gerekmez
    const items = skillList().map(({ tech, lv }, i) => {
      const [ab, bg, fg] = TECH[tech] || [tech.slice(0, 2), '#7ead9c', '#173327'];
      const [cls, name] = rarity(lv);
      const xp = Array.from({ length: 10 }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
      return `<div class="tv-item r-${cls}" style="--d:${(i * 0.05).toFixed(2)}s"><span class="tv-ico" style="--bg:${bg};--fg:${fg}">${esc(ab)}</span><span class="tv-it"><strong>${esc(tech)}</strong><small>${name} · Sv.${lv}</small><span class="tv-xp" aria-label="${lv}/10">${xp}</span></span></div>`;
    }).join('');
    return `<div class="tv-skills"><p class="tv-inv-h">Envanter</p><div class="tv-items">${items}</div></div>`;
  }

  function openTv(p) {
    const me = isAbout(p);
    el.tv.dataset.kind = me ? 'about' : 'project';
    el.tv.querySelector('.tv-shot').innerHTML = cover(p, true);
    el.tv.querySelector('.tv-title').textContent = me ? profile.fullName || profile.name : p.name;
    el.tv.querySelector('.tv-desc').textContent = me ? `${profile.tagline} ${profile.about}` : p.desc;
    // iletişim linkleri (yalnız Hakkımda'da): okul etiketinin hemen yanında
    const links = me
      ? [realEmail && [`mailto:${profile.email}`, 'E-posta', '✉'], realLinkedin && [profile.linkedin, 'LinkedIn', 'in']].filter(Boolean)
      : [];
    const linkChips = links.map(([href, t, ic]) => `<a class="tv-chip-link" href="${esc(href)}" target="_blank" rel="noopener"><i aria-hidden="true">${ic}</i>${esc(t)}</a>`).join('');
    el.tv.querySelector('.tv-chips').innerHTML = me
      ? `<span class="tv-chip-note">${esc(profile.note)}</span>${linkChips}${skillBars()}`
      : [...p.platforms, p.stack].map((s) => `<span>${esc(s)}</span>`).join('');
    const lk = el.tv.querySelector('.tv-links');
    lk.innerHTML = '';
    lk.hidden = true;
    if (me) p = { ...p, link: profile.github, linkLabel: 'GitHub' };
    const a = el.tv.querySelector('.tv-a');
    if (p.link) {
      a.href = p.link;
      a.removeAttribute('aria-disabled');
      el.tv.querySelector('.tv-a-label').textContent = p.linkLabel || 'Aç';
    } else {
      a.removeAttribute('href');
      a.setAttribute('aria-disabled', 'true');
      el.tv.querySelector('.tv-a-label').textContent = p.linkLabel || 'Yakında';
    }
    el.tv.hidden = false;
    el.tv.scrollTop = 0;
    el.wrap.dataset.tv = 'true';
    tvOpen = true;
    // açılış ekranının (ikon + isim) üstünde netleşerek belirir; çıkarmanın tam tersi
    el.tv.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 620, easing: 'ease-in-out', fill: 'forwards' });
    // yerinden oynamadan, sadece bulanıktan netleşerek belirir (kayma yok)
    el.tv.querySelector('.tv-inner').animate(
      [{ filter: 'blur(6px)' }, { filter: 'blur(0)' }],
      { duration: 560, easing: 'ease-out', fill: 'backwards' }
    );
    // görsel, başlık, açıklama, etiketler sırayla belirir
    [...el.tv.querySelectorAll('.tv-shot, .tv-title, .tv-desc, .tv-chips, .tv-links')].forEach((n, idx) =>
      n.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 100 + idx * 80, easing: 'ease-out', fill: 'backwards' })
    );
    el.tv.querySelector('.tv-actions').animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: 420, easing: 'ease-out', fill: 'backwards' });
    el.tv.querySelector('.tv-b').focus({ preventScroll: true });
  }

  async function closeTv() {
    if (!tvOpen) return;
    tvOpen = false;
    // içerik hafif küçülüp bulanıklaşarak silinir, arkadaki açılış ekranı ortaya çıkar
    el.tv.querySelector('.tv-inner').animate(
      [{ transform: 'scale(1)', filter: 'blur(0)' }, { transform: 'scale(0.96)', filter: 'blur(6px)' }],
      { duration: 560, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }
    );
    await el.tv.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 620, easing: 'ease-in-out', fill: 'forwards' }).finished;
    el.tv.querySelector('.tv-inner').getAnimations().forEach((a) => a.cancel());
    el.tv.hidden = true;
    el.wrap.dataset.tv = 'false';
  }

  // Yuvanın dünya koordinatları: ağız (giriş) ve içerisi
  const slotMouth = new THREE.Vector3();
  // kartuşun oturduğu yer: arka ucu yuvanın ağzıyla aynı hizada, renkli şerit tam buradan devralır
  const slotSeat = new THREE.Vector3();
  const slotFront = new THREE.Vector3();
  const FLAT_Q = new THREE.Quaternion();
  // Yuvanın yerel genişliği; kartuş buna göre küçülür ki iki yandan taşmasın
  let INSERT_SCALE = 0.78;
  function slotPoints() {
    bmo.updateMatrixWorld(true);
    // karakter sahneye göre ölçeklenebiliyor: kartuşun dünya genişliği yuvanın gerçek genişliğinin %88'i olsun
    const bs = bmo.scale.x;
    INSERT_SCALE = (SLOT_W * 0.88 * bs) / CW;
    // kartuş yatayken uzunluğu z ekseninde CH*INSERT_SCALE (dünya); front'un yerel birimine çevir
    const half = (CH * INSERT_SCALE) / 2 / bs;
    front.localToWorld(slotMouth.set(SLOT_X, SLOT_Y, half + 0.01));
    front.localToWorld(slotFront.set(SLOT_X + 0.25, SLOT_Y + 0.32, half + 0.75));
    front.localToWorld(slotSeat.set(SLOT_X, SLOT_Y, -half + 0.009));
    // etiket yukarı bakacak şekilde yatır, üst kenar BMO'ya dönük
    const bq = new THREE.Quaternion();
    bmo.getWorldQuaternion(bq);
    FLAT_Q.copy(bq).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)));
  }

  // nesnenin ekrandaki yatay konumuna göre ses yönü (-0.75 sol … 0.75 sağ)
  const panV = new THREE.Vector3();
  const panOf = (v) => clamp(panV.copy(v).project(camera).x * 0.6, -0.75, 0.75);

  async function insert(i) {
    if (busy || tvOpen || inserted === i) return;
    busy = true;
    sfx.unlock();
    selected = i;
    const c = carts[i];
    const u = c.userData;
    u.state = 'flying';
    lookOverrideUntil = 0;
    // yüz ifadesi tıklandığı anda değişir, kartuş girene kadar öyle kalır
    setMood('o');
    // BMO düz baksın ki kartuş yuvaya tam otursun
    await tween(0.2, (k) => { bmo.rotation.y = lerp(bmo.rotation.y, BASE_YAW, k); }, ease.soft);
    slotPoints();
    sfx.fly((0.95 + 0.3) * 1000, panOf(c.position), panOf(slotMouth));
    const p0 = c.position.clone();
    const q0 = c.quaternion.clone();
    const s0 = c.scale.x;
    const p = u.p;
    say(isAbout(p) ? `Ooh, ${profile.name}'in kendi kartuşu!` : `Ooh, ${p.name}!`);
    // 1) kalk, dönerek yatay hale gel ve yuvanın önüne gel
    await tween(0.95, (k) => {
      c.position.lerpVectors(p0, slotFront, k);
      c.position.y += Math.sin(k * Math.PI) * 0.2;
      c.quaternion.slerpQuaternions(q0, FLAT_Q, ease.soft(Math.min(1, k * 1.1)));
      c.scale.setScalar(lerp(s0, INSERT_SCALE, k));
    }, ease.soft);
    // 2) yuvanın ağzına hizalan
    const p1 = c.position.clone();
    await tween(0.3, (k) => { c.position.lerpVectors(p1, slotMouth, k); }, ease.soft);
    // 3) tamamen içeri kay (sürtünme sesiyle); yuvada sadece projenin renginde ince bir şerit görünür
    sfx.slideIn(600, panOf(slotMouth));
    await tween(0.6, (k) => { c.position.lerpVectors(slotMouth, slotSeat, k); }, ease.settle);
    c.visible = false;
    slotFill.material.color.set(p.color);
    slotFill.visible = true;
    u.state = 'in';
    inserted = i;
    // 4) takıldığı an ekranda direkt projenin açılış ekranı (ikon + isim) belirir
    // açılış: ekran beyaz parlar, ikon büyüyerek çıkar, isim harf harf yazılır
    faceState.bootP = p;
    Object.assign(faceState, { screen: 'boot', bootFlash: 1, bootPop: 0, bootChars: 0 });
    sfx.boot();
    await tween(0.16, (k) => { faceState.bootFlash = 1 - k; }, (k) => k);
    const name = p.name.toLocaleUpperCase('tr');
    await Promise.all([
      tween(0.34, (k) => { faceState.bootPop = k; }, ease.out),
      tween(name.length * 0.055, (k) => {
        const n = Math.round(k * name.length);
        if (n > faceState.bootChars) sfx.type(n - 1);
        faceState.bootChars = n;
      }, (k) => k),
    ]);
    sfx.ready();
    await wait(0.4);
    // 5) diyalog kaybolur, oda kararırken kamera ekrana dalar
    el.wrap.dataset.dialog = 'off';
    await wait(0.25);
    // zoom bitmeden detay sayfası açılış ekranının üstünde erimeye başlar
    sfx.zoomIn(1.3);
    await tween(1.3, (k) => { zoom = k; }, ease.inOut);
    // kamera tamamen durunca detay sayfası açılış ekranının üstünde erir
    openTv(p);
    sfx.jingle();
    busy = false;
  }

  async function eject() {
    if (inserted == null || busy) return;
    busy = true;
    const i = inserted;
    const c = carts[i];
    const u = c.userData;
    // 1) detay sayfası açılış ekranına geri erir
    faceState.screen = 'boot';
    await closeTv();
    // 2) diyalog geri gelir, kamera açılış ekranı görünürken geri çekilir, oda aydınlanır
    el.wrap.dataset.dialog = 'on';
    say('Geri gidiyor.');
    sfx.zoomOut(1.4);
    await tween(1.4, (k) => { zoom = 1 - k; }, ease.inOut);
    await wait(0.3);
    // 3) kartuş yuvadan fırlar, ekran yüze döner
    faceState.screen = 'face';
    setMood('happy', 0.8);
    inserted = null;
    slotFill.visible = false;
    slotPoints();
    c.position.copy(slotSeat);
    c.quaternion.copy(FLAT_Q);
    c.scale.setScalar(INSERT_SCALE);
    c.visible = true;
    u.state = 'flying';
    sfx.pop(panOf(slotMouth));
    await tween(0.45, (k) => { c.position.lerpVectors(slotSeat, slotMouth, k); }, ease.soft);
    // 4) yumuşak bir kavisle rafa uçuş
    sfx.fly(950, panOf(slotMouth), panOf(u.home));
    const p1 = c.position.clone();
    await tween(0.95, (k) => {
      c.position.lerpVectors(p1, u.home, k);
      c.position.y += Math.sin(k * Math.PI) * 0.3;
      c.quaternion.slerpQuaternions(FLAT_Q, u.homeQ, ease.soft(Math.min(1, k * 1.1)));
      c.scale.setScalar(lerp(INSERT_SCALE, homeS(u), k));
    }, ease.soft);
    u.state = 'home';
    busy = false;
    say('Tamamdır! Başka bir kartuş seç.');
  }

  function openLink() {
    const a = el.tv.querySelector('.tv-a');
    if (a.href) {
      sfx.ready();
      a.click();
    } else {
      sfx.deny();
      a.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 260 });
    }
  }

  root.querySelectorAll('.cart-a11y').forEach((b) => {
    const i = Number(b.dataset.i);
    b.addEventListener('click', () => insert(i));
    b.addEventListener('focus', () => { selected = i; lookOverrideUntil = clock.elapsedTime + 2; });
  });
  el.tv.querySelector('.tv-b').addEventListener('click', () => eject());
  el.tv.querySelector('.tv-a').addEventListener('click', (e) => {
    if (!e.currentTarget.href) {
      e.preventDefault();
      openLink();
    }
  });

  function poke() {
    sfx.unlock();
    sfx.mood('happy', panOf(bmo.position));
    setMood('happy', 1.2);
    hop(0.3);
    say(POKES[Math.floor(Math.random() * POKES.length)]);
  }

  // Fare: kartuş / BMO isabeti
  const ndc = new THREE.Vector2(9, 9);
  const bmoTargets = [body, screen, ...front.children];
  const cartTargets = carts.flatMap((c) => c.children);
  function pick() {
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...cartTargets, ...bmoTargets], false)[0];
    if (!hit) return null;
    const ci = hit.object.userData.cartIndex;
    if (ci !== undefined) return carts[ci].userData.state === 'home' ? { type: 'cart', i: ci } : null;
    if (hit.object.userData.button) return { type: 'button', name: hit.object.userData.button };
    return { type: 'bmo' };
  }

  // Tuşa basınca gömülür (tık + tok ses), bırakınca geri çıkar; bırakınca BMO tepki verir
  let pressed = null;
  function pressButton(name, down) {
    // önden bakınca gömülme az görünür; o yüzden basılıyken biraz küçülür ve koyulaşır
    for (const m of buttons[name]) {
      const z0 = m.position.z;
      const s0 = m.scale.x;
      const e0 = m.material.emissiveIntensity;
      const z1 = 0.018 - (down ? 0.014 : 0);
      const s1 = K * (down ? 0.92 : 1);
      const e1 = down ? 0.15 : 1;
      tween(down ? 0.07 : 0.16, (k) => {
        m.position.z = lerp(z0, z1, k);
        m.scale.setScalar(lerp(s0, s1, k));
        m.material.emissiveIntensity = lerp(e0, e1, k);
      }, ease.out);
    }
  }
  el.canvas.addEventListener('pointerdown', (e) => {
    if (tvOpen || busy) return;
    const r = el.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const h = pick();
    if (h?.type !== 'button') return;
    sfx.unlock();
    pressed = h.name;
    pressButton(pressed, true);
    sfx.press(pressed, panOf(buttons[pressed][0].getWorldPosition(new THREE.Vector3())));
  });
  const onPointerUp = (e) => {
    if (!pressed) return;
    const name = pressed;
    pressed = null;
    pressButton(name, false);
    const pan = panOf(buttons[name][0].getWorldPosition(new THREE.Vector3()));
    sfx.release(name, pan);
    // aynı tuşun üstünde bırakıldıysa: yeşil ve üçgen şaşırtır, diğerleri sevindirir
    const r = el.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (pick()?.name !== name || faceState.screen !== 'face' || tvOpen || busy) return;
    const kind = name === 'b' || name === 'triangle' ? 'surprised' : 'happy';
    setMood(kind === 'surprised' ? 'whoa' : 'happy', kind === 'surprised' ? 0.9 : 1);
    sfx.mood(kind, pan);
  };
  window.addEventListener('pointerup', onPointerUp);
  // fare hızı ve son hareket zamanı: yüz ifadesi için
  const ptr = { x: 0, y: 0, at: 0, speed: 0, lastMove: 0, overBmo: false, whoaUntil: 0 };
  el.canvas.addEventListener('pointermove', (e) => {
    const r = el.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const now = clock.elapsedTime;
    const dtm = Math.max(now - ptr.at, 0.001);
    const v = Math.hypot(e.clientX - ptr.x, e.clientY - ptr.y) / dtm;
    ptr.speed = ptr.speed * 0.8 + Math.min(v, 20000) * 0.2;
    // uyurken dürtülürse irkilir; çok hızlı sallanırsa şaşırır
    if (faceState.react === 'sleepy' || ptr.speed > 4000) ptr.whoaUntil = now + 0.7;
    Object.assign(ptr, { x: e.clientX, y: e.clientY, at: now, lastMove: now });
    if (tvOpen || busy) {
      ptr.overBmo = false;
      hovered = -1;
      el.canvas.style.cursor = 'default';
      return;
    }
    const h = pick();
    ptr.overBmo = h?.type === 'bmo';
    const hi = h?.type === 'cart' ? h.i : -1;
    if (hi !== hovered && hi >= 0) {
      selected = hi;
      sfx.hover(noteIndex(hi), panOf(carts[hi].position));
      announce(hi);
    }
    hovered = hi;
    el.canvas.style.cursor = h ? 'pointer' : 'default';
  });
  // dokunmatik ekranda dokunuş da "hareket" sayılır (yoksa BMO hep uyur)
  el.canvas.addEventListener('pointerdown', () => {
    if (faceState.react === 'sleepy') ptr.whoaUntil = clock.elapsedTime + 0.7;
    ptr.lastMove = clock.elapsedTime;
  });
  el.canvas.addEventListener('pointerleave', () => {
    ndc.set(9, 9);
    ptr.overBmo = false;
    hovered = -1;
  });
  el.canvas.addEventListener('click', (e) => {
    if (intro) return playIntro();
    if (tvOpen || busy) return;
    const r = el.canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const h = pick();
    if (h?.type === 'cart') insert(h.i);
    else if (h?.type === 'bmo') poke();
    // tuşlar pointerdown/pointerup ile ayrıca işleniyor
  });

  // Kartuşun üstüne gelince / ok tuşuyla seçince BMO onun adını söyler
  function announce(i) {
    const p = carts[i].userData.p;
    const line = isAbout(p) ? `Bu ${profile.name}'in kendi kartuşu! Onunla tanışmak ister misin?` : `${p.name}! Oynamak ister misin?`;
    if (line !== fullText) say(line);
  }

  // Kartuşun ekranda soldan sağa kaçıncı olduğu: soldaki do, sağa doğru re, mi, fa...
  function noteIndex(i) {
    return carts.map((c, j) => j).sort((a, b) => carts[a].userData.home.x - carts[b].userData.home.x).indexOf(i);
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (intro) {
      if (k === 'escape') {
        e.preventDefault();
        endIntro();
      } else if ((k === 'enter' || k === ' ') && !e.target.closest?.('button, a')) {
        e.preventDefault();
        playIntro();
      }
      return;
    }
    if (tvOpen) {
      if (k === 'b' || k === 'escape' || k === 'backspace') {
        e.preventDefault();
        eject();
      } else if (k === 'a' || (k === 'enter' && !e.target.closest?.('button, a'))) {
        e.preventDefault();
        openLink();
      }
      return;
    }
    if (e.target.closest?.('.adv-corner')) return;
    if (k === 'arrowright' || k === 'arrowleft') {
      // ekrandaki soldan sağa sıraya göre gez
      const order = carts.map((c, i) => i).sort((a, b) => carts[a].userData.home.x - carts[b].userData.home.x);
      const pos = order.indexOf(selected);
      selected = order[(pos + (k === 'arrowright' ? 1 : -1) + N) % N];
      lookOverrideUntil = clock.elapsedTime + 2.5;
      sfx.hover(noteIndex(selected), panOf(carts[selected].position));
      announce(selected);
      e.preventDefault();
    } else if (k === 'enter' || k === ' ') {
      if (e.target.closest?.('button, a')) return;
      insert(selected);
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', onKey);

  // Köşe butonları
  const soundIcon = (on) =>
    `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h3l4-3v10L5 10H2z" fill="currentColor"/>${on ? '<path d="M11 5.5q1.6 2.5 0 5M12.8 3.5q3 4.5 0 9" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="square"/>' : '<path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.4"/>'}</svg>`;
  const paintSound = () => {
    el.sound.innerHTML = soundIcon(sfx.enabled);
    el.sound.setAttribute('aria-pressed', String(sfx.enabled));
    el.sound.title = sfx.enabled ? 'Ses açık' : 'Ses kapalı';
  };
  paintSound();
  el.sound.addEventListener('click', () => {
    // kapatırken önce "kapandı" sesi çalsın, sonra sus
    if (sfx.enabled) {
      sfx.off();
      sfx.enabled = false;
    } else {
      sfx.enabled = true;
      sfx.on();
    }
    paintSound();
  });

  // ---------- Açılış: pil değiştirme ----------
  // Dizideki sahne: BMO'nun pili bitmiş. Sırtını dönüp yeni pilleri arkasına dizer, sırtındaki
  // kapağı açıp eski pilleri çıkarır (o an kapanır), sırtüstü yenilerin üstüne düşer; yeniler
  // tam yuvaya oturur, BMO kalkıp döner ve açılır.
  // Ziyaretçi ekrana tıklayınca başlar (tarayıcı ses için bir dokunuş ister). Oturumda bir kez oynar.
  const INTRO_KEY = 'intro-seen';
  const HINT = el.hint.innerHTML;
  let intro = null; // { phase: 'wait' | 'play' }
  const startV = new THREE.Vector3();
  // sırtüstü yatma: gövdenin arka-alt kenarı etrafında 90°
  const TILT = Math.PI / 2;
  const tiltPivot = new THREE.Vector3(0, BOTTOM, -D / 2 + 0.04);
  function setTilt(a) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    bmoBody.rotation.x = -a;
    bmoBody.position.set(0, tiltPivot.y - (tiltPivot.y * c + tiltPivot.z * s), tiltPivot.z - (-tiltPivot.y * s + tiltPivot.z * c));
  }
  // BMO dönüp sırtüstü düşünce kapağın yere değdiği nokta (bmo yerel, dönüş sonrası): yeni piller tam buraya dizilir
  const SEAT_Z = -(tiltPivot.z - (HATCH_Y - BOTTOM));
  const BAT_X = [0.09, -0.09];
  // atlanırsa yarım kalan animasyonlar bir şey değiştirmesin
  const itw = (dur, fn, e) => tween(dur, (k) => intro && fn(k), e);
  const alive = () => intro?.phase === 'play';
  // yeni piller BMO'nun yanında yerde yatar; sol taraf ekrandan taşıyorsa (dar ekran) sağ yanında
  let batSide = -1;
  function placeBats() {
    bmo.updateMatrixWorld(true);
    batSide = bmo.localToWorld(startV.set(-1.6, 0, SEAT_Z)).project(camera).x < -0.95 ? 1 : -1;
    newBats.forEach((b, j) => {
      b.position.set(batSide * (1.05 + j * 0.4), BAT_R, SEAT_Z);
      b.rotation.set(0, 0, j * 0.7);
    });
  }

  function greet() {
    setMood('happy', 1.5);
    arms[1].wave = 1.8;
    say(`Selam! Ben BMO. ${profile.name}'in neler oynadığını görmek ister misin? Bir kartuş seç!`);
  }

  function setupIntro() {
    intro = { phase: 'wait' };
    busy = true;
    el.wrap.dataset.intro = 'dark';
    Object.assign(faceState, { screen: 'battery', charge: 0 });
    oldBats.forEach((b) => (b.visible = true));
    newBats.forEach((b) => (b.visible = true));
    placeBats();
    carts.forEach((c) => {
      c.visible = false;
      c.userData.state = 'intro';
    });
    el.skip.hidden = false;
    el.hint.innerHTML = touch ? 'Ekrana dokun.' : 'Ekranın herhangi bir yerine tıkla ya da <kbd>Enter</kbd> · <kbd>Esc</kbd> geç';
    say('Pilim bitmiş... Yanımda yeni piller var. Takmama yardım eder misin?');
    // ekranın tamamı tıklanabilir; BMO'nun üstünde yanıp sönen "tıkla" etiketi
    el.start.querySelector('.adv-start-text').textContent = touch ? 'Pilleri takmak için dokun' : 'Pilleri takmak için tıkla';
    el.start.hidden = false;
  }

  async function playIntro() {
    if (intro?.phase !== 'wait') return;
    intro.phase = 'play';
    sfx.unlock();
    el.start.hidden = true;
    el.hint.innerHTML = touch ? '' : '<kbd>Esc</kbd> geç';
    say('Tamam! Önce arkamı döneyim...');
    const pan = panOf(bmo.position);
    const door = hatch.userData.door;

    // 1) BMO yerinde dönüp sırtını gösterir
    sfx.tilt(true, pan);
    await itw(0.75, (k) => {
      bmoTurn.rotation.y = k * Math.PI;
      bmoBody.position.y = Math.sin(k * Math.PI) * 0.08;
    }, ease.soft);
    if (!alive()) return;

    // 2) yeni piller yuvarlanıp tam arkasına, düşeceği yere dizilir
    say('Yenileri arkama koyayım...');
    sfx.roll(900, pan);
    const x0 = newBats.map((b) => b.position.x);
    const r0 = newBats.map((b) => b.rotation.z);
    await itw(0.9, (k) => newBats.forEach((b, j) => {
      const e = ease.settle(clamp(k * 1.2 - j * 0.2, 0, 1));
      b.position.x = lerp(x0[j], -batSide * BAT_X[j], e);
      b.rotation.z = r0[j] - (b.position.x - x0[j]) / BAT_R;
    }), (k) => k);
    if (!alive()) return;
    sfx.clink(pan, 0.5);
    await wait(0.2);

    // 3) sırttaki kapak açılır, eski piller fırlar; pil çıkınca BMO kapanır
    say('Şimdi eskileri çıkarıyorum...');
    sfx.hatch(pan);
    await itw(0.25, (k) => { door.rotation.x = -k * 1.9; }, ease.outBack);
    if (!alive()) return;
    await wait(0.15);
    oldBats.forEach((b) => bmo.attach(b));
    faceState.screen = 'off';
    const o0 = oldBats.map((b) => b.position.clone());
    const ox = oldBats.map((b) => b.rotation.x);
    const land = [new THREE.Vector3(-1.0, BAT_R, 0.25), new THREE.Vector3(0.95, BAT_R, 0.1)];
    // önce yukarı fırlar (görünsün), sonra kavisle iki yana düşer
    const ctrl = oldBats.map((b, j) => b.position.clone().add(new THREE.Vector3(j ? 0.35 : -0.35, 1.0, 0.3)));
    const fall = itw(0.8, (k) => oldBats.forEach((b, j) => {
      const kk = clamp(k * 1.12 - j * 0.12, 0, 1);
      // ikinci derece Bezier: başlangıç → tepe → yer
      b.position.copy(o0[j]).multiplyScalar((1 - kk) ** 2)
        .addScaledVector(ctrl[j], 2 * kk * (1 - kk))
        .addScaledVector(land[j], kk * kk);
      b.rotation.x = lerp(ox[j], (j ? -3 : 3) * Math.PI, kk);
      b.rotation.y = kk * (j ? 0.9 : -0.6);
    }), (k) => k).then(async () => {
      if (!alive()) return;
      sfx.clink(pan - 0.15, 0.9);
      setTimeout(() => sfx.clink(pan + 0.1, 0.6), 90);
      // küçük sekme
      await itw(0.26, (k) => oldBats.forEach((b) => { b.position.y = BAT_R + Math.sin(k * Math.PI) * 0.07; }), (k) => k);
      if (alive()) sfx.clink(pan, 0.35);
    });

    // 4) kapanan BMO sırtüstü yenilerin üstüne düşer; piller tam yuvaya oturur
    const seat = (async () => {
      await wait(0.35);
      if (!alive()) return;
      sfx.tilt(false, pan);
      await itw(0.5, (k) => setTilt(TILT * k), ease.in);
      if (!alive()) return;
      // piller artık gövdenin içinde; kapak kapanır (altta kaldığı için görünmez)
      newBats.forEach((b) => (b.visible = false));
      door.rotation.x = 0;
      sfx.thud(pan);
      sfx.snap(pan - 0.05);
      setTimeout(() => sfx.snap(pan + 0.05), 80);
      // yere çarpınca hafif sekip toparlanır
      await itw(0.3, (k) => setTilt(TILT - Math.sin(k * Math.PI) * (1 - k) * 0.08), (k) => k);
      setTilt(TILT);
    })();
    await Promise.all([fall, seat]);
    if (!alive()) return;
    await wait(0.35);
    if (!alive()) return;

    // 5) BMO açılır: doğrulur ve önünü döner
    Object.assign(faceState, { screen: 'battery', charge: 0 });
    say('Bip bip... şarj oluyor...');
    sfx.tilt(true, pan);
    await itw(0.55, (k) => setTilt(TILT * (1 - k)), ease.soft);
    if (!alive()) return;
    await itw(0.65, (k) => {
      bmoTurn.rotation.y = Math.PI * (1 - k);
      bmoBody.position.y = Math.sin(k * Math.PI) * 0.08;
    }, ease.soft);
    if (!alive()) return;
    bmoBody.position.y = 0;

    // 6) pil dilim dilim dolar
    for (let i = 1; i <= 4; i++) {
      if (!alive()) return;
      faceState.charge = i / 4;
      sfx.charge(i - 1);
      await wait(0.22);
    }
    await wait(0.3);
    if (!alive()) return;

    // 7) ekran yüze döner, ışıklar yanar, eski piller kaybolur
    sfx.boot();
    faceState.screen = 'face';
    setMood('happy', 1.6);
    delete el.wrap.dataset.intro;
    setTimeout(() => sfx.ready(), 250);
    itw(0.5, (k) => oldBats.forEach((b) => b.scale.setScalar(1 - k)), ease.in);
    await wait(0.9);
    if (!alive()) return;

    // 8) kartuşlar BMO'nun ekranından soldan sağa sırayla süzülüp yerlerine geçer
    const from = screen.getWorldPosition(new THREE.Vector3());
    await Promise.all(carts.map(async (c, i) => {
      await wait(0.1 + noteIndex(i) * 0.11);
      if (!alive()) return;
      const u = c.userData;
      c.visible = true;
      sfx.hover(noteIndex(i), panOf(u.home));
      await itw(0.75, (k) => {
        c.position.lerpVectors(from, u.home, k);
        c.position.y += Math.sin(k * Math.PI) * 0.35;
        c.quaternion.copy(u.homeQ);
        c.scale.setScalar(homeS(u) * ease.outBack(k));
      }, ease.settle);
      if (intro) u.state = 'home';
    }));
    if (alive()) endIntro();
  }

  // bitiş ya da "Geç": her şey son haline
  function endIntro() {
    if (!intro) return;
    intro = null;
    try { sessionStorage.setItem(INTRO_KEY, '1'); } catch { /* yok say */ }
    el.skip.hidden = true;
    el.start.hidden = true;
    delete el.wrap.dataset.intro;
    setTilt(0);
    bmoTurn.rotation.y = 0;
    bmoBody.scale.set(1, 1, 1);
    hatch.userData.door.rotation.x = 0;
    [...oldBats, ...newBats].forEach((b) => (b.visible = false));
    faceState.screen = 'face';
    carts.forEach((c) => {
      c.visible = true;
      if (c.userData.state === 'intro') c.userData.state = 'home';
    });
    el.hint.innerHTML = HINT;
    busy = false;
    greet();
  }
  el.skip.addEventListener('click', () => endIntro());
  // normal moda geçiş (açılış sürüyorsa atlanmış sayılır)
  root.querySelector('.adv-mode')?.addEventListener('click', () => {
    if (intro) endIntro();
    onSwitch();
  });
  el.start.addEventListener('click', () => playIntro());
  // etiket BMO'nun başının hemen üstünde, ama ekrandan taşmadan; ok her zaman BMO'yu gösterir
  const startTag = el.start.querySelector('.adv-start-tag');
  function placeStart() {
    if (el.start.hidden) return;
    if (intro?.phase === 'wait') placeBats();
    bmo.localToWorld(startV.set(0, CHAR_TOP + 0.15, 0)).project(camera);
    const vw = el.wrap.clientWidth;
    const px = ((startV.x + 1) / 2) * vw;
    const half = startTag.offsetWidth / 2 + 12;
    const cx = clamp(px, half, vw - half);
    el.start.style.setProperty('--x', `${cx}px`);
    el.start.style.setProperty('--arrow', `${clamp(px - cx, -half + 24, half - 24)}px`);
    el.start.style.setProperty('--y', `${((1 - startV.y) / 2) * 100}%`);
  }

  // ---------- Döngü ----------
  const clock = new THREE.Clock();
  let raf = 0;
  const camSmooth = new THREE.Vector3();
  const normalPos = new THREE.Vector3();
  const sp = new THREE.Vector3();
  const sn = new THREE.Vector3();
  const close = new THREE.Vector3();
  const zStart = new THREE.Vector3();
  const zDir = new THREE.Vector3();
  const bobQ = new THREE.Quaternion();
  const bobE = new THREE.Euler();

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(tw.t / tw.dur, 1);
      tw.fn(tw.e(k));
      if (k >= 1) {
        tweens.splice(i, 1);
        tw.res();
      }
    }

    if (t > faceState.blinkAt + 0.13) faceState.blinkAt = t + 2 + Math.random() * 3.5;
    if (faceState.mood !== 'idle' && t > faceState.moodUntil) faceState.mood = 'idle';

    // BMO nereye bakıyor
    const focusI = hovered >= 0 ? hovered : t < lookOverrideUntil ? selected : -1;
    if (zoom > 0.01 || busy) {
      look.tx = 0;
      look.ty = 0;
    } else if (focusI >= 0) {
      tmpV.copy(carts[focusI].userData.home).project(camera);
      sp.copy(body.getWorldPosition(sn)).project(camera);
      look.tx = clamp((tmpV.x - sp.x) * 2.2, -1, 1);
      look.ty = clamp(-(tmpV.y - sp.y) * 2.2, -1, 1);
    } else if (Math.abs(ndc.x) <= 1) {
      look.tx = clamp(ndc.x * 1.3, -1, 1);
      look.ty = clamp(-ndc.y, -1, 1);
    } else {
      look.tx = Math.sin(t * 0.4) * 0.3;
      look.ty = 0;
    }
    look.x = lerp(look.x, look.tx, 1 - Math.exp(-dt * 6));
    look.y = lerp(look.y, look.ty, 1 - Math.exp(-dt * 6));
    // BMO yerinde sabit durur; fareye sadece yüzüyle tepki verir
    if (zoom > 0.01 || busy || tvOpen) faceState.react = 'none';
    else if (t < ptr.whoaUntil) faceState.react = 'whoa';
    else if (t - ptr.lastMove > 7) faceState.react = 'sleepy';
    else if (ptr.overBmo) faceState.react = 'pet';
    else if (hovered >= 0) faceState.react = 'curious';
    else faceState.react = 'none';
    if (faceState.react === 'sleepy') {
      look.tx = 0;
      look.ty = 0.3;
    }

    for (const a of arms) {
      a.wave = Math.max(0, a.wave - dt);
      const w = a.wave > 0 ? Math.min(1, a.wave * 3) : 0;
      const idle = Math.sin(t * 1.6 + a.s) * 0.04;
      a.pivot.rotation.z = a.s * (idle + w * (2.1 + Math.sin(t * 14) * 0.35));
    }

    // kartuşlar: süzülme + üzerine gelince öne çıkma
    for (const c of carts) {
      const u = c.userData;
      const isSel = (u.i === hovered || (u.i === selected && t < lookOverrideUntil)) && u.state === 'home';
      u.hover = lerp(u.hover, isSel ? 1 : 0, 1 - Math.exp(-dt * 10));
      if (isAbout(u.p)) {
        // altın kartuş kendi kendine hafifçe parlar; parıltılar etrafında döner
        u.mat.emissive.set('#ffb52e').multiplyScalar(0.12 + Math.sin(t * 2.2) * 0.06);
        const sp = u.sparks.geometry.attributes.position;
        for (let k = 0; k < SPARKS; k++) {
          const a = t * 0.7 + (k / SPARKS) * Math.PI * 2;
          sp.setXYZ(k, Math.cos(a) * (CW * 0.68), Math.sin(a * 2 + k) * 0.18 + Math.sin(a) * CH * 0.5, 0.12 + Math.sin(a) * 0.05);
        }
        sp.needsUpdate = true;
        u.sparks.material.opacity = 0.65 + Math.sin(t * 3.1) * 0.3;
      }
      if (u.state === 'home') {
        c.position.copy(u.home);
        c.position.y += Math.sin(t * 1.3 + u.i * 1.7) * 0.04;
        bobE.set(Math.sin(t * 0.9 + u.i) * 0.03, Math.sin(t * 0.7 + u.i * 2) * 0.06, 0);
        c.quaternion.copy(u.homeQ).multiply(bobQ.setFromEuler(bobE));
        // üstüne gelince renk değişmez, yerinde yumuşakça büyür
        c.scale.setScalar(homeS(u) * (1 + u.hover * 0.14));
      }
    }

    const p = dust.pos;
    for (let i = 0; i < dust.n; i++) {
      p[i * 3 + 1] += Math.sin(t * 0.5 + dust.seed[i]) * 0.0015 + 0.0012;
      p[i * 3] += Math.cos(t * 0.3 + dust.seed[i]) * 0.001;
      if (p[i * 3 + 1] > 4.2) p[i * 3 + 1] = 0.2;
    }
    dust.pts.geometry.attributes.position.needsUpdate = true;
    dust.pts.material.opacity = 0.55 + Math.sin(t * 2) * 0.15;

    lamp.rotation.z = Math.sin(t * 0.7) * 0.03;
    lampLight.position.set(lamp.position.x, lamp.position.y - 0.25, lamp.position.z);
    lampLight.intensity = 13 + Math.sin(t * 9) * 0.3 + Math.sin(t * 2.3) * 0.6;

    // Kamera sabit (fareyle kaymaz); zoom=1 iken BMO'nun ekranı tüm görüntüyü dolduruyor
    normalPos.copy(camDir).multiplyScalar(camDist).add(camTarget);
    if (camSmooth.lengthSq() === 0) camSmooth.copy(normalPos);
    camSmooth.lerp(normalPos, 1 - Math.exp(-dt * 3));
    screen.getWorldPosition(sp);
    screen.getWorldDirection(sn);
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // zoom sonunda ekranın içi tüm görüntüyü kaplar (çerçeve dışarıda kalır)
    const d = Math.min((SCREEN_H / 2) / tanH, (SCREEN_W / 2) / (tanH * camera.aspect)) * 0.96 * bmo.scale.x;
    // yumuşak yay: mevcut açıyla yaklaşmaya başlar, yolun ortasından itibaren
    // yavaşça dönüp sonunda ekranın tam karşısına gelir (sert savrulma yok)
    zStart.copy(camSmooth).sub(sp);
    const r0 = zStart.length();
    zStart.normalize();
    const turn = ease.inOut(clamp((zoom - 0.15) / 0.85, 0, 1));
    zDir.copy(zStart).lerp(sn, turn).normalize();
    camera.position.copy(zDir).multiplyScalar(lerp(r0, d, ease.inOut(zoom))).add(sp);
    lookAt.lerpVectors(camTarget, sp, ease.out(zoom));
    camera.lookAt(lookAt);

    // arka plan resmi de kamerayla birlikte karakterin ekranına doğru büyür (kararmadan)
    if (bgImg) {
      if (zoom > 0.001) {
        // büyüme merkezi zoom başlarken bir kez alınır, sonra sabit kalır (kaymasın)
        if (!bgImg.style.transformOrigin) {
          screen.getWorldPosition(tmpV).project(camera);
          bgImg.style.transformOrigin = `${((tmpV.x + 1) / 2) * 100}% ${((1 - tmpV.y) / 2) * 100}%`;
        }
        bgImg.style.transform = `scale(${1 + ease.in(zoom) * 2.2})`;
      } else if (bgImg.style.transform) {
        bgImg.style.transform = '';
        bgImg.style.transformOrigin = '';
      }
    }
    renderScreen(t);
    if (intro) placeStart();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  }
  tick();

  // açılış oturumda bir kez oynar; hareket azaltma açıksa hiç oynamaz (?intro ile zorlanabilir)
  let seen = false;
  try { seen = sessionStorage.getItem(INTRO_KEY) === '1'; } catch { /* yok say */ }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (new URLSearchParams(location.search).has('intro') || (!seen && !reduce)) setupIntro();
  else setTimeout(greet, 350);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      clearInterval(typing);
      ro.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerup', onPointerUp);
      tweens.length = 0;
      scene.traverse((o) => {
        o.geometry?.dispose();
        const m = o.material;
        (Array.isArray(m) ? m : m ? [m] : []).forEach((mm) => {
          mm.map?.dispose();
          mm.dispose();
        });
      });
      renderer.dispose();
    },
  };
}
