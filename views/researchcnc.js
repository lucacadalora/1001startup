'use strict';
/* CNC + 3D Indonesia — the research section (Luca, 16 Oct 2026: "put that in
 * blog/research inside cnc.vantis.sh"). First series: company webs, one page
 * per CNC company group, mapping who it invested in, who runs it, who buys
 * from and supplies it, and the people who link those companies. Data =
 * data/cnc-webs/<slug>.json (scripts/cnc-webs-import.py), read per request,
 * so a new group needs no restart. Wires on wide screens = /js/cncweb.js
 * (CSP script-src 'self'). Same look as the rest of the site.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const UM = require('./pagesumkm');
const PC = require('./pagescnc');

const BRANCHES = [
  ['invested', 'Invested in', 'Stakes it holds in other firms', 'l'],
  ['backers', 'Claim a stake in it', 'Owners and investors that list it', 'r'],
  ['setup', 'Its own brands and units', 'Brands, divisions, subsidiaries, schools it runs', 'l'],
  ['people', 'Linked through people', 'Founders, directors and their other firms', 'r'],
  ['buyers', 'Buys from it', 'Customers and their channels', 'l'],
  ['partners', 'Works with it', 'Partners, sellers, government', 'r'],
  ['schools', 'Schools in its network', 'Schools and academies it trains or equips', 'l'],
  ['suppliers', 'Supplies it', 'Parts, machines and services bought in', 'r'],
];
const EVID = {
  confirmed: ['ok', 'Confirmed'],
  company_claim: ['only', "Company's word"],
  snippet: ['part', 'Snippet only'],
  inferred: ['no', 'Our inference'],
};
const EORDER = Object.keys(EVID);
const KIND = { company: 'Company', brand: 'Brand', academy: 'Academy', person: 'Person',
  state_firm: 'State firm', school: 'School', government: 'Government' };

const erank = (l) => { const i = EORDER.indexOf(l.evidence); return i < 0 ? 9 : i; };
const relWords = (r) => { const s = String(r || '').replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
const dot = (e) => { const [c, t] = EVID[e] || ['no', e || '—']; return `<i class="d ${c}" title="${esc(t)}"></i>`; };
const chip = (e) => { const [c, t] = EVID[e] || ['no', e || '—']; return `<span class="ev ${c}">${esc(t)}</span>`; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
/* the eyebrow carries the city only: research notes sometimes record a full address */
const shortCity = (c) => String(c || '').split(/[(;,]/)[0].trim().slice(0, 40);
const srcA = (u, t) => (u ? ` <a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(t || 'source ↗')}</a>` : '');

function branchOf(l, center, ents) {
  const otherIsTo = l.from === center;
  const other = ents[otherIsTo ? l.to : l.from] || {};
  const r = l.relation;
  if (r === 'invested_in') return otherIsTo ? 'invested' : 'backers';
  if (other.kind === 'person') return 'people';
  if (r === 'founded' || r === 'brand_of' || r === 'runs') return otherIsTo || r === 'brand_of' ? 'setup' : 'backers';
  if (r === 'director_of' || r === 'commissioner_of') return 'people';
  if (other.kind === 'school' && r === 'partner') return 'schools';
  if (r === 'supplies') return otherIsTo ? 'buyers' : 'suppliers';
  if (r === 'buys_from') return otherIsTo ? 'suppliers' : 'buyers';
  return 'partners';
}

/* the shared chrome: fonts, banner, header, the evidence marks */
function head(title, desc) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#ffffff">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${UM.GRAD};color:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${UM.HEADCSS}
${PC.BRANDCSS}
.wrap{max-width:1180px;margin:0 auto;padding:44px 20px 0}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
h1{font-size:clamp(34px,4.6vw,58px);line-height:1.03;letter-spacing:-0.03em;font-weight:500;max-width:22ch;text-wrap:balance}
.lede{color:#52525B;font-size:16px;line-height:1.6;max-width:78ch;margin-top:16px}
.ev{display:inline-flex;align-items:center;gap:6px;font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;padding:4px 6px;border:1px solid;white-space:nowrap;vertical-align:1px}
.ev.ok{color:#2F7A5C;border-color:#2F7A5C}
.ev.only{color:#4E7A96;border-color:#4E7A96}
.ev.part{color:#9A7B4F;border-color:#C9B79A}
.ev.no{color:#8E8E93;border-color:#D9D9DE}
.d{width:9px;height:9px;flex:none;display:inline-block;border-radius:50%}
.d.ok{background:#2F7A5C}
.d.only{background:#fff;box-shadow:inset 0 0 0 2px #4E7A96}
.d.part{background:#C9A15B;border-radius:1px}
.d.no{width:10px;height:3px;border-radius:0;background:#B4B4B8}
.ft{border-top:1px solid #E7E7E7;margin-top:64px}
.ftin{max-width:1180px;margin:0 auto;padding:30px 20px 28px;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font-size:10.5px;line-height:1.6;color:#8E8E93}
.ftin a{color:inherit;text-decoration:none;border-bottom:1px solid #D9D9D9}
`;
}

function foot() {
  return `<footer class="ft"><div class="ftin mono"><span>Working draft · public sources only</span>
<span><a href="/">Focus places</a> · <a href="/research">Research</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>Cookies</a></span></div></footer>`;
}

function switcher(webs, cur) {
  return `<nav class="sw" aria-label="Company groups">${webs.map((w) =>
    `<a class="chip${w.slug === cur ? ' on' : ''}" href="/research/${esc(w.slug)}"${w.slug === cur ? ' aria-current="page"' : ''}>${esc(w.title)}</a>`).join('')}</nav>`;
}

function index({ webs }) {
  const cards = (webs || []).map((w) => {
    const c = (w.entities || []).find((e) => e.id === w.center) || {};
    return `<a class="rc" href="/research/${esc(w.slug)}">
      <span class="rk mono">Company web${c.city ? ' · ' + esc(shortCity(c.city)) : ''}</span>
      <span class="rt">${esc(w.title)}</span>
      <span class="rb">${esc(w.bottom_line || c.what || '')}</span>
      <span class="rm mono">${w.counts.entities} companies and people · ${w.counts.links} sourced ties · ${w.counts.confirmed} confirmed</span>
    </a>`;
  }).join('');
  return `${head('Research — CNC + 3D Indonesia', 'Research behind the CNC + 3D map: company webs of Indonesia\'s CNC groups, each tie sourced.')}
.rgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-top:34px}
@media(max-width:760px){.rgrid{grid-template-columns:minmax(0,1fr)}}
.rc{background:#fff;padding:22px 20px 20px;display:flex;flex-direction:column;gap:8px;text-decoration:none;min-width:0}
.rc:hover{background:#FAFAFA}
.rc:last-child:nth-child(odd){grid-column:1/-1}
.rk{font-size:10.5px;color:#8E8E93}
.rt{font-size:24px;letter-spacing:-0.02em;font-weight:500}
.rb{color:#52525B;font-size:14px;line-height:1.55;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.rm{font-size:10px;color:#B4B4B8;margin-top:auto;padding-top:6px}
.series{margin-top:46px}
.series h2{font-size:clamp(24px,3vw,34px);letter-spacing:-0.025em;font-weight:500}
.series p{color:#52525B;font-size:14.5px;line-height:1.6;max-width:84ch;margin-top:8px}
</style>
</head>
<body>
<div class="banner">RESEARCH · PUBLIC SOURCES ONLY · EVERY TIE LINKS TO ITS SOURCE</div>
${PC.header('/research')}
<main class="wrap">
  <div class="eyebrow"><span class="sq"></span>RESEARCH</div>
  <h1>Who owns, backs, runs and buys from Indonesia's CNC makers.</h1>
  <p class="lede">The research behind the map. The first series is company webs: one mind map per CNC group, showing the
  firms it invested in, the brands and units it runs, who claims a stake in it, who buys from it and supplies it, and
  the people who link those companies. Every tie carries its source and how strong the evidence is.</p>
  <section class="series">
    <h2>Company webs</h2>
    <p>${(webs || []).length} group${(webs || []).length === 1 ? '' : 's'} so far. Stakes appear only where a source states them; the paid company register (AHU) was not checked.</p>
    <div class="rgrid">${cards}</div>
  </section>
</main>
${foot()}
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

function web({ web: w, webs }) {
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
  const channels = (id) => [...new Set((ring2[id] || []).filter(([, l]) => l.relation === 'channel').map(([o]) => name(o)))];
  const subs = (id) => (ring2[id] || []).filter(([, l]) => l.relation !== 'channel');
  const best = (ls) => ls.slice().sort((a, b) => erank(a) - erank(b))[0];

  const side = { l: [], r: [] };
  let nEnt = 0;
  BRANCHES.forEach(([key, title, sub, s]) => {
    if (!ring1[key]) return;
    const leaves = Object.entries(ring1[key]).map(([id, ls]) => {
      nEnt += 1;
      const o = ents[id] || { name: id };
      const b = best(ls);
      const sn = [...new Set(subs(id).map(([x]) => name(x)))];
      const ch = channels(id);
      const more = (arr) => (arr.length > 4 ? ` +${arr.length - 4}` : '');
      return `<li><a class="leaf${o.kind === 'person' ? ' person' : ''}" href="#n-${esc(id)}">${dot(b.evidence)}<span class="nm">${esc(o.name)}</span><span class="rw">${esc(relWords(b.relation))}</span></a>${
        sn.length ? `<span class="sub">${esc(sn.slice(0, 4).join(' · '))}${more(sn)}</span>` : ''}${
        ch.length ? `<span class="sub">sold on ${esc(ch.slice(0, 4).join(', '))}${more(ch)}</span>` : ''}</li>`;
    }).join('');
    side[s].push(`<section class="br"><div class="bh"><b class="mono">${esc(title)}</b><span>${esc(sub)}</span></div><ul class="leaves">${leaves}</ul></section>`);
  });

  const detail = BRANCHES.filter(([key]) => ring1[key]).map(([key, title]) => {
    const cards = Object.entries(ring1[key]).map(([id, ls]) => {
      const o = ents[id] || { name: id };
      const b = best(ls);
      const ties = ls.slice().sort((a, c) => erank(a) - erank(c)).map((l) =>
        `<li><b>${esc(relWords(l.relation))}</b> · ${esc(l.detail)}${l.date ? ' · ' + esc(l.date) : ''} ${chip(l.evidence)}${srcA(l.source_url)}</li>`).join('');
      const s2 = subs(id).map(([x, l]) =>
        `<li><b>${esc(relWords(l.relation))}</b> ${esc(name(x))}: ${esc(l.detail)}${l.date ? ' · ' + esc(l.date) : ''} ${chip(l.evidence)}${srcA(l.source_url)}</li>`).join('');
      const ch = channels(id);
      const srcs = (o.sources || []).slice(0, 4).map((u) => srcA(u, host(u) + ' ↗')).join('');
      return `<article class="card${o.kind === 'person' ? ' person' : ''}" id="n-${esc(id)}">
        <div class="nh"><span class="k mono">${esc(KIND[o.kind] || o.kind || '')}${o.city ? ' · ' + esc(o.city) : ''}</span>${chip(b.evidence)}</div>
        <h3>${esc(o.name)}</h3>
        ${o.legal_name && o.legal_name !== o.name ? `<p class="lg">${esc(o.legal_name)}</p>` : ''}
        ${o.what ? `<p class="wh">${esc(o.what)}</p>` : ''}
        <ul class="ties">${ties}</ul>
        ${ch.length ? `<p class="chn"><b>Sold on</b> ${esc(ch.join(', '))}</p>` : ''}
        ${s2 ? `<ul class="ties s2">${s2}</ul>` : ''}
        ${srcs ? `<p class="src">${srcs}</p>` : ''}
      </article>`;
    }).join('');
    return `<section class="grp"><h2>${esc(title)}</h2><div class="cards">${cards}</div></section>`;
  }).join('');

  const nInv = Object.keys(ring1.invested || {}).length;
  const nBack = Object.keys(ring1.backers || {}).length;
  return `${head(`${w.title} company web — CNC + 3D Indonesia`, `Who ${w.title} invested in, runs, sells to and is backed by — ${w.counts.links} sourced ties.`)}
.sw{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 26px}
.chip{padding:7px 11px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;color:#000}
.chip:hover{border-color:#000}
.chip.on{background:#000;color:#fff;border-color:#000}
.bl{border:1px solid #E7E7E7;padding:20px 22px;margin-top:26px;font-size:16px;line-height:1.6;max-width:none}
.bl .k{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.07em;text-transform:uppercase;color:#8E8E93;display:block;margin-bottom:10px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-top:14px}
@media(max-width:860px){.stats{grid-template-columns:repeat(2,1fr)}}
.stats .cell{background:#fff;padding:18px 16px}
.stats .v{font-size:clamp(24px,2.6vw,34px);letter-spacing:-0.02em;background:${UM.GRAD};-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:600;font-variant-numeric:tabular-nums}
.stats .kk{font:400 10px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#8E8E93;margin-top:4px}
.legend{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:12px;color:#8E8E93;margin:40px 0 18px}
/* the mind map */
.map{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 240px minmax(0,1fr);gap:0 60px;align-items:center}
.col{display:grid;gap:22px;align-content:center;min-width:0;position:relative;z-index:2}
.hub{position:relative;z-index:2;border:1.5px solid #000;background:#fff;padding:18px 16px 16px;display:grid;gap:5px;text-align:center}
.hub::before{content:"";position:absolute;left:-1.5px;right:-1.5px;top:-1.5px;height:4px;background:${UM.GRAD}}
.hub .k{font-size:10px;color:#8E8E93}
.hub .nm2{font-size:24px;line-height:1.1;letter-spacing:-0.02em;font-weight:600;overflow-wrap:anywhere}
.hub p{font-size:12.5px;color:#52525B;line-height:1.45}
.br{display:grid;gap:8px;min-width:0}
.bh{display:grid;gap:2px}
.bh b{justify-self:start;background:#000;color:#fff;font-size:10.5px;font-weight:400;padding:6px 9px}
.bh span{font-size:12px;color:#8E8E93}
.col.l .bh{justify-items:end;text-align:right}
.col.l .bh b{justify-self:end}
.leaves{list-style:none;display:flex;flex-direction:column;gap:6px}
.col.l .leaves{align-items:flex-end}
.leaves li{display:grid;gap:2px;max-width:100%;min-width:0}
.col.l .leaves li{justify-items:end;text-align:right}
.leaf{display:inline-flex;align-items:center;gap:8px;max-width:100%;border:1px solid #000;padding:6px 10px;text-decoration:none;background:#fff}
.leaf:hover{background:#F6F6F6}
.leaf.person{border-style:dashed}
.leaf .nm{font-size:14px;font-weight:500;min-width:0;overflow-wrap:anywhere}
.leaf .rw{font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#8E8E93;white-space:nowrap}
.leaves .sub{font-size:11.5px;color:#8E8E93;padding:0 2px;max-width:38ch;overflow-wrap:anywhere}
svg.wires{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible}
svg.wires path{fill:none;stroke:#000;stroke-width:1}
.cap{color:#8E8E93;font-size:12.5px;line-height:1.55;max-width:88ch;margin-top:18px}
/* every tie in full */
.grp{margin-top:48px}
.grp h2{font-size:clamp(22px,2.6vw,30px);letter-spacing:-0.025em;font-weight:500;margin-bottom:12px}
.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;align-items:stretch}
.card{background:#fff;padding:16px 16px 14px;display:flex;flex-direction:column;gap:7px;min-width:0;scroll-margin-top:16px}
.card.person h3::after{content:" · person";font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;color:#B4B4B8;letter-spacing:.05em}
.card:target{outline:2px solid #000;outline-offset:-2px}
.nh{display:flex;justify-content:space-between;gap:8px;align-items:center;min-width:0}
.nh .k{font-size:10px;color:#8E8E93;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card h3{font-size:17px;font-weight:500;letter-spacing:-0.015em;overflow-wrap:anywhere}
.card .lg,.card .wh{font-size:12.5px;color:#8E8E93;line-height:1.5;overflow-wrap:anywhere}
.ties{list-style:none;display:grid;gap:7px;font-size:13px;line-height:1.5;color:#3F3F46;overflow-wrap:anywhere}
.ties b{font-weight:600;color:#000}
.ties a,.src a{color:#8E8E93;font-size:11.5px;text-decoration:none;border-bottom:1px solid #E7E7E7}
.s2{border-top:1px solid #F1F1F1;padding-top:8px}
.chn{font-size:12.5px;color:#8E8E93;overflow-wrap:anywhere}
.chn b{color:#000;font-weight:600}
.src{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:auto;padding-top:4px}
.method{border:1px solid #E7E7E7;padding:20px 22px;margin-top:48px}
.method h3{font-size:17px;font-weight:500;margin-bottom:6px}
.method p{color:#52525B;font-size:13.5px;line-height:1.6;max-width:88ch}
@media(max-width:1060px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:980px){
  .map{grid-template-columns:minmax(0,1fr);gap:0}
  .hub{order:-1;text-align:left}
  .col{border-left:1px solid #000;margin-left:12px;padding:22px 0 0 22px}
  .col.r{padding-bottom:4px}
  .col.l .bh,.col.l .leaves li{justify-items:start;text-align:left}
  .col.l .bh b{justify-self:start}
  .col.l .leaves{align-items:flex-start}
  .br{position:relative}
  .br::before{content:"";position:absolute;left:-23px;top:13px;width:18px;border-top:1px solid #000}
  svg.wires{display:none}
}
@media(max-width:640px){.cards{grid-template-columns:minmax(0,1fr)}.leaf .rw{display:none}}
</style>
</head>
<body>
<div class="banner">COMPANY WEB · PUBLIC SOURCES ONLY · EVERY TIE LINKS TO ITS SOURCE</div>
${PC.header('/research')}
<main class="wrap">
  ${switcher(webs, w.slug)}
  <div class="eyebrow"><span class="sq"></span>COMPANY WEB${C.city ? ' · ' + esc(shortCity(C.city).toUpperCase()) : ''}</div>
  <h1>Who ${esc(w.title)} backs, runs and sells to.</h1>
  <div class="bl"><span class="k">Bottom line</span>${esc(w.bottom_line || '')}</div>
  <div class="stats">
    <div class="cell"><div class="v">${nEnt}</div><div class="kk">tied directly to ${esc(w.title)}</div></div>
    <div class="cell"><div class="v">${nInv}</div><div class="kk">firms it invested in</div></div>
    <div class="cell"><div class="v">${nBack}</div><div class="kk">owners or investors that claim it</div></div>
    <div class="cell"><div class="v">${w.counts.links}</div><div class="kk">sourced ties · ${w.counts.confirmed} confirmed</div></div>
  </div>
  <div class="legend"><span class="mono">Evidence:</span>${chip('confirmed')}${chip('company_claim')}${chip('snippet')}${chip('inferred')}<span>· dashed box = a person · a name opens its card below</span></div>
  <div class="map" id="map">
    <svg class="wires" id="wires" aria-hidden="true"></svg>
    <div class="col l">${side.l.join('')}</div>
    <div class="hub" id="hub"><span class="k mono">The subject</span><span class="nm2">${esc(C.name)}</span>
      ${C.legal_name && C.legal_name !== C.name ? `<p>${esc(C.legal_name)}</p>` : ''}${C.what ? `<p>${esc(C.what)}</p>` : ''}</div>
    <div class="col r">${side.r.join('')}</div>
  </div>
  <p class="cap">${esc(w.title)} sits in the middle; each branch is one kind of tie. Grey lines under a name are that firm's or person's own ties, such as a director's other companies or the shops a brand sells on.</p>
  ${detail}
  <div class="method"><h3>How this was made</h3>
  <p>One research pass in Oct 2026 over company and school sites, regional news, government releases, Kemenperin's TKDN and company registers, filings and investor pages. Sites whose robots.txt blocks AI agents were not fetched. The paid company register (AHU) was not checked, so a stake size appears only where a source states it. People appear only in public business roles. Updated ${esc(String(w.generated || '').slice(0, 10))}.</p></div>
</main>
${foot()}
<script src="/js/cncweb.js?v=${PC.CV}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

/* the firm table and the map link a firm to its web by name */
function webSlugFor(name, webs) {
  const low = String(name || '').toLowerCase().replace(/\b(pt|cv|tbk|persero|ud|yayasan)\b\.?/g, ' ');
  const k = low.replace(/[^a-z0-9]+/g, '');
  const words = new Set(low.split(/[^a-z0-9]+/).filter(Boolean));
  if (k.length < 4) return null;
  for (const w of webs || []) {
    /* long keys may sit inside a longer name; short ones (YPTI, INKA) only as a whole word */
    if ((w.keys || []).some((wk) => (wk.length >= 6 ? (k === wk || k.includes(wk)) : words.has(wk)))) return w.slug;
  }
  return null;
}

module.exports = { index, web, webSlugFor };
