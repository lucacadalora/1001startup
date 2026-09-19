'use strict';
/**
 * 1001startup.id — the Lead Search product, mounted at /leads.
 *
 * Everything the product needs lives behind this one registration call so that
 * server.js takes a single line. That is deliberate: another session edits this
 * repo concurrently, and a one-line hook is the smallest surface that can
 * collide with someone else's work.
 *
 * The gate is a shared passcode, not accounts. This is a one-operator tool
 * today; inventing a user table would be pretending at a multi-tenancy that
 * does not exist yet. The passcode lives in the environment, never in git.
 */
const crypto = require('crypto');
const path = require('path');

const view = require('../views/leads1001');
const engine = require('./leads-engine');

const COOKIE = 'l1001';
const TTL_DAYS = 30;

module.exports = function registerLeads(fastify, deps) {
  const { db, is1001, PROD } = deps;
  /* /id/leads speaks Indonesian: lang comes from the /id rewrite (server.js),
     and page-to-page redirects keep the reader's language. */
  const langOf = deps.langOf || (() => 'en');
  const lpfx = (req) => (langOf(req) === 'id' ? '/id' : '');

  db.exec(`
CREATE TABLE IF NOT EXISTS leads_sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_leads_sessions_expiry ON leads_sessions(expires_at);
CREATE TABLE IF NOT EXISTS leads_runs (
  id INTEGER PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  company TEXT NOT NULL,
  domain TEXT,
  intent TEXT,
  people INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  exa_queries INTEGER NOT NULL DEFAULT 0,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  ms INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
`);

  /* The first cut of this table kept only the metrics and threw the answer
     away, so a run could be counted but never re-read. Added in place rather
     than as a new table: the history IS the run, not a sibling of it. */
  const have = new Set(db.prepare('PRAGMA table_info(leads_runs)').all().map((c) => c.name));
  for (const [col, decl] of [
    ['session', 'TEXT'],   // which signed-in session ran it (token prefix only)
    ['ip', 'TEXT'],
    ['ua', 'TEXT'],
    ['roles', 'TEXT'],     // the role queries the model expanded the brief into
    ['result', 'TEXT'],    // the people found, as JSON — the output itself
    /* running | done | failed | interrupted. The row is now written when the
       run STARTS, not when it ends: a run killed mid-flight (the deploy-restart
       problem) used to vanish from history entirely, so the spend was invisible
       and the operator read the silence as "it never ran". Old rows have NULL
       here, which reads as done/failed by the error column. */
    ['status', 'TEXT'],
  ]) {
    if (!have.has(col)) db.exec(`ALTER TABLE leads_runs ADD COLUMN ${col} ${decl}`);
  }

  /* A row still marked running long after any run could finish is a run some
     restart killed. Ten minutes is double the longest legitimate run; the age
     guard means a boot on one port never flags a run genuinely in flight on
     another (the QA instance shares this file). */
  try {
    db.prepare(`UPDATE leads_runs SET status='interrupted',
      error=COALESCE(error,'cut off by a server restart mid-run')
      WHERE status='running' AND created_at < datetime('now','-10 minutes')`).run();
  } catch { /* a locked db must not stop boot */ }

  const Q = {
    newSession: db.prepare(`INSERT INTO leads_sessions (token, expires_at, ip) VALUES (?, datetime('now', ?), ?)`),
    // Expiry is enforced in the lookup itself, so an expired row can never
    // authenticate even if the sweeper has not run.
    session: db.prepare(`SELECT token FROM leads_sessions WHERE token=? AND expires_at > datetime('now')`),
    dropSession: db.prepare(`DELETE FROM leads_sessions WHERE token=?`),
    sweep: db.prepare(`DELETE FROM leads_sessions WHERE expires_at <= datetime('now')`),
    /* The row is born when the run starts, so a killed run leaves a corpse
       with the prompt on it instead of vanishing. */
    startRun: db.prepare(`INSERT INTO leads_runs
      (company,domain,intent,session,ip,ua,status) VALUES (?,?,?,?,?,?,'running')`),
    finishRun: db.prepare(`UPDATE leads_runs SET company=?, domain=?, people=?, published=?,
      exa_queries=?, tokens_in=?, tokens_out=?, cost_usd=?, ms=?, error=NULL,
      roles=?, result=?, status='done' WHERE id=?`),
    failRun: db.prepare(`UPDATE leads_runs SET ms=?, error=?, status='failed' WHERE id=?`),
    /* The boot-time sweep alone leaves a hole: a run younger than ten minutes
       at boot keeps its 'running' row forever if the service then stays up
       (run 22 sat that way for half a day). Swept again whenever a new run
       starts, so a corpse can outlive a deploy but not the next search. */
    sweepStale: db.prepare(`UPDATE leads_runs SET status='interrupted',
      error=COALESCE(error,'cut off by a server restart mid-run')
      WHERE status='running' AND created_at < datetime('now','-10 minutes')`),
    historyPage: db.prepare(`SELECT id,created_at,company,domain,intent,people,published,
      exa_queries,tokens_in,tokens_out,cost_usd,ms,error,session,ip,ua,status,
      (result IS NOT NULL) AS has_result
      FROM leads_runs ORDER BY id DESC LIMIT ? OFFSET ?`),
    historyCount: db.prepare(`SELECT COUNT(*) n FROM leads_runs`),
    runById: db.prepare(`SELECT * FROM leads_runs WHERE id=?`),
    recentRuns: db.prepare(`SELECT company,people,published,cost_usd,created_at FROM leads_runs
      WHERE error IS NULL AND (status IS NULL OR status='done') ORDER BY id DESC LIMIT 8`),
    totals: db.prepare(`SELECT COUNT(*) runs, COALESCE(SUM(people),0) people,
      COALESCE(SUM(cost_usd),0) cost FROM leads_runs
      WHERE error IS NULL AND (status IS NULL OR status='done')`),
  };
  try { Q.sweep.run(); } catch { /* a locked db must not stop boot */ }

  /* The sign-in form posts urlencoded and the app only parses JSON, so without
     this the gate answers 415 to a correct passcode. Registered here rather
     than pulling in @fastify/formbody: it is a dozen lines, it avoids editing
     package.json while another session is in this repo, and it is purely
     additive — no existing route accepts this content type today. */
  if (!fastify.hasContentTypeParser('application/x-www-form-urlencoded')) {
    fastify.addContentTypeParser('application/x-www-form-urlencoded',
      { parseAs: 'string' }, (req, body, done) => {
        try {
          const out = {};
          const params = new URLSearchParams(body);
          // Last value wins; a repeated key must not become an array here or
          // the passcode comparison would receive a non-string.
          for (const [k, v] of params) out[k] = v;
          done(null, out);
        } catch (e) {
          done(e);
        }
      });
  }

  /* ── the gate ───────────────────────────────────────────────────── */

  const digest = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest();

  function passcodeOk(given) {
    const want = process.env.LEADS_PASSCODE || '';
    // No passcode configured means the door is closed, not open.
    if (!want) return false;
    // Hash both sides first: timingSafeEqual throws on length mismatch, which
    // would itself leak the length of the real passcode.
    const a = digest(given);
    const b = digest(want);
    return crypto.timingSafeEqual(a, b);
  }

  /* A shared passcode is brute-forceable, so the door counts attempts.
     Keyed on the CLIENT ip, which must come from the app's own ipOf() —
     cf-connecting-ip. Reading req.raw.socket.remoteAddress instead looks
     safer and is catastrophically worse here: every visitor arrives from
     nginx on 127.0.0.1, so the whole internet shares ONE bucket and nine
     wrong guesses by anybody lock the operator out. cf-connecting-ip is
     unspoofable on this host — nginx sets it from $remote_addr, and
     conf.d/cloudflare-realip.conf only trusts a forwarded address when the
     connection came from Cloudflare's own ranges. */
  const clientIp = typeof deps.ipOf === 'function'
    ? deps.ipOf
    : (req) => String((req.headers && req.headers['cf-connecting-ip']) || req.ip || '?');

  const attempts = new Map();
  /** Called ONLY on a failed attempt: counting successes would let the
      operator lock himself out by signing in a few times in a row. */
  function noteFailure(ip) {
    const now = Date.now();
    const rec = attempts.get(ip) || { n: 0, until: 0, at: 0 };
    if (now - rec.at > 15 * 60e3) rec.n = 0;
    rec.n += 1;
    rec.at = now;
    if (rec.n >= 8) { rec.until = now + 15 * 60e3; rec.n = 0; }
    attempts.set(ip, rec);
    if (attempts.size > 5000) {
      /* Evict only what is spent. Clearing the whole map would release every
         live lockout, handing an attacker a reset by filling it. */
      for (const [k, v] of attempts) {
        if (v.until < now && now - v.at > 15 * 60e3) attempts.delete(k);
      }
    }
  }
  function lockedOut(ip) {
    const rec = attempts.get(ip);
    return !!(rec && rec.until > Date.now());
  }

  function authed(req) {
    const tok = req.cookies && req.cookies[COOKIE];
    if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return false;
    return !!Q.session.get(tok);
  }
  /* Everyone shares one access code, so there are no user accounts to name.
     The first 8 hex of the session token is enough to tell two people apart in
     the history without storing anything that could re-authenticate. */
  function sessionTag(req) {
    const tok = req.cookies && req.cookies[COOKIE];
    return tok && /^[a-f0-9]{64}$/.test(tok) ? tok.slice(0, 8) : null;
  }
  function cookieOpts() {
    // Host-only on purpose: never set Domain — the apex spans third-party infra.
    return { path: '/', httpOnly: true, secure: !!PROD, sameSite: 'lax', maxAge: TTL_DAYS * 86400 };
  }

  /* ── pages ──────────────────────────────────────────────────────── */

  const censusCompanies = () => {
    try {
      const p = path.join(__dirname, '..', 'public', 'data', 'census.json');
      const d = JSON.parse(require('fs').readFileSync(p, 'utf8'));
      return (d.companies || []).map((c) => ({ id: c.id, name: c.name, url: c.url || '', sector: c.sector_label || '' }));
    } catch { return []; }
  };

  fastify.get('/leads', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    if (!authed(req)) return reply.redirect(lpfx(req) + '/leads/login');
    let stats = { runs: 0, people: 0, cost: 0 };
    let recent = [];
    try { stats = Q.totals.get() || stats; recent = Q.recentRuns.all(); } catch { /* empty is fine */ }
    reply.type('text/html').send(view.dashboard({ companies: censusCompanies(), stats, recent, lang: langOf(req) }));
  });

  fastify.get('/leads/login', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    if (authed(req)) return reply.redirect(lpfx(req) + '/leads');
    reply.type('text/html').send(view.login({
      error: req.query && req.query.e
        ? (langOf(req) === 'id' ? 'Kode akses itu tidak diterima.' : 'That access code was not accepted.') : '',
      lang: langOf(req) }));
  });

  fastify.post('/leads/login', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const ip = clientIp(req);
    if (lockedOut(ip)) {
      return reply.code(429).type('text/html')
        .send(view.login({
          error: langOf(req) === 'id' ? 'Terlalu banyak percobaan. Coba lagi lima belas menit lagi.' : 'Too many attempts. Try again in fifteen minutes.',
          lang: langOf(req) }));
    }
    const body = req.body || {};
    const given = typeof body.passcode === 'string' ? body.passcode : '';
    if (!passcodeOk(given)) {
      noteFailure(ip);
      return reply.redirect('/leads/login?e=1');
    }
    const tok = crypto.randomBytes(32).toString('hex');
    Q.newSession.run(tok, `+${TTL_DAYS} days`, ip);
    reply.setCookie(COOKIE, tok, cookieOpts());
    reply.redirect('/leads');
  });

  /* The run log. Everyone shares one access code, so this is deliberately a
     shared history rather than a per-user one — the session tag is what
     distinguishes two people. */
  const PER_PAGE = 25;
  fastify.get('/leads/history', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    if (!authed(req)) return reply.redirect('/leads/login');
    const total = (Q.historyCount.get() || {}).n || 0;
    const pages = Math.max(1, Math.ceil(total / PER_PAGE));
    const page = Math.min(pages, Math.max(1, parseInt((req.query && req.query.p) || '1', 10) || 1));
    const offset = (page - 1) * PER_PAGE;
    reply.type('text/html').send(view.history({
      runs: Q.historyPage.all(PER_PAGE, offset), page, pages, total, offset, lang: langOf(req),
    }));
  });

  fastify.get('/leads/history/:id', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    if (!authed(req)) return reply.redirect(lpfx(req) + '/leads/login');
    const id = parseInt((req.params && req.params.id) || '0', 10);
    const run = id ? Q.runById.get(id) : null;
    if (!run) return reply.code(404).type('text/html').send(view.history({ runs: [], page: 1, pages: 1, total: 0, offset: 0, lang: langOf(req) }));
    let result = null;
    /* A row written before output capture existed, or a truncated blob, must
       render the run rather than 500 the page. */
    try { result = run.result ? JSON.parse(run.result) : null; } catch { result = null; }
    reply.type('text/html').send(view.historyRun({ run, result, lang: langOf(req) }));
  });

  fastify.post('/leads/logout', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const tok = req.cookies && req.cookies[COOKIE];
    if (tok) { try { Q.dropSession.run(tok); } catch { /* already gone */ } }
    reply.clearCookie(COOKIE, { path: '/' });
    reply.redirect('/leads/login');
  });

  /* ── the search ─────────────────────────────────────────────────── */

  /* Another session deploys this repo by restarting the service, sometimes
     every minute — and a restart used to kill any run mid-flight after the
     Exa and inference spend was already made. Node's default SIGTERM handling
     is immediate exit; this handler makes the stop WAIT while a run is live,
     up to 45 seconds — under systemd's 90-second default before SIGKILL — and
     exit instantly when idle, so a deploy with no run in flight costs nothing.
     A run longer than the grace still dies, but it dies flagged: the
     interrupted sweep at boot picks its row up. */
  let activeRuns = 0;
  let draining = false;
  if (!process.env.LEADS_NO_DRAIN) {
    process.once('SIGTERM', () => {
      if (activeRuns === 0) process.exit(0);
      draining = true;
      fastify.log.warn(`leads: SIGTERM with ${activeRuns} run(s) in flight — draining up to 45s`);
      const gaveUp = setTimeout(() => process.exit(0), 45000);
      const poll = setInterval(() => {
        if (activeRuns === 0) { clearTimeout(gaveUp); clearInterval(poll); process.exit(0); }
      }, 1000);
    });
  }

  fastify.post('/leads/api/search', async (req, reply) => {
    if (!is1001(req)) return reply.code(404).send({ error: 'not_found' });
    if (!authed(req)) return reply.code(401).send({ error: 'not_signed_in' });
    if (draining) {
      return reply.code(503).send({ error: 'restarting',
        message: 'The server is restarting for a deploy. Try again in a few seconds.' });
    }

    const b = req.body || {};
    const who = sessionTag(req);
    const ip = clientIp(req);
    const ua = String(req.headers['user-agent'] || '').slice(0, 200);
    const company = String(b.company || '').trim().slice(0, 120);
    const domain = String(b.domain || '').trim().toLowerCase().slice(0, 120);
    const intent = String(b.intent || '').trim().slice(0, 600);
    /* The company field is deliberately optional: with only a brief, the run
       discovers its own candidates. One of the two must be present, though —
       an empty form has nothing to research. */
    if (!company && !intent) {
      return reply.code(400).send({ error: 'nothing_to_do',
        message: 'Name a company, or describe who you are trying to reach.' });
    }

    /* Progress has to reach the browser while the run is still going — a search
       is 20-60s of Exa and DeepSeek calls, and a silent spinner for a minute
       reads as a hang. NDJSON over the raw socket, one JSON object per line. */
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    let closed = false;
    res.on('close', () => { closed = true; });
    const send = (o) => {
      if (closed) return;
      try { res.write(JSON.stringify(o) + '\n'); } catch { closed = true; }
    };

    const t0 = Date.now();
    try { Q.sweepStale.run(); } catch { /* a locked db must not stop a run */ }
    /* The row exists BEFORE the work: a run killed mid-flight keeps its
       prompt and an interrupted flag instead of vanishing from history. */
    let runId = 0;
    try {
      runId = Number(Q.startRun.run(company || '(discovered)', domain || null, intent || null,
        who, ip, ua).lastInsertRowid) || 0;
    } catch { /* the ledger is a nicety; never fail the run over it */ }
    activeRuns++;
    try {
      const result = await engine.runSearch({
        company, domain, intent,
        census: censusCompanies(),
        onStep: (name, detail) => send({ type: 'stage', name, detail }),
      });
      const u = result.usage || {};
      const published = (result.people || []).filter((p) => p.email && p.email.confidence === 'published').length;
      try {
        /* Keep the ANSWER, not the working. The people and the run-level
           evidence are what someone re-reads; the raw page text behind them is
           large, goes stale, and is re-fetchable. */
        const keep = JSON.stringify({
          people: (result.people || []).map((p) => ({
            company: p.company, name: p.name, role: p.role, since: p.since,
            department: p.department, linkedin: p.linkedin, rank: p.rank, why: p.why,
            email: p.email,
          })),
          companies: result.companies || null,
          multi: !!result.multi,
          domain: result.domain, domainSource: result.domainSource, domainTrusted: result.domainTrusted,
          mailProvider: result.mailProvider, patterns: result.patterns || [],
          shapes: result.shapes || [],
          emailsFound: result.emailsFound || [], roleBoxes: result.roleBoxes || [],
          notes: result.notes || [], verification: result.verification,
        });
        Q.finishRun.run(result.company || company || '(discovered)', result.domain || domain || null,
          (result.people || []).length, published, result.exaQueries || 0,
          u.tokensIn || 0, u.tokensOut || 0, u.costUsd || 0, Date.now() - t0,
          JSON.stringify(result.rolesUsed || []), keep, runId);
      } catch { /* the ledger is a nicety; never fail the run over it */ }
      send({ type: 'done', result });
    } catch (err) {
      const msg = (err && err.message) ? String(err.message).slice(0, 300) : 'The run failed.';
      try { Q.failRun.run(Date.now() - t0, msg, runId); } catch { /* nothing left to do */ }
      send({ type: 'error', message: msg });
    } finally {
      /* Close the socket BEFORE releasing the drain, or a SIGTERM already
         waiting can exit the process in the window between the two and cut
         the response short after the answer was written. */
      if (!closed) { try { res.end(); } catch { /* peer already gone */ } }
      activeRuns--;
    }
  });

  /* The operator's session is what also opens the full census file (see the
     /data/census.json gate in server.js). Same door as the dashboard: there is
     one operator today, so a second credential would be a second thing to lose
     rather than a second level of access. */
  return { authed };
};
