/* PASAR Startup Map — SCBD in 2D: every named building becomes a hex tile
 * placed by its real coordinates (nearest free cell, so geography survives),
 * real roads and greens drawn beneath. Tiles with startups wear the accent
 * ring; clicking a tile opens its card with the startups inside. */
const $ = (id) => document.getElementById(id);
const host = $('map-host');
const panel = $('map-panel');

const FACADES = [
  ['treasury', '#2e3f4e'], ['sequis', '#bccfd8'], ['energy', '#4e748c'],
  ['prosperity', '#8fa6b5'], ['equity', '#7c93a6'], ['pacific century', '#9fb2c0'],
  ['idx', '#c9b99a'], ['bursa efek', '#c9b99a'], ['pacific place', '#d9cdb4'],
  ['ritz', '#cbbfa4'], ['langham', '#564d43'], ['district 8', '#564d43'],
  ['eternity', '#564d43'], ['infinity', '#564d43'], ['residence 8', '#5f564b'],
  ['office 8', '#4e463d'], ['ashta', '#6e6255'], ['alila', '#b9b2a6'],
  ['artha graha', '#a89b85'], ['revenue', '#7c93a6'],
];
const ACCENT = '#C96F2E';

const R = 40;                       // hex circumradius in map meters
const W = Math.sqrt(3) * R;         // horizontal spacing (pointy-top)
const H = 1.5 * R;                  // vertical spacing

function lighten(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => Math.round(v + (255 - v) * t);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function facadeFor(name, h) {
  const n = (name || '').toLowerCase();
  for (const [k, c] of FACADES) if (n.includes(k)) return c;
  const t = Math.min(1, ((h || 20) - 20) / 240);
  const l = Math.round(78 - t * 26);
  return `hsl(203 22% ${l}%)`;
}

/* axial hex helpers (pointy-top) */
const hexCenter = (q, r) => [W * (q + r / 2), H * r];
function nearestHex(x, z) {
  const r = z / H;
  const q = x / W - r / 2;
  return hexRound(q, r);
}
function hexRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}
const NEIGH = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i + Math.PI / 6;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

