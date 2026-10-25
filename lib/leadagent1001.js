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
 * Finding people (Luca, 26 Oct 2026, on a weak Blibli answer: "try to compare
 * with exa"; measured the same day: Exa returned 10 Xendit partnership people
 * for US$0.007 where FullEnrich returned 5 for 25 credits):
 *   find    Exa people search first (EXA_API_KEY; ~US$0.007 a search, at most
 *           LEADS_DAY_EXA a UTC day, default 60): LinkedIn profiles with their
 *           work history, kept only when a CURRENT job is at the company asked
 *           about (a namesake or a former employee is dropped). An email the
 *           person published on their own profile is kept for free. When Exa
 *           finds no one, Firecrawl's provider calls (POST /v2/scrape with an
 *           `alexandria` call list; key FIRECRAWL_API_KEY): Apollo people/search,
 *           free (first name, a masked surname) once its terms are accepted, then
 *           FullEnrich people/search, 5 credits a person returned, 5 at most.
 *           For a leadership question (CEO, founders, C-level...) the founders
 *           1001's census lists for the company come too, free: LinkedIn search
 *           is weakest exactly there (it missed Blibli's CEO on 26 Oct).
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
const EXA = 'https://api.exa.ai/search';
const EXA_MS = 25e3;
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
/* a question about the people at the top: the census founders come with the search */
const TOP_RE = /\b(ceo|cto|cfo|coo|cmo|cpo|cio|chro|chief|c[\s-]?level|c[\s-]?suite|cxo|founders?|co[\s-]?founders?|president|presiden|direktur|direksi|board|owner|pimpinan|leadership|executives?|boss)\b/i;
/* personal mailboxes: never shown, the lead agent offers work email only */
const FREEMAIL = /@(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|mac|aol|proton|protonmail|gmx|mail|yandex|qq|163|126|zoho)\./i;

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
  exaDayMax = +(process.env.LEADS_DAY_EXA || 60),
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
  /* which service a call went to ('exa' or NULL = Firecrawl) and its US$ cost (Exa bills dollars, not credits) */
  const callCols = new Set(db.prepare('PRAGMA table_info(lead_calls)').all().map((c) => c.name));
  if (!callCols.has('via')) db.exec('ALTER TABLE lead_calls ADD COLUMN via TEXT');
  if (!callCols.has('usd')) db.exec('ALTER TABLE lead_calls ADD COLUMN usd REAL NOT NULL DEFAULT 0');
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
    exaToday: db.prepare(`SELECT COUNT(*) AS n FROM lead_calls WHERE day = date('now') AND via = 'exa'`),
    profileEmail: db.prepare(`UPDATE lead_people SET email = ?, email_status = 'listed on their profile' WHERE id = ? AND email IS NULL`),
    /* the same LinkedIn profile, found before through another search: one person, one row */
    byProfile: db.prepare(`SELECT * FROM lead_people WHERE user_id = ? AND lower(linkedin) LIKE ? ORDER BY (email IS NOT NULL) DESC, id LIMIT 1`),
    /* or the same full name at the same company (a second profile, or a census founder found by a search) */
    byName: db.prepare(`SELECT * FROM lead_people WHERE user_id = ? AND lower(full_name) = lower(?) AND (company_id = ? OR domain = ?) ORDER BY (email IS NOT NULL) DESC, id LIMIT 1`),
    touch: db.prepare(`UPDATE lead_people SET title = COALESCE(?, title), location = COALESCE(?, location), linkedin = COALESCE(linkedin, ?), company_id = COALESCE(company_id, ?), seen_at = datetime('now') WHERE id = ?`),
    logCall: db.prepare(`INSERT INTO lead_calls (user_id, kind, n, credits, ok, note, via, usd) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
  };
  const logCall = (u, kind, n, credits, ok, note, via = null, usd = 0) => { try { Q.logCall.run(u, kind, n, credits | 0, ok ? 1 : 0, note ? clip(note, 200) : null, via, +usd || 0); } catch { /* the log must never cost the answer */ } };
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

  /* ── Exa people search: LinkedIn profiles with their work history ── */
  async function exa(query, n) {
    const key = process.env.EXA_API_KEY || '';
    if (!key) return { ok: false, code: 'nokey', results: [] };
    const t = Date.now();
    try {
      const res = await fetchImpl(EXA, {
        method: 'POST',
        headers: { 'x-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({ query, category: 'people', type: 'auto', numResults: n, contents: { text: { maxCharacters: 1500 } } }),
        signal: AbortSignal.timeout(EXA_MS),
      });
      let j = null;
      try { j = await res.json(); } catch { j = null; }
      if (!res.ok || !j || !Array.isArray(j.results)) {
        say(`leadagent1001: exa -> ${res.status} in ${Date.now() - t} ms`);
        return { ok: false, code: res.status === 402 ? 'credits' : res.status === 429 ? 'rate' : 'upstream', results: [] };
      }
      return { ok: true, results: j.results, usd: +((j.costDollars && j.costDollars.total) || 0) };
    } catch (e) {
      say(`leadagent1001: exa request failed after ${Date.now() - t} ms`);
      return { ok: false, code: 'timeout', results: [] };
    }
  }

  /* Does a company name from a profile mean the company asked about? Whole words
     ("Xendit Group" is Xendit), or the run-together form for longer names
     ("KopiKenangan"); legal words (PT, Tbk...) never count. */
  const LEGAL = /\b(pt|tbk|persero|cv|pte|ltd|limited|inc|corp|corporation|company|co|group|indonesia|id|com)\b/g;
  function wants(names) {
    return [...new Set(names.map((x) => norm(x).replace(/\*/g, '').replace(LEGAL, ' ').replace(/\s+/g, ' ').trim()).filter((x) => x.length >= 3))];
  }
  function sameCompany(coName, want) {
    const c = ' ' + norm(coName).replace(/\*/g, '').replace(/\s+/g, ' ').trim() + ' ';
    const cc = c.replace(/ /g, '');
    return want.some((w) => c.includes(' ' + w + ' ') || (w.length >= 6 && cc.includes(w.replace(/ /g, ''))));
  }
  /* one Exa result -> a lead row, or null when no current job is at the company */
  function personE(x, want) {
    const ent = (Array.isArray(x.entities) ? x.entities : []).find((e) => e && e.type === 'person') || {};
    const pr = ent.properties || {};
    const text = str(x.text);
    let job = (Array.isArray(pr.workHistory) ? pr.workHistory : [])
      .find((w) => w && w.dates && w.dates.to == null && w.company && sameCompany(w.company.name, want));
    if (!job) {
      /* no structured history: the profile text marks the current role "(Current)" under its company */
      const m = /###\s*\[([^\]]+)\][^\n]*\n+####\s*([^\n]+?)\s*\(Current\)/.exec(text);
      if (m && sameCompany(m[1], want)) job = { title: m[2], company: { name: m[1] } };
    }
    if (!job) return null;
    const slug = (/linkedin\.com\/in\/([^/?#\s]+)/i.exec(str(x.url)) || [])[1];
    if (!slug) return null;
    const name = str(pr.name || x.title).split('|')[0].replace(/\s*\(.*?\)\s*/g, ' ').trim();
    /* starts with a letter or digit: "CV -lisa@..." is lisa@..., not -lisa@... */
    const email = (text.match(/[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).find((e) => !FREEMAIL.test(e)) || null;
    return {
      src: 'e', ext_id: slug.toLowerCase(), first_name: str(pr.firstName) || name.split(' ')[0] || null,
      last_name: str(pr.lastName) || name.split(' ').slice(1).join(' ') || null, full_name: name || null,
      title: clip(job.title, 160) || null, location: clip(pr.location, 80) || null,
      linkedin: `https://www.linkedin.com/in/${slug}`, has_email: email ? 1 : null,
      company: str(job.company && job.company.name) || null, domain: null, profileEmail: email ? email.toLowerCase() : null,
    };
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
   * everywhere. aliases: other names of the company (legal name, census id),
   * for telling its people from a namesake's. founders: the census founders.
   */
  async function find(userId, { domain = '', company = '', companyId = null, titles = [], location = 'Indonesia', limit = 8, aliases = [], founders = [] } = {}) {
    const dom = domainOf(domain);
    const name = clip(company, 80);
    if (!dom && !name) return { ok: false, error: 'Name a company (or its website domain).' };
    const T = (Array.isArray(titles) ? titles : [titles]).map((t) => clip(t, 60)).filter(Boolean).slice(0, 6);
    const loc = /^(any|anywhere|all|global|worldwide)$/i.test(str(location).trim()) ? '' : clip(location || 'Indonesia', 60);
    const n = Math.max(1, Math.min(FIND_MAX, parseInt(limit, 10) || 8));
    const ask = T.join(', ') || null;
    const top = !T.length || TOP_RE.test(T.join(' '));
    const fromCensus = top && Array.isArray(founders) && founders.length > 0;
    const want = wants([name, ...(Array.isArray(aliases) ? aliases : []), dom.split('.')[0]]);

    const save = (r) => {
      const slug = (/linkedin\.com\/in\/([^/?#\s]+)/i.exec(str(r.linkedin)) || [])[1];
      let prior = slug ? Q.byProfile.get(userId, `%/in/${slug.toLowerCase().replace(/[%_]/g, '')}%`) : null;
      if (!prior && r.full_name && (companyId || dom)) prior = Q.byName.get(userId, r.full_name, companyId || '\u0000', dom || '\u0000');
      if (prior && !(prior.src === r.src && prior.ext_id === r.ext_id)) {
        Q.touch.run(r.src === 'c' ? null : r.title, r.location, r.linkedin, companyId || null, prior.id);
        if (r.linkedin && !prior.linkedin) prior.linkedin = r.linkedin;
        if (!prior.email && r.profileEmail) { Q.profileEmail.run(r.profileEmail, prior.id); prior.email = r.profileEmail; prior.email_status = 'listed on their profile'; }
        return shown({ ...prior, title: (r.src === 'c' ? prior.title : r.title) || prior.title, location: r.location || prior.location });
      }
      const saved = Q.upsert.get({ user_id: userId, src: r.src, ext_id: r.ext_id, company_id: companyId || null,
        company: r.company || name || null, domain: r.domain || dom || null, first_name: r.first_name, last_name: r.last_name,
        full_name: r.full_name, title: r.title, location: r.location, linkedin: r.linkedin, has_email: r.has_email, ask });
      let email = saved.email;
      let status = saved.email_status;
      if (!email && r.profileEmail) { try { Q.profileEmail.run(r.profileEmail, saved.id); email = r.profileEmail; status = 'listed on their profile'; } catch { /* shown without it */ } }
      return shown({ ...r, ...saved, id: saved.id, email, email_status: status, has_email: r.has_email, company: r.company || name });
    };
    /* the census founders, for a question about the top, unless the search already has them */
    const onRecord = (people) => {
      if (!top) return [];
      const have = new Set(people.map((p) => norm(p.name)));
      const out = [];
      for (const f of (Array.isArray(founders) ? founders : []).map((x) => clip(x, 80)).filter(Boolean).slice(0, 6)) {
        if (have.has(norm(f))) continue;
        const parts = f.split(/\s+/);
        try {
          out.push(save({ src: 'c', ext_id: `${companyId || dom || norm(name)}:${norm(f).replace(/ /g, '-')}`, first_name: parts[0], last_name: parts.slice(1).join(' ') || null,
            full_name: f, title: 'Founder (on record in 1001\'s census)', location: null, linkedin: null, has_email: null, company: name || null, domain: dom || null }));
        } catch (e) { say(`leadagent1001: save failed: ${e && e.message}`); }
      }
      return out;
    };
    const reply = (o, people, extra = {}) => {
      const fo = onRecord(people);
      return {
        ok: true, total: o.total || people.length, people, credits_used: o.credits || 0,
        ...(fo.length ? { founders_on_record: fo, founders_note: 'From 1001\'s census, not from the search: founders on record; one may have left since.' } : {}),
        ...(top && !people.length && !fo.length ? { hint: 'Searches miss senior people with sparse profiles: say no one was found, not that the company has no such person.' } : {}),
        credits_left_today: Math.max(0, dayCap - usedToday()),
        ...extra,
      };
    };

    /* 0. the same search this week: the people it found, from the list ('v2': searches since Exa came first) */
    const key = ['v2', dom || norm(name), T.map(norm).sort().join('|'), norm(loc)].join('#');
    try {
      const hit = Q.searchGet.get(userId, key, `-${SEARCH_DAYS} days`);
      const order = hit ? JSON.parse(hit.ids) : [];
      const got = order.length ? Q.byIds.all(userId, JSON.stringify(order)).sort((x, y) => order.indexOf(x.id) - order.indexOf(y.id)) : [];
      if (got.length) return reply({ total: hit.total }, got.map(shown), { note: 'Same search as earlier this week: these come from the leads list, nothing spent.' });
    } catch { /* search again */ }

    let rows = [];
    let via = '';
    let total = null;
    let credits = 0;
    let reached = false;   // some search answered, even with no one

    /* 1. Exa: profiles whose current job is at this company */
    let exaLeft = 0;
    try { exaLeft = exaDayMax - Q.exaToday.get().n; } catch { exaLeft = 0; }
    if (exaLeft > 0 && want.length && process.env.EXA_API_KEY) {
      const q = `${T.length ? T.join(', ') : 'people'} at ${name || dom}${dom ? ` (${dom})` : ''}${loc ? `, ${loc}` : ''}`;
      const e = await exa(q, 10);
      /* one person once, even with two profiles */
      const seen = new Set();
      rows = (e.ok ? e.results.map((x) => personE(x, want)).filter(Boolean) : [])
        .filter((r) => { const k = norm(r.full_name) || r.ext_id; return seen.has(k) ? false : seen.add(k); }).slice(0, n);
      if (rows.length) via = 'e';
      if (e.ok) reached = true;
      logCall(userId, 'find', rows.length, 0, e.ok ? 1 : 0, `exa ${dom || name} · ${ask || ''}${e.ok ? ` · ${e.results.length} seen, ${rows.length} at the company` : ` · ${e.code}`}`, 'exa', e.usd || 0);
    }

    /* 2. no one there: the free preview */
    let a = { ok: true, items: [] };
    if (!rows.length) {
      a = await call([{ provider: 'apollo', capability: 'people/search', options: {
        ...(dom ? { q_organization_domains_list: [dom] } : { q_keywords: name }),
        ...(T.length ? { person_titles: T } : {}),
        ...(loc ? { person_locations: [loc] } : {}),
        page: 1, per_page: n,
      } }]);
      const ai = a.ok ? a.items[0] : null;
      if (ai && !ai.error && ai.data) {
        reached = true;
        const ppl = Array.isArray(ai.data.people) ? ai.data.people : [];
        total = ai.data.total_entries || (ai.data.pagination && ai.data.pagination.total_entries) || null;
        credits += ai.creditsCost | 0;
        rows = ppl.slice(0, n).map((p) => ({ src: 'a', ...personA(p) }));
        via = 'a';
        logCall(userId, 'find', rows.length, ai.creditsCost | 0, 1, `${dom || name} · ${ask || ''}`);
      } else {
        logCall(userId, 'find', 0, 0, 0, `preview ${a.ok ? (ai && ai.error && ai.error.code) || 'empty' : a.code}`);
      }
    }

    /* 3. still no one (or the preview refused): the paid search, inside the day's cap */
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
          reached = true;
          const ppl = Array.isArray(fi.data.people) ? fi.data.people : [];
          total = (fi.data.metadata && fi.data.metadata.total) || total;
          credits += fi.creditsCost | 0;
          rows = ppl.slice(0, m).map((p) => ({ src: 'f', ...personF(p) }));
          via = 'f';
          logCall(userId, 'find', rows.length, fi.creditsCost | 0, 1, `${dom || name} · ${ask || ''}`);
        } else {
          /* a search we gave up on may still be billed: count the worst case */
          logCall(userId, 'find', 0, !f.ok && f.code === 'timeout' ? m * PRICE.find_f : (fi && fi.creditsCost) | 0, 0, `search ${f.ok ? (fi && fi.error && fi.error.code) || 'empty' : f.code}`);
          if (!f.ok && f.code === 'credits' && !fromCensus) return { ok: false, error: 'The lead agent is out of credits for this month.' };
        }
      }
    }

    if (!rows.length && !reached && !capped && !fromCensus) return { ok: false, error: 'People search is not answering right now. Try again in a minute.' };
    const people = [];
    for (const r of rows) {
      if (!r.ext_id) continue;
      try { people.push(save(r)); } catch (e) { say(`leadagent1001: save failed: ${e && e.message}`); }
    }
    if (people.length) { try { Q.searchPut.run(userId, key, JSON.stringify(people.map((p) => +p.ref.slice(1))), total || people.length); } catch { /* the next search just pays again */ } }
    if (credits) balance(true).catch(() => {});
    return reply({ total, credits }, people, {
      ...(capped ? { note: 'Today\'s credit limit for people search is reached; free results only until tomorrow (UTC).' } : {}),
      ...(via === 'a' && people.some((p) => /\*/.test(p.name)) ? { masked: 'Surnames with * are hidden until get_contact reveals the person.' } : {}),
    });
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
      if (r.email || r.revealed_at) out.push({ ...shown(r), note: r.email_status === 'listed on their profile' ? 'published on their own profile, no credits used' : 'revealed before, no credits used' });
      else if (!r.linkedin && !(r.first_name && r.last_name)) out.push({ ...shown(r), note: 'only one name on record and no profile, so no lookup was made (nothing charged)' });
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
