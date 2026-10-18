#!/usr/bin/env python3
"""dc.1001startup.id/graph — build data/peering-graph.json, how Indonesia's networks connect.

PeeringDB's own model, as a reader put it to Luca on 18 Oct 2026: a data centre is a
Facility; inside a facility are Networks; each network has Public Peering (the exchanges it
has a port on) and Interconnection Facilities (the facilities it is in). Those two links are
what tie data-centre tenants and ISPs together. This file holds exactly those links:

  facility  <- netfac ->   network   <- netixlan ->  exchange
  facility  <-------------- ixfac -------------->  exchange   (the exchange's switch is there)

Sources:
  data/peering.json                              the peering map's build (scripts/peering-build.py):
                                                 checked names, grey flags, places, logos, exchange sites
  ~/projects/peering-map-id/raw/api/*.json      the PeeringDB API pull for country=ID (networks,
                                                 netfac, netixlan)

Writes data/peering-graph.json (gitignored like the map's data: PeeringDB's AUP limits passing
its data on in bulk). views/peeringgraph1001.js reads it per request with an mtime cache and the
page script fetches it as /data/peering-graph.json, so a rebuild needs no restart. No IP address
or port speed leaves this script: a network-to-exchange link is only "has a port there".

Usage: python3 scripts/peering-graph-build.py   (after scripts/peering-build.py)
"""
import datetime
import json
import pathlib
import re
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = pathlib.Path('/home/ubuntu/projects/peering-map-id/raw/api')
MAP = ROOT / 'data' / 'peering.json'
OUT = ROOT / 'data' / 'peering-graph.json'
REACH = ROOT / 'data' / 'peering-reach.json'
NAME_UNVERIFIED = {45700}

# PeeringDB's network types, in the words the page uses
TYPE = {
    'Cable/DSL/ISP': 'I', 'NSP': 'C', 'Content': 'T', 'Enterprise': 'E', 'Network Services': 'S',
    'Route Server': 'R', 'Educational/Research': 'U', 'Government': 'G', 'Non-Profit': 'N',
}
POLICY = {'Open': 'O', 'Selective': 'S', 'Restrictive': 'R', 'No': 'N'}


def api(name):
    p = API / f'{name}.json'
    if not p.exists():
        p = API / f'{name}.all.json'
    d = json.loads(p.read_text())
    return d['data'] if isinstance(d, dict) else d


def clean(s):
    return re.sub(r'\s+', ' ', str(s or '')).strip()


def net_name(name, asn):
    """'FiberStar AS136106' -> 'FiberStar': the page prints the AS number on its own line."""
    n = clean(name)
    pat = r'\s*(?:[-–(]\s*)?AS\s?%d\s*\)?\s*$' % asn
    out = re.sub(pat, '', n, flags=re.I).strip(' -–')
    return out or n


def short_fac(f):
    """The facility's checked name without its bracket or address tail:
    'APJII Data Center (Gedung Cyber 1)' -> 'APJII Data Center'."""
    n = f['pdb'] if f['grey'] else f['n']
    s = re.split(r'\s+\(|,\s', n, maxsplit=1)[0].strip()
    return s if len(s) >= 4 else n


def main():
    M = json.loads(MAP.read_text())
    places = {p['id']: p for p in M['places']}
    fac_ids = {f['id'] for f in M['facs']}
    ix_ids = {x['id'] for x in M['ixs']}

    nets = {n['id']: n for n in api('net') + api('net_by_org') if n.get('status') == 'ok'}
    nf = defaultdict(set)
    for r in api('netfac'):
        if r.get('status') == 'ok' and r['fac_id'] in fac_ids and r['net_id'] in nets:
            nf[r['net_id']].add(r['fac_id'])
    nx = defaultdict(set)
    for r in api('netixlan'):
        if r.get('status') == 'ok' and r['ix_id'] in ix_ids and r['net_id'] in nets:
            nx[r['net_id']].add(r['ix_id'])

    F = []
    for f in M['facs']:
        pl = places.get(f.get('place') or '', {})
        bld = clean(pl.get('n')) if pl and len(pl.get('facs') or []) > 1 else ''
        F.append({
            'id': f['id'], 'n': short_fac(f), 'full': f['pdb'] if f['grey'] else f['n'], 'pdb': f['pdb'],
            'bld': bld, 'bn': len(pl.get('facs') or []) if bld else 0, 'place': f.get('place') or '',
            'op': clean(f.get('op')), 'logo': f.get('logo') or '', 'grey': bool(f['grey']),
            'city': clean(f.get('city')), 'nets': f['nets'], 'ixs': sorted(set(f.get('ixs') or [])),
        })
    X = []
    for x in M['ixs']:
        X.append({
            'id': x['id'], 'n': x['pdb'], 'full': x['n'], 'op': clean(x.get('op')), 'logo': x.get('logo') or '',
            'grey': bool(x['grey']), 'city': clean(x.get('city')), 'nets': x['nets'],
            'sites': sorted(set(s for s in x.get('sites') or [] if s in fac_ids)),
        })
    # names the ISP reach work found wrong in PeeringDB (AS45700: PeeringDB says PT Starlink
    # Services Indonesia, the registry PT NAP Info Lintas Nusa): the page prints the AS number
    # with "name unverified" instead, the same as the map's reach panel
    unverified = set(NAME_UNVERIFIED)
    try:
        R = json.loads(REACH.read_text())
        unverified |= {i['asn'] for i in R.get('isps', []) if i.get('unverified')}
    except Exception:
        pass
    N = []
    for i in sorted(set(nf) | set(nx)):
        n = nets[i]
        row = [i, n['asn'], net_name(n['name'], n['asn']), TYPE.get(clean(n.get('info_type')), ''),
               POLICY.get(clean(n.get('policy_general')), ''), sorted(nf[i]), sorted(nx[i])]
        if n['asn'] in unverified:
            row.append(1)
        N.append(row)

    both = sum(1 for r in N if r[5] and r[6])
    T = {
        'fac': len(F), 'ix': len(X), 'nets': len(N),
        'netfac': sum(len(r[5]) for r in N), 'netix': sum(len(r[6]) for r in N),
        'ixfac': sum(len(x['sites']) for x in X),
        'nets_fac_only': sum(1 for r in N if r[5] and not r[6]),
        'nets_ix_only': sum(1 for r in N if r[6] and not r[5]), 'nets_both': both,
    }
    out = {
        'asof': M['asof'], 'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'totals': T, 'f': F, 'x': X, 'n': N,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(json.dumps(T, indent=1))
    print(f'wrote {OUT} ({OUT.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
