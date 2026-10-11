/* 1001startup.id /map — the logo map.
 *
 * Luca's reference (Oct 2026) was a robotics map of the Bay Area: a pale,
 * quiet street map with every company as a round logo badge and its name set
 * beside it. This is that map for Indonesia. The basemap is our own vector
 * tiles (lib/map1001-routes.js) drawn by MapLibre GL in the reference's
 * palette; the companies are one symbol layer on top of it.
 *
 * How the badges behave:
 *   - Each company is a round badge (its logo, a white ring, a soft shadow)
 *     with its name next to it, on whichever side has room.
 *   - Two badges never overlap. Where they would, the higher-ranked company
 *     keeps its badge and the other shows as a small dot until you zoom in.
 *   - Companies that share one address (a tower, or a district-level pin) fan
 *     out around it as you zoom, so every one of them can be reached.
 *
 * A module, loaded from a file: the site's CSP is script-src 'self', and
 * MapLibre 6 ships as ES modules with a module worker next to it.
 */
const root = document.getElementById('lm-map');
const wrap = document.getElementById('lm-wrap');
const cfg = JSON.parse(root.dataset.cfg);
const T = cfg.t;
const ORIGIN = location.origin;
const narrow = () => wrap.clientWidth < 700;

/* ── the look: measured off the reference ──────────────────────────── */
const P = {
  sea: '#E1EAEC', land: '#FFFFFB', built: '#F7F8F3', green: '#F2F5EC',
  road: '#ECEDE8', major: '#E4E6E0', highway: '#DCDFD8', border: '#C6CBC5', border2: '#D9DCD6',
  place: '#A4A7A1', faint: '#B7BAB4', seaText: '#A3B6BB', ink: '#0B0B0C',
};
const MED = ['OverusedGrotesk-Medium'];
const SEMI = ['OverusedGrotesk-SemiBold'];
const BOLD = ['OverusedGrotesk-Bold'];
/* place names in the reader's language where the map data has one */
const NAME = ['coalesce', ['get', 'name:' + cfg.lang], ['get', 'name']];

