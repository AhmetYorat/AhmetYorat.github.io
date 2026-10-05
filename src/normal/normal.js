import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { profile, projects } from '../data.js';

// Normal mod: sade, kaydırmalı tek sayfa. Solda metin, sağda kaydırırken sabit duran
// 3D uygulama ikonu çarkı. Kaydırdıkça aktif proje öne döner, arkadaki ışık onun rengini alır.

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const lerp = (a, b, k) => a + (b - a) * k;

// projenin kendi başlık yazı tipi (data.js > titleFont)
const fontCss = (p) => {
  const f = p.titleFont;
  if (!f) return '';
  return `font-family:${f.family};font-weight:${f.weight || 800};font-style:${f.style || 'normal'};letter-spacing:${f.tracking || '-0.03em'}`;
};

export function mountNormal(root, { onSwitch } = {}) {
  // "???" gibi yer tutucuları normal modda gösterme
  const list = projects.filter((p) => p.link || p.image);
  const pad = (n) => String(n).padStart(2, '0');
  const fullName = profile.fullName || profile.name;
  const realEmail = profile.email && !/ornek|example/.test(profile.email);

  root.innerHTML = `
  <div class="nm">
    <button type="button" class="nm-mode"><img src="/bmo-mode.webp" alt="" width="20" height="26">Macera modu</button>
    <div class="nm-stage" aria-hidden="true">
      <div class="nm-glow"></div>
      <canvas class="nm-canvas"></canvas>
      <p class="nm-drag">sürükle · döndür</p>
    </div>
    <main class="nm-main">
      <section class="nm-sec nm-hero" data-i="-1">
        <h1 class="nm-name">${esc(fullName)}</h1>
        <p class="nm-made">Yaptıklarımdan biri: <span class="nm-swap">${esc(list[0]?.name || '')}</span></p>
        <p class="nm-lead">${esc(profile.tagline)}</p>
        <p class="nm-meta">${esc(profile.note)}</p>
        <a class="nm-down" href="#nm-p0">Projeler <span aria-hidden="true">↓</span></a>
      </section>
      ${list
        .map(
          (p, i) => `
      <section class="nm-sec nm-proj" id="nm-p${i}" data-i="${i}" style="--c:${p.color}">
        <p class="nm-idx">${pad(i + 1)} / ${pad(list.length)}${p.year ? ` · ${esc(p.year)}` : ''}</p>
        <h2 class="nm-title" style="${fontCss(p)}">${esc(p.name)}</h2>
        <p class="nm-desc">${esc(p.desc)}</p>
        <p class="nm-tags"><i></i>${esc([...p.platforms, p.stack].join(' · '))}</p>
        ${p.link ? `<a class="nm-link" href="${esc(p.link)}" target="_blank" rel="noopener">${esc(p.linkLabel || 'Aç')} <span aria-hidden="true">↗</span></a>` : ''}
      </section>`
        )
        .join('')}
      <section class="nm-sec nm-about" data-i="-2">
        <p class="nm-big">${esc(profile.about)}</p>
        <div class="nm-cols">
          <div>
            <h3>Yetenekler</h3>
            <dl class="nm-skills">${profile.skills.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
          </div>
          <div class="nm-contact">
            ${realEmail ? `<p class="nm-mailrow"><a class="nm-mail" href="mailto:${esc(profile.email)}">${esc(profile.email)}</a><button type="button" class="nm-copy">Kopyala</button></p>` : ''}
            <p class="nm-links">
              ${profile.github ? `<a href="${esc(profile.github)}" target="_blank" rel="noopener">GitHub ↗</a>` : ''}
              ${profile.linkedin && !/linkedin\.com\/?$/.test(profile.linkedin) ? `<a href="${esc(profile.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗</a>` : ''}
            </p>
          </div>
        </div>
        <footer class="nm-foot">© ${new Date().getFullYear()} ${esc(fullName)}</footer>
      </section>
    </main>
  </div>`;

  const wrap = root.querySelector('.nm');
  const stage = root.querySelector('.nm-stage');
  const canvas = root.querySelector('.nm-canvas');
  const glow = root.querySelector('.nm-glow');
  const swap = root.querySelector('.nm-swap');
  document.documentElement.classList.add('nm-on');
  // yenileyince tarayıcı eski kaydırma yerine atlamasın; sayfa en üstten başlar
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  root.querySelector('.nm-mode').addEventListener('click', () => onSwitch?.());
  const copyBtn = root.querySelector('.nm-copy');
  copyBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(profile.email);
      copyBtn.textContent = 'Kopyalandı';
    } catch {
      copyBtn.textContent = 'Kopyalanamadı';
    }
    setTimeout(() => (copyBtn.textContent = 'Kopyala'), 1600);
  });

  // ---------- 3D ikon çarkı ----------
  // Temiz, ince uygulama ikonu levhaları; öndeki parlak, arkadakiler karanlıkta kalır.
  // Öne hangi ikon gelirse yerdeki ışık havuzu ve arka plan ışığı onun rengini alır.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // cilalı gövdelere yumuşak stüdyo yansıması
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  scene.add(new THREE.AmbientLight('#ffffff', 0.5));
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(1.5, 4, 6);
  scene.add(key);

  // köşeleri yuvarlatılmış kare (iOS ikonu gibi)
  function squircle(w, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    s.moveTo(x + r, x);
    s.lineTo(-x - r, x);
    s.quadraticCurveTo(-x, x, -x, x + r);
    s.lineTo(-x, -x - r);
    s.quadraticCurveTo(-x, -x, -x - r, -x);
    s.lineTo(x + r, -x);
    s.quadraticCurveTo(x, -x, x, -x - r);
    s.lineTo(x, x + r);
    s.quadraticCurveTo(x, x, x + r, x);
    return s;
  }
  function faceGeoOf(w, r) {
    const g = new THREE.ShapeGeometry(squircle(w, r), 16);
    const pos = g.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) / w + 0.5;
      uv[i * 2 + 1] = pos.getY(i) / w + 0.5;
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  }
  const radial = (stops) => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([k, col]) => g.addColorStop(k, col));
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  };

  const S = 1.35;
  const DEPTH = 0.12;
  const CORNER = 0.3;
  const N = list.length;
  const R = N > 1 ? 1.75 : 0;
  const FLOOR = -S * 0.62;
  const ring = new THREE.Group();
  scene.add(ring);
  const slabGeo = new THREE.ExtrudeGeometry(squircle(S, CORNER), { depth: DEPTH, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 16 });
  slabGeo.translate(0, 0, -DEPTH / 2);
  const faceGeo = faceGeoOf(S, CORNER);
  const shadowTex = radial([[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
  const shadowGeo = new THREE.PlaneGeometry(S * 1.25, S * 0.45).rotateX(-Math.PI / 2);

  scene.environment = envTex;
  scene.environmentIntensity = 0.55;
  // ön yüzde cam parlaklığı: üstten hafif beyaz, aşağı doğru kaybolur
  const glossTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 60, 256);
    g.addColorStop(0, 'rgba(255,255,255,0.32)');
    g.addColorStop(0.42, 'rgba(255,255,255,0.06)');
    g.addColorStop(0.5, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    // ince kenar ışığı
    x.strokeStyle = 'rgba(255,255,255,0.18)';
    x.lineWidth = 4;
    x.beginPath();
    x.roundRect(3, 3, 250, 250, 56);
    x.stroke();
    return new THREE.CanvasTexture(c);
  })();
  // öndeki ikonun üstünden geçen çapraz ışık şeridi
  const shineTex = (() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(170, 0, 342, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.setTransform(1, 0, -0.45, 1, 58, 0);
    x.fillRect(0, 0, 512, 256);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(0.5, 1);
    return t;
  })();
  // zemin yansımasının yere yakın ucu belirgin, aşağı doğru kaybolur
  const fadeTex = (() => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#000');
    g.addColorStop(0.55, '#000');
    g.addColorStop(1, '#fff');
    x.fillStyle = g;
    x.fillRect(0, 0, 4, 256);
    return new THREE.CanvasTexture(c);
  })();

  const icons = list.map((p, i) => {
    const a = (i / N) * Math.PI * 2;
    const g = new THREE.Group();
    g.position.set(Math.sin(a) * R, 0, Math.cos(a) * R);
    g.rotation.y = a;
    // gövde: neredeyse siyah, hafifçe proje rengine çalan ince levha
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#141816').lerp(new THREE.Color(p.color), 0.16), roughness: 0.38, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.18 });
    g.add(new THREE.Mesh(slabGeo, bodyMat));
    // ön yüz: logo
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const x = c.getContext('2d');
    x.fillStyle = p.surface || '#111';
    x.fillRect(0, 0, 1024, 1024);
    x.fillStyle = p.color;
    x.font = '800 400px Unbounded, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(p.short || '', 512, 540);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    if (p.logo) {
      const img = new Image();
      img.onload = () => {
        x.clearRect(0, 0, 1024, 1024);
        x.drawImage(img, 0, 0, 1024, 1024);
        tex.needsUpdate = true;
      };
      img.src = p.logo;
    }
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.z = DEPTH / 2 + 0.021;
    g.add(face);
    // cam parlaklığı + geçen ışık şeridi
    const gloss = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: glossTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    gloss.position.z = face.position.z + 0.002;
    g.add(gloss);
    const shineMap = shineTex.clone();
    shineMap.needsUpdate = true;
    const shine = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: shineMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    shine.position.z = face.position.z + 0.004;
    g.add(shine);
    // zemindeki soluk yansıma (ön yüzün aynası)
    const refl = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: tex, alphaMap: fadeTex, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    refl.scale.y = -1;
    refl.position.set(0, 2 * FLOOR, face.position.z);
    g.add(refl);
    const sh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    sh.position.y = FLOOR;
    g.add(sh);
    g.traverse((o) => (o.userData.i = i));
    ring.add(g);
    return { g, p, a, s: 1, faceMat, bodyMat, base: bodyMat.color.clone(), shine, shineMap, refl };
  });

  // yerde öndeki ikonun renginde ışık havuzu
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 4.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: radial([[0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 })
  );
  pool.position.set(0, FLOOR - 0.01, R * 0.55);
  scene.add(pool);
  // öndeki ikona arkadan vuran renkli ışık
  const rim = new THREE.PointLight('#5be08a', 10, 7);
  rim.position.set(0, 1.4, R - 0.6);
  scene.add(rim);

  // ---------- Durum ----------
  let active = -1; // -1: giriş, -2: hakkımda
  let heroI = 0; // girişte sırayla öne gelen ikon
  let spin = 0;
  let drag = null;
  let vel = 0;
  let lastInput = -10;
  let front = -1;
  const glowColor = new THREE.Color('#5be08a');
  const tmpC = new THREE.Color('#5be08a');

  function setActive(i) {
    if (i === active) return;
    active = i;
    stage.classList.toggle('is-idle', i === -2);
  }
  // öne gelen ikon değişince: ışık rengi, arka plan ve girişteki "Yaptıklarımdan biri" yazısı
  function setFront(i) {
    if (i === front) return;
    front = i;
    const p = list[i];
    tmpC.set(p.color);
    glow.style.background = p.color;
    wrap.style.setProperty('--front', p.color);
    swap.classList.remove('is-in');
    void swap.offsetWidth;
    swap.textContent = p.name;
    swap.style.color = p.color;
    swap.style.cssText += ';' + fontCss(p);
    swap.classList.add('is-in');
  }
  // girişteyken her 2.6 sn'de bir sonraki ikon öne döner
  const heroTimer = setInterval(() => {
    if (active === -1 && !drag && clock.elapsedTime - lastInput > 2) heroI = (heroI + 1) % Math.max(N, 1);
  }, 2600);

  // en yakın tur sayısıyla hedef açı (geriye uzun yoldan dönmesin)
  const targetFor = (i) => {
    const t = -(i / N) * Math.PI * 2;
    return t + Math.round((spin - t) / (Math.PI * 2)) * Math.PI * 2;
  };

  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, spin, moved: 0, t: performance.now() };
    canvas.setPointerCapture(e.pointerId);
    stage.classList.add('is-drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      canvas.style.cursor = hitIcon(e) >= 0 ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - drag.x;
    const now = performance.now();
    const ns = drag.spin + dx * 0.008;
    vel = (ns - spin) / Math.max((now - drag.t) / 1000, 0.008);
    drag.t = now;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    spin = ns;
    lastInput = clock.elapsedTime;
  });
  const endDrag = (e) => {
    if (!drag) return;
    const click = drag.moved < 5;
    drag = null;
    stage.classList.remove('is-drag');
    lastInput = clock.elapsedTime;
    if (click) {
      vel = 0;
      const i = hitIcon(e);
      if (i >= 0) goTo(i + 1);
    } else if (active === -1) {
      // girişte bırakılınca o an öndeki ikonla devam etsin
      heroI = front;
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hitIcon(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(ring.children, true).find((h) => h.object.userData.i !== undefined && h.object.geometry !== shadowGeo);
    return hit ? hit.object.userData.i : -1;
  }

  // kaydırma: ekranın ortasındaki bölüm aktif
  const secs = [...root.querySelectorAll('.nm-sec')];
  // ekranın dikey ortası hangi bölümün içindeyse o aktif
  let scrollQueued = false;
  function pickActive() {
    scrollQueued = false;
    const mid = innerHeight / 2;
    const sec = secs.find((el) => {
      const r = el.getBoundingClientRect();
      return r.top <= mid && r.bottom > mid;
    });
    if (sec) setActive(Number(sec.dataset.i));
  }
  const onScroll = () => {
    if (!scrollQueued) {
      scrollQueued = true;
      requestAnimationFrame(pickActive);
    }
  };
  addEventListener('scroll', onScroll, { passive: true });
  pickActive();

  // ---------- Bölüm bölüm yumuşak kaydırma (masaüstü) ----------
  // Tekerlek bir kez dönünce sonraki/önceki bölüm ~1 sn'de süzülerek ortaya oturur.
  // Dokunmatik ekranda CSS scroll-snap çalışır; hareket azaltma açıksa anında geçer.
  const touchOnly = matchMedia('(hover: none)').matches;
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  let glide = 0;
  let lockUntil = 0;
  const yOf = (el) => {
    const r = el.getBoundingClientRect();
    // hakkımda başından, diğerleri ortadan hizalanır
    const off = el.classList.contains('nm-about') ? 0 : (r.height - innerHeight) / 2;
    return Math.max(0, Math.round(scrollY + r.top + off));
  };
  const nearest = () => {
    let best = 0;
    let d = Infinity;
    secs.forEach((el, i) => {
      const dd = Math.abs(yOf(el) - scrollY);
      if (dd < d) { d = dd; best = i; }
    });
    return best;
  };
  function goTo(i) {
    const el = secs[clampI(i)];
    const from = scrollY;
    const to = yOf(el);
    cancelAnimationFrame(glide);
    if (reduceMotion || Math.abs(to - from) < 2) {
      scrollTo(0, to);
      return;
    }
    const dur = Math.min(1300, 750 + Math.abs(to - from) * 0.25);
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      scrollTo(0, from + (to - from) * easeInOut(k));
      if (k < 1) glide = requestAnimationFrame(step);
      else glide = 0;
    };
    glide = requestAnimationFrame(step);
  }
  const clampI = (i) => Math.max(0, Math.min(secs.length - 1, i));
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function onWheel(e) {
    if (touchOnly || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    const dir = Math.sign(e.deltaY);
    if (!dir) return;
    // hakkımda ekrandan uzunsa içinde serbest kaydırılır
    const about = secs[secs.length - 1];
    const ar = about.getBoundingClientRect();
    if (!glide && ar.top <= 2 && (dir > 0 || ar.top < -2)) return;
    e.preventDefault();
    const now = performance.now();
    // geçiş sürerken ve trackpad'in "kuyruk" hareketi bitene kadar yeni geçiş başlamaz
    if (glide || now < lockUntil) {
      lockUntil = now + 220;
      return;
    }
    lockUntil = now + 220;
    const cur = nearest();
    const next = clampI(cur + dir);
    if (next !== cur) goTo(next);
  }
  addEventListener('wheel', onWheel, { passive: false });
  function onKeyNav(e) {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key;
    const dir = k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey) ? 1 : k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey) ? -1 : 0;
    if (!dir) return;
    const ar = secs[secs.length - 1].getBoundingClientRect();
    if (ar.top <= 2 && (dir > 0 || ar.top < -2)) return;
    e.preventDefault();
    if (!glide) goTo(nearest() + dir);
  }
  addEventListener('keydown', onKeyNav);
  root.querySelector('.nm-down').addEventListener('click', (e) => {
    e.preventDefault();
    goTo(1);
  });
  const reveal = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add('is-in')),
    { threshold: 0.25 }
  );
  secs.forEach((s) => reveal.observe(s));

  // ---------- Boyut ----------
  // kamera biraz yukarıdan bakar; fare hareketiyle bakış açısı hafifçe kayar
  let camDist = 9;
  const ELEV = 0.17; // ~10° yukarıdan
  const look = { x: 0, y: 0, tx: 0, ty: 0 };
  function placeCamera() {
    // kamera öndeki ikonun etrafında hafifçe döner, gözü hep ona bakar: ikon ortada ve düz kalır
    const yaw = look.x * 0.06;
    const el = ELEV + look.y * 0.04;
    const d = camDist - R;
    camera.position.set(Math.sin(yaw) * Math.cos(el) * d, Math.sin(el) * d - 0.1, R + Math.cos(yaw) * Math.cos(el) * d);
    camera.lookAt(0, -0.1, R);
  }
  const onMouse = (e) => {
    look.tx = (e.clientX / innerWidth) * 2 - 1;
    look.ty = (e.clientY / innerHeight) * 2 - 1;
  };
  addEventListener('pointermove', onMouse, { passive: true });
  // fare sayfadan çıkınca açı ortaya döner
  const onLeave = () => { look.tx = 0; look.ty = 0; };
  document.addEventListener('pointerleave', onLeave);
  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // çarkın tamamı yatayda sığsın
    const halfW = R + S * 0.7;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const z = Math.max(8, (halfW * 1.05) / (tanH * camera.aspect) + R);
    camDist = z;
    placeCamera();
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  resize();

  // ---------- Döngü ----------
  const clock = new THREE.Clock();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0;
  function tick() {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (!drag) {
      // bırakınca biraz savrulur, sonra hedefe yerleşir
      spin += vel * dt;
      vel *= Math.exp(-dt * 4);
      if (t - lastInput > 1.2) {
        const target = active >= 0 ? active : active === -1 ? heroI : -1;
        if (target >= 0) spin = lerp(spin, targetFor(target), 1 - Math.exp(-dt * (reduce ? 20 : 3.5)));
        else if (!reduce) spin += dt * 0.12;
      }
    }
    ring.rotation.y = spin;
    if (!reduce) {
      look.x = lerp(look.x, look.tx, 1 - Math.exp(-dt * 2.5));
      look.y = lerp(look.y, look.ty, 1 - Math.exp(-dt * 2.5));
      placeCamera();
    }
    // öne en yakın ikon
    let best = 0;
    let bestCos = -2;
    icons.forEach((ic, i) => {
      const c = Math.cos(ic.a + spin);
      if (c > bestCos) {
        bestCos = c;
        best = i;
      }
    });
    if (N) setFront(best);
    for (const ic of icons) {
      const f = (Math.cos(ic.a + spin) + 1) / 2; // 1 önde, 0 arkada
      // öndeki parlak ve biraz büyük; arkadakiler karanlıkta
      const lit = 0.18 + 0.82 * f ** 2.2;
      ic.faceMat.color.setScalar(lit);
      ic.bodyMat.color.copy(ic.base).multiplyScalar(0.3 + 0.7 * f);
      ic.s = lerp(ic.s, 0.88 + f * 0.16, 1 - Math.exp(-dt * 8));
      ic.g.scale.setScalar(ic.s);
      ic.g.position.y = reduce ? 0 : Math.sin(t * 1.1 + ic.a * 2) * 0.04;
      // yansıma zemine göre ayna: ikon yükselince yansıması alçalır
      ic.refl.position.y = 2 * FLOOR - 2 * ic.g.position.y / ic.s;
      ic.refl.material.opacity = 0.05 + 0.2 * f * f;
      // ışık şeridi yalnız öndeki ikonda, 4.5 sn'de bir soldan sağa geçer
      const k = (t % 4.5) / 0.9;
      const on = !reduce && ic === icons[front] && k < 1;
      ic.shine.material.opacity = on ? Math.sin(k * Math.PI) * 0.9 : 0;
      if (on) ic.shineMap.offset.x = lerp(0.75, -0.25, k);
    }
    glowColor.lerp(tmpC, 1 - Math.exp(-dt * 4));
    rim.color.copy(glowColor);
    pool.material.color.copy(glowColor);
    renderer.render(scene, camera);
  }
  tick();

  return {
    destroy() {
      cancelAnimationFrame(raf);
      clearInterval(heroTimer);
      ro.disconnect();
      removeEventListener('scroll', onScroll);
      removeEventListener('wheel', onWheel);
      removeEventListener('keydown', onKeyNav);
      cancelAnimationFrame(glide);
      removeEventListener('pointermove', onMouse);
      document.removeEventListener('pointerleave', onLeave);
      reveal.disconnect();
      document.documentElement.classList.remove('nm-on');
      scene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.map?.dispose();
        o.material?.dispose();
      });
      renderer.dispose();
    },
  };
}
