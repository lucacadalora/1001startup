#!/usr/bin/env python3
"""census-headcount.py — refresh every row's headcount from LinkedIn, live, via Exa.

Luca, Aug 29 2026, on the Bahasa.ai row carrying "about 20 people" from a Nov 2024
East Ventures article: "this 20 employees information is fatal ... you cant use 2024
data, we need do 2026 data. you can try to fetch with exa.ai api, check linkedin etc
so we can get the latest real latest information of head count."

Two phases, both idempotent, both writing to their OWN file (data/census-headcount.json)
so a parallel session editing census-raw.json can never lose this work:

  resolve  find each company's LinkedIn company page (Exa search, name-matched)
  crawl    live-crawl those pages through Exa and parse the people count

`apply` then merges the cache into census-raw.json under rules that refuse to
overwrite a better-sourced figure (filings, a company's own statement) and refuse
to auto-apply a wild swing — those are printed for a human instead.

Usage:
  python3 scripts/census-headcount.py resolve [--limit N] [--only id,id]
  python3 scripts/census-headcount.py crawl   [--limit N] [--only id,id] [--stale-days N]
  python3 scripts/census-headcount.py apply   [--dry-run]
"""
import argparse, json, os, re, sys, time, datetime, tempfile, urllib.request, urllib.error, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
CACHE = os.path.join(HERE, '..', 'data', 'census-headcount.json')
SECRETS = os.path.expanduser('~/.openclaw/secrets/exa.env')
TODAY = datetime.date.today().isoformat()

LI = re.compile(r'https?://(?:[a-z]{2}\.)?linkedin\.com/company/[^/?\s"\'#]+', re.I)


def host(u):
    try:
        return urllib.parse.urlparse(u).netloc.lower().replace('www.', '')
    except Exception:
        return ''


def api_key():
    for line in open(SECRETS, encoding='utf-8'):
        if line.startswith('EXA_API_KEY='):
            return line.split('=', 1)[1].strip()
    raise SystemExit('no EXA_API_KEY in ' + SECRETS)


def exa(path, body, key, timeout=120):
    req = urllib.request.Request('https://api.exa.ai/' + path,
                                 data=json.dumps(body).encode(),
                                 headers={'x-api-key': key, 'Content-Type': 'application/json'},
                                 method='POST')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(3 * (attempt + 1)); continue
            raise SystemExit(f'exa {path} {e.code}: {e.read()[:300]}')
        except Exception:
            if attempt < 2:
                time.sleep(3 * (attempt + 1)); continue
            raise
    return {}


def load(p, default):
    try:
        return json.load(open(p, encoding='utf-8'))
    except FileNotFoundError:
        return default


def save(p, obj):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(p), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, p)


def norm(s):
    """Loose name key: 'PT Bahasa Teknologi' and 'Bahasa.ai' both reduce to letters."""
    s = re.sub(r'\(.*?\)', ' ', (s or '').lower())
    s = re.sub(r'\b(pt|tbk|inc|ltd|pte|group|indonesia|technologies|technology|teknologi|holdings)\b', ' ', s)
    return re.sub(r'[^a-z0-9]', '', s)


def name_matches(census_name, li_text):
    a, b = norm(census_name), norm(li_text)
    if not a or not b:
        return False
    return a in b or b in a or (len(a) >= 5 and a[:6] in b)


