'use strict';
/* Infill zones for census companies that no zone covers.
 *
 * gen-zones.js lays out the whole set in one pass, and its overlap resolver has
 * to amputate or drop boxes that collide — which leaves pins standing on bare
 * ground in exactly the densest places (the Setiabudi/Kuningan corridor lost 11
 * companies that way, Tanah Abang 5). Re-running gen-zones.js would renumber
 * every id and orphan the fetched zone-<id>.json files, so this fills the holes
 * ADDITIVELY instead: cluster only what is still uncovered, fit each cluster the
 * largest box the surrounding zones leave free, and append it.
 *
 * Safe to re-run as the census grows — existing defs are never touched, and a
 * cluster that already has ground is skipped.
 *
 *   node scripts/gen-zones-gap.js            # append new defs
 *   node scripts/gen-zones-gap.js --dry-run  # report only
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFS = path.join(ROOT, 'data', 'zones-def.json');
const DRY = process.argv.includes('--dry-run');

const census = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'census.json'), 'utf8'));
const defs = JSON.parse(fs.readFileSync(DEFS, 'utf8'));

/* the hand-made zones in jakarta.js — immovable, and their data is fetched for
   exactly these boxes, so they must not be resized here either */
const FIXED = [
  { id: 'scbd', bb: { s: -6.2325, w: 106.8015, n: -6.2205, e: 106.8135 } },
  { id: 'southquarter', bb: { s: -6.3010, w: 106.7790, n: -6.2886, e: 106.7918 } },
  { id: 'gambir', bb: { s: -6.1865, w: 106.8115, n: -6.1690, e: 106.8285 } },
  { id: 'satrio', bb: { s: -6.2270, w: 106.8140, n: -6.2154, e: 106.8252 } },
  { id: 'gandaria', bb: { s: -6.2486, w: 106.7776, n: -6.2370, e: 106.7892 } },
  { id: 'senayan', bb: { s: -6.2334, w: 106.7914, n: -6.2218, e: 106.8010 } },
];

const R = 0.008;        // cluster gather radius (~880m), same as gen-zones
const PAD = 0.0035;     // box padding around members
const MAXSPAN = 0.017;  // max box span per axis
const GAP = 0.0005;     // keep-clear margin from a neighbour — overlapping zones double-draw
/* Infill boxes may be smaller than the first-pass minimum: what is left between
   two towers of the Kuningan corridor is a few hundred metres, and a few hundred
   metres of real streets still beats bare ground. Below this a zone renders as a
   sliver and is not worth a fetch. */
const MINSPAN = 0.0018; // ~200m. Generated zones draw no invite frame, so a thin
                        // strip of real street frontage reads as ground, not as a box.

const inBB = (p, bb) => p.lon >= bb.w && p.lon <= bb.e && p.lat >= bb.s && p.lat <= bb.n;
const overlap = (a, b) => a.w < b.e && b.w < a.e && a.s < b.n && b.s < a.n;
const area = (bb) => (bb.e - bb.w) * (bb.n - bb.s);

const obstacles = [...FIXED.map((f) => f.bb), ...defs.map((d) => d.bb)];
const covered = (c) => obstacles.some((bb) => inBB(c, bb));

const pins = census.companies.filter((c) => c.lat && c.lon && !covered(c));
if (!pins.length) {
  console.log('every located company already stands on a zone — nothing to fill');
  process.exit(0);
}

/* cluster the leftovers exactly the way gen-zones does */
const unassigned = new Set(pins.map((_, i) => i));
const clusters = [];
while (unassigned.size) {
  const seed = unassigned.values().next().value;
  let cx = pins[seed].lon, cy = pins[seed].lat, members = [];
  for (let pass = 0; pass < 3; pass++) {
    members = [...unassigned].filter((i) => Math.hypot(pins[i].lon - cx, pins[i].lat - cy) < R);
    cx = members.reduce((s, i) => s + pins[i].lon, 0) / members.length;
    cy = members.reduce((s, i) => s + pins[i].lat, 0) / members.length;
  }
  members.forEach((i) => unassigned.delete(i));
  clusters.push(members.map((i) => pins[i]));
}

/* Cut a box clear of one obstacle. The point of the box is the pins inside it,
   so the cut that KEEPS THE MOST PINS wins, and only then the one that leaves
   the most area — gen-zones cuts the shortest distance instead, which in the
   Kuningan corridor kept sliced-off empty ground and dropped the companies the
   box existed for. */
