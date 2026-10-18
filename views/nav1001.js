'use strict';
const { dcLive } = require('../lib/dclive');
const { peeringLive, graphLive } = require('../lib/peeringlive');
const { homeLive } = require('../lib/homelive');
/**
 * ONE header for every 1001startup.id page. Five views used to carry their own
 * copy of this block and they had already drifted apart (each page showed a
 * different subset of links) — same one-renderer discipline as gva.js.
 *
 * IA: two direct links (Companies, Map) + three dropdowns. "Agents" is the
 * commercial lane the census is headed for (lead search over the data, run by
 * research agents). The dataset entry is deliberately not a link: the working
 * file is gated in server.js, and an item that reads PRIVATE says so honestly
 * instead of pointing at a 403. Group labels and the Agents naming are Luca's
 * to rename; the structure is data-driven so a rename is a one-line edit —
 * the `id` fields beside each label are the Bahasa Indonesia copy, same
 * one-line deal.
 *
 * LANGUAGE: header(active, { lang, path, translated }). English is the
 * default; lang 'id' renders the same header in Indonesian with every link
 * prefixed /id. The EN/ID switch is a pair of real <a>s (works before JS and
 * without it) pointing at THIS page's counterpart — `path` is the bare
 * path+query. Pages that have no Indonesian version yet pass translated:false
 * and the ID side points at the Indonesian landing instead of a URL that
 * would bounce straight back.
 *
 * Dropdowns are CSS-first (:hover / :focus-within) so they work before JS and
 * without it; public/js/nav1001.js adds pin-on-click for touch, aria-expanded,
 * Escape, outside-click close, and the fixed-sheet position on phones.
 */
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');

