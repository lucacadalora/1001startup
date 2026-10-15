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

  /* the field: a square 0–5 plot, equal units both ways, plus a dashed lane for companies
     with no published figure on an axis (they keep their place on the other axis) */
  var stage = $('#bm-stage'), field = $('#bm-field'), grid = $('#bm-grid'), bl = $('#bm-badges'), ll = $('#bm-labs'),
      card = $('#bm-card'), idle = $('#bm-idle');
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
  var wide = function () { return stage.clientWidth >= 1000; };
  var last = { quads: null };

  function draw() {
    var W = field.clientWidth, narrow = W < 640;
    var d = narrow ? 28 : (W < 760 ? 36 : 44);
    var kx = state.x, ky = state.y;
    var both = E.filter(function (e) { return e.scores[kx] != null && e.scores[ky] != null; });
    var noX = E.filter(function (e) { return e.scores[kx] == null && e.scores[ky] != null; });
    var noY = E.filter(function (e) { return e.scores[ky] == null && e.scores[kx] != null; });
    var lane = noX.length ? d + (narrow ? 10 : 22) : 0, laneB = noY.length ? d + (narrow ? 10 : 22) : 0;
    var axL = narrow ? 30 : 44, padR = d / 2 + 10, padT = d / 2 + 34, axB = narrow ? 40 : 50;
    var x0 = axL + lane + (lane ? 8 : 0);
    var S = Math.max(160, Math.min(W - x0 - padR, 860));
    var H = Math.round(padT + S + axB + laneB + (laneB ? 8 : 0));
    field.style.height = H + 'px';
    var X = function (v) { return x0 + (v / 5) * S; };
    var Y = function (v) { return padT + S - (v / 5) * S; };
    var mx = median(both.map(function (e) { return e.scores[kx]; })), my = median(both.map(function (e) { return e.scores[ky]; }));
    grid.replaceChildren(); grid.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    if (lane) {
      grid.append(sv('rect', { x: axL - 2, y: padT - d / 2 - 6, width: lane, height: S + d + 12, fill: '#FFFFFF', stroke: '#C9CBC4', 'stroke-dasharray': '3 3' }));
      var lt = sv('text', { x: axL - 2 + lane / 2, y: padT - d / 2 - 12, 'text-anchor': 'middle', fill: '#6B6B73', 'font-family': 'IBM Plex Mono, monospace', 'font-size': narrow ? 8.5 : 9.5, 'letter-spacing': '0.6' });
      lt.textContent = narrow ? 'NO DATA' : 'NO FIGURES'; grid.append(lt);
    }
    if (laneB) grid.append(sv('rect', { x: x0 - d / 2 - 6, y: padT + S + axB, width: S + d + 12, height: laneB, fill: '#FFFFFF', stroke: '#C9CBC4', 'stroke-dasharray': '3 3' }));
    for (var i = 0; i <= 5; i++) {
      grid.append(sv('line', { x1: X(i), x2: X(i), y1: Y(0), y2: Y(5), stroke: '#EAEBE6', 'stroke-width': 1 }));
      grid.append(sv('line', { x1: X(0), x2: X(5), y1: Y(i), y2: Y(i), stroke: '#EAEBE6', 'stroke-width': 1 }));
      var tx = sv('text', { x: X(i), y: Y(0) + 16, 'text-anchor': 'middle', fill: '#6B6B73', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10.5 }); tx.textContent = i; grid.append(tx);
      var ty = sv('text', { x: X(0) - (lane ? lane + 14 : 8), y: Y(i) + 3.5, 'text-anchor': 'end', fill: '#6B6B73', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 10.5 }); ty.textContent = i; grid.append(ty);
    }
    grid.append(sv('rect', { x: X(0), y: Y(5), width: S, height: S, fill: 'none', stroke: '#DADBD5', 'stroke-width': 1 }));
    grid.append(sv('line', { x1: X(mx), x2: X(mx), y1: Y(0), y2: Y(5), stroke: '#B9BBB4', 'stroke-width': 1.5 }));
    grid.append(sv('line', { x1: X(0), x2: X(5), y1: Y(my), y2: Y(my), stroke: '#B9BBB4', 'stroke-width': 1.5 }));
    var xt = sv('text', { x: X(5), y: Y(0) + 34, 'text-anchor': 'end', fill: '#3F3F46', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, 'letter-spacing': '1' });
    xt.textContent = (DIMS[kx].label + ' →').toUpperCase(); grid.append(xt);
    var yt = sv('text', { x: 0, y: 0, 'text-anchor': 'end', fill: '#3F3F46', 'font-family': 'IBM Plex Mono, monospace', 'font-size': 11, 'letter-spacing': '1', transform: 'translate(' + (narrow ? 10 : 13) + ',' + Y(5) + ') rotate(-90)' });
    yt.textContent = (DIMS[ky].label + ' →').toUpperCase(); grid.append(yt);
    var p = state.preset >= 0 ? PRESETS[state.preset] : null;
    var lx = DIMS[kx].label.toLowerCase(), ly = DIMS[ky].label.toLowerCase();
    var qn = p && p.quads ? p.quads : { tl: 'High ' + ly + ', low ' + lx, tr: 'High on both', bl: 'Low on both', br: 'High ' + lx + ', low ' + ly };
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) { $('#bm-q-' + k).textContent = qn[k]; });
    var q = function (k) { return $('#bm-q-' + k).style; };
    q('tl').left = X(0) + 'px'; q('tl').top = (Y(5) - d / 2 - 22) + 'px'; q('tl').right = '';
    q('tr').right = (W - X(5)) + 'px'; q('tr').top = (Y(5) - d / 2 - 22) + 'px';
    q('bl').left = (X(0) + 8) + 'px'; q('bl').bottom = (H - Y(0) + 6) + 'px';
    q('br').right = (W - X(5) + 8) + 'px'; q('br').bottom = (H - Y(0) + 6) + 'px';

    /* exact spot first; overlapping badges step apart and keep a hairline to it */
    var nodes = both.map(function (e) { var ax = X(e.scores[kx]), ay = Y(e.scores[ky]); return { e: e, ax: ax, ay: ay, x: ax, y: ay }; })
      .concat(noX.map(function (e) { var ax = axL - 2 + lane / 2, ay = Y(e.scores[ky]); return { e: e, ax: ax, ay: ay, x: ax, y: ay, nd: 'x' }; }))
      .concat(noY.map(function (e) { var ax = X(e.scores[kx]), ay = padT + S + axB + laneB / 2; return { e: e, ax: ax, ay: ay, x: ax, y: ay, nd: 'y' }; }));
    var r = d / 2 + 2;
    for (var it = 0; it < 240; it++) {
      for (var a = 0; a < nodes.length; a++) for (var b2 = a + 1; b2 < nodes.length; b2++) {
        var A = nodes[a], B = nodes[b2], dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
        if (dist < 2 * r) { if (dist < 0.01) { dx = (b2 % 2 ? 1 : -1) * 0.5; dy = 0.5; dist = 0.7; }
          var push = (2 * r - dist) / 2, ux = dx / dist, uy = dy / dist; A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push; }
      }
      nodes.forEach(function (n) {
        n.x += (n.ax - n.x) * 0.06; n.y += (n.ay - n.y) * 0.06;
        if (n.nd === 'x') n.x = n.ax; else if (n.nd === 'y') n.y = n.ay;
        n.x = Math.max(d / 2 + 2, Math.min(W - d / 2 - 2, n.x)); n.y = Math.max(d / 2 + 2, Math.min(H - d / 2 - 2, n.y));
      });
    }
    nodes.forEach(function (n) {
      if (n.nd) return;
      if (Math.hypot(n.x - n.ax, n.y - n.ay) > 4) grid.append(sv('line', { x1: n.ax, y1: n.ay, x2: n.x, y2: n.y, stroke: '#B4B7B1', 'stroke-width': 1 }));
      grid.append(sv('circle', { cx: n.ax, cy: n.ay, r: 2.4, fill: '#3F3F46' }));
    });
    Object.keys(badges).forEach(function (s) { badges[s].hidden = true; badges[s].classList.remove('nd'); });
    nodes.forEach(function (n) { var bb = badges[n.e.slug]; bb.hidden = false; bb.classList.toggle('nd', !!n.nd); bb.style.setProperty('--d', d + 'px'); bb.style.left = n.x + 'px'; bb.style.top = n.y + 'px'; });
    /* names where they cover nothing, the heaviest companies first; lane names go on the open side */
    ll.replaceChildren();
    var boxes = nodes.map(function (n) { return { x1: n.x - d / 2, y1: n.y - d / 2, x2: n.x + d / 2, y2: n.y + d / 2 }; });
    var hit = function (qq) { return boxes.some(function (b) { return qq.x1 < b.x2 && qq.x2 > b.x1 && qq.y1 < b.y2 && qq.y2 > b.y1; }); };
    var meas = el('span', { class: 'bm-l', style: 'visibility:hidden' }); ll.append(meas);
    nodes.slice().sort(function (a, b) { return (b.nd ? 1 : 0) - (a.nd ? 1 : 0) || b.e.weight - a.e.weight; }).forEach(function (n) {
      meas.textContent = n.e.short; var w = meas.offsetWidth, h = meas.offsetHeight;
      var tries = [[n.x + d / 2 + 5, n.y - h / 2], [n.x - d / 2 - 5 - w, n.y - h / 2], [n.x - w / 2, n.y + d / 2 + 3], [n.x - w / 2, n.y - d / 2 - 3 - h]];
      for (var t = 0; t < tries.length; t++) {
        var qq = { x1: tries[t][0] - 1, y1: tries[t][1] - 1, x2: tries[t][0] + w + 1, y2: tries[t][1] + h + 1 };
        if (qq.x1 < 2 || qq.x2 > W - 2 || qq.y1 < 2 || qq.y2 > H - 2 || hit(qq)) continue;
        ll.append(el('span', { class: 'bm-l', text: n.e.short, 'data-slug': n.e.slug, style: 'left:' + tries[t][0] + 'px;top:' + tries[t][1] + 'px' }));
        boxes.push(qq); break;
      }
    });
    meas.remove();
    var foot = $('#bm-foot'); foot.replaceChildren();
    foot.append(el('span', { text: narrow ? 'Tap a logo' : 'Hover or tap a logo' }), el('span', { text: '/' }),
      el('span', null, el('b', { text: String(both.length) }), ' of ' + N + ' placed by score'));
    if (noX.length || noY.length) foot.append(el('span', { text: '/' }), el('span', null, el('b', { text: String(noX.length + noY.length) }), ' in the dashed lane: no published figures'));
    foot.append(el('span', { text: '/' }), el('span', { text: 'Equal 0–5 scales; lines at the median' }));
    /* the side panel at rest: who sits in which corner */
    var cnt = { tl: [], tr: [], bl: [], br: [] };
    both.forEach(function (e) { var hx = e.scores[kx] >= mx, hy = e.scores[ky] >= my; cnt[(hy ? 't' : 'b') + (hx ? 'r' : 'l')].push(e); });
    last.quads = { qn: qn, cnt: cnt, nd: noX.concat(noY), kx: kx, ky: ky };
    renderIdle();
    dim();
    if (state.pinned) { var pe = E.find(function (x) { return x.slug === state.pinned; }); if (pe) show(pe, true); }
  }
  function renderIdle() {
    var Q = last.quads; if (!Q) return;
    idle.replaceChildren(el('div', { class: 'k', text: 'Who sits where · ' + DIMS[Q.kx].label + ' × ' + DIMS[Q.ky].label }));
    [['tr'], ['tl'], ['br'], ['bl']].forEach(function (k) {
      var list = Q.cnt[k[0]];
      var names = list.slice().sort(function (a, b) { return (b.scores[Q.kx] + b.scores[Q.ky]) - (a.scores[Q.kx] + a.scores[Q.ky]); }).map(function (e) { return e.short; });
      idle.append(el('div', { class: 'qd' }, el('b', { text: Q.qn[k[0]] }), el('span', { text: String(list.length) }),
        el('p', { text: names.length ? names.slice(0, 6).join(', ') + (names.length > 6 ? ' and ' + (names.length - 6) + ' more' : '') : 'None' })));
    });
    if (Q.nd.length) idle.append(el('div', { class: 'qd' }, el('b', { text: 'No published figures' }), el('span', { text: String(Q.nd.length) }),
      el('p', { text: Q.nd.map(function (e) { return e.short; }).join(', ') })));
    idle.append(el('p', { class: 'k', style: 'margin-top:10px', text: 'Tap a logo for its card' }));
  }
  function dim() {
    E.forEach(function (e) {
      var off = state.cluster !== 'all' && e.cluster !== state.cluster;
      badges[e.slug].classList.toggle('dim', off);
      var l = ll.querySelector('[data-slug="' + e.slug + '"]'); if (l) l.classList.toggle('dim', off);
    });
  }

  /* card: in the side panel on wide screens, a bottom sheet on narrow ones */
  function fig(k, f, why) {
    var c = el('div', { class: 'fig' }, el('div', { class: 'k', text: k }));
    if (f && f.v != null) {
      c.append(el('div', { class: 'v' }, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener', title: host(f.url), text: fmt(f.v, Math.abs(f.v) >= 100 ? 0 : 1) }) : fmt(f.v)));
      c.append(el('div', { class: 'p', text: f.period || '' }));
    } else c.append(el('div', { class: 'v', title: why || 'No public figure found', text: '—' }));
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
    var f = e.fin || {}, mw = e.missing && e.missing.finance;
    card.append(el('div', { class: 'figs' }, fig('Assets', f.total_assets, mw), fig('Revenue', f.revenue, mw), fig('Net profit', f.net_profit, mw)));
    var why = el('div', { class: 'why' });
    if (e.scores.finance == null && mw) why.append(el('p', null, el('b', { text: 'Finance' }), mw + '.'));
    ORDER.forEach(function (k) {
      if (k === 'finance' || !e.why || !e.why[k]) return;
      var pp = el('p', null, el('b', { text: DIMS[k].label }), e.why[k] + ' ');
      if (e.src && e.src[k]) pp.append(el('a', { href: e.src[k], target: '_blank', rel: 'noopener', text: host(e.src[k]) }));
      why.append(pp);
    });
    if (why.childNodes.length) card.append(why);
    card.classList.toggle('sheet', !wide());
    card.hidden = false; idle.hidden = wide();
    Object.keys(badges).forEach(function (s) { badges[s].classList.toggle('on', s === e.slug); });
  }
  function hide() { card.hidden = true; idle.hidden = false; Object.keys(badges).forEach(function (s) { badges[s].classList.remove('on'); }); }

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

  var raf = 0, lastW = 0;
  new ResizeObserver(function () { if (field.clientWidth === lastW) return; lastW = field.clientWidth; cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(field);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  draw();
})();
