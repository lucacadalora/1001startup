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

/* ── v2 (4 Oct 2026): people apart from AI, servers and scrapers out ──────────
 * Luca, looking at /stats: "it seems not make sense with this traffic", then
 * "we need to separate the organic growth vs AI economy growth". The server
 * logs showed why: most "views" were machines. A scraper on residential
 * proxies (a new address per page, fixed fake phone browsers, running the
 * page's JavaScript), servers on Alibaba/AWS/Google Cloud posing as browsers
 * (some with a fake google.com referrer), and link-preview storms.
 *
 * So on the hosts in SPLIT a page view now counts as a PERSON only when
 *   - the browser is not on a hosting company's network (net = 'dc' otherwise;
 *     the list is data/px-netlists.json, built by scripts/px-netlists.py), and
 *   - the visitor has tapped, clicked, scrolled with a wheel or typed on the
 *     site that day (eng = 1, sent by /js/px.js with the heartbeat).
 * AI is counted on its own, from the crawlers and assistants that name
 * themselves (px_ai): an assistant opening a page while answering someone
 * ("answer"), an AI search index ("index"), a training crawler ("train"), and
 * classic search engines ("search"). A name is checked against the address
 * list its operator publishes where one exists; a mismatch is an impostor and
 * is not counted. History before the switch (px_meta 'split_start') was rebuilt
 * from the nginx logs by scripts/px-backfill-logs.py: people into px_hist,
 * AI straight into px_ai / px_ai_page. Hosts outside SPLIT behave as before. */
let V2 = true;
for (const sql of [
  `ALTER TABLE px_view ADD COLUMN net TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE px_view ADD COLUMN eng INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE px_live ADD COLUMN eng INTEGER NOT NULL DEFAULT 0`,
]) { try { db.exec(sql); } catch (e) { if (!/duplicate column/i.test(e.message)) V2 = false; } }
try { db.exec(`
CREATE TABLE IF NOT EXISTS px_ai (
  host   TEXT NOT NULL,
  b      TEXT NOT NULL,                 -- hour bucket 'YYYY-MM-DD HH' (Asia/Jakarta)
  agent  TEXT NOT NULL,                 -- 'ChatGPT', 'Google', ...
  kind   TEXT NOT NULL,                 -- answer | index | train | search
  vstate TEXT NOT NULL,                 -- verified | claimed | impostor
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (host, b, agent, kind, vstate)
);
CREATE TABLE IF NOT EXISTS px_ai_page (
  host TEXT NOT NULL, day TEXT NOT NULL, kind TEXT NOT NULL, path TEXT NOT NULL,
  n    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (host, day, kind, path)
);
-- people before the switch, rebuilt from the server logs (no breakdowns kept)
CREATE TABLE IF NOT EXISTS px_hist (
  host TEXT NOT NULL, unit TEXT NOT NULL, b TEXT NOT NULL,   -- unit hour|day, b in Asia/Jakarta
  people   INTEGER NOT NULL DEFAULT 0,  -- page views by people
  visitors INTEGER NOT NULL DEFAULT 0,  -- day: visitors that day; hour: visitors first seen that hour
  clicks   INTEGER NOT NULL DEFAULT 0,  -- of the people's views, arrivals from an AI answer
  filtered INTEGER NOT NULL DEFAULT 0,  -- browser page loads that were not people
  PRIMARY KEY (host, unit, b)
);
CREATE TABLE IF NOT EXISTS px_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_px_view_host_eng_ts ON px_view(host, eng, ts);
`); } catch (e) { V2 = false; console.error('px: v2 schema deferred —', e.message); }

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
const HOSTS = new Set(['pasar.vantis.sh', '1001.vantis.sh', 'umkm.vantis.sh', 'cnc.vantis.sh']);
/* When 1001 moves to its own domain both names will be live at once; folding
 * the aliases onto one bucket keeps the site's history in one place instead of
 * silently starting a second counter the day the DNS flips. 1001umkm.id is
 * pre-aliased the same way for the day Luca points the domain. */
