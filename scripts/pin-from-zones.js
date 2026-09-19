'use strict';
/* Pin census companies onto buildings we already have on disk.
 *
 * Nominatim rate-limits bulk work, and half the census was parked on kecamatan
 * centroids because of it — every company in a district on one identical point,
 * which the map can only draw as a row of towers belonging to nobody. But the
 * 92 zone extracts already hold ~200k OSM footprints WITH THEIR NAMES, and the
 * addresses name their building ("Menara Standard Chartered Lt. 35, ..."). So
 * match the address's building name against the footprints we have: no network,
 * no rate limit, same OSM data — and it yields the footprint itself, which is
 * exactly what the map needs to stand a company on its own plot.
 *
 * Writes data/census-raw.json; re-run scripts/build-census.js after.
 *   node scripts/pin-from-zones.js [--dry-run]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RAW = path.join(ROOT, 'data', 'census-raw.json');
const DATA = path.join(ROOT, 'public', 'data');
const DRY = process.argv.includes('--dry-run');
const MZ = 110540;

/* the same clean-up the geocoder does, then the building-type prefix that makes
   an OSM name-match miss ("Gedung Lippo Kuningan" is tagged "Lippo Kuningan") */
const PREFIX = /^(gedung|graha|wisma|menara|plaza|tower|gd|the)\s+/i;
const clean = (a) => a
  .replace(/\b(?:lt|lantai|lv|level|fl(?:oor)?)\.?\s*[\d\w-]+/gi, '')
  .replace(/\b\d+(?:st|nd|rd|th)\s+floor\b/gi, '')
  .replace(/\b(?:suite|unit)\s*[A-Z0-9-]+\b/gi, ' ')   // NOT across the comma: it would eat the street too
  .replace(/\bRT\.?\s*\d+\s*\/?\s*(?:RW\.?\s*\d+)?/gi, '')
  .replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s*,\s*,/g, ',').trim();

/* Generic building words carry no identity: "Tempo Scan Tower" and "Tempo Scan"
   are one building, but "World Trade Center I" and "World Trade Center 2" are
   two, and "Ruko Kebon Jeruk Baru" is not "Plaza Kebon Jeruk". Comparing what
   is left after the generics decides which is which. */
const GENERIC = /\b(tower|towers|office|offices|building|mall|plaza|centre|center|park|city|residence|residences|apartment|apartments|complex|annex|wing|block|lantai|floor)\b/g;
const core = (t) => t.replace(GENERIC, ' ').replace(/\s{2,}/g, ' ').trim();

