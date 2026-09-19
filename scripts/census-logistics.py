#!/usr/bin/env python3
"""Logistics cohort: the on-demand delivery gap Luca pointed at.

Luca, 30 Aug 2026: "it seems lalamove and deliveree has not recorded in the
https://1001.vantis.sh/, do more data gathering for the this kind of startup."

He is right — the census carried the domestic logistics stack (Shipper, Waresix,
Kargo, Logisly, Paxel, Anteraja, SiCepat, Lion Parcel, Biteship, MileApp,
Praktis, Crewdible, TransTRACK, Baskit…) and the four big global-parent rows
(Grab, Shopee, Lazada, Ninja Xpress), but the foreign-parent ON-DEMAND operators
were missing entirely. This script adds five verified rows:

  · Lalamove Indonesia   — PT Lalamove Logistik Indonesia (Lalatech, Hong Kong)
  · Deliveree Indonesia  — PT Angkut Teknologi Indonesia (Deliveree Pte, SG/BKK)
  · Borzo Indonesia      — PT Incrin Indonesia Kurir (ex MrSpeedy / Dostavista)
  · iDexpress            — PT IDexpress Service Solution (domestic, J&T alumni)
  · Coldspace            — PT Rantai Dingin Asia (domestic, cold chain)

The first three are global-parent rows under the existing rule (census-global.py):
Indonesian slice only — group funding is never an Indonesian total (dash + note),
no group valuation is reprinted, and driver/courier mitra are never counted.

Also owned here:
  · four scope lines (upsert-by-name, never wholesale — the census-banks lesson):
    Maxim (excluded, sourced), inDrive (queued), conventional courier incumbents,
    and the in-app delivery arms (GoSend/GrabExpress/SPX) that are product lines.
  · the Ritase entry in data/closed.json (assets sold to Meratus, Nov 2023;
    ritase.com 404s) — the register Luca asked for is exactly for this.

Idempotent: upserts by id / name and re-applies, so it can be re-run after
another session rewrites census-raw.json (which happens). Keeps lat/lon/logo of
an existing row only if this script does not carry its own.
Run: python3 scripts/census-logistics.py
"""
import json
import os
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, '..', 'data', 'census-raw.json')
CLOSED = os.path.join(HERE, '..', 'data', 'closed.json')
TODAY = '2026-08-30'

