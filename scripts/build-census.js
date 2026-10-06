'use strict';
/* Assemble public/data/census.json (the /census page's dataset) from
 * data/census-raw.json — the research workflow's output {companies, method, stats}.
 * Computes per-company estimated direct GVA (headcount × sector GVA/worker),
 * ranks by valuation → funding → jobs, and aggregates by sector and kota.
 * Estimates only; every parameter comes from the sourced method block.
 * Re-run any time census-raw.json changes: node scripts/build-census.js */
const fs = require('fs');
const path = require('path');

const RAW = process.env.CENSUS_RAW || path.join(__dirname, '..', 'data', 'census-raw.json');
/* The server serves public/data/census.json by mtime, so a normal build IS a
   publish. CENSUS_OUT=/tmp/x.json builds somewhere else for a dry run, and also
   skips the /model equation rebuild below (it would bake the test totals in). */
const OUT = process.env.CENSUS_OUT || path.join(__dirname, '..', 'public', 'data', 'census.json');

/* ORDERED: first regex that matches wins, so a sector string's wording decides
   its bucket — 'e-commerce courier' lands in Commerce, not Logistics, and
   'fresh-produce supply' in Logistics, not Agritech. Word the sector field for
   the bucket you want, or reorder here. */
const SECTOR_KEYS = [
  /* climate FIRST: 'carbon marketplace' must not fall into commerce, 'climate
     fintech' not into fintech — Luca wants the sustainability cohort visible */
  [/climate|carbon|sustainab|renewable|solar|waste|recycl|circular|\besg\b|emission|mangrove|reforest|air.quality|clean energy|bioplastic|reuse|refill|ev charging|charging network/i, 'climate', 'Climate & Sustainability'],
  /* banks BEFORE fintech, and matched on a phrase we control rather than on
     /neobank|digital banking/: that wording is marketing copy — Akulaku,
     KoinWorks and FAZZ all use it and none of them holds a bank licence. Every
     row in the bank bucket is an OJK-licensed commercial bank and is priced at
     its own anchor (see method caveats), not the discounted fintech one. */
  [/^licensed (digital )?bank/i, 'bank', 'Digital Banking'],
  /* crypto BEFORE fintech, on a controlled head-phrase like the bank rule:
     'crypto' appears mid-string in wealth-app copy (Ajaib: 'stocks, mutual
     funds, crypto') where it must NOT move the row. Only rows whose sector
     field is deliberately worded to LEAD with 'web3/crypto' belong here —
     Luca's dedicated crypto sector (Aug 30 2026), rows owned by
     scripts/census-crypto.py. */
  [/^web3\/crypto/i, 'crypto', 'Crypto'],
  [/fintech|payment|wallet|lend|bnpl|wealth|invest|remit|bank/i, 'fintech', 'Fintech'],
  [/insur/i, 'misc', 'Insurtech'],
  [/commerce|marketplace|retail|grocer/i, 'commerce', 'Commerce'],
  [/logist|deliver|freight|supply|warehous|courier/i, 'logistics', 'Logistics'],
  [/health|pharma|biotech|\bbio\b|medic|telemed/i, 'health', 'Healthtech'], // \bbio\b: keep biotech, not 'biometrics'/'biofuel'
  [/edtech|educat|upskill|learn/i, 'edtech', 'Edtech'],
  [/saas|enterprise|b2b|pos |dev tool|software/i, 'saas', 'SaaS'],
  [/\bai\b|artificial|data|cloud|cyber|it service/i, 'ai-cloud', 'AI & Cloud'],
  [/media|gaming|game|stream|entertain|creator|music|video/i, 'media', 'Media & Gaming'],
  [/travel|mobilit|transport|automotive|ride/i, 'travel', 'Travel & Mobility'],
  [/prop|construction|hospitality|real estate/i, 'prop', 'Proptech'],
  [/agri|aqua|fish|farm|rural/i, 'agri', 'Agritech'],
  [/f&b|fnb|food|kitchen|coffee|d2c|consumer brand|new retail/i, 'fnb', 'F&B & D2C'],
  /* web3|crypto removed from this catch-all: crypto routes ONLY via the
     head-phrase rule above, so a passing mid-string mention stays put. */
  [/hr |talent|legal|climate|energy|misc/i, 'misc', 'Other tech'],
];
function sectorKey(s) {
  const t = String(s || '');
  for (const [re, key, label] of SECTOR_KEYS) if (re.test(t)) return [key, label];
  return ['misc', 'Other tech'];
}

