import { mountQrCity } from '/js/qr3d.js?v=p22';

const $ = (id) => document.getElementById(id);
const dataIn = $('qr-data'), ecl = $('qr-ecl');
const flat = $('qr-flat'), canvas = $('qr-3d');
const tabFlat = $('tab-flat'), tab3d = $('tab-3d');
const themesEl = $('qr-themes'), dotsEl = $('qr-dots');
const amb = $('qr-amb'), soundBtn = $('qr-sound');

let app = null, timer = null, lastMatrixKey = '', reqSeq = 0;
let theme = 'morning', accentColor = '#C96F2E', style = 'leaf';
const stylesEl = $('qr-styles');

function currentUrl() {
  const d = dataIn.value.trim() || 'https://pasar.vantis.sh';
  return `/qr.svg?data=${encodeURIComponent(d)}&ecl=${ecl.value}&u=12&style=${style}` +
    `&season=${theme}&accent=${accentColor.replace('#', '')}`;
}

function refreshFlat() { flat.src = currentUrl(); }

async function refresh3d() {
  const d = dataIn.value.trim() || 'https://pasar.vantis.sh';
  const key = `${d}|${ecl.value}`;
  if (key === lastMatrixKey) return;
  const seq = ++reqSeq;
  try {
    const r = await fetch(`/api/qr/matrix?data=${encodeURIComponent(d)}&ecl=${ecl.value}`);
    if (!r.ok || seq !== reqSeq) return;
    const mx = await r.json();
    if (seq !== reqSeq) return;
    if (!app) {
      app = mountQrCity(canvas, mx, { seed: d, theme, accentColor });
      if (!app) { tab3d.style.display = 'none'; show('flat'); return; }
    } else app.setMatrix(mx, { seed: d });
    lastMatrixKey = key;
  } catch { /* keep last render */ }
}

function refresh() {
  refreshFlat();
  if (canvas.style.display !== 'none') refresh3d();
}

function show(which) {
  const is3d = which === '3d';
  flat.style.display = is3d ? 'none' : '';
  canvas.style.display = is3d ? '' : 'none';
  tabFlat.classList.toggle('on', !is3d);
  tab3d.classList.toggle('on', is3d);
  if (is3d) refresh3d();
}

for (const el of [dataIn, ecl]) {
  el.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 300);
  });
}
tabFlat.addEventListener('click', () => show('flat'));
tab3d.addEventListener('click', () => show('3d'));

/* style */
if (stylesEl) stylesEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-style]');
  if (!btn) return;
  style = btn.dataset.style;
  for (const c of stylesEl.querySelectorAll('[data-style]')) c.classList.toggle('on', c === btn);
  refreshFlat();
});

/* seasons */
themesEl.addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-theme]');
  if (!btn) return;
  theme = btn.dataset.theme;
  for (const c of themesEl.querySelectorAll('[data-theme]')) c.classList.toggle('on', c === btn);
  if (app) app.setTheme(theme);
  refreshFlat();
  const playing = !amb.paused;
  amb.src = `/assets/audio/ambience-${theme}.mp3`;
  if (playing) { amb.play().catch(() => {}); }
});

/* accent color */
dotsEl.addEventListener('click', (ev) => {
  const dot = ev.target.closest('.color-dot');
  if (!dot) return;
  accentColor = dot.dataset.color;
  for (const d of dotsEl.children) d.classList.toggle('on', d === dot);
  if (app) app.setAccentColor(accentColor);
  refreshFlat();
});

/* ambient sound */
const wave = soundBtn.querySelector('.wave');
const slash = soundBtn.querySelector('.slash');
const setIcon = (playing) => {
  if (wave) wave.style.display = playing ? '' : 'none';
  if (slash) slash.style.display = playing ? 'none' : '';
};
setIcon(false);
soundBtn.addEventListener('click', () => {
  if (amb.paused) { amb.volume = 0.55; amb.play().then(() => setIcon(true)).catch(() => {}); }
  else { amb.pause(); setIcon(false); }
});

/* downloads (always the scan-safe flat render) */
function downloadFailed(btn, status) {
  const old = btn.textContent;
  btn.textContent = status === 429 ? 'Rate-limited — wait a moment' : 'Could not encode that link';
  setTimeout(() => { btn.textContent = old; }, 2500);
}
$('qr-dl-svg').addEventListener('click', async (ev) => {
  const r = await fetch(currentUrl());
  if (!r.ok) return downloadFailed(ev.currentTarget, r.status);
  const blob = await r.blob();
  triggerDownload(URL.createObjectURL(blob), 'city-qr.svg');
});
$('qr-dl-png').addEventListener('click', async (ev) => {
  const r = await fetch(currentUrl());
  if (!r.ok) return downloadFailed(ev.currentTarget, r.status);
  const svg = await r.text();
  const url = await svgToPngUrl(svg, 1600);
  triggerDownload(url, 'city-qr.png');
});

function triggerDownload(url, name) {
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function svgToPngUrl(svgText, px) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = px; c.height = px;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, px, px);
      ctx.drawImage(img, 0, 0, px, px);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('png'))), 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

refreshFlat();
refresh3d();
