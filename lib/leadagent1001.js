'use strict';
/**
 * 1001startup.id — the lead agent inside Ask 1001: people at a company, and
 * their work email on request (Luca, 26 Oct 2026: "focus on people search so
 * i can ask question to get the leads in 1001startup.id"). Only for the
 * accounts listed in data/leadagent.live; every other reader keeps the chat
 * where contact details are "coming soon".
 *
 *   const leads = require('./lib/leadagent1001')({ db, log, alert });
 *   leads.allowed(userId)                       -> true while data/leadagent.live lists the id
 *   await leads.find(userId, { domain, company, companyId, titles, location, limit })
 *   await leads.reveal(userId, { refs, names, company })
 *   leads.list(userId) / leads.csv(userId)      -> the saved leads (/me/leads)
 *
 * The data comes through Firecrawl's provider calls (POST /v2/scrape with an
 * `alexandria` call list; key FIRECRAWL_API_KEY in .env, read from
 * process.env). Prices as Firecrawl listed them on 26 Oct 2026:
 *   find    Apollo people/search, free: first name, a masked surname, title,
 *           whether an email exists. When Apollo refuses (its terms are not
 *           accepted for the team) or finds no one, FullEnrich people/search:
 *           5 credits a person returned (full name, LinkedIn), 5 at most.
 *   reveal  Apollo people/match for an Apollo person (30 credits when it
 *           matches), FullEnrich contacts/work-email for a FullEnrich person
 *           (listed at 20, billed 30 with a LinkedIn URL; nothing when no
 *           email is found). 3 people a call, up to 100 s.
 * The same search within a week is answered from the saved list (free).
 * Spend stops at DAY_CAP credits a UTC day (LEADS_DAY_CREDITS, default 100),
 * counted from what Firecrawl reports for each call (lead_calls). A person is
 * revealed once: the email, or the fact that none was found, is kept, so
 * asking again costs nothing. Provider names never reach the model or a page.
 *
 * Switch: data/leadagent.live holds the allowed account ids, one per line (# for
 * a note). rm it and the chat is the reader chat again within 10 s, no
 * restart. Nothing here throws to the caller: every failure is a calm result.
 */
const fs = require('fs');
const path = require('path');

const API = 'https://api.firecrawl.dev';
/* credits, worst case per person. FullEnrich's work email is listed at 20 but
   billed 30 with a LinkedIn URL (measured 26 Oct 2026), so it is budgeted at 30. */
const PRICE = { find_f: 5, reveal_a: 30, reveal_f: 30 };
const REVEAL_MAX = 3;
const FIND_MAX = 10;
const FIND_F_MAX = 5;
/* An email lookup can take most of a minute, and Firecrawl bills a call we gave up
   on (measured 26 Oct: a 40 s timeout was charged, then the retry again). So a
   reveal waits up to 100 s, a timed-out one is counted as charged, and that
   person is not looked up again for RETRY_MIN minutes. */
const FIND_MS = 45e3;
const REVEAL_MS = 100e3;
const RETRY_MIN = 15;
const SEARCH_DAYS = 7;   // the same search again within a week comes from the list, free
const LOW_BALANCE = 100;

