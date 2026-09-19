'use strict';
/* The public traffic page, and the badge that links to it.
 *
 * Both hosts render the same body from the same payload — 1001startup gets its
 * own shell because it is its own brand, not a PASAR sub-page, but the numbers
 * and their wording are built once here so the two can never disagree.
 *
 * LANGUAGE: stats1001 takes lang ('en'|'id') and threads it through body();
 * every helper defaults to 'en', so statsPasar — which never passes lang —
 * renders byte-for-byte what it always did. The Indonesian page lives at
 * /id/stats with the usual hreflang pair (see views/i18n1001.js).
 */
const { esc } = require('../lib/util');
const { page, V } = require('./html');
const NAV1001 = require('./nav1001'); // one header for every 1001 page
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

const RANGE_LABELS = [
  ['24h', '24 hours', '24 jam'], ['7d', '7 days', '7 hari'], ['30d', '30 days', '30 hari'], ['all', 'All time', 'Sepanjang waktu'],
];
/* Snapping the window to a whole bucket makes the bars sum to the cells, at the
 * cost of the window being the stated range plus however much of the current
 * hour or day has elapsed. Say "past 24 hours" rather than claim an exactness
 * the number does not have. */
const RANGE_WORD = { '24h': 'past 24 hours', '7d': 'past 7 days', '30d': 'past 30 days', all: 'all time' };
const RANGE_WORD_ID = { '24h': '24 jam terakhir', '7d': '7 hari terakhir', '30d': '30 hari terakhir', all: 'sepanjang waktu' };

const CHANNEL_LABEL = {
  direct: 'Direct', search: 'Search', social: 'Social', referral: 'Referral',
  email: 'Email', campaign: 'Campaign',
};
const CHANNEL_LABEL_ID = {
  direct: 'Langsung', search: 'Pencarian', social: 'Media sosial', referral: 'Rujukan',
  email: 'Email', campaign: 'Kampanye',
};
const DEVICE_LABEL_ID = { desktop: 'Desktop', mobile: 'Ponsel', tablet: 'Tablet' };
const devEn = (k) => k.charAt(0).toUpperCase() + k.slice(1);

/* ── the badge ─────────────────────────────────────────────────────────────
 * Server-rendered with the real numbers so it never flashes a placeholder,
 * then kept live by /js/px.js. Both figures are exact: "online" is distinct
 * visitors seen in the last five minutes, "views" is every page served.     */
function badge({ online = 0, views = 0 } = {}, { map = false, pfx = '' } = {}) {
  const idle = online < 1;
  return `<a class="px px-badge${map ? ' px-map' : ''}" href="${pfx}/stats" data-px-badge title="Live traffic on this site">
  <span class="px-dot${idle ? ' px-idle' : ''}"></span><span><b data-px-online>${fmt(online)}</b> online</span>
  <span class="px-sep"></span><span><b data-px-views>${fmt(views)}</b> views</span>
  <span class="px-sep"></span><span class="px-go">Stats &rarr;</span>
</a>`;
}

/* ── chart ─────────────────────────────────────────────────────────────── */
const W = 960, H = 280, PADL = 46, PADR = 10, PADT = 14, PADB = 28;

function bucketLabel(b, unit, lang = 'en') {
  if (unit === 'hour') return `${b.slice(11, 13)}:00`;
  const d = new Date(b + 'T00:00:00Z');
  const m = d.toLocaleString(lang === 'id' ? 'id-ID' : 'en-US', { month: 'short', timeZone: 'UTC' });
  /* Indonesian puts the day first: "5 Agu", not "Agu 5". */
  return lang === 'id' ? `${d.getUTCDate()} ${m}` : `${m} ${d.getUTCDate()}`;
}