const ALIAS = { '1001startup.id': '1001.vantis.sh', 'www.1001startup.id': '1001.vantis.sh',
  /* the peering map's own host (Luca, 18 Oct 2026): same site, same counter */
  'dc.1001startup.id': '1001.vantis.sh',
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

/* ── v2: networks and named machines ────────────────────────────────────────
 * Hosts whose public numbers are people only (see the v2 note at the top). */
const SPLIT = new Set(['1001.vantis.sh']);

/* data/px-netlists.json, compiled into sorted typed arrays for a binary search;
 * re-read when the weekly rebuild replaces it. Without the file nobody is on a
 * hosting network and every crawler is "claimed" — the counter degrades to the
 * old behaviour rather than failing. */
const NETLISTS = path.join(DATA_DIR, 'px-netlists.json');
let nets = { at: 0, built: '', dc: null, crawlers: {} };
function compileList(L) {
  if (!L || !Array.isArray(L.v4) || !Array.isArray(L.v6)) return null;
  const v4s = new Float64Array(L.v4.length), v4e = new Float64Array(L.v4.length);
  L.v4.forEach(([a, b], i) => { v4s[i] = a; v4e[i] = b; });
  return { v4s, v4e, v6s: L.v6.map(([a]) => BigInt('0x' + a)), v6e: L.v6.map(([, b]) => BigInt('0x' + b)) };
}
function loadNets() {
  try {
    const st = fs.statSync(NETLISTS);
    if (st.mtimeMs === nets.at) return;
    const d = JSON.parse(fs.readFileSync(NETLISTS, 'utf8'));
    const crawlers = {};
    for (const [k, v] of Object.entries(d.crawlers || {})) crawlers[k] = compileList(v);
    nets = { at: st.mtimeMs, built: d.built || '', dc: compileList(d.dc), crawlers };
  } catch { /* missing or mid-write: keep what we had */ }
}
loadNets();
setInterval(loadNets, 10 * 60e3).unref();

function v6big(ip) {
  const s = ip.split('%')[0];
  const dbl = s.split('::');
  if (dbl.length > 2) return null;
  const head = dbl[0] ? dbl[0].split(':') : [];
  const tail = dbl.length === 2 && dbl[1] ? dbl[1].split(':') : [];
  const fill = dbl.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length !== 8 || !groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return null;
  return groups.reduce((n, g) => (n << 16n) + BigInt(parseInt(g, 16)), 0n);
}
function ipKey(ip) {
  const s = String(ip || '').trim();
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i.exec(s);
  if (m) return { v: 4, n: (+m[1]) * 16777216 + (+m[2]) * 65536 + (+m[3]) * 256 + (+m[4]) };
  if (s.includes(':')) { const n = v6big(s); return n === null ? null : { v: 6, n }; }
  return null;
}
function inList(ip, L) {
  if (!L) return false;
  const k = ipKey(ip);
  if (!k) return false;
  const s = k.v === 4 ? L.v4s : L.v6s, e = k.v === 4 ? L.v4e : L.v6e;
  let lo = 0, hi = s.length - 1, i = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (s[mid] <= k.n) { i = mid; lo = mid + 1; } else hi = mid - 1; }
  return i >= 0 && k.n <= e[i];
}
const onHostingNetwork = (ip) => inList(ip, nets.dc);

/* Machines that say who they are, in the order they are tested (a narrower
 * name before the broader one that contains it). kind: answer = an assistant
 * opening the page while answering someone; index = an AI search engine's
 * crawler; train = a crawler collecting training data; search = a classic
 * search engine. list = the operator's published address list, if any. */
