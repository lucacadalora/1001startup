'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/* tiny .env loader (no dependency) */
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch { /* no .env in dev */ }

const PORT = +(process.env.PORT || 8390);
const SITE = process.env.SITE_ORIGIN || 'https://pasar.vantis.sh';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const PROD = process.env.NODE_ENV === 'production';

const { db, maybeClean } = require('./lib/db');
const U = require('./lib/util');
const cityqr = require('./lib/cityqr');
const layout = require('./lib/layout');
const px = require('./lib/px');
const pages = require('./views/pages');
const pagesStats = require('./views/pages-stats');
const builder1001 = require('./views/builder1001');

/* 1001startup.id speaks two languages. English is the default at the bare
   paths; Bahasa Indonesia is the same server-rendered page under /id/<path>
   (separate URLs per language is what search engines index — a client-side
   string swap is invisible to them). The prefix is stripped here, before
   routing, so every existing route serves both; the request carries
   lang1001='id' and handlers pass it into the 1001 views. Only 1001 hostnames
   get the treatment — on PASAR /id/* stays a 404 like any other path. */
const LANG_HOSTS = new Set(['1001.vantis.sh', '1001startup.id', 'www.1001startup.id']);
const fastify = require('fastify')({
  logger: { level: 'warn' }, bodyLimit: 64 * 1024, trustProxy: true,
  rewriteUrl(req) {
    const host = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (LANG_HOSTS.has(host) && /^\/id(\/|\?|$)/.test(req.url)) {
      req.lang1001 = 'id';
      const rest = req.url.slice(3);
      return rest.startsWith('/') ? rest : '/' + rest;
    }
    return req.url;
  },
});
fastify.register(require('@fastify/cookie'));
/* Nothing in front of us compresses the origin hop, so the JSON the map lives
   on (jakarta.json 308KB, census.json 384KB, a zone extract up to 700KB) went
   out raw on every cache fill. */
fastify.register(require('@fastify/compress'), { global: true, encodings: ['br', 'gzip'], threshold: 1024 });
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, 'public'),
  index: false,
  setHeaders(reply, p) {
    /* Everything static shipped with max-age=0, so a phone re-fetched the whole
       map on every navigation. The split is by what actually changes:
       — /js, /css carry ?v= in the URL, so a bump IS the cache bust
       — /assets are content-named art, never edited in place
       — /data OSM extracts are frozen ground truth
       — tenants + census are hand-edited and must go live at once, so they
         revalidate every time and ride the ETag: instant edits, no re-download */
    if (/[\\/](?:js|css)[\\/]/.test(p)) reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    else if (/[\\/]assets[\\/]/.test(p)) reply.header('Cache-Control', 'public, max-age=2592000');
    else if (/[\\/]data[\\/]/.test(p)) {
      /* zones.json is the zone INDEX — it grows every time a district is added,
         so it revalidates like the other hand-edited files. The zone-<id>.json
         extracts behind it are frozen OSM and cache hard. */
      reply.header('Cache-Control', /(?:jakarta-tenants|census|zones)[^\\/]*\.json$/.test(p)
        ? 'no-cache'
        : 'public, max-age=86400, stale-while-revalidate=604800');
    }
  },
});

/* ── prepared statements ───────────────────────────────────────────── */
const S = {
  merchantByHandle: db.prepare(`SELECT * FROM merchants WHERE handle = ?`),
  merchantById: db.prepare(`SELECT * FROM merchants WHERE id = ?`),
  activeMerchants: db.prepare(`SELECT handle, name, category, accent, featured, bio FROM merchants WHERE status='active' ORDER BY created_at, id`),
  insertMerchant: db.prepare(`INSERT INTO merchants (handle, name, category, bio, accent, password_hash) VALUES (?,?,?,?,?,?)`),
  updateMerchant: db.prepare(`UPDATE merchants SET name=?, category=?, bio=?, accent=?, location=?, tags=?, updated_at=datetime('now') WHERE id=?`),
  updatePassword: db.prepare(`UPDATE merchants SET password_hash=?, updated_at=datetime('now') WHERE id=?`),
  deleteMerchant: db.prepare(`DELETE FROM merchants WHERE id=?`),
  bumpViews: db.prepare(`UPDATE merchants SET views = views + 1 WHERE id=?`),
  bumpScans: db.prepare(`UPDATE merchants SET scans = scans + 1 WHERE id=?`),
  linksFor: db.prepare(`SELECT id, label, url, pos, clicks FROM links WHERE merchant_id=? ORDER BY pos, id`),
  linkById: db.prepare(`SELECT * FROM links WHERE id=?`),
  linkCount: db.prepare(`SELECT COUNT(*) AS n FROM links WHERE merchant_id=?`),
  maxLinkPos: db.prepare(`SELECT COALESCE(MAX(pos),-1)+1 AS next FROM links WHERE merchant_id=?`),
  linkIdsFor: db.prepare(`SELECT id FROM links WHERE merchant_id=?`),
  insertLink: db.prepare(`INSERT INTO links (merchant_id, label, url, pos) VALUES (?,?,?,?)`),
  updateLink: db.prepare(`UPDATE links SET label=?, url=? WHERE id=? AND merchant_id=?`),
  deleteLink: db.prepare(`DELETE FROM links WHERE id=? AND merchant_id=?`),
  setLinkPos: db.prepare(`UPDATE links SET pos=? WHERE id=? AND merchant_id=?`),
  bumpClicks: db.prepare(`UPDATE links SET clicks = clicks + 1 WHERE id=?`),
  clicksTotal: db.prepare(`SELECT COALESCE(SUM(clicks),0) AS n FROM links WHERE merchant_id=?`),
  newSession: db.prepare(`INSERT INTO sessions (token, merchant_id, is_admin, expires_at) VALUES (?,?,?,datetime('now', ?))`),
  sessionByToken: db.prepare(`SELECT * FROM sessions WHERE token=? AND expires_at > datetime('now')`),
  deleteSession: db.prepare(`DELETE FROM sessions WHERE token=?`),
  deleteSessionsFor: db.prepare(`DELETE FROM sessions WHERE merchant_id=?`),
  stats: db.prepare(`SELECT COUNT(*) AS merchants, COALESCE(SUM(scans),0) AS scans, COALESCE(SUM(views),0) AS views FROM merchants WHERE status='active'`),
  countsByCategory: db.prepare(`SELECT category, COUNT(*) AS n FROM merchants WHERE status='active' GROUP BY category`),
  adminList: db.prepare(`SELECT m.id, m.handle, m.name, m.category, m.status, m.featured, m.views, m.scans, m.created_at,
      (SELECT COUNT(*) FROM links l WHERE l.merchant_id=m.id) AS links
    FROM merchants m ORDER BY m.created_at DESC`),
  setStatus: db.prepare(`UPDATE merchants SET status=?, updated_at=datetime('now') WHERE id=?`),
  setFeatured: db.prepare(`UPDATE merchants SET featured=?, updated_at=datetime('now') WHERE id=?`),
  audit: db.prepare(`INSERT INTO audit (actor, action, subject) VALUES (?,?,?)`),
};

/* ── helpers ───────────────────────────────────────────────────────── */
const ipOf = (req) => req.headers['cf-connecting-ip'] || req.ip || '0.0.0.0';
/* Counters are per-site: pasar.vantis.sh and 1001.vantis.sh share this process
 * but must never pool their numbers. */
const hostOf = (req) => String(req.headers.host || 'pasar.vantis.sh').split(':')[0].toLowerCase();

function sessionCookieOpts(maxAgeSec) {
  // Host-only on purpose: never set Domain — apex cookies span third-party infra.
  return { path: '/', httpOnly: true, secure: PROD, sameSite: 'lax', maxAge: maxAgeSec };
}
function currentMerchant(req) {
  const tok = req.cookies && req.cookies.psid;
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return null;
  const s = S.sessionByToken.get(tok);
  if (!s || !s.merchant_id) return null;
  const m = S.merchantById.get(s.merchant_id);
  return m || null;
}
function isAdmin(req) {
  const tok = req.cookies && req.cookies.psadm;
  if (!tok || !/^[a-f0-9]{64}$/.test(tok)) return false;
  const s = S.sessionByToken.get(tok);
  return !!(s && s.is_admin);
}
function requireMerchant(req, reply) {
  const m = currentMerchant(req);
  if (!m) { reply.code(401).send({ error: 'not_logged_in' }); return null; }
  return m;
}
function requireAdmin(req, reply) {
  if (!isAdmin(req)) { reply.code(401).send({ error: 'not_admin' }); return false; }
  return true;
}
function limited(req, reply, scope, max, windowMs) {
  if (!U.rateLimit(ipOf(req), scope, max, windowMs)) {
    reply.code(429).send({ error: 'rate_limited', message: 'Too many requests — slow down a little.' });
    return true;
  }
  return false;
}

