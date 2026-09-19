/* 1001umkm.id — the export map: every exporter in the census, plotted at its
 * city, across the whole of Indonesia.
 *
 * Same cartographic language as the 1001startup census map (public/js/
 * jakarta.js): the Natural Earth national base from /data/indonesia.json, the
 * same isometric projection (u = gx−gy, v = (gx+gy)/2, 2:1), the same paper —
 * sea #E4E7E6, neighbours #EDEBE4, Indonesia #F6EFDF — but its own engine,
 * because this map is a different instrument: no towers, no zones; cities
 * carrying 3D commodity sprites (one per sector, a Higgsfield matched set)
 * instead of buildings.
 *
 * Resolution honesty: the census records city + province, not street
 * addresses, so a pin means "in this city" and the panel says so.
 *
 * LOD: far out, cities are iso-diamond dots sized by exporter count; past
 * EXPLODE zoom a city fans its exporters out on a ring and each is drawn as
 * its sector's commodity sprite. Click → the same server-rendered profile the
 * landing drawer uses (/company/<id>?panel=1) in a right-hand drawer.
 *
 * Lives in a file because the CSP is script-src 'self'.
 */
(function () {
  'use strict';
  var cv = document.getElementById('umap');
  if (!cv) return;
  var ctx = cv.getContext('2d');
  var tip = document.getElementById('utip');
  var legend = document.getElementById('ulegend');
  var countEl = document.getElementById('ucount');
  var chipsEl = document.getElementById('uchips');
  var togBtn = document.getElementById('ultog');

  var SEA = '#E4E7E6', NEAR = '#EDEBE4', LAND = '#F6EFDF',
    COAST = 'rgba(32,26,20,.28)', NEARC = 'rgba(32,26,20,.12)';
  var EXPLODE = 2.6;               // zoom where a city fans out into sprites
  var geo = null, feed = null;     // /data/indonesia.json, /data/umkm-map.json
  var KX = 90, KY = 90, W0 = 95;   // projection, fixed after geo loads
  var N0 = 6;
  var landP = [], nearP = [];      // Path2D in world coords
  var nodes = [];                  // {u,v,lat,lon,city,prov,list:[c],dom,count}
  var byId = {};                   // company id -> {c, node}
  var imgs = {};                   // sector -> Image (commodity sprite)
  var cx = 0, cy = 0, z = 0.3, minZ = 0.05, maxZ = 60;
  var W = 0, H = 0, dpr = 1;
  var hits = [];                   // this frame's clickable rects (screen px)
  var hover = null, raf = 0, fly = null;
  var activeSector = '';

  /* ── projection ── */
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
    fetch('/data/umkm-map.json').then(function (r) { return r.json(); }),
  ]).then(function (rs) {
    geo = rs[0]; feed = rs[1];
    W0 = geo.bbox.w; N0 = geo.bbox.n;
    var mid = (geo.bbox.n + geo.bbox.s) / 2;
    KX = 90; KY = 90 * (111320 * Math.cos(mid * Math.PI / 180)) / 110540;
    landP = [ringPath(geo.land)];
    nearP = [ringPath(geo.near || [])];
    buildNodes();
    buildLegend();
    loadSprites();
    size();
    fit();
    var q = new URLSearchParams(location.search);
    var want = q.get('company');
    if (want && byId[want]) {
      var n = byId[want].node;
      flyTo(n.u, n.v, 9, function () { openDrawer(want); });
    } else if (q.get('s') && feed.sectors.some(function (s) { return s.name === q.get('s'); })) {
      setSector(q.get('s'));
    }
    draw();
  }).catch(function (e) {
    if (countEl) countEl.textContent = 'The map data failed to load — refresh to retry.';
  });

  function buildNodes() {
    var m = {};
    feed.companies.forEach(function (c) {
      if (c.lat == null || c.lon == null) return;
      var k = c.lat + ',' + c.lon;
      if (!m[k]) {
        var uv = proj(c.lon, c.lat);
        m[k] = { u: uv[0], v: uv[1], lat: c.lat, lon: c.lon, city: c.city || c.province || '', prov: c.province || '', list: [] };
      }
      m[k].list.push(c);
    });
    nodes = Object.keys(m).map(function (k) { return m[k]; });
    nodes.forEach(function (n) {
      n.count = n.list.length;
      var t = {};
      n.list.forEach(function (c) { t[c.sector] = (t[c.sector] || 0) + 1; });
      n.dom = Object.keys(t).sort(function (a, b) { return t[b] - t[a]; })[0];
      /* stable fan order: strongest tier first, then name — same everywhere */
      n.list.sort(function (a, b) { return (b.tier - a.tier) || (a.name < b.name ? -1 : 1); });
      n.list.forEach(function (c) { byId[c.id] = { c: c, node: n }; });
    });
    nodes.sort(function (a, b) { return b.count - a.count; });
  }

  function loadSprites() {
    Object.keys(feed.sprites || {}).forEach(function (s) {
      var im = new Image();
      im.onload = invalidate;
      im.src = feed.sprites[s];
      imgs[s] = im;
    });
  }

  /* ── view ── */
  function size() {
    dpr = window.devicePixelRatio || 1;
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  }
  function fit() {
    /* frame Indonesia's own land, not the neighbour context */
    var a = proj(geo.bbox.w, geo.bbox.n), b = proj(geo.bbox.e, geo.bbox.s),
      c = proj(geo.bbox.e, geo.bbox.n), d = proj(geo.bbox.w, geo.bbox.s);
    var u0 = Math.min(a[0], b[0], c[0], d[0]), u1 = Math.max(a[0], b[0], c[0], d[0]);
    var v0 = Math.min(a[1], b[1], c[1], d[1]), v1 = Math.max(a[1], b[1], c[1], d[1]);
    cx = (u0 + u1) / 2; cy = (v0 + v1) / 2;
    z = Math.min(W / (u1 - u0), H / (v1 - v0)) * 0.92;
    minZ = z * 0.6;
  }
  function invalidate() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; draw(); });
  }
  function flyTo(u, v, zt, then) {
    fly = { t: 0, u0: cx, v0: cy, z0: z, u1: u, v1: v, z1: zt, then: then };
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

  /* ── legend ── */
  function buildLegend() {
    if (!chipsEl) return;
    var mk = function (name, count, color) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'uchip';
      b.dataset.s = name;
      var sq = document.createElement('span');
      sq.className = 'sq';
      if (color) sq.style.background = color;
      b.appendChild(sq);
      b.appendChild(document.createTextNode((name || 'All sectors') + ' · ' + count));
      b.addEventListener('click', function () { setSector(activeSector === name ? '' : name); });
      return b;
    };
    chipsEl.appendChild(mk('', feed.companies.filter(function (c) { return c.lat != null; }).length, '#000'));
    feed.sectors.forEach(function (s) { chipsEl.appendChild(mk(s.name, s.mapped, s.color)); });
    syncChips();
  }
  function setSector(s) {
    activeSector = s;
    syncChips();
    invalidate();
  }
  function syncChips() {
    if (!chipsEl) return;
    [].forEach.call(chipsEl.children, function (b) {
      b.classList.toggle('on', (b.dataset.s || '') === activeSector);
    });
    if (countEl) {
      var vis = 0, cts = 0;
      nodes.forEach(function (n) {
        var k = listOf(n).length;
        if (k) { cts++; vis += k; }
      });
      countEl.textContent = vis + ' exporters · ' + cts + ' cities' +
        (!activeSector && feed.unmapped ? ' · ' + feed.unmapped + ' not yet mapped' : '');
    }
  }

  /* ── drawing ── */
  function listOf(n) {
    return activeSector ? n.list.filter(function (c) { return c.sector === activeSector; }) : n.list;
  }
  /* A city's fan is a staggered iso GRID, not rings: rings stacked 15 sprites
     into one pile (round two of "too many overlapped"). Rows overlap a little
     on purpose — drawn top row first, so lower rows paint in front and the
     group reads as shelved goods, the pasar-city depth idiom. */
  function fanGeom(k) {
    var cols = Math.max(1, Math.round(Math.sqrt(k * 1.7)));
    var rows = Math.ceil(k / cols);
    return { cols: cols, rows: rows,
      /* half-extents in units of sprite size, for fit-to-space + captions */
      coef: Math.max(((cols - 1) / 2) * 0.98 + 0.62, ((rows - 1) / 2) * 0.52 + 0.75),
      halfH: ((rows - 1) / 2) * 0.52 + 0.62 };
  }
  function fan(k, i, s) {
    if (k === 1) return [0, 0];
    var g = fanGeom(k);
    var row = Math.floor(i / g.cols), col = i % g.cols;
    var start = row * g.cols;
    var inRow = Math.min(g.cols, k - start);       // last row centres its stragglers
    var x = (col - (inRow - 1) / 2) * s * 0.98 + (row % 2 ? s * 0.18 : 0);
    var y = (row - (g.rows - 1) / 2) * s * 0.52;
    return [x, y];
  }
  var fanCoef = function (k) { return fanGeom(k).coef; };

  function draw() {
    if (!geo) return;
    hits = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SEA;
    ctx.fillRect(0, 0, W, H);

    /* land via world-transform */
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (W / 2 - cx * z) * dpr, (H / 2 - cy * z) * dpr);
    ctx.fillStyle = NEAR;
    nearP.forEach(function (p) { ctx.fill(p); });
    ctx.strokeStyle = NEARC; ctx.lineWidth = 0.8 / z;
    nearP.forEach(function (p) { ctx.stroke(p); });
    ctx.fillStyle = LAND;
    landP.forEach(function (p) { ctx.fill(p); });
    ctx.strokeStyle = COAST; ctx.lineWidth = 1 / z;
    landP.forEach(function (p) { ctx.stroke(p); });

    /* everything else in screen space */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var labelBoxes = [];
    var labelOk = function (bx, by, wpx) {
      for (var i = 0; i < labelBoxes.length; i++) {
        var L = labelBoxes[i];
        if (bx < L.x + L.w + 6 && bx + wpx > L.x - 6 && by < L.y + 13 && by + 13 > L.y) return false;
      }
      labelBoxes.push({ x: bx, y: by, w: wpx });
      return true;
    };
    var label = function (t, x, y, color) {
      ctx.font = '400 10px "IBM Plex Mono", monospace';
      var wpx = ctx.measureText(t).width, bx = x - wpx / 2;
      if (!labelOk(bx, y, wpx)) return;
      ctx.fillStyle = 'rgba(246,239,223,.78)';
      ctx.fillRect(bx - 3, y - 1, wpx + 6, 13);
      ctx.fillStyle = color || '#52525B';
      ctx.fillText(t, bx, y + 9);
    };
    var diamond = function (x, y, r, col, hovered) {
      ctx.beginPath();
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = hovered ? '#000' : '#fff'; ctx.lineWidth = hovered ? 1.6 : 1.4; ctx.stroke();
    };

    /* 1 — the visible nodes, and each one's nearest visible neighbour: fans
       size themselves to that gap, so two cities' sprites can never merge
       into one pile (Luca, Aug 31: "too many overlapped") */
    var vis = [];
    nodes.forEach(function (n) {
      var list = listOf(n);
      if (!list.length) return;
      var x = sx(n.u), y = sy(n.v);
      if (x < -240 || x > W + 240 || y < -240 || y > H + 240) return;
      vis.push({ n: n, list: list, x: x, y: y, nn: Infinity });
    });
    for (var a = 0; a < vis.length; a++) {
      for (var b = a + 1; b < vis.length; b++) {
        var d = Math.hypot(vis[a].x - vis[b].x, vis[a].y - vis[b].y);
        if (d < vis[a].nn) vis[a].nn = d;
        if (d < vis[b].nn) vis[b].nn = d;
      }
    }

    /* 2 — mode per node: a fan only opens past EXPLODE zoom AND when the
       biggest sprite that fits half the gap to the next city is still
       readable; everything else stays aggregated */
    var dots = [];
    vis.forEach(function (v) {
      v.mode = 'dot';
      if (z >= EXPLODE) {
        var k = v.list.length;
        var sMax = Math.min(84, 13 * z);
        var allowed = v.nn === Infinity ? 1e9 : v.nn * 0.46;
        var s = Math.min(sMax, allowed / fanCoef(k));
        if (s >= 34) { v.mode = 'fan'; v.s = s; }
      }
      if (v.mode === 'dot') dots.push(v);
    });

    /* 3 — cluster the aggregated nodes in screen space (46px grid + a greedy
       merge of near-boundary neighbours), so the Java corridor reads as a
       handful of counted markers instead of a hundred overlapping diamonds */
    var cells = {};
    dots.forEach(function (v) {
      var key = Math.floor(v.x / 46) + '_' + Math.floor(v.y / 46);
      (cells[key] = cells[key] || []).push(v);
    });
    var clusters = Object.keys(cells).map(function (key) {
      var m = cells[key], count = 0, xw = 0, yw = 0, uw = 0, vw = 0, top = m[0];
      m.forEach(function (v) {
        var k = v.list.length;
        count += k; xw += v.x * k; yw += v.y * k; uw += v.n.u * k; vw += v.n.v * k;
        if (v.list.length > top.list.length) top = v;
      });
      return { x: xw / count, y: yw / count, u: uw / count, v: vw / count,
        count: count, cities: m.length, top: top, members: m };
    });
    clusters.sort(function (p, q) { return q.count - p.count; });
    var merged = [];
    clusters.forEach(function (c) {
      for (var i = 0; i < merged.length; i++) {
        var m = merged[i];
        if (Math.hypot(c.x - m.x, c.y - m.y) < 40) {
          var t = m.count + c.count;
          m.x = (m.x * m.count + c.x * c.count) / t;
          m.y = (m.y * m.count + c.y * c.count) / t;
          m.u = (m.u * m.count + c.u * c.count) / t;
          m.v = (m.v * m.count + c.v * c.count) / t;
          m.count = t;
          m.cities += c.cities;
          m.members = m.members.concat(c.members);
          if (c.top.list.length > m.top.list.length) m.top = c.top;
          return;
        }
      }
      merged.push(c);
    });

    /* 4 — draw clusters (biggest first so their labels win the cull) */
    merged.forEach(function (cl) {
      var r = Math.min(16, 3.2 + Math.sqrt(cl.count) * 1.6);
      var col = (feed.sector_colors || {})[activeSector || cl.top.n.dom] || '#3F3F46';
      var hovered = !!(hover && hover.cl && Math.abs(hover.cl.x - cl.x) < 2 && Math.abs(hover.cl.y - cl.y) < 2);
      diamond(cl.x, cl.y, r, col, hovered);
      hits.push({ x: cl.x - Math.max(r, 10), y: cl.y - Math.max(r, 10), w: Math.max(r, 10) * 2, h: Math.max(r, 10) * 2, cl: cl });
      if (cl.count >= 8 || z > 0.9 || hovered) {
        var t = cl.top.n.city.toUpperCase() + (cl.cities > 1 ? ' +' + (cl.cities - 1) : '') + ' · ' + cl.count;
        label(t, cl.x, cl.y + r + 4);
      }
    });

    /* 5 — draw the fans, sized to their space */
    vis.forEach(function (v) {
      if (v.mode !== 'fan') return;
      var s = v.s, k = v.list.length;
      var g = fanGeom(k), lastRowStart = (g.rows - 1) * g.cols;
      v.list.forEach(function (c, i) {
        var o = fan(k, i, s);
        var px = v.x + o[0], py = v.y + o[1];
        var im = imgs[c.sector];
        if (im && im.complete && im.naturalWidth) {
          var ar = im.naturalWidth / im.naturalHeight;
          var hh = s, ww = s * ar;
          ctx.drawImage(im, px - ww / 2, py - hh * 0.86, ww, hh);
          hits.push({ x: px - ww / 2, y: py - hh * 0.86, w: ww, h: hh, c: c, node: v.n });
          if (hover && hover.c === c) {
            ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
            ctx.strokeRect(px - ww / 2, py - hh * 0.86, ww, hh);
          }
        } else {
          var col2 = (feed.sector_colors || {})[c.sector] || '#3F3F46';
          ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
          ctx.fillStyle = col2; ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
          hits.push({ x: px - 8, y: py - 8, w: 16, h: 16, c: c, node: v.n });
        }
        /* names only once sprites have room, and only on the FRONT row of a
           grid — a mid-row caption prints straight across the sprites below
           it; the shared cull handles the rest */
        if ((z >= 6 && (g.rows === 1 || i >= lastRowStart)) || (hover && hover.c === c)) {
          var name = c.name.length > 26 ? c.name.slice(0, 25) + '…' : c.name;
          label(name, px, py + 4, '#3F3F46');
        }
      });
      /* city caption UNDER the whole fan, not through it */
      var capY = v.y + fanGeom(k).halfH * s + 8;
      label(v.n.city.toUpperCase() + ' · ' + k, v.x, capY, '#8E8E93');
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
    if (drag && e.pointerId === drag.id) {
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      cx = drag.cx - dx / z; cy = drag.cy - dy / z;
      hideTip();
      invalidate();
      return;
    }
    var h = hitAt(e.clientX, e.clientY);
    if (h !== hover) { hover = h; invalidate(); }
    if (h) showTip(e.clientX, e.clientY, h);
    else hideTip();
    cv.style.cursor = h ? 'pointer' : 'grab';
  });
  cv.addEventListener('pointerup', function (e) {
    if (!drag || e.pointerId !== drag.id) { drag = null; return; }
    drag = null;
    if (moved) return;
    var h = hitAt(e.clientX, e.clientY);
    if (!h) return;
    if (h.c) openDrawer(h.c.id);
    else if (h.cl) {
      /* a multi-city cluster splits first; a lone city goes straight to its fan */
      var zt = h.cl.cities > 1 ? Math.min(maxZ, z * 2.6) : Math.max(z * 2.4, EXPLODE + 1.8);
      flyTo(h.cl.u, h.cl.v, zt);
    }
  });
  cv.addEventListener('pointercancel', function () { drag = null; });
  cv.addEventListener('wheel', function (e) {
    e.preventDefault();
    var f = Math.exp(-e.deltaY * 0.0016);
    zoomAt(e.clientX, e.clientY, f);
  }, { passive: false });
  /* pinch */
  var touches = {};
  cv.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      drag = null;
      pinch = { d: dist(e.touches), z: z, mx: (e.touches[0].clientX + e.touches[1].clientX) / 2, my: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
    }
  }, { passive: true });
  cv.addEventListener('touchmove', function (e) {
    if (pinch && e.touches.length === 2) {
      e.preventDefault();
      var f = dist(e.touches) / pinch.d;
      var nz = Math.max(minZ, Math.min(maxZ, pinch.z * f));
      zoomTo(pinch.mx, pinch.my, nz);
    }
  }, { passive: false });
  cv.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; }, { passive: true });
  function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.hypot(dx, dy); }
  function zoomAt(mx, my, f) { zoomTo(mx, my, Math.max(minZ, Math.min(maxZ, z * f))); }
  function zoomTo(mx, my, nz) {
    var wu = cx + (mx - W / 2) / z, wv = cy + (my - H / 2) / z;
    z = nz;
    cx = wu - (mx - W / 2) / z; cy = wv - (my - H / 2) / z;
    hideTip();
    invalidate();
  }
  window.addEventListener('resize', function () { size(); invalidate(); });

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
    tip.textContent = h.c
      ? h.c.name + ' — ' + h.c.sector + (h.node.city ? ' · ' + h.node.city : '')
      : h.cl.top.n.city + (h.cl.cities > 1 ? ' +' + (h.cl.cities - 1) + ' more' : '')
        + ' — ' + h.cl.count + ' exporter' + (h.cl.count > 1 ? 's' : '') + ' · tap to zoom';
    var r = tip.getBoundingClientRect();
    var x = Math.min(Math.max(8, mx + 14), W - r.width - 8);
    var y = my + 16 + r.height > H - 8 ? my - r.height - 10 : my + 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip && !tip.hidden) tip.hidden = true; }

  /* legend collapse on phones */
  if (togBtn && legend) togBtn.addEventListener('click', function () {
    var open = legend.classList.toggle('open');
    togBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  /* ── the profile drawer: the same server-rendered card as everywhere ── */
  var dw = null, dScroll = null, openId = null, cache = {};
  function buildDrawer() {
    dw = document.createElement('div');
    dw.className = 'cpwrap';
    dw.hidden = true;
    dw.innerHTML = '<div class="cpbd" data-close="1"></div>' +
      '<aside class="cpdr" role="dialog" aria-modal="true" tabindex="-1">' +
      '<div class="cpbar"><span class="cppos"></span>' +
      '<button type="button" class="cpx" data-close="1">Close</button></div>' +
      '<div class="cpscroll"></div></aside>';
    document.body.appendChild(dw);
    dScroll = dw.querySelector('.cpscroll');
    dw.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) { closeDrawer(); return; }
      var sib = e.target.closest('a[data-cp]');
      if (sib) { e.preventDefault(); openDrawer(sib.dataset.cp); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && openId) closeDrawer();
    });
  }
  function openDrawer(id) {
    if (!dw) buildDrawer();
    openId = id;
    dScroll.innerHTML = cache[id] || '<div class="cp cp-load"><div class="cp-ln"></div><div class="cp-ln"></div><div class="cp-ln"></div></div>';
    dScroll.scrollTop = 0;
    dw.hidden = false;
    document.body.classList.add('cplock');
    requestAnimationFrame(function () { dw.classList.add('on'); });
    if (cache[id]) return;
    fetch('/company/' + encodeURIComponent(id) + '?panel=1', { headers: { Accept: 'text/html' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) { cache[id] = html; if (openId === id) dScroll.innerHTML = html; })
      .catch(function () {
        if (openId !== id) return;
        dScroll.innerHTML = '<div class="cp-err">Could not load this profile. <a href="/company/' + id + '">Open it as a page instead</a>.</div>';
      });
  }
  function closeDrawer() {
    openId = null;
    dw.classList.remove('on');
    document.body.classList.remove('cplock');
    setTimeout(function () { if (!openId) dw.hidden = true; }, 220);
  }
})();
