/* PASAR QR grove — a QR matrix as a little low-poly forest on a paved plot
 * (tree.icqr.com energy): every dark module is a tree with a trunk and a
 * leafy canopy, seasonal foliage, grass fringe, real shadows.
 * "Scan view" presses the grove into the code: trees swap for flat ink
 * squares (0.92 footprint), plate goes pure white, shadows off, dolly-zoom
 * to a near-orthographic top view — jsQR-verified. A round canopy cannot
 * meet the footprint floor, so the geometry swap is what keeps it scanning.
 * Finder plazas stay solid dark topiary blocks in both modes. */
import * as THREE from '/vendor/three.module.js';
import { OrbitControls } from '/vendor/OrbitControls.js';
import { RoundedBoxGeometry } from '/vendor/RoundedBoxGeometry.js';

const SCAN_INK = 0x14100c;
const SCAN_TILES = {
  morning: { dark: [0x2f6b33, 0x3f7d3f, 0x4f8c3a, 0x457f35, 0x2c5e3a], branch: 0x6b5a2f },
  dusk: { dark: [0x9c5a22, 0x8a4a1e, 0xa85f28, 0x7d4522, 0x94531f], branch: 0x6f4a2a },
  rain: { dark: [0x2f5d52, 0x3e6e63, 0x4f7d70, 0x2c5148, 0x37655a], branch: 0x4f463a },
};

export const THEMES = {
  morning: {
    bg: 0xf3ede0, sideC: 0xe3d9c4,
    foliage: [0x8fce62, 0x74bd4d, 0x5aa844, 0xa4da79, 0x67b24b],
    finder: 0x24462e, trunk: 0x8a6a45,
    grass: [0x7ccb4f, 0x93da66, 0x64b83f, 0xa9e37e],
    flower: 0xe8a63d,
    tiles: ['#ffffff', '#f6efdf', '#f1e9d6'],
    sprinkle: ['#e7d9b8', '#dfe9d5'],
    gtiles: ['#a6d878', '#93cd62', '#b4e289'],
    hemi: 0xfff6e6, hemiI: 1.15, sun: 0xffeccc, sunI: 1.6, sunPos: [18, 30, 14],
  },
  dusk: {
    bg: 0xf6ecdc, sideC: 0xe6d5b7,
    foliage: [0xe0a45a, 0xcf7f3a, 0xb9652c, 0xf0c479, 0xd98f45],
    finder: 0x53301a, trunk: 0x6f4a2a,
    grass: [0xa89451, 0xbfa964, 0x8f7c42, 0xcdb977],
    flower: 0xb65a6a,
    tiles: ['#fffaf0', '#f8eeda', '#f2e5c9'],
    sprinkle: ['#ecd9ae', '#e5cba0'],
    gtiles: ['#cdbb6e', '#bfa964', '#dbcb82'],
    hemi: 0xffdfba, hemiI: 1.05, sun: 0xffb36b, sunI: 2.2, sunPos: [30, 11, 20],
  },
  rain: {
    bg: 0xedf0f2, sideC: 0xd7dee2,
    foliage: [0x74ad92, 0x578f77, 0x8fc4a8, 0x467a63, 0x63a184],
    finder: 0x27404f, trunk: 0x5e4a38,
    grass: [0x6f9a7c, 0x86af90, 0x5d7d66, 0x9cbfa0],
    flower: 0x4e7a96,
    tiles: ['#ffffff', '#f0f3f4', '#e9eef0'],
    sprinkle: ['#dbe4e8', '#d2dde2'],
    gtiles: ['#8fbf9b', '#7cb08a', '#a3ceac'],
    hemi: 0xe8eef2, hemiI: 1.25, sun: 0xdde7ec, sunI: 1.0, sunPos: [10, 34, 8],
  },
};

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rnd = (seed, k) => (hash32(`${seed}${k}`) % 10000) / 10000;

function inFinder(x, y, size) {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
}

