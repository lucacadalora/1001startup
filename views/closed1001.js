'use strict';
/* 1001startup.id — the shutdown register.
 *
 * A census that only lists the living overstates the ecosystem twice: it loses
 * the failures, and it quietly keeps counting companies that stopped years ago.
 * This page is the other half of the ledger. Two records, kept apart because
 * their provenance differs:
 *
 *   1. THE REGISTER — Indonesian startups that closed, went bankrupt, were
 *      wound up, or were acquired and switched off. Researched and sourced;
 *      every row carries at least one link and a stated confidence.
 *   2. TAKEN OUT — companies that were in the live table and were removed by
 *      the liveness screen. That is our own audit trail, not the ecosystem's,
 *      and it stays visible so a deletion can be checked or reversed.
 *
 * Nothing here is estimated. A company with no credible source does not appear.
 * Row-level prose (why, reasons, notes) is census data and stays as written;
 * the page frame translates via lang.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001'); // one header for every 1001 page
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';
const fmt = (n) => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US');

const FATE = {
  closed: { label: 'Closed', id: 'Tutup', blurb: 'ceased operations', id_blurb: 'berhenti beroperasi' },
  bankrupt: { label: 'Bankrupt', id: 'Pailit', blurb: 'declared pailit / insolvent', id_blurb: 'dinyatakan pailit / insolven' },
  liquidated: { label: 'Liquidated', id: 'Dilikuidasi', blurb: 'wound up, assets dispersed', id_blurb: 'dibubarkan, aset dibagikan' },
  'acquired-then-closed': { label: 'Acquired, then shut', id: 'Diakuisisi, lalu ditutup', blurb: 'bought, then the service was switched off', id_blurb: 'dibeli, lalu layanannya dimatikan' },
  dormant: { label: 'Dormant', id: 'Dorman', blurb: 'no longer trading, not formally wound up', id_blurb: 'tidak lagi beroperasi, belum resmi dibubarkan' },
};
const FATE_ORDER = ['closed', 'bankrupt', 'liquidated', 'acquired-then-closed', 'dormant'];

const CONF = {
  confirmed: ['Confirmed — primary source or the company’s own notice',
    'Terkonfirmasi — sumber primer atau pemberitahuan perusahaannya sendiri'],
  reported: ['Reported — credible press, not confirmed by the company',
    'Dilaporkan — pers kredibel, belum dikonfirmasi perusahaannya'],
  uncertain: ['Uncertain — listed with the doubt stated',
    'Belum pasti — dicantumkan dengan keraguan dinyatakan'],
};

const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
const year = (d) => String(d || '').slice(0, 4);

/* One page per closed company at /company/<slug> (RankMySEO report, 5 Oct
   2026: "efishery" alone is ~9,900 searches a month and /company/efishery was a
   404). The slug drops a parenthetical ("Lummo (BukuKas)" -> lummo); a live
   census id always wins over a closed slug, so nothing live is shadowed. */
function slugClosed(name) {
  return String(name || '').replace(/\([^)]*\)/g, ' ').toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function findClosed(register, slug, liveIds) {
  if (!slug || (liveIds && liveIds.has(slug))) return null;
  return ((register && register.entries) || []).find((e) => slugClosed(e.name) === slug) || null;
}
function closedSlugs(register, liveIds) {
  return ((register && register.entries) || []).map((e) => slugClosed(e.name))
    .filter((s) => s && !(liveIds && liveIds.has(s)));
}

