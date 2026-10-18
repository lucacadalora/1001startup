'use strict';
/* /bumn/<slug> — one state company's group map, drawn as a Sankey that opens into a network.
 *
 * Luca, 18 Oct 2026: "i think we need to make visuals, maybe like sankey diagram. from left
 * telkom > connectivity is x, operational is x etc. so it is like neural network to the right
 * with biggest portion of obligation or kepentingan and strategic for the main company".
 *
 * Left half, money: the company's revenue (or capital spending) split into the businesses it
 * reports in the segment note of its consolidated statements; band width = rupiah, and the bands
 * add up to the group total. Right half, structure: the companies the group itself places in each
 * business (its own investor deck), then the companies under them; these lines carry no money.
 * Colour marks the companies that carry a national programme, a public duty or a Danantara
 * directive, each with its source. Every number links to the page it was read from.
 *
 * Data: data/bumn-sankey.json, written by ~/projects/bumn-group-webs/tools/sankey-export.py.
 * Server-rendered SVG (CSP script-src 'self'): the lens switch is two radio inputs and CSS, so
 * the page needs no script of its own. Shown only while data/bumnsankey.live exists
 * (BUMNSANKEY_PREVIEW=1 on a test port); without it /bumn/<slug> is a 404 and /bumn is unchanged.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const { liveFlag } = require('../lib/flaglive');

const live = liveFlag('bumnsankey.live', 'BUMNSANKEY_PREVIEW');
const FILE = path.join(__dirname, '..', 'data', 'bumn-sankey.json');
let cache = { mtime: 0, data: null };
function load() {
  try {
    const st = fs.statSync(FILE);
    if (st.mtimeMs !== cache.mtime) cache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return cache.data;
}
/* the companies that have a map, for the link in each /bumn card; empty while the switch is off */
function slugs() {
  if (!live()) return [];
  const D = load();
  return D ? Object.keys(D.groups) : [];
}
/* a small version of each map for the /bumn card, drawn by public/js/bumn1001.js (Luca, 18 Oct 2026:
   "when clicking the company, make a mini sankey so people noticing, i even need 2 minutes to figure
   out the link"). Money maps: the first lens's businesses in their own order; counts maps: the
   branches. Five rows at most: past five, the four biggest stay and the rest are lumped into one.
   Each row is [label, size, kind, figure]; kind c = core business or active branch, o = other
   business, x = branch not running, m = the lumped rest. */
function minis() {
  if (!live()) return {};
  const D = load();
  if (!D) return {};
  const out = {};
  Object.entries(D.groups).forEach(([slug, G]) => { const m = mini(G); if (m) out[slug] = m; });
  return out;
}
function mini(G) {
  const TOP = 4;
  const keep = (rows, more) => {
    if (rows.length <= TOP + 1) return rows;
    const big = new Set(rows.slice().sort((a, b) => b[1] - a[1]).slice(0, TOP));
    const rest = rows.filter((r) => !big.has(r));
    return rows.filter((r) => big.has(r)).concat([more(rest)]);
  };
  if (G.basis === 'segments' && G.segments && G.measures) {
    const lens = Object.keys(G.measures)[0];
    const { M, segs } = lensOf(G, lens);
    const t = base(M);
    const rows = segs.filter((b) => b.v > 0).map((b) => [b.extra ? 'Not in a segment' : b.s.plain || b.s.name, b.v, b.s.core ? 'c' : 'o', pc(b.v, t)]);
    if (!rows.length) return null;
    const word = G.seg_word ? G.seg_word.replace(/y$/, 'ie') + 's' : 'businesses';
    return { k: 's', h: `${M.short || M.label}, ${G.period}`, tot: money(G, M.total),
      r: keep(rows, (rest) => { const v = rest.reduce((a, r) => a + r[1], 0); return [`${rest.length} more ${word}`, v, 'm', pc(v, t)]; }) };
  }
  if (G.tops && G.tops.length) {
    const rows = G.tops.map((x) => [x.name, x.n, ST[x.status] ? 'x' : 'c', String(x.n)]);
    const all = G.tops.reduce((a, x) => a + x.n, 0);
    return { k: 'c', h: 'Companies per branch', tot: `${all} ${all === 1 ? 'company' : 'companies'}`,
      r: keep(rows, (rest) => { const v = rest.reduce((a, r) => a + r[1], 0); return [`${rest.length} more branches`, v, 'm', String(v)]; }) };
  }
  return null;
}

const KIND = {
  priority: { label: 'National programme', c: '#eb6834' },
  duty: { label: 'Public duty', c: '#2a78d6' },
  directive: { label: 'Danantara directive', c: '#1baf7a' },
};
const ST = { not_yet_operating: 'not yet operating', unknown: 'status not stated', dormant: 'dormant', liquidation: 'in liquidation', merged: 'merged', divested: 'sold' };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'source'; } };
/* money in the group's own unit (G.unit: currency and multiplier; Telkom reports Rp bn, Pertamina US$ thousands) */
const money = (G, v) => {
  const u = G.unit || { cur: 'IDR', mult: 1e9 };
  const x = v * u.mult, a = Math.abs(x), s = x < 0 ? '−' : '';
  if (!x) return u.cur === 'USD' ? 'US$0' : 'Rp0';
  const n = (q, d) => q.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (u.cur === 'USD') return a >= 1e9 ? `${s}US$${n(a / 1e9, 1)} bn` : a >= 1e6 ? `${s}US$${n(a / 1e6, a >= 1e7 ? 0 : 1)} m` : `${s}US$${n(a / 1e3, 0)}k`;
  return a >= 1e12 ? `${s}Rp${n(a / 1e12, 1)} tn` : a >= 1e9 ? `${s}Rp${n(a / 1e9, a >= 1e10 ? 0 : 1)} bn` : `${s}Rp${n(a / 1e6, 0)} m`;
};
/* shares are of the segments' own sum when a negative adjustment sits between them and the group total */
const base = (M) => M.total - Math.min(0, M.unalloc || 0);
const lc1 = (t) => String(t).charAt(0).toLowerCase() + String(t).slice(1);
const pc = (v, t) => { const x = (v / t) * 100; return (x >= 10 ? String(Math.round(x)) : x.toFixed(1)) + '%'; };
const stake = (v) => (v == null ? '—' : (Math.round(v * 100) / 100) + '%');
const day = (d) => {
  if (!d) return '';
  const [y, m, dd] = d.split('-');
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1];
  return dd ? `${+dd} ${M} ${y}` : `${M} ${y}`;
};
const pageUrl = (G, key) => { const p = G.pages[key]; return p ? `${G.src[p[0]].u}#page=${p[1]}` : null; };
const assetUrl = (G, co) => (co.ap && G.assets_src ? `${G.src[G.assets_src].u}#page=${co.ap}` : co.u);
const A = (u, inner, cls) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener"${cls ? ` class="${cls}"` : ''}>${inner}</a>` : inner);
const f1 = (n) => Math.round(n * 10) / 10;

/* text is laid out from measured widths so no line, band or label ever runs into another label.
   WT: advance width of each character in each text style, measured in the browser with the page's
   own fonts (scratch tool measure.js, 18 Oct 2026); an unknown character counts as an "M". */
const WT = require('./bumnsankey1001-widths');
const WI = new Map([...WT.chars].map((c, i) => [c, i]));
function tw(t, cls) {
  const w = WT.w[String(cls).split(' ')[0]];
  let s = 0;
  for (const c of String(t == null ? '' : t)) { const i = WI.get(c); s += i != null ? w[i] : w[WI.get('M')]; }
  return s;
}
/* cut a text to max px, ending in an ellipsis */
function fitW(t, cls, max) {
  let s = String(t == null ? '' : t);
  if (tw(s, cls) <= max) return s;
  while (s.length > 1 && tw(s.trimEnd() + '…', cls) > max) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}
/* break a text into lines of at most max px, on spaces (a single word too long for a line is cut) */
function wrapW(t, cls, max) {
  const out = [];
  let cur = '';
  String(t == null ? '' : t).split(' ').forEach((w) => {
    const nx = cur ? cur + ' ' + w : w;
    if (cur && tw(nx, cls) > max) { out.push(cur); cur = w; } else cur = nx;
  });
  if (cur) out.push(cur);
  return out.map((l) => fitW(l, cls, max));
}
/* the same number of lines as wrapW, but evened out ("IT and digital / services for business",
   not "IT and digital services for / business") */
function wrapEven(t, cls, max) {
  const n = wrapW(t, cls, max).length;
  if (n < 2) return wrapW(t, cls, max);
  let lo = 0, hi = max;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (wrapW(t, cls, mid).length <= n && !wrapW(t, cls, mid).some((l) => l.endsWith('…'))) hi = mid; else lo = mid; }
  return wrapW(t, cls, hi);
}
/* ascent and descent of each style, px above and below the baseline */
const LM = { k: [8, 2.5], ch: [7.5, 2.5], sh: [8.5, 2.5], pl: [10.5, 3.5], v: [11.5, 3], cnm: [10, 3.5], dnm: [9.5, 3], pn: [13, 4] };
const lm = (cls) => LM[String(cls).split(' ')[0]];
/* a block of label lines: each line {cls, text, dy (baseline step), w}; y = baseline from the block's top */
function block(lines) {
  let y = 0, w = 0;
  lines.forEach((l, i) => {
    y = i ? y + l.dy : lm(l.cls)[0];
    l.y = y;
    if (l.w == null) l.w = tw(l.text, l.cls);
    w = Math.max(w, l.w);
  });
  return { lines, w, h: y + lm(lines[lines.length - 1].cls)[1] };
}
/* the text lines of a block at x (anchor start or end), its top at top; chip rows are drawn by the caller */
function drawText(B, x, top, anchor, extra = '') {
  const t = B.lines.filter((l) => !l.chips).map((l) => `<tspan class="${l.cls}" x="${f1(x)}" y="${f1(top + l.y)}">${l.link ? A(l.link, esc(l.text)) : esc(l.text)}</tspan>${l.share ? `<tspan class="sh" dx="6">${esc(l.share)}</tspan>` : ''}`).join('');
  return `<text text-anchor="${anchor}">${t}${extra}</text>`;
}