function chart(series, unit, lang = 'en') {
  const L = I18N.mkL(lang);
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => s.views));
  const x0 = PADL, x1 = W - PADR, y0 = PADT, y1 = H - PADB;
  const px = (i) => (n <= 1 ? x0 : x0 + (i * (x1 - x0)) / (n - 1));
  const py = (v) => y1 - (v / max) * (y1 - y0);

  const line = (key) => series.map((s, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(s[key]).toFixed(1)}`).join('');
  const area = `${line('views')}L${px(n - 1).toFixed(1)},${y1}L${px(0).toFixed(1)},${y1}Z`;

  const ticks = [0, max / 2, max].map((v) => ({ v, y: py(v) }));
  const every = Math.max(1, Math.ceil(n / (unit === 'hour' ? 8 : 7)));
  const peak = series.reduce((a, s, i) => (s.views > series[a].views ? i : a), 0);

  return `<div class="px-chart">
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${L(`Page views per ${unit}`, `Tayangan halaman per ${unit === 'hour' ? 'jam' : 'hari'}`)}">
    <defs><linearGradient id="pxg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#4E7A96" stop-opacity=".22"/>
      <stop offset="100%" stop-color="#4E7A96" stop-opacity="0"/>
    </linearGradient></defs>
    ${ticks.map((t) => `<line class="gl" x1="${x0}" y1="${t.y.toFixed(1)}" x2="${x1}" y2="${t.y.toFixed(1)}"/>
    <text class="ax" x="${x0 - 8}" y="${(t.y + 3.5).toFixed(1)}" text-anchor="end">${fmt(Math.round(t.v))}</text>`).join('')}
    <path d="${area}" fill="url(#pxg)"/>
    <path class="ln" d="${line('views')}"/>
    <path class="ln2" d="${line('visitors')}"/>
    ${max > 1 ? `<circle class="pk" cx="${px(peak).toFixed(1)}" cy="${py(series[peak].views).toFixed(1)}" r="3"/>` : ''}
    ${series.map((s, i) => (i % every === 0 || i === n - 1
      ? `<text class="ax" x="${px(i).toFixed(1)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(bucketLabel(s.b, unit, lang))}</text>`
      : '')).join('')}
  </svg>
  <div class="px-legend"><span class="a"><i></i>${L('Page views', 'Tayangan halaman')}</span><span class="b"><i></i>${L('Visitors', 'Pengunjung')}</span></div>
</div>`;
}

/* ── breakdown card ────────────────────────────────────────────────────── */
function bars(title, rows, { mono = false, label = (k) => k, empty = 'Nothing recorded in this range yet.' } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return `<div class="px-card"><h3>${esc(title)}</h3>
  ${rows.length ? `<div class="px-bars">${rows.map((r) => `
    <div class="px-bar"><span class="fill" style="width:${((r.n / max) * 100).toFixed(1)}%"></span>
      <span class="lb">${mono ? `<code>${esc(label(r.k))}</code>` : esc(label(r.k))}</span>
      <span class="nm">${fmt(r.n)}</span></div>`).join('')}</div>`
    : `<div class="px-empty">${empty}</div>`}
</div>`;
}

/* Intl knows every ISO-3166 code; a hand-kept list silently leaves whichever
 * countries we did not think of showing as bare two-letter codes. */
let REGIONS = null, REGIONS_ID = null;
try { REGIONS = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { /* no ICU */ }
try { REGIONS_ID = new Intl.DisplayNames(['id'], { type: 'region' }); } catch { /* no ICU */ }
function countryName(code, lang) {
  const R = (lang === 'id' && REGIONS_ID) || REGIONS;
  if (!code || code === '??' || code === 'XX') return lang === 'id' ? 'Tidak diketahui' : 'Unknown';
  try { return (R && R.of(code)) || code; } catch { return code; }
}

/* ── the page body ─────────────────────────────────────────────────────── */
function body(d, { brand, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const since = new Date(d.since).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
  const word = L(RANGE_WORD[d.range] || RANGE_WORD['24h'], RANGE_WORD_ID[d.range] || RANGE_WORD_ID['24h']);
  const anyData = d.total.views > 0;
  const degraded = !!d.degraded;
  const EMPTY = L('Nothing recorded in this range yet.', 'Belum ada yang tercatat dalam rentang ini.');

  return `<div class="px px-wrap">
  <div class="px-eyebrow"><span class="sq"></span>${L('LIVE TRAFFIC', 'STATISTIK PENGUNJUNG')} · ${esc(d.host)}</div>
  <h1 class="px-h1">${L('Who is here, right now.', 'Siapa yang ada di sini, sekarang.')}</h1>
  <p class="px-lede">${L(`Every page ${esc(brand)} serves is counted on the server the moment it is sent — no cookie,
  no device storage, nothing to accept or reject. That makes this the complete number rather than the
  fraction that survives an ad blocker. It is the same count the live badge elsewhere on the site reads from.`,
    `Setiap halaman yang disajikan ${esc(brand)} dihitung di server begitu halaman itu dikirim — tanpa cookie,
  tanpa menyimpan apa pun di perangkat, tidak ada yang perlu disetujui atau ditolak. Hasilnya angka yang utuh,
  bukan sebagian yang lolos dari pemblokir iklan. Badge live di halaman lain situs ini membaca hitungan yang sama.`)}</p>

  <div class="px-live-row">
    <div class="px-live-now">
      <div class="px-live-n" id="px-live-n">${fmt(d.online)}</div>
      <div class="px-live-k"><span class="px-dot${degraded || d.online < 1 ? ' px-idle' : ''}" id="px-live-dot"></span>${degraded ? L('count unavailable', 'hitungan tidak tersedia') : L('reading this right now', 'sedang membaca saat ini')}</div>
    </div>
    <div class="px-live-pages">
      <h3>${L('What they have open', 'Yang sedang mereka buka')}</h3>
      <div class="px-live-list" id="px-live-list">${d.livePages.length
        ? d.livePages.map((p) => `<div class="r"><code>${esc(p.k || '/')}</code><b>${fmt(p.n)}</b></div>`).join('')
        : `<div class="px-empty">${L('Nobody on the site in the last five minutes.', 'Tidak ada seorang pun di situs dalam lima menit terakhir.')}</div>`}</div>
    </div>
  </div>

  <div class="px-cells">
    <div class="c"><div class="v">${fmt(d.window.views)}</div><div class="k">${L('Page views', 'Tayangan halaman')} · ${esc(word)}</div></div>
    <div class="c"><div class="v">${fmt(d.window.visitors)}</div><div class="k">${L('Visitors', 'Pengunjung')} · ${esc(word)}</div></div>
    <div class="c"><div class="v" id="px-total-views">${fmt(d.total.views)}</div><div class="k">${L('Page views', 'Tayangan halaman')} · ${L('since', 'sejak')} ${esc(since)}</div></div>
    <div class="c"><div class="v">${fmt(d.total.visitors)}</div><div class="k">${L('Visitor-days · all time', 'Hari-pengunjung · sepanjang waktu')}</div></div>
  </div>

  <div class="px-ranges">
    ${RANGE_LABELS.map(([k, l, lid]) => `<a href="${PF}/stats?range=${k}"${d.range === k ? ' class="on"' : ''}>${L(l, lid)}</a>`).join('')}
  </div>

  ${chart(d.series, d.unit, lang)}

  <div class="px-grid">
    ${bars(L('Most-read pages', 'Halaman paling banyak dibaca'), d.pages, { mono: true, label: (k) => k || '/', empty: EMPTY })}
    ${bars(L('Where they came from', 'Dari mana mereka datang'), d.referrers, { mono: true, empty: EMPTY })}
  </div>
  <div class="px-grid">
    ${bars(L('Channel', 'Kanal'), d.channels, { label: (k) => L(CHANNEL_LABEL[k] || k, CHANNEL_LABEL_ID[k] || CHANNEL_LABEL[k] || k), empty: EMPTY })}
    ${bars(L('Country', 'Negara'), d.countries, { label: (k) => countryName(k, lang), empty: EMPTY })}
    ${bars(L('Device', 'Perangkat'), d.devices, { label: (k) => L(devEn(k), DEVICE_LABEL_ID[k] || devEn(k)), empty: EMPTY })}
  </div>

  <div class="px-note">
    <p><b>${L('How these numbers are made.', 'Cara angka ini dihitung.')}</b> ${L(`A page view is one HTML page sent to a browser. A visitor is one
    network address and browser on one day, identified by a salted hash of the two. The salt is new each
    day and yesterday's is destroyed, so the same person is counted once within a day and cannot be
    followed from one day to the next; the address itself is never stored. Two people behind one office or
    mobile-carrier connection using the same browser therefore count as one. Known crawlers, monitors and
    this server's own checks are excluded before anything is counted.`,
    `Satu tayangan halaman adalah satu halaman HTML yang terkirim ke browser. Satu pengunjung adalah satu
    alamat jaringan dan satu browser pada satu hari, dikenali lewat hash dari keduanya, dengan salt. Salt itu
    dibuat baru setiap hari dan salt kemarin dimusnahkan, jadi orang yang sama dihitung sekali dalam sehari
    dan tidak bisa diikuti dari satu hari ke hari berikutnya; alamatnya sendiri tidak pernah disimpan. Karena
    itu, dua orang di balik satu koneksi kantor atau operator seluler yang memakai browser yang sama terhitung
    sebagai satu. Crawler yang dikenal, alat pemantau, dan pengecekan server ini sendiri dikecualikan sebelum
    apa pun dihitung.`)}</p>
    <ul class="px-defs">
      <li><b>${L('Online', 'Sedang online')}</b> — ${L('distinct visitors seen in the last five minutes.', 'pengunjung unik yang terlihat dalam lima menit terakhir.')}</li>
      <li><b>${L('Visitors', 'Pengunjung')}</b> ${L(`is counted per day, so any window that crosses midnight WIB — including the rolling
      24-hour one — counts a returning reader once per day they appear. That is why every all-time headline
      here is <b>page views</b>, which needs no such footnote.`,
    `dihitung per hari, jadi rentang yang melewati tengah malam WIB — termasuk rentang
      24 jam berjalan — menghitung pembaca yang kembali satu kali untuk setiap hari ia muncul. Itu sebabnya
      semua angka utama sepanjang waktu di halaman ini memakai <b>tayangan halaman</b>, yang tidak butuh
      catatan kaki semacam ini.`)}</li>
      <li><b>${L('Country', 'Negara')}</b> ${L('comes from the edge network, at country level only.', 'dibaca dari jaringan edge, hanya sampai tingkat negara.')}</li>
    </ul>
    ${degraded
      ? `<p><b>${L('These numbers are unavailable right now.', 'Angka-angka ini sedang tidak tersedia.')}</b> ${L('The counter could not be read for this request, so the figures above are placeholders, not measurements — they do not mean the site is empty. Reload in a moment.', 'Penghitung tidak bisa dibaca untuk permintaan ini, jadi angka di atas hanya placeholder, bukan hasil pengukuran — bukan berarti situs sedang kosong. Muat ulang beberapa saat lagi.')}</p>`
      : anyData ? '' : `<p>${L('Counting started today. This page fills in as people arrive — nothing is back-filled or estimated.', 'Penghitungan baru dimulai hari ini. Halaman ini akan terisi seiring orang berdatangan — tidak ada yang diisi mundur atau diperkirakan.')}</p>`}
  </div>
  <div class="px-foot">${L('Counting since', 'Menghitung sejak')} ${esc(since)} · ${L('times shown in WIB (UTC+7) · updated live', 'waktu ditampilkan dalam WIB (UTC+7) · diperbarui langsung')}</div>
</div>`;
}

/* ── shells ────────────────────────────────────────────────────────────── */
function statsPasar({ data, authed }) {
  return page({
    title: 'Traffic', path: '/stats', authed,
    desc: 'Live traffic on PASAR — who is reading it right now, and where they came from.',
    body: body(data, { brand: 'PASAR' }),
    css: ['/css/px.css'],
    scripts: [{ src: '/js/px-stats.js' }],
  });
}

function stats1001({ data, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang); // shell idiom; no internal 1001 links up here yet — body() prefixes its own
  const b = body(data, { brand: '1001startup.id', lang });
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L('Live traffic — 1001startup.id', 'Statistik pengunjung — 1001startup.id')}</title>
<meta name="description" content="${L('Live traffic on 1001startup.id — who is reading the startup census right now, and where they came from.',
    'Statistik pengunjung 1001startup.id — tayangan halaman, pengunjung, dan halaman yang sedang dibaca, terbuka untuk publik.')}">
${I18N.headTags(lang, '/stats')}
${SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('Live traffic', 'Statistik pengunjung'), path: '/stats' }])}
<meta property="og:title" content="${L('Live traffic', 'Statistik pengunjung')} — 1001startup.id">
${I18N.ogImage()}
<meta name="robots" content="index, follow">
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
${NAV1001.css}
footer{max-width:1180px;margin:0 auto;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
</style>
</head>
<body>
<div class="banner">${L('LIVE TRAFFIC · COUNTED ON THE SERVER · NO COOKIES, NOTHING TO ACCEPT', 'STATISTIK PENGUNJUNG · DIHITUNG DI SERVER · TANPA COOKIE, TIDAK ADA YANG PERLU DISETUJUI')}</div>
${NAV1001.header('', { lang, path: '/stats', translated: true })}
${b}
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span>${L('Traffic counted first-party', 'Statistik dihitung pihak pertama')} · ${L('no cookies', 'tanpa cookie')} · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a></span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/js/px-stats.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { badge, statsPasar, stats1001, body };
