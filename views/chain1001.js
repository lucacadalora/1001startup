'use strict';
/* 1001startup.id — the supply-chain view.
 *
 * The census answers "who exists". This answers "who works with whom", which is
 * the question a Bloomberg terminal answers with SPLC: for one company, who
 * supplies it, who buys from it, and what evidence says so — then you click a
 * counterparty and ask the same question again.
 *
 * The whole thing rests on public/data/census-links.json (scripts/build-links.js),
 * where an edge only exists if a named document still carries it: an audited
 * filing that names the counterparty, or a first-party page — a help centre, an
 * API reference — published by one side of the relationship. Nothing is inferred
 * from a logo wall, a job ad, or the fact that two companies are in the same
 * business. scripts/links-verify.py re-fetches every source and refuses to
 * publish an edge whose evidence no longer says what it said.
 *
 * ONE renderer, three contexts: panel() inside the company card (drawer and
 * standalone alike), page() for the full chain, index() for the hub.
 *
 * Bilingual: the page frame speaks the request language (lang, via i18n1001),
 * but everything quoted OUT of the links data — filing passages, document
 * titles, publisher names, kind labels, tier badge words — is the sourced
 * record and stays exactly as written.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';
/* The domain a reader recognises, not the bucket it happens to sit on:
   asset-about.blibli.com is Blibli, and saying so is the point of the label. */
const host = (u) => {
  try {
    const h = new URL(u).hostname.replace(/^www\./, '').split('.');
    const n = ['co', 'or', 'ac', 'go', 'net', 'web', 'my', 'sch'].includes(h[h.length - 2]) ? 3 : 2;
    return h.slice(-n).join('.');
  } catch { return 'source'; }
};
const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
};
const DATE = (s, lang) => {
  if (!s) return '';
  const [y, m, d] = String(s).split('-');
  const M = (MONTHS[lang] || MONTHS.en)[Number(m) - 1];
  return d ? `${Number(d)} ${M} ${y}` : `${M} ${y}`;
};
/* What the evidence IS, said in the words a reader can weigh — the same honesty
   the census applies to a funding figure. A filing and a marketing page are both
   sources; they are not the same claim. The badge word itself is a mark label
   and is never translated; the explanation of it is page frame, and is. */
const TIER = {
  filing: ['filing',
    'Named in a company’s own regulatory filing',
    'Disebut dalam dokumen regulator perusahaan itu sendiri'],
  'first-party': ['first-party',
    'Published by one side of the relationship on its own site or docs',
    'Diterbitkan salah satu pihak dalam relasi ini di situs atau dokumentasinya sendiri'],
  reported: ['reported',
    'Reported by press, not confirmed by either company',
    'Diberitakan pers, belum dikonfirmasi oleh kedua perusahaan'],
};
const tierOf = (t, lang) => {
  const x = TIER[t] || [t, '', ''];
  return [x[0], lang === 'id' && x[2] ? x[2] : x[1]];
};

function chip(o, lang = 'en') {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  if (o.id) {
    return `<a class="ch-c" href="${PF}/company/${esc(o.id)}" data-cp="${esc(o.id)}">${
      o.logo ? `<img src="${esc(o.logo)}" alt="" width="16" height="16" loading="lazy">` : ''}${esc(o.name)}</a>`;
  }
  /* an external is not in the census but IS a node: its chain page exists
     because census companies' chains run through it */
  if (o.ext) {
    return `<a class="ch-c ch-off" href="${PF}/chain/x/${esc(o.ext)}"
      title="${L('Not in the census — has a chain page because census companies\' chains run through it',
    'Tidak ada di sensus — punya halaman rantai karena rantai perusahaan sensus melewatinya')}">${esc(o.name)}</a>`;
  }
  return `<span class="ch-c ch-off" title="${L('Not in the census — kept because the relationship is part of the picture',
    'Tidak ada di sensus — tetap dicantumkan karena relasinya bagian dari gambaran utuh')}">${esc(o.name)}</span>`;
}

/* One relationship, as a row. The counterpart, what the relationship is, and the
   document that carries it — never a row without the last part. */
function row(e, lang = 'en') {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const [tw, tt] = tierOf(e.tier, lang);
  const o = e.other;
  const inner = `${o.logo ? `<img class="ch-lg" src="${esc(o.logo)}" alt="" width="22" height="22" loading="lazy">`
    : '<span class="ch-lg ch-bl"></span>'}
    <span class="ch-nm">${esc(o.name)}${o.id ? '' : o.ext
    ? ` <em>${L('outside the census', 'di luar sensus')}</em>`
    : ` <em>${L('not in the census', 'tidak ada di sensus')}</em>`}</span>
    <span class="ch-w">${esc(e.what)}${e.stake ? ` · ${esc(e.stake)}` : ''}${
  e.share ? ` · <b class="ch-sh">${esc(lang === 'id' ? e.share.id : e.share.en)}</b>` : ''}</span>`;
  return `<div class="ch-r">
    ${o.id ? `<a class="ch-l" href="${PF}/company/${esc(o.id)}" data-cp="${esc(o.id)}">${inner}</a>`
    : o.ext ? `<a class="ch-l" href="${PF}/chain/x/${esc(o.ext)}">${inner}</a>`
    : `<span class="ch-l">${inner}</span>`}
    <a class="ch-ev" href="${esc(e.src.url)}" target="_blank" rel="noopener nofollow"
       title="${esc(tt)}${e.quote ? ' — “' + e.quote.slice(0, 220) + '”' : ''}">
      <span class="ch-t ch-t-${esc(tw.replace(/[^a-z]/g, ''))}">${esc(tw)}</span>
      <span class="ch-h">${esc(host(e.src.url))}</span>${e.asof ? `<span class="ch-d">${esc(DATE(e.asof, lang))}</span>` : ''}
    </a>
  </div>`;
}

