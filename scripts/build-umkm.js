'use strict';
/* 1001umkm.id — build the published file the site renders from.
 *
 * data/umkm-raw.json  (master, written by scripts/umkm-import.py + fix scripts)
 *   + data/umkm-logos.json  (single-writer side file from scripts/umkm-icons.py,
 *     merged here so an icon run never touches the master — the census learned
 *     that lesson the hard way with cross-session write races)
 * -> public/data/umkm.json
 *
 * The published file is NOT a public download (server.js 403s it, same as
 * census.json): the site serves every row WITH its source on the page; the
 * one-file working layer is the commercial product.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'umkm-raw.json'), 'utf8'));

let logos = {};
try { logos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'umkm-logos.json'), 'utf8')).logos || {}; }
catch { /* icon pass not run yet — rows render without marks */ }

/* city-level coordinates from the photon pass (single-writer side file) */
let geo = { places: {} };
try { geo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'umkm-geo.json'), 'utf8')); }
catch { /* geocode pass not run yet — map ships empty */ }

/* the 15 commodity sprites (Higgsfield matched set — single-writer side file) */
let sprites = {};
try { sprites = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'umkm-sprites.json'), 'utf8')).sprites || {}; }
catch { /* sprite pass not run yet */ }

const companies = raw.companies.map((c) => {
  const g = (geo.places || {})[`${c.city || ''}|${c.province || ''}`];
  return {
    ...c,
    logo: logos[c.id] || null,
    lat: g ? g.lat : null,
    lon: g ? g.lon : null,
    geo_kind: g ? g.kind : null,   // 'city' | 'province' — the honest resolution
  };
});

const count = (f) => companies.filter(f).length;
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const TIER_META = {
  verified_shipper: { rank: 6, label: 'Verified shipper', short: 'VERIFIED SHIPPER', color: '#2F7A5C',
    def: 'Listed on InaExport (Kemendag’s verified exporter platform) AND a documented shipment on record — the strongest evidence tier we hold.' },
  confirmed_shipper: { rank: 5, label: 'Confirmed shipper', short: 'CONFIRMED SHIPPER', color: '#4E7A58',
    def: 'A specific export shipment documented in the press or an official release (Bea Cukai, Kemenperin, LPEI), read and linked on the row.' },
  inaexport: { rank: 4, label: 'InaExport-verified', short: 'INAEXPORT', color: '#4E7A96',
    def: 'Listed on InaExport, where Kemendag verifies exporter legality documents before a profile is published.' },
  tradeshow: { rank: 3, label: 'Trade-show exhibitor', short: 'TRADE SHOW', color: '#8A6A45',
    def: 'Exhibited at a vetted international trade show (Trade Expo Indonesia, IFEX, MIHAS and peers) per the show’s own directory or an official release.' },
  export_listed: { rank: 2, label: 'Export-listed', short: 'EXPORT-LISTED', color: '#8E8E93',
    def: 'Export activity or export-readiness stated in a public listing, directory or report — the source link says exactly what was claimed and where.' },
  /* Added Aug 31 2026 with the batch-3 sweep. That sweep folded Etsy and
     Instagram storefronts into the trade-show tier; they are not the same
     evidence, so they are separated here and described for what they are. */
  marketplace: { rank: 1, label: 'Marketplace seller', short: 'MARKETPLACE', color: '#9A7B4F',
    def: 'The company runs its own international storefront (Etsy, Instagram, Shopee, Alibaba) and the shop itself is the evidence. It shows they sell and ship abroad at retail scale — it is not evidence of wholesale export capability, and no third party has checked it.' },
};

/* one hue per sector — dots, legend and monogram tiles all read from here
   (same values as scripts/umkm-icons.py SECTOR_C) */
const SECTOR_COLOR = {
  'Fisheries & Seaweed': '#4e748c', 'Furniture': '#9a7b4f', 'Spices': '#b0703c',
  'Coconut & Charcoal': '#564d43', 'Textiles & Fashion': '#a3506e', 'Coffee & Tea': '#6b4f3a',
  'Cosmetics & Essential Oils': '#7c93a6', 'Agriculture': '#5a7a3f', 'Jewelry': '#6E4E8C',
  'Food & Beverage': '#C05A2E', 'Automotive & Industrial': '#2e3f4e', 'Home Decor': '#8A6D1C',
  'Footwear': '#6d675d', 'Handicraft': '#3F7D4E', 'Leather Goods': '#7a4a3a',
  'Stone & Building Materials': '#6b7280',
};

const bySector = {};
for (const c of companies) {
  bySector[c.sector] = bySector[c.sector] || { count: 0, industry: c.industry, provinces: new Set() };
  bySector[c.sector].count++;
  if (c.province) bySector[c.sector].provinces.add(c.province);
}

const byTier = {};
for (const k of Object.keys(TIER_META)) byTier[k] = count((c) => c.tier === k);

const out = {
  generated: new Date().toISOString(),
  source: raw.source,
  method: { ...raw.method, tier_meta: TIER_META },
  totals: {
    exporters: companies.length,
    sectors: uniq(companies.map((c) => c.sector)).length,
    industries: uniq(companies.map((c) => c.industry)).length,
    provinces: uniq(companies.map((c) => c.province)).length,
    verified_beyond_listing: count((c) => c.tier_rank >= 4),
    /* rows whose source was recorded as prose rather than a link — the site
       says so on the row rather than showing a badge that goes nowhere */
    source_missing: count((c) => c.source_missing),
    with_contact: count((c) => c.email || c.phone || c.url),
    with_email: count((c) => c.email),
    with_phone: count((c) => c.phone),
    with_site: count((c) => c.url),
    coverage: {
      products: count((c) => c.products),
      markets: count((c) => c.markets),
      certs: count((c) => c.certs),
      moq: count((c) => c.moq),
      incoterms: count((c) => c.incoterms),
      payment_terms: count((c) => c.payment_terms),
      city: count((c) => c.city),
      province: count((c) => c.province),
      source_url: count((c) => c.source_url),
    },
  },
  by_tier: byTier,
  by_sector: Object.entries(bySector)
    .map(([name, v]) => ({ name, count: v.count, industry: v.industry, provinces: v.provinces.size, color: SECTOR_COLOR[name] || '#6d675d', sprite: sprites[name] || null }))
    .sort((a, b) => b.count - a.count),
  sector_colors: SECTOR_COLOR,
  sprites,
  companies,
};
out.totals.mapped = count((c) => c.lat !== null && c.lon !== null);
out.totals.unmapped = companies.length - out.totals.mapped;

fs.writeFileSync(path.join(ROOT, 'public', 'data', 'umkm.json'), JSON.stringify(out));
console.log(`umkm.json: ${companies.length} exporters, ${out.totals.sectors} sectors, ${out.totals.provinces} provinces, ${Object.keys(logos).length} logos`);
