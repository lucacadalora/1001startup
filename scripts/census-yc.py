#!/usr/bin/env python3
"""Merge the Y Combinator × Indonesia cohort into data/census-raw.json.

Source of truth for the cohort: the YC public company directory
(yc-oss.github.io/api mirror, refreshed 2026-08-29), filtered on
all_locations/regions containing "Indonesia" -> 31 companies. Every company
was then verified against its own site, the Ministry of Law company registry
(companieshouse.id), LinkedIn and the round announcements before being added.

What this does, once:
  1. merges the Jack / Transfez duplicate (same PT Indo Koala Remittance),
  2. tags every census company that is a YC alum with `yc_batch`,
  3. appends the Greater-Jakarta YC alumni that were missing,
  4. records the out-of-region / non-Indonesian YC entries in `yc_outside`
     so the gap is documented instead of silently dropped.

Idempotent: re-running only refreshes yc_batch tags and yc_outside.
    python3 scripts/census-yc.py && node scripts/build-census.js
"""
import json, os, sys

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-raw.json')
YC = 'https://www.ycombinator.com/companies/'

# --- 1. YC batch tags for companies already in the census -------------------
EXISTING = {
    'xendit': 'S15', 'ajaib': 'S18', 'shipper': 'W19', 'edenfarm': 'S19',
    'bukuwarung': 'S20', 'pahamify': 'W20', 'verihubs': 'S21', 'sirka': 'S21',
    'fresh-factory': 'W22', 'jack': 'W22',
}

