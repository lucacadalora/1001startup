'use strict';

const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const IMPORT_NOTE = require('./import-note1001');

const SLUG = 'indonesia-computer-import-growth';
const ARTICLE_PATH = '/research/' + SLUG;
const DATE = '2026-09-23';
const title = (L) => L('Indonesia’s computer import surge: what the data shows', 'Lonjakan impor komputer Indonesia: apa yang ditunjukkan data');
const summary = (L) => L('Processing-unit and computer-system imports rose about 145% in January–July 2026. We examine the growth and an illustrative scenario for AI equipment.', 'Impor unit pemrosesan dan sistem komputer naik sekitar 145% pada Januari–Juli 2026. Kami menelaah pertumbuhan ini dan skenario ilustratif untuk peralatan AI.');
const meta = (L) => `<p class="research-meta">${L('Research 001 · Trade & computing', 'Riset 001 · Perdagangan & komputasi')} · <time datetime="${DATE}">23 Sep 2026</time></p>`;

function comparison(lang) {
  const L = I18N.mkL(lang);
  return `<figure class="comparison">
    <figcaption>${L('Processing units + computer systems', 'Unit pemrosesan + sistem komputer')}<span>${L('January–July · US$ billion · HS 847150 + 847149', 'Januari–Juli · miliar US$ · HS 847150 + 847149')}</span></figcaption>
    <div class="bar-row"><span>2025</span><div class="bar-track"><span class="bar prior" style="width:40.86%"></span></div><strong>${L('1.61', '1,61')}</strong></div>
    <div class="bar-row"><span>2026</span><div class="bar-track"><span class="bar" style="width:100%"></span></div><strong>${L('3.94', '3,94')}</strong></div>
    <p class="source">${L('Source: supplied trade spreadsheets; original provider not independently authenticated.', 'Sumber: spreadsheet perdagangan yang disediakan; penyedia asli belum diverifikasi secara independen.')}</p>
  </figure>`;
}

