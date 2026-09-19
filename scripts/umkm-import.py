#!/usr/bin/env python3
"""1001umkm.id — import the exporter research file into the product's master.

Source snapshot: ~/.openclaw/workspace/reference-materials/
    2kimi-indonesia-exporter-database/research/exporters.json
(Aug 31 2026 batch-3 sweep: 1,410 exporters — a clean superset of the 869-row
first sweep, with contact/terms enrichment on rows we already held.)

Writes : data/umkm-raw.json  (the master this product builds from)
         data/umkm-source-exporters.json  (verbatim snapshot, provenance)
         data/umkm-import-report.json     (what this run changed, and why)

Idempotent: slugs are derived from company NAMES, never from the source's
numeric id — that id is renumbered on every sweep (batch 3 shifted 858 of 869
rows), so a name-derived slug is the only stable permalink.

Every mechanical repair is recorded on the row it touched (fixes[]) and
summarised in method.field_fixes. NEVER writes census-raw.json or any census-*
file.
"""
import json, re, unicodedata, datetime, pathlib, shutil
from urllib.parse import urlparse

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = pathlib.Path.home() / '.openclaw/workspace/reference-materials'
SRC = REF / '2kimi-indonesia-exporter-database/research/exporters.json'
PREV_MASTER = ROOT / 'data' / 'umkm-raw.json'      # what is live right now
OUT = ROOT / 'data' / 'umkm-raw.json'
SNAP = ROOT / 'data' / 'umkm-source-exporters.json'
REPORT = ROOT / 'data' / 'umkm-import-report.json'

# ── verification tiers ───────────────────────────────────────────────────
# Six now, not five. The batch-3 sweep RENAMED "Trade-show exhibitor" to
# "Trade-show / marketplace seller" and poured Etsy/Instagram storefronts into
# it. Those are not the same evidence: exhibiting at Trade Expo Indonesia is a
# vetted trade appearance; an Etsy shop with 291 sales is a retail storefront.
# Merging them would quietly degrade the tier a buyer relies on, so the tier is
# split back apart here, by what the row's source actually IS (see storefront()).
TIERS = {
    'Verified shipper (InaExport + shipment)': ('verified_shipper', 6),
    'Confirmed shipper (news/documented)':     ('confirmed_shipper', 5),
    'InaExport-verified (Kemendag)':           ('inaexport', 4),
    'Trade-show exhibitor':                    ('tradeshow', 3),   # pre-batch-3 wording
    'Trade-show / marketplace seller':         ('tradeshow', 3),   # split below
    'Export-listed / export-ready':            ('export_listed', 2),
}
MARKETPLACE = ('marketplace', 1)

# A consumer storefront the company runs itself. Matched on HOST, never on the
# whole URL: a news article whose path contains "shopee" is a news article.
STORE_HOSTS = {'etsy.com', 'topcraftsellers.com', 'instagram.com', 'tiktok.com',
               'facebook.com', 'shopee.co.id', 'shopee.com', 'tokopedia.com'}

def host_of(u):
    try:
        return (urlparse(u).hostname or '').replace('www.', '').lower()
    except Exception:
        return ''

def storefront(u):
    h = host_of(u)
    return h in STORE_HOSTS or h.endswith('.trustpass.alibaba.com')

SECTOR_INDUSTRY = {
    'Agriculture': 'Food, Beverage & Agriculture',
    'Automotive & Industrial': 'Automotive & Industrial',
    'Coconut & Charcoal': 'Coconut, Charcoal & Energy',
    'Coffee & Tea': 'Food, Beverage & Agriculture',
    'Cosmetics & Essential Oils': 'Cosmetics & Essential Oils',
    'Fisheries & Seaweed': 'Food, Beverage & Agriculture',
    'Food & Beverage': 'Food, Beverage & Agriculture',
    'Footwear': 'Fashion & Textiles',
    'Furniture': 'Furniture & Home Living',
    'Handicraft': 'Furniture & Home Living',
    'Home Decor': 'Furniture & Home Living',
    'Jewelry': 'Jewelry & Accessories',
    'Leather Goods': 'Fashion & Textiles',
    'Spices': 'Food, Beverage & Agriculture',
    'Textiles & Fashion': 'Fashion & Textiles',
    'Stone & Building Materials': 'Stone & Building Materials',
}

