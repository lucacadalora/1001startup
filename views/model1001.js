'use strict';
/* 1001startup.id/model — the formal statement of the census GVA estimator.
 * Same shell + design system as pages1001.js. Everything numeric in the HTML
 * and hand-drawn SVGs is computed from census.json per request; only the TeX
 * equation SVGs are baked into data/model-tex.json —
 * re-run `node scripts/build-model-tex.js` after build-census.js so the
 * numbers quoted inside equations keep matching the page around them.
 * Chart colors #C9532E/#2A6E9F are darkened brand-hue steps that pass
 * colorblind + contrast validation on white (raw #E8734B and #4E7A96 fail). */
const { esc } = require('../lib/util');
const { V } = require('./html');   // shared cache-buster: /js and /css ship immutable
const NAV = require('./nav1001'); // one header for every 1001 page
const I18N = require('./i18n1001');
const SCHEMA = require('./schema1001'); // L(en, id) inline pairs + /id link prefix + hreflang head block

const GRAD = 'linear-gradient(90deg,#E8734B,#F3C64B,#7AB88A,#4E7A96)';

const LABELS = { fintech: 'Fintech', 'ai-cloud': 'AI & Cloud', saas: 'SaaS', media: 'Media & Gaming', health: 'Healthtech', prop: 'Proptech', edtech: 'Edtech', commerce: 'Commerce', misc: 'Other / Insurtech', travel: 'Travel & Mobility', agri: 'Agritech', logistics: 'Logistics', fnb: 'F&B & D2C', climate: 'Climate & Sustainability', bank: 'Digital Banking' };
const KEY_BY_NAME = { Fintech: 'fintech', Commerce: 'commerce', Logistics: 'logistics', 'Travel & Mobility': 'travel', Edtech: 'edtech', Insurtech: 'misc', 'F&B & D2C': 'fnb', 'Media & Gaming': 'media', SaaS: 'saas', Healthtech: 'health', 'AI & Cloud': 'ai-cloud', Proptech: 'prop', Agritech: 'agri', 'Other tech': 'misc', 'Climate & Sustainability': 'climate', 'Digital Banking': 'bank' };

const MERMAID_SRC = `flowchart TD
  A["company record i (hand-checked)"] --> B{"headcount h_i known?"}
  B -- no --> Z["output NULL — never imputed from funding or valuation"]
  B -- yes --> C["s(i) = ordered sector regex, first match wins"]
  C --> D["G_i = h_i × a_s(i)"]
  D --> E{"gates: G_i ≤ take-rate revenue? pre-revenue ≈ payroll?"}
  E -- fail --> R["re-check h_i and sector wording"] --> C
  E -- pass --> S["sum into portfolio D"]
  S --> K["T = κ × D, applied once portfolio-wide"]
  K --> U["USD at spot rate e"]`;

const fmt = (n, d = 0) => (n === null || n === undefined) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d });

/* ── Fig 2: anchors against the raw BPS cells (0..2,600 jt/worker) ── */
function anchorChart(anchors) {
  const rows = Object.entries(anchors).map(([k, v]) => ({ label: LABELS[k] || k, v })).sort((a, b) => b.v - a.v);
  const W = 1040, PAD_L = 172, PAD_R = 30, ROW = 27, PAD_T = 46, PAD_B = 34;
  const H = PAD_T + rows.length * ROW + PAD_B;
  const X = (v) => PAD_L + (v / 2600) * (W - PAD_L - PAD_R);
  /* CAP = the M,N professional-services cap. Anchors are normally below it; the
     licensed-bank anchor is deliberately above, because the cap exists to stop
     startups being priced at bank-average productivity and banks are the firms
     that produce that average. Drawn in the K-cell blue it derives from, so the
     exception reads as intentional rather than as a bar that overshot. */
  const CAP = 1282;
  const above = rows.filter((r) => r.v > CAP);
  const lo = Math.min(...rows.map((r) => r.v)), hi = Math.max(...rows.map((r) => r.v));
  const aria = `Sector anchors, Rp ${fmt(lo)} to ${fmt(hi)} million per worker`
    + (above.length
      ? `. ${above.map((r) => r.label).join(' and ')} sits above the professional-services cap of 1,282 by construction; every other anchor is below it`
      : `, all below the professional-services cap of 1,282`)
    + `, while raw finance and ICT cells sit at 1,976 and 2,453`;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}" style="max-width:100%;height:auto;font-family:'IBM Plex Mono',monospace">`;
  for (const gv of [0, 500, 1000, 1500, 2000, 2500]) {
    s += `<line x1="${X(gv)}" y1="${PAD_T - 8}" x2="${X(gv)}" y2="${H - PAD_B}" stroke="#E7E7E7" stroke-width="1"/>`;
    s += `<text x="${X(gv)}" y="${H - PAD_B + 18}" font-size="10.5" fill="#8E8E93" text-anchor="middle">${gv.toLocaleString('en-US')}</text>`;
  }
  for (const r of [
    { v: 2453, c: '#2A6E9F', dash: '' }, { v: 1976, c: '#2A6E9F', dash: '' },
    { v: 1464, c: '#8E8E93', dash: '4 4' }, { v: 1282, c: '#000', dash: '6 3' },
  ]) s += `<line x1="${X(r.v)}" y1="${PAD_T - 8}" x2="${X(r.v)}" y2="${H - PAD_B}" stroke="${r.c}" stroke-width="1.5" ${r.dash ? `stroke-dasharray="${r.dash}"` : ''}/>`;
  s += `<text x="${X(1282)}" y="${PAD_T - 26}" font-size="10.5" fill="#000" text-anchor="middle">M,N CAP 1,282</text>`;
  s += `<text x="${X(1464)}" y="${PAD_T - 12}" font-size="10.5" fill="#8E8E93" text-anchor="middle">L 1,464 EXCL.</text>`;
  s += `<text x="${X(1976)}" y="${PAD_T - 12}" font-size="10.5" fill="#2A6E9F" text-anchor="middle">K FINANCE 1,976</text>`;
  s += `<text x="${X(2453)}" y="${PAD_T - 26}" font-size="10.5" fill="#2A6E9F" text-anchor="end">J INFO&amp;COMM 2,453</text>`;
  rows.forEach((r, i) => {
    const y = PAD_T + i * ROW + ROW / 2;
    s += `<g class="hv" data-tip="${esc(r.label)}: Rp ${r.v.toLocaleString('en-US')} jt/worker/yr${r.v > CAP ? ' — above the M,N cap by construction: licensed banks are priced off the raw K cell, not capped down to a startup anchor' : ''}">`;
    s += `<rect x="0" y="${y - ROW / 2}" width="${W}" height="${ROW}" fill="transparent"/>`;
    s += `<text x="${PAD_L - 10}" y="${y + 4}" font-size="11.5" fill="#000" text-anchor="end" font-family="'Overused Grotesk',sans-serif">${esc(r.label)}</text>`;
    const col = r.v > CAP ? '#2A6E9F' : '#C9532E';
    s += `<line x1="${X(0)}" y1="${y}" x2="${X(r.v) - 5}" y2="${y}" stroke="${col}" stroke-width="2"/>`;
    s += `<circle cx="${X(r.v)}" cy="${y}" r="4.5" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${X(r.v) + 11}" y="${y + 4}" font-size="11" fill="#52525B">${r.v.toLocaleString('en-US')}</text></g>`;
  });
  return s + `</svg>`;
}