function basemapLayers() {
  const out = [];
  const add = (id, type, layer, rest) => out.push(Object.assign({ id, type, source: 'pm', 'source-layer': layer }, rest));
  const kinds = (...k) => ['in', ['get', 'kind'], ['literal', k]];
  const text = (color, halo) => ({ 'text-color': color, 'text-halo-color': halo || P.land, 'text-halo-width': 1.4 });
  const rank = ['coalesce', ['get', 'population_rank'], 0];

  add('earth', 'fill', 'earth', { filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': P.land } });
  add('landcover', 'fill', 'landcover', { maxzoom: 8, paint: {
    'fill-color': ['match', ['get', 'kind'], 'urban_area', P.built, 'forest', P.green, 'scrub', '#F6F8F0', P.land],
    'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 1, 8, 0] } });
  add('green', 'fill', 'landuse', {
    filter: kinds('national_park', 'park', 'cemetery', 'protected_area', 'nature_reserve', 'forest', 'golf_course', 'wood', 'scrub', 'grassland', 'grass'),
    paint: { 'fill-color': P.green, 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0, 10, 1] } });
  add('built', 'fill', 'landuse', {
    filter: kinds('industrial', 'aerodrome', 'school', 'university', 'college', 'hospital', 'military', 'pedestrian', 'pier'),
    paint: { 'fill-color': P.built } });
  add('water', 'fill', 'water', { filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': P.sea } });
  add('river', 'line', 'water', { minzoom: 9, filter: kinds('river', 'canal'),
    paint: { 'line-color': P.sea, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 9, 0.4, 14, 2, 18, 10] } });
  add('buildings', 'fill', 'buildings', { minzoom: 14.5,
    paint: { 'fill-color': '#F4F5F0', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 15.5, 1] } });

  const line = { 'line-cap': 'round', 'line-join': 'round' };
  add('ferry', 'line', 'roads', { minzoom: 7, filter: ['==', ['get', 'kind'], 'ferry'],
    paint: { 'line-color': '#CBD8DC', 'line-width': 0.8, 'line-dasharray': [3, 3] } });
  add('road-minor', 'line', 'roads', { minzoom: 12.5, layout: line,
    filter: ['all', kinds('minor_road', 'other'), ['!=', ['get', 'kind_detail'], 'service']],
    paint: { 'line-color': P.road, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12.5, 0.4, 15, 1.6, 18, 9] } });
  add('road-major', 'line', 'roads', { layout: line, filter: ['==', ['get', 'kind'], 'major_road'],
    paint: { 'line-color': P.major, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 7, 0.3, 11, 0.9, 13, 1.6, 15, 3.4, 18, 13] } });
  add('road-highway', 'line', 'roads', { layout: line,
    filter: ['all', ['==', ['get', 'kind'], 'highway'], ['!', ['has', 'is_link']]],
    paint: { 'line-color': P.highway, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 5, 0.4, 9, 1, 12, 1.9, 15, 5, 18, 15] } });

  const level = ['to-number', ['get', 'kind_detail'], 9];
  add('border-region', 'line', 'boundaries', { minzoom: 5, filter: ['all', ['>', level, 2], ['<=', level, 4]],
    paint: { 'line-color': P.border2, 'line-width': 0.6, 'line-dasharray': [2, 2] } });
  add('border-country', 'line', 'boundaries', { filter: ['<=', level, 2],
    paint: { 'line-color': P.border, 'line-width': 0.9, 'line-dasharray': [3, 2] } });

  add('label-sea', 'symbol', 'water', { filter: kinds('sea', 'ocean', 'bay', 'strait'),
    layout: { 'text-field': NAME, 'text-font': MED, 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10.5, 8, 13],
      'text-letter-spacing': 0.14, 'text-transform': 'uppercase', 'text-max-width': 7 },
    paint: { 'text-color': P.seaText, 'text-halo-color': P.sea, 'text-halo-width': 1 } });
  add('label-road', 'symbol', 'roads', { minzoom: 14, filter: kinds('highway', 'major_road'),
    layout: { 'symbol-placement': 'line', 'symbol-spacing': 420, 'text-field': NAME, 'text-font': MED, 'text-size': 10.5 },
    paint: text(P.faint) });
  add('label-district', 'symbol', 'places', { minzoom: 11.5, filter: kinds('neighbourhood', 'macrohood'),
    layout: { 'text-field': NAME, 'text-font': MED, 'text-max-width': 7, 'text-padding': 6, 'symbol-sort-key': ['get', 'min_zoom'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11.5, 10.5, 15, 12.5] },
    paint: text(P.faint) });
  add('label-region', 'symbol', 'places', { minzoom: 4.6, maxzoom: 8.5, filter: ['==', ['get', 'kind'], 'region'],
    layout: { 'text-field': NAME, 'text-font': MED, 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 7,
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 8, 12.5] },
    paint: text(P.faint) });
  add('label-city', 'symbol', 'places', { filter: ['==', ['get', 'kind'], 'locality'],
    layout: { 'text-field': NAME, 'text-font': MED, 'text-max-width': 7, 'text-padding': 5, 'symbol-sort-key': ['get', 'min_zoom'],
      'text-size': ['interpolate', ['linear'], ['zoom'],
        4, ['case', ['>=', rank, 12], 12.5, 10.5],
        9, ['case', ['>=', rank, 12], 16, ['>=', rank, 10], 13.5, 11.5],
        13, ['case', ['>=', rank, 10], 18, 13.5]] },
    paint: text(P.place) });
  add('label-country', 'symbol', 'places', { maxzoom: 6, filter: ['==', ['get', 'kind'], 'country'],
    layout: { 'text-field': NAME, 'text-font': BOLD, 'text-transform': 'uppercase', 'text-letter-spacing': 0.16, 'text-max-width': 6,
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 11, 6, 15] },
    paint: text('#AEB1AB') });
  return out;
}