/* security headers + origin check for mutating requests */
fastify.addHook('onRequest', async (req, reply) => {
  maybeClean();
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers.origin;
    /* Same-origin only. Comparing against the request's OWN host rather than a
     * single hardcoded site is both what lets 1001.vantis.sh post at all, and
     * stricter than before: a page on one host can no longer post to the other. */
    const raw = hostOf(req);
    const h = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    /* Loopback is allowed only when the request itself came in on loopback.
     * Allowing it unconditionally let anything a visitor happened to be running
     * on their own http://localhost:PORT post to the live site. */
    const loop = /^(127\.0\.0\.1|localhost|\[::1\])$/.test(raw) ? '|127\\.0\\.0\\.1|localhost' : '';
    const sameOrigin = new RegExp(`^https?://(${h}${loop})(:\\d+)?$`);
    if (origin && !sameOrigin.test(origin)) {
      return reply.code(403).send({ error: 'bad_origin' });
    }
  }
});
/* Which routes exist in Bahasa Indonesia. A /id URL for anything else 302s to
   the English page instead of rendering English under an /id address — no
   duplicate-content URL is ever minted, and the redirect is the honest state
   ("this page has no Indonesian version yet"). Add a route's pattern here the
   day its view learns lang. */
const ID_READY = new Set(['/', '/closed', '/map', '/company/:id', '/jakarta',
  '/news', '/research', '/research/:slug', '/chain', '/chain/:id', '/chain/x/:slug', '/model', '/coverage',
  '/investors', '/investor/:slug', '/stats', '/about', '/report', '/report/:edition', '/sector', '/sector/:key', '/city/:slug', '/unicorn',
  '/leads', '/leads/login', '/leads/history', '/leads/history/:id', '/ask']);
fastify.addHook('preHandler', (req, reply, done) => {
  if (req.raw && req.raw.lang1001 === 'id') {
    const route = req.routeOptions && req.routeOptions.url;
    /* A /id URL whose only sin is a stray trailing slash gets the lang-aware
       301 here — the gate's English redirect below would lose the language
       for one slash. (The 404 handler does the same for bare-path URLs.) */
    const [p, qs] = String((req.raw && req.raw.url) || '').split('?');
    if (req.method === 'GET' && p.length > 1 && p.endsWith('/')) {
      return reply.header('location', '/id' + p.replace(/\/+$/, '') + (qs ? '?' + qs : '')).code(301).send();
    }
    if (!ID_READY.has(route)) return reply.redirect(req.raw.url || '/');
  }
  done();
});

fastify.addHook('onSend', async (req, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  const ct = String(reply.getHeader('content-type') || '');
  if (ct.includes('text/html')) {
    /* The 1001 landing embeds /map?embed=1 in a same-origin <iframe>. That one
       response may be framed by our own pages; every other page stays
       unframeable, exactly as before. */
    const emb = req.method === 'GET' && req.query && req.query.embed
      && String(req.url || '').split('?')[0].endsWith('/map');
    /* The census chat (support.vantis.sh) was removed on 4 Oct 2026, and with it
       the wider policy the 1001 hosts had for it: every host is strict again. */
    reply.header('Content-Security-Policy',
      `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; ` +
      `font-src 'self'; connect-src 'self'; frame-ancestors ${emb ? "'self'" : "'none'"}; base-uri 'self'; form-action 'self'`);
    reply.header('X-Frame-Options', emb ? 'SAMEORIGIN' : 'DENY');
    /* Count here, not in onRequest: this is the one point where we know the
     * response really is a page and really is a 200 — static assets, redirects
     * and JSON never reach it. The embedded map is NOT counted: a landing
     * scroll is not a /map visit, and /map's number should keep meaning
     * "someone opened the map page". */
    if (req.method === 'GET' && reply.statusCode === 200 && !emb) {
      try {
        px.record({
          /* the rewritten URL has lost its /id prefix; put it back so the
             Indonesian pages count as their own paths in /stats */
          host: hostOf(req),
          path: (req.raw && req.raw.lang1001 === 'id' ? '/id' : '') + (req.url || '/').split('?')[0],
          ip: ipOf(req), ua: String(req.headers['user-agent'] || ''),
          referer: req.headers.referer || req.headers.referrer || '',
          query: req.query, country: req.headers['cf-ipcountry'] || '',
          /* A speculative fetch is the browser guessing, not somebody reading. */
          prefetch: /prefetch|prerender/i.test(String(req.headers['sec-purpose'] || req.headers.purpose || req.headers['x-moz'] || '')),
        });
      } catch { /* a counter must never break a page render */ }
    }
    /* Shells emit a sentinel rather than the badge itself: the numbers are only
     * known here, after the view has already run, and doing the swap in one
     * place means every page on both hosts gets a live badge for free. */
    if (typeof payload === 'string' && payload.includes('<!--PX-BADGE')) {
      try {
        const b = px.badge(hostOf(req));
        /* the badge is injected AFTER the view ran, so it localizes here: an
           /id page's badge must keep the reader on /id/stats */
        const pfx = (req.raw && req.raw.lang1001 === 'id') ? '/id' : '';
        payload = payload
          .replaceAll('<!--PX-BADGE-MAP-->', pagesStats.badge(b, { map: true, pfx }))
          .replaceAll('<!--PX-BADGE-->', pagesStats.badge(b, { pfx }));
      } catch { payload = payload.replace(/<!--PX-BADGE(-MAP)?-->/g, ''); }
    }
    /* "Who is building this": the builder card + edge tab on every full 1001
       page (views/builder1001.js). GET 200, not the map embed; the id check
       keeps a page that renders it itself from getting two. */
    if (req.method === 'GET' && reply.statusCode === 200 && !emb && is1001(req)
      && typeof payload === 'string' && payload.includes('</body>') && !payload.includes('id="b1"')) {
      try {
        const lang = (req.raw && req.raw.lang1001 === 'id') ? 'id' : 'en';
        payload = payload.replace('</body>', () => builder1001.panel(lang) + '</body>');
      } catch { /* leave the page as it was */ }
    }
  }
  return payload;
});

/* ── world cache ───────────────────────────────────────────────────── */
let worldCache = { at: 0, data: null };
function worldPayload() {
  if (Date.now() - worldCache.at < 10e3 && worldCache.data) return worldCache.data;
  const world = layout.buildWorld(S.activeMerchants.all());
  const st = S.stats.get();
  worldCache = { at: Date.now(), data: { ...world, stats: { merchants: st.merchants, scans: st.scans } } };
  return worldCache.data;
}
const invalidateWorld = () => { worldCache.at = 0; };

/* ══ pages ═════════════════════════════════════════════════════════ */
const districtName = (key) => (layout.DISTRICTS.find((d) => d.key === key) || {}).name || 'The Commons';

const pages1001 = require('./views/pages1001');
const news1001 = require('./views/news1001');
const research1001 = require('./views/research1001');
const closed1001 = require('./views/closed1001');
const company1001 = require('./views/company1001');
const model1001 = require('./views/model1001');
const coverage1001 = require('./views/coverage1001');
const investors1001 = require('./views/investors1001');
const map1001 = require('./views/map1001');
const METRO1001 = require('./lib/metros1001'); // kota -> metro; which metros the map draws
const chain1001 = require('./views/chain1001');
/* 1001umkm.id — the export supplier census, sibling product of 1001startup.id
   (Luca, Aug 31 2026). Same host-branch mechanism, own views + data file. */
const pagesumkm = require('./views/pagesumkm');
const companyumkm = require('./views/companyumkm');
const mapumkm = require('./views/mapumkm');
/* CNC + 3D Indonesia (working name) — the China-style "one place, one product"
   map for CNC machining and 3D printing (Luca, 16 Oct 2026, slice 1 go). Same
   host-branch mechanism as umkm, own views + data file (scripts/cnc-build.py). */
const pagescnc = require('./views/pagescnc');
const mapcnc = require('./views/mapcnc');
const researchcnc = require('./views/researchcnc');
/* Shares px's notion of which hostnames ARE 1001, so the shell a visitor gets
 * and the bucket their view lands in can never disagree — startsWith('1001')
 * said no to www.1001startup.id while px.ALIAS said yes, which served the PASAR
 * page under 1001's numbers. */
const is1001 = (req) => px.canonHost(hostOf(req)) === '1001.vantis.sh';
const isUmkm = (req) => px.canonHost(hostOf(req)) === 'umkm.vantis.sh';
const isCnc = (req) => px.canonHost(hostOf(req)) === 'cnc.vantis.sh';
/* Set by rewriteUrl when the request came in under /id/ on a 1001 hostname. */
const langOf = (req) => ((req.raw && req.raw.lang1001) === 'id' ? 'id' : 'en');
const langPfx = (req) => (langOf(req) === 'id' ? '/id' : '');
/* census.json is 384KB and was re-read and re-parsed from disk on every hit to
   /, /census and /model. Cache it against its mtime — an edit is still live on
   the next request, without paying the parse. */
const CENSUS_FILE = path.join(__dirname, 'public', 'data', 'census.json');
let censusCache = { mtime: 0, data: null, map: null };
function censusLoad() {
  let st;
  try { st = fs.statSync(CENSUS_FILE); } catch { return censusCache; }
  if (st.mtimeMs !== censusCache.mtime) {
    try { censusCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(CENSUS_FILE, 'utf8')), map: null }; }
    catch { /* mid-write: keep the last good copy */ }
  }
  return censusCache;
}
const censusData = () => censusLoad().data;
/* umkm.json (~660KB) gets the same mtime-cached treatment: an edit is live on
   the next request without paying the parse per hit. */
