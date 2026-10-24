'use strict';
/* /data-center — who powers Indonesia's data centres, and the companies around them.
 *
 * Luca, 16 Oct 2026: a 2 x 4 power matrix (grid / behind-the-meter / off-grid / hybrid
 * by greenfield / brownfield) like a US reference image, filled with Indonesian projects
 * and their vendors; 17 Oct: "start working for 1001startup.id/datacenter ... including
 * the supply chain mapping like we have done with the dtech in cnc.vantis.sh".
 * Data = data/datacenter.json + data/dc-webs/<slug>.json from scripts/dc-build.py
 * (research in ~/projects/indonesia-dc-power-map), read per request (mtime cache), so a
 * rebuild needs no restart. Client: public/js/datacenter1001.js (filters, sort) and the
 * shared /js/cncweb.js (company-web wires); CSP is script-src 'self'.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const { stateSites } = require('./dcstate1001');

const DATA = path.join(__dirname, '..', 'data', 'datacenter.json');
const WEBS = path.join(__dirname, '..', 'data', 'dc-webs');
let cache = { mtime: 0, data: null };
function load() {
  try {
    const st = fs.statSync(DATA);
    if (st.mtimeMs !== cache.mtime) cache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(DATA, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return cache.data;
}
const webCache = {};
function loadWeb(slug) {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return null;
  const f = path.join(WEBS, slug + '.json');
  try {
    const st = fs.statSync(f);
    const c = webCache[slug];
    if (!c || c.mtime !== st.mtimeMs) webCache[slug] = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(f, 'utf8')) };
    return webCache[slug].data;
  } catch (e) { return webCache[slug] ? webCache[slug].data : null; }
}
const ver = (file) => { try { return String(Math.floor(fs.statSync(path.join(__dirname, '..', 'public', 'js', file)).mtimeMs / 1000)); } catch (e) { return '0'; } };
/* Risk matrix (Luca, 17 Oct 2026: a US "who carries which risk" chart, made for Indonesia).
 * Curated by hand in data/dc-risk.json from the sourced ties on this page; read per request. */