function tileTexture(theme, plateSize, seed) {
  const px = 24;
  const c = document.createElement('canvas');
  c.width = c.height = Math.min(1536, plateSize * px);
  const ctx = c.getContext('2d');
  const cell = c.width / plateSize;
  for (let y = 0; y < plateSize; y++) {
    for (let x = 0; x < plateSize; x++) {
      const r = rnd(seed, `t:${x}:${y}`);
      const rim = x < 2 || y < 2 || x >= plateSize - 2 || y >= plateSize - 2;
      let fill = theme.tiles[Math.floor(r * theme.tiles.length)];
      if (rim && r > 0.18) fill = theme.gtiles[Math.floor(rnd(seed, `g:${x}:${y}`) * theme.gtiles.length)];
      else if (r > 0.965) fill = theme.sprinkle[x % theme.sprinkle.length];
      ctx.fillStyle = fill;
      ctx.fillRect(x * cell, y * cell, Math.ceil(cell), Math.ceil(cell));
      ctx.fillStyle = 'rgba(120,100,70,0.07)';
      ctx.fillRect(x * cell, y * cell, Math.ceil(cell), 1.5);
      ctx.fillRect(x * cell, y * cell, 1.5, Math.ceil(cell));
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  g.addColorStop(0, 'rgba(90,70,45,0.30)');
  g.addColorStop(0.6, 'rgba(90,70,45,0.12)');
  g.addColorStop(1, 'rgba(90,70,45,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/* Build the grove for a QR matrix. Centered on origin, 1 unit per module. */
export function buildQrCityGroup(matrix, opts = {}) {
  const seed = opts.seed || 'pasar';
  const theme = THEMES[opts.theme] || THEMES.morning;
  const { size, grid } = matrix;
  const group = new THREE.Group();
  const quiet = 3;
  const border = 2.4;
  const plateSize = size + (quiet + border) * 2;

  /* soft seat shadow under the plate */
  const seat = new THREE.Mesh(
    new THREE.PlaneGeometry(plateSize * 1.7, plateSize * 1.7),
    new THREE.MeshBasicMaterial({ map: groundShadowTexture(), transparent: true, depthWrite: false }),
  );
  seat.rotation.x = -Math.PI / 2;
  seat.position.y = -1.28;
  group.add(seat);

  /* plate: unlit — pure white from above in scan mode */
  const sideMat = new THREE.MeshLambertMaterial({ color: theme.sideC });
  const topMat = new THREE.MeshBasicMaterial({ map: tileTexture(theme, plateSize, seed) });
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(plateSize, 1.2, plateSize),
    [sideMat, sideMat, topMat, sideMat, sideMat, sideMat],
  );
  plate.position.y = -0.6;
  group.add(plate);

  /* shadow catcher above the unlit plate top */
  const catcher = new THREE.Mesh(
    new THREE.PlaneGeometry(plateSize, plateSize),
    new THREE.ShadowMaterial({ opacity: 0.16 }),
  );
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.012;
  catcher.receiveShadow = true;
  group.add(catcher);

  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (grid[y][x] && !inFinder(x, y, size)) cells.push({ x, y });
  }
  const half = size / 2 - 0.5;
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();

  /* ── THE tree: segmented bending trunk, recursive branches, and a crown
   * of ~1,800 individual instanced leaf cards (the icqr look) ──────── */
  const grove = new THREE.Group();
  const H = plateSize * 0.95;
  const CR = plateSize * 0.40;
  const BARK_A = new THREE.Color(theme.trunk);
  const BARK_B = BARK_A.clone().offsetHSL(0.01, 0.05, 0.07);
  const barkMatA = new THREE.MeshLambertMaterial({ color: BARK_A, flatShading: true });
  const barkMatB = new THREE.MeshLambertMaterial({ color: BARK_B, flatShading: true });

  const leanX = (rnd(seed, 'lx') - 0.5) * 0.3, leanZ = (rnd(seed, 'lz') - 0.5) * 0.3;
  const spinePt = (t) => new THREE.Vector3(
    leanX * H * 0.16 * Math.pow(t, 1.6) + Math.sin(t * 9 + rnd(seed, 'wob') * 6) * H * 0.008,
    t * H * 0.5,
    leanZ * H * 0.16 * Math.pow(t, 1.6));

  function tube(a, b, r0, r1, mat) {
    const dir = b.clone().sub(a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r1, r0, len, 7);
    geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    m.castShadow = true;
    grove.add(m);
    return m;
  }

  // trunk: 9 ringed segments with taper (alternating bark tones = ring look)
  const NSEG = 9;
  for (let i = 0; i < NSEG; i++) {
    const t0 = i / NSEG, t1 = (i + 1) / NSEG;
    const r = (t) => H * (0.052 - 0.036 * t);
    tube(spinePt(t0), spinePt(t1), r(t0), r(t1), i % 2 ? barkMatB : barkMatA);
  }

  // recursive branches from the upper trunk; leaf clusters at the tips
  const clusters = [spinePt(1).add(new THREE.Vector3(0, H * 0.06, 0))];
  let bi = 0;
  function branch(pos, dir, len, rad, depth) {
    const k = bi++;
    const segs = depth === 0 ? 3 : 2;
    let p = pos.clone(), d = dir.clone();
    for (let sgi = 0; sgi < segs; sgi++) {
      d = d.clone().lerp(new THREE.Vector3(0, 1, 0), 0.16).normalize();
      d.x += (rnd(seed, `bx${k}${sgi}`) - 0.5) * 0.3;
      d.z += (rnd(seed, `bz${k}${sgi}`) - 0.5) * 0.3;
      d.normalize();
      const q = p.clone().add(d.clone().multiplyScalar(len / segs));
      tube(p, q, rad * (1 - sgi / segs * 0.5), rad * (1 - (sgi + 1) / segs * 0.55), barkMatA);
      p = q;
      if (p.y > H * 0.34) clusters.push(p.clone());   // leaves hug the whole branch
    }
    if (depth < 1) {
      const nkids = 2 + (hash32(`${seed}nk${k}`) % 2);
      for (let c = 0; c < nkids; c++) {
        const yaw = rnd(seed, `cy${k}${c}`) * Math.PI * 2;
        const nd = d.clone().add(new THREE.Vector3(Math.sin(yaw) * 0.8, 0.35, Math.cos(yaw) * 0.8)).normalize();
        branch(p, nd, len * 0.6, rad * 0.55, depth + 1);
      }
    }
  }
  const nMain = 5 + (hash32(seed) % 3);
  for (let b = 0; b < nMain; b++) {
    const yaw = (b / nMain) * Math.PI * 2 + rnd(seed, `myaw${b}`) * 0.8;
    const t0 = 0.62 + rnd(seed, `mt${b}`) * 0.34;
    const up = 0.35 + rnd(seed, `mu${b}`) * 0.45;
    const dir = new THREE.Vector3(Math.sin(yaw), up, Math.cos(yaw)).normalize();
    branch(spinePt(t0), dir, H * (0.3 + rnd(seed, `ml${b}`) * 0.14), H * 0.016, 0);
  }

  // leaf card geometry: a slightly folded rhombus
  const leafGeo = new THREE.BufferGeometry();
  leafGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0.62, 0.42, 0.1, 0, 0, 0.02, -0.62,
    0, 0, 0.62, 0, 0.02, -0.62, -0.42, 0.1, 0,
  ], 3));
  leafGeo.computeVertexNormals();
  const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const NL = 1800 + (hash32(seed + 'nl') % 300);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, NL);
  leaves.castShadow = true;
  const crownC = new THREE.Vector3(leanX * H * 0.1, H * 0.62, leanZ * H * 0.1);
  const eul = new THREE.Euler();
  const quat = new THREE.Quaternion();
  const vpos = new THREE.Vector3();
  const vscale = new THREE.Vector3();
  const leafSize = CR * 0.135;
  for (let i = 0; i < NL; i++) {
    const c = clusters[hash32(`${seed}lc${i}`) % clusters.length];
    const rr = CR * 0.62 * (0.4 + 0.6 * Math.cbrt(rnd(seed, `lr${i}`)));
    const th = rnd(seed, `lt${i}`) * Math.PI * 2;
    const ph = Math.acos(2 * rnd(seed, `lp${i}`) - 1);
    vpos.set(
      c.x + rr * Math.sin(ph) * Math.cos(th),
      c.y + rr * Math.cos(ph) * 0.8,
      c.z + rr * Math.sin(ph) * Math.sin(th));
    // keep the silhouette inside the crown ellipsoid and off the ground
    const ex = (vpos.x - crownC.x) / CR, ey = (vpos.y - crownC.y) / (H * 0.38), ez = (vpos.z - crownC.z) / CR;
    if (ex * ex + ey * ey + ez * ez > 1.15) { vpos.lerp(crownC, 0.35); }
    if (vpos.y < H * 0.3) vpos.y = H * 0.3 + rnd(seed, `lyy${i}`) * H * 0.05;
    eul.set(rnd(seed, `le1${i}`) * Math.PI, rnd(seed, `le2${i}`) * Math.PI * 2, rnd(seed, `le3${i}`) * Math.PI);
    quat.setFromEuler(eul);
    const sc = leafSize * (0.7 + rnd(seed, `ls${i}`) * 0.7);
    vscale.set(sc, sc, sc);
    m4.compose(vpos, quat, vscale);
    leaves.setMatrixAt(i, m4);
    const isBlossom = rnd(seed, `lb${i}`) > 0.965;
    const base = isBlossom
      ? new THREE.Color(opts.accentColor || '#C96F2E')
      : new THREE.Color(theme.foliage[hash32(`${seed}lcx${i}`) % theme.foliage.length]);
    if (!isBlossom) base.offsetHSL(0, 0, (rnd(seed, `lv${i}`) - 0.5) * 0.09);
    leaves.setColorAt(i, base);
  }
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  grove.add(leaves);

  /* fallen leaves on the pavement */
  const NFL = 30;
  const fallen = new THREE.InstancedMesh(leafGeo, leafMat.clone(), NFL);
  for (let i = 0; i < NFL; i++) {
    const a = rnd(seed, `fa${i}`) * Math.PI * 2;
    const rr = CR * (0.35 + rnd(seed, `fr${i}`) * 1.25);
    eul.set(0, rnd(seed, `fy${i}`) * Math.PI * 2, 0);
    quat.setFromEuler(eul);
    const sc = leafSize * (0.7 + rnd(seed, `fs${i}`) * 0.5);
    vpos.set(Math.cos(a) * rr, 0.05, Math.sin(a) * rr);
    vscale.set(sc, sc * 0.4, sc);
    m4.compose(vpos, quat, vscale);
    fallen.setMatrixAt(i, m4);
    fallen.setColorAt(i, col.set(theme.foliage[hash32(`${seed}fc${i}`) % theme.foliage.length]));
  }
  if (fallen.instanceColor) fallen.instanceColor.needsUpdate = true;
  grove.add(fallen);

  /* butterflies: two wing cards each, fluttering around the plot */
  const butterflies = [];
  const BF_COLORS = [0x8fc3ea, 0xf2d06b, opts.accentColor || '#C96F2E'];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Group();
    const wmat = new THREE.MeshBasicMaterial({ color: BF_COLORS[i % BF_COLORS.length], side: THREE.DoubleSide });
    const wgeo = new THREE.PlaneGeometry(0.9, 0.62);
    const wl = new THREE.Mesh(wgeo, wmat); wl.position.x = -0.45;
    const wr = new THREE.Mesh(wgeo, wmat); wr.position.x = 0.45;
    const pl = new THREE.Group(); pl.add(wl);
    const pr = new THREE.Group(); pr.add(wr);
    g.add(pl, pr);
    grove.add(g);
    butterflies.push({ g, pl, pr, ph: rnd(seed, `bfp${i}`) * 6.28, r: plateSize * (0.3 + i * 0.09), sp: 0.25 + i * 0.07, h: 3 + i * 2.2 });
  }
  group.add(grove);

  /* ── scan bricks: hidden flat ink squares, shown only in scan mode ── */
  const brickGeo = new THREE.BoxGeometry(0.98, 0.22, 0.98);
  brickGeo.translate(0, 0.11, 0);
  const scanPal = SCAN_TILES[opts.theme] || SCAN_TILES.morning;
  const scanMesh = new THREE.InstancedMesh(brickGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), cells.length);
  const swarm = [];
  const tmpQ = new THREE.Quaternion();
  cells.forEach((c, i) => {
    m4.makeScale(1, 1, 1);
    m4.setPosition(c.x - half, 0, c.y - half);
    scanMesh.setMatrixAt(i, m4);
    const h1 = hash32(`${seed}:${c.x}:${c.y}`);
    let tc = scanPal.dark[h1 % scanPal.dark.length];
    if (h1 % 17 === 0) tc = scanPal.branch;
    if (h1 % 41 === 0) tc = new THREE.Color(opts.accentColor || '#C96F2E').getHex();
    scanMesh.setColorAt(i, col.setHex(tc));
    // where this tile lives while it is part of the canopy
    const a = rnd(seed, `swa${i}`) * Math.PI * 2;
    const rr2 = Math.sqrt(rnd(seed, `swr${i}`)) * CR * 0.85;
    const sy2 = H * 0.62 + (rnd(seed, `swy${i}`) - 0.45) * H * 0.3;
    tmpQ.setFromEuler(new THREE.Euler(rnd(seed, `sq1${i}`) * Math.PI, rnd(seed, `sq2${i}`) * Math.PI * 2, rnd(seed, `sq3${i}`) * Math.PI));
    swarm.push({
      gx: c.x - half, gz: c.y - half,
      tx: Math.cos(a) * rr2 + leanX * H * 0.1, ty: Math.max(H * 0.32, sy2), tz: Math.sin(a) * rr2 + leanZ * H * 0.1,
      q: tmpQ.clone(), delay: rnd(seed, `swd${i}`) * 0.3,
    });
  });
  if (scanMesh.instanceColor) scanMesh.instanceColor.needsUpdate = true;
  scanMesh.visible = false;
  group.add(scanMesh);

  /* finder plazas: scan mode only — the 3D view is just the tree */
  const finderGroup = new THREE.Group();
  const finderMat = new THREE.MeshBasicMaterial({ color: (SCAN_TILES[opts.theme] || SCAN_TILES.morning).dark[4] });
  const whiteTop = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const [fx, fy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
    const cx = fx + 3 - half, cz = fy + 3 - half;
    const outer = new THREE.Mesh(new RoundedBoxGeometry(7, 1.4, 7, 2, 0.24), finderMat);
    outer.position.set(cx, 0.7, cz);
    const ring = new THREE.Mesh(new THREE.BoxGeometry(5, 0.26, 5), whiteTop);
    ring.position.set(cx, 1.42, cz);
    const core = new THREE.Mesh(new RoundedBoxGeometry(3, 1.9, 3, 2, 0.2), finderMat);
    core.position.set(cx, 0.95, cz);
    finderGroup.add(outer, ring, core);
  }
  finderGroup.visible = false;
  group.add(finderGroup);

  /* grass fringe with occasional flowers */
  const rimHalf = plateSize / 2;
  const blades = [];
  const flowers = [];
  const perimeter = Math.floor(plateSize * 14);
  for (let i = 0; i < perimeter; i++) {
    if (rnd(seed, `gpick${i}`) < 0.1) continue;
    const edge = i % 4;
    const along = (rnd(seed, `ga${i}`) - 0.5) * (plateSize - 1.2);
    const inset = 0.45 + rnd(seed, `gi${i}`) * (border - 0.7);
    const pos = edge === 0 ? [along, rimHalf - inset] : edge === 1 ? [along, -rimHalf + inset]
      : edge === 2 ? [rimHalf - inset, along] : [-rimHalf + inset, along];
    blades.push({ x: pos[0], z: pos[1], i });
    if (rnd(seed, `fl${i}`) > 0.965) flowers.push({ x: pos[0], z: pos[1], i });
  }
  let grassGroup = null;
  if (blades.length) {
    grassGroup = new THREE.Group();
    const bladeGeo = new THREE.ConeGeometry(0.06, 1.5, 4);
    bladeGeo.translate(0, 0.5, 0);
    const grass = new THREE.InstancedMesh(bladeGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), blades.length * 4);
    let gi = 0;
    for (const b of blades) {
      for (let k = 0; k < 4; k++) {
        const ox = (rnd(seed, `ox${b.i}:${k}`) - 0.5) * 0.55;
        const oz = (rnd(seed, `oz${b.i}:${k}`) - 0.5) * 0.55;
        const s = 0.55 + rnd(seed, `gs${b.i}:${k}`) * 0.85;
        m4.makeScale(1, s, 1);
        m4.setPosition(b.x + ox, 0, b.z + oz);
        grass.setMatrixAt(gi, m4);
        grass.setColorAt(gi, col.set(theme.grass[hash32(`${seed}gc${b.i}:${k}`) % theme.grass.length]));
        gi++;
      }
    }
    grass.instanceColor.needsUpdate = true;
    grassGroup.add(grass);
    if (flowers.length) {
      const petGeo = new THREE.SphereGeometry(0.09, 8, 6);
      const fmesh = new THREE.InstancedMesh(petGeo, new THREE.MeshLambertMaterial({ color: theme.flower }), flowers.length);
      flowers.forEach((f, i2) => {
        m4.makeTranslation(f.x, 0.62 + rnd(seed, `fh${f.i}`) * 0.25, f.z);
        fmesh.setMatrixAt(i2, m4);
      });
      grassGroup.add(fmesh);
    }
    group.add(grassGroup);
  }

  const tick = (t) => {
    for (const b of butterflies) {
      const a = t * b.sp + b.ph;
      b.g.position.set(Math.cos(a) * b.r, b.h + Math.sin(t * 1.7 + b.ph) * 1.6, Math.sin(a) * b.r);
      b.g.rotation.y = -a + Math.PI / 2;
      const flap = Math.sin(t * 16 + b.ph) * 0.85;
      b.pl.rotation.z = flap;
      b.pr.rotation.z = -flap;
    }
  };
  /* white cover: fades in over the paved tiles during the scan transition */
  const whiteCover = new THREE.Mesh(
    new THREE.PlaneGeometry(plateSize, plateSize),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }));
  whiteCover.rotation.x = -Math.PI / 2;
  whiteCover.position.y = 0.011;
  whiteCover.visible = false;
  group.add(whiteCover);

  const refs = { grove, scanMesh, finderGroup, topMat, sideMat, grass: grassGroup, seat, catcher,
    theme, plateSize, seed, tick, whiteCover, swarm };
  return { group, span: plateSize, refs };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* m: 0 = the standing tree, 1 = the flat mosaic. icqr mechanics: the code's
 * tiles are voxels that FLY between two formations — scattered through the
 * canopy at m=0, assembled on the grid at m=1, each with its own stagger and
 * arc. The leafy grove squashes away beneath the swarm; grass sinks late.
 * Everything is opaque scale/position animation — no transparency churn. */
