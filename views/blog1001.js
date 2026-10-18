'use strict';
/* /news — census data stories (replaced THE WIRE, 18 Oct 2026).
 *
 * The automated wire only recycled other outlets' news and earned almost no
 * search or AI-assistant visits (/news: 11 entrances in 7 weeks against 1,431
 * for company pages). /news is now a short blog of DATA STORIES: each post
 * answers one question from the census, dated, with a table, a link on every
 * row and links into the company and investor pages.
 *
 * Copy: views/posts1001.js. Numbers: data/news/<slug>.json, frozen by
 * scripts/news-snapshot.js. A post is public only when its frozen file exists.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const { shell } = require('./browse1001');
const research1001 = require('./research1001');
const { POSTS } = require('./posts1001');

const DIR = path.join(__dirname, '..', 'data', 'news');
const cache = new Map();
function load(slug) {
  const file = path.join(DIR, slug + '.json');
  let st;
  try { st = fs.statSync(file); } catch { return null; }
  const hit = cache.get(slug);
  if (hit && hit.mtime === st.mtimeMs) return hit.data;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache.set(slug, { mtime: st.mtimeMs, data });
    return data;
  } catch { return hit ? hit.data : null; }
}
/* published posts, newest first (a post with no frozen file is not published) */
function list() {
  return POSTS.map((p) => ({ p, P: load(p.slug) })).filter((x) => x.P)
    .sort((a, b) => b.P.date.localeCompare(a.P.date) || POSTS.indexOf(a.p) - POSTS.indexOf(b.p));
}
const slugs = () => list().map((x) => x.p.slug);
const dateOf = (slug) => { const P = load(slug); return P ? P.date : null; };

const MON = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
};
const MONTH = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
};
const SECTOR_ID = {
  Logistics: 'Logistik', 'Climate & Sustainability': 'Iklim & keberlanjutan', 'Travel & Mobility': 'Travel & mobilitas',
  Crypto: 'Kripto', 'Other tech': 'Teknologi lainnya', Climate: 'Iklim', 'Home services': 'Layanan rumah',
  'Marketing tech': 'Teknologi pemasaran', Gaming: 'Gim', Travel: 'Travel',
};

