'use strict';
/* Geocode census companies that lack lat/lon, via Nominatim (1.1s/request,
 * UA per their policy). Reads/writes data/census-raw.json in place, then the
 * caller re-runs build-census.js. Verifies every hit lands inside one of the
 * census metro envelopes — a bad geocode is worse than none. Usage:
 *   node scripts/geocode-census.js [maxRequests=25]
 *   node scripts/geocode-census.js 400 --repin   # revisit district-centroid pins
 *
 * --repin exists because 46% of the census had been left sitting on a KECAMATAN
 * CENTROID: the first pass falls back to "<kecamatan>, <kota>" when it cannot
 * find the address, which parks every company in a district on one identical
 * point. On the map that reads as a row of towers with no relation to where the
 * office is — and several of them are literally the same coordinate. A re-pin
 * pass drops that fallback entirely and only accepts a hit OSM calls a building,
 * an address or a named place, so a pin either improves or is left alone and
 * labelled. Run by the census data-cleaning loop; safe to re-run. */
const fs = require('fs');
const path = require('path');

const RAW = path.join(__dirname, '..', 'data', 'census-raw.json');
/* One envelope per metro the census covers. A hit is accepted if it lands in
   ANY of them, which is all the guard was ever doing — it exists to catch
   Nominatim answering with a same-named street in another province, not to
   police scope. Bandung joined 30 Aug 2026; the box is the Bandung basin
   (Kota Bandung, Cimahi, Kabupaten Bandung, Bandung Barat) with a small margin. */
const ENVELOPES = {
  jakarta: { s: -6.80, n: -5.95, w: 106.35, e: 107.35, city: 'Jakarta' }, // Jabodetabek
  bandung: { s: -7.35, n: -6.65, w: 107.15, e: 108.00, city: 'Bandung' },
};
/* Which metro a row belongs to, from its kota. This has to be per-ROW, not a
   union: Elevarm's registered address is on Jalan Asia Afrika in Bandung, and
   a union test happily accepted Nominatim's Jalan Asia Afrika in SENAYAN —
   a pin 120 km wrong that still sat inside "a" census envelope. The same
   value also supplies the city token the fallback queries append, which used
   to be the literal string 'Jakarta' for every company in the file. */
const BANDUNG_KOTA = new Set(['Bandung', 'Cimahi', 'Kabupaten Bandung', 'Kabupaten Bandung Barat']);
const metroOf = (c) => (BANDUNG_KOTA.has(String(c.kota || '').replace(/^Kota\s+/i, '')) ? 'bandung' : 'jakarta');
const inEnvelope = (lat, lon, id) => {
  const E = ENVELOPES[id];
  return lat >= E.s && lat <= E.n && lon >= E.w && lon <= E.e;
};
const MAX = parseInt(process.argv[2] || '25', 10);
const REPIN = process.argv.includes('--repin');
/* what Nominatim calls the thing it found. Administrative areas and suburbs are
   district centroids wearing a company's name — the exact thing being fixed. */
const VAGUE = new Set(['administrative', 'boundary', 'suburb', 'city_district', 'city',
  'town', 'village', 'municipality', 'county', 'state', 'postcode', 'neighbourhood']);
/* An office tower, or the address of one. Deliberately NOT amenity/shop: a query
   for "Standard Chartered" finds a bank branch across town, and a confident pin
   on the wrong building is worse than an honest approximate one. */
const BUILDINGISH = new Set(['building', 'house', 'office', 'commercial', 'industrial', 'retail', 'address', 'yes']);
const kindOf = (hit) => (hit && (hit.addresstype || hit.type)) || null;
const usable = (hit) => { const k = kindOf(hit); return !!k && (BUILDINGISH.has(k) || k === 'road'); };
const UA = { 'User-Agent': 'pasar-vantis-census/1.0 (geocoding; contact: vantis.sh)' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function nom(q) {
  const u = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q);
  const res = await fetch(u, { headers: UA });
  if (!res.ok) throw Object.assign(new Error('nominatim ' + res.status), { status: res.status });
  const js = await res.json();
  return js[0] || null;
}

