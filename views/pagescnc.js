'use strict';
/* CNC + 3D Indonesia — the working draft of a China-style "one place, one
 * product" map for CNC machining and 3D printing (Luca, 16 Oct 2026: "check
 * umkm.vantis.sh, we may make like that … the idea is like china, when the
 * province focus on each commodity/tools"; go on slice 1 the same day).
 * Served when the request host is cnc.vantis.sh. Working name and host: the
 * brand, the domain and indexing are Luca's calls (noindex until then).
 *
 * Built like 1001umkm.id on purpose: same type, hairlines, gradient and table
 * mechanics (the shared chunks come from views/pagesumkm.js), its own data file
 * public/data/cnc.json (scripts/cnc-build.py), its own client /js/cnc.js.
 * English only for slice 1.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const UM = require('./pagesumkm');

/* own cache-buster for /js/cnc*.js: the shared V belongs to every pasar host,
   and other sessions bump it — iterating on these two files must not need it */
const CV = V + '-c6';

const NAVL = [
  ['/#places', 'Focus places'], ['/map', 'Map'], ['/#firms', 'Firms'], ['/research', 'Research'], ['/#method', 'Method'],
];

function header(active) {
  return `<header class="hd1001"><div class="hrow">
  <a class="brand" href="/"><span class="bx">CNC</span>CNC + 3D Indonesia<span class="wn mono">working name</span></a>
  <nav class="hnav" aria-label="Site">
    ${NAVL.map(([h, l]) => `<a${active === h ? ' class="on"' : ''} href="${h}">${l}</a>`).join('')}
    <!--PX-BADGE-->
  </nav>
</div></header>`;
}
const BRANDCSS = `.hd1001 .wn{margin-left:8px;font-size:9px;color:#B4B4B8;border:1px solid #E7E7E7;padding:3px 5px;font-weight:400}
@media(max-width:520px){.hd1001 .wn{display:none}}`;

const fmt = (n) => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US');
const srcHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
const note = (o) => `data-n="${esc(JSON.stringify(o))}"`;
/* the four evidence tiers reuse umkm's badge weights (tb6 strongest … tb2 entry) */
const TBCLASS = { 4: 'tb6', 3: 'tb4', 2: 'tb3', 1: 'tb2' };
const FITLABEL = { cnc: 'CNC', '3d': '3D printing', both: 'CNC + 3D' };

function tierMark(f, TM) {
  const t = TM[f.tier] || {};
  return `<button type="button" class="tb ${TBCLASS[f.tier_rank] || 'tb2'}" ${note({
    k: 'tier' + ({ 4: 6, 3: 4, 2: 3, 1: 1 }[f.tier_rank] || 1),
    t: (t.label || f.tier) + ' — evidence tier ' + f.tier_rank + ' of 4',
    b: (t.def || '') + (f.evidence ? ' What the source shows: ' + f.evidence : ''),
    m: [f.source_type, f.source_year].filter(Boolean).join(' · '),
    l: [
      f.source_url ? { h: f.source_url, t: 'Open the source — ' + srcHost(f.source_url) + ' ↗' } : null,
      f.website && f.website !== f.source_url ? { h: f.website, t: 'Company website — ' + srcHost(f.website) + ' ↗' } : null,
      { h: '/#tiers', t: 'What the four tiers mean →' },
    ].filter(Boolean),
  })} aria-expanded="false" aria-label="${esc((t.label || f.tier) + ' — show what this evidence tier means')}">${esc(t.short || f.tier)}</button>`;
}

