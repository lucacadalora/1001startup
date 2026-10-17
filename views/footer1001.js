'use strict';
/* ONE footer for the 1001startup.id pages that carry the full footer — the
 * front page, the startup table (/startups) and the exporter census (/umkm).
 * Columns come from the nav data (views/nav1001.js navNow()), so a rename in
 * the header renames here too and the Datasets column appears the moment the
 * four-dataset front page goes live. With the switch off this renders exactly
 * the footer the old landing carried inline (same markup, same CSS).
 */
const { esc } = require('../lib/util');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');

/* footer({ lang, tagline, sub, legalLeft, legalRight })
   tagline/sub/legalLeft/legalRight are { en, id } pairs or plain strings
   (legalRight is HTML, already escaped by the caller). */
function footer(opts) {
  const { lang = 'en', tagline, sub, legalLeft, legalRight } = opts || {};
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const T = (x, en, id) => (x == null ? L(en, id) : typeof x === 'string' ? x : L(x.en, x.id));
  const nav = NAV.navNow();
  const groupOf = (key) => nav.find((n) => n.key === key) || {};
  const ftItem = (it) => it.href
    ? `<li><a href="${esc(PF + it.href)}">${esc(L(it.label, it.id))}</a></li>`
    : `<li><span class="off">${esc(L(it.label, it.id))}${it.tag ? `<em>${esc(L(it.tag, it.id_tag))}</em>` : ''}</span></li>`;
  const ftCol = (title, lis) => `<div class="ftcol"><h4>${esc(title)}</h4><ul>${lis.join('')}</ul></div>`;
  const ftSite = nav.filter((n) => !n.items).map(ftItem)
    .concat([ftItem({ label: 'Live traffic', id: 'Statistik pengunjung', href: '/stats' })]);
  const ds = groupOf('datasets');
  const cols = [ftCol('1001startup.id', ftSite)];
  if (ds.items) cols.push(ftCol(L(ds.label, ds.id), ds.items.map(ftItem)));
  const census = groupOf('census');
  cols.push(ftCol(L(census.label || 'Census', census.id), (census.items || []).map(ftItem)
    .concat([ftItem({ label: 'Coverage', id: 'Cakupan', href: '/coverage' })])));
  const method = groupOf('method');
  cols.push(ftCol(L(method.label || 'Method', method.id), (method.items || []).map(ftItem)));
  const agents = groupOf('agents');
  cols.push(ftCol(L(agents.label || 'Agents', agents.id), (agents.items || []).map(ftItem)));
  return `<footer class="ft">
  <div class="ftin">
    <div class="ftgrid${ds.items ? ' g5' : ''}">
      <div class="ftbrand">
        <a class="fbx" href="${PF}/"><i>1001</i>1001startup.id</a>
        <div class="fth">${T(tagline, 'The census of Indonesian startups.', 'Sensus startup Indonesia.')}</div>
        <p>${T(sub, 'Public sources only; every derived figure is a labeled estimate.', 'Hanya sumber publik; setiap angka turunan adalah estimasi berlabel.')}</p>
      </div>
      ${cols.join('\n      ')}
    </div>
    <svg class="ftmark" viewBox="0 0 1200 168" aria-hidden="true" focusable="false">
      <defs><linearGradient id="ftg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#E8734B"/><stop offset=".34" stop-color="#F3C64B"/>
        <stop offset=".68" stop-color="#7AB88A"/><stop offset="1" stop-color="#4E7A96"/>
      </linearGradient></defs>
      <text x="600" y="126" text-anchor="middle" textLength="1156" lengthAdjust="spacingAndGlyphs" font-family="'Overused Grotesk',system-ui,sans-serif" font-size="148" font-weight="500" letter-spacing="-3" fill="none" stroke="url(#ftg)" stroke-width="1.5">1001startup.id</text>
    </svg>
    <div class="ftlegal mono">
      <span>© 2026 1001startup.id · ${T(legalLeft, 'the census of Indonesian startups', 'sensus startup Indonesia')}</span>
      <span>${legalRight == null ? '' : typeof legalRight === 'string' ? legalRight : L(legalRight.en, legalRight.id)}</span>
    </div>
  </div>
</footer>`;
}

/* The footer's CSS, moved verbatim out of the old landing; .g5 is the
   six-column grid the Datasets column needs. */
const css = `
/* ── footer: columns from the nav data + the outline wordmark ── */
.ft{border-top:1px solid #E7E7E7;margin-top:64px}
.ftin{max-width:1180px;margin:0 auto;padding:46px 20px 28px}
.ftgrid{display:grid;grid-template-columns:1.35fr repeat(4,1fr);gap:36px 28px}
.ftgrid.g5{grid-template-columns:1.35fr repeat(5,1fr)}
@media(max-width:1000px){.ftgrid,.ftgrid.g5{grid-template-columns:repeat(2,1fr)}.ftbrand{grid-column:1/-1}}
@media(max-width:520px){.ftgrid{grid-template-columns:1fr}.ftgrid.g5{grid-template-columns:repeat(2,minmax(0,1fr));gap:28px 18px}}
.fbx{display:inline-flex;align-items:center;gap:10px;font-weight:600;text-decoration:none;margin-bottom:14px}
.fbx i{width:26px;height:26px;border:1.5px solid #000;display:grid;place-items:center;font:600 9px/1 'IBM Plex Mono',monospace;font-style:normal}
.ftbrand .fth{font-size:20px;font-weight:500;letter-spacing:-0.02em;line-height:1.2;max-width:18ch}
.ftbrand p{margin-top:10px;color:#6B6B73;font-size:13px;line-height:1.55;max-width:30ch}
.ftcol h4{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:#74747D;margin-bottom:13px;display:flex;align-items:center;gap:7px}
.ftcol h4::before{content:'';width:5px;height:5px;background:#000;display:inline-block;flex:none}
.ftcol ul{list-style:none}
.ftcol li{margin-bottom:8px}
.ftcol a{text-decoration:none;color:#52525B;font-size:13.5px}
.ftcol a:hover{color:#000}
.ftcol .off{color:#74747D;font-size:13.5px}
.ftcol .off em{font:400 8.5px/1 'IBM Plex Mono',monospace;font-style:normal;text-transform:uppercase;letter-spacing:.06em;border:1px solid #E7E7E7;padding:2px 4px;margin-left:6px;vertical-align:1px}
.ftmark{display:block;width:100%;height:auto;margin:44px 0 6px}
.ftlegal{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;border-top:1px solid #E7E7E7;padding-top:18px;font-size:10.5px;line-height:1.6;color:#6B6B73}
.ftlegal a{color:inherit;text-decoration:none;border-bottom:1px solid #D9D9D9}
.ftlegal a:hover{color:#000;border-bottom-color:#000}
`;

module.exports = { footer, css };
