/* 1001startup.id — My 1001 as one chat box (views/chat1001.js).
 *
 *  - Chips: where Ask 1001 looks first (sent as `scope`); each one swaps the
 *    placeholder and the example questions. People opens the lead agent's
 *    coming-soon sheet (POST /api/me/lead).
 *  - Typing a name offers its page from GET /api/me/index (arrows pick one,
 *    Enter opens it); otherwise Enter asks. Shift+Enter is a new line.
 *  - Ask: POST /api/me/ask streams NDJSON: {t:'step'} lines while it
 *    searches, {t:'delta'} lines with the answer's words as they are
 *    written, then
 *    {t:'answer'} (the checked answer, which replaces the words) or
 *    {t:'fail'}. The answer is a small markdown subset turned into DOM nodes
 *    here, never innerHTML: paragraphs, "- " lists, **bold** and links to
 *    paths on this site; while the words are still coming, links stay text.
 *    The chat stays in sessionStorage so a reload keeps it; New chat clears it.
 *  - While it works: an orb, the step being run, and the seconds so far; a
 *    calm line when a step is slow (a work-email lookup takes up to a minute).
 *  - History (when the page has #ck-hs, lib/askchats1001.js): each answer is
 *    saved by the server into the open chat (`chat` id); Recent chats under
 *    the box and the History sheet reopen or delete one.
 *
 * Follow buttons on answers are public/js/follow1001.js's (it paints buttons
 * that arrive later).
 */
