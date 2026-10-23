'use strict';
/* Shared by /bumd (views/bumd1001.js) and /bumd/<slug> (views/bumdco1001.js): the data file, the
 * logo manifest, number formatting, the relation words, and which companies get a page of their own.
 *
 * data/bumd.json   ~/projects/bumn-group-webs/bumd/tools/export-site.py, then tools/dki-merge.py
 *                  (Jakarta's official BP BUMD records: figures 2022-2025, boards, stakes)
 * data/bumd-logos.json  ~/projects/bumn-group-webs/bumd/tools/bumd-logos.py ({id: {src, from, kind}})
 * Both are mtime-cached: re-running the scripts refreshes the pages without a restart.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');

function cached(file) {
  let c = { mtime: 0, data: null };
  return () => {
    try {
      const st = fs.statSync(file);
      if (st.mtimeMs !== c.mtime) c = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
    } catch (e) { /* keep the last good copy */ }
    return c.data;
  };
}
const load = cached(path.join(__dirname, '..', 'data', 'bumd.json'));
const loadLogos = cached(path.join(__dirname, '..', 'data', 'bumd-logos.json'));
const logoOf = (id) => { const L = loadLogos(); return (L && L[id] && L[id].src) || null; };

/* ---------- words ---------- */
const FORM = { perseroda: 'Perseroda', perumda: 'Perumda', pt: 'PT', pd: 'PD' };
const STATUS = { dormant: 'Not operating', liquidation: 'Being wound up', not_yet_operating: 'Not operating yet', merged: 'Merged', divested: 'Sold', ended: 'Ended' };
/* Kemendagri's own four kinds (the "What the regions own" tiles); jv = a company where regions hold a
   minority stake (BP BUMD Jakarta's "perusahaan patungan" list), shown apart from the BUMD themselves */
const TYPES = { bpd: 'Regional bank (BPD)', bpr: 'Rural bank (BPR)', pdam: 'Water utility (PDAM)', other: 'Other business', jv: 'Minority stake' };
function typeOf(c) {
  if (!c) return 'other';
  if (c.jv) return 'jv';
  if (c.ty) return c.ty;
  const t = `${c.s || ''} ${c.l || ''} ${c.n || ''}`;
  if (/\bBPD\b|regional development bank|Bank Pembangunan Daerah/i.test(t)) return 'bpd';
  if (/\bBPRS?\b|rural bank|Perkreditan Rakyat|Pembiayaan Rakyat/i.test(t)) return 'bpr';
  if (/\bPDAM\b|drinking water|Air Minum|water utilit/i.test(t)) return 'pdam';
  return 'other';
}
/* [as seen from the actor, as seen from the other side] */
const REL = {
  owns: ['Owns', 'Owned by'], invested_in: ['Stake in', 'Stake held by'], joint_venture: ['Joint venture with', 'Joint venture with'],
  kso_member: ['Joint operation', 'Joint operation'], works_for: ['Works for', 'Contractor'], operates_for: ['Runs it for', 'Run by'],
  participating_interest: ['Oil and gas stake', 'Stake held by'], runs: ['Runs', 'Run by'], tenant_of: ['Tenant of', 'Landlord of'],
  supplies_power: ['Power to', 'Power from'], supplies_network: ['Network to', 'Network from'], supplies_water: ['Water to', 'Water from'],
  sells_land: ['Land to', 'Land from'], built: ['Built', 'Built by'], supplies: ['Supplies', 'Supplied by'], lends_to: ['Loan to', 'Loan from'],
  underwrites: ['Underwrites', 'Underwritten by'], guarantees: ['Guarantees', 'Guaranteed by'], insures: ['Insures', 'Insured by'],
  partner: ['Partner', 'Partner'], director_of: ['Board seat at', 'Board member'], commissioner_of: ['Board seat at', 'Board member'],
  merged_into: ['Merged into', 'Absorbed'], sold_to: ['Sold to', 'Bought from'], regulates: ['Regulates', 'Regulated by'], brand_of: ['Brand of', 'Brand'],
};
const relWord = (t, me) => (REL[t.r] || [t.r, t.r])[t.a === me ? 0 : 1];

