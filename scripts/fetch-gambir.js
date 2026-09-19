'use strict';
/* One-time fetch of the Gambir / Medan Merdeka area (Sarana Jaya, Indosat HQ,
 * Monas) from OpenStreetMap via Overpass, written to public/data/gambir.json.
 * Cloned from fetch-scbd.js.
 * Re-run to refresh. Heights: OSM height tag → building:levels*3.5 → manual
 * override for known towers → 14m default. */
const fs = require('fs');
const path = require('path');

const BBOX = { s: -6.1865, w: 106.8115, n: -6.1690, e: 106.8285 }; // Gambir: Sarana Jaya + Indosat + Monas
const LAT0 = (BBOX.s + BBOX.n) / 2;
const LON0 = (BBOX.w + BBOX.e) / 2;
const MX = 111320 * Math.cos(LAT0 * Math.PI / 180); // m per deg lon
const MZ = 110540;                                   // m per deg lat

// Known SCBD tower heights (m) when OSM lacks tags — matched by name substring.
const MANUAL = [
  ['monumen nasional', 132], ['monas', 132],   // the obelisk's public height
];

const q = `[out:json][timeout:90];
(
  way["building"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  relation["building"]["type"="multipolygon"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["building:part"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["highway"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["leisure"~"park|garden|pitch"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["landuse"~"grass|forest|recreation_ground|village_green"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  way["natural"="water"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  node["natural"="tree"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  node["highway"="traffic_signals"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
);
out tags geom;`;

const px = (lon) => +(((lon - LON0) * MX).toFixed(1));
const pz = (lat) => +((-(lat - LAT0) * MZ).toFixed(1));

function heightOf(tags, name) {
  if (tags.height) { const h = parseFloat(String(tags.height).replace('m', '')); if (h > 2) return Math.round(h); }
  if (tags['building:levels']) { const l = parseFloat(tags['building:levels']); if (l > 0) return Math.round(l * 3.5); }
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
  let data = null, lastErr = null;
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
      if (!res.ok) throw new Error(`overpass ${res.status} @ ${ep}`);
      data = await res.json();
      break;
    } catch (e) { lastErr = e; console.error(String(e)); }
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
    if ((tags.leisure || tags.landuse) && el.geometry && el.geometry.length > 3) {
      green.push(el.geometry.map((g) => [px(g.lon), pz(g.lat)]));
      continue;
    }
    if (tags.natural === 'water' && el.geometry && el.geometry.length > 3) {
      water.push(el.geometry.map((g) => [px(g.lon), pz(g.lat)]));
      continue;
    }
    if (tags.building && el.type === 'way' && el.geometry && el.geometry.length > 3) {
      const name = tags.name || tags['name:en'] || '';
      buildings.push({
        n: name || undefined,
        h: heightOf(tags, name) || undefined,
        c: tags['building:colour'] || undefined,
        p: el.geometry.map((g) => [px(g.lon), pz(g.lat)]),
      });
    } else if (tags.building && el.type === 'relation' && el.members) {
      const outer = el.members.filter((m) => m.role === 'outer' && m.geometry);
      if (!outer.length) continue;
      const name = tags.name || '';
      // take the largest outer ring; holes are rare and cosmetic here
      let best = null;
      for (const m of outer) if (!best || m.geometry.length > best.geometry.length) best = m;
      buildings.push({
        n: name || undefined,
        h: heightOf(tags, name) || undefined,
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
  const file = path.join(__dirname, '..', 'public', 'data', 'gambir.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out));
  const named = buildings.filter((b) => b.n).length;
  const withH = buildings.filter((b) => b.h).length;
  console.log(`parts=${parts.length} green=${green.length} water=${water.length} trees=${trees.length} signals=${signals.length}`);
  console.log(`buildings=${buildings.length} (named=${named}, with-height=${withH}) roads=${roads.length} bytes=${fs.statSync(file).size}`);
  console.log('tallest:', buildings.filter((b) => b.h).sort((a, b) => b.h - a.h).slice(0, 12).map((b) => `${b.n || '?'}:${b.h}`).join(' | '));
})().catch((e) => { console.error(e); process.exit(1); });