/* logo badges: the company's own mark in a white disc, or its initials when no mark was found.
   Clip ids are counted per page render (page() resets CLIP), so the two lens copies never collide. */
let CLIP = 0;
const initials = (name) => {
  const t = String(name || '').replace(/\(.*?\)/g, ' ').replace(/^(PT|Perum)\s+/i, '').trim().split(/[\s\-\/&,.]+/).filter(Boolean);
  if (!t.length) return '?';
  if (/^[A-Z0-9]{2,4}$/.test(t[0])) return t[0];
  return (t[0][0] + (t[1] && /^[A-Za-z]/.test(t[1]) ? t[1][0] : '')).toUpperCase();
};
function badge(co, cx, cy, r) {
  const off = ST[co.status] || co.synthetic ? ' off' : '';
  if (co.logo) {
    const id = 'bg' + (++CLIP);
    return `<g class="bdg${off}"><clipPath id="${id}"><circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r - 1)}"/></clipPath><circle class="bdc" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}"/>` +
      `<image href="${esc(co.logo)}" x="${f1(cx - r + 1)}" y="${f1(cy - r + 1)}" width="${f1(2 * r - 2)}" height="${f1(2 * r - 2)}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/></g>`;
  }
  return `<g class="bdg${off}"><circle class="bdm" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}"/><text class="bdi" x="${f1(cx)}" y="${f1(cy + r * 0.3)}" text-anchor="middle" style="font-size:${f1(Math.max(6.5, r * (initials(co.name).length > 2 ? 0.62 : 0.8)))}px">${esc(initials(co.name))}</text></g>`;
}
/* the same badge for the lists under the map, as HTML */
const badgeHtml = (co, px) => (co.logo
  ? `<img class="sk-lg" src="${esc(co.logo)}" width="${px}" height="${px}" alt="" loading="lazy">`
  : `<span class="sk-mg" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.42)}px" aria-hidden="true">${esc(initials(co.name))}</span>`);

/* spread boxes of fixed height around wanted centres inside [0, H] without overlap
   (the caller makes sure the boxes and gaps fit in H) */
function pack(items, H, gap) {
  const down = (from) => {
    for (let i = from; i < items.length; i++) {
      const prev = items[i - 1];
      if (prev && items[i].top < prev.top + prev.h + gap) items[i].top = prev.top + prev.h + gap;
    }
  };
  items.forEach((it) => { it.top = it.want - it.h / 2; });
  if (items.length) items[0].top = Math.max(0, items[0].top);
  down(1);
  const last = items[items.length - 1];
  if (last && last.top + last.h > H) {
    last.top = H - last.h;
    for (let i = items.length - 2; i >= 0; i--) {
      const nx = items[i + 1];
      if (items[i].top + items[i].h > nx.top - gap) items[i].top = nx.top - gap - items[i].h;
    }
    if (items[0].top < 0) { items[0].top = 0; down(1); }
  }
  return items;
}

function lensOf(G, lens) {
  const M = G.measures[lens];
  const segs = G.segments.map((s) => ({ s, v: s[lens], inner: lens === 'rev' ? (s.inter || 0) : 0 }));
  if (M.unalloc > 0) segs.push({ s: { id: 'unalloc', name: 'Not in a segment', plain: M.unalloc_label, core: false, cos: [], units: [] }, v: M.unalloc, inner: 0, extra: true });
  return { M, segs };
}

/* the label of a segment: kind, plain name, value and share, sales inside the group; lines no wider than max */
function segBlock(G, lens, b, max) {
  const M = G.measures[lens];
  const lines = [];
  wrapEven(b.extra ? 'ADJUSTMENTS' : b.s.name.toUpperCase() + (b.s.core ? ' · CORE' : ''), 'k', max).forEach((t) => lines.push({ cls: 'k', text: t, dy: 13 }));
  wrapEven(b.extra ? 'Not in a segment' : b.s.plain, 'pl', max).forEach((t, i) => lines.push({ cls: 'pl', text: t, dy: i ? 16 : 17 }));
  const mv = money(G, b.v), sh = pc(b.v, base(M));
  lines.push({ cls: 'v', text: mv, share: sh, w: tw(mv, 'v') + 6 + tw(sh, 'sh'), dy: 19 });
  if (b.inner) {
    const one = `+${money(G, b.inner)} inside the group`;
    (tw(one, 'k') <= max ? [one] : [fitW(`+${money(G, b.inner)}`, 'k', max), 'inside the group']).forEach((t, i) => lines.push({ cls: 'k in', text: t, dy: i ? 13 : 15 }));
  }
  return block(lines);
}
const segText = (G, B, x, top, anchor) => `<a href="${esc(pageUrl(G, 'segments'))}" target="_blank" rel="noopener" class="sl">${drawText(B, x, top, anchor)}</a>`;

/* duty chips: [colour square][LABEL], 10px apart, packed into rows no wider than max; a label too long
   for one row breaks over two, the square on its first line */
const chipW = (d) => 11 + tw(d.chip.toUpperCase(), 'ch');
function chipRows(ds, max) {
  const rows = [];
  ds.forEach((d) => {
    const parts = chipW(d) <= max ? [d.chip.toUpperCase()] : wrapW(d.chip.toUpperCase(), 'ch', max - 11);
    parts.forEach((t, i) => {
      const it = { d, t, sq: i === 0 }, w = 11 + tw(t, 'ch'), r = rows[rows.length - 1];
      if (i === 0 && parts.length === 1 && r && !r.solo && r.w + 10 + w <= max) { r.items.push(it); r.w += 10 + w; } else rows.push({ items: [it], w, solo: parts.length > 1 });
    });
  });
  return rows;
}
/* one right-aligned row of chips ending at xRight, baseline y */
function chipsSvg(items, xRight, y) {
  let x = xRight, out = '';
  for (let i = items.length - 1; i >= 0; i--) {
    const { d, t, sq } = items[i], tx = x - tw(t, 'ch');
    out = `<a href="${esc(d.u)}" target="_blank" rel="noopener">${sq ? `<rect x="${f1(tx - 11)}" y="${f1(y - 7)}" width="7" height="7" fill="${KIND[d.kind].c}"/>` : ''}<text class="ch" x="${f1(tx)}" y="${f1(y)}">${esc(t)}<title>${esc(KIND[d.kind].label)}: ${esc(d.text)}</title></text></a>` + out;
    x = tx - 11 - 10;
  }
  return out;
}
/* the label of a company row: name, stake line(s), duty chips; mid = middle of the name and stake lines,
   where its badge and its line sit */
function rowBlock(name, nameCls, meta, ds, max) {
  const nl = wrapEven(name, 'cnm', max);
  const lines = (nl.length > 2 ? [nl[0], fitW(nl.slice(1).join(' '), 'cnm', max)] : nl).map((t) => ({ cls: nameCls, text: t, dy: 15 }));
  wrapW(meta, 'k', max).forEach((t) => lines.push({ cls: 'k', text: t, dy: 13 }));
  const mid = block(lines.slice()).h / 2;
  chipRows(ds, max).forEach((r) => lines.push({ cls: 'ch', chips: r.items, w: r.w, dy: 14 }));
  const B = block(lines);
  B.mid = mid;
  return B;
}
/* chips of a right-aligned block */
const drawChips = (B, xRight, top) => B.lines.filter((l) => l.chips).map((l) => chipsSvg(l.chips, xRight, top + l.y)).join('');
/* a band that curves from the parent's bar to xr, then runs straight into the bar at x1 (labels sit in the straight part) */
const runBand = (x0, a0, a1, xr, x1, b0, b1) => {
  const mx = (x0 + xr) / 2;
  return `M${x0} ${f1(a0)} C${f1(mx)} ${f1(a0)} ${f1(mx)} ${f1(b0)} ${f1(xr)} ${f1(b0)} H${x1} V${f1(b1)} H${f1(xr)} C${f1(mx)} ${f1(b1)} ${f1(mx)} ${f1(a1)} ${x0} ${f1(a1)}Z`;
};
/* the parent at the far left: logo, name (wrapped to fit), total, its own duties; right edge at x */
function parentHead(G, x, midY, total, totalLink, sub, clipId) {
  const nm = wrapW(G.short, 'pn', x - 6);
  const lines = nm.map((t) => ({ cls: 'pn', text: t, dy: 20 }));
  lines.push({ cls: 'v', text: total, link: totalLink, dy: 20 });
  lines.push({ cls: 'k', text: fitW(sub, 'k', x - 6), dy: 15 });
  const pd = G.duties.filter((d) => d.node === G.slug);
  chipRows(pd, x - 6).forEach((r) => lines.push({ cls: 'ch', chips: r.items, w: r.w, dy: 14 }));
  const B = block(lines);
  const top = midY - B.h / 2 + 24;
  let s = '';
  if (G.logo) s += `<circle cx="${x - 22}" cy="${f1(top - 30)}" r="22" class="lgb"/><image href="${esc(G.logo)}" x="${x - 42}" y="${f1(top - 50)}" width="40" height="40" clip-path="url(#${clipId})"/><circle cx="${x - 22}" cy="${f1(top - 30)}" r="22" class="lg"/>`;
  s += drawText(B, x, top, 'end');
  s += drawChips(B, x, top);
  const clip = G.logo ? `<clipPath id="${clipId}"><circle cx="${x - 22}" cy="${f1(top - 30)}" r="20"/></clipPath>` : '';
  return { svg: s, clip, top: top - 54, bottom: top + B.h };
}

