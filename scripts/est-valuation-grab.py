#!/usr/bin/env python3
"""Carve an INDONESIA-ONLY valuation out of Grab Holdings' market capitalisation.

Luca, 29 Aug 2026: "it is weird you dont include grab whereas you involve j&t
etc the global company with global valuation, but remember that it needs
indonesian only value/job totals and it is also need as the worker company not
mitra/freelancer (so driver is not being calculates for it)."

Grab is the one global-parent row where a carve-out can be anchored on a
DISCLOSED Indonesian figure rather than an assumed country share: the Form 20-F
reports revenue by country, and Indonesia is a line in that table. Everything
else here is arithmetic on audited numbers plus one named assumption — that a
dollar of Indonesian revenue carries the same enterprise multiple as a dollar of
Malaysian or Singaporean revenue.

Compare scripts/est-valuation-tiket.py, which had to reason a carve-out out of a
segment that was never reported. This one does not.

Run: python3 scripts/est-valuation-grab.py
"""

# ---- sourced inputs --------------------------------------------------------
# Form 20-F FY2025 (filed 2026), "Revenue by geographical locations", US$m
REV = {'Indonesia': 715, 'Malaysia': 1_039, 'Philippines': 316, 'Singapore': 727,
       'Thailand': 288, 'Vietnam': 255, 'Rest of Southeast Asia': 30}
REV_TOTAL = 3_370                      # 20-F, same table
MCAP_USD_M = 14_720                    # stockanalysis.com, 28 Aug 2026
# ESG Report 2025 (GRI 2-7) / 20-F Item 6.D, group headcount at 31 Dec 2025
FTE = 12_012
FTE_EVERRISE = 865                     # supermarket chain in Malaysia, acquired Mar 2025
FTE_INFERMOVE = 22                     # AI robotics startup in China, acquired Dec 2025
FIXED_TERM = 1_242                     # group-wide, not allocated
TEMP_AGENCY = 3_956                    # group-wide, not allocated

# ---- named assumptions -----------------------------------------------------
# 1. EQUAL MULTIPLE. Grab reports adjusted EBITDA by business segment, never by
#    country, so there is no published way to weight Indonesia by profitability.
#    Indonesia is Grab's lower-margin market, so this most likely OVERSTATES it.
# 2. HEADCOUNT TRACKS REVENUE. Grab publishes no country headcount. Everrise
#    (Malaysia) and Infermove (China) are removed first because they are known
#    to sit outside the revenue-following pool.

share = REV['Indonesia'] / REV_TOTAL
print('INPUTS')
print(f'  group revenue FY2025      US${REV_TOTAL:,}M')
for k, v in sorted(REV.items(), key=lambda kv: -kv[1]):
    print(f'    {k:<24} US${v:>6,}M  {v/REV_TOTAL:6.1%}' + ('   <- carve-out basis' if k == 'Indonesia' else ''))
print(f'  market capitalisation     US${MCAP_USD_M:,}M  (28 Aug 2026)')
print(f'  group full-time employees {FTE:,}  (less {FTE_EVERRISE} Everrise MY, {FTE_INFERMOVE} Infermove CN)')

print('\nVALUATION — equal-multiple carve-out')
raw_val = MCAP_USD_M * share
point = int(raw_val // 50 * 50)        # round DOWN: assumption 1 leans generous
print(f'  US${MCAP_USD_M:,}M x {share:.4f} = US${raw_val:,.0f}M -> published US${point:,}M')
for s in (0.15, share, 0.25):
    print(f'    if Indonesia is {s:5.1%} of group value: US${MCAP_USD_M*s:,.0f}M')

print('\nJOBS — payroll only, partners excluded')
pool = FTE - FTE_EVERRISE - FTE_INFERMOVE
raw_emp = pool * share
emp = int(raw_emp // 50 * 50)
print(f'  allocable full-time employees {pool:,}')
print(f'  {pool:,} x {share:.4f} = {raw_emp:,.0f} -> published {emp:,}')
print(f'  NOT counted: driver-partners and merchant-partners (Grab\'s own filings call them')
print(f'               independent partners, not employees) — this is the census rule that')
print(f'               a mitra is not a job. Also excluded: {FIXED_TERM:,} fixed-term and')
print(f'               {TEMP_AGENCY:,} temporary agency workers, reported group-wide only.')

print('\nCONTAINMENT')
print('  OVO (PT Visionet Internasional) is ~90% Grab-owned and consolidated, so its value')
print('  sits INSIDE this carve-out. The OVO row is held out of the combined valuation the')
print('  same way tiket.com is held out of Blibli\'s.')
