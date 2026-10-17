#!/usr/bin/env python3
"""1001startup.id/data-center — build data/datacenter.json and data/dc-webs/<slug>.json.

Sources (research lives outside this repo):
  ~/projects/indonesia-dc-power-map/build/data/merged.json   the 72-project power map (merge.py)
  ~/projects/indonesia-dc-power-map/build/out/art/*.webp      the eight cell illustrations
  ~/projects/indonesia-dc-power-map/icons/<domain>.png|svg    logo marks
  ~/projects/indonesia-dc-power-map/company_webs/<slug>-network.json (+ -bottomline.txt)

Writes data/datacenter.json (views/datacenter1001.js reads it per request, mtime-cached, so a
rebuild goes live with no restart), data/dc-webs/<slug>.json, public/assets/dc/*.webp and
public/assets/dc/logo/*. Research text is copied verbatim; the view escapes it.

Usage: python3 scripts/dc-build.py
"""
import datetime
import json
import pathlib
import re
import shutil
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAP = pathlib.Path('/home/ubuntu/projects/indonesia-dc-power-map')
MERGED = MAP / 'build' / 'data' / 'merged.json'
ART = MAP / 'build' / 'out' / 'art'
ICONS = MAP / 'icons'
WEBS_IN = MAP / 'company_webs'
OUT = ROOT / 'data' / 'datacenter.json'
WEBS_OUT = ROOT / 'data' / 'dc-webs'
ASSETS = ROOT / 'public' / 'assets' / 'dc'

# (slug, title, operator keys on the power map that belong to this group, order)
WEBS = [
    ('dci', 'DCI Indonesia', ['DCI'], 1),
    ('bdx', 'BDx Indonesia', ['BDx'], 2),
    ('neutradc', 'NeutraDC', ['NeutraDC', 'Telkom (neuCentrIX)'], 3),
    ('digital-edge', 'Digital Edge', ['Digital Edge'], 4),
    ('dayone', 'DayOne', ['DayOne'], 5),
    ('pdg', 'Princeton Digital Group', ['PDG'], 6),
    ('stt-gdc', 'STT GDC', ['STT GDC'], 7),
    ('sinar-mas', 'SM+ (Sinar Mas)', ['SM+ (Sinar Mas)'], 8),
]
KINDS = {'company', 'fund', 'campus', 'brand', 'person', 'state_firm', 'government', 'utility'}
EVID = {'confirmed', 'company_claim', 'snippet', 'inferred'}
LAYERS = [
    ('power', 'Power in', {'utility', 'IPP', 'power supply', 'generator', 'gas engine', 'fuel cell', 'BESS', 'solar', 'hydro', 'gas', 'solar EPC', 'inverter'}),
    ('gear', 'Power gear', {'UPS', 'switchgear', 'transformer', 'busway', 'DCIM', 'power and cooling systems'}),
    ('cool', 'Cooling', {'cooling', 'liquid cooling'}),
    ('build', 'Built by', {'EPC', 'general contractor', 'MEP design', 'architect', 'project manager', 'substation EPC', 'prefab module', 'foundation', 'structural design'}),
    ('compute', 'Compute and network', {'IT/compute', 'network'}),
    ('other', 'Other', set()),
]


def layer_of(cat):
    for k, _, cats in LAYERS:
        if cat in cats:
            return k
    return 'other'


def is_url(u):
    return isinstance(u, str) and re.match(r'^https?://\S+$', u.strip()) is not None


def host(u):
    try:
        h = urllib.parse.urlparse(u).netloc.lower()
        return h[4:] if h.startswith('www.') else h
    except Exception:
        return ''


_logo = {}


def logo(domain):
    """Copy a fetched mark into public/assets/dc/logo once; return its web path or None."""
    d = (domain or '').strip().lower()
    if not d:
        return None
    if d in _logo:
        return _logo[d]
    key = re.sub(r'[^a-z0-9.-]', '_', d)
    for ext in ('png', 'svg'):
        src = ICONS / f'{key}.{ext}'
        if src.exists():
            dst = ASSETS / 'logo' / f'{key}.{ext}'
            dst.parent.mkdir(parents=True, exist_ok=True)
            if not dst.exists() or dst.read_bytes() != src.read_bytes():
                shutil.copyfile(src, dst)
            _logo[d] = f'/assets/dc/logo/{key}.{ext}'
            return _logo[d]
    _logo[d] = None
    return None


