#!/usr/bin/env python3
"""Small, content-named copies of the art the four-dataset front page shows.

The front page previews each census with its own art: the data-centre power
illustrations (960x540, ~120 KB each) and the exporter commodity sprites
(~250 KB PNGs). Shipped as-is that is ~3 MB on a page whose job is to load
fast on a phone, so this writes small WebP copies under public/assets/home/
with a content hash in the name (the CF edge caches /assets for a long time;
a new picture must be a new URL) and a manifest the view reads,
data/home-assets.json. Re-run after the source art changes; nothing else
writes these files.

The exporter sector pictograms (data/umkm-sector-icons.json, SVG with
currentColor) are copied as SVG, each painted in its sector colour from
umkm.json, under 'icons'; the page shows them instead of the sprites only while
data/sector-icons.live is on (lib/iconslive.js).

    python3 scripts/home-assets.py [--map path/to/map-screenshot.png]
"""
import hashlib
import io
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'assets', 'home')
MANIFEST = os.path.join(ROOT, 'data', 'home-assets.json')


def save(img, stem, quality=80):
    buf = io.BytesIO()
    img.save(buf, 'WEBP', quality=quality, method=6)
    data = buf.getvalue()
    name = '%s.%s.webp' % (stem, hashlib.md5(data).hexdigest()[:8])
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(data)
    return '/assets/home/' + name, len(data)


def fit(img, w):
    if img.width <= w:
        return img
    h = round(img.height * w / img.width)
    return img.resize((w, h), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    old = {}
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            old = json.load(f)
    man = {'dc': {}, 'sprites': {}, 'icons': {}, 'map': old.get('map')}
    total = 0

    # data-centre matrix illustrations, 640 px wide (2x a 320 px card cell)
    for key in ['gf-grid', 'gf-btm', 'gf-offgrid', 'gf-hybrid', 'bf-grid', 'bf-btm', 'bf-offgrid', 'bf-hybrid']:
        src = os.path.join(ROOT, 'public', 'assets', 'dc', key + '.webp')
        if not os.path.exists(src):
            continue
        url, n = save(fit(Image.open(src).convert('RGB'), 640), 'dc-' + key, 78)
        man['dc'][key] = url
        total += n

    # exporter commodity sprites, 192 px (2x a 96 px tile), alpha kept
    with open(os.path.join(ROOT, 'public', 'data', 'umkm.json')) as f:
        umkm = json.load(f)
    for sector, path in (umkm.get('sprites') or {}).items():
        src = os.path.join(ROOT, 'public', path.lstrip('/'))
        if not os.path.exists(src):
            continue
        img = Image.open(src).convert('RGBA')
        img.thumbnail((192, 192), Image.LANCZOS)
        stem = 'sp-' + os.path.splitext(os.path.basename(path))[0]
        url, n = save(img, stem, 82)
        man['sprites'][sector] = url
        total += n

    # exporter sector pictograms: SVG kept as SVG, painted in the sector colour
    icons_file = os.path.join(ROOT, 'data', 'umkm-sector-icons.json')
    if os.path.exists(icons_file):
        with open(icons_file) as f:
            icons = json.load(f).get('icons') or {}
        colors = umkm.get('sector_colors') or {}
        for sector, path in icons.items():
            src = os.path.join(ROOT, 'public', path.lstrip('/'))
            if not os.path.exists(src) or sector not in colors:
                continue
            with open(src) as f:
                svg = f.read().replace('currentColor', colors[sector]).encode()
            name = 'si-%s.%s.svg' % (os.path.splitext(os.path.basename(path))[0], hashlib.md5(svg).hexdigest()[:8])
            with open(os.path.join(OUT, name), 'wb') as f:
                f.write(svg)
            man['icons'][sector] = '/assets/home/' + name
            total += len(svg)

    # the logo-map preview: a screenshot handed in by the caller
    if '--map' in sys.argv:
        src = sys.argv[sys.argv.index('--map') + 1]
        url, n = save(fit(Image.open(src).convert('RGB'), 1200), 'map-preview', 76)
        man['map'] = url
        total += n

    # drop superseded copies so the folder holds only what the manifest names
    keep = set(os.path.basename(u) for u in list(man['dc'].values()) + list(man['sprites'].values()) + list(man['icons'].values()) + ([man['map']] if man['map'] else []))
    for name in os.listdir(OUT):
        if name not in keep:
            os.remove(os.path.join(OUT, name))

    with open(MANIFEST, 'w') as f:
        json.dump(man, f, indent=1, sort_keys=True)
    print('wrote %d files, %.0f KB, manifest %s' % (len(keep), total / 1024, MANIFEST))


if __name__ == '__main__':
    main()
