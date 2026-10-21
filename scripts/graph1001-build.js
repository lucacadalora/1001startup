#!/usr/bin/env node
'use strict';
/**
 * 1001's company graph: one file that joins the five datasets (Luca, 21 Oct
 * 2026: "build data/graph1001.json (one ID per company, every edge with its
 * source, a reviewed alias list) plus a connections tool ... for Ask 1001").
 *
 *   node scripts/graph1001-build.js              build data/graph1001.json + data/graph1001-report.json
 *   node scripts/graph1001-build.js --check      build in memory, print the numbers, write nothing
 *
 * Reads only the files the public pages already render from, never the web:
 *   public/data/census.json      startups, and the investors named on their rows (views/investors1001 graph)
 *   data/census-links.json       the /chain links between startups and outside companies (check = pass only)
 *   data/bumn-56.json            the 56 BUMN
 *   data/bumn-subs.json          their subsidiaries and stakes (the owns tree)
 *   data/bumn-sankey.json        legal names of group companies, which BUMN have a /bumn/<slug> map
 *   data/bumn-ties.json          BUMN ties to data centres (the /bumn card's ties block)
 *   data/datacenter.json         the 72 data-centre projects: operator, tenant of, power suppliers, vendors
 *   data/dc-webs/<slug>.json     the 8 data-centre company webs (/data-center/<slug>)
 *   data/peering-graph.json      buildings, exchanges, networks and who is where (dc.1001startup.id)
 *   data/peering.json            the peering map's checked buildings: which 1001 data-centre project each is
 *   public/data/umkm.json        the exporters (/umkm): names, places, sectors only, never email or phone
 *   data/graph1001-aliases.json  the REVIEWED alias list: which records across datasets are one company
 *
 * One ID per company. Every record starts as a ref "<dataset letter>:<its own id>"
 * (s startup, i investor, b BUMN, u BUMN subsidiary, c chain outside company, w
 * data-centre web entity, n network by AS number, e exporter, k a company only
 * named in a link, d data-centre project, f peering building, x internet exchange).
 * Refs merge into one node ONLY when graph1001-aliases.json says so ("same"), or
 * when two links name a company with the very same words (k refs). Name and
 * website matches between different records are only CANDIDATES: the build lists
 * the ones nobody has reviewed yet in the report and never merges them by itself.
 * Places (projects, buildings, exchanges, campuses) never merge with companies;
 * they are tied to them by edges (operates, same site, in building).
 *
 * Writes data/graph1001.json (gitignored: it carries the peering map's PeeringDB
 * links, which its AUP says not to pass on in bulk) and data/graph1001-report.json
 * (the numbers and the unreviewed candidates). lib/ask1001.js reads the graph with
 * an mtime cache, so a rebuild needs no restart.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CHECK = process.argv.includes('--check');
const OUT = path.join(ROOT, 'data', 'graph1001.json');
const REPORT = path.join(ROOT, 'data', 'graph1001-report.json');
const ALIASES = path.join(ROOT, 'data', 'graph1001-aliases.json');

const readJson = (rel, fallback) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch (e) {
    if (fallback !== undefined) { console.error(`graph1001: ${rel} unreadable (${e.code || e.message}), left out`); return fallback; }
    throw e;
  }
};
const str = (s) => (s === null || s === undefined ? '' : String(s));
const norm = (s) => str(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/&/g, ' and ').replace(/['’`´]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s) => norm(s).replace(/ /g, '-').slice(0, 60).replace(/-+$/, '');
const LEGAL = /\b(pt|tbk|persero|perseroda|perum|cv|pte|ltd|limited|inc|corp|corporation|co|company|the|plc|llc|bhd|sdn)\b/g;
const LOOSE = /\b(indonesia|indonesian|group|grup|holding|holdings|international|internasional|global|tbk|data ?cent(er|re)s?|dc)\b/g;
/* the two match keys of a name: strict (legal words out) and loose (also the generic words) */
const strictKey = (s) => norm(str(s).replace(/\([^)]*\)/g, ' ')).replace(LEGAL, ' ').replace(/\s+/g, '');
const looseKey = (s) => norm(str(s).replace(/\([^)]*\)/g, ' ')).replace(LEGAL, ' ').replace(LOOSE, ' ').replace(/\s+/g, '');
const hostOf = (u) => { try { return new URL(/^https?:/i.test(str(u)) ? u : 'https://' + u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
const logoHost = (l) => { const m = /\/logo\/([a-z0-9.-]+\.[a-z]{2,})\.(png|webp|svg|jpg)$/i.exec(str(l)); return m ? m[1].replace(/^www\./, '').toLowerCase() : ''; };
/* hosts that are platforms, not a company's own site */
const SHARED_HOSTS = /(^|\.)(linkedin\.com|instagram\.com|facebook\.com|tiktok\.com|youtube\.com|x\.com|twitter\.com|wa\.me|google\.com|sites\.google\.com|blogspot\.com|wordpress\.com|wixsite\.com|tokopedia\.com|shopee\.co\.id|bukalapak\.com|linktr\.ee|inaexport\.id|indonetwork\.co\.id|alibaba\.com|made-in-indonesia\.com|indotrading\.com|github\.io|notion\.site|medium\.com|apps\.apple\.com|play\.google\.com)$/;

/* ───────────────────────── refs (one per record) ───────────────────────── */

const refs = new Map();            // ref -> { ref, kind, place, names:Set, hosts:Set, n, h, info }
const COMPANY_KINDS = new Set(['s', 'i', 'b', 'u', 'c', 'w', 'n', 'e', 'k']);
function addRef(ref, o) {
  let r = refs.get(ref);
  if (!r) {
    r = { ref, kind: ref[0], place: !COMPANY_KINDS.has(ref[0]) || !!o.place, names: new Set(), hosts: new Set(), n: '', h: null, info: {} };
    refs.set(ref, r);
  }
  for (const nm of [o.n, ...(o.also || [])]) if (str(nm).trim()) r.names.add(str(nm).trim());
  if (!r.n && o.n) r.n = str(o.n).trim();
  if (o.h && !r.h) r.h = o.h;
  for (const h of o.hosts || []) if (h && !SHARED_HOSTS.test(h)) r.hosts.add(h);
  if (o.info) Object.assign(r.info, o.info);
  return ref;
}
/* a company only named in a link: the same words, the same ref */
const kRef = (name) => { const s = slug(str(name).replace(/\([^)]*\)/g, ' ')) || slug(name); return s ? addRef('k:' + s, { n: str(name).trim() }) : null; };

/* ───────────────────────── edges ───────────────────────── */

const sources = [];
const srcIdx = new Map();
function src(o) {
  if (!o) return -1;
  const u = str(o.u).trim();
  const t = str(o.t).trim() || hostOf(u);
  const d = str(o.d).trim().slice(0, 10);
  if (!u && !t) return -1;
  const key = [u, t, d].join('|');
  if (!srcIdx.has(key)) { srcIdx.set(key, sources.length); sources.push({ u: u || undefined, t: t || undefined, d: d || undefined }); }
  return srcIdx.get(key);
}
const rawEdges = [];               // { a: ref, b: ref, t: type, w: what, s: src index, x: extra }
const TYPES = {
  invests: 'invests in', owns: 'owns', chain: 'works with', tie: 'tie',
  operates: 'operates', tenant: 'is a tenant of', powers: 'supplies power to', supplies: 'supplies',
  web: 'web link', in_building: 'is in', peers_at: 'peers at', switch_in: 'exchange switch in', same_site: 'is the same site as',
};
function edge(a, b, t, w, s, x) {
  if (!a || !b || a === b) return;
  rawEdges.push({ a, b, t, w: str(w).trim() || undefined, s: typeof s === 'number' ? s : -1, x: x && Object.keys(x).length ? x : undefined });
}

/* ───────────────────────── 1. startups + investors ───────────────────────── */

const census = readJson('public/data/census.json');
const INV = require(path.join(ROOT, 'views', 'investors1001'));
const sectorOf = (c) => c.sector_label || c.sector || '';
for (const c of census.companies || []) {
  addRef('s:' + c.id, {
    n: c.name, also: [c.legal_name], h: `/company/${encodeURIComponent(c.id)}`,
    hosts: [hostOf(c.url)], info: { sector: sectorOf(c), city: c.kota || undefined },
  });
}
const invGraph = INV.graph(census);
const censusSrc = src({ t: '1001 census', d: (census.generated || '').slice(0, 10) });
for (const e of invGraph.list) {
  addRef('i:' + e.slug, { n: e.name, also: [...((e.names && e.names.keys()) || [])], h: `/investor/${encodeURIComponent(e.slug)}`, info: { backs: e.cos.length } });
  for (const o of e.cos) edge('i:' + e.slug, 's:' + o.c.id, 'invests', o.role ? `${o.role} investor` : '', censusSrc);
}

/* ───────────────────────── 2. chain links (/chain) ───────────────────────── */

const links = readJson('data/census-links.json', { edges: [], externals: {}, sources: {} });
for (const [key, x] of Object.entries(links.externals || {})) {
  addRef('c:' + key, { n: x.name, also: [x.legal], h: `/chain/x/${encodeURIComponent(key)}`, hosts: [hostOf(x.url)] });
}
const census1 = new Set((census.companies || []).map((c) => c.id));
const chainEnd = (id, ext, name) => {
  if (id && census1.has(id)) return 's:' + id;
  if (ext && refs.has('c:' + ext)) return 'c:' + ext;
  if (name) return kRef(name);
  return null;
};
let chainSkipped = 0;
for (const e of links.edges || []) {
  if (e.check !== 'pass') { chainSkipped++; continue; }
  const a = chainEnd(e.from, e.from_ext, e.from_name);
  const b = chainEnd(e.to, e.to_ext, e.to_name);
  const S = (links.sources || {})[e.src] || {};
  const x = {};
  if (e.kind) x.kind = e.kind;
  if (e.stake !== undefined && e.stake !== null) x.stake = e.stake;
  edge(a, b, e.kind === 'ownership' ? 'owns' : 'chain', e.what, src({ u: S.url, t: S.publisher, d: S.asof }), x);
}

/* ───────────────────────── 3. BUMN + subsidiaries + ties ───────────────────────── */

const bumn56 = readJson('data/bumn-56.json', { entities: [] });
const sankey = readJson('data/bumn-sankey.json', { groups: {} });
const subs = readJson('data/bumn-subs.json', { groups: {} });
const ties = readJson('data/bumn-ties.json', { groups: {}, types: {} });
const bumnHref = (s) => (sankey.groups && sankey.groups[s] ? `/bumn/${encodeURIComponent(s)}` : '/bumn');
for (const e of bumn56.entities || []) {
  addRef('b:' + e.slug, { n: e.short || e.name, also: [e.name], h: bumnHref(e.slug), info: { sector: e.sector || undefined } });
}
/* legal names from the group maps, by group and company name */
const legalOf = new Map();
for (const [g, G] of Object.entries(sankey.groups || {})) {
  const walk = (cos) => { for (const co of cos || []) { if (co.name && co.legal) legalOf.set(g + '|' + strictKey(co.name), co.legal); walk(co.kids); } };
  for (const sg of G.segments || []) walk(sg.cos);
  walk(G.unplaced);
}
let subRows = 0;
for (const [g, G] of Object.entries(subs.groups || {})) {
  if (!refs.has('b:' + g)) continue;
  const basis = G.basis || {};
  const S = src({ u: (G.urls || [])[0], t: basis.doc, d: basis.as_of });
  const seen = new Set();
  const walk = (list, parent, trail) => {
    for (const r of list || []) {
      const name = str(r[0]).trim();
      if (!name) continue;
      let id = slug(name);
      while (seen.has(id)) id += '-2';
      seen.add(id);
      const ref = 'u:' + g + '/' + id;
      subRows++;
      addRef(ref, { n: name, also: [legalOf.get(g + '|' + strictKey(name))], h: bumnHref(g), info: { group: g, what: r[3] || undefined, status: r[2] || undefined } });
      edge(parent, ref, 'owns', '', S, typeof r[1] === 'number' ? { stake: r[1], status: r[2] } : { status: r[2] });
      if (Array.isArray(r[5])) walk(r[5], ref, trail.concat(name));
    }
  };
  walk(G.subs, 'b:' + g, []);
}

/* ───────────────────────── 4. data centres: projects, webs ───────────────────────── */

const dc = readJson('data/datacenter.json', { projects: [], webs: [] });
const webSlugs = new Set((dc.webs || []).map((w) => w.slug));
const webs = {};
for (const s of webSlugs) webs[s] = readJson(`data/dc-webs/${s}.json`, null);
const dcSrc = src({ t: '1001 data-centre map', u: '/data-center', d: dc.asof });
const projByName = new Map();
for (const p of dc.projects || []) {
  addRef('d:' + p.id, { n: p.name, h: `/data-center#p-${encodeURIComponent(p.id)}`, info: { status: p.status || undefined, mw: p.mw || undefined, region: p.region || undefined } });
  projByName.set(strictKey(p.name), p.id);
}
/* "DayOne Nongsa" -> the one project whose name starts so; "NeutraDC Nxera Batam" -> its own row */
function projectNamed(text) {
  const k = strictKey(text);
  if (projByName.has(k)) return projByName.get(k);
  const ps = (dc.projects || []).filter((p) => strictKey(p.name).startsWith(k));
  return ps.length === 1 ? ps[0].id : null;
}
/* "DayOne Batam", where DayOne has two Batam projects: the operator itself */
function operatorNamed(text) {
  const k = strictKey(text);
  const ops = [...new Set((dc.projects || []).filter((p) => p.op && k.startsWith(strictKey(p.op))).map((p) => p.op))];
  return ops.length === 1 ? ops[0] : null;
}
const opRef = (op) => {
  const parts = str(op).split(/\s+\/\s+/).map((x) => x.trim()).filter(Boolean);
  if (!parts.length) return null;
  const r = kRef(parts[0]);
  if (r) addRef(r, { n: parts[0], also: parts.slice(1) });
  return r;
};
let tenantMiss = 0;
for (const p of dc.projects || []) {
  const d = 'd:' + p.id;
  const host = logoHost(p.logo);
  const op = opRef(p.op);
  if (op && host) refs.get(op).hosts.add(host);
  edge(op, d, 'operates', '', dcSrc);
  if (p.tenant_of) {
    const host2 = projectNamed(p.tenant_of);
    const hostOp = host2 ? null : operatorNamed(p.tenant_of);
    if (host2 && host2 !== p.id) edge(d, 'd:' + host2, 'tenant', '', dcSrc);
    else if (hostOp) edge(d, opRef(hostOp), 'tenant', p.tenant_of, dcSrc);
    else { tenantMiss++; edge(d, kRef(p.tenant_of), 'tenant', '', dcSrc); }
  }
  const pl = (p.plinks || [])[0] || null;
  for (const f of p.from || []) {
    const r = kRef(f.n);
    if (r && logoHost(f.logo)) refs.get(r).hosts.add(logoHost(f.logo));
    edge(r, d, 'powers', f.own ? 'own power' : '', pl ? src({ u: pl.u, t: pl.t }) : dcSrc);
  }
  for (const v of p.vendors || []) {
    const r = kRef(v.n);
    if (r && logoHost(v.logo)) refs.get(r).hosts.add(logoHost(v.logo));
    edge(r, d, 'supplies', [v.cat, v.what].filter(Boolean).join(': '), src({ u: v.u, t: v.t, d: v.date }), v.conf ? { conf: v.conf } : undefined);
  }
}
const PLACE_KINDS = new Set(['campus']);
let webLinks = 0;
for (const [s, W] of Object.entries(webs)) {
  if (!W) continue;
  for (const en of W.entities || []) {
    addRef(`w:${s}/${en.id}`, {
      n: en.name, also: [en.legal_name], h: `/data-center/${encodeURIComponent(s)}`, place: PLACE_KINDS.has(en.kind),
      info: { web_kind: en.kind || undefined, city: en.city || undefined },
    });
  }
  for (const l of W.links || []) {
    const a = `w:${s}/${l.from}`;
    const b = `w:${s}/${l.to}`;
    if (!refs.has(a) || !refs.has(b)) continue;
    webLinks++;
    edge(a, b, 'web', [l.relation ? l.relation.replace(/_/g, ' ') : '', l.detail].filter(Boolean).join(': '), src({ u: l.source_url, d: l.date }), { rel: l.relation, conf: l.evidence });
  }
}
/* BUMN ties: to a project row, to a company web, or to a company only named.
   Ties also list state holders outside the 56 (INA, Danantara): their label from the ties layers. */
let tieCount = 0;
const tieLabel = new Map();
for (const L of ties.layers || []) for (const row of L.rows || []) if (row[0] && row[1]) tieLabel.set(row[0], row[1]);
for (const [g, list] of Object.entries(ties.groups || {})) {
  const owner = refs.has('b:' + g) ? 'b:' + g : kRef(tieLabel.get(g) || g);
  for (const t of list) {
    const [type, via, withs, what, conf, date, url] = t;
    for (const [name, href] of withs || []) {
      let b = null;
      const m = /#p-(.+)$/.exec(str(href));
      const w = /^\/data-center\/([a-z0-9-]+)$/.exec(str(href));
      if (m) { let id = m[1]; try { id = decodeURIComponent(id); } catch { /* as is */ } if (refs.has('d:' + id)) b = 'd:' + id; }
      else if (w && webs[w[1]]) b = `w:${w[1]}/${webs[w[1]].center}`;
      if (!b) b = kRef(name);
      tieCount++;
      edge(owner, b, 'tie',[(ties.types || {})[type] || type, what].filter(Boolean).join(': '), src({ u: url, d: date }), { tie: type, via: via || undefined, conf: conf || undefined });
    }
  }
}

/* ───────────────────────── 5. peering ───────────────────────── */

const pg = readJson('data/peering-graph.json', null);
const pmap = readJson('data/peering.json', null);
let peeringOn = false;
if (pg && pmap) {
  peeringOn = true;
  const pSrc = src({ t: 'PeeringDB, checked by 1001', u: '/peering', d: pg.asof });
  const ours = new Map((pmap.facs || []).map((f) => [f.id, f]));
  for (const f of pg.f || []) {
    addRef('f:' + f.id, { n: f.n, also: [f.full, f.pdb], h: f.place ? `/peering?place=${encodeURIComponent(f.place)}` : '/peering', info: { city: f.city || undefined, nets: f.nets } });
    const op = opRef(f.op);
    const host = (ours.get(f.id) || {}).dom || logoHost(f.logo);
    if (op && host) refs.get(op).hosts.add(host);
    edge(op, 'f:' + f.id, 'operates', '', pSrc);
    const our = (ours.get(f.id) || {}).our;
    if (our && refs.has('d:' + our)) edge('f:' + f.id, 'd:' + our, 'same_site', '', pSrc);
  }
  const ixDom = new Map((pmap.ixs || []).map((x) => [x.id, x.dom]));
  for (const x of pg.x || []) {
    addRef('x:' + x.id, { n: x.n, also: [x.full], h: '/peering', info: { city: x.city || undefined, nets: x.nets } });
    const op = opRef(x.op);
    if (op && ixDom.get(x.id)) refs.get(op).hosts.add(ixDom.get(x.id));
    edge(op, 'x:' + x.id, 'operates', '', pSrc);
    for (const s of x.sites || []) if (refs.has('f:' + s)) edge('x:' + x.id, 'f:' + s, 'switch_in', '', pSrc);
  }
  const TYPE = { I: 'ISP', C: 'carrier', T: 'content', E: 'enterprise', S: 'network services', N: 'non-profit', G: 'government', R: 'research and education' };
  for (const r of pg.n || []) {
    const [, asn, name, type, , facs, ixs, unverified] = r;
    addRef('n:' + asn, { n: name, h: null, info: { asn, net_type: TYPE[type] || undefined, unverified: unverified ? true : undefined } });
    for (const f of facs || []) if (refs.has('f:' + f)) edge('n:' + asn, 'f:' + f, 'in_building', '', pSrc);
    for (const x of ixs || []) if (refs.has('x:' + x)) edge('n:' + asn, 'x:' + x, 'peers_at', '', pSrc);
  }
}

/* ───────────────────────── 6. exporters ───────────────────────── */

const umkm = readJson('public/data/umkm.json', { companies: [] });
const umkmRows = Array.isArray(umkm.companies) ? umkm.companies : [];
for (const u of umkmRows) {
  if (!u || !u.id) continue;
  addRef('e:' + u.id, { n: u.name, h: `/umkm/company/${encodeURIComponent(u.id)}`, hosts: [hostOf(u.url)], info: { sector: u.sector || undefined, city: u.city || undefined } });
}

/* ───────────────────────── 7. the reviewed alias list ───────────────────────── */

const A = (() => { try { return JSON.parse(fs.readFileSync(ALIASES, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; return { same: [], not_same: [] }; } })();
const parent = new Map();
const find = (x) => { let r = x; while (parent.has(r) && parent.get(r) !== r) r = parent.get(r); return r; };
const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(rb, ra); };
const aliasMissing = [];
const groupMeta = new Map();       // first ref of a "same" group -> { id, name }
for (const g of A.same || []) {
  const rs = (g.refs || []).filter((r) => { if (refs.has(r)) return true; aliasMissing.push(r); return false; });
  const placeMix = rs.some((r) => refs.get(r).place);
  if (placeMix) throw new Error(`graph1001-aliases.json: "${g.id}" merges a place (project, building, exchange or campus) with companies`);
  for (const r of rs.slice(1)) union(rs[0], r);
  if (rs.length) groupMeta.set(rs[0], { id: g.id, name: g.name });
}
const notSame = new Set((A.not_same || []).map((p) => (p.refs || []).slice().sort().join('|')));
/* every ref the review placed: in a "same" group, or "apart" (reviewed: its own company).
   Two placed refs in different groups are settled, so they are no longer candidates. */
const placed = new Set();
for (const g of A.same || []) for (const r of g.refs || []) placed.add(r);
for (const r of A.apart || []) { if (refs.has(r)) placed.add(r); else aliasMissing.push(r); }

/* ───────────────────────── 8. candidates nobody reviewed yet ───────────────────────── */

const index = new Map();           // key -> Set(ref)
const put = (key, ref) => { if (!key) return; let s = index.get(key); if (!s) index.set(key, (s = new Set())); s.add(ref); };
/* a bracket that says where, how much or what kind, not another name: "(Hong Kong)", "(minority stake)" */
const NOT_A_NAME = /^(hong ?kong|singapore|malaysia|usa|us|uk|london|europe|japan|tokyo|china|indonesia|batam|jakarta|bali|minority ?stake|former ?brand|brand|group|grup|holding|subholding|jv|joint ?venture|kso|branch|cabang|now .*|ex .*|formerly .*)$/;
/* an exporter's or a chain company's "website" is often the article it was found in: a site two
   of them share is a source page, not who they are */
const hostUse = new Map();
for (const r of refs.values()) if (r.kind === 'e' || r.kind === 'c') for (const h of r.hosts) hostUse.set(r.kind + h, (hostUse.get(r.kind + h) || 0) + 1);
for (const r of refs.values()) {
  if (r.place) continue;
  for (const nm of r.names) {
    const sk = strictKey(nm);
    if (sk.length >= 3) put('n:' + sk, r.ref);
    for (const m of nm.matchAll(/\(([^)]*)\)/g)) {
      for (const part of m[1].split(/[,;/]/)) {
        const p = part.replace(/^\s*(ex|formerly|eks|dulu)\s+/i, '');
        const k = strictKey(p);
        if (k.length >= 4 && !NOT_A_NAME.test(norm(p))) put('n:' + k, r.ref);
      }
    }
    const lk = looseKey(nm);
    if (lk.length >= 5 && lk !== sk) put('l:' + lk, r.ref);
  }
  for (const h of r.hosts) if (!((r.kind === 'e' || r.kind === 'c') && hostUse.get(r.kind + h) > 1)) put('h:' + h, r.ref);
}
/* "KSO WIKA - WIKA Gedung (ITB Innovation Park)" and "(... Terminal 3 hotel)": one group's
   project companies, told apart only by their brackets */
const brackets = (r) => [...r.names].map((nm) => (nm.match(/\(([^)]*)\)/) || [])[1]).filter(Boolean).map(norm);
function sameGroupProjects(a, b) {
  const A1 = refs.get(a);
  const B1 = refs.get(b);
  if (A1.kind !== 'u' || B1.kind !== 'u' || A1.info.group !== B1.info.group) return false;
  const x = brackets(A1);
  const y = brackets(B1);
  return x.length > 0 && y.length > 0 && !x.some((v) => y.includes(v));
}
const cand = new Map();
for (const [key, set] of index) {
  const list = [...set];
  if (list.length < 2) continue;
  if (list.length > 12) continue;  // a generic word, not a company
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, b] = [list[i], list[j]].sort();
      if (a[0] === 's' && b[0] === 's') continue;           // census rows are distinct companies by construction
      if (find(a) === find(b)) continue;
      const pk = a + '|' + b;
      if (notSame.has(pk) || sameGroupProjects(a, b) || (placed.has(a) && placed.has(b))) continue;
      const c = cand.get(pk) || { a, b, why: new Set() };
      c.why.add(key[0] === 'n' ? 'same name' : key[0] === 'l' ? 'same name without generic words' : 'same website ' + key.slice(2));
      cand.set(pk, c);
    }
  }
}

