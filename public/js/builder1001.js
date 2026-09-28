/* "Who is building this" card (views/builder1001.js renders it).
 *
 * States on #b1: is-open (card on screen) / is-docked (card parked off the
 * right edge, edge tab showing). The first page of a reader's day plays the
 * intro: the card rises from below, holds, then slides right into the tab —
 * the phone "minimise to the edge" gesture. Every later page starts docked.
 *
 * Put away by: the minimise button, a swipe right on the card, Escape, or a
 * tap outside. Brought back by: tapping the tab or pulling it left.
 * Hover or focus holds the intro open; it only auto-docks while nobody is
 * reading it.
 *
 * "Already saw it" memory follows the consent banner: sessionStorage for the
 * tab (plain UI state, gone when the tab closes), and a 24h localStorage stamp
 * ONLY when the reader allowed Preferences (the key is in consent.js
 * PREF_KEYS, so a refusal deletes it). Every access is guarded — a blocked
 * storage just means the intro can play again. */
(() => {
  'use strict';
  const root = document.getElementById('b1');
  if (!root || root.dataset.b1Init) return;
  root.dataset.b1Init = '1';
  /* the stylesheet sets --b1-ok; without it the markup would paint raw */
  if (!getComputedStyle(root).getPropertyValue('--b1-ok').trim()) return;

  const card = root.querySelector('.b1-card');
  const tab = root.querySelector('.b1-tab');
  const minBtn = root.querySelector('.b1-min');
  const KEY = 'b1001.intro';     // 24h stamp; listed in consent.js PREF_KEYS
  /* consent.js blocks PREF_KEYS by NAME on every Storage (session included),
     so the tab-scoped flag needs a name of its own or a refusal would make
     the intro replay on every page */
  const SKEY = 'b1001.intro.tab';
  const DAY = 864e5;
  const HOLD = 6000;          // how long the intro stays up once it has landed
  const RESUME = 3000;        // after the pointer/focus leaves an intro card

  const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const track = (name) => { try { if (window.vsTrack) window.vsTrack(name); } catch (e) { /* analytics never breaks UI */ } };
  const prefsAllowed = () => {
    try { const r = window.VantisConsent && window.VantisConsent.get(); return !!(r && r.preferences); } catch (e) { return false; }
  };
  const seenRecently = () => {
    try { if (sessionStorage.getItem(SKEY)) return true; } catch (e) { /* fine */ }
    try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < DAY; } catch (e) { return false; }
  };
  const markSeen = () => {
    try { sessionStorage.setItem(SKEY, '1'); } catch (e) { /* fine */ }
    if (prefsAllowed()) { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* fine */ } }
  };

  let intro = false;
  let timer = 0;
  let hovering = false;

  const clearTimer = () => { clearTimeout(timer); timer = 0; };
  const armTimer = (ms) => {
    clearTimer();
    if (intro && !hovering && !card.contains(document.activeElement)) timer = setTimeout(() => dock(), ms);
  };

  function open(opts) {
    const o = opts || {};
    clearTimer();
    intro = !!o.intro;
    root.classList.toggle('is-intro', intro);
    card.inert = false;
    card.removeAttribute('aria-hidden');
    root.classList.remove('is-docked');
    root.classList.add('is-open');
    tab.setAttribute('aria-expanded', 'true');
    if (o.focus) minBtn.focus({ preventScroll: true });
    if (intro) armTimer(HOLD + 650);
  }

  function dock(opts) {
    const o = opts || {};
    clearTimer();
    const hadFocus = card.contains(document.activeElement);
    intro = false;
    root.classList.remove('is-open', 'is-intro', 'is-rise');
    root.classList.add('is-docked');
    card.style.transform = '';
    card.inert = true;
    card.setAttribute('aria-hidden', 'true');
    tab.setAttribute('aria-expanded', 'false');
    if (hadFocus || o.focusTab) tab.focus({ preventScroll: true });
  }

  function playIntro() {
    markSeen();
    if (reduce()) { open({ intro: true }); return; }
    root.classList.add('is-rise');       // parked below the viewport, no transition
    void card.offsetWidth;               // commit that frame before animating up
    root.classList.remove('is-rise');
    open({ intro: true });
    track('builder-intro');
  }

  /* On a phone the consent banner fills the bottom of the first screen; the
     intro waits for it rather than stacking on top of it. consent.js builds
     the banner at once and slides it in later, and removes it on a choice,
     so being in the DOM is the test (it is position:fixed — offsetParent is
     always null and says nothing). */
  const bannerUp = () => !!document.querySelector('.vs-cc') && window.matchMedia('(max-width:640px)').matches;

  /* Page controls the tab must never sit on: /map's zoom stack lives in the
     same bottom-right corner. When one is there, card + tab lift above it. */
  const AVOID = '.jkt-ctl';
  function clearControls() {
    root.style.removeProperty('--b1-bottom');
    const base = parseFloat(getComputedStyle(root).getPropertyValue('--b1-bottom')) || 92;
    let need = base;
    document.querySelectorAll(AVOID).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || r.top >= window.innerHeight || r.right < window.innerWidth - 140) return;
      need = Math.max(need, Math.ceil(window.innerHeight - r.top + 12));
    });
    if (need !== base) root.style.setProperty('--b1-bottom', need + 'px');
  }

  function start() {
    root.hidden = false;
    clearControls();
    window.addEventListener('resize', clearControls);
    /* returning today: rest docked. First visit: nothing shows until the
       intro, so the tab does not flash in and straight back out. */
    if (seenRecently()) { dock(); return; }
    let waited = 0;
    const go = () => {
      if (bannerUp() && waited < 60000) { waited += 600; setTimeout(go, 600); return; }
      if (document.visibilityState === 'hidden') {
        document.addEventListener('visibilitychange', function v() {
          if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', v); setTimeout(go, 700); }
        });
        return;
      }
      /* the reader may have opened it by hand in the meantime */
      if (!root.classList.contains('is-open')) playIntro();
    };
    setTimeout(go, 1400);
  }

  /* ── controls ─────────────────────────────────────────────────────────── */
  minBtn.addEventListener('click', () => dock({ focusTab: true }));

  card.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; clearTimer(); } });
  card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { hovering = false; armTimer(RESUME); } });
  card.addEventListener('focusin', clearTimer);
  card.addEventListener('focusout', () => setTimeout(() => armTimer(RESUME), 0));

  card.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-b1-ev]');
    if (a) track('builder-' + a.getAttribute('data-b1-ev'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-open')) dock();
  });
  document.addEventListener('pointerdown', (e) => {
    if (root.classList.contains('is-open') && !root.contains(e.target)) dock();
  }, true);

  /* ── swipe the card right to put it away ─────────────────────────────── */
  let drag = null;
  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !root.classList.contains('is-open')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, t: e.timeStamp, lastX: e.clientX, lastT: e.timeStamp, v: 0, live: false };
  });
  card.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.live) {
      /* only a clearly sideways move becomes a swipe; vertical is scroll */
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) {
        if (Math.abs(dy) > 10) drag = null;
        return;
      }
      drag.live = true;
      clearTimer();
      root.classList.add('is-drag');
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    }
    const dt = Math.max(1, e.timeStamp - drag.lastT);
    drag.v = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX; drag.lastT = e.timeStamp;
    /* free to the right, rubber-banded to the left */
    drag.dx = dx > 0 ? dx : dx / 4;
    card.style.transform = `translate3d(${drag.dx}px,0,0)`;
  });
  let swipedAt = 0;
  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    const d = drag; drag = null;
    if (!d.live) return;
    swipedAt = Date.now();
    root.classList.remove('is-drag');
    if (d.dx > Math.min(110, card.offsetWidth * 0.33) || d.v > 0.45) { dock(); return; }
    card.style.transform = '';            // spring back (class transition)
    armTimer(RESUME);
  };
  card.addEventListener('pointerup', endDrag);
  card.addEventListener('pointercancel', endDrag);
  /* a finished swipe must not also click the link it started on */
  card.addEventListener('click', (e) => {
    if (Date.now() - swipedAt < 350) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  /* ── the tab: tap, or pull left ──────────────────────────────────────── */
  let pull = null;
  let pulledAt = 0;
  tab.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    pull = { id: e.pointerId, x: e.clientX, dx: 0 };
    try { tab.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
  });
  tab.addEventListener('pointermove', (e) => {
    if (!pull || e.pointerId !== pull.id) return;
    pull.dx = Math.min(0, e.clientX - pull.x);
    if (pull.dx < -4) {
      root.classList.add('is-drag-tab');
      tab.style.transform = `translate3d(${Math.max(pull.dx, -60) / 2}px,0,0)`;
    }
    if (pull.dx < -36) {
      pull = null;
      root.classList.remove('is-drag-tab');
      tab.style.transform = '';
      pulledAt = Date.now();
      open();
      track('builder-open');
    }
  });
  const endPull = () => { pull = null; root.classList.remove('is-drag-tab'); tab.style.transform = ''; };
  tab.addEventListener('pointerup', endPull);
  tab.addEventListener('pointercancel', endPull);
  tab.addEventListener('click', (e) => {
    if (Date.now() - pulledAt < 400) return;   // the pull already opened it
    /* e.detail 0 = keyboard activation: send focus into the card */
    open({ focus: e.detail === 0 });
    track('builder-open');
  });

  start();
})();
