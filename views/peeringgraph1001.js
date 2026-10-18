'use strict';
/* dc.1001startup.id/graph — how Indonesia's networks connect, as PeeringDB records it.
 *
 * A reader's note to Luca on 18 Oct 2026, about the peering map: the relationship was
 * missing. In PeeringDB a data centre is a Facility; inside a facility are Networks; each
 * network has Public Peering (the exchanges it has a port on) and Interconnection
 * Facilities (the facilities it is in), and those two links are what tie data-centre
 * tenants and ISPs together. Luca: "make new feature". So this page draws that chain as a
 * graph in three columns, data centres | networks | exchanges, with the network in the
 * middle: the overview shows the busiest data centres and exchanges and the networks that
 * tie them; any box re-centres the graph on itself (public/js/peeringgraph1001.js).
 *
 * Data: data/peering-graph.json from scripts/peering-graph-build.py (the peering map's
 * checked names and grey flags plus PeeringDB's netfac and netixlan records). Read per
 * request with an mtime cache, so a rebuild needs no restart. English only. No IP address
 * or port speed is shown: a network-to-exchange link only says "has a port there".
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const { reachLive } = require('../lib/peeringlive');

const DATA = path.join(__dirname, '..', 'data', 'peering-graph.json');
const REACH = path.join(__dirname, '..', 'data', 'peering-reach.json');
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
const raw = () => { const c = fresh(); return c ? c.raw : null; };
let rcache = { mtime: -1, data: null };
function reach() {
  if (!reachLive()) return null;
  let mtime = 0;
  try { mtime = fs.statSync(REACH).mtimeMs; } catch (e) { return null; }
  if (mtime !== rcache.mtime) { try { rcache = { mtime, data: JSON.parse(fs.readFileSync(REACH, 'utf8')) }; } catch (e) { /* mid-write */ } }
  return rcache.data;
}
const ver = (file) => { try { return String(Math.floor(fs.statSync(path.join(__dirname, '..', 'public', 'js', file)).mtimeMs / 1000)); } catch (e) { return '0'; } };
const HOME = 'https://dc.1001startup.id/graph';
const MAP = 'https://dc.1001startup.id/';
const MAIN = 'https://1001startup.id';
const n0 = (v) => Number(v || 0).toLocaleString('en-US');
const pc = (v) => `${(Math.round(v * 10) / 10).toFixed(1)}%`;

/* the lines under the graph, worked out from the data so they never drift */
function bottomLine(G, R) {
  const T = G.totals;
  const N = G.n.map((r) => ({ id: r[0], asn: r[1], n: r[2], t: r[3], fs: r[5], xs: r[6] }));
  const byAsn = new Map(N.map((x) => [x.asn, x]));
  const out = [];
  out.push(`<b>${n0(T.nets_both)} of ${n0(T.nets)}</b> networks do both: they are in at least one data centre and have a port on at least one exchange. ${n0(T.nets_ix_only)} only have exchange ports and ${n0(T.nets_fac_only)} are only listed in data centres.`);
  const top = G.f.slice().sort((a, b) => b.nets - a.nets)[0];
  if (top) out.push(`<b>${esc(top.n)}</b>${top.bld ? ` in ${esc(top.bld)}` : ''} holds ${n0(top.nets)} networks, and ${n0(top.ixs.length)} exchanges have a switch there${top.bld && top.bn > 1 ? `. The building has ${n0(top.bn)} PeeringDB facilities in all` : ''}.`);
  const mf = N.slice().sort((a, b) => b.fs.length - a.fs.length || a.asn - b.asn)[0];
  const mx = N.slice().sort((a, b) => b.xs.length - a.xs.length || a.asn - b.asn)[0];
  if (mf && mx) out.push(`<b>${esc(mf.n)}</b> (AS${mf.asn}) is in ${n0(mf.fs.length)} data centres, more than any other network. <b>${esc(mx.n)}</b> (AS${mx.asn}) is on the most exchanges: ${n0(mx.xs.length)}.`);
  const con = N.filter((x) => x.t === 'T').sort((a, b) => (b.xs.length - b.fs.length) - (a.xs.length - a.fs.length) || a.asn - b.asn)[0];
  if (con && con.xs.length > con.fs.length) out.push(`Content networks mostly come to Indonesian ISPs through exchanges: <b>${esc(con.n)}</b> is listed in ${n0(con.fs.length)} data centre${con.fs.length === 1 ? '' : 's'} but has ports on ${n0(con.xs.length)} exchanges.`);
  if (R && Array.isArray(R.isps)) {
    /* the biggest ISPs (APNIC's user estimates, as on the map's reach panel) with no
       exchange port at all, one entry per name so XLSmart's two AS numbers count once */
    const grp = new Map();
    for (const i of R.isps) {
      const x = byAsn.get(i.asn);
      if (!x || x.xs.length || i.unverified) continue;
      const g = grp.get(x.n) || { n: x.n, pct: 0, k: 0, fs: new Set() };
      g.pct += i.pct; g.k += 1; x.fs.forEach((f) => g.fs.add(f));
      grp.set(x.n, g);
    }
    const none = [...grp.values()].sort((a, b) => b.pct - a.pct).slice(0, 3);
    if (none.length) {
      const names = none.map((g) => `<b>${esc(g.n)}</b> (${pc(g.pct)} of users${g.k > 1 ? ` on ${g.k} AS numbers` : ''})`);
      const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
      out.push(`${list} list no port on any Indonesian exchange. In this data they meet other networks only in the data centres they are in.`);
    }
  }
  return out;
}