const _q0 = new THREE.Quaternion();
const _m4 = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
function applyMix(refs, m) {
  const squash = clamp01((m - 0.05) / 0.6);
  const grassSink = clamp01((m - 0.6) / 0.28);
  const coverOp = clamp01((m - 0.7) / 0.22);

  refs.grove.visible = m < 0.93;
  const gsy = Math.max(0.02, 1 - 0.98 * (squash * squash));
  refs.grove.scale.set(1 - 0.16 * squash, gsy, 1 - 0.16 * squash);

  refs.scanMesh.visible = m > 0.01;
  refs.finderGroup.visible = m > 0.03;
  refs.finderGroup.scale.y = Math.max(0.02, clamp01((m - 0.03) / 0.35));
  for (let i = 0; i < refs.swarm.length; i++) {
    const t = refs.swarm[i];
    const p = clamp01((m - t.delay * 0.35) / 0.6);
    const e = p * p * (3 - 2 * p);                       // smoothstep per voxel
    const lift = Math.sin(e * Math.PI) * 2.2;            // little arc on the way
    _p.set(t.tx + (t.gx - t.tx) * e, t.ty * (1 - e) + lift * (1 - Math.abs(2 * e - 1)), t.tz + (t.gz - t.tz) * e);
    _q0.copy(t.q).slerp(IDENTITY_Q, e);
    const sc = 0.55 + 0.45 * e;
    _s.set(sc, sc, sc);
    _m4.compose(_p, _q0, _s);
    refs.scanMesh.setMatrixAt(i, _m4);
  }
  refs.scanMesh.instanceMatrix.needsUpdate = true;

  refs.whiteCover.visible = coverOp > 0.01;
  refs.whiteCover.material.opacity = coverOp;
  if (refs.grass) {
    refs.grass.visible = m < 0.92;
    refs.grass.scale.y = Math.max(0.02, 1 - 0.98 * grassSink);
  }
  if (refs.seat) {
    refs.seat.visible = m < 0.92;
    refs.seat.material.opacity = 1 - grassSink;
  }
  if (refs.catcher) refs.catcher.visible = m < 0.5;
}
const IDENTITY_Q = new THREE.Quaternion();
function applyScan(refs, scan) { applyMix(refs, scan ? 1 : 0); }

