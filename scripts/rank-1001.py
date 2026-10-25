#!/usr/bin/env python3
"""1001 Rank — where each census company sits by its audience in Indonesia.

Luca, 25 Oct 2026: "we need to make our own data rank, basically like the
similarweb". Slice 1 is the INTERNAL table only: nothing on the site reads
data/rank.json yet.

How a company is placed (all inputs free and public):

  1. AUDIENCE TIER — the Chrome UX Report's Indonesia list (monthly, through the
     zakird/crux-top-lists mirror) puts every origin Indonesian Chrome users load
     into a bucket: top 1k, 5k, 10k, 50k, 100k, 500k or 1M. A company's tier for a
     month is the best bucket among its domains (the census URL plus the
     hand-checked brand domains in data/rank-domains.json, subdomains included,
     staff tools such as staging/SAP/Grafana hosts left out). Its rank tier is the
     MEDIAN of the last three months, so one noisy month does not move it.
  2. TIE-BREAKS inside a tier — best tier of those three months, then the
     domain's position in Common Crawl's web graph (harmonic centrality: how
     well-linked it is), then the name. Inside a bucket Chrome lists sites in
     random order, so this order is a tie-break, not a measurement.
  3. NOT RANKED — no Chrome tier and no link position ("not enough data"), or HELD:
     the census URL now redirects to another domain or shows gambling content
     (gokampus.com went to a judi-slot site), or rank-domains.json holds it.

It REPORTS; it never edits the census. A held company needs a human-checked fix
in census-raw.json; a missing brand domain goes into rank-domains.json with its
evidence. The job never adds a domain on its own: an expired startup domain that
now redirects to a gambling site would otherwise hand that site's traffic to the
startup.

Switch: data/rank.live. Without it the job does nothing (--force builds anyway).
Downloads (one ~7.5 MB file per Chrome month, Common Crawl streamed, never
stored) live in ~/.cache/1001-rank. A run with no new month and no changed input
exits early, so the weekly timer is cheap.

    python3 scripts/rank-1001.py                 # weekly timer: build if anything new
    python3 scripts/rank-1001.py --force         # build now, switch or not
    python3 scripts/rank-1001.py --csv /tmp/r.csv  # also write a review table
    RANK_DATA=/tmp/rank-test python3 scripts/rank-1001.py --force   # dry run elsewhere
"""
import argparse, concurrent.futures, csv, fcntl, gzip, hashlib, io, json, os, re
import ssl, statistics, subprocess, sys, tempfile, time
import urllib.error, urllib.request
from datetime import datetime, timezone
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data')                       # census + brand domains are always read here
DATA = os.environ.get('RANK_DATA') or SRC               # outputs (and the switch) go here
CACHE = os.environ.get('RANK_CACHE') or os.path.expanduser('~/.cache/1001-rank')
CENSUS = os.path.join(SRC, 'census-raw.json')
DOMAINS = os.path.join(SRC, 'rank-domains.json')
SWITCH = os.path.join(DATA, 'rank.live')
OUT = os.path.join(DATA, 'rank.json')
HIST = os.path.join(DATA, 'rank-history')
VERSION = 1

MIRROR_API = 'https://api.github.com/repos/zakird/crux-top-lists/contents/data/country/id'
MIRROR_RAW = 'https://raw.githubusercontent.com/zakird/crux-top-lists/main/data/country/id/%s.csv.gz'
GRAPHINFO = 'https://index.commoncrawl.org/graphinfo.json'
CC_RANKS = 'https://data.commoncrawl.org/projects/hyperlinkgraph/%s/domain/%s-domain-ranks.txt.gz'
FIRST_MONTH = '202501'          # the mirror's Indonesia series starts here
URLCHECK_MAX_AGE = 20 * 86400   # census URLs are re-fetched about once a month
JOB_UA = 'pasar-vantis-rank/1 (+https://1001startup.id)'
SITE_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36'

TIER_LABEL = {1000: 'Top 1k', 5000: 'Top 5k', 10000: 'Top 10k', 50000: 'Top 50k',
              100000: 'Top 100k', 500000: 'Top 500k', 1000000: 'Top 1M'}
NOT_LISTED = 10 ** 9

# A census URL on one of these, with a path, is a profile page, not the company's
# own site (Glaid Studio's LinkedIn page, Lima Biji's Linktree).
PLATFORMS = {'linkedin.com', 'linktr.ee', 'instagram.com', 'facebook.com', 'x.com',
             'twitter.com', 'youtube.com', 'tiktok.com', 'medium.com', 'notion.site',
             'wordpress.com', 'blogspot.com', 'wixsite.com', 'carrd.co', 'bit.ly',
             'lnk.bio', 'beacons.ai', 's.id'}