const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
/* Prefer the right-sized WebP whenever scripts/optimize-assets.py has made one,
   so a rebuild never quietly puts the 280KB PNGs back on the map. */
const webp = (u) => {
  if (typeof u !== 'string' || !/^\/assets\/.+\.(png|jpe?g)$/i.test(u)) return u;
  const alt = u.replace(/\.(png|jpe?g)$/i, '.webp');
  return fs.existsSync(path.join(__dirname, '..', 'public', alt)) ? alt : u;
};
/* sprite manifest — written by the asset-generation agent as sprites land;
   kept separate from census-raw.json so the two writers never race */
let sprites = {};
try { sprites = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'census-sprites.json'), 'utf8')); } catch {}
for (const c of raw.companies) if (c.id && sprites[c.id]) c.sprite = sprites[c.id];
/* hand-picked logo manifest — scripts/logo-pick.py writes it after a human has
   eyeballed the candidate marks. Same reason as sprites: census-raw.json is
   rewritten wholesale by the research loop, so picks live outside it. Wins over
   whatever census-icons.py auto-fetched, including its monogram fallback. */
let logos = {};
try { logos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'census-logos.json'), 'utf8')); } catch {}
for (const c of raw.companies) if (c.id && logos[c.id]) Object.assign(c, logos[c.id]);
/* valuation classification — scripts/census-valuation.py. Same single-writer
   reason as sprites and logos: census-raw.json is rewritten wholesale by the
   research loop and by a parallel session, which clobbered these stamps once. */
let vmarks = {};
try { vmarks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'census-valuation.json'), 'utf8')); } catch {}
for (const c of raw.companies) if (c.id && vmarks[c.id]) Object.assign(c, vmarks[c.id]);
/* rows where the estimator is known to run high — scripts/census-output-flags.py.
   A flag, never a correction: the figures are unchanged, but a reader can see
   which ones price couriers, baristas and village field officers at a Jakarta
   desk-sector average. Same single-writer reason as the three above. */
let oflags = {};
try { oflags = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'census-output-flags.json'), 'utf8')); } catch {}
for (const c of raw.companies) if (c.id && oflags[c.id]) Object.assign(c, oflags[c.id]);
for (const c of raw.companies) { c.sprite = webp(c.sprite); c.logo = webp(c.logo); }
const m = raw.method;
const perWorker = (key) => (m.gva_per_worker_idr_m_by_sector && m.gva_per_worker_idr_m_by_sector[key]) || m.default_gva_per_worker_idr_m;

/* Greater Jakarta is first-class (Luca, Aug 29): Bodetabek companies rank
   alongside DKI ones — in_dki stays on each record for map/rollup use.
   BANDUNG (Luca, Aug 30) and BALI (Aug 31) made `metro` a per-row field, DERIVED
   from kota rather than stored. NATIONWIDE (Luca, 28 Sep 2026): the census covers
   all of Indonesia, and the kota -> metro rule now lives in ONE table,
   lib/metros1001.js, which every view reads too. The old rule sent any kota
   outside the Bandung and Bali sets to 'jakarta', so a Surabaya row would have
   been counted as Greater Jakarta without an error. */
const METRO = require('../lib/metros1001');
const all = [];
const nearby = [];
for (const c of raw.companies) {
  const [key, label] = sectorKey(c.sector);
  c.sector_key = key;
  c.sector_label = label;
  if (c.kota) {
    c.kota = c.kota.replace(/^kota\s+(administrasi\s+)?/i, '')
      .replace(/^south jakarta$/i, 'Jakarta Selatan').replace(/^central jakarta$/i, 'Jakarta Pusat')
      .replace(/^west jakarta$/i, 'Jakarta Barat').replace(/^east jakarta$/i, 'Jakarta Timur')
      .replace(/^north jakarta$/i, 'Jakarta Utara')
      /* a province suffix, "(Banten)" or "(Jawa Timur)": the kota is the join key
         with the map's boundary names, so it must be the bare name */
      .replace(/\s*\([^()]*\)$/, '')
      .replace(/^south tangerang$/i, 'Tangerang Selatan');
  }
  c.metro = METRO.of(c.kota);
  const prov = c.province || METRO.province(c.kota, c.metro);
  if (prov) c.province = prov;
  /* frontline pricing (Luca, Aug 31: full payrolls back "with caveat/split"):
     a payroll marked frontline — couriers, store crews, field officers — is
     priced at the BPS national average (method.frontline_gva_per_worker_idr_m),
     not a DKI sector anchor; a company-published split prices office at the
     sector anchor and frontline at the national one. Keeps the sanity gate
     honest: FORE's output stays under its own audited revenue. */
  const fa = m.frontline_gva_per_worker_idr_m;
  const ws = c.workforce_split;
  /* Outside the anchored metros the anchors are someone else's productivity: a
     Yogyakarta payroll priced at DKI Jakarta's sector average would overstate it
     several-fold. The cell says "not estimated yet" (views/gva.js) until regional
     anchors exist; the headcount itself is untouched and still counts as jobs. */
  c.output_withheld = (c.employees_est && !METRO.anchored(c.metro)) ? 'regional_anchor' : undefined;
  c.est_gva_idr_bn = (!c.employees_est || c.output_withheld) ? null
    : (fa && ws && ws.office != null && ws.frontline != null)
      ? Math.round((ws.office * perWorker(key) + ws.frontline * fa) / 100) / 10
      : (fa && c.workforce_kind === 'frontline')
        ? Math.round((c.employees_est * fa) / 100) / 10
        : Math.round((c.employees_est * perWorker(key)) / 100) / 10;
  all.push(c);
}
const val = (x) => (x === null || x === undefined ? -1 : x);
all.sort((a, b) => val(b.valuation_usd_m) - val(a.valuation_usd_m)
  || val(b.funding_total_usd_m) - val(a.funding_total_usd_m)
  || val(b.employees_est) - val(a.employees_est));
