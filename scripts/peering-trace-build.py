#!/usr/bin/env python3
"""dc.1001startup.id Trace view: build data/peering-trace.json from real traceroutes.

Luca, 18 Oct 2026: "i send messages in solo/surakarta, how it reach in singapore ... how many
route/ping it reach before going to singapore", then "build the first version of the Trace
view, Solo to Singapore with today's 3 measured routes, as a private preview".

Each route is one mtr test (ICMP, 5 packets per hop) run on Globalping, a free network of
volunteer test devices (api.globalping.io), to Vultr's Singapore test server
(sgp-ping.vultr.com). The raw results sit in ~/projects/peering-map-id/traces/<day>/ with a
README. This script adds what the numbers can't say by themselves: where each hop is and how we
know. A hop gets a place only on evidence:
  - the test device's own city (Globalping gives it),
  - a router name with a place in it (...solo.citra.net.id, ...sgw.equinix.com),
  - the address's registry record (RIPEstat whois: TELIN-NET-SG, EQUINIX-AP Singapore, SGIX),
  - delay: light in fibre covers about 200 km per millisecond, so a round trip of T ms can't
    reach further than ~100*T km. "Jakarta, likely" rests on delay alone and says so.
Otherwise the hop says "place not known". Router addresses are read but never written out:
the page shows names, networks and times, never IP addresses.

Writes data/peering-trace.json (only our measurements and notes, no PeeringDB rows; one count
is worked out from data/peering.json). views/peering1001.js reads it per request while
PEERING_TRACE=1 (a preview switch), so a rebuild needs no restart.

Usage: python3 -I scripts/peering-trace-build.py [traces_dir]
"""
import datetime
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TRACES = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path.home() / 'projects/peering-map-id/traces/20261018'
OUT = ROOT / 'data' / 'peering-trace.json'
FIBRE_KM_PER_MS = 204   # light in glass, c / 1.47

# Places the routes stop at. Start cities are where Globalping puts the test device;
# Jakarta and Singapore are city centres (Wikipedia), never a building we can't prove.
PLACES = {
    'solo': {'n': 'Solo', 'lat': -7.56, 'lng': 110.83},
    'yog': {'n': 'Yogyakarta', 'lat': -7.80, 'lng': 110.36},
    'slm': {'n': 'Sleman', 'lat': -7.72, 'lng': 110.36},
    'jkt': {'n': 'Jakarta', 'lat': -6.2088, 'lng': 106.8456, 'likely': True},
    'sg': {'n': 'Singapore', 'lat': 1.2833, 'lng': 103.8333},
}
FIBERSTAR, CITRANET = 17481, 4562   # PeeringDB network ids


def shared_buildings():
    """Buildings on the map where both FiberStar and Citranet list equipment (PeeringDB)."""
    D = json.loads((ROOT / 'data' / 'peering.json').read_text())
    fac = {f['id']: f for f in D['facs']}
    places = {}
    for fid, nets in D['netfac'].items():
        if FIBERSTAR in nets and CITRANET in nets:
            f = fac.get(int(fid))
            if f and f.get('place') and f.get('lat') is not None:
                places[f['place']] = f
    in_jkt = lambda f: -6.8 < f['lat'] < -5.9 and 106.35 < f['lng'] < 107.22
    pl = {p['id']: p for p in D['places']}
    jkt = sorted((p for p, f in places.items() if in_jkt(f)), key=lambda p: -pl[p]['nets'])
    return {'jkt': len(jkt), 'all': len(places), 'jkt_places': jkt, 'jkt_names': [pl[p]['n'] for p in jkt]}


def words(n):
    return ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] if n < 10 else str(n)


def listing(names):
    return names[0] if len(names) == 1 else ', '.join(names[:-1]) + ' and ' + names[-1]


