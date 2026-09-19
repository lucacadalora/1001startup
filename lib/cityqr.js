'use strict';
/* City QR — renders a QR code as a small city block seen from above.
 * Dark modules become ink buildings (rounded footprint, SE drop shadow,
 * roof slab, sparse dark-green rooftops); light modules stay paper with a
 * faint street grid. Finder patterns keep their canonical concentric shape
 * (rounded) so detectors lock on. Scannability is protected by:
 *   - axis-aligned square footprints at 84% of the cell (no isometric skew)
 *   - shadows/grid in near-white tones that binarize to light
 *   - rooftop green #0a5c34 that binarizes to dark
 *   - 4-module quiet zone, error correction Q by default
 */
const QRCode = require('qrcode');
const { hash32 } = require('./util');

const INK = '#0b0e11';
const ROOF = '#22282f';
const SHADOW = '#dfe4ea';
const GRID = '#eef1f5';
const GREEN_DARK = '#0a5c34';

/* Leaf-mosaic palettes: the QR as the tree seen from above. Every dark tile
 * must stay under ~luminance 135 and every light tile above ~220, or the
 * mosaic stops binarizing — verified with jsQR; don't brighten for looks. */
const SEASONS = {
  morning: {
    bg: '#f2ede2',
    dark: ['#2f6b33', '#3f7d3f', '#4f8c3a', '#457f35', '#2c5e3a', '#376f2f'],
    branch: '#6b5a2f',
    light: ['#efe9db', '#ece5d4', '#e9e1cd'],
    finder: ['#2c5e3a', '#3f7d3f', '#356f33'],
    finderCore: '#6b5a2f',
  },
  dusk: {
    bg: '#f4ecdc',
    dark: ['#9c5a22', '#8a4a1e', '#a85f28', '#7d4522', '#94531f', '#845026'],
    branch: '#6f4a2a',
    light: ['#f1e8d4', '#eee3cc', '#eadec4'],
    finder: ['#8a4a1e', '#9c5a22', '#7d4522'],
    finderCore: '#6f4a2a',
  },
  rain: {
    bg: '#edefec',
    dark: ['#2a544a', '#35605a', '#3f6a5d', '#27493f', '#315a50', '#3a6154'],
    branch: '#4f463a',
    light: ['#eef0ec', '#eaeee8', '#e9ece6'],
    finder: ['#27493f', '#35605a', '#2f5348'],
    finderCore: '#4f463a',
  },
};

function matrix(text, ecl = 'Q') {
  const q = QRCode.create(text, { errorCorrectionLevel: ecl });
  const size = q.modules.size;
  const data = q.modules.data;
  const grid = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) row.push(data[y * size + x] ? 1 : 0);
    grid.push(row);
  }
  return { size, grid, version: q.version };
}

function inFinder(x, y, size) {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
}

function finderSvg(px, py, u, rxU) {
  // Canonical 7-1-3 concentric finder, rounded like a city plaza.
  return `<rect x="${px}" y="${py}" width="${7 * u}" height="${7 * u}" rx="${rxU * u}" fill="${INK}"/>` +
    `<rect x="${px + u}" y="${py + u}" width="${5 * u}" height="${5 * u}" rx="${rxU * 0.71 * u}" fill="#ffffff"/>` +
    `<rect x="${px + 2 * u}" y="${py + 2 * u}" width="${3 * u}" height="${3 * u}" rx="${rxU * 0.45 * u}" fill="${INK}"/>`;
}

/**
 * Leaf mosaic: the QR as the tree from above. Full-cell tiles (best possible
 * footprint), seeded per-cell color variety, branch-brown flecks, optional
 * accent "flower" tiles, foliage finder rings like the reference.
 * opts: { ecl, moduleSize, season, accents, accentColor, seed }
 */
function renderLeaf(text, opts = {}) {
  const ecl = ['L', 'M', 'Q', 'H'].includes(opts.ecl) ? opts.ecl : 'Q';
  const u = Math.max(4, Math.min(40, opts.moduleSize || 12));
  const pal = SEASONS[opts.season] || SEASONS.morning;
  const accents = opts.accents !== false;
  const accentColor = /^#[0-9a-fA-F]{6}$/.test(opts.accentColor || '') ? opts.accentColor : '#C96F2E';
  const { size, grid } = matrix(text, ecl);
  const quiet = 4;
  const dim = (size + quiet * 2) * u;
  const seed = hash32(String(opts.seed ?? text));

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" role="img" aria-label="QR code drawn as a tree from above">`);
  parts.push(`<rect width="${dim}" height="${dim}" fill="${pal.bg}"/>`);

  const cellRect = (x, y, fill) =>
    `<rect x="${(quiet + x) * u}" y="${(quiet + y) * u}" width="${u + 0.35}" height="${u + 0.35}" fill="${fill}"/>`;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const h = hash32(`${seed}:${x}:${y}`);
      const fin = inFinder(x, y, size);
      if (!grid[y][x]) {
        parts.push(cellRect(x, y, pal.light[h % pal.light.length]));
        continue;
      }
      if (fin) {
        // foliage finder: dark ring cells with leafy variance, branch core
        const inCore = (x % (size - 7) >= 2 && x % (size - 7) <= 4) && (y % (size - 7) >= 2 && y % (size - 7) <= 4);
        parts.push(cellRect(x, y, inCore && h % 3 === 0 ? pal.finderCore : pal.finder[h % pal.finder.length]));
        continue;
      }
      let fill = pal.dark[h % pal.dark.length];
      if (h % 17 === 0) fill = pal.branch;                       // branches showing through
      if (accents && h % 41 === 0) fill = accentColor;           // flowers
      parts.push(cellRect(x, y, fill));
    }
  }
  parts.push('</svg>');
  return parts.join('');
}

