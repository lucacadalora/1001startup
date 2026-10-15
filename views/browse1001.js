'use strict';
/* 1001startup.id — the browse pages: one page per sector (/sector/<key>) and
 * one per metro (/city/<slug>).
 *
 * Why they exist (Luca, Aug 31 2026: "do whatever that you think can boost our
 * SEO"): "startup fintech Indonesia" or "startup di Bandung" had nowhere to
 * land except a client-side filter state crawlers cannot reach. These pages are
 * that landing — server-rendered from census.json per request, both languages,
 * in the sitemap, interlinked from every company profile's sector tag.
 *
 * Same discipline as everywhere else: every figure is computed from the census
 * at render time (nothing baked that can go stale), estimates carry the est
 * label, and the page frame translates while data prose stays as written.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { slugInv, parseInv } = require('./investors1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';

const fmt = (n, d = 0) => (n === null || n === undefined) ? '—'
  : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const money = (n) => (n === null || n === undefined) ? '—'
  : n >= 10 ? fmt(n, Number.isInteger(n) ? 0 : 1) : n >= 1 ? fmt(n, 1) : fmt(n, 2);
/* Figures at a readable magnitude, with UNITS IN THE PAGE'S LANGUAGE. The
   trap (caught by review): Indonesian financial shorthand uses M for MILIAR,
   so an English "US$ 189.6 M" tile reads a thousand times too large to an
   Indonesian reader — on /id, units are always words (juta/miliar/triliun). */
const usdProse = (m, lang) => m >= 1000
  ? `US$${(m / 1000).toFixed(1)} ${lang === 'id' ? 'miliar' : 'billion'}`
  : `US$${money(m)} ${lang === 'id' ? 'juta' : 'million'}`;
const usdTile = (m, lang) => lang === 'id'
  ? (m >= 1000 ? `US$ ${(m / 1000).toFixed(1)} miliar` : `US$ ${money(m)} juta`)
  : (m >= 1000 ? `US$ ${(m / 1000).toFixed(1)} B` : `US$ ${money(m)} M`);
const gvaProse = (bn, lang) => bn >= 1000
  ? `IDR ${(bn / 1000).toFixed(1)} ${lang === 'id' ? 'triliun' : 'trillion'}`
  : `IDR ${fmt(bn)} ${lang === 'id' ? 'miliar' : 'billion'}`;
const gvaTile = (bn, lang) => lang === 'id'
  ? (bn >= 1000 ? `IDR ${(bn / 1000).toFixed(1)} triliun` : `IDR ${fmt(bn)} miliar`)
  : (bn >= 1000 ? `IDR ${(bn / 1000).toFixed(1)} T` : `IDR ${fmt(bn)} bn`);

/* Display names per sector key. `en`/`id` are the phrase that slots into
 * "<X> startups in Indonesia" / "Startup <X> di Indonesia"; the census's own
 * sector_label stays the label of record in tables. Renames are Luca's. */
const SECTORS = {
  fintech: { en: 'fintech', id: 'fintech' },
  commerce: { en: 'e-commerce & commerce', id: 'e-commerce & commerce' },
  'ai-cloud': { en: 'AI & cloud', id: 'AI & cloud' },
  media: { en: 'media & gaming', id: 'media & gaming' },
  climate: { en: 'climate & sustainability', id: 'iklim & keberlanjutan' },
  edtech: { en: 'edtech', id: 'edtech' },
  saas: { en: 'SaaS', id: 'SaaS' },
  health: { en: 'healthtech', id: 'healthtech' },
  logistics: { en: 'logistics', id: 'logistik' },
  fnb: { en: 'F&B & D2C', id: 'F&B & D2C' },
  travel: { en: 'travel & mobility', id: 'travel & mobilitas' },
  crypto: { en: 'crypto & Web3', id: 'kripto & Web3' },
  prop: { en: 'proptech', id: 'proptech' },
  agri: { en: 'agritech', id: 'agritech' },
  bank: { en: 'digital banking', id: 'bank digital' },
  misc: { en: 'other tech & insurtech', id: 'teknologi lainnya & insurtech' },
};

/* Cities are read off the census itself (by_metro, built from lib/metros1001.js).
   The census went nationwide on 28 Sep 2026, so the list can no longer be typed
   out here: a city exists once a company in it does. */
/* A census.json built before 28 Sep 2026 has no mapped/anchored/name_id on its
   by_metro rows; the city table fills them in, so a restart ahead of a rebuild
   cannot strip the map button or the output line from Jakarta, Bandung or Bali. */
