#!/usr/bin/env node
/* Freeze one /news post (views/blog1001.js) — the census data stories that
 * replaced THE WIRE on 18 Oct 2026 (Luca: "/news from blogs to boost our SEO
 * or GEO").
 *
 * A post is dated and quoted, so its numbers must not move: every figure is
 * computed ONCE here from public/data/census.json + data/closed.json and
 * written to data/news/<slug>.json. The copy in views/posts1001.js only ever
 * interpolates these fields — no number in a post is typed by hand or by a
 * model. Re-run for a slug only before that post is published.
 *
 *   node scripts/news-snapshot.js <slug> [--date YYYY-MM-DD]
 *   node scripts/news-snapshot.js all    [--date YYYY-MM-DD]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const inv = require('../views/investors1001');
const { slugClosed } = require('../views/closed1001');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'news');
const census = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'data', 'census.json'), 'utf8'));
const closed = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'closed.json'), 'utf8'));
const C = census.companies || [];
const r1 = (x) => Math.round(x * 10) / 10;
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/* 1 · funding events of 2026 ------------------------------------------------ */
/* The census keeps a company's LAST round; a 2026 last round = a 2026 event.
 * Rows whose record has no funding_src get a link picked by hand from that
 * row's OWN sources (funding_src_all / sources) — a link, never a figure. */
const ROUND_SRC = {
  bumame: 'https://keuangan.kontan.co.id/news/bidik-bisnis-kesehatan-llv-dan-spiral-ventures-investasi-di-bumame-dan-two-inc',
  'cekat-ai': 'https://www.insignia.vc/portfolio/cekat-ai',
  jumpstart: 'https://www.cj-fund.co.jp/en/files/press_260420-en.pdf',
  'dash-electric': 'https://www.dashelectric.co/newsroom/news/sagana-joins-dash-electric-seed-round',
  greenteams: 'https://www.globalinnovation.fund/news/news/gif-backs-green-teams-to-tackle-air-pollution-in-indonesia',
  ledgerowl: 'https://skystar.vc/ledgerowl-strategic-funding/',
  doctortool: 'https://www.dbs.com/newsroom/DBS_Foundation_disburses_IDR11_2_billion_to_5_social_enterprises_and_businesses_for_impact_to_promote_inclusion_of_vulnerable_communities_in_Indonesia',
  nusaqu: 'https://www.lbs.id/detail/nusaqu-v5tu',
};
/* what kind of money the recorded round is, read off the census label */
function roundKind(label) {
  const s = String(label || '').toLowerCase();
  if (/\bipo\b/.test(s)) return 'ipo';
  if (/acquisition|acquired/.test(s)) return 'acquisition';
  if (/grant/.test(s)) return 'grant';
  if (/sukuk|crowdfunding/.test(s)) return 'crowdfunding';
  return 'venture';
}
/* a US-dollar amount only when the census label states one in US$ —
 * S$ / Rp figures and "undisclosed" stay null (shown as a dash) */