/* helpers handed to every post; all number formatting lives here */
function helpers(lang) {
  const PF = I18N.pfx(lang);
  const loc = lang === 'id' ? 'id-ID' : 'en-US';
  const fmt = (n, d = 0) => Number(n || 0).toLocaleString(loc, { maximumFractionDigits: d });
  const usdM = (m) => (m >= 1000
    ? `US$${fmt(m / 1000, 1)} ${lang === 'id' ? 'miliar' : 'billion'}`
    : `US$${fmt(m, 1)} ${lang === 'id' ? 'juta' : 'million'}`);
  const usdShort = (m) => fmt(m, m < 1 ? 2 : 1);
  /* stat tiles: the short form so a tile never wraps */
  const usdTile = (m) => (m >= 1000 ? `US$${fmt(m / 1000, 1)}${lang === 'id' ? ' miliar' : 'B'}` : `US$${fmt(m, 1)}${lang === 'id' ? ' jt' : 'M'}`);
  const ymd = (s) => {
    const [y, m, d] = String(s || '').split('-');
    if (!m) return y || '';
    return `${d ? +d + ' ' : ''}${MON[lang === 'id' ? 'id' : 'en'][+m - 1]} ${y}`;
  };
  const dateLong = (s) => { const [y, m, d] = s.split('-'); return `${+d} ${MONTH[lang === 'id' ? 'id' : 'en'][+m - 1]} ${y}`; };
  const list = (a) => {
    const x = a.filter(Boolean);
    if (x.length < 2) return x.join('');
    const and = lang === 'id' ? 'dan' : 'and';
    return x.length === 2 ? `${x[0]} ${and} ${x[1]}` : `${x.slice(0, -1).join(', ')}${lang === 'id' ? ',' : ''} ${and} ${x[x.length - 1]}`;
  };
  const coHref = (id) => `${PF}/company/${encodeURIComponent(id)}`;
  const invHref = (slug) => `${PF}/investor/${encodeURIComponent(slug)}`;
  const closedHref = coHref;
  const co = (id, name) => `<a href="${coHref(id)}">${esc(name)}</a>`;
  const inv = (slug, name) => `<a href="${invHref(slug)}">${esc(name)}</a>`;
  const closedCo = co;
  const logo = (r) => (r.logo
    ? `<img class="lg" src="${esc(r.logo)}" alt="" loading="lazy" width="18" height="18">`
    : `<span class="lg mono-t" aria-hidden="true">${esc(String(r.name || '?').trim().charAt(0).toUpperCase())}</span>`);
  const src = (u, h) => (u ? `<a class="src" href="${esc(u)}" rel="nofollow noopener" target="_blank" title="${esc(u)}">${esc(h || 'source')} ↗</a>` : '—');
  const sector = (s) => (lang === 'id' && SECTOR_ID[s]) || s;
  const stats = (cells) => `<section class="stats">${cells.map(([v, k]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('')}</section>`;
  const bars = (items, caption) => {
    const max = Math.max(...items.map((x) => x.v), 1);
    return `<figure class="bars"><figcaption>${esc(caption)}</figcaption>${items.map((x) => `<div class="br"><span class="bn">${x.logo !== undefined ? logo(x) : ''}${x.href ? `<a href="${x.href}">${esc(x.name)}</a>` : esc(x.name)}</span><span class="bt"><span style="width:${(x.v / max * 100).toFixed(1)}%"></span></span><b>${x.text}</b></div>`).join('')}</figure>`;
  };
  const yearCols = (byYear, first, last, mini = false) => {
    const ys = [];
    for (let y = first; y <= last; y++) ys.push([String(y), byYear[y] || 0]);
    const max = Math.max(...ys.map((x) => x[1]), 1);
    return `<figure class="cols${mini ? ' mini' : ''}">${ys.map(([y, n]) => `<div class="cl"><b>${n}</b><span style="height:${(n / max * 100).toFixed(1)}%"></span><i>${mini ? "'" + y.slice(2) : y}</i></div>`).join('')}</figure>`;
  };
  const miniBars = (items) => {
    const max = Math.max(...items.map((x) => x.v), 1);
    return `<div class="mb">${items.map((x) => `<div><i>${esc(x.name)}</i><span style="width:${(x.v / max * 100).toFixed(1)}%"></span><b>${x.v}</b></div>`).join('')}</div>`;
  };
  const logoStrip = (rows) => `<div class="ls">${rows.filter((r) => r.logo).slice(0, 12).map((r) => `<img src="${esc(r.logo)}" alt="${esc(r.name)}" loading="lazy" width="34" height="34">`).join('')}</div>`;
  const method = (html) => `<section class="pb"><div class="method"><p class="mh">${lang === 'id' ? 'Cara menghitung' : 'How this was counted'}</p><p>${html}</p></div></section>`;
  const postLink = (slug, text) => `<a class="more" href="${PF}/news/${slug}">${esc(text)} →</a>`;
  return { lang, PF, fmt, usdM, usdShort, usdTile, ymd, dateLong, list, co, coHref, inv, invHref, closedCo, closedHref, logo, src, sector, stats, bars, yearCols, miniBars, logoStrip, method, postLink };
}