(async () => {
  const [map, occRaw] = await Promise.all([
    (await fetch('/data/scbd.json?v=2')).json(),
    (await fetch('/data/scbd-startups.json')).json(),
  ]);
  const occFor = (name) => {
    const n = (name || '').toLowerCase();
    for (const k of Object.keys(occRaw)) if (n.includes(k)) return occRaw[k];
    return null;
  };

  /* named buildings → hex cells, tallest claim their cell first */
  const named = map.buildings
    .filter((b) => b.n)
    .map((b) => {
      const xs = b.p.map((p) => p[0]), zs = b.p.map((p) => p[1]);
      return { n: b.n, h: b.h || 14, x: xs.reduce((a, v) => a + v) / xs.length, z: zs.reduce((a, v) => a + v) / zs.length };
    })
    .sort((a, b) => b.h - a.h);
  const used = new Set();
  const tiles = [];
  for (const b of named) {
    let [q, r] = nearestHex(b.x, b.z);
    if (used.has(`${q},${r}`)) {
      // spiral out to the closest free neighbour cell
      let found = false;
      for (let ring = 1; ring <= 4 && !found; ring++) {
        let cq = q + NEIGH[4][0] * ring, cr = r + NEIGH[4][1] * ring;
        for (let side = 0; side < 6 && !found; side++) {
          for (let step = 0; step < ring && !found; step++) {
            if (!used.has(`${cq},${cr}`)) { q = cq; r = cr; found = true; }
            cq += NEIGH[side][0]; cr += NEIGH[side][1];
          }
        }
      }
      if (!found) continue;
    }
    used.add(`${q},${r}`);
    const [cx, cy] = hexCenter(q, r);
    tiles.push({ ...b, q, r, cx, cy, occ: occFor(b.n) });
  }

  /* view box that hugs the tiles */
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const t of tiles) {
    minX = Math.min(minX, t.cx); maxX = Math.max(maxX, t.cx);
    minY = Math.min(minY, t.cy); maxY = Math.max(maxY, t.cy);
  }
  const PAD = 120;
  const vb = { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
  const vb0 = { ...vb };

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('id', 'map-svg');
  const setVB = () => svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  setVB();

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let deco = '';

  /* underlay: greens then roads (real geometry, quantized) */
  for (const ring of (map.green || [])) {
    deco += `<polygon points="${ring.map((p) => `${p[0]},${p[1]}`).join(' ')}" fill="#CDE3BC" opacity="0.55"/>`;
  }
  const ROADW = { motorway: 22, trunk: 22, primary: 18, secondary: 13, tertiary: 9 };
  for (const r of map.roads) {
    const w = ROADW[r.c];
    if (!w) continue;
    deco += `<polyline points="${r.p.map((p) => `${p[0]},${p[1]}`).join(' ')}" fill="none" stroke="#E2D8C2" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  /* tiles */
  let tilesSvg = '';
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const fill = lighten(facadeFor(t.n, t.h).startsWith('#') ? facadeFor(t.n, t.h) : '#9ab0bc',
      facadeFor(t.n, t.h).startsWith('#') ? 0.42 : 0);
    const base = facadeFor(t.n, t.h);
    const fillC = base.startsWith('#') ? lighten(base, 0.45) : base;
    const short = t.n.length > 26 ? t.n.slice(0, 24) + '…' : t.n;
    const words = short.toUpperCase().split(/[\s]+/);
    const lines = [];
    let cur = '';
    for (const w2 of words) {
      if ((cur + ' ' + w2).trim().length <= 12) cur = (cur + ' ' + w2).trim();
      else { if (cur) lines.push(cur); cur = w2; }
    }
    if (cur) lines.push(cur);
    const shown = lines.slice(0, 3);
    const occ = t.occ;
    tilesSvg += `<g class="tile${occ ? ' has-occ' : ''}" data-i="${i}">
      <polygon points="${hexPoints(t.cx, t.cy, R - 2)}" fill="${fillC}" stroke="${occ ? ACCENT : '#B9AE99'}" stroke-width="${occ ? 3.5 : 1.2}"/>
      ${shown.map((L, li) => `<text x="${t.cx}" y="${t.cy - 8 + li * 11 - (shown.length - 1) * 4}" class="t-name">${esc(L)}</text>`).join('')}
      <text x="${t.cx}" y="${t.cy + (shown.length) * 6 + 10}" class="t-h">${t.h} M</text>
      ${occ ? `<g><circle cx="${t.cx + R * 0.52}" cy="${t.cy - R * 0.52}" r="11" fill="${ACCENT}"/><text x="${t.cx + R * 0.52}" y="${t.cy - R * 0.52 + 3.5}" class="t-badge">${occ.length}</text></g>` : ''}
    </g>`;
  }
  svg.innerHTML = `<g id="deco">${deco}</g><g id="tiles">${tilesSvg}</g>`;
  host.appendChild(svg);

  /* pan + zoom */
  let dragging = null;
  svg.addEventListener('pointerdown', (e) => {
    dragging = { x: e.clientX, y: e.clientY, vx: vb.x, vy: vb.y };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const r = svg.getBoundingClientRect();
    vb.x = dragging.vx - (e.clientX - dragging.x) * (vb.w / r.width);
    vb.y = dragging.vy - (e.clientY - dragging.y) * (vb.h / r.height);
    setVB();
  });
  svg.addEventListener('pointerup', () => { dragging = null; });
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    const nw = Math.min(vb0.w * 1.6, Math.max(vb0.w * 0.18, vb.w * f));
    const r = svg.getBoundingClientRect();
    const mx = vb.x + (e.clientX - r.left) / r.width * vb.w;
    const my = vb.y + (e.clientY - r.top) / r.height * vb.h;
    vb.x = mx - (mx - vb.x) * (nw / vb.w);
    vb.y = my - (my - vb.y) * (nw / vb.w);
    vb.h *= nw / vb.w;
    vb.w = nw;
    setVB();
  }, { passive: false });

  /* tile click → card */
  svg.addEventListener('click', (e) => {
    const g = e.target.closest('.tile');
    if (!g) { panel.style.display = 'none'; return; }
    const t = tiles[+g.dataset.i];
    const occ = t.occ || [];
    panel.innerHTML = `
      <button class="x" aria-label="Close">✕</button>
      <div class="cat">SCBD · JAKARTA · ${t.h} M</div>
      <h3>${esc(t.n)}</h3>
      ${occ.length ? occ.map((o) => `
        <div class="occ">
          <b>${esc(o.name)}</b>
          <span>${esc(o.floor)}</span>
          <span class="tag">${esc(o.tag)}</span>
          ${o.url ? `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.url.replace('https://', ''))} ↗</a>` : ''}
        </div>`).join('')
      : '<p>No startups pinned here yet.</p>'}
      <div class="row"><a class="btn primary sm" href="/claim">Pin your startup</a></div>`;
    panel.querySelector('.x').addEventListener('click', () => { panel.style.display = 'none'; });
    panel.style.display = 'block';
  });

  /* open our own HQ on load so the map never starts empty-handed */
  const ours = tiles.findIndex((t) => t.occ);
  if (ours >= 0) {
    const t = tiles[ours];
    vb.w = vb0.w * 0.42; vb.h = vb0.h * 0.42;
    vb.x = t.cx - vb.w / 2; vb.y = t.cy - vb.h / 2;
    setVB();
  }
})();
