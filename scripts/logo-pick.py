#!/usr/bin/env python3
"""Turn a chosen candidate into the published 256px rounded logo tile.

Reads a picks file of "<company-id> <candidate-filename>" lines (candidates live
in data/logo-candidates/<id>/), builds the same tile the census pipeline ships —
256px, rounded r58, white card behind transparent or non-square art — and writes
public/assets/logo-c-<id>.png.

The pick is recorded in data/census-logos.json, NOT in census-raw.json: the census
research loop rewrites census-raw wholesale (it drops dead companies, adds new
ones), so a second writer there loses edits. build-census.js merges this manifest
the same way it merges census-sprites.json.

Tiles are published under a CONTENT-HASHED name (logo-c-<id>.<hash8>.png) because
nginx serves /assets/ with max-age=2592000 — replacing bytes at a stable filename
leaves Cloudflare and every browser pinned to the old mark for a month. The hash
goes in the filename, not a ?v= query (the fleet rule; query strings are not a
reliable cache key at the edge). Stale hashed variants for that id are deleted.

A picks line of "<id> MONOGRAM" forces the neutral sector-colour letter tile and
pins it in the manifest — for a company whose recorded site has been taken over
(goKampus's domain now serves a gambling site, and the auto-fetcher happily
adopted that site's favicon). A blank letter is the honest answer there.

Usage: python3 scripts/logo-pick.py picks.txt [--dry]
"""
import hashlib, json, os, re, sys
from PIL import Image, ImageDraw, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
MANIFEST = os.path.join(ROOT, 'data', 'census-logos.json')
CAND = os.path.join(ROOT, 'data', 'logo-candidates')
ASSETS = os.path.join(ROOT, 'public', 'assets')
ICONS = os.path.join(ROOT, 'data', 'census-icons')

def trim(im):
    """Drop transparent / uniform-white margin so the mark fills the tile."""
    a = im.split()[3]
    bbox = a.getbbox() if a.getextrema()[0] < 250 else None
    if bbox is None:                       # opaque: trim uniform border colour
        rgb = im.convert('RGB')
        bg = Image.new('RGB', rgb.size, rgb.getpixel((0, 0)))
        bbox = ImageChops.difference(rgb, bg).convert('L').point(lambda p: 255 if p > 12 else 0).getbbox()
    if not bbox: return im
    w, h = im.size
    # a near-full bbox means the art already bleeds to the edge — leave it alone
    if (bbox[2] - bbox[0]) > w * 0.95 and (bbox[3] - bbox[1]) > h * 0.95: return im
    return im.crop(bbox)

def floats_on_plain(im):
    """True when the art is a small mark sitting on a plain field — an SVG we
    rasterised onto a white page, not a composed app icon. Those must be trimmed
    or the mark ends up a speck in the middle of the tile."""
    rgb = im.convert('RGB')
    bg = Image.new('RGB', rgb.size, rgb.getpixel((0, 0)))
    bbox = ImageChops.difference(rgb, bg).convert('L').point(lambda p: 255 if p > 12 else 0).getbbox()
    if not bbox: return False
    return (bbox[2] - bbox[0]) < im.size[0] * 0.72 or (bbox[3] - bbox[1]) < im.size[1] * 0.72


def card_colour(ic):
    """White card, except for a knocked-out (white-on-transparent) logo — that
    one is invisible on white, so it gets the dark card the brand designed it for."""
    px = [p for p in ic.convert('RGBA').getdata() if p[3] > 120]
    if not px: return (255, 255, 255, 255)
    light = sum(1 for r, g, b, _ in px if r > 218 and g > 218 and b > 218)
    return (17, 18, 20, 255) if light / len(px) > 0.8 else (255, 255, 255, 255)


def rounded(base):
    mask = Image.new('L', (256, 256), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 255, 255], radius=58, fill=255)
    out = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out

def publish(t, cid):
    """Write the tile under a content-hashed name and drop that id's older ones.
    Returns the public path to record in the manifest."""
    from io import BytesIO
    buf = BytesIO(); t.save(buf, 'PNG', optimize=True); data = buf.getvalue()
    h = hashlib.sha1(data).hexdigest()[:8]
    keep = {f'logo-c-{cid}.{h}.png', f'logo-c-{cid}.{h}.webp', f'logo-c-{cid}.png'}
    pat = re.compile(rf'^logo-c-{re.escape(cid)}\.[0-9a-f]{{8}}\.(png|webp)$')
    for f in os.listdir(ASSETS):
        if pat.match(f) and f not in keep:
            os.remove(os.path.join(ASSETS, f))
    open(os.path.join(ASSETS, f'logo-c-{cid}.{h}.png'), 'wb').write(data)
    open(os.path.join(ASSETS, f'logo-c-{cid}.png'), 'wb').write(data)  # stable copy for tooling
    return f'/assets/logo-c-{cid}.{h}.png'