function cutClear(bb, ob, members) {
  const opts = [];
  if (bb.e > ob.w && bb.w < ob.w) opts.push({ ...bb, e: ob.w - GAP });
  if (bb.w < ob.e && bb.e > ob.e) opts.push({ ...bb, w: ob.e + GAP });
  if (bb.n > ob.s && bb.s < ob.s) opts.push({ ...bb, n: ob.s - GAP });
  if (bb.s < ob.n && bb.n > ob.n) opts.push({ ...bb, s: ob.n + GAP });
  const good = opts.filter((o) => o.e - o.w >= MINSPAN && o.n - o.s >= MINSPAN);
  if (!good.length) return null;
  const kept = (o) => members.filter((p) => inBB(p, o)).length;
  return good.sort((a, b) => kept(b) - kept(a) || area(b) - area(a))[0];
}

/* Grow the box around the members, then carve it free of everything already on
   the map. Keep the members that survive inside it. */
function fit(members, obs) {
  const lons = members.map((p) => p.lon), lats = members.map((p) => p.lat);
  let bb = {
    w: Math.min(...lons) - PAD, e: Math.max(...lons) + PAD,
    s: Math.min(...lats) - PAD, n: Math.max(...lats) + PAD,
  };
  for (const [lo, hi] of [['w', 'e'], ['s', 'n']]) {
    if (bb[hi] - bb[lo] > MAXSPAN) {
      const c = (bb[hi] + bb[lo]) / 2;
      bb[lo] = c - MAXSPAN / 2; bb[hi] = c + MAXSPAN / 2;
    }
  }
  for (let guard = 0; guard < 40; guard++) {
    const hit = obs.find((ob) => overlap(bb, ob));
    if (!hit) break;
    const next = cutClear(bb, hit, members);
    if (!next) return null;
    bb = next;
  }
  if (obs.some((ob) => overlap(bb, ob))) return null;
  const held = members.filter((p) => inBB(p, bb));
  return held.length ? { bb, held } : null;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'district';
const taken = new Map();
for (const d of defs) {
  const base = d.id.replace(/-\d+$/, '');
  taken.set(base, Math.max(taken.get(base) || 1, +(d.id.match(/-(\d+)$/) || [0, 1])[1]));
}
const modeOf = (members, f) => {
  const m = {};
  for (const p of members) if (p[f]) m[p[f]] = (m[p[f]] || 0) + 1;
  return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k]) => k)[0];
};

/* A leftover cluster in the Kuningan corridor spans more than a kilometre and
   collides with four neighbours at once, so one box for all of it carves down to
   nothing. Split it and try the halves: the sub-clusters are small enough to sit
   in the alleys between the towers. */
function fitOrSplit(members, obs, depth = 0) {
  const r = fit(members, obs);
  if (r) return [r];
  if (members.length < 2 || depth > 4) return [];
  const lons = members.map((p) => p.lon), lats = members.map((p) => p.lat);
  const byLon = Math.max(...lons) - Math.min(...lons) >= Math.max(...lats) - Math.min(...lats);
  const sorted = [...members].sort((a, b) => (byLon ? a.lon - b.lon : a.lat - b.lat));
  const mid = Math.ceil(sorted.length / 2);
  const out = [];
  for (const half of [sorted.slice(0, mid), sorted.slice(mid)]) {
    if (!half.length) continue;
    for (const got of fitOrSplit(half, obs, depth + 1)) { out.push(got); obs.push(got.bb); }
  }
  return out;
}

const added = [];
const orphans = [];
const obs = [...obstacles];
/* biggest clusters first — they have the strongest claim on the free space */
const fitted = [];
for (const members of clusters.sort((a, b) => b.length - a.length)) {
  const got = fitOrSplit(members, obs);
  if (!got.length) { orphans.push(...members); continue; }
  for (const g of got) fitted.push(g);
  orphans.push(...members.filter((p) => !got.some((g) => inBB(p, g.bb))));
}
for (const r of fitted) {
  const name = modeOf(r.held, 'kecamatan') || modeOf(r.held, 'kota') || 'District';
  const base = slug(name);
  const k = (taken.get(base) || 0) + 1;
  taken.set(base, k);
  const id = k > 1 ? `${base}-${k}` : base;
  const bb = {
    s: +r.bb.s.toFixed(5), w: +r.bb.w.toFixed(5),
    n: +r.bb.n.toFixed(5), e: +r.bb.e.toFixed(5),
  };
  added.push({
    id, name: name.toUpperCase(), src: `/data/zone-${id}.json`, bb,
    center: { lat: +((bb.s + bb.n) / 2).toFixed(5), lon: +((bb.w + bb.e) / 2).toFixed(5) },
    zIn: 2.1, zFull: 3.4, gen: true, pins: r.held.length,
  });
  if (!obs.includes(r.bb)) obs.push(bb);
}

