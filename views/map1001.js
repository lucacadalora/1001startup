'use strict';
/* 1001startup.id — the census on the map. Two views live here.
 *
 * map(): THE LOGO MAP, /map since Oct 2026. Luca sent a robotics map of the
 * Bay Area — a pale, quiet street map, every company a round logo badge with
 * its name beside it — and asked for Indonesia's map to look like that. So
 * /map is a real slippy map now: a vector basemap of the whole country served
 * from this box (lib/map1001-routes.js, scripts/fetch-basemap.sh), drawn by
 * MapLibre GL in the palette of that reference, with one badge per located
 * company (public/js/logomap1001.js). It covers every city in the census, not
 * only the three metros the old map had boundaries for.
 *
 * iso(): the isometric canvas that was /map from Aug to Oct 2026, now at
 * /map/3d — the hand-built districts (SCBD, South Quarter, Monas, GBK), the
 * toy towers and the Whoosh line. Same engine as PASAR's /jakarta
 * (public/js/jakarta.js), which is host-aware: on a 1001 hostname it loads the
 * census layer, counts census companies in the legend and links its cards to
 * /company/<id>. Its overlay styles are a port of PASAR's map chrome to 1001's
 * inline-style idiom; only PASAR's brand assets stay out.
 *
 * LANGUAGE: both SHELLS translate. Company names are names; the iso legend and
 * cards are drawn by jakarta.js, which PASAR shares, and stay English.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001'); // one header for every 1001 page
const I18N = require('./i18n1001');

/* ── map(): the logo map, /map ─────────────────────────────────────── */
const GL = '/js/vendor/maplibre-gl-6.11.2';
/* a city gets its own chip once this many of its companies are on the map;
   the rest are reached from the Indonesia view */
const CHIP_MIN = 5;

/* tiles: { url, maxzoom } from lib/map1001-routes.js, or null on a checkout
   without the basemap archive (the script then draws the country outline).
   embed: the landing frames this route as ?embed=1 — no banner or header,
   <base target="_top">; server.js relaxes frame-ancestors for that response. */