# --- 2. YC alumni missing from the census (all Greater Jakarta) -------------
NEW = [
 {
  "name": "FAZZ", "id": "fazz", "yc_batch": "S17",
  "legal_name": "PT Payfazz Teknologi Nusantara (group holdco: Fazz Financial Group Pte Ltd, Singapore)",
  "sector": "fintech: payments — B2B neobank, payment acceptance and business accounts",
  "in_dki": True,
  "hq_address": "Ratu Plaza Office Tower Lt. 12, Jl. Jenderal Sudirman Kav. 9, Gelora, Tanah Abang, Jakarta Pusat 10270",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "url": "https://fazz.com",
  "funding_total_usd_m": 179, "last_round": "Series C", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 500,
  "employees_note": "Revelio Labs: 766 staff group-wide (Mar 2026), ~75% Indonesia; indexed.vc band 201-500. Jakarta-side estimate 500 — wide band, see caveats.",
  "investors": ["Tiger Global", "DST Investment", "B Capital", "Insignia Ventures Partners", "ACE & Company", "Y Combinator", "Lendable (debt)"],
  "sources": [
    "https://techcrunch.com/2022/09/13/southeast-asian-fintech-fazz-raises-100m-series-c-to-serve-businesses-of-all-sizes/",
    "https://fazz.com/id/privacy-policy/",
    YC + "fazz"],
  "confidence": 0.75,
  "verify_note": "Payfazz (YC S17) merged with Xfers (YC S15) into Fazz. Indonesian operating entity PT Payfazz Teknologi Nusantara per its own privacy policy; Jakarta office address from the fazz.com footer (Aug 2026). US$100M Series C Sep 2022 (US$75M equity + US$25M debt); US$179M total across 5 rounds per aggregators.",
 },
 {
  "name": "Latent Space (Halo AI)", "id": "latent-space", "yc_batch": "S22",
  "legal_name": None,
  "sector": "AI — applied AI agents for sales and customer experience (Halo AI, GoVisa, Supa)",
  "in_dki": True,
  "hq_address": "Satrio Tower, Jl. Prof. Dr. Satrio Kav. C4, Kuningan, Setiabudi, Jakarta Selatan 12950",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  "url": "https://www.haloai.co.id",
  "funding_total_usd_m": None, "last_round": None, "last_round_year": None,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 41,
  "employees_note": "LinkedIn Aug 2026: 27 on the Halo AI page + 14 on the LatentSpace page; the YC directory self-reports 100.",
  "investors": ["Y Combinator"],
  "sources": [YC + "latent-space", "https://www.haloai.co.id/", "https://linkedin.com/company/haloaicx"],
  "confidence": 0.6,
  "verify_note": "Halo AI is the flagship product of Latent Space (YC S22), founded by Faza Fahleraz, Gery Nugraha and Albert Sahala; the Android package id is com.latentspace.haloaimobile. Address and founding year 2023 from the schema.org block on haloai.co.id. No disclosed round we can confirm — trackers disagree (one shows US$8M, another none) and a US$6M round widely tagged 'Halo AI' belongs to a same-named MENA company, so funding is left blank rather than guessed.",
 },
 {
  "name": "Titipku", "id": "titipku", "yc_batch": "S21",
  "legal_name": "PT Terang Bagi Bangsa",
  "sector": "commerce — hyperlocal marketplace for traditional-market grocers",
  "in_dki": False,
  "hq_address": "Foresta Business Loft 2, Jl. BSD Raya Utama No. 29, Pagedangan, Kabupaten Tangerang, Banten 15339",
  "kecamatan": "Pagedangan", "kota": "Kabupaten Tangerang",
  "url": "https://titipku.com",
  "funding_total_usd_m": 0.125, "last_round": "Seed", "last_round_year": 2021,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 47,
  "employees_note": "LinkedIn: 47 employees (Aug 2026, -4.9% YoY).",
  "investors": ["Y Combinator"],
  "sources": [YC + "titipku", "https://titipku.com", "https://tracxn.com/d/companies/titipku"],
  "confidence": 0.7,
  "verify_note": "Founded 2017 in Yogyakarta; the site footer now gives the BSD (Pagedangan) office, so it is counted as Bodetabek. US$125K disclosed (YC standard deal) is the only figure trackers agree on.",
 },
 {
  "name": "CrediBook", "id": "credibook", "yc_batch": "W22",
  "legal_name": "PT Ruang Dagang Internasional",
  "sector": "B2B commerce — MSME bookkeeping and wholesale ordering (CrediMart)",
  "in_dki": True,
  "hq_address": "Panin Tower Senayan City Lt. 12, Jl. Asia Afrika Lot 19, Gelora, Tanah Abang, Jakarta Pusat 10270",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "url": "https://credibook.com",
  "funding_total_usd_m": 10.1, "last_round": "Series A", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 17,
  "employees_note": "LinkedIn: 17 employees (Aug 2026); contact databases hold 29 records and the profile band reads 11-50 — down sharply from the 2022 peak.",
  "investors": ["Monk's Hill Ventures", "Insignia Ventures Partners", "Wavemaker Partners", "Y Combinator"],
  "sources": [
    "https://www.monkshill.com/content-hub/credibook-raises-series-a-funding-to-build-a-robust-digital-ecosystem-for-smes-led-by-monks-hill-ventures",
    "https://credibook.com/", YC + "credibook"],
  "confidence": 0.75,
  "verify_note": "US$8.1M Series A led by Monk's Hill (Apr 2022) on top of a Jan 2021 round; US$10.1M total across 3 rounds. Address from the credibook.com footer.",
 },
 {
  "name": "Dealls", "id": "dealls", "yc_batch": "W22",
  "legal_name": "PT SejutaCita Anak Muda Indonesia",
  "sector": "HR tech — job marketplace, ATS and mentoring platform",
  "in_dki": True,
  "hq_address": "Conclave Simatupang, Kawasan Komersial Cilandak No. 410, Jl. Cilandak KKO, Cilandak Timur, Pasar Minggu, Jakarta Selatan 12560",
  "kecamatan": "Pasar Minggu", "kota": "Jakarta Selatan",
  "url": "https://dealls.com",
  "funding_total_usd_m": 0.5, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 300,
  "employees_note": "Trackers disagree by an order of magnitude: LinkedIn profile count 651 (Aug 2026, -23% YoY), Seedtable 300, PitchBook 97. 300 used; treat as +/-2x.",
  "investors": ["Y Combinator", "Goodwater Capital", "Hummingbird Ventures"],
  "sources": [YC + "dealls-jobs-and-mentoring", "https://companieshouse.id/sejutacita-anak-muda-indonesia", "https://seedtable.com/companies/dealls-jobs-and-mentoring"],
  "confidence": 0.5,
  "verify_note": "Founded 2020 by Andhika Sudarman as SejutaCita, now Dealls (jobs, ATS, mentoring). Registered address from the Ministry of Law registry (Conclave Simatupang). Headcount is the weakest field in this row.",
 },
 {
  "name": "PINA", "id": "pina", "yc_batch": "W22",
  "legal_name": "PT Pina Aplikasi Bersama",
  "sector": "fintech: wealth — financial planning and wealth management app",
  "in_dki": True,
  "hq_address": "Jl. Tentara Pelajar, Grogol Utara, Kebayoran Lama, Jakarta Selatan 12210",
  "kecamatan": "Kebayoran Lama", "kota": "Jakarta Selatan",
  "url": "https://pina.id",
  "funding_total_usd_m": 3.1, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 8,
  "employees_note": "LinkedIn: 8 employees (Aug 2026, -33% YoY).",
  "investors": ["AC Ventures", "Vibe.VC", "Y Combinator", "XA Network"],
  "sources": ["https://techcrunch.com/2022/07/03/pina-offers-wealth-management-for-indonesias-growing-middle-to-upper-class/", "https://pina.id", YC + "pina"],
  "confidence": 0.7,
  "verify_note": "US$3M seed announced Jul 2022 (AC Ventures, Vibe.VC, YC, XA Network); US$3.1M total across 2 rounds. Founded 2021 by Daniel van Leeuwen. Street-level address only (Jl. Tentara Pelajar, 12210) — no building given publicly.",
 },
 {
  "name": "Finku", "id": "finku", "yc_batch": "W22",
  "legal_name": "PT Sahabat Finansial Kamu",
  "sector": "fintech — personal finance manager and budgeting app",
  "in_dki": True,
  "hq_address": "Jl. Pejompongan III B No. 9, Bendungan Hilir, Tanah Abang, Jakarta Pusat 10210",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "url": "https://finku.id",
  "funding_total_usd_m": 2.9, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 28,
  "employees_note": "LinkedIn: 28 employees (Aug 2026, -39% YoY).",
  "investors": ["Y Combinator"],
  "sources": [YC + "finku", "https://finku.id", "https://linkedin.com/company/finku"],
  "confidence": 0.65,
  "verify_note": "OJK-recorded, Kominfo-registered, AFTECH/AFPI member per its own footer, which is also the source of the address. US$2.9M total across 3 rounds per aggregators; individual rounds not announced publicly.",
 },
 {
  "name": "Finnix", "id": "finnix", "yc_batch": "W22",
  "legal_name": None,
  "sector": "fintech — financing and financial tools for event organisers and creative businesses",
  "in_dki": True,
  "hq_address": None,
  "kecamatan": None, "kota": "Jakarta",
  "url": "https://www.finnix.id",
  "funding_total_usd_m": 0.5, "last_round": "Convertible note", "last_round_year": 2021,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 13,
  "employees_note": "YC directory team size 13 (self-reported); the LinkedIn page lists 1 — likely near-dormant, so this row is low confidence.",
  "investors": ["Y Combinator"],
  "sources": [YC + "finnix", "https://www.finnix.id/", "https://www.cbinsights.com/company/finnix"],
  "confidence": 0.4,
  "verify_note": "Site live (event financing, sponsorship and event-tech services) and YC still lists it Active, but no PT, no office address and a one-person LinkedIn page. Kept with an explicit low-confidence flag rather than dropped.",
 },
 {
  "name": "Jutsoo", "id": "jutsoo", "yc_batch": "W22",
  "legal_name": "PT Banana Niaga Natura",
  "sector": "fintech — treasury management and multi-bank connectivity for finance teams",
  "in_dki": True,
  "hq_address": "Ruko French Walk Mall of Indonesia Blok G No. 3, Jl. Boulevard Barat Raya No. 12, Kelapa Gading Barat, Kelapa Gading, Jakarta Utara 14240",
  "kecamatan": "Kelapa Gading", "kota": "Jakarta Utara",
  "url": "https://www.jutsoo.com",
  "funding_total_usd_m": 0.5, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 9,
  "employees_note": "LinkedIn: 9 employees (Aug 2026); the YC directory shows 12.",
  "investors": ["Y Combinator"],
  "sources": [YC + "jutsoo", "https://www.jutsoo.com/en/legal/terms", "https://companieshouse.id/banana-niaga-natura"],
  "confidence": 0.7,
  "verify_note": "Same entity (PT Banana Niaga Natura, founders Mario Gaw and Kristian Sinaulan) that went through YC W22 as the grocery app Bananas, now a treasury platform. Registered address from the Ministry of Law registry.",
 },
 {
  "name": "UpBanx", "id": "upbanx", "yc_batch": "W22",
  "legal_name": "PT UpBanx Global Indonesia",
  "sector": "fintech — business accounts and financing for D2C brands and creators",
  "in_dki": True,
  "hq_address": "Neo Soho Podomoro City Lt. 12 Unit 1208, Jl. Letjen S. Parman Kav. 28, Tanjung Duren Selatan, Grogol Petamburan, Jakarta Barat 11470",
  "kecamatan": "Grogol Petamburan", "kota": "Jakarta Barat",
  "url": "https://upbanx.com",
  "funding_total_usd_m": 5.6, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 18,
  "employees_note": "LinkedIn: 18 employees (Aug 2026, -8.7% YoY); PitchBook 21.",
  "investors": ["Y Combinator", "Alpha JWC Ventures", "Alto Partners", "CreditEase", "Oliver Jung"],
  "sources": [YC + "upbanx", "https://companieshouse.id/upbanx-global-indonesia", "https://pitchbook.com/profiles/company/489601-27"],
  "confidence": 0.7,
  "verify_note": "US$5.6M raised per the company's own YC profile; PitchBook records US$5.2M. Registered address (Neo Soho unit 1208) from the Ministry of Law registry; the entity name is confirmed in its own terms of service.",
 },
 {
  "name": "StafBook", "id": "stafbook", "yc_batch": "W22",
  "legal_name": "PT Stafbook Teknologi Asia",
  "sector": "SaaS — HR, payroll and expense management for SMEs",
  "in_dki": True,
  "hq_address": "Jl. Letjen S. Parman No. 28, Tanjung Duren Selatan, Grogol Petamburan, Jakarta Barat 11470",
  "kecamatan": "Grogol Petamburan", "kota": "Jakarta Barat",
  "url": "https://stafbook.com",
  "funding_total_usd_m": 0.5, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 15,
  "employees_note": "LinkedIn: 15 employees (Aug 2026, -47% YoY).",
  "investors": ["Y Combinator"],
  "sources": [YC + "stafbook", "https://stafbook.com", "https://www.cbinsights.com/company/stafbook"],
  "confidence": 0.7,
  "verify_note": "Founded 2021 by Fransiskus Raymond and Ghuniyu Fattah Rozaq; address from the stafbook.com footer, US$500K total per CB Insights.",
 },
 {
  "name": "Sekilo", "id": "sekilo", "yc_batch": "W22",
  "legal_name": "PT Dropezy Maju Indonesia",
  "sector": "agritech — halal poultry processing and distribution for foodservice",
  "in_dki": True,
  "hq_address": "Gapura Cideng Lt. 11, Jl. Suryopranoto No. 12A, Petojo Selatan, Gambir, Jakarta Pusat 10130",
  "kecamatan": "Gambir", "kota": "Jakarta Pusat",
  "url": "https://sekilo.com",
  "funding_total_usd_m": 3.0, "last_round": "Pre-Series A", "last_round_year": 2025,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 11,
  "employees_note": "LinkedIn: 11 employees on the Sekilo page (Aug 2026); 19 remain on the legacy Dropezy page.",
  "investors": ["Forge Ventures", "Y Combinator"],
  "sources": [YC + "sekilo", "https://www.forge.vc/portfolio/sekilo", "https://companieshouse.id/dropezy-maju-indonesia"],
  "confidence": 0.5,
  "verify_note": "Same entity as Dropezy (YC W22 grocery app), rebranded to Sekilo in 2023 after pivoting to poultry supply. US$3M total per CB Insights under the Dropezy entity; a US$2.5M pre-Series A led by Forge Ventures is reported post-rebrand (Forge lists Sekilo in its portfolio) but the amount is not confirmed by a primary source, so the conservative total is used.",
 },
 {
  "name": "Materee", "id": "materee", "yc_batch": "S22",
  "legal_name": "PT Materee Nusantara Utama",
  "sector": "commerce — B2B e-commerce for construction materials",
  "in_dki": True,
  "hq_address": "The City Tower Lt. 12 Unit 1N, Jl. M.H. Thamrin No. 81, Menteng, Jakarta Pusat 10310",
  "kecamatan": "Menteng", "kota": "Jakarta Pusat",
  "url": "https://materee.id",
  "funding_total_usd_m": 3.6, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 23,
  "employees_note": "LinkedIn: 23 employees (Aug 2026, +3% YoY).",
  "investors": ["Y Combinator"],
  "sources": [YC + "materee", "https://materee.id/products", "https://companieshouse.id/materee-nusantara-utama"],
  "confidence": 0.7,
  "verify_note": "Founded 2022 by Hansel (ex-GudangAda). Address matches on both the site footer and the Ministry of Law registry. US$3.6M total across 5 rounds per aggregators; individual rounds undisclosed.",
 },
 {
  "name": "Proglix", "id": "proglix", "yc_batch": "W23",
  "legal_name": "PT Sinari Generasi Indonesia (group: Proglix Commerce Pte Ltd, Singapore)",
  "sector": "commerce — B2B marketplace for steel and metal raw materials",
  "in_dki": False,
  "hq_address": "The Icon Business Park Blok F No. 11, Jl. BSD Raya Utama Barat, Sampora, Cisauk, Kabupaten Tangerang, Banten 15345",
  "kecamatan": "Cisauk", "kota": "Kabupaten Tangerang",
  "lat": -6.31573, "lon": 106.65219, "geocode_src": "shared-building: The Icon Business Park Blok F (same complex as Labamu)",
  "url": "https://proglix.com",
  "funding_total_usd_m": 1.5, "last_round": "Seed", "last_round_year": 2023,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 13,
  "employees_note": "LinkedIn: 13 employees (Aug 2026, -5.6% YoY).",
  "investors": ["Y Combinator"],
  "sources": [YC + "proglix", "https://proglix.com/en/about-us/about", "https://linkedin.com/company/proglixindonesia"],
  "confidence": 0.65,
  "verify_note": "Singapore holdco with the Indonesian subsidiary PT Sinari Generasi Indonesia at The Icon Business Park, BSD — both stated in the proglix.com footer, so it is counted as Bodetabek. Coordinates reused from the same block-F complex already geocoded for Labamu.",
 },
 {
  "name": "Whiz", "id": "whiz", "yc_batch": "W22",
  "legal_name": "PT MidazPay Digital Indonesia",
  "sector": "fintech — family and youth banking app (BI-licensed payment services provider)",
  "in_dki": True,
  "hq_address": "Neo Soho Podomoro City Lt. 16, Jl. Letjen S. Parman Kav. 28, Tanjung Duren Selatan, Grogol Petamburan, Jakarta Barat 11470",
  "kecamatan": "Grogol Petamburan", "kota": "Jakarta Barat",
  "url": "https://whiz.id",
  "funding_total_usd_m": 0.125, "last_round": "Seed", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 4,
  "employees_note": "LinkedIn: 4 employees (Aug 2026).",
  "investors": ["Y Combinator", "Surge"],
  "sources": [YC + "whiz", "https://whiz.id/id/", "https://www.thecompanycheck.com/company/b/whiz/7zwapbopstx0z6hys"],
  "confidence": 0.45,
  "verify_note": "YC lists the company Inactive, but whiz.id is live as of Aug 2026, advertises 6.75% p.a. under LPS guarantee and states a Bank Indonesia payment-services licence with 100k+ users. Kept with the contradiction stated rather than counted as dead or as healthy.",
 },
]

