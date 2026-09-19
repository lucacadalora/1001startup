#!/usr/bin/env python3
"""Fetch Bandung-Raya admin boundaries — Kota Bandung, Kota Cimahi, Kabupaten
Bandung and Kabupaten Bandung Barat — with whatever kecamatan OSM has.

Writes public/data/bandung.json in the SAME schema the map already reads
({bbox, kota:[{n,p}], kec:[{n,k,p}]}), so /map can switch cities by swapping
one file. Kota names are normalized the way census kota strings are written
("Kota Bandung" -> "Bandung"; "Kabupaten X" kept), which is what makes the
legend counts join. Paths resolve from the script, so it runs from anywhere.

Perpres 45/2018 also draws Cekungan Bandung through five Sumedang kecamatan —
the Jatinangor campus belt. They are NOT here: OSM has no boundary for any of
them, and taking the whole regency instead would stretch the map ~55 km east
over farmland no census company sits on. Add it the day one does.

Kecamatan coverage is uneven and that is OSM, not a bug in this script: Kota
Bandung has all 30, Kabupaten Bandung has four, and Cimahi and Bandung Barat
have none at all — probed relation-by-relation, Aug 2026. The kota tints and
the census pins do not depend on them.
"""
import json, math, os, urllib.request, urllib.parse, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "bandung.json")

# Pinned by OSM relation id, the way fetch-jabodetabek.py pins Bodetabek: the
# level-5 names in West Java are the short forms ("Bandung Barat", "Sumedang"),
# so matching on the official name silently misses half the basin.
CORE = {
    13290062: "Bandung",                  # Kota Bandung
    14935961: "Cimahi",                   # Kota Cimahi
    14935959: "Kabupaten Bandung",
    14935960: "Kabupaten Bandung Barat",
}
# sanity envelope: reject any same-named relation outside the Bandung basin
ENV = {"w": 106.9, "e": 108.4, "s": -7.6, "n": -6.3}
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def run(q):
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(url, data=("data=" + urllib.parse.quote(q)).encode(),
                headers={"User-Agent": "pasar-vantis/1.0 (bandung map; contact via vantis.sh)"})
            with urllib.request.urlopen(req, timeout=300) as r:
                return json.load(r)
        except Exception as e:
            print("endpoint failed", url, e, file=sys.stderr)
            time.sleep(5)
    raise SystemExit("all overpass endpoints failed")


def stitch(ways):
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
            if den < 1e-9:
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


def norm_kota(name):
    n = name.replace("Kota Administrasi ", "")
    if n.startswith("Kota "): n = n[5:]
    if n.startswith("Kab "): n = "Kabupaten " + n[4:]
    return n


def parse_rel(el, tol=0.0007):
    t = el.get("tags", {})
    name = t.get("name", "")
    ways = [m.get("geometry") for m in el.get("members", []) if m.get("role") == "outer" and m.get("type") == "way"]
    rings = stitch(ways)
    if not rings: return None, None
    amax = max(area(r) for r in rings)
    rings = [dp(r, tol) for r in rings if area(r) > amax*0.02]
    rings = [[[round(x, 5), round(y, 5)] for x, y in r] for r in rings]
    return name, rings


# ── 1) the kota/kabupaten, pinned by relation id ─────────────────────
Q_KOTA = f"""
[out:json][timeout:300];
relation(id:{",".join(str(i) for i in CORE)});
out geom;
"""
print("fetching Bandung-basin kota/kabupaten…", file=sys.stderr)
kota = []
for el in run(Q_KOTA)["elements"]:
    if el["type"] != "relation": continue
    name, rings = parse_rel(el)
    if not rings: continue
    c = centroid(rings[0])
    if not (ENV["w"] < c[0] < ENV["e"] and ENV["s"] < c[1] < ENV["n"]):
        print("  rejected out-of-envelope:", name, c, file=sys.stderr); continue
    if el["id"] not in CORE: continue
    kota.append({"n": CORE[el["id"]], "p": rings})
    print("  +", name, "->", kota[-1]["n"], file=sys.stderr)

missing = [n for i, n in CORE.items() if n not in {k["n"] for k in kota}]
if missing:
    raise SystemExit("missing kota, refusing to write a half map: " + ", ".join(missing))

# ── 2) kecamatan: sweep the basin at BOTH admin levels ───────────────
# OSM tags Indonesian kecamatan inconsistently. Inside Kota Bandung they are
# admin_level=6 (Coblong, Cicendo…); inside Kabupaten Bandung, Bandung Barat,
# Cimahi and Sumedang the same tier sits at admin_level=7 (Soreang), and level
# 6 is empty there. Pivoting on the regency relations returned nothing for four
# of the five, so this sweeps both levels over a bbox and then, per kota, keeps
# level 6 where that kota has any and falls back to level 7 where it has none —
# which is what stops Kota Bandung's 151 kelurahan (also level 7) from flooding
# the map alongside its kecamatan.
Q_KEC = """
[out:json][timeout:300][bbox:-7.40,107.05,-6.60,108.05];
(
  relation["boundary"="administrative"]["admin_level"="6"];
  relation["boundary"="administrative"]["admin_level"="7"];
);
out geom;
"""
print("fetching kecamatan (levels 6 and 7)…", file=sys.stderr)
found = []
for el in run(Q_KEC)["elements"]:
    if el["type"] != "relation": continue
    name, rings = parse_rel(el)
    if not rings: continue
    found.append({"n": name, "p": rings, "lvl": el.get("tags", {}).get("admin_level")})
print("  relations in the sweep:", len(found), file=sys.stderr)

for k in found:
    c = centroid(k["p"][0])
    for K in kota:
        if any(inside(c, r) for r in K["p"]):
            k["k"] = K["n"]; break

# Level 6 first, then any level-7 relation that is NOT inside one of them.
# That single test separates the two meanings of level 7: a Kota Bandung
# kelurahan always sits inside a level-6 kecamatan and drops out, while
# Soreang — a Kabupaten Bandung kecamatan mapped at level 7 because the
# regency's mappers used a different scheme — sits inside none and stays.
kec = []
for K in kota:
    mine = [k for k in found if k.get("k") == K["n"]]
    six = [k for k in mine if k["lvl"] == "6"]
    seven = [k for k in mine if k["lvl"] == "7"
             and not any(inside(centroid(k["p"][0]), r) for s in six for r in s["p"])]
    take = six + seven
    print(f'  {K["n"]}: {len(six)} at level 6 + {len(seven)} at level 7', file=sys.stderr)
    kec += [{"n": k["n"], "k": k["k"], "p": k["p"]} for k in take]

allpts = [p for K in kota for r in K["p"] for p in r]
bbox = {"w": min(p[0] for p in allpts), "e": max(p[0] for p in allpts),
        "s": min(p[1] for p in allpts), "n": max(p[1] for p in allpts)}
out = {"bbox": bbox, "kota": kota, "kec": kec}
with open(OUT, "w") as f:
    json.dump(out, f, separators=(",", ":"))
print("kota:", [k["n"] for k in kota])
print("kec:", len(kec), "bbox:", bbox, "bytes:", len(json.dumps(out, separators=(',', ':'))))
