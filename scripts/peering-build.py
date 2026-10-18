#!/usr/bin/env python3
"""1001startup.id/peering — build data/peering.json, the map of Indonesia's data centres,
internet exchanges and router ports as PeeringDB lists them.

Sources (research lives outside this repo):
  ~/projects/peering-map-id/raw/api/*.json      the PeeringDB API pull for country=ID (fetch_pdb.py)
  ~/projects/peering-map-id/lanes/f*/result.json one research row per facility: the name people use
                                                 for the place, aliases, operator, checked pin, sources
  ~/projects/peering-map-id/lanes/x*/result.json one research row per exchange: operator, its sites
  ~/projects/peering-map-id/ref/cities.json     city centres, for exchanges and ports with no named site
  ~/projects/peering-map-id/logos/<domain>.png  operator marks harvested for this page
  data/datacenter.json                           the /data-center projects a facility can link to

Luca's rule (18 Oct 2026): "if we don't have the name/alias of the datacenter, just make it
grey". A facility is grey when research found no data-centre name for it (only a company name
or an office address); an exchange is grey when we know its city but not the data centre it
sits in; a router port is grey when PeeringDB doesn't say which data centre it is in.

Writes data/peering.json (views/peering1001.js reads it per request, mtime-cached; the map
script fetches it as /data/peering.json) and public/assets/peering/logo/*. No IP addresses
leave this script: the page shows counts of ports, never the addresses.

Usage: python3 scripts/peering-build.py
"""
import datetime
import json
import math
import pathlib
import re
import shutil
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path('/home/ubuntu/projects/peering-map-id')
API = SRC / 'raw' / 'api'
LANES = SRC / 'lanes'
LOGO_IN = [ROOT / 'public' / 'assets' / 'dc' / 'logo', SRC / 'logos']
LOGO_OUT = ROOT / 'public' / 'assets' / 'peering' / 'logo'
OUT = ROOT / 'data' / 'peering.json'
MAPOUT = ROOT / 'data' / 'peering-map.json'


def api(name):
    p = API / f'{name}.json'
    if not p.exists():
        p = API / f'{name}.all.json'
    d = json.loads(p.read_text())
    return d['data'] if isinstance(d, dict) else d


def lanes(prefix, key):
    out = {}
    for p in sorted(LANES.glob(prefix + '*/result.json')):
        try:
            rows = json.loads(p.read_text())
        except Exception as e:  # a lane still writing, or a broken file: skip it, say so
            print(f'skip {p}: {e}')
            continue
        if isinstance(rows, dict):
            rows = rows.get('rows') or rows.get('results') or list(rows.values())
        for r in rows:
            if isinstance(r, dict) and r.get(key) is not None:
                out[int(r[key])] = r
    return out


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def num(v):
    try:
        v = float(v)
        return v if v == v else None
    except (TypeError, ValueError):
        return None


def in_id(lat, lng):
    return lat is not None and lng is not None and -11.5 < lat < 6.5 and 94 < lng < 141.5


