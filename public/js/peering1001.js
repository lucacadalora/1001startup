/* 1001startup.id /peering — Indonesia's data centres, internet exchanges and
 * router ports from PeeringDB, on the 1001 map engine.
 *
 * Three layers behind the chips over the map:
 *   Data centres  every place PeeringDB lists, one point per building. A place
 *                 we can name is its operator's logo badge with its name; a
 *                 place we can't name is a grey dot (Luca, 18 Oct 2026: "if we
 *                 dont have the name/alias of the datacenter, just make it grey").
 *   Exchanges     a square at each data centre an exchange sits in, the count
 *                 of exchanges inside it; grey squares on a city for exchanges
 *                 PeeringDB places in a city only.
 *   Router ports  a disc per data centre sized by the router ports PeeringDB
 *                 puts there; grey discs on each exchange's city for the ports
 *                 whose data centre PeeringDB doesn't give.
 *
 * Every mark is an image in a symbol layer and every name a second symbol layer
 * placed after the marks, so MapLibre's own collision test keeps each name off
 * every mark and every other name: nothing is drawn through a label. Names that
 * can't fit wait for a closer zoom.
 *
 * The basemap is the one /map draws (public/js/logomap1001.js): our own vector
 * tiles in the same palette. A module, loaded from a file: the site's CSP is
 * script-src 'self'.
 */
const root = document.getElementById('pm-map');
const wrap = document.getElementById('map');
const cfg = JSON.parse(root.dataset.cfg);
const ORIGIN = location.origin;
const narrow = () => wrap.clientWidth < 700;
const n0 = (v) => Number(v || 0).toLocaleString('en-US');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── the basemap: the same look and layers as /map ─────────────────── */
const P = {
  sea: '#E1EAEC', land: '#FFFFFB', built: '#F7F8F3', green: '#F2F5EC',
  road: '#ECEDE8', major: '#E4E6E0', highway: '#DCDFD8', border: '#C6CBC5', border2: '#D9DCD6',
  place: '#A4A7A1', faint: '#B7BAB4', seaText: '#A3B6BB', ink: '#0B0B0C', grey: '#A6A9AE', greyText: '#8A8D93',
};
const MED = ['OverusedGrotesk-Medium'];
const SEMI = ['OverusedGrotesk-SemiBold'];
const BOLD = ['OverusedGrotesk-Bold'];
const NAME = ['coalesce', ['get', 'name:en'], ['get', 'name']];

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
    version: 8, glyphs: ORIGIN + '/assets/map/glyphs/{fontstack}/{range}.pbf', sources: {},
    layers: [{ id: 'sea', type: 'background', paint: { 'background-color': P.sea } }],
  };
  if (cfg.tiles) {
    s.sources.pm = { type: 'vector', tiles: [ORIGIN + cfg.tiles], minzoom: 0, maxzoom: cfg.maxzoom };
    s.layers.push(...basemapLayers());
  }
  return s;
}

/* ── the marks, drawn at 2x ────────────────────────────────────────── */
/* size tiers by how many networks list equipment at the place */
const TIERS = [
  { min: 100, badge: 48, dot: 12, text: 15 },
  { min: 20, badge: 40, dot: 10, text: 14 },
  { min: 0, badge: 34, dot: 8, text: 13 },
];
/* badges grow as you zoom in: smaller over a whole city so the busiest names
   find room, full size from street level */
const GROW = [[8, 0.62], [12, 0.8], [14.5, 1]];
const BADGES_ALL = 12;   // every named place wears its badge from here in
const tierOf = (nets) => TIERS.findIndex((t) => nets >= t.min);
/* half the width of each image on screen (shadow margin included): a name
   starts this far out plus a small gap, so it never touches its own mark */
const HALF = { dot: (d) => (d + 8) / 2, badge: (dia) => (dia + 14) / 2, square: (side) => (side + 10) / 2, disc: (r) => r + 3 };
const sqSide = (n) => (n >= 6 ? 24 : n >= 3 ? 21 : 18);   // screen px
const discR = (ports) => Math.max(7, Math.min(30, 5 + Math.sqrt(ports) * 1.4));
function pad(px) { const c = document.createElement('canvas'); c.width = c.height = Math.ceil(px * 2); return c; }
const FONT = (w, px) => `${w} ${px}px "Overused Grotesk",system-ui,sans-serif`;

/* a dot with a white ring: named = ink, grey = grey */
function drawDot(d, fill) {
  const S = d + 8, c = pad(S), x = c.getContext('2d', { willReadFrequently: true }), m = S;
  x.save(); x.shadowColor = 'rgba(24,32,36,.20)'; x.shadowBlur = 4; x.shadowOffsetY = 1;
  x.fillStyle = '#fff'; x.beginPath(); x.arc(m, m, d + 3, 0, Math.PI * 2); x.fill(); x.restore();
  x.fillStyle = fill; x.beginPath(); x.arc(m, m, d - 1, 0, Math.PI * 2); x.fill();
  return x.getImageData(0, 0, c.width, c.height);
}
/* a logo badge: the operator's mark in a white disc; a count pill when one
   building holds several PeeringDB facilities */
function drawBadge(dia, logo, letter, count) {
  const S = dia + 14, c = pad(S), x = c.getContext('2d', { willReadFrequently: true });
  const cx = S, cy = S - 1, R = dia - 2;
  x.save(); x.shadowColor = 'rgba(24,32,36,.22)'; x.shadowBlur = 9; x.shadowOffsetY = 3;
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill(); x.restore();
  x.strokeStyle = 'rgba(0,0,0,.10)'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, R - 0.5, 0, Math.PI * 2); x.stroke();
  const r = R - 6;
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  if (logo) {
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    /* an SVG without a size reports 0: treat it as square */
    const nw = logo.naturalWidth || 150, nh = logo.naturalHeight || 150;
    const k = Math.min((r * 2) / nw, (r * 2) / nh) * 0.86;
    const w = nw * k, h = nh * k;
    x.drawImage(logo, cx - w / 2, cy - h / 2, w, h);
  } else {
    x.fillStyle = '#F4F5F1'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#9A9D97'; x.font = FONT(600, Math.round(r * 0.8)); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(letter, cx, cy + 2);
  }
  x.restore();
  if (count > 1) {
    const t = String(count), fs = 19;
    x.font = FONT(600, fs);
    const w = Math.max(30, x.measureText(t).width + 16), h = 28, px = cx + R * 0.62 - w / 2, py = cy - R - 2;
    x.fillStyle = P.ink; x.beginPath(); x.roundRect(px, py, w, h, 14); x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, px + w / 2, py + h / 2 + 1);
  }
  return x.getImageData(0, 0, c.width, c.height);
}
/* a building several operators share: no one tenant's logo, the count of
   facilities in it instead */