const METRO = require('../lib/metros1001');
const cityOf = (data, slug) => {
  const x = ((data && data.by_metro) || []).find((y) => y.id === slug && y.count);
  if (!x) return null;
  return Object.assign({}, x, {
    mapped: x.mapped !== undefined ? x.mapped : METRO.mapped(x.id),
    anchored: x.anchored !== undefined ? x.anchored : METRO.anchored(x.id),
    name_id: x.name_id || METRO.name(x.id, 'id', x.name),
  });
};
const cityIds = (data) => ((data && data.by_metro) || []).filter((x) => x.count).map((x) => x.id);
/* City quality gate (same reasoning as the investor gate, RankMySEO report
   5 Oct 2026): once the census went nationwide, many cities hold one to four
   companies, and a page listing one company is a near-copy of its profile.
   Below CITY_MIN the page stays up for readers and links but is
   "noindex, follow" and left out of the sitemap. */
const CITY_MIN = 5;
const indexableCityIds = (data) => ((data && data.by_metro) || []).filter((x) => x.count >= CITY_MIN).map((x) => x.id);

const sectorKeys = (data) => {
  const seen = new Set();
  for (const c of (data.companies || [])) if (c.sector_key) seen.add(c.sector_key);
  return [...seen].filter((k) => SECTORS[k]).sort();
};

/* Top investors across a set of rows — count of rows naming them, so a fund
   that backed five sector companies outranks one that backed one. */
function topInvestors(rows, n = 8) {
  const cnt = new Map();
  for (const c of rows) {
    for (const inv of c.investors || []) {
      const name = parseInv(inv).name;
      if (!name) continue;
      const k = slugInv(name);
      if (!k) continue;
      const e = cnt.get(k) || { slug: k, name, n: 0 };
      e.n++;
      cnt.set(k, e);
    }
  }
  return [...cnt.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, n);
}

function aggregates(rows) {
  const funded = rows.filter((c) => typeof c.funding_total_usd_m === 'number' && c.funding_total_usd_m > 0);
  return {
    n: rows.length,
    fundedN: funded.length,
    funding: funded.reduce((a, c) => a + c.funding_total_usd_m, 0),
    jobs: rows.reduce((a, c) => a + (c.employees_est || 0), 0),
    gva: rows.reduce((a, c) => a + (c.est_gva_idr_bn || 0), 0),
  };
}

function rowsTable(rows, lang, PF, L) {
  const tr = rows.map((c) => `
    <tr>
      <td class="rk">${c.rank}</td>
      <td>${c.logo ? `<img class="lg" src="${esc(c.logo)}" alt="" loading="lazy" width="18" height="18">` : ''}<a href="${PF}/company/${esc(c.id)}">${esc(c.name)}</a></td>
      <td class="mu">${esc(c.sector_label || '')}</td>
      <td class="mu">${esc(c.kota || '—')}</td>
      <td class="n">${typeof c.funding_total_usd_m === 'number' && c.funding_total_usd_m > 0 ? money(c.funding_total_usd_m) : '—'}</td>
      <td class="n">${c.employees_est != null ? fmt(c.employees_est) : '—'}</td>
    </tr>`).join('');
  return `<div class="tablewrap"><table>
    <thead><tr><th>#</th><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th><th>${L('City', 'Kota')}</th><th class="n">${L('Funding US$M', 'Pendanaan (US$ juta)')}</th><th class="n">${L('Jobs est', 'Pekerja (est.)')}</th></tr></thead>
    <tbody>${tr}</tbody>
  </table></div>`;
}

/* ItemList structured data — the machine copy of the list the page shows.
   Complete, not truncated (numberOfItems must equal the elements given), and
   the URLs follow the page's language, same as the visible table. */
