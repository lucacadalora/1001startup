#!/usr/bin/env node
'use strict';
/**
 * 1001startup.id login wall: the daily numbers for its first week (Luca,
 * 18 Oct 2026: "Switch the wall on for all readers and send me the numbers
 * daily for a week"). The systemd user timer wall-daily-1001.timer runs this
 * at 01:05 UTC (08:05 WIB) on 19-25 Oct 2026; each run sends one Telegram DM
 * about the previous UTC day through the OpenClaw bot, to the chat that gets
 * the VM breaker alerts. The bot token is read at send time from
 * ~/.openclaw/openclaw.json and never printed or stored.
 *
 *   node scripts/wall-daily.js                     yesterday (UTC), send
 *   node scripts/wall-daily.js --day 2026-10-18    that day, send
 *   add --dry to print instead of sending; --intro adds the first-message line
 *
 * Sources, all in data/pasar.db, read-only: wall_counts (lib/account1001.js:
 * day-level counts, no identifiers), acct_users, acct_follows (My 1001),
 * px_view (the site's own visitor counter: real people only, eng=1, net=''),
 * ask_log / ask_user_day / acct_lead_asks (the My 1001 dashboard: Ask 1001 and
 * the lead agent's requests).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const FIRST_DAY = '2026-10-18';          // wall on at 11:46:53Z
const BASE = ['2026-10-11', '2026-10-17']; // the week before, for comparison
const CHAT_ID = '841222912';             // Luca's DM with the OpenClaw bot
const HOST = '1001.vantis.sh';           // px's name for 1001startup.id

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const intro = args.includes('--intro');
const di = args.indexOf('--day');
const day = di >= 0 ? String(args[di + 1] || '') : new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) { console.error('use --day YYYY-MM-DD'); process.exit(2); }

const db = new Database(path.join(__dirname, '..', 'data', 'pasar.db'), { readonly: true, fileMustExist: true });
db.pragma('busy_timeout = 5000');

const ms = (d) => Date.parse(d + 'T00:00:00Z');
const plusDays = (d, k) => new Date(ms(d) + k * 86400e3).toISOString().slice(0, 10);
const n = (x) => Math.round(Number(x || 0)).toLocaleString('en-US');
const one = (x) => (Math.round(Number(x || 0) * 10) / 10).toFixed(1);

/* one UTC day of real readers; vid is salted per day, so distinct = people */
const readers = db.prepare(`SELECT COUNT(DISTINCT vid) AS people, COUNT(*) AS views,
  COUNT(DISTINCT CASE WHEN chan = 'search' AND ref LIKE '%google.%' THEN vid END) AS google
  FROM px_view WHERE host = ? AND eng = 1 AND net = '' AND ts >= ? AND ts < ?`);
const readersOn = (d) => readers.get(HOST, ms(d), ms(plusDays(d, 1)));