/* Chain vs services (Luca, 29 Sep: "the inspiration is like the bloomberg
   terminal supplychain … for the logistics things, it won't fit" and "more
   technology and manufacturing chain, not just services"). The chain is who
   makes, supplies, powers and hosts whom, and it leads. Delivery, payments,
   checkout lending and sales channels are kept, with the same evidence, but
   grouped apart, quieter, and folded away wherever the chain itself has
   something to show. The layer travels on each edge from scripts/build-links.js
   (as does `shared`, which now only governs traversal). */
const splitLayers = (list) => ({
  chain: list.filter((e) => e.layer === 'chain'),
  services: list.filter((e) => e.layer !== 'chain'),
});
const SERVICES_NOTE = (lang) => (lang === 'id'
  ? 'Layanan — pengiriman, pembayaran, paylater, kanal penjualan — dicatat dengan bukti yang sama, tetapi bukan rantai pasok: satu kurir atau gateway melayani hampir semua perusahaan. Rantai tidak pernah ditelusuri melewatinya.'
  : 'Services — delivery, payments, checkout lending, sales channels — carry the same evidence, but they are not the supply chain: one courier or gateway serves almost every company. The chain is never followed through them.');
/* The counts every surface leads with: the chain first, services after. */
const tally = (B) => {
  const up = B.up.filter((e) => e.layer === 'chain').length;
  const dn = B.down.filter((e) => e.layer === 'chain').length;
  return { up, dn, chain: up + dn, svc: B.up.length + B.down.length - up - dn, corp: B.corp.length };
};
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
function summaryLine(K, lang) {
  const id = lang === 'id';
  return [K.chain
    ? (id ? `${K.chain} relasi teknologi & manufaktur (${K.up} pemasok, ${K.dn} pelanggan)`
      : `${plural(K.chain, 'technology & manufacturing link', 'technology & manufacturing links')} (${plural(K.up, 'supplier', 'suppliers')}, ${plural(K.dn, 'customer', 'customers')})`)
    : (id ? 'Belum ada relasi teknologi atau manufaktur yang terbukti' : 'No technology or manufacturing link evidenced yet'),
  K.svc ? (id ? `${K.svc} relasi layanan` : plural(K.svc, 'service link', 'service links')) : '',
  K.corp ? (id ? `${K.corp} relasi korporat` : `${K.corp} corporate`) : '',
  ].filter(Boolean).join(' · ') + '.';
}
const NO_CHAIN = (lang) => (lang === 'id'
  ? 'Belum ada relasi teknologi atau manufaktur yang terbukti secara publik.'
  : 'No technology or manufacturing link is publicly evidenced yet.');

/* Grouped by relationship kind, because "four ingredient makers and two
   hardware vendors" is the shape of the answer — a flat list of six is not. */
function sideBlock(list, empty, lang = 'en') {
  const L = I18N.mkL(lang);
  const { chain, services } = splitLayers(list);
  if (!chain.length && !services.length) return `<p class="ch-none">${esc(empty)}</p>`;
  return `${chain.length ? stack(chain, empty, lang) : `<p class="ch-none">${esc(NO_CHAIN(lang))}</p>`}
  ${services.length ? `<details class="ch-rails ch-svc"${chain.length ? '' : ' open'}><summary class="ch-rh">${L('Services', 'Layanan')}<span>${services.length}</span></summary>
    <p class="ch-rn">${esc(SERVICES_NOTE(lang))}</p>${stack(services, empty, lang)}</details>` : ''}`;
}

function stack(list, empty, lang = 'en') {
  if (!list.length) return `<p class="ch-none">${esc(empty)}</p>`;
  const by = new Map();
  for (const e of list) {
    if (!by.has(e.kindLabel)) by.set(e.kindLabel, []);
    by.get(e.kindLabel).push(e);
  }
  return [...by.entries()].map(([k, es]) => `<div class="ch-g">
    <div class="ch-gh">${esc(k)}<span>${es.length}</span></div>
    ${es.map((e) => row(e, lang)).join('')}</div>`).join('');
}

/* Ownership is neither upstream nor downstream — reading "owns" as supply would
   be wrong — so it gets its own line above both columns, in the card and on the
   chain page alike. */
function corporate(list, lang = 'en') {
  if (!list || !list.length) return '';
  const L = I18N.mkL(lang);
  return `<div class="ch-corp">${list.map((e) => `<div class="ch-r ch-rc">
    <span class="ch-cv">${e.dir === 'owns' ? L('Owns', 'Memiliki') : L('Owned by', 'Dimiliki')}</span>${chip(e.other, lang)}
    ${e.stake ? `<span class="ch-st">${esc(e.stake)}</span>` : ''}
    <a class="ch-ev" href="${esc(e.src.url)}" target="_blank" rel="noopener nofollow"
       title="${esc(e.quote || '')}"><span class="ch-t ch-t-filing">${esc(e.tier)}</span>
       <span class="ch-h">${esc(host(e.src.url))}</span></a></div>`).join('')}</div>`;
}

