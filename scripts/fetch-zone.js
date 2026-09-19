'use strict';
/* Parameterized detail-zone fetch (buildings + roads + greens from Overpass).
 * Usage: node scripts/fetch-zone.js <id> <s> <w> <n> <e>
 * Writes public/data/zone-<id>.json. Cloned from fetch-southquarter.js;
 * heights: OSM height tag -> building:levels*3.5 -> 0 (client default). */
const fs = require('fs');
const path = require('path');

const [, , ZID, S, W, N, E] = process.argv;
if (!ZID || !S || !W || !N || !E) { console.error('usage: fetch-zone.js <id> <s> <w> <n> <e>'); process.exit(1); }
const BBOX = { s: +S, w: +W, n: +N, e: +E };
const LAT0 = (BBOX.s + BBOX.n) / 2;
const LON0 = (BBOX.w + BBOX.e) / 2;
const MX = 111320 * Math.cos(LAT0 * Math.PI / 180); // m per deg lon
const MZ = 110540;                                   // m per deg lat

// Known SCBD tower heights (m) when OSM lacks tags — matched by name substring.
const MANUAL = [];

const q = `[out:json][timeout:90];
(
  way["building"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  relation["building"]["type"="multipolygon"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  /* A stadium is not always a building in OSM. Stadion Utama Gelora Bung Karno
     and Stadion Madya carry leisure=stadium and NO building tag, so the query
     above walked straight past the two largest structures in the GBK complex —
     the whole reason the area rendered as bare grass. */
  way["leisure"="stadium"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  relation["leisure"="stadium"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["building:part"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["highway"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["leisure"~"park|garden|pitch|track|swimming_pool"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["landuse"~"grass|forest|recreation_ground|village_green|greenery"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  /* the canopy. GBK is a forest with a stadium in it and OSM says so — 19
     natural=wood polygons — but the query only ever asked for landuse, so the
     complex arrived as one flat lawn. */
  way["natural"~"wood|scrub"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["natural"="water"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["amenity"="parking"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  node["natural"="tree"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  node["highway"="traffic_signals"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
);
out tags geom;`;

const px = (lon) => +(((lon - LON0) * MX).toFixed(1));
const pz = (lat) => +((-(lat - LAT0) * MZ).toFixed(1));

function heightOf(tags, name, isStadium) {
  if (tags.height) { const h = parseFloat(String(tags.height).replace('m', '')); if (h > 2) return Math.round(h); }
  if (tags['building:levels']) { const l = parseFloat(tags['building:levels']); if (l > 0) return Math.round(l * 3.5); }
  /* A stadium's OSM height, where it has one at all, is usually the pitch-side
     wall (Istora says 2 m). The client's 12 m default is worse. GBK's main bowl
     stands about 40 m to the roof lip; the smaller venues about half that. */
  if (isStadium) return /stadion utama/i.test(name || '') ? 40
    : /stadion madya|arena/i.test(name || '') ? 22 : 14;
  const n = (name || '').toLowerCase();
  for (const [k, h] of MANUAL) if (n.includes(k)) return h;
  return 0; // unknown → client default
}

