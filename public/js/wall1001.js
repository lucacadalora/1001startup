/* 1001startup.id — the free-account card. Until 23 Oct 2026 this was a login
 * wall (blur + sign-in card, no close button, slice 2 of 18 Oct). Luca, 23 Oct
 * 2026: "we need to delete the 2 minute forced login, just make the popup maybe
 * what feature inside of it".
 *
 * lib/account1001.js loads this file in <head> only for readers who are NOT
 * signed in, only on 1001startup.id pages, and only while the card is switched
 * on (data/wall.live) or this browser opened the test link (?wall=test: a
 * 10-second clock on its own meter; ?wall=off ends test mode).
 *
 * The clock counts seconds while the tab is on screen, across pages, in
 * localStorage (w1001). At 120 s a card at the bottom left lists what a free
 * account adds (Ask 1001, Follow, My 1001). Nothing is blurred or locked: the
 * reader closes it ("Not now" / x / Esc) and keeps reading, and it stays away
 * for 7 days, then comes back after another 120 s of reading. "Continue with
 * email" swaps the list for /signin?embed=1 in a same-origin frame, so Clerk
 * runs only there and every other page keeps its strict CSP; when the frame
 * says the reader is signed in, the card goes, no reload.
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

  /* the wall's old second clock, a cookie: no longer read, so let it go */
  try { if (/(?:^|;\s*)w1001s=/.test(document.cookie || '')) document.cookie = 'w1001s=; path=/; max-age=0; samesite=lax'; } catch (e) { /* it expires by itself */ }

  /* ?wall=off: forget the test clock */
  if (d.off === '1' || d.clear === '1') {
    try { if (store) store.removeItem('w1001t'); } catch (e) { /* nothing to forget */ }
    if (d.off === '1') return;
  }

  var LIMIT = Math.max(1, parseInt(d.limit, 10) || 120);
  var REST = 7 * 864e5;   // after "Not now", this long before the clock runs again
  var SETTLE = 5;         // seconds on a page before the card may show on it
  var TEST = d.test === '1';
  var LANG = d.lang === 'id' ? 'id' : 'en';
  var PF = LANG === 'id' ? '/id' : '';
  var KEY = TEST ? 'w1001t' : 'w1001';
  var mem = { s: 0 };   // storage blocked: the clock lives for this page only

  var T = LANG === 'id' ? {
    k: 'Akun gratis',
    h: 'Ada lebih banyak di 1001startup.id',
    f: [
      ['Ask 1001', 'Tanya soal startup, BUMN, atau pusat data mana pun. Jawabannya dari data kami.'],
      ['Ikuti', 'Ikuti startup, BUMN, investor, dan proyek pusat data.'],
      ['My 1001', 'Satu halaman berisi semua yang kamu ikuti.'],
    ],
    go: 'Lanjut dengan email',
    no: 'Nanti saja',
    n: 'Gratis, tanpa kata sandi: kami kirim kode 6 angka ke email kamu.',
    h2: 'Masuk atau daftar',
    s2: 'Ketik email kamu, kami kirim kode 6 angka.',
    n2: 'Email kamu kami simpan untuk proses masuk, dan tidak pernah ditampilkan di situs.',
    fr: 'Formulir masuk',
    x: 'Tutup',
    t: 'Mode uji: jam 10 detik. Buka ?wall=off untuk berhenti.',
    a: 'Akun',
  } : {
    k: 'Free account',
    h: 'There is more inside 1001startup.id',
    f: [
      ['Ask 1001', 'Ask about any startup, state company or data centre. Answers come from our data.'],
      ['Follow', 'Follow startups, state companies, investors and data-centre projects.'],
      ['My 1001', 'One page with everything you follow.'],
    ],
    go: 'Continue with email',
    no: 'Not now',
    n: 'Free, no password: we email you a 6-digit code.',
    h2: 'Sign in or join',
    s2: 'Type your email and we send you a 6-digit code.',
    n2: 'We keep your email to sign you in. It is never shown on the site.',
    fr: 'Sign-in form',
    x: 'Close',
    t: 'Test mode: 10-second clock. Open ?wall=off to stop.',
    a: 'Account',
  };

  function read() {
    if (!store) return mem;
    try {
      var x = JSON.parse(store.getItem(KEY) || 'null');
      return x && typeof x.s === 'number' ? x : { s: 0 };
    } catch (e) { return mem; }
  }
  function write(v) {
    mem = v;
    if (store) { try { store.setItem(KEY, JSON.stringify(v)); } catch (e) { /* this page keeps it */ } }
  }
  if (d.reset === '1') write({ s: 0 });

  /* closed less than 7 days ago: nothing to do on this page */
  var v0 = read();
  if (v0.x && Date.now() - v0.x < REST) return;

  var wrap = null;
  var frame = null;
  var timer = null;
  var here = 0;   // seconds on screen on this page

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  /* Two other cards sit at the bottom and go first: the cookie banner
     (consent.js, .vs-cc; position:fixed, so offsetParent can't tell, measure
     it) and the "who is building this" card while it is open (#b1.is-open).
     The Follow sign-in popup (html.f1001-on) is a sign-in already. */
  function busy() {
    if (html.classList.contains('f1001-on')) return true;
    var b1 = document.getElementById('b1');
    if (b1 && b1.classList.contains('is-open')) return true;
    var cc = document.querySelector('.vs-cc');
    if (!cc) return false;
    var st = getComputedStyle(cc);
    return st.display !== 'none' && st.visibility !== 'hidden' && cc.getBoundingClientRect().height > 0;
  }
  function tick() {
    if (document.visibilityState !== 'visible') return;
    here += 1;
    var v = read();
    if (v.x && Date.now() - v.x < REST) { stop(); return; }   // closed in another tab
    if ((v.s || 0) < LIMIT) { v.s = (v.s || 0) + 1; write(v); }
    if (v.s >= LIMIT && here >= SETTLE && document.body && !busy()) show();
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function show() {
    if (wrap) return;
    stop();
    wrap = el('div');
    wrap.id = 'w1001';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-labelledby', 'w1001-h');
    var x = el('button', 'w1001-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', T.x);
    x.addEventListener('click', close);
    var inner = el('div', 'w1001-in');
    var k = el('p', 'w1001-k');
    k.appendChild(el('i'));
    k.appendChild(document.createTextNode(T.k));
    var h = el('h2', null, T.h);
    h.id = 'w1001-h';
    var ul = el('ul');
    T.f.forEach(function (f) {
      var li = el('li');
      li.appendChild(el('b', null, f[0]));
      li.appendChild(el('span', null, f[1]));
      ul.appendChild(li);
    });
    var acts = el('div', 'w1001-a');
    var go = el('button', 'w1001-go', T.go);
    go.type = 'button';
    go.addEventListener('click', signIn);
    var no = el('button', 'w1001-no', T.no);
    no.type = 'button';
    no.addEventListener('click', close);
    acts.appendChild(go);
    acts.appendChild(no);
    inner.appendChild(k);
    inner.appendChild(h);
    inner.appendChild(ul);
    inner.appendChild(acts);
    inner.appendChild(el('p', 'w1001-n', T.n));
    if (TEST) inner.appendChild(el('p', 'w1001-t', T.t));
    wrap.appendChild(x);
    wrap.appendChild(inner);
    /* on <html>, beside <body>: nothing a page does to its body can cover it */
    html.appendChild(wrap);
    count('view');
    if (!TEST && store) {
      try { if (!store.getItem('w1001f')) { store.setItem('w1001f', '1'); count('first'); } } catch (e) { /* uncounted */ }
    }
    track('wall_shown');
  }

  /* "Continue with email": the list makes way for the sign-in form */
  function signIn() {
    if (!wrap || frame) return;
    var inner = wrap.querySelector('.w1001-in');
    var h = el('h2', null, T.h2);
    h.id = 'w1001-h';
    frame = el('iframe');
    frame.title = T.fr;
    frame.src = PF + '/signin?embed=1&via=' + (TEST ? 'test' : 'wall')
      + '&next=' + encodeURIComponent(location.pathname + location.search);
    var k = inner.querySelector('.w1001-k');
    while (inner.lastChild && inner.lastChild !== k) inner.removeChild(inner.lastChild);
    inner.appendChild(h);
    inner.appendChild(el('p', 'w1001-s', T.s2));
    inner.appendChild(frame);
    inner.appendChild(el('p', 'w1001-n', T.n2));
    if (TEST) inner.appendChild(el('p', 'w1001-t', T.t));
    count('open');
    track('wall_open');
  }

  function remove() {
    stop();
    if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
    wrap = null;
    frame = null;
  }
  function close() {
    var v = read();
    v.s = 0;
    v.x = Date.now();
    write(v);
    remove();
    count('close');
    track('wall_close');
  }
  function lift(mine) {
    remove();
    /* the header was rendered for a signed-out reader */
    var a = document.querySelector('header a.acct');
    if (a) { a.textContent = T.a; a.setAttribute('href', PF + '/me'); a.classList.add('on'); }
    if (mine) track('wall_signin');
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wrap && !html.classList.contains('f1001-on')) close();
  });
  /* signed in, in our form or in the Follow popup's: the card has done its job */
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    var m = e.data || {};
    var mine = !!frame && e.source === frame.contentWindow;
    if (m.type === 'a1001-in') lift(mine);
    else if (mine && m.type === 'a1001-h' && m.h > 0) frame.style.height = Math.min(Math.max(Math.ceil(m.h), 120), 1400) + 'px';
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

  timer = setInterval(tick, 1000);
})();
