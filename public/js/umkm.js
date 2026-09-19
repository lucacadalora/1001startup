/* 1001umkm.id — client-side filter + sort + pagination over the server-
   rendered exporter table. Five independent filters, ANDed: free text, one
   sector chip, one verification-tier chip, a province select, direct-contact-
   only. The filtered set is sorted, the sorted set is paged — search always
   runs across every row and a sort orders the whole result, never just the
   visible page. Same mechanics as 1001startup.id's table (proven there);
   lives in a file because the CSP is script-src 'self'.

   Search haystack: the row's own visible text (name, sector, location,
   products, markets, contact) PLUS data-f extras (industry, certs) — cached
   per row at init so typing never re-reads the DOM. */
(function () {
  var q = document.getElementById('q'), tbl = document.getElementById('tbl'),
    count = document.getElementById('count'), chips = document.getElementById('chips'),
    prov = document.getElementById('prov'), coBtn = document.getElementById('contactOnly'),
    pager = document.getElementById('pager'), anchor = document.getElementById('exporters');
  if (!q || !tbl) return;
  var body = tbl.tBodies[0];
  var rows = [].slice.call(body.rows), sec = '', tier = '', pv = '', contactOnly = false;
  var PER = 50, page = 1, showAll = false, matched = rows;
  var sortI = 0, sortDir = 1;      // column index, 1 = ascending (rank order = the census's own ranking)

  rows.forEach(function (r) {
    r._hay = (r.textContent + ' ' + (r.dataset.f || '')).toLowerCase();
  });

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
    var pages = Math.max(1, Math.ceil(matched.length / PER));
    if (page > pages) page = pages;
    var from = showAll ? 0 : (page - 1) * PER,
      to = showAll ? matched.length : from + PER;
    var on = new Set();
    for (var i = from; i < to && i < matched.length; i++) on.add(matched[i]);
    rows.forEach(function (r) { r.style.display = on.has(r) ? '' : 'none'; });
    count.textContent = matched.length + ' shown';
    drawPager(pages, from, Math.min(to, matched.length));
  }

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
    if (!keepScroll && anchor) anchor.scrollIntoView({ block: 'start' });
  }

  function drawPager(pages, from, to) {
    if (!pager) return;
    pager.textContent = '';
    if (matched.length <= PER) { pager.hidden = true; return; }
    pager.hidden = false;
    pager.appendChild(btn('‹ Prev', {
      disabled: showAll || page === 1, label: 'Previous page',
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
        label: 'Page ' + n,
        onClick: function () { go(n); },
      }));
    });
    pager.appendChild(btn('Next ›', {
      disabled: showAll || page === pages, label: 'Next page',
      onClick: function () { go(page + 1); },
    }));
    pager.appendChild(btn('All', {
      current: showAll, label: 'Show all rows on one page',
      onClick: function () { showAll = !showAll; page = 1; draw(); if (anchor) anchor.scrollIntoView({ block: 'start' }); },
    }));
    var r = document.createElement('span');
    r.className = 'range';
    r.textContent = (from + 1) + '–' + to + ' of ' + matched.length;
    pager.appendChild(r);
  }

  function apply() {
    /* tokenized AND match: a buyer types "teak furniture bali" and every word
       must hit somewhere in the row — a single-substring match would return
       zero for any natural product query */
    var toks = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    matched = rows.filter(function (r) {
      var hit = true;
      for (var i = 0; i < toks.length; i++) if (r._hay.indexOf(toks[i]) < 0) { hit = false; break; }
      return hit
        && (!sec || r.dataset.s === sec)
        && (!tier || r.dataset.t === tier)
        && (!pv || r.dataset.p === pv)
        && (!contactOnly || r.dataset.c === '1');
    });
    page = 1;
    draw();
  }

  if (tbl.tHead) tbl.tHead.addEventListener('click', function (e) {
    var th = e.target.closest('th.s'); if (!th) return;
    var i = +th.dataset.i;
    if (i === sortI) sortDir = -sortDir;
    else { sortI = i; sortDir = th.dataset.t === 'num' && i !== 0 ? -1 : 1; }
    sortRows();
    apply();
  });

  q.addEventListener('input', apply);
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    chips.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on'); sec = b.dataset.s; apply();
  });
  /* tier chips: one row of five, single-select, click the active one to clear */
  document.querySelectorAll('.tchip').forEach(function (b) {
    b.addEventListener('click', function () {
      var was = b.getAttribute('aria-pressed') === 'true';
      document.querySelectorAll('.tchip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      tier = was ? '' : b.dataset.t;
      if (!was) b.setAttribute('aria-pressed', 'true');
      apply();
    });
  });
  if (prov) prov.addEventListener('change', function () { pv = prov.value; apply(); });
  if (coBtn) coBtn.addEventListener('click', function () {
    contactOnly = !contactOnly;
    coBtn.setAttribute('aria-pressed', contactOnly ? 'true' : 'false');
    apply();
  });

  /* the sector grid below the table filters it: find the matching chip, click
     it, land on the toolbar */
  document.querySelectorAll('.sct').forEach(function (tile) {
    tile.addEventListener('click', function () {
      var target = tile.dataset.s;
      var chip = null;
      chips.querySelectorAll('.chip').forEach(function (x) { if (x.dataset.s === target) chip = x; });
      if (!chip) return;
      chips.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
      chip.classList.add('on'); sec = target; apply();
      if (anchor) anchor.scrollIntoView({ block: 'start' });
    });
  });

  apply();
})();

