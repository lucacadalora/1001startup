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
/* `layer` (Luca, 29 Sep: "technology and manufacturing chain, not just
   services"): the CHAIN is who makes, supplies, powers and hosts whom, as on
   Bloomberg's SPLC; a SERVICE (delivery, payments, lending, a sales channel)
   is kept and shown, but apart and quieter, and the chain is never walked
   through it.
   `shared` marks RAIL kinds (Luca, Aug 30): one payment gateway or aggregator
   serves much of the market at once, so such a link describes how a company
   plugs into shared infrastructure, not an exclusive supplier — chain
   traversal never walks THROUGH them, or one wallet would connect everything
   to everything. A hyperscaler is the same kind of rail, but the kind
   (infrastructure) is not: a data centre hosting one cloud provider is chain.
   So an external can carry `rail: true`, and any edge touching it is shared. */
const KINDS = {
  materials: { label: 'Materials', up: 'Supplies materials to', down: 'Buys materials from', layer: 'chain' },
  components: { label: 'Parts & components', up: 'Supplies parts to', down: 'Buys parts from', layer: 'chain' },
  manufacturing: { label: 'Contract manufacturing', up: 'Manufactures for', down: 'Manufactured by', layer: 'chain' },
  supply: { label: 'Goods', up: 'Supplies goods to', down: 'Buys goods from', layer: 'chain' },
  hardware: { label: 'Hardware', up: 'Supplies hardware to', down: 'Runs hardware from', layer: 'chain' },
  energy: { label: 'Energy', up: 'Powers', down: 'Powered by', layer: 'chain' },
  software: { label: 'Software', up: 'Runs software for', down: 'Runs software from', layer: 'chain' },
  infrastructure: { label: 'Cloud & infrastructure', up: 'Hosts', down: 'Runs on', layer: 'chain' },
  technology: { label: 'Technology licence', up: 'Licenses technology to', down: 'Licenses technology from', layer: 'chain' },
  logistics: { label: 'Logistics', up: 'Ships for', down: 'Ships through', layer: 'service' },
  channel: { label: 'Sales channel', up: 'Sells into', down: 'Sells for', layer: 'service' },
  /* a POS or store tool plugging into a marketplace's API: the marketplace is
     its merchants' sales channel, not a customer buying technology */
  integration: { label: 'Platform integration', up: 'Integrates with', down: 'Integrated with', layer: 'service' },
  service: { label: 'Business services', up: 'Provides services to', down: 'Uses services from', layer: 'service' },
  payments: { label: 'Payments', up: 'Takes payments for', down: 'Takes payments through', shared: true, layer: 'service' },
  credit: { label: 'Consumer credit', up: 'Lends at checkout of', down: 'Offers credit through', shared: true, layer: 'service' },
  aggregation: { label: 'Aggregator listing', up: 'Listed on', down: 'Books capacity from', shared: true, layer: 'service' },
  identity: { label: 'Identity', up: 'Is', down: 'Is', layer: 'corp' },
  ownership: { label: 'Corporate', up: 'Owns', down: 'Owned by', layer: 'corp' },
};

/* SPLC's numbers: what a filing says the relationship is worth. `of` names
   whose total the share is taken from, because "14%" alone never says whether
   it is 14% of the buyer's purchases or of the seller's revenue. */
/* `of`: from_revenue = share of the SELLER's revenue; to_purchases = share of the
   BUYER's purchases; to_revenue = the buyer's purchase set against its own
   revenue, which is how some IDX notes state the 10% test. */