def mw_text(p):
    op, pl = p.get('it_mw_operating'), p.get('it_mw_planned')
    basis = p.get('mw_basis') or 'unstated'
    unit = 'MW IT' if basis == 'IT' else ('MW facility' if basis == 'facility' else 'MW')
    f = lambda x: f'{x:,.0f}' if isinstance(x, (int, float)) else ''
    if op and pl and pl != op:
        return f'{f(op)} live, {f(pl)} {unit} planned'
    if op:
        return f'{f(op)} {unit} live'
    if pl:
        return f'{f(pl)} {unit} planned'
    return ''


FULL = []


def build_webs(op_to_slug):
    WEBS_OUT.mkdir(parents=True, exist_ok=True)
    out, report = [], []
    for slug, title, ops, order in WEBS:
        src = WEBS_IN / f'{slug}-network.json'
        if not src.exists():
            report.append(f'{slug}: no research file yet')
            continue
        try:
            d = json.loads(src.read_text())
        except Exception as ex:
            report.append(f'{slug}: bad JSON ({ex})')
            continue
        if d.get('slug') not in (None, slug):
            report.append(f'{slug}: file says slug={d.get("slug")!r}, refused')
            continue
        ents, seen = [], set()
        for e in d.get('entities', []):
            if not e.get('id') or e['id'] in seen:
                continue
            seen.add(e['id'])
            e = dict(e)
            e['kind'] = e.get('kind') if e.get('kind') in KINDS else 'company'
            e['sources'] = [u for u in (e.get('sources') or []) if is_url(u)][:6]
            ents.append(e)
        center = d.get('center')
        if center not in seen:
            report.append(f'{slug}: centre {center!r} missing, refused')
            continue
        links, dropped = [], 0
        for l in d.get('links', []):
            if l.get('from') not in seen or l.get('to') not in seen or l.get('from') == l.get('to'):
                dropped += 1
                continue
            l = dict(l)
            l['evidence'] = l.get('evidence') if l.get('evidence') in EVID else 'inferred'
            l['source_url'] = l.get('source_url') if is_url(l.get('source_url')) else ''
            links.append(l)
        bl = WEBS_IN / f'{slug}-bottomline.txt'
        w = {
            'slug': slug, 'title': title, 'order': order, 'center': center,
            'bottom_line': bl.read_text().strip() if bl.exists() else '',
            'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'checked_utc': d.get('checked_utc'),
            'entities': ents, 'links': links,
            'operators': ops,
            'counts': {'entities': len(ents), 'links': len(links), 'confirmed': sum(1 for l in links if l['evidence'] == 'confirmed'), 'dropped': dropped},
        }
        (WEBS_OUT / f'{slug}.json').write_text(json.dumps(w, ensure_ascii=False, indent=1))
        FULL.append(w)
        out.append({k: w[k] for k in ('slug', 'title', 'order', 'center', 'bottom_line', 'counts', 'operators')})
        report.append(f'{slug}: {len(ents)} entities, {len(links)} links ({dropped} dropped)')
    return out, report


LEGAL = re.compile(r"\b(pt|tbk|persero|ltd|limited|pte|inc|llc|lp|co|corp|corporation|group|holdings?|plc|sa|ag|nv|bv)\b\.?", re.I)


def nk(s):
    s = re.sub(r"\(.*?\)", " ", str(s or ""))
    return re.sub(r"[^a-z0-9]+", "", LEGAL.sub(" ", s.lower()))


ROLE_ORDER = ['power', 'land', 'builders', 'finance', 'owners', 'network', 'customers', 'peer', 'people', 'partners']
ROLE_TITLE = {'power': 'Power', 'land': 'Land and estates', 'builders': 'Built and equipped by', 'finance': 'Lenders',
              'owners': 'Owners and investors', 'network': 'Telcos and networks', 'customers': 'Tenants and clouds',
              'peer': 'Other data-centre groups', 'people': 'People', 'partners': 'Other partners'}


def role_of(rel, other_is_to, kind, detail):
    if kind == 'person' or rel in ('director_of', 'commissioner_of'):
        return 'people'
    if rel in ('supplies_power', 'renewable_deal') or kind == 'utility':
        return 'power'
    if rel == 'supplies' and re.search(r'\bland\b|\bplot\b|hectare', detail or '', re.I):
        return 'land'
    if rel in ('owns', 'invested_in', 'founded'):
        return 'owners' if not other_is_to else 'peer'
    if rel == 'lends_to':
        return 'finance'
    if rel in ('built', 'designed', 'supplies', 'certifies'):
        return 'builders'
    if rel == 'tenant_of':
        return 'customers'
    return 'partners'