const RISK = path.join(__dirname, '..', 'data', 'dc-risk.json');
let riskCache = { mtime: 0, data: null };
function loadRisk() {
  try {
    const st = fs.statSync(RISK);
    if (st.mtimeMs !== riskCache.mtime) riskCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(RISK, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return riskCache.data;
}

const COLS = [
  ['grid', 'Grid-connected', 'PLN or PLN Batam feed; diesel only as standby'],
  ['btm', 'Behind-the-meter', 'Own generation inside the fence that runs every day'],
  ['offgrid', 'Off-grid', 'No utility connection at all'],
  ['hybrid', 'Hybrid renewable', 'PLN plus a solar, hydro or battery source built for the site'],
];
const ROWS = [['gf', 'Greenfield'], ['bf', 'Brownfield']];
const STATUS = { operating: 'ok', 'under construction': 'part', halted: 'bad', announced: 'only', cancelled: 'bad' };
const CONF = { confirmed: ['ok', 'Confirmed'], reported: ['part', 'Reported'], claim: ['only', 'Site inferred'] };
const REGION = { jkt: 'Greater Jakarta and West Java', batam: 'Batam and Riau', other: 'Central Java, Bali and other' };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'source'; } };
const a = (u, t, q) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener nofollow"${q ? ` title="${esc(q)}"` : ''}>${esc(t || host(u))}</a>` : '');
const initials = (n) => String(n || '?').split(/[\s/&+()-]+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const mark = (src, name, cls = 'mk') => (src ? `<img class="${cls}" src="${esc(src)}" alt="" width="18" height="18" loading="lazy">` : `<span class="${cls} mono-mk" aria-hidden="true">${esc(initials(name))}</span>`);
const ownMark = (n) => `<span class="mk own own-${esc(String(n).split(' ')[1] || 'x').toLowerCase()}" aria-hidden="true"></span>`;
const fromMark = (f) => (f.own ? ownMark(f.n) : mark(f.logo, f.n));

function cellHtml(D, key, c, r, ci, ri) {
  const meta = D.cells[key] || {};
  const ps = D.projects.filter((p) => p.cell === key);
  const ops = new Map();
  (meta.featured || []).forEach((n) => ps.forEach((p) => { if (p.op === n) { if (!ops.has(n)) ops.set(n, []); ops.get(n).push(p); } }));
  ps.forEach((p) => { if (!ops.has(p.op)) ops.set(p.op, []); if (!ops.get(p.op).includes(p)) ops.get(p.op).push(p); });
  const LIMIT = 12;
  const chips = [...ops.entries()].slice(0, LIMIT).map(([op, lst]) => {
    const p0 = lst[0];
    const cls = ['op'];
    if (lst.every((x) => x.presumed)) cls.push('presumed');
    if (lst.every((x) => x.plan || x.status === 'announced')) cls.push('plan');
    const note = lst.length === 1 && p0.note ? `<i>${esc(p0.note)}</i>` : '';
    const n = lst.length > 1 ? `<em>${lst.length}</em>` : '';
    return `<a class="${cls.join(' ')}" href="#p-${esc(p0.id)}" title="${esc(lst.map((x) => x.name).join('; '))}">${mark(p0.logo, op)}<span>${esc(op)}</span>${note}${n}</a>`;
  });
  if (ops.size > LIMIT) chips.push(`<a class="op more" href="#projects" data-cell="${esc(key)}">+${ops.size - LIMIT} more</a>`);
  const pf = new Map();
  ps.forEach((p) => p.from.forEach((f) => { const k = pf.get(f.n) || { f, n: 0 }; k.n += 1; pf.set(f.n, k); }));
  const pchips = [...pf.values()].sort((x, y) => y.n - x.n).slice(0, 5).map(({ f, n }) => `<span class="vd">${fromMark(f)}<span>${esc(f.n)}</span><em>${n}</em></span>`).join('');
  const vend = new Map();
  ps.forEach((p) => p.vendors.forEach((v) => {
    if (v.up || v.layer === 'other' || ['utility', 'IPP', 'hydro'].includes(v.cat)) return;
    const k = vend.get(v.n) || { v, n: 0 }; k.n += 1; vend.set(v.n, k);
  }));
  const vchips = [...vend.values()].sort((x, y) => y.n - x.n).slice(0, 6).map(({ v }) => `<span class="vd">${mark(v.logo, v.n)}<span>${esc(v.n)}</span></span>`).join('');
  const total = ps.reduce((s, p) => s + (p.counted_mw || 0), 0);
  const count = ps.length ? `${ps.length} project${ps.length === 1 ? '' : 's'}${total ? ` · ${Math.round(total).toLocaleString('en-US')} MW` : ''}` : '';
  return `<div class="cell col-${c} row-${r}${ps.length ? '' : ' empty'}" style="--gc:${ci + 2};--gr:${ri + 2};--mc:${ci + 1};--mr:${ri + 1}">
  <figure class="ph"><img src="/assets/dc/${esc(key)}.webp" alt="${esc(meta.alt || '')}" width="960" height="540" loading="lazy"></figure>
  <div class="cb">
    <div class="tags"><span class="t-col">${esc(COLS[ci][1])}</span><span class="t-row">${esc(ROWS[ri][1])}</span></div>
    <h3>${esc(meta.title || '')}</h3>
    <p class="cs">${esc(meta.sub || '')}</p>
    ${chips.length ? `<div class="ops">${chips.join('')}</div>` : `<p class="none">${esc(meta.empty_note || 'None found.')}</p>`}
    ${pchips ? `<div class="vends"><span class="k">Power from</span>${pchips}</div>` : ''}
    ${vchips ? `<div class="vends"><span class="k">Vendors named</span>${vchips}</div>` : ''}
    ${count ? `<a class="count" href="#projects" data-cell="${esc(key)}">${esc(count)}</a>` : ''}
  </div>
</div>`;
}

function matrix(D) {
  const head = '<div class="mx-corner" aria-hidden="true"></div>' + COLS.map(([c, t, s], i) => `<div class="mx-col col-${c}" style="--gc:${i + 2}"><b>${esc(t)}</b><small>${esc(s)}</small></div>`).join('');
  const rows = ROWS.map(([r, rt], ri) => `<div class="mx-row row-${r}" style="--gr:${ri + 2}"><b>${esc(rt)}</b></div>` + COLS.map(([c], ci) => cellHtml(D, `${r}-${c}`, c, r, ci, ri)).join('')).join('');
  return `<div class="mx" role="group" aria-label="Power model by site type">${head}${rows}</div>`;
}

function vendorItem(v) {
  const [cls, lab] = CONF[v.conf] || CONF.reported;
  const what = [v.what, v.where, v.date].filter(Boolean).join(' · ');
  return `<li>${mark(v.logo, v.n)}<div><b>${esc(v.n)}</b> <span class="cat">${esc(v.cat || '')}</span>${v.up ? '<span class="up">Behind the estate grid</span>' : ''}<small>${esc(what)}</small><span class="vs"><span class="ev ${cls}">${esc(lab)}${v.snip ? ' · snippet' : ''}</span>${a(v.u, v.t, v.q)}</span></div></li>`;
}

function projectRow(D, p) {
  const cellMeta = D.cells[p.cell] || {};
  const st = p.status ? `<span class="st ${STATUS[p.status] || 'only'}">${esc(p.status)}</span>` : '';
  const tags = [];
  if (p.tenant_of) tags.push(`<span class="tg">Tenant in ${esc(p.tenant_of)}</span>`);
  if (p.presumed) tags.push('<span class="tg dash">Power not disclosed</span>');
  else if (p.plan) tags.push('<span class="tg">Power plan only</span>');
  const layers = D.layers.map(([k, t]) => {
    const vs = p.vendors.filter((v) => v.layer === k).sort((x, y) => (x.up ? 1 : 0) - (y.up ? 1 : 0));
    return vs.length ? `<div class="ly"><span class="k">${esc(t)}</span><ul>${vs.map(vendorItem).join('')}</ul></div>` : '';
  }).join('');
  const from = p.from.map((f) => `<span class="pfrom">${fromMark(f)}${esc(f.n)}</span>`).join('');
  const cellLab = p.cell === 'unplaced' ? 'Not placed' : `${(COLS.find(([c]) => p.cell.endsWith('-' + c)) || [, ''])[1]} · ${p.cell.startsWith('gf') ? 'Greenfield' : 'Brownfield'}`;
  const vmarks = [...new Map(p.vendors.filter((v) => !v.up).map((v) => [v.n, v])).values()].slice(0, 5).map((v) => mark(v.logo, v.n)).join('');
  return `<details class="pr" id="p-${esc(p.id)}" data-region="${esc(p.region)}" data-cell="${esc(p.cell)}" data-size="${Number(p.size) || 0}" data-name="${esc((p.name + ' ' + p.op + ' ' + p.loc).toLowerCase())}">
<summary>
  <span class="c-pr">${mark(p.logo, p.op, 'mk lgm')}<span><b>${esc(p.name)}</b><small>${esc(p.op)} · ${esc(p.loc)}</small></span></span>
  <span class="c-cell mono">${esc(cellLab)}</span>
  <span class="c-mw mono">${esc(p.mw || '—')}</span>
  <span class="c-st">${st}${tags.join('')}</span>
  <span class="c-pw">${p.from.length ? esc(p.from.slice(0, 3).map((f) => f.n).join(' · ')) : (p.presumed ? 'Not disclosed' : '—')}</span>
  <span class="c-v">${vmarks}<em>${p.vendors.length || '—'}</em></span>
</summary>
<div class="pb">
  <div class="pfw"><button class="fw1001" type="button" data-fk="dc" data-fr="${esc(p.id)}" hidden>Follow</button></div>
  ${p.why ? `<p class="why">${esc(p.why)}</p>` : ''}
  <div class="pw"><span class="k">Power</span><p>${esc(p.power)}</p>${from ? `<div class="pf">${from}</div>` : ''}${p.plinks.length ? `<span class="src">${p.plinks.map((l) => a(l.u, l.t, l.q)).join('')}</span>` : ''}</div>
  ${layers ? `<div class="stack">${layers}</div>` : '<p class="none">No vendor named in a source we could open.</p>'}
  ${p.web ? `<p class="toweb"><a href="/data-center/${esc(p.web)}">Company web for ${esc(p.op)} →</a></p>` : ''}
  ${p.cell !== 'unplaced' ? `<p class="cellnote mono">${esc(cellMeta.title || '')}</p>` : ''}
</div>
</details>`;
}

function league(D) {
  const recs = new Map();
  D.projects.forEach((p) => p.vendors.forEach((v) => {
    if (v.up || v.layer === 'other' || ['utility', 'IPP', 'hydro'].includes(v.cat)) return;
    const r = recs.get(v.n) || { n: v.n, logo: v.logo, layer: v.layer, cats: new Map(), ps: new Map() };
    r.cats.set(v.cat, (r.cats.get(v.cat) || 0) + 1);
    r.ps.set(p.id, p);
    recs.set(v.n, r);
  }));
  const all = [...recs.values()];
  if (!all.length) return '';
  const mx = Math.max(...all.map((r) => r.ps.size));
  return D.layers.filter(([k]) => k !== 'other').map(([k, t]) => {
    const lst = all.filter((r) => r.layer === k).sort((x, y) => y.ps.size - x.ps.size || x.n.localeCompare(y.n));
    if (!lst.length) return '';
    return `<div class="lgp"><span class="k">${esc(t)}</span><ul>${lst.map((r) => {
      const cat = [...r.cats.entries()].sort((x, y) => y[1] - x[1]).slice(0, 2).map(([c]) => c).join(', ');
      const ps = [...r.ps.values()].map((p) => `<a href="#p-${esc(p.id)}">${esc(String(p.name).split(/ \(|, /)[0].slice(0, 34))}</a>`).join('');
      return `<li><div class="lv">${mark(r.logo, r.n)}<span><b>${esc(r.n)}</b><small>${esc(cat)}</small></span></div><div class="lb"><span class="bar" style="width:${(r.ps.size / mx * 100).toFixed(1)}%"></span><span class="num">${r.ps.size}</span></div><div class="lp">${ps}</div></li>`;
    }).join('')}</ul></div>`;
  }).join('');
}

const SHORT = { dci: 'DCI', bdx: 'BDx', neutradc: 'NeutraDC', 'digital-edge': 'Digital Edge', dayone: 'DayOne', pdg: 'PDG', 'stt-gdc': 'STT GDC', 'sinar-mas': 'SM+' };
function connectorGrid(D) {
  const C = D.connectors || [];
  const webs = (D.webs || []).map((w) => w.slug);
  if (!C.length || webs.length < 2) return '';
  const head = `<tr><th scope="col">Shared by two or more groups</th>${webs.map((s) => `<th scope="col" class="g"><a href="/data-center/${esc(s)}">${esc(SHORT[s] || s)}</a></th>`).join('')}<th scope="col" class="g">Groups</th></tr>`;
  const roles = (D.role_titles || []).filter(([k]) => C.some((c) => c.role === k));
  const body = roles.map(([k, t]) => {
    const rows = C.filter((c) => c.role === k).map((c) => {
      const cells = webs.map((s) => {
        const hit = c.webs.find((x) => x.slug === s);
        if (!hit) return '<td class="g"></td>';
        const label = `${c.name} in ${SHORT[s] || s}: ${hit.rel}`;
        return `<td class="g"><a class="cx${hit.direct ? '' : ' via'}" href="/data-center/${esc(s)}#n-${esc(hit.id)}" title="${esc(label)}" aria-label="${esc(label)}"></a></td>`;
      }).join('');
      return `<tr><th scope="row">${esc(c.name)}${c.kind === 'person' ? '<span class="pk">person</span>' : ''}</th>${cells}<td class="g n">${c.webs.length}</td></tr>`;
    }).join('');
    return `<tr class="rh"><th colspan="${webs.length + 2}">${esc(t)}</th></tr>${rows}`;
  }).join('');
  return `<div class="cxwrap"><table class="cxg"><thead>${head}</thead><tbody>${body}</tbody></table></div>
<p class="cxkey mono"><span><i class="cx"></i>tied to the group directly</span><span><i class="cx via"></i>through one of its companies, sites or people</span><span>tap a square to open that tie</span></p>`;
}

const LEVEL = { p: 'Primary', s: 'Shared', l: 'Limited' };
const RK_EV = { confirmed: ['ok', 'Confirmed'], company_claim: ['only', "Company's word"], reported: ['part', 'Reported'], inferred: ['no', 'Our match'] };
function riskSection(R) {
  if (!R || !(R.cols || []).length) return '';
  const rows = R.rows || [];
  const groups = (R.groups || []).filter(([g]) => R.cols.some((c) => c.g === g));
  const gname = Object.fromEntries(groups.map(([g, t]) => [g, t]));
  const pid = (c, r) => `rk-${c.k}-${r}`;
  const logo = (c, cls) => mark(c.logo, c.n, cls);
  const cell = (c, r) => (c.cells || {})[r] || { lv: 'l', t: '—', note: '', src: [] };
  // desktop grid: group bands, company heads, then one row per risk
  let col = 2;
  const bands = groups.map(([g, t, s]) => {
    const n = R.cols.filter((c) => c.g === g).length;
    const html = `<div class="rk-band g-${esc(g)}" style="grid-column:${col} / span ${n}"><b>${esc(t)}</b><small>${esc(s)}</small></div>`;
    col += n;
    return html;
  }).join('');
  const heads = R.cols.map((c, i) => `<div class="rk-head g-${esc(c.g)}" style="grid-column:${i + 2}">${logo(c, 'mk rk-lg')}<b>${esc(c.n)}</b><small>${esc(c.sub || '')}</small></div>`).join('');
  const body = rows.map(([r, rt, rs], ri) => `<div class="rk-row" style="grid-row:${ri + 3}"><b>${esc(rt)}</b><small>${esc(rs)}</small></div>` + R.cols.map((c, ci) => {
    const x = cell(c, r);
    return `<button type="button" class="rk-c g-${esc(c.g)} lv-${esc(x.lv)}" style="grid-column:${ci + 2};grid-row:${ri + 3}" popovertarget="${pid(c, r)}" aria-label="${esc(`${c.n}, ${rt.toLowerCase()}: ${LEVEL[x.lv]}. ${x.t}`)}"><span class="rk-pill">${LEVEL[x.lv]}</span><span class="rk-t">${esc(x.t)}</span></button>`;
  }).join('')).join('');
  // phone: one card per risk, companies grouped by level
  const cards = rows.map(([r, rt, rs]) => {
    const lanes = ['p', 's', 'l'].map((lv) => {
      const cs = R.cols.filter((c) => cell(c, r).lv === lv);
      if (!cs.length) return '';
      const items = cs.map((c) => (lv === 'l'
        ? `<button type="button" class="rk-chip" popovertarget="${pid(c, r)}">${logo(c)}<span>${esc(c.n)}</span></button>`
        : `<button type="button" class="rk-it g-${esc(c.g)} lv-${lv}" popovertarget="${pid(c, r)}">${logo(c, 'mk rk-lg')}<span><b>${esc(c.n)}</b><small>${esc(cell(c, r).t)}</small></span></button>`)).join('');
      return `<div class="rk-lane lv-${lv}"><span class="rk-lk">${LEVEL[lv]}</span><div class="rk-items${lv === 'l' ? ' compact' : ''}">${items}</div></div>`;
    }).join('');
    return `<section class="rk-card"><h3>${esc(rt)}</h3><p>${esc(rs)}</p>${lanes}</section>`;
  }).join('');
  // one source panel per cell, shared by both layouts
  const pops = R.cols.map((c) => rows.map(([r, rt]) => {
    const x = cell(c, r);
    const src = (x.src || []).map((s) => {
      const [ec, et] = RK_EV[s.ev] || RK_EV.confirmed;
      return `<li><span class="rk-sl">${a(s.u, s.t)}<span class="ev ${ec}">${esc(et)}</span></span>${s.q ? `<q>${esc(s.q)}</q>` : ''}</li>`;
    }).join('');
    return `<div popover id="${pid(c, r)}" class="rk-pop g-${esc(c.g)}">
  <div class="rk-ph">${logo(c, 'mk rk-lg')}<span><b>${esc(c.n)}</b><small>${esc([c.sub, gname[c.g]].filter(Boolean).join(' · '))}</small></span><button type="button" class="rk-x" popovertarget="${pid(c, r)}" popovertargetaction="hide" aria-label="Close">×</button></div>
  <div class="rk-pr"><span class="k">${esc(rt)}</span><span class="rk-pill lv-${esc(x.lv)}">${LEVEL[x.lv]}</span></div>
  <p class="rk-pt">${esc(x.t)}</p>
  ${x.note ? `<p class="rk-pn">${esc(x.note)}</p>` : ''}
  ${src ? `<ul class="rk-src">${src}</ul>` : '<p class="rk-none">No source names a role here, so it reads as limited.</p>'}
  ${c.web ? `<p class="toweb"><a href="/data-center/${esc(c.web)}">Company web${c.web === 'dayone' ? ' for DayOne' : ''} →</a></p>` : ''}
</div>`;
  }).join('')).join('');
  const asof = R.asof ? new Date(R.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '';
  return `<div class="rk" role="group" aria-label="Who carries which risk" style="--rk-n:${R.cols.length}">${bands}${heads}${body}</div>
<p class="rk-rail">Swipe across for the other risks →</p>
<div class="rk-cards">${cards}</div>
<div class="rk-key"><span><i class="rk-sw lv-p"></i><b>Primary</b> does it, owns it or pays for it</span><span><i class="rk-sw lv-s"></i><b>Shared</b> splits it with a named partner</span><span><i class="rk-sw lv-l"></i><b>Limited</b> sells, builds or rents on contract</span><span>Tap any cell for its source${asof ? ` · checked ${esc(asof)}` : ''}</span></div>
${(R.bottom_line || []).length ? `<ul class="bl-list rk-bl">${R.bottom_line.map((x) => `<li>${x}</li>`).join('')}</ul>` : ''}
${(R.method || []).length ? `<details class="dcm rk-m"><summary>How the levels were set</summary><ul>${R.method.map((m) => `<li>${m}</li>`).join('')}</ul></details>` : ''}
${pops}`;
}

function webCards(D) {
  return (D.webs || []).map((w) => {
    const ps = D.projects.filter((p) => (w.operators || []).includes(p.op));
    const lg = (ps.find((p) => p.logo) || {}).logo;
    return `<a class="wc" href="/data-center/${esc(w.slug)}">
  <span class="wk mono">${mark(lg, w.title)} Company web</span>
  <span class="wt">${esc(w.title)}</span>
  <span class="wb">${esc(w.bottom_line || '')}</span>
  <span class="wm mono">${w.counts.entities} companies, sites and people · ${w.counts.links} sourced ties · ${w.counts.confirmed} confirmed</span>
</a>`;
  }).join('');
}

const CSS = `
.dc{max-width:1180px;margin:0 auto;padding:0 20px}
.k{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73}
.mk{width:18px;height:18px;flex:none;object-fit:contain;background:#fff;border-radius:3px}
.mono-mk{display:inline-grid;place-items:center;font:400 8.5px/1 'IBM Plex Mono',monospace;color:#6B6B73;background:#EFEFEC;letter-spacing:0}
.mk.own{border-radius:50%;background:#EFEFEC;position:relative;display:inline-block}
.mk.own::after{content:"";position:absolute;inset:5px;border-radius:50%}
.mk.own-solar::after{background:#E3A008}.mk.own-battery::after{background:#2E9E5B;border-radius:1px;inset:5px 6px}.mk.own-gas::after{background:#E8743B}
/* the matrix */
.mx{display:grid;grid-template-columns:132px repeat(4,minmax(0,1fr));border:1px solid #E7E7E7;background:#fff;margin-top:8px}
.mx-corner{grid-row:1;grid-column:1}
.mx-col{grid-row:1;grid-column:var(--gc);padding:16px 16px 12px;display:grid;gap:3px;align-content:end;border-left:1px solid #E7E7E7}
.mx-col b{font-size:19px;font-weight:600;letter-spacing:-0.015em;line-height:1.15}
.mx-col small{font:400 10.5px/1.4 'IBM Plex Mono',monospace;letter-spacing:.03em;opacity:.85}
.mx-row{grid-column:1;grid-row:var(--gr);display:grid;align-items:center;padding:14px;border-top:1px solid #E7E7E7}
.mx-row b{font-size:16px;font-weight:600}
.mx-row.row-gf{background:#ECF5EE}.mx-row.row-bf{background:#FAF4E9}
.cell{grid-column:var(--gc);grid-row:var(--gr);display:grid;grid-template-rows:auto 1fr;border-left:1px solid #E7E7E7;border-top:1px solid #E7E7E7;min-width:0}
.col-grid{background:#EAF1FB;color:#1D4479}.col-btm{background:#E8F4EB;color:#1D5A33}.col-offgrid{background:#FAF2E2;color:#6A4A0A}.col-hybrid{background:#F0EDFB;color:#40358F}
.col-grid .t-col{background:#CFDDF2}.col-btm .t-col{background:#CBE4D2}.col-offgrid .t-col{background:#EEDDBA}.col-hybrid .t-col{background:#DCD6F4}
.cell .ph{margin:10px 10px 0;aspect-ratio:2/1;overflow:hidden;background:#EEE;max-width:100%}
.cell .ph img{width:100%;height:100%;object-fit:cover;display:block}
.cb{padding:12px 14px 14px;display:grid;gap:8px;align-content:start;min-width:0;color:#000}
.cb h3{font-size:17px;font-weight:600;letter-spacing:-0.01em;line-height:1.2}
.cs{font-size:13px;line-height:1.4;color:#52525B}
.tags{display:none;gap:6px;flex-wrap:wrap}
.t-col,.t-row{font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;padding:5px 7px;white-space:nowrap}
.t-row{background:#fff;color:#6B6B73}
.ops{display:flex;flex-wrap:wrap;gap:5px}
.op{display:inline-flex;align-items:center;gap:6px;text-decoration:none;background:#fff;padding:4px 8px 4px 4px;font-size:12.5px;font-weight:600;line-height:1.2;max-width:100%;border:1px solid transparent}
.op:hover{border-color:#000}
.op span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.op em{font-style:normal;font:400 10.5px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.op i{font-style:normal;font-weight:500;color:#6B6B73;font-size:11.5px}.op i::before{content:"· "}
.op.presumed{background:transparent;border:1px dashed rgba(0,0,0,.28)}
.op.plan span::after{content:" · plan";font-weight:500;color:#6B6B73}
.op.more{padding-left:8px;color:#6B6B73}
.vends{display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;padding-top:7px;border-top:1px dashed rgba(0,0,0,.15)}
.vends .k{width:100%;font-size:9.5px}
.vd{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600}
.vd em{font-style:normal;font:400 10.5px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.op,.vd,.pfrom,.c-pw,.c-pr small,.lv,.lp,.unn small,.ly small,.why{word-spacing:.12em}
.count{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#52525B;text-decoration:none;justify-self:start}
.count:hover{text-decoration:underline}
.none{font-size:13px;color:#6B6B73}
.lgd{display:flex;flex-wrap:wrap;gap:6px 14px;font:400 10.5px/1.6 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;margin-top:10px}
.lgd b{color:#000;font-weight:400}
.lgd i.d{display:inline-block;width:22px;height:11px;vertical-align:-1px;margin-right:5px;border:1px dashed rgba(0,0,0,.35)}
.rail{display:none;font:400 10.5px/1.4 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;margin:0 0 8px}
@media(max-width:760px){
  .rail{display:block}
  .mx{grid-template-columns:repeat(4,84%);grid-template-rows:auto auto;gap:10px;border:0;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -20px;padding:0 20px 8px;scroll-padding-left:20px;scrollbar-width:none;background:transparent}
  .mx::-webkit-scrollbar{display:none}
  .mx-corner,.mx-col,.mx-row{display:none}
  .cell{grid-column:var(--mc);grid-row:var(--mr);border:1px solid #E7E7E7;scroll-snap-align:start}
  .tags{display:flex}
  .cell .ph{aspect-ratio:16/9}
}
/* bottom line */
.bl-list{list-style:none;display:grid;gap:10px;max-width:92ch}
.bl-list li{color:#3F3F46;font-size:15px;line-height:1.6;padding-left:14px;position:relative}
.bl-list li::before{content:"";position:absolute;left:0;top:.65em;width:6px;height:6px;background:#000}
.bl-list strong{color:#000;font-weight:650}
/* company webs */
.wgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:760px){.wgrid{grid-template-columns:minmax(0,1fr)}}
.wc{background:#fff;padding:20px 18px 18px;display:flex;flex-direction:column;gap:8px;text-decoration:none;min-width:0}
.wc:hover{background:#FAFAFA}
.wc:last-child:nth-child(odd){grid-column:1/-1}
.wk{display:flex;align-items:center;gap:8px;font-size:10.5px;color:#6B6B73}
.wt{font-size:23px;letter-spacing:-0.02em;font-weight:500}
.wb{color:#52525B;font-size:14px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.wm{font-size:10px;color:#9A9AA0;margin-top:auto;padding-top:4px}
.cxwrap{overflow-x:auto;border:1px solid #E7E7E7}
.cxg{border-collapse:collapse;width:100%;min-width:720px;font-size:13px}
.cxg th,.cxg td{border-bottom:1px solid #F1F1F1;padding:5px 10px;text-align:left;font-weight:500;white-space:nowrap}
.cxg thead th{font:400 10px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;background:#FAFAFA;border-bottom:1px solid #E7E7E7;padding:9px 10px;position:sticky;top:0}
.cxg thead th a{text-decoration:none;color:#000}
.cxg .g{text-align:center;width:72px}
.cxg td.n{font:400 11.5px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.cxg tr.rh th{font:400 10px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;background:#F7F8F4;color:#000;padding:8px 10px}
.cxg tbody tr:not(.rh) th{font:500 13px/1.3 'Overused Grotesk',system-ui,sans-serif;text-transform:none;letter-spacing:-0.005em;word-spacing:.1em;color:#000;background:#fff}
.cxg .pk{font:400 9px/1 'IBM Plex Mono',monospace;text-transform:uppercase;color:#9A9AA0;margin-left:6px}
.cx{display:inline-block;width:14px;height:14px;background:#000;vertical-align:middle}
.cx.via{background:#fff;box-shadow:inset 0 0 0 1.5px #000}
a.cx:hover{outline:2px solid #E8734B;outline-offset:1px}
.cxkey{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:10px;color:#6B6B73;margin-top:8px}
.cxkey span{display:inline-flex;align-items:center;gap:6px}
.cxkey .cx{width:11px;height:11px}
.wpending{border:1px dashed #D9D9D9;padding:16px 18px;color:#6B6B73;font-size:14px}
/* the project list */
.tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}
.tools input{font:500 14px/1 'Overused Grotesk',system-ui,sans-serif;padding:9px 10px;border:1px solid #E7E7E7;width:240px;max-width:100%;border-radius:0}
.tools .chip{cursor:pointer}
.tools .chip[aria-pressed="true"]{background:#000;border-color:#000;color:#fff}
.tools select{font:400 12px/1 'IBM Plex Mono',monospace;border:1px solid #E7E7E7;background:#fff;padding:8px;border-radius:0}
.plist{border:1px solid #E7E7E7}
.phd,.pr>summary{display:grid;grid-template-columns:minmax(0,2.6fr) minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1.4fr) 110px;gap:10px;align-items:center;padding:10px 12px}
.phd{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;background:#FAFAFA;border-bottom:1px solid #E7E7E7}
.phd button{all:unset;cursor:pointer}
.phd button:focus-visible{outline:2px solid #000}
.pr{border-bottom:1px solid #F1F1F1}
/* long page: these are only laid out and painted near the screen; each size hint is the
   measured inner height (desktop, then phone), so the scrollbar holds still */
#dc-list>.pr{content-visibility:auto;contain-intrinsic-size:auto 66px}
#webs,#vendors{content-visibility:auto}
#webs{contain-intrinsic-size:auto 3744px}
#vendors{contain-intrinsic-size:auto 2610px}
@media(max-width:720px){#dc-list>.pr{contain-intrinsic-size:auto 138px}#webs{contain-intrinsic-size:auto 4884px}#vendors{contain-intrinsic-size:auto 4101px}}
.pr:last-child{border-bottom:0}
.pr>summary{list-style:none;cursor:pointer;font-size:13.5px}
.pr>summary::-webkit-details-marker{display:none}
.pr>summary:hover{background:#FAFAFA}
.pr[open]>summary{background:#FAFAFA}
.pr.flash>summary{box-shadow:inset 3px 0 0 #000}
.c-pr{display:flex;gap:9px;align-items:center;min-width:0}
.c-pr .lgm{width:24px;height:24px}
.c-pr b{display:block;font-weight:600;line-height:1.25}
.c-pr small{display:block;color:#6B6B73;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.c-pr span{min-width:0}
.c-cell,.c-mw{font-size:11px;color:#52525B;letter-spacing:.03em}
.c-st{display:flex;flex-wrap:wrap;gap:4px}
.st,.tg,.ev{display:inline-flex;align-items:center;gap:5px;font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;padding:4px 6px;border:1px solid;white-space:nowrap}
.st.ok,.ev.ok{color:#2F7A5C;border-color:#2F7A5C}.st.part,.ev.part{color:#9A7B4F;border-color:#C9B79A}.st.only,.ev.only{color:#4E7A96;border-color:#4E7A96}.st.bad{color:#B42318;border-color:#E7A39C}
.tg{color:#52525B;border-color:#D9D9DE}.tg.dash{border-style:dashed}
.c-pw{font-size:12.5px;color:#3F3F46}
.c-v{display:flex;align-items:center;gap:3px;justify-content:flex-end}
.c-v em{font-style:normal;font:400 11px/1 'IBM Plex Mono',monospace;color:#6B6B73;margin-left:4px}
.pb{padding:4px 12px 16px 45px;display:grid;gap:12px;background:#FAFAFA}
.why{font-size:13.5px;color:#3F3F46;max-width:96ch}
.pw{display:grid;gap:6px;font-size:14px;max-width:96ch}
.pf{display:flex;flex-wrap:wrap;gap:6px}
.pfrom{display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #E7E7E7;padding:3px 8px 3px 4px;font-size:12px;font-weight:600}
.src{display:flex;flex-wrap:wrap;gap:4px 12px}
.src a,.vs a,.why a{color:#6B6B73;font-size:11.5px;text-decoration:none;border-bottom:1px solid #D9D9D9}
.stack{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px}
.ly ul{list-style:none;display:grid;gap:8px;margin-top:6px}
.ly li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;font-size:13px}
.ly li b{font-weight:600}
.ly .cat{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#6B6B73}
.ly small{display:block;color:#3F3F46;font-size:12.5px;line-height:1.45;overflow-wrap:anywhere}
.vs{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin-top:3px}
.up{display:inline-block;margin-left:6px;font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#9A9AA0}
.toweb a{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;text-decoration:none;border-bottom:1px solid #000}
.cellnote{font-size:10px;color:#9A9AA0}
.more-btn{margin-top:10px}
@media(max-width:860px){
  .phd{display:none}
  .pr>summary{grid-template-columns:minmax(0,1fr) auto;gap:6px 10px}
  .c-pr{grid-column:1/-1}.c-cell{display:none}.c-pw{grid-column:1/-1;font-size:12px;color:#6B6B73}
  .pb{padding:4px 12px 16px 12px}.stack{grid-template-columns:minmax(0,1fr)}
}
/* vendor league */
.league{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px 34px;align-items:start}
@media(max-width:860px){.league{grid-template-columns:minmax(0,1fr)}}
.lgp ul{list-style:none;display:grid;gap:10px;margin-top:8px}
.lgp li{display:grid;grid-template-columns:minmax(0,230px) minmax(0,1fr);gap:4px 12px;align-items:center}
.lv{display:flex;align-items:center;gap:8px;font-size:13.5px;min-width:0}
.lv b{font-weight:600}.lv small{display:block;font:400 10px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#6B6B73}
.lb{display:grid;grid-template-columns:minmax(0,1fr) 24px;gap:8px;align-items:center}
.lb .bar{display:block;height:8px;min-width:6px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
.lb .num{font:400 12px/1 'IBM Plex Mono',monospace;text-align:right}
.lp{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:4px 6px;font-size:12px}
.lp a{text-decoration:none;border:1px solid #E7E7E7;padding:2px 7px}
.lp a:hover{border-color:#000}
@media(max-width:600px){.lgp li{grid-template-columns:minmax(0,1fr)}}
.unn{border:1px solid #E7E7E7;padding:0 18px;margin-top:20px}
.unn summary{cursor:pointer;font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:16px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.unn[open] summary{border-bottom:1px solid #F1F1F1;margin-bottom:12px}
.unn ul{list-style:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px;padding-bottom:16px}
@media(max-width:760px){.unn ul{grid-template-columns:minmax(0,1fr)}}
.unn li{display:grid;grid-template-columns:18px minmax(0,1fr);gap:8px;font-size:13px}
.unn small{display:block;color:#3F3F46;margin-top:3px;line-height:1.45}
.unn i{font-style:normal;color:#6B6B73}
/* rules + method */
.rules{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:980px){.rules{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.rules{grid-template-columns:minmax(0,1fr)}}
.rule{background:#fff;padding:16px 16px 14px;display:grid;gap:6px;align-content:start}
.rule h3{font-size:16px;font-weight:600;letter-spacing:-0.01em}
.rule p{font-size:13.5px;color:#52525B;line-height:1.55}
.rule .src{margin-top:4px}
.dcm{border:1px solid #E7E7E7;padding:0 18px}
.dcm summary{cursor:pointer;font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:16px 0}
.dcm[open] summary{border-bottom:1px solid #F1F1F1;margin-bottom:12px}
.dcm ul{padding:0 0 16px 18px;display:grid;gap:6px}
.dcm li{color:#52525B;font-size:14px;line-height:1.6;max-width:92ch}
.sec-nav{display:flex;flex-wrap:wrap;gap:6px;margin-top:22px}
/* who carries the risk */
.g-vendors{--d:#23477A;--t:#D7E3F4;--b:#EEF3FA}
.g-builders{--d:#4A3E8E;--t:#E1DDF4;--b:#F3F1FB}
.g-landpower{--d:#1E6A3D;--t:#D3E9D9;--b:#EDF6EF}
.g-operators{--d:#B2492A;--t:#F6DCCD;--b:#FBF1EB}
.rk{display:grid;grid-template-columns:176px repeat(var(--rk-n),minmax(0,1fr));column-gap:4px;margin-top:8px}
.rk-band{grid-row:1;padding:9px 8px 8px;display:grid;gap:2px;text-align:center;background:var(--b);border-radius:6px 6px 0 0;border-bottom:1px solid rgba(0,0,0,.07)}
.rk-band b{font-size:13.5px;font-weight:600;letter-spacing:-0.005em}
.rk-band small{font-size:11px;color:#52525B;line-height:1.3}
.rk-head{grid-row:2;display:grid;justify-items:center;align-content:start;gap:5px;padding:12px 4px 10px;text-align:center;min-width:0;background:var(--b)}
.rk-head .rk-lg{width:30px;height:30px}
.rk-head b{font-size:13px;font-weight:600;line-height:1.2;overflow-wrap:anywhere}
.rk-head small{font-size:10.5px;color:#6B6B73;line-height:1.3}
.rk-row{grid-column:1;display:grid;align-content:center;gap:3px;padding:10px 12px 10px 2px;border-top:1px solid #E7E7E7}
.rk-row b{font-size:15px;font-weight:600;letter-spacing:-0.01em;line-height:1.2}
.rk-row small{font-size:12px;color:#6B6B73;line-height:1.35}
.rk-c{all:unset;box-sizing:border-box;display:grid;grid-template-rows:auto 1fr;gap:6px;align-content:start;padding:9px 6px 11px;text-align:center;cursor:pointer;min-width:0;background:var(--b);border-top:1px solid rgba(0,0,0,.07)}
.rk-c:hover .rk-pill{box-shadow:0 0 0 2px #000}
.rk-c:focus-visible{outline:2px solid #000;outline-offset:1px}
.rk-pill{display:block;font-size:12px;font-weight:600;line-height:1;padding:8px 4px;border-radius:5px}
.lv-p .rk-pill,.rk-pill.lv-p{background:var(--d);color:#fff}
.lv-s .rk-pill,.rk-pill.lv-s{background:var(--t);color:#18181B}
.lv-l .rk-pill,.rk-pill.lv-l{background:#fff;color:#71717A;box-shadow:inset 0 0 0 1px #E4E4E7}
.rk-c.lv-l:hover .rk-pill{box-shadow:0 0 0 2px #000}
.rk-t{font-size:11.5px;line-height:1.35;color:#52525B;overflow-wrap:anywhere}
.rk-key{display:flex;flex-wrap:wrap;gap:6px 18px;font:400 10.5px/1.6 'IBM Plex Mono',monospace;letter-spacing:.03em;color:#6B6B73;margin-top:12px}
.rk-key span{display:inline-flex;align-items:center;gap:6px}
.rk-key b{color:#000;font-weight:400;text-transform:uppercase}
.rk-sw{display:inline-block;width:22px;height:11px;border-radius:3px}
.rk-sw.lv-p{background:#3F3F46}.rk-sw.lv-s{background:#E4E4E7}.rk-sw.lv-l{background:#fff;box-shadow:inset 0 0 0 1px #D4D4D8}
.rk-bl{margin-top:24px}
.rk-m{margin-top:18px}
.rk-cards{display:none}
.rk-card{border:1px solid #E7E7E7;padding:14px 14px 12px;display:grid;gap:10px;align-content:start;min-width:0}
.rk-card h3{font-size:17px;font-weight:600;letter-spacing:-0.01em}
.rk-card>p{font-size:12.5px;color:#6B6B73;margin-top:-6px}
.rk-lane{display:grid;gap:6px}
.rk-lk{font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73}
.rk-items{display:grid;gap:6px}
.rk-items.compact{display:flex;flex-wrap:wrap;gap:5px}
.rk-it{all:unset;box-sizing:border-box;display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:6px;cursor:pointer;min-width:0}
.rk-it>span{min-width:0}
.rk-it.lv-p{background:var(--d);color:#fff}
.rk-it.lv-p small{color:rgba(255,255,255,.84)}
.rk-it.lv-s{background:var(--t);color:#000}
.rk-it.lv-s small{color:#3F3F46}
.rk-it b{display:block;font-size:13.5px;font-weight:600;line-height:1.2}
.rk-it small{display:block;font-size:12px;line-height:1.35}
.rk-it .rk-lg{width:26px;height:26px}
.rk-chip{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;border:1px solid #E4E4E7;padding:4px 8px 4px 4px;font-size:12.5px;font-weight:500;cursor:pointer;border-radius:4px}
.rk-it:focus-visible,.rk-chip:focus-visible{outline:2px solid #000;outline-offset:2px}
.rk-rail{display:none;font:400 10.5px/1.4 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;margin:0 0 8px}
@media(max-width:1020px){.rk{display:none}.rk-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}
@media(max-width:640px){
  .rk-rail{display:block}
  .rk-cards{grid-template-columns:none;grid-auto-flow:column;grid-auto-columns:86%;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;margin:0 -20px;padding:0 20px 8px;scroll-padding-left:20px;scrollbar-width:none}
  .rk-cards::-webkit-scrollbar{display:none}
  .rk-card{scroll-snap-align:start}
}
.rk-pop{inset:0;margin:auto;border:1px solid #000;padding:16px 18px 16px;width:min(440px,calc(100vw - 32px));max-height:min(78vh,640px);overflow:auto;background:#fff;color:#000;box-shadow:0 18px 50px rgba(0,0,0,.18)}
.rk-pop::backdrop{background:rgba(0,0,0,.18)}
.rk-ph{display:flex;align-items:center;gap:10px}
.rk-ph>span{flex:1;min-width:0}
.rk-ph b{display:block;font-size:16px;font-weight:600;line-height:1.2}
.rk-ph small{display:block;font-size:12px;color:#6B6B73;line-height:1.35}
.rk-ph .rk-lg{width:30px;height:30px}
.rk-x{all:unset;cursor:pointer;font-size:24px;line-height:1;padding:4px 8px;color:#52525B}
.rk-x:focus-visible{outline:2px solid #000}
.rk-pr{display:flex;align-items:center;gap:10px;margin-top:14px}
.rk-pr .rk-pill{display:inline-block;padding:6px 10px}
.rk-pt{font-size:18px;font-weight:600;letter-spacing:-0.01em;line-height:1.25;margin-top:8px}
.rk-pn{font-size:14px;line-height:1.55;color:#3F3F46;margin-top:6px}
.rk-src{list-style:none;display:grid;gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid #F1F1F1}
.rk-sl{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.rk-sl a{font-size:12.5px;color:#000;text-decoration:none;border-bottom:1px solid #A1A1AA}
.rk-src q{display:block;font-size:12px;line-height:1.45;color:#6B6B73;margin-top:4px;overflow-wrap:anywhere}
.rk-none{font-size:13px;color:#6B6B73;margin-top:10px}
.rk-pop .toweb{margin-top:14px}
.ev.no{color:#8E8E93;border-color:#D9D9DE}
@media(max-width:640px){.rk-pop{inset:auto 0 0 0;margin:0;width:100%;max-width:none;max-height:82vh;border-width:1px 0 0;border-radius:14px 14px 0 0}}
`;

function page({ lang = 'en' } = {}) {
  const D = load();
  if (!D) return null;
  const p = '/data-center';
  const asof = new Date(D.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const order = { 'gf-grid': 0, 'bf-grid': 1, 'gf-btm': 2, 'gf-offgrid': 3, 'gf-hybrid': 4, unplaced: 9 };
  const rank = { operating: 0, 'under construction': 0, halted: 1, announced: 2 };
  const ps = D.projects.slice().sort((x, y) => (order[x.cell] ?? 5) - (order[y.cell] ?? 5) || (x.tenant_of ? 1 : 0) - (y.tenant_of ? 1 : 0) || (rank[x.status] ?? 3) - (rank[y.status] ?? 3) || (y.size || 0) - (x.size || 0));
  const stats = (D.kpis || []).map((k) => `<div class="cell"><div class="v">${esc(k.value)}</div><div class="k">${esc(k.label)}</div></div>`).join('');
  const rules = (D.rules || []).map((r) => `<div class="rule"><h3>${esc(r.title)}</h3><p>${esc(r.text)}</p><span class="src">${a(r.url, host(r.url), r.quote)}</span></div>`).join('');
  const unnamed = (D.unnamed || []).map((g) => `<li>${mark(g.logo, g.n)}<div><b>${esc(g.n)}</b>${g.refs.map((r) => `<small>${esc(r.what)}. <i>Client as worded: ${esc(r.where)}</i> <span class="src">${a(r.u, r.t, r.q)}</span></small>`).join('')}</div></li>`).join('');
  const regionChips = ['all', 'jkt', 'batam', 'other'].map((k) => `<button type="button" class="chip" data-region="${k}" aria-pressed="${k === 'all'}">${esc(k === 'all' ? 'All' : REGION[k])}</button>`).join('');
  const cellOpts = [['all', 'Every cell'], ...ROWS.flatMap(([r, rt]) => COLS.map(([c, t]) => [`${r}-${c}`, `${t} · ${rt}`])), ['unplaced', 'Not placed']]
    .filter(([k]) => k === 'all' || D.projects.some((x) => x.cell === k)).map(([k, t]) => `<option value="${esc(k)}">${esc(t)}</option>`).join('');
  const risk = riskSection(loadRisk());
  const webs = (D.webs || []).length ? `<div class="wgrid">${webCards(D)}</div>` : '<div class="wpending">The company webs are being researched: owners, campuses, tenants, power, builders, lenders and the people linking them, for DCI, BDx, NeutraDC, Digital Edge, DayOne, PDG, STT GDC and SM+.</div>';
  /* the citable answer under the lede (Sinyal's audit, 24 Oct 2026: no self-contained answer near the
     top), counted from the matrix itself: placed = any cell but unplaced, grid = the two -grid cells */
  const placed = D.projects.filter((x) => x.cell && x.cell !== 'unplaced').length;
  const onGrid = D.projects.filter((x) => /-grid$/.test(x.cell || '')).length;
  const nWebs = (D.webs || []).length;
  const answer = `According to 1001startup.id (updated ${asof}), ${D.projects.length} data-centre projects in Indonesia are on record`
    + `${placed ? `, and ${onGrid} of the ${placed} that could be placed by power source draw on the grid: PLN, PLN Batam or an estate utility` : ''}.`
    + ` For each project it names the companies that own, power, build and equip it${nWebs ? `, with company webs for ${nWebs} data-centre groups` : ''}.`;
  const body = `
<style>${CSS}</style>
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>DATA CENTRES · INDONESIA · ${esc(asof.toUpperCase())}</div>
  <h1>Who powers Indonesia’s data centres</h1>
  <p class="sub">${D.projects.length} data-centre projects, placed by where their power comes from and whether the site is new, with the companies that own, power, build and equip them. Every tie links to its source.</p>
  <p class="sub">${answer}</p>
  <nav class="sec-nav" aria-label="On this page"><a class="chip" href="#matrix">Matrix</a>${risk ? '<a class="chip" href="#risk">Who carries the risk</a>' : ''}<a class="chip" href="#webs">Company webs</a><a class="chip" href="#projects">Projects</a><a class="chip" href="#vendors">Vendors</a><a class="chip" href="#rules">Rules</a><a class="chip" href="#method">Method</a></nav>
</section>
<section class="wrap" id="matrix" style="padding-top:8px">
  <div class="eyebrow"><span class="sq"></span>THE POWER MATRIX</div>
  <p class="lede">Four ways a data centre gets power, for new sites and converted ones. Each cell names the operators in it, who supplies their power and the vendors a source names. Tap a company to open its project below.</p>
  <p class="rail">Swipe across for the other power models →</p>
  ${matrix(D)}
  <div class="lgd"><span><b>Greenfield</b> = new site</span><span><b>Brownfield</b> = retrofit, conversion or a bought existing site</span><span><b>BTM</b> = generation on the customer’s side of the meter</span><span><i class="d"></i>power not disclosed</span><span>“plan” = announced only</span><span>Pictures are illustrations, not the real sites</span></div>
</section>
<div class="stats" style="margin-top:44px">${stats}</div>
<section class="wrap" id="bottom">
  <div class="eyebrow"><span class="sq"></span>WHAT THE MAP SHOWS</div>
  <ul class="bl-list">${(D.bottom_line || []).map((x) => `<li>${x}</li>`).join('')}</ul>
</section>
${risk ? `<section class="wrap" id="risk">
  <div class="eyebrow"><span class="sq"></span>WHO CARRIES THE RISK</div>
  <p class="lede">Six risks in building and running a data centre, and how ten companies on this page share them, from chip makers to the operators who rent out the halls. Every level rests on a filing or company page.</p>
  ${risk}
</section>` : ''}
<section class="wrap" id="webs">
  <div class="eyebrow"><span class="sq"></span>SUPPLY CHAIN · COMPANY WEBS</div>
  <p class="lede">One map per data-centre group: who owns it, the campuses it runs, who rents its space, where its power comes from, who builds and equips it, who lends to it, and the people who link those companies. Same method as the company webs on our CNC research.</p>
  ${webs}
  ${(D.connectors || []).length ? `<div class="eyebrow" style="margin-top:40px"><span class="sq"></span>WHO CONNECTS THE GROUPS</div><p class="lede">The companies and people that turn up in more than one group's web: the utility and estate land under them, the builders and banks they share, and the people who sit on several boards. ${(D.connectors || []).length} in all.</p>${connectorGrid(D)}` : ''}
</section>
${stateSites(D.projects.length)}<section class="wrap" id="projects">
  <div class="eyebrow"><span class="sq"></span>EVERY PROJECT</div>
  <p class="lede">Open a row for why it sits where it does, where its power comes from and which vendors a source names. “Site inferred” marks a link we matched to the site ourselves because the source doesn’t name it.</p>
  <div class="tools"><input id="dc-q" type="search" placeholder="Find a project or company" aria-label="Find a project or company">${regionChips}<select id="dc-cell" aria-label="Matrix cell">${cellOpts}</select><span class="mono" id="dc-count" style="font-size:11px;color:#6B6B73"></span></div>
  <div class="plist" id="dc-list">
    <div class="phd" role="presentation"><span>Project</span><span>Matrix cell</span><button type="button" data-sort="size">Size</button><span>Status</span><span>Power from</span><span style="text-align:right">Vendors</span></div>
    ${ps.map((x) => projectRow(D, x)).join('')}
  </div>
</section>
<section class="wrap" id="vendors">
  <div class="eyebrow"><span class="sq"></span>WHO SUPPLIES THEM</div>
  <p class="lede">Vendors counted once per named project. Utilities are left out because PLN or PLN Batam supplies almost every site.</p>
  <div class="league">${league(D)}</div>
  ${unnamed ? `<details class="unn"><summary>Active here, client not named · ${(D.unnamed || []).length} ${(D.unnamed || []).slice(0, 12).map((g) => mark(g.logo, g.n)).join('')}</summary><ul>${unnamed}</ul></details>` : ''}
</section>
<section class="wrap" id="rules">
  <div class="eyebrow"><span class="sq"></span>WHY ALMOST EVERYTHING SITS IN THE FIRST COLUMN</div>
  <div class="rules">${rules}</div>
</section>
<section class="wrap" id="method">
  <div class="eyebrow"><span class="sq"></span>METHOD</div>
  <details class="dcm"><summary>How this was put together</summary><ul>${(D.method || []).map((m) => `<li>${m}</li>`).join('')}</ul></details>
</section>
<script src="/js/datacenter1001.js?v=${ver('datacenter1001.js')}" defer></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'Data centres', path: p }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'Who powers Indonesia’s data centres',
    description: `${D.projects.length} Indonesian data-centre projects placed by power model and site type, with their power suppliers and named vendors, each link sourced.`,
    url: I18N.ORIGIN + p, dateModified: D.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: 'Who powers Indonesia’s data centres — 1001startup.id',
    desc: SCHEMA.fitDesc([
      `${D.projects.length} Indonesian data-centre projects by power model and site type: PLN, estate utilities and own power, with the companies that own, build and equip them. Every tie sourced.`,
      `${D.projects.length} Indonesian data-centre projects by power model: PLN, estate utilities or own power, with the companies that own, build and equip them. Every tie sourced.`,
    ]),
    path: p, lang, body,
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

/* ---------------- company webs ---------------- */
const BRANCHES = [
  ['owners', 'Owners and investors', 'Who holds stakes in it', 'r'],
  ['holdings', 'Campuses and units', 'Sites, subsidiaries, brands and joint ventures', 'l'],
  ['customers', 'Tenants and customers', 'Clouds, telcos and AI firms using its space', 'l'],
  ['power', 'Power', 'Utility feed, estate grid and clean-power deals', 'r'],
  ['builders', 'Built and equipped by', 'Contractors, designers and equipment makers', 'l'],
  ['finance', 'Lenders', 'Banks, green loans and bonds', 'r'],
  ['partners', 'Works with it', 'Network, cloud and GPU partners, estates, government', 'l'],
  ['people', 'Linked through people', 'Founders, directors and their other firms', 'r'],
];
const EVID = { confirmed: ['ok', 'Confirmed'], company_claim: ['only', "Company's word"], snippet: ['part', 'Snippet only'], inferred: ['no', 'Our inference'] };
const EORDER = Object.keys(EVID);
const KIND = { company: 'Company', fund: 'Investor', campus: 'Campus', brand: 'Brand', person: 'Person', state_firm: 'State firm', government: 'Government', utility: 'Utility' };
const erank = (l) => { const i = EORDER.indexOf(l.evidence); return i < 0 ? 9 : i; };
const relWords = (r) => { const s = String(r || '').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
const dot = (e) => { const [c, t] = EVID[e] || ['no', e || '—']; return `<i class="d ${c}" title="${esc(t)}"></i>`; };
const chip = (e) => { const [c, t] = EVID[e] || ['no', e || '—']; return `<span class="ev ${c}">${esc(t)}</span>`; };

function branchOf(l, center, ents) {
  const otherIsTo = l.from === center;
  const other = ents[otherIsTo ? l.to : l.from] || {};
  const r = l.relation;
  if (other.kind === 'person' || r === 'director_of' || r === 'commissioner_of') return 'people';
  if (r === 'owns' || r === 'invested_in') return otherIsTo ? 'holdings' : 'owners';
  if (r === 'joint_venture' && ['fund', 'state_firm', 'government'].includes(other.kind)) return 'owners';
  if (r === 'joint_venture' || r === 'runs' || r === 'brand_of' || other.kind === 'campus') return 'holdings';
  if (r === 'founded') return otherIsTo ? 'holdings' : 'owners';
  if (r === 'tenant_of') return otherIsTo ? 'partners' : 'customers';
  if (r === 'supplies_power' || r === 'renewable_deal' || other.kind === 'utility') return 'power';
  if (r === 'lends_to') return otherIsTo ? 'holdings' : 'finance';
  if (r === 'supplies' && /\bland\b|\bplot\b|\bhectare/i.test(l.detail || '')) return 'partners';
  if (r === 'built' || r === 'designed' || r === 'supplies' || r === 'certifies') return otherIsTo ? 'customers' : 'builders';
  return 'partners';
}

const WEB_CSS = `
.sw{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 22px}
.sw .chip.on{background:#000;color:#fff;border-color:#000}
@media(max-width:760px){.sw{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin:0 -20px 22px;padding:0 20px}.sw::-webkit-scrollbar{display:none}.sw .chip{flex:0 0 auto}}
.bl{border:1px solid #E7E7E7;padding:20px 22px;margin-top:22px;font-size:16px;line-height:1.6}
.bl .k{display:block;margin-bottom:10px}
.ev{display:inline-flex;align-items:center;gap:6px;font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;padding:4px 6px;border:1px solid;white-space:nowrap;vertical-align:1px}
.ev.ok{color:#2F7A5C;border-color:#2F7A5C}.ev.only{color:#4E7A96;border-color:#4E7A96}.ev.part{color:#9A7B4F;border-color:#C9B79A}.ev.no{color:#8E8E93;border-color:#D9D9DE}
.d{width:9px;height:9px;flex:none;display:inline-block;border-radius:50%}
.d.ok{background:#2F7A5C}.d.only{background:#fff;box-shadow:inset 0 0 0 2px #4E7A96}.d.part{background:#C9A15B;border-radius:1px}.d.no{width:10px;height:3px;border-radius:0;background:#B4B4B8}
.legend{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:12px;color:#8E8E93;margin:34px 0 18px}
.map{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 250px minmax(0,1fr);gap:0 60px;align-items:center}
.col{display:grid;gap:22px;align-content:center;min-width:0;position:relative;z-index:2}
.hub{position:relative;z-index:2;border:1.5px solid #000;background:#fff;padding:18px 16px 16px;display:grid;gap:5px;text-align:center}
.hub::before{content:"";position:absolute;left:-1.5px;right:-1.5px;top:-1.5px;height:4px;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)}
.hub .nm2{font-size:24px;line-height:1.1;letter-spacing:-0.02em;font-weight:600;overflow-wrap:anywhere}
.hub p{font-size:12.5px;color:#52525B;line-height:1.45}
.br{display:grid;gap:8px;min-width:0}
.bh{display:grid;gap:2px}
.bh b{justify-self:start;background:#000;color:#fff;font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;padding:6px 9px}
.bh span{font-size:12px;color:#8E8E93}
.col.l .bh{justify-items:end;text-align:right}.col.l .bh b{justify-self:end}
.leaves{list-style:none;display:flex;flex-direction:column;gap:6px}
.col.l .leaves{align-items:flex-end}
.leaves li{display:grid;gap:2px;max-width:100%;min-width:0}
.col.l .leaves li{justify-items:end;text-align:right}
.leaf{display:inline-flex;align-items:center;gap:8px;max-width:100%;border:1px solid #000;padding:6px 10px;text-decoration:none;background:#fff}
.leaf:hover{background:#F6F6F6}
.leaf.person{border-style:dashed}
.leaf.campus{background:#F4F7FB}
.leaf .nm{font-size:14px;font-weight:500;min-width:0;overflow-wrap:anywhere}
.leaf .rw{font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#8E8E93;white-space:nowrap}
.leaves .sub{font-size:11.5px;color:#8E8E93;padding:0 2px;max-width:38ch;overflow-wrap:anywhere}
svg.wires{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible}
svg.wires path{fill:none;stroke:#000;stroke-width:1}
.cap{color:#8E8E93;font-size:12.5px;line-height:1.55;max-width:88ch;margin-top:18px}
.grp{margin-top:44px}
.grp h2{font-size:clamp(22px,2.6vw,30px);letter-spacing:-0.025em;font-weight:500;margin-bottom:12px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.card{background:#fff;padding:16px 16px 14px;display:flex;flex-direction:column;gap:7px;min-width:0;scroll-margin-top:16px}
.card:target{outline:2px solid #000;outline-offset:-2px}
.nh{display:flex;justify-content:space-between;gap:8px;align-items:center;min-width:0}
.nh .kk{font:400 10px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8E8E93;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card h3{font-size:17px;font-weight:500;letter-spacing:-0.015em;overflow-wrap:anywhere}
.card .lgl,.card .wh{font-size:12.5px;color:#8E8E93;line-height:1.5;overflow-wrap:anywhere}
.ties{list-style:none;display:grid;gap:7px;font-size:13px;line-height:1.5;color:#3F3F46;overflow-wrap:anywhere}
.ties b{font-weight:600;color:#000}
.ties a,.card .srcs a{color:#8E8E93;font-size:11.5px;text-decoration:none;border-bottom:1px solid #E7E7E7}
.s2{border-top:1px solid #F1F1F1;padding-top:8px}
.card .srcs{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:auto;padding-top:4px}
.also{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center}
.also .k{margin-right:2px}
.also a{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;border:1px solid #000;padding:4px 6px;text-decoration:none}
.also a:hover{background:#000;color:#fff}
.onmap{margin-top:40px}
.onmap ul{list-style:none;display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.onmap a{display:inline-flex;gap:6px;align-items:center;border:1px solid #E7E7E7;padding:6px 10px;text-decoration:none;font-size:13px}
.onmap a:hover{border-color:#000}
.onmap small{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;color:#8E8E93}
@media(max-width:1060px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:980px){
  .map{grid-template-columns:minmax(0,1fr);gap:0}
  .hub{order:-1;text-align:left}
  .col{border-left:1px solid #000;margin-left:12px;padding:22px 0 0 22px}
  .col.l .bh,.col.l .leaves li{justify-items:start;text-align:left}.col.l .bh b{justify-self:start}.col.l .leaves{align-items:flex-start}
  .br{position:relative}
  .br::before{content:"";position:absolute;left:-23px;top:13px;width:18px;border-top:1px solid #000}
  svg.wires{display:none}
}
@media(max-width:640px){.cards{grid-template-columns:minmax(0,1fr)}.leaf .rw{display:none}}
`;

function web({ slug, lang = 'en' }) {
  const D = load();
  const w = loadWeb(slug);
  if (!D || !w) return null;
  const also = {};
  (D.connectors || []).forEach((c) => {
    const me = c.webs.find((x) => x.slug === slug);
    if (me) also[me.id] = c.webs.filter((x) => x.slug !== slug);
  });
  const alsoHtml = (id) => (also[id] && also[id].length ? `<p class="also"><span class="k">Also in</span>${also[id].map((x) => `<a href="/data-center/${esc(x.slug)}#n-${esc(x.id)}">${esc(SHORT[x.slug] || x.slug)}</a>`).join('')}</p>` : '');
  const ents = {};
  (w.entities || []).forEach((e) => { ents[e.id] = e; });
  const links = w.links || [];
  const C = ents[w.center] || { name: w.title };
  const name = (id) => (ents[id] || {}).name || id;
  const ring1 = {};
  links.forEach((l) => {
    if (l.from !== w.center && l.to !== w.center) return;
    const other = l.from === w.center ? l.to : l.from;
    const b = branchOf(l, w.center, ents);
    ((ring1[b] = ring1[b] || {})[other] = ring1[b][other] || []).push(l);
  });
  const first = new Set(Object.values(ring1).flatMap((b) => Object.keys(b)));
  const ring2 = {};
  links.forEach((l) => {
    if (l.from === w.center || l.to === w.center) return;
    if (first.has(l.from)) (ring2[l.from] = ring2[l.from] || []).push([l.to, l]);
    else if (first.has(l.to)) (ring2[l.to] = ring2[l.to] || []).push([l.from, l]);
  });
  const best = (ls) => ls.slice().sort((x, y) => erank(x) - erank(y))[0];
  const side = { l: [], r: [] };
  let nEnt = 0;
  BRANCHES.forEach(([key, title, sub, s]) => {
    if (!ring1[key]) return;
    const leaves = Object.entries(ring1[key]).map(([id, ls]) => {
      nEnt += 1;
      const o = ents[id] || { name: id };
      const b = best(ls);
      const sn = [...new Set((ring2[id] || []).map(([x]) => name(x)))];
      return `<li><a class="leaf${o.kind === 'person' ? ' person' : ''}${o.kind === 'campus' ? ' campus' : ''}" href="#n-${esc(id)}">${dot(b.evidence)}<span class="nm">${esc(o.name)}</span><span class="rw">${esc(relWords(b.relation))}</span></a>${
        sn.length ? `<span class="sub">${esc(sn.slice(0, 4).join(' · '))}${sn.length > 4 ? ` +${sn.length - 4}` : ''}</span>` : ''}</li>`;
    }).join('');
    side[s].push(`<section class="br"><div class="bh"><b>${esc(title)}</b><span>${esc(sub)}</span></div><ul class="leaves">${leaves}</ul></section>`);
  });
  const detail = BRANCHES.filter(([key]) => ring1[key]).map(([key, title]) => {
    const cards = Object.entries(ring1[key]).map(([id, ls]) => {
      const o = ents[id] || { name: id };
      const b = best(ls);
      const ties = ls.slice().sort((x, y) => erank(x) - erank(y)).map((l) =>
        `<li><b>${esc(relWords(l.relation))}</b> · ${esc(l.detail || '')}${l.date ? ' · ' + esc(l.date) : ''} ${chip(l.evidence)} ${a(l.source_url, 'source ↗', l.quote)}</li>`).join('');
      const s2 = (ring2[id] || []).map(([x, l]) =>
        `<li><b>${esc(relWords(l.relation))}</b> ${esc(name(x))}: ${esc(l.detail || '')}${l.date ? ' · ' + esc(l.date) : ''} ${chip(l.evidence)} ${a(l.source_url, 'source ↗', l.quote)}</li>`).join('');
      const srcs = (o.sources || []).slice(0, 4).map((u) => a(u, host(u) + ' ↗')).join('');
      return `<article class="card" id="n-${esc(id)}">
  <div class="nh"><span class="kk">${esc(KIND[o.kind] || o.kind || '')}${o.city ? ' · ' + esc(String(o.city).split(/[(;,]/)[0].trim().slice(0, 40)) : ''}</span>${chip(b.evidence)}</div>
  <h3>${esc(o.name)}</h3>
  ${o.legal_name && o.legal_name !== o.name ? `<p class="lgl">${esc(o.legal_name)}</p>` : ''}
  ${o.what ? `<p class="wh">${esc(o.what)}</p>` : ''}
  <ul class="ties">${ties}</ul>
  ${s2 ? `<ul class="ties s2">${s2}</ul>` : ''}
  ${alsoHtml(id)}
  ${srcs ? `<p class="srcs">${srcs}</p>` : ''}
</article>`;
    }).join('');
    return `<section class="grp"><h2>${esc(title)}</h2><div class="cards">${cards}</div></section>`;
  }).join('');
  const onmap = D.projects.filter((x) => (w.operators || []).includes(x.op));
  const cellName = (k) => (k === 'unplaced' ? 'not placed' : (D.cells[k] || {}).title || k);
  const nOwn = Object.keys(ring1.owners || {}).length;
  const nHold = Object.keys(ring1.holdings || {}).length;
  const sw = (D.webs || []).map((x) => `<a class="chip${x.slug === w.slug ? ' on' : ''}" href="/data-center/${esc(x.slug)}"${x.slug === w.slug ? ' aria-current="page"' : ''}>${esc(x.title)}</a>`).join('');
  const p = '/data-center/' + w.slug;
  const body = `
<style>${CSS}${WEB_CSS}</style>
<main class="wrap">
  <nav class="sw" aria-label="Data-centre groups"><a class="chip" href="/data-center">← All data centres</a>${sw}</nav>
  <div class="eyebrow"><span class="sq"></span>COMPANY WEB · DATA CENTRES${C.city ? ' · ' + esc(String(C.city).split(/[(;,]/)[0].trim().toUpperCase()) : ''}</div>
  <h1>Who owns, powers and builds ${esc(w.title)}</h1>
  ${w.bottom_line ? `<div class="bl"><span class="k">Bottom line</span>${esc(w.bottom_line)}</div>` : ''}
  <div class="stats" style="margin-top:14px;width:100%">
    <div class="cell"><div class="v">${nEnt}</div><div class="k">tied directly to ${esc(w.title)}</div></div>
    <div class="cell"><div class="v">${nOwn}</div><div class="k">owners and investors</div></div>
    <div class="cell"><div class="v">${nHold}</div><div class="k">campuses, units and joint ventures</div></div>
    <div class="cell"><div class="v">${w.counts.links}</div><div class="k">sourced ties · ${w.counts.confirmed} confirmed</div></div>
  </div>
  <div class="legend"><span class="mono">Evidence:</span>${chip('confirmed')}${chip('company_claim')}${chip('snippet')}${chip('inferred')}<span>· dashed box = a person · tinted box = a campus · a name opens its card below</span></div>
  <div class="map" id="map">
    <svg class="wires" id="wires" aria-hidden="true"></svg>
    <div class="col l">${side.l.join('')}</div>
    <div class="hub" id="hub"><span class="k">The subject</span><span class="nm2">${esc(C.name)}</span>
      ${C.legal_name && C.legal_name !== C.name ? `<p>${esc(C.legal_name)}</p>` : ''}${C.what ? `<p>${esc(C.what)}</p>` : ''}</div>
    <div class="col r">${side.r.join('')}</div>
  </div>
  <p class="cap">${esc(w.title)} sits in the middle; each branch is one kind of tie. Grey lines under a name are that company's or person's own ties, such as a director's other firms or an investor's other holdings.</p>
  ${onmap.length ? `<section class="onmap"><div class="eyebrow"><span class="sq"></span>ITS PROJECTS ON THE POWER MAP</div><ul>${onmap.map((x) => `<li><a href="/data-center#p-${esc(x.id)}">${mark(x.logo, x.op)}<span>${esc(x.name)}</span><small>${esc(cellName(x.cell))}</small></a></li>`).join('')}</ul></section>` : ''}
  ${detail}
  <div class="method" style="margin-top:44px"><p>One research pass in Oct 2026 over company and investor sites, annual reports and filings, regulator and PLN releases, and news. Sites whose robots.txt blocks AI agents were not fetched, and the paid company register (AHU) was not checked, so a stake appears only where a source states it. ${esc(w.title)} research checked ${esc(String(w.checked_utc || '').slice(0, 10))}.</p></div>
</main>
<script src="/js/cncweb.js?v=${ver('cncweb.js')}" defer></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'Data centres', path: '/data-center' }, { name: w.title, path: p }];
  return shell({
    title: `${w.title}: who owns, powers and builds it — 1001startup.id`,
    desc: `Company web for ${w.title}: owners, campuses, tenants, power, builders, lenders and people — ${w.counts.links} sourced ties.`,
    path: p, lang, body, ld: SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { page, web, load };
