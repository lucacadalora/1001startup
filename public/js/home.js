import { mountQrCity } from '/js/qr3d.js?v=p22';
import { mountStreetDemo } from '/js/street-demo.js?v=p22';

/* scroll reveal (armed only once JS is definitely running) */
document.documentElement.classList.add('js-rv');
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { rootMargin: '-40px' });
for (const el of document.querySelectorAll('.rv')) io.observe(el);

/* street demo (lazy: only starts when scrolled near) */
const demoCanvas = document.getElementById('street-demo');
if (demoCanvas) {
  const io2 = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io2.disconnect();
      mountStreetDemo(demoCanvas);
    }
  }, { rootMargin: '200px' });
  io2.observe(demoCanvas);
}

/* hero claim bar → /claim with the handle prefilled */
const claimForm = document.getElementById('hero-claim');
if (claimForm) {
  claimForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const h = document.getElementById('hero-handle').value.trim().toLowerCase();
    location.href = h ? `/claim?handle=${encodeURIComponent(h)}` : '/claim';
  });
}

const dataEl = document.getElementById('hero-data');
const canvas = document.getElementById('hero-qr');
if (dataEl && canvas) {
  try {
    const { matrix } = JSON.parse(dataEl.textContent);
    const app = mountQrCity(canvas, matrix, { seed: 'pasar-hero', theme: 'morning' });
    window.__heroApp = app;
    const aerialBtn = document.getElementById('hero-aerial');
    const fig = document.getElementById('hero-stage');
    if (app && aerialBtn) {
      aerialBtn.addEventListener('click', () => {
        app.aerial();
        fig.classList.add('scanning'); // clean plate for the phone pointed at it
      });
      canvas.addEventListener('pointerdown', () => fig.classList.remove('scanning'));
    }
    if (!app) fig.style.display = 'none';

    /* dusk panel in the City QR section */
    const panelCanvas = document.getElementById('qr-panel-3d');
    if (panelCanvas) mountQrCity(panelCanvas, matrix, { seed: 'pasar-panel', theme: 'dusk' });

    const amb = document.getElementById('hero-amb');
    const soundBtn = document.getElementById('hero-sound');
    if (amb && soundBtn) {
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
    }
  } catch (e) { /* hero stays static */ }
}