EVRANK = {'confirmed': 0, 'company_claim': 1, 'snippet': 2, 'inferred': 3}
PEERS = r'digital edge|\bdge\b|digital gayana|ekagrata|indonet|\bdci\b|dci indonesia|bdx|neutradc|nxera|princeton|\bpdg\b|stt gdc|st telemedia|sm\+|dayone|digitalland|edge dc'


def connectors(webs_full):
    """Entities that turn up in two or more webs, merged by normalised name or legal name."""
    parent = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    occ = []  # (slug, entity, keys)
    for w in webs_full:
        for e in w['entities']:
            keys = [k for k in {nk(e.get('name')), nk(e.get('legal_name'))} if len(k) >= 3]
            if not keys:
                continue
            for k in keys[1:]:
                union(keys[0], k)
            occ.append((w, e, keys))
    groups = {}
    for w, e, keys in occ:
        groups.setdefault(find(keys[0]), []).append((w, e))
    out = []
    for g in groups.values():
        by_web = {}
        for w, e in g:
            by_web.setdefault(w['slug'], (w, e))
        if len(by_web) < 2:
            continue
        roles, cells, kinds, names = {}, [], {}, {}
        for slug, (w, e) in by_web.items():
            touching = [l for l in w['links'] if e['id'] in (l['from'], l['to'])]
            direct = [l for l in touching if w['center'] in (l['from'], l['to'])]
            if e['id'] == w['center']:
                rel_words, role = 'the group itself', 'peer'
            else:
                pick = direct or touching
                if pick:
                    l = sorted(pick, key=lambda x: EVRANK.get(x['evidence'], 9))[0]
                    other_is_to = l['from'] != e['id']
                    role = role_of(l['relation'], not other_is_to, e.get('kind'), l.get('detail'))
                    rel_words = l['relation'].replace('_', ' ') + ('' if direct else ' (via ' + next((x.get('name') for x in w['entities'] if x['id'] == (l['to'] if l['from'] == e['id'] else l['from'])), 'another firm') + ')')
                else:
                    role, rel_words = None, 'listed'
            if role:
                roles[role] = roles.get(role, 0) + 1
            kinds[e.get('kind')] = kinds.get(e.get('kind'), 0) + 1
            names[e.get('name')] = names.get(e.get('name'), 0) + 1
            cells.append({'slug': slug, 'id': e['id'], 'rel': rel_words, 'direct': bool(direct) or e['id'] == w['center']})
        kind = max(kinds, key=kinds.get)
        nm = max(names, key=names.get)
        role = max(roles, key=roles.get) if roles else 'partners'
        if kind == 'person':
            role = 'people'
        elif kind == 'utility' or re.search(r'^pln\b|listrindo|maxpower|medco power|bekasi power|jasa tirta', nm, re.I):
            role = 'power'
        elif re.search(r'puradelta|sinarmas land|sojitz|citramas|tamarin|deltamas|jababeka|kawasan|estate|kiic', nm, re.I):
            role = 'land'
        elif re.search(PEERS, nm, re.I) or any(c['rel'] == 'the group itself' for c in cells):
            role = 'peer'
        elif re.search(r'\bbank\b|\bbca\b|\bdbs\b|ocbc|uob|hsbc|mandiri|permata|smbc|standard chartered|mizuho|bnp|credit agricole|maybank|\bbni\b|\bbri\b|kb bank|mayapada|clifford', nm, re.I):
            role = 'finance'
        elif re.search(r'acset|total bangun|elsewedy|furutec|\bpp\b|adhi karya|wijaya karya|sumaraja|leighton|shimizu|accesstech|huawei digital|schneider|vertiv|abb\b|nortek|lg sinar', nm, re.I):
            role = 'builders'
        elif re.search(r'telkom|telin|indosat|lintasarta|moratel|\bxl\b|xlsmart|apjii|iforte|china mobile|smartfren|biznet', nm, re.I) and role != 'owners':
            role = 'network'
        elif re.search(r'amazon|\baws\b|alibaba|bytedance|byteplus|huawei cloud|microsoft|google|oracle|tencent|akamai|meta\b', nm, re.I):
            role = 'customers'
        elif kind == 'fund':
            role = 'owners'
        if re.search(r'^telin\b', nm, re.I):
            role = 'network'
        out.append({'name': max(names, key=names.get), 'kind': kind, 'role': role, 'webs': sorted(cells, key=lambda c: c['slug'])})
    out.sort(key=lambda c: (ROLE_ORDER.index(c['role']) if c['role'] in ROLE_ORDER else 99, -len(c['webs']), c['name'].lower()))
    return out


