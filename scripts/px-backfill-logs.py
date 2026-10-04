#!/usr/bin/env python3
"""Rebuild 1001startup.id's people / AI history from the nginx logs, for the time before lib/px.js counted them apart.

  python3 scripts/px-backfill-logs.py            # once, right after the switch (refuses to run twice)
  python3 scripts/px-backfill-logs.py --dry-run  # print the totals, write nothing

lib/px.js has counted people and AI apart since px_meta 'split_start'. Before that it counted every browser-looking page
view, scrapers included. This reads the same requests back out of /var/log/nginx/access.log* (vhost_combined, host last)
and sorts them the way the live counter now does:

  - a machine that names itself (same AGENTS table as lib/px.js) -> px_ai, by hour, agent, kind and address check
    (verified / claimed / impostor against data/px-netlists.json), and px_ai_page for answers and AI search;
  - a known bot or tool -> nothing (as live);
  - a browser on a hosting company's network, the residential-proxy scraper that ran from 3 Oct 2026 (found by its
    fixed set of phone user agents, each used for 150+ pages since then), or a visitor whose browser never ran the page's
    script that day (no POST /api/px/beat from that address and browser: fetchers that do not run JavaScript, link-preview
    and proxy bursts) -> px_hist.filtered;
  - everyone else -> px_hist.people, with visitors (address + browser per day, the live definition) and clicks from AI
    answers (utm_source=chatgpt.com or an AI site as referrer).
Taps and clicks were not recorded before the switch, so "ran the page's script" stands in for them and the people figures
before it are estimates; the page says so. (Measured on likely-human Indonesian visitors: 92% of Google arrivals and 94%
of in-site navigation sent the ping, X arrivals 57%: many bounce before the script runs.)
Only what the live counter counts is read: GET, status 200, HTML pages, not the embedded map, not this server itself.
Times are bucketed in Asia/Jakarta like lib/px.js. Writes px_hist (replaced for the host) and px_ai / px_ai_page rows
before the switch; px_meta 'backfill_at' marks it done.
"""
import gzip, ipaddress, json, os, re, sqlite3, sys, time
from bisect import bisect_right
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / 'data' / 'pasar.db'
NETS = ROOT / 'data' / 'px-netlists.json'
HOST = '1001.vantis.sh'
HOSTS = {'1001startup.id', 'www.1001startup.id', '1001.vantis.sh'}
SELF = {'127.0.0.1', '::1', '::ffff:127.0.0.1', '43.157.195.23'}
LAUNCH = datetime(2026, 8, 29, tzinfo=timezone(timedelta(hours=7)))
WIB = timedelta(hours=7)
SCRAPER_FROM = datetime(2026, 10, 3, 11, tzinfo=timezone.utc)
LINE = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "([^"]*)" "([^"]*)" "([^"]*)"$')
ASSET = re.compile(r'^/(api|assets|js|css|fonts|data|_v)/|\.(js|css|png|webp|jpe?g|svg|ico|woff2?|json|txt|xml|gif|webmanifest|map)$', re.I)
# lib/px.js BOT_RE, kept in step by hand
BOT = re.compile('|'.join([
    'bot', 'crawl', 'spider', 'slurp', 'scrape', 'archiver', 'wget', 'curl',
    'python-requests', 'python-urllib', 'httpx', 'aiohttp', 'axios', 'node-fetch',
    'go-http-client', 'java/', 'okhttp', 'libwww', 'lwp::', 'guzzle', 'postman',
    'insomnia', 'headless', 'phantomjs', 'puppeteer', 'playwright', 'selenium',
    'lighthouse', 'pagespeed', 'gtmetrix', 'pingdom', 'uptime', 'statuscake',
    'monitoring', 'facebookexternalhit', 'embedly', 'quora link preview',
    'skypeuripreview', 'whatsapp', 'telegrambot', 'slackbot', 'discordbot',
    'linkedinbot', 'twitterbot', 'redditbot', 'vercel', 'feedfetcher', 'preview',
    'chatgpt-user', 'oai-searchbot', 'claude-user', 'claude-searchbot',
    'perplexity-user', 'mistralai-user', 'duckassistbot', 'googleother']), re.I)
