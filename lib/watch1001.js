/**
 * 1001startup.id — what readers search, and which reader is signed in.
 *
 * Luca, 18 Oct 2026: "make the live data of people browsing in the
 * 1001startup.id, the logged in users, tracking what they search etc and put
 * monitoring in the building". The building (building.vantis.sh, 7F) opens
 * pasar.db read-only and draws it; this file only records.
 *
 * Two tables, both private (nothing here is printed on the site):
 *   watch_search    one row per settled query typed into a search box on a
 *                   1001 page: the words, the box, the page, how many results
 *                   the page showed (when it shows a count), today's px
 *                   visitor id, and the account when the reader is signed in.
 *                   A query still being typed is folded into one row: within
 *                   20 s, a longer or shorter version of the same words from
 *                   the same visitor replaces it.
 *   watch_acct_vid  today's px visitor id -> account id, written on each page
 *                   a signed-in reader loads. With px_live and px_view that
 *                   says who of the people online is signed in, what page each
 *                   has open and what they read today, without a second
 *                   counter or a cookie.
 *
 * A search is only taken from a visitor the counter has already seen load a
 * page today (the same rule as the px heartbeat), from the site's own pages
 * (the global origin check), rate-limited per address. Rows older than 180
 * days are dropped. Same one-line pattern in server.js as the other 1001 parts.
 */
'use strict';

const W_V = 'w1';                       // bump on any change to public/js/watch1001.js
const KEEP_MS = 180 * 86400e3;
const FOLD_MS = 20e3;
const BOX_RE = /^[A-Za-z0-9_-]{1,24}$/;

module.exports = function watch1001(fastify, { db, px, is1001, ipOf, limited, signedIn }) {
  db.exec(`
CREATE TABLE IF NOT EXISTS watch_search (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,
  box TEXT,
  path TEXT,
  q TEXT NOT NULL,
  n INTEGER,
  vid TEXT,
  uid INTEGER,
  lang TEXT
);
CREATE INDEX IF NOT EXISTS idx_watch_search_ts ON watch_search(ts);
CREATE INDEX IF NOT EXISTS idx_watch_search_vid ON watch_search(vid, ts);
CREATE TABLE IF NOT EXISTS watch_acct_vid (
  day TEXT NOT NULL,
  vid TEXT NOT NULL,
  uid INTEGER NOT NULL,
  seen INTEGER NOT NULL,
  PRIMARY KEY (day, vid)
);
CREATE INDEX IF NOT EXISTS idx_watch_acct_vid_uid ON watch_acct_vid(uid, day);
`);
  const Q = {
    seenToday: px.db.prepare(`SELECT 1 FROM px_view WHERE host = ? AND vid = ? AND ts >= ? LIMIT 1`),
    lastOf: db.prepare(`SELECT id, ts, q FROM watch_search WHERE vid = ? ORDER BY ts DESC LIMIT 1`),
    add: db.prepare(`INSERT INTO watch_search (ts, box, path, q, n, vid, uid, lang) VALUES (?,?,?,?,?,?,?,?)`),
    fold: db.prepare(`UPDATE watch_search SET ts = ?, box = ?, path = ?, q = ?, n = ?, uid = COALESCE(?, uid) WHERE id = ?`),
    link: db.prepare(`INSERT INTO watch_acct_vid (day, vid, uid, seen) VALUES (?,?,?,?)
      ON CONFLICT(day, vid) DO UPDATE SET uid = excluded.uid, seen = excluded.seen`),
    prune: db.prepare(`DELETE FROM watch_search WHERE ts < ?`),
    pruneLinks: db.prepare(`DELETE FROM watch_acct_vid WHERE day < ?`),
  };

  const HOST = '1001.vantis.sh';
  const hostOf = (req) => String(req.headers.host || '').split(':')[0].toLowerCase();
  const vidOf = (req) => px.visitorId(HOST, ipOf(req), String(req.headers['user-agent'] || ''));
  const dayStart = () => Date.parse(px.dayKey() + 'T00:00:00+07:00');

  let lastPrune = 0;
  function maybePrune(now) {
    if (now - lastPrune < 6 * 3600e3) return;
    lastPrune = now;
    try { Q.prune.run(now - KEEP_MS); Q.pruneLinks.run(px.dayKey(now - 14 * 86400e3)); } catch { /* next time */ }
  }

  /* the search box script, on every full 1001 page (all hosts of the site) */
  fastify.addHook('onSend', (req, reply, payload, done) => {
    if (typeof payload !== 'string' || req.method !== 'GET' || reply.statusCode !== 200 || !is1001(req)) return done(null, payload);
    if (!String(reply.getHeader('content-type') || '').includes('text/html')) return done(null, payload);
    const q = req.query || {};
    if (q.embed || q.panel || !payload.includes('</head>')) return done(null, payload);
    /* a signed-in reader's page view: tie today's visitor id to the account */
    try {
      const me = signedIn && signedIn(req);
      if (me && !px.isBot(String(req.headers['user-agent'] || ''))) Q.link.run(px.dayKey(), vidOf(req), me.id, Date.now());
    } catch { /* never costs a page */ }
    return done(null, payload.replace('</head>', () => `<script src="/js/watch1001.js?v=${W_V}" defer></script></head>`));
  });

  fastify.post('/api/watch/search', async (req, reply) => {
    if (!is1001(req)) return reply.code(404).send({ error: 'not_found' });
    if (limited(req, reply, 'wsearch', 60, 60e3)) return;
    reply.header('Cache-Control', 'no-store');
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    const words = String(b.q || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (words.length < 2) return reply.code(204).send();
    const ua = String(req.headers['user-agent'] || '');
    if (px.isBot(ua)) return reply.code(204).send();
    const vid = vidOf(req);
    const now = Date.now();
    try { if (!Q.seenToday.get(HOST, vid, dayStart())) return reply.code(204).send(); } catch { return reply.code(204).send(); }
    const box = BOX_RE.test(String(b.box || '')) ? String(b.box) : null;
    const p = String(b.p || '');
    const path = p[0] === '/' && p[1] !== '/' && p.length <= 200 && !/[\s<>"]/.test(p) ? p : null;
    const n = Number.isInteger(b.n) && b.n >= 0 && b.n < 1e6 ? b.n : null;
    let uid = null;
    try { const me = signedIn && signedIn(req); uid = me ? me.id : null; } catch { /* reader */ }
    const lang = b.l === 'id' ? 'id' : 'en';
    try {
      const last = Q.lastOf.get(vid);
      const lw = last && last.q.toLowerCase(), nw = words.toLowerCase();
      const fresh = last && now - last.ts < FOLD_MS;
      if (fresh && nw.startsWith(lw)) {
        Q.fold.run(now, box, path, words, n, uid, last.id);              // still typing: the longer words win
      } else if (fresh && lw.startsWith(nw)) {
        /* backspacing towards the next query: keep what was there */
      } else if (!(last && lw === nw && now - last.ts < 10 * 60e3)) {
        Q.add.run(now, box, path, words, n, vid, uid, lang);
      }
      maybePrune(now);
    } catch (e) {
      req.log.warn({ why: String(e && e.message || e) }, 'watch1001: search not kept');
    }
    return reply.code(204).send();
  });

  return {};
};