const AGENTS = [
  ['ChatGPT', /ChatGPT-User/i, 'answer', 'openai_user'],
  ['Claude', /Claude-User/i, 'answer', null],
  ['Perplexity', /Perplexity-User/i, 'answer', 'perplexity'],
  ['Mistral Le Chat', /MistralAI-User/i, 'answer', null],
  ['Meta AI', /meta-externalfetcher/i, 'answer', null],
  ['Amazon Alexa', /Amzn-User/i, 'answer', null],
  ['ChatGPT search', /OAI-SearchBot/i, 'index', 'openai_search'],
  ['Claude search', /Claude-SearchBot/i, 'index', null],
  ['Perplexity search', /PerplexityBot/i, 'index', 'perplexity'],
  ['DuckAssist', /DuckAssistBot/i, 'index', null],
  ['Amazon search', /Amzn-SearchBot/i, 'index', null],
  ['Azure AI search', /AzureAI-SearchBot/i, 'index', null],
  ['You.com', /YouBot/i, 'index', null],
  ['Keenable', /KeenableBot/i, 'index', null],
  ['Exa', /ExaSearchBot/i, 'index', null],
  ['OpenAI GPTBot', /GPTBot/i, 'train', 'openai_train'],
  ['Anthropic ClaudeBot', /ClaudeBot|anthropic-ai/i, 'train', null],
  ['Common Crawl', /CCBot/i, 'train', 'ccbot'],
  ['ByteDance', /Bytespider/i, 'train', null],
  ['Meta', /meta-externalagent|FacebookBot/i, 'train', null],
  ['Amazonbot', /Amazonbot/i, 'train', null],
  ['Reflection AI', /Reflectionbot/i, 'train', null],
  ['Cohere', /cohere-ai|cohere-training/i, 'train', null],
  ['Diffbot', /Diffbot/i, 'train', null],
  ['Google', /Googlebot|Google-InspectionTool|GoogleOther|Storebot-Google|AdsBot-Google/i, 'search', 'google'],
  ['Bing', /bingbot|BingPreview|msnbot|adidxbot/i, 'search', 'bing'],
  ['Apple', /Applebot/i, 'search', 'apple'],
  ['Yandex', /YandexBot|YandexMobileBot/i, 'search', null],
  ['DuckDuckGo', /DuckDuckBot/i, 'search', null],
  ['Baidu', /Baiduspider/i, 'search', null],
  ['Petal', /PetalBot/i, 'search', null],
  ['Seznam', /SeznamBot/i, 'search', null],
  ['Naver', /Yeti\//i, 'search', null],
].map(([name, re, kind, list]) => ({ name, re, kind, list }));
function agentOf(ua) {
  if (!ua) return null;
  for (const a of AGENTS) if (a.re.test(ua)) return a;
  return null;
}

/* ── referrer → channel ────────────────────────────────────────────────── */
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave|qwant|startpage|naver|seznam)\./i;
const SOCIAL = /(^|\.)(x|twitter|t|facebook|fb|instagram|linkedin|lnkd|reddit|tiktok|threads|youtube|youtu|pinterest|tumblr|mastodon|bsky|bluesky|telegram|whatsapp|discord|news\.ycombinator|producthunt|medium|substack)\.(com|be|co|in|me|social|app|org|net|id)$/i;
const EMAIL = /(^|\.)(mail\.google|outlook|mail\.yahoo|zoho|superhuman|hey)\./i;
/* A person who clicked a source link in an AI answer. ChatGPT tags those links
 * ?utm_source=chatgpt.com, which survives apps that strip the referrer. */
const AI_REF = /(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|meta\.ai|deepseek\.com|grok\.com|you\.com|phind\.com|chat\.mistral\.ai|kagi\.com)$/i;
const AI_SRC = /chatgpt|openai|perplexity|claude|gemini|copilot|deepseek|grok|mistral|phind/i;

