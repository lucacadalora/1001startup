'use strict';
/* /bumd — Indonesia's regional state companies (BUMD), the /bumn way: a logo chart of every company
 * with published accounts, a card per company (side panel on wide screens, bottom sheet on phones),
 * the full sortable table, then the ties to the BUMN groups, the joint operations (KSO) and joint
 * ventures, and the ties to data centres.
 *
 * Luca, 18 Oct 2026: "enrich the data with BUMD and its KSO"; 24 Oct 2026: "for the BUMD make the
 * different dataset or pages for /BUMD just like BUMN". The data comes from the BUMD + KSO research
 * pass in ~/projects/bumn-group-webs/bumd (regional governments' audited accounts, regional
 * regulations, annual reports, the joint-operation notes in the BUMN contractors' statements, SKK
 * Migas, Kemendagri, and Jakarta's BP BUMD portal), exported into data/bumd.json; the data contract
 * is bumd/SITE-SPEC.md. Shared helpers: views/bumd-common.js (the company pages /bumd/<id> use the
 * same index, so a card's "Company page" link and the page agree on who has one).
 * The chart is drawn on published money because that is what the data has: assets and revenue on
 * log scales, net profit on a signed log scale (losses below zero), net margin linear. No scores.
 * Shown only while data/bumd.live exists (BUMD_PREVIEW=1 on a test port), a 404 before that. The
 * same switch adds the menu item (views/nav1001.js) and the link block in each /bumn card.
 * Client: public/js/bumd1001.js (CSP script-src 'self', so no inline script runs; the data rides in
 * the #bd-data JSON block, URLs and repeated strings stored once and referenced by index).
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const { bumdLive } = require('../lib/bumdlive');
const B = require('./bumd-common');

const { load } = B;

/* per BUMN group: [ties, joint operations, regional companies] for the /bumn card's link block */
function groupCounts() {
  if (!bumdLive()) return null;
  const D = load();
  if (!D || !D.groups) return null;
  const out = {};
  for (const [g, v] of Object.entries(D.groups)) out[g] = [v.n, v.ops, v.co];
  return out;
}

const JS = path.join(__dirname, '..', 'public', 'js', 'bumd1001.js');
const ver = () => { try { return String(Math.floor(fs.statSync(JS).mtimeMs / 1000)); } catch (e) { return '0'; } };

const num = (n) => Number(n).toLocaleString('en-US');
const { money, srcA } = B;

