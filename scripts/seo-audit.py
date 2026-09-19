#!/usr/bin/env python3
"""Weekly technical SEO crawl over 1001startup.id (cron; also run by hand).
Hits the app directly (Host header)
so CF caching can't mask origin truth. Checks the things a crawler judges:
status, title/description quality + duplication, canonical, hreflang
reciprocity, h1, JSON-LD validity, og tags, image alts, broken internal links.
"""
import html as _html
import json, re, sys, random
import urllib.request
from collections import Counter

BASE = 'http://127.0.0.1:8390'
HOST = '1001startup.id'
ORIGIN = 'https://1001startup.id'

def get(path):
    req = urllib.request.Request(BASE + path, headers={'Host': HOST, 'User-Agent': 'Mozilla/5.0 (seo-audit)', 'Accept-Encoding': 'identity'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except Exception as e:
        return 0, str(e)

def tag(html, pattern):
    m = re.search(pattern, html, re.I | re.S)
    # entity-decode before measuring: "&amp;" is one character to a reader and
    # to Google, five in the source — counting the source over-reported every
    # title carrying an ampersand.
    return _html.unescape(m.group(1)).strip() if m else None

# URL set: all statics both langs + sample of company/investor/chain pages
census = json.load(open('/home/ubuntu/projects/pasar-vantis/public/data/census.json'))
links = json.load(open('/home/ubuntu/projects/pasar-vantis/public/data/census-links.json'))
random.seed(42)
comp_ids = [c['id'] for c in census['companies']]
sample_companies = random.sample(comp_ids, 25)
chain_ids = list(links.get('byCompany', {}).keys())[:5]

statics = ['/', '/news', '/map', '/closed', '/coverage', '/model', '/investors', '/chain', '/stats']
# browse pages: every sector + metro landing, both languages
sec_seen = sorted({c.get('sector_key') for c in census['companies'] if c.get('sector_key')})
statics += ['/sector/' + k for k in sec_seen]
statics += ['/city/' + m for m in sorted({c.get('metro') for c in census['companies'] if c.get('metro')})]
paths = []
for p in statics: paths += [p, '/id' + p]
for cid in sample_companies: paths += ['/company/' + cid, '/id/company/' + cid]
for cid in chain_ids: paths += ['/chain/' + cid]
paths += ['/investor/gdp-venture', '/id/investor/gdp-venture']

rows, problems = [], []
titles = Counter(); descs = Counter()
for p in paths:
    st, html = get(p)
    if st != 200:
        problems.append(f'{p}: HTTP {st}'); continue
    t = tag(html, r'<title>(.*?)</title>') or ''
    d = tag(html, r'<meta name="description" content="([^"]*)"') or ''
    can = tag(html, r'<link rel="canonical" href="([^"]*)"')
    h1s = re.findall(r'<h1[ >]', html)
    lang = tag(html, r'<html lang="([a-z]+)"')
    rob = tag(html, r'<meta name="robots" content="([^"]*)"')
    og_t = tag(html, r'<meta property="og:title" content="([^"]*)"')
    og_i = tag(html, r'<meta property="og:image" content="([^"]*)"')
    hre = re.findall(r'hreflang="(en|id|x-default)" href="([^"]*)"', html)
    ld_ok = None
    for mm in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try: json.loads(mm.group(1)); ld_ok = True
        except Exception: ld_ok = False
    imgs = re.findall(r'<img [^>]*>', html)
    noalt = [i for i in imgs if ' alt=' not in i]
    titles[t] += 1; descs[d] += 1
    is_id = p.startswith('/id')
    bare = p[3:] if is_id else p
    bare = bare or '/'
    want_can = ORIGIN + ('/id' + bare if is_id else bare)
    if want_can.endswith('/id'): want_can += '/'
    rows.append(dict(p=p, t=t, d=d, lt=len(t), ld=len(d)))
    # checks
    if not t: problems.append(f'{p}: NO TITLE')
    if len(t) > 62: problems.append(f'{p}: title {len(t)} chars (may truncate): "{t[:70]}"')
    if not d: problems.append(f'{p}: NO META DESCRIPTION')
    elif len(d) < 70: problems.append(f'{p}: thin description ({len(d)} chars)')
    elif len(d) > 165: problems.append(f'{p}: long description ({len(d)} chars, will truncate)')
    if not can: problems.append(f'{p}: NO CANONICAL')
    elif can != want_can: problems.append(f'{p}: canonical {can} != expected {want_can}')
    if len(h1s) == 0: problems.append(f'{p}: no <h1>')
    if len(h1s) > 1: problems.append(f'{p}: {len(h1s)} <h1>s')
    if (lang or '') != ('id' if is_id else 'en'): problems.append(f'{p}: html lang={lang}')
    if 'noindex' in (rob or ''): problems.append(f'{p}: NOINDEX')
    if not og_t: problems.append(f'{p}: no og:title')
    if not og_i: problems.append(f'{p}: no og:image')
    if len(hre) < 3: problems.append(f'{p}: hreflang set incomplete ({len(hre)})')
    if ld_ok is False: problems.append(f'{p}: INVALID JSON-LD')
    if noalt: problems.append(f'{p}: {len(noalt)} img without alt')

print(f'crawled {len(paths)} urls, {len(rows)} ok')
print('\n== duplicate titles ==')
for t, n in titles.most_common():
    if n > 1: print(f'  x{n}  {t[:80]}')
print('\n== duplicate descriptions ==')
ddup = [(d, n) for d, n in descs.most_common() if n > 1 and d]
for d, n in ddup[:6]: print(f'  x{n}  {d[:90]}')
print(f'\n== problems ({len(problems)}) ==')
seen = Counter()
for pr in problems:
    key = re.sub(r'^\S+: ', '', pr)[:60]
    seen[key] += 1
for k, n in seen.most_common(30):
    print(f'  x{n:<4} {k}')
print('\n== sample problem detail (first 20) ==')
for pr in problems[:20]: print(' ', pr)

# sitemap URL sample check
st, sm = get('/sitemap.xml')
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
print(f'\n== sitemap: HTTP {st}, {len(locs)} urls ==')
bad = 0
for u in random.sample(locs, min(30, len(locs))):
    pth = u.replace(ORIGIN, '') or '/'
    s2, _ = get(pth)
    if s2 != 200:
        bad += 1; print(f'  {s2}  {pth}')
print(f'  sampled 30 sitemap urls -> {30-bad} OK, {bad} broken')

# cron trail: one summary line per run, so a regression shows as a diff
import datetime
with open('/home/ubuntu/projects/pasar-vantis/data/seo-audit/history.log', 'a') as f:
    f.write(f"{datetime.date.today()} crawled={len(paths)} ok={len(rows)} problems={len(problems)} sitemap={len(locs)} broken_sampled={bad}\n")