function classify(refHost, query) {
  if (query && AI_SRC.test(String(query.utm_source || ''))) return 'ai';
  if (refHost && AI_REF.test(refHost)) return 'ai';
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

/* v2 statements. Prepared in a guard: if the v2 schema could not be created the
 * counter keeps working the old way instead of failing at load. */
let QV = null;
let SPLIT_START = Date.now();
try {
  QV = {
    insertView: db.prepare(
      `INSERT INTO px_view (host, path, vid, ref, chan, country, device, ts, net, eng) VALUES (?,?,?,?,?,?,?,?,?,?)`),
    engagedToday: db.prepare(`SELECT 1 FROM px_view WHERE host=? AND vid=? AND eng=1 LIMIT 1`),
    lastView: db.prepare(`SELECT path, net FROM px_view WHERE host=? AND vid=? ORDER BY ts DESC LIMIT 1`),
    engage: db.prepare(`UPDATE px_view SET eng=1 WHERE host=? AND vid=? AND eng=0 AND net=''`),
    beat: db.prepare(
      `INSERT INTO px_live (host, vid, path, seen, eng) VALUES (?,?,?,?,?)
       ON CONFLICT(host, vid) DO UPDATE SET seen=excluded.seen, path=excluded.path, eng=MAX(px_live.eng, excluded.eng)`),
    ai: db.prepare(
      `INSERT INTO px_ai (host, b, agent, kind, vstate, n) VALUES (?,?,?,?,?,1)
       ON CONFLICT(host, b, agent, kind, vstate) DO UPDATE SET n = n + 1`),
    aiPage: db.prepare(
      `INSERT INTO px_ai_page (host, day, kind, path, n) VALUES (?,?,?,?,1)
       ON CONFLICT(host, day, kind, path) DO UPDATE SET n = n + 1`),
    metaGet: db.prepare(`SELECT v FROM px_meta WHERE k=?`),
    metaPut: db.prepare(`INSERT OR IGNORE INTO px_meta (k, v) VALUES (?,?)`),
  };
  /* The moment people and AI started being counted apart, kept across restarts:
   * live counts start here, the log rebuild ends here. */
  QV.metaPut.run('split_start', String(Date.now()));
  SPLIT_START = Number(QV.metaGet.get('split_start').v) || Date.now();
} catch (e) { V2 = false; QV = null; console.error('px: v2 statements unavailable —', e.message); }

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
const recordTx = db.transaction((host, path, vid, ref, chan, country, device, ts, isNew, net) => {
  if (QV) {
    /* a visitor who already showed they are a person today: this page is theirs too */
    const eng = net === '' && QV.engagedToday.get(host, vid) ? 1 : 0;
    QV.insertView.run(host, path, vid, ref, chan, country, device, ts, net, eng);
  } else Q.insertView.run(host, path, vid, ref, chan, country, device, ts);
  Q.bumpDay.run(host, dayKey(ts), isNew, isNew);
  /* a server posing as a browser never shows up as "online" on a split host */
  if (!(net === 'dc' && SPLIT.has(host))) Q.beat.run(host, vid, path, ts);
});

const hourKey = (ts) => new Date(ts + TZ_OFFSET_MIN * 60e3).toISOString().slice(0, 13).replace('T', ' ');

/* A machine that named itself: tallied per hour, never as a page view. */
function recordAgent(host, a, ip, path, ts) {
  const list = a.list ? nets.crawlers[a.list] : null;
  const vstate = !list ? 'claimed' : inList(ip, list) ? 'verified' : 'impostor';
  QV.ai.run(host, hourKey(ts), a.name, a.kind, vstate);
  if (vstate !== 'impostor' && (a.kind === 'answer' || a.kind === 'index')) QV.aiPage.run(host, dayKey(ts), a.kind, path.slice(0, 200));
}

/**
 * Count one HTML pageview. Returns false when the request was not counted
 * (bot, self, or a non-page path) so callers can tell silence from success.
 */
function record({ host, path, ip, ua, referer, query, country, prefetch }) {
  host = canonHost(host);
  if (!counted(host) || SELF_IPS.has(ip) || prefetch) return false;
  const ts = Date.now();
  const agent = QV ? agentOf(ua) : null;
  if (agent) {
    try { recordAgent(host, agent, ip, path, ts); } catch { /* a tally must never cost a page */ }
    return false;
  }
  if (isBot(ua)) return false;
  const net = QV && onHostingNetwork(ip) ? 'dc' : '';
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
    classify(refHost, query), (country || '').slice(0, 2).toUpperCase(), deviceOf(ua), ts, isNew, net);
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
function beat({ host, ip, ua, engaged = false }) {
  host = canonHost(host);
  if (!counted(host) || isBot(ua) || SELF_IPS.has(ip)) return false;
  const vid = visitorId(host, ip, ua);
  if (!QV) {
    const seen = Q.lastPath.get(host, vid);
    if (!seen) return false;                  // no page view today: not a reader
    Q.beat.run(host, vid, seen.path, Date.now());
    return true;
  }
  const seen = QV.lastView.get(host, vid);
  if (!seen) return false;                    // no page view today: not a reader
  if (seen.net === 'dc' && SPLIT.has(host)) return false;   // a server posing as a browser
  /* The page reports the first tap, click, wheel or key press (trusted events
   * only). From then on every view this visitor made today counts as a person's. */
  if (engaged) QV.engage.run(host, vid);
  QV.beat.run(host, vid, seen.path, Date.now(), engaged ? 1 : 0);
  return true;
}

/** The two numbers the badge prints. On a split host `all` is people + AI, and the badge shows it. */
function badge(host) {
  host = canonHost(host);
  if (QP && SPLIT.has(host)) return splitBadge(host);
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
  if (QP && SPLIT.has(host)) return { ...splitBadge(host), livePages: QP.livePaths.all(host, Date.now() - ONLINE_MS) };
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
       AND path NOT LIKE '/login%' AND path NOT LIKE '/me%' AND path NOT LIKE '/leads%' AND path NOT LIKE '/signin%' AND path NOT LIKE '/id/signin%'
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
       AND path NOT LIKE '/login%' AND path NOT LIKE '/me%' AND path NOT LIKE '/leads%' AND path NOT LIKE '/signin%' AND path NOT LIKE '/id/signin%'
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
    const on = QP && SPLIT.has(host) ? QP.online : Q.online;
    return { ...hit.v, online: (on.get(host, Date.now() - ONLINE_MS) || { n: 0 }).n };
  }
  const v = QP && SPLIT.has(host) ? computeSplit(host, key) : computeStats(host, key);
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
    ai: { window: {}, total: {}, agents: [], pages: [], clicks: 0 }, filtered: { window: 0 },
    degraded: true,
  };
}

