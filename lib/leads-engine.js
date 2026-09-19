'use strict';
/**
 * Lead Search — the research pipeline behind 1001startup.id/leads.
 *
 * This is the automation of a workflow that was first run by hand against
 * Blibli: find the people who actually decide, prove they still work there, and
 * work out how to reach them without inventing anything. Every rule below
 * exists because the manual run hit the failure it prevents.
 *
 * Two engines, each doing what it is good at:
 *   EXA     finds and reads pages. It is the only source of facts here.
 *   DEEPSEEK (through the Vantis Card rail, so the spend is metered and burns
 *            real credits) turns a sales intent into role phrasings, and ranks
 *            the people found. It never invents a person, a role or an address.
 *
 * The hard line: a fact comes from a fetched page and carries its URL, or it is
 * labelled a guess. Nothing in between.
 */
const dns = require('dns').promises;
const gh = require('./leads-github');

const EXA = 'https://api.exa.ai';
const CARD_BASE = process.env.VANTIS_CARD_BASE || 'http://127.0.0.1:8240/v1';
const CARD_MODEL = process.env.VANTIS_CARD_MODEL || 'deepseek-v4-flash-0731';
/* DeepSeek V4 Flash first-party list price. Shown to the operator per run. */
const RATE_IN = 0.14 / 1e6;
const RATE_OUT = 0.28 / 1e6;

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CURRENT = /\(Current\)/;

/* Directory sites print dummy rows as illustrations of a format. RocketReach
   offered "jdoe@blibli.com" and LeadIQ "firstlast@blibli.com" — both on the
   WRONG domain entirely. Every token of a dummy local part comes from this
   vocabulary, so the test is on the whole local part, not a substring. */
const DUMMY = new Set(['john', 'jane', 'jon', 'doe', 'smith', 'michael', 'first', 'firstname',
  'last', 'lastname', 'middle', 'initial', 'example', 'name', 'username', 'user', 'email',
  'j', 'f', 'l', 'm', 'jd', 'js', 'jsmith', 'johndoe', 'johnsmith', 'jdoe', 'firstlast', 'flast']);

/* Shared mailboxes are real addresses but belong to nobody, so they must never
   vote on a personal-name format. Paxel taught this: wehearyou@ and salescorp@
   outvoted the real people. */
const ROLE_BOX = /^(info|contact|hello|halo|sales|marketing|marcom|admin|support|cs|care|help|hr|recruitment|recruit|career|careers|press|media|legal|finance|billing|partnership|partnerships|business|noreply|no-reply|team|office|general|csirt|security|abuse|postmaster)(\.|$)/i;

/* Hosts that write ABOUT companies but are not companies. A domain from any of
   these must never become the place we send mail. */
const NOT_A_COMPANY = /(^|\.)(linkedin|facebook|instagram|twitter|x|youtube|tiktok|wikipedia|wikimedia|crunchbase|tracxn|pitchbook|owler|zoominfo|rocketreach|leadiq|apollo|signalhire|aeroleads|lusha|glassdoor|indeed|jobstreet|kalibrr|glints|medium|substack|blogspot|wordpress|github|gitlab|techinasia|e27|dealstreetasia|kompas|detik|tempo|bisnis|kontan|katadata|cnbcindonesia|liputan6|tribunnews|jakartapost|reuters|bloomberg|forbes|google|bing|yahoo)\./i;

const isDummy = (local) => String(local).toLowerCase().split(/[._-]+/).filter(Boolean).every((t) => DUMMY.has(t));

/* ROLE_BOX only sees a role word in FIRST position, and real corpora compound
   them: Reckitt's consumercare_usa@ and consumerhealth_gb@ read as first_last
   to the shape census and OUTVOTED the actual staff convention, so the run
   guessed ahmad_yafi@ against its own evidence of windi.fitriyani@. A local
   part is a shared box when any of its tokens is a function word, ends in one
   (consumerCARE, consumerHEALTH), or is a country/locale tag. */
const ROLE_TOKEN = new Set(['info', 'contact', 'hello', 'halo', 'sales', 'marketing', 'marcom',
  'admin', 'support', 'cs', 'care', 'help', 'hr', 'recruitment', 'recruit', 'career', 'careers',
  'press', 'media', 'legal', 'finance', 'billing', 'partnership', 'partnerships', 'business',
  'noreply', 'team', 'office', 'general', 'csirt', 'security', 'abuse', 'postmaster', 'consumer',
  'corporate', 'customer', 'service', 'services', 'health', 'enquiry', 'enquiries', 'inquiry',
  'inquiries', 'feedback', 'mailto', 'mail', 'email', 'welcome', 'hiring', 'jobs', 'vacancy']);
const ROLE_SUFFIX = ['care', 'health', 'sales', 'support', 'service', 'services', 'relations', 'affairs'];
const LOCALE_TOKEN = new Set(['usa', 'us', 'uk', 'gb', 'id', 'sg', 'my', 'au', 'nz', 'ph', 'th',
  'vn', 'hk', 'jp', 'kr', 'cn', 'in', 'ca', 'de', 'fr', 'it', 'es', 'nl', 'pl', 'br', 'mx', 'za',
  'apac', 'emea', 'asean', 'global', 'intl', 'asia', 'europe']);
function sharedMailbox(local) {
  const parts = String(local || '').toLowerCase().split(/[._-]+/).filter(Boolean);
  if (!parts.length) return false;
  for (const p of parts) {
    if (ROLE_TOKEN.has(p) || LOCALE_TOKEN.has(p)) return true;
    if (p.length > 6 && ROLE_SUFFIX.some((s) => p.endsWith(s) && p !== s)) return true;
  }
  return false;
}

/* Category words that a listicle title is made of. A discovered "company"
   whose name is ONLY these words is a page fragment, not a firm — real runs
   shipped "Digital" and "Indonesia Stock API" as research targets this way. */
const GENERIC_NAME = new Set(['digital', 'indonesia', 'indonesian', 'jakarta', 'service', 'services',
  'solution', 'solutions', 'technology', 'technologies', 'tech', 'api', 'data', 'stock', 'market',
  'official', 'website', 'site', 'company', 'companies', 'perusahaan', 'startup', 'startups',
  'group', 'online', 'platform', 'home', 'homepage', 'about', 'list', 'daftar', 'top', 'best',
  'directory', 'media', 'news', 'berita', 'update', 'harga', 'info', 'portal', 'blog', 'welcome',
  'the', 'and', 'dan', 'for', 'your', 'our', 'terbaik', 'layanan', 'jasa', 'aplikasi', 'software',
  'provider', 'providers', 'agency', 'agencies', 'e', 'commerce', 'ecommerce', 'id', 'co']);

/* ── plumbing ─────────────────────────────────────────────────────── */