const CSS = `<style>
.nwrap{max-width:860px;margin:0 auto;padding:0 20px}
.nhead{padding:44px 0 28px}
.nhead h1{font-size:clamp(32px,4.6vw,54px);line-height:1.06;letter-spacing:-0.03em;font-weight:500;max-width:22ch}
.nhead .sub{color:#52525B;font-size:17px;line-height:1.55;max-width:62ch;margin-top:14px}
.nhead .crumb{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;margin-bottom:22px}
.nhead .crumb a{text-decoration:none;border-bottom:1px solid #D9D9D9}
.answer{border-left:3px solid #000;background:#FAFAFA;padding:18px 20px;margin:0 0 30px;font-size:17px;line-height:1.6}
.answer .ak{display:block;font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#6B6B73;margin-bottom:10px}
.answer a,.pb p a,.method a{text-decoration:none;border-bottom:1px solid #C7C7CC}
.nwrap .stats{width:100%;margin:0 0 8px}
.pb{padding:30px 0 0}
.pb h2{font-size:clamp(21px,2.4vw,27px);line-height:1.2;letter-spacing:-0.02em;font-weight:500;margin-bottom:12px}
.pb>p{color:#3F3F46;font-size:16px;line-height:1.65;max-width:68ch;margin:0 0 16px}
.nwrap table{min-width:640px}
.nwrap table.narrow{min-width:0}
td.co{white-space:nowrap}
td .pc{display:inline-block;margin-right:12px}
.lg{vertical-align:-4px;margin-right:8px;border-radius:3px}
.mono-t{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;background:#6B665E;color:#fff;font:600 10px/1 'Overused Grotesk',sans-serif}
.kt{display:inline-block;font:400 9.5px/1.2 'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;color:#6B6B73;border:1px solid #E7E7E7;padding:2px 5px;margin-right:4px;vertical-align:1px;white-space:nowrap}
a.src{font:400 11.5px/1.3 'IBM Plex Mono',monospace;color:#52525B;white-space:nowrap}
.bars{margin:6px 0 22px;padding:16px 0;border-block:1px solid #E7E7E7}
.bars figcaption{font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;margin-bottom:12px}
.br{display:grid;grid-template-columns:minmax(120px,210px) minmax(0,1fr) 64px;gap:12px;align-items:center;margin:7px 0;font-size:14px}
.br .bn{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.br .bn a{text-decoration:none}
.br .bt{height:14px;background:#F4F4F5;display:block}
.br .bt span{display:block;height:100%;background:linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96);background-size:600px 100%}
.br b{font:400 12.5px/1 'IBM Plex Mono',monospace;text-align:right}
.cols{display:flex;align-items:flex-end;gap:10px;height:180px;margin:6px 0 22px;padding:16px 0 0;border-bottom:1px solid #E7E7E7}
.cols .cl{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px}
.cols .cl span{display:block;width:100%;max-width:64px;background:#4E7A96;min-height:1px}
.cols .cl b{font:400 12px/1 'IBM Plex Mono',monospace}
.cols .cl i{font:400 11px/1 'IBM Plex Mono',monospace;font-style:normal;color:#6B6B73;padding-bottom:8px}
.cols.mini{height:100%;gap:5px;margin:0;padding:0;border:0}
.cols.mini .cl b{font-size:10px}.cols.mini .cl i{font-size:9.5px;padding:0}
.method{border:1px solid #E7E7E7;padding:20px 22px}
.method .mh{font:400 11px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:#000;margin-bottom:10px}
.method p{color:#52525B;font-size:14.5px;line-height:1.6;max-width:none}
.cite{border-left:3px solid #000;padding:10px 14px;font-size:14px;line-height:1.6;background:#FAFAFA;overflow-wrap:anywhere;margin-top:12px}
.more{display:inline-block;font-weight:600;text-decoration:none;border-bottom:1px solid #000}
.nmeta{font:400 11px/1.6 'IBM Plex Mono',monospace;letter-spacing:.06em;text-transform:uppercase;color:#6B6B73;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.nmeta .k{color:#000;display:inline-flex;align-items:center;gap:7px}
.nmeta .k:before{content:'';width:6px;height:6px;background:#E8734B;display:inline-block}
/* index */
.plist{border-top:1px solid #E7E7E7}
.pcard{display:grid;grid-template-columns:minmax(0,1fr) 240px;gap:28px;padding:28px 0;border-bottom:1px solid #E7E7E7;align-items:start}
.pcard h2{font-size:clamp(22px,2.6vw,30px);line-height:1.15;letter-spacing:-0.02em;font-weight:500;margin:10px 0 10px}
.pcard h2 a{text-decoration:none}.pcard h2 a:hover{text-decoration:underline;text-underline-offset:4px}
.pcard p{color:#52525B;font-size:15.5px;line-height:1.6;max-width:62ch}
.pcard .th{text-decoration:none;color:inherit;border:1px solid #E7E7E7;background:#FAFAFA;height:150px;padding:14px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.ls{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.ls img{width:34px;height:34px;border-radius:6px;background:#fff;border:1px solid #EEE;object-fit:contain}
.mb{width:100%;display:grid;gap:7px}
.mb div{display:grid;grid-template-columns:86px minmax(0,1fr) 22px;gap:6px;align-items:center;font-size:11px}
.mb i{font-style:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mb span{display:block;height:9px;background:#4E7A96}
.mb b{font:400 10.5px/1 'IBM Plex Mono',monospace;text-align:right}
.rnote{padding:28px 0 0}
.rnote h2{font-size:20px;font-weight:500;margin:10px 0 8px}
.rnote h2 a{text-decoration:none;border-bottom:1px solid #C7C7CC}
.rnote p{color:#52525B;font-size:15px;line-height:1.6;max-width:68ch}
@media(max-width:720px){
 .pcard{grid-template-columns:minmax(0,1fr);gap:16px}
 .pcard .th{height:120px;order:2}
 .br{grid-template-columns:minmax(0,118px) minmax(0,1fr) 52px;gap:8px;font-size:13px}
 .answer{font-size:16px;padding:16px}
 .cols{gap:6px}
}
</style>`;

