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
  /* money in IDR trillion: under 1 trillion needs two decimals, or a Rp47 bn loss reads as -0.0 */
  var dp = function (v) { var x = Math.abs(v); return x >= 100 ? 0 : x >= 1 ? 1 : 2; };
  var host = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  var rk = function (e, k) { return e.ranks[k] ? '#' + e.ranks[k] + (e.tied && e.tied[k] ? '=' : '') : ''; };
  var state = { x: PRESETS[0].x, y: PRESETS[0].y, preset: 0, cluster: 'all', pinned: null };

  /* subsidiaries for the card: the #bm-subs block, present only while the page's switch is on */
  var SUBS = (function () { var n = document.getElementById('bm-subs'); if (!n) return null; try { return JSON.parse(n.textContent); } catch (err) { return null; } })();
  /* group maps: the #bm-maps block lists the companies with a /bumn/<slug> page, present only while that switch is on */
  var MAPS = (function () { var n = document.getElementById('bm-maps'); if (!n) return []; try { return JSON.parse(n.textContent); } catch (err) { return []; } })();
  /* the small map for each card (#bm-minis, views/bumnsankey1001.js minis()): the group's bar on the left, one band per
     business (or branch) to its own bar on the right, the label beside it; the whole block links to the full map */
  var MINI = (function () { var n = document.getElementById('bm-minis'); if (!n) return {}; try { return JSON.parse(n.textContent); } catch (err) { return {}; } })();
  function miniMap(e, m) {
    var W = 64, bw = 6, SLOT = 30, GAP = 2, LH = Math.min(84, 22 * m.r.length + 10);   /* one or two rows get a thinner bar */
    var tot = m.r.reduce(function (a, r) { return a + r[1]; }, 0) || 1;
    var rows = [], y = 0, sum = 0;
    m.r.forEach(function (r) {
      var h = Math.max(2, r[1] / tot * LH), slot = Math.max(SLOT, h + 4);
      rows.push({ r: r, h: h, mid: y + slot / 2 }); y += slot + GAP; sum += h;
    });
    var H = Math.max(y - GAP, sum), yL = (H - sum) / 2, a = yL, cx = W / 2, f = function (v) { return Math.round(v * 10) / 10; };
    var svg = '<rect x="0" y="' + f(yL) + '" width="' + bw + '" height="' + f(sum) + '" fill="#0B0B0C"/>';
    var box = el('span', { class: 'gm-m', style: 'height:' + Math.ceil(H) + 'px' });
    rows.forEach(function (o) {
      var a1 = a + o.h, b0 = o.mid - o.h / 2, b1 = o.mid + o.h / 2, k = o.r[2];
      svg += '<path class="bd ' + (k === 'c' ? 'c' : 'o') + '" fill="' + (k === 'c' ? '#C9C9C1' : '#ECECE7') + '" d="M' + bw + ' ' + f(a) + 'C' + cx + ' ' + f(a) + ' ' + cx + ' ' + f(b0) + ' ' + (W - bw) + ' ' + f(b0) +
        'L' + (W - bw) + ' ' + f(b1) + 'C' + cx + ' ' + f(b1) + ' ' + cx + ' ' + f(a1) + ' ' + bw + ' ' + f(a1) + 'Z"/>' +
        '<rect x="' + (W - bw) + '" y="' + f(b0) + '" width="' + bw + '" height="' + f(o.h) + '" fill="' + (k === 'x' || k === 'm' ? '#9A9AA0' : '#0B0B0C') + '"/>';
      box.append(el('span', { class: 'gm-r ' + k, title: o.r[0], style: 'left:' + (W + 8) + 'px;top:' + f(o.mid - 14) + 'px' }, el('span', { class: 'n', text: o.r[0] }),
        el('span', { class: 'f', text: m.k === 'c' ? o.r[3] + (o.r[1] === 1 ? ' company' : ' companies') : o.r[3] })));
      a = a1;
    });
    var pic = el('span', { 'aria-hidden': 'true' });
    pic.innerHTML = '<svg width="' + W + '" height="' + Math.ceil(H) + '" viewBox="0 0 ' + W + ' ' + Math.ceil(H) + '">' + svg + '</svg>';
    box.prepend(pic);
    return el('a', { class: 'gm', href: '/bumn/' + encodeURIComponent(e.slug) },
      el('span', { class: 'gm-h' }, el('span', { text: m.h }), el('b', { text: m.tot })),
      box,
      el('span', { class: 'gm-go' }, el('span', { text: m.k === 'c' ? 'Group map: every company in the group' : 'Group map: every business, every company' }), el('span', { 'aria-hidden': 'true', text: '→' })));
  }
  var ST = { active: 'active', not_yet_operating: 'not yet operating', unknown: 'status not stated', dormant: 'dormant', liquidation: 'in liquidation', merged: 'merged', divested: 'sold' };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function day(iso) { var m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso || ''); return m ? (m[3] ? Number(m[3]) + ' ' : '') + MON[Number(m[2]) - 1] + ' ' + m[1] : (iso || ''); }
  function pct(v) { return v == null ? '—' : (v >= 100 ? 100 : Math.floor(v * 100) / 100) + '%'; }   /* 99.998 shows as 99.99, never 100 */
  var TIES = (function () { var n = document.getElementById('bm-ties'); if (!n) return null; try { return JSON.parse(n.textContent); } catch (err) { return null; } })();
  function tiesBlock(slug) {
    var rows = TIES && TIES.groups && TIES.groups[slug];
    if (!rows || !rows.length) return null;
    var total = rows.reduce(function (n, r) { return n + r[2].length; }, 0);
    var box = el('div', { class: 'ties' }, el('div', { class: 'h' }, el('b', { text: 'Ties to data centres' }),
      el('span', { text: total + (total === 1 ? ' tie' : ' ties') })));
    var list = el('div'), lastType = null, shown = 0;
    rows.forEach(function (r, i) {
      var hide = i >= 6;
      if (r[0] !== lastType) { var th = el('div', { class: 't', text: TIES.types[r[0]] || r[0] }); if (hide) th.hidden = true; list.append(th); lastType = r[0]; }
      var who = el('span', { class: 'c' });
      r[2].forEach(function (p, j) { if (j) who.append(', '); who.append(p[1] ? el('a', { href: p[1], text: p[0] }) : p[0]); });
      var meta = el('span', { class: 'm' }, (r[4] === 'confirmed' ? 'Confirmed' : "Company's word") + (r[5] ? ' · ' + r[5] : '') + ' · ');
      meta.append(el('a', { href: r[6], target: '_blank', rel: 'noopener', text: host(r[6]) }));
      var d = el('div', { class: 'bm-tie' }, who, el('span', { class: 'd', text: (r[1] ? r[1] + ': ' : '') + r[3] }), meta);
      if (hide) d.hidden = true; else shown++;
      list.append(d);
    });
    box.append(list);
    if (rows.length > shown) box.append(el('button', { class: 'more', type: 'button', text: 'Show all ' + total,
      onclick: function (ev) { ev.stopPropagation(); Array.prototype.forEach.call(list.children, function (c) { c.hidden = false; }); ev.currentTarget.remove(); } }));
    return box;
  }
  /* the group's ties to regional companies (#bm-bumd, present only while /bumd is switched on) */
  var BUMD = (function () { var n = document.getElementById('bm-bumd'); if (!n) return null; try { return JSON.parse(n.textContent); } catch (err) { return null; } })();
  function bumdBlock(slug) {
    var g = BUMD && BUMD[slug];
    if (!g || !g[0]) return null;
    var bits = [g[0] + (g[0] === 1 ? ' tie' : ' ties')];
    if (g[1]) bits.push(g[1] + (g[1] === 1 ? ' joint operation' : ' joint operations'));
    if (g[2]) bits.push(g[2] + (g[2] === 1 ? ' regional company' : ' regional companies'));
    return el('a', { class: 'bdl', href: '/bumd#g-' + encodeURIComponent(slug) },
      el('span', null, el('b', { text: 'Regional companies and joint operations' }), bits.join('\u00a0· ')), el('span', { 'aria-hidden': 'true', text: '→' }));
  }
  function subsBlock(slug) {
    var g = SUBS && SUBS.groups && SUBS.groups[slug];
    if (!g) return null;
    var U = function (i) { return i != null && i >= 0 ? g.urls[i] : null; };
    var stake = function (v, i) { var u = U(i); return u ? el('a', { href: u, target: '_blank', rel: 'noopener', title: 'Source: ' + host(u), text: pct(v) }) : pct(v); };
    var act = g.subs.filter(function (r) { return r[2] === 'active'; });
    var rest = g.subs.filter(function (r) { return r[2] !== 'active'; });
    var box = el('div', { class: 'subs' }, el('div', { class: 'h' }, el('b', { text: 'Subsidiaries and stakes' }),
      el('span', { text: g.t1 ? g.t1a + ' of ' + g.t1 + ' active' : 'none found' })));
    function row(r, nest) {
      var d = el('div', { class: 'bm-sub' }, el('span', { class: 'n', text: r[0] }), el('span', { class: 'p' }, stake(r[1], r[4])));
      var meta = [r[3], r[2] !== 'active' ? (ST[r[2]] || r[2]) : ''].filter(Boolean).join(' · ');
      if (meta) d.append(el('span', { class: 's', text: meta }));
      var ks = nest && r[5] ? r[5] : [];
      if (ks.length) {
        var ul = el('ul');
        ks.forEach(function (k) {
          ul.append(el('li', null, el('span', { text: k[0] + (k[2] !== 'active' ? ' (' + (ST[k[2]] || k[2]) + ')' : '') }), el('span', { class: 'p' }, stake(k[1], k[4]))));
        });
        d.append(el('details', null, el('summary', { text: ks.length === 1 ? '1 company under it' : ks.length + ' companies under it' }), ul));
      }
      return d;
    }
    var list = el('div');
    act.forEach(function (r, i) { var d = row(r, true); if (i >= 6) d.hidden = true; list.append(d); });
    box.append(list);
    if (act.length > 6) box.append(el('button', { class: 'more', type: 'button', text: 'Show all ' + act.length,
      onclick: function (ev) { ev.stopPropagation(); Array.prototype.forEach.call(list.children, function (c) { c.hidden = false; }); ev.currentTarget.remove(); } }));
    if (rest.length) {
      var gone = el('div');
      rest.forEach(function (r) { gone.append(row(r, false)); });
      box.append(el('details', { class: 'gone' }, el('summary', { text: rest.length + ' more: not active or status not stated' }), gone));
    }
    var b = g.basis, bu = b ? U(b.u) : null;
    var nt = el('p', { class: 'nt' }, 'As of ' + (b && b.as_of ? day(b.as_of) : 'its latest filing') + ', from ');
    nt.append(bu ? el('a', { href: bu, target: '_blank', rel: 'noopener', text: host(bu) }) : 'its filings', '. Tap a stake for its source.');
    box.append(nt);
    if (g.note) box.append(el('p', { class: 'nt', text: g.note }));
    return box;
  }

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
    var d = narrow ? 26 : (W < 760 ? 34 : 40);
    var kx = state.x, ky = state.y;
    var both = E.filter(function (e) { return e.scores[kx] != null && e.scores[ky] != null; });
    var noX = E.filter(function (e) { return e.scores[kx] == null && e.scores[ky] != null; });
    var noY = E.filter(function (e) { return e.scores[ky] == null && e.scores[kx] != null; });
    /* the square runs from -0.5 to 5.5 on both axes, so the 0 and 5 rows have room on every side */
    var LO = -0.5, HI = 5.5, SPAN = HI - LO;
    var lane = noX.length ? d + (narrow ? 10 : 20) : 0;
    var axL = narrow ? 28 : 40, gap = lane ? 8 : 0, padR = 10, padT = 30;
    var x0 = axL + lane + gap;
    var S = Math.max(180, Math.min(W - x0 - padR, 880));
    var laneB = noY.length ? d + 16 : 0;
    var H = Math.round(padT + S + (narrow ? 58 : 66) + laneB);
    field.style.height = H + 'px';
    var unit = S / SPAN;
    var X = function (v) { return x0 + ((v - LO) / SPAN) * S; };
    var Y = function (v) { return padT + S - ((v - LO) / SPAN) * S; };
    var top = Y(HI), bot = Y(LO), left = X(LO), right = X(HI);
    var mx = median(both.map(function (e) { return e.scores[kx]; })), my = median(both.map(function (e) { return e.scores[ky]; }));
    grid.replaceChildren(); grid.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var mono = 'IBM Plex Mono, monospace';
    if (lane) {
      grid.append(sv('rect', { x: axL, y: top, width: lane, height: S, fill: 'none', stroke: '#C9CBC4', 'stroke-dasharray': '3 3' }));
      var lt = sv('text', { x: axL + lane / 2, y: bot + 16, 'text-anchor': 'middle', fill: '#6B6B73', 'font-family': mono, 'font-size': narrow ? 8 : 9, 'letter-spacing': '0.5' });
      lt.textContent = narrow ? 'NO DATA' : 'NO FIGURES'; grid.append(lt);
    }
    if (laneB) grid.append(sv('rect', { x: left, y: bot + 40, width: S, height: laneB, fill: 'none', stroke: '#C9CBC4', 'stroke-dasharray': '3 3' }));
    grid.append(sv('rect', { x: left, y: top, width: S, height: S, fill: 'none', stroke: '#DADBD5', 'stroke-width': 1 }));
    for (var i = 0; i <= 5; i++) {
      grid.append(sv('line', { x1: X(i), x2: X(i), y1: top, y2: bot, stroke: '#ECEDE8', 'stroke-width': 1 }));
      grid.append(sv('line', { x1: left, x2: right, y1: Y(i), y2: Y(i), stroke: '#ECEDE8', 'stroke-width': 1 }));
      var tx = sv('text', { x: X(i), y: bot + 16, 'text-anchor': 'middle', fill: '#6B6B73', 'font-family': mono, 'font-size': 10.5 }); tx.textContent = i; grid.append(tx);
      var ty = sv('text', { x: axL - 8, y: Y(i) + 3.5, 'text-anchor': 'end', fill: '#6B6B73', 'font-family': mono, 'font-size': 10.5 }); ty.textContent = i; grid.append(ty);
    }
    grid.append(sv('line', { x1: X(mx), x2: X(mx), y1: top, y2: bot, stroke: '#B9BBB4', 'stroke-width': 1.5 }));
    grid.append(sv('line', { x1: left, x2: right, y1: Y(my), y2: Y(my), stroke: '#B9BBB4', 'stroke-width': 1.5 }));
    var xt = sv('text', { x: left + S / 2, y: bot + (narrow ? 50 : 56), 'text-anchor': 'middle', fill: '#3F3F46', 'font-family': mono, 'font-size': 11, 'letter-spacing': '1' });
    xt.textContent = (DIMS[kx].label + ' →').toUpperCase(); grid.append(xt);
    var yt = sv('text', { x: 0, y: 0, 'text-anchor': 'end', fill: '#3F3F46', 'font-family': mono, 'font-size': 11, 'letter-spacing': '1', transform: 'translate(' + (narrow ? 10 : 12) + ',' + top + ') rotate(-90)' });
    yt.textContent = (DIMS[ky].label + ' →').toUpperCase(); grid.append(yt);
    var p = state.preset >= 0 ? PRESETS[state.preset] : null;
    var lx = DIMS[kx].label.toLowerCase(), ly = DIMS[ky].label.toLowerCase();
    var qn = p && p.quads ? p.quads : { tl: 'High ' + ly + ', low ' + lx, tr: 'High on both', bl: 'Low on both', br: 'High ' + lx + ', low ' + ly };
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) { $('#bm-q-' + k).textContent = qn[k]; });
    var q = function (k) { return $('#bm-q-' + k).style; };
    q('tl').left = left + 'px'; q('tl').top = (top - 20) + 'px'; q('tl').right = ''; q('tl').bottom = '';
    q('tr').right = (W - right) + 'px'; q('tr').top = (top - 20) + 'px'; q('tr').bottom = '';
    q('bl').left = left + 'px'; q('bl').top = (bot + 26) + 'px'; q('bl').bottom = '';
    q('br').right = (W - right) + 'px'; q('br').top = (bot + 26) + 'px'; q('br').bottom = '';

    /* exact spot first. Companies on the same score stack up to about two deep around their row
       (a beeswarm), held close to their true x; a moved logo keeps a hairline to its exact dot. */
    var band = 0.42 * unit;
    var nodes = both.map(function (e, i) { var ax = X(e.scores[kx]), ay = Y(e.scores[ky]); return { e: e, ax: ax, ay: ay, x: ax, y: ay + ((i % 3) - 1) * 0.15 * band }; })
      .concat(noX.map(function (e, i) { var ax = axL + lane / 2, ay = Y(e.scores[ky]); return { e: e, ax: ax, ay: ay, x: ax, y: ay + ((i % 2) ? 1 : -1) * 0.1 * band, nd: 'x' }; }))
      .concat(noY.map(function (e) { var ax = X(e.scores[kx]), ay = bot + 40 + laneB / 2; return { e: e, ax: ax, ay: ay, x: ax, y: ay, nd: 'y' }; }));
    var r = d / 2 + 2;
    for (var it = 0; it < 320; it++) {
      for (var a = 0; a < nodes.length; a++) for (var b2 = a + 1; b2 < nodes.length; b2++) {
        var A = nodes[a], B = nodes[b2], dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
        if (dist < 2 * r) { if (dist < 0.01) { dx = (b2 % 2 ? 1 : -1) * 0.5; dy = 0.5; dist = 0.7; }
          var push = (2 * r - dist) / 2, ux = dx / dist, uy = dy / dist; A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push; }
      }
      nodes.forEach(function (n) {
        n.x += (n.ax - n.x) * 0.07; n.y += (n.ay - n.y) * 0.012;
        if (n.nd === 'x') n.x = n.ax; else if (n.nd === 'y') n.y = n.ay;
        if (n.nd !== 'y') n.y = Math.max(n.ay - band, Math.min(n.ay + band, n.y));
        if (!n.nd) n.x = Math.max(left + d / 2 + 2, Math.min(right - d / 2 - 2, n.x));
        n.y = Math.max(d / 2 + 2, Math.min(H - d / 2 - 2, n.y));
      });
    }
    nodes.forEach(function (n) {
      if (n.nd) return;
      if (Math.hypot(n.x - n.ax, n.y - n.ay) > 4) grid.append(sv('line', { x1: n.ax, y1: n.ay, x2: n.x, y2: n.y, stroke: '#B4B7B1', 'stroke-width': 1 }));
      grid.append(sv('circle', { cx: n.ax, cy: n.ay, r: 2.4, fill: '#3F3F46' }));
    });
    Object.keys(badges).forEach(function (s) { badges[s].hidden = true; badges[s].classList.remove('nd'); });
    nodes.forEach(function (n) { var bb = badges[n.e.slug]; bb.hidden = false; bb.classList.toggle('nd', !!n.nd); bb.style.setProperty('--d', d + 'px'); bb.style.left = n.x + 'px'; bb.style.top = n.y + 'px'; });
    /* names where they cover nothing (no logo, no axis number, no corner name), the heaviest companies first */
    ll.replaceChildren();
    var boxes = nodes.map(function (n) { return { x1: n.x - d / 2, y1: n.y - d / 2, x2: n.x + d / 2, y2: n.y + d / 2 }; });
    for (var ti = 0; ti <= 5; ti++) boxes.push({ x1: X(ti) - 9, y1: bot + 4, x2: X(ti) + 9, y2: bot + 22 });
    if (lane) boxes.push({ x1: axL, y1: bot + 4, x2: axL + lane, y2: bot + 22 });
    var hit = function (qq) { return boxes.some(function (b) { return qq.x1 < b.x2 && qq.x2 > b.x1 && qq.y1 < b.y2 && qq.y2 > b.y1; }); };
    var meas = el('span', { class: 'bm-l', style: 'visibility:hidden' }); ll.append(meas);
    nodes.slice().sort(function (a, b) { return (b.nd ? 1 : 0) - (a.nd ? 1 : 0) || b.e.weight - a.e.weight; }).forEach(function (n) {
      meas.textContent = n.e.short; var w = meas.offsetWidth, h = meas.offsetHeight;
      var tries = [[n.x + d / 2 + 5, n.y - h / 2], [n.x - d / 2 - 5 - w, n.y - h / 2], [n.x - w / 2, n.y + d / 2 + 3], [n.x - w / 2, n.y - d / 2 - 3 - h]];
      for (var t = 0; t < tries.length; t++) {
        var qq = { x1: tries[t][0] - 1, y1: tries[t][1] - 1, x2: tries[t][0] + w + 1, y2: tries[t][1] + h + 1 };
        if (qq.x1 < 2 || qq.x2 > W - 2 || qq.y1 < top - 2 || qq.y2 > bot + 2 || hit(qq)) continue;
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
      c.append(el('div', { class: 'v' }, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener', title: host(f.url), text: fmt(f.v, dp(f.v)) }) : fmt(f.v)));
      c.append(el('div', { class: 'p', text: f.period || '' }));
    } else c.append(el('div', { class: 'v', title: why || 'No public figure found', text: '—' }));
    return c;
  }
  function show(e, pin) {
    card.replaceChildren();
    var hd = el('div', { class: 'hd' }, el('img', { src: e.logo, alt: '' }), el('div', null, el('div', { class: 'nm', text: e.name }), el('div', { class: 'cl', text: e.sector })));
    if (pin) hd.append(el('button', { class: 'x', type: 'button', 'aria-label': 'Close', text: '×', onclick: function (ev) { ev.stopPropagation(); state.pinned = null; hide(); } }));
    card.append(hd);
    /* dashboard slice 1: follow1001.js shows and runs it while My 1001 is on */
    card.append(el('button', { class: 'fw1001', type: 'button', hidden: true, 'data-fk': 'bumn', 'data-fr': e.slug, text: 'Follow' }));
    if (MINI[e.slug]) card.append(miniMap(e, MINI[e.slug]));
    else if (MAPS.indexOf(e.slug) >= 0) card.append(el('a', { class: 'gm', href: '/bumn/' + encodeURIComponent(e.slug) }, el('span', { class: 'gm-go' }, el('span', { text: 'Group map: money by business, every company' }), el('span', { 'aria-hidden': 'true', text: '→' }))));
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
    if (e.finNote) why.append(el('p', null, el('b', { text: 'Finance' }), e.finNote));
    ORDER.forEach(function (k) {
      if (k === 'finance' || !e.why || !e.why[k]) return;
      var pp = el('p', null, el('b', { text: DIMS[k].label }), e.why[k] + ' ');
      if (e.src && e.src[k]) pp.append(el('a', { href: e.src[k], target: '_blank', rel: 'noopener', text: host(e.src[k]) }));
      why.append(pp);
    });
    if (why.childNodes.length) card.append(why);
    var sb = subsBlock(e.slug); if (sb) card.append(sb);
    var tb = tiesBlock(e.slug); if (tb) card.append(tb);
    var bb = bumdBlock(e.slug); if (bb) card.append(bb);
    card.classList.toggle('sheet', !wide());
    card.hidden = false; idle.hidden = wide();
    Object.keys(badges).forEach(function (s) { badges[s].classList.toggle('on', s === e.slug); });
  }
  function hide() { card.hidden = true; idle.hidden = false; Object.keys(badges).forEach(function (s) { badges[s].classList.remove('on'); }); }

  /* table */
  var COLS = [{ k: 'name', label: 'Company' }, { k: 'sector', label: 'Danantara sector' }]
    .concat(ORDER.map(function (k) { return { k: k, label: DIMS[k].label, num: true }; }))
    .concat([{ k: 'total_assets', label: 'Assets', fin: true }, { k: 'revenue', label: 'Revenue', fin: true }, { k: 'net_profit', label: 'Net profit', fin: true }]);
  var sortK = ORDER.indexOf('priority') >= 0 ? 'priority' : ORDER[0], sortDir = -1;   /* opens on national priority */
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
        var yr = f && f.period && !/202[4-9]/.test(f.period) ? (f.period.match(/20\d\d/) || [''])[0] : '';
        if (f && f.v != null) tr.append(el('td', { class: 'n', title: f.period || '' }, f.url ? el('a', { href: f.url, target: '_blank', rel: 'noopener', title: (f.period || '') + ' · ' + host(f.url), text: fmt(f.v, dp(f.v)) }) : fmt(f.v),
          yr ? el('span', { class: 'r', text: yr }) : null));
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

  /* /bumn#<slug> — a link from the 1001startup.id front page or its search
     box: pin that company's card, the same as a click on its table row */
  function fromHash() {
    var slug = decodeURIComponent((location.hash || '').slice(1));
    var hit = slug ? E.filter(function (x) { return x.slug === slug; })[0] : null;
    if (!hit) return;
    state.pinned = hit.slug;
    field.scrollIntoView({ block: 'center' });
    setTimeout(function () { show(hit, true); }, 350);
  }
  fromHash();
  window.addEventListener('hashchange', fromHash);
})();