/* an id the client can rebuild from the name is not sent (public/js/bumd1001.js uses the same rule) */
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
/* the chart's short name and a logo's initials, the same rules as the client's, for the table's first page */
const FORM_HEAD = /^(?:PERUMDAM|PERUMDA|PDAM|PD|PT\.?|Perumda|Perseroda)\s+/i;
const REGION_TAIL = /\s+(?:Kabupaten|Kab\.|Kota|Provinsi)\s+.+$/i;
function shortName(n, kind) {
  const full = String(n || '').trim();
  let s = full.replace(/\s*\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (s) {
    const bare = s.replace(FORM_HEAD, '');
    if (/^(?:Kabupaten|Kab\.|Kota|Provinsi)\s/i.test(bare)) s = (kind === 'pdam' ? 'PDAM ' : '') + bare;
    else s = bare.replace(REGION_TAIL, '') || bare;
    if (s.length > 24) { const cut = s.slice(0, 23), sp = cut.lastIndexOf(' '); s = cut.slice(0, sp > 10 ? sp : 23).replace(/[\s,.\-]+$/, '') + '…'; }
  }
  return s || full;
}
function initials(n, kind) {
  const s = shortName(n, kind).replace(/…$/, ''), caps = s.match(/\b[A-Z]{2,5}\b/);
  if (caps) return caps[0].slice(0, 4);
  const w = s.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (w.length > 1 && /^tirta$/i.test(w[0])) w.shift();
  if (w.length > 2 && /^air$/i.test(w[0]) && /^minum$/i.test(w[1])) w.splice(0, 2);
  if (!w.length) return '·';
  return w.length === 1 ? w[0].slice(0, 2) : (w[0][0] + w[1][0]).toUpperCase();
}
/* the client's number rules: a zero is Rp0, a sliver of a stake is under 0.01% */
const moneyT = (v, u) => (v === 0 ? (u === 'US$ m' ? 'US$0' : 'Rp0') : money(v, u));
const pctT = (v) => (v == null ? '' : v > 0 && v < 0.01 ? '<0.01%' : (v >= 100 ? 100 : Math.floor(v * 100) / 100) + '%');

/* most common value and its share */
function mode(list) {
  const n = new Map();
  for (const v of list) n.set(v, (n.get(v) || 0) + 1);
  let best = null, k = 0;
  for (const [v, c] of n) if (c > k) { best = v; k = c; }
  return { v: best, share: list.length ? k / list.length : 0 };
}

/* ---------- the client's data: only what the chart, the cards, the table and the lists need ---------- */
let CJ = { D: null, L: null, X: null, json: '' };
function clientJson(D) {
  const L = B.loadLogos();
  const X = B.index(D);
  if (CJ.D === D && CJ.L === L && CJ.X === X) return CJ.json;
  const U = [], uI = new Map();
  const uref = (s) => { if (!s) return null; let i = uI.get(s); if (i === undefined) { i = U.length; U.push(s); uI.set(s, i); } return i; };
  const tab = (arr, map) => (s) => { let i = map.get(s); if (i === undefined) { i = arr.length; arr.push(s); map.set(s, i); } return i; };
  const P = [], K = [];
  const pref = tab(P, new Map()), kref = tab(K, new Map());
  /* trailing empties dropped: [y, a, null, null] -> [y, a] */
  const trim = (a) => { let n = a.length; while (n && (a[n - 1] === null || a[n - 1] === undefined)) n--; return a.slice(0, n).map((v) => (v === undefined ? null : v)); };
  const nn = (v) => (v === undefined || v === null || Number.isNaN(v) ? null : v);
  const CO = D.co, OPS = D.ops || [], ENTS = D.ents || {};
  const nc = CO.length;
  /* one reference space: 0..nc-1 the companies, then the joint operations, then every other name */
  const rI = new Map();
  CO.forEach((c, i) => { if (!rI.has(c.id)) rI.set(c.id, i); });
  OPS.forEach((o, j) => { if (!rI.has(o.id)) rI.set(o.id, nc + j); });
  const en = [];
  const ref = (id) => {
    if (id === undefined || id === null || id === '') return null;
    if (rI.has(id)) return rI.get(id);
    const e = ENTS[id];
    if (!e) return null;
    const i = nc + OPS.length + en.length;
    rI.set(id, i);
    en.push(trim([e.n || id, e.g || null, e.h && e.g && e.h === '/bumn#' + e.g ? 1 : (e.h || null), e.dc ? 1 : null]));
    return i;
  };
  const opIx = new Map(OPS.map((o, j) => [o, j]));
  const tieIx = new Map((D.ties || []).map((t, i) => [t, i]));
  const co = CO.map((c) => {
    const kind = B.typeOf(c);
    const r = { n: c.n || c.id, t: kind };
    if (slug(r.n) !== c.id) r.i = c.id;
    if (c.l && c.l !== c.n) r.l = c.l;
    if (c.f) r.f = c.f;
    if (c.p) r.p = pref(c.p);
    if (c.c) r.c = c.c;
    if (c.s) r.s = kref(c.s);
    if (c.st) r.st = c.st;
    if (c.sub) r.su = 1;
    if (c.tk) r.tk = c.tk;
    const lg = L && L[c.id] && L[c.id].src;
    if (lg) r.g = lg;
    if (X.pages.has(c.id)) r.pg = 1;
    /* a company can also count on a BUMN group's side or as a data-centre party (data/bumd.json ents) */
    const ce = ENTS[c.id];
    if (ce && ce.g) r.gr = ce.g;
    if (ce && ce.dc) r.dc = 1;
    if (c.d) r.d = c.d;
    if (c.w) r.w = c.w;
    if (Array.isArray(c.src) && c.src.length) r.sr = c.src.map(uref).filter((v) => v !== null);
    if (Array.isArray(c.o) && c.o.length) r.o = c.o.map((o) => trim([o.g || '', nn(o.s), uref(o.u), o.id ? ref(o.id) : null, o.h || null, o.dt || null]));
    if (c.fin) r.x = trim([nn(c.fin.y), nn(c.fin.a), nn(c.fin.r), nn(c.fin.p), uref(c.fin.s), c.fin.u && c.fin.u !== 'Rp bn' ? c.fin.u : null]);
    if (c.fs && Array.isArray(c.fs.y) && c.fs.y.length) {
      const col = (k) => c.fs.y.map((_, i) => nn((c.fs[k] || [])[i]));
      r.fs = trim([c.fs.y, col('r'), col('p'), uref(c.fs.s), c.fs.by || null, c.fs.u && c.fs.u !== 'Rp bn' ? c.fs.u : null]);
    }
    if (Array.isArray(c.fn) && c.fn.length) r.fn = c.fn.filter((f) => f && f.t).map((f) => trim([nn(f.y), f.t, uref(f.u)]));
    if (Array.isArray(c.bd) && c.bd.length) { r.bd = c.bd.map((b) => [b.n || '', b.r || '', b.k || '']); if (c.bds) r.bs = uref(c.bds); }
    const kids = X.subsOf.get(c.id);
    if (kids) r.ch = kids.map((id) => rI.get(id)).filter((v) => v !== undefined);
    const par = X.parentOf.get(c.id);
    if (par !== undefined && rI.has(par)) r.pa = rI.get(par);
    const hd = X.holds.get(c.id);
    if (hd) r.hd = hd.filter((h) => rI.has(h.id)).map((h) => trim([rI.get(h.id), nn(h.s), uref(h.u), h.dt || null]));
    const op = X.opsOf.get(c.id);
    if (op) r.op = op.filter((m) => opIx.has(m.o)).map((m) => trim([opIx.get(m.o), nn(m.pct), uref(m.u)]));
    const ti = X.tiesOf.get(c.id);
    if (ti) r.ti = ti.map((t) => tieIx.get(t)).filter((v) => v !== undefined);
    return r;
  });
  const ops = OPS.map((o) => {
    const r = { n: o.n || o.id, k: o.k === 'jv' ? 'jv' : 'kso' };
    if (slug(r.n) !== o.id) r.i = o.id;
    if (o.l && o.l !== o.n) r.l = o.l;
    if (o.d) r.d = o.d;
    if (Array.isArray(o.src) && o.src.length) r.sr = o.src.map(uref).filter((v) => v !== null);
    /* a member is named by id; a few carry the id in n, and a plain name stays a name */
    r.m = (o.m || []).map((m) => {
      const id = m.id || (m.n && (rI.has(m.n) || ENTS[m.n]) ? m.n : null);
      const rf = id ? ref(id) : null;
      return trim([rf !== null ? rf : (m.n || m.id || ''), nn(m.pct), uref(m.u)]);
    });
    if (o.per) r.pe = o.per;
    if (o.st) r.st = o.st;
    if (o.cl) { const rf = ref(o.cl); r.cl = rf !== null ? rf : o.cl; }
    if (o.v && o.v.amount != null) r.v = [o.v.amount, o.v.unit || 'Rp bn'];
    const oe = ENTS[o.id];
    if (oe && oe.g) r.gr = oe.g;
    if (oe && oe.dc) r.dc = 1;
    return r;
  });
  const ti = (D.ties || []).map((t) => {
    const a = ref(t.a), b = ref(t.b);
    return trim([a !== null ? a : String(t.a || ''), b !== null ? b : String(t.b || ''), t.r || '', t.d || '', t.e === 's' ? 's' : 'c', t.dt || null, uref(t.u)]);
  });
  const json = JSON.stringify({
    U, P, K, co, ops, en, ti,
    w: { T: B.TYPES, F: B.FORM, S: B.STATUS, R: B.REL },
  }).replace(/</g, '\\u003c');
  CJ = { D, L, X, json };
  return json;
}

/* the table's first page as the script draws it (largest assets first, minority stakes apart), so the
   names link to their pages before any script runs; the script redraws the same rows and takes over */
const PAGE = 50;
function tableHead() {
  const cols = [['Company', 0], ['Province', 0], ['Kind', 0], ['Largest owner', 0], ['Assets', 1], ['Revenue', 1], ['Net profit', 1], ['FY', 1]];
  return `<tr>${cols.map(([l, n]) => `<th scope="col"${n ? ' class="n"' : ''}${l === 'Assets' ? ' aria-sort="descending"' : ''}><button type="button">${esc(l)}</button></th>`).join('')}</tr>`;
}
function tableRows(D, X, L) {
  const fa = (c) => (c.fin && c.fin.a != null ? c.fin.a : null);
  const list = D.co.filter((c) => !c.jv).sort((a, b) => {
    const va = fa(a), vb = fa(b);
    if (va == null && vb == null) return String(a.n || '').localeCompare(String(b.n || ''));
    if (va == null) return 1;
    if (vb == null) return -1;
    return (va > vb ? -1 : va < vb ? 1 : 0) || String(a.n || '').localeCompare(String(b.n || ''));
  });
  const cell = (c, v) => {
    if (v == null) return '<td class="dash" title="Not published">—</td>';
    const u = c.fin.s, unit = c.fin.u || 'Rp bn';
    return `<td class="n">${u ? `<a href="${esc(u)}" target="_blank" rel="noopener" title="${esc('FY' + (c.fin.y || '') + ' · ' + B.host(u))}">${esc(moneyT(v, unit))}</a>` : esc(moneyT(v, unit))}</td>`;
  };
  const rows = list.slice(0, PAGE).map((c) => {
    const kind = B.typeOf(c);
    const logo = L && L[c.id] && L[c.id].src;
    const name = c.n || c.id;
    const nm = X.pages.has(c.id) ? `<a class="cp-link" href="/bumd/${esc(encodeURIComponent(c.id))}">${esc(name)}</a>` : `<button type="button">${esc(name)}</button>`;
    const tag = [c.sub ? 'Subsidiary' : '', c.st ? (B.STATUS[c.st] || c.st) : ''].filter(Boolean).join(' · ');
    const own = (c.o || []).slice().sort((a, b) => (b.s == null ? -1 : b.s) - (a.s == null ? -1 : a.s));
    const lo = own[0];
    let ow = '';
    if (lo) {
      ow = esc(lo.g || '');
      if (lo.s != null) ow += `<span class="pc">${lo.u ? `<a href="${esc(lo.u)}" target="_blank" rel="noopener" title="${esc('Source: ' + B.host(lo.u))}">${esc(pctT(lo.s))}</a>` : esc(pctT(lo.s))}</span>`;
      if (own.length > 1) ow += `<span class="pc">+${own.length - 1}</span>`;
    }
    const f = c.fin || {};
    return `<tr data-id="${esc(c.id)}"><td class="co"><span class="w"><span class="lg">${logo ? `<img src="${esc(logo)}" alt="" decoding="async" loading="lazy">` : `<span class="mg" aria-hidden="true">${esc(initials(name, kind))}</span>`}</span><span>${nm}${tag ? `<span class="sb">${esc(tag)}</span>` : ''}</span></span></td>`
      + `<td class="mu">${esc(c.p || '')}</td><td class="mu kd">${esc(B.TYPES[kind] || kind)}</td><td class="mu ow">${ow}</td>`
      + cell(c, f.a) + cell(c, f.r) + cell(c, f.p)
      + (f.y != null ? `<td class="n">${esc(String(f.y))}</td>` : '<td class="dash" title="Not published">—</td>') + '</tr>';
  }).join('');
  return { rows, n: list.length, shown: Math.min(PAGE, list.length) };
}

function page({ lang = 'en' }) {
  if (!bumdLive()) return null;
  const D = load();
  if (!D || !Array.isArray(D.co)) return null;
  const X = B.index(D);
  if (!X) return null;
  const p = '/bumd';
  const E = D.ents || {};
  const CO = D.co;
  const nBumd = CO.filter((c) => !c.sub && !c.jv).length;
  const nSub = CO.filter((c) => c.sub && !c.jv).length;
  const nJv = CO.filter((c) => c.jv).length;
  const nOps = (D.ops || []).length;
  const dayOf = (iso) => { const t = new Date(String(iso || '') + 'T00:00:00Z'); return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); };
  const asof = dayOf(D.asof);
  const nameById = new Map(CO.map((c) => [c.n, c.id]));

  /* ---------- the national numbers, and how many are here ---------- */
  const tiles = (D.stats || []).slice();
  const extra = [nSub ? `${num(nSub)} of their subsidiaries` : '', nJv ? `${num(nJv)} minority stakes` : ''].filter(Boolean).join(' and ');
  tiles.splice(Math.min(1, tiles.length), 0, { v: num(nBumd), k: `BUMD mapped on this page${extra ? `, plus ${extra}` : ''}`, u: null });
  const stats = tiles.map((s) => `<div class="cell"><div class="v">${s.u ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.v)}</a>` : esc(s.v)}</div><div class="k">${esc(s.k)}</div></div>`).join('');

  /* ---------- the chart's footnote: which year the figures are, from the data ---------- */
  const fin = CO.filter((c) => c.fin && c.fin.y);
  const pdamY = mode(fin.filter((c) => B.typeOf(c) === 'pdam').map((c) => c.fin.y));
  const jakY = mode(fin.filter((c) => c.p === 'DKI Jakarta' && !c.jv).map((c) => c.fin.y));
  const yrs = [pdamY.share > 0.5 ? `most water utilities FY${pdamY.v}` : '', jakY.share > 0.5 ? `Jakarta’s FY${jakY.v}` : ''].filter(Boolean);
  const fyNote = `Figures are each company’s latest published year${yrs.length ? ` (${yrs.join(', ')})` : ''}; the year is in each card. A dash means not published, never zero.`;

  /* ---------- what the regions own ---------- */
  const types = D.types && Array.isArray(D.types.rows) ? `<div class="bd-types">${D.types.rows.map((r) => `<div><b>${esc(String(r[1]))}</b><span>${esc(r[0])}</span></div>`).join('')}</div>
  <p class="bd-src">Kemendagri, ${esc(D.types.as_of || '')}: ${srcA(D.types.u)}</p>` : '';
  const topRows = D.top && Array.isArray(D.top.rows) ? D.top.rows : [];
  const topMax = topRows.length ? Math.max(...topRows.map((r) => Math.abs(r[1]) || 0), 1) : 1;
  const top = topRows.length ? `<div class="bd-bars">${topRows.map((r) => {
    const id = nameById.get(r[0]);
    const lab = id ? `<a class="l" href="#c-${esc(id)}">${esc(r[0])}</a>` : `<span class="l">${esc(r[0])}</span>`;
    return `<div class="br">${lab}<span class="t"><i style="width:${(Math.abs(r[1]) / topMax * 100).toFixed(1)}%"></i></span><span class="v">${esc(money(r[1], 'Rp bn'))}</span></div>`;
  }).join('')}</div>
  <p class="bd-src">Net profit, FY${esc(String(D.top.y || ''))}, Kemendagri’s list: ${srcA(D.top.u)}</p>` : '';
  const nBanksTop = topRows.filter((r) => /^(Bank|BPD)\b/.test(r[0])).length;

  /* ---------- the state groups' side: bars, then one folded block per group (filled by the script) ---------- */
  const G = Object.entries(D.groups || {}).sort((a, b) => (b[1].n || 0) - (a[1].n || 0));
  const gMax = G.length ? Math.max(G[0][1].n || 0, 1) : 1;
  const gBars = G.slice(0, 12).map(([g, v]) => `<a class="br" href="#g-${esc(g)}"><span class="l">${esc(v.short || g)}</span><span class="t"><i style="width:${((v.n || 0) / gMax * 100).toFixed(1)}%"></i></span><span class="v">${num(v.n || 0)}</span></a>`).join('');
  const gMore = G.slice(12).map(([g, v]) => `<a class="chip" href="#g-${esc(g)}">${esc(v.short || g)}<b>${num(v.n || 0)}</b></a>`).join('');
  const groupBlocks = G.map(([g, v]) => {
    const parts = [];
    if (v.ops) parts.push(`${num(v.ops)} joint operation${v.ops === 1 ? '' : 's'}`);
    if (v.co) parts.push(`${num(v.co)} regional compan${v.co === 1 ? 'y' : 'ies'}`);
    return `<details class="bd-g" id="g-${esc(g)}"><summary><b>${esc(v.short || g)}</b><span>${num(v.n || 0)} ties${parts.length ? ' · ' + parts.join(' · ') : ''}</span></summary>
<div class="bd-gl" data-g="${esc(g)}"></div>${v.card ? `<p class="bd-src"><a href="/bumn#${esc(g)}">${esc(v.short || g)} on /bumn →</a></p>` : ''}</details>`;
  }).join('');

  /* ---------- ties to data centres: counted here, listed by the script ---------- */
  const nDc = (D.ties || []).filter((t) => (E[t.a] && E[t.a].dc) || (E[t.b] && E[t.b].dc)).length;

  /* ---------- the table's first page, and every company page for a reader without scripts ---------- */
  const TB = tableRows(D, X, B.loadLogos());
  const nPages = CO.filter((c) => X.pages.has(c.id)).length;
  const pagesList = CO.filter((c) => X.pages.has(c.id)).sort((a, b) => String(a.n || '').localeCompare(String(b.n || '')))
    .map((c) => `<a href="/bumd/${esc(encodeURIComponent(c.id))}">${esc(c.n || c.id)}</a>`).join(', ');

  /* ---------- method ---------- */
  const dki = D.dki && D.dki.u ? D.dki : null;
  const dkiHost = dki ? B.host(dki.u) : '';

  const body = `
<style>
.bm{max-width:1180px;margin:0 auto;padding:0 20px}
.bm-ctl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}
.bm-ctl .chip{cursor:pointer}
.bm-ctl .chip b{font-weight:400;color:#6B6B73;margin-left:5px}
.bm-ctl .chip[aria-pressed="true"]{background:#000;border-color:#000;color:#fff}
.bm-ctl .chip[aria-pressed="true"] b{color:#C9C9CF}
.bm-ctl .chip:disabled{cursor:default;color:#A1A1AA;border-color:#EFEFEF}
.bm-ctl .chip:disabled:hover{border-color:#EFEFEF}
.bm-ctl .chip:focus-visible,.bm-ax select:focus-visible{outline:2px solid #000;outline-offset:1px}
.bm-ax{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.bm-ax label{margin-left:4px}
.bm-ax label:first-child{margin-left:0}
.bm-ax select{font:400 12px/1 'IBM Plex Mono',monospace;border:1px solid #E7E7E7;background:#fff;color:#000;padding:7px 8px;border-radius:0;max-width:100%}
.bm-stage{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start;margin-top:6px}
@media(max-width:999px){.bm-stage{grid-template-columns:minmax(0,1fr)}}
.bm-field{position:relative;background:#F7F8F4;border:1px solid #E7E7E7;height:620px;overflow:hidden;touch-action:manipulation;cursor:default}
.bm-field svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.bm-side{position:sticky;top:12px;border:1px solid #E7E7E7;background:#fff;padding:14px;font:500 13.5px/1.45 'Overused Grotesk',system-ui,sans-serif;letter-spacing:0}
@media(min-width:1000px){.bm-side{max-height:calc(100vh - 24px);overflow:auto}}
@media(max-width:999px){.bm-side{position:static}}
.bm-side .k{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-side .qd{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-bottom:1px solid #F1F1F1}
.bm-side .qd:last-of-type{border-bottom:0}
.bm-side .qd b{font:400 11px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase}
.bm-side .qd span{font:400 12px/1.3 'IBM Plex Mono',monospace;color:#6B6B73;text-align:right}
.bm-side .qd p{grid-column:1/-1;color:#52525B;font-size:13px;line-height:1.45}
.bm-b{position:absolute;width:var(--d);height:var(--d);margin:calc(var(--d) / -2) 0 0 calc(var(--d) / -2);border-radius:50%;border:0;padding:0;background:#fff;box-shadow:0 3px 9px rgba(24,32,36,.22),0 0 0 1.5px rgba(0,0,0,.08);cursor:pointer;transition:transform .15s}
.bm-b img{width:100%;height:100%;border-radius:50%;display:block;border:3px solid #fff;object-fit:contain;background:#fff}
.bm-b .mg{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;font:650 11px/1 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-.01em;color:#3F3F46}
.bm-field.nw .bm-b .mg{font-size:9.5px}
.bm-b:hover,.bm-b.on{transform:scale(1.12);z-index:5}
.bm-b.on{box-shadow:0 3px 9px rgba(24,32,36,.22),0 0 0 2px #000}
.bm-b:focus-visible{outline:2px solid #000;outline-offset:2px}
.bm-l{position:absolute;font:600 13px/1.15 'Overused Grotesk',system-ui,sans-serif;color:#0B0B0C;white-space:nowrap;pointer-events:none}
.bm-field.nw .bm-l{font-size:11px}
.bm-q{position:absolute;font:400 10.5px/1.25 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#9A9AA0;max-width:44%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.bm-q.tr,.bm-q.br{text-align:right}
.bm-field.nw .bm-q{white-space:normal;overflow:visible;line-height:1.2}
.bm-foot{display:flex;flex-wrap:wrap;gap:4px 10px;font:400 10.5px/1.6 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;padding:8px 12px;border:1px solid #E7E7E7;border-top:0;background:#fff}
.bm-foot b{color:#000;font-weight:400}
.bm-note{font-size:12.5px;line-height:1.5;color:#6B6B73;margin-top:8px;max-width:92ch}
.bm-card{background:#fff;font:500 13.5px/1.45 'Overused Grotesk',system-ui,sans-serif;letter-spacing:0}
.bm-card.sheet{position:fixed;z-index:75;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-height:72vh;overflow:auto;border:1px solid #E7E7E7;box-shadow:0 10px 30px rgba(20,24,22,.18);padding:14px 14px 12px}
.bm-card .hd{display:flex;gap:10px;align-items:flex-start;margin-bottom:8px}
.bm-card .hd .lg{flex:0 0 auto;width:40px;height:40px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(0,0,0,.08);background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;font:650 12px/1 'Overused Grotesk',system-ui,sans-serif;color:#3F3F46}
.bm-card .hd .lg img{width:100%;height:100%;object-fit:contain;border:3px solid #fff;border-radius:50%}
.bm-card .hd>div:nth-child(2){min-width:0}
.bm-card .nm{font-weight:650;font-size:16px;line-height:1.15;overflow-wrap:anywhere}
.bm-card .lgn{color:#6B6B73;font-size:12.5px;line-height:1.3;margin-top:2px;overflow-wrap:anywhere}
.bm-card .cl{font:400 10.5px/1.35 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73;margin-top:3px}
.bm-card .stt{display:inline-block;font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#7A5200;border:1px solid #F1E3BF;background:#FFF8E6;padding:3px 5px;margin-top:5px}
.bm-card .x{margin-left:auto;flex:0 0 auto;border:1px solid #E7E7E7;background:#fff;width:30px;height:30px;font:400 14px/1 'IBM Plex Mono',monospace;cursor:pointer;color:#000}
.bm-card .x:focus-visible{outline:2px solid #000}
.bm-card .ds{color:#3F3F46;font-size:13px;line-height:1.45;margin:0 0 8px}
.bm-card .sx{color:#6B6B73;font-size:12.5px;line-height:1.35;margin:0 0 8px}
.bm-card .figs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px;margin:8px 0 6px;padding-top:10px;border-top:1px solid #F1F1F1}
.bm-card .fig .k{font:400 10px/1.2 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-card .fig .v{font-weight:600;font-size:14.5px;line-height:1.3}
.bm-card .fig .v a{text-decoration:none;border-bottom:1px solid #D9D9D9;color:#000}
.bm-card .fig .p{font:400 10.5px/1.2 'IBM Plex Mono',monospace;color:#9A9AA0}
.bm-card .fn{color:#52525B;font-size:12px;line-height:1.45;margin:2px 0 6px}
.bm-card .fn b{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.04em;color:#6B6B73;margin-right:4px}
.bm-card .fn a,.bm-card .src a,.bm-card .nt a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.bm-card .yr{margin:4px 0 8px;padding:8px 0 2px;border-top:1px solid #F1F1F1}
.bm-card .yr .h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
.bm-card .yr .h b{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-card .yr .h span{font:400 10.5px/1.3 'IBM Plex Mono',monospace;color:#9A9AA0;white-space:nowrap}
.bm-card .yr .h a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.bm-yg{display:grid;grid-template-columns:66px repeat(var(--n),minmax(0,1fr));gap:2px 4px;align-items:end}
.bm-yg .rk{font:400 10px/1.2 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;align-self:center}
.bm-yg .yh{font:400 10px/1.2 'IBM Plex Mono',monospace;color:#6B6B73;text-align:center}
.bm-yg .c{display:flex;flex-direction:column;align-items:stretch;gap:2px}
.bm-yg .bx{position:relative;height:26px;background:#F4F4F1}
.bm-yg .bx i{position:absolute;left:18%;right:18%;background:#3F3F46}
.bm-yg .bx i.ng{background:#A8A29E}
.bm-yg .bx .z{position:absolute;left:0;right:0;height:1px;background:#C9C9C1}
.bm-yg .vl{font:400 9.5px/1.2 'IBM Plex Mono',monospace;text-align:center;color:#3F3F46;white-space:nowrap}
.bm-yg .vl.na{color:#A1A1AA}
.bm-card .sec{border-top:1px solid #F1F1F1;padding-top:9px;margin-top:8px}
.bm-card .sec>.h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px}
.bm-card .sec>.h b{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-card .sec>.h span{font:400 10.5px/1.3 'IBM Plex Mono',monospace;color:#9A9AA0;white-space:nowrap}
.bm-card .sub-h{font:400 10px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#9A9AA0;margin-top:7px}
.bm-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 8px;padding:5px 0;border-bottom:1px solid #F4F4F4;align-items:baseline}
.bm-row:last-child{border-bottom:0}
.bm-row .n{font-weight:600;font-size:13px;line-height:1.3;min-width:0;overflow-wrap:anywhere}
.bm-row .n a{color:#0B0B0C;text-decoration:none;border-bottom:1px solid #C9C9CF}
.bm-row .p{font:400 12px/1.3 'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}
.bm-row .p a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.bm-row .s{grid-column:1/-1;color:#6B6B73;font-size:12px;line-height:1.35}
.bm-tie{padding:6px 0;border-bottom:1px solid #F4F4F4;display:grid;gap:2px}
.bm-tie:last-child{border-bottom:0}
.bm-tie .r{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-tie .c{font-weight:600;font-size:13px;line-height:1.3;overflow-wrap:anywhere}
.bm-tie .c a{color:#0B0B0C;text-decoration:none;border-bottom:1px solid #C9C9CF}
.bm-tie .d{color:#3F3F46;font-size:12.5px;line-height:1.4;overflow-wrap:anywhere}
.bm-tie .m{font:400 10.5px/1.3 'IBM Plex Mono',monospace;color:#9A9AA0;letter-spacing:.03em;overflow-wrap:anywhere}
.bm-tie .m a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.bm-card .more{all:unset;cursor:pointer;font:400 11px/1.3 'IBM Plex Mono',monospace;color:#2A6E9F;margin-top:7px;display:inline-block}
.bm-card .more:focus-visible{outline:2px solid #000}
.bm-card .src{font:400 10.5px/1.5 'IBM Plex Mono',monospace;color:#9A9AA0;margin-top:10px;overflow-wrap:anywhere}
.bm-card .nt{color:#6B6B73;font-size:12px;line-height:1.4;margin-top:6px}
.bm-card .gm{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:2px 0 10px;padding:10px 10px;background:#000;color:#fff;text-decoration:none;font:400 10.5px/1.35 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase}
.bm-card .gm:hover{background:#2A2A2E}
.bm-card .gm:focus-visible{outline:2px solid #000;outline-offset:2px}
.bm-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}
.bm-tools input{font:500 14px/1 'Overused Grotesk',system-ui,sans-serif;padding:9px 10px;border:1px solid #E7E7E7;width:300px;max-width:100%;border-radius:0}
.bm-tools input:focus-visible{outline:2px solid #000;outline-offset:1px}
#bm-count{font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73}
#bm-tbl{min-width:880px}
#bm-tbl th button{all:unset;cursor:pointer}
#bm-tbl th button:focus-visible{outline:2px solid #000}
#bm-tbl th[aria-sort] button::after{content:" ↓"}
#bm-tbl th[aria-sort="ascending"] button::after{content:" ↑"}
#bm-tbl td{vertical-align:middle}
#bm-tbl tbody tr{cursor:pointer}
#bm-tbl tbody tr:hover td{background:#FAFAF8}
#bm-tbl tbody tr.on td{background:#F4F4EF}
#bm-tbl td.co{min-width:230px}
#bm-tbl td.co .w{display:flex;gap:9px;align-items:center}
#bm-tbl td.co .lg{flex:0 0 auto;width:26px;height:26px;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.08);background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;font:650 9px/1 'Overused Grotesk',system-ui,sans-serif;color:#52525B}
#bm-tbl td.co .lg img{width:100%;height:100%;object-fit:contain;border:2px solid #fff;border-radius:50%}
#bm-tbl td.co button{all:unset;cursor:pointer;font-weight:600;line-height:1.3}
#bm-tbl td.co button:hover{text-decoration:underline}
#bm-tbl td.co button:focus-visible,#bm-tbl td.co a.cp-link:focus-visible{outline:2px solid #000}
#bm-tbl td.co a.cp-link{font-weight:600;line-height:1.3;color:#000}
#bm-tbl td.co a.cp-link:hover{border-bottom-color:#000}
#bm-tbl td.co .sb{display:block;font:400 10px/1.3 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#9A9AA0;font-weight:400}
#bm-tbl td.ow{max-width:240px}
#bm-tbl td.kd{white-space:nowrap}
#bm-tbl td.ow .pc{font:400 11.5px/1 'IBM Plex Mono',monospace;color:#52525B;white-space:nowrap;margin-left:4px}
#bm-tbl td.ow .pc a{color:#2A6E9F;border-bottom-color:#D9E3EC}
#bm-tbl td.dash{color:#A1A1AA;text-align:right;font-family:'IBM Plex Mono',monospace}
.bm-pager{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73}
.bm-pager button{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;padding:8px 11px;border:1px solid #E7E7E7;background:#fff;color:#000;cursor:pointer;border-radius:0}
.bm-pager button:hover{border-color:#000}
.bm-pager button:disabled{color:#A1A1AA;cursor:default;border-color:#EFEFEF}
.bm-pager button[aria-pressed="true"]{background:#000;color:#fff;border-color:#000}
.bm-pager button:focus-visible{outline:2px solid #000;outline-offset:1px}
.bm-pager span{padding:0 4px}
@media(max-width:760px){
  .bm-q{font-size:9.5px}
  #bm-presets,#bm-kinds,#bm-tkinds{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-20px;padding-inline:20px}
  #bm-presets::-webkit-scrollbar,#bm-kinds::-webkit-scrollbar,#bm-tkinds::-webkit-scrollbar{display:none}
  #bm-presets .chip,#bm-kinds .chip,#bm-tkinds .chip{flex:0 0 auto}
}
@media(prefers-reduced-motion:reduce){.bm-b{transition:none}.bm-b:hover,.bm-b.on{transform:none}}
.stats.s5{grid-template-columns:repeat(5,1fr)}
@media(max-width:1100px){.stats.s5{grid-template-columns:repeat(2,1fr)}.stats.s5 .cell:last-child{grid-column:1/-1}}
.bd-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:28px;align-items:start}
@media(max-width:860px){.bd-two{grid-template-columns:minmax(0,1fr)}}
.bd-types{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.bd-types div{background:#fff;padding:14px 16px;display:grid;gap:4px}
.bd-types b{font-size:26px;font-weight:600;letter-spacing:-0.02em;line-height:1.1}
.bd-types span{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73}
.bd-src{font:400 11px/1.5 'IBM Plex Mono',monospace;color:#6B6B73;margin-top:8px;letter-spacing:.02em}
.bd-src a,.sl{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.bd-bars{display:grid;gap:2px}
.bd-bars .br{display:grid;grid-template-columns:150px minmax(0,1fr) 78px;gap:10px;align-items:center;padding:5px 6px;text-decoration:none;color:#000}
a.br:hover{background:#F6F6F6}
.bd-bars .l{font-size:13.5px;line-height:1.25;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#000;text-decoration:none}
.bd-bars a.l{border-bottom:0}
.bd-bars a.l:hover{text-decoration:underline}
.bd-bars .t{height:12px;background:#F1F1EE;position:relative;display:block}
.bd-bars .t i{position:absolute;left:0;top:0;bottom:0;background:#3F3F46;display:block}
.bd-bars .v{font:400 12.5px/1 'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}
@media(max-width:520px){.bd-bars .br{grid-template-columns:104px minmax(0,1fr) 64px;gap:8px}}
.bd-g{border:1px solid #E7E7E7;border-top:0}
.bd-g:first-of-type{border-top:1px solid #E7E7E7}
.bd-g summary{cursor:pointer;display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:12px 14px;list-style:none}
.bd-g summary::-webkit-details-marker{display:none}
.bd-g summary b{font-weight:600;font-size:15px}
.bd-g summary b::before{content:"+";display:inline-block;width:16px;font:400 13px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.bd-g[open] summary b::before{content:"−"}
.bd-g summary span{font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73;text-align:right}
.bd-g summary:hover{background:#FAFAFA}
.bd-g summary:focus-visible{outline:2px solid #000;outline-offset:-2px}
.bd-g>.bd-gl,.bd-g>.bd-src{padding:0 14px 12px 30px}
@media(max-width:520px){.bd-g>.bd-gl,.bd-g>.bd-src{padding-left:14px}}
.bd-t{list-style:none;display:grid;gap:0}
.bd-t li{padding:7px 0;border-top:1px solid #F4F4F4;font-size:13.5px;line-height:1.4;display:grid;gap:2px;min-width:0}
.bd-t li>b{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bd-t a,.bd-ops a{color:#000;text-decoration:none;border-bottom:1px solid #C9C9CF}
.bd-t .d{color:#3F3F46;font-size:12.5px;line-height:1.45;overflow-wrap:anywhere}
.bd-t .m{font:400 10.5px/1.4 'IBM Plex Mono',monospace;color:#9A9AA0;letter-spacing:.02em;overflow-wrap:anywhere}
.bd-t .m a,.bd-ops .sl{color:#2A6E9F;border-bottom-color:#D9E3EC}
.pc{font:400 11.5px/1 'IBM Plex Mono',monospace;color:#52525B;white-space:nowrap}
.bd-ops td.co{min-width:220px}
.bd-ops td.co b{font-weight:600}
.bd-ops div.mu{color:#52525B;font-size:12.5px;line-height:1.4}
.bd-ops tr.hit td{background:#FFFBEA}
.bd-dc .bd-t li{padding:9px 0}
.bd-m{border:1px solid #E7E7E7;padding:0 18px}
.bd-m summary{cursor:pointer;font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:16px 0}
.bd-m summary:focus-visible{outline:2px solid #000;outline-offset:2px}
.bd-m[open] summary{border-bottom:1px solid #F1F1F1;margin-bottom:12px}
.bd-m h3{font-size:16px;font-weight:600;margin:14px 0 4px}
.bd-m p{color:#52525B;font-size:14.5px;line-height:1.6;max-width:88ch;margin-bottom:10px}
.bd-m p a{color:#2A6E9F}
.bm-dir{margin-top:14px}
.bm-dir p{font-size:13.5px;line-height:1.75}
.bm-dir p a{color:#000;text-decoration:none;border-bottom:1px solid #C9C9CF}
.bm-dir p a:hover{border-bottom-color:#000}

</style>
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>REGIONAL STATE COMPANIES · BUMD · ${esc(asof.toUpperCase())}</div>
  <h1>Indonesia’s regional state companies, mapped</h1>
  <p class="sub">Provinces, regencies and cities own ${D.national ? num(D.national) : 'about a thousand'} companies; ${num(nBumd)} of them are mapped here, with their owners, their published accounts and the joint operations that tie them to the state groups on <a href="/bumn">/bumn</a>.</p>
</section>
<div class="stats${tiles.length === 5 ? ' s5' : ''}">${stats}</div>
<section class="bm" style="padding-top:40px">
  <div class="eyebrow"><span class="sq"></span>THE CHART</div>
  <p class="lede">Each mark is one company, placed by its latest published accounts. The largest by assets carry their logo and name; every dot opens its card too. Assets and revenue run on log scales, net profit on a signed one so losses sit below zero, and the lines cross at the median of the companies shown.</p>
  <div class="bm-ctl" id="bm-presets" role="group" aria-label="Axis pairs"></div>
  <div class="bm-ctl">
    <div class="bm-ax"><label for="bm-x">X</label><select id="bm-x"></select><label for="bm-y">Y</label><select id="bm-y"></select><label for="bm-pv">Province</label><select id="bm-pv"></select></div>
  </div>
  <div class="bm-ctl" id="bm-kinds" role="group" aria-label="Filter the chart by kind"></div>
  <div class="bm-stage" id="bm-stage">
    <div>
      <div class="bm-field" id="bm-field">
        <svg id="bm-grid" aria-hidden="true"></svg>
        <div class="bm-q tl" id="bm-q-tl"></div><div class="bm-q tr" id="bm-q-tr"></div>
        <div class="bm-q bl" id="bm-q-bl"></div><div class="bm-q br" id="bm-q-br"></div>
        <div id="bm-labs"></div>
        <div id="bm-badges"></div>
      </div>
      <div class="bm-foot" id="bm-foot"></div>
      <p class="bm-note">${esc(fyNote)}</p>
    </div>
    <aside class="bm-side" id="bm-side" aria-live="polite">
      <div id="bm-idle"></div>
      <div class="bm-card" id="bm-card" hidden role="dialog" aria-label="Company card"></div>
    </aside>
  </div>
</section>
<section class="wrap" id="all-companies">
  <div class="eyebrow"><span class="sq"></span>ALL COMPANIES</div>
  <p class="lede">Every company on this page, with or without published figures${nJv ? `; the ${num(nJv)} minority stakes have a chip of their own` : ''}. Money is in rupiah as each company reports it, for the year in the last column, and each figure links to its source; a dash means not published. Tap a row for the company’s card.</p>
  <div class="bm-tools"><input id="bm-q" type="search" placeholder="Find a company, region or owner" aria-label="Find a company, region or owner" autocomplete="off"><span id="bm-count" aria-live="polite">${TB.shown ? `1–${TB.shown} of ${num(TB.n)}` : ''}</span></div>
  <div class="bm-ctl" id="bm-tkinds" role="group" aria-label="Filter the table by kind"></div>
  <div class="tablewrap"><table id="bm-tbl"><thead>${tableHead()}</thead><tbody>${TB.rows}</tbody></table></div>
  <div class="bm-pager" id="bm-pager"></div>${pagesList ? `
  <details class="bd-m bm-dir"><summary>All ${num(nPages)} company pages</summary><p>${pagesList}.</p></details>` : ''}
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>WHAT THE REGIONS OWN</div>
  <div class="bd-two">
    <div>${types}</div>
    <div>${topRows.length ? `<p class="lede" style="margin-bottom:8px">The ${topRows.length} most profitable in ${esc(String(D.top.y || ''))}; ${nBanksTop} of them ${nBanksTop === 1 ? 'is a regional bank' : 'are regional banks'}.</p>` : ''}${top}</div>
  </div>
</section>
<section class="wrap" id="state-groups">
  <div class="eyebrow"><span class="sq"></span>TIES TO THE STATE GROUPS</div>
  <p class="lede">Joint operations, stakes, loans and contracts between each BUMN group and the regional side. The contractors lead because they build big projects as joint operations, and their statements list every one. Open a group for its list.</p>
  <div class="bd-two">
    <div class="bd-bars">${gBars}</div>
    <div>${gMore ? `<div class="chips" style="margin-top:0">${gMore}</div>` : ''}</div>
  </div>
  <div style="margin-top:18px">${groupBlocks}</div>
</section>
<section class="wrap" id="joint-operations">
  <div class="eyebrow"><span class="sq"></span>JOINT OPERATIONS AND JOINT VENTURES</div>
  <p class="lede">${num(nOps)} joint operations (KSO) and joint ventures, with their members and shares. A joint operation shares the work and the money of one contract; a joint venture is a company of its own.</p>
  <details class="bd-m" id="bd-all-ops"><summary>All ${num(nOps)} joint operations and joint ventures</summary>
  <div class="tablewrap bd-ops" style="margin-bottom:18px"><table><thead><tr><th>Name</th><th>Members</th><th>What it does</th><th>Source</th></tr></thead><tbody id="bd-ops-body"></tbody></table></div></details>
</section>
${nDc ? `<section class="wrap bd-dc" id="data-centres">
  <div class="eyebrow"><span class="sq"></span>TIES TO DATA CENTRES</div>
  <p class="lede">${num(nDc)} ties between the regional side and the companies and campuses on <a href="/data-center">/data-center</a>.</p>
  <ul class="bd-t" id="bd-dc-list"></ul>
</section>` : ''}
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>HOW THIS WAS MADE</div>
  <details class="bd-m"><summary>Sources, evidence and coverage</summary>
    <h3>Sources</h3>
    <p>Regional governments’ audited accounts, whose note on capital holdings lists every company a province, regency or city owns and its stake; regional regulations that found a company or inject capital; the companies’ own annual reports and statements; the notes on joint operations in the BUMN contractors’ statements; SKK Migas for the oil and gas stakes; Kemendagri for the national figures.${dki ? ` Jakarta’s figures for 2022–2025, boards and stakes come from the Jakarta government’s BP BUMD portal, <a href="${esc(dki.u)}" target="_blank" rel="noopener">${esc(dkiHost)}</a>${dki.asof ? `, as of ${esc(dayOf(dki.asof))}` : ''}.` : ''}</p>
    <h3>The chart</h3>
    <p>Each company sits where its latest published accounts put it: assets and revenue on log scales, net profit on a signed log scale so that losses fall below the zero line, and net margin (net profit divided by revenue, worked out here and only where revenue is above zero) on a straight scale, with the few beyond its ends pinned to the edge. The lines cross at the median of the companies shown. A company without a figure for one axis keeps its place on the other in the dashed lane marked —. The largest by assets in the current selection carry their logo, or their initials where no logo was found.</p>
    <h3>Evidence</h3>
    <p>A tie is shown only when a filing, a regulator or both parties confirm it, or when one party states it on its own site or in its own release (marked “Company’s word”). Ties we could only infer are left out. Each one links to the page it was read from.</p>
    <h3>Coverage</h3>
    <p>${D.national ? `Kemendagri counts ${num(D.national)} BUMD; ${num(nBumd)} are listed here so far` : `${num(nBumd)} BUMD are listed here so far`}${nSub ? `, with ${num(nSub)} of their subsidiaries` : ''}${nJv ? `. The ${num(nJv)} minority stakes, companies in which a region holds less than half, are shown apart and not counted as BUMD` : ''}. Coverage is uneven, and many regency and city companies are not listed yet. Figures are the latest year each company published, shown with the year.</p>
  </details>
</section>
<script type="application/json" id="bd-data">${clientJson(D)}</script>
<script src="/js/bumd1001.js?v=${ver()}" defer></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'BUMN', path: '/bumn' }, { name: 'BUMD', path: p }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'Indonesia’s regional state companies (BUMD) and their joint operations',
    description: `${nBumd} Indonesian regional-government companies (BUMD) with owners and stakes, latest published figures, and ${nOps} joint operations and joint ventures tying them to the BUMN groups, from public sources.`,
    url: I18N.ORIGIN + p, dateModified: D.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: 'Indonesia’s regional state companies (BUMD), mapped — 1001startup.id',
    desc: `${nBumd} BUMD owned by Indonesia's provinces, regencies and cities on one chart of their published accounts, with owners, figures and the ${nOps} joint operations and ventures that tie them to the BUMN groups. ${asof}.`,
    path: p, lang, body, translated: false,
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { page, load, groupCounts };