# ---------------------------------------------------------------- resolve
def resolve(args):
    key = api_key()
    raw, cache = load(RAW, {}), load(CACHE, {})
    rows = pick(raw['companies'], args)
    todo = [c for c in rows if not (cache.get(c['id']) or {}).get('linkedin')]
    print(f'resolve: {len(todo)} of {len(rows)} rows need a LinkedIn URL')
    for i, c in enumerate(todo, 1):
        ent = cache.setdefault(c['id'], {'name': c['name']})
        # already in the record? use it, no API call
        known = next((u for u in (c.get('sources') or []) + (c.get('enrich_sources') or []) if LI.match(u or '')), None)
        if known:
            ent.update(linkedin=LI.match(known).group(0), linkedin_src='census sources')
        else:
            q = f"{c['name']} {c.get('kota') or ''} Indonesia company"
            res = exa('search', {'query': q, 'numResults': 5, 'includeDomains': ['linkedin.com'],
                                 'contents': {'text': {'maxCharacters': 300}}}, key)
            hit = None
            for r in res.get('results', []):
                u = r.get('url') or ''
                if '/company/' not in u:
                    continue
                if name_matches(c['name'], (r.get('title') or '') + ' ' + (r.get('text') or '')[:200]) \
                   or name_matches(c.get('legal_name') or '', (r.get('title') or '')):
                    hit = LI.match(u).group(0) if LI.match(u) else u.split('?')[0]
                    break
            if hit:
                ent.update(linkedin=hit, linkedin_src='exa search')
            else:
                ent.update(linkedin=None, linkedin_src='not found', resolved=TODAY)
        if i % 20 == 0 or i == len(todo):
            save(CACHE, cache)
            print(f'  {i}/{len(todo)}')
    save(CACHE, cache)
    got = sum(1 for v in cache.values() if v.get('linkedin'))
    print(f'resolved: {got} LinkedIn URLs cached, {len(cache) - got} not found')


# ---------------------------------------------------------------- crawl
COUNT_PATTERNS = [
    re.compile(r'Discover all ([\d,]+) employees', re.I),
    re.compile(r'View ([\d,]+) employees at', re.I),
    re.compile(r'See all ([\d,]+) employees', re.I),
    re.compile(r'([\d,]+) associated members', re.I),
]
BAND = re.compile(r'Company size\s+([\d,]+(?:\s*-\s*[\d,]+)?\+?)\s+employees', re.I)
# Exa's own indexed company blurb, which often carries a count when the live page render does not
EMPLOYS = re.compile(r'employs ([\d,]+) (?:people|employees)', re.I)
HQ = re.compile(r'Headquarters\s+([^\n]{2,80})')


def parse_li(text):
    out = {}
    for p in COUNT_PATTERNS:
        m = p.search(text or '')
        if m:
            out['count'] = int(m.group(1).replace(',', ''))
            break
    m = BAND.search(text or '')
    if m:
        out['band'] = m.group(1).strip()
    m = HQ.search(text or '')
    if m:
        out['hq'] = m.group(1).strip()
    if 'count' not in out:
        m = EMPLOYS.search(text or '')
        if m:
            out['count'] = int(m.group(1).replace(',', ''))
            out['count_src'] = 'exa blurb'
    return out