# --- 3. YC × Indonesia entries deliberately NOT counted ---------------------
OUTSIDE = [
 {"name": "Super", "yc_batch": "W18", "url": "http://superapp.id/", "city": "Surabaya / Sidoarjo, East Java",
  "reason": "outside Greater Jakarta", "note": "PT Krakatau Karya Abadi. Social commerce; Series C, ~144 staff on LinkedIn (down 29% YoY), PitchBook still shows 600."},
 {"name": "Bakool", "yc_batch": "W22", "url": "https://www.bakool.id", "city": "Semarang, Central Java",
  "reason": "outside Greater Jakarta", "note": "PT Bakool Nusantara, formerly Radius. Group buying for tier-2 cities; YC lists Jakarta but every other source and its own operations sit in Semarang."},
 {"name": "FirstSupport.ai", "yc_batch": "W21", "url": "https://firstsupport.ai", "city": "Bandung, West Java",
  "reason": "outside Greater Jakarta", "note": "Unfunded, 2 people on LinkedIn; site did not resolve Aug 2026."},
 {"name": "Delegasi", "yc_batch": "S22", "url": "https://delegasi.co/", "city": "Bandung, West Java",
  "reason": "outside Greater Jakarta; YC status Inactive", "note": "Automated accounting for small businesses."},
 {"name": "Axross", "yc_batch": "W22", "url": "https://www.axross.co/", "city": "Singapore (Jakarta listed as a second location)",
  "reason": "Singapore-incorporated, no Indonesian office address published", "note": "Axross Pte Ltd, AI HVAC control; 6 staff across SG/MY/ID."},
 {"name": "Peeba", "yc_batch": "W23", "url": "http://peeba.com/", "city": "Hong Kong",
  "reason": "not an Indonesian company; YC status Inactive", "note": "Kingmaker Limited, B2B wholesale marketplace. YC's directory tags it Jakarta; the business is Hong Kong-based."},
]

