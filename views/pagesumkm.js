'use strict';
/* 1001umkm.id — the export supplier census as its own product, sibling of
 * 1001startup.id. Served when the request host is umkm.vantis.sh (later:
 * 1001umkm.id). Same brand system on purpose — Luca, Aug 31 2026: "use the
 * same way, including logo company name etc of the 1001startup.id, so we can
 * make different product". Overused Grotesk + IBM Plex Mono, white, hairlines,
 * square, the one 4-stop gradient, the 1001 box mark.
 *
 * Server-rendered from public/data/umkm.json per request; /js/umkm.js filters
 * the server-rendered rows client-side (CSP is script-src 'self' — inline
 * scripts are silently dropped, the census's oldest trap). English only:
 * the audience is overseas buyers sourcing from Indonesia.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');   // shared cache-buster: /js and /css ship immutable for a year
/* Since 18 Oct 2026 the same census also renders INSIDE 1001startup.id at
   /umkm (lib/homelive.js): pass base '/umkm' and the page takes the 1001
   header, menu and footer, its links live under /umkm, and the isometric map
   section is left out (1001's only map is the logo map). base '' = the
   umkm.vantis.sh page exactly as it was. */
const NAV = require('./nav1001');
const FOOT = require('./footer1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';

const NAVL = [
  ['#exporters', 'Exporters'], ['/map', 'Map'], ['#sectors', 'Sectors'], ['#verification', 'Verification'],
  ['#method', 'Method'], ['#dataset', 'Dataset'],
];

function header(active) {
  return `<header class="hd1001"><div class="hrow">
  <a class="brand" href="/"><span class="bx">1001</span>1001umkm.id</a>
  <nav class="hnav" aria-label="Site">
    ${NAVL.map(([h, l]) => `<a${active === h ? ' class="on"' : ''} href="${h}">${l}</a>`).join('')}
    <!--PX-BADGE-->
  </nav>
</div></header>`;
}

const HEADCSS = `
.hd1001{border-bottom:1px solid #E7E7E7;background:#fff}
.hd1001 .hrow{max-width:1180px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:22px}
.hd1001 .brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:600}
.hd1001 .bx{width:26px;height:26px;border:1.5px solid #000;display:grid;place-items:center;font:600 9px/1 'IBM Plex Mono',monospace}
.hnav{display:flex;gap:4px;margin-left:auto;font-size:14px;align-items:center}
.hnav>a{text-decoration:none;color:#52525B;padding:7px 10px}
.hnav>a:hover{color:#000}
.hnav>a.on{color:#000;box-shadow:inset 0 -2px #E8734B}
@media(max-width:1120px){.hd1001 .hrow{flex-wrap:wrap;gap:12px}.hnav{margin-left:0;flex-wrap:wrap}}
@media(max-width:700px){.hnav{gap:2px;font-size:13px;flex-wrap:wrap}.hnav>a{padding:6px 8px}}`;

const fmt = (n) => (n === null || n === undefined) ? '—' : n.toLocaleString('en-US');
const srcHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };

/* tier badges + the shared note panel — used by the landing AND the company
   page, so they live as one exported chunk each (the census's one-renderer
   discipline, applied to CSS) */
const TBCSS = `
.tb{display:inline-block;margin-left:7px;padding:1px 5px;border:1px solid;text-decoration:none;font:400 9.5px/1.45 'IBM Plex Mono',monospace;letter-spacing:.04em;vertical-align:1px;background:none;cursor:help}
.tb.tb6{border-color:#2F7A5C;color:#2F7A5C}
.tb.tb5{border-color:#4E7A58;color:#4E7A58}
.tb.tb4{border-color:#4E7A96;color:#4E7A96}
.tb.tb3{border-color:#8A6A45;color:#8A6A45}
.tb.tb2{border-color:#B4B4B8;color:#8E8E93}
.tb.tb1{border-color:#C9B79A;color:#9A7B4F}
button.tb:hover,button.tb[aria-expanded="true"]{color:#fff}
button.tb.tb6:hover,button.tb.tb6[aria-expanded="true"]{background:#2F7A5C}
button.tb.tb5:hover,button.tb.tb5[aria-expanded="true"]{background:#4E7A58}
button.tb.tb4:hover,button.tb.tb4[aria-expanded="true"]{background:#4E7A96}
button.tb.tb3:hover,button.tb.tb3[aria-expanded="true"]{background:#8A6A45}
button.tb.tb2:hover,button.tb.tb2[aria-expanded="true"]{background:#8E8E93}
button.tb.tb1:hover,button.tb.tb1[aria-expanded="true"]{background:#9A7B4F}
button.tb:focus-visible{outline:2px solid #000;outline-offset:2px}
/* a row whose source was never recorded as a link says so, in place of a badge
   that would go nowhere */
.nosrc{display:inline-block;margin-left:7px;padding:1px 5px;border:1px dashed #D9D9DE;color:#B4B4B8;font:400 9.5px/1.45 'IBM Plex Mono',monospace;letter-spacing:.04em;vertical-align:1px;background:none;cursor:help}
button.nosrc:hover,button.nosrc[aria-expanded="true"]{border-color:#8E8E93;color:#52525B}`;

