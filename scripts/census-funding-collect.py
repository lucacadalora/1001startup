#!/usr/bin/env python3
"""census-funding-collect.py — fold a Workflow run's journal into one {findings, verdicts}.

The research workflow spawns a finder per batch and an adversarial checker behind it.
Each agent's return value lands in the run's journal.jsonl as a `result` record; this
pulls them out and merges them, so the apply step reads one file instead of depending on
the workflow's own return value surviving a resume or a restart.

  census-funding-collect.py <runDir|journal.jsonl> [-o out.json]

A finder result looks like {"findings":[...]}, a checker's like {"verdicts":[...]}.
Anything else in the journal is ignored. Duplicate ids keep the LAST result seen, which
is what a resumed run should produce.
"""
import json, os, sys

def rows(path):
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def unwrap(r):
    """agent() returns the validated object, but a journal entry may wrap it, and a
    schema-less agent returns a JSON string. Dig until we find findings/verdicts."""
    seen = 0
    while seen < 6:
        seen += 1
        if isinstance(r, str):
            try:
                r = json.loads(r)
                continue
            except json.JSONDecodeError:
                return None
        if isinstance(r, dict):
            if 'findings' in r or 'verdicts' in r:
                return r
            for k in ('result', 'value', 'output', 'data'):
                if k in r:
                    r = r[k]
                    break
            else:
                return None
        else:
            return None
    return None


def main():
    if len(sys.argv) < 2:
        sys.exit('usage: census-funding-collect.py <runDir|journal.jsonl> [-o out.json]')
    src = sys.argv[1]
    if os.path.isdir(src):
        src = os.path.join(src, 'journal.jsonl')
    out = sys.argv[sys.argv.index('-o') + 1] if '-o' in sys.argv else None

    findings, verdicts = {}, {}
    for e in rows(src):
        if e.get('type') != 'result':
            continue
        r = unwrap(e.get('result'))
        if not r:
            continue
        for f in (r.get('findings') or []):
            if isinstance(f, dict) and f.get('id'):
                findings[f['id']] = f
        for v in (r.get('verdicts') or []):
            if isinstance(v, dict) and v.get('id'):
                verdicts[v['id']] = v

    res = {'findings': list(findings.values()), 'verdicts': list(verdicts.values())}
    print(f'{len(findings)} findings, {len(verdicts)} verdicts from {src}')
    unchecked = [i for i, f in findings.items()
                 if (f.get('funding_total_usd_m') is not None
                     or f.get('funding_status') == 'none_on_record') and i not in verdicts]
    if unchecked:
        print(f'  ! {len(unchecked)} risky claims with no verdict: {", ".join(unchecked[:20])}')
    if out:
        json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
        print(f'wrote {out}')
    else:
        print('pass -o <file> to write')


if __name__ == '__main__':
    main()