const UMKM_FILE = path.join(__dirname, 'public', 'data', 'umkm.json');
let umkmCache = { mtime: 0, data: null };
function umkmData() {
  let st;
  try { st = fs.statSync(UMKM_FILE); } catch { return umkmCache.data; }
  if (st.mtimeMs !== umkmCache.mtime) {
    try { umkmCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(UMKM_FILE, 'utf8')), map: null }; }
    catch { /* mid-write: keep the last good copy */ }
  }
  return umkmCache.data;
}
/* What the export MAP needs: the pins and their card line — id, name, sector,
   tier, city, lat/lon — never the trade terms, contacts or notes the full
   (403-gated) file holds. Derived once per umkm.json mtime. */
function umkmMapFeed() {
  const d = umkmData();
  if (!d) return null;
  if (!umkmCache.map) {
    const bySec = {};
    for (const c of d.companies) {
      bySec[c.sector] = bySec[c.sector] || { mapped: 0 };
      if (c.lat !== null && c.lat !== undefined) bySec[c.sector].mapped++;
    }
    umkmCache.map = JSON.stringify({
      generated: d.generated,
      unmapped: (d.totals || {}).unmapped || 0,
      sector_colors: d.sector_colors || {},
      sprites: d.sprites || {},
      sectors: (d.by_sector || []).map((s) => ({ name: s.name, count: s.count, mapped: (bySec[s.name] || {}).mapped || 0, color: s.color, sprite: s.sprite })),
      companies: d.companies
        .filter((c) => c.lat !== null && c.lat !== undefined)
        .map((c) => ({ id: c.id, name: c.name, sector: c.sector, tier: c.tier_rank, city: c.city, province: c.province, lat: c.lat, lon: c.lon, geo_kind: c.geo_kind })),
    });
  }
  return umkmCache.map;
}
fastify.get('/data/umkm-map.json', async (req, reply) => {
  if (!isUmkm(req)) return reply.code(404).send({ error: 'not_found' });
  const body = umkmMapFeed();
  if (!body) return reply.code(404).send({ error: 'not_found' });
  const tag = `W/"${umkmCache.mtime.toString(36)}-${body.length.toString(36)}"`;
  reply.header('Cache-Control', 'no-cache').header('ETag', tag);
  if (req.headers['if-none-match'] === tag) return reply.code(304).send();
  return reply.type('application/json').send(body);
});
/* cnc.json gets the same mtime-cached load as umkm.json; the map reads a slim
   derived feed (places with their card fields, firms with theirs) and never
   the gated full file. */
const CNC_FILE = path.join(__dirname, 'public', 'data', 'cnc.json');
let cncCache = { mtime: 0, data: null, map: null };
function cncData() {
  let st;
  try { st = fs.statSync(CNC_FILE); } catch { return cncCache.data; }
  if (st.mtimeMs !== cncCache.mtime) {
    try { cncCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(CNC_FILE, 'utf8')), map: null }; }
    catch { /* mid-write: keep the last good copy */ }
  }
  return cncCache.data;
}
/* company webs (research section): one JSON per group in data/cnc-webs/,
   written by scripts/cnc-webs-import.py; re-read when any file changes */
const CNC_WEBS_DIR = path.join(__dirname, 'data', 'cnc-webs');
let cncWebsCache = { sig: '', list: [] };
function cncWebs() {
  let files;
  try { files = fs.readdirSync(CNC_WEBS_DIR).filter((f) => f.endsWith('.json')).sort(); } catch { return cncWebsCache.list; }
  const sig = files.map((f) => { try { return f + ':' + fs.statSync(path.join(CNC_WEBS_DIR, f)).mtimeMs; } catch { return f; } }).join('|');
  if (sig !== cncWebsCache.sig) {
    const list = [];
    for (const f of files) {
      try {
        const w = JSON.parse(fs.readFileSync(path.join(CNC_WEBS_DIR, f), 'utf8'));
        if (w && w.slug && Array.isArray(w.entities) && Array.isArray(w.links)) list.push(w);
      } catch { /* mid-write: skip this round */ }
    }
    list.sort((a, b) => (a.order || 99) - (b.order || 99) || String(a.title).localeCompare(String(b.title)));
    cncWebsCache = { sig, list };
  }
  return cncWebsCache.list;
}
function cncMapFeed() {
  const d = cncData();
  if (!d) return null;
  const webs = cncWebs();
  if (cncCache.map && cncCache.mapSig !== cncWebsCache.sig) cncCache.map = null;
  if (!cncCache.map) {
    cncCache.mapSig = cncWebsCache.sig;
    const TM = (d.method && d.method.tier_meta) || {};
    cncCache.map = JSON.stringify({
      families: d.families || [],
      firms_unmapped: (d.totals && d.totals.firms_unmapped) || 0,
      places: (d.places || []).map((p) => ({
        id: p.id, area: p.area, province: p.province, level: p.level, island: p.island, lat: p.lat, lon: p.lon,
        focus: p.focus, also: p.also, anchor_buyers: p.anchor_buyers, local_inputs: p.local_inputs,
        clusters: p.clusters, official_designation: p.official_designation, umk_2026: p.umk_2026,
        skills: p.skills, confidence: p.confidence, sources: p.sources, firms_n: p.firms_n,
      })),
      firms: (d.firms || []).filter((f) => f.lat !== null && f.lat !== undefined).map((f) => ({
        id: f.id, name: f.name, kind_label: f.kind_label, city: f.city, province: f.province,
        lat: f.lat, lon: f.lon, geo_kind: f.geo_kind, tier_rank: f.tier_rank,
        tier_label: (TM[f.tier] || {}).label || f.tier, capabilities: f.capabilities, makes: f.makes,
        source_url: f.source_url, website: f.website, web: researchcnc.webSlugFor(f.name, webs),
      })),
    });
  }
  return cncCache.map;
}
fastify.get('/data/cnc-map.json', async (req, reply) => {
  if (!isCnc(req)) return reply.code(404).send({ error: 'not_found' });
  const body = cncMapFeed();
  if (!body) return reply.code(404).send({ error: 'not_found' });
  const tag = `W/"${cncCache.mtime.toString(36)}-${body.length.toString(36)}"`;
  reply.header('Cache-Control', 'no-cache').header('ETag', tag);
  if (req.headers['if-none-match'] === tag) return reply.code(304).send();
  return reply.type('application/json').send(body);
});
/* What the MAP needs out of the census: the pins, and what a pin's card shows.
   The full file also carries investor lists, source notes, employee notes and
   the method prose — none of which the map reads, and all of which it was
   downloading on ?census=1. */
const MAP_FIELDS = ['id', 'name', 'sector_key', 'sector_label', 'kota', 'lat', 'lon', 'sprite', 'rank',
  /* which metro a pin belongs to. The map draws ONE city's boundaries at a
     time, so without this every Bandung company would be plotted 120 km off
     the east edge of the Jakarta canvas — and vice versa. Derived in
     build-census.js from kota, never stored per row. */
  'metro',
  /* logo: a company inside a real tower gets its mark ON that tower, the way a
     tenant does — a cartoon building drawn over a 200m skyscraper reads as a toy
     stuck to the roof, which is exactly how it looked */
  'logo',
  'url', 'funding_total_usd_m', 'last_round', 'valuation_usd_m', 'valuation_note', 'employees_est', 'est_gva_idr_bn'];
/* How exactly a pin is actually known, derived once here so the map never has
   to guess: 'address' = OSM matched a building, 'street' = the right road but
   not the building, 'area' = a district centroid, which is where nearly half
   the census sat — every company in a kecamatan on one identical point, drawn
   as a row of towers with no relation to any of their offices. Older pins
   predate geocode_kind, so fall back to reading the query that found them. */