/* ── the block inside the company card ─────────────────────────────────── */
/* lang: the card is served under /id too, and since the /chain pages now exist
   in both languages the full-chain link keeps the reader's language. */
function panel(c, links, lang, lvl = 3) {
  const B = (links && links.byCompany && links.byCompany[c.id]) || null;
  if (!B || (!B.up.length && !B.down.length && !B.corp.length)) return '';
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const K = tally(B);
  return `<section class="cp-sec ch">
    <h${lvl} class="cp-h3">${L('Supply chain', 'Rantai pasok')}</h${lvl}>
    <p class="ch-lead">${esc(summaryLine(K, lang))} ${L(
    `Every one links to the page or filing it came from; each was re-checked on ${esc(DATE(links.verified, lang))}.`,
    `Masing-masing tertaut ke halaman atau dokumen asalnya; semuanya dicek ulang pada ${esc(DATE(links.verified, lang))}.`)}</p>
    ${corporate(B.corp, lang)}
    <div class="ch-cols">
      <div class="ch-col">
        <div class="ch-hd">${L('Suppliers', 'Pemasok')}<span>${K.up}</span></div>
        <p class="ch-sub">${L(`Who supplies ${esc(c.name)}`, `Siapa memasok ${esc(c.name)}`)}</p>
        ${sideBlock(B.up, L('No supplier relationship is publicly evidenced yet.', 'Belum ada relasi pemasok yang terbukti secara publik.'), lang)}
      </div>
      <div class="ch-col">
        <div class="ch-hd">${L('Customers', 'Pelanggan')}<span>${K.dn}</span></div>
        <p class="ch-sub">${L(`Who ${esc(c.name)} supplies`, `Siapa dipasok ${esc(c.name)}`)}</p>
        ${sideBlock(B.down, L('No customer relationship is publicly evidenced yet.', 'Belum ada relasi pelanggan yang terbukti secara publik.'), lang)}
      </div>
    </div>
    <p class="ch-foot"><a href="${PF}/chain/${esc(c.id)}">${L('The full chain, with every source quoted →', 'Rantai lengkapnya, dengan setiap sumber dikutip →')}</a>
      <span>${L('Absence of a link is not absence of a relationship — it means nothing public says so yet.',
    'Tidak adanya tautan bukan berarti tidak ada relasi — artinya belum ada yang menyatakannya secara publik.')}</span></p>
  </section>`;
}

/* ── the ladder: upstream | company | downstream ───────────────────────── */
function ladder(c, B, lang = 'en') {
  const L = I18N.mkL(lang);
  const side = (list, cls) => {
    const grouped = (es) => {
      const by = new Map();
      for (const e of es) {
        if (!by.has(e.kindLabel)) by.set(e.kindLabel, []);
        by.get(e.kindLabel).push(e);
      }
      return [...by.entries()].map(([k, arr]) => `<div class="ch-lgrp">
        <div class="ch-lgh">${esc(k)}</div>
        <div class="ch-lgc">${arr.map((e) => chip(e.other, lang)).join('')}</div></div>`).join('');
    };
    const { chain, services } = splitLayers(list);
    if (!chain.length && !services.length) {
      return `<p class="ch-none">${cls === 'up'
        ? L('No supplier publicly evidenced yet.', 'Belum ada pemasok yang terbukti secara publik.')
        : L('No customer publicly evidenced yet.', 'Belum ada pelanggan yang terbukti secara publik.')}</p>`;
    }
    /* folded unless the side has no chain at all: a wall of thirty couriers and
       wallets under nine suppliers is exactly the picture this page must not paint */
    const kinds = [...new Set(services.map((e) => e.kindLabel))].join(' · ');
    return `${chain.length ? grouped(chain) : `<p class="ch-none">${esc(NO_CHAIN(lang))}</p>`}${
      services.length ? `<details class="lad-rails ch-svc"${chain.length ? '' : ' open'} title="${esc(SERVICES_NOTE(lang))}">
      <summary class="ch-lgh">${L('Services', 'Layanan')} · ${services.length}<span class="lad-sk">${esc(kinds)}</span></summary>${grouped(services)}</details>` : ''}`;
  };
  const K = tally(B);
  /* SPLC-shaped: suppliers left, customers right, the company pinned in the
     middle. The centre card is sticky so it stays alongside a long supplier
     wall instead of floating in dead space, and the connector arrows only draw
     toward a side that actually has relationships. The counts are the chain's;
     services are counted in their own block. */
  return `<div class="lad">
    <div class="lad-s up"><div class="lad-t">${L('Suppliers', 'Pemasok')}<span>${K.up}</span></div>${side(B.up, 'up')}</div>
    <div class="lad-m${B.up.length ? ' has-up' : ''}${B.down.length ? ' has-dn' : ''}"><div class="lad-mstick">
      <div class="lad-co">
        ${c.logo ? `<img src="${esc(c.logo)}" alt="" width="38" height="38">` : ''}
        <b>${esc(c.name)}</b><i>${esc(c.sector_label || '')}</i>
        <span class="lad-deg"><span>${K.up}</span> ${L('in', 'masuk')} · <span>${K.dn}</span> ${L('out', 'keluar')}${
  K.svc ? ` · ${K.svc} ${L('services', 'layanan')}` : ''}</span>
        <span class="lad-arr-in" aria-hidden="true"></span><span class="lad-arr-out" aria-hidden="true"></span>
      </div>
      ${B.corp.length ? `<div class="lad-corp">${B.corp.map((e) => `<div class="lad-cr"><span class="lad-cv">${
    e.dir === 'owns' ? L('owns', 'memiliki') : L('owned by', 'dimiliki')}</span>${chip(e.other, lang)}${e.stake ? `<span class="lad-st">${esc(e.stake)}</span>` : ''}</div>`).join('')}</div>` : ''}
    </div></div>
    <div class="lad-s dn"><div class="lad-t">${L('Customers', 'Pelanggan')}<span>${K.dn}</span></div>${side(B.down, 'dn')}</div>
  </div>`;
}