function drawBuilding(dia, count) {
  const S = dia + 14, c = pad(S), x = c.getContext('2d', { willReadFrequently: true });
  const cx = S, cy = S - 1, R = dia - 2;
  x.save(); x.shadowColor = 'rgba(24,32,36,.22)'; x.shadowBlur = 9; x.shadowOffsetY = 3;
  x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill(); x.restore();
  x.fillStyle = P.ink; x.beginPath(); x.arc(cx, cy, R - 6, 0, Math.PI * 2); x.fill();
  const t = String(count);
  let fs = Math.round((R - 6) * (t.length > 2 ? 0.78 : 0.95));
  x.font = FONT(600, fs); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(t, cx, cy + 2);
  return x.getImageData(0, 0, c.width, c.height);
}
/* an exchange square with the count of exchanges inside */
function drawSquare(side, fill, label) {
  const S = side + 10, c = pad(S), x = c.getContext('2d', { willReadFrequently: true }), m = S;
  x.save(); x.shadowColor = 'rgba(24,32,36,.20)'; x.shadowBlur = 6; x.shadowOffsetY = 2;
  x.fillStyle = '#fff'; x.beginPath(); x.roundRect(m - side - 3, m - side - 3, side * 2 + 6, side * 2 + 6, 8); x.fill(); x.restore();
  x.fillStyle = fill; x.beginPath(); x.roundRect(m - side, m - side, side * 2, side * 2, 5); x.fill();
  if (label) { x.fillStyle = '#fff'; x.font = FONT(600, Math.round(side * 1.05)); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, m, m + 1); }
  return x.getImageData(0, 0, c.width, c.height);
}
/* a disc sized by router ports, the count inside when it fits */
function drawDisc(rad, fill, label) {
  const S = rad + 6, c = pad(S), x = c.getContext('2d', { willReadFrequently: true }), m = S;
  x.fillStyle = '#fff'; x.beginPath(); x.arc(m, m, rad + 2.5, 0, Math.PI * 2); x.fill();
  x.globalAlpha = 0.92; x.fillStyle = fill; x.beginPath(); x.arc(m, m, rad, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1;
  /* the count inside, at 8 px or more on screen, or not at all */
  if (label) {
    let fs = Math.min(26, Math.round(rad * 0.62));
    x.font = FONT(600, fs);
    while (fs > 16 && x.measureText(label).width > rad * 1.7) { fs -= 1; x.font = FONT(600, fs); }
    if (fs >= 16 && x.measureText(label).width <= rad * 1.75) { x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, m, m + 1); }
  }
  return x.getImageData(0, 0, c.width, c.height);
}
const initials = (n) => String(n || '?').replace(/^(PT|CV)\.?\s+/i, '').split(/[\s/&+()-]+/).filter((w) => /^[A-Za-z0-9]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

/* ── boot ──────────────────────────────────────────────────────────── */
Promise.all([
  import('./vendor/maplibre-gl-6.11.2/maplibre-gl.mjs'),
  fetch('/data/peering.json', { headers: { Accept: 'application/json' } }).then((r) => r.json()),
  document.fonts && document.fonts.load ? document.fonts.load('600 20px "Overused Grotesk"').catch(() => {}) : null,
]).then(([gl, D]) => start(gl, D))
  .catch((e) => { console.error(e); document.getElementById('pm-msg').hidden = false; });

function start(gl, D) {
  const F = new Map(D.facs.map((f) => [f.id, f]));
  const X = new Map(D.ixs.map((x) => [x.id, x]));
  const PL = new Map(D.places.map((p) => [p.id, p]));
  const NET = D.nets;

  /* exchanges per place, split by whether a named facility in it hosts them */
  for (const p of D.places) {
    const named = new Set(), grey = new Set();
    for (const id of p.facs) {
      const f = F.get(id);
      for (const i of f.ixs) (f.grey ? grey : named).add(i);
    }
    for (const i of named) grey.delete(i);
    p.ixN = [...named].sort((a, b) => X.get(b).nets - X.get(a).nets);
    p.ixG = [...grey].sort((a, b) => X.get(b).nets - X.get(a).nets);
    p.tier = tierOf(p.nets);
    const lead = p.facs.map((i) => F.get(i)).find((f) => !f.grey);
    p.lead = lead || F.get(p.facs[0]);
    p.label = p.grey ? p.lead.pdb : p.n;   // the build's short name: building, campus or data centre
    p.sub = p.facs.length > 1 ? `${p.facs.length} facilities` : '';
  }
  /* exchanges PeeringDB gives a city for and nothing more */
  const ixCity = new Map();
  for (const x of D.ixs) {
    if (x.sites.length || x.lat == null) continue;
    const k = x.lat.toFixed(3) + ',' + x.lng.toFixed(3);
    if (!ixCity.has(k)) ixCity.set(k, { id: 'c' + ixCity.size, lat: x.lat, lng: x.lng, city: x.city, ixs: [] });
    ixCity.get(k).ixs.push(x.id);
  }

  /* camera */
  const ID = [[95.0, -10.9], [141.1, 5.9]];
  const JKT = [[106.62, -6.42], [107.08, -6.08]];
  const frame = (which) => which === 'jakarta'
    ? { bounds: JKT, padding: narrow() ? { top: 70, bottom: 70, left: 24, right: 64 } : { top: 80, bottom: 70, left: 80, right: 80 } }
    : { bounds: narrow() ? [[95.0, -9.2], [119.6, 5.9]] : ID, padding: narrow() ? { top: 64, bottom: 64, left: 12, right: 12 } : { top: 70, bottom: 50, left: 30, right: 30 } };

  let map;
  try {
    const f0 = frame('indonesia');
    map = new gl.Map({
      container: root, style: style(), attributionControl: false,
      minZoom: 3, maxZoom: 17.5, maxBounds: [[84, -25], [152, 21]],
      dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: false,
      bounds: f0.bounds, fitBoundsOptions: { padding: f0.padding },
      cooperativeGestures: false,
    });
  } catch (e) {
    console.error(e);
    document.getElementById('pm-msg').hidden = false;
    return;
  }
  root.map = map;
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();
  map.on('error', (e) => console.warn('map:', (e && e.error && e.error.message) || e));
  /* a page that scrolls past the map shouldn't zoom it: the wheel zooms only
     once the map has been clicked or touched */
  map.scrollZoom.disable();
  root.addEventListener('pointerdown', () => map.scrollZoom.enable(), { once: true });

  /* ── images ──────────────────────────────────────────────────────── */
  const add = (id, img) => { if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 }); };
  map.setMissingStyleImageResolver && map.setMissingStyleImageResolver((id) => {
    if (id.startsWith('b-') && PL.has(id.slice(2))) {
      const p = PL.get(id.slice(2));
      add(id, drawBadge(TIERS[p.tier].badge, null, initials(p.lead.op || p.label), p.facs.length));
    }
  });
  function images() {
    TIERS.forEach((t, i) => { add(`dot-n${i}`, drawDot(t.dot, P.ink)); add(`dot-g${i}`, drawDot(t.dot, P.grey)); });
    for (const p of D.places) {
      if (p.grey) continue;
      add('b-' + p.id, p.mixed ? drawBuilding(TIERS[p.tier].badge, p.facs.length) : drawBadge(TIERS[p.tier].badge, null, initials(p.lead.op || p.label), p.facs.length));
    }
    for (const p of D.places) {
      if (p.ixN.length) add(`sq-n${p.id}`, drawSquare(sqSide(p.ixN.length), P.ink, String(p.ixN.length)));
      else if (p.ixG.length) add(`sq-g${p.id}`, drawSquare(sqSide(p.ixG.length), P.grey, String(p.ixG.length)));
    }
    for (const c of ixCity.values()) add(`sq-c${c.id}`, drawSquare(sqSide(c.ixs.length), P.grey, String(c.ixs.length)));
    for (const p of D.places) if (p.ports) add(`pd-${p.id}`, drawDisc(2 * discR(p.ports), P.ink, n0(p.ports)));
    D.grey_ports.forEach((g, i) => { if (g.lat != null) add(`pg-${i}`, drawDisc(2 * discR(g.ports), P.grey, n0(g.ports))); });
  }
  /* logos load after the map is up, biggest places first */
  function logos() {
    const want = D.places.filter((p) => !p.grey && !p.mixed && p.lead.logo).sort((a, b) => b.nets - a.nets);
    let i = 0, live = 0;
    const next = () => {
      while (live < 6 && i < want.length) {
        const p = want[i++], img = new Image();
        live++;
        img.decoding = 'async';
        img.onload = () => { try { map.updateImage('b-' + p.id, drawBadge(TIERS[p.tier].badge, img, '', p.facs.length)); } catch (e) { /* removed */ } live--; next(); };
        img.onerror = () => { live--; next(); };
        img.src = p.lead.logo;
      }
    };
    next();
  }

  /* ── features ────────────────────────────────────────────────────── */
  const pt = (lng, lat, props) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: props });
  const fc = (features) => ({ type: 'FeatureCollection', features });
  /* text offsets are in ems of the label's own size */
  const em = (px, t) => +(px / TIERS[t].text).toFixed(3);
  /* every source keeps its features at their real addresses, plus the radius
     each mark takes on screen once badges are drawn (zoom 8 and in) */
  const dcFeat = D.places.slice().sort((a, b) => b.nets - a.nets).map((p) => pt(p.lng, p.lat, {
    id: p.id, k: 'place', grey: p.grey ? 1 : 0, nets: p.nets,
    dot: `dot-${p.grey ? 'g' : 'n'}${p.tier}`, badge: p.grey ? `dot-g${p.tier}` : 'b-' + p.id,
    name: p.label, sub: p.sub, ts: TIERS[p.tier].text,
    dh: em(HALF.dot(TIERS[p.tier].dot), p.tier), bh: em(p.grey ? HALF.dot(TIERS[p.tier].dot) : HALF.badge(TIERS[p.tier].badge), p.tier), g: em(3, p.tier),
    /* over a whole city only the busier places (20+ networks) wear a badge;
       the rest are dots until street level, which leaves room for names */
    mid: !p.grey && p.tier <= 1 ? 1 : 0,
    rdot: TIERS[p.tier].dot / 2 + 2, rad: p.grey ? TIERS[p.tier].dot / 2 + 2 : TIERS[p.tier].badge / 2 + 1, grows: p.grey ? 0 : 1,
  }));
  /* "NCIX - neuCentrIX" -> "NCIX", "OMNIIX INDONESIA" -> "OMNIIX" on the map; full names in the card */
  const ixLabel = (n) => String(n).split(' - ')[0].replace(/\s+(indonesia|network)$/i, '').trim();
  const ixShort = (ids) => ids.slice(0, 2).map((i) => ixLabel(X.get(i).pdb)).join(' · ') + (ids.length > 2 ? ` +${ids.length - 2}` : '');
  const ixFeat = [
    ...D.places.filter((p) => p.ixN.length || p.ixG.length).map((p) => pt(p.lng, p.lat, {
      id: p.id, k: 'place', grey: p.ixN.length ? 0 : 1, n: (p.ixN.length || p.ixG.length), nets: p.nets,
      img: p.ixN.length ? `sq-n${p.id}` : `sq-g${p.id}`, name: ixShort(p.ixN.length ? p.ixN : p.ixG), sub: p.label,
      ts: 13, off: +((HALF.square(sqSide(p.ixN.length || p.ixG.length)) + 3) / 13).toFixed(3), rad: sqSide(p.ixN.length || p.ixG.length) / 2 + 3,
    })),
    ...[...ixCity.values()].map((c) => pt(c.lng, c.lat, {
      id: c.id, k: 'ixcity', grey: 1, n: c.ixs.length, nets: 0, img: `sq-c${c.id}`, name: ixShort(c.ixs), sub: `${c.city} · data centre not given`, ts: 13,
      off: +((HALF.square(sqSide(c.ixs.length)) + 3) / 13).toFixed(3), rad: sqSide(c.ixs.length) / 2 + 3,
    })),
  ].sort((a, b) => b.properties.n - a.properties.n || b.properties.nets - a.properties.nets);
  const ptFeat = [
    ...D.places.filter((p) => p.ports).map((p) => pt(p.lng, p.lat, {
      id: p.id, k: 'place', grey: 0, n: p.ports, img: `pd-${p.id}`, name: p.label, sub: '', ts: 13,
      off: +((HALF.disc(discR(p.ports)) + 3) / 13).toFixed(3), rad: discR(p.ports) + 2,
    })),
    ...D.grey_ports.map((g, i) => (g.lat == null ? null : pt(g.lng, g.lat, {
      id: 'g' + i, k: 'portcity', grey: 1, n: g.ports, img: `pg-${i}`, name: `${g.city}: data centre not given`, sub: '', ts: 13,
      off: +((HALF.disc(discR(g.ports)) + 3) / 13).toFixed(3), rad: discR(g.ports) + 2,
    }))).filter(Boolean),
  ].sort((a, b) => b.properties.n - a.properties.n);
  const FEAT = { dc: dcFeat, ix: ixFeat, pt: ptFeat };

  /* THE SPREAD, as on /map: one building can hold a dozen facilities and the
     Kuningan blocks hold dozens more, so left at their real addresses most
     marks would sit on one another and no name would find room. From zoom 10
     in, marks that overlap are nudged apart in screen space (the busier place
     moves least), never further than REACH px from the real address. Laid out
     per half step of zoom, at the step's tightest scale. */
  const SPREAD_FROM = 10;
  const REACH = [[10, 16], [12, 34], [14, 64], [16, 110]];
  const AIR = [[12, 0], [14, 6], [16, 14]];
  const stepOf = (z) => Math.round(z * 2) / 2;
  const lerp = (stops, z) => {
    if (z <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (z <= stops[i][0]) { const [z0, v0] = stops[i - 1], [z1, v1] = stops[i]; return v0 + (v1 - v0) * (z - z0) / (z1 - z0); }
    return stops[stops.length - 1][1];
  };
  const mercX = (lon) => (lon + 180) / 360;
  const mercY = (lat) => { const t = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + t) / (1 - t)) / (4 * Math.PI); };
  const lonOf = (x) => x * 360 - 180;
  const latOf = (y) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180 / Math.PI;
  function spread(list, step) {
    const n = list.length;
    if (step < SPREAD_FROM || !n) return list;
    const scale = 512 * 2 ** (step - 0.25), reach = lerp(REACH, step), air = lerp(AIR, step), GAP = 3;
    const X0 = new Float64Array(n), Y0 = new Float64Array(n), XX = new Float64Array(n), YY = new Float64Array(n);
    const grow = lerp(GROW, step);
    const R = list.map((f) => {
      const q = f.properties;
      if (q.rdot !== undefined && step < BADGES_ALL && !q.mid) return q.rdot;
      return q.rad * (q.grows ? grow : 1);
    });
    const stacked = new Map();
    list.forEach((f, i) => {
      const [lon, lat] = f.geometry.coordinates;
      X0[i] = mercX(lon) * scale; Y0[i] = mercY(lat) * scale;
      const key = Math.round(X0[i] * 4) + ':' + Math.round(Y0[i] * 4), k = stacked.get(key) || 0;
      stacked.set(key, k + 1);
      XX[i] = X0[i] + 0.7 * Math.sqrt(k) * Math.cos(k * 2.39996);
      YY[i] = Y0[i] + 0.7 * Math.sqrt(k) * Math.sin(k * 2.39996);
    });
    const far = 2 * Math.max(...R) + GAP + air;
    const order = list.map((_, i) => i);
    for (let pass = 0; pass < 80; pass++) {
      order.sort((a, b) => XX[a] - XX[b]);
      let moved = false;
      for (let a = 0; a < n; a++) {
        const i = order[a];
        for (let b = a + 1; b < n; b++) {
          const j = order[b], dx = XX[j] - XX[i];
          if (dx >= far) break;
          const need = R[i] + R[j] + GAP + air, dy = YY[j] - YY[i];
          if (dx >= need || dy >= need || dy <= -need) continue;
          const dd = dx * dx + dy * dy;
          if (dd >= need * need) continue;
          const d = Math.sqrt(dd) || 0.01, push = (need - d) / 2, ux = dx / d, uy = dy / d;
          const wi = i < j ? 0.5 : 1.5, wj = 2 - wi;
          XX[i] -= ux * push * wi; YY[i] -= uy * push * wi;
          XX[j] += ux * push * wj; YY[j] += uy * push * wj;
          moved = true;
        }
      }
      for (let i = 0; i < n; i++) {
        const ox = XX[i] - X0[i], oy = YY[i] - Y0[i], off = Math.hypot(ox, oy);
        if (off > reach) { XX[i] = X0[i] + ox * reach / off; YY[i] = Y0[i] + oy * reach / off; }
      }
      if (!moved) break;
    }
    return list.map((f, i) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lonOf(XX[i] / scale), latOf(YY[i] / scale)] }, properties: f.properties }));
  }
  const layouts = new Map();
  const laid = (key, step) => { const k = key + step; if (!layouts.has(k)) layouts.set(k, fc(spread(FEAT[key], step))); return layouts.get(k); };
  let seat = -1;
  const reseat = () => {
    const step = Math.max(SPREAD_FROM - 0.5, stepOf(map.getZoom()));
    if (step === seat || !map.getSource('dc')) return;
    seat = step;
    for (const key of Object.keys(FEAT)) map.getSource(key).setData(laid(key, step));
  };
  /* where a place is drawn right now (it may stand a little off its address) */
  const drawnAt = (pid) => {
    const key = mode === 'ports' ? 'pt' : mode;
    const f = laid(key, Math.max(SPREAD_FROM - 0.5, stepOf(map.getZoom()))).features.find((x) => x.properties.id === pid);
    return f ? f.geometry.coordinates : null;
  };

  /* ── the network layer: exchange links with light running along them ── */
  /* Each link joins two data centres that one or more exchanges have switches in
     (scripts/peering-build.py: spokes from an exchange's busiest named site). It is
     drawn as a gentle arc; small lights run along it both ways, more of them where
     more exchanges share the link. It shows which buildings are linked, not where the
     fibre runs. */
  const LINKS = (D.links || []).map((l) => {
    const a = PL.get(l.a), b = PL.get(l.b);
    if (!a || !b) return null;
    const ax = mercX(a.lng), ay = mercY(a.lat), bx = mercX(b.lng), by = mercY(b.lat);
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
    /* bend to one side by a fifth of the length, the same way round for every link */
    const cx = (ax + bx) / 2 - dy * 0.2, cy = (ay + by) / 2 + dx * 0.2;
    const N = 48, xs = new Float64Array(N + 1), ys = new Float64Array(N + 1), cum = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const s = i / N, u = 1 - s;
      xs[i] = u * u * ax + 2 * u * s * cx + s * s * bx;
      ys[i] = u * u * ay + 2 * u * s * cy + s * s * by;
      if (i) cum[i] = cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    const names = l.ixs.map((i) => (X.get(i) || {}).pdb).filter(Boolean);
    return { l, a, b, xs, ys, cum, total: cum[N] || len || 1e-9, names };
  }).filter(Boolean);
  const linkData = fc(LINKS.map((k) => ({ type: 'Feature',
    geometry: { type: 'LineString', coordinates: Array.from(k.xs, (x, i) => [lonOf(x), latOf(k.ys[i])]) },
    properties: { w: k.l.w, a: k.a.label, b: k.b.label, ixs: k.names.slice(0, 4).join(', ') + (k.names.length > 4 ? ` and ${k.names.length - 4} more` : '') } })));
  /* the lights: 1 to 4 per link, half of them running the other way */
  const LIGHTS = [];
  LINKS.forEach((k) => {
    const n = Math.min(5, 2 + Math.floor(k.l.w / 2) + (k.total * 512 * 32 > 900 ? 1 : 0));
    for (let i = 0; i < n; i++) LIGHTS.push({ k, t: (i + Math.random() * 0.6) / n, dir: i % 2 ? -1 : 1, v: 70 + Math.random() * 40 });
  });
  const at = (k, t) => {
    const want = t * k.total, c = k.cum;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] < want) lo = m; else hi = m; }
    const f = (want - c[lo]) / ((c[hi] - c[lo]) || 1);
    return [lonOf(k.xs[lo] + (k.xs[hi] - k.xs[lo]) * f), latOf(k.ys[lo] + (k.ys[hi] - k.ys[lo]) * f)];
  };
  const lightData = () => fc(LIGHTS.map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: at(p.k, p.t) }, properties: {} })));
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let running = false, last = 0, onScreen = true;
  function tick(now) {
    if (!running) return;
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    if (now - last < (narrow() ? 50 : 33)) return;   // 30 fps, 20 on a phone
    last = now;
    const scale = 512 * 2 ** map.getZoom();
    for (const p of LIGHTS) {
      p.t += p.dir * (p.v * dt) / Math.max(40, p.k.total * scale);
      if (p.t > 1) p.t -= 1; else if (p.t < 0) p.t += 1;
    }
    const src = map.getSource('net-lights');
    if (src) src.setData(lightData());
  }
  function lights(on) {
    const want = on && !still && onScreen && document.visibilityState === 'visible';
    if (want === running) return;
    running = want; last = 0;
    if (running) requestAnimationFrame(tick);
  }
  new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; lights(mode === 'net'); }).observe(wrap);
  document.addEventListener('visibilitychange', () => lights(mode === 'net'));

  /* ── layers ──────────────────────────────────────────────────────── */
  const LAYERS = { net: ['net-glow', 'net-line', 'net-halo', 'net-core', 'net-names', 'net-marks'], dc: ['dc-gnames', 'dc-names', 'dc-marks'], ix: ['ix-names', 'ix-marks'], ports: ['pt-names', 'pt-marks'] };
  /* the network layer hides the basemap's own names: its lines must never run through a label */
  const BASE_LABELS = ['label-sea', 'label-road', 'label-district', 'label-region', 'label-city', 'label-country'];
  const nameText = (extra) => Object.assign({
    'text-font': SEMI, 'text-max-width': 9, 'text-line-height': 1.1, 'text-letter-spacing': -0.01,
    'text-variable-anchor': ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'], 'text-justify': 'auto', 'text-padding': 2,
    'text-allow-overlap': false, 'text-ignore-placement': false,
  }, extra);
  const twoLine = ['case', ['!=', ['get', 'sub'], ''],
    ['format', ['get', 'name'], {}, '\n', {}, ['get', 'sub'], { 'font-scale': 0.82, 'text-font': ['literal', MED], 'text-color': '#6B6B73' }],
    ['format', ['get', 'name'], {}]];
  const inkPaint = { 'text-color': ['case', ['==', ['get', 'grey'], 1], P.greyText, P.ink], 'text-halo-color': 'rgba(255,255,251,.95)', 'text-halo-width': 1.6 };
  const markLayout = (img, size) => ({ 'icon-image': img, 'icon-size': size || 1, 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'icon-padding': 0 });

  map.on('load', () => {
    images();
    seat = Math.max(SPREAD_FROM - 0.5, stepOf(map.getZoom()));
    for (const key of Object.keys(FEAT)) map.addSource(key, { type: 'geojson', data: laid(key, seat) });
    map.on('zoom', reseat);
    /* a name starts just clear of its mark: half the mark, at the size the
       mark is drawn at this zoom, plus a small gap */
    const off = (f, mid) => ['+', mid ? ['case', ['==', ['get', 'mid'], 1], ['*', ['get', 'bh'], f], ['get', 'dh']] : ['*', ['get', 'bh'], f], ['get', 'g']];
    const growing = ['interpolate', ['linear'], ['zoom'], 7.99, ['+', ['get', 'dh'], ['get', 'g']],
      8, off(0.62, true), BADGES_ALL - 0.01, off(lerp(GROW, BADGES_ALL), true), BADGES_ALL, off(lerp(GROW, BADGES_ALL), false), 14.5, off(1, false)];
    /* the network layer goes in first, so it sits under every mark and name */
    map.addSource('net-links', { type: 'geojson', data: linkData });
    map.addSource('net-lights', { type: 'geojson', data: lightData() });
    const wW = (lo, hi) => ['interpolate', ['linear'], ['get', 'w'], 1, lo, 13, hi];
    map.addLayer({ id: 'net-glow', type: 'line', source: 'net-links', layout: { 'line-cap': 'round', visibility: 'none' },
      paint: { 'line-color': '#36A9FF', 'line-opacity': 0.14, 'line-blur': 3, 'line-width': wW(5, 12) } });
    map.addLayer({ id: 'net-line', type: 'line', source: 'net-links', layout: { 'line-cap': 'round', visibility: 'none' },
      paint: { 'line-color': '#36A9FF', 'line-opacity': 0.6, 'line-width': wW(1.1, 3.2) } });
    map.addLayer({ id: 'net-halo', type: 'circle', source: 'net-lights', layout: { visibility: 'none' },
      paint: { 'circle-color': '#2F9BFF', 'circle-opacity': 0.42, 'circle-blur': 0.85, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 7, 10, 10, 14, 13] } });
    map.addLayer({ id: 'net-core', type: 'circle', source: 'net-lights', layout: { visibility: 'none' },
      paint: { 'circle-color': '#0A6CFF', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.3, 10, 3, 14, 3.6],
        'circle-stroke-color': '#EAF5FF', 'circle-stroke-width': 1.2 } });
    /* names sit on white plates: a line or a light passing under a name stops at the plate's edge */
    const pc = document.createElement('canvas'); pc.width = pc.height = 32;
    const px2 = pc.getContext('2d', { willReadFrequently: true });
    px2.fillStyle = 'rgba(255,255,255,0.97)'; px2.strokeStyle = 'rgba(0,0,0,0.10)'; px2.lineWidth = 2;
    px2.beginPath(); px2.roundRect(1, 1, 30, 30, 8); px2.fill(); px2.stroke();
    map.addImage('plate', px2.getImageData(0, 0, 32, 32), { pixelRatio: 2, stretchX: [[10, 22]], stretchY: [[10, 22]], content: [8, 8, 24, 24] });
    map.addLayer({ id: 'net-names', type: 'symbol', source: 'dc', filter: ['==', ['get', 'grey'], 0],
      layout: nameText({ 'text-field': twoLine, 'text-size': ['get', 'ts'], 'text-radial-offset': growing,
        'icon-image': 'plate', 'icon-text-fit': 'both', 'icon-text-fit-padding': [3, 6, 2, 6],
        'icon-allow-overlap': true, 'icon-ignore-placement': true, 'text-padding': 7,
        'symbol-sort-key': ['-', 0, ['get', 'nets']], visibility: 'none' }),
      paint: inkPaint });
    map.addLayer({ id: 'net-marks', type: 'symbol', source: 'dc',
      layout: Object.assign(markLayout(['step', ['zoom'], ['get', 'dot'], 8, ['case', ['==', ['get', 'mid'], 1], ['get', 'badge'], ['get', 'dot']], BADGES_ALL, ['get', 'badge']],
        ['interpolate', ['linear'], ['zoom'], 7.99, 1, 8, ['case', ['==', ['get', 'mid'], 1], 0.62, 1],
          BADGES_ALL - 0.01, ['case', ['==', ['get', 'mid'], 1], lerp(GROW, BADGES_ALL), 1], BADGES_ALL, ['case', ['==', ['get', 'grows'], 1], lerp(GROW, BADGES_ALL), 1], 14.5, 1]), { 'symbol-sort-key': ['get', 'nets'], visibility: 'none' }) });
    /* names first in the stack order below the marks: placed after them, so
       they keep clear of every mark */
    /* grey places get their PeeringDB name in grey only close in */

    map.addLayer({ id: 'dc-gnames', type: 'symbol', source: 'dc', minzoom: 12,
      filter: ['==', ['get', 'grey'], 1],
      layout: nameText({ 'text-field': twoLine, 'text-size': ['-', ['get', 'ts'], 1],
        'text-radial-offset': ['+', ['get', 'bh'], ['get', 'g']], 'symbol-sort-key': ['-', 0, ['get', 'nets']] }),
      paint: inkPaint });
    map.addLayer({ id: 'dc-names', type: 'symbol', source: 'dc',
      filter: ['==', ['get', 'grey'], 0],
      layout: nameText({ 'text-field': twoLine, 'text-size': ['get', 'ts'],
        'text-radial-offset': growing,
        'symbol-sort-key': ['-', 0, ['get', 'nets']] }),
      paint: inkPaint });
    map.addLayer({ id: 'dc-marks', type: 'symbol', source: 'dc',
      layout: Object.assign(markLayout(['step', ['zoom'], ['get', 'dot'], 8, ['case', ['==', ['get', 'mid'], 1], ['get', 'badge'], ['get', 'dot']], BADGES_ALL, ['get', 'badge']],
        ['interpolate', ['linear'], ['zoom'], 7.99, 1, 8, ['case', ['==', ['get', 'mid'], 1], 0.62, 1],
          BADGES_ALL - 0.01, ['case', ['==', ['get', 'mid'], 1], lerp(GROW, BADGES_ALL), 1], BADGES_ALL, ['case', ['==', ['get', 'grows'], 1], lerp(GROW, BADGES_ALL), 1], 14.5, 1]), { 'symbol-sort-key': ['get', 'nets'] }) });
    map.addLayer({ id: 'ix-names', type: 'symbol', source: 'ix',
      layout: nameText({ 'text-field': twoLine, 'text-size': ['get', 'ts'], 'text-radial-offset': ['get', 'off'], 'symbol-sort-key': ['-', 0, ['get', 'n']], visibility: 'none' }),
      paint: inkPaint });
    map.addLayer({ id: 'ix-marks', type: 'symbol', source: 'ix',
      layout: Object.assign(markLayout(['get', 'img']), { 'symbol-sort-key': ['get', 'n'], visibility: 'none' }) });
    map.addLayer({ id: 'pt-names', type: 'symbol', source: 'pt', minzoom: 6,
      layout: nameText({ 'text-field': ['get', 'name'], 'text-size': ['get', 'ts'], 'text-radial-offset': ['get', 'off'], 'symbol-sort-key': ['-', 0, ['get', 'n']], visibility: 'none' }),
      paint: inkPaint });
    /* grey city discs under the named sites' discs, so a city's unplaced ports never hide a data centre */
    map.addLayer({ id: 'pt-marks', type: 'symbol', source: 'pt',
      layout: Object.assign(markLayout(['get', 'img']), { 'symbol-sort-key': ['-', ['get', 'n'], ['*', ['get', 'grey'], 1000000]], visibility: 'none' }) });
    logos();
    setMode(initialMode, false);
    map.once('idle', () => { root.dataset.ready = '1'; if (initialPlace) openPlace(initialPlace, initialMode, true); });
  });

  /* ── mode chips ──────────────────────────────────────────────────── */
  const chips = [...document.querySelectorAll('.pm-rail .chip[data-mode]')];
  const keyRows = [...document.querySelectorAll('#pm-key .row')];
  const qs = new URLSearchParams(location.search);
  const initialMode = ['net', 'dc', 'ix', 'ports'].includes(qs.get('layer')) ? qs.get('layer') : 'net';
  const initialPlace = PL.has(qs.get('place')) ? qs.get('place') : '';
  let mode = 'net';
  function setMode(m, push) {
    mode = m;
    for (const [k, ids] of Object.entries(LAYERS)) for (const id of ids) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', k === m ? 'visible' : 'none');
    for (const id of BASE_LABELS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', m === 'net' ? 'none' : 'visible');
    lights(m === 'net');
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.mode === m)));
    keyRows.forEach((r) => { r.hidden = r.dataset.for !== m; });
    if (push) {
      const u = new URL(location.href);
      if (m === 'net') u.searchParams.delete('layer'); else u.searchParams.set('layer', m);
      history.replaceState(null, '', u);
    }
  }
  chips.forEach((c) => c.addEventListener('click', () => { setMode(c.dataset.mode, true); closeCard(); }));

  /* ── zoom buttons ────────────────────────────────────────────────── */
  document.getElementById('pm-in').addEventListener('click', () => map.zoomIn());
  document.getElementById('pm-out').addEventListener('click', () => map.zoomOut());
  document.getElementById('pm-home').addEventListener('click', () => { closeCard(); const f = frame('indonesia'); map.fitBounds(f.bounds, { padding: f.padding }); });

  /* ── hover + click ───────────────────────────────────────────────── */
  const tip = document.getElementById('pm-tip');
  const marks = () => LAYERS[mode].slice().reverse();
  map.on('mousemove', (e) => {
    const f = map.queryRenderedFeatures(e.point, { layers: marks().filter((id) => !/^net-(glow|line|halo|core)$/.test(id)) })[0];
    if (!f && mode === 'net' && !narrow()) {
      const box = [[e.point.x - 4, e.point.y - 4], [e.point.x + 4, e.point.y + 4]];
      const ln = map.queryRenderedFeatures(box, { layers: ['net-line'] })[0];
      if (ln) {
        const q = ln.properties;
        tip.textContent = `${q.a} ↔ ${q.b} · ${q.ixs}`;
        tip.style.left = e.point.x + 'px'; tip.style.top = e.point.y + 'px'; tip.hidden = false;
        map.getCanvas().style.cursor = '';
        return;
      }
    }
    map.getCanvas().style.cursor = f ? 'pointer' : '';
    if (!f || narrow()) { tip.hidden = true; return; }
    const p = f.properties;
    tip.textContent = p.k === 'place' && (mode === 'dc' || mode === 'net') ? (p.grey ? `${p.name} · grey: no name we can check` : p.name + (p.sub ? ` · ${p.sub}` : ''))
      : mode === 'ix' ? `${p.name}${p.sub ? ' · ' + p.sub : ''}` : `${p.name} · ${n0(p.n)} router ports`;
    tip.style.left = e.point.x + 'px'; tip.style.top = e.point.y + 'px'; tip.hidden = false;
  });
  map.getCanvas().addEventListener('mouseleave', () => { tip.hidden = true; });
  map.on('click', (e) => {
    const box = [[e.point.x - 6, e.point.y - 6], [e.point.x + 6, e.point.y + 6]];
    const hits = map.queryRenderedFeatures(box, { layers: marks().filter((id) => !/^net-(glow|line|halo|core)$/.test(id)) });
    const f = hits[0];
    if (!f) { closeCard(); return; }
    const p = f.properties;
    if (p.k === 'place') openPlace(p.id, mode);
    else if (p.k === 'ixcity') openIxCity(p.id);
    else if (p.k === 'portcity') openPortCity(+p.id.slice(1));
  });
  window.addEventListener('pm:show', (e) => {
    const d = e.detail || {};
    if (!PL.has(d.place)) return;
    if (d.mode && d.mode !== mode) setMode(d.mode, true);
    openPlace(d.place, mode, true);
  });

  /* ── the card ────────────────────────────────────────────────────── */
  const card = document.getElementById('pm-card');
  function closeCard() { card.hidden = true; card.innerHTML = ''; wrap.classList.remove('has-card'); const u = new URL(location.href); if (u.searchParams.has('place')) { u.searchParams.delete('place'); history.replaceState(null, '', u); } }
  function show(html) {
    card.innerHTML = html;
    card.hidden = false;
    wrap.classList.add('has-card');
    card.querySelector('.x').addEventListener('click', closeCard);
    card.querySelectorAll('.more').forEach((b) => b.addEventListener('click', () => { b.previousElementSibling.querySelectorAll('[hidden]').forEach((li) => { li.hidden = false; }); b.remove(); }));
    card.querySelector('.bd').scrollTop = 0;
  }
  const head = (title, sub) => `<div class="hd"><h3>${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}</h3><button type="button" class="x" aria-label="Close">×</button></div>`;
  const kp = (rows) => `<div class="kp">${rows.map(([v, k]) => `<div><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('')}</div>`;
  const logoMk = (f) => (f.grey ? '<span class="mk grey"></span>' : f.logo ? `<img class="mk" src="${esc(f.logo)}" alt="" width="22" height="22">` : `<span class="mk mono-mk">${esc(initials(f.op || f.n))}</span>`);
  const listOf = (items, limit) => `<ul>${items.map((h, i) => `<li${i >= limit ? ' hidden' : ''}>${h}</li>`).join('')}</ul>${items.length > limit ? `<button type="button" class="more">Show all ${items.length}</button>` : ''}`;
  function openPlace(pid, m, fly) {
    const p = PL.get(pid);
    if (!p) return;
    const fs = p.facs.map((i) => F.get(i));
    const nets = new Map();
    for (const f of fs) for (const i of D.netfac[f.id] || []) nets.set(i, NET[i]);
    const city = [p.lead.city, p.lead.prov].filter(Boolean).join(', ');
    const facHtml = fs.map((f) => `<div class="fac">${logoMk(f)}<div><b>${esc(f.grey ? f.pdb : f.n)}</b>
      <small>${f.grey ? 'Grey: we can’t name this data centre · ' : ''}${esc([f.op, f.status === 'closed' ? 'closed' : ''].filter(Boolean).join(' · '))}</small>
      ${f.aka.length ? `<small>Also: ${esc(f.aka.join(' · '))}</small>` : ''}
      ${!f.grey && f.pdb !== f.n ? `<small>PeeringDB: ${esc(f.pdb)}</small>` : ''}
      <small>${n0(f.nets)} networks · <a href="#f-${f.id}" data-open="f-${f.id}">sources</a> · <a href="https://www.peeringdb.com/fac/${f.id}" target="_blank" rel="noopener nofollow">PeeringDB</a>${f.our ? ` · <a href="https://1001startup.id/data-center#p-${esc(f.our)}">on /data-center</a>` : ''}</small></div></div>`);
    const ixs = [...p.ixN, ...p.ixG].map((i) => X.get(i));
    const ixHtml = ixs.map((x) => `<div class="net"><span><b>${esc(x.pdb)}</b>${p.ixG.includes(x.id) ? ' <span class="gtag">at a grey site</span>' : ''}</span><span>${n0(x.nets)} networks</span></div>`);
    const netHtml = [...nets.entries()].filter(([, v]) => v).map(([, v]) => `<div class="net"><span>${esc(v[1])}</span><span>AS${esc(v[0])}${v[2] ? ' · ' + esc(v[2]) : ''}</span></div>`);
    show(head(p.grey ? p.lead.pdb : p.n, [p.bld && p.bld !== p.n ? p.bld : '', city].filter(Boolean).join(' · '))
      + `<div class="bd">${p.grey ? '<p>Grey: PeeringDB lists this place, but we found no name for it as a data centre, only a company name or an office address.</p>' : ''}`
      + kp([[n0(fs.length), fs.length === 1 ? 'facility' : 'facilities'], [n0(p.nets), 'networks'], [n0(ixs.length), 'exchanges'], [n0(p.ports || 0), 'router ports']])
      + `<h4>${fs.length === 1 ? 'The facility' : 'Facilities in this building'}</h4>${listOf(facHtml, 6)}`
      + (ixHtml.length ? `<h4>Exchanges here</h4>${listOf(ixHtml, 6)}` : '')
      + (netHtml.length ? `<h4>Networks with equipment here</h4>${listOf(netHtml, 12)}` : '')
      + '</div>');
    card.querySelectorAll('[data-open]').forEach((a) => a.addEventListener('click', () => { const d = document.getElementById(a.dataset.open); if (d) d.open = true; }));
    const u = new URL(location.href); u.searchParams.set('place', pid); history.replaceState(null, '', u);
    if (fly) map.flyTo({ center: drawnAt(pid) || [p.lng, p.lat], zoom: Math.max(map.getZoom(), 14), offset: narrow() ? [0, -wrap.clientHeight * 0.2] : [-180, 0], speed: 1.6 });
  }
  function openIxCity(cid) {
    const c = [...ixCity.values()].find((v) => v.id === cid);
    if (!c) return;
    const ixHtml = c.ixs.map((i) => X.get(i)).map((x) => `<div class="net"><span><b>${esc(x.pdb)}</b>${x.op ? ` · ${esc(x.op)}` : ''}</span><span>${n0(x.nets)} networks</span></div>`);
    show(head(`${c.city}: exchanges, data centre not given`, '')
      + `<div class="bd"><p>Grey: PeeringDB places ${c.ixs.length === 1 ? 'this exchange' : 'these exchanges'} in ${esc(c.city)} without naming a data centre, so ${c.ixs.length === 1 ? 'it sits' : 'they sit'} on the city centre.</p>${listOf(ixHtml, 10)}</div>`);
  }
  function openPortCity(i) {
    const g = D.grey_ports[i];
    if (!g) return;
    const ixHtml = g.ixs.map((id) => X.get(id)).sort((a, b) => b.ports - a.ports).map((x) => `<div class="net"><span><b>${esc(x.pdb)}</b></span><span>${n0(x.ports)} ports in all</span></div>`);
    show(head(`${g.city}: ${n0(g.ports)} router ports`, 'Data centre not given')
      + `<div class="bd"><p>Grey: PeeringDB lists these ports on exchanges in ${esc(g.city)} but doesn’t say which data centre each one is in, so they sit on the city centre.</p><h4>On these exchanges</h4>${listOf(ixHtml, 10)}</div>`);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !card.hidden) closeCard(); });
}
