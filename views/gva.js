'use strict';
/* One explanation of the Output column, shared by the table mark, the company
 * profile and the landing section.
 *
 * Luca, 29 Aug 2026, on Amartha's IDR 10,750 bn: "i think we need to elaborate
 * what is output". The number was reaching readers with nothing but an `est`
 * chip on it, so the obvious readings were the wrong ones — revenue, or the
 * wage bill. It is neither, it is not disclosed by anybody, and the row is
 * arithmetic a reader is entitled to see: headcount x a sector anchor.
 *
 * Everything here derives from data/census-raw.json's `method` block. Nothing
 * about the estimator is retyped as prose — when an anchor moves, this moves.
 *
 * LANGUAGE: working/how/markNote take an optional lang ('en' default, 'id'),
 * and t(lang) hands back {WHAT, SHORT, LIMITS} in that language. The bare
 * WHAT/SHORT/LIMITS exports stay English so an older caller keeps working.
 */

const fmt = (n, d = 0) => (n === null || n === undefined) ? '—'
  : Number(n).toLocaleString('en-US', { maximumFractionDigits: d });

/* The anchor a row is actually priced at, and whether it is the sector's own or
   the fallback. A sector bucket added without an anchor silently prices at the
   default (it has happened — `climate`), so the fallback is always named. */
function anchorOf(c, m) {
  const by = (m && m.gva_per_worker_idr_m_by_sector) || {};
  const key = c.sector_key;
  const own = Object.prototype.hasOwnProperty.call(by, key);
  return { rate: own ? by[key] : (m && m.default_gva_per_worker_idr_m) || 0, own };
}

/* The row's arithmetic, in full. `line` is the working a reader can check with
   a calculator: people x anchor = the number in the cell. A frontline-marked
   payroll (couriers, store crews, field officers — Luca, Aug 31) prices at the
   national frontline anchor, and a company-published split prices office and
   frontline separately; the line shows whichever arithmetic the build used. */
function working(c, m, lang) {
  if (c.employees_est === null || c.employees_est === undefined) return null;
  /* outside the anchored metros there is no arithmetic to show: see withheld() */
  if (c.output_withheld) return null;
  const { rate, own } = anchorOf(c, m);
  const label = c.sector_label || (lang === 'id' ? 'default' : 'the default');
  const fa = m && m.frontline_gva_per_worker_idr_m;
  const ws = c.workforce_split;
  let line;
  if (fa && ws && ws.office != null && ws.frontline != null) {
    line = lang === 'id'
      ? `${fmt(ws.office)} pekerja kantor × Rp ${fmt(rate)} juta (anchor ${label}) + ${fmt(ws.frontline)} garda depan × Rp ${fmt(fa)} juta (anchor frontline nasional) = IDR ${fmt(c.est_gva_idr_bn, 1)} mlr per tahun`
      : `${fmt(ws.office)} office × Rp ${fmt(rate)} million (the ${label} anchor) + ${fmt(ws.frontline)} frontline × Rp ${fmt(fa)} million (the national frontline anchor) = IDR ${fmt(c.est_gva_idr_bn, 1)} bn a year`;
  } else if (fa && c.workforce_kind === 'frontline') {
    line = lang === 'id'
      ? `${fmt(c.employees_est)} pekerja garda depan × Rp ${fmt(fa)} juta nilai tambah per pekerja (anchor frontline nasional — rata-rata seluruh ekonomi BPS, bukan anchor sektor Jakarta) = IDR ${fmt(c.est_gva_idr_bn, 1)} mlr per tahun`
      : `${fmt(c.employees_est)} frontline employees × Rp ${fmt(fa)} million of value added per worker (the national frontline anchor — the BPS economy-wide average, not a Jakarta sector anchor) = IDR ${fmt(c.est_gva_idr_bn, 1)} bn a year`;
  } else {
    line = lang === 'id'
      ? `${fmt(c.employees_est)} pekerja × Rp ${fmt(rate)} juta nilai tambah per pekerja`
        + ` (${own ? 'anchor ' + label : 'default Rp ' + fmt(rate) + ' juta — ' + label + ' belum punya anchor sendiri'})`
        + ` = IDR ${fmt(c.est_gva_idr_bn, 1)} mlr per tahun`
      : `${fmt(c.employees_est)} employees × Rp ${fmt(rate)} million of value added per worker`
        + ` (the ${own ? label + ' anchor' : 'Rp ' + fmt(rate) + ' million default — ' + label + ' has no anchor of its own'})`
        + ` = IDR ${fmt(c.est_gva_idr_bn, 1)} bn a year`;
  }
  return { people: c.employees_est, rate, own, bn: c.est_gva_idr_bn, label, line };
}