function style() {
  const s = {
    version: 8,
    glyphs: ORIGIN + '/assets/map/glyphs/{fontstack}/{range}.pbf',
    sources: {},
    layers: [{ id: 'sea', type: 'background', paint: { 'background-color': P.sea } }],
  };
  if (cfg.tiles) {
    s.sources.pm = { type: 'vector', tiles: [ORIGIN + cfg.tiles], minzoom: 0, maxzoom: cfg.maxzoom };
    s.layers.push(...basemapLayers());
  }
  return s;
}

/* ── the badges ────────────────────────────────────────────────────── */
/* Drawn at 2x: a 128 px canvas is a 64 px image, the disc inside it 54 px. */
const IMG = 128, DISC = 54, CX = 64, CY = 62;
const TIERS = [
  { upTo: 12, dia: 54, text: 15 },
  { upTo: 90, dia: 46, text: 14 },
  { upTo: Infinity, dia: 40, text: 13 },
];
function drawBadge(logo, letter) {
  const c = document.createElement('canvas');
  c.width = c.height = IMG;
  const x = c.getContext('2d', { willReadFrequently: true });
  const disc = (r) => { x.beginPath(); x.arc(CX, CY, r, 0, Math.PI * 2); };
  x.save();
  x.shadowColor = 'rgba(24,32,36,.22)'; x.shadowBlur = 9; x.shadowOffsetY = 3;
  x.fillStyle = '#fff'; disc(DISC); x.fill();
  x.restore();
  x.strokeStyle = 'rgba(0,0,0,.10)'; x.lineWidth = 1.5; disc(DISC - 0.5); x.stroke();
  const r = DISC - 6;                     // the white ring: 3 px on screen
  x.save();
  disc(r); x.clip();
  if (logo) x.drawImage(logo, CX - r, CY - r, r * 2, r * 2);
  else {
    /* until the logo arrives (or when there is none): the initial, quietly */
    x.fillStyle = '#F4F5F1'; x.fillRect(0, 0, IMG, IMG);
    x.fillStyle = '#B4B7B1'; x.font = '600 54px "Overused Grotesk",system-ui,sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(letter, CX, CY + 3);
  }
  x.restore();
  x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 1; disc(r); x.stroke();
  return x.getImageData(0, 0, IMG, IMG);
}

/* ── where each badge stands ───────────────────────────────────────── */
const M_PER_DEG = 111320;
const mPerPx = (z, lat) => 78271.517 * Math.cos(lat * Math.PI / 180) / 2 ** z;
const lerp = (stops, z) => {
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (z <= stops[i][0]) {
      const [z0, v0] = stops[i - 1], [z1, v1] = stops[i];
      return v0 + (v1 - v0) * (z - z0) / (z1 - z0);
    }
  }
  return stops[stops.length - 1][1];
};

/* companies within ~45 m of each other share a pin: one tower, or one
   district centroid the geocoder fell back to */
function groupShared(list) {
  const parent = list.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dy = (a.lat - b.lat) * M_PER_DEG;
      if (dy > 45 || dy < -45) continue;
      const dx = (a.lon - b.lon) * M_PER_DEG * Math.cos(a.lat * Math.PI / 180);
      if (dx * dx + dy * dy < 45 * 45) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  list.forEach((c, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); });
  for (const g of groups.values()) {
    g.sort((a, b) => a.rank - b.rank);
    g.forEach((c, k) => { c.slot = k; c.anchor = g[0]; });
  }
}

/* The best-ranked company keeps the pin; the others take the next seats of a
   sunflower spiral around it. Seat spacing follows the zoom (wide enough for
   whole badges from street level) but is capped on the ground, so from far
   out nobody is drawn kilometres from their address. */
