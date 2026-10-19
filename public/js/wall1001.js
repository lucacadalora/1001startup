/* 1001startup.id — the login wall (slice 2; Luca, 18 Oct 2026: "make them
 * blurred and popup signing just like instagram/meta").
 *
 * lib/account1001.js loads this file in <head>, synchronously, only for readers
 * who are NOT signed in, only on 1001startup.id pages, and only while the wall
 * is switched on (data/wall.live) or this browser opened the test link
 * (?wall=test: a 10-second clock on its own meter; ?wall=off ends test mode).
 *
 * The clock counts seconds while the tab is on screen, across pages, in
 * localStorage and in a cookie (w1001s; the larger of the two wins, so
 * clearing one does not reset it), and never resets (Luca's call 3).
 * Readers who were on the site before the wall went up (data-since) get no
 * fresh 2 min: their time counts from their first visit, so the card comes at
 * once (Luca, 18 Oct: "dont let if people already [here] for long time, they
 * are free from the login"). When it reaches the limit
 * (120 s; 45 s on 18 Oct) the page blurs and a sign-in card covers it at once (call 2),
 * with no close button. The card holds /signin?embed=1 in a same-origin frame,
 * so Clerk runs only there and every other page keeps its strict CSP. When the
 * frame says the reader is signed in, the wall lifts in place, no reload.
 * Styles: views/wall1001.js.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  if (!me) return;
  var d = me.dataset || {};
  var html = document.documentElement;
  var store = null;
  try { store = window.localStorage; store.getItem('w1001'); } catch (e) { store = null; }

  /* ?wall=off: forget the test clock */
  if (d.off === '1' || d.clear === '1') {
    try { if (store) store.removeItem('w1001t'); } catch (e) { /* nothing to forget */ }
    if (d.off === '1') return;
  }

  var LIMIT = Math.max(1, parseInt(d.limit, 10) || 120);
  var TEST = d.test === '1';
  var LANG = d.lang === 'id' ? 'id' : 'en';
  var PF = LANG === 'id' ? '/id' : '';
  var KEY = TEST ? 'w1001t' : 'w1001';
  var SINCE = Date.parse(d.since || '') || 0;   // when the wall went up for everyone
  var mem = { s: 0 };   // when storage and cookies are both blocked, the clock lives for this page only

  var T = LANG === 'id' ? {
    h: 'Masuk untuk lanjut membaca',
    s: 'Gratis. Ketik email kamu, kami kirim kode 6 angka.',
    n: 'Email kamu kami simpan untuk proses masuk, dan tidak pernah ditampilkan di situs.',
    f: 'Formulir masuk',
    t: 'Mode uji: jam 10 detik. Buka ?wall=off untuk berhenti.',
    a: 'Akun',
  } : {
    h: 'Sign in to keep reading',
    s: 'It is free. Type your email and we send you a 6-digit code.',
    n: 'We keep your email to sign you in. It is never shown on the site.',
    f: 'Sign-in form',
    t: 'Test mode: 10-second clock. Open ?wall=off to stop.',
    a: 'Account',
  };

  /* the real clock's second copy: a host-only cookie holding a number of seconds */
  function cookieS() {
    if (TEST) return 0;
    var m = /(?:^|;\s*)w1001s=(\d{1,7})(?:;|$)/.exec(document.cookie || '');
    return m ? parseInt(m[1], 10) : 0;
  }
  function setCookieS(n) {
    if (TEST) return;
    try {
      document.cookie = 'w1001s=' + n + '; path=/; max-age=34560000; samesite=lax'
        + (location.protocol === 'https:' ? '; secure' : '');
    } catch (e) { /* localStorage still has it */ }
  }
  function read() {
    var v = mem;
    if (store) {
      try {
        var x = JSON.parse(store.getItem(KEY) || 'null');
        v = x && typeof x.s === 'number' ? x : { s: 0 };
      } catch (e) { v = mem; }
    }
    var c = cookieS();
    if (c > (v.s || 0)) v.s = c;
    return v;
  }
  function write(v) {
    mem = v;
    if (store) { try { store.setItem(KEY, JSON.stringify(v)); } catch (e) { /* the cookie has it */ } }
    setCookieS(v.s || 0);
  }
  if (d.reset === '1') write({ s: 0 });

  /* Was this browser here before the wall went up? Two dated records say so:
     the cookie-banner choice (consent.js stamps vantis-consent.ts when it is
     made) and the builder card's last showing (b1001.intro, ms). */
  function cameBefore() {
    if (TEST || !SINCE || !store) return false;
    var t = 0;
    try { var c = JSON.parse(store.getItem('vantis-consent') || 'null'); t = (c && Date.parse(c.ts)) || 0; } catch (e) { t = 0; }
    if (t && t < SINCE) return true;
    try { t = Number(store.getItem('b1001.intro')) || 0; } catch (e) { t = 0; }
    return t > 0 && t < SINCE;
  }
  (function () {
    var v = read();
    if (v.s >= LIMIT || v.b || !cameBefore()) return;
    v.s = LIMIT;
    v.b = 1;            // counted once per browser
    write(v);
    count('back');
  })();

  var shown = false;
  var timer = null;
  var wrap = null;
  var frame = null;

  function whenBody(fn) {
    if (document.body) fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  function show() {
    if (shown) return;
    shown = true;
    if (timer) { clearInterval(timer); timer = null; }
    html.classList.add('w1001-on');
    whenBody(build);
  }
  function tick() {
    if (document.visibilityState !== 'visible') return;
    var v = read();
    v.s = (v.s || 0) + 1;
    write(v);
    if (v.s >= LIMIT) show();
  }

  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function build() {
    if (wrap) return;
    wrap = el('div');
    wrap.id = 'w1001';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'w1001-h');
    var card = el('div', 'w1001-c');
    card.tabIndex = -1;
    var inner = el('div', 'w1001-in');
    var k = el('p', 'w1001-k');
    k.appendChild(el('i'));
    k.appendChild(document.createTextNode('1001startup.id'));
    var h = el('h2');
    h.id = 'w1001-h';
    h.textContent = T.h;
    var s = el('p', 'w1001-s');
    s.textContent = T.s;
    frame = el('iframe');
    frame.title = T.f;
    frame.src = PF + '/signin?embed=1&via=' + (TEST ? 'test' : 'wall')
      + '&next=' + encodeURIComponent(location.pathname + location.search);
    var n = el('p', 'w1001-n');
    n.textContent = T.n;
    inner.appendChild(k);
    inner.appendChild(h);
    inner.appendChild(s);
    inner.appendChild(frame);
    inner.appendChild(n);
    if (TEST) { var t = el('p', 'w1001-t'); t.textContent = T.t; inner.appendChild(t); }
    card.appendChild(inner);
    wrap.appendChild(card);
    /* on <html>, beside <body>: nothing a page does to its body can cover it */
    html.appendChild(wrap);
    if (document.body) { document.body.inert = true; document.body.setAttribute('aria-hidden', 'true'); }
    try { card.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
    count('view');
    if (!TEST && store) {
      try { if (!store.getItem('w1001f')) { store.setItem('w1001f', '1'); count('first'); } } catch (e) { /* uncounted */ }
    }
    track('wall_shown');
  }

  function lift() {
    if (timer) { clearInterval(timer); timer = null; }
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = null;
    frame = null;
    html.classList.remove('w1001-on');
    if (document.body) { document.body.inert = false; document.body.removeAttribute('aria-hidden'); }
    /* the header was rendered for a signed-out reader */
    var a = document.querySelector('header a.acct');
    if (a) { a.textContent = T.a; a.setAttribute('href', PF + '/signin'); a.classList.add('on'); }
    track('wall_signin');
  }

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    var m = e.data || {};
    if (m.type === 'a1001-h' && m.h > 0) frame.style.height = Math.min(Math.max(Math.ceil(m.h), 120), 1400) + 'px';
    else if (m.type === 'a1001-in') lift();
  });

  /* day counts with no identifiers (lib/account1001.js); the test clock sends none */
  function count(k) {
    if (TEST) return;
    try {
      var body = JSON.stringify({ k: k });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/wall/event', new Blob([body], { type: 'application/json' }));
      else fetch('/api/wall/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
    } catch (e) { /* uncounted */ }
  }
  /* Umami, only after analytics consent (consent.js defines vsTrack) */
  function track(name) {
    try { if (window.vsTrack) window.vsTrack(name, { test: TEST ? 1 : 0 }); } catch (e) { /* no analytics */ }
  }

  /* time already used up: blurred from the first paint, card as soon as the body exists */
  if (read().s >= LIMIT) show();
  else timer = setInterval(tick, 1000);
})();
