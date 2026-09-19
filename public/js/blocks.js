/* PASAR — Startup Blocks.
   A pure plot grid, no geography: one block per company, each carrying its
   generated collectible building. Tenants come from /data/jakarta-tenants.json
   (single source of truth with the Jakarta map). Canvas 2D. */
(() => {
  const canvas = document.getElementById('bl-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tip = document.getElementById('jkt-tip');
  const panel = document.getElementById('map-panel');
  const legend = document.getElementById('bl-legend');

  const N = 27;                 // grid is N×N, centered
  const HW = 44, HH = 22;       // iso half-tile, world px
  const C = (N - 1) / 2;
  const GOLD = '#F3C64B';
  /* districts — Jakarta's own borough map (Pusat is the Manhattan of this
     field). Boundaries are noise-wobbled so nothing sits in neat rings. */
  const DIST = [
    { n: 'Pusat',            c: '#EFE0BC' },
    { n: 'Blok M',           c: '#EFE0D2' },
    { n: 'Timur–Depok',      c: '#EDE8CC' },
    { n: 'Utara–Tangerang',  c: '#E5E9DB' },
    { n: 'Bogor–Bekasi',     c: '#EAE5D8' },
    { n: 'Luar Kota',        c: '#EDEBE3' },
  ];
  const distOf = (gx, gy) => {
    const dx = gx - C, dy = gy - C;
    const r = Math.hypot(dx, dy);
    const th = Math.atan2(dy, dx);
    const rPusat = 3.6 * (1 + 0.22 * Math.sin(3 * th + 1.7) + 0.14 * Math.sin(7 * th + 0.4));
    if (r <= rPusat) return 0;
    const rInner = 8.4 * (1 + 0.16 * Math.sin(2 * th + 0.9) + 0.11 * Math.sin(5 * th + 2.6));
    if (r <= rInner) {
      /* screen-space bearing: up = Utara, right = Timur, down = Blok M side */
      let phi = Math.atan2(dx + dy, dx - dy) * 180 / Math.PI;
      phi += 16 * Math.sin(r * 1.3);                    // jagged sector borders
      if (phi > 40 && phi <= 140) return 1;             // south — Blok M
      if (phi > -50 && phi <= 40) return 2;             // east — Timur–Depok
      return 3;                                          // north + west — Utara–Tangerang
    }
    const rBB = 11.8 * (1 + 0.13 * Math.sin(3 * th + 4.1) + 0.09 * Math.sin(6 * th + 1.2));
    if (r <= rBB) return 4;                              // Bogor–Bekasi
    return 5;                                            // Luar Kota
  };

  let tenants = [], plots = [], sprites = {};
  let z = 1, ox = 0, oy = 0, fitZ = 1, dpr = 1;
  let hover = null, anim = null;

  const isoU = (gx, gy) => (gx - gy) * HW;
  const isoV = (gx, gy) => (gx + gy) * HH;
  const toWorld = (px, py) => [(px - ox) / z, (py - oy) / z];

  /* spiral order from the center block outward */
  function spiral() {
    const cells = [];
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
      const r = Math.max(Math.abs(gx - C), Math.abs(gy - C));
      cells.push({ gx, gy, r, a: Math.atan2(gy - C, gx - C) });
    }
    /* within a ring: lateral cells first (side by side, no overlap), then front
       diagonals, straight front/back columns (full occlusion) last */
    cells.sort((p, q) => p.r - q.r
      || Math.abs(q.gx - q.gy) - Math.abs(p.gx - p.gy)
      || (q.gx + q.gy) - (p.gx + p.gy)
      || p.a - q.a);
    return cells;
  }

  function build() {
    const order = spiral();
    const withSprite = tenants.filter((t) => t.sprite);
    plots = order.map((c, i) => ({
      ...c,
      u: isoU(c.gx, c.gy), v: isoV(c.gx, c.gy),
      d: distOf(c.gx, c.gy),
      t: withSprite[i] || null,
    }));
  }

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const uMax = (N - 1) * HW + HW, vMax = 2 * (N - 1) * HH + HH;
    fitZ = Math.min(w / (2 * uMax), h / vMax) * 0.92;
    z = fitZ;
    ox = w / 2; oy = h / 2 - ((N - 1) * HH) * z;
  }
  const clampZ = (v) => Math.max(fitZ * 0.85, Math.min(7, v));
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    draw();
  }

  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#F6EFDF';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, ox * dpr, oy * dpr);
    for (const p of plots) {
      ctx.fillStyle = DIST[p.d].c;
      ctx.beginPath();
      ctx.moveTo(p.u, p.v - HH); ctx.lineTo(p.u + HW, p.v); ctx.lineTo(p.u, p.v + HH); ctx.lineTo(p.u - HW, p.v);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(32,26,20,.07)'; ctx.lineWidth = 1 / z; ctx.stroke();
    }
    if (hover) {
      ctx.fillStyle = 'rgba(243,198,75,.20)'; ctx.strokeStyle = 'rgba(32,26,20,.55)'; ctx.lineWidth = 1.6 / z;
      ctx.beginPath();
      ctx.moveTo(hover.u, hover.v - HH); ctx.lineTo(hover.u + HW, hover.v); ctx.lineTo(hover.u, hover.v + HH); ctx.lineTo(hover.u - HW, hover.v);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const now = performance.now();
    const occupied = plots.filter((p) => p.t).sort((a, b) => a.v - b.v);
    for (const p of occupied) {
      const sx = p.u * z + ox, sy = p.v * z + oy;
      const img = sprites[p.t.id];
      const wdt = 2 * HW * 0.94 * z;
      const hgt = img ? wdt * (img.height / img.width) : wdt;
      const pulse = 1 + 0.05 * Math.sin(now / 650 + p.gx);
      const rx = HW * 0.92 * z * pulse;
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, rx);
      g.addColorStop(0, 'rgba(243,198,75,.32)'); g.addColorStop(1, 'rgba(243,198,75,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx / 2, 0, 0, Math.PI * 2); ctx.stroke();
      if (img && img.complete) {
        const y0 = sy + HH * z * 0.82 - hgt;
        const grow = hover && hover.t === p.t ? 1.05 : 1;
        ctx.drawImage(img, sx - (wdt * grow) / 2, y0 - hgt * (grow - 1), wdt * grow, hgt * grow);
        p.box = [sx - wdt / 2, y0, wdt, hgt];
      }
      if (z >= 1.5 || (hover && hover.t === p.t)) {
        ctx.font = "500 10.5px 'IBM Plex Mono', ui-monospace, monospace";
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0.09em';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'rgba(246,239,223,.88)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
        const ly = sy + HH * z * 0.82 + 12;
        ctx.strokeText(p.t.name.toUpperCase(), sx, ly);
        ctx.fillStyle = 'rgba(32,26,20,.62)';
        ctx.fillText(p.t.name.toUpperCase(), sx, ly);
      }
    }
  }

  function plotAt(px, py) {
    for (const p of plots) {
      if (p.t && p.box && px >= p.box[0] && px <= p.box[0] + p.box[2] && py >= p.box[1] && py <= p.box[1] + p.box[3]) return p;
    }
    const [u, v] = toWorld(px, py);
    const gx = Math.round((u / HW + v / HH) / 2), gy = Math.round((v / HH - u / HW) / 2);
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return null;
    return plots.find((p) => p.gx === gx && p.gy === gy) || null;
  }

  let dragging = false, moved = 0, lx = 0, ly = 0, pinch = null;
  const pointers = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pointers.size === 2) {
      const ps = [...pointers.values()];
      pinch = { d: Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]), z };
    } else { dragging = true; moved = 0; lx = e.offsetX; ly = e.offsetY; }
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && pointers.size === 2) {
      const ps = [...pointers.values()];
      const d = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
      zoomTo(clampZ(pinch.z * (d / pinch.d)), (ps[0][0] + ps[1][0]) / 2, (ps[0][1] + ps[1][1]) / 2);
      return;
    }
    if (dragging) {
      const dx = e.offsetX - lx, dy = e.offsetY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      ox += dx; oy += dy; lx = e.offsetX; ly = e.offsetY;
      draw();
      return;
    }
    const p = plotAt(e.offsetX, e.offsetY);
    hover = p;
    canvas.style.cursor = p ? 'pointer' : 'grab';
    if (p && p.t) {
      tip.style.display = 'block';
      tip.style.left = ((p.box ? p.box[0] + p.box[2] / 2 : p.u * z + ox)) + 'px';
      tip.style.top = ((p.box ? p.box[1] : p.v * z + oy - 20)) + 'px';
      tip.innerHTML = `${esc(p.t.name)}<span class="d">${esc(p.t.tag)}</span>`;
    } else tip.style.display = 'none';
    draw();
  });
  canvas.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId); pinch = null;
    if (dragging && moved < 6) click(e.offsetX, e.offsetY);
    dragging = false;
  });
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch = null; dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomTo(clampZ(z * Math.pow(1.0016, -e.deltaY)), e.offsetX, e.offsetY);
  }, { passive: false });
  function zoomTo(nz, cx, cy) {
    const [u, v] = toWorld(cx, cy);
    z = nz; ox = cx - u * z; oy = cy - v * z;
    draw();
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function click(px, py) {
    const p = plotAt(px, py);
    if (!p) { panel.style.display = 'none'; return; }
    if (p.t) {
      const t = p.t;
      panel.innerHTML = `
        <button class="x" aria-label="Close">×</button>
        ${t.portrait ? `<img class="bld" src="${esc(t.portrait)}" alt="${esc(t.name)} building">` : ''}
        <h3>${esc(t.name)}</h3>
        <div class="cat">${esc(t.area)}</div>
        <p>${esc(t.tag)}.</p>
        <div class="row">
          <a class="btn primary" href="${esc(t.url)}" target="_blank" rel="noopener">Visit website ↗</a>
          <a class="btn" href="/jakarta?focus=${esc(t.id)}">On the map</a>
        </div>`;
    } else {
      panel.innerHTML = `
        <button class="x" aria-label="Close">×</button>
        <h3>Open block</h3>
        <div class="cat">${DIST[p.d].n}</div>
        <p>No building here yet. Claim a PASAR profile and your company gets its own collectible block.</p>
        <div class="row"><a class="btn primary" href="/claim">Claim a block</a></div>`;
    }
    panel.style.display = 'block';
    panel.querySelector('.x').onclick = () => { panel.style.display = 'none'; };
  }

  function buildLegend() {
    const built = tenants.filter((t) => t.sprite).length;
    legend.innerHTML = `
      <h4>The blocks<span>${built} built</span></h4>
      ${DIST.map((D, i) => `<div class="kr"><i style="background:${D.c}"></i>${D.n}<b>${plots.filter((p) => p.t && p.d === i).length || '—'}</b></div>`).join('')}
      <div class="div"></div>
      <div class="act">One block per company — every building generated from the brand itself.</div>
      <a class="btn primary" href="/claim">Claim a block</a>
      <div class="src">Companies live on the <a href="/jakarta" style="color:inherit">Jakarta map</a> too</div>`;
  }

  fetch('/data/jakarta-tenants.json').then((r) => r.json()).then((t) => {
    tenants = t.tenants;
    build(); buildLegend(); fit(); resize();
    let pending = tenants.filter((tn) => tn.sprite).length;
    for (const tn of tenants) {
      if (!tn.sprite) continue;
      const img = new Image();
      img.onload = img.onerror = () => { if (!--pending) draw(); };
      img.src = tn.sprite;
      sprites[tn.id] = img;
    }
    setInterval(() => { if (!dragging && !pinch) draw(); }, 120);
  });
  window.addEventListener('resize', resize);
  document.getElementById('bz-in').onclick = () => zoomTo(clampZ(z * 1.45), canvas.clientWidth / 2, canvas.clientHeight / 2);
  document.getElementById('bz-out').onclick = () => zoomTo(clampZ(z / 1.45), canvas.clientWidth / 2, canvas.clientHeight / 2);
})();