/* ───────────────────────── 9. nodes: one ID per company ───────────────────────── */

const PRI = { b: 0, u: 1, s: 2, i: 3, w: 4, c: 5, n: 6, e: 7, k: 8, d: 9, f: 10, x: 11 };
/* the page a node opens: its own page first (a startup row, a BUMN card), a group map last */
const HREF_PRI = { s: 0, b: 1, i: 2, d: 3, e: 4, w: 5, c: 6, f: 7, u: 8, x: 9, n: 10, k: 11 };
const members = new Map();
for (const r of refs.keys()) { const root = find(r); if (!members.has(root)) members.set(root, []); members.get(root).push(r); }
const usedIds = new Set();
const idOf = new Map();
const nodes = {};
const DS = { s: 'startup', i: 'investor', b: 'bumn', u: 'bumn_sub', c: 'chain_company', w: 'dc_web', n: 'network', e: 'exporter', k: 'named', d: 'dc_project', f: 'building', x: 'exchange' };
for (const [root, list] of members) {
  list.sort((x, y) => PRI[x[0]] - PRI[y[0]] || x.localeCompare(y));
  const meta = [...list].map((r) => groupMeta.get(r)).find(Boolean);
  const top = refs.get(list[0]);
  let id = meta && meta.id ? meta.id : (top.kind === 'n' ? 'as' + top.info.asn + '-' + slug(top.n) : slug(top.n.replace(/\([^)]*\)/g, ' ')) || slug(top.n) || top.ref.replace(/[^a-z0-9]+/gi, '-'));
  if (usedIds.has(id)) {
    const base = id + '-' + DS[top.kind].replace(/_/g, '-');
    id = base;
    for (let i = 2; usedIds.has(id); i++) id = base + '-' + i;
  }
  usedIds.add(id);
  for (const r of list) idOf.set(r, id);
  const names = new Set();
  for (const r of list) for (const nm of refs.get(r).names) names.add(nm);
  const info = {};
  for (const r of list.slice().reverse()) Object.assign(info, refs.get(r).info);
  const node = {
    n: (meta && meta.name) || top.n,
    k: [...new Set(list.map((r) => DS[r[0]]))],
    r: list,
    h: list.slice().sort((x, y) => HREF_PRI[x[0]] - HREF_PRI[y[0]]).map((r) => refs.get(r).h).find(Boolean) || undefined,
    a: [...names].filter((x) => x !== ((meta && meta.name) || top.n)).slice(0, 12),
  };
  if (top.place) node.place = true;
  for (const k of ['sector', 'city', 'status', 'mw', 'region', 'asn', 'net_type', 'unverified', 'web_kind', 'group', 'backs']) if (info[k] !== undefined) node[k] = info[k];
  nodes[id] = node;
}

