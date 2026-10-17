'use strict';
/* 1001startup.id — the census on the map: THE LOGO MAP, /map since Oct 2026.
 *
 * Luca sent a robotics map of the Bay Area — a pale, quiet street map, every
 * company a round logo badge with its name beside it — and asked for
 * Indonesia's map to look like that. So /map is a real slippy map: a vector
 * basemap of the whole country served from this box (lib/map1001-routes.js,
 * scripts/fetch-basemap.sh), drawn by MapLibre GL in the palette of that
 * reference, with one badge per located company (public/js/logomap1001.js).
 * It covers every city in the census, not only three metros.
 *
 * It replaced the isometric canvas that was /map from Aug to Oct 2026 (toy
 * towers, hand-built districts, the Whoosh line). Luca, 12 Oct 2026, asked
 * whether to keep that as a second view: "instead using 3d, better just logo
 * like that". So this is the only map on 1001. The isometric engine
 * (public/js/jakarta.js) lives on as PASAR's /jakarta.
 *
 * LANGUAGE: the shell translates. Company names are names.
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
  <noscript><div class="lm-msg"><p>${L('The map needs JavaScript. The same companies are in', 'Peta ini memerlukan JavaScript. Perusahaan yang sama ada di')} <a href="${NAV.censusHref(PF)}">${L('the census table', 'tabel sensus')}</a>.</p></div></noscript>
  <div class="lm-msg" id="lm-msg" hidden><p>${L('This browser has WebGL switched off, so the map cannot draw. The same companies are in', 'WebGL di peramban ini nonaktif, jadi peta tidak dapat digambar. Perusahaan yang sama ada di')} <a href="${NAV.censusHref(PF)}">${L('the census table', 'tabel sensus')}</a>.</p></div>
</div>
</main>
${embed ? '' : `<script src="/js/nav1001.js?v=${V}" defer></script>`}
<script type="module" src="/js/logomap1001.js?v=${V}"></script>
${embed ? '' : `<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>`}
</body>
</html>`;
}

module.exports = { map };
