'use strict';

const fs = require('fs');
const path = require('path');
const { esc } = require('../lib/util');
const I18N = require('./i18n1001');

// Use the downloadable snapshot; remaining categories are a residual of 8471,
// so the parent is never counted again as an extra component.
const source = fs.readFileSync(path.join(__dirname, '../public/data/research/indonesia-imports-2026-09/monthly.csv'), 'utf8');
const rows = source.trim().split(/\r?\n/).slice(1).map(line => {
  const [month, total, processing, systems, other] = line.split(',');
  const numbers = [total, processing, systems, other].map(Number);
  return { month, total: numbers[0], parts: [...numbers.slice(1), Math.round((numbers[0] - numbers[1] - numbers[2] - numbers[3]) * 1000) / 1000] };
});
const SERIES = [
  { en: 'Processing units', id: 'Unit pemrosesan', code: '847150', color: 'oklch(53% .16 259)' },
  { en: 'Computer systems', id: 'Sistem komputer', code: '847149', color: 'oklch(84% .155 88)' },
  { en: 'Other units', id: 'Unit lainnya', code: '847180', color: 'oklch(70% .15 348)' },
  { en: 'Remaining HS 8471', id: 'Sisa HS 8471', code: '', color: 'oklch(67% .105 181)' },
];

const css = `
.monthly-imports{margin:36px 0 42px;padding:26px 0;border-block:1px solid oklch(86% .008 240);scroll-margin-top:24px}
.monthly-imports figcaption strong{display:block;font-size:clamp(23px,3vw,30px);line-height:1.2;font-weight:550;letter-spacing:-.02em}
.monthly-imports figcaption span{display:block;color:oklch(43% .01 240);font-size:14px;margin-top:8px}
.monthly-legend{display:flex;flex-wrap:wrap;gap:10px 22px;margin:22px 0;font-size:13px;line-height:1.5}
.monthly-legend span{display:flex;align-items:center;gap:7px}.monthly-swatch{display:inline-block;width:11px;height:11px;flex-shrink:0}
.monthly-controls{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;margin-bottom:16px;font-size:13px;color:oklch(43% .01 240)}
.monthly-controls[hidden]{display:none}.monthly-controls select{font:inherit;color:inherit;background:transparent;border:1px solid oklch(72% .01 240);border-radius:0;padding:8px 30px 8px 10px;max-width:100%}
.monthly-controls select:focus-visible,.monthly-scroll:focus-visible{outline:2px solid oklch(45% .09 240);outline-offset:3px}
.monthly-scroll{overflow-x:auto;overscroll-behavior-x:contain}.monthly-plot{display:block;min-width:760px;width:100%;height:auto}
.monthly-plot text{fill:oklch(33% .01 240);font:14px 'Overused Grotesk',system-ui,sans-serif}
.monthly-plot .grid{stroke:oklch(90% .005 240);stroke-width:1}.monthly-plot .year-line{stroke:oklch(74% .01 240);stroke-dasharray:4 5}
.monthly-plot .selection{fill:oklch(94% .012 240);opacity:0}.monthly-plot .is-selected .selection{opacity:1}
.monthly-plot .month-bar[role=button]{cursor:pointer}.monthly-plot .month-bar:focus{outline:none}.monthly-plot .month-bar:focus-visible .selection{opacity:1;stroke:oklch(37% .08 240);stroke-width:2}
.monthly-plot .peak{font-size:13px;font-weight:600}
.monthly-readout{border-top:1px solid oklch(86% .008 240);margin-top:18px;padding-top:18px;font-variant-numeric:tabular-nums}
.monthly-readout>p{display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;font-size:16px}
.monthly-readout dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;margin-top:16px}
.monthly-readout dt{font-size:12px;color:oklch(43% .01 240);line-height:1.5}.monthly-readout dd{font-size:19px;font-weight:550;margin-top:4px}
.monthly-imports .chart-note{font-size:13px;color:oklch(43% .01 240);line-height:1.6;margin-top:18px;max-width:75ch}
.monthly-data{margin-top:20px;font-size:14px}.monthly-data summary{cursor:pointer;width:fit-content;text-decoration:underline;text-underline-offset:4px}
.monthly-data table{min-width:740px}.monthly-data td{white-space:nowrap}
@media(max-width:600px){.monthly-readout dl{grid-template-columns:repeat(2,minmax(0,1fr))}.monthly-legend{gap:10px 18px}.monthly-imports{padding-top:20px}}
`;