/* ───────────────────────── 10. edges on IDs ───────────────────────── */

const seenEdge = new Set();
const edges = [];
for (const e of rawEdges) {
  const a = idOf.get(e.a);
  const b = idOf.get(e.b);
  if (!a || !b || a === b) continue;
  const key = [a, b, e.t, e.w || '', e.s].join('|');
  if (seenEdge.has(key)) continue;
  seenEdge.add(key);
  const row = [a, b, e.t, e.w || '', e.s];
  if (e.x) row.push(e.x);
  edges.push(row);
}

/* ───────────────────────── 11. the numbers ───────────────────────── */

const count = (xs) => xs.reduce((o, x) => ((o[x] = (o[x] || 0) + 1), o), {});
const famOf = (id) => {
  const k = nodes[id].k;
  if (k.includes('startup') || k.includes('investor') || k.includes('chain_company')) return 'startups';
  if (k.includes('bumn') || k.includes('bumn_sub')) return 'bumn';
  if (k.includes('dc_project') || k.includes('dc_web')) return 'data_centres';
  if (k.includes('building') || k.includes('exchange') || k.includes('network')) return 'peering';
  if (k.includes('exporter')) return 'exporters';
  return 'named_only';
};
/* which of the five datasets a node's records come from */
const fiveOf = (id) => {
  const out = new Set();
  for (const r of nodes[id].r) {
    const c = r[0];
    if (c === 's' || c === 'i' || c === 'c') out.add('startups');
    else if (c === 'b' || c === 'u') out.add('bumn');
    else if (c === 'd' || c === 'w') out.add('data_centres');
    else if (c === 'n' || c === 'f' || c === 'x') out.add('peering');
    else if (c === 'e') out.add('exporters');
  }
  return out;
};
const ids = Object.keys(nodes);
const multi = ids.filter((id) => fiveOf(id).size >= 2);
const crossEdges = edges.filter(([a, b]) => { const A1 = fiveOf(a); const B1 = fiveOf(b); return A1.size && B1.size && ![...A1].some((x) => B1.has(x)); });
const deg = new Map();
for (const [a, b] of edges) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
const hubs = (pred, n = 10) => ids.filter(pred).sort((x, y) => (deg.get(y) || 0) - (deg.get(x) || 0)).slice(0, n).map((id) => `${nodes[id].n} (${deg.get(id) || 0})`);
const candList = [...cand.values()].map((c) => ({ a: c.a, an: refs.get(c.a).n, b: c.b, bn: refs.get(c.b).n, why: [...c.why] }))
  .sort((x, y) => (x.why.some((w) => w === 'same name') ? 0 : 1) - (y.why.some((w) => w === 'same name') ? 0 : 1) || x.a.localeCompare(y.a));

