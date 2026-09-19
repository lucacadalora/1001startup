'use strict';
/* 1001startup.id — the census on the map. The census map layer used to live
 * only on PASAR's /jakarta?census=1; it is the census product's view of its
 * own data, so it lives here now, in 1001's own shell. Same canvas engine
 * (public/js/jakarta.js) — the script is host-aware: on a 1001 hostname it
 * loads the census layer unconditionally, counts census companies in the
 * legend, and its cards link to /company/<id> instead of PASAR pages. On 1001
 * it also loads EVERY metro's boundaries plus the national land layer and
 * draws them as one map; ?city= is a camera preset, not a different page.
 *
 * The map overlay styles below are a port of PASAR's map chrome to 1001's
 * inline-style idiom. The two sites share the same editorial system (white,
 * hairlines, Overused Grotesk + Plex Mono, square corners), so the values
 * match site.css deliberately — only PASAR's brand assets stay out.
 *
 * LANGUAGE: the SHELL translates (title, banner, hint, chips); the legend and
 * company cards are drawn client-side by jakarta.js, which PASAR shares, and
 * stay English for now — the data inside them is English census data anyway.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001'); // one header for every 1001 page
const I18N = require('./i18n1001');

/* ONE MAP OF INDONESIA (Aug 30 2026). This page was a city switcher for half a
   day. Luca: "i think we need to make map of indonesia, but for now the map is
   only visible and zoomed to jakarta and bandung, so we can see jakarta and
   bandung in one map." So there is one canvas with the country under it, and
   the metros are camera presets — the chips below carry `data-metro`, and
   public/js/jakarta.js intercepts the click and flies instead of navigating.
   They stay real links so they work with JS off and can be pasted. */
const METROS = [
  { id: 'jakarta', name: 'Greater Jakarta', id_name: 'Jakarta Raya' },
  { id: 'bandung', name: 'Bandung', id_name: 'Bandung' },
  { id: 'bali', name: 'Bali', id_name: 'Bali' },
];
/* office districts that render as a real mini-city when you zoom in. All
   Jabodetabek: every zone extract was cut from a Jakarta bbox. */
const AREAS = [['scbd', 'SCBD'], ['southquarter', 'South Quarter'], ['gambir', 'Monas'], ['gbk', 'GBK']];

/* embed: the landing page frames this same route as ?embed=1 — the map with no
   banner, header or legend (elements jakarta.js touches stay in the DOM, hidden
   by CSS), and <base target="_top"> so a company-card link breaks out of the
   frame instead of browsing the site inside it. server.js relaxes
   frame-ancestors to 'self' for exactly this response and skips the px count. */
function map({ data, city, lang = 'en', embed = false }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const T = (data && data.totals) || {};
  const metros = (data && data.by_metro) || [];
  const n = T.companies || '';
  const here = METROS.find((m) => m.id === city) || null;
  const path = '/map' + (city ? `?city=${city}` : '');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${embed ? '<base target="_top">' : ''}
<title>${L('The map', 'Peta Startup Indonesia')} — 1001startup.id</title>
<meta name="description" content="${esc(L(
    'Every company in the census standing at its real address, on a map of Indonesia. ' + (n ? n + ' companies, ' : '') + 'Greater Jakarta, Bandung and Bali in one view.',
    'Setiap perusahaan sensus berdiri di alamat aslinya, di atas peta Indonesia. ' + (n ? n + ' perusahaan, ' : '') + 'Jakarta Raya, Bandung, dan Bali dalam satu tampilan.'))}">
<meta name="robots" content="${embed ? 'noindex, nofollow' : 'index, follow'}">
${I18N.headTags(lang, '/map')}
${I18N.ogImage()}
<meta property="og:title" content="${L('The census, on the map', 'Sensus, di atas peta')} — 1001startup.id">
<meta property="og:description" content="${esc(L(
    String(n) + ' companies at their real addresses, on a map of Indonesia.',
    String(n) + ' perusahaan di alamat aslinya, di atas peta Indonesia.'))}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#000;--gray:#52525B;--mute:#6B6B73;--hairline:#E7E7E7;--panel:#FAFAFA;--link:#0000EE;
  --sans:'Overused Grotesk',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
html{-webkit-text-size-adjust:100%}
body{background:#fff;color:var(--ink);font:500 16px/1.5 var(--sans);letter-spacing:-0.01em;
  min-height:100vh;display:flex;flex-direction:column}
