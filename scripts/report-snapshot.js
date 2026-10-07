#!/usr/bin/env node
/* Freeze one edition of the census report (views/report1001.js).
 *
 * The live pages recompute every figure on each request; a report a journalist
 * quotes must not drift, so an edition's numbers are computed ONCE from
 * public/data/census.json + data/closed.json and written to
 * data/report-<edition>.json. Re-running for the same edition overwrites it —
 * do that only before the edition is pitched.
 *
 *   node scripts/report-snapshot.js 2026-10
 */
'use strict';
const fs = require('fs');
const path = require('path');
const inv = require('../views/investors1001');

const ROOT = path.join(__dirname, '..');
const edition = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(edition || '')) { console.error('usage: report-snapshot.js YYYY-MM'); process.exit(1); }

const census = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'census.json'), 'utf8'));
const closed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'closed.json'), 'utf8'));
const C = census.companies || [];
const r1 = (x) => Math.round(x * 10) / 10;

/* 1. funding concentration — disclosed funding only; a row with no figure is not zero, it is unknown */
const funded = C.filter((c) => typeof c.funding_total_usd_m === 'number' && c.funding_total_usd_m > 0)
  .sort((a, b) => b.funding_total_usd_m - a.funding_total_usd_m);
const fundSum = funded.reduce((a, c) => a + c.funding_total_usd_m, 0);
const top10 = funded.slice(0, 10).map((c) => ({ id: c.id, name: c.name, usd_m: c.funding_total_usd_m, share: r1(c.funding_total_usd_m / fundSum * 100) }));
const top10Sum = funded.slice(0, 10).reduce((a, c) => a + c.funding_total_usd_m, 0);

/* 2. investor concentration — investors named on census rows, counted per company */
const by = new Map();
for (const c of C) {
  const seen = new Set();
  for (const s of c.investors || []) {
    const name = inv.parseInv(s).name;
    if (!name) continue;
    const k = inv.slugInv(name);
    if (seen.has(k)) continue;
    seen.add(k);
    const e = by.get(k) || { slug: k, name, n: 0 };
    e.n++;
    by.set(k, e);
  }
}
const investors = [...by.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

/* 3. closures — the register, by year ended */
const E = closed.entries || [];
const byYear = {};
for (const e of E) { const y = String(e.ended || '').slice(0, 4); if (y) byYear[y] = (byYear[y] || 0) + 1; }
const closedFunded = E.filter((e) => typeof e.funding_usd_m === 'number').sort((a, b) => b.funding_usd_m - a.funding_usd_m);
const conf = E.reduce((a, e) => { a[e.confidence || 'confirmed'] = (a[e.confidence || 'confirmed'] || 0) + 1; return a; }, {});

/* 4. valuations on record */
const marked = C.filter((c) => typeof c.valuation_usd_m === 'number');
const big = marked.filter((c) => c.valuation_usd_m >= 1000).sort((a, b) => b.valuation_usd_m - a.valuation_usd_m)
  .map((c) => ({ id: c.id, name: c.name, usd_m: c.valuation_usd_m, kind: (c.valuation_est || c.valuation_kind === 'est') ? 'est' : (c.valuation_kind || 'private'), asof: c.valuation_asof || null }));

/* geography, for the caveat */
const byMetro = {};
for (const c of C) byMetro[c.metro || 'other'] = (byMetro[c.metro || 'other'] || 0) + 1;

const out = {
  edition,
  frozen_at: new Date().toISOString(),
  census_generated: census.generated,
  companies: C.length,
  funding: { rows: funded.length, usd_m: r1(fundSum), top10, top10_share: r1(top10Sum / fundSum * 100) },
  investors: {
    named: investors.length,
    companies_with_named_investors: C.filter((c) => (c.investors || []).length).length,
    one_company: investors.filter((e) => e.n === 1).length,
    top: investors.slice(0, 10),
  },
  closed: {
    entries: E.length,
    by_year: byYear,
    first_year: Math.min(...Object.keys(byYear).map(Number)),
    last_year: Math.max(...Object.keys(byYear).map(Number)),
    funded: closedFunded.length,
    funded_usd_m: r1(closedFunded.reduce((a, e) => a + e.funding_usd_m, 0)),
    top: closedFunded.slice(0, 5).map((e) => ({ name: e.name, usd_m: e.funding_usd_m, ended: e.ended, confidence: e.confidence || 'confirmed' })),
    confidence: conf,
  },
  valuation: { marked: marked.length, billion_plus: big },
  geography: { jakarta: byMetro.jakarta || 0, outside: C.length - (byMetro.jakarta || 0), metros: Object.keys(byMetro).length },
  jobs_est: (census.totals || {}).jobs || null,
};
const file = path.join(ROOT, 'data', `report-${edition}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 1));
console.log('wrote', file, `· ${out.companies} companies · top10 ${out.funding.top10_share}% of US$${out.funding.usd_m}M · ${out.investors.one_company}/${out.investors.named} one-company investors · ${out.closed.entries} closed`);
