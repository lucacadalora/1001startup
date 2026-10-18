'use strict';
/**
 * 1001startup.id — reader accounts: login wall slice 1 (Luca, 18 Oct 2026).
 * Plan: https://claude.ai/artifact/UsFcmrbQjNFJQACJDAmGDK
 *
 * Email + 6-digit code, no passwords. /signin shows the form, /signin/code
 * mails a code, /signin/verify swaps a right code for a 30-day session,
 * /signout ends it. Nobody is forced to sign in by this slice; it only adds the
 * door. The wall (slice 2) will read signedIn() from here.
 *
 * Mounted from server.js with one line, like lib/leads-routes.js, because
 * another session edits this repo concurrently.
 *
 * Storage (data/pasar.db): acct_users, acct_codes, acct_sessions. Session
 * tokens and codes are stored as SHA-256 hashes, so a copy of the database
 * signs nobody in. Cookies are HOST-ONLY (no Domain attribute, ever).
 *
 * Mail goes through Resend with a send-only key limited to 1001startup.id
 * (RESEND_KEY_1001 in .env). The Resend account is the shared jatevo.ai one,
 * whose free plan allows 100 mails a day across BOTH domains, so 1001 stops
 * itself at DAY_CAP and leaves the rest for jatevo.ai sign-ins.
 */
const crypto = require('crypto');
const view = require('../views/signin1001');

const COOKIE = 'a1001';      // the session
const PENDING = 'a1001p';    // which code request this browser is answering
const TTL_DAYS = 30;
const CODE_MIN = 10;         // a code works for ten minutes
const MAX_TRIES = 5;         // wrong guesses before a code dies
const DAY_CAP = 60;          // codes per rolling 24 h, all of 1001 (see above)
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

