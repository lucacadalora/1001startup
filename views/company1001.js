'use strict';
/* 1001startup.id — one company, in full.
 *
 * The table answers "who is in the census". This answers "what do we actually
 * know about this one", which is the whole point of a census that wants to be
 * useful: money raised, who put it in, where the office is, how many people
 * work there, what we estimated versus what was disclosed, and every source we
 * read to say so.
 *
 * ONE renderer, two contexts. `card()` is the profile itself and is served both
 * as the body of the right-hand drawer on the landing page (GET
 * /company/<id>?panel=1) and as the body of the standalone page (GET
 * /company/<id>). A drawer that rendered its own copy client-side would drift
 * from the page within a week; this cannot.
 *
 * Every class is prefixed cp- and every rule lives in /css/company1001.css, so
 * the card looks identical whether it is injected into the landing page (whose
 * shell styles are inline) or rendered on its own.
 *
 * LANGUAGE: card/page/notFound take lang ('en' default, 'id' at /id/…). The
 * frame translates; census data (notes, verify prose, sources) stays as
 * written — it is the working record, quoted.
 */
const { esc } = require('../lib/util');
const { V } = require('./html');
const GVA = require('./gva');   // one explanation of Output, shared with the landing table
const NAV = require('./nav1001'); // one header for every 1001 page
const CHAIN = require('./chain1001'); // the supply-chain block, same renderer as /chain
const { slugInv, parseInv } = require('./investors1001'); // chips link to /investor/<slug>
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');
const METRO = require('../lib/metros1001'); // kota -> metro, nationwide (28 Sep 2026)

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';
/* No ?city= on this link: the map is one map of Indonesia now, so a pin is a
   pin wherever it stands and ?company= flies straight to it.
   The census map is 1001's own page now — /map on this same host, census layer
   on by default; ?company= flies to the company and opens its card. */
const MAP = '/map';

const fmt = (n, d = 0) => (n === null || n === undefined || n === '') ? '—'
  : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });
/* sub-US$1M rounds are real money: never let 0.125 render as "0" */
const money = (n) => (n === null || n === undefined) ? '—'
  : n >= 10 ? fmt(n, Number.isInteger(n) ? 0 : 1) : n >= 1 ? fmt(n, 1) : fmt(n, 2);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };

/* What the liveness screen actually observed, in words a reader can weigh.
   "blocked-or-error" is not "dead" — several real companies simply refuse this
   VM's IP, and saying so is the difference between a check and an accusation.
   [word EN, why EN, word ID, why ID] */
const SITE = {
  ok: ['live', 'Website responded normally when last checked',
    'aktif', 'Situs web merespons normal saat terakhir dicek'],
  'ok-cleared': ['live', 'Website responded normally; an earlier flag was cleared on review',
    'aktif', 'Situs web merespons normal; penanda sebelumnya dihapus setelah ditinjau'],
  'blocked-or-error': ['blocked', 'Website is up but refuses our checker (bot filter, WAF, or Indonesia-only hosting) — not evidence of a shutdown',
    'memblokir pemeriksa', 'Situs web hidup tetapi menolak pemeriksa kami (filter bot, WAF, atau hosting khusus Indonesia) — bukan bukti tutup'],
  'empty-body': ['thin', 'Website answers, but with almost no content — worth a human look',
    'tipis', 'Situs web menjawab, tetapi nyaris tanpa konten — layak dicek langsung'],
  unreachable: ['unreachable', 'Website did not answer our checker; kept in the census only because other evidence says the company operates',
    'tak terjangkau', 'Situs web tidak menjawab pemeriksa kami; tetap di sensus hanya karena bukti lain menyatakan perusahaannya beroperasi'],
};

const BAND = (v) => v >= 0.8 ? ['high', 'High — primary sources or filings', 'tinggi', 'Tinggi — sumber primer atau dokumen resmi'] :
  v >= 0.6 ? ['medium', 'Medium — credible reporting, not company-confirmed', 'sedang', 'Sedang — pemberitaan kredibel, belum dikonfirmasi perusahaan'] :
    ['low', 'Low — thin public record; the doubt is stated, not hidden', 'rendah', 'Rendah — jejak publik tipis; keraguannya dinyatakan, bukan disembunyikan'];

/* "A, B and C" / "A, B, dan C" */
function joinNames(names, lang) {
  const n = (names || []).filter(Boolean);
  if (n.length < 2) return n.join('');
  const and = lang === 'id' ? 'dan' : 'and';
  return n.length === 2 ? `${n[0]} ${and} ${n[1]}` : `${n.slice(0, -1).join(', ')}${lang === 'id' ? ',' : ''} ${and} ${n[n.length - 1]}`;
}

