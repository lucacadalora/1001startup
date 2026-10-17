/* 1001startup.id — client-side filter + sort + pagination over the server-
   rendered company table. Six independent filters, ANDed: free text, one
   sector chip, YC-only, Endeavor-only, funded-only, valuation-only. The filtered
   set is sorted, and the sorted set is paged, so all three compose: search
   always runs across every row and a sort always orders the whole result,
   never just the visible page.
   Lives in a file because the CSP is script-src 'self' — an inline <script>
   here is silently dropped. */
(function () {
  /* the server stamps <html lang> — the handful of strings this script writes
     (count, pager) follow it so the /id pages stay Indonesian end to end */
  var IDL = document.documentElement.lang === 'id';
  var T = IDL
    ? { shown: ' ditampilkan', prev: '‹ Sebelumnya', prevA: 'Halaman sebelumnya', next: 'Berikutnya ›', nextA: 'Halaman berikutnya', all: 'Semua', allA: 'Tampilkan semua baris di satu halaman', page: 'Halaman ', of: ' dari ' }
    : { shown: ' shown', prev: '‹ Prev', prevA: 'Previous page', next: 'Next ›', nextA: 'Next page', all: 'All', allA: 'Show all rows on one page', page: 'Page ', of: ' of ' };
  var q = document.getElementById('q'), tbl = document.getElementById('tbl'),
    count = document.getElementById('count'), chips = document.getElementById('chips'),
    ycBtn = document.getElementById('ycOnly'), edBtn = document.getElementById('edOnly'),
    anBtn = document.getElementById('anOnly'),
    fuBtn = document.getElementById('fundedOnly'), vaBtn = document.getElementById('valOnly'),
    pager = document.getElementById('pager'), anchor = document.getElementById('companies');
  if (!q || !tbl) return;
  var body = tbl.tBodies[0];
  var rows = [].slice.call(body.rows), sec = '', ycOnly = false, edOnly = false, anOnly = false, fundedOnly = false, valOnly = false;
  var PER = 50, page = 1, showAll = false, matched = rows;
  var sortI = 0, sortDir = 1;      // column index, 1 = ascending (rank order = the census's own ranking)

  /* Sort keys come from data-v written by the server, never from cell text:
     the cells carry thousands separators, an em-dash for "no figure" and an
     "est" chip, none of which parse. An empty data-v means no figure and sorts
     LAST in both directions — a dash is not a zero. */
  function cellVal(r, i, numeric) {
    var v = r.cells[i].getAttribute('data-v');
    if (numeric) return v === '' || v === null ? null : parseFloat(v);
    return v === null ? '' : v;
  }

  function sortRows() {
    var th = tbl.tHead.rows[0].cells[sortI], numeric = th.dataset.t === 'num';
    var rankOf = function (r) { return parseFloat(r.cells[0].getAttribute('data-v')) || 0; };
    rows.sort(function (a, b) {
      var av = cellVal(a, sortI, numeric), bv = cellVal(b, sortI, numeric), c;
      if (numeric) {
        if (av === null && bv === null) c = 0;
        else if (av === null) return 1;        // nulls last, whichever direction
        else if (bv === null) return -1;
        else c = av - bv;
      } else {
        c = av < bv ? -1 : av > bv ? 1 : 0;
      }
      return c ? c * sortDir : rankOf(a) - rankOf(b);   // ties keep census rank
    });
    var frag = document.createDocumentFragment();
    rows.forEach(function (r) { frag.appendChild(r); });
    body.appendChild(frag);
    [].forEach.call(tbl.tHead.rows[0].cells, function (h, i) {
      if (i === sortI) h.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
      else h.removeAttribute('aria-sort');
    });
  }

  function draw() {
    /* page count always follows PER, even while All is on, so the numbered
       buttons stay available — clicking one drops back out of All */
    var pages = Math.max(1, Math.ceil(matched.length / PER));
    if (page > pages) page = pages;
    var from = showAll ? 0 : (page - 1) * PER,
      to = showAll ? matched.length : from + PER;
    var on = new Set();
    for (var i = from; i < to && i < matched.length; i++) on.add(matched[i]);
    rows.forEach(function (r) { r.style.display = on.has(r) ? '' : 'none'; });
    count.textContent = matched.length + T.shown;
    drawPager(pages, from, Math.min(to, matched.length));
  }

  /* Compact page list: first, last, and a window around the current page, with
     an ellipsis where numbers are skipped — so 6 pages show as 6 buttons and
     40 pages never overflow the row. */
  function pageList(pages) {
    var out = [], i;
    if (pages <= 9) { for (i = 1; i <= pages; i++) out.push(i); return out; }
    var lo = Math.max(2, page - 2), hi = Math.min(pages - 1, page + 2);
    out.push(1);
    if (lo > 2) out.push('gap');
    for (i = lo; i <= hi; i++) out.push(i);
    if (hi < pages - 1) out.push('gap');
    out.push(pages);
    return out;
  }

  function btn(label, opts) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (opts.disabled) b.disabled = true;
    if (opts.current) b.setAttribute('aria-current', 'page');
    if (opts.label) b.setAttribute('aria-label', opts.label);
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    return b;
  }

  function go(n, keepScroll) {
    page = n; showAll = false; draw();
    /* land on the toolbar, not the page top: the reader keeps the search box
       and the column headers in view instead of hunting for them */
    if (!keepScroll && anchor) anchor.scrollIntoView({ block: 'start' });
  }

  function drawPager(pages, from, to) {
    if (!pager) return;
    pager.textContent = '';
    if (matched.length <= PER) { pager.hidden = true; return; }
    pager.hidden = false;
    pager.appendChild(btn(T.prev, {
      disabled: showAll || page === 1, label: T.prevA,
      onClick: function () { go(page - 1); },
    }));
    pageList(pages).forEach(function (n) {
      if (n === 'gap') {
        var g = document.createElement('span');
        g.className = 'gap'; g.textContent = '…';
        pager.appendChild(g);
        return;
      }
      pager.appendChild(btn(String(n), {
        current: !showAll && n === page,
        label: T.page + n,
        onClick: function () { go(n); },
      }));
    });
    pager.appendChild(btn(T.next, {
      disabled: showAll || page === pages, label: T.nextA,
      onClick: function () { go(page + 1); },
    }));
    pager.appendChild(btn(T.all, {
      current: showAll, label: T.allA,
      onClick: function () { showAll = !showAll; page = 1; draw(); if (anchor) anchor.scrollIntoView({ block: 'start' }); },
    }));
    var r = document.createElement('span');
    r.className = 'range';
    r.textContent = (from + 1) + '–' + to + T.of + matched.length;
    pager.appendChild(r);
  }

  function apply() {
    var t = q.value.trim().toLowerCase();
    matched = rows.filter(function (r) {
      return (!t || r.dataset.f.indexOf(t) > -1)
        && (!sec || r.dataset.s === sec)
        && (!ycOnly || r.dataset.yc === '1')
        && (!edOnly || r.dataset.ed === '1')
        && (!anOnly || r.dataset.an === '1')
        && (!fundedOnly || r.dataset.fu === '1')
        && (!valOnly || r.dataset.va === '1');
    });
    page = 1;               // a new filter result always starts at its first page
    draw();
  }

  /* Header click sorts the whole filtered set. First click on a numeric column
     goes descending (biggest first is what anyone wants from Funding or Jobs);
     text columns start ascending. Clicking the active column flips it. */
  if (tbl.tHead) tbl.tHead.addEventListener('click', function (e) {
    var th = e.target.closest('th.s'); if (!th) return;
    var i = +th.dataset.i;
    if (i === sortI) sortDir = -sortDir;
    else { sortI = i; sortDir = th.dataset.t === 'num' && i !== 0 ? -1 : 1; }
    sortRows();
    apply();      // re-derive the filtered set in the new order, back to page 1
  });

  q.addEventListener('input', apply);
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    chips.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on'); sec = b.dataset.s; apply();
  });
  if (ycBtn) ycBtn.addEventListener('click', function () {
    ycOnly = !ycOnly;
    ycBtn.setAttribute('aria-pressed', ycOnly ? 'true' : 'false');
    apply();
  });
  if (edBtn) edBtn.addEventListener('click', function () {
    edOnly = !edOnly;
    edBtn.setAttribute('aria-pressed', edOnly ? 'true' : 'false');
    apply();
  });
  if (anBtn) anBtn.addEventListener('click', function () {
    anOnly = !anOnly;
    anBtn.setAttribute('aria-pressed', anOnly ? 'true' : 'false');
    apply();
  });
  if (fuBtn) fuBtn.addEventListener('click', function () {
    fundedOnly = !fundedOnly;
    fuBtn.setAttribute('aria-pressed', fundedOnly ? 'true' : 'false');
    apply();
  });
  /* the rows behind the combined-valuation figure in the stat strip */
  if (vaBtn) vaBtn.addEventListener('click', function () {
    valOnly = !valOnly;
    vaBtn.setAttribute('aria-pressed', valOnly ? 'true' : 'false');
    apply();
  });
  /* ?q= from the 1001startup.id front-page search box (and its no-JS form)
     fills the search before the first draw */
  var qp0 = new URLSearchParams(location.search).get('q');
  if (qp0) q.value = qp0;
  apply();
  if (qp0 && anchor) anchor.scrollIntoView({ block: 'start' });
})();