def main():
    M = json.loads(MERGED.read_text())
    ASSETS.mkdir(parents=True, exist_ok=True)
    for f in ART.glob('*.webp'):
        dst = ASSETS / f.name
        if not dst.exists() or dst.read_bytes() != f.read_bytes():
            shutil.copyfile(f, dst)
    op_to_slug = {op: slug for slug, _, ops, _ in WEBS for op in ops}
    webs, web_report = build_webs(op_to_slug)
    live_webs = {w['slug'] for w in webs}
    labels = M.get('host_labels', {})
    pdom = M.get('power_domains', {})
    projects = []
    for p in M['projects']:
        seen, plinks = set(), []
        for s in p.get('power_sources', []):
            u = s.get('url')
            if not is_url(u):
                continue
            lab = labels.get(host(u), host(u))
            if lab in seen:
                continue
            seen.add(lab)
            plinks.append({'u': u, 't': lab, 'q': s.get('quote') or ''})
        vendors = []
        for v in p.get('vendors', []):
            if not is_url(v.get('url')):
                continue
            what = re.sub(r'^upstream:\s*', '', v.get('what') or '', flags=re.I)
            vendors.append({
                'n': v.get('name'), 'logo': logo(v.get('domain')), 'cat': v.get('category'), 'layer': layer_of(v.get('category')),
                'what': (what[:1].upper() + what[1:]) if what else '', 'where': v.get('where') or '', 'date': v.get('date') or '',
                'conf': v.get('confidence') or 'reported', 'snip': bool(v.get('search_level')), 'up': bool(v.get('upstream')),
                'u': v['url'], 't': labels.get(host(v['url']), host(v['url'])), 'q': v.get('quote') or '',
            })
        op = p.get('operator_key') or p.get('operator')
        projects.append({
            'id': p['id'], 'name': p['name'], 'op': op, 'logo': logo(p.get('operator_domain')),
            'loc': p.get('location') or '', 'region': p.get('region_key') or 'other', 'status': p.get('status') or '',
            'mw': mw_text(p), 'size': p.get('it_mw_planned') or p.get('it_mw_operating') or 0,
            'counted_mw': 0 if p.get('tenant_of') else (p.get('it_mw_planned') or p.get('it_mw_operating') or 0),
            'cell': p['cell'], 'presumed': bool(p.get('presumed')), 'plan': bool(p.get('power_planned_only')),
            'tenant_of': p.get('tenant_of') or '', 'note': p.get('chip_note') or '',
            'power': p.get('power_detail') or '', 'why': p.get('cell_reason') or p.get('unplaced_reason') or '',
            'from': [{'n': n, 'logo': None if n.startswith('Own ') else logo(pdom.get(n)), 'own': n.startswith('Own ')} for n in p.get('power_from', [])],
            'plinks': plinks[:4], 'vendors': vendors,
            'web': op_to_slug.get(op) if op_to_slug.get(op) in live_webs else None,
        })
    unnamed = {}
    canon = M.get('unnamed_canon', {})
    for r in M.get('unnamed_refs', []):
        if not is_url(r.get('url')):
            continue
        n = canon.get(r.get('vendor'), r.get('vendor'))
        g = unnamed.setdefault(n, {'n': n, 'logo': None, 'refs': []})
        g['logo'] = g['logo'] or logo(r.get('domain'))
        g['refs'].append({'what': r.get('what') or '', 'where': r.get('where') or '', 'u': r['url'], 't': labels.get(host(r['url']), host(r['url'])), 'q': r.get('quote') or ''})
    data = {
        'asof': datetime.date.today().isoformat(),
        'cells': M['cells'], 'kpis': M.get('kpis', []), 'bottom_line': M.get('bottom_line', []),
        'rules': M.get('rules', []), 'method': M.get('method', []),
        'layers': [[k, t] for k, t, _ in LAYERS],
        'projects': projects,
        'unnamed': sorted(unnamed.values(), key=lambda g: g['n'].lower()),
        'webs': sorted(webs, key=lambda w: w['order']),
        'power_logos': {n: logo(d) for n, d in pdom.items()},
        'connectors': connectors(FULL),
        'role_titles': [[k, ROLE_TITLE[k]] for k in ROLE_ORDER],
    }
    tmp = OUT.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False))
    tmp.replace(OUT)
    cells = {}
    for p in projects:
        cells[p['cell']] = cells.get(p['cell'], 0) + 1
    print(f'wrote {OUT.relative_to(ROOT)}: {len(projects)} projects, cells {dict(sorted(cells.items()))}, '
          f'{sum(len(p["vendors"]) for p in projects)} vendor rows, {len(unnamed)} unnamed groups, {len(webs)} webs, {len(data["connectors"])} connectors')
    for r in web_report:
        print('  web', r)


if __name__ == '__main__':
    main()