function map({ data, city = '', company = '', lang = 'en', embed = false, tiles = null }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const T = (data && data.totals) || {};
  const metros = ((data && data.by_metro) || []).filter((m) => m.located > 0);
  const located = metros.reduce((n, m) => n + m.located, 0);
  const n = T.companies || '';
  const chips = metros.filter((m) => m.located >= CHIP_MIN).sort((a, b) => b.located - a.located);
  /* the opening view is Greater Jakarta, where most of the census sits */
  const here = company ? '' : (city || 'jakarta');
  const path = '/map' + (city ? `?city=${city}` : '');
  const cfg = {
    tiles: tiles ? tiles.url : null, maxzoom: tiles ? tiles.maxzoom : 0,
    lang, pfx: PF, embed, city, company,
    t: {
      here: L('companies here', 'perusahaan di sini'),
      close: L('Close', 'Tutup'),
      err: L('Could not load this profile.', 'Profil ini gagal dimuat.'),
      page: L('Open it as a page instead', 'Buka sebagai halaman'),
    },
  };
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${embed ? '<base target="_top">' : ''}
<title>${L('The map', 'Peta Startup Indonesia')} — 1001startup.id</title>
<meta name="description" content="${esc(L(
    'Indonesia\'s startups on the map: ' + (located ? located + ' companies' : 'every company') + ' in the census as a logo at its own address, from Medan to Bali.',
    'Startup Indonesia di atas peta: ' + (located ? located + ' perusahaan' : 'setiap perusahaan') + ' sensus tampil sebagai logo di alamatnya sendiri, dari Medan sampai Bali.'))}">
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
<link rel="modulepreload" href="${GL}/maplibre-gl.mjs">
<link rel="modulepreload" href="${GL}/maplibre-gl-shared.mjs">
<link rel="stylesheet" href="${GL}/maplibre-gl.css">
<link rel="stylesheet" href="/css/px.css?v=${V}">
<link rel="stylesheet" href="/css/company1001.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
[hidden]{display:none!important}
:root{--ink:#000;--gray:#52525B;--mute:#6B6B73;--hairline:#E7E7E7;--panel:#FAFAFA;--link:#0000EE;--sea:#E1EAEC;
  --sans:'Overused Grotesk',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
html{-webkit-text-size-adjust:100%}
body{background:#fff;color:var(--ink);font:500 16px/1.5 var(--sans);letter-spacing:-0.01em;
  min-height:100vh;min-height:100dvh;display:flex;flex-direction:column}
a{color:inherit}
.banner{background:linear-gradient(90deg,#E8734B 0%,#F3C64B 34%,#7AB88A 68%,#4E7A96 100%);color:#000;font:400 11px/1 var(--mono);text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
main{flex:1;display:flex;flex-direction:column}
/* The map takes what the header leaves of the screen (body and main are flex
   columns), so the zoom buttons and the credit line are on the first screen on
   a phone too. The sea colour sits under the canvas: the first paint is the map's. */
.lm-wrap{position:relative;flex:1;min-height:420px;background:var(--sea);overflow:hidden}
#lm-map{position:absolute;inset:0}
#lm-map .maplibregl-canvas{outline:none}
/* the page's h1, for crawlers and screen readers — the map is the visual */
.srh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* city chips: one row; on a phone it scrolls sideways instead of stacking
   over the map. The row is click-through between chips so the map still drags. */
.lm-rail{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;gap:8px;padding:16px;
  overflow-x:auto;scrollbar-width:none;pointer-events:none}
.lm-rail::-webkit-scrollbar{display:none}
.lm-rail > *{pointer-events:auto;flex:none}
.chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);font-size:11px;
  letter-spacing:.04em;text-transform:uppercase;border:1px solid var(--hairline);
  padding:7px 13px;color:var(--gray);text-decoration:none;background:rgba(255,255,255,.96);cursor:pointer;white-space:nowrap}
.chip:hover{border-color:var(--ink);color:var(--ink)}
.chip.on{border-color:var(--ink);background:var(--ink);color:#fff}
.chip.alt{margin-left:auto}
.jkt-ctl{position:absolute;right:16px;bottom:52px;z-index:5;display:flex;flex-direction:column;
  background:rgba(255,255,255,.96);border:1px solid var(--hairline)}
.jkt-ctl button{width:42px;height:42px;border:0;background:none;font-size:17px;cursor:pointer;color:var(--ink)}
.jkt-ctl button + button{border-top:1px solid var(--hairline)}
.jkt-ctl button:hover{background:var(--panel)}
.lm-foot{position:absolute;left:16px;bottom:16px;z-index:5;max-width:calc(100% - 32px);font-family:var(--mono);font-size:10.5px;
  letter-spacing:.03em;text-transform:uppercase;color:var(--gray);
  background:rgba(255,255,255,.94);border:1px solid var(--hairline);padding:7px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lm-foot b{font-weight:400;color:var(--ink)}
.lm-foot a{color:inherit;text-decoration:none}
.lm-foot a:hover{color:var(--ink);text-decoration:underline}
.lm-foot .sep{margin:0 8px;color:#C4C4C8}
.lm-tip{position:absolute;pointer-events:none;background:var(--ink);color:#fff;font-size:12.5px;
  font-weight:500;padding:5px 11px;transform:translate(-50%,-150%);white-space:nowrap;z-index:6}
/* several companies under one click: pick one */
.lm-pick{position:absolute;z-index:7;width:248px;max-width:calc(100% - 24px);background:#fff;border:1px solid var(--ink);
  box-shadow:0 14px 34px rgba(0,0,0,.12)}
.lm-pick h4{font:400 10.5px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--gray);
  padding:11px 12px;border-bottom:1px solid var(--hairline)}
.lm-pick ul{list-style:none;max-height:min(46vh,318px);overflow-y:auto;overscroll-behavior:contain}
.lm-pick button{display:flex;align-items:center;gap:10px;width:100%;padding:7px 12px;border:0;background:none;
  font:500 14px/1.25 var(--sans);letter-spacing:-.01em;color:var(--ink);text-align:left;cursor:pointer}
.lm-pick button:hover,.lm-pick button:focus-visible{background:var(--panel)}
.lm-pick img,.lm-pick .mono{width:26px;height:26px;border-radius:50%;flex:none;border:1px solid var(--hairline);background:#fff;object-fit:cover}
.lm-msg{position:absolute;inset:0;z-index:4;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}
.lm-msg p{max-width:38ch;background:#fff;border:1px solid var(--hairline);padding:18px 20px;font-size:14.5px;color:var(--gray)}
.lm-msg a{color:var(--link)}
/* the card already sits on the map */
.cpscroll .cp-act a[href*="/map?company="]{display:none}
body.cplock{overflow:hidden}
body.embed .lm-wrap{min-height:100vh;min-height:100dvh}
body.embed .chip.alt{display:none}
@media (max-width:760px){
  .lm-rail{padding:12px}
  .lm-foot{left:12px;bottom:12px;max-width:calc(100% - 78px)}
  .lm-foot .more{display:none}
  .jkt-ctl{right:12px;bottom:12px}
}
</style>
</head>
<body${embed ? ' class="embed"' : ''}>
${embed ? '' : `<div class="banner">${L('WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY DERIVED FIGURE IS A LABELED ESTIMATE', 'DOKUMEN KERJA · SUMBER PUBLIK SAJA · ANGKA TURUNAN SELALU BERLABEL ESTIMASI')}</div>
${NAV.header('map', { lang, path })}`}
<main>
<div class="lm-wrap" id="lm-wrap">
  <div id="lm-map" data-cfg="${esc(JSON.stringify(cfg))}" role="application" aria-label="${L('Map of Indonesia with every census company shown as its logo at its own address, opening on Greater Jakarta', 'Peta Indonesia dengan setiap perusahaan sensus tampil sebagai logo di alamatnya sendiri, dibuka pada Jakarta Raya')}"></div>
  ${embed ? '' : `<h1 class="srh">${L('The map of Indonesian startups — every company at its own address', 'Peta startup Indonesia — setiap perusahaan di alamatnya sendiri')}</h1>`}
  <nav class="lm-rail" aria-label="${L('Cities', 'Kota')}">
    <a class="chip${here === 'indonesia' ? ' on' : ''}" data-metro="indonesia" href="${PF}/map?city=indonesia">Indonesia${located ? ` · ${located}` : ''}</a>
    ${chips.map((m) => `<a class="chip${here === m.id ? ' on' : ''}" data-metro="${esc(m.id)}" href="${PF}/map?city=${esc(m.id)}">${esc(L(m.name, m.name_id || m.name))} · ${m.located}</a>`).join('\n    ')}
    <a class="chip alt" href="${PF}${ISO}">${L('3D city view', 'Tampilan kota 3D')} →</a>
  </nav>
  <div class="jkt-ctl">
    <button id="lm-in" aria-label="${L('Zoom in', 'Perbesar')}">+</button>
    <button id="lm-out" aria-label="${L('Zoom out', 'Perkecil')}">−</button>
    <button id="lm-home" aria-label="${L('Back to the opening view', 'Kembali ke tampilan awal')}" title="${L('Back to the opening view', 'Kembali ke tampilan awal')}">◎</button>
  </div>
  <div class="lm-tip" id="lm-tip" hidden></div>
  <div class="lm-pick" id="lm-pick" hidden></div>
  <div class="lm-foot"><span class="more">${L('Drag to pan · scroll to zoom · click a logo', 'Seret untuk menggeser · gulir untuk zoom · klik logo')}<span class="sep">/</span><b>${located}</b> ${L('of', 'dari')} ${esc(n)} ${L('companies placed', 'perusahaan terpetakan')}<span class="sep">/</span></span>${tiles
    ? '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>'
    : 'Natural Earth'}</div>
  <noscript><div class="lm-msg"><p>${L('The map needs JavaScript. The same companies are in', 'Peta ini memerlukan JavaScript. Perusahaan yang sama ada di')} <a href="${PF}/#companies">${L('the census table', 'tabel sensus')}</a>.</p></div></noscript>
  <div class="lm-msg" id="lm-msg" hidden><p>${L('This browser has WebGL switched off, so the map cannot draw. The same companies are in', 'WebGL di peramban ini nonaktif, jadi peta tidak dapat digambar. Perusahaan yang sama ada di')} <a href="${PF}/#companies">${L('the census table', 'tabel sensus')}</a>.</p></div>
</div>
</main>
${embed ? '' : `<script src="/js/nav1001.js?v=${V}" defer></script>`}
<script type="module" src="/js/logomap1001.js?v=${V}"></script>
${embed ? '' : `<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>`}
</body>
</html>`;
}

/* ── iso(): the isometric map, /map/3d ─────────────────────────────── */
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
const ISO = '/map/3d';
function iso({ data, city, lang = 'en', embed = false }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const T = (data && data.totals) || {};
  const metros = (data && data.by_metro) || [];
  const n = T.companies || '';
  const here = METROS.find((m) => m.id === city) || null;
  const path = ISO + (city ? `?city=${city}` : '');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${embed ? '<base target="_top">' : ''}
<title>${L('The 3D city map', 'Peta kota 3D')} — 1001startup.id</title>
<meta name="description" content="${esc(L(
    'Every company in the census standing at its real address, on a map of Indonesia. ' + (n ? n + ' companies, ' : '') + 'Greater Jakarta, Bandung and Bali in one view.',
    'Setiap perusahaan sensus berdiri di alamat aslinya, di atas peta Indonesia. ' + (n ? n + ' perusahaan, ' : '') + 'Jakarta Raya, Bandung, dan Bali dalam satu tampilan.'))}">
<meta name="robots" content="noindex, follow">
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
          href="${PF}${ISO}?city=${X.id}">${esc(L(X.name, X.id_name))}${m.count ? ` · ${m.count}` : ''}</a>`;
      }).join('')}
    </span>
    <span class="grp">${AREAS.map(([id, label]) =>
      `<a class="chip" href="${PF}${ISO}?area=${id}">${esc(label)}</a>`).join('')}</span>
    <span class="grp"><a class="chip" href="${PF}/map">${L('← Logo map', '← Peta logo')}</a></span>
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

module.exports = { map, iso };
