#!/usr/bin/env python3
"""Flag census logo tiles that are probably not the company's mark.

Two checks, both cheap and both aimed at how the auto-fetcher fails:
  1. DUPLICATES — a stock framework favicon (React, Vue, Angular, Next, Vite,
     WordPress...) left in place by a site's build tooling. Every site that
     shipped one gets the same tile, so identical perceptual hashes across
     different companies is the tell. Anteraja was serving Angular's shield and
     Materee React's atom before this existed.
  2. THIN — a tile whose mark occupies almost none of the frame, or that is a
     single flat colour: a failed fetch, a blank placeholder, a 16px smudge.

Reports only; picking the replacement is a human call (scripts/logo-pick.py).
Usage: python3 scripts/logo-audit.py
"""
import json, os
from collections import defaultdict
from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CENSUS = os.path.join(ROOT, 'public', 'data', 'census.json')

def phash(im, n=12):
    """Hash the mark, not the packaging: flatten onto white (a stock favicon
    arrives transparent, a census tile already carries its card), drop the
    rounded corners, then autocrop so scale and padding stop mattering."""
    im = im.convert('RGBA')
    flat = Image.new('RGB', im.size, (255, 255, 255))
    flat.paste(im, (0, 0), im)
    w, h = flat.size
    c = int(min(w, h) * 0.10)
    flat = flat.crop((c, c, w - c, h - c))
    bg = Image.new('RGB', flat.size, (255, 255, 255))
    bbox = ImageChops.difference(flat, bg).convert('L').point(lambda p: 255 if p > 20 else 0).getbbox()
    if bbox: flat = flat.crop(bbox)
    g = flat.convert('L').resize((n, n), Image.LANCZOS)
    px = list(g.getdata())
    avg = sum(px) / len(px)
    return ''.join('1' if p > avg else '0' for p in px)

def ink(im):
    """Share of the tile the mark actually covers, and how many distinct hues."""
    im = im.convert('RGBA')
    rgb = im.convert('RGB')
    bg = Image.new('RGB', rgb.size, rgb.getpixel((128, 8)))
    d = ImageChops.difference(rgb, bg).convert('L').point(lambda p: 255 if p > 22 else 0)
    px = list(d.getdata())
    return sum(1 for p in px if p) / len(px)

# Stock favicons a build tool leaves behind. A census tile matching one of these
# is the framework's logo, not the company's — Materee shipped React's atom and
# Anteraja Angular's shield this way.
STOCK = {
    'react':  'https://react.dev/favicon.ico',
    'cra-logo192': 'https://raw.githubusercontent.com/facebook/create-react-app/main/'
                   'packages/cra-template/template/public/logo192.png',
    'vue':    'https://vuejs.org/logo.svg',
    'angular':'https://angular.dev/assets/icons/favicon.ico',
    'next':   'https://nextjs.org/favicon.ico',
    'nuxt':   'https://nuxt.com/favicon.ico',
    'vite':   'https://vite.dev/logo.svg',
    'svelte': 'https://svelte.dev/favicon.png',
    'wordpress': 'https://wordpress.org/favicon.ico',
    'laravel':'https://laravel.com/favicon.ico',
    'webflow':'https://webflow.com/favicon.ico',
    'wix':    'https://www.wix.com/favicon.ico',
    'shopify':'https://www.shopify.com/favicon.ico',
    'framer': 'https://www.framer.com/favicon.ico',
    'godaddy':'https://www.godaddy.com/favicon.ico',
}
# NOTE: this catches the systematic build-tool leak only. A logo that belongs to a
# different real company (goKampus's row was serving a gambling site's favicon
# after its domain lapsed) still needs the eyeball pass — render the tiles with
# scripts/logo-sheet.py and look.


def hamming(a, b):
    return sum(1 for x, y in zip(a, b) if x != y)


def stock_hashes():
    """Fetch the reference favicons once; cached under data/logo-stock/."""
    import urllib.request
    d = os.path.join(ROOT, 'data', 'logo-stock')
    os.makedirs(d, exist_ok=True)
    out = {}
    for name, url in STOCK.items():
        f = os.path.join(d, name + '.png')
        if not os.path.exists(f):
            try:
                if url.endswith('.svg'): continue     # needs a browser; skip
                b = urllib.request.urlopen(urllib.request.Request(
                    url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20).read()
                im = Image.open(__import__('io').BytesIO(b)); im.load()
                im.convert('RGBA').save(f)
            except Exception:
                continue
        try: out[name] = phash(Image.open(f))
        except Exception: pass
    return out


census = json.load(open(CENSUS))
STOCK_H = stock_hashes()
stock_hits = []
by_hash = defaultdict(list)
thin = []
for c in census['companies']:
    p = os.path.join(ROOT, 'public', 'assets', f"logo-c-{c['id']}.png")
    if not os.path.exists(p):
        print(f"  MISSING FILE {c['id']}"); continue
    im = Image.open(p)
    by_hash[phash(im)].append(c['id'])
    h = phash(im)
    for name, sh in STOCK_H.items():
        if hamming(h, sh) <= 14:
            stock_hits.append((hamming(h, sh), c['id'], name, c.get('logo_src')))
    cover = ink(im)
    if cover < 0.035:
        thin.append((round(cover, 4), c['id'], c.get('logo_src')))

dups = {h: ids for h, ids in by_hash.items() if len(ids) > 1}
print(f"DUPLICATE TILES ({len(dups)} groups) — same art on different companies:")
for ids in sorted(dups.values(), key=len, reverse=True):
    print('   ', ', '.join(ids))
print(f"\nSTOCK-FRAMEWORK FAVICONS ({len(stock_hits)}) — refs loaded: {len(STOCK_H)}:")
for dist, cid, name, src in sorted(stock_hits):
    print(f'    d={dist:2d}  {cid:34s} looks like {name} ({src})')

print(f"\nTHIN / NEARLY EMPTY TILES ({len(thin)}):")
for cover, cid, src in sorted(thin):
    print(f'    {cover:.3f}  {cid:34s} {src}')
