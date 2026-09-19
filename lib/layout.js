'use strict';
/* Deterministic city plan. The server is the single source of truth for
 * world geometry: every merchant gets a plot (position + building dims)
 * derived only from district membership, join order within the district,
 * and a hash of the handle — so the world never reshuffles underfoot and
 * profile "find me in the world" deep links stay stable.
 *
 * Plan: a central east–west boulevard. Districts alternate north/south of
 * it, each with its own street running away from the boulevard, buildings
 * on both sides of that street. Units are meters-ish for three.js.
 */
const { hash32 } = require('./util');

const DISTRICTS = [
  { key: 'ai',        name: 'Inference Row',     desc: 'AI, ML and compute providers' },
  { key: 'craft',     name: 'Craft Lane',        desc: 'Handmade and artisan goods' },
  { key: 'fashion',   name: 'Fashion Street',    desc: 'Clothing, accessories, style' },
  { key: 'food',      name: 'Food Quarter',      desc: 'Food, drink and kitchens' },
  { key: 'creator',   name: 'Creator Boulevard', desc: 'Writers, artists, streamers' },
  { key: 'services',  name: 'Service Arcade',    desc: 'Agencies, studios, professionals' },
  { key: 'web3',      name: 'Ledger Lane',       desc: 'Web3, finance and payments' },
  { key: 'retail',    name: 'Retail Parade',     desc: 'Shops and marketplaces' },
  { key: 'edu',       name: 'Learning Row',      desc: 'Courses, coaching, schools' },
  { key: 'community', name: 'The Commons',       desc: 'Communities, events, causes' },
];
const DISTRICT_KEYS = new Set(DISTRICTS.map((d) => d.key));

const ACCENTS = ['#C96F2E', '#3F7D4E', '#B08A2E', '#4E7A96', '#8A5A83', '#B65A6A'];

const COL_SPACING = 72;      // x distance between district columns
const BLVD_HALF = 7;         // boulevard half-width (runs along x at z=0)
const STREET_HALF = 4.5;     // district street half-width
const CELL = 12;             // z distance between building rows
const OFFSET = 11;           // building center distance from street axis
const FIRST_ROW = 16;        // z of first building row from boulevard axis

function plotFor(districtIndex, slot, handle) {
  const col = Math.floor(districtIndex / 2);
  const ncols = Math.ceil(DISTRICTS.length / 2);
  const dir = districtIndex % 2 === 0 ? -1 : 1;         // north / south of boulevard
  const dx = (col - (ncols - 1) / 2) * COL_SPACING;

  const sideOfStreet = slot % 2 === 0 ? -1 : 1;
  const row = Math.floor(slot / 2);
  const h = hash32(handle);
  const w = 6.5 + (h % 5) * 0.55;
  const d = 6.5 + ((h >>> 4) % 5) * 0.55;
  const height = 6 + ((h >>> 8) % 10);
  return {
    x: dx + sideOfStreet * OFFSET,
    z: dir * (FIRST_ROW + row * CELL),
    w, d, h: height,
    rot: 0,
  };
}

/* Build the full world payload from merchant rows (already filtered to
 * status='active', ordered by created_at within district). */
function buildWorld(merchants) {
  const byDistrict = new Map(DISTRICTS.map((d) => [d.key, []]));
  for (const m of merchants) {
    (byDistrict.get(m.category) || byDistrict.get('community')).push(m);
  }
  const ncols = Math.ceil(DISTRICTS.length / 2);
  const districts = DISTRICTS.map((d, i) => {
    const col = Math.floor(i / 2);
    const dir = i % 2 === 0 ? -1 : 1;
    const dx = (col - (ncols - 1) / 2) * COL_SPACING;
    const members = byDistrict.get(d.key);
    const placed = members.map((m, slot) => ({
      handle: m.handle,
      name: m.name,
      bio: (m.bio || '').slice(0, 140),
      accent: ACCENTS[(m.accent | 0) % ACCENTS.length],
      featured: !!m.featured,
      ...plotFor(i, slot, m.handle),
    }));
    const rows = Math.max(2, Math.ceil(members.length / 2) + 2); // leave vacant lots visible
    return {
      key: d.key, name: d.name, desc: d.desc,
      x: dx, dir,
      street: { x: dx, z0: dir * BLVD_HALF, z1: dir * (FIRST_ROW + rows * CELL) },
      vacantLots: vacantLots(i, placed.length, rows),
      merchants: placed,
    };
  });
  const halfSpan = ((ncols - 1) / 2) * COL_SPACING + COL_SPACING / 2 + 20;
  // The plaza is the market's west gate, past the first district column —
  // never on the boulevard axis, where center-column streets and building
  // pads would clip into it.
  const plazaX = -(halfSpan + 24);
  return {
    boulevard: { x0: plazaX, x1: halfSpan, half: BLVD_HALF },
    plaza: { x: plazaX, z: 0, r: 15 },
    streetHalf: STREET_HALF,
    districts,
  };
}

/* Vacant lot positions for the client renderer. */
function vacantLots(districtIndex, taken, rows) {
  const lots = [];
  for (let slot = taken; slot < rows * 2; slot++) {
    lots.push(plotFor(districtIndex, slot, `vacant-${slot}`));
  }
  return lots;
}

module.exports = { DISTRICTS, DISTRICT_KEYS, ACCENTS, buildWorld, plotFor, vacantLots };