/* a band from the parent's bar into a segment bar */
const band = (x0, a0, a1, x1, b0, b1) => {
  const mx = (x0 + x1) / 2;
  return `M${x0} ${f1(a0)} C${f1(mx)} ${f1(a0)} ${f1(mx)} ${f1(b0)} ${x1} ${f1(b0)} L${x1} ${f1(b1)} C${f1(mx)} ${f1(b1)} ${f1(mx)} ${f1(a1)} ${x0} ${f1(a1)}Z`;
};
/* hovering any part of one business (its band, bar, label or companies) fades the others */
const hoverCss = (cls, ids) => ids.map((id) => `.${cls}:has([data-seg="${id}"]:hover) [data-seg]:not([data-seg="${id}"]){opacity:.25}`).join('');

/* desktop: four columns — company | businesses | companies placed in each | companies under them.
   Nothing crosses a label: each band runs straight under its own business's label (the label sits on
   its band, or above it when the band is thinner than the label); each line to a company stops short
   of the company's label, which sits between the line and the company's logo. */
function wideSvg(G, lens) {
  const W = 1140, xA = 140, bw = 12, xB = 440, xC = 750, cw = 30, xD = 832, dw = 20, gapB = 14;
  const SEGW = 160, CW = 176;
  const { M, segs } = lensOf(G, lens);
  const duties = (id) => G.duties.filter((d) => d.node === id);
  /* column C: one row per placed company or in-house unit, grouped by business, as tall as its label */
  let y = 6;
  const row = (it, minH) => {
    it.blk = coBlock(G, it, duties, CW);
    it.h = Math.max(minH, it.blk.h + 12);
    it.y = y; y += it.h;
    it.bt = it.y + (it.h - it.blk.h) / 2;
    it.yc = it.bt + it.blk.mid;
    it.xl = xC - 8 - it.blk.w;
    return it;
  };
  const groups = segs.map((b) => {
    const items = b.s.cos.map((co) => row({ co }, 36)).concat((b.s.units || []).map((u) => row({ unit: u }, 36)));
    const g = { b, items, top: items.length ? items[0].y : y, bot: y };
    if (items.length) y += 16;
    return g;
  });
  const un = G.unplaced.map((co) => { y += 6; return row({ co }, 32); });
  const HC = y;
  const all = groups.flatMap((g) => g.items).concat(un);
  /* every line curves into this x, then runs straight to its label */
  const xE = Math.min(xC - 60, ...all.map((it) => it.xl)) - 10;
  /* column D: the companies under each placed company, packed next to their parent */
  const parents = all.filter((it) => it.co).map((it) => ({ co: it.co, it, yc: it.yc }));
  const { rows: kidsRows, bottom: yd } = kidRows(parents);
  /* column B: one measured label per business; the bands run straight for the label's width */
  const labs = segs.map((b) => segBlock(G, lens, b, SEGW));
  const LW = Math.max(...labs.map((l) => l.w));
  const xR = Math.max(xA + bw + 90, xB - 8 - LW - 14);
  const slot = (i, k) => {
    const b = segs[i], bar = Math.max(b.v * k, 2), inn = b.inner * k;
    return bar >= labs[i].h + 10 ? bar + inn : labs[i].h + 6 + bar + inn;
  };
  const H = Math.max(HC, yd, 480, labs.reduce((a, l) => a + l.h + 8, 0) + gapB * (segs.length - 1) + 24);
  let k = (H - gapB * (segs.length - 1)) / segs.reduce((a, b) => a + b.v + b.inner, 0);
  for (let it = 0; it < 120 && segs.reduce((a, b, i) => a + slot(i, k), 0) + gapB * (segs.length - 1) > H; it++) k *= 0.96;
  const boxes = segs.map((b, i) => {
    const g = groups[i], h = slot(i, k), barH = Math.max(b.v * k, 2);
    return { b, h, barH, innerH: b.inner * k, lab: labs[i], inBand: barH >= labs[i].h + 10, want: g.items.length ? (g.top + g.bot) / 2 : H - h / 2 };
  });
  pack(boxes, H, gapB);
  boxes.forEach((x) => {
    x.barTop = x.inBand ? x.top : x.top + x.lab.h + 6;
    x.labTop = x.inBand ? x.barTop + (x.barH - x.lab.h) / 2 : x.top;
  });
  /* column A: the company, its bands stacked in the same order as the businesses */
  const aH = segs.reduce((a, b) => a + Math.max(b.v * k, 2), 0);
  const span0 = boxes[0].top, span1 = boxes[boxes.length - 1].top + boxes[boxes.length - 1].h;
  const aTop = Math.max(0, Math.min((span0 + span1) / 2 - aH / 2, H - aH));
  let ay = aTop;
  const back = [], front = [];
  boxes.forEach((x, i) => {
    const b = x.b, g = groups[i], id = esc(b.s.id);
    const a0 = ay, a1 = ay + x.barH; ay = a1;
    const b0 = x.barTop, b1 = x.barTop + x.barH;
    const cls = b.extra ? 'bd ex' : b.s.core ? 'bd core' : 'bd';
    back.push(`<path class="${cls}" data-seg="${id}" d="${runBand(xA + bw, a0, a1, xR, xB, b0, b1)}"><title>${esc(b.s.name)}: ${esc(money(G, b.v))}, ${pc(b.v, base(M))} of ${esc(M.label.toLowerCase())}${b.inner ? `; plus ${esc(money(G, b.inner))} sold to other businesses in the group` : ''}</title></path>`);
    let s = `<g class="sk-g" data-seg="${id}">`;
    s += `<rect class="${b.extra ? 'nb ex' : 'nb'}" x="${xB}" y="${f1(b0)}" width="${bw}" height="${f1(x.barH)}"/>`;
    if (x.innerH) s += `<rect class="ni" x="${xB}" y="${f1(b1)}" width="${bw}" height="${f1(x.innerH)}"/>`;
    s += segText(G, x.lab, xB - 8, x.labTop, 'end');
    /* lines: spread over the bar, one per placed company or unit, each ending just before its label */
    const n = g.items.length, hTot = x.barH + x.innerH, c0 = xB + bw, d = (xE - c0) * 0.5;
    g.items.forEach((it, j) => {
      const y0 = b0 + hTot * (j + 0.5) / n, ds = it.co ? duties(it.co.id) : [];
      s += `<path class="cn${it.unit ? ' unit' : ''}"${ds.length ? ` style="stroke:${KIND[ds[0].kind].c}"` : ''} d="M${c0} ${f1(y0)} C${f1(c0 + d)} ${f1(y0)} ${f1(xE - d)} ${f1(it.yc)} ${f1(xE)} ${f1(it.yc)} H${f1(it.xl - 6)}"/>`;
    });
    g.items.forEach((it) => { s += coRow(G, it, xC, cw, duties); });
    kidsRows.filter((r) => g.items.includes(r.pr.it)).forEach((r) => { s += kidRow(G, r, xC + cw, xD, dw, W - (xD + dw + 6) - 4); });
    front.push(s + '</g>');
  });
  /* a company the group places in no business hangs off the parent's bar by a dotted line along the bottom */
  un.forEach((it) => {
    const x0 = xA + bw / 2, y0 = aTop + aH, yb = H + 6, xn = xC + cw / 2, y1 = it.yc + cw / 2, r = 8;
    back.push(`<path class="un" data-seg="none" d="M${f1(x0)} ${f1(y0)} V${f1(yb - r)} Q${f1(x0)} ${f1(yb)} ${f1(x0 + r)} ${f1(yb)} H${f1(xn - r)} Q${f1(xn)} ${f1(yb)} ${f1(xn)} ${f1(yb - r)} V${f1(y1)}"/>`);
    let s = `<g class="sk-g" data-seg="none">${coRow(G, it, xC, cw, duties)}`;
    kidsRows.filter((r) => r.pr.it === it).forEach((r) => { s += kidRow(G, r, xC + cw, xD, dw, W - (xD + dw + 6) - 4); });
    front.push(s + '</g>');
  });
  /* the parent: logo, name, total, and its own duties */
  const P = parentHead(G, xA - 10, aTop + aH / 2, money(G, M.total), pageUrl(G, 'segments'), `${M.short.toUpperCase()}, ${(M.when || G.period).toUpperCase()}`, `sk-disc-${lens}`);
  const head = `<rect class="na" x="${xA}" y="${f1(aTop)}" width="${bw}" height="${f1(aH)}"/>` + P.svg;
  const defs = `<defs><pattern id="sk-hatch-${lens}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="#0B0B0C" stroke-width="1.6"/></pattern>${P.clip}</defs>`;
  const style = `<style>.sk-${lens} .ni{fill:url(#sk-hatch-${lens});stroke:#0B0B0C;stroke-width:1}${hoverCss('sk-' + lens, boxes.map((x) => esc(x.b.s.id)).concat(un.length ? ['none'] : []))}</style>`;
  const top = Math.min(-14, P.top - 4), Hv = Math.max(H + 16, P.bottom + 4) - top;
  return `<svg class="sk-svg sk-${lens}" viewBox="0 ${f1(top)} ${W} ${f1(Hv)}" width="${W}" height="${f1(Hv)}" role="img" aria-label="${esc(G.short)}: ${esc(M.label.toLowerCase())} by business, ${esc(G.period)}, and the companies in each business">${defs}${style}<g class="sk-back">${back.join('')}</g>${front.join('')}${head}</svg>`;
}