const SEAT_PX = [[11, 5], [13, 11], [14, 24], [15, 36], [16, 50]];
const SEAT_MAX_M = 120;
function seat(c, z) {
  if (!c.slot) return [c.lon, c.lat];
  const o = c.anchor;
  const m = Math.min(lerp(SEAT_PX, z) * mPerPx(z, o.lat), SEAT_MAX_M);
  const r = m * Math.sqrt(c.slot), a = c.slot * 2.39996;
  return [o.lon + r * Math.cos(a) / (M_PER_DEG * Math.cos(o.lat * Math.PI / 180)), o.lat + r * Math.sin(a) / M_PER_DEG];
}

/* ── boot ──────────────────────────────────────────────────────────── */
const GL = './vendor/maplibre-gl-6.11.2/maplibre-gl.mjs';
Promise.all([
  import(GL),
  fetch('/data/census-pins.json', { headers: { Accept: 'application/json' } }).then((r) => r.json()),
]).then(([gl, feed]) => start(gl, feed.companies || []))
  .catch((e) => { console.error(e); document.getElementById('lm-msg').hidden = false; });

function start(gl, list) {
  const byId = new Map(list.map((c) => [c.id, c]));
  /* rank inside the company's own city: the first few in Medan keep a badge
     on the national view even though a hundred Jakarta companies outrank them */
  const perMetro = new Map();
  [...list].sort((a, b) => a.rank - b.rank).forEach((c) => {
    c.mr = (perMetro.get(c.metro) || 0) + 1; perMetro.set(c.metro, c.mr);
    const t = TIERS.find((x) => c.rank <= x.upTo);
    c.size = t.dia / DISC; c.text = t.text; c.gap = (t.dia / 2 + 5) / t.text;
  });
  groupShared(list);

  /* camera presets: a city frames the bulk of its pins, not its farthest one */
  const box = (rows, trim) => {
    const pick = (key, p) => { const v = rows.map((c) => c[key]).sort((a, b) => a - b); return v[Math.round(p * (v.length - 1))]; };
    const t = rows.length >= 40 ? trim : 0;
    return [[pick('lon', t), pick('lat', t)], [pick('lon', 1 - t), pick('lat', 1 - t)]];
  };
  const frame = (id) => {
    /* room for the chip row above and, on a phone, the buttons on the right */
    const pad = narrow() ? { top: 88, bottom: 64, left: 40, right: 72 } : { top: 104, bottom: 76, left: 72, right: 72 };
    if (id === 'indonesia') {
      /* the whole archipelago on a wide screen; on a phone that leaves Java a
         thumb wide, so frame the cities that have companies instead */
      return { bounds: narrow() ? box(list, 0) : [[95.0, -10.9], [141.1, 5.9]], pad: narrow() ? pad : { top: 60, bottom: 40, left: 20, right: 20 }, maxZoom: 9 };
    }
    const rows = list.filter((c) => c.metro === id);
    if (!rows.length) return null;
    return { bounds: box(rows, narrow() ? 0.15 : 0.05), pad, maxZoom: 13.4 };
  };
  const open0 = byId.has(cfg.company) ? null : (frame(cfg.city) ? cfg.city : 'jakarta');
  const first = open0 ? frame(open0) : null;

  let map;
  try {
    map = new gl.Map({
      container: root, style: style(), attributionControl: false,
      /* loose enough that a tall phone can still hold the whole country */
      minZoom: 3, maxZoom: 18, maxBounds: [[84, -25], [152, 21]],
      dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: false,
      ...(first
        ? { bounds: first.bounds, fitBoundsOptions: { padding: first.pad, maxZoom: first.maxZoom } }
        : { center: seat(byId.get(cfg.company), 15), zoom: 15 }),
    });
  } catch (e) {
    console.error(e);
    document.getElementById('lm-msg').hidden = false;
    return;
  }
  root.map = map;   // for the console: document.getElementById('lm-map').map
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.on('error', (e) => console.warn('map:', (e && e.error && e.error.message) || e));

  /* ── badge images: a placeholder at once, the logo when it has loaded ── */
  /* MapLibre asks for an image the first time a tile's layout needs it, which
     is every company in the tile, placed or not, and waits for this to return.
     So it gets the placeholder disc at once, and a logo is only fetched when
     its badge is actually drawn (fetchDrawn below): a first view downloads the
     few dozen logos on screen, not all 436. */
  const pending = [];              // drawn badges whose logo is still to fetch
  const queued = new Set();
  let loading = 0, stale = false, relay = 0;
  map.setMissingStyleImageResolver((id) => {
    const c = id.startsWith('b-') && byId.get(id.slice(2));
    if (!c || map.hasImage(id)) return;
    map.addImage(id, drawBadge(null, c.name.charAt(0).toUpperCase()), { pixelRatio: 2 });
  });
  function pump() {
    if (loading >= 8 || !pending.length) return;
    let best = 0;                  // biggest names first
    for (let i = 1; i < pending.length; i++) if (pending[i].rank < pending[best].rank) best = i;
    const c = pending.splice(best, 1)[0];
    loading++;
    const img = new Image();
    img.decoding = 'async';
    const done = () => {
      loading--; pump();
      /* A tile that was being laid out while its logos arrived was built with
         the placeholders and is never told about the swap. Once the queue has
         drained, lay the companies out once more so every badge is current. */
      if (!loading && !pending.length && stale) {
        stale = false;
        clearTimeout(relay);
        relay = setTimeout(() => { if (map.getSource('co')) map.getSource('co').setData(features(seatZoom)); }, 150);
      }
    };
    img.onload = () => {
      try { if (map.hasImage('b-' + c.id)) { map.updateImage('b-' + c.id, drawBadge(img)); stale = true; } } catch (err) { /* map removed */ }
      done();
    };
    img.onerror = done;
    img.src = c.logo;
    pump();
  }

  /* ── the company layers ─────────────────────────────────────────── */
  let seatZoom = -1, selected = '';
  const features = (z) => ({
    type: 'FeatureCollection',
    features: list.map((c) => ({
      type: 'Feature', geometry: { type: 'Point', coordinates: seat(c, z) },
      properties: { id: c.id, name: c.name, rank: c.rank, mr: c.mr, img: 'b-' + c.id, size: c.size, text: c.text, gap: c.gap },
    })),
  });
  const reseat = () => {
    const z = Math.round(map.getZoom() * 2) / 2;
    if (z === seatZoom || !map.getSource('co')) return;
    seatZoom = z;
    map.getSource('co').setData(features(z));
  };
  /* far out, only the companies that could win a place are laid out at all */
  const SHOWN = ['any', ['<=', ['get', 'mr'], 2],
    ['<=', ['get', 'rank'], ['step', ['zoom'], 60, 6.5, 140, 8.5, 100000]]];
  const zoomed = (far, near) => ['interpolate', ['linear'], ['zoom'], 5, far, 11, near];
  const badgeLayout = {
    'icon-image': ['get', 'img'],
    'icon-size': zoomed(['*', 0.74, ['get', 'size']], ['get', 'size']),
    'icon-padding': 0,
    'text-field': ['get', 'name'], 'text-font': SEMI,
    'text-size': zoomed(['*', 0.88, ['get', 'text']], ['get', 'text']),
    'text-max-width': 6.5, 'text-line-height': 1.05, 'text-letter-spacing': -0.01,
    /* name to the right, else the left, else under, else over — like the reference */
    'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
    'text-radial-offset': zoomed(['*', 0.86, ['get', 'gap']], ['get', 'gap']),
    'text-justify': 'auto', 'text-padding': 1,
    'symbol-sort-key': ['get', 'rank'],
  };
  const badgePaint = { 'text-color': P.ink, 'text-halo-color': 'rgba(255,255,251,.94)', 'text-halo-width': 1.6, 'text-halo-blur': 0.5 };

  map.on('load', () => {
    if (!cfg.tiles) outline(map);
    map.addSource('co', { type: 'geojson', data: features(seatZoom = Math.round(map.getZoom() * 2) / 2) });
    /* every company is at least a dot, so a crowded district reads as crowded */
    map.addLayer({ id: 'co-dots', type: 'circle', source: 'co', paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2, 10, 2.6, 15, 4],
      'circle-color': '#6F7573', 'circle-opacity': 0.8,
      'circle-stroke-color': '#fff', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 1.3] } });
    map.addLayer({ id: 'co-badges', type: 'symbol', source: 'co', filter: SHOWN,
      /* in a street-level crowd a logo may stand without its name */
      layout: Object.assign({ 'text-optional': ['step', ['zoom'], false, 14.5, true] }, badgeLayout), paint: badgePaint });
    /* the open company: always drawn, ringed, above the rest */
    map.addLayer({ id: 'co-sel-ring', type: 'circle', source: 'co', filter: ['==', ['get', 'id'], ''], paint: {
      'circle-radius': zoomed(['+', 3, ['*', 0.74 * DISC / 2, ['get', 'size']]], ['+', 4, ['*', DISC / 2, ['get', 'size']]]),
      'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': P.ink, 'circle-stroke-width': 2, 'circle-translate': [0, -1] } });
    map.addLayer({ id: 'co-sel', type: 'symbol', source: 'co', filter: ['==', ['get', 'id'], ''],
      layout: Object.assign({ 'icon-allow-overlap': true, 'text-allow-overlap': true }, badgeLayout), paint: badgePaint });
    if (byId.has(cfg.company)) select(cfg.company, { fly: false });
  });
  map.on('zoom', reseat);
  let lastFetch = 0;
  const fetchDrawn = () => {
    if (!map.getLayer('co-badges')) return;
    lastFetch = Date.now();
    for (const f of map.queryRenderedFeatures({ layers: ['co-badges', 'co-sel'] })) {
      const c = byId.get(f.properties.id);
      if (c && c.logo && !queued.has(c.id)) { queued.add(c.id); pending.push(c); }
    }
    pump();
  };
  /* while the camera moves too, so a long fly does not arrive to blank discs */
  map.on('move', () => { if (Date.now() - lastFetch > 250) fetchDrawn(); });
  map.on('idle', () => { root.dataset.ready = '1'; fetchDrawn(); });

  /* ── hover, click, pick ─────────────────────────────────────────── */
  const tip = document.getElementById('lm-tip');
  const pick = document.getElementById('lm-pick');
  const LAYERS = ['co-sel', 'co-badges', 'co-dots'];
  const under = (pt, pad) => {
    if (!map.getLayer('co-dots')) return [];
    const seen = new Set();
    return map.queryRenderedFeatures([[pt.x - pad, pt.y - pad], [pt.x + pad, pt.y + pad]], { layers: LAYERS })
      .filter((f) => !seen.has(f.properties.id) && seen.add(f.properties.id));
  };
  map.on('mousemove', (e) => {
    const hit = under(e.point, 3);
    map.getCanvas().style.cursor = hit.length ? 'pointer' : '';
    /* a badge already carries its name, except in a street-level crowd */
    const named = hit.length && hit[0].layer.id !== 'co-dots' && map.getZoom() < 14.5;
    if (!hit.length || named || !pick.hidden) { tip.hidden = true; return; }
    /* count what a click here would offer (it reaches a little wider) */
    const stack = hit[0].layer.id === 'co-dots' ? under(e.point, 7) : hit;
    tip.textContent = stack.length > 1 && stack.every((f) => f.layer.id === 'co-dots') ? `${stack.length} ${T.here}` : hit[0].properties.name;
    tip.style.left = e.point.x + 'px'; tip.style.top = e.point.y + 'px';
    tip.hidden = false;
  });
  map.on('mouseout', () => { tip.hidden = true; });
  map.on('movestart', () => { tip.hidden = true; pick.hidden = true; });
  map.on('click', (e) => {
    pick.hidden = true;
    const hit = under(e.point, 7);
    if (!hit.length) return;
    /* a badge is one company: its logo is what was clicked */
    const badge = hit.find((f) => f.layer.id !== 'co-dots');
    if (badge) return select(badge.properties.id, { at: e.point });
    if (hit.length === 1) return select(hit[0].properties.id, { at: e.point });
    choose(hit.map((f) => byId.get(f.properties.id)).sort((a, b) => a.rank - b.rank), e.point);
  });
  function choose(rows, pt) {
    tip.hidden = true;
    pick.textContent = '';
    const h = document.createElement('h4');
    h.textContent = `${rows.length} ${T.here}`;
    const ul = document.createElement('ul');
    rows.forEach((c) => {
      const li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      const im = document.createElement(c.logo ? 'img' : 'span');
      if (c.logo) { im.src = c.logo; im.alt = ''; im.loading = 'lazy'; } else im.className = 'mono';
      b.append(im, c.name);
      b.addEventListener('click', () => { pick.hidden = true; select(c.id, { at: pt }); });
      li.append(b); ul.append(li);
    });
    pick.append(h, ul);
    pick.hidden = false;
    const w = wrap.clientWidth, hgt = wrap.clientHeight;
    pick.style.left = Math.max(12, Math.min(pt.x + 14, w - pick.offsetWidth - 12)) + 'px';
    pick.style.top = Math.max(12, Math.min(pt.y - 20, hgt - pick.offsetHeight - 12)) + 'px';
  }

  /* ── the open company ───────────────────────────────────────────── */
  const drawerWidth = () => (narrow() ? 0 : Math.min(560, wrap.clientWidth));
  function mark(id) {
    selected = id;
    map.setFilter('co-sel', ['==', ['get', 'id'], id]);
    map.setFilter('co-sel-ring', ['==', ['get', 'id'], id]);
    map.setFilter('co-badges', id ? ['all', SHOWN, ['!=', ['get', 'id'], id]] : SHOWN);
  }
  function select(id, opts) {
    const c = byId.get(id);
    if (!c) return;
    /* inside the landing's frame there is no room for a profile: go to it */
    if (cfg.embed) { window.top.location.assign(cfg.pfx + '/company/' + encodeURIComponent(id)); return; }
    mark(id);
    const w = drawerWidth();
    if (opts.fly === false) {
      /* arrived by link: the map opened on it; make room for the drawer */
      if (w) map.easeTo({ center: seat(c, 15), zoom: 15, offset: [-w / 2, 0], duration: 0 });
    } else if (w && opts.at && opts.at.x > wrap.clientWidth - w - 60) {
      map.easeTo({ center: seat(c, seatZoom), offset: [-w / 2, 0], duration: 500 });
    }
    const u = new URL(location.href);
    u.searchParams.delete('city'); u.searchParams.set('company', id);
    history.replaceState(null, '', u);
    setChip('');
    openDrawer(id);
  }
  function deselect() {
    if (!selected) return;
    mark('');
    const u = new URL(location.href);
    u.searchParams.delete('company');
    history.replaceState(null, '', u);
  }

  /* the same server-rendered card as the landing table and /company/<id> */
  let dw = null, dScroll = null, openId = null;
  const cards = {};
  function buildDrawer() {
    dw = document.createElement('div');
    dw.className = 'cpwrap';
    dw.hidden = true;
    dw.innerHTML = '<div class="cpbd" data-close="1"></div>' +
      '<aside class="cpdr" role="dialog" aria-modal="true" tabindex="-1">' +
      '<div class="cpbar"><span class="cppos"></span>' +
      '<button type="button" class="cpx" data-close="1"></button></div>' +
      '<div class="cpscroll"></div></aside>';
    dw.querySelector('.cpx').textContent = T.close;
    document.body.appendChild(dw);
    dScroll = dw.querySelector('.cpscroll');
    dw.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) { closeDrawer(); return; }
      /* a comparable company inside the card: go to it on the map too */
      const sib = e.target.closest('a[data-cp]');
      if (sib && byId.has(sib.dataset.cp)) {
        e.preventDefault();
        const c = byId.get(sib.dataset.cp);
        mark(c.id);
        map.easeTo({ center: seat(c, Math.max(seatZoom, 14)), zoom: Math.max(map.getZoom(), 14), offset: [-drawerWidth() / 2, 0], duration: 700 });
        const u = new URL(location.href); u.searchParams.set('company', c.id); history.replaceState(null, '', u);
        openDrawer(c.id);
      }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openId) closeDrawer(); });
  }
  function openDrawer(id) {
    if (!dw) buildDrawer();
    openId = id;
    dScroll.innerHTML = cards[id] || '<div class="cp cp-load"><div class="cp-ln"></div><div class="cp-ln"></div><div class="cp-ln"></div></div>';
    dScroll.scrollTop = 0;
    dw.hidden = false;
    document.body.classList.add('cplock');
    requestAnimationFrame(() => dw.classList.add('on'));
    if (cards[id]) return;
    const page = cfg.pfx + '/company/' + encodeURIComponent(id);
    fetch(page + '?panel=1', { headers: { Accept: 'text/html' } })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then((html) => { cards[id] = html; if (openId === id) dScroll.innerHTML = html; })
      .catch(() => {
        if (openId !== id) return;
        dScroll.textContent = '';
        const box = document.createElement('div'), a = document.createElement('a');
        box.className = 'cp-err'; a.href = page; a.textContent = T.page;
        box.append(T.err + ' ', a, '.');
        dScroll.append(box);
      });
  }
  function closeDrawer() {
    openId = null;
    dw.classList.remove('on');
    document.body.classList.remove('cplock');
    setTimeout(() => { if (!openId) dw.hidden = true; }, 220);
    deselect();
  }

  /* ── chips and buttons ──────────────────────────────────────────── */
  const chips = [...document.querySelectorAll('.lm-rail [data-metro]')];
  function setChip(id) { chips.forEach((a) => a.classList.toggle('on', a.dataset.metro === id)); }
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function go(id, animate) {
    const f = frame(id);
    if (!f) return false;
    map.fitBounds(f.bounds, { padding: f.pad, maxZoom: f.maxZoom, duration: animate && !calm ? 1100 : 0 });
    setChip(id);
    return true;
  }
  /* the chips are real links (they work without this script, and paste);
     here they move the camera instead of reloading the page */
  chips.forEach((a) => a.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    e.preventDefault();
    if (!go(a.dataset.metro, true)) return;
    const u = new URL(location.href);
    u.searchParams.delete('company'); u.searchParams.set('city', a.dataset.metro);
    history.replaceState(null, '', u);
  }));
  document.getElementById('lm-in').onclick = () => map.zoomIn();
  document.getElementById('lm-out').onclick = () => map.zoomOut();
  document.getElementById('lm-home').onclick = () => {
    if (!go(open0 || 'jakarta', true)) return;
    const u = new URL(location.href);
    u.searchParams.delete('company');
    if (cfg.city) u.searchParams.set('city', cfg.city); else u.searchParams.delete('city');
    history.replaceState(null, '', u);
  };
}

/* No basemap archive on this checkout: the committed Natural Earth outline
   (public/data/indonesia.json, the old map's country layer) under the badges. */
function outline(map) {
  fetch('/data/indonesia.json').then((r) => r.json()).then((d) => {
    const poly = (rings) => ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) } });
    map.addSource('ne-near', { type: 'geojson', data: poly(d.near || []) });
    map.addSource('ne-land', { type: 'geojson', data: poly(d.land || []) });
    const under = map.getLayer('co-dots') ? 'co-dots' : undefined;
    map.addLayer({ id: 'ne-near', type: 'fill', source: 'ne-near', paint: { 'fill-color': P.built } }, under);
    map.addLayer({ id: 'ne-land', type: 'fill', source: 'ne-land', paint: { 'fill-color': P.land } }, under);
  }).catch(() => { /* badges on a plain sea still work */ });
}
