#!/usr/bin/env python3
"""Merge reviewed founder evidence into data/census-founders.json (the side
file build-census.js reads). Reviewers write data/founders-work/out-*.json
under data/founders-work/BRIEF.md; this script re-checks their output against
the publishing rule mechanically, so a reviewer's mistake cannot reach a page:

  - aggregator sources are dropped (Crunchbase, Tracxn, theorg, Wikipedia…)
  - a name list publishes only with: a source on the company's own domain (or
    its LinkedIn company page), OR two independent non-aggregator sources on
    different hosts, OR an Endeavor source plus one more
  - every kept source needs a quote; notes are scrubbed of tool words
  - founded years outside 1980..this year are dropped

    python3 scripts/census-founders-merge.py [--dry-run]
"""
import glob, json, os, re, sys, urllib.parse, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.path.join(ROOT, 'data', 'founders-work')
OUT = os.path.join(ROOT, 'data', 'census-founders.json')
CENSUS = os.path.join(ROOT, 'public', 'data', 'census.json')

AGG = re.compile(r'(crunchbase|tracxn|cbinsights|pitchbook|dealroom|theorg\.com|founders\.io|zoominfo|rocketreach|apollo\.io|'
                 r'owler|craft\.co|golden\.com|wikidata|wikipedia\.org|signalhire|leadiq|startupranking|seedtable|latka|growjo|'
                 r'glassdoor|startupintros|thecompanycheck|f6s\.com|clay\.com|contactout|lusha|datanyze|cbinsight|tofler|'
                 r'privco|getlatka|kompass|dnb\.com|bizdb|idx\.id-company|startupblink)', re.I)
WIRES = re.compile(r'(prnewswire|businesswire|globenewswire|prnasia|newswire\.id|accesswire)', re.I)
TOOLWORDS = re.compile(r'\b(exa|snippet|search(?:es|ed)?|agent|chunk|budget|scrap(?:e|ed|ing)|crawl|webfetch|curl|evidence file)\b', re.I)
TITLES = re.compile(r'^(dr|ir|prof|h|hj|mr|mrs|ms|bapak|ibu|pak|bu)\.?\s+', re.I)

# Editorial exclusions after reading the reviewers' doubts (7 Oct 2026). Each
# passed the mechanical rule but the statement behind it is weaker than the
# page would make it look; they stay off until a clearer source turns up.
EXCLUDE = {
    'amar-bank': 'the 1991 family behind the original bank licence, not founders of the digital bank',
    'good-doctor-technology-indonesia': '"led by Danu Wicaksana and his co-founders" does not say who founded it',
    'elitery': 'the bio says he founded "his own company", not Elitery by name',
    'strongbee': 'the full name was assembled from two partial spellings',
}


def host(u):
    try:
        h = (urllib.parse.urlparse(u).hostname or '').lower()
    except ValueError:
        return ''
    return h[4:] if h.startswith('www.') else h


def reg(h):
    """registrable-ish domain: last two labels, three for *.co.id / *.ac.id / *.com.sg style"""
    parts = h.split('.')
    if len(parts) >= 3 and parts[-2] in ('co', 'ac', 'or', 'go', 'com', 'net', 'web', 'my', 'sch'):
        return '.'.join(parts[-3:])
    return '.'.join(parts[-2:])