function ld(lang, p, P, h, title, desc, pth) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: title, description: desc,
    datePublished: P.date, dateModified: P.date, inLanguage: lang === 'id' ? 'id-ID' : 'en',
    mainEntityOfPage: I18N.ORIGIN + PF + pth, url: I18N.ORIGIN + PF + pth,
    author: { '@type': 'Person', name: 'Luca Cada Lora' },
    publisher: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
    isBasedOn: I18N.ORIGIN + '/', articleSection: L(...p.kicker),
  }).replace(/</g, '\\u003c')}</script>`;
}

const strip = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function post({ slug, lang = 'en' }) {
  const p = POSTS.find((x) => x.slug === slug);
  const P = p && load(slug);
  if (!P) return null;
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const h = helpers(lang);
  const pth = '/news/' + slug;
  const title = p.title(L, P, h);
  const deck = p.deck(L, P, h);
  const answer = p.answer(L, P, h);
  const others = list().filter((x) => x.p.slug !== slug);
  const cite = L(`Source: 1001startup.id census, data frozen ${h.dateLong(P.date)} — ${I18N.ORIGIN}${pth}`,
    `Sumber: sensus 1001startup.id, data dibekukan ${h.dateLong(P.date)} — ${I18N.ORIGIN}/id${pth}`);
  const REL = {
    '/investors': L('All investors', 'Semua investor'), '/closed': L('The shutdown register', 'Daftar penutupan'),
    '/report/2026-10': L('October 2026 census report', 'Laporan sensus Oktober 2026'), '/model': L('How jobs and output are estimated', 'Cara kami mengestimasi lapangan kerja dan output'),
    '/coverage': L('What the census covers', 'Cakupan sensus'),
  };
  const body = `${CSS}
<article class="nwrap">
<header class="nhead">
  <p class="crumb"><a href="${PF}/news">← ${L('News', 'Berita')}</a></p>
  <div class="nmeta"><span class="k">${esc(L(...p.kicker))}</span><span>${L('Data story', 'Cerita data')}</span><time datetime="${P.date}">${esc(h.dateLong(P.date))}</time></div>
  <h1 style="margin-top:14px">${esc(title)}</h1>
  <p class="sub">${deck}</p>
</header>
<div class="answer"><span class="ak">${L('Short answer', 'Jawaban singkat')}</span>${answer}</div>
${p.body(L, P, h)}
<section class="pb">
  <h2>${L('Using these numbers', 'Memakai angka ini')}</h2>
  <p>${L('Quote any figure with the credit below and a link. For a figure about one company, link that company’s page: that is where its sources are. The figures on this page were frozen on the date above; company pages keep updating.',
    'Kutip angka mana pun dengan kredit di bawah dan tautannya. Untuk angka satu perusahaan, tautkan halaman perusahaan itu: di sanalah sumbernya. Angka di halaman ini dibekukan pada tanggal di atas; halaman perusahaan terus diperbarui.')}</p>
  <p class="cite">${esc(cite)}</p>
</section>
<section class="pb">
  <h2>${L('More from the census', 'Lainnya dari sensus')}</h2>
  <p>${[...others.map((x) => `<a href="${PF}/news/${x.p.slug}">${esc(x.p.title(L, x.P, h))}</a>`), ...p.related.filter((r) => REL[r]).map((r) => `<a href="${PF}${r}">${REL[r]}</a>`)].join(' · ')}</p>