function shell({ lang, path, heading, description, body, article = false, noindex = false }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const trail = [{ name: '1001startup.id', path: '/' }, { name: L('Research', 'Riset'), path: '/research' }];
  if (article) trail.push({ name: heading, path });
  const ld = article ? `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: heading,
    description, datePublished: DATE, inLanguage: lang === 'id' ? 'id-ID' : 'en',
    mainEntityOfPage: I18N.ORIGIN + PF + path,
    author: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN },
    publisher: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN },
  }).replace(/</g, '\\u003c')}</script>` : '';
  return `<!doctype html><html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(heading)} · 1001startup.id</title><meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">${noindex ? '' : I18N.headTags(lang, path)}${I18N.ogImage()}
<meta property="og:title" content="${esc(heading)}"><meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${article ? 'article' : 'website'}"><meta property="og:url" content="${I18N.ORIGIN + PF + path}">
${SCHEMA.breadcrumbLd(lang, trail)}${ld}
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:oklch(99.7% .002 240);color:oklch(20% .008 240);font:500 17px/1.6 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-.01em}
a{color:inherit;text-underline-offset:4px}a:hover{color:oklch(42% .06 240)}
a:focus-visible,summary:focus-visible{outline:2px solid oklch(45% .09 240);outline-offset:5px}
${NAV.css}
${IMPORT_NOTE.css}
.research-wrap{max-width:1180px;margin:auto;padding:0 20px}
.research-head{padding:clamp(38px,7vw,84px) 0 36px;border-bottom:1px solid oklch(89% .006 240)}
h1{max-width:23ch;font-size:clamp(36px,5.5vw,64px);line-height:1.05;font-weight:550;letter-spacing:-.035em;margin:14px 0 22px}
h2{font-size:clamp(25px,3vw,36px);line-height:1.17;font-weight:550;letter-spacing:-.025em}
.research-meta,.crumb,.source{color:oklch(43% .01 240);font-size:13px}
.research-meta{font:400 11px/1.8 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em}
.deck{font-size:clamp(19px,2vw,23px);line-height:1.5;max-width:65ch;color:oklch(36% .012 240)}
.research-feature{display:grid;grid-template-columns:1.1fr 1fr;gap:clamp(28px,5vw,64px);padding:42px 0 64px;align-items:start}
.research-feature h2{margin:14px 0 20px}.research-feature h2 a{text-decoration:none}.research-feature h2 a:hover{text-decoration:underline}
.research-feature p+p{margin-top:20px}.read-link{display:inline-block;margin-top:24px;font-weight:600}
.comparison{padding:22px 0;border-block:1px solid oklch(85% .009 240);margin:0}
.comparison figcaption{font-size:19px;font-weight:600;margin-bottom:24px}
.comparison figcaption span{display:block;font-size:13px;font-weight:400;color:oklch(43% .01 240);margin-top:4px}
.bar-row{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;gap:12px;margin:16px 0;font-variant-numeric:tabular-nums}
.bar-track{height:28px}.bar{height:100%;display:block;background:oklch(51% .066 240)}.bar.prior{background:oklch(70% .025 240)}
.source{line-height:1.6;margin-top:24px;max-width:70ch}
.research-body{max-width:820px;margin:38px auto 64px}.research-body>p{max-width:72ch;margin:22px 0}.research-body>h2{margin:38px 0 16px}
.research-body .import-note{margin:38px 0 0;padding:0;max-width:none}.research-body .import-note article{padding:0;border:0}
.research-body .import-note .in-meta{display:none}.research-body .import-note .in-copy{max-width:72ch}
.research-body .import-note h2{max-width:32ch}.research-body .import-note details{font-size:15px}
.table-scroll{overflow-x:auto;margin:24px 0}table{border-collapse:collapse;width:100%;font-size:15px;font-variant-numeric:tabular-nums}
caption{text-align:left;margin-bottom:12px;color:oklch(43% .01 240)}th,td{padding:14px 12px;border-bottom:1px solid oklch(87% .006 240);text-align:right}th:first-child{text-align:left}thead th{font-size:13px}tbody th{font-weight:500}tfoot th,tfoot td{font-weight:600}
footer{border-top:1px solid oklch(89% .006 240);padding:24px 20px;font-size:14px;color:oklch(43% .01 240)}footer>div{max-width:1140px;margin:auto;display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
@media(max-width:760px){.research-feature{grid-template-columns:1fr}.research-head{padding-top:32px}.research-body{margin-top:28px}th,td{padding:12px 8px}}
</style></head><body>
${NAV.header('research', { lang, path, translated: true })}
<main class="research-wrap">${body}</main>
<footer><div><a href="${PF}/">1001startup.id</a><span>${L('Figures with sources. Assumptions made visible.', 'Angka bersumber. Asumsi dijelaskan.')} · <a href="${PF}/research">${L('Research', 'Riset')}</a></span></div></footer>
<script src="/js/nav1001.js?v=${V}" defer></script></body></html>`;
}

function index({ lang = 'en' } = {}) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return shell({ lang, path: '/research', heading: L('Research', 'Riset'),
    description: L('Research on Indonesia’s startup economy, with the data, assumptions and sources behind each article.', 'Riset tentang ekonomi startup Indonesia, lengkap dengan data, asumsi, dan sumber di balik setiap artikel.'),
    body: `<header class="research-head"><h1>${L('Research', 'Riset')}</h1><p class="deck">${L('A closer look at the forces shaping Indonesia’s startup economy. Data, working hypotheses, and the evidence behind them.', 'Menelaah faktor yang membentuk ekonomi startup Indonesia. Data, hipotesis kerja, dan bukti yang mendasarinya.')}</p></header>
<article class="research-feature"><div>${meta(L)}<h2><a href="${PF + ARTICLE_PATH}">${title(L)}</a></h2><p>${summary(L)}</p><a class="read-link" href="${PF + ARTICLE_PATH}">${L('Read the research', 'Baca riset')} →</a></div>${comparison(lang)}</article>` });
}