def crawl(args):
    key = api_key()
    raw, cache = load(RAW, {}), load(CACHE, {})
    rows = pick(raw['companies'], args)
    stale = args.stale_days
    todo = []
    for c in rows:
        e = cache.get(c['id']) or {}
        if not e.get('linkedin'):
            continue
        if e.get('crawled') and stale:
            age = (datetime.date.today() - datetime.date.fromisoformat(e['crawled'])).days
            if age < stale:
                continue
        todo.append(c)
    print(f'crawl: {len(todo)} pages')
    B = 8
    for i in range(0, len(todo), B):
        chunk = todo[i:i + B]
        urls = [cache[c['id']]['linkedin'] for c in chunk]
        res = exa('contents', {'urls': urls, 'livecrawl': 'always',
                               'text': {'maxCharacters': 2500}}, key, timeout=180)
        by_url = {}
        for r in res.get('results', []):
            by_url[(r.get('url') or '').rstrip('/')] = r
        for c, u in zip(chunk, urls):
            e = cache[c['id']]
            r = by_url.get(u.rstrip('/')) or next((v for k, v in by_url.items()
                                                   if k.split('/company/')[-1] == u.split('/company/')[-1]), None)
            e['crawled'] = TODAY
            if not r:
                e['error'] = 'no content'
                continue
            txt = r.get('text') or ''
            got = parse_li(txt)
            e.pop('error', None)
            # a page that does not name this company is the wrong page: drop it
            head = txt[:400]
            e['li_name'] = (re.search(r'^#\s*(.+)$', txt, re.M).group(1).strip()
                            if re.search(r'^#\s*(.+)$', txt, re.M) else '')
            e['verified'] = bool(name_matches(c['name'], e['li_name'] or head)
                                 or name_matches(c.get('legal_name') or '', e['li_name'] or head))
            e.update({k: got.get(k) for k in ('count', 'band', 'hq')})
        save(CACHE, cache)
        print(f'  {min(i + B, len(todo))}/{len(todo)}')
    # LinkedIn's live render sometimes omits the people count entirely; Exa's indexed
    # copy of the same page usually still carries it, so ask for that before giving up
    missing = [c for c in todo if not (cache.get(c['id']) or {}).get('count')]
    if missing:
        print(f'  fallback search for {len(missing)} rows without a count')
        for c in missing:
            e = cache[c['id']]
            res = exa('search', {'query': f"{c['name']} Indonesia LinkedIn company employees",
                                 'numResults': 4, 'includeDomains': ['linkedin.com'],
                                 'contents': {'text': {'maxCharacters': 1500}}}, key)
            for r in res.get('results', []):
                if '/company/' not in (r.get('url') or ''):
                    continue
                txt = r.get('text') or ''
                if not (name_matches(c['name'], (r.get('title') or '') + txt[:200])):
                    continue
                got = parse_li(txt)
                if got.get('count'):
                    e.update({k: v for k, v in got.items() if v})
                    e['verified'] = True
                    e['count_src'] = e.get('count_src') or 'exa index'
                    e.pop('error', None)
                    break
        save(CACHE, cache)
    ok = sum(1 for v in cache.values() if v.get('count'))
    print(f'crawled: {ok} rows with a live people count')


# ---------------------------------------------------------------- apply
# Refresh like for like. A LinkedIn people count is a lower bound for any company whose
# workforce is not desk-based — couriers, baristas, drivers do not keep profiles — so it may
# only REPLACE a figure that was itself read off LinkedIn. Anything sourced from a filing, a
# company statement or a headcount report keeps its number and merely gets cross-checked.
REPLACEABLE = re.compile(r'(linkedin|leadiq|zoominfo|pitchbook|revelio|craft\.co|growjo|tracxn|'
                         r'cb insights|apollo\.io|rocketreach|glints|kitalulus)', re.I)
# figures that measure something a LinkedIn profile count does not: a filing, a company's own
# statement, or a deliberately Indonesia-scoped carve-out of a group-wide number
PROTECTED = re.compile(r'(filing|annual report|laporan|prospectus|own profile|company statement|'
                       r'press release|idx|sec filing|10-k|financial statement|group-wide|'
                       r'indonesia[- ]side|carve|of the group|couriers|drivers|outlets|stores)', re.I)


# Reject only what is clearly a DIFFERENT company: a foreign headquarters, or a page
# co-branded with another organisation. A LinkedIn page routinely appends a descriptor
# ("iSeller Commerce", "Amartha Financial", "Ralali.com - B2B Marketplace") and that is
# still the right company.
FOREIGN_HQ = re.compile(r'(new zealand|philippines|manila|\bindia\b|bengaluru|mumbai|vietnam|hanoi|'
                        r'thailand|bangkok|malaysia|kuala lumpur|australia|sydney|melbourne|'
                        r'united states|san francisco|new york|california|london|united kingdom|'
                        r'\bchina\b|shenzhen|hong kong|japan|tokyo|korea|seoul|taiwan|dubai|'
                        r'netherlands|germany|france)', re.I)
# only a genuine second organisation counts as co-branding: "RevoU x Telkom Indonesia".
# An ampersand is just punctuation in "Dealls - Jobs, CV & Mentoring".
COBRAND = re.compile(r'(\s[x×]\s|\bpartnership with\b|\bpowered by\b)', re.I)


