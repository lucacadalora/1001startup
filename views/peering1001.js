'use strict';
/* 1001startup.id/peering — where Indonesia's networks meet, as PeeringDB lists it.
 *
 * Luca, 18 Oct 2026, with PeeringDB's site and its Google Earth file: "mapping all
 * indonesia peering/router/datacenter, if we dont have the name/alias of the
 * datacenter, just make it grey", on the 1001 map, as a page of its own beside
 * /data-center. So this is three layers on the /map engine (MapLibre over our own
 * tiles, public/js/peering1001.js): every facility PeeringDB lists in Indonesia,
 * every exchange and where it sits, and every router port on those exchanges,
 * placed at its data centre when PeeringDB says which one. A place nobody can name
 * is a grey dot; so is a port whose data centre PeeringDB doesn't give.
 *
 * Data: data/peering.json from scripts/peering-build.py (PeeringDB API pull plus a
 * research pass that checked each facility's name, aliases and pin, with sources).
 * Read per request with an mtime cache, so a rebuild needs no restart. English only.
 * The page shows counts of router ports, never their addresses.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const { reachLive } = require('../lib/peeringlive');

const DATA = path.join(__dirname, '..', 'data', 'peering.json');
const MAPDATA = path.join(__dirname, '..', 'data', 'peering-map.json');
let cache = { mtime: -1, data: null, raw: '' };
function fresh() {
  let mtime = 0;
  try { mtime = fs.statSync(DATA).mtimeMs; } catch (e) { return null; }
  if (mtime !== cache.mtime) {
    try { const raw = fs.readFileSync(DATA, 'utf8'); cache = { mtime, data: JSON.parse(raw), raw }; } catch (e) { /* mid-write: keep the last good copy */ }
  }
  return cache.data ? cache : null;
}
const load = () => { const c = fresh(); return c && c.data; };
/* the map script's slimmer copy (no sources or notes), sent as stored */
let mapCache = { mtime: -1, raw: '' };
const raw = () => {
  let mtime = 0;
  try { mtime = fs.statSync(MAPDATA).mtimeMs; } catch (e) { return null; }
  if (mtime !== mapCache.mtime) { try { mapCache = { mtime, raw: fs.readFileSync(MAPDATA, 'utf8') }; } catch (e) { /* mid-write */ } }
  return mapCache.raw || null;
};
/* The Trace view (Luca, 18 Oct 2026: "i send messages in solo/surakarta, how it reach in
   singapore ... how many route/ping it reach before going to singapore"; then "put the
   Trace view live on dc.1001startup.id"): real traceroutes from data/peering-trace.json
   (scripts/peering-trace-build.py), drawn hop by hop on the map. On while
   data/peering-trace.live exists (removing it hides the chip and the section within 10 s,
   no restart), or with PEERING_TRACE=1 on a test port. Read per request with an mtime
   cache, like the map's data. */