const CSS = `
.pg [hidden]{display:none!important}
.pg-hero{padding-bottom:20px}
.pg{max-width:1180px;margin:0 auto;padding:0 20px}
.pg-bar{display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px}
.pg-find{position:relative;flex:1 1 320px;max-width:560px}
.pg-find input{width:100%;border:1px solid #000;padding:11px 12px;font:500 15px/1.2 'Overused Grotesk',sans-serif;background:#fff;border-radius:0;-webkit-appearance:none}
.pg-sug{position:absolute;z-index:20;left:0;right:0;top:100%;background:#fff;border:1px solid #000;border-top:0;list-style:none;max-height:340px;overflow-y:auto;box-shadow:0 14px 30px rgba(0,0,0,.10)}
.pg-sug li{display:flex;gap:10px;align-items:center;padding:9px 12px;cursor:pointer;border-top:1px solid #F1F1F1}
.pg-sug li:first-child{border-top:0}
.pg-sug li[aria-selected="true"],.pg-sug li:hover{background:#F4F5F1}
.pg-sug .k{font:400 9.5px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;border:1px solid #E7E7E7;padding:3px 5px;flex:none;min-width:34px;text-align:center}
.pg-sug b{font-weight:600}
.pg-sug small{display:block;color:#6B6B73;font-size:12px}
.pg-sug .nil{color:#6B6B73;cursor:default}
.pg-head{border:1px solid #E7E7E7;padding:16px 18px;margin-bottom:18px;min-height:96px}
.pg-head .kk{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#6B6B73}
.pg-head h2{font-size:clamp(21px,2.2vw,27px);line-height:1.15;letter-spacing:-.02em;font-weight:600;margin:5px 0 4px}
.pg-head p{color:#52525B;font-size:14.5px;line-height:1.5;max-width:90ch}
.pg-id{display:flex;gap:12px;align-items:flex-start}
.pg-id .mk{width:38px;height:38px;margin-top:4px}
.pg-id .mk.mono-mk{font-size:12px}
.pg-facts{list-style:none;display:flex;gap:6px 18px;flex-wrap:wrap;margin-top:10px;font-size:14px;color:#3F3F46}
.pg-facts b{font-weight:600;color:#000}
.pg-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.pg-back{cursor:pointer;margin-bottom:10px}
.btn.sm{padding:9px 12px;font-size:11px}
.pg-tabs{display:none}
.pg-cols{--g:118px;display:grid;grid-template-columns:minmax(0,1fr) var(--g) minmax(0,1.06fr) var(--g) minmax(0,1fr)}
.pg-hdr{border-top:1px solid #000;padding-top:10px;margin-bottom:10px;align-items:end}
.pg-hdr > div{min-width:0}
.pg-hdr .t{font:400 10.5px/1.35 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#000}
.pg-hdr .t b{font-weight:400;color:#6B6B73}
.pg-hdr .d{font-size:12.5px;line-height:1.35;color:#6B6B73;margin-top:3px}
.pg-hdr .gap{text-align:center;padding:0 8px}
.pg-hdr .gap .t{color:#2563EB}
.pg-graph{position:relative;min-height:260px}
.pg-svg{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
.pg-col{display:flex;flex-direction:column;justify-content:space-evenly;gap:5px;min-width:0;position:relative;z-index:1}
.pg-gap{min-width:0}
.pg-gh{font:400 10px/1.3 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;padding:8px 0 1px}
.pg-gh:first-child{padding-top:0}
.pg-gh b{font-weight:400;color:#A1A1AA}
.pg-n{display:flex;gap:8px;align-items:center;width:100%;text-align:left;background:#fff;border:1px solid #E4E4E7;padding:5px 9px;cursor:pointer;font:inherit;color:#000;transition:border-color .12s,background-color .12s,opacity .18s}
.pg-n:hover,.pg-n.on{border-color:#000}
.pg-n:focus-visible{outline:2px solid #2563EB;outline-offset:1px}
.pg-n .tx{min-width:0;flex:1}
.pg-n b{display:block;font-weight:600;font-size:13px;line-height:1.22;overflow-wrap:anywhere;letter-spacing:-.005em}
.pg-n small{display:block;font:400 10px/1.35 'IBM Plex Mono',monospace;letter-spacing:.01em;color:#6B6B73;margin-top:1px;overflow-wrap:anywhere}
.pg-n .mk{width:20px;height:20px}
.pg-n .tg{flex:none;align-self:flex-start;font:400 9px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;border:1px solid #D4D4D8;color:#52525B;padding:3px 4px;margin-top:2px;font-style:normal;white-space:nowrap}
.pg-n.is-grey b{color:#6B6B73}
.pg-n.focus{background:#000;border-color:#000;color:#fff}
.pg-n.focus small{color:#C7C7CC}
.pg-n.focus .tg{border-color:#52525B;color:#E4E4E7}
.pg-n.focus .mk{border-color:#3F3F46}
.pg-n.dim{opacity:.35}
.pg-more{font:400 10.5px/1.4 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;padding:4px 2px 0}
.pg-empty{border:1px dashed #D4D4D8;padding:12px;font-size:13.5px;line-height:1.5;color:#52525B;background:#FAFAFA}
.pg-e{fill:none;stroke:#C9CCD1;stroke-width:1;opacity:.8;transition:opacity .15s,stroke .15s}
.pg-e.p{stroke:#52525B;opacity:.9}
.pg-e.lit{stroke:#111;opacity:1;stroke-width:1.25}
.pg-e.hop{stroke:#8E939B;opacity:.9}
.pg-graph.hov .pg-e:not(.lit){opacity:.12}
.pg-fl{fill:none;stroke:#36A9FF;stroke-width:2.2;stroke-linecap:round;stroke-dasharray:2 22;animation:pg-flow 1.5s linear infinite;filter:drop-shadow(0 0 2px rgba(54,169,255,.8))}
@keyframes pg-flow{to{stroke-dashoffset:-24}}
.pg-graph.swap{opacity:0}
/* the site's contact tab (views/builder1001.js) is fixed near the bottom-right corner:
   it steps aside while the graph is under it, as it does on the map */
body.pg-over-graph .b1 .b1-tab{visibility:hidden!important;pointer-events:none}
.pg-head{scroll-margin-top:12px}
.pg-head .ph{display:none}
.pg-graph{transition:opacity .16s}
.pg-load{color:#6B6B73;font-size:14px;padding:30px 0}
.pg-key{display:flex;gap:6px 18px;flex-wrap:wrap;align-items:center;margin-top:16px;padding-top:10px;border-top:1px solid #E7E7E7;font:400 10.5px/1.5 'IBM Plex Mono',monospace;letter-spacing:.03em;text-transform:uppercase;color:#52525B}
.pg-key i{display:inline-block;vertical-align:middle;margin-right:6px}
.pg-key .l1{width:18px;height:1px;background:#C9CCD1}
.pg-key .l2{width:18px;height:2px;background:#111}
.pg-key .l3{width:18px;height:3px;border-radius:2px;background:#36A9FF;box-shadow:0 0 5px rgba(54,169,255,.8)}
.pg-key .gd{width:11px;height:11px;border-radius:50%;background:#A6A9AE}
.pg-key .sw{font:400 9px/1 'IBM Plex Mono',monospace;border:1px solid #D4D4D8;padding:2px 4px;font-style:normal}
.mk{width:22px;height:22px;border-radius:50%;flex:none;border:1px solid #E7E7E7;background:#fff;object-fit:contain;display:inline-block}
.mk.grey{background:#A6A9AE;border:3px solid #fff;box-shadow:0 0 0 1px #E7E7E7}
.mono-mk{display:inline-flex;align-items:center;justify-content:center;font:600 9px/1 'Overused Grotesk',sans-serif;color:#52525B;background:#F4F5F1;letter-spacing:0}
.pg-n.focus .mono-mk{background:#27272A;color:#E4E4E7}
.bl-list{list-style:none;display:grid;gap:10px;max-width:92ch}
.bl-list li{padding-left:18px;position:relative;line-height:1.55;color:#27272A}
.bl-list li:before{content:'';position:absolute;left:2px;top:.62em;width:6px;height:6px;background:#000}
.dcm summary{cursor:pointer;font-weight:600}
.dcm ul{margin:12px 0 0 18px;display:grid;gap:8px;color:#3F3F46;max-width:92ch;line-height:1.55}
.dcm a{color:#0000EE}
@media (prefers-reduced-motion: reduce){.pg-fl{display:none}.pg-graph,.pg-n,.pg-e{transition:none}}
@media (max-width:759px){
  .pg{padding:0 16px}
  .pg-head{padding:14px 14px}
  .pg-tabs{display:grid;grid-template-columns:1fr 1fr;border:1px solid #000;margin-bottom:12px}
  .pg-tabs button{border:0;background:#fff;padding:11px 6px;font:400 11px/1.25 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;color:#000}
  .pg-tabs button + button{border-left:1px solid #000}
  .pg-tabs button[aria-selected="true"]{background:#000;color:#fff}
  .pg-cols{--g:46px;grid-template-columns:minmax(0,1.06fr) var(--g) minmax(0,1fr)}
  .pg-cols > .c-n{grid-column:1;grid-row:1}
  .pg-cols > .g-r{grid-column:2;grid-row:1}
  .pg-cols > .c-f,.pg-cols > .c-x{grid-column:3;grid-row:1}
  .pg-cols > .g-l{display:none}
  .pg-cols[data-side="f"] > .c-x,.pg-cols[data-side="x"] > .c-f{display:none}
  .pg-hdr .gap{display:none}
  .pg-hdr .d{font-size:11.5px}
  .pg-n{padding:5px 7px;gap:6px}
  .pg-n b{font-size:12px;line-height:1.2}
  .pg-n small{font-size:9.5px}
  .pg-n .mk{width:16px;height:16px}
  .pg-n .xm{display:none}
  .pg-n .tg{font-size:8px;padding:2px 3px}
  .pg-head h2{font-size:20px}
  .pg-head .dk{display:none}
  .pg-head .ph{display:inline}
  /* the phone's first screen reaches the graph: the hero keeps its line, the page chips
     and the opening view's long note step aside (the column titles say the same) */
  .pg-hero{padding-top:28px;padding-bottom:16px}
  .pg-hero .chips{display:none}
  .pg-head.is-home{min-height:0;padding:12px 14px}
  .pg-head.is-home p{display:none}
  .pg-head.is-home h2{margin-bottom:0}
  .pg-hdr .d{display:none}
  .pg-key{gap:4px 14px}
}
`;

