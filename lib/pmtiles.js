'use strict';
/* A read-only PMTiles v3 reader for one local archive — just enough to answer
 * "the tile at z/x/y" for /map's basemap (lib/map1001-routes.js).
 *
 * Spec: https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md
 * Written out instead of pulling the `pmtiles` package so a deploy of this
 * branch needs no `npm install`: the format is a 127-byte header, varint
 * directories (gzip'd), Hilbert-ordered tile ids. Tiles come back exactly as
 * stored (still gzip'd for a Protomaps build), so the route can pass them
 * through with Content-Encoding instead of inflating every response.
 *
 * Checked tile-for-tile against `pmtiles tile` (go-pmtiles CLI) on the
 * Indonesia extract, z0-13, including leaf-directory and run-length hits.
 */
const fs = require('fs');
const zlib = require('zlib');

const COMPRESSION = { 0: 'unknown', 1: 'none', 2: 'gzip', 3: 'brotli', 4: 'zstd' };

function u64(b, o) { return b.readUInt32LE(o) + b.readUInt32LE(o + 4) * 2 ** 32; }

function readHeader(b) {
  if (b.toString('ascii', 0, 7) !== 'PMTiles') throw new Error('not a PMTiles archive');
  if (b[7] !== 3) throw new Error('PMTiles version ' + b[7] + ' (need 3)');
  return {
    rootOffset: u64(b, 8), rootLength: u64(b, 16),
    metaOffset: u64(b, 24), metaLength: u64(b, 32),
    leafOffset: u64(b, 40), leafLength: u64(b, 48),
    dataOffset: u64(b, 56), dataLength: u64(b, 64),
    internalCompression: COMPRESSION[b[97]], tileCompression: COMPRESSION[b[98]],
    tileType: b[99], minZoom: b[100], maxZoom: b[101],
    bounds: [b.readInt32LE(102) / 1e7, b.readInt32LE(106) / 1e7, b.readInt32LE(110) / 1e7, b.readInt32LE(114) / 1e7],
    center: [b.readInt32LE(119) / 1e7, b.readInt32LE(123) / 1e7, b[118]],
  };
}

function inflate(buf, how) {
  if (how === 'gzip') return zlib.gunzipSync(buf);
  if (how === 'brotli') return zlib.brotliDecompressSync(buf);
  if (how === 'none' || how === 'unknown') return buf;
  throw new Error('unsupported PMTiles compression: ' + how);
}

/* varints run past 32 bits (tile ids, offsets), so no bit ops here */
function directory(buf) {
  let pos = 0;
  const next = () => {
    let v = 0, mul = 1, byte;
    do { byte = buf[pos++]; v += (byte & 0x7f) * mul; mul *= 128; } while (byte & 0x80);
    return v;
  };
  const n = next();
  const ents = new Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) { last += next(); ents[i] = { id: last, offset: 0, length: 0, run: 1 }; }
  for (let i = 0; i < n; i++) ents[i].run = next();
  for (let i = 0; i < n; i++) ents[i].length = next();
  for (let i = 0; i < n; i++) {
    const v = next();
    ents[i].offset = v === 0 && i > 0 ? ents[i - 1].offset + ents[i - 1].length : v - 1;
  }
  return ents;
}

/* last entry with id <= tileId; a run covers [id, id+run), run 0 = a leaf directory */
function find(ents, id) {
  let lo = 0, hi = ents.length - 1;
  while (lo <= hi) {
    const k = (lo + hi) >> 1;
    if (ents[k].id < id) lo = k + 1;
    else if (ents[k].id > id) hi = k - 1;
    else return ents[k];
  }
  if (hi >= 0 && (ents[hi].run === 0 || id - ents[hi].id < ents[hi].run)) return ents[hi];
  return null;
}

/* tiles before zoom z, then the Hilbert index inside z */
function tileId(z, x, y) {
  let acc = 0;
  for (let i = 0; i < z; i++) acc += 4 ** i;
  const n = 2 ** z;
  let d = 0;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = (x & s) > 0 ? 1 : 0;
    const ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) { x = n - 1 - x; y = n - 1 - y; }
      const t = x; x = y; y = t;
    }
  }
  return acc + d;
}

class Archive {
  constructor(file) {
    this.file = file;
    this.fd = fs.openSync(file, 'r');
    const head = Buffer.alloc(16384);
    fs.readSync(this.fd, head, 0, head.length, 0);
    this.header = readHeader(head);
    const h = this.header;
    this.root = directory(inflate(head.subarray(h.rootOffset, h.rootOffset + h.rootLength), h.internalCompression));
    this.leaves = new Map();          // leaf directories, small LRU
  }

  read(offset, length) {
    const b = Buffer.alloc(length);
    let got = 0;
    while (got < length) {
      const n = fs.readSync(this.fd, b, got, length - got, offset + got);
      if (!n) throw new Error('short read in ' + this.file);
      got += n;
    }
    return b;
  }

  leaf(offset, length) {
    const key = offset + ':' + length;
    let d = this.leaves.get(key);
    if (d) { this.leaves.delete(key); this.leaves.set(key, d); return d; }
    d = directory(inflate(this.read(this.header.leafOffset + offset, length), this.header.internalCompression));
    this.leaves.set(key, d);
    if (this.leaves.size > 256) this.leaves.delete(this.leaves.keys().next().value);
    return d;
  }

  /* raw stored bytes of z/x/y, or null when the archive has no such tile */
  tile(z, x, y) {
    const h = this.header;
    if (z < h.minZoom || z > h.maxZoom) return null;
    if (x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return null;
    const id = tileId(z, x, y);
    let dir = this.root;
    for (let depth = 0; depth < 4; depth++) {
      const e = find(dir, id);
      if (!e) return null;
      if (e.run > 0) return this.read(h.dataOffset + e.offset, e.length);
      dir = this.leaf(e.offset, e.length);
    }
    throw new Error('PMTiles directory deeper than 4');
  }

  metadata() {
    const h = this.header;
    return JSON.parse(inflate(this.read(h.metaOffset, h.metaLength), h.internalCompression).toString('utf8'));
  }

  close() { try { fs.closeSync(this.fd); } catch { /* already closed */ } }
}

module.exports = { Archive, tileId };
