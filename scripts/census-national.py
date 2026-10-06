#!/usr/bin/env python3
"""NATIONWIDE — the census opens to all of Indonesia (28 Sep 2026), wave by wave.

Luca, 28 Sep 2026, after the ChatGPT-visibility measurement ("we need to make our
1001startup.id to be prominent sources of crunchbase in indonesia"), chose "All of
Indonesia" over "next big cities only" and "keep today's area". Until then the
geography was Greater Jakarta (29 Aug), the Bandung basin (30 Aug) and south
Bali (31 Aug), and "everywhere else in Indonesia is still outside".

THIS SCRIPT OWNS scope['rule'] from now on (census-bandung/-bali/-banks only write
it while `nationwide_added` is unset). The kota -> metro rule lives in
lib/metros1001.js; build-census.js derives `metro` and withholds the output
estimate outside the anchored metros (the anchors are BPS DKI Jakarta figures).

Input: one research record per wave, data/census-adds/<wave>.json — every row
with its sources and verify_note, plus the rejections that belong on /coverage,
closed-register entries, and census rows found closed. The research is done by
agents working to a written brief (inclusion tests, sourced-or-withdrawn, dated
LinkedIn headcounts read live through Exa); this script only validates and writes.

Idempotent UPSERT (census-bdd/-grivy mechanics): re-running restores exactly the
owned fields on each row and leaves logo / sprite / geocode alone once set;
register entries merge BY NAME.

    python3 scripts/census-national.py data/census-adds/national-w1.json [--dry-run]
    python3 scripts/census-icons.py            # logo tiles for rows that have none
    node scripts/build-census.js               # publishes (server reads by mtime)
    python3 scripts/og-company.py              # share cards (idempotent)

NEVER re-run scripts/census-funding-src.py over the whole census to fill the new
rows' funding link: it strips funding_src_all from every figure-less row (548 note
links on 125 rows). This script applies its scorer to the rows it writes, only.
"""
import importlib.util, json, os, re, sys, tempfile, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# CENSUS_RAW / CENSUS_CLOSED point a rehearsal at copies (build-census.js reads
# CENSUS_RAW too); --no-geocode skips the network calls in a rehearsal.
RAW = os.environ.get('CENSUS_RAW') or os.path.join(ROOT, 'data', 'census-raw.json')
CLOSED = os.environ.get('CENSUS_CLOSED') or os.path.join(ROOT, 'data', 'closed.json')
TODAY = '2026-09-28'
UA = {'User-Agent': 'census-geocode/1.0 (1001startup.id)'}

RULE = ("A company is counted when it was built or bought by tech or venture money rather than run "
        "as an incumbent's product line, when it is its own legal entity, and when a headcount can be "
        "sourced. All three have to hold. Geography: all of Indonesia since 28 Sep 2026. The census "
        "began with Greater Jakarta (29 Aug 2026), added the Bandung basin (30 Aug) and south Bali's "
        "Sarbagita metro (31 Aug), and now counts a company wherever in Indonesia its head office is. "
        "Coverage outside those three metros is still being built, city by city.")
RULE_ID = ("Sebuah perusahaan dihitung ketika ia dibangun atau dibeli oleh uang teknologi atau modal "
           "ventura — bukan dijalankan sebagai lini produk pemain lama — ketika ia entitas hukumnya "
           "sendiri, dan ketika jumlah pekerjanya bisa ditelusuri sumbernya. Ketiganya harus terpenuhi. "
           "Geografi: seluruh Indonesia sejak 28 Sep 2026. Sensus dimulai dari Jabodetabek (29 Agu 2026), "
           "lalu cekungan Bandung (30 Agu) dan metro Sarbagita di Bali selatan (31 Agu), dan kini menghitung "
           "perusahaan di mana pun kantor pusatnya di Indonesia. Cakupan di luar tiga metro itu masih "
           "dibangun, kota demi kota.")

# The row fields this script owns. Anything else on a row (logo, sprite, lat/lon,
# funding_src*, headcount refreshes) belongs to another writer and is left alone.
OWNED = ['name', 'id', 'legal_name', 'url', 'site_status', 'sector', 'sector_key', 'in_dki',
         'hq_address', 'kecamatan', 'kota', 'province', 'founded',
         'employees_est', 'employees_asof', 'employees_src', 'employees_kind', 'employees_note',
         'employees_li_band', 'funding_total_usd_m', 'funding_status', 'funding_note',
         'last_round', 'last_round_year', 'investors',
         'valuation_usd_m', 'valuation_kind', 'valuation_asof', 'valuation_note',
         'confidence', 'verify_note', 'sources', 'liveness_checked', 'added', 'source_batch',
         # cohort lenses: a row that was on a roster's "outside" list for geography only
         # carries its badge once counted (Super, YC W18 — outside Greater Jakarta until 28 Sep)
         'yc_batch', 'antler', 'antler_year', 'antler_note',
         # field-network rows carry workforce_kind at add time (Aug 31 rule): it drives
         # the "frontline" chip and the national frontline anchor where output is priced
         'workforce_kind', 'workforce_note']