all.forEach((c, i) => { c.rank = i + 1; });

const sum = (list, f) => list.reduce((s, c) => s + (c[f] || 0), 0);
const group = (list, keyF, nameF) => {
  const g = new Map();
  for (const c of list) {
    const k = keyF(c);
    if (!g.has(k)) g.set(k, { name: nameF(c) || k, count: 0, jobs: 0, gva_idr_bn: 0 });
    const e = g.get(k);
    e.count++; e.jobs += c.employees_est || 0; e.gva_idr_bn += c.est_gva_idr_bn || 0;
  }
  return [...g.values()].map((e) => ({ ...e, gva_idr_bn: Math.round(e.gva_idr_bn) }))
    .sort((a, b) => b.gva_idr_bn - a.gva_idr_bn);
};

/* COMBINED VALUATION — a plain sum of sourced marks, never modelled. Three
   rules are what make such a sum meaningful, and the page states all three:
     · coverage — most rows carry no mark at all, and a missing valuation is
       never imputed from funding or headcount;
     · containment — a subsidiary whose value already sits inside a counted
       parent's market capitalisation (valuation_parent_id) is left out, or
       Blibli would be counted three times over;
     · kind — a live market capitalisation is a different claim from a 2019
       private round, so the two are totalled separately.
   scripts/census-valuation.py stamps kind / asof / parent onto the rows. */
const valued = all.filter((c) => c.valuation_usd_m !== null && c.valuation_usd_m !== undefined);
for (const c of valued) c.valuation_counted = !c.valuation_parent_id;
const counted = valued.filter((c) => c.valuation_counted);
const vSum = (list) => Math.round(sum(list, 'valuation_usd_m') * 10) / 10;
const ofKind = (k) => counted.filter((c) => c.valuation_kind === k);
const asof = counted.map((c) => c.valuation_asof).filter(Boolean);

