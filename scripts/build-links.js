'use strict';
/* Assemble public/data/census-links.json — the relationship graph behind the
 * census's supply-chain view — from data/census-links.json (hand-authored,
 * evidence-first) and data/census-raw.json (the companies themselves).
 *
 * Two rules are enforced here rather than trusted:
 *   · an edge whose last verification FAILED is not published. scripts/links-verify.py
 *     re-fetches every source and stamps check=pass|fail; anything unverified or
 *     failing is dropped and counted in `withheld`, never rendered.
 *   · an edge may only name a census company by an id that exists. A relationship
 *     matched on a company's first name is how a census ends up citing the wrong
 *     firm, so an unknown id is a build error, not a silent skip.
 *
 * Counterparties outside the census are kept (from_name/to_name with a null id):
 * Blibli's bank rails and JNE are part of the picture even though neither is a
 * startup. They render as plain, unlinked names.
 *
 * Re-run after editing either file: node scripts/build-links.js
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'data', 'census-links.json');
const RAW = path.join(__dirname, '..', 'data', 'census-raw.json');
const OUT = path.join(__dirname, '..', 'public', 'data', 'census-links.json');

/* Relationship vocabulary. `flow` is what the arrow means in one line, and it is
   the same sentence in both directions so a reader never has to guess who pays whom. */
/* `shared` marks RAIL kinds (Luca, Aug 30): one payment gateway or aggregator
   serves much of the market at once, so such a link describes how a company
   plugs into shared infrastructure, not an exclusive supplier — the UI groups
   them separately and chain traversal never walks THROUGH them, or one wallet
   would connect everything to everything. */
const KINDS = {
  logistics: { label: 'Logistics', up: 'Ships for', down: 'Ships through' },
  payments: { label: 'Payments', up: 'Takes payments for', down: 'Takes payments through', shared: true },
  credit: { label: 'Consumer credit', up: 'Lends at checkout of', down: 'Offers credit through', shared: true },
  aggregation: { label: 'Aggregator listing', up: 'Listed on', down: 'Books capacity from', shared: true },
  software: { label: 'Software', up: 'Runs software for', down: 'Runs software from' },
  identity: { label: 'Identity', up: 'Is', down: 'Is' },
  channel: { label: 'Sales channel', up: 'Sells into', down: 'Sells for' },
  ownership: { label: 'Corporate', up: 'Owns', down: 'Owned by' },
  supply: { label: 'Goods', up: 'Supplies goods to', down: 'Buys goods from' },
};

const links = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
const co = new Map(raw.companies.map((c) => [c.id, c]));
const webp = (u) => (typeof u === 'string' && /^\/assets\/.+\.(png|jpe?g)$/i.test(u)
  && fs.existsSync(path.join(__dirname, '..', 'public', u.replace(/\.(png|jpe?g)$/i, '.webp')))
  ? u.replace(/\.(png|jpe?g)$/i, '.webp') : u);
let logos = {};
try { logos = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'census-logos.json'), 'utf8')); } catch { /* optional */ }

/* Three species of node, in one resolver:
   · a census company (id) — must exist, or the build fails loudly;
   · an EXTERNAL (ext) — a company the census does not count but whose chains the
     census companies' chains run through (FAS), declared in `externals` with its
     own evidence note, and traversable at /chain/x/<slug>;
   · a bare name — a counterparty worth showing but not worth a node (JNE). */
const externals = links.externals || {};
const node = (id, ext, fallback) => {
  if (id) {
    const c = co.get(id);
    if (!c) throw new Error(`census-links.json names a company id that is not in the census: ${id}`);
    return { id, name: c.name, logo: webp((logos[id] && logos[id].logo) || c.logo || null), sector: c.sector_label || null };
  }
  if (ext) {
    const x = externals[ext];
    if (!x) throw new Error(`census-links.json names an external slug that is not declared: ${ext}`);
    return { id: null, ext, name: x.name, legal: x.legal || null, url: x.url || null, off: true };
  }
  return { id: null, name: fallback || 'Not in the census', off: true };
};

