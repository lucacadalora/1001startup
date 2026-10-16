#!/usr/bin/env python3
"""CNC + 3D Indonesia — import the company-web research into data/cnc-webs/.

One research pass per company group writes <slug>-network.json (entities +
links, every link with a source and an evidence label). This script checks
each file and writes data/cnc-webs/<slug>.json, which server.js reads per
request (mtime-cached), so adding a group needs no restart.

Checks: the center entity exists; links point at known entities (broken ones
are dropped and counted); source URLs are http(s) or blank; every person is
kept to a business role (the research briefs already require it).
It also writes `keys`: normalised names of the center and the units it owns
or runs, so the firm table and the map can link a firm to its web.

Usage: python3 scripts/cnc-webs-import.py
"""
import datetime
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'cnc-webs'
RESEARCH = pathlib.Path('/home/ubuntu/projects/java-cnc-research/company_webs')
DTECH = pathlib.Path('/home/ubuntu/projects/dtech-research')

# (slug, network file, bottom-line file or None, title fallback, order on the switcher)
SOURCES = [
    ('dtech', DTECH / 'dtech-network.json', DTECH / 'dtech-network-bottomline.txt', 'DTECH', 1),
    ('atmi', RESEARCH / 'atmi-network.json', None, 'ATMI Solo', 2),
    ('polman', RESEARCH / 'polman-network.json', None, 'Polman Bandung', 3),
    ('ypti', RESEARCH / 'ypti-network.json', None, 'YPTI', 4),
    ('quick', RESEARCH / 'quick-network.json', None, 'Quick', 5),
    ('astra-otoparts', RESEARCH / 'astra-otoparts-network.json', None, 'Astra Otoparts', 6),
    ('inka', RESEARCH / 'inka-network.json', None, 'INKA', 7),
]
OWN = {'brand_of', 'runs'}   # a firm links to a web only for the center and the units it runs or brands
# ...and for companies it founded or holds that carry the group's own name
# (PT ATMI Solo, PT Polman Didaktik), never an outside JV partner such as Kubota
BRAND = {'atmi': 'atmi', 'polman': 'polman', 'inka': 'inka', 'astra-otoparts': 'astra', 'quick': 'quick',
         'ypti': 'ypti', 'dtech': 'dtech'}
EXTRA_KEYS = {'polman': ['cnccontrollerindonesia']}
KINDS = {'company', 'brand', 'academy', 'person', 'state_firm', 'school', 'government'}
EVID = {'confirmed', 'company_claim', 'snippet', 'inferred'}
LEGAL = re.compile(r'\b(pt|cv|tbk|persero|ud|yayasan)\b\.?', re.I)


def nkey(s):
    return re.sub(r'[^a-z0-9]+', '', LEGAL.sub(' ', str(s or '').lower()))


def is_url(u):
    return isinstance(u, str) and re.match(r'^https?://\S+$', u.strip()) is not None


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    report = []
    for slug, src, blf, title, order in SOURCES:
        if not src.exists():
            report.append(f'{slug}: not researched yet')
            continue
        try:
            net = json.loads(src.read_text(encoding='utf-8'))
        except Exception as e:
            report.append(f'{slug}: bad JSON ({e})')
            continue
        center = net.get('center') or slug
        if slug != 'dtech' and center != slug:
            # a research file holding another group's web (seen 16 Oct: inka-network.json
            # overwritten with Polman's) must never replace a good import
            report.append(f'{slug}: file holds center "{center}", not "{slug}" — skipped, existing import kept')
            continue
        ents = []
        for e in net.get('entities') or []:
            if not isinstance(e, dict) or not e.get('id') or not e.get('name'):
                continue
            # research bookkeeping ("Center node = ...", internal ids) never reaches the page
            if e.get('what'):
                e['what'] = re.sub(r'\s*[^.]*\bcent(?:er|re) node\b[^.]*\.?', '', e['what'], flags=re.I).strip()
            e['kind'] = e.get('kind') if e.get('kind') in KINDS else 'company'
            e['sources'] = [u for u in (e.get('sources') or []) if is_url(u)]
            ents.append(e)
        ids = {e['id'] for e in ents}
        if center not in ids:
            report.append(f'{slug}: center "{center}" missing, skipped')
            continue
        links, broken = [], 0
        for l in net.get('links') or []:
            if not isinstance(l, dict) or l.get('from') not in ids or l.get('to') not in ids:
                broken += 1
                continue
            if not is_url(l.get('source_url')):
                l['source_url'] = None
            if l.get('evidence') not in EVID:
                l['evidence'] = 'inferred'
            links.append(l)
        own = {center}
        brand = BRAND.get(slug)
        for l in links:
            if center not in (l['from'], l['to']):
                continue
            other = l['to'] if l['from'] == center else l['from']
            k = next((e for e in ents if e['id'] == other), {})
            if k.get('kind') not in ('company', 'brand', 'academy'):
                continue
            named = brand and any(brand in re.split(r'[^a-z0-9]+', str(v or '').lower()) for v in (k.get('name'), k.get('legal_name')))
            if l['relation'] in OWN or (named and (l['relation'] == 'channel' or (l['relation'] in ('founded', 'invested_in') and l['from'] == center))):
                own.add(other)
        def variants(e):
            for v in (e.get('name'), e.get('legal_name')):
                if not v:
                    continue
                yield nkey(v)
                yield nkey(re.sub(r'\s*\(.*?\)', '', v))          # without the parenthetical
                # a bracketed alias only when it reads as a name (an acronym like YPTI, IMS), never a word like "operator"
                yield from (nkey(m) for m in re.findall(r'\(([^)]*)\)', v) if len(m) <= 12 and m.strip() == m.strip().upper())
        keys = sorted({k for e in ents if e['id'] in own for k in variants(e) if len(k) >= 4} | set(EXTRA_KEYS.get(slug, [])))
        bl = blf.read_text(encoding='utf-8').strip() if blf and blf.exists() else (net.get('bottom_line') or '')
        doc = {
            'slug': slug, 'order': order, 'title': net.get('title') or title, 'center': center,
            'bottom_line': bl, 'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
            'entities': ents, 'links': links, 'keys': keys,
            'counts': {'entities': len(ents), 'links': len(links),
                       'confirmed': sum(1 for l in links if l['evidence'] == 'confirmed')},
        }
        (OUT / f'{slug}.json').write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        report.append(f'{slug}: {len(ents)} entities, {len(links)} links ({broken} broken dropped), keys {keys[:4]}')
    print('\n'.join(report))


if __name__ == '__main__':
    main()
