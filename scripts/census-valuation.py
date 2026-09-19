#!/usr/bin/env python3
"""Annotate the census's valuation figures so a COMBINED total can be published.

A sum of valuations is only meaningful if three things are stated:

  1. COVERAGE — how many rows carry a mark at all (most do not, and a missing
     valuation is never imputed from funding).
  2. CONTAINMENT — a subsidiary's value already sits inside a counted parent's
     market cap. Adding both double-counts. `valuation_parent_id` names the
     parent row; the build excludes the child from the combined total.
  3. WHAT KIND OF MARK it is — a live market capitalisation is not the same
     claim as a 2019 private round. `valuation_kind` + `valuation_asof` let the
     page split the total into live prices and stale private marks.

Every value below is read off the row's own `valuation_note`, which already
carries the source. Nothing new is asserted here. Idempotent.

Writes data/census-valuation.json, which build-census.js merges onto the rows —
NOT census-raw.json. Another session rewrites census-raw.json wholesale, and it
clobbered these stamps once already; single-writer side files are this repo's
pattern for anything two sessions touch (same reason as census-sprites.json).

Run: python3 scripts/census-valuation.py
"""
import json
import os
import sys

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-raw.json')
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-valuation.json')

# id -> (kind, asof year or None)
#   listed  = market capitalisation of a listed company (a live price)
#   private = a priced round, an acquisition/stake implied mark, or a tracker's
#             reported figure — the note says which
#   est     = our own carve-out, never disclosed (see scripts/est-valuation-*.py)
# asof = the year the mark itself is dated; None where the source publishes a
# "current" modelled figure with no underlying dated mark. Never guessed.
MARKS = {
    'triv':          ('private', 2025),   # MEXC Ventures' own release: strategic investment AT US$200M
    'gojek':         ('listed',  2026),
    'grab-indonesia':('est',     2026),   # Indonesia-only carve-out, scripts/est-valuation-grab.py
    'blibli':        ('listed',  2026),
    'bukalapak':     ('listed',  2026),
    'fore-coffee':   ('listed',  2026),
    'cashlez':       ('listed',  2025),
    'ovo':           ('private', 2019),
    'traveloka':     ('private', None),   # Tracxn "current valuation", modelled
    'akulaku':       ('private', 2022),
    'dana':          ('private', 2022),   # trackers' figure, post the 2022 round
    'xendit':        ('private', 2021),
    'ajaib':         ('private', 2021),
    'kopi-kenangan': ('private', 2021),
    'vidio':         ('private', 2021),
    'ruangguru':     ('private', 2019),
    'sociolla':      ('private', 2025),
    'hypefast':      ('private', 2021),
    'cakap':         ('private', 2023),   # ">$100M", a floor rather than a mark
    'charged-asia':  ('private', 2023),
    'wahyoo':        ('private', 2022),
    'dekoruma':      ('private', 2024),
    'tiket-com':     ('est',     None),
    'ranch-market':  ('listed',  2026),
}

# child id -> (parent id, why the child's value is already inside the parent's)
CONTAINED = {
    'tiket-com': ('blibli',
                  "Blibli (IDX: BELI) has owned 100% since 12 Jun 2017. The figure on this row is an "
                  "estimated carve-out of the same market capitalisation counted on Blibli's row."),
    'ovo': ('grab-indonesia',
            "Grab owns ~90% of PT Visionet Internasional and consolidates it, so OVO's value sits inside "
            "Grab's market capitalisation — and therefore inside the Indonesia-only carve-out counted on "
            "the Grab Indonesia row. The US$2.9B here is OVO's own 2019 unicorn mark, from before Grab "
            "took control; it is kept on the row as the last standalone price and held out of the sum."),
    'dekoruma': ('blibli',
                 "Blibli bought 99.83% for Rp 1.16T in Jun 2024, so the purchase price sits inside "
                 "Blibli's market capitalisation, already counted on Blibli's row."),
    'ranch-market': ('blibli',
                     "Blibli (IDX: BELI) has held 51.00% since 30 Sep 2021 and consolidates Supra Boga "
                     "Lestari as a direct subsidiary (BELI's audited FY2025 statements), so the majority "
                     "of this Rp 813.5bn live market cap already sits inside Blibli's own — counting "
                     "both would double-count. The RANC cap is kept on the row and held out of the sum."),
}


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by_id = {c.get('id'): c for c in raw['companies']}

    unknown = [i for i in list(MARKS) + list(CONTAINED) if i not in by_id]
    if unknown:
        sys.exit('unknown ids (renamed or removed?): ' + ', '.join(unknown))

    # any row that grew a valuation since this script was last edited must be
    # classified by hand — silently leaving it unmarked would let an unlabelled
    # figure into the combined total
    missing = [c['id'] for c in raw['companies']
               if c.get('valuation_usd_m') is not None and c['id'] not in MARKS]
    if missing:
        sys.exit('valuation rows with no mark classification — add them to MARKS: '
                 + ', '.join(missing))

    stamps = {}
    for cid, (kind, asof) in MARKS.items():
        c = by_id[cid]
        if c.get('valuation_usd_m') is None:
            sys.exit(f'{cid}: classified here but the row has no valuation any more')
        stamps[cid] = {'valuation_kind': kind, 'valuation_asof': asof}
    for cid, (parent, why) in CONTAINED.items():
        stamps.setdefault(cid, {}).update(
            {'valuation_parent_id': parent, 'valuation_parent_note': why})

    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(stamps, f, ensure_ascii=False, indent=2, sort_keys=True)
    os.replace(tmp, OUT)

    counted = [c for c in raw['companies']
               if c.get('valuation_usd_m') is not None
               and c['id'] not in CONTAINED]
    total = sum(c['valuation_usd_m'] for c in counted)
    listed = sum(c['valuation_usd_m'] for c in counted
                 if stamps.get(c['id'], {}).get('valuation_kind') == 'listed')

    print(f'{len(stamps)} rows stamped -> data/census-valuation.json')
    print(f'counted {len(counted)} of {len(raw["companies"])} companies · '
          f'combined US${total/1000:.2f}B '
          f'(listed market cap US${listed/1000:.2f}B, private marks US${(total-listed)/1000:.2f}B)')
    for cid, (parent, _) in CONTAINED.items():
        print(f'  not counted: {by_id[cid]["name"]} US${by_id[cid]["valuation_usd_m"]}M '
              f'— inside {by_id[parent]["name"]}')


main()
