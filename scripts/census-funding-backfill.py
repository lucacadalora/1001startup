#!/usr/bin/env python3
"""census-funding-backfill.py — end the unexplained dash in the funding column.

Aug 30 2026: 130 of the 378 census rows carried funding_total_usd_m = null with no
funding_note, so the site printed a bare "—" that told a reader nothing — it could
equally have meant "never raised", "raised, amount never published", or "nobody
looked". Luca: "it seems more than 100+ company we havent put the funding details
... dont guess, make a closest data/info available with flag if needed."

This applies the researched result of that sweep: a figure where a page states one,
and otherwise a sourced sentence saying WHY there is no figure, plus a machine
readable funding_status so the site can say which kind of nothing it is.

  disclosed      a private round with a published amount
  partial        some rounds published, others not — the sum is a FLOOR
  undisclosed    the round demonstrably happened; no amount was ever published
  none_on_record no outside round exists, and the search that establishes that is
                 named in the note
  parent_funded  the capital was raised by a parent/group; not an Indonesian figure
  listed         capital came from public markets — deliberately NOT summed into the
                 venture column, with the proceeds carried in the note instead
  debt_only      only debt facilities disclosed; debt is never equity
  grant_only     only grants or prizes disclosed

Nulls-only: an existing funding_total_usd_m, funding_note or funding_src is never
overwritten, so a hand judgement made in census-row-fix.py survives this sweep.
Idempotent — re-running changes nothing.
"""
import json, os, sys, tempfile, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
ASOF = '2026-08-30'

VALID_STATUS = {'disclosed', 'partial', 'undisclosed', 'none_on_record',
                'parent_funded', 'listed', 'debt_only', 'grant_only'}
VALID_TIER = {'company', 'filing', 'announced', 'tracker'}


def load_result(path):
    """The workflow returns {findings:[...], verdicts:[...]}. Fold the verdicts in:
    CONFIRMED keeps the finding, CORRECTED replaces the fields the checker fixed,
    REFUTED strips the number back to a dash but keeps the checker's reasoning as
    the note — a refuted figure is still a fact about the company."""
    r = json.load(open(path))
    findings = {f['id']: dict(f) for f in r.get('findings', [])}
    applied = {'CONFIRMED': 0, 'CORRECTED': 0, 'REFUTED': 0, 'orphan': 0}
    for v in r.get('verdicts', []):
        f = findings.get(v['id'])
        if not f:
            applied['orphan'] += 1
            continue
        f['verdict'] = v['verdict']
        f['verdict_reason'] = v.get('reason')
        if v['verdict'] == 'CORRECTED':
            if 'corrected_funding_total_usd_m' in v:
                f['funding_total_usd_m'] = v['corrected_funding_total_usd_m']
            for a, b in (('corrected_funding_status', 'funding_status'),
                         ('corrected_funding_note', 'funding_note'),
                         ('corrected_funding_src', 'funding_src'),
                         ('corrected_funding_src_tier', 'funding_src_tier')):
                if v.get(a):
                    f[b] = v[a]
            f['funding_src_all'] = sorted(set(f.get('funding_src_all') or []) | set(v.get('evidence_urls') or []))
        elif v['verdict'] == 'REFUTED':
            f['funding_total_usd_m'] = None
            f['funding_src'] = None
            f['funding_src_tier'] = None
            if v.get('corrected_funding_note'):
                f['funding_note'] = v['corrected_funding_note']
            if v.get('corrected_funding_status') in VALID_STATUS:
                f['funding_status'] = v['corrected_funding_status']
            elif f.get('funding_status') in ('disclosed', 'partial'):
                f['funding_status'] = 'undisclosed'
            f['funding_src_all'] = sorted(set(f.get('funding_src_all') or []) | set(v.get('evidence_urls') or []))
        applied[v['verdict']] = applied.get(v['verdict'], 0) + 1
    return findings, applied


# Figures the sweep produced that the census's own rule does not let it print. The rule is
# settled precedent — Stockbit's CB Insights US$25M, bittime's thecompanycheck US$2M, Balesin,
# Garasi.id and Catapa all kept a dash rather than a tracker-only number — and the adversarial
# pass applied it itself when it killed Koltiva's PitchBook US$7.56M and Lister's US$100K.
# These two arrived on the same footing, so they get the same answer. The note survives intact:
# it is more informative than the number, because it says which tracker claims what.
TRACKER_ONLY = {
    'aido-health': 'HealthTech Alpha and one other tracker carry US$0.30M; Tracxn says unfunded. '
                   'No announcement, no named investor, and the trackers contradict each other.',
    'carenow': 'Tracxn carries US$150K against Iterative and Caplight splits the same history into '
               'three different events. The figure matches Iterative’s standard batch cheque '
               'rather than anything CareNow disclosed — the reason Lister’s Antler '
               'US$100K was refuted in the same sweep.',
}