def tile(path):
    im = Image.open(path); im.load(); im = im.convert('RGBA')
    w, h = im.size
    opaque = im.split()[3].getextrema()[0] > 250
    square = 0.9 <= w / h <= 1.11
    if opaque and square and not floats_on_plain(im):
        # app-store / full-bleed art is already composed: only shed the ~8% the
        # platforms bake into the corners. Trimming here eats into the mark.
        c = int(min(w, h) * 0.08)
        base = im.crop((c, c, w - c, h - c)).resize((256, 256), Image.LANCZOS)
        bg = Image.new('RGBA', (256, 256), (255, 255, 255, 255)); bg.paste(base, (0, 0), base)
        return rounded(bg)
    # transparent mark, or a wordmark screenshot: trim the dead margin, then
    # centre what is left on a card
    im = trim(im)
    w, h = im.size
    pad = 208 if 0.9 <= w / h <= 1.11 else 224   # wordmarks get more width
    r = min(pad / w, pad / h)
    ic = im.resize((max(1, round(w * r)), max(1, round(h * r))), Image.LANCZOS)
    base = Image.new('RGBA', (256, 256), card_colour(ic))
    base.paste(ic, ((256 - ic.size[0]) // 2, (256 - ic.size[1]) // 2), ic)
    return rounded(base)

SECTOR_C = {
    'fintech': '#C05A2E', 'commerce': '#3F7D4E', 'logistics': '#8A6D1C', 'health': '#4e748c',
    'edtech': '#7c93a6', 'saas': '#564d43', 'ai-cloud': '#2e3f4e', 'media': '#a3506e',
    'travel': '#6e8a5a', 'prop': '#9a7b4f', 'agri': '#5a7a3f', 'fnb': '#b0703c', 'misc': '#6d675d',
}


def monogram(name, key):
    from PIL import ImageFont
    base = Image.new('RGBA', (256, 256), SECTOR_C.get(key, '#6d675d'))
    d = ImageDraw.Draw(base)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 132)
    except Exception: font = ImageFont.load_default()
    ch = (name or 'X').strip()[0].upper()
    bb = d.textbbox((0, 0), ch, font=font)
    d.text(((256 - bb[2] + bb[0]) / 2 - bb[0], (256 - bb[3] + bb[1]) / 2 - bb[1]), ch, fill='white', font=font)
    return rounded(base)


picks = []
for line in open(sys.argv[1]):
    line = line.strip()
    if not line or line.startswith('#'): continue
    cid, fn = line.split(None, 1)
    picks.append((cid, fn.strip()))
dry = '--dry' in sys.argv

raw = json.load(open(RAW))
by_id = {c['id']: c for c in raw['companies'] if 'id' in c}
man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
done = []
for cid, fn in picks:
    if fn == 'MONOGRAM':
        c = by_id.get(cid, {})
        t = monogram(c.get('name') or cid, c.get('sector_key') or 'misc')
        if not dry:
            man[cid] = {'logo': publish(t, cid), 'logo_src': 'monogram:forced'}
        done.append(cid)
        continue
    src = os.path.join(CAND, cid, fn)
    if not os.path.exists(src):
        print(f'  !! {cid}: missing {fn}'); continue
    t = tile(src)
    if not dry:
        pub = publish(t, cid)
        # keep the raw art around as a sprite brand-ref, same as the icon pipeline
        Image.open(src).convert('RGBA').save(os.path.join(ICONS, f'icon-c-{cid}.png'))
        man[cid] = {'logo': pub,
                    'logo_src': 'picked:' + ('appstore' if 'appstore' in fn else
                                             'play' if 'play' in fn else
                                             'header' if fn.startswith(('h', 'x')) else
                                             'manual' if 'manual' in fn else 'site')}
    done.append(cid)
    if cid not in by_id: print(f'  ~~ {cid}: not in census-raw (dropped or renamed) — tile built anyway')
if not dry:
    json.dump(man, open(MANIFEST, 'w'), indent=1, sort_keys=True)
print(f'built {len(done)} tiles' + (' (dry run)' if dry else f'; manifest now {len(man)} entries'))