function row(c, L, PF = '') {
  const f = FATE[c.fate] || FATE.closed;
  return `<tr data-fate="${esc(c.fate || '')}" data-f="${esc([c.name, c.sector, c.city, f.label].filter(Boolean).join(' ').toLowerCase())}">
    <td><a class="nm" href="${PF}/company/${esc(slugClosed(c.name))}"><b>${esc(c.name)}</b></a>${c.confidence && c.confidence !== 'confirmed'
      ? `<span class="cf ${esc(c.confidence)}" title="${esc(L((CONF[c.confidence] || ['', ''])[0], (CONF[c.confidence] || ['', ''])[1]))}">${esc(L(c.confidence, { reported: 'dilaporkan', uncertain: 'belum pasti' }[c.confidence]))}</span>` : ''}</td>
    <td class="mu">${esc(c.sector || '—')}</td>
    <td class="mu">${esc(c.city || '—')}</td>
    <td class="n mono">${esc(year(c.founded) || '—')}</td>
    <td class="n mono">${esc(year(c.ended) || '—')}</td>
    <td><span class="fate f-${esc(c.fate || 'closed')}">${esc(L(f.label, f.id))}</span></td>
    <td class="n mono">${c.funding_usd_m === null || c.funding_usd_m === undefined ? '—' : fmt(c.funding_usd_m)}</td>
    <td class="wh">${esc(c.why || '')}
      ${(c.sources || []).length ? `<div class="srcs">${(c.sources || []).slice(0, 4).map((u) =>
        `<a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(host(u))}</a>`).join('')}</div>` : ''}</td>
  </tr>`;
}