const TRACE = path.join(__dirname, '..', 'data', 'peering-trace.json');
const TRACE_FLAG = path.join(__dirname, '..', 'data', 'peering-trace.live');
let traceCache = { mtime: -1, data: null };
let traceOn = { at: 0, on: false };
function trace() {
  if (process.env.PEERING_TRACE !== '1') {
    const now = Date.now();
    if (now - traceOn.at > 10000) traceOn = { at: now, on: fs.existsSync(TRACE_FLAG) };
    if (!traceOn.on) return null;
  }
  let mtime = 0;
  try { mtime = fs.statSync(TRACE).mtimeMs; } catch (e) { return null; }
  if (mtime !== traceCache.mtime) { try { traceCache = { mtime, data: JSON.parse(fs.readFileSync(TRACE, 'utf8')) }; } catch (e) { /* mid-write: keep the last good copy */ } }
  return traceCache.data;
}
const ver = (file) => { try { return String(Math.floor(fs.statSync(path.join(__dirname, '..', 'public', 'js', file)).mtimeMs / 1000)); } catch (e) { return '0'; } };
const GL = '/js/vendor/maplibre-gl-6.11.2';
/* the page lives on its own host; links into the rest of 1001 go to the main one */
const HOME = 'https://dc.1001startup.id/';
const MAIN = 'https://1001startup.id';
const n0 = (v) => Number(v || 0).toLocaleString('en-US');
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return 'source'; } };
const link = (u, t, q) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener nofollow"${q ? ` title="${esc(q)}"` : ''}>${esc(t || host(u))}</a>` : '');
const initials = (n) => String(n || '?').replace(/^(PT|CV)\.?\s+/i, '').split(/[\s/&+()-]+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const mark = (src, name, grey) => (grey
  ? '<span class="mk grey" aria-hidden="true"></span>'
  : src ? `<img class="mk" src="${esc(src)}" alt="" width="22" height="22" loading="lazy">` : `<span class="mk mono-mk" aria-hidden="true">${esc(initials(name))}</span>`);
const KIND = {
  colocation: 'Colocation', 'telco-dc': 'Telco data centre', 'isp-pop': 'ISP site', 'ix-node': 'Exchange site',
  'cable-landing': 'Cable landing', 'enterprise-dc': 'Company data centre', 'government-dc': 'Government data centre', office: 'Office', unknown: '',
};
const STATUS = { operating: '', closed: 'Closed', planned: 'Planned', unknown: '' };
/* one row per source: what it shows, the link, the words quoted from it */
const srcList = (rows) => (rows.length
  ? rows.map((s, i) => `<li class="src"><span>${i ? '' : rows.length > 1 ? 'Sources' : 'Source'}</span><div>${s.what ? `${esc(s.what.replace(/[.;:]\s*$/, ''))}: ` : ''}${link(s.u, s.t)}${s.q ? `<q>${esc(s.q)}</q>` : ''}</div></li>`).join('')
  : '<li class="src"><span>Source</span><div>PeeringDB only</div></li>');

/* the five lines under the stats, worked out from the data so they never drift */
function bottomLine(D) {
  const T = D.totals;
  const F = new Map(D.facs.map((f) => [f.id, f]));
  const top = D.places.slice().sort((a, b) => b.nets - a.nets)[0];
  const multi = D.places.filter((p) => p.facs.length > 1).sort((a, b) => b.facs.length - a.facs.length)[0];
  /* Greater Jakarta by position (Jabodetabek), the other cities by grouping places
     within 25 km of each other, so spelling ("Kota Bandung", "Bandung") can't split a city */
  const inJkt = (p) => p.lat > -6.8 && p.lat < -5.9 && p.lng > 106.35 && p.lng < 107.22;
  const jkt = D.facs.filter((f) => f.lat != null && inJkt(f)).length;
  const rest = D.places.filter((p) => !inJkt(p));
  const km = (a, b) => { const r = Math.PI / 180, x = (b.lng - a.lng) * r * Math.cos((a.lat + b.lat) * r / 2), y = (b.lat - a.lat) * r; return 6371 * Math.hypot(x, y); };
  const grp = rest.map((_, i) => i);
  const root = (i) => (grp[i] === i ? i : (grp[i] = root(grp[i])));
  rest.forEach((a, i) => rest.forEach((b, j) => { if (j > i && km(a, b) < 25) grp[root(j)] = root(i); }));
  const cities = new Set(rest.map((_, i) => root(i))).size;
  const bigIx = D.ixs.slice().sort((a, b) => b.nets - a.nets).slice(0, 2);
  const out = [];
  if (top) out.push(`<b>${esc(top.n)}</b> is the busiest place: ${n0(top.nets)} networks list equipment there${top.facs.length > 1 ? `, across ${top.facs.length} facilities in one building` : ''}.`);
  out.push(`<b>${n0(jkt)} of ${n0(T.fac)}</b> facilities are in Greater Jakarta. The rest are spread over ${n0(cities)} other cities.`);
  if (multi && multi !== top) out.push(`<b>${esc(multi.n)}</b> holds ${multi.facs.length} separate PeeringDB facilities under one roof: ${multi.facs.slice(0, 3).map((i) => esc((F.get(i) || {}).n || '')).join(', ')}${multi.facs.length > 3 ? ' and more' : ''}.`);
  if (bigIx.length === 2) out.push(`The two biggest exchanges are <b>${esc(bigIx[0].pdb)}</b> (${n0(bigIx[0].nets)} networks) and <b>${esc(bigIx[1].pdb)}</b> (${n0(bigIx[1].nets)}).`);
  out.push(`<b>${pct(T.ports_grey, T.ports)}%</b> of the ${n0(T.ports)} router ports on Indonesian exchanges can't be tied to a data centre we can name, so they sit grey on their exchange's city.`);
  if (T.links) out.push(`<b>${n0(T.link_ix)} exchanges</b> have switches in more than one named data centre. The Network layer draws those ${n0(T.links)} links: a line means the same exchange is in both buildings, not a cable route.`);
  return out;
}

function facRow(D, f) {
  const ixName = new Map(D.ixs.map((x) => [x.id, x.pdb]));
  const k = [KIND[f.kind], STATUS[f.status]].filter(Boolean).join(' · ');
  const aka = f.aka.length ? `<small class="aka">Also: ${f.aka.map(esc).join(' · ')}</small>` : '';
  const pdbLine = f.pdb !== f.n ? `<li><span>PeeringDB name</span>${esc(f.pdb)}</li>` : '';
  const srcs = srcList(f.src);
  const pin = { building: 'Pin checked to the building', street: 'Pin checked to the street', 'pdb-unverified': 'PeeringDB’s pin, not checked', city: 'No address we could place: pinned to the city centre', none: 'No pin' }[f.cq] || '';
  return `<details class="fr${f.grey ? ' is-grey' : ''}" id="f-${f.id}" data-q="${esc([f.n, f.pdb, ...f.aka, f.op, f.opl, f.city, f.bld].join(' ').toLowerCase())}" data-grey="${f.grey ? 1 : 0}" data-city="${esc((f.city || '').toLowerCase())}">
<summary><span class="nm">${mark(f.logo, f.op || f.n, f.grey)}<span><b>${esc(f.grey ? f.pdb : f.n)}</b>${f.grey ? '<small class="aka">Grey: we can’t name this data centre</small>' : aka}</span></span><span class="op">${esc(f.op)}</span><span class="ct">${esc(f.city)}</span><span class="n">${n0(f.nets)}</span><span class="n">${f.ixs.length || ''}</span></summary>
<div class="fd">
  ${f.note ? `<p>${esc(f.note)}</p>` : ''}
  <ul class="kv">
    ${pdbLine}
    ${f.opl && f.opl !== f.op ? `<li><span>Company</span>${esc(f.opl)}${f.grp ? ` · ${esc(f.grp)}` : ''}</li>` : ''}
    ${f.addr ? `<li><span>Address</span>${esc(f.addr)}</li>` : ''}
    ${k ? `<li><span>What it is</span>${esc(k)}</li>` : ''}
    ${f.ixs.length ? `<li><span>Exchanges here</span>${f.ixs.map((i) => esc(ixName.get(i) || '')).join(', ')}</li>` : ''}
    ${f.car.length ? `<li><span>Carriers here</span>${f.car.map(esc).join(', ')}</li>` : ''}
    ${f.our ? `<li><span>On /data-center</span><a href="${MAIN}/data-center#p-${esc(f.our)}">${esc(f.our_n)}</a></li>` : ''}
    <li><span>Pin</span>${esc(pin)}${f.moved >= 1000 ? ` (moved ${n0(Math.round(f.moved / 100) / 10)} km from PeeringDB’s)` : ''}</li>
    ${srcs}
  </ul>
  <p class="acts">${f.place ? `<button type="button" class="btn sm" data-show="${esc(f.place)}">Show on the map</button>` : ''}<a class="btn sm" href="https://www.peeringdb.com/fac/${f.id}" target="_blank" rel="noopener nofollow">PeeringDB entry</a></p>
</div>
</details>`;
}

/* the Trace view's section under the map: one block per route (the map's route chips pick
   which is shown), every hop with where it is and how we know, then the limits */
const msTxt = (v) => (v == null ? '' : `${Number(v).toFixed(1)} ms`);
function tracePanel(TR) {
  const P = TR.places;
  const day = new Date(TR.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const routes = TR.routes.map((r, i) => {
    const rows = r.hops.map((h) => `<li data-hop="${h.n}"${h.silent ? ' class="is-silent"' : ''}><span class="hn">${h.n}</span><span class="hw">${esc(h.where)}</span><span class="hnet">${esc(h.net)}</span><span class="hms">${h.silent ? 'no reply' : esc(msTxt(h.ms))}${h.slow ? ' <span class="gtag">slow reply</span>' : ''}</span><span class="hhow">${esc(h.how)}</span></li>`).join('');
    const house = r.in_house ? `${r.in_house} of them in the house` : r.stops.length > 2 ? `in ${r.stops.slice(0, -1).map((s) => P[s.at].n.replace(/, likely$/, '')).join(' and ')}` : '';
    return `<div class="tr-route" data-route="${esc(r.id)}"${i ? ' hidden' : ''}>
  <h3>${esc(r.label)}<small>Tested ${esc(day)}, ${esc(r.when.slice(11, 16))} UTC</small></h3>
  <p class="tr-story">${esc(r.story)}</p>
  <div class="tr-kp">
    <div><b>${r.hops.length}</b><span>hops in all</span></div>
    <div><b>${r.before}</b><span>hops before Singapore${house ? `<br>${esc(house)}` : ''}</span></div>
    <div><b>${esc(msTxt(r.fast_ms))}</b><span>fastest round trip<br>typical ${esc(msTxt(r.avg_ms))}</span></div>
    <div><b>${esc(msTxt(r.floor_ms))}</b><span>light’s best in fibre<br>${n0(r.km)} km straight line</span></div>
  </div>
  <div class="tr-hops"><div class="thd" role="presentation"><span>Hop</span><span>Where</span><span>Network</span><span>Round trip</span><span>How we know where it is</span></div><ol>${rows}</ol></div>
  <p class="tr-line">The line: ${esc(r.line)}.${r.place_on_map ? ` <button type="button" class="btn sm" data-show="${esc(r.place_on_map)}" data-mode="dc">Show Citranet DC Surakarta on the map</button>` : ''}</p>
</div>`;
  }).join('');
  return `<section class="wrap pm-trace" id="trace" hidden>
  <div class="eyebrow"><span class="sq"></span>TRACE A MESSAGE · SOLO TO SINGAPORE · TESTED ${esc(day.toUpperCase())}</div>
  <p class="lede">What happens to a message sent from Solo to a server in Singapore. Each hop is a router that passes it on: the test (a traceroute) gets every router on the way to answer in turn and times each answer. Three real tests: one from Solo, and two from nearby Yogyakarta and Sleman on other networks.</p>
  ${routes}
  <ul class="tr-warn">
    <li>One test device per city and network, tested once. Your own line may take another road, and roads change.</li>
    <li>Times are round trips, there and back, the way ping counts them. The map plays the trip ${n0(TR.slow)} times slower than it really is, and shows hops at the same place a beat apart so each one can be read.</li>
    <li>A hop is a router that answered. Some networks pass traffic through tunnels that hide their routers (Telkom hides Jakarta here), and some routers don’t answer at all.</li>
    <li>Places come from router names, address records and delay, never from a guess at a building. Jakarta is worked out from delay alone.</li>
    <li>The line on the map shows the order of the hops, not where the cable runs.</li>
    <li>A chat message, on WhatsApp for example, goes to the app’s own server first, not straight to the person.</li>
  </ul>
  <p class="tr-src">Tests: <a href="https://globalping.io/" target="_blank" rel="noopener">Globalping</a> volunteer test devices, mtr to ${esc(TR.target.host)} · address owners: <a href="https://stat.ripe.net/" target="_blank" rel="noopener">RIPEstat</a> · buildings: PeeringDB · map © OpenStreetMap, Protomaps</p>
</section>`;
}

function ixRow(D, x) {
  const F = new Map(D.facs.map((f) => [f.id, f]));
  const sites = x.sites.map((i) => F.get(i)).filter(Boolean);
  const where = sites.length
    ? sites.slice(0, 4).map((f) => esc(f.grey ? f.pdb : f.n)).join(', ') + (sites.length > 4 ? ` and ${sites.length - 4} more` : '')
    : `${esc(x.city)} <span class="gtag">site unknown</span>`;
  const srcs = srcList(x.src);
  return `<details class="fr${x.grey ? ' is-grey' : ''}" id="x-${x.id}" data-q="${esc([x.n, x.pdb, ...x.aka, x.op, x.city].join(' ').toLowerCase())}" data-grey="${x.grey ? 1 : 0}">
<summary><span class="nm">${mark(x.logo, x.op || x.pdb, x.grey)}<span><b>${esc(x.pdb)}</b>${x.n !== x.pdb ? `<small class="aka">${esc(x.n)}</small>` : ''}</span></span><span class="op">${esc(x.op)}</span><span class="ct">${where}</span><span class="n">${n0(x.nets)}</span><span class="n">${n0(x.ports)}</span></summary>
<div class="fd">
  ${x.note ? `<p>${esc(x.note)}</p>` : ''}
  <ul class="kv">
    ${x.aka.length ? `<li><span>Also known as</span>${x.aka.map(esc).join(' · ')}</li>` : ''}
    ${x.opl ? `<li><span>Company</span>${esc(x.opl)}</li>` : ''}
    ${x.kind ? `<li><span>What it is</span>${esc(x.kind)}</li>` : ''}
    ${x.status && x.status !== 'operating' && x.status !== 'unknown' ? `<li><span>Status</span>${esc(x.status)}</li>` : ''}
    ${srcs}
  </ul>
  <p class="acts">${sites.length && sites[0].place ? `<button type="button" class="btn sm" data-show="${esc(sites[0].place)}" data-mode="ix">Show on the map</button>` : ''}<a class="btn sm" href="https://www.peeringdb.com/ix/${x.id}" target="_blank" rel="noopener nofollow">PeeringDB entry</a></p>
</div>
</details>`;
}

const CSS = `
.pm-map [hidden],.flist [hidden]{display:none!important}
.pm-hero{padding-bottom:22px}
.pm-wrap{position:relative;height:clamp(460px,70vh,820px);background:#E1EAEC;overflow:hidden}
#pm-map{position:absolute;inset:0}
#pm-map .maplibregl-canvas{outline:none}
/* the layer chips sit in a bar above the map and the key in a strip below it:
   nothing but the zoom buttons is drawn over the map, so no chip or key box
   can cover a name */
.pm-map{border-top:1px solid #E7E7E7;border-bottom:1px solid #E7E7E7}
.pm-rail{display:flex;gap:8px;padding:12px 16px;overflow-x:auto;scrollbar-width:none;background:#fff;border-bottom:1px solid #E7E7E7}
.pm-rail::-webkit-scrollbar{display:none}
.pm-rail > *{flex:none}
.pm-rail .chip{cursor:pointer;background:#fff;color:#52525B}
.pm-rail .chip[aria-pressed="true"]{background:#000;border-color:#000;color:#fff}
.pm-rail .chip[aria-pressed="true"] b{color:#C7C7CC}
/* the zoom buttons live in the strip under the map, not on it: nothing HTML is
   drawn over the map's names */
.pm-ctl{display:flex;flex:none;background:#fff;border:1px solid #E7E7E7;align-self:center}
.pm-ctl button{width:40px;height:36px;border:0;background:none;font-size:16px;cursor:pointer;color:#000}
.pm-ctl button + button{border-left:1px solid #E7E7E7}
.pm-ctl button:hover{background:#FAFAFA}
/* the site's docked contact tab (views/builder1001.js) stays out of the way while
   the map is behind it, and while a place card is open */
body.pm-over-map .b1 .b1-tab{visibility:hidden!important;pointer-events:none}
.pm-key{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;background:#fff;border-top:1px solid #E7E7E7;padding:10px 16px;font:400 10.5px/1.5 'IBM Plex Mono',monospace;letter-spacing:.03em;text-transform:uppercase;color:#52525B}
.pm-legend{min-width:0}
.pm-key .row{display:flex;gap:14px;flex-wrap:wrap;align-items:center}
.pm-key i{display:inline-block;vertical-align:-2px;margin-right:6px}
.pm-key .d{width:11px;height:11px;border-radius:50%;background:#0B0B0C;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.12)}
.pm-key .g{width:11px;height:11px;border-radius:50%;background:#A6A9AE;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.10)}
.pm-key .lg{width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.18),0 2px 4px rgba(0,0,0,.18)}
.pm-key .sq{width:11px;height:11px;background:#0B0B0C;border-radius:2px}
.pm-key .sqg{width:11px;height:11px;background:#A6A9AE;border-radius:2px}
.pm-key .ln{width:18px;height:3px;border-radius:2px;background:#2F8FE8;vertical-align:2px}
.pm-key .cr{margin-top:5px;color:#8E8E93}
.pm-key .cr a{color:inherit}
.pm-tip{position:absolute;pointer-events:none;background:#000;color:#fff;font-size:12.5px;font-weight:500;padding:5px 11px;transform:translate(-50%,-150%);white-space:nowrap;z-index:6;max-width:320px;overflow:hidden;text-overflow:ellipsis}
.pm-card{position:absolute;z-index:7;top:16px;right:16px;bottom:16px;width:min(380px,calc(100% - 32px));background:#fff;border:1px solid #000;box-shadow:0 14px 34px rgba(0,0,0,.12);display:flex;flex-direction:column}
.pm-card .hd{display:flex;gap:10px;align-items:flex-start;padding:14px 14px 12px;border-bottom:1px solid #E7E7E7}
.pm-card .hd h3{font-size:18px;line-height:1.2;letter-spacing:-.015em;font-weight:600;flex:1}
.pm-card .hd small{display:block;font-weight:500;font-size:13px;color:#6B6B73;margin-top:3px;letter-spacing:0}
.pm-card .x{border:1px solid #E7E7E7;background:#fff;width:32px;height:32px;cursor:pointer;font-size:16px;flex:none}
.pm-card .bd{overflow-y:auto;overscroll-behavior:contain;padding:12px 14px 16px;font-size:14px}
.pm-card .kp{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-bottom:14px}
.pm-card .kp div{background:#fff;padding:8px 8px 7px}
.pm-card .kp b{display:block;font-size:17px;font-weight:600;letter-spacing:-.01em}
.pm-card .kp span{font:400 9.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.pm-card h4{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73;margin:16px 0 8px}
.pm-card ul{list-style:none}
.pm-card li{padding:7px 0;border-top:1px solid #F1F1F1;line-height:1.4}
.pm-card li:first-child{border-top:0}
.pm-card .fac{display:flex;gap:10px;align-items:flex-start}
.pm-card .fac b{font-weight:600}
.pm-card .fac small{display:block;color:#6B6B73;font-size:12.5px}
.pm-card .fac small a{color:#0000EE}
.pm-card .net{display:flex;justify-content:space-between;gap:10px;font-size:13px}
.pm-card .net span:last-child{font:400 11px/1.6 'IBM Plex Mono',monospace;color:#6B6B73;white-space:nowrap}
.pm-card .more{border:1px solid #E7E7E7;background:#fff;padding:8px 10px;margin-top:8px;cursor:pointer;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;width:100%}
.pm-card p{color:#52525B;line-height:1.5;margin-bottom:10px}
.rch{border:1px solid #E7E7E7;padding:12px;margin:4px 0 6px}
.rch .big{font-size:15px;line-height:1.4;color:#18181B;margin-bottom:10px}
.rch .big b{font-size:22px;font-weight:600;letter-spacing:-.02em;display:block;margin-bottom:2px}
.rch .isp{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:7px 0;border-top:1px solid #F1F1F1;font-size:13px}
.rch .isp:first-child{border-top:0}
.rch .isp .nm b{font-weight:600}
.rch .isp .nm small{color:#6B6B73;font-size:12px}
.rch .isp .pc{font:400 11px/1.6 'IBM Plex Mono',monospace;color:#6B6B73;text-align:right}
.rch .how{grid-column:1/-1;display:flex;gap:6px;align-items:center;font-size:12.5px;color:#3F3F46}
.rch .how i{width:9px;height:9px;border-radius:50%;flex:none;display:inline-block}
.rch .h-h i{background:#0B0B0C}.rch .h-x i{background:#52525B}.rch .h-o i{background:#fff;box-shadow:inset 0 0 0 2px #8A8D93}.rch .h-f i{background:#E4E4E7}
.rch .h-f{color:#8A8D93}
.rch .pol{font:400 9.5px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;border:1px solid #E7E7E7;padding:3px 5px;color:#52525B;margin-left:4px}
.rch > ul:not(.warn) > li{padding:0;border:0}
.rch .warn{margin-top:10px;padding-top:10px;border-top:1px solid #E7E7E7;font-size:12px;line-height:1.5;color:#52525B}
.rch .warn li{border:0;padding:3px 0 3px 12px;position:relative}
.rch .warn li:before{content:'';position:absolute;left:0;top:.75em;width:5px;height:5px;background:#A6A9AE}
.rch .srcl{margin-top:8px;font:400 10px/1.5 'IBM Plex Mono',monospace;letter-spacing:.03em;text-transform:uppercase;color:#8A8D93}
.mk{width:22px;height:22px;border-radius:50%;flex:none;border:1px solid #E7E7E7;background:#fff;object-fit:contain;display:inline-block}
.mk.grey{background:#A6A9AE;border:3px solid #fff;box-shadow:0 0 0 1px #E7E7E7}
.mono-mk{display:inline-flex;align-items:center;justify-content:center;font:600 9.5px/1 'Overused Grotesk',sans-serif;color:#6B6B73;background:#F4F5F1}
.pm-msg{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
.pm-msg p{max-width:40ch;background:#fff;border:1px solid #E7E7E7;padding:18px 20px;font-size:14.5px;color:#52525B}
.bl-list{list-style:none;display:grid;gap:10px;max-width:92ch}
.bl-list li{padding-left:18px;position:relative;line-height:1.55;color:#27272A}
.bl-list li:before{content:'';position:absolute;left:2px;top:.62em;width:6px;height:6px;background:#000}
.tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.tools input{flex:1 1 220px;min-width:0;border:1px solid #E7E7E7;padding:10px 12px;font:500 15px/1.2 'Overused Grotesk',sans-serif}
.tools .chip{cursor:pointer}
.tools .chip[aria-pressed="true"]{background:#000;border-color:#000;color:#fff}
.flist{border:1px solid #E7E7E7}
.fhd,.fr summary{display:grid;grid-template-columns:minmax(0,2.4fr) minmax(0,1.3fr) minmax(0,1.2fr) 74px 64px;gap:12px;align-items:center;padding:10px 14px}
.fhd{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;background:#FAFAFA;border-bottom:1px solid #E7E7E7}
.fhd span:nth-child(n+4){text-align:right}
.fr{border-bottom:1px solid #F1F1F1}
/* 284 rows (11,600 elements): a row is only laid out and painted near the screen;
   the size hint is the measured mean inner height when closed (desktop, then phone) */
.fr{content-visibility:auto;contain-intrinsic-size:auto 68px}
@media(max-width:760px){.fr{contain-intrinsic-size:auto 96px}}
.fr:last-child{border-bottom:0}
.fr summary{cursor:pointer;list-style:none}
.fr summary::-webkit-details-marker{display:none}
.fr summary:hover{background:#FAFAFA}
.fr[open] summary{background:#FAFAFA}
.fr .nm{display:flex;gap:10px;align-items:center;min-width:0}
.fr .nm > span{min-width:0}
.fr .nm b{font-weight:600;display:block;overflow-wrap:anywhere}
.fr .aka{display:block;color:#6B6B73;font-size:12.5px;line-height:1.35;overflow-wrap:anywhere}
.fr .op,.fr .ct{font-size:13.5px;color:#3F3F46;overflow-wrap:anywhere}
.fr .n{text-align:right;font:400 12.5px/1 'IBM Plex Mono',monospace}
.fr.is-grey .nm b{color:#6B6B73}
.gtag{font:400 9.5px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73;border:1px solid #E7E7E7;padding:2px 5px;white-space:nowrap}
.fd{padding:4px 14px 16px 46px;font-size:14px}
.fd > p{color:#3F3F46;margin:6px 0 10px;max-width:80ch;line-height:1.55}
.kv{list-style:none;display:grid;gap:6px}
.kv li{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;line-height:1.45;overflow-wrap:anywhere}
.kv li > span:first-child{font:400 10.5px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.kv a{color:#0000EE}
.kv q{display:block;color:#52525B;font-style:italic;margin-top:2px}
.kv q:before{content:'“'}.kv q:after{content:'”'}
.acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.btn.sm{padding:9px 12px;font-size:11px}
.cnt{font:400 11px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.nets{width:100%;border-collapse:collapse;min-width:620px}
.dcm summary{cursor:pointer;font-weight:600}
.dcm ul{margin:12px 0 0 18px;display:grid;gap:8px;color:#3F3F46;max-width:92ch;line-height:1.55}
.dcm a{color:#0000EE}
/* the Trace view: route chips in a second bar above the map, the live hop in the strip
   below it, every hop in the section under the map */
.pm-routes{border-top:0;padding-top:0}
.pm-routes .chip b{font-weight:500}
.pm-key .pm-now{font:500 14px/1.45 'Overused Grotesk',sans-serif;letter-spacing:0;text-transform:none;color:#0B0B0C}
.pm-key .pm-now b{font-weight:600}
.pm-key .pm-now span{color:#6B6B73;font-weight:500}
.pm-key .rg{width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 2.5px #0B0B0C,0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.12)}
.pm-trace[hidden],.pm-trace [hidden]{display:none!important}
.pm-trace h3{font-size:20px;line-height:1.25;letter-spacing:-.015em;font-weight:600;margin:6px 0 6px}
.pm-trace h3 small{display:block;font:400 10.5px/1.6 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73;margin-top:2px}
.tr-story{color:#27272A;line-height:1.55;max-width:80ch;margin-bottom:14px}
.tr-kp{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-bottom:16px;max-width:880px}
.tr-kp div{background:#fff;padding:10px 12px}
.tr-kp b{display:block;font-size:22px;font-weight:600;letter-spacing:-.02em}
.tr-kp span{font:400 10px/1.45 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.tr-hops{border:1px solid #E7E7E7}
.tr-hops ol{list-style:none}
.tr-hops .thd,.tr-hops li{display:grid;grid-template-columns:42px minmax(0,1.05fr) minmax(0,1fr) 112px minmax(0,2.6fr);gap:12px;align-items:baseline;padding:9px 14px}
.tr-hops .thd{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;background:#FAFAFA;border-bottom:1px solid #E7E7E7}
.tr-hops li{border-top:1px solid #F1F1F1;font-size:14px;line-height:1.45;transition:background .25s}
.tr-hops li:first-child{border-top:0}
.tr-hops .hn{font:500 12px/1 'IBM Plex Mono',monospace;color:#6B6B73;width:26px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #E7E7E7;transition:background .25s,color .25s}
.tr-hops .hw{font-weight:600}
.tr-hops .hnet{color:#3F3F46}
.tr-hops .hms{font:400 12.5px/1.45 'IBM Plex Mono',monospace;color:#18181B}
.tr-hops .hhow{color:#52525B;font-size:13.5px}
.tr-hops li.is-silent .hw,.tr-hops li.is-silent .hms{color:#8A8D93}
.tr-hops li.past .hn{background:#0B0B0C;border-color:#0B0B0C;color:#fff}
.tr-hops li.on{background:#EAF5FF}
.tr-hops li.on .hn{background:#0A6CFF;border-color:#0A6CFF;color:#fff}
.tr-line{color:#52525B;font-size:13.5px;line-height:1.55;margin:12px 0 30px;max-width:92ch}
.tr-line .btn{margin-left:6px;vertical-align:middle}
.tr-warn{list-style:none;display:grid;gap:7px;max-width:92ch;border-top:1px solid #E7E7E7;padding-top:16px}
.tr-warn li{padding-left:16px;position:relative;line-height:1.5;color:#3F3F46;font-size:14px}
.tr-warn li:before{content:'';position:absolute;left:2px;top:.62em;width:5px;height:5px;background:#A6A9AE}
.tr-src{margin-top:14px;font:400 10.5px/1.6 'IBM Plex Mono',monospace;letter-spacing:.03em;text-transform:uppercase;color:#8A8D93}
.tr-src a{color:inherit}
@media (max-width:760px){
  .tr-kp{grid-template-columns:repeat(2,minmax(0,1fr))}
  .tr-hops .thd{display:none}
  .tr-hops li{grid-template-columns:32px minmax(0,1fr) auto;grid-template-areas:"hn hw hms" "hn hnet hnet" "hn hhow hhow";row-gap:3px;gap:0 10px;padding:10px 12px}
  .tr-hops .hn{grid-area:hn}.tr-hops .hw{grid-area:hw}.tr-hops .hms{grid-area:hms;text-align:right}.tr-hops .hnet{grid-area:hnet;font-size:13px}.tr-hops .hhow{grid-area:hhow;font-size:13px}
  .pm-key .pm-now{font-size:13.5px}
}
@media (max-width:760px){
  .pm-wrap{height:min(72vh,640px)}
  .pm-rail{padding:10px 12px}
  .pm-key{padding:9px 12px}
  .pm-ctl button{width:38px}
  .pm-card{top:auto;left:0;right:0;bottom:0;width:auto;max-height:64%;border-left:0;border-right:0;border-bottom:0}
  .fhd{display:none}
  .fr summary{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"nm n1" "op op";row-gap:4px}
  .fr summary .nm{grid-area:nm}
  .fr summary .op{grid-area:op;font-size:12.5px;color:#6B6B73;padding-left:32px}
  .fr summary .ct{display:none}
  .fr summary .n:nth-of-type(4){grid-area:n1}
  .fr summary .n:last-child{display:none}
  .fd{padding:4px 14px 16px}
  .kv li{grid-template-columns:1fr;gap:2px}
}
`;

function page({ lang = 'en', tiles = null } = {}) {
  const D = load();
  if (!D) return null;
  const T = D.totals;
  const p = '/peering';
  const asof = new Date(D.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const facs = D.facs.slice().sort((a, b) => (a.grey - b.grey) || (b.nets - a.nets) || a.n.localeCompare(b.n));
  const ixs = D.ixs.slice().sort((a, b) => (a.grey - b.grey) || (b.nets - a.nets) || a.pdb.localeCompare(b.pdb));
  const topNets = Object.entries(D.nets).map(([id, v]) => ({ id, asn: v[0], n: v[1], type: v[2], fac: v[3], ports: v[4] }))
    .sort((a, b) => (b.fac + b.ports) - (a.fac + a.ports) || a.asn - b.asn).slice(0, 30);
  /* reach: the ISP reach panel on the place card, on while its data file exists */
  const TR = trace();
  const cfg = { tiles: tiles ? tiles.url : null, maxzoom: tiles ? tiles.maxzoom : 0, reach: reachLive(), trace: !!TR };
  /* the citable answer under the lede (Sinyal's audit, 24 Oct 2026: no self-contained answer near the
     top): the totals, the two busiest named exchanges and the busiest named building */
  const ix2 = ixs.filter((x) => !x.grey && x.nets).slice(0, 2);
  const fac1 = facs.find((f) => !f.grey && f.nets);
  const answer = `According to PeeringDB, as mapped by 1001startup.id (updated ${asof}), Indonesia has ${n0(T.fac)} data centres and network sites, ${n0(T.ix)} internet exchanges and ${n0(T.nets)} networks.`
    + `${ix2.length === 2 ? ` The busiest exchanges are ${esc(ix2[0].pdb)} (${n0(ix2[0].nets)} networks) and ${esc(ix2[1].pdb)} (${n0(ix2[1].nets)})${fac1 ? `, and the most connected building is ${esc(fac1.n)}${fac1.city ? ` in ${esc(fac1.city)}` : ''}, with ${n0(fac1.nets)} networks` : ''}.` : ''}`;
  const body = `
<style>${CSS}</style>
<link rel="stylesheet" href="${GL}/maplibre-gl.css">
<section class="hero pm-hero">
  <div class="eyebrow"><span class="sq"></span>PEERING · INDONESIA · PEERINGDB, ${esc(asof.toUpperCase())}</div>
  <h1>Where Indonesia’s networks meet</h1>
  <p class="sub">Every data centre, internet exchange and router port that PeeringDB lists in Indonesia, on one map: ${n0(T.fac)} facilities, ${n0(T.ix)} exchanges and ${n0(T.ports)} router ports. Grey means we can’t name the data centre.</p>
  <p class="sub">${answer}</p>
  <nav class="chips" aria-label="On this page"><a class="chip" href="#map">Map</a><a class="chip" href="#facilities">Data centres<b>${n0(T.fac)}</b></a><a class="chip" href="#exchanges">Exchanges<b>${n0(T.ix)}</b></a><a class="chip" href="#networks">Networks<b>${n0(T.nets)}</b></a><a class="chip" href="#method">Method</a><a class="chip" href="${MAIN}/data-center">Who powers them →</a></nav>
</section>
<div class="pm-map" id="map">
  <nav class="pm-rail pm-bar" aria-label="Map layers">
    <button type="button" class="chip" data-mode="net" aria-pressed="true">Network<b>${n0(T.links || 0)}</b></button>
    <button type="button" class="chip" data-mode="dc" aria-pressed="false">Data centres<b>${n0(T.fac)}</b></button>
    <button type="button" class="chip" data-mode="ix" aria-pressed="false">Exchanges<b>${n0(T.ix)}</b></button>
    <button type="button" class="chip" data-mode="ports" aria-pressed="false">Router ports<b>${n0(T.ports)}</b></button>
    ${TR ? '<button type="button" class="chip" data-mode="trace" aria-pressed="false">Trace a message<b>Solo → Singapore</b></button>' : ''}
  </nav>
  ${TR ? `<nav class="pm-rail pm-routes" id="pm-routes" aria-label="Which test to play" hidden>${TR.routes.map((r, i) => `<button type="button" class="chip" data-route="${esc(r.id)}" aria-pressed="${i ? 'false' : 'true'}">${esc(r.isp)} · ${esc(TR.places[r.from].n)}<b>${r.hops.length} hops</b></button>`).join('')}<button type="button" class="chip" id="pm-replay">↻ Play again</button></nav>` : ''}
<div class="pm-wrap" id="pm-wrap">
  <div id="pm-map" data-cfg="${esc(JSON.stringify(cfg))}"${TR ? ` data-trace="${esc(JSON.stringify(TR))}"` : ''} role="application" aria-label="Map of Indonesia’s data centres, internet exchanges and router ports from PeeringDB"></div>
  <div class="pm-tip" id="pm-tip" hidden></div>
  <aside class="pm-card" id="pm-card" hidden aria-live="polite"></aside>
  <noscript><div class="pm-msg"><p>The map needs JavaScript. The same places are listed below.</p></div></noscript>
  <div class="pm-msg" id="pm-msg" hidden><p>This browser has WebGL switched off, so the map cannot draw. The same places are listed below.</p></div>
</div>
  <div class="pm-key" id="pm-key"><div class="pm-legend"><div class="row" data-for="net"><span><i class="ln"></i>line = the same exchange is in both buildings; thicker = more exchanges (not cable routes)</span><span><i class="g"></i>grey: no name we can check</span></div><div class="row" data-for="dc" hidden><span><i class="lg"></i>named data centre</span><span><i class="g"></i>grey: no name we can check</span></div><div class="row" data-for="ix" hidden><span><i class="sq"></i>exchange at a named data centre</span><span><i class="sqg"></i>grey: city only</span></div><div class="row" data-for="ports" hidden><span><i class="d"></i>ports at a named data centre</span><span><i class="g"></i>grey: data centre not given</span></div>${TR ? `<div class="row" data-for="trace" hidden><span class="pm-now" id="pm-now" aria-live="polite">Starting in Solo</span></div><div class="row" data-for="trace" hidden><span><i class="d"></i>place shown by a router name or address record</span><span><i class="rg"></i>place worked out from the delay</span><span><i class="ln"></i>order of the hops, not the cable route</span><span>played ${n0(TR.slow)}× slower</span><span>tests: <a href="https://globalping.io/" target="_blank" rel="noopener">Globalping</a></span></div>` : ''}<div class="cr">Data: <a href="https://www.peeringdb.com/" target="_blank" rel="noopener">PeeringDB</a> · map <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>, Protomaps</div></div>
  <div class="pm-ctl" role="group" aria-label="Zoom">
    <button type="button" id="pm-in" aria-label="Zoom in">+</button>
    <button type="button" id="pm-out" aria-label="Zoom out">−</button>
    <button type="button" id="pm-home" aria-label="Back to the opening view" title="Back to the opening view">◎</button>
  </div>
</div>
</div>
${TR ? tracePanel(TR) : ''}
<div class="stats" style="margin-top:36px">
  <div class="cell"><div class="v">${n0(T.fac)}</div><div class="k">Data centres and network sites · ${n0(T.fac_named)} named, ${n0(T.fac_grey)} grey</div></div>
  <div class="cell"><div class="v">${n0(T.ix)}</div><div class="k">Internet exchanges · ${n0(T.ix_named)} at a named site</div></div>
  <div class="cell"><div class="v">${n0(T.nets)}</div><div class="k">Networks · ${n0(T.presences)} listings at data centres</div></div>
  <div class="cell"><div class="v">${n0(T.ports)}</div><div class="k">Router ports on exchanges · ${pct(T.ports_named, T.ports)}% at a named site</div></div>
</div>
<section class="wrap" id="bottom">
  <div class="eyebrow"><span class="sq"></span>WHAT THE MAP SHOWS</div>
  <ul class="bl-list">${bottomLine(D).map((x) => `<li>${x}</li>`).join('')}</ul>
</section>
<section class="wrap" id="facilities">
  <div class="eyebrow"><span class="sq"></span>EVERY DATA CENTRE</div>
  <p class="lede">The ${n0(T.fac)} facilities PeeringDB lists in Indonesia, busiest first. A row is grey when we found only a company name or an office address, nothing that names the place as a data centre. Open a row for its sources.</p>
  <div class="tools"><input id="pf-q" type="search" placeholder="Find a data centre, company or city" aria-label="Find a data centre, company or city"><button type="button" class="chip" data-g="all" aria-pressed="true">All</button><button type="button" class="chip" data-g="0" aria-pressed="false">Named<b>${n0(T.fac_named)}</b></button><button type="button" class="chip" data-g="1" aria-pressed="false">Grey<b>${n0(T.fac_grey)}</b></button><span class="cnt" id="pf-count"></span></div>
  <div class="flist" id="pf-list">
    <div class="fhd" role="presentation"><span>Data centre</span><span>Operator</span><span>City</span><span>Networks</span><span>Exchanges</span></div>
    ${facs.map((f) => facRow(D, f)).join('')}
  </div>
</section>
<section class="wrap" id="exchanges">
  <div class="eyebrow"><span class="sq"></span>EVERY EXCHANGE</div>
  <p class="lede">An internet exchange is a switch where networks trade traffic directly. These are the ${n0(T.ix)} PeeringDB lists in Indonesia, by how many networks connect. Grey: PeeringDB names the city but not the data centre.</p>
  <div class="tools"><input id="px-q" type="search" placeholder="Find an exchange" aria-label="Find an exchange"><span class="cnt" id="px-count"></span></div>
  <div class="flist" id="px-list">
    <div class="fhd" role="presentation"><span>Exchange</span><span>Operator</span><span>Where</span><span>Networks</span><span>Ports</span></div>
    ${ixs.map((x) => ixRow(D, x)).join('')}
  </div>
</section>
<section class="wrap" id="networks">
  <div class="eyebrow"><span class="sq"></span>THE NETWORKS IN MOST PLACES</div>
  <p class="lede">${n0(T.nets)} networks appear in these places. The 30 below are in the most data centres and on the most exchanges.</p>
  <div class="tablewrap"><table class="nets"><thead><tr><th>Network</th><th>Type</th><th class="n">Data centres</th><th class="n">Exchange ports</th></tr></thead><tbody>
    ${topNets.map((x) => `<tr><td><b>${esc(x.n)}</b> <span class="cnt">AS${esc(x.asn)}</span></td><td class="mu">${esc(x.type || '—')}</td><td class="n">${n0(x.fac)}</td><td class="n">${n0(x.ports)}</td></tr>`).join('')}
  </tbody></table></div>
</section>
<section class="wrap" id="method">
  <div class="eyebrow"><span class="sq"></span>METHOD</div>
  <details class="dcm"><summary>How this was put together</summary><ul>
    <li>Every facility, exchange, network and exchange port that <a href="https://www.peeringdb.com/" target="_blank" rel="noopener">PeeringDB</a> lists for Indonesia, read from its public API on ${esc(asof)}, with the facility pins from its <a href="https://public.peeringdb.com/peeringdb.kmz">Google Earth file</a>. PeeringDB is filled in by the networks and operators themselves, so entries can be old or incomplete.</li>
    <li>Research agents then checked each facility: the name people use for the place, its aliases, who runs it, whether it is still open and where it really is. Each name, alias and operator rests on a source quoted in the row, or says “PeeringDB only”. ${n0(T.fac_checked)} of ${n0(T.fac)} facilities have been checked so far.</li>
    <li><b>Grey</b> follows one rule: if we can’t name the data centre, the point is grey. A facility is grey when the only name we have is a company name or an office address. An exchange is grey when PeeringDB gives its city but not its data centre. A router port is grey when PeeringDB doesn’t say which data centre it is in, or names one we can’t.</li>
    <li>A router port is placed at the network’s side of the connection if PeeringDB gives it, else at the exchange’s side, else at the exchange’s only site. ${n0(T.ports_how.net || 0)} ports are placed the first way, ${n0(T.ports_how.ix || 0)} the second and ${n0(T.ports_how.one || 0)} the third; ${n0(T.ports_grey)} stay grey on their exchange’s city.</li>
    <li>The Network layer joins two named data centres when an exchange has switches in both, drawn from the exchange’s busiest site to each of its other sites. A line is thicker when more exchanges share the pair. Lines show shared exchanges, not where any cable runs.</li>
    <li>Pins: we kept PeeringDB’s pin unless a check put the building elsewhere; ${n0(T.fac_moved)} pins moved by a kilometre or more. Facilities in one building share one point on the map. City centres come from Wikipedia.</li>
    <li>The page shows how many router ports each place has, never their IP addresses.</li>
  </ul></details>
  <p class="foot-note">Facility, exchange and network data © PeeringDB, used under its <a href="https://www.peeringdb.com/aup" target="_blank" rel="noopener">acceptable use policy</a>. Built ${esc(D.built.slice(0, 16).replace('T', ' '))} UTC.</p>
</section>
<script src="/js/peering1001-list.js?v=${ver('peering1001-list.js')}" defer></script>
<script type="module" src="/js/peering1001.js?v=${ver('peering1001.js')}"></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'Data centres', path: '/data-center' }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'Where Indonesia’s networks meet',
    description: `${T.fac} Indonesian data centres and network sites, ${T.ix} internet exchanges and ${T.ports} router ports from PeeringDB, with each data centre's name checked against sources.`,
    url: HOME, dateModified: D.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: 'Where Indonesia’s networks meet: the peering map — 1001startup.id',
    desc: `${T.fac} data centres, ${T.ix} internet exchanges and ${T.ports} router ports that PeeringDB lists in Indonesia, on one map. Grey where we can’t name the data centre.`,
    path: p, lang, body, canonical: HOME, translated: false,
    /* kept out of search for now: PeeringDB's terms limit republishing its data,
       and the research pass is still filling in names (Luca's call to lift) */
    robots: 'noindex, follow',
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { page, load, raw, HOME };
