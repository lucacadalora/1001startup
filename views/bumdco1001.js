'use strict';
/* /bumd/<id> — one regional state company (BUMD) on a page of its own, in the idiom of the BUMN group
 * maps on /bumn/<slug> (views/bumnsankey1001.js).
 *
 * Luca, 24 Oct 2026: "for the BUMD make the different dataset or pages for /BUMD just like BUMN".
 *
 * The map: on the left its owners, each a band as wide as its stake (a stake too small to see still
 * gets a thin band, labelled with its real figure; equal bands when no stake is published); in the
 * middle the company; on the right what it holds and does: subsidiaries, stakes in other companies,
 * joint operations and ventures, then its ties grouped by relation. Lines on the right carry no money.
 * Below the map: its figures (BP BUMD Jakarta's four years for the Jakarta rows, else the one year we
 * have), its board, every owner and tie with its source, the sources, and more pages in its province.
 *
 * Data: data/bumd.json through views/bumd-common.js (index(): which ids get a page and who ties to
 * whom). Owners are the row's own owner list plus the ownership ties that point at it (a subsidiary's
 * parent, a bank that bought in); a tie that repeats a listed owner is not drawn twice.
 * Server-rendered SVG laid out from the /bumn maps' measured text widths
 * (views/bumnsankey1001-widths.js), so no line, band or badge runs into a label; no script of its own
 * (CSP script-src 'self'). Shown only while data/bumd.live exists (BUMD_PREVIEW=1 on a test port):
 * page() returns null while the switch is off and for ids with nothing to draw (server.js 404s).
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const { bumdLive } = require('../lib/bumdlive');
const B = require('./bumd-common');
const WT = require('./bumnsankey1001-widths');

const PUB = path.join(__dirname, '..', 'public');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const f1 = (n) => Math.round(n * 10) / 10;
const isNum = (v) => typeof v === 'number' && isFinite(v);
/* a stake as published, floored and never rounded up to 100 (the /bumn rule); a stake under 1% keeps
   its own digits (0.0018%, never "0%"). The small epsilon keeps 4.1 from flooring to 4.09. */
function stakeTxt(v) {
  if (!isNum(v)) return '';
  if (v >= 100) return '100%';
  const m = v >= 1 ? 100 : 10000, t = Math.floor(v * m + 1e-7) / m;
  return (t > 0 ? String(t) : '<' + 1 / m) + '%';
}
const day = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? `${+m[3]} ${MON[+m[2] - 1]} ${m[1]}` : B.when(d); };
const clean = (s) => String(s == null ? '' : s).replace(/\\r\\n|\\n|\\r|\r?\n/g, ', ').replace(/\s+/g, ' ').replace(/\s*,(\s*,)+/g, ',').replace(/^[\s,]+|[\s,]+$/g, '');
/* a link: off-site ones open in a new tab */
const A = (u, inner, cls) => (u ? `<a href="${esc(u)}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}${cls ? ` class="${cls}"` : ''}>${inner}</a>` : inner);

/* ---------- text measured like the /bumn maps (same styles, same widths table) ---------- */
const WI = new Map([...WT.chars].map((c, i) => [c, i]));
/* the 17px/650 name renders up to 4.4% wider in the browser than the table has it (checked on these
   pages, 24 Oct 2026); every other style stays inside the table */
const PAD = { pn: 1.06 };
function tw(t, cls) {
  const k = String(cls).split(' ')[0], w = WT.w[k];
  let s = 0;
  for (const c of String(t == null ? '' : t)) { const i = WI.get(c); s += i != null ? w[i] : w[WI.get('M')]; }
  return s * (PAD[k] || 1);
}
function fitW(t, cls, max) {
  let s = String(t == null ? '' : t);
  if (tw(s, cls) <= max) return s;
  while (s.length > 1 && tw(s.trimEnd() + '…', cls) > max) s = s.slice(0, -1);
  return s.trimEnd() + '…';
}
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
function wrapEven(t, cls, max) {
  const n = wrapW(t, cls, max).length;
  if (n < 2) return wrapW(t, cls, max);
  let lo = 0, hi = max;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (wrapW(t, cls, mid).length <= n && !wrapW(t, cls, mid).some((l) => l.endsWith('…'))) hi = mid; else lo = mid; }
  return wrapW(t, cls, hi);
}
/* at most n lines (two by default); the last ends in an ellipsis when the name needs more */
function twoLines(t, cls, max, n = 2) {
  const nl = wrapEven(t, cls, max);
  return nl.length > n ? nl.slice(0, n - 1).concat([fitW(nl.slice(n - 1).join(' '), cls, max)]) : nl;
}
/* ascent and descent of each style, px above and below the baseline (the /bumn values) */
const LM = { k: [8, 2.5], ch: [7.5, 2.5], sh: [8.5, 2.5], pl: [10.5, 3.5], v: [11.5, 3], cnm: [10, 3.5], dnm: [9.5, 3], pn: [13, 4] };
const lm = (cls) => LM[String(cls).split(' ')[0]];
function block(lines) {
  let y = 0, w = 0;
  lines.forEach((l, i) => {
    y = i ? y + l.dy : lm(l.cls)[0];
    l.y = y;
    if (l.w == null) l.w = tw(l.text, l.cls);
    w = Math.max(w, l.w);
  });
  return { lines, w, h: lines.length ? y + lm(lines[lines.length - 1].cls)[1] : 0 };
}
function drawText(Bk, x, top, anchor, extra = '') {
  const t = Bk.lines.map((l) => `<tspan class="${l.cls}" x="${f1(x)}" y="${f1(top + l.y)}">${l.link ? A(l.link, esc(l.text)) : esc(l.text)}</tspan>${l.share ? `<tspan class="sh" dx="6">${esc(l.share)}</tspan>` : ''}`).join('');
  return `<text${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}>${t}${extra}</text>`;
}

