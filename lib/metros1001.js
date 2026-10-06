'use strict';
/* Where a census row sits: kota -> metro -> province. One table for the whole site.
 *
 * Luca, 28 Sep 2026: the census covers ALL of Indonesia. It started as Greater
 * Jakarta (29 Aug), added the Bandung basin (30 Aug) and south Bali (31 Aug), and
 * each step hardcoded one more city in eight places. Worse, any kota outside the
 * Bandung and Bali sets silently became "Greater Jakarta" — a Surabaya company
 * would have been counted, city-paged and tagged as Jakarta without an error.
 * Every view now asks here instead.
 *
 * A METRO is one of the named agglomerations below, or — for a kota in none of
 * them — that kota on its own (id = its slug), so a Purwokerto company lands on
 * /city/banyumas rather than under Jakarta. A row with no kota at all stays in
 * Greater Jakarta: the two legacy rows like that are Jakarta companies with an
 * unrecorded district, and new rows must carry a kota (census-national.py asserts it).
 *
 * MAPPED: metros whose kota boundaries the census map loads (public/js/jakarta.js
 * METROS). A pin anywhere else would stand on blank paper, so the map leaves those
 * rows out until their boundaries are built, and their profiles drop the map link.
 * ANCHORED: metros the output estimator was built for. Its per-worker anchors are
 * BPS DKI Jakarta sector figures (Bandung and Bali were priced on them when they
 * joined). Elsewhere the output cell says "not estimated yet" instead of pricing a
 * Yogyakarta payroll at Jakarta productivity; regional anchors from BPS provincial
 * accounts are the fix, not a bigger guess.
 */

const NAMED = [
  { id: 'jakarta', en: 'Greater Jakarta', idn: 'Jakarta Raya', mapped: true, anchored: true,
    kota: ['Jakarta Selatan', 'Jakarta Pusat', 'Jakarta Barat', 'Jakarta Timur', 'Jakarta Utara',
      'Kepulauan Seribu', 'Jakarta', 'Tangerang', 'Tangerang Selatan', 'Kabupaten Tangerang',
      'Bekasi', 'Kabupaten Bekasi', 'Depok', 'Bogor', 'Kabupaten Bogor'] },
  { id: 'bandung', en: 'Bandung', idn: 'Bandung', mapped: true, anchored: true,
    kota: ['Bandung', 'Cimahi', 'Kabupaten Bandung', 'Kabupaten Bandung Barat'] },
  { id: 'bali', en: 'Bali', idn: 'Bali', mapped: true, anchored: true,
    kota: ['Denpasar', 'Kabupaten Badung', 'Kabupaten Gianyar', 'Kabupaten Tabanan'] },
  { id: 'surabaya', en: 'Surabaya', idn: 'Surabaya',
    kota: ['Surabaya', 'Kabupaten Sidoarjo', 'Kabupaten Gresik'] },
  { id: 'yogyakarta', en: 'Yogyakarta', idn: 'Yogyakarta',
    kota: ['Yogyakarta', 'Kabupaten Sleman', 'Kabupaten Bantul', 'Kabupaten Kulon Progo', 'Kabupaten Gunungkidul'] },
  { id: 'semarang', en: 'Semarang', idn: 'Semarang',
    kota: ['Semarang', 'Kabupaten Semarang', 'Salatiga', 'Kabupaten Kendal', 'Kabupaten Demak'] },
  { id: 'solo', en: 'Solo', idn: 'Solo',
    kota: ['Surakarta', 'Kabupaten Sukoharjo', 'Kabupaten Karanganyar', 'Kabupaten Boyolali'] },
  { id: 'malang', en: 'Malang', idn: 'Malang',
    kota: ['Malang', 'Kabupaten Malang', 'Batu'] },
  { id: 'medan', en: 'Medan', idn: 'Medan',
    kota: ['Medan', 'Kabupaten Deli Serdang', 'Binjai'] },
  { id: 'makassar', en: 'Makassar', idn: 'Makassar',
    kota: ['Makassar', 'Kabupaten Gowa', 'Kabupaten Maros'] },
];

/* Province of the named metros' kota, for JSON-LD addressRegion. A row elsewhere
   carries its own `province` (the research record states it). */
const PROVINCE = {
  jakarta: null, // three provinces: resolved per kota below
  bandung: 'Jawa Barat', bali: 'Bali', surabaya: 'Jawa Timur', malang: 'Jawa Timur',
  yogyakarta: 'DI Yogyakarta', semarang: 'Jawa Tengah', solo: 'Jawa Tengah',
  medan: 'Sumatera Utara', makassar: 'Sulawesi Selatan',
};
const JAKARTA_PROVINCE = (core) => /^jakarta|^kepulauan seribu$/.test(core) ? 'DKI Jakarta'
  : /^tangerang/.test(core) ? 'Banten' : 'Jawa Barat';

/* "Kabupaten Sleman" and "Sleman" are the same place for matching; a kota and its
   kabupaten namesake always sit in the same metro above, so the core name is safe. */
const core = (k) => String(k || '').trim().toLowerCase()
  .replace(/^kota\s+(administrasi\s+)?/, '').replace(/^(kabupaten|kab\.?)\s+/, '');
const slug = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const BY_CORE = new Map();
for (const M of NAMED) for (const k of M.kota) BY_CORE.set(core(k), M.id);
const BY_ID = new Map(NAMED.map((M) => [M.id, M]));

/* metro id for a kota string (already normalised by build-census.js) */
function of(kota) {
  if (!kota) return 'jakarta';
  return BY_CORE.get(core(kota)) || slug(core(kota)) || 'jakarta';
}

/* display record for a metro id; `kota` names an unnamed single-kota metro */
function info(id, kota) {
  const M = BY_ID.get(id);
  if (M) return { id, en: M.en, idn: M.idn, mapped: !!M.mapped, anchored: !!M.anchored };
  const bare = String(kota || id).replace(/^kota\s+/i, '').replace(/^(kabupaten|kab\.?)\s+/i, '');
  const nice = bare.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return { id, en: nice, idn: nice, mapped: false, anchored: false };
}

const name = (id, lang, kota) => { const I = info(id, kota); return lang === 'id' ? I.idn : I.en; };
const mapped = (id) => !!(BY_ID.get(id) || {}).mapped;
const anchored = (id) => !!(BY_ID.get(id) || {}).anchored;

function province(kota, metroId) {
  const p = PROVINCE[metroId];
  if (p) return p;
  if (metroId === 'jakarta' && kota) return JAKARTA_PROVINCE(core(kota));
  return null;
}

module.exports = { NAMED, of, info, name, mapped, anchored, province, slug, core };