function statedUsdM(label) {
  /* "$12.5M", "US$9M", "~US$290K"; the [^A-Za-z] guard keeps "S$500,000" out */
  const m = String(label || '').match(/(?:^|[^A-Za-z])(?:US)?\$\s?([\d.,]+)\s?(M|million|K)\b/);
  if (!m) return null;
  const v = parseFloat(m[1].replace(/,/g, ''));
  return m[2] === 'K' ? Math.round(v) / 1000 : v;
}
function rounds2026() {
  const rows = C.filter((c) => c.last_round_year === 2026).map((c) => {
    const kind = roundKind(c.last_round);
    const usd = statedUsdM(c.last_round);
    const src = c.funding_src || ROUND_SRC[c.id] || '';
    return { id: c.id, name: c.name, logo: c.logo || '', sector: c.sector_label || '', sector_key: c.sector_key || '',
      city: c.kota || '', label: c.last_round, kind, usd_m: usd, src, src_host: host(src) };
  }).sort((a, b) => (b.usd_m || 0) - (a.usd_m || 0) || a.name.localeCompare(b.name));
  const missing = rows.filter((r) => !r.src).map((r) => r.id);
  if (missing.length) throw new Error('2026 rounds with no source link: ' + missing.join(', '));
  const byKind = {};
  for (const r of rows) byKind[r.kind] = (byKind[r.kind] || 0) + 1;
  const venture = rows.filter((r) => r.kind === 'venture');
  const stated = venture.filter((r) => r.usd_m != null);
  const bySector = {};
  for (const r of rows) bySector[r.sector] = (bySector[r.sector] || 0) + 1;
  return {
    rows, by_kind: byKind,
    venture: venture.length,
    venture_stated: stated.length,
    venture_stated_usd_m: r1(stated.reduce((a, r) => a + r.usd_m, 0)),
    largest: stated[0] ? { id: stated[0].id, name: stated[0].name, usd_m: stated[0].usd_m, label: stated[0].label } : null,
    by_sector: Object.entries(bySector).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => ({ sector: k, n })),
  };
}

/* 2 · biggest employers ---------------------------------------------------- */
/* Only a headcount that is dated in 2026 AND linked counts (Luca, 29 Aug:
 * "you cant use 2024 data"). Bigger rows that fail that are named, not ranked. */
function countKind(c) {
  const h = host(c.employees_src);
  if (/linkedin\.com$/.test(h)) return 'linkedin';
  if (/reveliolabs\.com$/.test(h)) return 'revelio';
  if (/stockanalysis\.com$|idx\.co\.id$/.test(h) || c.employees_kind === 'company') return 'filing';
  return 'company';
}
function employers() {
  const withN = C.filter((c) => typeof c.employees_est === 'number' && c.employees_est > 0);
  const ok = (c) => /^2026/.test(String(c.employees_asof || '')) && !!c.employees_src;
  const ranked = withN.filter(ok).sort((a, b) => b.employees_est - a.employees_est);
  const top = ranked.slice(0, 20).map((c) => ({ id: c.id, name: c.name, logo: c.logo || '', sector: c.sector_label || '',
    n: c.employees_est, asof: String(c.employees_asof), kind: countKind(c), src: c.employees_src, src_host: host(c.employees_src),
    group: (c.global_parent && c.global_parent.group) || null }));
  const floor = top.length ? top[top.length - 1].n : 0;
  /* every row that would have made the table on size alone but has no 2026-dated, linked figure */
  const left = withN.filter((c) => !ok(c) && c.employees_est >= floor).sort((a, b) => b.employees_est - a.employees_est)
    .map((c) => ({ id: c.id, name: c.name, n: c.employees_est, asof: c.employees_asof || null,
      why: c.employees_asof ? 'old' : 'undated' }));
  const kinds = {};
  for (const r of top) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  return {
    rows: top, left_out: left, kinds,
    ranked_total: ranked.length, with_figure: withN.length,
    top_sum: top.reduce((a, r) => a + r.n, 0),
    all_sum: ranked.reduce((a, c) => a + c.employees_est, 0),
  };
}

