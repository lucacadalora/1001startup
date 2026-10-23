'use strict';
/* 1001startup.id — the census read surface (/api/census/*).
 *
 * Registered from server.js in one line (the leads-routes pattern: another
 * session edits this repo concurrently and a small surface is the point).
 * Everything here is READ-ONLY over the already-public layer: the /api/census
 * endpoints expose only fields the landing table and the company cards render.
 * The gated working file (census.json as a download) stays gated — these
 * routes answer questions, they do not hand over the corpus.
 *
 * Built for the support.vantis.sh census chat, REMOVED 4 Oct 2026 (Luca:
 * "delete that feature lol, useless"); /ask now 301s home. The endpoints stay
 * read-only and harmless. Its actions (census_lookup /
 * census_top / census_stats / census_memory) arrived via Cloudflare on
 * the /api/ nginx location, which deliberately has no UA shield. The memory
 * endpoint proxies memori.vantis.sh's census space so the memori key stays on
 * this VM and the reply can be compacted to the 2400-char action budget.
 */
const fs = require('fs');

const MEMORI_KEY_FILE = '/home/ubuntu/.openclaw/secrets/memori-census.key';
const MEMORI_URL = 'http://127.0.0.1:8320/v1/search';
const SITE = 'https://1001startup.id';

module.exports = function registerCensusApi(fastify, deps) {
  const { is1001, ipOf, censusData, langOf } = deps;

  let memoriKey = '';
  try { memoriKey = fs.readFileSync(MEMORI_KEY_FILE, 'utf8').trim(); } catch { /* memory lane disabled */ }

  /* tiny per-route rate limiter — same shape as server.js's limited() but
     self-contained so this module never reaches into server closures */
  const buckets = new Map();
  function limited(req, reply, scope, max, windowMs) {
    const k = scope + ':' + (ipOf(req) || 'x');
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now - b.t0 > windowMs) { b = { t0: now, n: 0 }; buckets.set(k, b); }
    if (buckets.size > 20000) buckets.clear(); /* safety valve */
    b.n += 1;
    if (b.n > max) { reply.code(429).send({ error: 'rate_limited' }); return true; }
    return false;
  }

  const gate = (req, reply) => {
    if (!is1001(req)) { reply.code(404).send({ error: 'not_found' }); return true; }
    return false;
  };

  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const clip = (s, n) => (s && String(s).length > n ? String(s).slice(0, n - 1) + '…' : s);

  /* Only fields the site already renders publicly (landing table + company
     card). The working layer — source ladders, geocode/logo trails, review
     flags — is deliberately absent. */
  function publicRow(c) {
    return {
      id: c.id,
      name: c.name,
      legal_name: c.legal_name || null,
      corporate_parent: c.corporate_parent || null,
      group: c.group_parent ? { name: c.group_parent.group, relation: c.group_parent.relation || null, listed_parent: c.group_parent.ticker || null, source: c.group_parent.src || null } : null,
      sector: c.sector_label || c.sector || null,
      rank: c.rank ?? null,
      kota: c.kota || null,
      hq_address: c.hq_address || null,
      website: c.url || null,
      profile_url: `${SITE}/company/${c.id}`,
      yc_batch: c.yc_batch || null,
      endeavor: !!c.endeavor || null,
      antler: !!c.antler || null,
      funding_usd_m: c.funding_total_usd_m ?? null,
      funding_status: c.funding_status || null,
      funding_note: clip(c.funding_note, 220) || null,
      funding_group_context_usd_m: c.funding_group_total_usd_m ?? null,
      funding_source: c.funding_src || null,
      last_round: c.last_round ? `${c.last_round}${c.last_round_year ? ' (' + c.last_round_year + ')' : ''}` : null,
      valuation_usd_m: c.valuation_usd_m ?? null,
      valuation_kind: c.valuation_kind || null,
      valuation_asof: c.valuation_asof || null,
      valuation_note: clip(c.valuation_note, 220) || null,
      employees: c.employees_est ?? null,
      employees_asof: c.employees_asof || null,
      employees_source: c.employees_src || null,
      employees_group_context: c.employees_group_est ?? null,
      employees_note: clip(c.employees_note, 220) || null,
      est_output_gva_idr_bn: c.est_gva_idr_bn ?? null,
      investors: Array.isArray(c.investors) ? c.investors.slice(0, 8) : null,
      site_status: c.site_status || null,
      notes: clip(c.notes, 260) || null,
      caveat: 'Missing figures mean no published number exists — never zero. est values are model estimates.',
    };
  }

  /* ── GET /api/census/company?name= ─────────────────────────────────── */
  fastify.get('/api/census/company', async (req, reply) => {
    if (gate(req, reply)) return;
    if (limited(req, reply, 'capi', 60, 60_000)) return;
    const q = norm(req.query && req.query.name);
    if (!q || q.length < 2) return reply.code(400).send({ error: 'name_required' });
    const d = censusData();
    if (!d) return reply.code(503).send({ error: 'census_unavailable' });
    const cos = d.companies || [];
    const scored = [];
    for (const c of cos) {
      const hay = [c.id, c.name, c.legal_name].map(norm);
      let s = 0;
      if (hay[0] === q.replace(/ /g, '-') || hay[1] === q) s = 100;
      else if (hay[1].startsWith(q)) s = 80;
      else if (hay.some((h) => h.includes(q))) s = 60;
      else {
        const qt = q.split(' ').filter(Boolean);
        if (qt.length && qt.every((t) => hay[1].includes(t) || hay[2].includes(t))) s = 40;
      }
      if (s) scored.push([s, c]);
    }
    scored.sort((a, b) => b[0] - a[0] || (a[1].rank || 9e9) - (b[1].rank || 9e9));
    if (!scored.length) {
      return reply.send({
        found: false,
        note: `No company matching "${req.query.name}" is in the census. The census covers all of Indonesia (nationwide since 28 Sep 2026), but coverage outside Greater Jakarta, Bandung and Bali is still being built; a company can be real and simply not added yet.`,
      });
    }
    const alts = scored.slice(1, 4).map(([, c]) => c.name);
    const out = { found: true, company: publicRow(scored[0][1]) };
    if (alts.length && scored[0][0] < 100) out.other_matches = alts;
    reply.header('Cache-Control', 'no-cache');
    return reply.send(out);
  });

  /* ── GET /api/census/top?metric=funding|jobs|valuation|gva&sector=&n= ── */
  const METRICS = {
    funding: ['funding_total_usd_m', 'announced funding, US$ millions'],
    jobs: ['employees_est', 'sourced headcount (payroll only, never mitra/driver partners)'],
    valuation: ['valuation_usd_m', 'valuation on record, US$ millions (only rows with a sourced mark)'],
    gva: ['est_gva_idr_bn', 'estimated direct output (GVA), IDR billions per year — a model estimate'],
  };
  fastify.get('/api/census/top', async (req, reply) => {
    if (gate(req, reply)) return;
    if (limited(req, reply, 'capi', 60, 60_000)) return;
    const metric = String((req.query && req.query.metric) || 'funding').toLowerCase();
    if (!METRICS[metric]) return reply.code(400).send({ error: 'bad_metric', metrics: Object.keys(METRICS) });
    const d = censusData();
    if (!d) return reply.code(503).send({ error: 'census_unavailable' });
    const [field, meaning] = METRICS[metric];
    const sec = norm(req.query && req.query.sector);
    let rows = (d.companies || []).filter((c) => c[field] != null);
    if (sec) rows = rows.filter((c) => norm(c.sector_key) === sec || norm(c.sector_label).includes(sec));
    rows.sort((a, b) => b[field] - a[field]);
    const n = Math.min(Math.max(parseInt((req.query && req.query.n) || '10', 10) || 10, 1), 15);
    reply.header('Cache-Control', 'no-cache');
    return reply.send({
      metric, meaning,
      sector: sec || 'all',
      considered: rows.length,
      rows: rows.slice(0, n).map((c) => ({
        name: c.name, value: c[field], kota: c.kota || null,
        profile_url: `${SITE}/company/${c.id}`,
      })),
      note: metric === 'valuation'
        ? 'Rows counted inside a parent (e.g. tiket.com inside Blibli) carry marks that are not added to the combined total.'
        : undefined,
    });
  });

  /* ── GET /api/census/stats ─────────────────────────────────────────── */
  fastify.get('/api/census/stats', async (req, reply) => {
    if (gate(req, reply)) return;
    if (limited(req, reply, 'capi', 60, 60_000)) return;
    const d = censusData();
    if (!d) return reply.code(503).send({ error: 'census_unavailable' });
    reply.header('Cache-Control', 'no-cache');
    return reply.send({
      as_of: (d.generated || '').slice(0, 10),
      totals: d.totals,
      sectors: (d.by_sector || []).map((s) => ({ name: s.name, companies: s.count, jobs: s.jobs, gva_idr_bn: s.gva_idr_bn })),
      scope: d.scope && d.scope.rule,
      note: 'Jobs are sourced payroll only. GVA is a model estimate (see ' + SITE + '/model). Funding sums announced rounds with linked sources.',
    });
  });

  /* ── GET /api/census/memory?q= — memori census space, proxied ──────── */
  fastify.get('/api/census/memory', async (req, reply) => {
    if (gate(req, reply)) return;
    if (limited(req, reply, 'cmem', 20, 60_000)) return;
    const q = String((req.query && req.query.q) || '').trim();
    if (q.length < 3 || q.length > 300) return reply.code(400).send({ error: 'q_required' });
    if (!memoriKey) return reply.code(503).send({ error: 'memory_unavailable' });
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 15_000);
      const r = await fetch(MEMORI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + memoriKey },
        body: JSON.stringify({ q, space: 'census', limit: 8 }),
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (!r.ok) return reply.code(502).send({ error: 'memory_error' });
      const m = await r.json();
      reply.header('Cache-Control', 'no-cache');
      return reply.send({
        query: q,
        facts: (m.facts || []).slice(0, 6).map((f) => ({
          fact: clip(f.fact, 220), since: f.valid_at ? String(f.valid_at).slice(0, 10) : null,
        })),
        notes: (m.episodes || []).slice(0, 2).map((e) => ({ title: e.name, text: clip(e.content, 340) })),
        source: 'the census knowledge memory (method, scope rules, removal register, cohort and sector digests)',
      });
    } catch {
      return reply.code(504).send({ error: 'memory_timeout' });
    }
  });

  /* ── GET /ask — the census chat lived here until 4 Oct 2026 ─────────── */
  fastify.get('/ask', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    return reply.redirect(langOf(req) === 'id' ? '/id/' : '/', 301);
  });
};
