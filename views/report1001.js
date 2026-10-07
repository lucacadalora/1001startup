'use strict';
/* /report/<YYYY-MM> — the census report, one frozen edition per month it is
 * cut (RankMySEO report, 5 Oct 2026: digital PR from the census data is the
 * way to earn links; a report needs a fixed URL and numbers that do not move).
 *
 * Figures come from data/report-<edition>.json, frozen by
 * scripts/report-snapshot.js; the live census keeps changing underneath, and
 * the page says so. Every company named links to its page, where the sources
 * are. Copy frame translates; company names stay as recorded.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');

const DIR = path.join(__dirname, '..', 'data');
const editions = () => {
  try { return fs.readdirSync(DIR).map((f) => (f.match(/^report-(\d{4}-\d{2})\.json$/) || [])[1]).filter(Boolean).sort(); } catch { return []; }
};
const load = (ed) => {
  if (!/^\d{4}-\d{2}$/.test(ed || '')) return null;
  try { return JSON.parse(fs.readFileSync(path.join(DIR, `report-${ed}.json`), 'utf8')); } catch { return null; }
};
const fmt = (n, d = 0) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d });
const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
};
const monthName = (ed, lang) => `${MONTHS[lang === 'id' ? 'id' : 'en'][+ed.slice(5, 7) - 1]} ${ed.slice(0, 4)}`;
const dateOf = (iso, lang) => new Date(iso).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const usdM = (m, lang) => m >= 1000
  ? `US$${fmt(m / 1000, 1)} ${lang === 'id' ? 'miliar' : 'billion'}`
  : `US$${fmt(m, 1)} ${lang === 'id' ? 'juta' : 'million'}`;
const KIND = {
  listed: ['market capitalisation', 'kapitalisasi pasar'],
  private: ['private round', 'putaran privat'],
  est: ['estimate', 'estimasi'],
};

function report({ edition, lang = 'en' }) {
  const R = load(edition);
  if (!R) return null;
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const pth = '/report/' + edition;
  const mon = monthName(edition, lang);
  const F = R.funding, I = R.investors, X = R.closed, V = R.valuation, G = R.geography;
  const co = (id, name) => `<a href="${PF}/company/${esc(id)}">${esc(name)}</a>`;
  const slugClosed = require('./closed1001').slugClosed;
  const listed = V.billion_plus.filter((x) => x.kind === 'listed').length;
  const est = V.billion_plus.filter((x) => x.kind === 'est').length;
  const priv = V.billion_plus.length - listed - est;
  const notConfirmed = (X.confidence && X.confidence.reported) || 0;
  const worst = Object.entries(X.by_year).sort((a, b) => b[1] - a[1])[0] || ['', 0];
  const top1 = F.top10[0];
  const cite = L(`Source: 1001startup.id census, ${mon} edition — ${I18N.ORIGIN}${pth}`,
    `Sumber: sensus 1001startup.id, edisi ${mon} — ${I18N.ORIGIN}/id${pth}`);

  const h1 = L(`Indonesia’s startup census: the ${mon} report`, `Laporan Sensus Startup Indonesia: ${mon}`);
  const body = `
<section class="hero">
  <div class="eyebrow"><span class="sq"></span>${L('REPORT', 'LAPORAN')} · ${esc(mon.toUpperCase())}</div>
  <h1>${esc(h1)}.</h1>
  <p class="sub">${L(
    `Four findings from the ${fmt(R.companies)} Indonesian startups on record — where the disclosed money sits, who backs whom, what stopped, and how few valuations are public. Every company named links to its page, where the sources are. Free to cite with credit.`,
    `Empat temuan dari ${fmt(R.companies)} startup Indonesia yang tercatat — ke mana dana yang diumumkan mengalir, siapa mendanai siapa, apa yang berhenti, dan betapa sedikit valuasi yang terbuka. Setiap perusahaan yang disebut tertaut ke halamannya, tempat sumbernya berada. Bebas dikutip dengan menyebut sumber.`)}</p>
</section>
<section class="stats">
  ${[[fmt(R.companies), L('startups on record', 'startup tercatat')],
    [usdM(F.usd_m, lang), L(`disclosed funding, ${fmt(F.rows)} companies`, `pendanaan diumumkan, ${fmt(F.rows)} perusahaan`)],
    [fmt(I.named), L('investors named', 'investor tercatat')],
    [fmt(X.entries), L('startups that stopped', 'startup yang berhenti')]]
    .map(([v, k]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}
</section>

<section class="wrap" id="funding">
  <div class="eyebrow"><span class="sq"></span>${L('1 · THE MONEY', '1 · DANANYA')}</div>
  <h2 class="rh">${L(`Ten companies hold ${fmt(F.top10_share, 1)}% of the disclosed money.`, `Sepuluh perusahaan memegang ${fmt(F.top10_share, 1)}% dana yang diumumkan.`)}</h2>
  <p class="lede">${lang === 'id'
    ? `Dari ${usdM(F.usd_m, 'id')} pendanaan yang diumumkan oleh ${fmt(F.rows)} dari ${fmt(R.companies)} perusahaan, sepuluh penggalang dana terbesar menyumbang ${fmt(F.top10_share, 1)}%. ${esc(top1.name)} sendiri mencatat ${usdM(top1.usd_m, 'id')}. ${fmt(R.companies - F.rows)} perusahaan tidak punya angka pendanaan yang diumumkan — itu tidak diketahui, bukan nol.`
    : `Of ${usdM(F.usd_m, 'en')} in disclosed funding across ${fmt(F.rows)} of the ${fmt(R.companies)} companies, the ten largest account for ${fmt(F.top10_share, 1)}%. ${esc(top1.name)} alone accounts for ${usdM(top1.usd_m, 'en')}. ${fmt(R.companies - F.rows)} companies have no disclosed figure — that is unknown, not zero.`}</p>
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>${L('Company', 'Perusahaan')}</th><th class="n">${L('Disclosed US$M', 'Diumumkan (US$ juta)')}</th><th class="n">${L('Share of all disclosed', 'Porsi dari total')}</th></tr></thead>
    <tbody>${F.top10.map((x, i) => `<tr><td class="rk">${i + 1}</td><td>${co(x.id, x.name)}</td><td class="n">${fmt(x.usd_m, 1)}</td><td class="n">${Number(x.share).toFixed(1)}%</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<section class="wrap" id="investors">
  <div class="eyebrow"><span class="sq"></span>${L('2 · THE BACKERS', '2 · PENDANANYA')}</div>
  <h2 class="rh">${L(`A few investors back many companies; ${fmt(I.one_company)} back just one.`, `Segelintir investor mendanai banyak perusahaan; ${fmt(I.one_company)} hanya mendanai satu.`)}</h2>
  <p class="lede">${lang === 'id'
    ? `${fmt(I.named)} investor disebut namanya pada ${fmt(I.companies_with_named_investors)} perusahaan sensus. ${esc(I.top[0].name)} mendanai ${fmt(I.top[0].n)} di antaranya — terbanyak dari investor mana pun — sementara ${fmt(I.one_company)} investor hanya muncul di satu perusahaan.`
    : `${fmt(I.named)} investors are named on ${fmt(I.companies_with_named_investors)} census companies. ${esc(I.top[0].name)} backs ${fmt(I.top[0].n)} of them, more than any other investor, while ${fmt(I.one_company)} investors appear on a single company.`}</p>
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>${L('Investor', 'Investor')}</th><th class="n">${L('Census companies backed', 'Perusahaan sensus yang didanai')}</th></tr></thead>
    <tbody>${I.top.map((x, i) => `<tr><td class="rk">${i + 1}</td><td><a href="${PF}/investor/${esc(x.slug)}">${esc(x.name)}</a></td><td class="n">${fmt(x.n)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<section class="wrap" id="closed">
  <div class="eyebrow"><span class="sq"></span>${L('3 · WHAT STOPPED', '3 · YANG BERHENTI')}</div>
  <h2 class="rh">${L(`${fmt(X.entries)} startups stopped between ${X.first_year} and ${X.last_year}; ${worst[0]} was the worst year.`, `${fmt(X.entries)} startup berhenti antara ${X.first_year} dan ${X.last_year}; ${worst[0]} tahun terburuknya.`)}</h2>
  <p class="lede">${lang === 'id'
    ? `Daftar penutupan sensus memuat ${fmt(X.entries)} startup Indonesia yang berhenti beroperasi antara ${X.first_year} dan ${X.last_year}; ${fmt(worst[1])} di antaranya berakhir pada ${worst[0]}. ${fmt(X.funded)} yang punya putaran pendanaan diumumkan telah menghimpun ${usdM(X.funded_usd_m, 'id')}, dipimpin ${esc(X.top[0].name)} (${usdM(X.top[0].usd_m, 'id')}). ${fmt(notConfirmed)} dari ${fmt(X.entries)} dilaporkan pers kredibel tetapi belum dikonfirmasi perusahaannya.`
    : `The census's closed register holds ${fmt(X.entries)} Indonesian startups that stopped operating between ${X.first_year} and ${X.last_year}; ${fmt(worst[1])} of them ended in ${worst[0]}. The ${fmt(X.funded)} with a disclosed round had raised ${usdM(X.funded_usd_m, 'en')} between them, led by ${esc(X.top[0].name)} (${usdM(X.top[0].usd_m, 'en')}). ${fmt(notConfirmed)} of the ${fmt(X.entries)} are reported by credible press but not confirmed by the company.`}</p>
  <div class="split">
    <div class="tablewrap"><table class="narrow">
      <thead><tr><th>${L('Year ended', 'Tahun berakhir')}</th><th class="n">${L('Startups', 'Startup')}</th></tr></thead>
      <tbody>${Object.entries(X.by_year).sort().map(([y, n]) => `<tr><td>${esc(y)}</td><td class="n">${fmt(n)}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="tablewrap"><table class="narrow">
      <thead><tr><th>${L('Raised the most', 'Menghimpun terbanyak')}</th><th class="n">${L('Disclosed US$M', 'Diumumkan (US$ juta)')}</th><th class="n">${L('Ended', 'Berakhir')}</th></tr></thead>
      <tbody>${X.top.map((x) => `<tr><td><a href="${PF}/company/${esc(slugClosed(x.name))}">${esc(x.name)}</a>${x.confidence !== 'confirmed' ? ` <span class="estt">${L('reported', 'dilaporkan')}</span>` : ''}</td><td class="n">${fmt(x.usd_m, 1)}</td><td class="n">${esc(String(x.ended).slice(0, 7))}</td></tr>`).join('')}</tbody>
    </table></div>
  </div>
</section>

<section class="wrap" id="valuations">
  <div class="eyebrow"><span class="sq"></span>${L('4 · WHAT IS PUBLIC', '4 · YANG TERBUKA')}</div>
  <h2 class="rh">${L(`Only ${fmt(V.marked)} of ${fmt(R.companies)} carry a public valuation.`, `Hanya ${fmt(V.marked)} dari ${fmt(R.companies)} yang punya valuasi terbuka.`)}</h2>
  <p class="lede">${lang === 'id'
    ? `${fmt(V.marked)} perusahaan sensus punya valuasi yang tercatat sumbernya; ${fmt(V.billion_plus.length)} di antaranya bernilai US$1 miliar ke atas — ${fmt(priv)} dari putaran privat, ${fmt(listed)} kapitalisasi pasar saham, dan ${fmt(est)} estimasi. Valuasi sebagian besar ekosistem tidak terbuka, jadi ini bukan daftar lengkap unicorn Indonesia.`
    : `${fmt(V.marked)} census companies have a sourced valuation on record; ${fmt(V.billion_plus.length)} are at US$1 billion or more — ${fmt(priv)} from private rounds, ${fmt(listed)} stock-market capitalisations and ${fmt(est)} an estimate. Most of the ecosystem's valuations are not public, so this is not a complete list of Indonesian unicorns.`}</p>
  <div class="tablewrap"><table>
    <thead><tr><th>${L('Company', 'Perusahaan')}</th><th class="n">${L('Valuation', 'Valuasi')}</th><th>${L('What the figure is', 'Jenis angkanya')}</th></tr></thead>
    <tbody>${V.billion_plus.map((x) => `<tr><td>${co(x.id, x.name)}</td><td class="n">${usdM(x.usd_m, lang)}</td><td class="mu">${esc(L(...(KIND[x.kind] || KIND.private)))}${x.asof ? ` · ${esc(String(x.asof))}` : ''}</td></tr>`).join('')}</tbody>
  </table></div>
</section>

<section class="wrap" id="scope">
  <div class="eyebrow"><span class="sq"></span>${L('WHAT THIS EDITION COVERS', 'CAKUPAN EDISI INI')}</div>
  <div class="method"><p>${lang === 'id'
    ? `Sejak 28 Sep 2026 sensus menghitung perusahaan di mana pun kantor pusatnya di Indonesia, tetapi cakupan di luar Jabodetabek masih dibangun: ${fmt(G.jakarta)} dari ${fmt(R.companies)} perusahaan berkantor di Jabodetabek. Baca porsi itu sebagai cakupan sensus, bukan temuan nasional. Hanya sumber publik; angka yang tidak bisa ditelusuri sumbernya dibiarkan kosong. Angka di halaman ini dibekukan pada ${dateOf(R.frozen_at, 'id')}; halaman perusahaan terus diperbarui. <a href="${PF}/coverage#method">Cara kami menghitung</a>.`
    : `Since 28 Sep 2026 the census counts a company wherever in Indonesia its head office is, but coverage outside Greater Jakarta is still being built: ${fmt(G.jakarta)} of the ${fmt(R.companies)} companies are in Greater Jakarta. Read that share as the census's coverage, not as a national finding. Public sources only; a figure that cannot be sourced is left blank. The figures on this page were frozen on ${dateOf(R.frozen_at, 'en')}; company pages keep updating. <a href="${PF}/coverage#method">How the numbers are made</a>.`}</p></div>
</section>

<section class="wrap" id="cite">
  <div class="eyebrow"><span class="sq"></span>${L('USING THE DATA', 'MEMAKAI DATANYA')}</div>
  <p class="lede">${L('Quote any figure with the credit below and a link. For a figure about one company, link that company’s page — that is where its sources are. Questions, corrections or a data request:',
    'Kutip angka mana pun dengan kredit di bawah dan tautannya. Untuk angka satu perusahaan, tautkan halaman perusahaan itu — di sanalah sumbernya. Pertanyaan, koreksi, atau permintaan data:')} <a href="${PF}/about">${L('who builds the census, and how to reach him', 'siapa yang membangun sensus ini, dan cara menghubunginya')}</a>.</p>
  <p class="citeline">${esc(cite)}</p>
</section>
<style>
.rh{font-size:clamp(22px,2.6vw,32px);line-height:1.15;letter-spacing:-0.02em;font-weight:500;max-width:30ch;margin-bottom:12px}
.split{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:16px}
@media(max-width:760px){.split{grid-template-columns:minmax(0,1fr)}}
table.narrow{min-width:0}
.method a,.lede a{border-bottom:1px solid #C7C7CC;text-decoration:none}
.citeline{border-left:3px solid #000;padding:10px 14px;font-size:15px;line-height:1.6;background:#FAFAFA;max-width:92ch;overflow-wrap:anywhere}
</style>`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Report', name: h1, inLanguage: lang === 'id' ? 'id-ID' : 'en',
    url: I18N.ORIGIN + PF + pth, datePublished: R.frozen_at.slice(0, 10),
    author: { '@type': 'Person', name: 'Luca Cada Lora' },
    publisher: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
    isBasedOn: I18N.ORIGIN + '/',
  };
  return shell({
    title: SCHEMA.fitTitle(lang === 'id'
      ? [`Laporan Sensus Startup Indonesia, ${mon} — 1001startup.id`, `Laporan Sensus Startup Indonesia, ${mon}`]
      : [`Indonesia startup census report, ${mon} — 1001startup.id`, `Indonesia startup census report, ${mon}`]),
    desc: SCHEMA.fitDesc(lang === 'id'
      ? [`Empat temuan dari ${fmt(R.companies)} startup Indonesia: sepuluh perusahaan memegang ${fmt(F.top10_share, 0)}% dana yang diumumkan, ${fmt(X.entries)} startup berhenti sejak ${X.first_year}, dan hanya ${fmt(V.marked)} yang punya valuasi terbuka.`]
      : [`Four findings from ${fmt(R.companies)} Indonesian startups: ten hold ${fmt(F.top10_share, 0)}% of disclosed funding, ${fmt(X.entries)} stopped since ${X.first_year}, and only ${fmt(V.marked)} carry a public valuation.`]),
    path: pth, lang, body,
    ld: `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
      + SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('Report', 'Laporan') + ' ' + mon, path: pth }]),
  });
}

module.exports = { report, editions };
