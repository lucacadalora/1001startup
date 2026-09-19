#!/usr/bin/env python3
"""census-funding-status.py — stamp funding_status on the rows the backfill sweep did not touch.

The backfill (census-funding-backfill.py) gives a status to the 130 rows that had an
unexplained dash. This finishes the field for the other 248 so every row in the census
says which kind of figure — or which kind of nothing — its funding cell holds, and the
site can stop making a reader guess whether "—" means "never raised" or "raised, never
told anyone".

Nothing here is new research. Every classification is read off the row's OWN existing
funding_note / last_round, which is why each entry below quotes the phrase it turns on.
That matters most for `partial`: a row whose own note says the other rounds were
undisclosed is carrying a FLOOR, not a total, and printing it as a total overstates what
the census knows.

`listed` marks the rows whose figure is public-market proceeds rather than a private
round. The census has always summed those into the funding column (Bukalapak's IPO,
Superbank's IPO); the flag does not change the arithmetic, it just stops an IPO from
reading as a venture round. See the funding-coverage note for the open question of
whether the digital banks' rights issues belong in the same column.
"""
import json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')

# ── rows with a figure ────────────────────────────────────────────────────────
# `partial` — the row's own note says at least one other round was never sized, so the
# number is the floor of what was raised, not the total.
PARTIAL = {
    'dana': 'earlier Ant-Emtek capital injections undisclosed',
    'ovo': 'prior investment amounts largely undisclosed',
    'ayoconnect': 'Sep 2025 bridge round amount undisclosed',
    'paper-id': 'disclosed total reflects the US$12M Dec-2022 tranche only',
    'jack': 'earlier East Ventures & Beenext seed amounts largely undisclosed',
    'etana-biotechnologies': 'disclosed portion only; total round size undisclosed',
    'idn': 'Series D amount undisclosed',
    'touchten-games': 'amounts across 6 rounds largely undisclosed',
    'gojek': 'tracker aggregate across a decade; never disclosed as a single figure',
    'travelio': 'Series C amount undisclosed',
    'moladin': 'internal equity round undisclosed',
    'pasarmikro': 'earlier 1982 Ventures seed undisclosed',
    'haus': 'Series B1 amount undisclosed',
    'pasarpolis': '2018 Series A undisclosed; 2025 extension never confirmed',
    'pahamify': 'only the YC US$150K is disclosed; Shunwei Series A was not',
    'modalku': 'group-level equity; Indonesian entity share not broken out',
    'migo': 'earlier Series B1 and B2 undisclosed',
    'pintek': 'earlier pre-Series A undisclosed',
    'eureka-ai': 'earlier rounds undisclosed',
    'kitabisa': 'only the IFC US$5M is sized; seed, Series A and 2019 round were not',
    'bibit': 'group-level total for Stockbit Bibit; sister row raised undisclosed rounds',
}

# `listed` — the figure is money raised on a public market, not a private round.
LISTED = {
    'bukalapak': 'IPO (IDX: BUKA), Aug 2021',
    'superbank': 'IPO (IDX: SUPA), 17 Dec 2025',
    'fore-coffee': 'IPO (IDX: FORE), Apr 2025',
    'rans-entertainment': 'IPO (IDX: RANS), 10 Jul 2026',
    'itsec-asia': 'IPO (IDX: CYBR)',
    'elitery': 'IPO (IDX: ELIT)',
    'cashlez': 'IPO (IDX: CASH), Apr 2020 — pre-IPO rounds undisclosed',
    'nusatrip': 'Nasdaq IPO (NUTR)',
}

# `debt_only` — the figure in the column is a loan facility, not equity. Nothing qualifies
# today; kept because the backfill sweep can produce one and the site needs the label.
DEBT_ONLY = {}

# Two corrections found while classifying, both from the row's own source rather than new
# research. Applied here so the reasoning sits next to the classification that exposed it.
FIX = {
    # sun-energy read as debt at first glance because last_round names the PT SMI facility.
    # It does not: the figure is an equity Series A, and the company said so itself.
    'sun-energy': dict(
        funding_note='US$25M Series A, announced 22 Nov 2021 — equity, led by Southeast Asian '
                     'conglomerates including Toba Bara, and confirmed by SUN Energy on its own '
                     'LinkedIn the same day (Kontan put it at "lebih dari Rp 360 miliar"). The later '
                     'PT SMI facility (Rp 620bn over 15 years) and the US$10M SMBC Indonesia line are '
                     'project debt against solar assets, not equity, and are not added to the figure.',
        funding_src_tier='company',
    ),
    # fithub was the one row in the census carrying a figure with no funding_src at all, so the
    # number had nothing to link to. Its note already sets out the composition; this points the
    # link at the source for the larger, weaker half of it.
    'fithub': dict(
        funding_src='https://www.dealstreetasia.com/stories/fit-hub-wavemaker-cercano-399274',
        funding_src_tier='announced',
    ),
}

