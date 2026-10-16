/* CNC + 3D Indonesia — the map: every focus place (a province, or a regency
 * cluster on Java) and every placed firm, across the whole of Indonesia.
 *
 * Same cartographic language as 1001umkm.id's export map (public/js/
 * umkmmap.js): the Natural Earth base from /data/indonesia.json, the same
 * isometric projection (u = gx−gy, v = (gx+gy)/2, 2:1) and the same paper.
 * Two layers on top:
 *   - focus places: a diamond in the colour of the place's product family,
 *     labelled with the place and its focus product; click opens its card.
 *   - firms: grey dots at their recorded city, clustered in screen space far
 *     out; past FAN zoom a city spreads its firms into a small grid.
 * Slice 1 draws plain markers; the 3D commodity icons come in slice 2.
 *
 * Every string from the data goes into the DOM through textContent, never
 * innerHTML: the rows come from research sweeps, not from us.
 * Lives in a file because the CSP is script-src 'self'.
 */
(function () {
  'use strict';
  var cv = document.getElementById('cmap');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var tip = document.getElementById('ctip');
  var legend = document.getElementById('clegend');
  var countEl = document.getElementById('ccount');
  var chipsEl = document.getElementById('cchips');
  var togBtn = document.getElementById('cltog');
  var card = document.getElementById('ccard');

  var SEA = '#E4E7E6', NEAR = '#EDEBE4', LAND = '#F6EFDF',
    COAST = 'rgba(32,26,20,.28)', NEARC = 'rgba(32,26,20,.12)', FIRM = '#3F3F46';
  var FAN = 3.2;                   // zoom where a city spreads its firms out
  var geo = null, feed = null;
  var KX = 90, KY = 90, W0 = 95, N0 = 6;
  var landP = [], nearP = [];
  var places = [], cities = [], famColor = {}, famLabel = {}, byPlace = {};
  var cx = 0, cy = 0, z = 0.3, minZ = 0.05, maxZ = 60;
  var W = 0, H = 0, dpr = 1;
  var hits = [], hover = null, raf = 0, fly = null;
  var activeFam = '', showFirms = true, openPlace = null;

  function proj(lon, lat) {
    var gx = (lon - W0) * KX, gy = (N0 - lat) * KY;
    return [gx - gy, (gx + gy) / 2];
  }
  var sx = function (u) { return (u - cx) * z + W / 2; };
  var sy = function (v) { return (v - cy) * z + H / 2; };

  function ringPath(rings) {
    var p = new Path2D();
    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r];
      for (var i = 0; i < ring.length; i++) {
        var uv = proj(ring[i][0], ring[i][1]);
        if (i === 0) p.moveTo(uv[0], uv[1]); else p.lineTo(uv[0], uv[1]);
      }
      p.closePath();
    }
    return p;
  }

  /* ── boot ── */
  Promise.all([
    fetch('/data/indonesia.json').then(function (r) { return r.json(); }),
    fetch('/data/cnc-map.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]).then(function (rs) {
    geo = rs[0]; feed = rs[1];
    W0 = geo.bbox.w; N0 = geo.bbox.n;
    var mid = (geo.bbox.n + geo.bbox.s) / 2;
    KX = 90; KY = 90 * (111320 * Math.cos(mid * Math.PI / 180)) / 110540;
    landP = [ringPath(geo.land)];
    nearP = [ringPath(geo.near || [])];
    (feed.families || []).forEach(function (f) { famColor[f.key] = f.color; famLabel[f.key] = f.label; });
    build();
    buildLegend();
    size();
    fit();
    var q = new URLSearchParams(location.search);
    var want = q.get('place');
    if (q.get('f') && famColor[q.get('f')]) setFam(q.get('f'));
    if (want && byPlace[want]) {
      var p = byPlace[want];
      flyTo(p.u, p.v, Math.max(z * 4, 2.2), function () { openPlaceCard(p); });
    }
    draw();
  }).catch(function () {
    if (countEl) countEl.textContent = 'The map data failed to load — refresh to retry.';
  });

  function build() {
    places = (feed.places || []).filter(function (p) { return p.lat != null && p.lon != null; }).map(function (p) {
      var uv = proj(p.lon, p.lat);
      var o = { u: uv[0], v: uv[1], p: p };
      byPlace[p.id] = o;
      return o;
    });
    /* provinces first, then clusters: when two labels collide far out, the
       province name wins and the cluster label waits for a closer zoom */
    places.sort(function (a, b) { return (a.p.level === 'province' ? 0 : 1) - (b.p.level === 'province' ? 0 : 1); });
    var m = {};
    (feed.firms || []).forEach(function (f) {
      if (f.lat == null || f.lon == null) return;
      var k = f.lat + ',' + f.lon;
      if (!m[k]) {
        var uv = proj(f.lon, f.lat);
        m[k] = { u: uv[0], v: uv[1], city: f.city || f.province || '', prov: f.province || '', list: [] };
      }
      m[k].list.push(f);
    });
    cities = Object.keys(m).map(function (k) { return m[k]; });
    cities.forEach(function (c) {
      c.list.sort(function (a, b) { return (b.tier_rank - a.tier_rank) || (a.name < b.name ? -1 : 1); });
    });
  }

  /* ── view ── */
  function size() {
    dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function fit() {
    var a = proj(geo.bbox.w, geo.bbox.n), b = proj(geo.bbox.e, geo.bbox.s),
      c = proj(geo.bbox.e, geo.bbox.n), d = proj(geo.bbox.w, geo.bbox.s);
    var u0 = Math.min(a[0], b[0], c[0], d[0]), u1 = Math.max(a[0], b[0], c[0], d[0]);
    var v0 = Math.min(a[1], b[1], c[1], d[1]), v1 = Math.max(a[1], b[1], c[1], d[1]);
    /* on desktop the legend card covers the left 290px: frame the country in
       the space to its right, so Sumatra's west coast is not under the card */
    var padL = W > 700 ? 290 : 0;
    z = Math.min((W - padL) / (u1 - u0), H / (v1 - v0)) * 0.92;
    cx = (u0 + u1) / 2 - (padL / 2) / z; cy = (v0 + v1) / 2;
    minZ = z * 0.6;
  }
  function invalidate() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; draw(); });
  }
  function flyTo(u, v, zt, then) {
    fly = { t: 0, u0: cx, v0: cy, z0: z, u1: u, v1: v, z1: Math.min(maxZ, zt), then: then };
    step();
    function step() {
      fly.t += 1 / 28;
      var e = fly.t >= 1 ? 1 : 1 - Math.pow(1 - fly.t, 3);
      cx = fly.u0 + (fly.u1 - fly.u0) * e;
      cy = fly.v0 + (fly.v1 - fly.v0) * e;
      z = fly.z0 + (fly.z1 - fly.z0) * e;
      draw();
      if (fly.t < 1) requestAnimationFrame(step);
      else { var f = fly.then; fly = null; if (f) f(); }
    }
  }

  /* ── legend: family filter + the firms layer toggle ── */
  function buildLegend() {
    if (!chipsEl) return;
    var mk = function (key, text, color) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'uchip';
      b.dataset.f = key;
      var sq = document.createElement('span');
      sq.className = 'sq';
      sq.style.background = color;
      b.appendChild(sq);
      b.appendChild(document.createTextNode(text));
      b.addEventListener('click', function () { setFam(activeFam === key ? '' : key); });
      return b;
    };
    chipsEl.appendChild(mk('', 'All focus products · ' + places.length, '#000'));
    (feed.families || []).forEach(function (f) {
      var n = places.filter(function (o) { return o.p.focus && o.p.focus.family === f.key; }).length;
      if (n) chipsEl.appendChild(mk(f.key, f.label + ' · ' + n, f.color));
    });
    var fb = document.createElement('button');
    fb.type = 'button';
    fb.className = 'uchip firms';
    fb.setAttribute('aria-pressed', 'true');
    var sq = document.createElement('span');
    sq.className = 'sq';
    fb.appendChild(sq);
    var nf = (feed.firms || []).filter(function (f) { return f.lat != null; }).length;
    fb.appendChild(document.createTextNode('Firms · ' + nf));
    fb.style.marginTop = '8px';
    fb.addEventListener('click', function () {
      showFirms = !showFirms;
      fb.setAttribute('aria-pressed', showFirms ? 'true' : 'false');
      syncCount(); invalidate();
    });
    chipsEl.appendChild(fb);
    syncChips();
  }
  function setFam(k) { activeFam = k; syncChips(); invalidate(); }
  function syncChips() {
    if (!chipsEl) return;
    [].forEach.call(chipsEl.children, function (b) {
      if (b.classList.contains('firms')) return;
      b.classList.toggle('on', (b.dataset.f || '') === activeFam);
    });
    syncCount();
  }
  function syncCount() {
    if (!countEl) return;
    var np = places.filter(placeOn).length;
    var nf = (feed.firms || []).filter(function (f) { return f.lat != null; }).length;
    countEl.textContent = np + ' places' + (showFirms ? ' · ' + nf + ' firms' : '') +
      (feed.firms_unmapped ? ' · ' + feed.firms_unmapped + ' firms unplaced' : '');
  }
  function placeOn(o) { return !activeFam || (o.p.focus && o.p.focus.family === activeFam); }

  /* ── drawing ── */
  function fanGeom(k) {
    var cols = Math.max(1, Math.round(Math.sqrt(k * 1.6)));
    return { cols: cols, rows: Math.ceil(k / cols) };
  }
  function draw() {
    if (!geo) return;
    hits = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (W / 2 - cx * z) * dpr, (H / 2 - cy * z) * dpr);
    ctx.fillStyle = NEAR;
    nearP.forEach(function (p) { ctx.fill(p); });
    ctx.strokeStyle = NEARC; ctx.lineWidth = 0.8 / z;
    nearP.forEach(function (p) { ctx.stroke(p); });
    ctx.fillStyle = LAND;
    landP.forEach(function (p) { ctx.fill(p); });
    ctx.strokeStyle = COAST; ctx.lineWidth = 1 / z;
    landP.forEach(function (p) { ctx.stroke(p); });

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var boxes = [];
    var labelOk = function (bx, by, wpx, hpx) {
      for (var i = 0; i < boxes.length; i++) {
        var L = boxes[i];
        if (bx < L.x + L.w + 5 && bx + wpx > L.x - 5 && by < L.y + L.h && by + hpx > L.y) return false;
      }
      boxes.push({ x: bx, y: by, w: wpx, h: hpx });
      return true;
    };
    /* a two-line place label: the place on top, its product under it */
    var placeLabel = function (top, sub, x, y, col, force) {
      ctx.font = '400 10px "IBM Plex Mono", monospace';
      var w1 = ctx.measureText(top).width;
      ctx.font = '500 11.5px "Overused Grotesk", system-ui, sans-serif';
      var w2 = sub ? ctx.measureText(sub).width : 0;
      var wpx = Math.max(w1, w2), hpx = sub ? 27 : 13, bx = x - wpx / 2;
      if (!labelOk(bx, y, wpx, hpx) && !force) return;
      ctx.fillStyle = 'rgba(246,239,223,.86)';
      ctx.fillRect(bx - 4, y - 1, wpx + 8, hpx + 2);
      ctx.font = '400 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#52525B';
      ctx.fillText(top, x - w1 / 2, y + 9);
      if (sub) {
        ctx.font = '500 11.5px "Overused Grotesk", system-ui, sans-serif';
        ctx.fillStyle = col;
        ctx.fillText(sub, x - w2 / 2, y + 23);
      }
    };
    var smallLabel = function (t, x, y) {
      ctx.font = '400 10px "IBM Plex Mono", monospace';
      var wpx = ctx.measureText(t).width, bx = x - wpx / 2;
      if (!labelOk(bx, y, wpx, 13)) return;
      ctx.fillStyle = 'rgba(246,239,223,.78)';
      ctx.fillRect(bx - 3, y - 1, wpx + 6, 13);
      ctx.fillStyle = '#3F3F46';
      ctx.fillText(t, bx, y + 9);
    };
    var diamond = function (x, y, r, col, ring) {
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = ring ? '#000' : '#fff'; ctx.lineWidth = ring ? 2 : 1.6; ctx.stroke();
    };

    /* 1 — firms (under the places). Far out: screen-space clusters. Close in:
       each city spreads its firms into a small grid of dots. */
    if (showFirms) {
      var vis = [];
      cities.forEach(function (c) {
        var x = sx(c.u), y = sy(c.v);
        if (x < -200 || x > W + 200 || y < -200 || y > H + 200) return;
        vis.push({ c: c, x: x, y: y });
      });
      if (z >= FAN) {
        vis.forEach(function (v) {
          var k = v.c.list.length, g = fanGeom(k), s = Math.min(26, 5 * z);
          v.c.list.forEach(function (f, i) {
            var row = Math.floor(i / g.cols), col = i % g.cols;
            var inRow = Math.min(g.cols, k - row * g.cols);
            var px = v.x + (col - (inRow - 1) / 2) * s, py = v.y + (row - (g.rows - 1) / 2) * s * 0.8;
            var hov = hover && hover.f === f;
            ctx.beginPath(); ctx.arc(px, py, hov ? 6 : 4.5, 0, Math.PI * 2);
            ctx.fillStyle = FIRM; ctx.fill();
            ctx.strokeStyle = hov ? '#000' : '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
            hits.push({ x: px - 8, y: py - 8, w: 16, h: 16, f: f, city: v.c });
            if (z >= 7 || hov) smallLabel(f.name.length > 26 ? f.name.slice(0, 25) + '…' : f.name, px, py + 7);
          });
        });
      } else {
        var cells = {};
        vis.forEach(function (v) {
          var key = Math.floor(v.x / 40) + '_' + Math.floor(v.y / 40);
          (cells[key] = cells[key] || []).push(v);
        });
        Object.keys(cells).forEach(function (key) {
          var m = cells[key], n = 0, xw = 0, yw = 0, uw = 0, vw = 0, top = m[0];
          m.forEach(function (v) {
            var k = v.c.list.length;
            n += k; xw += v.x * k; yw += v.y * k; uw += v.c.u * k; vw += v.c.v * k;
            if (k > top.c.list.length) top = v;
          });
          var x = xw / n, y = yw / n, r = Math.min(13, 3 + Math.sqrt(n) * 1.5);
          var hov = hover && hover.fc && hover.fc.key === key;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(63,63,70,.82)'; ctx.fill();
          ctx.strokeStyle = hov ? '#000' : '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
          if (r >= 8) {
            ctx.font = '400 9px "IBM Plex Mono", monospace';
            var t = String(n), tw = ctx.measureText(t).width;
            ctx.fillStyle = '#fff'; ctx.fillText(t, x - tw / 2, y + 3);
          }
          hits.push({ x: x - Math.max(r, 9), y: y - Math.max(r, 9), w: Math.max(r, 9) * 2, h: Math.max(r, 9) * 2,
            fc: { key: key, n: n, cities: m.length, top: top.c, u: uw / n, v: vw / n } });
        });
      }
    }

    /* 2 — focus places, on top: provinces first so their labels win far out */
    places.forEach(function (o) {
      if (!placeOn(o)) return;
      var x = sx(o.u), y = sy(o.v);
      if (x < -120 || x > W + 120 || y < -120 || y > H + 120) return;
      var f = o.p.focus || {}, col = famColor[f.family] || '#8E8E93';
      var ring = openPlace === o || (hover && hover.o === o);
      var r = o.p.level === 'province' ? 8 : 6.5;
      diamond(x, y, r, col, ring);
      hits.push({ x: x - 11, y: y - 11, w: 22, h: 22, o: o });
    });
    places.forEach(function (o) {
      if (!placeOn(o)) return;
      var x = sx(o.u), y = sy(o.v);
      if (x < -120 || x > W + 120 || y < -120 || y > H + 120) return;
      var f = o.p.focus || {}, col = famColor[f.family] || '#52525B';
      var ring = openPlace === o || (hover && hover.o === o);
      var r = o.p.level === 'province' ? 8 : 6.5;
      placeLabel(o.p.area.toUpperCase(), f.short || '', x, y + r + 4, col, ring);
    });
  }

  /* ── interaction ── */
  var drag = null, moved = false, pinch = null;
  cv.addEventListener('pointerdown', function (e) {
    cv.setPointerCapture(e.pointerId);
    if (pinch === null && e.isPrimary === false) return;
    drag = { x: e.clientX, y: e.clientY, cx: cx, cy: cy, id: e.pointerId };
    moved = false;
  });
  cv.addEventListener('pointermove', function (e) {
    var r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    if (drag && e.pointerId === drag.id) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      cx = drag.cx - dx / z; cy = drag.cy - dy / z;
      hideTip();
      invalidate();
      return;
    }
    var h = hitAt(mx, my);
    if (!same(h, hover)) { hover = h; invalidate(); }
    if (h) showTip(mx, my, h); else hideTip();
    cv.style.cursor = h ? 'pointer' : 'grab';
  });
  cv.addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.id) { drag = null; return; }
    drag = null;
    if (moved) return;
    var r = cv.getBoundingClientRect();
    var h = hitAt(e.clientX - r.left, e.clientY - r.top);
    if (!h) { closeCard(); return; }
    if (h.o) {
      openPlaceCard(h.o);
      if (z < 1.6) flyTo(h.o.u, h.o.v, Math.max(z * 3, 1.8));
    } else if (h.f) openFirmCard(h.f);
    else if (h.fc) {
      var zt = h.fc.cities > 1 ? Math.min(maxZ, z * 2.6) : Math.max(z * 2.4, FAN + 1.2);
      flyTo(h.fc.u, h.fc.v, zt);
    }
  });
  cv.addEventListener('pointercancel', function () { drag = null; });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var r = cv.getBoundingClientRect();
    zoomTo(e.clientX - r.left, e.clientY - r.top, Math.max(minZ, Math.min(maxZ, z * Math.exp(-e.deltaY * 0.0016))));
  }, { passive: false });
  cv.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      drag = null;
      var r = cv.getBoundingClientRect();
      pinch = { d: dist(e.touches), z: z,
        mx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
        my: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top };
    }
  }, { passive: true });
  cv.addEventListener('touchmove', function (e) {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      zoomTo(pinch.mx, pinch.my, Math.max(minZ, Math.min(maxZ, pinch.z * dist(e.touches) / pinch.d)));
    }
  }, { passive: false });
  cv.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; }, { passive: true });
  function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY); }
  function zoomTo(mx, my, nz) {
    var wu = cx + (mx - W / 2) / z, wv = cy + (my - H / 2) / z;
    z = nz;
    cx = wu - (mx - W / 2) / z; cy = wv - (my - H / 2) / z;
    hideTip();
    invalidate();
  }
  window.addEventListener('resize', function () { size(); invalidate(); });

  function same(a, b) {
    if (!a || !b) return a === b;
    return a.o === b.o && a.f === b.f && (a.fc && b.fc ? a.fc.key === b.fc.key : a.fc === b.fc);
  }
  function hitAt(mx, my) {
    for (var i = hits.length - 1; i >= 0; i--) {
      var h = hits[i];
      if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) return h;
    }
    return null;
  }
  function showTip(mx, my, h) {
    if (!tip) return;
    tip.hidden = false;
    if (h.o) tip.textContent = h.o.p.area + ' — ' + ((h.o.p.focus || {}).product || '') + ' · tap for why';
    else if (h.f) tip.textContent = h.f.name + ' — ' + h.f.kind_label + (h.city.city ? ' · ' + h.city.city : '');
    else tip.textContent = h.fc.top.city + (h.fc.cities > 1 ? ' +' + (h.fc.cities - 1) + ' more' : '') +
      ' — ' + h.fc.n + ' firm' + (h.fc.n > 1 ? 's' : '') + ' · tap to zoom';
    var r = tip.getBoundingClientRect();
    var x = Math.min(Math.max(8, mx + 14), W - r.width - 8);
    var y = my + 16 + r.height > H - 8 ? my - r.height - 10 : my + 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip && !tip.hidden) tip.hidden = true; }

  if (togBtn && legend) togBtn.addEventListener('click', function () {
    var open = legend.classList.toggle('open');
    togBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ── cards (textContent only) ── */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function row(dl, k, v) {
    if (!v || (Array.isArray(v) && !v.length)) return;
    dl.appendChild(el('dt', '', k));
    dl.appendChild(el('dd', '', Array.isArray(v) ? v.join(' · ') : v));
  }
  function links(box, list) {
    var any = false;
    (list || []).forEach(function (u) {
      if (!/^https?:\/\//i.test(u)) return;
      var a = el('a', '', u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 70) + ' ↗');
      a.href = u; a.target = '_blank'; a.rel = 'noopener nofollow';
      box.appendChild(a); any = true;
    });
    return any;
  }
  function shell() {
    card.textContent = '';
    var x = el('button', 'cx', '×');
    x.type = 'button'; x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', closeCard);
    card.appendChild(x);
    card.hidden = false;
    card.scrollTop = 0;
  }
  function openPlaceCard(o) {
    var p = o.p, f = p.focus || {};
    openPlace = o;
    shell();
    card.appendChild(el('div', 'ck', (p.level === 'cluster' ? 'Java cluster · ' : 'Province · ') + p.province));
    card.appendChild(el('h2', '', p.area));
    var fp = el('div', 'fp');
    var d = el('span', 'fd'); d.style.background = famColor[f.family] || '#8E8E93';
    fp.appendChild(d); fp.appendChild(el('span', '', f.product || '—'));
    card.appendChild(fp);
    var fit = el('span', 'fit', ({ cnc: 'CNC machining', '3d': '3D printing', both: 'CNC + 3D printing' })[f.fit] || 'Made with —');
    card.appendChild(fit);
    var cf = el('span', 'cfb cf-' + (p.confidence || 'low'), (p.confidence || '—') + ' confidence');
    card.appendChild(cf);
    if (f.why) card.appendChild(el('p', '', f.why));
    var dl = el('dl');
    row(dl, 'Also', (p.also || []).map(function (a) { return a.product; }).filter(Boolean));
    row(dl, 'Anchor buyers', p.anchor_buyers);
    row(dl, 'Local inputs', p.local_inputs);
    row(dl, 'Clusters and estates', p.clusters);
    row(dl, 'Official designation', p.official_designation);
    row(dl, 'Minimum wage 2026', p.umk_2026);
    row(dl, 'Skills', p.skills);
    row(dl, 'HS codes', f.hs);
    row(dl, 'Firms listed in ' + p.province, p.firms_n ? String(p.firms_n) : '');
    card.appendChild(dl);
    var src = el('div', 'src');
    src.appendChild(el('div', 'ck', 'Sources'));
    if (!links(src, p.sources)) src.appendChild(el('dd', '', 'No source links recorded for this pick.'));
    card.appendChild(src);
    invalidate();
  }
  function openFirmCard(f) {
    openPlace = null;
    shell();
    card.appendChild(el('div', 'ck', f.kind_label + ' · ' + [f.city, f.province].filter(Boolean).join(', ')));
    card.appendChild(el('h2', '', f.name));
    card.appendChild(el('span', 'fit', 'Evidence: ' + f.tier_label));
    if (f.geo_kind === 'province') card.appendChild(el('p', '', 'Pinned at the province\u2019s main city: the source names no town.'));
    if (f.makes) card.appendChild(el('p', '', f.makes));
    var dl = el('dl');
    row(dl, 'Capabilities', f.capabilities);
    card.appendChild(dl);
    var src = el('div', 'src');
    src.appendChild(el('div', 'ck', 'Source'));
    links(src, [f.source_url, f.website && f.website !== f.source_url ? f.website : null].filter(Boolean));
    card.appendChild(src);
    if (f.web) {
      var wl = el('a', 'webl', 'Company web: who it owns, backs and sells to \u2192');
      wl.href = '/research/' + encodeURIComponent(f.web);
      card.appendChild(wl);
    }
    invalidate();
  }
  function closeCard() {
    if (card) card.hidden = true;
    openPlace = null;
    invalidate();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCard(); });
})();