a{color:inherit}
h3{font-weight:500;letter-spacing:-.03em;line-height:1.08}
.banner{background:linear-gradient(90deg,#E8734B 0%,#F3C64B 34%,#7AB88A 68%,#4E7A96 100%);color:#000;font:400 11px/1 var(--mono);text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
main{flex:1;display:flex;flex-direction:column}
.world-wrap{position:relative;flex:1;min-height:calc(100vh - 132px)}
#jkt-canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab}
#jkt-canvas.drag{cursor:grabbing}
/* the page's h1, for crawlers and screen readers — the canvas is the visual */
.srh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.drive-title{position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:10;
  font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink);
  background:rgba(255,255,255,.94);border:1px solid var(--hairline);padding:8px 16px;
  display:flex;align-items:center;white-space:nowrap}
.drive-title .sq{width:5px;height:5px;background:var(--ink);display:inline-block;margin:0 12px}
/* LEFT RAIL. The chips and the legend used to be two independent absolutely
   positioned boxes, which was fine while the chip row was one line — adding
   the city switch made it two on Jakarta, and the second row landed underneath
   the legend. Stacking them in one flex column means the legend follows the
   chips however they wrap, at any width. The rail itself is click-through so
   the empty space beside the chips still drags the map. */
.rail{position:absolute;left:16px;top:16px;z-index:10;display:flex;flex-direction:column;
  align-items:flex-start;gap:12px;pointer-events:none}
.rail > *{pointer-events:auto}
/* Two groups of chips share this row — the CITY switch and, on Jakarta, its
   detail districts. Five chips on one line ran into the centred .drive-title
   at 1440px, so the row is capped and wraps by group: cities first, districts
   under them. Below 760px the title steps aside entirely — the chips already
   say which city is on screen. */
.view-toggle{display:flex;gap:8px;flex-wrap:wrap;max-width:min(42vw,430px)}
.view-toggle .grp{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:760px){
  .drive-title{display:none}
  .view-toggle{max-width:calc(100vw - 32px)}
}
.chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;
  letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--hairline);
  padding:7px 13px;color:var(--gray);text-decoration:none;background:rgba(255,255,255,.94);cursor:pointer}
