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
    <h2 id="import-note-title">${L('Could Indonesia’s computer imports be building AI factories?', 'Apakah impor komputer Indonesia digunakan untuk membangun pabrik AI?')}</h2>
    <div class="in-copy">
      <p>${L('The supplied Indonesia trade workbooks show a substantial increase in computing equipment that could support AI factory development. During January–July 2026, imports under HS 847150 (processing units) and HS 847149 (computer systems) reached approximately <strong>US$3.94 billion</strong>, compared with <strong>US$1.61 billion</strong> a year earlier. These categories accounted for about <strong>94% of the increase</strong> in overall computer-equipment imports under HS 8471, with particularly large processing-unit shipments during May–July 2026. Our working hypothesis is that part of this surge represents GPU servers and integrated computing systems intended for AI factories.',
      'Buku kerja data perdagangan Indonesia yang disediakan menunjukkan peningkatan besar impor peralatan komputasi yang dapat mendukung pembangunan pabrik AI. Pada Januari–Juli 2026, impor dalam HS 847150 (unit pemrosesan) dan HS 847149 (sistem komputer) mencapai sekitar <strong>US$3,94 miliar</strong>, dibandingkan <strong>US$1,61 miliar</strong> pada periode yang sama tahun sebelumnya. Kedua kategori ini menyumbang sekitar <strong>94% dari kenaikan</strong> keseluruhan impor peralatan komputer dalam HS 8471, dengan impor unit pemrosesan yang sangat besar pada Mei–Juli 2026. Hipotesis kerja kami adalah bahwa sebagian lonjakan ini merupakan server GPU dan sistem komputasi terintegrasi untuk pabrik AI.')}</p>
      <p>${L('For an illustrative allocation, we assume AI equipment represents <strong>50% of processing-unit imports and 35% of computer-system imports</strong>, implying approximately <strong>US$1.8 billion</strong> of potential AI computing equipment. These percentages are assumptions, not measured shares. The same HS codes also cover conventional servers, workstations and industrial computers. The figures therefore support investigating AI infrastructure investment, but <strong>do not confirm NVIDIA B300 imports</strong>, identify importing companies, or establish whether the equipment has been installed and is operational.',
      'Sebagai alokasi ilustratif, kami mengasumsikan peralatan AI mencakup <strong>50% dari impor unit pemrosesan dan 35% dari impor sistem komputer</strong>, yang menghasilkan perkiraan sekitar <strong>US$1,8 miliar</strong> untuk peralatan komputasi yang berpotensi digunakan bagi AI. Persentase tersebut merupakan asumsi, bukan pangsa yang terukur. Kode HS yang sama juga mencakup server konvensional, workstation, dan komputer industri. Angka ini menjadi dasar untuk menyelidiki investasi infrastruktur AI, tetapi <strong>tidak mengonfirmasi impor NVIDIA B300</strong>, mengidentifikasi perusahaan pengimpor, atau memastikan bahwa peralatan telah dipasang dan beroperasi.')}</p>
    </div>
    <details>
      <summary>${L('Data, assumptions and limitations', 'Data, asumsi, dan keterbatasan')}</summary>
      <p>${L('Source: two supplied spreadsheet exports of Indonesia’s imports from the world under HS 8471. The original issuing provider has not been independently authenticated. Values were converted from US$ thousands to US$ millions; the comparison uses January–July in both years. Monthly and quarterly exports were reconciled, not added together.',
      'Sumber: dua ekspor spreadsheet yang disediakan mengenai impor Indonesia dari seluruh dunia dalam HS 8471. Penyedia asli data belum diverifikasi secara independen. Nilai dikonversi dari ribuan menjadi jutaan dolar AS; perbandingan menggunakan Januari–Juli pada kedua tahun. Ekspor bulanan dan triwulanan direkonsiliasi, bukan dijumlahkan bersama.')}</p>
      <p>${L('Illustrative AI allocation (US$ millions): 2,850.872 × 50% + 1,090.499 × 35% = 1,807.111. This is a scenario, not a probability estimate or a verified AI import total.',
      'Alokasi AI ilustratif (juta US$): 2.850,872 × 50% + 1.090,499 × 35% = 1.807,111. Ini adalah skenario, bukan estimasi probabilitas atau total impor AI yang terverifikasi.')}</p>
      <p><a href="/data/research/indonesia-imports-2026-09/monthly.csv" download>${L('Monthly data (CSV)', 'Data bulanan (CSV)')}</a> · <a href="/data/research/indonesia-imports-2026-09/categories.csv" download>${L('Category comparison (CSV)', 'Perbandingan kategori (CSV)')}</a> · <a href="/data/research/indonesia-imports-2026-09/methodology.txt">${L('Source notes and calculations (English)', 'Catatan sumber dan perhitungan (bahasa Inggris)')}</a></p>
    </details>
  </article>
</section>`;
}

module.exports = { css, render };
