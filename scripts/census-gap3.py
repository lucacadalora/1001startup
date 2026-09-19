#!/usr/bin/env python3
"""Gap batch 3 — Kitabisa and StickEarn (Aug 29 2026).

Luca, reading the table: "apparently kitabisa has not been here ... also check
stickearn, i believe it has head count too."

Kitabisa was a KNOWN gap, not an unknown one: it has sat in `endeavor_pending`
since the Endeavor cohort was tagged, listed as "on the roster, not yet in the
census" while the assessment workflow that was meant to clear those ~15 Jakarta
names died with a session restart. StickEarn was never surfaced by any sweep —
adtech is not on the sector lists the earlier passes walked.

Both pass Luca's inclusion rule (tech/VC-built, own legal entity, sourceable
headcount). Both were checked the way the rest of the census is: entity and
address from a primary record, funding only where an amount is public and
linked, headcount from a LIVE LinkedIn read with the spread against every other
figure stated, website fetched today.

Idempotent UPSERT: re-running restores exactly these fields on an existing row
(the repair path after a cross-session clobber) and leaves everything else —
logo, geocode, sprite — alone.

    python3 scripts/census-gap3.py && node scripts/build-census.js
"""
import json, os, tempfile

RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'census-raw.json')
TODAY = '2026-08-29'