const EXACT_KIND = new Set(['building', 'house', 'office', 'commercial', 'industrial', 'retail', 'address', 'yes']);
function pinKind(c) {
  const k = c.geocode_kind;
  if (k) return EXACT_KIND.has(k) ? 'address' : k === 'road' ? 'street' : 'area';
  const src = String(c.geocode_src || '');
  if (!src) return 'area';
  const head = src.split(':').pop().split(',')[0].trim().toLowerCase();
  if (head === String(c.kecamatan || '').toLowerCase()) return 'area';
  if (/^(jakarta|bandung|cimahi|kota|kabupaten|tangerang|depok|bekasi|bogor)\b/.test(head)) return 'area';
  if (/^(jl\.?|jalan)\b/.test(head)) return 'street';
  return 'address';
}
function censusMap() {
  const c = censusLoad();
  if (!c.data) return null;
  if (!c.map) {
    const pick = (o) => { const r = {}; for (const k of MAP_FIELDS) if (o[k] !== undefined && o[k] !== null) r[k] = o[k]; r.pin_kind = pinKind(o); return r; };
    c.map = JSON.stringify({
      totals: c.data.totals || {},
      /* only the metros the map has boundaries for (lib/metros1001.js MAPPED):
         a nationwide row elsewhere would be drawn on blank paper, counted under
         the Jakarta legend, and would pull the opening view off-centre */
      companies: (c.data.companies || []).filter((x) => x.lat && x.lon && METRO1001.mapped(x.metro || 'jakarta')).map(pick),
    });
  }
  return c.map;
}
fastify.get('/data/census-map.json', async (req, reply) => {
  const body = censusMap();
  if (!body) return reply.code(404).send({ error: 'not_found' });
  const tag = `W/"${censusCache.mtime.toString(36)}-${body.length.toString(36)}"`;
  reply.header('Cache-Control', 'no-cache').header('ETag', tag);
  if (req.headers['if-none-match'] === tag) return reply.code(304).send();
  return reply.type('application/json').send(body);
});
/* TeX equation SVGs for /model — regenerated by scripts/build-model-tex.js */
const modelTex = () => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'model-tex.json'), 'utf8')); } catch { return null; }
};
fastify.get('/', async (req, reply) => {
  if (isUmkm(req)) { reply.type('text/html').send(pagesumkm.landing({ data: umkmData() })); return; }
  if (isCnc(req)) { reply.type('text/html').send(pagescnc.landing({ data: cncData(), webs: cncWebs() })); return; }
  if (is1001(req)) { reply.type('text/html').send(pages1001.landing({ data: censusData(), lang: langOf(req) })); return; }
  const st = S.stats.get();
  const counts = {};
  for (const r of S.countsByCategory.all()) counts[r.category] = r.n;
  reply.type('text/html').send(pages.home({ stats: st, counts, authed: !!currentMerchant(req) }));
});
/* 1001startup.id only: THE WIRE — automated startup journalism over the
   census. public/data/census-news.json is written ONLY by
   scripts/census-news.py (cron); mtime-cached like the census itself, so a
   pipeline publish goes live on the next request with no service restart. */
const NEWS_FILE = path.join(__dirname, 'public', 'data', 'census-news.json');
let newsCache = { mtime: 0, data: null };
/* Per-company OG cards — data/og-cards.json {id: '/assets/og-c-<id>-<hash>.png'},
   written only by scripts/og-company.py (single-writer side file). Missing file
   or missing id -> the site-wide card. */
const OGC_FILE = path.join(__dirname, 'data', 'og-cards.json');
let ogcCache = { mtime: 0, data: {} };
function ogCardsData() {
  let st;
  try { st = fs.statSync(OGC_FILE); } catch { return ogcCache.data; }
  if (st.mtimeMs !== ogcCache.mtime) {
    try { ogcCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(OGC_FILE, 'utf8')) }; }
    catch { /* mid-write: keep the last good copy */ }
  }
  return ogcCache.data;
}
function newsData() {
  let st;
  try { st = fs.statSync(NEWS_FILE); } catch { return newsCache.data; }
  if (st.mtimeMs !== newsCache.mtime) {
    try { newsCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8')) }; }
    catch { /* mid-write: keep the last good copy */ }
  }
  return newsCache.data;
}
/* The relationship graph behind /chain and the company card's supply-chain
   block. Same mtime-cached shape as the census and the news file; written by
   scripts/build-links.js, and only ever containing edges that
   scripts/links-verify.py re-proved against their own sources. */
const LINKS_FILE = path.join(__dirname, 'public', 'data', 'census-links.json');
let linksCache = { mtime: 0, data: null };
function linksData() {
  let st;
  try { st = fs.statSync(LINKS_FILE); } catch { return linksCache.data; }
  if (st.mtimeMs !== linksCache.mtime) {
    try { linksCache = { mtime: st.mtimeMs, data: JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')) }; }
    catch { /* mid-write: keep the last good copy */ }
  }
  return linksCache.data;
}
fastify.get('/research', async (req, reply) => {
  if (isCnc(req)) return reply.type('text/html').send(researchcnc.index({ webs: cncWebs() }));
  if (!is1001(req)) return reply.redirect('/');
  reply.type('text/html').send(research1001.index({ lang: langOf(req) }));
});
fastify.get('/research/', async (req, reply) => {
  if (isCnc(req)) return reply.code(301).header('location', '/research').send();
  if (!is1001(req)) return reply.redirect('/');
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return reply.code(301).header('location', langPfx(req) + '/research' + query).send();
});
fastify.get('/research/:slug', async (req, reply) => {
  if (isCnc(req)) {
    const webs = cncWebs();
    const w = webs.find((x) => x.slug === req.params.slug);
    if (!w) return reply.code(404).type('text/html').send(pagescnc.notFound());
    return reply.type('text/html').send(researchcnc.web({ web: w, webs }));
  }
  if (!is1001(req)) return reply.redirect('/');
  if (req.params.slug !== research1001.SLUG) return reply.code(404).type('text/html').send(research1001.notFound({ lang: langOf(req) }));
  reply.type('text/html').send(research1001.article({ lang: langOf(req) }));
});

fastify.get('/news', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  reply.type('text/html').send(news1001.news({ data: censusData(), news: newsData(), lang: langOf(req) }));
});
/* 1001startup.id only: the shutdown register — the other half of the ledger */
function closedRegister() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'closed.json'), 'utf8')); } catch { return { entries: [] }; }
}
const liveIds = (data) => new Set(((data && data.companies) || []).map((c) => c.id));
fastify.get('/closed', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  reply.type('text/html').send(closed1001.closed({ data: censusData(), register: closedRegister(), lang: langOf(req) }));
});
/* 1001startup.id only: one company in full — the same server-rendered card is
   both this page and the body of the landing page's drawer (?panel=1), so the
   two can never drift apart. */
fastify.get('/company/:id', async (req, reply) => {
  /* umkm host: same route, same drawer contract (?panel=1), its own census */
  if (isUmkm(req)) {
    const data = umkmData();
    const id = String((req.params && req.params.id) || '');
    const c = ((data && data.companies) || []).find((x) => x.id === id);
    if (!c) return reply.code(404).type('text/html').send(companyumkm.notFound({ data }));
    if (req.query && req.query.panel) return reply.type('text/html').send(companyumkm.card({ c, data }));
    return reply.type('text/html').send(companyumkm.page({ c, data }));
  }
  if (!is1001(req)) return reply.redirect('/');
  const data = censusData();
  const id = String((req.params && req.params.id) || '');
  const c = ((data && data.companies) || []).find((x) => x.id === id);
  if (!c) {
    /* a company that stopped gets its own page instead of a 404 (closed register) */
    const reg = closedRegister();
    const e = closed1001.findClosed(reg, id, liveIds(data));
    if (e && !(req.query && req.query.panel)) {
      return reply.type('text/html').send(closed1001.profile({ entry: e, register: reg, lang: langOf(req) }));
    }
    return reply.code(404).type('text/html').send(company1001.notFound({ data, lang: langOf(req) }));
  }
  if (req.query && req.query.panel) {
    return reply.type('text/html').send(company1001.card({ c, data, links: linksData(), lang: langOf(req) }));
  }
  reply.type('text/html').send(company1001.page({ c, data, links: linksData(), lang: langOf(req), og: ogCardsData()[c.id] }));
});
/* 1001startup.id only: the supply chain — who supplies whom, and the document
   that says so. /chain is the hub; /chain/<id> is one company's full chain with
   every source quoted. A company with no evidenced relationship gets a page that
   says so rather than a 404, because "nothing published" is itself the finding. */
fastify.get('/chain', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const links = linksData();
  if (!links) return reply.redirect('/');
  reply.type('text/html').send(chain1001.index({ data: censusData(), links, lang: langOf(req) }));
});
/* an EXTERNAL node's chain — a company outside the census (FAS) whose page
   exists because census companies' chains run through it */
fastify.get('/chain/x/:slug', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const links = linksData();
  const slug = String((req.params && req.params.slug) || '');
  if (!links || !links.byExternal || !links.byExternal[slug]) {
    return reply.code(404).type('text/html').send(chain1001.notFound({ links: links || {}, lang: langOf(req) }));
  }
  reply.type('text/html').send(chain1001.extPage({ slug, links, lang: langOf(req) }));
});
fastify.get('/chain/:id', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const links = linksData();
  if (!links) return reply.redirect('/');
  const data = censusData();
  const id = String((req.params && req.params.id) || '');
  const c = ((data && data.companies) || []).find((x) => x.id === id);
  if (!c || !links.byCompany[id]) return reply.code(404).type('text/html').send(chain1001.notFound({ links, lang: langOf(req) }));
  reply.type('text/html').send(chain1001.page({ c, data, links, lang: langOf(req) }));
});
/* 1001startup.id only: the formal statement of the census GVA estimator */
fastify.get('/model', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  reply.type('text/html').send(model1001.model({ data: censusData(), tex: modelTex(), lang: langOf(req) }));
});
/* 1001startup.id only: coverage — the registers moved off the landing page
   (Luca, Aug 30: reference tables are not front-page material). The sections
   keep their old anchor ids (#valuation #sectors #yc #endeavor #scope) so
   every link that pointed into the landing still resolves here. */