const byCompany = {};
const byExternal = {};
const bucket = (id) => (byCompany[id] = byCompany[id] || { up: [], down: [], corp: [] });
const xbucket = (slug) => (byExternal[slug] = byExternal[slug]
  || { ...externals[slug], up: [], down: [], corp: [], identity: [] });
let withheld = 0;
const kept = [];
for (const e of links.edges) {
  if (e.check !== 'pass') { withheld++; continue; }
  const src = links.sources[e.src];
  if (!src) throw new Error(`edge cites an unknown source id: ${e.src}`);
  const from = node(e.from, e.from_ext, e.from_name);
  const to = node(e.to, e.to_ext, e.to_name);
  const kind = KINDS[e.kind] || { label: e.kind, up: 'Serves', down: 'Served by' };
  const rec = {
    kind: e.kind,
    kindLabel: kind.label,
    shared: !!kind.shared,
    what: e.what,
    stake: e.stake || null,
    note: e.note || null,
    tier: src.tier,
    asof: src.asof || null,
    checked: e.checked,
    src: { id: e.src, url: src.url, publisher: src.publisher, title: src.title, note: src.note || null },
    quote: e.quote,
  };
  kept.push({ ...rec, from, to });
  /* identity edges carry the naming bridge (FAS = PT Global Distribusi Pusaka);
     they are evidence about a node, not a flow between two */
  if (e.kind === 'identity') {
    if (e.from_ext) xbucket(e.from_ext).identity.push(rec);
    continue;
  }
  /* Corporate sits in its own bucket on both sides: "owns" and "owned by" are
     not upstream/downstream and reading them as supply would be wrong. */
  const put = (n, list, entry) => {
    if (n.id) bucket(n.id)[list].push(entry);
    else if (n.ext) xbucket(n.ext)[list].push(entry);
  };
  if (e.kind === 'ownership') {
    put(from, 'corp', { ...rec, dir: 'owns', other: to });
    put(to, 'corp', { ...rec, dir: 'owned', other: from });
  } else {
    put(to, 'up', { ...rec, verb: kind.down, other: from });
    put(from, 'down', { ...rec, verb: kind.up, other: to });
  }
}
/* Order: goods before money before software, and inside a kind the strongest
   evidence first — a filing outranks a help page, and both outrank a report. */
const KORDER = ['logistics', 'supply', 'software', 'channel', 'ownership', 'payments', 'credit', 'aggregation'];
const order = { filing: 0, 'first-party': 1, reported: 2 };
for (const b of [...Object.values(byCompany), ...Object.values(byExternal)]) {
  for (const list of [b.up, b.down, b.corp]) {
    list.sort((x, y) => (KORDER.indexOf(x.kind) + 1 || 99) - (KORDER.indexOf(y.kind) + 1 || 99)
      || (order[x.tier] ?? 9) - (order[y.tier] ?? 9) || x.other.name.localeCompare(y.other.name));
  }
}
const out = {
  generated: new Date().toISOString(),
  verified: links.verified || null,
  kinds: KINDS,
  sources: links.sources,
  excluded: links.excluded || [],
  counts: {
    /* identity edges are naming bridges, not relationships — the headline
       count must not inflate by them */
    edges: kept.filter((e) => e.kind !== 'identity').length,
    withheld,
    companies: Object.keys(byCompany).length,
    externals: Object.keys(byExternal).length,
    census_companies: raw.companies.length,
    by_tier: kept.reduce((m, e) => { m[e.tier] = (m[e.tier] || 0) + 1; return m; }, {}),
    off_census: kept.filter((e) => !e.from.id || !e.to.id).length,
  },
  byCompany,
  byExternal,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`census-links.json: ${kept.length} relationships across ${out.counts.companies} companies`
  + ` (${Object.entries(out.counts.by_tier).map(([k, v]) => `${v} ${k}`).join(', ')}`
  + `, ${out.counts.off_census} touching a non-census counterparty)`);
if (withheld) console.warn(`  ! ${withheld} edge(s) withheld — unverified or failing. Run scripts/links-verify.py`);
