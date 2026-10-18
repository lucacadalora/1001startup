'use strict';
/* 1001startup.id — the investor layer (Luca, Aug 30 2026: "we need to have
 * venture capitalist details and their investment, we want to be like
 * crunchbase").
 *
 *   /investors        — every investor named on a census row, ranked by how
 *                       many census companies they back.
 *   /investor/<slug>  — one investor: details where a curated entry exists
 *                       (data/investors.json, single-writer side file seeded
 *                       by the per-VC passes — Init-6 first), plus the fund's
 *                       census portfolio and, where a pass produced one, the
 *                       roster names deliberately NOT in the census.
 *
 * Everything derives from census.json per request (the /model discipline —
 * numbers can never drift from the data). The investor GRAPH is built from
 * each row's investors[] strings: a trailing parenthetical is a round note
 * ('AC Ventures (co-lead Series A)'), stripped for grouping and kept as the
 * row's role. Slugs are kebab-case of the cleaned name; case-insensitive
 * grouping, display = the most common spelling.
 *
 * HONESTY RULE for the money column: summing funding_total_usd_m over an
 * investor's portfolio measures what those COMPANIES disclosed raising in
 * total — not what this fund deployed (a US$100M row with ten backers would
 * count in full for each). Every surface that shows the sum says so.
 *
 * LANGUAGE: the page frame translates (L(en, id) inline, /id/<path> URLs);
 * what comes out of census.json and data/investors.json (fund blurbs, round
 * notes, outside reasons, sector labels) is the sourced working record,
 * quoted as written.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';
const DETAILS_FILE = path.join(__dirname, '..', 'data', 'investors.json');

/* ------------------------------------------------------------------ data */

function details() {
  try { return JSON.parse(fs.readFileSync(DETAILS_FILE, 'utf8')); } catch { return {}; }
}

function parseInv(s) {
  const raw = String(s || '').trim();
  const m = raw.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  return m ? { name: m[1].trim(), role: m[2].trim() } : { name: raw, role: null };
}

function slugInv(name) {
  return String(name || '').toLowerCase().normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x';
}

