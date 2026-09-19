#!/usr/bin/env python3
"""People search for census companies — who to talk to, and how to reach them.

Luca, Aug 29 2026: "im looking business development person in stickearn... try
to hit exa to get its list email".

This is the contact-enrichment lane the 1001startup census was always headed
for. It does three separate jobs and keeps their evidence separate, because
they have very different reliability:

  1. PEOPLE   — Exa /search with category='linkedin profile' over several role
     phrasings, then /contents on every hit. Exa's LinkedIn text carries the
     experience block with a literal "(Current)" marker, the department and the
     level, so we can gate on CURRENTLY-AT-COMPANY instead of trusting a
     headline. Stale headlines are the main failure mode here: someone who left
     in 2019 can still read "BD Executive at X" at the top of the profile.
  2. EMAILS FOUND  — addresses at the company domain that literally appear in
     an indexed page, kept with the URL they came from. These are facts.
  3. EMAILS INFERRED — first@ / first.last@ built from the dominant pattern.
     These are guesses and are labelled as guesses. Port 25 is blocked from
     this VM so nothing here is SMTP-verified; treat every inferred address as
     a hypothesis to be tested by sending, not as a sourced datum.

Cost is roughly US$0.05-0.10 of Exa per company (4 searches + 2 content pulls).

    python3 scripts/leads.py stickearn
    python3 scripts/leads.py stickearn --roles "product manager,CTO"
    python3 scripts/leads.py --name "Qiscus" --domain qiscus.com
"""
import argparse, csv, json, os, re, subprocess, sys, urllib.request, urllib.error
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
OUTDIR = os.path.join(ROOT, 'data', 'leads')
SECRETS = os.path.expanduser('~/.openclaw/secrets/exa.env')

# Default hunt = the commercial side: who buys, who partners, who sells.
DEFAULT_ROLES = [
    "business development manager",
    "head of sales OR sales director OR chief commercial officer",
    "strategic partnerships OR partnership manager",
    "co-founder OR CEO OR COO leadership team",
]

# Seniority ladder, used only to rank — never to invent a title.
SENIORITY = [
    (re.compile(r'\b(founder|co-?founder|ceo|coo|cbo|cro|chief|president|managing director)\b', re.I), 5, 'exec'),
    (re.compile(r'\b(vp|vice president|head of|group head|director)\b', re.I), 4, 'head'),
    (re.compile(r'\b(lead|manager|principal)\b', re.I), 3, 'manager'),
    (re.compile(r'\b(senior|sr\.?)\b', re.I), 2, 'senior'),
]
RELEVANT = re.compile(r'business development|\bbd\b|partnership|sales|commercial|account executive|'
                      r'client|revenue|growth|agency relation', re.I)
# Exa's LinkedIn text marks live roles literally; that marker is the whole gate.
CURRENT = re.compile(r'\(Current\)')
EMAIL = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
# Placeholders that pattern-directory pages print as illustrations, not as people.
# Format-directory pages print dummy addresses as illustrations. Every token of a
# dummy local part comes from this vocabulary, so reject on the whole local part.
DUMMY = {'john', 'jane', 'jon', 'doe', 'smith', 'michael', 'first', 'firstname', 'last',
         'lastname', 'middle', 'initial', 'example', 'name', 'username', 'user', 'email',
         'j', 'f', 'l', 'm', 'jd', 'js', 'jsmith', 'johndoe', 'johnsmith', 'jdoe'}


def placeholder(local):
    return all(t in DUMMY for t in re.split(r'[._-]+', local.lower()) if t)
MDLINK = re.compile(r'\[([^\]]+)\]\(https?://[^)]+\)')
SINCE = re.compile(r'([A-Z][a-z]{2} \d{4})\s*-\s*Present')
LEVEL = re.compile(r'Level:\s*([A-Za-z]+)')
DEPT = re.compile(r'Department:\s*([A-Za-z /&]+)')


def clean(s):
    """LinkedIn text is markdown; a role reads 'Sales Director - [StickEarn](url)'."""
    s = MDLINK.sub(r'\1', s or '')
    return re.sub(r'\s+', ' ', s).strip(' -|')


