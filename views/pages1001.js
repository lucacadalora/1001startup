'use strict';
/* 1001startup.id — the census as its own product: Indonesia's startup graph.
 * Served when the request host is 1001.vantis.sh (later: 1001startup.id).
 * Deliberately NOT the PASAR shell — own brand, same editorial-technical
 * design system (Overused Grotesk + IBM Plex Mono, white, hairlines, square,
 * one gradient). Server-rendered from census.json per request; the search box
 * filters the server-rendered rows client-side. All estimates labeled. */
const { esc } = require('../lib/util');
const { V } = require('./html');   // shared cache-buster: /js and /css ship immutable for a year
const GVA = require('./gva');      // one explanation of Output, shared with the profile card
const NAV = require('./nav1001');  // one header for every 1001 page
const I18N = require('./i18n1001'); // /id — Bahasa Indonesia lives at /id/<path>
const SCHEMA = require('./schema1001'); // Organization/WebSite/Dataset + breadcrumbs
const FOOT = require('./footer1001'); // one footer, columns from the nav data

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';

/* path: '/' while the old front page is live, '/startups' once the
   four-dataset front page takes / (lib/homelive.js). Same page either way —
   only its address, canonical pair and structured data follow it. */
function landing({ data, lang = 'en', path = '/' }) {
  const L = I18N.mkL(lang);   // L('english', 'indonesian') — falls back to English
  const PF = I18N.pfx(lang);  // '' or '/id': prefix for every in-site link
  const fmt = (n, d = 0) => (n === null || n === undefined) ? '—'
    : n.toLocaleString('en-US', { maximumFractionDigits: d });
  /* sub-US$1M rounds are real money: never let 0.125 render as "0" */
  /* >=10 keeps one decimal when the figure has one: Modalku's corrected 246.5
     must not print as 247 — an integer here misstates a sourced number */
  const money = (n) => (n === null || n === undefined) ? '—'
    : n >= 10 ? fmt(n, Number.isInteger(n) ? 0 : 1) : n >= 1 ? fmt(n, 1) : fmt(n, 2);
  const sv = (n) => (n === null || n === undefined) ? '' : n;
  /* US$ billions always carry one decimal: 14.0 must not print as "14" */
  const usdB = (m) => 'US$' + ((m || 0) / 1000).toFixed(1) + 'B';
  const T = (data && data.totals) || {};
  /* The answer sentence for the census as a whole: names its source and date,
     so an assistant quoting it says "according to 1001startup.id" (Luca, 4 Oct). */
  const asOf = data && Date.parse(data.generated) ? new Date(Date.parse(data.generated)).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '';
  /* group companies (Luca, 24 Oct 2026): tech companies owned by a big group or a
     listed company are counted too, each flagged with its group, so the headline
     says how many of the rows are not founder- or venture-built */
  const nGroup = ((data && data.companies) || []).filter((c) => c.group_parent).length;
  const heroFact = T.companies ? `<p class="fact">${L(
    `According to 1001startup.id${asOf ? ` (updated ${asOf})` : ''}, ${fmt(T.companies)} Indonesian startups are on record, with US$${(T.funding_usd_b || 0).toFixed(1)} billion in disclosed funding and an estimated ${fmt(T.jobs)} jobs.${nGroup ? ` ${fmt(nGroup)} of them belong to a big group or listed company and are flagged as such.` : ''}`,
    `Menurut 1001startup.id${asOf ? ` (diperbarui ${asOf})` : ''}, sensus ini mencatat ${fmt(T.companies)} startup Indonesia, dengan pendanaan yang diumumkan US$${(T.funding_usd_b || 0).toFixed(1)} miliar dan sekitar ${fmt(T.jobs)} lapangan kerja (estimasi).${nGroup ? ` ${fmt(nGroup)} di antaranya milik grup besar atau perusahaan tercatat dan diberi tanda.` : ''}`)}</p>` : '';
  const companies = (data && data.companies) || [];
  const m = (data && data.method) || {};
  const bySector = (data && data.by_sector) || [];
  const YC = (data && data.yc) || {};
  const ED = (data && data.endeavor) || {};
  const AN = (data && data.antler) || {};
  const LV = (data && data.liveness) || {};
  const VAL = (data && data.valuation) || {};
  const SC = (data && data.scope) || {};
  /* Which metros the census actually covers, read off the data rather than
     written into the copy — the hero said "Greater Jakarta first" for a day
     after Bandung was merged, which is the kind of line that quietly goes
     stale every time the scope moves. */
  const METROS = (data && data.by_metro || []).filter((x) => x.count);
  /* comma-join with a final 'and', so the line reads "A (n), B (n) and C (n)"
     instead of stacked 'and's. Nationwide (28 Sep 2026) the list can run to
     dozens of cities, so past four it names the three largest and counts the
     rest — every city still has its own /city page, linked from its companies. */
  /* each metro name links to its /city page — the hero is the site's
     strongest page, so this is the crawl path that ranks the city landings */
  /* name_id arrives with the 28 Sep 2026 build; before that, "Greater Jakarta"
     is the only name that differs in Indonesian */
  const METRO_NAMES = METROS.map((x) => `<a href="${PF}/city/${esc(x.id)}">${esc(lang === 'id' ? (x.name_id || (x.name === 'Greater Jakarta' ? 'Jakarta Raya' : x.name)) : x.name)}</a> (${fmt(x.count)})`);
  const METRO_LIST = METRO_NAMES.length > 4
    ? METRO_NAMES.slice(0, 3).join(', ') + L(` and ${METRO_NAMES.length - 3} more`, ` dan ${METRO_NAMES.length - 3} kota lainnya`)
    : METRO_NAMES.length > 1
      ? METRO_NAMES.slice(0, -1).join(', ') + L(' and ', ' dan ') + METRO_NAMES[METRO_NAMES.length - 1]
      : METRO_NAMES.join('');
  const METRO_LINE = !METROS.length ? ''
    : METROS.length > 4 ? L(`, across ${METROS.length} cities: `, ` — mencakup ${METROS.length} kota: `) + METRO_LIST
      : L(', ', ' — mencakup ') + METRO_LIST;
  const hasFunding = (c) => c.funding_total_usd_m !== null && c.funding_total_usd_m !== undefined && c.funding_total_usd_m > 0;
  const fundedCount = companies.filter(hasFunding).length;
  /* Luca, Aug 29: "we need to put a link of the funding information, so it not
     looks like assumption". So: every figure is a link to the source that carries
     it, a figure only a data provider carries is marked trk rather than borrowing
     a round announcement's authority, and an em-dash on a company that HAS raised
     still explains itself on hover instead of reading like an oversight. */
  const srcHost = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };

  /* Every mark in the table carries its explanation as data, and one shared
     panel (public/js/1001.js) opens it on hover, on keyboard focus and on tap.
     A native title= was the wrong container for this: it does not exist on a
     phone at all, it truncates tiket.com's thousand-character working to one
     unreadable line, and it cannot hold the link to the parent row that the
     "in parent" mark is entirely about. */
  const byId = new Map(companies.map((c) => [c.id, c]));
  const nameOf = (id) => (byId.get(id) || {}).name || id;
  const VKIND = lang === 'id'
    ? { listed: 'Kapitalisasi pasar terkini', private: 'Valuasi putaran privat', est: 'Estimasi' }
    : { listed: 'Live market capitalisation', private: 'Private mark', est: 'Estimate' };
  /* Prose that is identical on hundreds of rows travels ONCE, as a JSON
     island the note panel reads (public/js/1001.js). Marks reference it with
     "~key" / sf / lf, and `lc:1` means "link this row's own company page",
     which the client reads off the row rather than repeating 387 times. */
  const NOTE_DICT = (() => {
    const g = GVA.noteFrag(lang);
    return {
      f: Object.assign({ cpre: L('Full record for ', 'Profil lengkap ') }, g.f),
      l: Object.assign({}, g.l),
    };
  })();
  const note = (o) => `data-n="${esc(JSON.stringify(o))}"`;
  /* WCAG 2.5.3 (Label in Name): a control's accessible name must CONTAIN its
     visible text, or voice control cannot address it — "3,411" read out as
     "Jumlah pekerja, lihat sumbernya" was unreachable by what the user sees.
     The visible label is therefore always the start of the name, and the
     descriptions that follow it are short (they were also 69KB of the page). */
  const mark = (cls, label, aria, payload) => {
    /* Prefix the visible label into the name ONLY when it is speakable — the
       dash marks' label is an em dash, which voice control cannot say and
       which produced "— — no amount disclosed". */
    const lab = String(label);
    const name = /[\p{L}\p{N}]/u.test(lab) ? lab + ' — ' + aria : aria;
    return `<button type="button" class="${cls}" ${note(payload)} aria-expanded="false" aria-label="${esc(name)}">${label}</button>`;
  };

  const estMark = (c) => mark('estt', 'est',
    L('estimated valuation, show the working', 'valuasi estimasi, lihat perhitungannya'), {
      k: 'est',
      t: L('Estimate — not a disclosed figure', 'Estimasi — bukan angka yang diumumkan'),
      b: c.valuation_note || L('Derived from public financials, not a disclosed figure.', 'Diturunkan dari laporan keuangan publik, bukan angka yang diumumkan.'),
      /* the kicker already says ESTIMATE — the meta line only earns its space
         when it adds the kind or the date the figure was read */
      m: [c.valuation_kind && c.valuation_kind !== 'est' ? (VKIND[c.valuation_kind] || c.valuation_kind) : '',
        c.valuation_asof ? L('figure read ', 'angka dibaca ') + c.valuation_asof : ''].filter(Boolean).join(' \u00b7 '),
      lc: 1,
    });

  const heldMark = (c) => mark('estt held', 'in parent',
    L('already counted inside ', 'sudah terhitung di dalam ') + nameOf(c.valuation_parent_id), {
      k: 'held',
      t: lang === 'id' ? 'Sudah ada di dalam tanda ' + nameOf(c.valuation_parent_id)
        : 'Already inside ' + nameOf(c.valuation_parent_id) + '\u2019s mark',
      b: c.valuation_parent_note
        || L('The parent\u2019s valuation already contains this company, so the row is held out of the combined figure.',
          'Valuasi induknya sudah memuat perusahaan ini, jadi baris ini dikeluarkan dari angka gabungan.'),
      m: L('Kept in this table \u00b7 held out of the combined valuation', 'Tetap di tabel ini \u00b7 dikeluarkan dari valuasi gabungan'),
      l: [
        { h: PF + '/company/' + c.valuation_parent_id, t: nameOf(c.valuation_parent_id) + L(' \u2014 the row that carries it \u2192', ' \u2014 baris yang memuatnya \u2192') },
        { h: PF + '/coverage#valuation', t: L('What the combined valuation contains \u2192', 'Isi valuasi gabungan \u2192') },
      ],
    });

  /* Luca, 29 Aug 2026: "it needs indonesian only value/job totals … not
     mitra/freelancer (so driver is not being calculates for it)". Grab, Shopee,
     Lazada, Ninja Xpress and J&T are foreign groups running Jakarta head
     offices. They belong in a Jakarta census — but their group market
     capitalisation is not an Indonesian number and their drivers are not
     employees, so both facts are stated ON the row rather than in a footnote
     nobody scrolls to. */
  /* Group companies (Luca, 24 Oct 2026): a tech company owned by a big group or a
     listed company is counted, but it is not founder- or venture-built, so the row
     says whose it is instead of passing as a startup. */
  const grpMark = (c) => {
    const g = c.group_parent || {};
    return mark('estt grb', 'group', L('part of ' + g.group, 'bagian dari ' + g.group), {
      k: 'group',
      t: L('Part of ' + g.group, 'Bagian dari ' + g.group),
      b: lang === 'id'
        ? (g.relation_id || g.relation || '') + '. Dihitung sebagai perusahaan tersendiri dengan daftar gajinya sendiri, '
          + 'tetapi tidak dibangun oleh pendiri atau modal ventura: pemiliknya grup besar atau perusahaan tercatat.'
        : (g.relation || '') + '. Counted as a company of its own, with its own payroll, but not built by founders '
          + 'or venture money: a big group or listed company owns it.',
      m: g.ticker ? (lang === 'id' ? 'Induk tercatat: ' : 'Listed parent: ') + g.ticker : '',
      l: g.src ? [{ h: g.src, t: L('Source for the ownership', 'Sumber kepemilikan') }] : [],
      lc: 1,
    });
  };

  const idOnlyMark = (c) => {
    const g = c.global_parent || {};
    const gv = g.group_valuation_usd_m
      ? 'US$' + (g.group_valuation_usd_m / 1000).toFixed(1) + 'B'
        + (g.group_valuation_asof ? L(' on ', ' per ') + g.group_valuation_asof : '') : '';
    return mark('estt idb', 'id only', L('Indonesia-only figures on this row', 'angka khusus Indonesia pada baris ini'), {
      k: 'idonly',
      t: L('Counted at its Indonesian size only', 'Dihitung pada ukuran Indonesianya saja'),
      b: lang === 'id'
        ? (g.group ? g.group + (g.listing ? ' (' + g.listing + ')' : '') + ' adalah induknya'
              + (gv ? ', senilai ' + gv : '') + '. ' : '')
          + 'Kapitalisasi pasar grup, dan modal yang dihimpun induk asing untuk satu kawasan, bukanlah '
          + 'angka Indonesia, jadi keduanya tidak dicetak ulang di kolom-kolom itu. '
          + (g.indonesia_basis
              ? 'Angka pada baris ini dipotong dari basis yang diumumkan \u2014 ' + g.indonesia_basis + '.'
              : 'Grup ini tidak mengumumkan basis Indonesia untuk memotong angka, jadi sel nilainya tanda pisah.')
          + ' Pekerja adalah daftar gaji di Indonesia: mitra pengemudi, kurir, merchant, dan penjual '
          + 'tidak pernah dihitung, dan daftar gaji yang sebagian besar garda depan diberi tanda.'
        : (g.group ? g.group + (g.listing ? ' (' + g.listing + ')' : '') + ' is the parent'
              + (gv ? ', worth ' + gv : '') + '. ' : '')
          + 'A group market capitalisation, and capital a foreign parent raised for a whole region, are not '
          + 'Indonesian figures, so neither is reprinted in those columns here. '
          + (g.indonesia_basis
              ? 'The figure on this row is carved from a disclosed basis \u2014 ' + g.indonesia_basis + '.'
              : 'This group discloses no Indonesian basis to carve a figure from, so the value cells are dashes.')
          + ' Jobs are the Indonesian payroll: driver-, courier-, merchant- and seller-partners are never '
          + 'counted, and a mostly-frontline payroll is marked.',
      m: g.domicile || '',
      lc: 1,
      l: [{ h: PF + '/coverage#method', t: L('How the numbers are made \u2192', 'Cara angka-angka ini dibuat \u2192') }],
    });
  };

  /* A valuation cell can be empty for two different reasons — nobody has ever
     priced the company, or a price exists but is not an Indonesian one. The
     second deserves the explanation, or taking J&T's US$12.5B off the table
     reads as data loss. */
  const valCell = (c) => {
    if (hasVal(c)) return money(c.valuation_usd_m)
      + (c.valuation_est ? estMark(c) : '') + (c.valuation_parent_id ? heldMark(c) : '');
    if (!c.valuation_note) return '\u2014';
    return mark('nofig', '\u2014', L('no Indonesian figure, show why', 'tidak ada angka Indonesia, lihat alasannya'), {
      k: 'nofig',
      t: c.id_only ? L('The group is priced. Indonesia is not.', 'Grupnya punya harga. Indonesia tidak.')
        : L('No figure on record', 'Tidak ada angka tercatat'),
      b: c.valuation_note,
      m: (c.global_parent || {}).listing || '',
      lc: 1,
    });
  };

  const trkMark = (c) => mark('estt trk', 'trk',
    L('a data provider\u2019s aggregate', 'agregat penyedia data'), {
      k: 'trk',
      t: L('Tracker aggregate, not an announcement', 'Agregat penyedia data, bukan pengumuman'),
      b: lang === 'id'
        ? 'Tidak ada pengumuman putaran yang memuat total ini \u2014 ini agregat penyedia data ('
          + srcHost(c.funding_src) + '). Agregator menjumlahkan putaran yang mereka yakini terjadi, mencampur '
          + 'utang dengan ekuitas, dan memuat total level grup; angkanya dipertahankan karena inilah angka publik '
          + 'terbaik, dan ditandai agar tidak meminjam otoritas sebuah pengumuman.'
        : 'No round announcement carries this total \u2014 it is a data provider\u2019s aggregate ('
          + srcHost(c.funding_src) + '). Aggregators sum rounds they believe happened, mix debt with equity, '
          + 'and carry group-level totals; the figure is kept because it is the best public number, and marked '
          + 'so it does not borrow an announcement\u2019s authority.',
      l: [{ h: c.funding_src, t: L('Open ', 'Buka ') + srcHost(c.funding_src) + ' \u2197' }],
    });
  const fundTitle = (c) => [
    [c.last_round, c.last_round_year].filter(Boolean).join(' \u00b7 '),
    c.funding_note || '',
    c.funding_src ? L('Source: ', 'Sumber: ') + srcHost(c.funding_src) : '',
  ].filter(Boolean).join('\n');
  /* Luca, Aug 30: "more than 100+ company we havent put the funding details ... make a
     closest data/info available with flag if needed". A dash used to be one symbol doing
     four jobs \u2014 never raised, raised but never sized, raised by a foreign parent, or
     nobody had looked yet \u2014 and a reader could not tell which. funding_status now says
     which, and it cuts the other way too: a figure that is only the floor of what a
     company raised should not print like a total. */
  const FSTAT = {
    partial: {
      lab: 'min',
      t: L('At least this much \u2014 not a total', 'Setidaknya sebanyak ini \u2014 bukan total'),
      b: L('At least one other round was announced without an amount, so this figure is the floor of what the company has raised, not the whole of it.',
        'Setidaknya satu putaran lain diumumkan tanpa nominal, jadi angka ini adalah batas bawah dari yang dihimpun perusahaan, bukan keseluruhannya.'),
    },
    listed: {
      lab: 'ipo',
      t: L('Raised on a public market', 'Dihimpun di pasar modal'),
      b: L('This is money raised from public investors in a listing or a rights issue, not a private venture round.',
        'Ini dana yang dihimpun dari investor publik lewat pencatatan saham atau rights issue, bukan putaran ventura privat.'),
    },
    debt_only: {
      lab: 'debt',
      t: L('Debt, not equity', 'Utang, bukan ekuitas'),
      b: L('The only capital with a public figure is borrowed, not invested for shares.',
        'Satu-satunya modal dengan angka publik adalah pinjaman, bukan investasi atas saham.'),
    },
    grant_only: {
      lab: 'grant',
      t: L('Grants, not equity', 'Hibah, bukan ekuitas'),
      b: L('The only capital with a public figure is non-dilutive \u2014 grants or prize money, not an investment for shares.',
        'Satu-satunya modal dengan angka publik bersifat non-dilutif \u2014 hibah atau hadiah, bukan investasi atas saham.'),
    },
  };
  /* kickers for the four kinds of nothing, so "\u2014" stops being a shrug */
  const FDASH = {
    undisclosed: L('The round happened. The amount never did.', 'Putarannya terjadi. Nominalnya tidak pernah diumumkan.'),
    none_on_record: L('No round on record', 'Tidak ada putaran tercatat'),
    parent_funded: L('Raised by the group, not in Indonesia', 'Dihimpun oleh grup, bukan di Indonesia'),
    listed: L('Raised on a public market', 'Dihimpun di pasar modal'),
    debt_only: L('Debt, not equity', 'Utang, bukan ekuitas'),
    grant_only: L('Grants, not equity', 'Hibah, bukan ekuitas'),
  };
  const kindMark = (c) => {
    const k = FSTAT[c.funding_status];
    if (!k) return '';
    return mark('estt kind', k.lab, k.lab + ' \u2014 ' + k.t, {
      k: k.lab,
      t: k.t,
      b: c.funding_floor_note ? k.b + ' ' + c.funding_floor_note[0].toUpperCase() + c.funding_floor_note.slice(1) + '.' : (c.funding_note || k.b),
      m: [c.last_round, c.last_round_year].filter(Boolean).join(' \u00b7 '),
      lc: 1,
    });
  };
  const fundCell = (c) => {
    if (!hasFunding(c)) return c.funding_note
      ? mark('nofig', '\u2014', c.id_only || c.funding_status === 'parent_funded'
        ? L('raised by the group, show what is known', 'dihimpun grup, lihat apa yang diketahui')
        : L('no amount disclosed, show what is known', 'nominal tidak diumumkan, lihat apa yang diketahui'), {
        k: 'nofig',
        t: (c.id_only ? FDASH.parent_funded : FDASH[c.funding_status]) || FDASH.undisclosed,
        b: c.funding_note,
        /* "no round on record" is a claim with a shelf life. It carries the day the
           search behind it was run, the same way a headcount carries the day it was
           read \u2014 a negative that was true in 2026 is not evidence about 2028. */
        m: [[c.last_round, c.last_round_year].filter(Boolean).join(' \u00b7 '),
          c.funding_asof ? L('checked ', 'diperiksa ') + c.funding_asof : ''].filter(Boolean).join(' \u00b7 '),
        lc: 1,
      })
      : '\u2014';
    const n = money(c.funding_total_usd_m);
    const marks = (c.funding_src_tier === 'tracker' ? trkMark(c) : '') + kindMark(c);
    if (!c.funding_src) return n + marks;
    return `<a class="fs" href="${esc(c.funding_src)}" target="_blank" rel="noopener" title="${esc(fundTitle(c))}">${n}</a>` + marks;
  };
  /* Luca, Aug 29: a Nov-2024 headcount on a 2026 census row is "fatal". So the jobs
     figure carries the same burden of proof as the funding one — where it was read
     and on what day — through the same mark panel. */
  /* Luca, Aug 31 (second pass, an hour after the metro scoping): "we give them
     all jobs data, but with caveat/split … the job count in office and the
     frontliner … i dont want - unknown job". The jobs column counts the whole
     Indonesian payroll; a row whose payroll is mostly frontline — couriers,
     store crews, coaches, field officers — carries a visible mark, and where
     the company publishes the split the office/frontline breakdown prints. */
  const frontMark = (c) => c.workforce_kind !== 'frontline' ? ''
    : mark('estt idb', 'frontline',
      L('A frontline workforce — what this payroll is made of', 'Tenaga kerja garda depan — terdiri dari apa angka ini'), {
        k: 'idb',
        t: c.workforce_split
          ? L('Jobs — the office/frontline split is published', 'Pekerja — rincian kantor/garda depan dipublikasikan')
          : L('Jobs — a mostly-frontline payroll', 'Pekerja — daftar gaji yang sebagian besar garda depan'),
        b: (c.workforce_split
          ? fmt(c.workforce_split.office) + L(' office · ', ' kantor · ') + fmt(c.workforce_split.frontline) + L(' frontline. ', ' garda depan. ')
          : '') + (c.workforce_note || ''),
        m: L('Salaried staff — mitra are never counted', 'Karyawan bergaji — mitra tidak pernah dihitung'),
        lc: 1,
        l: [c.workforce_split && c.workforce_split.src
          ? { h: c.workforce_split.src, t: L('Open ', 'Buka ') + srcHost(c.workforce_split.src) + ' ↗' } : null,
          { h: PF + '/coverage#method', t: L('How the numbers are made →', 'Cara angka-angka ini dibuat →') }].filter(Boolean),
      });
  const jobsCell = (c) => {
    const n = fmt(c.employees_est);
    /* a dashed jobs cell exists only where no headcount could be sourced at
       all — never as a policy: every payroll figure the census holds prints */
    if (c.employees_est === null || c.employees_est === undefined) {
      if (!c.employees_note) return n;
      return mark('nofig', '—',
        L('no headcount we could source', 'tidak ada jumlah pekerja yang bisa dirujuk'), {
        k: 'nofig',
        t: L('No figure on record', 'Tidak ada angka tercatat'),
        b: c.employees_note,
        m: '',
        lc: 1,
      });
    }
    if (!c.employees_note && !c.employees_asof) return n + frontMark(c);
    return mark('hc', n, L('headcount, show its source and date', 'jumlah pekerja, lihat sumber dan tanggalnya'), {
      k: c.employees_kind === 'company' ? 'hcco' : 'hc',
      t: c.employees_kind === 'company'
        ? L('Headcount \u2014 the company\u2019s own figure', 'Jumlah pekerja \u2014 angka dari perusahaannya sendiri')
        : (c.employees_asof ? L('Headcount read ', 'Jumlah pekerja dibaca ') + c.employees_asof
          : L('Headcount \u2014 date unknown', 'Jumlah pekerja \u2014 tanggal tidak diketahui')),
      b: (c.employees_note || L('No note on record for this figure.', 'Tidak ada catatan untuk angka ini.'))
        /* only where the row KEPT a non-LinkedIn figure does the cross-check add anything;
           on a row read off LinkedIn the note already carries the number */
        + (c.employees_spread
          ? (lang === 'id'
            ? ` Sumber kedua tidak sepakat: catatan perusahaan Exa menyebut ${esc(String(c.employees_exa_range || c.employees_exa))}. `
              + 'Baca baris ini sebagai rentang, bukan titik \u2014 pada satu-satunya perusahaan yang angka aslinya kami '
              + 'pegang, Kata.ai, hitungan LinkedIn 47% terlalu tinggi dan catatan Exa lebih dekat.'
            : ` A second source disagrees: Exa\u2019s company record puts it at ${esc(String(c.employees_exa_range || c.employees_exa))}. `
              + 'Read this row as a band, not a point \u2014 on the one company where we have the real number, '
              + 'Kata.ai, the LinkedIn count was 47% high and Exa\u2019s record was the closer of the two.') : '')
        + (!c.employees_src && c.employees_li && c.employees_li !== c.employees_est
          ? (lang === 'id'
            ? ` Halaman LinkedIn sendiri mencantumkan ${fmt(c.employees_li)} pada ${c.employees_li_asof || 'penyisiran yang sama'}; `
              + 'keduanya mengukur hal yang berbeda, jadi baris ini mempertahankan angka di atas.'
            : ` LinkedIn\u2019s own page listed ${fmt(c.employees_li)} on ${c.employees_li_asof || 'the same sweep'}; `
              + 'the two measure different things, so the row keeps the figure above.') : ''),
      m: c.employees_kind === 'company'
        ? L('Reported by the company', 'Dilaporkan oleh perusahaannya') + (c.employees_asof ? ' \u00b7 ' + c.employees_asof : '')
        : (c.employees_src ? srcHost(c.employees_src) : ''),
      lc: 1,
      l: [c.employees_src
        ? { h: c.employees_src,
            /* on a company-reported row the LinkedIn page is the thing being contradicted,
               so name what it says rather than offering it as the source */
            t: c.employees_kind === 'company' && c.employees_li
              ? `${L('LinkedIn lists', 'LinkedIn mencantumkan')} ${fmt(c.employees_li)} \u2197`
              : L('Open ', 'Buka ') + srcHost(c.employees_src) + ' \u2197' }
        : null].filter(Boolean),
    }) + frontMark(c);
  };
  /* Luca, Aug 29: "i think we need to elaborate what is output". The cell used to
     be a bare number with a column header that named a unit and nothing else, so
     the two obvious readings — revenue, or the wage bill — were both wrong. Now
     the number is the affordance: it opens the row's own arithmetic, the
     definition, and on the rows where the anchor is known to run high, that. */
  const metroName = (id) => { const x = (data && data.by_metro || []).find((y) => y.id === id); return x ? (lang === 'id' ? x.name_id || x.name : x.name) : ''; };
  const outCell = (c) => {
    const n = fmt(c.est_gva_idr_bn);
    const d = GVA.markNote(c, m, lang, metroName(c.metro));
    if (!d) return n;
    /* nationwide rows outside the anchored metros: a dash that says why */
    if (c.output_withheld) return mark('nofig', '—',
      L('output not estimated for this city yet, show why', 'output belum diestimasi untuk kota ini, lihat alasannya'), d);
    return mark('gv' + (c.output_caveat ? ' hi' : ''), n,
      L('output, show the working', 'output, lihat perhitungannya'), d);
  };
  /* ── the landing below the table (Luca's Aug 31 revamp): the map, the
     disciplines, the ecosystem, and a full-site footer. The method prose that
     used to sit here (#output, #method) moved INTACT to /coverage#output and
     /coverage#method — same call as the registry move: reference material is
     not a front page. Copy below carries no figure that would need a source;
     every claim is a rule the site demonstrably enforces. */
  const IC = {
    live: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M2 15h5.2l2.6-8 4.4 12 2.6-7H24"/></svg>',
    src: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M5 3h10l6 6v14H5z"/><path d="M15 3v6h6"/><path d="M9 14h8M9 18h8"/></svg>',
    est: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M20 6V4H6l8 9-8 9h14v-2"/></svg>',
    idn: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M13 23s-8-8.4-8-13a8 8 0 0 1 16 0c0 4.6-8 13-8 13z"/><circle cx="13" cy="10" r="3"/></svg>',
    hc: '<svg viewBox="0 0 26 26" aria-hidden="true"><rect x="3" y="5" width="20" height="18"/><path d="M3 10h20M8 3v4M18 3v4"/><path d="M8.5 16.5l3 3 6-6"/></svg>',
    lang: '<svg viewBox="0 0 26 26" aria-hidden="true"><rect x="2" y="4" width="13" height="10"/><rect x="11" y="12" width="13" height="10" style="fill:#fff"/><path d="M5.5 9h6M14.5 17h6"/></svg>',
  };
  const FEATURES = [
    { ic: IC.live, href: PF + '/closed', go: '/closed',
      t: L('Liveness-screened', 'Dicek masih beroperasi'),
      d: L('Every company is re-checked against its own site and record. A live site is not a live company — what stopped moves to the closed register.',
        'Setiap perusahaan dicek ulang lewat situs dan rekam jejaknya. Situs yang masih tayang bukan berarti perusahaannya masih hidup — yang sudah berhenti dipindahkan ke daftar tutup.') },
    { ic: IC.src, href: PF + '/coverage#funding', go: '/coverage',
      t: L('Sourced or withdrawn', 'Ada sumber, atau ditarik'),
      d: L('Every figure links to the document that carries it. Where no credible source exists, the cell holds a dash that explains itself — numbers are never invented.',
        'Setiap angka tertaut ke dokumen sumbernya. Kalau tidak ada sumber yang kredibel, selnya diisi tanda pisah yang menjelaskan alasannya sendiri — kami tidak pernah mengarang angka.') },
    { ic: IC.est, href: PF + '/model', go: '/model',
      t: L('Estimates labeled', 'Estimasi selalu berlabel'),
      d: L('Output is modeled from BPS sector anchors and marked est wherever it is derived — and the formal model behind it, equations to error bounds, is published.',
        'Output dimodelkan dari anchor sektor BPS dan diberi tanda est di mana pun ia hasil turunan — dan model formal di baliknya, dari persamaan sampai batas galat, terbuka untuk dibaca.') },
    { ic: IC.idn, href: PF + '/coverage#scope', go: '/coverage#scope',
      t: L('Indonesia-only accounting', 'Dihitung khusus Indonesia'),
      d: L('A global group is counted at its Indonesian size: group valuations are never reprinted, a mostly-frontline payroll is marked and split where the company discloses it, and driver-, courier- and seller-partners are mitra, not employees.',
        'Grup global dihitung sebesar operasi Indonesianya saja: valuasi grup tidak ikut dicetak, daftar gaji yang sebagian besar garda depan diberi tanda dan dirinci bila perusahaannya mengumumkan, dan mitra pengemudi, kurir, maupun penjual tetap mitra — bukan karyawan.') },
    { ic: IC.hc, href: PF + '/coverage#method', go: '/coverage#method',
      t: L('Dated headcounts', 'Data pekerja bertanggal'),
      d: L('A jobs figure carries the day it was read and the page it came from, and a figure the company gave directly outranks every tracker.',
        'Setiap angka pekerja mencantumkan tanggal pembacaan dan halaman sumbernya — dan angka yang diberikan langsung oleh perusahaan selalu menang atas tracker mana pun.') },
    { ic: IC.lang, href: lang === 'id' ? '/' : '/id/', go: lang === 'id' ? '/' : '/id/',
      t: L('English + Bahasa Indonesia', 'Dua bahasa: Indonesia + Inggris'),
      d: L('The whole census is server-rendered in both languages — this page in English, the same census in Bahasa Indonesia at /id.',
        'Seluruh sensus tersedia dalam dua bahasa — halaman ini dalam bahasa Indonesia, dan versi Inggrisnya selalu satu klik lewat tombol EN di menu atas.') },
  ];
  const ECO = [
    { href: PF + '/research', rt: '/research', t: L('Research', 'Riset'),
      d: L('Analysis of Indonesia’s startup economy, with downloadable data and explicit assumptions.',
        'Analisis ekonomi startup Indonesia, dengan data yang dapat diunduh dan asumsi yang dijelaskan.') },
    { href: PF + '/news', rt: '/news', t: L('News', 'Berita'),
      d: L('The wire over the census — dated briefs on funding, headcount moves and closures, each with its sources.',
        'Kabar terbaru dari ekosistem — ringkasan bertanggal soal pendanaan, pergerakan pekerja, dan penutupan, lengkap dengan sumbernya.') },
    { href: PF + '/chain', rt: '/chain', t: L('Supply chain', 'Rantai pasok'),
      d: L('Who serves whom — every edge proved by a regulatory filing or a first-party document before it renders.',
        'Siapa memasok siapa — setiap hubungan dibuktikan dengan dokumen regulator atau dokumen pihak pertama sebelum ditampilkan.') },
    { href: PF + '/investors', rt: '/investors', t: L('Investors', 'Investor'),
      d: L('Every fund with the census rows it backs, and what those companies raised in total.',
        'Setiap fund berikut perusahaan sensus yang didukungnya, dan total dana yang dihimpun portofolionya.') },
    { href: PF + '/closed', rt: '/closed', t: L('Closed register', 'Daftar yang tutup'),
      d: L('A census is only as good as its deletions — what closed, went bankrupt or was wound up, with dates, causes and sources.',
        'Sensus hanya sebaik data yang berani dihapusnya — siapa yang tutup, pailit, atau dilikuidasi, lengkap dengan tanggal, sebab, dan sumber.') },
    { href: PF + '/coverage', rt: '/coverage', t: L('Coverage', 'Cakupan'),
      d: L('What is counted, what is held out, and why — every deliberate exclusion published with its reason.',
        'Apa yang dihitung, apa yang dikeluarkan, dan alasannya — setiap pengecualian yang disengaja dipublikasikan beserta sebabnya.') },
    { href: PF + '/model', rt: '/model', t: L('The formal model', 'Model formal'),
      d: L('The output estimator written out — equations, live-computed charts and the error bounds on every total.',
        'Estimator output ditulis lengkap — persamaan, grafik yang dihitung langsung, dan batas galat pada setiap total.') },
    { href: PF + '/leads', rt: '/leads', t: L('Lead search', 'Cari kontak'),
      d: L('The right person at each census company, found by research agents — published evidence only, nothing invented.',
        'Orang yang tepat di tiap perusahaan sensus, ditemukan agen riset — hanya bukti terpublikasi, tanpa karangan.') },
    { href: PF + '/stats', rt: '/stats', t: L('Live traffic', 'Statistik pengunjung'),
      d: L('The site’s own numbers, public — page views, visitors and what readers have open right now.',
        'Angka situs ini sendiri, dibuka ke publik — tayangan halaman, jumlah pengunjung, dan apa yang sedang dibaca orang saat ini.') },
  ];
  const featTiles = FEATURES.map((f) => `<a href="${esc(f.href)}">
      <span class="fic">${f.ic}</span><h3>${f.t}</h3><p>${f.d}</p>
      <span class="go">${esc(f.go)} →</span></a>`).join('');
  const ecoCards = ECO.map((x) => `<a href="${esc(x.href)}">
      <span class="rt">${esc(x.rt)}</span><h3>${x.t}</h3><p>${x.d}</p></a>`).join('');
  const hcDated = companies.filter((c) => c.employees_asof).length;
  const hcCo = companies.filter((c) => c.employees_kind === 'company').length;
  const hcSpread = companies.filter((c) => c.employees_spread).length;
  const hcRead = [...new Set(companies.map((c) => c.employees_asof).filter(Boolean))].sort().pop() || '';
  const trackerCount = companies.filter((c) => c.funding_src_tier === 'tracker').length;
  const withheldCount = companies.filter((c) => !hasFunding(c) && c.funding_note).length;
  /* the three kinds of dash, derived so they always sum to withheldCount — a footnote that
     says "A, B or C" and then does not add up is worse than no footnote */
  const dashed = companies.filter((c) => !hasFunding(c) && c.funding_note);
  const parentCount = dashed.filter((c) => c.funding_status === 'parent_funded' || c.id_only).length;
  const noneCount = dashed.filter((c) => c.funding_status === 'none_on_record').length;
  const undiscCount = dashed.filter((c) => c.funding_status === 'undisclosed').length;
  /* an IPO, a grant or a loan — capital this column does not hold, so the row keeps a dash
     and carries the figure in its note instead */
  const otherCount = withheldCount - parentCount - noneCount - undiscCount;
  const floorCount = companies.filter((c) => c.funding_status === 'partial').length;
  const estCount = companies.filter((c) => c.valuation_est).length;
  const hasVal = (c) => c.valuation_usd_m !== null && c.valuation_usd_m !== undefined;
  const valCount = companies.filter(hasVal).length;
  const sectors = [...new Set(companies.map((c) => c.sector_label).filter(Boolean))].sort();

  const rows = companies.map((c) => `
    <tr data-f="${esc([c.name, c.sector_label, c.kota, c.yc_batch ? 'yc ' + c.yc_batch + ' y combinator' : '',
      c.endeavor ? 'endeavor ' + (c.endeavor_entrepreneurs || []).join(' ') : '',
      c.antler ? 'antler' : '', c.url || '',
      c.id_only ? 'indonesia only global parent ' + ((c.global_parent || {}).group || '') : '',
      c.group_parent ? 'group ' + (c.group_parent.group || '') : '']
      .filter(Boolean).join(' ').toLowerCase())}" data-s="${esc(c.sector_label || '')}" data-yc="${c.yc_batch ? '1' : ''}" data-ed="${c.endeavor ? '1' : ''}" data-an="${c.antler ? '1' : ''}" data-fu="${hasFunding(c) ? '1' : ''}" data-va="${hasVal(c) ? '1' : ''}" data-gr="${c.group_parent ? '1' : ''}" data-id="${esc(c.id)}">
      <td class="rk" data-v="${c.rank}">${c.rank}</td>
      <td data-v="${esc((c.name || '').toLowerCase())}">${c.logo ? `<img class="lg" src="${esc(c.logo)}" alt="" loading="lazy" width="18" height="18">` : ''}<a class="cp-link" href="${PF}/company/${esc(c.id)}">${esc(c.name)}</a>${c.yc_batch ? `<a class="ycb" href="${PF}/coverage#yc" title="Y Combinator ${esc(c.yc_batch)}">YC ${esc(c.yc_batch)}</a>` : ''}${c.id_only ? idOnlyMark(c) : ''}${c.group_parent ? grpMark(c) : ''}${c.endeavor ? `<a class="edb" href="${PF}/coverage#endeavor" title="${esc(c.endeavor_note || ((c.endeavor_entrepreneurs || []).join(', ') + ' — Endeavor Entrepreneur' + ((c.endeavor_entrepreneurs || []).length > 1 ? 's' : '')) || 'Endeavor Entrepreneur company')}">ENDEAVOR</a>` : ''}${c.antler ? `<a class="anb" href="${PF}/coverage#antler" title="${esc(c.antler_note || L('Antler-funded', 'Didanai Antler'))}">ANTLER</a>` : ''}</td>
      <td class="mu" data-v="${esc((c.sector_label || '').toLowerCase())}">${esc(c.sector_label || '')}</td>
      <td class="mu" data-v="${esc((c.kota || '').toLowerCase())}">${esc(c.kota || '—')}</td>
      <td class="n" data-v="${sv(c.funding_total_usd_m)}">${fundCell(c)}</td>
      <td class="n" data-v="${sv(c.valuation_usd_m)}">${valCell(c)}</td>
      <td class="n" data-v="${sv(c.employees_est)}">${jobsCell(c)}</td>
      <td class="n" data-v="${sv(c.est_gva_idr_bn)}">${outCell(c)}</td>
    </tr>`).join('');

  const body = companies.length ? `
  <section class="stats" id="stats">
    ${[
      [fmt(T.companies), L('companies tracked', 'perusahaan terdata')],
      [lang === 'id' ? 'US$ ' + (T.funding_usd_b || 0).toFixed(1) + ' miliar' : usdB(T.funding_usd_b * 1000).replace('US$', 'US$ ').replace('B', ' B'), L('disclosed funding', 'pendanaan diumumkan'), fmt(fundedCount) + L(' of ', ' dari ') + fmt(T.companies) + L(' rows', ' baris')],
      /* coverage belongs ON the tile: a valuation total sitting beside "284
         companies tracked" would otherwise read as if all 284 were valued */
      [lang === 'id' ? 'US$ ' + ((VAL.combined_usd_m || 0) / 1000).toFixed(1) + ' miliar' : usdB(VAL.combined_usd_m).replace('US$', 'US$ ').replace('B', ' B'), L('combined valuation', 'valuasi gabungan'), fmt(T.valuation_marked) + L(' of ', ' dari ') + fmt(T.companies) + L(' marked', ' tercatat'), PF + '/coverage#valuation'],
      [fmt(T.jobs), L('jobs — estimate', 'lapangan kerja — estimasi')],
      ['IDR ' + fmt(T.gva_idr_t, 1) + ' T', L('output / yr — estimate', 'output / thn — estimasi'), L('what this means', 'apa artinya'), PF + '/coverage#output'],
    ].map(([v, k, q, href]) => `<div class="cell"><div class="v">${v}</div><div class="k">${k}${q ? `<span class="q">${href ? `<a href="${href}">${q} →</a>` : q}</span>` : ''}</div></div>`).join('')}
  </section>

  <section class="wrap" id="companies">
    <div class="eyebrow"><span class="sq"></span>${L('THE COMPANIES', 'DAFTAR PERUSAHAAN')}</div>
    <div class="toolbar">
      <input id="q" type="search" placeholder="${L(`Search ${companies.length} companies — name, sector, city…`, `Cari ${companies.length} perusahaan — nama, sektor, kota…`)}" autocomplete="off">
      <div class="chips" id="chips">
        <button class="chip on" data-s="">${L('All', 'Semua')}</button>
        ${sectors.map((s) => `<button class="chip" data-s="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
      <div class="chiprow">
        <button class="chip yconly" id="ycOnly" aria-pressed="false">${L('Y Combinator only', 'Y Combinator saja')} · ${YC.in_census || 0}</button>
        ${ED.in_census ? `<button class="chip edonly" id="edOnly" aria-pressed="false">${L('Endeavor only', 'Endeavor saja')} · ${ED.in_census}</button>` : ''}
        ${AN.in_census ? `<button class="chip anonly" id="anOnly" aria-pressed="false">${L('Antler only', 'Antler saja')} · ${AN.in_census}</button>` : ''}
        <button class="chip fuonly" id="fundedOnly" aria-pressed="false">${L('Disclosed funding only', 'Pendanaan diumumkan saja')} · ${fmt(fundedCount)}</button>
        <button class="chip vaonly" id="valOnly" aria-pressed="false">${L('Valuation on record', 'Ada valuasi tercatat')} · ${fmt(valCount)}</button>
        ${nGroup ? `<button class="chip grhide" id="grHide" aria-pressed="false">${L('Hide group companies', 'Sembunyikan perusahaan grup')} · ${fmt(nGroup)}</button>` : ''}
        <div class="count mono" id="count">${companies.length} ${L('shown', 'ditampilkan')}</div>
      </div>
      <div class="rowhint mono">${L('Click any company for its full profile — funding, investors, head office, headcount and every source behind the row.', 'Klik perusahaan mana pun untuk membuka profil lengkapnya — pendanaan, investor, kantor pusat, jumlah pekerja, dan semua sumber di balik datanya.')}</div>
    </div>
    <div class="tablewrap"><table id="tbl">
      <thead><tr>${[
        ['#', 'num', 'rk'], [L('Company', 'Perusahaan'), 'txt', ''], [L('Sector', 'Sektor'), 'txt', 'mu'], [L('City', 'Kota'), 'txt', 'mu'],
        [L('Funding US$M', 'Pendanaan (US$ juta)'), 'num', 'n'], [L('Valuation US$M', 'Valuasi (US$ juta)'), 'num', 'n'],
        [L('Jobs est', 'Pekerja (est.)'), 'num', 'n'], [L('Output est IDR bn/yr', 'Output (est.) IDR miliar/thn'), 'num', 'n'],
      ].map(([label, kind, cls], i) => `<th class="s${cls ? ' ' + cls : ''}" data-i="${i}" data-t="${kind}"${i === 0 ? ' aria-sort="ascending"' : ''}><button type="button">${label}<span class="ca" aria-hidden="true"></span></button></th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <nav class="pager mono" id="pager" aria-label="${L('Company table pages', 'Halaman tabel perusahaan')}" hidden></nav>
    <ul class="foot-key">
      <li><span class="fk">${L('Ranking', 'Peringkat')}</span><span class="fv">${L('By latest known valuation, then disclosed funding, then jobs.', 'Menurut valuasi terakhir yang diketahui, lalu pendanaan terungkap, lalu jumlah pekerja.')}</span></li>
      <li><span class="fk">${L('No figure', 'Tanpa angka')}</span><span class="fv">${L('"—" means no credible public figure — we do not invent numbers.', '"—" berarti tidak ada angka publik yang kredibel — kami tidak mengarang angka.')}${withheldCount ? L(` Every one of the ${fmt(withheldCount)} dashed funding rows says which kind of nothing it is — the round happened but was never sized (${fmt(undiscCount)}), no outside round exists at all (${fmt(noneCount)}), the capital was raised by a parent abroad (${fmt(parentCount)})${otherCount ? `, or the money came as an IPO, a grant or a loan rather than an equity round (${fmt(otherCount)})` : ''}. Hover or tap any of them for the evidence behind that answer.`, ` Setiap dari ${fmt(withheldCount)} baris pendanaan bertanda — menjelaskan jenis ketiadaannya: putarannya terjadi tetapi nominalnya tak pernah diumumkan (${fmt(undiscCount)}), tidak ada putaran eksternal sama sekali (${fmt(noneCount)}), modalnya dihimpun induk di luar negeri (${fmt(parentCount)})${otherCount ? `, atau dananya berupa IPO, hibah, atau pinjaman alih-alih putaran ekuitas (${fmt(otherCount)})` : ''}. Arahkan kursor atau ketuk untuk buktinya.`) : ''}${floorCount ? L(` A figure marked <span class="estt kind">min</span> on ${fmt(floorCount)} row${floorCount > 1 ? 's' : ''} is a floor, not a total: at least one other round was announced without an amount, so the company raised that much and an unknown amount more.`, ` Angka bertanda <span class="estt kind">min</span> pada ${fmt(floorCount)} baris adalah batas bawah, bukan total: setidaknya satu putaran lain diumumkan tanpa nominal, jadi perusahaan menghimpun sebanyak itu ditambah jumlah yang tidak diketahui.`) : ''}</span></li>
      <li><span class="fk">${L('Funding', 'Pendanaan')}</span><span class="fv">${L(`${fmt(fundedCount)} of ${fmt(companies.length)} companies have a figure we could source, and every one links to the source that carries it — a round announcement, or the investor’s or company’s own release.`, `${fmt(fundedCount)} dari ${fmt(companies.length)} perusahaan punya angka yang bisa kami rujuk sumbernya, dan setiap angka tertaut ke sumber yang memuatnya — pengumuman putaran, atau rilis resmi investor maupun perusahaannya.`)}${trackerCount ? L(` ${fmt(trackerCount)} link${trackerCount > 1 ? 's go' : ' goes'} to a data provider instead and ${trackerCount > 1 ? 'are' : 'is'} marked <span class="estt">trk</span>: no announcement corroborates the total.`, ` ${fmt(trackerCount)} tautan mengarah ke penyedia data dan ditandai <span class="estt">trk</span>: tidak ada pengumuman yang menguatkan totalnya.`) : ''}</span></li>
      ${estCount ? `<li><span class="fk">${L('Valuation', 'Valuasi')}</span><span class="fv">${L(`${fmt(estCount)} valuation${estCount > 1 ? "s are" : " is"} marked <span class="estt">est</span> — derived from the parent’s published financials, not disclosed; hover or tap it for the working. Where a counted parent’s market capitalisation already contains a row, that row is held out of the combined valuation and listed under <a href="${PF}/coverage#valuation">what the combined valuation contains</a>.`, `${fmt(estCount)} valuasi ditandai <span class="estt">est</span> — diturunkan dari laporan keuangan publik induknya, bukan diumumkan; arahkan kursor atau ketuk untuk perhitungannya. Jika kapitalisasi pasar induk yang ikut dihitung sudah memuat sebuah baris, baris itu dikeluarkan dari valuasi gabungan dan tercantum di <a href="${PF}/coverage#valuation">isi valuasi gabungan</a>.`)}</span></li>` : ""}
      ${hcDated ? `<li><span class="fk">${L('Jobs', 'Pekerja')}</span><span class="fv">${L(`LinkedIn people counts, re-read on ${esc(hcRead)} for ${fmt(hcDated)} of ${fmt(companies.length)} rows — click any jobs figure for its source and the day it was read.`, `Jumlah orang di halaman LinkedIn, dibaca ulang pada ${esc(hcRead)} untuk ${fmt(hcDated)} dari ${fmt(companies.length)} baris — klik angka pekerja mana pun untuk sumbernya dan tanggal pembacaannya.`)}</span></li>` : ''}
      ${(() => { const fc = companies.filter((c) => c.workforce_kind === 'frontline').length;
        const sp = companies.filter((c) => c.workforce_split).length;
        return fc ? `<li><span class="fk">${L('Frontline', 'Garda depan')}</span><span class="fv">${L(
          `Jobs count the whole Indonesian payroll — frontline included. ${fmt(fc)} rows carry a <span class="estt idb">frontline</span> mark: their payroll is mostly salaried couriers, store crews, coaches or field officers rather than office staff${sp ? `, and ${fmt(sp)} of them publish the office/frontline split the company itself disclosed` : ''}. Mitra partners are never counted, and the output model prices frontline payroll at the national frontline anchor rather than a Jakarta sector average — hover or tap any mark for what the number is made of.`,
          `Pekerja dihitung dari seluruh daftar gaji Indonesia — termasuk garda depan. ${fmt(fc)} baris membawa tanda <span class="estt idb">frontline</span>: gajinya sebagian besar kurir bergaji, kru gerai, pelatih, atau petugas lapangan, bukan pekerja kantor${sp ? `, dan ${fmt(sp)} di antaranya memuat rincian kantor/garda depan yang diumumkan perusahaannya sendiri` : ''}. Mitra tidak pernah dihitung, dan model output menghargai gaji garda depan pada anchor frontline nasional, bukan rata-rata sektor Jakarta — arahkan kursor atau ketuk tandanya untuk melihat isi angkanya.`)}</span></li>` : ''; })()}
      ${hcCo ? `<li><span class="fk">${L('Cross-check', 'Uji silang')}</span><span class="fv">${L(`${fmt(hcCo)} row${hcCo > 1 ? 's carry' : ' carries'} a figure the company gave us directly, which beats every tracker: where we can check one against the other, the LinkedIn count ran 47% high on Kata.ai (91 listed against 62 actual) and 56% low on J&T, whose couriers do not keep profiles. The counts are labelled, never scaled by a correction factor.`, `${fmt(hcCo)} baris memuat angka yang diberikan langsung oleh perusahaannya, yang mengalahkan semua tracker: saat keduanya bisa dibandingkan, hitungan LinkedIn 47% terlalu tinggi untuk Kata.ai (tercantum 91, aslinya 62) dan 56% terlalu rendah untuk J&T, yang kurirnya tidak punya profil. Angka diberi label, tidak pernah diskalakan dengan faktor koreksi.`)}</span></li>` : ''}
      ${LV.checked ? `<li><span class="fk">${L('Operating', 'Beroperasi')}</span><span class="fv">${L(`Every row's website and operating status was re-checked on ${esc(LV.checked)}.`, `Situs web dan status operasional setiap baris dicek ulang pada ${esc(LV.checked)}.`)}</span></li>` : ''}
      <li><span class="fk">Output</span><span class="fv">${L('An estimate of value added — what a company adds to GDP, which is neither its revenue nor its wage bill. Click any output figure for the multiplication behind it, or read <a href="${PF}/coverage#output">what the figure is</a>.', 'Estimasi nilai tambah — sumbangan perusahaan terhadap PDB, yang bukan pendapatannya dan bukan pula total gajinya. Klik angka output mana pun untuk perkalian di baliknya, atau baca <a href="${PF}/coverage#output">apa itu angka output</a>.')}</span></li>
      <li><span class="fk">${L('Coverage', 'Cakupan')}</span><span class="fv">${L('<a href="${PF}/coverage">What the census contains →</a> — the combined-valuation contents, sector totals, the Y Combinator and Endeavor cohorts, and every name considered against the inclusion rule and not counted.', '<a href="${PF}/coverage">Isi sensus →</a> — isi valuasi gabungan, total per sektor, kohor Y Combinator dan Endeavor, serta setiap nama yang diperiksa terhadap aturan cakupan dan tidak dihitung.')}</span></li>
    </ul>
  </section>


  <section class="wrap" id="map">
    <div class="eyebrow"><span class="sq"></span>${L('THE MAP', 'PETA')}</div>
    <h2 class="h2">${L('Every company, at its real address.', 'Setiap perusahaan, di alamat aslinya.')}</h2>
    <p class="lede">${L(`The whole census on one map of Indonesia: every company as its logo at its own address, from
    Medan to Bali. Zoom into a district to see who shares a tower, and open any company's card where it
    actually sits.`,
    `Seluruh sensus di satu peta Indonesia: setiap perusahaan tampil sebagai logo di alamatnya sendiri, dari Medan
    sampai Bali. Perbesar sebuah kawasan untuk melihat siapa saja yang berkantor di gedung yang sama, lalu buka
    kartu perusahaan mana pun tepat di tempatnya.`)}</p>
    <div class="cta">
      <a class="btn primary" href="${PF}/map">${L('Open the full map', 'Buka peta lengkap')}</a>
      <a class="btn" href="${PF}/map?city=jakarta">Jakarta</a>
      <a class="btn" href="${PF}/map?city=bandung">Bandung</a>
      <a class="btn" href="${PF}/map?city=bali">Bali</a>
    </div>
    <div class="mapembed">
      <iframe class="mapframe" src="${PF}/map?embed=1" title="${L('The census map', 'Peta sensus')}" loading="lazy"></iframe>
      <a class="mapshield" id="mapshield" href="${PF}/map"><span>${L('Click to explore the live map', 'Klik untuk menjelajahi petanya')}</span></a>
    </div>
  </section>

  <section class="wrap" id="features">
    <div class="eyebrow"><span class="sq"></span>${L('WHAT MAKES IT A CENSUS', 'APA YANG MENJADIKANNYA SENSUS')}</div>
    <div class="feat">${featTiles}</div>
  </section>

  <section class="wrap" id="ecosystem">
    <div class="eyebrow"><span class="sq"></span>${L('THE ECOSYSTEM', 'EKOSISTEM')}</div>
    <h2 class="h2">${L('Built on the census.', 'Dibangun di atas sensus.')}</h2>
    <p class="lede">${L('The company table is the spine. Everything below reads from it — same data, same rules, another angle.',
    'Tabel perusahaan adalah tulang punggungnya. Semua di bawah ini membacanya — data yang sama, aturan yang sama, sudut pandang lain.')}</p>
    <div class="eco">${ecoCards}</div>
  </section>` : `
  <section class="wrap"><div class="method"><p>${L('The census is being assembled. Nothing to show yet.', 'Sensus sedang disusun. Belum ada yang bisa ditampilkan.')}</p></div></section>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L("Indonesia's Startup Census — 1001startup.id", T.companies ? `Sensus Startup Indonesia: ${fmt(T.companies)} Perusahaan — 1001startup.id` : 'Sensus Startup Indonesia — 1001startup.id')}</title>
<meta name="description" content="${L('The census of Indonesian startups: who they are, where they sit, what they raised, whom they employ, and what they add to the economy.', `Sensus startup Indonesia: daftar ${fmt(T.companies)} perusahaan dengan data pendanaan, valuasi, jumlah pekerja, dan peta kantornya. Sumber publik saja, estimasi diberi label.`)}">
<meta name="robots" content="index, follow">
${I18N.headTags(lang, path)}
${I18N.ogImage()}${path === '/' ? SCHEMA.siteLd(lang, { companies: T.companies })
  : SCHEMA.datasetLd(lang, { companies: T.companies, path }) + SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('Startups', 'Startup'), path }])}
<meta property="og:title" content="${L("1001startup.id — Indonesia's startup graph", '1001startup.id — Sensus Startup Indonesia')}">
<meta property="og:description" content="${esc(String(T.companies || '') + L(' companies tracked — funding, jobs, and the economic weight of the ecosystem.', ' perusahaan terdata — data pendanaan, lapangan kerja, dan bobot ekonomi ekosistem startup Indonesia.'))}">
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
.hero{max-width:1180px;margin:0 auto;padding:64px 20px 54px;display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:start}
@media(max-width:880px){.hero{grid-template-columns:1fr;padding-top:40px}}
.hero h1{font-size:clamp(40px,5.6vw,72px);line-height:1.02;letter-spacing:-0.03em;font-weight:500}
.hero .sub{color:#52525B;font-size:16.5px;line-height:1.55;max-width:52ch}
.hero .cta{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap}
.hero .fact{color:#3F3F46;font-size:13.5px;line-height:1.55;max-width:60ch;margin-top:14px;padding-left:11px;border-left:2px solid #E7E7E7}
.btn{display:inline-block;padding:12px 18px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;border:1px solid #000;cursor:pointer;background:#fff;color:#000}
.btn.primary{background:#000;color:#fff}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
/* five cells is a prime number, so auto-fit leaves a dead grey tile on every
   width that is not 5 or 1 across. Explicit columns instead, and the fifth cell
   spans the remainder wherever the last row would otherwise be short. */
.stats{max-width:1140px;width:calc(100% - 40px);margin:0 auto;display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:1139px){.stats{grid-template-columns:repeat(3,1fr)}.stats .cell:nth-child(5){grid-column:span 2}}
@media(max-width:860px){.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:470px){.stats{grid-template-columns:1fr}.stats .cell:nth-child(5){grid-column:auto}}
.stats .cell{background:#fff;padding:22px 18px}
.stats .v{font-size:clamp(26px,3vw,40px);letter-spacing:-0.02em;background:${GRAD};-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:600}
.stats .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-top:6px}
.stats .k .q{display:block;color:#74747D;margin-top:4px}
.stats .k .q a{text-decoration:none;color:inherit;border-bottom:1px solid #E7E7E7}
.stats .k .q a:hover{color:#000;border-color:#000}
.wrap{max-width:1180px;margin:0 auto;padding:54px 20px 0}
.toolbar{display:flex;flex-direction:column;gap:12px;margin-bottom:14px}
#q{width:100%;max-width:560px;padding:13px 16px;border:1px solid #000;font:500 15px/1 'Overused Grotesk',sans-serif;outline:none}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chip{padding:7px 11px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}
.chip.on{background:#000;color:#fff;border-color:#000}
.count{font-size:11px;color:#6B6B73}
.rowhint{font-size:11px;color:#6B6B73;text-transform:none;letter-spacing:0;font-family:'Overused Grotesk',sans-serif}
.pager{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:12px}
.pager button{padding:7px 11px;border:1px solid #E7E7E7;background:#fff;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;color:#000}
.pager button:hover:not(:disabled){border-color:#000}
.pager button[aria-current="page"]{background:#000;color:#fff;border-color:#000}
.pager button:disabled{color:#C7C7CC;cursor:default}
.pager .gap{color:#74747D;font-size:11px;padding:0 2px}
.pager .range{margin-left:auto;font-size:11px;color:#6B6B73}
.tablewrap{overflow-x:auto;border:1px solid #E7E7E7}
table{border-collapse:collapse;width:100%;min-width:920px;font-size:13.5px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
/* sortable headers: the <th> keeps its own padding, the button inside is the
   hit target so keyboard focus and Enter/Space come for free */
th.s{padding:0}
th.s>button{width:100%;padding:10px 12px;border:0;background:none;font:inherit;color:inherit;text-transform:inherit;letter-spacing:inherit;text-align:inherit;cursor:pointer}
th.s.n>button{text-align:right}
th.s>button>.ca{margin-left:6px;color:#D8D8DC}
th.s>button>.ca::before{content:'↕'}
th.s:hover>button>.ca{color:#6B6B73}
th.s[aria-sort]>button{color:#000}
th.s[aria-sort="ascending"]>button>.ca{color:#000}
th.s[aria-sort="ascending"]>button>.ca::before{content:'↑'}
th.s[aria-sort="descending"]>button>.ca{color:#000}
th.s[aria-sort="descending"]>button>.ca::before{content:'↓'}
th.s>button:focus-visible{outline:2px solid #000;outline-offset:-2px}
td{padding:9px 12px;border-bottom:1px solid #F1F1F1;vertical-align:top}
td.n,th.n{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap}
td.rk{font-family:'IBM Plex Mono',monospace;color:#6B6B73;font-size:12px}
td.mu{color:#52525B;font-size:12.5px}
td a{text-decoration:none;border-bottom:1px solid #D9D9D9}
td .lg{vertical-align:-4px;margin-right:8px}
.foot-note{font-size:11px;color:#6B6B73;margin-top:10px}
.foot-key{list-style:none;margin:14px 0 0;padding:0;border-top:1px solid #E7E7E7}
.foot-key li{display:grid;grid-template-columns:88px 1fr;gap:0 16px;padding:8px 0;border-bottom:1px solid #F1F1F1}
.foot-key .fk{font:400 10px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#74747D;padding-top:1px}
.foot-key .fv{font-size:11.5px;line-height:1.5;color:#6B6B73}
.foot-key .fv a{color:inherit;text-decoration:none;border-bottom:1px solid #C7C7CC}
.foot-key .fv a:hover{color:#000;border-bottom-color:#000}
.chiprow{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.chip.yconly{border-color:#000;background:#fff;color:#000}
.chip.yconly[aria-pressed="true"]{background:#E8734B;border-color:#E8734B;color:#fff}
.chip.fuonly{border-color:#000;background:#fff;color:#000}
.chip.fuonly[aria-pressed="true"]{background:#000;border-color:#000;color:#fff}
.chip.vaonly{border-color:#000;background:#fff;color:#000}
.chip.vaonly[aria-pressed="true"]{background:#2F7A5C;border-color:#2F7A5C;color:#fff}
.chip.grhide{border-color:#000;background:#fff;color:#000}
.chip.grhide[aria-pressed="true"]{background:#7A5C2E;border-color:#7A5C2E;color:#fff}
td.n a{border-bottom:1px solid #D8D8DC}
td.n a:hover{border-bottom-color:#000}
/* Marks: the est / in parent / trk chips and the em-dash on a company that
   raised without disclosing. All four are real buttons — a phone has no hover,
   and a keyboard needs somewhere to land — sharing one panel below. The dotted
   rule is the affordance; the inline <span class="estt"> samples in the prose
   below the table stay flat, because they are not clickable. */
.estt{margin-left:5px;color:#6B6B73;font:400 9px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;vertical-align:1px}
/* Touch target (WCAG 2.5.8): these marks are 9px chips in a dense table and
   measured 21px tall. Vertical padding grows the button's OWN hit box — what
   a finger and an auditor both measure — and an equal negative margin hands
   the space back to the line, so no row grows. A pseudo-element was tried
   first and does not take the tap. */
button.estt,button.nofig,button.hc,button.gv{background:none;border:0;padding:5px 3px 6px;margin-top:-5px;margin-bottom:-6px;margin-right:-3px;margin-left:-3px;border-bottom:1px dotted #C7C7CC;cursor:help}
/* the chips sit at font-size 9px/1, so the same padding leaves them 21px —
   they need their own, and they keep the 5px separator from the figure. */
button.estt{padding-top:8px;padding-bottom:8px;margin-top:-8px;margin-bottom:-8px;margin-left:5px}
button.nofig,button.hc,button.gv{font:inherit;color:inherit;line-height:inherit}
/* orange only where the estimator is known to run high on that row */
button.gv.hi{color:#B8441F;border-bottom-color:#E3B5A3}
button.gv.hi:hover,button.gv.hi[aria-expanded="true"]{color:#B8441F;border-bottom-color:#B8441F}
button.estt:hover,button.estt[aria-expanded="true"],button.nofig:hover,button.nofig[aria-expanded="true"],button.hc:hover,button.hc[aria-expanded="true"],button.gv:hover,button.gv[aria-expanded="true"]{color:#000;border-bottom-color:#000}
.estt.held{color:#2F7A5C}
button.estt.held{border-bottom-color:#AFD3C4}
button.estt.held:hover,button.estt.held[aria-expanded="true"]{color:#2F7A5C;border-bottom-color:#2F7A5C}
.estt.idb{color:#2F6C86}
.estt.grb{color:#7A5C2E}
button.estt.grb{border-bottom-color:#D9C7A6}
button.estt.grb:hover,button.estt.grb[aria-expanded="true"]{color:#7A5C2E;border-bottom-color:#7A5C2E}
button.estt.idb{border-bottom-color:#B9CEDA}
button.estt.idb:hover,button.estt.idb[aria-expanded="true"]{color:#2F6C86;border-bottom-color:#2F6C86}
.estt.trk{color:#4E7A96}
button.estt.trk{border-bottom-color:#BCCDD8}
button.estt.trk:hover,button.estt.trk[aria-expanded="true"]{color:#4E7A96;border-bottom-color:#4E7A96}
/* min / ipo / debt / grant — one mark in one colour for "the figure is real but it is
   not the kind of figure the column implies", so four rare cases cost one hue, not four */
.estt.kind{color:#8A6A45}
button.estt.kind{border-bottom-color:#D9C6AE}
button.estt.kind:hover,button.estt.kind[aria-expanded="true"]{color:#8A6A45;border-bottom-color:#8A6A45}
button.estt:focus-visible,button.nofig:focus-visible,button.hc:focus-visible{outline:2px solid #000;outline-offset:2px}
/* the panel: fixed, so the table's own overflow-x scroller cannot clip it */
.note{position:fixed;z-index:10000;width:max-content;max-width:min(400px,calc(100vw - 20px));background:#fff;border:1px solid #000;padding:15px 17px 14px;box-shadow:0 10px 30px rgba(0,0,0,.10)}
.note[hidden]{display:none}
.note .nk{font:400 10px/1.35 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.07em;color:#6B6B73;padding-right:20px}
.note .nb{margin-top:9px;font:500 13px/1.6 'Overused Grotesk',sans-serif;letter-spacing:-0.01em;color:#3F3F46;white-space:pre-wrap}
.note .nm{margin-top:9px;font:400 9.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#74747D}
.note .nl{margin-top:12px;padding-top:11px;border-top:1px solid #EFEFEF;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.note .nl a{font:400 11px/1.45 'IBM Plex Mono',monospace;color:#000;text-decoration:none;border-bottom:1px solid #D9D9D9}
.note .nl a:hover{border-bottom-color:#000}
.note .nx{position:absolute;top:5px;right:6px;width:24px;height:24px;border:0;background:none;font:400 16px/1 'IBM Plex Mono',monospace;color:#6B6B73;cursor:pointer;display:none}
.note.pin .nx{display:block}
.note.pin .nx:hover{color:#000}
.note[data-k="held"]{border-color:#2F7A5C}
.note[data-k="held"] .nk{color:#2F7A5C}
.note[data-k="trk"]{border-color:#4E7A96}
.note[data-k="trk"] .nk{color:#4E7A96}
.note[data-k="hc"]{border-color:#6B6B73}
.note[data-k="hc"] .nk{color:#52525B}
.note[data-k="gva"]{border-color:#6B6B73}
.note[data-k="gva"] .nk{color:#52525B}
.note[data-k="gvana"]{border-color:#6B6B73}
.note[data-k="gvana"] .nk{color:#52525B}
.note[data-k="gvahi"]{border-color:#B8441F}
.note[data-k="gvahi"] .nk{color:#B8441F}
.note[data-k="hcco"]{border-color:#2F7A5C}
.note[data-k="hcco"] .nk{color:#2F7A5C}
/* no hover on a phone, and no room beside a cell inside a scrolling table:
   the panel becomes a sheet the reader dismisses deliberately */
@media(max-width:640px){
  .note{left:0!important;right:0;top:auto!important;bottom:0;width:auto;max-width:none;border-left:0;border-right:0;border-bottom:0;padding:18px 18px 26px;max-height:72vh;overflow-y:auto;box-shadow:0 -12px 34px rgba(0,0,0,.16)}
  .note .nx{display:block;top:8px;right:8px}
  .note .nb{font-size:14px}
}
.ycb{display:inline-block;margin-left:7px;padding:1px 5px;border:1px solid #BE4E2B;color:#BE4E2B;text-decoration:none;font:400 9.5px/1.45 'IBM Plex Mono',monospace;letter-spacing:.04em;vertical-align:1px}
.ycb:hover{background:#BE4E2B;color:#fff}
.edb{display:inline-block;margin-left:7px;padding:1px 5px;border:1px solid #4E7A96;color:#4E7A96;text-decoration:none;font:400 9.5px/1.45 'IBM Plex Mono',monospace;letter-spacing:.04em;vertical-align:1px}
.edb:hover{background:#4E7A96;color:#fff}
/* Antler = the gradient's 3rd stop #7AB88A taken to badge weight (#4E7A58) — the raw stop
   fails contrast on white at 9.5px, the same reason /model rejected #E8734B for charts */
.anb{display:inline-block;margin-left:7px;padding:1px 5px;border:1px solid #4E7A58;color:#4E7A58;text-decoration:none;font:400 9.5px/1.45 'IBM Plex Mono',monospace;letter-spacing:.04em;vertical-align:1px}
.anb:hover{background:#4E7A58;color:#fff}
.chip.anonly[aria-pressed="true"]{background:#4E7A58;border-color:#4E7A58;color:#fff}
.chip.edonly{border-color:#000;background:#fff;color:#000}
.chip.edonly[aria-pressed="true"]{background:#4E7A96;border-color:#4E7A96;color:#fff}
.lede{color:#52525B;font-size:14.5px;line-height:1.6;max-width:92ch;margin-bottom:16px}
.method{border:1px solid #E7E7E7;padding:22px}
.method p{color:#52525B;font-size:14.5px;line-height:1.6;max-width:88ch}
/* ── section titles below the table ── */
.h2{font-size:clamp(26px,3.2vw,38px);line-height:1.06;letter-spacing:-0.025em;font-weight:500;margin-bottom:12px;max-width:26ch}
/* ── the map, embedded live: the shield keeps scrolling honest (a wheel over an
   active canvas zooms the map, not the page) until the reader opts in ── */
#map .cta{display:flex;gap:10px;margin:18px 0 0;flex-wrap:wrap}
.mapembed{position:relative;border:1px solid #E7E7E7;background:#FAFAFA;margin-top:22px;height:min(72vh,620px)}
@media(max-width:640px){.mapembed{height:66vh}}
.mapframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.mapshield{position:absolute;inset:0;z-index:5;display:flex;align-items:center;justify-content:center;text-decoration:none;background:linear-gradient(180deg,rgba(255,255,255,0) 62%,rgba(255,255,255,.5))}
.mapshield span{font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;background:#000;color:#fff;padding:11px 15px}
.mapshield:hover span{background:#333}
.mapshield.off{display:none}
/* ── the six disciplines: hairline tiles, line icons ── */
.feat{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:940px){.feat{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.feat{grid-template-columns:1fr}}
.feat a{background:#fff;padding:28px 24px 26px;text-decoration:none;display:flex;flex-direction:column}
.feat a:hover{background:#FAFAFA}
.feat .fic{display:block;margin-bottom:38px}
.feat .fic svg{width:27px;height:27px;fill:none;stroke:#000;stroke-width:1.5;stroke-linecap:square}
.feat h3{font-size:20px;font-weight:500;letter-spacing:-0.02em;margin-bottom:12px}
.feat p{color:#52525B;font-size:13.5px;line-height:1.55;max-width:40ch}
.feat .go{margin-top:auto;padding-top:16px;font:400 10.5px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#74747D}
.feat a:hover .go{color:#000}
/* ── the ecosystem cards ── */
.eco{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
@media(max-width:1060px){.eco{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.eco{grid-template-columns:1fr}}
.eco a{background:#fff;padding:20px 18px 22px;text-decoration:none;display:block}
.eco a:hover{background:#FAFAFA}
.eco .rt{font:400 10px/1 'IBM Plex Mono',monospace;letter-spacing:.05em;color:#74747D;display:block;margin-bottom:12px}
.eco a:hover .rt{color:#000}
.eco h3{font-size:16.5px;font-weight:500;letter-spacing:-0.015em;margin-bottom:8px}
.eco p{color:#52525B;font-size:12.5px;line-height:1.5}
${FOOT.css}</style>
</head>
<body>
<div class="banner">${L('WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY DERIVED FIGURE IS A LABELED ESTIMATE', 'DOKUMEN KERJA · SUMBER PUBLIK SAJA · ANGKA TURUNAN SELALU BERLABEL ESTIMASI')}</div>
${NAV.header('', { lang, path })}
<main>
<section class="hero">
  <h1>${L("Indonesia's startup graph.", 'Sensus startup Indonesia.')}</h1>
  <div>
    <p class="sub">${L(`${fmt(T.companies)} companies and counting — who they are, where they sit, what they raised,
    whom they employ, and what that activity adds to the economy. Built from public reporting and
    national statistics${METRO_LINE}. Search it like a phone book; read it like a census.`,
    `${fmt(T.companies)} perusahaan rintisan dan terus bertambah — siapa saja mereka, di mana kantornya, berapa dana
    yang dihimpun, berapa orang yang dipekerjakan, dan apa sumbangannya bagi perekonomian. Disusun dari pemberitaan
    publik dan statistik nasional${METRO_LINE}. Telusuri seperti buku telepon, baca seperti sensus.`)}</p>
    ${heroFact}
    <div class="cta">
      <a class="btn primary" href="#companies">${L('Browse the companies', 'Lihat daftar perusahaan')}</a>
      <a class="btn" href="${PF}/map">${L('See them on the map', 'Lihat petanya')}</a>
    </div>
  </div>
</section>
${body}
</main>
<script type="application/json" id="note-frag">${JSON.stringify(NOTE_DICT).replace(/</g, '\\u003c')}</script>
<div class="note" id="note" role="tooltip" hidden>
  <button type="button" class="nx" aria-label="${L('Close', 'Tutup')}">\u00d7</button>
  <div class="nk"></div>
  <div class="nb"></div>
  <div class="nm" hidden></div>
  <div class="nl" hidden></div>
</div>
${FOOT.footer({ lang, legalRight: `<a href="${PF}/stats">${L('Live traffic', 'Statistik pengunjung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · ${L('Boundaries © OpenStreetMap · Anchors: BPS · updated', 'Batas wilayah © OpenStreetMap · Anchor: BPS · diperbarui')} ${esc(((data && data.generated) || '').slice(0, 10))}` })}
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/1001.js?v=${V}" defer></script>
<script src="/js/company1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { landing };
