import './style.css';
import { mountAdventure } from './adventure/scene.js';
import { mountNormal } from './normal/normal.js';

const app = document.getElementById('app');

// İki mod: macera (BMO sahnesi) ve normal (sade kaydırmalı sayfa). Seçim hatırlanır.
// Adres çubuğunda ?mode=normal / ?mode=adventure ile de açılabilir.
let saved = null;
try { saved = localStorage.getItem('mode'); } catch { /* yok say */ }
const asked = new URLSearchParams(location.search).get('mode');
let current = null;

async function show(mode) {
  current?.destroy();
  current = null;
  try { localStorage.setItem('mode', mode); } catch { /* yok say */ }
  // adresteki ?mode= bir kez geçerli; yenileyince son seçilen mod açılsın
  if (new URLSearchParams(location.search).has('mode')) {
    const u = new URL(location.href);
    u.searchParams.delete('mode');
    history.replaceState(null, '', u);
  }
  if (mode === 'normal') {
    current = mountNormal(app, { onSwitch: () => show('adventure') });
  } else {
    app.innerHTML = '<div class="adv-loading"><span>BMO uyanıyor…</span></div>';
    current = await mountAdventure(app, { onSwitch: () => show('normal') });
  }
}

show(asked === 'normal' || asked === 'adventure' ? asked : saved === 'normal' ? 'normal' : 'adventure');
