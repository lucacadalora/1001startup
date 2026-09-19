/* The PASAR world: a warm toy city. Districts branch off a central boulevard;
 * each merchant is a colored brick building with a stud roof on their
 * district's street. Trees, crosswalks and shadows keep it alive while empty.
 * Hover = tooltip, click = locked detail panel (hover never steals a lock).
 * Deep links: ?focus=<handle>, ?district=<key>. */
import * as THREE from '/vendor/three.module.js';
import { OrbitControls } from '/vendor/OrbitControls.js';
import { RoundedBoxGeometry } from '/vendor/RoundedBoxGeometry.js';
import { buildQrCityGroup } from '/js/qr3d.js?v=p22';

const $ = (id) => document.getElementById(id);
const wrap = $('world-wrap'), canvas = $('world-canvas');
const tip = $('world-tip'), panel = $('world-panel'), hint = $('world-hint');
const chipsEl = $('world-chips'), qEl = $('world-q'), hitsEl = $('world-hits');

const PAPER = 0xf0e9da, ROAD = 0xded3bc, LOT = 0xe8e0cd, PAD = 0xd8cdb4;
const TRUNK = 0x8a6a45;
const LEAVES = [0x5f9e63, 0x74b378, 0x4b8a52, 0x86c284];

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rnd = (k) => (hash32(String(k)) % 10000) / 10000;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) { renderer = null; }
if (!renderer) {
  canvas.style.display = 'none';
  $('world-fallback').style.display = 'block';
} else {
  boot();
}