fastify.get('/coverage', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  reply.type('text/html').send(coverage1001.coverage({ data: censusData(), lang: langOf(req) }));
});
/* 1001startup.id only: the investor layer (Luca, Aug 30: "venture capitalist
   details and their investment... like crunchbase"). /investors ranks every
   investor named on a census row; /investor/<slug> is one fund's portfolio,
   details and — where a per-fund pass has run — its published not-counted
   register (data/investors.json, seeded by the Init-6 pass). */
fastify.get('/investors', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  reply.type('text/html').send(investors1001.index({ data: censusData(), lang: langOf(req) }));
});
fastify.get('/investor/:slug', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const html = investors1001.investor({ data: censusData(), slug: String((req.params && req.params.slug) || ''), lang: langOf(req) });
  if (!html) return reply.code(404).type('text/html').send(investors1001.notFound({ data: censusData(), lang: langOf(req) }));
  reply.type('text/html').send(html);
});
/* 1001startup.id only: robots + sitemap. The census went indexable on Aug 31
   2026 (Luca: the Indonesian side is "the SEO booster") — noindex lifted in
   the 1001 views, and this sitemap hands crawlers every page in BOTH languages
   with its hreflang pair, so /id/ is discovered without crawling the toggle.
   PASAR keeps its old behavior (meta noindex, no robots file). */
const I18N1001 = require('./views/i18n1001');
/* 1001startup.id only: the browse pages — one landing per sector and per
   metro ("startup fintech Indonesia", "startup di Bandung" now have a page a
   crawler can land on instead of a client-side filter state). */
const browse1001 = require('./views/browse1001');
/* /report/<YYYY-MM> — one frozen edition of the census report
   (views/report1001.js, figures from data/report-<edition>.json). /report
   always points at the newest edition. */
const report1001 = require('./views/report1001');
fastify.get('/report', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const eds = report1001.editions();
  if (!eds.length) return reply.code(404).type('text/html').send(company1001.notFound({ data: censusData(), lang: langOf(req) }));
  return reply.code(302).header('location', langPfx(req) + '/report/' + eds[eds.length - 1]).send();
});
fastify.get('/report/:edition', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const html = report1001.report({ edition: String((req.params && req.params.edition) || ''), lang: langOf(req) });
  if (!html) return reply.code(404).type('text/html').send(company1001.notFound({ data: censusData(), lang: langOf(req) }));
  reply.type('text/html').send(html);
});
/* /bumn — Indonesia's state companies on six yardsticks, as a logo quadrant
   (views/bumn1001.js, data/bumn.json). English only for now: /id/bumn is not in
   ID_READY, so it 302s here. */
const bumn1001 = require('./views/bumn1001');
fastify.get('/bumn', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const html = bumn1001.page({ lang: 'en' });
  if (!html) return reply.code(503).type('text/plain').send('The BUMN data is being rebuilt. Try again in a minute.');
  reply.type('text/html').send(html);
});
/* /about — who builds the census (views/about1001.js). /tentang is the
   Indonesian word people type; it 301s to the /id page of the same route. */
const about1001 = require('./views/about1001');
fastify.get('/about', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  reply.type('text/html').send(about1001.about({ data: censusData(), lang: langOf(req) }));
});
fastify.get('/tentang', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  return reply.code(301).header('location', '/id/about').send();
});
/* the sector hub — the nav's "Sectors" link and every sector page's "All
   sectors" button land here (was /coverage#sectors, and /id/sector 302'd to
   an English 404). */
fastify.get('/sector', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const html = browse1001.sectorHub({ data: censusData(), lang: langOf(req) });
  if (!html) return reply.code(404).type('text/html').send(company1001.notFound({ data: censusData(), lang: langOf(req) }));
  reply.type('text/html').send(html);
});
fastify.get('/sector/:key', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const html = browse1001.sector({ data: censusData(), key: String((req.params && req.params.key) || ''), lang: langOf(req) });
  if (!html) return reply.code(404).type('text/html').send(company1001.notFound({ data: censusData(), lang: langOf(req) }));
  reply.type('text/html').send(html);
});
fastify.get('/unicorn', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const html = browse1001.unicorn({ data: censusData(), lang: langOf(req) });
  if (!html) return reply.code(404).type('text/html').send(company1001.notFound({ data: censusData(), lang: langOf(req) }));
  reply.type('text/html').send(html);
});
fastify.get('/city/:slug', async (req, reply) => {
  if (!is1001(req)) return reply.redirect('/');
  const html = browse1001.city({ data: censusData(), slug: String((req.params && req.params.slug) || ''), lang: langOf(req) });
  if (!html) return reply.code(404).type('text/html').send(company1001.notFound({ data: censusData(), lang: langOf(req) }));
  reply.type('text/html').send(html);
});
let smCache = { key: '', xml: '' };
function sitemap1001() {
  const data = censusData() || {};
  const links = linksData() || {};
  const nw = newsData() || {};
  const key = [data.generated || '', nw.generated || '', Object.keys(links.byCompany || {}).length, closedRegister().generated || ''].join('|');
  if (smCache.key === key) return smCache.xml;
  const paths = ['/', '/news', '/research', research1001.ARTICLE_PATH, '/map', '/closed', '/coverage', '/model', '/investors', '/chain', '/stats', '/unicorn', '/about'];
  for (const c of data.companies || []) paths.push('/company/' + c.id);
  /* closed companies have their own pages too */
  for (const s of closed1001.closedSlugs(closedRegister(), liveIds(data))) paths.push('/company/' + s);
  /* only investor pages that pass the quality gate (2+ census companies or a
     fund record); the rest are noindex and stay out of the sitemap */
  for (const s of investors1001.indexableSlugs(data)) paths.push('/investor/' + s);
  for (const ed of report1001.editions()) paths.push('/report/' + ed);
  paths.push('/sector');
  for (const k of browse1001.sectorKeys(data)) paths.push('/sector/' + k);
  /* every city with 5+ companies (nationwide since 28 Sep 2026; smaller
     cities are noindex — see browse1001 CITY_MIN) */
  for (const s of browse1001.indexableCityIds(data)) paths.push('/city/' + s);
  for (const id of Object.keys(links.byCompany || {})) paths.push('/chain/' + id);
  for (const s of Object.keys(links.byExternal || {})) paths.push('/chain/x/' + s);
  const mod = String(data.generated || '').slice(0, 10);
  const url = (loc, pair, modified = mod) => `<url><loc>${loc}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ''}
<xhtml:link rel="alternate" hreflang="en" href="${pair.en}"/>
<xhtml:link rel="alternate" hreflang="id" href="${pair.id}"/>
<xhtml:link rel="alternate" hreflang="x-default" href="${pair.en}"/></url>`;
  const out = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'];
  for (const p of paths) {
    const en = I18N1001.ORIGIN + p;
    const id = I18N1001.ORIGIN + '/id' + (p === '/' ? '/' : p);
    const modified = p === '/research' || p === research1001.ARTICLE_PATH ? research1001.DATE : mod;
    out.push(url(en, { en, id }, modified), url(id, { en, id }, modified));
  }
  out.push('</urlset>');
  smCache = { key, xml: out.join('\n') };
  return smCache.xml;
}
fastify.get('/sitemap.xml', async (req, reply) => {
  if (!is1001(req)) return reply.code(404).send('');
  reply.type('application/xml').send(sitemap1001());
});
fastify.get('/robots.txt', async (req, reply) => {
  if (!is1001(req)) return reply.code(404).send('');
  reply.type('text/plain').send('User-agent: *\nAllow: /\n\nSitemap: ' + I18N1001.ORIGIN + '/sitemap.xml\n');
});
/* /favicon.ico — the first place Google and Bing look, and its absence is why
   the SERP showed a generic globe (Luca, Aug 31 2026, from a Bing screenshot).
   It cannot be a plain file in public/: that directory is shared with PASAR,
   which is a different brand. Served per host instead; anything that is not a
   known brand gets a 404 rather than someone else's mark. */
const ICO_1001 = path.join(__dirname, 'public', 'assets', 'favicon-1001.ico');
fastify.get('/favicon.ico', async (req, reply) => {
  if (!is1001(req)) return reply.code(404).send('');
  let buf;
  try { buf = fs.readFileSync(ICO_1001); } catch { return reply.code(404).send(''); }
  reply.type('image/x-icon')
    .header('Cache-Control', 'public, max-age=86400')  // a brand mark changes rarely, but not never
    .send(buf);
});
/* llms.txt (llmstxt.org): the site described for answer engines — what the
   census is, how to read its marks, and where the key pages are. Retrieval
   agents are welcome here by fleet policy; this tells them how to cite
   accurately. Counts are live so the file never goes stale. */
