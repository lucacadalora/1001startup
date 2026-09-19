/* PASAR Drive v2 — SCBD, Jakarta, in a toon/anime pass over real OSM data:
 * real street grid, real towers (building:part where mapped) with hand-tuned
 * real facade palettes, parks/water, real street trees, lane dashes,
 * sidewalk margins, traffic signals, ambient NPC traffic, ink outlines and
 * stepped toon shading. Arrows/WASD drive; R resets; click a named tower. */
import * as THREE from '/vendor/three.module.js';
import { RoundedBoxGeometry } from '/vendor/RoundedBoxGeometry.js';
import { mergeGeometries } from '/vendor/BufferGeometryUtils.js';

const $ = (id) => document.getElementById(id);
const wrap = $('drive-wrap'), canvas = $('drive-canvas');
const hudRoad = $('hud-road'), hudSpeed = $('hud-speed');
const panel = $('drive-panel');

const GROUND = 0xf2ead8, ASPHALT = 0x6e675c, SERVICE = 0x81796d, FOG = 0xf6efdf;
const SIDEWALK = 0xe0d7c2, DASH = 0xf6f1e4, GRASS = 0x94bf7f, WATER = 0x84b7cb;
const INKLINE = 0x2c261e;
const ROAD_W = { motorway: 15, trunk: 14, primary: 13, secondary: 11, tertiary: 9, residential: 7, unclassified: 7, living_street: 6, service: 4.5 };
const CAR_COLORS = [0xc96f2e, 0x3f7d4e, 0x4e7a96, 0xb65a6a, 0xb08a2e, 0x8a5a83, 0x50565e, 0xd9d2c2];

/* real-world facade palette for the landmarks (from reference imagery) */
const FACADES = [
  ['treasury', 0x2e3f4e], ['sequis', 0xbccfd8], ['energy', 0x4e748c],
  ['prosperity', 0x8fa6b5], ['equity', 0x7c93a6], ['pacific century', 0x9fb2c0],
  ['idx', 0xc9b99a], ['bursa efek', 0xc9b99a], ['pacific place', 0xd9cdb4],
  ['ritz', 0xcbbfa4], ['langham', 0x564d43], ['district 8', 0x564d43],
  ['eternity', 0x564d43], ['infinity', 0x564d43], ['residence 8', 0x5f564b],
  ['office 8', 0x4e463d], ['ashta', 0x6e6255], ['alila', 0xb9b2a6],
  ['artha graha', 0xa89b85],
];

let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); } catch { renderer = null; }
if (!renderer) {
  canvas.style.display = 'none';
  $('drive-fallback').style.display = 'block';
} else boot();