const shareText = (s, fromName, toName) => {
  if (!s) return null;
  const whose = s.of === 'from_revenue' ? fromName : toName;
  const base = s.of === 'to_purchases' ? ['purchases', 'pembelian'] : ['revenue', 'pendapatan'];
  const pct = s.pct != null ? `${s.pct}%` : null;
  const eq = s.of === 'to_revenue';
  return {
    en: [s.amount && `${s.amount}${s.period ? ` in ${s.period}` : ''}`,
      pct && `${eq ? 'equal to ' : ''}${pct} of ${whose}'s ${base[0]}`].filter(Boolean).join(' · '),
    id: [s.amount && `${s.amount}${s.period ? ` pada ${s.period}` : ''}`,
      pct && `${eq ? 'setara ' : ''}${pct} dari ${base[1]} ${whose}`].filter(Boolean).join(' · '),
  };
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
    return { id: null, ext, name: x.name, legal: x.legal || null, url: x.url || null, off: true, rail: !!x.rail };
  }
  return { id: null, name: fallback || 'Not in the census', off: true };
};

const byCompany = {};
const byExternal = {};
const bucket = (id) => (byCompany[id] = byCompany[id] || { up: [], down: [], corp: [] });
const xbucket = (slug) => (byExternal[slug] = byExternal[slug]
  || { ...externals[slug], up: [], down: [], corp: [], identity: [] });
/* Services are not published (Luca, 29 Sep: "we focus on the real
   supplychain, that polytron is ok but the services is not"). Delivery,
   payments, lending, sales channels and platform integrations stay in
   data/census-links.json with their evidence, so bringing them back is this one
   set, but nothing of that layer reaches the page, the sitemap or the counts. */
const PUBLISHED_LAYERS = new Set(['chain', 'corp']);
let withheld = 0;
let unpublished = 0;
const kept = [];
for (const e of links.edges) {
  if (!KINDS[e.kind]) throw new Error(`edge uses an unknown kind: ${e.kind} (${e.src})`);
  if (!PUBLISHED_LAYERS.has(KINDS[e.kind].layer)) { unpublished++; continue; }
  if (e.check !== 'pass') { withheld++; continue; }
  const src = links.sources[e.src];
  if (!src) throw new Error(`edge cites an unknown source id: ${e.src}`);
  const from = node(e.from, e.from_ext, e.from_name);
  const to = node(e.to, e.to_ext, e.to_name);
  const kind = KINDS[e.kind];
  if (!kind) throw new Error(`edge uses an unknown kind: ${e.kind} (${e.src})`);
  const rec = {
    kind: e.kind,
    kindLabel: kind.label,
    layer: kind.layer,
    shared: !!kind.shared || !!from.rail || !!to.rail,
    what: e.what,
    stake: e.stake || null,
    share: shareText(e.share, from.name, to.name),
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
/* Order: the chain as it runs, from material to finished goods to what it all
   runs on, then the services; inside a kind the strongest evidence first — a
   filing outranks a help page, and both outrank a report. */
const KORDER = ['materials', 'components', 'manufacturing', 'supply', 'hardware', 'energy', 'software', 'infrastructure', 'technology',
  'channel', 'integration', 'logistics', 'service', 'payments', 'credit', 'aggregation', 'ownership'];
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
  /* only the documents a published relationship cites: a filing that proved
     nothing but a courier contract is not evidence for anything on the page */
  sources: Object.fromEntries(Object.entries(links.sources).filter(([id]) => kept.some((e) => e.src.id === id))),
  excluded: links.excluded || [],
  counts: {
    /* identity edges are naming bridges, not relationships — the headline
       count must not inflate by them */
    edges: kept.filter((e) => e.kind !== 'identity').length,
    chain: kept.filter((e) => e.layer === 'chain').length,
    services: kept.filter((e) => e.layer === 'service').length,
    unpublished,
    corporate: kept.filter((e) => e.kind === 'ownership').length,
    by_kind: Object.fromEntries(KORDER.map((k) => [k, kept.filter((e) => e.kind === k).length]).filter(([, n]) => n)),
    withheld,
    companies: Object.keys(byCompany).length,
    externals: Object.keys(byExternal).length,
    census_companies: raw.companies.length,
    by_tier: kept.filter((e) => e.kind !== 'identity').reduce((m, e) => { m[e.tier] = (m[e.tier] || 0) + 1; return m; }, {}),
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