/* Second hop — the click-through a terminal gives you, pre-computed: where each
   counterparty ALSO turns up. This is what makes the graph a chain rather than
   a list, so it is on the page rather than one click away. */
function secondHop(c, links, lang = 'en') {
  const L = I18N.mkL(lang);
  const B = c.id ? links.byCompany[c.id] : links.byExternal[c.ext];
  const seen = new Set([c.id || 'x:' + c.ext]);
  const out = [];
  for (const e of [...B.up, ...B.down, ...B.corp]) {
    /* only the chain is walked. A service (a courier, a gateway) or a shared
       rail (a hyperscaler, a wallet) would join everything to everything, which
       says something about the service, not the chain — so such a counterparty
       is shown in its column but not expanded */
    const walk = (x) => x.layer === 'chain' && !x.shared;
    if (!walk(e)) continue;
    const o = e.other;
    const key = o.id || (o.ext && 'x:' + o.ext);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const N = (o.id ? links.byCompany[o.id] : links.byExternal && links.byExternal[o.ext])
      || { up: [], down: [], corp: [] };
    /* one chip per company, not one per edge: Gojek carries Blibli's parcels AND
       its wallet, and listing it twice reads as two different Gojeks. */
    const once = new Map();
    for (const x of [...N.up, ...N.down, ...N.corp]) {
      if (!walk(x)) continue;   // same rule one hop out
      const k = x.other.id || (x.other.ext && 'x:' + x.other.ext);
      if (k && x.other.id !== c.id && k !== 'x:' + (c.ext || '') && !once.has(k)) once.set(k, x.other);
    }
    const others = [...once.values()].map((o) => ({ other: o }));
    if (!others.length) continue;
    out.push(`<div class="hop"><div class="hoph">${chip(o, lang)}<span>${L('also', 'juga')}</span></div>
      <div class="hopc">${others.map((x) => chip(x.other, lang)).join('')}</div></div>`);
  }
  return out.length ? `<section class="ch-sec"><h2 class="ch-h2">${L('One hop further', 'Satu langkah lebih jauh')}</h2>
    <p class="ch-p">${L(`Each supplier and customer above, and who else it supplies or buys from — the same question
    asked again, one company along. Only technology and manufacturing links are followed: a courier, a payment
    gateway or a hyperscaler links to nearly everything, which is a fact about the service, not about the chain.`,
    `Setiap pemasok dan pelanggan di atas, dan siapa lagi yang dipasok atau memasoknya — pertanyaan yang sama
    diajukan sekali lagi, satu perusahaan lebih jauh. Hanya relasi teknologi dan manufaktur yang ditelusuri:
    kurir, gateway pembayaran, atau penyedia cloud raksasa terhubung ke hampir semuanya, dan itu bercerita
    tentang layanannya, bukan tentang rantainya.`)}</p>${out.join('')}</section>` : '';
}

