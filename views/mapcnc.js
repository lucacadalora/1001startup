'use strict';
/* CNC + 3D Indonesia — the map page. Every focus place (a province, or a
 * regency cluster on Java) as a marker coloured by its product family, and
 * the firms as city-level dots. Engine = public/js/cncmap.js (same paper,
 * projection and pan/zoom idiom as 1001umkm.id's export map). Slice 1 draws
 * plain markers; the 3D commodity icons come in slice 2. ?embed=1 = the
 * landing's iframe (frame-ancestors exception in server.js keys on /map +
 * embed, host-agnostic). */
const { V } = require('./html');
const UM = require('./pagesumkm');
const PC = require('./pagescnc');

function page({ data, embed }) {
  const T = (data && data.totals) || {};
  const fmt = (n) => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>The map — CNC + 3D Indonesia</title>
<meta name="description" content="Each province's and Java cluster's focus product for CNC machining and 3D printing, and ${fmt(T.firms_mapped)} firms plotted at their city.">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F6EFDF">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
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
${PC.BRANDCSS}
.hd1001{flex:none}
.stage{position:relative;flex:1;min-height:0}
#cmap{position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:grab}
#cmap:active{cursor:grabbing}
.ulg{position:absolute;left:14px;top:14px;z-index:20;background:#fff;border:1px solid #E7E7E7;box-shadow:0 10px 30px rgba(0,0,0,.08);width:262px;max-height:calc(100% - 28px);display:flex;flex-direction:column}
.ulg .uh{padding:13px 14px 10px;border-bottom:1px solid #F1F1F1}
.ulg .ut{font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;display:flex;align-items:center;gap:7px}
.ulg .ut .sq{width:6px;height:6px;background:#000;display:inline-block}
.ulg #ccount{margin-top:8px;font-size:11px;color:#8E8E93;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em}
.ulg .uc{overflow-y:auto;padding:8px}
.uchip{display:flex;align-items:center;gap:8px;width:100%;text-align:left;padding:6px 7px;border:0;background:none;font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#52525B;cursor:pointer}
.uchip:hover{background:#F6F6F6;color:#000}
.uchip.on{background:#000;color:#fff}
.uchip .sq{width:8px;height:8px;flex:none;display:inline-block;transform:rotate(45deg)}
.uchip.firms .sq{border-radius:50%;transform:none;background:#3F3F46}
.uchip.firms[aria-pressed="false"]{color:#B4B4B8}
.uchip.firms[aria-pressed="false"] .sq{background:#D9D9DE}
.ulg .uf{padding:9px 14px 11px;border-top:1px solid #F1F1F1;font-size:10px;line-height:1.5;color:#B4B4B8}
#cltog{display:none}
.utip{position:absolute;z-index:30;pointer-events:none;background:#fff;border:1px solid #000;padding:7px 10px;font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;max-width:300px;box-shadow:0 8px 22px rgba(0,0,0,.10)}
.utip[hidden]{display:none}
.uback{position:absolute;right:14px;top:14px;z-index:20;background:#000;color:#fff;text-decoration:none;padding:10px 14px;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.uback:hover{background:#333}
.uhint{position:absolute;left:50%;transform:translateX(-50%);bottom:12px;z-index:20;background:rgba(255,255,255,.9);border:1px solid #E7E7E7;padding:7px 11px;font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#8E8E93;pointer-events:none}
/* the place / firm card: right-hand panel, a bottom sheet on phones */
.card{position:absolute;right:14px;top:60px;z-index:25;width:min(380px,calc(100% - 28px));max-height:calc(100% - 74px);overflow-y:auto;background:#fff;border:1px solid #000;box-shadow:0 12px 34px rgba(0,0,0,.12);padding:18px 18px 16px}
.card[hidden]{display:none}
.card .cx{position:absolute;top:8px;right:8px;width:28px;height:28px;border:0;background:none;font:400 18px/1 'IBM Plex Mono',monospace;color:#8E8E93;cursor:pointer}
.card .cx:hover{color:#000}
.card .ck{font:400 10px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#8E8E93;padding-right:30px}
.card h2{font-size:22px;line-height:1.15;letter-spacing:-0.02em;font-weight:500;margin:6px 0 4px}
.card .fp{display:flex;align-items:center;gap:9px;margin:12px 0 4px;font-size:17px;line-height:1.3;letter-spacing:-0.015em}
.card .fp .fd{width:11px;height:11px;transform:rotate(45deg);flex:none}
.card .fit{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#52525B;border:1px solid #E7E7E7;padding:4px 6px;display:inline-block;margin:6px 0 2px}
.card p{color:#3F3F46;font-size:13.5px;line-height:1.55;margin-top:8px}
.card dl{margin-top:12px;border-top:1px solid #F1F1F1}
.card dt{font:400 9.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#B4B4B8;margin-top:10px}
.card dd{font-size:13px;line-height:1.5;color:#3F3F46;margin-top:2px}
.card .src{margin-top:12px;padding-top:10px;border-top:1px solid #F1F1F1;display:flex;flex-direction:column;gap:5px}
.card .src a{font:400 10.5px/1.45 'IBM Plex Mono',monospace;color:#000;text-decoration:none;border-bottom:1px solid #D9D9D9;align-self:flex-start;word-break:break-all}
.card .src a:hover{border-bottom-color:#000}
.card .webl{display:inline-block;margin-top:12px;font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#000;text-decoration:none;border-bottom:1px solid #000}
.card .cfb{font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;margin-left:8px}
.cf-high{color:#2F7A5C}.cf-medium{color:#8A6A45}.cf-low{color:#B4B4B8}
@media(max-width:700px){
  .ulg{left:10px;right:10px;top:auto;bottom:10px;width:auto;max-height:44%}
  html:not([data-vs-consent]) .ulg{bottom:196px}
  .ulg .uc{display:none}
  .ulg.open .uc{display:block}
  #cltog{display:block;position:absolute;top:9px;right:10px;border:1px solid #E7E7E7;background:#fff;font:400 9.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;padding:6px 8px;cursor:pointer}
  .ulg .uh{padding-right:96px}
  .uhint{display:none}
  .uback{top:10px;right:10px}
  .card{left:0;right:0;top:auto;bottom:0;width:auto;max-height:70%;border-left:0;border-right:0;border-bottom:0}
}
</style>
</head>
<body>
${embed ? '' : `<div class="banner">THE MAP · ONE FOCUS PRODUCT PER PLACE · FIRMS AT THEIR RECORDED CITY</div>
${PC.header('/map')}`}
<div class="stage">
  <canvas id="cmap"></canvas>
  <div class="ulg" id="clegend">
    <div class="uh">
      <div class="ut"><span class="sq"></span>FOCUS PRODUCTS</div>
      <div id="ccount">loading…</div>
      <button id="cltog" type="button" aria-expanded="false">Filters</button>
    </div>
    <div class="uc" id="cchips"></div>
    <div class="uf">A diamond is a focus place at its main city: one product picked by research for that
    province or Java cluster, not an official plan. Dots are firms at their recorded city; ${fmt(T.firms_unmapped)}
    firms without a placeable city stay in <a href="/#firms" style="color:inherit">the table</a>.</div>
  </div>
  <div class="utip" id="ctip" hidden></div>
  <aside class="card" id="ccard" hidden aria-live="polite"></aside>
  ${embed ? '<a class="uback" href="/map" target="_top">Open the full map</a>' : '<a class="uback" href="/#places">The table</a>'}
  <div class="uhint">Drag to pan · scroll to zoom · click a diamond for its focus</div>
</div>
<script src="/js/cncmap.js?v=${PC.CV}" defer></script>
${embed ? '' : `<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>`}
</body>
</html>`;
}

module.exports = { page };