def clean(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()


def host(u):
    m = re.match(r'^(?:https?://)?(?:www\.)?([^/:?#]+)', clean(u).lower())
    return m.group(1) if m else ''


DCWORD = re.compile(r'\b(data ?cent(er|re)|datacent(er|re)|\bdc\b|idc|neucentrix|nap|pop|ix|cyber|tower|building|gedung|graha|menara|plaza|wisma|jk\d|cgk\d|edge\d|kampus|campus|technovillage|cbr|dps|sub|jkt\d?)', re.I)


def guess_named(f):
    """First pass before research lands: PeeringDB's own name reads as a site, not a company."""
    name, org = clean(f['name']).lower(), clean(f['org_name']).lower()
    if clean(f.get('aka')) and clean(f.get('aka')).lower() != org:
        return True
    if name == org or re.match(r'^(pt|cv)\.?\s', name) and not DCWORD.search(name):
        return False
    return bool(DCWORD.search(name))


def short(name):
    """A map label: "Matrix Data Center JK1 (MDC JK1), Pantai Mutiara" -> "Matrix Data Center JK1"."""
    n = re.sub(r'\s*\([^)]*\)', '', clean(name)).split(',')[0].strip(' -–/')
    return n or clean(name)


def logo_for(dom, slug_hint=''):
    dom = host(dom)
    if not dom:
        return None
    LOGO_OUT.mkdir(parents=True, exist_ok=True)
    for d in LOGO_IN:
        for ext in ('png', 'svg', 'webp'):
            p = d / f'{dom}.{ext}'
            if p.exists():
                dst = LOGO_OUT / p.name
                if not dst.exists() or dst.stat().st_mtime < p.stat().st_mtime:
                    shutil.copy2(p, dst)
                return f'/assets/peering/logo/{p.name}'
    return None


def src_list(rows):
    out = []
    for s in rows or []:
        if not isinstance(s, dict):
            continue
        u = clean(s.get('u') or s.get('url'))
        if not re.match(r'^https?://', u):
            continue
        out.append({'u': u, 't': clean(s.get('t')) or host(u), 'q': clean(s.get('q') or s.get('quote'))[:300],
                    'what': clean(s.get('what'))[:160]})
    return out[:6]


def main():
    fac = [f for f in api('fac') if f.get('status') == 'ok']
    ix = [x for x in api('ix') if x.get('status') == 'ok']
    ixfac = {(r['ix_id'], r['fac_id']): r for r in api('ixfac_by_fac') + api('ixfac_by_ix') if r.get('status') == 'ok'}
    netfac = [r for r in api('netfac') if r.get('status') == 'ok']
    ports = [r for r in api('netixlan') if r.get('status') == 'ok']
    nets = {n['id']: n for n in api('net') + api('net_by_org') if n.get('status') == 'ok'}
    carrierfac = [r for r in api('carrierfac') if r.get('status') == 'ok']
    carriers = {c['id']: c for c in api('carrier')}
    fres = lanes('f', 'fac_id')
    xres = lanes('x', 'ix_id')
    cities = json.loads((SRC / 'ref' / 'cities.json').read_text()) if (SRC / 'ref' / 'cities.json').exists() else {}
    ours = {}
    try:
        D = json.loads((ROOT / 'data' / 'datacenter.json').read_text())
        ours = {p['id']: p for p in D.get('projects', [])}
    except Exception:
        pass
    pulled = datetime.datetime.fromtimestamp((API / 'fac.json').stat().st_mtime, datetime.timezone.utc).strftime('%Y-%m-%d')

    fac_ids = {f['id'] for f in fac}
    ix_ids = {x['id'] for x in ix}
    ixs_at = defaultdict(set)
    facs_of = defaultdict(set)
    for (i, fa) in ixfac:
        if i in ix_ids and fa in fac_ids:
            ixs_at[fa].add(i)
            facs_of[i].add(fa)
    nets_at = defaultdict(set)
    for r in netfac:
        if r['fac_id'] in fac_ids:
            nets_at[r['fac_id']].add(r['net_id'])
    car_at = defaultdict(set)
    for r in carrierfac:
        if r['fac_id'] in fac_ids and r['carrier_id'] in carriers:
            car_at[r['fac_id']].add(carriers[r['carrier_id']]['name'])

    def city_pt(name):
        k = clean(name).lower()
        for key in (k, k.split(',')[0].strip(), re.sub(r'^(kota|kabupaten)\s+', '', k)):
            if key in cities:
                return cities[key]
        return None

    # ── facilities ───────────────────────────────────────────────────
    F = []
    for f in fac:
        r = fres.get(f['id'], {})
        checked = bool(r)
        verdict = clean(r.get('verdict')).lower() if checked else ('named' if guess_named(f) else 'grey')
        grey = verdict != 'named'
        lat, lng = num(r.get('lat')), num(r.get('lng'))
        if not in_id(lat, lng):
            lat, lng = num(f.get('latitude')), num(f.get('longitude'))
        cq = clean(r.get('coord_quality')) or ('pdb-unverified' if in_id(lat, lng) else '')
        if not in_id(lat, lng):
            pt = city_pt(r.get('city') or f.get('city'))
            lat, lng, cq = (pt[0], pt[1], 'city') if pt else (None, None, 'none')
        pdb = clean(f['name'])
        name = clean(r.get('dc_name')) if not grey and clean(r.get('dc_name')) else pdb
        aka = []
        for a in (r.get('aliases') or []) + [f.get('aka'), f.get('name_long')]:
            a = clean(a)
            if a and a.lower() not in {name.lower(), pdb.lower()} and a.lower() not in {x.lower() for x in aka} and len(a) < 90:
                aka.append(a)
        our = clean(r.get('our_dc_id'))
        dom = r.get('operator_domain') or f.get('website')
        F.append({
            'id': f['id'], 'n': name, 'pdb': pdb, 'aka': aka[:5],
            'op': clean(r.get('operator')) or clean(f['org_name']), 'opl': clean(r.get('operator_legal')) or clean(f['org_name']),
            'grp': clean(r.get('group')), 'logo': logo_for(dom), 'dom': host(dom),
            'lat': round(lat, 6) if lat is not None else None, 'lng': round(lng, 6) if lng is not None else None,
            'cq': cq, 'moved': int(num(r.get('coord_moved_m')) or 0),
            'addr': clean(r.get('address')) or ', '.join(x for x in (clean(f.get('address1')), clean(f.get('address2'))) if x),
            'city': clean(r.get('city')) or clean(f.get('city')), 'prov': clean(r.get('province')) or clean(f.get('state')),
            'bld': clean(r.get('building')), 'kind': clean(r.get('kind')) or 'unknown',
            'status': clean(r.get('status')) or 'unknown', 'grey': grey, 'checked': checked,
            'note': clean(r.get('note'))[:400], 'conf': clean(r.get('confidence')),
            'our': our if our in ours else '', 'our_n': ours[our]['name'] if our in ours else '',
            'src': src_list(r.get('sources')), 'same': [int(x) for x in (r.get('same_building_as') or []) if str(x).isdigit()],
            'nets': len(nets_at[f['id']]), 'ixs': sorted(ixs_at[f['id']]), 'car': sorted(car_at[f['id']]),
            'upd': clean(f.get('updated'))[:10], 'web': clean(f.get('website')),
        })
    byid = {f['id']: f for f in F}

    # ── places: facilities in one building share one point ────────────
    parent = {f['id']: f['id'] for f in F}

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    def join(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[max(ra, rb)] = min(ra, rb)

    located = [f for f in F if f['lat'] is not None and f['cq'] != 'city']
    for i, a in enumerate(located):
        for b in located[i + 1:]:
            if km((a['lat'], a['lng']), (b['lat'], b['lng'])) < 0.06:
                join(a['id'], b['id'])
    # the same named building within 400 m is one place, whatever the pins say
    def bkey(b):
        b = re.sub(r'\b(lantai|floor|lt|level|unit|suite)\.?\s*[\w-]+', ' ', clean(b).lower().split(',')[0])
        b = re.sub(r'\b(gedung|gd|building|bldg|the|data ?cent(er|re)|dc)\b', ' ', b)
        return re.sub(r'[^a-z0-9]+', ' ', b).strip()
    keyed = defaultdict(list)
    for f in located:
        k = bkey(f['bld'])
        if len(k) >= 4 and not f['grey']:
            keyed[k].append(f)
    for k, fs in keyed.items():
        for a in fs[1:]:
            if km((a['lat'], a['lng']), (fs[0]['lat'], fs[0]['lng'])) < 0.4:
                join(a['id'], fs[0]['id'])
    for f in F:
        for o in f['same']:
            if o in byid and byid[o]['lat'] is not None and f['lat'] is not None and km((f['lat'], f['lng']), (byid[o]['lat'], byid[o]['lng'])) < 0.4:
                join(f['id'], o)
    groups = defaultdict(list)
    for f in F:
        if f['lat'] is not None:
            groups[find(f['id'])].append(f)
    P = []
    for k, members in groups.items():
        members.sort(key=lambda f: (f['grey'], -f['nets'], f['id']))
        lead = members[0]
        lat = sum(f['lat'] for f in members) / len(members)
        lng = sum(f['lng'] for f in members) / len(members)
        def bname(b):  # "Gedung Cyber 1 (Cyber Building), 2nd floor, Jl. ..." -> "Gedung Cyber 1"
            b = re.sub(r'\s*\([^)]*\)', '', clean(b)).split(',')[0]
            b = re.sub(r'\s*[-–;:]?\s*\b(lantai|floor|lt|level)\b.*$', '', b, flags=re.I)
            return clean(b)
        named = [f for f in members if not f['grey']]
        blds = Counter(bname(f['bld']) for f in named if bname(f['bld']))
        bld = blds.most_common(1)[0][0] if blds else ''
        ops = {f['op'] for f in named}
        if len(members) == 1:
            label = short(lead['n'])
        elif len(ops) == 1 and len(named) > 1:
            label = named[0]['op']          # one operator's campus: DCI's Cibitung halls
        else:
            label = bld or short(lead['n'])  # a shared building: Gedung Cyber 1
        pid = f'p{k}'
        for f in members:
            f['place'] = pid
        P.append({
            'id': pid, 'lat': round(lat, 6), 'lng': round(lng, 6), 'n': label, 'bld': bld,
            'facs': [f['id'] for f in members], 'named': len(named), 'grey': not named,
            'logo': (named[0]['logo'] if named else None), 'mono': (named[0]['op'] if named else ''),
            'mixed': len(ops) > 1,
            'nets': len(set().union(*[nets_at[f['id']] for f in members])),
            'ixs': sorted(set().union(*[set(f['ixs']) for f in members])),
            'city': lead['city'], 'cq': min((f['cq'] for f in members), key=lambda q: ['building', 'street', 'pdb-unverified', 'city', 'none'].index(q) if q in ['building', 'street', 'pdb-unverified', 'city', 'none'] else 9),
        })
    for f in F:
        f.pop('same', None)
        if 'place' not in f:
            f['place'] = ''

    # ── exchanges ────────────────────────────────────────────────────
    ports_on = Counter(p['ix_id'] for p in ports)
    nets_on = defaultdict(set)
    for p in ports:
        nets_on[p['ix_id']].add(p['net_id'])
    X = []
    for x in ix:
        r = xres.get(x['id'], {})
        sites = set(facs_of[x['id']])
        for s in r.get('facilities') or []:
            try:
                fid = int(s.get('fac_id'))
            except (TypeError, ValueError, AttributeError):
                continue
            if fid in byid:
                sites.add(fid)
                if x['id'] not in byid[fid]['ixs']:
                    byid[fid]['ixs'].append(x['id'])
        sites = sorted(sites)
        named_sites = [s for s in sites if byid[s]['lat'] is not None]
        grey = not named_sites
        where = r.get('where_if_no_facility') or {}
        lat = lng = None
        if grey:
            lat, lng = num(where.get('lat')), num(where.get('lng'))
            if not in_id(lat, lng):
                pt = city_pt(where.get('city') or x.get('city'))
                lat, lng = (pt[0], pt[1]) if pt else (None, None)
        dom = r.get('operator_domain') or x.get('website')
        X.append({
            'id': x['id'], 'n': clean(r.get('ix_name')) or clean(x['name']), 'pdb': clean(x['name']),
            'aka': [a for a in dict.fromkeys(clean(a) for a in (r.get('aliases') or []) + [x.get('aka'), x.get('name_long')]) if a and a.lower() not in {clean(x['name']).lower(), clean(r.get('ix_name')).lower()}][:4],
            'op': clean(r.get('operator')), 'opl': clean(r.get('operator_legal')),
            'logo': logo_for(dom), 'dom': host(dom), 'web': clean(x.get('website')),
            'kind': clean(r.get('kind')), 'status': clean(r.get('status')) or 'unknown',
            'sites': sites, 'grey': grey, 'lat': lat, 'lng': lng, 'city': clean(x.get('city')),
            'nets': len(nets_on[x['id']]), 'ports': ports_on[x['id']],
            'note': clean(r.get('note'))[:400], 'src': src_list(r.get('sources')), 'checked': bool(r),
            'upd': clean(x.get('updated'))[:10],
        })
    xbyid = {x['id']: x for x in X}
    for f in F:
        f['ixs'] = sorted(set(f['ixs']))
    for p in P:
        p['ixs'] = sorted(set().union(*[set(byid[i]['ixs']) for i in p['facs']]))

    # ── router ports: where each one is, as far as PeeringDB says ─────
    # site = the network's own side if PeeringDB has it, else the exchange's side of the port,
    # else the exchange's only site; otherwise grey at the exchange's city.
    at_place = Counter()
    how = Counter()
    grey_city = defaultdict(lambda: {'ports': 0, 'ixs': set()})
    for p in ports:
        x = xbyid.get(p['ix_id'])
        if not x:
            continue
        site = None
        for k, tag in (('net_side_id', 'net'), ('ix_side_id', 'ix')):
            if p.get(k) in byid and byid[p[k]]['place']:
                site, h = p[k], tag
                break
        if site is None and len(x['sites']) == 1 and byid[x['sites'][0]]['place']:
            site, h = x['sites'][0], 'one'
        if site is not None and byid[site]['grey']:
            site = None  # a site we can't name stays grey, like the facility itself
        if site is None:
            key = clean(x['city']).split(',')[0].split(' - ')[0].split(' & ')[0] or 'Indonesia'
            grey_city[key]['ports'] += 1
            grey_city[key]['ixs'].add(x['id'])
            how['grey'] += 1
            continue
        at_place[byid[site]['place']] += 1
        how[h] += 1
    for pl in P:
        pl['ports'] = at_place.get(pl['id'], 0)
    G = []
    for cname, g in sorted(grey_city.items(), key=lambda kv: -kv[1]['ports']):
        pt = city_pt(cname)
        G.append({'city': cname, 'lat': pt[0] if pt else None, 'lng': pt[1] if pt else None, 'ports': g['ports'], 'ixs': sorted(g['ixs'])})

    # ── exchange links: the network layer's lines ────────────────────
    # An exchange with switches in several named data centres links them. Each one is
    # drawn as spokes from its busiest named site to its other named sites (we know which
    # buildings an exchange joins, not where its cables run). Pairs shared by several
    # exchanges are one line, weighted by how many. Grey sites get no line.
    pl_nets = {pl['id']: pl['nets'] for pl in P}
    pairs = defaultdict(set)
    for x in X:
        sites = sorted({byid[s]['place'] for s in x['sites'] if byid[s]['place'] and not byid[s]['grey']},
                       key=lambda pid: (-pl_nets.get(pid, 0), pid))
        if len(sites) < 2:
            continue
        hub = sites[0]
        for other in sites[1:]:
            pairs[tuple(sorted((hub, other)))].add(x['id'])
    L = [{'a': a, 'b': b, 'ixs': sorted(ixs), 'w': len(ixs)} for (a, b), ixs in sorted(pairs.items(), key=lambda kv: -len(kv[1]))]

    # ── networks (names and types only) ──────────────────────────────
    ids = set().union(*nets_at.values()) | {p['net_id'] for p in ports}
    fac_n = Counter(r['net_id'] for r in netfac if r['fac_id'] in fac_ids)
    port_n = Counter(p['net_id'] for p in ports)
    N = {}
    for i in sorted(ids):
        n = nets.get(i)
        if not n:
            continue
        N[i] = [n['asn'], clean(n['name']), clean(n.get('info_type')) or '', fac_n.get(i, 0), port_n.get(i, 0)]
    netfac_out = {f['id']: sorted(nets_at[f['id']], key=lambda i: (-(fac_n.get(i, 0) + port_n.get(i, 0)), i)) for f in F if nets_at[f['id']]}

    named_f = sum(1 for f in F if not f['grey'])
    T = {
        'fac': len(F), 'fac_named': named_f, 'fac_grey': len(F) - named_f,
        'fac_checked': sum(1 for f in F if f['checked']), 'fac_moved': sum(1 for f in F if f['moved'] >= 1000),
        'places': len(P), 'ix': len(X), 'ix_named': sum(1 for x in X if not x['grey']), 'ix_grey': sum(1 for x in X if x['grey']),
        'nets': len(N), 'nets_fac': len({i for s in nets_at.values() for i in s}), 'nets_ix': len({p['net_id'] for p in ports}),
        'presences': sum(len(s) for s in nets_at.values()), 'ports': sum(how.values()),
        'ports_named': sum(v for k, v in how.items() if k != 'grey'), 'ports_grey': how['grey'],
        'ports_how': dict(how), 'no_pin': sum(1 for f in F if f['lat'] is None),
        'links': len(L), 'link_ix': len({i for l in L for i in l['ixs']}),
    }
    out = {
        'asof': pulled, 'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'totals': T, 'places': P, 'facs': F, 'ixs': X, 'grey_ports': G, 'nets': N, 'netfac': netfac_out, 'links': L,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    # what the map script needs, without the sources and notes the page itself prints
    keep = ('id', 'n', 'pdb', 'aka', 'op', 'logo', 'lat', 'lng', 'city', 'prov', 'grey', 'status', 'our', 'nets', 'ixs', 'place')
    slim = dict(out, facs=[{k: f[k] for k in keep} for f in F],
                ixs=[{k: x[k] for k in ('id', 'n', 'pdb', 'op', 'logo', 'sites', 'grey', 'lat', 'lng', 'city', 'nets', 'ports')} for x in X])
    MAPOUT.write_text(json.dumps(slim, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps(T, indent=1))
    print(f'wrote {OUT} ({OUT.stat().st_size // 1024} KB) and {MAPOUT.name} ({MAPOUT.stat().st_size // 1024} KB), {len(fres)} facility rows and {len(xres)} exchange rows from research')


if __name__ == '__main__':
    main()
