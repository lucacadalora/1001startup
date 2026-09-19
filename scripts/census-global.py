#!/usr/bin/env python3
"""Global-parent rows: put the foreign groups' INDONESIAN operations in the census.

Luca, 29 Aug 2026: "it is weird you dont include grab whereas you involve j&t
etc the global company with global valuation, but remember that it needs
indonesian only value/job totals and it is also need as the worker company not
mitra/freelancer (so driver is not being calculates for it)."

He is right twice over. Grab is dual-headquartered in Jakarta by its own annual
report and was missing entirely; and J&T sat at the top of the table carrying its
HKEX group market capitalisation, a figure whose largest single component is
China. This script fixes both, under one rule that now applies to every row of
this kind:

  A foreign group's Indonesian operation is IN the census — it is a Jakarta
  company with a Jakarta head office and Indonesian staff. What is counted is
  the Indonesian slice and nothing else:

    · VALUE  — an Indonesia-only figure is published only when the group
               discloses a basis to carve one from (Grab's Form 20-F reports
               revenue by country). Where it does not, the cell is "—" and the
               note says what the group is worth and why that is not the same
               claim. A group market capitalisation is never reprinted as an
               Indonesian valuation.
    · FUNDING — capital raised by the group for a region is not Indonesian
               funding. "—", with the round named in the note.
    · JOBS   — people on an Indonesian payroll. Driver-, courier-, merchant- and
               seller-partners are mitra, not employees, and are not counted;
               this is the census's existing gig-worker exclusion, stated
               row-by-row because on these companies it is the whole question.

Carve-out arithmetic lives in scripts/est-valuation-grab.py, and is quoted in
the row's valuation_note so the page can show the working on hover.

Idempotent: upserts by id and re-applies the overrides, so it can be re-run
after another session rewrites census-raw.json (which happens — see the repo's
single-writer note). Run: python3 scripts/census-global.py
"""
import datetime
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
TODAY = '2026-08-29'

GRAB_SRC = [
    'https://www.sec.gov/Archives/edgar/data/1855612/000185561226000020/ck0001855612-20251231.htm',
    'https://s205.q4cdn.com/179588156/files/doc_downloads/2026/06/Grab-ESG-Report-2025.pdf',
    'https://stockanalysis.com/stocks/grab/market-cap/',
    'https://lei.bloomberg.com/leis/view/984500862C3E2EB78147',
    'https://ekonomi.bisnis.com/read/20220719/47/1556581/ini-alasan-grab-pindah-kantor-ke-kawasan-south-quarter',
]

