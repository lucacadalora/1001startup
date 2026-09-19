#!/usr/bin/env python3
"""Gap batch — Jakarta companies the earlier census sweeps missed (Aug 29 2026).

Triggered by Luca asking why Qiscus was absent. Qiscus is not a YC company, so
the YC pass could not have found it; the earlier sweeps were address- and
sector-list driven and never hit it (its Jakarta office is one floor of
Sampoerna Strategic Square, and its LinkedIn entity is the Singapore holdco).
A diff of the census against ~110 well-known Indonesian tech names surfaced a
systematic gap; this file is the first verified batch out of that queue.

Every row: entity from the Ministry of Law registry (companieshouse.id) or the
company's own site, address from the site/registry, headcount from LinkedIn or
Revelio Labs with the spread stated, funding only where an amount is public.
    python3 scripts/census-gap.py && node scripts/build-census.js
"""
import json, os

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'census-raw.json')

NEW = [
 {
  "name": "Qiscus", "id": "qiscus",
  "legal_name": "PT Qiscus Tekno Indonesia (group: Qiscus Pte Ltd, Singapore)",
  "sector": "SaaS — omnichannel customer engagement platform (WhatsApp Business API, AI agents)",
  "in_dki": True,
  "hq_address": "Sampoerna Strategic Square North Tower Lt. 25, Jl. Jenderal Sudirman Kav. 45, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  "lat": -6.21677, "lon": 106.81799, "geocode_src": "company-published GeoCoordinates (qiscus.com JSON-LD)",
  "url": "https://www.qiscus.com",
  "funding_total_usd_m": 2, "last_round": "Strategic (Init6)", "last_round_year": 2023,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 165,
  "employees_note": "LinkedIn: 165 employees (Aug 2026, +8.3% YoY), spread across Indonesia, Singapore, Malaysia and Qatar.",
  "investors": ["Init6"],
  "sources": [
    "https://www.qiscus.com/en/contact",
    "https://technode.global/2023/10/24/qiscus-secures-2m-from-init6-for-southeast-asian-markets-expansion/",
    "https://companieshouse.id/qiscus-tekno-indonesia"],
  "confidence": 0.8,
  "verify_note": "Founded 2013; WhatsApp Business API official partner; 20+ channels. Jakarta office address and coordinates are the company's own structured data; the Ministry of Law registry still lists an older CoHive 101 (Mega Kuningan) address for PT Qiscus Tekno Indonesia. Engineering roots in Yogyakarta (its published phone is a 0274 line) but LinkedIn and the site both give South Jakarta as HQ. Only the US$2M Init6 round (Oct 2023) has a public amount — the company stated it had been profitable since 2019 and that this was its first funding since; trackers list earlier undisclosed rounds.",
 },
 {
  "name": "LinkAja", "id": "linkaja",
  "legal_name": "PT Fintek Karya Nusantara",
  "sector": "fintech: payments — national e-wallet and electronic money (BI-licensed)",
  "in_dki": True,
  "hq_address": "Menara Citicon Lt. 3, Jl. Letjen S. Parman Kav. 72, Slipi, Palmerah, Jakarta Barat 11410",
  "kecamatan": "Palmerah", "kota": "Jakarta Barat",
  "url": "https://www.linkaja.id",
  "funding_total_usd_m": 120, "last_round": "Series B", "last_round_year": 2020,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 471,
  "employees_note": "Revelio Labs: 471 (Mar 2026), down 26% from 639 in 2023; the LinkedIn page shows 302.",
  "investors": ["Telkomsel", "Grab", "Gojek", "BRI Ventures", "Mandiri Capital Indonesia"],
  "sources": ["https://companieshouse.id/fintek-karya-nusantara", "https://www.cbinsights.com/company/linkaja", "https://www.reveliolabs.com/companies/fintek-karya-nusantara/employees"],
  "confidence": 0.65,
  "verify_note": "State-linked ownership (Telkomsel plus the Himbara banks and other SOEs) with a 2020 Series B led by Grab and joined by Gojek; US$120M total raised per CB Insights. Registered address from the Ministry of Law registry.",
 },
 {
  "name": "Modalku (Funding Societies)", "id": "modalku",
  "legal_name": "PT Mitrausaha Indonesia Grup (group: Funding Societies, Singapore)",
  "sector": "fintech: lending — SME digital financing, OJK-licensed productive lending",
  "in_dki": True,
  "hq_address": "Unifam Tower Lt. 6, Perkantoran Sunrise Garden, Jl. Panjang Blok A3 No. 1-7, Kedoya Utara, Kebon Jeruk, Jakarta Barat 11520",
  "kecamatan": "Kebon Jeruk", "kota": "Jakarta Barat",
  "url": "https://modalku.co.id",
  "funding_total_usd_m": 399.8, "last_round": "Series C+ (group)", "last_round_year": 2022,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 54,
  "employees_note": "LinkedIn Modalku (PT Mitrausaha Indonesia Grup) page: 54; the group page Funding Societies | Modalku shows 218 across 14 countries. Indonesian headcount sits between the two — the conservative figure is used.",
  "investors": ["Sequoia India", "SoftBank Vision Fund 2", "Peak XV", "SoftBank Ventures Asia", "Alpha JWC Ventures"],
  "sources": ["https://modalku.co.id/tentang-kami", "https://linkedin.com/company/modalku", "https://linkedin.com/company/funding-societies-modalku"],
  "confidence": 0.5,
  "verify_note": "Modalku is the Indonesian arm of the Singapore-headquartered Funding Societies group; the US$399.8M is GROUP funding across 9 rounds, not Indonesia-only — read the ranking accordingly. Address from the company's own site.",
 },
 {
  "name": "Anteraja", "id": "anteraja",
  "legal_name": "PT Tri Adi Bersama (subsidiary of PT Adi Sarana Armada Tbk / ASSA)",
  "sector": "logistics — last-mile parcel delivery and e-commerce courier network",
  "in_dki": True,
  "hq_address": "Kuningan City Lt. 6-7, Jl. Prof. Dr. Satrio Kav. 18, Karet Kuningan, Setiabudi, Jakarta Selatan 12940",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  "url": "https://anteraja.id",
  "funding_total_usd_m": 35.9, "last_round": "Corporate / parent injection", "last_round_year": 2021,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 895,
  "employees_note": "LinkedIn: 895 (Aug 2026). Revelio Labs counts 3,073 for PT Tri Adi Bersama — that figure includes the courier fleet, which the census's method excludes as gig work, so the office/staff figure is used here.",
  "investors": ["PT Adi Sarana Armada Tbk (ASSA)"],
  "sources": ["https://www.assa.id/en/about/our-business", "https://linkedin.com/company/anteraja", "https://www.reveliolabs.com/companies/tri-adi-bersama/employees"],
  "confidence": 0.6,
  "verify_note": "Launched 2019 as the tech-logistics arm of the listed ASSA group. The US$35.9M is an aggregator figure that mixes parent capital injections with outside investment; treat as indicative. Address corroborated by two Indonesian company directories.",
 },
 {
  "name": "Lifepal", "id": "lifepal",
  "legal_name": "PT Lifepal Technologies Indonesia (brokerage: PT Anugrah Atma Adiguna)",
  "sector": "insurtech — online insurance marketplace and brokerage (OJK-licensed)",
  "in_dki": True,
  "hq_address": "CIBIS Nine Lt. 17, Jl. TB Simatupang No. 2, Cilandak Timur, Pasar Minggu, Jakarta Selatan 12560",
  "kecamatan": "Pasar Minggu", "kota": "Jakarta Selatan",
  "url": "https://lifepal.co.id",
  "funding_total_usd_m": 12, "last_round": "Series A", "last_round_year": 2021,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 79,
  "employees_note": "LinkedIn: 79 employees (Aug 2026).",
  "investors": [],
  "sources": ["https://lifepal.co.id/tentang/", "https://www.apparindo.or.id/anugrah-atma-adiguna/", "https://companieshouse.id/anugrah-atma-adiguna"],
  "confidence": 0.6,
  "verify_note": "Founded 2018; sells through the licensed broker PT Anugrah Atma Adiguna, whose Apparindo (broker association) registry entry gives the CIBIS Nine address and the lifepal.co.id website. US$12M total across 3 rounds per trackers; round-level investor detail not verified here, so the investor list is left empty rather than guessed.",
 },
 {
  "name": "Jojonomic", "id": "jojonomic",
  "legal_name": "PT Jojo Nomic Indonesia",
  "sector": "SaaS — expense management and no-code business process automation",
  "in_dki": True,
  "hq_address": "Gedung Mid Plaza 2 Lt. 4, Jl. Jenderal Sudirman Kav. 10-11, Karet Tengsin, Tanah Abang, Jakarta Pusat 10220",
  "kecamatan": "Tanah Abang", "kota": "Jakarta Pusat",
  "url": "https://www.jojonomic.com",
  "funding_total_usd_m": 1.5, "last_round": "Venture round", "last_round_year": 2024,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 36,
  "employees_note": "LinkedIn: 36 employees (Aug 2026, -41% YoY).",
  "investors": [],
  "sources": ["https://companieshouse.id/jojo-nomic-indonesia", "https://www.jojonomic.com/", "https://indexed.vc/companies/jojonomic"],
  "confidence": 0.55,
  "verify_note": "Founded 2015. Registered address from the Ministry of Law registry (Mid Plaza 2); an older filing lists Talavera Office Park on TB Simatupang. Tracxn marks the company acquired as of Jun 2024 without naming an acquirer; the product and site are live.",
 },
 {
  "name": "Jiwa Group (Kopi Janji Jiwa)", "id": "jiwa-group",
  "legal_name": "PT Luna Boga Narayan",
  "sector": "F&B — grab-and-go coffee chain and franchise (Janji Jiwa, Jiwa Toast)",
  "in_dki": True,
  "hq_address": None,
  "kecamatan": "Kebon Jeruk", "kota": "Jakarta Barat",
  "url": "https://jiwagroup.com",
  "funding_total_usd_m": None, "last_round": "Growth (undisclosed)", "last_round_year": 2021,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 477,
  "employees_note": "LinkedIn: 477 (Aug 2026, +9% YoY) — corporate and outlet management. Contact databases estimate ~2,300 including store crew across the franchise network.",
  "investors": ["Openspace Ventures", "Capsquare Asia Partners"],
  "sources": ["https://linkedin.com/company/jiwagroup", "https://hybrid.co.id/post/jiwa-group-terima-pendanaan-konsep-grab-go-mengubah-lanskap-industri-kopi-lokal/", "https://arest.web.id/content/pt-luna-boga-narayan-jiwa-group"],
  "confidence": 0.55,
  "verify_note": "Founded 2017-18; the peer of Kopi Kenangan and Fore, both already in the census — a clear earlier gap. Funding from Openspace and Capsquare Asia Partners (2021) was announced without an amount. Head office is reported at kecamatan level (Kebon Jeruk, Jakarta Barat); no street address is published, so the pin is a kecamatan centroid.",
 },
 {
  "name": "AdaKami", "id": "adakami",
  "legal_name": "PT Pembiayaan Digital Indonesia",
  "sector": "fintech: lending — unsecured consumer lending, OJK-licensed",
  "in_dki": True,
  "hq_address": "Cyber 2 Tower Lt. 28, Jl. H.R. Rasuna Said Blok X-5 No. 13, Kuningan Timur, Setiabudi, Jakarta Selatan 12950",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  "url": "https://www.adakami.id",
  "funding_total_usd_m": 31.69, "last_round": "Line of credit", "last_round_year": 2024,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 128,
  "employees_note": "LinkedIn: 128 employees (Aug 2026, +9.6% YoY).",
  "investors": [],
  "sources": ["https://companieshouse.id/pembiayaan-digital-indonesia", "https://www.adakami.id/about", "https://www.cbinsights.com/company/adakami"],
  "confidence": 0.65,
  "verify_note": "Founded 2018, OJK-licensed P2P lender. Registered address from the Ministry of Law registry. The US$31.69M is a credit facility rather than equity per CB Insights.",
 },
 {
  "name": "ALVA", "id": "alva",
  "legal_name": "PT Ilectra Motor Group (Indika Energy group; distribution: PT Electra Distribusi Indonesia)",
  "sector": "mobility — electric two-wheeler manufacturer and EV ecosystem (charging, battery, aftersales)",
  "in_dki": True,
  "hq_address": "Graha Mitra Lt. 3, Jl. Jenderal Gatot Subroto Kav. 21, Karet Semanggi, Setiabudi, Jakarta Selatan 12930",
  "kecamatan": "Setiabudi", "kota": "Jakarta Selatan",
  "url": "https://www.alvaauto.com",
  "funding_total_usd_m": 113, "last_round": "Corporate (Indika Energy, cumulative)", "last_round_year": 2026,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 238,
  "employees_note": "LinkedIn: 238 (Aug 2026, +18.7% YoY); one contact database estimates 350. Excludes the Cikarang plant's production workforce, which is not separately published.",
  "investors": ["PT Indika Energy Tbk"],
  "sources": [
    "https://companieshouse.id/ilectra-motor-group",
    "https://otomotif.antaranews.com/berita/5620441/investasi-alva-di-indonesia-tembus-lebih-dari-rp1-triliun",
    "https://otomotif.kompas.com/read/2025/05/23/104200215/alva-klaim-mampu-produksi-100000-motor-listrik-per-tahun"],
  "confidence": 0.6,
  "verify_note": "Founded 2021 under Indika Energy. Registered address from the Ministry of Law registry; the plant is at Kawasan Delta Mas, Cikarang (Kabupaten Bekasi) with a claimed 100,000 units/year capacity. Funding is CORPORATE, not venture: Indonesian press (Jun 2026) reports Indika has put in about Rp 2 trillion cumulatively (~US$113M at Rp 17,701/US$); trackers separately list US$60M in one round. Sales 4,500 units in 2025, +52% YoY.",
 },
]

def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    have = {c.get('id') for c in raw['companies']}
    added = [r for r in NEW if r['id'] not in have]
    raw['companies'].extend(dict(r) for r in added)
    json.dump(raw, open(RAW, 'w', encoding='utf-8'), ensure_ascii=False)
    print(f"added {len(added)}/{len(NEW)}: {', '.join(r['name'] for r in added)} -> {len(raw['companies'])} companies")

if __name__ == '__main__':
    main()