function itemListLd(rows, lang) {
  const pf = I18N.pfx(lang);
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    numberOfItems: rows.length,
    itemListElement: rows.map((c, i) => ({
      '@type': 'ListItem', position: i + 1, name: c.name,
      url: I18N.ORIGIN + pf + '/company/' + c.id,
    })),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

function shell({ title, desc, path, lang, body, ld, robots = 'index, follow', active = 'census' }) {
  const L = I18N.mkL(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
${I18N.headTags(lang, path)}
${I18N.ogImage()}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">${ld || ''}
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
.hero{max-width:1180px;margin:0 auto;padding:48px 20px 38px}
.hero h1{font-size:clamp(34px,4.8vw,58px);line-height:1.04;letter-spacing:-0.03em;font-weight:500;max-width:22ch}
.hero .sub{color:#52525B;font-size:16px;line-height:1.55;max-width:64ch;margin-top:14px}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.stats{max-width:1140px;width:calc(100% - 40px);margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:860px){.stats{grid-template-columns:repeat(2,1fr)}}
.stats .cell{background:#fff;padding:20px 18px}
.stats .v{font-size:clamp(24px,2.7vw,36px);letter-spacing:-0.02em;background:${GRAD};-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:600}
.stats .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-top:6px}
.wrap{max-width:1180px;margin:0 auto;padding:44px 20px 0}
.tablewrap{overflow-x:auto;border:1px solid #E7E7E7}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:13.5px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
td{padding:9px 12px;border-bottom:1px solid #F1F1F1;vertical-align:top}
td.n,th.n{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap}
td.rk{font-family:'IBM Plex Mono',monospace;color:#6B6B73;font-size:12px}
td.mu{color:#52525B;font-size:12.5px}
td a{text-decoration:none;border-bottom:1px solid #D9D9D9}
td .lg{vertical-align:-4px;margin-right:8px}
.chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
.chip{display:inline-block;padding:7px 11px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;text-decoration:none;color:#000}
.chip:hover{border-color:#000}
.chip b{font-weight:400;color:#6B6B73;margin-left:5px}
.lede{color:#52525B;font-size:14.5px;line-height:1.6;max-width:92ch;margin-bottom:16px}
/* used by /unicorn's caveat block and its in-parent / est marks */
.method{border:1px solid #E7E7E7;padding:22px}
.method p{color:#6B6B73;font-size:14.5px;line-height:1.6;max-width:88ch}
.estt{margin-left:5px;color:#6B6B73;font:400 9px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;vertical-align:1px}
a.estt{text-decoration:none;border-bottom:1px dotted #C7C7CC}
a.estt:hover{color:#000;border-bottom-color:#000}
.estt.held{color:#2F7A5C}
a.estt.held{border-bottom-color:#AFD3C4}
.cta{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
.btn{display:inline-block;padding:12px 18px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;border:1px solid #000;cursor:pointer;background:#fff;color:#000}
.btn.primary{background:#000;color:#fff}
.foot-note{font-size:11.5px;line-height:1.6;color:#6B6B73;margin-top:12px;max-width:92ch}
.foot-note a{color:inherit}
footer{max-width:1180px;margin:56px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
footer a{color:#52525B}
</style>
</head>
<body>
<div class="banner">${L('WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY DERIVED FIGURE IS A LABELED ESTIMATE', 'DOKUMEN KERJA · SUMBER PUBLIK SAJA · ANGKA TURUNAN SELALU BERLABEL ESTIMASI')}</div>
${NAV.header(active, { lang, path, translated: true })}
${body}
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="${I18N.pfx(lang)}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · ${L('Anchors: BPS', 'Anchor: BPS')}</span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

function sectorChips(data, activeKey, lang, PF, L) {
  const counts = {};
  for (const c of data.companies || []) counts[c.sector_key] = (counts[c.sector_key] || 0) + 1;
  return `<div class="chips">${sectorKeys(data).filter((k) => k !== activeKey)
    .map((k) => `<a class="chip" href="${PF}/sector/${esc(k)}">${esc(lang === 'id' ? SECTORS[k].id : SECTORS[k].en)}<b>${counts[k] || 0}</b></a>`).join('')}</div>`;
}

function sector({ data, key, lang = 'en' }) {
  const S = SECTORS[key];
  if (!S) return null;
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const rows = (data.companies || []).filter((c) => c.sector_key === key).sort((a, b) => a.rank - b.rank);
  if (!rows.length) return null;
  const A = aggregates(rows);
  const name = lang === 'id' ? S.id : S.en;
  const inv = topInvestors(rows);
  const path = '/sector/' + key;
  /* trail steps must be real pages: home, then this sector page */
  const crumb = [{ name: '1001startup.id', path: '/' },
    { name: (lang === 'id' ? 'Startup ' + S.id : S.en.charAt(0).toUpperCase() + S.en.slice(1)), path }];
  const h1 = L(`${S.en.charAt(0).toUpperCase() + S.en.slice(1)} startups in Indonesia`, `Startup ${S.id} di Indonesia`);
  const body = `
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>${L('SECTOR', 'SEKTOR')} · ${esc((lang === 'id' ? S.id : (rows[0].sector_label || S.en)).toUpperCase())}</div>
  <h1>${esc(h1)}.</h1>
  <p class="sub">${lang === 'id'
    ? `Sensus mencatat ${fmt(A.n)} startup ${esc(name)} yang beroperasi di Indonesia. Total pendanaan yang diumumkan mencapai ${usdProse(A.funding, 'id')} dari ${fmt(A.fundedN)} perusahaan, dengan perkiraan ${fmt(A.jobs)} lapangan kerja dan output sekitar ${gvaProse(A.gva, 'id')} per tahun (estimasi). Klik perusahaan mana pun untuk profil lengkapnya beserta semua sumbernya.`
    : `The census tracks ${fmt(A.n)} operating ${esc(name)} startups in Indonesia — ${usdProse(A.funding, 'en')} of disclosed funding across ${fmt(A.fundedN)} companies, roughly ${fmt(A.jobs)} jobs (estimated), and ${gvaProse(A.gva, 'en')} a year of output (estimated). Click any company for its full profile and every source behind it.`}</p>
  <div class="cta">
    <a class="btn primary" href="${PF}/#companies">${L('The full census', 'Sensus lengkap')}</a>
    <a class="btn" href="${PF}/map">${L('See the map', 'Lihat petanya')}</a>
    <a class="btn" href="${PF}/sector">${L('All sectors', 'Semua sektor')}</a>
  </div>
</section>
<section class="stats">
  ${[[fmt(A.n), L('companies tracked', 'perusahaan terdata')],
    [usdTile(A.funding, lang), L('disclosed funding', 'pendanaan diumumkan')],
    [fmt(A.jobs), L('jobs — estimate', 'lapangan kerja — estimasi')],
    [gvaTile(A.gva, lang), L('output / yr — estimate', 'output / thn — estimasi')]]
    .map(([v, k]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('THE COMPANIES', 'DAFTAR PERUSAHAAN')}</div>
  ${rowsTable(rows, lang, PF, L)}
  <p class="foot-note">${L('Ranked as in the census (latest known valuation, then disclosed funding, then jobs). "—" means no credible public figure. Jobs are estimates; every figure links to its source on the company profile — see ',
    'Urutan mengikuti peringkat sensus (valuasi terakhir yang diketahui, lalu pendanaan diumumkan, lalu jumlah pekerja). "—" berarti tidak ada angka publik yang kredibel. Angka pekerja adalah estimasi; setiap angka tertaut ke sumbernya di profil perusahaan — lihat ')}<a href="${PF}/coverage#method">${L('how the numbers are made', 'cara kami menghitung')}</a>.</p>
</section>
${inv.length ? `<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('MOST ACTIVE INVESTORS HERE', 'INVESTOR PALING AKTIF DI SEKTOR INI')}</div>
  <div class="chips">${inv.map((e) => `<a class="chip" href="${PF}/investor/${esc(e.slug)}">${esc(e.name)}<b>${e.n}</b></a>`).join('')}</div>
</section>` : ''}
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('OTHER SECTORS', 'SEKTOR LAIN')}</div>
  ${sectorChips(data, key, lang, PF, L)}
</section>`;
  /* a long sector name (iklim & keberlanjutan…) can push the full sentence
     past the ~165-char SERP ceiling — those fall back to the compact form */
  let desc = lang === 'id'
    ? `Daftar ${fmt(A.n)} startup ${S.id} di Indonesia dengan data pendanaan, jumlah pekerja, dan investornya — dari sensus 1001startup.id.`
    : `${fmt(A.n)} ${S.en} startups in Indonesia with funding, headcount, investors and location — from the 1001startup.id census. Public sources, estimates labeled.`;
  if (desc.length > 165) {
    desc = lang === 'id'
      ? `Daftar ${fmt(A.n)} startup ${S.id} di Indonesia — pendanaan, jumlah pekerja, dan investornya, dari sensus 1001startup.id.`
      : `${fmt(A.n)} ${S.en} startups in Indonesia — funding, headcount and investors, from the 1001startup.id census.`;
  }
  return shell({
    title: SCHEMA.fitTitle([`${h1}: ${fmt(A.n)} ${L(A.n === 1 ? 'company' : 'companies', 'perusahaan')} — 1001startup.id`, `${h1} — 1001startup.id`, h1]),
    desc,
    path, lang, body, ld: itemListLd(rows, lang) + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

/* /sector — the hub every sector page hangs off (RankMySEO report, 5 Oct
   2026: the nav's "Sectors" pointed into /coverage and no page linked all
   sector pages together). One answer sentence with the census date, then a
   table of every sector with its live totals, then the cities. */
function sectorHub({ data, lang = 'en' }) {
  const keys = sectorKeys(data || {});
  if (!keys.length) return null;
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const all = data.companies || [];
  const secs = keys.map((k) => {
    const rows = all.filter((c) => c.sector_key === k);
    return Object.assign({ key: k, name: lang === 'id' ? SECTORS[k].id : SECTORS[k].en }, aggregates(rows));
  }).sort((a, b) => b.n - a.n || b.funding - a.funding);
  const asOf = Date.parse(data.generated) ? new Date(Date.parse(data.generated)).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '';
  const top = secs.slice(0, 3);
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const path = '/sector';
  const h1 = L('Indonesian startups by sector', 'Startup Indonesia per sektor');
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: h1, path }];
  const fact = lang === 'id'
    ? `Menurut sensus 1001startup.id${asOf ? ` (diperbarui ${asOf})` : ''}, ${fmt(all.length)} startup Indonesia terbagi ke dalam ${secs.length} sektor. Yang terbesar: ${top.map((x) => `${x.name} (${fmt(x.n)})`).join(', ')}.`
    : `According to the 1001startup.id census${asOf ? ` (updated ${asOf})` : ''}, ${fmt(all.length)} Indonesian startups fall into ${secs.length} sectors. The largest: ${top.map((x) => `${x.name} (${fmt(x.n)})`).join(', ')}.`;
  const tr = secs.map((x) => `
    <tr>
      <td style="white-space:nowrap"><a href="${PF}/sector/${esc(x.key)}">${esc(cap(x.name))}</a></td>
      <td class="n">${fmt(x.n)}</td>
      <td class="n">${fmt(x.fundedN)}</td>
      <td class="n">${x.funding > 0 ? money(x.funding) : '—'}</td>
      <td class="n">${fmt(x.jobs)}</td>
    </tr>`).join('');
  const cities = ((data.by_metro) || []).filter((x) => x.count)
    .sort((a, b) => b.count - a.count)
    .map((x) => `<a class="chip" href="${PF}/city/${esc(x.id)}">${esc(lang === 'id' ? (x.name_id || METRO.name(x.id, 'id', x.name)) : x.name)}<b>${fmt(x.count)}</b></a>`).join('');
  const body = `
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>${L('SECTORS', 'SEKTOR')} · ${secs.length}</div>
  <h1>${esc(h1)}.</h1>
  <p class="sub">${esc(fact)}</p>
  <div class="cta">
    <a class="btn primary" href="${PF}/#companies">${L('The full census', 'Sensus lengkap')}</a>
    <a class="btn" href="${PF}/unicorn">${L('Billion-dollar startups', 'Startup unicorn')}</a>
    <a class="btn" href="${PF}/investors">${L('Investors', 'Investor')}</a>
  </div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('EVERY SECTOR', 'SEMUA SEKTOR')}</div>
  <div class="tablewrap"><table>
    <thead><tr><th>${L('Sector', 'Sektor')}</th><th class="n">${L('Companies', 'Perusahaan')}</th><th class="n">${L('With disclosed funding', 'Dengan pendanaan diumumkan')}</th><th class="n">${L('Funding US$M', 'Pendanaan (US$ juta)')}</th><th class="n">${L('Jobs est', 'Pekerja (est.)')}</th></tr></thead>
    <tbody>${tr}</tbody>
  </table></div>
  <p class="foot-note">${L('Funding is the sum of what each company disclosed raising; a dash means none disclosed. Jobs are estimates. Each sector page lists its companies, with the source behind every figure on the company profile — see ',
    'Pendanaan adalah jumlah dana yang diumumkan tiap perusahaan; tanda strip berarti tidak ada yang diumumkan. Angka pekerja adalah estimasi. Setiap halaman sektor memuat daftar perusahaannya, dan sumber tiap angka ada di profil perusahaan — lihat ')}<a href="${PF}/coverage#method">${L('how the numbers are made', 'cara kami menghitung')}</a>.</p>
</section>
${cities ? `<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('BY CITY', 'PER KOTA')}</div>
  <div class="chips">${cities}</div>
</section>` : ''}`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'ItemList', numberOfItems: secs.length,
    itemListElement: secs.map((x, i) => ({ '@type': 'ListItem', position: i + 1,
      name: lang === 'id' ? 'Startup ' + x.name : cap(x.name), url: I18N.ORIGIN + PF + '/sector/' + x.key })),
  };
  return shell({
    title: SCHEMA.fitTitle(lang === 'id'
      ? [`Startup Indonesia per Sektor: ${secs.length} Sektor — 1001startup.id`, `Startup Indonesia per Sektor — 1001startup.id`, h1]
      : [`Indonesian Startups by Sector — 1001startup.id`, h1]),
    desc: lang === 'id'
      ? `${fmt(all.length)} startup Indonesia dalam ${secs.length} sektor — jumlah perusahaan, pendanaan diumumkan, dan perkiraan lapangan kerja per sektor, dari sensus 1001startup.id.`
      : `${fmt(all.length)} Indonesian startups across ${secs.length} sectors — companies, disclosed funding and estimated jobs per sector, from the 1001startup.id census.`,
    path, lang, body,
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

function city({ data, slug, lang = 'en' }) {
  const C = cityOf(data, slug);
  if (!C) return null;
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const rows = (data.companies || []).filter((c) => c.metro === slug).sort((a, b) => a.rank - b.rank);
  if (!rows.length) return null;
  const A = aggregates(rows);
  const nameEn = C.name;
  const nameId = C.name_id || C.name;
  const name = lang === 'id' ? nameId : nameEn;
  const inv = topInvestors(rows);
  const path = '/city/' + slug;
  const crumb = [{ name: '1001startup.id', path: '/' },
    { name: (lang === 'id' ? 'Startup di ' + nameId : 'Startups in ' + nameEn), path }];
  /* sector mix inside the metro, linking each slice to its sector page */
  const secCount = {};
  for (const c of rows) secCount[c.sector_key] = (secCount[c.sector_key] || 0) + 1;
  const mix = Object.entries(secCount).filter(([k]) => SECTORS[k]).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `<a class="chip" href="${PF}/sector/${esc(k)}">${esc(lang === 'id' ? SECTORS[k].id : SECTORS[k].en)}<b>${n}</b></a>`).join('');
  const h1 = L(`Startups in ${nameEn}`, `Startup di ${nameId}`);
  /* The map draws Greater Jakarta, Bandung and Bali; a city outside them gets no
     map button rather than a map of blank paper. Output is estimated only where
     the anchors fit (lib/metros1001.js) — elsewhere the line says so. */
  const mapHref = !C.mapped ? '' : slug === 'jakarta' ? `${PF}/map` : `${PF}/map?city=${slug}`;
  const body = `
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>${L('CITY', 'KOTA')} · ${esc(name.toUpperCase())}</div>
  <h1>${esc(h1)}.</h1>
  <p class="sub">${lang === 'id'
    ? `Sensus mencatat ${fmt(A.n)} startup yang berkantor pusat di ${esc(name)}. Total pendanaan yang diumumkan mencapai ${usdProse(A.funding, 'id')}, dengan perkiraan ${fmt(A.jobs)} lapangan kerja${C.anchored
      ? ` dan output sekitar ${gvaProse(A.gva, 'id')} per tahun (estimasi). Setiap perusahaan berdiri di alamat aslinya di peta.`
      : `. Output-nya belum diestimasi: anchor sensus adalah angka Jakarta dan akan membuatnya terlalu tinggi. ${esc(name)} juga belum ada di peta.`}`
    : `The census tracks ${fmt(A.n)} ${A.n === 1 ? 'startup' : 'startups'} headquartered in ${esc(name)} — ${usdProse(A.funding, 'en')} of disclosed funding and roughly ${fmt(A.jobs)} jobs (estimated)${C.anchored
      ? `, and ${gvaProse(A.gva, 'en')} a year of output (estimated). Every company stands at its real address on the map.`
      : `. Their output is not estimated yet: the census's anchors are Jakarta's and would overstate it. ${esc(name)} is not on the map yet either.`}`}</p>
  <div class="cta">
    ${mapHref ? `<a class="btn primary" href="${mapHref}">${L('Open the map', 'Buka petanya')}</a>
    <a class="btn" href="${PF}/#companies">${L('The full census', 'Sensus lengkap')}</a>`
      : `<a class="btn primary" href="${PF}/#companies">${L('The full census', 'Sensus lengkap')}</a>
    <a class="btn" href="${PF}/coverage#scope">${L('Where the line is', 'Batas cakupan')}</a>`}
  </div>
</section>
<section class="stats">
  ${[[fmt(A.n), L('companies tracked', 'perusahaan terdata')],
    [usdTile(A.funding, lang), L('disclosed funding', 'pendanaan diumumkan')],
    [fmt(A.jobs), L('jobs — estimate', 'lapangan kerja — estimasi')],
    C.anchored ? [gvaTile(A.gva, lang), L('output / yr — estimate', 'output / thn — estimasi')]
      : ['—', L('output — not estimated here yet', 'output — belum diestimasi di sini')]]
    .map(([v, k]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('SECTOR MIX', 'SEBARAN SEKTOR')}</div>
  <div class="chips">${mix}</div>
</section>
<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('THE COMPANIES', 'DAFTAR PERUSAHAAN')}</div>
  ${rowsTable(rows, lang, PF, L)}
  <p class="foot-note">${L('Ranked as in the census. "—" means no credible public figure. Jobs are estimates; every figure links to its source on the company profile — see ',
    'Urutan mengikuti peringkat sensus. "—" berarti tidak ada angka publik yang kredibel. Angka pekerja adalah estimasi; setiap angka tertaut ke sumbernya di profil perusahaan — lihat ')}<a href="${PF}/coverage#method">${L('how the numbers are made', 'cara kami menghitung')}</a>.</p>
</section>
${inv.length ? `<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('MOST ACTIVE INVESTORS HERE', 'INVESTOR PALING AKTIF DI KOTA INI')}</div>
  <div class="chips">${inv.map((e) => `<a class="chip" href="${PF}/investor/${esc(e.slug)}">${esc(e.name)}<b>${e.n}</b></a>`).join('')}</div>
</section>` : ''}`;
  return shell({
    title: SCHEMA.fitTitle([`${h1} — 1001startup.id`, h1]),
    desc: lang === 'id'
      ? `Daftar ${fmt(A.n)} startup di ${nameId} dengan data pendanaan, jumlah pekerja${C.mapped ? ', sebaran sektor, dan peta kantornya' : ', dan sebaran sektor'} — dari sensus 1001startup.id.`
      : `${fmt(A.n)} startups in ${nameEn} with funding, headcount${C.mapped ? ', sector mix and a real-address map' : ' and sector mix'} — from the 1001startup.id census.`,
    path, lang, body, ld: itemListLd(rows, lang) + SCHEMA.breadcrumbLd(lang, crumb),
    robots: rows.length >= CITY_MIN ? 'index, follow' : 'noindex, follow',
  });
}


/* /unicorn — the census rows carrying a valuation of US$1B or more.
 *
 * The word is a claim, so the page is built to keep it honest three ways.
 * (1) "Unicorn" conventionally means a PRIVATE company at a billion or more,
 *     so a live market capitalisation and a private round are shown as
 *     separate groups rather than added into one headline count.
 * (2) The census carries a valuation for only a fraction of its rows, so this
 *     is a list of companies with a mark ON RECORD — never a claim to be the
 *     complete set of Indonesian unicorns. A company with no public mark is
 *     not a smaller company; it is an unpriced one.
 * (3) A private mark is what someone last paid, so every row prints the year
 *     its figure was set — several are years old, and the page says so.
 */
function unicorn({ data, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const all = (data.companies || []);
  const big = all.filter((c) => typeof c.valuation_usd_m === 'number' && c.valuation_usd_m >= 1000)
    .sort((a, b) => b.valuation_usd_m - a.valuation_usd_m);
  if (!big.length) return null;
  const withMark = all.filter((c) => typeof c.valuation_usd_m === 'number').length;
  const isEst = (c) => c.valuation_est || c.valuation_kind === 'est';
  const priv = big.filter((c) => c.valuation_kind === 'private' && !isEst(c));
  const listed = big.filter((c) => c.valuation_kind === 'listed' && !isEst(c));
  const est = big.filter(isEst);
  const deca = big.filter((c) => c.valuation_usd_m >= 10000);
  const path = '/unicorn';
  const h1 = L("Indonesia's billion-dollar startups", 'Startup Indonesia bernilai US$1 miliar ke atas');
  const crumb = [{ name: '1001startup.id', path: '/' }, { name: h1, path }];

  const tbl = (rows, note) => `<div class="tablewrap"><table>
    <thead><tr><th>#</th><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th>
      <th class="n">${L('Valuation', 'Valuasi')}</th><th class="n">${L('Figure set', 'Angka ditetapkan')}</th></tr></thead>
    <tbody>${rows.map((c) => `<tr>
      <td class="rk">${c.rank}</td>
      <td>${c.logo ? `<img class="lg" src="${esc(c.logo)}" alt="" loading="lazy" width="18" height="18">` : ''}<a href="${PF}/company/${esc(c.id)}">${esc(c.name)}</a></td>
      <td class="mu">${esc(c.sector_label || '')}</td>
      <td class="n">US$${(c.valuation_usd_m / 1000).toFixed(1)}${L('B', ' miliar')}${isEst(c) ? ' <span class="estt">est</span>' : ''}${
        c.valuation_counted === false && c.valuation_parent_id
          ? ` <a class="estt held" href="${PF}/company/${esc(c.valuation_parent_id)}">in parent</a>` : ''}</td>
      <td class="n mu">${esc(c.valuation_asof || L('undated', 'tanpa tanggal'))}</td>
    </tr>`).join('')}</tbody>
  </table></div>${note ? `<p class="foot-note">${note}</p>` : ''}`;

  const body = `
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>${L('VALUATION ON RECORD', 'VALUASI TERCATAT')}</div>
  <h1>${esc(h1)}.</h1>
  <p class="sub">${lang === 'id'
    ? `Sensus mencatat ${fmt(big.length)} perusahaan dengan valuasi US$1 miliar ke atas — ${fmt(priv.length)} dari putaran pendanaan privat, ${fmt(listed.length)} dari kapitalisasi pasar di bursa, dan ${fmt(est.length)} hasil estimasi. Istilah "unicorn" secara konvensi dipakai untuk perusahaan privat, jadi ketiganya ditampilkan terpisah, bukan dijumlahkan menjadi satu angka.`
    : `The census carries ${fmt(big.length)} companies valued at US$1B or more — ${fmt(priv.length)} from private rounds, ${fmt(listed.length)} from a live market capitalisation, and ${fmt(est.length)} estimated. "Unicorn" conventionally describes a private company, so the three are shown apart rather than added into one headline.`}</p>
  <div class="cta">
    <a class="btn primary" href="${PF}/#companies">${L('The full census', 'Sensus lengkap')}</a>
    <a class="btn" href="${PF}/coverage#valuation">${L('What the valuation figures contain', 'Isi angka valuasi')}</a>
  </div>
</section>

<section class="wrap">
  <div class="method" style="border-color:#000">
    <p style="color:#000">${lang === 'id'
      ? `<b>Yang tidak dinyatakan halaman ini.</b> Hanya ${fmt(withMark)} dari ${fmt(all.length)} baris sensus membawa valuasi yang bisa kami rujuk sumbernya, jadi ini bukan daftar lengkap unicorn Indonesia — melainkan daftar perusahaan yang punya angka tercatat. Perusahaan tanpa angka publik bukan berarti lebih kecil; ia hanya belum pernah diberi harga di depan publik. Kami tidak menaksir valuasi dari pendanaan, jumlah pekerja, atau output.`
      : `<b>What this page does not claim.</b> Only ${fmt(withMark)} of the census's ${fmt(all.length)} rows carry a valuation we could source, so this is not a complete list of Indonesian unicorns — it is the list of companies with a figure on record. A company with no public mark is not a smaller company; it is an unpriced one. We never infer a valuation from funding, headcount or output.`}</p>
  </div>
</section>

${priv.length ? `<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('PRIVATE MARKS — THE UNICORN CONVENTION', 'VALUASI PRIVAT — SESUAI KONVENSI UNICORN')}</div>
  ${tbl(priv, L('These are companies with no public listing. Most figures come from a priced round — what an investor last paid, on the date shown — but some are a figure a data provider or a press report carries instead, and one is undated; the provenance of each is on its company page. None is repriced afterwards, so an older year means an older fact, not a current one. A row marked <span class="estt held">in parent</span> already sits inside a parent counted on its own row, so its mark is held out of the census’s combined valuation.',
    'Ini perusahaan yang tidak tercatat di bursa. Sebagian besar angkanya berasal dari putaran pendanaan yang menetapkan harga — yang terakhir dibayar investor, pada tanggal yang tertera — tetapi ada yang berasal dari angka yang dimuat penyedia data atau laporan media, dan satu baris tanpa tanggal; asal-usul tiap angka ada di halaman perusahaannya. Tidak satu pun dinilai ulang setelahnya, jadi tahun yang lebih tua berarti fakta yang lebih tua, bukan kondisi hari ini. Baris bertanda <span class="estt held">in parent</span> sudah berada di dalam induk yang dihitung pada barisnya sendiri, sehingga valuasinya dikeluarkan dari valuasi gabungan sensus.'))}
</section>` : ''}

${listed.length ? `<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('LISTED — MARKET CAPITALISATION', 'TERCATAT DI BURSA — KAPITALISASI PASAR')}</div>
  ${tbl(listed, L('These are public companies, so the figure is a live market capitalisation rather than a private mark — priced every trading day, and read on the date shown. They are listed here because they clear the same threshold, not because the unicorn label applies to them.',
    'Ini perusahaan publik, jadi angkanya adalah kapitalisasi pasar yang bergerak harian, bukan valuasi privat — dibaca pada tanggal yang tertera. Mereka dicantumkan karena melewati ambang yang sama, bukan karena label unicorn berlaku untuk mereka.'))}
</section>` : ''}

${est.length ? `<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('ESTIMATED', 'ESTIMASI')}</div>
  ${tbl(est, L('Derived by us from a parent’s published financials and never disclosed as such — the working is on the company page behind the est mark. Like the listed rows, these are carved out of a public parent, so the unicorn label does not apply to them either; they appear because the Indonesian figure clears the same threshold.',
    'Diturunkan oleh kami dari laporan keuangan publik induknya dan bukan angka yang diumumkan — perhitungannya ada di halaman perusahaan, di balik tanda est. Sama seperti baris yang tercatat di bursa, angka ini dipotong dari induk yang sudah publik, jadi label unicorn juga tidak berlaku untuknya; ia muncul karena angka Indonesianya melewati ambang yang sama.'))}
</section>` : ''}

<section class="wrap">
  <div class="eyebrow"><span class="sq"></span>${L('DECACORNS', 'DECACORN')}</div>
  <p class="lede">${deca.length
    ? L(`${fmt(deca.length)} company at US$10B or more.`, `${fmt(deca.length)} perusahaan bernilai US$10 miliar ke atas.`)
    : L('No company in the census carries a valuation of US$10B or more on record. Group-level figures for foreign parents are deliberately not reprinted as Indonesian valuations — see how global groups are counted.',
      'Tidak ada perusahaan di sensus yang membawa valuasi US$10 miliar ke atas. Angka level grup milik induk asing sengaja tidak dicetak ulang sebagai valuasi Indonesia — lihat cara grup global dihitung.')}
    <a href="${PF}/coverage#scope">${L('Where the line is →', 'Batas cakupan →')}</a></p>
</section>`;

  return shell({
    /* /id leads with the words people search ("startup unicorn indonesia",
       RankMySEO report 5 Oct 2026); the h1 keeps the precise wording */
    title: lang === 'id'
      ? 'Daftar Startup Unicorn Indonesia — 1001startup.id'
      : "Indonesia's billion-dollar startups — 1001startup.id",
    desc: lang === 'id'
      ? `Daftar ${fmt(big.length)} startup Indonesia dengan valuasi US$1 miliar ke atas yang tercatat sumbernya — dipisah antara valuasi privat, kapitalisasi pasar, dan estimasi.`
      : `The ${fmt(big.length)} Indonesian startups with a sourced valuation of US$1B or more — private marks, market capitalisations and estimates kept apart.`,
    path, lang, body, ld: itemListLd(big, lang) + SCHEMA.breadcrumbLd(lang, crumb),
  });
}

module.exports = { sector, sectorHub, city, unicorn, SECTORS, cityIds, indexableCityIds, sectorKeys, shell };
