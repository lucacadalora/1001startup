'use strict';

// Editorial research stays outside the generated wire and its story counts.
const I18N = require('./i18n1001');

const css = `
.import-note{max-width:1180px;margin:28px auto 0;padding:0 20px;scroll-margin-top:84px}
.import-note article{border:1px solid #E7E7E7;border-top:3px solid #4E7A96;padding:clamp(18px,3vw,30px)}
.import-note .in-meta{font:400 11px/1.7 'IBM Plex Mono',monospace;letter-spacing:.04em;text-transform:uppercase;color:#52525B}
.import-note h2{max-width:34ch;font-size:clamp(24px,3vw,34px);line-height:1.15;font-weight:530;letter-spacing:-.025em;margin:10px 0 16px}
.import-note .in-copy{max-width:82ch;color:#26262B}
.import-note .in-copy p+p{margin-top:14px}
.import-note details{margin-top:20px;border-top:1px solid #E7E7E7;padding-top:14px;font-size:14px;color:#52525B}
.import-note summary{cursor:pointer;width:fit-content;color:#26262B}
.import-note details p{max-width:90ch;margin-top:10px}
.import-note a{text-underline-offset:3px}
`;

function render(lang = 'en') {
  const L = I18N.mkL(lang);
  return `<section class="import-note" id="indonesia-ai-factory-imports" aria-labelledby="import-note-title">
  <article>
    <div class="in-meta">${L('Research note · Illustrative scenario', 'Catatan riset · Skenario ilustratif')} · <time datetime="2026-09-23">${L('23 Sep 2026', '23 Sep 2026')}</time></div>
    <h2 id="import-note-title">${L('A scenario for the computing portion', 'Skenario untuk bagian komputasi')}</h2>
    <div class="in-copy">
      <p>${L('To explore the possible AI-computing portion, we apply an illustrative allocation: <strong>50% of HS 847150 processing-unit imports and 35% of HS 847149 system imports</strong>. Applied to January–July 2026 values, this produces <strong>US$1.807 billion</strong> of potential AI computing equipment. Both percentages are analyst-selected assumptions, not measured AI shares or probabilities; this scenario includes no allocation from the other six HS 8471 subcategories.',
      'Untuk menelaah kemungkinan bagian komputasi AI, kami menggunakan alokasi ilustratif: <strong>50% dari impor unit pemrosesan HS 847150 dan 35% dari impor sistem HS 847149</strong>. Diterapkan pada nilai Januari–Juli 2026, alokasi ini menghasilkan <strong>US$1,807 miliar</strong> untuk peralatan komputasi yang berpotensi digunakan bagi AI. Kedua persentase adalah asumsi analis, bukan pangsa AI yang terukur atau probabilitas; skenario ini tidak mengalokasikan nilai dari enam subkategori HS 8471 lainnya.')}</p>
      <p>${L('This is a scenario for <strong>whole computing equipment</strong>, potentially including CPUs, memory and other components shipped within a server or system. It is not a valuation of H200/B300 chips or a total AI data-center construction budget. The categories also contain conventional computing equipment, and the data cannot split the scenario between H200, B300, other accelerators and non-AI use. It does not establish GPU or cluster counts. <strong>No H200 or B300 imports are confirmed by these aggregates alone.</strong>',
      'Ini adalah skenario untuk <strong>peralatan komputasi secara utuh</strong>, yang dapat mencakup CPU, memori, dan komponen lain yang dikirim di dalam server atau sistem. Ini bukan valuasi chip H200/B300 atau total anggaran pembangunan pusat data AI. Kategori tersebut juga memuat perangkat komputasi konvensional, dan data tidak dapat memisahkan alokasi antara H200, B300, akselerator lain, dan penggunaan non-AI. Skenario ini tidak menetapkan jumlah GPU atau klaster. <strong>Data agregat ini saja tidak mengonfirmasi impor H200 atau B300.</strong>')}</p>
    </div>
    <details>
      <summary>${L('Data, assumptions and limitations', 'Data, asumsi, dan keterbatasan')}</summary>
      <p>${L('Source: two supplied spreadsheet exports of Indonesia’s imports from the world under HS 8471. The original issuing provider has not been independently authenticated. Values were converted from US$ thousands to US$ millions; the comparison uses January–July in both years. Monthly and quarterly exports were reconciled, not added together.',
      'Sumber: dua ekspor spreadsheet yang disediakan mengenai impor Indonesia dari seluruh dunia dalam HS 8471. Penyedia asli data belum diverifikasi secara independen. Nilai dikonversi dari ribuan menjadi jutaan dolar AS; perbandingan menggunakan Januari–Juli pada kedua tahun. Ekspor bulanan dan triwulanan direkonsiliasi, bukan dijumlahkan bersama.')}</p>
      <p>${L('Illustrative AI allocation (US$ millions): 2,850.872 × 50% + 1,090.499 × 35% = 1,807.111. This is a scenario, not a probability estimate or a verified AI import total.',
      'Alokasi AI ilustratif (juta US$): 2.850,872 × 50% + 1.090,499 × 35% = 1.807,111. Ini adalah skenario, bukan estimasi probabilitas atau total impor AI yang terverifikasi.')}</p>
      <p><a href="/data/research/indonesia-imports-2026-09/monthly.csv" download>${L('Monthly data (CSV)', 'Data bulanan (CSV)')}</a> · <a href="/data/research/indonesia-imports-2026-09/categories.csv" download>${L('Category comparison (CSV)', 'Perbandingan kategori (CSV)')}</a> · <a href="/data/research/indonesia-imports-2026-09/methodology.txt?v=20260923-ai-clusters">${L('Source notes and calculations (English)', 'Catatan sumber dan perhitungan (bahasa Inggris)')}</a></p>
    </details>
  </article>
</section>`;
}

module.exports = { css, render };