/* the label of one row in column C: a company (name, how it is held, duties) or a unit inside the parent */
function coBlock(G, it, duties, CW) {
  if (it.unit) return rowBlock(it.unit.name, 'cnm unit', `INSIDE ${G.short.toUpperCase()}`, [], CW);
  const co = it.co, st = ST[co.status];
  const meta = [co.via ? `VIA ${co.via.toUpperCase()}` : '', stake(co.stake), st ? ST_SHORT[co.status] : ''].filter(Boolean).join(' · ');
  return rowBlock(co.name, `cnm${st ? ' off' : ''}`, meta, duties(co.id), CW);
}
function coRow(G, it, xC, cw, duties) {
  const B = it.blk;
  if (it.unit) {
    return `<circle class="nc unit" cx="${f1(xC + cw / 2)}" cy="${f1(it.yc)}" r="${f1(cw / 2 - 1)}"/>` +
      drawText(B, xC - 8, it.bt, 'end', `<title>${esc(it.unit.name)}: ${esc(it.unit.plain)}</title>`);
  }
  const co = it.co, st = ST[co.status];
  const tip = `${co.name}${co.legal ? ` (${co.legal})` : ''}: ${stake(co.stake)} owned by ${co.via || G.short}${co.assets != null ? `; total assets ${money(G, co.assets)} at ${day(G.as_of)}` : ''}${co.sector ? `; ${co.sector}` : ''}${st ? `; ${st}` : ''}`;
  return badge(co, xC + cw / 2, it.yc, cw / 2) +
    `<a href="#co-${esc(co.id)}">${drawText(B, xC - 8, it.bt, 'end', `<title>${esc(tip)}</title>`)}</a>` + drawChips(B, xC - 8, it.bt);
}

/* the companies one level down, packed beside their parent; a long branch shows its first CAP - 1 and a "+N more" row */
const CAP = 8;
const ST_SHORT = { not_yet_operating: 'NOT YET RUNNING', unknown: 'NO STATUS', dormant: 'DORMANT', liquidation: 'LIQUIDATING', merged: 'MERGED', divested: 'SOLD' };
function kidRows(parents) {
  let yd = 0;
  const rows = [];
  parents.forEach((pr) => {
    const ks = (pr.co && pr.co.kids) || [];
    if (!ks.length) return;
    const shown = ks.length > CAP ? ks.slice(0, CAP - 1) : ks, more = ks.length - shown.length;
    const h = (shown.length + (more ? 1 : 0)) * 24;
    const top = Math.max(pr.yc - h / 2, yd);
    shown.forEach((k, i) => rows.push({ k, pr, y: top + i * 24 + 12 }));
    if (more) rows.push({ more, pr, y: top + shown.length * 24 + 12 });
    yd = top + h + 8;
  });
  return { rows, bottom: yd };
}

function kidRow(G, r, x0, xD, dw, avail = 300) {
  const p = r.pr.co, c = (xD - x0) * 0.5, y0 = r.y0 != null ? r.y0 : r.pr.yc;
  let s = `<path class="ck" d="M${x0} ${f1(y0)} C${f1(x0 + c)} ${f1(y0)} ${f1(xD - c)} ${f1(r.y)} ${xD} ${f1(r.y)}"/>`;
  if (r.more) return s + `<a href="#co-${esc(p.id)}"><text class="k more" x="${xD + dw + 6}" y="${f1(r.y + 4)}">${esc(fitW(`+${r.more} MORE, ALL LISTED BELOW`, 'k', avail))}</text></a>`;
  const k = r.k, st = ST[k.status], below = (k.n || 1) - 1;
  const tip = `${k.name}${k.legal ? ` (${k.legal})` : ''}: ${stake(k.stake)} ${p.synthetic ? 'held in the group' : `owned by ${p.name}`}${k.assets != null ? `; total assets ${money(G, k.assets)} at ${day(G.as_of)}` : ''}${k.sector ? `; ${k.sector}` : ''}${st ? `; ${st}` : ''}${below ? `; ${below} ${below === 1 ? 'company' : 'companies'} under it` : ''}`;
  let meta = [stake(k.stake), st ? ST_SHORT[k.status] : '', below ? `+${below} BELOW` : ''].filter(Boolean).join(' · ');
  /* the name gets whatever width the stake line leaves, and never less than 90px */
  meta = fitW(meta, 'k', avail - 96);
  const name = fitW(k.name, 'dnm', Math.min(270, avail - tw(meta, 'k') - 6));
  return s + badge(k, xD + dw / 2, r.y, dw / 2) +
    `<a href="#co-${esc(k.id)}"><text x="${xD + dw + 6}" y="${f1(r.y + 4)}"><tspan class="dnm${st ? ' off' : ''}">${esc(name)}</tspan><tspan class="k" dx="6">${esc(meta)}</tspan><title>${esc(tip)}</title></text></a>`;
}

/* two columns only: the group and its segments, labels to the right of the bars where nothing else
   is drawn. The phone version of every segment map, and the desktop one when the group places no
   company in a segment (a region split). */
function twoColSvg(G, lens, o) {
  const W = o.W, xA = o.xA, bw = o.bw || 10, xB = o.xB, gapB = 14, xL = xB + bw + 8;
  const { M, segs } = lensOf(G, lens);
  const labs = segs.map((b) => segBlock(G, lens, b, W - xL - 4));
  const minSlot = (i) => labs[i].h + 8;
  const H = Math.max(o.H, labs.reduce((a, l, i) => a + minSlot(i), 0) + gapB * (segs.length - 1) + 24);
  let k = (H - gapB * (segs.length - 1)) / segs.reduce((a, b) => a + b.v + b.inner, 0);
  for (let it = 0; it < 120 && segs.reduce((a, b, i) => a + Math.max((b.v + b.inner) * k, minSlot(i)), 0) + gapB * (segs.length - 1) > H; it++) k *= 0.96;
  let y = 0;
  const boxes = segs.map((b, i) => {
    const h = Math.max((b.v + b.inner) * k, minSlot(i));
    const x = { b, top: y, h, barH: Math.max(b.v * k, 2), innerH: b.inner * k, lab: labs[i] };
    y += h + gapB;
    return x;
  });
  const Hn = y - gapB;
  boxes.forEach((x) => { x.barTop = x.top + (x.h - x.barH - x.innerH) / 2; });
  const aH = segs.reduce((a, b) => a + Math.max(b.v * k, 2), 0);
  const aTop = Math.max(0, Hn / 2 - aH / 2);
  let ay = aTop;
  let back = '', s = '';
  boxes.forEach((x) => {
    const b = x.b, a0 = ay, a1 = ay + x.barH; ay = a1;
    const b0 = x.barTop, b1 = b0 + x.barH;
    const cls = b.extra ? 'bd ex' : b.s.core ? 'bd core' : 'bd';
    back += `<path class="${cls}" d="${band(xA + bw, a0, a1, xB, b0, b1)}"><title>${esc(b.s.name)}: ${esc(money(G, b.v))}, ${pc(b.v, base(M))}</title></path>`;
    s += `<rect class="${b.extra ? 'nb ex' : 'nb'}" x="${xB}" y="${f1(b0)}" width="${bw}" height="${f1(x.barH)}"/>`;
    if (x.innerH) s += `<rect class="ni" x="${xB}" y="${f1(b1)}" width="${bw}" height="${f1(x.innerH)}"/>`;
    s += segText(G, x.lab, xL, x.top + (x.h - x.lab.h) / 2, 'start');
  });
  s += `<rect class="na" x="${xA}" y="${f1(aTop)}" width="${bw}" height="${f1(aH)}"/>`;
  const id = `${o.cls}-${lens}`;
  let head = '', clip = '', top = -12, bottom = Hn + 12;
  if (o.head) {
    const P = parentHead(G, xA - 10, aTop + aH / 2, money(G, M.total), pageUrl(G, 'segments'), `${M.short.toUpperCase()}, ${(M.when || G.period).toUpperCase()}`, `sk-disc2-${lens}`);
    head = P.svg; clip = P.clip; top = Math.min(top, P.top - 4); bottom = Math.max(bottom, P.bottom + 4);
  }
  const defs = `<defs><pattern id="sk-hatch-${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="#0B0B0C" stroke-width="1.6"/></pattern>${clip}</defs>`;
  const style = `<style>.${id} .ni{fill:url(#sk-hatch-${id});stroke:#0B0B0C;stroke-width:1}</style>`;
  return `<svg class="sk-svg ${id}" viewBox="0 ${f1(top)} ${W} ${f1(bottom - top)}" width="${W}" height="${f1(bottom - top)}" role="img" aria-label="${esc(G.short)}: ${esc(M.label.toLowerCase())} by segment, ${esc(G.period)}">${defs}${style}${back}${s}${head}</svg>`;
}
const phoneSvg = (G, lens) => twoColSvg(G, lens, { W: 358, xA: 0, xB: 100, H: 470, wrapN: 34, cls: 'skp' });
const placedAny = (G) => G.segments.some((s) => s.cos.length || (s.units || []).length);

