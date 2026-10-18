'use strict';
/* /bumd — Indonesia's regional state companies (BUMD), and the joint operations (KSO), stakes and
 * loans that tie them to the BUMN groups on /bumn.
 *
 * Luca, 18 Oct 2026: "enrich the data with BUMD and its KSO", then "make pr for 1001startup.id,
 * later we combine them". The data comes from the BUMD + KSO research pass in
 * ~/projects/bumn-group-webs/bumd (regional governments' audited accounts, regional regulations,
 * annual reports, the joint-operation notes in the BUMN contractors' statements, SKK Migas,
 * Kemendagri), exported by bumd/tools/export-site.py into data/bumd.json. Only confirmed or
 * company-stated ties are in that file, each with its source. Re-running the exporter after more
 * research refreshes the page (mtime-cached, no restart).
 * Shown only while data/bumd.live exists (BUMD_PREVIEW=1 on a test port), a 404 before that. The
 * same switch adds the menu item (views/nav1001.js) and the link block in each /bumn card.
 * Client: public/js/bumd1001.js (opens the section a link points at, and the company search).
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const { bumdLive } = require('../lib/bumdlive');

const FILE = path.join(__dirname, '..', 'data', 'bumd.json');
let cache = { mtime: 0, data: null };
function load() {
  try {
    const st = fs.statSync(FILE);
    if (st.mtimeMs !== cache.mtime) cache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return cache.data;
}

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

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const when = (d) => { const m = /^(\d{4})(?:-(\d{2}))?/.exec(d || ''); return m ? (m[2] ? MON[Number(m[2]) - 1] + ' ' : '') + m[1] : ''; };
/* 99.998 shows as 99.99, never 100 (the /bumn rule) */
const pct = (v) => (v == null ? '' : (v >= 100 ? 100 : Math.floor(v * 100) / 100) + '%');
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (n) => Number(n).toLocaleString('en-US');
function money(v, u) {
  if (v == null) return '';
  const x = Math.abs(v);
  let t;
  if (u === 'US$ m') t = 'US$' + (x >= 1000 ? (x / 1000).toFixed(2) + ' bn' : x.toFixed(x >= 100 ? 0 : 1) + ' m');
  else t = x >= 1000 ? 'Rp' + (x / 1000).toFixed(x >= 10000 ? 1 : 2) + ' tn' : 'Rp' + x.toFixed(x >= 100 ? 0 : x >= 1 ? 1 : 2) + ' bn';
  return (v < 0 ? '−' : '') + t;
}
const srcA = (u, label) => (u ? `<a class="sl" href="${esc(u)}" target="_blank" rel="noopener">${esc(label || host(u))}</a>` : '');
const FORM = { perseroda: 'Perseroda', perumda: 'Perumda', pt: 'PT', pd: 'PD' };
const STATUS = { dormant: 'Not operating', liquidation: 'Being wound up', not_yet_operating: 'Not operating yet', merged: 'Merged', divested: 'Sold', ended: 'Ended' };
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