module.exports = function registerAccounts(fastify, deps) {
  const { db, is1001, PROD, ipOf } = deps;
  const langOf = deps.langOf || (() => 'en');

  db.exec(`
CREATE TABLE IF NOT EXISTS acct_users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_signin_at TEXT,
  signins INTEGER NOT NULL DEFAULT 0,
  lang TEXT
);
CREATE TABLE IF NOT EXISTS acct_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_acct_codes_email ON acct_codes(email, created_at);
CREATE INDEX IF NOT EXISTS idx_acct_codes_ip ON acct_codes(ip, created_at);
CREATE INDEX IF NOT EXISTS idx_acct_codes_created ON acct_codes(created_at);
CREATE TABLE IF NOT EXISTS acct_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  ip TEXT,
  ua TEXT
);
CREATE INDEX IF NOT EXISTS idx_acct_sessions_expiry ON acct_sessions(expires_at);
`);

  const Q = {
    sessionUser: db.prepare(`SELECT u.id, u.email FROM acct_sessions s JOIN acct_users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > datetime('now')`),
    newSession: db.prepare(`INSERT INTO acct_sessions (token_hash, user_id, expires_at, ip, ua)
      VALUES (?, ?, datetime('now', ?), ?, ?)`),
    dropSession: db.prepare(`DELETE FROM acct_sessions WHERE token_hash = ?`),
    codesForEmail: db.prepare(`SELECT COUNT(*) n FROM acct_codes WHERE email = ? AND created_at > datetime('now', ?)`),
    codesForIp: db.prepare(`SELECT COUNT(*) n FROM acct_codes WHERE ip = ? AND created_at > datetime('now', '-1 hour')`),
    codesToday: db.prepare(`SELECT COUNT(*) n FROM acct_codes WHERE created_at > datetime('now', '-1 day')`),
    newCode: db.prepare(`INSERT INTO acct_codes (id, email, code_hash, expires_at, ip)
      VALUES (?, ?, ?, datetime('now', ?), ?)`),
    dropCode: db.prepare(`DELETE FROM acct_codes WHERE id = ?`),
    codeById: db.prepare(`SELECT id, email, code_hash, tries, used,
      (expires_at > datetime('now')) AS live FROM acct_codes WHERE id = ?`),
    tried: db.prepare(`UPDATE acct_codes SET tries = tries + 1 WHERE id = ?`),
    used: db.prepare(`UPDATE acct_codes SET used = 1 WHERE id = ?`),
    upsertUser: db.prepare(`INSERT INTO acct_users (email, lang, last_signin_at, signins)
      VALUES (?, ?, datetime('now'), 1)
      ON CONFLICT(email) DO UPDATE SET last_signin_at = datetime('now'), signins = signins + 1`),
    userByEmail: db.prepare(`SELECT id FROM acct_users WHERE email = ?`),
    /* codes are kept a week for the rate limits and the counts, then go */
    sweepCodes: db.prepare(`DELETE FROM acct_codes WHERE created_at < datetime('now', '-7 days')`),
    sweepSessions: db.prepare(`DELETE FROM acct_sessions WHERE expires_at <= datetime('now')`),
  };
  const sweep = () => { try { Q.sweepCodes.run(); Q.sweepSessions.run(); } catch { /* a locked db must not stop boot */ } };
  sweep();
  setInterval(sweep, 3600e3).unref();

  /* Same urlencoded parser leads-routes.js adds; registered there first, so
     this normally finds it already present. */
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
  const tokOf = (req, name) => {
    const t = req.cookies && req.cookies[name];
    return t && /^[a-f0-9]{64}$/.test(t) ? t : null;
  };

  /** The signed-in reader, or null. Exported for the wall (slice 2). */
  function signedIn(req) {
    const tok = tokOf(req, COOKIE);
    if (!tok) return null;
    try { return Q.sessionUser.get(sha(tok)) || null; } catch { return null; }
  }

  /* `next` is where to land after signing in: a path on this site only. */
  function safeNext(n) {
    const s = String(n || '');
    if (!s || s.length > 400 || s[0] !== '/' || s[1] === '/' || s[1] === '\\' || /[\r\n\t]/.test(s)) return '';
    if (/^\/(id\/)?(signin|signout)(\/|\?|$)/.test(s)) return '';
    return s;
  }
  const bodyLang = (req) => (req.body && req.body.lang === 'id' ? 'id' : 'en');
  const pfx = (lang) => (lang === 'id' ? '/id' : '');
  const L = (lang) => (en, id) => (lang === 'id' ? id : en);
  const html = (reply, code, page) => reply.code(code).type('text/html').send(page);
  const go = (reply, url) => reply.redirect(url, 303);

  /* Wrong-code guesses per network, in memory: the per-code cap (5) already
     stops a guess-run on one code; this stops someone cycling fresh codes. */
  const fails = new Map();
  function noteFail(ip) {
    const now = Date.now();
    const r = fails.get(ip) || { n: 0, at: now };
    if (now - r.at > 15 * 60e3) { r.n = 0; r.at = now; }
    r.n += 1;
    fails.set(ip, r);
    if (fails.size > 5000) for (const [k, v] of fails) if (now - v.at > 15 * 60e3) fails.delete(k);
  }
  const lockedOut = (ip) => { const r = fails.get(ip); return !!(r && r.n >= 30 && Date.now() - r.at < 15 * 60e3); };

  async function sendCode(email, code, id, lang) {
    const key = process.env.RESEND_KEY_1001;
    if (!key) throw new Error('RESEND_KEY_1001 missing');
    const t = L(lang);
    /* Plain text, no links, no images: a sign-in code should land in the
       Primary tab, and anything that reads like a newsletter does not. */
    const text = t(
      `Your sign-in code for 1001startup.id is:\n\n${code}\n\nIt works for ${CODE_MIN} minutes. If you did not ask for it, you can ignore this email.\n`,
      `Kode masuk kamu untuk 1001startup.id:\n\n${code}\n\nBerlaku ${CODE_MIN} menit. Kalau kamu tidak memintanya, abaikan saja email ini.\n`);
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM_1001 || '1001startup.id <masuk@1001startup.id>',
        to: [email],
        subject: t(`Your 1001startup.id code: ${code}`, `Kode masuk 1001startup.id: ${code}`),
        text,
        /* a fresh ref per mail keeps Gmail from threading codes together */
        headers: { 'X-Entity-Ref-ID': id },
      }),
      signal: AbortSignal.timeout(10e3),
    });
    if (!res.ok) throw new Error(`resend ${res.status} ${(await res.text()).slice(0, 200)}`);
  }

  /* ── pages ─────────────────────────────────────────────────────────── */

  fastify.get('/signin', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const lang = langOf(req);
    const next = safeNext(req.query && req.query.next);
    const me = signedIn(req);
    if (me) return html(reply, 200, view.account({ lang, email: me.email, next }));
    if (req.query && req.query.step === 'code') {
      const pid = tokOf(req, PENDING);
      const row = pid ? Q.codeById.get(pid) : null;
      if (row && row.live && !row.used && row.tries < MAX_TRIES) {
        return html(reply, 200, view.codeStep({ lang, next, email: row.email }));
      }
    }
    return html(reply, 200, view.emailStep({ lang, next }));
  });

  fastify.post('/signin/code', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const lang = bodyLang(req);
    const t = L(lang);
    const next = safeNext(req.body && req.body.next);
    const email = String((req.body && req.body.email) || '').trim().toLowerCase();
    const again = (code, error) => html(reply, code, view.emailStep({ lang, next, error, email }));
    if (email.length > 254 || !EMAIL_RE.test(email)) {
      return again(400, t('That email does not look right. Check it and try again.',
        'Format email belum benar. Cek lagi lalu coba ulang.'));
    }
    const ip = String(ipOf(req));
    try {
      if (Q.codesForEmail.get(email, '-15 minutes').n >= 3 || Q.codesForEmail.get(email, '-1 day').n >= 10) {
        return again(429, t('Too many codes asked for this email. Try again in 15 minutes.',
          'Terlalu banyak permintaan kode untuk email ini. Coba lagi 15 menit lagi.'));
      }
      if (Q.codesForIp.get(ip).n >= 20) {
        return again(429, t('Too many sign-in attempts from this network. Try again in an hour.',
          'Terlalu banyak percobaan masuk dari jaringan ini. Coba lagi satu jam lagi.'));
      }
      if (Q.codesToday.get().n >= DAY_CAP) {
        req.log.warn({ cap: DAY_CAP }, 'acct1001: daily code cap reached');
        return again(429, t('Sign-in is busy right now. Try again in a few hours.',
          'Layanan masuk sedang sibuk. Coba lagi beberapa jam lagi.'));
      }
    } catch (e) {
      req.log.error(e, 'acct1001: limit check failed');
      return again(503, t('Sign-in is not working right now. Try again in a minute.',
        'Layanan masuk sedang bermasalah. Coba lagi semenit lagi.'));
    }
    const id = crypto.randomBytes(32).toString('hex');
    const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
    try {
      Q.newCode.run(id, email, sha(id + ':' + code), `+${CODE_MIN} minutes`, ip);
      await sendCode(email, code, id, lang);
    } catch (e) {
      /* a code that never left must not count against the limits */
      try { Q.dropCode.run(id); } catch { /* nothing to undo */ }
      req.log.error({ err: String(e && e.message || e) }, 'acct1001: code mail failed');
      return again(502, t('We could not send the email just now. Try again in a minute.',
        'Email belum bisa terkirim. Coba lagi semenit lagi.'));
    }
    reply.setCookie(PENDING, id, cookieOpts(CODE_MIN * 60 + 300));
    return go(reply, `${pfx(lang)}/signin?step=code${next ? '&next=' + encodeURIComponent(next) : ''}`);
  });

  fastify.post('/signin/verify', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const lang = bodyLang(req);
    const t = L(lang);
    const next = safeNext(req.body && req.body.next);
    const pid = tokOf(req, PENDING);
    const row = pid ? Q.codeById.get(pid) : null;
    if (!row) return go(reply, `${pfx(lang)}/signin${next ? '?next=' + encodeURIComponent(next) : ''}`);
    const ip = String(ipOf(req));
    const dead = (error) => html(reply, 400, view.codeStep({ lang, next, email: row.email, error, dead: true }));
    if (row.used || !row.live || row.tries >= MAX_TRIES) {
      return dead(t('That code has expired. Ask for a new one.', 'Kode itu sudah tidak berlaku. Minta kode baru.'));
    }
    if (lockedOut(ip)) {
      return html(reply, 429, view.codeStep({ lang, next, email: row.email,
        error: t('Too many wrong codes from this network. Try again in 15 minutes.',
          'Terlalu banyak kode salah dari jaringan ini. Coba lagi 15 menit lagi.') }));
    }
    const given = String((req.body && req.body.code) || '').replace(/\D/g, '');
    const ok = given.length === 6 && crypto.timingSafeEqual(
      Buffer.from(sha(row.id + ':' + given), 'hex'), Buffer.from(row.code_hash, 'hex'));
    if (!ok) {
      Q.tried.run(row.id);
      noteFail(ip);
      const left = MAX_TRIES - row.tries - 1;
      if (left <= 0) return dead(t('That code has run out of tries. Ask for a new one.', 'Kesempatan untuk kode itu sudah habis. Minta kode baru.'));
      return html(reply, 400, view.codeStep({ lang, next, email: row.email,
        error: t(`That code does not match. ${left} ${left === 1 ? 'try' : 'tries'} left.`, `Kodenya tidak cocok. Sisa ${left} kali coba.`) }));
    }
    const tok = crypto.randomBytes(32).toString('hex');
    try {
      db.transaction(() => {
        Q.used.run(row.id);
        Q.upsertUser.run(row.email, lang);
        const u = Q.userByEmail.get(row.email);
        Q.newSession.run(sha(tok), u.id, `+${TTL_DAYS} days`, ip, String(req.headers['user-agent'] || '').slice(0, 300));
      })();
    } catch (e) {
      req.log.error(e, 'acct1001: sign-in write failed');
      return html(reply, 503, view.codeStep({ lang, next, email: row.email,
        error: t('Sign-in is not working right now. Try again in a minute.', 'Layanan masuk sedang bermasalah. Coba lagi semenit lagi.') }));
    }
    reply.setCookie(COOKIE, tok, cookieOpts(TTL_DAYS * 86400));
    reply.clearCookie(PENDING, { path: '/' });
    return go(reply, next || `${pfx(lang)}/signin`);
  });

  fastify.post('/signout', async (req, reply) => {
    if (!is1001(req)) return reply.redirect('/');
    const tok = tokOf(req, COOKIE);
    if (tok) { try { Q.dropSession.run(sha(tok)); } catch { /* cookie goes anyway */ } }
    reply.clearCookie(COOKIE, { path: '/' });
    return go(reply, `${pfx(bodyLang(req))}/signin`);
  });

  /* ── the header's account link ────────────────────────────────────────
     views/nav1001.js puts <!--ACCT1001--> in the header; it is filled here,
     per request, the way <!--PX-BADGE--> is filled in server.js. Signed out:
     "Sign in", returning to this page. Signed in: "Account". */
  fastify.addHook('onSend', async (req, reply, payload) => {
    if (typeof payload !== 'string' || !payload.includes('<!--ACCT1001-->')) return payload;
    try {
      const lang = (req.raw && req.raw.lang1001 === 'id') ? 'id' : 'en';
      const t = L(lang);
      const here = pfx(lang) + String(req.url || '/');
      const me = signedIn(req);
      const next = safeNext(here);
      const a = me
        ? `<a class="acct on" href="${pfx(lang)}/signin" title="${escAttr(me.email)}">${t('Account', 'Akun')}</a>`
        : `<a class="acct" href="${pfx(lang)}/signin${next ? '?next=' + encodeURIComponent(next) : ''}">${t('Sign in', 'Masuk')}</a>`;
      return payload.replaceAll('<!--ACCT1001-->', a);
    } catch {
      return payload.replaceAll('<!--ACCT1001-->', '');
    }
  });

  return { signedIn };
};

const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