(async () => {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  /* One shot per endpoint left 15 of the 87 zones unfetched: a dense bbox makes
     Overpass answer 429 (slot busy) or 504 (timed out), and the next endpoint is
     usually just as busy at that moment. Waiting is what actually works — the
     public instances free a slot within a minute or two — so each endpoint gets
     several attempts with a growing pause, and a rate-limit answer waits longer
     than a plain error. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ATTEMPTS = 4;
  let data = null, lastErr = null;
  outer:
  for (let attempt = 0; attempt < ATTEMPTS && !data; attempt++) {
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'pasar-jakarta/1.0 (one-time map fetch)',
          },
          body: 'data=' + encodeURIComponent(q),
        });
        if (!res.ok) {
          const busy = res.status === 429 || res.status === 504 || res.status === 502;
          throw Object.assign(new Error(`overpass ${res.status} @ ${ep}`), { busy });
        }
        data = await res.json();
        break outer;
      } catch (e) {
        lastErr = e;
        console.error(`${String(e)} (attempt ${attempt + 1}/${ATTEMPTS})`);
        await sleep(e.busy ? 20000 * (attempt + 1) : 3000);
      }
    }
  }
  if (!data) throw lastErr;

  const buildings = [];
  const parts = [];
  const roads = [];
  const green = [];
  const water = [];
  const trees = [];
  const signals = [];
  for (const el of data.elements) {
    const tags = el.tags || {};
    /* Hoisted, because the green branch below claims ANY leisure tag and would
       otherwise swallow the stadium before the building branch ever sees it —
       which is exactly why the GBK bowl rendered as a lawn. */
    const isStadium = tags.leisure === 'stadium' || tags.building === 'stadium';
    if (el.type === 'node' && tags.natural === 'tree') { trees.push([px(el.lon), pz(el.lat)]); continue; }
    if (el.type === 'node' && tags.highway === 'traffic_signals') { signals.push([px(el.lon), pz(el.lat)]); continue; }
    if (tags['building:part'] && tags['building:part'] !== 'no' && el.type === 'way' && el.geometry && el.geometry.length > 3) {
      const name = tags.name || '';
      let minH = 0;
      if (tags.min_height) minH = parseFloat(String(tags.min_height).replace('m','')) || 0;
      else if (tags['building:min_level']) minH = (parseFloat(tags['building:min_level']) || 0) * 3.5;
      parts.push({
        n: name || undefined,
        h: heightOf(tags, name) || undefined,
        m: minH ? Math.round(minH) : undefined,
        c: tags['building:colour'] || undefined,
        p: el.geometry.map((g) => [px(g.lon), pz(g.lat)]),
      });
      continue;
    }
    /* Ground is not one thing. A football pitch, a wood, a car park and a
       swimming pool were all being flattened into the same lawn fill, which is
       most of why the GBK complex read as wasted green. `k` names the kind and
       the client colours it; entries stay ARRAYS in older zone files, so the
       client accepts both shapes. */
    const groundKind = (t) =>
      t.natural === 'wood' || t.natural === 'scrub' || t.landuse === 'forest' ? 'wood'
      : t.leisure === 'swimming_pool' || t.natural === 'water' ? 'water'
      : t.amenity === 'parking' ? 'parking'
      : t.leisure === 'pitch' || t.leisure === 'track' ? 'pitch'
      : t.leisure === 'park' || t.leisure === 'garden' ? 'park'
      : (t.leisure || t.landuse) ? 'grass' : null;
    const gk = groundKind(tags);
    if (gk && !isStadium && el.geometry && el.geometry.length > 3) {
      const rec = { k: gk, p: el.geometry.map((g) => [px(g.lon), pz(g.lat)]) };
      if (gk === 'pitch' && tags.sport) rec.s = tags.sport;
      green.push(rec);
      continue;
    }
    if (tags.natural === 'water' && el.geometry && el.geometry.length > 3) {
      water.push(el.geometry.map((g) => [px(g.lon), pz(g.lat)]));
      continue;
    }
    /* A stadium counts as a structure even when OSM gives it no building tag —
       Stadion Utama Gelora Bung Karno and Stadion Madya are both leisure-only.
       `k` carries the kind through to the client, which draws a landmark rather
       than an extruded box. */
    const isBld = !!tags.building || isStadium;
    if (isBld && el.type === 'way' && el.geometry && el.geometry.length > 3) {
      const name = tags.name || tags['name:en'] || '';
      buildings.push({
        n: name || undefined,
        h: heightOf(tags, name, isStadium) || undefined,
        k: isStadium ? 'stadium' : undefined,
        c: tags['building:colour'] || undefined,
        p: el.geometry.map((g) => [px(g.lon), pz(g.lat)]),
      });
    } else if (isBld && el.type === 'relation' && el.members) {
      const outer = el.members.filter((m) => m.role === 'outer' && m.geometry);
      if (!outer.length) continue;
      const name = tags.name || '';
      // take the largest outer ring; holes are rare and cosmetic here
      let best = null;
      for (const m of outer) if (!best || m.geometry.length > best.geometry.length) best = m;
      buildings.push({
        n: name || undefined,
        h: heightOf(tags, name, isStadium) || undefined,
        k: isStadium ? 'stadium' : undefined,
        p: best.geometry.map((g) => [px(g.lon), pz(g.lat)]),
      });
    } else if (tags.highway && el.geometry && el.geometry.length > 1) {
      const cls = tags.highway;
      if (['footway', 'path', 'steps', 'cycleway', 'pedestrian', 'corridor', 'platform'].includes(cls)) continue;
      roads.push({
        n: tags.name || undefined,
        c: cls,
        l: tags.lanes ? parseInt(tags.lanes) : undefined,
        p: el.geometry.map((g) => [px(g.lon), pz(g.lat)]),
      });
    }
  }

  const out = {
    center: { lat: LAT0, lon: LON0 },
    span: { x: Math.round((BBOX.e - BBOX.w) * MX), z: Math.round((BBOX.n - BBOX.s) * MZ) },
    buildings, parts, roads, green, water, trees, signals,
  };
  const file = path.join(__dirname, '..', 'public', 'data', `zone-${ZID}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  const named = buildings.filter((b) => b.n).length;
  const withH = buildings.filter((b) => b.h).length;
  console.log(`parts=${parts.length} green=${green.length} water=${water.length} trees=${trees.length} signals=${signals.length}`);
  console.log(`buildings=${buildings.length} (named=${named}, with-height=${withH}) roads=${roads.length} bytes=${fs.statSync(file).size}`);
  console.log('tallest:', buildings.filter((b) => b.h).sort((a, b) => b.h - a.h).slice(0, 12).map((b) => `${b.n || '?'}:${b.h}`).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