const str = (v) => (v === undefined || v === null ? '' : String(v));
const norm = (s) => str(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9*]+/g, ' ').trim();
const clip = (s, n) => { const t = str(s).replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* "https://www.xendit.co/en" -> "xendit.co" */
function domainOf(u) {
  const s = str(u).trim().toLowerCase();
  if (!s) return '';
  try { return new URL(/^[a-z]+:\/\//.test(s) ? s : 'https://' + s).hostname.replace(/^www\./, ''); } catch { return ''; }
}

module.exports = function createLeads({
  db,
  root = path.join(__dirname, '..'),
  log = () => {},
  alert = () => {},
  dayCap = +(process.env.LEADS_DAY_CREDITS || 100),
  fetchImpl = (...a) => fetch(...a),
  findMs = FIND_MS,
  revealMs = REVEAL_MS,
} = {}) {
  const say = (...a) => { try { log(...a); } catch { /* a logger must never break a run */ } };

  db.exec(`
CREATE TABLE IF NOT EXISTS lead_people (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  src TEXT NOT NULL,
  ext_id TEXT NOT NULL,
  company_id TEXT,
  company TEXT,
  domain TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  title TEXT,
  location TEXT,
  linkedin TEXT,
  has_email INTEGER,
  email TEXT,
  email_status TEXT,
  ask TEXT,
  found_at TEXT NOT NULL DEFAULT (datetime('now')),
  seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  revealed_at TEXT,
  tried_at TEXT,
  credits INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, src, ext_id)
);
CREATE INDEX IF NOT EXISTS idx_lead_people_user ON lead_people(user_id, seen_at);
CREATE TABLE IF NOT EXISTS lead_searches (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  ids TEXT NOT NULL,
  total INTEGER,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, key)
);
CREATE TABLE IF NOT EXISTS lead_calls (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL DEFAULT (datetime('now')),
  day TEXT NOT NULL DEFAULT (date('now')),
  user_id INTEGER,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  credits INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_lead_calls_day ON lead_calls(day);
`);
  if (!db.prepare('PRAGMA table_info(lead_people)').all().some((c) => c.name === 'tried_at')) db.exec('ALTER TABLE lead_people ADD COLUMN tried_at TEXT');
  const Q = {
    upsert: db.prepare(`INSERT INTO lead_people (user_id, src, ext_id, company_id, company, domain, first_name, last_name, full_name, title, location, linkedin, has_email, ask)
      VALUES (@user_id, @src, @ext_id, @company_id, @company, @domain, @first_name, @last_name, @full_name, @title, @location, @linkedin, @has_email, @ask)
      ON CONFLICT(user_id, src, ext_id) DO UPDATE SET
        company_id = COALESCE(excluded.company_id, company_id), company = COALESCE(excluded.company, company),
        domain = COALESCE(excluded.domain, domain), title = COALESCE(excluded.title, title),
        location = COALESCE(excluded.location, location), linkedin = COALESCE(linkedin, excluded.linkedin),
        first_name = COALESCE(first_name, excluded.first_name),
        last_name = CASE WHEN revealed_at IS NULL THEN excluded.last_name ELSE last_name END,
        full_name = CASE WHEN revealed_at IS NULL THEN excluded.full_name ELSE full_name END,
        has_email = COALESCE(excluded.has_email, has_email), ask = COALESCE(excluded.ask, ask), seen_at = datetime('now')
      RETURNING id, email, email_status, revealed_at, full_name, linkedin`),
    byIds: db.prepare(`SELECT * FROM lead_people WHERE user_id = ? AND id IN (SELECT value FROM json_each(?))`),
    recent: db.prepare(`SELECT * FROM lead_people WHERE user_id = ? ORDER BY seen_at DESC, id DESC LIMIT 400`),
    reveal: db.prepare(`UPDATE lead_people SET email = @email, email_status = @email_status, linkedin = COALESCE(@linkedin, linkedin),
      full_name = COALESCE(@full_name, full_name), last_name = COALESCE(@last_name, last_name), title = COALESCE(@title, title),
      revealed_at = datetime('now'), credits = credits + @credits WHERE id = @id`),
    tried: db.prepare(`UPDATE lead_people SET tried_at = datetime('now') WHERE id IN (SELECT value FROM json_each(?))`),
    searchGet: db.prepare(`SELECT ids, total FROM lead_searches WHERE user_id = ? AND key = ? AND at > datetime('now', ?)`),
    searchPut: db.prepare(`INSERT INTO lead_searches (user_id, key, ids, total) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, key) DO UPDATE SET ids = excluded.ids, total = excluded.total, at = datetime('now')`),
    list: db.prepare(`SELECT * FROM lead_people WHERE user_id = ? ORDER BY COALESCE(revealed_at, seen_at) DESC, id DESC`),
    usedToday: db.prepare(`SELECT COALESCE(SUM(credits), 0) AS c FROM lead_calls WHERE day = date('now')`),
    logCall: db.prepare(`INSERT INTO lead_calls (user_id, kind, n, credits, ok, note) VALUES (?, ?, ?, ?, ?, ?)`),
  };
  const logCall = (u, kind, n, credits, ok, note) => { try { Q.logCall.run(u, kind, n, credits | 0, ok ? 1 : 0, note ? clip(note, 200) : null); } catch { /* the log must never cost the answer */ } };
  const usedToday = () => { try { return Q.usedToday.get().c | 0; } catch { return dayCap; } };

  /* ── who may use it: data/leadagent.live, re-read at most every 10 s ── */
  const FLAG = process.env.LEADAGENT_FILE_1001 || path.join(root, 'data', 'leadagent.live');
  let flagAt = 0;
  let ids = new Set();
  function allowed(userId) {
    if (Date.now() - flagAt > 10e3) {
      flagAt = Date.now();
      try {
        ids = new Set(fs.readFileSync(FLAG, 'utf8').split('\n').map((l) => l.replace(/#.*/, '').trim()).filter((l) => /^\d+$/.test(l)).map(Number));
      } catch { ids = new Set(); }
    }
    return Number.isInteger(userId) && ids.has(userId);
  }

  /* ── Firecrawl: one /v2/scrape request carrying up to 10 provider calls ── */
  async function call(calls, ms = findMs) {
    const key = process.env.FIRECRAWL_API_KEY || '';
    if (!key) { say('leadagent1001: no FIRECRAWL_API_KEY'); return { ok: false, code: 'nokey', items: [] }; }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ms);
    const t = Date.now();
    try {
      const res = await fetchImpl(API + '/v2/scrape', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' },
        body: JSON.stringify({ alexandria: calls }),
        signal: ac.signal,
      });
      let j = null;
      try { j = await res.json(); } catch { j = null; }
      if (!res.ok || !j || !j.success) {
        const msg = str(j && j.error) || `HTTP ${res.status}`;
        const code = (j && j.code === 'THIRD_PARTY_DATA_TERMS_REQUIRED') || /terms/i.test(msg) ? 'terms'
          : res.status === 402 || /insufficient credits|out of credits/i.test(msg) ? 'credits'
            : res.status === 429 ? 'rate' : 'upstream';
        say(`leadagent1001: ${calls.map((c) => c.provider + '/' + c.capability).join(',')} -> ${code} (${res.status}) in ${Date.now() - t} ms`);
        return { ok: false, code, items: [] };
      }
      const items = (j.data && Array.isArray(j.data.alexandria)) ? j.data.alexandria : [];
      return { ok: true, items, credits: (j.data && j.data.creditsCost) | 0, ms: Date.now() - t };
    } catch (e) {
      const code = ac.signal.aborted ? 'timeout' : 'upstream';
      say(`leadagent1001: request ${code} after ${Date.now() - t} ms`);
      return { ok: false, code, items: [] };
    } finally {
      clearTimeout(timer);
    }
  }

  /* the balance for the leads page and the low-credit alert (free call, kept 5 min) */
  let bal = { at: 0, left: null, plan: null, ends: '' };
  let alertedDay = '';
  async function balance(fresh = false) {
    if (!fresh && Date.now() - bal.at < 300e3) return bal;
    const key = process.env.FIRECRAWL_API_KEY || '';
    if (!key) return bal;
    try {
      const r = await fetchImpl(API + '/v2/team/credit-usage', { headers: { authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(10e3) });
      const j = await r.json();
      if (j && j.success && j.data) bal = { at: Date.now(), left: j.data.remainingCredits, plan: j.data.planCredits, ends: str(j.data.billingPeriodEnd).slice(0, 10) };
    } catch { /* the last reading stays */ }
    const day = new Date().toISOString().slice(0, 10);
    if (typeof bal.left === 'number' && bal.left < LOW_BALANCE && alertedDay !== day) {
      alertedDay = day;
      try { alert(`1001 lead agent: ${bal.left} people-search credits left this month (renews ${bal.ends}).`); } catch { /* never breaks a run */ }
    }
    return bal;
  }

  /* ── a person as the model sees it ── */
  function shown(r) {
    const name = r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ');
    const o = { ref: 'p' + r.id, name, title: r.title || undefined, company: r.company || undefined, location: r.location || undefined };
    if (r.email) { o.email = r.email; o.email_status = r.email_status || undefined; }
    else if (r.revealed_at) o.email = 'none found';
    else if (r.has_email === 1) o.email = 'can be revealed';
    else if (r.has_email === 0) o.email = 'none on record';
    if (r.linkedin) o.linkedin = 'on the leads list';
    return o;
  }

  function personA(p) {
    const org = p.organization || {};
    return {
      ext_id: str(p.id), first_name: str(p.first_name) || null, last_name: str(p.last_name || p.last_name_obfuscated) || null,
      full_name: null, title: clip(p.title, 160) || null,
      location: [p.city, p.country].filter(Boolean).join(', ') || null,
      linkedin: str(p.linkedin_url) || null,
      has_email: p.has_email === true ? 1 : p.has_email === false ? 0 : null,
      company: str(org.name) || null, domain: domainOf(org.primary_domain || org.website_url) || null,
    };
  }
  function personF(p) {
    const cur = (p.employment && p.employment.current) || {};
    const co = cur.company || {};
    const loc = p.location || {};
    const sp = (p.social_profiles && p.social_profiles.professional_network) || {};
    return {
      ext_id: str(p.id), first_name: str(p.first_name) || null, last_name: str(p.last_name) || null,
      full_name: str(p.full_name) || null, title: clip(cur.title || p.headline, 160) || null,
      location: [loc.city, loc.country].filter(Boolean).join(', ') || null,
      linkedin: str(sp.url) || null, has_email: null,
      company: str(co.name) || null, domain: domainOf(co.domain || co.website) || null,
    };
  }

  /**
   * People at one company. `domain` narrows best (a census row's own site);
   * without it the company name is matched. titles: role words, several
   * widen the net. location: a country or city, default Indonesia; 'any' =
   * everywhere.
   */
  async function find(userId, { domain = '', company = '', companyId = null, titles = [], location = 'Indonesia', limit = 8 } = {}) {
    const dom = domainOf(domain);
    const name = clip(company, 80);
    if (!dom && !name) return { ok: false, error: 'Name a company (or its website domain).' };
    const T = (Array.isArray(titles) ? titles : [titles]).map((t) => clip(t, 60)).filter(Boolean).slice(0, 6);
    const loc = /^(any|anywhere|all|global|worldwide)$/i.test(str(location).trim()) ? '' : clip(location || 'Indonesia', 60);
    const n = Math.max(1, Math.min(FIND_MAX, parseInt(limit, 10) || 8));
    const ask = T.join(', ') || null;

    /* 0. the same search this week: the people it found, from the list */
    const key = [dom || norm(name), T.map(norm).sort().join('|'), norm(loc)].join('#');
    try {
      const hit = Q.searchGet.get(userId, key, `-${SEARCH_DAYS} days`);
      const order = hit ? JSON.parse(hit.ids) : [];
      const got = order.length ? Q.byIds.all(userId, JSON.stringify(order)).sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id)) : [];
      if (got.length) {
        return { ok: true, total: hit.total || got.length, people: got.map(shown), credits_used: 0, credits_left_today: Math.max(0, dayCap - usedToday()),
          note: 'Same search as earlier this week: these come from the leads list, no credits used.' };
      }
    } catch { /* search again */ }

    /* 1. the free preview */
    const a = await call([{ provider: 'apollo', capability: 'people/search', options: {
      ...(dom ? { q_organization_domains_list: [dom] } : { q_keywords: name }),
      ...(T.length ? { person_titles: T } : {}),
      ...(loc ? { person_locations: [loc] } : {}),
      page: 1, per_page: n,
    } }]);
    const ai = a.ok ? a.items[0] : null;
    let rows = [];
    let via = '';
    let total = null;
    let credits = 0;
    if (ai && !ai.error && ai.data) {
      const ppl = Array.isArray(ai.data.people) ? ai.data.people : [];
      total = ai.data.total_entries || (ai.data.pagination && ai.data.pagination.total_entries) || null;
      credits += ai.creditsCost | 0;
      rows = ppl.slice(0, n).map((p) => ({ src: 'a', ...personA(p) }));
      via = 'a';
      logCall(userId, 'find', rows.length, ai.creditsCost | 0, 1, `${dom || name} · ${ask || ''}`);
    } else {
      logCall(userId, 'find', 0, 0, 0, `preview ${a.ok ? (ai && ai.error && ai.error.code) || 'empty' : a.code}`);
    }

    /* 2. no one in the preview (or it refused): the paid search, inside the day's cap */
    let capped = false;
    if (!rows.length) {
      const room = Math.floor((dayCap - usedToday()) / PRICE.find_f);
      const m = Math.min(n, FIND_F_MAX, room);
      if (m < 1) capped = true;
      else {
        const f = await call([{ provider: 'fullenrich', capability: 'people/search', options: {
          limit: m,
          ...(dom ? { current_company_domains: [{ value: dom, exact_match: true }] } : { current_company_names: [{ value: name }] }),
          ...(T.length ? { current_position_titles: T.map((v) => ({ value: v })) } : {}),
          ...(loc ? { person_locations: [{ value: loc }] } : {}),
        } }]);
        const fi = f.ok ? f.items[0] : null;
        if (fi && !fi.error && fi.data) {
          const ppl = Array.isArray(fi.data.people) ? fi.data.people : [];
          total = (fi.data.metadata && fi.data.metadata.total) || total;
          credits += fi.creditsCost | 0;
          rows = ppl.slice(0, m).map((p) => ({ src: 'f', ...personF(p) }));
          via = 'f';
          logCall(userId, 'find', rows.length, fi.creditsCost | 0, 1, `${dom || name} · ${ask || ''}`);
        } else {
          /* a search we gave up on may still be billed: count the worst case */
          logCall(userId, 'find', 0, !f.ok && f.code === 'timeout' ? m * PRICE.find_f : (fi && fi.creditsCost) | 0, 0, `search ${f.ok ? (fi && fi.error && fi.error.code) || 'empty' : f.code}`);
          if (!f.ok && f.code === 'credits') return { ok: false, error: 'The lead agent is out of credits for this month.' };
          if (!a.ok && !f.ok) return { ok: false, error: 'People search is not answering right now. Try again in a minute.' };
        }
      }
    }

    const people = [];
    for (const r of rows) {
      if (!r.ext_id) continue;
      try {
        const saved = Q.upsert.get({ user_id: userId, src: r.src, ext_id: r.ext_id, company_id: companyId || null,
          company: r.company || name || null, domain: r.domain || dom || null, first_name: r.first_name, last_name: r.last_name,
          full_name: r.full_name, title: r.title, location: r.location, linkedin: r.linkedin, has_email: r.has_email, ask });
        people.push(shown({ ...r, ...saved, id: saved.id, has_email: r.has_email, company: r.company || name }));
      } catch (e) { say(`leadagent1001: save failed: ${e && e.message}`); }
    }
    if (people.length) { try { Q.searchPut.run(userId, key, JSON.stringify(people.map((p) => +p.ref.slice(1))), total || people.length); } catch { /* the next search just pays again */ } }
    if (credits) balance(true).catch(() => {});
    return {
      ok: true, total: total || people.length, people, credits_used: credits,
      credits_left_today: Math.max(0, dayCap - usedToday()),
      ...(capped ? { note: 'Today\'s credit limit for people search is reached; free results only until tomorrow (UTC).' } : {}),
      ...(via === 'a' && people.some((p) => /\*/.test(p.name)) ? { masked: 'Surnames with * are hidden until get_contact reveals the person.' } : {}),
    };
  }

  /* people saved earlier for this reader, by ref ("p12") or by the name the chat showed */
  function pick(userId, { refs = [], names = [], company = '' } = {}) {
    const want = [];
    const idList = (Array.isArray(refs) ? refs : [refs]).map((r) => parseInt(str(r).replace(/^#?p/i, ''), 10)).filter((x) => x > 0);
    if (idList.length) for (const r of Q.byIds.all(userId, JSON.stringify(idList))) want.push(r);
    const co = norm(company);
    const pool = Q.recent.all(userId).filter((r) => !co || norm(r.company).includes(co) || co.includes(norm(r.company)) || norm(r.domain).startsWith(co.replace(/ /g, '')));
    for (const nm of (Array.isArray(names) ? names : [names]).map(norm).filter(Boolean)) {
      const [first, ...rest] = nm.split(' ');
      const last = rest.join(' ').replace(/\*/g, '').trim();
      const hit = pool.find((r) => {
        const full = norm(r.full_name || [r.first_name, r.last_name].join(' '));
        if (full === nm) return true;
        if (norm(r.first_name) !== first) return false;
        if (!last) return true;
        const rl = norm(r.last_name).replace(/\*/g, '').trim();
        return !rl || rl.startsWith(last) || last.startsWith(rl);
      });
      if (hit) want.push(hit);
    }
    const seen = new Set();
    return want.filter((r) => (seen.has(r.id) ? false : seen.add(r.id)));
  }

  /** Work email (and LinkedIn) for up to 3 people found earlier. */
  async function reveal(userId, args = {}) {
    const rows = pick(userId, args);
    if (!rows.length) return { ok: false, error: 'None of those people are on the leads list yet: find them with find_people first.' };
    const out = [];
    const todo = [];
    const held = (r) => r.tried_at && Date.now() - Date.parse(r.tried_at.replace(' ', 'T') + 'Z') < RETRY_MIN * 60e3;
    for (const r of rows.slice(0, REVEAL_MAX)) {
      if (r.email || r.revealed_at) out.push({ ...shown(r), note: 'revealed before, no credits used' });
      else if (held(r)) out.push({ ...shown(r), note: `a lookup for this person ran in the last ${RETRY_MIN} minutes and did not finish; it may still be charged, so it is not repeated yet. Ask again later.` });
      else todo.push(r);
    }
    const skipped = rows.length > REVEAL_MAX ? rows.slice(REVEAL_MAX).map((r) => 'p' + r.id) : [];
    let room = dayCap - usedToday();
    const go = [];
    const capped = [];
    for (const r of todo) {
      const cost = r.src === 'a' ? PRICE.reveal_a : PRICE.reveal_f;
      if (cost <= room) { go.push(r); room -= cost; } else capped.push(r);
    }
    let credits = 0;
    if (go.length) {
      const calls = go.map((r) => (r.src === 'a'
        ? { provider: 'apollo', capability: 'people/match', options: { id: r.ext_id } }
        : { provider: 'fullenrich', capability: 'contacts/work-email', options: r.linkedin ? { linkedin_url: r.linkedin }
          : { first_name: r.first_name, last_name: r.last_name, ...(r.domain ? { domain: r.domain } : { company_name: r.company }) } }));
      try { Q.tried.run(JSON.stringify(go.map((r) => r.id))); } catch { /* the hold is a guard, not the record */ }
      const res = await call(calls, revealMs);
      if (!res.ok) {
        /* a request we gave up on may still be billed: count the worst case */
        const worst = res.code === 'timeout' ? go.reduce((s, r) => s + (r.src === 'a' ? PRICE.reveal_a : PRICE.reveal_f), 0) : 0;
        logCall(userId, 'reveal', go.length, worst, 0, res.code === 'timeout' ? 'timeout, counted as charged' : res.code);
        if (res.code === 'credits') return { ok: false, error: 'The lead agent is out of credits for this month.' };
        if (res.code === 'timeout') return { ok: false, error: `The email lookup took too long and may still be charged, so these people are not looked up again for ${RETRY_MIN} minutes. Do not call get_contact again now; tell the reader to ask again later.` };
        return { ok: false, error: 'Contact lookup is not answering right now. Do not call get_contact again now; tell the reader to try again in a minute.' };
      }
      go.forEach((r, i) => {
        const it = res.items[i] || {};
        const cost = it.creditsCost | 0;
        credits += cost;
        if (it.error) { out.push({ ...shown(r), note: 'the lookup failed, nothing charged; try again later' }); return; }
        const d = it.data || {};
        let upd = { id: r.id, email: null, email_status: null, linkedin: null, full_name: null, last_name: null, title: null, credits: cost };
        if (r.src === 'a') {
          const p = d.person || d.match || null;
          if (p) {
            upd = { ...upd, email: str(p.email) || null, email_status: str(p.email_status) || null, linkedin: str(p.linkedin_url) || null,
              full_name: str(p.name) || null, last_name: str(p.last_name) || null, title: clip(p.title, 160) || null };
          }
        } else {
          const x = Array.isArray(d.results) ? d.results[0] : null;
          const ci = (x && x.contact_info) || {};
          const mp = ci.most_probable_work_email;
          const email = typeof mp === 'string' ? mp : (mp && (mp.email || mp.value)) || '';
          upd = { ...upd, email: str(email) || null, email_status: str(mp && typeof mp === 'object' && (mp.status || mp.email_status)) || null };
          const prof = x && x.profile;
          const sp = prof && prof.social_profiles && prof.social_profiles.professional_network;
          if (sp && sp.url) upd.linkedin = str(sp.url);
        }
        try { Q.reveal.run(upd); } catch (e) { say(`leadagent1001: reveal save failed: ${e && e.message}`); }
        const after = { ...r, ...Object.fromEntries(Object.entries(upd).filter(([, v]) => v !== null)), revealed_at: 'now' };
        out.push({ ...shown(after), credits_used: cost });
      });
      logCall(userId, 'reveal', go.length, credits, 1, go.map((r) => 'p' + r.id).join(','));
      balance(true).catch(() => {});
    }
    for (const r of capped) out.push({ ...shown(r), note: 'not revealed: today\'s credit limit is reached (resets 00:00 UTC)' });
    return {
      ok: true, people: out, credits_used: credits, credits_left_today: Math.max(0, dayCap - usedToday()),
      ...(skipped.length ? { not_done: skipped, hint: `At most ${REVEAL_MAX} people per call.` } : {}),
    };
  }

  /* ── the saved list (/me/leads) ── */
  function list(userId) {
    try { return Q.list.all(userId); } catch { return []; }
  }
  function csv(userId) {
    const cell = (v) => {
      let s = str(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;   /* a spreadsheet never runs a cell as a formula */
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const head = ['name', 'title', 'company', 'domain', 'email', 'email_status', 'linkedin', 'location', 'role_asked', 'found_utc', 'revealed_utc'];
    const lines = [head.join(',')];
    for (const r of list(userId)) {
      lines.push([r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' '), r.title, r.company, r.domain, r.email || (r.revealed_at ? 'none found' : ''),
        r.email_status, r.linkedin, r.location, r.ask, r.found_at, r.revealed_at].map(cell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  return { allowed, find, reveal, list, csv, balance, usedToday, dayCap, _t: { call, pick, domainOf, norm, shown } };
};
