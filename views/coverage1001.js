'use strict';
/* 1001startup.id — coverage: what the census contains, and where the line is.
 *
 * These sections lived on the landing page until Luca called them out
 * (Aug 30 2026): registry tables are reference material, not a front page.
 * They move here INTACT rather than being cut, because each one exists by an
 * earlier rule of the census — a deliberate exclusion published so it cannot
 * be mistaken for a gap (the Superbank lesson: a scope decision that exists
 * only in a script is indistinguishable, from the outside, from ignorance).
 *
 *   #valuation — what the combined-valuation figure actually contains
 *   #funding   — what the disclosed-funding total contains, and what it is not
 *   #sectors   — the census grouped by what companies build
 *   #yc        — the Y Combinator cohort, and who is deliberately not counted
 *   #endeavor  — the Endeavor Entrepreneur companies, and the roster gap
 *   #scope     — the inclusion rule, and every name considered against it
 *   #output    — what the output figure is (moved off the landing Aug 31 2026,
 *                same call: method prose is reference material, not a front page)
 *   #method    — how the numbers are made, and the caveats
 *
 * The landing keeps one line pointing here; the nav dropdowns point at the
 * anchors. Server-rendered from census.json per request, like the landing.
 *
 * BILINGUAL (Aug 31 2026): the page frame translates via L(en, id) from
 * i18n1001; prose that comes out of census.json (rules, reasons, notes,
 * blurbs, caveats) is the sourced working record and stays as written. */
const { esc } = require('../lib/util');
const { V } = require('./html');
const NAV = require('./nav1001'); // one header for every 1001 page
const GVA = require('./gva');     // the one explanation of Output, shared with the landing and the profile card
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001');

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';

