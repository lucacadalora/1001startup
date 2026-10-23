/* /bumd — the BUMD chart (published money: assets, revenue, net profit, net margin), the company
   cards, the full table, and the lists below it (ties to the state groups, joint operations, ties to
   data centres). Data: the #bd-data JSON block written by views/bumd1001.js from data/bumd.json,
   slimmed: URLs, provinces and sector texts are stored once and referenced by index, and companies,
   joint operations and every other name share one reference space (companies first, then the joint
   operations, then the rest). CSP script-src 'self': this is the page's only script.
   Every data-derived string goes in through textContent. */
(function () {
  'use strict';
  var node = document.getElementById('bd-data');
  if (!node) return;
  var D;
  try { D = JSON.parse(node.textContent); } catch (err) { return; }
  var U = D.U || [], PV = D.P || [], SK = D.K || [], C = D.co || [], O = D.ops || [], EN = D.en || [], TI = D.ti || [], WD = D.w || {};
  var NC = C.length, NO = O.length;
  var TYPES = WD.T || {}, FORM = WD.F || {}, STATUS = WD.S || {}, REL = WD.R || {};
  var KINDS = ['bpd', 'bpr', 'pdam', 'other', 'jv'];
  /* an id the server could rebuild from the name is not sent: the same rule here */
  var slug = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); };
  var byId = {};
  C.forEach(function (c, i) { c.ix = i; if (!c.i) c.i = slug(c.n); if (!Object.prototype.hasOwnProperty.call(byId, c.i)) byId[c.i] = c; });
  O.forEach(function (o, j) { o.ix = j; if (!o.i) o.i = slug(o.n); });

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
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, a) { var n = document.createElementNS(NS, tag); Object.keys(a).forEach(function (k) { if (a[k] != null) n.setAttribute(k, a[k]); }); return n; }

  /* ---------- words and numbers ---------- */
  var url = function (i) { return i == null ? null : (U[i] || null); };
  var host = function (u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function when(d) { var m = /^(\d{4})(?:-(\d{2}))?/.exec(d || ''); return m ? (m[2] ? MON[Number(m[2]) - 1] + ' ' : '') + m[1] : ''; }
  /* 99.998 shows as 99.99, never 100 (the /bumn rule); a sliver shows as under 0.01 */
  function pct(v) { return v == null ? '' : v > 0 && v < 0.01 ? '<0.01%' : (v >= 100 ? 100 : Math.floor(v * 100) / 100) + '%'; }
  /* v in Rp bn unless the row says 'US$ m' (views/bumd-common.js money()) */
  function money(v, u) {
    if (v == null) return '';
    var x = Math.abs(v), t;
    if (x === 0) return u === 'US$ m' ? 'US$0' : 'Rp0';
    if (u === 'US$ m') t = 'US$' + (x >= 1000 ? (x / 1000).toFixed(2) + ' bn' : x.toFixed(x >= 100 ? 0 : 1) + ' m');
    else t = x >= 1000 ? 'Rp' + (x / 1000).toFixed(x >= 10000 ? 1 : 2) + ' tn' : 'Rp' + x.toFixed(x >= 100 ? 0 : x >= 1 ? 1 : 2) + ' bn';
    return (v < 0 ? '−' : '') + t;
  }
  /* compact Rp for axis ticks and the year strip: 5.1tn, 939bn, 480m */
  function compact(v) {
    var x = Math.abs(v), t;
    if (x >= 1000) t = (x / 1000).toFixed(x >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'tn';
    else if (x >= 10) t = Math.round(x) + 'bn';
    else if (x >= 1) t = x.toFixed(1).replace(/\.0$/, '') + 'bn';
    else if (x > 0) t = (x * 1000 >= 10 ? Math.round(x * 1000) : (x * 1000).toFixed(1).replace(/\.0$/, '')) + 'm';
    else t = '0';
    return (v < 0 ? '−' : '') + t;
  }
  function srcLink(u, label) { return u ? el('a', { href: u, target: '_blank', rel: 'noopener', class: 'sl', text: label || host(u) || 'source' }) : null; }

  /* one reference space: a number below NC is a company, then the joint operations, then every other name */
  function nameOf(r) {
    if (typeof r !== 'number') return String(r == null ? '' : r);
    if (r < NC) return C[r].n;
    if (r < NC + NO) return O[r - NC].n;
    var e = EN[r - NC - NO]; return e ? e[0] : '';
  }
  function hrefOf(r) {
    if (typeof r !== 'number') return null;
    if (r < NC) return '#c-' + encodeURIComponent(C[r].i);
    if (r < NC + NO) return '#k-' + encodeURIComponent(O[r - NC].i);
    var e = EN[r - NC - NO];
    return !e ? null : e[2] === 1 ? '/bumn#' + e[1] : (e[2] || null);
  }
  function nameLink(r) { var h = hrefOf(r), n = nameOf(r); return h ? el('a', { href: h, text: n }) : document.createTextNode(n); }
  var entOf = function (r) { return typeof r === 'number' && r >= NC + NO ? (EN[r - NC - NO] || null) : null; };
  /* the BUMN group a name counts under, and whether it is a data-centre party (companies and joint operations carry their own) */
  function groupOf(r) { if (typeof r !== 'number') return null; if (r < NC) return C[r].gr || null; if (r < NC + NO) return O[r - NC].gr || null; var e = entOf(r); return e ? e[1] || null : null; }
  function dcOf(r) { if (typeof r !== 'number') return false; if (r < NC) return !!C[r].dc; if (r < NC + NO) return !!O[r - NC].dc; var e = entOf(r); return !!(e && e[3]); }
  function relWord(t, me) { var w = REL[t[2]]; return w ? w[t[0] === me ? 0 : 1] : String(t[2] || '').replace(/_/g, ' '); }
  var other = function (t, me) { return t[0] === me ? t[1] : t[0]; };

  /* the name a chart label carries: the brand without the legal form, the bracketed long form or the
     region ("PERUMDAM Tirta Kerta Raharja Kabupaten Tangerang" -> "Tirta Kerta Raharja") */
  var FORM_HEAD = /^(?:PERUMDAM|PERUMDA|PDAM|PD|PT\.?|Perumda|Perseroda)\s+/i;
  var REGION_TAIL = /\s+(?:Kabupaten|Kab\.|Kota|Provinsi)\s+.+$/i;
  function shortName(c) {
    if (c.sn) return c.sn;
    var full = String(c.n || '').trim(), s = full.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    if (s) {
      var bare = s.replace(FORM_HEAD, '');
      if (/^(?:Kabupaten|Kab\.|Kota|Provinsi)\s/i.test(bare)) s = (c.t === 'pdam' ? 'PDAM ' : '') + bare;
      else s = bare.replace(REGION_TAIL, '') || bare;
      if (s.length > 24) { var cut = s.slice(0, 23), sp = cut.lastIndexOf(' '); s = cut.slice(0, sp > 10 ? sp : 23).replace(/[\s,.\-]+$/, '') + '…'; }
    }
    c.sn = s || full;
    return c.sn;
  }
  function initials(c) {
    var s = shortName(c).replace(/…$/, ''), caps = s.match(/\b[A-Z]{2,5}\b/);
    if (caps) return caps[0].slice(0, 4);
    var w = s.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (w.length > 1 && /^tirta$/i.test(w[0])) w.shift();
    if (w.length > 2 && /^air$/i.test(w[0]) && /^minum$/i.test(w[1])) w.splice(0, 2);
    if (!w.length) return '·';
    return w.length === 1 ? w[0].slice(0, 2) : (w[0][0] + w[1][0]).toUpperCase();
  }
  function logoIn(box, c) {
    if (c.g) box.append(el('img', { src: c.g, alt: '', decoding: 'async', loading: 'lazy' }));
    else box.append(el('span', { class: 'mg', 'aria-hidden': 'true', text: initials(c) }));
    return box;
  }

  /* ---------- figures ---------- */
  var FY = function (c) { return c.x && c.x[0] != null ? c.x[0] : null; };
  var FA = function (c) { return c.x && c.x[1] != null ? c.x[1] : null; };
  var FR = function (c) { return c.x && c.x[2] != null ? c.x[2] : null; };
  var FP = function (c) { return c.x && c.x[3] != null ? c.x[3] : null; };
  var FU = function (c) { return c.x ? url(c.x[4]) : null; };
  var UNIT = function (c) { return (c.x && c.x[5]) || 'Rp bn'; };
  var MARGIN = function (c) { var r = FR(c), p = FP(c); return r != null && r > 0 && p != null ? p / r * 100 : null; };
  var AX = {
    a: { label: 'Assets', low: 'assets', note: 'log scale', get: FA, type: 'log' },
    r: { label: 'Revenue', low: 'revenue', note: 'log scale', get: FR, type: 'log' },
    p: { label: 'Net profit', low: 'net profit', note: 'signed log', get: FP, type: 'sym' },
    m: { label: 'Net margin', low: 'net margin', note: '', get: MARGIN, type: 'lin' }
  };
  var ORDER = ['a', 'r', 'p', 'm'];
  var PRESETS = [{ name: 'Size', sub: 'assets × revenue', x: 'a', y: 'r' }, { name: 'Profit', sub: 'revenue × net profit', x: 'r', y: 'p' }, { name: 'Margin', sub: 'assets × net margin', x: 'a', y: 'm' }];
  /* on the chart: every company with figures in rupiah (a figure in another currency would sit on the wrong scale) */
  var CH = C.filter(function (c) { return c.x && UNIT(c) === 'Rp bn' && (FA(c) != null || FR(c) != null || FP(c) != null); });

  var numSort = function (a, b) { return a - b; };
  function niceStep(x) { var e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  /* fixed domains over every charted company, so a filter never moves a mark */
  function buildScale(k) {
    var A = AX[k], vals = CH.map(A.get).filter(function (v) { return v != null && isFinite(v); });
    var S = { k: k, type: A.type, ticks: [], out: function () { return false; } };
    if (A.type === 'log') {
      var pos = vals.filter(function (v) { return v > 0; });
      var lo = pos.length ? Math.log10(Math.min.apply(null, pos)) : 0, hi = pos.length ? Math.log10(Math.max.apply(null, pos)) : 1;
      var pad = Math.max(0.12, (hi - lo) * 0.04);
      /* the largest sit at the high end: leave them room for their names */
      S.d0 = lo - pad; S.d1 = hi + Math.max(0.45, (hi - lo) * 0.09);
      /* a published zero gets its own tick before an axis break, never the floor of the log scale */
      S.zero = vals.some(function (v) { return v === 0; });
      if (S.zero) { S.z = S.d0 - 0.55; S.brk = S.d0 - 0.22; S.d0 = S.z - 0.22; S.ticks.push({ t: S.z, lab: '0', z: 1 }); }
      for (var e = Math.ceil(lo - pad); e <= Math.floor(S.d1); e++) S.ticks.push({ t: e, lab: compact(Math.pow(10, e)) });
      S.t = function (v) { return v == null || !isFinite(v) || v < 0 ? null : v === 0 ? (S.zero ? S.z : null) : Math.log10(v); };
    } else if (A.type === 'sym') {
      var C0 = 0.1;  /* Rp100 m: below it the scale runs straight through zero */
      var f = function (v) { return (v < 0 ? -1 : 1) * Math.log10(1 + Math.abs(v) / C0); };
      var tv = vals.map(f), lo2 = Math.min(0, Math.min.apply(null, tv.length ? tv : [0])), hi2 = Math.max(0, Math.max.apply(null, tv.length ? tv : [1]));
      var pad2 = (hi2 - lo2) * 0.04 + 0.1;
      S.d0 = lo2 - pad2; S.d1 = hi2 + pad2 + (hi2 - lo2) * 0.04;
      S.ticks.push({ t: 0, lab: '0', z: 1 });
      for (var p10 = 1; p10 <= 1e7; p10 *= 10) {
        if (f(p10) <= S.d1) S.ticks.push({ t: f(p10), lab: compact(p10) });
        if (f(-p10) >= S.d0) S.ticks.push({ t: f(-p10), lab: compact(-p10) });
      }
      S.ticks.sort(function (a, b) { return a.t - b.t; });
      S.t = function (v) { return v == null || !isFinite(v) ? null : f(v); };
    } else {
      var s = vals.slice().sort(numSort), q = function (pp) { return s.length ? s[Math.floor(pp * (s.length - 1))] : 0; };
      var lo3 = Math.min(0, q(0.03)), hi3 = Math.max(0, q(0.97));
      if (hi3 - lo3 < 1) hi3 = lo3 + 1;
      var step = niceStep((hi3 - lo3) / 6);
      lo3 = Math.floor(lo3 / step) * step; hi3 = Math.ceil(hi3 / step) * step;
      var span = hi3 - lo3;
      S.min = lo3; S.max = hi3; S.d0 = lo3 - span * 0.035; S.d1 = hi3 + span * 0.035;
      for (var tk = lo3; tk <= hi3 + step / 2; tk += step) { var r0 = Math.round(tk * 100) / 100; S.ticks.push({ t: r0, lab: (r0 < 0 ? '−' : '') + Math.abs(r0) + '%', z: r0 === 0 ? 1 : 0 }); }
      /* the few beyond the ends sit on the edge, drawn hollow; their card has the real margin */
      S.t = function (v) { return v == null || !isFinite(v) ? null : Math.max(S.min, Math.min(S.max, v)); };
      S.out = function (v) { return v != null && isFinite(v) && (v < S.min || v > S.max); };
    }
    return S;
  }
  var SC = {}; ORDER.forEach(function (k) { SC[k] = buildScale(k); });

  /* ---------- per company: largest owner, search text ---------- */
  C.forEach(function (c) {
    var own = (c.o || []).slice().sort(function (a, b) { return (b[1] == null ? -1 : b[1]) - (a[1] == null ? -1 : a[1]); });
    c.lo = own[0] || null;
    c.hay = [c.n, c.l, shortName(c), c.p != null ? PV[c.p] : '', c.c, c.s != null ? SK[c.s] : '', c.tk, TYPES[c.t]]
      .concat((c.o || []).map(function (o) { return o[0]; })).filter(Boolean).join(' ').toLowerCase();
  });

  /* ---------- state ---------- */
  var state = { x: PRESETS[0].x, y: PRESETS[0].y, preset: 0, kind: 'all', prov: '', pinned: null, shown: null };
  var match = function (c) { return (state.kind === 'all' ? c.t !== 'jv' : c.t === state.kind) && (!state.prov || (c.p != null && PV[c.p] === state.prov)); };
  var wideMq = window.matchMedia ? window.matchMedia('(min-width: 1000px)') : null;
  var wide = function () { return wideMq ? wideMq.matches : window.innerWidth >= 1000; };

  /* ---------- controls ---------- */
  var pBox = $('#bm-presets'), sx = $('#bm-x'), sy = $('#bm-y'), spv = $('#bm-pv'), kBox = $('#bm-kinds');
  if (!pBox || !sx || !sy || !spv || !kBox) return;
  PRESETS.forEach(function (p, i) {
    pBox.append(el('button', { class: 'chip', type: 'button', 'aria-pressed': i === 0 ? 'true' : 'false', 'data-i': i,
      onclick: function () { state.preset = i; state.x = p.x; state.y = p.y; sync(); draw(); } }, p.name, el('b', { text: p.sub })));
  });
  ORDER.forEach(function (k) { sx.append(el('option', { value: k, text: AX[k].label })); sy.append(el('option', { value: k, text: AX[k].label })); });
  function pick() { state.preset = PRESETS.findIndex(function (p) { return p.x === state.x && p.y === state.y; }); sync(); draw(); }
  sx.addEventListener('change', function () { state.x = sx.value; pick(); });
  sy.addEventListener('change', function () { state.y = sy.value; pick(); });
  var provs = {};
  CH.forEach(function (c) { if (c.p != null) provs[PV[c.p]] = (provs[PV[c.p]] || 0) + 1; });
  spv.append(el('option', { value: '', text: 'All provinces' }));
  Object.keys(provs).sort().forEach(function (p) { spv.append(el('option', { value: p, text: p + ' (' + provs[p] + ')' })); });
  spv.addEventListener('change', function () { state.prov = spv.value; kinds(); draw(); });
  function kinds() {
    kBox.replaceChildren();
    var inProv = CH.filter(function (c) { return !state.prov || (c.p != null && PV[c.p] === state.prov); });
    [['all', 'All BUMD', inProv.filter(function (c) { return c.t !== 'jv'; }).length]].concat(KINDS.map(function (k) {
      return [k, TYPES[k] || k, inProv.filter(function (c) { return c.t === k; }).length];
    })).forEach(function (k) {
      kBox.append(el('button', { class: 'chip', type: 'button', 'aria-pressed': state.kind === k[0] ? 'true' : 'false', 'data-k': k[0],
        disabled: !k[2] && state.kind !== k[0], title: k[2] ? null : 'No published figures for these in this data',
        onclick: function () { state.kind = k[0]; kinds(); draw(); } }, k[1], el('b', { text: String(k[2]) })));
    });
  }
  function sync() {
    sx.value = state.x; sy.value = state.y;
    Array.prototype.forEach.call(pBox.children, function (b) { b.setAttribute('aria-pressed', Number(b.dataset.i) === state.preset ? 'true' : 'false'); });
  }
  kinds(); sync();

  /* ---------- the field ---------- */
  var stage = $('#bm-stage'), field = $('#bm-field'), grid = $('#bm-grid'), bl = $('#bm-badges'), ll = $('#bm-labs'),
      card = $('#bm-card'), idle = $('#bm-idle'), foot = $('#bm-foot');
  var badges = {};
  function badgeFor(c) {
    if (badges[c.i]) return badges[c.i];
    var b = el('button', { class: 'bm-b', type: 'button', 'aria-label': c.n, 'data-id': c.i,
      onmouseenter: function () { if (!state.pinned && wide()) show(c, false); }, onmouseleave: function () { if (!state.pinned && wide()) hide(); },
      /* a preview only where it has a side panel to sit in: on a phone a tap pins the card instead */
      onfocus: function () { if (!state.pinned && wide()) show(c, false); }, onblur: function () { if (!state.pinned && wide()) hide(); },
      onclick: function (ev) { ev.stopPropagation(); if (state.pinned === c.i) unpin(); else pin(c); } });
    logoIn(b, c);
    badges[c.i] = b; bl.append(b);
    return b;
  }
  var measure = document.createElement('canvas').getContext('2d');
  function tw(s, size, ls) { measure.font = '400 ' + size + 'px "IBM Plex Mono", monospace'; return measure.measureText(s).width + (ls || 0) * Math.max(0, s.length - 1); }
  function median(a) { var s = a.slice().sort(numSort), m = s.length >> 1; return !s.length ? null : s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  /* geometry for the label rule: nothing may sit on a name */
  var rectHit = function (a, b) { return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1; };
  function circHit(cx, cy, r, q) { var nx = Math.max(q.x1, Math.min(cx, q.x2)), ny = Math.max(q.y1, Math.min(cy, q.y2)); return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r; }
  function segHit(x1, y1, x2, y2, q) {
    /* Liang–Barsky clip of the segment against the box */
    var t0 = 0, t1 = 1, dx = x2 - x1, dy = y2 - y1, p = [-dx, dx, -dy, dy], qq = [x1 - q.x1, q.x2 - x1, y1 - q.y1, q.y2 - y1];
    for (var i = 0; i < 4; i++) {
      if (p[i] === 0) { if (qq[i] < 0) return false; }
      else { var r = qq[i] / p[i]; if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
    }
    return t0 <= t1;
  }
  var last = { pts: [], pos: {}, quads: null };

  function draw() {
    var Wf = field.clientWidth;
    if (!Wf) return;
    var narrow = Wf < 640;
    field.classList.toggle('nw', narrow);
    var d = narrow ? 24 : 30, fsz = narrow ? 9.5 : 10.5, dotR = narrow ? 2.6 : 3;
    var kx = state.x, ky = state.y, SX = SC[kx], SY = SC[ky], AXx = AX[kx], AXy = AX[ky];
    var placed = [], dims = [], laneX = [], laneY = [], none = [], outs = 0;
    CH.forEach(function (c) {
      var vx = AXx.get(c), vy = AXy.get(c), tx = SX.t(vx), ty = SY.t(vy), m = match(c);
      var r = { c: c, tx: tx, ty: ty, hollow: SX.out(vx) || SY.out(vy) };
      if (tx != null && ty != null) { (m ? placed : dims).push(r); if (m && r.hollow) outs++; }
      else if (!m) return;
      else if (ty != null) laneX.push(r);
      else if (tx != null) laneY.push(r);
      else none.push(r);
    });
    /* who carries a logo: the largest by assets among the companies shown */
    var NB = narrow ? 24 : 60;
    var cand = placed.concat(laneX, laneY).filter(function (r) { return FA(r.c) != null; }).sort(function (a, b) { return FA(b.c) - FA(a.c); });
    var isB = {}; cand.slice(0, NB).forEach(function (r) { r.b = true; isB[r.c.i] = 1; });

    /* ---- frame ---- */
    var padR = 12;
    var yLabs = SY.ticks.map(function (t) { return t.lab; }).concat(laneY.length ? ['—'] : []);
    var tickW = Math.max.apply(null, yLabs.map(function (s) { return tw(s, fsz); }).concat([10]));
    var axL = Math.ceil(tickW) + 14;
    var laneLW = laneX.length ? d + 14 : 0, gapL = laneLW ? 8 : 0;
    var laneL = axL, left = axL + laneLW + gapL, right = Wf - padR;
    /* quadrant names first: the frame makes room for them (two lines on a phone) */
    var ly = AXy.low, lx = AXx.low;
    var qn = { tl: 'High ' + ly + ', low ' + lx, tr: 'High on both', bl: 'Low on both', br: 'High ' + lx + ', low ' + ly };
    var half = Math.max(60, (right - left) / 2 - 10), qh = {};
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) { var q = $('#bm-q-' + k); q.textContent = qn[k]; q.style.maxWidth = half + 'px'; qh[k] = q.offsetHeight || 14; });
    var padT = 22 + Math.max(qh.tl, qh.tr) + 8;
    var plotH = narrow ? Math.round(Math.max(320, Math.min(480, Wf * 1.06))) : Math.round(Math.max(420, Math.min(640, (right - left) * 0.8)));
    var top = padT, bot = top + plotH;
    var laneBH = laneY.length ? d + 14 : 0, gapB = laneBH ? 8 : 0;
    var laneBT = bot + gapB, laneBB = laneBT + laneBH;
    var base = laneBH ? laneBB : bot;
    var tickY = base + 15, cornerY = base + 24, titleY = cornerY + Math.max(qh.bl, qh.br) + (narrow ? 16 : 18);
    var H = titleY + 12;
    /* the svg fills the padding box: size the box so its viewBox maps 1:1 to the badges and names above it */
    field.style.height = (H + (field.offsetHeight - field.clientHeight || 2)) + 'px';
    var X = function (t) { return left + (t - SX.d0) / (SX.d1 - SX.d0) * (right - left); };
    var Y = function (t) { return bot - (t - SY.d0) / (SY.d1 - SY.d0) * (bot - top); };
    placed.concat(dims).forEach(function (r) { r.x = r.ax = X(r.tx); r.y = r.ay = Y(r.ty); });
    laneX.forEach(function (r) { r.x = r.ax = laneL + laneLW / 2; r.y = r.ay = Y(r.ty); r.lane = 'x'; });
    laneY.forEach(function (r) { r.x = r.ax = X(r.tx); r.y = r.ay = laneBT + laneBH / 2; r.lane = 'y'; });

    /* ---- logos: exact spot first, pushed apart only as far as they must be, inside their own area ---- */
    var R = d / 2 + 2, hd = d / 2 + 2, BR = d / 2 * 1.12 + 1.5, nodes, placedLabs;
    function layout() {
      nodes = placed.concat(laneX, laneY).filter(function (r) { return r.b; });
      nodes.forEach(function (n) { n.x = n.ax; n.y = n.ay; n.named = false; });
      /* a lane is one line: lay it out like labels on an axis, overlapping runs merged and centred on their mean */
      function line1d(list, key, lo, hi) {
        var gs = list.slice().sort(function (a, b) { return a['a' + key] - b['a' + key]; }).map(function (n) { return { m: [n], c: n['a' + key] }; });
        var span = function (g) { return (g.m.length - 1) * 2 * R; };
        var fit = function (g) { g.c = Math.max(lo + span(g) / 2, Math.min(hi - span(g) / 2, g.c)); };
        gs.forEach(fit);
        for (var guard = 0; guard < 400; guard++) {
          var merged = false;
          for (var i = 0; i + 1 < gs.length; i++) {
            var A = gs[i], B = gs[i + 1];
            if (A.c + span(A) / 2 + 2 * R > B.c - span(B) / 2 + 0.01) {
              var m = A.m.concat(B.m);
              var g = { m: m, c: m.reduce(function (s, n) { return s + n['a' + key]; }, 0) / m.length };
              fit(g); gs.splice(i, 2, g); merged = true; break;
            }
          }
          if (!merged) break;
        }
        gs.forEach(function (g) { g.m.forEach(function (n, i) { n[key] = g.c - span(g) / 2 + i * 2 * R; }); });
      }
      var inPlot = nodes.filter(function (n) { return !n.lane; });
      line1d(nodes.filter(function (n) { return n.lane === 'y'; }), 'x', left + hd, right - hd);
      line1d(nodes.filter(function (n) { return n.lane === 'x'; }), 'y', top + hd, bot - hd);
      var bxp = { x1: left + hd, x2: right - hd, y1: top + hd, y2: bot - hd };
      for (var it = 0; it < 420; it++) {
        for (var a = 0; a < inPlot.length; a++) for (var b2 = a + 1; b2 < inPlot.length; b2++) {
          var A = inPlot[a], B = inPlot[b2], dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
          if (dist < 2 * R) {
            if (dist < 0.01) { dx = (b2 % 2 ? 1 : -1) * 0.5; dy = (a % 2 ? 0.5 : -0.5); dist = 0.7; }
            var push = (2 * R - dist) / 2, ux = dx / dist, uy = dy / dist;
            A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push;
          }
        }
        var k = it < 300 ? 0.02 : 0;
        inPlot.forEach(function (n) {
          n.x += (n.ax - n.x) * k; n.y += (n.ay - n.y) * k;
          n.x = Math.max(bxp.x1, Math.min(bxp.x2, n.x)); n.y = Math.max(bxp.y1, Math.min(bxp.y2, n.y));
        });
      }

      /* ---- obstacles a name must not touch: dots, logos, hairlines, the axis break ---- */
      var circles = [], rects = [];
      dims.forEach(function (r) { circles.push({ x: r.x, y: r.y, r: 2.2 + 1 }); });
      placed.concat(laneX, laneY).forEach(function (r) { circles.push(r.b ? { x: r.ax, y: r.ay, r: 2.4 + 1 } : { x: r.x, y: r.y, r: dotR + 1 }); });
      nodes.forEach(function (n) { n.circ = { x: n.x, y: n.y, r: BR }; n.seg = null; });
      var lead = function (n) { n.seg = Math.hypot(n.x - n.ax, n.y - n.ay) > 4 ? [n.ax, n.ay, n.x, n.y] : null; n.circ.x = n.x; n.circ.y = n.y; };
      nodes.forEach(lead);
      if (SX.zero) { var zx = X(SX.brk); rects.push({ x1: zx - 6, y1: bot - 7, x2: zx + 6, y2: bot + 7 }); }
      if (SY.zero) { var zy = Y(SY.brk); rects.push({ x1: left - 7, y1: zy - 6, x2: left + 7, y2: zy + 6 }); }

      /* ---- names: the largest first, each where it covers nothing. A logo whose name has no room may
         step aside (a hairline keeps it tied to its exact spot); a name that still has no room is dropped.
         A name in a lane may run out into the plot, and the lane's edge and the frame stop before it ---- */
      ll.replaceChildren();
      var meas = el('span', { class: 'bm-l', style: 'visibility:hidden;left:0;top:0' }); ll.append(meas);
      placedLabs = [];
      var free = function (q) {
        var i;
        for (i = 0; i < rects.length; i++) if (rectHit(q, rects[i])) return false;
        for (i = 0; i < placedLabs.length; i++) if (rectHit(q, placedLabs[i])) return false;
        for (i = 0; i < circles.length; i++) if (circHit(circles[i].x, circles[i].y, circles[i].r, q)) return false;
        for (i = 0; i < nodes.length; i++) {
          var m = nodes[i];
          if (circHit(m.circ.x, m.circ.y, m.circ.r, q)) return false;
          if (m.seg && segHit(m.seg[0], m.seg[1], m.seg[2], m.seg[3], q)) return false;
        }
        return true;
      };
      var areaOf = function (n) {
        return n.lane === 'x' ? { x1: laneL + 2, x2: right - 2, y1: top + 2, y2: bot - 2 }
          : n.lane === 'y' ? { x1: left + 2, x2: right - 2, y1: top + 2, y2: laneBB - 2 }
          : { x1: left + 2, x2: right - 2, y1: top + 2, y2: bot - 2 };
      };
      function spot(n, w, h, area) {
        var rr = d / 2 * 1.12, g = 3, x = n.x, y = n.y;
        var tries = [[x + rr + g, y - h / 2], [x - rr - g - w, y - h / 2], [x - w / 2, y + rr + 1], [x - w / 2, y - rr - 1 - h],
          [x + rr * 0.72 + g, y - rr - h + 5], [x + rr * 0.72 + g, y + rr - 5], [x - rr * 0.72 - g - w, y - rr - h + 5], [x - rr * 0.72 - g - w, y + rr - 5],
          [x - rr * 0.4, y + rr + 1], [x + rr * 0.4 - w, y + rr + 1], [x - rr * 0.4, y - rr - 1 - h], [x + rr * 0.4 - w, y - rr - 1 - h],
          [x - w / 2, y - rr - 7 - h], [x - rr * 0.4, y - rr - 7 - h], [x + rr * 0.4 - w, y - rr - 7 - h], [x - w / 2, y + rr + 7]];
        for (var t = 0; t < tries.length; t++) {
          var q = { x1: tries[t][0] - 1, y1: tries[t][1] - 1, x2: tries[t][0] + w + 1, y2: tries[t][1] + h + 1 };
          if (q.x1 < area.x1 || q.x2 > area.x2 || q.y1 < area.y1 || q.y2 > area.y2 || !free(q)) continue;
          return { x: tries[t][0], y: tries[t][1], q: q };
        }
        return null;
      }
      /* may this logo stand at (x, y)? clear of the other logos, of every name, and its hairline too */
      function canStand(n, x, y, area) {
        if (n.lane === 'x' || n.lane === 'y') return false;
        if (x < area.x1 + d / 2 || x > area.x2 - d / 2 || y < area.y1 + d / 2 || y > area.y2 - d / 2) return false;
        for (var i = 0; i < nodes.length; i++) { var m = nodes[i]; if (m !== n && Math.hypot(m.x - x, m.y - y) < 2 * R) return false; }
        for (var j = 0; j < placedLabs.length; j++) {
          var q = placedLabs[j];
          if (circHit(x, y, BR, q) || segHit(n.ax, n.ay, x, y, q)) return false;
        }
        return true;
      }
      nodes.slice().sort(function (p, q) { return FA(q.c) - FA(p.c); }).forEach(function (n) {
        var name = shortName(n.c);
        meas.textContent = name;
        var w = meas.offsetWidth, h = meas.offsetHeight, area = areaOf(n);
        var got = spot(n, w, h, area);
        if (!got && !n.lane) {
          var ox = n.x, oy = n.y, step = d * 0.55;
          search: for (var ring = 1; ring <= 7; ring++) {
            for (var k2 = 0; k2 < 16; k2++) {
              var ang = k2 / 16 * Math.PI * 2 + (ring % 2 ? Math.PI / 16 : 0);
              var cx = ox + Math.cos(ang) * ring * step, cy = oy + Math.sin(ang) * ring * step;
              if (!canStand(n, cx, cy, area)) continue;
              n.x = cx; n.y = cy; lead(n);
              got = spot(n, w, h, area);
              if (got) break search;
              n.x = ox; n.y = oy; lead(n);
            }
          }
        }
        if (!got) return;
        n.named = true;
        ll.append(el('span', { class: 'bm-l', text: name, 'data-id': n.c.i, style: 'left:' + got.x.toFixed(1) + 'px;top:' + got.y.toFixed(1) + 'px' }));
        placedLabs.push({ x1: got.q.x1 - 1, y1: got.q.y1 - 1, x2: got.q.x2 + 1, y2: got.q.y2 + 1 });
      });
      meas.remove();
      nodes.forEach(function (n) { n.lead = !!n.seg; });
    }
    /* a logo tells who it is without a name; initials do not: a company without a logo whose name finds
       no room is drawn as a dot instead, and the names are laid out again with the room that frees */
    for (var pass = 0; pass < 2; pass++) {
      layout();
      var drop = nodes.filter(function (n) { return !n.named && !n.c.g; });
      if (!drop.length) break;
      drop.forEach(function (n) { n.b = false; n.lead = false; n.seg = null; n.x = n.ax; n.y = n.ay; delete isB[n.c.i]; });
      if (pass === 1) { nodes = nodes.filter(function (n) { return n.b; }); }
    }

    /* ---- the grid: every rule stops before a name ---- */
    grid.replaceChildren(); grid.setAttribute('viewBox', '0 0 ' + Wf + ' ' + H);
    var mono = 'IBM Plex Mono, monospace';
    function rule(x1, y1, x2, y2, attrs) {
      var segsOut = [[x1, y1, x2, y2]];
      placedLabs.forEach(function (q) {
        var nxt = [];
        segsOut.forEach(function (s) {
          if (s[0] === s[2]) {   /* vertical */
            var lo = Math.min(s[1], s[3]), hi = Math.max(s[1], s[3]);
            if (s[0] <= q.x1 - 1 || s[0] >= q.x2 + 1 || hi <= q.y1 - 1 || lo >= q.y2 + 1) { nxt.push(s); return; }
            if (q.y1 - 1 > lo) nxt.push([s[0], lo, s[0], q.y1 - 1]);
            if (q.y2 + 1 < hi) nxt.push([s[0], q.y2 + 1, s[0], hi]);
          } else {             /* horizontal */
            var lx = Math.min(s[0], s[2]), hx = Math.max(s[0], s[2]);
            if (s[1] <= q.y1 - 1 || s[1] >= q.y2 + 1 || hx <= q.x1 - 1 || lx >= q.x2 + 1) { nxt.push(s); return; }
            if (q.x1 - 1 > lx) nxt.push([lx, s[1], q.x1 - 1, s[1]]);
            if (q.x2 + 1 < hx) nxt.push([q.x2 + 1, s[1], hx, s[1]]);
          }
        });
        segsOut = nxt;
      });
      segsOut.forEach(function (s) { if (Math.hypot(s[2] - s[0], s[3] - s[1]) > 0.5) grid.append(sv('line', Object.assign({ x1: s[0], y1: s[1], x2: s[2], y2: s[3] }, attrs))); });
    }
    function text(x, y, s, attrs) { var t = sv('text', Object.assign({ x: x, y: y, fill: '#6B6B73', 'font-family': mono, 'font-size': fsz }, attrs)); t.textContent = s; grid.append(t); return t; }
    /* x ticks, thinned so no two numbers touch */
    var lastX = -1e9, xTicks = [];
    if (laneX.length) { var lc = laneL + laneLW / 2; text(lc, tickY, '—', { 'text-anchor': 'middle' }); lastX = lc + tw('—', fsz) / 2; }
    SX.ticks.forEach(function (t) {
      var x = X(t.t), w = tw(t.lab, fsz);
      if (x - w / 2 < lastX + 8 || x + w / 2 > Wf - 2 || x < left - 1 || x > right + 1) return;
      xTicks.push(t); text(x, tickY, t.lab, { 'text-anchor': 'middle' }); lastX = x + w / 2;
    });
    var lastY = 1e9, yTicks = [];
    if (laneY.length) { var lyc = laneBT + laneBH / 2; text(axL - 8, lyc + 3.5, '—', { 'text-anchor': 'end' }); lastY = lyc - 6; }
    SY.ticks.forEach(function (t) {
      var y = Y(t.t);
      if (y > lastY - 13 || y < top - 1 || y > bot + 1) return;
      yTicks.push(t); text(axL - 8, y + 3.5, t.lab, { 'text-anchor': 'end' }); lastY = y;
    });
    xTicks.forEach(function (t) { rule(X(t.t), top, X(t.t), bot, { stroke: t.z ? '#A9AAA4' : '#E6E7E1', 'stroke-width': 1 }); });
    yTicks.forEach(function (t) { rule(left, Y(t.t), right, Y(t.t), { stroke: t.z ? '#A9AAA4' : '#E6E7E1', 'stroke-width': 1 }); });
    /* medians of the companies shown (both figures) */
    var mx = median(placed.map(function (r) { return r.tx; })), my = median(placed.map(function (r) { return r.ty; }));
    if (mx != null) rule(X(mx), top, X(mx), bot, { stroke: '#B9BBB4', 'stroke-width': 1.5 });
    if (my != null) rule(left, Y(my), right, Y(my), { stroke: '#B9BBB4', 'stroke-width': 1.5 });
    var box4 = function (x1, y1, x2, y2, attrs) { rule(x1, y1, x2, y1, attrs); rule(x2, y1, x2, y2, attrs); rule(x1, y2, x2, y2, attrs); rule(x1, y1, x1, y2, attrs); };
    box4(left, top, right, bot, { stroke: '#DADBD5', 'stroke-width': 1 });
    if (laneLW) box4(laneL, top, laneL + laneLW, bot, { stroke: '#C9CBC4', 'stroke-dasharray': '3 3' });
    if (laneBH) box4(left, laneBT, right, laneBB, { stroke: '#C9CBC4', 'stroke-dasharray': '3 3' });
    /* the axis break before a published zero */
    if (SX.zero) { var bx = X(SX.brk); grid.append(sv('path', { d: 'M' + (bx - 5) + ' ' + (bot + 5) + 'l4 -10M' + (bx + 1) + ' ' + (bot + 5) + 'l4 -10', stroke: '#9A9AA0', 'stroke-width': 1.2, fill: 'none' })); }
    if (SY.zero) { var by = Y(SY.brk); grid.append(sv('path', { d: 'M' + (left - 5) + ' ' + (by + 1) + 'l10 -4M' + (left - 5) + ' ' + (by + 6) + 'l10 -4', stroke: '#9A9AA0', 'stroke-width': 1.2, fill: 'none' })); }
    /* axis names */
    text((left + right) / 2, titleY, (AXx.label + (AXx.note ? ', ' + AXx.note : '') + ' →').toUpperCase(), { 'text-anchor': 'middle', fill: '#3F3F46', 'font-size': narrow ? 10 : 11, 'letter-spacing': '1' });
    text(2, 14, ('↑ ' + AXy.label + (AXy.note ? ', ' + AXy.note : '')).toUpperCase(), { 'text-anchor': 'start', fill: '#3F3F46', 'font-size': narrow ? 10 : 11, 'letter-spacing': '1' });
    /* marks: faded dots for companies outside the filter, then hairlines from a moved logo to its exact spot, then the dots */
    var gd = sv('g', {});
    dims.forEach(function (r) { gd.append(sv('circle', { cx: r.x.toFixed(1), cy: r.y.toFixed(1), r: 2.2, fill: '#D3D4CE' })); });
    nodes.forEach(function (n) { if (n.lead) gd.append(sv('line', { x1: n.ax.toFixed(1), y1: n.ay.toFixed(1), x2: n.x.toFixed(1), y2: n.y.toFixed(1), stroke: '#B4B7B1', 'stroke-width': 1 })); });
    placed.concat(laneX, laneY).forEach(function (r) {
      if (r.b) { gd.append(sv('circle', { cx: r.ax.toFixed(1), cy: r.ay.toFixed(1), r: 2.4, fill: '#3F3F46' })); return; }
      gd.append(r.hollow ? sv('circle', { cx: r.x.toFixed(1), cy: r.y.toFixed(1), r: dotR, fill: '#F7F8F4', stroke: '#3F3F46', 'stroke-width': 1.2 })
        : sv('circle', { cx: r.x.toFixed(1), cy: r.y.toFixed(1), r: dotR, fill: '#3F3F46', 'fill-opacity': 0.62, stroke: '#F7F8F4', 'stroke-width': 0.6 }));
    });
    grid.append(gd);
    grid.append(sv('g', { id: 'bm-hl' }));

    /* the logos */
    Object.keys(badges).forEach(function (id) { if (!isB[id]) { badges[id].hidden = true; badges[id].classList.remove('on'); } });
    nodes.forEach(function (n) {
      var bb = badgeFor(n.c); bb.hidden = false;
      bb.style.setProperty('--d', d + 'px'); bb.style.left = n.x.toFixed(1) + 'px'; bb.style.top = n.y.toFixed(1) + 'px';
    });

    /* quadrant names, placed like /bumn's: above and below the plot, each within its half */
    ['tl', 'tr', 'bl', 'br'].forEach(function (k) {
      var q = $('#bm-q-' + k); if (mx == null || my == null) q.textContent = '';
      q.style.left = q.style.right = '';
      if (k[1] === 'l') q.style.left = left + 'px'; else q.style.right = (Wf - right) + 'px';
      q.style.top = (k[0] === 't' ? 22 : cornerY) + 'px';
    });

    /* hover and tap targets: the dots of the companies shown (logos handle themselves) */
    last.pts = placed.concat(laneX, laneY).filter(function (r) { return !r.b; }).map(function (r) { return { x: r.x, y: r.y, c: r.c }; });
    last.pos = {};
    placed.concat(laneX, laneY, dims).forEach(function (r) { last.pos[r.c.i] = { x: r.b ? r.ax : r.x, y: r.b ? r.ay : r.y }; });

    /* the foot and the idle panel */
    foot.replaceChildren();
    var nShown = placed.length + laneX.length + laneY.length + none.length;
    foot.append(el('span', { text: narrow ? 'Tap a mark' : 'Hover or tap a mark' }), el('span', { text: '/' }),
      el('span', null, el('b', { text: String(placed.length) }), ' of ' + nShown + ' placed on both axes'));
    if (laneX.length || laneY.length) foot.append(el('span', { text: '/' }), el('span', null, el('b', { text: String(laneX.length + laneY.length) }), ' in a — lane: no figure for that axis'));
    if (none.length) foot.append(el('span', { text: '/' }), el('span', null, el('b', { text: String(none.length) }), ' not placed: neither figure'));
    if (outs) foot.append(el('span', { text: '/' }), el('span', null, el('b', { text: String(outs) }), ' hollow: beyond the scale, on its edge'));
    foot.append(el('span', { text: '/' }), el('span', { text: 'Lines at the median' }));
    var cnt = { tl: [], tr: [], bl: [], br: [] };
    if (mx != null && my != null) placed.forEach(function (r) { cnt[(r.ty >= my ? 't' : 'b') + (r.tx >= mx ? 'r' : 'l')].push(r.c); });
    last.quads = { qn: qn, cnt: cnt, lanes: laneX.concat(laneY).map(function (r) { return r.c; }), none: none.map(function (r) { return r.c; }), kx: kx, ky: ky };
    renderIdle();
    highlight();
  }

  function renderIdle() {
    var Q = last.quads; if (!Q) return;
    idle.replaceChildren(el('div', { class: 'k', text: 'Who sits where · ' + AX[Q.kx].label + ' × ' + AX[Q.ky].label }));
    var big = function (list) { return list.slice().sort(function (a, b) { return (FA(b) || -1) - (FA(a) || -1); }).map(shortName); };
    var line = function (title, list) {
      var names = big(list);
      idle.append(el('div', { class: 'qd' }, el('b', { text: title }), el('span', { text: String(list.length) }),
        el('p', { text: names.length ? names.slice(0, 6).join(', ') + (names.length > 6 ? ' and ' + (names.length - 6) + ' more' : '') : 'None' })));
    };
    ['tr', 'tl', 'br', 'bl'].forEach(function (k) { line(Q.qn[k], Q.cnt[k]); });
    if (Q.lanes.length) line('In a — lane', Q.lanes);
    if (Q.none.length) line('Not placed', Q.none);
    idle.append(el('p', { class: 'k', style: 'margin-top:10px', text: 'Tap a mark for its card' }));
  }

  /* ---------- hover and tap on the dots ---------- */
  function nearest(ev, rad) {
    var r = field.getBoundingClientRect(), px = ev.clientX - r.left, py = ev.clientY - r.top, best = null, bd = rad * rad;
    last.pts.forEach(function (p) { var dd = (p.x - px) * (p.x - px) + (p.y - py) * (p.y - py); if (dd < bd) { bd = dd; best = p.c; } });
    return best;
  }
  field.addEventListener('pointermove', function (ev) {
    if (ev.pointerType && ev.pointerType !== 'mouse') return;
    if (state.pinned || !wide() || (ev.target.closest && ev.target.closest('.bm-b'))) return;
    var c = nearest(ev, 9);
    if (c) { if (state.shown !== c.i) show(c, false); field.style.cursor = 'pointer'; }
    else { field.style.cursor = ''; if (state.shown) hide(); }
  });
  field.addEventListener('pointerleave', function (ev) {
    if (ev.pointerType && ev.pointerType !== 'mouse') return;
    field.style.cursor = ''; if (!state.pinned && state.shown) hide();
  });
  field.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('.bm-b')) return;
    var c = nearest(ev, ev.pointerType === 'mouse' ? 10 : 18);
    if (!c) return;
    ev.stopPropagation();
    if (state.pinned === c.i) unpin(); else pin(c);
  });
  document.addEventListener('click', function (ev) { if (state.pinned && !card.contains(ev.target)) unpin(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && (state.pinned || state.shown)) unpin(); });

  function highlight() {
    var g = document.getElementById('bm-hl');
    Object.keys(badges).forEach(function (id) { badges[id].classList.toggle('on', id === state.shown); });
    if (!g) return;
    g.replaceChildren();
    var id = state.shown;
    if (!id || badges[id] && !badges[id].hidden) return;
    var p = last.pos[id];
    if (p) g.append(sv('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 7, fill: 'none', stroke: '#000', 'stroke-width': 1.6 }));
  }

  /* ---------- the card: side panel on wide screens, bottom sheet under 1000 px ---------- */
  function sec(title, count) { return el('div', { class: 'sec' }, el('div', { class: 'h' }, el('b', { text: title }), count != null ? el('span', { text: count }) : null)); }
  function moreList(box, rows, first, label) {
    var list = el('div');
    rows.forEach(function (r, i) { if (i >= first) r.hidden = true; list.append(r); });
    box.append(list);
    if (rows.length > first) box.append(el('button', { class: 'more', type: 'button', text: label || 'Show all ' + rows.length,
      onclick: function (ev) { ev.stopPropagation(); Array.prototype.forEach.call(list.children, function (c) { c.hidden = false; }); ev.currentTarget.remove(); } }));
  }
  function fig(k, v, unit, u, y, sub) {
    var c = el('div', { class: 'fig' }, el('div', { class: 'k', text: k }));
    if (v == null) { c.append(el('div', { class: 'v', title: 'Not published', text: '—' })); return c; }
    var t = unit === '%' ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + '%' : money(v, unit);
    c.append(el('div', { class: 'v' }, u ? el('a', { href: u, target: '_blank', rel: 'noopener', title: 'Source: ' + host(u), text: t }) : t));
    c.append(el('div', { class: 'p', text: sub || (y ? 'FY' + y : '') }));
    return c;
  }
  function yearStrip(c) {
    var fs = c.fs; if (!fs || !Array.isArray(fs[0]) || !fs[0].length) return null;
    var ys = fs[0], rv = fs[1] || [], pf = fs[2] || [], su = url(fs[3]), by = fs[4] || '', unit = fs[5] || 'Rp bn';
    var any = rv.concat(pf).some(function (v) { return v != null; });
    if (!any) return null;
    var box = el('div', { class: 'yr' });
    var h = el('div', { class: 'h' }, el('b', { text: 'By year · ' + (unit === 'US$ m' ? 'US$' : 'Rp') }));
    if (su) h.append(el('span', null, el('a', { href: su, target: '_blank', rel: 'noopener', text: by || host(su) })));
    box.append(h);
    var g = el('div', { class: 'bm-yg', style: '--n:' + ys.length });
    g.append(el('span'));
    ys.forEach(function (y) { g.append(el('span', { class: 'yh', text: String(y) })); });
    var maxR = Math.max.apply(null, rv.filter(function (v) { return v != null; }).map(Math.abs).concat([0])) || 1;
    var ps = pf.filter(function (v) { return v != null; }), maxP = Math.max.apply(null, ps.map(Math.abs).concat([0])) || 1, mixed = ps.some(function (v) { return v < 0; }) && ps.some(function (v) { return v > 0; });
    var neg = ps.length && ps.every(function (v) { return v <= 0; });
    var cell = function (v, max, kind) {
      var bx = el('span', { class: 'bx' }), H = 26;
      if (v != null) {
        if (kind === 'r') bx.append(el('i', { style: 'bottom:0;height:' + Math.max(1, Math.abs(v) / max * H).toFixed(1) + 'px' }));
        else if (mixed) {
          var hh = Math.max(1, Math.abs(v) / max * (H / 2 - 1));
          bx.append(el('span', { class: 'z', style: 'top:' + (H / 2) + 'px' }));
          bx.append(el('i', { class: v < 0 ? 'ng' : null, style: (v < 0 ? 'top:' + (H / 2 + 1) : 'bottom:' + (H / 2)) + 'px;height:' + hh.toFixed(1) + 'px' }));
        } else if (neg) {
          bx.append(el('span', { class: 'z', style: 'top:0' }));
          bx.append(el('i', { class: 'ng', style: 'top:1px;height:' + Math.max(1, Math.abs(v) / max * (H - 1)).toFixed(1) + 'px' }));
        } else bx.append(el('i', { style: 'bottom:0;height:' + Math.max(1, Math.abs(v) / max * H).toFixed(1) + 'px' }));
      }
      return el('span', { class: 'c' }, bx, el('span', { class: 'vl' + (v == null ? ' na' : ''), title: v == null ? 'Not published' : money(v, unit), text: v == null ? '—' : (unit === 'US$ m' ? money(v, unit) : compact(v)) }));
    };
    g.append(el('span', { class: 'rk', text: 'Revenue' }));
    ys.forEach(function (y, i) { g.append(cell(rv[i] == null ? null : rv[i], maxR, 'r')); });
    g.append(el('span', { class: 'rk', text: 'Net profit' }));
    ys.forEach(function (y, i) { g.append(cell(pf[i] == null ? null : pf[i], maxP, 'p')); });
    box.append(g);
    return box;
  }
  function tieRow(t, me) {
    var o = other(t, me);
    var meta = el('span', { class: 'm' }, (t[4] === 's' ? 'Company’s word' : 'Confirmed') + (t[5] ? ' · ' + when(t[5]) : '') + (url(t[6]) ? ' · ' : ''));
    if (url(t[6])) meta.append(srcLink(url(t[6])));
    return el('div', { class: 'bm-tie' }, el('span', { class: 'r', text: relWord(t, me) }), el('span', { class: 'c' }, nameLink(o)),
      t[3] ? el('span', { class: 'd', text: t[3] }) : null, meta);
  }
  function show(c, pin) {
    state.shown = c.i;
    card.replaceChildren();
    var lg = logoIn(el('div', { class: 'lg' }), c);
    var bits = [TYPES[c.t] || c.t, c.f && FORM[c.f] ? FORM[c.f] : '', c.p != null ? PV[c.p] : '', c.c && c.c !== PV[c.p] ? c.c : ''].filter(Boolean);
    var info = el('div', null, el('div', { class: 'nm', text: c.n }), c.l ? el('div', { class: 'lgn', text: c.l }) : null, el('div', { class: 'cl', text: bits.join(' · ') + (c.tk ? ' · ' + c.tk : '') }));
    if (c.st) info.append(el('div', { class: 'stt', text: STATUS[c.st] || c.st }));
    var hd = el('div', { class: 'hd' }, lg, info);
    if (pin) hd.append(el('button', { class: 'x', type: 'button', 'aria-label': 'Close', text: '×', onclick: function (ev) { ev.stopPropagation(); unpin(); } }));
    card.append(hd);
    if (c.pg) card.append(el('a', { class: 'gm', href: '/bumd/' + encodeURIComponent(c.i) }, el('span', { text: 'Company page: owners, holdings and ties' }), el('span', { 'aria-hidden': 'true', text: '→' })));
    if (c.t === 'jv') card.append(el('p', { class: 'sx', text: 'A company in which a region holds a minority stake: shown apart from the BUMD and not counted with them.' }));
    if (c.d) card.append(el('p', { class: 'ds', text: c.d }));
    if (c.s != null && SK[c.s] && (c.t === 'other' || c.t === 'jv')) card.append(el('p', { class: 'sx', text: SK[c.s].charAt(0).toUpperCase() + SK[c.s].slice(1) }));
    /* figures: the latest published year, each linked to its source */
    if (c.x) {
      var y = FY(c), su = FU(c), unit = UNIT(c), mg = MARGIN(c);
      card.append(el('div', { class: 'figs' }, fig('Assets', FA(c), unit, su, y), fig('Revenue', FR(c), unit, su, y),
        fig('Net profit', FP(c), unit, su, y), fig('Net margin', mg, '%', null, y, mg == null ? '' : 'worked out here')));
    } else card.append(el('p', { class: 'nt', text: 'No published figures in this data.' }));
    (c.fn || []).forEach(function (f) {
      var p = el('p', { class: 'fn' }, f[0] ? el('b', { text: 'FY' + f[0] }) : null, f[1] + ' ');
      if (url(f[2])) p.append(srcLink(url(f[2])));
      card.append(p);
    });
    var ys = yearStrip(c); if (ys) card.append(ys);
    /* owners, the largest stake first */
    var own = (c.o || []).slice().sort(function (a, b) { return (b[1] == null ? -1 : b[1]) - (a[1] == null ? -1 : a[1]); });
    if (own.length || c.pa != null) {
      var so = sec('Owners', own.length ? own.length + (own.length === 1 ? ' owner' : ' owners') : null);
      if (c.pa != null) so.append(el('p', { class: 'nt' }, 'Subsidiary of ', nameLink(c.pa)));
      moreList(so, own.map(function (o) {
        var n = o[3] != null ? nameLink(o[3]) : o[4] ? el('a', { href: o[4], text: o[0] }) : document.createTextNode(o[0]);
        var u = url(o[2]);
        var st = o[1] != null ? (u ? el('a', { href: u, target: '_blank', rel: 'noopener', title: 'Source: ' + host(u), text: pct(o[1]) }) : pct(o[1])) : (u ? srcLink(u, 'source') : '');
        return el('div', { class: 'bm-row' }, el('span', { class: 'n' }, n), el('span', { class: 'p' }, st), o[5] ? el('span', { class: 's', text: 'As of ' + when(o[5]) }) : null);
      }), 6);
      card.append(so);
    }
    /* the board, as published */
    if (c.bd && c.bd.length) {
      var sb = sec('Board', c.bd.length + (c.bd.length === 1 ? ' person' : ' people'));
      [['d', 'Directors'], ['c', 'Commissioners and supervisors'], ['', 'Board']].forEach(function (k) {
        var rows = c.bd.filter(function (b) { return k[0] ? b[2] === k[0] : b[2] !== 'd' && b[2] !== 'c'; });
        if (!rows.length) return;
        sb.append(el('div', { class: 'sub-h', text: k[1] }));
        rows.forEach(function (b) { sb.append(el('div', { class: 'bm-row' }, el('span', { class: 'n', text: b[0] }), el('span', { class: 's', text: b[1] }))); });
      });
      if (url(c.bs)) sb.append(el('p', { class: 'nt' }, 'As published by ', srcLink(url(c.bs))));
      card.append(sb);
    }
    /* subsidiaries and the stakes it holds */
    var held = {}, hrows = [];
    (c.hd || []).forEach(function (h) { held[h[0]] = h; });
    (c.ch || []).forEach(function (r) { if (!held[r]) hrows.push([r, null, null, null]); });
    (c.hd || []).forEach(function (h) { hrows.push(h); });
    if (hrows.length) {
      var sh = sec('Subsidiaries and stakes', hrows.length + (hrows.length === 1 ? ' company' : ' companies'));
      moreList(sh, hrows.map(function (h) {
        var u = url(h[2]);
        return el('div', { class: 'bm-row' }, el('span', { class: 'n' }, nameLink(h[0])), el('span', { class: 'p' }, h[1] != null ? (u ? el('a', { href: u, target: '_blank', rel: 'noopener', title: 'Source: ' + host(u), text: pct(h[1]) }) : pct(h[1])) : ''),
          h[3] ? el('span', { class: 's', text: 'As of ' + when(h[3]) }) : null);
      }), 6);
      card.append(sh);
    }
    /* joint operations and ventures it is in */
    if (c.op && c.op.length) {
      var sj = sec('Joint operations', c.op.length);
      moreList(sj, c.op.map(function (m) {
        var o = O[m[0]]; if (!o) return el('span');
        var u = url(m[2]);
        return el('div', { class: 'bm-row' }, el('span', { class: 'n' }, el('a', { href: '#k-' + encodeURIComponent(o.i), text: o.n })),
          el('span', { class: 'p' }, m[1] != null ? (u ? el('a', { href: u, target: '_blank', rel: 'noopener', title: 'Source: ' + host(u), text: pct(m[1]) }) : pct(m[1])) : ''),
          el('span', { class: 's', text: [o.k === 'jv' ? 'Joint venture' : 'Joint operation', o.pe || '', o.st ? (STATUS[o.st] || o.st) : ''].filter(Boolean).join(' · ') }));
      }), 5);
      card.append(sj);
    }
    /* ties */
    var ties = (c.ti || []).map(function (i) { return TI[i]; }).filter(Boolean);
    if (ties.length) {
      var st2 = sec('Ties', ties.length + (ties.length === 1 ? ' tie' : ' ties'));
      moreList(st2, ties.map(function (t) { return tieRow(t, c.ix); }), 4);
      card.append(st2);
    }
    var src = (c.sr || []).map(url).filter(Boolean);
    if (src.length || c.w) {
      var sp = el('p', { class: 'src' }, 'Sources: ');
      src.forEach(function (u, i) { if (i) sp.append(' · '); sp.append(srcLink(u)); });
      if (c.w) { if (src.length) sp.append(' · '); sp.append(el('a', { href: c.w, target: '_blank', rel: 'noopener', text: 'website' })); }
      card.append(sp);
    }
    card.classList.toggle('sheet', !wide());
    card.hidden = false; idle.hidden = wide();
    if (!wide()) card.scrollTop = 0;
    highlight();
    markRow();
  }
  function hide() { state.shown = null; card.hidden = true; idle.hidden = false; highlight(); markRow(); }
  function pin(c) {
    state.pinned = c.i; show(c, true);
    try { if (location.hash !== '#c-' + c.i) history.replaceState(null, '', '#c-' + encodeURIComponent(c.i)); } catch (e) { /* sandboxed */ }
  }
  function unpin() {
    state.pinned = null; hide();
    try { if (/^#c-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sandboxed */ }
  }

  /* ---------- the table ---------- */
  var COLS = [{ k: 'n', label: 'Company' }, { k: 'p', label: 'Province' }, { k: 't', label: 'Kind' }, { k: 'o', label: 'Largest owner' },
    { k: 'a', label: 'Assets', num: 1 }, { k: 'r', label: 'Revenue', num: 1 }, { k: 'np', label: 'Net profit', num: 1 }, { k: 'y', label: 'FY', num: 1 }];
  var tb = { k: 'a', dir: -1, kind: 'all', q: '', page: 0, all: false };
  var PAGE = 50;
  var thead = $('#bm-tbl thead'), tbody = $('#bm-tbl tbody'), tq = $('#bm-q'), tk = $('#bm-tkinds'), pager = $('#bm-pager'), tcount = $('#bm-count');
  function val(c, k) {
    if (k === 'n') return c.n.toLowerCase();
    if (k === 'p') return c.p != null ? PV[c.p] : null;
    if (k === 't') return TYPES[c.t] || c.t;
    if (k === 'o') return c.lo ? c.lo[0].toLowerCase() : null;
    if (k === 'a') return FA(c);
    if (k === 'r') return FR(c);
    if (k === 'np') return FP(c);
    if (k === 'y') return FY(c);
    return null;
  }
  function head() {
    var tr = el('tr');
    COLS.forEach(function (c) {
      var th = el('th', { scope: 'col', class: c.num ? 'n' : null }, el('button', { type: 'button', text: c.label,
        onclick: function () { if (tb.k === c.k) tb.dir = -tb.dir; else { tb.k = c.k; tb.dir = c.num ? -1 : 1; } tb.page = 0; head(); body(); } }));
      if (tb.k === c.k) th.setAttribute('aria-sort', tb.dir > 0 ? 'ascending' : 'descending');
      tr.append(th);
    });
    thead.replaceChildren(tr);
  }
  function tkinds() {
    tk.replaceChildren();
    [['all', 'All BUMD', C.filter(function (c) { return c.t !== 'jv'; }).length]].concat(KINDS.map(function (k) { return [k, TYPES[k] || k, C.filter(function (c) { return c.t === k; }).length]; }))
      .forEach(function (k) {
        if (!k[2] && k[0] !== 'all') return;
        tk.append(el('button', { class: 'chip', type: 'button', 'aria-pressed': tb.kind === k[0] ? 'true' : 'false',
          onclick: function () { tb.kind = k[0]; tb.page = 0; tkinds(); body(); } }, k[1], el('b', { text: String(k[2]) })));
      });
  }
  function moneyCell(c, v) {
    if (v == null) return el('td', { class: 'dash', title: 'Not published', text: '—' });
    var u = FU(c);
    return el('td', { class: 'n' }, u ? el('a', { href: u, target: '_blank', rel: 'noopener', title: 'FY' + (FY(c) || '') + ' · ' + host(u), text: money(v, UNIT(c)) }) : money(v, UNIT(c)));
  }
  function rowFor(c) {
    var tr = el('tr', { 'data-id': c.i });
    var nm = c.pg ? el('a', { class: 'cp-link', href: '/bumd/' + encodeURIComponent(c.i), text: c.n }) : el('button', { type: 'button', text: c.n });
    var tag = [c.su ? 'Subsidiary' : '', c.st ? (STATUS[c.st] || c.st) : ''].filter(Boolean).join(' · ');
    tr.append(el('td', { class: 'co' }, el('span', { class: 'w' }, logoIn(el('span', { class: 'lg' }), c), el('span', null, nm, tag ? el('span', { class: 'sb', text: tag }) : null))));
    tr.append(el('td', { class: 'mu', text: c.p != null ? PV[c.p] : '' }));
    tr.append(el('td', { class: 'mu kd', text: TYPES[c.t] || c.t }));
    var ow = el('td', { class: 'mu ow' });
    if (c.lo) {
      ow.append(c.lo[0]);
      if (c.lo[1] != null) { var u = url(c.lo[2]); ow.append(el('span', { class: 'pc' }, u ? el('a', { href: u, target: '_blank', rel: 'noopener', title: 'Source: ' + host(u), text: pct(c.lo[1]) }) : pct(c.lo[1]))); }
      if ((c.o || []).length > 1) ow.append(el('span', { class: 'pc', text: '+' + (c.o.length - 1) }));
    }
    tr.append(ow);
    tr.append(moneyCell(c, FA(c)), moneyCell(c, FR(c)), moneyCell(c, FP(c)));
    tr.append(FY(c) != null ? el('td', { class: 'n', text: String(FY(c)) }) : el('td', { class: 'dash', title: 'Not published', text: '—' }));
    return tr;
  }
  /* a row opens its card; a source link keeps its own tab, and a modified click on a company-page link is
     someone asking for the page in a new tab (the census table's cp-link rule) */
  tbody.addEventListener('click', function (ev) {
    var tr = ev.target.closest && ev.target.closest('tr[data-id]');
    if (!tr) return;
    var a = ev.target.closest('a');
    if (a && !a.classList.contains('cp-link')) return;
    if (a && (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return;
    var c = byId[tr.getAttribute('data-id')];
    if (!c) return;
    ev.preventDefault(); ev.stopPropagation();
    openFromTable(c);
  });
  var rowsNow = [];
  function body() {
    var q = tb.q;
    rowsNow = C.filter(function (c) { return (tb.kind === 'all' ? c.t !== 'jv' : c.t === tb.kind) && (!q || c.hay.indexOf(q) >= 0); })
      .sort(function (a, b) {
        var va = val(a, tb.k), vb = val(b, tb.k);
        if (va == null && vb == null) return a.n.localeCompare(b.n);
        if (va == null) return 1; if (vb == null) return -1;
        var r = (va > vb ? 1 : va < vb ? -1 : 0) * tb.dir;
        return r || a.n.localeCompare(b.n);
      });
    var pages = Math.max(1, Math.ceil(rowsNow.length / PAGE));
    if (tb.page >= pages) tb.page = pages - 1;
    var from = tb.all ? 0 : tb.page * PAGE, to = tb.all ? rowsNow.length : Math.min(rowsNow.length, from + PAGE);
    var frag = document.createDocumentFragment();
    rowsNow.slice(from, to).forEach(function (c) { frag.append(rowFor(c)); });
    tbody.replaceChildren(frag);
    tcount.textContent = rowsNow.length ? (from + 1) + '–' + to + ' of ' + rowsNow.length : 'No company matches';
    pager.replaceChildren();
    if (rowsNow.length > PAGE) {
      pager.append(el('button', { type: 'button', text: '‹ Prev', disabled: tb.all || tb.page === 0, onclick: function () { tb.page--; body(); tq.scrollIntoView({ block: 'nearest' }); } }),
        el('span', { text: tb.all ? 'All ' + rowsNow.length : 'Page ' + (tb.page + 1) + ' of ' + pages }),
        el('button', { type: 'button', text: 'Next ›', disabled: tb.all || tb.page >= pages - 1, onclick: function () { tb.page++; body(); tq.scrollIntoView({ block: 'nearest' }); } }),
        el('button', { type: 'button', 'aria-pressed': tb.all ? 'true' : 'false', text: tb.all ? '50 a page' : 'All', onclick: function () { tb.all = !tb.all; tb.page = 0; body(); } }));
    }
    markRow();
  }
  function markRow() { Array.prototype.forEach.call(tbody.children, function (tr) { tr.classList.toggle('on', tr.getAttribute('data-id') === state.pinned); }); }
  function openFromTable(c) {
    if (wide()) {
      var r = stage.getBoundingClientRect();
      if (r.top < -40 || r.top > window.innerHeight * 0.5) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    pin(c);
  }
  var qT = 0;
  tq.addEventListener('input', function () { clearTimeout(qT); qT = setTimeout(function () { tb.q = tq.value.trim().toLowerCase(); tb.page = 0; body(); }, 90); });
  head(); tkinds(); body();

  /* ---------- the lists below: state groups, joint operations, data centres ---------- */
  var isDc = dcOf;
  function opMembers(o, sep) {
    var box = el('span', { class: 'd' });
    (o.m || []).forEach(function (m, i) {
      if (i) box.append(sep ? el('br') : ', ');
      box.append(nameLink(m[0]));
      if (m[1] != null) { var u = url(m[2]); box.append(' ', el('span', { class: 'pc' }, u ? el('a', { href: u, target: '_blank', rel: 'noopener', class: 'sl', text: pct(m[1]) }) : pct(m[1]))); }
    });
    return box;
  }
  function tieLine(t, me) {
    var meta = el('span', { class: 'm' }, (t[4] === 's' ? 'Company’s word' : 'Confirmed') + (t[5] ? ' · ' + when(t[5]) : '') + (url(t[6]) ? ' · ' : ''));
    if (url(t[6])) meta.append(srcLink(url(t[6])));
    return el('li', null, el('span', null, nameLink(me), ' ', el('b', { text: relWord(t, me) }), ' ', nameLink(other(t, me))), t[3] ? el('span', { class: 'd', text: t[3] }) : null, meta);
  }
  function fillGroup(dt) {
    var box = dt.querySelector('.bd-gl');
    if (!box || box.getAttribute('data-done')) return;
    box.setAttribute('data-done', '1');
    var g = box.getAttribute('data-g');
    var inG = function (r) { return groupOf(r) === g; };
    var ops = O.filter(function (o) { return (o.m || []).some(function (m) { return inG(m[0]); }); });
    var opR = {}; ops.forEach(function (o) { opR[NC + o.ix] = 1; });
    var ties = TI.filter(function (t) { return inG(t[0]) !== inG(t[1]) && !opR[t[0]] && !opR[t[1]]; });
    var ul = el('ul', { class: 'bd-t' });
    ops.forEach(function (o) { ul.append(el('li', null, el('b', { text: o.k === 'jv' ? 'Joint venture' : 'Joint operation' }), el('span', null, el('a', { href: '#k-' + encodeURIComponent(o.i), text: o.n })), opMembers(o))); });
    ties.forEach(function (t) { ul.append(tieLine(t, inG(t[0]) ? t[0] : t[1])); });
    if (!ul.children.length) ul.append(el('li', { text: 'Nothing listed yet.' }));
    box.append(ul);
  }
  Array.prototype.forEach.call(document.querySelectorAll('details.bd-g'), function (dt) { dt.addEventListener('toggle', function () { if (dt.open) fillGroup(dt); }); });
  function fillOps() {
    var body2 = $('#bd-ops-body');
    if (!body2 || body2.getAttribute('data-done')) return;
    body2.setAttribute('data-done', '1');
    var frag = document.createDocumentFragment();
    O.forEach(function (o) {
      var tr = el('tr', { id: 'k-' + o.i });
      var td1 = el('td', { class: 'co' }, el('b', { text: o.n }));
      if (o.l) td1.append(el('div', { class: 'mu', text: o.l }));
      td1.append(el('div', { class: 'mu', text: [o.k === 'jv' ? 'Joint venture' : 'Joint operation', o.st ? (STATUS[o.st] || o.st) : '', o.pe || ''].filter(Boolean).join(' · ') }));
      var td3 = el('td', { class: 'mu' });
      if (o.d) td3.append(o.d);
      var work = TI.filter(function (t) { return t[0] === NC + o.ix && (t[2] === 'works_for' || t[2] === 'operates_for'); }).map(function (t) { return t[1]; });
      if (!work.length && o.cl != null) work = [o.cl];
      if (work.length) { td3.append((o.d ? ' ' : '') + 'For '); work.forEach(function (w, i) { if (i) td3.append(', '); td3.append(nameLink(w)); }); td3.append('.'); }
      if (o.v) td3.append(' ', el('span', { class: 'pc', text: money(o.v[1] === 'Rp tn' ? o.v[0] * 1000 : o.v[0], o.v[1] === 'US$ m' ? 'US$ m' : 'Rp bn') }));
      var td4 = el('td', { class: 'mu' });
      (o.sr || []).slice(0, 2).forEach(function (u, i) { if (i) td4.append(el('br')); td4.append(srcLink(url(u))); });
      tr.append(td1, el('td', { class: 'mu' }, opMembers(o, true)), td3, td4);
      frag.append(tr);
    });
    body2.append(frag);
  }
  var opsBox = $('#bd-all-ops');
  if (opsBox) opsBox.addEventListener('toggle', function () { if (opsBox.open) fillOps(); });
  var dcl = $('#bd-dc-list');
  if (dcl) TI.forEach(function (t) { if (isDc(t[0]) || isDc(t[1])) dcl.append(tieLine(t, isDc(t[0]) ? t[1] : t[0])); });

  /* ---------- links into the page: #c-<id> opens a card, #g-<group> and #k-<operation> open their list ---------- */
  function go(h, fromLoad) {
    if (!h) return false;
    if (h.indexOf('c-') === 0) {
      var c = byId[h.slice(2)]; if (!c) return false;
      if (wide() || fromLoad) { var r = stage.getBoundingClientRect(); if (r.top < -40 || r.top > window.innerHeight * 0.5) stage.scrollIntoView({ block: 'start' }); }
      state.pinned = c.i; show(c, true);
      return true;
    }
    if (h.indexOf('k-') === 0) fillOps();   /* the table's rows are drawn on first use */
    var t = document.getElementById(h);
    if (!t) return false;
    if (h.indexOf('k-') === 0) { Array.prototype.forEach.call(document.querySelectorAll('.bd-ops tr.hit'), function (x) { x.classList.remove('hit'); }); t.classList.add('hit'); }
    for (var n = t; n; n = n.parentElement) if (n.tagName === 'DETAILS') { n.open = true; if (n.classList.contains('bd-g')) fillGroup(n); }
    if (h.indexOf('g-') === 0 && t.tagName === 'DETAILS') { t.open = true; fillGroup(t); }
    t.scrollIntoView({ block: h.indexOf('k-') === 0 ? 'center' : 'start' });
    return true;
  }
  function fromHash(fromLoad) { var h = ''; try { h = decodeURIComponent((location.hash || '').slice(1)); } catch (e) { return; } go(h, fromLoad); }
  /* a click on the link the address already holds fires no hashchange: run it here */
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href^="#"]');
    if (!a) return;
    var h = a.getAttribute('href');
    if (h !== location.hash) return;
    ev.preventDefault();
    var id = ''; try { id = decodeURIComponent(h.slice(1)); } catch (e) { return; }
    if (id.indexOf('c-') === 0) ev.stopPropagation();
    go(id, false);
  }, true);
  window.addEventListener('hashchange', function () { fromHash(false); });

  /* ---------- go ---------- */
  var raf = 0, lastW = 0;
  new ResizeObserver(function () { if (field.clientWidth === lastW) return; lastW = field.clientWidth; cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(field);
  if (wideMq && wideMq.addEventListener) wideMq.addEventListener('change', function () { if (state.shown) { var c = byId[state.shown]; if (c) show(c, !!state.pinned); } });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  draw();
  fromHash(true);
})();
