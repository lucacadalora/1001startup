#!/usr/bin/env python3
"""Write verified candidate records into the census.

Input is the output of the verification workflow: records that already passed a
liveness screen and then had entity, address, funding provenance and headcount
checked one by one. This script does the boring, dangerous part carefully:

  - re-reads census-raw.json immediately before writing (another session edits
    this same file — never hold it in memory across a long job),
  - dedupes on a normalised name AND on the legal entity, so "Sinbad" does not
    land twice as "Sinbad (Horizon Group)", and skips anything already in the
    `removed` register,
  - refuses records that are not accept=true or have no kota (any Indonesian
    kota since the census went nationwide on 28 Sep 2026; it used to be
    Greater Jakarta only),
  - assigns a stable slug id and stamps provenance (`added`, `source_batch`).

    python3 scripts/census-apply-verified.py <verified.json> [--dry-run]
    node scripts/build-census.js
"""
import json, os, re, sys
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'data', 'census-raw.json')

FIELDS = ['name', 'legal_name', 'sector', 'in_dki', 'hq_address', 'kecamatan', 'kota', 'url',
          'funding_total_usd_m', 'last_round', 'last_round_year', 'valuation_usd_m',
          'valuation_note', 'employees_est', 'employees_note', 'investors', 'sources',
          'confidence', 'verify_note']


def slug(name):
    s = re.sub(r'^pt\.?\s+', '', name.lower())
    s = re.sub(r'\s*\(.*?\)', '', s)
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:40] or 'x'


def norm(x):
    s = re.sub(r'\(.*?\)', ' ', str(x or '').lower())
    s = re.sub(r'\b(pt|tbk|indonesia|group|technologies|technology|teknologi|com|id)\b', ' ', s)
    return re.sub(r'[^a-z0-9]', '', s)


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    src = sys.argv[1]
    dry = '--dry-run' in sys.argv
    incoming = json.load(open(src, encoding='utf-8'))
    if isinstance(incoming, dict):
        incoming = incoming.get('accepted') or incoming.get('records') or []

    raw = json.load(open(RAW, encoding='utf-8'))   # read late, write immediately
    cos = raw['companies']
    known = {norm(c.get('name')) for c in cos} | {norm(c.get('legal_name')) for c in cos}
    known |= {norm(r.get('name')) for r in raw.get('removed', [])}
    ids = {c.get('id') for c in cos}

    added, skipped = [], []
    for r in incoming:
        nm = r.get('name') or r.get('candidate_name')
        if not r.get('accept'):
            skipped.append((nm, 'not accepted: ' + str(r.get('reject_reason'))[:70])); continue
        if norm(nm) in known or norm(r.get('legal_name')) in known:
            skipped.append((nm, 'already in the census (or already removed)')); continue
        kota = r.get('kota') or ''
        # Nationwide since 28 Sep 2026: any Indonesian kota is in scope. The kota is
        # still required — lib/metros1001.js files a row with none under Jakarta.
        if not kota.strip():
            skipped.append((nm, 'no kota recorded')); continue
        rec = {k: r.get(k) for k in FIELDS if k in r}
        rec['name'] = nm
        rec['id'] = slug(nm)
        n = 2
        while rec['id'] in ids:
            rec['id'] = f"{slug(nm)}-{n}"; n += 1
        ids.add(rec['id'])
        rec['added'] = date.today().isoformat()
        rec['source_batch'] = os.path.basename(src)
        known.add(norm(nm))
        added.append(rec)

    print(f"{len(incoming)} incoming -> {len(added)} to add, {len(skipped)} skipped")
    for nm, why in skipped:
        print(f"  skip  {str(nm)[:34]:34} {why}")
    for rec in added:
        print(f"  ADD   {rec['name'][:34]:34} {rec['kota'][:18]:18} "
              f"funding={rec.get('funding_total_usd_m')} emp={rec.get('employees_est')}")
    if dry:
        print("\n(dry run — nothing written)"); return
    cos.extend(added)
    json.dump(raw, open(RAW, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"\nwritten: census now {len(cos)} companies")
    print("next: node scripts/geocode-census.js 60 && python3 scripts/census-icons.py && node scripts/build-census.js")


if __name__ == '__main__':
    main()