def wrong_entity(c, e):
    """Is the crawled page plausibly THIS company?

    Two real misses from the first run: RevoU resolved to 'RevoU x Telkom Indonesia',
    a co-branded programme page, and MySkill to MySkill NZ in New Zealand — both passed
    a loose substring match and would have cut those rows by 30x."""
    if e.get('manual_ok'):
        return None                      # verified by hand, see data/census-headcount.json
    li_raw = e.get('li_name') or ''
    li, a, b = norm(li_raw), norm(c['name']), norm(c.get('legal_name') or '')
    if COBRAND.search(li_raw) and not COBRAND.search(c['name']):
        return 'LinkedIn page is co-branded ("%s")' % li_raw
    hq = e.get('hq') or ''
    if FOREIGN_HQ.search(hq):
        return 'LinkedIn page is headquartered in %s' % hq
    # LinkedIn routinely reorders or suffixes the name ("Somethinc - BeautyHaul",
    # "Alfagift - Global Loyalty Indonesia"), so compare word sets too, not just prefixes
    words = lambda x: {w for w in re.split(r'[^a-z0-9]+', (x or '').lower()) if len(w) > 2}
    wl, wa, wb = words(li_raw), words(c['name']), words(c.get('legal_name') or '')
    same = (wa and wa <= wl) or (wl and wl <= wa) or (wb and wb <= wl and wb)
    if li and not same and not (li.startswith(a) or a.startswith(li)
                                or (b and (li.startswith(b) or b.startswith(li)))):
        return 'LinkedIn page is named "%s"' % li_raw
    return None


def band_range(b):
    """'51-200' -> (51,200); '10,001+' -> (10001, None); '2' -> (2,2)."""
    if not b:
        return None
    b = b.replace(',', '').strip()
    m = re.match(r'^(\d+)\s*-\s*(\d+)$', b)
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.match(r'^(\d+)\+$', b)
    if m:
        return int(m.group(1)), None
    m = re.match(r'^(\d+)$', b)
    return (int(m.group(1)), int(m.group(1))) if m else None