const NAV = [
  { key: 'companies', label: 'Companies', id: 'Perusahaan', href: '/#companies' },
  { key: 'news', label: 'News', id: 'Berita', href: '/news' },
  { key: 'research', label: 'Research', id: 'Riset', href: '/research' },
  { key: 'map', label: 'Map', id: 'Peta', href: '/map' },
  { key: 'chain', label: 'Supply chain', id: 'Rantai pasok', href: '/chain' },
  { key: 'investors', label: 'Investors', id: 'Investor', href: '/investors' },
  {
    key: 'census', label: 'Census', id: 'Sensus', items: [
      { label: 'Sectors', id: 'Sektor', desc: 'The census grouped by what companies build', id_desc: 'Sensus dikelompokkan menurut apa yang dibangun tiap perusahaan', href: '/sector' },
      { label: 'State companies (BUMN)', id: 'BUMN', desc: 'State companies on ten yardsticks, as a logo quadrant', id_desc: 'BUMN pada sepuluh tolok ukur, dalam kuadran logo', href: '/bumn' },
      { label: 'Data centres', id: 'Pusat data', desc: 'Who powers them, and the companies that own and build them', id_desc: 'Siapa yang memasok listriknya, dan perusahaan di baliknya', href: '/data-center' },
      { label: 'The monthly report', id: 'Laporan bulanan', desc: 'Four findings from the census, figures frozen', id_desc: 'Empat temuan dari sensus, angkanya dibekukan', href: '/report' },
      { label: 'Billion-dollar startups', id: 'Startup unicorn', desc: 'Every census company valued at US$1B or more', id_desc: 'Perusahaan sensus bervaluasi US$1 miliar ke atas', href: '/unicorn' },
      { label: 'Valuation', id: 'Valuasi', desc: 'What the combined figure contains', id_desc: 'Isi angka valuasi gabungan', href: '/coverage#valuation' },
      { label: 'Y Combinator', id: 'Y Combinator', desc: 'The Indonesian cohort, batch by batch', id_desc: 'Kohor Indonesia, batch demi batch', href: '/coverage#yc' },
      { label: 'Endeavor', id: 'Endeavor', desc: 'The Endeavor Entrepreneur companies', id_desc: 'Perusahaan para Endeavor Entrepreneur', href: '/coverage#endeavor' },
      { label: 'Antler', id: 'Antler', desc: 'The residency cohorts, and the roster gap', id_desc: 'Kohor residensi Antler, dan siapa yang belum masuk sensus', href: '/coverage#antler' },
      { label: 'Closed', id: 'Sudah tutup', desc: 'What stopped, with dates and sources', id_desc: 'Yang berhenti beroperasi — lengkap dengan tanggal dan sumber', href: '/closed' },
    ],
  },
  {
    key: 'method', label: 'Method', id: 'Metode', items: [
      { label: 'How the numbers are made', id: 'Cara kami menghitung', desc: 'Anchors, inclusion rules, caveats', id_desc: 'Anchor BPS, aturan cakupan, dan batasannya', href: '/coverage#method' },
      { label: 'The formal model', id: 'Model formal', desc: 'The GVA estimator, written out', id_desc: 'Estimator nilai tambah, ditulis lengkap', href: '/model' },
      { label: 'What the output figure is', id: 'Arti angka output', desc: 'Value added — not revenue, not salary', id_desc: 'Nilai tambah — bukan pendapatan, bukan gaji', href: '/coverage#output' },
      { label: 'Where the line is', id: 'Batas cakupan', desc: 'What is deliberately not counted, and why', id_desc: 'Yang sengaja tidak dihitung, dan alasannya', href: '/coverage#scope' },
      { label: 'Taken out', id: 'Dikeluarkan', desc: 'Rows removed after a liveness check', id_desc: 'Baris yang dihapus setelah terbukti tak lagi beroperasi', href: '/closed#removed' },
      { label: 'About', id: 'Tentang', desc: 'Who builds the census, and how to cite it', id_desc: 'Siapa yang membangun sensus ini, dan cara mengutipnya', href: '/about' },
    ],
  },
  {
    key: 'agents', label: 'Agents', id: 'Agen', align: 'r', items: [
      { label: 'The dataset', id: 'Dataset', tag: 'private', id_tag: 'privat', desc: 'Held back — every figure is on its company page with the sources behind it', id_desc: 'Ditahan — setiap angka ada di halaman perusahaannya beserta sumbernya', href: null },
      { label: 'Lead search', id: 'Cari kontak', desc: 'The right person at each census company, found by research agents', id_desc: 'Orang yang tepat di tiap perusahaan sensus, ditemukan agen riset', href: '/leads' },
    ],
  },
];

/* The four-dataset front page (lib/homelive.js, Luca 18 Oct 2026): the
   startups table moves to /startups and "Companies" becomes a Datasets menu
   holding the four censuses. BUMN and Data centres move here out of Census.
   While the switch is off, NAV above is served exactly as before. */
const DATASETS = {
  key: 'datasets', label: 'Datasets', id: 'Dataset', items: [
    { label: 'Startups', id: 'Startup', desc: 'The startup census: funding, investors, headcount and offices', id_desc: 'Sensus startup: pendanaan, investor, jumlah pekerja, dan kantor', href: '/startups' },
    { label: 'State companies (BUMN)', id: 'BUMN', desc: 'State companies on ten yardsticks, as a logo quadrant', id_desc: 'BUMN pada sepuluh tolok ukur, dalam kuadran logo', href: '/bumn' },
    { label: 'Data centres', id: 'Pusat data', desc: 'Who powers them, and the companies that own and build them', id_desc: 'Siapa yang memasok listriknya, dan perusahaan di baliknya', href: '/data-center' },
    { label: 'Peering map', id: 'Peta peering', desc: 'Every data centre, exchange and router port on PeeringDB', id_desc: 'Setiap pusat data, exchange, dan port router di PeeringDB', href: '/peering' },
    { label: 'Peering graph', id: 'Graf peering', desc: 'Which networks sit in which data centres, and where they peer', id_desc: 'Jaringan mana ada di pusat data mana, dan di mana mereka peering', href: '/graph' },
    { label: 'Exporters (UMKM)', id: 'Eksportir (UMKM)', desc: 'Exporting SMEs: what they make, where they ship, how each was verified', id_desc: 'UMKM eksportir: produknya, pasar tujuannya, dan cara tiap baris diverifikasi', href: '/umkm' },
  ],
};
const MOVED = new Set(['/bumn', '/data-center']);
const NAV_LIVE = [DATASETS].concat(NAV.filter((n) => n.key !== 'companies').map((n) => (n.key === 'census'
  ? Object.assign({}, n, { items: n.items.filter((it) => !MOVED.has(it.href)) })
  : n)));
