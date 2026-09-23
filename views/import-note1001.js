'use strict';

// Editorial research stays outside the generated wire and its story counts.
const I18N = require('./i18n1001');
const { values } = require('./import-hs1001');

// Deliberately broad analyst-selected sensitivities, not fitted probabilities.
const scenarios = [
  { key: 'low', en: 'Low AI share', id: 'Pangsa AI rendah', processing: .25, systems: .15 },
  { key: 'central', en: 'Central case', id: 'Skenario tengah', processing: .50, systems: .35 },
  { key: 'high', en: 'High AI share', id: 'Pangsa AI tinggi', processing: .75, systems: .60 },
].map(s => ({ ...s, total: values['847150'].current * s.processing + values['847149'].current * s.systems }));
const combined = values['847150'].current + values['847149'].current;
const prior = values['847150'].prior + values['847149'].prior;
const baselines = [0, .2, .4].map(growth => ({ growth, expected: prior * (1 + growth), residual: combined - prior * (1 + growth) }));

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
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const n = v => v.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const pct = v => (v * 100).toLocaleString(locale, { maximumFractionDigits: 1 }) + '%';
  const rows = scenarios.map(s => `<tr data-scenario="${s.key}"><th scope="row">${L(s.en, s.id)}</th><td>${pct(s.processing)}</td><td>${pct(s.systems)}</td><td>${n(s.total)}</td><td>${pct(s.total / combined)}</td></tr>`).join('');
  const baselineRows = baselines.map(s => `<tr><th scope="row">${pct(s.growth)}</th><td>${n(s.expected)}</td><td>${n(s.residual)}</td></tr>`).join('');
  return `<section class="import-note" id="indonesia-ai-factory-imports" aria-labelledby="import-note-title">
  <article>
    <div class="in-meta">${L('Research note · Illustrative scenario', 'Catatan riset · Skenario ilustratif')} · <time datetime="2026-09-23">${L('23 Sep 2026', '23 Sep 2026')}</time></div>
    <h2 id="import-note-title">${L('How much of the surge could be AI compute?', 'Seberapa besar lonjakan ini dapat berupa komputasi AI?')}</h2>
    <div class="in-copy">
      <p>${L('Our thesis is that a material part of the server-and-system import surge could be equipment for AI factories. To size that thesis, we test three allocations of the <strong>US$3.941 billion</strong> in HS 847150 and 847149 imports. The central case retains our original 50%/35% assumptions; the low and high cases show how much the result moves when the assumed AI share changes.',
      'Tesis kami adalah bahwa sebagian material dari lonjakan impor server dan sistem dapat berupa perangkat untuk pabrik AI. Untuk mengukur tesis tersebut, kami menguji tiga alokasi atas impor HS 847150 dan 847149 senilai <strong>US$3,941 miliar</strong>. Skenario tengah mempertahankan asumsi awal 50%/35%; skenario rendah dan tinggi menunjukkan perubahan hasil saat asumsi pangsa AI berubah.')}</p>
      <p>${L('<strong>These percentages are assumed shares of import value.</strong> They are not probabilities that a scenario will occur, and the low-to-high span is not a statistical confidence interval. Each case values whole computing equipment, including components inside servers; it excludes a separate allowance for buildings, power and cooling.',
      '<strong>Persentase ini adalah asumsi pangsa nilai impor.</strong> Angka tersebut bukan probabilitas terjadinya skenario, dan rentang rendah hingga tinggi bukan interval kepercayaan statistik. Setiap skenario menilai peralatan komputasi utuh, termasuk komponen di dalam server; tidak ada alokasi terpisah untuk bangunan, daya, dan pendinginan.')}</p>
    </div>
    <div class="table-scroll" role="region" aria-label="${L('AI computing scenarios', 'Skenario komputasi AI')}" tabindex="0"><table class="scenario-table"><caption>${L('January–July 2026 · AI equipment value in US$ millions · scroll for all columns', 'Januari–Juli 2026 · nilai peralatan AI dalam juta US$ · geser untuk semua kolom')}</caption><thead><tr><th scope="col">${L('Scenario', 'Skenario')}</th><th scope="col">${L('AI share', 'Pangsa AI')}<br>847150</th><th scope="col">${L('AI share', 'Pangsa AI')}<br>847149</th><th scope="col">${L('AI equipment', 'Peralatan AI')}<br>${L('US$m', 'juta US$')}</th><th scope="col">${L('Share of both codes', 'Pangsa kedua kode')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="in-copy">
      <p>${L('<strong>Low case: US$0.876 billion.</strong> Most imports serve conventional cloud and enterprise demand; AI accounts for a minority. <strong>Central case: US$1.807 billion.</strong> AI and conventional computing both contribute materially. <strong>High case: US$2.792 billion.</strong> GPU-rich deployments dominate the two categories. Processing units receive a larger assumed AI share in each case because they are our primary server-compute search pool; this ordering is a modeling choice.',
      '<strong>Skenario rendah: US$0,876 miliar.</strong> Sebagian besar impor melayani cloud konvensional dan kebutuhan perusahaan; AI menjadi bagian minoritas. <strong>Skenario tengah: US$1,807 miliar.</strong> AI dan komputasi konvensional sama-sama berkontribusi besar. <strong>Skenario tinggi: US$2,792 miliar.</strong> Pengadaan padat GPU mendominasi kedua kategori. Unit pemrosesan mendapat asumsi pangsa AI lebih besar pada setiap skenario karena menjadi fokus utama pencarian komputasi server; urutan ini adalah pilihan pemodelan.')}</p>
      <p>${L('The central case assigns <strong>US$1.425 billion to processing units</strong> and <strong>US$0.382 billion to systems</strong>, leaving US$2.134 billion for other uses within the same two codes. That is a testable equipment-spending thesis: trace the server suppliers, delivery windows and destination facilities against an explicit allocation.',
      'Skenario tengah mengalokasikan <strong>US$1,425 miliar ke unit pemrosesan</strong> dan <strong>US$0,382 miliar ke sistem</strong>, menyisakan US$2,134 miliar untuk penggunaan lain dalam dua kode yang sama. Ini adalah tesis belanja perangkat yang dapat diuji: telusuri pemasok server, periode pengiriman, dan fasilitas tujuan terhadap alokasi yang dinyatakan secara jelas.')}</p>
    </div>
    <h3>${L('A second test: allow for ordinary computing growth', 'Pengujian kedua: beri ruang untuk pertumbuhan komputasi biasa')}</h3>
    <div class="in-copy">
      <p>${L('Start with the US$1.611 billion imported in January–July 2025 and grow that baseline by 0%, 20% or 40%. The 20% benchmark is close to the 19.7% growth in portable-computer imports in the supplied data; it is a sensitivity anchor, not a forecast for servers. Even with 40% baseline growth, the 2026 total leaves <strong>US$1.687 billion of additional spending to explain</strong>.',
      'Mulai dari impor Januari–Juli 2025 senilai US$1,611 miliar, lalu naikkan basis tersebut sebesar 0%, 20%, atau 40%. Acuan 20% mendekati pertumbuhan impor komputer portabel sebesar 19,7% dalam data yang disediakan; ini adalah acuan sensitivitas, bukan proyeksi server. Bahkan dengan pertumbuhan basis 40%, total 2026 menyisakan <strong>US$1,687 miliar belanja tambahan yang perlu dijelaskan</strong>.')}</p>
    </div>
    <div class="table-scroll" role="region" aria-label="${L('Baseline growth sensitivity', 'Sensitivitas pertumbuhan basis')}" tabindex="0"><table class="baseline-table"><caption>${L('Both HS codes combined · US$ millions', 'Gabungan kedua kode HS · juta US$')}</caption><thead><tr><th scope="col">${L('Baseline growth', 'Pertumbuhan basis')}</th><th scope="col">${L('Expected imports', 'Impor sesuai basis')}</th><th scope="col">${L('Residual spending', 'Belanja residual')}</th></tr></thead><tbody>${baselineRows}</tbody></table></div>
    <div class="in-copy">
      <p>${L('This residual is a different lens on the same imports. It can include AI, faster conventional-server growth, price increases and a changing equipment mix. The 2025 baseline may already contain AI equipment. <strong>Do not add the residual to the AI allocation above.</strong> The useful result is that substantial additional spending remains even under a generous baseline-growth assumption.',
      'Residual ini adalah sudut pandang lain atas impor yang sama. Di dalamnya dapat terdapat AI, pertumbuhan server konvensional yang lebih cepat, kenaikan harga, dan perubahan komposisi perangkat. Basis 2025 juga dapat sudah mencakup perangkat AI. <strong>Jangan menambahkan residual ke alokasi AI di atas.</strong> Hasil yang berguna adalah bahwa belanja tambahan tetap besar bahkan dengan asumsi pertumbuhan basis yang tinggi.')}</p>
    </div>
    <h3>${L('How we would move the thesis up or down', 'Kapan tesis ini diperkuat atau diturunkan')}</h3>
    <div class="in-copy">
      <p>${L('Move toward the high case if high-value declarations identify GPU-server SKUs, repeat deliveries to AI operators, and matching deployment records. Move toward the low case if the increase is dominated by CPU-only servers, ordinary enterprise refreshes or higher unit prices. For the model mix, <strong>B300 has a named Indonesian project lead</strong> in the Gorilla announcement; H200 remains an architectural candidate. A numerical H200/B300 split needs product-level evidence before it can carry more weight than a chosen scenario.',
      'Bergerak ke skenario tinggi jika deklarasi bernilai besar menyebut SKU server GPU, pengiriman berulang ke operator AI, dan catatan implementasi yang sesuai. Bergerak ke skenario rendah jika kenaikan didominasi server CPU saja, pembaruan perangkat perusahaan biasa, atau harga unit lebih tinggi. Untuk komposisi model, <strong>B300 memiliki petunjuk proyek Indonesia yang disebut secara spesifik</strong> dalam pengumuman Gorilla; H200 tetap menjadi kandidat arsitektur. Pembagian numerik H200/B300 memerlukan bukti tingkat produk agar lebih bermakna daripada skenario yang dipilih.')}</p>
    </div>
    <details>
      <summary>${L('Data, assumptions and limitations', 'Data, asumsi, dan keterbatasan')}</summary>
      <p>${L('Source: two supplied spreadsheet exports of Indonesia’s imports from the world under HS 8471. The original issuing provider has not been independently authenticated. Values were converted from US$ thousands to US$ millions; the comparison uses January–July in both years. Monthly and quarterly exports were reconciled, not added together.',
      'Sumber: dua ekspor spreadsheet yang disediakan mengenai impor Indonesia dari seluruh dunia dalam HS 8471. Penyedia asli data belum diverifikasi secara independen. Nilai dikonversi dari ribuan menjadi jutaan dolar AS; perbandingan menggunakan Januari–Juli pada kedua tahun. Ekspor bulanan dan triwulanan direkonsiliasi, bukan dijumlahkan bersama.')}</p>
      <p>${L('Illustrative AI allocation (US$ millions): 2,850.872 × 50% + 1,090.499 × 35% = 1,807.111. This is a scenario, not a probability estimate or a verified AI import total.',
      'Alokasi AI ilustratif (juta US$): 2.850,872 × 50% + 1.090,499 × 35% = 1.807,111. Ini adalah skenario, bukan estimasi probabilitas atau total impor AI yang terverifikasi.')}</p>
      <p><a href="/data/research/indonesia-imports-2026-09/monthly.csv" download>${L('Monthly data (CSV)', 'Data bulanan (CSV)')}</a> · <a href="/data/research/indonesia-imports-2026-09/categories.csv" download>${L('Category comparison (CSV)', 'Perbandingan kategori (CSV)')}</a> · <a href="/data/research/indonesia-imports-2026-09/scenarios.csv" download>${L('AI-share scenarios (CSV)', 'Skenario pangsa AI (CSV)')}</a> · <a href="/data/research/indonesia-imports-2026-09/methodology.txt?v=20260923-scenarios">${L('Source notes and calculations (English)', 'Catatan sumber dan perhitungan (bahasa Inggris)')}</a></p>
    </details>
  </article>
</section>`;
}

module.exports = { css, render, scenarios, baselines };