def apply(args):
    raw, cache = load(RAW, {}), load(CACHE, {})
    by = {c['id']: c for c in raw['companies']}
    applied, held, stamped, bands = [], [], 0, []
    # a row with no live count still gets checked against LinkedIn's own size band:
    # a census figure of 3 under a band of 11-50 is the Bahasa.ai failure all over again
    for cid, e in cache.items():
        c = by.get(cid)
        if not c or e.get('count') or not e.get('verified') or not e.get('band'):
            continue
        rng = band_range(e['band'])
        n = c.get('employees_est')
        if not rng or n is None:
            continue
        lo, hi = rng
        if n < lo or (hi and n > hi):
            bands.append((c['name'], n, e['band']))
        c['employees_li_band'] = e['band']
        c['employees_li_asof'] = e['crawled']
    for cid, e in cache.items():
        c = by.get(cid)
        if not c or not e.get('count') or not e.get('verified'):
            continue
        old = c.get('employees_est')
        new = e['count']
        note = c.get('employees_note') or ''
        # A row adjudicated by census-headcount-review.py at tier 1-3 stands on a filing, the
        # company's own statement or attributed reporting. A LinkedIn profile count never
        # outranks those, so it is recorded as a cross-check and nothing else.
        if c.get('employees_reviewed'):
            tier = c.get('employees_tier')
            why = (f"reviewed {c['employees_reviewed']} at tier {tier}" if tier
                   else f"withdrawn {c['employees_reviewed']} — no publishable figure")
            held.append((cid, c['name'], old, new, why + ' — not overwritten'))
            c['employees_li'] = new
            c['employees_li_asof'] = e['crawled']
            stamped += 1
            continue
        li_note = (f"LinkedIn lists {new:,} people on the company page, read {e['crawled']}."
                   + (f" LinkedIn's own size band: {e['band']} employees." if e.get('band') else ''))
        if c.get('employees_kind') in ('company', 'manual'):
            held.append((cid, c['name'], old, new,
                         ('company-reported figure' if c['employees_kind'] == 'company'
                          else 'hand-reconciled figure') + ' — never overwritten'))
            c['employees_li'] = new
            c['employees_li_asof'] = e['crawled']
            stamped += 1
            continue
        bad = wrong_entity(c, e)
        if bad:
            held.append((cid, c['name'], old, new, bad + ' — wrong page, not applied'))
            continue
        if old is not None and note and (PROTECTED.search(note) or not REPLACEABLE.search(note)):
            held.append((cid, c['name'], old, new,
                         'measures something else (filing / scoped figure) — not overwritten'
                         if PROTECTED.search(note) else 'figure came from another source — not overwritten'))
            c['employees_li'] = new
            c['employees_li_asof'] = e['crawled']
            stamped += 1
            continue
        if old and (new > old * 3 or old > new * 3):
            # A wild swing is usually a stale census figure, not a bad crawl — LinkedIn's own
            # size band breaks the tie: if the new count sits inside the band and the old one
            # does not, the old one was simply wrong (Kredivo carried 750 against a 1,001-5,000
            # band). Anything the band cannot settle stays held for a human.
            rng = band_range(e.get('band'))
            settled = False
            if rng:
                lo, hi = rng
                inside = lambda v: v is not None and v >= lo and (hi is None or v <= hi)
                settled = inside(new) and not inside(old)
            if not settled:
                held.append((cid, c['name'], old, new, 'swing >3x — check before applying'))
                c['employees_li'] = new
                c['employees_li_asof'] = e['crawled']
                stamped += 1
                continue
            li_note += (f" Replaces a figure of {old:,} that fell outside LinkedIn's own "
                        f"{e['band']} band.")
        if old != new:
            applied.append((cid, c['name'], old, new))
        c['employees_est'] = new
        c['employees_note'] = li_note
        c['employees_asof'] = e['crawled']
        c['employees_src'] = e['linkedin']
        c['employees_kind'] = 'linkedin'
        c.pop('employees_li', None)
        c.pop('employees_li_asof', None)
    # second signal on every row it exists for: Exa's company record. Not used to change a
    # figure — one ground-truth point (Kata.ai: Exa 50-60, LinkedIn 91, actual 62) is not a
    # calibration — but a wide gap between the two is the best marker we have for a row
    # whose headcount should not be read as precise.
    spread = 0
    for cid, e in cache.items():
        c = by.get(cid)
        if not c or not e.get('exa_count'):
            continue
        c['employees_exa'] = e['exa_count']
        c['employees_exa_range'] = e.get('exa_range')
        n = c.get('employees_est')
        if n and abs(n - e['exa_count']) / max(n, e['exa_count']) > 0.4:
            c['employees_spread'] = True
            spread += 1
        else:
            c.pop('employees_spread', None)
    print(f'  second signal (Exa company record) on {sum(1 for c in by.values() if c.get("employees_exa"))} rows; '
          f'{spread} disagree with the LinkedIn count by more than 40%')
    if not args.dry_run:
        save(RAW, raw)
    # The midpoint of a LinkedIn size band is not a measurement — it is the number you get by
    # having no source at all. Amartha carried 5,000 that way for weeks. Surface them every run.
    MIDPOINTS = {5: '2-10', 30: '11-50', 125: '51-200', 350: '201-500', 750: '501-1,000',
                 3000: '1,001-5,000', 7500: '5,001-10,000'}
    riding = [(c['name'], c['employees_est'], MIDPOINTS[c['employees_est']])
              for c in raw['companies']
              if c.get('employees_est') in MIDPOINTS and not c.get('employees_tier')]
    print(f"{'DRY RUN — ' if args.dry_run else ''}applied {len(applied)} changed headcounts, "
          f"held {len(held)} for review ({stamped} stamped with a LinkedIn cross-check)")
    if riding:
        print(f'\n  BAND MIDPOINTS, NOT MEASUREMENTS ({len(riding)}) — give these a real source or a dash:')
        for n, v, b in sorted(riding, key=lambda t: -t[1]):
            print(f'  {n[:32]:34s} census {v:>7,}   = midpoint of {b}')
    if bands:
        print(f'\n  OUTSIDE LINKEDIN\'S OWN SIZE BAND ({len(bands)}) — no live count, but the figure '
              f'disagrees with the band:')
        for n, v, b in sorted(bands, key=lambda t: -(t[1] or 0)):
            print(f'  {n[:32]:34s} census {str(v):>7}   band {b}')
    for cid, n, o, w in sorted(applied, key=lambda t: -abs((t[3] or 0) - (t[2] or 0)))[:40]:
        print(f'  {n[:32]:34s} {str(o):>7} -> {w:>7}')
    if held:
        print('\n  HELD:')
        for cid, n, o, w, why in held:
            print(f'  {n[:32]:34s} {str(o):>7} vs LinkedIn {w:>7}   {why}')


