'use strict';
/* The Whoosh (Kereta Cepat Jakarta–Bandung) alignment, from OpenStreetMap.
 * Usage: node scripts/fetch-whoosh.js
 * Writes public/data/whoosh.json: one ordered polyline Halim → Tegalluar with
 * per-point ground/viaduct/tunnel flags, plus the four stations.
 *
 * The KCJB is the only highspeed=yes railway in Indonesia, so the query is a
 * bbox sweep for that tag. The line is double-track: each direction is its own
 * chain of ways, connected only at crossovers, so a greedy TRACE from Halim
 * (always continue onto the touching way that keeps the heading) follows one
 * track end to end and never wanders onto the twin or into the Tegalluar
 * depot (service ways are excluded anyway). */
const fs = require('fs');
const path = require('path');

const BBOX = { s: -7.05, w: 106.80, n: -6.16, e: 107.80 };
const q = `[out:json][timeout:180];
(
  way["railway"="rail"]["highspeed"="yes"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
  node["railway"="station"](${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e});
);
out tags geom;`;

const MX = 111320 * Math.cos(-6.6 * Math.PI / 180), MZ = 110540; // m per degree
const mDist = (a, b) => Math.hypot((a[0] - b[0]) * MX, (a[1] - b[1]) * MZ);

(async () => {
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let data = null;
  for (let attempt = 0; attempt < 4 && !data; attempt++) {
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'pasar-vantis/1.0 (census map; contact via vantis.sh)' },
          body: 'data=' + encodeURIComponent(q),
        });
        if (res.status === 429 || res.status === 502 || res.status === 504) {
          console.log(`${ep} busy (${res.status}), waiting…`);
          await sleep(20000 * (attempt + 1));
          continue;
        }
        if (!res.ok) { console.log(`${ep} → ${res.status}`); continue; }
        data = await res.json();
        console.log(`fetched from ${ep}: ${data.elements.length} elements`);
        break;
      } catch (e) { console.log(`${ep} failed: ${e.message}`); await sleep(3000); }
    }
  }
  if (!data) { console.error('all endpoints failed'); process.exit(1); }

  /* ── the track ways ── */
  const ways = data.elements.filter((el) => el.type === 'way' && el.tags
    && el.tags.railway === 'rail' && el.tags.highspeed === 'yes'
    && !el.tags.service && el.geometry && el.geometry.length > 1)
    .map((el) => ({
      id: el.id,
      pts: el.geometry.map((g) => [g.lon, g.lat]),
      tunnel: el.tags.tunnel === 'yes' ? 1 : 0,
      bridge: (el.tags.bridge && el.tags.bridge !== 'no') ? 1 : 0,
      used: false,
    }));
  console.log(`${ways.length} highspeed track ways`);

  const stations = data.elements.filter((el) => el.type === 'node' && el.tags
    && el.tags.railway === 'station');
  console.log('station nodes:');
  for (const s of stations) console.log(` - ${s.tags.name} [station=${s.tags.station || '-'}] op=${s.tags.operator || '-'} @ ${s.lat},${s.lon}`);

  /* Halim anchor: the high_speed station named Halim, else a fixed fallback */
  const hs = stations.filter((s) => s.tags.station === 'high_speed'
    || /kcic|kereta cepat|whoosh/i.test((s.tags.operator || '') + ' ' + (s.tags.name || '')));
  const findSt = (re) => hs.find((s) => re.test(s.tags.name || ''))
    || stations.find((s) => re.test(s.tags.name || ''));
  const halim = findSt(/halim/i);
  const start = halim ? [halim.lon, halim.lat] : [106.8916, -6.2466];

  /* ── trace one track Halim → Tegalluar ── */
  const JOIN = 60; // metres — endpoints this close count as connected
  let best = null, bd = 1e9;
  for (const w of ways) {
    for (const end of [w.pts[0], w.pts[w.pts.length - 1]]) {
      const d = mDist(end, start);
      if (d < bd) { bd = d; best = { w, rev: end !== w.pts[0] }; }
    }
  }
  if (!best) { console.error('no way near Halim'); process.exit(1); }
  console.log(`start way ${best.w.id}, ${Math.round(bd)}m from Halim`);

  const line = [];   // [lon, lat, flag] flag: 0 ground, 1 bridge, 2 tunnel
  const pushWay = (w, rev) => {
    const pts = rev ? [...w.pts].reverse() : w.pts;
    const f = w.tunnel ? 2 : w.bridge ? 1 : 0;
    for (const p of pts) {
      const last = line[line.length - 1];
      if (last && mDist(last, p) < 1) { last[2] = Math.max(last[2], f); continue; }
      line.push([p[0], p[1], f]);
    }
    w.used = true;
  };
  pushWay(best.w, best.rev);
  for (;;) {
    const tail = line[line.length - 1];
    const prev = line[line.length - 2];
    const hd = [tail[0] - prev[0], tail[1] - prev[1]];
    const hl = Math.hypot(hd[0] * MX, hd[1] * MZ) || 1;
    let cand = null, cs = -1;
    for (const w of ways) {
      if (w.used) continue;
      for (const rev of [false, true]) {
        const a = rev ? w.pts[w.pts.length - 1] : w.pts[0];
        const b = rev ? w.pts[w.pts.length - 2] : w.pts[1];
        if (mDist(a, tail) > JOIN) continue;
        const dv = [b[0] - a[0], b[1] - a[1]];
        const dl = Math.hypot(dv[0] * MX, dv[1] * MZ) || 1;
        const dot = (hd[0] * dv[0] * MX * MX + hd[1] * dv[1] * MZ * MZ) / (hl * dl);
        if (dot > cs) { cs = dot; cand = { w, rev }; }
      }
    }
    if (!cand || cs < -0.2) break;
    pushWay(cand.w, cand.rev);
  }
  let len = 0;
  for (let i = 1; i < line.length; i++) len += mDist(line[i - 1], line[i]);
  console.log(`traced ${line.length} pts, ${(len / 1000).toFixed(1)} km, ${ways.filter((w) => w.used).length} ways used`);

  /* ── simplify, preserving flag-run boundaries ── */
  const dp = (pts, tol) => {
    if (pts.length < 3) return pts;
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const rec = (i0, i1) => {
      if (i1 - i0 < 2) return;
      const a = pts[i0], b = pts[i1];
      const abx = (b[0] - a[0]) * MX, aby = (b[1] - a[1]) * MZ;
      const ab2 = abx * abx + aby * aby || 1e-9;
      let mi = -1, md = 0;
      for (let i = i0 + 1; i < i1; i++) {
        const px = (pts[i][0] - a[0]) * MX, py = (pts[i][1] - a[1]) * MZ;
        const t = Math.max(0, Math.min(1, (px * abx + py * aby) / ab2));
        const d = Math.hypot(px - t * abx, py - t * aby);
        if (d > md) { md = d; mi = i; }
      }
      if (md > tol) { keep[mi] = 1; rec(i0, mi); rec(mi, i1); }
    };
    rec(0, pts.length - 1);
    return pts.filter((_, i) => keep[i]);
  };
  /* A point's flag describes the segment that STARTS at it (the client draws
     segment i→i+1 in the style of point i). Runs of equal flag simplify
     independently so a tunnel portal never moves. */
  const out = [];
  let runStart = 0;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i][2] === line[runStart][2]) continue;
    const flag = line[runStart][2];
    const seg = dp(line.slice(runStart, i), 45);
    for (const r of seg) {
      const rp = [+r[0].toFixed(5), +r[1].toFixed(5), flag];
      const last = out[out.length - 1];
      if (last && last[0] === rp[0] && last[1] === rp[1]) continue;
      out.push(rp);
    }
    runStart = i;
  }
  console.log(`simplified to ${out.length} pts`);

  /* ── the four stations ── */
  const want = [
    ['Halim', /halim/i], ['Karawang', /karawang/i],
    ['Padalarang', /padalarang/i], ['Tegalluar', /tegalluar/i],
  ];
  const nearLine = (p) => {
    let d = 1e9;
    for (const l of out) d = Math.min(d, mDist(l, p));
    return d;
  };
  const st = [];
  for (const [name, re] of want) {
    const s = findSt(re);
    if (!s) { console.log(`station MISSING: ${name}`); continue; }
    const d = nearLine([s.lon, s.lat]);
    console.log(`${name}: "${s.tags.name}" ${Math.round(d)}m off line`);
    if (d > 800) { console.log(`  → too far from line, skipped`); continue; }
    st.push({ n: name, lon: +s.lon.toFixed(5), lat: +s.lat.toFixed(5) });
  }

  const json = {
    source: 'OpenStreetMap (ODbL) — railway=rail + highspeed=yes ways and railway=station nodes',
    fetched: new Date().toISOString().slice(0, 10),
    km: +(len / 1000).toFixed(1),
    line: out,
    stations: st,
  };
  const file = path.join(__dirname, '..', 'public', 'data', 'whoosh.json');
  fs.writeFileSync(file, JSON.stringify(json));
  console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(1)} KB)`);
})();