function page({ lang = 'en' } = {}) {
  const G = load();
  if (!G) return null;
  const T = G.totals;
  const R = reach();
  const asof = new Date(G.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const hosting = new Set(G.x.flatMap((x) => x.sites)).size;
  const cfg = { data: '/data/peering-graph.json', reach: R ? '/data/peering-reach.json' : null, map: MAP };
  const body = `
<style>${CSS}</style>
<section class="hero pg-hero">
  <div class="eyebrow"><span class="sq"></span>GRAPH · INDONESIA · PEERINGDB, ${esc(asof.toUpperCase())}</div>
  <h1>How Indonesia’s networks connect</h1>
  <p class="sub">A data centre holds networks. Networks meet each other on exchanges (public peering) or in the data centres they share (interconnection facilities). Tap any box to follow it.</p>
  <nav class="chips" aria-label="On this page"><a class="chip" href="#graph">Graph</a><a class="chip" href="#bottom">What it shows</a><a class="chip" href="#method">Method</a><a class="chip" href="${MAP}">Peering map →</a><a class="chip" href="${MAIN}/data-center">Who powers them →</a></nav>
</section>
<section class="pg" id="graph" aria-label="How the networks connect">
  <div class="pg-bar">
    <div class="pg-find" role="combobox" aria-expanded="false" aria-owns="pg-sug" aria-haspopup="listbox">
      <input id="pg-q" type="search" placeholder="Find a data centre, network, AS number or exchange" autocomplete="off" spellcheck="false" aria-label="Find a data centre, network, AS number or exchange" aria-autocomplete="list" aria-controls="pg-sug">
      <ul id="pg-sug" class="pg-sug" role="listbox" hidden></ul>
    </div>
  </div>
  <div class="pg-head is-home" id="pg-head" aria-live="polite">
    <div class="kk">All of Indonesia</div>
    <h2>The core of the network</h2>
    <p>The 12 data centres and 12 exchanges with the most networks, and the networks that tie them.</p>
  </div>
  <div class="pg-tabs" role="tablist" aria-label="Which link to show">
    <button type="button" role="tab" data-side="f" aria-selected="true">Interconnection facilities</button>
    <button type="button" role="tab" data-side="x" aria-selected="false">Public peering</button>
  </div>
  <div class="pg-cols pg-hdr" id="pg-hdr" data-side="f">
    <div class="c-f"><div class="t">Data centres</div><div class="d">PeeringDB’s facilities</div></div>
    <div class="gap g-l"><div class="t">Interconnection facility</div><div class="d">the network is in the data centre</div></div>
    <div class="c-n"><div class="t">Networks</div><div class="d">ISPs, carriers, content and cloud, each one AS number</div></div>
    <div class="gap g-r"><div class="t">Public peering</div><div class="d">the network has a port on the exchange</div></div>
    <div class="c-x"><div class="t">Exchanges</div><div class="d">switches where networks trade traffic</div></div>
  </div>
  <div class="pg-graph pg-cols" id="pg-graph" data-side="f" data-cfg="${esc(JSON.stringify(cfg))}">
    <p class="pg-load" style="grid-column:1/-1">Drawing the graph…</p>
    <noscript><p class="pg-load" style="grid-column:1/-1">The graph needs JavaScript. The <a href="${MAP}">peering map</a> lists the same data centres, exchanges and networks.</p></noscript>
  </div>
  <div class="pg-key"><span><i class="l1"></i>a link PeeringDB lists</span><span><i class="l2"></i>links of the box you point at or picked</span><span><i class="l3"></i>light runs data centre → network → exchange</span><span><i class="gd"></i>grey: a data centre we can’t name</span><span><i class="sw">SWITCH HERE</i>the exchange has a switch in that data centre</span></div>
</section>
<div class="stats" style="margin-top:36px">
  <div class="cell"><div class="v">${n0(T.nets)}</div><div class="k">Networks · ${n0(T.nets_both)} in a data centre and on an exchange</div></div>
  <div class="cell"><div class="v">${n0(T.netfac)}</div><div class="k">Interconnection facility links · a network listed in a data centre</div></div>
  <div class="cell"><div class="v">${n0(T.netix)}</div><div class="k">Public peering links · a network with a port on an exchange</div></div>
  <div class="cell"><div class="v">${n0(T.ixfac)}</div><div class="k">Exchange switches · in ${n0(hosting)} data centres</div></div>
</div>
<section class="wrap" id="bottom">
  <div class="eyebrow"><span class="sq"></span>WHAT THE GRAPH SHOWS</div>
  <ul class="bl-list">${bottomLine(G, R).map((x) => `<li>${x}</li>`).join('')}</ul>
</section>
<section class="wrap" id="method">
  <div class="eyebrow"><span class="sq"></span>METHOD</div>
  <details class="dcm"><summary>How this was put together</summary><ul>
    <li>Every line is one PeeringDB record, read from its public API on ${esc(asof)}: a network listed at a facility (what PeeringDB calls the network’s interconnection facilities), a network with a port on an exchange (its public peering exchange points), and an exchange with a switch at a facility. PeeringDB is filled in by the networks themselves, so entries can be old or missing.</li>
    <li>A line says a network is there, not how much traffic it carries or whom it trades with. Two networks in the same data centre may or may not have a cable between them; two networks on the same exchange may or may not peer. Each network’s PeeringDB policy (Open, Selective, Restrictive) is on its card.</li>
    <li>Names, operators and grey dots come from the <a href="${MAP}">peering map</a>’s research pass: a data centre we can’t name is grey. A building with several PeeringDB facilities (Gedung Cyber 1 has ${n0((G.f.find((f) => f.bld === 'Gedung Cyber 1') || {}).bn || 0)}) keeps each facility as its own box, with the building’s name under it.</li>
    <li>The opening view: the 12 data centres and the 12 exchanges with the most networks, and 24 networks in three groups of eight: the ISPs with the most users${R ? ' (APNIC Labs’ estimates, the same figures and caveats as the peering map’s ISP reach panel)' : ''}, the carriers (PeeringDB’s NSP and Network Services types) in the most data centres, and the content and cloud networks (Content and Enterprise) on the most exchanges.</li>
    <li>A picked data centre or exchange shows up to 24 of its networks, at most six per group first; a picked network shows every data centre and exchange it lists. Lines are drawn only between boxes on screen.</li>
    <li>No IP address or port speed is shown.</li>
  </ul></details>
  <p class="foot-note">Facility, exchange and network data © PeeringDB, used under its <a href="https://www.peeringdb.com/aup" target="_blank" rel="noopener">acceptable use policy</a>.${R ? ' ISP shares of Indonesian internet users: <a href="https://stats.labs.apnic.net/aspop/" target="_blank" rel="noopener">APNIC Labs</a>.' : ''} Built ${esc(G.built.slice(0, 16).replace('T', ' '))} UTC.</p>
</section>
<script src="/js/peeringgraph1001.js?v=${ver('peeringgraph1001.js')}" defer></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'Data centres', path: '/data-center' }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'How Indonesia’s networks connect',
    description: `${T.nets} networks, ${T.fac} Indonesian data centres and ${T.ix} internet exchanges from PeeringDB, joined by ${T.netfac} interconnection facility links and ${T.netix} public peering links.`,
    url: HOME, dateModified: G.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: 'How Indonesia’s networks connect: the peering graph — 1001startup.id',
    desc: `Which networks sit in which Indonesian data centres and which exchanges they peer on: ${T.nets} networks, ${T.fac} data centres and ${T.ix} exchanges from PeeringDB, as one graph.`,
    path: '/graph', lang, body, canonical: HOME, translated: false,
    /* out of search like the map: PeeringDB's terms limit republishing its data (Luca's call to lift) */
    robots: 'noindex, follow',
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { page, load, raw, HOME };