def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    cos = raw['companies']
    by_id = {c.get('id'): c for c in cos}

    # 1. merge the Jack / Transfez duplicate (same PT, same address, same floor)
    jack, dup = by_id.get('jack'), by_id.get('transfez-jack')
    if jack and dup:
        jack['name'] = 'Transfez / Jack'
        jack['funding_total_usd_m'] = jack.get('funding_total_usd_m') or dup.get('funding_total_usd_m')
        jack['employees_est'] = max(jack.get('employees_est') or 0, dup.get('employees_est') or 0) or None
        jack['employees_note'] = ('LinkedIn 63 on the Jack page and 125 on the Transfez page (band 51-200); '
                                  'the higher figure is used for the merged entity.')
        jack['investors'] = sorted({*(jack.get('investors') or []), *(dup.get('investors') or [])})
        jack['sources'] = list(dict.fromkeys([*(jack.get('sources') or []), *(dup.get('sources') or [])]))
        jack['verify_note'] = ((jack.get('verify_note') or '') +
            ' MERGED Aug 2026: the census carried this company twice ("Jack (Transfez Group)" and '
            '"Transfez / Jack") — same legal entity PT Indo Koala Remittance, same floor of Prudential '
            'Centre. The duplicate row was removed.').strip()
        jack['confidence'] = min(0.85, max(jack.get('confidence') or 0, dup.get('confidence') or 0))
        cos[:] = [c for c in cos if c.get('id') != 'transfez-jack']
        by_id = {c.get('id'): c for c in cos}
        print('merged duplicate: transfez-jack -> jack')

    # 2. tag existing YC alumni
    tagged = 0
    for cid, batch in EXISTING.items():
        c = by_id.get(cid)
        if not c:
            print('WARN: no census row for YC alum id', cid, file=sys.stderr); continue
        if c.get('yc_batch') != batch:
            c['yc_batch'] = batch; tagged += 1

    # 3. append missing YC alumni
    added = 0
    for rec in NEW:
        if rec['id'] in by_id:
            by_id[rec['id']]['yc_batch'] = rec['yc_batch']; continue
        cos.append(dict(rec)); added += 1

    # 4. record the ones deliberately left out
    raw['yc_outside'] = OUTSIDE
    raw['yc_source'] = {
        "directory": "https://www.ycombinator.com/companies?regions=Indonesia",
        "mirror": "https://yc-oss.github.io/api/companies/all.json",
        "checked": "2026-08-29",
        "cohort": 31,
        "note": "31 YC companies carry Indonesia in their YC location or region tags. Every one is "
                "accounted for: in the census, or listed in yc_outside with the reason it is not.",
    }

    json.dump(raw, open(RAW, 'w', encoding='utf-8'), ensure_ascii=False)
    in_census = sum(1 for c in cos if c.get('yc_batch'))
    print(f'tagged {tagged} existing, added {added} new -> {len(cos)} companies, '
          f'{in_census} YC alumni in census, {len(OUTSIDE)} outside')

if __name__ == '__main__':
    main()