/* the lists under the map: every company, with nested branches; the table view on every screen */
function makeLi(G) {
  const duties = (id) => G.duties.filter((d) => d.node === id);
  const chip = (d) => `<a class="sk-chip" href="${esc(d.u)}" target="_blank" rel="noopener" title="${esc(KIND[d.kind].label)}: ${esc(d.text)}"><i style="background:${KIND[d.kind].c}"></i>${esc(d.chip)}</a>`;
  const under = (n) => (n === 1 ? '1 company under it' : n + ' companies under it');
  const kidLi = (k) => {
    const st = ST[k.status], ds = duties(k.id);
    let s = `<li id="co-${esc(k.id)}"><div class="kr"><span class="n">${badgeHtml(k, 16)}${esc(k.name)}${st ? ` <em>${esc(st)}</em>` : ''}</span><span class="p">${A(k.u, esc(stake(k.stake)))}${k.assets != null ? ` · ${A(assetUrl(G, k), esc(money(G, k.assets)))}` : ''}</span></div>`;
    if (ds.length) s += `<div class="sk-chips">${ds.map(chip).join('')}</div>`;
    if (k.kids && k.kids.length) s += `<details><summary>${under(k.kids.length)}</summary><ul>${k.kids.map(kidLi).join('')}</ul></details>`;
    return s + '</li>';
  };
  /* a long list shows its first eight; the rest open in place */
  const kidList = (ks) => (ks.length > CAP
    ? `<ul class="sk-kids">${ks.slice(0, CAP).map(kidLi).join('')}</ul><details class="sk-rest"><summary>${ks.length - CAP} more</summary><ul class="sk-kids">${ks.slice(CAP).map(kidLi).join('')}</ul></details>`
    : `<ul class="sk-kids">${ks.map(kidLi).join('')}</ul>`);
  const coLi = (co) => {
    const st = ST[co.status], ds = duties(co.id);
    let s = `<li class="sk-co${st ? ' off' : ''}" id="co-${esc(co.id)}"><div class="r1"><span class="n">${badgeHtml(co, 22)}${esc(co.name)}</span><span class="p">${A(co.u, esc(stake(co.stake)))}</span></div>`;
    const meta = [co.via ? `via ${esc(co.via)}` : '', co.assets != null ? `assets ${A(assetUrl(G, co), esc(money(G, co.assets)))}` : '', st ? esc(st) : ''].filter(Boolean).join(' · ');
    s += `<div class="s">${esc(co.sector || '')}${meta ? `<br>${meta}` : ''}</div>`;
    if (ds.length) s += `<div class="sk-chips">${ds.map(chip).join('')}</div>`;
    if (co.kids.length) s += `<details><summary>${under(co.kids.length)}</summary><ul>${co.kids.map(kidLi).join('')}</ul></details>`;
    return s + '</li>';
  };
  return { coLi, kidList, chip, duties };
}

function lists(G) {
  const { coLi } = makeLi(G);
  const M = G.measures.rev, su = pageUrl(G, 'segments');
  const blocks = G.segments.map((s) => `<section class="sk-seg" id="seg-${esc(s.id)}"><div class="hd"><span class="k">${esc(s.name)}${s.core ? ' · core' : ''}</span>` +
    `<h3>${esc(s.plain)}</h3><div class="v">${A(su, esc(money(G, s.rev)))} <span>${pc(s.rev, base(M))} of revenue</span></div>${s.inter ? `<div class="iv">+${A(su, esc(money(G, s.inter)))} sold inside the group</div>` : ''}<p>${esc(s.desc)}</p></div>` +
    `<ul>${s.cos.map(coLi).join('')}${(s.units || []).map((u) => `<li class="sk-co unit"><div class="r1"><span class="n">${esc(u.name)}</span><span class="p">inside ${esc(G.short)}</span></div><div class="s">${esc(u.plain)}</div></li>`).join('')}</ul></section>`).join('');
  const rest = G.unplaced.length ? `<section class="sk-seg"><div class="hd"><span class="k">Not in a segment</span><h3>Not placed in any business</h3><p>${esc(G.short)} does not name ${G.unplaced.length === 1 ? 'this company' : 'these companies'} in any business.</p></div><ul>${G.unplaced.map(coLi).join('')}</ul></section>` : '';
  return blocks + rest;
}

/* counts: one block per direct subsidiary, its companies listed */
function countsLists(G) {
  const { kidList, chip, duties } = makeLi(G);
  return G.tops.map((x) => {
    const st = ST[x.status], ds = duties(x.id);
    const head = x.synthetic ? 'Parent not stated' : [stake(x.stake), st || 'active'].join(' · ');
    return `<section class="sk-seg${st ? ' off' : ''}" id="co-${esc(x.id)}"><div class="hd"><span class="k">${x.synthetic ? esc(head) : A(x.u, esc(head))}</span><h3>${x.synthetic ? '' : badgeHtml(x, 28)}${esc(x.name)}</h3>` +
      `<div class="v">${x.n} ${x.n === 1 ? 'company' : 'companies'}</div>${x.sector ? `<p>${esc(x.sector)}</p>` : ''}${ds.length ? `<div class="sk-chips">${ds.map(chip).join('')}</div>` : ''}</div>` +
      (x.kids.length ? kidList(x.kids) : `<p class="sk-none">No companies under it.</p>`) + '</section>';
  }).join('');
}


/* counts, desktop: the group | each direct subsidiary, as wide as its branch | the companies one level down.
   As on the money maps, each band runs straight under its own subsidiary's label and logo. */
function countsWideSvg(G) {
  const W = 1140, xA = 150, bw = 12, xB = 560, gapB = 10, xC = 640, dw = 20, LBW = 230;
  const duties = (id) => G.duties.filter((d) => d.node === id);
  const tops = G.tops;
  const total = tops.reduce((a, x) => a + x.n, 0);
  const blk = new Map(tops.map((x) => {
    const st = ST[x.status];
    const meta = [x.synthetic ? '' : stake(x.stake), st ? ST_SHORT[x.status] : '', `${x.n} ${x.n === 1 ? 'COMPANY' : 'COMPANIES'}`].filter(Boolean).join(' · ');
    return [x, rowBlock(x.name, `cnm${st ? ' off' : ''}`, meta, duties(x.id), LBW)];
  }));
  const bh = (x) => Math.max(28, blk.get(x).h);
  /* the companies one level down come first, branch by branch; each subsidiary then sits beside its own */
  const grp = new Map();
  let yc = 0;
  tops.forEach((x) => {
    if (!x.kids.length) return;
    const rowsN = Math.min(x.kids.length, CAP);
    grp.set(x, { top: yc, bot: yc + rowsN * 24 });
    yc += rowsN * 24 + 10;
  });
  const LW = Math.max(...tops.map((x) => blk.get(x).w));
  const xR = Math.max(xA + bw + 90, xB - 46 - LW - 14);
  const slot = (x, k) => { const bar = Math.max(x.n * k, 2); return bar >= bh(x) + 10 ? bar : bh(x) + 6 + bar; };
  const H = Math.max(480, yc - 10, tops.reduce((a, x) => a + bh(x) + 8, 0) + gapB * (tops.length - 1));
  let k = (H - gapB * (tops.length - 1)) / total;
  for (let i = 0; i < 120 && tops.reduce((a, x) => a + slot(x, k), 0) + gapB * (tops.length - 1) > H; i++) k *= 0.96;
  let prev = null;
  const boxes = tops.map((x) => {
    const barH = Math.max(x.n * k, 2), h = slot(x, k), g = grp.get(x);
    const want = g ? (g.top + g.bot) / 2 : prev ? prev.want + prev.h / 2 + gapB + h / 2 : h / 2;
    const b = { x, h, barH, want, inBand: barH >= bh(x) + 10 };
    prev = b;
    return b;
  });
  pack(boxes, H, gapB);
  boxes.forEach((b) => {
    b.barTop = b.inBand ? b.top : b.top + bh(b.x) + 6;
    b.labTop = b.inBand ? b.barTop + (b.barH - bh(b.x)) / 2 : b.top;
  });
  const rows = [];
  boxes.forEach((b) => {
    const g = grp.get(b.x);
    if (!g) return;
    const pr = { co: b.x, yc: b.barTop + b.barH / 2, b };
    const ks = b.x.kids, shown = ks.length > CAP ? ks.slice(0, CAP - 1) : ks, more = ks.length - shown.length;
    const nR = shown.length + (more ? 1 : 0), y0 = (i) => b.barTop + b.barH * (i + 0.5) / nR;
    shown.forEach((k2, i) => rows.push({ k: k2, pr, y: g.top + i * 24 + 12, y0: y0(i) }));
    if (more) rows.push({ more, pr, y: g.top + shown.length * 24 + 12, y0: y0(shown.length) });
  });
  const aH = boxes.reduce((a, b) => a + b.barH, 0);
  const aTop = Math.max(0, Math.min(H / 2 - aH / 2, H - aH));
  let ay = aTop;
  const back = [], front = [];
  boxes.forEach((b) => {
    const x = b.x, id = esc(x.id), st = ST[x.status], dim = st || x.synthetic, B = blk.get(x);
    const a0 = ay, a1 = ay + b.barH; ay = a1;
    back.push(`<path class="bd${dim ? ' ex' : ' cnt'}" data-seg="${id}" d="${runBand(xA + bw, a0, a1, xR, xB, b.barTop, b.barTop + b.barH)}"><title>${esc(x.name)}: ${x.n} ${x.n === 1 ? 'company' : 'companies'}</title></path>`);
    let s = `<g class="sk-g" data-seg="${id}"><rect class="nb${dim ? ' ex' : ''}" x="${xB}" y="${f1(b.barTop)}" width="${bw}" height="${f1(b.barH)}"/>`;
    const tip = `${x.name}${x.legal ? ` (${x.legal})` : ''}${x.synthetic ? '' : `: ${stake(x.stake)} owned by ${G.short}`}; ${x.n} ${x.n === 1 ? 'company' : 'companies'} in this branch${x.sector ? `; ${x.sector}` : ''}${st ? `; ${st}` : ''}`;
    const bt = b.labTop + (bh(x) - B.h) / 2;
    s += badge(x, xB - 24, bt + B.mid, 14);
    s += `<a href="#co-${id}">${drawText(B, xB - 46, bt, 'end', `<title>${esc(tip)}</title>`)}</a>` + drawChips(B, xB - 46, bt);
    rows.filter((r) => r.pr.b === b).forEach((r) => { s += kidRow(G, r, xB + bw, xC, dw, W - (xC + dw + 6) - 4); });
    front.push(s + '</g>');
  });
  const P = parentHead(G, xA - 10, aTop + aH / 2, `${total} companies`, null, 'IN THE GROUP', 'sk-disc-c');
  const head = `<rect class="na" x="${xA}" y="${f1(aTop)}" width="${bw}" height="${f1(aH)}"/>` + P.svg;
  const defs = P.clip ? `<defs>${P.clip}</defs>` : '';
  const style = `<style>${hoverCss('sk-cnt', boxes.map((b) => esc(b.x.id)))}</style>`;
  const top = Math.min(-14, P.top - 4), Hv = Math.max(H + 14, P.bottom + 4) - top;
  return `<svg class="sk-svg sk-cnt" viewBox="0 ${f1(top)} ${W} ${f1(Hv)}" width="${W}" height="${f1(Hv)}" role="img" aria-label="${esc(G.short)}: its ${total} companies by branch, counts not money">${defs}${style}<g class="sk-back">${back.join('')}</g>${front.join('')}${head}</svg>`;
}