/* ── Fig 3: direct GVA by sector ── */
function sectorChart(bySector, dT) {
  const W = 1040, PAD_L = 172, PAD_R = 150, ROW = 27, PAD_T = 26, PAD_B = 34;
  const H = PAD_T + bySector.length * ROW + PAD_B;
  const max = Math.max(...bySector.map((r) => r.gva_idr_bn), 1);
  const xmax = Math.ceil(max / 5000) * 5000;
  const X = (v) => PAD_L + (v / xmax) * (W - PAD_L - PAD_R);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Direct GVA by sector, the decomposition of D = ${dT} trillion rupiah a year" style="max-width:100%;height:auto;font-family:'IBM Plex Mono',monospace">`;
  for (let gv = 0; gv <= xmax; gv += 5000) {
    s += `<line x1="${X(gv)}" y1="${PAD_T - 8}" x2="${X(gv)}" y2="${H - PAD_B}" stroke="#E7E7E7" stroke-width="1"/>`;
    s += `<text x="${X(gv)}" y="${H - PAD_B + 18}" font-size="10.5" fill="#8E8E93" text-anchor="middle">${gv / 1000}T</text>`;
  }
  bySector.forEach((r, i) => {
    const y = PAD_T + i * ROW + ROW / 2;
    const gvaT = (r.gva_idr_bn / 1000).toFixed(1);
    s += `<g class="hv" data-tip="${esc(r.name)}: ${r.count} companies · ${fmt(r.jobs)} jobs · IDR ${gvaT}T/yr direct">`;
    s += `<rect x="0" y="${y - ROW / 2}" width="${W}" height="${ROW}" fill="transparent"/>`;
    s += `<text x="${PAD_L - 10}" y="${y + 4}" font-size="11.5" fill="#000" text-anchor="end" font-family="'Overused Grotesk',sans-serif">${esc(r.name)}</text>`;
    s += `<rect x="${X(0)}" y="${y - 8}" width="${Math.max(X(r.gva_idr_bn) - X(0), 2)}" height="16" fill="#2A6E9F"/>`;
    s += `<text x="${X(r.gva_idr_bn) + 9}" y="${y + 4}" font-size="11" fill="#52525B">${gvaT}T · ${fmt(r.jobs)} jobs</text></g>`;
  });
  return s + `</svg>`;
}

/* ── Fig 4: error of the sum vs N ── */
function errorChart(neff, nWith) {
  const W = 1040, H = 300, PAD_L = 64, PAD_R = 40, PAD_T = 24, PAD_B = 44, NMAX = 300;
  const X = (n) => PAD_L + (Math.log10(n) / Math.log10(NMAX)) * (W - PAD_L - PAD_R);
  const Y = (p) => PAD_T + (1 - p / 55) * (H - PAD_T - PAD_B);
  const pts = [];
  for (let i = 0; i <= 200; i++) {
    const n = Math.pow(10, (i / 200) * Math.log10(NMAX));
    pts.push(`${X(n).toFixed(1)},${Y(50 / Math.sqrt(n)).toFixed(1)}`);
  }
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Relative error of the portfolio sum falls as one over the square root of N: 50 percent for one company, about ${(50 / Math.sqrt(neff)).toFixed(0)} percent at the concentration-adjusted N-effective of ${neff.toFixed(1)}" style="max-width:100%;height:auto;font-family:'IBM Plex Mono',monospace">`;
  for (const p of [0, 10, 20, 30, 40, 50]) {
    s += `<line x1="${PAD_L}" y1="${Y(p)}" x2="${W - PAD_R}" y2="${Y(p)}" stroke="#E7E7E7" stroke-width="1"/>`;
    s += `<text x="${PAD_L - 8}" y="${Y(p) + 4}" font-size="10.5" fill="#8E8E93" text-anchor="end">${p}%</text>`;
  }
  for (const n of [1, 3, 10, 30, 100, 300]) {
    s += `<text x="${X(n)}" y="${H - PAD_B + 18}" font-size="10.5" fill="#8E8E93" text-anchor="middle">${n}</text>`;
    s += `<line x1="${X(n)}" y1="${H - PAD_B}" x2="${X(n)}" y2="${H - PAD_B + 5}" stroke="#8E8E93" stroke-width="1"/>`;
  }
  s += `<text x="${(PAD_L + W - PAD_R) / 2}" y="${H - 8}" font-size="10.5" fill="#8E8E93" text-anchor="middle">COMPANIES SUMMED, N (LOG SCALE)</text>`;
  s += `<polyline points="${pts.join(' ')}" fill="none" stroke="#2A6E9F" stroke-width="2"/>`;
  const marks = [
    { n: 1, t: 'one row: ±50%', a: 'start', dx: 12, dy: 0, c: '#2A6E9F' },
    { n: neff, t: `Nₑᶠᶠ = ${neff.toFixed(1)} → ~${(50 / Math.sqrt(neff)).toFixed(1)}%`, a: 'start', dx: 12, dy: -6, c: '#C9532E' },
    { n: nWith, t: `naive N = ${nWith} → ${(50 / Math.sqrt(nWith)).toFixed(1)}%`, a: 'end', dx: -10, dy: -18, c: '#8E8E93' },
  ];
  for (const mk of marks) {
    s += `<g class="hv" data-tip="${esc(mk.t)}"><circle cx="${X(mk.n)}" cy="${Y(50 / Math.sqrt(mk.n))}" r="5.5" fill="${mk.c}" stroke="#fff" stroke-width="2"/>`;
    s += `<text x="${X(mk.n) + mk.dx}" y="${Y(50 / Math.sqrt(mk.n)) + 4 + mk.dy}" font-size="11" fill="#52525B" text-anchor="${mk.a}">${esc(mk.t)}</text></g>`;
  }
  return s + `</svg>`;
}

/* ── shared diagram primitives (Fig 1 + Fig 5 draw in one idiom) ──
   White fill, hairline black stroke, square corners, Plex Mono — the site's
   design system, so the figures read as part of the page rather than as
   output from some other tool. */
