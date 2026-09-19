#!/usr/bin/env python3
"""Standalone probe checker for census-links research (dev tool for authoring edges).

Replicates scripts/links-verify.py's fetch+normalise EXACTLY, so a PASS here
means links-verify.py will also pass the edge when run for real.

Usage:
  python3 probe_check.py <url> <kind> <probe>     # kind: html|pdf|image
  python3 probe_check.py --dump <url> <kind>      # print normalised text (explore)
  python3 probe_check.py --hash <url>             # sha256 of body (image probes)

Exit 0 = PASS (probe found), 1 = FAIL. Caches fetches under ./cache/.
"""
import sys, os, re, gzip, json, hashlib, subprocess, urllib.request

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = '/tmp/links-probe-cache'  # scratch, never the repo

def fetch(url, kind):
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    txt = os.path.join(CACHE, f'{key}.txt')
    if os.path.exists(txt):
        return open(txt, encoding='utf-8').read()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8',
                                               'Accept-Encoding': 'gzip'})
    raw = urllib.request.urlopen(req, timeout=90)
    body = raw.read()
    if raw.headers.get('Content-Encoding') == 'gzip':
        body = gzip.decompress(body)
    if kind == 'pdf':
        pdf = os.path.join(CACHE, f'{key}.pdf')
        open(pdf, 'wb').write(body)
        subprocess.run(['pdftotext', '-layout', pdf, txt], check=True)
        t = open(txt, encoding='utf-8', errors='ignore').read()
    elif kind == 'image':
        t = 'sha256:' + hashlib.sha256(body).hexdigest()
    else:
        h = body.decode('utf-8', 'ignore')
        h = re.sub(r'(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>', ' ', h)
        h = re.sub(r'(?s)<!--.*?-->', ' ', h)
        alts = re.findall(r'<img[^>]+>', h)
        imgs = ' '.join(' '.join(re.findall(r'(?:alt|src)="([^"]*)"', tag)) for tag in alts)
        t = re.sub(r'(?s)<[^>]+>', ' ', h).replace('&nbsp;', ' ').replace('&amp;', '&')
        t = t + ' ' + imgs
    t = re.sub(r'\s+', ' ', t).strip()
    open(txt, 'w', encoding='utf-8').write(t)
    return t

def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__); return 2
    if args[0] == '--dump':
        url, kind = args[1], (args[2] if len(args) > 2 else 'html')
        t = fetch(url, kind)
        print(t)
        return 0
    if args[0] == '--hash':
        t = fetch(args[1], 'image')
        print(t)
        return 0
    url, kind, probe = args[0], args[1], ' '.join(args[2:])
    try:
        t = fetch(url, kind)
    except Exception as e:
        print(f'FAIL fetch: {e}')
        return 1
    ok = re.sub(r'\s+', ' ', probe) in t
    print(('PASS' if ok else 'FAIL probe') + f' ({len(t)} chars)')
    return 0 if ok else 1

if __name__ == '__main__':
    sys.exit(main())