/* Mount an orbitable grove into a canvas.
 * Returns { aerial, setMatrix, setTheme, setAccentColor, dispose }. */
export function mountQrCity(canvas, matrix, opts = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const state = {
    theme: opts.theme || 'morning',
    accentColor: opts.accentColor || '#C96F2E',
    matrix,
    scan: false,
    mix: 0,
  };

  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cdb8, 1.2);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(18, 30, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(hemi, sun);

  let built = buildQrCityGroup(matrix, { ...opts, theme: state.theme, accentColor: state.accentColor });
  scene.add(built.group);
  fitShadow();
  applyTheme(state.theme, true);
  applyMix(built.refs, 0);

  function fitShadow() {
    const s = built.span * 0.75;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();
  }

  function applyTheme(name, skipRebuild) {
    state.theme = THEMES[name] ? name : 'morning';
    const t = THEMES[state.theme];
    hemi.color.set(t.hemi);
    hemi.intensity = t.hemiI;
    sun.color.set(t.sun);
    sun.intensity = t.sunI;
    sun.position.set(...t.sunPos);
    if (!skipRebuild) rebuild();
  }

  function rebuild() {
    scene.remove(built.group);
    disposeGroup(built.group);
    built = buildQrCityGroup(state.matrix, { ...opts, theme: state.theme, accentColor: state.accentColor });
    scene.add(built.group);
    fit();
    fitShadow();
    applyMix(built.refs, state.scan ? 1 : 0);
    state.mix = state.scan ? 1 : 0;
    renderer.compile(scene, camera);
  }

  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 2000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = 1.28;
  const fit = () => {
    controls.minDistance = built.span * 0.9;
    controls.maxDistance = built.span * 2.6;
  };
  fit();
  camera.position.set(built.span * 1.08, built.span * 0.82, built.span * 1.08);
  controls.target.set(0, built.span * 0.3, 0);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  controls.autoRotate = !reduced && opts.autoRotate !== false;
  controls.autoRotateSpeed = 0.65;

  function resize() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();
  renderer.compile(scene, camera);          // prewarm shaders: no first-morph hitch

  /* Aerial = swap grove→ink squares + dolly zoom to top view */
  let anim = null;
  const BASE_FOV = 36;
  const easeIO = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  function aerial() {
    controls.autoRotate = false;
    state.scan = true;
    const target0 = controls.target.clone();
    const rel = camera.position.clone().sub(target0);
    const sph = new THREE.Spherical().setFromVector3(rel);
    state.saved = { az: sph.theta, pol: sph.phi, dist: sph.radius, target: target0.clone() };
    controls.enabled = false;
    const dTop = built.span * 1.78;                       // same visual scale — a tilt, not a flight
    controls.maxDistance = Math.max(controls.maxDistance, dTop + 5);
    const t0 = performance.now();
    anim = (now) => {
      const t = Math.min(1, (now - t0) / 950);
      const e = easeIO(t);
      const pol = sph.phi + (0.015 - sph.phi) * e;
      const az = sph.theta * (1 - e);                     // settle grid-aligned
      const dist = sph.radius + (dTop - sph.radius) * e;
      const tgt = target0.clone().multiplyScalar(1 - e);
      camera.position.setFromSphericalCoords(dist, pol, az).add(tgt);
      controls.target.copy(tgt);
      camera.lookAt(tgt);
      applyMix(built.refs, t);
      state.mix = t;
      if (t >= 1) { anim = null; controls.enabled = true; }
    };
  }
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    if (state.scan || camera.fov < BASE_FOV - 1 || built.group.scale.y < 1) {
      anim = null;
      state.scan = false;
      const saved = state.saved || { az: 0.8, pol: 1.05, dist: built.span * 1.6, target: new THREE.Vector3(0, built.span * 0.3, 0) };
      const rel = camera.position.clone().sub(controls.target);
      const sph = new THREE.Spherical().setFromVector3(rel);
      const m0 = state.mix ?? 1;
      const t0 = performance.now();
      controls.enabled = false;
      anim = (now) => {
        const t = Math.min(1, (now - t0) / 750);
        const e = easeIO(t);
        const pol = sph.phi + (saved.pol - sph.phi) * e;
        const az = sph.theta + (saved.az - sph.theta) * e;
        const dist = sph.radius + (saved.dist - sph.radius) * e;
        const tgt = saved.target.clone().multiplyScalar(e);
        camera.position.setFromSphericalCoords(dist, pol, az).add(tgt);
        controls.target.copy(tgt);
        camera.lookAt(tgt);
        const m = m0 * (1 - e);
        applyMix(built.refs, m);
        state.mix = m;
        if (t >= 1) { anim = null; fit(); controls.enabled = true; }
      };
    }
  });

  function disposeGroup(group) {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
      if (obj.dispose) obj.dispose();
    });
  }

  let disposed = false;
  renderer.setAnimationLoop((now) => {
    if (disposed) return;
    if (anim) anim(now);
    if ((state.mix ?? 0) < 0.9 && built.refs.tick) built.refs.tick(now / 1000);
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    aerial,
    _debugMorph(t) {   // pose the transition at progress t (QA only)
      anim = null;
      if (!state.saved) {
        const rel = camera.position.clone().sub(controls.target);
        const sp = new THREE.Spherical().setFromVector3(rel);
        state.saved = { az: sp.theta, pol: sp.phi, dist: sp.radius, target: controls.target.clone() };
      }
      const sv = state.saved;
      const e = easeIO(t);
      const dTop = built.span * 1.78;
      const pol = sv.pol + (0.015 - sv.pol) * e;
      const az = sv.az * (1 - e);
      const dist = sv.dist + (dTop - sv.dist) * e;
      const tgt = sv.target.clone().multiplyScalar(1 - e);
      camera.position.setFromSphericalCoords(dist, pol, az).add(tgt);
      controls.target.copy(tgt);
      camera.lookAt(tgt);
      applyMix(built.refs, t);
      state.mix = t;
    },
    setMatrix(mx, newOpts) {
      if (newOpts) {
        Object.assign(opts, newOpts);
        if (newOpts.accentColor) state.accentColor = newOpts.accentColor;
      }
      state.matrix = mx;
      rebuild();
    },
    setTheme(name) { applyTheme(name); },
    setAccentColor(hex) {
      state.accentColor = hex;
      rebuild();
    },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      ro.disconnect();
      disposeGroup(built.group);
      renderer.dispose();
    },
  };
}