/* counts, phone: the group and its direct subsidiaries, labels to the right; past twelve, the rest share one band */
function countsPhoneSvg(G) {
  const W = 358, xA = 0, bw = 10, xB = 96, gapB = 8, lh = 36;
  let tops = G.tops;
  if (tops.length > 12) {
    const rest = tops.slice(11);
    tops = tops.slice(0, 11).concat([{ id: '_rest', name: `${rest.length} more subsidiaries`, n: rest.reduce((a, x) => a + x.n, 0), status: 'active', synthetic: true, more: true }]);
  }
  const H0 = Math.max(360, tops.length * (lh + gapB));
  const total = tops.reduce((a, x) => a + x.n, 0);
  let k = (H0 - gapB * (tops.length - 1)) / total;
  for (let i = 0; i < 60; i++) {
    if (tops.reduce((a, x) => a + Math.max(x.n * k, lh), 0) + gapB * (tops.length - 1) <= H0) break;
    k *= 0.96;
  }
  let y = 0, back = '', s = '';
  const boxes = tops.map((x) => {
    const barH = Math.max(x.n * k, 2), h = Math.max(barH, lh);
    const b = { x, top: y, h, barH, barTop: y + (h - barH) / 2 };
    y += h + gapB;
    return b;
  });
  const Hn = y - gapB;
  const aH = boxes.reduce((a, b) => a + b.barH, 0);
  const aTop = Math.max(0, Hn / 2 - aH / 2);
  let ay = aTop;
  boxes.forEach((b) => {
    const x = b.x, st = ST[x.status], dim = st || x.synthetic;
    const a0 = ay, a1 = ay + b.barH; ay = a1;
    back += `<path class="bd${dim ? ' ex' : ' cnt'}" d="${band(xA + bw, a0, a1, xB, b.barTop, b.barTop + b.barH)}"/>`;
    s += `<rect class="nb${dim ? ' ex' : ''}" x="${xB}" y="${f1(b.barTop)}" width="${bw}" height="${f1(b.barH)}"/>`;
    const yl = b.top + b.h / 2 - 2;
    if (!x.more) s += badge(x, xB + bw + 20, yl + 3, 11);
    const lx = x.more ? xB + bw + 8 : xB + bw + 38, room = W - lx - 4;
    const parts = [x.synthetic ? '' : stake(x.stake), st ? ST_SHORT[x.status] : '', `${x.n} ${x.n === 1 ? 'COMPANY' : 'COMPANIES'}`];
    /* a lone company needs no "1 COMPANY" when the line would run off the phone */
    if (x.n === 1 && tw(parts.filter(Boolean).join(' · '), 'k') > room) parts.pop();
    const meta = fitW(parts.filter(Boolean).join(' · '), 'k', room);
    s += `<text x="${lx}" y="${f1(yl)}"><tspan class="cnm${st ? ' off' : ''}">${esc(fitW(x.name, 'cnm', room))}</tspan><tspan class="k" x="${lx}" dy="14">${esc(meta)}</tspan></text>`;
  });
  s += `<rect class="na" x="${xA}" y="${f1(aTop)}" width="${bw}" height="${f1(aH)}"/>`;
  return `<svg class="sk-svg" viewBox="0 -12 ${W} ${f1(Hn + 24)}" width="${W}" height="${f1(Hn + 24)}" role="img" aria-label="${esc(G.short)}: its companies by branch, counts not money">${back}${s}</svg>`;
}

const STYLE = `.sk-wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.sk-back{font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;text-decoration:none;display:inline-block;margin-bottom:18px}
.sk-back:hover{color:#000}
.sk{position:relative}
.sk-in{position:absolute;opacity:0;pointer-events:none}
.sk-ctl{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.sk-ctl label{cursor:pointer}
.sk-view{display:none}
.sk-key{font:400 11px/1.6 'IBM Plex Mono',monospace;letter-spacing:.03em;color:#6B6B73;margin:10px 0 0;max-width:120ch}
.sk-key a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.sk-key .hx{display:inline-block;width:14px;height:10px;vertical-align:-1px;border:1px solid #0B0B0C;background:repeating-linear-gradient(45deg,#0B0B0C 0 1.2px,#fff 1.2px 4px)}
.sk-legend{display:flex;flex-wrap:wrap;gap:6px 16px;font:400 10.5px/1.4 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#3F3F46;margin:0 0 14px}
.sk-legend i{display:inline-block;width:8px;height:8px;margin-right:6px;vertical-align:0}
.sk-legend .core{width:18px;height:8px;background:#C9C9C1}
.sk-legend .nc{width:18px;height:8px;background:#ECECE7}
.sk-wide{border:1px solid #E7E7E7;background:#fff;padding:18px 0 10px}
.sk-svg{display:block;width:100%;height:auto;overflow:visible}
.sk-phone .sk-svg{max-width:500px}
.sk-svg text{font-family:'Overused Grotesk',system-ui,sans-serif;fill:#0B0B0C;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.sk-svg .k,.sk-svg .ch,.sk-svg .sh{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.04em;fill:#6B6B73}
.sk-svg .ch{font-size:9.5px;fill:#3F3F46}
.sk-svg .k.in{fill:#3F3F46}
.sk-svg .pl{font-size:13.5px;font-weight:600}
.sk-svg .v{font-size:15px;font-weight:650}
.sk-svg .sh{font-size:11px}
.sk-svg .pn{font-size:17px;font-weight:650}
.sk-svg .cnm{font-size:13px;font-weight:600}
.sk-svg .cnm.off,.sk-svg .dnm.off{fill:#9A9AA0;font-weight:500}
.sk-svg .cnm.unit{font-weight:500;fill:#52525B}
.sk-svg .dnm{font-size:12.5px;font-weight:500}
.sk-svg a text:hover .cnm,.sk-svg a text:hover .dnm{text-decoration:underline}
.sk-svg .sl:hover .v{text-decoration:underline}
.sk-svg .bd{fill:#ECECE7;stroke:#fff;stroke-width:1.5;stroke-linejoin:round}
.sk-svg .bd.core{fill:#C9C9C1}
.sk-svg .bd.ex{fill:#F4F4F1}
.sk-svg .nb,.sk-svg .na{fill:#0B0B0C}
.sk-svg .nb.ex{fill:#9A9AA0}
.sk-svg .lg{fill:none;stroke:rgba(0,0,0,.12);stroke-width:1.5}
.sk-svg .cn{fill:none;stroke:#C9C9CF;stroke-width:1.2}
.sk-svg .cn[style]{stroke-width:2.2}
.sk-svg .cn.unit{stroke-dasharray:3 3}
.sk-svg .ck{fill:none;stroke:#DCDCE0;stroke-width:1}
.sk-svg .un{fill:none;stroke:#B4B4BA;stroke-width:1.2;stroke-dasharray:2 4}
.sk-svg .nc{fill:#0B0B0C}
.sk-svg .bdc{fill:#fff;stroke:rgba(0,0,0,.14);stroke-width:1}
.sk-svg .bdm{fill:#F1F1EE;stroke:rgba(0,0,0,.12);stroke-width:1}
.sk-svg .bdi{font-family:'IBM Plex Mono',monospace;fill:#52525B;stroke:none;letter-spacing:0}
.sk-svg .bdg{filter:drop-shadow(0 1px 1.5px rgba(24,32,36,.16))}
.sk-svg .bdg.off{opacity:.45}
.sk-svg .lgb{fill:#fff;filter:drop-shadow(0 2px 5px rgba(24,32,36,.22))}
.sk-lg{border-radius:50%;vertical-align:-5px;margin-right:8px;box-shadow:0 0 0 1px rgba(0,0,0,.10);background:#fff;flex:none}
.sk-mg{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#F1F1EE;box-shadow:0 0 0 1px rgba(0,0,0,.10);font-family:'IBM Plex Mono',monospace;color:#52525B;vertical-align:-5px;margin-right:8px;letter-spacing:0;flex:none}
.sk-seg h3 .sk-lg,.sk-seg h3 .sk-mg{vertical-align:-7px}
.sk-svg .nc.off,.sk-svg .nd.off{fill:#fff;stroke:#9A9AA0;stroke-width:1.2}
.sk-svg .nc.unit{fill:#fff;stroke:#52525B;stroke-width:1.2;stroke-dasharray:2 2}
.sk-svg .nd{fill:#3F3F46}
.sk-svg [data-seg]{transition:opacity .15s}
.sk-phone{display:none}.phone-only{display:none}
.sk-seg .iv{font:400 11px/1.4 'IBM Plex Mono',monospace;color:#3F3F46;margin-top:2px}
.sk-ph{font-size:15px;margin:0 0 10px}.sk-ph a{font-weight:650;color:#000;text-decoration:none;border-bottom:1px solid #D9D9D9}
.sk-ph span{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;display:block;margin-top:2px}
@media(max-width:999px){.sk-wide,.wide-only{display:none}.sk-phone,.phone-only{display:inline}.sk-phone{display:block}.sk-legend{gap:5px 12px;font-size:10px}.sk-key{margin-top:12px}}
.sk-segs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:999px){.sk-segs{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.sk-segs{grid-template-columns:minmax(0,1fr)}}
.sk-seg{background:#fff;padding:16px 16px 10px;scroll-margin-top:12px}
.sk-seg .hd{border-bottom:1px solid #F1F1F1;padding-bottom:10px;margin-bottom:4px}
.sk-seg .k{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.sk-seg h3{font-size:17px;font-weight:650;line-height:1.2;margin:4px 0 6px}
.sk-seg .v{font-weight:650;font-size:16px}
.sk-seg .v a,.sk-co a,.sk-duty a,.sk-tbl a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.sk-seg .v span{font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73;margin-left:4px}
.sk-seg p{color:#52525B;font-size:13px;line-height:1.45;margin-top:6px}
.sk-seg ul{list-style:none}
.sk-co{padding:8px 0;border-bottom:1px solid #F4F4F4;scroll-margin-top:12px}
.sk-co:last-child{border-bottom:0}
.sk-co .r1{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.sk-co .n{font-weight:600;font-size:14px}
.sk-co .p{font:400 12px/1.3 'IBM Plex Mono',monospace;white-space:nowrap}
.sk-co .s{color:#6B6B73;font-size:12.5px;line-height:1.45;margin-top:2px}
.sk-co.off .n{color:#6B6B73;font-weight:500}
.sk-co.unit .n{font-weight:500;color:#52525B}
.sk-co.unit .p{color:#6B6B73;font-size:11px}
.sk-co details{margin-top:5px}
.sk-co summary{cursor:pointer;font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73}
.sk-co details ul{margin:6px 0 2px;padding-left:10px;border-left:2px solid #F1F1F1;display:grid;gap:4px}
.sk-co details li{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;line-height:1.35;color:#3F3F46;scroll-margin-top:12px}
.sk-co details li em{font:normal 400 10.5px/1 'IBM Plex Mono',monospace;color:#9A9AA0;text-transform:uppercase;letter-spacing:.04em}
.sk-co details li .p{font-size:11.5px}
.sk-chips{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:5px}
.sk-chip{font:400 10px/1.3 'IBM Plex Mono',monospace!important;letter-spacing:.05em;text-transform:uppercase;color:#3F3F46!important;border:0!important;text-decoration:none}
.sk-chip i,.sk-duty .kd i{display:inline-block;width:7px;height:7px;margin-right:5px;vertical-align:0}
.sk-co:target,.sk-co details li:target{background:#FAFAF7}
.sk-duty{list-style:none;border:1px solid #E7E7E7}
.sk-duty li{display:grid;grid-template-columns:190px minmax(0,1fr);gap:4px 16px;padding:12px 16px;border-bottom:1px solid #F1F1F1;font-size:14px;line-height:1.5;color:#3F3F46}
.sk-duty li:last-child{border-bottom:0}
.sk-duty .kd{font:400 10.5px/1.6 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#3F3F46}
.sk-duty b{color:#000;font-weight:650}
.sk-duty .dt{font:400 11px/1 'IBM Plex Mono',monospace;color:#9A9AA0}
@media(max-width:640px){.sk-duty li{grid-template-columns:minmax(0,1fr)}}
.sk-tbl table{min-width:640px}
.sk-after{display:flex;flex-direction:column}
.sk-after>.wrap{width:100%}
@media(max-width:999px){.sk-s-cos{order:-1;padding-top:30px}.sk-s-duty{padding-top:44px!important}}
.sk-tbl td .mu{color:#6B6B73;font-size:12px}
.sk-legend .cn{width:18px;height:8px;background:#DCDCD5}
.sk-svg .bd.cnt{fill:#DCDCD5}
.sk-svg .k.more{fill:#2A6E9F}
.sk-co details li{display:block}
.sk-kids{display:grid;gap:4px;margin-top:6px}
.sk-kids li,.sk-co details li{font-size:12.5px;line-height:1.35;color:#3F3F46;scroll-margin-top:12px}
.sk-kids li .kr,.sk-co details li .kr{display:flex;justify-content:space-between;gap:8px}
.sk-kids li em{font:normal 400 10.5px/1 'IBM Plex Mono',monospace;color:#9A9AA0;text-transform:uppercase;letter-spacing:.04em}
.sk-kids li .p{font:400 11.5px/1.3 'IBM Plex Mono',monospace;white-space:nowrap}
.sk-kids li .p a,.sk-seg .hd .k a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.sk-kids details,.sk-rest{margin-top:4px}
.sk-kids details ul{margin:5px 0 2px;padding-left:10px;border-left:2px solid #F1F1F1;display:grid;gap:4px;list-style:none}
.sk-kids summary,.sk-rest summary{cursor:pointer;font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73}
.sk-seg.off h3{color:#6B6B73}
.sk-none{font-size:12.5px!important;color:#9A9AA0!important}
.sk-kids li:target{background:#FAFAF7}
`;