function graph(data) {
  const by = new Map(); // slug -> entry
  for (const c of (data && data.companies) || []) {
    for (const s of c.investors || []) {
      const { name, role } = parseInv(s);
      if (!name) continue;
      const slug = slugInv(name);
      let e = by.get(slug);
      if (!e) { e = { slug, names: new Map(), cos: [] }; by.set(slug, e); }
      e.names.set(name, (e.names.get(name) || 0) + 1);
      /* one company counts once per investor: a row can name the same fund
         twice ("GDP Venture (Djarum Group)" and "GDP Venture" on Blibli), and
         counting both inflated portfolios and could lift a one-company
         investor over the indexing gate. The roles are kept, joined. */
      const had = e.cos.find((x) => x.c === c);
      if (had) {
        if (role && !(had.role || '').includes(role)) had.role = had.role ? had.role + ' · ' + role : role;
        continue;
      }
      e.cos.push({ c, role });
    }
  }
  const list = [];
  for (const e of by.values()) {
    let disp = null, n = -1;
    for (const [name, count] of e.names) if (count > n) { disp = name; n = count; }
    e.name = disp;
    e.cos.sort((a, b) => (a.c.rank || 9e9) - (b.c.rank || 9e9));
    e.funding = e.cos.reduce((t, x) => t + (typeof x.c.funding_total_usd_m === 'number' ? x.c.funding_total_usd_m : 0), 0);
    e.jobs = e.cos.reduce((t, x) => t + (x.c.employees_est || 0), 0);
    const sec = new Map();
    for (const x of e.cos) sec.set(x.c.sector_label, (sec.get(x.c.sector_label) || 0) + 1);
    e.sectors = [...sec.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    list.push(e);
  }
  list.sort((a, b) => b.cos.length - a.cos.length || b.funding - a.funding || a.name.localeCompare(b.name));
  return { list, by };
}

/* Quality gate (RankMySEO report, 5 Oct 2026; Google's September 2026 spam
   update was rolling out). ~370 of ~520 investor pages list ONE census
   company — a near-copy of that company's own page. Those, and generic
   placeholders ("angel investors", "undisclosed angel investor"), stay up
   for readers and internal links but are "noindex, follow" and left out of
   the sitemap. A page is indexed when the investor backs 2+ census
   companies, or has its own fund record in data/investors.json. */
const GENERIC_INV = /^((\w+ )?angel investors?|undisclosed.*|private individual.*)$/i;
function indexable(e, det = details()) {
  if (!e || GENERIC_INV.test(e.name || '')) return false;
  return e.cos.length >= 2 || !!det[e.slug];
}
function indexableSlugs(data) {
  const det = details();
  return graph(data).list.filter((e) => indexable(e, det)).map((e) => e.slug);
}

/* ------------------------------------------------------------------ bits */

const fmt = (x, d = 0) => (x === null || x === undefined) ? '—'
  : x.toLocaleString('en-US', { maximumFractionDigits: d });
const moneyM = (m) => !m ? '—'
  : m >= 1000 ? 'US$' + (m / 1000).toFixed(1) + 'B'
  : 'US$' + (m >= 10 ? fmt(m, Number.isInteger(m) ? 0 : 1) : m >= 1 ? fmt(m, 1) : fmt(m, 2)) + 'M';

/* bare: unprefixed path for hreflang/canonical — null on pages (404) that
   should declare no alternate. noindex: the 404 ('noindex') and gated
   portfolio pages ('noindex, follow' — see indexable()). */
function shell({ title, desc, banner, active, path: pagePath, body, lang = 'en', bare = null, noindex = false }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="${noindex ? (noindex === true ? 'noindex' : noindex) : 'index, follow'}">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}">
<meta name="description" content="${esc(desc)}">
${bare ? I18N.headTags(lang, bare) + '\n' + I18N.ogImage() : ''}${bare ? SCHEMA.breadcrumbLd(lang, bare === '/investors'
  ? [{ name: '1001startup.id', path: '/' }, { name: L('Investors', 'Investor'), path: '/investors' }]
  : [{ name: '1001startup.id', path: '/' }, { name: L('Investors', 'Investor'), path: '/investors' }, { name: title.split(' — ')[0].replace(/^Portofolio /, ''), path: bare }]) : ''}
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">
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
.hero{max-width:1180px;margin:0 auto;padding:56px 20px 10px;display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:start}
@media(max-width:880px){.hero{grid-template-columns:1fr;padding-top:36px}}
.hero h1{font-size:clamp(38px,5.2vw,66px);line-height:1.03;letter-spacing:-0.03em;font-weight:500}
.hero .sub{color:#52525B;font-size:16.5px;line-height:1.55;max-width:54ch}
.hero .sub a{text-decoration:none;border-bottom:1px solid #C7C7CC}
.hero .sub a:hover{border-bottom-color:#000;color:#000}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.wrap{max-width:1180px;margin:0 auto;padding:44px 20px 0}
.lede{color:#52525B;font-size:14.5px;line-height:1.6;max-width:92ch;margin-bottom:16px}
.lede a{text-decoration:none;border-bottom:1px solid #C7C7CC}
.lede a:hover{border-bottom-color:#000;color:#000}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7;margin-bottom:22px}
.grid .cell{background:#fff;padding:16px}
.grid .t{font-size:26px;letter-spacing:-0.02em;font-weight:600}
.grid .d{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;margin-top:5px}
.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
#q{font:500 14px/1 'Overused Grotesk',system-ui,sans-serif;border:1px solid #D9D9DE;padding:10px 12px;min-width:min(340px,80vw);background:#fff}
#q:focus{outline:none;border-color:#000}
.count{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
.tablewrap{overflow-x:auto;border:1px solid #E7E7E7}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
td{padding:9px 12px;border-bottom:1px solid #F1F1F1;vertical-align:middle}
td.n,th.n{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap}
td.mu{color:#52525B;font-size:12.5px}
td a{text-decoration:none;border-bottom:1px solid #D9D9D9}
td a:hover{border-bottom-color:#000}
tr.rowlink{cursor:pointer}
tr.rowlink:hover td{background:#FAFAFA}
.co{display:flex;align-items:center;gap:10px;min-width:180px}
.co img{width:22px;height:22px;border-radius:5px;flex:none;background:#F4F4F5}
.co a{font-weight:600;border-bottom:none}
.prev{color:#6B6B73;font-size:12px}
.facts{display:flex;flex-wrap:wrap;gap:8px 22px;margin:14px 0 0;font-size:13.5px;color:#52525B}
.facts b{color:#000;font-weight:600}
.facts a{text-decoration:none;border-bottom:1px solid #C7C7CC}
.facts a:hover{border-bottom-color:#000;color:#000}
.srcs{margin-top:10px;font:400 10.5px/1.8 'IBM Plex Mono',monospace;letter-spacing:.03em;color:#6B6B73}
.srcs a{color:inherit;text-decoration:none;border-bottom:1px solid #E7E7E7;margin-right:10px}
.srcs a:hover{color:#000;border-bottom-color:#000}
.role{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#4E7A96;border:1px solid #DCE5EA;padding:3px 5px;white-space:nowrap}
.tablewrap.out{margin-top:16px}
.tablewrap.out table{min-width:720px}
.foot-note{font-size:11px;color:#6B6B73;margin-top:10px;line-height:1.6}
footer{max-width:1180px;margin:60px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
footer a{color:inherit}
</style>
</head>
<body>
<div class="banner">${esc(banner)}</div>
${NAV.header(active, { lang, path: pagePath, translated: true })}
${body}
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="${PF}/investors">${L('Investors', 'Investor')}</a> · <a href="/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · <a href="${PF}/">${L('Back to the census', 'Kembali ke sensus')}</a></span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/investors1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

/* ----------------------------------------------------------------- index */

function index({ data, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const G = graph(data);
  const D = details();
  const total = ((data && data.companies) || []).length;
  const withInv = ((data && data.companies) || []).filter((c) => (c.investors || []).length).length;
  const funds = G.list.length;
  const top = G.list[0];

  const rows = G.list.map((e, i) => {
    const det = D[e.slug];
    const prev = e.cos.slice(0, 3).map((x) => esc(x.c.name.replace(/\s*\(.*\)$/, ''))).join(' · ');
    return `<tr class="rowlink" data-href="${PF}/investor/${esc(e.slug)}" data-n="${esc(e.name.toLowerCase())}">
      <td class="n mu">${i + 1}</td>
      <td class="co"><a href="${PF}/investor/${esc(e.slug)}">${esc(e.name)}</a>${det ? '' : ''}</td>
      <td class="n">${e.cos.length}</td>
      <td class="n">${moneyM(e.funding)}</td>
      <td class="n">${e.jobs ? fmt(e.jobs) : '—'}</td>
      <td class="mu">${esc(e.sectors.slice(0, 3).join(' · '))}</td>
      <td class="prev">${prev}${e.cos.length > 3 ? ' …' : ''}</td>
    </tr>`;
  }).join('');

  const body = `
<section class="hero">
  <h1>${L('The investors behind the census.', 'Para investor di balik sensus.')}</h1>
  <div>
    <p class="sub">${L(
      `${fmt(funds)} funds, firms and angels named on ${fmt(withInv)} of the
    ${fmt(total)} census companies — every name traceable to a source on its company page.
    ${top ? `${esc(top.name)} is the most active, backing ${top.cos.length} of them.` : ''}`,
      `${fmt(funds)} fund, firma, dan angel investor tercatat di ${fmt(withInv)} dari
    ${fmt(total)} perusahaan sensus — setiap nama bisa ditelusuri ke sumbernya di halaman perusahaan masing-masing.
    ${top ? `${esc(top.name)} paling aktif, mendanai ${top.cos.length} di antaranya.` : ''}`)}</p>
  </div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('EVERY INVESTOR ON A CENSUS ROW', 'SETIAP INVESTOR DI BARIS SENSUS')}</div>
  <p class="lede">${L(
    `Ranked by how many census companies each investor backs. The funding column is what those
  portfolio companies disclosed raising in total — from all their investors together, not this one's cheque.
  Click through for the portfolio, and — where a per-fund pass has run — the fund's details and the roster
  names deliberately not counted.`,
    `Diurutkan berdasarkan jumlah perusahaan sensus yang didanai tiap investor. Kolom pendanaan adalah
  total pendanaan diumumkan yang dihimpun perusahaan portofolionya — gabungan dari semua investor mereka,
  bukan besaran cek fund yang bersangkutan saja. Klik untuk melihat portofolionya, dan — bila pemeriksaan per fund sudah
  kami jalankan — detail fund berikut nama-nama roster yang sengaja tidak dihitung.`)}</p>
  <div class="toolbar">
    <input id="q" type="search" placeholder="${L('Search investors…', 'Cari investor…')}" autocomplete="off" aria-label="${L('Search investors', 'Cari investor')}">
    <span class="count" id="count">${fmt(funds)} ${L('investors', 'investor')}</span>
  </div>
  <div class="tablewrap">
    <table id="inv">
      <thead><tr><th class="n">#</th><th>Investor</th><th class="n">${L('In census', 'Di sensus')}</th><th class="n">${L('Portfolio raised', 'Dana dihimpun portofolio')}</th><th class="n">${L('Portfolio jobs', 'Lapangan kerja')}</th><th>${L('Sectors', 'Sektor')}</th><th>${L('Portfolio', 'Portofolio')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="foot-note">${L(
    `Investor names come from each company's sourced record. A company that raised from a fund we
  have not yet verified simply does not show under it — coverage grows company by company, never by assumption.
  ${fmt(total - withInv)} census rows carry no investor on record (bootstrapped, undisclosed, or not yet researched).`,
    `Nama investor kami ambil dari catatan tiap perusahaan yang ada sumbernya. Perusahaan yang menghimpun dana
  dari fund yang belum kami verifikasi memang tidak muncul di bawah fund itu — cakupan tumbuh perusahaan demi
  perusahaan, bukan lewat asumsi. ${fmt(total - withInv)} baris sensus belum mencatat investor sama sekali
  (bootstrap, tidak diumumkan, atau belum kami riset).`)}</p>
</section>`;

  return shell({
    title: L('Investors — 1001startup.id', 'Investor Startup Indonesia — 1001startup.id'),
    desc: L('Every venture fund, firm and angel named on a census row, ranked by portfolio.',
      'Daftar investor startup Indonesia: fund modal ventura, firma, dan angel investor yang tercatat di sensus, diurutkan berdasarkan portofolio.'),
    banner: L(`${funds} INVESTORS · ${withInv} BACKED COMPANIES · EVERY NAME SOURCED ON ITS COMPANY PAGE`,
      `${funds} INVESTOR · ${withInv} PERUSAHAAN DIDANAI · SETIAP NAMA ADA SUMBERNYA DI HALAMAN PERUSAHAAN`),
    active: 'investors', path: '/investors', body, lang, bare: '/investors',
  });
}

/* -------------------------------------------------------------- investor */

function investor({ data, slug, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const G = graph(data);
  const e = G.by.get(String(slug || ''));
  if (!e) return null;
  const det = details()[e.slug] || null;

  const rows = e.cos.map((x) => {
    const c = x.c;
    return `<tr class="rowlink" data-href="${PF}/company/${esc(c.id)}">
      <td class="co">${c.logo ? `<img src="${esc(c.logo)}" alt="" loading="lazy">` : ''}<a href="${PF}/company/${esc(c.id)}">${esc(c.name)}</a></td>
      <td class="mu">${esc(c.sector_label || '')}</td>
      <td>${x.role ? `<span class="role">${esc(x.role)}</span>` : ''}</td>
      <td class="n">${typeof c.funding_total_usd_m === 'number' ? moneyM(c.funding_total_usd_m) : '—'}</td>
      <td class="n">${c.employees_est ? fmt(c.employees_est) : '—'}</td>
      <td class="mu">${esc(c.kota || '')}</td>
    </tr>`;
  }).join('');

  const factbits = det ? [
    det.type ? `<span><b>${esc(det.type)}</b></span>` : '',
    det.founded ? `<span>${L('Founded', 'Berdiri')} <b>${esc(String(det.founded))}</b></span>` : '',
    det.hq ? `<span>${L('HQ', 'Kantor pusat')} <b>${esc(det.hq)}</b></span>` : '',
    det.founders && det.founders.length ? `<span>${L('Founders', 'Pendiri')} <b>${esc(det.founders.join(', '))}</b></span>` : '',
    det.site ? `<span><a href="${esc(det.site)}" rel="noopener">${esc(det.site.replace(/^https?:\/\//, ''))}</a></span>` : '',
  ].filter(Boolean).join('') : '';

  const srcs = det && det.sources && det.sources.length
    ? `<div class="srcs">${det.sources.map((u) => `<a href="${esc(u)}" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join('')}</div>` : '';

  const outside = det && det.outside && det.outside.length ? `
  <div class="eyebrow" style="margin-top:38px"><span class="sq"></span>${L("ON THE FUND'S ROSTER, NOT IN THE CENSUS", 'ADA DI ROSTER FUND, BELUM MASUK SENSUS')}</div>
  <p class="lede">${L(
    `A portfolio listing is not a census row. These names were checked against the census's
  inclusion tests on ${esc(det.outside_asof || 'the date in each note')} and held out, each for a stated reason —
  published so the gap cannot be mistaken for ignorance.`,
    `Masuk daftar portofolio bukan berarti masuk sensus. Nama-nama ini kami periksa terhadap syarat
  cakupan sensus pada ${esc(det.outside_asof || 'tanggal di tiap catatan')} dan sengaja ditahan, masing-masing dengan
  alasan tertulis — kami terbitkan supaya celah ini tidak dikira luput dari pantauan.`)}</p>
  <div class="tablewrap out">
    <table>
      <thead><tr><th>${L('Name', 'Nama')}</th><th>Status</th><th>${L('Why it is not counted', 'Alasan tidak dihitung')}</th></tr></thead>
      <tbody>${det.outside.map((o) => `<tr>
        <td>${o.url ? `<a href="${esc(o.url)}" rel="noopener">${esc(o.name)}</a>` : esc(o.name)}</td>
        <td class="mu">${esc(o.status || '')}</td>
        <td class="mu">${esc(o.why || '')}</td></tr>`).join('')}</tbody>
    </table>
  </div>` : '';

  const about = det && det.about ? `<p class="sub">${esc(det.about)}</p>`
    : `<p class="sub">${L(
      `Everything on this page derives from the census: the companies below name
       ${esc(e.name)} among their investors, each with the source on its company page. A curated fund
       profile lands here when a per-fund verification pass runs.`,
      `Seluruh isi halaman ini diturunkan dari sensus: perusahaan-perusahaan di bawah mencantumkan
       ${esc(e.name)} sebagai salah satu investornya, masing-masing dengan sumber di halaman perusahaannya.
       Profil fund hasil kurasi akan tampil di sini setelah pemeriksaan per fund kami jalankan.`)}</p>`;

  const secCount = e.sectors.length;
  const body = `
<section class="hero">
  <div>
    <div class="eyebrow"><span class="sq"></span>INVESTOR</div>
    <h1>${esc(e.name)}</h1>
    <div class="inv-fw"><button class="fw1001" type="button" data-fk="investor" data-fr="${esc(e.slug)}" hidden>${L('Follow', 'Ikuti')}</button></div>
    <div class="facts">${factbits}</div>
    ${srcs}
  </div>
  <div>${about}</div>
</section>
<section class="wrap">
  <div class="grid">
    <div class="cell"><div class="t">${e.cos.length}</div><div class="d">${L('census companies backed', 'perusahaan sensus didanai')}</div></div>
    <div class="cell"><div class="t">${moneyM(e.funding)}</div><div class="d">${L("disclosed funding raised by that portfolio — all investors combined, not this fund's cheque", 'pendanaan diumumkan yang dihimpun portofolio itu — gabungan semua investornya, bukan besaran cek fund ini')}</div></div>
    <div class="cell"><div class="t">${e.jobs ? fmt(e.jobs) : '—'}</div><div class="d">${L('jobs at portfolio companies', 'lapangan kerja di perusahaan portofolio')}</div></div>
    <div class="cell"><div class="t">${secCount}</div><div class="d">${L(`sector${secCount === 1 ? '' : 's'}`, 'sektor')}: ${esc(e.sectors.slice(0, 4).join(' · '))}</div></div>
  </div>
  <div class="eyebrow"><span class="sq"></span>${L('THE CENSUS PORTFOLIO', 'PORTOFOLIO DI SENSUS')}</div>
  <div class="tablewrap">
    <table>
      <thead><tr><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th><th>${L('Round note', 'Catatan putaran')}</th><th class="n">${L('Raised total', 'Total dihimpun')}</th><th class="n">${L('Jobs', 'Lapangan kerja')}</th><th>${L('Where', 'Lokasi')}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="foot-note">${L(
    `"Raised total" is each company's disclosed funding from all its investors together; a dash
  means every round was undisclosed, and each figure links to its evidence on the company page. A round note in
  the third column is carried from the company's record where the round is on record.`,
    `"Total dihimpun" adalah pendanaan diumumkan tiap perusahaan dari seluruh investornya sekaligus; tanda
  strip berarti semua putaran pendanaannya tidak diumumkan, dan setiap angka tertaut ke buktinya di halaman
  perusahaan. Catatan putaran di kolom ketiga kami salin dari catatan perusahaan bila putarannya terdokumentasi.`)}</p>
  ${outside}
</section>`;

  return shell({
    title: SCHEMA.fitTitle(lang === 'id'
      ? [`Portofolio ${e.name} — 1001startup.id`, `Portofolio ${e.name}`, e.name]
      : [`${e.name} — Investors — 1001startup.id`, `${e.name} — Investors`, e.name]),
    desc: SCHEMA.fitDesc(lang === 'id'
      ? [`Portofolio ${e.name} di sensus startup Indonesia: ${e.cos.length} perusahaan didanai, lengkap dengan pendanaan, lapangan kerja, dan sumbernya.`,
        `Portofolio ${e.name} di sensus startup Indonesia: ${e.cos.length} perusahaan didanai beserta pendanaan dan sumbernya.`]
      : [`${e.name} in the Indonesian startup census: ${e.cos.length} compan${e.cos.length === 1 ? 'y' : 'ies'} backed, with each one's funding, jobs and the source behind every figure.`,
        `${e.name} in the Indonesian startup census: ${e.cos.length} compan${e.cos.length === 1 ? 'y' : 'ies'} backed, with funding and sources.`]),
    banner: L(`${esc(e.name.toUpperCase())} · ${e.cos.length} CENSUS COMPAN${e.cos.length === 1 ? 'Y' : 'IES'} · EVERY CLAIM SOURCED`,
      `${esc(e.name.toUpperCase())} · ${e.cos.length} PERUSAHAAN SENSUS · SETIAP KLAIM ADA SUMBERNYA`),
    active: 'investors', path: `/investor/${e.slug}`, body, lang, bare: `/investor/${e.slug}`,
    noindex: indexable(e, det ? { [e.slug]: det } : {}) ? false : 'noindex, follow',
  });
}

function notFound({ data, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const G = graph(data);
  const body = `
<section class="hero">
  <div>
    <div class="eyebrow"><span class="sq"></span>${L('NOT FOUND', 'TIDAK DITEMUKAN')}</div>
    <h1>${L('No such investor.', 'Investor tidak ditemukan.')}</h1>
  </div>
  <div><p class="sub">${L(
    `No census row names this investor. The <a href="${PF}/investors">investor index</a> lists all
  ${G.list.length} that are on record.`,
    `Tidak ada baris sensus yang mencantumkan investor ini. <a href="${PF}/investors">Indeks investor</a> memuat
  semua ${G.list.length} nama yang tercatat.`)}</p></div>
</section>`;
  return shell({
    title: L('Not found — Investors — 1001startup.id', 'Tidak ditemukan — Investor — 1001startup.id'),
    desc: L('No census row names this investor.', 'Tidak ada baris sensus yang mencantumkan investor ini.'),
    banner: L('NO SUCH INVESTOR ON RECORD', 'INVESTOR TIDAK ADA DI CATATAN'),
    active: 'investors', path: '/investors', body, lang, noindex: true,
  });
}

module.exports = { index, investor, notFound, slugInv, parseInv, indexableSlugs, graph };