.chip:hover{border-color:var(--ink);color:var(--ink)}
.chip.on{border-color:var(--ink);background:var(--ink);color:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 18px;
  font:400 12px/1 var(--mono);text-transform:uppercase;letter-spacing:.06em;text-decoration:none;
  border:1px solid var(--hairline);cursor:pointer;background:#fff;color:var(--ink)}
.btn:hover{border-color:var(--ink)}
.btn.primary{background:var(--ink);border-color:var(--ink);color:#fff}
.jkt-legend{width:238px;background:rgba(255,255,255,.96);
  border:1px solid var(--hairline);padding:16px}
.jkt-legend h4{font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  display:flex;justify-content:space-between;gap:10px;margin-bottom:8px}
.jkt-legend h4 span{color:var(--gray)}
.jkt-legend .kr{display:flex;align-items:center;gap:9px;font-size:13px;font-weight:500;padding:4px 0}
.jkt-legend .kr i{width:11px;height:11px;border:1px solid rgba(0,0,0,.22);flex:none}
.jkt-legend .kr b{margin-left:auto;font-family:var(--mono);font-size:11px;font-weight:500;color:var(--gray)}
/* metro heading inside the legend — seventeen kota on one flat list read as a
   wall, so they group, and each heading is the button that flies there */
.jkt-legend .mg{display:flex;width:100%;align-items:center;gap:9px;background:none;border:0;
  padding:2px 0 6px;cursor:pointer;color:var(--ink);text-align:left;
  font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase}
.jkt-legend .mg b{margin-left:auto;font-weight:500;color:var(--gray)}
.jkt-legend .mg:hover{color:var(--link)}
.jkt-legend .mg:hover b{color:var(--link)}
.jkt-legend .mg.on{box-shadow:inset 3px 0 0 var(--ink);padding-left:8px}
.jkt-legend .div{border-top:1px solid var(--hairline);margin:12px 0}
/* Twenty-one kota across three metros outgrew the viewport and pushed the CTA off
   the bottom of the screen. The list scrolls; the heading, the total and the
   button stay put. */
.jkt-legend .kl{position:relative;max-height:min(44vh,420px);overflow-y:auto;overscroll-behavior:contain}
.jkt-legend .kl::-webkit-scrollbar{width:4px}
.jkt-legend .kl::-webkit-scrollbar-thumb{background:var(--hairline)}
.jkt-legend .act{font-size:12.5px;color:var(--gray);font-weight:500;line-height:1.5}
.jkt-legend .act b{color:var(--ink);font-weight:650}
.jkt-legend .act a{color:var(--link)}
.jkt-legend .btn{width:100%;margin-top:14px;text-align:center;font-size:12px}
.jkt-legend .src{font-family:var(--mono);font-size:9px;letter-spacing:.03em;text-transform:uppercase;
  color:var(--mute);margin-top:12px;line-height:1.6}
@media (max-width:760px){.jkt-legend{display:none}}
.jkt-ctl{position:absolute;right:16px;bottom:52px;z-index:10;display:flex;flex-direction:column;
  background:rgba(255,255,255,.96);border:1px solid var(--hairline)}
.jkt-ctl button{width:42px;height:42px;border:0;background:none;font-size:17px;cursor:pointer;color:var(--ink)}
.jkt-ctl button + button{border-top:1px solid var(--hairline)}
.jkt-ctl button:hover{background:var(--panel)}
.world-hint{position:absolute;left:16px;bottom:16px;font-family:var(--mono);font-size:11px;
  letter-spacing:.03em;text-transform:uppercase;color:var(--gray);
  background:rgba(255,255,255,.94);border:1px solid var(--hairline);padding:7px 12px;z-index:10}
.world-tip{position:absolute;pointer-events:none;background:var(--ink);color:#fff;font-size:12.5px;
  font-weight:500;padding:6px 12px;transform:translate(-50%,-135%);white-space:nowrap;display:none;z-index:20}
.world-tip .d{color:#A3A3A3;margin-left:6px}
.world-panel{position:absolute;right:16px;top:72px;width:300px;max-width:calc(100vw - 32px);background:#fff;
  border:1px solid var(--ink);padding:22px;display:none;z-index:15;max-height:calc(100% - 100px);overflow-y:auto}
.world-panel .x{position:absolute;top:10px;right:12px;border:0;background:none;font-size:15px;cursor:pointer;color:var(--mute)}
.world-panel h3{font-size:21px;margin-bottom:2px;padding-right:20px}
.world-panel .cat{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--gray)}
.world-panel p{font-size:13.5px;color:var(--gray);font-weight:500;margin:10px 0 16px}
.world-panel .row{display:flex;gap:8px;flex-wrap:wrap}
.map-panel{width:340px}
.map-panel img.bld{width:100%;display:block;border:1px solid var(--hairline);margin:2px 0 14px;background:#fff}
.map-panel .occ{border:1px solid var(--hairline);padding:14px;margin-top:12px}
.map-panel .occ b{display:block;font-size:16.5px;font-weight:500;letter-spacing:-.01em}
.map-panel .occ span{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.04em;
  text-transform:uppercase;color:var(--gray);margin-top:5px}
.map-panel .occ .tag{text-transform:none;letter-spacing:0;font-family:var(--sans);font-size:13.5px;
  color:var(--gray);font-weight:500}
.map-panel .occ a{display:inline-block;font-family:var(--mono);font-size:11.5px;color:var(--link);margin-top:8px}
.map-panel p{font-size:13.5px;color:var(--gray);font-weight:500;margin-top:10px}
.map-panel .row{margin-top:16px}
/* embed: no chrome, canvas fills the frame; the legend and title stay in the
   DOM (jakarta.js reads them unguarded) and are hidden here instead */
body.embed .world-wrap{min-height:100vh}
body.embed .drive-title,body.embed .jkt-legend{display:none}
</style>
</head>
<body${embed ? ' class="embed"' : ''}>
${embed ? '' : `<div class="banner">${L('WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY DERIVED FIGURE IS A LABELED ESTIMATE', 'DOKUMEN KERJA · SUMBER PUBLIK SAJA · ANGKA TURUNAN SELALU BERLABEL ESTIMASI')}</div>
${NAV.header('map', { lang, path })}`}
<main>
<div class="world-wrap" id="jkt-wrap">
  <canvas id="jkt-canvas" aria-label="${L('Isometric map of Indonesia with every census company at its real address, opening on Greater Jakarta, Bandung and Bali', 'Peta isometrik Indonesia dengan setiap perusahaan sensus di alamat aslinya, dibuka pada Jakarta Raya, Bandung, dan Bali')}"></canvas>
  ${embed ? '' : `<h1 class="srh">${L('The map of Indonesian startups — the census at real addresses', 'Peta startup Indonesia — sensus di alamat asli')}</h1>`}
  <div class="drive-title"><span class="sq"></span>${L('THE CENSUS — INDONESIA', 'SENSUS — INDONESIA')}<span class="sq"></span></div>
  <div class="rail">
  <div class="view-toggle">
    <span class="grp">
      ${METROS.map((X) => {
        const m = metros.find((y) => y.id === X.id) || {};
        return `<a class="chip${here && here.id === X.id ? ' on' : ''}" data-metro="${X.id}"
          href="${PF}/map?city=${X.id}">${esc(L(X.name, X.id_name))}${m.count ? ` · ${m.count}` : ''}</a>`;
      }).join('')}
    </span>
    <span class="grp">${AREAS.map(([id, label]) =>
      `<a class="chip" href="${PF}/map?area=${id}">${esc(label)}</a>`).join('')}</span>
  </div>
  <div class="jkt-legend" id="jkt-legend"></div>
  </div>
  <div class="jkt-ctl">
    <button id="jz-in" aria-label="${L('Zoom in', 'Perbesar')}">+</button>
    <button id="jz-out" aria-label="${L('Zoom out', 'Perkecil')}">−</button>
    <button id="jz-home" aria-label="${L('Whole city', 'Seluruh kota')}" title="${L('Whole city', 'Seluruh kota')}">◎</button>
  </div>
  <div class="world-tip" id="jkt-tip"></div>
  <div class="world-hint">${L('Drag to pan · scroll to zoom · click a company', 'Seret untuk menggeser · gulir untuk zoom · klik perusahaan')}</div>
  <div class="world-panel map-panel" id="map-panel"></div>
</div>
</main>
${embed ? `<script src="/js/jakarta.js?v=${V}" defer></script>` : `<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/jakarta.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>`}
</body>
</html>`;
}

module.exports = { map };