function dutySection(G, who) {
  if (!G.duties.length) return '';
  const rows = G.duties.map((d) => `<li><span class="kd"><i style="background:${KIND[d.kind].c}"></i>${esc(KIND[d.kind].label)}</span><div><b>${esc(who(d.node))}</b> ${esc(d.text)} <a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(host(d.u))}</a>${d.d ? `<span class="dt"> · ${esc(day(d.d))}</span>` : ''}</div></li>`).join('');
  return `<section class="wrap sk-s-duty" style="padding-top:36px">
  <div class="eyebrow"><span class="sq"></span>WHAT THE STATE ASKS OF ${esc(G.short.toUpperCase())}</div>
  <ul class="sk-duty">${rows}</ul>
</section>`;
}
const legendHtml = (G, extra) => `<div class="sk-legend">${extra}${G.duties.length ? [...new Set(G.duties.map((d) => d.kind))].sort((a, b) => Object.keys(KIND).indexOf(a) - Object.keys(KIND).indexOf(b)).map((k) => `<span><i style="background:${KIND[k].c}"></i>${esc(KIND[k].label)}</span>`).join('') : ''}</div>`;

function findName(G, id) {
  if (id === G.slug) return G.short;
  const stack = (G.basis === 'segments' ? G.segments.flatMap((s) => s.cos).concat(G.unplaced) : G.tops).slice();
  while (stack.length) {
    const x = stack.pop();
    if (x.id === id) return x.name;
    (x.kids || []).forEach((k) => stack.push(k));
  }
  return id;
}

function segmentsBody(G, slug) {
  const R = G.measures.rev, C = G.measures.capex;
  const placed = placedAny(G);
  const su = pageUrl(G, 'segments'), pu = pageUrl(G, 'placement'), cu = pageUrl(G, 'core'), au = pageUrl(G, 'subs');
  const lenses = Object.keys(G.measures);
  const lensBlock = (lens) => {
    const M = G.measures[lens];
    const adj = M.unalloc < 0 ? ` The segments add up to ${esc(money(G, base(M)))}; adjustments and eliminations of ${esc(money(G, M.unalloc))} bring the group total to ${esc(money(G, M.total))}.` : M.unalloc > 0 ? ` ${esc(money(G, M.unalloc))} is not assigned to a segment.` : '';
    const key = `Band width = ${esc(lc1(M.label))}${M.when ? '' : `, ${esc(G.period_long)}`} (${A(su, 'segment note')}).${lens === 'rev' && G.segments.some((x) => x.inter) ? ` <span class="hx"></span> Hatched = sales to other businesses in the group, left out of the ${esc(money(G, M.total))} total.` : ''}${adj}`;
    return `<div class="sk-view sk-v-${lens}">` +
      `<div class="sk-wide">${placed ? wideSvg(G, lens) : twoColSvg(G, lens, { W: 1140, xA: 150, xB: 560, H: 460, wrapN: 80, cls: 'sko', head: true })}</div><div class="sk-phone"><div class="sk-ph"><b>${esc(G.short)}</b> ${A(su, esc(money(G, M.total)))} <span>${esc(M.short.toLowerCase())}, ${esc(G.period_long)}</span></div>${phoneSvg(G, lens)}</div>` +
      `<p class="sk-key">${key} ${placed ? '<span class="wide-only">Lines to the right show where each company sits; they carry no money.</span><span class="phone-only">The companies in each business are listed below.</span>' : G.unplaced.length ? `${esc(G.short)} does not place its companies in these segments; they are mapped below, branch by branch.` : ''}</p></div>`;
  };
  const segRows = G.segments.map((s) => `<tr><td><b>${esc(s.name)}</b><br><span class="mu">${esc(s.plain)}${s.core ? ' · core' : ''}</span></td>` +
    `<td class="n">${A(su, esc(money(G, s.rev)))}</td><td class="n">${A(su, esc(pc(s.rev, base(R))))}</td><td class="n">${s.inter != null ? A(su, esc(money(G, s.inter))) : '—'}</td>${C ? `<td class="n">${A(su, esc(money(G, s.capex)))}</td>` : ''}<td class="n">${s.result != null ? A(su, esc(money(G, s.result))) : '—'}</td></tr>`).join('');
  const toggle = (lenses.length > 1
    ? lenses.map((k, i) => `<input class="sk-in" type="radio" name="sk-lens" id="sk-l-${k}"${i ? '' : ' checked'}>`).join('') +
      `<div class="sk-ctl" role="group" aria-label="What the band widths show">${lenses.map((k) => `<label class="chip" for="sk-l-${k}">${esc(G.measures[k].chip || G.measures[k].short)}</label>`).join('')}</div>`
    : `<input class="sk-in" type="radio" name="sk-lens" id="sk-l-${lenses[0]}" checked>`) +
    `<style>${lenses.map((k) => `#sk-l-${k}:checked~.sk-v-${k}{display:block}#sk-l-${k}:checked~.sk-ctl label[for=sk-l-${k}]{background:#000;border-color:#000;color:#fff}#sk-l-${k}:focus-visible~.sk-ctl label[for=sk-l-${k}]{outline:2px solid #000;outline-offset:2px}`).join('')}</style>`;
  return `
<section class="hero" style="padding-bottom:26px">
  <a class="sk-back" href="/bumn#${esc(slug)}">← All state companies</a>
  <div class="eyebrow"><span class="sq"></span>GROUP MAP · ${esc(G.short.toUpperCase())} · ${esc(G.period.toUpperCase())}</div>
  <h1>${esc(G.short)}, by ${esc(G.seg_word || 'business')} and by company</h1>
  <p class="sub">${esc(G.measures.rev.short)} for ${esc(G.period_long)} by ${esc(G.seg_word || 'business')}, then ${placed ? 'the companies in each one' : `its ${G.counts.all} companies, branch by branch`}.${G.duties.length ? ' Colour marks the ones the state leans on.' : ''}</p>
</section>
<section class="sk-wrap">
  <div class="sk">
    ${toggle}
    ${legendHtml(G, G.segments.some((s) => s.core) ? `<span><i class="core"></i>Core business, in ${esc(G.short)}’s ${A(cu, 'own words')}</span><span><i class="nc"></i>Other businesses</span>` : '')}
    ${lenses.map(lensBlock).join('\n    ')}
  </div>
</section>
<div class="sk-after">
${dutySection(G, (id) => findName(G, id))}
${placed ? `<section class="wrap sk-s-cos">
  <div class="eyebrow"><span class="sq"></span>THE COMPANIES, BY BUSINESS</div>
  <p class="lede">The businesses are the ones ${esc(G.short)} reports in its statements; ${G.placement_how === 'definition' ? `each company is placed by its line of business, against the segment definitions in those statements` : `which company sits in which business is ${esc(G.short)}’s own grouping`}${pu ? ` (${A(pu, esc(G.src[G.pages.placement[0]].label || 'source'))})` : ''}. ${G.assets_src ? `Stakes and total assets (before group eliminations) are at ${esc(day(G.as_of))} (${A(au, 'statements')}); tap a figure for its page.` : 'Tap a stake for its source.'}</p>
  <div class="sk-segs">${lists(G)}</div>
</section>` : G.unplaced.length ? companiesByBranch(G) : ''}
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>THE SEGMENT NOTE, ${esc(G.period.toUpperCase())}</div>
  <div class="tablewrap sk-tbl"><table><thead><tr><th>Business</th><th class="n">Outside customers</th><th class="n">Share</th><th class="n">Inside the group</th>${C ? '<th class="n">Capital spending</th>' : ''}<th class="n">Segment result</th></tr></thead><tbody>${segRows}
  <tr><td><b>Group total</b><br><span class="mu">sales inside the group removed${G.result_total != null && G.result_note ? '; result = ' + esc(G.result_note) : ''}</span></td><td class="n">${A(su, esc(money(G, R.total)))}</td><td class="n">100%</td><td class="n" title="Sales between the group’s businesses cancel out in the group total">—</td>${C ? `<td class="n">${A(su, esc(money(G, C.total)))}</td>` : ''}<td class="n">${G.result_total != null ? A(su, esc(money(G, G.result_total))) : '—'}</td></tr></tbody></table></div>
  <p class="foot-note">Figures in rupiah for ${esc(G.period_long)}, from ${A(G.src.fs.u, esc(G.src.fs.t))}, ${esc(G.pages.segments[2])}.${C && C.unalloc ? ` Capital spending includes ${esc(money(G, C.unalloc))} the statements do not assign to a business.` : ''}</p>
</section>
</div>`;
}