const SHELL = (inner, { title, desc, active, lang = 'en', path = '/chain', noindex = false }) => {
  const L = I18N.mkL(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '' : I18N.headTags(lang, path) + '\n' + I18N.ogImage() + '\n'}${noindex ? '' : SCHEMA.breadcrumbLd(lang, path === '/chain'
  ? [{ name: '1001startup.id', path: '/' }, { name: L('Supply chain', 'Rantai pasok'), path: '/chain' }]
  : [{ name: '1001startup.id', path: '/' }, { name: L('Supply chain', 'Rantai pasok'), path: '/chain' }, { name: title.split(' — ')[0], path }])}<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<link rel="stylesheet" href="/css/company1001.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${GRAD};color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
main.chmain{max-width:1180px;margin:0 auto;padding:26px 20px 0}
.crumb{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-bottom:18px}
.crumb a{text-decoration:none;border-bottom:1px solid #D9D9D9;color:#52525B}
.crumb a:hover{color:#000}
footer.site{max-width:1180px;margin:60px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
</style>
</head>
<body>
<div class="banner">${L('WORKING DRAFT · RELATIONSHIPS ARE PUBLISHED ONLY WHERE A NAMED DOCUMENT CARRIES THEM',
    'DRAF KERJA · RELASI HANYA DITERBITKAN BILA ADA DOKUMEN BERNAMA YANG MEMUATNYA')}</div>
${NAV.header(active || 'chain', { lang, path, translated: true })}
<main class="chmain">
${inner}
</main>
<footer class="site">
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · ${L('Anchors: BPS', 'Anchor: BPS')}</span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
};

/* the full two-column list under the ladder, shared by census and external pages */
function allRelationships(name, B, lang = 'en') {
  const L = I18N.mkL(lang);
  const K = tally(B);
  return `<section class="ch-sec"><h2 class="ch-h2">${L('Every relationship', 'Semua relasi')}</h2>
    ${corporate(B.corp, lang)}
    <div class="ch-cols">
      <div class="ch-col"><div class="ch-hd">${L('Suppliers', 'Pemasok')}<span>${K.up}</span></div>
        <p class="ch-sub">${L(`Who supplies ${esc(name)}`, `Siapa memasok ${esc(name)}`)}</p>${sideBlock(B.up, L('Nothing publicly evidenced yet.', 'Belum ada yang terbukti secara publik.'), lang)}</div>
      <div class="ch-col"><div class="ch-hd">${L('Customers', 'Pelanggan')}<span>${K.dn}</span></div>
        <p class="ch-sub">${L(`Who ${esc(name)} supplies`, `Siapa dipasok ${esc(name)}`)}</p>${sideBlock(B.down, L('Nothing publicly evidenced yet.', 'Belum ada yang terbukti secara publik.'), lang)}</div>
    </div></section>`;
}

/* every source behind this company's edges, quoted in full — the part a reader
   has to be able to check without leaving the page */
function evidence(B, links, lang = 'en') {
  const L = I18N.mkL(lang);
  const ids = [...new Set([...B.up, ...B.down, ...B.corp].map((e) => e.src.id))];
  return `<section class="ch-sec"><h2 class="ch-h2">${L('The documents', 'Dokumen sumber')}</h2>
  <ol class="ev">${ids.map((id) => {
    const s = links.sources[id];
    const [tw, tt] = tierOf(s.tier, lang);
    /* every distinct passage this source contributes to THIS company's chain —
       one filing carries the ownership deed, the fulfilment role and the Samsung
       agreement, and showing only the first would bury the other two */
    const qs = [...new Set([...B.up, ...B.down, ...B.corp]
      .filter((e) => e.src.id === id).map((e) => e.quote).filter(Boolean))];
    return `<li>
      <div class="evh"><span class="ch-t ch-t-${esc(tw.replace(/[^a-z]/g, ''))}">${esc(tw)}</span>
        <b>${esc(s.publisher)}</b>${s.asof ? `<span class="evd">${L('as of', 'per')} ${esc(DATE(s.asof, lang))}</span>` : `<span class="evd">${L('undated', 'tanpa tanggal')}</span>`}</div>
      <div class="evt">${esc(s.title)}</div>
      ${qs.map((q) => `<blockquote class="evq">${esc(q)}</blockquote>`).join('')}
      ${s.note ? `<p class="evn">${esc(s.note)}</p>` : ''}
      <p class="evn">${esc(tt)}.</p>
      <a class="evu" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.url)}</a>
    </li>`;
  }).join('')}</ol></section>`;
}

function page({ c, data, links, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const B = (links.byCompany && links.byCompany[c.id]) || { up: [], down: [], corp: [] };
  return SHELL(`<nav class="crumb"><a href="${PF}/">1001startup.id</a> / <a href="${PF}/chain">${L('Supply chain', 'Rantai pasok')}</a> / ${esc(c.name)}</nav>
  <h1 class="ch-h1">${esc(c.name)}</h1>
  <p class="ch-sum">${esc(summaryLine(tally(B), lang))} ${L(`Re-checked ${esc(DATE(links.verified, lang))}.`,
    `Dicek ulang ${esc(DATE(links.verified, lang))}.`)} <a href="${PF}/company/${esc(c.id)}">${L('The company profile →', 'Profil perusahaannya →')}</a></p>
  ${ladder(c, B, lang)}
  ${allRelationships(c.name, B, lang)}
  ${secondHop(c, links, lang)}
  ${evidence(B, links, lang)}
  <p class="crumb" style="margin:22px 0 0"><a href="${PF}/chain">&larr; ${L('All mapped companies', 'Semua perusahaan yang terpetakan')}</a></p>`,
  { title: L(`${c.name} — supply chain — 1001startup.id`, `${c.name} — rantai pasok — 1001startup.id`),
    active: 'chain', lang, path: `/chain/${c.id}`,
    desc: L(`Who supplies ${c.name} and who it supplies, each relationship linked to the filing or first-party page that carries it.`,
      `Pemasok ${c.name} dan siapa yang dipasoknya — setiap relasi rantai pasok tertaut ke dokumen regulator atau halaman pihak pertama yang memuatnya.`) });
}

/* The chain page for a company OUTSIDE the census — FAS is the first. Same
   ladder, same evidence rules; plus the identity section, because an external
   node's whole right to exist here is that a document ties its trading name to
   the legal entity other documents talk about. */
function extPage({ slug, links, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const X = links.byExternal[slug];
  const B = { up: X.up || [], down: X.down || [], corp: X.corp || [] };
  const c = { id: null, ext: slug, name: X.name, sector_label: L('Outside the census', 'Di luar sensus'), logo: null };
  return SHELL(`<nav class="crumb"><a href="${PF}/">1001startup.id</a> / <a href="${PF}/chain">${L('Supply chain', 'Rantai pasok')}</a> / ${esc(X.name)}</nav>
  <h1 class="ch-h1">${esc(X.name)}</h1>
  <p class="ch-sum">${esc(X.legal ? X.legal + '. ' : '')}${L(
    `Not a census company — this page exists because census
    companies' chains run through it.`,
    `Bukan perusahaan sensus — halaman ini ada karena rantai
    perusahaan sensus melewatinya.`)} ${esc(summaryLine(tally(B), lang))} ${L(`Re-checked ${esc(DATE(links.verified, lang))}.`,
    `Dicek ulang ${esc(DATE(links.verified, lang))}.`)}${X.url ? ` <a href="${esc(X.url)}" target="_blank" rel="noopener nofollow">${L('Its website ↗', 'Situs resminya ↗')}</a>` : ''}</p>
  ${X.note ? `<p class="ch-p" style="margin-bottom:22px">${esc(X.note)}</p>` : ''}
  ${ladder(c, B, lang)}
  ${allRelationships(X.name, B, lang)}
  ${(X.identity || []).length ? `<section class="ch-sec"><h2 class="ch-h2">${L('Who this legally is', 'Identitas hukumnya')}</h2>
    ${X.identity.map((e) => `<blockquote class="evq">${esc(e.quote)}</blockquote>
      <p class="evn">${esc(e.note || '')} <a class="evu" href="${esc(e.src.url)}" target="_blank" rel="noopener nofollow">${esc(e.src.url)}</a></p>`).join('')}
  </section>` : ''}
  ${secondHop(c, { ...links, byCompany: links.byCompany }, lang)}
  ${evidence(B, links, lang)}
  <p class="crumb" style="margin:22px 0 0"><a href="${PF}/chain">&larr; ${L('All mapped companies', 'Semua perusahaan yang terpetakan')}</a></p>`,
  { title: L(`${X.name} — supply chain — 1001startup.id`, `${X.name} — rantai pasok — 1001startup.id`),
    active: 'chain', lang, path: `/chain/x/${slug}`,
    desc: L(`${X.name}: who it serves and who serves it, each relationship linked to the document that carries it.`,
      `${X.name}: siapa yang dilayaninya dan siapa yang memasoknya — setiap relasi tertaut ke dokumen yang memuatnya.`) });
}

function index({ data, links, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const co = new Map((data.companies || []).map((x) => [x.id, x]));
  /* census rows and externals in ONE ranking, by how much chain each carries —
     the node a chain runs through most is the one a reader wants first, census
     or not; ownership only breaks ties */
  const rows = [
    ...Object.entries(links.byExternal || {}).map(([slug, X]) => ({
      slug, X, name: X.name, t: tally({ up: X.up || [], down: X.down || [], corp: X.corp || [] }) })),
    ...Object.entries(links.byCompany || {}).filter(([id]) => co.has(id))
      .map(([id, B]) => ({ id, c: co.get(id), name: co.get(id).name, t: tally(B) })),
  ].sort((a, b) => b.t.chain - a.t.chain || b.t.corp - a.t.corp || a.name.localeCompare(b.name));
  const K = links.counts || {};
  const KD = links.kinds || {};
  const tier = Object.entries(K.by_tier || {}).map(([k, v]) => `${v} ${k}`).join(' · ');
  const nChain = K.chain != null ? K.chain : K.edges;
  const nSvc = K.services || 0;
  const cell = (n) => n || '—';
  return SHELL(`<nav class="crumb"><a href="${PF}/">1001startup.id</a> / ${L('Supply chain', 'Rantai pasok')}</nav>
  <h1 class="ch-h1">${L('Who supplies whom', 'Siapa memasok siapa')}</h1>
  <p class="ch-sum">${L(
    `The technology and manufacturing chain around Indonesian startups: who makes their products and parts,
    who supplies their materials and goods, whose hardware, software, energy and cloud they run on — and who buys
    from them. Suppliers on the left, customers on the right. The census is where the map starts, not where it
    ends — any company these chains run through can hold a page, in the census or outside it.
    ${nChain} supply-chain links and ${K.corporate || 0} ownership links (${esc(tier)}), every one a claim some named
    document still makes today: an audited filing that names the counterparty, or a page published by one side of the
    relationship.
    Re-checked ${esc(DATE(links.verified, lang))}.`,
    `Rantai teknologi dan manufaktur di sekitar startup Indonesia: siapa membuat produk dan komponennya,
    siapa memasok bahan dan barangnya, perangkat keras, perangkat lunak, energi, dan cloud siapa yang mereka pakai —
    dan siapa yang membeli dari mereka. Pemasok di kiri, pelanggan di kanan. Sensus adalah titik berangkat peta ini,
    bukan batasnya — perusahaan mana pun yang dilalui rantai ini bisa punya halaman, di dalam sensus maupun di
    luarnya. ${nChain} relasi rantai pasok dan ${K.corporate || 0} relasi kepemilikan (${esc(tier)}) — masing-masing adalah klaim yang
    sampai hari ini masih dimuat sebuah dokumen bernama: laporan keuangan teraudit yang menyebut mitranya, atau
    halaman yang diterbitkan salah satu pihak dalam relasi itu. Dicek ulang ${esc(DATE(links.verified, lang))}.`)}</p>
  <div class="ch-kinds">${Object.entries(K.by_kind || {}).filter(([k]) => (KD[k] || {}).layer === 'chain')
    .map(([k, n]) => `<span class="ch-kn">${esc(KD[k].label)} <b>${n}</b></span>`).join('')}${
  nSvc ? `<span class="ch-kn ch-kn-s">${L('Services', 'Layanan')} <b>${nSvc}</b></span>` : ''}</div>
  <div class="chtbl-w"><table class="chtbl">
    <thead><tr><th>${L('Company', 'Perusahaan')}</th><th class="sc">${L('Sector', 'Sektor')}</th><th class="n">${L('Suppliers', 'Pemasok')}</th><th class="n">${L('Customers', 'Pelanggan')}</th><th class="n ch-ns">${L('Corporate', 'Korporat')}</th></tr></thead>
    <tbody>${rows.map((r) => (r.X ? `<tr onclick="location.href='${PF}/chain/x/${esc(r.slug)}'">
      <td class="nm"><a href="${PF}/chain/x/${esc(r.slug)}">${esc(r.X.name)}</a> <em class="ch-xm">${L('outside the census', 'di luar sensus')}</em></td>
      <td class="sc">${esc(r.X.legal || '')}</td>`
    : `<tr onclick="location.href='${PF}/chain/${esc(r.id)}'">
      <td class="nm">${r.c.logo ? `<img src="${esc(r.c.logo)}" alt="" width="20" height="20" loading="lazy">` : ''}
        <a href="${PF}/chain/${esc(r.id)}">${esc(r.c.name)}</a></td>
      <td class="sc">${esc(r.c.sector_label || '')}</td>`)
    + `<td class="n">${cell(r.t.up)}</td><td class="n">${cell(r.t.dn)}</td><td class="n ch-ns">${cell(r.t.corp)}</td></tr>`).join('')}</tbody>
  </table></div>
  <section class="ch-sec"><h2 class="ch-h2">${L('How a relationship gets in', 'Bagaimana sebuah relasi masuk')}</h2>
    <p class="ch-p">${L(
    `Two ways, and no third. A <b>filing</b>: a listed company's own financial statements name the
      counterparty — Blibli's interim accounts name the phone makers that appointed it as an authorised reseller,
      and Fore Coffee's accounts name its coffee, creamer and packaging suppliers with the amounts involved. A
      <b>first-party page</b>: a customer story, a product page or a help-centre article published by one side of
      the relationship. When the evidence is a picture rather than text — FAS's integration diagram names its
      partners only inside an image — the image itself is pinned by content hash, and the claim is withheld the
      moment the file changes.`,
    `Hanya ada dua jalan masuk, tanpa jalan ketiga. Lewat <b>dokumen regulator</b>: laporan keuangan
      perusahaan terbuka menyebut sendiri mitranya — laporan interim Blibli menyebut produsen ponsel yang
      menunjuknya sebagai penjual resmi, dan laporan keuangan Fore Coffee menyebut pemasok kopi, krimer, dan
      kemasannya beserta nilainya. Atau lewat <b>dokumen pihak pertama</b>: kisah pelanggan, halaman produk, atau
      artikel pusat bantuan yang diterbitkan salah satu pihak dalam relasi itu. Bila buktinya berupa gambar, bukan
      teks — diagram integrasi FAS hanya menyebut mitranya di dalam sebuah gambar — gambar itu dikunci dengan hash
      kontennya, dan klaimnya ditahan begitu berkasnya berubah.`)}</p>
    <p class="ch-p">${L(
    `A company outside the census can still be a node here (marked <em class="ch-xm"
      style="margin:0">outside the census</em>) when census companies' chains run through it, provided a document
      ties its trading name to a legal entity — FAS is PT Global Distribusi Pusaka by its own terms &amp;
      conditions, which is what lets Blibli's filing and FAS's website describe the same company.`,
    `Perusahaan di luar sensus tetap bisa menjadi simpul di sini (ditandai <em class="ch-xm"
      style="margin:0">di luar sensus</em>) bila rantai perusahaan sensus melewatinya — syaratnya, ada dokumen
      yang mengikat nama dagangnya ke sebuah badan hukum. FAS adalah PT Global Distribusi Pusaka menurut syarat
      &amp; ketentuannya sendiri; itulah yang membuat dokumen regulator Blibli dan situs FAS terbaca sebagai
      satu perusahaan yang sama.`)}</p>
    <p class="ch-p">${L(
    `Each edge stores a short string that must still appear in that document.
      <code>scripts/links-verify.py</code> re-fetches all ${K.edges ? Object.keys(links.sources).length : 0} sources and
      re-checks every string; anything that no longer matches is withheld from this page rather than shown with an
      old date. That is the same rule the census applies to a funding figure, applied to a claim about two companies
      at once.`,
    `Setiap relasi menyimpan sepenggal teks yang harus tetap ada di dokumen itu.
      <code>scripts/links-verify.py</code> mengambil ulang semua ${K.edges ? Object.keys(links.sources).length : 0} sumber
      dan mengecek kembali setiap penggalan; yang tak lagi cocok ditahan dari halaman ini, bukan ditampilkan dengan
      tanggal lama. Aturannya sama dengan yang sensus terapkan pada angka pendanaan — di sini berlaku untuk klaim
      yang menyangkut dua perusahaan sekaligus.`)}</p>
    <p class="ch-p">${L(
    `Services are left out. Delivery, payments, checkout lending, sales channels and marketplace
      integrations serve almost every company at once, which says something about the service, not about who
      supplies whom — so they are not drawn here. For the same reason a chain is never followed through a hyperscaler:
      one cloud hosting many of these companies does not make them each other's suppliers.`,
    `Layanan tidak dicantumkan. Pengiriman, pembayaran, paylater, kanal penjualan, dan integrasi
      marketplace melayani hampir semua perusahaan sekaligus — itu bercerita tentang layanannya, bukan tentang siapa
      memasok siapa, jadi tidak digambar di sini. Dengan alasan yang sama, rantai tidak pernah ditelusuri melewati
      penyedia cloud raksasa: satu cloud yang menampung banyak perusahaan di sini tidak menjadikan mereka saling
      memasok.`)}</p>
    <p class="ch-p">${L(
    `What this is not: a procurement database. It shows relationships that were disclosed, not
      everything that exists, and it carries an amount only where a filing states one. A company with no rows here is
      a company nobody has published a relationship for, which is most of them.`,
    `Yang jelas bukan: basis data pengadaan. Halaman ini menampilkan relasi yang diungkap ke
      publik, bukan semua yang ada, dan hanya memuat nilai transaksi bila laporan keuangan menyebutkannya. Perusahaan
      tanpa baris di sini berarti belum ada siapa pun yang menerbitkan relasinya — dan itu berlaku untuk
      kebanyakan perusahaan.`)}</p>
  </section>
  ${(links.excluded || []).length ? `<section class="ch-sec"><h2 class="ch-h2">${L('Claims held out', 'Klaim yang ditahan')}</h2>
    <p class="ch-p">${L(
    `Relationships that were put to the same test and did not pass it. They are listed because a
      quiet omission looks the same as never having looked.`,
    `Relasi yang diuji dengan cara yang sama dan tidak lolos. Kami cantumkan di sini karena
      menghilangkannya diam-diam akan terlihat sama saja dengan tidak pernah memeriksa.`)}</p>
    <ul class="exl">${links.excluded.map((x) => `<li><b>${esc(x.claim)}</b><span>${esc(x.why)}</span></li>`).join('')}</ul>
  </section>` : ''}
  <section class="ch-sec"><h2 class="ch-h2">${L('The documents', 'Dokumen sumber')}</h2>
    <ol class="ev">${Object.entries(links.sources).map(([id, s]) => {
    const [tw, tt] = tierOf(s.tier, lang);
    return `<li><div class="evh"><span class="ch-t ch-t-${esc(tw.replace(/[^a-z]/g, ''))}">${esc(tw)}</span>
      <b>${esc(s.publisher)}</b>${s.asof ? `<span class="evd">${L('as of', 'per')} ${esc(DATE(s.asof, lang))}</span>` : `<span class="evd">${L('undated', 'tanpa tanggal')}</span>`}</div>
      <div class="evt">${esc(s.title)}</div>${s.note ? `<p class="evn">${esc(s.note)}</p>` : ''}
      <p class="evn">${esc(tt)}.</p>
      <a class="evu" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.url)}</a></li>`;
  }).join('')}</ol></section>`,
  { title: L('Supply chain — 1001startup.id', 'Rantai pasok — 1001startup.id'),
    active: 'chain', lang, path: '/chain',
    desc: L(`${nChain} evidenced technology and manufacturing links around Indonesian startups — who makes, supplies, powers and hosts whom — each linked to the filing or first-party page that carries it.`,
      `Peta rantai pasok teknologi dan manufaktur startup Indonesia: ${nChain} relasi pemasok dan pelanggan, masing-masing dibuktikan dokumen regulator atau pihak pertama.`) });
}

function notFound({ links, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return SHELL(`<nav class="crumb"><a href="${PF}/">1001startup.id</a> / <a href="${PF}/chain">${L('Supply chain', 'Rantai pasok')}</a> / ${L('Nothing mapped', 'Belum terpetakan')}</nav>
  <h1 class="ch-h1">${L('No relationship is mapped for that company.', 'Belum ada relasi yang terpetakan untuk perusahaan itu.')}</h1>
  <p class="ch-sum">${L(
    `${(links.counts || {}).companies || 0} companies have at least one relationship a document
    carries. This one has none yet — which says what has been published, not what exists.`,
    `${(links.counts || {}).companies || 0} perusahaan punya setidaknya satu relasi yang dimuat
    dokumen. Yang satu ini belum — dan itu bercerita tentang apa yang sudah terpublikasi, bukan tentang
    apa yang ada.`)}
    <a href="${PF}/chain">${L('See the ones that do →', 'Lihat yang sudah terpetakan →')}</a></p>`,
  { title: L('Nothing mapped — 1001startup.id', 'Belum terpetakan — 1001startup.id'),
    active: 'chain', lang, path: '/chain', noindex: true,
    desc: L('No evidenced relationship for this company yet.', 'Belum ada relasi terbukti untuk perusahaan ini.') });
}

module.exports = { panel, page, index, extPage, notFound };
