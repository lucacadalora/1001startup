'use strict';
/* px — first-party, cookieless visitor counting for the hosts this app serves.
 *
 * Why this exists alongside Umami: the Umami tracker is consent-gated and
 * client-side, so it is the right tool for the private dashboard but a bad
 * source for a number printed on the page — blockers and "reject" both make it
 * undercount, and an undercounted number shown as social proof is a lie in the
 * cheap direction. This counts server-side on the HTML response, which is
 * complete, needs no consent (no cookie, no device storage, no raw IP kept),
 * and is per-host so pasar.vantis.sh and 1001.vantis.sh never pool.
 *
 * Identity is a daily-rotating salted hash (the Plausible model): the same
 * person is one visitor within a day and unlinkable across days. That makes
 * "visitors" exact for a day and, over longer ranges, a sum of daily uniques —
 * which is why every all-time headline on the public page is PAGE VIEWS, a
 * number that needs no footnote.
 */
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { db } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');

try { db.exec(`
CREATE TABLE IF NOT EXISTS px_view (
  id      INTEGER PRIMARY KEY,
  host    TEXT NOT NULL,
  path    TEXT NOT NULL,
  vid     TEXT NOT NULL,          -- daily-salted visitor hash
  ref     TEXT NOT NULL DEFAULT '',
  chan    TEXT NOT NULL DEFAULT 'direct',
  country TEXT NOT NULL DEFAULT '',
  device  TEXT NOT NULL DEFAULT '',
  ts      INTEGER NOT NULL        -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_px_view_host_ts ON px_view(host, ts);
-- (host,vid,ts) so the heartbeat's "their latest path" lookup is a seek, not a
-- scan. With only (host,vid) the ORDER BY ts DESC makes the planner prefer
-- idx_px_view_host_ts and walk every row for the host -- which is the ordinary
-- case every night, when the day's salt rotates and every open tab starts
-- beating with a vid that has no row yet.
CREATE INDEX IF NOT EXISTS idx_px_view_host_vid_ts ON px_view(host, vid, ts);

CREATE TABLE IF NOT EXISTS px_live (
  host TEXT NOT NULL,
  vid  TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  seen INTEGER NOT NULL,
  PRIMARY KEY (host, vid)
);
CREATE INDEX IF NOT EXISTS idx_px_live_seen ON px_live(host, seen);

-- Rollup so the badge never scans px_view: one row per host per UTC day.
CREATE TABLE IF NOT EXISTS px_day (
  host     TEXT NOT NULL,
  day      TEXT NOT NULL,         -- YYYY-MM-DD (Asia/Jakarta)
  views    INTEGER NOT NULL DEFAULT 0,
  visitors INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (host, day)
);
`); } catch (e) { console.error('px: schema init deferred —', e.message); }

/* ── identity ──────────────────────────────────────────────────────────────
 * One random salt per calendar day, kept only for the day it belongs to. It is
 * persisted rather than held in memory because a restart would otherwise mint a
 * fresh salt and count everyone already on the site as new — inflating exactly
 * the number this page is supposed to be trustworthy about. Yesterday's salt is
 * destroyed, which is what makes a visitor unlinkable across days: without it
 * the hash cannot be recomputed, by us or anyone else.                       */
const TZ_OFFSET_MIN = 7 * 60;                      // Asia/Jakarta (WIB, no DST)

/* The salt lives in its OWN file, not in pasar.db, for two reasons that both
 * turned out to matter. DELETE in SQLite only marks a page free — the bytes
 * stay in the file and are trivially recoverable — so "yesterday's salt is
 * destroyed" is only true if the file is rewritten, and VACUUMing the main
 * database on a daily timer is not something to do to a live site. Here the
 * file holds one row, so VACUUM is instant. And because scripts/backup.js
 * copies pasar.db only, no backup can ever pair a salt with the hashes it
 * would reverse. */
