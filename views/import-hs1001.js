'use strict';

const fs = require('fs');
const path = require('path');
const I18N = require('./i18n1001');

// Render the breakdown from the same snapshot that readers can download.
const csv = fs.readFileSync(path.join(__dirname, '../public/data/research/indonesia-imports-2026-09/categories.csv'), 'utf8');
const values = Object.fromEntries(csv.trim().split(/\r?\n/).slice(1).map(line => {
  const [code, , prior, current] = line.split(',');
  return [code, { prior: Number(prior), current: Number(current) }];
}));
const categories = [
  ['847150', 'Processing units', 'Unit pemrosesan', 'Primary lead: server compute', 'Fokus utama: komputasi server'],
  ['847149', 'Computers supplied as systems', 'Komputer dalam bentuk sistem', 'Primary lead: integrated systems', 'Fokus utama: sistem terintegrasi'],
  ['847130', 'Portable computers, up to 10 kg', 'Komputer portabel, hingga 10 kg', 'Outside the AI allocation', 'Di luar alokasi AI'],
  ['847170', 'Data-storage units', 'Unit penyimpanan data', 'Supporting hardware; not allocated', 'Perangkat pendukung; tidak dialokasikan'],
  ['847141', 'Computers with processing and I/O in one housing', 'Komputer dengan pemrosesan dan I/O dalam satu rumah', 'Outside the AI allocation', 'Di luar alokasi AI'],
  ['847160', 'Input/output peripherals', 'Periferal input/output', 'Outside the AI allocation', 'Di luar alokasi AI'],
  ['847190', 'Remaining goods under 8471', 'Barang lainnya dalam 8471', 'Unspecified; not allocated', 'Tidak spesifik; tidak dialokasikan'],
  ['847180', 'Other computer units', 'Unit komputer lainnya', 'Review descriptions; not allocated', 'Periksa deskripsi; tidak dialokasikan'],
];