FSTATUS = {'disclosed', 'partial', 'undisclosed', 'none_on_record', 'parent_funded', 'grant_only', 'debt_only', 'listed'}
FATES = {'closed', 'acquired-then-closed'}   # the only two /closed knows how to label
DKI = re.compile(r'^(jakarta( (pusat|selatan|barat|timur|utara))?|kepulauan seribu)$', re.I)

# mirror of build-census.js SECTOR_KEYS, first-match-wins, for the assertion
SECTOR_KEYS = [
    (r"climate|carbon|sustainab|renewable|solar|waste|recycl|circular|\besg\b|emission|mangrove|reforest|air.quality|clean energy|bioplastic|reuse|refill|ev charging|charging network", "climate"),
    (r"^licensed (digital )?bank", "bank"),
    (r"^web3/crypto", "crypto"),
    (r"fintech|payment|wallet|lend|bnpl|wealth|invest|remit|bank", "fintech"),
    (r"insur", "misc"),
    (r"commerce|marketplace|retail|grocer", "commerce"),
    (r"logist|deliver|freight|supply|warehous|courier", "logistics"),
    (r"health|pharma|biotech|\bbio\b|medic|telemed", "health"),
    (r"edtech|educat|upskill|learn", "edtech"),
    (r"saas|enterprise|b2b|pos |dev tool|software", "saas"),
    (r"\bai\b|artificial|data|cloud|cyber|it service", "ai-cloud"),
    (r"media|gaming|game|stream|entertain|creator|music|video", "media"),
    (r"travel|mobilit|transport|automotive|ride", "travel"),
    (r"prop|construction|hospitality|real estate", "prop"),
    (r"agri|aqua|fish|farm|rural", "agri"),
    (r"f&b|fnb|food|kitchen|coffee|d2c|consumer brand|new retail", "fnb"),
    (r"hr |talent|legal|climate|energy|misc", "misc"),
]


def sector_key(s):
    for pat, key in SECTOR_KEYS:
        if re.search(pat, s or "", re.I):
            return key
    return "misc"


def norm(s):
    s = re.sub(r'\(.*?\)', ' ', (s or '').lower())
    s = re.sub(r'\b(pt|tbk|inc|ltd|pte|indonesia)\b', ' ', s)
    return re.sub(r'[^a-z0-9]', '', s)


