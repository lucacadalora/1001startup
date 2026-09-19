#!/usr/bin/env python3
"""IndexNow submission for 1001startup.id (Bing/Copilot/DuckDuckGo lane —
ChatGPT's web layer leans on Bing, so fast Bing indexing feeds AI answers).

The key is PUBLIC by protocol design: engines verify ownership by fetching
https://1001startup.id/<key>.txt, which @fastify/static serves from public/.
Run with no args to submit every URL in the live sitemap (max 10k per call);
pass URLs as args to submit just those (e.g. after a news publish).
"""
import json, re, sys, urllib.request

ORIGIN = 'https://1001startup.id'
KEY_FILE = '/home/ubuntu/projects/pasar-vantis/data/indexnow-key.txt'

key = open(KEY_FILE).read().strip()

if len(sys.argv) > 1:
    urls = sys.argv[1:]
else:
    req = urllib.request.Request('http://127.0.0.1:8390/sitemap.xml',
                                 headers={'Host': '1001startup.id', 'User-Agent': 'indexnow-submit'})
    sm = urllib.request.urlopen(req, timeout=30).read().decode()
    urls = sorted(set(re.findall(r'<loc>([^<]+)</loc>', sm)))

assert urls and len(urls) <= 10000, f'{len(urls)} urls'
body = json.dumps({'host': '1001startup.id', 'key': key,
                   'keyLocation': f'{ORIGIN}/{key}.txt', 'urlList': urls}).encode()
# api.indexnow.org 403s the default Python-urllib UA — send a real one.
r = urllib.request.urlopen(urllib.request.Request(
    'https://api.indexnow.org/indexnow', data=body,
    headers={'Content-Type': 'application/json; charset=utf-8',
             'User-Agent': 'Mozilla/5.0 (compatible; 1001startup-indexnow/1.0; +https://1001startup.id)'}), timeout=60)
print(f'submitted {len(urls)} urls -> HTTP {r.status} (200/202 = accepted)')
