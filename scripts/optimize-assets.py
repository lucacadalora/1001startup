#!/usr/bin/env python3
"""Right-size the generated art for how the map actually draws it, and rewrite
the manifests that point at it.

The building sprites land from the image model at 512px RGBA PNG (~280KB each).
The city never draws a census sprite taller than 110 CSS px and never draws a
tenant sprite taller than 300, so most of that file is resolution the screen
cannot show and bytes a phone pays for anyway. WebP at the size actually used
is visually identical at display size (checked against the source at the
largest size each sprite is ever drawn) and about a tenth of the weight.

Originals are kept — the sprite pipeline uses them as brand refs. Re-runnable:
a .webp newer than its source is left alone.
"""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'public', 'assets')

# prefix -> (max height in px, webp quality). Heights are ~2x the largest size
# the map draws, so a dpr-2 phone still gets a 1:1 or better source.
RULES = [
    ('bld-c-', 384, 90),   # census sprites  — drawn at most 110 css px
    ('bld-',   512, 92),   # tenant sprites  — drawn at most 300 css px
    ('logo-',  256, 92),   # facade/roof marks
    ('card-',  720, 86),   # panel portraits
]

def rule_for(name):
    for pre, h, q in RULES:
        if name.startswith(pre):
            return h, q
    return None

def convert():
    made = skipped = 0
    saved = 0
    for name in sorted(os.listdir(ASSETS)):
        stem, ext = os.path.splitext(name)
        if ext.lower() not in ('.png', '.jpg', '.jpeg'):
            continue
        r = rule_for(name)
        if not r:
            continue
        maxh, q = r
        src = os.path.join(ASSETS, name)
        dst = os.path.join(ASSETS, stem + '.webp')
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            skipped += 1
            continue
        im = Image.open(src)
        if im.height > maxh:
            im = im.resize((max(1, round(im.width * maxh / im.height)), maxh), Image.LANCZOS)
        if im.mode in ('RGBA', 'LA', 'P'):
            im = im.convert('RGBA')
        im.save(dst, 'WEBP', quality=q, method=6)
        saved += os.path.getsize(src) - os.path.getsize(dst)
        made += 1
    print(f'webp: {made} written, {skipped} up to date, {saved/1048576:.1f}MB saved')

def has_webp(url):
    if not url or not url.startswith('/assets/'):
        return None
    stem, ext = os.path.splitext(url)
    if ext.lower() not in ('.png', '.jpg', '.jpeg'):
        return None
    alt = stem + '.webp'
    return alt if os.path.exists(os.path.join(ROOT, 'public', alt.lstrip('/'))) else None

def repoint(path, walk):
    full = os.path.join(ROOT, path)
    if not os.path.exists(full):
        return
    d = json.load(open(full))
    n = [0]
    def fix(obj):
        for k in ('sprite', 'logo', 'portrait'):
            alt = has_webp(obj.get(k))
            if alt:
                obj[k] = alt
                n[0] += 1
    walk(d, fix)
    if n[0]:
        json.dump(d, open(full, 'w'), ensure_ascii=False, indent=1)
    print(f'{path}: {n[0]} references repointed')

if __name__ == '__main__':
    convert()
    repoint('public/data/jakarta-tenants.json', lambda d, f: [f(t) for t in d['tenants']])
    repoint('public/data/census.json', lambda d, f: [f(c) for c in d['companies']] + [f(c) for c in d.get('nearby', [])])
    repoint('data/census-raw.json', lambda d, f: [f(c) for c in d['companies']])
    # the sprite manifest build-census.js reads back in
    man = os.path.join(ROOT, 'data', 'census-sprites.json')
    if os.path.exists(man):
        m = json.load(open(man))
        k = 0
        for i, u in list(m.items()):
            alt = has_webp(u)
            if alt:
                m[i] = alt
                k += 1
        json.dump(m, open(man, 'w'), ensure_ascii=False, indent=1)
        print(f'data/census-sprites.json: {k} references repointed')