/* ── mark explanations ───────────────────────────────────────────────────────
   The est / in parent / trk chips and the em-dash for a company that raised
   without disclosing all carry their note in data-n. One shared panel opens it
   on hover, on keyboard focus and on tap. Hover alone was never enough: a
   phone has no hover at all, and the working behind tiket.com's estimate is a
   thousand characters that a native title= renders as one truncated line. */
(function () {
  var panel = document.getElementById('note');
  if (!panel) return;
  var kEl = panel.querySelector('.nk'), bEl = panel.querySelector('.nb'),
    mEl = panel.querySelector('.nm'), lEl = panel.querySelector('.nl'),
    xEl = panel.querySelector('.nx');
  var cur = null, pinned = false, tmr = 0, raf = 0, viaPointer = false, pt = 0;
  var sheet = function () { return window.matchMedia('(max-width:640px)').matches; };

  /* Shared note fragments, emitted ONCE per page as a JSON island. A mark
     payload references them instead of carrying its own copy of prose that is
     identical on hundreds of rows: "~key" is a whole-string lookup, `sf` a
     fragment appended to the body, `lf` a standing link set, and `lc` means
     "add this row's own company link", read off the row so the href and the
     company name never have to travel in the payload at all.
     Every field still works as a plain string when no dictionary is present,
     so any other page using this panel is unaffected. */
  var FRAG = {}, LSET = {};
  try {
    var island = document.getElementById('note-frag');
    if (island) { var j = JSON.parse(island.textContent); FRAG = j.f || {}; LSET = j.l || {}; }
  } catch (e) { /* a missing dictionary must degrade, never throw */ }
  /* The sentinel must not be able to collide with prose: census notes very
     often open with "~300 employees" meaning ABOUT 300, and a bare charAt(0)
     test swallowed those whole (Aruna's headcount panel rendered empty).
     A reference is a short bare key and nothing else, and an unknown key
     falls back to the literal string rather than to nothing at all. */
  function deref(v) {
    if (typeof v !== 'string') return '';
    var m = /^~([a-z][a-z0-9]{1,7})$/.exec(v);
    return m ? (FRAG[m[1]] || v) : v;
  }

  function fill(d, el) {
    panel.setAttribute('data-k', d.k || '');
    kEl.textContent = deref(d.t);
    var body = deref(d.b);
    if (d.sf && FRAG[d.sf]) body = body ? body + ' ' + FRAG[d.sf] : FRAG[d.sf];
    bEl.textContent = body;
    var meta = deref(d.m);
    mEl.textContent = meta; mEl.hidden = !meta;
    lEl.textContent = '';
    var links = (d.l || []).slice();
    if (d.lf && LSET[d.lf]) links = links.concat(LSET[d.lf]);
    if (d.lc && el && el.closest) {
      var row = el.closest('tr');
      var cp = row && row.querySelector('a.cp-link');
      if (cp) links.push({ h: cp.getAttribute('href'), t: (FRAG.cpre || '') + cp.textContent + ' \u2192' });
    }
    links.forEach(function (x) {
      if (!x || !x.h) return;
      var a = document.createElement('a');
      a.href = x.h;
      a.textContent = x.t || x.h;
      if (/^https?:/i.test(x.h)) { a.target = '_blank'; a.rel = 'noopener'; }
      lEl.appendChild(a);
    });
    lEl.hidden = !lEl.firstChild;
  }

  /* Fixed positioning read off the mark itself, so the table's overflow-x
     scroller never clips the panel. Flips above the row when the bottom of the
     viewport is closer than the panel is tall. */
  function place() {
    if (!cur) return;
    if (sheet()) return;                       // the sheet is pinned to the bottom edge by CSS
    var r = cur.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) { close(); return; }
    var w = panel.offsetWidth, h = panel.offsetHeight;
    var left = Math.min(Math.max(10, r.left + r.width / 2 - w / 2), window.innerWidth - w - 10);
    var top = r.bottom + 8;
    if (top + h > window.innerHeight - 10) top = Math.max(10, r.top - h - 8);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function open(el, pin) {
    var d;
    try { d = JSON.parse(el.getAttribute('data-n')); } catch (e) { return; }
    if (cur && cur !== el) unmark(cur);
    cur = el; pinned = !!pin;
    fill(d, el);
    panel.hidden = false;
    panel.classList.toggle('pin', pinned || sheet());
    if (el.tagName === 'BUTTON') el.setAttribute('aria-expanded', 'true');
    el.setAttribute('aria-describedby', 'note');
    place();
  }

  function unmark(el) {
    if (el.tagName === 'BUTTON') el.setAttribute('aria-expanded', 'false');
    el.removeAttribute('aria-describedby');
  }

  function close() {
    clearTimeout(tmr);
    if (!cur) return;
    unmark(cur);
    cur = null; pinned = false;
    panel.hidden = true;
    panel.classList.remove('pin');
  }

  function markAt(t) { return t && t.closest ? t.closest('[data-n]') : null; }

  /* One mouseover on the document covers both directions: entering a mark
     opens it, and entering anything else starts the grace timer — so the
     pointer can travel across the gap into the panel without it vanishing. */
  document.addEventListener('mouseover', function (e) {
    if (sheet()) return;
    if (panel.contains(e.target)) { clearTimeout(tmr); return; }
    var el = markAt(e.target);
    if (el) { clearTimeout(tmr); if (el !== cur) open(el, false); return; }
    if (cur && !pinned) { clearTimeout(tmr); tmr = setTimeout(close, 160); }
  });
  document.documentElement.addEventListener('mouseleave', function () {
    if (cur && !pinned) close();
  });

  /* Tab focus opens the panel pinned so it survives tabbing into its links.
     A click focuses the button first in most browsers, so the pointer flag
     keeps focusin from opening what the click handler is about to toggle. */
  document.addEventListener('pointerdown', function () {
    viaPointer = true; clearTimeout(pt); pt = setTimeout(function () { viaPointer = false; }, 500);
  }, true);
  document.addEventListener('focusin', function (e) {
    if (viaPointer) return;
    var el = markAt(e.target);
    if (el) open(el, true);
    else if (!panel.contains(e.target)) close();
  });

  /* Capture, because the whole row is a click target that opens the company
     drawer (company1001.js listens on the tbody, which would fire first). A
     mark explains the figure it sits on; it must not also open a profile. */
  document.addEventListener('click', function (e) {
    var el = markAt(e.target);
    if (!el || el.tagName === 'A') return;     // a source link navigates; the note showed on hover
    e.preventDefault();
    e.stopPropagation();
    viaPointer = false;
    if (cur === el && pinned) close();
    else open(el, true);
  }, true);

  document.addEventListener('click', function (e) {
    viaPointer = false;
    if (panel.contains(e.target)) return;      // links inside the panel keep working
    close();                                   // a chip, a page button or a header also dismisses
  });

  if (xEl) xEl.addEventListener('click', function () {
    var el = cur; close(); if (el && el.focus) el.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !cur) return;
    var el = cur; close(); if (el.focus) el.focus();
  }, true);

  /* capture:true so a scroll inside .tablewrap moves the panel too */
  window.addEventListener('scroll', function () {
    if (!cur) return;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(place);
  }, { passive: true, capture: true });
  window.addEventListener('resize', function () { if (cur) place(); });
  var qBox = document.getElementById('q');      // filtering can hide the row the panel points at
  if (qBox) qBox.addEventListener('input', close);
})();

/* ── the map embed's shield: scrolling past the landing must stay scrolling,
   so the iframe only gets the pointer after a deliberate click. With JS off
   the shield is a plain link to the full map page. ── */
(function () {
  'use strict';
  var sh = document.getElementById('mapshield');
  if (!sh) return;
  sh.addEventListener('click', function (e) {
    e.preventDefault();
    sh.classList.add('off');
  });
})();