fastify.get('/llms.txt', async (req, reply) => {
  if (!is1001(req)) return reply.code(404).send('');
  const d = censusData() || {};
  const n = ((d.companies || []).length) || '';
  const O = I18N1001.ORIGIN;
  const asOf = Date.parse(d.generated) ? new Date(Date.parse(d.generated)).toLocaleDateString('en-GB',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : 'see the page';
  reply.type('text/plain; charset=utf-8').send(`# 1001startup.id — the census of Indonesian startups

> Sensus startup Indonesia: ${n} companies with sourced figures for disclosed funding, valuation, headcount (each count carries the date it was read), head office, investors, and estimated economic output. Bilingual — English at bare paths, Bahasa Indonesia at /id/. Public sources only; every figure links to the document that carries it.

How to attribute: name the source and link the page. For example: "According to the 1001startup.id census (updated ${asOf}), Gojek (GoTo Group) has …" — ${O}/company/gojek. Every company page carries this sentence and a "Cite as" line; the figures change when the census is rebuilt, so cite the date.

How to read the figures when citing:
- A figure marked \`est\` is our labeled estimate, never a disclosed number.
- A dash means no credible public figure exists — we do not invent numbers.
- Headcounts state the day they were read; treat them as of that date.
- Group companies (Grab, Shopee, J&T…) are counted at their Indonesian size only.
- Cite the company page URL, e.g. ${O}/company/gojek

## Key pages
- [The census table](${O}/): every company, ranked, with funding, valuation, jobs and output
- [Sensus dalam Bahasa Indonesia](${O}/id/)
- [Company profiles](${O}/company/gojek): one page per company at /company/<id>, also at /id/company/<id>
- [Closed startups](${O}/closed): Indonesian startups that shut down, with dates, causes and sources
- [Investors](${O}/investors): every fund with the census rows it backs
- [Coverage](${O}/coverage): what is counted, what is deliberately not, and why
- [Method](${O}/model): the output estimator, equations to error bounds
- [News wire](${O}/news): dated, attributed briefs over the census
- [Sitemap](${O}/sitemap.xml)
`);
});
fastify.get('/world', async (req, reply) => {
  reply.type('text/html').send(pages.world({ authed: !!currentMerchant(req) }));
});
fastify.get('/blocks', async (req, reply) => {
  reply.type('text/html').send(pages.blocks({ authed: !!currentMerchant(req) }));
});
/* The census map is 1001startup.id's page (Luca, Aug 30: the census layer
   belongs inside 1001, not PASAR). Since Oct 2026 /map on the 1001 host is the
   LOGO MAP (views/map1001.js map(), public/js/logomap1001.js): a pale basemap
   of the whole country with every located company as a round logo badge. It
   replaced the isometric map, which 1001 no longer serves (Luca, 12 Oct:
   "instead using 3d, better just logo like that"). PASAR's /jakarta stays the
   tenant city; a census-flavored visit to it (?census=1 from old links, or a
   ?company= census deep link) is sent across to 1001 rather than served here. */
fastify.get('/map', async (req, reply) => {
  /* umkm host: its own instrument — the whole country, commodity sprites,
     city-level pins (views/mapumkm.js + public/js/umkmmap.js). */
  if (isUmkm(req)) {
    return reply.type('text/html').send(mapumkm.page({ data: umkmData(), embed: !!(req.query && req.query.embed) }));
  }
  if (isCnc(req)) {
    return reply.type('text/html').send(mapcnc.page({ data: cncData(), embed: !!(req.query && req.query.embed) }));
  }
  const qs = String(req.raw.url).split('?')[1];
  if (!is1001(req)) return reply.redirect('/jakarta' + (qs ? '?' + qs : ''));
  /* ?city= is a camera preset (any city with a company on the map, or
     'indonesia'); ?company= opens on that company with its card. Unknown
     values, and the old map's ?area= district links, fall back to the opening
     view rather than erroring. */
  const data = censusData();
  const raw = String((req.query && req.query.city) || '').toLowerCase();
  const city = raw === 'indonesia' || ((data && data.by_metro) || []).some((m) => m.id === raw && m.located > 0) ? raw : '';
  const want = String((req.query && req.query.company) || '');
  const company = ((data && data.companies) || []).some((c) => c.id === want && c.lat && c.lon) ? want : '';
  /* ?embed=1 = the landing's iframe: same map, no chrome (see views/map1001.js) */
  reply.type('text/html').send(map1001.map({
    data, city, company, lang: langOf(req), embed: !!(req.query && req.query.embed), tiles: map1001routes.tileInfo(),
  }));
});
fastify.get('/jakarta', async (req, reply) => {
  const q = new URLSearchParams(req.query || {});
  if (is1001(req)) {
    const qs = q.toString();
    return reply.redirect(langPfx(req) + '/map' + (qs ? '?' + qs : ''));
  }
  if (q.has('census') || q.has('company')) {
    q.delete('census');   // moot on 1001 — the layer is always on there
    const qs = q.toString();
    return reply.redirect('https://1001startup.id/map' + (qs ? '?' + qs : ''));
  }
  reply.type('text/html').send(pages.jakarta({ authed: !!currentMerchant(req) }));
});
fastify.get('/census', async (req, reply) => {
  let data = null;
  try { data = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'census.json'), 'utf8')); } catch {}
  reply.type('text/html').send(pages.census({ authed: !!currentMerchant(req), data }));
});
/* Public traffic page. Same numbers on both hosts, each in its own shell —
 * 1001startup is a separate brand, not a PASAR sub-page. */
fastify.get('/stats', async (req, reply) => {
  /* umkm counts views (px.HOSTS) but has no stats page yet — a PASAR-chromed
     stats page under the 1001umkm brand would be worse than none. */
  if (isUmkm(req) || isCnc(req)) return reply.redirect('/');
  const host = hostOf(req);
  const range = String((req.query && req.query.range) || '24h');
  let data;
  try {
    data = px.stats(host, range);
  } catch (e) {
    /* A busy or erroring database should cost the numbers, not the page. */
    req.log.warn({ err: e }, 'px stats failed');
    data = px.emptyStats(host, range);
  }
  reply.type('text/html').send(
    is1001(req) ? pagesStats.stats1001({ data, lang: langOf(req) }) : pagesStats.statsPasar({ data, authed: !!currentMerchant(req) }));
});

fastify.get('/scbd', async (req, reply) => {
  reply.type('text/html').send(pages.scbd({ authed: !!currentMerchant(req) }));
});
fastify.get('/scbd/map', async (req, reply) => {
  reply.redirect('/jakarta?area=scbd');
});
fastify.get('/directory', async (req, reply) => {
  const world = worldPayload();
  const districts = world.districts.map((d) => ({
    name: d.name, desc: d.desc,
    merchants: d.merchants.map((m) => ({ handle: m.handle, name: m.name, accentColor: m.accent })),
  }));
  reply.type('text/html').send(pages.directory({ districts, authed: !!currentMerchant(req) }));
});
fastify.get('/qr', async (req, reply) => {
  reply.type('text/html').send(pages.qrTool({ authed: !!currentMerchant(req) }));
});
fastify.get('/claim', async (req, reply) => {
  if (currentMerchant(req)) return reply.redirect('/dashboard');
  reply.type('text/html').send(pages.claim({ authed: false }));
});
fastify.get('/login', async (req, reply) => {
  if (currentMerchant(req)) return reply.redirect('/dashboard');
  reply.type('text/html').send(pages.login({ authed: false }));
});
fastify.get('/dashboard', async (req, reply) => {
  if (!currentMerchant(req)) return reply.redirect('/login');
  reply.type('text/html').send(pages.dashboard());
});
fastify.get('/admin', async (req, reply) => {
  reply.type('text/html').send(pages.admin());
});

/* profile page + its QR */
fastify.get('/:ath(^@[a-z0-9-]{3,31}$)', async (req, reply) => {
  const handle = req.params.ath.slice(1);
  const m = S.merchantByHandle.get(handle);
  if (!m || m.status !== 'active') return reply.callNotFound();
  S.bumpViews.run(m.id);
  const links = S.linksFor.all(m.id);
  reply.type('text/html').send(pages.profile({ m, links, districtName: districtName(m.category) }));
});
fastify.get('/:ath(^@[a-z0-9-]{3,31}$)/qr.svg', async (req, reply) => {
  const handle = req.params.ath.slice(1);
  const m = S.merchantByHandle.get(handle);
  if (!m || m.status !== 'active') return reply.callNotFound();
  reply.type('image/svg+xml')
    .header('Cache-Control', 'public, max-age=3600')
    .send(cityqr.renderLeaf(`${SITE}/q/${handle}`, {
      moduleSize: 12, seed: handle,
      accentColor: layout.ACCENTS[(m.accent | 0) % layout.ACCENTS.length],
    }));
});

/* QR redirect (counts scans) + link redirect (counts clicks) */
fastify.get('/q/:handle', async (req, reply) => {
  const m = S.merchantByHandle.get(String(req.params.handle || '').toLowerCase());
  if (!m || m.status !== 'active') return reply.redirect('/');
  S.bumpScans.run(m.id);
  reply.redirect(`/@${m.handle}`);
});
fastify.get('/l/:id', async (req, reply) => {
  const l = S.linkById.get(+req.params.id || 0);
  if (!l) return reply.redirect('/');
  const m = S.merchantById.get(l.merchant_id);
  if (!m || m.status !== 'active') return reply.redirect('/');
  S.bumpClicks.run(l.id);
  reply.redirect(l.url);
});

/* ══ open API ══════════════════════════════════════════════════════ */
fastify.get('/healthz', async () => ({ ok: true }));

