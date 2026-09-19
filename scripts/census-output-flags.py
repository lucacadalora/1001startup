#!/usr/bin/env python3
"""Rows where the GVA estimator is known to run high — written as a flag, never
as a correction.

The census prices every worker at a BPS DKI Jakarta sector anchor. That anchor
is an average over an entire Jakarta sector, so it fits an office of desk staff
and stretches over other kinds of workforce. `method.caveats[3]` states the
test — direct GVA must not exceed take-rate revenue — and this file is where a
row that fails it gets its doubt published.

31 Aug 2026, second pass (census-workforce-split.py): the frontline anchor
resolved nearly all of the old exposure. Field-workforce rows — J&T's couriers,
Amartha's village field officers, the store chains, the gyms — are marked
`workforce_kind: frontline` and priced at the BPS national average (Rp 149jt)
instead of a Jakarta sector anchor, and split rows (Amartha, FORE) price
office and frontline separately, so pricing them is no longer a known
overstatement. Their old flags came out. What remains is the row where a
revenue bound still contradicts even a desk-anchor estimate.

This file does not change a published figure. It is merged by build-census.js
at build time. SINGLE-WRITER SIDE FILE, same reason as census-sprites.json /
census-logos.json / census-valuation.json: census-raw.json is rewritten
wholesale by the research loop and by parallel sessions.

Idempotent: re-running restores exactly its own fields.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')
OUT = os.path.join(ROOT, 'data', 'census-output-flags.json')

# kind: 'workforce' — the anchor is applied to a workforce it was not built
#       from (none currently: the frontline anchor absorbed this class).
#       'revenue'   — a published or bounded revenue figure sits BELOW the
#       modelled value added, which is the sanity gate failing outright.
FLAGS = {
    'kitabisa': ('revenue',
        'Kitabisa takes about 5% on donations. Its founder’s own figure of 31 million '
        'transactions a year caps the take at a few hundred billion rupiah even on generous '
        'assumptions, below the Rp 562 billion of value added the fintech anchor assigns it.'),
}


def main():
    with open(RAW, encoding='utf-8') as f:
        raw = json.load(f)
    ids = {c.get('id') for c in raw.get('companies', [])}
    missing = sorted(set(FLAGS) - ids)
    if missing:
        # a flag pointing at a row that no longer exists is a silent lie about
        # coverage; fail loudly rather than write it
        print('ERROR: flagged ids not in census: ' + ', '.join(missing), file=sys.stderr)
        return 1
    out = {i: {'output_caveat': {'kind': k, 'why': w}} for i, (k, w) in sorted(FLAGS.items())}
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write('\n')
    by = {c['id']: c for c in raw['companies'] if c.get('id')}
    jobs = sum(by[i].get('employees_est') or 0 for i in FLAGS)
    print('census-output-flags.json: %d rows flagged, %s jobs' % (len(FLAGS), f'{jobs:,}'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