NEW = [
    {
        'name': 'Lalamove Indonesia (Lalatech)',
        'legal_name': 'PT Lalamove Logistik Indonesia',
        'sector': 'logistics — on-demand delivery and moving platform',
        'in_dki': True,
        'hq_address': ('Mandiri Inhealth Tower Lt. 25, Jl. Prof. Dr. Satrio Kav. E-IV No. 6, '
                       'Mega Kuningan, Kuningan Timur, Setiabudi, Jakarta Selatan 12950'),
        'kecamatan': 'Setiabudi',
        'kota': 'Jakarta Selatan',
        'url': 'https://www.lalamove.com/en-id',
        'funding_total_usd_m': None,
        'last_round': 'Series E (US$515M, Dec 2020) — at group level',
        'last_round_year': 2020,
        'funding_note': (
            'Not an Indonesian figure, so none is published. Lalatech Holdings, the Hong Kong group '
            'behind Lalamove, raised its capital globally — US$515M Series E in Dec 2020 (TechCrunch), '
            'with backers including Hillhouse, Sequoia China and Tencent — and has filed for a HKEX '
            'listing eight times since March 2023, most recently on 30 Apr 2026. The Indonesian '
            'operation has raised nothing of its own: its prospectus discloses that overseas markets '
            'contributed 9.2% of 2025 group revenue, one line across 14 markets with no Indonesian '
            'split.'),
        'valuation_usd_m': None,
        'valuation_note': (
            'No figure on record, and no basis to estimate one. Lalatech is private (the HKEX IPO '
            'filed for the eighth time on 30 Apr 2026 has not completed), and its own prospectus '
            'gives no country revenue line to carve from — overseas is reported as a single 9.2% of '
            '2025 revenue across 14 markets. The only Indonesia-specific financial figure it files '
            'is Jakarta four-wheel GTV of US$65.8M in 2025, and GTV is not revenue. A Grab-style '
            'carve-out is therefore not possible; anything published here would be invented.'),
        'employees_est': None,
        'employees_note': (
            'INDONESIAN PAYROLL ONLY, and no publishable figure exists — but the prospectus bounds '
            'it: Lalatech filed 9,166 group employees at 31 Dec 2025 (drivers are not employees), of '
            'which 85.9% are in mainland China and 14.1% — roughly 1,290 people — cover all 14 '
            'overseas markets together, Indonesia not split out. Lalamove Indonesia has no LinkedIn '
            'entity page; Jobstreet\'s employer profile self-declares 51-100 employees — a band, '
            'which this census never publishes as a count — and listed active Jakarta vacancies at '
            'PT Lalamove Logistik Indonesia when read on 30 Aug 2026.'),
        'operating_evidence': (
            'Lalatech\'s HKEX prospectus (30 Apr 2026) files real Jakarta operating data: entered '
            'Jakarta in 2018; completed orders there grew from 12.9M (2023) to 26.3M (2025), a 42.8% '
            'CAGR; Jakarta four-wheel GTV grew from US$31.3M (2023) to US$65.8M (2025), a 45.0% '
            'CAGR; and in 2025 over 38% of vehicles driven by monthly-active four-wheel drivers in '
            'Jakarta carried Lalamove livery. Indonesian service scope per the same filing: '
            'intracity delivery in the provincial capitals — Jakarta, Bandung, Surabaya, Semarang, '
            'Yogyakarta — plus routes between and out of them.'),
        'investors': [],
        'sources': [
            'https://www.lalamove.com/lalamove-entities',
            'https://companieshouse.id/lalamove-logistik-indonesia',
            'https://www.jpnn.com/news/lalamove-coba-peruntungan-di-pasar-go-send',
            'https://techcrunch.com/2020/12/22/on-demand-logistics-company-lalamove-gets-515-million-series-e/',
            'https://finance.biggo.com/news/fpPAMJ4BoicNoOgCQeZQ',
            'https://id.jobstreet.com/companies/lalamove-168559196651434',
            'https://www1.hkexnews.hk/app/sehk/2026/108488/a132496/sehk26043002932_c.pdf',
            'https://www1.hkexnews.hk/app/sehk/2026/108488/a132496/sehk26043002919_c.pdf',
            'https://www1.hkexnews.hk/app/sehk/2026/108488/a132496/sehk26043002920_c.pdf',
        ],
        'confidence': 0.8,
        'verify_note': (
            'The legal entity comes from Lalamove\'s own "Lalamove Entities" page (last modified Apr '
            '2025): Indonesia — PT LALAMOVE LOGISTIK INDONESIA. The Ministry of Law registry '
            '(business number 940376, via companieshouse.id) has it at Mandiri Inhealth Tower Lt. 25 '
            'Zone ABCDE, Jl. Prof. Dr. Satrio Kav. E-IV No. 6, Mega Kuningan — used here. Earlier '
            'offices on the record: Wirausaha Building Lt. 4 (Jobstreet\'s 2018-era profile) and '
            'Tempo Scan Tower Lt. 26 (university career-centre listings), all in Setiabudi. '
            'OWNERSHIP, from Lalatech\'s own HKEX prospectus (30 Apr 2026): Indonesian law bars a '
            'foreign postal operator from owning shares in an Indonesian courier company (MOCI '
            'regulation 4/2021), so PT Lalamove Logistik Indonesia is held 50/50 by two Indonesian '
            'nominee companies — PT Cahaya Utara Grup and PT Cahaya Utara Teknologi Grup, both '
            'ultimately held 99%/1% by named independent Indonesians — and Lalatech controls and '
            'consolidates it through contractual arrangements (loans, share pledges, dividend '
            'transfer and call options benefiting Lalamove Indonesia, a BVI company). A second '
            'Indonesian entity, PT Lala Autobot Indonesia (99% group-owned), runs the vehicle-'
            'services arm. The group\'s own milestone table dates the Indonesia expansion to 2018, '
            'matching JPNN\'s Nov 2018 launch report; founded in Hong Kong in 2013. Operating as of '
            'Aug 2026 — site live, active job listings, and 26.3M Jakarta orders filed for 2025.'),
        'id': 'lalamove-indonesia',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'id_only': True,
        'global_parent': {
            'group': 'Lalatech Holdings Limited (Lalamove)',
            'listing': None,
            'domicile': 'Hong Kong',
            'group_valuation_usd_m': None,
            'group_valuation_asof': None,
            'indonesia_basis': None,
            'group_funding': ('US$515M Series E, Dec 2020; backers include Hillhouse, Sequoia China '
                              'and Tencent; eight HKEX IPO filings since Mar 2023, latest 30 Apr 2026 '
                              '— global GTV US$13.32B in 2025'),
        },
        'lat': -6.22465, 'lon': 106.82712,
        'geocode_src': 'photon:Jl. Prof. Dr. Satrio, Mega Kuningan — street match',
        'geocode_kind': 'street',
    },
    {
        'name': 'Deliveree Indonesia',
        'legal_name': 'PT Angkut Teknologi Indonesia',
        'sector': 'logistics — on-demand trucking and cargo platform',
        'in_dki': True,
        'hq_address': ('Wisma Anugraha Lt. 2, Jl. Taman Kemang No. 32B, Bangka, Mampang Prapatan, '
                       'Jakarta Selatan 12730'),
        'kecamatan': 'Mampang Prapatan',
        'kota': 'Jakarta Selatan',
        'url': 'https://www.deliveree.com/id',
        'funding_total_usd_m': None,
        'last_round': 'Series C (US$70M, Jun 2022) — at group level',
        'last_round_year': 2022,
        'funding_note': (
            'Not an Indonesian figure, so none is published. Deliveree\'s US$109M (its own press '
            'release, Jun 2022) was raised by the group covering Thailand, Indonesia and the '
            'Philippines — the US$70M Series C was led by Gobi Partners and SPIL Ventures (the venture '
            'arm of Indonesian shipping line SPIL) with Inspire Ventures. The Indonesian company has '
            'raised nothing of its own.'),
        'valuation_usd_m': None,
        'valuation_note': (
            'No figure on record. Deliveree Private Limited is private, disclosed no valuation with '
            'its 2022 Series C, and reports nothing by country.'),
        'employees_est': None,
        'employees_note': (
            'INDONESIAN PAYROLL ONLY, and no publishable figure exists. Group-wide counts spread '
            'widely — 606 on the group\'s LinkedIn page (Bangkok HQ, read live 30 Aug 2026), 1,113 '
            'per Revelio Labs\' workforce model (Mar 2026), ~500-550 per TechCrunch and investor '
            'material in 2022 — and none of them is split by country. The Indonesian entity was '
            'actively hiring on Jobstreet (16 open roles, 30 Aug 2026). The ~100,000 drivers on the '
            'platform are partner-contractors (mitra) and are not counted in any case.'),
        'investors': [],
        'sources': [
            'https://www.deliveree.com/id/ekspedisi/deliveree-adalah-pt-angkut-teknologi-indonesia/',
            'https://companieshouse.id/angkut-teknologi-indonesia',
            'https://www.deliveree.com/id/en/press-release/deliveree-series-c-logistics-technology-investment/',
            'https://techcrunch.com/2022/06/26/deliveree-is-smoothing-southeast-asias-bumpy-logistics-landscape/',
            'https://www.deliveree.com/id/kontak-kantor-lokasi/',
            'https://www.linkedin.com/company/deliveree-on-demand-logistics-southeast-asia',
            'https://www.reveliolabs.com/companies/deliveree/employees',
            'https://id.jobstreet.com/companies/deliveree-168551841391662',
        ],
        'confidence': 0.8,
        'verify_note': (
            'The legal entity comes from Deliveree\'s own site: "Nama legal Deliveree adalah PT Angkut '
            'Teknologi Indonesia." The Ministry of Law registry (business number 723432, via '
            'companieshouse.id) and the company\'s own contact page agree on the head office — '
            '"Kantor pusat Deliveree berada di Jakarta Selatan, Kemang": Wisma Anugraha Lt. 2, Jl. '
            'Taman Kemang No. 32B. Registered and operating addresses match, which is rare. The '
            'parent is Deliveree Private Limited (named in its own privacy policy), founded 2015, '
            'group HQ Bangkok per its LinkedIn page. Operating as of Aug 2026.'),
        'id': 'deliveree-indonesia',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'id_only': True,
        'global_parent': {
            'group': 'Deliveree Private Limited (Deliveree Group)',
            'listing': None,
            'domicile': 'Singapore-incorporated; operating HQ Bangkok',
            'group_valuation_usd_m': None,
            'group_valuation_asof': None,
            'indonesia_basis': None,
            'group_funding': ('US$109M raised 2015-2022, incl. US$70M Series C (Jun 2022) led by Gobi '
                              'Partners and SPIL Ventures with Inspire Ventures'),
        },
        'lat': -6.25785, 'lon': 106.80978,
        'geocode_src': 'photon:Wisma Anugraha, Jl. Taman Kemang 32B',
        'geocode_kind': 'building',
    },
    {
        'name': 'Borzo Indonesia (ex MrSpeedy)',
        'legal_name': 'PT Incrin Indonesia Kurir',
        'sector': 'logistics — same-day courier delivery',
        'in_dki': True,
        'hq_address': ('Cohive 101, Jl. Mega Kuningan Barat No. 8, Kuningan Timur, Setiabudi, '
                       'Jakarta Selatan 12950'),
        'kecamatan': 'Setiabudi',
        'kota': 'Jakarta Selatan',
        'url': 'https://borzodelivery.com/id',
        'funding_total_usd_m': None,
        'last_round': 'US$35M round (Mubadala-led, 2021) — at group level',
        'last_round_year': 2021,
        'funding_note': (
            'Not an Indonesian figure, so none is published. Dostavista, the group behind MrSpeedy, '
            'raised US$35M led by Mubadala in Aug 2021 and rebranded the whole network Borzo (detik). '
            'The Indonesian company has raised nothing of its own.'),
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. The Borzo group is private and has published no mark since 2021.',
        'employees_est': 40,
        'employees_asof': '2026-08',
        'employees_tier': 5,
        'employees_src': 'https://www.linkedin.com/company/borzo',
        'employees_li': 126,
        'employees_li_asof': '2026-08-30',
        'employees_exa': 40,
        'employees_note': (
            'INDONESIAN PAYROLL ONLY, from a workforce model — Exa\'s company record read 30 Aug 2026 '
            'gives 40 (-2.3% YoY). The LinkedIn page itself lists 126 members, but Borzo\'s couriers '
            'are independent contractors by its own terms and courier profiles visibly sit in that '
            '126, so the page count would count mitra and is kept only as a cross-check. '
            'Self-declared band 51-200.'),
        'investors': [],
        'sources': [
            'https://borzodelivery.com/id/terms-and-conditions',
            'https://www.linkedin.com/company/borzo',
            'https://finance.detik.com/berita-ekonomi-bisnis/d-5702824/dapat-dana-us-35-juta-dostavista-induk-mrspeedy-ganti-jadi-borzo',
            'https://play.google.com/store/apps/details?hl=id&id=global.dostavista.courier',
        ],
        'confidence': 0.7,
        'verify_note': (
            'The legal entity comes from Borzo\'s own Terms and Conditions: ""Borzo" mengacu kepada '
            'PT INCRIN INDONESIA KURIR" — the same document that defines couriers as independent '
            'contractors, which is why none of them count here. Office from its own LinkedIn page: '
            'Cohive 101 (coworking), Jl. Mega Kuningan Barat 8, Kuningan Timur. Entered Indonesia as '
            'MrSpeedy (page says founded 2017); the group, Dostavista, was founded in Russia in 2012 '
            'and rebranded Borzo in 2021. Operating as of Aug 2026: site live, and its LinkedIn '
            'announced a partnership with Blitz Electric Mobility (also in this census) in Dec 2025.'),
        'id': 'borzo-indonesia',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'id_only': True,
        'global_parent': {
            'group': 'Borzo (formerly Dostavista / MrSpeedy)',
            'listing': None,
            'domicile': 'founded in Russia, 2012; global same-day delivery network',
            'group_valuation_usd_m': None,
            'group_valuation_asof': None,
            'indonesia_basis': None,
            'group_funding': 'US$35M led by Mubadala (Aug 2021), announced with the global rebrand from Dostavista to Borzo',
        },
        'lat': -6.22921, 'lon': 106.82502,
        'geocode_src': 'photon:Jalan Mega Kuningan Barat — street match; Cohive 101 at No. 8',
        'geocode_kind': 'street',
    },
    {
        'name': 'iDexpress (ID Express)',
        'legal_name': 'PT IDexpress Service Solution',
        'sector': 'logistics — last-mile parcel delivery network',
        'in_dki': True,
        'hq_address': ('Menara Tendean (M-Ten), Jl. Kapten Tendean No. 20C, Kuningan Barat, '
                       'Mampang Prapatan, Jakarta Selatan 12710'),
        'kecamatan': 'Mampang Prapatan',
        'kota': 'Jakarta Selatan',
        'url': 'https://idexpress.com',
        'funding_total_usd_m': None,
        'last_round': None,
        'last_round_year': None,
        'funding_note': (
            'No round on record — no funding announcement or credible tracker entry exists for '
            'iDexpress; as far as the public record goes it is privately funded. Founded in 2019 by '
            'J&T Express alumni (founder Charles Lim was President Director at PT Global Ekspress '
            'Sukses Abadi and Regional GM at PT Global Jet Express, both J&T).'),
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. Private, never marked.',
        'employees_est': 1278,
        'employees_asof': '2026-08-30',
        'employees_tier': 4,
        'employees_src': 'https://id.linkedin.com/company/idexpress',
        'employees_li': 1278,
        'employees_li_asof': '2026-08-30',
        'employees_exa': 543,
        'employees_spread': True,
        'employees_note': (
            '1,278 on its LinkedIn page, read live 30 Aug 2026 — a FLOOR that is mostly desk staff. '
            'The company self-declares 10,001+ on the same page and reported 20,000 "tenaga kerja" in '
            'Dec 2020 (Merdeka, via Wikipedia), but whether its couriers are payroll (as J&T\'s are) '
            'or mitra is not published, and no current company figure exists — so the live count '
            'stands and the true payroll may be far higher. Workforce models run lower (Exa company '
            'record: 543), recorded as the spread.'),
        'investors': [],
        'sources': [
            'https://id.linkedin.com/company/idexpress',
            'https://idexpress.com/bantuan/hubungi-kami',
            'https://id.wikipedia.org/wiki/ID_Express',
            'https://www.emis.com/php/company-profile/ID/Pt_Idexpress_Service_Solution_en_12845054.html',
            'https://www.linkedin.com/posts/charles-lim-236a1b1ba_idexpress-indonesia-company-profile-activity-6755659788551536640-9qiJ',
            'https://datakarir.com/employer/id-express/',
        ],
        'confidence': 0.7,
        'verify_note': (
            'A technology-built courier, not an incumbent: founded March 2019 by J&T Express alumni '
            '(Charles Lim; Francis Anugerah is co-founder/CEO per The Org), scaled on marketplace '
            'volume. LinkedIn\'s own entity name is "IDexpress Service Solution"; EMIS has PT '
            'IDexpress Service Solution established 20 Feb 2019 (2024 net sales +16%), and a second '
            'entity, PT IDexpress Logistik Indonesia, also exists (Wikipedia uses it) — the Service '
            'Solution company is used here as the operator. Head office from its own contact page: '
            'Menara Tendean (M-Ten), Jl. Kapten Tendean 20C, Mampang Prapatan (EMIS\'s registered '
            'address is in North Jakarta — operating office used, as on every row). Operating as of '
            'Aug 2026.'),
        'id': 'idexpress',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'lat': -6.23951, 'lon': 106.82451,
        'geocode_src': 'photon:Menara Tendean, Jl. Kapten Tendean',
        'geocode_kind': 'building',
    },
    {
        'name': 'Coldspace',
        'legal_name': 'PT Rantai Dingin Asia',
        'sector': 'logistics — cold-chain warehousing and refrigerated delivery',
        'in_dki': True,
        'hq_address': ('Wisma Staco, Jl. Raya Casablanca Kav. 18, Menteng Dalam, Tebet, '
                       'Jakarta Selatan 12870'),
        'kecamatan': 'Tebet',
        'kota': 'Jakarta Selatan',
        'url': 'https://coldspace.id',
        'funding_total_usd_m': 3.8,
        'last_round': 'Seed (US$3.8M) — led by Intudo Ventures with ASSA and Triputra Group',
        'last_round_year': 2023,
        'funding_src': 'https://technode.global/2023/05/03/indonesias-coldspace-raises-3-8m-seed-fund-led-by-intudo-ventures-assa-triputra-group/',
        'funding_src_tier': 'announced',
        'funding_src_all': [
            'https://technode.global/2023/05/03/indonesias-coldspace-raises-3-8m-seed-fund-led-by-intudo-ventures-assa-triputra-group/',
            'https://www.businesstimes.com.sg/startups-tech/startups/indonesian-cold-chain-solutions-provider-coldspace-bags-us38-million-seed',
        ],
        'valuation_usd_m': None,
        'valuation_note': 'No figure on record. Private, seed-stage.',
        'employees_est': 79,
        'employees_asof': '2026-08-30',
        'employees_tier': 4,
        'employees_src': 'https://www.linkedin.com/company/coldspace-id',
        'employees_li': 79,
        'employees_li_asof': '2026-08-30',
        'employees_note': ('79 on its LinkedIn page, read live 30 Aug 2026; self-declared band '
                           '51-200 corroborates.'),
        'investors': ['Intudo Ventures', 'Adi Sarana Armada (ASSA)', 'Triputra Group', 'SHB Group'],
        'sources': [
            'https://technode.global/2023/05/03/indonesias-coldspace-raises-3-8m-seed-fund-led-by-intudo-ventures-assa-triputra-group/',
            'https://www.linkedin.com/company/coldspace-id',
            'https://companieshouse.id/rantai-dingin-asia',
            'https://id.jobstreet.com/companies/pt-rantai-dingin-asia-175608087536485',
            'https://coldspace.id',
        ],
        'confidence': 0.75,
        'verify_note': (
            'Integrated cold-chain startup founded 2022: cold storage, reefer trucking and frozen '
            'fulfilment — its own LinkedIn About says "backed by Triputra Group, ASSA Group & SHB '
            'Group" (ASSA also owns Anteraja, already in this census). US$3.8M seed announced May '
            '2023, led by Intudo Ventures with ASSA and Triputra. Hiring runs through PT Rantai '
            'Dingin Asia (Jobstreet, ISLoker), registered at Wisma Staco, Jl. Raya Casablanca '
            '(Ministry registry no. 1310866, via companieshouse.id) — used as the operator here; its '
            'LinkedIn page also names PT Perintis Sempurna Bersama, recorded as a related entity. '
            'Operating as of Aug 2026 — site live, LinkedIn active days before this read.'),
        'id': 'coldspace',
        'site_status': 'ok',
        'liveness_checked': TODAY,
        'lat': -6.22447, 'lon': 106.84034,
        'geocode_src': 'photon:Wisma Staco, Jl. Casablanca, Tebet',
        'geocode_kind': 'building',
    },
]

