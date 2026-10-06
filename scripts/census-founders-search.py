#!/usr/bin/env python3
"""Gather founder CANDIDATES for census companies (RankMySEO report, 5 Oct 2026:
"pendiri gojek" = 3,600 searches/month, and no company page names a founder).

This script only collects evidence; it decides nothing. Per company it runs two
Exa searches -- one open ("<name> Indonesia founders"), one restricted to the
company's own domain (its about/team page, the best primary source) -- and
writes the snippets + URLs to a JSON cache. A reviewer (human or agent) then
records a founder only when the company itself, or two independent reputable
outlets, name them. Nothing here is published.

Usage:
  python3 scripts/census-founders-search.py OUT.json [--ids a,b,c] [--from census.json]
Re-runs skip companies already in OUT.json (delete the file to start over).
Key: ~/.openclaw/secrets/exa.env (EXA_API_KEY).
"""
import json, os, sys, time, urllib.request, urllib.parse, concurrent.futures as cf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def exa_key():
    for line in open(os.path.expanduser('~/.openclaw/secrets/exa.env')):
        if line.startswith('EXA_API_KEY='):
            return line.split('=', 1)[1].strip().strip('"\'')
    raise SystemExit('no EXA_API_KEY')


KEY = exa_key()


def exa(query, n=6, domains=None, chars=1200):
    body = {'query': query, 'numResults': n, 'contents': {'text': {'maxCharacters': chars}}}
    if domains:
        body['includeDomains'] = domains
    req = urllib.request.Request('https://api.exa.ai/search', data=json.dumps(body).encode(),
                                 headers={'x-api-key': KEY, 'content-type': 'application/json'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                d = json.load(r)
            return [{'url': x.get('url'), 'title': x.get('title'),
                     'text': (x.get('text') or '')[:chars]} for x in d.get('results', [])]
        except Exception as e:  # noqa: BLE001 -- network, 429, 5xx: back off and retry
            err = str(e)
            time.sleep(2 + 3 * attempt)
    return [{'error': err}]


def domain_of(url):
    try:
        h = urllib.parse.urlparse(url if '://' in (url or '') else 'https://' + (url or '')).hostname or ''
    except ValueError:
        return ''
    return h[4:] if h.startswith('www.') else h


def gather(c):
    name = c['name']
    alt = c.get('legal_name') or ''
    q1 = f'{name} Indonesia startup founders co-founder pendiri'
    out = {'id': c['id'], 'name': name, 'legal_name': alt, 'url': c.get('url') or '',
           'sector': c.get('sector_label') or c.get('sector') or '', 'kota': c.get('kota') or '',
           'endeavor_entrepreneurs': c.get('endeavor_entrepreneurs') or None,
           'open': exa(q1, n=6)}
    dom = domain_of(c.get('url') or '')
    out['own'] = exa(f'{name} founders about us team leadership', n=3, domains=[dom]) if dom else []
    return out


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    out_path = sys.argv[1]
    src = os.path.join(ROOT, 'public', 'data', 'census.json')
    ids = None
    args = sys.argv[2:]
    if '--from' in args:
        src = args[args.index('--from') + 1]
    if '--ids' in args:
        ids = set(args[args.index('--ids') + 1].split(','))
    data = json.load(open(src))
    rows = data.get('companies') or data.get('rows') or []
    if ids:
        rows = [c for c in rows if c.get('id') in ids]
    done = {}
    if os.path.exists(out_path):
        done = {x['id']: x for x in json.load(open(out_path))}
    todo = [c for c in rows if c.get('id') and c['id'] not in done]
    print(f'{len(rows)} companies, {len(done)} cached, {len(todo)} to search', flush=True)
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for i, res in enumerate(ex.map(gather, todo), 1):
            done[res['id']] = res
            if i % 25 == 0 or i == len(todo):
                json.dump(list(done.values()), open(out_path, 'w'), ensure_ascii=False)
                print(f'  {i}/{len(todo)}', flush=True)
    json.dump(list(done.values()), open(out_path, 'w'), ensure_ascii=False)
    print('wrote', out_path, len(done))


if __name__ == '__main__':
    main()
