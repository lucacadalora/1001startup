#!/usr/bin/env python3
"""Fetch Sarbagita admin boundaries — Kota Denpasar, Kabupaten Badung,
Kabupaten Gianyar and Kabupaten Tabanan — with whatever kecamatan OSM has.

Writes public/data/bali.json in the SAME schema the map already reads
({bbox, kota:[{n,p}], kec:[{n,k,p}]}), so the one-map-of-Indonesia canvas
gains Bali by loading one more file. Kota names are normalized the way census
kota strings are written ("Kota Denpasar" -> "Denpasar"; "Kabupaten X" kept),
which is what makes the legend counts join.

Sarbagita (Perpres 45/2011) is the Denpasar metro: the four units above. The
island's other five regencies — Buleleng, Jembrana, Klungkung, Bangli,
Karangasem — are NOT here for the fetch-bandung reason: no census company sits
in them, and taking the whole island would stretch the map ~80 km north over
mountains. Add a regency the day a row lands in it (the relation ids are in
the probe note below).

Probed Aug 31 2026 (level-5 relations inside the Bali province area):
Denpasar 7789828 · Badung 14613953 · Gianyar 14613952 · Tabanan 14322005 ·
Buleleng 14322007 · Jembrana 14322006 · Klungkung 3250691 · Bangli 14322004 ·
Karangasem 14264457.
"""
import json, math, os, urllib.request, urllib.parse, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data", "bali.json")

# Pinned by OSM relation id, the way fetch-bandung.py pins the basin.
CORE = {
    7789828:  "Denpasar",             # Kota Denpasar
    14613953: "Kabupaten Badung",
    14613952: "Kabupaten Gianyar",
    14322005: "Kabupaten Tabanan",
}
# sanity envelope: reject any same-named relation outside south Bali
ENV = {"w": 114.75, "e": 115.75, "s": -9.05, "n": -8.05}
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


def run(q):
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(url, data=("data=" + urllib.parse.quote(q)).encode(),
                headers={"User-Agent": "pasar-vantis/1.0 (bali map; contact via vantis.sh)"})
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
print("fetching Sarbagita kota/kabupaten…", file=sys.stderr)
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
# Same dual-level sweep as fetch-bandung.py: OSM tags Indonesian kecamatan at
# level 6 in some regencies and level 7 in others, so both levels are swept and
# per kota the level-6 set wins where it exists, with the not-inside-a-level-6
# test keeping kelurahan out. Whatever Bali's mappers chose, this resolves it.
Q_KEC = """
[out:json][timeout:300][bbox:-8.95,114.80,-8.05,115.70];
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

# Level 6 first, then any level-7 relation not inside one of them — the same
# test that kept kelurahan off the Bandung map (see fetch-bandung.py).
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
