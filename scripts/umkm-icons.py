#!/usr/bin/env python3
"""Fetch/build a 256px rounded logo tile for every 1001umkm.id exporter.

Same recipe as scripts/census-icons.py (site <link> icons -> /apple-touch-icon
-> Google s2 sz=256 with tiny-reply=globe rejection -> monogram tile in sector
color), with the one structural difference the census learned the hard way:
this script writes ONLY the single-writer side file data/umkm-logos.json —
never the master data/umkm-raw.json — and scripts/build-umkm.js merges it.

Raw icons -> data/umkm-icons/icon-u-<id>.png
Tiles     -> public/assets/logo-u-<id>.png (rounded r58)
Manifest  -> data/umkm-logos.json  {logos: {id: path}, src: {id: kind}}

Idempotent: an existing tile file is kept (monograms re-made with --retry-monogram).
Site fetches run on a small thread pool; PIL work stays in the main thread.
Usage: python3 scripts/umkm-icons.py [limit]
"""
import json, os, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'umkm-raw.json')
MANIFEST = os.path.join(ROOT, 'data', 'umkm-logos.json')
ICONS = os.path.join(ROOT, 'data', 'umkm-icons')
ASSETS = os.path.join(ROOT, 'public', 'assets')
os.makedirs(ICONS, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
SECTOR_C = {
    'Fisheries & Seaweed': '#4e748c', 'Furniture': '#9a7b4f', 'Spices': '#b0703c',
    'Coconut & Charcoal': '#564d43', 'Textiles & Fashion': '#a3506e', 'Coffee & Tea': '#6b4f3a',
    'Cosmetics & Essential Oils': '#7c93a6', 'Agriculture': '#5a7a3f', 'Jewelry': '#6E4E8C',
    'Food & Beverage': '#C05A2E', 'Automotive & Industrial': '#2e3f4e', 'Home Decor': '#8A6D1C',
    'Footwear': '#6d675d', 'Handicraft': '#3F7D4E', 'Leather Goods': '#7a4a3a',
}
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 10000
RETRY_MONO = '--retry-monogram' in sys.argv

def get(url, timeout=10):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=timeout).read()

def site_icon(url):
    try:
        html = get(url).decode('utf-8', 'ignore')
    except Exception:
        return None
    cands = []
    for L in re.findall(r'<link[^>]+rel="(?:apple-touch-icon[^"]*|icon|shortcut icon)"[^>]*>', html):
        href = re.search(r'href="([^"]+)"', L)
        if not href: continue
        sizes = re.search(r'sizes="(\d+)', L)
        score = int(sizes.group(1)) if sizes else (180 if 'apple-touch' in L else 32)
        cands.append((score, urllib.parse.urljoin(url, href.group(1))))
    for score, u in sorted(cands, reverse=True)[:3]:
        try:
            b = get(u)
            if len(b) > 1200: return b
        except Exception: pass
    try:
        b = get(urllib.parse.urljoin(url, '/apple-touch-icon.png'))
        if len(b) > 1200: return b
    except Exception: pass
    return None

def s2_icon(url):
    host = urllib.parse.urlparse(url).netloc
    try:
        b = get(f'https://www.google.com/s2/favicons?domain={host}&sz=256')
        if len(b) > 1500: return b  # tiny reply = generic globe
    except Exception: pass
    return None

def load_img(b):
    im = Image.open(BytesIO(b)); im.load()
    if getattr(im, 'n_frames', 1) > 1: im.seek(0)
    return im.convert('RGBA')

def rounded(base):
    mask = Image.new('L', (256, 256), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 255, 255], radius=58, fill=255)
    out = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out

def tile_from(im):
    w, h = im.size
    if min(w, h) < 48: im = im.resize((256, 256), Image.NEAREST if max(w, h) < 48 else Image.LANCZOS); w = h = 256
    corner_a = im.getpixel((2, 2))[3]
    if corner_a < 200:  # transparent icon -> white card
        base = Image.new('RGBA', (256, 256), (255, 255, 255, 255))
        s = 208; ic = im.resize((s, s), Image.LANCZOS)
        base.paste(ic, ((256 - s) // 2, (256 - s) // 2), ic)
    else:               # full-bleed -> crop 8% to shed baked corners
        c = int(min(w, h) * 0.08)
        base = im.crop((c, c, w - c, h - c)).resize((256, 256), Image.LANCZOS)
        bg = Image.new('RGBA', (256, 256), (255, 255, 255, 255)); bg.paste(base, (0, 0), base); base = bg
    return rounded(base)

def monogram(name, sector):
    base = Image.new('RGBA', (256, 256), SECTOR_C.get(sector, '#6d675d'))
    d = ImageDraw.Draw(base)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 132)
    except Exception: font = ImageFont.load_default()
    ch = (name or 'X').strip()[0].upper()
    bb = d.textbbox((0, 0), ch, font=font)
    d.text(((256 - bb[2] + bb[0]) / 2 - bb[0], (256 - bb[3] + bb[1]) / 2 - bb[1]), ch, fill='white', font=font)
    return rounded(base)

raw = json.load(open(RAW))
try:
    man = json.load(open(MANIFEST))
except Exception:
    man = {'logos': {}, 'src': {}}
man.setdefault('logos', {}); man.setdefault('src', {})

todo = []
for c in raw['companies']:
    cid = c['id']
    tile_path = os.path.join(ASSETS, f'logo-u-{cid}.png')
    if os.path.exists(tile_path) and not (RETRY_MONO and man['src'].get(cid) == 'monogram'):
        man['logos'].setdefault(cid, f'/assets/logo-u-{cid}.png')
        man['src'].setdefault(cid, man['src'].get(cid, 'unknown'))
        continue
    todo.append(c)
todo = todo[:LIMIT]

def fetch(c):
    if not c.get('url'): return c['id'], None, None
    b = site_icon(c['url'])
    if b: return c['id'], b, 'site'
    b = s2_icon(c['url'])
    return c['id'], b, 's2' if b else None

ok_site = ok_s2 = mono = 0
with ThreadPoolExecutor(max_workers=12) as ex:
    for c, (cid, b, src) in zip(todo, ex.map(fetch, todo)):
        tile = None
        if b:
            try:
                im = load_img(b)
                open(os.path.join(ICONS, f'icon-u-{cid}.png'), 'wb').write(b)
                tile = tile_from(im)
            except Exception: b = None
        if tile is None:
            tile = monogram(c['name'], c.get('sector')); src = 'monogram'; mono += 1
        elif src == 'site': ok_site += 1
        else: ok_s2 += 1
        tile.save(os.path.join(ASSETS, f'logo-u-{cid}.png'), optimize=True)
        man['logos'][cid] = f'/assets/logo-u-{cid}.png'
        man['src'][cid] = src

json.dump(man, open(MANIFEST, 'w'), ensure_ascii=False, indent=0)
print(f'icons: processed {len(todo)} (site {ok_site}, s2 {ok_s2}, monogram {mono}); manifest {len(man["logos"])}/{len(raw["companies"])}')