async function boot() {
  const world = await (await fetch('/api/world')).json();
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.fog = new THREE.Fog(PAPER, 380, 760);
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0xd8cdb8, 1.15));
  const sun = new THREE.DirectionalLight(0xffeccc, 1.5);
  sun.position.set(120, 180, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -260, right: 260, top: 260, bottom: -260, near: 10, far: 500 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  /* ground with a soft radial warmth */
  const gc = document.createElement('canvas');
  gc.width = gc.height = 512;
  const gctx = gc.getContext('2d');
  const grad = gctx.createRadialGradient(256, 256, 60, 256, 256, 360);
  grad.addColorStop(0, '#f4eddd');
  grad.addColorStop(1, '#e9e0cb');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 512, 512);
  const gtex = new THREE.CanvasTexture(gc);
  gtex.colorSpace = THREE.SRGBColorSpace;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 900), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: ROAD });
  const blvd = new THREE.Mesh(
    new THREE.PlaneGeometry(world.boulevard.x1 - world.boulevard.x0, world.boulevard.half * 2), roadMat);
  blvd.rotation.x = -Math.PI / 2;
  blvd.position.set((world.boulevard.x0 + world.boulevard.x1) / 2, 0.02, 0);
  blvd.receiveShadow = true;
  scene.add(blvd);

  const plaza = new THREE.Mesh(new THREE.CircleGeometry(world.plaza.r, 48), roadMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(world.plaza.x, 0.03, world.plaza.z);
  plaza.receiveShadow = true;
  scene.add(plaza);

  const crossMat = new THREE.MeshLambertMaterial({ color: 0xf7f2e6 });
  for (const d of world.districts) {
    const len = Math.abs(d.street.z1 - d.street.z0);
    const st = new THREE.Mesh(new THREE.PlaneGeometry(world.streetHalf * 2, len), roadMat);
    st.rotation.x = -Math.PI / 2;
    st.position.set(d.street.x, 0.02, (d.street.z0 + d.street.z1) / 2);
    st.receiveShadow = true;
    scene.add(st);
    // crosswalk stripes where the street meets the boulevard
    for (let s = -3; s <= 3; s++) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 4.4), crossMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(d.street.x + s * 2.1, 0.05, d.dir * (world.boulevard.half - 2.6));
      scene.add(stripe);
    }
  }

  /* plaza landmark: a small QR diorama that encodes the site itself */
  try {
    const mx = await (await fetch('/api/qr/matrix?data=' + encodeURIComponent('https://pasar.vantis.sh'))).json();
    const monument = buildQrCityGroup(mx, { seed: 'plaza', theme: 'morning' });
    monument.group.scale.setScalar(0.42);
    monument.group.position.set(world.plaza.x, 0.4, world.plaza.z);
    scene.add(monument.group);
  } catch { /* plaza stays open */ }

  /* street trees: along the boulevard edges and at street ends */
  const treeSpots = [];
  for (let x = world.boulevard.x0 + 14; x < world.boulevard.x1 - 6; x += 16) {
    if (world.districts.some((d) => Math.abs(d.street.x - x) < 8)) continue; // keep crossings clear
    treeSpots.push([x + (rnd('tx' + x) - 0.5) * 4, world.boulevard.half + 4.5]);
    treeSpots.push([x + (rnd('ty' + x) - 0.5) * 4, -world.boulevard.half - 4.5]);
  }
  for (const d of world.districts) {
    treeSpots.push([d.street.x + world.streetHalf + 3.5, d.street.z1 + d.dir * 5]);
    treeSpots.push([d.street.x - world.streetHalf - 3.5, d.street.z1 + d.dir * 5]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.65, 3.4, 7);
  trunkGeo.translate(0, 1.7, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.7, 1);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: TRUNK }), treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), treeSpots.length * 2);
  trunks.castShadow = true;
  crowns.castShadow = true;
  {
    const m4t = new THREE.Matrix4();
    const colT = new THREE.Color();
    let ci = 0;
    treeSpots.forEach(([tx, tz], i) => {
      const s = 0.8 + rnd('ts' + i) * 0.6;
      m4t.makeScale(s, s, s);
      m4t.setPosition(tx, 0, tz);
      trunks.setMatrixAt(i, m4t);
      for (let k = 0; k < 2; k++) {
        const cs = s * (k ? 0.62 : 1);
        m4t.makeScale(cs, cs * 0.9, cs);
        m4t.setPosition(tx + (k ? (rnd('cx' + i) - 0.5) * 1.6 : 0), 3.2 * s + k * 1.5 * s, tz + (k ? (rnd('cz' + i) - 0.5) * 1.6 : 0));
        crowns.setMatrixAt(ci, m4t);
        crowns.setColorAt(ci, colT.set(LEAVES[hash32('lc' + i + k) % LEAVES.length]));
        ci++;
      }
    });
    crowns.instanceColor.needsUpdate = true;
    scene.add(trunks, crowns);
  }

  /* merchants: colored brick buildings with studs */
  const merchants = [];
  for (const d of world.districts) for (const m of d.merchants) merchants.push({ ...m, district: d });

  const m4 = new THREE.Matrix4();
  let bodies = null;
  if (merchants.length) {
    const brickGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
    brickGeo.translate(0, 0.5, 0);
    bodies = new THREE.InstancedMesh(brickGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), merchants.length);
    bodies.castShadow = true;
    const studGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14);
    const studs = new THREE.InstancedMesh(studGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), merchants.length);
    const pads = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: PAD }), merchants.length);
    pads.receiveShadow = true;
    const doorGeo = new THREE.BoxGeometry(0.24, 1, 1);
    const doors = new THREE.InstancedMesh(doorGeo, new THREE.MeshLambertMaterial({ color: 0xfaf6ee }), merchants.length);
    const roofGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.05);
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), merchants.length);
    const padRot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const sc = new THREE.Matrix4();
    const col = new THREE.Color();
    merchants.forEach((m, i) => {
      const bodyCol = col.set(m.featured ? '#E8B84B' : m.accent);
      m4.makeScale(m.w, m.h, m.d);
      m4.setPosition(m.x, 0, m.z);
      bodies.setMatrixAt(i, m4);
      bodies.setColorAt(i, bodyCol);
      m4.makeScale(m.w * 0.35, 1, m.d * 0.35);
      m4.setPosition(m.x, m.h + 0.32, m.z);
      studs.setMatrixAt(i, m4);
      studs.setColorAt(i, col.clone().offsetHSL(0, 0, 0.08));
      // roof slab with a slight overhang, darker than the body
      m4.makeScale(m.w * 1.08, 0.42, m.d * 1.08);
      m4.setPosition(m.x, m.h, m.z);
      roofs.setMatrixAt(i, m4);
      roofs.setColorAt(i, col.clone().offsetHSL(0, 0, -0.1));
      // door on the street-facing wall (streets run along z at district x)
      const face = m.x >= m.district.x ? -1 : 1;
      m4.makeScale(1, 2.4, 1.7);
      m4.setPosition(m.x + face * (m.w / 2), 1.2, m.z);
      doors.setMatrixAt(i, m4);
      m4.copy(padRot);
      sc.makeScale(m.w + 2.6, m.d + 2.6, 1);
      m4.multiply(sc);
      m4.setPosition(m.x, 0.05, m.z);
      pads.setMatrixAt(i, m4);
    });
    bodies.instanceColor.needsUpdate = true;
    studs.instanceColor.needsUpdate = true;
    roofs.instanceColor.needsUpdate = true;
    scene.add(pads, bodies, studs, roofs, doors);
  }

  /* vacant lots: thin dashed-look frames instead of solid slabs */
  const lots = [];
  for (const d of world.districts) for (const v of d.vacantLots) lots.push(v);
  if (lots.length) {
    const frameMat = new THREE.MeshLambertMaterial({ color: PAD });
    const seg = new THREE.PlaneGeometry(2.1, 0.5);
    const frames = new THREE.InstancedMesh(seg, frameMat, lots.length * 8);
    const rot = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const rot90 = new THREE.Matrix4().makeRotationX(-Math.PI / 2).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
    let fi = 0;
    for (const v of lots) {
      for (const [dx, dz, vert] of [[-2.6, -4.2, 0], [2.6, -4.2, 0], [-2.6, 4.2, 0], [2.6, 4.2, 0],
        [-4.2, -2.6, 1], [-4.2, 2.6, 1], [4.2, -2.6, 1], [4.2, 2.6, 1]]) {
        m4.copy(vert ? rot90 : rot);
        m4.setPosition(v.x + dx, 0.04, v.z + dz);
        frames.setMatrixAt(fi++, m4);
      }
    }
    scene.add(frames);
  }

  /* district signs on poles */
  const makeSign = (text) => {
    const S = 2; // 2x raster so signs stay crisp when close
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = `700 ${44 * S}px "Bricolage Grotesque", sans-serif`;
    const w = Math.ceil(ctx.measureText(text).width) + 72 * S;
    c.width = w; c.height = 92 * S;
    const x = ctx;
    x.fillStyle = '#ffffff';
    x.strokeStyle = '#d9ceb8';
    x.lineWidth = 3 * S;
    roundRect(x, 2 * S, 2 * S, w - 4 * S, 88 * S, 26 * S);
    x.fill(); x.stroke();
    x.fillStyle = '#201a14';
    x.font = `700 ${44 * S}px "Bricolage Grotesque", sans-serif`;
    x.textBaseline = 'middle';
    x.fillText(text, 36 * S, 48 * S);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 8;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, opacity: 0.97, transparent: true }));
    sp.scale.set(w / (92 * S) * 2.6, 2.6, 1);
    return sp;
  };
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  await document.fonts.ready;
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.14, 6.4, 8);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5e });
  for (const d of world.districts) {
    const sx = d.x + world.streetHalf + 2.6, sz = d.dir * (world.boulevard.half + 3.2);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(sx, 3.2, sz);
    pole.castShadow = true;
    scene.add(pole);
    const sp = makeSign(d.name);
    sp.position.set(sx, 7.4, sz);
    scene.add(sp);
  }

  /* camera + controls */
  const span = (world.boulevard.x1 - world.boulevard.x0) / 2;
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1400);
  // open at the west-gate plaza so the QR monument anchors the first frame
  camera.position.set(world.plaza.x + 60, 46, 86);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.target.set(world.plaza.x + 44, 0, 2);
  controls.maxPolarAngle = 1.32;
  controls.minPolarAngle = 0.12;
  controls.minDistance = 30;
  controls.maxDistance = 480;
  controls.addEventListener('change', () => {
    controls.target.x = Math.max(-span - 60, Math.min(span + 40, controls.target.x));
    controls.target.z = Math.max(-150, Math.min(150, controls.target.z));
    controls.target.y = 0;
  });

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(wrap);
  resize();

  /* fly-to animation */
  let anim = null;
  function flyTo(x, z, dist = 60) {
    const fromT = controls.target.clone();
    const toT = new THREE.Vector3(x, 0, z);
    const fromC = camera.position.clone();
    const dirV = new THREE.Vector3(0.4, 0.85, 0.75).normalize().multiplyScalar(dist);
    const toC = toT.clone().add(dirV);
    const t0 = performance.now();
    anim = (now) => {
      const t = Math.min(1, (now - t0) / 850);
      const e = 1 - Math.pow(1 - t, 3);
      controls.target.lerpVectors(fromT, toT, e);
      camera.position.lerpVectors(fromC, toC, e);
      if (t >= 1) anim = null;
    };
  }

  /* hover tooltip + click panel (click locks; hover is inert while locked) */
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let hovered = -1, locked = false, pendingHover = null;

  canvas.addEventListener('pointermove', (ev) => { pendingHover = ev; });
  canvas.addEventListener('pointerleave', () => { pendingHover = null; hovered = -1; tip.style.display = 'none'; });

  function doHover(ev) {
    if (!bodies || locked) { tip.style.display = 'none'; return; }
    const r = canvas.getBoundingClientRect();
    ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObject(bodies, false)[0];
    if (hit && hit.instanceId != null) {
      hovered = hit.instanceId;
      const m = merchants[hovered];
      tip.innerHTML = `<b></b><span class="d"></span>`;
      tip.querySelector('b').textContent = m.name;
      tip.querySelector('.d').textContent = m.district.name;
      tip.style.left = ev.clientX - r.left + 'px';
      tip.style.top = ev.clientY - r.top + 'px';
      tip.style.display = 'block';
      canvas.style.cursor = 'pointer';
    } else {
      hovered = -1;
      tip.style.display = 'none';
      canvas.style.cursor = 'grab';
    }
  }

  let downAt = null;
  canvas.addEventListener('pointerdown', (ev) => { downAt = [ev.clientX, ev.clientY, performance.now()]; });
  canvas.addEventListener('pointerup', (ev) => {
    if (!downAt) return;
    const [x0, y0, t0] = downAt;
    downAt = null;
    if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6 || performance.now() - t0 > 500) return; // drag, not tap
    if (!bodies) return;
    const r = canvas.getBoundingClientRect();
    ptr.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    ptr.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObject(bodies, false)[0];
    if (hit && hit.instanceId != null) openPanel(merchants[hit.instanceId]);
    else closePanel();
  });

  function openPanel(m) {
    locked = true;
    tip.style.display = 'none';
    panel.innerHTML = `
      <button class="x" aria-label="Close">✕</button>
      <div class="cat"></div><h3></h3><p></p>
      <div class="row">
        <a class="btn primary sm" rel="noopener">Visit page</a>
        <button class="btn ghost sm" type="button">Copy link</button>
      </div>`;
    panel.querySelector('.cat').textContent = m.district.name;
    panel.querySelector('h3').textContent = m.name;
    panel.querySelector('p').textContent = m.bio || `@${m.handle}`;
    const visit = panel.querySelector('a');
    visit.href = `/@${m.handle}`;
    const copy = panel.querySelector('button.ghost');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(`https://pasar.vantis.sh/@${m.handle}`); copy.textContent = 'Copied'; }
      catch { copy.textContent = location.origin + `/@${m.handle}`; }
    });
    panel.querySelector('.x').addEventListener('click', closePanel);
    panel.style.display = 'block';
    flyTo(m.x, m.z, 105);
  }
  function closePanel() { locked = false; panel.style.display = 'none'; }
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

  /* district chips */
  for (const d of world.districts) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.innerHTML = '<b></b>';
    b.querySelector('b').textContent = d.name;
    b.addEventListener('click', () => {
      for (const c of chipsEl.children) c.classList.remove('on');
      b.classList.add('on');
      closePanel();
      flyTo(d.x, (d.street.z0 + d.street.z1) / 2, 120);
    });
    chipsEl.appendChild(b);
  }

  /* search */
  qEl.addEventListener('input', () => {
    const q = qEl.value.trim().toLowerCase();
    hitsEl.innerHTML = '';
    if (q.length < 2) { hitsEl.style.display = 'none'; return; }
    const hits = merchants.filter((m) =>
      m.name.toLowerCase().includes(q) || m.handle.includes(q) || m.district.name.toLowerCase().includes(q)).slice(0, 8);
    if (!hits.length) { hitsEl.style.display = 'none'; return; }
    for (const m of hits) {
      const b = document.createElement('button');
      b.innerHTML = '<b></b><span class="d"></span>';
      b.querySelector('b').textContent = m.name;
      b.querySelector('.d').textContent = m.district.name;
      b.addEventListener('click', () => {
        hitsEl.style.display = 'none';
        qEl.value = m.name;
        openPanel(m);
      });
      hitsEl.appendChild(b);
    }
    hitsEl.style.display = 'block';
  });
  document.addEventListener('click', (e) => {
    if (!hitsEl.contains(e.target) && e.target !== qEl) hitsEl.style.display = 'none';
  });

  /* deep links */
  const params = new URLSearchParams(location.search);
  const focus = params.get('focus');
  if (focus) {
    const m = merchants.find((x) => x.handle === focus);
    if (m) setTimeout(() => openPanel(m), 400);
  } else if (params.get('district')) {
    const d = world.districts.find((x) => x.key === params.get('district'));
    if (d) setTimeout(() => flyTo(d.x, (d.street.z0 + d.street.z1) / 2, 120), 300);
  }

  /* touch hint */
  if (matchMedia('(pointer: coarse)').matches) {
    hint.textContent = 'Drag to look around · pinch to zoom · two-finger drag to pan · tap a building';
  }

  renderer.setAnimationLoop((now) => {
    if (anim) anim(now);
    if (pendingHover) { doHover(pendingHover); pendingHover = null; }
    controls.update();
    renderer.render(scene, camera);
  });
}