/* ── px: public traffic API ────────────────────────────────────────
 * No auth and no cookie: these numbers are printed on the page anyway.
 * The beat is what keeps "online" honest — a visitor who closed the tab
 * stops beating and drops out of the window on their own.            */
fastify.post('/api/px/beat', async (req, reply) => {
  if (limited(req, reply, 'pxbeat', 180, 60e3)) return;
  const host = hostOf(req);
  try {
    px.beat({ host, ip: ipOf(req), ua: String(req.headers['user-agent'] || ''),
      /* the page reports its first trusted tap/click/wheel/key (public/js/px.js) */
      engaged: !!(req.body && typeof req.body === 'object' && req.body.e === 1) });
  } catch { /* presence is best-effort */ }
  try {
    reply.header('Cache-Control', 'no-store').send(px.badge(host));
  } catch { reply.header('Cache-Control', 'no-store').send({ online: 0, views: 0, visitors: 0 }); }
});
fastify.get('/api/px/live', async (req, reply) => {
  if (limited(req, reply, 'pxlive', 120, 60e3)) return;
  try {
    reply.header('Cache-Control', 'no-store').send(px.live(hostOf(req)));
  } catch { reply.header('Cache-Control', 'no-store').send({ online: 0, views: 0, visitors: 0, livePages: [] }); }
});
fastify.get('/api/px/stats', async (req, reply) => {
  if (limited(req, reply, 'pxstats', 120, 60e3)) return;
  const range = String((req.query && req.query.range) || '24h');
  try {
    reply.header('Cache-Control', 'no-store').send(px.stats(hostOf(req), range));
  } catch { reply.header('Cache-Control', 'no-store').send(px.emptyStats(hostOf(req), range)); }
});

fastify.get('/api/world', async (req, reply) => {
  reply.header('Cache-Control', 'public, max-age=10').send(worldPayload());
});

fastify.get('/qr.svg', async (req, reply) => {
  if (limited(req, reply, 'qrsvg', 60, 60e3)) return;
  const data = U.clampStr(req.query.data, 512);
  if (!data) return reply.code(400).send({ error: 'missing_data' });
  let svg;
  try {
    const common = {
      ecl: req.query.ecl, accents: req.query.accents !== '0',
      moduleSize: Math.min(24, Math.max(6, +req.query.u || 12)),
    };
    svg = req.query.style === 'ink'
      ? cityqr.render(data, common)
      : cityqr.renderLeaf(data, {
          ...common,
          season: req.query.season,
          accentColor: req.query.accent ? `#${String(req.query.accent).replace('#', '')}` : undefined,
        });
  } catch { return reply.code(400).send({ error: 'unencodable' }); }
  reply.type('image/svg+xml').header('Cache-Control', 'public, max-age=300').send(svg);
});
fastify.get('/api/qr/matrix', async (req, reply) => {
  if (limited(req, reply, 'qrmx', 120, 60e3)) return;
  const data = U.clampStr(req.query.data, 512);
  if (!data) return reply.code(400).send({ error: 'missing_data' });
  const ecl = ['L', 'M', 'Q', 'H'].includes(req.query.ecl) ? req.query.ecl : 'Q';
  try { reply.send(cityqr.matrix(data, ecl)); }
  catch { reply.code(400).send({ error: 'unencodable' }); }
});

fastify.get('/api/handle/:h', async (req, reply) => {
  if (limited(req, reply, 'handle', 120, 60e3)) return;
  const h = String(req.params.h || '').toLowerCase();
  if (!U.validHandle(h)) return reply.send({ handle: h, available: false, reason: 'invalid' });
  reply.send({ handle: h, available: !S.merchantByHandle.get(h) });
});

/* ── auth ──────────────────────────────────────────────────────────── */
function startSession(reply, merchantId) {
  const tok = U.newToken();
  S.newSession.run(tok, merchantId, 0, '+30 days');
  reply.setCookie('psid', tok, sessionCookieOpts(30 * 86400));
}

fastify.post('/api/claim', async (req, reply) => {
  if (limited(req, reply, 'claim', 5, 3600e3)) return;
  const b = req.body || {};
  const handle = U.clampStr(b.handle, 30).toLowerCase();
  const name = U.clampStr(b.name, 60);
  const category = layout.DISTRICT_KEYS.has(b.category) ? b.category : null;
  const bio = U.clampStr(b.bio, 280);
  const password = typeof b.password === 'string' ? b.password : '';
  if (!U.validHandle(handle)) return reply.code(400).send({ error: 'bad_handle', message: 'Handle must be 3–30 lowercase letters, numbers or hyphens (and not a reserved word).' });
  if (S.merchantByHandle.get(handle)) return reply.code(409).send({ error: 'taken', message: 'That handle is already claimed.' });
  if (!name) return reply.code(400).send({ error: 'bad_name', message: 'A display name is required.' });
  if (!category) return reply.code(400).send({ error: 'bad_category', message: 'Pick a district.' });
  if (password.length < 8 || password.length > 128) return reply.code(400).send({ error: 'bad_password', message: 'Password must be at least 8 characters.' });
  let linkRow = null;
  if (b.link && (b.link.label || b.link.url)) {
    const label = U.clampStr(b.link.label, 40);
    const url = U.clampStr(b.link.url, 300);
    if (!label || !U.validUrl(url)) return reply.code(400).send({ error: 'bad_link', message: 'The first link needs a label and a valid http(s) URL.' });
    linkRow = { label, url };
  }
  const info = S.insertMerchant.run(handle, name, category, bio, 0, U.hashPassword(password));
  if (linkRow) S.insertLink.run(info.lastInsertRowid, linkRow.label, linkRow.url, 0);
  S.audit.run(`@${handle}`, 'claim', handle);
  invalidateWorld();
  startSession(reply, info.lastInsertRowid);
  reply.send({ ok: true, handle });
});

fastify.post('/api/login', async (req, reply) => {
  if (limited(req, reply, 'login', 10, 300e3)) return;
  const b = req.body || {};
  const handle = U.clampStr(b.handle, 30).toLowerCase().replace(/^@/, '');
  const m = S.merchantByHandle.get(handle);
  if (!m || !U.verifyPassword(String(b.password || ''), m.password_hash)) {
    return reply.code(401).send({ error: 'bad_credentials', message: "That handle and password don't match." });
  }
  startSession(reply, m.id);
  reply.send({ ok: true, handle: m.handle });
});

fastify.post('/api/logout', async (req, reply) => {
  const tok = req.cookies && req.cookies.psid;
  if (tok) S.deleteSession.run(tok);
  reply.clearCookie('psid', { path: '/' }).send({ ok: true });
});

/* ── merchant API ──────────────────────────────────────────────────── */
fastify.get('/api/me', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const links = S.linksFor.all(m.id);
  const clicks = S.clicksTotal.get(m.id).n;
  reply.send({
    handle: m.handle, name: m.name, category: m.category, bio: m.bio, accent: m.accent,
    location: m.location || '', tags: m.tags || '',
    featured: !!m.featured, views: m.views, scans: m.scans, clicks, links,
    created_at: m.created_at, profileUrl: `${SITE}/@${m.handle}`, qrUrl: `${SITE}/q/${m.handle}`,
  });
});

fastify.put('/api/me', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const b = req.body || {};
  const name = U.clampStr(b.name, 60) || m.name;
  const category = layout.DISTRICT_KEYS.has(b.category) ? b.category : m.category;
  const bio = 'bio' in b ? U.clampStr(b.bio, 280) : m.bio;
  const accent = Number.isInteger(b.accent) && b.accent >= 0 && b.accent < layout.ACCENTS.length ? b.accent : m.accent;
  const location = 'location' in b ? U.clampStr(b.location, 60) : (m.location || '');
  let tags = m.tags || '';
  if (Array.isArray(b.tags)) {
    tags = b.tags.slice(0, 3).map((t) => U.clampStr(t, 20)).filter(Boolean).join(',');
  } else if (typeof b.tags === 'string') {
    tags = b.tags.split(',').slice(0, 3).map((t) => t.trim().slice(0, 20)).filter(Boolean).join(',');
  }
  S.updateMerchant.run(name, category, bio, accent, location, tags, m.id);
  invalidateWorld();
  reply.send({ ok: true });
});

fastify.post('/api/me/links', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const b = req.body || {};
  const label = U.clampStr(b.label, 40);
  const url = U.clampStr(b.url, 300);
  if (!label || !U.validUrl(url)) return reply.code(400).send({ error: 'bad_link', message: 'A label and a valid http(s) URL are required.' });
  if (S.linkCount.get(m.id).n >= 20) return reply.code(400).send({ error: 'too_many', message: 'Up to 20 links per plot.' });
  const pos = S.maxLinkPos.get(m.id).next;
  const info = S.insertLink.run(m.id, label, url, pos);
  reply.send({ ok: true, id: info.lastInsertRowid });
});

fastify.put('/api/me/links/:id', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const b = req.body || {};
  const label = U.clampStr(b.label, 40);
  const url = U.clampStr(b.url, 300);
  if (!label || !U.validUrl(url)) return reply.code(400).send({ error: 'bad_link', message: 'A label and a valid http(s) URL are required.' });
  const r = S.updateLink.run(label, url, +req.params.id || 0, m.id);
  if (!r.changes) return reply.code(404).send({ error: 'not_found' });
  reply.send({ ok: true });
});