function factRow(k, v, noteHtml) {
  if (v === null || v === undefined || v === '' || v === '—') return '';
  return `<div class="cp-fact"><dt class="cp-k">${esc(k)}</dt><dd class="cp-v">${v}${
    noteHtml ? `<span class="cp-note">${noteHtml}</span>` : ''}</dd></div>`;
}

const VKIND = {
  listed: ['Market capitalisation', 'Kapitalisasi pasar'],
  private: ['Private mark — what someone last paid', 'Valuasi putaran privat — harga terakhir yang dibayar investor'],
  est: ['Our estimate, derived from published financials', 'Estimasi kami, diturunkan dari laporan keuangan publik'],
};

/* funding_status, in words. An empty funding cell is not one fact but four, and the
   profile page is where a reader comes to find out which one applies to this company. */
const FNONE = {
  undisclosed: ['Raised — the amount was never disclosed', 'Menghimpun dana — nominalnya tidak pernah diumumkan'],
  none_on_record: ['No outside round on record', 'Tidak ada putaran eksternal yang tercatat'],
  parent_funded: ['Raised by the group, not in Indonesia', 'Dihimpun oleh grup, bukan di Indonesia'],
  listed: ['Raised on a public market', 'Dihimpun di pasar modal'],
  debt_only: ['Debt only — no equity round has a public figure', 'Hanya utang — tidak ada putaran ekuitas dengan angka publik'],
  grant_only: ['Grants only — no equity round has a public figure', 'Hanya hibah — tidak ada putaran ekuitas dengan angka publik'],
};
/* the short tag that rides beside a figure whose KIND is not what the column implies */
const FKIND = { partial: 'min', listed: 'ipo', debt_only: 'debt', grant_only: 'grant' };

/* geocode_kind, in words — the map dot is only as exact as this */
const GEO_ID = { street: 'ruas jalan', road: 'ruas jalan', area: 'kawasan' };

function sectionAt(title, inner, lvl = 3) {
  if (!inner) return '';
  return `<section class="cp-sec"><h${lvl} class="cp-h3">${esc(title)}</h${lvl}>${inner}</section>`;
}

/* Peers of comparable size in the same sector — the census is a ranking, so the
   useful neighbours are the ones immediately above and below, not the six
   biggest names a reader already knows. */
function peers(c, companies) {
  const same = companies.filter((x) => x.sector_key === c.sector_key).sort((a, b) => a.rank - b.rank);
  const i = same.findIndex((x) => x.id === c.id);
  if (i < 0 || same.length < 2) return [];
  const out = [];
  for (let d = 1; out.length < 6 && d < same.length; d++) {
    if (same[i - d]) out.push(same[i - d]);
    if (out.length < 6 && same[i + d]) out.push(same[i + d]);
  }
  return out.sort((a, b) => a.rank - b.rank);
}

/* One prose sentence stating the row's key facts with their dates — the unit
   an answer engine (and a skimming reader) actually quotes. Assembled ONLY
   from fields the row carries; a row with no figures gets no sentence. The
   ledger below stays the sourced detail; this is its readable mirror. */
/* The census build date, as a reader would write it: "1 Oct 2026". */
function asOfDate(data, lang) {
  const t = data && Date.parse(data.generated);
  if (!t) return '';
  return new Date(t).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' });
}

/* The answer sentence. Answer engines lift a sentence like this whole, so it
   names its source and date itself: an assistant quoting it says "according to
   1001startup.id" without having to be told (Luca, 4 Oct: answers should say
   "according to 1001startup.id" and link it). */
function sumLine(c, lang, asOf) {
  const id = lang === 'id';
  const parts = [];
  /* founders lead: "pendiri <company>" is how people search (data/census-founders.json) */
  if ((c.founders || []).length) {
    parts.push(id ? `didirikan oleh ${esc(joinNames(c.founders, 'id'))}${c.founded_year ? ` pada ${c.founded_year}` : ''}`
      : `was founded by ${esc(joinNames(c.founders, 'en'))}${c.founded_year ? ` in ${c.founded_year}` : ''}`);
  }
  if (c.employees_est !== null && c.employees_est !== undefined) {
    parts.push(id
      ? `tercatat ${fmt(c.employees_est)} pekerja${c.employees_asof ? ` (dibaca ${esc(c.employees_asof)})` : ''}`
      : `has ${fmt(c.employees_est)} employees on record${c.employees_asof ? ` (read ${esc(c.employees_asof)})` : ''}`);
  }
  if (c.funding_total_usd_m !== null && c.funding_total_usd_m !== undefined) {
    parts.push(id ? `pendanaan yang diumumkan US$${money(c.funding_total_usd_m)} juta`
      : `disclosed funding of US$${money(c.funding_total_usd_m)}M`);
  }
  if (c.valuation_usd_m !== null && c.valuation_usd_m !== undefined) {
    const kind = c.valuation_kind === 'listed'
      ? (id ? 'kapitalisasi pasar' : 'a market capitalisation of')
      : (c.valuation_est || c.valuation_kind === 'est')
        ? (id ? 'estimasi valuasi' : 'an estimated valuation of')
        : (id ? 'valuasi' : 'a valuation of');
    parts.push(`${kind} US$${money(c.valuation_usd_m)}${id ? ' juta' : 'M'}`);
  }
  if (!parts.length) return '';
  const tail = c.kota ? (id ? `; kantor pusatnya di ${esc(c.kota)}` : `; its head office is in ${esc(c.kota)}`) : '';
  const lead = id
    ? `Menurut sensus 1001startup.id${asOf ? ` (diperbarui ${esc(asOf)})` : ''}, `
    : `According to the 1001startup.id census${asOf ? ` (updated ${esc(asOf)})` : ''}, `;
  return `<p class="cp-sum">${lead}${esc(c.name)} ${parts.join(id ? '; ' : '; ')}${tail}.</p>`;
}