const SALT_PATH = path.join(DATA_DIR, 'px-salt.db');
let saltDb = null;
try {
  saltDb = new Database(SALT_PATH);
  saltDb.pragma('journal_mode = TRUNCATE');   // no -wal file holding old bytes
  saltDb.exec(`CREATE TABLE IF NOT EXISTS px_salt (day TEXT PRIMARY KEY, salt BLOB NOT NULL)`);
  try { fs.chmodSync(SALT_PATH, 0o600); } catch { /* best effort */ }
} catch (e) { console.error('px: salt store unavailable —', e.message); }

const SALT = {
  get: saltDb && saltDb.prepare(`SELECT salt FROM px_salt WHERE day=?`),
  put: saltDb && saltDb.prepare(`INSERT OR IGNORE INTO px_salt (day, salt) VALUES (?,?)`),
  del: saltDb && saltDb.prepare(`DELETE FROM px_salt WHERE day <> ?`),
};

/* Erase, then rewrite the file so the freed page really is gone. */
function sweepSalts(day) {
  if (!saltDb) return;
  try {
    const n = SALT.del.run(day).changes;
    if (n > 0) saltDb.exec('VACUUM');
  } catch { /* a failed sweep must not fail a page */ }
}

function dayKey(ts = Date.now()) {
  return new Date(ts + TZ_OFFSET_MIN * 60e3).toISOString().slice(0, 10);
}

let cached = { day: '', salt: null };
function saltFor(day) {
  if (cached.day === day) return cached.salt;
  let salt;
  if (saltDb) {
    let row = SALT.get.get(day);
    if (!row) { SALT.put.run(day, crypto.randomBytes(32)); row = SALT.get.get(day); }
    salt = row.salt;
    sweepSalts(day);                    // every other day's salt is rewritten away
  } else {
    salt = crypto.randomBytes(32);      // no store: still correct, just not restart-stable
  }
  cached = { day, salt };
  return cached.salt;
}

/* An address gets a generous but finite number of distinct visitor identities
 * per day. The user agent is caller-controlled, so without this one IP can mint
 * a new "visitor" per request and inflate both the visitor count and "online"
 * without limit. The ceiling is set far above any real shared connection —
 * Indonesian mobile-carrier NAT is the common case here and must not be
 * clipped — and past it the address keeps being counted, it just stops being
 * counted as somebody new. */
const VID_CAP = 200;
let minted = { day: '', by: new Map() };
function mintAllowed(day, ipKey) {
  if (minted.day !== day) minted = { day, by: new Map() };
  const n = minted.by.get(ipKey) || 0;
  if (n >= VID_CAP) return false;
  minted.by.set(ipKey, n + 1);
  if (minted.by.size > 200000) minted.by.clear();   // safety valve
  return true;
}

function visitorId(host, ip, ua, ts = Date.now()) {
  const day = dayKey(ts);
  return crypto.createHmac('sha256', saltFor(day))
    .update(`${day}|${host}|${ip}|${ua}`).digest('hex').slice(0, 24);
}

/* ── what counts as a human pageview ───────────────────────────────────── */
const BOT_RE = new RegExp([
  'bot', 'crawl', 'spider', 'slurp', 'scrape', 'archiver', 'wget', 'curl',
  'python-requests', 'python-urllib', 'httpx', 'aiohttp', 'axios', 'node-fetch',
  'go-http-client', 'java/', 'okhttp', 'libwww', 'lwp::', 'guzzle', 'postman',
  'insomnia', 'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
  'lighthouse', 'pagespeed', 'gtmetrix', 'pingdom', 'uptime', 'statuscake',
  'monitoring', 'facebookexternalhit', 'embedly', 'quora link preview',
  'skypeuripreview', 'whatsapp', 'telegrambot', 'slackbot', 'discordbot',
  'linkedinbot', 'twitterbot', 'redditbot', 'vercel', 'feedfetcher', 'preview',
  /* The retrieval agents conf.d/bot-guard-map.conf deliberately ALLOWS through.
   * They are welcome to read the site, but they are not readers, and the page
   * claims monitors and crawlers are excluded — so they must be. None of these
   * contain "bot", which is why the generic patterns above miss them. */
  'chatgpt-user', 'oai-searchbot', 'claude-user', 'claude-searchbot',
  'perplexity-user', 'mistralai-user', 'duckassistbot', 'googleother',
].join('|'), 'i');