const NOTECSS = `
.note{position:fixed;z-index:10000;width:max-content;max-width:min(400px,calc(100vw - 20px));background:#fff;border:1px solid #000;padding:15px 17px 14px;box-shadow:0 10px 30px rgba(0,0,0,.10)}
.note[hidden]{display:none}
.note .nk{font:400 10px/1.35 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#8E8E93;padding-right:20px}
.note .nb{margin-top:9px;font:500 13px/1.6 'Overused Grotesk',sans-serif;letter-spacing:-0.01em;color:#3F3F46;white-space:pre-wrap}
.note .nm{margin-top:9px;font:400 9.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#B4B4B8}
.note .nl{margin-top:12px;padding-top:11px;border-top:1px solid #EFEFEF;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.note .nl a{font:400 11px/1.45 'IBM Plex Mono',monospace;color:#000;text-decoration:none;border-bottom:1px solid #D9D9D9}
.note .nl a:hover{border-bottom-color:#000}
.note .nx{position:absolute;top:5px;right:6px;width:24px;height:24px;border:0;background:none;font:400 16px/1 'IBM Plex Mono',monospace;color:#8E8E93;cursor:pointer;display:none}
.note.pin .nx{display:block}
.note.pin .nx:hover{color:#000}
.note[data-k="tier6"]{border-color:#2F7A5C}.note[data-k="tier6"] .nk{color:#2F7A5C}
.note[data-k="tier5"]{border-color:#4E7A58}.note[data-k="tier5"] .nk{color:#4E7A58}
.note[data-k="tier4"]{border-color:#4E7A96}.note[data-k="tier4"] .nk{color:#4E7A96}
.note[data-k="tier3"]{border-color:#8A6A45}.note[data-k="tier3"] .nk{color:#8A6A45}
.note[data-k="tier1"]{border-color:#9A7B4F}.note[data-k="tier1"] .nk{color:#9A7B4F}
.note[data-k="nosrc"]{border-color:#8E8E93}.note[data-k="nosrc"] .nk{color:#52525B}
@media(max-width:640px){
  .note{left:0!important;right:0;top:auto!important;bottom:0;width:auto;max-width:none;border-left:0;border-right:0;border-bottom:0;padding:18px 18px 26px;max-height:72vh;overflow-y:auto;box-shadow:0 -12px 34px rgba(0,0,0,.16)}
  .note .nx{display:block;top:8px;right:8px}
  .note .nb{font-size:14px}
}`;

/* the shared note-panel payload (public/js/umkm.js opens it on hover, focus
   and tap — same idiom as the census's est/trk marks) */
const note = (o) => `data-n="${esc(JSON.stringify(o))}"`;

function tierMark(c, TM, base = '') {
  const t = TM[c.tier] || {};
  const split = c.tier_src
    ? ' The compiling sweep filed this row as “' + c.tier_src + '”; it is shown here as ' +
      (t.label || c.tier).toLowerCase() + ' because the source is the company’s own storefront rather than a trade-show record.'
    : '';
  return `<button type="button" class="tb tb${c.tier_rank}" ${note({
    k: 'tier' + c.tier_rank,
    t: (t.label || c.tier) + ' — verification tier ' + c.tier_rank + ' of 6',
    b: (t.def || '') + split + (c.source_url
      ? ' The link below is the exact page this row was compiled from.'
      : ' No source page was recorded as a link for this row — what was written down is on the profile.'),
    m: c.verification,
    l: [
      c.source_url ? { h: c.source_url, t: 'Open the source — ' + srcHost(c.source_url) + ' ↗' } : null,
      { h: base + '/company/' + c.id, t: 'Full record for ' + c.name + ' →' },
      { h: (base || '/') + '#verification', t: 'What the six tiers mean →' },
    ].filter(Boolean),
  })} aria-expanded="false" aria-label="${esc((t.label || c.tier) + ' — show what this verification tier means')}">${esc(t.short || c.tier)}</button>`;
}

/* 33 rows arrived with descriptive text where the source link belongs. Rather
   than let a badge link nowhere, the row carries its own mark saying so. */
function noSrcMark(c, base = '') {
  return `<button type="button" class="nosrc" ${note({
    k: 'nosrc',
    t: 'No source link recorded',
    b: 'The research sweep wrote a description of this company where the source URL belongs, so there is no page to open. '
      + 'The text it recorded is kept on the profile, and the row stays in the census marked like this rather than '
      + 'being dressed up with a link that does not exist.',
    l: [{ h: base + '/company/' + c.id, t: 'What was recorded for ' + c.name + ' →' }],
  })} aria-expanded="false" aria-label="No source link recorded — show what that means">no link</button>`;
}

