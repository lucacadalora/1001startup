/* /bumn — the BUMN logo quadrant, its company cards and the score table.
   Data: the #bm-data JSON block written by views/bumn1001.js (data/bumn.json).
   Every data-derived string goes in through textContent. */
(function () {
  'use strict';
  var node = document.getElementById('bm-data');
  if (!node) return;
  var D = JSON.parse(node.textContent);
  var E = D.entities, N = E.length, DIMS = D.dims, ORDER = D.dimOrder, PRESETS = D.presets;
  var $ = function (s) { return document.querySelector(s); };
  function el(tag, attrs) {
    var n = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    });
    kids.forEach(function (c) { if (c != null) n.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return n;
  }
  var fmt = function (v, d) { return v == null ? '—' : Number(v).toFixed(d == null ? 1 : d); };
  var host = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  var rk = function (e, k) { return e.ranks[k] ? '#' + e.ranks[k] + (e.tied && e.tied[k] ? '=' : '') : ''; };
  var state = { x: PRESETS[0].x, y: PRESETS[0].y, preset: 0, cluster: 'all', pinned: null };

  /* controls */
  var pBox = $('#bm-presets');
  PRESETS.forEach(function (p, i) {
    pBox.append(el('button', { class: 'chip', type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', 'data-i': i,
      onclick: function () { state.preset = i; state.x = p.x; state.y = p.y; sync(); draw(); } }, p.name));
  });
  var sx = $('#bm-x'), sy = $('#bm-y');
  ORDER.forEach(function (k) { sx.append(el('option', { value: k, text: DIMS[k].label })); sy.append(el('option', { value: k, text: DIMS[k].label })); });
  function pick() { state.preset = PRESETS.findIndex(function (p) { return p.x === state.x && p.y === state.y; }); sync(); draw(); }
  sx.addEventListener('change', function () { state.x = sx.value; pick(); });
  sy.addEventListener('change', function () { state.y = sy.value; pick(); });
  var cBox = $('#bm-clusters');
  [['all', 'All', N]].concat(D.clusters.map(function (c) { return [c.key, c.label, E.filter(function (e) { return e.cluster === c.key; }).length]; }))
    .forEach(function (c) {
      cBox.append(el('button', { class: 'chip', type: 'button', 'aria-pressed': c[0] === 'all' ? 'true' : 'false', 'data-k': c[0],
        onclick: function () { state.cluster = c[0]; Array.prototype.forEach.call(cBox.children, function (b) { b.setAttribute('aria-pressed', b.dataset.k === c[0] ? 'true' : 'false'); }); dim(); } },
        c[1], el('b', { text: String(c[2]) })));
    });
  function sync() {
    sx.value = state.x; sy.value = state.y;
    Array.prototype.forEach.call(pBox.children, function (b) { b.setAttribute('aria-pressed', Number(b.dataset.i) === state.preset ? 'true' : 'false'); });
  }
  sync();

  /* the field */
  var field = $('#bm-field'), grid = $('#bm-grid'), bl = $('#bm-badges'), ll = $('#bm-labs'), card = $('#bm-card');
  var badges = {};
  E.forEach(function (e) {
    var b = el('button', { class: 'bm-b', type: 'button', 'aria-label': e.name,
      onmouseenter: function () { if (!state.pinned) show(e, false); }, onmouseleave: function () { if (!state.pinned) hide(); },
      onfocus: function () { show(e, false); }, onblur: function () { if (!state.pinned) hide(); },
      onclick: function (ev) { ev.stopPropagation(); state.pinned = state.pinned === e.slug ? null : e.slug; if (state.pinned) show(e, true); else hide(); } },
      el('img', { src: e.logo, alt: '', width: '56', height: '56', decoding: 'async' }));
    badges[e.slug] = b; bl.append(b);
  });
  document.addEventListener('click', function (ev) { if (state.pinned && !card.contains(ev.target)) { state.pinned = null; hide(); } });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { state.pinned = null; hide(); } });
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, a) { var n = document.createElementNS(NS, tag); Object.keys(a).forEach(function (k) { n.setAttribute(k, a[k]); }); return n; }
  function median(a) { var s = a.slice().sort(function (p, q) { return p - q; }), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }

  function draw() {
    var W = field.clientWidth, H = field.clientHeight, narrow = W < 640;
    var d = narrow ? 34 : (W < 900 ? 40 : 46);
    var padL = narrow ? 34 : 46, padR = d / 2 + 12, padT = d / 2 + 30, padB = narrow ? 52 : 56;
    var X = function (v) { return padL + (v / 5) * (W - padL - padR); };
    var Y = function (v) { return H - padB - (v / 5) * (H - padT - padB); };
    var kx = state.x, ky = state.y;
    var placed = E.filter(function (e) { return e.scores[kx] != null && e.scores[ky] != null; });
    var mx = median(placed.map(function (e) { return e.scores[kx]; })), my = median(placed.map(function (e) { return e.scores[ky]; }));
    grid.replaceChildren(); grid.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    for (var i = 0; i <= 5; i++) {
      grid.append(sv('line', { x1: X(i), x2: X(i), y1: Y(0), y2: Y(5), stroke: '#EAEBE6', 'stroke-width': 1 }));
      grid.append(sv('line', { x1: X(0), x2: X(5), y1: Y(i), y2: Y(i), stroke: '#EAEBE6', 'stroke-width': 1 }));
      var tx = sv('text', { x: X(i), y: Y(0) + 16, 'text-anchor': 'middle', fill: '#6B6B73', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10.5 }); tx.textContent = i; grid.append(tx);
      var ty = sv('text', { x: X(0) - 8, y: Y(i) + 3.5, 'text-anchor': 'end', fill: '#6B6B73', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10.5 }); ty.textContent = i; grid.append(ty);
    }
    grid.append(sv('line', { x1: X(mx), x2: X(mx), y1: Y(0), y2: Y(5), stroke: '#C9CBC4', 'stroke-width': 1.5 }));
    grid.append(sv('line', { x1: X(0), x2: X(5), y1: Y(my), y2: Y(my), stroke: '#C9CBC4', 'stroke-width': 1.5 }));
    var xt = sv('text', { x: X(5), y: Y(0) + 36, 'text-anchor': 'end', fill: '#3F3F46', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, 'letter-spacing': '1' });
    xt.textContent = (DIMS[kx].label + ' →').toUpperCase(); grid.append(xt);
    var yt = sv('text', { x: 0, y: 0, 'text-anchor': 'end', fill: '#3F3F46', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, 'letter-spacing': '1', transform: 'translate(' + (narrow ? 11 : 14) + ',' + Y(5) + ') rotate(-90)' });
    yt.textContent = (DIMS[ky].label + ' →').toUpperCase(); grid.append(yt);
    var p = state.preset >= 0 ? PRESETS[state.preset] : null;
    var lx = DIMS[kx].label.toLowerCase(), ly = DIMS[ky].label.toLowerCase();
    var qn = p && p.quads ? p.quads : { tl: 'High ' + ly + ', low ' + lx, tr: 'High on both', bl: 'Low on both', br: 'High ' + lx + ', low ' + ly };
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) { $('#bm-q-' + k).textContent = qn[k]; });
    $('#bm-q-tl').style.left = (padL + 8) + 'px'; $('#bm-q-bl').style.left = (padL + 8) + 'px';
    $('#bm-q-bl').style.bottom = (padB + 8) + 'px'; $('#bm-q-br').style.bottom = (padB + 8) + 'px';

    /* exact spot first; overlapping badges step apart and keep a hairline to it */
    var nodes = placed.map(function (e) { var ax = X(e.scores[kx]), ay = Y(e.scores[ky]); return { e: e, ax: ax, ay: ay, x: ax, y: ay }; });
    var r = d / 2 + 2;
    for (var it = 0; it < 220; it++) {
      for (var a = 0; a < nodes.length; a++) for (var b2 = a + 1; b2 < nodes.length; b2++) {
        var A = nodes[a], B = nodes[b2], dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
        if (dist < 2 * r) { if (dist < 0.01) { dx = (b2 % 2 ? 1 : -1) * 0.5; dy = 0.5; dist = 0.7; }
          var push = (2 * r - dist) / 2, ux = dx / dist, uy = dy / dist; A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push; }
      }
      nodes.forEach(function (n) { n.x += (n.ax - n.x) * 0.06; n.y += (n.ay - n.y) * 0.06;
        n.x = Math.max(d / 2 + 2, Math.min(W - d / 2 - 2, n.x)); n.y = Math.max(d / 2 + 2, Math.min(H - d / 2 - 2, n.y)); });
    }
    nodes.forEach(function (n) {
      if (Math.hypot(n.x - n.ax, n.y - n.ay) > 4) grid.append(sv('line', { x1: n.ax, y1: n.ay, x2: n.x, y2: n.y, stroke: '#B4B7B1', 'stroke-width': 1 }));
      grid.append(sv('circle', { cx: n.ax, cy: n.ay, r: 2.4, fill: '#3F3F46' }));
    });
    Object.keys(badges).forEach(function (s) { badges[s].hidden = true; });
    nodes.forEach(function (n) { var bb = badges[n.e.slug]; bb.hidden = false; bb.style.setProperty('--d', d + 'px'); bb.style.left = n.x + 'px'; bb.style.top = n.y + 'px'; });
    /* names where they cover nothing, the heaviest companies first */
    ll.replaceChildren();
    var boxes = nodes.map(function (n) { return { x1: n.x - d / 2, y1: n.y - d / 2, x2: n.x + d / 2, y2: n.y + d / 2 }; });
    var hit = function (q) { return boxes.some(function (b) { return q.x1 < b.x2 && q.x2 > b.x1 && q.y1 < b.y2 && q.y2 > b.y1; }); };
    var meas = el('span', { class: 'bm-l', style: 'visibility:hidden' }); ll.append(meas);
    nodes.slice().sort(function (a, b) { return b.e.weight - a.e.weight; }).forEach(function (n) {
      meas.textContent = n.e.short; var w = meas.offsetWidth, h = meas.offsetHeight;
      var tries = [[n.x + d / 2 + 5, n.y - h / 2], [n.x - d / 2 - 5 - w, n.y - h / 2], [n.x - w / 2, n.y + d / 2 + 3], [n.x - w / 2, n.y - d / 2 - 3 - h]];
      for (var t = 0; t < tries.length; t++) {
        var q = { x1: tries[t][0] - 1, y1: tries[t][1] - 1, x2: tries[t][0] + w + 1, y2: tries[t][1] + h + 1 };
        if (q.x1 < 2 || q.x2 > W - 2 || q.y1 < 2 || q.y2 > H - 2 || hit(q)) continue;
        ll.append(el('span', { class: 'bm-l', text: n.e.short, 'data-slug': n.e.slug, style: 'left:' + tries[t][0] + 'px;top:' + tries[t][1] + 'px' }));
        boxes.push(q); break;
      }
    });
    meas.remove();
    var foot = $('#bm-foot'); foot.replaceChildren();
    foot.append(el('span', { text: narrow ? 'Tap a logo' : 'Hover or tap a logo' }), el('span', { text: '/' }),
      el('span', null, el('b', { text: String(nodes.length) }), ' of ' + N + ' placed'), el('span', { text: '/' }),
      el('span', { text: 'Lines cross at the median' }), el('span', { text: '/' }),
      el('span', { text: 'Dot = exact score; a moved logo keeps a hairline to it' }));
    dim();
    if (state.pinned) { var pe = E.find(function (x) { return x.slug === state.pinned; }); if (pe) show(pe, true); }
  }
  function dim() {
    E.forEach(function (e) {
      var off = state.cluster !== 'all' && e.cluster !== state.cluster;
      badges[e.slug].classList.toggle('dim', off);
      var l = ll.querySelector('[data-slug="' + e.slug + '"]'); if (l) l.classList.toggle('dim', off);
    });
  }

  /* card */
  function fig(k, f) {
    var c = el('div', { class: 'fig' }, el('div', { class: 'k', text: k }));
    if (f && f.v != null) {
      c.append(el('div', { class: 'v' }, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener', title: host(f.url), text: fmt(f.v, Math.abs(f.v) >= 100 ? 0 : 1) }) : fmt(f.v)));
      c.append(el('div', { class: 'p', text: f.period || '' }));
    } else c.append(el('div', { class: 'v', title: 'No public figure found', text: '—' }));
    return c;
  }
  function show(e, pin) {
    card.replaceChildren();
    var hd = el('div', { class: 'hd' }, el('img', { src: e.logo, alt: '' }), el('div', null, el('div', { class: 'nm', text: e.name }), el('div', { class: 'cl', text: e.sector })));
    if (pin) hd.append(el('button', { class: 'x', type: 'button', 'aria-label': 'Close', text: '×', onclick: function (ev) { ev.stopPropagation(); state.pinned = null; hide(); } }));
    card.append(hd);
    ORDER.forEach(function (k) {
      var v = e.scores[k];
      card.append(el('div', { class: 'bm-sr' }, el('span', { class: 'k', text: DIMS[k].label }),
        el('span', { class: 'bar' }, el('i', { style: 'width:' + (v == null ? 0 : v / 5 * 100) + '%' })),
        el('span', { class: 'v', text: v == null ? '—' : fmt(v) }), el('span', { class: 'r', text: rk(e, k) })));
    });
    var f = e.fin || {};
    card.append(el('div', { class: 'figs' }, fig('Assets', f.total_assets), fig('Revenue', f.revenue), fig('Net profit', f.net_profit)));
    var why = el('div', { class: 'why' });
    ORDER.forEach(function (k) {
      if (k === 'finance' || !e.why || !e.why[k]) return;
      var pp = el('p', null, el('b', { text: DIMS[k].label }), e.why[k] + ' ');
      if (e.src && e.src[k]) pp.append(el('a', { href: e.src[k], target: '_blank', rel: 'noopener', text: host(e.src[k]) }));
      why.append(pp);
    });
    if (why.childNodes.length) card.append(why);
    card.hidden = false;
    var W = field.clientWidth, narrow = W < 640;
    card.classList.toggle('sheet', narrow);
    if (!narrow) {
      var b = badges[e.slug], bx = parseFloat(b.style.left), by = parseFloat(b.style.top), cw = card.offsetWidth, ch = card.offsetHeight;
      var x = bx + 34, y = by - 40;
      if (x + cw > W - 8) x = bx - 34 - cw; if (x < 8) x = 8;
      if (y + ch > field.clientHeight - 8) y = field.clientHeight - 8 - ch; if (y < 8) y = 8;
      card.style.left = x + 'px'; card.style.top = y + 'px';
    } else { card.style.left = ''; card.style.top = ''; }
    Object.keys(badges).forEach(function (s) { badges[s].classList.toggle('on', s === e.slug); });
  }
  function hide() { card.hidden = true; Object.keys(badges).forEach(function (s) { badges[s].classList.remove('on'); }); }

  /* table */
  var COLS = [{ k: 'name', label: 'Company' }, { k: 'sector', label: 'Danantara sector' }]
    .concat(ORDER.map(function (k) { return { k: k, label: DIMS[k].label, num: true }; }))
    .concat([{ k: 'total_assets', label: 'Assets', fin: true }, { k: 'revenue', label: 'Revenue', fin: true }, { k: 'net_profit', label: 'Net profit', fin: true }]);
  var sortK = ORDER.indexOf('finance') >= 0 && E.filter(function (e) { return e.scores.finance != null; }).length > N / 2 ? 'finance' : 'priority', sortDir = -1;
  var thead = $('#bm-tbl thead'), tbody = $('#bm-tbl tbody');
  function val(e, k) {
    if (k === 'name') return e.short.toLowerCase();
    if (k === 'sector') return e.sector || '';
    if (DIMS[k]) return e.scores[k];
    var f = (e.fin || {})[k]; return f ? f.v : null;
  }
  function head() {
    var tr = el('tr');
    COLS.forEach(function (c) {
      var th = el('th', { scope: 'col', class: (c.num || c.fin) ? 'n' : null }, el('button', { type: 'button', text: c.label,
        onclick: function () { if (sortK === c.k) sortDir = -sortDir; else { sortK = c.k; sortDir = (c.num || c.fin) ? -1 : 1; } body(); head(); } }));
      if (sortK === c.k) th.setAttribute('aria-sort', sortDir > 0 ? 'ascending' : 'descending');
      tr.append(th);
    });
    thead.replaceChildren(tr);
  }
  function body() {
    var q = $('#bm-q').value.trim().toLowerCase();
    var rows = E.filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0 || e.short.toLowerCase().indexOf(q) >= 0; })
      .sort(function (a, b) { var va = val(a, sortK), vb = val(b, sortK); if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return (va > vb ? 1 : va < vb ? -1 : 0) * sortDir; });
    tbody.replaceChildren();
    rows.forEach(function (e) {
      var tr = el('tr');
      tr.append(el('td', { class: 'co' }, el('img', { src: e.logo, alt: '', width: '26', height: '26', loading: 'lazy' }),
        el('button', { type: 'button', text: e.short, title: e.name, onclick: function (ev) { ev.stopPropagation(); state.pinned = e.slug; field.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { show(e, true); }, 350); } })));
      tr.append(el('td', { class: 'mu', text: e.sector || '' }));
      ORDER.forEach(function (k) {
        var v = e.scores[k];
        tr.append(v == null ? el('td', { class: 'dash', title: 'Not scored', text: '—' }) : el('td', { class: 'n' }, fmt(v), el('span', { class: 'r', text: rk(e, k) })));
      });
      ['total_assets', 'revenue', 'net_profit'].forEach(function (k) {
        var f = (e.fin || {})[k];
        if (f && f.v != null) tr.append(el('td', { class: 'n', title: f.period || '' }, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener', title: (f.period || '') + ' · ' + host(f.url), text: fmt(f.v, Math.abs(f.v) >= 100 ? 0 : 1) }) : fmt(f.v)));
        else tr.append(el('td', { class: 'dash', title: 'No public figure found', text: '—' }));
      });
      tbody.append(tr);
    });
    $('#bm-count').textContent = rows.length + ' of ' + N;
  }
  $('#bm-q').addEventListener('input', body);
  head(); body();

  var raf = 0;
  new ResizeObserver(function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(field);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  draw();
})();
