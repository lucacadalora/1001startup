'use strict';
/* 1001startup.id /map — what the logo map reads from this server.
 *
 * Registered from server.js in one line (the leads-routes pattern). Three
 * things, all read-only:
 *
 *   /tiles/<build>/<z>/<x>/<y>.mvt   the basemap: vector tiles out of the
 *       Indonesia PMTiles archive scripts/fetch-basemap.sh puts in
 *       data/basemap/. No map vendor is called at view time.
 *   /assets/map/glyphs/<font>/<range>.pbf   label glyph sheets. The ones the
 *       site's font covers are static files (scripts/build-map-glyphs.py);
 *       this route only exists so a range that was never built answers with an
 *       empty sheet instead of a 404, which would stall every label in a tile.
 *   /data/census-pins.json   one row per located company: the handful of
 *       fields a badge needs, nothing from the working layer.
 *
 * The archive is optional. A checkout without it still serves /map: the view
 * is told there are no tiles and draws the committed Natural Earth outline of
 * the country under the same badges.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Archive } = require('./pmtiles');

const BASEMAP_DIR = path.join(__dirname, '..', 'data', 'basemap');
const CURRENT = path.join(BASEMAP_DIR, 'current.json');
const GLYPH_DIR = path.join(__dirname, '..', 'public', 'assets', 'map', 'glyphs');

/* the archive behind data/basemap/current.json, re-read when that file's mtime
   moves — fetch-basemap.sh re-points it, so a new build needs no restart */
let cur = { mtime: -1, at: 0, build: null, maxzoom: 0, archive: null };
function basemap() {
  const now = Date.now();
  if (now - cur.at < 5000) return cur.archive ? cur : null;
  cur.at = now;
  let mtime = 0;
  try { mtime = fs.statSync(CURRENT).mtimeMs; } catch { /* no basemap on this checkout */ }
  if (mtime === cur.mtime) return cur.archive ? cur : null;
  const old = cur.archive;
  cur = { mtime, at: now, build: null, maxzoom: 0, archive: null };
  if (mtime) {
    try {
      const j = JSON.parse(fs.readFileSync(CURRENT, 'utf8'));
      const file = path.join(BASEMAP_DIR, path.basename(String(j.file || '')));
      const archive = new Archive(file);
      cur.build = String(j.build || 'x').replace(/[^0-9a-z]/gi, '') || 'x';
      cur.maxzoom = archive.header.maxZoom;
      cur.archive = archive;
    } catch (e) {
      console.error('map1001: basemap unreadable, serving /map without tiles:', e.message);
    }
  }
  /* a request may still be reading the old file; let it finish first */
  if (old) setTimeout(() => old.close(), 30000).unref();
  return cur.archive ? cur : null;
}

/* what the view needs to point the map at the tiles; null = no basemap here */
function tileInfo() {
  const b = basemap();
  return b ? { url: `/tiles/${b.build}/{z}/{x}/{y}.mvt`, maxzoom: b.maxzoom, build: b.build } : null;
}

/* "Gojek (GoTo Group)" is "Gojek" on a map label */
const label = (name) => String(name || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

/* hand the request to the site's own 404 (each brand has its shell) */
const notFound = (reply) => { reply.callNotFound(); return reply; };

module.exports = function registerMap1001(fastify, deps) {
  const { is1001, censusData } = deps;

  fastify.get('/tiles/:build/:z/:x/:y', async (req, reply) => {
    if (!is1001(req)) return notFound(reply);
    const b = basemap();
    const m = /^(\d{1,7})\.mvt$/.exec(req.params.y);
    const z = +req.params.z, x = +req.params.x;
    if (!b || !m || !/^\d{1,2}$/.test(req.params.z) || !/^\d{1,7}$/.test(req.params.x)) return notFound(reply);
    const tile = b.archive.tile(z, x, +m[1]);
    /* The build id is in the URL, so a tile never changes under its address.
       A page left open across a basemap switch asks for the old build: it
       still gets a tile, just not a year of cache for it. */
    reply.header('Cache-Control', req.params.build === b.build
      ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
    /* open sea and anything outside the extract: no tile, and that is an answer */
    if (!tile) return reply.code(204).send();
    reply.type('application/vnd.mapbox-vector-tile');
    if (b.archive.header.tileCompression !== 'gzip') return reply.send(tile);
    /* stored gzip'd; hand it over as stored unless the client cannot take it */
    if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
      return reply.header('Content-Encoding', 'gzip').header('Vary', 'Accept-Encoding').send(tile);
    }
    return reply.send(zlib.gunzipSync(tile));
  });

  const EMPTY = Buffer.alloc(0);
  const sheets = new Map();   // a few dozen files of 30-80 KB, read once
  fastify.get('/assets/map/glyphs/:font/:range', async (req, reply) => {
    const font = String(req.params.font);
    const m = /^(\d{1,6})-(\d{1,6})\.pbf$/.exec(req.params.range);
    if (!/^[A-Za-z0-9-]{1,48}$/.test(font) || !m) return notFound(reply);
    reply.type('application/x-protobuf').header('Cache-Control', 'public, max-age=2592000');
    const key = `${font}/${+m[1]}-${+m[2]}.pbf`;
    let sheet = sheets.get(key);
    if (sheet === undefined) {
      try { sheet = fs.readFileSync(path.join(GLYPH_DIR, key)); } catch { sheet = EMPTY; /* not built */ }
      if (sheets.size < 64) sheets.set(key, sheet);
    }
    return reply.send(sheet);
  });

  /* one short row per located company; rebuilt when server.js reloads the census */
  let pins = { src: null, body: '', tag: '' };
  fastify.get('/data/census-pins.json', async (req, reply) => {
    if (!is1001(req)) return notFound(reply);
    const data = censusData();
    if (!data) return reply.code(404).send({ error: 'not_found' });
    if (pins.src !== data) {
      const all = data.companies || [];
      const rows = all.filter((c) => c.lat && c.lon).map((c) => ({
        id: c.id, name: label(c.name), lat: c.lat, lon: c.lon, logo: c.logo || null,
        rank: c.rank || 9999, metro: c.metro || 'jakarta',
      }));
      const body = JSON.stringify({ total: all.length, located: rows.length, companies: rows });
      const stamp = String(data.generated || '').replace(/[^0-9]/g, '').slice(0, 14);
      pins = { src: data, body, tag: `W/"${stamp}-${body.length.toString(36)}"` };
    }
    reply.header('Cache-Control', 'no-cache').header('ETag', pins.tag);
    if (req.headers['if-none-match'] === pins.tag) return reply.code(304).send();
    return reply.type('application/json').send(pins.body);
  });

  return { tileInfo };
};
