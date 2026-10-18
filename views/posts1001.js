'use strict';
/* The /news data stories (views/blog1001.js renders them).
 *
 * Each post reads ONE frozen file, data/news/<slug>.json, written by
 * scripts/news-snapshot.js. The copy below only interpolates fields of that
 * file: no number in a post is typed here. Company names, round labels and
 * investor names stay as the census records them on the Indonesian page too.
 *
 * Post shape: { slug, title(L,P), deck(L,P,h), answer(L,P,h), thumb(P,h),
 *               body(L,P,h), related: [paths] }
 * h = the helpers from blog1001.js (fmt, usdM, ymd, list, co, bars, ...).
 */
const { esc } = require('../lib/util');

const KIND = {
  venture: ['venture round', 'putaran ventura'],
  ipo: ['IPO', 'IPO'],
  acquisition: ['acquisition', 'akuisisi'],
  grant: ['grant', 'hibah'],
  crowdfunding: ['sukuk crowdfunding', 'urun dana sukuk'],
};
const COUNT = {
  linkedin: ['LinkedIn members', 'Anggota LinkedIn'],
  revelio: ['Revelio Labs estimate', 'Estimasi Revelio Labs'],
  filing: ['Company filing', 'Laporan perusahaan'],
  company: ['Company figure', 'Angka perusahaan'],
};
/* the same labels inside a sentence */
const COUNT_IN = {
  linkedin: ['LinkedIn members', 'anggota LinkedIn'],
  revelio: ['Revelio Labs estimate', 'estimasi Revelio Labs'],
  filing: ['company filing', 'laporan perusahaan'],
  company: ['company figure', 'angka perusahaan'],
};

