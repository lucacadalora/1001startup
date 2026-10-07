#!/usr/bin/env python3
"""Search helper for the founder review: python3 exa-q.py "query" [domain.com]
Prints up to 5 results (url, title, first 900 chars). Reads the key itself."""
import json, os, sys, urllib.request
key = [l.split('=',1)[1].strip().strip('"\'') for l in open(os.path.expanduser('~/.openclaw/secrets/exa.env')) if l.startswith('EXA_API_KEY=')][0]
body = {'query': sys.argv[1], 'numResults': 5, 'contents': {'text': {'maxCharacters': 900}}}
if len(sys.argv) > 2: body['includeDomains'] = [sys.argv[2]]
req = urllib.request.Request('https://api.exa.ai/search', data=json.dumps(body).encode(), headers={'x-api-key': key, 'content-type': 'application/json'})
for r in json.load(urllib.request.urlopen(req, timeout=40)).get('results', []):
    print('URL:', r.get('url')); print('TITLE:', r.get('title')); print((r.get('text') or '').replace('\n', ' ')[:900]); print('---')