/* Stage 2. What is left is boxed in: a pin sitting in the few-hundred-metre
   alley between two towers of the Kuningan corridor has no room for a box of
   its own. Those are reached by GROWING the nearest neighbour instead — but
   only a generated zone, never one of the six hand-made ones, whose data was
   fetched for exactly its published box. A grown zone has to be re-fetched, so
   its now-stale extract is moved aside for the fetch step to redo. */
const PINPAD = 0.0008; // ~90m of ground kept around a pin pulled inside a box
function growToReach(z, p) {
  const nb = { ...z.bb };
  if (p.lon > nb.e) nb.e = +(p.lon + PINPAD).toFixed(5);
  if (p.lon < nb.w) nb.w = +(p.lon - PINPAD).toFixed(5);
  if (p.lat > nb.n) nb.n = +(p.lat + PINPAD).toFixed(5);
  if (p.lat < nb.s) nb.s = +(p.lat - PINPAD).toFixed(5);
  if (nb.e - nb.w > MAXSPAN || nb.n - nb.s > MAXSPAN) return null;
  if (obs.some((ob) => ob !== z.bb && overlap(nb, ob))) return null;
  return nb;
}
const inAny = (p) => obs.some((bb) => inBB(p, bb));
const grown = new Map();
const genZones = defs.filter((d) => d.gen);
for (const p of orphans) {
  if (inAny(p)) continue;                 // an earlier growth already reached it
  let best = null;
  for (const z of genZones) {
    const nb = growToReach(z, p);
    if (!nb) continue;
    const cost = area(nb) - area(z.bb);
    if (!best || cost < best.cost) best = { z, nb, cost };
  }
  if (!best) continue;
  const i = obs.indexOf(best.z.bb);
  best.z.bb = best.nb;
  if (i >= 0) obs[i] = best.nb;
  best.z.center = { lat: +((best.nb.s + best.nb.n) / 2).toFixed(5), lon: +((best.nb.w + best.nb.e) / 2).toFixed(5) };
  grown.set(best.z.id, (grown.get(best.z.id) || 0) + 1);
}

console.log(`${pins.length} companies had no ground`);
console.log(`\n${added.length} infill zones:`);
for (const z of added) {
  console.log(`  ${z.id.padEnd(24)} ${z.name.padEnd(20)} pins=${String(z.pins).padStart(2)} ` +
    `span=${((z.bb.e - z.bb.w) * 111).toFixed(2)}x${((z.bb.n - z.bb.s) * 111).toFixed(2)}km`);
}
if (grown.size) {
  console.log(`\n${grown.size} existing zones grown to reach boxed-in pins (need a re-fetch):`);
  for (const [id, n] of grown) {
    const z = defs.find((d) => d.id === id);
    console.log(`  ${id.padEnd(24)} +${n} pin${n > 1 ? 's' : ''}  now ` +
      `${((z.bb.e - z.bb.w) * 111).toFixed(2)}x${((z.bb.n - z.bb.s) * 111).toFixed(2)}km`);
  }
}
const stillOut = orphans.filter((p) => !inAny(p));
if (stillOut.length) {
  console.log(`\n${stillOut.length} still without ground (no free space and no neighbour that can reach):`);
  for (const p of stillOut) console.log(`  ${p.name} — ${p.kecamatan || '?'}, ${p.kota || '?'}`);
}
const covered2 = pins.length - stillOut.length;
console.log(`\ncoverage: ${covered2}/${pins.length} of the uncovered companies now stand on real ground`);
if (DRY) { console.log('\n--dry-run: nothing written'); process.exit(0); }
if (!added.length && !grown.size) process.exit(0);

/* a grown zone's extract no longer covers its box — move it aside so the fetch
   step redoes it, rather than leaving the map with an invite frame over blank
   ground on the new edge */
const stale = path.join(ROOT, 'data', 'zone-stale');
if (grown.size) fs.mkdirSync(stale, { recursive: true });
for (const id of grown.keys()) {
  const f = path.join(ROOT, 'public', 'data', `zone-${id}.json`);
  if (fs.existsSync(f)) { fs.renameSync(f, path.join(stale, `zone-${id}.json`)); console.log(`stale -> data/zone-stale/zone-${id}.json`); }
}
fs.writeFileSync(DEFS, JSON.stringify([...defs, ...added], null, 1));
console.log(`\nzones-def.json: ${defs.length} -> ${defs.length + added.length} (${grown.size} boxes widened)`);
console.log('next: bash scripts/fetch-all-zones.sh   (skips what is already fetched, then publishes)');