fastify.delete('/api/me/links/:id', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const r = S.deleteLink.run(+req.params.id || 0, m.id);
  if (!r.changes) return reply.code(404).send({ error: 'not_found' });
  reply.send({ ok: true });
});

fastify.post('/api/me/links/reorder', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const ids = Array.isArray(req.body && req.body.ids) ? req.body.ids.map((n) => +n) : null;
  if (!ids || ids.length > 40 || ids.some((n) => !Number.isInteger(n))) {
    return reply.code(400).send({ error: 'bad_ids' });
  }
  // The submitted ids must be exactly this merchant's link set, or positions
  // could duplicate after a concurrent add/delete.
  const current = S.linkIdsFor.all(m.id).map((r) => r.id).sort((a, b) => a - b);
  const submitted = [...ids].sort((a, b) => a - b);
  if (current.length !== submitted.length || current.some((v, i) => v !== submitted[i])) {
    return reply.code(409).send({ error: 'stale_ids', message: 'Your links changed elsewhere — reload and try again.' });
  }
  const tx = db.transaction(() => {
    ids.forEach((id, i) => S.setLinkPos.run(i, id, m.id));
  });
  tx();
  reply.send({ ok: true });
});

fastify.post('/api/me/password', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const b = req.body || {};
  if (!U.verifyPassword(String(b.current || ''), m.password_hash)) {
    return reply.code(401).send({ error: 'bad_current', message: "Current password doesn't match." });
  }
  const next = String(b.next || '');
  if (next.length < 8 || next.length > 128) return reply.code(400).send({ error: 'bad_password', message: 'New password must be at least 8 characters.' });
  S.updatePassword.run(U.hashPassword(next), m.id);
  S.deleteSessionsFor.run(m.id);          // revoke every session, then keep this browser
  startSession(reply, m.id);
  reply.send({ ok: true });
});

fastify.get('/api/me/export', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  const links = S.linksFor.all(m.id);
  reply
    .header('Content-Disposition', `attachment; filename="pasar-${m.handle}.json"`)
    .type('application/json')
    .send(JSON.stringify({
      exported_at: new Date().toISOString(),
      profile: { handle: m.handle, name: m.name, category: m.category, bio: m.bio, accent: m.accent, created_at: m.created_at },
      stats: { views: m.views, scans: m.scans },
      links,
    }, null, 2));
});

fastify.delete('/api/me', async (req, reply) => {
  const m = requireMerchant(req, reply); if (!m) return;
  S.deleteMerchant.run(m.id);
  S.deleteSessionsFor.run(m.id);
  S.audit.run(`@${m.handle}`, 'self_delete', m.handle);
  invalidateWorld();
  reply.clearCookie('psid', { path: '/' }).send({ ok: true });
});

/* ── admin API ─────────────────────────────────────────────────────── */
fastify.post('/api/admin/login', async (req, reply) => {
  if (limited(req, reply, 'admlogin', 5, 300e3)) return;
  const key = String((req.body && req.body.key) || '');
  const a = Buffer.from(key), b = Buffer.from(ADMIN_KEY);
  const ok = ADMIN_KEY && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return reply.code(401).send({ error: 'bad_key', message: 'Wrong key.' });
  const tok = U.newToken();
  S.newSession.run(tok, null, 1, '+12 hours');
  reply.setCookie('psadm', tok, sessionCookieOpts(12 * 3600)).send({ ok: true });
});

fastify.get('/api/admin/overview', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const merchants = S.adminList.all();
  const st = S.stats.get();
  reply.send({ merchants, stats: st, districts: layout.DISTRICTS });
});

fastify.post('/api/admin/merchants/:id', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const m = S.merchantById.get(+req.params.id || 0);
  if (!m) return reply.code(404).send({ error: 'not_found' });
  const b = req.body || {};
  if (b.status === 'active' || b.status === 'hidden') {
    S.setStatus.run(b.status, m.id);
    S.audit.run('admin', `status:${b.status}`, m.handle);
  }
  if (typeof b.featured === 'boolean') {
    S.setFeatured.run(b.featured ? 1 : 0, m.id);
    S.audit.run('admin', `featured:${b.featured}`, m.handle);
  }
  invalidateWorld();
  reply.send({ ok: true });
});

fastify.delete('/api/admin/merchants/:id', async (req, reply) => {
  if (!requireAdmin(req, reply)) return;
  const m = S.merchantById.get(+req.params.id || 0);
  if (!m) return reply.code(404).send({ error: 'not_found' });
  S.deleteMerchant.run(m.id);
  S.deleteSessionsFor.run(m.id);
  S.audit.run('admin', 'delete', m.handle);
  invalidateWorld();
  reply.send({ ok: true });
});

/* ── 1001startup.id: Lead Search ───────────────────────────────────── */
/* The whole product lives behind one call so this file takes a single line —
   another session edits this repo concurrently and a small surface is the
   point. Routes inside are all is1001-gated. */
const leads = require('./lib/leads-routes')(fastify, { db, is1001, PROD, ipOf, langOf });

/* ── 1001startup.id: the census read API (/api/census/*) ─────────────── */
/* Same one-line pattern. Read-only over the public layer. Built for the census
   chat, which was removed on 4 Oct 2026; /ask now 301s to the home page. */
require('./lib/census-api-routes')(fastify, { is1001, ipOf, censusData, langOf });

/* ── 1001startup.id: what the logo map reads (tiles, glyphs, pins) ───── */
const map1001routes = require('./lib/map1001-routes')(fastify, { is1001, censusData });

/* ── the census file is not a public download ──────────────────────── */
/* What the site publishes is every figure WITH its source, on the company's
   own page. What this file adds on top of that is the working layer — the
   verify notes, the headcount reasoning, the source ladder and tiers, the
   liveness and geocode trail — for 304 companies in one 688KB GET, which is
   the part that took the months. The map keeps its own feed
   (/data/census-map.json), so nothing on the site reads this path; the static
   mount was simply serving whatever build-census.js wrote. An explicit route
   outranks @fastify/static's wildcard, so the door closes here without moving
   the file every build script writes to. The operator's leads session opens
   it. */
fastify.get('/data/census.json', async (req, reply) => {
  if (!leads.authed(req)) {
    return reply.code(403).type('application/json').send({
      error: 'not_public',
      message: 'The census file is not published. Every figure in it is shown with its sources on that company page at 1001startup.id.',
    });
  }
  reply.header('Cache-Control', 'no-store');
  return reply.sendFile('data/census.json');
});
/* Same door, same reason, for the exporter census: the site shows every row
   with its source; the one-file working layer is the commercial product
   (1001umkm.id exists to sell that dataset overseas). */
fastify.get('/data/umkm.json', async (req, reply) => {
  if (!leads.authed(req)) {
    return reply.code(403).type('application/json').send({
      error: 'not_public',
      message: 'The exporter dataset is not published as a file. Every row is shown with its source on its page at 1001umkm.id.',
    });
  }
  reply.header('Cache-Control', 'no-store');
  return reply.sendFile('data/umkm.json');
});
/* And for the CNC + 3D map's working file: the site shows every row with its
   source; whether the file itself is ever published is Luca's call. */
fastify.get('/data/cnc.json', async (req, reply) => {
  if (!leads.authed(req)) {
    return reply.code(403).type('application/json').send({
      error: 'not_public',
      message: 'The working file is not published. Every firm and focus place is shown with its sources on the site.',
    });
  }
  reply.header('Cache-Control', 'no-store');
  return reply.sendFile('data/cnc.json');
});

/* ── 404 ───────────────────────────────────────────────────────────── */
fastify.setNotFoundHandler((req, reply) => {
  if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' });
  /* each brand 404s in its own shell — a typo on umkm must not surface PASAR */
  if (isUmkm(req)) return reply.code(404).type('text/html').send(companyumkm.notFound({ data: umkmData() }));
  if (isCnc(req)) return reply.code(404).type('text/html').send(pagescnc.notFound());
  if (is1001(req)) {
    /* /company/gojek/ is the same page with a stray slash — 301 to the clean
       URL instead of 404ing (canonical hygiene; crawlers follow pasted links).
       req.raw.url is already /id-stripped, so the prefix is re-added by lang. */
    if (req.method === 'GET') {
      const [p, qs] = String((req.raw && req.raw.url) || req.url).split('?');
      if (p.length > 1 && p.endsWith('/')) {
        const dest = (langOf(req) === 'id' ? '/id' : '') + p.replace(/\/+$/, '') + (qs ? '?' + qs : '');
        return reply.header('location', dest).code(301).send();
      }
    }
    return reply.code(404).type('text/html').send(company1001.notFound({ data: censusData(), lang: langOf(req) }));
  }
  reply.code(404).type('text/html').send(pages.notFound());
});

fastify.listen({ port: PORT, host: '127.0.0.1' }).then(() => {
  console.log(`pasar listening on 127.0.0.1:${PORT}`);
}).catch((err) => { console.error(err); process.exit(1); });
