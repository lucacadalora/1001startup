#!/usr/bin/env python3
"""Fetch DKI Jakarta admin boundaries (kota level 5 + kecamatan level 6) from
Overpass, stitch outer rings, simplify, write public/data/jakarta.json.
Excludes Kepulauan Seribu (offshore islands). Run from repo root."""
import json, math, urllib.request, sys

Q = """
[out:json][timeout:180];
area["ISO3166-2"="ID-JK"]->.jkt;
(
  relation(area.jkt)["boundary"="administrative"]["admin_level"="5"];
  relation(area.jkt)["boundary"="administrative"]["admin_level"="6"];
);
out geom;
"""
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

def fetch():
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(url, data=("data=" + urllib.parse.quote(Q)).encode(),
                headers={"User-Agent": "pasar-vantis/1.0 (jakarta map; contact via vantis.sh)"})
            with urllib.request.urlopen(req, timeout=240) as r:
                return json.load(r)
        except Exception as e:
            print("endpoint failed", url, e, file=sys.stderr)
    raise SystemExit("all overpass endpoints failed")

def stitch(ways):
    """Join outer-way linestrings into closed rings by endpoint matching."""
    segs = [[(p["lon"], p["lat"]) for p in w] for w in ways if w]
    rings = []
    while segs:
        ring = segs.pop()
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == ring[-1]: ring += s[1:]; segs.pop(i); changed = True; break
                if s[-1] == ring[-1]: ring += list(reversed(s))[1:]; segs.pop(i); changed = True; break
                if s[-1] == ring[0]: ring = s[:-1] + ring; segs.pop(i); changed = True; break
                if s[0] == ring[0]: ring = list(reversed(s))[:-1] + ring; segs.pop(i); changed = True; break
        if len(ring) > 3: rings.append(ring)
    return rings

def area(ring):
    return abs(sum(ring[i][0]*ring[i-1][1] - ring[i-1][0]*ring[i][1] for i in range(len(ring)))) / 2

def dp(pts, tol):
    """Douglas-Peucker on lon/lat."""
    if len(pts) < 3: return pts
    keep = [False]*len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts)-1)]
    while stack:
        a, b = stack.pop()
        if b <= a+1: continue
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx-ax, by-ay
        den = math.hypot(dx, dy)
        imax, dmax = -1, tol
        for i in range(a+1, b):
            if den < 1e-9:  # closed ring: endpoints coincide, use point distance
                d = math.hypot(pts[i][0]-ax, pts[i][1]-ay)
            else:
                d = abs(dx*(ay-pts[i][1]) - dy*(ax-pts[i][0])) / den
            if d > dmax: imax, dmax = i, d
        if imax > 0:
            keep[imax] = True; stack.append((a, imax)); stack.append((imax, b))
    return [p for p, k in zip(pts, keep) if k]

def centroid(ring):
    return (sum(p[0] for p in ring)/len(ring), sum(p[1] for p in ring)/len(ring))

def inside(pt, ring):
    x, y = pt; n = len(ring); j = n-1; c = False
    for i in range(n):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/((yj-yi) or 1e-12)+xi: c = not c
        j = i
    return c

data = fetch()
kota, kec = [], []
for el in data["elements"]:
    if el["type"] != "relation": continue
    t = el.get("tags", {})
    name = t.get("name", "")
    if "seribu" in name.lower(): continue
    ways = [m.get("geometry") for m in el.get("members", []) if m.get("role") == "outer" and m.get("type") == "way"]
    rings = stitch(ways)
    if not rings: continue
    amax = max(area(r) for r in rings)
    rings = [dp(r, 0.0007) for r in rings if area(r) > amax*0.02]
    rings = [[[round(x, 5), round(y, 5)] for x, y in r] for r in rings]
    rec = {"n": name.replace("Kota Administrasi ", ""), "p": rings}
    lvl = t.get("admin_level")
    (kota if lvl == "5" else kec).append(rec)

# tag each kecamatan with its kota via centroid test
for k in kec:
    c = centroid(k["p"][0])
    for K in kota:
        if any(inside(c, r) for r in K["p"]):
            k["k"] = K["n"]; break

allpts = [p for K in kota for r in K["p"] for p in r]
bbox = {"w": min(p[0] for p in allpts), "e": max(p[0] for p in allpts),
        "s": min(p[1] for p in allpts), "n": max(p[1] for p in allpts)}
out = {"bbox": bbox, "kota": kota, "kec": kec}
with open("public/data/jakarta.json", "w") as f:
    json.dump(out, f, separators=(",", ":"))
print("kota:", [k["n"] for k in kota])
print("kec:", len(kec), "bbox:", bbox, "bytes:", len(json.dumps(out, separators=(',', ':'))))
