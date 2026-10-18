'use strict';
/* 1001startup.id — the front page once the site holds four datasets
 * (Luca, 18 Oct 2026: "proper landing page … like professional crunchbase /
 * dataset company … showcase the existing data/live pages", with
 * umkm.vantis.sh folded in at /umkm).
 *
 * Served at / only while lib/homelive.js says so; the startup table it
 * replaces moves, unchanged, to /startups. Same house system as every 1001
 * page (Overused Grotesk + IBM Plex Mono, white, hairlines, square, the one
 * 4-stop gradient), and the gradient's four stops become the four datasets'
 * markers: startups #E8734B, BUMN #F3C64B, data centres #7AB88A, exporters
 * #4E7A96 — used as squares and rules only, never as text colour (the raw
 * stops fail contrast on white).
 *
 * Every number and every preview is read from the datasets themselves on each
 * render (the same mtime-cached files the dataset pages use): the startup
 * rows, the BUMN quadrant placed from the scores, the data-centre power
 * drawings, the exporter sectors. Nothing on this page is typed in by hand.
 * One search box covers all four (public/js/home1001.js over
 * /data/search-index.json: names, sectors and places only).
 *
 * A fifth card (Luca, 18 Oct 2026: "put the dc.1001startup.id into
 * 1001startup.id home page along with the 4 dataset … so people knows about
 * website providing the data center and routing/peer data") points at the
 * peering map on its own host, while data/peering.live is on. Its marker is
 * the map's own line blue, #36A9FF. It shows counts and the busiest
 * buildings only: the PeeringDB rows themselves stay on dc.1001startup.id
 * (their AUP: no bulk pass-on), so the card stays out of the search index
 * and the schema.org catalog.
 */
const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001');
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const FOOT = require('./footer1001');
const { dcLive } = require('../lib/dclive');
const { iconsLive } = require('../lib/iconslive');
const { graphLive } = require('../lib/peeringlive');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';
const DC = { s: '#E8734B', b: '#F3C64B', d: '#7AB88A', e: '#4E7A96', p: '#36A9FF' };
const PEER = 'https://dc.1001startup.id/';

/* data/home-assets.json — the small content-named copies of the art
   (scripts/home-assets.py). Missing manifest = the originals. */
const ASSETS_FILE = path.join(__dirname, '..', 'data', 'home-assets.json');
let assetsCache = { mtime: 0, data: { dc: {}, sprites: {}, map: null } };
function assets() {
  try {
    const st = fs.statSync(ASSETS_FILE);
    if (st.mtimeMs !== assetsCache.mtime) assetsCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8')) };
  } catch { /* keep the last good copy */ }
  return assetsCache.data;
}

const fmt = (n, d = 0) => (n === null || n === undefined) ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
const dateOf = (s, lang) => {
  const t = Date.parse(s || '');
  return t ? new Date(t).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '';
};

/* The BUMN quadrant, placed on the server: the same rules as /bumn's own
   drawing (public/js/bumn1001.js) — square 0–5 scale both ways padded to
   −0.5..5.5, lines at the median, a company sharing a score with others
   nudged apart within a band around its true spot — in unit coordinates so
   the preview scales with the card. Default lens = /bumn's default preset. */
const quadCache = new WeakMap();
function bumnQuad(bumn) {
  if (!bumn || !Array.isArray(bumn.entities)) return null;
  if (quadCache.has(bumn)) return quadCache.get(bumn);
  const pre = (bumn.presets || [])[0] || { x: 'earned', y: 'state', quads: {} };
  const kx = pre.x, ky = pre.y;
  const E = bumn.entities.filter((e) => e.scores && e.scores[kx] != null && e.scores[ky] != null);
  const med = (a) => { const s = a.slice().sort((p, q) => p - q), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const LO = -0.5, SPAN = 6;
  const X = (v) => (v - LO) / SPAN;          // 0..1, left to right
  const Y = (v) => 1 - (v - LO) / SPAN;      // 0..1, top to bottom
  const d = 0.088;                            // logo diameter, share of the side
  const band = 0.42 / SPAN;
  const r = d / 2 + 0.006;
  const nodes = E.map((e, i) => {
    const ax = X(e.scores[kx]), ay = Y(e.scores[ky]);
    return { e, ax, ay, x: ax, y: ay + ((i % 3) - 1) * 0.15 * band };
  });
  for (let it = 0; it < 320; it++) {
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const A = nodes[a], B = nodes[b];
        let dx = B.x - A.x, dy = B.y - A.y, dist = Math.hypot(dx, dy);
        if (dist < 2 * r) {
          if (dist < 1e-4) { dx = (b % 2 ? 1 : -1) * 0.001; dy = 0.001; dist = 0.0014; }
          const push = (2 * r - dist) / 2, ux = dx / dist, uy = dy / dist;
          A.x -= ux * push; A.y -= uy * push; B.x += ux * push; B.y += uy * push;
        }
      }
    }
    for (const n of nodes) {
      n.x += (n.ax - n.x) * 0.07; n.y += (n.ay - n.y) * 0.012;
      n.y = Math.max(n.ay - band, Math.min(n.ay + band, n.y));
      n.x = Math.max(d / 2 + 0.004, Math.min(1 - d / 2 - 0.004, n.x));
      n.y = Math.max(d / 2 + 0.004, Math.min(1 - d / 2 - 0.004, n.y));
    }
  }
  const dims = bumn.dims || {};
  const out = {
    d, nodes,
    mx: X(med(E.map((e) => e.scores[kx]))), my: Y(med(E.map((e) => e.scores[ky]))),
    xl: (dims[kx] || {}).label || kx, yl: (dims[ky] || {}).label || ky,
    quads: pre.quads || {}, lens: pre.name || '',
  };
  quadCache.set(bumn, out);
  return out;
}