# lib/px.js AGENTS, same order
AGENTS = [
    ('ChatGPT', r'ChatGPT-User', 'answer', 'openai_user'), ('Claude', r'Claude-User', 'answer', None),
    ('Perplexity', r'Perplexity-User', 'answer', 'perplexity'), ('Mistral Le Chat', r'MistralAI-User', 'answer', None),
    ('Meta AI', r'meta-externalfetcher', 'answer', None), ('Amazon Alexa', r'Amzn-User', 'answer', None),
    ('ChatGPT search', r'OAI-SearchBot', 'index', 'openai_search'), ('Claude search', r'Claude-SearchBot', 'index', None),
    ('Perplexity search', r'PerplexityBot', 'index', 'perplexity'), ('DuckAssist', r'DuckAssistBot', 'index', None),
    ('Amazon search', r'Amzn-SearchBot', 'index', None), ('Azure AI search', r'AzureAI-SearchBot', 'index', None),
    ('You.com', r'YouBot', 'index', None), ('Keenable', r'KeenableBot', 'index', None), ('Exa', r'ExaSearchBot', 'index', None),
    ('OpenAI GPTBot', r'GPTBot', 'train', 'openai_train'), ('Anthropic ClaudeBot', r'ClaudeBot|anthropic-ai', 'train', None),
    ('Common Crawl', r'CCBot', 'train', 'ccbot'), ('ByteDance', r'Bytespider', 'train', None),
    ('Meta', r'meta-externalagent|FacebookBot', 'train', None), ('Amazonbot', r'Amazonbot', 'train', None),
    ('Reflection AI', r'Reflectionbot', 'train', None), ('Cohere', r'cohere-ai|cohere-training', 'train', None),
    ('Diffbot', r'Diffbot', 'train', None),
    ('Google', r'Googlebot|Google-InspectionTool|GoogleOther|Storebot-Google|AdsBot-Google', 'search', 'google'),
    ('Bing', r'bingbot|BingPreview|msnbot|adidxbot', 'search', 'bing'), ('Apple', r'Applebot', 'search', 'apple'),
    ('Yandex', r'YandexBot|YandexMobileBot', 'search', None), ('DuckDuckGo', r'DuckDuckBot', 'search', None),
    ('Baidu', r'Baiduspider', 'search', None), ('Petal', r'PetalBot', 'search', None), ('Seznam', r'SeznamBot', 'search', None),
    ('Naver', r'Yeti/', 'search', None),
]
AGENTS = [(n, re.compile(p, re.I), k, l) for n, p, k, l in AGENTS]
AI_REF = re.compile(r'(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|meta\.ai|deepseek\.com|grok\.com|you\.com|phind\.com|chat\.mistral\.ai|kagi\.com)$', re.I)
AI_SRC = re.compile(r'utm_source=[^&]*(chatgpt|openai|perplexity|claude|gemini|copilot|deepseek|grok|mistral|phind)', re.I)


def compile_list(L):
    v4 = L.get('v4', [])
    v6 = [(int(a, 16), int(b, 16)) for a, b in L.get('v6', [])]
    return ([a for a, _ in v4], [b for _, b in v4], [a for a, _ in v6], [b for _, b in v6])


def in_list(ip, L, cache={}):
    key = (ip, id(L))
    if key in cache:
        return cache[key]
    try:
        a = ipaddress.ip_address(ip)
        if a.version == 6 and a.ipv4_mapped:
            a = a.ipv4_mapped
    except ValueError:
        cache[key] = False
        return False
    s, e = (L[0], L[1]) if a.version == 4 else (L[2], L[3])
    i = bisect_right(s, int(a)) - 1
    cache[key] = i >= 0 and int(a) <= e[i]
    return cache[key]


def lines():
    files = sorted(Path('/var/log/nginx').glob('access.log*'), key=lambda p: -int(p.name.split('.')[2]) if p.name.count('.') >= 2 and p.name.split('.')[2].isdigit() else 0)
    for p in files:
        opener = gzip.open if p.suffix == '.gz' else open
        with opener(p, 'rt', errors='replace') as fh:
            for line in fh:
                if '1001' in line[-40:]:
                    yield line.rstrip('\n')


