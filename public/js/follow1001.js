/* 1001startup.id — Follow buttons (dashboard slice 1, Luca 18 Oct 2026; plan
 * https://claude.ai/artifact/CavAoXkc8XgExFGG5th8uH).
 *
 * Pages render <button class="fw1001" data-fk="company|bumn|dc|investor"
 * data-fr="<id>" hidden> wherever something can be followed: the company card
 * (drawer and full page), BUMN cards, data-centre projects, investor pages,
 * and the rows of /me. lib/account1001.js loads this file on 1001startup.id
 * pages only while data/me.live exists, so with the switch off the buttons
 * stay hidden.
 *
 * Signed in: a click follows or unfollows at once (POST /api/me/follow).
 * Signed out: the click opens the sign-in popup (the wall's card, with a close
 * button, holding /signin?embed=1&via=follow); once the frame reports a
 * sign-in, the follow that was asked for is saved. Buttons that appear later
 * (the company drawer, the BUMN card) are painted as they arrive.
 */
(function () {
  'use strict';
  var me = document.currentScript;
  if (!me) return;
  var d = me.dataset || {};
  var LANG = d.lang === 'id' ? 'id' : 'en';
  var PF = LANG === 'id' ? '/id' : '';
  var signed = d.signed === '1';
  var have = null;      // Set of "kind:ref" this reader follows; null until known
  var pending = null;   // what a signed-out reader asked to follow
  var T = LANG === 'id' ? {
    follow: 'Ikuti', following: 'Diikuti', err: 'Belum tersimpan',
    h: 'Masuk untuk mengikuti', s: 'Gratis. Ketik email kamu, kami kirim kode 6 angka. Yang kamu ikuti muncul di My 1001.',
    n: 'Email kamu kami simpan untuk proses masuk, dan tidak pernah ditampilkan di situs.',
    x: 'Tutup', f: 'Formulir masuk', a: 'Akun',
  } : {
    follow: 'Follow', following: 'Following', err: 'Not saved',
    h: 'Sign in to follow', s: 'It is free. Type your email and we send you a 6-digit code. What you follow shows up in My 1001.',
    n: 'We keep your email to sign you in. It is never shown on the site.',
    x: 'Close', f: 'Sign-in form', a: 'Account',
  };
  function key(k, r) { return k + ':' + r; }

  function paint(b) {
    if (!have) return;
    var on = have.has(key(b.getAttribute('data-fk'), b.getAttribute('data-fr')));
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.textContent = on ? T.following : T.follow;
    b.hidden = false;
  }
  function paintAll() { document.querySelectorAll('.fw1001').forEach(paint); }

  function load() {
    if (!signed) { have = new Set(); paintAll(); return Promise.resolve(); }
    return fetch('/api/me/follows', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        signed = !!j.signedIn;
        have = new Set((j.follows || []).map(function (f) { return key(f.k, f.r); }));
        paintAll();
      })
      .catch(function () { if (!have) have = new Set(); paintAll(); });
  }

  function save(k, r, on) {
    return fetch('/api/me/follow', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ k: k, r: r, on: on }),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (j) {
        if (res.status === 401) { signed = false; throw new Error('signin'); }
        if (!res.ok || !j.ok) throw new Error('save');
        return j;
      });
    });
  }

  function toggle(b) {
    var k = b.getAttribute('data-fk'), r = b.getAttribute('data-fr'), id = key(k, r);
    if (!signed) { pending = { k: k, r: r }; openSignIn(); return; }
    var on = !have.has(id);
    if (on) have.add(id); else have.delete(id);
    paintAll();
    b.disabled = true;
    save(k, r, on).catch(function (err) {
      if (on) have.delete(id); else have.add(id);
      paintAll();
      if (err && err.message === 'signin') { pending = { k: k, r: r }; openSignIn(); return; }
      b.textContent = T.err;
      setTimeout(function () { paint(b); }, 1600);
    }).then(function () { b.disabled = false; });
  }

  /* Capture phase on purpose: these buttons sit inside clickable things (a
     census row opens the drawer, a BUMN card unpins on outside clicks), and
     a Follow click must do only one thing. */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.fw1001') : null;
    if (!b || !have) return;
    e.preventDefault();
    e.stopPropagation();
    if (!b.disabled) toggle(b);
  }, true);

  /* buttons that arrive later: the drawer's card, the BUMN card */
  new MutationObserver(function (list) {
    if (!have) return;
    list.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.classList && n.classList.contains('fw1001')) paint(n);
        else if (n.querySelectorAll) n.querySelectorAll('.fw1001').forEach(paint);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });

  /* ── sign in to follow ─────────────────────────────────────────────── */
  var modal = null, frame = null, back = null;
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function openSignIn() {
    if (modal) return;
    back = document.activeElement;
    modal = el('div');
    modal.id = 'f1001';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'f1001-h');
    var card = el('div', 'f1001-c');
    card.tabIndex = -1;
    var x = el('button', 'f1001-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', T.x);
    x.addEventListener('click', closeSignIn);
    var inner = el('div', 'f1001-in');
    var k = el('p', 'f1001-k');
    k.appendChild(el('i'));
    k.appendChild(document.createTextNode('1001startup.id'));
    var h = el('h2', null, T.h);
    h.id = 'f1001-h';
    frame = el('iframe');
    frame.title = T.f;
    frame.src = PF + '/signin?embed=1&via=follow&next=' + encodeURIComponent(location.pathname + location.search);
    inner.appendChild(k);
    inner.appendChild(h);
    inner.appendChild(el('p', 'f1001-s', T.s));
    inner.appendChild(frame);
    inner.appendChild(el('p', 'f1001-n', T.n));
    card.appendChild(x);
    card.appendChild(inner);
    modal.appendChild(card);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeSignIn(); });
    document.documentElement.appendChild(modal);
    document.documentElement.classList.add('f1001-on');
    if (document.body) { document.body.inert = true; document.body.setAttribute('aria-hidden', 'true'); }
    try { card.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ }
  }
  function closeSignIn() {
    if (!modal) return;
    modal.parentNode.removeChild(modal);
    modal = null;
    frame = null;
    document.documentElement.classList.remove('f1001-on');
    if (document.body && !document.getElementById('w1001')) {
      document.body.inert = false;
      document.body.removeAttribute('aria-hidden');
    }
    if (back && back.focus) { try { back.focus(); } catch (e) { /* gone */ } }
  }
  document.addEventListener('keydown', function (e) { if (modal && e.key === 'Escape') closeSignIn(); });

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow || e.origin !== location.origin) return;
    var m = e.data || {};
    if (m.type === 'a1001-h' && m.h > 0) frame.style.height = Math.min(Math.max(Math.ceil(m.h), 120), 1400) + 'px';
    else if (m.type === 'a1001-in') signedInHere();
  });
  function signedInHere() {
    var want = pending;
    pending = null;
    closeSignIn();
    signed = true;
    var a = document.querySelector('header a.acct');
    if (a) { a.textContent = T.a; a.setAttribute('href', PF + '/me'); a.classList.add('on'); }
    load().then(function () {
      if (!want || have.has(key(want.k, want.r))) return;
      have.add(key(want.k, want.r));
      paintAll();
      return save(want.k, want.r, true).catch(function () { have.delete(key(want.k, want.r)); paintAll(); });
    });
  }

  load();
})();
