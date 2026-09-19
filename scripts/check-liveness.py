#!/usr/bin/env python3
"""URL-liveness sweep for the census — finds companies whose sites are dead so
they can be re-verified (operating?) before they mislead anyone. Classes:
ok / bot-blocked (403/405/429/503 = alive, shields bots) / origin-down (52x) /
gone-404 / dead-conn (timeout|DNS) / other. KNOWN FALSE-POSITIVE CLASSES from
this VM (verified Aug 29 2026): DANA (WAF kills datacenter IPs), Biotis
(Indonesia-only host refuses foreign IPs), Advotics (Sucuri 307 JS challenge),
Jendela360 (datacenter block). dead-conn/origin-down = VERIFY, never auto-drop.
Usage: python3 scripts/check-liveness.py   (prints suspects)"""
import json, subprocess, concurrent.futures, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(ROOT, 'data', 'census-raw.json')))
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
def check(c):
    u = c.get('url')
    if not u: return (c['name'], 'no-url', '')
    try:
        r = subprocess.run(['curl', '-s', '-A', UA, '--max-time', '20', '-o', '/dev/null',
                            '-w', '%{http_code}', '-L', u], capture_output=True, text=True, timeout=25)
        code = int(r.stdout) if r.stdout.strip().isdigit() else 0
        if code in (200, 301, 302): return (c['name'], 'ok', code)
        if code in (403, 405, 429, 503, 307): return (c['name'], 'bot-blocked', code)
        if code == 0: return (c['name'], 'dead-conn', 'timeout/dns')
        if 520 <= code <= 526: return (c['name'], 'origin-down', code)
        if code == 404: return (c['name'], 'gone-404', code)
        return (c['name'], 'other', code)
    except Exception as e:
        return (c['name'], 'dead-conn', str(e)[:40])
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
    res = list(ex.map(check, d['companies']))
summary = {}
for name, status, detail in res:
    summary[status] = summary.get(status, 0) + 1
    if status not in ('ok', 'bot-blocked'):
        checked = next((c.get('liveness_checked') for c in d['companies'] if c['name'] == name), None)
        print(f"{status:12} {name:36} {detail} {'(verified ' + checked + ')' if checked else '-> VERIFY'}")
print('summary:', summary)