function report(d) {
  const w = {};
  for (const r of db.prepare('SELECT kind, n FROM wall_counts WHERE day = ?').all(d)) w[r.kind] = r.n;
  const first = w.first || 0;
  const signin = w.signin || 0;
  const total = db.prepare('SELECT COUNT(*) AS n FROM acct_users WHERE date(created_at) <= ?').get(d).n;
  const fresh = db.prepare('SELECT COUNT(*) AS n FROM acct_users WHERE date(created_at) = ?').get(d).n;
  const r = readersOn(d);
  const base = { people: 0, views: 0, google: 0 };
  for (let x = BASE[0]; x <= BASE[1]; x = plusDays(x, 1)) {
    const b = readersOn(x);
    base.people += b.people; base.views += b.views; base.google += b.google;
  }
  const days = Math.round((ms(BASE[1]) - ms(BASE[0])) / 86400e3) + 1;
  const label = new Date(ms(d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dayNo = Math.round((ms(d) - ms(FIRST_DAY)) / 86400e3) + 1;
  const lines = [];
  if (intro) {
    lines.push('The 1001 login wall is on for all readers since 11:47 UTC today (18:47 WIB). '
      + 'These numbers will come here every morning at 08:05 WIB, 19-25 Oct, one message per day.', '');
  }
  lines.push(`1001 login wall, ${label} (UTC)${dayNo >= 1 && dayNo <= 7 ? `, day ${dayNo} of 7` : ''}`
    + `${d === FIRST_DAY ? ', wall on from 11:47' : ''}${intro ? ', so far' : ''}`);
  lines.push('');
  lines.push(`Hit the wall: ${n(first)} people for the first time (${n(w.view)} pages opened behind it)`);
  if (w.back) lines.push(`Of those, returning readers who got the card at once (no fresh 45 s): ${n(w.back)}`);
  lines.push(`Signed in from the wall: ${n(signin)} (${n(w.signup)} new accounts)`
    + (first ? `, ${Math.round((signin / first) * 100)}% of those who hit it` : ''));
  lines.push(`Left at the wall without signing in: about ${n(Math.max(first - signin, 0))}`);
  lines.push(`Accounts: ${n(total)} in total, ${n(fresh)} new this day`);
  /* My 1001 (dashboard slice 1): follows and sign-ins that started at a Follow button */
  try {
    const f = db.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM acct_follows WHERE date(created_at) = ?').get(d);
    const fu = db.prepare('SELECT COUNT(DISTINCT user_id) AS u FROM acct_follows WHERE date(created_at) <= ?').get(d);
    lines.push(`Follows: ${n(f.n)} new by ${n(f.u)} readers; ${n(fu.u)} of ${n(total)} accounts follow something`);
    lines.push(`Signed in from a Follow button: ${n(w.follow_signin)} (${n(w.follow_signup)} new accounts)`);
    const me = db.prepare(`SELECT COUNT(DISTINCT vid) AS n FROM px_view WHERE host = ? AND ts >= ? AND ts < ?
      AND (path = '/me' OR path = '/id/me')`).get(HOST, ms(d), ms(plusDays(d, 1)));
    lines.push(`Opened My 1001: ${n(me.n)} readers`);
  } catch { /* no follows table yet */ }
  /* the dashboard (views/dash1001.js): Ask 1001 and the lead agent's requests (coming soon) */
  try {
    const a = db.prepare(`SELECT COUNT(*) AS n, SUM(ok) AS ok, COALESCE(SUM(micro), 0) AS m FROM ask_log WHERE day = ?`).get(d);
    const au = db.prepare(`SELECT COUNT(*) AS u FROM ask_user_day WHERE day = ?`).get(d);
    if (a.n) {
      lines.push(`Ask 1001: ${n(a.n)} questions from ${n(au.u)} readers, ${n(a.n - (a.ok || 0))} without an answer, US$${(a.m / 1e6).toFixed(3)} of model time`);
    }
    const la = db.prepare(`SELECT kind, ref, COUNT(*) AS c FROM acct_lead_asks WHERE date(created_at) = ? GROUP BY kind, ref ORDER BY c DESC`).all(d);
    if (la.length) {
      const names = {};
      try { for (const c of JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'data', 'census.json'), 'utf8')).companies) names['company:' + c.id] = c.name; } catch { /* ids then */ }
      try { for (const e of JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'bumn-56.json'), 'utf8')).entities) names['bumn:' + e.slug] = e.short || e.name; } catch { /* ids then */ }
      const lu = db.prepare(`SELECT COUNT(DISTINCT user_id) AS u FROM acct_lead_asks WHERE date(created_at) = ?`).get(d);
      const early = la.filter((x) => !x.kind).reduce((t, x) => t + x.c, 0);
      const top = la.filter((x) => x.kind).slice(0, 5).map((x) => `${names[x.kind + ':' + x.ref] || x.ref} (${x.c})`).join(', ');
      lines.push(`Lead agent, coming soon: ${n(early)} asked for early access; contacts asked at ${n(la.filter((x) => x.kind).length)} companies by ${n(lu.u)} readers${top ? `: ${top}` : ''}`);
    }
  } catch { /* no dashboard tables yet */ }
  lines.push('');
  lines.push(`Readers: ${n(r.people)} people, ${one(r.people ? r.views / r.people : 0)} pages each`
    + ` (week before: ${n(base.people / days)} a day, ${one(base.people ? base.views / base.people : 0)} pages each)`);
  lines.push(`From Google: ${n(r.google)} people (week before: ${one(base.google / days)} a day)`);
  /* scraper check, slice 1 = watch only (lib/shield1001.js); its day is the Jakarta day */
  try {
    const sw = db.prepare(`SELECT rule, COUNT(*) AS a, SUM(short) AS s, SUM(signed_later) AS sl FROM shield_watch WHERE day = ? GROUP BY rule`).all(d);
    const anyRows = db.prepare(`SELECT 1 FROM shield_seen WHERE day = ? LIMIT 1`).get(d);
    if (sw.length || anyRows) {
      const by = Object.fromEntries(sw.map((x) => [x.rule, x.a]));
      const addrs = sw.reduce((t, x) => t + x.a, 0);
      const pages = sw.reduce((t, x) => t + (x.s || 0), 0);
      const signedOver = sw.reduce((t, x) => t + (x.sl || 0), 0);
      const parts = [['day', 'over 30 pages'], ['burst', 'over 20 in 5 min'], ['server', 'servers over 10'],
        ['claimed', 'named machines over 500'], ['preview', 'previews over 200']]
        .filter(([k]) => by[k]).map(([k, t]) => `${n(by[k])} ${t}`).join(', ');
      lines.push('');
      lines.push(`Scraper check, watch only (nobody is stopped yet; Jakarta day ${d})`);
      lines.push(`Would have stopped: ${n(addrs)} addresses${parts ? ` (${parts})` : ''}; ${n(pages)} pages would have been the short page`);
      lines.push(`Signed-in readers whose address was already over: ${n(signedOver)}`);
      const top = db.prepare(`SELECT ua, net, pages FROM shield_watch WHERE day = ? ORDER BY pages DESC LIMIT 3`).all(d);
      if (top.length) {
        lines.push('Biggest: ' + top.map((t) => `${(t.ua || 'no name').replace(/^Mozilla\/5\.0 /, '').slice(0, 48)}${t.net === 'dc' ? ' (server)' : ''}: ${n(t.pages)} pages`).join('; '));
      }
    }
  } catch { /* no shield tables yet */ }
  return lines.join('\n');
}

async function send(text) {
  let token = '';
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.openclaw', 'openclaw.json'), 'utf8'));
    token = String((cfg.channels && cfg.channels.telegram && cfg.channels.telegram.botToken) || '');
  } catch { /* reported below */ }
  if (!token) throw new Error('no Telegram bot token in ~/.openclaw/openclaw.json');
  let res;
  try {
    res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(15e3),
    });
  } catch (e) {
    /* never let a network error print the request URL (it holds the token) */
    throw new Error('telegram unreachable: ' + (e && e.name) + (e && e.cause && e.cause.code ? ' ' + e.cause.code : ''));
  }
  if (!res.ok) throw new Error('telegram HTTP ' + res.status);
}

(async () => {
  const text = report(day);
  console.log(text);
  if (dry) return;
  await send(text);
  console.log(`sent ${new Date().toISOString()}`);
})().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