/* Plain-language definition, used verbatim in three places. Kept as sentences
   rather than a paragraph so a caller can take the first one alone. */
const WHAT = [
  'Output is gross value added: the part of what a company earns that it creates itself, '
  + 'after taking out everything it buys in from other firms — cloud, rent, logistics bought from '
  + 'a carrier, goods bought for resale. Add up the value added of every firm in a country and that '
  + 'sum is its GDP, which is what makes this the one figure that says what a company is worth to an '
  + 'economy rather than to its shareholders.',
  'Read from the income side the same quantity is wages, plus operating surplus, plus depreciation, '
  + 'plus taxes on production. Wages are one part of it — usually the largest part in a services '
  + 'business and never the whole of it.',
  'Revenue and GMV are different quantities and larger ones. Revenue includes every rupiah paid '
  + 'straight back out to suppliers; GMV is money that passes across a marketplace without ever '
  + 'belonging to it. Neither is used here, in either direction.',
];

const WHAT_ID = [
  'Output adalah nilai tambah bruto: bagian dari penghasilan perusahaan yang diciptakannya sendiri, '
  + 'setelah dikurangi semua yang dibelinya dari perusahaan lain — cloud, sewa, logistik yang dibeli '
  + 'dari kurir, barang yang dibeli untuk dijual kembali. Jumlahkan nilai tambah setiap perusahaan di '
  + 'sebuah negara dan hasilnya adalah PDB negara itu — itulah yang menjadikan angka ini satu-satunya '
  + 'ukuran arti sebuah perusahaan bagi perekonomian, bukan bagi pemegang sahamnya.',
  'Dibaca dari sisi pendapatan, besaran yang sama adalah upah, ditambah surplus usaha, penyusutan, '
  + 'dan pajak atas produksi. Upah hanyalah salah satu bagiannya — biasanya bagian terbesar di bisnis '
  + 'jasa, dan tidak pernah keseluruhannya.',
  'Pendapatan dan GMV adalah besaran yang berbeda dan lebih besar. Pendapatan memuat setiap rupiah '
  + 'yang langsung dibayarkan kembali ke pemasok; GMV adalah uang yang lewat di sebuah marketplace '
  + 'tanpa pernah menjadi miliknya. Keduanya tidak dipakai di sini, ke arah mana pun.',
];

/* How the estimate is made — one sentence per fact, all of it from `method`. */
function how(m, lang) {
  const by = (m && m.gva_per_worker_idr_m_by_sector) || {};
  const vals = Object.values(by).filter((v) => typeof v === 'number');
  const lo = vals.length ? Math.min(...vals) : null;
  const hi = vals.length ? Math.max(...vals) : null;
  const def = (m && m.default_gva_per_worker_idr_m) || null;
  const line = lang === 'id'
    ? 'Tidak ada startup Indonesia yang mempublikasikan nilai tambahnya, jadi sensus mengestimasinya: '
      + 'jumlah pekerja × anchor nilai-tambah-bruto-per-pekerja untuk sektor perusahaan itu, diturunkan '
      + 'dari tabel PDRB dan Sakernas BPS DKI Jakarta lalu diberi batas atas dan diskon agar startup '
      + 'tidak dihargai pada produktivitas rata-rata telko dan bank'
      + (lo && hi ? ` (Rp ${fmt(lo)}–${fmt(hi)} juta per pekerja di ${Object.keys(by).length} sektor` : '')
      + (def ? `, Rp ${fmt(def)} juta jika sektor belum punya anchor sendiri)` : ')')
      + '. Pendanaan, valuasi, dan GMV tidak pernah masuk estimasi, dan baris tanpa jumlah pekerja '
      + 'tidak menghasilkan output sama sekali alih-alih ditaksir.'
      + ((m && m.frontline_gva_per_worker_idr_m)
        ? ` Daftar gaji yang ditandai frontline — kurir, kru gerai, petugas lapangan — dihargai pada anchor frontline nasional Rp ${fmt(m.frontline_gva_per_worker_idr_m)} juta (rata-rata seluruh ekonomi BPS), dan baris dengan rincian resmi menghargai bagian kantor dan garda depannya secara terpisah.`
        : '')
      + ' Sensus mencakup seluruh Indonesia sejak 28 Sep 2026, tetapi output baru diestimasi untuk Jakarta Raya, '
      + 'Bandung, dan Bali: menghargai daftar gaji di provinsi lain dengan anchor Jakarta akan membuatnya terlalu '
      + 'tinggi, jadi baris-baris itu belum diberi angka sampai anchor regional dari PDRB provinsi BPS tersedia.'
    : 'No Indonesian startup publishes its value added, so the census estimates it: headcount × a '
      + 'gross-value-added-per-worker anchor for the company’s sector, derived from BPS DKI Jakarta’s '
      + 'PDRB and Sakernas tables and then capped and discounted so startups are not priced at '
      + 'telco- and bank-average productivity'
      + (lo && hi ? ` (Rp ${fmt(lo)}–${fmt(hi)} million per worker across ${Object.keys(by).length} sectors` : '')
      + (def ? `, Rp ${fmt(def)} million where a sector has no anchor of its own)` : ')')
      + '. Funding, valuation and GMV never enter the estimate, and a row with no headcount produces '
      + 'no output at all rather than an imputed one.'
      + ((m && m.frontline_gva_per_worker_idr_m)
        ? ` A payroll marked frontline — couriers, store crews, field officers — prices at the national frontline anchor of Rp ${fmt(m.frontline_gva_per_worker_idr_m)} million (the BPS economy-wide average), and a row with a company-published split prices its office and frontline shares separately.`
        : '')
      + ' The census covers all of Indonesia since 28 Sep 2026, but output is estimated only for Greater '
      + 'Jakarta, Bandung and Bali: pricing a payroll in another province at Jakarta’s anchors would '
      + 'overstate it, so those rows carry no figure until regional anchors from BPS provincial accounts exist.';
  return { lo, hi, def, mult: (m && m.indirect_multiplier) || null, sectors: Object.keys(by).length, line };
}

