#!/usr/bin/env python3
"""Mechanical review of a lane's out.json before any row reaches the census.

  python3 check_lane.py <wave>/<lane>/out.json [--urls]

Checks per row: required fields, census-national.py's own check_row rules,
sector routing (same regex list as build-census.js), duplicates against the
LIVE census (name / legal name / url host) and against the other lanes' rows,
public-text hygiene (tool words), headcount date and source, funding status vs
figure, founders entry present. --urls also HEADs every source URL (browser UA)
and lists the ones that do not answer 2xx/3xx (403s from news sites are normal).
"""
import json, os, re, subprocess, sys, urllib.parse, glob

ROOT = os.path.expanduser('~/projects/pasar-vantis')
WAVE = os.environ.get('CENSUS_WAVE', os.path.expanduser('~/census-wave'))
RULES = [(r"climate|carbon|sustainab|renewable|solar|waste|recycl|circular|\besg\b|emission|mangrove|reforest|air.quality|clean energy|bioplastic|reuse|refill|ev charging|charging network", "climate"),
         (r"^licensed (digital )?bank", "bank"), (r"^web3/crypto", "crypto"),
         (r"fintech|payment|wallet|lend|bnpl|wealth|invest|remit|bank", "fintech"), (r"insur", "misc"),
         (r"commerce|marketplace|retail|grocer", "commerce"), (r"logist|deliver|freight|supply|warehous|courier", "logistics"),
         (r"health|pharma|biotech|\bbio\b|medic|telemed", "health"), (r"edtech|educat|upskill|learn", "edtech"),
         (r"saas|enterprise|b2b|pos |dev tool|software", "saas"), (r"\bai\b|artificial|data|cloud|cyber|it service", "ai-cloud"),
         (r"media|gaming|game|stream|entertain|creator|music|video", "media"), (r"travel|mobilit|transport|automotive|ride", "travel"),
         (r"prop|construction|hospitality|real estate", "prop"), (r"agri|aqua|fish|farm|rural", "agri"),
         (r"f&b|fnb|food|kitchen|coffee|d2c|consumer brand|new retail", "fnb"), (r"hr |talent|legal|climate|energy|misc", "misc")]
FSTATUS = {'disclosed', 'partial', 'undisclosed', 'none_on_record', 'parent_funded', 'grant_only', 'debt_only', 'listed'}
REQ = ['name', 'id', 'legal_name', 'url', 'sector', 'kota', 'province', 'hq_address', 'employees_est', 'employees_src',
       'employees_asof', 'funding_status', 'confidence', 'verify_note', 'sources', 'added', 'liveness_checked']
TOOL = re.compile(r'\b(exa|agent|the brief|scrap(e|ed|ing)|crawl(ed|ing)?|403|captcha|li\.py|exa\.py|webfetch|websearch|curl|livecrawl|hence 0\.\d)\b', re.I)
AGG = re.compile(r'(crunchbase|tracxn|cbinsights|pitchbook|dealroom|theorg\.com|zoominfo|rocketreach|apollo\.io|owler|craft\.co|'
                 r'growjo|latka|leadiq|signalhire|contactout|lusha|aeroleads|thecompanycheck|f6s\.com|startupranking|seedtable)', re.I)


def sector_key(s):
    return next((k for p, k in RULES if re.search(p, s or '', re.I)), 'misc')


def norm(s):
    s = re.sub(r'\(.*?\)', ' ', (s or '').lower())
    s = re.sub(r'\b(pt|tbk|inc|ltd|pte|indonesia)\b', ' ', s)
    return re.sub(r'[^a-z0-9]', '', s)


def host(u):
    h = (urllib.parse.urlparse(u or '').hostname or '').lower()
    return h[4:] if h.startswith('www.') else h


