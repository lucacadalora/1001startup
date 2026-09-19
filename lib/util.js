'use strict';
const crypto = require('crypto');

/* ── HTML escaping ─────────────────────────────────────────────────────── */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/* ── passwords: scrypt with per-user salt ─────────────────────────────── */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${key.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  try {
    const [scheme, N, r, p, saltHex, keyHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), Buffer.from(keyHex, 'hex').length,
      { N: +N, r: +r, p: +p });
    return crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
  } catch { return false; }
}

/* ── tokens ────────────────────────────────────────────────────────────── */
const newToken = () => crypto.randomBytes(32).toString('hex');

/* ── deterministic small hash (world geometry, QR accents) ────────────── */
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ── validation ────────────────────────────────────────────────────────── */
const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;
const RESERVED = new Set([
  'admin', 'api', 'app', 'assets', 'claim', 'css', 'dashboard', 'directory', 'docs', 'export',
  'favicon', 'health', 'help', 'js', 'l', 'login', 'logout', 'me', 'p', 'pasar', 'privacy',
  'q', 'qr', 'robots', 's', 'settings', 'static', 'support', 'terms', 'vantis', 'vendor', 'world',
]);
function validHandle(h) {
  return typeof h === 'string' && HANDLE_RE.test(h) && !RESERVED.has(h) && !h.includes('--');
}
function validUrl(u) {
  if (typeof u !== 'string' || u.length > 300) return false;
  if (/[\x00-\x20\x7f]/.test(u)) return false; // no control chars/whitespace — they corrupt redirects
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:';
  } catch { return false; }
}
const clampStr = (s, max) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

/* ── in-memory rate limiter (per ip+scope, fixed window) ──────────────── */
const buckets = new Map();
function rateLimit(ip, scope, max, windowMs) {
  const now = Date.now();
  const key = `${scope}:${String(ip).slice(0, 64)}`;
  let b = buckets.get(key);
  if (!b || now > b.reset) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  if (buckets.size > 50000) {           // safety valve: drop stale, then oldest
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    if (buckets.size > 50000) {
      for (const k of buckets.keys()) {
        buckets.delete(k);
        if (buckets.size <= 40000) break;
      }
    }
  }
  return b.n <= max;
}

module.exports = {
  esc, hashPassword, verifyPassword, newToken, hash32,
  validHandle, validUrl, clampStr, rateLimit, RESERVED,
};