/* The limits, stated where the figure is read rather than in a footnote. */
const LIMITS = [
  'An anchor is an average over a whole Jakarta sector, and it fits an office of desk workers. '
  + 'A payroll that is mostly frontline — couriers, store crews, gym coaches, village field '
  + 'officers — is therefore marked and priced at the national frontline anchor (the BPS '
  + 'economy-wide average) instead, and a company-published split prices office and frontline '
  + 'separately. A row where even that still overstates against a revenue bound is listed below '
  + 'rather than quietly corrected.',
  'A single company’s figure carries at least ±50% error and is not worth reading closely; the sums '
  + 'over hundreds of companies are what the model is for.',
  'The anchors are at 2023 prices against 2026 headcounts, which understates the total by an '
  + 'estimated 10–20%.',
];

const LIMITS_ID = [
  'Anchor adalah rata-rata satu sektor Jakarta secara utuh, dan ia pas untuk kantor berisi pekerja '
  + 'meja. Karena itu daftar gaji yang sebagian besar garda depan — kurir, kru gerai, pelatih gym, '
  + 'petugas lapangan desa — ditandai dan dihargai pada anchor frontline nasional (rata-rata seluruh '
  + 'ekonomi BPS), dan baris dengan rincian resmi menghargai bagian kantor dan garda depannya secara '
  + 'terpisah. Baris yang bahkan dengan itu masih melampaui batas pendapatannya dicantumkan di bawah, '
  + 'bukan diam-diam dikoreksi.',
  'Angka satu perusahaan membawa galat sekurang-kurangnya ±50% dan tidak layak dibaca terlalu dekat; '
  + 'penjumlahan atas ratusan perusahaanlah kegunaan model ini.',
  'Anchor memakai harga 2023 terhadap jumlah pekerja 2026, yang menurunkan total sekitar 10–20%.',
];

/* The definition in four sentences, for the places that cannot hold three
   paragraphs: the table's note panel and the profile's fact row. */
const SHORT = 'Output is gross value added — what the company adds to GDP: the part of what it earns '
  + 'that it creates itself, after taking out everything it buys in from other firms. Revenue is a '
  + 'bigger number, and the wage bill is one component of this one. Nobody publishes value added, so '
  + 'the census estimates it from headcount and a BPS sector anchor; funding, valuation and GMV never '
  + 'enter.';

const SHORT_ID = 'Output adalah nilai tambah bruto — sumbangan perusahaan terhadap PDB: bagian dari '
  + 'penghasilannya yang diciptakannya sendiri, setelah dikurangi semua yang dibelinya dari perusahaan '
  + 'lain. Pendapatan adalah angka yang lebih besar, dan total gaji hanyalah satu komponen dari angka '
  + 'ini. Tidak ada yang mempublikasikan nilai tambah, jadi sensus mengestimasinya dari jumlah pekerja '
  + 'dan anchor sektor BPS; pendanaan, valuasi, dan GMV tidak pernah masuk.';

