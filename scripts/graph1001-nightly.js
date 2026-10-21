#!/usr/bin/env node
'use strict';
/**
 * 1001 company graph, nightly (Luca, 21 Oct 2026: "add a nightly rebuild of the 1001
 * graph (graph1001-build.js in the live checkout, no restart), and tell me in Telegram
 * only when it finds new name matches to review"). The systemd user timer
 * graph1001-nightly.timer runs it at 19:30 UTC (02:30 WIB).
 *
 *   node scripts/graph1001-nightly.js     rebuild, then one Telegram DM to Luca if the
 *                                         report has name matches he has not been sent yet
 *   --dry                                 print the message instead of sending it; the
 *                                         sent-list is left alone
 *   --dry --report <file> --state <file>  try the message on a saved report without
 *                                         rebuilding (the sent-list is <file>)
 *
 * The rebuild is scripts/graph1001-build.js: it writes data/graph1001.json in one move and
 * Ask 1001 re-reads it by mtime, so nothing restarts. Its report lists the name and
 * website matches nobody has reviewed (candidates); none is ever merged until it is
 * decided in data/graph1001-aliases.json. data/graph1001-told.json keeps the matches
 * already sent, so each one is sent once; a decided match leaves the report and the list.
 * A failed build keeps last night's graph, exits 1 and sends nothing: see
 * journalctl --user -u graph1001-nightly. The bot token is read at send time from
 * ~/.openclaw/openclaw.json and never printed or stored.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const opt = (k) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : null; };
const GIVEN_REPORT = opt('--report');
const REPORT = GIVEN_REPORT || path.join(ROOT, 'data', 'graph1001-report.json');
const STATE = opt('--state') || path.join(ROOT, 'data', 'graph1001-told.json');
const CHAT_ID = '841222912';             // Luca's DM with the OpenClaw bot
const SHOW = 12;                         // matches listed in one message; the rest are counted

const WHAT = { s: 'startup', i: 'investor', c: 'chain company', b: 'BUMN', u: 'BUMN subsidiary', w: 'data-centre web', n: 'network', e: 'exporter', k: 'named in a link' };
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const say = (s) => console.log(`graph1001 nightly ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}: ${s}`);

function rebuild() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'graph1001-build.js')], { cwd: ROOT, encoding: 'utf8', timeout: 180e3, maxBuffer: 32e6 });
  if (r.error || r.status !== 0) {
    const why = r.error ? r.error.message : `exit ${r.status}${r.signal ? ' ' + r.signal : ''}`;
    const tail = String(r.stderr || '').trim().split('\n').slice(-5).join(' | ');
    throw new Error(`build failed (${why}); last night's graph is kept. ${tail}`);
  }
}

function readState() {
  try { const s = JSON.parse(fs.readFileSync(STATE, 'utf8')); return s && typeof s.told === 'object' ? s : { told: {} }; } catch { return { told: {} }; }
}
function writeState(s) {
  fs.writeFileSync(STATE + '.tmp', JSON.stringify(s, null, 1));
  fs.renameSync(STATE + '.tmp', STATE);
}

const who = (ref, name) => `${name} (${WHAT[ref[0]] || 'record'}, ${ref})`;
function message(fresh, report, open) {
  const lines = [`1001 company graph: ${fresh.length} new name ${fresh.length === 1 ? 'match' : 'matches'} to review after tonight's rebuild. Nothing is merged until you decide.`, ''];
  fresh.slice(0, SHOW).forEach((c, i) => lines.push(`${i + 1}. ${who(c.a, c.an)} = ${who(c.b, c.bn)}? ${c.why.join('; ')}`));
  if (fresh.length > SHOW) lines.push(`+${fresh.length - SHOW} more in the report`);
  if (open > fresh.length) lines.push(`${open - fresh.length} older ${open - fresh.length === 1 ? 'match is' : 'matches are'} still open too.`);
  const missing = ((report.merged_by_alias_list || {}).missing_refs || []);
  if (missing.length) lines.push(`Also: ${missing.length} reviewed ${missing.length === 1 ? 'record no longer exists' : 'records no longer exist'} (renamed or removed): ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ', ...' : ''}`);
  lines.push('', 'Decide each in data/graph1001-aliases.json (same / apart / not_same), then run node scripts/graph1001-build.js. Full list: data/graph1001-report.json.');
  return lines.join('\n').slice(0, 4000);
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
  if (!GIVEN_REPORT) rebuild();
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const cands = Array.isArray(report.candidates) ? report.candidates : [];
  const key = (c) => c.a + '|' + c.b;
  const state = readState();
  const fresh = cands.filter((c) => !state.told[key(c)]);
  const missing = ((report.merged_by_alias_list || {}).missing_refs || []).length;
  say(`${fmt(report.nodes)} ids, ${fmt(report.edges)} links, ${fmt(report.in_two_or_more_datasets)} companies in 2+ datasets, ${cands.length} open name matches (${fresh.length} new), ${missing} reviewed records missing`);
  /* a decided match leaves the report: forget it, so it counts as new if it ever comes back */
  const told = {};
  for (const c of cands) if (state.told[key(c)]) told[key(c)] = state.told[key(c)];
  if (fresh.length) {
    const text = message(fresh, report, cands.length);
    if (DRY) console.log('--- would send ---\n' + text + '\n---');
    else { await send(text); say(`sent ${fresh.length} new name matches to Luca`); }
    const today = new Date().toISOString().slice(0, 10);
    for (const c of fresh) told[key(c)] = today;
  }
  if (!DRY || opt('--state')) writeState({ told, last_run: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), open: cands.length });
})().catch((e) => { say(String(e && e.message || e)); process.exit(1); });