// This VM's own deploy-verification curls must never inflate a public number.
const SELF_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', '43.157.195.23']);

/* Only the two real sites get a counter. Without this, a direct origin hit or
 * a junk Host header opens its own bucket, and the public page would be
 * reporting traffic to a hostname nobody actually visits. */
const HOSTS = new Set(['pasar.vantis.sh', '1001.vantis.sh', 'umkm.vantis.sh']);
/* When 1001 moves to its own domain both names will be live at once; folding
 * the aliases onto one bucket keeps the site's history in one place instead of
 * silently starting a second counter the day the DNS flips. 1001umkm.id is
 * pre-aliased the same way for the day Luca points the domain. */
const ALIAS = { '1001startup.id': '1001.vantis.sh', 'www.1001startup.id': '1001.vantis.sh',
  '1001umkm.id': 'umkm.vantis.sh', 'www.1001umkm.id': 'umkm.vantis.sh',
  'www.pasar.vantis.sh': 'pasar.vantis.sh' };
const canonHost = (host) => ALIAS[host] || host;
const counted = (host) => HOSTS.has(host);

function isBot(ua) { return !ua || ua.length < 12 || BOT_RE.test(ua); }

/* Order matters. An in-app browser can name its own platform after the token
 * that would otherwise mark it a phone -- "… Mobile Safari/537.36
 * TwitterAndroid/12.19" -- so "android not followed by mobile" reads a Galaxy
 * as a tablet. Test the explicit tablets first, then phones, and only then
 * treat a bare Android as a tablet. */
function deviceOf(ua) {
  if (/ipad|playbook|kindle|silk|\btablet\b|nexus (7|9|10)|sm-t\d/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|bb10/i.test(ua)) return 'mobile';
  if (/android/i.test(ua)) return 'tablet';
  return 'desktop';
}

/* ── referrer → channel ────────────────────────────────────────────────── */
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|qwant|startpage|naver|seznam)\./i;
const SOCIAL = /(^|\.)(x|twitter|t|facebook|fb|instagram|linkedin|lnkd|reddit|tiktok|threads|youtube|youtu|pinterest|tumblr|mastodon|bsky|bluesky|telegram|whatsapp|discord|news\.ycombinator|producthunt|medium|substack)\.(com|be|co|in|me|social|app|org|net|id)$/i;
const EMAIL = /(^|\.)(mail\.google|outlook|mail\.yahoo|zoho|superhuman|hey)\./i;

function classify(refHost, query) {
  if (query && (query.utm_source || query.utm_medium || query.utm_campaign || query.ref)) return 'campaign';
  if (!refHost) return 'direct';
  if (SEARCH.test(refHost + '.')) return 'search';
  if (SOCIAL.test(refHost)) return 'social';
  if (EMAIL.test(refHost + '.')) return 'email';
  return 'referral';
}

/* ── statements ────────────────────────────────────────────────────────── */
const Q = {
  insertView: db.prepare(
    `INSERT INTO px_view (host, path, vid, ref, chan, country, device, ts) VALUES (?,?,?,?,?,?,?,?)`),
  seenToday: db.prepare(
    `SELECT 1 FROM px_view WHERE host=? AND vid=? LIMIT 1`),
  lastPath: db.prepare(
    `SELECT path FROM px_view WHERE host=? AND vid=? ORDER BY ts DESC LIMIT 1`),
  beat: db.prepare(
    `INSERT INTO px_live (host, vid, path, seen) VALUES (?,?,?,?)
     ON CONFLICT(host, vid) DO UPDATE SET seen=excluded.seen, path=excluded.path`),
  bumpDay: db.prepare(
    `INSERT INTO px_day (host, day, views, visitors) VALUES (?,?,1,?)
     ON CONFLICT(host, day) DO UPDATE SET views = views + 1, visitors = visitors + ?`),
  totals: db.prepare(
    `SELECT COALESCE(SUM(views),0) AS views, COALESCE(SUM(visitors),0) AS visitors FROM px_day WHERE host=?`),
  online: db.prepare(
    `SELECT COUNT(*) AS n FROM px_live WHERE host=? AND seen > ?`),
  pruneLive: db.prepare(`DELETE FROM px_live WHERE seen < ?`),
  pruneViews: db.prepare(`DELETE FROM px_view WHERE ts < ?`),
  pruneDays: db.prepare(`DELETE FROM px_day WHERE day < ?`),
};