EXA_EMPLOYS = re.compile(r'(?:employs|has)\s+([\d,]+)(?:\s*-\s*([\d,]+))?\s+(?:people|employees)', re.I)


def pick_employs(text):
    """Exa prints the same estimate two ways — "Kata.ai employs 53 people" and
    "Kata.ai has 50-60 employees". Always take the exact one; the band is just the
    rounded presentation of it, and reporting the band's midpoint flatters the source."""
    ms = list(EXA_EMPLOYS.finditer(text or ''))
    if not ms:
        return None
    exact = next((m for m in ms if not m.group(2)), None)
    m = exact or ms[0]
    lo = int(m.group(1).replace(',', ''))
    hi = int(m.group(2).replace(',', '')) if m.group(2) else None
    return (lo if hi is None else (lo + hi) // 2, str(lo) if hi is None else f'{lo}-{hi}')


def exa_est(args):
    """Third signal: Exa keeps its own company record per domain, and it is not a scrape
    of the LinkedIn page — for Kata.ai it says 50-60 where the page says 91 and the CEO
    says 62. Harvested per row so a disagreement between the two can be shown rather
    than averaged away."""
    key = api_key()
    raw, cache = load(RAW, {}), load(CACHE, {})
    rows = [c for c in pick(raw['companies'], args)
            if c.get('url') and not (cache.get(c['id']) or {}).get('exa_checked')]
    print(f'exa company records: {len(rows)} rows')
    for i, c in enumerate(rows, 1):
        dom = host(c['url'])
        e = cache.setdefault(c['id'], {'name': c['name']})
        e['exa_checked'] = TODAY
        res = exa('search', {'query': f"{c['name']} {dom}", 'category': 'company', 'numResults': 6,
                             'contents': {'text': {'maxCharacters': 700}}}, key)
        for r in res.get('results', []):
            # the record is keyed on the company's OWN domain — a name-only match returns
            # look-alikes (kait.ai and cekat.ai both come back for "Kata.ai")
            if host(r.get('url') or '') != dom:
                continue
            got = pick_employs((r.get('text') or '').replace('\n', ' '))
            if got:
                e['exa_count'], e['exa_range'] = got
            break
        if not e.get('exa_count'):
            # the same enrichment is injected into LinkedIn-domain results, where it reads
            # "<name> has 50-60 employees (+4-5% YoY)" — that is where Kata.ai's record lives
            res = exa('search', {'query': f"{c['name']} {dom} employees", 'numResults': 6,
                                 'includeDomains': ['linkedin.com'],
                                 'contents': {'text': {'maxCharacters': 500}}}, key)
            for r in res.get('results', []):
                got = pick_employs((r.get('text') or '').replace('\n', ' ')[:300])
                if got:
                    e['exa_count'], e['exa_range'] = got
                    e['exa_src'] = 'linkedin-enrichment'
                    break
        if i % 20 == 0 or i == len(rows):
            save(CACHE, cache)
            print(f'  {i}/{len(rows)}')
    save(CACHE, cache)
    got = sum(1 for v in cache.values() if v.get('exa_count'))
    print(f'exa records with a headcount: {got}')


def pick(companies, args):
    if args.only:
        ids = set(args.only.split(','))
        return [c for c in companies if c['id'] in ids]
    return companies[:args.limit] if args.limit else companies


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('phase', choices=['resolve', 'crawl', 'exa', 'apply'])
    ap.add_argument('--limit', type=int)
    ap.add_argument('--only')
    ap.add_argument('--stale-days', type=int, default=0)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()
    {'resolve': resolve, 'crawl': crawl, 'exa': exa_est, 'apply': apply}[a.phase](a)