/**
 * Render the city QR as an SVG string.
 * opts: { ecl, moduleSize (px per module), accents (green rooftops), seed,
 *         moduleScale, finderRxU, shadow, grid }
 */
function render(text, opts = {}) {
  const ecl = ['L', 'M', 'Q', 'H'].includes(opts.ecl) ? opts.ecl : 'Q';
  const u = Math.max(4, Math.min(40, opts.moduleSize || 10));
  const accents = opts.accents !== false;
  // 0.92 is the floor for decoder safety: jsQR (the strictest common decoder)
  // fails at 0.84 footprints and passes at 0.92 — do not shrink this for looks.
  const moduleScale = opts.moduleScale || 0.92;
  const finderRxU = opts.finderRxU ?? 1.9;
  const wantShadow = opts.shadow !== false;
  const wantGrid = opts.grid !== false;
  const { size, grid } = matrix(text, ecl);
  const quiet = 4;
  const dim = (size + quiet * 2) * u;
  const seed = hash32(String(opts.seed ?? text));

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim}" height="${dim}" role="img" aria-label="QR code">`);
  parts.push(`<rect width="${dim}" height="${dim}" fill="#ffffff"/>`);

  // Faint street grid across the code area only.
  if (wantGrid) {
    const a0 = quiet * u, a1 = (quiet + size) * u;
    let gridPath = '';
    for (let i = 0; i <= size; i++) {
      const t = (quiet + i) * u;
      gridPath += `M${a0} ${t}H${a1}M${t} ${a0}V${a1}`;
    }
    parts.push(`<path d="${gridPath}" stroke="${GRID}" stroke-width="0.8" fill="none"/>`);
  }

  // Buildings: shadows first (so bodies overlap them), then bodies.
  const s = moduleScale * u, inset = ((1 - moduleScale) / 2) * u, rx = 0.18 * u;
  const shadows = [], bodies = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!grid[y][x] || inFinder(x, y, size)) continue;
      const px = (quiet + x) * u + inset, py = (quiet + y) * u + inset;
      if (wantShadow) shadows.push(`<rect x="${(px + 0.14 * u).toFixed(2)}" y="${(py + 0.14 * u).toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${rx.toFixed(2)}"/>`);
      let body = `<rect x="${px.toFixed(2)}" y="${py.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${rx.toFixed(2)}" fill="${INK}"/>`;
      const h = hash32(`${seed}:${x}:${y}`);
      if (h % 3 === 0) {
        // roof slab detail (still dark)
        body += `<rect x="${(px + 0.16 * u).toFixed(2)}" y="${(py + 0.16 * u).toFixed(2)}" width="${(s - 0.32 * u).toFixed(2)}" height="${(0.24 * u).toFixed(2)}" rx="${(0.08 * u).toFixed(2)}" fill="${ROOF}"/>`;
      }
      if (accents && h % 11 === 0) {
        // sparse dark-green rooftop (binarizes dark)
        body += `<rect x="${(px + 0.22 * u).toFixed(2)}" y="${(py + 0.3 * u).toFixed(2)}" width="${(0.4 * u).toFixed(2)}" height="${(0.4 * u).toFixed(2)}" rx="${(0.08 * u).toFixed(2)}" fill="${GREEN_DARK}"/>`;
      }
      bodies.push(body);
    }
  }
  parts.push(`<g fill="${SHADOW}">${shadows.join('')}</g>`);
  parts.push(bodies.join(''));

  // Finder plazas.
  const q0 = quiet * u, qe = (quiet + size - 7) * u;
  parts.push(finderSvg(q0, q0, u, finderRxU));
  parts.push(finderSvg(qe, q0, u, finderRxU));
  parts.push(finderSvg(q0, qe, u, finderRxU));

  parts.push('</svg>');
  return parts.join('');
}

module.exports = { render, renderLeaf, matrix, SEASONS };
