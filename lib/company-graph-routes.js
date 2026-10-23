'use strict';
/* Read-only, fully local company graph API. No query-time third-party API.
 * The SQLite file is rebuilt by scripts/build-company-graph.py and reopened by mtime.
 * Answers only while data/companygraph.live exists (COMPANYGRAPH_PREVIEW=1 on a test
 * port), like the other 1001 switches in lib/flaglive.js. */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { liveFlag } = require('./flaglive');
const graphLive = liveFlag('companygraph.live', 'COMPANYGRAPH_PREVIEW');

module.exports = function registerCompanyGraph(fastify, deps) {
  const { is1001, ipOf } = deps;
  const FILE = path.join(__dirname, '..', 'data', 'company-graph.sqlite');
  const INSIGHTS = path.join(__dirname, '..', 'public', 'data', 'company-insights.json');
  let state = { mtime: 0, db: null };
  const buckets = new Map();

  function limited(req, reply, scope, max, windowMs) {
    const key = scope + ':' + (ipOf(req) || 'x');
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.t0 > windowMs) { b = { t0: now, n: 0 }; buckets.set(key, b); }
    if (buckets.size > 20000) buckets.clear();
    b.n += 1;
    if (b.n > max) { reply.code(429).send({ error: 'rate_limited' }); return true; }
    return false;
  }
  const gate = (req, reply) => {
    if (!is1001(req) || !graphLive() || !fs.existsSync(FILE)) { reply.code(404).send({ error: 'not_found' }); return true; }
    return false;
  };
  function db() {
    const st = fs.statSync(FILE);
    if (st.mtimeMs !== state.mtime) {
      if (state.db) state.db.close();
      state = { mtime: st.mtimeMs, db: new Database(FILE, { readonly: true, fileMustExist: true }) };
    }
    return state.db;
  }
  function ftsQuery(q) {
    const tokens = String(q || '').normalize('NFKD').replace(/[^\p{L}\p{N}_-]+/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 8);
    return tokens.map((t) => '"' + t.replace(/"/g, '""') + '"').join(' AND ');
  }
  const publicContact = {
    email_role: 1, phone_business: 1, careers_url: 1, website: 1, linkedin_company: 1,
    email: 1, phone: 1, fax: 1, hotline: 1,
  };
  function company(id) {
    const entity = db().prepare('SELECT id,registry,slug,name,legal_name,company_type,sector,province,city,url,status,confidence FROM entities WHERE id=?').get(id);
    if (!entity) return null;
    const observations = db().prepare(`SELECT o.kind,o.value_num,o.value_text,o.unit,o.year,o.as_of,o.value_class,o.method_id,o.note,o.is_current,s.url AS source_url
      FROM observations o LEFT JOIN sources s ON s.id=o.source_id WHERE o.entity_id=? ORDER BY o.kind,o.year,o.as_of`).all(id);
    const relationships = db().prepare(`SELECT r.from_id,r.to_id,r.type,r.pct,r.as_of,r.value_class,r.note,r.evidence,s.url AS source_url,
      a.name AS from_name,b.name AS to_name FROM relationships r
      LEFT JOIN sources s ON s.id=r.source_id LEFT JOIN entities a ON a.id=r.from_id LEFT JOIN entities b ON b.id=r.to_id
      WHERE r.from_id=? OR r.to_id=? ORDER BY r.type,r.to_id`).all(id, id);
    const contacts = db().prepare(`SELECT c.type,c.value,c.verified_at,c.value_class,s.url AS source_url
      FROM contacts c LEFT JOIN sources s ON s.id=c.source_id WHERE c.entity_id=? ORDER BY c.type,c.value`).all(id)
      .filter((c) => publicContact[c.type]);
    const officers = db().prepare('SELECT o.name,o.role,s.url AS source_url FROM officers o LEFT JOIN sources s ON s.id=o.source_id WHERE o.entity_id=? ORDER BY o.role,o.name').all(id);
    const accounts = db().prepare('SELECT f.coa_id,f.account,f.year,f.value_idr,s.url AS source_url FROM financial_accounts f LEFT JOIN sources s ON s.id=f.source_id WHERE f.entity_id=? ORDER BY f.coa_id,f.year').all(id);
    return { company: entity, observations, relationships, contacts, officers, financial_accounts: accounts };
  }

  fastify.get('/api/company-graph/search', async (req, reply) => {
    if (gate(req, reply)) return;
    if (limited(req, reply, 'cgsearch', 60, 60_000)) return;
    const q = String(req.query && req.query.q || '').trim();
    if (q.length < 2) return reply.code(400).send({ error: 'query_required', message: 'Use at least two characters.' });
    const registry = String(req.query && req.query.registry || '');
    const allowed = new Set(['tech', 'bumn', 'bumd', 'bumn_related', 'bumn_subsidiary', 'benchmark', 'external']);
    if (registry && !allowed.has(registry)) return reply.code(400).send({ error: 'bad_registry', registries: [...allowed] });
    const limit = Math.min(Math.max(parseInt(req.query && req.query.limit || '10', 10) || 10, 1), 15);
    const match = ftsQuery(q);
    if (!match) return reply.code(400).send({ error: 'query_required' });
    const sql = `SELECT f.id,f.name,f.legal_name,f.sector,f.province,f.city,e.registry,e.company_type,e.url,e.status
      FROM entity_fts f JOIN entities e ON e.id=f.id WHERE entity_fts MATCH ?
      ${registry ? 'AND e.registry=?' : ''} ORDER BY rank LIMIT ?`;
    const args = registry ? [match, registry, limit] : [match, limit];
    const rows = db().prepare(sql).all(...args);
    return reply.header('Cache-Control', 'no-cache').send({ query: q, count: rows.length, rows, query_time_network: 'disabled' });
  });

  fastify.get('/api/company-graph/company', async (req, reply) => {
    if (gate(req, reply)) return;
    if (limited(req, reply, 'cgcompany', 60, 60_000)) return;
    const id = String(req.query && req.query.id || '').trim();
    if (!id) return reply.code(400).send({ error: 'id_required' });
    const result = company(id);
    if (!result) return reply.code(404).send({ error: 'not_found' });
    return reply.header('Cache-Control', 'no-cache').send({ ...result, query_time_network: 'disabled' });
  });

  fastify.get('/api/company-graph/stats', async (req, reply) => {
    if (gate(req, reply)) return;
    if (limited(req, reply, 'cgstats', 60, 60_000)) return;
    const data = JSON.parse(fs.readFileSync(INSIGHTS, 'utf8'));
    return reply.header('Cache-Control', 'no-cache').send({ ...data, query_time_network: 'disabled' });
  });
};