# ── editorial re-buckets ─────────────────────────────────────────────────
# (a) The first sweep filed non-automotive makers under the Automotive
#     catch-all. These nine are instrument and artisan-toy workshops.
REBUCKET = {
    'Batiksoul Guitars': 'Handicraft',
    'Blueberry Guitars': 'Handicraft',
    'Gamelan Panggiyo': 'Handicraft',
    'UD Supoyo (Gamelan Supoyo)': 'Handicraft',
    'PT Uba Uhud International': 'Handicraft',
    'CV Agdia Toys': 'Handicraft',
    'Mainan Kayu (Nobie Toys)': 'Handicraft',
    'PT Master Kidz Indonesia': 'Handicraft',
    'PT Royal Regent Indonesia': 'Handicraft',
}
# (b) Batch 3 added ~30 natural-stone and structural-timber exporters, filed
#     across Home Decor / Furniture / the Automotive catch-all. Quarried stone
#     slabs, andesite pool tiles, terracotta roof tiles and ironwood decking are
#     building materials, not decor — and a marble exporter drawn with the
#     automotive sprite is simply wrong on the map. Listed by name rather than
#     matched by regex so every move is auditable.
#     Deliberately NOT moved: ulin KITCHENWARE (PT Anakkayu), horn eyewear
#     (Kallestory), and stone statuary/garden ornament houses whose catalogue is
#     ornament rather than building stock.
REBUCKET.update({n: 'Stone & Building Materials' for n in [
    'CV Good Year', 'Kaltimber', 'NaturanexA', 'PT Arwachna Marmer Prima',
    'PT Javastone Perkasa', 'Asiatik Indo', 'WDF - Wooden Decking Flooring',
    'PT Tanjung Kreasi Parquet Industry (TEKA Parquet)', 'Bali Terrazzo', 'CV Alam Berkah Indonesia',
    'CV Johar Jaya', 'CV Rahmat Jaya', 'CV Sinar Batu Alam',
    'CV Surya Bagus Alamanda (Universal Stone Tile)', 'Doa Orang Tua (Watucandi)',
    'PT A2Z Stone Indonesia', 'PT Anugrah Watugede', 'PT Bigga Damai Utama (Bigga Stone)',
    'PT Cempaka Karya Utama (Green Stone Indonesia)', 'PT Murfy Alam Indonesia',
    'PT Yogya Lestari Jaya', 'UNK Stone Indonesia',
]})

# Permalink pins: batch 3 restyled one company's name. The slug it would now
# derive ('damakara') is a different URL from the one already published, so the
# old slug is kept and the new spelling becomes the display name.
SLUG_PIN = {'Damakara': 'dama-kara'}

EMAIL_RE = re.compile(r'^[^@\s;,]+@[^@\s;,]+\.[^@\s;,]+$')
EMAIL_FIND = re.compile(r'[^@\s;,<>()]+@[^@\s;,<>()]+\.[a-z]{2,}', re.I)
PHONE_RE = re.compile(r'^[+\d][\d\s\-()]{6,}$')
LEGAL_RE = re.compile(r'^(pt|cv|ud|pd)\s+', re.I)
URL_RE = re.compile(r'^https?://', re.I)


def slugify(name):
    s = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    s = LEGAL_RE.sub('', s.strip())
    s = re.sub(r'\(.*?\)', ' ', s)              # drop parentheticals first
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s or re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def clean(v):
    v = (v or '').strip()
    return v or None


