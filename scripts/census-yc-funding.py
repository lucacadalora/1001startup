#!/usr/bin/env python3
"""YC-cohort funding validation pass (Aug 29 2026, Luca: "they usually get 500k
funding, you need to validate this").

Ground truth on the YC standard deal, per YC's own blog:
  - Jan 2022 onward (FIRST batch: W22): US$500K total = $125K for 7% + $375K
    MFN uncapped SAFE — https://www.ycombinator.com/blog/ycs-500-000-standard-deal
  - S18–W20: $150K for 7%;  S20–S21: $125K for 7%  (so Pahamify W20 = 0.15 and
    Titipku S21 = 0.125 are correct as-is and are NOT touched here).

Validated against trackers (CB Insights / Seedtable / e27 / press) Aug 29 2026:
Dealls, StafBook, Jutsoo, Jack/Transfez at exactly 0.5 CONFIRMED (no disclosed
round beyond YC; EV/BEENEXT seed for Transfez is amount-undisclosed). Sekilo 3.0
(=2.5 Forge Ventures pre-A + 0.5 YC) and Materee 3.6 (=3.1 seed + 0.5 YC; CB's
3.5 rejected as aggregator noise) left alone.

Fixes applied here (idempotent — safe to re-run):
  latent-space  null  -> 0.5   S22 standard deal; the $6M "Halo AI" (MENA co)
                               and $8M "Latent Space" (US co) tracker rounds are
                               NAMESAKES, not this company.
  whiz          0.125 -> 0.5   W22 = $500K era; thecompanycheck's $125K applies
                               the pre-2022 deal (and its "Surge" investor claim
                               is uncorroborated anywhere — dropped).
  proglix       1.5   -> 1.85  disclosed $1.35M seed (e27, Feb 2023) + $500K YC
                               W23; CB Insights total $1.85M agrees.
"""
import json, sys

RAW = '/home/ubuntu/projects/pasar-vantis/data/census-raw.json'
YC_DEAL = 'https://www.ycombinator.com/blog/ycs-500-000-standard-deal'

UPDATES = {
    'latent-space': dict(
        funding_total_usd_m=0.5,
        last_round='Seed (Y Combinator S22 standard deal — US$125K + US$375K MFN SAFE; no other disclosed round)',
        last_round_year=2022,
        add_sources=[YC_DEAL],
        note_add='Funding validated Aug 29 2026: S22 standard deal = US$500K. The US$6M round tagged "Halo AI" (MENA namesake) and the US$8M "Latent Space" round (US namesake, startupintros) do NOT belong to this company.',
    ),
    'whiz': dict(
        funding_total_usd_m=0.5,
        last_round='Seed (Y Combinator W22 standard deal — US$125K + US$375K MFN SAFE)',
        last_round_year=2022,
        add_sources=[YC_DEAL],
        investors=['Y Combinator'],
        note_add='Funding corrected Aug 29 2026: W22 was the FIRST US$500K-deal batch, so thecompanycheck\'s US$125K applies the pre-2022 deal and is wrong; its uncorroborated "Surge" investor claim dropped with it.',
    ),
    'proglix': dict(
        funding_total_usd_m=1.85,
        last_round='Seed (US$1.35M, Feb 2023, e27/Tech in Asia) + Y Combinator W23 standard deal US$500K',
        last_round_year=2023,
        add_sources=['https://e27.co/proglix-secures-us1-35m-to-make-raw-material-procurement-easy-for', YC_DEAL],
        note_add='Funding corrected Aug 29 2026: disclosed US$1.35M seed + US$500K YC W23 = US$1.85M (CB Insights total agrees); previous 1.5 undercounted.',
    ),
}

raw = json.load(open(RAW))
changed = 0
for c in raw['companies']:
    u = UPDATES.get(c.get('id'))
    if not u:
        continue
    before = c.get('funding_total_usd_m')
    if before == u['funding_total_usd_m'] and u['note_add'] in (c.get('verify_note') or ''):
        print(f"{c['id']}: already applied (funding={before})")
        continue
    c['funding_total_usd_m'] = u['funding_total_usd_m']
    c['last_round'] = u['last_round']
    c['last_round_year'] = u['last_round_year']
    if 'investors' in u:
        c['investors'] = u['investors']
    srcs = c.get('sources') or []
    for s in u['add_sources']:
        if s not in srcs:
            srcs.append(s)
    c['sources'] = srcs
    vn = c.get('verify_note') or ''
    if u['note_add'] not in vn:
        c['verify_note'] = (vn + ' ' + u['note_add']).strip()
    print(f"{c['id']}: funding {before} -> {u['funding_total_usd_m']}")
    changed += 1

if changed:
    json.dump(raw, open(RAW, 'w'), ensure_ascii=False)
    print(f'wrote {RAW} ({changed} rows updated)')
else:
    print('no changes needed')
