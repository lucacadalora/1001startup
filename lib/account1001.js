'use strict';
/**
 * 1001startup.id — reader accounts: login wall slice 1 (Luca, 18 Oct 2026).
 * Plan: https://claude.ai/artifact/UsFcmrbQjNFJQACJDAmGDK
 *
 * Clerk does the signing in (Luca: "thats why we need clerk"): its email-code
 * form runs on /signin, from Clerk app "1001startup" (production instance on
 * clerk.1001startup.id, email code only, passwords and Google off). Once Clerk
 * says who the reader is, public/js/signin1001.js posts Clerk's short-lived
 * session token to POST /signin/clerk; we check it here (RS256 against the
 * instance's JWKS, issuer, authorized party, expiry), read the email from
 * Clerk's Backend API, and hand out OUR OWN 30-day session cookie. Every other
 * page (the header link now, the wall in slice 2) reads only that cookie, so
 * no page but /signin loads Clerk's scripts or needs a looser CSP.
 *
 * Mounted from server.js with one line, like lib/leads-routes.js, because
 * another session edits this repo concurrently.
 *
 * Storage (data/pasar.db): acct_users (email, clerk_id), acct_sessions (the
 * token is stored as a SHA-256 hash, so a copy of the database signs nobody
 * in). Our cookie is HOST-ONLY (no Domain attribute, ever).
 *
 * Keys in .env: CLERK_PUBLISHABLE_KEY_1001, CLERK_SECRET_KEY_1001.
 *
 * THE WALL (slice 2, Luca 18 Oct 2026: "make them blurred and popup signing
 * just like instagram/meta"): for readers who are not signed in, 1001startup.id
 * pages load public/js/wall1001.js, which counts on-screen seconds across pages
 * and at 45 s (WALL_LIMIT) blurs the page under a sign-in card holding /signin?embed=1.
 * OFF unless data/wall.live exists (checked every 10 s, no restart): touch it
 * to switch on, delete it to switch off. ?wall=test turns on a 10-second test
 * clock for one browser (cookie w1001t, a day); ?wall=off ends it. Counts with
 * no identifiers go to wall_counts (first / view / signin / signup per day).
 *
 * FOLLOW + MY 1001 (dashboard slice 1, Luca 18 Oct 2026; plan
 * https://claude.ai/artifact/CavAoXkc8XgExFGG5th8uH): readers follow startups,
 * BUMN, data-centre projects and investors (acct_follows), see them at /me
 * (views/me1001.js), and answer one skippable question (acct_users.role).
 * OFF unless data/me.live exists (10 s, no restart): with it off, Follow
 * buttons stay hidden (public/js/follow1001.js is not loaded) and /me goes to
 * the sign-in page.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const view = require('../views/signin1001');
const WALL = require('../views/wall1001');
const ME = require('../views/me1001');
const INV = require('../views/investors1001');

const COOKIE = 'a1001';
const TTL_DAYS = 30;
const ORIGINS = ['https://1001startup.id', 'https://www.1001startup.id'];
const WALL_HOST = '1001startup.id';    // not dc.1001startup.id: our cookie is host-only
const WALL_LIMIT = 45;                 // Luca 18 Oct: 45 s (was 120 s, call 1)
const WALL_TEST_LIMIT = 10;
/* never walled: the sign-in page itself, /leads (its own access code) */
const WALL_SKIP = /^\/(signin|signout|leads)(\/|$)/;

const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const b64url = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/* pk_live_<base64("clerk.1001startup.id$")> -> clerk.1001startup.id */
function fapiOf(pk) {
  const m = /^pk_(test|live)_(.+)$/.exec(String(pk || ''));
  if (!m) return '';
  return b64url(m[2]).toString('utf8').replace(/\$$/, '');
}

