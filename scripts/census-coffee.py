#!/usr/bin/env python3
"""Coffee cohort: Tanamera and the chains the sweeps never walked.

Luca, 30 Aug 2026: "i believe we are missed tanamera and other coffee startup
like flash, try to get more data."

The census carried the VC-famous coffee rows (Kopi Kenangan, Fore, Jiwa Group,
Haus, Jago) and nothing else — same failure mode as adtech and the M&A lane:
name-list sweeps only find the names on the lists. Five verified adds:

  · Tomoro Coffee   — PT Kopi Bintang Indonesia; founded Aug 2022 in Pluit by
                      Star Yuan (a J&T Express co-founder, ex-OPPO) — the same
                      OPPO/J&T circle money that built J&T; 600+ outlets by
                      Oct 2024, now expanding abroad FROM Jakarta. The single
                      biggest miss in the sector.
  · Flash Coffee    — PT Sembilan Puluh Enam Derajat; the group exited every
                      other market and is Indonesia-only since 2024 (67→130
                      outlets), US$68M announced equity incl. US$3M (Apr 2025)
                      raised for Indonesia. NOT dead — the SG collapse of 2023
                      was the other markets.
  · Toko Kopi Tuku  — PT Makna Angan Karya Andanu (MAKA); the 2015 Cipete
                      original that industrialised es kopi susu tetangga.
  · Tanamera Coffee — PT Tanamera Kopi Indonesia; crop-to-cup specialty
                      roastery-chain since 2013. Luca's named ask.
  · Common Grounds  — PT Kopi Utama Indonesia; specialty roastery-cafe group
                      in Intudo Ventures' published portfolio (venture test
                      passes), 19 cafes.

Scope lines (upsert-by-name): Kulo Group (franchise packages — the ReFIT rule),
Anomali Coffee (2007 pioneer, no outside capital on record), and the incumbent
groups' coffee lines (Point/Maxx/Djournal/Excelso/Starbucks-MAP).

All headcounts are live LinkedIn reads dated 2026-08-30; store staff keep no
profiles, so every count is a floor — the five rows are flagged in
scripts/census-output-flags.py (workforce) alongside Kenangan and Haus.

Idempotent upsert by id; keeps logo/sprite of an existing row.
Run: python3 scripts/census-coffee.py
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
TODAY = '2026-08-30'

NEW = [
    {
        'name': 'Tomoro Coffee',
        'legal_name': 'PT Kopi Bintang Indonesia',
        'sector': 'F&B tech / tech-enabled coffee chain (app + stores)',
        'in_dki': True,
        'hq_address': ('Landmark Pluit Tower B9 Lt. 10, Jl. Pluit Selatan Raya No. 2, Pluit, '
                       'Penjaringan, Jakarta Utara 14450'),
        'kecamatan': 'Penjaringan',
        'kota': 'Jakarta Utara',
        'url': 'https://www.tomoro-coffee.id',
        'funding_total_usd_m': None,
        'last_round': None,
        'last_round_year': None,
        'funding_note': (
            'No round on record. Tomoro was founded and capitalised from its founders\' own '
            'circle: Star Yuan co-founded J&T Express and was OPPO\'s Director of Product '
            'Management (Wikipedia; Kompas) — the same OPPO/J&T ecosystem money that built J&T, '
            'which is how the row passes the census\'s tech-money test without a venture round.'),
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. Private, never marked.',
        'employees_est': 1785,
        'employees_asof': '2026-08-30',
        'employees_tier': 4,
        'employees_src': 'https://www.linkedin.com/company/tomoro-coffee',
        'employees_li': 1785,
        'employees_li_asof': '2026-08-30',
        'employees_note': (
            '1,785 on its LinkedIn page, read live 30 Aug 2026 — a FLOOR: baristas across 600+ '
            'company stores mostly keep no profile, and the page\'s self-declared band still says '
            '501-1,000, below its own live count. Read the row as thousands of store staff '
            'undercounted, not overstated.'),
        'investors': [],
        'sources': [
            'https://en.wikipedia.org/wiki/Tomoro_Coffee',
            'https://money.kompas.com/read/2025/05/25/105407526/siapa-pemilik-tomoro-coffee-yang-gencar-buka-cabang-di-indonesia',
            'https://www.linkedin.com/company/tomoro-coffee',
            'https://www.tomoro-coffee.id',
            'https://glints.com/id/companies/pt-kopi-bintang-indonesia-tomoro-coffee/',
        ],
        'confidence': 0.8,
        'verify_note': (
            'Founded 9 Aug 2022 — first store in Pluit — by Xing Wei "Star" Yuan (co-founder of '
            'J&T Express, ex-Director of Product Management at OPPO, NUS graduate) with Fish Sun; '
            'operator PT Kopi Bintang Indonesia (Wikipedia + Kompas agree). More than 600 outlets '
            'across Indonesia by Oct 2024 — one of the country\'s largest chains inside two years '
            '— and now expanding to Singapore, the Philippines and China FROM Jakarta. Head '
            'office Landmark Pluit B9 Lt. 10 (Wikipedia infobox; Glints lists Jakarta Utara). '
            'Missing until now for the usual reason: it appears on no startup name-list, because '
            'it never raised a round. Operating as of Aug 2026 — site live, LinkedIn page at '
            '30,000+ followers and hiring.'),
        'id': 'tomoro-coffee',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'lat': -6.12447, 'lon': 106.79952,
        'geocode_src': 'photon:Landmark Pluit, Penjaringan',
        'geocode_kind': 'building',
    },
    {
        'name': 'Flash Coffee Indonesia',
        'legal_name': 'PT Sembilan Puluh Enam Derajat',
        'sector': 'F&B tech / tech-enabled coffee chain',
        'in_dki': True,
        'hq_address': ('Jl. K.H. Abdullah Syafei No. 17, Bukit Duri, Tebet, Jakarta Selatan 12840 '
                       '(registered office, also its first Jakarta store)'),
        'kecamatan': 'Tebet',
        'kota': 'Jakarta Selatan',
        'url': 'https://www.flash-coffee.com/id',
        'funding_total_usd_m': 68,
        'last_round': 'US$3M (Apr 2025) — raised for the Indonesian expansion',
        'last_round_year': 2025,
        'funding_src': 'https://www.businesstimes.com.sg/startups-tech/flash-coffee-raises-us50-million-extended-series-b-round',
        'funding_src_tier': 'announced',
        'funding_src_all': [
            'https://www.businesstimes.com.sg/startups-tech/flash-coffee-raises-us50-million-extended-series-b-round',
            'https://technode.global/2023/05/11/singapores-flash-coffee-raises-50m-in-series-b-round-led-by-white-star-capital/',
            'https://www.prnewswire.com/apac/news-releases/flash-coffee-secures-3m-in-new-funding-to-accelerate-growth--expand-new-store-concept-across-indonesia-302442512.html',
        ],
        'funding_note': (
            'US$68M announced across three equity raises: US$15M Series A (Jan 2021), a Series B '
            'totalling US$50M by May 2023 led by White Star Capital, and US$3M announced 30 Apr '
            '2025 by the company itself, specifically to expand its new store concept across '
            'Indonesia. Trackers carry ~US$100M in total (CB Insights US$100.8M) including '
            'unannounced instruments — not used. The earlier capital was raised by the Singapore '
            'group (Digital Services SG Four Pte. Ltd.) in its seven-market era; every other '
            'market has since been exited, so the surviving business the money now funds is '
            'Indonesia-only.'),
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. No round since 2023 disclosed a valuation.',
        'employees_est': 423,
        'employees_asof': '2026-08-30',
        'employees_tier': 4,
        'employees_src': 'https://www.linkedin.com/company/flash-coffee',
        'employees_li': 423,
        'employees_li_asof': '2026-08-30',
        'employees_note': (
            '423 on its LinkedIn page, read live 30 Aug 2026 — the page now bills itself '
            '"Indonesia\'s most innovative coffee lifestyle brand" and the operating footprint is '
            'Indonesia-only, so the count is effectively Indonesian. A FLOOR: store baristas '
            'mostly keep no profile, and a residue of profiles from the exited markets may still '
            'sit in it — the two effects pull opposite ways and are both noted rather than '
            'adjusted for.'),
        'investors': ['White Star Capital'],
        'sources': [
            'https://companieshouse.id/sembilan-puluh-enam-derajat',
            'https://www.linkedin.com/company/flash-coffee',
            'https://insideretail.asia/2024/09/02/as-it-exits-other-markets-flash-coffee-doubles-down-on-indonesia',
            'https://momsmoney.kontan.co.id/news/flash-coffee-ekspansi-130-gerai-ubah-konsep-dan-rambah-kota-baru',
            'https://flash-coffee.com/locations/',
            'https://m.jpnn.com/news/flash-coffee-tunjuk-bardon-matthew-sebagai-ceo-berpengalaman-20-tahun-di-asia-tenggara',
        ],
        'confidence': 0.75,
        'verify_note': (
            'The yellow-storefront tech coffee chain founded in 2020 out of Singapore by David '
            'Brunier and Sebastian Hannecker. The group\'s 2023 troubles were the OTHER markets: '
            'it closed Singapore, then exited Thailand, Hong Kong and the rest, and doubled down '
            'on Indonesia (Inside Retail, Sep 2024: 67 outlets and sales up more than 50% in H1 '
            '2024). By Jul 2025 it announced expansion toward 130 outlets with a new store '
            'concept (Kontan), under CEO Bardon Matthew with ex-foodpanda CEO Jakob Angele as '
            'chairman. Indonesian operator: PT Sembilan Puluh Enam Derajat — "96 degrees" — '
            'Ministry registry no. 1053570, registered on Jl. K.H. Abdullah Syafei in Tebet, the '
            'address of its first Jakarta store; the Singapore parent is Digital Services SG Four '
            'Pte. Ltd. (named on its own LinkedIn page). Counted like Qiscus and Bahasa.ai: a '
            'foreign-incorporated holdco whose operating company is Jakarta. Site now reads '
            '"Flash Coffee — Kebanggaan Indonesia". Operating as of Aug 2026.'),
        'id': 'flash-coffee',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'lat': -6.22530, 'lon': 106.85782,
        'geocode_src': 'photon:Jl. K.H. Abdullah Syafei, Tebet — street match',
        'geocode_kind': 'street',
    },
    {
        'name': 'Toko Kopi Tuku (MAKA)',
        'legal_name': 'PT Makna Angan Karya Andanu',
        'sector': 'F&B — grab-and-go coffee chain',
        'in_dki': True,
        'hq_address': ('Toko Kopi Tuku Cipete — the first store and home base — Jl. Cipete Raya, '
                       'Cipete Selatan, Cilandak, Jakarta Selatan 12410'),
        'kecamatan': 'Cilandak',
        'kota': 'Jakarta Selatan',
        'url': 'https://maka.co.id',
        'funding_total_usd_m': None,
        'last_round': None,
        'last_round_year': None,
        'funding_note': (
            'No round on record — Tuku grew on its own cashflow from the 2015 Cipete shop into a '
            'chain selling ~50,000 cups a day (Investortrust, Jun 2024, citing the company: '
            'revenue up 77%). Founder Andanu Prasetyo\'s MAKA group (PT est. 2017) also runs '
            'Toodz House.'),
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. Private, never marked.',
        'employees_est': 336,
        'employees_asof': '2026-08-30',
        'employees_tier': 4,
        'employees_src': 'https://www.linkedin.com/company/karyatetanggatuku',
        'employees_li': 336,
        'employees_li_asof': '2026-08-30',
        'employees_note': (
            '336 on the TUKU (MAKA Group) LinkedIn page, read live 30 Aug 2026 — a FLOOR: the '
            'page\'s own declared band says 501-1,000, and store crews mostly keep no profile, so '
            'the payroll is plausibly above the count rather than below it.'),
        'investors': [],
        'sources': [
            'https://id.jobstreet.com/companies/maka-168558016530365',
            'https://www.linkedin.com/company/karyatetanggatuku',
            'https://investortrust.id/business/31624/kopi-tuku-catat-peningkatan-pendapatan-77-terjual-50-ribu-cup-minuman-per-hari',
            'https://www.idntimes.com/food/dining-guide/maka-rumah-dari-toko-kopi-tuku-raih-gold-di-infini-t-awards-2026-00-z5hk4-yclzr7',
            'https://maka.co.id',
        ],
        'confidence': 0.75,
        'verify_note': (
            'The shop that made es kopi susu tetangga a national category: first store Cipete, '
            '2015, founded by Andanu Prasetyo. The legal entity is PT Makna Angan Karya Andanu — '
            'MAKA, established 2017 — named consistently by Jobstreet\'s employer profile, its '
            'own LinkedIn pages and Investortrust\'s company reporting. LinkedIn HQ: South '
            'Jakarta; the Cipete original is used as the home-base pin. Operating as of Aug 2026 '
            '— MAKA took Gold at the Infini-T Awards in Apr 2026 (IDN Times) and the group site '
            'is live.'),
        'id': 'kopi-tuku',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'lat': -6.27765, 'lon': 106.80148,
        'geocode_src': 'photon:Toko Kopi TUKU Cipete (POI)',
        'geocode_kind': 'building',
    },
    {
        'name': 'Tanamera Coffee',
        'legal_name': 'PT Tanamera Kopi Indonesia',
        'sector': 'F&B — specialty coffee roastery and cafes',
        'in_dki': False,
        'hq_address': ('Pergudangan Taman Tekno II Blok H3, BSD City, Jl. Raya Serpong, Setu, '
                       'Tangerang Selatan (roastery & registered head office)'),
        'kecamatan': 'Setu',
        'kota': 'Kota Tangerang Selatan',
        'url': 'https://www.tanameracoffee.co.id',
        'funding_total_usd_m': None,
        'last_round': None,
        'last_round_year': None,
        'funding_note': (
            'No round on record — built without disclosed outside capital since 2013. The cell '
            'stays a dash rather than borrowing a tracker\'s guess.'),
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. Private, never marked.',
        'employees_est': 270,
        'employees_asof': '2026-08-30',
        'employees_tier': 4,
        'employees_src': 'https://www.linkedin.com/company/tanamera-coffee-indonesia',
        'employees_li': 270,
        'employees_li_asof': '2026-08-30',
        'employees_note': (
            '270 on its LinkedIn page, read live 30 Aug 2026. The self-declared band still says '
            '51-200 — below the live count, so the band is stale; and cafe crews keep few '
            'profiles, so treat the count as a floor.'),
        'investors': [],
        'sources': [
            'https://companieshouse.id/tanamera-kopi-indonesia',
            'https://www.linkedin.com/company/tanamera-coffee-indonesia',
            'https://www.tanameracoffee.co.id/about-us',
            'https://www.theceomagazine.com/executive-interviews/food-beverage/dini-aryani-criddle/',
            'https://www.day9.coffee/roasters/tanamera-coffee',
        ],
        'confidence': 0.75,
        'verify_note': (
            'Founded 2013 by Dini Aryani Criddle (founder and CEO — The CEO Magazine interview; '
            'her name is also on the company\'s own story page): a crop-to-cup specialty '
            'operation — its own roastery, cafes, and single-origin sourcing from Aceh to Papua — '
            'that made Tanamera one of Indonesia\'s most-awarded coffee brands. Ministry registry '
            '(no. 403711, via companieshouse.id): PT Tanamera Kopi Indonesia, Pergudangan Taman '
            'Tekno II Blok H3, BSD City, Setu, South Tangerang — the roastery-headquarters, used '
            'for the pin; the LinkedIn page\'s HQ field says Jakarta Selatan, where its flagship '
            'cafes sit. No venture round is on record: the row is counted as an independent '
            'specialty-coffee scale-up, not an incumbent\'s product line. Operating as of Aug '
            '2026 — site live, LinkedIn active.'),
        'id': 'tanamera-coffee',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'lat': -6.33749, 'lon': 106.68000,
        'geocode_src': 'photon:Taman Tekno BSD, Setu — street match',
        'geocode_kind': 'street',
    },
    {
        'name': 'Common Grounds Coffee',
        'legal_name': 'PT Kopi Utama Indonesia',
        'sector': 'F&B — specialty coffee roastery and cafes',
        'in_dki': True,
        'hq_address': ('Citywalk Sudirman GF Kav. 121, Jl. K.H. Mas Mansyur, Karet Tengsin, '
                       'Tanah Abang, Jakarta Pusat 10220 (flagship roastery-cafe)'),
        'kecamatan': 'Tanah Abang',
        'kota': 'Jakarta Pusat',
        'url': 'https://www.commongrounds.co.id',
        'funding_total_usd_m': None,
        'last_round': None,
        'last_round_year': None,
        'funding_note': (
            'Venture-backed, amount never disclosed: Common Grounds sits in Intudo Ventures\' '
            'published portfolio, and CB Insights records a single unattributed round with no '
            'figure. We do not invent numbers, so the cell stays a dash with the backing named.'),
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. Private, never marked.',
        'employees_est': 210,
        'employees_asof': '2026-08-30',
        'employees_tier': 4,
        'employees_src': 'https://www.linkedin.com/company/commongroundscoffeeroastery',
        'employees_li': 210,
        'employees_li_asof': '2026-08-30',
        'employees_note': (
            '210 on its LinkedIn page, read live 30 Aug 2026, across 19 cafes nationwide (15 in '
            'Jakarta and Tangerang as of Jan 2025, per the page\'s own About). Cafe crews keep '
            'few profiles — treat as a floor.'),
        'investors': ['Intudo Ventures'],
        'sources': [
            'https://intudovc.com/portfolio/common-grounds/',
            'https://www.linkedin.com/company/commongroundscoffeeroastery',
            'https://portal.karirlink.id/company/pt-kopi-utama-indonesia-common-grounds',
            'https://www.commongrounds.co.id',
            'https://www.day9.coffee/roasters/common-grounds-coffee-roastery',
        ],
        'confidence': 0.7,
        'verify_note': (
            'Specialty roastery-cafe group founded by four friends in 2014 (its own LinkedIn '
            'About; co-founder and CEO Aston Utan), known for award-winning baristas; 19 cafes '
            'nationwide as of Jan 2025 with locations in Bandung and Malang beyond Greater '
            'Jakarta. In Intudo Ventures\' published portfolio — the venture test passes on the '
            'investor\'s own page even though no amount was ever disclosed. Hiring runs through '
            'PT Kopi Utama Indonesia (KarirLink), used as the operator; a GIZ coffee-innovation '
            'document names the roasting arm as PT Biji Kopi Unggulan — both recorded. Flagship '
            'roastery-cafe at Citywalk Sudirman, Tanah Abang, used for the pin. Operating as of '
            'Aug 2026 — site live, LinkedIn active.'),
        'id': 'common-grounds',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'lat': -6.20895, 'lon': 106.81844,
        'geocode_src': 'photon:CityWalk Sudirman, Tanah Abang',
        'geocode_kind': 'building',
    },
]

SCOPE = [
    {
        'name': 'Kulo Group (Kopi Kulo)',
        'why': ('a franchise-package group — Kedai Kopi Kulo, Pochajjang and siblings grew by '
                'selling kemitraan outlets, and no venture money is on record. The same rule '
                'that keeps ReFIT out of the fitness cohort; revisit if a round ever surfaces.'),
    },
    {
        'name': 'Anomali Coffee',
        'why': ('the 2007 specialty pioneer (PT Anomali Coffee, founders Irvan Helmi and '
                'Muhammad Abgari) — a genuinely independent company, but with no outside capital '
                'on record it fails the built-or-bought-by-tech-money test the same way a '
                'conventional retailer would. Revisit if a round surfaces.'),
    },
    {
        'name': 'Point Coffee, Maxx Coffee, Djournal, Excelso, Starbucks Indonesia',
        'why': ('incumbent groups\' coffee lines and licensed foreign chains — Indomaret\'s '
                'Point, Lippo\'s Maxx, Ismaya\'s Djournal, Kapal Api\'s Excelso, and Starbucks '
                'run under MAP\'s PT Sari Coffee Indonesia licence. Product lines of '
                'conglomerates, not standalone startups (the Jenius rule).'),
    },
]


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    before = len(raw['companies'])
    shutil.copyfile(RAW, RAW + '.bak-coffee')

    by_id = {c.get('id'): c for c in raw['companies']}
    added, updated = [], []
    for rec in NEW:
        cur = by_id.get(rec['id'])
        if cur is None:
            raw['companies'].append(json.loads(json.dumps(rec)))
            added.append(rec['id'])
        else:
            keep = {k: cur[k] for k in ('logo', 'logo_src', 'sprite') if k in cur}
            cur.clear()
            cur.update(json.loads(json.dumps(rec)))
            for k, v in keep.items():
                cur.setdefault(k, v)
            updated.append(rec['id'])

    sc = raw.setdefault('scope', {}).setdefault('outside', [])
    have = {e.get('name'): e for e in sc}
    for e in SCOPE:
        if e['name'] in have:
            have[e['name']].update(e)
        else:
            sc.append(dict(e))

    tmp = RAW + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(raw, f, ensure_ascii=False, indent=1)
    os.replace(tmp, RAW)
    print(f'census-raw.json: {before} -> {len(raw["companies"])} companies (backup: .bak-coffee)')
    print(f'  added   {len(added)}: ' + ', '.join(added))
    print(f'  updated {len(updated)}: ' + ', '.join(updated))
    print(f'  scope: {len(sc)} outside lines ({len(SCOPE)} owned here)')


main()
