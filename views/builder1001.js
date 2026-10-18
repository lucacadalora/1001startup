'use strict';
/**
 * "Who is building this" — the builder card on every 1001startup.id page.
 *
 * Not a page: a card that rises in at the bottom-right on a reader's first
 * visit of the day, holds for a few seconds, then slides off to the right
 * and docks as a small edge tab (the phone "minimise to the edge" idiom).
 * The tab brings it back; swiping the card right, the minimise button,
 * Escape or a tap outside puts it away again. Behaviour lives in
 * public/js/builder1001.js (CSP: script-src 'self'), styles in
 * public/css/builder1001.css.
 *
 * server.js injects panel(lang) before </body> in the same onSend pass that
 * adds the census chat widget, so every 1001 page gets it without touching
 * each view. The root ships `hidden` and only the script unhides it (after
 * checking the stylesheet applied): with JS off the card does not exist.
 *
 * Contact details are Luca's own, given for this card (28 Sep 2026). The
 * WhatsApp number is the Oyenza Janitor inbox since 18 Oct 2026 (Luca).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');

/* /js and /css ship immutable for a year and Cloudflare edge-caches them, so
   the URLs carry a hash of the file itself: an edit is its own cache bust,
   no shared V bump needed. Read once at require time (restart = deploy). */
const hashOf = (rel) => {
  try { return crypto.createHash('sha1').update(fs.readFileSync(path.join(__dirname, '..', 'public', rel))).digest('hex').slice(0, 8); }
  catch { return 'x'; }
};
const CSS_V = hashOf('css/builder1001.css');
const JS_V = hashOf('js/builder1001.js');

const PHOTO = '/assets/builder-luca-card-7f5538fc.webp';
const FACE = '/assets/builder-luca-face-b2469cfa.webp';
const PHONE = '+62 877-8766-8573';
const WA = 'https://wa.me/6287787668573';
const OFFICE_MAP = 'https://www.google.com/maps/search/?api=1&query=WeWork+Revenue+Tower+SCBD+Jakarta';

const CHEV_R = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';
const CHEV_L = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square"/></svg>';

function panel(lang) {
  const L = I18N.mkL(lang);
  /* nofollow: this card sits on every page, and Google's link-spam policy
     names sitewide template links between related sites (RankMySEO report,
     5 Oct 2026). The links stay for readers; they just do not vote. */
  const ext = 'target="_blank" rel="noopener nofollow"';
  return `<link rel="stylesheet" href="/css/builder1001.css?v=${CSS_V}">
<div class="b1" id="b1" hidden>
  <aside class="b1-card" id="b1-card" aria-label="${esc(L('Who is building 1001startup.id', 'Siapa yang membangun 1001startup.id'))}" inert>
    <button class="b1-min" type="button" aria-label="${esc(L('Minimise', 'Sembunyikan'))}" title="${esc(L('Minimise', 'Sembunyikan'))}">${CHEV_R}</button>
    <div class="b1-ph"><img src="${PHOTO}" width="400" height="300" alt="${esc(L('Luca Cada Lora at Seedance Singapore', 'Luca Cada Lora di Seedance Singapore'))}" decoding="async"></div>
    <div class="b1-bd">
      <p class="b1-k">${esc(L('Who is building this', 'Siapa yang membangun ini'))}</p>
      <p class="b1-n">Luca Cada Lora</p>
      <ul class="b1-r">
        <li>${esc(L('Sovereign AI with', 'AI berdaulat bersama'))} <a href="https://jatevo.ai" ${ext}>jatevo.ai</a></li>
        <li>${esc(L('AI software factory with', 'Pabrik software AI bersama'))} <a href="https://vantis.sh" ${ext}>vantis.sh</a></li>
      </ul>
      <p class="b1-d">${esc(L(
        'I am building 1001startup.id as a census of Indonesia’s startups, made from public sources: who they are, where they sit, and the source behind every figure. Missing a company, spotted a wrong number, or want to work together? Message me.',
        'Saya membangun 1001startup.id sebagai sensus startup Indonesia dari sumber publik: siapa mereka, di mana kantornya, dan sumber di balik setiap angka. Ada perusahaan yang terlewat, angka yang keliru, atau ingin bekerja sama? Kirim pesan ke saya.'))}</p>
      <a class="b1-row" href="${WA}" ${ext} data-b1-ev="whatsapp"><span class="b1-l">WhatsApp</span><span class="b1-v">${esc(PHONE)}</span><span class="b1-a" aria-hidden="true">↗</span></a>
      <a class="b1-row" href="${OFFICE_MAP}" ${ext} data-b1-ev="office"><span class="b1-l">${esc(L('Office', 'Kantor'))}</span><span class="b1-v">Revenue Tower ${esc(L('Level', 'Lt.'))} 25<br>WeWork · SCBD, Jakarta</span><span class="b1-a" aria-hidden="true">↗</span></a>
    </div>
  </aside>
  <button class="b1-tab" type="button" aria-controls="b1-card" aria-expanded="false" aria-label="${esc(L('Show who is building 1001startup.id', 'Lihat siapa yang membangun 1001startup.id'))}">
    <span class="b1-cv">${CHEV_L}</span>
    <span class="b1-av"><img src="${FACE}" width="80" height="80" alt=""></span>
    <span class="b1-tl">${esc(L('Who’s building this', 'Siapa di baliknya'))}</span>
  </button>
</div>
<script src="/js/builder1001.js?v=${JS_V}" defer></script>`;
}

module.exports = { panel, PHOTO, PHONE, WA, OFFICE_MAP };