module.exports = function registerAccounts(fastify, deps) {
  const { db, is1001, PROD, ipOf } = deps;
  const langOf = deps.langOf || (() => 'en');
  const PK = process.env.CLERK_PUBLISHABLE_KEY_1001 || '';
  const SK = process.env.CLERK_SECRET_KEY_1001 || '';
  const FAPI = fapiOf(PK);
  const ISSUER = FAPI ? 'https://' + FAPI : '';
  /* a test copy on a spare port is a different origin; production never is */
  const extraOrigin = process.env.CLERK_EXTRA_ORIGIN_1001 || '';
  const allowed = new Set(ORIGINS.concat(!PROD && extraOrigin ? [extraOrigin] : []));

  db.exec(`
CREATE TABLE IF NOT EXISTS acct_users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_signin_at TEXT,
  signins INTEGER NOT NULL DEFAULT 0,
  lang TEXT
);
CREATE TABLE IF NOT EXISTS acct_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  ua TEXT
);
CREATE INDEX IF NOT EXISTS idx_acct_sessions_expiry ON acct_sessions(expires_at);
CREATE TABLE IF NOT EXISTS acct_follows (
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, ref)
);
CREATE INDEX IF NOT EXISTS idx_acct_follows_ref ON acct_follows(kind, ref);
CREATE TABLE IF NOT EXISTS wall_counts (
  day TEXT NOT NULL,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind)
);
`);
  const cols = new Set(db.prepare('PRAGMA table_info(acct_users)').all().map((c) => c.name));
  if (!cols.has('clerk_id')) db.exec('ALTER TABLE acct_users ADD COLUMN clerk_id TEXT');
  /* the one question (call 4): role_at set + role NULL = skipped */
  if (!cols.has('role')) db.exec('ALTER TABLE acct_users ADD COLUMN role TEXT');
  if (!cols.has('role_at')) db.exec('ALTER TABLE acct_users ADD COLUMN role_at TEXT');

  const Q = {
    sessionUser: db.prepare(`SELECT u.id, u.email FROM acct_sessions s JOIN acct_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now')`),
    newSession: db.prepare(`INSERT INTO acct_sessions (token_hash, user_id, expires_at, ip, ua)
      VALUES (?, ?, datetime('now', ?), ?, ?)`),
    dropSession: db.prepare(`DELETE FROM acct_sessions WHERE token_hash = ?`),
    upsertUser: db.prepare(`INSERT INTO acct_users (email, clerk_id, lang, last_signin_at, signins)
      VALUES (?, ?, ?, datetime('now'), 1)
      ON CONFLICT(email) DO UPDATE SET clerk_id = excluded.clerk_id,
        last_signin_at = datetime('now'), signins = signins + 1`),
    userByEmail: db.prepare(`SELECT id FROM acct_users WHERE email = ?`),
    sweepSessions: db.prepare(`DELETE FROM acct_sessions WHERE expires_at <= datetime('now')`),
    userById: db.prepare(`SELECT id, email, created_at, role, role_at FROM acct_users WHERE id = ?`),
    setRole: db.prepare(`UPDATE acct_users SET role = ?, role_at = datetime('now') WHERE id = ?`),
    follows: db.prepare(`SELECT kind, ref, created_at FROM acct_follows WHERE user_id = ? ORDER BY created_at DESC, rowid DESC`),
    follow: db.prepare(`INSERT OR IGNORE INTO acct_follows (user_id, kind, ref) VALUES (?, ?, ?)`),
    unfollow: db.prepare(`DELETE FROM acct_follows WHERE user_id = ? AND kind = ? AND ref = ?`),
    followCount: db.prepare(`SELECT COUNT(*) AS n FROM acct_follows WHERE user_id = ?`),
    /* day-level counts only: nothing here can tell two readers apart */
    bump: db.prepare(`INSERT INTO wall_counts (day, kind, n) VALUES (date('now'), ?, 1)
      ON CONFLICT(day, kind) DO UPDATE SET n = n + 1`),
  };
  const bump = (k) => { try { Q.bump.run(k); } catch { /* a count must never break a page */ } };

  const ME_FILE = process.env.ME_FILE_1001 || path.join(__dirname, '..', 'data', 'me.live');
  let meAt = 0;
  let meOnNow = false;
  function meOn() {
    if (Date.now() - meAt > 10e3) { meAt = Date.now(); meOnNow = fs.existsSync(ME_FILE); }
    return meOnNow;
  }

  /* What can be followed, read from the files the pages themselves use; each
     is re-read when its file changes (checked at most every 30 s). */
  function fileCache(file, build) {
    let at = 0;
    let mt = -1;
    let val = null;
    return () => {
      if (val && Date.now() - at < 30e3) return val;
      at = Date.now();
      try {
        const m = fs.statSync(file).mtimeMs;
        if (m !== mt || !val) { val = build(JSON.parse(fs.readFileSync(file, 'utf8'))); mt = m; }
      } catch { if (!val) val = build(null); }
      return val;
    };
  }
  const DATA = path.join(__dirname, '..', 'data');
  const census = fileCache(path.join(__dirname, '..', 'public', 'data', 'census.json'), (d) => {
    const by = new Map();
    for (const c of (d && d.companies) || []) by.set(c.id, c);
    let inv = new Map();
    try { inv = INV.graph(d || { companies: [] }).by; } catch { /* investors stay unfollowable */ }
    return { by, inv };
  });
  const bumn = fileCache(path.join(DATA, 'bumn-56.json'), (d) => new Map(((d && d.entities) || []).map((e) => [e.slug, e])));
  const bumnMaps = fileCache(path.join(DATA, 'bumn-sankey.json'), (d) => new Set(Object.keys((d && d.groups) || {})));
  const dcs = fileCache(path.join(DATA, 'datacenter.json'), (d) => new Map(((d && d.projects) || []).map((p) => [p.id, p])));
  const KINDS = {
    company: (r) => census().by.has(r),
    bumn: (r) => bumn().has(r),
    dc: (r) => dcs().has(r),
    investor: (r) => census().inv.has(r),
  };
  const MAX_FOLLOWS = 300;

  /** One follow, ready for /me: { kind, ref, name, href, logo, obj }, or null if it no longer exists. */
  function resolve(kind, ref, lang) {
    const PF = pfx(lang);
    if (kind === 'company') {
      const c = census().by.get(ref);
      return c && { kind, ref, name: c.name, href: `${PF}/company/${encodeURIComponent(ref)}`, logo: c.logo, obj: c };
    }
    if (kind === 'bumn') {
      const e = bumn().get(ref);
      return e && { kind, ref, name: e.short || e.name, href: bumnMaps().has(ref) ? `/bumn/${encodeURIComponent(ref)}` : '/bumn', logo: e.logo, obj: e };
    }
    if (kind === 'dc') {
      const p = dcs().get(ref);
      return p && { kind, ref, name: p.name, href: `/data-center#p-${encodeURIComponent(ref)}`, logo: p.logo, obj: p };
    }
    if (kind === 'investor') {
      const e = census().inv.get(ref);
      return e && { kind, ref, name: e.name, href: `${PF}/investor/${encodeURIComponent(ref)}`, logo: '', obj: e };
    }
    return null;
  }

  /* /me's empty state: the startups 1001 readers opened most in 7 days */
  let readAt = 0;
  let readIds = [];
  function mostRead() {
    if (Date.now() - readAt > 600e3) {
      readAt = Date.now();
      try {
        readIds = db.prepare(`SELECT path, COUNT(DISTINCT vid) AS n FROM px_view
          WHERE host = '1001.vantis.sh' AND eng = 1 AND net = '' AND ts > ?
            AND (path LIKE '/company/%' OR path LIKE '/id/company/%')
          GROUP BY path ORDER BY n DESC LIMIT 20`).all(Date.now() - 7 * 86400e3)
          .map((r) => decodeURIComponent(String(r.path).replace(/^\/(id\/)?company\//, '').split(/[/?#]/)[0]));
      } catch { readIds = []; }
    }
    return [...new Set(readIds)];
  }

  const WALL_FILE = process.env.WALL_FILE_1001 || path.join(__dirname, '..', 'data', 'wall.live');
  let wallAt = 0;
  let wallOnNow = false;
  function wallOn() {
    if (Date.now() - wallAt > 10e3) { wallAt = Date.now(); wallOnNow = fs.existsSync(WALL_FILE); }
    return wallOnNow;
  }
  const sweep = () => { try { Q.sweepSessions.run(); } catch { /* a locked db must not stop boot */ } };
  sweep();
  setInterval(sweep, 3600e3).unref();

  if (!fastify.hasContentTypeParser('application/x-www-form-urlencoded')) {
    fastify.addContentTypeParser('application/x-www-form-urlencoded',
      { parseAs: 'string' }, (req, body, done) => {
        try {
          const out = {};
          for (const [k, v] of new URLSearchParams(body)) out[k] = v;
          done(null, out);
        } catch (e) { done(e); }
      });
  }

  const cookieOpts = (maxAgeS) => ({ path: '/', httpOnly: true, secure: !!PROD, sameSite: 'lax', maxAge: maxAgeS });
  const tokOf = (req) => {
    const t = req.cookies && req.cookies[COOKIE];
    return t && /^[a-f0-9]{64}$/.test(t) ? t : null;
  };

  /** The signed-in reader, or null. Exported for the wall (slice 2). */
  function signedIn(req) {
    const tok = tokOf(req);
    if (!tok) return null;
    try { return Q.sessionUser.get(sha(tok)) || null; } catch { return null; }
  }

  /* `next` is where to land after signing in: a path on this site only. */
  function safeNext(n) {
    const s = String(n || '');
    if (!s || s.length > 400 || s[0] !== '/' || s[1] === '/' || s[1] === '\\' || /[\r\n\t]/.test(s)) return '';
    if (/^\/(id\/)?(signin|signout)(\/|\?|#|$)/.test(s)) return '';
    return s;
  }
  const pfx = (lang) => (lang === 'id' ? '/id' : '');
  const L = (lang) => (en, id) => (lang === 'id' ? id : en);

  /* ── Clerk's token ─────────────────────────────────────────────────── */

  let jwks = { at: 0, keys: [] };
  async function keyFor(kid) {
    const fresh = Date.now() - jwks.at < 3600e3;
    let k = fresh && jwks.keys.find((x) => x.kid === kid);
    if (k) return k;
    /* unknown kid: refetch, at most every 30 s, so a key rotation is picked
       up without letting junk tokens hammer Clerk */
    if (Date.now() - jwks.at > 30e3) {
      const res = await fetch(ISSUER + '/.well-known/jwks.json', { signal: AbortSignal.timeout(8e3) });
      if (!res.ok) throw new Error('jwks ' + res.status);
      jwks = { at: Date.now(), keys: ((await res.json()).keys || []) };
      k = jwks.keys.find((x) => x.kid === kid);
    }
    return k || null;
  }

  /** Checks a Clerk session token; returns its claims or throws. */
  async function verify(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3 || parts.some((p) => !/^[A-Za-z0-9_-]+$/.test(p))) throw new Error('shape');
    const head = JSON.parse(b64url(parts[0]).toString('utf8'));
    if (head.alg !== 'RS256' || !head.kid) throw new Error('alg');
    const jwk = await keyFor(head.kid);
    if (!jwk) throw new Error('kid');
    const ok = crypto.verify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]),
      crypto.createPublicKey({ key: jwk, format: 'jwk' }), b64url(parts[2]));
    if (!ok) throw new Error('signature');
    const c = JSON.parse(b64url(parts[1]).toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (c.iss !== ISSUER) throw new Error('iss');
    if (typeof c.exp !== 'number' || c.exp < now - 5) throw new Error('exp');
    if (typeof c.nbf === 'number' && c.nbf > now + 5) throw new Error('nbf');
    if (c.azp && !allowed.has(c.azp)) throw new Error('azp');
    if (!/^user_[A-Za-z0-9]+$/.test(String(c.sub || ''))) throw new Error('sub');
    return c;
  }

  /** The reader's verified primary email, from Clerk's Backend API. */
  async function emailOf(userId) {
    const res = await fetch('https://api.clerk.com/v1/users/' + encodeURIComponent(userId), {
      headers: { Authorization: 'Bearer ' + SK }, signal: AbortSignal.timeout(8e3),
    });
    if (!res.ok) throw new Error('clerk user ' + res.status);
    const u = await res.json();
    const all = u.email_addresses || [];
    const e = all.find((x) => x.id === u.primary_email_address_id) || all[0];
    if (!e || (e.verification && e.verification.status !== 'verified')) throw new Error('no verified email');
    return String(e.email_address || '').trim().toLowerCase();
  }

  /* exchanges per network, in memory: each one costs a Backend API call */
  const hits = new Map();
  function tooMany(ip) {
    const now = Date.now();
    const r = hits.get(ip) || { n: 0, at: now };
    if (now - r.at > 3600e3) { r.n = 0; r.at = now; }
    r.n += 1;
    hits.set(ip, r);
    if (hits.size > 5000) for (const [k, v] of hits) if (now - v.at > 3600e3) hits.delete(k);
    return r.n > 40;
  }

  /* ── pages ─────────────────────────────────────────────────────────── */

  fastify.get('/signin', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const lang = langOf(req);
    const next = safeNext(req.query && req.query.next);
    const me = signedIn(req);
    /* the wall's popup frame: the form alone. Not a page view, no builder
       card (server.js reads skip1001). */
    if (req.query && req.query.embed) {
      if (req.raw) req.raw.skip1001 = true;
      const via = ['wall', 'test', 'follow'].includes(req.query.via) ? req.query.via : '';
      return reply.type('text/html').send(view.embed({ lang, next, pk: PK, fapi: FAPI, via, signed: !!me }));
    }
    if (me && meOn()) return reply.redirect(next || `${pfx(lang)}/me`);
    if (me) return reply.type('text/html').send(view.account({ lang, email: me.email, next }));
    return reply.type('text/html').send(view.signIn({
      lang, next, pk: PK, fapi: FAPI, out: !!(req.query && req.query.out),
    }));
  });

  fastify.post('/signin/clerk', async (req, reply) => {
    if (!is1001(req)) return reply.code(404).send({ ok: false });
    const b = req.body || {};
    const lang = b.lang === 'id' ? 'id' : 'en';
    const ip = String(ipOf(req));
    if (!PK || !SK) return reply.code(503).send({ ok: false, error: 'not_configured' });
    if (tooMany(ip)) return reply.code(429).send({ ok: false, error: 'rate_limited' });
    let email; let claims;
    try {
      claims = await verify(b.token);
      email = await emailOf(claims.sub);
    } catch (e) {
      req.log.warn({ why: String(e && e.message || e) }, 'acct1001: clerk token refused');
      return reply.code(401).send({ ok: false, error: 'not_verified' });
    }
    const tok = crypto.randomBytes(32).toString('hex');
    let isNew = false;
    try {
      db.transaction(() => {
        isNew = !Q.userByEmail.get(email);
        Q.upsertUser.run(email, claims.sub, lang);
        const u = Q.userByEmail.get(email);
        Q.newSession.run(sha(tok), u.id, `+${TTL_DAYS} days`, ip, String(req.headers['user-agent'] || '').slice(0, 300));
      })();
    } catch (e) {
      req.log.error(e, 'acct1001: sign-in write failed');
      return reply.code(503).send({ ok: false, error: 'unavailable' });
    }
    reply.setCookie(COOKIE, tok, cookieOpts(TTL_DAYS * 86400));
    if (b.via === 'wall') { bump('signin'); if (isNew) bump('signup'); }
    if (b.via === 'follow') { bump('follow_signin'); if (isNew) bump('follow_signup'); }
    return reply.send({ ok: true, next: safeNext(b.next) || `${pfx(lang)}/signin` });
  });

  /* ── follows and My 1001 ──────────────────────────────────────────── */

  fastify.get('/api/me/follows', async (req, reply) => {
    if (!is1001(req) || !meOn()) return reply.code(404).send({ ok: false });
    reply.header('Cache-Control', 'no-store');
    const me = signedIn(req);
    if (!me) return reply.send({ ok: true, signedIn: false, follows: [] });
    return reply.send({ ok: true, signedIn: true, follows: Q.follows.all(me.id).map((f) => ({ k: f.kind, r: f.ref })) });
  });

  const followHits = new Map();
  fastify.post('/api/me/follow', async (req, reply) => {
    if (!is1001(req) || !meOn()) return reply.code(404).send({ ok: false });
    const b = req.body || {};
    const k = String(b.k || '');
    const r = String(b.r || '');
    if (!Object.prototype.hasOwnProperty.call(KINDS, k) || !r || r.length > 160) return reply.code(400).send({ ok: false, error: 'bad' });
    const me = signedIn(req);
    if (!me) return reply.code(401).send({ ok: false, error: 'signin' });
    const now = Date.now();
    const h = followHits.get(me.id) || { n: 0, at: now };
    if (now - h.at > 3600e3) { h.n = 0; h.at = now; }
    h.n += 1;
    followHits.set(me.id, h);
    if (h.n > 600) return reply.code(429).send({ ok: false, error: 'slow_down' });
    if (b.on === false) { Q.unfollow.run(me.id, k, r); return reply.send({ ok: true, on: false }); }
    if (!KINDS[k](r)) return reply.code(404).send({ ok: false, error: 'unknown' });
    if (Q.followCount.get(me.id).n >= MAX_FOLLOWS) return reply.code(409).send({ ok: false, error: 'too_many' });
    Q.follow.run(me.id, k, r);
    return reply.send({ ok: true, on: true });
  });

  fastify.get('/me', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const lang = langOf(req);
    if (!meOn() || !PK || !SK) return reply.redirect(`${pfx(lang)}/signin`);
    const me = signedIn(req);
    if (!me) return reply.redirect(`${pfx(lang)}/signin?next=${encodeURIComponent(pfx(lang) + '/me')}`);
    const user = Q.userById.get(me.id);
    const rows = Q.follows.all(me.id).map((f) => resolve(f.kind, f.ref, lang)).filter(Boolean);
    const suggest = rows.length ? [] : mostRead().map((id) => resolve('company', id, lang)).filter(Boolean).slice(0, 6);
    reply.header('Cache-Control', 'no-store');
    return reply.type('text/html').send(ME.page({ lang, user, rows, suggest }));
  });

  fastify.post('/me/role', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const b = req.body || {};
    const lang = b.lang === 'id' ? 'id' : 'en';
    const me = signedIn(req);
    if (!me) return reply.redirect(`${pfx(lang)}/signin`, 303);
    if (b.skip) Q.setRole.run(null, me.id);
    else if (ME.ROLE_KEYS.includes(String(b.role || ''))) Q.setRole.run(String(b.role), me.id);
    return reply.redirect(`${pfx(lang)}/me`, 303);
  });

  /* The wall reports what it did: 'first' = this browser met the wall for the
     first time, 'view' = a page opened behind the wall. Test clocks send
     nothing. sendBeacon posts JSON; the origin check in server.js applies. */
  const wallHits = new Map();
  fastify.post('/api/wall/event', async (req, reply) => {
    if (!is1001(req)) return reply.code(404).send({ ok: false });
    const k = req.body && req.body.k;
    if (k !== 'first' && k !== 'view') return reply.code(400).send({ ok: false });
    const ip = String(ipOf(req));
    const now = Date.now();
    const r = wallHits.get(ip) || { n: 0, at: now };
    if (now - r.at > 3600e3) { r.n = 0; r.at = now; }
    r.n += 1;
    wallHits.set(ip, r);
    if (wallHits.size > 5000) for (const [key, v] of wallHits) if (now - v.at > 3600e3) wallHits.delete(key);
    if (r.n > 120) return reply.code(429).send({ ok: false });
    bump(k);
    return reply.code(204).send();
  });

  /* Ends OUR session, then /signin?out=1 signs the browser out of Clerk too,
     or the next visit to /signin would sign straight back in. */
  fastify.post('/signout', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const tok = tokOf(req);
    if (tok) { try { Q.dropSession.run(sha(tok)); } catch { /* cookie goes anyway */ } }
    reply.clearCookie(COOKIE, { path: '/' });
    return reply.redirect(`${pfx(req.body && req.body.lang === 'id' ? 'id' : 'en')}/signin?out=1`, 303);
  });

  /* ── per-request work on pages ────────────────────────────────────────
     1. /signin is the only page that loads Clerk, so only its CSP names
        Clerk's host and its bot checks (Clerk Protect on *.protect.clerk.com,
        Cloudflare Turnstile).
     2. views/nav1001.js puts <!--ACCT1001--> in the header; it is filled here,
        the way <!--PX-BADGE--> is filled in server.js. Signed out: "Sign in",
        returning to this page. Signed in: "Account". */
  /* The wall goes into the <head> of full 1001startup.id pages (fragments
     like the company drawer have no </head>) for readers who are not signed
     in, while it is switched on or this browser is in test mode. */
  function wallInto(req, reply, html, isHtml) {
    if (!isHtml || req.method !== 'GET' || reply.statusCode !== 200 || !PK || !SK) return html;
    if (String(req.headers.host || '').split(':')[0].toLowerCase() !== WALL_HOST) return html;
    if (!html.includes('</head>')) return html;
    const q = req.query || {};
    if (q.embed || q.panel || WALL_SKIP.test(String(req.url || '/').split('?')[0])) return html;
    let test = !!(req.cookies && req.cookies.w1001t === '1');
    let reset = false;
    let clear = false;
    if (q.wall === 'test') { reply.setCookie('w1001t', '1', cookieOpts(86400)); test = true; reset = true; }
    else if (q.wall === 'off') { reply.clearCookie('w1001t', { path: '/' }); test = false; clear = true; }
    const live = wallOn();
    let head = '';
    if (live) {
      head += WALL.ld;
      const m = /<body([^>]*)>/i.exec(html);
      if (m) {
        const attrs = /\bclass\s*=\s*"/i.test(m[1])
          ? m[1].replace(/\bclass\s*=\s*"([^"]*)"/i, (x, c) => `class="${c} w1001-gate"`)
          : m[1] + ' class="w1001-gate"';
        html = html.slice(0, m.index) + `<body${attrs}>` + html.slice(m.index + m[0].length);
      }
    }
    const lang = (req.raw && req.raw.lang1001 === 'id') ? 'id' : 'en';
    if ((live || test) && !signedIn(req)) {
      head += WALL.css + `<script src="/js/wall1001.js?v=${view.AV}" data-limit="${test ? WALL_TEST_LIMIT : WALL_LIMIT}" data-lang="${lang}"`
        + `${test ? ' data-test="1"' : ''}${reset ? ' data-reset="1"' : ''}${clear ? ' data-clear="1"' : ''}></script>`;
    } else if (clear) {
      head += `<script src="/js/wall1001.js?v=${view.AV}" data-off="1"></script>`;
    }
    return head ? html.replace('</head>', () => head + '</head>') : html;
  }

  /* Follow buttons come alive on full 1001startup.id pages while My 1001 is on
     (signed in or not: a signed-out click opens the sign-in popup). */
  function followInto(req, reply, html, isHtml) {
    if (!isHtml || req.method !== 'GET' || reply.statusCode !== 200 || !PK || !SK || !meOn()) return html;
    if (String(req.headers.host || '').split(':')[0].toLowerCase() !== WALL_HOST) return html;
    if (!html.includes('</head>')) return html;
    const q = req.query || {};
    if (q.embed || /^\/(signin|signout)(\/|$)/.test(String(req.url || '/').split('?')[0])) return html;
    const lang = (req.raw && req.raw.lang1001 === 'id') ? 'id' : 'en';
    const head = ME.css + `<script src="/js/follow1001.js?v=${view.AV}" data-lang="${lang}" data-signed="${signedIn(req) ? 1 : 0}" defer></script>`;
    return html.replace('</head>', () => head + '</head>');
  }

  /* Callback style on purpose, NOT async: many routes here call reply.send()
     without `return reply`, and an extra async onSend tick lets Fastify see
     the handler finish first and try to send again ("Cannot write headers
     after they are sent", 500 in the log on every page). Everything below is
     synchronous (better-sqlite3), so nothing needs awaiting. */
  fastify.addHook('onSend', (req, reply, payload, done) => {
    const isHtml = String(reply.getHeader('content-type') || '').includes('text/html');
    if (FAPI && req.method === 'GET' && req.routeOptions && req.routeOptions.url === '/signin' && isHtml) {
      const embed = !!(req.query && req.query.embed);
      if (embed) reply.header('X-Frame-Options', 'SAMEORIGIN');
      reply.header('Content-Security-Policy',
        `default-src 'self'; script-src 'self' https://${FAPI} https://*.protect.clerk.com https://*.protect.clerk.com:* https://challenges.cloudflare.com; ` +
        `style-src 'self' 'unsafe-inline'; img-src 'self' data: https://img.clerk.com; font-src 'self'; ` +
        `connect-src 'self' https://${FAPI} https://*.protect.clerk.com https://*.protect.clerk.com:*; frame-src https://challenges.cloudflare.com; worker-src 'self' blob:; ` +
        `frame-ancestors ${embed ? "'self'" : "'none'"}; base-uri 'self'; form-action 'self'`);
    }
    if (typeof payload !== 'string') return done(null, payload);
    try { payload = wallInto(req, reply, payload, isHtml); } catch (e) {
      req.log.warn({ why: String(e && e.message || e) }, 'acct1001: wall not added');
    }
    try { payload = followInto(req, reply, payload, isHtml); } catch (e) {
      req.log.warn({ why: String(e && e.message || e) }, 'acct1001: follow not added');
    }
    if (!payload.includes('<!--ACCT1001-->')) return done(null, payload);
    /* no Clerk keys in .env = sign-in is switched off: no header link at all */
    if (!PK || !SK) return done(null, payload.replaceAll('<!--ACCT1001-->', ''));
    let a = '';
    try {
      const lang = (req.raw && req.raw.lang1001 === 'id') ? 'id' : 'en';
      const t = L(lang);
      const next = safeNext(pfx(lang) + String(req.url || '/'));
      const me = signedIn(req);
      a = me
        ? `<a class="acct on" href="${pfx(lang)}${meOn() ? '/me' : '/signin'}" title="${escAttr(me.email)}">${t('Account', 'Akun')}</a>`
        : `<a class="acct" href="${pfx(lang)}/signin${next ? '?next=' + encodeURIComponent(next) : ''}">${t('Sign in', 'Masuk')}</a>`;
    } catch { a = ''; }
    return done(null, payload.replaceAll('<!--ACCT1001-->', a));
  });

  return { signedIn };
};

const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