/* 3 · most active investors ------------------------------------------------ */
/* the same per-company count as /investors and the October report */
function investors() {
  const by = new Map();
  for (const c of C) {
    const seen = new Set();
    for (const s of c.investors || []) {
      const name = inv.parseInv(s).name;
      if (!name) continue;
      const k = inv.slugInv(name);
      if (seen.has(k)) continue;
      seen.add(k);
      const e = by.get(k) || { slug: k, name, n: 0, cos: [] };
      e.n++;
      e.cos.push(c);
      by.set(k, e);
    }
  }
  const all = [...by.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const top = all.slice(0, 15).map((e) => {
    const sectors = {};
    for (const c of e.cos) sectors[c.sector_label] = (sectors[c.sector_label] || 0) + 1;
    const sec = Object.entries(sectors).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || ['', 0];
    const r26 = e.cos.filter((c) => c.last_round_year === 2026).map((c) => ({ id: c.id, name: c.name }));
    const biggest = e.cos.filter((c) => typeof c.funding_total_usd_m === 'number' && c.funding_total_usd_m > 0)
      .sort((a, b) => b.funding_total_usd_m - a.funding_total_usd_m).slice(0, 3).map((c) => ({ id: c.id, name: c.name, logo: c.logo || '' }));
    return { slug: e.slug, name: e.name, n: e.n, top_sector: sec[0], top_sector_n: sec[1], rounds_2026: r26, biggest };
  });
  return {
    rows: top,
    named: all.length,
    companies_with_named: C.filter((c) => (c.investors || []).length).length,
    one_company: all.filter((e) => e.n === 1).length,
    five_plus: all.filter((e) => e.n >= 5).length,
  };
}

/* 4 · the shutdown register ------------------------------------------------ */
function shutdowns() {
  const E = closed.entries || [];
  const rows = E.map((e) => ({
    name: e.name, slug: slugClosed(e.name), sector: String(e.sector || '').split(' — ')[0], city: e.city,
    founded: e.founded || null, ended: String(e.ended || ''), fate: e.fate, confidence: e.confidence || 'confirmed',
    usd_m: typeof e.funding_usd_m === 'number' ? e.funding_usd_m : null,
    src: (e.sources || [])[0] || '', src_host: host((e.sources || [])[0] || ''),
  })).sort((a, b) => b.ended.localeCompare(a.ended) || a.name.localeCompare(b.name));
  const byYear = {};
  for (const r of rows) { const y = r.ended.slice(0, 4); if (y) byYear[y] = (byYear[y] || 0) + 1; }
  const bySector = {};
  for (const r of rows) bySector[r.sector] = (bySector[r.sector] || 0) + 1;
  const funded = rows.filter((r) => r.usd_m != null).sort((a, b) => b.usd_m - a.usd_m);
  const years = Object.keys(byYear).map(Number);
  const worst = Object.entries(byYear).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    rows, by_year: byYear, first_year: Math.min(...years), last_year: Math.max(...years),
    worst_year: worst[0], worst_n: worst[1],
    by_sector: Object.entries(bySector).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => ({ sector: k, n })),
    confirmed: rows.filter((r) => r.confidence === 'confirmed').length,
    reported: rows.filter((r) => r.confidence !== 'confirmed').length,
    funded: funded.length, funded_usd_m: r1(funded.reduce((a, r) => a + r.usd_m, 0)),
    top_funded: funded.slice(0, 5).map((r) => ({ name: r.name, slug: r.slug, usd_m: r.usd_m, ended: r.ended })),
    no_source: rows.filter((r) => !r.src).map((r) => r.name),
  };
}

const POSTS = {
  'indonesian-startup-funding-rounds-2026': rounds2026,
  'biggest-startup-employers-indonesia-2026': employers,
  'most-active-startup-investors-indonesia': investors,
  'indonesian-startups-that-shut-down': shutdowns,
};

const args = process.argv.slice(2);
const slug = args[0];
const di = args.indexOf('--date');
const date = di >= 0 ? args[di + 1] : new Date().toISOString().slice(0, 10);
if (!slug || (slug !== 'all' && !POSTS[slug]) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error('usage: news-snapshot.js <' + Object.keys(POSTS).join('|') + '|all> [--date YYYY-MM-DD]');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
for (const s of slug === 'all' ? Object.keys(POSTS) : [slug]) {
  const out = { slug: s, date, frozen_at: new Date().toISOString(), census_generated: census.generated, companies: C.length, ...POSTS[s]() };
  const file = path.join(OUT, s + '.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log('wrote', path.relative(ROOT, file), '·', (out.rows || []).length, 'rows');
}