/* the umkm.vantis.sh footer's own CSS (the 1001 version uses footer1001.css) */
const FOOTCSS = `/* footer */
.ft{border-top:1px solid #E7E7E7;margin-top:64px}
.ftin{max-width:1180px;margin:0 auto;padding:46px 20px 28px}
.ftgrid{display:grid;grid-template-columns:1.35fr repeat(3,1fr);gap:36px 28px}
@media(max-width:1000px){.ftgrid{grid-template-columns:repeat(2,1fr)}.ftbrand{grid-column:1/-1}}
@media(max-width:520px){.ftgrid{grid-template-columns:1fr}}
.fbx{display:inline-flex;align-items:center;gap:10px;font-weight:600;text-decoration:none;margin-bottom:14px}
.fbx i{width:26px;height:26px;border:1.5px solid #000;display:grid;place-items:center;font:600 9px/1 'IBM Plex Mono',monospace;font-style:normal}
.ftbrand .fth{font-size:20px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;max-width:18ch}
.ftbrand p{margin-top:10px;color:#8E8E93;font-size:13px;line-height:1.55;max-width:30ch}
.ftcol h4{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:#B4B4B8;margin-bottom:13px;display:flex;align-items:center;gap:7px}
.ftcol h4::before{content:'';width:5px;height:5px;background:#000;display:inline-block;flex:none}
.ftcol ul{list-style:none}
.ftcol li{margin-bottom:8px}
.ftcol a{text-decoration:none;color:#52525B;font-size:13.5px}
.ftcol a:hover{color:#000}
.ftcol .off{color:#B4B4B8;font-size:13.5px}
.ftcol .off em{font:400 8.5px/1 'IBM Plex Mono',monospace;font-style:normal;text-transform:uppercase;letter-spacing:.06em;border:1px solid #E7E7E7;padding:2px 4px;margin-left:6px;vertical-align:1px}
.ftmark{display:block;width:100%;height:auto;margin:44px 0 6px}
.ftlegal{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;border-top:1px solid #E7E7E7;padding-top:18px;font-size:10.5px;line-height:1.6;color:#8E8E93}
.ftlegal a{color:inherit;text-decoration:none;border-bottom:1px solid #D9D9D9}
.ftlegal a:hover{color:#000;border-bottom-color:#000}
`;