/* The three texts in one language. */
const t = (lang) => (lang === 'id'
  ? { WHAT: WHAT_ID, SHORT: SHORT_ID, LIMITS: LIMITS_ID }
  : { WHAT, SHORT, LIMITS });

/* The constant half of every Output note, named once so it can be SENT once.
   The landing table carries an Output mark on ~376 rows; inlining the shared
   definition and the two standing links in each one put 347KB of duplicated
   prose into the page (measured) and pushed its LCP over Google's threshold.
   The page now emits this dictionary a single time and each mark references
   it by key — see noteFrag() callers in views/pages1001.js. */
function noteFrag(lang) {
  const id = lang === 'id';
  const pfx = id ? '/id' : '';   // keep an /id reader on /id pages
  return {
    f: {
      gs: t(lang).SHORT,
      gt: id ? 'Output — nilai tambah, estimasi' : 'Output — value added, estimated',
      gth: id ? 'Output — estimasi, dan terlalu tinggi di baris ini' : 'Output — estimated, and high on this row',
      gm: id ? 'Estimasi · ±50% pada satu baris' : 'Estimate · ±50% on a single row',
      gmh: id ? 'Estimasi · diketahui terlalu tinggi di baris ini' : 'Estimate · known to run high on this row',
    },
    l: {
      gl: [{ h: pfx + '/coverage#output', t: id ? 'Apa itu angka output →' : 'What the output figure is →' },
        { h: pfx + '/model', t: id ? 'Model formal — persamaan dan batas galat →' : 'The formal model — equations and error bounds →' }],
    },
  };
}

/* Why a row with a headcount has no output figure (nationwide scope, 28 Sep
   2026). The anchors are BPS DKI Jakarta sector averages; pricing a payroll in
   another province at them would overstate it, so the cell stays empty and says
   so rather than printing a Jakarta-priced number. `city` is the metro's name. */
function withheld(c, lang, city) {
  if (!c.output_withheld) return null;
  const where = city || c.kota || (lang === 'id' ? 'kota ini' : 'this city');
  return lang === 'id'
    ? {
      t: 'Belum diestimasi untuk kota ini',
      b: `Anchor output sensus adalah angka nilai tambah per pekerja dari BPS DKI Jakarta, per sektor. `
        + `Memakainya untuk perusahaan di ${where} akan membuat angkanya terlalu tinggi, jadi sel ini sengaja `
        + `dibiarkan kosong. Anchor regional dari PDRB provinsi BPS adalah langkah berikutnya. Jumlah pekerjanya `
        + `tetap dihitung.`,
    }
    : {
      t: 'Not estimated for this city yet',
      b: `The census's output anchors are BPS DKI Jakarta value-added-per-worker figures, by sector. `
        + `Using them for a company in ${where} would overstate it, so this cell is left empty on purpose. `
        + `Regional anchors from BPS provincial accounts come next. The headcount still counts as jobs.`,
    };
}

/* Payload for the shared note panel on the table (public/js/1001.js). Plain
   text: the panel sets textContent, never innerHTML. The caveat's `why` is
   census data and stays as written.
   `~key` means "look this up in the page's fragment dictionary"; `sf` is a
   fragment appended to the body, `lf` a standing link set. The row-specific
   arithmetic now leads and the general definition follows it. */
function markNote(c, m, lang, city) {
  const wh = withheld(c, lang, city);
  if (wh) return { k: 'gvana', t: wh.t, b: wh.b, m: lang === 'id' ? 'Belum ada anchor regional' : 'No regional anchor yet', lf: 'gl' };
  const w = working(c, m, lang);
  if (!w) return null;
  const cav = c.output_caveat;
  const id = lang === 'id';
  return {
    k: cav ? 'gvahi' : 'gva',
    t: cav ? '~gth' : '~gt',
    b: w.line + '.'
      + (cav ? (id ? ' Pada baris ini estimasinya diketahui terlalu tinggi. ' : ' On this row the estimate runs high. ') + cav.why : ''),
    sf: 'gs',
    m: cav ? '~gmh' : '~gm',
    lf: 'gl',
  };
}

module.exports = { anchorOf, working, withheld, how, markNote, noteFrag, t, WHAT, SHORT, LIMITS, fmt };
