#!/usr/bin/env python3
"""Assemble a census slice record from verified lane outputs.

  python3 assemble.py <slice-name> <lane> [<lane> ...] [--drop id,id] [--today YYYY-MM-DD]

For each lane: reads wave/<lane>/out.json and, when present, wave/<lane>/verify/verdicts.json
(or wave/verify-<lane>/verdicts.json). DROP verdicts remove the row; FIX verdicts replace the named
fields; rows without a verdict are refused unless --unverified-ok. Writes
  ~/projects/pasar-vantis/data/census-adds/more-legit-2026-10-<slice>.json   (the census record)
  ~/projects/pasar-vantis/data/founders-work/out-more-legit-<slice>.json     (founder evidence)
and prints what went where.
"""
import json, os, sys, glob, datetime

WAVE = os.environ.get('CENSUS_WAVE', os.path.expanduser('~/census-wave'))
ROOT = os.path.expanduser('~/projects/pasar-vantis')


def opt(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        v = sys.argv[i + 1]
        del sys.argv[i:i + 2]
        return v
    return default


def main():
    drop = set((opt('--drop') or '').split(',')) - {''}
    today = opt('--today') or datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    unverified_ok = '--unverified-ok' in sys.argv
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    name, lanes = args[0], args[1:]
    rows, founders, rejected, closed, outside, notes = [], [], [], [], [], []
    for lane in lanes:
        out = json.load(open(os.path.join(WAVE, lane, 'out.json')))
        vfile = next((f for f in [os.path.join(WAVE, lane, 'verify', 'verdicts.json'),
                                  os.path.join(WAVE, 'verify-' + lane, 'verdicts.json')] if os.path.exists(f)), None)
        vdoc = json.load(open(vfile)) if vfile else {}
        verdicts = {v['id']: v for v in vdoc.get('verdicts', [])}
        fby = {f.get('id'): f for f in out.get('founders', [])}
        for r in out.get('rows', []) + [x for x in out.get('reversals', []) if x.get('id') and x.get('employees_est')]:
            v = verdicts.get(r['id'])
            if r['id'] in drop:
                print(f'  DROP (lead) {lane}/{r["id"]}')
                continue
            if v is None and not unverified_ok:
                print(f'  HELD (no verdict) {lane}/{r["id"]}')
                continue
            if v and v['verdict'] == 'DROP':
                print(f'  DROP {lane}/{r["id"]}: {v.get("why", "")[:160]}')
                continue
            if v and v['verdict'] == 'FIX':
                fx = dict(v.get('fixes') or {})
                fe_new = fx.pop('founders_entry', None)
                if isinstance(fe_new, dict):
                    fe_new.setdefault('id', r['id'])
                    fby[r['id']] = dict(fby.get(r['id'], {}), **fe_new)
                    print(f'       founders entry replaced from fixes ({fe_new.get("status")})')
                for k, val in fx.items():
                    r[k] = val
                print(f'  FIX  {lane}/{r["id"]}: {", ".join((v.get("fixes") or {}).keys())}')
            else:
                for k, val in ((v or {}).get('fixes') or {}).items():
                    if k != 'founders_entry':
                        r[k] = val
                print(f'  KEEP {lane}/{r["id"]}' + (f' (+{", ".join((v or {}).get("fixes") or {})})' if (v or {}).get('fixes') else ''))
            r['added'] = today
            r['liveness_checked'] = today
            r.pop('_group', None)
            rows.append(r)
            if r['id'] in fby:
                fe = dict(fby[r['id']])
                if v and isinstance(v.get('founders_fix'), dict):
                    fe.update({k: val for k, val in v['founders_fix'].items() if k != 'id'})
                    print(f'       founders entry fixed: {", ".join(k for k in v["founders_fix"] if k != "id")}')
                founders.append(fe)
        rejected += [dict(e, lane=lane) for e in out.get('rejected', [])]
        # only fact-checked closure entries reach the register (full shape, two sources)
        for e in vdoc.get('closed', []):
            if e.get('fate') in ('closed', 'acquired-then-closed') and len(e.get('sources') or []) >= 2 and e.get('why'):
                closed.append(e)
            else:
                print(f'  CLOSED REFUSED {lane}/{e.get("name")}: incomplete entry')
        for e in vdoc.get('closed_dropped', []):
            print(f'  CLOSED DROPPED {lane}/{e.get("name")}: {str(e.get("why"))[:120]}')
        if out.get('notes'):
            notes.append(f'{lane}: {out["notes"]}')
    rec = {'wave': 'more-legit-2026-10', 'decided': today,
           'why': ('Luca, 18 Oct 2026 WIB (17 Oct UTC), on 1001startup.id/startups: "get more and more legit startups". '
                   f'Slice {name}: rows from research lanes {", ".join(lanes)} (fund portfolios, pending rosters, '
                   'licensed-fintech lists and 2025-2026 funding news), each researched to the census tests and then '
                   'checked by a second, independent fact-check before publishing.'),
           'source': None, 'rows': rows, 'rejected_record': rejected, 'closed_add': closed, 'lane_notes': notes}
    path = os.path.join(ROOT, 'data', 'census-adds', f'more-legit-2026-10-{name}.json')
    json.dump(rec, open(path, 'w'), ensure_ascii=False, indent=1)
    fpath = os.path.join(ROOT, 'data', 'founders-work', f'out-more-legit-{name}.json')
    json.dump(founders, open(fpath, 'w'), ensure_ascii=False, indent=1)
    print(f'wrote {path}: {len(rows)} rows, {len(rejected)} rejected, {len(closed)} closed')
    print(f'wrote {fpath}: {len(founders)} founder entries')


main()