const ONLINE_MS = 5 * 60e3;          // "online" = active in the last 5 minutes
const RETAIN_MS = 400 * 24 * 3600e3; // raw rows kept ~13 months, then dropped

let lastPrune = 0;
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 10 * 60e3) return;
  lastPrune = now;
  try {
    Q.pruneLive.run(now - 60 * 60e3);
    Q.pruneViews.run(now - RETAIN_MS);
    Q.pruneDays.run(dayKey(now - RETAIN_MS));   // else the rollup outlives its rows
    sweepSalts(dayKey(now));                    // a zero-traffic day must still expire its salt
  } catch { /* a prune that fails is not worth failing a request over */ }
}

/* ── recording ─────────────────────────────────────────────────────────── */
const recordTx = db.transaction((host, path, vid, ref, chan, country, device, ts, isNew) => {
  Q.insertView.run(host, path, vid, ref, chan, country, device, ts);
  Q.bumpDay.run(host, dayKey(ts), isNew, isNew);
  Q.beat.run(host, vid, path, ts);
});

/**
 * Count one HTML pageview. Returns false when the request was not counted
 * (bot, self, or a non-page path) so callers can tell silence from success.
 */
function record({ host, path, ip, ua, referer, query, country, prefetch }) {
  host = canonHost(host);
  if (!counted(host) || isBot(ua) || SELF_IPS.has(ip) || prefetch) return false;
  const ts = Date.now();
  const vid = visitorId(host, ip, ua, ts);

  let refHost = '';
  if (referer) {
    try {
      const u = new URL(referer);
      refHost = u.hostname.replace(/^www\./, '');
      if (refHost === host) refHost = '';           // internal navigation is not a referral
    } catch { /* malformed Referer: treat as direct */ }
  }

  let vidFinal = vid;
  let isNew = Q.seenToday.get(host, vid) ? 0 : 1;
  if (isNew && !mintAllowed(dayKey(ts), host + '|' + ip)) {
    /* Over the ceiling: attribute to a single per-address identity so the view
     * is still counted and the visitor count stops climbing. */
    vidFinal = visitorId(host, ip, 'overflow', ts);
    isNew = Q.seenToday.get(host, vidFinal) ? 0 : 1;
  }
  recordTx(host, path.slice(0, 200), vidFinal, refHost.slice(0, 120),
    classify(refHost, query), (country || '').slice(0, 2).toUpperCase(), deviceOf(ua), ts, isNew);
  maybePrune();
  return true;
}

/** Refresh presence for an already-counted visitor (the heartbeat).
 *
 * Two things this deliberately does NOT do. It does not accept a caller who has
 * no page view recorded today: otherwise a stranger with curl could raise
 * "online" to any number they liked on a page whose whole claim is that its
 * numbers are real. And it does not take the caller's word for which page they
 * are on — the path comes from what this server actually served them, so
 * "what they have open" cannot be turned into a text field by a POST body. */
function beat({ host, ip, ua }) {
  host = canonHost(host);
  if (!counted(host) || isBot(ua) || SELF_IPS.has(ip)) return false;
  const vid = visitorId(host, ip, ua);
  const seen = Q.lastPath.get(host, vid);
  if (!seen) return false;                    // no page view today: not a reader
  Q.beat.run(host, vid, seen.path, Date.now());
  return true;
}

/** The two numbers the badge prints. */
function badge(host) {
  host = canonHost(host);
  const t = Q.totals.get(host) || { views: 0, visitors: 0 };
  return {
    online: (Q.online.get(host, Date.now() - ONLINE_MS) || { n: 0 }).n,
    views: t.views,
    visitors: t.visitors,
  };
}