/* the nav as it should render right now */
const navNow = () => (homeLive() ? NAV_LIVE : NAV);
/* where "the full census" lives: /startups once the front page is live, the
   old landing's table anchor before that. PF is '' or '/id'. */
const censusHref = (PF) => (PF || '') + (homeLive() ? '/startups' : '/#companies');
/* "back to the census" links that went to the bare front page */
const censusHome = (PF) => (PF || '') + (homeLive() ? '/startups' : '/');

/** active: 'companies' | 'news' | 'research' | 'map' | 'chain' | 'census' | 'method' | 'agents' | ''
 *  opts:   { lang: 'en'|'id', path: bare path+query of this page for the
 *            language switch, translated: false when no /id version exists } */
function header(active, opts) {
  const { lang = 'en', path = '/', translated = true } = opts || {};
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const live = homeLive();
  /* once live, the four dataset pages light up the Datasets menu */
  if (live && (active === 'companies' || /^\/(startups|bumn|data-center|peering|graph|umkm)(\/|\?|#|$)/.test(path || ''))) active = 'datasets';
  const item = (it) => {
    const body = `<b>${esc(L(it.label, it.id))}${it.tag ? `<em class="ntag">${esc(L(it.tag, it.id_tag))}</em>` : ''}</b><i>${esc(L(it.desc || '', it.id_desc))}</i>`;
    return it.href
      ? `<a class="di" href="${esc(PF + it.href)}">${body}</a>`
      : `<span class="di off">${body}</span>`;
  };
  const links = navNow().map((n) => {
    const on = n.key === active ? ' on' : '';
    if (!n.items) return `<a${on ? ` class="${on.trim()}"` : ''} href="${esc(PF + n.href)}">${esc(L(n.label, n.id))}</a>`;
    return `<div class="dd${n.align === 'r' ? ' r' : ''}">
      <button class="dd-b${on}" type="button" aria-expanded="false">${esc(L(n.label, n.id))}<span class="cv" aria-hidden="true"></span></button>
      <div class="dd-p"><div class="dd-i">${n.items.filter((it) => (it.href !== '/data-center' || dcLive()) && (it.href !== '/peering' || peeringLive()) && (it.href !== '/graph' || graphLive())).map(item).join('')}</div></div>
    </div>`;
  }).join('');
  /* The language switch. Real links, no JS: EN is the bare URL, ID the /id
     one. On a page with no Indonesian version the ID side goes to the
     Indonesian landing — a link that 302s straight back would read as a
     button that does nothing. */
  const p = path || '/';
  const idHref = translated ? '/id' + (p === '/' ? '/' : p) : '/id/';
  const lsw = `<div class="lsw" aria-label="${lang === 'id' ? 'Bahasa' : 'Language'}">
    <a href="${esc(p)}"${lang === 'id' ? '' : ' class="on" aria-current="true"'} lang="en" hreflang="en" title="English">EN</a><span class="ls" aria-hidden="true">/</span><a href="${esc(idHref)}"${lang === 'id' ? ' class="on" aria-current="true"' : ''} lang="id" hreflang="id" title="Bahasa Indonesia">ID</a>
  </div>`;
  /* live: on a phone the header is one row (brand + Menu) and the links open
     as an in-flow sheet under it — the wrapped three-row header took a third
     of the first screen. public/js/nav1001.js toggles .mopen. */
  const mtog = live ? `
  <button class="mtog" type="button" aria-expanded="false" aria-controls="hnav1001" data-open="${esc(L('Close', 'Tutup'))}" data-shut="Menu"><span class="mtl">Menu</span><span class="mti" aria-hidden="true"></span></button>` : '';
  return `<header class="hd1001${live ? ' m1' : ''}"><div class="hrow">
  <a class="brand" href="${esc(PF + '/')}"><span class="bx">1001</span>1001startup.id</a>${mtog}
  <nav class="hnav"${live ? ' id="hnav1001"' : ''} aria-label="Site">
    ${links}
    ${lsw}
    <!--PX-BADGE-->
  </nav>
  <!--ACCT1001-->
</div></header>`;
}

/* Header styles, scoped under .hd1001 — company1001.js has a second <header>
 * (the profile card's .cp-top), so bare header{} selectors are not safe there. */
const css = `
.hd1001{border-bottom:1px solid #E7E7E7;background:#fff}
.hd1001 .hrow{max-width:1180px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:22px}
.hd1001 .brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-weight:600}
.hd1001 .bx{width:26px;height:26px;border:1.5px solid #000;display:grid;place-items:center;font:600 9px/1 'IBM Plex Mono',monospace}
.hnav{display:flex;gap:4px;margin-left:auto;font-size:14px;align-items:center}
.hnav>a{text-decoration:none;color:#52525B;padding:7px 10px}
.hnav>a:hover{color:#000}
.hnav>a.on,.dd-b.on{color:#000;box-shadow:inset 0 -2px #E8734B}
.dd{position:relative}
.dd-b{font:inherit;letter-spacing:inherit;background:none;border:0;cursor:pointer;color:#52525B;padding:7px 10px;display:flex;align-items:center;gap:7px}
.dd-b .cv{width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .15s}
.dd:hover .dd-b,.dd:focus-within .dd-b,.dd.open .dd-b{color:#000}
.dd:hover .cv,.dd:focus-within .cv,.dd.open .cv{transform:rotate(225deg) translateY(-1px)}
.dd-p{position:absolute;left:0;top:100%;padding-top:11px;display:none;z-index:90}
.dd.r .dd-p{left:auto;right:0}
.dd:hover>.dd-p,.dd:focus-within>.dd-p,.dd.open>.dd-p{display:block}
.dd-i{background:#fff;border:1px solid #E7E7E7;min-width:288px;box-shadow:0 14px 34px rgba(0,0,0,.09);padding:6px}
.di{display:block;padding:9px 12px;text-decoration:none}
a.di:hover{background:#F6F6F6}
.di b{display:block;font-weight:500;color:#000;font-size:14px;line-height:1.3}
.di i{display:block;font-style:normal;font-size:12.5px;line-height:1.35;color:#6B6B73;margin-top:2px;letter-spacing:0;word-spacing:.05em}
.di.off{cursor:default}
.di.off b{color:#52525B}
.ntag{font:400 9px/1 'IBM Plex Mono',monospace;font-style:normal;text-transform:uppercase;letter-spacing:.06em;border:1px solid #D9D9DE;color:#6B6B73;padding:3px 5px;margin-left:8px;display:inline-block;transform:translateY(-2px)}
.lsw{display:flex;align-items:center;gap:5px;margin-left:8px;padding-left:14px;border-left:1px solid #E7E7E7;font:400 10.5px/1 'IBM Plex Mono',monospace;letter-spacing:.06em}
.lsw a{text-decoration:none;color:#6B6B73;padding:6px 2px}
.lsw a:hover{color:#000}
.lsw a.on{color:#000;box-shadow:inset 0 -2px #000}
.lsw .ls{color:#D9D9DE}
/* The account link, filled per request by lib/account1001.js. It sits in the
   brand row, OUTSIDE the nav: inside it, it pushed the nav past the screen at
   1366-1440 px. Up to 1600 px the header becomes brand row + nav row, so the
   nav row keeps exactly the width it had before the link existed. */
.hd1001 .hnav{order:1}
.hd1001 .hrow>a.acct{order:2;margin-left:10px;border:1px solid #000;color:#000;padding:7px 12px;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;text-decoration:none}
.hd1001 .hrow>a.acct:hover{background:#000;color:#fff}
.hd1001 .hrow>a.acct.on{border-color:#D9D9DE;color:#52525B}
.hd1001 .hrow>a.acct.on:hover{border-color:#000;background:#fff;color:#000}
@media(max-width:1600px){.hd1001 .hrow:has(>a.acct){flex-wrap:wrap}.hd1001 .hrow:has(>a.acct) .hnav{order:3;flex-basis:100%;margin-left:0;flex-wrap:wrap}.hd1001 .hrow>a.acct{margin-left:auto}}
@media(max-width:1280px){.hd1001 .hrow{flex-wrap:wrap;gap:12px}.hnav{margin-left:0;flex-wrap:wrap}}
@media(max-width:700px){.hd1001 .hrow{flex-wrap:wrap;gap:10px}.hnav{gap:2px;font-size:13px;flex-wrap:wrap}
.hnav>a,.dd-b{padding:6px 8px}
.dd{position:static}
.dd-p{position:fixed;left:12px;right:12px;top:auto;padding-top:0}
.dd-i{min-width:0;box-shadow:0 16px 40px rgba(0,0,0,.16)}
.lsw{margin-left:4px;padding-left:10px}}
.mtog{display:none}
@media(max-width:700px){
.hd1001.m1 .hrow{flex-wrap:wrap;gap:0;padding:12px 16px}
.hd1001.m1 .mtog{display:flex;align-items:center;gap:9px;margin-left:auto;background:#fff;border:1px solid #000;color:#000;padding:10px 12px;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;cursor:pointer;min-height:40px}
.hd1001.m1 .mti{width:14px;height:9px;border-top:1.5px solid currentColor;border-bottom:1.5px solid currentColor;position:relative}
.hd1001.m1 .mti::after{content:'';position:absolute;left:0;right:0;top:3px;border-top:1.5px solid currentColor}
.hd1001.m1.mopen .mtog{background:#000;color:#fff}
.hd1001.m1 .hnav{display:none;width:100%;flex-direction:column;align-items:stretch;gap:0;margin:12px 0 0;border-top:1px solid #E7E7E7;font-size:16px}
.hd1001.m1.mopen .hnav{display:flex}
.hd1001.m1 .hnav>a,.hd1001.m1 .dd-b{width:100%;padding:14px 2px;border-bottom:1px solid #F1F1F1;color:#000;justify-content:space-between}
.hd1001.m1 .hnav>a.on,.hd1001.m1 .dd-b.on{box-shadow:inset 3px 0 #E8734B;padding-left:12px}
.hd1001.m1 .dd{position:static}
.hd1001.m1 .dd:hover>.dd-p,.hd1001.m1 .dd:focus-within>.dd-p{display:none}
.hd1001.m1 .dd-p{position:static;padding:0}
.hd1001.m1 .dd.open>.dd-p{display:block}
.hd1001.m1 .dd-i{min-width:0;box-shadow:none;border:0;border-bottom:1px solid #F1F1F1;padding:4px 0 8px 12px}
.hd1001.m1 .di{padding:10px 4px}
.hd1001.m1 .lsw{margin:14px 0 4px;padding:0;border:0;font-size:12px}
.hd1001.m1 .hrow>a.acct{order:2;margin-left:auto;padding:0 12px;min-height:40px;display:flex;align-items:center}
.hd1001.m1 .mtog{order:3}
.hd1001.m1 .hrow:has(>a.acct) .mtog{margin-left:8px}
.hd1001.m1 .hnav{order:4}
.hd1001.m1 .hnav>.pxb,.hd1001.m1 .hnav>[class*="px"]{margin:10px 0 6px;align-self:flex-start}
}
`;

module.exports = { header, css, NAV, NAV_LIVE, navNow, censusHref, censusHome };
