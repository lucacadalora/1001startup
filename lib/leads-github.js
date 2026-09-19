'use strict';
/**
 * Verbatim corporate addresses out of public git history.
 *
 * This is the highest-yield evidence source we have, and it exists because of
 * what happened on the Blibli run: not one of eight named targets published an
 * address anywhere Exa had indexed — profiles, hiring posts and speaker pages
 * were all empty — yet twenty real @gdn-commerce.com addresses were sitting in
 * public commit metadata. Engineers commit with their work address and never
 * think about it again.
 *
 * The addresses harvested here are almost never the person you are hunting.
 * That is fine, and it is the point: they are the CORPUS the email-format
 * learner votes on. Twenty real addresses turn "first.last is probably the
 * pattern" into a measured claim with a denominator.
 *
 * Two rules learned the hard way:
 *
 *  - A commit in an org's repo is not evidence about the org. Upstream authors
 *    ride along in forks (Blibli's fork of elasticsearch carried Apache
 *    committers' addresses). Only an address AT THE COMPANY DOMAIN counts.
 *  - A personal address found this way (someone's gmail from their own commits)
 *    is deliberately NOT returned as a contact. It is verbatim and it is real,
 *    but a cold pitch arriving at a personal inbox sourced from git archaeology
 *    reads as surveillance and costs the meeting. It is returned only under
 *    `personal`, flagged, so the caller can corroborate a name spelling.
 */
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/* GitHub's own noreply forms carry no information, and CI bots are not people. */
const NOISE = /noreply|users\.noreply|\[bot\]|actions@|github-actions|dependabot/i;

const UA = { 'User-Agent': 'vantis-1001-leads', Accept: 'application/vnd.github+json' };

async function gh(url, timeoutMs = 12000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const headers = Object.assign({}, UA);
    /* Unauthenticated GitHub is 60 req/hr per IP, which a single run can burn
       through. A token, when present, raises it to 5,000 — but its absence must
       degrade to fewer results, never to an exception. */
    if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
    const r = await fetch(url, { headers, signal: ac.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Every distinct author identity in a list of commit objects. */
function authorsOf(commits) {
  const out = [];
  if (!Array.isArray(commits)) return out;
  for (const c of commits) {
    const a = c && c.commit && c.commit.author;
    if (a && a.email) out.push({ name: String(a.name || '').trim(), email: String(a.email).toLowerCase() });
  }
  return out;
}

/**
 * @param {string} domain   company mail domain, e.g. 'gdn-commerce.com'
 * @param {string[]} orgs   candidate GitHub org logins to sweep
 * @returns {{corporate: Array, personal: Array, orgsTried: string[], repos: number}}
 */
async function harvest(domain, orgs, opts) {
  opts = opts || {};
  const maxRepos = opts.maxRepos || 8;
  const seen = new Map();      // email -> {name, sources:Set}
  const personal = new Map();
  const orgsTried = [];
  let repos = 0;

  const keep = (a, source) => {
    if (!a.email || NOISE.test(a.email)) return;
    const bucket = a.email.endsWith('@' + domain) ? seen : personal;
    /* Personal addresses are only interesting when they belong to someone whose
       name we can read; an anonymous gmail teaches us nothing about anything. */
    if (bucket === personal && !a.name) return;
    const prev = bucket.get(a.email) || { name: a.name, sources: new Set() };
    if (!prev.name && a.name) prev.name = a.name;
    prev.sources.add(source);
    bucket.set(a.email, prev);
  };

  for (const org of (orgs || []).slice(0, 3)) {
    orgsTried.push(org);
    const list = await gh(`https://api.github.com/orgs/${encodeURIComponent(org)}/repos?per_page=${maxRepos}&sort=pushed`);
    if (!Array.isArray(list)) continue;
    for (const repo of list.slice(0, maxRepos)) {
      repos++;
      const commits = await gh(`https://api.github.com/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo.name)}/commits?per_page=30`);
      for (const a of authorsOf(commits)) keep(a, `github.com/${org}/${repo.name}`);
    }
  }

  /* The org sweep only sees repos the company owns. A global commit search
     catches addresses that leaked through employees' personal repos and forks,
     which is where several of the Blibli finds actually lived. It needs auth,
     so it is best-effort. */
  const q = await gh(`https://api.github.com/search/commits?q=${encodeURIComponent(domain)}&per_page=100`);
  if (q && Array.isArray(q.items)) {
    for (const a of authorsOf(q.items)) keep(a, 'github commit search');
  }

  const pack = (m) => Array.from(m.entries())
    .map(([email, v]) => ({ email, name: v.name || null, sources: Array.from(v.sources) }))
    .sort((x, y) => x.email.localeCompare(y.email));

  return { corporate: pack(seen), personal: pack(personal), orgsTried, repos };
}

/**
 * Guess org logins to try. GitHub search would be better but costs a call and
 * needs auth; these forms cover the common cases (bliblidotcom, tokopedia).
 */
function orgCandidates(company, domain) {
  const base = String(company || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const host = String(domain || '').split('.')[0].replace(/[^a-z0-9]+/g, '');
  const dotcom = base ? base + 'dotcom' : '';
  return [base, host, dotcom].filter((v, i, a) => v && a.indexOf(v) === i);
}

module.exports = { harvest, orgCandidates };