/* ---------- numbers ---------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const when = (d) => { const m = /^(\d{4})(?:-(\d{2}))?/.exec(d || ''); return m ? (m[2] ? MON[Number(m[2]) - 1] + ' ' : '') + m[1] : ''; };
/* 99.998 shows as 99.99, never 100 (the /bumn rule); the 1e-9 keeps 4.1 from flooring to 4.09 */
const pct = (v) => (v == null ? '' : (v >= 100 ? 100 : Math.floor(v * 100 + 1e-9) / 100) + '%');
const num = (n) => Number(n).toLocaleString('en-US');
/* v in the row's unit (fin.u / fs.u: 'Rp bn' unless it says 'US$ m') */
function money(v, u) {
  if (v == null) return '';
  const x = Math.abs(v);
  let t;
  if (u === 'US$ m') t = 'US$' + (x >= 1000 ? (x / 1000).toFixed(2) + ' bn' : x.toFixed(x >= 100 ? 0 : 1) + ' m');
  else t = x >= 1000 ? 'Rp' + (x / 1000).toFixed(x >= 10000 ? 1 : 2) + ' tn' : 'Rp' + x.toFixed(x >= 100 ? 0 : x >= 1 ? 1 : 2) + ' bn';
  return (v < 0 ? '−' : '') + t;
}
const srcA = (u, label) => (u ? `<a class="sl" href="${esc(u)}" target="_blank" rel="noopener">${esc(label || host(u))}</a>` : '');

/* ---------- who is linked to whom (built once per data file) ---------- */
let IX = { data: null };
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
function index(D = load()) {
  if (!D || !Array.isArray(D.co)) return null;
  if (IX.data === D) return IX;
  const CO = new Map(D.co.map((c) => [c.id, c]));
  const OPS = new Map((D.ops || []).map((o) => [o.id, o]));
  const tiesOf = new Map();
  for (const t of D.ties || []) for (const k of new Set([t.a, t.b])) push(tiesOf, k, t);
  const opsOf = new Map();  /* company id -> the joint operations / ventures it is a member of */
  for (const o of D.ops || []) for (const m of o.m || []) if (m.id) push(opsOf, m.id, { o, pct: m.pct, u: m.u });
  const subsOf = new Map(), parentOf = new Map();
  for (const t of D.ties || []) if (t.r === 'owns' && CO.has(t.a) && CO.has(t.b) && CO.get(t.b).sub) { push(subsOf, t.a, t.b); parentOf.set(t.b, t.a); }
  const holds = new Map();  /* company id -> other rows it holds a stake in (owner entries that point at a row);
                               its own subsidiaries are listed by subsOf, not again here */
  for (const c of D.co) {
    for (const o of c.o || []) {
      if (o.id && CO.has(o.id) && parentOf.get(c.id) !== o.id) push(holds, o.id, { id: c.id, s: o.s, u: o.u, dt: o.dt });
    }
  }
  /* a company gets /bumd/<id> when there is something to draw beyond its card: more than one owner, a
     subsidiary or stake of its own, a joint operation, a tie, or figures for more than one year (the
     /bumn rule: groups with nothing to draw get no map and no link) */
  const pages = new Set();
  for (const c of D.co) {
    const n = (c.o || []).length > 1 || subsOf.has(c.id) || holds.has(c.id) || opsOf.has(c.id) || tiesOf.has(c.id) ||
      parentOf.has(c.id) || !!(c.fs && (c.fs.y || []).length > 1);
    if (n) pages.add(c.id);
  }
  IX = { data: D, CO, OPS, tiesOf, opsOf, subsOf, parentOf, holds, pages };
  return IX;
}
const pageHref = (id) => { const X = index(); return X && X.pages.has(id) ? '/bumd/' + encodeURIComponent(id) : null; };
const slugs = () => { const X = index(); return X ? [...X.pages] : []; };
/* where a name links: a regional company's page (or its card on /bumd), a BUMN card, a data centre */
function hrefOf(id) {
  const X = index();
  if (!X) return null;
  if (X.CO.has(id)) return pageHref(id) || '/bumd#c-' + encodeURIComponent(id);
  if (X.OPS.has(id)) return '/bumd#k-' + encodeURIComponent(id);
  const e = (X.data.ents || {})[id];
  return (e && e.h) || null;
}
function nameOf(id) {
  const X = index();
  if (!X) return id;
  const c = X.CO.get(id) || X.OPS.get(id) || (X.data.ents || {})[id];
  return (c && c.n) || id;
}

module.exports = { load, loadLogos, logoOf, FORM, STATUS, TYPES, typeOf, REL, relWord, host, when, pct, num, money, srcA, index, pageHref, slugs, hrefOf, nameOf };