/** Badge numbers plus what the people currently on the site have open. */
function live(host) {
  host = canonHost(host);
  return { ...badge(host), livePages: QS.livePaths.all(host, Date.now() - ONLINE_MS) };
}


/* ── the public stats payload ──────────────────────────────────────────────
 * One query set, one shape, four ranges. Everything here is derived from
 * px_view, so what the page prints and what the badge prints can never drift.
 */
const RANGES = {
  '24h': { ms: 24 * 3600e3, unit: 'hour', buckets: 24 },
  '7d':  { ms: 7 * 24 * 3600e3, unit: 'day', buckets: 7 },
  '30d': { ms: 30 * 24 * 3600e3, unit: 'day', buckets: 30 },
  'all': { ms: null, unit: 'day', buckets: 0 },
};

const QS = {
  firstTs: db.prepare(`SELECT MIN(ts) AS t FROM px_view WHERE host=?`),
  windowTotals: db.prepare(
    `SELECT COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors FROM px_view WHERE host=? AND ts>=?`),
  series: db.prepare(
    `SELECT strftime(?, datetime(ts/1000 + ?, 'unixepoch')) AS b,
            COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
     FROM px_view WHERE host=? AND ts>=? GROUP BY b ORDER BY b`),
  /* Same exclusion as livePaths: naming /dashboard or /admin in a public
   * ranking leaks the same thing as naming it in "what they have open". */
  topPaths: db.prepare(
    `SELECT path AS k, COUNT(*) AS n FROM px_view WHERE host=? AND ts>=?
       AND path NOT LIKE '/dashboard%' AND path NOT LIKE '/admin%'
       AND path NOT LIKE '/login%' AND path NOT LIKE '/me%' AND path NOT LIKE '/leads%'
     GROUP BY k ORDER BY n DESC, k LIMIT 12`),
  topRefs: db.prepare(
    `SELECT CASE WHEN ref='' THEN '(direct)' ELSE ref END AS k, COUNT(*) AS n
     FROM px_view WHERE host=? AND ts>=? GROUP BY k ORDER BY n DESC, k LIMIT 12`),
  channels: db.prepare(
    `SELECT chan AS k, COUNT(*) AS n FROM px_view WHERE host=? AND ts>=? GROUP BY k ORDER BY n DESC`),
  countries: db.prepare(
    `SELECT CASE WHEN country='' THEN '??' ELSE country END AS k, COUNT(*) AS n
     FROM px_view WHERE host=? AND ts>=? GROUP BY k ORDER BY n DESC, k LIMIT 12`),
  devices: db.prepare(
    `SELECT device AS k, COUNT(*) AS n FROM px_view WHERE host=? AND ts>=? GROUP BY k ORDER BY n DESC`),
  /* "What they have open" is public. A merchant sitting on /dashboard or an
   * operator on /admin should not be announced to the whole internet, so the
   * account surfaces are counted but never named. */
  livePaths: db.prepare(
    `SELECT path AS k, COUNT(*) AS n FROM px_live
     WHERE host=? AND seen>?
       AND path NOT LIKE '/dashboard%' AND path NOT LIKE '/admin%'
       AND path NOT LIKE '/login%' AND path NOT LIKE '/me%' AND path NOT LIKE '/leads%'
     GROUP BY k ORDER BY n DESC LIMIT 8`),
};

const TZ_SEC = TZ_OFFSET_MIN * 60;

/* SQLite groups on a local-time string; the buckets a range should HAVE are
 * generated in JS so a quiet hour renders as a zero rather than vanishing. */
function emptyBuckets(unit, from, to) {
  const out = [];
  const step = unit === 'hour' ? 3600e3 : 24 * 3600e3;
  const fmt = (t) => new Date(t + TZ_OFFSET_MIN * 60e3).toISOString()
    .slice(0, unit === 'hour' ? 13 : 10).replace('T', ' ');
  let t = Math.floor((from + TZ_OFFSET_MIN * 60e3) / step) * step - TZ_OFFSET_MIN * 60e3;
  for (; t <= to; t += step) out.push({ b: fmt(t), views: 0, visitors: 0 });
  return out;
}