# Considered with this cohort, and where the line fell. Upsert-by-name — never
# assign the list wholesale (census-banks lesson), and never touch scope['rule']
# here (it carries the Bandung geography sentence this script must not clobber).
SCOPE = [
    {
        'name': 'Maxim (PT Teknologi Perdana Indonesia)',
        'why': ('the Indonesian arm of Maxim, a Russian dispatch company that has grown without '
                'outside capital since 2003 (founder Maksim Belonogov: the service reached the top '
                'tier of Russian ride-hailing "without attracting investment") and now runs in 18 '
                'countries. A foreign incumbent expanding, not a tech- or venture-built startup — '
                'and its drivers are mitra besides. In Indonesia since 2018.'),
        'sources': [
            'https://en.wikipedia.org/wiki/Taxi_Maxim',
            'https://niva-kurtamysh.com/news/maksim-belonogov-my-izobreli-taksi-zanovo',
            'https://linkedin.com/company/maximid',
        ],
    },
    {
        'name': 'inDrive Indonesia',
        'why': ('not excluded — queued: visibly operating (a country manager was introduced in Nov '
                '2025 on inDrive\'s own blog, and the company publicly engaged Perpres 27/2026 and '
                'Kemendag\'s PMSE rules in 2026), but its legal documents are global and no '
                'Indonesian PT can be pinned from public record. Confirm the entity and a payroll '
                'before adding.'),
        'sources': [
            'https://blog.indrive.com/id-id/article/indrive-perkenalkan-country-manager-indonesia-dan-ungkap-rencana-strategis-menuju-2026',
            'https://money.kompas.com/read/2026/05/07/135800726/perpres-ojol-terbit-indrive-siap-patuh-tapi-ingatkan-batas-komisi',
        ],
    },
    {
        'name': 'JNE, TIKI, Pos Indonesia, Wahana, RPX, SAP Express',
        'why': ('conventional courier incumbents — decades-old delivery businesses (SAP Express is '
                'IDX-listed but grew as a traditional courier), not tech- or venture-built '
                'platforms. The census\'s courier rows — J&T, SiCepat, Anteraja, Ninja Xpress, '
                'iDexpress — all began as technology companies.'),
    },
    {
        'name': 'GoSend, GoBox, GrabExpress, Shopee Xpress (SPX)',
        'why': ('in-app delivery arms of GoTo, Grab Indonesia and Shopee Indonesia — product lines '
                'of rows already counted, so a separate row would double-count (the Jenius rule). '
                'PT Nusantara Ekspres Kilat is Shopee Xpress, not a standalone company.'),
    },
]