def main():
    dry = '--dry-run' in sys.argv
    con = sqlite3.connect(DB, timeout=30)
    con.execute('PRAGMA busy_timeout = 30000')
    row = con.execute("SELECT v FROM px_meta WHERE k='split_start'").fetchone()
    if not row:
        sys.exit('px_meta split_start missing: start the new lib/px.js first')
    start = datetime.fromtimestamp(int(row[0]) / 1000, tz=timezone.utc)
    done = con.execute("SELECT v FROM px_meta WHERE k='backfill_at'").fetchone()
    if done and not dry:
        sys.exit(f'already backfilled at {done[0]}; nothing to do')
    nets = json.load(open(NETS))
    dc = compile_list(nets['dc'])
    crawl = {k: compile_list(v) for k, v in nets.get('crawlers', {}).items()}

    rows = []
    fleet_count = Counter()
    pinged = set()                             # (ip, ua, WIB day) whose page ran the script
    for line in lines():
        m = LINE.match(line)
        if not m or m.group(8) not in HOSTS:
            continue
        ts = datetime.strptime(m.group(2), '%d/%b/%Y:%H:%M:%S %z').astimezone(timezone.utc)
        if ts < LAUNCH or ts >= start:
            continue
        ip, method, path, status, ref, ua = m.group(1), m.group(3), m.group(4), m.group(5), m.group(6), m.group(7)
        if method == 'POST' and path.startswith('/api/px/beat') and status == '200':
            pinged.add((ip, ua, (ts + WIB).strftime('%Y-%m-%d')))
            continue
        bare = path.split('?')[0]
        if method != 'GET' or status != '200' or ip in SELF or ASSET.search(bare) or 'embed=1' in path:
            continue
        rows.append((ts, ip, path, bare, ref, ua))
        if ts >= SCRAPER_FROM and 'Mobile' in ua:
            fleet_count[ua] += 1
    fleet = {u for u, n in fleet_count.items() if n > 150}

    hist = defaultdict(lambda: Counter())      # (unit, b) -> people, visitors, clicks, filtered
    seen_day = defaultdict(set)
    ai = Counter()                             # (b_hour, agent, kind, vstate) -> n
    ai_page = Counter()                        # (day, kind, path) -> n
    for ts, ip, path, bare, ref, ua in rows:
        w = ts + WIB
        hb, db = w.strftime('%Y-%m-%d %H'), w.strftime('%Y-%m-%d')
        agent = next(((n, k, l) for n, rx, k, l in AGENTS if rx.search(ua)), None)
        if agent:
            name, kind, lst = agent
            L = crawl.get(lst) if lst else None
            vstate = 'claimed' if not L else ('verified' if in_list(ip, L) else 'impostor')
            ai[(hb, name, kind, vstate)] += 1
            if vstate != 'impostor' and kind in ('answer', 'index'):
                ai_page[(db, kind, bare[:200])] += 1
            continue
        if not ua or len(ua) < 12 or BOT.search(ua):
            continue
        if in_list(ip, dc) or ua in fleet or (ip, ua, db) not in pinged:
            hist[('hour', hb)]['filtered'] += 1
            hist[('day', db)]['filtered'] += 1
            continue
        for unit, b in (('hour', hb), ('day', db)):
            hist[(unit, b)]['people'] += 1
        vk = (ip, ua)
        if vk not in seen_day[db]:
            seen_day[db].add(vk)
            hist[('hour', hb)]['visitors'] += 1
            hist[('day', db)]['visitors'] += 1
        host = ''
        if ref.startswith('http'):
            host = re.sub(r'^www\.', '', ref.split('/')[2].split(':')[0].lower())
        if AI_SRC.search(path) or (host and AI_REF.search(host)):
            hist[('hour', hb)]['clicks'] += 1
            hist[('day', db)]['clicks'] += 1

    days = sorted(b for u, b in hist if u == 'day')
    tot = Counter()
    for (u, b), c in hist.items():
        if u == 'day':
            tot.update(c)
    kinds = Counter()
    for (hb, name, kind, vstate), n in ai.items():
        if vstate != 'impostor':
            kinds[kind] += n
    print(f'backfill {HOST}: {LAUNCH:%Y-%m-%d} .. {start:%Y-%m-%d %H:%M}Z, {len(rows)} page requests, {len(days)} days')
    print(f'  people {tot["people"]} views, {tot["visitors"]} visitor-days, {tot["clicks"]} from AI answers; filtered {tot["filtered"]}')
    print(f'  AI {dict(kinds)}; impostors {sum(n for (h, a, k, v), n in ai.items() if v == "impostor")}; scraper UAs {len(fleet)}')
    if dry:
        return
    with con:
        con.execute('DELETE FROM px_hist WHERE host=?', (HOST,))
        con.executemany('INSERT INTO px_hist (host, unit, b, people, visitors, clicks, filtered) VALUES (?,?,?,?,?,?,?)',
                        [(HOST, u, b, c['people'], c['visitors'], c['clicks'], c['filtered']) for (u, b), c in hist.items()])
        con.executemany('''INSERT INTO px_ai (host, b, agent, kind, vstate, n) VALUES (?,?,?,?,?,?)
                           ON CONFLICT(host, b, agent, kind, vstate) DO UPDATE SET n = n + excluded.n''',
                        [(HOST, hb, a, k, v, n) for (hb, a, k, v), n in ai.items()])
        con.executemany('''INSERT INTO px_ai_page (host, day, kind, path, n) VALUES (?,?,?,?,?)
                           ON CONFLICT(host, day, kind, path) DO UPDATE SET n = n + excluded.n''',
                        [(HOST, d, k, p, n) for (d, k, p), n in ai_page.items()])
        con.execute("INSERT OR REPLACE INTO px_meta (k, v) VALUES ('backfill_at', ?)", (time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),))
    print('  written')


if __name__ == '__main__':
    main()
