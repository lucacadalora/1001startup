'use strict';

const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const IMPORT_NOTE = require('./import-note1001');
const IMPORT_HS = require('./import-hs1001');

const SLUG = 'indonesia-computer-import-growth';
const ARTICLE_PATH = '/research/' + SLUG;
const DATE = '2026-09-23';
const title = (L) => L('Searching for H200 and B300 AI clusters in Indonesia’s imports', 'Menelusuri klaster AI H200 dan B300 dalam impor Indonesia');
const summary = (L) => L('Could Indonesia’s computing import surge be building H200 or B300 clusters for AI token factories and data centers? An HS-code study of the US$3.94 billion signal.', 'Apakah lonjakan impor komputasi Indonesia membangun klaster H200 atau B300 untuk pabrik token AI dan pusat data? Studi kode HS atas sinyal senilai US$3,94 miliar.');
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
h3{font-size:23px;line-height:1.3;font-weight:550;margin:32px 0 14px}h2{font-size:clamp(25px,3vw,36px);line-height:1.17;font-weight:550;letter-spacing:-.025em}
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
.hs-table{min-width:590px}.hs-table th:first-child{width:46%}.hs-table th span,.hs-table th small{display:block}.hs-table th small{font-size:12px;color:oklch(43% .01 240);font-weight:400;margin-top:5px}.hs-table code{font-size:13px}.hs-table td{white-space:nowrap}.research-body ul{padding-left:22px;max-width:72ch}.research-body li{margin:12px 0}.research-body>p,.research-body li{overflow-wrap:break-word}
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
  return shell({ lang, path: ARTICLE_PATH, heading: title(L), description: summary(L), article: true,
    body: `<article><header class="research-head"><p class="crumb"><a href="${PF}/research">← ${L('All research', 'Semua riset')}</a></p><h1>${title(L)}</h1><p class="deck">${summary(L)}</p><br>${meta(L)}</header>
<div class="research-body">
<p>${L('Our research question is specific: <strong>is Indonesia importing H200- or B300-based GPU clusters to build AI token factories or AI data centers?</strong> An AI token factory here means infrastructure that runs models to generate tokens through inference; an AI data center may also support training and other workloads. The working hypothesis is that part of the import surge represents the server compute for these facilities.', 'Pertanyaan riset kami spesifik: <strong>apakah Indonesia mengimpor klaster GPU berbasis H200 atau B300 untuk membangun pabrik token AI atau pusat data AI?</strong> Pabrik token AI di sini berarti infrastruktur yang menjalankan model untuk menghasilkan token melalui inferensi; pusat data AI juga dapat mendukung pelatihan dan beban kerja lain. Hipotesis kerja kami adalah bahwa sebagian lonjakan impor merupakan perangkat komputasi server untuk fasilitas tersebut.')}</p>
<p>${L('The study identifies <strong>categories and import windows to investigate</strong>. The supplied aggregates do not identify H200 or B300 shipments, cluster counts, owners or locations. Conventional cloud expansion, enterprise servers and non-AI computing remain possible explanations.', 'Studi ini mengidentifikasi <strong>kategori dan periode impor untuk ditelusuri</strong>. Data agregat yang disediakan tidak mengidentifikasi pengiriman H200 atau B300, jumlah klaster, pemilik, atau lokasi. Ekspansi cloud konvensional, server perusahaan, dan komputasi non-AI tetap merupakan penjelasan yang mungkin.')}</p>
<h2>${L('Why look for servers and systems?', 'Mengapa menelusuri server dan sistem?')}</h2>
<p>${L('The research target is the equipment surrounding the GPU as well as the GPU itself. NVIDIA documents an <a href="https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory-h100-h200-b200/latest/network-logical-architecture.html">HGX H200 cluster architecture</a> with 32 eight-GPU servers, or 256 GPUs. Its <a href="https://docs.nvidia.com/dgx/dgxb300-user-guide/introduction-to-dgxb300.html">DGX B300 system</a> combines eight B300 GPUs with CPUs, memory, local storage and network interfaces. Those are examples of how AI compute is packaged, not evidence that these configurations were imported into Indonesia.', 'Sasaran riset mencakup perangkat di sekitar GPU serta GPU itu sendiri. NVIDIA mendokumentasikan <a href="https://docs.nvidia.com/enterprise-reference-architectures/hgx-ai-factory-h100-h200-b200/latest/network-logical-architecture.html">arsitektur klaster HGX H200</a> dengan 32 server berisi delapan GPU per server, atau 256 GPU. <a href="https://docs.nvidia.com/dgx/dgxb300-user-guide/introduction-to-dgxb300.html">Sistem DGX B300</a> menggabungkan delapan GPU B300 dengan CPU, memori, penyimpanan lokal, dan antarmuka jaringan. Ini adalah contoh bentuk perangkat komputasi AI, bukan bukti bahwa konfigurasi tersebut diimpor ke Indonesia.')}</p>
<p>${L('This makes processing-unit and system declarations useful places to search for assembled GPU servers. The HS classification depends on what is actually presented to customs. A server, a complete system, an accelerator board and a chip must not be treated as interchangeable records.', 'Karena itu, deklarasi unit pemrosesan dan sistem merupakan tempat yang berguna untuk mencari server GPU rakitan. Klasifikasi HS bergantung pada barang yang benar-benar disajikan kepada bea cukai. Server, sistem lengkap, papan akselerator, dan chip tidak boleh diperlakukan sebagai catatan yang setara.')}</p>
<h2>${L('The signal: US$3.94 billion in two categories', 'Sinyal: US$3,94 miliar dalam dua kategori')}</h2>
<p>${L('During January–July 2026, HS 847150 and 847149 together reached <strong>US$3.94 billion</strong>, versus US$1.61 billion in the same months of 2025: an increase of <strong>US$2.33 billion, or about 145%</strong>. They account for approximately <strong>94% of the increase</strong> in the broader HS 8471 category. That concentration motivates our AI-compute hypothesis; it does not measure the AI share.', 'Pada Januari–Juli 2026, gabungan HS 847150 dan 847149 mencapai <strong>US$3,94 miliar</strong>, dibandingkan US$1,61 miliar pada bulan yang sama tahun 2025: naik <strong>US$2,33 miliar, atau sekitar 145%</strong>. Keduanya menyumbang sekitar <strong>94% dari kenaikan</strong> kategori HS 8471 secara keseluruhan. Konsentrasi ini menjadi dasar hipotesis komputasi AI kami; angka tersebut tidak mengukur pangsa AI.')}</p>
${comparison(lang)}
${IMPORT_HS.render(lang)}
<h2>${L('Two import windows to investigate', 'Dua periode impor yang perlu ditelusuri')}</h2>
<ul>
<li>${L('<strong>February 2026, systems (847149):</strong> US$683.418 million, about 62.7% of the category’s January–July total. This is the first window to inspect for concentrated system deliveries.', '<strong>Februari 2026, sistem (847149):</strong> US$683,418 juta, sekitar 62,7% dari total kategori pada Januari–Juli. Ini menjadi periode pertama untuk memeriksa konsentrasi pengiriman sistem.')}</li>
<li>${L('<strong>May–July 2026, processing units (847150):</strong> US$654.453 million, US$852.058 million and US$661.632 million respectively. Together, US$2.168 billion, or about 76.1% of the seven-month total.', '<strong>Mei–Juli 2026, unit pemrosesan (847150):</strong> masing-masing US$654,453 juta, US$852,058 juta, dan US$661,632 juta. Gabungannya US$2,168 miliar, atau sekitar 76,1% dari total tujuh bulan.')}</li>
</ul>
<p>${L('Our interpretation is that these concentrated import windows merit checking for large infrastructure orders. Monthly totals cannot link the February systems to the later processing units, or assign either wave to H200, B300 or a shared destination. Price changes and the product mix can also move import values without an equivalent increase in machine counts.', 'Interpretasi kami adalah bahwa konsentrasi periode impor ini layak ditelusuri untuk pesanan infrastruktur besar. Total bulanan tidak dapat menghubungkan sistem Februari dengan unit pemrosesan bulan-bulan berikutnya, atau mengaitkan keduanya dengan H200, B300, maupun tujuan yang sama. Perubahan harga dan komposisi produk juga dapat mengubah nilai impor tanpa kenaikan jumlah mesin yang sebanding.')}</p>
${IMPORT_NOTE.render(lang)}
<h2>${L('From an import signal to an identified cluster', 'Dari sinyal impor menjadi klaster yang teridentifikasi')}</h2>
<ul>
<li>${L('<strong>Identify the hardware:</strong> shipment descriptions, manufacturer and OEM part numbers, quantities, declared values and Indonesia’s detailed tariff lines. Look for H200/B300 model evidence rather than inferring the model from a six-digit HS code.', '<strong>Identifikasi perangkat:</strong> deskripsi pengiriman, nomor komponen produsen dan OEM, jumlah, nilai yang dilaporkan, serta pos tarif rinci Indonesia. Cari bukti model H200/B300, bukan menyimpulkan model dari kode HS enam digit.')}</li>
<li>${L('<strong>Connect the deliveries:</strong> match importers, consignees, dates, purchase orders and destination sites. An importer may be a distributor rather than the eventual cluster operator. Link servers to networking and storage without counting embedded components twice.', '<strong>Hubungkan pengiriman:</strong> cocokkan pengimpor, penerima, tanggal, pesanan pembelian, dan lokasi tujuan. Pengimpor dapat berupa distributor, bukan operator akhir klaster. Hubungkan server dengan jaringan dan penyimpanan tanpa menghitung komponen terpasang dua kali.')}</li>
<li>${L('<strong>Establish the use:</strong> installation and commissioning records, power and cooling provision, and operator disclosures of training or inference services. Customs value alone cannot establish an operational token factory, tokens per second, GPU utilization or revenue.', '<strong>Pastikan penggunaannya:</strong> catatan pemasangan dan pengoperasian, penyediaan daya dan pendinginan, serta pengungkapan operator tentang layanan pelatihan atau inferensi. Nilai kepabeanan saja tidak dapat memastikan pabrik token yang beroperasi, token per detik, utilisasi GPU, atau pendapatan.')}</li>
</ul>
<p>${L('The finding at this stage is a sharply concentrated computing-import signal, with two HS categories and two time windows that make a targeted H200/B300 investigation possible. Model attribution and confirmation of AI token-factory capacity remain open research questions.', 'Temuan pada tahap ini adalah sinyal impor komputasi yang sangat terkonsentrasi, dengan dua kategori HS dan dua periode yang memungkinkan penyelidikan H200/B300 secara terarah. Atribusi model dan konfirmasi kapasitas pabrik token AI masih menjadi pertanyaan riset terbuka.')}</p>
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