const box = (x, y, w, h, lines, opts = {}) => {
  let t = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${opts.accent ? '#E8734B' : '#000'}" stroke-width="${opts.accent ? 1.6 : 1.2}" ${opts.dash ? 'stroke-dasharray="4 4"' : ''}/>`;
  lines.forEach((ln, i) => {
    t += `<text x="${x + w / 2}" y="${y + (opts.pad || 20) + i * 15}" font-size="${ln.big ? 13 : 11}" text-anchor="middle" fill="${ln.dim ? '#8E8E93' : '#000'}" ${ln.mono === false ? `font-family="'Overused Grotesk',sans-serif"` : ''} ${ln.big ? 'font-weight="600"' : ''}>${ln.t}</text>`;
  });
  return t;
};
/* decision node — the diamond is load-bearing: it marks the two points where a
   record can leave the happy path (no headcount, failed gate) */
const diamond = (cx, cy, hw, hh, lines) => {
  let t = `<polygon points="${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}" fill="#fff" stroke="#000" stroke-width="1.2"/>`;
  const top = cy - ((lines.length - 1) * 15) / 2 + 4;
  lines.forEach((ln, i) => {
    t += `<text x="${cx}" y="${top + i * 15}" font-size="${ln.big ? 12.5 : 11}" text-anchor="middle" fill="${ln.dim ? '#8E8E93' : '#000'}" ${ln.big ? 'font-weight="600"' : ''}>${ln.t}</text>`;
  });
  return t;
};
const arrow = (x1, y1, x2, y2, label, opts = {}) => {
  const c = opts.blocked ? '#C9532E' : '#000';
  let t = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1.2" ${opts.dash ? 'stroke-dasharray="4 4"' : ''} marker-end="url(#arr${opts.blocked ? 'b' : ''})"/>`;
  if (label) t += `<text x="${(x1 + x2) / 2 + (opts.lx || 0)}" y="${(y1 + y2) / 2 + (opts.ly || -7)}" font-size="10" text-anchor="middle" fill="${opts.blocked ? '#C9532E' : '#52525B'}">${label}</text>`;
  return t;
};
/* multi-segment connector for the gate-failure loop */
const elbow = (pts, label, opts = {}) => {
  let t = `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#000" stroke-width="1.2" marker-end="url(#arr)"/>`;
  if (label) t += `<text x="${opts.lx}" y="${opts.ly}" font-size="10" text-anchor="${opts.anchor || 'middle'}" fill="#52525B">${label}</text>`;
  return t;
};
const ARROW_DEFS = `<defs>
    <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#000"/></marker>
    <marker id="arrb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#C9532E"/></marker>
  </defs>`;

/* ── Fig 1: the estimation pipeline ── */
function pipeline(v) {
  let s = `<svg viewBox="0 0 1120 620" role="img" aria-label="Pipeline: BPS PDRB and Sakernas tables produce raw per-worker cells, capped and discounted into 13 sector anchors; each hand-checked company record contributes headcount times anchor; sums flow through the 1.5 multiplier and FX; GMV, funding and valuation never enter the estimator and are used only as sanity gates" style="max-width:100%;height:auto;font-family:'IBM Plex Mono',monospace">
  ${ARROW_DEFS}`;
  s += `<text x="20" y="30" font-size="10.5" fill="#8E8E93" letter-spacing="1">ANCHOR CONSTRUCTION — ONCE, FROM BPS TABLES</text>`;
  s += box(20, 44, 200, 78, [{ t: 'BPS PDRB ADHB 2023', big: true }, { t: 'Vₖ by sector' }, { t: 'DKI Rp 3,679 T total', dim: true }]);
  s += box(20, 138, 200, 78, [{ t: 'SAKERNAS AUG 2023', big: true }, { t: 'Lₖ by sector' }, { t: '5,072,737 employed', dim: true }]);
  s += arrow(220, 83, 288, 116, 'Vₖ', { ly: -4, lx: 8 });
  s += arrow(220, 177, 288, 144, '÷ Lₖ', { ly: 12, lx: 8 });
  s += box(290, 92, 210, 76, [{ t: 'RAW CELLS gₖ  (Rp jt/wkr)', big: true }, { t: 'J 2,453 · K 1,976 · M,N 1,282' }, { t: 'L 1,464 dropped: imputed rents', dim: true }]);
  s += arrow(500, 130, 596, 130, '', {});
  s += `<text x="548" y="116" font-size="10" text-anchor="middle" fill="#52525B">cap · discount</text>`;
  s += `<text x="548" y="148" font-size="10" text-anchor="middle" fill="#52525B">δ ∈ 0.70–0.85</text>`;
  s += box(598, 92, 236, 76, [{ t: 'ANCHOR TABLE aₛ', big: true }, { t: `${v.aCount} sectors · ${v.aMin}–${v.aMax} jt` }, { t: `default ḡ = ${v.aDef} jt`, dim: true }], { accent: true });
  s += `<text x="20" y="268" font-size="10.5" fill="#8E8E93" letter-spacing="1">PER COMPANY — ${v.nAll} HAND-CHECKED RECORDS</text>`;
  s += box(20, 282, 236, 92, [{ t: 'COMPANY RECORD i', big: true }, { t: 'PT · HQ address · funding', mono: false }, { t: 'headcount hᵢ (LinkedIn bands)', mono: false }, { t: 'gig workers excluded', dim: true }]);
  s += arrow(256, 314, 350, 314, '', {});
  s += `<text x="303" y="302" font-size="10" text-anchor="middle" fill="#52525B">s(i) regex</text>`;
  s += `<text x="303" y="332" font-size="10" text-anchor="middle" fill="#52525B">first match wins</text>`;
  s += box(352, 288, 120, 52, [{ t: '×', big: true }, { t: 'hᵢ · aₛ₍ᵢ₎' }]);
  s += arrow(716, 168, 412, 286, 'aₛ lookup', { ly: -6, lx: 40 });
  s += arrow(472, 314, 566, 314, '', {});
  s += box(568, 288, 150, 52, [{ t: 'Ĝᵢ direct GVA', big: true }, { t: 'IDR bn / yr' }]);
  s += arrow(138, 374, 138, 420, 'hᵢ unknown', { dash: true, ly: -4, lx: 52 });
  s += box(58, 422, 160, 46, [{ t: '∅  no imputation', big: true }, { t: `${v.nNull} of ${v.nAll} rows`, dim: true }], { dash: true });
  s += arrow(643, 340, 643, 388, '', {});
  s += box(538, 390, 210, 62, [{ t: 'SANITY GATES', big: true }, { t: 'Ĝᵢ ≤ take-rate revenue' }, { t: 'pre-revenue ≈ payroll' }]);
  s += arrow(748, 421, 824, 330, 'pass', { lx: -12, ly: -8 });
  s += box(20, 500, 236, 62, [{ t: 'GMV · FUNDING · VALUATION', big: true }, { t: 'reported, headline-friendly', mono: false, dim: true }]);
  s += arrow(256, 520, 350, 344, 'never an input', { blocked: true, lx: 64, ly: 8 });
  s += `<line x1="293" y1="422" x2="313" y2="442" stroke="#C9532E" stroke-width="2"/><line x1="313" y1="422" x2="293" y2="442" stroke="#C9532E" stroke-width="2"/>`;
  s += arrow(256, 540, 530, 540, 'upper bound τᵢ·GMVᵢ only', { dash: true, ly: -6 });
  s += arrow(532, 540, 620, 456, '', { dash: true });
  s += `<text x="826" y="268" font-size="10.5" fill="#8E8E93" letter-spacing="1">PORTFOLIO — SUMS ONLY</text>`;
  s += box(826, 282, 270, 58, [{ t: 'Σ D = Σ hᵢ aₛ₍ᵢ₎', big: true }, { t: `IDR ${v.dT} T / yr · ${fmt(v.jobs)} jobs` }], { accent: true });
  s += arrow(961, 340, 961, 380, `× κ = ${v.kappa} · applied once`, { ly: 4, lx: -88 });
  s += box(826, 382, 270, 52, [{ t: `T = κD = IDR ${v.tT} T / yr`, big: true }, { t: 'direct + indirect + induced' }]);
  s += arrow(961, 434, 961, 474, `÷ e = ${fmt(v.fx)} IDR/USD`, { ly: 4, lx: -78 });
  s += box(826, 476, 270, 52, [{ t: `US$ ${v.usdB} B / yr total`, big: true }, { t: `US$ ${v.usdDirB} B direct`, dim: true }]);
  return s + `</svg>`;
}

/* ── Fig 5: the per-record decision path ──
   Hand-drawn rather than mermaid-rendered: mermaid's top-down layout stacked
   this into a ~1,300px column of grey boxes that dwarfed the page and matched
   nothing else on it. Snake layout — record → decision → estimate → gate, then
   back leftward through the portfolio steps — fits the same width in a third
   the height. The mermaid source stays available under the figure to copy. */
function flowFig(v) {
  let s = `<svg viewBox="0 0 1000 384" role="img" aria-label="Per-record decision path: a company record with no headcount outputs null; otherwise its sector is assigned by ordered regex, direct GVA is headcount times anchor, and the sanity gates either send it back for re-checking or pass it into the portfolio sum, the 1.5 multiplier and the FX conversion" style="max-width:100%;height:auto;font-family:'IBM Plex Mono',monospace">${ARROW_DEFS}`;

  /* return path along the top */
  s += box(655, 20, 210, 38, [{ t: 'RE-CHECK hᵢ + SECTOR', big: true }], { pad: 24 });

  /* row 1 — the record and its estimate */
  s += box(30, 78, 170, 54, [{ t: 'COMPANY RECORD i', big: true }, { t: 'hand-checked', dim: true }]);
  s += diamond(300, 105, 72, 48, [{ t: 'hᵢ KNOWN?', big: true }]);
  s += box(420, 78, 170, 54, [{ t: 's(i) SECTOR REGEX', big: true }, { t: 'first match wins', dim: true }]);
  s += box(620, 78, 170, 54, [{ t: 'Ĝᵢ = hᵢ · aₛ₍ᵢ₎', big: true }, { t: 'IDR bn / yr', dim: true }]);
  s += arrow(200, 105, 228, 105, '');
  s += arrow(372, 105, 420, 105, 'yes', { ly: -8 });
  s += arrow(590, 105, 620, 105, '');

  /* the null branch — the row leaves the model here */
  s += arrow(300, 153, 300, 200, 'no', { lx: -14, ly: 20 });
  s += box(205, 200, 190, 44, [{ t: '∅ OUTPUT NULL', big: true }, { t: `${v.nNull} of ${v.nAll} rows`, dim: true }], { dash: true, pad: 19 });

  /* row 2 — the gate, then the portfolio steps running back leftward */
  s += arrow(705, 132, 705, 244, '');
  s += diamond(705, 300, 95, 56, [{ t: 'SANITY GATES', big: true }, { t: 'Ĝᵢ ≤ take-rate rev.', dim: true }]);
  s += box(420, 273, 155, 54, [{ t: 'Σ INTO D', big: true }, { t: `IDR ${v.dT} T / yr` }]);
  s += box(230, 273, 155, 54, [{ t: 'T = κD', big: true }, { t: `IDR ${v.tT} T / yr` }]);
  s += box(40, 273, 155, 54, [{ t: 'US$ / yr', big: true }, { t: `${v.usdB} B total` }]);
  s += arrow(610, 300, 575, 300, 'pass', { ly: -9 });
  s += arrow(420, 300, 385, 300, `× κ`, { ly: -9 });
  s += arrow(230, 300, 195, 300, '÷ e', { ly: -9 });

  /* gate failure loops back to the sector call, around the right and over the top */
  s += elbow([[800, 300], [960, 300], [960, 39], [869, 39]], 'fail', { lx: 830, ly: 291 });
  s += elbow([[655, 39], [505, 39], [505, 74]], '', {});
  return s + `</svg>`;
}

function model({ data, tex, lang = 'en' }) {
  const L = I18N.mkL(lang);
  const PF = I18N.pfx(lang);
  const T = (data && data.totals) || {};
  const m = (data && data.method) || {};
  const bySector = (data && data.by_sector) || [];
  const companies = (data && data.companies) || [];
  const anchors = m.gva_per_worker_idr_m_by_sector || {};
  const F = (tex && tex.svgs) || {};

  /* live statistics — same definitions as scripts/build-model-tex.js */
  const g = companies.map((c) => c.est_gva_idr_bn).filter(Boolean);
  const D = g.reduce((s, x) => s + x, 0) || 1;
  const neff = (D * D) / (g.reduce((s, x) => s + x * x, 0) || 1);
  const top5 = g.slice().sort((a, b) => b - a).slice(0, 5).reduce((s, x) => s + x, 0);
  const aVals = Object.values(anchors);
  const v = {
    nAll: companies.length, nWith: g.length, nNull: companies.length - g.length,
    dT: (D / 1000).toFixed(1), tT: ((D * (m.indirect_multiplier || 1)) / 1000).toFixed(1),
    usdB: ((D * (m.indirect_multiplier || 1)) / (m.fx_idr_per_usd || 1)).toFixed(1),
    usdDirB: (D / (m.fx_idr_per_usd || 1)).toFixed(1),
    jobs: T.jobs, kappa: m.indirect_multiplier, fx: m.fx_idr_per_usd,
    aMin: Math.min(...aVals), aMax: fmt(Math.max(...aVals)), aDef: m.default_gva_per_worker_idr_m,
    aCount: aVals.length,
    /* sector buckets that exist in the census but have no dedicated anchor —
       they fall back to the default, and the page has to say so */
    onDefault: bySector.filter((r) => !anchors[KEY_BY_NAME[r.name]]).map((r) => r.name),
    neff, top5Pct: ((top5 / D) * 100).toFixed(1),
  };
  const upd = ((data && data.generated) || '').slice(0, 10);

  const eq = (name, key, note) => F[key] ? `
  <div class="eq"><div class="eqtag">${name}</div><div class="eqbody">${F[key]}</div>
  ${note ? `<div class="eqnote">${note}</div>` : ''}</div>` : '';

  const tableRows = bySector.map((r) => {
    const own = anchors[KEY_BY_NAME[r.name]];
    const a = own || m.default_gva_per_worker_idr_m;
    return `<tr><td>${esc(r.name)}${own ? '' : ' <span class="dflt">default</span>'}</td><td class="n">${fmt(a)}</td><td class="n">${r.count}</td><td class="n">${fmt(r.jobs)}</td><td class="n">${(r.gva_idr_bn / 1000).toFixed(1)}</td></tr>`;
  }).join('\n');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${L('The model', 'Model estimasi nilai tambah')} — 1001startup.id</title>
<meta name="description" content="${L(
    'The GVA estimator behind the census, written out: BPS anchors, the per-company product, the multiplier, the error model and the gates.',
    'Metodologi sensus startup Indonesia, ditulis formal: anchor dari tabel BPS, hasil kali per perusahaan, multiplier 1.5, model galat, dan gerbang uji kewajaran.')}">