async function post(url, body, headers, timeoutMs) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs || 45000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(body),
      signal: ac.signal,
    });
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* upstream sent non-JSON */ }
    return { ok: r.ok, status: r.status, json, text };
  } catch (e) {
    return { ok: false, status: 0, json: null, text: String((e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}

/** Per-run mutable counters, passed around rather than kept in module state so
 *  two concurrent runs can never bill each other. */
function newRun() {
  return { exaQueries: 0, tokensIn: 0, tokensOut: 0, costUsd: 0, notes: [] };
}

/**
 * A refused Exa call must never masquerade as an empty web. The morning the
 * fleet key ran out of credits, every search quietly returned [] and a run
 * "succeeded" with zero people — which reads as "nobody works there", the one
 * conclusion the evidence cannot support. A quota or auth refusal is recorded
 * on the run and the pipeline aborts with the real reason.
 */
function noteExaRefusal(run, r) {
  const body = String(r.text || '').slice(0, 400);
  if (r.status === 402 || /NO_MORE_CREDITS|exceeded your credits/i.test(body)) {
    run.exaBlocked = 'Exa is out of credits — every search is being refused. Top up at dashboard.exa.ai, then run this again.';
  } else if (r.status === 401 || r.status === 403) {
    run.exaBlocked = 'The Exa API key was rejected — check EXA_API_KEY on the server.';
  }
  run.notes.push(`Exa search failed (${r.status || 'network'})`);
}

async function exaSearch(run, query, opts) {
  opts = opts || {};
  const key = process.env.EXA_API_KEY;
  if (!key) { run.exaBlocked = 'No EXA_API_KEY is configured on the server, so nothing can be searched.'; return []; }
  const body = { query, numResults: opts.numResults || 8, contents: { text: { maxCharacters: opts.chars || 3000 } } };
  if (opts.category) body.category = opts.category;
  const r = await post(EXA + '/search', body, { 'x-api-key': key }, 40000);
  run.exaQueries += 1;
  if (!r.ok || !r.json) { noteExaRefusal(run, r); return []; }
  return r.json.results || [];
}

async function exaContents(run, urls, chars) {
  const key = process.env.EXA_API_KEY;
  if (!urls.length) return [];
  if (!key) { run.exaBlocked = 'No EXA_API_KEY is configured on the server, so nothing can be searched.'; return []; }
  const out = [];
  for (let i = 0; i < urls.length; i += 20) {
    const r = await post(EXA + '/contents', { urls: urls.slice(i, i + 20), text: { maxCharacters: chars || 6000 } },
      { 'x-api-key': key }, 60000);
    run.exaQueries += 1;
    if (r.ok && r.json && r.json.results) out.push(...r.json.results);
    else noteExaRefusal(run, r);
  }
  return out;
}

/**
 * One DeepSeek call through the Vantis Card gateway.
 * Returns parsed JSON or null — a model that answers badly must degrade the
 * run, never crash it.
 */
async function deepseek(run, messages, opts) {
  opts = opts || {};
  const key = process.env.VANTIS_CARD_KEY;
  if (!key) return null;
  const body = {
    model: CARD_MODEL,
    messages,
    /* V4 Flash is a REASONING model: it spends hundreds of tokens thinking
       before the first character of JSON. A tight cap truncates the answer
       mid-object and looks like a model failure. */
    max_tokens: opts.maxTokens || 2500,
    temperature: opts.temperature == null ? 0.2 : opts.temperature,
    response_format: { type: 'json_object' },
  };
  const r = await post(CARD_BASE + '/chat/completions', body, { Authorization: 'Bearer ' + key }, 120000);
  if (!r.ok || !r.json) {
    run.notes.push(`Inference call failed (${r.status})`);
    return null;
  }
  const u = r.json.usage || {};
  run.tokensIn += u.prompt_tokens || 0;
  run.tokensOut += u.completion_tokens || 0;
  run.costUsd += (u.prompt_tokens || 0) * RATE_IN + (u.completion_tokens || 0) * RATE_OUT;
  const content = r.json.choices && r.json.choices[0] && r.json.choices[0].message
    && r.json.choices[0].message.content;
  if (!content) return null;
  return looseJson(content);
}

/** Models occasionally wrap JSON in prose or a fence. Take the outermost
 *  object rather than failing the whole stage on a stray character. */
function looseJson(s) {
  const str = String(s).trim();
  try { return JSON.parse(str); } catch { /* fall through */ }
  const a = str.indexOf('{');
  const b = str.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(str.slice(a, b + 1)); } catch { /* genuinely broken */ }
  }
  return null;
}

/* ── the (Current) gate ───────────────────────────────────────────── */

const stripMd = (s) => String(s || '').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1').replace(/\s+/g, ' ').trim().replace(/^[-|\s]+|[-|\s]+$/g, '');
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Does this experience heading name THIS employer?
 *
 * Substring matching is the obvious implementation and it is wrong: squashed
 * containment credits a Grabfood driver to "Grab" and an Adaro analyst to a
 * company called "Ada". The company's words must appear as WHOLE, CONSECUTIVE
 * tokens — "Paxel" still matches "Paxel Logistik Nusantara" (a real legal name
 * for the same firm) while "Grab" no longer matches "Grabfood", because
 * `grabfood` is one token and is not the token `grab`.
 */
function employerMatches(head, company) {
  const h = tokens(head);
  const c = tokens(company);
  if (!h.length || !c.length) return false;
  for (let i = 0; i + c.length <= h.length; i++) {
    let ok = true;
    for (let j = 0; j < c.length; j++) {
      if (h[i + j] !== c[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  /* A company written solid in the heading ("Blibli.com" tokenises to
     blibli+com) is still a match when every one of its own tokens is present
     in order; the loop above already covers that. The one extra case worth
     allowing is a single-token company whose heading token differs only by a
     legal suffix, e.g. "Kargo" vs "Kargo". Anything looser reopens Grabfood. */
  return false;
}

/**
 * Decide whether a profile shows a LIVE role at `company`.
 *
 * Exa renders LinkedIn experience in two shapes, and the difference is the
 * whole ballgame:
 *
 *     ### <Role> - [Company](url) (Current)     <- flat entry
 *     ### [Company](url)                         <- grouped entry
 *     #### <Role> (Current)
 *
 * The first version of this searched a sliding window around the company name
 * and credited a co-founder's CURRENT role at a DIFFERENT company to this one,
 * because both names appeared within a few lines of each other. So: walk the
 * blocks, decide each block's employer from ITS OWN heading, and only then look
 * for (Current). A headline is never evidence — people advertise jobs they left
 * years ago, which was the single most common error on the Blibli run.
 */
function parseProfile(text, company) {
  const t = String(text || '');
  if (!t) return null;
  const target = squash(company);
  if (!target || !squash(t).includes(target)) return null;
  /* squash containment above is only a cheap pre-filter to skip profiles that
     never mention the company at all; the real decision is employerMatches. */

  let hit = null;
  let otherCurrent = false;
  const blocks = t.split(/\n(?=###\s)/);

  for (const blk of blocks) {
    const headLine = blk.split('\n', 1)[0] || '';
    const head = stripMd(headLine.replace(/^#+\s*/, ''));
    if (!head) continue;
    const mine = employerMatches(head, company);
    const entries = blk.match(/^####\s*[^\n]+$/gm) || [];

    if (entries.length) {
      // grouped: employer on ###, each role on its own ####
      for (const e of entries) {
        const role = e.replace(/^####\s*/, '');
        const cur = CURRENT.test(role);
        if (!cur) continue;
        if (mine) { if (!hit) hit = { role: stripMd(role.replace(CURRENT, '')), blk }; }
        else otherCurrent = true;
      }
    } else {
      const cur = CURRENT.test(headLine);
      if (!cur) continue;
      if (mine) {
        if (!hit) {
          let role = stripMd(head.replace(CURRENT, ''));
          // "Head of X - Company" → "Head of X"
          const cut = role.toLowerCase().indexOf(' - ' + String(company).toLowerCase());
          if (cut > 0) role = role.slice(0, cut);
          hit = { role: role.replace(/[-\s]+$/, ''), blk };
        }
      } else otherCurrent = true;
    }
  }

  if (hit) {
    const since = /([A-Z][a-z]{2}\s+\d{4})\s*-\s*Present/.exec(hit.blk);
    const dept = /Department:\s*([A-Za-z /&]+)/.exec(hit.blk);
    const level = /Level:\s*([A-Za-z]+)/.exec(hit.blk);
    return {
      role: hit.role, status: 'current',
      since: since ? since[1] : null,
      department: dept ? dept[1].trim() : null,
      level: level ? level[1] : null,
    };
  }
  // Named the company but shows no live role there: former, or unparseable.
  const hm = /^#\s*[^\n]+\n\s*([^\n]+)/.exec(t);
  return { role: hm ? stripMd(hm[1]) : null, status: otherCurrent ? 'former' : 'unclear', since: null, department: null, level: null };
}

function nameFrom(title, text) {
  const m = /^#\s*([^\n|]+)/.exec(String(text || ''));
  const n = m ? m[1] : String(title || '').split('|')[0].split(' - ')[0];
  return String(n).replace(/\s+/g, ' ').trim();
}

/* ── email: domain, evidence, format ──────────────────────────────── */

async function mxProvider(domain) {
  if (!domain) return { provider: 'unknown', hosts: [] };
  try {
    const recs = await dns.resolveMx(domain);
    const hosts = recs.sort((a, b) => a.priority - b.priority).map((r) => String(r.exchange).toLowerCase());
    const j = hosts.join(' ');
    let provider = hosts.length ? 'other' : 'none';
    if (/google/.test(j)) provider = 'Google Workspace';
    else if (/outlook|protection\.outlook/.test(j)) provider = 'Microsoft 365';
    return { provider, hosts };
  } catch {
    return { provider: 'none', hosts: [] };
  }
}

const nameParts = (name) => String(name || '').normalize('NFKD').replace(/[^a-zA-Z ]/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);

/** Which format produced this local part for this person? '' if it isn't theirs. */
function shapeOf(local, name) {
  const p = nameParts(name);
  if (!p.length) return '';
  const f = p[0], l = p[p.length - 1];
  const cands = { first: f };
  if (p.length > 1) {
    cands['first.last'] = `${f}.${l}`;
    cands.firstlast = `${f}${l}`;
    cands['f.last'] = `${f[0]}.${l}`;
    cands.flast = `${f[0]}${l}`;
    cands['first_last'] = `${f}_${l}`;
    if (p.length > 2) {
      cands['first.m.last'] = `${f}.${p[1][0]}.${l}`;
      cands['first.middle'] = `${f}.${p[1]}`;
      cands['first.middle.last'] = `${f}.${p[1]}.${l}`;
    }
  }
  for (const k of Object.keys(cands)) if (cands[k] === local) return k;
  return '';
}

/**
 * Derive the format from addresses we actually saw — never from a vendor's
 * claim. On the Blibli run the two commercial directories both stated a format
 * that every real address contradicted, and on the wrong domain at that.
 */
function learnPatterns(found, people) {
  const ev = {};
  for (const rec of found) {
    const local = rec.email.split('@')[0];
    if (ROLE_BOX.test(local) || sharedMailbox(local) || isDummy(local)) continue;
    // An address only votes if it can be pinned to a person by name. The name
    // may come from the page we found it on (git author, post byline) or from
    // the people this run turned up.
    const pool = people.map((p) => p.name).concat(rec.name ? [rec.name] : []);
    for (const nm of pool) {
      const sh = shapeOf(local, nm);
      if (sh) {
        (ev[sh] = ev[sh] || []).push({ email: rec.email, person: nm, sources: rec.sources || [] });
        break;
      }
    }
  }
  return Object.keys(ev)
    .map((pattern) => ({ pattern, observed: ev[pattern].length, evidence: ev[pattern].slice(0, 4) }))
    .sort((a, b) => b.observed - a.observed || a.pattern.localeCompare(b.pattern));
}

/**
 * The STRUCTURE of a local part, decided without knowing whose it is.
 *
 * learnPatterns only counts an address it can pin to a name it already knows,
 * which is right for choosing between conventions — but it throws away a whole
 * corpus when the roster is small. A person lookup at DOKU turned up 21 real
 * staff addresses (anindya.maharani@, ivan.boris@, felix.frederic@ …) and
 * learned NOTHING from them, because none of the 21 was the one person asked
 * for. The shape of an address is readable without identifying anybody.
 *
 * Single-token locals return '' on purpose: first, flast and firstlast are
 * indistinguishable without a name to test against, and guessing between them
 * is exactly the coin-flip this product refuses to make.
 */
function shapeOfLocal(local) {
  const s = String(local || '').toLowerCase();
  if (!s || /[^a-z._-]/.test(s)) return '';
  if (s.includes('_')) {
    const p = s.split('_').filter(Boolean);
    return (p.length === 2 && p[0].length > 1 && p[1].length > 1) ? 'first_last' : '';
  }
  if (s.includes('.')) {
    const p = s.split('.').filter(Boolean);
    if (p.some((x) => !x.length)) return '';
    if (p.length === 2) return p[0].length === 1 ? 'f.last' : 'first.last';
    if (p.length === 3) return p[1].length === 1 ? 'first.m.last' : 'first.middle.last';
    return '';
  }
  return '';
}

/**
 * Structural fallback: what shape do this domain's real addresses take?
 *
 * Used ONLY when no address could be pinned to a name. The dummy and
 * shared-mailbox rejections still apply — those are what stop RocketReach's
 * jdoe@ and a company's hr@ from voting — but the name-pinning requirement is
 * relaxed, and the result is labelled as shape evidence, never as learned.
 */
function learnShapes(found) {
  const ev = {};
  for (const rec of found) {
    const local = String(rec.email).split('@')[0];
    if (ROLE_BOX.test(local) || sharedMailbox(local) || isDummy(local)) continue;
    const sh = shapeOfLocal(local);
    if (!sh) continue;
    (ev[sh] = ev[sh] || []).push(rec.email);
  }
  return Object.keys(ev)
    .map((pattern) => ({ pattern, observed: ev[pattern].length, examples: ev[pattern].slice(0, 4) }))
    .sort((a, b) => b.observed - a.observed || a.pattern.localeCompare(b.pattern));
}

/**
 * Build the address for someone we found no published address for.
 *
 * Two-part Indonesian names are safe: on the Blibli corpus 9 of 11 were exactly
 * first.last. Three-part names are NOT — the same company used first.last and
 * first.m.last about equally, so an inferred address for a three-part name is
 * returned as a coin-flip with alternates rather than a confident answer.
 *
 * `basis` says what the format itself rests on, which is a different question
 * from `confidence` (which is about the name). It exists because the console
 * used to announce "no format could be learned, so no address was guessed" and
 * then print an address built from a hardcoded default — a claim its own output
 * contradicted.
 */
function inferEmail(name, domain, patterns, shapes) {
  const p = nameParts(name);
  if (!p.length || !domain) return null;
  const f = p[0], l = p[p.length - 1];
  const build = (pat) => {
    switch (pat) {
      case 'first': return f;
      case 'first.last': return p.length > 1 ? `${f}.${l}` : f;
      case 'firstlast': return p.length > 1 ? `${f}${l}` : f;
      case 'f.last': return p.length > 1 ? `${f[0]}.${l}` : f;
      case 'flast': return p.length > 1 ? `${f[0]}${l}` : f;
      case 'first_last': return p.length > 1 ? `${f}_${l}` : f;
      case 'first.m.last': return p.length > 2 ? `${f}.${p[1][0]}.${l}` : (p.length > 1 ? `${f}.${l}` : f);
      case 'first.middle': return p.length > 2 ? `${f}.${p[1]}` : null;
      case 'first.middle.last': return p.length > 2 ? `${f}.${p[1]}.${l}` : null;
      default: return null;
    }
  };
  // A mononym has exactly one sane form regardless of what the corpus voted for.
  if (p.length === 1) {
    return { value: `${f}@${domain}`, confidence: 'inferred', pattern: 'first (mononym)', alternates: [], sources: [], basis: 'mononym' };
  }
  const learned = (patterns || []).map((x) => x.pattern);
  const structural = learned.length ? [] : (shapes || []).map((x) => x.pattern);
  const ranked = learned.length ? learned : (structural.length ? structural : ['first.last']);
  const basis = learned.length ? 'learned' : (structural.length ? 'shape' : 'assumed');
  const seen = [];
  for (const pat of ranked) {
    const local = build(pat);
    if (local && !seen.some((s) => s.local === local)) seen.push({ local, pattern: pat });
  }
  if (!seen.length) return null;
  const three = p.length > 2;
  // For a three-part name make sure the OTHER live convention is offered even
  // if the corpus only voted for one of them.
  if (three) {
    for (const pat of ['first.last', 'first.m.last']) {
      const local = build(pat);
      if (local && !seen.some((s) => s.local === local)) seen.push({ local, pattern: pat });
    }
  }
  const alternates = seen.slice(1, 3).map((s) => `${s.local}@${domain}`);
  return {
    value: `${seen[0].local}@${domain}`,
    confidence: three && seen.length > 1 ? 'ambiguous' : 'inferred',
    pattern: seen[0].pattern,
    alternates,
    sources: [],
    basis,
  };
}

/* ── person lookup: "carikan email Ricky Hilmi Sudrajad" ──────────── */

/* A brief that asks for ONE NAMED PERSON must never be expanded into role
   queries: the expansion prompt forbids naming people, so the run would hunt
   CFOs and procurement managers and only find the person asked for by
   accident. That is exactly what happened with the first such brief typed
   into the console. Detection is deterministic — a model deciding "is this a
   person?" would make the pipeline's very first step unauditable. */

/* Words that mean the brief is about a FUNCTION, not a person. One hit in the
   candidate name rejects person mode and the brief goes down the roles path. */
const NOT_A_NAME = new Set(['hr', 'hrd', 'hris', 'ceo', 'cto', 'cfo', 'coo', 'cmo', 'cio', 'vp',
  'head', 'heads', 'manager', 'managers', 'director', 'directors', 'officer', 'chief', 'lead',
  'finance', 'engineering', 'procurement', 'marketing', 'sales', 'it', 'tech', 'technology',
  'people', 'talent', 'recruiter', 'recruitment', 'founder', 'founders', 'owner', 'staff',
  'team', 'tim', 'the', 'of', 'for', 'and', 'dan', 'yang', 'di', 'pt', 'tbk', 'cv',
  'whoever', 'anyone', 'someone', 'semua', 'orang', 'bagian', 'divisi', 'department', 'dept',
  'departemen', 'admin', 'their', 'who', 'person', 'contact', 'kepala', 'karyawan', 'pegawai',
  'company', 'perusahaan', 'startup', 'vendor', 'supplier', 'customer', 'client', 'buyer',
  'holder', 'gatekeeper', 'decision', 'maker', 'tools', 'tool', 'software', 'blast', 'list',
  'email', 'emails', 'mail', 'kontak', 'contact', 'contacts', 'address', 'addresses',
  'leads', 'me', 'my', 'his', 'her', 'their', 'its', 'best', 'top', 'good', 'new',
  'kantor', 'office', 'design', 'designer', 'product', 'growth', 'ops', 'operations']);

/* Honorifics precede Indonesian names constantly ("carikan email pak Budi").
   They are stripped, never treated as part of the name. */
const HONORIFIC = /^(?:pak|bu|bapak|ibu|mas|mbak|sdr|sdri|mr|mrs|ms|dr|ir)\.?\s+/i;

/* Could this word sequence be a person's name? Shared by the two deterministic
   grammars and by the planner's verbatim check, so a name is judged by the
   same rules no matter which reader produced it. */
function validNameWords(words, hadVerb) {
  if (words.length < 1 || words.length > 5) return false;
  for (const w of words) {
    if (!/^[A-Za-z][A-Za-z'.-]*$/.test(w)) return false;
    if (NOT_A_NAME.has(w.toLowerCase().replace(/[.'-]/g, ''))) return false;
  }
  /* No verb carrying the intent means the capitalisation must. */
  if (!hadVerb && !words.every((w) => /^[A-Z]/.test(w))) return false;
  /* A single lowercase word after a verb ("carikan email support") is far more
     likely a mailbox than a mononym person. Mononyms still pass when typed
     with a capital. */
  if (words.length === 1 && !/^[A-Z]/.test(words[0])) return false;
  return true;
}

const titleCaseName = (words) => words.map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

/* An employer clause made only of function words ("… di kantor", "… from
   marketing") is not an employer. */
function usableHint(hint) {
  const h = String(hint || '').trim().replace(/[,;.\s]+$/, '').slice(0, 60);
  if (!h) return '';
  const tk = tokens(h);
  if (!tk.length || tk.every((t) => NOT_A_NAME.has(t))) return '';
  return h;
}

/** Name + optional "di/at/from/of <Company>" clause → {person, companyHint} or null. */
function nameAndHint(rest, hadVerb) {
  let companyHint = '';
  const at = /\s*,?\s+(?:di|at|@|from|dari|of|in|dalam)\s+(.+)$/i.exec(rest);
  if (at) { companyHint = usableHint(at[1]); rest = rest.slice(0, at.index).trim(); }
  rest = rest.replace(HONORIFIC, '').trim().replace(/[,;.\s]+$/, '');
  const words = rest.split(/\s+/).filter(Boolean);
  if (!validNameWords(words, hadVerb)) return null;
  return { person: titleCaseName(words), companyHint };
}

/* "…, get me his email" / "… and its contact address" / "… professional
   email" — the request-tail that follows a name in briefs like Luca actually
   types. Stripped before the name is read; a brief this touched nothing on is
   not name-first shaped. */
const TAIL_VERBED = /[,;]?\s*(?:and\s+|dan\s+|then\s+|terus\s+|lalu\s+)?(?:please\s+|tolong\s+)?(?:get|give|send|kasih|kirim|share|find|cari(?:kan|in)?)\s+(?:me\s+|saya\s+|aku\s+)?(?:his\s+|her\s+|their\s+|its\s+|the\s+)?(?:professional\s+|work\s+|corporate\s+|business\s+|office\s+|personal\s+)?(?:e-?mails?|kontak|contacts?)(?:\s+address(?:es)?)?\s*$/i;
const TAIL_BARE = /[,;]?\s*(?:and\s+|dan\s+)?(?:his\s+|her\s+|their\s+|its\s+)?(?:professional\s+|work\s+|corporate\s+|business\s+|office\s+|personal\s+)?(?:e-?mails?|kontak|contacts?)(?:-?nya)?(?:\s+address(?:es)?)?\s*$/i;

function stripEmailTail(s) {
  let out = String(s || '').trim().replace(/[.?!\s]+$/, '');
  for (const re of [TAIL_VERBED, TAIL_BARE]) out = out.replace(re, '').trim().replace(/[,;\s]+$/, '');
  return out;
}

/* Grammar 1 — the email-word leads: "carikan email Ricky Hilmi Sudrajad",
   "find email of Budi Santoso at Kargo Technologies". */
function personEmailFirst(s) {
  const m = /^(?:tolong\s+|please\s+)?(cari(?:kan|in)?|carilah|temukan|find|get|lookup|look\s+up|need|butuh)?\s*(?:alamat\s+)?(?:e-?mail|email|kontak|contact)(?:\s+address(?:es)?)?(?:\s+(?:of|for|from|dari|untuk|nya|buat|si))?\s+(.+)$/i.exec(s);
  if (!m) return null;
  return nameAndHint(m[2].trim(), !!m[1]);
}

/* Grammar 2 — the name leads and the email-word trails: "Search me ilham ali
   yafi, from reckitt, get me his email". This is the shape run 24 actually
   arrived in, and the email-first grammar cannot see it: the address-word sits
   at the far end of the sentence. */
function personNameFirst(s) {
  if (!/\b(?:e-?mails?|kontak|contacts?)\b/i.test(s)) return null;
  const bare = String(s).trim().replace(/[.?!\s]+$/, '');
  const rest = stripEmailTail(bare);
  if (!rest || rest === bare) return null; // no request-tail came off — not this shape
  const v = /^(?:please\s+|tolong\s+|coba\s+|try\s+to\s+|help\s+me\s+)*(?:search|find|cari(?:kan|in)?|carilah|temukan|lookup|look\s+up|get|dapatkan|minta(?:kan)?)\s+(?:me\s+|for\s+|saya\s+|aku\s+)?/i.exec(rest);
  if (!v) return null;
  return nameAndHint(rest.slice(v[0].length).trim(), true);
}

/**
 * Is this brief a request for one named person's address?
 * Returns { person, companyHint } or null. companyHint is set when the brief
 * itself names the employer ("… Ricky Hilmi Sudrajad di DOKU", "… from
 * reckitt"). Deterministic on purpose — these two grammars cost nothing and
 * their reading is auditable; anything they miss goes to planBrief, whose
 * model reading is accepted only where it quotes the brief verbatim.
 */
function parsePersonBrief(intent) {
  const s = String(intent || '').trim().replace(/[.?!\s]+$/, '');
  if (!s || s.length > 160 || /\n/.test(s)) return null;
  return personEmailFirst(s) || personNameFirst(s);
}

/* ── the planner: read the brief the way Websets reads a query ────── */

/**
 * Accept the model's reading of the brief ONLY where it can be checked
 * against the brief's own text. The model may classify and it may quote; it
 * may not compose. Every name and company it returns must appear verbatim
 * (case-insensitive) in the brief, or that field is discarded — so a
 * hallucinated "Budi Santoso" can never start a search for a person nobody
 * asked about. Pure and unit-tested; planBrief is just the model call around it.
 */
function applyPlan(intent, j) {
  if (!j || typeof j !== 'object') return null;
  const brief = String(intent || '').toLowerCase();
  const quoted = (s, max) => {
    const v = String(s || '').trim().replace(/[,;.\s]+$/, '').slice(0, max || 80);
    return v && brief.includes(v.toLowerCase()) ? v : '';
  };
  const companies = (Array.isArray(j.companies) ? j.companies : [])
    .map((c) => usableHint(quoted(c, 60))).filter(Boolean).slice(0, 4);
  const focus = String(j.focus || '').trim().slice(0, 120);
  if (j.mode === 'person') {
    const person = quoted(j.person, 60);
    const words = person.split(/\s+/).filter(Boolean);
    if (person && validNameWords(words, true)) {
      return { mode: 'person', person: titleCaseName(words), companyHint: companies[0] || '', companies, focus };
    }
    /* The model called it a person but could not quote one — that is a
       classification with no evidence, and it degrades to the roles path. */
  }
  return { mode: 'roles', person: '', companyHint: '', companies, focus };
}

async function planBrief(run, intent) {
  const j = await deepseek(run, [
    {
      role: 'system',
      content: 'You read one lead-search brief and classify it. Return ONLY JSON: '
        + '{"mode":"person","person":"","companies":[],"focus":""} or '
        + '{"mode":"roles","person":"","companies":[],"focus":""}. '
        + 'mode "person" ONLY when the brief asks about a specific named human being (a personal name '
        + 'like "Budi Santoso"). Job titles, departments, "whoever", "anyone" mean mode "roles". '
        + 'person: that one person\'s name EXACTLY as the brief spells it; empty unless mode is person. '
        + 'companies: employers the brief itself names, each EXACTLY as spelled there. '
        + 'focus: the function or role the brief targets, in a few words, or "". '
        + 'Copy strings verbatim from the brief — never add, complete, translate or correct a name. '
        + 'When nothing fits, answer mode "roles" with empty fields.',
    },
    { role: 'user', content: 'Brief: ' + intent },
  ], { maxTokens: 900, temperature: 0 });
  return applyPlan(intent, j);
}

/** Do all the tokens of the wanted name appear in the profile's name?
 *  LinkedIn adds degrees and titles ("Ricky Hilmi Sudrajad, S.Kom."), so the
 *  test is subset, not equality. */
function nameMatches(profileName, wanted) {
  const have = new Set(tokens(profileName));
  const want = tokens(wanted);
  if (!want.length || !have.size) return false;
  return want.every((t) => have.has(t));
}

/** Every employer this profile shows a LIVE role at, in document order.
 *  Same two Exa shapes as parseProfile; used when nobody named the company. */
function currentEmployersOf(text) {
  const t = String(text || '');
  if (!t) return [];
  const out = [];
  const blocks = t.split(/\n(?=###\s)/);
  for (const blk of blocks) {
    const headLine = blk.split('\n', 1)[0] || '';
    const head = stripMd(headLine.replace(/^#+\s*/, ''));
    if (!head) continue;
    const entries = blk.match(/^####\s*[^\n]+$/gm) || [];
    if (entries.length) {
      for (const e of entries) {
        const role = e.replace(/^####\s*/, '');
        if (!CURRENT.test(role)) continue;
        out.push({ employer: head, role: stripMd(role.replace(CURRENT, '')) });
      }
    } else if (CURRENT.test(headLine)) {
      /* flat: "Role - Company (Current)" — the employer is the LAST " - "
         segment, the role is the rest. */
      const flat = stripMd(head.replace(CURRENT, ''));
      const cut = flat.lastIndexOf(' - ');
      if (cut > 0) out.push({ employer: flat.slice(cut + 3).trim(), role: flat.slice(0, cut).trim() });
      else out.push({ employer: flat, role: null });
    }
  }
  return out.filter((x) => x.employer);
}

/**
 * Drop the legal-entity tail a LinkedIn company heading often carries.
 *
 * A profile read "DOKU, PT NUSA SATU INTI ARTHA", which is the same company
 * twice — and the comma is load-bearing everywhere else in this app, because
 * the company field splits on it. Left alone, that name pasted back into the
 * form researches one real company and one phantom. Only a tail that STARTS
 * with an Indonesian legal form is dropped, so "Kargo Technologies, Inc" goes
 * and "Grab, Gojek" (were it ever a heading) would not.
 */
function trimLegalTail(name) {
  const s = String(name || '').trim();
  const i = s.indexOf(',');
  if (i <= 0) return s;
  const tail = s.slice(i + 1).trim();
  return /^(pt\.?|cv\.?|ud\.?|tbk\.?|inc\.?|llc|ltd\.?|pte\.?|persero)\b/i.test(tail) ? s.slice(0, i).trim() : s;
}

/** id.linkedin.com and www.linkedin.com are the same person to Exa. */
function canonProfileUrl(url) {
  return String(url || '').replace(/\/en\/?$/, '').replace(/\/$/, '')
    .replace(/^https?:\/\/(?:[a-z]{2}\.)?linkedin\.com/, 'https://www.linkedin.com');
}

/**
 * Nobody named the company: find where this person works NOW, from their own
 * profile — never from a model's memory of them.
 */
async function findEmployerOf(run, person, step) {
  step('discover', `Finding where ${person} works now`);
  const lists = await deadline(Promise.all([
    exaSearch(run, `"${person}" linkedin Indonesia`, { category: 'linkedin profile', numResults: 6, chars: 200 }),
    exaSearch(run, `${person} linkedin profile`, { category: 'linkedin profile', numResults: 6, chars: 200 }),
  ]), 45000, [], run, 'the person hunt');
  const urls = [];
  for (const list of (lists || [])) {
    for (const res of (list || [])) {
      const u = canonProfileUrl(res.url);
      if (u && !urls.includes(u) && nameMatches(String(res.title || '').split('|')[0].split(' - ')[0], person)) urls.push(u);
    }
  }
  if (!urls.length) {
    if (run.exaBlocked) throw new Error(run.exaBlocked);
    step('discover', `No profile found for ${person}`);
    return null;
  }
  const pages = await deadline(exaContents(run, urls.slice(0, 4), 6000), 60000, [], run, 'reading the person');
  const matches = [];
  for (const res of pages) {
    const text = res.text || '';
    const nm = nameFrom(res.title, text);
    if (!nameMatches(nm, person)) continue;
    const cur = currentEmployersOf(text);
    if (cur.length) matches.push({ name: nm, url: res.url, employer: trimLegalTail(cur[0].employer), role: cur[0].role });
  }
  if (!matches.length) { step('discover', `${person} was found but no live employer could be read from the profile`); return null; }
  if (matches.length > 1) {
    const others = matches.slice(1).map((x) => `${x.name} at ${x.employer}`).join('; ');
    run.notes.push(`more than one profile matched "${person}" — researched the first (${matches[0].employer}); also seen: ${others}`);
  }
  step('discover', `${matches[0].name} — current employer ${matches[0].employer}`);
  return matches[0];
}

/* ── the run ──────────────────────────────────────────────────────── */

const DEFAULT_ROLES = [
  'chief executive officer OR founder leadership team',
  'head of operations OR chief operating officer',
  'head of people OR human resources director',
  'head of technology OR CTO engineering',
];

async function expandRoles(run, company, intent, focus) {
  if (!intent) return DEFAULT_ROLES;
  const j = await deepseek(run, [
    {
      role: 'system',
      content: 'You turn a B2B sales intent into LinkedIn people-search queries. '
        + 'Return ONLY JSON: {"roles":["...","...'
        + '"],"reasoning":"one sentence"}. Give 4 to 6 role queries. Each must be a job-title '
        + 'phrasing a real person would have, not a sentence. Cover the economic buyer, the '
        + 'system owner who lives with the tool daily, the technical gatekeeper, and procurement. '
        + 'Do not name any person. Do not invent titles specific to one company.',
    },
    {
      role: 'user',
      content: `Company: ${company}\nWhat the seller offers / needs: ${intent}`
        + (focus ? `\nThe brief targets this function — centre the queries on it: ${focus}` : ''),
    },
  ], { maxTokens: 1200 });
  const roles = j && Array.isArray(j.roles) ? j.roles.filter((r) => typeof r === 'string' && r.trim()).slice(0, 6) : [];
  /* Falling back must be said, not slipped in: run 24's history page showed
     the default set as if the model had chosen it for that brief. */
  if (!roles.length) run.notes.push('the brief could not be expanded into role queries — the default role set was used');
  return roles.length ? roles : DEFAULT_ROLES;
}

/* Seniority ladder — the deterministic ordering the table falls back to.
   Ranking must never depend solely on the model: the first live run sent
   eighteen people, the reasoning model spent its budget thinking and the JSON
   came back truncated, so every row landed at rank 999 and the table arrived in
   arbitrary order. A rule-based order is worse than a good model answer and far
   better than none. */
const SENIORITY = [
  [/\b(founder|co-?founder|ceo|coo|cto|cfo|chief|president|managing director)\b/i, 5],
  [/\b(vp|vice president|head of|group head|director)\b/i, 4],
  [/\b(lead|manager|principal)\b/i, 3],
  [/\b(senior|sr\.?)\b/i, 2],
];
function seniorityRank(people, intent) {
  /* Words from the seller's own brief are a decent relevance signal: someone
     selling an HRIS should see HR people above everyone of equal seniority. */
  const words = String(intent || '').toLowerCase().match(/[a-z]{4,}/g) || [];
  const stop = new Set(['need', 'want', 'sell', 'selling', 'company', 'people', 'person', 'their', 'whoever', 'holder', 'budget', 'looking', 'system', 'systems']);
  const terms = words.filter((w) => !stop.has(w)).slice(0, 12);
  return people
    .map((p, i) => {
      const blob = `${p.role || ''} ${p.department || ''}`.toLowerCase();
      let s = 1;
      for (const [rx, pts] of SENIORITY) if (rx.test(blob)) { s = pts; break; }
      const rel = terms.reduce((a, t) => a + (blob.includes(t) ? 1 : 0), 0);
      return { i, score: s * 2 + rel };
    })
    .sort((a, b) => b.score - a.score)
    .reduce((acc, x, n) => { acc[x.i] = n + 1; return acc; }, {});
}

async function rankPeople(run, people, company, intent) {
  if (!people.length) return {};
  const fallback = seniorityRank(people, intent);
  /* Rank a SHORTLIST, not the whole roster. A 29-person list made the reasoning
     model spend its entire budget before emitting any JSON, so nothing landed
     and every row fell back. The people who matter are near the top of the
     deterministic order anyway; the tail keeps that order and loses only the
     one-line reason. */
  const order = Object.keys(fallback).map(Number).sort((a, b) => fallback[a] - fallback[b]);
  const short = order.slice(0, 12);
  const slim = short.map((i) => ({ i, name: people[i].name, role: people[i].role, dept: people[i].department }));
  const j = await deepseek(run, [
    {
      role: 'system',
      content: 'You rank people to approach for a B2B sale. Return ONLY JSON: '
        + '{"ranked":[{"i":<index>,"rank":<1-based>,"why":"<max 14 words>"}]}. '
        + 'Rank by who can actually move the deal: the person who owns the system in question, '
        + 'the budget holder, then the gatekeepers. Use ONLY the roles given. '
        + 'Never invent a fact about a person. If a role is unclear, rank it lower rather than guessing. '
        + 'Be terse — the "why" must be a fragment, not a sentence.',
    },
    { role: 'user', content: `Company: ${company}\nSeller needs: ${intent || 'general commercial contact'}\nPeople: ${JSON.stringify(slim)}` },
  ], { maxTokens: 6000 });

  const out = {};
  let landed = 0;
  if (j && Array.isArray(j.ranked)) {
    /* A null element used to throw here and destroy a finished run — every Exa
       call, the gate and the format learning were already paid for. A bad
       ranking is worth losing; the run is not. */
    const rows = j.ranked.filter((r) => r && typeof r === 'object' && typeof r.i === 'number');
    /* A model that answers 1-based silently shifts every reason onto the next
       person, and the reasons cite roles rather than names so the output still
       reads plausibly. Only accept indices that actually address the shortlist
       we sent. */
    const valid = rows.filter((r) => short.indexOf(r.i) >= 0);
    if (rows.length && !valid.length) {
      run.notes.push('the ranking reply addressed people we did not ask about and was discarded');
    }
    for (const r of valid) {
      out[r.i] = { rank: Number(r.rank) || fallback[r.i] || 999, why: String(r.why || '').slice(0, 160) };
      landed++;
    }
  }
  /* Partial answers are normal on a long list — fill the gaps rather than
     dropping the people the model ran out of room for. */
  for (let i = 0; i < people.length; i++) {
    if (!out[i]) out[i] = { rank: (fallback[i] || 999) + 100, why: '' };
  }
  if (landed < short.length) {
    run.notes.push(`the model ranked ${landed} of the ${short.length} shortlisted; the rest are ordered by seniority`);
  }
  return out;
}

/** Surfaces where employees publish their own address, in both languages —
 *  the Indonesian hiring-post phrasing is what surfaced most real addresses. */
function emailQueries(company, domain) {
  return [
    `"@${domain}" email ${company} contact`,
    `${company} hiring "kirim CV" OR "send your CV" OR "drop your CV" email @${domain}`,
    `${company} press OR media OR partnership contact email @${domain}`,
  ];
}

/* A stage that never returns is the one failure the operator cannot diagnose:
   the console just says "Running" forever. One run against StickEarn sat past
   three minutes with no row ever reaching the ledger. Every long stage is now
   raced against a deadline and degrades to a partial answer, which is worth
   something, instead of a hang, which is worth nothing. */
function deadline(promise, ms, fallback, run, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((resolve) => {
      timer = setTimeout(() => {
        run.notes.push(`${label} timed out after ${Math.round(ms / 1000)}s`);
        resolve(fallback);
      }, ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function runOne(opts) {
  const company = String(opts.company || '').trim();
  const intent = String(opts.intent || '').trim();
  const person = String(opts.person || '').trim();
  const step = typeof opts.onStep === 'function' ? opts.onStep : () => {};
  const run = opts.run || newRun();

  /* A person-lookup brief never goes through role expansion: the expansion
     prompt is FORBIDDEN from naming people, so it would turn "find Ricky's
     email" into a hunt for CFOs that only finds Ricky by accident. */
  let roles;
  if (person) {
    roles = [`person lookup: ${person}`];
    step('roles', `Person lookup: ${person} at ${company}`);
  } else {
    step('roles', 'Reading the brief');
    roles = await expandRoles(run, company, intent, opts.focus || '');
    step('roles', `${roles.length} role angles: ${roles.map((r) => r.split(' OR ')[0]).join(', ')}`);
  }

  step('hunt', person ? `Searching for ${person}'s profile` : 'Searching LinkedIn profiles');
  const hits = new Map();
  const queries = person
    ? [`"${person}" ${company} linkedin`, `${person} ${company} Indonesia linkedin profile`]
    : roles.map((r) => `${company} ${r} Indonesia`);
  const searches = await deadline(Promise.all(queries.map((q) =>
    exaSearch(run, q, { category: 'linkedin profile', numResults: person ? 6 : 8, chars: 200 }))),
    60000, [], run, 'the profile hunt');
  for (const list of searches) {
    for (const res of list) {
      // id.linkedin.com and www.linkedin.com are the same person to Exa.
      const u = canonProfileUrl(res.url);
      if (u) hits.set(u, res.title || '');
    }
  }
  /* Zero candidates because Exa refused every call is not "nobody was found"
     — it is a broken search, and the run must say which. */
  if (!hits.size && run.exaBlocked) throw new Error(run.exaBlocked);
  step('hunt', `${hits.size} candidate profiles`);

  step('verify', 'Checking who still works there');
  const pages = await deadline(exaContents(run, Array.from(hits.keys()), 6000),
    90000, [], run, 'reading profiles');
  const people = [];
  for (const res of pages) {
    const text = res.text || '';
    const parsed = parseProfile(text, company);
    if (!parsed) continue;
    people.push({
      name: nameFrom(res.title, text),
      linkedin: res.url,
      role: parsed.role,
      status: parsed.status,
      since: parsed.since,
      department: parsed.department,
      level: parsed.level,
    });
  }
  /* Person mode: only the person asked for may appear in the answer — a
     colleague who matched the search is noise here, not a bonus. */
  const scoped = person ? people.filter((p) => nameMatches(p.name, person)) : people;
  // One person can arrive twice under two LinkedIn hostnames.
  const byName = new Map();
  for (const p of scoped) {
    const k = squash(p.name);
    const prev = byName.get(k);
    if (!prev || (prev.status !== 'current' && p.status === 'current')) byName.set(k, p);
  }
  const current = Array.from(byName.values()).filter((p) => p.status === 'current');
  const dropped = Array.from(byName.values()).length - current.length;
  step('verify', person
    ? (current.length
      ? `${current[0].name} — live role at ${company} confirmed`
      : `no live role at ${company} could be confirmed for ${person}`)
    : `${current.length} currently employed · ${dropped} rejected as former or unclear`);

  /* The person was asked for by name and is NOT current here — say where their
     profile shows them now, instead of a bare zero. */
  if (person && !current.length) {
    for (const res of pages) {
      const text = res.text || '';
      if (!nameMatches(nameFrom(res.title, text), person)) continue;
      const cur = currentEmployersOf(text);
      if (cur.length) {
        run.notes.push(`${person}'s profile shows a live role at ${cur[0].employer}`
          + `${cur[0].role ? ' (' + cur[0].role + ')' : ''}, not ${company}`);
        break;
      }
    }
  }

  step('domain', 'Finding the mail domain');
  let domain = String(opts.domain || '').trim().toLowerCase();
  let domainSource = domain ? 'given by the operator' : null;

  /* A census row already carries the company's own URL, verified by hand. That
     beats anything a search can offer. */
  if (!domain && Array.isArray(opts.census)) {
    const row = opts.census.find((c) => c && c.name && squash(c.name) === squash(company));
    if (row && row.url) {
      try { domain = new URL(row.url).hostname.replace(/^www\./, ''); domainSource = 'the census record'; } catch { /* ignore */ }
    }
  }

  if (!domain) {
    const site = await exaSearch(run, `${company} Indonesia official website`, { numResults: 5, chars: 200 });
    for (const r of (site || [])) {
      let h = '';
      try { h = new URL(r.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { continue; }
      if (NOT_A_COMPANY.test(h)) continue;
      domain = h; domainSource = 'the first plausible search result';
      break;
    }
  }

  /* THE GUARD THAT MATTERS. Without it the first search result being a
     RocketReach or news page silently becomes "the mail domain", and every
     person in the run ships a confident address at a stranger's mail server.
     If the domain cannot be tied to the company's own name, we still SHOW it,
     but we refuse to build addresses on it. */
  const related = !!domain && (
    domainSource === 'given by the operator'
    || domainSource === 'the census record'
    || tokens(company).some((t) => t.length > 3 && squash(domain).includes(t))
  );
  if (domain && !related) {
    run.notes.push(`the domain ${domain} could not be tied to ${company}, so no addresses were guessed`);
  }
  let mx = await mxProvider(domain);

  step('evidence', 'Hunting addresses published in public');
  const foundMap = new Map();
  const addFound = (email, source, name) => {
    const e = String(email).toLowerCase();
    const prev = foundMap.get(e) || { email: e, sources: [], name: name || null };
    if (source && !prev.sources.includes(source)) prev.sources.push(source);
    if (!prev.name && name) prev.name = name;
    foundMap.set(e, prev);
  };
  if (domain) {
    const sweep = emailQueries(company, domain);
    /* One extra query aimed at the person themselves: their own published
       address beats any inference and this is the cheapest place to find it. */
    if (person) sweep.push(`"${person}" email "@${domain}"`);
    const results = await deadline(
      Promise.all(sweep.map((q) => exaSearch(run, q, { numResults: 8, chars: 6000 }))),
      60000, [], run, 'the address sweep');
    for (const list of results) {
      for (const res of list) {
        const body = res.text || '';
        const m = body.match(EMAIL_RE) || [];
        for (const raw of m) {
          const e = raw.toLowerCase();
          if (!e.endsWith('@' + domain)) continue;
          if (isDummy(e.split('@')[0])) continue;
          addFound(e, res.url, null);
        }
      }
    }
  }

  /* Public git history is the highest-yield source of real corporate addresses
     — on the Blibli run it produced eleven when every indexed page produced
     none for the people we actually wanted. */
  let ghOut = { corporate: [], personal: [], orgsTried: [], repos: 0 };
  if (domain) {
    const empty = { corporate: [], personal: [], orgsTried: [], repos: 0 };
    try {
      /* Unauthenticated GitHub allows 60 requests an hour per IP and a harvest
         spends about twenty-five, so a busy afternoon WILL hit the limit. That
         must cost this one stage, never the run. */
      ghOut = await deadline(gh.harvest(domain, gh.orgCandidates(company, domain), { maxRepos: 6 }),
        45000, empty, run, 'the git harvest') || empty;
      for (const c of ghOut.corporate) addFound(c.email, (c.sources || [])[0] || 'public git commit', c.name);
    } catch { run.notes.push('git harvest skipped'); }
  }
  const found = Array.from(foundMap.values());
  step('evidence', `${found.length} addresses found verbatim (${ghOut.corporate.length} from public git history)`);

  step('pattern', 'Learning the address format');
  const patterns = learnPatterns(found, current);
  /* Only when nothing could be pinned to a name — see learnShapes. */
  const shapes = patterns.length ? [] : learnShapes(found);
  const isBox = (f) => {
    const local = f.email.split('@')[0];
    return ROLE_BOX.test(local) || sharedMailbox(local);
  };
  const personalFound = found.filter((f) => !isBox(f));
  const roleBoxes = found.filter(isBox);
  /* This line is a CLAIM about the run and has to match what the run then does.
     It used to say "addresses will not be guessed" and the very next step
     guessed one from a hardcoded default. */
  step('pattern', patterns.length
    ? `${patterns[0].pattern} (${patterns[0].observed} real addresses agree)`
    : shapes.length
      ? `${shapes[0].pattern} — the shape of ${shapes[0].observed} real addresses on the domain, not name-verified`
      : (related
        ? 'no format evidence — falling back to the first.last convention, unverified'
        : 'no format could be learned and the domain is untrusted — no addresses guessed'));

  let ranked;
  if (person) {
    /* One person was asked for; a ranking model call would be spend with
       nothing to decide. */
    step('rank', 'One person asked for — nothing to rank');
    ranked = {};
    current.forEach((_, i) => { ranked[i] = { rank: i + 1, why: 'the person you asked for' }; });
  } else {
    step('rank', 'Ranking who to approach');
    ranked = await rankPeople(run, current, company, intent);
  }

  const out = current.map((p, i) => {
    // A published address for THIS person always beats an inference.
    const pub = personalFound.find((f) => shapeOf(f.email.split('@')[0], p.name));
    const email = pub
      ? { value: pub.email, confidence: 'published', pattern: shapeOf(pub.email.split('@')[0], p.name), alternates: [], sources: pub.sources, basis: 'published' }
      : (related ? inferEmail(p.name, domain, patterns, shapes) : null);
    const r = ranked[i] || {};
    return Object.assign({}, p, {
      email: email || { value: null, confidence: 'none', alternates: [], sources: [] },
      rank: r.rank || 999,
      why: r.why || '',
    });
  }).sort((a, b) => a.rank - b.rank);

  return {
    company,
    intent,
    domain: domain || null,
    domainSource,
    domainTrusted: related,
    mailProvider: mx.provider,
    mx: mx.hosts,
    patterns,
    shapes,
    people: out,
    emailsFound: personalFound,
    roleBoxes,
    githubPersonal: ghOut.personal.length,
    rolesUsed: roles,
    exaQueries: run.exaQueries,
    usage: {
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      costUsd: Number(run.costUsd.toFixed(6)),
      model: CARD_MODEL,
    },
    notes: run.notes,
    /* Said plainly on every run, because it is the one thing a lead list makes
       people forget: this VM cannot open port 25, so nothing here has been
       SMTP-verified. Published means we read it on a page. */
    verification: 'Published addresses were read from a public page and carry their source. Inferred addresses are guesses from the learned format and are not SMTP-verified.',
  };
}

module.exports = { runSearch, runOne, discoverCompanies, parseProfile, learnPatterns, learnShapes, shapeOfLocal, inferEmail, shapeOf, mxProvider, isDummy, ROLE_BOX, parsePersonBrief, nameMatches, currentEmployersOf, trimLegalTail, stripEmailTail, applyPlan, sharedMailbox };

/* ── targets: zero, one, or several companies ─────────────────────── */

/**
 * Work out WHICH companies to research when the operator did not name one.
 *
 * Luca's ask: the company field may be empty, and the brief alone should be
 * enough — "prompt with multiple company list or even without the company list
 * from our dataset". So the intent drives discovery, and the census is a
 * PREFERENCE, not a fence: a company we already track is more useful because
 * its profile page carries sourced figures, but a company we have never heard
 * of is still a valid answer.
 */
async function discoverCompanies(run, intent, census, step, want) {
  const names = (census || []).map((c) => c.name).filter(Boolean);
  step('discover', 'No company named — finding candidates from the brief');

  /* Ask the web first. A model asked to name Indonesian companies from memory
     will produce plausible ones that do not exist, or died years ago; Exa
     returns companies that have a live page right now. */
  const found = await deadline(
    Promise.all([
      exaSearch(run, `${intent} — Indonesian companies`, { category: 'company', numResults: 10, chars: 600 }),
      exaSearch(run, `Indonesian companies: ${intent}`, { numResults: 10, chars: 600 }),
    ]),
    45000, [], run, 'company discovery');

  const seen = [];
  for (const list of (found || [])) {
    for (const r of (list || [])) {
      let host = '';
      try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { continue; }
      /* Aggregators and listicles are about companies, they are not companies. */
      if (/linkedin|wikipedia|crunchbase|tracxn|glassdoor|jobstreet|medium|youtube|facebook|instagram|techinasia|e27|dailysocial/i.test(host)) continue;
      const title = String(r.title || '').split(/[|–—:-]/)[0].trim();
      if (!title || title.length > 60) continue;
      /* A page-title fragment made only of category words is not a company.
         Real runs shipped "Digital" and "Indonesia Stock API" as research
         targets because the first fragment of a listicle title survived to
         here. A name must carry at least one word that could belong to a
         brand. */
      const nt = tokens(title);
      if (!nt.length || nt.every((t) => GENERIC_NAME.has(t))) continue;
      if (!seen.some((x) => x.host === host)) {
        seen.push({ name: title, host, url: r.url, about: String(r.text || '').replace(/\s+/g, ' ').slice(0, 180) });
      }
    }
  }
  if (!seen.length && run.exaBlocked) throw new Error(run.exaBlocked);

  /* Let the model pick and clean up — it is good at "which of these actually
     match the brief, and what is this company's ordinary name" and is given no
     licence to add anything not in the list. */
  const j = await deepseek(run, [
    {
      role: 'system',
      content: 'You choose which companies match a sales brief. Return ONLY JSON: '
        + '{"companies":[{"name":"<ordinary company name>","domain":"<host>","why":"<max 10 words>"}]}. '
        + `Pick at most ${want}. Choose ONLY from the candidates given — never add a company that is not `
        + 'in the list. Use the company\'s ordinary trading name, not the page title. '
        + 'Prefer companies where the brief plausibly applies.',
    },
    {
      role: 'user',
      content: `Brief: ${intent}\nCandidates: ${JSON.stringify(seen.slice(0, 18))}\n`
        + `Companies already tracked in our census (prefer these when they fit): ${JSON.stringify(names.slice(0, 400))}`,
    },
  ], { maxTokens: 3000 });

  let picked = (j && Array.isArray(j.companies) ? j.companies : [])
    .filter((c) => c && typeof c.name === 'string' && c.name.trim())
    /* The same gate the candidates passed: the model may clean a name, but a
       cleaned name that is all category words ("Digital") is still not a firm. */
    .filter((c) => {
      const nt = tokens(c.name);
      return nt.length && !nt.every((t) => GENERIC_NAME.has(t));
    })
    .slice(0, want)
    .map((c) => ({ name: c.name.trim(), domain: String(c.domain || '').trim(), why: String(c.why || '').slice(0, 80) }));

  /* The model can still hand back a name nobody offered. Keep only what the web
     or the census actually produced — a discovered company must be real. */
  const allow = new Set(seen.map((x) => squash(x.name)).concat(names.map(squash)));
  const kept = picked.filter((c) => {
    const k = squash(c.name);
    return allow.has(k) || seen.some((x) => squash(x.name).includes(k) || k.includes(squash(x.name)));
  });
  if (kept.length) picked = kept;
  else if (picked.length) run.notes.push('the model proposed companies the search did not return; using the raw search order instead');

  if (!picked.length) picked = seen.slice(0, want).map((x) => ({ name: x.name, domain: x.host, why: '' }));
  step('discover', picked.length
    ? `${picked.length} candidate companies: ${picked.map((c) => c.name).join(', ')}`
    : 'no candidate companies could be found from that brief');
  return picked;
}

/**
 * The public entry point. Accepts no company, one, or a comma-separated list,
 * and always returns the same shape so the console never branches.
 */
async function runSearch(opts) {
  const raw = String(opts.company || '').trim();
  const intent = String(opts.intent || '').trim();
  const step = typeof opts.onStep === 'function' ? opts.onStep : () => {};
  const run = newRun();

  /* One field, three meanings. Splitting on commas is what makes "Blibli,
     Tokopedia, Shopee" work without a second input to explain. */
  let targets = raw
    ? raw.split(/\s*[,;\n]+\s*/).map((x) => x.trim()).filter(Boolean).slice(0, 4)
      .map((name) => ({ name, domain: '' }))
    : [];

  /* "carikan email Ricky Hilmi Sudrajad" is a request for ONE person, and it
     must never fall through to company discovery or role expansion — that
     path researched CFOs at companies guessed from a name. The cheap
     deterministic grammars read the common phrasings for free; anything they
     miss goes to the planner, whose model reading is accepted only where it
     quotes the brief verbatim (applyPlan). Run 24 is the case that forced
     this: "Search me ilham ali yafi, from reckitt, get me his email" fell
     through to a four-role hunt across the three stale companies still
     sitting in the form. */
  let personAsk = parsePersonBrief(intent);
  let plan = null;
  if (!personAsk && intent) {
    plan = await planBrief(run, intent);
    if (plan && plan.mode === 'person') {
      personAsk = { person: plan.person, companyHint: plan.companyHint };
      run.notes.push(`the planner read the brief as a person lookup for ${plan.person}`
        + (plan.companyHint ? ` at ${plan.companyHint}` : ''));
    }
  }

  if (personAsk) {
    if (personAsk.companyHint) {
      /* The brief names the employer, and the brief is the ask. The company
         field routinely holds the PREVIOUS run's targets, so when the two
         disagree the field loses — run 24 searched three palm-oil companies
         for a person the brief placed at Reckitt. */
      const hint = trimLegalTail(personAsk.companyHint);
      if (targets.length && !targets.some((t) => squash(t.name) === squash(hint))) {
        run.notes.push(`the brief places ${personAsk.person} at ${hint} — researched that, not the company field (${raw})`);
      }
      targets = [{ name: hint, domain: '' }];
    }
    if (!targets.length) {
      const emp = await findEmployerOf(run, personAsk.person, step);
      if (!emp) {
        throw new Error(`Could not find where ${personAsk.person} works now. `
          + 'Name the company in the company field and run it again.');
      }
      targets = [{ name: emp.employer, domain: '' }];
    }
    step('roles', `Person lookup: ${personAsk.person} at ${targets.map((t) => t.name).join(', ')}`);
  }

  if (!targets.length) {
    if (!intent) {
      throw new Error('Name a company, or describe who you are trying to reach.');
    }
    /* A brief that names its own companies needs no discovery round. */
    if (plan && plan.companies.length) {
      targets = plan.companies.map((n) => ({ name: trimLegalTail(n), domain: '' }));
      step('discover', `The brief itself names: ${targets.map((t) => t.name).join(', ')}`);
    } else {
      const picked = await discoverCompanies(run, intent, opts.census, step, opts.maxCompanies || 3);
      if (!picked.length) {
        throw new Error('Nothing to research: no company was named and the brief did not surface any.');
      }
      targets = picked.map((c) => ({ name: c.name, domain: c.domain, why: c.why }));
    }
  }

  /* Only the first target may use an explicit domain override — it was typed
     for a specific company and would be wrong for the others. */
  if (opts.domain && targets.length) targets[0].domain = String(opts.domain).trim().toLowerCase();

  const multi = targets.length > 1;
  const runs = [];
  for (const t of targets) {
    if (multi) step('company', `Researching ${t.name}`);
    try {
      const one = await runOne({
        company: t.name,
        domain: t.domain,
        intent,
        person: personAsk ? personAsk.person : '',
        focus: plan ? plan.focus : '',
        run,
        /* Without this the census shortcut never fires and every run pays for
           an extra Exa query to rediscover a URL we already hold, verified. */
        census: opts.census,
        onStep: (name, detail) => step(name, multi ? `${t.name}: ${detail}` : detail),
      });
      runs.push(one);
    } catch (e) {
      /* One bad company must not lose the others' results — unless Exa itself
         is refusing every call, in which case the remaining companies would
         only burn time producing the same nothing. */
      run.notes.push(`${t.name}: ${(e && e.message) || 'failed'}`);
      if (run.exaBlocked) throw new Error(run.exaBlocked);
    }
  }
  if (!runs.length) {
    throw new Error(run.exaBlocked || 'Every company in that run failed.');
  }

  const people = [];
  for (const r of runs) {
    for (const p of (r.people || [])) people.push(Object.assign({ company: r.company }, p));
  }
  /* Within one company the ranks are meaningful; across companies they are not
     comparable, so interleave by rank and let the company column carry the
     distinction. */
  people.sort((a, b) => (a.rank || 999) - (b.rank || 999));

  return {
    company: runs.map((r) => r.company).join(', '),
    companies: runs.map((r) => ({
      name: r.company, domain: r.domain, domainTrusted: r.domainTrusted, mailProvider: r.mailProvider,
      patterns: r.patterns, shapes: r.shapes, people: (r.people || []).length,
      emailsFound: r.emailsFound, roleBoxes: r.roleBoxes,
    })),
    multi,
    intent,
    domain: multi ? null : runs[0].domain,
    /* These two carry the refusal-to-guess signal; dropping them here meant the
       warning could never reach the page. */
    domainSource: multi ? null : runs[0].domainSource,
    domainTrusted: multi ? null : runs[0].domainTrusted,
    mailProvider: multi ? null : runs[0].mailProvider,
    mx: multi ? [] : runs[0].mx,
    patterns: multi ? [] : runs[0].patterns,
    shapes: multi ? [] : runs[0].shapes,
    people,
    emailsFound: multi ? [].concat(...runs.map((r) => r.emailsFound || [])) : runs[0].emailsFound,
    roleBoxes: multi ? [].concat(...runs.map((r) => r.roleBoxes || [])) : runs[0].roleBoxes,
    rolesUsed: runs[0].rolesUsed,
    exaQueries: run.exaQueries,
    usage: {
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      costUsd: Number(run.costUsd.toFixed(6)),
      model: CARD_MODEL,
    },
    notes: run.notes,
    verification: runs[0].verification,
  };
}
