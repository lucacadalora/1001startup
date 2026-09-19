/* Decorative landing demo: one anonymous market street in the toy-brick
 * style, slowly panning. No merchant names — pure illustration of the world. */
import * as THREE from '/vendor/three.module.js';
import { RoundedBoxGeometry } from '/vendor/RoundedBoxGeometry.js';

const ACCENTS = ['#C96F2E', '#3F7D4E', '#B08A2E', '#4E7A96', '#8A5A83', '#B65A6A'];
const LEAVES = [0x5f9e63, 0x74b378, 0x4b8a52];

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const rnd = (k) => (hash32(String(k)) % 10000) / 10000;

export function mountStreetDemo(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0e9da);
  scene.fog = new THREE.Fog(0xf0e9da, 160, 320);
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0xd8cdb8, 1.15));
  const sun = new THREE.DirectionalLight(0xffeccc, 1.5);
  sun.position.set(60, 80, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -120, right: 120, top: 80, bottom: -80, near: 5, far: 300 });
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 240), new THREE.MeshLambertMaterial({ color: 0xf1eadb }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const road = new THREE.Mesh(new THREE.PlaneGeometry(600, 12), new THREE.MeshLambertMaterial({ color: 0xded3bc }));
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.02;
  road.receiveShadow = true;
  scene.add(road);

  const N = 26;
  const brickGeo = new RoundedBoxGeometry(1, 1, 1, 2, 0.06);
  brickGeo.translate(0, 0.5, 0);
  const bodies = new THREE.InstancedMesh(brickGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  bodies.castShadow = true;
  const studGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.18, 12);
  const studs = new THREE.InstancedMesh(studGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1;
    const x = -110 + Math.floor(i / 2) * 18 + (rnd('jx' + i) - 0.5) * 3;
    const z = side * (10 + rnd('jz' + i) * 2);
    const w = 6.5 + rnd('w' + i) * 3, d = 6.5 + rnd('d' + i) * 2.5, h = 4 + rnd('h' + i) * 5;
    m4.makeScale(w, h, d);
    m4.setPosition(x, 0, z);
    bodies.setMatrixAt(i, m4);
    bodies.setColorAt(i, col.set(ACCENTS[hash32('c' + i) % ACCENTS.length]));
    m4.makeScale(w * 0.35, 1, d * 0.35);
    m4.setPosition(x, h + 0.02, z);
    studs.setMatrixAt(i, m4);
    studs.setColorAt(i, col.clone().offsetHSL(0, 0, 0.08));
  }
  bodies.instanceColor.needsUpdate = true;
  studs.instanceColor.needsUpdate = true;
  scene.add(bodies, studs);

  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.55, 3, 7);
  trunkGeo.translate(0, 1.5, 0);
  const crownGeo = new THREE.IcosahedronGeometry(2.2, 1);
  const NT = 14;
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x8a6a45 }), NT);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), NT);
  trunks.castShadow = true;
  crowns.castShadow = true;
  for (let i = 0; i < NT; i++) {
    const x = -120 + i * 19 + (rnd('tx' + i) - 0.5) * 6;
    const z = (i % 2 ? 1 : -1) * 7.2;
    const s = 0.8 + rnd('ts' + i) * 0.5;
    m4.makeScale(s, s, s);
    m4.setPosition(x, 0, z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(s, s * 0.9, s);
    m4.setPosition(x, 3 * s, z);
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, col.set(LEAVES[hash32('lc' + i) % LEAVES.length]));
  }
  crowns.instanceColor.needsUpdate = true;
  scene.add(trunks, crowns);

  const camera = new THREE.PerspectiveCamera(34, 2, 0.5, 500);
  function resize() {
    const w = canvas.clientWidth || 600, h = canvas.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = 0;
  renderer.setAnimationLoop(() => {
    if (!reduced) t += 0.0016;
    const x = -40 + Math.sin(t) * 55;
    camera.position.set(x, 42, 78);
    camera.lookAt(x + 12, 0, -4);
    renderer.render(scene, camera);
  });
  return true;
}