ROWS = [
 {
  "name": "Kitabisa", "id": "kitabisa",
  "legal_name": "PT Kita Bisa Indonesia",
  # wording is load-bearing: build-census's SECTOR_KEYS is first-match-wins, and
  # a string led by "fintech" lands in Fintech rather than in Insurtech on the
  # word "insurer" further down the line.
  "sector": "fintech — donation crowdfunding, zakat and wakaf payments platform; licensed sharia life insurer (Asuransi Kitabisa)",
  "in_dki": True,
  "hq_address": "Jl. Raya Cilandak KKO No. 31, RT.14/RW.8, Ragunan, Pasar Minggu, Jakarta Selatan 12550",
  "kecamatan": "Pasar Minggu", "kota": "Jakarta Selatan",
  # street-level on purpose: OSM carries no address point for No. 31, and the
  # geocoder's own fallback put this row on Pasar Minggu STATION. This segment is
  # the RW 08 stretch of Jalan Cilandak KKO named in the registered address. A
  # better pin belongs here, in this file.
  "lat": -6.30280, "lon": 106.81431,
  "geocode_kind": "road",
  "geocode_src": "nominatim: Jalan Cilandak KKO, RW 08, Ragunan, Pasar Minggu (street-level)",
  "url": "https://kitabisa.com",
  "funding_total_usd_m": 5, "last_round": "Equity (IFC, preferred shares)", "last_round_year": 2023,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 523,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/kita-bisa/",
  "employees_note": (
    "LinkedIn lists 523 people on the company page, read 2026-08-29. Its own size band still says "
    "201-500, and two vendor models sit lower — Revelio Labs 453 (Mar 2026, down 12.5% from 517 in "
    "2023) and PitchBook 435 — so read it as the top of a 435-523 spread. The count covers everyone "
    "who lists Kitabisa as employer, which includes the licensed insurer PT Asuransi Jiwa Syariah "
    "Kitabisa (22 on its own page) and the Yayasan; no separate row is kept for either."),
  "investors": ["IFC (World Bank Group)", "Northstar Group", "500 Global", "Endeavor Catalyst",
                "Marein (PT Maskapai Reasuransi Indonesia Tbk)", "Argor"],
  "funding_src_manual": "https://disclosures.ifc.org/project-detail/SII/46825/kitabisa",
  "funding_note": (
    "US$5M of equity from IFC, subscribed as preferred shares in PT Kita Bisa Indonesia. IFC's own "
    "disclosure for project 46825 records it approved 5 Aug 2022, signed 30 Dec 2022 and invested "
    "7 Mar 2023. It is the only Kitabisa round with a disclosed amount — the 2015 seed, the Nov 2018 "
    "Series A and the 2019 accelerator round were never sized publicly, and DealStreetAsia's Feb 2023 "
    "report of a ~US$20M round being finalised was never confirmed by the company. Treat the figure "
    "as a floor, not a lifetime total."),
  "sources": [
    "https://disclosures.ifc.org/project-detail/SII/46825/kitabisa",
    "https://www.linkedin.com/company/kita-bisa/",
    "https://www.linkedin.com/in/alfatihtimur",
    "https://katadata.co.id/digital/startup/62cb83b0d325e/kitabisa-raih-modal-rp-74-9-miliar-dari-ifc-ekspansi-asuransi-syariah",
    "https://money.kompas.com/read/2021/05/05/155253726/tak-berizin-ojk-resmi-tutup-program-saling-jaga-kitabisacom",
    "https://asuransi.salingjaga.com/",
    "https://indonesia.endeavor.org/company/kitabisa-com"],
  "site_status": "blocked-or-error", "liveness_checked": TODAY,
  "confidence": 0.9,
  "verify_note": (
    "Founded 2013 by M. Alfatih Timur and Vikra Ijas; Indonesia's largest donation-crowdfunding "
    "platform — the co-founder's own profile puts it at 31 million transactions a year from more than "
    "10 million donors. Legal entity, head office and the investment dates all come from IFC's own "
    "Summary of Investment Information (project 46825, status Active). The investor list is that "
    "co-founder's public profile — IFC, Northstar, Marein, Argor, 500 Startups and Endeavor Catalyst — "
    "with no round-by-round breakdown anywhere public. Regulatory history worth carrying: in May 2021 "
    "OJK's Satgas Waspada Investasi ordered the 'Saling Jaga' mutual-aid programme stopped as "
    "unlicensed insurance; Kitabisa then acquired a life-insurance carrier licence and now runs it "
    "through PT Asuransi Jiwa Syariah Kitabisa under OJK supervision. kitabisa.com answers this VM "
    "with a Cloudflare challenge (403) but renders normally on a live crawl — blocked, not down."),
 },
 {
  "name": "StickEarn", "id": "stickearn",
  "legal_name": "PT Paragon Pratama Teknologi",
  # "media" is the intended bucket; keep 'data' and 'marketplace' out of this
  # string or SECTOR_KEYS routes it to AI & Cloud or Commerce first.
  "sector": "media — out-of-home and digital-OOH advertising technology (vehicle branding, billboards, campaign measurement)",
  "in_dki": True,
  "hq_address": "Jl. Letjen Suprapto No. 400 (Ziebart Complex), Cempaka Putih, Jakarta Pusat 10510",
  "kecamatan": "Cempaka Putih", "kota": "Jakarta Pusat",
  # same story: no address point for No. 400, and the fallback landed on the
  # Cempaka Putih suburb centroid. This is the Cempaka Putih Timur stretch of the
  # street itself.
  "lat": -6.17020, "lon": 106.86721,
  "geocode_kind": "road",
  "geocode_src": "nominatim: Jalan Letnan Jenderal Suprapto, RW 05, Cempaka Putih Timur (street-level)",
  "url": "https://stickearn.com",
  "funding_total_usd_m": 5.5, "last_round": "Series A", "last_round_year": 2019,
  "valuation_usd_m": None, "valuation_note": None,
  "employees_est": 219,
  "employees_asof": TODAY,
  "employees_src": "https://www.linkedin.com/company/stickearn/",
  "employees_note": (
    "LinkedIn lists 219 people on the company page, read 2026-08-29. Its own size band still says "
    "51-200 and a vendor model puts the workforce near 170 and drifting down ~5% a year, so read it "
    "as the top of a 170-219 spread. Drivers who carry the vehicle ads are mitra, paid per campaign, "
    "and are not counted here."),
  "investors": ["East Ventures", "SMDV", "Grab", "OVO", "Agaeti Ventures"],
  "funding_src_manual": "https://east.vc/news/press-release/stickearn-5-5m-east-ventures-smdv-grab-ovo",
  "funding_note": (
    "US$5.5M Series A announced 15 Oct 2019, co-led by East Ventures and SMDV with Grab, OVO and "
    "Agaeti Ventures — the amount is stated in East Ventures' own release and in StickEarn's. "
    "Trackers carry a US$6.5M lifetime total; the extra ~US$1M is an earlier seed whose size was "
    "never disclosed, so only the announced round is counted."),
  "sources": [
    "https://east.vc/news/press-release/stickearn-5-5m-east-ventures-smdv-grab-ovo",
    "https://stickearn.com/insights-en/news-en/stickearn-indonesia-meraih-usd-55-juta-dalam-pendanaan-seri-oleh-east-ventures-dan-smdv/?lang=en",
    "https://kr-asia.com/indonesias-stickearn-raises-usd-5-5-million-in-series-a-funding-from-grab-ovo-and-others",
    "https://stickearn.com/tentang-stickearn/?lang=en",
    "https://stickearn.com/contact/",
    "https://companieshouse.id/paragon-pratama-teknologi",
    "https://www.linkedin.com/company/stickearn/",
    "https://www.fortuneidn.com/business/40-under-40-stickearn-merevolusi-iklan-ooh-di-indonesia-00-6cmtl-j7l0ng"],
  "site_status": "ok", "liveness_checked": TODAY,
  "confidence": 0.85,
  "verify_note": (
    "Founded 2017 by Archie Carlson, Garry Limanata, Sugito Alim and Hartanto Alim (its LinkedIn page "
    "says 2016); StickEarn's own About page names the operating entity as PT Paragon Pratama "
    "Teknologi, and the Ministry of Law registry carries it under number 752464 at GEDUNG ZIEBART, "
    "JALAN LETJEND. SUPRAPTO 400 — the same address the site publishes. No relation to "
    "ParagonCorp/Wardah, which shares only the word Paragon. Sells transit and vehicle branding, digital "
    "billboards and an OOH buying platform, with a market-insight product, Playlog. Head office is "
    "the Cempaka Putih address on its contact page; there is also a Surabaya sales office. Operating "
    "as of today: stickearn.com returns 200, the LinkedIn page has posted through Jul 2026, and "
    "Fortune Indonesia ran it in 40 Under 40 in Apr 2025."),
 },
]


def main():
    raw = json.load(open(RAW, encoding='utf-8'))
    by = {c.get('id'): c for c in raw['companies']}
    added = updated = 0
    for row in ROWS:
        cur = by.get(row['id'])
        if cur is None:
            raw['companies'].append(dict(row))
            added += 1
            print(f"added   {row['id']:12s} {row['name']}")
        else:
            cur.update(dict(row))
            updated += 1
            print(f"updated {row['id']:12s} {row['name']}")
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(RAW), suffix='.tmp')
    with os.fdopen(fd, 'w', encoding='utf-8') as fh:
        json.dump(raw, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, RAW)
    print(f"{added} added, {updated} updated -> {len(raw['companies'])} companies")


if __name__ == '__main__':
    main()