/* ── mark explanations ───────────────────────────────────────────────────────
   The verification badges carry their note in data-n. One shared panel opens
   it on hover, on keyboard focus and on tap — same module as the census's
   est/trk marks (a native title= does not exist on a phone at all). */
(function () {
  var panel = document.getElementById('note');
  if (!panel) return;
  var kEl = panel.querySelector('.nk'), bEl = panel.querySelector('.nb'),
    mEl = panel.querySelector('.nm'), lEl = panel.querySelector('.nl'),
    xEl = panel.querySelector('.nx');
  var cur = null, pinned = false, tmr = 0, raf = 0, viaPointer = false, pt = 0;
  var sheet = function () { return window.matchMedia('(max-width:640px)').matches; };

  function fill(d) {
    panel.setAttribute('data-k', d.k || '');
    kEl.textContent = d.t || '';
    bEl.textContent = d.b || '';
    mEl.textContent = d.m || ''; mEl.hidden = !d.m;
    lEl.textContent = '';
    (d.l || []).forEach(function (x) {
      if (!x || !x.h) return;
      var a = document.createElement('a');
      a.href = x.h;
      a.textContent = x.t || x.h;
      if (/^https?:/i.test(x.h)) { a.target = '_blank'; a.rel = 'noopener'; }
      lEl.appendChild(a);
    });
    lEl.hidden = !lEl.firstChild;
  }

  function place() {
    if (!cur) return;
    if (sheet()) return;
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
    fill(d);
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

  document.addEventListener('pointerdown', function () {
    viaPointer = true; clearTimeout(pt); pt = setTimeout(function () { viaPointer = false; }, 500);
  }, true);
  document.addEventListener('focusin', function (e) {
    if (viaPointer) return;
    var el = markAt(e.target);
    if (el) open(el, true);
    else if (!panel.contains(e.target)) close();
  });

  /* Capture, because the whole row is a click target that opens the exporter
     drawer (company1001.js listens on the tbody, which would fire first). A
     badge explains the row it sits on; it must not also open a profile. */
  document.addEventListener('click', function (e) {
    var el = markAt(e.target);
    if (!el || el.tagName === 'A') return;
    e.preventDefault();
    e.stopPropagation();
    viaPointer = false;
    if (cur === el && pinned) close();
    else open(el, true);
  }, true);

  document.addEventListener('click', function (e) {
    viaPointer = false;
    if (panel.contains(e.target)) return;
    close();
  });

  if (xEl) xEl.addEventListener('click', function () {
    var el = cur; close(); if (el && el.focus) el.focus();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !cur) return;
    var el = cur; close(); if (el.focus) el.focus();
  }, true);

  window.addEventListener('scroll', function () {
    if (!cur) return;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(place);
  }, { passive: true, capture: true });
  window.addEventListener('resize', function () { if (cur) place(); });
  var qBox = document.getElementById('q');
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