def key():
    k = os.environ.get('EXA_API_KEY')
    if not k and os.path.exists(SECRETS):
        for line in open(SECRETS):
            if line.startswith('EXA_API_KEY='):
                k = line.split('=', 1)[1].strip().strip('"\'')
    if not k:
        sys.exit('no EXA_API_KEY (looked in env and %s)' % SECRETS)
    return k


def exa(ep, body, k):
    req = urllib.request.Request('https://api.exa.ai' + ep, data=json.dumps(body).encode(),
                                 headers={'x-api-key': k, 'Content-Type': 'application/json'})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=120).read())
    except urllib.error.HTTPError as e:
        print('  ! exa %s %s: %s' % (ep, e.code, e.read()[:200].decode('utf8', 'replace')), file=sys.stderr)
        return {'results': []}


def mx(domain):
    try:
        out = subprocess.run(['dig', '+short', 'MX', domain], capture_output=True, text=True, timeout=15).stdout
        hosts = [l.split()[-1].rstrip('.').lower() for l in out.splitlines() if l.strip()]
        if any('google' in h for h in hosts):
            return 'Google Workspace', hosts
        if any('outlook' in h or 'protection.outlook' in h for h in hosts):
            return 'Microsoft 365', hosts
        return ('other' if hosts else 'none'), hosts
    except Exception:
        return 'unknown', []


def company_from_census(cid):
    raw = json.load(open(RAW))
    cos = raw.get('companies', raw if isinstance(raw, list) else [])
    for c in cos:
        if c.get('id') == cid or c.get('name', '').lower() == cid.lower():
            return c
    sys.exit('no census company %r (try --name/--domain)' % cid)


def score(headline, role):
    blob = '%s %s' % (headline or '', role or '')
    s, band = 1, 'ic'
    for rx, pts, name in SENIORITY:
        if rx.search(blob):
            s, band = pts, name
            break
    return (s + (2 if RELEVANT.search(blob) else 0)), band


def parse_profile(text, company):
    """Pull the live role at `company` out of an Exa LinkedIn dump.

    The experience section comes in two shapes and the difference matters — a
    sliding window around the company name once credited a co-founder's role at
    a DIFFERENT company to this one, because his headline named both:

        ### <Role> - [Company](url) (Current)      <- flat entry
        ### [Company](url)                          <- grouped entry
        #### <Role> (Current)

    So walk the blocks, decide each block's employer from its own heading, and
    only then look for (Current).
    """
    if company.lower() not in text.lower():
        return None
    hit, saw_other_current = None, False
    blocks = re.split(r'\n(?=###\s)', text)
    for blk in blocks:
        head = clean(blk.split('\n', 1)[0].lstrip('#').strip())
        if not head:
            continue
        # employer = the bracketed company on the heading, else its trailing "- X"
        mine = company.lower().replace(' ', '') in head.lower().replace(' ', '')
        entries = re.findall(r'^####\s*([^\n]+)$', blk, re.M)
        if entries:  # grouped: employer on ###, roles on ####
            for e in entries:
                cur = '(Current)' in e
                if mine and cur:
                    hit = hit or (clean(e.replace('(Current)', '')), blk)
                elif cur:
                    saw_other_current = True
        else:  # flat: role and employer share the ### line
            cur = '(Current)' in blk.split('\n', 1)[0]
            if mine and cur:
                role = clean(re.sub(r'\(Current\)', '', head))
                role = re.split(r'\s+-\s+' + re.escape(company), role, flags=re.I)[0].strip(' -')
                hit = hit or (role, blk)
            elif cur:
                saw_other_current = True
    flat = re.sub(r'\s+', ' ', text)
    if hit:
        role, blk = hit
        sm, lv, dp = SINCE.search(blk), LEVEL.search(blk), DEPT.search(blk)
        return {'role': role, 'since': sm.group(1) if sm else None, 'status': 'current',
                'level': lv.group(1) if lv else None, 'department': dp.group(1).strip() if dp else None}
    # named the company but has no live role at it: former, or an unparseable page
    hm = re.search(r'^#\s*[^\n]+\n\s*([^\n]+)', text)
    headline = clean(hm.group(1)) if hm else None
    at_co = bool(re.search(r'(?:at|@)\s*%s' % re.escape(company), headline or '', re.I))
    return {'role': headline, 'since': None,
            'status': 'former' if (saw_other_current or at_co) else 'unclear',
            'level': None, 'department': None}