# ── rows with no figure ───────────────────────────────────────────────────────
# `parent_funded` — capital raised by a parent or group; not an Indonesian figure.
PARENT_FUNDED = {
    'j-t-express', 'tiket-com', 'grab-indonesia', 'shopee-indonesia', 'lazada-indonesia',
    'ninja-xpress', 'lalamove-indonesia', 'deliveree-indonesia', 'borzo-indonesia',
    'upbit-indonesia', 'tiktok-indonesia', 'garasi-id', 'catapa',
    # added by a parallel session mid-sweep; its own note says "no round of its own on
    # record" and traces the money to Brodo's Series A, so the auto-classification
    # (note present => undisclosed) was the wrong one of the two
    'boleh-dicoba',
}

# `none_on_record` — no outside round exists and the note says what was checked.
NONE_ON_RECORD = {
    'lion-parcel', 'strongbee', 'idexpress', 'ranch-market', 'tomoro-coffee',
    'kopi-tuku', 'tanamera-coffee', 'bittime', 'balesin',
}

# everything else with a note and no figure is `undisclosed`: the round demonstrably
# happened, the amount never became public. That is the single most common answer in
# Indonesian venture and the census should say so rather than shrug.


def main():
    apply = '--apply' in sys.argv
    raw = json.load(open(RAW))
    changed, spread, conflicts = 0, {}, []

    for c in raw['companies']:
        rid = c['id']
        amt = c.get('funding_total_usd_m')
        note = c.get('funding_note')
        prev = c.get('funding_status')

        # HANDS OFF the rows the research sweep owns. It stamps funding_asof on every row
        # it touched, and it knows things this script cannot infer from text — that
        # Sampangan's capital is all grants, that nusaQu's is repayable sukuk, that
        # Anabatic's came off the IDX. Without this guard the blunt "has a note and no
        # figure => undisclosed" rule below flattens all of that back to one word.
        if c.get('funding_asof'):
            if c.get('funding_status'):
                spread[c['funding_status']] = spread.get(c['funding_status'], 0) + 1
            continue

        if rid in DEBT_ONLY:
            st = 'debt_only'
        elif rid in LISTED:
            st = 'listed'
        elif rid in PARTIAL:
            st = 'partial'
        elif amt is not None:
            st = 'disclosed'
        elif rid in PARENT_FUNDED:
            st = 'parent_funded'
        elif rid in NONE_ON_RECORD:
            st = 'none_on_record'
        elif note:
            st = 'undisclosed'
        else:
            st = None          # left for the backfill sweep; not this script's business

        # a hand-classified id that carries no figure (or vice versa) means the map has
        # drifted from the data — surface it instead of silently applying it
        if rid in (set(PARTIAL) | set(LISTED) | set(DEBT_ONLY)) and amt is None:
            conflicts.append(f'{rid}: mapped {st} but carries no figure')
        if rid in (PARENT_FUNDED | NONE_ON_RECORD) and amt is not None:
            conflicts.append(f'{rid}: mapped {st} but carries US${amt}M')

        # the reason a figure is only a floor belongs ON the row: /coverage lists these
        # rows and "what is missing from it" cannot be answered by last_round, which
        # describes the round that IS counted
        if rid in PARTIAL and c.get('funding_floor_note') != PARTIAL[rid]:
            c['funding_floor_note'] = PARTIAL[rid]
            changed += 1

        if rid in FIX:
            for k, v in FIX[rid].items():
                if not c.get(k):
                    c[k] = v
                    changed += 1
                    print(f'  + {rid}.{k} set')

        # this script owns the classification for every row it can classify — the backfill
        # sweep owns the rows with neither a figure nor a note, and the two sets are
        # disjoint, so re-running here may safely correct a status this script itself set
        if st and prev != st:
            if prev:
                conflicts.append(f'{rid}: {prev} -> {st}')
            c['funding_status'] = st
            changed += 1
        if c.get('funding_status'):
            spread[c['funding_status']] = spread.get(c['funding_status'], 0) + 1

    for x in conflicts:
        print('  ! ' + x)
    print(f'\nfunding_status set on {changed} rows')
    print('spread: ' + ', '.join(f'{k}={v}' for k, v in sorted(spread.items(), key=lambda x: -x[1])))
    missing = [c['id'] for c in raw['companies'] if not c.get('funding_status')]
    print(f'rows still without a status: {len(missing)}')
    if missing:
        print('  ' + ', '.join(missing[:30]))

    floors = [c for c in raw['companies'] if c.get('funding_status') == 'partial']
    print(f'\nfigures now flagged as a FLOOR rather than a total: {len(floors)} '
          f'(US${sum(c["funding_total_usd_m"] for c in floors)/1000:.1f}B of the column)')

    if apply:
        d = os.path.dirname(os.path.abspath(RAW))
        fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')
        with os.fdopen(fd, 'w') as fh:
            json.dump(raw, fh, ensure_ascii=False, indent=1)
        os.replace(tmp, RAW)
        print(f'wrote {RAW}')
    else:
        print('dry run — pass --apply to write')


if __name__ == '__main__':
    main()
