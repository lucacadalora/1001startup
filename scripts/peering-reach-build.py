#!/usr/bin/env python3
"""PREVIEW ONLY: data/peering-reach.json for the ISP reach panel on /peering's place card.

Source: ~/research/peering-bgp-id/reach.json, built by a side session (PeeringDB + RIPEstat +
bgp.he.net + APNIC Labs). Luca, 18 Oct 2026, relayed by that session: "add the ISP reach panel to
the preview (not live), with the caveats shown on the panel". The server only serves this file
when PEERING_REACH=1 (a test port), so the live site never shows it.

Per facility one string, one letter per ISP in `isps` order: h = own port in the building,
x = on an exchange with a switch in the building, o = one network away, f = no link visible.

Usage: python3 scripts/peering-reach-build.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = pathlib.Path('/home/ubuntu/research/peering-bgp-id/reach.json')
OUT = ROOT / 'data' / 'peering-reach.json'
CODE = {'here': 'h', 'ix': 'x', 'hop': 'o', 'far': 'f'}
UNVERIFIED = {45700}   # PeeringDB "PT Starlink Services Indonesia", registry "PT NAP Info Lintas Nusa"


def main():
    R = json.loads(SRC.read_text())
    isps = [{'asn': i['asn'], 'name': f"AS{i['asn']}" if i['asn'] in UNVERIFIED else i['name'],
             'unverified': i['asn'] in UNVERIFIED, 'pct': i['pct'], 'policy': i.get('policy') or '',
             'ixports': i.get('n_ix', 0), 'nripe': i.get('n_ripe'), 'nhe': i.get('n_he')} for i in R['isps']]
    order = [i['asn'] for i in R['isps']]
    facs = {}
    for fid, f in R['facs'].items():
        how = {r['asn']: r for r in f.get('reach', [])}
        facs[fid] = ''.join(CODE.get((how.get(a) or {}).get('how'), 'f') for a in order)
    out = {'asof': R.get('asof'), 'isps': isps, 'facs': facs}
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
    print(f'wrote {OUT} ({OUT.stat().st_size // 1024} KB): {len(isps)} ISPs, {len(facs)} facilities')


if __name__ == '__main__':
    main()