def name_from(title, text):
    m = re.search(r'^#\s*([^\n|]+)', text or '')
    n = (m.group(1) if m else (title or '').split('|')[0].split(' - ')[0]).strip()
    return re.sub(r'\s+', ' ', n)


def slugify_name(name):
    ascii_name = re.sub(r'[^a-zA-Z ]', ' ', name).lower().split()
    return ascii_name


ROLE_BOX = re.compile(r'^(info|contact|hello|halo|sales|marketing|marcom|admin|support|cs|care|help|'
                      r'hr|recruitment|career|careers|press|media|legal|finance|billing|partnership|'
                      r'partnerships|business|noreply|no-reply|team|office|general)$', re.I)


def shape(local, name):
    """Which format produced this address for this person? '' if it isn't theirs."""
    parts = slugify_name(name)
    if not parts:
        return ''
    f, l = parts[0], parts[-1]
    cands = {'first': f}
    if len(parts) > 1:
        cands.update({'first.last': '%s.%s' % (f, l), 'firstlast': '%s%s' % (f, l),
                      'f.last': '%s.%s' % (f[0], l), 'flast': '%s%s' % (f[0], l),
                      'first_last': '%s_%s' % (f, l), 'first.m': '%s.%s' % (f, parts[1])})
    for pat, v in cands.items():
        if v == local:
            return pat
    return ''


