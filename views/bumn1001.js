'use strict';
/* /bumn — Indonesia's state companies (BUMN) on six yardsticks, as a logo quadrant.
 *
 * Luca, 15 Oct 2026: "make this into 1001startup.id/bumn ... just make it general
 * with those data". The data comes from a public-source research pass (42 BUMN):
 * finance is computed from published figures; national priority, strategic weight,
 * responsibility, prestige and risk are 0–5 rubric scores, each carried with its
 * one-line reason and source. Built by ~/projects/agrinas-pangan-research/page/build.py
 * --1001 into data/bumn.json + public/assets/bumn/<slug>.webp.
 * The badges follow /map's logo idiom (white disc, soft shadow, bold name beside it).
 * Client: public/js/bumn1001.js (CSP script-src 'self', so no inline script runs;
 * the data rides in a JSON block that the script reads).
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');

const FILE = path.join(__dirname, '..', 'data', 'bumn.json');
let cache = { mtime: 0, data: null };
function load() {
  try {
    const st = fs.statSync(FILE);
    if (st.mtimeMs !== cache.mtime) cache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(FILE, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return cache.data;
}

const V = String(Math.floor(Date.now() / 1000));

function page({ lang = 'en' }) {
  const D = load();
  const p = '/bumn';
  if (!D) return null;
  const n = D.entities.length;
  const asof = new Date(D.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const h1 = 'Indonesia’s state companies, mapped';
  const stats = (D.stats || []).map(s => `<div class="cell"><div class="v">${s.u ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.v)}</a>` : esc(s.v)}</div><div class="k">${esc(s.k)}</div></div>`).join('');
  const dnt = (D.danantara || []).map(d => `<li>${esc(d.t)} ${d.u ? `<a href="${esc(d.u)}" target="_blank" rel="noopener">${esc(new URL(d.u).hostname.replace(/^www\./, ''))}</a>` : ''}</li>`).join('');
  const method = (D.method || []).map(m => `${m.h ? `<h3>${esc(m.h)}</h3>` : ''}${m.p ? `<p>${esc(m.p)}</p>` : ''}${m.f ? `<div class="bm-f">${esc(m.f)}</div>` : ''}${m.list ? `<ul>${m.list.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`).join('');
  const body = `
<style>
.bm{max-width:1180px;margin:0 auto;padding:0 20px}
.bm-ctl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}
.bm-ctl .chip{cursor:pointer}
.bm-ctl .chip[aria-pressed="true"]{background:#000;border-color:#000;color:#fff}
.bm-ctl .chip[aria-pressed="true"] b{color:#C9C9CF}
.bm-ax{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.bm-ax select{font:400 12px/1 'IBM Plex Mono',monospace;border:1px solid #E7E7E7;background:#fff;color:#000;padding:7px 8px;border-radius:0}
.bm-field{position:relative;background:#F7F8F4;border:1px solid #E7E7E7;height:clamp(480px,62vw,700px);overflow:hidden;touch-action:manipulation;margin-top:6px}
.bm-field svg{position:absolute;inset:0;width:100%;height:100%;display:block}
.bm-b{position:absolute;width:var(--d);height:var(--d);margin:calc(var(--d) / -2) 0 0 calc(var(--d) / -2);border-radius:50%;border:0;padding:0;background:#fff;box-shadow:0 3px 9px rgba(24,32,36,.22),0 0 0 1.5px rgba(0,0,0,.08);cursor:pointer;transition:opacity .2s,transform .15s}
.bm-b img{width:100%;height:100%;border-radius:50%;display:block;border:3px solid #fff}
.bm-b:hover,.bm-b.on{transform:scale(1.12);z-index:5}
.bm-b.dim{opacity:.15}
.bm-b:focus-visible{outline:2px solid #000;outline-offset:2px}
.bm-l{position:absolute;font:600 13px/1.15 'Overused Grotesk',system-ui,sans-serif;color:#0B0B0C;white-space:nowrap;pointer-events:none;text-shadow:0 0 3px #F7F8F4,0 0 3px #F7F8F4,0 0 2px #F7F8F4}
.bm-l.dim{opacity:.18}
.bm-q{position:absolute;font:400 10.5px/1.25 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#9A9AA0;max-width:44%;pointer-events:none}
.bm-q.tl{top:10px}.bm-q.tr{right:12px;top:10px;text-align:right}.bm-q.br{right:12px;text-align:right}
.bm-foot{display:flex;flex-wrap:wrap;gap:4px 10px;font:400 10.5px/1.6 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;padding:8px 12px;border:1px solid #E7E7E7;border-top:0;background:#fff}
.bm-foot b{color:#000;font-weight:400}
.bm-card{position:absolute;z-index:20;width:320px;max-width:calc(100vw - 32px);background:#fff;border:1px solid #E7E7E7;box-shadow:0 10px 30px rgba(20,24,22,.16);padding:14px 14px 12px;font:500 13.5px/1.45 'Overused Grotesk',system-ui,sans-serif;letter-spacing:0}
.bm-card .hd{display:flex;gap:10px;align-items:center;margin-bottom:10px}
.bm-card .hd img{width:40px;height:40px;border-radius:50%;box-shadow:0 0 0 1.5px rgba(0,0,0,.08)}
.bm-card .nm{font-weight:650;font-size:16px;line-height:1.15}
.bm-card .cl{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-card .x{margin-left:auto;align-self:flex-start;border:1px solid #E7E7E7;background:#fff;width:30px;height:30px;font:400 14px/1 'IBM Plex Mono',monospace;cursor:pointer}
.bm-card .lk{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;margin-top:2px}
.bm-sr{display:grid;grid-template-columns:104px 1fr 34px 40px;gap:8px;align-items:center;padding:3px 0}
.bm-sr .k{font:400 10.5px/1.2 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73}
.bm-sr .bar{height:6px;background:#EEEEEA;position:relative}
.bm-sr .bar i{position:absolute;left:0;top:0;bottom:0;background:#3F3F46}
.bm-sr .v{font:400 12.5px/1 'IBM Plex Mono',monospace;text-align:right}
.bm-sr .r{font:400 11.5px/1 'IBM Plex Mono',monospace;color:#9A9AA0;text-align:right}
.bm-card .figs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:10px 0 8px;padding-top:10px;border-top:1px solid #F1F1F1}
.bm-card .fig .k{font:400 10px/1.2 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-card .fig .v{font-weight:600;font-size:14px}
.bm-card .fig .v a{text-decoration:none;border-bottom:1px solid #D9D9D9}
.bm-card .fig .p{font:400 10.5px/1.2 'IBM Plex Mono',monospace;color:#9A9AA0}
.bm-card .why{border-top:1px solid #F1F1F1;padding-top:8px;margin-top:4px;color:#3F3F46}
.bm-card .why p{margin:0 0 6px}
.bm-card .why b{font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#6B6B73;margin-right:4px}
.bm-card .why a{color:#2A6E9F}
.bm-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}
.bm-tools input{font:500 14px/1 'Overused Grotesk',system-ui,sans-serif;padding:9px 10px;border:1px solid #E7E7E7;width:240px;max-width:100%;border-radius:0}
#bm-tbl th button{all:unset;cursor:pointer}
#bm-tbl th button:focus-visible{outline:2px solid #000}
#bm-tbl th[aria-sort] button::after{content:" ↓"}
#bm-tbl th[aria-sort="ascending"] button::after{content:" ↑"}
#bm-tbl td{vertical-align:middle}
#bm-tbl td.co{display:flex;gap:9px;align-items:center;min-width:200px}
#bm-tbl td.co img{width:26px;height:26px;border-radius:50%;box-shadow:0 0 0 1px rgba(0,0,0,.08)}
#bm-tbl td.co button{all:unset;cursor:pointer;font-weight:600}
#bm-tbl td.co button:hover{text-decoration:underline}
#bm-tbl td.n .r{color:#A1A1AA;margin-left:4px}
#bm-tbl td.dash{color:#A1A1AA;text-align:right;font-family:'IBM Plex Mono',monospace}
.bm-list{list-style:none;display:grid;gap:10px;max-width:88ch}
.bm-list li{color:#3F3F46;font-size:15px;line-height:1.6;padding-left:14px;position:relative}
.bm-list li::before{content:"";position:absolute;left:0;top:.65em;width:6px;height:6px;background:#000}
.bm-list a,.bm-m a{color:#2A6E9F}
.bm-m{border:1px solid #E7E7E7;padding:0 18px;margin-top:6px}
.bm-m summary{cursor:pointer;font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;padding:16px 0}
.bm-m[open] summary{border-bottom:1px solid #F1F1F1;margin-bottom:12px}
.bm-m h3{font-size:16px;font-weight:600;margin:14px 0 4px}
.bm-m p,.bm-m li{color:#52525B;font-size:14.5px;line-height:1.6;max-width:88ch}
.bm-m ul{padding-left:18px;margin:6px 0 16px}
.bm-f{font:400 13px/1.6 'IBM Plex Mono',monospace;background:#F7F8F4;border:1px solid #F1F1F1;padding:10px 12px;margin:8px 0;overflow-x:auto;white-space:pre}
@media(max-width:760px){
  .bm-field{height:clamp(460px,128vw,620px)}
  .bm-q{font-size:9.5px;max-width:40%}
  .bm-card.sheet{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));top:auto;width:auto;max-width:none;max-height:72vh;overflow:auto}
  #bm-presets,#bm-clusters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-20px;padding-inline:20px}
  #bm-presets::-webkit-scrollbar,#bm-clusters::-webkit-scrollbar{display:none}
  #bm-presets .chip,#bm-clusters .chip{flex:0 0 auto}
}
@media(prefers-reduced-motion:reduce){.bm-b{transition:none}.bm-b:hover,.bm-b.on{transform:none}}
</style>
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>STATE COMPANIES · BUMN · ${esc(asof.toUpperCase())}</div>
  <h1>${esc(h1)}</h1>
  <p class="sub">${n} BUMN placed on six yardsticks: finance, national priority, strategic weight, responsibility, prestige and risk. Pick two to see who sits where. Every score carries its reason and its source.</p>
</section>
<div class="stats">${stats}</div>
<section class="bm" style="padding-top:40px">
  <div class="eyebrow"><span class="sq"></span>THE QUADRANT</div>
  <p class="lede">Each logo is one state company. The lines cross at the median, so half the companies sit on each side of each line. Tap a logo for its scores, figures and sources.</p>
  <div class="bm-ctl" id="bm-presets" role="group" aria-label="Axis pairs"></div>
  <div class="bm-ctl">
    <div class="bm-ax"><label for="bm-x">X</label><select id="bm-x"></select><label for="bm-y">Y</label><select id="bm-y"></select></div>
  </div>
  <div class="bm-ctl" id="bm-clusters" role="group" aria-label="Filter by Danantara sector"></div>
  <div class="bm-field" id="bm-field">
    <svg id="bm-grid" aria-hidden="true"></svg>
    <div class="bm-q tl" id="bm-q-tl"></div><div class="bm-q tr" id="bm-q-tr"></div>
    <div class="bm-q bl" id="bm-q-bl"></div><div class="bm-q br" id="bm-q-br"></div>
    <div id="bm-labs"></div>
    <div id="bm-badges"></div>
    <div class="bm-card" id="bm-card" hidden role="dialog" aria-live="polite"></div>
  </div>
  <div class="bm-foot" id="bm-foot"></div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>ALL SCORES AND RANKS</div>
  <p class="lede">Scores run from 0 to 5; the small number is the rank out of ${n}, and = marks a shared rank. For risk, a higher score means more trouble. Money figures are in IDR trillion and link to their source; a dash means no public figure was found.</p>
  <div class="bm-tools"><input id="bm-q" type="search" placeholder="Find a company" aria-label="Find a company"><span class="mono" id="bm-count" style="font-size:11px;color:#6B6B73"></span></div>
  <div class="tablewrap"><table id="bm-tbl"><thead></thead><tbody></tbody></table></div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>DANANTARA, IN FOUR FACTS</div>
  <ul class="bm-list">${dnt}</ul>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>HOW THE SCORES WORK</div>
  <p class="lede">Finance is computed from published figures. The other five scores follow a fixed 0–5 rubric, and each one cites its evidence in the company's card.</p>
  <details class="bm-m"><summary>Method, data dates and limits</summary>${method}</details>
</section>
<script type="application/json" id="bm-data">${JSON.stringify(D).replace(/</g, '\\u003c')}</script>
<script src="/js/bumn1001.js?v=${V}" defer></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'BUMN', path: p }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'Indonesia’s state companies on six yardsticks',
    description: `${n} Indonesian state-owned enterprises (BUMN) scored 0–5 on finance, national priority, strategic weight, responsibility, prestige and risk, from public sources.`,
    url: I18N.ORIGIN + p, dateModified: D.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: 'Indonesia’s state companies (BUMN), mapped — 1001startup.id',
    desc: `${n} BUMN on a logo quadrant: finance, national priority, strategic weight, responsibility, prestige and risk, each score sourced. Danantara era, ${asof}.`,
    path: p, lang, body, active: 'bumn',
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { page };
