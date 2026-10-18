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
const { liveFlag } = require('../lib/flaglive');
/* Group maps (Luca, 18 Oct 2026: a Sankey per BUMN, revenue by business out to its companies):
   views/bumnsankey1001.js serves /bumn/<slug>; while data/bumnsankey.live exists (BUMNSANKEY_PREVIEW=1)
   the cards link to it through the #bm-maps block. Without the switch the page is unchanged. */
const sankey = require('./bumnsankey1001');

const FILE = path.join(__dirname, '..', 'data', 'bumn.json');
/* The 56-company version (Luca, 18 Oct 2026: add the 14 BUMN Danantara lists that the page lacked):
   data/bumn-56.json, served instead of data/bumn.json while data/bumn56.live exists
   (BUMN56_PREVIEW=1 on a test port); remove the file and the 42-company page is back within 10 s. */
const FILE56 = path.join(__dirname, '..', 'data', 'bumn-56.json');
const all56 = liveFlag('bumn56.live', 'BUMN56_PREVIEW');
let cache = { file: '', mtime: 0, data: null };
function load() {
  const file = all56() && fs.existsSync(FILE56) ? FILE56 : FILE;
  try {
    const st = fs.statSync(file);
    if (file !== cache.file || st.mtimeMs !== cache.mtime) cache = { file, mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return cache.data;
}

/* Subsidiaries in each company's card (Luca, 18 Oct 2026: "list each BUMN's active
   subsidiaries in its side panel, with stake, status and the date of the statement behind it").
   data/bumn-subs.json comes from ~/projects/bumn-group-webs/tools/export-site.py: per BUMN its
   direct subsidiaries and stakes (and the companies under each), each stake linked to the filing
   or page it was read from. Shown only while data/bumnsubs.live exists (BUMNSUBS_PREVIEW=1 on a
   test port); without it the page is byte-identical to before. */
const subsLive = liveFlag('bumnsubs.live', 'BUMNSUBS_PREVIEW');
const SUBS = path.join(__dirname, '..', 'data', 'bumn-subs.json');
let subsCache = { mtime: 0, data: null };
function loadSubs() {
  try {
    const st = fs.statSync(SUBS);
    if (st.mtimeMs !== subsCache.mtime) subsCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(SUBS, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return subsCache.data;
}

/* Ties to data centres in each card (Luca, 18 Oct 2026, "ties block on /bumn"): data/bumn-ties.json,
   from the same research (confirmed or company-stated ties only, each with its source). Shown only
   while data/bumnties.live exists (BUMNTIES_PREVIEW=1 on a test port); the same switch turns on the
   state layer on /data-center (views/dcstate1001.js). */
const tiesLive = liveFlag('bumnties.live', 'BUMNTIES_PREVIEW');
const TIES = path.join(__dirname, '..', 'data', 'bumn-ties.json');
let tiesCache = { mtime: 0, data: null };
function loadTies() {
  try {
    const st = fs.statSync(TIES);
    if (st.mtimeMs !== tiesCache.mtime) tiesCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(TIES, 'utf8')) };
  } catch (e) { /* keep the last good copy */ }
  return tiesCache.data;
}

/* cache-buster from the script's own mtime, so editing public/js/bumn1001.js needs no restart */
const JS = path.join(__dirname, '..', 'public', 'js', 'bumn1001.js');
const ver = () => { try { return String(Math.floor(fs.statSync(JS).mtimeMs / 1000)); } catch (e) { return '0'; } };

function page({ lang = 'en' }) {
  const D = load();
  const S = subsLive() ? loadSubs() : null;
  const T = tiesLive() ? loadTies() : null;
  const TJ = T ? { types: T.types, groups: T.groups } : null;
  const MAPS = sankey.slugs();
  const p = '/bumn';
  if (!D) return null;
  const n = D.entities.length;
  const asof = new Date(D.asof + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const h1 = 'Indonesia’s state companies, mapped';
  /* with the subsidiaries switched on, a tile right after the company count totals every company
     under the groups (Luca, 18 Oct 2026: "still 56? you need to put the data also of the total
     subsidiary"): direct holdings + one level down + deeper, the same members as the group maps */
  const tiles = (D.stats || []).slice();
  if (S && S.groups) {
    const G = Object.values(S.groups).filter(Boolean);
    const all = G.reduce((a, g) => a + (g.t1 || 0) + (g.t2 || 0) + (g.deeper || 0), 0);
    const direct = G.reduce((a, g) => a + (g.t1 || 0), 0);
    if (all) tiles.splice(1, 0, { v: all.toLocaleString('en-US'), k: `Subsidiaries and stakes under the ${n}, at every level (${direct.toLocaleString('en-US')} held directly)`, u: null });
  }
  const stats = tiles.map(s => `<div class="cell"><div class="v">${s.u ? `<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.v)}</a>` : esc(s.v)}</div><div class="k">${esc(s.k)}</div></div>`).join('');
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
.bm-stage{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px;align-items:start;margin-top:6px}
@media(max-width:999px){.bm-stage{grid-template-columns:minmax(0,1fr)}}
.bm-field{position:relative;background:#F7F8F4;border:1px solid #E7E7E7;height:640px;overflow:hidden;touch-action:manipulation}
.bm-side{position:sticky;top:12px;border:1px solid #E7E7E7;background:#fff;padding:14px;font:500 13.5px/1.45 'Overused Grotesk',system-ui,sans-serif;letter-spacing:0}
@media(max-width:999px){.bm-side{position:static}}
.bm-side .k{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-side .qd{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:9px 0;border-bottom:1px solid #F1F1F1}
.bm-side .qd:last-child{border-bottom:0}
.bm-side .qd b{font:400 11px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase}
.bm-side .qd span{font:400 12px/1.3 'IBM Plex Mono',monospace;color:#6B6B73;text-align:right}
.bm-side .qd p{grid-column:1/-1;color:#52525B;font-size:13px;line-height:1.45}
.bm-b.nd::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:1.5px dashed #9A9AA0;pointer-events:none}
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
.bm-card{background:#fff;font:500 13.5px/1.45 'Overused Grotesk',system-ui,sans-serif;letter-spacing:0}
.bm-card.sheet{position:fixed;z-index:30;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));max-height:72vh;overflow:auto;border:1px solid #E7E7E7;box-shadow:0 10px 30px rgba(20,24,22,.18);padding:14px 14px 12px}
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
${S ? `.bm-card .subs{border-top:1px solid #F1F1F1;padding-top:9px;margin-top:6px}
.bm-card .subs .h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px}
.bm-card .subs .h b,.bm-card .subs summary{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-card .subs .h span{font:400 10.5px/1.3 'IBM Plex Mono',monospace;color:#9A9AA0;white-space:nowrap}
.bm-sub{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1px 8px;padding:6px 0;border-bottom:1px solid #F4F4F4}
.bm-sub .n{font-weight:600;font-size:13px;line-height:1.3;min-width:0}
.bm-sub .s{grid-column:1/-1;color:#6B6B73;font-size:12px;line-height:1.35}
.bm-sub .p,.bm-sub li .p{font:400 12px/1.3 'IBM Plex Mono',monospace;text-align:right;white-space:nowrap}
.bm-sub .p a,.bm-card .subs .nt a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.bm-sub details{grid-column:1/-1;margin-top:2px}
.bm-sub summary{cursor:pointer;font:400 11px/1.3 'IBM Plex Mono',monospace;color:#6B6B73}
.bm-sub ul{list-style:none;margin:5px 0 2px;padding:0 0 0 10px;border-left:2px solid #F1F1F1;display:grid;gap:4px}
.bm-sub li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;font-size:12.5px;line-height:1.3;color:#3F3F46}
.bm-card .subs .more{all:unset;cursor:pointer;font:400 11px/1.3 'IBM Plex Mono',monospace;color:#2A6E9F;margin-top:7px;display:inline-block}
.bm-card .subs .more:focus-visible{outline:2px solid #000}
.bm-card .subs .gone{margin-top:8px}
.bm-card .subs .gone summary{cursor:pointer}
.bm-card .subs .nt{color:#6B6B73;font-size:12px;line-height:1.4;margin-top:7px}
@media(min-width:1000px){.bm-side{max-height:calc(100vh - 24px);overflow:auto}}
` : ''}${TJ ? `.bm-card .ties{border-top:1px solid #F1F1F1;padding-top:9px;margin-top:8px}
.bm-card .ties .h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px}
.bm-card .ties .h b,.bm-card .ties .t{font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73}
.bm-card .ties .h span{font:400 10.5px/1.3 'IBM Plex Mono',monospace;color:#9A9AA0;white-space:nowrap}
.bm-card .ties .t{margin-top:9px;color:#3F3F46}
.bm-tie{padding:6px 0;border-bottom:1px solid #F4F4F4;display:grid;gap:2px}
.bm-tie .c{font-weight:600;font-size:13px;line-height:1.3}
.bm-tie .c a{color:#0B0B0C;text-decoration:none;border-bottom:1px solid #C9C9CF}
.bm-tie .d{color:#3F3F46;font-size:12.5px;line-height:1.4}
.bm-tie .m{font:400 10.5px/1.3 'IBM Plex Mono',monospace;color:#9A9AA0;letter-spacing:.03em}
.bm-tie .m a{color:#2A6E9F;text-decoration:none;border-bottom:1px solid #D9E3EC}
.bm-card .ties .more{all:unset;cursor:pointer;font:400 11px/1.3 'IBM Plex Mono',monospace;color:#2A6E9F;margin-top:7px;display:inline-block}
.bm-card .ties .more:focus-visible{outline:2px solid #000}
` : ''}${MAPS.length ? `.bm-card .gm{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:0 0 10px;padding:9px 10px;border:1px solid #000;font:400 10.5px/1.3 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#000;text-decoration:none}
.bm-card .gm:hover{background:#000;color:#fff}
.bm-card .gm:focus-visible{outline:2px solid #000;outline-offset:2px}
` : ''}@media(max-width:760px){
  .bm-q{font-size:9.5px;max-width:40%}
  #bm-presets,#bm-clusters{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-20px;padding-inline:20px}
  #bm-presets::-webkit-scrollbar,#bm-clusters::-webkit-scrollbar{display:none}
  #bm-presets .chip,#bm-clusters .chip{flex:0 0 auto}
}
@media(prefers-reduced-motion:reduce){.bm-b{transition:none}.bm-b:hover,.bm-b.on{transform:none}}
.stats.s5{grid-template-columns:repeat(5,1fr)}
@media(max-width:1100px){.stats.s5{grid-template-columns:repeat(2,1fr)}.stats.s5 .cell:last-child{grid-column:1/-1}}
</style>
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>STATE COMPANIES · BUMN · ${esc(asof.toUpperCase())}</div>
  <h1>${esc(h1)}</h1>
  <p class="sub">${n} BUMN on ten yardsticks: where their money comes from and how much they handle, then national priority, strategic weight, duty, reach, prestige and risk. Pick two to see who sits where. Every score carries its reason and its source.</p>
</section>
<div class="stats${tiles.length === 5 ? ' s5' : ''}">${stats}</div>
<section class="bm" style="padding-top:40px">
  <div class="eyebrow"><span class="sq"></span>THE QUADRANT</div>
  <p class="lede">Each logo is one state company, on the same 0–5 scale both ways. The lines cross at the median, so half the companies sit on each side of each line. Tap a logo for its scores, figures and sources.</p>
  <div class="bm-ctl" id="bm-presets" role="group" aria-label="Axis pairs"></div>
  <div class="bm-ctl">
    <div class="bm-ax"><label for="bm-x">X</label><select id="bm-x"></select><label for="bm-y">Y</label><select id="bm-y"></select></div>
  </div>
  <div class="bm-ctl" id="bm-clusters" role="group" aria-label="Filter by Danantara sector"></div>
  <div class="bm-stage" id="bm-stage">
    <div>
      <div class="bm-field" id="bm-field">
        <svg id="bm-grid" aria-hidden="true"></svg>
        <div class="bm-q tl" id="bm-q-tl"></div><div class="bm-q tr" id="bm-q-tr"></div>
        <div class="bm-q bl" id="bm-q-bl"></div><div class="bm-q br" id="bm-q-br"></div>
        <div id="bm-labs"></div>
        <div id="bm-badges"></div>
      </div>
      <div class="bm-foot" id="bm-foot"></div>
    </div>
    <aside class="bm-side" id="bm-side" aria-live="polite">
      <div id="bm-idle"></div>
      <div class="bm-card" id="bm-card" hidden role="dialog"></div>
    </aside>
  </div>
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
${S ? `<script type="application/json" id="bm-subs">${JSON.stringify(S).replace(/</g, '\\u003c')}</script>\n` : ''}${TJ ? `<script type="application/json" id="bm-ties">${JSON.stringify(TJ).replace(/</g, '\\u003c')}</script>\n` : ''}${MAPS.length ? `<script type="application/json" id="bm-maps">${JSON.stringify(MAPS)}</script>\n` : ''}<script src="/js/bumn1001.js?v=${ver()}" defer></script>`;
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: 'BUMN', path: p }];
  const ld = {
    '@context': 'https://schema.org', '@type': 'Dataset', name: 'Indonesia’s state companies on ten yardsticks',
    description: `${n} Indonesian state-owned enterprises (BUMN) scored 0–5 on balance sheet, money earned, state money, money handled, national priority, strategic weight, responsibility, people served, prestige and risk, from public sources.`,
    url: I18N.ORIGIN + p, dateModified: D.asof, creator: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
  };
  return shell({
    title: 'Indonesia’s state companies (BUMN), mapped — 1001startup.id',
    desc: `${n} BUMN on a logo quadrant: where their money comes from, how much they handle, national priority, strategic weight, duty, reach, prestige and risk, each score sourced. Danantara era, ${asof}.`,
    path: p, lang, body,
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { page, load };