/* ── v2: the split numbers (people | AI) ───────────────────────────────────
 * Same ranges and bucket edges as computeStats. People are px_view rows that
 * are engaged and not on a hosting network, from the switch on, plus px_hist
 * (rebuilt from the logs) before it; their breakdowns (pages, referrers,
 * channels, countries, devices) exist only from the switch. AI is px_ai, which
 * the log rebuild also filled for the time before the switch. */
const PEOPLE = `host=? AND eng=1 AND net='' AND ts>=?`;
const HIDE = `AND path NOT LIKE '/dashboard%' AND path NOT LIKE '/admin%'
       AND path NOT LIKE '/login%' AND path NOT LIKE '/me%' AND path NOT LIKE '/leads%' AND path NOT LIKE '/signin%' AND path NOT LIKE '/id/signin%'`;
let QP = null;
if (QV) {
  try {
    QP = {
      online: db.prepare(`SELECT COUNT(*) AS n FROM px_live WHERE host=? AND seen > ? AND eng=1`),
      livePaths: db.prepare(`SELECT path AS k, COUNT(*) AS n FROM px_live WHERE host=? AND seen>? AND eng=1 ${HIDE}
         GROUP BY k ORDER BY n DESC LIMIT 8`),
      win: db.prepare(`SELECT COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors FROM px_view WHERE ${PEOPLE}`),
      series: db.prepare(`SELECT strftime(?, datetime(ts/1000 + ?, 'unixepoch')) AS b, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM px_view WHERE ${PEOPLE} GROUP BY b`),
      pages: db.prepare(`SELECT path AS k, COUNT(*) AS n FROM px_view WHERE ${PEOPLE} ${HIDE} GROUP BY k ORDER BY n DESC, k LIMIT 12`),
      refs: db.prepare(`SELECT CASE WHEN ref='' THEN '(direct)' ELSE ref END AS k, COUNT(*) AS n FROM px_view WHERE ${PEOPLE}
         GROUP BY k ORDER BY n DESC, k LIMIT 12`),
      channels: db.prepare(`SELECT chan AS k, COUNT(*) AS n FROM px_view WHERE ${PEOPLE} GROUP BY k ORDER BY n DESC`),
      countries: db.prepare(`SELECT CASE WHEN country='' THEN '??' ELSE country END AS k, COUNT(*) AS n FROM px_view WHERE ${PEOPLE}
         GROUP BY k ORDER BY n DESC, k LIMIT 12`),
      devices: db.prepare(`SELECT device AS k, COUNT(*) AS n FROM px_view WHERE ${PEOPLE} GROUP BY k ORDER BY n DESC`),
      clicks: db.prepare(`SELECT COUNT(*) AS n FROM px_view WHERE ${PEOPLE} AND chan='ai'`),
      filtered: db.prepare(`SELECT COUNT(*) AS n FROM px_view WHERE host=? AND ts>=? AND NOT (eng=1 AND net='')`),
      hist: db.prepare(`SELECT b, people, visitors, clicks, filtered FROM px_hist WHERE host=? AND unit=? AND b>=? AND b<=?`),
      histTotal: db.prepare(`SELECT COALESCE(SUM(people),0) AS views, COALESCE(SUM(visitors),0) AS visitors FROM px_hist WHERE host=? AND unit='day'`),
      histFirst: db.prepare(`SELECT MIN(b) AS b FROM px_hist WHERE host=? AND unit='day'`),
      aiSeries: db.prepare(`SELECT CASE WHEN ?='hour' THEN b ELSE substr(b,1,10) END AS bb, kind, SUM(n) AS n
         FROM px_ai WHERE host=? AND b>=? AND vstate<>'impostor' GROUP BY bb, kind`),
      aiAgents: db.prepare(`SELECT agent, kind, SUM(n) AS n, SUM(CASE WHEN vstate='verified' THEN n ELSE 0 END) AS verified
         FROM px_ai WHERE host=? AND b>=? AND vstate<>'impostor' GROUP BY agent, kind ORDER BY n DESC, agent`),
      aiImpostors: db.prepare(`SELECT COALESCE(SUM(n),0) AS n FROM px_ai WHERE host=? AND b>=? AND vstate='impostor'`),
      aiTotals: db.prepare(`SELECT kind, SUM(n) AS n FROM px_ai WHERE host=? AND vstate<>'impostor' GROUP BY kind`),
      aiPages: db.prepare(`SELECT path AS k, SUM(n) AS n FROM px_ai_page WHERE host=? AND kind='answer' AND day>=?
         GROUP BY path ORDER BY n DESC, path LIMIT 12`),
    };
  } catch (e) { QP = null; console.error('px: split statements unavailable —', e.message); }
}