def merge(row, f, report):
    """nulls-only field merge. Returns list of changed field names."""
    ch = []
    rid = row['id']

    amt = f.get('funding_total_usd_m')
    status = f.get('funding_status')
    note = (f.get('funding_note') or '').strip()

    if status not in VALID_STATUS:
        report.append(f'  ! {rid}: bad funding_status {status!r} — row skipped')
        return ch
    if not note:
        report.append(f'  ! {rid}: empty funding_note — row skipped')
        return ch

    if rid in TRACKER_ONLY and amt is not None:
        report.append(f'  - {rid}: US${amt}M withheld — {TRACKER_ONLY[rid]}')
        amt = None
        f = dict(f, funding_src=None, funding_src_tier=None)
        # `partial` and `disclosed` both describe a figure. With the figure withheld the
        # row is simply a round nobody sized, and saying "floor" with nothing to floor
        # would put a mark on the table pointing at an empty cell.
        if status in ('disclosed', 'partial'):
            status = 'undisclosed'

    # a number needs a source, always. sourced-or-withdrawn.
    if amt is not None:
        src = f.get('funding_src') or next(iter(f.get('funding_src_all') or []), None)
        if not src:
            report.append(f'  ! {rid}: US${amt}M with no source URL — figure DROPPED, note kept')
            amt = None
            if status == 'disclosed':
                status = 'undisclosed'
    if amt is not None and status not in ('disclosed', 'partial'):
        report.append(f'  ! {rid}: US${amt}M carried with status {status} — figure dropped to keep the column honest')
        amt = None

    if amt is not None and row.get('funding_total_usd_m') is None:
        row['funding_total_usd_m'] = round(float(amt), 2)
        row['funding_src'] = f.get('funding_src') or next(iter(f.get('funding_src_all') or []), None)
        tier = f.get('funding_src_tier')
        row['funding_src_tier'] = tier if tier in VALID_TIER else 'announced'
        ch += ['funding_total_usd_m', 'funding_src', 'funding_src_tier']

    if not row.get('funding_note'):
        row['funding_note'] = note
        ch.append('funding_note')

    if row.get('funding_status') != status:
        row['funding_status'] = status
        ch.append('funding_status')

    if not row.get('funding_asof'):
        row['funding_asof'] = ASOF
        ch.append('funding_asof')

    urls = [u for u in (f.get('funding_src_all') or []) if isinstance(u, str) and u.startswith('http')]
    if urls:
        merged = sorted(set(row.get('funding_src_all') or []) | set(urls))
        if merged != row.get('funding_src_all'):
            row['funding_src_all'] = merged
            ch.append('funding_src_all')

    lr, ly = f.get('last_round'), f.get('last_round_year')
    if lr and not row.get('last_round'):
        row['last_round'] = lr
        ch.append('last_round')
    if ly and not row.get('last_round_year'):
        row['last_round_year'] = int(ly)
        ch.append('last_round_year')
    elif ly and row.get('last_round_year') and int(ly) > int(row['last_round_year']):
        # a later round than the census knew about: take it, and take its label with it
        report.append(f'  ~ {rid}: later round found — {row["last_round_year"]} -> {ly}')
        row['last_round_year'] = int(ly)
        if lr:
            row['last_round'] = lr
        ch += ['last_round_year', 'last_round']

    inv = [i for i in (f.get('investors') or []) if isinstance(i, str) and i.strip()]
    if inv:
        have = {i.lower() for i in (row.get('investors') or [])}
        add = [i for i in inv if i.lower() not in have]
        if add:
            row['investors'] = (row.get('investors') or []) + add
            ch.append('investors')

    return ch


def main():
    if len(sys.argv) < 2:
        sys.exit('usage: census-funding-backfill.py <workflow-result.json> [--apply]')
    apply = '--apply' in sys.argv
    findings, verdict_counts = load_result(sys.argv[1])

    raw = json.load(open(RAW))
    by_id = {c['id']: c for c in raw['companies']}

    report = []
    touched = filled = explained = 0
    by_status = {}
    unknown = []
    for rid, f in findings.items():
        row = by_id.get(rid)
        if not row:
            unknown.append(rid)
            continue
        before = row.get('funding_total_usd_m')
        ch = merge(row, f, report)
        if ch:
            touched += 1
            if 'funding_total_usd_m' in ch and before is None:
                filled += 1
            elif 'funding_note' in ch:
                explained += 1
        by_status[row.get('funding_status')] = by_status.get(row.get('funding_status'), 0) + 1

    print(f'verdicts: {verdict_counts}')
    if unknown:
        print(f'ids not in census ({len(unknown)}): {", ".join(unknown)}')
    for line in report:
        print(line)
    print(f'\nrows touched {touched} — {filled} gained a real figure, {explained} gained a sourced explanation')
    print('status spread: ' + ', '.join(f'{k}={v}' for k, v in sorted(by_status.items(), key=lambda x: -x[1])))

    still_bare = [c['id'] for c in raw['companies']
                  if c.get('funding_total_usd_m') is None and not c.get('funding_note')]
    print(f'unexplained dashes remaining: {len(still_bare)}')
    if still_bare:
        print('  ' + ', '.join(still_bare[:40]))

    total = sum(c.get('funding_total_usd_m') or 0 for c in raw['companies'])
    n = sum(1 for c in raw['companies'] if c.get('funding_total_usd_m'))
    print(f'column total: US${total/1000:.1f}B across {n} rows')

    if apply:
        raw.setdefault('stats', {})['funding_backfill'] = {
            'date': ASOF,
            'rows_researched': len(findings),
            'figures_added': filled,
            'explanations_added': explained,
        }
        d = os.path.dirname(os.path.abspath(RAW))
        fd, tmp = tempfile.mkstemp(dir=d, suffix='.tmp')
        with os.fdopen(fd, 'w') as fh:
            json.dump(raw, fh, ensure_ascii=False, indent=1)
        os.replace(tmp, RAW)
        print(f'\nwrote {RAW}')
    else:
        print('\ndry run — pass --apply to write')


if __name__ == '__main__':
    main()