RITASE = {
    'name': 'Ritase',
    'fate': 'acquired-then-closed',
    'confidence': 'reported',
    'sector': 'Logistics — digital trucking platform',
    'city': 'Jakarta',
    'founded': '2016',
    'ended': '2023-11',
    'funding_usd_m': 12.9,
    'why': ('One of Indonesia\'s first digital-trucking platforms (founded by Iman Kusnadi and David '
            'Samuel), matching shippers with transporters at tens of thousands of shipments a month. '
            'Raised a US$8.5M Series A led by Golden Gate Ventures with Jafco Asia and ZWC in Jul '
            '2019, on top of US$4.4M of seed and pre-Series A money from Insignia Ventures, '
            'Mitsubishi Corporation, BEENEXT, Skystar Capital and Agung — about US$12.9M in all '
            '(KrASIA, citing the company). Through 2023 Tech in Asia reported distress-sale talks '
            'after mass layoffs, and on 24 Nov 2023 DealStreetAsia reported that Meratus, the '
            'Surabaya maritime logistics group, had bought its technology assets. ritase.com no '
            'longer resolves (HTTP 404 on apex and www, checked 30 Aug 2026). Marked REPORTED: the '
            'company itself published no closure notice, and the asset sale is sourced to '
            'DealStreetAsia\'s reporting.'),
    'sources': [
        'https://www.dealstreetasia.com/stories/meratus-ritase-deal-372048',
        'https://www.techinasia.com/indonesia-trucking-startup-ritase-talks-potential-buyer-mass-layoff',
        'https://kr-asia.com/indonesian-logistic-platform-ritase-snags-usd-8-5-million-series-a-funding',
        'https://hybrid.co.id/post/ritase-announces-series-a-funding-worth-of-120-billion-rupiah/',
    ],
}


def write_json(path, obj):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    before = len(raw['companies'])
    shutil.copyfile(RAW, RAW + '.bak-logistics')

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

    write_json(RAW, raw)
    print(f'census-raw.json: {before} -> {len(raw["companies"])} companies '
          f'(backup: census-raw.json.bak-logistics)')
    print(f'  added   {len(added)}: ' + ', '.join(added))
    print(f'  updated {len(updated)}: ' + ', '.join(updated))
    print(f'  scope: {len(sc)} outside lines ({len(SCOPE)} owned here)')

    closed = json.load(open(CLOSED, encoding='utf-8'))
    ent = closed.setdefault('entries', [])
    hit = [e for e in ent if e.get('name') == RITASE['name']]
    if hit:
        hit[0].update(json.loads(json.dumps(RITASE)))
        print('closed.json: Ritase updated')
    else:
        ent.append(json.loads(json.dumps(RITASE)))
        print(f'closed.json: Ritase added ({len(ent)} entries)')
    write_json(CLOSED, closed)


main()
