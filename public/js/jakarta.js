/* PASAR — Jakarta startup city.
   One map, three zoom levels: the whole DKI Jakarta (real kota + kecamatan
   boundaries from OSM) → click a district to fly in → inside SCBD a real
   mini-city renders (footprints/heights/roads from OSM via scbd.json), with
   tenant towers carrying generated building sprites. A tower holds many
   tenants. Canvas 2D. Deep links: ?focus=<tenant id>, ?area=scbd. */
(() => {
  const canvas = document.getElementById('jkt-canvas');
  if (!canvas) return;
  /* One engine, two products. On PASAR this is the tenant city; on
     1001startup.id (/map — any 1001* hostname, so 1001.vantis.sh and the
     future 1001startup.id both count) it is the census on the map: the census
     layer loads unconditionally, the legend counts census companies, and every
     card links into the census (/company/<id>) instead of PASAR's pages. */
  const IS1001 = location.hostname.includes('1001');
  /* /id/map serves the same map in Bahasa Indonesia — links back into the
     census keep the prefix so the reader stays in their language. Inert on
     PASAR, whose paths never start with /id. */
  const LPFX = location.pathname === '/id' || location.pathname.startsWith('/id/') ? '/id' : '';
  /* ONE MAP OF INDONESIA (Aug 30 2026). This was a city switcher for half a
     day — ?city=bandung swapped the boundary file — and Luca killed it: "i
     think we need to make map of indonesia, but for now the map is only
     visible and zoomed to jakarta and bandung, so we can see jakarta and
     bandung in one map." So there is one canvas, one projection, one census
     layer, and the country underneath it. Greater Jakarta and Bandung are
     ~120 km apart, which at the opening frame is a comfortable single view;
     the metros are camera presets now, not separate pages, and ?city= still
     works as a deep link into one of them.

     PASAR's /jakarta is untouched by any of this — it is the tenant city and
     loads Jakarta alone. */
  const METROS = [
    { id: 'jakarta', name: 'Greater Jakarta', short: 'Jakarta', geo: '/data/jakarta.json' },
    { id: 'bandung', name: 'Bandung', short: 'Bandung', geo: '/data/bandung.json' },
    { id: 'bali', name: 'Bali', short: 'Bali', geo: '/data/bali.json' },
  ];
  /* the national base layer: Indonesia's islands and its neighbours' land,
     Natural Earth 1:50m. Drawn under the tint and faded out on the way in —
     a 1:50m coastline is about a kilometre coarse, which is invisible at
     country zoom and wrong next to a kecamatan boundary. */
  let nation = null, natZ = 0;
  /* The whole static half of the map (tint, grid, boundaries, zone cities,
     census dots) is baked into an offscreen layer and blitted. It is redrawn
     only when the view transform or the data behind it changes, so the pulse,
     the hover and every sprite arrival cost one drawImage instead of
     re-rasterising the city. `ctx` is the CURRENT target so the drawing code —
     drawMonas included — needs no plumbing. */
  const scr = canvas.getContext('2d');
  const baseCv = document.createElement('canvas');
  const bctx = baseCv.getContext('2d');
  let ctx = scr, baseKey = '', epoch = 0, bOx = 0, bOy = 0;
  const invalidate = () => { epoch++; draw(); };
  const tip = document.getElementById('jkt-tip');
  const panel = document.getElementById('map-panel');
  const legend = document.getElementById('jkt-legend');

  const CELL = 280;              // metres per city tile
  const HW = 16, HH = 8;         // iso half-tile, world px
  const MZ = 110540;
  const TINT = {
    'Jakarta Pusat':   '#EFE1C3',
    'Jakarta Selatan': '#E6EBD6',
    'Jakarta Barat':   '#F0E2D1',
    'Jakarta Timur':   '#EDE7CD',
    'Jakarta Utara':   '#E7E7DB',
    /* Bodetabek ring — a shade paler than DKI so the core stays focal */
    'Tangerang':           '#EBE4D2',
    'Tangerang Selatan':   '#E8EAD9',
    'Kabupaten Tangerang': '#F0E9DB',
    'Depok':               '#EAE6D3',
    'Bogor':               '#E6EBDA',
    'Kabupaten Bogor':     '#EAEDDE',
    'Bekasi':              '#EFE7D2',
    'Kabupaten Bekasi':    '#EDEADA',
    /* Bandung basin — the city itself carries the warmest tone so it reads as
       the centre the way Jakarta Pusat does, and the three surrounding units
       step back from it */
    'Bandung':                 '#EFE1C3',
    'Cimahi':                  '#E7E7DB',
    'Kabupaten Bandung':       '#E9EBD8',
    'Kabupaten Bandung Barat': '#EDE9D9',
    /* Sarbagita — Denpasar carries the warm centre tone like Jakarta Pusat
       and Kota Bandung; the three regencies step back from it */
    'Denpasar':           '#EFE1C3',
    'Kabupaten Badung':   '#E9EBD8',
    'Kabupaten Gianyar':  '#EDE9D9',
    'Kabupaten Tabanan':  '#E7E7DB',
  };
  const GOLD = '#F3C64B', GOLD_DEEP = '#8A6D1C';
  /* real facade tones for SCBD landmarks (shared with the 3D drive) */
  const FACADES = [
    ['treasury', '#2e3f4e'], ['sequis', '#bccfd8'], ['energy', '#4e748c'],
    ['prosperity', '#8fa6b5'], ['equity', '#7c93a6'], ['pacific century', '#9fb2c0'],
    ['idx', '#c9b99a'], ['bursa efek', '#c9b99a'], ['pacific place', '#d9cdb4'],
    ['ritz', '#cbbfa4'], ['langham', '#564d43'], ['district 8', '#564d43'],
    ['eternity', '#564d43'], ['infinity', '#564d43'], ['residence 8', '#5f564b'],
    ['office 8', '#4e463d'], ['ashta', '#6e6255'], ['alila', '#b9b2a6'],
    ['artha graha', '#a89b85'], ['revenue', '#8d9aa8'],
    ['monumen nasional', '#EAE3D0'], ['merdeka', '#7d8ca0'], ['sarana jaya', '#98a4b0'],
    ['tokopedia', '#79a08c'], ['mori', '#3d4a58'], ['raffles', '#c3b49a'], ['orchard', '#a9a08e'],
    ['gandaria 8', '#b3bcc6'], ['gandaria heights', '#c8bfae'], ['gandaria city', '#cfc2a9'], ['pakubuwono', '#8a9184'],
    ['sctv', '#7e96ac'], ['panin', '#b6c3cd'], ['senayan city', '#cfc3ab'], ['sentral senayan', '#9fb0bd'],
  ];
  const ROAD_W = { motorway: 8, trunk: 8, primary: 6.4, secondary: 5.2, tertiary: 4.2, busway: 3.4, residential: 3, living_street: 2.4, service: 2, motorway_link: 5, trunk_link: 5, primary_link: 4.4, secondary_link: 4, tertiary_link: 3.4 };

  /* Detail zones — office districts that render as a real mini-city when you
     zoom in (bboxes mirror their scripts/fetch-*.js). */
  const ZONES = [
    { id: 'scbd', name: 'SCBD', src: '/data/scbd.json?v=2',
      bb: { s: -6.2325, w: 106.8015, n: -6.2205, e: 106.8135 },
      center: { lat: -6.2265, lon: 106.8075 },
      zIn: 2.1, zFull: 3.4, req: false, ready: false },
    { id: 'southquarter', name: 'SOUTH QUARTER', src: '/data/southquarter.json',
      bb: { s: -6.3010, w: 106.7790, n: -6.2886, e: 106.7918 },
      center: { lat: -6.2948, lon: 106.7854 },
      zIn: 2.1, zFull: 3.4, req: false, ready: false },
    { id: 'gambir', name: 'GAMBIR', src: '/data/gambir.json',
      bb: { s: -6.1865, w: 106.8115, n: -6.1690, e: 106.8285 },
      center: { lat: -6.17775, lon: 106.82 },
      zIn: 2.1, zFull: 3.4, req: false, ready: false },
    { id: 'satrio', name: 'SATRIO', src: '/data/satrio.json',
      bb: { s: -6.2270, w: 106.8140, n: -6.2154, e: 106.8252 },
      center: { lat: -6.2212, lon: 106.8196 },
      zIn: 2.1, zFull: 3.4, req: false, ready: false },
    { id: 'gandaria', name: 'GANDARIA', src: '/data/gandaria.json',
      bb: { s: -6.2486, w: 106.7776, n: -6.2370, e: 106.7892 },
      center: { lat: -6.2428, lon: 106.7834 },
      zIn: 2.1, zFull: 3.4, req: false, ready: false },
    { id: 'senayan', name: 'SENAYAN', src: '/data/senayan.json',
      bb: { s: -6.2334, w: 106.7914, n: -6.2218, e: 106.8010 },
      center: { lat: -6.2276, lon: 106.7967 },
      zIn: 2.1, zFull: 3.4, req: false, ready: false },
    /* GBK — a LANDMARK district rather than an office one. The senayan extract
       stopped at -6.2218, just short of the main stadium, so the whole Gelora
       Bung Karno complex was off every zone: no buildings, no bowl, bare
       grass. Curated (not `gen`), so it paints over the generated zones that
       overlap it. */
    { id: 'gbk', name: 'GBK', src: '/data/zone-gbk.json',
      bb: { s: -6.2255, w: 106.7955, n: -6.2105, e: 106.8100 },
      center: { lat: -6.2186, lon: 106.8026 },
      zIn: 2.1, zFull: 3.4, req: false, ready: false },
  ];

  let geo, tenants = [], towers = [], sprites = {}, logos = {};
  /* census layer (?census=1): every located company from /data/census.json as a
     sector-colored ground dot — the regulator view of the whole ecosystem */
  let cens = null;
  const CENS_C = {
    fintech: '#C05A2E', commerce: '#3F7D4E', logistics: '#8A6D1C', health: '#4e748c',
    edtech: '#7c93a6', saas: '#564d43', 'ai-cloud': '#2e3f4e', media: '#a3506e',
    travel: '#6e8a5a', prop: '#9a7b4f', agri: '#5a7a3f', fnb: '#b0703c', misc: '#6d675d',
    climate: '#1f7a6d', bank: '#2A6E9F', crypto: '#6E4E8C',
  };
  /* WHOOSH — the Kereta Cepat Jakarta–Bandung line (1001 only; PASAR never
     fetches the file). See the block above the boot section. */
  let whooshRaw = null, whoosh = null, whooshVis = false;
  const WH_RED = '#B3372F';                 // the CR400AF livery accent, muted to the map
  const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let MX, nx, ny;
  let kotaCells;
  let kotaPaths = [], gridPath;
  let kotaLabels = [], kecLabels = [];
  let uMin = 1e9, uMax = -1e9, vMin = 1e9, vMax = -1e9;

  let z = 1, ox = 0, oy = 0, fitZ = 1, dpr = 1;
  let hover = null, anim = null;
  let pulseLive = false, onScreen = true;

  const X = (lon) => (lon - geo.bbox.w) * MX;
  const Y = (lat) => (geo.bbox.n - lat) * MZ;
  const isoU = (gx, gy) => (gx - gy) * HW;
  const isoV = (gx, gy) => (gx + gy) * HH;
  const gridOf = (lon, lat) => [X(lon) / CELL, Y(lat) / CELL];
  const isoOf = (lon, lat) => { const [gx, gy] = gridOf(lon, lat); return [isoU(gx, gy), isoV(gx, gy)]; };

  function inside(x, y, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi) c = !c;
    }
    return c;
  }
  function regionAt(lon, lat, regions) {
    for (let i = 0; i < regions.length; i++) {
      const R = regions[i];
      if (lon < R.bb[0] || lon > R.bb[1] || lat < R.bb[2] || lat > R.bb[3]) continue;
      for (const ring of R.p) if (inside(lon, lat, ring)) return i;
    }
    return -1;
  }
  const centroid = (ring) => {
    let x = 0, y = 0;
    for (const p of ring) { x += p[0]; y += p[1]; }
    return [x / ring.length, y / ring.length];
  };
  /* blend two hexes — the sea only exists while the country layer does, so the
     page ground fades between paper and water instead of switching */
  const mixHex = (a, b, t) => {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  };
  /* mix two hexes and stay a hex — shade() takes hex, so a tinted facade has to
     come back in the same currency to keep the building's own lighting model */
  const mixHexHex = (a, b, t) => {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((A >> sh) & 255) * (1 - t) + ((B >> sh) & 255) * t);
    return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
  };
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  };

  /* ── build: city level ───────────────────────────────────────── */
  function build() {
    const mid = (geo.bbox.s + geo.bbox.n) / 2;
    MX = 111320 * Math.cos((mid * Math.PI) / 180);
    nx = Math.ceil(X(geo.bbox.e) / CELL);
    ny = Math.ceil(Y(geo.bbox.s) / CELL);
    for (const coll of [geo.kota, geo.kec]) {
      for (const R of coll) {
        let w = 1e9, e = -1e9, s = 1e9, n = -1e9;
        for (const ring of R.p) for (const p of ring) {
          if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0];
          if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1];
        }
        R.bb = [w, e, s, n];
        let iu0 = 1e9, iu1 = -1e9, iv0 = 1e9, iv1 = -1e9;
        for (const ring of R.p) for (const p of ring) {
          const [u, v] = isoOf(p[0], p[1]);
          if (u < iu0) iu0 = u; if (u > iu1) iu1 = u;
          if (v < iv0) iv0 = v; if (v > iv1) iv1 = v;
        }
        R.iso = [iu0, iu1, iv0, iv1];
      }
    }
    kotaCells = new Int8Array(nx * ny).fill(-1);
    /* Scanline fill instead of per-cell PIP: the Greater-Jakarta grid is
       ~130k cells and Bodetabek rings are big — PIP per cell blocked the main
       thread for seconds (flights/timers starved). Per row: intersect every
       kota edge with the row's latitude, sort crossings, paint gx runs.
       O(rows × edges) ≈ 3M ops instead of ~400M. */
    for (let gy = 0; gy < ny; gy++) {
      const lat = geo.bbox.n - ((gy + 0.5) * CELL) / MZ;
      for (let ki = 0; ki < geo.kota.length; ki++) {
        const K = geo.kota[ki];
        if (lat < K.bb[2] || lat > K.bb[3]) continue;
        for (const ring of K.p) {
          const xs = [];
          for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
            const yi = ring[i][1], yj = ring[j][1];
            if ((yi > lat) === (yj > lat)) continue;
            xs.push(ring[j][0] + (ring[i][0] - ring[j][0]) * (lat - yj) / (yi - yj));
          }
          xs.sort((a, b) => a - b);
          for (let s2 = 0; s2 + 1 < xs.length; s2 += 2) {
            const g0 = Math.max(0, Math.ceil(((xs[s2] - geo.bbox.w) * MX) / CELL - 0.5));
            const g1 = Math.min(nx - 1, Math.floor(((xs[s2 + 1] - geo.bbox.w) * MX) / CELL - 0.5));
            for (let gx = g0; gx <= g1; gx++) {
              const idx = gy * nx + gx;
              if (kotaCells[idx] >= 0) continue;
              kotaCells[idx] = ki;
              const u = isoU(gx, gy), v = isoV(gx, gy);
              if (u - HW < uMin) uMin = u - HW; if (u + HW > uMax) uMax = u + HW;
              if (v - HH < vMin) vMin = v - HH; if (v + HH > vMax) vMax = v + HH;
            }
          }
        }
      }
    }
    /* Geometry LOD, built once from that raster — this is the frame budget.
       TINT is RUN-LENGTH: a horizontal run of cells in one grid row unions
       EXACTLY into a parallelogram (consecutive iso diamonds share a whole
       edge, and the run's two long edges pass through every shared corner), so
       ~130k filled diamonds collapse to ~2k quads with pixel-identical output.
       GRID keeps per-cell diamonds — it IS the per-cell outline — but is cut
       into spatial BLOCKS carrying their own iso bbox, so a zoomed-in frame
       traverses a handful of blocks instead of all 130k cells. Boundary lines
       become one culled path per region for the same reason.
       Before this the map re-rasterised ~1M path segments 8x/second forever:
       327ms median frame on a throttled phone, i.e. a permanently pegged main
       thread. Path2D append is also QUADRATIC in Chromium (87k diamonds in one
       path = 24s), so small paths are the fastest way to build these too. */
    const QCH = 600;
    kotaPaths = geo.kota.map(() => []);
    const qchunk = (arr) => {
      let c = arr[arr.length - 1];
      if (!c || c.n >= QCH) { c = { p: new Path2D(), n: 0, bb: [1e9, -1e9, 1e9, -1e9] }; arr.push(c); }
      c.n++;
      return c;
    };
    for (let gy = 0; gy < ny; gy++) {
      let run = -1, rs = 0;
      for (let gx = 0; gx <= nx; gx++) {
        const ki = gx < nx ? kotaCells[gy * nx + gx] : -1;
        if (ki === run) continue;
        if (run >= 0) {
          const c = qchunk(kotaPaths[run]);
          const u0 = isoU(rs, gy), v0 = isoV(rs, gy);
          const u1 = isoU(gx - 1, gy), v1 = isoV(gx - 1, gy);
          c.p.moveTo(u0, v0 - HH); c.p.lineTo(u1 + HW, v1);
          c.p.lineTo(u1, v1 + HH); c.p.lineTo(u0 - HW, v0); c.p.closePath();
          const b = c.bb;
          if (u0 - HW < b[0]) b[0] = u0 - HW; if (u1 + HW > b[1]) b[1] = u1 + HW;
          if (v0 - HH < b[2]) b[2] = v0 - HH; if (v1 + HH > b[3]) b[3] = v1 + HH;
        }
        run = ki; rs = gx;
      }
    }
    /* The grid is only ever stroked at z >= 0.5, and a zoomed-in frame touches a
       handful of blocks — so a block's 1,024 diamonds are built the first time
       that block is actually drawn. Laying all 87k of them out up front was
       half the map's boot cost, for geometry most sessions never look at. A
       block's iso bounds follow from its corner cells, so the index itself
       costs nothing. */
    const BS = 32;
    gridPath = [];
    for (let by = 0; by < ny; by += BS) for (let bx = 0; bx < nx; bx += BS) {
      const gy1 = Math.min(by + BS, ny), gx1 = Math.min(bx + BS, nx);
      gridPath.push({
        bx, by, gx1, gy1, p: undefined,
        bb: [isoU(bx, gy1 - 1) - HW, isoU(gx1 - 1, by) + HW, isoV(bx, by) - HH, isoV(gx1 - 1, gy1 - 1) + HH],
      });
    }
    for (const coll of [geo.kota, geo.kec]) for (const R of coll) R.ir = R.p.map((ring) => ring.map((p) => isoOf(p[0], p[1])));
    lodCache.clear();
    const label = (R) => {
      let big = R.p[0];
      for (const ring of R.p) if (ring.length > big.length) big = ring;
      const c = centroid(big);
      const [u, v] = isoOf(c[0], c[1]);
      return { n: R.n, u, v };
    };
    kotaLabels = geo.kota.map(label);
    kecLabels = geo.kec.map(label);

    /* The country, projected once. These rings never change and never LOD —
       they are already 1:50m, so a Path2D each is cheaper than re-walking
       ~170 rings on every base re-bake. `natZ` is the zoom that fits the whole
       archipelago, and it becomes the zoom-out floor: without it clampZ pinned
       the map at 0.8x the metro fit and the country under it was unreachable. */
    const path = (rings) => rings.map((ring) => {
      const p2 = new Path2D();
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      ring.forEach((pt, i) => {
        const [u, v] = isoOf(pt[0], pt[1]);
        if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v;
        if (i) p2.lineTo(u, v); else p2.moveTo(u, v);
      });
      p2.closePath();
      return { p: p2, bb: [u0, u1, v0, v1] };
    });
    if (nation) {
      nation.landP = path(nation.land);
      nation.nearP = path(nation.near || []);
      const B = nation.bbox;
      const cs = [isoOf(B.w, B.n), isoOf(B.e, B.n), isoOf(B.e, B.s), isoOf(B.w, B.s)];
      nation.iso = [Math.min(...cs.map((c) => c[0])), Math.max(...cs.map((c) => c[0])),
                    Math.min(...cs.map((c) => c[1])), Math.max(...cs.map((c) => c[1]))];
    }

    /* zone invite outlines (iso quads of their bboxes) */
    for (const Z of ZONES) {
      Z.quad = [
        isoOf(Z.bb.w, Z.bb.n), isoOf(Z.bb.e, Z.bb.n),
        isoOf(Z.bb.e, Z.bb.s), isoOf(Z.bb.w, Z.bb.s),
      ];
      Z.iso = isoOf(Z.center.lon, Z.center.lat);
    }

    for (const t of tenants) {
      const [u, v] = isoOf(t.lon, t.lat);
      t.u = u; t.v = v;
      const ki = regionAt(t.lon, t.lat, geo.kec);
      t.kec = ki >= 0 ? geo.kec[ki].n : '';
      t.kota = ki >= 0 ? geo.kec[ki].k : '';
    }
    /* group tenants into towers (a tower holds many tenants) */
    const byTower = new Map();
    for (const t of tenants) {
      const key = t.tower || t.name;
      if (!byTower.has(key)) byTower.set(key, { name: key, tenants: [], u: t.u, v: t.v, lat: t.lat, lon: t.lon, kec: t.kec, kota: t.kota });
      byTower.get(key).tenants.push(t);
    }
    towers = [...byTower.values()];
    for (const tw of towers) {
      tw.anchor = tw.tenants.find((t) => t.sprite) || tw.tenants[0];
      tw.zone = ZONES.find((Z) => tw.lon >= Z.bb.w && tw.lon <= Z.bb.e && tw.lat >= Z.bb.s && tw.lat <= Z.bb.n) || null;
    }
  }

  /* ── build: zone detail level ────────────────────────────────── */
  /* There are ~93 zones and each is a 200-700KB OSM extract that expands into
     thousands of Path2Ds. Left unbounded, a zoom-in fires a dozen fetches at
     once and nothing is ever released — on a phone that is a multi-second
     stall and then a dead tab. So: at most two in flight, and at most ZMAX
     built cities retained, evicting the ones no longer in view. */
  const ZMAX = 8;
  const zQueue = [], zLive = [];
  let zLoading = 0;
  function loadDetail(Z) {
    if (Z.req) return;
    Z.req = true;
    zQueue.push(Z);
    pumpZones();
  }
  function pumpZones() {
    while (zLoading < 2 && zQueue.length) {
      const Z = zQueue.shift();
      zLoading++;
      buildDetail(Z).catch(() => { Z.req = false; }).then(() => { zLoading--; pumpZones(); });
    }
  }
  function trimZones() {
    if (zLive.length <= ZMAX) return;
    viewBox();
    /* Evict exactly what the loader would NOT ask for again. Anything else
       thrashes: drop a zone the load trigger still wants and it is re-fetched
       on the very next frame, forever. */
    for (let i = 0; i < zLive.length && zLive.length > ZMAX; ) {
      const Z = zLive[i];
      if (z >= Z.zIn - 0.4 && zoneInView(Z)) { i++; continue; }
      zLive.splice(i, 1);
      Z.ready = false; Z.req = false;
      Z.blds = null; Z.roads = null; Z.greens = null; Z.labels = null;
      for (const tw of towers) if (tw.zone === Z) { if (tw.bld) tw.bld.tw = null; tw.bld = null; }
    }
  }
  /* The front facade of a building — the down-screen edge wide enough to carry
     a sign. It was computed only for PASAR tenant buildings, inside the tenant
     binding loop; the census layer had no way to reach it and fell back to a
     flat plate on the roof, which is the "logo is embed in building" look. Now
     it is a lazy property any building can have.

     The arc fallback matters: rounded and notched footprints — the South
     Quarter cylinders, SCTV's and Indosat's slabs — have no single straight
     front edge, so consecutive front edges are chained and the widest run's
     CHORD carries the sign instead. */
  function frontWall(b) {
    if (b.wall !== undefined) return b.wall;
    b.wall = null;
    const pts = b.pts, n = pts.length;
    let fe = null, fw = 0;
    const frontOf = (i) => { /* true = outside faces down-screen; null = degenerate (dup point) */
      const a = pts[i], b2 = pts[(i + 1) % n];
      const dx = b2[0] - a[0], dy = b2[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return null;
      let nx = -dy / len, ny = dx / len;
      if (ny < 0) { nx = -nx; ny = -ny; }
      const mx = (a[0] + b2[0]) / 2, my = (a[1] + b2[1]) / 2;
      return !inside(mx + nx * 0.2, my + ny * 0.2, pts);
    };
    const take = (a, b2) => {
      const dx = b2[0] - a[0];
      const len = Math.hypot(dx, b2[1] - a[1]);
      if (len < 0.8 || Math.abs(dx) <= fw) return;
      fw = Math.abs(dx); fe = dx >= 0 ? [a, b2, len] : [b2, a, len];
    };
    for (let i = 0; i < n; i++) if (frontOf(i) === true) take(pts[i], pts[(i + 1) % n]);
    let straight = !!fe && fe[2] >= 2.2;
    if (!straight) {
      /* a chord across a curved or notched facade: a sign drawn in that plane
         floats slightly off the surface, so it is drawn smaller and lower */
      const front = []; let bi = -1;
      for (let i = 0; i < n; i++) { front[i] = frontOf(i); if (bi < 0 && front[i] === false) bi = i; }
      if (bi >= 0) {
        let rs = -1;
        for (let k = bi + 1; k <= bi + n; k++) {
          const f = front[k % n];
          if (f === false) { if (rs >= 0) take(pts[rs % n], pts[k % n]); rs = -1; }
          else if (f === true && rs < 0) rs = k;
        }
      }
    }
    if (fe) b.wall = { ax: fe[0][0], av: fe[0][1], ex: (fe[1][0] - fe[0][0]) / fe[2],
                       ey: (fe[1][1] - fe[0][1]) / fe[2], len: fe[2], arc: !straight };
    return b.wall;
  }

  function buildDetail(Z) {
    return fetch(Z.src).then((r) => r.json()).then((d) => {
      const MXs = 111320 * Math.cos((d.center.lat * Math.PI) / 180);
      const lonOf = (x) => d.center.lon + x / MXs;
      const latOf = (zz) => d.center.lat - zz / MZ;
      const pt = (p) => isoOf(lonOf(p[0]), latOf(p[1]));

      /* ── GROUND, BY KIND ─────────────────────────────────────────────
         Every leisure and landuse polygon used to collapse into one lawn fill,
         which is most of why the GBK complex read as wasted green: 45 pitches,
         41 car parks, 20 pools and 19 woods all painted the same pale wash.
         The fetch script now names the kind; older zone files still hand over
         bare coordinate arrays, so both shapes are accepted and a legacy entry
         is treated as grass. */
      const GK = ['grass', 'park', 'wood', 'pitch', 'parking', 'water'];
      const ground = {};
      for (const k of GK) ground[k] = new Path2D();
      const canopyRings = [];   // wood and park outlines, in METRES, for the scatter
      for (const g of d.green || []) {
        const ring = Array.isArray(g) ? g : g.p;
        const kind = Array.isArray(g) ? 'grass' : (GK.includes(g.k) ? g.k : 'grass');
        if (!ring || ring.length < 3) continue;
        const path = ground[kind];
        ring.forEach((p, i) => { const [u, v] = pt(p); i ? path.lineTo(u, v) : path.moveTo(u, v); });
        path.closePath();
        if (kind === 'wood' || kind === 'park') canopyRings.push({ kind, ring });
      }
      for (const ring of d.water || []) {
        ring.forEach((p, i) => { const [u, v] = pt(p); i ? ground.water.lineTo(u, v) : ground.water.moveTo(u, v); });
        ground.water.closePath();
      }
      const greens = ground.grass;

      /* ── THE CANOPY ──────────────────────────────────────────────────
         OSM maps 132 individual trees here and nineteen WOODS. Drawing only
         the 132 leaves a forest looking like a lawn with a few dots on it, so
         the woods are planted: a jittered grid inside each polygon, spaced by
         kind, deterministic (a seeded hash of the position, not Math.random, so
         the same tree lands in the same place on every re-bake and the base
         layer stays cacheable). Positions are computed once, here, not per
         frame — there can be a few thousand of them. */
      const hash = (a, b) => { const t = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return t - Math.floor(t); };
      /* [u, v, scale] — the scale is baked in, not rolled at draw time, so the
         canopy is identical on every re-bake and a uniform dot field becomes a
         wood with texture in it */
      const trees = [];
      const plant = (x, y) => { const [u, v] = pt([x, y]); trees.push([u, v, 0.8 + hash(x * 3.3, y * 7.7) * 0.5]); };

      for (const p of d.trees || []) plant(p[0], p[1]);
      const inRing = (x, y, r) => {
        let c = false;
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
          if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-12) + xi) c = !c;
        }
        return c;
      };
      const TREE_CAP = 5200;
      for (const { kind, ring } of canopyRings) {
        if (trees.length >= TREE_CAP) break;
        const S = kind === 'wood' ? 11 : 17;          // metres between trunks
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const p of ring) {
          if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
          if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
        }
        if ((x1 - x0) * (y1 - y0) > 900000) continue;  // a whole-district polygon is not a wood
        for (let y = y0; y <= y1 && trees.length < TREE_CAP; y += S) {
          for (let x = x0; x <= x1 && trees.length < TREE_CAP; x += S) {
            const jx = x + (hash(x, y) - 0.5) * S * 0.8;
            const jy = y + (hash(y, x) - 0.5) * S * 0.8;
            if (inRing(jx, jy, ring)) plant(jx, jy);
          }
        }
      }
      const roads = {};
      for (const r of d.roads || []) {
        const w = ROAD_W[r.c] || 2.6;
        const key = w.toFixed(1);
        if (!roads[key]) roads[key] = new Path2D();
        r.p.forEach((p, i) => { const [u, v] = pt(p); i ? roads[key].lineTo(u, v) : roads[key].moveTo(u, v); });
      }
      const blds = [];
      for (const b of d.buildings || []) {
        const pts = b.p.map(pt);
        if (pts.length < 3) continue;
        let cu = 0, cv = 0;
        for (const p of pts) { cu += p[0]; cv += p[1]; }
        cu /= pts.length; cv /= pts.length;
        const H = (Math.min(b.h || 12, 300) / CELL) * HH * 2.6;
        const name = b.n || '';
        let fac = '#b3a78f';
        if (name) {
          const low = name.toLowerCase();
          for (const [k, c] of FACADES) if (low.includes(k)) { fac = c; break; }
          if (fac === '#b3a78f') fac = '#9d9179';
        }
        const walls = new Path2D(), top = new Path2D();
        for (let i = 0; i < pts.length; i++) {
          let a = pts[i], b2 = pts[(i + 1) % pts.length];
          if (b2[0] < a[0]) { const t2 = a; a = b2; b2 = t2; } // uniform winding: filled quads never cancel
          walls.moveTo(a[0], a[1]); walls.lineTo(b2[0], b2[1]);
          walls.lineTo(b2[0], b2[1] - H); walls.lineTo(a[0], a[1] - H); walls.closePath();
        }
        pts.forEach((p, i) => { i ? top.lineTo(p[0], p[1] - H) : top.moveTo(p[0], p[1] - H); });
        top.closePath();
        blds.push({ n: name, h: b.h || 0, H, walls, top, pts, cu, cv, fac, k: b.k });
      }
      blds.sort((a, b) => a.cv - b.cv);
      /* ── LANDMARKS ──────────────────────────────────────────────────
         A landmark is a building the city knows by shape, and drawing it as a
         grey box throws away the one structure a reader would have recognised.
         Monas already had a bespoke renderer; this turns that one-off into a
         registry so the next one is a row, not a new branch. `lm` names the
         renderer, `mw` is the footprint half-span every renderer needs. */
      for (const bb of blds) {
        const lm = bb.k === 'stadium' ? 'stadium'
          : (bb.n && /^monumen nasional$/i.test(bb.n) && bb.h >= 100) ? 'monas'
          : null;
        if (!lm) continue;
        bb.lm = lm;
        let sw = 0, sv = 0;
        for (const p of bb.pts) {
          sw = Math.max(sw, Math.abs(p[0] - bb.cu));
          sv = Math.max(sv, Math.abs(p[1] - bb.cv));
        }
        bb.mw = sw; bb.mv = sv;
      }
      /* bind tenant towers to their real building (nearest named footprint ≤ ~50m) */
      for (const tw of towers) {
        if (tw.zone !== Z) continue;
        let best = null, bd = 3;
        for (const b of blds) {
          if (!b.n) continue;
          const dd = Math.hypot(b.cu - tw.u, b.cv - tw.v);
          if (dd < bd) { bd = dd; best = b; }
        }
        if (!best) continue;
        tw.bld = best; best.tw = tw;
        let su = 0;
        for (const p of best.pts) su = Math.max(su, Math.abs(p[0] - best.cu));
        best.spanU = su;
        frontWall(best);
      }
      Z.greens = greens; Z.ground = ground; Z.trees = trees; Z.roads = roads; Z.blds = blds;
      Z.labels = blds.filter((b) => b.n && b.h >= 60).sort((a, b) => b.h - a.h).slice(0, 34);
      Z.ready = true;
      zLive.push(Z);
      trimZones();
      invalidate();
    });
  }

  /* Which real building is a census company in? The geocode lands on its
     ADDRESS, not on a footprint, so bind the pin to the tower it sits on the
     way a tenant tower binds — nearest tall footprint first, since a census
     address is an office tower and the shophouse next door is not. Cached
     against the zone's building array, so a rebuild or an eviction re-binds. */
  /* What OSM said it found when the pin was geocoded. Anything else — a
     kecamatan centroid, a whole village — is an approximate location, and the
     map must not draw it standing on someone else's tower. */
  const exactPin = (c) => c.pin_kind === 'address';
  /* A cartoon building cannot stand on a 200m tower without reading as a toy
     stuck to the roof — which is exactly what it looked like in SCBD, because
     the sprite pass paints in screen space AFTER every building. So: a company
     pinned to a real tower gets its logo ON that tower (the tenant idiom), and
     any sprite that is still drawn gets occluded by whatever stands in front. */
  const TOWER_M = 26;                     // metres; SCBD towers are 100-250, shophouses 8-20
  const censTall = (b) => !!b && (b.h || 0) >= TOWER_M;
  const censLogos = {};
  function censLogo(c) {
    if (!c.logo) return null;
    let im = censLogos[c.id];
    if (!im) {
      im = censLogos[c.id] = new Image();
      im.decoding = 'async'; im.onload = draw; im.src = c.logo;
    }
    return im.complete && im.naturalWidth ? im : null;
  }
  /* Is anything standing in front of this ground point tall enough to hide a
     sprite of world-height hW? blds are sorted by cv, so the scan starts at the
     first building nearer than the pin and stops once they are too far forward
     to cover anything. */
  function censHidden(Z, u, v, hW) {
    const B = Z && Z.blds;
    if (!B || !B.length) return false;
    let lo = 0, hi = B.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (B[m].cv <= v + 0.6) lo = m + 1; else hi = m; }
    for (let i = lo; i < B.length; i++) {
      const b = B[i];
      if (b.cv > v + 16) break;
      if (b.spanU === undefined) { let su = 0; for (const pt2 of b.pts) su = Math.max(su, Math.abs(pt2[0] - b.cu)); b.spanU = su; }
      /* only a building that covers the sprite's own column, top to bottom,
         hides it. A looser test emptied the whole of SCBD, where something
         taller stands in front of almost every pin. */
      if (Math.abs(b.cu - u) > b.spanU * 0.75) continue;
      if (b.cv - b.H < v - hW * 1.02) return true;
    }
    return false;
  }
  function censBld(P, Z) {
    if (P.bz === Z.blds) return P.bld;
    P.bz = Z.blds; P.bld = null;
    if (!Z.blds) return null;
    let tall = null, th = 0, near = null, nd = 2.4;
    for (const b of Z.blds) {
      if (Math.abs(b.cu - P.u) > 2.4) continue;
      const d = Math.hypot(b.cu - P.u, b.cv - P.v);
      if (d > 2.4) continue;
      if (d < nd) { nd = d; near = b; }
      if (d < 1.5 && b.h > th) { th = b.h; tall = b; }
    }
    const b = (th >= 20 ? tall : null) || near;
    if (b && b.spanU === undefined) {
      let su = 0;
      for (const p of b.pts) su = Math.max(su, Math.abs(p[0] - b.cu));
      b.spanU = su;
    }
    return (P.bld = b);
  }

  /* ── occupancy ───────────────────────────────────────────────────
     WHO IS IN THIS BUILDING. At street zoom the real extruded building is the
     biggest, most legible object on screen, and until now the census layer
     ignored it: a company got a cartoon toy parked in front of its tower and a
     white logo plate laid flat on the roof. Measured in SCBD at z=4.6, every
     census toy drew at exactly 96px whether its building was 28m or 280m — up
     to 9.6x oversized — while the tower behind it went unmarked. So the
     building becomes the object: tinted in the occupant's colour, wearing its
     mark as facade signage.

     ONLY AN ADDRESS-PRECISE PIN MAY CLAIM A BUILDING. 97 of 318 located rows
     are street-level and 92 are area-level; letting those tint a tower would
     be the map asserting a fact the geocode cannot support.

     Computed once per zone per census load — this lives in the cached base
     layer, so it must never run per frame. */
  function zoneOccupants(Z) {
    /* Keyed on the BUILDING ARRAY, not on the zone. trimZones() evicts a zone by
       setting Z.blds = null and buildDetail() later rebuilds a brand-new array;
       a memo keyed on the zone handed back a Map full of discarded building
       objects, so a district you flew away from and came back to lost every
       tint while its signs and click targets still pointed at ghosts. */
    if (Z.occBlds === Z.blds && Z.occCens === (cens ? cens.list : null)
        && Z.occN === towers.length) return Z.occ;
    if (!Z.blds) { Z.occBlds = null; Z.occ = new Map(); return Z.occ; }
    const m = new Map();
    /* best-ranked occupant wins the facade — a tower holds many companies and
       only one colour, and rank is the census's own ordering */
    const put = (b, o) => { if (b && (!m.has(b) || o.rank < m.get(b).rank)) m.set(b, o); };
    for (const tw of towers) {
      if (tw.zone !== Z || !tw.bld) continue;
      put(tw.bld, { label: tw.anchor.name, col: GOLD, rank: -1, tenant: tw });
    }
    if (cens) for (const P of cens.list) {
      const c = P.c;
      if (!exactPin(c)) continue;
      if (c.lon < Z.bb.w || c.lon > Z.bb.e || c.lat < Z.bb.s || c.lat > Z.bb.n) continue;
      const b = censBld(P, Z);
      if (!b) continue;
      put(b, { label: c.name, col: CENS_C[c.sector_key] || '#6d675d', rank: c.rank || 1e9, cs: P });
    }
    Z.occBlds = Z.blds; Z.occCens = cens ? cens.list : null; Z.occN = towers.length; Z.occ = m;
    return m;
  }

  /* ── view ────────────────────────────────────────────────────── */
  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    fitZ = Math.min(w / (uMax - uMin), h / (vMax - vMin)) * 0.92;
    if (nation && nation.iso) {
      const [nu0, nu1, nv0, nv1] = nation.iso;
      natZ = Math.min(w / (nu1 - nu0), h / (nv1 - nv0)) * 0.92;
      minZ = natZ * 0.9;                 // a little slack past the country fit
    }
    z = fitZ;
    ox = w / 2 - ((uMin + uMax) / 2) * z;
    oy = h / 2 - ((vMin + vMax) / 2) * z;
  }
  /* the iso bounds of one metro, straight off its kota polygons — no second
     table of bboxes to drift out of step with the boundary files */
  function metroBounds(id) {
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const K of geo.kota) {
      if (K.metro !== id || !K.iso) continue;
      u0 = Math.min(u0, K.iso[0]); u1 = Math.max(u1, K.iso[1]);
      v0 = Math.min(v0, K.iso[2]); v1 = Math.max(v1, K.iso[3]);
    }
    return u1 > u0 ? [u0, u1, v0, v1] : null;
  }
  /* which chip reads as current. The server renders one active for the
     ?city= it was asked for; once the camera moves client-side the header has
     to follow, or the page claims to be somewhere it is not. */
  function markChip(id) {
    for (const a of document.querySelectorAll('.chip[data-metro]')) a.classList.toggle('on', a.dataset.metro === id);
    /* and the legend follows the camera. Flying to Bandung while the legend
       still showed thirteen Jakarta kota above the fold read as if nothing had
       happened — the group you are standing in scrolls to the top and is
       marked, so the panel answers "where am I" without being read. */
    let hit = null;
    for (const b of legend.querySelectorAll('.mg')) {
      const on = b.dataset.metro === id;
      b.classList.toggle('on', on);
      if (on) hit = b;
    }
    const kl = legend.querySelector('.kl');
    if (kl) kl.scrollTop = hit ? Math.max(0, hit.offsetTop - kl.offsetTop) : 0;
  }
  /* fly to a named metro — what the header chips do, and what ?city= does on
     load. The 0.78 factor leaves the legend and the chips some room. */
  /* Chip and legend heading are the same action, so they call the same thing:
     move the camera, mark the chip, rewrite ?city= without a reload. They
     drifted the moment they were two handlers — the legend flew to Jakarta
     while the header still read Bandung. */
  function goToMetro(id) {
    if (!flyToMetro(id)) return false;
    markChip(id);
    const u = new URL(location.href);
    u.searchParams.set('city', id);
    history.replaceState(null, '', u);
    return true;
  }
  function flyToMetro(id, instant) {
    const b = metroBounds(id);
    if (!b) return false;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const tz = Math.min(w / (b[1] - b[0]), h / (b[3] - b[2])) * 0.78;
    const u = (b[0] + b[1]) / 2, v = (b[2] + b[3]) / 2;
    if (instant) { z = clampZ(tz); ox = w / 2 - u * z; oy = h / 2 - v * z; draw(); }
    else flyTo(u, v, clampZ(tz));
    return true;
  }
  /* The floor used to be 0.8x the metro fit, which was right when the map WAS
     the metro. With a country underneath, that pinned the camera inside Java
     and nothing else was ever reachable — so the floor is now whatever fits
     the archipelago, computed in fit() once the national layer is projected. */
  let minZ = 0;
  const clampZ = (v) => Math.max(minZ || fitZ * 0.8, Math.min(12, v));
  /* NATIONAL OVERVIEW. Below this the camera has left the metros and is
     looking at the archipelago, and two things that are right inside a city
     become wrong: the census sprites, drawn at a held screen size, turn into
     three toy towers the size of West Java, and every kota label stacks on one
     pixel. Both stand down; the ground dots stay, because a tight cluster of
     dots over West Java is exactly the true picture at that scale. Expressed
     against fitZ rather than as a constant — the same lesson as the old 2.2
     sprite gate, which read reasonable and sat 11-18x above the opening view. */
  const natMode = () => z < fitZ * 0.55;
  /* Zoom at and above which every census sprite is drawn at map scale. Below
     it the layer is thinned per screen cell and each building is held at a
     legible floor size — 34*z alone is ~5px at the opening zoom, which is why
     simply removing the old gate would not have made anything visible. */
  const ZFULL = 2.2;
  /* SYMBOL SIZE. A toy is a map symbol, so it holds a near-constant screen size
     — but the cap decides whether it sits IN the city or on top of it. The old
     110px ceiling was set when nothing real was ever drawn beside it; at street
     zoom real buildings run 10-96px, so 110 made every symbol the tallest thing
     on screen. 62 puts it inside the city's own range, and 62 * the tenant's
     1.12 lands on 69px — exactly the size an in-zone tenant already draws at,
     so a tower looks the same whether its zone has loaded yet or not. */
  const censH = (zz) => Math.max(30, Math.min(62, 34 * zz));
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    draw();
  }
  const toWorld = (px, py) => [(px - ox) / z, (py - oy) / z];
  /* ONE viewbox per frame, in a reused array. zoneInView/detailAlpha used to
     rebuild it on every call — 93 zones x every census pin was ~16k throwaway
     arrays per frame. [u0, u1, v0, v1] */
  const VB = [0, 0, 0, 0];
  const BM = 120;   // the base layer is baked BM css px past every edge, so a
                    // pan is a blit at an offset instead of a full re-bake
  function viewBox() {
    const m = BM / z;
    VB[0] = -ox / z - m; VB[1] = (canvas.clientWidth - ox) / z + m;
    VB[2] = -oy / z - m; VB[3] = (canvas.clientHeight - oy) / z + m;
    return VB;
  }
  const visBB = (bb) => !(bb[1] < VB[0] || bb[0] > VB[1] || bb[3] < VB[2] || bb[2] > VB[3]);

  /* Boundary LOD. The 145 kecamatan rings carry ~10.8k points and the 13
     kota rings ~4.1k; at city zoom that is drawn into a picture ~360px wide,
     where most of it sits far below one pixel and still costs full stroke
     tessellation. So each zoom OCTAVE gets its own decimated copy, built once
     and cached, with the tolerance set so the worst-case error anywhere inside
     the octave stays under a third of a CSS pixel — invisible, by construction.
     Above zoom 8 the full-precision rings are used unchanged. */
  const lodCache = new Map();
  const zOct = () => Math.max(-6, Math.min(3, Math.round(Math.log2(z))));
  function gridBlock(B) {
    if (B.p !== undefined) return B.p;
    let p = null;
    for (let gy = B.by; gy < B.gy1; gy++) for (let gx = B.bx; gx < B.gx1; gx++) {
      if (kotaCells[gy * nx + gx] < 0) continue;
      const u = isoU(gx, gy), v = isoV(gx, gy);
      if (!p) p = new Path2D();
      p.moveTo(u, v - HH); p.lineTo(u + HW, v); p.lineTo(u, v + HH); p.lineTo(u - HW, v); p.closePath();
    }
    return (B.p = p);
  }
  function simp(ring, t2) {
    const out = [ring[0]];
    let ax = ring[0][0], ay = ring[0][1];
    for (let i = 1; i < ring.length - 1; i++) {
      const p = ring[i], dx = p[0] - ax, dy = p[1] - ay;
      if (dx * dx + dy * dy < t2) continue;
      out.push(p); ax = p[0]; ay = p[1];
    }
    out.push(ring[ring.length - 1]);
    return out;
  }
  function rings(coll, tag, oct) {
    const k = tag + oct;
    let v = lodCache.get(k);
    if (v) return v;
    const tol = oct >= 3 ? 0 : 0.22 / Math.pow(2, oct);
    const t2 = tol * tol;
    v = coll.map((R) => {
      const P = new Path2D();
      for (const ring of R.ir) {
        const r2 = tol && ring.length > 4 ? simp(ring, t2) : ring;
        for (let i = 0; i < r2.length; i++) i ? P.lineTo(r2[i][0], r2[i][1]) : P.moveTo(r2[i][0], r2[i][1]);
        P.closePath();
      }
      return { p: P, bb: R.iso };
    });
    lodCache.set(k, v);
    if (lodCache.size > 8) lodCache.delete(lodCache.keys().next().value);
    return v;
  }
  const zoneInView = (Z) => !(Z.quad[1][0] < VB[0] || Z.quad[3][0] > VB[1] || Z.quad[2][1] < VB[2] || Z.quad[0][1] > VB[3]);
  const detailAlpha = (Z) => {
    if (!Z.ready || !zoneInView(Z)) return 0;
    return Math.max(0, Math.min(1, (z - Z.zIn) / (Z.zFull - Z.zIn)));
  };

  /* Every draw() request is coalesced into at most one paint per animation
     frame. Panning used to paint straight out of pointermove (which fires
     faster than rAF, and coalesced-move bursts on touch fire far faster). */
  let rafId = 0;
  function draw() { if (!rafId) rafId = requestAnimationFrame(paint); }
  function paint() {
    rafId = 0;
    if (!geo) return;                       // a resize can land before the data does
    const w = canvas.clientWidth, h = canvas.clientHeight;
    viewBox();
    /* zone detail mini-cities */
    for (const Z of ZONES) if (z >= Z.zIn - 0.4 && zoneInView(Z)) loadDetail(Z);
    /* CURATED ZONES PAINT LAST. Zones overlap — the generated census zones were
       cut from company clusters and several of them sit on top of a curated
       district — and base() paints each active zone's ground, roads and
       buildings in list order, so whatever comes later wins. The curated
       extracts are the good data (real heights, real names, the landmark
       flags), and they were being buried: THREE zones cover Merdeka Square —
       curated `gambir` plus generated `gambir` and `gambir-2` — and the two
       generated ones painted their own bare green and 12m-default boxes
       straight over Monas, which is why a monument with a bespoke renderer
       drew every frame and was never once visible. Sorting is the whole fix:
       generated ground first, curated on top. */
    const das = ZONES.map((Z) => [Z, detailAlpha(Z)])
      .sort((a, b) => (a[0].gen ? 0 : 1) - (b[0].gen ? 0 : 1));
    const da = das.reduce((m, [, a]) => Math.max(m, a), 0);
    const actZ = das.filter((d2) => d2[1] > 0);

    const key = `${z}|${w}|${h}|${dpr}|${epoch}`;
    if (key !== baseKey || Math.abs(ox - bOx) > BM || Math.abs(oy - bOy) > BM) {
      const bw = Math.round((w + BM * 2) * dpr), bh = Math.round((h + BM * 2) * dpr);
      if (baseCv.width !== bw || baseCv.height !== bh) { baseCv.width = bw; baseCv.height = bh; }
      bOx = ox; bOy = oy;
      ctx = bctx;
      base(w + BM * 2, h + BM * 2, das, da);
      ctx = scr;
      baseKey = key;
    }
    scr.setTransform(1, 0, 0, 1, 0, 0);
    scr.globalAlpha = 1;
    /* whole device pixels: a fractional blit would resample the base and read
       as a soft frame mid-drag. The sub-pixel debt is repaid by the re-bake. */
    scr.drawImage(baseCv, Math.round((ox - bOx) * dpr - BM * dpr), Math.round((oy - bOy) * dpr - BM * dpr));
    dyn(w, h, das, da, actZ);
    /* After the frame, not during it: trimming used to run only when a zone
       finished loading, so a fly-in that pulled a dozen zones into view kept all
       of them once the camera settled. Early-returns unless over budget. */
    trimZones();
  }

  /* the cached half — everything anchored to the ground */
  function base(w, h, das, da) {
    const [u0, u1, v0, v1] = VB;
    const oct = zOct();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    /* Sea, then land. Both only while the country layer is worth showing: a
       1:50m coastline is ~1 km coarse, so as the camera comes in it fades to
       nothing and the paper takes over well before it could disagree with a
       kecamatan edge. NAT_IN..NAT_OUT is that fade, in zoom. */
    const NAT_IN = 0.30, NAT_OUT = 0.62;
    const na = nation && nation.landP ? Math.max(0, Math.min(1, (NAT_OUT - z) / (NAT_OUT - NAT_IN))) : 0;
    ctx.fillStyle = na > 0 ? mixHex('#F6EFDF', '#E4E7E6', na) : '#F6EFDF';
    ctx.fillRect(0, 0, w, h);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, (bOx + BM) * dpr, (bOy + BM) * dpr);
    if (na > 0) {
      ctx.globalAlpha = na;
      ctx.fillStyle = '#EDEBE4';                       // neighbours: land, not ours
      for (const c of nation.nearP) if (visBB(c.bb)) ctx.fill(c.p);
      ctx.fillStyle = '#F6EFDF';                       // Indonesia: the same paper the metros sit on
      for (const c of nation.landP) if (visBB(c.bb)) ctx.fill(c.p);
      ctx.strokeStyle = 'rgba(32,26,20,.28)'; ctx.lineWidth = 1 / z;
      for (const c of nation.landP) if (visBB(c.bb)) ctx.stroke(c.p);
      ctx.globalAlpha = 1;
    }
    /* Tint: the exact tile quads while a tile is resolvable, the real kota
       polygon once a tile drops under ~3 device px — same colour, same place,
       and at that scale the two edges are less than half a pixel apart. */
    if (2 * HW * z * dpr < 3) {
      const kr = rings(geo.kota, 'k', oct);
      geo.kota.forEach((K, i) => {
        if (!visBB(kr[i].bb)) return;
        ctx.fillStyle = TINT[K.n] || '#EDE6D2';
        ctx.fill(kr[i].p);
      });
    } else {
      geo.kota.forEach((K, i) => {
        ctx.fillStyle = TINT[K.n] || '#EDE6D2';
        for (const c of kotaPaths[i]) if (visBB(c.bb)) ctx.fill(c.p);
      });
    }
    if (z >= 0.5) {
      const ga = Math.min(0.105, 0.04 + z * 0.011) * (1 - da);
      if (ga > 0.004) {
        ctx.strokeStyle = `rgba(32,26,20,${ga.toFixed(3)})`; ctx.lineWidth = 0.9 / z;
        for (const c of gridPath) if (visBB(c.bb)) { const gp = gridBlock(c); if (gp) ctx.stroke(gp); }
      }
    }
    ctx.strokeStyle = `rgba(32,26,20,${(0.11 * (1 - 0.85 * da)).toFixed(3)})`; ctx.lineWidth = 1 / z;
    for (const c of rings(geo.kec, 'c', oct)) if (visBB(c.bb)) ctx.stroke(c.p);
    ctx.strokeStyle = `rgba(32,26,20,${(0.30 * (1 - 0.85 * da)).toFixed(3)})`; ctx.lineWidth = 1.5 / z;
    for (const c of rings(geo.kota, 'k', oct)) if (visBB(c.bb)) ctx.stroke(c.p);
    for (const [Z, za] of das) {
      if (za <= 0) continue;
      ctx.globalAlpha = za;
      /* ground, back to front: lawn, park, wood, then the made surfaces */
      const G = Z.ground || { grass: Z.greens };
      const GC = { grass: '#D9E2C2', park: '#CFDDB4', wood: '#BACF9F',
                   pitch: '#A9CA8C', parking: '#DED7C5', water: '#BDD2D8' };
      for (const k of ['grass', 'park', 'wood', 'parking', 'pitch', 'water']) {
        if (!G[k]) continue;
        ctx.fillStyle = GC[k]; ctx.fill(G[k]);
      }
      if (G.pitch) {   // a marked field has a line around it
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.5 / z; ctx.stroke(G.pitch);
      }
      const keys = Object.keys(Z.roads).sort((a, b) => b - a);
      for (const k of keys) {
        ctx.strokeStyle = '#E6DAB9';
        ctx.lineWidth = (k / CELL) * HW * 2.2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.stroke(Z.roads[k]);
      }
      /* ── TREES ───────────────────────────────────────────────────────
         Two batched paths for the whole zone — a shade pass and a canopy pass —
         so a few thousand trees cost two fills, not four thousand. They are
         real objects at map scale, so they simply stop being drawn once a
         canopy would be under a pixel wide rather than being held at a floor:
         a forest of screen-constant blobs at city zoom would bury the map. */
      if (Z.trees && Z.trees.length) {
        const rx = 0.62, ry = 0.34;                 // world px — about a 10 m crown
        if (rx * z >= 1.15) {
          const shade2 = new Path2D(), crown = new Path2D();
          for (const t of Z.trees) {
            if (t[0] < u0 - 2 || t[0] > u1 + 2 || t[1] < v0 - 2 || t[1] > v1 + 2) continue;
            const sx2 = rx * t[2], sy2 = ry * t[2];
            shade2.moveTo(t[0] + sx2, t[1] + sy2 * 0.55);
            shade2.ellipse(t[0], t[1] + sy2 * 0.55, sx2, sy2, 0, 0, Math.PI * 2);
            crown.moveTo(t[0] + sx2 * 0.9, t[1]);
            crown.ellipse(t[0], t[1], sx2 * 0.9, sy2 * 0.9, 0, 0, Math.PI * 2);
          }
          ctx.fillStyle = '#6E8F5C'; ctx.fill(shade2);
          ctx.fillStyle = '#8FB077'; ctx.fill(crown);
        }
      }
      const occ = zoneOccupants(Z);
      /* ── SIGNAGE, NOT DECALS ───────────────────────────────────────
         The old mark was a white rounded plate with the logo laid FLAT on the
         roof, helipad-style — from an isometric angle a bright rectangle stuck
         to the geometry, reported exactly as "the logo is embed in building",
         and worst on the South Quarter cylinders where a square plate sits on a
         round roof. It was also a synthetic quad: never clipped to the roof, so
         21% of them hung off the edge, and painted after every building in the
         zone, so a rear tower's logo showed through the tower in front of it.

         A building is branded on its FACADE. The mark now goes in the wall's own
         plane, CLIPPED to that building's own silhouette, and drawn INSIDE the
         cv-ordered building loop — so anything standing nearer paints over it,
         which is the occlusion the old pass had no way to express. It is drawn
         only when the facade is wide enough to carry it legibly; where it is
         not, the coloured roof and the label do the work and no mark is drawn.
         The flat roof plate is gone entirely. */
      const sign = (b, o) => {
        const im = o.tenant ? logos[o.tenant.anchor.id] : censLogo(o.cs.c);
        if (!im || !im.complete || !im.naturalWidth) return;
        const w2 = frontWall(b);
        if (!w2) return;
        /* a chord across a curved facade does not lie on the surface, so its
           sign is smaller and sits where the curve is shallowest */
        /* A SIGN IS AN ANNOTATION, SO IT IS SIZED IN SCREEN PIXELS. Sized in
           world units it scaled with the building and effectively never cleared
           its own legibility gate — measured, two of eighty-five occupied
           buildings showed a mark, and VANTIS needed z >= 8.45. Now it asks for
           a constant ~20px and simply does not draw when the facade on screen
           is too small to hold it, which is the honest answer: zoom in and it
           appears. The roof colour is the mark that is always there. */
        const s2 = Math.min(20 / z, w2.len * 0.72, b.H * (w2.arc ? 0.42 : 0.6));
        if (s2 * z < 9) return;                     // facade too small: the roof says it instead
        const ar = (im.naturalWidth || 1) / (im.naturalHeight || 1);
        const lw = ar > 1 ? s2 : s2 * ar, lh = ar > 1 ? s2 / ar : s2;
        const drop = b.H * (w2.arc ? 0.16 : 0.11) + lh * 0.35;
        const topA = w2.av - b.H, topB = w2.av + w2.ey * w2.len - b.H;
        ctx.save();
        ctx.clip(b.walls);                          // never leaves its own building
        ctx.transform(w2.ex, w2.ey, 0, 1,
          w2.ax + w2.ex * (w2.len / 2 - lw / 2),
          (topA + topB) / 2 + w2.ey * (-lw / 2) + drop);
        ctx.drawImage(im, 0, 0, lw, lh);
        ctx.strokeStyle = shade(o.col, 0.7); ctx.lineWidth = lw * 0.05;
        ctx.strokeRect(0, 0, lw, lh);
        ctx.restore();
      };
      for (const b of Z.blds) {
        if (b.cu < u0 - 12 || b.cu > u1 + 12 || b.cv < v0 - 8 || b.cv > v1 + b.H + 8) continue;
        if (b.lm) { LANDMARK[b.lm](b); continue; }
        /* an occupied building is the company's object: same lighting model as
           every other building — walls 0.78, roof 1.22 — so it reads as part of
           the city rather than a highlight laid over it, just in its colour */
        const o = occ.get(b);
        /* THE ROOF IS THE MARK.
           Every attempt to put a logo ON a building failed the same way: a
           synthetic quad, unclipped, unlit, painted after every building in the
           zone, sized off the footprint — a sticker. And it almost never drew:
           of 129 address-pinned companies with logos, eight cleared the size
           gate at street zoom. The roof polygon has none of those problems. It
           is the real geometry, so it cannot hang off an edge or float over a
           tower standing in front; it is painted in the building's own cv order
           with the building's own lighting; it costs no asset; and it is legible
           at 4 px or 400.
           So: walls take a LIGHT tint of the sector colour — the palette is deep
           by design (ai-cloud #2e3f4e, saas #564d43) and a heavy mix produced
           near-black towers that stopped reading as buildings — and the roof
           takes the colour at full strength. Colour identifies; the label
           names; the card carries the logo. */
        const fac = o ? mixHexHex(b.fac, mixHexHex(o.col, '#ffffff', 0.46), 0.72) : b.fac;
        ctx.fillStyle = shade(fac, 0.78); ctx.fill(b.walls);
        ctx.fillStyle = o ? mixHexHex(o.col, '#ffffff', 0.12) : shade(fac, 1.22);
        ctx.fill(b.top);
        ctx.strokeStyle = o ? shade(o.col, 0.55) : 'rgba(32,26,20,.22)';
        ctx.lineWidth = (o ? 0.9 : 0.5) / z;
        ctx.stroke(b.walls); ctx.stroke(b.top);
      }
      /* ── THE CENSUS SHOWS THROUGH ──────────────────────────────────
         An occupied building can simply be behind a taller one, and then no
         amount of colour on it helps: TikTok's Gandaria 8 is 105 m with
         Gandaria Heights A and B, both 158 m, standing between it and the
         camera — measured as a 23x36 px gold sliver with nothing of it
         visible. The camera angle is fixed, so there is no view that reveals
         it. Rather than float a marker out in front and lie about where the
         building is, its roof and edges are drawn once more at half strength
         OVER the zone: a hidden company reads as a coloured ghost behind the
         tower in front of it, which is true, and a visible one barely changes.
         Occupied buildings only — this is not an x-ray of the whole city. */
      ctx.save();
      ctx.globalAlpha = za * 0.86;
      for (const [b, o] of occ) {
        if (b.cu < u0 - 12 || b.cu > u1 + 12 || b.cv < v0 - 8 || b.cv > v1 + b.H + 8) continue;
        /* the same building, same colours, redrawn at 86%: an occupied tower
           reads as itself even with something taller in front, and the 14% the
           occluder shows through is what says "this one is behind". A faint
           edge-only ghost was not enough — Gandaria 8 is 30 px wide and the
           outline vanished between the two towers covering it. */
        const fac2 = mixHexHex(b.fac, mixHexHex(o.col, '#ffffff', 0.46), 0.72);
        ctx.fillStyle = shade(fac2, 0.78); ctx.fill(b.walls);
        ctx.fillStyle = mixHexHex(o.col, '#ffffff', 0.12); ctx.fill(b.top);
        ctx.strokeStyle = shade(o.col, 0.55); ctx.lineWidth = 0.9 / z;
        ctx.stroke(b.walls); ctx.stroke(b.top);
        sign(b, o);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    /* district frames — curated zones only; the ~90 generated census zones
       would carpet the map in gold dashes */
    if (z >= 0.55) for (const [Z, za] of das) {
      if (Z.gen || !zoneInView(Z)) continue;
      ctx.globalAlpha = 1 - 0.55 * za;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6 / z;
      ctx.setLineDash([7 / z, 5 / z]);
      ctx.beginPath();
      Z.quad.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    /* the Whoosh line — under the census dots, over the ground and the zones */
    drawWhooshBase();

    /* census layer — located companies as iso ground dots (screen-constant size) */
    if (cens) {
      /* batched into one path per colour — 244 pins was 488 separate fills */
      const r = 3.1 / z, rr = 4.6 / z, m = rr + 2;
      const halos = new Path2D(), bySec = new Map();
      /* A company whose building is tinted does not also need a dot on the
         ground: the dot paints after every building, so at street zoom it
         landed pasted on the wall of the tower it is inside — the same company
         drawn three times, as a tint, a sign and a sticker. Skip the dot once
         its zone is faded in; outside a zone the dot is still the whole pin. */
      const onBld = new Set();
      for (const Z of ZONES) {
        if (!Z.blds || detailAlpha(Z) < 0.6) continue;
        for (const o of zoneOccupants(Z).values()) if (o.cs) onBld.add(o.cs);
      }
      for (const P of cens.list) {
        if (onBld.has(P)) continue;
        if (P.u < u0 - m || P.u > u1 + m || P.v < v0 - m || P.v > v1 + m) continue;
        halos.moveTo(P.u + rr, P.v);
        halos.ellipse(P.u, P.v, rr, rr * 0.62, 0, 0, Math.PI * 2);
        const k = P.c.sector_key || 'misc';
        let sp = bySec.get(k);
        if (!sp) bySec.set(k, sp = new Path2D());
        sp.moveTo(P.u + r, P.v);
        sp.ellipse(P.u, P.v, r, r * 0.62, 0, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(halos);
      for (const [k, sp] of bySec) { ctx.fillStyle = CENS_C[k] || '#6d675d'; ctx.fill(sp); }
    }
  }

  /* the live half — redrawn over the blitted base every frame */
  function dyn(w, h, das, da, actZ) {
    ctx.setTransform(z * dpr, 0, 0, z * dpr, ox * dpr, oy * dpr);
    if (cens) {
      for (const P of cens.list) { P.box = null; P.group = null; }
      if (hover && hover.pin) {
        const P = hover.pin, rr = 4.6 / z + 2.4 / z;
        ctx.strokeStyle = GOLD; ctx.lineWidth = 1.8 / z;
        ctx.beginPath(); ctx.ellipse(P.u, P.v, rr, rr * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    /* hover tile (city zoom only — inside the detail city, plots are real buildings) */
    if (da < 0.5 && hover && hover.gx !== undefined && !hover.tower) {
      const u = isoU(hover.gx + 0.5, hover.gy + 0.5), v = isoV(hover.gx + 0.5, hover.gy + 0.5);
      ctx.fillStyle = 'rgba(243,198,75,.22)'; ctx.strokeStyle = 'rgba(32,26,20,.55)'; ctx.lineWidth = 1.4 / z;
      ctx.beginPath(); ctx.moveTo(u, v - HH); ctx.lineTo(u + HW, v); ctx.lineTo(u, v + HH); ctx.lineTo(u - HW, v);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    /* towers: gold plot ring + anchor sprite (screen space).
       DECLUMP: near-neighbour tenants (Blibli↔Indosat ~300m, Vidio↔VANTIS ~900m)
       overlap at city zoom — sprite boxes push apart horizontally, resolved
       back-to-front, while the gold ring stays pinned on the real plot; a
       displaced sprite keeps a thin stem down to its ring. Hit-boxes follow
       the drawn sprite, labels stay on the true location. */
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const now = performance.now();
    const lay = [];
    /* Tenant towers are held at a screen-constant 38px floor, which is what a
       building should do inside a city and exactly wrong over an archipelago:
       zoomed out to the country they became three toys and a gold ring the
       size of West Java. In national overview nothing three-dimensional
       renders — the ground dots carry the whole layer — and the hit boxes go
       with it so a click there falls through to the dot. */
    if (natMode()) {
      for (const tw of towers) { tw.box = null; tw.lbl = null; }
      if (cens) for (const P of cens.list) { P.box = null; P.group = null; }
    }
    for (const tw of (natMode() ? [] : towers)) {
      const sx = tw.u * z + ox, sy = tw.v * z + oy;
      const s0 = sprites[tw.anchor.id];
      const img = s0 && s0.complete && s0.naturalWidth ? s0 : null;   // sprites now arrive after the map builds
      /* On PASAR a tenant tower IS the product and keeps its own generous law.
         On 1001 it is one company among 300 and must not be four times the size
         of a census object beside it — measured at z=4.6 the old law drew
         out-of-zone tenant toys at 300px next to 70px skyscrapers. */
      const cityH = IS1001 ? censH(z) * 1.12 : Math.max(38, Math.min(300, 150 * z));
      const daz = tw.zone ? detailAlpha(tw.zone) : 0;
      const hgt = cityH * (1 - daz) + 15 * z * daz;
      const wdt = img ? hgt * (img.width / img.height) : hgt;
      lay.push({ tw, sx, sy, img, daz, hgt, wdt, dx: 0 });
    }
    /* Census sprites draw at EVERY zoom. They used to be gated at z >= 2.2,
       which reads as a reasonable "street zoom" number until you measure the
       zoom the map actually opens at: fitZ is 0.12-0.19 depending on canvas
       width, so the gate sat 11-18x above the opening view — seven or eight
       clicks of the + button. Nobody arriving at /jakarta?census=1 ever saw a
       census building, which is exactly how it was reported ("i didnt see the
       gently here"). Below ZFULL the layer is thinned to one building per
       screen cell instead (see censCell); above it, behaviour is unchanged.
       The dot stays the anchor. Sprites lazy-load — a sprite draws only once
       its image has arrived. */
    if (cens && !natMode()) {
      const cw = canvas.clientWidth, ch2 = canvas.clientHeight;
      /* the toy's alpha is now the handover, computed per group below */
      /* Companies at the SAME address are one building, not a row of them.
         Grouping them the way a tenant tower groups its tenants is what stops
         four toys fanning out across a block they all share — and several of
         them genuinely are in one tower (Treasury Tower holds four). */
      const groups = new Map();
      for (const P of cens.list) {
        const sx = P.u * z + ox, sy = P.v * z + oy;
        if (sx < -120 || sx > cw + 120 || sy < -40 || sy > ch2 + 160) continue;
        let zda = 0, zb = null;
        for (const [Z, a2] of actZ) {   // only zones already faded in — not all ~93
          if (P.c.lon < Z.bb.w || P.c.lon > Z.bb.e || P.c.lat < Z.bb.s || P.c.lat > Z.bb.n) continue;
          if (a2 > zda) { zda = a2; zb = Z; }
        }
        const bld = zb && zda > 0.35 && exactPin(P.c) ? censBld(P, zb) : null;
        const key = bld || `${P.u.toFixed(2)},${P.v.toFixed(2)}`;
        let g = groups.get(key);
        if (!g) groups.set(key, g = { list: [], bld, zda, sx, sy, zb });
        g.list.push(P);
        if (zda > g.zda) { g.zda = zda; }
      }
      /* Overview thinning. 41 of the 61 sprites sit in Jakarta Selatan, so
         drawing every one of them zoomed out is a wall of toys over the core.
         Keep the best-ranked building per screen cell — standard cartographic
         decluttering, and it is self-correcting: zoom in, cells cover less
         ground, more buildings appear. An isolated company always survives
         because it owns its cell outright (Gently's nearest sprite neighbour
         is 15km away), so the thinning never hides the outliers — only the
         pile-up. Groups without a sprite are excluded first, or one could
         claim a cell and suppress a real building. */
      /* "Also at this address" belongs to the ADDRESS, not to whether a
         building happens to be painted there — so set it for every group,
         including sprite-less ones and the ones the overview thinning drops.
         Filtering first would have silently emptied that card row. */
      for (const g of groups.values()) {
        g.list.sort((a, b) => (a.c.rank || 1e9) - (b.c.rank || 1e9));
        /* "Also at this address" belongs to EVERY company at the address, not
           just to whichever one happens to carry the drawn object. It used to
           be written onto the lead alone, so clicking the neighbour's own dot a
           few pixels away showed an empty row for the same building. */
        const all = g.list.map((P) => P.c);
        if (all.length > 1) for (const P of g.list) P.group = all;
      }
      let gsList = [...groups.values()].filter((g) => g.list.some((P) => P.c.sprite));
      if (z < ZFULL) {
        const cell = 78, keep = new Map();
        const bestRank = (g) => Math.min(...g.list.filter((P) => P.c.sprite).map((P) => P.c.rank || 1e9));
        for (const g of gsList) {
          const k = `${Math.round(g.sx / cell)},${Math.round(g.sy / cell)}`;
          const cur = keep.get(k);
          if (!cur || bestRank(g) < bestRank(cur)) keep.set(k, g);
        }
        gsList = [...keep.values()];
      }
      for (const g of gsList) {
        const lead = g.list.find((P) => P.c.sprite) || g.list[0];
        if (!lead.c.sprite) continue;
        if (!lead.img) { lead.img = new Image(); lead.img.decoding = 'async'; lead.img.onload = draw; lead.img.src = lead.c.sprite; }
        if (!lead.img.complete || !lead.img.naturalWidth) continue;
        const zda = g.zda;
        /* THE TOY IS A SYMBOL, AND IT HANDS OVER.
           The art is a five-storey block; nothing makes it a 250 m tower, so it
           was never going to be a scale model and the old code did not try —
           it clamped to 40..96 px for a tall building and 34..120 px for a
           short one. Measured in SCBD at z=4.6 that drew EVERY census toy at
           exactly 96 px, whether the real building was 28 m (10 px on screen,
           9.6x oversized) or 280 m (96 px, and the toy stood in front of it).

           So the toy keeps one job: to be the map symbol while there is no real
           city to be out of proportion with. As a detail zone fades in, the toy
           fades out and the real building — tinted, signed, see zoneOccupants —
           becomes the company's object. A company whose pin is not precise
           enough to claim a building fades to its ground dot, which is the
           honest picture: we know the street, not the door. */
        const ax = g.bld ? g.bld.cu * z + ox : g.sx;
        const ay = g.bld ? g.bld.cv * z + oy : g.sy;
        const hgt = censH(z);
        /* handover: full toy outside a detail zone, gone once the ground under
           it is real. Squared so the toy is still solid through the first half
           of the fade and clears quickly at the end. */
        const hand = (1 - zda) * (1 - zda);
        if (hand < 0.02) continue;
        /* and nothing gets painted over a building that stands in front of it */
        if (g.zb && zda > 0.35 && censHidden(g.zb, (ax - ox) / z, (ay - oy) / z, hgt / z)) continue;
        lay.push({ cs: lead, tw: null, sx: ax, sy: ay, img: lead.img, daz: 0, hgt,
          wdt: hgt * (lead.img.width / lead.img.height), dx: 0, ca: hand, bld: g.bld,
          zda, n: g.list.length });
      }
    }
    lay.sort((a, b) => a.sy - b.sy); // back-to-front painter order
    const spr = [];
    for (const L of [...lay.filter((x) => !x.cs), ...lay.filter((x) => x.cs)]) { // tenants claim space first
      if (!L.img || L.daz >= 0.92) continue;
      const w2 = L.wdt * 0.92, top = L.sy + HH * z * 0.6 - L.hgt;
      for (let pass = 0; pass < 4; pass++) {
        const c = L.sx + L.dx;
        const hit = spr.find((P) => Math.abs(c - P.x) < (w2 + P.w) / 2 && Math.abs(top - P.top) < (L.hgt + P.h) * 0.5);
        if (!hit) break;
        const need = (w2 + hit.w) / 2 - Math.abs(c - hit.x) + 6;
        L.dx += (c >= hit.x ? 1 : -1) * need;
      }
      /* The push-apart exists for near-neighbours nudging past each other, not
         for relocation. On a phone at fit zoom the whole core lands on one
         point, and uncapped relaxation fanned every toy shoulder-to-shoulder
         across the entire island — buildings standing whole kabupaten from
         their address. A sprite that would move more than ~2 of its own widths
         is dropped instead: its dot (census) or gold ring + label (tenant)
         stays on the truth, and zooming in brings the building back. */
      if (Math.abs(L.dx) > Math.max(64, w2 * 1.9)) { L.drop = true; continue; }
      spr.push({ x: L.sx + L.dx, top, w: w2, h: L.hgt });
    }
    for (const L of lay) {
      if (L.cs) {
        const bx = L.sx + L.dx, y0 = L.sy + HH * z * 0.6 - L.hgt;
        /* the plot ring sits on the REAL footprint — sector-coloured, so it
           never reads as a gold tenant plot — and the stem ties a displaced
           sprite back to it */
        if (L.bld) {
          const rx = Math.max(11, (L.bld.spanU || 3) * z * 1.15);
          const cx0 = L.bld.cu * z + ox, cy0 = L.bld.cv * z + oy;
          ctx.strokeStyle = CENS_C[L.cs.c.sector_key] || '#6d675d';
          ctx.globalAlpha = L.ca * 0.75; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(cx0, cy0, rx, rx / 2, 0, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha = 1;
        }
        if (L.drop) {            // couldn't stand near its plot — the dot is the pin
          L.cs.box = null;
          continue;
        }
        if (Math.abs(L.dx) > 6) {
          ctx.strokeStyle = 'rgba(32,26,20,.26)'; ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(L.sx, L.sy); ctx.lineTo(bx, y0 + L.hgt - 2); ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = L.ca * 0.96;
        ctx.drawImage(mip(L.img, L.hgt), bx - L.wdt / 2, y0, L.wdt, L.hgt);
        ctx.globalAlpha = 1;
        if (L.n > 1) {   // one building, several companies — say so instead of fanning them out
          mono(9, 'rgba(32,26,20,.66)');
          halo('+' + (L.n - 1), bx, y0 + L.hgt + 7);
        }
        L.cs.box = [bx - L.wdt / 2, y0, L.wdt, L.hgt];
        continue;
      }
      const { tw, sx, sy, img, daz, hgt, wdt } = L;
      const pulse = 1 + 0.05 * Math.sin(now / 650);
      let rx0 = Math.max(22, wdt * 0.54);
      if (tw.bld && daz > 0) rx0 = rx0 * (1 - daz) + Math.max(26, tw.bld.spanU * z * 1.2) * daz;
      const rx = rx0 * pulse;
      const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, rx);
      g.addColorStop(0, 'rgba(243,198,75,.34)'); g.addColorStop(1, 'rgba(243,198,75,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.ellipse(sx, sy, rx, rx / 2, 0, 0, Math.PI * 2); ctx.stroke();
      /* The toy used to be cut off entirely at daz >= 0.92, so at full street
         zoom a tenant was a bare gold ring — "vantis not appears in the 3d when
         it zoomed". It now fades the whole way and hands over to its building,
         which zoneOccupants() tints and signs. */
      if (img && daz < 0.995 && !L.drop) {   // dropped toy: the gold ring stays the pin
        const bx = sx + L.dx;
        const y0 = sy + HH * z * 0.6 - hgt;
        if (Math.abs(L.dx) > 6) {
          ctx.strokeStyle = 'rgba(32,26,20,.32)'; ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx, y0 + hgt - 2); ctx.stroke();
          ctx.setLineDash([]);
        }
        const grow = hover && hover.tower === tw ? 1.045 : 1;
        ctx.globalAlpha = 1 - daz;
        ctx.drawImage(mip(img, hgt * grow), bx - (wdt * grow) / 2, y0 - hgt * (grow - 1), wdt * grow, hgt * grow);
        ctx.globalAlpha = 1;
        tw.box = [bx - wdt / 2, y0, wdt, hgt];
      } else tw.box = null;
      if (z >= 1.3) {
        const extra = tw.tenants.length > 1 ? ` +${tw.tenants.length - 1}` : '';
        /* anchored to the BUILDING once one is bound: the plot ring sits on the
           ground in front, so the label pointed at the plaza while the tinted
           tower it names stood behind. And name the ANCHOR — the tenant whose
           sprite, facade sign and card this tower carries — not tenants[0],
           which is only the same person by luck of file order. */
        const lb = tw.bld && detailAlpha(tw.zone) > 0.5;
        tw.lbl = [tw.name.toUpperCase() + ' · ' + tw.anchor.name + extra,
          lb ? tw.bld.cu * z + ox : sx,
          lb ? (tw.bld.cv - tw.bld.H) * z + oy - 11 : sy + rx0 / 2 + 14];
      } else tw.lbl = null;
    }

    /* the Whoosh trains, over the city, under the labels */
    drawWhooshDyn(now);

    /* labels — screen space. Culled off-screen first: 145 kecamatan + ~93 zone
       labels are shaped, stroked and filled twice each, and once you are zoomed
       in almost none of them land on the canvas. */
    const onCanvas = (sx2, sy2) => sx2 > -140 && sx2 < w + 140 && sy2 > -20 && sy2 < h + 20;
    if (z < 3.2 && !natMode()) for (const L of kotaLabels) {
      const sx2 = L.u * z + ox, sy2 = L.v * z + oy;
      if (!onCanvas(sx2, sy2)) continue;
      mono(12, 'rgba(32,26,20,.55)');
      halo(L.n.toUpperCase(), sx2, sy2);
    }
    /* Zone invites are chosen before the kecamatan pass so that pass can skip
       any name about to be printed in gold. 87 generated zones collapse onto
       far fewer kecamatan names -- PASAR MINGGU alone covers seven, SETIABUDI
       six -- so one label per ZONE stamps the same word across the map, and in
       the 1.05-1.7 band the grey kecamatan label printed it a third time. One
       label per NAME, the copy nearest the middle of the view, collision-culled. */
    const goldZone = [], goldNames = new Set();
    if (z >= 0.55 && z < 1.7) {
      const cx = w / 2, cy = h / 2, cand = [];
      for (const Z of ZONES) {
        const sx2 = Z.iso[0] * z + ox, sy2 = Z.quad[0][1] * z + oy - 12;
        if (!onCanvas(sx2, sy2)) continue;
        cand.push({ n: Z.name, sx2, sy2, d: Math.hypot(sx2 - cx, sy2 - cy) });
      }
      cand.sort((a, b) => a.d - b.d);
      for (const c of cand) {
        if (goldNames.has(c.n)) continue;
        if (goldZone.some((g) => Math.abs(g.sx2 - c.sx2) < 124 && Math.abs(g.sy2 - c.sy2) < 20)) continue;
        goldNames.add(c.n);
        goldZone.push(c);
      }
    }
    if (z >= 1.05 && z < 4.4) for (const L of kecLabels) {
      const n = L.n.toUpperCase();
      if (goldNames.has(n)) continue;          // already said, in gold, right there
      const sx2 = L.u * z + ox, sy2 = L.v * z + oy + 12;
      if (!onCanvas(sx2, sy2)) continue;
      mono(9, 'rgba(32,26,20,.34)');
      halo(n, sx2, sy2);
    }
    for (const [Z, za] of das) {
      if (za <= 0.5) continue;
      const placed = [];
      const cap = z >= 7 ? 26 : z >= 5.6 ? 16 : 8;
      const occ = zoneOccupants(Z);
      /* WHOSE BUILDING IS THIS. Colour says a building is in the census; only
         a name says which company, and until now a census-occupied building
         had no label at all — you had to hover it. That is survivable for a
         tower that dominates its block and useless for one that does not:
         TikTok's Gandaria 8 is 105 m and 23x36 px on screen with Gandaria
         Heights A and B, both 158 m, painted in front of it. Measured, that is
         a gold sliver behind a taller grey tower, which is exactly "tiktok
         seems not visible here".
         Labels are drawn in dyn(), over all geometry, so a name cannot be
         occluded the way the building can. Company labels are placed FIRST and
         claim their space, so a plain OSM building name can never crowd one
         out; and an occupied building drops its OSM name entirely, or the same
         tower would print twice. */
      /* per-frame, not a property: `b.lbld` stamped on the building stayed true
         forever, so the first frame a company label won its space suppressed
         that building's OSM name for the rest of the session even when the
         company label was later culled */
      const named = new Set();
      const occLbl = [];
      for (const [b, o] of occ) {
        const sx2 = b.cu * z + ox, sy2 = (b.cv - b.H) * z + oy - 11;
        if (!onCanvas(sx2, sy2)) continue;
        occLbl.push({ b, o, sx2, sy2, rank: o.rank });
      }
      occLbl.sort((a, b2) => a.rank - b2.rank);
      for (const L of occLbl) {
        if (placed.length >= cap) break;
        if (placed.some((p) => Math.abs(p[0] - L.sx2) < 108 && Math.abs(p[1] - L.sy2) < 20)) continue;
        placed.push([L.sx2, L.sy2]);
        named.add(L.b);
        if (L.o.tenant) continue;              // the tower label below names it
        mono(9.5, shade(L.o.col, 0.72));
        halo(L.o.label, L.sx2, L.sy2);
      }
      for (const b of Z.labels) {
        if (placed.length >= cap) break;
        if (named.has(b)) continue;            // its company already named it
        if (towers.some((tw) => Math.hypot(tw.u - b.cu, tw.v - b.cv) < 6)) continue;
        const sx2 = b.cu * z + ox, sy2 = (b.cv - b.H) * z + oy - 10;
        if (placed.some((p) => Math.abs(p[0] - sx2) < 108 && Math.abs(p[1] - sy2) < 22)) continue;
        placed.push([sx2, sy2]);
        mono(8.5, `rgba(32,26,20,${(0.5 * za).toFixed(2)})`);
        halo(b.n.toUpperCase(), sx2, sy2);
      }
    }
    for (const g of goldZone) {
      mono(10.5, GOLD_DEEP);
      halo(g.n, g.sx2, g.sy2);
    }
    /* tower labels last — their halo masks colliding district labels */
    for (const tw of towers) {
      if (!tw.lbl) continue;
      mono(9.5, 'rgba(32,26,20,.62)');
      halo(tw.lbl[0], tw.lbl[1], tw.lbl[2]);
    }
    /* the pulse loop only runs while a plot ring is actually on screen */
    pulseLive = towers.some((tw) => {
      const sx2 = tw.u * z + ox, sy2 = tw.v * z + oy;
      return sx2 > -160 && sx2 < w + 160 && sy2 > -320 && sy2 < h + 160;
    });
  }
  /* A STADIUM IS A BOWL, NOT A BOX.
     GBK's main stadium carries `leisure=stadium` and no building tag, so the
     zone fetcher walked past it and the largest structure in Senayan rendered
     as lawn. Now that its 124-point outline arrives, an extruded box would be
     just as wrong: the shape a reader recognises is the ring — an outer wall,
     a raked seating bowl inside it, a roof lip over the stand, and the pitch
     at the bottom. All four come off the real footprint, so the outline is
     OSM's and only the depth is drawn. */
  function drawStadium(b) {
    const H = b.H;
    /* the footprint, scaled about its own centre — the bowl's inner rings */
    const ring = (f, dv) => {
      const p = new Path2D();
      b.pts.forEach((pt, i) => {
        const x = b.cu + (pt[0] - b.cu) * f, y = b.cv + (pt[1] - b.cv) * f + dv;
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      });
      p.closePath();
      return p;
    };
    /* A cool grey rake read as water in the bowl — the first pass looked like
       four swimming pools. Warm taupe seats against the white roof ring and a
       green pitch is what a stadium looks like from above. */
    const OUT = '#CFC6B2', RIM = '#F1ECDE', SEAT = '#A8968C', PITCH = '#7FA86B';
    /* outer wall: the facade, lifted to the roof lip */
    ctx.fillStyle = shade(OUT, 0.74); ctx.fill(b.walls);
    ctx.strokeStyle = 'rgba(32,26,20,.26)'; ctx.lineWidth = 0.5 / z; ctx.stroke(b.walls);
    /* the roof lip — a flat annulus at the top, drawn as the full top face with
       the seating bowl punched into it by the rings below */
    ctx.fillStyle = RIM; ctx.fill(b.top);
    ctx.strokeStyle = 'rgba(32,26,20,.22)'; ctx.stroke(b.top);
    /* the rake: two inset rings stepping DOWN from the lip into the bowl */
    ctx.fillStyle = shade(SEAT, 1.08); ctx.fill(ring(0.82, -H * 0.86));
    ctx.fillStyle = shade(SEAT, 0.86); ctx.fill(ring(0.63, -H * 0.60));
    /* the pitch, near the bottom of the bowl — the first pass floated it a
       third of the way up and the rake read as a shallow dish */
    const floor = ring(0.46, -H * 0.14);
    ctx.fillStyle = PITCH; ctx.fill(floor);
    ctx.strokeStyle = 'rgba(32,26,20,.18)'; ctx.lineWidth = 0.4 / z;
    ctx.stroke(floor);
  }

  function drawMonas(b) {
    const u = b.cu, H = b.H;
    const W = Math.max(2.4, Math.min(b.mw || 3, H * 0.55));
    const face = (pts, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(32,26,20,.22)'; ctx.lineWidth = 0.45 / z; ctx.stroke();
    };
    const blockM = (vb, wb, wt, h, cols) => {
      const vt = vb - h;
      face([[u + wb, vb], [u, vb + wb / 2], [u, vt + wt / 2], [u + wt, vt]], cols[0]);
      face([[u, vb + wb / 2], [u - wb, vb], [u - wt, vt], [u, vt + wt / 2]], cols[2]);
      face([[u, vt - wt / 2], [u + wt, vt], [u, vt + wt / 2], [u - wt, vt]], cols[1]);
      return vt;
    };
    const stone = ['#D9D2C1', '#EDE7D8', '#C3BBAA'];
    const marble = ['#E4DECF', '#F3EEE2', '#CFC8B7'];
    let v = b.cv;
    v = blockM(v, W * 0.95, W * 0.95, H * 0.05, stone);        // pelataran
    v = blockM(v, W * 0.60, W * 0.60, H * 0.04, stone);        // museum terrace
    v = blockM(v, W * 0.20, W * 0.46, H * 0.10, marble);       // the goblet (cawan)
    v = blockM(v, W * 0.50, W * 0.50, H * 0.02, stone);        // goblet rim
    v = blockM(v, W * 0.125, W * 0.115, H * 0.62, marble);     // obelisk shaft
    v = blockM(v, W * 0.20, W * 0.17, H * 0.05, stone);        // viewing deck
    v = blockM(v, W * 0.10, W * 0.06, H * 0.02, marble);       // tip
    /* lidah api — the gold flame */
    const wf = W * 0.11, hf = H * 0.11;
    const flame = (fw, fh, col) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(u - fw, v);
      ctx.quadraticCurveTo(u - fw * 0.95, v - fh * 0.5, u, v - fh);
      ctx.quadraticCurveTo(u + fw * 0.95, v - fh * 0.5, u + fw, v);
      ctx.quadraticCurveTo(u, v + fw * 0.45, u - fw, v);
      ctx.closePath(); ctx.fill();
    };
    ctx.save();
    ctx.shadowColor = 'rgba(243,198,75,.75)'; ctx.shadowBlur = 8;
    flame(wf, hf, '#E2A41C');
    ctx.shadowBlur = 0;
    flame(wf * 0.6, hf * 0.72, '#F6C94F');
    ctx.restore();
  }
  /* the registry the building loop dispatches through */
  const LANDMARK = { monas: drawMonas, stadium: drawStadium };
  /* Sprite mips. A tenant sprite is a 512px render drawn at 38px on a phone at
     city zoom, and drawImage re-filters the whole bitmap on every frame it is
     painted. Keep a pre-scaled copy per size step instead: the filtering
     happens once and the per-frame draw becomes a 1:1 blit. */
  const mips = new WeakMap();
  function mip(img, hgt) {
    const want = hgt * dpr;
    if (!img.naturalHeight || want > img.naturalHeight * 0.8) return img;
    const step = Math.max(12, Math.round(Math.pow(1.2, Math.ceil(Math.log(want) / Math.log(1.2)))));
    let m = mips.get(img);
    if (!m) mips.set(img, m = new Map());
    let c = m.get(step);
    if (!c) {
      c = document.createElement('canvas');
      c.height = step;
      c.width = Math.max(1, Math.round(step * (img.naturalWidth / img.naturalHeight)));
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, c.width, c.height);
      m.set(step, c);
      if (m.size > 5) m.delete(m.keys().next().value);
    }
    return c;
  }
  function mono(px, color) {
    ctx.font = `500 ${px}px 'IBM Plex Mono', ui-monospace, monospace`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0.09em';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  }
  function halo(text, x, y) {
    ctx.strokeStyle = 'rgba(246,239,223,.88)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y);
  }

  /* ── hit tests ───────────────────────────────────────────────── */
  function cellAt(px, py) {
    const [u, v] = toWorld(px, py);
    const gx = Math.floor((u / HW + v / HH) / 2), gy = Math.floor((v / HH - u / HW) / 2);
    if (gx < 0 || gy < 0 || gx >= nx || gy >= ny || kotaCells[gy * nx + gx] < 0) return null;
    return { gx, gy };
  }
  function towerAt(px, py) {
    for (const tw of towers) {
      if (tw.box && px >= tw.box[0] && px <= tw.box[0] + tw.box[2] && py >= tw.box[1] && py <= tw.box[1] + tw.box[3]) return tw;
    }
    return null;
  }
  function detailBldAt(px, py) {
    const [u, v] = toWorld(px, py);
    viewBox();                    // hit-tests can run between a transform change and its paint
    for (const Z of ZONES) {
      if (detailAlpha(Z) < 0.4) continue;
      const occ = zoneOccupants(Z);
      for (let i = Z.blds.length - 1; i >= 0; i--) {
        const b = Z.blds[i];
        /* an OCCUPIED building is clickable whether or not OSM named it: it is
           the company's object now, and its toy has faded out, so if this test
           skipped it the company would be unreachable at street zoom */
        const o = occ.get(b);
        if (!b.n && !o) continue;
        if (Math.abs(u - b.cu) > 14 || v < b.cv - b.H - 4 || v > b.cv + 6) continue;
        /* An extrusion is the footprint translated up-screen by H, so a point on
           the facade at height fraction t sits over footprint point (u, v+t*H).
           The old test sampled only t=0 and t=1 — the ground and the roof — so
           the whole wall band of a tall tower was dead to the cursor. That was
           survivable while a toy carried the click; now the BUILDING is the
           company's object and its facade has to be hittable. */
        let hit = false;
        for (let t = 0; t <= 1.0001 && !hit; t += 0.25) hit = inside(u, v + t * b.H, b.pts);
        if (hit) { b.occ = o || null; return b; }
      }
    }
    return null;
  }
  const zoneAt = (lon, lat) => ZONES.find((Z) => lon >= Z.bb.w && lon <= Z.bb.e && lat >= Z.bb.s && lat <= Z.bb.n) || null;
  function pinAt(px, py) {
    if (!cens) return null;
    for (let i = cens.list.length - 1; i >= 0; i--) {
      const P = cens.list[i];
      if (P.box && px >= P.box[0] && px <= P.box[0] + P.box[2] && py >= P.box[1] && py <= P.box[1] + P.box[3]) return P;
    }
    const [u, v] = toWorld(px, py);
    let best = null, bd = 81; // 9px screen radius, squared
    for (const P of cens.list) {
      const dx = (P.u - u) * z, dy = (P.v - v) * z;
      const d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = P; }
    }
    return best;
  }

  /* ── interaction ─────────────────────────────────────────────── */
  let dragging = false, moved = 0, lx = 0, ly = 0, pinch = null;
  const pointers = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pointers.size === 2) {
      const ps = [...pointers.values()];
      pinch = { d: Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]), z };
    } else { dragging = true; moved = 0; lx = e.offsetX; ly = e.offsetY; }
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (pinch && pointers.size === 2) {
      const ps = [...pointers.values()];
      const d = Math.hypot(ps[0][0] - ps[1][0], ps[0][1] - ps[1][1]);
      const cx = (ps[0][0] + ps[1][0]) / 2, cy = (ps[0][1] + ps[1][1]) / 2;
      zoomTo(clampZ(pinch.z * (d / pinch.d)), cx, cy);
      return;
    }
    if (dragging) {
      const dx = e.offsetX - lx, dy = e.offsetY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      ox += dx; oy += dy; lx = e.offsetX; ly = e.offsetY;
      draw();
      return;
    }
    let tw = towerAt(e.offsetX, e.offsetY);
    let db = tw ? null : detailBldAt(e.offsetX, e.offsetY);
    if (db && db.tw) { tw = db.tw; db = null; }
    /* hovering an occupied building names its COMPANY — the building is the
       company's object, so the tooltip must agree with what a click will do */
    let occPin = null;
    if (db && db.occ && db.occ.cs) { occPin = db.occ.cs; db = null; }
    const wh = tw || db || occPin ? null : whooshHit(e.offsetX, e.offsetY);
    const pin = occPin || (tw || db || wh ? null : pinAt(e.offsetX, e.offsetY));
    const c = tw || db || wh || pin ? null : cellAt(e.offsetX, e.offsetY);
    hover = tw ? { tower: tw } : wh ? { wh } : pin ? { pin } : c;
    canvas.style.cursor = tw || db || pin || wh ? 'pointer' : 'grab';
    if (tw) {
      const bx = tw.box || [tw.u * z + ox - 40, (tw.bld ? (tw.bld.cv - tw.bld.H) * z + oy : tw.v * z + oy) - 8, 80, 8];
      tip.style.display = 'block';
      tip.style.left = (bx[0] + bx[2] / 2) + 'px';
      tip.style.top = bx[1] + 'px';
      tip.innerHTML = `${esc(tw.name)}<span class="d">${esc(tw.tenants.map((t) => t.name).join(' · '))}</span>`;
    } else if (db) {
      tip.style.display = 'block';
      tip.style.left = (db.cu * z + ox) + 'px';
      tip.style.top = ((db.cv - db.H) * z + oy - 6) + 'px';
      tip.innerHTML = `${esc(db.n)}<span class="d">${db.h} m</span>`;
    } else if (wh) {
      tip.style.display = 'block';
      if (wh.st) {
        tip.style.left = (wh.st.u * z + ox) + 'px';
        tip.style.top = (wh.st.v * z + oy - 10) + 'px';
        tip.innerHTML = `${esc(wh.st.n)}<span class="d">Whoosh station</span>`;
      } else {
        const b = wh.train;
        tip.style.left = (b[0] + b[2] / 2) + 'px';
        tip.style.top = b[1] + 'px';
        const near = whooshNearest(b[5]);
        tip.innerHTML = `WHOOSH<span class="d">${b[4] > 0 ? 'toward Bandung' : b[4] < 0 ? 'toward Jakarta' : 'at ' + esc(near ? near.n : 'the platform')}</span>`;
      }
    } else if (pin) {
      tip.style.display = 'block';
      tip.style.left = (pin.u * z + ox) + 'px';
      tip.style.top = (pin.v * z + oy - 10) + 'px';
      tip.innerHTML = `${esc(pin.c.name)}<span class="d">${esc(pin.c.sector_label || '')}${pin.c.kota ? ' · ' + esc(pin.c.kota) : ''}</span>`;
    } else tip.style.display = 'none';
    draw();
  });
  canvas.addEventListener('pointerup', (e) => {
    pointers.delete(e.pointerId); pinch = null;
    canvas.classList.remove('drag');
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

  function click(px, py) {
    let tw = towerAt(px, py);
    const db = tw ? null : detailBldAt(px, py);
    if (db && db.tw) tw = db.tw;
    if (tw) { openTower(tw); return; }
    /* the building IS the company: clicking it opens the company, not the
       building's OSM name card */
    if (db && db.occ && db.occ.cs) { openPin(db.occ.cs); return; }
    if (db && db.n) { openBuilding(db); return; }
    const wh = whooshHit(px, py);
    if (wh) { openWhoosh(wh); return; }
    const pin = pinAt(px, py);
    if (pin) { openPin(pin); return; }
    const c = cellAt(px, py);
    if (!c) { panel.style.display = 'none'; return; }
    const lon = geo.bbox.w + ((c.gx + 0.5) * CELL) / MX;
    const lat = geo.bbox.n - ((c.gy + 0.5) * CELL) / MZ;
    const Zc = zoneAt(lon, lat);
    if (Zc && z < Zc.zFull) { loadDetail(Zc); flyTo(Zc.iso[0], Zc.iso[1], 4.6); return; }
    if (ZONES.some((Z) => detailAlpha(Z) >= 0.5)) { panel.style.display = 'none'; return; }
    if (z < 1.6) {
      const ki = regionAt(lon, lat, geo.kec);
      if (ki >= 0) { flyToKec(geo.kec[ki]); return; }
    }
    const ki = regionAt(lon, lat, geo.kec);
    openPlot(ki >= 0 ? geo.kec[ki] : null);
  }

  /* ── panels ──────────────────────────────────────────────────── */
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  function openTower(tw) {
    const a = tw.anchor;
    const rest = tw.tenants.filter((t) => t !== a);
    /* the census record folded into this tower (see loadCensus) — its pin is
       gone, so the numbers it carried live here */
    const ct = tw.tenants.find((t) => t.cens) || null;
    const cs = ct && ct.cens;
    panel.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      ${a.portrait ? `<img class="bld" src="${esc(a.portrait)}" alt="${esc(a.name)} building">` : ''}
      <h3>${esc(tw.name)}</h3>
      <div class="cat">${esc(a.area.replace(tw.name, '').replace(/^\s*·\s*/, ''))} · ${esc(tw.kota || 'Jakarta')}</div>
      <div class="occ"><b>${esc(a.name)}</b><span class="tag">${esc(a.tag)}${a.floor ? ' — ' + esc(a.floor) : ''}</span>
        <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.url.replace(/^https?:\/\//, ''))} ↗</a></div>
      ${rest.map((t) => `<div class="occ"><b>${esc(t.name)}</b><span class="tag">${esc(t.tag)}</span>
        <a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.url.replace(/^https?:\/\//, ''))} ↗</a></div>`).join('')}
      ${cs ? `<div class="div"></div>
      <div class="cat">${cs.name === ct.name ? '' : esc(cs.name) + ' · '}${esc(cs.sector_label || '')} · census #${cs.rank}</div>
      ${censusRows(cs)}` : ''}
      <div class="row">
        <a class="btn primary" href="${esc(a.url)}" target="_blank" rel="noopener">Visit ${esc(a.name)} ↗</a>
        ${IS1001
    ? (cs ? `<a class="btn" href="${LPFX}/company/${encodeURIComponent(cs.id)}">Census profile</a>` : `<a class="btn" href="${LPFX}/#companies">The census</a>`)
    : (cs ? '<a class="btn" href="/census">Full census</a>' : '<a class="btn" href="/scbd">Drive 3D</a>')}
      </div>`;
    wire();
  }
  const LM_CARD = {
    monas: { t: 'Monumen Nasional', c: '132 m · Gambir · Jakarta Pusat',
             p: 'The flame of independence, at the centre of the field. Not for rent.' },
    stadium: { t: null, c: null,
               p: 'A stadium of the Gelora Bung Karno complex — drawn from its real outline, as a bowl rather than a box.' },
  };
  function openBuilding(b) {
    if (b.lm) {
      const L = LM_CARD[b.lm] || {};
      panel.innerHTML = `
        <button class="x" aria-label="Close">×</button>
        <h3>${esc(L.t || b.n || 'Landmark')}</h3>
        <div class="cat">${esc(L.c || `${b.h} m · a landmark of this district`)}</div>
        <p>${esc(L.p || '')}</p>`;
      wire();
      return;
    }
    panel.innerHTML = IS1001 ? `
      <button class="x" aria-label="Close">×</button>
      <h3>${esc(b.n)}</h3>
      <div class="cat">${b.h} m · a real tower of this district</div>
      <p>No census company is pinned to this building.</p>` : `
      <button class="x" aria-label="Close">×</button>
      <h3>${esc(b.n)}</h3>
      <div class="cat">${b.h} m · a real tower of this district</div>
      <p>No tenant on PASAR yet — a future address for startups.</p>
      <div class="row"><a class="btn primary" href="/claim">Claim your plot</a><a class="btn" href="/scbd">Drive 3D</a></div>`;
    wire();
  }
  function openKec(K) {
    if (IS1001) {
      /* census companies standing in this kecamatan: pins by point-in-polygon,
         plus the ones folded into tenant towers (tw.kec is already computed) */
      const pins = cens ? cens.list.filter((P) => regionAt(P.c.lon, P.c.lat, [K]) === 0).length : 0;
      const merged = towers.filter((tw) => tw.kec === K.n)
        .reduce((s, tw) => s + tw.tenants.filter((t) => t.cens).length, 0);
      const cn = pins + merged;
      panel.innerHTML = `
        <button class="x" aria-label="Close">×</button>
        <h3>${esc(K.n)}</h3>
        <div class="cat">Kecamatan · ${esc(K.k || 'Jakarta')}</div>
        <p>${cn ? `${cn} census compan${cn > 1 ? 'ies stand' : 'y stands'} in this district.`
          : 'No census company located in this district.'}</p>
        <div class="row"><a class="btn primary" href="${LPFX}/#companies">Browse the census</a></div>`;
      wire();
      return;
    }
    const count = towers.filter((tw) => tw.kec === K.n).length;
    panel.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <h3>${esc(K.n)}</h3>
      <div class="cat">Kecamatan · ${esc(K.k || 'Jakarta')}</div>
      <p>${count ? `${count} tower${count > 1 ? 's' : ''} with tenants here.` : 'No tenants in this district yet — the plots are open.'}</p>
      <div class="row"><a class="btn primary" href="/claim">Claim your plot</a></div>`;
    wire();
  }
  function openPlot(kec) {
    if (IS1001) {
      panel.innerHTML = `
        <button class="x" aria-label="Close">×</button>
        <h3>Open ground</h3>
        <div class="cat">${kec ? esc(kec.n) + ' · ' + esc(kec.k || '') : 'Jakarta'}</div>
        <p>No census company on this tile — every company stands at its real address.</p>
        <div class="row"><a class="btn primary" href="${LPFX}/#companies">Browse the census</a></div>`;
      wire();
      return;
    }
    panel.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <h3>Open plot</h3>
      <div class="cat">${kec ? esc(kec.n) + ' · ' + esc(kec.k || '') : 'Jakarta'}</div>
      <p>No tenant on this tile yet. Claim a PASAR profile and your startup gets a building in the city.</p>
      <div class="row"><a class="btn primary" href="/claim">Claim your plot</a></div>`;
    wire();
  }
  const num = (x, d) => (x === null || x === undefined) ? '—' : x.toLocaleString('en-US', { maximumFractionDigits: d || 0 });
  /* US$ millions need scaled precision, not integers: at maximumFractionDigits 0
     a US$2.5M seed printed as "US$ 3 M", overstating a sourced figure by half a
     million. Same rule as the money() helper on the 1001 landing page. */
  const usdM = (n) => (n === null || n === undefined) ? '—'
    : n >= 10 ? num(n, Number.isInteger(n) ? 0 : 1) : n >= 1 ? num(n, 1) : num(n, 2);
  /* cut long notes on a word boundary — a hard slice ended cards mid-word
     ("led by Northstar Gr") */
  const clip = (t, n) => {
    const s = String(t);
    if (s.length <= n) return s;
    const cut = s.slice(0, n);
    const sp = cut.lastIndexOf(' ');
    return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,—-]+$/, '') + '…';
  };
  /* The census facts, written once. A tenant that is also a census company no
     longer has a pin of its own to click, so its tower card carries these —
     from the same source as the pin card, so the two can never drift. */
  const censusRows = (c) => `
      <div class="occ"><b>Funding</b><span class="tag">${c.funding_total_usd_m == null
        ? 'No disclosed figure' + (c.last_round ? ' — ' + esc(clip(c.last_round, 44)) : '')
        : 'US$ ' + usdM(c.funding_total_usd_m) + ' M disclosed' + (c.last_round ? ' — ' + esc(clip(c.last_round, 44)) : '')}</span></div>
      <div class="occ"><b>Valuation</b><span class="tag">${c.valuation_usd_m == null
        ? (c.valuation_note ? esc(clip(c.valuation_note, 72)) : 'No public mark')
        : 'US$ ' + usdM(c.valuation_usd_m) + ' M' + (c.valuation_note ? ' — ' + esc(clip(c.valuation_note, 60)) : '')}</span></div>
      <div class="occ"><b>Jobs · output</b><span class="tag">${c.employees_est == null
        ? 'No headcount on record'
        : num(c.employees_est) + ' jobs est · IDR ' + num(c.est_gva_idr_bn, 1) + ' bn/yr GVA est'}</span></div>`;
  function openPin(P) {
    const c = P.c;
    panel.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <h3>${esc(c.name)}</h3>
      <div class="cat">${esc(c.sector_label || '')} · ${esc(c.kota || 'Jakarta')} · census #${c.rank}</div>
      ${censusRows(c)}
      <div class="occ"><b>On the map</b><span class="tag">${exactPin(c)
        ? 'Standing on its own address' + (P.bld && P.bld.n ? ' — ' + esc(P.bld.n) : '')
        : c.pin_kind === 'street' ? 'Placed on its street — the exact building is not pinned yet'
        : 'Approximate — pinned to the district, not the building'}</span></div>
      ${P.group && P.group.length > 1 ? `<div class="occ"><b>Also at this address</b><span class="tag">${
        P.group.filter((x) => x !== c).map((x) => esc(x.name)).join(' · ')}</span></div>` : ''}
      <div class="row">
        ${IS1001 ? `<a class="btn primary" href="${LPFX}/company/${encodeURIComponent(c.id)}">Census profile</a>` : ''}
        ${c.url ? `<a class="btn${IS1001 ? '' : ' primary'}" href="${esc(c.url)}" target="_blank" rel="noopener">Visit ↗</a>` : ''}
        ${IS1001 ? '' : '<a class="btn" href="/census">Full census</a>'}
      </div>`;
    wire();
  }
  function wire() {
    panel.style.display = 'block';
    panel.querySelector('.x').onclick = () => { panel.style.display = 'none'; };
  }

  /* ── flight ──────────────────────────────────────────────────── */
  /* animate straight to a computed transform. flyTo() centres on a point; the
     census frame is a box, and re-deriving its centre-and-zoom twice was how
     the ◎ button and the opening view drifted apart. */
  function flyToXY(to) {
    const from = { z, ox, oy };
    const t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 750);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      z = from.z + (to.z - from.z) * e;
      ox = from.ox + (to.ox - from.ox) * e;
      oy = from.oy + (to.oy - from.oy) * e;
      draw();
      if (k < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }
  function flyTo(u, v, tz, done) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const from = { z, ox, oy };
    const to = { z: tz, ox: w / 2 - u * tz, oy: h * 0.54 - v * tz };
    const t0 = performance.now();
    cancelAnimationFrame(anim);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 750);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      z = from.z + (to.z - from.z) * e;
      ox = from.ox + (to.ox - from.ox) * e;
      oy = from.oy + (to.oy - from.oy) * e;
      draw();
      if (k < 1) anim = requestAnimationFrame(step);
      else if (done) done();
    };
    anim = requestAnimationFrame(step);
  }
  function flyToKec(K) {
    const [u0, u1, v0, v1] = K.iso;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const tz = clampZ(Math.min(w / (u1 - u0), h / (v1 - v0)) * 0.72);
    flyTo((u0 + u1) / 2, (v0 + v1) / 2, tz, () => openKec(K));
  }

  /* ONE COMPANY, ONE BODY. Six of the census companies are also curated
     tenants — Tokopedia, Blibli, Kata.ai, Astro, Paxel, Vidio — and the census
     layer was drawing every one of them a second time: its own generated sprite
     standing on the very tower the tenant already occupies (Tokopedia Tower
     carried the tinted facade AND a cartoon Tokopedia in front of it), plus a
     sector dot inside the tenant's gold ring. The tenant marker is the richer
     one — real facade tint, wall logo, plot ring, profile — so it wins, and the
     census record folds into it. The company stays mapped and stays counted.
     The census id and the tenant id need not agree (kata / kata-ai), so match
     on an explicit `census` field first, then on id, then on the name with its
     parenthetical stripped ("Bibit (Stockbit Bibit)" → bibit). */
  const cid = (s) => String(s || '').toLowerCase().replace(/\s*\(.*$/, '').replace(/[^a-z0-9]/g, '');
  function tenantIndex() {
    const ix = new Map();
    for (const tn of tenants) for (const k of [tn.census, tn.id, tn.name]) if (k) ix.set(cid(k), tn);
    return ix;
  }
  function loadCensus() {
    /* the map's slice of the census — the pins and what a pin card shows.
       The full file carries investor lists and method prose it never reads. */
    fetch('/data/census-map.json').then((r) => r.json()).then((d) => {
      const ix = tenantIndex();
      const list = [];
      let merged = 0;
      for (const c of d.companies) {
        if (!(c.lat && c.lon)) continue;
        const tn = ix.get(cid(c.id)) || ix.get(cid(c.name));
        if (tn) { tn.cens = c; merged++; continue; }   // the tenant tower IS this company
        const [u, v] = isoOf(c.lon, c.lat);
        list.push({ c, u, v });
      }
      /* `mapped` counts the merged ones too: they are on the map, as towers.
         `gva` is THIS CITY's sum, not the census total — the legend used to
         print the whole-census IDR figure next to whatever city was on
         screen, which on Bandung would caption 16 companies with Jakarta's
         output. */
      let gvaBn = 0;
      for (const P of list) gvaBn += P.c.est_gva_idr_bn || 0;
      for (const tn of tenants) if (tn.cens) gvaBn += tn.cens.est_gva_idr_bn || 0;
      cens = { list, merged, mapped: list.length + merged, totals: d.totals || {},
               gva_idr_t: Math.round(gvaBn / 100) / 10 };
      /* per-metro counts, for the legend's group headings */
      cens.byMetro = {};
      const bump = (c) => { const k = c.metro || 'jakarta'; cens.byMetro[k] = (cens.byMetro[k] || 0) + 1; };
      for (const P of list) bump(P.c);
      for (const tn of tenants) if (tn.cens) bump(tn.cens);
      buildLegend();
      const q3 = new URLSearchParams(location.search);
      if (IS1001 && !q3.get('company') && !q3.get('city') && !q3.get('area')) frameCensus(list);
      invalidate();
      /* ?company=<census id> deep link — fly to the pin and open its card. A
         merged company has no pin of its own any more; its tower answers. */
      const q2 = new URLSearchParams(location.search);
      const want = q2.get('company');
      const target = want && list.find((P) => P.c.id === want);
      if (target) { setTimeout(() => flyTo(target.u, target.v, 4.8, () => openPin(target)), 250); return; }
      const mt = want && tenants.find((tn) => tn.cens && tn.cens.id === want);
      const mtw = mt && towers.find((tw) => tw.tenants.includes(mt));
      if (mtw) {
        if (mtw.zone) loadDetail(mtw.zone);
        setTimeout(() => flyTo(mtw.u, mtw.v, mtw.zone ? 4.6 : 4.8, () => openTower(mtw)), 250);
      }
    }).catch(() => {});
  }

  /* Frame the COMPANIES, not the paper. Fitting the whole boundary file is
     right for Jakarta, where the census fills Jabodetabek — but the Bandung
     basin is mostly regency farmland with no census company on it, and that
     fit opened on an empty beige field with the city shrunk into one corner.
     This re-frames on the pins once they arrive, and only if the view is still
     untouched (z is exactly the fit) so it can never yank a map the visitor is
     already reading. fitZ itself is left alone: the zoom floor and the ◎
     button still mean the whole city. */
  function frameCensus(list, force) {
    if (!list.length || (!force && z !== fitZ)) return;
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    const take = (u, v) => { a = Math.min(a, u); b = Math.max(b, u); c = Math.min(c, v); d = Math.max(d, v); };
    for (const P of list) take(P.u, P.v);
    for (const tn of tenants) if (tn.cens) take(tn.u, tn.v);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    /* The legend covers the left ~250px, so the frame is not centred on the
       canvas — it is centred on the ground the reader can actually see. A
       generous PAD used to stand in for this, and it was so generous that the
       computed zoom fell below the boundary fit and the whole re-frame became
       a no-op the day a second metro widened the bbox. */
    const rail = w > 760 ? 266 : 0;
    const PAD = 1.22;
    const tz = Math.min((w - rail) / (((b - a) || 1) * PAD), h / (((d - c) || 1) * PAD));
    z = Math.max(fitZ, Math.min(tz, 4));   // never below the whole-map fit, never a street-level jump
    ox = rail + (w - rail) / 2 - ((a + b) / 2) * z;
    oy = h / 2 - ((c + d) / 2) * z;
  }

  function buildLegend() {
    if (IS1001) {
      /* the census legend counts census companies per kota — pins plus the
         ones folded into tenant towers (they are on the map, as towers) */
      const counts = {};
      if (cens) {
        for (const P of cens.list) counts[P.c.kota] = (counts[P.c.kota] || 0) + 1;
        for (const tn of tenants) if (tn.cens) counts[tn.cens.kota] = (counts[tn.cens.kota] || 0) + 1;
      }
      /* Seventeen kota on one flat list read as a wall. They group by metro
         instead, each heading doubling as the button that flies there — the
         legend is where a reader is already looking when they wonder where
         Bandung is. */
      const seen = [];
      for (const K of geo.kota) if (!seen.includes(K.metro)) seen.push(K.metro);
      const groups = seen.map((id) => {
        const M = METROS.find((x) => x.id === id) || { id, name: id, short: id };
        const n = (cens && cens.byMetro && cens.byMetro[id]) || 0;
        return `
        <button class="mg" data-metro="${esc(id)}" title="Fly to ${esc(M.name)}">
          ${esc(M.short)}<b>${n || '—'}</b></button>
        ${geo.kota.filter((K) => K.metro === id).map((K) =>
          `<div class="kr"><i style="background:${TINT[K.n]}"></i>${esc(K.n)}<b>${counts[K.n] || '—'}</b></div>`).join('')}`;
      }).join('<div class="div"></div>');
      legend.innerHTML = `
        <h4>The census<span>${cens ? `${cens.mapped} mapped` : 'loading…'}</span></h4>
        <div class="kl">${groups}</div>
        ${cens ? `<div class="div"></div><div class="act"><b>${cens.mapped}</b> companies standing at their real addresses${cens.gva_idr_t ? ` · est IDR ${cens.gva_idr_t} T/yr direct GVA` : ''}.</div>` : ''}
        <a class="btn primary" href="${LPFX}/#companies">Browse the census</a>
        <div class="src">${geo.kota.length} kota/kab · ${geo.kec.length} kecamatan · boundaries © OpenStreetMap${nation ? ` · land ${esc(String(nation.source || '').split('(')[0].trim())}` : ''}</div>`;
      for (const b of legend.querySelectorAll('.mg')) {
        b.onclick = () => goToMetro(b.dataset.metro);
      }
      const cur = document.querySelector('.chip.on[data-metro]');
      if (cur) markChip(cur.dataset.metro);
      return;
    }
    const last = tenants[tenants.length - 1];
    const counts = {};
    for (const tw of towers) counts[tw.kota] = (counts[tw.kota] || 0) + tw.tenants.length;
    legend.innerHTML = `
      <h4>The city<span>${tenants.length} tenant${tenants.length === 1 ? '' : 's'}</span></h4>
      ${geo.kota.map((K) => `<div class="kr"><i style="background:${TINT[K.n]}"></i>${esc(K.n)}<b>${counts[K.n] || '—'}</b></div>`).join('')}
      <div class="div"></div>
      <div class="act">Latest — <b>${esc(last.name)}</b> landed at ${esc(last.area.replace(' · ', ', '))}.</div>
      ${cens ? `<div class="div"></div><div class="act">Census layer — <b>${cens.mapped}</b> companies mapped · est IDR ${cens.totals.gva_idr_t || '—'} T/yr direct GVA. <a href="/census">Table →</a></div>` : ''}
      <a class="btn primary" href="/claim">Put your startup on the map</a>
      <div class="src">${geo.kota.length} kota/kab · ${geo.kec.length} kecamatan · boundaries © OpenStreetMap</div>`;
  }

  /* ── WHOOSH — Kereta Cepat Jakarta–Bandung ───────────────────────
     The map's two metros are the two ends of Indonesia's one high-speed
     railway, and on a single-projection map the corridor between them is real
     geography — so the line is drawn on its real alignment: 142 km traced from
     OpenStreetMap's highspeed=yes ways (scripts/fetch-whoosh.js →
     /data/whoosh.json), with per-segment viaduct/tunnel flags, the four
     stations snapped onto the rail, pylon legs under the viaducts, hills over
     the rural tunnel bores, and a pair of trains shuttling Halim ↔ Tegalluar
     on an accelerate–cruise–brake profile with station dwells — one train per
     direction, half a period apart, meeting mid-route the way the real
     service does. The trains are an ANIMATION on the real track, not live
     positions, and the card says so.

     Perf discipline: everything ground-anchored (track, legs, hills, portals,
     stations) is world-space Path2D built ONCE and drawn into the cached base
     layer; only the trains and their labels draw per frame, and their ~30fps
     ticker stands down exactly like the plot-ring pulse — tab hidden, canvas
     off screen, line out of view, or prefers-reduced-motion (trains park). */
  function whooshAt(s) {
    const P = whoosh.pts;
    /* extrapolate past the ends along the end tangents: a train standing at
       the Halim terminus is longer than the trace that stops at the platform,
       and clamping piled its cars into a heap on the last metre */
    if (s <= 0) { const p = P[0]; return { u: p.u + p.tu * s, v: p.v + p.tv * s, f: p.f, du: p.tu, dv: p.tv }; }
    if (s >= whoosh.D) { const p = P[P.length - 1], e = s - whoosh.D; return { u: p.u + p.tu * e, v: p.v + p.tv * e, f: 0, du: p.tu, dv: p.tv }; }
    let lo = 0, hi = P.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P[m].s <= s) lo = m; else hi = m - 1; }
    const a = P[lo], b = P[lo + 1];
    const t = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
    const dl = Math.hypot(b.u - a.u, b.v - a.v) || 1;
    return { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, f: a.f,
             du: (b.u - a.u) / dl, dv: (b.v - a.v) / dl };
  }
  function buildWhoosh() {
    if (!whooshRaw || !whooshRaw.line || whooshRaw.line.length < 2) return;
    const pts = [];
    let s = 0;
    for (const p of whooshRaw.line) {
      const [u, v] = isoOf(p[0], p[1]);
      if (pts.length) s += Math.hypot(u - pts[pts.length - 1].u, v - pts[pts.length - 1].v);
      pts.push({ u, v, f: p[2] || 0, s });
    }
    const D = s;
    let iu0 = 1e9, iu1 = -1e9, iv0 = 1e9, iv1 = -1e9;
    for (const p of pts) {
      if (p.u < iu0) iu0 = p.u; if (p.u > iu1) iu1 = p.u;
      if (p.v < iv0) iv0 = p.v; if (p.v > iv1) iv1 = p.v;
    }
    /* end tangents, for the standing-train extrapolation */
    const tan = (a, b) => { const l = Math.hypot(b.u - a.u, b.v - a.v) || 1; return [(b.u - a.u) / l, (b.v - a.v) / l]; };
    let t0 = tan(pts[0], pts[1]), t1 = tan(pts[pts.length - 2], pts[pts.length - 1]);
    pts[0].tu = t0[0]; pts[0].tv = t0[1];
    pts[pts.length - 1].tu = t1[0]; pts[pts.length - 1].tv = t1[1];
    whoosh = { pts, D, iso: [iu0, iu1, iv0, iv1], km: whooshRaw.km, tbox: [] };
    /* stations snap ONTO the line — the OSM node is the station hall, a few
       hundred metres off the traced track, and the roundel must ride the rail */
    whoosh.st = (whooshRaw.stations || []).map((S) => {
      const [su, sv] = isoOf(S.lon, S.lat);
      let bi = 0, bd = 1e9;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.hypot(pts[i].u - su, pts[i].v - sv);
        if (d < bd) { bd = d; bi = i; }
      }
      return { n: String(S.n || '').toUpperCase(), u: pts[bi].u, v: pts[bi].v, s: pts[bi].s };
    }).sort((a, b) => a.s - b.s);
    /* flag spans → tunnel list; static geometry as world-space Path2Ds */
    const spans = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const f = pts[i].f;
      const last = spans[spans.length - 1];
      if (last && last.f === f) { last.s1 = pts[i + 1].s; continue; }
      spans.push({ f, s0: pts[i].s, s1: pts[i + 1].s });
    }
    whoosh.tun = spans.filter((x) => x.f === 2);
    const surf = new Path2D(), tunP = new Path2D(), bshade = new Path2D(), legs = new Path2D();
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const P2 = a.f === 2 ? tunP : surf;
      P2.moveTo(a.u, a.v); P2.lineTo(b.u, b.v);
      if (a.f === 1) { bshade.moveTo(a.u, a.v + 0.55); bshade.lineTo(b.u, b.v + 0.55); }
    }
    for (const sp of spans) {
      if (sp.f !== 1) continue;
      for (let ls = sp.s0 + 1.5; ls < sp.s1; ls += 3.0) {
        const p = whooshAt(ls);
        legs.moveTo(p.u, p.v + 0.1); legs.lineTo(p.u, p.v + 1.05);
      }
    }
    whoosh.surf = surf; whoosh.tunP = tunP; whoosh.bshade = bshade; whoosh.legs = legs;
    /* hills over the RURAL bores — the Purwakarta highlands are why thirteen
       tunnels exist. An urban bore (Tunnel 1 leaves Halim under the toll road)
       gets the dotted line only: a green mound over Bekasi would be fiction. */
    const hash = (a, b) => { const t = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return t - Math.floor(t); };
    const onKota = (u, v) => {
      const gx = Math.floor((u / HW + v / HH) / 2), gy = Math.floor((v / HH - u / HW) / 2);
      return gx >= 0 && gy >= 0 && gx < nx && gy < ny && kotaCells[gy * nx + gx] >= 0;
    };
    /* Contour-stack hills: three nested elevation rings per mound, the idiom
       flat vector maps use for terrain — first pass drew single flat ellipses
       and they read as lily pads on the paper, not ground. Mounds scatter to
       both sides of the bore so the dotted tunnel line peeks through between
       them. */
    const hR0 = new Path2D(), hR1 = new Path2D(), hR2 = new Path2D();
    const portals = [];
    const ring = (P2, cx, cy, rx, ry) => { P2.moveTo(cx + rx, cy); P2.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); };
    for (const T of whoosh.tun) {
      const mid = whooshAt((T.s0 + T.s1) / 2);
      if (onKota(mid.u, mid.v)) continue;
      if (T.s1 - T.s0 < 20) continue;   // a ~150m cut gets dashes and portals, not a mountain
      /* a RANGE, not a pad at each mouth: two staggered mounds every ~8.5
         world units for the whole bore, flanking the line so its dots peek
         through the saddle between them */
      const n = Math.max(2, Math.min(28, Math.round((T.s1 - T.s0) / 8.5)));
      for (let k = 0; k < n; k++) {
        const sc = T.s0 + ((k + 0.5) / n) * (T.s1 - T.s0);
        const p = whooshAt(sc);
        for (const sgn of [1, -1]) {
          const h1 = hash(sc, sgn * 1.7), h2 = hash(sc, sgn * 9.1), h3 = hash(sc, sgn * 4.3);
          if (h2 < 0.18) continue;                       // ragged edges, not a fence
          const rx = 6.5 + h1 * 7;
          const side = sgn * (2.5 + h3 * 6.5);
          const cx = p.u - p.dv * side + (h2 - 0.5) * 5;
          const cy = p.v + p.du * side * 0.5 + (h1 - 0.5) * 2.5;
          ring(hR0, cx, cy, rx, rx * 0.5);
          ring(hR1, cx - rx * 0.06, cy - rx * 0.16, rx * 0.6, rx * 0.3);
          if (h3 > 0.35) ring(hR2, cx - rx * 0.1, cy - rx * 0.29, rx * 0.32, rx * 0.16);
        }
      }
      for (const se of [T.s0 + 0.01, T.s1 - 0.01]) {
        const p = whooshAt(se);
        portals.push({ u: p.u, v: p.v, du: p.du, dv: p.dv });
      }
    }
    whoosh.hills = { hR0, hR1, hR2, portals };
    /* the timetable: stop at every station, trapezoid speed profile between
       stops, dwell, come back. Scaled so one way reads in ~70 s. */
    const stops = whoosh.st.length >= 2 ? whoosh.st.map((x) => x.s) : [0, D];
    const V = D / 56, TA = 3.2, A = V / TA, DW_END = 9, DW_MID = 4;
    const prof = (L) => L > V * TA
      ? { tri: false, T: L / V + TA, L }
      : { tri: true, T: 2 * Math.sqrt(L / A), L };
    const dist = (P2, tau) => {
      if (P2.tri) {
        const th = P2.T / 2;
        if (tau <= th) return 0.5 * A * tau * tau;
        const r = P2.T - tau;
        return P2.L - 0.5 * A * r * r;
      }
      if (tau <= TA) return 0.5 * A * tau * tau;
      if (tau >= P2.T - TA) { const r = P2.T - tau; return P2.L - 0.5 * A * r * r; }
      return 0.5 * A * TA * TA + V * (tau - TA);
    };
    const ph = [];
    let t = 0;
    const dwell = (at, len) => { ph.push({ t0: t, t1: t += len, s: at }); };
    const run = (from, to) => {
      const P2 = prof(Math.abs(to - from));
      ph.push({ t0: t, t1: t += P2.T, leg: P2, from, dir: to > from ? 1 : -1 });
    };
    dwell(stops[0], DW_END);
    for (let i = 0; i < stops.length - 1; i++) {
      run(stops[i], stops[i + 1]);
      dwell(stops[i + 1], i === stops.length - 2 ? DW_END : DW_MID);
    }
    for (let i = stops.length - 1; i > 0; i--) {
      run(stops[i], stops[i - 1]);
      if (i > 1) dwell(stops[i - 1], DW_MID);
    }
    whoosh.period = t || 1;
    whoosh.posAt = (tm) => {
      for (const P2 of ph) {
        if (tm > P2.t1) continue;
        if (P2.leg) return { s: P2.from + P2.dir * dist(P2.leg, tm - P2.t0), dir: P2.dir, moving: true };
        return { s: P2.s, dir: 0, moving: false };
      }
      return { s: stops[0], dir: 0, moving: false };
    };
  }
  /* the cached half: track, viaduct legs, tunnel dots, hills, portals,
     station roundels — called from base() with the world transform set */
  function drawWhooshBase() {
    const W2 = whoosh;
    if (!W2) return;
    if (W2.iso[1] < VB[0] || W2.iso[0] > VB[1] || W2.iso[3] < VB[2] || W2.iso[2] > VB[3]) return;
    const lw = Math.max(2.2 / z, 0.5);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    /* what says "elevated": the viaduct's ground shadow and its pylon legs */
    ctx.strokeStyle = 'rgba(32,26,20,.10)'; ctx.lineWidth = lw * 1.15; ctx.stroke(W2.bshade);
    if (z >= 0.9) {
      ctx.lineCap = 'butt';
      ctx.strokeStyle = 'rgba(90,80,70,.5)'; ctx.lineWidth = Math.max(0.9 / z, 0.16); ctx.stroke(W2.legs);
      ctx.lineCap = 'round';
    }
    /* the surface track: dark casing + light sleeper dashes */
    ctx.strokeStyle = '#3E3833'; ctx.lineWidth = lw; ctx.stroke(W2.surf);
    ctx.strokeStyle = 'rgba(246,239,223,.9)'; ctx.lineWidth = lw * 0.38;
    ctx.setLineDash([5 / z, 5 / z]); ctx.stroke(W2.surf);
    /* tunnels: the line breaks into dots under the ground */
    ctx.setLineDash([2.2 / z, 3 / z]);
    ctx.strokeStyle = 'rgba(107,101,92,.6)'; ctx.lineWidth = lw * 0.8; ctx.stroke(W2.tunP);
    ctx.setLineDash([]);
    /* hills over the rural bores — stacked elevation rings — then portals */
    ctx.fillStyle = '#B3C795'; ctx.fill(W2.hills.hR0);
    ctx.strokeStyle = 'rgba(32,26,20,.12)'; ctx.lineWidth = 0.8 / z; ctx.stroke(W2.hills.hR0);
    ctx.fillStyle = '#C4D5A5'; ctx.fill(W2.hills.hR1);
    ctx.stroke(W2.hills.hR1);
    ctx.fillStyle = '#D6E2BC'; ctx.fill(W2.hills.hR2);
    ctx.stroke(W2.hills.hR2);
    ctx.strokeStyle = '#57504A'; ctx.lineWidth = Math.max(1.2 / z, lw * 0.8);
    for (const p of W2.hills.portals) {
      const L3 = lw * 1.5;
      ctx.beginPath();
      ctx.moveTo(p.u + p.dv * L3, p.v - p.du * L3);
      ctx.lineTo(p.u - p.dv * L3, p.v + p.du * L3);
      ctx.stroke();
    }
    /* station roundels, riding the line */
    for (const S2 of W2.st) {
      const r = 3.4 / z;
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.beginPath(); ctx.ellipse(S2.u, S2.v, r * 1.5, r * 1.5 * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = WH_RED;
      ctx.beginPath(); ctx.ellipse(S2.u, S2.v, r, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(S2.u, S2.v, r * 0.42, r * 0.42 * 0.62, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  /* the live half: two trains and the line's labels — called from dyn() with
     the screen transform set. Owns whooshVis, which gates the 30fps ticker. */
  function drawWhooshDyn(now) {
    whooshVis = false;
    const W2 = whoosh;
    if (!W2) return;
    W2.tbox = [];
    if (natMode()) return;
    if (W2.iso[1] < VB[0] || W2.iso[0] > VB[1] || W2.iso[3] < VB[2] || W2.iso[2] > VB[3]) return;
    whooshVis = !REDUCE;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const onCv = (sx2, sy2) => sx2 > -160 && sx2 < w + 160 && sy2 > -60 && sy2 < h + 60;
    const TL = Math.max(30, Math.min(132, 24 * z));
    const carL = TL / 5, carH = Math.max(3.6, Math.min(9.5, carL * 0.42));
    const gap = carL * 0.14, lift = carH * 0.62;
    const t = REDUCE ? 0 : now / 1000;
    let anyMoving = false;
    for (const off of [0, W2.period / 2]) {
      const st2 = W2.posAt((t + off) % W2.period);
      if (st2.moving) anyMoving = true;
      /* cars sit symmetrically around the profile position (the train's
         CENTRE), so a dwell and the leg that follows it agree about where the
         train is and departure never pops */
      const cars = [];
      for (let k = -2; k <= 2; k++) {
        const cm = st2.s + (k * (carL + gap)) / z;
        const a = whooshAt(cm + carL * 0.5 / z), b = whooshAt(cm - carL * 0.5 / z);
        if (a.f === 2 && b.f === 2) continue;          // inside a tunnel
        cars.push({ a, b, k });
      }
      if (!cars.length) continue;
      cars.sort((p, q) => (p.a.v + p.b.v) - (q.a.v + q.b.v));
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of cars) {
        const ax = c.a.u * z + ox, ay = c.a.v * z + oy;
        const bx2 = c.b.u * z + ox, by2 = c.b.v * z + oy;
        if (!onCv(ax, ay)) continue;
        x0 = Math.min(x0, ax, bx2); x1 = Math.max(x1, ax, bx2);
        y0 = Math.min(y0, ay - lift - carH, by2 - lift - carH); y1 = Math.max(y1, ay, by2);
        /* ground shadow, body, waist stripe, windows */
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(32,26,20,.2)'; ctx.lineWidth = carH * 0.8;
        ctx.beginPath(); ctx.moveTo(ax, ay + carH * 0.16); ctx.lineTo(bx2, by2 + carH * 0.16); ctx.stroke();
        ctx.strokeStyle = '#7E838D'; ctx.lineWidth = carH + 1.6;
        ctx.beginPath(); ctx.moveTo(ax, ay - lift); ctx.lineTo(bx2, by2 - lift); ctx.stroke();
        ctx.strokeStyle = '#E3E4E8'; ctx.lineWidth = carH;
        ctx.beginPath(); ctx.moveTo(ax, ay - lift); ctx.lineTo(bx2, by2 - lift); ctx.stroke();
        ctx.strokeStyle = WH_RED; ctx.lineWidth = Math.max(1, carH * 0.2);
        ctx.beginPath(); ctx.moveTo(ax, ay - lift - carH * 0.16); ctx.lineTo(bx2, by2 - lift - carH * 0.16); ctx.stroke();
        if (carL >= 12) {
          ctx.strokeStyle = 'rgba(58,63,74,.8)'; ctx.lineWidth = carH * 0.24;
          ctx.setLineDash([carL * 0.1, carL * 0.08]);
          ctx.beginPath(); ctx.moveTo(ax, ay - lift + carH * 0.08); ctx.lineTo(bx2, by2 - lift + carH * 0.08); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      /* the red noses — the CR400AF wears one on both ends */
      const ek = cars.map((c) => c.k);
      const front = cars.find((c) => c.k === Math.max(...ek)), rear = cars.find((c) => c.k === Math.min(...ek));
      for (const [pt2] of [[front.a], [rear.b]]) {
        const nx2 = pt2.u * z + ox, ny2 = pt2.v * z + oy - lift;
        ctx.fillStyle = WH_RED;
        ctx.beginPath(); ctx.arc(nx2, ny2, carH * 0.52, 0, Math.PI * 2); ctx.fill();
      }
      if (x1 > x0) W2.tbox.push([x0 - 6, y0 - 6, x1 - x0 + 12, y1 - y0 + 12, st2.dir, st2.s]);
    }
    /* both trains standing at platforms = a static frame; the ticker checks
       this so a dwell costs no repaints (about a fifth of every cycle) */
    W2.parkedDrawn = !anyMoving;
    /* labels: station names, and the line's own name over the empty corridor */
    if (z >= 0.5) for (const S2 of W2.st) {
      const sx2 = S2.u * z + ox, sy2 = S2.v * z + oy + 12;
      if (!onCv(sx2, sy2)) continue;
      mono(8.5, 'rgba(122,48,42,.8)');
      halo(S2.n, sx2, sy2);
    }
    if (z < 1.15) {
      const m2 = whooshAt(W2.D * 0.56);
      const sx2 = m2.u * z + ox, sy2 = m2.v * z + oy - 13;
      if (onCv(sx2, sy2)) { mono(9.5, '#8A2A26'); halo('WHOOSH — JAKARTA–BANDUNG HSR', sx2, sy2); }
    }
  }
  function whooshHit(px, py) {
    if (!whoosh) return null;
    for (const b of whoosh.tbox) {
      if (px >= b[0] && px <= b[0] + b[2] && py >= b[1] && py <= b[1] + b[3]) return { train: b };
    }
    if (!natMode()) for (const S2 of whoosh.st) {
      const dx = S2.u * z + ox - px, dy = S2.v * z + oy - py;
      if (dx * dx + dy * dy < 121) return { st: S2 };
    }
    return null;
  }
  function whooshNearest(s) {
    let best = null, bd = 1e9;
    for (const S2 of whoosh.st) { const d = Math.abs(S2.s - s); if (d < bd) { bd = d; best = S2; } }
    return best;
  }
  function openWhoosh(hit) {
    const st2 = hit && hit.st;
    panel.innerHTML = `
      <button class="x" aria-label="Close">×</button>
      <h3>Whoosh</h3>
      <div class="cat">Kereta Cepat Jakarta–Bandung · KCIC${st2 ? ' · ' + esc(st2.n) + ' STATION' : ''}</div>
      <div class="occ"><b>Route</b><span class="tag">Halim → Karawang → Padalarang → Tegalluar · ${Math.round(whoosh.km || 142)} km</span></div>
      <div class="occ"><b>Service</b><span class="tag">Up to 350 km/h — about 45 minutes end to end.</span></div>
      <div class="occ"><b>On this map</b><span class="tag">The real alignment, traced from OpenStreetMap: ${whoosh.tun.length} tunnels drawn dotted under the hills, viaducts standing on their legs. The moving trains are a shuttle animation on that track — not live train positions.</span></div>
      <div class="row">
        <a class="btn primary" href="https://www.kcic.co.id" target="_blank" rel="noopener">KCIC ↗</a>
        <a class="btn" href="https://ticket.kcic.co.id" target="_blank" rel="noopener">Tickets ↗</a>
      </div>`;
    wire();
  }

  /* ── boot ────────────────────────────────────────────────────── */
  /* On 1001 the map is the whole census, so every metro's boundaries load and
     merge into one `geo`. On PASAR only Jakarta does: its towers stand at
     Jakarta addresses, and the other metros there would be empty ground. The
     national layer and the non-Jakarta metros are ALL optional — a failed
     fetch costs the country wash or one city, never the map. */
  const geoFetch = (m) => fetch(m.geo).then((r) => r.json()).then((g) => ({ m, g })).catch(() => null);
  Promise.all([
    Promise.all((IS1001 ? METROS : METROS.slice(0, 1)).map(geoFetch)),
    fetch('/data/jakarta-tenants.json').then((r) => r.json()).catch(() => ({ tenants: [] })),
    fetch('/data/zones.json').then((r) => r.json()).catch(() => []),
    IS1001 ? fetch('/data/indonesia.json').then((r) => r.json()).catch(() => null) : Promise.resolve(null),
    /* the Whoosh line — optional the same way: a failed fetch costs the
       railway, never the map */
    IS1001 ? fetch('/data/whoosh.json').then((r) => r.json()).catch(() => null) : Promise.resolve(null),
  ]).then(([parts, t, genZones, nat, wh]) => {
    const got = parts.filter(Boolean);
    if (!got.length) return;
    /* Merge into one geo. Each kota carries the metro it came from, which is
       what the legend groups by and what the ?city= preset flies to — no
       second table of bounding boxes to keep in step with the data. */
    geo = { kota: [], kec: [], bbox: { w: 1e9, e: -1e9, s: 1e9, n: -1e9 } };
    for (const { m, g } of got) {
      for (const K of g.kota) { K.metro = m.id; geo.kota.push(K); }
      for (const C of g.kec) { C.metro = m.id; geo.kec.push(C); }
      geo.bbox.w = Math.min(geo.bbox.w, g.bbox.w); geo.bbox.e = Math.max(geo.bbox.e, g.bbox.e);
      geo.bbox.s = Math.min(geo.bbox.s, g.bbox.s); geo.bbox.n = Math.max(geo.bbox.n, g.bbox.n);
    }
    nation = nat;
    whooshRaw = wh;
    tenants = t.tenants || [];
    /* generated census zones (scripts/gen-zones.js): every company cluster gets
       real OSM ground like SCBD — appended before build() so quads/bindings see them */
    for (const gz of genZones) ZONES.push({ ...gz, req: false, ready: false });
    const withSprites = tenants.filter((tn) => tn.sprite);
    const ready = () => {
      build(); buildWhoosh(); buildLegend(); fit(); resize();
      const q = new URLSearchParams(location.search);
      /* On 1001 the census layer IS the product — no param needed. On PASAR
         the layer no longer exists (census visits are redirected to 1001);
         the param check stays only as a belt for any non-redirected path. */
      if (IS1001 || q.has('census') || q.has('company')) loadCensus();
      const ft = tenants.find((x) => x.id === q.get('focus'));
      const AZ = ZONES.find((Z) => Z.id === (q.get('area') || '').toLowerCase());
      const wantCity = (q.get('city') || '').toLowerCase();
      /* The header chips are camera presets, not links — but they stay real
         <a href="?city=…"> so they work with JS off and can be shared. Here
         the click is intercepted, the camera moves, and the URL is rewritten
         without a reload. */
      for (const a of document.querySelectorAll('[data-metro]')) {
        a.addEventListener('click', (e) => {
          const id = a.dataset.metro;
          if (!metroBounds(id)) return;                 // no data: let the link navigate
          e.preventDefault();
          goToMetro(id);
        });
      }
      if (wantCity) { flyToMetro(wantCity, true); markChip(wantCity); }
      if (ft) {
        const tw = towers.find((w2) => w2.tenants.includes(ft));
        if (tw.zone) loadDetail(tw.zone);
        const tz = tw.zone ? 4.6 : Math.max(2.1, fitZ * 4);
        setTimeout(() => flyTo(tw.u, tw.v, tz, () => openTower(tw)), 350);
      } else if (AZ) {
        loadDetail(AZ);
        setTimeout(() => flyTo(AZ.iso[0], AZ.iso[1], 4.6), 350);
      }
      /* Plot-ring pulse — the only thing that animates at rest. It used to be an
         unconditional full repaint 8x/s forever; now it stands down whenever
         there is no ring on screen, the tab is hidden, or the map is scrolled
         out of view. Nothing else wakes the main thread on an idle map. */
      setInterval(() => {
        if (dragging || pinch || document.hidden || !onScreen || !pulseLive) return;
        draw();
      }, 120);
      /* The Whoosh trains at ~30fps. Every repaint here is a blit of the
         cached base plus the dyn layer — never a re-rasterise — and the loop
         stands down whenever the line is off screen, the tab is hidden, the
         map is scrolled away, or the reader asked for reduced motion
         (whooshVis stays false and the trains stand at their platforms). */
      setInterval(() => {
        if (dragging || pinch || document.hidden || !onScreen || !whooshVis) return;
        /* nothing moves while both trains dwell — skip once that frame is drawn */
        if (whoosh && whoosh.parkedDrawn) {
          const t2 = performance.now() / 1000;
          if (!whoosh.posAt(t2 % whoosh.period).moving
            && !whoosh.posAt((t2 + whoosh.period / 2) % whoosh.period).moving) return;
        }
        draw();
      }, 33);
    };
    for (const tn of tenants) {
      if (!tn.logo) continue;
      const li = new Image();
      li.decoding = 'async';
      li.onload = () => (zLive.length ? invalidate() : draw());   // wall logos live in the cached base
      li.src = tn.logo;
      logos[tn.id] = li;
    }
    /* The map no longer waits on 2.7MB of tenant sprites to build itself —
       each one paints as it arrives. */
    for (const tn of withSprites) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = draw;
      img.src = tn.sprite;
      sprites[tn.id] = img;
    }
    ready();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) draw(); });
  /* canvas text is rasterised once and never re-shapes itself — without this the
     map's labels keep whatever fallback face was resolved before Plex Mono landed */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw());
  if (window.IntersectionObserver) {
    new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) draw(); },
      { rootMargin: '120px' }).observe(canvas);
  }
  /* read-only view probe — perf/QA harnesses need to compare two builds at the
     same z/pan, and nothing else exposes the transform */
  window.__jkt = () => ({ z, ox, oy, fitZ, zones: ZONES.length, built: zLive.length,
    wh: whoosh ? (() => { const m = whooshAt(whoosh.D * 0.55); return {
      D: Math.round(whoosh.D), period: Math.round(whoosh.period), st: whoosh.st.length, vis: whooshVis,
      mid: [Math.round(m.u * z + ox), Math.round(m.v * z + oy)],
      tb: whoosh.tbox.map((b) => b.slice(0, 2).map(Math.round)) }; })() : null });
  window.addEventListener('resize', resize);
  document.getElementById('jz-in').onclick = () => zoomTo(clampZ(z * 1.45), canvas.clientWidth / 2, canvas.clientHeight / 2);
  document.getElementById('jz-out').onclick = () => zoomTo(clampZ(z / 1.45), canvas.clientWidth / 2, canvas.clientHeight / 2);
  document.getElementById('jz-home').onclick = () => {
    /* PASAR: find VANTIS. 1001: back to the opening frame — the companies,
       both metros, which is what a reader means by "show me everything" on a
       census map. Not the boundary-file fit, which is mostly empty regency. */
    if (IS1001) {
      markChip('');
      const u = new URL(location.href); u.searchParams.delete('city'); history.replaceState(null, '', u);
      if (cens && cens.list.length) {
        const from = { z, ox, oy };
        z = fitZ; frameCensus(cens.list, true);
        const to = { z, ox, oy };
        z = from.z; ox = from.ox; oy = from.oy;
        flyToXY(to);
        return;
      }
      flyTo((uMin + uMax) / 2, (vMin + vMax) / 2, fitZ); return;
    }
    const tw = towers[0];
    if (!tw) return;
    if (tw.zone) loadDetail(tw.zone);
    flyTo(tw.u, tw.v, tw.zone ? 4.6 : Math.max(2.1, fitZ * 4), () => openTower(tw));
  };
})();