/* How to cite this page, ready to copy: the name, the census, the date, the link. */
function citeLine(c, lang, asOf) {
  const id = lang === 'id';
  const url = `${I18N.ORIGIN}${id ? '/id' : ''}/company/${encodeURIComponent(c.id)}`;
  const shown = url.replace(/^https?:\/\//, '');
  return `<p class="cp-cite"><span class="cp-cite-k">${id ? 'Kutip sebagai' : 'Cite as'}</span> ${esc(c.name)}, ${id
    ? 'sensus startup Indonesia 1001startup.id' : '1001startup.id, the census of Indonesian startups'}${asOf
    ? `, ${id ? 'diperbarui' : 'updated'} ${esc(asOf)}` : ''}. <a href="${esc(url)}">${esc(shown)}</a></p>`;
}

function card({ c, data, standalone, links, lang = 'en' }) {
  const L = I18N.mkL(lang);
  /* standalone: the company name is the page's h1, so section headings are h2.
     In the drawer the name is an h2 and they stay h3 — no level is skipped
     in either context. */
  const HL = standalone ? 2 : 3;
  const section = (t, inner) => sectionAt(t, inner, HL);
  const PF = I18N.pfx(lang);
  const companies = (data && data.companies) || [];
  const total = companies.length;
  const S = SITE[c.site_status] || ['unchecked', '', 'belum dicek', ''];
  const siteWord = L(S[0], S[2]);
  const siteWhy = L(S[1], S[3]);
  const B = BAND(c.confidence == null ? 0 : c.confidence);
  const confWord = L(B[0], B[2]);
  const confWhy = L(B[1], B[3]);
  const sources = [...new Set([...(c.sources || []), ...(c.enrich_sources || []), ...(c.funding_src_all || [])])];
  const sib = peers(c, companies);
  const place = [c.kecamatan, c.kota].filter(Boolean).join(', ');
  const m = (data && data.method) || {};
  const ow = GVA.working(c, m, lang);
  const est = (c.est_gva_idr_bn !== null && c.est_gva_idr_bn !== undefined)
    ? `IDR ${fmt(c.est_gva_idr_bn)} ${L('bn', 'mlr')} <span class="cp-u">/ ${L('yr', 'thn')}</span> <span class="cp-est">est</span>` : '';
  /* Luca's rule on the table applies here twice over: a figure without the link
     that carries it reads as an assumption. So every money line names its
     source, and a figure only a data provider holds is marked as such rather
     than borrowing a round announcement's authority. */
  const srcLink = (u, tier) => u
    ? ` <a class="cp-srcl" href="${esc(u)}" target="_blank" rel="noopener nofollow" title="${
      tier === 'tracker' ? L('Carried by a data provider, not a round announcement', 'Dimuat penyedia data, bukan pengumuman putaran') : L('Source', 'Sumber')}: ${esc(u)}">${esc(host(u))}${
      tier === 'tracker' ? ' <span class="cp-trk">trk</span>' : ''}</a>` : '';

  return `<article class="cp" data-id="${esc(c.id)}">
  <header class="cp-top">
    <div class="cp-ident">
      ${c.logo ? `<img class="cp-logo" src="${esc(c.logo)}" alt="" width="46" height="46">` : '<span class="cp-logo cp-blank"></span>'}
      <div class="cp-names">
        ${standalone
          /* the page's one h1 is the company name — the drawer keeps h2 (the
             landing page already has its own h1) */
          ? `<h1 class="cp-name">${esc(c.name)}</h1>`
          : `<h2 class="cp-name" id="cp-title">${esc(c.name)}</h2>`}
        ${c.legal_name ? `<div class="cp-legal">${esc(c.legal_name)}</div>` : ''}
      </div>
    </div>
    <div class="cp-tags">
      ${c.group_parent ? `<span class="cp-tag cp-grp" title="${esc(c.group_parent.relation || '')}">${L('Part of', 'Bagian dari')} ${esc(c.group_parent.group || '')}</span>` : ''}
      <a class="cp-tag cp-sector" href="${PF}/sector/${esc(c.sector_key || 'misc')}" title="${L('All companies in this sector', 'Semua perusahaan di sektor ini')}">${esc(c.sector_label || '')}</a>
      ${c.yc_batch ? `<span class="cp-tag cp-yc">Y Combinator ${esc(c.yc_batch)}</span>` : ''}
      ${c.endeavor ? `<span class="cp-tag cp-ed" title="${esc(c.endeavor_note || (c.endeavor_entrepreneurs || []).join(', '))}">Endeavor</span>` : ''}
      ${c.antler ? `<span class="cp-tag cp-an" title="${esc(c.antler_note || L('Antler-funded', 'Didanai Antler'))}">Antler</span>` : ''}
      ${c.bootstrapped ? '<span class="cp-tag">Bootstrapped</span>' : ''}
      ${/* the city, linked to its /city page. Greater Jakarta keeps its old reading:
           no tag inside DKI, "Bodetabek" in the ring around it. */
        c.metro && c.metro !== 'jakarta'
          ? `<a class="cp-tag" href="${PF}/city/${esc(c.metro)}" title="${L('All companies in this city', 'Semua perusahaan di kota ini')}">${esc(METRO.name(c.metro, lang, c.kota))}</a>`
          : c.in_dki === false ? `<a class="cp-tag" href="${PF}/city/jakarta" title="${L('All companies in Greater Jakarta', 'Semua perusahaan di Jakarta Raya')}">Bodetabek</a>` : ''}
      <span class="cp-tag cp-rank">${L('Census', 'Sensus')} #${esc(c.rank)}${total ? ` ${L('of', 'dari')} ${total}` : ''}</span>
    </div>
    ${c.sector ? `<p class="cp-what">${esc(c.sector)}</p>` : ''}
    ${/* group companies (Luca, 24 Oct 2026): counted, but said plainly whose they are */
      c.group_parent ? `<p class="cp-grpline">${L(
        `Part of ${esc(c.group_parent.group)}: ${esc(c.group_parent.relation || '')}. Counted here as a company of its own, with its own payroll, but it was not built by founders or venture money.`,
        `Bagian dari ${esc(c.group_parent.group)}: ${esc(c.group_parent.relation_id || c.group_parent.relation || '')}. Dihitung di sini sebagai perusahaan tersendiri dengan daftar gajinya sendiri, tetapi tidak dibangun oleh pendiri atau modal ventura.`)}${
        c.group_parent.src ? ` <a class="cp-srcl" href="${esc(c.group_parent.src)}" target="_blank" rel="noopener nofollow">${L('source', 'sumber')}</a>` : ''}</p>` : ''}
    ${sumLine(c, lang, asOfDate(data, lang))}
    ${standalone ? citeLine(c, lang, asOfDate(data, lang)) : ''}
    <div class="cp-act">
      ${c.url ? `<a class="cp-btn cp-primary" href="${esc(c.url)}" target="_blank" rel="noopener">${L('Visit website', 'Kunjungi situs')} <span aria-hidden="true">↗</span></a>` : ''}
      ${/* every located company: the logo map (Oct 2026) covers the whole
           country, not only the metros the old map had boundaries for */
        (c.lat && c.lon) ? `<a class="cp-btn" href="${PF}${MAP}?company=${encodeURIComponent(c.id)}" target="_blank" rel="noopener">${L('See on the map', 'Lihat di peta')} <span aria-hidden="true">↗</span></a>` : ''}
      <button class="fw1001" type="button" data-fk="company" data-fr="${esc(c.id)}" hidden>${L('Follow', 'Ikuti')}</button>
    </div>
  </header>

  ${c.sprite ? `<div class="cp-art"><img src="${esc(c.sprite)}" alt="" loading="lazy"></div>` : ''}

  <dl class="cp-facts">
    ${factRow(L('Founders', 'Pendiri'), (c.founders || []).length
      ? esc(joinNames(c.founders, lang)) + (c.founded_year ? ` <span class="cp-u">${L('founded', 'berdiri')} ${c.founded_year}</span>` : '')
        + (c.founders_src || []).filter((u, i, a) => a.findIndex((v) => host(v) === host(u)) === i).slice(0, 2).map((u) => srcLink(u)).join('')
      : '', c.founders_note ? esc(c.founders_note) : '')}
    ${factRow(L('Disclosed funding', 'Pendanaan diumumkan'), c.funding_total_usd_m === null || c.funding_total_usd_m === undefined
      ? `<span class="cp-none">${FNONE[c.funding_status] ? L(...FNONE[c.funding_status]) : L('No figure we could source', 'Tidak ada angka yang bisa kami rujuk')}</span>`
      : `<span class="cp-u">US$</span> ${money(c.funding_total_usd_m)} <span class="cp-u">${L('M', 'juta')}</span>${FKIND[c.funding_status] ? ` <span class="cp-est">${FKIND[c.funding_status]}</span>` : ''}${srcLink(c.funding_src, c.funding_src_tier)}`,
      [c.funding_note ? esc(c.funding_note) : '',
        /* the day the search was run — an empty funding cell is a research result, and a
           research result without a date cannot be told apart from one nobody has revisited */
        c.funding_asof ? esc(L('Checked ', 'Diperiksa ') + c.funding_asof + '.') : ''].filter(Boolean).join(' '))}
    ${factRow(L('Last round', 'Putaran terakhir'), c.last_round ? esc(c.last_round) + (c.last_round_year ? ` <span class="cp-u">${c.last_round_year}</span>` : '') : '')}
    ${factRow(L('Valuation', 'Valuasi'), c.valuation_usd_m === null || c.valuation_usd_m === undefined ? ''
      : `<span class="cp-u">US$</span> ${money(c.valuation_usd_m)} <span class="cp-u">${L('M', 'juta')}</span>${c.valuation_est ? ' <span class="cp-est">est</span>' : ''}`,
      [c.valuation_kind ? esc(L(...(VKIND[c.valuation_kind] || [c.valuation_kind, c.valuation_kind]))) + (c.valuation_asof ? `${L(', read ', ', dibaca ')}${esc(c.valuation_asof)}` : '') : '',
        c.valuation_counted === false ? L('Held out of the census’s combined valuation to avoid counting the same money twice.',
          'Dikeluarkan dari valuasi gabungan sensus agar uang yang sama tidak dihitung dua kali.') : '',
      ].filter(Boolean).join(' '))}
    ${factRow(L('People', 'Pekerja'), c.employees_est === null || c.employees_est === undefined ? ''
      : `${fmt(c.employees_est)} <span class="cp-u">${L('employees', 'orang')}</span>${c.workforce_split
        ? ` — ${fmt(c.workforce_split.office)} <span class="cp-u">${L('office', 'kantor')}</span> · ${fmt(c.workforce_split.frontline)} <span class="cp-u">${L('frontline', 'garda depan')}</span>`
        : (c.workforce_kind === 'frontline' ? ' <span class="cp-est">frontline</span>' : '')}${srcLink(c.employees_src)}`,
      c.employees_asof ? `${L('Read', 'Dibaca')} ${esc(c.employees_asof)}` : L('Date of this figure not recorded', 'Tanggal angka ini tidak tercatat'))}
    ${c.output_withheld ? factRow('Output', `<span class="cp-none">${esc(GVA.withheld(c, lang, METRO.name(c.metro, lang, c.kota)).t)}</span>`,
      esc(GVA.withheld(c, lang, METRO.name(c.metro, lang, c.kota)).b)) : ''}
    ${factRow('Output', est, ow
      ? (lang === 'id'
        ? `${fmt(ow.people)} pekerja × Rp ${fmt(ow.rate)} juta nilai tambah per pekerja — ${
          ow.own ? 'anchor ' + esc(ow.label) : 'default Rp ' + fmt(ow.rate) + ' juta, sektor ini belum punya anchor sendiri'}`
        : `${fmt(ow.people)} employees × Rp ${fmt(ow.rate)} million of value added per worker — the ${
          ow.own ? esc(ow.label) + ' anchor' : 'Rp ' + fmt(ow.rate) + ' million default, this sector having no anchor of its own'}`)
      : '')}
    ${factRow(L('Where', 'Lokasi'), place ? esc(place) : '')}
  </dl>

  ${section(L('Investors', 'Investor'), (c.investors || []).length
    ? `<div class="cp-inv">${c.investors.map((i) => `<a class="cp-chip" href="${PF}/investor/${esc(slugInv(parseInv(i).name))}">${esc(i)}</a>`).join('')}</div>`
    : (c.bootstrapped ? `<p class="cp-p cp-none">${L('No outside investors on record — the company reports itself as bootstrapped.',
      'Tidak ada investor luar yang tercatat — perusahaan menyatakan dirinya bootstrapped.')}</p>` : ''))}

  ${CHAIN.panel(c, links, lang, HL)}

  ${section(L('Head office', 'Kantor pusat'), c.hq_address ? `<p class="cp-p cp-addr">${esc(c.hq_address)}</p>${
    c.geocode_kind && c.geocode_kind !== 'building'
      ? `<p class="cp-fine">${lang === 'id'
        ? `Dipatok ke ${esc(GEO_ID[c.geocode_kind] || c.geocode_kind)} tempatnya berada, bukan ke gedungnya — titik di peta seakurat itu.`
        : `Pinned to the ${esc(c.geocode_kind)} it sits in, not to the building — the map dot is that approximate.`}</p>`
      : ''}` : '')}

  ${section(L('Public contact', 'Kontak publik'), (c.public_contacts || []).length
    ? `<ul class="cp-prov">${c.public_contacts.map((x) => `<li><span class="cp-lbl">${
      x.type === 'email_role' ? L('Email', 'Email') : x.type === 'phone_business' ? L('Phone', 'Telepon') : L('Careers', 'Karier')}</span> ${
      x.type === 'email_role' ? `<a href="mailto:${esc(x.value)}">${esc(x.value)}</a>`
        : x.type === 'phone_business' ? `<a href="tel:${esc(x.tel || x.value)}">${esc(x.value)}</a>`
          : `<a href="${esc(x.value)}" target="_blank" rel="noopener">${L('Careers page', 'Halaman karier')} ↗</a>`}${
      x.source ? ` <a class="cp-srcl" href="${esc(x.source)}" target="_blank" rel="noopener nofollow">${L('source', 'sumber')}</a>` : ''}</li>`).join('')}</ul>${
      c.contact_checked ? `<p class="cp-fine">${L(
        `Published on the company's own pages, read ${esc(String(c.contact_checked).slice(0, 10))}. Role mailboxes and office lines only: no personal address is guessed and no mobile number is shown.`,
        `Tercantum di halaman resmi perusahaan, dibaca ${esc(String(c.contact_checked).slice(0, 10))}. Hanya email fungsi dan nomor kantor: tidak ada alamat pribadi yang ditebak dan nomor ponsel tidak ditampilkan.`)}</p>` : ''}`
    : '')}

  ${section(L('What the figures mean', 'Arti angka-angkanya'), [
    c.valuation_note ? `<p class="cp-p"><span class="cp-lbl">${L('Valuation', 'Valuasi')}</span>${esc(c.valuation_note)}</p>` : '',
    (c.employees_note || c.workforce_note) ? `<p class="cp-p"><span class="cp-lbl">${L('Headcount', 'Pekerja')}</span>${esc([c.employees_note, c.workforce_note].filter(Boolean).join(' '))}</p>` : '',
    /* Luca, Aug 29: "i think we need to elaborate what is output". A number
       labelled only by its unit gets read as revenue or as the wage bill, and
       it is neither — so the definition travels with the figure. */
    ow ? `<p class="cp-p"><span class="cp-lbl">Output</span>${esc(GVA.t(lang).SHORT)}${
      c.output_caveat ? ' ' + esc(L('On this row the estimate runs high. ', 'Pada baris ini estimasinya diketahui terlalu tinggi. ') + c.output_caveat.why) : ''
    } <a class="cp-srcl" href="${PF}/coverage#output">${L('How every output figure is made →', 'Cara setiap angka output dibuat →')}</a></p>` : '',
    c.valuation_parent_note ? `<p class="cp-p"><span class="cp-lbl">${L('Overlap', 'Tumpang-tindih')}</span>${esc(c.valuation_parent_note)}</p>` : '',
    c.notes ? `<p class="cp-p"><span class="cp-lbl">${L('Note', 'Catatan')}</span>${esc(c.notes)}</p>` : '',
  ].join(''))}

  ${section(L('How well we know this', 'Seberapa baik kami mengetahuinya'), `
    <div class="cp-conf">
      <div class="cp-bar" role="img" aria-label="${L('Confidence', 'Keyakinan')} ${c.confidence == null ? L('unknown', 'tak diketahui') : c.confidence} ${L('out of', 'dari')} 1">
        <span style="width:${Math.round((c.confidence == null ? 0 : c.confidence) * 100)}%"></span>
      </div>
      <div class="cp-confv">${c.confidence == null ? '—' : c.confidence.toFixed(2)} · ${esc(confWord)}</div>
    </div>
    <p class="cp-fine">${esc(confWhy)}</p>
    ${c.verify_note ? `<p class="cp-p">${esc(c.verify_note)}</p>` : ''}
    ${c.operating_evidence ? `<p class="cp-p"><span class="cp-lbl">${L('Still operating', 'Masih beroperasi')}</span>${esc(c.operating_evidence)}</p>` : ''}
    <ul class="cp-prov">
      <li><span class="cp-dot cp-${esc(S[0] === 'unchecked' ? 'unchecked' : S[0])}"></span>${L('Website', 'Situs web')} ${esc(siteWord)}${c.liveness_checked ? ` — ${L('checked', 'dicek')} ${esc(c.liveness_checked)}` : ''}${siteWhy ? `. ${esc(siteWhy)}` : ''}</li>
      ${c.refuted ? `<li><span class="cp-dot cp-live"></span>${L('Every figure above was put to an adversarial re-check on', 'Setiap angka di atas diuji ulang secara adversarial pada')} ${esc(c.refuted)} — ${L('the numbers that survived are the ones shown.', 'angka yang bertahan itulah yang ditampilkan.')}</li>` : ''}
    </ul>`)}

  ${section(L(sources.length === 1 ? 'Source' : 'Sources', 'Sumber'), sources.length
    ? `<ol class="cp-src">${sources.map((u) => `<li><a href="${esc(u)}" target="_blank" rel="noopener nofollow"><span class="cp-srch">${esc(host(u))}</span><span class="cp-srcu">${esc(u)}</span></a></li>`).join('')}</ol>`
    : '')}

  ${section(`${L('Comparable in', 'Sebanding di')} ${c.sector_label || L('this sector', 'sektor ini')}`, sib.length
    ? `<div class="cp-sibs">${sib.map((s) => `<a class="cp-sib" href="${PF}/company/${esc(s.id)}" data-cp="${esc(s.id)}">
        ${s.logo ? `<img src="${esc(s.logo)}" alt="" width="20" height="20" loading="lazy">` : '<span class="cp-blank sm"></span>'}
        <span class="cp-sibn">${esc(s.name)}</span>
        <span class="cp-sibr">#${s.rank}</span></a>`).join('')}</div>`
    : '')}

  <footer class="cp-foot">${L('Public sources only. Figures marked <span class="cp-est">est</span> are ours, derived and labeled — never disclosed numbers.',
    'Sumber publik saja. Angka bertanda <span class="cp-est">est</span> adalah estimasi kami sendiri, diturunkan dan diberi label — bukan angka yang diumumkan.')} <a href="${PF}/model">${L('How the estimates are built →', 'Cara estimasi ini dibangun →')}</a></footer>