def main():
    path = sys.argv[1]
    lane = json.load(open(path))
    raw = json.load(open(os.path.join(ROOT, 'data', 'census-raw.json')))
    names = {}
    for c in raw['companies']:
        for k in (c.get('name'), c.get('legal_name')):
            if norm(k):
                names[norm(k)] = c['id']
    hosts = {host(c.get('url')): c['id'] for c in raw['companies'] if c.get('url')}
    ids = {c['id'] for c in raw['companies']}
    others = {}
    for f in glob.glob(os.path.join(WAVE, '*', 'out.json')):
        if os.path.abspath(f) == os.path.abspath(path):
            continue
        try:
            for r in json.load(open(f)).get('rows', []):
                others[norm(r.get('name'))] = os.path.basename(os.path.dirname(f))
        except Exception:
            pass
    fids = {f.get('id') for f in lane.get('founders', [])}
    print(f"== {path}: {len(lane.get('rows', []))} rows, {len(lane.get('rejected', []))} rejected, "
          f"{len(lane.get('closed', []))} closed, {len(lane.get('backlog', []))} backlog, {len(lane.get('reversals', []))} reversals")
    lane['rows'] = lane.get('rows', []) + [r for r in lane.get('reversals', []) if r.get('id') and r.get('employees_est')]
    for r in lane.get('rows', []):
        p = []
        for k in REQ:
            if r.get(k) in (None, '', []):
                p.append('missing ' + k)
        if r.get('funding_status') not in FSTATUS:
            p.append('bad funding_status ' + str(r.get('funding_status')))
        if r.get('funding_status') in ('disclosed', 'partial') and not r.get('funding_total_usd_m'):
            p.append('status says figure, none given')
        if r.get('funding_total_usd_m') and r.get('funding_status') in ('undisclosed', 'none_on_record', 'parent_funded'):
            p.append('figure present but status says none')
        if r.get('funding_total_usd_m') and not r.get('funding_srcs'):
            p.append('figure without funding_srcs')
        if (r.get('confidence') or 0) < 0.6:
            p.append('confidence < 0.6')
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', r.get('id') or ''):
            p.append('id not a slug')
        if r.get('id') in ids:
            p.append('id already in census')
        n = norm(r.get('name'))
        if n in names or norm(r.get('legal_name')) in names:
            p.append('DUPLICATE of census row ' + str(names.get(n) or names.get(norm(r.get('legal_name')))))
        if host(r.get('url')) in hosts:
            p.append('URL host already in census: ' + hosts[host(r.get('url'))])
        if n in others:
            p.append('also in lane ' + others[n])
        got = sector_key(r.get('sector'))
        if r.get('_sector_key') and got != r['_sector_key']:
            p.append(f"sector routes to {got}, not {r['_sector_key']}")
        for k in ('verify_note', 'funding_note', 'employees_note', 'valuation_note', 'workforce_note'):
            m = TOOL.search(r.get(k) or '')
            if m:
                p.append(f'tool word in {k}: {m.group(0)!r}')
        bad = [u for u in r.get('sources') or [] if AGG.search(u)]
        if bad:
            p.append('aggregator in sources: ' + ', '.join(bad[:3]))
        if not str(r.get('employees_asof') or '').startswith('2026'):
            p.append('headcount not dated 2026')
        if r.get('id') not in fids:
            p.append('no founders entry')
        if not r.get('_sector_key'):
            p.append('no _sector_key')
        flag = 'OK ' if not p else '!! '
        print(f"{flag}{r.get('id')}: {r.get('kota')} · {r.get('employees_est')} ppl ({r.get('employees_kind')}) · "
              f"{r.get('funding_status')} {r.get('funding_total_usd_m') or ''} · conf {r.get('confidence')} · {got}")
        for x in p:
            print('     -', x)
    if '--urls' in sys.argv:
        UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
        seen = set()
        for r in lane.get('rows', []):
            for u in (r.get('sources') or []) + (r.get('funding_srcs') or []) + [r.get('url')]:
                if not u or u in seen or 'linkedin.com' in u:
                    continue
                seen.add(u)
                code = subprocess.run(['curl', '-s', '-o', '/dev/null', '-L', '-A', UA, '-m', '20', '-w', '%{http_code}', u],
                                      capture_output=True, text=True).stdout
                if not code.startswith(('2', '3')):
                    print(f'   url {code} {r.get("id")}: {u}')


main()