function landing({ data, webs }) {
  const RC = require('./researchcnc');
  const T = (data && data.totals) || {};
  const firms = (data && data.firms) || [];
  const places = (data && data.places) || [];
  const TM = ((data && data.method) || {}).tier_meta || {};
  const byTier = (data && data.by_tier) || {};
  const kinds = (data && data.kinds) || [];
  const fams = (data && data.families) || [];
  const cov = T.coverage || {};
  const provinces = [...new Set(firms.map((f) => f.province).filter(Boolean))].sort();
  const famColor = {};
  fams.forEach((x) => { famColor[x.key] = x.color; });

  const locCell = (f) => [f.city, f.province].filter(Boolean).join(' · ');
  const rows = firms.map((f) => `
    <tr data-f="${esc([f.name, f.kind_label, f.city || '', f.province || '', (f.serves || []).join(' '), (f.certs || []).join(' ')]
      .filter(Boolean).join(' ').toLowerCase())}" data-s="${esc(f.kind_label)}" data-t="${f.tier_rank}" data-p="${esc(f.province || '')}" data-c="${f.has_3d ? '1' : ''}">
      <td class="rk" data-v="${f.rank}">${f.rank}</td>
      <td data-v="${esc(f.name.toLowerCase())}">${f.website
        ? `<a href="${esc(f.website)}" target="_blank" rel="noopener nofollow">${esc(f.name)}</a>`
        : esc(f.name)}${tierMark(f, TM)}${(() => { const ws = RC.webSlugFor(f.name, webs); return ws ? ` <a class="wl mono" href="/research/${esc(ws)}">company web →</a>` : ''; })()}</td>
      <td class="mu" data-v="${esc(f.kind_label.toLowerCase())}">${esc(f.kind_label)}</td>
      <td class="mu" data-v="${esc(locCell(f).toLowerCase())}">${esc(locCell(f) || '—')}</td>
      <td class="pr"><div class="cl">${esc((f.capabilities || []).join(' · ') || '—')}</div></td>
      <td class="pr mk"><div class="cl">${esc(f.makes || (f.serves || []).join(', ') || '—')}</div></td>
      <td class="ct mono" data-v="${esc(srcHost(f.source_url))}">${f.source_url ? `<a href="${esc(f.source_url)}" target="_blank" rel="noopener nofollow">${esc(srcHost(f.source_url))}</a>` : '—'}</td>
    </tr>`).join('');

  const tierChip = (k) => {
    const t = TM[k];
    return `<button class="chip tchip" data-t="${t.rank}" aria-pressed="false" style="--tc:${t.color}">${esc(t.label)} · ${fmt(byTier[k] || 0)}</button>`;
  };

  /* the focus table: one row per place, in island order — the China idea in
     one glance; a row opens that place on the map */
  let lastIsland = '';
  const placeRows = places.map((p) => {
    const head = p.island !== lastIsland
      ? `<tr class="isl"><td colspan="6">${esc(p.island)}</td></tr>` : '';
    lastIsland = p.island;
    const f = p.focus || {};
    const also = (p.also || []).map((a) => a.product).filter(Boolean).join(' · ');
    return `${head}<tr data-id="${esc(p.id)}">
      <td><a class="plink" href="/map?place=${encodeURIComponent(p.id)}">${esc(p.area)}</a>
        <span class="lv mono">${p.level === 'cluster' ? 'cluster' : 'province'}</span></td>
      <td class="mu">${esc(p.province)}</td>
      <td><span class="fam" style="--fc:${esc(famColor[f.family] || '#8E8E93')}"></span><strong class="fs">${esc(f.short || f.product || '—')}</strong>${
        f.product && f.short && f.product !== f.short ? `<div class="pf">${esc(f.product)}</div>` : ''}</td>
      <td class="mono fit">${esc(FITLABEL[f.fit] || '—')}</td>
      <td class="pr"><div class="cl">${esc(also || '—')}</div></td>
      <td class="mono cf cf-${esc(p.confidence || 'low')}">${esc(p.confidence || '—')}</td>
    </tr>`;
  }).join('');

  const famKey = fams.filter((x) => x.count).map((x) =>
    `<span class="fk"><span class="fam" style="--fc:${esc(x.color)}"></span>${esc(x.label)} · ${x.count}</span>`).join('');

  const tierBlocks = Object.entries(TM).sort((a, b) => b[1].rank - a[1].rank).map(([k, t]) => `
    <div class="vt">
      <div class="vth"><span class="tb ${TBCLASS[t.rank]}" aria-hidden="true">${esc(t.short)}</span>
      <span class="vtc mono">${fmt(byTier[k] || 0)} of ${fmt(T.firms)}</span></div>
      <h3>${esc(t.label)}</h3>
      <p>${esc(t.def)}</p>
    </div>`).join('');

  const covRows = [
    ['City', cov.city], ['Capabilities', cov.capabilities], ['What it makes', cov.makes],
    ['Sectors served', cov.serves], ['Certificates', cov.certs], ['Website', cov.website], ['Source URL', cov.source_url],
  ].map(([k, n]) => {
    const pct = Math.round((n || 0) / (T.firms || 1) * 100);
    return `<tr><td>${k}</td><td class="n mono">${fmt(n)} / ${fmt(T.firms)}</td>
    <td class="cbar"><span style="width:${pct}%"></span></td><td class="n mono">${pct}%</td></tr>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CNC + 3D Indonesia — one place, one product</title>
<meta name="description" content="Working draft: where Indonesia can make parts and tools with CNC machines and 3D printers — a focus product for every province and Java cluster, and ${fmt(T.firms)} named firms that already machine or print, each linked to its source.">
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
${BRANDCSS}
.hero{max-width:1180px;margin:0 auto;padding:64px 20px 54px;display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:start}
@media(max-width:880px){.hero{grid-template-columns:1fr;padding-top:40px}}
.hero h1{font-size:clamp(40px,5.6vw,72px);line-height:1.02;letter-spacing:-0.03em;font-weight:500}
.hero .sub{color:#52525B;font-size:16.5px;line-height:1.55;max-width:52ch}
.hero .cta{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}
.btn{display:inline-block;padding:12px 18px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;border:1px solid #000;cursor:pointer;background:#fff;color:#000}
.btn.primary{background:#000;color:#fff}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.stats{max-width:1140px;width:calc(100% - 40px);margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:1139px){.stats{grid-template-columns:repeat(3,1fr)}.stats .cell:nth-child(5){grid-column:span 2}}
@media(max-width:860px){.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:470px){.stats{grid-template-columns:1fr}.stats .cell:nth-child(5){grid-column:auto}}
.stats .cell{background:#fff;padding:22px 18px}
.stats .v{font-size:clamp(26px,3vw,40px);letter-spacing:-0.02em;background:${UM.GRAD};-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:600;font-variant-numeric:tabular-nums}
.stats .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#8E8E93;margin-top:6px}
.stats .k .q{display:block;color:#B4B4B8;margin-top:4px}
.stats .k .q a{text-decoration:none;color:inherit;border-bottom:1px solid #E7E7E7}
.stats .k .q a:hover{color:#000;border-color:#000}
.wrap{max-width:1180px;margin:0 auto;padding:54px 20px 0}
.lede{color:#52525B;font-size:14.5px;line-height:1.6;max-width:92ch;margin-bottom:16px}
.h2{font-size:clamp(26px,3.2vw,38px);line-height:1.06;letter-spacing:-0.025em;font-weight:500;margin-bottom:12px;max-width:28ch}
.toolbar{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}
#q{width:100%;max-width:560px;padding:13px 16px;border:1px solid #000;font:500 15px/1 'Overused Grotesk',sans-serif;outline:none}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:7px 11px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
.chip.on{background:#000;color:#fff;border-color:#000}
.chiprow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.chip.tchip{border-color:var(--tc);color:var(--tc)}
.chip.tchip[aria-pressed="true"]{background:var(--tc);border-color:var(--tc);color:#fff}
.chip.cchip{border-color:#000;color:#000}
.chip.cchip[aria-pressed="true"]{background:#000;color:#fff}
#prov{padding:8px 10px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1.2 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#000;max-width:280px}
.count{font-size:11px;color:#8E8E93}
.rowhint{font-size:11px;color:#8E8E93;text-transform:none;letter-spacing:0;font-family:'Overused Grotesk',sans-serif}
.pager{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:12px}
.pager button{padding:7px 11px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;color:#000}
.pager button:hover:not(:disabled){border-color:#000}
.pager button[aria-current="page"]{background:#000;color:#fff;border-color:#000}
.pager button:disabled{color:#C7C7CC;cursor:default}
.pager .gap{color:#C7C7CC;font-size:11px;padding:0 2px}
.pager .range{margin-left:auto;font-size:11px;color:#8E8E93}
.tablewrap{overflow-x:auto;border:1px solid #E7E7E7}
table{border-collapse:collapse;width:100%;font-size:13.5px}
#tbl{min-width:1080px}
#ptbl{min-width:880px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8E8E93;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
th.s{padding:0}
th.s>button{width:100%;padding:10px 12px;border:0;background:none;font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit;text-align:inherit;cursor:pointer}
th.s>button>.ca{margin-left:6px;color:#D8D8DC}
th.s>button>.ca::before{content:'↕'}
th.s:hover>button>.ca{color:#8E8E93}
th.s[aria-sort]>button{color:#000}
th.s[aria-sort="ascending"]>button>.ca{color:#000}
th.s[aria-sort="ascending"]>button>.ca::before{content:'↑'}
th.s[aria-sort="descending"]>button>.ca{color:#000}
th.s[aria-sort="descending"]>button>.ca::before{content:'↓'}
th.s>button:focus-visible{outline:2px solid #000;outline-offset:-2px}
td{padding:9px 12px;border-bottom:1px solid #F1F1F1;vertical-align:top}
td.rk{font-family:'IBM Plex Mono',monospace;color:#8E8E93;font-size:12px}
td.mu{color:#52525B;font-size:12.5px}
td.pr{color:#52525B;font-size:12.5px;line-height:1.45;max-width:340px}
td.pr .cl{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
td.mk{max-width:260px}
td.ct{color:#8E8E93;font-size:10.5px;white-space:nowrap;text-align:right}
th.ct{text-align:right}
td a{text-decoration:none;border-bottom:1px solid #D9D9D9}
td a:hover{border-bottom-color:#000}
td a.wl{margin-left:8px;font-size:9.5px;color:#4E7A96;border-bottom-color:#C8D7E3;white-space:nowrap}
/* the focus table */
#ptbl tr.isl td{font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#000;background:#FAFAFA;padding:9px 12px;border-bottom:1px solid #E7E7E7}
#ptbl .plink{font-weight:500}
#ptbl .fs{font-weight:500}
#ptbl .pf{margin:3px 0 0 18px;color:#8E8E93;font-size:12px;line-height:1.45;max-width:62ch}
#ptbl .lv{margin-left:7px;font-size:9px;color:#B4B4B8}
#ptbl td.fit{font-size:10.5px;color:#52525B;white-space:nowrap}
#ptbl td.cf{font-size:10px;white-space:nowrap}
.cf-high{color:#2F7A5C}.cf-medium{color:#8A6A45}.cf-low{color:#B4B4B8}
.fam{display:inline-block;width:9px;height:9px;transform:rotate(45deg);background:var(--fc);margin-right:9px;vertical-align:0}
.famkey{display:flex;gap:6px 16px;flex-wrap:wrap;margin:0 0 14px;font:400 10.5px/1.5 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#52525B}
.famkey .fk{white-space:nowrap}
.foot-key{list-style:none;margin:14px 0 0;padding:0;border-top:1px solid #E7E7E7}
.foot-key li{display:grid;grid-template-columns:96px 1fr;gap:0 16px;padding:8px 0;border-bottom:1px solid #F1F1F1}
.foot-key .fk{font:400 10px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#B4B4B8;padding-top:1px}
.foot-key .fv{font-size:11.5px;line-height:1.5;color:#8E8E93}
.foot-key .fv a{color:inherit;text-decoration:none;border-bottom:1px solid #C7C7CC}
${UM.TBCSS}
${UM.NOTECSS}
.mapembed{position:relative;border:1px solid #E7E7E7;background:#E4E7E6;height:min(72vh,600px)}
@media(max-width:640px){.mapembed{height:62vh}}
.mapframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.mapshield{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;text-decoration:none;background:linear-gradient(180deg,rgba(255,255,255,0) 62%,rgba(255,255,255,.5))}
.mapshield span{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;background:#000;color:#fff;padding:11px 15px}
.mapshield:hover span{background:#333}
.mapshield.off{display:none}
.vgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:1060px){.vgrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.vgrid{grid-template-columns:1fr}}
.vt{background:#fff;padding:22px 18px}
.vt .vth{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:26px}
.vt .vth .tb{margin-left:0;cursor:default;flex:none;white-space:nowrap}
.vt .vtc{font-size:10px;color:#B4B4B8;flex:none;text-align:right}
.vt h3{font-size:17px;font-weight:500;letter-spacing:-0.015em;margin-bottom:8px}
.vt p{color:#52525B;font-size:12.5px;line-height:1.55}
.method{border:1px solid #E7E7E7;padding:22px;margin-bottom:14px}
.method h3{font-size:17px;font-weight:500;letter-spacing:-0.015em;margin-bottom:8px}
.method p{color:#52525B;font-size:14px;line-height:1.6;max-width:88ch}
.method p+h3,.method table+h3{margin-top:20px}
.covtbl{border-collapse:collapse;width:100%;max-width:640px;font-size:12.5px;margin-top:12px}
.covtbl td{padding:6px 10px 6px 0;border-bottom:1px solid #F1F1F1;color:#52525B}
.covtbl td.n{text-align:right;font-size:11px;color:#8E8E93;white-space:nowrap}
.covtbl .cbar{width:34%;min-width:120px}
.covtbl .cbar span{display:block;height:5px;background:${UM.GRAD}}
.ft{border-top:1px solid #E7E7E7;margin-top:64px}
.ftin{max-width:1180px;margin:0 auto;padding:40px 20px 28px}
.ftlegal{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;border-top:1px solid #E7E7E7;padding-top:18px;font-size:10.5px;line-height:1.6;color:#8E8E93}
.ftlegal a{color:inherit;text-decoration:none;border-bottom:1px solid #D9D9D9}
.fbx{display:inline-flex;align-items:center;gap:10px;font-weight:600;text-decoration:none;margin-bottom:10px}
.fbx i{width:26px;height:26px;border:1.5px solid #000;display:grid;place-items:center;font:600 9px/1 'IBM Plex Mono',monospace;font-style:normal}
.fth{font-size:20px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;max-width:34ch;margin-bottom:26px}
</style>
</head>
<body>
<div class="banner">WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY FIRM LINKS TO THE SOURCE IT WAS COMPILED FROM</div>
${header('')}
<section class="hero">
  <h1>One place, one product: Indonesia's CNC and 3D-printing map.</h1>
  <div>
    <p class="sub">China grew whole counties around one product: pumps in Wenling, eyeglass lenses in Danyang,
    hardware in Yongkang. This draft asks the same question of Indonesia. For each of ${fmt(T.provinces)} provinces and
    the Java clusters, it names the product CNC machines and 3D printers there could make for buyers who now import it,
    and lists ${fmt(T.firms)} firms that already machine or print, each linked to its source.</p>
    <div class="cta">
      <a class="btn primary" href="#places">See each place's focus</a>
      <a class="btn" href="/map">Open the map</a>
      <a class="btn" href="#firms">Browse the firms</a>
    </div>
  </div>
</section>

<section class="stats" id="stats">
  ${[
    [fmt(T.places), 'focus places', `${fmt(T.provinces)} provinces · ${fmt(T.clusters)} Java clusters`, '#places'],
    [fmt(T.focus_products), 'distinct focus products', 'moulds to dental aligners', '#places'],
    [fmt(T.firms), 'firms listed', `${fmt(T.firm_provinces)} provinces on record`, '#firms'],
    [fmt(T.with_3d), 'can 3D-print', 'resin, FDM, SLS or metal', '#firms'],
    [fmt(byTier.cert || 0), 'with a certificate on record', 'TKDN, ISO, AS9100, IATF, BKI…', '#tiers'],
  ].map(([v, k, q, href]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}${q ? `<span class="q">${href ? `<a href="${href}">${q} →</a>` : q}</span>` : ''}</div></div>`).join('')}
</section>

<section class="wrap" id="places">
  <div class="eyebrow"><span class="sq"></span>THE FOCUS PLACES</div>
  <h2 class="h2">What each place could make, China-style.</h2>
  <p class="lede">One focus product per province, and per regency cluster on Java, where the machine shops are. Each pick
  weighs four things: local buyers who import the part today, firms that can already make it, inputs nearby, and any
  core industry the government has already designated there. The picks are research judgement from public sources, not
  an official plan. Open a place on the map for the reasons, the buyers and the sources.</p>
  <div class="famkey">${famKey}</div>
  <div class="tablewrap"><table id="ptbl">
    <thead><tr><th>Place</th><th>Province</th><th>Focus product</th><th>Made with</th><th>Also</th><th>Confidence</th></tr></thead>
    <tbody>${placeRows}</tbody>
  </table></div>
</section>

<section class="wrap" id="map">
  <div class="eyebrow"><span class="sq"></span>THE MAP</div>
  <h2 class="h2">Every focus place and firm, across the archipelago.</h2>
  <p class="lede">The focus places sit at their main city. The firms sit at their recorded city, because that is the
  resolution the sources honestly hold. Firms whose city could not be placed stay in the table.</p>
  <div class="mapembed">
    <iframe class="mapframe" src="/map?embed=1" title="The CNC and 3D-printing map" loading="lazy"></iframe>
    <a class="mapshield" id="mapshield" href="/map"><span>Click to explore the live map</span></a>
  </div>
</section>

<section class="wrap" id="firms">
  <div class="eyebrow"><span class="sq"></span>THE FIRMS</div>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Search ${fmt(T.firms)} firms — capability, city, sector, product…" autocomplete="off">
    <div class="chips" id="chips">
      <button class="chip on" data-s="">All</button>
      ${kinds.filter((k) => k.count).map((k) => `<button class="chip" data-s="${esc(k.label)}">${esc(k.label)} · ${fmt(k.count)}</button>`).join('')}
    </div>
    <div class="chiprow">
      ${Object.entries(TM).sort((a, b) => b[1].rank - a[1].rank).map(([k]) => tierChip(k)).join('')}
    </div>
    <div class="chiprow">
      <select id="prov" aria-label="Filter by province">
        <option value="">All provinces</option>
        ${provinces.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
      </select>
      <button class="chip cchip" id="contactOnly" aria-pressed="false">3D printing only · ${fmt(T.with_3d)}</button>
      <div class="count mono" id="count">${firms.length} shown</div>
    </div>
    <div class="rowhint mono">A firm's name opens its own website where one is recorded. Hover or tap an evidence badge for what the source shows.</div>
  </div>
  <div class="tablewrap"><table id="tbl">
    <thead><tr>${[
      ['#', 'num', 'rk', 1], ['Firm', 'txt', '', 1], ['Kind', 'txt', 'mu', 1], ['Location', 'txt', 'mu', 1],
      ['Capabilities', '', '', 0], ['Makes', '', '', 0], ['Source', 'txt', 'ct', 1],
    ].map(([label, kind, cls, sortable], i) => sortable
      ? `<th class="s${cls ? ' ' + cls : ''}" data-i="${i}" data-t="${kind}"${i === 0 ? ' aria-sort="ascending"' : ''}><button type="button">${label}<span class="ca" aria-hidden="true"></span></button></th>`
      : `<th${cls ? ` class="${cls}"` : ''}>${label}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <nav class="pager mono" id="pager" aria-label="Firm table pages" hidden></nav>
  <ul class="foot-key">
    <li><span class="fk">Ranking</span><span class="fv">By evidence tier first, then whether the firm has a website, then by name. Click # to return to it.</span></li>
    <li><span class="fk">Evidence</span><span class="fv">Every row carries one of <a href="#tiers">four evidence tiers</a>. A tier says what public evidence we read. It is not a quality audit.</span></li>
    <li><span class="fk">No figure</span><span class="fv">"—" means the source did not say. Blanks stay blank; machine counts and certificates are never guessed.</span></li>
  </ul>
</section>

<section class="wrap" id="tiers">
  <div class="eyebrow"><span class="sq"></span>EVIDENCE</div>
  <h2 class="h2">Four tiers, from a listing to a certificate.</h2>
  <p class="lede">Each firm carries one badge saying what stands behind it. Check any firm directly before you order parts or sign a contract.</p>
  <div class="vgrid">${tierBlocks}</div>
</section>

<section class="wrap" id="method">
  <div class="eyebrow"><span class="sq"></span>METHOD</div>
  <div class="method">
    <h3>Where the rows come from</h3>
    <p>${esc(((data && data.method) || {}).sources_note || '')}</p>
    <h3>What each field holds, and how often</h3>
    <p>Coverage is uneven because publication is uneven: Java's metal clusters publish far more than Maluku or Papua.</p>
    <table class="covtbl">${covRows}</table>
    <h3>How a focus product was picked</h3>
    <p>${esc(((data && data.method) || {}).focus_note || '')}</p>
    <h3>What has not been done yet</h3>
    <p>No firm has been visited or called. Websites have not been checked for liveness. Focus places sit at one
    anchor city, so a cluster marker stands for several regencies. Market sizes and the share local makers could take
    come next, with the product grid and the China cases.</p>
  </div>
</section>

<div class="note" id="note" role="tooltip" hidden>
  <button type="button" class="nx" aria-label="Close">×</button>
  <div class="nk"></div>
  <div class="nb"></div>
  <div class="nm" hidden></div>
  <div class="nl" hidden></div>
</div>

<footer class="ft">
  <div class="ftin">
    <a class="fbx" href="/"><i>CNC</i>CNC + 3D Indonesia</a>
    <div class="fth">Where Indonesia could make its own parts and tools, one place at a time.</div>
    <div class="ftlegal mono">
      <span>Working draft · public sources only · updated ${esc(((data && data.generated) || '').slice(0, 10))}</span>
      <span><a href="https://vantis.sh/cookies/" data-vs-reopen>Cookies</a></span>
    </div>
  </div>
</footer>
<script src="/js/cnc.js?v=${CV}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

function notFound() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Not found — CNC + 3D Indonesia</title><meta name="robots" content="noindex, nofollow">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
${UM.HEADCSS}
${BRANDCSS}
.nf{max-width:1180px;margin:0 auto;padding:80px 20px}
.nf h1{font-size:clamp(32px,4vw,52px);font-weight:500;letter-spacing:-0.03em;margin-bottom:14px}
.nf p{color:#52525B;max-width:60ch}
.nf a{border-bottom:1px solid #000;text-decoration:none}
</style></head>
<body>${header('')}
<div class="nf"><h1>This page does not exist.</h1>
<p>Try <a href="/">the focus places and firms</a> or <a href="/map">the map</a>.</p></div>
</body></html>`;
}

module.exports = { landing, notFound, header, BRANDCSS, CV };
