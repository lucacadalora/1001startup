#!/usr/bin/env python3
"""Re-pin new census rows by building or street (Photon), or copy the pin of an
existing census row in the same building. Prints proposals; --write applies.
  python3 repin.py <plan.json> [--write]
plan.json: {"<id>": {"same": ["Treasury Tower"], "q": ["Treasury Tower, Jakarta", ...]}}
"""
import json, sys, time, math, urllib.parse, urllib.request, os, tempfile
RAW = os.path.expanduser('~/projects/pasar-vantis/data/census-raw.json')
UA = {'User-Agent': 'census-geocode/1.0 (1001startup.id)'}
plan = json.load(open(sys.argv[1]))
write = '--write' in sys.argv
raw = json.load(open(RAW))
by = {c['id']: c for c in raw['companies']}
def km(a, b, c, d):
    return math.hypot((a - c) * 111, (b - d) * 111 * math.cos(math.radians(a)))
out = {}
for cid, p in plan.items():
    c = by[cid]
    lat0, lon0 = c.get('lat'), c.get('lon')
    got = None
    for s in p.get('same', []):
        for o in raw['companies']:
            if o['id'] != cid and o['id'] not in plan and s.lower() in (o.get('hq_address') or '').lower() and o.get('lat') and o.get('geocode_kind') in ('building', 'road'):
                got = (o['lat'], o['lon'], f"same building as the {o['id']} row ({s})", 'building')
                break
        if got:
            break
    if not got:
        for q in p.get('q', []):
            try:
                fc = json.load(urllib.request.urlopen(urllib.request.Request(
                    'https://photon.komoot.io/api/?' + urllib.parse.urlencode({'q': q, 'limit': 5}), headers=UA), timeout=25))
            except Exception as ex:
                print('  photon failed', q, ex); continue
            time.sleep(0.6)
            for f in fc.get('features', []):
                lon, lat = f['geometry']['coordinates'][:2]
                pr = f.get('properties') or {}
                if lat0 and km(lat, lon, lat0, lon0) > p.get('max_km', 12):
                    continue
                k = pr.get('osm_key', '')
                kind = 'road' if k == 'highway' else ('building' if k in ('building', 'office', 'amenity', 'shop', 'tourism', 'leisure', 'man_made') else 'area')
                if p.get('want') == 'road' and kind != 'road':
                    continue
                if p.get('want') == 'building' and kind != 'building':
                    continue
                got = (lat, lon, f"photon:{q} ({pr.get('name')}, {pr.get('osm_key')}={pr.get('osm_value')})", kind)
                break
            if got:
                break
    print(f"{cid:14} {'->' if got else '!!'} {got if got else 'no hit; keep ' + str(c.get('geocode_kind'))}")
    if got:
        out[cid] = got
if write:
    raw = json.load(open(RAW))
    for c in raw['companies']:
        if c['id'] in out:
            lat, lon, src, kind = out[c['id']]
            c['lat'], c['lon'], c['geocode_src'], c['geocode_kind'] = round(lat, 7), round(lon, 7), src, kind
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)
    print('written', len(out))