function norm(s) {
  let t = String(s || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  for (let i = 0; i < 2; i++) t = t.replace(PREFIX, '').trim();
  return t;
}

/* every named footprint in every extract, as lon/lat */
function buildIndex() {
  const idx = new Map();
  let files = 0, named = 0;
  for (const f of fs.readdirSync(DATA)) {
    if (!f.endsWith('.json') || f === 'jakarta.json' || f === 'zones.json'
      || f.startsWith('census') || f.startsWith('jakarta-')) continue;
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch { continue; }
    if (!d.center || !Array.isArray(d.buildings)) continue;
    files++;
    const MX = 111320 * Math.cos((d.center.lat * Math.PI) / 180);
    for (const b of d.buildings) {
      if (!b.n || !b.p || b.p.length < 3) continue;
      let x = 0, y = 0;
      for (const p of b.p) { x += p[0]; y += p[1]; }
      x /= b.p.length; y /= b.p.length;
      const lon = +(d.center.lon + x / MX).toFixed(5);
      const lat = +(d.center.lat - y / MZ).toFixed(5);
      const k = norm(b.n);
      if (k.length < 5) continue;
      named++;
      /* keep the tallest match for a name — a tower and its podium often share it */
      const prev = idx.get(k);
      if (!prev || (b.h || 0) > prev.h) idx.set(k, { lat, lon, h: b.h || 0, name: b.n, src: f.replace(/\.json$/, '') });
    }
  }
  return { idx, files, named };
}

const { idx, files, named } = buildIndex();
console.log(`indexed ${named} named footprints from ${files} extracts (${idx.size} distinct names)`);

/* candidate building names out of an address: the first segment is the building
   unless the address starts at the street */
function candidates(c) {
  const segs = clean(c.hq_address || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!segs.length) return [];
  const out = [];
  const first = segs[0];
  if (!/^jl\.?\s|^jalan\s/i.test(first)) {
    out.push(first);
    /* "Tokopedia Tower - Ciputra World 2" names two things; try both halves */
    for (const part of first.split(/\s+[-–]\s+/)) if (part.trim().length > 4) out.push(part.trim());
  }
  /* Floor and unit notation leaves debris the regexes cannot all anticipate —
     "Cyber 2 Tower 35th D-E", "Thamrin City No. 01/02". Try the whole segment
     first, then progressively shorter leading runs, so the LONGEST thing that
     is actually a building name wins and a bare "Green Office Park" cannot
     stand in for "Green Office Park 1 South Tower". */
  const grown = [];
  for (const o of out) {
    const toks = norm(o).split(' ').filter(Boolean);
    for (let k = toks.length; k >= 2; k--) {
      const t = toks.slice(0, k).join(' ');
      if (t.length >= 8) grown.push(t);
    }
  }
  return [...new Set(grown)];
}

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
const KEC = (c) => String(c.kecamatan || '').toLowerCase();
const EXACT = new Set(['building', 'house', 'office', 'commercial', 'industrial', 'retail', 'address', 'yes']);
function needsPin(c) {
  if (EXACT.has(c.geocode_kind)) return false;              // already on a building
  const src = String(c.geocode_src || '');
  if (!src) return true;
  const head = src.split(':').pop().split(',')[0].trim().toLowerCase();
  if (head === KEC(c)) return true;
  if (/^(jakarta|kota|kabupaten|tangerang|depok|bekasi|bogor)\b/.test(head)) return true;
  if (/^(jl\.?|jalan)\b/.test(head)) return true;           // street-level: a building beats it
  return false;
}

let hit = 0, miss = 0;
const hits = [];
for (const c of raw.companies) {
  if (!needsPin(c)) continue;
  let found = null, q = null;
  for (const t of candidates(c)) {
    if (idx.has(t)) { found = idx.get(t); q = t; break; }
    /* Containment only when the two names are mostly the SAME name — "Tempo
       Scan Tower" vs "Tempo Scan" is a match, "Ruko Kebon Jeruk Baru No. B6"
       vs "Plaza Kebon Jeruk" is two different buildings that share a district
       name. Take the best overlap, not the first one found. */
    if (t.length >= 10) {
      const ct = core(t);
      if (ct.length >= 6) {
        for (const [k, v] of idx) {
          if (k.length < 8) continue;
          if (!k.includes(t) && !t.includes(k)) continue;
          if (core(k) !== ct) continue;          // same name once the generics go
          found = v; q = k; break;
        }
      }
      if (found) break;
    }
  }
  if (!found) { miss++; continue; }
  hit++;
  hits.push(`  ${c.name.slice(0, 24).padEnd(24)} -> ${found.name.slice(0, 30).padEnd(30)} ${found.h ? found.h + 'm ' : ''}(${found.src})`);
  if (!DRY) {
    c.lat = found.lat; c.lon = found.lon;
    c.geocode_src = 'osm-zone:' + found.src + '/' + String(found.name).slice(0, 40);
    c.geocode_kind = 'building';
  }
}
console.log(hits.join('\n'));
console.log(`\npinned to a real footprint: ${hit}   still unmatched: ${miss}`);
if (DRY) { console.log('--dry-run: census-raw.json not written'); process.exit(0); }
if (hit) {
  fs.writeFileSync(RAW, JSON.stringify(raw));
  console.log('census-raw.json written — now run: node scripts/build-census.js');
}