/* 1 ------------------------------------------------------------------------ */
const rounds = {
  slug: 'indonesian-startup-funding-rounds-2026',
  kicker: ['Funding', 'Pendanaan'],
  title: (L) => L('Which Indonesian startups raised money in 2026?', 'Startup Indonesia mana saja yang mendapat pendanaan pada 2026?'),
  deck: (L, P, h) => L(
    `${h.fmt(P.rows.length)} companies in the census recorded a funding event in 2026. Most were venture rounds, and most of those never said how much.`,
    `${h.fmt(P.rows.length)} perusahaan dalam sensus mencatat peristiwa pendanaan pada 2026. Sebagian besar putaran ventura, dan sebagian besar tidak menyebut nilainya.`),
  answer: (L, P, h) => {
    const k = P.by_kind;
    const parts = ['venture', 'ipo', 'acquisition', 'grant', 'crowdfunding'].filter((x) => k[x])
      .map((x) => `${h.fmt(k[x])} ${L(...KIND[x])}${k[x] > 1 && h.lang === 'en' && x !== 'ipo' ? 's' : ''}`);
    return L(
      `As of ${h.dateLong(P.date)}, the 1001startup.id census records a 2026 funding event at ${h.fmt(P.rows.length)} of its ${h.fmt(P.companies)} Indonesian startups: ${h.list(parts)}. ${h.fmt(P.venture_stated)} of the ${h.fmt(P.venture)} venture rounds stated an amount, ${h.usdM(P.venture_stated_usd_m)} between them; the largest is ${h.co(P.largest.id, P.largest.name)}’s at about ${h.usdM(P.largest.usd_m)}.`,
      `Per ${h.dateLong(P.date)}, sensus 1001startup.id mencatat peristiwa pendanaan 2026 di ${h.fmt(P.rows.length)} dari ${h.fmt(P.companies)} startup Indonesia: ${h.list(parts)}. ${h.fmt(P.venture_stated)} dari ${h.fmt(P.venture)} putaran ventura menyebut nilainya, totalnya ${h.usdM(P.venture_stated_usd_m)}; yang terbesar milik ${h.co(P.largest.id, P.largest.name)}, sekitar ${h.usdM(P.largest.usd_m)}.`);
  },
  thumb: (P, h) => h.logoStrip(P.rows),
  body: (L, P, h) => {
    const stated = P.rows.filter((r) => r.kind === 'venture' && r.usd_m != null);
    const filed = stated.filter((r) => /filing/i.test(r.label)).map((r) => h.co(r.id, r.name));
    const debt = stated.filter((r) => /debt/i.test(r.label)).map((r) => h.co(r.id, r.name));
    const silent = P.rows.filter((r) => r.kind === 'venture' && r.usd_m == null);
    const other = P.rows.filter((r) => r.kind !== 'venture');
    const sec = P.by_sector;
    const topN = sec[0].n;
    const lead = sec.filter((s) => s.n === topN).map((s) => h.sector(s.sector));
    const next = sec.filter((s) => s.n < topN);
    const nextN = next.length ? next[0].n : 0;
    const nextNames = next.filter((s) => s.n === nextN).map((s) => h.sector(s.sector));
    return `
${h.stats([
    [h.fmt(P.rows.length), L('companies with a 2026 event', 'perusahaan dengan peristiwa 2026')],
    [h.fmt(P.venture), L('venture rounds', 'putaran ventura')],
    [h.usdTile(P.venture_stated_usd_m), L(`stated, ${h.fmt(P.venture_stated)} rounds`, `disebutkan, ${h.fmt(P.venture_stated)} putaran`)],
    [h.fmt(silent.length), L('venture rounds with no amount', 'putaran ventura tanpa nilai')]])}
<section class="pb">
  <h2>${L('The venture rounds that named a figure', 'Putaran ventura yang menyebut angka')}</h2>
  <p>${L(
    `${h.fmt(stated.length)} of the ${h.fmt(P.venture)} venture rounds state a US-dollar amount in the census record.${filed.length ? ` ${h.list(filed)}’s figure comes from company filings rather than an announcement.` : ''}${debt.length ? ` ${h.list(debt)}’s mixes equity and venture debt.` : ''}`,
    `${h.fmt(stated.length)} dari ${h.fmt(P.venture)} putaran ventura menyebut nilai dalam dolar AS di catatan sensus.${filed.length ? ` Angka ${h.list(filed)} berasal dari dokumen perusahaan, bukan pengumuman.` : ''}${debt.length ? ` Angka ${h.list(debt)} menggabungkan ekuitas dan utang ventura.` : ''}`)}</p>
  ${h.bars(stated.map((r) => ({ name: r.name, href: h.coHref(r.id), logo: r.logo, v: r.usd_m, text: h.usdShort(r.usd_m) })), L('US$ million, as stated in the round', 'juta US$, sesuai yang disebut'))}
</section>
<section class="pb">
  <h2>${L('Every 2026 event on record', 'Semua peristiwa 2026 yang tercatat')}</h2>
  <p>${L(
    `${h.list(lead)} had the most companies with a 2026 event (${h.fmt(topN)}${lead.length > 1 ? ' each' : ''}), then ${h.list(nextNames)} (${h.fmt(nextN)}${nextNames.length > 1 ? ' each' : ''}). Each row links the company’s page in the census and the report the event comes from.`,
    `${h.list(lead)} punya perusahaan dengan peristiwa 2026 terbanyak (${lead.length > 1 ? 'masing-masing ' : ''}${h.fmt(topN)}), disusul ${h.list(nextNames)} (${nextNames.length > 1 ? 'masing-masing ' : ''}${h.fmt(nextN)}). Setiap baris menautkan halaman perusahaan di sensus dan laporan asal peristiwanya.`)}</p>
  <div class="tablewrap"><table>
    <thead><tr><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th><th>${L('What the census records', 'Catatan sensus')}</th><th class="n">${L('US$ million', 'Juta US$')}</th><th>${L('Source', 'Sumber')}</th></tr></thead>
    <tbody>${P.rows.map((r) => `<tr><td class="co">${h.logo(r)}${h.co(r.id, r.name)}</td><td class="mu">${esc(h.sector(r.sector))}</td><td>${r.kind !== 'venture' ? `<span class="kt">${esc(L(...KIND[r.kind]))}</span> ` : ''}${esc(r.label)}</td><td class="n">${r.usd_m != null ? h.usdShort(r.usd_m) : '—'}</td><td>${h.src(r.src, r.src_host)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
<section class="pb">
  <h2>${L('Not all of it is venture money', 'Tidak semuanya dana ventura')}</h2>
  <p>${L(
    `${h.fmt(other.length)} of the ${h.fmt(P.rows.length)} events are something else: ${h.list(other.map((r) => `${h.co(r.id, r.name)} (${L(...KIND[r.kind])})`))}. They are kept in the count because the company took in outside money or changed hands in 2026, and kept apart in the table so they are not read as rounds.`,
    `${h.fmt(other.length)} dari ${h.fmt(P.rows.length)} peristiwa bukan putaran ventura: ${h.list(other.map((r) => `${h.co(r.id, r.name)} (${L(...KIND[r.kind])})`))}. Semuanya tetap dihitung karena perusahaan menerima dana dari luar atau berganti pemilik pada 2026, dan diberi label di tabel agar tidak terbaca sebagai putaran ventura.`)}</p>
</section>
<section class="pb">
  <h2>${L('Most rounds do not say how much', 'Sebagian besar putaran tidak menyebut nilai')}</h2>
  <p>${L(
    `${h.fmt(silent.length)} of the ${h.fmt(P.venture)} venture rounds were announced without an amount, among them ${h.list(silent.slice(0, 4).map((r) => h.co(r.id, r.name)))}. The census leaves those blank rather than borrowing a tracker’s guess, so the ${h.usdM(P.venture_stated_usd_m)} above is a floor for 2026, not a total.`,
    `${h.fmt(silent.length)} dari ${h.fmt(P.venture)} putaran ventura diumumkan tanpa nilai, di antaranya ${h.list(silent.slice(0, 4).map((r) => h.co(r.id, r.name)))}. Sensus membiarkannya kosong dan tidak meminjam tebakan pelacak data, jadi ${h.usdM(P.venture_stated_usd_m)} di atas adalah batas bawah untuk 2026, bukan total.`)}</p>
</section>
${h.method(L(
    `The census keeps each company’s most recent round. A company is counted here when that round is dated 2026. Amounts are only the US-dollar figures written in the round’s own record; rupiah and Singapore-dollar figures are left as written. ${h.fmt(P.rows.length)} is the count among the ${h.fmt(P.companies)} companies in the census, not every Indonesian startup that raised money in 2026.`,
    `Sensus menyimpan putaran terakhir setiap perusahaan. Perusahaan dihitung di sini bila putaran itu bertanggal 2026. Nilai hanya diambil dari angka dolar AS yang tertulis di catatan putarannya; angka rupiah dan dolar Singapura dibiarkan seperti aslinya. ${h.fmt(P.rows.length)} adalah hitungan di antara ${h.fmt(P.companies)} perusahaan dalam sensus, bukan semua startup Indonesia yang mendapat dana pada 2026.`))}`;
  },
  related: ['/investors', '/report/2026-10'],
};

/* 2 ------------------------------------------------------------------------ */
const employers = {
  slug: 'biggest-startup-employers-indonesia-2026',
  kicker: ['Jobs', 'Lapangan kerja'],
  title: (L) => L('Indonesia’s biggest startup employers in 2026', 'Startup dengan karyawan terbanyak di Indonesia pada 2026'),
  deck: (L, P, h) => L(
    `The ${h.fmt(P.rows.length)} largest headcounts among census startups, counting only figures dated 2026 and linked to their source.`,
    `${h.fmt(P.rows.length)} jumlah karyawan terbesar di antara startup sensus, hanya dari angka bertanggal 2026 yang tertaut ke sumbernya.`),
  answer: (L, P, h) => {
    const [a, b, c] = P.rows;
    const big = P.left_out[0];
    return L(
      `As of ${h.dateLong(P.date)}, among the ${h.fmt(P.ranked_total)} census startups whose headcount is dated 2026 and linked to a source, ${h.co(a.id, a.name)} is the largest at about ${h.fmt(a.n)} people (${L(...COUNT_IN[a.kind])}, ${h.ymd(a.asof)}), followed by ${h.co(b.id, b.name)} (${h.fmt(b.n)}) and ${h.co(c.id, c.name)} (${h.fmt(c.n)}).${big ? ` Bigger figures such as ${h.co(big.id, big.name)}’s ${h.fmt(big.n)} are left off the ranking because they carry no 2026 date.` : ''}`,
      `Per ${h.dateLong(P.date)}, di antara ${h.fmt(P.ranked_total)} startup sensus yang jumlah karyawannya bertanggal 2026 dan tertaut ke sumber, ${h.co(a.id, a.name)} yang terbesar dengan sekitar ${h.fmt(a.n)} orang (${L(...COUNT_IN[a.kind])}, ${h.ymd(a.asof)}), disusul ${h.co(b.id, b.name)} (${h.fmt(b.n)}) dan ${h.co(c.id, c.name)} (${h.fmt(c.n)}).${big ? ` Angka yang lebih besar seperti ${h.fmt(big.n)} milik ${h.co(big.id, big.name)} tidak masuk peringkat karena tidak bertanggal 2026.` : ''}`);
  },
  thumb: (P, h) => h.logoStrip(P.rows),
  body: (L, P, h) => {
    const k = P.kinds;
    const grouped = P.rows.filter((r) => r.group);
    return `
${h.stats([
    [h.fmt(P.rows.length), L('companies ranked', 'perusahaan diperingkat')],
    [h.fmt(P.top_sum), L(`people across the top ${P.rows.length}`, `orang di ${P.rows.length} teratas`)],
    [h.fmt(P.all_sum), L(`people across all ${h.fmt(P.ranked_total)} dated counts`, `orang di seluruh ${h.fmt(P.ranked_total)} angka bertanggal`)],
    [h.fmt(P.left_out.length), L('bigger figures left out', 'angka lebih besar tidak dihitung')]])}
<section class="pb">
  <h2>${L(`The top ${P.rows.length}`, `${P.rows.length} teratas`)}</h2>
  ${h.bars(P.rows.map((r) => ({ name: r.name, href: h.coHref(r.id), logo: r.logo, v: r.n, text: h.fmt(r.n) })), L('people, latest 2026 count', 'orang, angka 2026 terbaru'))}
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th><th class="n">${L('People', 'Orang')}</th><th>${L('As of', 'Per')}</th><th>${L('What is counted', 'Yang dihitung')}</th><th>${L('Source', 'Sumber')}</th></tr></thead>
    <tbody>${P.rows.map((r, i) => `<tr><td class="rk">${i + 1}</td><td class="co">${h.logo(r)}${h.co(r.id, r.name)}${r.group ? ` <span class="kt">${esc(L('part of ', 'bagian dari ') + r.group)}</span>` : ''}</td><td class="mu">${esc(h.sector(r.sector))}</td><td class="n">${h.fmt(r.n)}</td><td class="mu">${esc(h.ymd(r.asof))}</td><td class="mu">${esc(L(...COUNT[r.kind]))}</td><td>${h.src(r.src, r.src_host)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
<section class="pb">
  <h2>${L('Three ways of counting, labelled on every row', 'Tiga cara menghitung, diberi label di setiap baris')}</h2>
  <p>${L(
    `${h.fmt(k.linkedin || 0)} of the ${h.fmt(P.rows.length)} figures are LinkedIn member counts: the people who list the company as their employer. That is a floor for firms whose couriers, baristas or store staff rarely keep a LinkedIn profile. ${h.fmt(k.revelio || 0)} are Revelio Labs estimates, modelled from public profiles. ${h.fmt((k.filing || 0) + (k.company || 0))} ${(k.filing || 0) + (k.company || 0) === 1 ? 'is' : 'are'} the company’s own count${(k.filing || 0) + (k.company || 0) === 1 ? '' : 's'} in a filing. Read the ranking with that in mind: a courier network counted on LinkedIn can sit below an app company it outnumbers.`,
    `${h.fmt(k.linkedin || 0)} dari ${h.fmt(P.rows.length)} angka adalah jumlah anggota LinkedIn: orang yang mencantumkan perusahaan itu sebagai tempat kerja. Ini batas bawah untuk perusahaan yang kurir, barista, atau staf tokonya jarang punya profil LinkedIn. ${h.fmt(k.revelio || 0)} adalah estimasi Revelio Labs, dimodelkan dari profil publik. ${h.fmt((k.filing || 0) + (k.company || 0))} adalah angka perusahaan sendiri dalam laporan resmi. Baca peringkat ini dengan catatan itu: jaringan kurir yang dihitung lewat LinkedIn bisa berada di bawah perusahaan aplikasi yang jumlah orangnya lebih sedikit.`)}</p>
  ${grouped.length ? `<p>${L(
    `${h.list(grouped.map((r) => h.co(r.id, r.name)))} ${grouped.length === 1 ? 'is' : 'are'} the Indonesian arm of a regional group; the figure is the Indonesian company’s.`,
    `${h.list(grouped.map((r) => h.co(r.id, r.name)))} adalah unit Indonesia dari grup regional; angkanya milik perusahaan di Indonesia.`)}</p>` : ''}
</section>
<section class="pb">
  <h2>${L('Left out, and why', 'Tidak dihitung, dan alasannya')}</h2>
  <p>${L(
    `These companies carry a bigger figure in the census than the last row of the ranking, but the figure has no 2026 date. They return to the ranking when a dated count is found.`,
    `Perusahaan berikut punya angka lebih besar daripada baris terakhir peringkat, tetapi angkanya tidak bertanggal 2026. Mereka masuk lagi ke peringkat begitu ada angka yang bertanggal.`)}</p>
  <div class="tablewrap"><table class="narrow">
    <thead><tr><th>${L('Company', 'Perusahaan')}</th><th class="n">${L('Figure on record', 'Angka tercatat')}</th><th>${L('Why it is not ranked', 'Alasan tidak diperingkat')}</th></tr></thead>
    <tbody>${P.left_out.map((r) => `<tr><td>${h.co(r.id, r.name)}</td><td class="n">${h.fmt(r.n)}</td><td class="mu">${r.why === 'undated' ? L('No date on the figure', 'Angkanya tidak bertanggal') : L(`Dated ${h.ymd(r.asof)}`, `Bertanggal ${h.ymd(r.asof)}`)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
${h.method(L(
    `Ranked: census companies whose headcount carries a date in 2026 and a link to where it was read. One figure per company, the latest on record. ${h.fmt(P.with_figure)} census companies have a headcount of some kind; ${h.fmt(P.ranked_total)} pass the date-and-link rule.`,
    `Diperingkat: perusahaan sensus yang jumlah karyawannya bertanggal 2026 dan punya tautan ke tempat angka itu dibaca. Satu angka per perusahaan, yang terbaru. ${h.fmt(P.with_figure)} perusahaan sensus punya angka karyawan; ${h.fmt(P.ranked_total)} lolos aturan tanggal dan tautan.`))}`;
  },
  related: ['/model', '/coverage'],
};

/* 3 ------------------------------------------------------------------------ */
const investors = {
  slug: 'most-active-startup-investors-indonesia',
  kicker: ['Investors', 'Investor'],
  title: (L) => L('The most active investors in Indonesian startups', 'Investor paling aktif di startup Indonesia'),
  deck: (L, P, h) => L(
    `Counted by how many census startups name each investor. ${h.fmt(P.named)} investors appear; ${h.fmt(P.five_plus)} back five companies or more.`,
    `Dihitung dari jumlah startup sensus yang menyebut tiap investor. ${h.fmt(P.named)} investor tercatat; ${h.fmt(P.five_plus)} mendanai lima perusahaan atau lebih.`),
  answer: (L, P, h) => {
    const a = P.rows[0];
    const nn = P.rows[1].n;
    const second = P.rows.filter((r) => r.n === nn);
    const times = h.fmt(a.n / nn, 1);
    return L(
      `As of ${h.dateLong(P.date)}, ${h.inv(a.slug, a.name)} is named as an investor on ${h.fmt(a.n)} of the ${h.fmt(P.companies)} startups in the 1001startup.id census, ${times} times as many as the next ${second.length > 1 ? 'names' : 'name'}: ${h.list(second.map((r) => h.inv(r.slug, r.name)))}, at ${h.fmt(nn)} each.`,
      `Per ${h.dateLong(P.date)}, ${h.inv(a.slug, a.name)} tercatat sebagai investor di ${h.fmt(a.n)} dari ${h.fmt(P.companies)} startup dalam sensus 1001startup.id, ${times} kali lipat investor berikutnya: ${h.list(second.map((r) => h.inv(r.slug, r.name)))}, masing-masing ${h.fmt(nn)}.`);
  },
  thumb: (P, h) => h.miniBars(P.rows.slice(0, 5).map((r) => ({ name: r.name, v: r.n }))),
  body: (L, P, h) => {
    const r26 = P.rows.filter((r) => r.rounds_2026.length);
    return `
${h.stats([
    [h.fmt(P.named), L('investors named', 'investor tercatat')],
    [h.fmt(P.companies_with_named), L('startups with a named investor', 'startup dengan investor tercatat')],
    [h.fmt(P.five_plus), L('back five or more', 'mendanai lima atau lebih')],
    [h.fmt(P.one_company), L('back just one', 'hanya mendanai satu')]])}
<section class="pb">
  <h2>${L(`The ${P.rows.length} most active`, `${P.rows.length} paling aktif`)}</h2>
  ${h.bars(P.rows.map((r) => ({ name: r.name, href: h.invHref(r.slug), v: r.n, text: h.fmt(r.n) })), L('census startups backed', 'startup sensus yang didanai'))}
  <div class="tablewrap"><table>
    <thead><tr><th>#</th><th>${L('Investor', 'Investor')}</th><th class="n">${L('Startups', 'Startup')}</th><th>${L('Most backed sector', 'Sektor terbanyak')}</th><th>${L('Largest by funding', 'Terbesar menurut pendanaan')}</th></tr></thead>
    <tbody>${P.rows.map((r, i) => `<tr><td class="rk">${i + 1}</td><td>${h.inv(r.slug, r.name)}</td><td class="n">${h.fmt(r.n)}</td><td class="mu">${esc(h.sector(r.top_sector))} (${h.fmt(r.top_sector_n)})</td><td class="co">${r.biggest.map((c) => `<span class="pc">${h.logo(c)}${h.co(c.id, c.name)}</span>`).join('')}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
<section class="pb">
  <h2>${L('A long tail of one-company backers', 'Ekor panjang investor satu perusahaan')}</h2>
  <p>${L(
    `${h.fmt(P.one_company)} of the ${h.fmt(P.named)} investors appear on a single census company, often an angel, a corporate partner or a foreign fund making its one Indonesian bet. Only ${h.fmt(P.five_plus)} back five or more.`,
    `${h.fmt(P.one_company)} dari ${h.fmt(P.named)} investor hanya muncul di satu perusahaan sensus, sering kali angel investor, mitra korporat, atau dana asing dengan satu taruhan di Indonesia. Hanya ${h.fmt(P.five_plus)} yang mendanai lima perusahaan atau lebih.`)}</p>
</section>
${r26.length ? `<section class="pb">
  <h2>${L('Who is in this year’s rounds', 'Siapa saja di putaran tahun ini')}</h2>
  <p>${L(
    `${h.fmt(r26.length)} of these ${h.fmt(P.rows.length)} investors back a company whose latest round is dated 2026: ${h.list(r26.map((r) => `${h.inv(r.slug, r.name)} (${h.list(r.rounds_2026.map((c) => h.co(c.id, c.name)))})`))}.`,
    `${h.fmt(r26.length)} dari ${h.fmt(P.rows.length)} investor ini mendanai perusahaan yang putaran terakhirnya bertanggal 2026: ${h.list(r26.map((r) => `${h.inv(r.slug, r.name)} (${h.list(r.rounds_2026.map((c) => h.co(c.id, c.name)))})`))}.`)} ${h.postLink('indonesian-startup-funding-rounds-2026', L('All 2026 rounds', 'Semua putaran 2026'))}</p>
</section>` : ''}
${h.method(L(
    `An investor counts once per company it is named on, however many rounds it joined. Names are read from each company’s census row, where the sources are; spelling variants are merged by the same rule as the investor pages. A fund that backs many companies outside the census can rank lower here than its real portfolio.`,
    `Investor dihitung sekali untuk setiap perusahaan yang menyebut namanya, berapa pun putaran yang diikutinya. Nama dibaca dari baris sensus tiap perusahaan, tempat sumbernya berada; variasi ejaan digabung dengan aturan yang sama seperti halaman investor. Dana yang banyak mendanai perusahaan di luar sensus bisa berperingkat lebih rendah di sini daripada portofolio sebenarnya.`))}`;
  },
  related: ['/investors', '/report/2026-10'],
};

/* 4 ------------------------------------------------------------------------ */
const shutdowns = {
  slug: 'indonesian-startups-that-shut-down',
  kicker: ['Shutdowns', 'Penutupan'],
  title: (L, P) => L(`${P.rows.length} Indonesian startups that shut down, ${P.first_year}–${P.last_year}`, `${P.rows.length} startup Indonesia yang tutup, ${P.first_year}–${P.last_year}`),
  deck: (L, P, h) => L(
    `The census shutdown register, year by year: who stopped, what they had raised, and the record each closure rests on.`,
    `Daftar penutupan sensus, tahun demi tahun: siapa yang berhenti, berapa dana yang pernah dihimpun, dan catatan yang menjadi dasarnya.`),
  answer: (L, P, h) => {
    const t = P.top_funded[0];
    return L(
      `As of ${h.dateLong(P.date)}, the 1001startup.id shutdown register lists ${h.fmt(P.rows.length)} Indonesian startups that stopped operating between ${P.first_year} and ${P.last_year}. ${P.worst_year} was the worst year, with ${h.fmt(P.worst_n)}. The ${h.fmt(P.funded)} with a disclosed funding figure had raised ${h.usdM(P.funded_usd_m)} between them, led by ${h.closedCo(t.slug, t.name)} (${h.usdM(t.usd_m)}, ended ${h.ymd(t.ended)}).`,
      `Per ${h.dateLong(P.date)}, daftar penutupan 1001startup.id memuat ${h.fmt(P.rows.length)} startup Indonesia yang berhenti beroperasi antara ${P.first_year} dan ${P.last_year}. ${P.worst_year} tahun terburuknya, dengan ${h.fmt(P.worst_n)} penutupan. ${h.fmt(P.funded)} yang punya angka pendanaan diumumkan telah menghimpun ${h.usdM(P.funded_usd_m)}, dipimpin ${h.closedCo(t.slug, t.name)} (${h.usdM(t.usd_m)}, berakhir ${h.ymd(t.ended)}).`);
  },
  thumb: (P, h) => h.yearCols(P.by_year, P.first_year, P.last_year, true),
  body: (L, P, h) => {
    const s = P.by_sector;
    const acq = P.rows.filter((r) => r.fate !== 'closed');
    return `
${h.stats([
    [h.fmt(P.rows.length), L('startups shut down', 'startup tutup')],
    [h.fmt(P.worst_n), L(`in ${P.worst_year}, the worst year`, `pada ${P.worst_year}, tahun terburuk`)],
    [h.usdTile(P.funded_usd_m), L(`raised by the ${P.funded} with a figure`, `dihimpun ${P.funded} yang punya angka`)],
    [`${h.fmt(P.confirmed)} / ${h.fmt(P.reported)}`, L('confirmed / reported', 'terkonfirmasi / dilaporkan')]])}
<section class="pb">
  <h2>${L('Closures by year', 'Penutupan per tahun')}</h2>
  ${h.yearCols(P.by_year, P.first_year, P.last_year)}
  <p>${L(
    `${h.sector(s[0].sector)} took the most closures, ${h.fmt(s[0].n)} of ${h.fmt(P.rows.length)}, then ${h.sector(s[1].sector)} with ${h.fmt(s[1].n)} and ${h.sector(s[2].sector)} with ${h.fmt(s[2].n)}.${acq.length ? ` ${h.list(acq.map((r) => h.closedCo(r.slug, r.name)))} ${acq.length === 1 ? 'was' : 'were'} acquired first and closed after.` : ''}`,
    `${h.sector(s[0].sector)} paling banyak tutup, ${h.fmt(s[0].n)} dari ${h.fmt(P.rows.length)}, disusul ${h.sector(s[1].sector)} dengan ${h.fmt(s[1].n)} dan ${h.sector(s[2].sector)} dengan ${h.fmt(s[2].n)}.${acq.length ? ` ${h.list(acq.map((r) => h.closedCo(r.slug, r.name)))} diakuisisi lebih dulu, lalu ditutup.` : ''}`)}</p>
</section>
<section class="pb">
  <h2>${L('The money that went with them', 'Dana yang ikut hilang')}</h2>
  ${h.bars(P.top_funded.map((r) => ({ name: r.name, href: h.closedHref(r.slug), v: r.usd_m, text: h.usdShort(r.usd_m) })), L('US$ million raised before closing', 'juta US$ yang dihimpun sebelum tutup'))}
  <p>${L(
    `${h.fmt(P.funded)} of the ${h.fmt(P.rows.length)} had announced how much they raised. The other ${h.fmt(P.rows.length - P.funded)} are not zero: their rounds were never given a figure, so the ${h.usdM(P.funded_usd_m)} is a floor.`,
    `${h.fmt(P.funded)} dari ${h.fmt(P.rows.length)} pernah mengumumkan berapa dana yang dihimpun. ${h.fmt(P.rows.length - P.funded)} lainnya bukan nol: putaran mereka tidak pernah diberi angka, jadi ${h.usdM(P.funded_usd_m)} adalah batas bawah.`)}</p>
</section>
<section class="pb">
  <h2>${L('All closures on record', 'Semua penutupan yang tercatat')}</h2>
  <div class="tablewrap"><table>
    <thead><tr><th>${L('Company', 'Perusahaan')}</th><th>${L('Sector', 'Sektor')}</th><th>${L('City', 'Kota')}</th><th class="n">${L('Founded', 'Berdiri')}</th><th class="n">${L('Ended', 'Berakhir')}</th><th class="n">${L('Raised, US$M', 'Dana, juta US$')}</th><th>${L('Source', 'Sumber')}</th></tr></thead>
    <tbody>${P.rows.map((r) => `<tr><td>${h.closedCo(r.slug, r.name)}${r.confidence !== 'confirmed' ? ` <span class="kt">${esc(L('reported', 'dilaporkan'))}</span>` : ''}</td><td class="mu">${esc(h.sector(r.sector))}</td><td class="mu">${esc(String(r.city).split(' (')[0])}</td><td class="n">${esc(r.founded || '—')}</td><td class="n">${esc(h.ymd(r.ended))}</td><td class="n">${r.usd_m != null ? h.usdShort(r.usd_m) : '—'}</td><td>${h.src(r.src, r.src_host)}</td></tr>`).join('')}</tbody>
  </table></div>
</section>
${h.method(L(
    `A startup is on the register when a regulator, a court, the company or credible press says it stopped operating. <b>Confirmed</b> means the company or a primary record says so; <b>reported</b> means credible press says so and the company has not. The source column links the first record behind each row; the company page carries the full story and every source.`,
    `Startup masuk daftar bila regulator, pengadilan, perusahaannya sendiri, atau pers kredibel menyatakan bahwa ia berhenti beroperasi. <b>Terkonfirmasi</b> berarti perusahaan atau catatan primer menyatakannya; <b>dilaporkan</b> berarti pers kredibel menyatakannya dan perusahaan belum. Kolom sumber menautkan catatan pertama di balik tiap baris; halaman perusahaan memuat cerita lengkap dan semua sumbernya.`))}`;
  },
  related: ['/closed', '/report/2026-10'],
};

const POSTS = [rounds, employers, investors, shutdowns];
module.exports = { POSTS };
