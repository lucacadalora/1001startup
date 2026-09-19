#!/usr/bin/env python3
"""Contact sheet of logo candidates (or finished tiles) for eyeball review.
Usage: python3 scripts/logo-sheet.py candidates <id> [<id>...] -o out.png
       python3 scripts/logo-sheet.py tiles <id,id,...|all> -o out.png
"""
import json, os, sys, math
from PIL import Image, ImageDraw, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAND = os.path.join(ROOT, 'data', 'logo-candidates')
ASSETS = os.path.join(ROOT, 'public', 'assets')
F = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', s)
FB = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', s)

def cell(im, box, label, sub, draw, x, y, cw, ch):
    draw.rectangle([x, y, x + cw - 1, y + ch - 1], outline=(210, 210, 210))
    if im:
        t = im.convert('RGBA'); t.thumbnail((box, box), Image.LANCZOS)
        chk = Image.new('RGBA', t.size, (240, 240, 240, 255))
        for i in range(0, t.size[0], 12):
            for j in range(0, t.size[1], 12):
                if (i // 12 + j // 12) % 2: chk.paste((255, 255, 255, 255), (i, j, min(i + 12, t.size[0]), min(j + 12, t.size[1])))
        chk.alpha_composite(t)
        im2 = chk
        base.paste(im2, (x + (cw - t.size[0]) // 2, y + 6), im2)
    draw.text((x + 5, y + box + 10), label[:30], fill=(20, 20, 20), font=FB(13))
    draw.text((x + 5, y + box + 26), sub[:38], fill=(120, 120, 120), font=F(11))

mode = sys.argv[1]
args = [a for a in sys.argv[2:] if a != '-o']
out = 'sheet.png'
if '-o' in sys.argv: out = sys.argv[sys.argv.index('-o') + 1]; args = args[:-1]

items = []   # (image_or_None, label, sub)
if mode == 'candidates':
    for cid in args:
        d = os.path.join(CAND, cid)
        try: meta = json.load(open(os.path.join(d, 'meta.json')))
        except Exception: continue
        for c in meta['candidates']:
            p = os.path.join(ROOT, c['path'])
            try: im = Image.open(p)
            except Exception: im = None
            items.append((im, cid, os.path.basename(c['path'])))
        if not meta['candidates']:
            items.append((None, cid, 'NO CANDIDATES ' + '; '.join(meta.get('errors', []))[:30]))
else:
    ids = args[0].split(',')
    if ids == ['all']:
        ids = sorted(f[7:-4] for f in os.listdir(ASSETS) if f.startswith('logo-c-'))
    for cid in ids:
        p = os.path.join(ASSETS, f'logo-c-{cid}.png')
        try: im = Image.open(p)
        except Exception: im = None
        items.append((im, cid, ''))

BOX, PADX, PADY = 118, 132, 168
COLS = min(8, max(1, len(items)))
ROWS = math.ceil(len(items) / COLS)
base = Image.new('RGBA', (COLS * PADX + 8, ROWS * PADY + 8), (255, 255, 255, 255))
dr = ImageDraw.Draw(base)
for i, (im, lab, sub) in enumerate(items):
    x = 4 + (i % COLS) * PADX; y = 4 + (i // COLS) * PADY
    cell(im, BOX, box_lab := lab, sub, dr, x, y, PADX - 4, PADY - 4)
base.convert('RGB').save(out, quality=92)
print(out, base.size, len(items), 'cells')