async function boot() {
  const map = await (await fetch('/data/scbd.json?v=2')).json();
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 430, 1150);
  scene.add(new THREE.HemisphereLight(0xfff6e4, 0xd6cbb4, 1.1));
  const sun = new THREE.DirectionalLight(0xffeccc, 1.5);
  sun.position.set(300, 460, 180);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const S = 720;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 50, far: 1200 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  /* toon gradient: 4 stepped bands = anime shading */
  const gradientMap = new THREE.DataTexture(new Uint8Array([90, 150, 210, 255]), 4, 1, THREE.RedFormat);
  gradientMap.needsUpdate = true;
  const toon = (opts) => new THREE.MeshToonMaterial({ gradientMap, ...opts });

  /* ground */
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(map.span.x * 1.6, map.span.z * 1.6), toon({ color: GROUND }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* flat polygon helper (green/water) — mirrored like the buildings */
  function flatPoly(rings, color, y) {
    const geos = [];
    for (const ring of rings) {
      const sh = new THREE.Shape();
      sh.moveTo(ring[0][0], -ring[0][1]);
      for (let i = 1; i < ring.length; i++) sh.lineTo(ring[i][0], -ring[i][1]);
      const g = new THREE.ShapeGeometry(sh);
      g.rotateX(-Math.PI / 2);
      geos.push(g);
    }
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos, false), toon({ color }));
    m.position.y = y;
    m.receiveShadow = true;
    scene.add(m);
  }
  flatPoly(map.green || [], GRASS, 0.025);
  flatPoly(map.water || [], WATER, 0.02);

  /* ── roads: ribbons + sidewalk margins + lane dashes ─────────────── */
  function ribbon(points, w) {
    const verts = [], idx = [];
    const half = w / 2;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const pPrev = points[Math.max(0, i - 1)], pNext = points[Math.min(n - 1, i + 1)];
      let dx = pNext[0] - pPrev[0], dz = pNext[1] - pPrev[1];
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const nx = -dz, nz = dx;
      verts.push(p[0] + nx * half, 0, p[1] + nz * half, p[0] - nx * half, 0, p[1] - nz * half);
    }
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const mainGeos = [], svcGeos = [], walkGeos = [], dashGeos = [];
  const dashProto = new THREE.BoxGeometry(0.4, 0.06, 2.4);
  for (const r of map.roads) {
    const w = ROAD_W[r.c] || 7;
    const g = ribbon(r.p, w);
    if (r.c === 'service') { svcGeos.push(g); continue; }
    mainGeos.push(g);
    walkGeos.push(ribbon(r.p, w + 5.5));
    // centre dashes along the polyline
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const ang = Math.atan2(bx - ax, bz - az);
      for (let d = 3.5; d < L - 2; d += 9) {
        const t = d / L;
        const geo = dashProto.clone();
        geo.rotateY(ang);
        geo.translate(ax + (bx - ax) * t, 0.09, az + (bz - az) * t);
        dashGeos.push(geo);
      }
    }
  }
  for (const [geos, color, y, shadow] of [
    [walkGeos, SIDEWALK, 0.035, true],
    [mainGeos, ASPHALT, 0.06, true],
    [svcGeos, SERVICE, 0.045, false],
    [dashGeos, DASH, 0, false],
  ]) {
    if (!geos.length) continue;
    const m = new THREE.Mesh(mergeGeometries(geos, false), toon({ color }));
    m.position.y = y;
    if (shadow) m.receiveShadow = true;
    scene.add(m);
  }

  /* ── buildings ───────────────────────────────────────────────────── */
  const bucketGeos = { low: [], mid: [], tall: [], glass: [] };
  const outlineGeos = [];
  const towers = [];
  const colliders = [];
  const winTex = windowTexture();

  function shapeOf(poly) {
    const s = new THREE.Shape();
    s.moveTo(poly[0][0], -poly[0][1]);
    for (let i = 1; i < poly.length; i++) s.lineTo(poly[i][0], -poly[i][1]);
    return s;
  }
  function facadeFor(name, h) {
    const n = (name || '').toLowerCase();
    for (const [k, c] of FACADES) if (n.includes(k)) return new THREE.Color(c);
    return glassColor(h);
  }
  function centroidIn(pt, polyList) {
    for (const c of polyList) {
      if (pt[0] >= c.minx && pt[0] <= c.maxx && pt[1] >= c.minz && pt[1] <= c.maxz && inPoly(pt[0], pt[1], c.poly)) return true;
    }
    return false;
  }

  // parts first (they override their outline building)
  const partBoxes = [];
  for (const p of map.parts || []) {
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    for (const [x, z] of p.p) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
    }
    partBoxes.push({ minx, minz, maxx, maxz, poly: p.p });
    const h = p.h || 20, m0 = p.m || 0;
    const geo = new THREE.ExtrudeGeometry(shapeOf(p.p), { depth: h - m0, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, m0, 0);
    const mesh = new THREE.Mesh(geo, toon({ color: p.c ? new THREE.Color(p.c) : facadeFor(p.n, h), map: h > 60 ? winTex : null }));
    mesh.castShadow = true;
    scene.add(mesh);
    outlineGeos.push(new THREE.EdgesGeometry(geo, 30));
    colliders.push({ minx, minz, maxx, maxz, poly: p.p, name: p.n, h });
  }

  for (const b of map.buildings) {
    let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
    let cx = 0, cz = 0;
    for (const [x, z] of b.p) {
      if (x < minx) minx = x; if (x > maxx) maxx = x;
      if (z < minz) minz = z; if (z > maxz) maxz = z;
      cx += x; cz += z;
    }
    cx /= b.p.length; cz /= b.p.length;
    if (partBoxes.length && centroidIn([cx, cz], partBoxes)) continue; // parts cover it
    const h = b.h || 14;
    const geo = new THREE.ExtrudeGeometry(shapeOf(b.p), { depth: h, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    colliders.push({ minx, minz, maxx, maxz, poly: b.p, name: b.n, h });
    const named = b.n && h >= 60;
    if (named) {
      const mat = toon({ color: facadeFor(b.n, h), map: winTex });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.userData = { name: b.n, h, cx: (minx + maxx) / 2, cz: (minz + maxz) / 2 };
      towers.push(mesh);
      scene.add(mesh);
      outlineGeos.push(new THREE.EdgesGeometry(geo, 30));
    } else {
      const k = h < 18 ? 'low' : h < 45 ? 'mid' : h < 90 ? 'tall' : 'glass';
      bucketGeos[k].push(geo);
      if (b.c) { /* rare tagged colour on unnamed: ignore for merge simplicity */ }
    }
  }
  const BUCKET_COLORS = { low: 0xe6ddc8, mid: 0xd3cab6, tall: 0xbdc7c9, glass: 0x9ab0bc };
  for (const k of Object.keys(bucketGeos)) {
    if (!bucketGeos[k].length) continue;
    const merged = mergeGeometries(bucketGeos[k], false);
    const m = new THREE.Mesh(merged, toon({ color: BUCKET_COLORS[k] }));
    m.castShadow = k !== 'low';
    m.receiveShadow = true;
    scene.add(m);
    if (k === 'tall' || k === 'glass') outlineGeos.push(new THREE.EdgesGeometry(merged, 30));
  }
  if (outlineGeos.length) {
    const lines = new THREE.LineSegments(
      mergeGeometries(outlineGeos, false),
      new THREE.LineBasicMaterial({ color: INKLINE, transparent: true, opacity: 0.35 }));
    scene.add(lines);
  }
  function glassColor(h) {
    const t = Math.min(1, (h - 60) / 220);
    return new THREE.Color().setHSL(0.56, 0.18 + t * 0.1, 0.64 - t * 0.18);
  }
  function windowTexture() {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, 64, 256);
    x.fillStyle = 'rgba(25,35,45,0.30)';
    for (let y = 0; y < 256; y += 8) x.fillRect(0, y, 64, 4);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 22, 1 / 3.6);
    return t;
  }

  /* ── landscaping: real tree points + planted boulevards ──────────── */
  const treeSpots = (map.trees || []).map(([x, z]) => [x, z, 1]);
  for (const r of map.roads) {
    if (!['trunk', 'primary', 'secondary'].includes(r.c)) continue;
    const w = ROAD_W[r.c] / 2 + 6;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const dx = (bx - ax) / (L || 1), dz = (bz - az) / (L || 1);
      for (let d = 10; d < L; d += 26) {
        if (Math.random() < 0.35) continue;
        const x = ax + dx * d, z = az + dz * d;
        for (const side of [-1, 1]) {
          if (Math.random() < 0.4) continue;
          treeSpots.push([x + -dz * side * w, z + dx * side * w, 0.8]);
        }
      }
    }
  }
  {
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 3.2, 6);
    trunkGeo.translate(0, 1.6, 0);
    const crownGeo = new THREE.IcosahedronGeometry(2.4, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, toon({ color: 0x8a6a45 }), treeSpots.length);
    const crowns = new THREE.InstancedMesh(crownGeo, toon({ color: 0xffffff }), treeSpots.length);
    trunks.castShadow = true; crowns.castShadow = true;
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    const GREENS = [0x6fae63, 0x86c078, 0x5d9a54];
    treeSpots.forEach(([x, z, s0], i) => {
      const s = s0 * (0.8 + Math.random() * 0.5);
      m4.makeScale(s, s, s);
      m4.setPosition(x, 0, z);
      trunks.setMatrixAt(i, m4);
      m4.makeScale(s, s * 1.05, s);
      m4.setPosition(x, 3.4 * s, z);
      crowns.setMatrixAt(i, m4);
      crowns.setColorAt(i, col.setHex(GREENS[i % GREENS.length]));
    });
    crowns.instanceColor.needsUpdate = true;
    scene.add(trunks, crowns);
  }

  /* traffic signals */
  for (const [x, z] of map.signals || []) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 6), toon({ color: 0x3a352e }));
    pole.position.y = 2.7;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.7, 0.5), toon({ color: 0x26221c }));
    head.position.y = 5.6;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x2fae5c }));
    lamp.position.set(0, 5.2, 0.27);
    g.add(pole, head, lamp);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  /* labels for the tallest named towers */
  const labeled = towers.slice().sort((a, b) => b.userData.h - a.userData.h).slice(0, 14);
  await document.fonts.ready;
  for (const t of labeled) {
    const sp = makeLabel(t.userData.name);
    sp.position.set(t.userData.cx, t.userData.h + 16, t.userData.cz);
    scene.add(sp);
  }
  function makeLabel(text) {
    const S2 = 2;
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    x.font = `500 ${22 * S2}px "IBM Plex Mono", monospace`;
    const w = Math.ceil(x.measureText(text.toUpperCase()).width) + 36 * S2;
    c.width = w; c.height = 44 * S2;
    x.fillStyle = 'rgba(255,255,255,0.94)';
    x.fillRect(0, 0, w, 44 * S2);
    x.strokeStyle = '#00000022';
    x.strokeRect(0, 0, w, 44 * S2);
    x.fillStyle = '#000';
    x.font = `500 ${22 * S2}px "IBM Plex Mono", monospace`;
    x.textBaseline = 'middle';
    x.fillText(text.toUpperCase(), 18 * S2, 23 * S2);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95 }));
    sp.scale.set(w / (44 * S2) * 14, 14, 1);
    return sp;
  }

  /* spatial hash + point-in-poly + nearest road */
  const CELL = 40;
  const grid = new Map();
  const key = (x, z) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  colliders.forEach((c, i) => {
    for (let gx = Math.floor(c.minx / CELL); gx <= Math.floor(c.maxx / CELL); gx++)
      for (let gz = Math.floor(c.minz / CELL); gz <= Math.floor(c.maxz / CELL); gz++) {
        const k = `${gx},${gz}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(i);
      }
  });
  function inPoly(px2, pz2, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0], zi = poly[i][1], xj = poly[j][0], zj = poly[j][1];
      if (((zi > pz2) !== (zj > pz2)) && (px2 < (xj - xi) * (pz2 - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside;
  }
  function hitBuilding(x, z) {
    const ids = grid.get(key(x, z));
    if (!ids) return null;
    for (const i of ids) {
      const c = colliders[i];
      if (x >= c.minx && x <= c.maxx && z >= c.minz && z <= c.maxz && inPoly(x, z, c.poly)) return c;
    }
    return null;
  }
  const roadSegs = [];
  for (const r of map.roads) {
    if (r.c === 'service') continue;
    for (let i = 0; i < r.p.length - 1; i++) roadSegs.push({ a: r.p[i], b: r.p[i + 1], n: r.n });
  }
  function nearestRoad(x, z) {
    let best = null, bd = 1e9;
    for (const s of roadSegs) {
      const ax = s.a[0], az = s.a[1], bx = s.b[0], bz = s.b[1];
      const dx = bx - ax, dz = bz - az;
      const L2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / L2;
      t = Math.max(0, Math.min(1, t));
      const px2 = ax + dx * t, pz2 = az + dz * t;
      const d = (x - px2) ** 2 + (z - pz2) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return bd < 30 * 30 ? best : null;
  }

  /* ── cars (player + NPC) ─────────────────────────────────────────── */
  function makeCar(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.0, 4.4, 2, 0.22), toon({ color }));
    body.position.y = 0.9;
    body.castShadow = true;
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.75, 2.1, 2, 0.18), toon({ color: 0x2a2119 }));
    cabin.position.set(0, 1.62, -0.2);
    cabin.castShadow = true;
    g.add(body, cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.36, 12);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = toon({ color: 0x1c1712 });
    for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.42, wz);
      g.add(w);
    }
    return g;
  }
  const car = makeCar(0xc96f2e);
  scene.add(car);

  /* NPC traffic: loop along long real roads */
  const npcRoads = map.roads.filter((r) => {
    if (r.c === 'service') return false;
    let L = 0;
    for (let i = 0; i < r.p.length - 1; i++) L += Math.hypot(r.p[i + 1][0] - r.p[i][0], r.p[i + 1][1] - r.p[i][1]);
    r._len = L;
    return L > 180;
  });
  const npcs = [];
  for (let i = 0; i < Math.min(16, npcRoads.length * 2); i++) {
    const r = npcRoads[i % npcRoads.length];
    const mesh = makeCar(CAR_COLORS[i % CAR_COLORS.length]);
    mesh.scale.setScalar(0.92);
    scene.add(mesh);
    npcs.push({ r, mesh, d: Math.random() * r._len, v: 7 + Math.random() * 5, dir: Math.random() < 0.5 ? 1 : -1, off: 2.6 });
  }
  function roadPoint(r, d) {
    let acc = 0;
    for (let i = 0; i < r.p.length - 1; i++) {
      const [ax, az] = r.p[i], [bx, bz] = r.p[i + 1];
      const L = Math.hypot(bx - ax, bz - az);
      if (acc + L >= d) {
        const t = (d - acc) / L;
        const dx = (bx - ax) / L, dz = (bz - az) / L;
        return [ax + (bx - ax) * t, az + (bz - az) * t, dx, dz];
      }
      acc += L;
    }
    const [ax, az] = r.p[r.p.length - 2], [bx, bz] = r.p[r.p.length - 1];
    const L = Math.hypot(bx - ax, bz - az) || 1;
    return [bx, bz, (bx - ax) / L, (bz - az) / L];
  }

  /* start on Jalan Jenderal Sudirman if present */
  let sx = 0, sz = 0, sh = 0;
  const sudir = map.roads.find((r) => r.n && /sudirman/i.test(r.n) && r.p.length > 4);
  if (sudir) {
    const mid = Math.floor(sudir.p.length / 2);
    sx = sudir.p[mid][0]; sz = sudir.p[mid][1];
    sh = Math.atan2(sudir.p[mid + 1][0] - sx, sudir.p[mid + 1][1] - sz);
  }
  const state = { x: sx, z: sz, heading: sh, v: 0 };

  const keys = {};
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'r') { state.x = sx; state.z = sz; state.heading = sh; state.v = 0; }
  });
  addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  for (const [id, k] of [['tc-left', 'arrowleft'], ['tc-right', 'arrowright'], ['tc-go', 'arrowup'], ['tc-stop', 'arrowdown']]) {
    const el = $(id);
    if (!el) continue;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); keys[k] = true; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => { keys[k] = false; });
    el.addEventListener('pointercancel', () => { keys[k] = false; });
  }

  const camera = new THREE.PerspectiveCamera(52, 1, 0.5, 2400);
  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(wrap);
  resize();
  camera.position.set(sx - Math.sin(sh) * 14, 8, sz - Math.cos(sh) * 14);

  /* click/tap towers */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const [x0, y0, t0] = downAt;
    downAt = null;
    if (Math.hypot(e.clientX - x0, e.clientY - y0) > 8 || performance.now() - t0 > 400) return;
    const r = canvas.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(towers, false)[0];
    if (hit) {
      const u = hit.object.userData;
      panel.innerHTML = '<button class="x" aria-label="Close">✕</button><div class="cat"></div><h3></h3><p></p>';
      panel.querySelector('.cat').textContent = 'SCBD · JAKARTA';
      panel.querySelector('h3').textContent = u.name;
      panel.querySelector('p').textContent = `${u.h} m — a future address for startups on the map.`;
      panel.querySelector('.x').addEventListener('click', () => { panel.style.display = 'none'; });
      panel.style.display = 'block';
    } else panel.style.display = 'none';
  });

  /* ── drive loop ──────────────────────────────────────────────────── */
  const WHEELBASE = 2.9;
  let last = performance.now();
  let hudTick = 0;
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const fwd = (keys.w || keys.arrowup) ? 1 : 0;
    const back = (keys.s || keys.arrowdown) ? 1 : 0;
    const left = (keys.a || keys.arrowleft) ? 1 : 0;
    const right = (keys.d || keys.arrowright) ? 1 : 0;

    const accel = fwd * 16 - back * (state.v > 0.5 ? 26 : 9);
    state.v += accel * dt;
    state.v -= state.v * 0.9 * dt;
    state.v = Math.max(-8, Math.min(30, state.v));
    if (!fwd && !back && Math.abs(state.v) < 0.3) state.v = 0;

    const steer = (left - right) * 0.5 / (1 + Math.abs(state.v) * 0.06);
    if (Math.abs(state.v) > 0.1) state.heading += (state.v / WHEELBASE) * Math.tan(steer) * dt;

    const nx = state.x + Math.sin(state.heading) * state.v * dt;
    const nz = state.z + Math.cos(state.heading) * state.v * dt;
    const noseX = nx + Math.sin(state.heading) * 2.4, noseZ = nz + Math.cos(state.heading) * 2.4;
    if (hitBuilding(noseX, noseZ) || hitBuilding(nx, nz)) {
      state.v = -state.v * 0.15;
    } else {
      state.x = Math.max(-map.span.x, Math.min(map.span.x, nx));
      state.z = Math.max(-map.span.z, Math.min(map.span.z, nz));
    }

    car.position.set(state.x, 0, state.z);
    car.rotation.y = state.heading;

    /* NPC traffic */
    for (const n of npcs) {
      n.d += n.v * n.dir * dt;
      if (n.d > n.r._len - 2) { n.d = n.r._len - 2; n.dir = -1; }
      if (n.d < 2) { n.d = 2; n.dir = 1; }
      const [x, z, dx, dz] = roadPoint(n.r, n.d);
      n.mesh.position.set(x + -dz * n.off * n.dir, 0, z + dx * n.off * n.dir);
      n.mesh.rotation.y = Math.atan2(dx * n.dir, dz * n.dir);
    }

    const dist = 11 + Math.abs(state.v) * 0.25;
    const cx = state.x - Math.sin(state.heading) * dist;
    const cz = state.z - Math.cos(state.heading) * dist;
    camera.position.lerp(new THREE.Vector3(cx, 6.5 + Math.abs(state.v) * 0.08, cz), 0.09);
    camera.lookAt(state.x + Math.sin(state.heading) * 8, 2.2, state.z + Math.cos(state.heading) * 8);

    if (now - hudTick > 350) {
      hudTick = now;
      const r = nearestRoad(state.x, state.z);
      hudRoad.textContent = r && r.n ? r.n.toUpperCase() : 'SCBD · JAKARTA';
      hudSpeed.textContent = `${Math.round(Math.abs(state.v) * 3.6)} KM/H`;
    }

    renderer.render(scene, camera);
  });
}