/* the eight data-centre company webs, matched to their operator's logo */
const WEB_OP = { dci: 'DCI', bdx: 'BDx', neutradc: 'NeutraDC', 'digital-edge': 'Digital Edge', dayone: 'DayOne', pdg: 'PDG', 'stt-gdc': 'STT GDC', 'sinar-mas': 'SM+ (Sinar Mas)' };
function dcWebs(dc) {
  const logoOf = {};
  for (const p of (dc && dc.projects) || []) if (p.logo && !logoOf[p.op]) logoOf[p.op] = p.logo;
  return ((dc && dc.webs) || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((w) => ({
    slug: w.slug, title: w.title, logo: logoOf[WEB_OP[w.slug]] || null, counts: w.counts || {},
  }));
}

function home({ census, bumn, dc, umkm, peering, extra = {}, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const A = assets();
  /* exporter sector art: the SVG pictograms while data/sector-icons.live is on,
     else the clay sprites (a sector missing from the icon set keeps its sprite) */
  const SP = iconsLive() && A.icons ? Object.assign({}, A.sprites || {}, A.icons) : (A.sprites || {});
  const T = (census && census.totals) || {};
  const U = (umkm && umkm.totals) || {};
  const companies = (census && census.companies) || [];
  const dcOn = dcLive() && dc && Array.isArray(dc.projects);
  const webs = dcOn ? dcWebs(dc) : [];
  const nProjects = dcOn ? dc.projects.length : 0;
  const nLinks = webs.reduce((s, w) => s + (w.counts.links || 0), 0);
  const nEntities = webs.reduce((s, w) => s + (w.counts.entities || 0), 0);
  const nBumn = bumn && bumn.entities ? bumn.entities.length : 0;
  const bumnStat = (k) => ((bumn && bumn.stats) || []).find((x) => String(x.k || '').toLowerCase().includes(k)) || null;
  const divs = bumnStat('dividends');
  const nDims = bumn && bumn.dimOrder ? bumn.dimOrder.length : 0;
  const umkmSectors = (umkm && umkm.by_sector) || [];
  const asOfC = dateOf(census && census.generated, lang);
  const asOfB = dateOf(bumn && bumn.asof, lang);
  const asOfD = dateOf(dc && dc.asof, lang);
  const asOfU = dateOf(umkm && umkm.generated, lang);
  const PT = (peering && peering.totals) || {};
  const peerOn = !!(PT.ix && peering && Array.isArray(peering.places));
  const asOfP = peerOn ? dateOf(peering.asof, lang) : '';
  const lastDate = [census && census.generated, bumn && bumn.asof, dc && dc.asof, umkm && umkm.generated, peerOn && peering.asof]
    .map((s) => Date.parse(s || '') || 0).sort((a, b) => b - a)[0];
  const lastIso = lastDate ? new Date(lastDate).toISOString().slice(0, 10) : '';
  const usdB = (b) => 'US$' + (b || 0).toFixed(1) + (lang === 'id' ? ' miliar' : 'B');

  /* the citable sentence the old front page carried — assistants quote it
     ("according to 1001startup.id"), so it stays on the front page */
  const fact = T.companies ? L(
    `According to 1001startup.id${asOfC ? ` (updated ${asOfC})` : ''}, ${fmt(T.companies)} Indonesian startups are on record, with US$${(T.funding_usd_b || 0).toFixed(1)} billion in disclosed funding and an estimated ${fmt(T.jobs)} jobs.`,
    `Menurut 1001startup.id${asOfC ? ` (diperbarui ${asOfC})` : ''}, sensus ini mencatat ${fmt(T.companies)} startup Indonesia, dengan pendanaan yang diumumkan US$${(T.funding_usd_b || 0).toFixed(1)} miliar dan sekitar ${fmt(T.jobs)} lapangan kerja (estimasi).`) : '';

  /* ── the logo wall: real marks from all four datasets, interleaved so the
     first eight (all a phone shows) already hold two of each ── */
  const realLogo = (c) => c.logo && !/monogram/.test(String(c.logo_src || ''));
  const S = companies.filter(realLogo).slice(0, 4).map((c) => ({ k: 's', n: c.name.replace(/\s*\(.*\)$/, ''), img: c.logo, href: PF + '/company/' + c.id }));
  const B = ((bumn && bumn.entities) || []).slice().sort((a, b) => (b.weight || 0) - (a.weight || 0)).filter((e) => e.logo).slice(0, 4)
    .map((e) => ({ k: 'b', n: e.short, img: e.logo, href: '/bumn#' + e.slug }));
  const D = webs.filter((w) => w.logo).slice(0, 4).map((w) => ({ k: 'd', n: w.title.replace(/\s*\(.*\)$/, ''), img: w.logo, href: '/data-center/' + w.slug }));
  const Esp = ['Coffee & Tea', 'Furniture', 'Fisheries & Seaweed', 'Textiles & Fashion'].filter((s) => SP[s])
    .map((s) => ({ k: 'e', n: s.replace(' & Seaweed', '').replace(' & Fashion', ''), img: SP[s], href: '/umkm?s=' + encodeURIComponent(s), sprite: 1 }));
  const wall = [];
  const lanes = [S, B, D, Esp];
  for (let i = 0; wall.length < 16 && i < 8; i++) for (const lane of lanes) if (lane[i] && wall.length < 16) wall.push(lane[i]);
  const KN = { s: L('Startup', 'Startup'), b: 'BUMN', d: L('Data centre', 'Pusat data'), e: L('Exporters', 'Eksportir') };
  const wallHtml = wall.map((t) => `<a class="wt${t.sprite ? ' sp' : ''}" href="${esc(t.href)}" style="--dc:${DC[t.k]}">
      <span class="wk"><i aria-hidden="true"></i>${esc(KN[t.k])}</span>
      <img src="${esc(t.img)}" alt="" width="${t.sprite ? 64 : 44}" height="${t.sprite ? 64 : 44}" decoding="async">
      <span class="wn">${esc(t.n)}</span></a>`).join('');

  /* ── 01 startups: the census's own top rows ── */
  const topRows = companies.slice(0, 10).map((c) => `<tr>
      <td class="rk">${fmt(c.rank)}</td>
      <td class="nm"><a href="${PF}/company/${esc(c.id)}">${c.logo ? `<img src="${esc(c.logo)}" alt="" width="20" height="20" loading="lazy">` : ''}${esc(c.name.replace(/\s*\(.*\)$/, ''))}</a></td>
      <td class="mu">${esc(c.sector_label || '')}</td>
      <td class="n">${fmt(c.employees_est)}</td>
    </tr>`).join('');

  /* ── 02 BUMN: the quadrant, placed ── */
  const Q = bumnQuad(bumn);
  const pct = (v) => (v * 100).toFixed(2) + '%';
  const quadHtml = Q ? `<div class="bq" role="img" aria-label="${esc(L(`${Q.nodes.length} state companies placed by ${Q.xl.toLowerCase()} and ${Q.yl.toLowerCase()}`, `${Q.nodes.length} BUMN ditempatkan menurut ${Q.xl.toLowerCase()} dan ${Q.yl.toLowerCase()}`))}">
      <div class="bqt mono"><span>${esc(Q.quads.tl || '')}</span><span>${esc(Q.quads.tr || '')}</span></div>
      <div class="bqy mono">${esc(Q.yl)} →</div>
      <div class="bqf">
        ${[0, 1, 2, 3, 4, 5].map((i) => `<span class="bqg v" style="left:${pct((i + 0.5) / 6)}"></span><span class="bqg h" style="top:${pct(1 - (i + 0.5) / 6)}"></span>`).join('')}
        <span class="bql v" style="left:${pct(Q.mx)}"></span><span class="bql h" style="top:${pct(Q.my)}"></span>
        ${Q.nodes.map((n) => `<a class="bqn" href="/bumn#${esc(n.e.slug)}" style="left:${pct(n.x)};top:${pct(n.y)};width:${pct(Q.d)}" title="${esc(n.e.short)}"><img src="${esc(n.e.logo)}" alt="${esc(n.e.short)}" loading="lazy" decoding="async"></a>`).join('')}
      </div>
      <div class="bqt b mono"><span>${esc(Q.quads.bl || '')}</span><span>${esc(Q.quads.br || '')}</span></div>
      <div class="bqx mono">${esc(Q.xl)} →</div>
    </div>` : '';

  /* ── 03 data centres: the four ways a new campus gets power ── */
  const cells = (dc && dc.cells) || {};
  const dcCells = ['gf-grid', 'gf-btm', 'gf-offgrid', 'gf-hybrid'].filter((k) => cells[k]).map((k) => `<a class="dcc" href="/data-center#matrix">
      <img src="${esc((A.dc || {})[k] || '/assets/dc/' + k + '.webp')}" alt="${esc(cells[k].alt || '')}" width="320" height="180" loading="lazy" decoding="async">
      <b>${esc(cells[k].title)}</b><i>${esc(cells[k].sub || '')}</i></a>`).join('');
  const webChips = webs.map((w) => `<a class="wc" href="/data-center/${esc(w.slug)}">${w.logo ? `<img src="${esc(w.logo)}" alt="" width="18" height="18" loading="lazy">` : ''}${esc(w.title.replace(/\s*\(.*\)$/, ''))}</a>`).join('');

  /* ── 04 exporters: what they ship ── */
  const secTiles = umkmSectors.slice(0, 16).map((s) => `<a class="sx" href="/umkm?s=${encodeURIComponent(s.name)}">
      ${SP[s.name] ? `<img src="${esc(SP[s.name])}" alt="" width="64" height="64" loading="lazy" decoding="async">` : ''}
      <b>${esc(s.name)}</b><i class="mono">${fmt(s.count)}</i></a>`).join('');

  /* ── 05 peering: the busiest buildings, each opening its own card on the map ── */
  const busiest = peerOn ? peering.places.filter((p) => !p.grey).sort((a, b) => b.nets - a.nets).slice(0, 5) : [];
  const peerRows = busiest.map((p, i) => `<tr>
      <td class="rk">${i + 1}</td>
      <td class="nm"><a href="${PEER}?place=${encodeURIComponent(p.id)}">${p.logo ? `<img src="${esc(p.logo)}" alt="" width="20" height="20" loading="lazy">` : '<span class="pk" aria-hidden="true"></span>'}<span class="tx">${esc(p.n)}</span></a></td>
      <td class="mu">${esc(String(p.city || '').replace(/\s*\(.*?\)/g, ''))}</td>
      <td class="n">${fmt(p.nets)}</td>
      <td class="n">${fmt((p.ixs || []).length)}</td>
    </tr>`).join('');
  const top1 = busiest[0];
  const peerFact = top1 ? L(
    `${esc(top1.n)} is the busiest building: ${fmt(top1.nets)} networks list equipment there${top1.facs.length > 1 ? `, across ${fmt(top1.facs.length)} PeeringDB facilities under one roof` : ''}.`,
    `${esc(top1.n)} adalah gedung tersibuk: ${fmt(top1.nets)} jaringan mencatat perangkatnya di sana${top1.facs.length > 1 ? `, tersebar di ${fmt(top1.facs.length)} fasilitas PeeringDB dalam satu atap` : ''}.`) : '';
  const nPrev = 1 + (nBumn ? 1 : 0) + (dcOn ? 1 : 0) + (U.exporters ? 1 : 0);

  const figs = (arr) => `<div class="dfig">${arr.filter(Boolean).map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`;
  const updated = (d) => d ? `<span class="dupd">${L('Updated', 'Diperbarui')} ${esc(d)}</span>` : '';

  const cards = [
    `<article class="dset" id="companies" style="--dc:${DC.s}">
      <div class="dtop mono"><span class="dno">01</span><span class="dlab">${L('Startups', 'Startup')}</span>${updated(asOfC)}</div>
      <h3><a href="${PF}/startups">${L('The startup census', 'Sensus startup')}</a></h3>
      <p class="dsub">${L('Who they are, where they sit, what they raised, whom they employ — every figure linked to its source.', 'Siapa mereka, di mana kantornya, berapa dana yang dihimpun, berapa orang yang dipekerjakan — setiap angka tertaut ke sumbernya.')}</p>
      ${figs([[fmt(T.companies), L('companies', 'perusahaan')], [usdB(T.funding_usd_b), L('disclosed funding', 'pendanaan diumumkan')], [fmt(T.jobs), L('jobs (est.)', 'pekerja (est.)')]])}
      <div class="dprev"><table class="tt"><thead><tr><th>#</th><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th><th class="n">${L('Jobs', 'Pekerja')}</th></tr></thead><tbody>${topRows}</tbody></table></div>
      ${fact ? `<p class="dfact">${fact}</p>` : ''}
      <div class="dcta"><a class="btn primary" href="${PF}/startups">${L(`Browse all ${fmt(T.companies)}`, `Lihat ${fmt(T.companies)} startup`)} →</a><a class="lk" href="${PF}/map">${L('Logo map', 'Peta logo')}</a><a class="lk" href="${PF}/investors">${L('Investors', 'Investor')}</a></div>
    </article>`,
    nBumn ? `<article class="dset" style="--dc:${DC.b}">
      <div class="dtop mono"><span class="dno">02</span><span class="dlab">${L('State companies', 'BUMN')}</span>${updated(asOfB)}</div>
      <h3><a href="/bumn">${L('BUMN on one quadrant', 'BUMN dalam satu kuadran')}</a></h3>
      <p class="dsub">${L(`${nBumn} state companies on ${nDims || 'ten'} yardsticks — pick two and see who sits where. Every score carries its reason and its source.`, `${nBumn} BUMN pada ${nDims || 'sepuluh'} tolok ukur — pilih dua dan lihat posisi masing-masing. Setiap skor disertai alasan dan sumbernya.`)}</p>
      ${figs([[fmt(nBumn), L('state companies placed', 'BUMN ditempatkan')], [String(nDims || ''), L('yardsticks', 'tolok ukur')], divs ? [esc(divs.v), L('dividends to Danantara, 2025', 'dividen ke Danantara, 2025')] : null])}
      <div class="dprev">${quadHtml}</div>
      <div class="dcta"><a class="btn primary" href="/bumn">${L('Open the quadrant', 'Buka kuadrannya')} →</a><span class="lk off">${L(`Lens: ${esc(Q ? Q.lens : '')}`, `Sudut pandang: ${esc(Q ? Q.lens : '')}`)}</span></div>
    </article>` : '',
    dcOn ? `<article class="dset" style="--dc:${DC.d}">
      <div class="dtop mono"><span class="dno">03</span><span class="dlab">${L('Data centres', 'Pusat data')}</span>${updated(asOfD)}</div>
      <h3><a href="/data-center">${L('Who powers Indonesia’s data centres', 'Siapa yang memasok listrik pusat data Indonesia')}</a></h3>
      <p class="dsub">${L('Every project placed by where its power comes from, with the companies that own, power, build and equip it.', 'Setiap proyek ditempatkan menurut sumber listriknya, beserta perusahaan yang memiliki, memasok, membangun, dan melengkapinya.')}</p>
      ${figs([[fmt(nProjects), L('projects', 'proyek')], [fmt(webs.length), L('company webs', 'jejaring perusahaan')], [fmt(nLinks), L('sourced ties', 'hubungan bersumber')]])}
      <div class="dprev"><div class="dcg">${dcCells}</div><div class="wcs">${webChips}</div></div>
      <div class="dcta"><a class="btn primary" href="/data-center">${L('See who powers them', 'Lihat siapa pemasoknya')} →</a><span class="lk off">${fmt(nEntities)} ${L('companies and people in the webs', 'perusahaan dan orang di jejaring')}</span></div>
    </article>` : '',
    U.exporters ? `<article class="dset" style="--dc:${DC.e}">
      <div class="dtop mono"><span class="dno">0${dcOn ? 4 : 3}</span><span class="dlab">${L('Exporters (UMKM)', 'Eksportir (UMKM)')}</span>${updated(asOfU)}</div>
      <h3><a href="/umkm">${L('Indonesia’s export supplier census', 'Sensus pemasok ekspor Indonesia')}</a></h3>
      <p class="dsub">${L('Exporting SMEs: what they make, the markets they already ship to, how each entry was verified, and how to reach them.', 'UMKM eksportir: apa yang mereka buat, pasar yang sudah mereka layani, cara tiap baris diverifikasi, dan cara menghubunginya.')}</p>
      ${figs([[fmt(U.exporters), L('exporters', 'eksportir')], [fmt(U.sectors), L('product sectors', 'sektor produk')], [fmt(U.with_contact), L('with a direct channel', 'punya kontak langsung')]])}
      <div class="dprev"><div class="sxg">${secTiles}</div></div>
      <div class="dcta"><a class="btn primary" href="/umkm">${L('Browse the exporters', 'Lihat para eksportir')} →</a><span class="lk off">${fmt(U.provinces)} ${L('provinces · English only', 'provinsi · bahasa Inggris')}</span></div>
    </article>` : '',
    peerOn ? `<article class="dset dw" id="peering" style="--dc:${DC.p}">
      <div class="dtop mono"><span class="dno">0${nPrev + 1}</span><span class="dlab">${L('Peering &amp; routing', 'Peering &amp; routing')}</span>${updated(asOfP)}</div>
      <div class="dwa">
        <h3><a href="${PEER}">${L('Where Indonesia’s networks meet', 'Tempat jaringan internet Indonesia bertemu')}</a></h3>
        <p class="dsub">${L('Every data centre, internet exchange and router port PeeringDB lists in Indonesia, on one map: which networks sit in which building, and which exchanges tie the buildings together. A data centre nobody can name stays grey.', 'Setiap pusat data, internet exchange, dan port router yang tercatat di PeeringDB untuk Indonesia, dalam satu peta: jaringan mana yang ada di gedung mana, dan exchange mana yang menghubungkan gedung-gedung itu. Pusat data yang namanya tak bisa dipastikan tetap abu-abu.')}</p>
        ${figs([[fmt(PT.fac), L('data centres', 'pusat data')], [fmt(PT.ix), L('internet exchanges', 'internet exchange')], [fmt(PT.nets), L('networks', 'jaringan')]])}
      </div>
      ${A.peering ? `<figure class="dpm"><a href="${PEER}"><picture>${A.peering_phone ? `<source media="(max-width:640px)" srcset="${esc(A.peering_phone)}" width="780" height="1010">` : ''}<img src="${esc(A.peering)}" alt="${esc(L('The peering map: Indonesia’s data centres as named dots, with lines between the buildings each exchange spans', 'Peta peering: pusat data Indonesia sebagai titik bernama, dengan garis antar-gedung yang dihubungkan tiap exchange'))}" width="980" height="980" loading="lazy" decoding="async"></picture></a>
        <figcaption>${L('Each line joins two buildings one exchange spans. It is not the cable route.', 'Setiap garis menghubungkan dua gedung yang dijangkau satu exchange, bukan jalur kabelnya.')}</figcaption></figure>` : ''}
      <div class="dprev"><table class="tt pt"><thead><tr><th>#</th><th>${L('Busiest buildings', 'Gedung tersibuk')}</th><th>${L('City', 'Kota')}</th><th class="n">${L('Networks', 'Jaringan')}</th><th class="n">${L('Exch.', 'Exch.')}</th></tr></thead><tbody>${peerRows}</tbody></table>
        ${peerFact ? `<p class="dfact">${peerFact}</p>` : ''}</div>
      <div class="dcta"><a class="btn primary" href="${PEER}">${L('Open dc.1001startup.id', 'Buka dc.1001startup.id')} →</a>${graphLive() ? `<a class="lk" href="${PEER}graph">${L('How the networks connect', 'Cara jaringan terhubung')}</a>` : ''}<span class="lk off">${L('From PeeringDB, every place checked · English only', 'Dari PeeringDB, setiap lokasi dicek · bahasa Inggris')}</span></div>
    </article>` : '',
  ].filter(Boolean).join('\n');

  /* ── built on the same data ── */
  const tools = [
    { href: PF + '/map', t: L('The logo map', 'Peta logo'), d: L(`${fmt(extra.mapped || 0)} startups as their logos, at their real addresses, from Medan to Bali.`, `${fmt(extra.mapped || 0)} startup tampil sebagai logonya, di alamat aslinya, dari Medan sampai Bali.`), img: A.map },
    { href: PF + '/chain', t: L('Supply chain', 'Rantai pasok'), d: L(`${fmt(extra.edges || 0)} supplier links, each proved by a filing or a first-party document.`, `${fmt(extra.edges || 0)} hubungan pemasok, masing-masing dibuktikan dokumen regulator atau pihak pertama.`) },
    { href: PF + '/investors', t: L('Investors', 'Investor'), d: L('Every fund with the census companies it backs, and what they raised in total.', 'Setiap fund berikut perusahaan sensus yang didukungnya, dan total dana yang dihimpun.') },
    { href: PF + '/closed', t: L('Closed register', 'Daftar yang tutup'), d: L(`${fmt(extra.closed || 0)} companies that stopped, with dates, causes and sources.`, `${fmt(extra.closed || 0)} perusahaan yang berhenti, lengkap dengan tanggal, sebab, dan sumber.`) },
    { href: PF + '/research', t: L('Research', 'Riset'), d: L('Analysis with the data behind it and every assumption written out.', 'Analisis lengkap dengan datanya dan setiap asumsi yang dijelaskan.') },
    { href: PF + '/report', t: L('The monthly report', 'Laporan bulanan'), d: L('Four findings from the census, figures frozen on the day.', 'Empat temuan dari sensus, angkanya dibekukan pada harinya.') },
    { href: PF + '/coverage', t: L('Coverage', 'Cakupan'), d: L('What is counted, what is held out and why — every exclusion published with its reason.', 'Apa yang dihitung, apa yang dikeluarkan, dan alasannya — setiap pengecualian dipublikasikan beserta sebabnya.') },
  ];
  const toolHtml = tools.map((x, i) => `<a class="tl${i === 0 && x.img ? ' big' : ''}" href="${esc(x.href)}">
      ${i === 0 && x.img ? `<img src="${esc(x.img)}" alt="" width="600" height="340" loading="lazy" decoding="async">` : ''}
      <b>${x.t}</b><span>${x.d}</span></a>`).join('');

  const rules = [
    { t: L('Sourced or withdrawn', 'Ada sumber, atau ditarik'), d: L('Every figure links to the document that carries it. Where no credible source exists, the cell holds a dash that says why.', 'Setiap angka tertaut ke dokumen sumbernya. Kalau tidak ada sumber yang kredibel, selnya diisi tanda pisah yang menjelaskan alasannya.'), href: PF + '/coverage#funding' },
    { t: L('Estimates labeled', 'Estimasi selalu berlabel'), d: L('Anything derived — output, a valuation, a score — is marked as such, and its working is one tap away.', 'Semua angka turunan — output, valuasi, skor — diberi tanda, dan perhitungannya bisa dibuka sekali ketuk.'), href: PF + '/model' },
    { t: L('Checked and dated', 'Dicek dan bertanggal'), d: L('Startups are re-checked for liveness, headcounts carry the day they were read, and what stopped moves to the closed register.', 'Startup dicek ulang apakah masih beroperasi, jumlah pekerja mencantumkan tanggal pembacaannya, dan yang berhenti dipindahkan ke daftar tutup.'), href: PF + '/closed' },
    { t: L('Evidence, in tiers', 'Bukti, berjenjang'), d: L('Each exporter carries one of six evidence tiers, from its own storefront up to a documented shipment.', 'Setiap eksportir membawa satu dari enam jenjang bukti, dari etalase daringnya sampai pengiriman yang terdokumentasi.'), href: '/umkm#verification' },
  ].map((x) => `<a href="${esc(x.href)}"><b>${x.t}</b><span>${x.d}</span></a>`).join('');

  const title = L("Indonesia's Startup and Company Data — 1001startup.id", 'Data Startup dan Perusahaan Indonesia — 1001startup.id');
  const desc = peerOn ? L(
    `Five datasets on Indonesia's companies and its internet — ${fmt(T.companies)} startups, ${fmt(nBumn)} BUMN, ${fmt(nProjects)} data-centre projects, ${fmt(U.exporters)} exporters and the peering map of ${fmt(PT.ix)} internet exchanges — every figure linked to its source.`,
    `Lima dataset perusahaan dan internet Indonesia — ${fmt(T.companies)} startup, ${fmt(nBumn)} BUMN, ${fmt(nProjects)} proyek pusat data, ${fmt(U.exporters)} UMKM eksportir, dan peta peering ${fmt(PT.ix)} internet exchange — setiap angka tertaut ke sumbernya.`) : L(
    `Four datasets on Indonesia's companies — ${fmt(T.companies)} startups, ${fmt(nBumn)} BUMN, ${fmt(nProjects)} data-centre projects and ${fmt(U.exporters)} exporters — every figure linked to its source.`,
    `Empat dataset perusahaan Indonesia — ${fmt(T.companies)} startup, ${fmt(nBumn)} BUMN, ${fmt(nProjects)} proyek pusat data, dan ${fmt(U.exporters)} UMKM eksportir — setiap angka tertaut ke sumbernya.`);
  const catalog = [
    { name: 'The Indonesian Startup Census', name_id: 'Sensus Startup Indonesia', path: '/startups',
      description: `${T.companies} operating Indonesian startups: disclosed funding, valuations, dated headcounts, sector, investors and head-office address.`,
      description_id: `Data ${T.companies} startup Indonesia yang beroperasi: pendanaan yang diumumkan, valuasi, jumlah pekerja bertanggal, sektor, investor, dan alamat kantor pusat.` },
    nBumn ? { name: "Indonesia's state companies (BUMN), mapped", name_id: 'Peta BUMN Indonesia', path: '/bumn', en_only: true,
      description: `${nBumn} BUMN scored on ${nDims} yardsticks, each score with its reason and source.`,
      description_id: `${nBumn} BUMN dinilai pada ${nDims} tolok ukur, setiap skor dengan alasan dan sumbernya.` } : null,
    dcOn ? { name: "Who powers Indonesia's data centres", name_id: 'Siapa yang memasok listrik pusat data Indonesia', path: '/data-center', en_only: true,
      description: `${nProjects} data-centre projects by power source, with ${webs.length} company webs and ${nLinks} sourced ties.`,
      description_id: `${nProjects} proyek pusat data menurut sumber listriknya, dengan ${webs.length} jejaring perusahaan dan ${nLinks} hubungan bersumber.` } : null,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow">
${I18N.headTags(lang, '/')}
${I18N.ogImage()}${SCHEMA.catalogLd(lang, catalog)}
<meta property="og:title" content="${esc(L("1001startup.id — Indonesia's company graph", '1001startup.id — Data perusahaan Indonesia'))}">
<meta property="og:description" content="${esc(desc)}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;overflow-x:hidden}
a{color:inherit}
img{display:block}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.banner{background:${GRAD};color:#000;font:400 11px/1.35 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
.btn{display:inline-block;padding:12px 18px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;border:1px solid #000;cursor:pointer;background:#fff;color:#000;white-space:nowrap}
.btn.primary{background:#000;color:#fff}
.btn.primary:hover{background:#27272A}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.wrap{max-width:1180px;margin:0 auto;padding:72px 20px 0}
.h2{font-size:clamp(28px,3.4vw,42px);line-height:1.05;letter-spacing:-0.028em;font-weight:500;margin-bottom:12px;max-width:24ch}
.lede{color:#52525B;font-size:15px;line-height:1.6;max-width:70ch;margin-bottom:22px}

/* ── hero: the pitch, one search across the four, a wall of real marks ── */
.hero{max-width:1180px;margin:0 auto;padding:60px 20px 8px;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:52px;align-items:center}
.hero h1{font-size:clamp(42px,5.4vw,74px);line-height:1;letter-spacing:-0.035em;font-weight:500}
.hero .sub{color:#52525B;font-size:17px;line-height:1.55;max-width:46ch;margin-top:20px}
.hs{position:relative;display:flex;margin-top:26px;max-width:560px;border:1px solid #000;background:#fff}
.hs input{flex:1;min-width:0;border:0;outline:none;padding:15px 16px;font:500 16px/1.2 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em;background:none;color:#000;-webkit-appearance:none;appearance:none;border-radius:0}
.hs input::placeholder{color:#8E8E93}
.hs input::-webkit-search-cancel-button{display:none}
.hs button{flex:none;border:0;border-left:1px solid #000;background:#000;color:#fff;padding:0 20px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;cursor:pointer}
.hs:focus-within{box-shadow:0 0 0 3px rgba(0,0,0,.08)}
.hres{position:absolute;left:-1px;right:-1px;top:100%;z-index:60;background:#fff;border:1px solid #000;border-top:0;max-height:min(70vh,520px);overflow-y:auto;box-shadow:0 18px 40px rgba(0,0,0,.10)}
.hres[hidden]{display:none}
.hres .rg{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#6B6B73;padding:12px 14px 6px;display:flex;align-items:center;gap:7px}
.hres .rg i{width:7px;height:7px;background:var(--dc);display:inline-block}
.hres a{display:flex;align-items:center;gap:11px;padding:9px 14px;text-decoration:none}
.hres a img,.hres a .ph{width:26px;height:26px;flex:none;object-fit:contain;border:1px solid #EFEFEF;background:#fff}
.hres a .ph{background:var(--dc);opacity:.35;border:0}
.hres a b{font-weight:500;font-size:14.5px;line-height:1.25;display:block}
.hres a b mark{background:#FFF3C4;color:inherit}
.hres a em{font-style:normal;font-size:12px;color:#6B6B73;display:block;line-height:1.3;margin-top:1px}
.hres a[aria-selected="true"],.hres a:hover{background:#F6F6F6}
.hres .more{display:block;padding:11px 14px;border-top:1px solid #EFEFEF;font:400 11px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#000}
.hres .none{padding:14px;font-size:13.5px;color:#52525B}
.hcnt{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:16px;font-size:13.5px;color:#52525B}
.hcnt a{text-decoration:none;display:inline-flex;align-items:center;gap:7px}
.hcnt a::before{content:'';width:7px;height:7px;background:var(--dc);flex:none}
.hcnt a b{color:#000;font-weight:500}
.hcnt a:hover{color:#000}
.hwall{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.wt{background:#fff;aspect-ratio:1/1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;text-decoration:none;position:relative;padding:22px 8px 12px;min-width:0}
.wt:hover{background:#FAFAFA}
.wt img{width:44px;height:44px;object-fit:contain}
.wt.sp img{width:64px;height:64px;margin:-6px 0 -4px}
.wt .wn{font-size:12.5px;line-height:1.2;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wt .wk{position:absolute;top:8px;left:9px;font:400 8.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#8E8E93;display:flex;align-items:center;gap:5px}
.wt .wk i{width:6px;height:6px;background:var(--dc);display:inline-block}

/* ── the four datasets ── */
.dsets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.dset{background:#fff;padding:26px 26px 24px;display:flex;flex-direction:column;min-width:0;border-top:3px solid var(--dc);margin-top:-1px}
.dtop{display:flex;align-items:center;gap:10px;font-size:10.5px;color:#6B6B73}
.dtop .dno{color:#000}
.dtop .dlab{color:#000;display:flex;align-items:center;gap:7px}
.dtop .dlab::before{content:'';width:7px;height:7px;background:var(--dc)}
.dtop .dupd{margin-left:auto;text-align:right}
.dset h3{font-size:clamp(22px,2.2vw,27px);line-height:1.1;letter-spacing:-0.022em;font-weight:500;margin-top:18px}
.dset h3 a{text-decoration:none}
.dset h3 a:hover{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px}
.dsub{color:#52525B;font-size:14px;line-height:1.55;margin-top:8px;max-width:56ch}
.dfig{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px;padding:14px 0;border-top:1px solid #EFEFEF;border-bottom:1px solid #EFEFEF}
.dfig b{display:block;font-size:clamp(20px,2vw,26px);font-weight:600;letter-spacing:-0.02em;line-height:1.1;background:${GRAD};-webkit-background-clip:text;background-clip:text;color:transparent;width:max-content;max-width:100%}
.dfig span{display:block;font:400 10px/1.35 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;margin-top:5px}
.dprev{margin-top:18px;flex:1}
.dfact{font-size:12.5px;line-height:1.5;color:#52525B;margin-top:14px;padding-left:10px;border-left:2px solid #E7E7E7}
.dcta{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:20px}
.dcta .lk{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#52525B;text-decoration:none;border-bottom:1px solid #D9D9D9;padding-bottom:3px}
.dcta a.lk:hover{color:#000;border-color:#000}
.dcta .lk.off{border:0;color:#74747D}
/* 01 */
.tt{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
.tt th{font:400 9.5px/1.2 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:left;padding:0 8px 8px;border-bottom:1px solid #E7E7E7}
.tt th:first-child{width:30px;padding-left:0}
.tt th.n{text-align:right;width:68px;padding-right:0}
.tt th:nth-child(3){width:34%}
.tt td{padding:8px;border-bottom:1px solid #F3F3F3;vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tt td.rk{padding-left:0;font:400 11.5px/1 'IBM Plex Mono',monospace;color:#6B6B73}
.tt td.nm a{display:flex;align-items:center;gap:9px;text-decoration:none;font-weight:500;overflow:hidden}
.tt td.nm a:hover{text-decoration:underline;text-underline-offset:3px}
.tt td.nm img{width:20px;height:20px;flex:none;object-fit:contain}
.tt td.mu{color:#52525B;font-size:12.5px}
.tt td.n{text-align:right;padding-right:0;font:400 12px/1 'IBM Plex Mono',monospace}
/* 02 */
.bq{display:grid;grid-template-columns:18px minmax(0,1fr);gap:6px 6px;max-width:440px;margin:0 auto}
.bqt{grid-column:2;display:flex;justify-content:space-between;gap:12px;font-size:9px;color:#6B6B73;letter-spacing:.04em}
.bqt span:last-child{text-align:right}
.bqt.b{margin-top:-2px}
.bqy{grid-column:1;writing-mode:vertical-rl;transform:rotate(180deg);font-size:9.5px;color:#3F3F46;text-align:right;align-self:start}
.bqf{grid-column:2;position:relative;aspect-ratio:1/1;border:1px solid #DADBD5;background:#fff}
.bqg{position:absolute;background:#EFEFEB}
.bqg.v{top:0;bottom:0;width:1px}
.bqg.h{left:0;right:0;height:1px}
.bqx{grid-column:2;font-size:9.5px;color:#3F3F46;text-align:right}
.bql{position:absolute;background:#B9BBB4}
.bql.v{top:0;bottom:0;width:1.5px;margin-left:-.75px}
.bql.h{left:0;right:0;height:1.5px;margin-top:-.75px}
.bqn{position:absolute;aspect-ratio:1/1;transform:translate(-50%,-50%);border-radius:50%;background:#fff;box-shadow:0 0 0 1px #E2E3DE,0 2px 6px rgba(0,0,0,.07);overflow:hidden;display:block}
.bqn img{width:100%;height:100%;object-fit:contain;padding:12%}
.bqn:hover{z-index:2;box-shadow:0 0 0 1.5px #000}
/* 03 */
.dcg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.dcc{text-decoration:none;display:block;min-width:0}
.dcc img{width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;background:#F4F4F2}
.dcc b{display:block;font-size:13.5px;font-weight:500;letter-spacing:-0.01em;margin-top:8px;line-height:1.25}
.dcc i{display:block;font-style:normal;font-size:12px;color:#6B6B73;line-height:1.35;margin-top:2px}
.dcc:hover b{text-decoration:underline;text-underline-offset:3px}
.wcs{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
.wc{display:inline-flex;align-items:center;gap:7px;border:1px solid #E7E7E7;padding:5px 9px 5px 6px;font-size:12px;text-decoration:none;color:#27272A}
.wc img{width:18px;height:18px;object-fit:contain}
.wc:hover{border-color:#000}
/* 04 */
.sxg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#EFEFEF;border:1px solid #EFEFEF}
.sx{background:#fff;text-decoration:none;display:flex;flex-direction:column;align-items:center;text-align:center;padding:12px 6px 12px;min-width:0}
.sx img{width:64px;height:64px;object-fit:contain}
.sx b{font-size:12px;font-weight:500;line-height:1.2;margin-top:6px;letter-spacing:-0.005em}
.sx i{font-style:normal;font-size:10.5px;color:#6B6B73;margin-top:4px}
.sx:hover{background:#FAFAFA}
/* 05: the peering map, across both columns */
.dset.dw{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);grid-template-areas:"top top" "a m" "b m" "c m";grid-template-rows:auto auto 1fr auto;column-gap:40px}
.dw>.dtop{grid-area:top}
.dw>.dwa{grid-area:a}
.dw>.dpm{grid-area:m;margin-top:18px;min-width:0;display:flex;flex-direction:column}
.dw>.dprev{grid-area:b}
.dw>.dcta{grid-area:c}
/* the still (square, every name inside) fills the column the text sets */
.dpm a{display:block;position:relative;flex:1;min-height:320px;border:1px solid #E7E7E7;background:#E1EAEC;overflow:hidden}
.dpm picture{display:block}
.dpm img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 50%}
.dpm figcaption{font:400 10px/1.45 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;margin-top:8px}
.tt td.nm .pk{width:10px;height:10px;border-radius:50%;background:#0B0B0C;box-shadow:0 0 0 2px #fff,0 0 0 3px rgba(0,0,0,.12);flex:none;margin:0 5px}
.tt td.nm .tx{overflow:hidden;text-overflow:ellipsis}
.tt.pt th:nth-child(3){width:30%}
.tt.pt th.n{width:66px}
.tt.pt th.n+th.n{width:46px}

/* ── built on the same data ── */
.tls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.tl{background:#fff;padding:22px 20px;text-decoration:none;display:flex;flex-direction:column;gap:6px;min-width:0}
.tl:hover{background:#FAFAFA}
.tl b{font-size:17px;font-weight:500;letter-spacing:-0.015em}
.tl span{color:#52525B;font-size:13.5px;line-height:1.5}
.tl.big{grid-row:span 3;padding:0 0 22px}
.tl.big img{width:100%;height:auto;aspect-ratio:600/340;object-fit:cover;background:#F4F4F2;margin-bottom:10px}
.tl.big b,.tl.big span{padding:0 20px}

/* ── the rules ── */
.rules{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.rules a{background:#fff;padding:22px 20px 24px;text-decoration:none;display:flex;flex-direction:column;gap:10px}
.rules a:hover{background:#FAFAFA}
.rules b{font-size:17px;font-weight:500;letter-spacing:-0.015em}
.rules span{color:#52525B;font-size:13.5px;line-height:1.55}

/* ── the data ── */
.acc{border:1px solid #E7E7E7;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:0}
.acc>div{padding:30px 28px}
.acc>div+div{border-left:1px solid #E7E7E7;background:#FAFAFA;display:flex;flex-direction:column;gap:10px;justify-content:center}
.acc h3{font-size:clamp(22px,2.4vw,28px);font-weight:500;letter-spacing:-0.022em;line-height:1.12;max-width:26ch}
.acc p{color:#52525B;font-size:14.5px;line-height:1.6;margin-top:12px;max-width:62ch}
.acc .row{display:flex;gap:10px;flex-wrap:wrap}
.acc .row .btn{flex:1;text-align:center}
.acc small{font:400 10.5px/1.5 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
${FOOT.css}

/* ── tablet ── */
@media(max-width:1060px){
.hero{grid-template-columns:1fr;gap:34px;padding-top:44px}
.hwall{max-width:640px}
.dsets{grid-template-columns:1fr}
.dset.dw{grid-template-columns:minmax(0,1fr);grid-template-areas:"top" "a" "m" "b" "c";grid-template-rows:auto}
.dpm a{flex:none;min-height:0;aspect-ratio:16/9}
.dpm img{object-position:50% 52%}
.rules{grid-template-columns:repeat(2,minmax(0,1fr))}
.tls{grid-template-columns:repeat(2,minmax(0,1fr))}
.tl.big{grid-column:1/-1;grid-row:auto}
}
/* ── phone: one screen = the pitch, the search, the wall ── */
@media(max-width:640px){
.banner{font-size:9.5px;letter-spacing:.06em;padding:7px 10px}
.wrap{padding:52px 16px 0}
.hero{padding:22px 16px 0;gap:20px}
.hero .eyebrow{margin-bottom:12px;font-size:10.5px}
.hero h1{font-size:38px;line-height:1.02}
.hero .sub{font-size:15.5px;margin-top:12px;line-height:1.5}
.hs{margin-top:18px}
.hs input{padding:14px 12px;font-size:16px}
.hs button{padding:0 14px}
.hcnt{font-size:12.5px;gap:4px 14px;margin-top:12px}
.hwall{grid-template-columns:repeat(4,minmax(0,1fr))}
.hwall .wt:nth-child(n+9){display:none}
.wt{padding:16px 4px 8px;gap:6px}
.wt img{width:34px;height:34px}
.wt.sp img{width:48px;height:48px;margin:-4px 0 -3px}
.wt .wn{font-size:11px}
.wt .wk{display:none}
.dset{padding:22px 16px 20px}
.dfig{gap:8px}
.dfig b{font-size:20px}
.dfig span{font-size:9px}
.tt th:nth-child(3),.tt td:nth-child(3){display:none}
.tt tbody tr:nth-child(n+7){display:none}
.sxg .sx:nth-child(n+9){display:none}
.sxg{grid-template-columns:repeat(4,minmax(0,1fr))}
.sx{padding:10px 2px}
.sx img{width:46px;height:46px}
.sx b{font-size:10.5px}
.dcg{gap:10px}
.dcc b{font-size:12.5px}
.dcc i{display:none}
.tls,.rules{grid-template-columns:1fr}
.acc{grid-template-columns:1fr}
.acc>div{padding:24px 18px}
.acc>div+div{border-left:0;border-top:1px solid #E7E7E7}
.dcta .btn{flex:1 1 100%;text-align:center}
.dpm a{aspect-ratio:3/2}
.dpm img{object-position:0 50%}
}
</style>
</head>
<body>
<div class="banner">${L('WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY DERIVED FIGURE IS A LABELED ESTIMATE', 'DOKUMEN KERJA · SUMBER PUBLIK SAJA · ANGKA TURUNAN SELALU BERLABEL ESTIMASI')}</div>
${NAV.header('', { lang, path: '/' })}
<main>
<section class="hero">
  <div>
    <div class="eyebrow"><span class="sq"></span>${L('Indonesia’s company data', 'Data perusahaan Indonesia')}</div>
    <h1>${L('Indonesia’s company graph.', 'Data perusahaan Indonesia.')}</h1>
    <p class="sub">${peerOn ? L('Startups, state companies, data centres, exporters and where the internet’s networks meet — five live datasets, every figure linked to the document that carries it.', 'Startup, BUMN, pusat data, UMKM eksportir, dan titik temu jaringan internet — lima dataset yang terus diperbarui, setiap angkanya tertaut ke dokumen sumbernya.') : L('Startups, state companies, data centres and exporters — four live datasets, every figure linked to the document that carries it.', 'Startup, BUMN, pusat data, dan UMKM eksportir — empat dataset yang terus diperbarui, setiap angkanya tertaut ke dokumen sumbernya.')}</p>
    <form class="hs" id="hs" action="${PF}/startups" method="get" role="search" autocomplete="off">
      <label class="sr" for="hq">${L('Search the company datasets', 'Cari di dataset perusahaan')}</label>
      <input id="hq" name="q" type="search" placeholder="${esc(L('Search a startup, BUMN, data centre or exporter', 'Cari startup, BUMN, pusat data, atau eksportir'))}" data-short="${esc(L('Search any company', 'Cari perusahaan'))}" role="combobox" aria-expanded="false" aria-controls="hres" aria-autocomplete="list" enterkeyhint="search" spellcheck="false">
      <button type="submit">${L('Search', 'Cari')}</button>
      <div class="hres" id="hres" role="listbox" hidden></div>
    </form>
    <div class="hcnt">
      <a href="${PF}/startups" style="--dc:${DC.s}"><b>${fmt(T.companies)}</b> ${L('startups', 'startup')}</a>
      ${nBumn ? `<a href="/bumn" style="--dc:${DC.b}"><b>${fmt(nBumn)}</b> BUMN</a>` : ''}
      ${dcOn ? `<a href="/data-center" style="--dc:${DC.d}"><b>${fmt(nProjects)}</b> ${L('data-centre projects', 'proyek pusat data')}</a>` : ''}
      ${U.exporters ? `<a href="/umkm" style="--dc:${DC.e}"><b>${fmt(U.exporters)}</b> ${L('exporters', 'eksportir')}</a>` : ''}
      ${peerOn ? `<a href="${PEER}" style="--dc:${DC.p}"><b>${fmt(PT.ix)}</b> ${L('internet exchanges', 'internet exchange')}</a>` : ''}
    </div>
  </div>
  <div class="hwall" aria-label="${esc(L('A sample of the companies across the four datasets', 'Contoh perusahaan dari keempat dataset'))}">${wallHtml}</div>
</section>

<section class="wrap" id="datasets">
  <div class="eyebrow"><span class="sq"></span>${L('The datasets', 'Dataset')}</div>
  <h2 class="h2">${peerOn ? L('Five datasets, one set of rules.', 'Lima dataset, satu aturan main.') : L('Four censuses, one set of rules.', 'Empat sensus, satu aturan main.')}</h2>
  <p class="lede">${L('Each one is a live page you can search, sort and cite — built from public reporting, filings and company records, with every estimate marked as one.', 'Masing-masing halaman hidup yang bisa dicari, diurutkan, dan dikutip — disusun dari pemberitaan publik, dokumen resmi, dan catatan perusahaan, dengan setiap estimasi diberi tanda.')}</p>
  <div class="dsets">
${cards}
  </div>
</section>

<section class="wrap" id="tools">
  <div class="eyebrow"><span class="sq"></span>${L('Built on the same data', 'Dibangun di atas data yang sama')}</div>
  <h2 class="h2">${L('Same records, other angles.', 'Data yang sama, sudut pandang lain.')}</h2>
  <div class="tls">${toolHtml}</div>
</section>

<section class="wrap" id="rules">
  <div class="eyebrow"><span class="sq"></span>${L('How the data is made', 'Cara datanya disusun')}</div>
  <div class="rules">${rules}</div>
</section>

<section class="wrap" id="access">
  <div class="eyebrow"><span class="sq"></span>${L('Get the data', 'Akses data')}</div>
  <div class="acc">
    <div>
      <h3>${L('Every figure is free to read. The working files are held back.', 'Setiap angka bebas dibaca. Berkas kerjanya tidak dibagikan.')}</h3>
      <p>${L('Each company page shows its figures with the sources behind them. The machine-readable files — the census, the BUMN scores, the data-centre webs and the exporter file with its verification trail — are not a public download. For bulk access, a custom pull or the right contact at a company, talk to us.', 'Setiap halaman perusahaan menampilkan angkanya beserta sumbernya. Berkas yang dapat dibaca mesin — sensus, skor BUMN, jejaring pusat data, dan berkas eksportir lengkap dengan jejak verifikasinya — tidak dibagikan sebagai unduhan publik. Untuk akses massal, penarikan data khusus, atau kontak yang tepat di sebuah perusahaan, hubungi kami.')}</p>
    </div>
    <div>
      <div class="row"><a class="btn primary" href="${PF}/leads">${L('Lead search', 'Cari kontak')}</a><a class="btn" href="${PF}/about">${L('Talk to us', 'Hubungi kami')}</a></div>
      <small>${L('How to cite the census, and who builds it: the about page.', 'Cara mengutip sensus, dan siapa yang menyusunnya: halaman tentang.')}</small>
    </div>
  </div>
</section>
</main>
${FOOT.footer({ lang,
    tagline: { en: 'Indonesia’s company data, from public sources.', id: 'Data perusahaan Indonesia, dari sumber publik.' },
    legalLeft: { en: 'Indonesia’s company data', id: 'data perusahaan Indonesia' },
    legalRight: `<a href="${PF}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · ${L('Sources: public reporting, filings, company records, BPS, InaExport', 'Sumber: pemberitaan publik, dokumen resmi, catatan perusahaan, BPS, InaExport')}${peerOn ? ', PeeringDB' : ''} · ${L('updated', 'diperbarui')} ${esc(lastIso)}` })}
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/home1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { home, bumnQuad };
