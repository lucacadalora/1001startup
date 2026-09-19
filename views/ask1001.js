'use strict';
/* 1001startup.id — /ask: the census agent, on its own page.
 *
 * The same agent as the floating launcher, inline. It is grounded three ways:
 * indexed census pages (cited with links), live /api/census lookups for any
 * figure, and the census knowledge memory (memori.vantis.sh space `census`)
 * for method / scope / removal history. The page frame translates via lang;
 * the widget itself localizes on the visitor's browser language.
 */
const { V } = require('./html');
const NAV = require('./nav1001'); // one header for every 1001 page
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';
const AGENT_KEY = 'vs_pk_1001startup_e904015da4897b8e'; // public widget key by design

function page(opts) {
  const { lang = 'en' } = opts || {};
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L('Ask the census', 'Tanya sensus')} — 1001startup.id</title>
<meta name="description" content="${L('Ask about any company in the Indonesian startup census — funding, valuation, headcount, sectors, and how every number is made. Answers carry citations.',
    'Tanya apa saja tentang perusahaan di sensus startup Indonesia — pendanaan, valuasi, jumlah karyawan, sektor, dan cara setiap angka dihitung. Jawaban selalu menyertakan sumber.')}">
<meta name="robots" content="index, follow">
${I18N.headTags(lang, '/ask')}
${SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('Ask the census', 'Tanya sensus'), path: '/ask' }])}
<meta property="og:title" content="${L('Ask the census', 'Tanya sensus')} — 1001startup.id">
${I18N.ogImage()}
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.banner{background:${GRAD};color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
.hero{max-width:1180px;margin:0 auto;padding:52px 20px 34px}
.hero h1{font-size:clamp(38px,5.2vw,64px);line-height:1.03;letter-spacing:-0.03em;font-weight:500}
.hero .sub{color:#52525B;font-size:16.5px;line-height:1.55;max-width:62ch;margin-top:14px}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px 56px}
.chatgrid{display:grid;grid-template-columns:1.25fr .75fr;gap:28px;align-items:start}
@media(max-width:920px){.chatgrid{grid-template-columns:1fr}}
.chatbox{border:1px solid #000;height:min(680px,78vh);min-height:440px}
.chatbox>div{height:100%}
.side{display:flex;flex-direction:column;gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.side .cell{background:#fff;padding:18px}
.side h3{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-bottom:8px}
.side p{color:#52525B;font-size:13.5px;line-height:1.55}
.side p a{color:#4E7A96;text-decoration:none;border-bottom:1px solid #D9E2E8}
.side p a:hover{color:#000;border-color:#000}
footer{max-width:1180px;margin:24px auto 0;padding:18px 20px 28px;border-top:1px solid #E7E7E7;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:12px;color:#6B6B73}
footer a{color:#4E7A96;text-decoration:none}
/* consent banner must sit above the chat widget's pinned z-index */
.vs-cc{z-index:2147483200}
</style>
</head>
<body>
<div class="banner">${L('EVERY ANSWER CARRIES ITS SOURCES · FIGURES COME FROM THE LIVE CENSUS', 'SETIAP JAWABAN MENYERTAKAN SUMBERNYA · ANGKA DIAMBIL DARI SENSUS LANGSUNG')}</div>
${NAV.header('agents', { lang, path: '/ask' })}
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>${L('THE CENSUS AGENT', 'AGEN SENSUS')}</div>
  <h1>${L('Ask the census.', 'Tanya sensus.')}</h1>
  <p class="sub">${L('Any company, any figure, any rule — funding, valuation, headcount, sectors, why a company was removed, how the output estimate works. The agent reads the same census the site publishes, looks figures up live, and links what it cites. When it does not know, it says so.',
    'Perusahaan apa pun, angka apa pun, aturan apa pun — pendanaan, valuasi, jumlah karyawan, sektor, alasan sebuah perusahaan dikeluarkan, cara estimasi output dihitung. Agen ini membaca sensus yang sama dengan yang dipublikasikan situs, mengambil angka secara langsung, dan menautkan sumber yang dikutipnya. Kalau tidak tahu, ia bilang tidak tahu.')}</p>
</section>
<section class="wrap">
  <div class="chatgrid">
    <div class="chatbox"><div id="census-chat"></div></div>
    <aside class="side">
      <div class="cell">
        <h3>${L('LIVE FIGURES', 'ANGKA LANGSUNG')}</h3>
        <p>${L('Company numbers are fetched from the census at answer time, not from a stale index — the same figures as each', 'Angka perusahaan diambil dari sensus saat menjawab, bukan dari indeks usang — angka yang sama dengan tiap')} <a href="${PF}/">${L('company page', 'halaman perusahaan')}</a>.</p>
      </div>
      <div class="cell">
        <h3>${L('METHOD AND HISTORY', 'METODE DAN RIWAYAT')}</h3>
        <p>${L('Questions about scope, the model, or why a row was taken out are answered from the census knowledge memory — the same registers as', 'Pertanyaan soal cakupan, model, atau alasan sebuah baris dikeluarkan dijawab dari memori pengetahuan sensus — register yang sama dengan')} <a href="${PF}/model">/model</a> ${L('and', 'dan')} <a href="${PF}/closed#removed">/closed</a>.</p>
      </div>
      <div class="cell">
        <h3>${L('WHAT IT WILL NOT DO', 'YANG TIDAK DILAKUKANNYA')}</h3>
        <p>${L('No investment advice, no predictions, no invented figures. A missing number is reported as missing — a dash is not a zero.', 'Tidak ada saran investasi, tidak ada prediksi, tidak ada angka karangan. Angka yang tidak ada dilaporkan tidak ada — tanda strip bukan nol.')}</p>
      </div>
    </aside>
  </div>
</section>
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="${PF}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · <a href="${PF}/">${L('Back to the table', 'Kembali ke tabel')}</a></span>
</footer>
<script src="https://support.vantis.sh/widget.js" data-agent-key="${AGENT_KEY}" data-mode="inline" data-target="#census-chat" data-accent="#E8734B" defer></script>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { page };
