/**
 * 1001startup.id — scraper check, slice 1: WATCH ONLY.
 *
 * Luca, 19 Oct 2026, after the plan page (claude.ai/artifact/18NdC4MJfSDR1XzYwQQkpj):
 * "Go with your recommendations on all four calls and start slice 1, watch only."
 * The login wall is drawn in the browser, so a script reading the HTML never
 * meets it (four crawlers copied 784-2,376 data pages each on 18-19 Oct). The
 * plan is a daily budget of distinct data pages per address for anonymous
 * visitors. This slice only RECORDS who would have been stopped; every visitor
 * still gets the full page.
 *
 * Who is counted, in order (first match decides):
 *   our own address               never
 *   signed in (a1001 cookie)      never; marks the address if it was already over
 *   named search / AI machine     verified on its operator's list: never;
 *                                 a name with no list: 500 pages a day;
 *                                 a listed name from the wrong address: anonymous
 *   link preview                  200 pages a day
 *   anyone else                   30 pages a day (10 on a hosting network), and
 *                                 more than 20 new pages inside 5 minutes uses up the day
 * Named research crawlers (SwellScope and the like) are "anyone else" (Luca's call 3).
 *
 * Data pages: company, investor, BUMN, data-centre and sector pages (the set
 * the 30-page budget was measured on), English and /id, status 200, no ?embed / ?panel fragments.
 * The day is the visitor counter's day (Asia/Jakarta, resets 17:00 UTC), and the
 * address is kept only as that day's salted hash (px.visitorId), never raw.
 *
 * Tables (pasar.db, private):
 *   shield_seen   day, k, path, ts   one row per distinct data page per address
 *   shield_watch  day, k, ...        one row per address that would have been stopped:
 *                 rule (day | burst | server | claimed | preview), pages so far,
 *                 short = pages that would have been the short page, signed_later
 * Rows older than 14 days are dropped. scripts/wall-daily.js reads shield_watch.
 *
 * SWITCH: data/shield1001.watch exists = recording (checked every 10 s, no
 * restart); rm = nothing recorded. Same one-line pattern in server.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const WATCH_FILE = process.env.SHIELD_WATCH_1001 || path.join(__dirname, '..', 'data', 'shield1001.watch');
const BUDGET = { anon: 30, server: 10, preview: 200, claimed: 500 };
const BURST_N = 20;
const BURST_MS = 5 * 60e3;
const KEEP_DAYS = 14;
const SELF = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', '43.157.195.23']);
const DATA_RE = /^\/(?:id\/)?(?:company|investor|bumn|data-center|sector)\/[^/]+\/?$/;
const PREVIEW_RE = /whatsapp|telegrambot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|skypeuripreview|redditbot|pinterest|embedly|quora link preview|iframely|vkshare|line\/|kakaotalk|snapchat|mastodon/i;

module.exports = function shield1001(fastify, { db, px, is1001, ipOf, signedIn }) {
  db.exec(`
CREATE TABLE IF NOT EXISTS shield_seen (
  day  TEXT NOT NULL,
  k    TEXT NOT NULL,
  path TEXT NOT NULL,
  ts   INTEGER NOT NULL,
  PRIMARY KEY (day, k, path)
);
CREATE INDEX IF NOT EXISTS idx_shield_seen_ts ON shield_seen(day, k, ts);
CREATE TABLE IF NOT EXISTS shield_watch (
  day          TEXT NOT NULL,
  k            TEXT NOT NULL,
  rule         TEXT NOT NULL,
  net          TEXT NOT NULL DEFAULT '',
  ua           TEXT NOT NULL DEFAULT '',
  pages        INTEGER NOT NULL DEFAULT 0,
  short        INTEGER NOT NULL DEFAULT 0,
  first_ts     INTEGER NOT NULL,
  stop_ts      INTEGER NOT NULL,
  last_ts      INTEGER NOT NULL,
  signed_later INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, k)
);
`);
  const Q = {
    see: db.prepare(`INSERT OR IGNORE INTO shield_seen (day, k, path, ts) VALUES (?,?,?,?)`),
    count: db.prepare(`SELECT COUNT(*) AS n, MIN(ts) AS first, SUM(ts >= ?) AS recent FROM shield_seen WHERE day = ? AND k = ?`),
    stop: db.prepare(`INSERT INTO shield_watch (day, k, rule, net, ua, pages, short, first_ts, stop_ts, last_ts)
      VALUES (?,?,?,?,?,?,1,?,?,?)
      ON CONFLICT(day, k) DO UPDATE SET pages = excluded.pages, short = short + 1, last_ts = excluded.last_ts`),
    signed: db.prepare(`UPDATE shield_watch SET signed_later = 1 WHERE day = ? AND k = ? AND signed_later = 0`),
    prune: db.prepare(`DELETE FROM shield_seen WHERE day < ?`),
    pruneWatch: db.prepare(`DELETE FROM shield_watch WHERE day < ?`),
  };

  let at = 0, on = false;
  function watching() {
    if (Date.now() - at > 10e3) { at = Date.now(); on = fs.existsSync(WATCH_FILE); }
    return on;
  }
  let lastPrune = 0;
  function maybePrune(now) {
    if (now - lastPrune < 6 * 3600e3) return;
    lastPrune = now;
    try { const d = px.dayKey(now - KEEP_DAYS * 86400e3); Q.prune.run(d); Q.pruneWatch.run(d); } catch { /* next time */ }
  }

  /* Which budget this request falls under, or null when it is never counted. */
  function classOf(ip, ua) {
    const ag = px.agentCheck(ip, ua);
    if (ag && ag.vstate === 'verified') return null;
    if (ag && ag.vstate === 'claimed') return { kind: 'claimed', budget: BUDGET.claimed, net: '' };
    if (PREVIEW_RE.test(ua)) return { kind: 'preview', budget: BUDGET.preview, net: '' };
    const dc = px.onHostingNetwork(ip);
    return { kind: dc ? 'server' : 'anon', budget: dc ? BUDGET.server : BUDGET.anon, net: dc ? 'dc' : '' };
  }

  /* onResponse: the page has already gone out, so nothing here can slow or
     change it. Callback style (see the async-onSend gotcha in account1001). */
  fastify.addHook('onResponse', (req, reply, done) => {
    try {
      if (req.method !== 'GET' || reply.statusCode !== 200 || !watching() || !is1001(req)) return done();
      const q = req.query || {};
      if (q.embed || q.panel) return done();
      const p = (req.raw && req.raw.lang1001 === 'id' ? '/id' : '') + String(req.url || '/').split('?')[0];
      if (!DATA_RE.test(p)) return done();
      const ip = String(ipOf(req));
      if (SELF.has(ip)) return done();
      const now = Date.now();
      const day = px.dayKey(now);
      const k = px.visitorId('shield1001', ip, '', now);
      if (signedIn(req)) { Q.signed.run(day, k); return done(); }
      const ua = String(req.headers['user-agent'] || '');
      const c = classOf(ip, ua);
      if (!c) return done();
      if (Q.see.run(day, k, p.slice(0, 200), now).changes === 0) return done();
      const r = Q.count.get(now - BURST_MS, day, k);
      const over = r.n > c.budget;
      const burst = (c.kind === 'anon' || c.kind === 'server') && r.recent > BURST_N;
      if (over || burst) {
        const rule = over ? (c.kind === 'anon' ? 'day' : c.kind) : 'burst';
        Q.stop.run(day, k, rule, c.net, ua.slice(0, 160), r.n, r.first || now, now, now);
      }
      maybePrune(now);
    } catch (e) { req.log.warn({ err: e.message }, 'shield1001'); }
    done();
  });

  return { watching, BUDGET };
};
