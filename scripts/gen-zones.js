'use strict';
/* Generate detail-zone candidates around every census-company cluster so each
 * gets real OSM ground like SCBD. Clusters located companies (greedy radius
 * gather), boxes them with padding, resolves overlaps against the 6 hand-made
 * zones and among themselves (union when small, axis-shrink otherwise), names
 * each by its dominant kecamatan. Writes data/zones-def.json; fetch each with
 * scripts/fetch-zone.js, then scripts/publish-zones.js publishes the ones whose
 * data actually landed. Usage: node scripts/gen-zones.js */
const fs = require('fs');
const path = require('path');

const census = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'census.json'), 'utf8'));

/* the hand-made zones in jakarta.js — immovable obstacles */
const FIXED = [
  { id: 'scbd', bb: { s: -6.2325, w: 106.8015, n: -6.2205, e: 106.8135 } },
  { id: 'southquarter', bb: { s: -6.3010, w: 106.7790, n: -6.2886, e: 106.7918 } },
  { id: 'gambir', bb: { s: -6.1865, w: 106.8115, n: -6.1690, e: 106.8285 } },
  { id: 'satrio', bb: { s: -6.2270, w: 106.8140, n: -6.2154, e: 106.8252 } },
  { id: 'gandaria', bb: { s: -6.2486, w: 106.7776, n: -6.2370, e: 106.7892 } },
  { id: 'senayan', bb: { s: -6.2334, w: 106.7914, n: -6.2218, e: 106.8010 } },
];
const inBB = (p, bb) => p.lon >= bb.w && p.lon <= bb.e && p.lat >= bb.s && p.lat <= bb.n;
const overlap = (a, b) => a.w < b.e && b.w < a.e && a.s < b.n && b.s < a.n;

const R = 0.008;        // cluster gather radius (~880m)
const PAD = 0.0035;     // box padding around members
const MINH = 0.005;     // min half-extent
const MAXSPAN = 0.017;  // max box span per axis
const GAP = 0.0005;

const pins = census.companies.filter((c) => c.lat && c.lon && !FIXED.some((F) => inBB(c, F.bb)));
const unassigned = new Set(pins.map((_, i) => i));
const clusters = [];
while (unassigned.size) {
  const seedI = unassigned.values().next().value;
  let cx = pins[seedI].lon, cy = pins[seedI].lat, members = [];
  for (let pass = 0; pass < 3; pass++) {
    members = [...unassigned].filter((i) => Math.hypot(pins[i].lon - cx, pins[i].lat - cy) < R);
    cx = members.reduce((s, i) => s + pins[i].lon, 0) / members.length;
    cy = members.reduce((s, i) => s + pins[i].lat, 0) / members.length;
  }
  members.forEach((i) => unassigned.delete(i));
  clusters.push({ members: members.map((i) => pins[i]) });
}

const clamp = (bb) => {
  for (const [lo, hi] of [['w', 'e'], ['s', 'n']]) {
    const span = bb[hi] - bb[lo];
    if (span > MAXSPAN) { const c = (bb[hi] + bb[lo]) / 2; bb[lo] = c - MAXSPAN / 2; bb[hi] = c + MAXSPAN / 2; }
    if (span < MINH * 2) { const c = (bb[hi] + bb[lo]) / 2; bb[lo] = c - MINH; bb[hi] = c + MINH; }
  }
  return bb;
};
let zones = clusters.map((cl) => {
  const lons = cl.members.map((p) => p.lon), lats = cl.members.map((p) => p.lat);
  const bb = clamp({
    w: Math.min(...lons) - PAD, e: Math.max(...lons) + PAD,
    s: Math.min(...lats) - PAD, n: Math.max(...lats) + PAD,
  });
  const modeOf = (f) => {
    const m = {};
    for (const p of cl.members) if (p[f]) m[p[f]] = (m[p[f]] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k]) => k)[0];
  };
  return { bb, n: cl.members.length, name: modeOf('kecamatan') || modeOf('kota') || 'District' };
});

/* resolve overlaps: vs fixed zones (shrink self), then among generated
   (union when the union stays small, else shrink the smaller) */
const shrinkAway = (z, ob) => {
  const cand = [];
  if (z.bb.e > ob.w && z.bb.w < ob.w) cand.push(['e', ob.w - GAP, z.bb.e - ob.w]);
  if (z.bb.w < ob.e && z.bb.e > ob.e) cand.push(['w', ob.e + GAP, ob.e - z.bb.w]);
  if (z.bb.n > ob.s && z.bb.s < ob.s) cand.push(['n', ob.s - GAP, z.bb.n - ob.s]);
  if (z.bb.s < ob.n && z.bb.n > ob.n) cand.push(['s', ob.n + GAP, ob.n - z.bb.s]);
  cand.sort((a, b) => a[2] - b[2]); // least amputation first
  if (cand.length) z.bb[cand[0][0]] = cand[0][1];
};
for (const z of zones) for (const F of FIXED) if (overlap(z.bb, F.bb)) shrinkAway(z, F.bb);
let changed = true;
while (changed) {
  changed = false;
  outer: for (let i = 0; i < zones.length; i++) for (let j = i + 1; j < zones.length; j++) {
    const A = zones[i], B = zones[j];
    if (!overlap(A.bb, B.bb)) continue;
    const u = { w: Math.min(A.bb.w, B.bb.w), e: Math.max(A.bb.e, B.bb.e), s: Math.min(A.bb.s, B.bb.s), n: Math.max(A.bb.n, B.bb.n) };
    if (u.e - u.w <= MAXSPAN && u.n - u.s <= MAXSPAN) {
      A.bb = u; A.n += B.n; if (B.n > A.n / 2 && B.name !== 'District') A.name = A.name === 'District' ? B.name : A.name;
      zones.splice(j, 1);
    } else {
      const small = (A.bb.e - A.bb.w) * (A.bb.n - A.bb.s) < (B.bb.e - B.bb.w) * (B.bb.n - B.bb.s) ? A : B;
      shrinkAway(small, small === A ? B.bb : A.bb);
      if (small.bb.e - small.bb.w < 0.004 || small.bb.n - small.bb.s < 0.004) zones.splice(zones.indexOf(small), 1);
    }
    changed = true;
    break outer;
  }
}

zones = zones.filter((z) => z.bb.e - z.bb.w >= 0.004 && z.bb.n - z.bb.s >= 0.004);

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'district';
const seen = new Map();
const out = zones.map((z) => {
  let id = slug(z.name);
  const k = (seen.get(id) || 0) + 1;
  seen.set(id, k);
  if (k > 1) id = `${id}-${k}`;
  return {
    id, name: z.name.toUpperCase(), src: `/data/zone-${id}.json`,
    bb: { s: +z.bb.s.toFixed(5), w: +z.bb.w.toFixed(5), n: +z.bb.n.toFixed(5), e: +z.bb.e.toFixed(5) },
    center: { lat: +((z.bb.s + z.bb.n) / 2).toFixed(5), lon: +((z.bb.w + z.bb.e) / 2).toFixed(5) },
    zIn: 2.1, zFull: 3.4, gen: true, pins: z.n,
  };
});
fs.writeFileSync(path.join(__dirname, '..', 'data', 'zones-def.json'), JSON.stringify(out, null, 1));
console.log(`${pins.length} pins outside fixed zones -> ${out.length} generated zones`);
for (const z of out) console.log(`  ${z.id.padEnd(26)} ${z.name.padEnd(22)} pins=${z.pins} span=${((z.bb.e - z.bb.w) * 111).toFixed(1)}x${((z.bb.n - z.bb.s) * 111).toFixed(1)}km`);