</section>
</article>`;
  const desc = strip(answer);
  return shell({
    title: SCHEMA.fitTitle([`${title} — 1001startup.id`, title]),
    desc: SCHEMA.fitDesc([desc]),
    path: pth, lang, body, active: 'news',
    ld: ld(lang, p, P, h, title, desc, pth)
      + SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('News', 'Berita'), path: '/news' }, { name: title, path: pth }]),
  });
}

function index({ lang = 'en' } = {}) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const h = helpers(lang);
  const items = list();
  const body = `${CSS}
<div class="nwrap">
<header class="nhead">
  <div class="nmeta"><span class="k">${L('News', 'Berita')}</span></div>
  <h1 style="margin-top:14px">${L('Data stories from the census.', 'Cerita data dari sensus.')}</h1>
  <p class="sub">${L('Each post answers one question about Indonesian startups with the census’s own numbers: dated, in a table, and linked to the company pages and the sources behind every row.',
    'Setiap tulisan menjawab satu pertanyaan tentang startup Indonesia dengan angka sensus sendiri: bertanggal, dalam tabel, dan tertaut ke halaman perusahaan serta sumber di balik setiap baris.')}</p>
</header>
<div class="plist">${items.map(({ p, P }) => `<article class="pcard">
  <div>
    <div class="nmeta"><span class="k">${esc(L(...p.kicker))}</span><time datetime="${P.date}">${esc(h.dateLong(P.date))}</time></div>
    <h2><a href="${PF}/news/${p.slug}">${esc(p.title(L, P, h))}</a></h2>
    <p>${strip(p.answer(L, P, h))}</p>
  </div>
  <a class="th" href="${PF}/news/${p.slug}" aria-hidden="true" tabindex="-1">${p.thumb(P, h)}</a>
</article>`).join('')}</div>
<section class="rnote" id="indonesia-ai-factory-imports">
  <div class="nmeta"><span class="k">${L('Research', 'Riset')}</span><time datetime="${research1001.DATE}">${esc(h.dateLong(research1001.DATE))}</time></div>
  <h2><a href="${PF + research1001.ARTICLE_PATH}">${L('Searching for H200 and B300 AI clusters in Indonesia’s imports', 'Menelusuri klaster AI H200 dan B300 dalam impor Indonesia')}</a></h2>
  <p>${L('Longer research pieces live in the Research section.', 'Tulisan riset yang lebih panjang ada di bagian Riset.')} <a href="${PF}/research">${L('All research', 'Semua riset')} →</a></p>
</section>
</div>`;
  const newest = items[0];
  const listLd = {
    '@context': 'https://schema.org', '@type': 'Blog', name: L('1001startup.id News', 'Berita 1001startup.id'),
    url: I18N.ORIGIN + PF + '/news', inLanguage: lang === 'id' ? 'id-ID' : 'en',
    publisher: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
    blogPost: items.map(({ p, P }) => ({ '@type': 'BlogPosting', headline: p.title(L, P, h), datePublished: P.date, url: I18N.ORIGIN + PF + '/news/' + p.slug })),
  };
  return shell({
    title: SCHEMA.fitTitle([L('Indonesian startup data stories — 1001startup.id News', 'Cerita data startup Indonesia — Berita 1001startup.id'), L('News — 1001startup.id', 'Berita — 1001startup.id')]),
    desc: SCHEMA.fitDesc([L(`Data stories from the 1001startup.id census of Indonesian startups: who raised money in 2026, the biggest employers, the most active investors and the startups that shut down.${newest ? ' Updated ' + h.dateLong(newest.P.date) + '.' : ''}`,
      `Cerita data dari sensus startup Indonesia 1001startup.id: siapa yang mendapat dana pada 2026, pemberi kerja terbesar, investor paling aktif, dan startup yang tutup.${newest ? ' Diperbarui ' + h.dateLong(newest.P.date) + '.' : ''}`)]),
    path: '/news', lang, body, active: 'news',
    ld: `<script type="application/ld+json">${JSON.stringify(listLd).replace(/</g, '\\u003c')}</script>`
      + SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('News', 'Berita'), path: '/news' }]),
  });
}

module.exports = { index, post, slugs, dateOf, list };
