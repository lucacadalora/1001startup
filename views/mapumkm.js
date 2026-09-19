'use strict';
/* 1001umkm.id — the export map page. The census across the whole of
 * Indonesia: cities as iso diamonds far out, commodity sprites (the
 * Higgsfield matched set, one per sector) once a city fans open. Engine =
 * public/js/umkmmap.js; profile drawer chrome comes from the shared
 * /css/company1001.css. ?embed=1 serves the same map without site chrome for
 * the landing's iframe (the CSP frame-ancestors exception in server.js keys
 * on the /map path + embed query, host-agnostic). */
const { esc } = require('../lib/util');
const { V } = require('./html');
const UM = require('./pagesumkm');

function page({ data, embed }) {
  const T = (data && data.totals) || {};
  const fmt = (n) => (n === null || n === undefined) ? '—' : n.toLocaleString('en-US');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The export map — 1001umkm.id</title>
<meta name="description" content="Every exporter in the census, plotted at its city across Indonesia — ${fmt(T.mapped)} of ${fmt(T.exporters)} mapped, drawn as the commodities they ship.">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F6EFDF">
<link rel="icon" type="image/png" href="/assets/favicon-umkm.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<link rel="stylesheet" href="/css/company1001.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:#E4E7E6;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;display:flex;flex-direction:column;overflow:hidden}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${UM.GRAD};color:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px;flex:none}
${UM.HEADCSS}
.hd1001{flex:none}
.stage{position:relative;flex:1;min-height:0}
#umap{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab}
#umap:active{cursor:grabbing}
/* legend: the census map idiom — white card, hairline, mono labels */
.ulg{position:absolute;left:14px;top:14px;z-index:20;background:#fff;border:1px solid #E7E7E7;box-shadow:0 10px 30px rgba(0,0,0,.08);width:252px;max-height:calc(100% - 28px);display:flex;flex-direction:column}
.ulg .uh{padding:13px 14px 10px;border-bottom:1px solid #F1F1F1}
.ulg .ut{font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:7px}
.ulg .ut .sq{width:6px;height:6px;background:#000;display:inline-block}
.ulg #ucount{margin-top:8px;font-size:11px;color:#8E8E93;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em}
.ulg .uc{overflow-y:auto;padding:8px}
.uchip{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 7px;border:0;background:none;font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#52525B;cursor:pointer}
.uchip:hover{background:#F6F6F6;color:#000}
.uchip.on{background:#000;color:#fff}
.uchip .sq{width:8px;height:8px;flex:none;display:inline-block}
.ulg .uf{padding:9px 14px 11px;border-top:1px solid #F1F1F1;font-size:10px;line-height:1.5;color:#B4B4B8}
#ultog{display:none}
.utip{position:absolute;z-index:30;pointer-events:none;background:#fff;border:1px solid #000;padding:7px 10px;font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;max-width:300px;box-shadow:0 8px 22px rgba(0,0,0,.10)}
.utip[hidden]{display:none}
.uback{position:absolute;right:14px;top:14px;z-index:20;background:#000;color:#fff;text-decoration:none;padding:10px 14px;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.uback:hover{background:#333}
.uhint{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;z-index:20;background:rgba(255,255,255,.9);border:1px solid #E7E7E7;padding:7px 11px;font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8E8E93;pointer-events:none}
@media(max-width:700px){
  .ulg{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:44%}
  /* first visit: the fleet consent banner (.vs-cc, bottom-anchored, z 9999)
     sits exactly where the legend lives — hold the legend above it until the
     choice is made (consent.js stamps data-vs-consent on <html> either way) */
  html:not([data-vs-consent]) .ulg{bottom:196px}
  .ulg .uc{display:none}
  .ulg.open .uc{display:block}
  #ultog{display:block;position:absolute;top:9px;right:10px;border:1px solid #E7E7E7;background:#fff;font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;cursor:pointer}
  .ulg .uh{padding-right:86px}
  .uhint{display:none}
  .uback{top:10px;right:10px}
}
</style>
</head>
<body>
${embed ? '' : `<div class="banner">THE EXPORT MAP · EVERY PIN IS CITY-LEVEL · SPRITES ARE THE COMMODITIES SHIPPED</div>
${UM.header('/map')}`}
<div class="stage">
  <canvas id="umap"></canvas>
  <div class="ulg" id="ulegend">
    <div class="uh">
      <div class="ut"><span class="sq"></span>THE EXPORT MAP</div>
      <div id="ucount">loading…</div>
      <button id="ultog" type="button" aria-expanded="false">Sectors</button>
    </div>
    <div class="uc" id="uchips"></div>
    <div class="uf">Pins sit at the exporter's recorded city — the census holds city + province, not
    street addresses. ${fmt(T.unmapped)} rows record neither and are not drawn; they stay in
    <a href="/#exporters" style="color:inherit">the table</a>. Icons are the sector's commodity, not
    a claim about one company's product line.</div>
  </div>
  <div class="utip" id="utip" hidden></div>
  ${embed ? '<a class="uback" href="/map" target="_top">Open the full map</a>' : '<a class="uback" href="/#exporters">The table</a>'}
  <div class="uhint">Drag to pan · scroll to zoom · click a city to open it</div>
</div>
<script src="/js/umkmmap.js?v=${V}" defer></script>
${embed ? '' : `<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>`}
</body>
</html>`;
}

module.exports = { page };
