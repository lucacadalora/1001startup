#!/usr/bin/env python3
"""Fetch Greater-Jakarta admin boundaries: DKI (5 kota + kecamatan) PLUS the
Bodetabek ring — Kota/Kab Tangerang, Tangerang Selatan, Depok, Kota/Kab Bogor,
Kota/Kab Bekasi — each with its kecamatan. Writes the SAME public/data/jakarta.json
schema the map already reads ({bbox, kota:[{n,p}], kec:[{n,k,p}]}), so the client
needs only new tints. Kota names are normalized to match census kota strings
("Kota Tangerang" -> "Tangerang"; "Kabupaten X" kept). Run from repo root."""
import json, math, urllib.request, urllib.parse, sys, time

BODETABEK = ["Kota Tangerang", "Kota Tangerang Selatan", "Kabupaten Tangerang",
             "Kota Depok", "Kota Bogor", "Kabupaten Bogor",
             "Kota Bekasi", "Kabupaten Bekasi"]
# sanity envelope: reject any same-named relation outside Greater Jakarta
ENV = {"w": 106.2, "e": 107.5, "s": -7.0, "n": -5.8}
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

def run(q):
    for url in ENDPOINTS:
        try:
            req = urllib.request.Request(url, data=("data=" + urllib.parse.quote(q)).encode(),
                headers={"User-Agent": "pasar-vantis/1.0 (greater-jakarta map; contact via vantis.sh)"})
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
            if den < 1e-9:  # closed-ring degenerate baseline -> point distance
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

# ── 1) DKI (as before) ────────────────────────────────────────────────
Q_DKI = """
[out:json][timeout:180];
area["ISO3166-2"="ID-JK"]->.jkt;
(
  relation(area.jkt)["boundary"="administrative"]["admin_level"="5"];
  relation(area.jkt)["boundary"="administrative"]["admin_level"="6"];
);
out geom;
"""
# ── 2) Bodetabek kota/kabupaten by explicit relation id (OSM names are the
#      short forms: "Tangerang", "Kab Bogor" — regex-by-official-name misses) ──
BODE_RELS = [7641582, 7641583, 7641584, 14509733, 14525364, 14745927, 14762112, 14765575]
Q_BODE = f"""
[out:json][timeout:300];
relation(id:{",".join(str(i) for i in BODE_RELS)});
out geom;
"""

kota, kec = [], []
print("fetching DKI…", file=sys.stderr)
for el in run(Q_DKI)["elements"]:
    if el["type"] != "relation": continue
    t = el.get("tags", {})
    if "seribu" in t.get("name", "").lower(): continue
    name, rings = parse_rel(el)
    if not rings: continue
    rec = {"n": norm_kota(name), "p": rings}
    (kota if t.get("admin_level") == "5" else kec).append(rec)

print("fetching Bodetabek kota/kab…", file=sys.stderr)
bode = run(Q_BODE)
bode_ids = []
for el in bode["elements"]:
    if el["type"] != "relation": continue
    name, rings = parse_rel(el)
    if not rings: continue
    c = centroid(rings[0])
    if not (ENV["w"] < c[0] < ENV["e"] and ENV["s"] < c[1] < ENV["n"]):
        print("  rejected out-of-envelope:", name, c, file=sys.stderr); continue
    kota.append({"n": norm_kota(name), "p": rings})
    bode_ids.append(el["id"])
    print("  +", name, file=sys.stderr)

# ── 3) their kecamatan via area(pivot) per relation ──────────────────
subq = "\n".join(f'  relation(area:{3600000000+i})["boundary"="administrative"]["admin_level"="6"];' for i in bode_ids)
Q_KEC = f"[out:json][timeout:300];\n(\n{subq}\n);\nout geom;"
print("fetching Bodetabek kecamatan…", file=sys.stderr)
for el in run(Q_KEC)["elements"]:
    if el["type"] != "relation": continue
    name, rings = parse_rel(el)
    if not rings: continue
    kec.append({"n": name, "p": rings})

# tag each kecamatan with its kota via centroid test
for k in kec:
    if k.get("k"): continue
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
