#!/usr/bin/env python3
"""Fetch/build a 256px rounded logo tile for every census company.

- Assigns a stable slug id to each company in data/census-raw.json.
- Icon sources, in order: site HTML <link rel=apple-touch-icon/icon> (biggest),
  /apple-touch-icon.png direct, Google s2 favicon service (sz=256; tiny replies
  = the generic globe -> rejected), else a monogram tile (sector color + letter).
- Raw icons -> data/census-icons/icon-c-<id>.png (later used as sprite brand refs).
- Tiles -> public/assets/logo-c-<id>.png (rounded r58, matching tenant tiles).
- Writes logo + logo_src back into census-raw. Idempotent: skips companies whose
  tile file already exists unless it was a monogram and --retry-monogram is set.
- SKIPS anything listed in data/census-logos.json — those marks were harvested in
  a real browser and picked by eye (scripts/logo-harvest.py + logo-pick.py) after
  this fetcher lost them to SVG icons, manifest-only icons, JS-rendered heads and
  bot shields. Never let this script fetch back over one.
Usage: python3 scripts/census-icons.py [limit]
"""
import json, os, re, sys, urllib.parse, urllib.request
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
ICONS = os.path.join(ROOT, 'data', 'census-icons')
ASSETS = os.path.join(ROOT, 'public', 'assets')
os.makedirs(ICONS, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
SECTOR_C = {
    'fintech': '#C05A2E', 'commerce': '#3F7D4E', 'logistics': '#8A6D1C', 'health': '#4e748c',
    'edtech': '#7c93a6', 'saas': '#564d43', 'ai-cloud': '#2e3f4e', 'media': '#a3506e',
    'travel': '#6e8a5a', 'prop': '#9a7b4f', 'agri': '#5a7a3f', 'fnb': '#b0703c', 'misc': '#6d675d',
    'climate': '#1f7a6d', 'bank': '#2A6E9F', 'crypto': '#6E4E8C',
}
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 10000

def slug(name):
    s = re.sub(r'^pt\.?\s+', '', name.lower())
    s = re.sub(r'\s*\(.*\)$', '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:40] or 'x'

def get(url, timeout=12):
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

def rounded(base):
    mask = Image.new('L', (256, 256), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 255, 255], radius=58, fill=255)
    out = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out

def monogram(name, key):
    base = Image.new('RGBA', (256, 256), SECTOR_C.get(key, '#6d675d'))
    d = ImageDraw.Draw(base)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 132)
    except Exception: font = ImageFont.load_default()
    ch = (name or 'X').strip()[0].upper()
    bb = d.textbbox((0, 0), ch, font=font)
    d.text(((256 - bb[2] + bb[0]) / 2 - bb[0], (256 - bb[3] + bb[1]) / 2 - bb[1]), ch, fill='white', font=font)
    return rounded(base)

raw = json.load(open(RAW))
# hand-picked marks (scripts/logo-pick.py) always win — never re-fetch over one
try: PICKED = set(json.load(open(os.path.join(ROOT, 'data', 'census-logos.json'))))
except Exception: PICKED = set()
done = ok_site = ok_s2 = mono = 0
for c in raw['companies']:
    if 'id' not in c: c['id'] = slug(c['name'])
    if c['id'] in PICKED:
        c['logo'] = f"/assets/logo-c-{c['id']}.png"; continue
    tile_path = os.path.join(ASSETS, f"logo-c-{c['id']}.png")
    if os.path.exists(tile_path):
        c.setdefault('logo', f"/assets/logo-c-{c['id']}.png"); continue
    if done >= LIMIT: continue
    done += 1
    b = site_icon(c['url']) if c.get('url') else None
    src = 'site' if b else None
    if not b and c.get('url'):
        b = s2_icon(c['url']); src = 's2' if b else None
    tile = None
    if b:
        try:
            im = load_img(b)
            open(os.path.join(ICONS, f"icon-c-{c['id']}.png"), 'wb').write(b)
            tile = tile_from(im)
        except Exception: b = None
    if tile is None:
        tile = monogram(c['name'], c.get('sector_key') or 'misc'); src = 'monogram'; mono += 1
    elif src == 'site': ok_site += 1
    else: ok_s2 += 1
    tile.save(tile_path, optimize=True)
    c['logo'] = f"/assets/logo-c-{c['id']}.png"
    c['logo_src'] = src
# indent=1 like every other census-raw writer (census-national.py etc.): a
# compact dump turns the next commit into a whole-file rewrite. Atomic, too.
_tmp = RAW + '.tmp'
with open(_tmp, 'w', encoding='utf-8') as _fh:
    json.dump(raw, _fh, ensure_ascii=False, indent=1)
os.replace(_tmp, RAW)
print(f"icons: processed {done} (site {ok_site}, s2 {ok_s2}, monogram {mono}); total with logo now {sum(1 for c in raw['companies'] if c.get('logo'))}/{len(raw['companies'])}")