function render(lang = 'en') {
  const L = I18N.mkL(lang);
  const locale = lang === 'id' ? 'id-ID' : 'en-US';
  const n = v => v.toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const growth = ({ prior, current }) => ((current / prior - 1) * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'always' }) + '%';
  const rows = categories.map(([code, en, id, role, roleId]) => {
    const v = values[code];
    return `<tr data-hs="${code}"><th scope="row"><code>${code}</code><span>${L(en, id)}</span><small>${L(role, roleId)}</small></th><td>${n(v.prior)}</td><td>${n(v.current)}</td><td>${growth(v)}</td></tr>`;
  }).join('');
  return `<h2 id="hs-breakdown">${L('The HS breakdown: which part could be AI compute?', 'Rincian HS: bagian mana yang berpotensi menjadi komputasi AI?')}</h2>
<p>${L('HS is a customs product classification. The first four digits, <strong>8471</strong>, group computers and related units; the six-digit subheadings separate their forms and functions. The table uses the supplied import values and simplified descriptions from the <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/168471">WCO HS nomenclature</a>. These codes do not encode a GPU brand, model or AI workload.', 'HS adalah klasifikasi produk kepabeanan. Empat digit pertama, <strong>8471</strong>, mengelompokkan komputer dan unit terkait; subpos enam digit membedakan bentuk dan fungsinya. Tabel menggunakan nilai impor yang disediakan dan deskripsi ringkas dari <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/168471">nomenklatur HS WCO</a>. Kode ini tidak menyebut merek GPU, model, atau beban kerja AI.')}</p>
<p class="source">${L('January–July in both years · US$ millions · scroll the table horizontally on small screens', 'Januari–Juli pada kedua tahun · juta US$ · geser tabel secara horizontal pada layar kecil')}</p>
<div class="table-scroll" role="region" aria-label="${L('HS import breakdown', 'Rincian impor menurut HS')}" tabindex="0"><table class="hs-table"><caption>${L('All eight subcategories in the supplied HS 8471 dataset', 'Delapan subkategori dalam dataset HS 8471 yang disediakan')}</caption><thead><tr><th scope="col">${L('HS code / computing role', 'Kode HS / peran komputasi')}</th><th scope="col">2025</th><th scope="col">2026</th><th scope="col">${L('Change', 'Perubahan')}</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th scope="row">8471 · ${L('Parent total', 'Total induk')}</th><td>${n(values['8471'].prior)}</td><td>${n(values['8471'].current)}</td><td>${growth(values['8471'])}</td></tr></tfoot></table></div>
<p class="source">${L('The 8471 total already includes its subcategories. Small differences in their sum reflect source rounding. Research priorities are our interpretation; they are not AI classifications supplied by customs.', 'Total 8471 sudah mencakup subkategorinya. Selisih kecil dalam penjumlahan berasal dari pembulatan sumber. Prioritas riset adalah interpretasi kami, bukan klasifikasi AI dari bea cukai.')}</p>
<h3>${L('847150: the strongest lead for server compute', '847150: petunjuk terkuat untuk komputasi server')}</h3>
<p>${L('This category covers processing units outside 847141 and 847149; a unit may incorporate storage or input/output hardware. Its US$2.851 billion total is the first place we would inspect shipment descriptions for GPU-equipped servers. Its US$1.778 billion increase explains about 72% of the entire HS 8471 increase. <strong>“Processing unit” does not mean a standalone GPU chip</strong>, and conventional CPU servers are an alternative explanation.', 'Kategori ini mencakup unit pemrosesan di luar 847141 dan 847149; unit dapat menyertakan penyimpanan atau perangkat input/output. Total US$2,851 miliar menjadi tempat pertama untuk memeriksa deskripsi pengiriman server ber-GPU. Kenaikan US$1,778 miliar menjelaskan sekitar 72% dari seluruh kenaikan HS 8471. <strong>“Unit pemrosesan” tidak berarti chip GPU tersendiri</strong>, dan server CPU konvensional merupakan penjelasan alternatif.')}</p>
<h3>${L('847149: the lead for systems imported together', '847149: petunjuk untuk komputer yang diimpor sebagai sistem')}</h3>
<p>${L('The US$1.090 billion total covers computers presented as systems. It is a candidate pool for investigating integrated AI systems, but the wording does not establish that an import is a GPU rack, a complete cluster or an AI data center. Whether a particular H200/B300 shipment belongs here or under another code depends on its configuration and customs declaration.', 'Total US$1,090 miliar mencakup komputer yang disajikan sebagai sistem. Kategori ini dapat ditelusuri untuk sistem AI terintegrasi, tetapi deskripsinya tidak memastikan bahwa suatu impor berupa rak GPU, klaster lengkap, atau pusat data AI. Apakah pengiriman H200/B300 tertentu masuk ke sini atau kode lain bergantung pada konfigurasi dan deklarasi kepabeanannya.')}</p>
<h3>${L('847180 and storage: useful cross-checks', '847180 dan penyimpanan: pemeriksaan silang')}</h3>
<p>${L('Other computer units (847180) fell 23.2% to US$25.387 million, while data-storage units (847170) fell 2.9% to US$149.649 million. Neither series is included in our AI allocation. A decline in these aggregates cannot rule out cluster purchases: components may arrive inside complete servers or under other classifications. The 847180 label alone does not identify an accelerator board.', 'Unit komputer lainnya (847180) turun 23,2% menjadi US$25,387 juta, sedangkan unit penyimpanan data (847170) turun 2,9% menjadi US$149,649 juta. Kedua seri tidak dimasukkan dalam alokasi AI. Penurunan agregat ini tidak meniadakan kemungkinan pembelian klaster: komponen dapat datang di dalam server lengkap atau dalam klasifikasi lain. Label 847180 saja tidak mengidentifikasi papan akselerator.')}</p>
<h3>${L('Beyond this dataset: chips, parts and the network', 'Di luar dataset ini: chip, komponen, dan jaringan')}</h3>
<p>${L('A wider investigation should also examine <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/168542">854231</a> for processor/controller integrated circuits, <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/16847330">847330</a> for computer parts and accessories, and <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/16851762">851762</a> for data-communication equipment, including switches and routers. These are search categories, not assigned codes for any specific NVIDIA product. An assembled accelerator card is not automatically classified like a bare chip. <strong>No import values for these three codes are present in the supplied dataset</strong>, so none are added to the estimate.', 'Penyelidikan lebih luas juga perlu memeriksa <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/168542">854231</a> untuk sirkuit terpadu prosesor/pengendali, <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/16847330">847330</a> untuk komponen dan aksesori komputer, serta <a href="https://www.wcotradetools.org/en/harmonized-system/2022/en/16851762">851762</a> untuk perangkat komunikasi data, termasuk switch dan router. Ini adalah kategori pencarian, bukan penetapan kode untuk produk NVIDIA tertentu. Kartu akselerator rakitan tidak otomatis diklasifikasikan seperti chip lepas. <strong>Dataset yang disediakan tidak memuat nilai impor ketiga kode ini</strong>, sehingga tidak ada nilainya yang ditambahkan ke estimasi.')}</p>`;
}

module.exports = { render, values };