(function () {
  'use strict';
  var me = document.currentScript;
  if (!me) return;
  var LANG = me.dataset.lang === 'id' ? 'id' : 'en';
  var PF = LANG === 'id' ? '/id' : '';
  var T = LANG === 'id' ? {
    go: 'Buka halamannya', kind: { company: 'Startup', bumn: 'BUMN', dc: 'Pusat data', investor: 'Investor', sector: 'Sektor' },
    scope: { startups: 'Startup', bumn: 'BUMN', dc: 'Pusat data', investors: 'Investor', people: 'Orang' },
    follow: 'Ikuti', thinking: 'Membaca data 1001', from: 'Dari data 1001 per ', sec: ' dtk',
    busy: 'Ask 1001 sedang sibuk. Coba lagi sebentar lagi.',
    pause: 'Ask 1001 belum bisa menjawab kali ini, kendalanya di pihak kami. Coba lagi sebentar lagi.',
    limit: 'Itu batas pertanyaan hari ini untuk akunmu. Ask 1001 kembali besok.',
    paused: 'Ask 1001 istirahat dulu untuk hari ini, dari pihak kami. Besok kembali.',
    one: 'Satu pertanyaan dulu ya, yang sebelumnya masih berjalan.',
    signin: 'Sesi masukmu sudah berakhir. Masuk lagi untuk bertanya.', signinGo: 'Masuk',
    onList: 'Kamu sudah terdaftar', notSaved: 'Belum tersimpan. Coba lagi.',
    slow: 'Masih berjalan.', slowContact: 'Mencari email kerja bisa sampai satu menit.',
    qs: function (n) { return n + ' pertanyaan'; }, del: 'Hapus', sure: 'Yakin?', chatGone: 'Chat ini sudah tidak ada.',
  } : {
    go: 'Go to the page', kind: { company: 'Startup', bumn: 'BUMN', dc: 'Data centre', investor: 'Investor', sector: 'Sector' },
    scope: { startups: 'Startups', bumn: 'BUMN', dc: 'Data centres', investors: 'Investors', people: 'People' },
    follow: 'Follow', thinking: 'Reading 1001’s data', from: 'From 1001’s data as of ', sec: ' s',
    busy: 'Ask 1001 is busy right now. Try again in a minute.',
    pause: 'Ask 1001 couldn’t answer this time, on our side. Try again in a minute.',
    limit: 'That’s today’s questions for your account. Ask 1001 is back tomorrow.',
    paused: 'Ask 1001 is resting for today, on our side. It’s back tomorrow.',
    one: 'One question at a time: the last one is still running.',
    signin: 'Your sign-in has ended. Sign in again to ask.', signinGo: 'Sign in',
    onList: 'You’re on the list', notSaved: 'Not saved. Try again.',
    slow: 'Still working.', slowContact: 'A work-email lookup can take up to a minute.',
    qs: function (n) { return n + (n === 1 ? ' question' : ' questions'); }, del: 'Delete', sure: 'Sure?', chatGone: 'That chat is no longer there.',
  };

  var form = document.getElementById('ck-f');
  var box = document.getElementById('ck-q');
  var list = document.getElementById('ck-sg');
  var thread = document.getElementById('ck-thread');
  var head = document.getElementById('ck-th');
  if (!form || !box || !list || !thread) return;
  var goBtn = form.querySelector('.ck-go');
  var chips = [].slice.call(form.querySelectorAll('.ck-c[data-sc]'));
  var tries = [].slice.call(document.querySelectorAll('.ck-try'));

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function post(url, body) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }

  /* ── what this tab remembers ────────────────────────────────────────── */
  var KEEP = 'ck-ask-v1';
  var scope = '';
  var past = [];     // [{ q, sc, a, ents, asof, ms }] newest last
  var chatId = null; // the open chat on the server, when history is on
  var running = false;
  var gen = 0;       // New chat bumps it, so an answer still on its way is dropped
  try {
    var kept = JSON.parse(sessionStorage.getItem(KEEP) || 'null');
    if (kept && Array.isArray(kept.past)) past = kept.past.filter(function (x) { return x && x.q; });
    if (kept && typeof kept.sc === 'string') scope = kept.sc;
    if (kept && kept.chat > 0) chatId = kept.chat;
  } catch (e) { past = []; }
  function save() {
    try { sessionStorage.setItem(KEEP, JSON.stringify({ sc: scope, past: past.slice(-6), chat: chatId })); } catch (e) { /* kept for this page only */ }
  }

  /* ── chips ──────────────────────────────────────────────────────────── */
  function showTries() {
    tries.forEach(function (t) { t.hidden = past.length > 0 || running || t.getAttribute('data-for') !== scope; });
  }
  function setScope(sc) {
    var hit = chips.filter(function (b) { return b.getAttribute('data-sc') === sc; })[0];
    if (!hit) { sc = ''; hit = chips[0]; }
    scope = sc;
    chips.forEach(function (b) { b.setAttribute('aria-pressed', b === hit ? 'true' : 'false'); });
    if (hit && hit.getAttribute('data-ph')) box.placeholder = hit.getAttribute('data-ph');
    showTries();
  }
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      setScope(b.getAttribute('data-sc'));
      save();
      if (box.value.trim()) render();
      box.focus();
    });
  });

  /* ── the box grows with the question ────────────────────────────────── */
  function grow() {
    box.style.height = 'auto';
    box.style.height = Math.min(box.scrollHeight, 200) + 'px';
  }

  /* ── names: the dashboard's instant search, as a shortcut ───────────── */
  var items = null, loading = null, opts = [], sel = -1;
  var WANT = { startups: 'company', bumn: 'bumn', dc: 'dc', investors: 'investor' };
  var BOOST = { company: 3, bumn: 2, investor: 1, dc: 1, sector: 2 };
  function loadIndex() {
    if (items || loading) return loading;
    loading = fetch('/api/me/index?lang=' + LANG, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        items = (j.items || []).map(function (x) { x.nn = norm(x.n); x.nx = norm(x.x); return x; });
      })
      .catch(function () { items = []; })
      .then(function () { loading = null; if (document.activeElement === box) render(); });
    return loading;
  }
  /* names only: a question in words matches nothing here, so it just gets asked */
  function search(q) {
    var n = norm(q);
    if (n.length < 2 || n.split(' ').length > 5 || !items) return [];
    var want = WANT[scope];
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var x = items[i], s = 0;
      if (want && x.k !== want && !(want === 'company' && x.k === 'sector')) continue;
      if (x.nn === n) s = 120;
      else if (x.nn.indexOf(n) === 0) s = 100;
      else if ((' ' + x.nn).indexOf(' ' + n) >= 0) s = 80;
      else if (n.length >= 3 && x.nn.indexOf(n) >= 0) s = 60;
      else if (n.length >= 3 && x.nx && x.nx.indexOf(n) >= 0) s = 40;
      if (s) out.push({ x: x, s: s + (BOOST[x.k] || 0) - Math.min(x.n.length, 60) / 60 });
    }
    out.sort(function (a, b) { return b.s - a.s; });
    return out.slice(0, 5).map(function (o) { return o.x; });
  }
  function open(on) {
    list.hidden = !on;
    if (!on) { sel = -1; box.removeAttribute('aria-activedescendant'); }
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
    opts = [];
    open(false);
    if (!q) return;
    if (!items) { loadIndex(); return; }
    var found = search(q);
    if (!found.length) return;
    var h = el('li', 'h', T.go);
    h.setAttribute('role', 'presentation');
    list.appendChild(h);
    found.forEach(function (x, i) {
      var li = el('li');
      li.id = 'ck-o' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      var t = el('div', 't');
      t.appendChild(el('b', null, x.n));
      if (x.s) t.appendChild(el('span', null, x.s));
      li.appendChild(t);
      li.appendChild(el('span', 'k', T.kind[x.k] || ''));
      li.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep the focus in the box
      li.addEventListener('mousemove', function () { if (sel !== i) select(i); });
      li.addEventListener('click', function () { location.href = x.h; });
      list.appendChild(li);
      opts.push(x);
    });
    open(true);
  }
  box.addEventListener('focus', function () { loadIndex(); });
  box.addEventListener('input', function () { grow(); render(); });
  box.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== box) open(false); }, 120); });
  box.addEventListener('keydown', function (e) {
    var n = list.hidden ? 0 : opts.length;
    if (n && e.key === 'ArrowDown') { e.preventDefault(); select((sel + 1) % n); }
    else if (n && e.key === 'ArrowUp') { e.preventDefault(); select(sel <= 0 ? n - 1 : sel - 1); }
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); open(false); }
    else if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (n && sel >= 0 && opts[sel]) { location.href = opts[sel].h; return; }
      submit();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    var a = document.activeElement;
    if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)) return;
    e.preventDefault();
    box.focus();
  });

  /* ── answers ────────────────────────────────────────────────────────── */
  /* inline: **bold** and [text](/path); anything else stays text. A draft
     (words still coming) shows links as text: they are checked at the end. */
  function inline(parent, s, draft) {
    var re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g, last = 0, m;
    while ((m = re.exec(s))) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      if (m[1] != null) parent.appendChild(el('b', null, m[1]));
      else if (!draft && /^\/(?!\/)[^\s]*$/.test(m[3])) {
        var a = el('a', null, m[2]);
        a.href = m[3];
        parent.appendChild(a);
      } else parent.appendChild(document.createTextNode(m[2]));
      last = re.lastIndex;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }
  function md(text, draft) {
    var out = el('div', draft ? 'ck-an draft' : 'ck-an');
    var ul = null;
    var src = String(text || '').replace(/\r/g, '');
    if (draft) {
      /* half-written markup at the end shows as its words */
      src = src.replace(/\[([^\]\n]*)\]\([^)\s]*$/, '$1').replace(/\[([^\]\n]*)$/, '$1');
      if ((src.match(/\*\*/g) || []).length % 2) src = src.replace(/\*\*(?!.*\*\*)/, '');
    }
    var lastBlock = null;
    src.split('\n').forEach(function (line) {
      var t = line.trim();
      if (!t) { ul = null; return; }
      var li = /^[-*•]\s+(.*)$/.exec(t) || /^\d+[.)]\s+(.*)$/.exec(t);
      if (li) {
        if (!ul) { ul = el('ul'); out.appendChild(ul); }
        var x = el('li');
        inline(x, li[1], draft);
        ul.appendChild(x);
        lastBlock = x;
        return;
      }
      ul = null;
      var p = el('p');
      inline(p, t.replace(/^#+\s*/, ''), draft);
      out.appendChild(p);
      lastBlock = p;
    });
    if (draft) {
      if (!lastBlock) { lastBlock = el('p'); out.appendChild(lastBlock); }
      lastBlock.appendChild(el('span', 'ck-caret'));
    }
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
    var ul = el('ul', 'ck-en');
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
  function card(q, sc) {
    var c = el('article', 'ck-qa');
    var qq = el('p', 'ck-qq', q);
    if (sc && T.scope[sc]) qq.appendChild(el('span', null, T.scope[sc]));
    c.appendChild(qq);
    var st = el('ul', 'ck-st');
    c.appendChild(st);
    /* the working line: orb, the step being run, seconds so far; a note when slow */
    var wait = el('div', 'ck-an wait');
    var wk = el('div', 'ck-wk');
    var orb = el('span', 'ck-orb');
    orb.setAttribute('aria-hidden', 'true');
    orb.appendChild(el('i'));
    var wl = el('span', 'ck-wl', T.thinking);
    var tm = el('span', 'ck-tm');
    tm.setAttribute('aria-hidden', 'true');
    wk.appendChild(orb);
    wk.appendChild(wl);
    wk.appendChild(tm);
    var wn = el('p', 'ck-wn');
    wn.hidden = true;
    wait.appendChild(wk);
    wait.appendChild(wn);
    c.appendChild(wait);
    thread.insertBefore(c, thread.firstChild);
    if (head) head.hidden = false;
    if (recent) recent.hidden = true;
    return { c: c, st: st, wait: wait, body: wait, wl: wl, tm: tm, wn: wn };
  }
  /* the card's one answer slot: the waiting line, the words so far, or the answer */
  function setBody(v, node) {
    if (v.body === node) return;
    v.c.replaceChild(node, v.body);
    v.body = node;
  }
  function finish(v, ans) {
    setBody(v, md(ans.a));
    var e = entsList(ans.ents);
    if (e) v.c.appendChild(e);
    var line = (ans.asof ? T.from + dayOf(ans.asof) : '') + (ans.ms ? (ans.asof ? ' · ' : '') + (Math.round(ans.ms / 100) / 10) + T.sec : '');
    if (line) v.c.appendChild(el('p', 'ck-sr', line));
  }
  function calm(v, msg, link) {
    var p = el('div', 'ck-an calm');
    var t = el('p', null, msg + (link ? ' ' : ''));
    if (link) { var a = el('a', null, link.t); a.href = link.h; t.appendChild(a); }
    p.appendChild(t);
    setBody(v, p);
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
    if (goBtn) goBtn.disabled = on;
    showTries();
  }
  function askNow(q) {
    q = String(q || '').replace(/\s+/g, ' ').trim();
    if (!q || running) return;
    var mine = gen;
    var sc = scope;
    var v = card(q, sc);
    var r = v.c.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight - 80) v.c.scrollIntoView({ behavior: 'smooth', block: 'center' });
    busy(true);
    /* the step being run sits in the working line; done steps join the trail above it */
    var t0 = Date.now(), cur = null;
    function tick() {
      var s = Math.floor((Date.now() - t0) / 1000);
      v.tm.textContent = s < 60 ? s + T.sec : Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
      var note = cur && cur.tool === 'get_contact' && Date.now() - cur.at > 6000 ? T.slowContact : (s >= 20 ? T.slow : '');
      if (note && v.wn.textContent !== note) v.wn.textContent = note;
      v.wn.hidden = !note;
    }
    tick();
    var ticker = setInterval(tick, 1000);
    function step(label, tool) {
      if (cur) v.st.appendChild(el('li', null, cur.label));
      cur = { label: label, tool: tool, at: Date.now() };
      v.wl.textContent = label;
      tick();
    }
    function stopSteps() {
      if (cur) { v.st.appendChild(el('li', null, cur.label)); cur = null; }
    }
    function stopAll() { stopSteps(); clearInterval(ticker); }
    /* the words as they come, drawn at most once a frame */
    var words = '', wordsTurn = -1, frame = 0;
    function draw() {
      frame = 0;
      if (words) setBody(v, md(words, true));
    }
    function delta(d, n) {
      if (n !== wordsTurn) { words = ''; wordsTurn = n; }
      words += d;
      stopSteps();
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function dropWords() {
      words = '';
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      setBody(v, v.wait);
    }
    post('/api/me/ask', { q: q, lang: LANG, scope: sc, stream: true, history: history(), chat: chatId }).then(function (res) {
      if (res.status === 401) { stopAll(); calm(v, T.signin, { t: T.signinGo, h: PF + '/signin?next=' + encodeURIComponent(PF + '/me') }); return; }
      if (!res.ok || !res.body) {
        stopAll();
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
        if (o.t === 'step') { dropWords(); step(o.label || o.tool || '', o.tool); }
        else if (o.t === 'delta') { if (typeof o.d === 'string') delta(o.d, o.n); }
        else if (o.t === 'answer') {
          done = true;
          stopAll();
          if (frame) { cancelAnimationFrame(frame); frame = 0; }
          var ans = { q: q, sc: sc, a: String(o.answer || ''), ents: o.entities || [], asof: o.asof || '', ms: o.ms || 0 };
          finish(v, ans);
          if (mine === gen) {
            past.push(ans);
            if (o.chat > 0) { chatId = o.chat; loadChats(); }
            save();
          }
        } else if (o.t === 'fail') {
          done = true;
          stopAll();
          if (frame) { cancelAnimationFrame(frame); frame = 0; }
          calm(v, o.reason === 'busy' ? T.busy : T.pause);
        }
      }
      function pump() {
        return rd.read().then(function (x) {
          if (x.done) { if (buf) line(buf); if (!done) { stopAll(); if (frame) { cancelAnimationFrame(frame); frame = 0; } calm(v, T.pause); } return; }
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i)); buf = buf.slice(i + 1); }
          return pump();
        });
      }
      return pump();
    }).catch(function () {
      stopAll();
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      if (v.body === v.wait || (v.body && /\bdraft\b/.test(v.body.className))) calm(v, T.pause);
    })
      .then(function () { busy(false); });
  }
  function submit() {
    var q = box.value;
    if (!q.trim() || running) return;
    box.value = '';
    grow();
    open(false);
    askNow(q);
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  tries.forEach(function (t) {
    t.addEventListener('click', function (e) {
      var b = e.target.closest('.ck-x');
      if (b) askNow(b.getAttribute('data-q'));
    });
  });
  var newBtn = document.getElementById('ck-new');
  if (newBtn) newBtn.addEventListener('click', function () {
    gen += 1;
    past = [];
    chatId = null;
    thread.textContent = '';
    if (head) head.hidden = true;
    busy(false);
    save();
    drawChats();
    box.focus();
  });

  /* ── history: Recent chats under the box, and the History sheet ─────── */
  var hs = document.getElementById('ck-hs');
  var recent = document.getElementById('ck-rc');
  var recentList = document.getElementById('ck-rl');
  var hl = document.getElementById('ck-hl');
  var he = document.getElementById('ck-he');
  var chats = null;
  function loadChats() {
    if (!hs) return;
    fetch('/api/me/chats', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) { chats = j && j.ok && Array.isArray(j.chats) ? j.chats : []; })
      .catch(function () { chats = chats || []; })
      .then(drawChats);
  }
  function chatRow(c, withDel) {
    var li = el('li');
    var b = el('button', 'ck-ch');
    b.type = 'button';
    b.appendChild(el('b', null, c.title));
    var when = dayOf(String(c.at || '').replace(' ', 'T') + 'Z');
    b.appendChild(el('span', null, (when ? when + ' · ' : '') + T.qs(c.n || 1) + (c.sc && T.scope[c.sc] ? ' · ' + T.scope[c.sc] : '')));
    if (c.id === chatId) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', function () { openChat(c.id); });
    li.appendChild(b);
    if (withDel) {
      var d = el('button', 'ck-del', T.del);
      d.type = 'button';
      var timer = 0;
      /* one click arms it, the second deletes: no dialog on top of the sheet */
      d.addEventListener('click', function () {
        if (!d.hasAttribute('data-armed')) {
          d.setAttribute('data-armed', '');
          d.textContent = T.sure;
          timer = setTimeout(function () { d.removeAttribute('data-armed'); d.textContent = T.del; }, 4000);
          return;
        }
        clearTimeout(timer);
        d.disabled = true;
        post('/api/me/chats/' + c.id + '/delete', {}).then(function (r) { return r.json(); }).then(function (j) {
          if (!j || !j.ok) throw new Error('gone');
          chats = (chats || []).filter(function (x) { return x.id !== c.id; });
          if (c.id === chatId) { chatId = null; save(); }
          drawChats();
        }).catch(function () { d.disabled = false; d.removeAttribute('data-armed'); d.textContent = T.del; });
      });
      li.appendChild(d);
    }
    return li;
  }
  function drawChats() {
    if (!hs || !chats) return;
    if (recentList) {
      recentList.textContent = '';
      chats.slice(0, 5).forEach(function (c) { recentList.appendChild(chatRow(c, false)); });
    }
    if (recent) recent.hidden = !chats.length || past.length > 0 || running;
    if (hl) {
      hl.textContent = '';
      chats.forEach(function (c) { hl.appendChild(chatRow(c, true)); });
    }
    if (he) he.hidden = chats.length > 0;
  }
  function openChat(id) {
    if (running) return;
    fetch('/api/me/chats/' + id, { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok || !j.chat) throw new Error('gone');
        gen += 1;
        chatId = j.chat.id;
        past = (j.chat.turns || []).map(function (t) { return { q: t.q, sc: t.sc, a: t.a, ents: t.ents || [], asof: t.asof, ms: t.ms }; });
        thread.textContent = '';
        past.forEach(function (x) { finish(card(x.q, x.sc), x); });
        if (past.length) setScope(past[past.length - 1].sc || '');
        if (head) head.hidden = !past.length;
        save();
        showTries();
        drawChats();
        if (hs.open) hs.close();
        if (head && !head.hidden) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function () {
        if (chatId === id) { chatId = null; save(); }
        loadChats();
      });
  }
  if (hs) {
    [].slice.call(document.querySelectorAll('[data-hs]')).forEach(function (b) {
      b.addEventListener('click', function () {
        loadChats();
        if (typeof hs.showModal === 'function') hs.showModal();
        else hs.setAttribute('open', '');
      });
    });
    hs.addEventListener('click', function (e) { if (e.target === hs) hs.close(); });
  }

  /* ── People: the lead agent, coming soon ────────────────────────────── */
  var dlg = document.getElementById('ck-ld');
  var people = form.querySelector('[data-people]');
  if (dlg && people) {
    var early = dlg.querySelector('[data-early]');
    var ok = dlg.querySelector('[data-ok]');
    var okText = ok ? ok.textContent : '';
    people.addEventListener('click', function () {
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    if (early) early.addEventListener('click', function () {
      if (early.getAttribute('aria-pressed') === 'true') return;
      early.disabled = true;
      post('/api/me/lead', {}).then(function (r) {
        if (!r.ok) throw new Error('save');
        early.setAttribute('aria-pressed', 'true');
        early.textContent = T.onList;
        if (ok) { ok.textContent = okText; ok.hidden = false; }
      }).catch(function () {
        if (ok) { ok.textContent = T.notSaved; ok.hidden = false; }
      }).then(function () { early.disabled = false; });
    });
  }

  /* ── start ──────────────────────────────────────────────────────────── */
  setScope(scope);
  past.forEach(function (x) { finish(card(x.q, x.sc), x); });
  showTries();
  /* the tab's copy paints first; with history on the server's copy of the open chat replaces it */
  if (hs) { loadChats(); if (chatId) openChat(chatId); }
  if (window.matchMedia && window.matchMedia('(pointer: fine)').matches) {
    try { box.focus({ preventScroll: true }); } catch (e) { box.focus(); }
  }
})();