def main():
    dry = '--dry-run' in sys.argv
    census = json.load(open(CENSUS))
    rows = {c['id']: c for c in census['companies']}
    this_year = datetime.date.today().year
    kept, rejected, seen = {}, [], set()
    stats = {'ok_in': 0, 'kept': 0, 'insufficient': 0, 'not_applicable': 0}
    # first-pass reviews, then the check pass over the most-visited companies
    # (check-out-*.json, CHECK.md) replaces those entries wholesale
    entries = {}
    for f in sorted(glob.glob(os.path.join(WORK, 'out-*.json'))):
        for e in json.load(open(f)):
            if e.get('id') and e['id'] not in entries:
                entries[e['id']] = e
    checked = 0
    for f in sorted(glob.glob(os.path.join(WORK, 'check-out-*.json'))):
        for e in json.load(open(f)):
            if e.get('id'):
                entries[e['id']] = e
                checked += 1
    if checked:
        print(f'check pass applied to {checked} companies')
    # a company queued for the check pass (check-in-*.json) is held back until
    # its check is in: the first pass missed founders on exactly these pages
    checked_ids = set()
    for f in sorted(glob.glob(os.path.join(WORK, 'check-out-*.json'))):
        checked_ids |= {e.get('id') for e in json.load(open(f))}
    held = set()
    for f in sorted(glob.glob(os.path.join(WORK, 'check-in-*.json'))):
        held |= {e.get('id') for e in json.load(open(f))} - checked_ids
    for h in held:
        entries.pop(h, None)
    if held:
        print(f'held until checked: {len(held)}')
    for e in entries.values():
            cid = e.get('id')
            if cid in seen:
                continue
            seen.add(cid)
            st = e.get('status')
            if st != 'ok':
                stats[st if st in stats else 'insufficient'] = stats.get(st if st in stats else 'insufficient', 0) + 1
                continue
            stats['ok_in'] += 1
            c = rows.get(cid)
            if not c:
                rejected.append((cid, 'not a census id')); continue
            if cid in EXCLUDE:
                rejected.append((cid, 'excluded: ' + EXCLUDE[cid])); continue
            names = []
            for n in e.get('founders') or []:
                n = TITLES.sub('', str(n).strip()).strip(' ,.;')
                if n and len(n) <= 60 and n not in names:
                    names.append(n)
            if not names or len(names) > 8:
                rejected.append((cid, f'{len(names)} names')); continue
            srcs = []
            for s in e.get('sources') or []:
                u = (s.get('url') or '').strip()
                if not u.startswith('http') or AGG.search(u) or not (s.get('quote') or '').strip():
                    continue
                srcs.append({'url': u, 'kind': s.get('kind') or 'press', 'host': host(u)})
            own = reg(host(c.get('url') or '')) if c.get('url') else ''
            stem = own.split('.')[0] if own else ''
            # the company speaking: its own domain, a sibling domain carrying the
            # same brand (kredivo.com -> kredivocorp.com), its LinkedIn company
            # page, or its own release on a newswire
            own_src = [s for s in srcs if (own and reg(s['host']) == own)
                       or (len(stem) >= 4 and stem in reg(s['host']).split('.')[0])
                       or re.search(r'linkedin\.com/company/', s['url'])
                       or (WIRES.search(s['host']) and s['kind'] == 'company')]
            hosts = {reg(s['host']) for s in srcs if s['host']}
            endeavor = [s for s in srcs if 'endeavor.org' in s['host']]
            if not (own_src or len(hosts) >= 2 or (endeavor and len(hosts) >= 2)):
                rejected.append((cid, f'sources fail the rule ({", ".join(sorted(hosts)) or "none"})')); continue
            note = (e.get('note') or '').strip()
            if TOOLWORDS.search(note):
                note = ''
            yr = e.get('founded')
            try:
                yr = int(yr) if yr is not None else None
            except (TypeError, ValueError):
                yr = None
            if yr is not None and not (1980 <= yr <= this_year):
                yr = None
            # own-domain sources first, then the rest; at most four kept
            order = own_src + [s for s in srcs if s not in own_src]
            kept[cid] = {'founders': names, 'founded': yr, 'sources': [s['url'] for s in order][:4], 'note': note}
            stats['kept'] += 1
    print(f"reviewed: {len(seen)} · ok in: {stats['ok_in']} · kept: {stats['kept']} · insufficient: {stats['insufficient']} · not applicable: {stats['not_applicable']} · rejected: {len(rejected)}")
    for r in rejected:
        print('  REJECT', r[0], '—', r[1])
    missing = sorted(set(rows) - seen)
    if missing:
        print(f'  not reviewed yet: {len(missing)}')
    if dry:
        print('dry run: nothing written'); return
    out = {'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
           'rule': "Founder names publish only with the company's own page, or two independent reputable sources, or Endeavor plus one more; aggregators never count.",
           'companies': kept}
    tmp = OUT + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, indent=1)
    os.replace(tmp, OUT)
    print('wrote', OUT, len(kept))


if __name__ == '__main__':
    main()