def km(a, b):
    r = math.pi / 180
    h = math.sin((b['lat'] - a['lat']) * r / 2) ** 2 + math.cos(a['lat'] * r) * math.cos(b['lat'] * r) * math.sin((b['lng'] - a['lng']) * r / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


SB = shared_buildings()

# One entry per route: which raw file and probe, then one line per hop:
# (place key or None, where-label override or None, network shown, how we know)
ROUTES = [
    {
        'id': 'solo-citranet', 'file': 'solo_sg_mtr.json', 'probe': 0, 'from': 'solo',
        'story': 'Two hops inside Solo on Citranet, two in Jakarta on FiberStar, then across the sea to Singapore, where FiberStar hands the message to Vultr at Equinix’s exchange.',
        'isp': 'Citranet', 'line': 'Citranet (AS23951), the Solo internet company behind Citranet DC Surakarta and CitraIX Surakarta',
        'place_on_map': 'p12799',
        'hops': [
            ('solo', None, 'Citranet', 'The test device’s gateway, the first router on its line. Globalping puts the device in Surakarta.'),
            ('solo', None, 'Citranet', 'The router’s name ends in solo.citra.net.id.'),
            ('jkt', 'Jakarta, likely', 'FiberStar', f'10 ms there and back: too far for Semarang or Surabaya, about right for Jakarta. FiberStar carries Citranet’s traffic, and both have equipment in {words(SB["jkt"])} Greater Jakarta buildings on this map ({listing(SB["jkt_names"])}), so we can’t say which one.'),
            ('jkt', 'Jakarta, likely', 'FiberStar', 'Same delay as hop 3.'),
            ('sg', None, 'FiberStar', 'Same delay as hop 6, which is in Singapore. The 14 ms jump since hop 4 is the trip across the sea.'),
            ('sg', None, 'Equinix exchange', 'Its address belongs to Equinix’s internet exchange in Singapore (router name …sgw.equinix.com). FiberStar hands the message to Vultr here.'),
            ('sg', None, 'Vultr, inside', 'A private address inside Vultr’s own network.'),
            ('sg', None, 'Vultr, inside', 'Answered slowly. Busy routers reply to tests late; hop 9 answers in 24 ms, so the road itself is not slower.'),
            ('sg', None, 'Vultr', 'Vultr’s Singapore network.'),
            ('sg', None, 'Vultr test server', 'The destination: Vultr’s Singapore test server.'),
        ],
    },
    {
        'id': 'yogya-telkomsel', 'file': 'jogja_sg_mtr.json', 'probe': 0, 'from': 'yog',
        'story': 'Three hops inside the house, two in Yogyakarta on Telkom, then one jump to Telin’s Singapore network: the road through Jakarta never shows. Telkom hands the message to Vultr at the Singapore Internet Exchange.',
        'isp': 'Telkomsel', 'line': 'Telkomsel (AS23693), likely an IndiHome line: 3 ms to Telkom’s first router is fibre speed. Telkom’s own network carries it',
        'hops': [
            ('yog', 'In the house', 'In the house', 'Inside the test device itself.'),
            ('yog', 'In the house', 'In the house', 'A router in the house.'),
            ('yog', 'In the house', 'In the house', 'The home modem.'),
            ('yog', None, 'Telkom', '3 ms: Telkom’s local network, close by (a private address).'),
            ('yog', None, 'Telkom', 'Telkom’s first public router, still 3 ms away.'),
            ('sg', None, 'Telkom (Telin)', 'Its address is registered to Telin’s Singapore network. 20 ms in one jump: the road through Jakarta stays inside Telkom’s network and doesn’t show.'),
            ('sg', None, 'Telkom (Telin)', 'Same delay as hop 6.'),
            ('sg', None, 'SGIX exchange', 'Its address belongs to the Singapore Internet Exchange (SGIX). Telkom hands the message to Vultr here.'),
            ('sg', None, 'Vultr, inside', 'A private address inside Vultr’s own network.'),
            ('sg', None, 'Vultr, inside', 'A private address inside Vultr’s own network.'),
            ('sg', None, 'Vultr', 'Vultr’s Singapore network.'),
            ('sg', None, 'Vultr test server', 'The destination: Vultr’s Singapore test server.'),
        ],
    },
    {
        'id': 'sleman-xl', 'file': 'jogja_sg_mtr.json', 'probe': 1, 'from': 'slm',
        'story': 'One hop in the house, two on XL’s network where the data gives no place, then XL’s own port at Equinix’s exchange in Singapore. The fewest hops, but the slowest: the first jump alone takes 17 ms.',
        'isp': 'XL', 'line': 'XL (AS139994 for the line, AS24203 for its backbone), a home connection',
        'hops': [
            ('slm', 'In the house', 'In the house', 'The home router.'),
            (None, 'Place not known', 'XL', '17 ms on the first jump: XL’s access line plus distance. Nothing in the data says where this router is (a private address).'),
            (None, 'Place not known', 'XL', 'Same delay as hop 2.'),
            ('sg', None, 'Equinix exchange', 'XL’s own port at Equinix’s internet exchange in Singapore (router name 24203.sgw.equinix.com).'),
            ('sg', None, 'Equinix exchange', 'Vultr’s port at the same exchange, where XL hands the message over. It answered slowly.'),
            (None, 'No reply', '', 'This router didn’t answer the test. That’s common and harmless.'),
            (None, 'No reply', '', 'This router didn’t answer the test either.'),
            ('sg', None, 'Vultr', 'Vultr’s Singapore network.'),
            ('sg', None, 'Vultr test server', 'The destination: Vultr’s Singapore test server.'),
        ],
    },
]


def build_route(R):
    raw = json.loads((TRACES / R['file']).read_text())
    res = raw['results'][R['probe']]
    hops = res['result']['hops']
    if len(hops) != len(R['hops']):
        raise SystemExit(f"{R['id']}: {len(hops)} hops in the test, {len(R['hops'])} notes")
    mins = [((h.get('stats') or {}).get('min')) for h in hops]
    # when the message passes each hop: no later than any hop after it (a slow reply
    # from a busy router doesn't slow the road), in round-trip ms
    t, best = [None] * len(hops), None
    for i in range(len(hops) - 1, -1, -1):
        if mins[i] is not None:
            best = mins[i] if best is None else min(best, mins[i])
        t[i] = best
    out = []
    for i, (h, (at, where, net, how)) in enumerate(zip(hops, R['hops'])):
        s = h.get('stats') or {}
        silent = s.get('min') is None
        out.append({
            'n': i + 1, 'at': at, 'where': where or (PLACES[at]['n'] if at else 'Place not known'),
            'net': net, 'how': how,
            'ms': None if silent else round(s['min'], 1), 'avg': None if silent else round(s['avg'], 1),
            'loss': s.get('loss', 100), 't': round(t[i], 2) if t[i] is not None else None,
            'slow': (not silent) and t[i] is not None and s['min'] - t[i] > 5,
            'silent': silent,
            'name': (h.get('resolvedHostname') or '').split('.', 1)[-1] if h.get('resolvedHostname') and h.get('resolvedHostname') != '_gateway' else '',
        })
    # stops: consecutive hops at one known place
    stops = []
    for hp in out:
        if not hp['at']:
            continue
        if stops and stops[-1]['at'] == hp['at']:
            stops[-1]['hops'].append(hp['n'])
        else:
            stops.append({'at': hp['at'], 'hops': [hp['n']]})
    for i, st in enumerate(stops):
        hs = [out[n - 1] for n in st['hops']]
        rng = f"hop {st['hops'][0]}" if len(st['hops']) == 1 else f"hops {st['hops'][0]}–{st['hops'][-1]}"
        nets = [h['net'] for h in hs if h['net'] and h['net'] != 'In the house' and not h['net'].startswith('Vultr')]
        ex = next((n for n in nets if 'exchange' in n), '')
        what = f"via {ex}" if ex and i == len(stops) - 1 else (nets[0] if nets else 'in the house')
        st['sub'] = ('start · ' if i == 0 else '') + rng + ' · ' + what
    last = out[-1]
    start = PLACES[R['from']]
    first_sg = next(hp['n'] for hp in out if hp['at'] == 'sg')
    dist = km(start, PLACES['sg'])
    p = res['probe']
    return {
        'id': R['id'], 'isp': R['isp'], 'from': R['from'], 'line': R['line'], 'story': R['story'],
        'label': f"{R['isp']}, from {start['n']}",
        'probe': {'city': p.get('city'), 'network': p.get('network'), 'asn': p.get('asn')},
        'when': raw.get('createdAt', '')[:16] + 'Z', 'measurement': raw.get('id'),
        'hops': out, 'stops': stops,
        'before': first_sg - 1, 'in_house': sum(1 for hp in out if hp['where'] == 'In the house'),
        'fast_ms': last['ms'], 'avg_ms': last['avg'],
        'km': round(dist), 'floor_ms': round(2 * dist / FIBRE_KM_PER_MS, 1),
        'place_on_map': R.get('place_on_map', ''),
    }


def main():
    routes = [build_route(R) for R in ROUTES]
    doc = {
        'asof': '2026-10-18',
        'built': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'target': {'n': 'Vultr’s Singapore test server', 'host': 'sgp-ping.vultr.com'},
        'slow': 400,   # the animation runs 400 times slower than the real one-way trip
        'places': PLACES, 'shared_jkt': SB['jkt'], 'shared_jkt_places': SB['jkt_places'],
        'routes': routes,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')))
    for r in routes:
        print(f"{r['label']}: {len(r['hops'])} hops, Singapore from hop {r['before'] + 1}, fastest {r['fast_ms']} ms, "
              f"stops {[s['at'] for s in r['stops']]}, {r['km']} km straight (floor {r['floor_ms']} ms)")
    print(f"shared FiberStar+Citranet buildings: {SB['jkt']} in Greater Jakarta ({listing(SB['jkt_names'])}), {SB['all']} in all -> {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == '__main__':
    main()