${I18N.headTags(lang, '/model')}
${SCHEMA.breadcrumbLd(lang, [{ name: '1001startup.id', path: '/' }, { name: L('The formal model', 'Model formal'), path: '/model' }])}
${I18N.ogImage()}
<meta name="robots" content="index, follow">
<meta property="og:title" content="${L('The model', 'Model estimasi nilai tambah')} — 1001startup.id">
<meta property="og:description" content="${L(
    `How ${fmt(T.companies)} hand-checked records become IDR ${v.dT}T a year — every equation, anchor and gate stated so it can be stress-tested.`,
    `Bagaimana ${fmt(T.companies)} catatan yang diperiksa manual menjadi IDR ${v.dT}T per tahun — setiap persamaan, anchor, dan gerbang dinyatakan terbuka agar bisa diuji.`)}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" href="/assets/favicon-1001-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon-1001.png">
<link rel="preload" href="/assets/fonts/overused-grotesk-vf.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/px.css?v=${V}">
<style>
@font-face{font-family:'Overused Grotesk';font-style:normal;font-weight:300 900;font-display:swap;src:url(/assets/fonts/overused-grotesk-vf.woff2) format('woff2')}
@font-face{font-family:'IBM Plex Mono';font-style:normal;font-weight:400;font-display:swap;src:url(/assets/fonts/plex-mono-400.woff2) format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fff;color:#000;font:500 16px/1.55 'Overused Grotesk',system-ui,sans-serif;letter-spacing:-0.01em}
a{color:inherit}
.mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em}
.banner{background:${GRAD};color:#000;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:8px 12px}
${NAV.css}
main{max-width:1180px;margin:0 auto;padding:0 20px 40px}
.hero{padding:52px 0 40px;border-bottom:1px solid #E7E7E7}
.hero h1{font-weight:640;font-size:clamp(34px,5.4vw,58px);line-height:1.04;letter-spacing:-0.03em;text-wrap:balance;max-width:860px}
.hero .sub{max-width:640px;margin-top:18px;color:#52525B;font-size:16.5px;line-height:1.55}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1px;margin-top:38px;border:1px solid #E7E7E7;background:#E7E7E7}
.stats>div{padding:18px 20px 16px;background:#fff}
.stats .v{font-weight:660;font-size:clamp(26px,3.2vw,38px);letter-spacing:-0.03em;background:${GRAD};-webkit-background-clip:text;background-clip:text;color:transparent;font-variant-numeric:tabular-nums}
.stats .k{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#6B6B73;margin-top:6px}
section{padding:44px 0 8px;border-bottom:1px solid #E7E7E7}
section:last-of-type{border-bottom:0}
.eyebrow{font:400 12px/1 'IBM Plex Mono',monospace;letter-spacing:.08em;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:14px}
.eyebrow::before{content:'';width:8px;height:8px;background:#000;flex:none}
section h2{font-weight:640;font-size:clamp(22px,2.8vw,30px);letter-spacing:-0.02em;margin-bottom:12px;text-wrap:balance}
section .lede{max-width:640px;color:#52525B;margin-bottom:24px}
p.body{max-width:640px;color:#52525B;margin:16px 0}
.eq{border:1px solid #E7E7E7;margin:20px 0;background:#fff}
.eqtag{font:400 10px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;color:#6B6B73;padding:10px 14px 0}
.eqbody{padding:16px 18px 20px;overflow-x:auto;color:#000}
.eqbody svg{display:block;margin:0 auto}
.eqnote{font:400 11px/1.6 'IBM Plex Mono',monospace;letter-spacing:.02em;color:#6B6B73;margin:0 14px 12px;border-top:1px dashed #E7E7E7;padding-top:10px}
.imath svg{vertical-align:middle;transform:translateY(-1px)}
figure{margin:26px 0;border:1px solid #E7E7E7}
figure .figbody{padding:18px 14px 10px;overflow-x:auto}
figcaption{font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;padding:10px 14px;border-top:1px solid #E7E7E7}
.tablewrap{overflow-x:auto;margin:22px 0}
table{width:100%;border-collapse:collapse;min-width:600px}
th{font:400 10.5px/1.3 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73;text-align:left;padding:10px 12px;border-bottom:1px solid #E7E7E7;white-space:nowrap;background:#FAFAFA}
td{padding:9px 12px;border-bottom:1px solid #E7E7E7;font-size:14px}
td.n,th.n{text-align:right;font-family:'IBM Plex Mono',monospace;font-size:12.5px;white-space:nowrap;font-variant-numeric:tabular-nums}
td .sym svg{vertical-align:middle}
.dflt{font:400 9.5px/1.45 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.04em;border:1px solid #E7E7E7;color:#6B6B73;padding:1px 5px;vertical-align:1px}
details{border:1px solid #E7E7E7;margin:18px 0}
summary{cursor:pointer;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;padding:12px 14px;color:#52525B}
summary:focus-visible{outline:2px solid #E8734B;outline-offset:-2px}
details pre.srcpre{font:400 12px/1.7 'IBM Plex Mono',monospace;padding:4px 14px 14px;overflow-x:auto;color:#52525B}
.copybtn{display:inline-block;margin:0 14px 14px;padding:9px 14px;font:400 11px/1 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;border:1px solid #000;background:#fff;color:#000;cursor:pointer}
.copybtn:hover{background:#000;color:#fff}
.copybtn:focus-visible{outline:2px solid #E8734B;outline-offset:2px}
.gatecards{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1px;border:1px solid #E7E7E7;background:#E7E7E7;margin:22px 0}
.gatecards>div{padding:16px 18px;background:#fff}
.gatecards .t{font:400 10.5px/1.4 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;color:#BE4E2B;margin-bottom:8px}
.gatecards p{font-size:13.5px;color:#52525B;line-height:1.55}
#tip{position:fixed;pointer-events:none;background:#000;color:#fff;font:400 11.5px/1.5 'IBM Plex Mono',monospace;padding:7px 10px;max-width:280px;opacity:0;transition:opacity .12s;z-index:10}
.hv{cursor:default}
.hv:hover circle{opacity:.82}
footer{max-width:1180px;margin:30px auto 0;padding:22px 20px 40px;border-top:1px solid #E7E7E7;display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;font:400 11px/1.6 'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.05em;color:#6B6B73}
@media (prefers-reduced-motion: reduce){*{transition:none!important}}
</style>
</head>
<body>
<div class="banner">${L('WORKING DRAFT · PUBLIC SOURCES ONLY · EVERY DERIVED FIGURE IS A LABELED ESTIMATE', 'Draf kerja · hanya sumber publik · setiap angka turunan adalah estimasi berlabel')}</div>
${NAV.header('method', { lang, path: '/model', translated: true })}
<main>

<div class="hero">
  <h1>${L(`How a census of ${fmt(T.companies)} startups becomes IDR ${v.dT} trillion a year.`,
    `Bagaimana sensus ${fmt(T.companies)} startup menjadi IDR ${v.dT} triliun per tahun.`)}</h1>
  <p class="sub">${L('The formal statement of the estimator behind 1001startup.id: one anchor table built from two BPS publications, one product per company, one multiplier applied once, and an error model that says which numbers you may quote.',
    'Pernyataan formal estimator di balik 1001startup.id: satu tabel anchor yang dibangun dari dua publikasi BPS, satu hasil kali per perusahaan, satu multiplier yang diterapkan sekali, dan satu model galat yang menentukan angka mana yang boleh dikutip.')}</p>
  <div class="stats">
    <div><div class="v">${fmt(T.companies)}</div><div class="k">${L('Hand-checked companies', 'Perusahaan diperiksa manual')}</div></div>
    <div><div class="v">${fmt(T.jobs)}</div><div class="k">${L('Jobs, gig workers excluded', 'Lapangan kerja, tanpa pekerja gig')}</div></div>
    <div><div class="v">${v.dT}T</div><div class="k">${L('IDR / yr direct GVA', 'Nilai tambah bruto langsung, IDR / thn')}</div></div>
    <div><div class="v">${v.tT}T</div><div class="k">${L(`IDR / yr incl. ×${v.kappa} indirect`, `IDR / thn termasuk ×${v.kappa} tak langsung`)}</div></div>
  </div>
</div>

<section id="estimator">
  <div class="eyebrow">${L('01 · The estimator', '01 · Estimator')}</div>
  <h2>${L('One product per company. Nothing else enters.', 'Satu hasil kali per perusahaan. Besaran lain tidak masuk.')}</h2>
  <p class="lede">${L('Each company contributes headcount times a sector anchor. A row with unknown headcount contributes nothing at all — the model refuses to back into output from funding or valuation.',
    'Setiap perusahaan menyumbang jumlah pekerja dikali anchor sektornya. Baris tanpa jumlah pekerja tidak menyumbang apa pun — model ini menolak menurunkan output dari pendanaan atau valuasi.')}</p>
  ${eq(L('EQ 1 · Per-company direct GVA', 'Pers. 1 · Nilai tambah bruto langsung per perusahaan'), 'estimator')}
  <div class="tablewrap"><table>
    <thead><tr><th>${L('Symbol', 'Simbol')}</th><th>${L('Meaning', 'Arti')}</th><th>${L('Where it comes from', 'Asalnya')}</th></tr></thead>
    <tbody>
      <tr><td class="sym imath">${F.i_hi || 'hᵢ'}</td><td>${L('Headcount estimate', 'Estimasi jumlah pekerja')}</td><td>${L('LinkedIn counts and filings, hand-checked — the whole Indonesian payroll, frontline included; driver-, courier- and seller-mitra deliberately excluded',
        'Hitungan LinkedIn dan dokumen resmi, diperiksa manual — seluruh daftar gaji Indonesia termasuk garda depan; mitra pengemudi, kurir, dan penjual sengaja dikecualikan')}</td></tr>
      <tr><td class="sym imath">${F.i_as || 'aₛ₍ᵢ₎'}</td><td>${L('Sector anchor, Rp jt of GVA per worker per year', 'Anchor sektor, Rp jt nilai tambah bruto per pekerja per tahun')}</td><td>${L('Built in §03 from BPS PDRB + Sakernas; sector assigned by ordered regex, first match wins',
        'Dibangun di §03 dari PDRB BPS + Sakernas; sektor ditetapkan lewat regex berurut, kecocokan pertama menang')}</td></tr>
      <tr><td class="sym imath">a_F</td><td>${L('Frontline anchor, Rp jt of GVA per worker per year', 'Anchor frontline, Rp jt nilai tambah bruto per pekerja per tahun')}</td><td>${L('BPS national economy-wide average (PDB 2023 / employed, Sakernas Aug 2023); prices payrolls marked frontline, and the frontline share of a published split',
        'Rata-rata seluruh ekonomi BPS (PDB 2023 / penduduk bekerja, Sakernas Agu 2023); menghargai daftar gaji bertanda frontline dan bagian garda depan dari rincian resmi')}</td></tr>
      <tr><td class="sym imath">${F.i_kappa || 'κ'}</td><td>${L('Indirect + induced multiplier', 'Multiplier tak langsung + induksi')}</td><td>${L('Judgment informed by Indonesian input–output literature; applied once, portfolio-wide (§04)',
        'Pertimbangan yang berpijak pada literatur input–output Indonesia; diterapkan sekali, untuk seluruh portofolio (§04)')}</td></tr>
      <tr><td class="sym imath">${F.i_null || '∅'}</td><td>${L('Null — row publishes no output', 'Null — baris tidak menerbitkan output')}</td><td>${L(`${v.nNull} of ${v.nAll} records today; imputing from funding or valuation is the double-count trap (§06)`,
        `${v.nNull} dari ${v.nAll} catatan saat ini; imputasi dari pendanaan atau valuasi adalah jebakan penghitungan ganda (§06)`)}</td></tr>
    </tbody>
  </table></div>
</section>

<section id="pipeline">
  <div class="eyebrow">${L('02 · The pipeline', '02 · Alur estimasi')}</div>
  <h2>${L('From two BPS tables to a dollar figure.', 'Dari dua tabel BPS ke satu angka dolar.')}</h2>
  <p class="lede">${L('Every <em>estimated</em> number on the landing page is this graph — the jobs and output figures. The funding and valuation totals beside them are plain sums of sourced figures that never pass through the estimator: the red edge is the one the model exists to forbid, so GMV, funding and valuation reach it only as an upper bound.',
    'Setiap angka berstatus <em>estimasi</em> di halaman depan adalah graf ini — yakni angka lapangan kerja dan output. Total pendanaan dan valuasi di sebelahnya hanyalah penjumlahan angka bersumber yang tidak pernah melewati estimator: model ini ada justru untuk melarang tepi merah itu, sehingga GMV, pendanaan, dan valuasi menyentuhnya hanya sebagai batas atas.')}</p>
  <figure>
    <div class="figbody">${pipeline(v)}</div>
    <figcaption>${L(`Fig 1 · The full estimation pipeline, with live values as of ${esc(upd)}. Dashed edges are checks, the struck red edge is prohibited.`,
      `Gambar 1 · Alur estimasi selengkapnya, dengan nilai terkini per ${esc(upd)}. Tepi putus-putus adalah pemeriksaan; tepi merah yang dicoret adalah yang dilarang.`)}</figcaption>
  </figure>
</section>

<section id="anchors">
  <div class="eyebrow">${L('03 · Anchor construction', '03 · Konstruksi anchor')}</div>
  <h2>${L('Raw BPS cells, capped and discounted.', 'Sel mentah BPS, diberi batas atas dan diskon.')}</h2>
  <p class="lede">${L(`Divide each sector's 2023 value added by its 2023 employed population and you get per-worker figures dominated by telco networks and bank balance sheets. Startups do not operate at that capital intensity, so every anchor is blended, discounted and capped before use — with one deliberate exception, the licensed-bank bucket, which is priced off the finance cell itself.`,
    'Bagilah nilai tambah 2023 tiap sektor dengan penduduk bekerjanya pada 2023, dan hasilnya adalah angka per pekerja yang didominasi jaringan telko dan neraca bank. Startup tidak beroperasi pada intensitas modal seperti itu, sehingga setiap anchor dibaurkan, didiskon, dan diberi batas atas sebelum dipakai — dengan satu pengecualian yang disengaja: kelompok bank berizin, yang dihargai langsung dari sel keuangan itu sendiri.')}</p>
  ${eq(L('EQ 2 · Raw per-worker cell', 'Pers. 2 · Sel mentah per pekerja'), 'rawcell')}
  ${eq(L('EQ 3 · Sector anchor', 'Pers. 3 · Anchor sektor'), 'anchor', L(`gₘₙ = 1,282 jt is the M,N professional-services cap · ḡ = ${v.aDef} jt is the blended default · δ and w are judgment parameters, stated so they can be stress-tested · L (real estate, 1,464 jt) is excluded outright: imputed rents on owner-occupied dwellings, not labor productivity · one bucket is exempt from the cap: licensed banks take the raw K cell at δ = 0.85 (1,680 jt), because the cap exists to stop startups being valued at bank-average productivity and a bank is not a startup being mispriced`,
    `gₘₙ = 1,282 jt adalah batas atas jasa profesional M,N · ḡ = ${v.aDef} jt adalah default bauran · δ dan w adalah parameter pertimbangan, dinyatakan terbuka agar bisa diuji · L (real estat, 1,464 jt) dikecualikan sepenuhnya: sewa imputasian (imputed rents) atas rumah yang dihuni pemiliknya, bukan produktivitas tenaga kerja · satu kelompok bebas dari batas atas: bank berizin memakai sel K mentah pada δ = 0.85 (1,680 jt), karena batas atas itu ada untuk mencegah startup dihargai pada produktivitas rata-rata bank — dan bank bukanlah startup yang salah harga`))}
  <figure>
    <div class="figbody">${anchorChart(anchors)}</div>
    <figcaption>${L(`Fig 2 · The ${v.aCount} anchors (Rp jt GVA/worker/yr) against the raw BPS cells they are derived from. Uncapped J or K averages would overstate startup GVA 2–3×.`,
      `Gambar 2 · Ke-${v.aCount} anchor (Rp jt nilai tambah per pekerja per thn) dibandingkan sel mentah BPS asalnya. Rata-rata J atau K tanpa batas atas akan melebihkan nilai tambah startup 2–3×.`)}</figcaption>
  </figure>
  <p class="body">${L('The vintage mismatch is deliberate conservatism: anchors are 2023 current prices matched to Aug-2023 employment, applied to 2026 headcounts. Jakarta nominal PDRB grew 6.9% in 2024 alone, so true 2026 GVA per worker likely runs 10–20% above these anchors.',
    'Selisih tahun acuan itu disengaja sebagai konservatisme: anchor memakai harga berlaku 2023 yang dipadankan dengan ketenagakerjaan Agustus 2023, lalu diterapkan pada jumlah pekerja 2026. PDRB nominal Jakarta tumbuh 6.9% pada 2024 saja, sehingga nilai tambah per pekerja 2026 yang sebenarnya kemungkinan 10–20% di atas anchor ini.')}</p>
</section>

<section id="aggregation">
  <div class="eyebrow">${L('04 · Aggregation, multiplier, FX', '04 · Agregasi, multiplier, kurs')}</div>
  <h2>${L('Sum, then multiply — in that order, once.', 'Jumlahkan dulu, baru kalikan — dalam urutan itu, sekali saja.')}</h2>
  ${eq(L('EQ 4 · Portfolio direct and total GVA', 'Pers. 4 · Nilai tambah langsung dan total portofolio'), 'aggregation')}
  ${eq(L('EQ 5 · Why κ binds at the portfolio, not the row', 'Pers. 5 · Mengapa κ berlaku di portofolio, bukan di baris'), 'multonce', L('One startup’s indirect effect is partly another’s direct GVA — per-company indirect effects overlap, so they are never summed as if additive',
    'Efek tak langsung satu startup sebagian adalah nilai tambah langsung startup lain — efek tak langsung antarperusahaan saling tumpang-tindih, sehingga tidak pernah dijumlahkan seolah-olah aditif'))}
  ${eq(L('EQ 6 · Currency', 'Pers. 6 · Mata uang'), 'fx')}
  ${eq(L('EQ 7 · The headline chain, live values', 'Pers. 7 · Rantai angka utama, nilai terkini'), 'chain')}
  <figure>
    <div class="figbody">${sectorChart(bySector, v.dT)}</div>
    <figcaption>${L(`Fig 3 · Direct GVA by sector, IDR T/yr — the decomposition of D = ${v.dT}T. Hover a bar for company count and jobs.`,
      `Gambar 3 · Nilai tambah langsung per sektor, IDR T/thn — dekomposisi D = ${v.dT}T. Arahkan kursor ke batang untuk jumlah perusahaan dan lapangan kerja.`)}</figcaption>
  </figure>
  <div class="tablewrap"><table>
    <thead><tr><th>${L('Sector', 'Sektor')}</th><th class="n">${L('Anchor aₛ (Rp jt/wkr)', 'Anchor aₛ (Rp jt/pekerja)')}</th><th class="n">${L('Companies', 'Perusahaan')}</th><th class="n">${L('Jobs', 'Lapangan kerja')}</th><th class="n">${L('Direct GVA (IDR T)', 'Nilai tambah langsung (IDR T)')}</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table></div>
  ${v.onDefault.length ? `<p class="body">${L(
    `${v.onDefault.length === 1 ? 'One sector bucket carries' : `${v.onDefault.length} sector buckets carry`} no BPS-derived anchor of its own — ${v.onDefault.map(esc).join(', ')} — so ${v.onDefault.length === 1 ? 'it falls' : 'they fall'} back to the ḡ = ${v.aDef} jt default. That is the conservative choice, not a measured one, and it is the first thing to revisit as ${v.onDefault.length === 1 ? 'that bucket grows' : 'those buckets grow'}.`,
    `${v.onDefault.length === 1 ? 'Satu kelompok sektor' : `${v.onDefault.length} kelompok sektor`} belum punya anchor turunan BPS sendiri — ${v.onDefault.map(esc).join(', ')} — sehingga jatuh ke default ḡ = ${v.aDef} jt. Itu pilihan konservatif, bukan hasil pengukuran, dan itulah yang pertama perlu ditinjau ulang begitu ${v.onDefault.length === 1 ? 'kelompok itu' : 'kelompok-kelompok itu'} membesar.`)}</p>` : ''}
</section>

<section id="error">
  <div class="eyebrow">${L('05 · The error model', '05 · Model galat')}</div>
  <h2>${L('Rows are noisy. Sums are the product.', 'Setiap baris bergalat. Penjumlahannyalah produknya.')}</h2>
  <p class="lede">${L(`A pre-revenue startup's true GVA is roughly payroll plus depreciation — up to 5× below its anchor — while a scaled profitable platform can sit several times above it. The model prices this in as multiplicative error and asks what survives the sum.`,
    'Nilai tambah sejati sebuah startup pra-pendapatan kira-kira sebesar total gaji plus penyusutan — bisa 5× di bawah anchornya — sedangkan platform matang yang menguntungkan bisa berada beberapa kali di atasnya. Model memperhitungkannya sebagai galat multiplikatif, lalu bertanya apa yang bertahan dalam penjumlahan.')}</p>
  ${eq(L('EQ 8 · Multiplicative per-row error', 'Pers. 8 · Galat multiplikatif per baris'), 'error')}
  ${eq(L('EQ 9 · What the sum can bear', 'Pers. 9 · Yang sanggup dipikul penjumlahan'), 'concentration', L(`Nₑᶠᶠ uses GVA weights, so concentration is priced in: the top 5 rows carry ${v.top5Pct}% of D. Sector errors also correlate, so ~${(50 / Math.sqrt(v.neff)).toFixed(0)}% is a floor for the honest band, not the band itself`,
    `Nₑᶠᶠ memakai bobot nilai tambah, jadi konsentrasi ikut terhitung: 5 baris teratas memikul ${v.top5Pct}% dari D. Galat antarsektor juga berkorelasi, sehingga ~${(50 / Math.sqrt(v.neff)).toFixed(0)}% adalah batas bawah pita galat yang jujur, bukan pita galatnya itu sendiri`))}
  <figure>
    <div class="figbody">${errorChart(v.neff, v.nWith)}</div>
    <figcaption>${L('Fig 4 · Relative error of the sum under ±50% independent row error. The census sits at the orange marker, not the gray one.',
      'Gambar 4 · Galat relatif penjumlahan pada galat baris independen ±50%. Sensus berada di penanda oranye, bukan di penanda abu-abu.')}</figcaption>
  </figure>
  <p class="body">${L(`This is why the site quotes portfolio totals and sector sums, and why no single company row should ever be read as that company's measured output.`,
    'Karena itulah situs ini mengutip total portofolio dan penjumlahan per sektor — dan karena itu pula baris satu perusahaan tidak boleh dibaca sebagai output terukur perusahaan itu.')}</p>
</section>

<section id="gates">
  <div class="eyebrow">${L('06 · Gates and the per-row path', '06 · Gerbang dan jalur per baris')}</div>
  <h2>${L('Every record walks the same gauntlet.', 'Setiap catatan menempuh jalur uji yang sama.')}</h2>
  ${eq(L('EQ 10 · Sanity gates', 'Pers. 10 · Gerbang uji kewajaran'), 'gates')}
  <div class="gatecards">
    <div><div class="t">${L('GMV gate', 'Gerbang GMV')}</div><p>${L('For marketplaces, only take-rate revenue net of intermediate consumption is value added. Direct GVA above take-rate revenue means the headcount or sector is wrong.',
      'Untuk marketplace, hanya pendapatan take-rate bersih dari konsumsi antara yang merupakan nilai tambah. Nilai tambah langsung di atas pendapatan take-rate berarti jumlah pekerja atau sektornya keliru.')}</p></div>
    <div><div class="t">${L('Payroll gate', 'Gerbang gaji')}</div><p>${L(`A pre-revenue firm's value added is what it pays people plus what its assets depreciate. An estimate far above payroll gets re-checked.`,
      'Nilai tambah perusahaan pra-pendapatan adalah gaji yang dibayarkannya plus penyusutan asetnya. Estimasi yang jauh di atas total gaji diperiksa ulang.')}</p></div>
    <div><div class="t">${L('Null gate', 'Gerbang null')}</div><p>${L('Unknown headcount publishes null. Funding and valuation are claims on the future; GVA is production this year. They never convert into each other.',
      'Jumlah pekerja yang tak diketahui menerbitkan null. Pendanaan dan valuasi adalah klaim atas masa depan; nilai tambah bruto adalah produksi tahun ini. Keduanya tidak pernah saling dikonversi.')}</p></div>
  </div>
  <figure>
    <div class="figbody">${flowFig(v)}</div>
    <figcaption>${L(`Fig 5 · The per-record decision path, as executed for all ${fmt(T.companies)} rows. Diamonds are the two exits from the happy path.`,
      `Gambar 5 · Jalur keputusan per catatan, sebagaimana dijalankan untuk seluruh ${fmt(T.companies)} baris. Belah ketupat adalah dua pintu keluar dari jalur normal.`)}</figcaption>
  </figure>
  <details>
    <summary>${L('Mermaid source — copy for docs', 'Sumber mermaid — salin untuk dokumentasi')}</summary>
    <pre class="srcpre" id="mmsrc">${esc(MERMAID_SRC)}</pre>
    <button class="copybtn" id="copymm" type="button">${L('Copy source', 'Salin sumber')}</button>
  </details>
</section>

</main>
<footer>
  <span>${L('1001startup.id — the census of Indonesian startups', '1001startup.id — sensus startup Indonesia')}</span>
  <span><a href="${PF}/">${L('Back to the census', 'Kembali ke sensus')}</a> · ${L('Anchors', 'Anchor')}: BPS · ${L('FX', 'Kurs')} ${fmt(v.fx)} · ${L('updated', 'diperbarui')} ${esc(upd)}</span>
</footer>
<div id="tip" role="status"></div>
<script src="/js/nav1001.js?v=${V}" defer></script>
<script src="/js/model1001.js?v=${V}" defer></script>
<script src="/js/px.js?v=${V}" defer></script>
<script src="/assets/js/consent.js?v=${V}" defer></script>
</body>
</html>`;
}

module.exports = { model };