NEW = [
    {
        'name': 'Grab Indonesia (Grab Holdings)',
        'legal_name': 'PT Grab Teknologi Indonesia',
        'sector': 'mobility — ride-hailing, food and financial services superapp',
        'in_dki': True,
        'hq_address': ('South Quarter Tower C, Mezzanine & 7th Floor, Jl. R.A. Kartini Kav. 8, '
                       'Cilandak Barat, Cilandak, Jakarta Selatan 12430'),
        'kecamatan': 'Cilandak',
        'kota': 'Jakarta Selatan',
        'url': 'https://www.grab.com/id/',
        'funding_total_usd_m': None,
        'last_round': 'NASDAQ listing (GRAB) — at group level',
        'last_round_year': 2021,
        'funding_note': (
            'Not an Indonesian figure, so none is published. Grab Holdings raised its capital as a '
            'Cayman-incorporated, Singapore-headquartered group covering eight countries, and listed on '
            'NASDAQ on 2 Dec 2021 through a SPAC merger with Altimeter Growth Corp. This row counts the '
            'Indonesian operation, which has raised nothing of its own.'),
        'valuation_usd_m': 3100,
        'valuation_est': True,
        'valuation_note': (
            'INDONESIA ONLY — an estimate, not a disclosed figure. Grab Holdings is worth US$14.72B '
            '(NASDAQ: GRAB, 28 Aug 2026). Its Form 20-F reports revenue by country, and Indonesia is '
            'US$715M of US$3,370M group revenue in FY2025 — 21.2%, the third-largest of its eight '
            'markets after Malaysia and Singapore. Carving the market capitalisation at that share gives '
            'US$3,123M, published as US$3.1B (rounded down). The assumption is that a dollar of '
            'Indonesian revenue carries the same multiple as a dollar of Malaysian or Singaporean '
            'revenue; Indonesia is Grab\'s lower-margin market, so if anything this overstates it. At '
            '15%–25% of group value the range is US$2.2B–3.7B. Working: scripts/est-valuation-grab.py. '
            'OVO is ~90% Grab-owned and consolidated, so its value sits inside this figure and the OVO '
            'row is held out of the combined valuation.'),
        'employees_est': 2350,
        'employees_note': (
            'INDONESIAN PAYROLL ONLY, and an estimate. Grab publishes no country headcount; group '
            'full-time employees were 12,012 at 31 Dec 2025 (ESG Report 2025, GRI 2-7), of which 865 are '
            'Everrise supermarket staff in Malaysia and 22 are Infermove in China. The remaining 11,125 '
            'allocated on Indonesia\'s 21.2% share of group revenue gives 2,360, published as 2,350. '
            'Driver-partners and merchant-partners are NOT counted — Grab\'s own filings describe them as '
            'independent partners, not employees. Also excluded: 1,242 fixed-term and 3,956 temporary '
            'agency workers, which Grab reports only group-wide.'),
        'investors': [],
        'sources': GRAB_SRC,
        'confidence': 0.9,
        'verify_note': (
            'Grab\'s own ESG Report 2025 (GRI 2-1) states: "We are dual-headquartered in Singapore and '
            'Indonesia… our corporate headquarters in Indonesia is located at South Quarter Tower C, '
            'Mezzanine and 7th Floor, Jl. R.A. Kartini Kav. 8, Cilandak Barat, Cilandak, Jakarta Selatan, '
            'DKI Jakarta 12430" — this is a Jakarta head office by the company\'s own account, which is '
            'why the row exists. Bisnis reported the move from Kuningan to South Quarter in Jul 2022. The '
            'GLEIF/LEI record (984500862C3E2EB78147, updated Nov 2025) still carries the older registered '
            'address at Lippo Kuningan Lt. 27, Jl. HR Rasuna Said Kav. B-12 — the operating head office is '
            'used here, as on every other row. Indonesian revenue, group revenue, employee counts and the '
            'partner/employee distinction are all read off the FY2025 Form 20-F and the ESG report; the '
            'market capitalisation off stockanalysis.com on 28 Aug 2026. Other Indonesian entities named '
            'in the 20-F: PT Solusi Pengiriman Indonesia, PT Bumi Cakrawala Perkasa, PT Visionet '
            'Internasional (OVO). Grab holds under 50% of PT Super Bank Indonesia Tbk and does not '
            'consolidate it — Superbank is its own row in this census, so nothing is counted twice.'),
        'id': 'grab-indonesia',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'id_only': True,
        'global_parent': {
            'group': 'Grab Holdings Limited',
            'listing': 'NASDAQ: GRAB',
            'domicile': 'Cayman Islands; headquartered in Singapore and Jakarta',
            'group_valuation_usd_m': 14720,
            'group_valuation_asof': '2026-08-28',
            'indonesia_basis': ('Form 20-F FY2025 revenue by country — Indonesia US$715M of US$3,370M '
                                'group revenue (21.2%)'),
            'group_funding': ('NASDAQ listing via SPAC merger with Altimeter Growth Corp, 2 Dec 2021, '
                              'plus private rounds raised at group level'),
        },
    },
    {
        'name': 'Shopee Indonesia (Sea Limited)',
        'legal_name': 'PT Shopee International Indonesia',
        'sector': 'e-commerce marketplace',
        'in_dki': True,
        'hq_address': ('Trinity Tower Lt. 21, Jl. H.R. Rasuna Said Kav. C22 Blok II B, Karet Kuningan, '
                       'Setiabudi, Jakarta Selatan 12940'),
        'kecamatan': 'Setiabudi',
        'kota': 'Jakarta Selatan',
        'url': 'https://shopee.co.id',
        'funding_total_usd_m': None,
        'last_round': 'NYSE listing (SE) — at group level',
        'last_round_year': 2017,
        'funding_note': (
            'Not an Indonesian figure, so none is published. Shopee is funded by Sea Limited '
            '(NYSE: SE), which raised its capital in Singapore for a business spanning Southeast Asia, '
            'Taiwan and Brazil. The Indonesian company has raised nothing of its own.'),
        'valuation_usd_m': None,
        'valuation_note': (
            'No Indonesia-only figure exists, so none is published. Sea Limited is worth US$73.11B '
            '(NYSE: SE, 28 Aug 2026), but reports revenue by region — Southeast Asia, Latin America, '
            'Rest of Asia — and never by country, so there is no disclosed basis to carve an Indonesian '
            'share from. Reprinting the group market capitalisation here would be a Singapore-listed, '
            'three-continent figure standing in for a Jakarta one.'),
        'employees_est': 6200,
        'employees_note': (
            'INDONESIAN PAYROLL ONLY. ~6,200 employees in Indonesia as reported in Sep 2022 (Kontan, '
            'covering that year\'s layoff round) — the most recent Indonesian figure on record, and four '
            'years old. Sea Limited publishes only a group total (102,700 at 31 Dec 2025, Form 20-F) with '
            'no country split. Shopee Xpress partner couriers and the platform\'s sellers are not '
            'employees and are not counted.'),
        'investors': [],
        'sources': [
            'https://industri.kontan.co.id/news/berapa-jumlah-karyawan-shopee-yang-di-phk-ini-perkiraannya',
            'https://companieshouse.id/shopee-international-indonesia',
            'https://www.sec.gov/Archives/edgar/data/1703399/000114036126015366/ef20067274_20f.htm',
            'https://stockanalysis.com/stocks/se/market-cap/',
        ],
        'confidence': 0.6,
        'verify_note': (
            'PT Shopee International Indonesia is the Indonesian entity (Ministry registry no. 703086), '
            'registered at Trinity Tower 21st Floor, Jl. H.R. Rasuna Said Kav. C22 Blok II B, Jakarta '
            'Selatan. Shopee moved into Pacific Century Place Tower Lt. 26, SCBD Lot 10 in Feb 2018 (then '
            'group CEO Chris Feng announced it) and that address is still the one most directories carry; '
            'the registry address is used here because it is the formal record and the more recent of the '
            'two. Both are in Jakarta Selatan. The headcount is the weak figure on this row — four years '
            'old, and Shopee has since moved a customer-service department to Solo and Yogyakarta '
            '(relocation, not layoffs, per the company, May 2025). PT Nusantara Ekspres Kilat, the SPX '
            'courier entity, is a subsidiary of this company and is not a separate row.'),
        'id': 'shopee-indonesia',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'id_only': True,
        'global_parent': {
            'group': 'Sea Limited',
            'listing': 'NYSE: SE',
            'domicile': 'Cayman Islands; headquartered in Singapore',
            'group_valuation_usd_m': 73110,
            'group_valuation_asof': '2026-08-28',
            'indonesia_basis': None,
            'group_funding': 'NYSE listing 2017 and subsequent group raises',
        },
    },
    {
        'name': 'Lazada Indonesia (Alibaba Group)',
        'legal_name': 'PT Ecart Webportal Indonesia',
        'sector': 'e-commerce marketplace',
        'in_dki': True,
        'hq_address': ('Capital Place Lt. 20-21, Jl. Jend. Gatot Subroto Kav. 18, Kuningan Barat, '
                       'Mampang Prapatan, Jakarta Selatan 12710'),
        'kecamatan': 'Mampang Prapatan',
        'kota': 'Jakarta Selatan',
        'lat': -6.23247,
        'lon': 106.82029,
        'geocode_src': 'same building as the DANA row (Capital Place, Jl. Gatot Subroto Kav. 18)',
        'url': 'https://www.lazada.co.id',
        'funding_total_usd_m': None,
        'last_round': 'Alibaba Group control — group-level capital, amounts to Indonesia undisclosed',
        'last_round_year': 2016,
        'funding_note': (
            'Not an Indonesian figure, so none is published. Lazada has been Alibaba\'s Southeast Asian '
            'platform since 2016 and Alibaba has put over US$7B into Lazada Group; none of it is disclosed '
            'as an Indonesian amount.'),
        'valuation_usd_m': None,
        'valuation_note': (
            'No Indonesia-only figure exists, so none is published. Lazada Group is wholly owned inside '
            'Alibaba, which does not report Lazada — let alone Lazada Indonesia — as a segment. There is '
            'nothing to carve a country figure from.'),
        'employees_est': 2000,
        'employees_note': (
            'INDONESIAN PAYROLL ONLY, and a floor rather than a count: the company\'s own recruitment '
            'profile declares "more than 2,000 employees". Alibaba publishes no Indonesian headcount. '
            'Lazada cut about 5% of its Southeast Asian workforce in Jun 2026, Indonesia included, so '
            'the true figure is likely at or below this floor. Platform sellers and partner couriers are '
            'not employees and are not counted.'),
        'investors': ['Alibaba Group (owner)'],
        'sources': [
            'https://kitalulus.com/company/pt-ecart-webportal-indonesia-lazada-7b5r',
            'https://www.cnbcindonesia.com/tech/20260626122830-37-745947/lazada-phk-gede-gedean-di-asia-tenggara-termasuk-indonesia',
            'https://uccareer.id/detail/company/324/pt-ecart-webportal-indonesia-lazada-co-id',
        ],
        'confidence': 0.55,
        'verify_note': (
            'PT Ecart Webportal Indonesia is the operator of lazada.co.id, at Capital Place Lt. 20-21, '
            'Jl. Gatot Subroto Kav. 18 — the same building as the DANA row, whose coordinates are reused. '
            'Operating as of Aug 2026; the Jun 2026 Southeast Asian restructuring was reported to include '
            'Indonesia. This is the thinnest row of the four: the headcount is a self-declared band and '
            'no Indonesian value figure exists at all, which is why three of its four numeric cells are '
            'dashes.'),
        'id': 'lazada-indonesia',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'id_only': True,
        'global_parent': {
            'group': 'Lazada Group (Alibaba Group Holding)',
            'listing': 'NYSE/HKEX: BABA (parent)',
            'domicile': 'Singapore-headquartered, Alibaba-owned',
            'group_valuation_usd_m': None,
            'group_valuation_asof': None,
            'indonesia_basis': None,
            'group_funding': 'Over US$7B invested by Alibaba into Lazada Group since 2016',
        },
    },
    {
        'name': 'Ninja Xpress (Ninja Van Group)',
        'legal_name': 'PT Andiarta Muzizat',
        'sector': 'logistics — last-mile parcel delivery',
        'in_dki': True,
        'hq_address': ('Menara Bidakara 2 Lt. 5, Jl. Jend. Gatot Subroto Kav. 71-73, Menteng Dalam, '
                       'Pancoran, Jakarta Selatan 12870'),
        'kecamatan': 'Pancoran',
        'kota': 'Jakarta Selatan',
        'url': 'https://www.ninjaxpress.co',
        'funding_total_usd_m': None,
        'last_round': 'Series E (US$578M) — at group level',
        'last_round_year': 2021,
        'funding_note': (
            'Not an Indonesian figure, so none is published. Ninja Van Group, the Singapore parent, '
            'raised a US$578M Series E in Sep 2021 led by Alibaba, on top of earlier rounds. The '
            'Indonesian company has raised nothing of its own.'),
        'valuation_usd_m': None,
        'valuation_note': (
            'No figure on record. Ninja Van Group is private and unlisted, has not been marked since its '
            '2021 round, and reports nothing by country.'),
        'employees_est': 3773,
        'employees_note': (
            'INDONESIAN PAYROLL ONLY. Revelio Labs workforce data, 2025 — 3,773, down 12.5% year on year. '
            'LinkedIn-derived counts are far lower (864) because hub and warehouse staff are '
            'under-represented there. Couriers working under Ninja\'s fleet-partner arrangements are '
            'mitra, not employees, and are not counted.'),
        'investors': ['Ninja Van Group (owner)'],
        'sources': [
            'https://www.ninjaxpress.co/id-id/terms-of-use',
            'https://www.reveliolabs.com/companies/ninja-xpress/employees',
            'https://indonesialogistik.id/perusahaan-expedisi/andiarta-muzizat/',
        ],
        'confidence': 0.65,
        'verify_note': (
            'The legal entity comes from Ninja Xpress\'s own Terms of Use: "We, PT Andiarta Muzizat, a '
            'company incorporated in Indonesia… (\'NinjaXpress\')". Head office Menara Bidakara 2 Lt. 5, '
            'Jl. Gatot Subroto Kav. 71-73, Pancoran. Not to be confused with PT Nusantara Ekspres Kilat, '
            'which is Shopee Xpress. Operating as of Aug 2026.'),
        'id': 'ninja-xpress',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'id_only': True,
        'global_parent': {
            'group': 'Ninja Van Group',
            'listing': None,
            'domicile': 'Singapore',
            'group_valuation_usd_m': None,
            'group_valuation_asof': None,
            'indonesia_basis': None,
            'group_funding': 'US$578M Series E, Sep 2021, led by Alibaba; ~US$975M raised in total at group level',
        },
    },
]

