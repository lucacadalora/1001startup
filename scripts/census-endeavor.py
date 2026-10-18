#!/usr/bin/env python3
"""Tag the Endeavor Indonesia cohort in data/census-raw.json.

Endeavor selects ENTREPRENEURS, not companies: founders pass an International
Selection Panel and join the network for life; their company then appears on
Endeavor Indonesia's Entrepreneur-Companies roster. So the tag is founder-level
in meaning and company-level in storage, exactly like yc_batch.

Source of truth: Endeavor Indonesia's OWN site. It runs WordPress and exposes
the roster as a custom post type, so the list is read from the REST API rather
than scraped:
    https://indonesia.endeavor.org/wp-json/wp/v2/company?per_page=100
-> 51 companies, snapshotted to data/endeavor-roster.json. (The matching
`profile` type holds 95 entrepreneurs, but the profile->company link lives only
in JS-rendered markup, so founder names are filled in where a profile bio names
its company and left empty otherwise — never guessed.)

What this does:
  1. sets `endeavor: True` on every census company on the roster,
  2. records the founders where Endeavor's own copy names them,
  3. keeps the 32 roster companies that are NOT in the census in
     `endeavor_pending` so the gap is visible instead of silently dropped,
  4. stamps `endeavor_source` for the page's provenance line.

Idempotent: re-running only refreshes the tags.
    python3 scripts/census-endeavor.py && node scripts/build-census.js
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
ROSTER = os.path.join(HERE, '..', 'data', 'endeavor-roster.json')
CHECKED = '2026-08-29'

# census id -> Endeavor roster slug. Pinned rather than fuzzy-matched so a
# rename on either side fails loudly instead of tagging the wrong company.
ON_ROSTER = {
    'idn': 'idn', 'chickin': 'chickin', 'paper-id': 'paper-id', 'astro': 'astro',
    'pinhome': 'pinhome', 'pasarpolis': 'pasarpolis', 'paxel': 'paxel',
    'bukalapak': 'bukalapak', 'shipper': 'shipper', 'kata-ai': 'kata-ai',
    'kargo-technologies': 'kargo', 'kopi-kenangan': 'kopi-kenangan',
    'kredivo': 'kredivo', 'privy': 'privyid',
    'female-daily-network': 'female-daily-network', 'dana': 'dana',
    'vida': 'vida', 'waresix': 'waresix', 'aruna': 'aruna',
    # added Aug 29 2026 with the company itself (scripts/census-gap3.py): it had
    # been sitting in endeavor_pending as a visible gap since this pass ran.
    'kitabisa': 'kitabisa-com',
    # the roster's "Funding Societies" IS the census's Modalku row (PT Mitrausaha
    # Indonesia Grup, the group's Indonesian entity) — it was rendering as a gap on
    # the page while the company was already counted.
    'modalku': 'funding-societies',
    # Aug 30 2026: the four Bandung roster names were listed as gaps for one
    # reason only — the census stopped at Greater Jakarta. They entered with
    # scripts/census-bandung.py, so they leave endeavor_pending here.
    'bobobox': 'bobobox', 'evermos': 'evermos', 'agate': 'agate', 'brodo': 'brodo',
    # Oct 18 2026: roster companies researched into the census by the
    # "more legit startups" wave (data/census-adds/more-legit-2026-10-*.json).
    'happyfresh': 'happyfresh', 'onlinepajak': 'online-pajak', 'tada': 'tada',
}
# founders Endeavor's own profile copy attributes to a roster company. Only
# entries the source states; the rest stay empty rather than inferred.
FOUNDERS = {
    'astro': ['Vincent Tjendra', 'Jessica Stephanie Jap', 'Marcella Moniaga'],
    # Endeavor's own profile pages, read 18 Oct 2026: indonesia.endeavor.org/profiles/charles-guinot/
    # (selected Sep 2016, Boston) and /profiles/antonius-taufan/ (selected Aug 2014, NYC).
    'online-pajak': ['Charles Guinot'],
    'tada': ['Antonius Taufan'],
}

raw = json.load(open(RAW))
roster = json.load(open(ROSTER))
by_slug = {r['slug']: r for r in roster}

tagged = []
for c in raw['companies']:
    slug = ON_ROSTER.get(c.get('id'))
    if not slug:
        # a re-run must not leave a stale tag on a company that left the roster
        for k in ('endeavor', 'endeavor_entrepreneurs', 'endeavor_note'):
            c.pop(k, None)
        continue
    c['endeavor'] = True
    who = FOUNDERS.get(slug, [])
    if who:
        c['endeavor_entrepreneurs'] = who
        c['endeavor_note'] = ', '.join(who) + ' — Endeavor Entrepreneur' + ('s' if len(who) > 1 else '')
    else:
        c.pop('endeavor_entrepreneurs', None)
        c['endeavor_note'] = 'On Endeavor Indonesia’s Entrepreneur-Companies roster'
    tagged.append(c['name'])

matched_slugs = set(ON_ROSTER.values())
raw['endeavor_pending'] = [
    {'name': r['name'], 'slug': r['slug'],
     'url': 'https://indonesia.endeavor.org/company/' + r['slug'],
     'blurb': r['desc'][:160]}
    for r in roster if r['slug'] not in matched_slugs
]
raw['endeavor_source'] = {
    'name': 'Endeavor Indonesia — Entrepreneur Companies',
    'url': 'https://indonesia.endeavor.org/',
    'api': 'https://indonesia.endeavor.org/wp-json/wp/v2/company',
    'checked': CHECKED,
    'roster_count': len(roster),
}
json.dump(raw, open(RAW, 'w'), ensure_ascii=False)
missing = [s for s in ON_ROSTER if not any(c.get('id') == s for c in raw['companies'])]
print(f'endeavor: tagged {len(tagged)} census companies; '
      f'{len(raw["endeavor_pending"])} roster companies pending assessment'
      + (f'; MISSING census ids: {missing}' if missing else ''))
