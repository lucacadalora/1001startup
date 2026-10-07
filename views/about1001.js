'use strict';
/* /about (+ /id/about; /tentang redirects there) — who builds 1001startup.id.
 *
 * RankMySEO report, 5 Oct 2026: /about was a 404, and an about page is where
 * search engines, journalists and the link plan look for the person behind a
 * dataset. Luca's own words and contact details come from the builder card
 * (views/builder1001.js, 28 Sep 2026) so the two never drift; the card stays.
 * Census figures are read live from census.json, like every other page.
 */
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const B = require('./builder1001');
const { shell } = require('./browse1001');

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

function about({ data, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const T = (data && data.totals) || {};
  const n = ((data && data.companies) || []).length;
  const asOf = data && Date.parse(data.generated) ? new Date(Date.parse(data.generated)).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '';
  const usdB = (T.funding_usd_b || 0).toFixed(1);
  const path = '/about';
  const h1 = L('Who builds 1001startup.id', 'Siapa yang membangun 1001startup.id');
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: L('About', 'Tentang'), path }];
  const body = `
<style>
.ab{max-width:1180px;margin:0 auto;padding:48px 20px 0;display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:48px;align-items:start}
@media(max-width:900px){.ab{grid-template-columns:minmax(0,1fr);gap:28px;padding-top:32px}}
.ab h1{font-size:clamp(34px,4.6vw,56px);line-height:1.04;letter-spacing:-0.03em;font-weight:500}
.ab .who{font-size:22px;font-weight:600;margin-top:22px;letter-spacing:-0.01em}
.ab ul{list-style:none;margin-top:8px;color:#27272A;font-size:16px;line-height:1.7}
.ab ul a{border-bottom:1px solid #C7C7CC;text-decoration:none}
.ab .say{color:#3F3F46;font-size:16px;line-height:1.6;max-width:62ch;margin-top:16px}
.ab figure img{width:100%;height:auto;display:block;border:1px solid #E7E7E7}
.ab figcaption{font:400 10.5px/1.5 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;margin-top:8px}
.rows{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-top:22px;max-width:760px}
.rows a{background:#fff;padding:14px 16px;text-decoration:none;display:block}
.rows a:hover{background:#FAFAFA}
.rows .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73}
.rows .v{font-size:15px;margin-top:4px}
.prose{color:#3F3F46;font-size:15.5px;line-height:1.65;max-width:72ch}
.prose + .prose{margin-top:10px}
.prose a{border-bottom:1px solid #C7C7CC;text-decoration:none}
.cite{border-left:3px solid #000;padding:10px 14px;margin-top:12px;font-size:15px;line-height:1.6;max-width:72ch;background:#FAFAFA}
</style>
<section class="ab">
  <div>
    <div class="eyebrow"><span class="sq"></span>${L('ABOUT', 'TENTANG')}</div>
    <h1>${esc(h1)}.</h1>
    <p class="who">Luca Cada Lora</p>
    <ul>
      <li>${esc(L('Sovereign AI with', 'AI berdaulat bersama'))} <a href="https://jatevo.ai" target="_blank" rel="noopener">jatevo.ai</a></li>
      <li>${esc(L('AI software factory with', 'Pabrik software AI bersama'))} <a href="https://vantis.sh" target="_blank" rel="noopener">vantis.sh</a></li>
    </ul>
    <p class="say">${esc(L(
      'I am building 1001startup.id as a census of Indonesia’s startups, made from public sources: who they are, where they sit, and the source behind every figure. Missing a company, spotted a wrong number, or want to work together? Message me.',
      'Saya membangun 1001startup.id sebagai sensus startup Indonesia dari sumber publik: siapa mereka, di mana kantornya, dan sumber di balik setiap angka. Ada perusahaan yang terlewat, angka yang keliru, atau ingin bekerja sama? Kirim pesan ke saya.'))}</p>
    <div class="rows">
      <a href="${B.WA}" target="_blank" rel="noopener nofollow"><div class="k">WhatsApp</div><div class="v">${esc(B.PHONE)}</div></a>
      <a href="${B.OFFICE_MAP}" target="_blank" rel="noopener nofollow"><div class="k">${L('Office', 'Kantor')}</div><div class="v">Revenue Tower ${L('Level', 'Lt.')} 25 · WeWork · SCBD, Jakarta</div></a>
    </div>
  </div>
  <figure>
    <img src="${B.PHOTO}" width="400" height="300" alt="${esc(L('Luca Cada Lora at Seedance Singapore', 'Luca Cada Lora di Seedance Singapore'))}" decoding="async">
    <figcaption>${L('Luca Cada Lora at Seedance Singapore', 'Luca Cada Lora di Seedance Singapore')}</figcaption>
  </figure>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('WHAT THE CENSUS IS', 'APA ITU SENSUS INI')}</div>
  <p class="prose">${lang === 'id'
    ? `Menurut 1001startup.id${asOf ? ` (diperbarui ${esc(asOf)})` : ''}, sensus ini mencatat ${fmt(n)} startup Indonesia, dengan pendanaan yang diumumkan US$${usdB} miliar dan sekitar ${fmt(T.jobs)} lapangan kerja (estimasi). Setiap angka tertaut ke dokumen sumbernya; angka turunan selalu diberi label estimasi; tanda strip berarti tidak ada angka publik yang kredibel — kami tidak mengarangnya.`
    : `According to 1001startup.id${asOf ? ` (updated ${esc(asOf)})` : ''}, ${fmt(n)} Indonesian startups are on record, with US$${usdB} billion in disclosed funding and an estimated ${fmt(T.jobs)} jobs. Every figure links to the document it comes from; derived figures are always labeled as estimates; a dash means no credible public figure exists — we do not invent one.`}</p>
  <p class="prose">${L(
    `Read <a href="${PF}/coverage#method">how the numbers are made</a>, the <a href="${PF}/model">formal model</a> behind the output estimate, the <a href="${PF}/closed">startups that stopped</a>, or browse <a href="${PF}/sector">by sector</a> and <a href="${PF}/investors">by investor</a>.`,
    `Baca <a href="${PF}/coverage#method">cara kami menghitung</a>, <a href="${PF}/model">model formal</a> di balik estimasi output, <a href="${PF}/closed">startup yang sudah berhenti</a>, atau jelajahi <a href="${PF}/sector">per sektor</a> dan <a href="${PF}/investors">per investor</a>.`)}</p>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('HOW TO CITE IT', 'CARA MENGUTIPNYA')}</div>
  <p class="prose">${L('Name the census, the date, and link the page the figure is on. Figures change when the census is rebuilt, so the date matters.',
    'Sebut sensusnya, tanggalnya, dan tautkan halaman tempat angka itu berada. Angka berubah setiap kali sensus diperbarui, jadi tanggalnya penting.')}</p>
  <p class="cite">${L(
    `“According to the 1001startup.id census (updated ${esc(asOf)}), …” — ${I18N.ORIGIN}/company/gojek`,
    `“Menurut sensus 1001startup.id (diperbarui ${esc(asOf)}), …” — ${I18N.ORIGIN}/id/company/gojek`)}</p>
</section>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'AboutPage', name: h1, url: I18N.ORIGIN + PF + path,
    about: {
      '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/',
      founder: { '@type': 'Person', name: 'Luca Cada Lora' },
    },
  };
  return shell({
    title: L('About 1001startup.id — who builds the census', 'Tentang 1001startup.id — siapa yang membangunnya'),
    desc: lang === 'id'
      ? 'Siapa yang membangun 1001startup.id, sensus startup Indonesia dari sumber publik — Luca Cada Lora (jatevo.ai, vantis.sh) — cara mengutip sensus, dan cara menghubungi.'
      : 'Who builds 1001startup.id, the census of Indonesian startups made from public sources — Luca Cada Lora (jatevo.ai, vantis.sh) — how to cite it, and how to get in touch.',
    path, lang, body,
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { about };