/* ---------- logos: a regional company's own mark, a BUMN's (or its group's), else initials ---------- */
const exists = (p) => { try { return fs.statSync(path.join(PUB, p)).isFile(); } catch (e) { return false; } };
const groupLogo = (g) => (g && /^[a-z0-9-]+$/.test(g) && exists(`assets/bumn/${g}.webp`) ? `/assets/bumn/${g}.webp` : null);
let SUBL = { data: null, map: new Map() };
/* the BUMN subsidiaries' marks as the /bumn/<slug> maps show them (their own, or their group's) */
function subLogo(id) {
  let S = null;
  try { S = require('./bumnsankey1001').load(); } catch (e) { S = null; }
  if (!S || !S.groups) return null;
  if (SUBL.data !== S) {
    const map = new Map();
    const walk = (x) => { if (!x) return; if (x.id && x.logo && !map.has(x.id)) map.set(x.id, x.logo); (x.kids || []).forEach(walk); };
    Object.values(S.groups).forEach((G) => { (G.segments || []).forEach((sg) => (sg.cos || []).forEach(walk)); (G.unplaced || []).forEach(walk); (G.tops || []).forEach(walk); });
    SUBL = { data: S, map };
  }
  const l = SUBL.map.get(id);
  return l && exists(l.replace(/^\//, '')) ? l : null;
}
function logoFor(X, id, h) {
  if (id && X.CO.has(id)) { const l = B.logoOf(id); return l && exists(l.replace(/^\//, '')) ? l : null; }
  const e = id ? (X.data.ents || {})[id] : null;
  if (e && e.g) return subLogo(id) || groupLogo(e.g);
  const m = h && /^\/bumn#([a-z0-9-]+)$/.exec(h);
  return m ? groupLogo(m[1]) : null;
}
const initials = (name) => {
  const t = String(name || '').replace(/\(.*?\)/g, ' ').replace(/^(PT|Perum|Perumda|Perseroda|PD)\s+/i, '').trim().split(/[\s\-\/&,.]+/).filter(Boolean);
  if (!t.length) return '?';
  if (/^[A-Z0-9]{2,4}$/.test(t[0])) return t[0];
  return (t[0][0] + (t[1] && /^[A-Za-z]/.test(t[1]) ? t[1][0] : '')).toUpperCase();
};
let CLIP = 0;
function badge(it, cx, cy, r) {
  const off = it.off ? ' off' : '';
  if (it.logo) {
    const id = 'cmc' + (++CLIP);
    return `<g class="bdg${off}"><clipPath id="${id}"><circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r - 1)}"/></clipPath><circle class="bdc" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}"/>` +
      `<image href="${esc(it.logo)}" x="${f1(cx - r + 1)}" y="${f1(cy - r + 1)}" width="${f1(2 * r - 2)}" height="${f1(2 * r - 2)}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/></g>`;
  }
  const ini = initials(it.name);
  return `<g class="bdg${off}"><circle class="bdm" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}"/><text class="bdi" x="${f1(cx)}" y="${f1(cy + r * 0.3)}" text-anchor="middle" style="font-size:${f1(Math.max(6.5, r * (ini.length > 2 ? 0.62 : 0.8)))}px">${esc(ini)}</text></g>`;
}
const badgeHtml = (it, px) => (it.logo
  ? `<img class="cm-lg" src="${esc(it.logo)}" width="${px}" height="${px}" alt="" loading="lazy">`
  : `<span class="cm-mg" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.42)}px" aria-hidden="true">${esc(initials(it.name))}</span>`);

/* ---------- who owns it ---------- */
/* a name in a comparable form: "Kota Bandung" = "Bandung city", "PT Bank DKI Tbk" = "Bank DKI" */
function normName(s) {
  let t = String(s || '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  let m;
  if ((m = /^(?:pemerintah |pemkot )?kota (.+)$/.exec(t))) t = m[1] + ' city';
  else if ((m = /^(?:pemerintah |pemkab )?(?:kabupaten|kab) (.+)$/.exec(t))) t = m[1] + ' regency';
  else if ((m = /^(?:pemerintah |pemprov )?provinsi (.+)$/.exec(t))) t = m[1] + ' province';
  return t.replace(/^(pt|perumda|perseroda|perum|pd) /, '').replace(/ (tbk|persero|perseroda)$/, '').replace(/^dki /, '').trim();
}
const entOf = (X, id) => X.CO.get(id) || X.OPS.get(id) || (X.data.ents || {})[id] || null;
/* is the party behind this id already in the owner list? (same row, same BUMN group, same name) */
function sameParty(X, o, id) {
  if (o.id && o.id === id) return true;
  const e = entOf(X, id), eo = o.id ? entOf(X, o.id) : null;
  if (e && e.g && ((o.h && o.h.split('#')[1] === e.g) || (eo && eo.g === e.g))) return true;
  return normName(o.name) === normName(e ? e.n : id);
}
/* the stake an ownership tie states: "X holds 99.55% (31 Dec 2025)", or the one percentage it gives */
function stakeIn(d) {
  const s = String(d || '');
  let m = /\bholds?\s+(?:about\s+|around\s+|some\s+)?(\d{1,3}(?:\.\d+)?)\s?%/i.exec(s);
  if (!m) { const all = s.match(/\d{1,3}(?:\.\d+)?\s?%/g) || []; if (all.length === 1) m = [null, all[0].replace(/[\s%]/g, '')]; }
  const v = m ? Number(m[1]) : NaN;
  return v > 0 && v <= 100 ? v : null;
}
const OWN_R = new Set(['owns', 'invested_in']);
function ownersOf(X, c) {
  const me = c.id;
  const list = (c.o || []).filter((o) => o && o.g).map((o) => ({ name: clean(o.g), id: o.id || null, h: o.h || null, s: isNum(o.s) ? o.s : null, u: o.u || null, dt: o.dt || null }));
  for (const t of X.tiesOf.get(me) || []) {
    if (t.b !== me || t.a === me || !OWN_R.has(t.r)) continue;
    if (list.some((o) => sameParty(X, o, t.a))) continue;
    list.push({ name: B.nameOf(t.a), id: t.a, h: null, s: stakeIn(t.d), u: t.u || null, dt: t.dt || null, tie: t });
  }
  list.forEach((o) => { o.href = (o.id && B.hrefOf(o.id)) || o.h || null; o.logo = logoFor(X, o.id, o.h); });
  /* the biggest first; stakes not published after them, in the order given */
  return list.map((o, i) => [o, i]).sort((a, b) => (isNum(b[0].s) ? b[0].s : -1) - (isNum(a[0].s) ? a[0].s : -1) || a[1] - b[1]).map((x) => x[0]);
}
/* holder's stake in a row: from that row's owner list, else what the tie says */
function stakeOf(X, holder, target, t) {
  const tc = X.CO.get(target);
  if (tc) { const o = ownersOf(X, tc).find((x) => sameParty(X, x, holder)); if (o && isNum(o.s)) return o.s; }
  return t ? stakeIn(t.d) : null;
}

/* ---------- what it holds and does ---------- */
function holdsOf(X, c) {
  const me = c.id;
  const ties = X.tiesOf.get(me) || [];
  const used = new Set();
  const item = (id, extra) => {
    const r = X.CO.get(id);
    return Object.assign({ id, name: B.nameOf(id), href: B.hrefOf(id), logo: logoFor(X, id), off: r && r.st ? r.st : null }, extra);
  };
  const info = (t) => (t ? { u: t.u || null, dt: t.dt || null, e: t.e, d: t.d, tie: t } : {});
  const subs = [], stakes = [], seen = new Map();
  for (const id of new Set(X.subsOf.get(me) || [])) {
    const t = ties.find((x) => x.a === me && x.b === id && x.r === 'owns');
    if (t) used.add(t);
    const it = item(id, Object.assign(info(t), { s: stakeOf(X, me, id, t) }));
    subs.push(it); seen.set(id, it);
  }
  for (const h of X.holds.get(me) || []) {
    if (seen.has(h.id)) continue;
    const it = item(h.id, { s: isNum(h.s) ? h.s : null, u: h.u || null, dt: h.dt || null });
    stakes.push(it); seen.set(h.id, it);
  }
  for (const t of ties) {
    if (t.a !== me || t.b === me || !OWN_R.has(t.r)) continue;
    used.add(t);
    const had = seen.get(t.b);
    if (had) { if (!had.tie) Object.assign(had, { tie: t, d: had.d || t.d, e: had.e || t.e, u: had.u || t.u, dt: had.dt || t.dt }); continue; }
    const s = X.CO.has(t.b) ? stakeOf(X, me, t.b, t) : stakeIn(t.d);
    /* an owned company that is not a row of its own counts as a subsidiary when it is held over half */
    const sub = t.r === 'owns' && !X.CO.has(t.b) && ((isNum(s) && s > 50) || /\bsubsidiary\b/i.test(t.d || ''));
    const it = item(t.b, Object.assign(info(t), { s }));
    (sub ? subs : stakes).push(it); seen.set(t.b, it);
  }
  const bySize = (a, b) => (isNum(b.s) ? b.s : -1) - (isNum(a.s) ? a.s : -1);
  subs.sort(bySize); stakes.sort(bySize);
  const ops = [], opIds = new Set();
  for (const { o, pct, u } of X.opsOf.get(me) || []) {
    if (opIds.has(o.id)) continue;
    opIds.add(o.id);
    ops.push({ id: o.id, name: o.n, href: B.hrefOf(o.id), logo: null, s: isNum(pct) ? pct : null, u: u || (o.src || [])[0] || null, kind: o.k, off: o.st || null, d: o.d, o });
  }
  const rel = new Map();
  for (const t of ties) {
    if (used.has(t) || (t.b === me && OWN_R.has(t.r))) continue;
    const other = t.a === me ? t.b : t.a;
    if (other === me || opIds.has(other)) continue;
    const w = B.relWord(t, me);
    /* a company already drawn as a subsidiary or stake keeps one row; this tie is listed under it */
    const had = seen.get(other);
    if (had) { (had.also = had.also || []).push({ w, t }); continue; }
    if (!rel.has(w)) rel.set(w, []);
    const L = rel.get(w);
    if (L.some((x) => x.id === other)) continue;
    L.push(item(other, info(t)));
  }
  const groups = [];
  if (subs.length) groups.push({ key: 'subs', title: 'Subsidiaries', items: subs });
  if (stakes.length) groups.push({ key: 'stakes', title: 'Stakes in other companies', items: stakes });
  if (ops.length) groups.push({ key: 'ops', title: 'Joint operations and ventures', items: ops });
  [...rel.entries()].map(([w, items], i) => ({ w, items, i })).sort((a, b) => b.items.length - a.items.length || a.i - b.i)
    .forEach((g) => {
      /* the confirmed ones first, then the newest */
      g.items.sort((a, b) => (a.e === 's') - (b.e === 's') || String(b.dt || '').localeCompare(String(a.dt || '')));
      groups.push({ key: 'r-' + g.w, title: g.w, items: g.items, rel: true });
    });
  return groups;
}

/* ---------- the map ---------- */
const ST_SHORT = { dormant: 'NOT OPERATING', liquidation: 'BEING WOUND UP', not_yet_operating: 'NOT OPERATING YET', merged: 'MERGED', divested: 'SOLD', ended: 'ENDED' };
const evid = (e) => (e === 's' ? 'Company’s word' : 'Confirmed');
/* the one line under a name on the map: stake or share, date, status (no money) */
function metaOf(g, it) {
  const p = [];
  if (g.key === 'ops') p.push(it.kind === 'jv' ? 'JOINT VENTURE' : 'JOINT OPERATION');
  if (isNum(it.s)) p.push(g.key === 'ops' ? `${stakeTxt(it.s)} SHARE` : stakeTxt(it.s));
  if (it.off) p.push(ST_SHORT[it.off] || String(it.off).toUpperCase());
  if (it.dt && g.key !== 'ops') p.push(B.when(it.dt).toUpperCase());
  if (g.rel && it.e === 's') p.push('COMPANY’S WORD');
  return p.join(' · ');
}
function rowBlock(it, meta, max) {
  const lines = twoLines(it.name, 'dnm', max).map((t) => ({ cls: it.off ? 'dnm off' : 'dnm', text: t, dy: 15 }));
  if (meta) lines.push({ cls: 'k', text: fitW(meta, 'k', max), dy: 13 });
  const Bk = block(lines);
  Bk.mid = Bk.h / 2;
  return Bk;
}
/* a long right-hand side shows the first rows of each group and a "+N more" row; the full list is below */
function capGroups(groups, cap) {
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  let per = Infinity;
  if (total > cap) {
    per = cap;
    while (per > 2 && groups.reduce((a, g) => a + Math.min(g.items.length, per), 0) > cap) per--;
  }
  return groups.map((g) => (g.items.length > per ? { g, show: g.items.slice(0, per - 1), more: g.items.length - (per - 1) } : { g, show: g.items, more: 0 }));
}
/* rows of the right-hand side, top at 0: group headings, one row per item (badge + name + meta), "+N more" rows */
function layRight(groups, LW, cap, headW) {
  let y = 0;
  const rows = [];
  capGroups(groups, cap).forEach((x, gi) => {
    if (gi) y += 12;
    rows.push({ kind: 'hd', y: y + 8, text: fitW(`${x.g.title.toUpperCase()} · ${x.g.items.length}`, 'k', headW) });
    y += 18;
    x.show.forEach((it) => {
      const blk = rowBlock(it, metaOf(x.g, it), LW);
      const h = Math.max(28, blk.h + 9);
      const top = y + (h - blk.h) / 2;
      rows.push({ kind: 'it', it, blk, top, yc: top + blk.mid });
      y += h;
    });
    if (x.more) { rows.push({ kind: 'more', n: x.more, y: y + 10, yc: y + 6.5, text: fitW(`+${x.more} MORE, ALL LISTED BELOW`, 'k', headW) }); y += 20; }
  });
  return { rows, h: y };
}
/* the owners as drawn: the biggest seven and the rest lumped when there are more than eight, then the
   shares no published stake covers. Band heights: stake x K, at least MINB; equal when none is published. */
const MINB = 3, UNKB = 14;
function ownerRows(owners, K) {
  let rows = owners.map((o) => ({ o }));
  if (rows.length > 8) {
    /* the lump is as wide as the stakes published among them; the label says how many are not */
    const rest = owners.slice(7), known = rest.filter((o) => isNum(o.s));
    rows = rows.slice(0, 7).concat([{ o: { name: `${rest.length} more owners`, more: rest.length, unk: rest.length - known.length, s: known.length ? known.reduce((a, o) => a + o.s, 0) : null, href: '#owners' } }]);
  }
  const known = owners.filter((o) => isNum(o.s));
  const sum = known.reduce((a, o) => a + o.s, 0);
  const none = owners.length && !known.length;
  rows.forEach((r) => {
    const s = r.o.s;
    r.barH = none ? Math.max(MINB, (100 * K) / rows.length) : isNum(s) ? Math.max(MINB, s * K) : UNKB;
    r.unk = !none && !isNum(s);
    r.cls = r.unk ? 'bd ex' : r.o.more ? 'bd mo' : 'bd';
  });
  const unk = owners.length - known.length;
  if (known.length && 100 - sum > 0.015) rows.push({ o: { name: 'Rest of the shares', rest: true, s: 100 - sum, incl: unk }, barH: Math.max(MINB, (100 - sum) * K), cls: 'bd rs', rest: true });
  return rows;
}
function ownerBlock(o, max) {
  const off = o.rest || o.more;
  const lines = twoLines(o.name, 'pl', max).map((t) => ({ cls: off ? 'pl off' : 'pl', text: t, dy: 16, link: o.href || null }));
  if (isNum(o.s)) {
    /* the rest of the shares includes whatever the owners without a published stake hold */
    const v = stakeTxt(o.s), sh = o.more ? (o.unk ? `+${o.unk} NOT PUBLISHED` : '') : o.rest ? (o.incl ? `INCL. ${o.incl} ${o.incl === 1 ? 'OWNER' : 'OWNERS'} ABOVE` : '') : o.dt ? B.when(o.dt).toUpperCase() : '';
    lines.push({ cls: 'v', text: v, link: o.u || null, share: sh || null, w: tw(v, 'v') + (sh ? 6 + tw(sh, 'sh') : 0), dy: 19 });
  } else {
    lines.push({ cls: 'k', text: o.more ? 'ALL LISTED BELOW' : o.tie ? 'STAKE IN THE LIST BELOW' : 'STAKE NOT PUBLISHED', dy: 15 });
  }
  return block(lines);
}
const band = (x0, a0, a1, x1, b0, b1) => {
  const mx = (x0 + x1) / 2;
  return `M${f1(x0)} ${f1(a0)} C${f1(mx)} ${f1(a0)} ${f1(mx)} ${f1(b0)} ${f1(x1)} ${f1(b0)} L${f1(x1)} ${f1(b1)} C${f1(mx)} ${f1(b1)} ${f1(mx)} ${f1(a1)} ${f1(x0)} ${f1(a1)}Z`;
};
const bandTip = (o) => (o.more
  ? `${o.name}: ${isNum(o.s) ? stakeTxt(o.s) + ' published between them' : 'stakes not published'}${o.unk && isNum(o.s) ? `; ${o.unk} not published` : ''}`
  : `${o.name}: ${isNum(o.s) ? stakeTxt(o.s) : 'stake not published'}${o.rest ? ', not covered by a published stake' : ''}`);
const barCls = (r) => (r.rest ? 'nb rs' : r.unk ? 'nb ex' : 'nb');
const lineTo = (x0, y0, x1, y1) => { const d = (x1 - x0) * 0.5; return `M${f1(x0)} ${f1(y0)} C${f1(x0 + d)} ${f1(y0)} ${f1(x1 - d)} ${f1(y1)} ${f1(x1)} ${f1(y1)}`; };
function rightSvg(R, oR, xD, rD, xL) {
  let s = '';
  R.rows.forEach((r) => {
    if (r.kind === 'hd') s += `<text class="k hd" x="${xD - rD}" y="${f1(oR + r.y)}">${esc(r.text)}</text>`;
    else if (r.kind === 'more') s += `<a href="#holds"><text class="k more" x="${xD - rD}" y="${f1(oR + r.y)}">${esc(r.text)}</text></a>`;
    else {
      const it = r.it;
      s += badge(it, xD, oR + r.yc, rD) + A(it.href, drawText(r.blk, xL, oR + r.top, 'start', `<title>${esc(it.name)}${it.d ? ': ' + esc(it.d) : ''}</title>`));
    }
  });
  return s;
}

/* desktop: owners | the company | what it holds and does */
function wideSvg(M) {
  const W = 1140, xA = 232, bw = 12, xC = 452, OLW = 208, GAP = 10, K = 2.6;
  const xD = 864, rD = 11, xL = xD + rD + 8, LW = W - xL - 6;
  const L = [];
  let y = 0;
  ownerRows(M.owners, K).forEach((r) => {
    const blk = ownerBlock(r.o, OLW), h = Math.max(r.barH, blk.h);
    L.push(Object.assign(r, { blk, barTop: y + (h - r.barH) / 2, labTop: y + (h - blk.h) / 2 }));
    y += h + GAP;
  });
  const HL = L.length ? y - GAP : 0;
  const HB = L.length ? L.reduce((a, r) => a + r.barH, 0) : 120;
  /* the company, right of its bar: badge, name, what it does */
  const HW = 168;
  const hl = twoLines(M.c.n, 'pn', HW, 3).map((t) => ({ cls: 'pn', text: t, dy: 20 }));
  if (M.sub) twoLines(M.sub, 'k', HW).forEach((t, i) => hl.push({ cls: 'k', text: t, dy: i ? 13 : 16 }));
  const head = block(hl), headH = Math.max(46, head.h);
  const R = layRight(M.groups, LW, 18, W - (xD - rD) - 4);
  const H = Math.max(HL, HB, R.h, headH, 120);
  const oL = (H - HL) / 2, oB = (H - HB) / 2, oR = (H - R.h) / 2, mid = oB + HB / 2;
  let back = '', s = '';
  let cy = oB;
  L.forEach((r) => {
    const a0 = oL + r.barTop, b0 = cy;
    cy += r.barH;
    back += `<path class="${r.cls}" d="${band(xA + bw, a0, a0 + r.barH, xC, b0, b0 + r.barH)}"><title>${esc(bandTip(r.o))}</title></path>`;
    s += `<rect class="${barCls(r)}" x="${xA}" y="${f1(a0)}" width="${bw}" height="${f1(r.barH)}"/>` + drawText(r.blk, xA - 10, oL + r.labTop, 'end');
  });
  s += `<rect class="na" x="${xC}" y="${f1(oB)}" width="${bw}" height="${f1(HB)}"/>`;
  if (!L.length) s += `<text class="k" x="${xC - 10}" y="${f1(mid + 3)}" text-anchor="end">OWNERS NOT PUBLISHED</text>`;
  const hx = xC + bw + 12, hTop = mid - headH / 2;
  s += badge({ name: M.c.n, logo: M.logo }, hx + 22, mid, 22) + drawText(head, hx + 54, hTop + (headH - head.h) / 2, 'start');
  /* lines: from right of the name, spread over its height, each ending before its badge */
  const its = R.rows.filter((r) => r.kind !== 'hd');
  const xS = hx + 54 + head.w + 14, n = its.length, spread = Math.min(Math.max(headH - 14, 0), 5 * (n - 1));
  its.forEach((r, j) => {
    const y0 = n > 1 ? mid - spread / 2 + (spread * j) / (n - 1) : mid;
    back += `<path class="cn${r.kind === 'more' ? ' mr' : ''}" d="${lineTo(xS, y0, r.kind === 'more' ? xD - rD - 6 : xD - rD - 3, oR + r.yc)}"/>`;
  });
  s += rightSvg(R, oR, xD, rD, xL);
  const top = -14, Hv = H + 28;
  return `<svg class="cm-svg" viewBox="0 ${top} ${W} ${f1(Hv)}" width="${W}" height="${f1(Hv)}" role="img" aria-label="${esc(M.c.n)}: its owners by stake, and what it holds and does">${back}${s}</svg>`;
}

/* phone: the company and its owners (bar left, owners' bars and labels right) */
function phoneOwnersSvg(M) {
  const W = 350, bw = 10, xB = 84, xL = xB + bw + 8, OLW = W - xL - 2, GAP = 10, K = 2.2;
  const L = [];
  let y = 0;
  ownerRows(M.owners, K).forEach((r) => {
    const blk = ownerBlock(r.o, OLW), h = Math.max(r.barH, blk.h);
    L.push(Object.assign(r, { blk, barTop: y + (h - r.barH) / 2, labTop: y + (h - blk.h) / 2 }));
    y += h + GAP;
  });
  if (!L.length) return '';
  const HL = y - GAP, HB = L.reduce((a, r) => a + r.barH, 0), H = Math.max(HL, HB);
  const oL = (H - HL) / 2, oB = (H - HB) / 2;
  let back = '', s = '', cy = oB;
  L.forEach((r) => {
    const a0 = oL + r.barTop, b0 = cy;
    cy += r.barH;
    back += `<path class="${r.cls}" d="${band(bw, b0, b0 + r.barH, xB, a0, a0 + r.barH)}"><title>${esc(bandTip(r.o))}</title></path>`;
    s += `<rect class="${barCls(r)}" x="${xB}" y="${f1(a0)}" width="${bw}" height="${f1(r.barH)}"/>` + drawText(r.blk, xL, oL + r.labTop, 'start');
  });
  s += `<rect class="na" x="0" y="${f1(oB)}" width="${bw}" height="${f1(HB)}"/>`;
  return `<svg class="cm-svg" viewBox="0 -10 ${W} ${f1(H + 20)}" width="${W}" height="${f1(H + 20)}" role="img" aria-label="${esc(M.c.n)}: its owners by stake">${back}${s}</svg>`;
}
/* phone: what it holds and does, fanning out of a short bar */
function phoneHoldsSvg(M) {
  const W = 350, bw = 10, xD = 66, rD = 11, xL = xD + rD + 8, LW = W - xL - 2;
  const R = layRight(M.groups, LW, 14, W - (xD - rD) - 2);
  const its = R.rows.filter((r) => r.kind !== 'hd');
  if (!its.length) return '';
  const H = R.h, mid = H / 2, n = its.length, hs = Math.min(Math.max(6 * n, 24), 160, H);
  let back = '';
  its.forEach((r, j) => {
    const y0 = n > 1 ? mid - (hs - 8) / 2 + ((hs - 8) * j) / (n - 1) : mid;
    back += `<path class="cn${r.kind === 'more' ? ' mr' : ''}" d="${lineTo(bw, y0, r.kind === 'more' ? xD - rD - 6 : xD - rD - 3, r.yc)}"/>`;
  });
  const s = `<rect class="na" x="0" y="${f1(mid - hs / 2)}" width="${bw}" height="${f1(hs)}"/>` + rightSvg(R, 0, xD, rD, xL);
  return `<svg class="cm-svg" viewBox="0 -10 ${W} ${f1(H + 20)}" width="${W}" height="${f1(H + 20)}" role="img" aria-label="${esc(M.c.n)}: what it holds and does">${back}${s}</svg>`;
}

/* ---------- the page ---------- */
const STYLE = `.cm-wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.cm-back{font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;text-decoration:none;display:inline-block;margin-bottom:18px}
.cm-back:hover{color:#000}
.cm-id{display:flex;gap:20px;align-items:center}
.cm-id h1{min-width:0;overflow-wrap:anywhere}
.cm-disc{flex:none;width:76px;height:76px;border-radius:50%;background:#fff;box-shadow:0 3px 9px rgba(24,32,36,.22),0 0 0 1.5px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center;overflow:hidden}
.cm-disc img{width:100%;height:100%;display:block;border-radius:50%;border:4px solid #fff;object-fit:cover}
.cm-disc.mg{background:#F1F1EE;font:400 22px/1 'IBM Plex Mono',monospace;color:#52525B;letter-spacing:0}
.cm-legal{color:#52525B;font-size:15px;line-height:1.4;margin-top:8px}
.cm-meta{display:flex;flex-wrap:wrap;gap:4px 14px;font:400 11px/1.6 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#3F3F46;margin-top:18px}
.cm-meta .st{color:#7A5200;background:#FFF8E6;border:1px solid #F1E3BF;padding:0 6px}
.cm-facts{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:4px 14px;margin-top:14px;font-size:13px;line-height:1.45;color:#3F3F46;max-width:96ch}
.cm-facts dt{font:400 10.5px/1.9 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.cm-facts dd{min-width:0;overflow-wrap:anywhere}
@media(max-width:640px){.cm-id{gap:14px}.cm-disc{width:56px;height:56px}.cm-facts{grid-template-columns:minmax(0,1fr);gap:0}.cm-facts dd{margin-bottom:6px}}
.cm-wide{border:1px solid #E7E7E7;background:#fff;padding:18px 0 10px}
.cm-phone{display:none}
.cm-svg{display:block;width:100%;height:auto;overflow:visible}
.cm-phone .cm-svg{max-width:500px}
.cm-svg text{font-family:'Overused Grotesk',system-ui,sans-serif;fill:#0B0B0C;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}
.cm-svg .k,.cm-svg .ch,.cm-svg .sh{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.04em;fill:#6B6B73}
.cm-svg .sh{font-size:11px}
.cm-svg .k.hd{fill:#0B0B0C}
.cm-svg .k.more{fill:#2A6E9F}
.cm-svg .pl{font-size:13.5px;font-weight:600}
.cm-svg .pl.off{fill:#6B6B73;font-weight:500}
.cm-svg .v{font-size:15px;font-weight:650}
.cm-svg .pn{font-size:17px;font-weight:650}
.cm-svg .dnm{font-size:12.5px;font-weight:500}
.cm-svg .dnm.off{fill:#9A9AA0}
.cm-svg a:hover .dnm,.cm-svg a:hover .pl,.cm-svg a:hover .v,.cm-svg a:hover .more{text-decoration:underline}
.cm-svg .bd{fill:#DCDCD5;stroke:#fff;stroke-width:1.5;stroke-linejoin:round}
.cm-svg .bd.ex{fill:#F1F1EE}
.cm-svg .bd.mo{fill:#E7E7E1}
.cm-svg .bd.rs{fill:#fff;stroke:#B4B4BA;stroke-width:1;stroke-dasharray:3 3}
.cm-svg .nb,.cm-svg .na{fill:#0B0B0C}
.cm-svg .nb.ex{fill:#9A9AA0}
.cm-svg .nb.rs{fill:#fff;stroke:#9A9AA0;stroke-width:1;stroke-dasharray:3 2}
.cm-svg .cn{fill:none;stroke:#C9C9CF;stroke-width:1.2}
.cm-svg .cn.mr{stroke-dasharray:2 3}
.cm-svg .bdc{fill:#fff;stroke:rgba(0,0,0,.14);stroke-width:1}
.cm-svg .bdm{fill:#F1F1EE;stroke:rgba(0,0,0,.12);stroke-width:1}
.cm-svg .bdi{font-family:'IBM Plex Mono',monospace;fill:#52525B;stroke:none;letter-spacing:0}
.cm-svg .bdg{filter:drop-shadow(0 1px 1.5px rgba(24,32,36,.16))}
.cm-svg .bdg.off{opacity:.45}
.cm-key{font:400 11px/1.6 'IBM Plex Mono',monospace;letter-spacing:.03em;color:#6B6B73;margin:10px 0 0;max-width:120ch}
.cm-key a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.cm-key .rs{display:inline-block;width:14px;height:9px;border:1px dashed #9A9AA0;vertical-align:-1px}
.cm-ph{font-size:15px;margin:0 0 6px}
.cm-ph span{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;display:block;margin-top:2px}
.cm-ph2{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#0B0B0C;margin:18px 0 4px;padding-top:12px;border-top:1px solid #F1F1F1}
@media(max-width:999px){.cm-wide,.wide-only{display:none}.cm-phone{display:block}}
@media(min-width:1000px){.phone-only{display:none}}
.cm-fg{border:1px solid #E7E7E7;overflow-x:auto}
.cm-fg table{min-width:0;width:100%;table-layout:fixed;font-size:13px}
.cm-fg th,.cm-fg td{padding:10px 12px}
.cm-fg thead th,.cm-fg thead td{white-space:normal;background:#FAFAFA;border-bottom:1px solid #E7E7E7}
.cm-fg tbody th{font:500 13.5px/1.3 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;text-transform:none;color:#000;background:#fff;border-bottom:1px solid #F1F1F1;width:24%;white-space:normal;overflow-wrap:anywhere}
.cm-fg td{text-align:right;font:400 12.5px/1.35 'IBM Plex Mono',monospace;white-space:normal}
.cm-fg td a{color:#000;text-decoration:none;border-bottom:1px solid #D9D9D9}
.cm-fg td .ls,.cm-fg td .ls a{color:#9F1D1D}
.cm-fg td .nw{white-space:nowrap}
.cm-fg td .na{color:#9A9AA0}
.cm-fg .bar{display:block;height:4px;background:#F1F1EE;margin-top:6px;position:relative}
.cm-fg .bar i{position:absolute;left:0;top:0;bottom:0;background:#3F3F46;display:block}
.cm-fg .bar i.ls{background:#D98C8C}
.cm-fg sup,.cm-fn sup{font:400 9.5px/1 'IBM Plex Mono',monospace;color:#2A6E9F;margin-left:2px}
@media(max-width:640px){.cm-fg th,.cm-fg td{padding:8px 3px}.cm-fg td{font-size:10px;letter-spacing:0}.cm-fg tbody th{font-size:12px;width:19%;padding-left:6px}.cm-fg thead th{font-size:9.5px;letter-spacing:.02em}}
.cm-fn{font-size:12.5px;line-height:1.55;color:#3F3F46;margin-top:10px;max-width:92ch}
.cm-fn a,.cm-src a,.cm-l a.sl,.cm-one a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.cm-one{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.cm-one div{background:#fff;padding:16px 18px;min-width:0}
.cm-one b{display:block;font-size:24px;font-weight:600;letter-spacing:-0.02em;line-height:1.15}
.cm-one b.ls{color:#9F1D1D;font-size:20px}
.cm-one span{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73}
@media(max-width:640px){.cm-one{grid-template-columns:minmax(0,1fr)}}
.cm-none{color:#6B6B73;font-size:14px}
.cm-bd{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:760px){.cm-bd{grid-template-columns:minmax(0,1fr)}}
.cm-bd>div{background:#fff;padding:16px 18px 10px;min-width:0}
.cm-bd h3{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;margin-bottom:6px}
.cm-bd ul{list-style:none}
.cm-bd li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid #F4F4F4;font-size:14px;line-height:1.35}
.cm-bd li:first-child{border-top:0}
.cm-bd li b{font-weight:600;min-width:0}
.cm-bd li span{color:#52525B;font-size:13px;text-align:right;min-width:0}
.cm-cols{columns:2 440px;column-gap:14px}
.cm-cols .cm-g{break-inside:avoid;display:inline-block;width:100%;vertical-align:top}
.cm-g{border:1px solid #E7E7E7;margin-bottom:14px}
.cm-l.cols{columns:2 320px;column-gap:0}
.cm-rest{border-top:1px solid #F1F1F1}
.cm-rest summary{cursor:pointer;font:400 11px/1.3 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#2A6E9F;padding:11px 16px;list-style:none}
.cm-rest summary::-webkit-details-marker{display:none}
.cm-rest summary::before{content:"+ "}
.cm-rest[open] summary::before{content:"− "}
.cm-rest summary:focus-visible{outline:2px solid #000;outline-offset:-2px}
.cm-l.cols li{break-inside:avoid;border-top:1px solid #F4F4F4}
.cm-g>h3{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#0B0B0C;padding:12px 16px;border-bottom:1px solid #F1F1F1;background:#FAFAFA;display:flex;justify-content:space-between;gap:10px}
.cm-g>h3 span{color:#6B6B73}
.cm-l{list-style:none}
.cm-l li{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;padding:10px 16px;border-top:1px solid #F4F4F4;scroll-margin-top:12px}
.cm-l li:first-child{border-top:0}
.cm-l li:target{background:#FFFBEA}
.cm-l .nm{font-weight:600;font-size:14px;line-height:1.35;display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.cm-l .nm>a,.cm-l .nm>span:first-child{min-width:0;overflow-wrap:anywhere}
.cm-l .nm>a{color:#000;text-decoration:none;border-bottom:1px solid #C9C9CF}
.cm-l .pc{font:400 12px/1.3 'IBM Plex Mono',monospace;white-space:nowrap;color:#3F3F46}
.cm-l .d{color:#3F3F46;font-size:13px;line-height:1.5;margin-top:3px;overflow-wrap:anywhere}
.cm-l .m{font:400 10.5px/1.5 'IBM Plex Mono',monospace;color:#6B6B73;letter-spacing:.02em;margin-top:3px;overflow-wrap:anywhere}
.cm-l .m .co{color:#7A5200}
.cm-l .rw{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73}
.cm-l li.off .nm{color:#6B6B73;font-weight:500}
.cm-lg{border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.10);background:#fff;display:block}
.cm-mg{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:#F1F1EE;box-shadow:0 0 0 1px rgba(0,0,0,.10);font-family:'IBM Plex Mono',monospace;color:#52525B;letter-spacing:0}
.cm-src{list-style:none;border-top:1px solid #F1F1F1}
.cm-src li{padding:7px 0;border-bottom:1px solid #F4F4F4;font-size:13px;line-height:1.45;overflow-wrap:anywhere}
.cm-src li b{font-weight:600}
.cm-src li span{color:#6B6B73;font:400 11px/1.4 'IBM Plex Mono',monospace}
.cm-more{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:860px){.cm-more{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.cm-more{grid-template-columns:minmax(0,1fr)}}
.cm-more>div{background:#fff;padding:14px 16px;display:grid;grid-template-columns:34px minmax(0,1fr);gap:12px;align-items:start;min-width:0}
.cm-more a.n{font-weight:600;font-size:15px;line-height:1.3;color:#000;text-decoration:none;border-bottom:1px solid #C9C9CF;overflow-wrap:anywhere}
.cm-more .k{font:400 10.5px/1.5 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;margin-top:4px}
.cm-more .k a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
`;

/* figures: BP BUMD Jakarta's years when the row has them, else the one year we have, else a line */
function figuresSection(M) {
  const c = M.c, F = c.fs, notes = (Array.isArray(c.fn) ? c.fn : []).filter((n) => n && n.t);
  const ys = F && Array.isArray(F.y) ? F.y : [];
  /* notes on the figures (fn): one tied to a year in the table gets a numbered marker on that year's
     column; the others, and those under a single year, are plain lines */
  const inTab = (n) => ys.some((y) => Number(y) === Number(n.y));
  const numbered = notes.filter(inTab);
  const noteMark = (y) => numbered.map((n, i) => (Number(n.y) === Number(y) ? `<sup>${i + 1}</sup>` : '')).join('');
  const noteLine = (n, no) => `<p class="cm-fn">${no ? `<sup>${no}</sup> ` : ''}${n.y ? `${esc(String(n.y))}: ` : ''}${esc(n.t)}${n.u ? ` (${A(n.u, esc(B.host(n.u) || 'source'))})` : ''}</p>`;
  const noteList = (only, plain) => notes.filter((n) => !only || only(n)).map((n) => noteLine(n, plain || !inTab(n) ? 0 : numbered.indexOf(n) + 1)).join('');
  const ROWS = [['a', 'Total assets'], ['r', 'Revenue'], ['p', 'Net profit'], ['e', 'Equity']];
  const valAt = (k, i) => (F && Array.isArray(F[k]) && isNum(F[k][i]) ? F[k][i] : null);
  if (ys.length && ROWS.some(([k]) => ys.some((_, i) => valAt(k, i) != null))) {
    const by = F.by || B.host(F.s) || 'source';
    /* a figure the source carries as a column shows as a row, dashes and all (a note may say why) */
    const rows = ROWS.filter(([k]) => Array.isArray(F[k])).map(([k, label]) => {
      const max = Math.max(...ys.map((_, i) => Math.abs(valAt(k, i) || 0))) || 1;
      const cells = ys.map((y, i) => {
        const v = valAt(k, i);
        if (v == null) return `<td><span class="na" title="Not published">—</span></td>`;
        const loss = k === 'p' && v < 0;
        const txt = loss ? `<span class="ls">net loss <span class="nw">${A(F.s, esc(B.money(-v, F.u)))}</span></span>` : `<span class="nw">${A(F.s, esc(B.money(v, F.u)))}</span>`;
        return `<td>${txt}<span class="bar"><i${loss ? ' class="ls"' : ''} style="width:${Math.max(2, (Math.abs(v) / max) * 100).toFixed(1)}%"></i></span></td>`;
      }).join('');
      return `<tr><th scope="row">${label}</th>${cells}</tr>`;
    }).join('');
    const span = ys.length > 1 ? `${ys[0]}–${ys[ys.length - 1]}` : String(ys[0]);
    return `<section class="wrap" id="figures">
  <div class="eyebrow"><span class="sq"></span>FIGURES, ${esc(span)}</div>
  <p class="lede">As published by ${A(F.s, esc(by))}${M.dkiAsof ? `, as of ${esc(M.dkiAsof)}` : ''}, in rupiah${F.u && F.u !== 'Rp bn' ? ` (${esc(F.u)})` : ''}. Each figure links to its source. A dash means the figure is not published.</p>
  <div class="cm-fg"><table><thead><tr><td aria-hidden="true"></td>${ys.map((y) => `<th class="n" scope="col">${esc(String(y))}${noteMark(y)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
  ${noteList()}
</section>`;
  }
  const f = c.fin;
  if (f && [f.a, f.r, f.p].some(isNum)) {
    const cell = (v, label, k) => {
      if (!isNum(v)) return `<div><b class="na">—</b><span>${label}, not published</span></div>`;
      const loss = k === 'p' && v < 0;
      return `<div><b${loss ? ' class="ls"' : ''}>${loss ? 'net loss ' : ''}${A(f.s, esc(B.money(loss ? -v : v, f.u)))}</b><span>${loss ? 'Net loss' : label}</span></div>`;
    };
    return `<section class="wrap" id="figures">
  <div class="eyebrow"><span class="sq"></span>FIGURES, FY${esc(String(f.y || ''))}</div>
  <p class="lede">The latest year we have${f.s ? `, from ${A(f.s, esc(B.host(f.s) || 'its source'))}` : ''}, in rupiah${f.u && f.u !== 'Rp bn' ? ` (${esc(f.u)})` : ''}.</p>
  <div class="cm-one">${cell(f.a, 'Total assets', 'a')}${cell(f.r, 'Revenue', 'r')}${cell(f.p, 'Net profit', 'p')}</div>
  ${noteList((n) => !n.y || Number(n.y) === Number(f.y), true)}
</section>`;
  }
  return `<section class="wrap" id="figures">
  <div class="eyebrow"><span class="sq"></span>FIGURES</div>
  <p class="cm-none">No figures published yet.</p>
</section>`;
}

function boardSection(M) {
  const c = M.c, bd = Array.isArray(c.bd) ? c.bd.filter((x) => x && x.n) : [];
  if (!bd.length) return '';
  const dir = bd.filter((x) => x.k === 'd'), sup = bd.filter((x) => x.k !== 'd');
  const pengawas = sup.some((x) => /pengawas/i.test(x.r || ''));
  const col = (title, L) => (L.length ? `<div><h3>${title}</h3><ul>${L.map((x) => `<li><b>${esc(clean(x.n))}</b><span>${esc(clean(x.r))}</span></li>`).join('')}</ul></div>` : '');
  return `<section class="wrap" id="board">
  <div class="eyebrow"><span class="sq"></span>BOARD</div>
  <div class="cm-bd">${col('Directors (Direksi)', dir)}${col(pengawas ? 'Supervisory board (Dewan Pengawas)' : 'Commissioners (Dewan Komisaris)', sup)}</div>
  <p class="foot-note">As published${c.bds ? ` by ${A(c.bds, esc(M.dkiBy || B.host(c.bds)))}` : ''}${M.dkiAsof ? `, as of ${esc(M.dkiAsof)}` : ''}. Titles as the company gives them.</p>
</section>`;
}

/* a long list shows its first ten; the rest open in place (the /bumn lists' rule) */
function fold(items, word, cls = '') {
  if (items.length <= 12) return `<ul class="cm-l${cls}">${items.join('')}</ul>`;
  return `<ul class="cm-l${cls}">${items.slice(0, 10).join('')}</ul><details class="cm-rest"><summary>${items.length - 10} more ${word}</summary><ul class="cm-l${cls}">${items.slice(10).join('')}</ul></details>`;
}
/* every owner, then every item on the right, with its detail and source */
function listsSection(M) {
  const own = M.owners.map((o, i) => `<li><span>${badgeHtml(o, 24)}</span><div><div class="nm">${o.href ? A(o.href, esc(o.name)) : `<span>${esc(o.name)}</span>`}<span class="pc">${isNum(o.s) ? (o.u ? A(o.u, esc(stakeTxt(o.s)), 'sl') : esc(stakeTxt(o.s))) : 'stake not published'}</span></div>` +
    `${o.tie && o.tie.d ? `<p class="d">${esc(o.tie.d)}</p>` : ''}<p class="m">${[o.tie ? evid(o.tie.e) : '', o.dt ? B.when(o.dt) : '', o.u ? A(o.u, esc(B.host(o.u))) : ''].filter(Boolean).join(' · ')}</p></div></li>`);
  const known = M.owners.filter((o) => isNum(o.s)), sum = known.reduce((a, o) => a + o.s, 0);
  const ownBox = M.owners.length ? `<div class="cm-g" id="owners"><h3>Owned by<span>${M.owners.length}</span></h3>${fold(own, 'owners', M.owners.length > 5 ? ' cols' : '')}</div>${known.length && 100 - sum > 0.015 ? `<p class="foot-note" style="margin:-6px 0 14px">The published stakes add up to ${esc(stakeTxt(sum))}; the rest of the shares is not covered by them.</p>` : ''}` :
    `<div class="cm-g" id="owners"><h3>Owned by</h3><p class="cm-none" style="padding:12px 16px">Owners not published.</p></div>`;
  const li = (g, it) => {
    const st = it.off ? (B.STATUS[it.off] || it.off) : '';
    const pc = g.key === 'ops' ? [it.kind === 'jv' ? 'Joint venture' : 'Joint operation', isNum(it.s) ? `${stakeTxt(it.s)} share` : ''].filter(Boolean).join(' · ') : isNum(it.s) ? stakeTxt(it.s) : '';
    const members = g.key === 'ops' ? (it.o.m || []).map((m) => `${m.id ? (B.hrefOf(m.id) ? A(B.hrefOf(m.id), esc(B.nameOf(m.id))) : esc(B.nameOf(m.id))) : esc(B.nameOf(m.n || ''))}${isNum(m.pct) ? ` ${esc(stakeTxt(m.pct))}` : ''}`).join(', ') : '';
    const val = g.key === 'ops' && it.o.v && isNum(it.o.v.amount) ? B.money(it.o.v.unit === 'Rp tn' ? it.o.v.amount * 1000 : it.o.v.amount, it.o.v.unit === 'US$ m' ? 'US$ m' : 'Rp bn') : '';
    const srcs = g.key === 'ops' ? (it.o.src || []).slice(0, 3) : [it.u].filter(Boolean);
    const meta = [it.tie ? evid(it.tie.e) : g.key === 'stakes' && it.u ? 'Owner list' : '', it.dt ? B.when(it.dt) : '', it.o && it.o.per ? it.o.per : '', st, ...srcs.map((u) => A(u, esc(B.host(u) || 'source')))].filter(Boolean);
    return `<li class="${it.off ? 'off' : ''}"><span>${badgeHtml(it, 24)}</span><div><div class="nm">${it.href ? A(it.href, esc(it.name)) : `<span>${esc(it.name)}</span>`}${pc ? `<span class="pc">${it.u && g.key !== 'ops' ? A(it.u, esc(pc), 'sl') : esc(pc)}</span>` : ''}</div>` +
      `${members ? `<p class="d">Members: ${members}</p>` : ''}${it.d ? `<p class="d">${esc(it.d)}${val ? ` Value ${esc(val)}.` : ''}</p>` : val ? `<p class="d">Value ${esc(val)}.</p>` : ''}<p class="m">${meta.join(' · ')}</p>` +
      (it.also || []).map(({ w, t }) => `<p class="d"><span class="rw">${esc(w)}:</span> ${esc(t.d || '')}</p><p class="m">${[evid(t.e), t.dt ? B.when(t.dt) : '', t.u ? A(t.u, esc(B.host(t.u) || 'source')) : ''].filter(Boolean).join(' · ')}</p>`).join('') + `</div></li>`;
  };
  const right = M.groups.map((g) => `<div class="cm-g" id="h-${esc(g.key.replace(/[^a-z0-9-]+/gi, '-').toLowerCase())}"><h3>${esc(g.title)}<span>${g.items.length}</span></h3>${fold(g.items.map((it) => li(g, it)), g.key === 'subs' ? 'subsidiaries' : g.key === 'stakes' ? 'stakes' : g.key === 'ops' ? 'joint operations' : 'ties')}</div>`).join('');
  return `<section class="wrap" id="holds">
  <div class="eyebrow"><span class="sq"></span>OWNERS, TIES AND JOINT OPERATIONS</div>
  <p class="lede">Every owner and stake, then everything ${esc(M.c.n)} holds and does, each with its source. “Confirmed” means a filing, a regulator or both parties state it; “Company’s word” means one party says it on its own site or in its own release.</p>
  ${ownBox}
  <div class="cm-cols">${right || `<div class="cm-g"><h3>Holds and does</h3><p class="cm-none" style="padding:12px 16px">No subsidiaries, stakes, joint operations or ties found yet.</p></div>`}</div>
</section>`;
}

function sourcesSection(M) {
  const c = M.c;
  const urls = [...(c.src || []), c.fin && c.fin.s, c.fs && c.fs.s, c.bds, ...(c.o || []).map((o) => o && o.u), ...(Array.isArray(c.fn) ? c.fn.map((n) => n && n.u) : [])]
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u));
  const uniq = [...new Set(urls)];
  if (!uniq.length) return '';
  const byHost = new Map();
  uniq.forEach((u) => { const h = B.host(u) || u; if (!byHost.has(h)) byHost.set(h, []); byHost.get(h).push(u); });
  const tail = (u) => { try { const p = new URL(u).pathname.split('/').filter(Boolean).pop(); return p ? decodeURIComponent(p).slice(0, 60) : ''; } catch (e) { return ''; } };
  const rows = [...byHost.entries()].map(([h, us]) => `<li><b>${us.length === 1 ? A(us[0], esc(h)) : esc(h)}</b>${us.length > 1 ? ` <span>${us.map((u) => A(u, esc(tail(u) || h))).join(' · ')}</span>` : ''}</li>`).join('');
  return `<section class="wrap" id="sources">
  <div class="eyebrow"><span class="sq"></span>SOURCES</div>
  <ul class="cm-src">${rows}</ul>
</section>`;
}

const latestAssets = (c) => {
  if (c.fs && Array.isArray(c.fs.y) && Array.isArray(c.fs.a)) for (let i = c.fs.y.length - 1; i >= 0; i--) if (isNum(c.fs.a[i])) return { v: c.fs.a[i], y: c.fs.y[i], u: c.fs.u, s: c.fs.s };
  if (c.fin && isNum(c.fin.a)) return { v: c.fin.a, y: c.fin.y, u: c.fin.u, s: c.fin.s };
  return null;
};
function moreSection(X, c) {
  if (!c.p) return '';
  const near = [...X.pages].filter((id) => id !== c.id && X.CO.get(id) && X.CO.get(id).p === c.p).map((id) => X.CO.get(id))
    .map((r) => ({ r, a: latestAssets(r) })).sort((x, y) => (y.a ? y.a.v : -1) - (x.a ? x.a.v : -1) || String(x.r.n).localeCompare(String(y.r.n))).slice(0, 6);
  if (!near.length) return '';
  return `<section class="wrap" id="more">
  <div class="eyebrow"><span class="sq"></span>MORE IN ${esc(String(c.p).toUpperCase())}</div>
  <div class="cm-more">${near.map(({ r, a }) => `<div>${badgeHtml({ name: r.n, logo: logoFor(X, r.id) }, 34)}<div><a class="n" href="${esc(B.pageHref(r.id))}">${esc(r.n)}</a><div class="k">${esc(B.TYPES[B.typeOf(r)] || '')}${a ? ` · assets ${A(a.s, esc(B.money(a.v, a.u)))} (${esc(String(a.y))})` : ''}</div></div></div>`).join('')}</div>
  <p class="foot-note"><a href="/bumd">All regional companies →</a></p>
</section>`;
}

/* the model a page is drawn from */
function model(X, c) {
  const D = X.data;
  const dki = D.dki || null;
  const groups = holdsOf(X, c);
  return {
    c, groups, owners: ownersOf(X, c), logo: logoFor(X, c.id),
    sub: String(c.s || B.TYPES[B.typeOf(c)] || '').toUpperCase(),
    dkiAsof: dki && dki.asof && (c.fs || c.bd) ? day(dki.asof) : '',
    dkiBy: dki && dki.u && c.bds && B.host(c.bds) === B.host(dki.u) ? 'BP BUMD Jakarta' : '',
  };
}

function page({ id, lang = 'en' }) {
  if (!bumdLive()) return null;
  const X = B.index();
  const key = String(id || '');
  if (!X || !X.pages.has(key) || !X.CO.has(key)) return null;
  const c = X.CO.get(key);
  const M = model(X, c);
  const p = '/bumd/' + encodeURIComponent(key);
  const kind = B.TYPES[B.typeOf(c)] || '';
  const items = M.groups.reduce((a, g) => a + g.items.length, 0);
  const owners = M.owners;
  CLIP = 0;

  /* header */
  const meta = [kind, c.f && B.FORM[c.f], c.tk ? `Listed: ${c.tk}` : '', c.p, c.c && c.c !== c.p ? c.c : ''].filter(Boolean);
  const parent = X.parentOf.get(c.id);
  const facts = [
    parent ? ['Parent', A(B.hrefOf(parent), esc(B.nameOf(parent)))] : null,
    c.ad ? ['Address', esc(clean(c.ad))] : null,
    Array.isArray(c.lb) && c.lb.length ? ['Legal basis', c.lb.map((x) => esc(clean(x))).join('<br>')] : null,
  ].filter(Boolean);
  const eyebrow = c.jv ? 'A REGION’S MINORITY STAKE' : c.sub ? 'SUBSIDIARY OF A REGIONAL STATE COMPANY' : 'REGIONAL STATE COMPANY · BUMD';
  const disc = M.logo ? `<span class="cm-disc"><img src="${esc(M.logo)}" width="76" height="76" alt="${esc(c.n)} logo"></span>` : `<span class="cm-disc mg" aria-hidden="true">${esc(initials(c.n))}</span>`;
  const links = [`<a class="chip" href="/bumd#c-${esc(encodeURIComponent(c.id))}">Its card on /bumd</a>`];
  if (c.w && /^https?:\/\//.test(c.w)) links.push(`<a class="chip" href="${esc(c.w)}" target="_blank" rel="noopener">${esc(B.host(c.w) || 'Website')} ↗</a>`);
  const hero = `<section class="hero" style="padding-bottom:26px">
  <a class="cm-back" href="/bumd">← All regional companies</a>
  <div class="eyebrow"><span class="sq"></span>${esc(eyebrow)}${c.p ? ' · ' + esc(String(c.p).toUpperCase()) : ''}</div>
  <div class="cm-id">${disc}<div style="min-width:0"><h1>${esc(c.n)}</h1>${c.l && c.l !== c.n ? `<p class="cm-legal">${esc(c.l)}</p>` : ''}</div></div>
  <div class="cm-meta">${meta.map((x) => `<span>${esc(x)}</span>`).join('')}${c.st ? `<span class="st">${esc(B.STATUS[c.st] || c.st)}</span>` : ''}</div>
  ${c.d ? `<p class="sub">${esc(c.d)}</p>` : ''}
  ${facts.length ? `<dl class="cm-facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
  <div class="chips" style="margin-top:18px">${links.join('')}</div>
</section>`;

  /* the map */
  const known = owners.filter((o) => isNum(o.s));
  const keyTxt = [
    owners.length ? (known.length ? 'Band width = each owner’s stake as published; a stake too small to see still gets a thin band, and its label gives the real figure.' : 'No stakes are published, so each owner gets an equal band.') : '',
    owners.length && known.length && 100 - known.reduce((a, o) => a + o.s, 0) > 0.015 ? '<span class="rs"></span> Dashed = shares the published stakes do not cover.' : '',
    owners.some((o) => !isNum(o.s)) && known.length ? 'A pale band is an owner whose stake is not published; it is not to scale.' : '',
    items ? '<span class="wide-only">Lines to the right show what it holds and does; they carry no money.</span> Everything is listed below with its source.' : '',
  ].filter(Boolean).join(' ');
  const pOwn = phoneOwnersSvg(M), pHold = phoneHoldsSvg(M);
  const mapSec = `<section class="cm-wrap" id="map">
  <div class="eyebrow"><span class="sq"></span>WHO OWNS IT, WHAT IT HOLDS</div>
  <div class="cm-wide">${wideSvg(M)}</div>
  <div class="cm-phone"><div class="cm-ph"><b>${esc(c.n)}</b> <span>${owners.length ? `owned by ${owners.length === 1 ? esc(owners[0].name) : `${owners.length} owners`}` : 'owners not published'}</span></div>${pOwn || '<p class="cm-none">Owners not published.</p>'}${pHold ? `<div class="cm-ph2">What it holds and does</div>${pHold}` : ''}</div>
  ${keyTxt ? `<p class="cm-key">${keyTxt}</p>` : ''}
</section>`;

  const body = `\n<style>\n${STYLE}</style>${hero}${mapSec}${figuresSection(M)}${boardSection(M)}${listsSection(M)}${sourcesSection(M)}${moreSection(X, c)}`;

  /* search: title, description, structured data, and the thin-page rule */
  const hasFs = !!(c.fs && Array.isArray(c.fs.y) && c.fs.y.filter((_, i) => ['a', 'r', 'p', 'e'].some((k) => Array.isArray(c.fs[k]) && isNum(c.fs[k][i]))).length > 1);
  const hasBd = Array.isArray(c.bd) && c.bd.some((x) => x && x.n);
  const rich = [hasFs, hasBd, items > 0, owners.length >= 2].filter(Boolean).length;
  const parts = [owners.length ? 'owners' : '', hasFs || (c.fin && [c.fin.a, c.fin.r, c.fin.p].some(isNum)) ? 'figures' : '', hasBd ? 'board' : '', items ? 'ties' : ''].filter(Boolean);
  const partsTxt = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || 'profile';
  /* a BUMD's subsidiary and a minority-stake company are not BUMD themselves */
  const tag = c.jv || c.sub ? '' : ' (BUMD)';
  const title = SCHEMA.fitTitle([
    `${c.n}${tag}: ${partsTxt} — 1001startup.id`,
    `${c.n}: ${partsTxt} — 1001startup.id`,
    `${c.n}${tag} — 1001startup.id`,
    `${c.n} — 1001startup.id`,
  ]);
  const topOwn = owners.slice(0, 2).map((o) => `${o.name}${isNum(o.s) ? ` (${stakeTxt(o.s)})` : ''}`).join(' and ') + (owners.length > 2 ? ` and ${owners.length - 2} more` : '');
  const la = latestAssets(c), f = c.fin;
  const figTxt = la ? `assets ${B.money(la.v, la.u)} (${la.y})` : '';
  const pTxt = f && isNum(f.p) ? `${f.p < 0 ? 'net loss' : 'net profit'} ${B.money(Math.abs(f.p), f.u)} (FY${f.y})` : '';
  const cnt = M.groups.map((g) => `${g.items.length} ${g.key === 'subs' ? (g.items.length === 1 ? 'subsidiary' : 'subsidiaries') : g.key === 'stakes' ? (g.items.length === 1 ? 'stake' : 'stakes') : g.key === 'ops' ? (g.items.length === 1 ? 'joint operation' : 'joint operations') : ''}`).filter((x) => !/^\d+ $/.test(x));
  const tiesN = M.groups.filter((g) => g.rel).reduce((a, g) => a + g.items.length, 0);
  if (tiesN) cnt.push(`${tiesN} ${tiesN === 1 ? 'tie' : 'ties'}`);
  /* "a regional bank in Jawa Barat", "a subsidiary of Jakpro in DKI Jakarta (light rail operation)" */
  const ty = B.typeOf(c), noun = { bpd: 'regional bank', bpr: 'rural bank', pdam: 'water utility' }[ty];
  const where = c.p ? ` in ${c.p}` : '';
  const sector = c.s ? ` (${String(c.s).replace(/\s*\(([^)]*)\)/g, ', $1')})` : '';
  /* a minority stake reads from the region's side: "in which Jakarta province holds 26.25%" */
  const reg = c.jv ? owners.find((o) => /\b(province|regency|city)$/i.test(o.name)) : null;
  const leadOf = (what) => `${c.l || c.n}, ` + (c.jv ? (reg ? `in which ${reg.name} holds a minority stake${isNum(reg.s) ? ` of ${stakeTxt(reg.s)}` : ''}` : `a company${where} in which a region holds a minority stake`)
    : parent ? `a subsidiary of ${B.nameOf(parent)}${where}${noun ? '' : what}`
      : noun ? `a ${noun}${where}` : `a regional state company${where}${what}`);
  const Fig = figTxt ? figTxt[0].toUpperCase() + figTxt.slice(1) : '';
  const own = owners.length && !c.jv ? `, owned by ${topOwn}` : '';
  const variants = [];
  for (const what of [sector, '']) {
    const lead = leadOf(what);
    variants.push(
      `${lead}${own}.${Fig ? ` ${Fig}${pTxt ? `, ${pTxt}` : ''}.` : ''}${cnt.length ? ` ${cnt.join(', ')}.` : ''}${hasBd ? ' Board as published.' : ''} Every figure sourced.`,
      `${lead}${own}.${Fig ? ` ${Fig}${pTxt ? `, ${pTxt}` : ''}.` : ''}${cnt.length ? ` ${cnt.join(', ')}.` : ''} Every figure sourced.`,
      `${lead}${own}.${Fig ? ` ${Fig}.` : ''}${cnt.length ? ` ${cnt.join(', ')}.` : ''} Every figure sourced.`,
      `${lead}.${Fig ? ` ${Fig}${pTxt ? `, ${pTxt}` : ''}.` : ''}${cnt.length ? ` ${cnt.join(', ')}.` : ''} Every figure sourced.`,
      `${lead}.${Fig ? ` ${Fig}.` : ''}${cnt.length ? ` ${cnt.join(', ')}.` : ''}`);
  }
  variants.push(`${leadOf('')}: ${partsTxt}, each with its source.`);
  const desc = SCHEMA.fitDesc(variants);
  const url = I18N.ORIGIN + p;
  const org = {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': url + '#org', name: c.n, url: c.w && /^https?:\/\//.test(c.w) ? c.w : url, mainEntityOfPage: url,
  };
  if (c.l && c.l !== c.n) org.legalName = c.l;
  if (c.p || c.c || c.ad) org.address = Object.assign({ '@type': 'PostalAddress', addressCountry: 'ID' }, c.p ? { addressRegion: c.p } : {}, c.c && c.c !== c.p ? { addressLocality: c.c } : {}, c.ad ? { streetAddress: clean(c.ad) } : {});
  if (M.logo) org.logo = I18N.ORIGIN + M.logo;
  if (c.tk) org.tickerSymbol = c.tk;
  if (parent) org.parentOrganization = { '@type': 'Organization', name: B.nameOf(parent), url: I18N.ORIGIN + (B.pageHref(parent) || '/bumd') };
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'BUMD', path: '/bumd' }, { name: c.n, path: p }];
  return shell({
    title, desc, path: p, lang, body, translated: false, canonical: url,
    robots: rich >= 2 ? 'index, follow' : 'noindex, follow',
    ld: `<script type="application/ld+json">${JSON.stringify(org).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

/* the ids with a page, for links and the search index; empty while the switch is off */
const slugs = () => (bumdLive() ? B.slugs() : []);

module.exports = { page, slugs };