function closed({ data, register, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const LV = (data && data.liveness) || {};
  const removed = LV.removed || [];
  const list = (register && register.entries) || [];

  const byFate = {};
  for (const c of list) byFate[c.fate] = (byFate[c.fate] || 0) + 1;
  const funded = list.filter((c) => typeof c.funding_usd_m === 'number');
  const capital = funded.reduce((a, c) => a + c.funding_usd_m, 0);
  const years = list.map((c) => +year(c.ended)).filter((y) => y >= 2000 && y <= 2100);
  const span = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : '—';

  const body = list.length ? `
  <section class="stats">
    ${[
      [fmt(list.length), L('companies no longer operating', 'perusahaan tidak lagi beroperasi')],
      [capital > 0 ? 'US$ ' + fmt(Math.round(capital)) + L(' M', ' juta') : '—',
        L(`disclosed funding behind ${funded.length} of them`, `pendanaan diumumkan di balik ${funded.length} di antaranya`)],
      [span, L('years covered', 'rentang tahun')],
      [fmt(removed.length), L('taken out of the live table', 'dikeluarkan dari tabel hidup')],
    ].map(([v, k]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}
  </section>

  <section class="wrap" id="register">
    <div class="eyebrow"><span class="sq"></span>${L('THE REGISTER', 'DAFTAR')}</div>
    <div class="toolbar">
      <input id="cq" type="search" placeholder="${L(`Search ${list.length} companies — name, sector, city…`, `Cari ${list.length} perusahaan — nama, sektor, kota…`)}" autocomplete="off">
      <div class="chips" id="cchips">
        <button class="chip on" data-fate="">${L('All', 'Semua')}</button>
        ${FATE_ORDER.filter((k) => byFate[k]).map((k) =>
          `<button class="chip" data-fate="${k}" title="${esc(L(FATE[k].blurb, FATE[k].id_blurb))}">${esc(L(FATE[k].label, FATE[k].id))} · ${byFate[k]}</button>`).join('')}
      </div>
      <div class="count mono" id="ccount">${list.length} ${L('shown', 'ditampilkan')}</div>
    </div>
    <div class="tablewrap"><table id="ctbl">
      <thead><tr><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th><th>${L('City', 'Kota')}</th><th class="n">${L('Founded', 'Berdiri')}</th><th class="n">${L('Ended', 'Berakhir')}</th>
        <th>${L('What happened', 'Apa yang terjadi')}</th><th class="n">${L('Raised US$M', 'Dana dihimpun (US$ juta)')}</th><th>${L('Why, and where it is written down', 'Alasan, dan di mana tertulis')}</th></tr></thead>
      <tbody>${list.map((c) => row(c, L, PF)).join('')}</tbody>
    </table></div>
    <div class="foot-note mono">${L('Sorted as compiled. "—" means no credible public figure — we do not invent one. A row marked <b>reported</b> or <b>uncertain</b> has not been confirmed by the company itself.',
      'Diurutkan sebagaimana disusun. "—" berarti tidak ada angka publik yang kredibel — kami tidak mengarangnya. Baris bertanda <b>dilaporkan</b> atau <b>belum pasti</b> belum dikonfirmasi oleh perusahaannya sendiri.')}</div>
  </section>` : `
  <section class="wrap">
    <div class="method"><p>${L('The register is being compiled. Entries appear here only once a shutdown has a date and a source that can be checked — nothing is listed on rumour.',
      'Register sedang disusun. Entri baru muncul di sini setelah sebuah penutupan punya tanggal dan sumber yang bisa dicek — tidak ada yang dicantumkan berdasarkan rumor.')}</p></div>
  </section>`;

  const removedSection = removed.length ? `
  <section class="wrap" id="removed">
    <div class="eyebrow"><span class="sq"></span>${L('TAKEN OUT OF THE LIVE TABLE', 'DIKELUARKAN DARI TABEL HIDUP')}</div>
    <p class="lede">${L('Our own audit trail, kept separate from the register above. These companies were counted in the census and were removed after a liveness screen — site reachable? domain parked? headcount collapsed? a shutdown, liquidation or licence revocation on the record? They are listed rather than quietly dropped, so a removal can be checked, argued with, or reversed if the company resurfaces.',
      'Jejak audit kami sendiri, dipisah dari daftar di atas. Perusahaan-perusahaan ini pernah terhitung di sensus dan dikeluarkan setelah dicek tak lagi beroperasi — situsnya masih bisa diakses? domainnya diparkir? jumlah pekerjanya anjlok? ada catatan penutupan, likuidasi, atau pencabutan izin? Semuanya tetap dicantumkan alih-alih dibuang diam-diam, supaya setiap penghapusan bisa dicek, dibantah, atau dipulihkan kalau perusahaannya muncul kembali.')}</p>
    <div class="tablewrap out"><table>
      <thead><tr><th>${L('Company', 'Perusahaan')}</th><th>${L('Removed', 'Dikeluarkan')}</th><th>${L('Why', 'Alasan')}</th></tr></thead>
      <tbody>${removed.map((r) => `<tr>
        <td><b>${esc(r.name)}</b></td>
        <td class="mu mono">${esc(r.removed || '')}</td>
        <td class="mu">${esc(r.reason || '')}${r.note ? ` <span class="dim">${esc(r.note)}</span>` : ''}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>` : '';

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L('No longer operating', 'Startup Indonesia yang Tutup')} — 1001startup.id</title>
<meta name="description" content="${L('The Indonesian startups that closed, went bankrupt, were wound up, or were acquired and switched off — with dates, causes and sources.',
    'Daftar startup Indonesia yang tutup, bangkrut (pailit), dilikuidasi, atau diakuisisi lalu dimatikan — lengkap dengan tanggal, sebab, dan sumbernya.')}">
<meta name="robots" content="index, follow">
${I18N.headTags(lang, '/closed')}
${SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('No longer operating', 'Startup Indonesia yang tutup'), path: '/closed' }])}
<meta property="og:title" content="${L('No longer operating', 'Startup Indonesia yang Tutup')} — 1001startup.id">
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
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${GRAD};color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
.hero{max-width:1180px;margin:0 auto;padding:56px 20px 44px;display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:start}
@media(max-width:880px){.hero{grid-template-columns:1fr;padding-top:36px}}
.hero h1{font-size:clamp(38px,5.2vw,66px);line-height:1.03;letter-spacing:-0.03em;font-weight:500}
.hero .sub{color:#52525B;font-size:16.5px;line-height:1.55;max-width:54ch}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.stats{max-width:1140px;width:calc(100% - 40px);margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.stats .cell{background:#fff;padding:22px 18px}
.stats .v{font-size:clamp(24px,2.7vw,36px);letter-spacing:-0.02em;font-weight:600}
.stats .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-top:6px}
.wrap{max-width:1180px;margin:0 auto;padding:54px 20px 0}
.toolbar{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}
#cq{width:100%;max-width:560px;padding:13px 16px;border:1px solid #000;font:500 15px/1 'Overused Grotesk',sans-serif;outline:none}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:7px 11px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
.chip.on{background:#000;color:#fff;border-color:#000}
.count{font-size:11px;color:#6B6B73}
.tablewrap{overflow-x:auto;border:1px solid #E7E7E7}
table{border-collapse:collapse;width:100%;min-width:1040px;font-size:13.5px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
td{padding:10px 12px;border-bottom:1px solid #F1F1F1;vertical-align:top}
td.n,th.n{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap}
td.mu{color:#52525B;font-size:12.5px}
td.wh{color:#52525B;font-size:13px;line-height:1.5;min-width:320px}
a.nm{text-decoration:none;border-bottom:1px solid #D9D9D9}
a.nm:hover{border-bottom-color:#000}
.srcs{margin-top:6px;display:flex;gap:8px;flex-wrap:wrap}
.srcs a{font:400 10px/1.4 'IBM Plex Mono',monospace;text-transform:lowercase;letter-spacing:.02em;color:#4E7A96;text-decoration:none;border-bottom:1px solid #D9E2E8}
.srcs a:hover{color:#000;border-color:#000}
.fate{display:inline-block;padding:2px 7px;border:1px solid #D9D9D9;font:400 10px/1.5 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.f-closed{border-color:#C4320A;color:#C4320A}
.f-bankrupt{border-color:#8A2B2B;color:#8A2B2B;background:#FBF3F3}
.f-liquidated{border-color:#8A5A83;color:#8A5A83}
.f-acquired-then-closed{border-color:#4E7A96;color:#4E7A96}
.f-dormant{border-color:#6B6B73;color:#6B6B73}
.cf{display:inline-block;margin-left:7px;padding:1px 5px;border:1px solid #D9D9D9;font:400 9px/1.5 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;color:#6B6B73}
.cf.uncertain{border-color:#B08A2E;color:#B08A2E}
.dim{color:#6B6B73}
.foot-note{font-size:11px;color:#6B6B73;margin-top:10px;text-transform:none;letter-spacing:0}
.lede{color:#52525B;font-size:14.5px;line-height:1.6;max-width:92ch;margin-bottom:16px}
.method{border:1px solid #E7E7E7;padding:22px}
.method p{color:#52525B;font-size:14.5px;line-height:1.6;max-width:88ch}
.method p + p{margin-top:10px}
.tablewrap.out table{min-width:820px}
.tablewrap.out td.mono{white-space:nowrap}
.tablewrap.out td:first-child{white-space:nowrap}
footer{max-width:1180px;margin:60px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
</style>
</head>
<body>
<div class="banner">${L('THE OTHER HALF OF THE LEDGER · EVERY ROW CARRIES A DATE AND A SOURCE', 'SISI LAIN DARI BUKU BESAR · SETIAP BARIS PUNYA TANGGAL DAN SUMBER')}</div>
${NAV.header('census', { lang, path: '/closed' })}
<section class="hero">
  <h1>${L('What stopped.', 'Yang berhenti.')}</h1>
  <div>
    <p class="sub">${L('A census that only counts the living flatters the ecosystem twice — it loses the failures, and it keeps counting companies that switched off years ago. This is the other side: the Indonesian startups that closed, went bankrupt, were wound up, or were bought and then quietly turned off. Dates and causes where they are on the record, a link for every claim, and nothing listed on rumour.',
      'Sensus yang hanya menghitung yang masih hidup melebih-lebihkan ekosistem dua kali — kisah gagalnya hilang dari catatan, dan perusahaan yang sudah lama mati ikut terus terhitung. Ini sisi satunya: startup Indonesia yang tutup, pailit, dilikuidasi, atau dibeli lalu dimatikan diam-diam. Tanggal dan sebabnya sejauh tercatat, satu tautan untuk setiap klaim, dan tidak ada yang masuk daftar hanya karena rumor.')}</p>
  </div>
</section>
${body}
${removedSection}
<section class="wrap" id="how">
  <div class="eyebrow"><span class="sq"></span>${L('WHAT COUNTS AS CLOSED', 'APA YANG DIHITUNG SEBAGAI TUTUP')}</div>
  <div class="method">
    <p>${L('A company belongs here once it has <b>stopped operating</b>. Being acquired is not enough on its own: Tokopedia, Gojek and Blibli all changed hands and all still trade, so none of them appear. What qualifies is the service actually going dark — a shutdown notice, a liquidation, a court bankruptcy (<i>pailit</i>), a revoked licence, or an acquisition after which the product was switched off.',
      'Sebuah perusahaan masuk ke sini setelah ia <b>berhenti beroperasi</b>. Diakuisisi saja tidak cukup: Tokopedia, Gojek, dan Blibli semua berpindah tangan dan semuanya masih beroperasi, jadi tidak satu pun muncul di sini. Yang memenuhi syarat adalah layanannya benar-benar padam — pengumuman penutupan, likuidasi, pailit lewat pengadilan, izin dicabut, atau akuisisi yang setelahnya produk dimatikan.')}</p>
    <p>${L('Each row is marked <b>confirmed</b> when the company or a primary record says so, <b>reported</b> when credible press says so and the company has not, and <b>uncertain</b> when the evidence is thin — in which case the doubt is printed rather than resolved by guessing. A company with no checkable source is not listed at all, and a shutdown that turns out to be wrong should be argued with: the sources are there to be followed.',
      'Setiap baris ditandai <b>terkonfirmasi</b> jika perusahaannya atau catatan primer menyatakannya, <b>dilaporkan</b> jika pers kredibel menyatakannya dan perusahaannya belum, dan <b>belum pasti</b> jika buktinya tipis — dan dalam hal itu keraguannya dicetak, bukan diselesaikan dengan menebak. Perusahaan tanpa sumber yang bisa dicek tidak dicantumkan sama sekali, dan penutupan yang ternyata keliru memang seharusnya dibantah: sumbernya ada untuk ditelusuri.')}</p>
  </div>
</section>
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="${PF}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · <a href="${PF}/">${L('Back to the living', 'Kembali ke yang hidup')}</a></span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/closed1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

/* "2025-11" -> "Nov 2025"; "2024" -> "2024"; "2023-12-14" -> "14 Dec 2023" */
function when(d, lang) {
  const m = String(d || '').match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return '';
  if (!m[2]) return m[1];
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +(m[3] || 1)));
  return dt.toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB',
    Object.assign({ month: 'short', year: 'numeric', timeZone: 'UTC' }, m[3] ? { day: 'numeric' } : {}));
}

function profile({ entry: e, register, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const f = FATE[e.fate] || FATE.closed;
  const slug = slugClosed(e.name);
  const path = '/company/' + slug;
  const ended = when(e.ended, lang);
  const yr = year(e.ended);
  const money = typeof e.funding_usd_m === 'number'
    ? (lang === 'id' ? `US$${fmt(e.funding_usd_m)} juta` : `US$${fmt(e.funding_usd_m)} million`) : '';
  const who = e.legal_name ? `${e.name} (${e.legal_name})` : e.name;
  /* the citable sentence: source, status, date — the same idiom as the live
     company pages, so an answer engine quoting it says where it came from */
  const fact = lang === 'id'
    ? `Menurut sensus 1001startup.id, ${who} ${f.id_blurb}${ended ? ` pada ${ended}` : ''}.`
      + `${e.founded ? ` Perusahaan ini berdiri pada ${year(e.founded)}` : ''}${e.founded && money ? ` dan mengumumkan pendanaan ${money}.` : e.founded ? '.' : money ? ` Pendanaan yang diumumkan: ${money}.` : ''}`
    : `According to the 1001startup.id census, ${who} ${f.blurb}${ended ? ` in ${ended}` : ''}.`
      + `${e.founded ? ` It was founded in ${year(e.founded)}` : ''}${e.founded && money ? ` and had disclosed ${money} in funding.` : e.founded ? '.' : money ? ` Disclosed funding: ${money}.` : ''}`;
  const conf = CONF[e.confidence] || CONF.confirmed;
  /* the quotable sentence carries the doubt too, not just the fact table */
  const qual = e.confidence === 'reported'
    ? L(' This is reported by credible press; the company has not confirmed it.', ' Ini dilaporkan pers kredibel; perusahaannya belum mengonfirmasi.')
    : e.confidence === 'uncertain'
      ? L(' The evidence is thin; the doubt is set out below.', ' Buktinya tipis; keraguannya dijelaskan di bawah.') : '';
  const facts = [
    [L('Status', 'Status'), `<span class="fate f-${esc(e.fate || 'closed')}">${esc(L(f.label, f.id))}</span> <span class="dim">${esc(L(f.blurb, f.id_blurb))}</span>`],
    [L('Ended', 'Berakhir'), esc(ended || '—')],
    [L('Founded', 'Berdiri'), esc(year(e.founded) || '—')],
    [L('Disclosed funding', 'Pendanaan diumumkan'), money ? esc(money) : '—'],
    [L('Sector', 'Sektor'), esc(e.sector || '—')],
    [L('City', 'Kota'), esc(e.city || '—')],
    [L('How sure we are', 'Seberapa pasti'), esc(L(conf[0], conf[1]))],
  ];
  const srcs = (e.sources || []).map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(host(u))}</a> <span class="dim">${esc(u.length > 90 ? u.slice(0, 90) + '…' : u)}</span></li>`).join('');
  const n = ((register && register.entries) || []).length;
  const title = SCHEMA.fitTitle(lang === 'id'
    ? [`${e.name}: ${f.id.toLowerCase()}${yr ? ` (${yr})` : ''} — apa yang terjadi — 1001startup.id`, `${e.name}: ${f.id.toLowerCase()}${yr ? ` (${yr})` : ''} — 1001startup.id`, `${e.name} — 1001startup.id`]
    : [`${e.name}: ${f.label.toLowerCase()}${yr ? ` in ${yr}` : ''} — what happened — 1001startup.id`, `${e.name}: ${f.label.toLowerCase()}${yr ? ` in ${yr}` : ''} — 1001startup.id`, `${e.name} — 1001startup.id`]);
  const desc = SCHEMA.fitDesc(lang === 'id'
    ? [`${e.name} ${f.id_blurb}${ended ? ` pada ${ended}` : ''}. Sektor, kota, pendanaan, apa yang terjadi, dan sumbernya — dari daftar startup Indonesia yang tutup di 1001startup.id.`,
      `${e.name} ${f.id_blurb}${ended ? ` pada ${ended}` : ''} — apa yang terjadi dan sumbernya, dari 1001startup.id.`]
    : [`${e.name} ${f.blurb}${ended ? ` in ${ended}` : ''}. Sector, city, funding, what happened and the sources — from the 1001startup.id register of Indonesian startups that closed.`,
      `${e.name} ${f.blurb}${ended ? ` in ${ended}` : ''} — what happened and the sources, from 1001startup.id.`]);
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: L('No longer operating', 'Startup Indonesia yang tutup'), path: '/closed' }, { name: e.name, path }];
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: e.name };
  if (e.legal_name) org.legalName = e.legal_name;
  if (e.founded) org.foundingDate = String(e.founded);
  if (e.ended) org.dissolutionDate = String(e.ended);
  if (e.city) org.location = { '@type': 'Place', name: e.city + ', Indonesia' };
  if ((e.sources || []).length) org.subjectOf = (e.sources || []).slice(0, 6);
  const ld = `<script type="application/ld+json">${JSON.stringify(org).replace(/</g, '\\u003c')}</script>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
${I18N.headTags(lang, path)}
${SCHEMA.breadcrumbLd(lang, crumb)}
${ld}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
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
.wrap{max-width:880px;margin:0 auto;padding:40px 20px 0}
.crumb{font:400 11px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-bottom:22px}
.crumb a{text-decoration:none;border-bottom:1px solid #D9D9D9;color:#52525B}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
h1{font-size:clamp(36px,5vw,58px);line-height:1.04;letter-spacing:-0.03em;font-weight:500}
.legal{font:400 12px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-top:8px}
.fact{font-size:17px;line-height:1.55;margin-top:20px;max-width:64ch}
dl{display:grid;grid-template-columns:200px 1fr;border:1px solid #E7E7E7;margin-top:28px}
dt,dd{padding:11px 14px;border-bottom:1px solid #F1F1F1;font-size:14px}
dt{font:400 10.5px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;background:#FAFAFA}
@media(max-width:560px){dl{grid-template-columns:1fr}dt{border-bottom:0;padding-bottom:2px}dd{padding-top:2px}}
h2{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;margin:36px 0 12px;display:flex;align-items:center;gap:8px}
h2:before{content:'';width:6px;height:6px;background:#000;display:inline-block}
.why{color:#27272A;font-size:15.5px;line-height:1.65;max-width:70ch}
.srcl{list-style:none;display:flex;flex-direction:column;gap:7px}
.srcl a{font:400 12px/1.4 'IBM Plex Mono',monospace;color:#4E7A96;text-decoration:none;border-bottom:1px solid #D9E2E8}
.srcl .dim{font-size:12px;word-break:break-all}
.dim{color:#6B6B73}
.fate{display:inline-block;padding:2px 7px;border:1px solid #D9D9D9;font:400 10px/1.5 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.f-closed{border-color:#C4320A;color:#C4320A}
.f-bankrupt{border-color:#8A2B2B;color:#8A2B2B;background:#FBF3F3}
.f-liquidated{border-color:#8A5A83;color:#8A5A83}
.f-acquired-then-closed{border-color:#4E7A96;color:#4E7A96}
.f-dormant{border-color:#6B6B73;color:#6B6B73}
.cta{display:flex;gap:10px;margin-top:30px;flex-wrap:wrap}
.btn{display:inline-block;padding:12px 18px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;border:1px solid #000;background:#fff;color:#000}
.btn.primary{background:#000;color:#fff}
.note{font-size:12px;color:#6B6B73;margin-top:10px;max-width:70ch}
footer{max-width:880px;margin:60px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
</style>
</head>
<body>
<div class="banner">${L('THE OTHER HALF OF THE LEDGER · EVERY ROW CARRIES A DATE AND A SOURCE', 'SISI LAIN DARI BUKU BESAR · SETIAP BARIS PUNYA TANGGAL DAN SUMBER')}</div>
${NAV.header('census', { lang, path })}
<main class="wrap">
  <nav class="crumb"><a href="${PF}/">1001startup.id</a> / <a href="${PF}/closed">${L('No longer operating', 'Sudah tutup')}</a> / ${esc(e.name)}</nav>
  <div class="eyebrow"><span class="sq"></span>${L('NO LONGER OPERATING', 'TIDAK LAGI BEROPERASI')} · ${esc(L(f.label, f.id).toUpperCase())}</div>
  <h1>${esc(e.name)}</h1>
  ${e.legal_name ? `<div class="legal">${esc(e.legal_name)}</div>` : ''}
  <p class="fact">${esc(fact + qual)}</p>
  <dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
  <h2>${L('What happened', 'Apa yang terjadi')}</h2>
  <p class="why">${esc(e.why || '')}</p>
  ${lang === 'id' ? `<p class="note">Ringkasan ini ditulis dalam bahasa Inggris, sebagaimana tercatat di daftar.</p>` : ''}
  ${srcs ? `<h2>${L('Where it is written down', 'Di mana tertulis')}</h2><ul class="srcl">${srcs}</ul>` : ''}
  <div class="cta">
    <a class="btn primary" href="${PF}/closed#register">${L(`All ${n} companies that stopped`, `Semua ${n} perusahaan yang berhenti`)}</a>
    <a class="btn" href="${NAV.censusHome(PF)}">${L('The living census', 'Sensus yang masih hidup')}</a>
  </div>
</main>
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="${PF}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a></span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { closed, profile, findClosed, closedSlugs, slugClosed };
