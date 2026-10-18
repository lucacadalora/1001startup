/* 1001startup.id — My 1001 dashboard (views/dash1001.js; Luca, 18 Oct 2026:
 * "make this into like real dashboard", a lead agent coming soon and a chatbot
 * that searches the data).
 *
 *  - Search bar: instant, in the browser, over GET /api/me/index (every
 *    startup, BUMN, data centre, investor and sector). "/" jumps in, arrows
 *    move, Enter opens; the last row hands the words to Ask 1001.
 *  - Ask 1001: POST /api/me/ask streams NDJSON ({t:'step'} lines while it
 *    searches, then {t:'answer'} or {t:'fail'}). The answer is a small
 *    markdown subset turned into DOM nodes here, never innerHTML: paragraphs,
 *    "- " lists, **bold** and links to paths on this site. The last few
 *    questions stay in sessionStorage so a reload keeps them.
 *  - Lead agent (coming soon): "Get early access" and the Contacts button on a
 *    followed startup or BUMN save a request (POST /api/me/lead).
 *
 * Follow buttons anywhere here are public/js/follow1001.js's (it paints
 * buttons that arrive later, and stops their clicks from doing anything else).
 */
(function () {
  'use strict';
  var me = document.currentScript;
  if (!me) return;
  var LANG = me.dataset.lang === 'id' ? 'id' : 'en';
  var ASK = me.dataset.ask === '1';
  var T = LANG === 'id' ? {
    none: 'Tidak ada yang cocok di 1001.', ask: 'Tanya Ask 1001:', kind: { company: 'Startup', bumn: 'BUMN', dc: 'Pusat data', investor: 'Investor', sector: 'Sektor' },
    follow: 'Ikuti', thinking: 'Membaca data 1001', from: 'Dari data 1001 per ', sec: ' dtk',
    busy: 'Ask 1001 sedang sibuk. Coba lagi sebentar lagi.',
    pause: 'Ask 1001 belum bisa menjawab kali ini, kendalanya di pihak kami. Coba lagi sebentar lagi.',
    limit: 'Itu batas pertanyaan hari ini untuk akunmu. Ask 1001 kembali besok.',
    paused: 'Ask 1001 istirahat dulu untuk hari ini, dari pihak kami. Besok kembali.',
    one: 'Satu pertanyaan dulu ya, yang sebelumnya masih berjalan.',
    signin: 'Sesi masukmu sudah berakhir. Masuk lagi untuk bertanya.', signinGo: 'Masuk',
    onList: 'Kamu sudah terdaftar', onListNote: 'Agen ini muncul di sini saat dibuka.', asked: 'Kontak diminta',
    notSaved: 'Belum tersimpan. Coba lagi.',
  } : {
    none: 'Nothing in 1001 matches.', ask: 'Ask 1001:', kind: { company: 'Startup', bumn: 'BUMN', dc: 'Data centre', investor: 'Investor', sector: 'Sector' },
    follow: 'Follow', thinking: 'Reading 1001’s data', from: 'From 1001’s data as of ', sec: ' s',
    busy: 'Ask 1001 is busy right now. Try again in a minute.',
    pause: 'Ask 1001 couldn’t answer this time, on our side. Try again in a minute.',
    limit: 'That’s today’s questions for your account. Ask 1001 is back tomorrow.',
    paused: 'Ask 1001 is resting for today, on our side. It’s back tomorrow.',
    one: 'One question at a time: the last one is still running.',
    signin: 'Your sign-in has ended. Sign in again to ask.', signinGo: 'Sign in',
    onList: 'You’re on the list', onListNote: 'It will show up here when it opens.', asked: 'Contacts asked',
    notSaved: 'Not saved. Try again.',
  };
  var PF = LANG === 'id' ? '/id' : '';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }

  /* ── search bar ─────────────────────────────────────────────────────── */
  var box = document.getElementById('md-s');
  var list = document.getElementById('md-qr');
  var items = null, loading = null, rows = [], sel = -1;

  function loadIndex() {
    if (items || loading) return loading;
    loading = fetch('/api/me/index?lang=' + LANG, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        items = (j.items || []).map(function (x) { x.nn = norm(x.n); x.nx = norm(x.x); x.ns = norm(x.s); return x; });
      })
      .catch(function () { items = []; })
      .then(function () { loading = null; if (box && document.activeElement === box) render(); });
    return loading;
  }
  var BOOST = { company: 3, bumn: 2, investor: 1, dc: 1, sector: 2 };
  function search(q) {
    var n = norm(q);
    if (!n || !items) return [];
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var x = items[i], s = 0;
      if (x.nn === n) s = 120;
      else if (x.nn.indexOf(n) === 0) s = 100;
      else if ((' ' + x.nn).indexOf(' ' + n) >= 0) s = 80;
      else if (x.nn.indexOf(n) >= 0) s = 60;
      else if (x.nx && x.nx.indexOf(n) >= 0) s = 40;
      else if (n.length >= 3 && x.ns.indexOf(n) >= 0) s = 15;
      if (s) out.push({ x: x, s: s + (BOOST[x.k] || 0) - Math.min(x.n.length, 60) / 60 });
    }
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, 8).map(function (o) { return o.x; });
  }
  function open(on) {
    if (!list) return;
    list.hidden = !on;
    box.setAttribute('aria-expanded', on ? 'true' : 'false');
  }
  function select(i) {
    sel = i;
    var lis = list.querySelectorAll('li[role="option"]');
    for (var k = 0; k < lis.length; k++) lis[k].setAttribute('aria-selected', k === i ? 'true' : 'false');
    if (lis[i]) { box.setAttribute('aria-activedescendant', lis[i].id); lis[i].scrollIntoView({ block: 'nearest' }); }
    else box.removeAttribute('aria-activedescendant');
  }
  function render() {
    var q = box.value.trim();
    list.textContent = '';
    rows = [];
    sel = -1;
    if (!q) { open(false); return; }
    if (!items) { loadIndex(); return; }
    var found = search(q);
    found.forEach(function (x, i) {
      var li = el('li');
      li.id = 'md-o' + i;
      li.setAttribute('role', 'option');
      var t = el('div', 't');
      t.appendChild(el('b', null, x.n));
      if (x.s) t.appendChild(el('span', null, x.s));
      li.appendChild(t);
      li.appendChild(el('span', 'me-k', T.kind[x.k] || ''));
      if (x.k !== 'sector') {
        var b = el('button', 'fw1001', T.follow);
        b.type = 'button';
        b.hidden = true;
        b.setAttribute('data-fk', x.k);
        b.setAttribute('data-fr', x.r);
        li.appendChild(b);
      }
      li.addEventListener('mousemove', function () { if (sel !== i) select(i); });
      li.addEventListener('click', function () { go(i); });
      list.appendChild(li);
      rows.push({ href: x.h });
    });
    if (!found.length) list.appendChild(el('li', 'none', T.none));
    if (ASK && q.length >= 3) {
      var i = rows.length;
      var li = el('li', 'ask');
      li.id = 'md-o' + i;
      li.setAttribute('role', 'option');
      var t = el('div', 't');
      var b = el('b', null, T.ask + ' ');
      b.appendChild(el('em', null, '“' + q + '”'));
      t.appendChild(b);
      li.appendChild(t);
      li.addEventListener('mousemove', function () { if (sel !== i) select(i); });
      li.addEventListener('click', function () { go(i); });
      list.appendChild(li);
      rows.push({ ask: q });
    }
    open(true);
  }
  function go(i) {
    var r = rows[i];
    if (!r) return;
    if (r.ask) { open(false); box.value = ''; askNow(r.ask); return; }
    location.href = r.href;
  }
  if (box && list) {
    if (box.dataset.short && window.matchMedia && window.matchMedia('(max-width: 759px)').matches) box.placeholder = box.dataset.short;
    box.addEventListener('focus', function () { loadIndex(); if (box.value.trim()) render(); });
    box.addEventListener('input', render);
    box.addEventListener('keydown', function (e) {
      var n = list.querySelectorAll('li[role="option"]').length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) render(); select(n ? (sel + 1) % n : -1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); select(n ? (sel <= 0 ? n - 1 : sel - 1) : -1); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel >= 0 ? sel : 0); }
      else if (e.key === 'Escape') { open(false); box.blur(); }
    });
    document.addEventListener('click', function (e) {
      if (!list.hidden && !e.target.closest('.md-cmd')) open(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
      e.preventDefault();
      box.focus();
    });
  }

  /* ── Ask 1001 ───────────────────────────────────────────────────────── */
  var form = document.getElementById('md-af');
  var input = document.getElementById('md-ai');
  var thread = document.getElementById('md-thread');
  var tryBox = document.getElementById('md-try');
  var KEEP = 'md-ask-v1';
  var past = [];     // [{ q, a, ents, asof, ms }] newest last
  var running = false;

  /* inline: **bold** and [text](/path); anything else stays text */
  function inline(parent, s) {
    var re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      if (m[1] != null) parent.appendChild(el('b', null, m[1]));
      else {
        var href = m[3];
        if (/^\/(?!\/)[^\s]*$/.test(href)) {
          var a = el('a', null, m[2]);
          a.href = href;
          parent.appendChild(a);
        } else parent.appendChild(document.createTextNode(m[2]));
      }
      last = re.lastIndex;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }
  function md(text) {
    var out = el('div', 'md-an');
    var ul = null;
    String(text || '').replace(/\r/g, '').split('\n').forEach(function (line) {
      var t = line.trim();
      if (!t) { ul = null; return; }
      var li = /^[-*•]\s+(.*)$/.exec(t) || /^\d+[.)]\s+(.*)$/.exec(t);
      if (li) {
        if (!ul) { ul = el('ul'); out.appendChild(ul); }
        var x = el('li');
        inline(x, li[1]);
        ul.appendChild(x);
        return;
      }
      ul = null;
      var p = el('p');
      inline(p, t.replace(/^#+\s*/, ''));
      out.appendChild(p);
    });
    return out;
  }
  function dayOf(iso) {
    if (!iso) return '';
    var d = new Date(String(iso).length <= 10 ? iso + 'T00:00:00Z' : iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(LANG === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }
  function entsList(ents) {
    if (!ents || !ents.length) return null;
    var ul = el('ul', 'md-en');
    ents.slice(0, 8).forEach(function (x) {
      var li = el('li');
      var a = el('a', null, x.n);
      a.href = x.h;
      if (x.s) a.title = x.s;
      li.appendChild(a);
      if (x.k === 'company' || x.k === 'bumn' || x.k === 'dc' || x.k === 'investor') {
        var b = el('button', 'fw1001', T.follow);
        b.type = 'button';
        b.hidden = true;
        b.setAttribute('data-fk', x.k);
        b.setAttribute('data-fr', x.r);
        li.appendChild(b);
      }
      ul.appendChild(li);
    });
    return ul;
  }
  function card(q) {
    var c = el('article', 'md-qa');
    c.appendChild(el('p', 'md-qq', q));
    var st = el('ul', 'md-st');
    c.appendChild(st);
    var wait = el('div', 'md-an wait', T.thinking + '…');
    c.appendChild(wait);
    thread.insertBefore(c, thread.firstChild);
    return { c: c, st: st, wait: wait };
  }
  function finish(v, ans) {
    var body = md(ans.a);
    v.c.replaceChild(body, v.wait);
    var e = entsList(ans.ents);
    if (e) v.c.appendChild(e);
    var line = (ans.asof ? T.from + dayOf(ans.asof) : '') + (ans.ms ? (ans.asof ? ' · ' : '') + (Math.round(ans.ms / 100) / 10) + T.sec : '');
    if (line) v.c.appendChild(el('p', 'md-sr', line));
  }
  function calm(v, msg, link) {
    var p = el('div', 'md-an calm');
    var t = el('p', null, msg + (link ? ' ' : ''));
    if (link) { var a = el('a', null, link.t); a.href = link.h; t.appendChild(a); }
    p.appendChild(t);
    v.c.replaceChild(p, v.wait);
  }
  function save() {
    try { sessionStorage.setItem(KEEP, JSON.stringify(past.slice(-6))); } catch (e) { /* kept for this page only */ }
  }
  function history() {
    var h = [];
    past.slice(-3).forEach(function (x) {
      h.push({ role: 'user', content: x.q });
      h.push({ role: 'assistant', content: x.a });
    });
    return h;
  }
  function busy(on) {
    running = on;
    var b = form && form.querySelector('.md-go');
    if (b) b.disabled = on;
  }
  function askNow(q) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    if (!q || !thread || running) return;
    if (tryBox) tryBox.hidden = true;
    var v = card(q);
    var sec = document.getElementById('md-ask');
    if (sec && sec.getBoundingClientRect().top < 0) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    busy(true);
    var steps = [];
    function step(label) {
      if (steps.length) steps[steps.length - 1].classList.remove('run');
      var li = el('li', 'run', label);
      v.st.appendChild(li);
      steps.push(li);
    }
    function stopSteps() { if (steps.length) steps[steps.length - 1].classList.remove('run'); }
    post('/api/me/ask', { q: q, lang: LANG, history: history() }).then(function (res) {
      if (res.status === 401) { calm(v, T.signin, { t: T.signinGo, h: PF + '/signin?next=' + encodeURIComponent(PF + '/me') }); return; }
      if (!res.ok || !res.body) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          var e = j && j.error;
          calm(v, e === 'daily_limit' ? T.limit : e === 'paused' ? T.paused : e === 'one_at_a_time' ? T.one : T.pause);
        });
      }
      var rd = res.body.getReader(), dec = new TextDecoder(), buf = '', done = false;
      function line(s) {
        if (!s.trim()) return;
        var o;
        try { o = JSON.parse(s); } catch (e) { return; }
        if (o.t === 'step') step(o.label || o.tool || '');
        else if (o.t === 'answer') {
          done = true;
          stopSteps();
          var ans = { q: q, a: String(o.answer || ''), ents: o.entities || [], asof: o.asof || '', ms: o.ms || 0 };
          finish(v, ans);
          past.push(ans);
          save();
        } else if (o.t === 'fail') { done = true; stopSteps(); calm(v, o.reason === 'busy' ? T.busy : T.pause); }
      }
      function pump() {
        return rd.read().then(function (r) {
          if (r.done) { if (buf) line(buf); if (!done) { stopSteps(); calm(v, T.pause); } return; }
          buf += dec.decode(r.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); }
          return pump();
        });
      }
      return pump();
    }).catch(function () { stopSteps(); if (v.wait.parentNode) calm(v, T.pause); })
      .then(function () { busy(false); });
  }

  if (ASK && form && input && thread) {
    try { past = JSON.parse(sessionStorage.getItem(KEEP) || '[]') || []; } catch (e) { past = []; }
    if (!Array.isArray(past)) past = [];
    past.forEach(function (x) {
      if (!x || !x.q) return;
      var v = card(x.q);
      finish(v, x);
    });
    if (past.length && tryBox) tryBox.hidden = true;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value;
      if (!q.trim() || running) return;
      input.value = '';
      askNow(q);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
    });
    if (tryBox) tryBox.addEventListener('click', function (e) {
      var b = e.target.closest('.md-chip');
      if (b) askNow(b.getAttribute('data-q'));
    });
  }

  /* ── lead agent (coming soon) ───────────────────────────────────────── */
  var early = document.querySelector('.md-lead [data-lead]');
  var note = document.getElementById('md-lnote');
  if (early) early.addEventListener('click', function () {
    if (early.getAttribute('aria-pressed') === 'true') return;
    early.disabled = true;
    post('/api/me/lead', {}).then(function (r) {
      if (!r.ok) throw new Error('save');
      early.setAttribute('aria-pressed', 'true');
      early.textContent = T.onList;
      if (note) note.textContent = T.onListNote;
    }).catch(function () { if (note) note.textContent = T.notSaved; }).then(function () { early.disabled = false; });
  });

  var dlg = document.getElementById('md-ld');
  var target = null;
  function openLead(b) {
    target = b;
    var name = b.getAttribute('data-ln') || '';
    if (!dlg || typeof dlg.showModal !== 'function') { askContacts(); return; }
    dlg.querySelectorAll('[data-n]').forEach(function (s) { s.textContent = name; });
    var f = b.getAttribute('data-lf');
    var fw = dlg.querySelector('[data-f]');
    if (fw) { fw.hidden = !f; var fv = dlg.querySelector('[data-fv]'); if (fv) fv.textContent = f || ''; }
    var go = dlg.querySelector('[data-go]');
    var done = b.getAttribute('aria-pressed') === 'true';
    go.setAttribute('aria-pressed', done ? 'true' : 'false');
    go.textContent = done ? T.asked : go.getAttribute('data-t') || go.textContent;
    if (!go.getAttribute('data-t') && !done) go.setAttribute('data-t', go.textContent);
    var ok = dlg.querySelector('[data-ok]');
    ok.textContent = ok.getAttribute('data-t') || ok.textContent;
    ok.hidden = !done;
    dlg.showModal();
  }
  function askContacts() {
    var b = target;
    if (!b) return Promise.resolve();
    var go = dlg && dlg.querySelector('[data-go]');
    if (go) go.disabled = true;
    return post('/api/me/lead', { k: b.getAttribute('data-lk'), r: b.getAttribute('data-lr') }).then(function (r) {
      if (!r.ok) throw new Error('save');
      b.setAttribute('aria-pressed', 'true');
      b.textContent = T.asked;
      if (go) { go.setAttribute('aria-pressed', 'true'); go.textContent = T.asked; }
      if (dlg) dlg.querySelector('[data-ok]').hidden = false;
    }).catch(function () {
      if (dlg) { var ok = dlg.querySelector('[data-ok]'); ok.hidden = false; ok.textContent = T.notSaved; }
    }).then(function () { if (go) go.disabled = false; });
  }
  /* capture phase: the button sits in a census row, whose click opens the drawer */
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('.md-cb') : null;
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    openLead(b);
  }, true);
  if (dlg) {
    var goBtn = dlg.querySelector('[data-go]');
    goBtn.setAttribute('data-t', goBtn.textContent);
    var okLine = dlg.querySelector('[data-ok]');
    okLine.setAttribute('data-t', okLine.textContent);
    goBtn.addEventListener('click', function () { if (goBtn.getAttribute('aria-pressed') !== 'true') askContacts(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }
})();