def funding_scorer():
    """census-funding-src.py's own scorer, loaded without running its main()."""
    spec = importlib.util.spec_from_file_location('fsrc', os.path.join(ROOT, 'scripts', 'census-funding-src.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def http_json(url, timeout=20):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
        return json.load(r)


def kota_box(kota, province):
    """The kota's bounding box from Nominatim, padded — every pin must land inside
    its OWN kota, never the Jakarta envelope the old geocoder applied to everyone."""
    q = f"{kota}, {province}, Indonesia" if province else f"{kota}, Indonesia"
    try:
        res = http_json('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(
            {'q': q, 'format': 'json', 'limit': 1, 'countrycodes': 'id'}))
        time.sleep(1.1)  # Nominatim usage policy: one request a second
        if res:
            s, n, w, e = (float(x) for x in res[0]['boundingbox'])
            return (s - 0.02, n + 0.02, w - 0.02, e + 0.02), (float(res[0]['lat']), float(res[0]['lon']))
    except Exception as ex:
        print('  kota box failed:', q, ex, file=sys.stderr)
    return None, None


def geocode(row):
    box, centre = kota_box(row['kota'], row.get('province'))
    if not box:
        return None
    queries = [row.get('hq_address')]
    if row.get('kecamatan'):
        queries.append(f"{row['kecamatan']}, {row['kota']}")
    for i, q in enumerate(filter(None, queries)):
        try:
            fc = http_json('https://photon.komoot.io/api/?' + urllib.parse.urlencode({'q': q, 'limit': 5}))
        except Exception as ex:
            print('  photon failed:', ex, file=sys.stderr)
            continue
        for f in fc.get('features', []):
            lon, lat = f['geometry']['coordinates'][:2]
            if box[0] <= lat <= box[1] and box[2] <= lon <= box[3]:
                k = (f.get('properties') or {}).get('osm_key', '')
                kind = 'building' if k == 'building' else 'road' if k == 'highway' else ('area' if i else (k or 'area'))
                return lat, lon, 'photon:' + q, kind
    if centre:
        return centre[0], centre[1], f"nominatim:{row['kota']} centroid", 'area'
    return None


def check_row(r, ids_taken, names_taken):
    errs = []
    for k in ('name', 'id', 'sector', 'kota', 'province', 'hq_address', 'employees_est', 'employees_src',
              'employees_asof', 'funding_status', 'confidence', 'verify_note', 'sources'):
        if r.get(k) in (None, '', []):
            errs.append(f'missing {k}')
    if r.get('funding_status') not in FSTATUS:
        errs.append(f"bad funding_status {r.get('funding_status')!r}")
    # 'listed' may carry no figure: the cell then reads "raised on a public market"
    if r.get('funding_status') in ('disclosed', 'partial') and not r.get('funding_total_usd_m'):
        errs.append('status says a figure, row has none')
    if r.get('funding_total_usd_m') and r.get('funding_status') in ('undisclosed', 'none_on_record', 'parent_funded'):
        errs.append('figure present but status says none')
    if (r.get('confidence') or 0) < 0.6:
        errs.append('confidence below 0.6')
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', r.get('id') or ''):
        errs.append('id is not a slug')
    if r.get('id') in ids_taken:
        errs.append('id already used by another row')
    if norm(r.get('name')) in names_taken or (r.get('legal_name') and norm(r['legal_name']) in names_taken):
        errs.append('name or legal name already in the census')
    got = sector_key(r.get('sector'))
    if r.get('_sector_key') and got != r['_sector_key']:
        errs.append(f"sector routes to {got!r}, not {r['_sector_key']!r}")
    return errs


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry = '--dry-run' in sys.argv
    if not args:
        sys.exit(__doc__)
    wave = json.load(open(args[0], encoding='utf-8'))
    tag = wave.get('wave') or os.path.splitext(os.path.basename(args[0]))[0]

    raw = json.load(open(RAW, encoding='utf-8'))
    byid = {c.get('id'): c for c in raw['companies']}
    mine = {r['id'] for r in wave.get('rows', [])}
    ids_taken = {i for i in byid if i not in mine}
    names_taken = set()
    for c in raw['companies']:
        if c.get('id') in mine:
            continue
        names_taken.add(norm(c.get('name')))
        if c.get('legal_name'):
            names_taken.add(norm(c['legal_name']))

    bad = {}
    for r in wave.get('rows', []):
        e = check_row(r, ids_taken, names_taken)
        if e:
            bad[r.get('id') or r.get('name')] = e
    if bad:
        for k, v in bad.items():
            print('REFUSED', k, '—', '; '.join(v))
        sys.exit('fix the research record before writing anything')

    fsrc = funding_scorer()
    added = restored = 0
    for r in wave.get('rows', []):
        want = {k: r.get(k) for k in OWNED if k in r}
        want['sector_key'] = sector_key(r['sector'])       # build recomputes it; the logo monogram reads it
        want['in_dki'] = bool(DKI.match(re.sub(r'^kota\s+(administrasi\s+)?', '', r['kota'], flags=re.I)))
        want.setdefault('employees_kind', 'linkedin')
        want.setdefault('site_status', 'ok')
        want.setdefault('liveness_checked', TODAY)
        want['added'] = r.get('added') or TODAY
        want['source_batch'] = tag
        cur = byid.get(r['id'])
        if cur is None:
            cur = dict(want)
            raw['companies'].append(cur)
            byid[r['id']] = cur
            added += 1
            print('ADDED   ', r['id'], '·', r['kota'])
        else:
            cur.update(want)
            restored += 1
            print('RESTORED', r['id'])
        # the funding link on the figure: census-funding-src's scorer, THIS row only
        f = cur.get('funding_total_usd_m')
        if f and f > 0:
            srcs = list(dict.fromkeys((cur.get('sources') or []) + (r.get('funding_srcs') or [])))
            ch = fsrc.host(cur.get('url') or '')
            scored = sorted(((fsrc.score(u, ch), u) for u in srcs), key=lambda t: -t[0])
            best = scored[0] if scored else (0, None)
            if best[0] >= 40 and best[1]:
                cur['funding_src'] = best[1]
                cur['funding_src_tier'] = 'tracker' if fsrc.cls(best[1]) == 'tracker' else 'announced'
                cur['funding_src_all'] = [u for sc, u in scored if sc >= 40][:5]
            else:
                print('   ! no funding-evidencing URL among the sources — figure prints unlinked')
            for u in r.get('funding_srcs') or []:
                if u not in cur['sources']:
                    cur['sources'].append(u)
        if not cur.get('lat') and not dry and '--no-geocode' not in sys.argv:
            g = geocode(cur)
            if g:
                cur['lat'], cur['lon'], cur['geocode_src'], cur['geocode_kind'] = g
                cur['geocode_tries'] = cur.get('geocode_tries', 0) + 1
                print('   pinned', g[3], round(g[0], 5), round(g[1], 5))
            else:
                print('   UNLOCATED')

    # scope: nationwide rule, both languages; register entries merge BY NAME
    scope = raw.setdefault('scope', {})
    scope['rule'] = RULE
    scope['rule_id'] = RULE_ID
    scope['nationwide_added'] = TODAY
    gone = set(wave.get('outside_remove') or [])
    new_out = {e['name']: e for e in wave.get('outside_add') or []}
    scope['outside'] = [e for e in scope.get('outside', []) if e.get('name') not in gone and e.get('name') not in new_out] \
        + list(new_out.values())
    for key, names in (('yc_outside', wave.get('yc_outside_remove')), ('antler_outside', wave.get('antler_outside_remove'))):
        if names:
            raw[key] = [e for e in raw.get(key) or [] if (e.get('name') if isinstance(e, dict) else e) not in set(names)]
    # entries that were outside ONLY on geography: the reason is rewritten, not the
    # entry dropped, until research decides them. NOTE census-yc.py / census-antler.py
    # / census-cloud.py hold their own copies of these registers — re-running one of
    # them puts the pre-nationwide reason back; re-run this script after it.
    for u in wave.get('register_updates') or []:
        reg = scope['outside'] if u['register'] == 'scope.outside' else raw.get(u['register']) or []
        hit = [e for e in reg if isinstance(e, dict) and e.get('name') == u['name']]
        if not hit:
            print('   ! register update found no entry:', u['register'], u['name'])
        for e in hit:
            e.update(u['set'])

    # census rows found closed: out of the live table, into the removals register
    for rm in wave.get('removed_add') or []:
        if rm['id'] in byid:
            raw['companies'] = [c for c in raw['companies'] if c.get('id') != rm['id']]
            print('REMOVED ', rm['id'], '—', rm['reason'][:80])
        have = {e.get('id') or e.get('name') for e in raw.get('removed') or []}
        if (rm.get('id') or rm['name']) not in have:
            raw.setdefault('removed', []).append(rm)

    # the closed register: every entry dated, two links, one of two known fates
    closed = json.load(open(CLOSED, encoding='utf-8'))
    have = {e['name']: e for e in closed.get('entries', [])}
    for e in wave.get('closed_add') or []:
        errs = []
        if e.get('fate') not in FATES:
            errs.append(f"fate {e.get('fate')!r}")
        if e.get('confidence') not in ('confirmed', 'reported'):
            errs.append(f"confidence {e.get('confidence')!r}")
        if not re.fullmatch(r'\d{4}(-\d{2})?', str(e.get('ended') or '')):
            errs.append(f"ended {e.get('ended')!r}")
        if len(e.get('sources') or []) < 2:
            errs.append('fewer than two sources')
        if errs:
            print('CLOSED REFUSED', e.get('name'), '—', '; '.join(errs))
            continue
        have[e['name']] = {k: e.get(k) for k in ('name', 'legal_name', 'fate', 'confidence', 'sector', 'city',
                                                   'founded', 'ended', 'funding_usd_m', 'why', 'sources') if e.get(k) is not None}
    closed['entries'] = sorted(have.values(), key=lambda x: (str(x.get('ended') or ''), x['name']), reverse=True)
    closed['generated'] = TODAY

    print(f'rows: {added} added, {restored} restored · companies now {len(raw["companies"])} · '
          f'scope.outside {len(scope["outside"])} · closed register {len(closed["entries"])}')
    if dry:
        print('dry run: nothing written')
        return
    for path, obj, ind in ((RAW, raw, 1), (CLOSED, closed, 1)):
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix='.tmp')
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            json.dump(obj, fh, ensure_ascii=False, indent=ind)
        os.replace(tmp, path)


if __name__ == '__main__':
    main()