# id -> field overrides applied to a row that is already in the census
OVERRIDES = {
    'j-t-express': {
        'valuation_usd_m': None,
        'valuation_est': None,
        'valuation_note': (
            'No Indonesia-only figure is published. J&T Global Express (HKEX: 1519) is '
            'Cayman-incorporated and worth HK$95.1B (~US$12.2B) on 28 Aug 2026, but its FY2025 accounts '
            'report four geographic segments and none of them is Indonesia: Southeast Asia US$4.50B '
            'revenue, China US$6.71B, New Markets US$0.87B, Cross-border US$0.08B. China is the largest '
            'single segment by revenue, so the group market capitalisation is majority non-Indonesian; '
            'it was carried on this row until 29 Aug 2026 and has been taken out. Indonesia is the '
            'company\'s founding market and the growth engine of the Southeast Asia segment — J&T '
            'reported Indonesian volume up more than 60% in 2025 — but the group publishes only that '
            'growth rate, never an Indonesian revenue, profit or share figure, so there is no disclosed '
            'basis to carve a valuation from and none is invented.'),
        'funding_total_usd_m': None,
        'funding_note': (
            'Not an Indonesian figure, so none is published. The ~US$4.5B raised from Boyu, Hillhouse, '
            'HongShan, Tencent and Temasek was raised by the Cayman-incorporated group — largely to fund '
            'its Chinese network, now its largest segment — and the Oct 2023 HKEX IPO raised a further '
            '~US$500M at group level. It was carried on this row as an Indonesian total until '
            '29 Aug 2026.'),
        'employees_note': (
            'INDONESIAN PAYROLL ONLY: the official jet.co.id company profile states "more than 30,000 '
            'trained human resources" across Indonesia, staffing ~100 gateways and 4,000+ operating '
            'points. J&T\'s couriers are on the company\'s payroll — salaried with a per-parcel incentive, '
            'not platform mitra — which is why they count here while Gojek\'s and Grab\'s driver-partners '
            'do not. The global J&T group, which moved 30.1 billion parcels in 2025, is far larger.'),
        'id_only': True,
        'global_parent': {
            'group': 'J&T Global Express Limited',
            'listing': 'HKEX: 1519',
            'domicile': 'Cayman Islands; founded in Jakarta 2015, group run from Shanghai and Jakarta',
            'group_valuation_usd_m': 12190,
            'group_valuation_asof': '2026-08-28',
            'indonesia_basis': None,
            'group_funding': ('~US$4.5B private (Boyu, Hillhouse, HongShan, Tencent, Temasek) plus a '
                              '~US$500M HKEX IPO in Oct 2023'),
        },
    },
}