</article>`;
}

/* The 1001 shell, standalone. Kept here rather than shared with the landing on
 * purpose: /company/<id> must render even while the landing is being edited. */
const SHELL = (inner, { title, desc, lang = 'en', path, noindex, extraHead, ogImg }) => {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${noindex ? 'noindex, nofollow' : 'index, follow'}">
${path ? I18N.headTags(lang, path) + '\n' + I18N.ogImage(ogImg) : ''}${extraHead || ''}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
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
main.cpmain{max-width:820px;margin:0 auto;padding:26px 20px 0}
.crumb{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-bottom:18px}
.crumb a{text-decoration:none;border-bottom:1px solid #D9D9D9;color:#52525B}
.crumb a:hover{color:#000}
footer.site{max-width:1180px;margin:60px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
</style>
</head>
<body>
<div class="banner">${L('WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY DERIVED FIGURE IS A LABELED ESTIMATE', 'DOKUMEN KERJA · SUMBER PUBLIK SAJA · ANGKA TURUNAN SELALU BERLABEL ESTIMASI')}</div>
${NAV.header('companies', { lang, path: path || '/' , translated: !!path })}
<main class="cpmain">
${inner}
</main>
<footer class="site">
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="${PF}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · ${L('Anchors: BPS', 'Anchor: BPS')}</span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
};

function page({ c, data, links, lang = 'en', og }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const bits = [c.sector_label, c.kota,
    c.funding_total_usd_m ? L(`US$${money(c.funding_total_usd_m)}M raised`, `menghimpun dana US$${money(c.funding_total_usd_m)} juta`) : null,
    c.employees_est ? L(`${fmt(c.employees_est)} employees`, `${fmt(c.employees_est)} pekerja`) : null].filter(Boolean);
  /* Organization structured data — only what the census page itself shows, no
     field is ever invented; search engines read this as the machine copy of
     the fact ledger above. */
  const ld = { '@context': 'https://schema.org', '@type': 'Organization', name: c.name };
  if (c.legal_name) ld.legalName = c.legal_name;
  if (c.url) ld.url = c.url;
  if (c.logo) ld.logo = I18N.ORIGIN + c.logo;
  if (c.employees_est) ld.numberOfEmployees = { '@type': 'QuantitativeValue', value: c.employees_est };
  if ((c.founders || []).length) ld.founder = c.founders.map((n) => ({ '@type': 'Person', name: n }));
  if (c.founded_year) ld.foundingDate = String(c.founded_year);
  if (c.hq_address || c.kota) {
    ld.address = { '@type': 'PostalAddress', addressCountry: 'ID' };
    if (c.hq_address) ld.address.streetAddress = c.hq_address;
    if (c.kota) ld.address.addressLocality = c.kota;
    if (c.province) ld.address.addressRegion = c.province;
  }
  /* the structured trail uses the same words as the visible one below —
     Google wants BreadcrumbList to match what the page shows */
  const secName = c.sector_label || L('Companies', 'Perusahaan');
  const crumb = [{ name: '1001startup.id', path: '/' },
    { name: secName, path: '/sector/' + (c.sector_key || 'misc') },
    { name: c.name, path: '/company/' + c.id }];
  /* The page itself: part of the census dataset, published and credited by
     1001startup.id, dated by the census build. */
  const pageUrl = `${I18N.ORIGIN}${PF}/company/${encodeURIComponent(c.id)}`;
  const web = { '@context': 'https://schema.org', '@type': 'WebPage', url: pageUrl, name: c.name,
    inLanguage: lang === 'id' ? 'id-ID' : 'en',
    about: { '@type': 'Organization', name: c.name },
    isPartOf: { '@type': 'Dataset', name: lang === 'id' ? 'Sensus Startup Indonesia' : 'The Indonesian Startup Census', url: I18N.ORIGIN + PF + '/' },
    publisher: { '@type': 'Organization', name: '1001startup.id', url: I18N.ORIGIN + '/' },
    creditText: '1001startup.id' };
  if (data && Date.parse(data.generated)) web.dateModified = new Date(Date.parse(data.generated)).toISOString().slice(0, 10);
  const extraHead = `\n<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
    + `\n<script type="application/ld+json">${JSON.stringify(web).replace(/</g, '\\u003c')}</script>`
    + SCHEMA.breadcrumbLd(lang, crumb);
  return SHELL(
    `<nav class="crumb"><a href="${PF}/">1001startup.id</a> / <a href="${PF}/sector/${esc(c.sector_key || 'misc')}">${esc(c.sector_label || L('Companies', 'Perusahaan'))}</a> / ${esc(c.name)}</nav>
${card({ c, data, standalone: true, links, lang })}
<p class="crumb" style="margin:22px 0 0"><a href="${NAV.censusHref(PF)}">&larr; ${L('Back to the census', 'Kembali ke sensus')}</a></p>`,
    { title: SCHEMA.fitTitle(lang === 'id'
      ? [...((c.founders || []).length ? [`${c.name} — pendiri, pendanaan, valuasi — 1001startup.id`, `${c.name} — pendiri, pendanaan, valuasi`] : []),
        `${c.name} — pendanaan, valuasi, jumlah karyawan — 1001startup.id`,
        `${c.name} — pendanaan, valuasi, jumlah karyawan`,
        `${c.name} — pendanaan & jumlah karyawan`,
        `${c.name} — data pendanaan`,
        c.name]
      : [...((c.founders || []).length ? [`${c.name} — founders, funding, valuation — 1001startup.id`, `${c.name} — founders, funding, valuation`] : []),
        `${c.name} — funding, valuation, employees — 1001startup.id`,
        `${c.name} — funding, valuation, employees`,
        `${c.name} — funding & employees`,
        c.name]),
      /* a sparse row carries only one or two facts, which lands under the
         ~70-char floor — the census frame is added back in that case */
      desc: `${c.name}: ${bits.join(' · ')}. ${bits.length < 3
        ? L('In the Indonesian startup census, with every figure linked to its source.',
          'Ada di sensus startup Indonesia, dengan setiap angka tertaut ke sumbernya.')
        : L('Public sources, estimates labeled.', 'Sumber publik, estimasi diberi label.')}`,
      lang, path: `/company/${c.id}`, extraHead,
      /* the company's own share card where one is generated (og-cards.json) */
      ogImg: og ? I18N.ORIGIN + og : undefined });
}