function render(lang = 'en') {
  const L = I18N.mkL(lang);
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const number = (v, digits = 1) => v.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const money = v => `US$${number(v)}${L('m', ' jt')}`;
  const monthLabel = (month, short = false) => new Intl.DateTimeFormat(locale, { month: 'short', year: short ? '2-digit' : 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T00:00:00Z'));
  const data = rows.map(row => ({ ...row, label: monthLabel(row.month) }));
  const selected = data.findIndex(row => row.month === '2026-06');
  const current = data[selected];
  const left = 66, top = 36, plotWidth = 868, plotHeight = 330, max = 1250;
  const step = plotWidth / data.length, barWidth = 33;
  const y = value => top + plotHeight * (1 - value / max);
  const grid = [0, 250, 500, 750, 1000, 1250].map(value => `<line class="grid" x1="${left}" x2="${left + plotWidth}" y1="${y(value)}" y2="${y(value)}"/><text x="${left - 10}" y="${y(value) + 5}" text-anchor="end">${number(value, 0)}</text>`).join('');
  const bars = data.map((row, i) => {
    const x = left + i * step + (step - barWidth) / 2;
    let cumulative = 0;
    const segments = row.parts.map((value, j) => {
      cumulative += value;
      return `<rect x="${x}" y="${y(cumulative)}" width="${barWidth}" height="${plotHeight * value / max}" fill="${SERIES[j].color}"/>`;
    }).join('');
    const description = `${row.label}: ${L('total', 'total')} ${money(row.total)}; ` + SERIES.map((series, j) => `${L(series.en, series.id)} ${money(row.parts[j])}`).join('; ');
    return `<g class="month-bar${i === selected ? ' is-selected' : ''}" data-month-index="${i}" data-month-label="${esc(row.label)}" data-total="${esc(money(row.total))}" data-parts="${esc(JSON.stringify(row.parts.map(money)))}" aria-label="${esc(description)}"><title>${esc(description)}</title><rect class="selection" x="${left + i * step + 1}" y="${top - 6}" width="${step - 2}" height="${plotHeight + 12}"/>${segments}<rect x="${left + i * step}" y="${top}" width="${step}" height="${plotHeight}" fill="transparent"/>${[8, 13, 17].includes(i) ? `<text class="peak" x="${x + barWidth / 2}" y="${y(row.total) - 10}" text-anchor="middle">${number(row.total)}</text>` : ''}</g>`;
  }).join('');
  const labels = data.map((row, i) => i % 2 === 0 ? `<text x="${left + (i + .5) * step}" y="${top + plotHeight + 26}" text-anchor="middle">${esc(monthLabel(row.month, true))}</text>` : '').join('');
  const table = data.map(row => `<tr><th scope="row">${esc(row.label)}</th>${row.parts.map(value => `<td>${number(value, 3)}</td>`).join('')}<td>${number(row.total, 3)}</td></tr>`).join('');
  return `<figure class="monthly-imports" id="monthly-imports" data-import-chart>
<figcaption id="monthly-imports-title"><strong>${L('Indonesia’s computer imports', 'Impor komputer Indonesia')}</strong><span>${L('All supplier countries · HS 8471 · January 2025–July 2026 · US$ million', 'Seluruh negara pemasok · HS 8471 · Januari 2025–Juli 2026 · juta US$')}</span></figcaption>
<div class="monthly-legend">${SERIES.map(series => `<span><i class="monthly-swatch" style="background:${series.color}" aria-hidden="true"></i>${L(series.en, series.id)}${series.code ? ' · ' + series.code : ''}</span>`).join('')}</div>
<div class="monthly-controls" hidden><label for="import-chart-month">${L('Explore a month', 'Pilih bulan')}</label><select id="import-chart-month" data-month-select>${data.map((row, i) => `<option value="${i}"${i === selected ? ' selected' : ''}>${esc(row.label)}</option>`).join('')}</select><span>${L('Hover, tap or use arrow keys on a bar. Scroll to see all months.', 'Sorot, ketuk, atau gunakan tombol panah pada batang. Geser untuk melihat semua bulan.')}</span></div>
<div class="monthly-scroll" tabindex="0" role="region" aria-label="${L('Monthly import chart; scroll horizontally on small screens', 'Grafik impor bulanan; geser horizontal pada layar kecil')}"><svg class="monthly-plot" viewBox="0 0 960 418" role="group" aria-labelledby="monthly-imports-title monthly-imports-desc"><desc id="monthly-imports-desc">${L('Stacked monthly imports in US$ millions. Computer systems rise sharply in February 2026; processing units drive the May–July 2026 surge. Exact values are in the table below.', 'Impor bulanan bertumpuk dalam juta US$. Sistem komputer melonjak pada Februari 2026; unit pemrosesan mendorong lonjakan Mei–Juli 2026. Nilai tepat tersedia pada tabel di bawah.')}</desc><text x="${left}" y="17">${L('Imports · US$ million', 'Impor · juta US$')}</text>${grid}<line class="year-line" x1="${left + 12 * step}" x2="${left + 12 * step}" y1="${top}" y2="${top + plotHeight}"/>${bars}${labels}<text x="${left + plotWidth / 2}" y="413" text-anchor="middle">${L('Month', 'Bulan')}</text></svg></div>
<div class="monthly-readout" aria-live="polite" aria-atomic="true"><p><strong data-readout-month>${esc(current.label)}</strong><span>${L('Total', 'Total')} <strong data-readout-total>${money(current.total)}</strong></span></p><dl>${SERIES.map((series, i) => `<div><dt><i class="monthly-swatch" style="background:${series.color}" aria-hidden="true"></i> ${L(series.en, series.id)}</dt><dd data-readout-part="${i}">${money(current.parts[i])}</dd></div>`).join('')}</dl></div>
<p class="chart-note">${L('Remaining HS 8471 = total imports minus processing units, computer systems and other units. It includes portable computers, storage, input/output and the other categories. These are reported equipment categories, not assigned AI shares.', 'Sisa HS 8471 = total impor dikurangi unit pemrosesan, sistem komputer, dan unit lainnya. Di dalamnya terdapat komputer portabel, penyimpanan, input/output, dan kategori lainnya. Ini adalah kategori perangkat yang dilaporkan, bukan alokasi pangsa AI.')}</p>
<p class="chart-note">${L('Source: supplied trade spreadsheets; original provider not independently authenticated.', 'Sumber: spreadsheet perdagangan yang disediakan; penyedia asli belum diverifikasi secara independen.')} <a href="/data/research/indonesia-imports-2026-09/monthly.csv" download>${L('Download monthly data (CSV)', 'Unduh data bulanan (CSV)')}</a>.</p>
<details class="monthly-data"><summary>${L('View all 19 months as a table', 'Lihat seluruh 19 bulan dalam tabel')}</summary><div class="table-scroll" tabindex="0" role="region" aria-label="${L('Monthly data table', 'Tabel data bulanan')}"><table><caption>${L('US$ millions · three decimal places', 'Juta US$ · tiga angka desimal')}</caption><thead><tr><th scope="col">${L('Month', 'Bulan')}</th>${SERIES.map(series => `<th scope="col">${L(series.en, series.id)}</th>`).join('')}<th scope="col">${L('Total', 'Total')}</th></tr></thead><tbody>${table}</tbody></table></div></details>
</figure>`;
}

module.exports = { render, css, rows };