/* the company tree as a counts Sankey and lists; on a segment page whose segments hold no companies */
function companiesByBranch(G) {
  const C2 = Object.assign({}, G, { tops: G.unplaced });
  const total = C2.tops.reduce((a, x) => a + x.n, 0);
  return `<section class="wrap sk-s-cos">
  <div class="eyebrow"><span class="sq"></span>ITS ${total} ${total === 1 ? 'COMPANY' : 'COMPANIES'}, BRANCH BY BRANCH</div>
  <p class="lede">Each direct subsidiary is as wide as the number of companies in its branch: counts, not money. Tap a stake for its source.</p>
  <div class="sk-wide">${countsWideSvg(C2)}</div>
  <div class="sk-phone">${countsPhoneSvg(C2)}</div>
  <div class="sk-segs" style="margin-top:14px">${countsLists(C2)}</div>
</section>`;
}

function countsBody(G, slug) {
  const total = G.tops.reduce((a, x) => a + x.n, 0);
  const b = G.basis_doc;
  return `
<section class="hero" style="padding-bottom:26px">
  <a class="sk-back" href="/bumn#${esc(slug)}">← All state companies</a>
  <div class="eyebrow"><span class="sq"></span>GROUP MAP · ${esc(G.short.toUpperCase())} · COMPANIES</div>
  <h1>${esc(G.short)}, company by company</h1>
  <p class="sub">Its ${total} ${total === 1 ? 'company' : 'companies'}, branch by branch. Each band is as wide as the number of companies in its branch: counts, not money.${G.duties.length ? ' Colour marks the ones the state leans on.' : ''}</p>
</section>
<section class="sk-wrap">
  <div class="sk">
    ${legendHtml(G, '<span><i class="cn"></i>Active subsidiary</span><span><i class="nc"></i>Not active, or parent not stated</span>')}
    <div class="sk-wide">${countsWideSvg(G)}</div>
    <div class="sk-phone"><div class="sk-ph"><b>${esc(G.short)}</b> ${total} ${total === 1 ? 'company' : 'companies'} <span>in the group</span></div>${countsPhoneSvg(G)}</div>
    <p class="sk-key">Band width = number of companies in each branch: the subsidiary itself and every company under it. Counts, not money.${G.note ? ' ' + esc(G.note) + (G.note_u ? ` (${A(G.note_u, esc(host(G.note_u)))})` : '') : ''} <span class="wide-only">Lines to the right show the companies one level down; the lists below show every company.</span><span class="phone-only">Every company is listed below.</span></p>
  </div>
</section>
<div class="sk-after">
${dutySection(G, (id) => findName(G, id))}
<section class="wrap sk-s-cos">
  <div class="eyebrow"><span class="sq"></span>THE COMPANIES, BRANCH BY BRANCH</div>
  <p class="lede">${b && b.u ? `Stakes as of ${esc(day(b.as_of))}, from ${A(b.u, esc(host(b.u)))}; tap a stake for its own source.` : 'Tap a stake for its source.'}</p>
  <div class="sk-segs">${countsLists(G)}</div>
</section>
</div>`;
}

function page({ slug, lang = 'en' }) {
  if (!live()) return null;
  const D = load();
  const G = D && D.groups && Object.prototype.hasOwnProperty.call(D.groups, slug) ? D.groups[slug] : null;
  if (!G) return null;
  const p = '/bumn/' + slug;
  const seg = G.basis === 'segments';
  const n = G.counts.all;
  CLIP = 0;
  const body = `\n<style>\n${STYLE}</style>` + (seg ? segmentsBody(G, slug) : countsBody(G, slug));
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'BUMN', path: '/bumn' }, { name: G.short, path: p }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: seg ? `${G.short}: revenue by business and the companies in its group` : `${G.short}: the companies in its group`,
    description: seg
      ? `${G.name}: revenue${G.measures.capex ? ' and capital spending' : ''} by reported business for ${G.period_long}, and the ${n} companies in its group placed by business, with stakes and sources.`
      : `${G.name}: the ${n} companies in its group, branch by branch, with stakes and sources.`,
    url: I18N.ORIGIN + p, dateModified: D.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: seg ? `${G.short}: revenue by business and every company in its group — 1001startup.id` : `${G.short}: every company in its group — 1001startup.id`,
    desc: seg
      ? `${G.name} as a Sankey: ${money(G, G.measures.rev.total)} of revenue in ${G.period} split by business, then the companies in each${G.duties.length ? ', with the national programmes, public duties and Danantara directives they carry' : ''}. Every figure sourced.`
      : `${G.name}: its ${n} companies, branch by branch, with stakes and sources${G.duties.length ? ', and the duties the state gives them' : ''}.`,
    path: p, lang, body, active: 'census',
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

/* one map for the 1001startup.id front page (views/home1001.js, Luca 18 Oct 2026: the BUMN card "need
   to be updated with the sankey diagram and the 1000+ subsidiary"): the card's small map, plus for each
   business the companies the group places in it (name, logo, status), so the bands run on into the
   companies the way the full map does. Same rows as mini(): money maps only, first lens, five rows at
   most (past five, the four biggest stay and the rest are lumped with all their companies). */
function homeMini(slug) {
  if (!live()) return null;
  const D = load();
  const G = D && D.groups[slug];
  if (!G || G.basis !== 'segments' || !G.segments || !G.measures) return null;
  const lens = Object.keys(G.measures)[0];
  const { M, segs } = lensOf(G, lens);
  const t = base(M);
  const co = (c) => ({ n: c.name, logo: c.logo || null, live: c.status === 'active' });
  let rows = segs.filter((b) => b.v > 0).map((b) => ({ n: b.extra ? 'Not in a segment' : b.s.plain || b.s.name, v: b.v, k: b.s.core ? 'c' : 'o', pc: pc(b.v, t), cos: (b.s.cos || []).map(co) }));
  if (!rows.length) return null;
  if (rows.length > 5) {
    const big = new Set(rows.slice().sort((a, b) => b.v - a.v).slice(0, 4));
    const rest = rows.filter((r) => !big.has(r));
    const v = rest.reduce((a, r) => a + r.v, 0);
    const word = G.seg_word ? G.seg_word.replace(/y$/, 'ie') + 's' : 'businesses';
    rows = rows.filter((r) => big.has(r)).concat([{ n: `${rest.length} more ${word}`, v, k: 'm', pc: pc(v, t), cos: [].concat(...rest.map((r) => r.cos)) }]);
  }
  return { slug, short: G.short, logo: G.logo || null, h: `${M.short || M.label}, ${G.period}`, tot: money(G, M.total),
    all: (G.counts && G.counts.all) || 0, nseg: G.segments.length, r: rows };
}

module.exports = { page, slugs, minis, load, live, homeMini };