RULE = (
    'Foreign groups\' Indonesian operations are counted at their Indonesian size only. Grab, Shopee, '
    'Lazada, Ninja Xpress and J&T all run Jakarta head offices with Indonesian staff, so they belong in '
    'a Jakarta census — but a group market capitalisation, or capital a Singapore or Cayman parent raised '
    'for eight countries, is not an Indonesian figure. Value is published only where the group discloses '
    'a basis to carve an Indonesian share from (Grab\'s Form 20-F reports revenue by country); otherwise '
    'the cell is a dash and the note says what the group is worth and why that is a different claim. Jobs '
    'are people on an Indonesian payroll: driver-, courier-, merchant- and seller-partners are mitra, not '
    'employees, and are never counted.'
)

CAVEAT = (
    'Global-parent rows (Grab, Shopee, Lazada, Ninja Xpress, J&T) carry Indonesia-only figures. A group '
    'market capitalisation or a parent\'s regional funding is never reprinted as an Indonesian number; '
    'where no Indonesian basis is disclosed the cell is a dash. Their headcounts are Indonesian payroll '
    'only, with gig partners excluded, so these companies\' true economic footprint is understated by '
    'design — as it is for every marketplace and logistics row.'
)


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    before = len(raw['companies'])
    by_id = {c.get('id'): c for c in raw['companies']}

    missing = [i for i in OVERRIDES if i not in by_id]
    if missing:
        sys.exit('override target(s) not in the census: ' + ', '.join(missing))

    shutil.copyfile(RAW, RAW + '.bak-global')

    added, updated = [], []
    for rec in NEW:
        cur = by_id.get(rec['id'])
        if cur is None:
            raw['companies'].append(json.loads(json.dumps(rec)))
            added.append(rec['id'])
        else:
            keep = {k: cur[k] for k in ('lat', 'lon', 'geocode_src', 'geocode_kind', 'geocode_tries',
                                        'logo', 'logo_src', 'sprite') if k in cur}
            cur.clear()
            cur.update(json.loads(json.dumps(rec)))
            for k, v in keep.items():
                cur.setdefault(k, v)
            updated.append(rec['id'])

    for cid, fields in OVERRIDES.items():
        row = by_id[cid]
        for k, v in fields.items():
            if v is None and k in ('valuation_est',):
                row.pop(k, None)
            else:
                row[k] = json.loads(json.dumps(v)) if isinstance(v, (dict, list)) else v
        updated.append(cid)

    m = raw['method']
    m['global_parent_rule'] = RULE
    caveats = [c for c in m.get('caveats', []) if not c.startswith('Global-parent rows')]
    caveats.insert(1, CAVEAT)
    m['caveats'] = caveats

    tmp = RAW + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)

    after = len(raw['companies'])
    print(f'census-raw.json: {before} -> {after} companies  (backup: census-raw.json.bak-global)')
    print(f'  added   {len(added)}: ' + ', '.join(added) if added else '  added   0')
    print(f'  updated {len(updated)}: ' + ', '.join(sorted(set(updated))))
    idonly = [c for c in raw['companies'] if c.get('id_only')]
    jobs = sum(c.get('employees_est') or 0 for c in idonly)
    print(f'  {len(idonly)} global-parent rows, {jobs:,} Indonesian payroll jobs between them')
    for c in sorted(idonly, key=lambda c: -(c.get('employees_est') or 0)):
        v = c.get('valuation_usd_m')
        print(f"    {c['name'][:42]:42} value {('US$%s M' % f'{v:,}') if v else '—':>12}  "
              f"jobs {c.get('employees_est') or 0:>7,}")


main()