const statsCache = new Map();
const STATS_TTL = 10e3;   // the chart is history; only the live block needs to be instant

function stats(host, rangeKey) {
  host = canonHost(host);
  /* Normalise BEFORE building the key. Keyed on the caller's raw string,
   * ?range=<anything> is a guaranteed miss, so the cache that exists to stop a
   * full-table recompute per request could be walked straight past. */
  const key = Object.hasOwn(RANGES, rangeKey) ? rangeKey : '24h';
  const ck = host + '|' + key;
  const hit = statsCache.get(ck);
  if (hit && Date.now() - hit.at < STATS_TTL) {
    /* online is the one figure worth recomputing on every hit -- it is cheap
     * (an indexed COUNT over a table the size of "people here now") and it is
     * the number a reader is watching. */
    return { ...hit.v, online: (Q.online.get(host, Date.now() - ONLINE_MS) || { n: 0 }).n };
  }
  const v = computeStats(host, key);
  if (statsCache.size > 64) statsCache.clear();
  statsCache.set(ck, { at: Date.now(), v });
  return v;
}

function computeStats(host, rangeKey) {
  /* Object.hasOwn, not `in`/truthiness: '__proto__' passes both of those and
   * would render Object.prototype as a range, printing "__proto__" as a label
   * on a public page. */
  const key = Object.hasOwn(RANGES, rangeKey) ? rangeKey : '24h';
  const R = RANGES[key];
  const now = Date.now();
  const first = (QS.firstTs.get(host) || {}).t || now;
  /* Snap the window back to a bucket edge. Starting mid-bucket makes the
   * leftmost bar cover only part of its hour, which renders as a dip that never
   * happened; and the KPI must use the same edge, or the cells and the bars
   * would be totals of two different windows. */
  const step = R.unit === 'hour' ? 3600e3 : 24 * 3600e3;
  const raw = R.ms === null ? first : now - R.ms;
  const from = Math.floor((raw + TZ_OFFSET_MIN * 60e3) / step) * step - TZ_OFFSET_MIN * 60e3;
  const sqlFmt = R.unit === 'hour' ? '%Y-%m-%d %H' : '%Y-%m-%d';

  const rows = QS.series.all(sqlFmt, TZ_SEC, host, from);
  const byBucket = new Map(rows.map((r) => [r.b, r]));
  const buckets = emptyBuckets(R.unit, from, now).map((e) => byBucket.get(e.b) || e);

  const w = QS.windowTotals.get(host, from) || { views: 0, visitors: 0 };
  const all = Q.totals.get(host) || { views: 0, visitors: 0 };

  return {
    host,
    range: key,
    unit: R.unit,
    now,
    since: first,
    online: (Q.online.get(host, now - ONLINE_MS) || { n: 0 }).n,
    window: { views: w.views, visitors: w.visitors },
    total: { views: all.views, visitors: all.visitors },
    series: buckets.map((b) => ({ b: b.b, views: b.views, visitors: b.visitors })),
    pages: QS.topPaths.all(host, from),
    referrers: QS.topRefs.all(host, from),
    channels: QS.channels.all(host, from),
    countries: QS.countries.all(host, from),
    devices: QS.devices.all(host, from),
    livePages: QS.livePaths.all(host, now - ONLINE_MS),
  };
}


/* The shape /stats renders, with nothing in it. Used when the database cannot
 * answer: the page still draws, honestly empty, instead of 500-ing. */
function emptyStats(host, rangeKey) {
  const key = Object.hasOwn(RANGES, rangeKey) ? rangeKey : '24h';
  const now = Date.now();
  return {
    host: canonHost(host), range: key, unit: RANGES[key].unit, now, since: now,
    online: 0, window: { views: 0, visitors: 0 }, total: { views: 0, visitors: 0 },
    series: [{ b: dayKey(now), views: 0, visitors: 0 }],
    pages: [], referrers: [], channels: [], countries: [], devices: [], livePages: [],
    degraded: true,
  };
}

module.exports = { record, beat, badge, live, stats, emptyStats, canonHost, counted, HOSTS, dayKey, isBot, ONLINE_MS, RANGES, db, Q };