function page({ lang = 'en' }) {
  if (!bumdLive()) return null;
  const D = load();
  if (!D || !Array.isArray(D.co)) return null;
  const p = '/bumd';
  const E = D.ents || {};
  const CO = new Map(D.co.map((c) => [c.id, c]));
  const OPS = new Map((D.ops || []).map((o) => [o.id, o]));
  const nBumd = D.co.filter((c) => !c.sub).length;
  const nSub = D.co.length - nBumd;
  const asof = new Date(D.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  /* a name that links where it lives: a company on this page, a joint operation below, a BUMN card, a data centre */
  const name = (id) => {
    if (CO.has(id)) return `<a href="#c-${esc(id)}">${esc(CO.get(id).n)}</a>`;
    if (OPS.has(id)) return `<a href="#k-${esc(id)}">${esc(OPS.get(id).n)}</a>`;
    const e = E[id];
    if (!e) return esc(id);
    return e.h ? `<a href="${esc(e.h)}">${esc(e.n)}</a>` : esc(e.n);
  };
  const tieLine = (t, me) => {
    const actor = t.a === me;
    const lab = (REL[t.r] || [t.r, t.r])[actor ? 0 : 1];
    const other = actor ? t.b : t.a;
    return `<li><b>${esc(lab)}</b> ${name(other)}${t.d ? `<span class="d">${esc(t.d)}</span>` : ''}<span class="m">${t.e === 's' ? 'Company’s word' : 'Confirmed'}${t.dt ? ' · ' + esc(when(t.dt)) : ''}${t.u ? ' · ' + srcA(t.u) : ''}</span></li>`;
  };
  const tiesOf = new Map();
  for (const t of D.ties || []) for (const k of [t.a, t.b]) { if (!tiesOf.has(k)) tiesOf.set(k, []); tiesOf.get(k).push(t); }

  /* ---------- the national numbers ---------- */
  const stats = (D.stats || []).map((s) => `<div class="cell"><div class="v">${s.u ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.v)}</a>` : esc(s.v)}</div><div class="k">${esc(s.k)}</div></div>`).join('');
  const types = D.types ? `<div class="bd-types">${D.types.rows.map((r) => `<div><b>${esc(String(r[1]))}</b><span>${esc(r[0])}</span></div>`).join('')}</div>
  <p class="bd-src">Kemendagri, ${esc(D.types.as_of || '')}: ${srcA(D.types.u)}</p>` : '';
  const topMax = D.top ? Math.max(...D.top.rows.map((r) => r[1])) : 1;
  const top = D.top ? `<div class="bd-bars">${D.top.rows.map((r) => `<div class="br"><span class="l">${esc(r[0])}</span><span class="t"><i style="width:${(r[1] / topMax * 100).toFixed(1)}%"></i></span><span class="v">${esc(money(r[1], 'Rp bn'))}</span></div>`).join('')}</div>
  <p class="bd-src">Net profit, FY${esc(String(D.top.y))}, Kemendagri’s list: ${srcA(D.top.u)}</p>` : '';

  /* ---------- the state groups' side ---------- */
  const G = Object.entries(D.groups || {});
  const gMax = G.length ? G[0][1].n : 1;
  const gBars = G.slice(0, 12).map(([g, v]) => `<a class="br" href="#g-${esc(g)}"><span class="l">${esc(v.short)}</span><span class="t"><i style="width:${(v.n / gMax * 100).toFixed(1)}%"></i></span><span class="v">${num(v.n)}</span></a>`).join('');
  const gMore = G.slice(12).map(([g, v]) => `<a class="chip" href="#g-${esc(g)}">${esc(v.short)}<b>${num(v.n)}</b></a>`).join('');
  const opsOfGroup = (g) => (D.ops || []).filter((o) => (o.m || []).some((m) => m.id && E[m.id] && E[m.id].g === g));
  const opLine = (o) => {
    const mem = (o.m || []).map((m) => `${m.id ? name(m.id) : esc(m.n || '')}${m.pct != null ? ` <span class="pc">${esc(pct(m.pct))}</span>` : ''}`).join(', ');
    return `<li><b>${o.k === 'jv' ? 'Joint venture' : 'Joint operation'}</b> <a href="#k-${esc(o.id)}">${esc(o.n)}</a><span class="d">${mem}</span></li>`;
  };
  const groupBlocks = G.map(([g, v]) => {
    const ops = opsOfGroup(g);
    const opIds = new Set(ops.map((o) => o.id));
    const ties = (D.ties || []).filter((t) => (E[t.a] && E[t.a].g === g) !== (E[t.b] && E[t.b].g === g) && !opIds.has(t.a) && !opIds.has(t.b));
    const me = (t) => (E[t.a] && E[t.a].g === g ? t.a : t.b);
    const parts = [];
    if (v.ops) parts.push(`${num(v.ops)} joint operation${v.ops === 1 ? '' : 's'}`);
    if (v.co) parts.push(`${num(v.co)} regional compan${v.co === 1 ? 'y' : 'ies'}`);
    return `<details class="bd-g" id="g-${esc(g)}"><summary><b>${esc(v.short)}</b><span>${num(v.n)} ties${parts.length ? ' · ' + parts.join(' · ') : ''}</span></summary>
<ul class="bd-t">${ops.map(opLine).join('')}${ties.map((t) => tieLine(t, me(t))).join('')}</ul>
${v.card ? `<p class="bd-src"><a href="/bumn#${esc(g)}">${esc(v.short)} on /bumn →</a></p>` : ''}</details>`;
  }).join('');

  /* ---------- by province ---------- */
  const byProv = new Map();
  for (const c of D.co) { const k = c.p || 'Not stated'; if (!byProv.has(k)) byProv.set(k, []); byProv.get(k).push(c); }
  const provs = (D.prov || []).map((r) => r[0]).filter((k) => byProv.has(k));
  const coRow = (c) => {
    /* the biggest holders first; a company owned by many regions (Askrida, Jamkrida) shows six and a count */
    const O = (c.o || []).slice().sort((x, y) => (y.s || 0) - (x.s || 0));
    const own = O.slice(0, 6).map((o) => `${esc(o.g)}${o.s != null ? ' ' + (o.u ? srcA(o.u, pct(o.s)) : esc(pct(o.s))) : ''}`).join(', ') + (O.length > 6 ? ` and ${O.length - 6} more` : '');
    const f = c.fin;
    const figs = f ? [f.a != null ? `assets ${money(f.a, f.u)}` : '', f.r != null ? `revenue ${money(f.r, f.u)}` : '', f.p != null ? `${f.p < 0 ? 'net loss' : 'net profit'} ${money(Math.abs(f.p), f.u)}` : ''].filter(Boolean).join(' · ') : '';
    const t = tiesOf.get(c.id) || [];
    const parent = c.sub ? (D.ties || []).find((x) => x.r === 'owns' && x.b === c.id) : null;
    return `<div class="bd-co${c.sub ? ' sub' : ''}" id="c-${esc(c.id)}">
<div class="nm">${esc(c.n)}${c.f && FORM[c.f] ? `<span class="lf">${esc(FORM[c.f])}</span>` : ''}${c.tk ? `<span class="lf">${esc(c.tk)}</span>` : ''}${c.st ? `<span class="lf st">${esc(STATUS[c.st] || c.st)}</span>` : ''}</div>
${c.l && c.l !== c.n ? `<div class="lg">${esc(c.l)}</div>` : ''}
<div class="ow"><span>${parent ? `Subsidiary of ${name(parent.a)}` : own ? `Owned by ${own}` : ''}</span>${c.s ? `<span class="sx">${esc(c.s)}${c.c ? ' · ' + esc(c.c) : ''}</span>` : ''}</div>
${figs ? `<div class="fg">FY${esc(String(f.y))}: ${esc(figs)} ${srcA(f.s)}</div>` : ''}
${c.d ? `<p class="d">${esc(c.d)}</p>` : ''}
${t.length ? `<ul class="bd-t">${t.map((x) => tieLine(x, c.id)).join('')}</ul>` : ''}
<div class="m">${(c.src || []).map((u) => srcA(u)).join(' · ')}${c.w ? ` · <a class="sl" href="${esc(c.w)}" target="_blank" rel="noopener">website</a>` : ''}</div>
</div>`;
  };
  const provChips = provs.map((k) => `<a class="chip" href="#p-${esc(slug(k))}">${esc(k)}<b>${byProv.get(k).length}</b></a>`).join('');
  const provBlocks = provs.map((k) => `<details class="bd-p" id="p-${esc(slug(k))}"><summary><b>${esc(k)}</b><span>${byProv.get(k).length} compan${byProv.get(k).length === 1 ? 'y' : 'ies'}</span></summary>
<div class="bd-cos">${byProv.get(k).map(coRow).join('')}</div></details>`).join('');

  /* ---------- joint operations and ventures ---------- */
  const opsRows = (D.ops || []).map((o) => {
    const mem = (o.m || []).map((m) => `${m.id ? name(m.id) : esc(m.n || '')}${m.pct != null ? ` <span class="pc">${esc(pct(m.pct))}</span>` : ''}`).join('<br>');
    const work = (tiesOf.get(o.id) || []).filter((t) => t.a === o.id && (t.r === 'works_for' || t.r === 'operates_for')).map((t) => name(t.b));
    const val = o.v && o.v.amount ? money(o.v.unit === 'Rp tn' ? o.v.amount * 1000 : o.v.amount, o.v.unit === 'US$ m' ? 'US$ m' : 'Rp bn') : '';
    return `<tr id="k-${esc(o.id)}"><td class="co"><b>${esc(o.n)}</b>${o.l && o.l !== o.n ? `<div class="mu">${esc(o.l)}</div>` : ''}<div class="mu">${o.k === 'jv' ? 'Joint venture' : 'Joint operation'}${o.st ? ' · ' + esc(STATUS[o.st] || o.st) : ''}${o.per ? ' · ' + esc(o.per) : ''}</div></td>
<td class="mu">${mem}</td><td class="mu">${o.d ? esc(o.d) : ''}${work.length ? `${o.d ? ' ' : ''}For ${work.join(', ')}.` : o.cl ? `${o.d ? ' ' : ''}For ${esc(o.cl)}.` : ''}${val ? ` <span class="pc">${esc(val)}</span>` : ''}</td>
<td class="mu">${(o.src || []).slice(0, 2).map((u) => srcA(u)).join('<br>')}</td></tr>`;
  }).join('');

  /* ---------- data-centre ties ---------- */
  const dcTies = (D.ties || []).filter((t) => (E[t.a] && E[t.a].dc) || (E[t.b] && E[t.b].dc));
  const dcList = dcTies.map((t) => tieLine(t, E[t.a] && E[t.a].dc ? t.b : t.a)).join('');

  const nOps = (D.ops || []).length;
  const body = `
<style>
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
.bd-bars .l{font-size:13.5px;line-height:1.25;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bd-bars .t{height:12px;background:#F1F1EE;position:relative;display:block}
.bd-bars .t i{position:absolute;left:0;top:0;bottom:0;background:#3F3F46;display:block}
.bd-bars .v{font:400 12.5px/1 'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}
@media(max-width:520px){.bd-bars .br{grid-template-columns:104px minmax(0,1fr) 64px;gap:8px}}
.bd-g,.bd-p{border:1px solid #E7E7E7;border-top:0}
.bd-g:first-of-type,.bd-p:first-of-type{border-top:1px solid #E7E7E7}
.bd-g summary,.bd-p summary{cursor:pointer;display:flex;justify-content:space-between;gap:12px;align-items:baseline;padding:12px 14px;list-style:none}
.bd-g summary::-webkit-details-marker,.bd-p summary::-webkit-details-marker{display:none}
.bd-g summary b,.bd-p summary b{font-weight:600;font-size:15px}
.bd-g summary b::before,.bd-p summary b::before{content:"+";display:inline-block;width:16px;font:400 13px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.bd-g[open] summary b::before,.bd-p[open] summary b::before{content:"−"}
.bd-g summary span,.bd-p summary span{font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73;text-align:right}
.bd-g summary:hover,.bd-p summary:hover{background:#FAFAFA}
.bd-g summary:focus-visible,.bd-p summary:focus-visible{outline:2px solid #000;outline-offset:-2px}
.bd-g>.bd-t,.bd-g>.bd-src{padding:0 14px 12px 30px}
.bd-t{list-style:none;display:grid;gap:0}
.bd-t li{padding:7px 0;border-top:1px solid #F4F4F4;font-size:13.5px;line-height:1.4;display:grid;gap:2px;min-width:0}
.bd-t li>b{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bd-t a,.bd-co .ow a,.bd-ops a{color:#000;text-decoration:none;border-bottom:1px solid #C9C9CF}
.bd-t .d{color:#3F3F46;font-size:12.5px;line-height:1.45;overflow-wrap:anywhere}
.bd-t .m,.bd-co>.m{font:400 10.5px/1.4 'IBM Plex Mono',monospace;color:#9A9AA0;letter-spacing:.02em;overflow-wrap:anywhere}
.bd-t .m a,.bd-co>.m a,.bd-co .fg a,.bd-co .ow a.sl{color:#2A6E9F;border-bottom-color:#D9E3EC}
.pc{font:400 11.5px/1 'IBM Plex Mono',monospace;color:#52525B;white-space:nowrap}
.bd-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:4px 0 12px}
.bd-tools input{font:500 14px/1 'Overused Grotesk',system-ui,sans-serif;padding:9px 10px;border:1px solid #E7E7E7;width:280px;max-width:100%;border-radius:0}
.bd-tools input:focus-visible{outline:2px solid #000;outline-offset:1px}
.bd-tools span{font:400 11px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.bd-cos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;padding:0 14px 8px 30px}
@media(max-width:860px){.bd-cos{grid-template-columns:minmax(0,1fr);padding-left:14px}}
.bd-co{padding:12px 0;border-top:1px solid #F1F1F1;display:grid;gap:4px;align-content:start;min-width:0}
.bd-co.sub{padding-left:12px;border-left:2px solid #F1F1F1}
.bd-co .nm{font-weight:650;font-size:15px;line-height:1.25;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.bd-co .lf{font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73;border:1px solid #E7E7E7;padding:3px 5px}
.bd-co .lf.st{color:#7A5200;border-color:#F1E3BF;background:#FFF8E6}
.bd-co .lg{color:#6B6B73;font-size:12.5px;line-height:1.3}
.bd-co .ow{font-size:13px;line-height:1.4;color:#3F3F46;display:grid;gap:1px}
.bd-co .sx{color:#6B6B73;font-size:12.5px}
.bd-co .fg{font:400 11.5px/1.45 'IBM Plex Mono',monospace;color:#3F3F46}
.bd-co .d{color:#3F3F46;font-size:13px;line-height:1.5}
.bd-co .bd-t li{padding:6px 0}
.bd-co[hidden]{display:none}
.bd-ops td.co{min-width:220px}
.bd-ops td.co b{font-weight:600}
.bd-ops tr:target td{background:#FFFBEA}
.bd-co:target{background:#FFFBEA}
.bd-dc .bd-t li{padding:9px 0}
.bd-m{border:1px solid #E7E7E7;padding:0 18px}
.bd-m summary{cursor:pointer;font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:16px 0}
.bd-m[open] summary{border-bottom:1px solid #F1F1F1;margin-bottom:12px}
.bd-m h3{font-size:16px;font-weight:600;margin:14px 0 4px}
.bd-m p{color:#52525B;font-size:14.5px;line-height:1.6;max-width:88ch;margin-bottom:10px}
.bd-p,.bd-g{content-visibility:auto;contain-intrinsic-size:auto 52px}
</style>
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>REGIONAL STATE COMPANIES · BUMD · ${esc(asof.toUpperCase())}</div>
  <h1>Indonesia’s regional state companies, mapped</h1>
  <p class="sub">Provinces, regencies and cities own ${D.national ? num(D.national) : 'about a thousand'} companies: regional banks, water utilities, oil and gas holders, ports, markets and more. Here are ${num(nBumd)} of them and ${num(nSub)} of their subsidiaries: who owns them, what they report, and the joint operations (KSO), stakes and loans that tie them to the state groups on <a href="/bumn">/bumn</a>.</p>
</section>
<div class="stats">${stats}</div>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>WHAT THE REGIONS OWN</div>
  <div class="bd-two">
    <div>${types}</div>
    <div>${D.top ? `<p class="lede" style="margin-bottom:8px">The ${D.top.rows.length} most profitable in ${esc(String(D.top.y))}; ${D.top.rows.filter((r) => /^(Bank|BPD)\b/.test(r[0])).length} of them are regional banks.</p>` : ''}${top}</div>
  </div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>TIES TO THE STATE GROUPS</div>
  <p class="lede">Joint operations, stakes, loans and contracts between each BUMN group and the regional side. The contractors lead because they build big projects as joint operations, and their statements list every one. Open a group for its list.</p>
  <div class="bd-two">
    <div class="bd-bars">${gBars}</div>
    <div>${gMore ? `<div class="chips" style="margin-top:0">${gMore}</div>` : ''}</div>
  </div>
  <div style="margin-top:18px">${groupBlocks}</div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>BY PROVINCE</div>
  <p class="lede">Every regional company we have mapped, under the province it sits in, with its owners and their stakes, its latest reported figures and its ties. Figures are in rupiah as each company reports them.</p>
  <div class="bd-tools"><input id="bd-q" type="search" placeholder="Find a company or a region" aria-label="Find a company or a region"><span id="bd-count"></span></div>
  <div class="chips" style="margin:0 0 14px">${provChips}</div>
  <div id="bd-provs">${provBlocks}</div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>JOINT OPERATIONS AND JOINT VENTURES</div>
  <p class="lede">${num(nOps)} joint operations (KSO) and joint ventures, with their members and shares. A joint operation shares the work and the money of one contract; a joint venture is a company of its own.</p>
  <details class="bd-m" id="bd-all-ops"><summary>All ${num(nOps)} joint operations and joint ventures</summary>
  <div class="tablewrap bd-ops" style="margin-bottom:18px"><table><thead><tr><th>Name</th><th>Members</th><th>What it does</th><th>Source</th></tr></thead><tbody>${opsRows}</tbody></table></div></details>
</section>
${dcTies.length ? `<section class="wrap bd-dc">
  <div class="eyebrow"><span class="sq"></span>TIES TO DATA CENTRES</div>
  <p class="lede">${num(dcTies.length)} ties between the regional side and the companies and campuses on <a href="/data-center">/data-center</a>.</p>
  <ul class="bd-t">${dcList}</ul>
</section>` : ''}
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>HOW THIS WAS MADE</div>
  <details class="bd-m"><summary>Sources, evidence and coverage</summary>
    <h3>Sources</h3>
    <p>Regional governments’ audited accounts, whose note on capital holdings lists every company a province, regency or city owns and its stake; regional regulations that found a company or inject capital; the companies’ own annual reports and statements; the notes on joint operations in the BUMN contractors’ statements; SKK Migas for the oil and gas stakes; Kemendagri for the national figures.</p>
    <h3>Evidence</h3>
    <p>A tie is shown only when a filing, a regulator or both parties confirm it, or when one party states it on its own site or in its own release (marked “Company’s word”). Ties we could only infer are left out. Each one links to the page it was read from.</p>
    <h3>Coverage</h3>
    <p>${D.national ? `Kemendagri counts ${num(D.national)} BUMD; ${num(nBumd)} are listed here so far.` : `${num(nBumd)} BUMD are listed here so far.`} Coverage is uneven, and many regency and city companies are not listed yet. Figures are the latest year each company published, shown with the year.</p>
  </details>
</section>
<script src="/js/bumd1001.js?v=${ver()}" defer></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'BUMN', path: '/bumn' }, { name: 'BUMD', path: p }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'Indonesia’s regional state companies (BUMD) and their joint operations',
    description: `${nBumd} Indonesian regional-government companies (BUMD) with owners and stakes, latest figures, and ${nOps} joint operations and joint ventures tying them to the BUMN groups, from public sources.`,
    url: I18N.ORIGIN + p, dateModified: D.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: 'Indonesia’s regional state companies (BUMD), mapped — 1001startup.id',
    desc: `${nBumd} BUMD owned by Indonesia's provinces, regencies and cities, with their owners, figures and the ${nOps} joint operations and ventures that tie them to the BUMN groups. ${asof}.`,
    path: p, lang, body, translated: false,
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { page, load, groupCounts };
