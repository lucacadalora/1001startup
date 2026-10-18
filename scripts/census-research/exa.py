#!/usr/bin/env python3
"""Exa helper for the census research agents (does not use the WebSearch quota).

  python3 -I exa.py search "query words" [--n 8] [--domain linkedin.com] [--text 600]
  python3 -I exa.py contents URL [URL ...] [--live] [--text 8000]

search prints url | title | published date, then the first --text characters.
contents fetches pages (--live = fresh crawl, needed for LinkedIn company pages
and anything that changes); prints status per URL and the text.
"""
import json, os, sys, urllib.request

def key():
    for line in open(os.path.expanduser('~/.openclaw/secrets/exa.env')):
        if line.startswith('EXA_API_KEY='):
            return line.split('=', 1)[1].strip()
    sys.exit('no EXA_API_KEY')

def call(path, body):
    req = urllib.request.Request('https://api.exa.ai/' + path, data=json.dumps(body).encode(),
                                 headers={'x-api-key': key(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'exa {path} HTTP {e.code}: {e.read()[:300]!r}')

def opt(name, default=None, cast=str):
    if name in sys.argv:
        i = sys.argv.index(name)
        v = sys.argv[i + 1]
        del sys.argv[i:i + 2]
        return cast(v)
    return default

def main():
    live = '--live' in sys.argv
    if live:
        sys.argv.remove('--live')
    n = opt('--n', 8, int); dom = opt('--domain'); tx = opt('--text', None, int)
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, args = sys.argv[1], sys.argv[2:]
    if cmd == 'search':
        body = {'query': ' '.join(args), 'numResults': n, 'contents': {'text': {'maxCharacters': tx or 600}}}
        if dom:
            body['includeDomains'] = [dom]
        d = call('search', body)
        for r in d.get('results', []):
            print(f"{r.get('url')} | {(r.get('title') or '')[:100]} | {r.get('publishedDate') or ''}")
            print('    ' + (r.get('text') or '')[:tx or 600].replace('\n', ' '))
    elif cmd == 'contents':
        body = {'urls': args, 'text': {'maxCharacters': tx or 8000}}
        if live:
            body['livecrawl'] = 'always'
        d = call('contents', body)
        for s in d.get('statuses', []):
            print('STATUS', s.get('id'), s.get('status'), (s.get('error') or {}).get('httpStatusCode', ''))
        for r in d.get('results', []):
            print('=====', r.get('url'), '|', r.get('title'), '|', r.get('publishedDate') or '')
            print(r.get('text') or '')
    else:
        sys.exit(__doc__)

main()