const bucketKey = (ts, unit) => new Date(ts + TZ_OFFSET_MIN * 60e3).toISOString().slice(0, unit === 'hour' ? 13 : 10).replace('T', ' ');
const KINDS = ['answer', 'index', 'train', 'search'];

let badgeCache = new Map();
function splitBadge(host) {
  const hit = badgeCache.get(host);
  if (hit && Date.now() - hit.at < 5e3) return hit.v;
  const h = QP.histTotal.get(host) || { views: 0, visitors: 0 };
  const l = QP.win.get(host, SPLIT_START) || { views: 0, visitors: 0 };
  /* Luca, 4 Oct 2026: "we need to separated them and make it seen as total".
   * all = people's page views + every page an AI or search engine read under its
   * own, verified-or-claimed name. Impostors and scrapers stay out of it. */
  let ai = 0;
  for (const r of QP.aiTotals.all(host)) ai += r.n;
  const v = {
    online: (QP.online.get(host, Date.now() - ONLINE_MS) || { n: 0 }).n,
    views: h.views + l.views,
    visitors: h.visitors + l.visitors,
    ai,
    all: h.views + l.views + ai,
  };
  badgeCache.set(host, { at: Date.now(), v });
  return v;
}

function computeSplit(host, key) {
  const R = RANGES[key];
  const now = Date.now();
  const hf = (QP.histFirst.get(host) || {}).b;
  const first = hf ? Date.parse(hf + 'T00:00:00+07:00') : ((QS.firstTs.get(host) || {}).t || now);
  const step = R.unit === 'hour' ? 3600e3 : 24 * 3600e3;
  const raw = R.ms === null ? first : now - R.ms;
  const from = Math.floor((raw + TZ_OFFSET_MIN * 60e3) / step) * step - TZ_OFFSET_MIN * 60e3;
  const sqlFmt = R.unit === 'hour' ? '%Y-%m-%d %H' : '%Y-%m-%d';
  const liveFrom = Math.max(from, SPLIT_START);

  const live = new Map(QP.series.all(sqlFmt, TZ_SEC, host, liveFrom).map((r) => [r.b, r]));
  const hist = new Map(QP.hist.all(host, R.unit, bucketKey(from, R.unit), bucketKey(now, R.unit)).map((r) => [r.b, r]));
  const ai = new Map();
  for (const r of QP.aiSeries.all(R.unit, host, bucketKey(from, 'hour'))) {
    const o = ai.get(r.bb) || {};
    o[r.kind] = (o[r.kind] || 0) + r.n;
    ai.set(r.bb, o);
  }
  const series = emptyBuckets(R.unit, from, now).map((e) => {
    const l = live.get(e.b), h = hist.get(e.b), a = ai.get(e.b) || {};
    return { b: e.b, views: (l ? l.views : 0) + (h ? h.people : 0), visitors: (l ? l.visitors : 0) + (h ? h.visitors : 0),
      answers: a.answer || 0, index: a.index || 0 };
  });

  let hv = 0, hvis = 0, hclicks = 0, hfilt = 0;
  for (const h of hist.values()) { hv += h.people; hvis += h.visitors; hclicks += h.clicks; hfilt += h.filtered; }
  const lw = QP.win.get(host, liveFrom) || { views: 0, visitors: 0 };
  const tot = splitBadge(host);
  const aiWin = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const o of ai.values()) for (const k of KINDS) aiWin[k] += o[k] || 0;
  const aiTot = Object.fromEntries(KINDS.map((k) => [k, 0]));
  for (const r of QP.aiTotals.all(host)) if (Object.hasOwn(aiTot, r.kind)) aiTot[r.kind] = r.n;

  return {
    host, range: key, unit: R.unit, now, since: first,
    online: tot.online,
    window: { views: lw.views + hv, visitors: lw.visitors + hvis },
    total: { views: tot.views, visitors: tot.visitors, all: tot.all },
    series,
    pages: QP.pages.all(host, liveFrom),
    referrers: QP.refs.all(host, liveFrom),
    channels: QP.channels.all(host, liveFrom),
    countries: QP.countries.all(host, liveFrom),
    devices: QP.devices.all(host, liveFrom),
    livePages: QP.livePaths.all(host, now - ONLINE_MS),
    split: { start: SPLIT_START, breakdownFrom: liveFrom, rebuilt: from < SPLIT_START },
    ai: {
      window: aiWin, total: aiTot,
      agents: QP.aiAgents.all(host, bucketKey(from, 'hour')),
      impostors: (QP.aiImpostors.get(host, bucketKey(from, 'hour')) || { n: 0 }).n,
      pages: QP.aiPages.all(host, bucketKey(from, 'day')),
      clicks: (QP.clicks.get(host, liveFrom) || { n: 0 }).n + hclicks,
    },
    filtered: { window: (QP.filtered.get(host, liveFrom) || { n: 0 }).n + hfilt },
  };
}

module.exports = { record, beat, badge, live, stats, emptyStats, canonHost, counted, HOSTS, SPLIT, dayKey, isBot, agentOf, onHostingNetwork, ONLINE_MS, RANGES, db, Q,
  /* lib/watch1001.js ties a signed-in reader's page view to the visitor id the counter gave it */
  visitorId,
  /* lib/shield1001.js: a named machine and whether its address is on its operator's list */
  agentCheck: (ip, ua) => {
    const a = agentOf(ua);
    if (!a) return null;
    const list = a.list ? nets.crawlers[a.list] : null;
    return { a, vstate: !list ? 'claimed' : inList(ip, list) ? 'verified' : 'impostor' };
  } };