# Subdomains that are staff tools, not audience (Jiwa Group's SAP Fiori portal
# sat two tiers above its public site).
INTERNAL_WORDS = {'dev', 'test', 'uat', 'qa', 'stg', 'stage', 'sap', 'erp', 'vpn',
                  'ops', 'preprod', 'int'}
INTERNAL_PARTS = ('staging', 'sandbox', 'internal', 'intranet', 'grafana', 'kibana',
                  'jenkins', 'gitlab', 'confluence', 'jira', 'fiori', 'operator')
# Judi-site vocabulary, not the word "judi" itself: fintechs and Safelog AI (which
# screens candidates for online-gambling activity) say "judi online" legitimately.
GAMBLING = re.compile(r'\b(gacor|togel|maxwin|slot\s*online|situs\s*slot|judi\s*slot|rtp\s*slot|slot\s*\d{2,3})\b')

CTX = ssl.create_default_context()


def log(msg):
    print(msg, flush=True)


def fetch(url, ua=JOB_UA, accept='*/*', timeout=60):
    req = urllib.request.Request(url, headers={'User-Agent': ua, 'Accept': accept})
    with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
        return r.read()


def write_json(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
        f.write('\n')
    os.replace(tmp, path)


# ---------------------------------------------------------------- domains

_PSL = None


def registrable(host):
    """example.co.id for www.shop.example.co.id, using the system Public Suffix
    List (private section included, so x.vercel.app stays x.vercel.app)."""
    global _PSL
    if _PSL is None:
        rules, wild, exc = set(), set(), set()
        try:
            for line in open('/usr/share/publicsuffix/public_suffix_list.dat', encoding='utf-8'):
                line = line.strip()
                if not line or line.startswith('//'):
                    continue
                r = line.split()[0].lower()
                if r.startswith('!'):
                    exc.add(r[1:])
                elif r.startswith('*.'):
                    wild.add(r[2:])
                else:
                    rules.add(r)
        except OSError:
            rules = {'co.id', 'ac.id', 'or.id', 'go.id', 'web.id', 'my.id', 'sch.id',
                     'biz.id', 'net.id', 'com.sg', 'com.my', 'co.uk', 'com.au'}
        _PSL = (rules, wild, exc)
    rules, wild, exc = _PSL
    host = (host or '').lower().strip('.')
    if host.startswith('www.'):
        host = host[4:]
    parts = host.split('.')
    if len(parts) < 2:
        return host
    suffix = 1
    for i in range(len(parts)):
        cand, n = '.'.join(parts[i:]), len(parts) - i
        if cand in exc:
            suffix = max(suffix, n - 1)
            break
        if cand in rules or (i + 1 < len(parts) and '.'.join(parts[i + 1:]) in wild):
            suffix = max(suffix, n)
    return host if suffix >= len(parts) else '.'.join(parts[-(suffix + 1):])


def host_of(url):
    p = urlparse(url if '://' in url else 'https://' + url)
    return (p.hostname or '').lower(), p.path or '/'


def is_internal(host, dom):
    sub = host[:-len(dom)].rstrip('.')
    if not sub:
        return False
    for tok in re.split(r'[.\-]', sub):
        if tok in INTERNAL_WORDS or any(p in tok for p in INTERNAL_PARTS):
            return True
    return False


def company_domains(c, extra):
    """The registrable domains a company is measured on: its census URL (unless
    that is a LinkedIn/Linktree-style profile page) plus its checked brand domains."""
    host, path = host_of(c.get('url') or '')
    doms = []
    d = registrable(host)
    if d and not (d in PLATFORMS and path.strip('/')):
        doms.append(d)
    for a in extra.get('add', []):
        a = registrable(a['domain'])
        if a and a not in doms:
            doms.append(a)
    return doms


# ---------------------------------------------------------------- Chrome UX Report

def available_months():
    try:
        items = json.loads(fetch(MIRROR_API, accept='application/vnd.github+json', timeout=30))
        months = sorted(m.group(1) for it in items
                        if (m := re.match(r'^(\d{6})\.csv\.gz$', it.get('name', ''))))
        if months:
            return [m for m in months if m >= FIRST_MONTH]
    except Exception as e:
        log('mirror listing failed (%s); using cached months' % e)
    have = os.path.join(CACHE, 'crux-id')
    return sorted(f[:6] for f in os.listdir(have) if f.endswith('.csv.gz')) if os.path.isdir(have) else []


def month_file(month):
    path = os.path.join(CACHE, 'crux-id', month + '.csv.gz')
    if os.path.exists(path):
        return path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    body = fetch(MIRROR_RAW % month, timeout=120)
    with gzip.GzipFile(fileobj=io.BytesIO(body)) as g:
        if g.read(11) != b'origin,rank':
            raise RuntimeError('unexpected file for %s' % month)
    with open(path + '.tmp', 'wb') as f:
        f.write(body)
    os.replace(path + '.tmp', path)
    log('downloaded Chrome Indonesia list %s (%.1f MB)' % (month, len(body) / 1e6))
    return path


def month_best(path, wanted):
    """{domain: (bucket, origin host)} for the wanted domains in one month's list."""
    best = {}
    with gzip.open(path, 'rt', encoding='utf-8', newline='') as f:
        rows = csv.reader(f)
        next(rows)
        for origin, rk in rows:
            host = origin.split('://', 1)[-1].split('/', 1)[0].split(':', 1)[0].lower()
            h = host[4:] if host.startswith('www.') else host
            while h not in wanted:
                i = h.find('.')
                if i < 0:
                    break
                h = h[i + 1:]
            if h not in wanted or is_internal(host, h):
                continue
            r = int(rk)
            cur = best.get(h)
            if cur is None or r < cur[0] or (r == cur[0] and len(host) < len(cur[1])):
                best[h] = (r, host)
    return best


# ---------------------------------------------------------------- Common Crawl

def link_positions(domains):
    """Harmonic-centrality position per domain from the latest Common Crawl
    domain graph. The 2.4 GiB ranks file is streamed through grep, never stored;
    the small extract is cached per release."""
    try:
        rel = json.loads(fetch(GRAPHINFO, timeout=30))[0]['id']
    except Exception as e:
        log('Common Crawl release list failed (%s)' % e)
        rel = None
    cached = sorted(f for f in os.listdir(CACHE) if f.startswith('cc-') and f.endswith('.json')) \
        if os.path.isdir(CACHE) else []
    if rel:
        path = os.path.join(CACHE, 'cc-%s.json' % rel)
        if os.path.exists(path):
            got = json.load(open(path))
            if set(domains) <= set(got['asked']):
                return rel, got['pos']
        with tempfile.NamedTemporaryFile('w', delete=False, suffix='.pat') as pf:
            for d in sorted(domains):
                pf.write('\t%s\t\n' % '.'.join(reversed(d.split('.'))))
        url = CC_RANKS % (rel, rel)
        log('streaming Common Crawl domain ranks %s (about 2.4 GiB, not stored)...' % rel)
        t0 = time.time()
        cmd = ('set -o pipefail; curl -sS --fail --max-time 3000 -A "%s" "%s" | gzip -dc '
               '| LC_ALL=C grep -F -f "%s"' % (JOB_UA, url, pf.name))
        p = subprocess.run(['bash', '-c', cmd], capture_output=True, text=True)
        os.unlink(pf.name)
        if p.returncode in (0, 1) and not p.stderr.strip():
            pos = {}
            for line in p.stdout.splitlines():
                cols = line.split('\t')
                if len(cols) >= 5:
                    pos['.'.join(reversed(cols[4].split('.')))] = int(cols[0])
            write_json(path, {'release': rel, 'asked': sorted(domains), 'pos': pos})
            log('Common Crawl: %d of %d domains placed (%.0f s)' % (len(pos), len(domains), time.time() - t0))
            return rel, pos
        log('Common Crawl stream failed (rc %s): %s' % (p.returncode, p.stderr.strip()[:300]))
    if cached:   # fall back to the newest extract we have
        got = json.load(open(os.path.join(CACHE, cached[-1])))
        log('using cached Common Crawl extract %s' % got['release'])
        return got['release'], got['pos']
    return None, {}


# ---------------------------------------------------------------- census URL check

def check_url(url):
    req = urllib.request.Request(url, headers={'User-Agent': SITE_UA, 'Accept': 'text/html,*/*'})
    try:
        with urllib.request.urlopen(req, timeout=15, context=CTX) as r:
            body = r.read(262144).decode('utf-8', 'replace').lower()
            final, status = r.geturl(), r.status
    except urllib.error.HTTPError as e:
        return {'status': e.code, 'final': e.geturl() or url}
    except Exception as e:
        return {'status': 0, 'final': url, 'error': type(e).__name__}
    hits = len(GAMBLING.findall(body))
    out = {'status': status, 'final': final}
    if hits >= 3:
        out['gambling'] = hits
    return out


def url_checks(companies, recheck):
    path = os.path.join(CACHE, 'urlcheck.json')
    old = json.load(open(path)) if os.path.exists(path) else {}
    fresh = old.get('at', 0) > time.time() - URLCHECK_MAX_AGE
    todo = {c['id']: c['url'] for c in companies if c.get('url')
            and (recheck or not fresh or c['id'] not in old.get('results', {})
                 or old['results'][c['id']].get('url') != c['url'])}
    results = {} if (recheck or not fresh) else dict(old.get('results', {}))
    if todo:
        log('checking %d census URLs...' % len(todo))
        with concurrent.futures.ThreadPoolExecutor(8) as ex:
            for cid, res in zip(todo, ex.map(check_url, todo.values())):
                res['url'] = todo[cid]
                results[cid] = res
        write_json(path, {'at': old['at'] if (fresh and not recheck) else time.time(), 'results': results})
    return results


# ---------------------------------------------------------------- build

def build(args):
    census = json.load(open(CENSUS))['companies']
    extra = json.load(open(DOMAINS)).get('companies', {}) if os.path.exists(DOMAINS) else {}
    doms = {c['id']: company_domains(c, extra.get(c['id'], {})) for c in census}
    wanted = {d for ds in doms.values() for d in ds}

    months = available_months()
    if not months:
        log('no Chrome Indonesia months available; nothing built')
        return 1
    last3 = months[-3:]
    checks = url_checks(census, args.recheck)
    cc_rel, cc_pos = (None, {}) if args.no_cc else link_positions(wanted)

    held = {}
    for c in census:
        e = extra.get(c['id'], {})
        if e.get('hold'):
            held[c['id']] = e['hold']
            continue
        res = checks.get(c['id']) or {}
        fin = registrable(host_of(res.get('final') or '')[0])
        why = []
        if fin and doms[c['id']] and fin not in doms[c['id']]:
            why.append('census URL now redirects to %s' % fin)
        if res.get('gambling'):
            why.append('the page shows online-gambling content')
        if why:
            held[c['id']] = '; '.join(why)

    # A brand domain must belong to one company only, or both would share its audience.
    owners = {}
    for cid, ds in doms.items():
        for d in ds:
            owners.setdefault(d, []).append(cid)
    shared = {d: ids for d, ids in owners.items() if len(ids) > 1}
    for d, ids in shared.items():
        log('warning: %s is counted for %s' % (d, ', '.join(ids)))

    key_src = {'v': VERSION, 'months': months, 'cc': cc_rel,
               'census': [(c['id'], c.get('url'), c['name']) for c in census],
               'extra': extra, 'held': held}
    key = hashlib.sha256(json.dumps(key_src, sort_keys=True).encode()).hexdigest()[:16]
    if not args.force and os.path.exists(OUT):
        try:
            if json.load(open(OUT)).get('inputs_key') == key:
                log('nothing new (Chrome %s, links %s): rank.json unchanged' % (months[-1], cc_rel))
                return 0
        except ValueError:
            pass

    # Every month's tiers, so history files exist from the start of the series.
    per_month = {}
    for m in months:
        best = month_best(month_file(m), wanted)
        tiers = {}
        for c in census:
            got = [best[d] for d in doms[c['id']] if d in best]
            if got:
                tiers[c['id']] = min(got)
        per_month[m] = tiers
        write_json(os.path.join(HIST, '%s-%s.json' % (m[:4], m[4:])),
                   {'month': '%s-%s' % (m[:4], m[4:]), 'source': 'Chrome UX Report, Indonesia',
                    'tiers': {cid: {'tier': t[0], 'origin': t[1]} for cid, t in sorted(tiers.items())}})

    rows = []
    for c in census:
        cid = c['id']
        series = [per_month[m].get(cid) for m in last3]
        vals = [s[0] if s else NOT_LISTED for s in series]
        med = statistics.median_low(vals)
        best = min(vals)
        latest = next((s for s in reversed(series) if s), None)
        positions = [cc_pos[d] for d in doms[cid] if d in cc_pos]
        fund = c.get('funding_total_usd_m') or 0
        staff = c.get('employees_est') or 0
        look = []
        if (fund >= 50 or staff >= 300) and (med >= 100000) and cid not in extra and cid not in held:
            look.append('big company, low web tier: check its other domains and apps')
        look += ['%s is also counted for %s' % (d, ', '.join(i for i in shared[d] if i != cid))
                 for d in doms[cid] if d in shared]
        rows.append({
            'id': cid, 'name': c['name'],
            'tier': med if med != NOT_LISTED else None,
            'tier_label': TIER_LABEL.get(med),
            'tier_best': best if best != NOT_LISTED else None,
            'months_listed': sum(1 for v in vals if v != NOT_LISTED),
            'tiers_by_month': {'%s-%s' % (m[:4], m[4:]): (s[0] if s else None) for m, s in zip(last3, series)},
            'origin': latest[1] if latest else None,
            'domains': doms[cid],
            'links_pos': min(positions) if positions else None,
            'held': held.get(cid),
            'look': look,
        })

    def order(r):
        return (r['tier'] or NOT_LISTED, r['tier_best'] or NOT_LISTED,
                r['links_pos'] or NOT_LISTED, r['name'].lower())
    # Ranked on Chrome when listed in most of the last three months; a company
    # listed only once, or only placed by links, still gets a place below them,
    # marked weak.
    ranked = sorted((r for r in rows if not r['held'] and (r['tier'] or r['tier_best'] or r['links_pos'])),
                    key=order)
    for i, r in enumerate(ranked, 1):
        r['rank'] = i
        r['basis'] = 'chrome' if r['tier'] else ('chrome-partial' if r['tier_best'] else 'links')
        r['status'] = 'ranked' if r['tier'] else 'weak'
    rest = sorted((r for r in rows if 'rank' not in r), key=lambda r: (not r['held'], r['name'].lower()))
    for r in rest:
        r['rank'] = None
        r['basis'] = None
        r['status'] = 'held' if r['held'] else 'not-enough-data'

    counts = {
        'companies': len(rows),
        'ranked_on_chrome': sum(1 for r in ranked if r['basis'] == 'chrome'),
        'ranked_on_chrome_partial': sum(1 for r in ranked if r['basis'] == 'chrome-partial'),
        'ranked_on_links_only': sum(1 for r in ranked if r['basis'] == 'links'),
        'not_enough_data': sum(1 for r in rest if not r['held']),
        'held': sum(1 for r in rest if r['held']),
        'to_look_at': sum(1 for r in rows if r['look']),
        'by_tier': {TIER_LABEL[t]: sum(1 for r in ranked if r['tier'] == t) for t in TIER_LABEL},
    }
    write_json(OUT, {
        'version': VERSION,
        'built': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'inputs_key': key,
        'internal': True,
        'method': ('Median Chrome UX Report Indonesia bucket over the last three months, across the '
                   'census URL and hand-checked brand domains (data/rank-domains.json); ties broken by '
                   'best bucket, then Common Crawl harmonic-centrality position, then name.'),
        'chrome_months': ['%s-%s' % (m[:4], m[4:]) for m in last3],
        'links_release': cc_rel,
        'counts': counts,
        'companies': ranked + rest,
    })
    log('rank.json: %d ranked (%d on Chrome, %d listed once, %d on links only), %d not enough data, '
        '%d held, %d to look at' % (len(ranked), counts['ranked_on_chrome'], counts['ranked_on_chrome_partial'],
                                    counts['ranked_on_links_only'], counts['not_enough_data'],
                                    counts['held'], counts['to_look_at']))
    for r in ranked[:10]:
        log('  #%-3d %-40s %s via %s' % (r['rank'], r['name'][:40], r['tier_label'] or 'links', r['origin'] or '-'))
    for r in rest:
        if r['held']:
            log('  held: %s — %s' % (r['name'], r['held']))
    if args.csv:
        with open(args.csv, 'w', newline='') as f:
            w = csv.writer(f)
            w.writerow(['rank', 'name', 'id', 'tier', 'months_listed'] + list(rows[0]['tiers_by_month'])
                       + ['best_origin', 'domains', 'links_pos', 'status', 'held', 'look'])
            for r in ranked + rest:
                w.writerow([r['rank'] or '', r['name'], r['id'], r['tier_label'] or '', r['months_listed']]
                           + [TIER_LABEL.get(v, '') if v else '' for v in r['tiers_by_month'].values()]
                           + [r['origin'] or '', ' '.join(r['domains']), r['links_pos'] or '',
                              r['status'], r['held'] or '', '; '.join(r['look'])])
        log('review table: %s' % args.csv)
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--force', action='store_true', help='build even if switched off or unchanged')
    ap.add_argument('--recheck', action='store_true', help='re-fetch every census URL now')
    ap.add_argument('--no-cc', action='store_true', help='skip Common Crawl (no link tie-break)')
    ap.add_argument('--csv', help='also write a review table here')
    args = ap.parse_args()
    if not os.path.exists(SWITCH) and not args.force:
        log('data/rank.live is missing: 1001 Rank is switched off, nothing done')
        return 0
    os.makedirs(CACHE, exist_ok=True)
    with open(os.path.join(CACHE, 'lock'), 'w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log('another rank build is running; skipped')
            return 0
        return build(args)


if __name__ == '__main__':
    sys.exit(main())