function landing({ data, base = '' }) {
  const T = (data && data.totals) || {};
  const companies = (data && data.companies) || [];
  const TM = ((data && data.method) || {}).tier_meta || {};
  const bySector = (data && data.by_sector) || [];
  const byTier = (data && data.by_tier) || {};
  const cov = T.coverage || {};
  const sectors = bySector.map((s) => s.name);
  const provinces = [...new Set(companies.map((c) => c.province).filter(Boolean))].sort();
  const fixes = ((data && data.method) || {}).field_fixes || {};
  const rebucketed = ((data && data.method) || {}).rebucketed || [];

  const contactCell = (c) => {
    const parts = [c.email && 'email', c.phone && 'phone', c.url && 'site'].filter(Boolean);
    return parts.length ? parts.join(' · ') : '—';
  };
  const contactScore = (c) => (c.email ? 4 : 0) + (c.url ? 2 : 0) + (c.phone ? 1 : 0);
  const locCell = (c) => [c.city, c.province].filter(Boolean).join(' · ');

  const rows = companies.map((c) => `
    <tr data-f="${esc([c.name, c.sector, c.industry, c.city || '', c.province || '', c.certs || '']
      .filter(Boolean).join(' ').toLowerCase())}" data-s="${esc(c.sector)}" data-t="${c.tier_rank}" data-p="${esc(c.province || '')}" data-c="${(c.email || c.phone || c.url) ? '1' : ''}" data-id="${esc(c.id)}">
      <td class="rk" data-v="${c.rank}">${c.rank}</td>
      <td data-v="${esc(c.name.toLowerCase())}">${c.logo ? `<img class="lg" src="${esc(c.logo)}" alt="" loading="lazy" width="18" height="18">` : ''}<a class="cp-link" href="${base}/company/${esc(c.id)}">${esc(c.name)}</a>${tierMark(c, TM, base)}${c.source_missing ? noSrcMark(c, base) : ''}</td>
      <td class="mu" data-v="${esc(c.sector.toLowerCase())}">${esc(c.sector)}</td>
      <td class="mu" data-v="${esc(locCell(c).toLowerCase())}">${esc(locCell(c) || '—')}</td>
      <td class="pr"><div class="cl">${esc(c.products || '—')}</div></td>
      <td class="pr mk"><div class="cl">${esc(c.markets || '—')}</div></td>
      <td class="ct mono" data-v="${contactScore(c) || ''}">${contactCell(c)}</td>
    </tr>`).join('');

  const tierChip = (k) => {
    const t = TM[k];
    return `<button class="chip tchip" data-t="${t.rank}" aria-pressed="false" style="--tc:${t.color}">${esc(t.label)} · ${fmt(byTier[k] || 0)}</button>`;
  };

  const sectorTiles = bySector.map((s) => `
    <button type="button" class="sct" data-s="${esc(s.name)}">
      <span class="sn">${esc(s.name)}</span>
      <span class="sv">${fmt(s.count)}</span>
      <span class="sk">${esc(s.industry)}${s.provinces ? ` · ${s.provinces} province${s.provinces > 1 ? 's' : ''}` : ''}</span>
    </button>`).join('');

  const tierBlocks = Object.entries(TM).sort((a, b) => b[1].rank - a[1].rank).map(([k, t]) => `
    <div class="vt">
      <div class="vth"><span class="tb tb${t.rank}" aria-hidden="true">${esc(t.short)}</span>
      <span class="vtc mono">${fmt(byTier[k] || 0)} of ${fmt(T.exporters)}</span></div>
      <h3>${esc(t.label)}</h3>
      <p>${esc(t.def)}</p>
    </div>`).join('');

  const covRows = [
    ['Products', cov.products], ['Export markets', cov.markets], ['City', cov.city],
    ['Province', cov.province], ['Website', T.with_site], ['Phone', T.with_phone],
    ['Email', T.with_email], ['Certifications', cov.certs], ['Incoterms', cov.incoterms],
    ['Payment terms', cov.payment_terms], ['Minimum order', cov.moq], ['Source URL', cov.source_url],
  ].map(([k, n]) => {
    const pct = Math.round((n || 0) / (T.exporters || 1) * 100);
    return `<tr><td>${k}</td><td class="n mono">${fmt(n)} / ${fmt(T.exporters)}</td>
    <td class="cbar"><span style="width:${pct}%"></span></td><td class="n mono">${pct}%</td></tr>`;
  }).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${base ? "Indonesia's Export Supplier Census — 1001startup.id" : "1001umkm.id — Indonesia's export supplier census"}</title>
<meta name="description" content="The census of Indonesian exporting UMKM/SMEs: ${fmt(T.exporters)} suppliers across ${T.sectors} product sectors — what they make, the markets they ship to, how each entry was verified, and how to reach them. Built for overseas buyers sourcing from Indonesia.">
<meta name="robots" content="noindex, nofollow">
<meta property="og:title" content="${base ? "1001startup.id — Indonesia's export supplier census" : "1001umkm.id — Indonesia's export supplier census"}">${base ? `
<link rel="canonical" href="https://1001startup.id${base}">` : ''}
<meta property="og:description" content="${fmt(T.exporters)} verified-source Indonesian exporters — products, markets, verification tiers and direct contact channels.">
<meta name="theme-color" content="#ffffff">
${base ? `<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">` : `<link rel="icon" type="image/png" href="/assets/favicon-umkm.png">
<link rel="apple-touch-icon" href="/assets/favicon-umkm.png">`}
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<link rel="stylesheet" href="/css/company1001.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${GRAD};color:${base ? '#000' : '#fff'};font:400 11px/1${base ? '.35' : ''} 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${base ? NAV.css : HEADCSS}
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
.stats .v{font-size:clamp(26px,3vw,40px);letter-spacing:-0.02em;background:${GRAD};-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:600}
.stats .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#8E8E93;margin-top:6px}
.stats .k .q{display:block;color:#B4B4B8;margin-top:4px}
.stats .k .q a{text-decoration:none;color:inherit;border-bottom:1px solid #E7E7E7}
.stats .k .q a:hover{color:#000;border-color:#000}
.wrap{max-width:1180px;margin:0 auto;padding:54px 20px 0}
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
table{border-collapse:collapse;width:100%;min-width:1080px;font-size:13.5px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8E8E93;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
th.s{padding:0}
th.s>button{width:100%;padding:10px 12px;border:0;background:none;font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit;text-align:inherit;cursor:pointer}
th.s.n>button{text-align:right}
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
/* the clamp lives on an inner div: -webkit-box on the td itself stops it being
   a table-cell and the whole row layout collapses (markets slid under products) */
td.pr{color:#52525B;font-size:12.5px;line-height:1.45;max-width:340px}
td.pr .cl{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
td.mk{max-width:220px}
td.ct{color:#8E8E93;font-size:10.5px;white-space:nowrap;text-align:right}
th.ct{text-align:right}
td a{text-decoration:none;border-bottom:1px solid #D9D9D9}
td .lg{vertical-align:-4px;margin-right:8px}
.foot-key{list-style:none;margin:14px 0 0;padding:0;border-top:1px solid #E7E7E7}
.foot-key li{display:grid;grid-template-columns:96px 1fr;gap:0 16px;padding:8px 0;border-bottom:1px solid #F1F1F1}
.foot-key .fk{font:400 10px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#B4B4B8;padding-top:1px}
.foot-key .fv{font-size:11.5px;line-height:1.5;color:#8E8E93}
.foot-key .fv a{color:inherit;text-decoration:none;border-bottom:1px solid #C7C7CC}
.foot-key .fv a:hover{color:#000;border-bottom-color:#000}
/* tier badges: one idiom, five weights — colors picked at badge weight the way
   the census picked #4E7A58 for Antler (raw gradient stops fail contrast) */
${TBCSS}
/* the shared note panel (same mechanics as the census marks) */
${NOTECSS}
.lede{color:#52525B;font-size:14.5px;line-height:1.6;max-width:92ch;margin-bottom:16px}
.h2{font-size:clamp(26px,3.2vw,38px);line-height:1.06;letter-spacing:-0.025em;font-weight:500;margin-bottom:12px;max-width:26ch}
/* the map, embedded live — the shield keeps page-scroll honest (a wheel over
   the canvas zooms the map, not the page) until the reader opts in */
.mapembed{position:relative;border:1px solid #E7E7E7;background:#E4E7E6;height:min(72vh,600px)}
@media(max-width:640px){.mapembed{height:62vh}}
.mapframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.mapshield{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;text-decoration:none;background:linear-gradient(180deg,rgba(255,255,255,0) 62%,rgba(255,255,255,.5))}
.mapshield span{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;background:#000;color:#fff;padding:11px 15px}
.mapshield:hover span{background:#333}
.mapshield.off{display:none}
/* sector grid: hairline tiles, click = filter the table */
.sgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:1060px){.sgrid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:640px){.sgrid{grid-template-columns:repeat(2,1fr)}}
.sct{background:#fff;padding:18px 16px 16px;text-align:left;border:0;font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:4px}
.sct:hover{background:#FAFAFA}
.sct .sn{font-size:15px;font-weight:500;letter-spacing:-0.015em}
.sct .sv{font-size:clamp(22px,2.4vw,32px);letter-spacing:-0.02em;font-weight:600;background:${GRAD};-webkit-background-clip:text;background-clip:text;color:transparent}
.sct .sk{font:400 9.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#B4B4B8}
/* verification tiers */
.vgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:1060px){.vgrid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.vgrid{grid-template-columns:1fr}}
.vt{background:#fff;padding:22px 18px}
.vt .vth{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:26px}
.vt .vth .tb{flex:none;white-space:nowrap}
.vt .vtc{flex:none;text-align:right}
.vt .vth .tb{margin-left:0;cursor:default}
.vt .vtc{font-size:10px;color:#B4B4B8}
.vt h3{font-size:17px;font-weight:500;letter-spacing:-0.015em;margin-bottom:8px}
.vt p{color:#52525B;font-size:12.5px;line-height:1.55}
.method{border:1px solid #E7E7E7;padding:22px;margin-bottom:14px}
.method h3{font-size:17px;font-weight:500;letter-spacing:-0.015em;margin-bottom:8px}
.method p{color:#52525B;font-size:14px;line-height:1.6;max-width:88ch}
.method p+h3{margin-top:20px}
.covtbl{border-collapse:collapse;width:100%;max-width:640px;min-width:0;font-size:12.5px;margin-top:12px}
.covtbl td{padding:6px 10px 6px 0;border-bottom:1px solid #F1F1F1;color:#52525B}
.covtbl td.n{text-align:right;font-size:11px;color:#8E8E93;white-space:nowrap}
.covtbl .cbar{width:34%;min-width:120px}
.covtbl .cbar span{display:block;height:5px;background:${GRAD}}
/* buyers steps */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:860px){.steps{grid-template-columns:1fr}}
.step{background:#fff;padding:26px 22px}
.step .sno{font:400 11px/1 'IBM Plex Mono',monospace;color:#B4B4B8;display:block;margin-bottom:30px}
.step h3{font-size:19px;font-weight:500;letter-spacing:-0.02em;margin-bottom:10px}
.step p{color:#52525B;font-size:13.5px;line-height:1.55;max-width:44ch}
/* the private dataset cell */
.dcell{border:1px solid #E7E7E7;padding:26px 24px;display:grid;grid-template-columns:1fr auto;gap:18px;align-items:start}
@media(max-width:720px){.dcell{grid-template-columns:1fr}}
.dcell h3{font-size:19px;font-weight:500;letter-spacing:-0.02em;margin-bottom:8px}
.dcell h3 .ntag{font:400 9px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;border:1px solid #D9D9DE;color:#8E8E93;padding:3px 5px;margin-left:10px;display:inline-block;transform:translateY(-3px)}
.dcell p{color:#52525B;font-size:13.5px;line-height:1.55;max-width:72ch}
.dcell .dmeta{font:400 10px/1.7 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#B4B4B8;text-align:right;white-space:nowrap}
@media(max-width:720px){.dcell .dmeta{text-align:left}}
${base ? FOOT.css + `
/* phone fixes for the 1001 version: the coverage bars' minimum width and long
   exporter names in the drawer's comparable list pushed a 360 px screen sideways */
@media(max-width:420px){.covtbl .cbar{min-width:56px}}
.cp-sibs{grid-template-columns:minmax(0,1fr)}.cp-sib{min-width:0}.cp-sibn{min-width:0}.cp-sibr{flex:none;white-space:nowrap}
` : FOOTCSS}</style>
</head>
<body>
<div class="banner">WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY ROW LINKS TO THE SOURCE IT WAS COMPILED FROM</div>
${base ? NAV.header('', { lang: 'en', path: base, translated: false }) : header('')}
<section class="hero">
  <h1>Indonesia's export supplier census.</h1>
  <div>
    <p class="sub">${fmt(T.exporters)} exporting UMKM and SMEs across ${T.sectors} product sectors —
    what they make, the markets they already ship to, how each entry was verified, and the channels
    to reach them directly. Compiled from government export platforms and public reporting, for
    overseas buyers sourcing from Indonesia.</p>
    <div class="cta">
      <a class="btn primary" href="#exporters">Browse the exporters</a>
      ${base ? '' : '<a class="btn" href="/map">See them on the map</a>'}
      <a class="btn" href="#verification">How rows are verified</a>
    </div>
  </div>
</section>

<section class="stats" id="stats">
  ${[
    [fmt(T.exporters), 'exporters listed'],
    [String(T.sectors), 'product sectors', 'furniture to fisheries', '#sectors'],
    [String(T.provinces), 'provinces', `on record for ${fmt(cov.province)} rows`],
    [fmt(T.verified_beyond_listing), 'verified beyond a listing', 'shipment, news or Kemendag check', '#verification'],
    [fmt(T.with_contact), 'with a direct channel', `${fmt(T.with_email)} email · ${fmt(T.with_phone)} phone · ${fmt(T.with_site)} site`],
  ].map(([v, k, q, href]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}${q ? `<span class="q">${href ? `<a href="${href}">${q} →</a>` : q}</span>` : ''}</div></div>`).join('')}
</section>

<section class="wrap" id="exporters">
  <div class="eyebrow"><span class="sq"></span>THE EXPORTERS</div>
  <div class="toolbar">
    <input id="q" type="search" placeholder="Search ${fmt(T.exporters)} exporters — product, company, city, market…" autocomplete="off">
    <div class="chips" id="chips">
      <button class="chip on" data-s="">All</button>
      ${sectors.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="chiprow">
      ${Object.entries(TM).sort((a, b) => b[1].rank - a[1].rank).map(([k]) => tierChip(k)).join('')}
    </div>
    <div class="chiprow">
      <select id="prov" aria-label="Filter by province">
        <option value="">All provinces</option>
        ${provinces.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}
      </select>
      <button class="chip cchip" id="contactOnly" aria-pressed="false">Direct contact only · ${fmt(T.with_contact)}</button>
      <div class="count mono" id="count">${companies.length} shown</div>
    </div>
    <div class="rowhint mono">Click any exporter for its full profile — products, markets, trade terms, contact channels and the source behind the row. Hover a verification badge for what it means.</div>
  </div>
  <div class="tablewrap"><table id="tbl"${base ? ` data-base="${base}/company/"` : ''}>
    <thead><tr>${[
      ['#', 'num', 'rk', 1], ['Exporter', 'txt', '', 1], ['Sector', 'txt', 'mu', 1], ['Location', 'txt', 'mu', 1],
      ['Products', '', '', 0], ['Export markets', '', '', 0], ['Contact', 'num', 'ct', 1],
    ].map(([label, kind, cls, sortable], i) => sortable
      ? `<th class="s${cls ? ' ' + cls : ''}" data-i="${i}" data-t="${kind}"${i === 0 ? ' aria-sort="ascending"' : ''}><button type="button">${label}<span class="ca" aria-hidden="true"></span></button></th>`
      : `<th${cls ? ` class="${cls}"` : ''}>${label}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <nav class="pager mono" id="pager" aria-label="Exporter table pages" hidden></nav>
  <ul class="foot-key">
    <li><span class="fk">Ranking</span><span class="fv">By verification tier first (strongest evidence at the top), then by how reachable the company is (email, then website, then phone), then by name. Click # to return to it.</span></li>
    <li><span class="fk">Verified</span><span class="fv">The badge on every row is one of <a href="#verification">six evidence tiers</a> — hover or tap it for what was checked and the exact source page the row was compiled from. A tier says what evidence we read; it is not a due-diligence report.</span></li>
    <li><span class="fk">No figure</span><span class="fv">"—" means the company has not published that field — we show blanks as blanks and never invent MOQs, terms or contacts.</span></li>
    <li><span class="fk">Contact</span><span class="fv">Channels are as published by the company or its listing, not re-verified by us: ${fmt(T.with_email)} rows carry an email, ${fmt(T.with_phone)} a phone, ${fmt(T.with_site)} a website. Standard trade practice applies — verify the counterparty before contracting or paying.</span></li>
    <li><span class="fk">Source</span><span class="fv">${fmt(cov.source_url)} of ${fmt(T.exporters)} rows carry the URL they were compiled from, shown on the profile and behind every verification badge.${T.source_missing ? ` On ${fmt(T.source_missing)} rows the sweep recorded a description instead of a link; those carry a <span class="nosrc">no link</span> mark rather than a badge that goes nowhere.` : ''}</span></li>
  </ul>
</section>

${base ? '' : `<section class="wrap" id="map">
  <div class="eyebrow"><span class="sq"></span>THE MAP</div>
  <h2 class="h2">Every exporter, across the whole archipelago.</h2>
  <p class="lede">${fmt(T.mapped)} of ${fmt(T.exporters)} exporters plotted at their recorded city, on one
  isometric map of Indonesia — and drawn as what they ship: a city of furniture makers reads as chairs
  and rattan, a fishing port as crates on ice. Pins are city-level, because that is the resolution the
  census honestly holds.</p>
  <div class="cta" style="display:flex;gap:10px;margin:0 0 22px;flex-wrap:wrap">
    <a class="btn primary" href="/map">Open the full map</a>
    <a class="btn" href="/map?s=${encodeURIComponent('Furniture')}">Furniture</a>
    <a class="btn" href="/map?s=${encodeURIComponent('Coffee & Tea')}">Coffee &amp; Tea</a>
    <a class="btn" href="/map?s=${encodeURIComponent('Fisheries & Seaweed')}">Fisheries</a>
  </div>
  <div class="mapembed">
    <iframe class="mapframe" src="/map?embed=1" title="The export map" loading="lazy"></iframe>
    <a class="mapshield" id="mapshield" href="/map"><span>Click to explore the live map</span></a>
  </div>
</section>`}

<section class="wrap" id="sectors">
  <div class="eyebrow"><span class="sq"></span>THE SECTORS</div>
  <h2 class="h2">What Indonesia's exporting SMEs actually ship.</h2>
  <p class="lede">${T.sectors} product sectors under ${T.industries} industries — tap a sector to filter the table above.
  Classification is editorial: the source sweep's catch-all bucket was re-read, and ${rebucketed.length} artisan rows
  (instrument and toy workshops) were re-filed under Handicraft, with the original kept on each record.</p>
  <div class="sgrid">${sectorTiles}</div>
</section>

<section class="wrap" id="verification">
  <div class="eyebrow"><span class="sq"></span>VERIFICATION</div>
  <h2 class="h2">Six tiers, from a storefront to a shipment.</h2>
  <p class="lede">Every exporter carries one badge saying exactly what evidence stands behind it — a documented
  shipment at the strongest end, the company’s own online storefront at the entry end. The tier is a reading of public
  evidence, not an endorsement: verify counterparties, use bank-checked instruments, inspect before full payment.</p>
  <div class="vgrid">${tierBlocks}</div>
</section>

<section class="wrap" id="method">
  <div class="eyebrow"><span class="sq"></span>METHOD</div>
  <div class="method">
    <h3>Where the rows come from</h3>
    <p>A parallel research sweep (Aug 2026) over InaExport — Kemendag's verified-exporter platform, 11,650+
    suppliers listed — the Trade Expo Indonesia and IFEX exhibitor directories, government export releases
    (Bea Cukai, Kemenperin, LPEI), company sites and documented news. Real companies only; every row carries
    the URL it was compiled from.</p>
    <h3>What each field holds, and how often</h3>
    <p>Coverage is uneven because publication is uneven — a blank means the company has not published that
    field anywhere we read, and it stays blank. Nothing is imputed.</p>
    <table class="covtbl">${covRows}</table>
    <h3>Corrections applied at import</h3>
    <p>${fixes.email_was_phone || 0} rows carried a phone number in the email column (moved, email withdrawn);
    ${fixes.website_scheme_added || 0} website addresses lacked a scheme (https:// added); ${fixes.rebucketed || 0} rows
    were re-bucketed out of the source's catch-all sector. Every mechanical fix is recorded on the row it touched.</p>
    <h3>What has not been done yet</h3>
    <p>Contact channels are as published — emails are not delivery-tested and phone numbers are not called.
    A liveness sweep over the ${fmt(T.with_site)} recorded websites is planned but has not run; until it has,
    a listed site is a claim, not a check. Corrections are welcome and versioned.</p>
  </div>
</section>

<section class="wrap" id="buyers">
  <div class="eyebrow"><span class="sq"></span>FOR OVERSEAS BUYERS</div>
  <div class="steps">
    <div class="step"><span class="sno">01</span><h3>Filter to your product.</h3>
      <p>Sector, province, verification tier, direct-contact-only — the filters compose, and search runs over names, products and markets.</p></div>
    <div class="step"><span class="sno">02</span><h3>Read the evidence.</h3>
      <p>Every row shows its tier and links its source. Blanks are blanks: an unpublished MOQ stays a dash instead of becoming a guess.</p></div>
    <div class="step"><span class="sno">03</span><h3>Contact the exporter directly.</h3>
      <p>Email, phone and website sit on the profile. No middleman, no fee, no markup — the census is the introduction.</p></div>
  </div>
</section>

<section class="wrap" id="dataset">
  <div class="eyebrow"><span class="sq"></span>THE DATASET</div>
  <div class="dcell">
    <div>
      <h3>The working file is not a public download.<span class="ntag">private</span></h3>
      <p>The site shows every exporter with its source, free. The one-file working layer behind it —
      all ${fmt(T.exporters)} rows with the verification trail, correction log and field provenance in one
      machine-readable file — is the commercial product. Licensing terms are being set; they are not open yet.</p>
    </div>
    <div class="dmeta">${fmt(T.exporters)} rows · ${T.sectors} sectors<br>${fmt(cov.source_url)} source URLs<br>6 evidence tiers</div>
  </div>
</section>

<div class="note" id="note" role="tooltip" hidden>
  <button type="button" class="nx" aria-label="Close">×</button>
  <div class="nk"></div>
  <div class="nb"></div>
  <div class="nm" hidden></div>
  <div class="nl" hidden></div>
</div>

${base ? FOOT.footer({ lang: 'en',
    tagline: 'Indonesia’s company data, from public sources.',
    legalLeft: 'the census of Indonesian exporting SMEs',
    legalRight: `<a href="/stats">Live traffic</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>Cookies</a> · Sources: InaExport (Kemendag) · TEI / IFEX · public reporting · updated ${esc(((data && data.generated) || '').slice(0, 10))}` }) : `<footer class="ft">
  <div class="ftin">
    <div class="ftgrid">
      <div class="ftbrand">
        <a class="fbx" href="/"><i>1001</i>1001umkm.id</a>
        <div class="fth">The census of Indonesian exporting SMEs.</div>
        <p>Public sources only; every row links to the page it was compiled from.</p>
      </div>
      <div class="ftcol"><h4>Census</h4><ul>
        <li><a href="#exporters">Exporters</a></li>
        <li><a href="/map">The export map</a></li>
        <li><a href="#sectors">Sectors</a></li>
        <li><a href="#verification">Verification tiers</a></li>
        <li><span class="off">The dataset<em>private</em></span></li>
      </ul></div>
      <div class="ftcol"><h4>Method</h4><ul>
        <li><a href="#method">Where the rows come from</a></li>
        <li><a href="#method">Field coverage</a></li>
        <li><a href="#method">Corrections at import</a></li>
        <li><a href="#buyers">For overseas buyers</a></li>
      </ul></div>
      <div class="ftcol"><h4>Family</h4><ul>
        <li><a href="https://1001startup.id" rel="noopener">1001startup.id</a></li>
        <li><span class="off">Indonesia's startup census — same rules, different companies</span></li>
      </ul></div>
    </div>
    <svg class="ftmark" viewBox="0 0 1200 168" aria-hidden="true" focusable="false">
      <defs><linearGradient id="ftg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#E8734B"/><stop offset=".34" stop-color="#F3C64B"/>
        <stop offset=".68" stop-color="#7AB88A"/><stop offset="1" stop-color="#4E7A96"/>
      </linearGradient></defs>
      <text x="600" y="126" text-anchor="middle" textLength="1156" lengthAdjust="spacingAndGlyphs" font-family="'Overused Grotesk',system-ui,sans-serif" font-size="148" font-weight="500" letter-spacing="-3" fill="none" stroke="url(#ftg)" stroke-width="1.5">1001umkm.id</text>
    </svg>
    <div class="ftlegal mono">
      <span>© 2026 1001umkm.id · the census of Indonesian exporting SMEs</span>
      <span><a href="https://vantis.sh/cookies/" data-vs-reopen>Cookies</a> · Sources: InaExport (Kemendag) · TEI / IFEX · public reporting · updated ${esc(((data && data.generated) || '').slice(0, 10))}</span>
    </div>
  </div>
</footer>`}
${base ? `<script src="/js/nav1001.js?v=${V}" defer></script>
` : ''}<script src="/js/umkm.js?v=${V}" defer></script>
<script src="/js/company1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { landing, header, HEADCSS, GRAD, TBCSS, NOTECSS, tierMark };
