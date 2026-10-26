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
 * THE FREE-ACCOUNT CARD (was THE WALL: slice 2, Luca 18 Oct 2026, "make them
 * blurred and popup signing just like instagram/meta"; made a card on 23 Oct
 * 2026, Luca: "we need to delete the 2 minute forced login, just make the popup
 * maybe what feature inside of it"): for readers who are not signed in,
 * 1001startup.id pages load public/js/wall1001.js, which counts on-screen
 * seconds across pages and at 120 s (WALL_LIMIT) shows a closable card listing
 * what a free account adds, with the sign-in form (/signin?embed=1) one click
 * away. Nothing is blurred or locked, and closing it keeps it away for 7 days.
 * OFF unless data/wall.live exists (checked every 10 s, no restart): touch it
 * to switch on, delete it to switch off. ?wall=test turns on a 10-second test
 * clock for one browser (cookie w1001t, a day); ?wall=off ends it. Counts with
 * no identifiers go to wall_counts (first / view / open / close per day, and
 * signin / signup from the card's form; 'back' only up to 23 Oct).
 * Readers who came from an AI answer today (px chan 'ai', e.g. a ChatGPT link) are
 * also counted as ai_first / ai_view / ai_open / ai_close at the card and ai_signin /
 * ai_signup on any sign-in (Luca, 19 Oct 2026: "track whether those readers hit the
 * wall and sign in"). Matched on the counter's daily visitor id, so a sign-in after
 * midnight Jakarta time (17:00 UTC) is no longer linked to the arrival.
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
const DASH = require('../views/dash1001');
const CHAT = require('../views/chat1001');
const LEADPAGE = require('../views/myleads1001');

const COOKIE = 'a1001';
const TTL_DAYS = 30;
const ORIGINS = ['https://1001startup.id', 'https://www.1001startup.id'];
const WALL_HOST = '1001startup.id';    // not dc.1001startup.id: our cookie is host-only
const WALL_LIMIT = 120;                // seconds of reading before the card (45 s on 18 Oct, 120 s since 19 Oct)
const WALL_TEST_LIMIT = 10;
/* never carded: the sign-in page itself, /leads (its own access code) */
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
CREATE TABLE IF NOT EXISTS acct_lead_asks (
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, ref)
);
CREATE TABLE IF NOT EXISTS ask_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  day TEXT NOT NULL DEFAULT (date('now')),
  lang TEXT,
  q TEXT,
  tools TEXT,
  ok INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  ms INTEGER,
  tin INTEGER,
  tcached INTEGER,
  tout INTEGER,
  micro REAL
);
CREATE INDEX IF NOT EXISTS idx_ask_log_day ON ask_log(day);
CREATE TABLE IF NOT EXISTS ask_user_day (
  day TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id)
);
`);
  const cols = new Set(db.prepare('PRAGMA table_info(acct_users)').all().map((c) => c.name));
  if (!cols.has('clerk_id')) db.exec('ALTER TABLE acct_users ADD COLUMN clerk_id TEXT');
  /* the one question (call 4): role_at set + role NULL = skipped */
  if (!cols.has('role')) db.exec('ALTER TABLE acct_users ADD COLUMN role TEXT');
  if (!cols.has('role_at')) db.exec('ALTER TABLE acct_users ADD COLUMN role_at TEXT');
  /* which chip a question was asked under on the chat page (views/chat1001.js); NULL = all data */
  if (!db.prepare('PRAGMA table_info(ask_log)').all().some((c) => c.name === 'scope')) db.exec('ALTER TABLE ask_log ADD COLUMN scope TEXT');

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
    /* the dashboard (views/dash1001.js): lead-agent requests ('' / '' = early access) and Ask 1001 */
    leadAsks: db.prepare(`SELECT kind, ref FROM acct_lead_asks WHERE user_id = ?`),
    leadAsk: db.prepare(`INSERT OR IGNORE INTO acct_lead_asks (user_id, kind, ref) VALUES (?, ?, ?)`),
    leadAskCount: db.prepare(`SELECT COUNT(*) AS n FROM acct_lead_asks WHERE user_id = ?`),
    askUsed: db.prepare(`SELECT n FROM ask_user_day WHERE day = date('now') AND user_id = ?`),
    askBump: db.prepare(`INSERT INTO ask_user_day (day, user_id, n) VALUES (date('now'), ?, 1)
      ON CONFLICT(day, user_id) DO UPDATE SET n = n + 1`),
    /* no user id here: what readers ask, not who asked it */
    askLog: db.prepare(`INSERT INTO ask_log (lang, q, tools, ok, reason, ms, tin, tcached, tout, micro, scope)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    askSpent: db.prepare(`SELECT COALESCE(SUM(micro), 0) AS m FROM ask_log WHERE day = date('now')`),
    /* day-level counts only: nothing here can tell two readers apart */
    bump: db.prepare(`INSERT INTO wall_counts (day, kind, n) VALUES (date('now'), ?, 1)
      ON CONFLICT(day, kind) DO UPDATE SET n = n + 1`),
  };
  const bump = (k) => { try { Q.bump.run(k); } catch { /* a count must never break a page */ } };
  /* Did this browser arrive from an AI answer today? Same visitor id as the
     counter (lib/px.js); a lookup that fails just says no. */
  const px = deps.px || require('./px');
  let aiQ = null;
  function fromAi(req) {
    try {
      aiQ = aiQ || px.db.prepare(`SELECT 1 FROM px_view WHERE host = '1001.vantis.sh' AND vid = ? AND chan = 'ai' AND ts >= ? LIMIT 1`);
      const vid = px.visitorId('1001.vantis.sh', String(ipOf(req)), String(req.headers['user-agent'] || ''));
      return !!aiQ.get(vid, Date.now() - 86400e3);
    } catch { return false; }
  }

  const ME_FILE = process.env.ME_FILE_1001 || path.join(__dirname, '..', 'data', 'me.live');
  let meAt = 0;
  let meOnNow = false;
  function meOn() {
    if (Date.now() - meAt > 10e3) { meAt = Date.now(); meOnNow = fs.existsSync(ME_FILE); }
    return meOnNow;
  }
  /* My 1001 as one chat box (views/chat1001.js) while data/chat.live AND
     data/ask.live exist, else as a dashboard (views/dash1001.js) while
     data/dash.live exists, else the list page; Ask 1001 while data/ask.live
     exists. Same 10 s rule. */
  const CHAT_FILE = process.env.CHAT_FILE_1001 || path.join(__dirname, '..', 'data', 'chat.live');
  const DASH_FILE = process.env.DASH_FILE_1001 || path.join(__dirname, '..', 'data', 'dash.live');
  const ASK_FILE = process.env.ASK_FILE_1001 || path.join(__dirname, '..', 'data', 'ask.live');
  const sw = { chat: [0, false], dash: [0, false], ask: [0, false] };
  function swOn(k, file) {
    if (Date.now() - sw[k][0] > 10e3) sw[k] = [Date.now(), fs.existsSync(file)];
    return sw[k][1];
  }
  const chatOn = () => swOn('chat', CHAT_FILE);
  const dashOn = () => swOn('dash', DASH_FILE);
  const askOn = () => swOn('ask', ASK_FILE);

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
    const keyOf = new Map();   // sector label -> sector key, for /sector/<key> links
    for (const c of (d && d.companies) || []) if (c.sector_label && c.sector_key) keyOf.set(c.sector_label, c.sector_key);
    return { by, inv, keyOf, sectors: (d && d.by_sector) || [], generated: d && d.generated, totals: (d && d.totals) || {} };
  });
  const closedReg = fileCache(path.join(DATA, 'closed.json'), (d) => ((d && d.entries) || []).slice()
    .sort((a, b) => String(b.ended || '').localeCompare(String(a.ended || ''))));
  /* one widget key a line (rounds, read, investors, sectors, closed; leads = the dashboard's lead agent card) hides it */
  function hidden() {
    try { return new Set(fs.readFileSync(path.join(DATA, 'me-widgets-off.txt'), 'utf8').split(/\s+/).filter(Boolean)); } catch { return new Set(); }
  }
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

  /* the startups 1001 readers opened most in 7 days (both languages, one
     row a company), recounted at most every 10 minutes */
  let readAt = 0;
  let readList = [];
  function mostRead() {
    if (Date.now() - readAt > 600e3) {
      readAt = Date.now();
      try {
        const rows = db.prepare(`SELECT path, vid FROM px_view
          WHERE host = '1001.vantis.sh' AND eng = 1 AND net = '' AND ts > ?
            AND (path LIKE '/company/%' OR path LIKE '/id/company/%')`).all(Date.now() - 7 * 86400e3);
        const people = new Map();
        for (const r of rows) {
          let id = String(r.path).replace(/^\/(id\/)?company\//, '').split(/[/?#]/)[0];
          try { id = decodeURIComponent(id); } catch { continue; }
          if (!people.has(id)) people.set(id, new Set());
          people.get(id).add(r.vid);
        }
        readList = [...people].map(([id, v]) => ({ id, n: v.size })).sort((a, b) => b.n - a.n).slice(0, 30);
      } catch { readList = []; }
    }
    return readList;
  }

  /** The widgets under /me's list (views/me1001.js), from data 1001 already has. */
  function widgetsFor(rows) {
    const off = hidden();
    const C = census();
    const W = {};
    if (!off.has('rounds')) {
      const all = [...C.by.values()].filter((c) => (c.last_round_year || 0) >= 2025)
        .sort((a, b) => (b.last_round_year - a.last_round_year) || ((b.funding_total_usd_m || 0) - (a.funding_total_usd_m || 0)));
      W.rounds = { total: all.length, items: all.slice(0, 8), asof: C.generated };
    }
    if (!off.has('read')) W.read = mostRead().map((x) => ({ c: C.by.get(x.id), n: x.n })).filter((x) => x.c).slice(0, 8);
    if (!off.has('investors')) {
      const mine = rows.filter((r) => r.kind === 'investor').map((r) => r.obj);
      W.investors = { mine, top: mine.length ? [] : [...C.inv.values()].sort((a, b) => b.cos.length - a.cos.length).slice(0, 5) };
    }
    if (!off.has('sectors')) {
      const mineKeys = new Set(rows.filter((r) => r.kind === 'company').map((r) => r.obj.sector_key));
      W.sectors = C.sectors.map((x) => ({ ...x, key: C.keyOf.get(x.name) || '', mine: mineKeys.has(C.keyOf.get(x.name)) }))
        .sort((a, b) => (b.mine - a.mine) || (b.count - a.count));
    }
    if (!off.has('closed')) W.closed = closedReg().slice(0, 6);
    return W;
  }

  /* The dashboard's number tiles, all counted from the files the pages use. */
  const subsTotal = fileCache(path.join(DATA, 'bumn-subs.json'), (d) => Object.values((d && d.groups) || {})
    .reduce((t, g) => t + (g.t1 || 0) + (g.t2 || 0) + (g.deeper || 0), 0));
  function kpisFor(widgets) {
    const C = census();
    let founders = 0;
    let foundersAt = 0;
    for (const c of C.by.values()) {
      const f = (c.founders || []).length;
      if (f) { founders += f; foundersAt += 1; }
    }
    const D = [...dcs().values()];
    const tot = (C.totals) || {};
    const rounds = widgets && widgets.rounds;
    return {
      startups: C.by.size,
      raisedB: tot.funding_usd_b != null ? tot.funding_usd_b : '',
      rounds: rounds ? rounds.total : [...C.by.values()].filter((c) => (c.last_round_year || 0) >= 2025).length,
      topRound: rounds && rounds.items[0] ? rounds.items[0].name : '',
      bumn: bumn().size,
      subs: subsTotal(),
      dcs: D.length,
      dcsOn: D.filter((p) => /^operat/i.test(String(p.status || ''))).length,
      investors: C.inv.size,
      founders,
      foundersAt,
    };
  }

  /* Everything the dashboard's search bar can find (public names and the
     same second line /me shows), one list per language, rebuilt when a data
     file changes. */
  const indexCache = { en: null, id: null };
  let indexKey = '';
  function indexFor(lang) {
    const C = census();
    const key = [C.generated, C.by.size, bumn().size, dcs().size].join('|');
    if (key !== indexKey) { indexCache.en = null; indexCache.id = null; indexKey = key; }
    if (indexCache[lang]) return indexCache[lang];
    const Lx = (en, id) => (lang === 'id' ? id : en);
    const out = [];
    const add = (kind, ref) => {
      const r = resolve(kind, ref, lang);
      if (!r) return;
      let s = '';
      try { s = ME.parts.subLine(r, Lx); } catch { s = ''; }
      out.push({ k: kind, r: ref, n: r.name, s, h: r.href, x: kind === 'company' ? (r.obj.legal_name || '') : kind === 'bumn' ? (r.obj.name || '') : kind === 'dc' ? (r.obj.op || '') : '' });
    };
    for (const id of C.by.keys()) add('company', id);
    for (const slug of bumn().keys()) add('bumn', slug);
    for (const id of dcs().keys()) add('dc', id);
    for (const slug of C.inv.keys()) add('investor', slug);
    for (const x of C.sectors) {
      const k = C.keyOf.get(x.name);
      if (k) out.push({ k: 'sector', r: k, n: x.name, s: Lx(`${x.count} companies in the census`, `${x.count} perusahaan di sensus`), h: `${pfx(lang)}/sector/${encodeURIComponent(k)}`, x: '' });
    }
    indexCache[lang] = JSON.stringify({ ok: true, items: out });
    return indexCache[lang];
  }

  /* Ask 1001 (lib/ask1001.js): one question at a time per reader, ASK_PER_DAY
     a day each, and the whole chat stops for the day at ASK_DAY_MICRO of model
     spend. Three failures in a row send Luca one Telegram line (at most every
     2 hours): the census chat this replaces failed silently for 15 days. */
  const ASK_PER_DAY = 40;
  const ASK_DAY_MICRO = 1e6;   // US$1
  let askEngine = null;
  function engine() {
    if (!askEngine) askEngine = require('./ask1001')({ log: (o) => fastify.log.info(o, 'ask1001') });
    return askEngine;
  }
  const asking = new Set();
  let askFails = 0;
  let alertedAt = 0;
  /* All VM alerts are off while ~/.config/vm-alerts/OFF exists, the same switch /usr/local/bin/discord-alert obeys
     (Luca, 27 Oct 2026: "turn alerts off completely"). Checked on every alert, so rm that file turns this back on
     without a restart. */
  const ALERTS_OFF = path.join(require('os').homedir(), '.config', 'vm-alerts', 'OFF');
  async function alertLuca(text) {
    if (!PROD || Date.now() - alertedAt < 2 * 3600e3) return;
    if (fs.existsSync(ALERTS_OFF)) return;
    alertedAt = Date.now();
    try {
      const cfg = JSON.parse(fs.readFileSync(path.join(require('os').homedir(), '.openclaw', 'openclaw.json'), 'utf8'));
      const tg = (cfg.channels && cfg.channels.telegram) || {};
      const token = String(tg.botToken || '');
      const chat = String((tg.allowFrom || [])[0] || '');  /* Luca's DM: the chat the bot accepts */
      if (!token || !chat) return;
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
        signal: AbortSignal.timeout(15e3),
      });
    } catch { /* an alert must never break a page; the URL holds the token, so nothing is logged */ }
  }

  /* The lead agent (lib/leadagent1001.js): people search inside Ask 1001 for the
     accounts data/leadagent.live lists (Luca, 26 Oct 2026). */
  const LEADS = require('./leadagent1001')({ db, log: (o) => fastify.log.info(o, 'leadagent1001'), alert: (t) => alertLuca(t) });
  /* Ask 1001 chat history (lib/askchats1001.js), for the accounts data/askhistory.live lets keep it */
  const CHATS = require('./askchats1001')({ db });
  function leadsFor(me) {
    if (!me || !LEADS.allowed(me.id)) return null;
    return { find: (a) => LEADS.find(me.id, a), reveal: (a) => LEADS.reveal(me.id, a) };
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
    if (fromAi(req)) { bump('ai_signin'); if (isNew) bump('ai_signup'); }
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
    reply.header('Cache-Control', 'no-store');
    /* ?chat=1 / ?dash=1 / ?dash=0 let a signed-in reader see any of the three
       pages whatever the switches say (the chat needs Ask 1001 on) */
    const q = req.query || {};
    if (askOn() && q.dash == null && (q.chat === '1' || (chatOn() && q.chat !== '0'))) {
      try {
        const early = Q.leadAsks.all(me.id).some((a) => !a.kind && !a.ref);
        return reply.type('text/html').send(CHAT.page({ lang, user, rows, k: kpisFor(null), early, leads: !!leadsFor(me), history: CHATS.allowed(me.id) }));
      } catch (e) { req.log.warn({ why: String(e && e.message || e) }, 'acct1001: chat page failed, dashboard instead'); }
    }
    let widgets = {};
    try { widgets = widgetsFor(rows); } catch (e) { req.log.warn({ why: String(e && e.message || e) }, 'acct1001: widgets skipped'); }
    if (q.dash === '1' || (dashOn() && q.dash !== '0')) {
      try {
        const asked = new Set(Q.leadAsks.all(me.id).map((a) => `${a.kind}:${a.ref}`));
        return reply.type('text/html').send(DASH.page({ lang, user, rows, widgets, k: kpisFor(widgets), asked, ask: askOn(), lead: !hidden().has('leads') }));
      } catch (e) { req.log.warn({ why: String(e && e.message || e) }, 'acct1001: dashboard failed, list page instead'); }
    }
    return reply.type('text/html').send(ME.page({ lang, user, rows, widgets }));
  });

  /* the lead agent's saved people: a page and its CSV, for the accounts it allows (404 for anyone else) */
  fastify.get('/me/leads', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const lang = langOf(req);
    if (!meOn() || !PK || !SK) return reply.redirect(`${pfx(lang)}/signin`);
    const me = signedIn(req);
    if (!me) return reply.redirect(`${pfx(lang)}/signin?next=${encodeURIComponent(pfx(lang) + '/me/leads')}`);
    if (!leadsFor(me)) return reply.redirect(`${pfx(lang)}/me`);
    let bal = {};
    try { bal = await LEADS.balance(); } catch { /* the page shows without it */ }
    reply.header('Cache-Control', 'no-store');
    return reply.type('text/html').send(LEADPAGE.page({ lang, rows: LEADS.list(me.id), used: LEADS.usedToday(), cap: LEADS.dayCap, bal }));
  });
  /* the reader's own chats: the list, one chat, and deleting one (404 when history is off for them) */
  fastify.get('/api/me/chats', async (req, reply) => {
    if (!is1001(req) || !meOn()) return reply.code(404).send({ ok: false });
    const me = signedIn(req);
    if (!me) return reply.code(401).send({ ok: false, error: 'signin' });
    if (!CHATS.allowed(me.id)) return reply.code(404).send({ ok: false });
    reply.header('Cache-Control', 'no-store');
    return reply.send({ ok: true, chats: CHATS.list(me.id) });
  });
  fastify.get('/api/me/chats/:id', async (req, reply) => {
    if (!is1001(req) || !meOn()) return reply.code(404).send({ ok: false });
    const me = signedIn(req);
    if (!me) return reply.code(401).send({ ok: false, error: 'signin' });
    if (!CHATS.allowed(me.id)) return reply.code(404).send({ ok: false });
    const chat = CHATS.get(me.id, req.params.id);
    if (!chat) return reply.code(404).send({ ok: false, error: 'gone' });
    reply.header('Cache-Control', 'no-store');
    return reply.send({ ok: true, chat });
  });
  fastify.post('/api/me/chats/:id/delete', async (req, reply) => {
    if (!is1001(req) || !meOn()) return reply.code(404).send({ ok: false });
    const me = signedIn(req);
    if (!me) return reply.code(401).send({ ok: false, error: 'signin' });
    if (!CHATS.allowed(me.id)) return reply.code(404).send({ ok: false });
    return reply.send({ ok: CHATS.remove(me.id, req.params.id) });
  });

  fastify.get('/me/leads.csv', async (req, reply) => {
    if (!is1001(req)) return reply.code(404).send();
    const me = signedIn(req);
    if (!me || !leadsFor(me)) return reply.code(404).send();
    reply.header('Cache-Control', 'no-store');
    reply.header('Content-Disposition', `attachment; filename="1001-leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    return reply.type('text/csv; charset=utf-8').send('﻿' + LEADS.csv(me.id));
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

  /* ── the dashboard's search, lead agent and Ask 1001 ───────────────── */

  fastify.get('/api/me/index', async (req, reply) => {
    if (!is1001(req) || !meOn()) return reply.code(404).send({ ok: false });
    if (!signedIn(req)) return reply.code(401).send({ ok: false, error: 'signin' });
    const lang = (req.query && req.query.lang) === 'id' ? 'id' : 'en';
    reply.header('Cache-Control', 'private, max-age=300');
    return reply.type('application/json; charset=utf-8').send(indexFor(lang));
  });

  /* Lead agent, coming soon: a request is saved, nothing is searched. */
  fastify.post('/api/me/lead', async (req, reply) => {
    if (!is1001(req) || !meOn()) return reply.code(404).send({ ok: false });
    const me = signedIn(req);
    if (!me) return reply.code(401).send({ ok: false, error: 'signin' });
    const b = req.body || {};
    const k = String(b.k || '');
    const r = String(b.r || '');
    if (k || r) {
      if ((k !== 'company' && k !== 'bumn') || !r || r.length > 160) return reply.code(400).send({ ok: false, error: 'bad' });
      if (!KINDS[k](r)) return reply.code(404).send({ ok: false, error: 'unknown' });
    }
    if (Q.leadAskCount.get(me.id).n >= MAX_FOLLOWS) return reply.code(409).send({ ok: false, error: 'too_many' });
    Q.leadAsk.run(me.id, k, r);
    return reply.send({ ok: true });
  });

  fastify.post('/api/me/ask', async (req, reply) => {
    if (!is1001(req) || !meOn() || !askOn()) return reply.code(404).send({ ok: false });
    const me = signedIn(req);
    if (!me) return reply.code(401).send({ ok: false, error: 'signin' });
    const b = req.body || {};
    const q = String(b.q || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!q) return reply.code(400).send({ ok: false, error: 'empty' });
    const lang = b.lang === 'id' ? 'id' : 'en';
    const leads = leadsFor(me);
    const scope = CHAT.SCOPES.some(([sc]) => sc && sc === b.scope) || (leads && b.scope === 'people') ? b.scope : '';
    const history = (Array.isArray(b.history) ? b.history : []).slice(-6)
      .map((h) => ({ role: h && h.role === 'assistant' ? 'assistant' : 'user', content: String((h && h.content) || '').slice(0, 1500) }))
      .filter((h) => h.content);
    if (asking.has(me.id)) return reply.code(429).send({ ok: false, error: 'one_at_a_time' });
    if (((Q.askUsed.get(me.id) || {}).n || 0) >= ASK_PER_DAY) return reply.code(429).send({ ok: false, error: 'daily_limit' });
    if (Q.askSpent.get().m >= ASK_DAY_MICRO) return reply.code(503).send({ ok: false, error: 'paused' });
    asking.add(me.id);
    Q.askBump.run(me.id);
    /* NDJSON: { t: 'step', tool, label } as each search runs, { t: 'delta',
       d, n } for the reply's words when the page asked for them (stream:
       true; n = which model turn wrote them), then one { t: 'answer', ... }
       or { t: 'fail', reason }. Bypasses compression. */
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', 'X-Content-Type-Options': 'nosniff' });
    const send = (o) => { try { raw.write(JSON.stringify(o) + '\n'); } catch { /* reader left */ } };
    /* a lead lookup can wait up to 100 s on its provider: a blank line every 15 s
       keeps nginx and Cloudflare from closing the stream (the page skips blank lines) */
    const beat = leads ? setInterval(() => { try { raw.write('\n'); } catch { /* reader left */ } }, 15e3) : null;
    let res = null;
    try {
      res = await engine().run({ q, history, lang, scope, leads,
        onStep: (st) => send({ t: 'step', tool: st.tool, label: st.label }),
        /* the answer's words as the model writes them (chat page only; the dashboard skips these lines) */
        onText: b.stream === true ? (d, n) => send({ t: 'delta', d, n }) : null });
    } catch (e) {
      req.log.warn({ why: String(e && e.message || e) }, 'ask1001: run threw');
      res = { ok: false, reason: 'upstream', steps: [], usage: {}, ms: 0 };
    }
    if (beat) clearInterval(beat);
    const u = res.usage || {};
    try {
      Q.askLog.run(lang, q.slice(0, 300), (res.steps || []).map((x) => x.tool).join(','), res.ok ? 1 : 0, res.ok ? null : String(res.reason || ''),
        Math.round(res.ms || 0), u.in || 0, u.cached || 0, u.out || 0, u.micro || 0, scope || null);
    } catch { /* the log must never cost the answer */ }
    if (res.ok) {
      askFails = 0;
      /* history on: the turn joins the reader's open chat (b.chat), or starts one */
      const chat = CHATS.allowed(me.id) ? CHATS.add(me.id, parseInt(b.chat, 10) || null, { q, sc: scope, a: res.answer, ents: res.entities, asof: res.asof, ms: res.ms }) : null;
      send({ t: 'answer', answer: res.answer, entities: res.entities || [], asof: res.asof || '', ms: res.ms || 0, ...(chat ? { chat } : {}) });
    } else {
      askFails += 1;
      if (askFails >= 3) alertLuca(`Ask 1001 on 1001startup.id/me failed ${askFails} times in a row (last: ${res.reason}). Switch off: rm ~/projects/pasar-vantis/data/ask.live`);
      send({ t: 'fail', reason: res.reason === 'busy' ? 'busy' : 'pause' });
    }
    asking.delete(me.id);
    try { raw.end(); } catch { /* gone */ }
  });

  /* The wall reports what it did: 'first' = this browser met the wall for the
     first time, 'view' = a page opened behind the wall. Test clocks send
     nothing. sendBeacon posts JSON; the origin check in server.js applies. */
  const wallHits = new Map();
  fastify.post('/api/wall/event', async (req, reply) => {
    if (!is1001(req)) return reply.code(404).send({ ok: false });
    const k = req.body && req.body.k;
    if (k !== 'first' && k !== 'view' && k !== 'open' && k !== 'close') return reply.code(400).send({ ok: false });
    const ip = String(ipOf(req));
    const now = Date.now();
    const r = wallHits.get(ip) || { n: 0, at: now };
    if (now - r.at > 3600e3) { r.n = 0; r.at = now; }
    r.n += 1;
    wallHits.set(ip, r);
    if (wallHits.size > 5000) for (const [key, v] of wallHits) if (now - v.at > 3600e3) wallHits.delete(key);
    if (r.n > 120) return reply.code(429).send({ ok: false });
    bump(k);
    if (fromAi(req)) bump('ai_' + k);
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
  /* The free-account card goes into the <head> of full 1001startup.id pages
     (fragments like the company drawer have no </head>) for readers who are
     not signed in, while it is switched on or this browser is in test mode.
     The page itself is the same for everyone: no paywall markup, no no-store
     (both went with the wall on 23 Oct 2026). */
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
    let head = '';
    const lang = (req.raw && req.raw.lang1001 === 'id') ? 'id' : 'en';
    if ((wallOn() || test) && !signedIn(req)) {
      head += WALL.css + `<script src="/js/wall1001.js?v=${view.AV}" data-limit="${test ? WALL_TEST_LIMIT : WALL_LIMIT}" data-lang="${lang}"`
        + `${test ? ' data-test="1"' : ''}${reset ? ' data-reset="1"' : ''}${clear ? ' data-clear="1"' : ''} defer></script>`;
    } else if (clear) {
      head += `<script src="/js/wall1001.js?v=${view.AV}" data-off="1" defer></script>`;
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