function notFound({ data, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const n = ((data && data.companies) || []).length;
  return SHELL(
    `<nav class="crumb"><a href="${PF}/">1001startup.id</a> / ${L('Not in the census', 'Tidak ada di sensus')}</nav>
    <h1 style="font-size:34px;letter-spacing:-0.02em;font-weight:500;margin-bottom:12px">${L('No company at that address.', 'Tidak ada perusahaan di alamat itu.')}</h1>
    <p style="color:#52525B;max-width:60ch">${L(`The census holds ${n} companies right now and this is not one of them — it may have been removed by the liveness screen, or it may never have been added.`,
      `Sensus saat ini memuat ${n} perusahaan dan yang ini bukan salah satunya — mungkin sudah dihapus oleh uji operasional, atau memang tidak pernah ditambahkan.`)}
    <a href="${NAV.censusHref(PF)}">${L('Search the table', 'Telusuri tabelnya')}</a>${L(', or see ', ', atau lihat ')}<a href="${PF}/closed">${L('what closed', 'yang tutup')}</a>.</p>`,
    { title: `${L('Not in the census', 'Tidak ada di sensus')} — 1001startup.id`, desc: L('No company at that address.', 'Tidak ada perusahaan di alamat itu.'), lang, noindex: true });
}

module.exports = { card, page, notFound };
