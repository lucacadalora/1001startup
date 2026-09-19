#!/usr/bin/env python3
"""Build the national base layer — public/data/indonesia.json.

Luca, 30 Aug 2026: "i think we need to make map of indonesia, but for now the
map is only visible and zoomed to jakarta and bandung."

So the map stops being a city map with a switcher and becomes ONE map of the
country that happens to open framed on the two metros the census covers. This
script supplies the ground under that: Indonesia's islands, plus the
neighbouring land that would otherwise leave Borneo, Papua and Timor looking
bitten off.

SOURCE: Natural Earth 1:50m country polygons — public domain — taken from the
world-atlas TopoJSON build (cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json),
which is the same Natural Earth data quantised and delta-encoded. Decoded here
rather than at runtime so the browser never ships a TopoJSON reader.

Output shape mirrors the kota/kec files the map already reads — plain rings of
[lon, lat] — so the canvas engine projects it with the same isoOf():

    {source, land: [ring, …], near: [ring, …], bbox: {w,e,s,n}}

`land` is Indonesia. `near` is everyone else in frame, drawn a shade back.

    python3 scripts/fetch-indonesia.py
"""
import json, math, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'data', 'indonesia.json')
SRC = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'

# Indonesia, and the countries whose land shares an island or a strait with it.
# Without them Borneo stops at the Malaysian border and Timor is cut in half.
ID_NAME = 'Indonesia'
NEAR = {'Malaysia', 'Brunei', 'Papua New Guinea', 'East Timor', 'Timor-Leste',
        'Singapore', 'Philippines', 'Australia'}
# Everything east of Sumatra's west coast and west of the Solomons, between the
# Philippines and the top of Australia — the frame a reader of an Indonesian
# map expects. Australia's south coast and the whole of Luzon are dropped.
FRAME = {'w': 92.0, 'e': 146.0, 's': -13.5, 'n': 9.5}
# Rings smaller than this (square degrees) are dropped. Indonesia's character is
# its islands, so the floor is low — this only removes specks that would render
# as a single pixel of noise at any zoom the map reaches.
MIN_AREA = 0.0012
TOL = 0.008   # Douglas-Peucker, degrees (~0.9 km) — the source is already 1:50m


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'pasar-vantis/1.0 (1001startup.id map)'})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def decode_arcs(topo):
    """TopoJSON arcs are delta-encoded integers on a quantised grid."""
    sx, sy = topo['transform']['scale']
    tx, ty = topo['transform']['translate']
    out = []
    for arc in topo['arcs']:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx; y += dy
            pts.append((x * sx + tx, y * sy + ty))
        out.append(pts)
    return out


def ring_of(arcs, idx_list):
    """Stitch one ring out of arc indices; a negative index means reversed."""
    pts = []
    for i in idx_list:
        a = arcs[~i][::-1] if i < 0 else arcs[i]
        pts += a[1:] if pts else a
    return pts


def area(ring):
    return abs(sum(ring[i][0] * ring[i - 1][1] - ring[i - 1][0] * ring[i][1]
                   for i in range(len(ring)))) / 2


def dp(pts, tol):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        den = math.hypot(dx, dy)
        imax, dmax = -1, tol
        for i in range(a + 1, b):
            if den < 1e-9:
                d = math.hypot(pts[i][0] - ax, pts[i][1] - ay)
            else:
                d = abs(dx * (ay - pts[i][1]) - dy * (ax - pts[i][0])) / den
            if d > dmax:
                imax, dmax = i, d
        if imax > 0:
            keep[imax] = True; stack.append((a, imax)); stack.append((imax, b))
    return [p for p, k in zip(pts, keep) if k]


def in_frame(ring):
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return not (max(xs) < FRAME['w'] or min(xs) > FRAME['e']
                or max(ys) < FRAME['s'] or min(ys) > FRAME['n'])


def rings_for(geom, arcs):
    """Outer rings only — a background wash has no use for lake holes."""
    polys = geom['arcs'] if geom['type'] == 'MultiPolygon' else [geom['arcs']]
    out = []
    for poly in polys:
        r = ring_of(arcs, poly[0])
        if len(r) > 3 and area(r) >= MIN_AREA and in_frame(r):
            out.append([[round(x, 4), round(y, 4)] for x, y in dp(r, TOL)])
    return out


print('fetching Natural Earth 1:50m…', file=sys.stderr)
topo = fetch(SRC)
arcs = decode_arcs(topo)
land, near = [], []
for g in topo['objects']['countries']['geometries']:
    name = (g.get('properties') or {}).get('name', '')
    if name == ID_NAME:
        land += rings_for(g, arcs)
    elif name in NEAR:
        near += rings_for(g, arcs)

if not land:
    raise SystemExit('no Indonesia geometry found — refusing to write an empty base layer')

pts = [p for r in land for p in r]
bbox = {'w': min(p[0] for p in pts), 'e': max(p[0] for p in pts),
        's': min(p[1] for p in pts), 'n': max(p[1] for p in pts)}
out = {
    'source': 'Natural Earth 1:50m (public domain), via world-atlas countries-50m',
    'fetched': '2026-08-30',
    'land': land, 'near': near, 'bbox': bbox,
}
with open(OUT, 'w') as f:
    json.dump(out, f, separators=(',', ':'))
print(f'land rings: {len(land)} · neighbour rings: {len(near)} · bbox {bbox}')
print(f'bytes: {os.path.getsize(OUT):,} -> {OUT}')