function article({ lang = 'en' } = {}) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const n = (value) => value.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return shell({ lang, path: ARTICLE_PATH, heading: title(L), description: summary(L), article: true,
    body: `<article><header class="research-head"><p class="crumb"><a href="${PF}/research">← ${L('All research', 'Semua riset')}</a></p><h1>${title(L)}</h1><p class="deck">${summary(L)}</p><br>${meta(L)}</header>
<div class="research-body">
<p>${L('The clearest signal in the supplied trade data is a shift toward processing units and computer systems. Together, these two categories rose by <strong>US$2.33 billion</strong> compared with the same seven months of 2025, an increase of approximately <strong>145%</strong>. The comparison uses January–July in both years, not a partial year against a full year.', 'Sinyal paling jelas dalam data perdagangan yang disediakan adalah pergeseran menuju unit pemrosesan dan sistem komputer. Kedua kategori ini naik sebesar <strong>US$2,33 miliar</strong> dibandingkan tujuh bulan yang sama pada 2025, atau sekitar <strong>145%</strong>. Perbandingan menggunakan Januari–Juli pada kedua tahun, bukan sebagian tahun dibandingkan dengan setahun penuh.')}</p>
${comparison(lang)}
<h2>${L('Where the growth sits', 'Di mana pertumbuhan terjadi')}</h2>
<p>${L('Total computer-equipment imports under HS 8471 increased by 89.5%, from US$2.77 billion to US$5.26 billion. Processing units and computer systems accounted for approximately 94% of that increase. Processing-unit imports alone reached US$654.453 million in May, US$852.058 million in June and US$661.632 million in July 2026.', 'Total impor peralatan komputer dalam HS 8471 naik 89,5%, dari US$2,77 miliar menjadi US$5,26 miliar. Unit pemrosesan dan sistem komputer menyumbang sekitar 94% dari kenaikan tersebut. Impor unit pemrosesan saja mencapai US$654,453 juta pada Mei, US$852,058 juta pada Juni, dan US$661,632 juta pada Juli 2026.')}</p>
<div class="table-scroll" role="region" aria-label="${L('Import comparison', 'Perbandingan impor')}" tabindex="0"><table><caption>${L('January–July imports, US$ millions', 'Impor Januari–Juli, juta US$')}</caption><thead><tr><th scope="col">${L('Category', 'Kategori')}</th><th scope="col">2025</th><th scope="col">2026</th></tr></thead><tbody>
<tr><th scope="row">${L('Processing units', 'Unit pemrosesan')} (847150)</th><td>${n(1072.631)}</td><td>${n(2850.872)}</td></tr>
<tr><th scope="row">${L('Computer systems', 'Sistem komputer')} (847149)</th><td>${n(537.953)}</td><td>${n(1090.499)}</td></tr>
</tbody><tfoot><tr><th scope="row">${L('Combined', 'Gabungan')}</th><td>${n(1610.584)}</td><td>${n(3941.371)}</td></tr></tfoot></table></div>
${IMPORT_NOTE.render(lang)}
<h2>${L('What would strengthen the AI hypothesis?', 'Apa yang dapat memperkuat hipotesis AI?')}</h2>
<p>${L('The next step is shipment-level evidence: importer names, dates, model or part numbers, quantities and declared values. Installation and operating status require separate evidence. Until those records are available, the trade totals show growth in broad computing categories; the AI allocation remains a scenario.', 'Langkah berikutnya adalah bukti pada tingkat pengiriman: nama pengimpor, tanggal, model atau nomor komponen, jumlah, dan nilai yang dilaporkan. Status pemasangan dan operasional memerlukan bukti tersendiri. Sampai catatan tersebut tersedia, total perdagangan menunjukkan pertumbuhan kategori komputasi yang luas; alokasi AI tetap merupakan skenario.')}</p>
<p><a href="${PF}/research">← ${L('Back to Research', 'Kembali ke Riset')}</a></p></div></article>` });
}

// Preserve incoming links to the note originally introduced on /news.
function teaser(lang = 'en') {
  const L = I18N.mkL(lang);
  return `<section class="import-note" id="indonesia-ai-factory-imports" aria-labelledby="import-note-title"><article>${meta(L)}<h2 id="import-note-title"><a href="${I18N.pfx(lang) + ARTICLE_PATH}">${title(L)}</a></h2><p>${summary(L)}</p><p><a href="${I18N.pfx(lang) + ARTICLE_PATH}">${L('Read the article in Research', 'Baca artikel di Riset')} →</a></p></article></section>`;
}

function notFound({ lang = 'en' } = {}) {
  const L = I18N.mkL(lang);
  return shell({ lang, path: '/research', heading: L('Article not found', 'Artikel tidak ditemukan'), description: '', noindex: true,
    body: `<header class="research-head"><p class="research-meta">404</p><h1>${L('Article not found', 'Artikel tidak ditemukan')}</h1><p><a href="${I18N.pfx(lang)}/research">${L('Browse Research', 'Lihat Riset')} →</a></p></header>` });
}

module.exports = { index, article, teaser, notFound, SLUG, ARTICLE_PATH, DATE };