const report = {
  built: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  records: count([...refs.keys()].map((r) => DS[r[0]])),
  nodes: ids.length,
  companies: ids.filter((id) => !nodes[id].place).length,
  places: ids.filter((id) => nodes[id].place).length,
  nodes_by_dataset: count(ids.map(famOf)),
  in_two_or_more_datasets: multi.length,
  in_how_many: count(multi.map((id) => fiveOf(id).size)),
  merged_by_alias_list: { groups: (A.same || []).length, records: (A.same || []).reduce((s, g) => s + (g.refs || []).length, 0), missing_refs: aliasMissing },
  not_same_pairs: (A.not_same || []).length,
  unreviewed_candidates: candList.length,
  edges: edges.length,
  edges_by_type: count(edges.map((e) => e[2])),
  edges_across_datasets: crossEdges.length,
  edges_across_by_type: count(crossEdges.map((e) => e[2])),
  edges_with_a_source_link: edges.filter((e) => e[4] >= 0 && sources[e[4]].u && /^https?:/.test(sources[e[4]].u)).length,
  sources: sources.length,
  skipped: { chain_links_failed_check: chainSkipped, tenant_of_not_resolved: tenantMiss },
  peering_included: peeringOn,
  biggest_hubs_companies: hubs((id) => !nodes[id].place && !nodes[id].k.includes('network')),
  multi_dataset_examples: multi.slice().sort((x, y) => fiveOf(y).size - fiveOf(x).size || (deg.get(y) || 0) - (deg.get(x) || 0)).slice(0, 15)
    .map((id) => `${nodes[id].n}: ${[...fiveOf(id)].join(' + ')}`),
};

console.log(JSON.stringify(report, null, 2));
if (CHECK) process.exit(0);

const graph = {
  version: 1,
  built: report.built,
  asof: {
    census: (census.generated || '').slice(0, 10), bumn: bumn56.asof || undefined, subs: subs.asof || undefined, ties: ties.asof || undefined,
    datacentres: dc.asof || undefined, peering: pg ? pg.asof : undefined, chain: links.built || undefined,
  },
  types: TYPES,
  counts: { nodes: report.nodes, companies: report.companies, places: report.places, edges: report.edges, in_two_or_more_datasets: report.in_two_or_more_datasets },
  nodes,
  edges,
  sources,
};
fs.writeFileSync(OUT + '.tmp', JSON.stringify(graph));
fs.renameSync(OUT + '.tmp', OUT);
fs.writeFileSync(REPORT, JSON.stringify({ ...report, candidates: candList }, null, 1));
console.error(`graph1001: wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB) and ${path.relative(ROOT, REPORT)}`);
