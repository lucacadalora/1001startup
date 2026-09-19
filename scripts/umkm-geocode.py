#!/usr/bin/env python3
"""1001umkm.id — geocode every exporter to its city (or province) point.

The exporter census records city + province as text; the map needs
coordinates. City-level is the honest resolution here — the source rows carry
no street addresses — so a pin means "this exporter is in this city", and the
profile says exactly that.

Geocoder: photon.komoot.io (Komoot's public Photon instance — Nominatim
429-bans this VM's IP, the census map learned that; Photon has no key and
tolerates polite serial use). One lookup per UNIQUE (city, province) pair
(~360, not 869), throttled, results validated to Indonesia's bbox and
countrycode ID.

Writes ONLY the single-writer side file data/umkm-geo.json:
    {generated, places: {"<city>|<province>": {lat, lon, kind, matched}},
     unmatched: [...keys photon could not place...]}
scripts/build-umkm.js merges lat/lon/geo_kind onto companies. Idempotent:
already-resolved keys are kept (delete the file to redo).
"""
import json, re, time, urllib.parse, urllib.request, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
RAW = ROOT / 'data' / 'umkm-raw.json'
OUT = ROOT / 'data' / 'umkm-geo.json'
UA = {'User-Agent': 'umkm-census-geocoder/1.0 (1001umkm.id; city-level pins)'}
BBOX = (94.0, -12.0, 142.0, 7.5)   # lon-w, lat-s, lon-e, lat-n

def photon(q):
    url = 'https://photon.komoot.io/api?' + urllib.parse.urlencode({'q': q, 'limit': 5, 'lang': 'en'})
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.load(r)['features']

def ok(f):
    p = f.get('properties', {})
    if p.get('countrycode') != 'ID':
        return False
    lon, lat = f['geometry']['coordinates'][:2]
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]

def pick(feats, want_place=True):
    """Prefer settlement-type hits; fall back to any Indonesian hit."""
    ranked = []
    for f in feats:
        if not ok(f):
            continue
        p = f['properties']
        kind = (p.get('osm_value') or '') + ' ' + (p.get('type') or '')
        score = 2 if re.search(r'city|town|village|suburb|municipality|county|district', kind) else \
                1 if re.search(r'state|region', kind) else 0
        ranked.append((score, f))
    if not ranked:
        return None
    ranked.sort(key=lambda t: -t[0])
    return ranked[0][1]

def main():
    raw = json.loads(RAW.read_text())
    try:
        doc = json.loads(OUT.read_text())
    except Exception:
        doc = {'places': {}, 'unmatched': []}
    places = doc.setdefault('places', {})
    unmatched = set(doc.get('unmatched') or [])

    keys = {}
    for c in raw['companies']:
        if not (c.get('city') or c.get('province')):
            continue
        k = f"{c.get('city') or ''}|{c.get('province') or ''}"
        keys.setdefault(k, (c.get('city'), c.get('province')))

    todo = [k for k in keys if k not in places and k not in unmatched]
    print(f'{len(keys)} unique places, {len(todo)} to resolve')

    for i, k in enumerate(todo):
        city, prov = keys[k]
        tries = []
        if city:
            base = re.sub(r'\s*\(.*?\)\s*', ' ', city).strip()          # "Surakarta (Solo)" -> Surakarta
            paren = re.search(r'\((.*?)\)', city)
            base = re.sub(r'^(kab\.?|kabupaten|kota)\s+', '', base, flags=re.I).strip() or base
            if prov: tries.append((f'{base}, {prov}, Indonesia', 'city'))
            tries.append((f'{base}, Indonesia', 'city'))
            if paren:
                tries.append((f'{paren.group(1)}, Indonesia', 'city'))
        if prov:
            tries.append((f'{prov}, Indonesia', 'province'))
        got = None
        for q, kind in tries:
            try:
                f = pick(photon(q))
            except Exception:
                time.sleep(2)
                continue
            time.sleep(0.35)
            if f:
                lon, lat = f['geometry']['coordinates'][:2]
                got = {'lat': round(lat, 5), 'lon': round(lon, 5), 'kind': kind,
                       'matched': f['properties'].get('name') or q}
                break
        if got:
            places[k] = got
        else:
            unmatched.add(k)
        if (i + 1) % 25 == 0:
            print(f'  {i+1}/{len(todo)} ({len(unmatched)} unmatched so far)')
            doc['unmatched'] = sorted(unmatched)
            doc['generated'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
            OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=0))

    doc['unmatched'] = sorted(unmatched)
    doc['generated'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=0))
    n_city = sum(1 for v in places.values() if v['kind'] == 'city')
    print(f'done: {len(places)} placed ({n_city} city-level, {len(places)-n_city} province-level), {len(unmatched)} unmatched')

if __name__ == '__main__':
    main()