const gvaBn = Math.round(sum(all, 'est_gva_idr_bn'));
const out = {
  generated: new Date().toISOString(),
  stats: raw.stats,
  method: m,
  totals: {
    companies: all.length,
    funding_usd_b: Math.round(sum(all, 'funding_total_usd_m') / 100) / 10,
    valuation_usd_b: Math.round(vSum(counted) / 100) / 10,
    valuation_marked: counted.length,
    jobs: sum(all, 'employees_est'),
    gva_idr_t: Math.round(gvaBn / 100) / 10,
    gva_incl_indirect_idr_t: Math.round((gvaBn * (m.indirect_multiplier || 1)) / 100) / 10,
  },
  low_confidence: all.filter((c) => (c.confidence || 0) < 0.5).length,
  /* everything a reader needs to check the combined figure: what is in it,
     what kind of mark each part is, how old the oldest one is, and which rows
     were deliberately left out of the sum. */
  valuation: {
    marked: counted.length,
    with_mark: valued.length,
    combined_usd_m: vSum(counted),
    listed_usd_m: vSum(ofKind('listed')),
    listed_count: ofKind('listed').length,
    /* everything that is NOT a live market price, derived as the complement so
       a row that gains a valuation before scripts/census-valuation.py has
       classified it still lands somewhere real instead of vanishing */
    unlisted_usd_m: Math.round((vSum(counted) - vSum(ofKind('listed'))) * 10) / 10,
    unlisted_count: counted.length - ofKind('listed').length,
    est_counted: ofKind('est').length,
    oldest_asof: asof.length ? Math.min(...asof) : null,
    undated: counted.filter((c) => !c.valuation_asof).length,
    top: counted.slice().sort((a, b) => b.valuation_usd_m - a.valuation_usd_m).slice(0, 3)
      .map((c) => ({ name: c.name, usd_m: c.valuation_usd_m })),
    excluded: valued.filter((c) => !c.valuation_counted)
      .map((c) => ({
        name: c.name,
        usd_m: c.valuation_usd_m,
        parent: (all.find((p) => p.id === c.valuation_parent_id) || {}).name || c.valuation_parent_id,
        note: c.valuation_parent_note || '',
      })).sort((a, b) => b.usd_m - a.usd_m),
  },
  /* WHAT THE DISCLOSED-FUNDING TOTAL CONTAINS — the same accountability the combined
     valuation already gets. Aug 30 2026: 130 rows carried an empty funding cell with no
     explanation at all, which made one dash stand for four different facts. Every row now
     carries a funding_status, so the page can say how much of the column is a floor rather
     than a total, how much is public-market money rather than a venture round, and which
     kind of nothing each dash is. */
  funding: (() => {
    const st = (s) => all.filter((c) => c.funding_status === s);
    const withFig = all.filter((c) => c.funding_total_usd_m);
    const dashed = all.filter((c) => !c.funding_total_usd_m);
    const fSum = (list) => Math.round(sum(list, 'funding_total_usd_m') * 10) / 10;
    const parentFunded = dashed.filter((c) => c.funding_status === 'parent_funded' || c.id_only);
    return {
      with_figure: withFig.length,
      total_usd_m: fSum(withFig),
      /* the floor: rows whose own note says another round was never sized */
      floor_count: st('partial').length,
      floor_usd_m: fSum(st('partial')),
      /* public-market money sitting in a column most readers will read as venture money */
      listed_count: st('listed').length,
      listed_usd_m: fSum(st('listed')),
      tracker_count: withFig.filter((c) => c.funding_src_tier === 'tracker').length,
      sourced: withFig.filter((c) => c.funding_src).length,
      /* the four kinds of dash — counted off funding_status rather than derived by
         subtraction, so the label on each number is the thing the number counts. They
         sum to `dashed` exactly; if they ever stop doing so the page says so instead of
         quietly rounding the difference into "undisclosed". */
      undisclosed: dashed.filter((c) => c.funding_status === 'undisclosed').length,
      none_on_record: dashed.filter((c) => c.funding_status === 'none_on_record').length,
      parent_funded: parentFunded.length,
      /* capital of a kind the venture column does not hold: an IPO, a grant, a loan */
      other_capital: dashed.filter((c) => ['listed', 'grant_only', 'debt_only'].includes(c.funding_status)
        && !(c.funding_status === 'parent_funded' || c.id_only)).length,
      dashed: dashed.length,
      unexplained: dashed.filter((c) => !c.funding_note).length,
      top: withFig.slice().sort((a, b) => b.funding_total_usd_m - a.funding_total_usd_m).slice(0, 3)
        .map((c) => ({ name: c.name, usd_m: c.funding_total_usd_m })),
      floors: st('partial').slice().sort((a, b) => b.funding_total_usd_m - a.funding_total_usd_m)
        .map((c) => ({ name: c.name, id: c.id, usd_m: c.funding_total_usd_m, why: c.funding_floor_note || c.last_round || '' })),
    };
  })(),
  by_sector: group(all, (c) => c.sector_key, (c) => c.sector_label),
  /* Y Combinator lens: every YC company whose YC listing says Indonesia is
     accounted for — counted here, or in yc_outside with the reason it is not. */
  yc: {
    source: raw.yc_source || null,
    in_census: all.filter((c) => c.yc_batch).length,
    outside: raw.yc_outside || [],
    by_batch: Object.entries(all.filter((c) => c.yc_batch)
      .reduce((m, c) => { (m[c.yc_batch] = m[c.yc_batch] || []).push(c.name); return m; }, {}))
      .map(([batch, names]) => ({ batch, names }))
      .sort((x, y) => (x.batch.slice(1) - y.batch.slice(1))
        || (x.batch[0] === 'W' ? -1 : 1) - (y.batch[0] === 'W' ? -1 : 1)), // W before S inside a year
  },
  /* Endeavor lens: Endeavor selects ENTREPRENEURS, so the tag is founder-level
     and the company carries it. Same accountability rule as YC — every company
     on Endeavor Indonesia's roster is either counted here or in
     endeavor_outside with the reason it is not. */
  endeavor: {
    source: raw.endeavor_source || null,
    in_census: all.filter((c) => c.endeavor).length,
    outside: raw.endeavor_outside || [],
    pending: raw.endeavor_pending || [],
    companies: all.filter((c) => c.endeavor)
      .map((c) => ({ name: c.name, year: c.endeavor_year || null, who: c.endeavor_entrepreneurs || [] }))
      .sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name)),
  },
  /* Antler lens: same accountability rule again — every company on the
     evidenced Antler Indonesia roster is counted here, in antler_pending
     ("on the roster, not yet in the census"), or in antler_outside with the
     reason. scripts/census-antler.py owns the registers. */
  antler: {
    source: raw.antler_source || null,
    in_census: all.filter((c) => c.antler).length,
    outside: raw.antler_outside || [],
    pending: raw.antler_pending || [],
    companies: all.filter((c) => c.antler)
      .map((c) => ({ name: c.name, year: c.antler_year || null, note: c.antler_note || null }))
      .sort((a, b) => (a.year || 9999) - (b.year || 9999) || a.name.localeCompare(b.name)),
  },
  by_kota: group(all, (c) => (c.kota || 'unknown').toLowerCase(), (c) => c.kota || 'Unlocated'),
  /* one row per metro the census covers — what the map's city switch, the city
     pages and the landing's scope line all read, so none re-implements the kota
     rule. Derived from the rows (nationwide since 28 Sep 2026), largest first;
     `mapped` / `anchored` say whether the map draws it and whether its output is
     estimated (lib/metros1001.js). */
  by_metro: [...new Set(all.map((c) => c.metro))].map((id) => {
    const rows = all.filter((c) => c.metro === id);
    const I = METRO.info(id, (rows.find((c) => c.kota) || {}).kota);
    return {
      id,
      name: I.en,
      name_id: I.idn,
      mapped: I.mapped,
      anchored: I.anchored,
      /* Greater Jakarta spans DKI Jakarta, Banten and Jawa Barat: no one province */
      province: id === 'jakarta' ? null : ((rows.find((c) => c.province) || {}).province || null),
      count: rows.length,
      jobs: sum(rows, 'employees_est'),
      funding_usd_m: Math.round(sum(rows, 'funding_total_usd_m') * 10) / 10,
      gva_idr_bn: Math.round(sum(rows, 'est_gva_idr_bn')),
      located: rows.filter((c) => c.lat && c.lon).length,
    };
  }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  /* scope: where the line is drawn and who falls outside it. Published for the
     same reason as yc_outside and the removals — a boundary that only exists in
     a script docstring reads to a visitor as a gap, which is exactly how the
     missing digital banks read until Luca asked why Superbank was not here. */
  scope: raw.scope || null,
  /* liveness: what the screen checked, and what it took out. Published so the
     table can be read as "checked", not merely "collected". */
  liveness: {
    checked: (all.find((c) => c.liveness_checked) || {}).liveness_checked || null,
    removed: raw.removed || [],
    site_ok: all.filter((c) => String(c.site_status || '').startsWith('ok')).length,
  },
  companies: all,
  nearby,
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`census.json: ${all.length} companies (+${nearby.length} nearby), jobs≈${out.totals.jobs}, direct GVA≈IDR ${out.totals.gva_idr_t}T/yr, ${out.low_confidence} low-confidence`);
console.log(`  valuation: US$${out.totals.valuation_usd_b}B combined across ${counted.length} marked rows (${out.valuation.listed_count} listed, ${out.valuation.unlisted_count} private/other), ${out.valuation.excluded.length} excluded as already inside a parent`);
const unclassified = counted.filter((c) => !c.valuation_kind);
if (unclassified.length) console.warn(`  ! ${unclassified.length} valuation row(s) unclassified — run scripts/census-valuation.py: ${unclassified.map((c) => c.id).join(', ')}`);

/* keep /model's baked equation SVGs quoting the same totals as the fresh census */
if (!process.env.CENSUS_OUT) {
  try {
    require('child_process').execSync(`node ${JSON.stringify(path.join(__dirname, 'build-model-tex.js'))}`, { stdio: 'inherit' });
  } catch (e) {
    console.warn('build-model-tex.js failed — /model equations may quote stale totals:', e.message);
  }
}
