#!/usr/bin/env python3
"""Re-prove every relationship in data/census-links.json against its own source.

The census rule for figures — the link IS the credibility — applies twice as hard
to a relationship, because "X supplies Y" is a claim about two companies at once.
So no edge is published on the strength of having been read once. Each edge names
a `probe`: a short string that MUST still appear in the source document. This
script fetches every source (HTML or PDF), normalises whitespace, and checks it.

  pass  -> stamps checked=<today>, check="pass"
  fail  -> stamps check="fail"; scripts/build-links.js refuses to publish it

Run:  python3 scripts/links-verify.py [--force]
      (sources are cached under data/links-cache/ for the day unless --force)
"""
import json, os, re, sys, subprocess, gzip, urllib.request, datetime, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINKS = os.path.join(ROOT, 'data', 'census-links.json')
CACHE = os.path.join(ROOT, 'data', 'links-cache')
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
TODAY = datetime.date.today().isoformat()
FORCE = '--force' in sys.argv


def fetch(url, kind):
    """Return the source as plain text — HTML stripped, PDF run through pdftotext."""
    os.makedirs(CACHE, exist_ok=True)
    key = hashlib.sha1(url.encode()).hexdigest()[:16]
    txt = os.path.join(CACHE, f'{key}-{TODAY}.txt')
    if os.path.exists(txt) and not FORCE:
        return open(txt, encoding='utf-8').read(), 'cache'
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
        # Evidence that lives in pixels (FAS's integration diagram) cannot be
        # probed as text, so the probe is the image's content hash: if the file
        # at the URL changes AT ALL, the claim fails closed and waits for a
        # person to re-read the new image. Weaker than a text probe (any pixel
        # change trips it) but strictly honest — we never claim an unread image
        # still says what the old one said.
        import hashlib as _h
        t = 'sha256:' + _h.sha256(body).hexdigest()
    else:
        h = body.decode('utf-8', 'ignore')
        h = re.sub(r'(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>', ' ', h)
        h = re.sub(r'(?s)<!--.*?-->', ' ', h)
        # keep what images SAY before stripping tags: alt text and src names are
        # the only place some pages name a partner (FAS's client logos), and a
        # probe must be able to reach them
        alts = re.findall(r'<img[^>]+>', h)
        imgs = ' '.join(' '.join(re.findall(r'(?:alt|src)="([^"]*)"', tag)) for tag in alts)
        t = re.sub(r'(?s)<[^>]+>', ' ', h).replace('&nbsp;', ' ').replace('&amp;', '&')
        t = t + ' ' + imgs
    t = re.sub(r'\s+', ' ', t).strip()
    open(txt, 'w', encoding='utf-8').write(t)
    return t, f'{len(t)} chars'


def main():
    d = json.load(open(LINKS, encoding='utf-8'))
    texts, errs = {}, {}
    for sid, s in d['sources'].items():
        try:
            texts[sid], how = fetch(s['url'], s.get('kind', 'html'))
            print(f'  fetched {sid:20} {how}')
        except Exception as e:                      # a source we cannot read cannot prove anything
            errs[sid] = str(e)
            print(f'  FAILED  {sid:20} {e}')
    npass = nfail = 0
    for e in d['edges']:
        t = texts.get(e['src'])
        ok = bool(t) and re.sub(r'\s+', ' ', e['probe']) in t
        e['check'] = 'pass' if ok else 'fail'
        e['checked'] = TODAY
        if ok:
            npass += 1
        else:
            nfail += 1
            why = errs.get(e['src'], 'probe string no longer on the page')
            e['check_note'] = why
            print(f'  ! {e.get("from") or e.get("from_name")} -> {e["to"]} [{e["src"]}]: {why}')
        if ok:
            e.pop('check_note', None)
    d['verified'] = TODAY
    d['verify'] = {'pass': npass, 'fail': nfail, 'sources': len(d['sources']), 'unreadable': list(errs)}
    json.dump(d, open(LINKS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'\n{npass} pass / {nfail} fail across {len(d["sources"])} sources — stamped {TODAY}')
    return 1 if nfail else 0


if __name__ == '__main__':
    sys.exit(main())