(async () => {
  const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
  let done = 0, ok = 0, throttled = 0, stop = false;
  for (const c of raw.companies) {
    if (done >= MAX) break;
    if (REPIN) {
      /* only pins that are still a district centroid — a building-level pin is
         better than anything a re-query can produce */
      if (c.geocode_kind && !VAGUE.has(c.geocode_kind)) continue;
      const src = String(c.geocode_src || '');
      const head = src.split(':').pop().split(',')[0].trim().toLowerCase();
      const vagueSrc = !src || head === String(c.kecamatan || '').toLowerCase()
        || /^(jakarta|bandung|cimahi|kota|kabupaten|tangerang|depok|bekasi|bogor)/.test(head);
      if (!vagueSrc) continue;
      if ((c.repin_tries || 0) >= 2) continue;
    } else {
      if (c.lat && c.lon) continue;
      if ((c.geocode_tries || 0) >= 3) continue;
    }
    /* Nominatim chokes on floor/suite/RT-RW tokens — clean before querying,
       and lead with the building name (first segment): building-level pins
       beat kecamatan centroids. */
    const clean = (a) => a
      .replace(/\b(?:lt|lantai|lv|level|fl(?:oor)?)\.?\s*\d+\w*/gi, '')
      .replace(/\b\d+(?:st|nd|rd|th)\s+floor\b/gi, '')
      .replace(/\b(?:suite|unit|tower)\s*[A-Z0-9-]+\b/gi, '')
      .replace(/\bRT\.?\s*\d+\s*\/?\s*(?:RW\.?\s*\d+)?/gi, '')
      .replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').replace(/\s*,\s*,/g, ',').trim();
    const metro = metroOf(c);
    const CITY = ENVELOPES[metro].city;
    const addr = c.hq_address ? clean(c.hq_address) : null;
    const segs = addr ? addr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    /* "Kav. B-12" / "No. 161" / "Blok A" defeat a name search — Nominatim wants
       the plain building name. */
    const trimTok = (x) => x.replace(/\b(kav\.?|blok|no\.?)\s*[A-Za-z0-9-]+/gi, '')
      .replace(/\s{2,}/g, ' ').replace(/[,\s]+$/, '').trim();
    /* And the Indonesian building-type prefix defeats it too: "Gedung Lippo
       Kuningan, Jakarta" finds nothing, "Lippo Kuningan Jakarta" finds the
       building. Both spellings get a turn — some towers are tagged with it. */
    const PREFIX = /^(gedung|graha|wisma|menara|plaza|gd\.?)\s+/i;
    const bldg0 = segs.length && !/^jl|^jalan/i.test(segs[0]) ? trimTok(segs[0]) : null;
    const bldg = bldg0 || null;
    const bldgNP = bldg && PREFIX.test(bldg) ? bldg.replace(PREFIX, '') : null;
    const street = segs.find((s) => /^jl\.?\s|^jalan\s/i.test(s));
    const tries = [...new Set([
      bldgNP ? `${bldgNP} ${CITY}` : null,
      bldg ? `${bldg} ${CITY}` : null,
      bldgNP && c.kecamatan ? `${bldgNP}, ${c.kecamatan}` : null,
      bldg && c.kecamatan ? `${bldg}, ${c.kecamatan}` : null,
      /* street level: not the building, but the right road in the right
         neighbourhood beats a district centroid shared with twenty others */
      street ? `${trimTok(street)}, ${c.kecamatan || ''}, ${CITY}` : null,
      addr ? segs.slice(0, 2).join(', ') + ', ' + CITY : null,
      /* the district centroid is a LAST resort on a first pass and never on a
         re-pin — landing back on it is the failure being repaired */
      REPIN ? null : (c.kecamatan ? `${c.kecamatan}, ${c.kota || CITY}` : null),
    ].filter(Boolean))];
    if (!tries.length) { if (!REPIN) c.geocode_tries = 3; continue; }
    if (!REPIN) c.geocode_tries = (c.geocode_tries || 0) + 1;
    /* Only spend one of a company's two attempts once Nominatim has actually
       ANSWERED. A throttled run used to burn everyone's tries on 429s and leave
       them parked on the district centroid with nothing left to retry. */
    let answered = false;
    for (const q of tries) {
      try {
        const hit = await nom(q);
        answered = true;
        done++;
        await sleep(1100);
        if (!hit) continue;
        const lat = parseFloat(hit.lat), lon = parseFloat(hit.lon);
        if (!inEnvelope(lat, lon, metro)) continue; // outside THIS company's metro: reject
        if (REPIN && !usable(hit)) continue;           // another centroid is not an improvement
        c.lat = Math.round(lat * 1e5) / 1e5;
        c.lon = Math.round(lon * 1e5) / 1e5;
        c.geocode_src = 'nominatim:' + q.slice(0, 60);
        /* what OSM says it found, so the map can tell a real address from a
           district centroid instead of drawing both as a building on a plot */
        c.geocode_kind = kindOf(hit);
        ok++;
        break;
      } catch (e) {
        /* 429/403 is their rate limiter, not a miss — wait it out, and give up
           on the whole run rather than grinding through the rest for nothing */
        if (e && (e.status === 429 || e.status === 403)) {
          console.error(`rate limited (${e.status}) — pausing 60s`);
          await sleep(60000);
          throttled++;
          if (throttled >= 3) { console.error('still limited; stopping so tries are not wasted'); stop = true; break; }
        } else { await sleep(2000); }
      }
      if (done >= MAX) break;
    }
    if (REPIN && answered) c.repin_tries = (c.repin_tries || 0) + 1;
    if (stop) break;
  }
  fs.writeFileSync(RAW, JSON.stringify(raw));
  const missing = raw.companies.filter((c) => !(c.lat && c.lon)).length;
  console.log(`geocode: ${ok} pinned this run (${done} requests); ${missing} still unlocated`);
})().catch((e) => { console.error(e); process.exit(1); });
