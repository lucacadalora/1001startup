'use strict';
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

/** active: 'companies' | 'news' | 'research' | 'map' | 'chain' | 'census' | 'method' | 'agents' | ''
 *  opts:   { lang: 'en'|'id', path: bare path+query of this page for the
 *            language switch, translated: false when no /id version exists } */
function header(active, opts) {
  const { lang = 'en', path = '/', translated = true } = opts || {};
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const item = (it) => {
    const body = `<b>${esc(L(it.label, it.id))}${it.tag ? `<em class="ntag">${esc(L(it.tag, it.id_tag))}</em>` : ''}</b><i>${esc(L(it.desc || '', it.id_desc))}</i>`;
    return it.href
      ? `<a class="di" href="${esc(PF + it.href)}">${body}</a>`
      : `<span class="di off">${body}</span>`;
  };
  const links = NAV.map((n) => {
    const on = n.key === active ? ' on' : '';
    if (!n.items) return `<a${on ? ` class="${on.trim()}"` : ''} href="${esc(PF + n.href)}">${esc(L(n.label, n.id))}</a>`;
    return `<div class="dd${n.align === 'r' ? ' r' : ''}">
      <button class="dd-b${on}" type="button" aria-expanded="false">${esc(L(n.label, n.id))}<span class="cv" aria-hidden="true"></span></button>
      <div class="dd-p"><div class="dd-i">${n.items.map(item).join('')}</div></div>
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
  return `<header class="hd1001"><div class="hrow">
  <a class="brand" href="${esc(PF + '/')}"><span class="bx">1001</span>1001startup.id</a>
  <nav class="hnav" aria-label="Site">
    ${links}
    ${lsw}
    <!--PX-BADGE-->
  </nav>
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
@media(max-width:1280px){.hd1001 .hrow{flex-wrap:wrap;gap:12px}.hnav{margin-left:0;flex-wrap:wrap}}
@media(max-width:700px){.hd1001 .hrow{flex-wrap:wrap;gap:10px}.hnav{gap:2px;font-size:13px;flex-wrap:wrap}
.hnav>a,.dd-b{padding:6px 8px}
.dd{position:static}
.dd-p{position:fixed;left:12px;right:12px;top:auto;padding-top:0}
.dd-i{min-width:0;box-shadow:0 16px 40px rgba(0,0,0,.16)}
.lsw{margin-left:4px;padding-left:10px}}
`;

module.exports = { header, css, NAV };
