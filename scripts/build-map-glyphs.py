#!/usr/bin/env python3
"""1001startup.id /map — the site's own font, as map glyphs.

MapLibre draws map text from signed-distance-field glyph sheets ("glyph PBFs",
256 codepoints per file) instead of the browser's fonts, so the company names
on /map would otherwise have to be set in some stock map font. This turns
Overused Grotesk — the face every other 1001 page is set in — into those
sheets, one instance per weight the map uses:

    public/assets/map/glyphs/<stack>/<start>-<end>.pbf

Same contract node-fontnik writes (24 px em, 3 px buffer, radius 8, cutoff
0.25 — the values MapLibre's shader assumes); checked against Protomaps' own
Noto Sans sheets before it was trusted (same SDF values to within a few
levels, same metric conventions). Distances come from an 8x rasterisation,
not the outline, which is accurate to ~1/8 px at 24 px.

Run after changing the font file or the weight list; the output is committed.
    python3 scripts/build-map-glyphs.py
"""
import io
import math
import os
import sys

import numpy as np
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageFont
from scipy.ndimage import distance_transform_edt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'assets', 'fonts', 'overused-grotesk-vf.woff2')
OUT = os.path.join(ROOT, 'public', 'assets', 'map', 'glyphs')

# stack name -> wght. Company names are SemiBold; place names Medium; the
# national view's city headings Bold.
STACKS = {
    'OverusedGrotesk-Medium': 500,
    'OverusedGrotesk-SemiBold': 640,
    'OverusedGrotesk-Bold': 760,
}
# Latin, Latin-1, Extended-A/B, Extended Additional, punctuation, letterlike.
# Anything else the basemap asks for gets an empty sheet from the server.
RANGES = [0, 256, 512, 7680, 8192, 8448]

SIZE, BUF, RADIUS, CUTOFF, S = 24, 3, 8, 0.25, 8


def instance(wght):
    vf = TTFont(SRC)
    axes = {'wght': wght}
    if any(a.axisTag == 'slnt' for a in vf['fvar'].axes):
        axes['slnt'] = 0
    f = instancer.instantiateVariableFont(vf, axes)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    return buf.getvalue(), f


def glyph(font, ch, A):
    adv = font.getlength(ch) / S
    mask, (ox, oy) = font.getmask2(ch, mode='L', anchor='ls')
    m = np.array(Image.frombytes('L', mask.size, bytes(mask))) if mask.size[0] and mask.size[1] else np.zeros((0, 0), np.uint8)
    ys, xs = np.nonzero(m >= 32)          # the ink, not the layout box getmask2 pads to
    if ch.isspace() or not len(xs):
        return dict(width=0, height=0, left=0, top=-A, advance=round(adv), bitmap=b'')
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    ox += int(xs.min())
    oy += int(ys.min())
    H, W = m.shape
    x0, x1 = math.floor(ox / S), math.ceil((ox + W) / S)
    y0, y1 = math.floor(oy / S), math.ceil((oy + H) / S)
    w, h = x1 - x0, y1 - y0
    P = BUF + RADIUS                     # pad so distances near the border are true
    canvas = np.zeros(((h + 2 * P) * S, (w + 2 * P) * S), dtype=np.uint8)
    px, py = ox - (x0 - P) * S, oy - (y0 - P) * S
    canvas[py:py + H, px:px + W] = m
    inside = canvas >= 128
    d = (distance_transform_edt(~inside) - distance_transform_edt(inside)) / S   # + outside
    off = (P - BUF) * S + S // 2         # centre of each 24 px pixel
    samp = d[off:off + (h + 2 * BUF) * S:S, off:off + (w + 2 * BUF) * S:S]
    v = np.clip(np.round(255 - 255 * (samp / RADIUS + CUTOFF)), 0, 255).astype(np.uint8)
    return dict(width=w, height=h, left=x0, top=-y0 - A, advance=round(adv), bitmap=v.tobytes())


# ── glyphs.proto, by hand (five fields; not worth a protobuf dependency) ──
def _v(n):
    out = bytearray()
    while True:
        b, n = n & 0x7f, n >> 7
        out.append(b | 0x80 if n else b)
        if not n:
            return bytes(out)


def _ld(f, b):
    return _v((f << 3) | 2) + _v(len(b)) + b


def _u(f, n):
    return _v(f << 3) + _v(n)


def _s(f, n):
    return _v(f << 3) + _v(n * 2 if n >= 0 else -n * 2 - 1)   # zigzag


def encode(name, rng, glyphs):
    body = _ld(1, name.encode()) + _ld(2, rng.encode())
    for cp, g in glyphs:
        body += _ld(3, _u(1, cp) + (_ld(2, g['bitmap']) if g['bitmap'] else b'')
                    + _u(3, g['width']) + _u(4, g['height'])
                    + _s(5, g['left']) + _s(6, g['top']) + _u(7, g['advance']))
    return _ld(1, body)


def main():
    total = 0
    for stack, wght in STACKS.items():
        ttf, tt = instance(wght)
        cmap = tt.getBestCmap()
        A = math.floor(tt['hhea'].ascent * SIZE / tt['head'].unitsPerEm)
        font = ImageFont.truetype(io.BytesIO(ttf), SIZE * S)
        os.makedirs(os.path.join(OUT, stack), exist_ok=True)
        for start in RANGES:
            rng = f'{start}-{start + 255}'
            gl = [(cp, glyph(font, chr(cp), A)) for cp in range(start, start + 256) if cp in cmap]
            data = encode(stack, rng, gl)
            with open(os.path.join(OUT, stack, rng + '.pbf'), 'wb') as fh:
                fh.write(data)
            total += len(data)
            print(f'{stack} {rng}: {len(gl)} glyphs, {len(data) // 1024} KB')
    print(f'done, {total // 1024} KB in {OUT}')


if __name__ == '__main__':
    sys.exit(main())