function coverage({ data, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const fmt = (n, d = 0) => (n === null || n === undefined) ? '—'
    : n.toLocaleString('en-US', { maximumFractionDigits: d });
  const money = (n) => (n === null || n === undefined) ? '—'
    : n >= 10 ? fmt(n, Number.isInteger(n) ? 0 : 1) : n >= 1 ? fmt(n, 1) : fmt(n, 2);
  const usdB = (m) => 'US$' + ((m || 0) / 1000).toFixed(1) + 'B';
  const T = (data && data.totals) || {};
  const companies = (data && data.companies) || [];
  const m = (data && data.method) || {};
  const bySector = (data && data.by_sector) || [];
  /* label -> sector_key, so each sector cell can link to its /sector page
     (misc carries two labels — Other tech and Insurtech — both land on the
     same page, which is where that bucket actually lives) */
  const secKey = {};
  for (const c of (data && data.companies) || []) {
    if (c.sector_label && c.sector_key) secKey[c.sector_label] = c.sector_key;
  }
  const YC = (data && data.yc) || {};
  const ED = (data && data.endeavor) || {};
  const AN = (data && data.antler) || {};
  const VAL = (data && data.valuation) || {};
  const SC = (data && data.scope) || {};

  const valuationSection = VAL.marked ? `
  <section class="wrap" id="valuation">
    <div class="eyebrow"><span class="sq"></span>${L('WHAT THE COMBINED VALUATION CONTAINS', 'APA ISI VALUASI GABUNGAN')}</div>
    <p class="lede" style="margin-bottom:10px"><a href="${PF}/unicorn">${L('The companies valued at US$1B or more →', 'Perusahaan dengan valuasi US$1 miliar ke atas →')}</a></p>
    <p class="lede">${L(`${fmt(VAL.with_mark)} of the ${fmt(T.companies)} companies carry a valuation we could source.
    ${(VAL.excluded || []).length ? `${fmt((VAL.excluded || []).length)} of them sit inside a parent counted on its own row, so ` : ''}${fmt(VAL.marked)} marks
    add to <strong>${usdB(VAL.combined_usd_m)}</strong> — the combined-valuation figure on the
    <a href="${PF}/">front page</a>. The other
    ${fmt(T.companies - VAL.with_mark)} rows carry no public figure, and none is inferred from funding, headcount or
    output, so this is a sum over ${Math.round((VAL.with_mark / T.companies) * 100)}% of the census rather than a reading
    of the whole ecosystem. Each mark is taken at the entity its source values, so a group listing covers operations
    outside Indonesia too.`,
    `Dari ${fmt(T.companies)} perusahaan terdata, ${fmt(VAL.with_mark)} membawa valuasi yang bisa kami telusuri sumbernya.
    ${(VAL.excluded || []).length ? `${fmt((VAL.excluded || []).length)} di antaranya berada di dalam induk yang sudah dihitung pada barisnya sendiri, sehingga ` : ''}${fmt(VAL.marked)} angka valuasi
    dijumlahkan menjadi <strong>${usdB(VAL.combined_usd_m)}</strong> — angka valuasi gabungan di
    <a href="${PF}/">halaman depan</a>. ${fmt(T.companies - VAL.with_mark)} baris sisanya tidak membawa angka publik,
    dan tidak satu pun kami taksir dari pendanaan, jumlah pekerja, atau output; angka ini adalah penjumlahan atas
    ${Math.round((VAL.with_mark / T.companies) * 100)}% isi sensus, bukan pembacaan atas seluruh ekosistem. Setiap
    angka valuasi diambil pada entitas yang dinilai sumbernya, sehingga pencatatan sebuah grup di bursa ikut mencakup
    operasi di luar Indonesia.`)}</p>
    <div class="grid vg">
      <div class="cell"><div class="t">${usdB(VAL.listed_usd_m)}</div>
        <div class="d mono">${L(`Live market capitalisation · ${VAL.listed_count} listed companies`, `Kapitalisasi pasar terkini · ${VAL.listed_count} emiten`)}</div>
        <div class="dd">${L(`Priced daily on IDX and HKEX, read on the date in each row's note.`, `Harganya bergerak harian di BEI dan HKEX; kami membacanya pada tanggal yang tertera di catatan tiap baris.`)}</div></div>
      <div class="cell"><div class="t">${usdB(VAL.unlisted_usd_m)}</div>
        <div class="d mono">${L(`Private marks${VAL.est_counted ? ' and estimates' : ''} · ${VAL.unlisted_count} companies`, `Valuasi privat${VAL.est_counted ? ' dan estimasi' : ''} · ${VAL.unlisted_count} perusahaan`)}</div>
        <div class="dd">${L(`Priced rounds, stake purchases and trackers' reported figures.${VAL.oldest_asof ? ` The oldest dates to ${VAL.oldest_asof}${VAL.undated ? `, and ${fmt(VAL.undated)} carries no dated mark at all` : ''}; a private company is worth what someone last paid, and that can be years stale.` : ''}`,
        `Putaran pendanaan yang menetapkan harga, pembelian saham, dan angka yang dilaporkan tracker.${VAL.oldest_asof ? ` Yang tertua tertanggal ${VAL.oldest_asof}${VAL.undated ? `, dan ${fmt(VAL.undated)} baris bahkan tidak membawa tanggal sama sekali` : ''}; nilai perusahaan privat adalah harga terakhir yang dibayar orang, dan harga itu bisa saja sudah bertahun-tahun usang.` : ''}`)}</div></div>
      ${VAL.top && VAL.top.length ? `<div class="cell"><div class="t">${Math.round((VAL.top.reduce((n, x) => n + x.usd_m, 0) / VAL.combined_usd_m) * 100)}%</div>
        <div class="d mono">${L('Sits in the three largest rows', 'Terkonsentrasi di tiga baris terbesar')}</div>
        <div class="dd">${VAL.top.map((x) => esc(x.name.replace(/\s*\(.*\)$/, ''))).join(' · ')}. ${L(`A handful of large marks move this
        total far more than the long tail does.`, `Segelintir valuasi jumbo menggerakkan total ini jauh lebih kuat ketimbang ekor panjangnya.`)}</div></div>` : ''}
      <div class="cell"><div class="t">${fmt(T.companies - VAL.with_mark)}</div>
        <div class="d mono">${L('No mark on record', 'Tanpa valuasi tercatat')}</div>
        <div class="dd">${L(`Including companies that have raised well over US$100M. Filter the
        <a href="${PF}/#companies">census table</a> with <em>Valuation on record</em> to see the ${fmt(VAL.with_mark)} rows
        that carry one.`,
        `Termasuk perusahaan yang menghimpun jauh di atas US$100 juta. Saring
        <a href="${PF}/#companies">tabel sensus</a> dengan filter <em>Ada valuasi tercatat</em> untuk melihat ${fmt(VAL.with_mark)} baris
        yang membawanya.`)}</div></div>
    </div>
    ${(VAL.excluded || []).length ? `<div class="tablewrap out">
      <table>
        <thead><tr><th>${L('Held out of the sum', 'Dikeluarkan dari penjumlahan')}</th><th class="n">US$M</th><th>${L('Already inside', 'Sudah termuat di')}</th><th>${L('Why', 'Alasan')}</th></tr></thead>
        <tbody>${VAL.excluded.map((x) => `<tr>
          <td>${esc(x.name)}</td>
          <td class="n mono">${money(x.usd_m)}</td>
          <td class="mu">${esc(x.parent || '')}</td>
          <td class="mu">${esc(x.note || '')}</td></tr>`).join('')}</tbody>
      </table></div>
    <div class="foot-note mono">${L(`These ${(VAL.excluded || []).length} rows keep their own valuation in the census table and are
    excluded here only from the combined figure — counting a subsidiary and the parent whose market capitalisation
    contains it would book the same value twice.`,
    `${(VAL.excluded || []).length} baris ini tetap membawa valuasinya sendiri di tabel sensus dan hanya dikeluarkan
    dari angka gabungan — menghitung anak usaha sekaligus induk yang kapitalisasi pasarnya sudah memuat anak itu
    berarti membukukan nilai yang sama dua kali.`)}</div>` : ''}
  </section>` : '';

  /* WHAT THE DISCLOSED-FUNDING TOTAL CONTAINS. The valuation register above exists because
     a headline number nobody can take apart is a number nobody should trust; the funding
     total had never been given the same treatment, and it needed it more — over a third of
     it is a floor rather than a total, and until Aug 30 2026 a third of the census carried
     an empty funding cell that said nothing about why it was empty. */
  const FU = (data && data.funding) || {};
  const fundingSection = FU.with_figure ? `
  <section class="wrap" id="funding">
    <div class="eyebrow"><span class="sq"></span>${L('WHAT THE DISCLOSED-FUNDING TOTAL CONTAINS', 'APA ISI TOTAL PENDANAAN YANG DIUMUMKAN')}</div>
    <p class="lede">${L(`${fmt(FU.with_figure)} of the ${fmt(T.companies)} companies carry a funding figure, and they add to
    <strong>${usdB(FU.total_usd_m)}</strong> — the disclosed-funding figure on the <a href="${PF}/">front page</a>.
    All ${fmt(FU.sourced)} of them link to the source that carries the number${FU.tracker_count ? `, though ${fmt(FU.tracker_count)} of those links
    go to a data provider rather than a round announcement and are marked <span class="estt">trk</span>` : ''}. What the total is
    NOT is a measure of how much money the ecosystem has raised:
    ${Math.round((FU.floor_usd_m / FU.total_usd_m) * 100)}% of it is a floor rather than a total, the largest single
    category in the census is companies that raised and never said how much, and no figure here is ever inferred from
    headcount, valuation or a company's size. Every one of the ${fmt(FU.dashed)} rows without a figure now says which
    of the four reasons applies to it${FU.unexplained ? `, except ${fmt(FU.unexplained)} still being worked through` : ' — none is simply blank'}.`,
    `Dari ${fmt(T.companies)} perusahaan terdata, ${fmt(FU.with_figure)} membawa angka pendanaan, dan jumlahnya
    <strong>${usdB(FU.total_usd_m)}</strong> — itulah angka pendanaan diumumkan yang tampil di <a href="${PF}/">halaman depan</a>.
    Seluruh ${fmt(FU.sourced)} baris itu menautkan sumber yang memuat angkanya${FU.tracker_count ? `, meski ${fmt(FU.tracker_count)} tautan di antaranya
    mengarah ke penyedia data, bukan pengumuman putaran pendanaan, dan diberi label <span class="estt">trk</span>` : ''}. Yang BUKAN isi total ini:
    ukuran berapa banyak uang yang telah dihimpun ekosistem.
    Sebanyak ${Math.round((FU.floor_usd_m / FU.total_usd_m) * 100)}% dari nilainya adalah batas bawah, bukan total;
    kategori tunggal terbesar di sensus justru perusahaan yang menghimpun dana tanpa pernah menyebut jumlahnya; dan
    tidak ada angka di sini yang kami taksir dari jumlah pekerja, valuasi, atau ukuran perusahaan. Ke-${fmt(FU.dashed)} baris
    tanpa angka kini masing-masing menyebut mana dari empat alasan yang berlaku padanya${FU.unexplained ? `, kecuali ${fmt(FU.unexplained)} yang masih kami periksa` : ' — tidak ada yang dibiarkan kosong begitu saja'}.`)}</p>
    <div class="grid vg fg">
      <div class="cell"><div class="t">${usdB(FU.floor_usd_m)}</div>
        <div class="d mono">${L(`Is a floor, not a total · ${fmt(FU.floor_count)} companies`, `Batas bawah, bukan total · ${fmt(FU.floor_count)} perusahaan`)}</div>
        <div class="dd">${L(`Each of these rows has at least one other round that was announced without an amount, so the
        company raised this much and an unknown amount more. Marked <span class="estt kind">min</span> in the table.`,
        `Tiap baris ini punya setidaknya satu putaran pendanaan lain yang diumumkan tanpa nominal — perusahaan
        menghimpun sebesar ini plus entah berapa lagi. Diberi label <span class="estt kind">min</span> di tabel.`)}</div></div>
      <div class="cell"><div class="t">${fmt(FU.undisclosed)}</div>
        <div class="d mono">${L('Raised, but never told anyone how much', 'Menghimpun dana, tapi tak pernah menyebut jumlahnya')}</div>
        <div class="dd">${L(`A round these companies demonstrably closed — an investor names it, the company announced it —
        with no amount in any source. This is the single most common answer in Indonesian venture, and it is why the
        column undercounts the ecosystem rather than describing it.`,
        `Putaran pendanaan yang terbukti ditutup perusahaan-perusahaan ini — investornya menyebut, perusahaannya
        mengumumkan — tanpa nominal di sumber mana pun. Inilah jawaban paling lazim di dunia ventura Indonesia, dan
        karena itulah kolom ini menghitung ekosistem terlalu rendah, bukan memotretnya.`)}</div></div>
      <div class="cell"><div class="t">${fmt(FU.none_on_record)}</div>
        <div class="d mono">${L('No outside round exists', 'Tidak ada putaran pendanaan dari luar')}</div>
        <div class="dd">${L(`Bootstrapped, cashflow-grown or family-financed. The dash here means something different from
        the dash above, and each row says which searches establish it.`,
        `Bootstrapped, tumbuh dari arus kas, atau dibiayai keluarga. Tanda pisah di sini berbeda makna dari tanda
        pisah di atas, dan tiap baris menyebut penelusuran mana yang menetapkannya.`)}</div></div>
      <div class="cell"><div class="t">${fmt(FU.parent_funded)}</div>
        <div class="d mono">${L('Funded by a parent, not in Indonesia', 'Didanai induk, bukan di Indonesia')}</div>
        <div class="dd">${L(`Shopee, Lazada, TikTok and the like. Group capital raised in Singapore, Hangzhou or Beijing is
        not an Indonesian figure, so it is named in the row and left out of the total.`,
        `Shopee, Lazada, TikTok, dan sejenisnya. Modal grup yang dihimpun di Singapura, Hangzhou, atau Beijing bukan
        angka Indonesia, jadi ia disebut di barisnya dan dikeluarkan dari total.`)}</div></div>
      ${FU.listed_count ? `<div class="cell"><div class="t">${usdB(FU.listed_usd_m)}</div>
        <div class="d mono">${L(`Came from a public market · ${fmt(FU.listed_count)} companies`, `Datang dari pasar modal · ${fmt(FU.listed_count)} perusahaan`)}</div>
        <div class="dd">${L(`IPO proceeds rather than a private round, marked <span class="estt kind">ipo</span>. They are in
        the total because they are money the company raised, but they are a different kind of event from a Series A.`,
        `Dana hasil IPO, bukan putaran pendanaan privat; diberi label <span class="estt kind">ipo</span>. Masuk total
        karena tetap uang yang dihimpun perusahaan, tapi jenis peristiwanya berbeda dari Series A.`)}</div></div>` : ''}
      ${FU.other_capital ? `<div class="cell"><div class="t">${fmt(FU.other_capital)}</div>
        <div class="d mono">${L('Took capital of a kind this column does not hold', 'Menerima modal jenis lain yang tak dimuat kolom ini')}</div>
        <div class="dd">${L(`An IPO or rights issue, a grant, or a loan facility — real money, sourced, and set out in each
        row's note with its date and its size, but not an equity round. Counting a bank's recapitalisation or a
        climate grant as venture funding would make the total mean less, not more.`,
        `IPO atau rights issue, hibah, atau fasilitas pinjaman — uang sungguhan, ada sumbernya, dan dirinci di catatan
        tiap barisnya lengkap dengan tanggal dan nilai, tapi bukan putaran ekuitas. Menghitung rekapitalisasi bank atau
        hibah iklim sebagai pendanaan ventura justru mengurangi makna total ini, bukan menambahnya.`)}</div></div>` : ''}
    </div>
    ${(FU.floors || []).length ? `<div class="tablewrap out">
      <table>
        <thead><tr><th>${L('Figure is a floor', 'Angkanya batas bawah')}</th><th class="n">US$M</th><th>${L('What is missing from it', 'Apa yang belum terhitung di dalamnya')}</th></tr></thead>
        <tbody>${FU.floors.map((x) => `<tr>
          <td><a class="cp-link" href="${PF}/company/${esc(x.id)}">${esc(x.name)}</a></td>
          <td class="n mono">${money(x.usd_m)}</td>
          <td class="mu">${esc(x.why)}</td></tr>`).join('')}</tbody>
      </table></div>
    <div class="foot-note mono">${L(`These ${fmt(FU.floors.length)} rows keep their figure in the census table — it is
    sourced and real — and are listed here because reading it as a total overstates what the census knows.${FU.unexplained ? ` ${fmt(FU.unexplained)} rows still carry a funding cell with no explanation behind it; they are being worked through.` : ''}`,
    `${fmt(FU.floors.length)} baris ini tetap membawa angkanya di tabel sensus — bersumber dan nyata — dan dicantumkan
    di sini karena membacanya sebagai total melebih-lebihkan apa yang sensus ketahui.${FU.unexplained ? ` ${fmt(FU.unexplained)} baris masih membawa sel pendanaan tanpa penjelasan di baliknya; sedang kami periksa satu per satu.` : ''}`)}</div>` : ''}
  </section>` : '';

  const sectorsSection = bySector.length ? `
  <section class="wrap" id="sectors">
    <div class="eyebrow"><span class="sq"></span>${L('BY SECTOR', 'PER SEKTOR')}</div>
    <div class="grid">
      ${bySector.map((s) => {
        const k = secKey[s.name];
        const inner = `<div class="t">${esc(s.name)}${k ? ' <span class="goarrow">→</span>' : ''}</div><div class="d mono">${L(`${s.count} companies · ${fmt(s.jobs)} jobs est · IDR ${fmt(s.gva_idr_bn)} bn/yr est`, `${s.count} perusahaan · ${fmt(s.jobs)} lapangan kerja est · IDR ${fmt(s.gva_idr_bn)} mlr/thn est`)}</div>`;
        return k ? `<a class="cell scell" href="${PF}/sector/${esc(k)}">${inner}</a>` : `<div class="cell">${inner}</div>`;
      }).join('')}
    </div>
  </section>` : '';

  const ycSection = YC.by_batch && YC.by_batch.length ? `
  <section class="wrap" id="yc">
    <div class="eyebrow"><span class="sq"></span>${L('Y COMBINATOR — THE INDONESIAN COHORT', 'Y COMBINATOR — KOHOR INDONESIA')}</div>
    <p class="lede">${L(`${fmt((YC.in_census || 0) + (YC.outside || []).length)} companies in Y Combinator's directory carry Indonesia
    in their location or region tags${YC.source && YC.source.checked ? ` (checked ${esc(YC.source.checked)})` : ''}.
    ${fmt(YC.in_census)} of them operate inside the census area and are counted — filter the
    <a href="${PF}/#companies">census table</a> with the <em>Y Combinator only</em> button.
    The remaining ${(YC.outside || []).length} are listed below with the reason they are not counted,
    so the gap is stated rather than hidden.`,
    `${fmt((YC.in_census || 0) + (YC.outside || []).length)} perusahaan di direktori Y Combinator mencantumkan Indonesia
    pada tag lokasi atau kawasannya${YC.source && YC.source.checked ? ` (dicek ${esc(YC.source.checked)})` : ''}.
    ${fmt(YC.in_census)} di antaranya beroperasi di dalam wilayah sensus dan ikut dihitung — saring
    <a href="${PF}/#companies">tabel sensus</a> dengan tombol <em>Y Combinator saja</em>.
    ${(YC.outside || []).length} sisanya tercantum di bawah beserta alasan mereka tidak dihitung —
    celahnya dinyatakan, bukan disembunyikan.`)}</p>
    <div class="grid ycg">
      ${YC.by_batch.map((b) => `<div class="cell"><div class="t mono">${esc(b.batch)} · ${b.names.length}</div><div class="d">${b.names.map(esc).join(' · ')}</div></div>`).join('')}
    </div>
    ${(YC.outside || []).length ? `<div class="tablewrap out"><table>
      <thead><tr><th>${L('Not counted', 'Tidak dihitung')}</th><th>Batch</th><th>${L('Where it actually sits', 'Lokasi sebenarnya')}</th><th>${L('Why not', 'Alasan')}</th></tr></thead>
      <tbody>${YC.outside.map((o) => `<tr>
        <td>${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>` : esc(o.name)}</td>
        <td class="mu mono">${esc(o.yc_batch || '')}</td>
        <td class="mu">${esc(o.city || '')}</td>
        <td class="mu">${esc(o.reason || '')}${o.note ? ` — ${esc(o.note)}` : ''}</td></tr>`).join('')}</tbody>
    </table></div>` : ''}
  </section>` : '';

  const endeavorSection = ED.companies && ED.companies.length ? `
  <section class="wrap" id="endeavor">
    <div class="eyebrow"><span class="sq"></span>${L('ENDEAVOR — THE SELECTED FOUNDERS', 'ENDEAVOR — PARA FOUNDER TERPILIH')}</div>
    <p class="lede">${L(`Endeavor selects <em>entrepreneurs</em>, not companies: founders pass an International Selection
    Panel and join the network for life, and their company joins Endeavor Indonesia's roster.
    That roster holds ${fmt((ED.source && ED.source.roster_count) || ((ED.in_census || 0) + (ED.pending || []).length))} companies${ED.source && ED.source.checked ? `, read from Endeavor's own site on ${esc(ED.source.checked)}` : ''} —
    ${fmt(ED.in_census)} of them are in <a href="${PF}/#companies">this census</a> and carry the badge; filter to them with the
    <em>Endeavor only</em> button.`,
    `Endeavor memilih <em>entrepreneur</em>, bukan perusahaan: founder lolos International Selection
    Panel, bergabung ke jaringannya seumur hidup, dan perusahaannya masuk roster Endeavor Indonesia.
    Roster itu memuat ${fmt((ED.source && ED.source.roster_count) || ((ED.in_census || 0) + (ED.pending || []).length))} perusahaan${ED.source && ED.source.checked ? `, kami baca langsung dari situs Endeavor pada ${esc(ED.source.checked)}` : ''} —
    ${fmt(ED.in_census)} di antaranya ada di <a href="${PF}/#companies">sensus ini</a> dan menyandang badge; saring lewat
    tombol <em>Endeavor saja</em>.`)}</p>
    <div class="grid edg">
      ${ED.companies.map((e) => `<div class="cell"><div class="t mono">${esc(e.name)}${e.year ? ` · ${e.year}` : ''}</div><div class="d">${e.who && e.who.length ? esc(e.who.join(' · ')) : '&nbsp;'}</div></div>`).join('')}
    </div>
    ${(ED.pending || []).length ? `
    <div class="eyebrow sub"><span class="sq"></span>${L('ON THE ROSTER, NOT YET IN THE CENSUS', 'DI ROSTER, BELUM MASUK SENSUS')} · ${(ED.pending || []).length}</div>
    <p class="lede sm">${L(`Each still needs the same check every counted row gets — is it headquartered in Greater Jakarta,
    the Bandung basin or south Bali (Sarbagita), and is it operating today. Some plainly sit elsewhere (Singapore, Surabaya); others look like
    genuine gaps in this census. Listed here so the shortfall is visible rather than quietly missing.`,
    `Masing-masing masih harus melewati pemeriksaan yang sama dengan setiap baris terhitung — apakah berkantor pusat
    di Jabodetabek, cekungan Bandung, atau Bali bagian selatan (Sarbagita), dan apakah masih beroperasi hari ini.
    Sebagian jelas berada di tempat lain (Singapura, Surabaya); sebagian lagi tampak seperti celah nyata sensus ini.
    Dicantumkan di sini agar kekurangannya terlihat, bukan hilang diam-diam.`)}</p>
    <div class="tablewrap out"><table>
      <thead><tr><th>${L(`On Endeavor's roster`, 'Di roster Endeavor')}</th><th>${L('What Endeavor says it does', 'Bisnisnya menurut Endeavor')}</th></tr></thead>
      <tbody>${ED.pending.map((o) => `<tr>
        <td><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a></td>
        <td class="mu">${esc(o.blurb || '')}</td></tr>`).join('')}</tbody>
    </table></div>` : ''}
  </section>` : '';

  const antlerSection = (AN.in_census || (AN.pending || []).length) ? `
  <section class="wrap" id="antler">
    <div class="eyebrow"><span class="sq"></span>${L('ANTLER — THE RESIDENCY COHORTS', 'ANTLER — KOHOR RESIDENSI')}</div>
    <p class="lede">${L(`Antler has run Jakarta residencies since 2022 (cohorts ID1 onwards; first checks of
    US$110-125K in 2022-2024, US$85K plus a follow-on match today) and wrote its first Indonesian checks from
    Singapore before that. The evidenced roster holds
    ${fmt((AN.source && AN.source.roster_count) || ((AN.in_census || 0) + (AN.pending || []).length + (AN.outside || []).length))} companies${AN.source && AN.source.checked ? `, read from Antler's own directory, demo days and batch announcements on ${esc(AN.source.checked)}` : ''} —
    a floor, not a ceiling: the late-2022 funded batch was never published and early deaths drop off Antler's
    directory. ${fmt(AN.in_census)} roster ${AN.in_census === 1 ? 'company is' : 'companies are'} in <a href="${PF}/#companies">this census</a> and carry the badge; filter to them
    with the <em>Antler only</em> button. An Antler check alone does not create a census row — every row still has
    to pass the same entity, headcount and liveness tests.`,
    `Antler menjalankan residensi Jakarta sejak 2022 (kohor ID1 dan seterusnya; cek pertama
    US$110-125K pada 2022-2024, kini US$85K plus dana pendamping lanjutan) dan menulis cek Indonesia pertamanya dari
    Singapura sebelum itu. Roster berbasis bukti memuat
    ${fmt((AN.source && AN.source.roster_count) || ((AN.in_census || 0) + (AN.pending || []).length + (AN.outside || []).length))} perusahaan${AN.source && AN.source.checked ? `, kami baca dari direktori Antler sendiri, demo day, dan pengumuman batch per ${esc(AN.source.checked)}` : ''} —
    batas bawah, bukan langit-langit: batch yang didanai pada akhir 2022 tak pernah dipublikasikan, dan yang gugur lebih awal
    menghilang dari direktori Antler. ${fmt(AN.in_census)} perusahaan roster ada di <a href="${PF}/#companies">sensus ini</a> dan menyandang badge; saring
    lewat tombol <em>Antler saja</em>. Cek dari Antler semata tidak menciptakan baris sensus — setiap baris tetap
    harus lolos uji entitas, jumlah pekerja, dan cek operasional yang sama.`)}</p>
    ${AN.companies && AN.companies.length ? `<div class="grid ang">
      ${AN.companies.map((e) => `<div class="cell"><div class="t mono">${esc(e.name)}${e.year ? ` · ${e.year}` : ''}</div><div class="d">${esc(e.note || '')}</div></div>`).join('')}
    </div>` : ''}
    ${(AN.pending || []).length ? `
    <div class="eyebrow sub an"><span class="sq"></span>${L('ON THE ROSTER, NOT YET IN THE CENSUS', 'DI ROSTER, BELUM MASUK SENSUS')} · ${(AN.pending || []).length}</div>
    <p class="lede sm">${L(`Most of Antler's checks are pre-seed companies of one to twenty people, so each still needs
    the census's own verification — entity, headcount, geography, liveness — before it gets a row. Rows marked
    <em>quiet</em> show no recent operating signal.
    Listed so the shortfall is visible rather than quietly missing.`,
    `Sebagian besar cek Antler mendarat di perusahaan pre-seed berisi satu hingga dua puluh orang, jadi masing-masing
    tetap harus melewati verifikasi sensus sendiri — entitas, jumlah pekerja, geografi, cek operasional — sebelum
    mendapat baris. Baris bertanda <em>quiet</em> tidak menunjukkan sinyal operasi terkini.
    Dicantumkan agar kekurangannya terlihat, bukan hilang diam-diam.`)}</p>
    <div class="tablewrap out"><table>
      <thead><tr><th>${L('On the roster', 'Di roster')}</th><th>${L('Year', 'Tahun')}</th><th>${L('What Antler backed', 'Apa yang didanai Antler')}</th><th>Status</th></tr></thead>
      <tbody>${AN.pending.map((o) => `<tr>
        <td>${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>` : esc(o.name)}</td>
        <td class="mu mono">${esc(String(o.year || ''))}</td>
        <td class="mu">${esc(o.blurb || '')}</td>
        <td class="mu mono">${esc(o.flag || '')}</td></tr>`).join('')}</tbody>
    </table></div>` : ''}
    ${(AN.outside || []).length ? `<div class="tablewrap out"><table>
      <thead><tr><th>${L('Not counted', 'Tidak dihitung')}</th><th>${L('Year', 'Tahun')}</th><th>${L('Where it actually sits', 'Lokasi sebenarnya')}</th><th>${L('Why not', 'Alasan')}</th></tr></thead>
      <tbody>${AN.outside.map((o) => `<tr>
        <td>${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>` : esc(o.name)}</td>
        <td class="mu mono">${esc(String(o.year || ''))}</td>
        <td class="mu">${esc(o.city || '')}</td>
        <td class="mu">${esc(o.reason || '')}${o.note ? ` — ${esc(o.note)}` : ''}</td></tr>`).join('')}</tbody>
    </table></div>` : ''}
  </section>` : '';

  const scopeSection = (SC.outside || []).length ? `
  <section class="wrap" id="scope">
    <div class="eyebrow"><span class="sq"></span>${L('WHERE THE LINE IS', 'BATAS CAKUPAN')}</div>
    <p class="lede">${SC.rule ? esc(SC.rule) : L('A company is counted when it was built or bought by tech or venture money rather than run as an incumbent’s product line, when it is its own legal entity, and when a headcount can be sourced.',
    'Sebuah perusahaan dihitung ketika ia dibangun atau dibeli oleh uang teknologi atau modal ventura — bukan dijalankan sebagai lini produk pemain lama — ketika ia entitas hukumnya sendiri, dan ketika jumlah pekerjanya bisa ditelusuri sumbernya.')}
    ${L(`The ${SC.outside.length} names below were considered against that rule and are not counted — the decision is published
    here so a deliberate exclusion cannot be mistaken for a gap.`,
    `${SC.outside.length} nama di bawah telah ditimbang terhadap aturan itu dan tidak dihitung — keputusannya
    dipublikasikan di sini agar pengecualian yang disengaja tidak dikira celah.`)}</p>
    <div class="tablewrap out"><table>
      <thead><tr><th>${L('Considered, not counted', 'Ditimbang, tidak dihitung')}</th><th>${L('Run by', 'Dijalankan oleh')}</th><th>${L('Why not', 'Alasan')}</th></tr></thead>
      <tbody>${SC.outside.map((o) => `<tr>
        <td>${esc(o.name)}</td>
        <td class="mu">${esc(o.owner || '')}</td>
        <td class="mu">${esc(o.why || '')}</td></tr>`).join('')}</tbody>
    </table></div>
  </section>` : '';

  /* ── #output + #method — the method prose, moved here off the landing.
     Same live computation as before the move: the worked examples, the flagged
     rows and every count come from census.json per request, so the page can
     never drift from the data. Bilingual like the rest of the page: gva.js
     carries both languages, so `lang` passes straight through. */
  const HOW = GVA.how(m, lang);
  const GT = GVA.t(lang);
  const byGva = companies.filter((c) => c.est_gva_idr_bn).sort((a, b) => b.est_gva_idr_bn - a.est_gva_idr_bn);
  const WORKED = [byGva[0], byGva[Math.floor(byGva.length / 2)], byGva[byGva.length - 1]]
    .filter(Boolean).map((c) => ({ c, w: GVA.working(c, m, lang) }));
  const NOHC = companies.filter((c) => c.employees_est === null || c.employees_est === undefined).length;
  const FLAGGED = companies.filter((c) => c.output_caveat).sort((a, b) => (b.est_gva_idr_bn || 0) - (a.est_gva_idr_bn || 0));
  const FLJOBS = FLAGGED.reduce((n, c) => n + (c.employees_est || 0), 0);
  const FLGVA = FLAGGED.reduce((n, c) => n + (c.est_gva_idr_bn || 0), 0);

  const outputSection = `
  <section class="wrap" id="output">
    <div class="eyebrow"><span class="sq"></span>${L('WHAT THE OUTPUT FIGURE IS', 'APA ITU ANGKA OUTPUT')}</div>
    <p class="lede">${esc(GT.WHAT[0])}</p>
    <div class="method">
      <p>${esc(GT.WHAT[1])}</p>
      <p>${esc(GT.WHAT[2])}</p>
      <p>${esc(HOW.line)}</p>
      ${WORKED.length ? `<div class="tablewrap out"><table>
        <thead><tr><th>${L('Worked example', 'Contoh perhitungan')}</th><th class="n">${L('People', 'Pekerja')}</th><th class="n">${L('Anchor Rp M', 'Anchor Rp jt')}</th><th class="n">${L('Output IDR bn/yr', 'Output IDR mlr/thn')}</th></tr></thead>
        <tbody>${WORKED.map((w) => `<tr>
          <td><a href="${PF}/company/${esc(w.c.id)}">${esc(w.c.name)}</a> <span class="mu">${esc(w.c.sector_label || '')}</span></td>
          <td class="n mono">${w.w ? fmt(w.w.people) : '—'}</td>
          <td class="n mono">${w.w ? '× ' + fmt(w.w.rate) : '—'}</td>
          <td class="n mono">${w.w ? fmt(w.w.bn, 1) : '—'}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="foot-note mono">${L(`Every output cell in the <a href="${PF}/#companies">census table</a> is this multiplication and nothing else — click any of them for its own working.${NOHC ? ` ${fmt(NOHC)} companies have no headcount we could source, so they carry no output at all — the census leaves the cell empty instead of imputing one from funding.` : ''}`,
      `Setiap sel output di <a href="${PF}/#companies">tabel sensus</a> adalah perkalian ini, bukan yang lain — klik salah satu selnya untuk melihat perhitungannya sendiri.${NOHC ? ` ${fmt(NOHC)} perusahaan tidak punya jumlah pekerja yang bisa kami telusuri sumbernya, jadi tidak membawa output sama sekali — sensus membiarkan selnya kosong alih-alih menaksirnya dari pendanaan.` : ''}`)}</div>` : ''}
      <ul>${GT.LIMITS.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      ${FLAGGED.length ? `<div class="tablewrap out"><table>
        <thead><tr><th>${L('Where this estimate runs high', 'Di mana estimasi ini terlalu tinggi')}</th><th class="n">${L('Jobs', 'Lapangan kerja')}</th><th class="n">${L('Output IDR bn/yr', 'Output IDR mlr/thn')}</th><th>${L('Why', 'Alasan')}</th></tr></thead>
        <tbody>${FLAGGED.map((c) => `<tr>
          <td><a href="${PF}/company/${esc(c.id)}">${esc(c.name)}</a></td>
          <td class="n mono">${fmt(c.employees_est)}</td>
          <td class="n mono">${fmt(c.est_gva_idr_bn, 1)}</td>
          <td class="mu">${esc(c.output_caveat.why)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="foot-note mono">${L(`${FLAGGED.length} rows, ${fmt(FLJOBS)} jobs and IDR ${fmt(Math.round(FLGVA / 100) / 10, 1)} T of the
      IDR ${fmt(T.gva_idr_t, 1)} T total — ${Math.round((FLJOBS / T.jobs) * 100)}% of the jobs and ${Math.round((FLGVA / (T.gva_idr_t * 1000)) * 100)}% of the output.
      The frontline anchor absorbed what used to dominate this table: since 31 Aug 2026, a payroll that is mostly
      couriers, store crews or village field officers is marked frontline and priced at the BPS national average
      instead of a Jakarta sector anchor — and a row with a company-published split (Amartha, FORE) prices its office
      and frontline shares separately — so pricing that workforce is no longer a known overstatement. What stays
      flagged is the row where even a desk-anchor estimate contradicts a revenue bound.`,
      `${FLAGGED.length} baris, ${fmt(FLJOBS)} lapangan kerja, dan IDR ${fmt(Math.round(FLGVA / 100) / 10, 1)} T dari
      total IDR ${fmt(T.gva_idr_t, 1)} T — ${Math.round((FLJOBS / T.jobs) * 100)}% lapangan kerja dan ${Math.round((FLGVA / (T.gva_idr_t * 1000)) * 100)}% output.
      Anchor frontline menyerap yang dulu mendominasi tabel ini: sejak 31 Agu 2026, daftar gaji yang sebagian besar
      kurir, kru gerai, atau petugas lapangan desa ditandai frontline dan dihargai pada rata-rata nasional BPS,
      bukan anchor sektor Jakarta — dan baris dengan rincian resmi (Amartha, FORE) menghargai bagian kantor dan
      garda depannya secara terpisah — sehingga menghargai tenaga kerja itu bukan lagi pelebihan yang diketahui.
      Yang tetap ditandai adalah baris yang estimasinya melampaui batas pendapatannya bahkan dengan anchor meja.`)}</div>` : ''}
      <p style="margin-top:16px"><a class="btn" href="${PF}/model">${L('Read the formal model — equations, charts, error bounds &rarr;', 'Baca model formal — persamaan, grafik, batas galat &rarr;')}</a></p>
    </div>
  </section>`;

  const methodSection = `
  <section class="wrap" id="method">
    <div class="eyebrow"><span class="sq"></span>${L('HOW THE NUMBERS ARE MADE', 'CARA ANGKA-ANGKA INI DISUSUN')}</div>
    <div class="method">
      <p>${esc(m.method_summary || '')}</p>
      ${m.global_parent_rule ? `<p>${esc(m.global_parent_rule)}</p>` : ''}
      ${m.headcount_rule ? `<p>${esc(m.headcount_rule)}</p>` : ''}
      ${m.frontline_rule ? `<p>${esc(m.frontline_rule)}</p>` : ''}
      ${m.caveats && m.caveats.length ? `<ul>${m.caveats.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : ''}
      <p style="margin-top:16px"><a class="btn" href="${PF}/model">${L('Read the formal model — equations, charts, error bounds →', 'Baca model formal — persamaan, grafik, batas galat →')}</a></p>
      <div class="src mono">${(m.sources || []).slice(0, 8).map(esc).join('<br>')}</div>
    </div>
  </section>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L('What the census contains', 'Cakupan sensus startup Indonesia')} — 1001startup.id</title>
<meta name="description" content="${L('What the combined valuation contains, the census by sector, the YC, Endeavor and Antler cohorts, every name considered and not counted, and how the numbers are made.',
    'Cakupan sensus startup Indonesia: valuasi gabungan, sebaran sektor, kohor YC, Endeavor, dan Antler, plus batas cakupan dengan nama-nama yang tidak dihitung.')}">
${I18N.headTags(lang, '/coverage')}
${SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('Coverage', 'Cakupan'), path: '/coverage' }])}
<meta property="og:title" content="${L('Coverage — what the census contains', 'Cakupan sensus startup Indonesia')} — 1001startup.id">
${I18N.ogImage()}
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.5 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${GRAD};color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
.hero{max-width:1180px;margin:0 auto;padding:56px 20px 10px;display:grid;grid-template-columns:1.15fr .85fr;gap:44px;align-items:start}
@media(max-width:880px){.hero{grid-template-columns:1fr;padding-top:36px}}
.hero h1{font-size:clamp(38px,5.2vw,66px);line-height:1.03;letter-spacing:-0.03em;font-weight:500}
.hero .sub{color:#52525B;font-size:16.5px;line-height:1.55;max-width:54ch}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:16px}
.eyebrow .sq{width:6px;height:6px;background:#000;display:inline-block}
.wrap{max-width:1180px;margin:0 auto;padding:54px 20px 0}
.lede{color:#52525B;font-size:14.5px;line-height:1.6;max-width:92ch;margin-bottom:16px}
.lede a{text-decoration:none;border-bottom:1px solid #C7C7CC}
.lede a:hover{border-bottom-color:#000;color:#000}
.lede.sm{font-size:14px;color:#52525B;max-width:84ch}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1px;background:#E7E7E7;border:1px solid #E7E7E7}
.grid .cell{background:#fff;padding:16px}
a.scell{display:block;text-decoration:none}
a.scell:hover{background:#FAFAFA}
a.scell .goarrow{color:#74747D;font-weight:400}
a.scell:hover .goarrow{color:#000}
/* the funding register carries exactly six cells; 3-up divides them evenly at every
   breakpoint, where the shared 4-up leaves two dead tiles on the second row */
.grid.fg{grid-template-columns:repeat(auto-fit,minmax(330px,1fr))}
.grid .t{font-weight:600;font-size:14.5px}
.grid .d{font-size:10.5px;color:#6B6B73;margin-top:5px}
.vg .t{font-size:26px;letter-spacing:-0.02em;font-weight:600}
.vg .dd{font-size:13px;line-height:1.55;color:#52525B;margin-top:8px;text-transform:none;letter-spacing:-0.01em}
.vg .dd a{text-decoration:none;border-bottom:1px solid #C7C7CC}
.vg .dd a:hover{border-bottom-color:#000;color:#000}
.grid.ycg .t{font-size:11px;letter-spacing:.06em;color:#BE4E2B}
.grid.ycg .d{font-size:12.5px;color:#52525B;line-height:1.5;text-transform:none;letter-spacing:0;font-family:'Overused Grotesk',sans-serif}
.grid.edg .t{font-size:11px;letter-spacing:.06em;color:#4E7A96}
.grid.edg .d{font-size:12.5px;color:#52525B;line-height:1.5;text-transform:none;letter-spacing:0;font-family:'Overused Grotesk',sans-serif}
.eyebrow.sub{margin-top:34px;color:#4E7A96}
.eyebrow.sub .sq{background:#4E7A96}
/* Antler colour = the banner gradient's 3rd stop #7AB88A taken to badge weight — the raw
   stop fails contrast on white at small sizes, the same reason /model rejected #E8734B */
.grid.ang .t{font-size:11px;letter-spacing:.06em;color:#4E7A58}
.grid.ang .d{font-size:12.5px;color:#52525B;line-height:1.5;text-transform:none;letter-spacing:0;font-family:'Overused Grotesk',sans-serif}
.eyebrow.sub.an{color:#4E7A58}
.eyebrow.sub.an .sq{background:#4E7A58}
.tablewrap{overflow-x:auto;border:1px solid #E7E7E7}
table{border-collapse:collapse;width:100%;font-size:13.5px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
td{padding:9px 12px;border-bottom:1px solid #F1F1F1;vertical-align:top}
td.n,th.n{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap}
td.mu{color:#52525B;font-size:12.5px}
td a{text-decoration:none;border-bottom:1px solid #D9D9D9}
#valuation .out th.n,#valuation .out td.n{text-align:right}
.tablewrap.out{margin-top:18px}
.tablewrap.out table{min-width:760px}
.tablewrap.out td{font-size:12.5px}
.foot-note{font-size:11px;color:#6B6B73;margin-top:10px}
.foot-note a{color:inherit;text-decoration:none;border-bottom:1px solid #C7C7CC}
.foot-note a:hover{color:#000;border-bottom-color:#000}
#output .out th.n,#output .out td.n{text-align:right}
#output .out td .mu{color:#6B6B73;font-size:11px;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;margin-left:8px}
#output .method p+p{margin-top:12px}
#output .method ul{margin:18px 0 0 18px}
#output .method li{margin-bottom:8px}
#output .out .tablewrap,#output .tablewrap{margin-top:18px}
.method{border:1px solid #E7E7E7;padding:22px}
.method p{color:#52525B;font-size:14.5px;line-height:1.6;max-width:88ch}
.method ul{margin:12px 0 0 18px;font-size:13px;line-height:1.7;color:#52525B}
.btn{display:inline-block;padding:12px 18px;font:400 12px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;border:1px solid #000;cursor:pointer;background:#fff;color:#000}
.btn:hover{border-color:#000}
.src{font-size:10.5px;line-height:1.9;word-break:break-all;color:#6B6B73;margin-top:12px;text-transform:none;letter-spacing:0}
footer{max-width:1180px;margin:60px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
</style>
</head>
<body>
<div class="banner">${L('WHAT IS COUNTED, WHAT IS HELD OUT, AND WHY — EVERY DECISION PUBLISHED', 'APA YANG DIHITUNG, APA YANG DIKELUARKAN, DAN ALASANNYA — SETIAP KEPUTUSAN DIPUBLIKASIKAN')}</div>
${NAV.header('census', { lang, path: '/coverage', translated: true })}
<section class="hero">
  <h1>${L('What the census contains.', 'Isi sensus ini.')}</h1>
  <div>
    <p class="sub">${L(`The census's own accounting: what the combined valuation actually holds, how the
    ${fmt(T.companies)} companies split by sector, which rows carry the Y Combinator, Endeavor and Antler badges, and where
    the counting line is drawn — plus what the output figure is and how every number is made. Every deliberate
    exclusion is published with its reason, so it cannot be mistaken for a gap.`,
    `Sensus membuka pembukuannya sendiri: apa yang benar-benar ada di dalam valuasi gabungan, bagaimana
    ${fmt(T.companies)} perusahaan terdata terbagi per sektor, baris mana saja yang menyandang badge Y Combinator, Endeavor,
    dan Antler, serta di mana batas cakupan ditarik — plus apa itu angka output dan cara setiap angka disusun. Setiap
    pengecualian yang disengaja kami publikasikan beserta alasannya, agar tidak dikira celah yang terlewat.`)}</p>
  </div>
</section>
${valuationSection}
${fundingSection}
${sectorsSection}
${ycSection}
${endeavorSection}
${antlerSection}
${scopeSection}
${outputSection}
${methodSection}
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="/stats">${L('Live traffic', 'Trafik langsung')}</a> · <a href="https://vantis.sh/cookies/" data-vs-reopen>${L('Cookies', 'Cookie')}</a> · <a href="${PF}/">${L('Back to the census', 'Kembali ke sensus')}</a></span>
</footer>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { coverage };