def learn_patterns(found, people, claimed):
    """Derive the email format from addresses we actually saw, not from a vendor's claim.

    Every personal address found on the domain is matched against the people we
    found; the shapes that match are the evidence. A directory page's stated
    percentages are kept only as corroboration, tagged with where they came from.
    """
    ev = {}
    for e, srcs in found.items():
        local = e.split('@')[0]
        if ROLE_BOX.match(local):
            continue
        # Only an address we can pin to a named person is evidence of a format.
        # Paxel taught this: shared mailboxes (wehearyou@, salescorp@) and a
        # directory's dummy rows otherwise voted, and outvoted, the real ones.
        for p in people:
            sh = shape(local, p['name'])
            if sh:
                ev.setdefault(sh, []).append({'email': e, 'person': p['name'], 'sources': sorted(srcs)})
                break
    out = []
    for pat, hits in sorted(ev.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        c = next((c for c in claimed if c[0] == pat), None)
        out.append({'pattern': pat, 'observed': len(hits), 'evidence': hits[:4],
                    'third_party_share_pct': c[1] if c else None,
                    'third_party_source': c[2] if c else None})
    for pat, pct, src in claimed:  # claimed but never observed here
        if not any(o['pattern'] == pat for o in out):
            out.append({'pattern': pat, 'observed': 0, 'evidence': [],
                        'third_party_share_pct': pct, 'third_party_source': src})
    return out


def infer(name, domain, patterns):
    parts = slugify_name(name)
    if not parts:
        return []
    first, last = parts[0], (parts[-1] if len(parts) > 1 else '')
    out = []
    for p, pct in patterns:
        local = {'first': first,
                 'first.last': '%s.%s' % (first, last) if last else None,
                 'firstlast': '%s%s' % (first, last) if last else None,
                 'f.last': '%s.%s' % (first[0], last) if last else None,
                 'flast': '%s%s' % (first[0], last) if last else None,
                 'first_last': '%s_%s' % (first, last) if last else None}.get(p)
        if local:
            out.append({'email': '%s@%s' % (local, domain), 'pattern': p, 'pattern_share': pct,
                        'status': 'inferred — NOT verified'})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('company_id', nargs='?')
    ap.add_argument('--name'); ap.add_argument('--domain')
    ap.add_argument('--roles', help='comma-separated role queries to override the default commercial hunt')
    ap.add_argument('--results', type=int, default=12)
    a = ap.parse_args()
    k = key()

    if a.company_id:
        c = company_from_census(a.company_id)
        name, url, cid = c['name'], c.get('url', ''), c['id']
    elif a.name:
        name, url, cid = a.name, a.domain or '', re.sub(r'[^a-z0-9]+', '-', a.name.lower()).strip('-')
    else:
        sys.exit('need a census id, or --name/--domain')
    domain = (a.domain or re.sub(r'^www\.', '', re.sub(r'^https?://', '', url).split('/')[0])).lower()
    roles = [r.strip() for r in a.roles.split(',')] if a.roles else DEFAULT_ROLES
    print('%s  <%s>' % (name, domain))

    # ---- 1. people ---------------------------------------------------------
    hits, spend = {}, 0.0
    for r in roles:
        d = exa('/search', {'query': '%s %s Indonesia' % (name, r), 'category': 'linkedin profile',
                            'numResults': a.results}, k)
        spend += (d.get('costDollars') or {}).get('total', 0)
        for res in d.get('results', []):
            u = re.sub(r'/en/?$', '', res['url'].rstrip('/'))
            u = re.sub(r'^https?://(?:[a-z]{2}\.)?linkedin\.com', 'https://www.linkedin.com', u)
            hits.setdefault(u, res.get('title'))
    print('  %d candidate profiles' % len(hits))

    people = []
    urls = list(hits)
    for i in range(0, len(urls), 20):
        d = exa('/contents', {'urls': urls[i:i + 20], 'text': {'maxCharacters': 2500}}, k)
        spend += (d.get('costDollars') or {}).get('total', 0)
        for res in d.get('results', []):
            text = res.get('text') or ''
            p = parse_profile(text, name)
            if not p:
                continue
            pname = name_from(res.get('title'), text)
            sc, band = score(res.get('title'), p['role'])
            blob = '%s %s' % (res.get('title') or '', p['role'] or '')
            people.append({'name': pname, 'linkedin': res['url'], 'seniority': band, 'score': sc,
                           'relevant': bool(RELEVANT.search(blob)) or band == 'exec',
                           **p})
    # collapse the duplicate id.linkedin/www.linkedin rows Exa returns for one person
    dedup = {}
    for p in people:
        kk = re.sub(r'[^a-z]', '', p['name'].lower())
        if kk not in dedup or p['score'] > dedup[kk]['score']:
            dedup[kk] = p
    people = sorted(dedup.values(), key=lambda p: (p['status'] != 'current', -p['score'], p['name']))

    # ---- 2. emails that actually appear somewhere --------------------------
    found, patterns = {}, []
    # Real addresses leak in predictable places: the contact page, hiring posts
    # ("send your CV to ..."), press releases, media kits and format directories.
    for q in ['%s contact email sales partnership site:%s' % (name, domain),
              '"@%s" email address %s staff' % (domain, name),
              '%s hiring "send your CV" OR "kirim CV" email @%s' % (name, domain),
              '%s email format employees @%s' % (name, domain)]:
        d = exa('/search', {'query': q, 'numResults': 8, 'contents': {'text': {'maxCharacters': 6000}}}, k)
        spend += (d.get('costDollars') or {}).get('total', 0)
        for res in d.get('results', []):
            body = res.get('text') or ''
            for e in EMAIL.findall(body):
                e = e.lower()
                if not e.endswith('@' + domain):
                    continue
                if placeholder(e.split('@')[0]):
                    continue
                found.setdefault(e, set()).add(res['url'])
            # directory pages state the dominant pattern outright
            for pm in re.finditer(r'\[(first|first_initial)\]\s*(?:(\.|_)\s*\[(last|last_initial)\])?'
                                  r'[^%\[]{0,140}?(\d{1,3}(?:\.\d+)?)\s*%', body):
                sep = pm.group(2) or ''
                p = {('first', '', None): 'first', ('first', '.', 'last'): 'first.last',
                     ('first', '_', 'last'): 'first_last', ('first', '.', 'last_initial'): 'first.l',
                     ('first_initial', '.', 'last'): 'f.last'}.get((pm.group(1), sep, pm.group(3)))
                if p:
                    patterns.append((p, float(pm.group(4)), res['url']))
    claimed = sorted({(p, pct): src for p, pct, src in patterns}.items(), key=lambda x: -x[0][1])
    claimed = [(p, pct, src) for (p, pct), src in claimed]
    learned = learn_patterns(found, people, claimed)
    pat_list = [(o['pattern'], o['third_party_share_pct']) for o in learned
                if o['observed'] or o['third_party_share_pct']][:2] or [('first.last', None), ('first', None)]
    provider, hosts = mx(domain)

    out = {'company': name, 'id': cid, 'domain': domain, 'checked': str(date.today()),
           'mail_provider': provider, 'mx': hosts, 'exa_cost_usd': round(spend, 4),
           'email_patterns': learned,
           'email_patterns_note': ('ranked by addresses actually observed on this domain; '
                                   'third_party_share_pct is a directory site\'s claim, kept as corroboration'),
           'emails_found': [{'email': e, 'sources': sorted(v), 'status': 'found verbatim',
                             'kind': 'role mailbox' if ROLE_BOX.match(e.split('@')[0]) else 'personal'}
                            for e, v in sorted(found.items())],
           'people': []}
    # A first-name pattern breaks on shared first names, and Indonesian rosters are
    # full of them (Muhammad, Ahmad, Dwi...). Flag the collisions rather than shipping
    # two people the same address.
    firsts = {}
    for p in people:
        fp = slugify_name(p['name'])
        if fp:
            firsts.setdefault(fp[0], []).append(p['name'])
    for p in people:
        p['emails_inferred'] = infer(p['name'], domain, pat_list) if p['status'] == 'current' else []
        fp = slugify_name(p['name'])
        clash = firsts.get(fp[0], []) if fp else []
        if len(clash) > 1 and p['emails_inferred'] and p['emails_inferred'][0]['pattern'] == 'first':
            p['first_name_collision'] = [n for n in clash if n != p['name']]
            p['emails_inferred'][0]['status'] = ('inferred — AMBIGUOUS, first name shared with %s'
                                                 % ', '.join(p['first_name_collision']))
            p['emails_inferred'].sort(key=lambda e: e['pattern'] != 'first.last')
        out['people'].append(p)

    os.makedirs(OUTDIR, exist_ok=True)
    dest = os.path.join(OUTDIR, '%s.json' % cid)
    json.dump(out, open(dest, 'w'), indent=1, ensure_ascii=False)

    csvp = os.path.join(OUTDIR, '%s.csv' % cid)
    with open(csvp, 'w', newline='') as fh:
        w = csv.writer(fh)
        w.writerow(['name', 'role', 'since', 'seniority', 'email_best', 'email_confidence',
                    'email_alt', 'linkedin', 'status'])
        for p in out['people']:
            got = next((f for f in out['emails_found'] if f['kind'] == 'personal'
                        and shape(f['email'].split('@')[0], p['name'])), None)
            best = got['email'] if got else (p['emails_inferred'][0]['email'] if p['emails_inferred'] else '')
            conf = 'published' if got else ('inferred' if best else '')
            alt = '' if got else (p['emails_inferred'][1]['email'] if len(p['emails_inferred']) > 1 else '')
            w.writerow([p['name'], p['role'], p['since'] or '', p['seniority'], best, conf, alt,
                        p['linkedin'], p['status']])

    cur = [p for p in people if p['status'] == 'current']
    print('  %d current / %d former-or-unclear · %d real addresses on the domain · mail: %s'
          % (len(cur), len(people) - len(cur), len(found), provider))
    for p in cur:
        if p['relevant']:
            print('   %-30s %-46s %s' % (p['name'][:30], (p['role'] or '')[:46],
                                         p['emails_inferred'][0]['email'] if p['emails_inferred'] else ''))
    print('  -> %s + .csv  (US$%.3f)' % (dest, spend))


if __name__ == '__main__':
    main()