def main():
    rows = json.load(open(SRC))
    shutil.copyfile(SRC, SNAP)

    # What is live right now — used to never lose a note the new sweep dropped,
    # and to report what this run actually changes.
    prev = {}
    try:
        for c in json.load(open(PREV_MASTER))['companies']:
            prev[c['id']] = c
    except Exception:
        pass

    seen, out = {}, []
    fixes_summary = {
        'email_was_phone': 0, 'email_list_split': 0, 'website_scheme_added': 0,
        'website_was_email': 0, 'source_was_prose': 0, 'source_was_phone': 0,
        'rebucketed': 0, 'tier_split_marketplace': 0, 'note_kept_from_previous': 0,
    }
    report = {'renamed': [], 'moved_location': [], 'source_missing': [], 'rebucketed': []}

    for r in rows:
        name = r['company'].strip()
        slug = SLUG_PIN.get(name) or slugify(name)
        if slug in seen:                        # collision → keep both, suffixed
            n = 2
            while f'{slug}-{n}' in seen:
                n += 1
            slug = f'{slug}-{n}'
        seen[slug] = True

        fixes = []
        email, phone = clean(r.get('email')), clean(r.get('phone'))
        url = clean(r.get('website'))
        source = clean(r.get('source_url'))
        notes = clean(r.get('notes'))

        # ── source_url repairs ───────────────────────────────────────────
        # Batch 3 left prose in source_url on 33 rows ("IG/live-selling UMKM
        # brand (owner Repika); products exported to…"). The site links every
        # verification badge to its source, so prose there is a broken promise,
        # not a small blemish: the text is moved into notes and the row is
        # marked as carrying no source link, which the page then states.
        source_missing = False
        if source and not URL_RE.match(source):
            stray = source
            source = None
            if PHONE_RE.match(stray.strip()) and not phone:
                phone = stray.strip()
                fixes.append('source_url held a phone number; moved to phone, no source link on this row')
                fixes_summary['source_was_phone'] += 1
            else:
                notes = ' '.join(x for x in [notes, stray] if x)
                fixes.append('source_url held descriptive text, not a link; moved into notes')
                fixes_summary['source_was_prose'] += 1
            source_missing = True
            report['source_missing'].append(name)

        # ── contact repairs ──────────────────────────────────────────────
        if email and not EMAIL_RE.match(email):
            found = EMAIL_FIND.findall(email)
            if found:
                # "a@x.com; b@x.com" — keep the first, record the rest
                extra = found[1:]
                fixes.append('email column held ' + str(len(found)) + ' addresses; first kept'
                             + (', also on record: ' + ', '.join(extra) if extra else ''))
                fixes_summary['email_list_split'] += 1
                email = found[0]
            else:
                if not phone:
                    phone = email
                fixes.append('email column held a phone number; moved, email withdrawn')
                fixes_summary['email_was_phone'] += 1
                email = None
        if email:
            email = email.lower()

        if url and '@' in url and not URL_RE.match(url):
            if not email:
                email = url.lower()
            fixes.append('website column held an email address; moved, website withdrawn')
            fixes_summary['website_was_email'] += 1
            url = None
        if url and not URL_RE.match(url):
            url = 'https://' + url
            fixes.append('website had no scheme; https:// added')
            fixes_summary['website_scheme_added'] += 1

        # ── sector ───────────────────────────────────────────────────────
        sector = r['sector'].strip()
        sector_src = None
        if name in REBUCKET and REBUCKET[name] != sector:
            sector_src = sector
            sector = REBUCKET[name]
            fixes.append(f'sector re-bucketed from "{sector_src}"')
            fixes_summary['rebucketed'] += 1
            report['rebucketed'].append({'name': name, 'from': sector_src, 'to': sector})

        # ── verification tier ────────────────────────────────────────────
        vtext = r['verification'].strip()
        if vtext not in TIERS:
            raise SystemExit(f'UNKNOWN verification tier {vtext!r} on {name!r} — '
                             'add it to TIERS deliberately rather than letting it default')
        tier_key, tier_rank = TIERS[vtext]
        tier_src = None
        if vtext == 'Trade-show / marketplace seller' and storefront(r.get('source_url')):
            tier_src = vtext
            tier_key, tier_rank = MARKETPLACE
            fixes.append('tier read as marketplace: the source is the company’s own '
                         f'{host_of(r.get("source_url"))} storefront, not a trade-show record')
            fixes_summary['tier_split_marketplace'] += 1

        # ── never lose a fact an earlier sweep recorded ──────────────────
        # Almost every changed note is pure enrichment (the new text contains
        # the old). Where it does not, the earlier note held something this
        # sweep dropped — a founder, a year, who the workshop employs — so it is
        # carried rather than overwritten.
        p = prev.get(slug)
        if p and p.get('notes'):
            po = re.sub(r'\s+', ' ', p['notes']).strip()
            if not notes:
                notes = po
                fixes.append('notes kept from the previous snapshot; this sweep left the field blank')
                fixes_summary['note_kept_from_previous'] += 1
            elif po and po not in re.sub(r'\s+', ' ', notes):
                notes = notes.rstrip('. ') + '. ' + po
                fixes.append('earlier snapshot recorded facts this sweep dropped; both kept')
                fixes_summary['note_merged_with_previous'] = fixes_summary.get('note_merged_with_previous', 0) + 1

        if p:
            if p.get('name') != name:
                report['renamed'].append({'id': slug, 'from': p['name'], 'to': name})
            if (p.get('city') or '') != (clean(r.get('city')) or '') or \
               (p.get('province') or '') != (clean(r.get('province')) or ''):
                report['moved_location'].append({
                    'id': slug, 'from': [p.get('city'), p.get('province')],
                    'to': [clean(r.get('city')), clean(r.get('province'))]})

        out.append({
            'id': slug,
            'src_id': r['id'],          # provenance only — renumbered every sweep
            'name': name,
            'city': clean(r.get('city')),
            'province': clean(r.get('province')),
            'sector': sector,
            'sector_src': sector_src,
            'industry': SECTOR_INDUSTRY[sector],
            'products': clean(r.get('products')),
            'markets': clean(r.get('export_markets')),
            'certs': clean(r.get('certifications')),
            'moq': clean(r.get('moq')),
            'incoterms': clean(r.get('incoterms')),
            'payment_terms': clean(r.get('payment_terms')),
            'email': email,
            'phone': phone,
            'url': url,
            'source_url': source,
            'source_missing': source_missing,
            'tier': tier_key,
            'tier_rank': tier_rank,
            'tier_src': tier_src,
            'verification': vtext,
            'notes': notes,
            'fixes': fixes,
        })

    # A re-bucket that matches no row is a silent no-op — the sweep renamed the
    # company and the editorial decision quietly stopped applying. Fail loudly
    # instead (two entries were already truncated this way).
    all_names = {r['company'].strip() for r in rows}
    orphan = sorted(n for n in REBUCKET if n not in all_names)
    if orphan:
        raise SystemExit('REBUCKET names match no row in the source — fix or remove them:\n  '
                         + '\n  '.join(orphan))

    # Rank: strongest evidence first, then most reachable, then name. Fixed at
    # import so '#' always returns the table to one deterministic order.
    def contact_score(c):
        return (4 if c['email'] else 0) + (2 if c['url'] else 0) + (1 if c['phone'] else 0)
    out.sort(key=lambda c: (-c['tier_rank'], -contact_score(c), c['name'].lower()))
    for i, c in enumerate(out):
        c['rank'] = i + 1

    added = [c['id'] for c in out if c['id'] not in prev]
    gone = [k for k in prev if k not in {c['id'] for c in out}]

    doc = {
        'generated': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        'source': {
            'file': str(SRC),
            'compiled': '2026-08-31',
            'sweeps': 'batch 1–3',
            'method': 'Parallel research sweeps over InaExport (Kemendag), Trade Expo Indonesia & '
                      'IFEX exhibitor directories, government export releases (Bea Cukai, Kemenperin, '
                      'LPEI), company sites, documented news, and — for the marketplace tier — the '
                      'companies’ own international storefronts. Every row carries the page it was '
                      'compiled from, except where that page was not recorded as a link.',
        },
        'method': {
            'tiers': {
                'verified_shipper': {'rank': 6, 'src': 'Verified shipper (InaExport + shipment)'},
                'confirmed_shipper': {'rank': 5, 'src': 'Confirmed shipper (news/documented)'},
                'inaexport': {'rank': 4, 'src': 'InaExport-verified (Kemendag)'},
                'tradeshow': {'rank': 3, 'src': 'Trade-show exhibitor'},
                'export_listed': {'rank': 2, 'src': 'Export-listed / export-ready'},
                'marketplace': {'rank': 1, 'src': 'Marketplace seller'},
            },
            'rebucketed': sorted(REBUCKET),
            'field_fixes': fixes_summary,
            'ranking': 'verification tier, then reachability (email > website > phone), then name',
        },
        'companies': out,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1))

    report['added'] = added
    report['removed'] = gone
    report['counts'] = {'rows': len(out), 'added': len(added), 'removed': len(gone)}
    report['fixes'] = fixes_summary
    report['generated'] = doc['generated']
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1))

    print(f'{len(out)} exporters -> {OUT}')
    print(f'  added {len(added)}, removed {len(gone)}')
    print('  fixes:', fixes_summary)
    if report['renamed']:
        print('  renamed:', report['renamed'])
    if gone:
        print('  WARNING rows that vanished from the source:', gone[:10])


if __name__ == '__main__':
    main()
